// =============================================
// ระบบเว็บแจ้งซ่อม - Backend Server (Admin Only)
// =============================================

require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const XLSX = require('xlsx');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'repair_system_secret_key_2024';

// Security Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());

// Rate Limiting - ป้องกัน Brute-force Login
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, message: 'ลองเข้าสู่ระบบบ่อยเกินไป กรุณารอ 15 นาที' }
});
app.use('/api/auth/login', loginLimiter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(__dirname));

// สร้างโฟลเดอร์ uploads ถ้ายังไม่มี
if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads');
if (!fs.existsSync('./backups')) fs.mkdirSync('./backups');

// =============================================
// Database Connection
// =============================================
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'repair_system',
    charset: 'utf8mb4',
    connectTimeout: 10000
};

let db;
async function connectDB() {
    try {
        console.log('⏳ กำลังเชื่อมต่อฐานข้อมูล MySQL...');
        db = await mysql.createConnection(dbConfig);
        console.log('✅ เชื่อมต่อฐานข้อมูล MySQL สำเร็จ');
    } catch (err) {
        console.error('❌ ไม่สามารถเชื่อมต่อฐานข้อมูล:', err.message);
        console.error('💡 กรุณาตรวจสอบว่า XAMPP MySQL ทำงานอยู่');
        process.exit(1);
    }
}

// =============================================
// Multer - อัพโหลดรูปภาพ
// =============================================
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, './uploads/'),
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, unique + path.extname(file.originalname));
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        const mime = allowed.test(file.mimetype);
        if (ext && mime) cb(null, true);
        else cb(new Error('อนุญาตเฉพาะไฟล์รูปภาพเท่านั้น'));
    }
});

// =============================================
// Auth & RBAC Middleware - Admin Only
// =============================================
function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'กรุณาเข้าสู่ระบบ' });
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ success: false, message: 'Token ไม่ถูกต้องหรือหมดอายุ' });
    }
}

function adminMiddleware(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึง (Admin เท่านั้น)' });
    }
    next();
}

// =============================================
// ฟังก์ชันช่วยเหลือ
// =============================================
function generateTicketNumber() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const rand = Math.floor(Math.random() * 9000) + 1000;
    return `REP-${y}${m}${d}-${rand}`;
}

// =============================================
// Routes: Authentication (Admin Only)
// =============================================

// POST /api/auth/login - เฉพาะ Admin เท่านั้นที่เข้าระบบได้
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password)
        return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        if (!rows.length)
            return res.status(401).json({ success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
        const user = rows[0];
        
        // อนุญาตเฉพาะ Admin เท่านั้น
        if (user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถเข้าใช้งานได้' });
        }
        
        const valid = await bcrypt.compare(password, user.password);
        if (!valid)
            return res.status(401).json({ success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
        const token = jwt.sign({ id: user.id, username: user.username, role: user.role, full_name: user.full_name }, JWT_SECRET, { expiresIn: '8h' });
        res.json({ success: true, token, user: { id: user.id, username: user.username, role: user.role, full_name: user.full_name } });
    } catch (err) {
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด: ' + err.message });
    }
});

// =============================================
// Profile Routes (Admin) - IMPORTANT: ต้องมาก่อน /api/equipment/:id
// =============================================

// GET /api/profile
app.get('/api/profile', authMiddleware, async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT id, username, full_name, role, created_at FROM users WHERE id = ?',
            [req.user.id]
        );
        if (!rows.length) {
            return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้' });
        }
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT /api/profile
app.put('/api/profile', authMiddleware, async (req, res) => {
    const { full_name } = req.body;
    try {
        await db.query(
            'UPDATE users SET full_name = ? WHERE id = ?',
            [full_name, req.user.id]
        );
        res.json({ success: true, message: 'อัพเดตโปรไฟล์สำเร็จ' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Avatar Upload
const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const avatarsDir = './uploads/avatars';
        if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });
        cb(null, avatarsDir);
    },
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + req.user.id;
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, unique + ext);
    }
});
const avatarUpload = multer({
    storage: avatarStorage,
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        const mime = allowed.test(file.mimetype);
        if (ext && mime) cb(null, true);
        else cb(new Error('อนุญาตเฉพาะไฟล์รูปภาพ (JPG, PNG, GIF, WEBP) เท่านั้น'));
    }
});

app.post('/api/profile/avatar', authMiddleware, (req, res) => {
    avatarUpload.single('avatar')(req, res, async (err) => {
        if (err) return res.status(400).json({ success: false, message: err.message });
        if (!req.file) return res.status(400).json({ success: false, message: 'กรุณาเลือกไฟล์รูปภาพ' });
        try {
            const avatar_path = `/uploads/avatars/${req.file.filename}`;
            const [oldUser] = await db.query('SELECT avatar FROM users WHERE id = ?', [req.user.id]);
            if (oldUser[0]?.avatar && oldUser[0].avatar !== avatar_path) {
                const oldPath = '.' + oldUser[0].avatar;
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
            await db.query('UPDATE users SET avatar = ? WHERE id = ?', [avatar_path, req.user.id]);
            res.json({ success: true, avatar: avatar_path });
        } catch (error) {
            res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการบันทึก' });
        }
    });
});

// POST /api/profile/change-password
app.post('/api/profile/change-password', authMiddleware, async (req, res) => {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
        return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    }
    if (new_password.length < 6) {
        return res.status(400).json({ success: false, message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' });
    }
    try {
        const [users] = await db.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
        if (users.length === 0) return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้' });
        const valid = await bcrypt.compare(current_password, users[0].password);
        if (!valid) return res.status(400).json({ success: false, message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
        const hashed = await bcrypt.hash(new_password, 10);
        await db.query('UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?', [hashed, req.user.id]);
        res.json({ success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' });
    }
});

// =============================================
// Routes: Dashboard Stats (Admin เท่านั้น)
// =============================================

app.get('/api/dashboard/stats', authMiddleware, adminMiddleware, async (req, res) => {
    const { date_from, date_to } = req.query;
    const dateFilter = [];
    const dateParams = [];

    if (date_from) {
        dateFilter.push('requested_at >= ?');
        dateParams.push(date_from + ' 00:00:00');
    }
    if (date_to) {
        dateFilter.push('requested_at <= ?');
        dateParams.push(date_to + ' 23:59:59');
    }
    const dateWhere = dateFilter.length ? ' AND ' + dateFilter.join(' AND ') : '';

    try {
        const [totalRows] = await db.query(`SELECT COUNT(*) as total FROM repair_requests WHERE 1=1${dateWhere}`, dateParams);
        const [pendingRows] = await db.query(`SELECT COUNT(*) as pending FROM repair_requests WHERE status='pending'${dateWhere}`, dateParams);
        const [inProgressRows] = await db.query(`SELECT COUNT(*) as in_progress FROM repair_requests WHERE status='in_progress'${dateWhere}`, dateParams);
        const [sentRepairRows] = await db.query(`SELECT COUNT(*) as sent_repair FROM repair_requests WHERE status='sent_repair'${dateWhere}`, dateParams);
        const [completedRows] = await db.query(`SELECT COUNT(*) as completed FROM repair_requests WHERE status='completed'${dateWhere}`, dateParams);
        const [urgentRows] = await db.query(`SELECT COUNT(*) as urgent FROM repair_requests WHERE priority='urgent' AND status != 'completed'${dateWhere}`, dateParams);

        const total = totalRows[0]?.total || 0;
        const pending = pendingRows[0]?.pending || 0;
        const in_progress = inProgressRows[0]?.in_progress || 0;
        const sent_repair = sentRepairRows[0]?.sent_repair || 0;
        const completed = completedRows[0]?.completed || 0;
        const urgent = urgentRows[0]?.urgent || 0;

        const [monthly] = await db.query(`
            SELECT DATE_FORMAT(requested_at, '%Y-%m') as month, COUNT(*) as count
            FROM repair_requests
            WHERE (requested_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH))
            ${dateFilter.length ? ' AND ' + dateFilter.join(' AND ') : ''}
            GROUP BY month ORDER BY month
        `, dateParams);

        const [byType] = await db.query(`
            SELECT et.name, COUNT(rr.id) as count
            FROM repair_requests rr
            JOIN equipment e ON rr.equipment_id = e.id
            JOIN equipment_types et ON e.equipment_type_id = et.id
            WHERE 1=1${dateWhere}
            GROUP BY et.name
        `, dateParams);

        res.json({ success: true, stats: { total, pending, in_progress, sent_repair, completed, urgent }, monthly, byType });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =============================================
// Routes: Equipment Types
// =============================================

// GET /api/equipment-types
app.get('/api/equipment-types', authMiddleware, async (req, res) => {
    try {
        const [types] = await db.query('SELECT * FROM equipment_types ORDER BY name');
        for (let type of types) {
            const [parts] = await db.query('SELECT * FROM equipment_parts WHERE equipment_type_id = ?', [type.id]);
            type.parts = parts;
        }
        res.json({ success: true, data: types });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =============================================
// Routes: Equipment
// =============================================

// GET /api/equipment/code/:code - ต้องมาก่อน /api/equipment/:id
app.get('/api/equipment/code/:code', authMiddleware, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT e.*, et.name as type_name, et.has_parts FROM equipment e
             JOIN equipment_types et ON e.equipment_type_id = et.id
             WHERE e.equipment_code = ? AND e.status = 'active'`,
            [req.params.code]
        );
        if (!rows.length)
            return res.status(404).json({ success: false, message: 'ไม่พบครุภัณฑ์นี้ในระบบ' });
        const eq = rows[0];
        if (eq.has_parts) {
            const [parts] = await db.query('SELECT * FROM equipment_parts WHERE equipment_type_id = ?', [eq.equipment_type_id]);
            eq.parts = parts;
        }
        res.json({ success: true, data: eq });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/equipment
app.get('/api/equipment', authMiddleware, async (req, res) => {
    const { type_id, search } = req.query;
    let sql = `SELECT e.*, et.name as type_name FROM equipment e JOIN equipment_types et ON e.equipment_type_id = et.id WHERE e.status = 'active'`;
    const params = [];
    if (type_id) { sql += ' AND e.equipment_type_id = ?'; params.push(type_id); }
    if (search) { sql += ' AND (e.equipment_code LIKE ? OR e.equipment_name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    sql += ' ORDER BY e.created_at DESC';
    try {
        const [rows] = await db.query(sql, params);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// POST /api/equipment
app.post('/api/equipment', authMiddleware, adminMiddleware, async (req, res) => {
    const { equipment_code, equipment_name, equipment_type_id, location_building, location_department, location_room } = req.body;
    if (!equipment_code || !equipment_name || !equipment_type_id)
        return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลที่จำเป็น' });
    try {
        const [existing] = await db.query('SELECT id FROM equipment WHERE equipment_code = ?', [equipment_code]);
        if (existing.length)
            return res.status(409).json({ success: false, message: 'รหัสครุภัณฑ์นี้มีอยู่แล้ว' });
        await db.query(
            'INSERT INTO equipment (equipment_code, equipment_name, equipment_type_id, location_building, location_department, location_room) VALUES (?, ?, ?, ?, ?, ?)',
            [equipment_code, equipment_name, equipment_type_id, location_building, location_department, location_room]
        );
        res.json({ success: true, message: 'เพิ่มครุภัณฑ์สำเร็จ' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT /api/equipment/:id
app.put('/api/equipment/:id', authMiddleware, adminMiddleware, async (req, res) => {
    const { equipment_code, equipment_name, equipment_type_id, location_building, location_department, location_room } = req.body;
    try {
        await db.query(
            `UPDATE equipment SET equipment_code=?, equipment_name=?, equipment_type_id=?, location_building=?, location_department=?, location_room=? WHERE id=?`,
            [equipment_code, equipment_name, equipment_type_id, location_building, location_department, location_room, req.params.id]
        );
        res.json({ success: true, message: 'อัพเดตครุภัณฑ์สำเร็จ' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/equipment/:id
app.get('/api/equipment/:id', authMiddleware, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT e.*, et.name as type_name, et.has_parts FROM equipment e
             JOIN equipment_types et ON e.equipment_type_id = et.id
             WHERE e.id = ?`,
            [req.params.id]
        );
        if (!rows.length)
            return res.status(404).json({ success: false, message: 'ไม่พบครุภัณฑ์' });
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE /api/equipment/:id
app.delete('/api/equipment/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        await db.query('UPDATE equipment SET status = ? WHERE id = ?', ['inactive', req.params.id]);
        res.json({ success: true, message: 'ลบครุภัณฑ์สำเร็จ' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =============================================
// Routes: Repair Requests
// =============================================

// POST /api/repairs
app.post('/api/repairs', authMiddleware, upload.single('image'), async (req, res) => {
    const { equipment_id, equipment_parts, problem_description, requester_name, location_building, location_department, location_room, priority } = req.body;
    if (!equipment_id || !problem_description || !requester_name)
        return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลที่จำเป็น' });
    try {
        const ticket = generateTicketNumber();
        const image_path = req.file ? `/uploads/${req.file.filename}` : null;
        await db.query(
            `INSERT INTO repair_requests (ticket_number, equipment_id, equipment_parts, problem_description, requester_name, location_building, location_department, location_room, priority, image_path, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [ticket, equipment_id, equipment_parts || null, problem_description, requester_name, location_building, location_department, location_room, priority || 'normal', image_path]
        );
        const [newReq] = await db.query('SELECT id FROM repair_requests WHERE ticket_number = ?', [ticket]);
        await db.query(
            'INSERT INTO status_history (repair_request_id, old_status, new_status, note) VALUES (?, ?, ?, ?)',
            [newReq[0].id, null, 'pending', 'สร้างคำแจ้งซ่อมใหม่']
        );
        res.json({ success: true, message: 'บันทึกคำแจ้งซ่อมสำเร็จ', ticket_number: ticket });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/repairs
app.get('/api/repairs', authMiddleware, async (req, res) => {
    const { status, priority, search, date_from, date_to, limit = 50, offset = 0 } = req.query;
    let sql = `SELECT rr.*, e.equipment_code, e.equipment_name, et.name as type_name
               FROM repair_requests rr
               JOIN equipment e ON rr.equipment_id = e.id
               JOIN equipment_types et ON e.equipment_type_id = et.id
               WHERE 1=1`;
    const params = [];

    if (status) { sql += ' AND rr.status = ?'; params.push(status); }
    if (priority) { sql += ' AND rr.priority = ?'; params.push(priority); }
    if (search) { sql += ' AND (rr.ticket_number LIKE ? OR rr.requester_name LIKE ? OR e.equipment_code LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (date_from) { sql += ' AND rr.requested_at >= ?'; params.push(date_from + ' 00:00:00'); }
    if (date_to) { sql += ' AND rr.requested_at <= ?'; params.push(date_to + ' 23:59:59'); }
    sql += ' ORDER BY rr.requested_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    try {
        const [rows] = await db.query(sql, params);

        let countSql = 'SELECT COUNT(*) as count FROM repair_requests WHERE 1=1';
        const countParams = [];
        if (status) { countSql += ' AND status = ?'; countParams.push(status); }
        if (priority) { countSql += ' AND priority = ?'; countParams.push(priority); }
        if (search) { countSql += ' AND (ticket_number LIKE ? OR requester_name LIKE ?)'; countParams.push(`%${search}%`, `%${search}%`); }
        if (date_from) { countSql += ' AND requested_at >= ?'; countParams.push(date_from + ' 00:00:00'); }
        if (date_to) { countSql += ' AND requested_at <= ?'; countParams.push(date_to + ' 23:59:59'); }
        const [countRows] = await db.query(countSql, countParams);

        res.json({ success: true, data: rows, total: countRows[0]?.count || 0 });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/repairs/:id
app.get('/api/repairs/:id', authMiddleware, async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT rr.*, e.equipment_code, e.equipment_name, et.name as type_name
             FROM repair_requests rr
             JOIN equipment e ON rr.equipment_id = e.id
             JOIN equipment_types et ON e.equipment_type_id = et.id
             WHERE rr.id = ?`,
            [req.params.id]
        );
        if (!rows.length)
            return res.status(404).json({ success: false, message: 'ไม่พบคำแจ้งซ่อม' });
        const [history] = await db.query(
            `SELECT sh.*, u.full_name as admin_name FROM status_history sh
             LEFT JOIN users u ON sh.changed_by = u.id
             WHERE sh.repair_request_id = ? ORDER BY sh.changed_at ASC`,
            [req.params.id]
        );
        res.json({ success: true, data: rows[0], history });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PATCH /api/repairs/:id/status
app.patch('/api/repairs/:id/status', authMiddleware, adminMiddleware, async (req, res) => {
    const { status, admin_note } = req.body;
    const repairId = req.params.id;
    const validStatuses = ['pending', 'in_progress', 'received', 'sent_repair', 'completed', 'returned', 'cancelled'];

    if (!status) return res.status(400).json({ success: false, message: 'กรุณาระบุสถานะ' });
    if (!validStatuses.includes(status)) return res.status(400).json({ success: false, message: 'สถานะไม่ถูกต้อง' });

    try {
        const [rows] = await db.query('SELECT status FROM repair_requests WHERE id = ?', [repairId]);
        if (!rows.length) return res.status(404).json({ success: false, message: 'ไม่พบคำแจ้งซ่อม' });

        const oldStatus = rows[0].status;
        const completedAt = status === 'completed' ? new Date() : null;

        await db.query(
            'UPDATE repair_requests SET status = ?, admin_note = ?, completed_at = ?, updated_at = NOW() WHERE id = ?',
            [status, admin_note || null, completedAt, repairId]
        );
        await db.query(
            'INSERT INTO status_history (repair_request_id, old_status, new_status, changed_by, note) VALUES (?, ?, ?, ?, ?)',
            [repairId, oldStatus, status, req.user.id, admin_note || null]
        );

        res.json({ success: true, message: 'อัพเดตสถานะสำเร็จ' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE /api/repairs/:id
app.delete('/api/repairs/:id', authMiddleware, adminMiddleware, async (req, res) => {
    const repairId = req.params.id;
    try {
        const [rows] = await db.query('SELECT id, ticket_number FROM repair_requests WHERE id = ?', [repairId]);
        if (!rows.length) {
            return res.status(404).json({ success: false, message: 'ไม่พบคำแจ้งซ่อม' });
        }
        await db.query('DELETE FROM repair_requests WHERE id = ?', [repairId]);
        res.json({
            success: true,
            message: `ลบคำร้องขอซ่อมหมายเลข ${rows[0].ticket_number} สำเร็จ`,
            deletedId: repairId
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด: ' + err.message });
    }
});

// =============================================
// Repair Cost Routes
// =============================================

// PUT /api/repairs/:id/cost
app.put('/api/repairs/:id/cost', authMiddleware, async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์เข้าถึง (ต้องเป็น Admin เท่านั้น)' });
    }
    const { repair_cost, cost_note } = req.body;
    const repairId = req.params.id;

    if (repair_cost === undefined || repair_cost === null) {
        return res.status(400).json({ success: false, message: 'กรุณาระบุค่าใช้จ่าย' });
    }
    if (isNaN(parseFloat(repair_cost)) || parseFloat(repair_cost) < 0) {
        return res.status(400).json({ success: false, message: 'ค่าใช้จ่ายต้องเป็นตัวเลขที่มากกว่า 0' });
    }

    try {
        const [rows] = await db.query('SELECT id FROM repair_requests WHERE id = ?', [repairId]);
        if (!rows.length) {
            return res.status(404).json({ success: false, message: 'ไม่พบคำแจ้งซ่อม' });
        }
        await db.query(
            'UPDATE repair_requests SET repair_cost = ?, cost_note = ? WHERE id = ?',
            [parseFloat(repair_cost), cost_note || null, repairId]
        );
        res.json({
            success: true,
            message: 'บันทึกค่าใช้จ่ายสำเร็จ',
            repair_cost: parseFloat(repair_cost),
            cost_note: cost_note || ''
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด: ' + err.message });
    }
});

// GET /api/repairs/:id/cost
app.get('/api/repairs/:id/cost', authMiddleware, async (req, res) => {
    const repairId = req.params.id;
    try {
        const [rows] = await db.query(
            'SELECT repair_cost, cost_note FROM repair_requests WHERE id = ?',
            [repairId]
        );
        if (!rows.length) {
            return res.status(404).json({ success: false, message: 'ไม่พบคำแจ้งซ่อม' });
        }
        res.json({
            success: true,
            data: rows[0] || { repair_cost: 0, cost_note: '' }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// GET /api/reports/cost-summary
app.get('/api/reports/cost-summary', authMiddleware, adminMiddleware, async (req, res) => {
    const { year, month } = req.query;
    let sql = `SELECT 
                SUM(repair_cost) as total_cost,
                COUNT(*) as total_repairs,
                AVG(repair_cost) as avg_cost,
                MONTH(requested_at) as month,
                YEAR(requested_at) as year
               FROM repair_requests 
               WHERE repair_cost > 0`;
    const params = [];
    if (year) { sql += ' AND YEAR(requested_at) = ?'; params.push(year); }
    if (month) { sql += ' AND MONTH(requested_at) = ?'; params.push(month); }
    sql += ' GROUP BY YEAR(requested_at), MONTH(requested_at) ORDER BY year DESC, month DESC';
    try {
        const [rows] = await db.query(sql, params);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =============================================
// Route: สร้าง Excel เอกสารขอซ่อม
// =============================================
app.get('/api/export-repair-doc/:id', authMiddleware, async (req, res) => {
    try {
        const repairId = req.params.id;
        const [rows] = await db.query(
            `SELECT rr.*, e.equipment_code, e.equipment_name, et.name as type_name 
             FROM repair_requests rr
             JOIN equipment e ON rr.equipment_id = e.id
             JOIN equipment_types et ON e.equipment_type_id = et.id
             WHERE rr.id = ?`,
            [repairId]
        );
        if (!rows.length) return res.status(404).json({ success: false, message: 'ไม่พบข้อมูล' });
        const r = rows[0];
        const now = new Date();
        const thaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
        const dateStr = `${now.getDate()} ${thaiMonths[now.getMonth()]} ${now.getFullYear()+543}`;

        function numberToThaiText(num) {
            if (num === 0 || isNaN(num) || num === '') return 'ศูนย์บาทถ้วน';
            const digits = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
            const units = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];
            let text = '';
            let str = String(Math.round(parseFloat(num)));
            let len = str.length;
            for (let i = 0; i < len; i++) {
                const digit = parseInt(str[i]);
                const pos = len - i - 1;
                if (digit > 0) {
                    if (pos === 1 && digit === 1) text += 'สิบ';
                    else if (pos === 1 && digit === 2) text += 'ยี่สิบ';
                    else if (pos === 0 && digit === 1 && len > 1) text += 'เอ็ด';
                    else text += digits[digit] + units[pos];
                }
            }
            return text + 'บาทถ้วน';
        }

        const partsList = r.equipment_parts ? r.equipment_parts.split(',').map(p => p.trim()) : ['ไม่มีรายการ'];
        const excelData = [];
        excelData.push(['', '', '', '', '', '', '', 'บันทึกข้อความ', '', '', '', '', '', '', '', '']);
        excelData.push([]);
        excelData.push(['', 'ส่วนราชการ', '', '', '', '', '', 'โรงพยาบาลเหนือคลอง อำเภอเหนือคลอง จังหวัดกระบี่ โทร.0-7569-1801', '', '', '', '', '', '', '', '']);
        excelData.push(['', 'ที่', 'กบ 0033.3/7/', '', '', '', '', 'วันที่', '', dateStr, '', '', '', '', 'พ.ศ.', '']);
        excelData.push(['', 'เรื่อง', '', 'ขออนุมัติซ่อมบำรุงวัสดุ/ครุภัณฑ์ ประเภท', '', '', '', '', '', r.type_name || 'ครุภัณฑ์คอมพิวเตอร์', '', '', '', '', '', '']);
        excelData.push(['', 'เรียน', '', 'ผู้อำนวยการโรงพยาบาลเหนือคลอง', '', '', '', '', '', '', '', '', '', '', '', '']);
        excelData.push([]);
        excelData.push(['', '', '', 'ด้วย งาน/ฝ่าย', '', '', '', '', r.location_department || 'กลุ่มงานสุขภาพดิจิทัล', '', '', '', '', '', 'มีความประสงค์ซ่อมบำรุงดังนี้', '']);
        for (let i = 0; i < 5; i++) {
            const partName = i < partsList.length ? partsList[i] : '';
            excelData.push(['', `${i+1}.`, partName || '', '', '', '', '', '', '', '', '', '', '', '', 'จำนวน', '1']);
        }
        const cost = parseFloat(r.repair_cost) || 0;
        excelData.push(['', 'รวมเงินประมาณ', '', '', '', '', '', '', cost.toFixed(2), 'บาท', '', '(', numberToThaiText(cost), '', '', ')']);
        excelData.push(['', '', '', '', '', '', '', 'เสนอชื่อผู้ตรวจรับพัสดุดังนี้', '', '', '', '', '', '', '', '']);
        excelData.push(['', '1.', '', '', '', '', '', '', '', '', '', '', 'ประธานกรรมการ/จนท.ตรวจรับ', '', '', '']);
        excelData.push(['', '2.', '', '', '', '', '', '', '', '', '', '', 'กรรมการ', '', '', '']);
        excelData.push(['', '3.', '', '', '', '', '', '', '', '', '', '', 'กรรมการ', '', '', '']);
        excelData.push([]);
        excelData.push(['', '', '', 'จึงเรียนมาเพื่อโปรดทราบและพิจารณาอนุมัติ', '', '', '', '', '', '', '', '', '', '', '', '']);
        excelData.push([]);
        excelData.push(['', '', '', '', '', '', '', 'ลงชื่อ', '', '', '', '', 'ผู้ส่งซ่อม', '', '', '']);
        excelData.push(['', '', '', '', '', '', '', '', '(', r.requester_name || '', ')', '', '', '', '', '']);
        excelData.push([]);
        excelData.push(['', '', '', '', '', '', 'บันทึกของหน่วยซ่อมบำรุง', '', '', '', '', '', '', '', '', '']);
        excelData.push(['', '', 'ซ่อมเองได้', '', '', '', '', '', '', 'ไม่สามารถซ่อมเองได้ต้องส่งซ่อม', '', '', '', '', 'ใช้เวลาประมาณ', '______ วัน']);
        excelData.push([]);
        excelData.push([]);
        excelData.push(['', '', '', '', '', '', '', '', '', '', '', '', 'ช่างซ่อมบำรุง', '', '', '']);
        excelData.push(['ลงชื่อ', '', '', '', '', '', '', '', '', '', '', '', ')', '', '', '']);
        excelData.push(['', '', 'วันที่', '', '', '', '', '', 'วันที่', '', '', '', '', 'วันที่', '', '']);
        excelData.push(['ลงชื่อ', '', '', '', '', '', '', '', '', '', '', 'หัวหน้างานซ่อมบำรุง', '', '', '', '']);
        excelData.push(['', '', 'วันที่', '', '', '', '', '', 'วันที่', '', '', '', '', 'วันที่', '', '']);
        excelData.push(['ลงชื่อ', '', '', '', '', '', '', '', '', '', '', 'เจ้าของงาน', '', '', '', '']);
        excelData.push([]);
        excelData.push(['', '', '', 'เสนอ ผู้อำนวยการโรงพยาบาลเหนือคลอง', '', '', '', '', '', '', '', '', 'อนุมัติ', '', 'ไม่อนุมัติ', '']);
        excelData.push(['', '', 'เพื่อโปรดทราบ และเห็นควรอนุมัติ', '', '', '', '', '', '', '', '', '', '', '', '', '']);
        excelData.push(['', '', 'ลงชื่อ', '', '', '', '', '', '', '', '', '', 'ลงชื่อ', '', '', '']);

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(excelData);
        ws['!cols'] = [
            { wch: 4 }, { wch: 12 }, { wch: 15 }, { wch: 20 }, { wch: 4 },
            { wch: 4 }, { wch: 4 }, { wch: 15 }, { wch: 4 }, { wch: 20 },
            { wch: 4 }, { wch: 4 }, { wch: 20 }, { wch: 4 }, { wch: 15 }, { wch: 10 }
        ];
        XLSX.utils.book_append_sheet(wb, ws, '68_ขอซ่อม');
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=ขอซ่อม_${r.ticket_number}.xlsx`);
        res.send(buffer);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =============================================
// Proxy: ส่งข้อมูลไป Google Apps Script
// =============================================
app.post('/api/proxy-gas', authMiddleware, async (req, res) => {
    const { gasUrl, payload } = req.body;
    if (!gasUrl || !payload) return res.status(400).json({ success: false, message: 'กรุณาระบุ gasUrl และ payload' });
    if (!gasUrl.startsWith('https://script.google.com/macros/s/')) {
        return res.status(400).json({ success: false, message: 'URL ไม่ถูกต้อง' });
    }
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const response = await fetch(gasUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        const text = await response.text();
        let data;
        try { data = JSON.parse(text); } catch { data = { raw: text }; }
        if (response.ok) res.json({ success: true, data });
        else res.status(response.status).json({ success: false, message: 'GAS returned error', data });
    } catch (err) {
        res.status(502).json({ success: false, message: 'Proxy error: ' + err.message });
    }
});

// =============================================
// Serve Frontend
// =============================================
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ success: false, message: 'API endpoint not found' });
    }
    const filePath = path.join(__dirname, req.path);
    if (fs.existsSync(filePath) && path.extname(filePath)) {
        return res.sendFile(filePath);
    }
    res.sendFile(path.join(__dirname, 'index.html'));
});

// =============================================
// Start Server
// =============================================
connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Server รันที่ http://localhost:${PORT}`);
        console.log(`📊 Admin Dashboard: http://localhost:${PORT}/dashboard.html`);
    });
});