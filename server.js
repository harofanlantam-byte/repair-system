// =============================================
// ระบบเว็บแจ้งซ่อม - Backend Server
// =============================================
require('dotenv').config();
const express = require('express');
const http = require('http');
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
const { Server } = require('socket.io');

const emailService = require('./services/emailService');
const emailUtils = require('./utils/emailUtils');
const lineService = require('./services/lineService');
const telegramBot = require('./services/telegramBotService');
const QRCode = require('qrcode');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
// 🔒 SECURITY: ห้าม fallback JWT_SECRET — ต้องมีค่าใน .env เท่านั้น
if (!process.env.JWT_SECRET) { console.error('❌ FATAL: ต้องตั้งค่า JWT_SECRET ใน .env'); process.exit(1); }
const JWT_SECRET = process.env.JWT_SECRET;

app.use(helmet({ contentSecurityPolicy: false }));
// 🔒 SECURITY: ระบุ origin จริงแทน wildcard '*'
app.use(cors({ origin: process.env.APP_URL || 'http://localhost:3000', credentials: true }));

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, max: 10,
    message: { success: false, message: 'ลองเข้าสู่ระบบบ่อยเกินไป กรุณารอ 15 นาที' }
});
app.use('/api/auth/login', loginLimiter);

// 🆕 Rate limit สำหรับสมัครสมาชิก — กันสแปม/บอทสร้างบัญชีจำนวนมาก
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, max: 5,
    message: { success: false, message: 'สมัครสมาชิกบ่อยเกินไป กรุณารอ 1 ชั่วโมง' }
});
app.use('/api/auth/register', registerLimiter);

// เก็บ raw body ไว้ด้วย เพื่อใช้ตรวจสอบ LINE signature
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'frontend')));

if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads');
if (!fs.existsSync('./backups')) fs.mkdirSync('./backups');
if (!fs.existsSync('./logs')) fs.mkdirSync('./logs');

const dbConfig = { host: process.env.DB_HOST || 'localhost', user: process.env.DB_USER || 'root', password: process.env.DB_PASS || '', database: process.env.DB_NAME || 'repair_system', charset: 'utf8mb4', connectTimeout: 10000 };
let db;

async function connectDB() {
    try {
        console.log('⏳ กำลังเชื่อมต่อฐานข้อมูล MySQL...');
        db = mysql.createPool({ ...dbConfig, waitForConnections: true, connectionLimit: 10, queueLimit: 0, enableKeepAlive: true, keepAliveInitialDelay: 0 });
        // Test connection
        const test = await db.query('SELECT 1');
        console.log('✅ เชื่อมต่อฐานข้อมูล MySQL สำเร็จ (Pool mode)');
    } catch (err) { console.error('❌ ไม่สามารถเชื่อมต่อฐานข้อมูล:', err.message); process.exit(1); }
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, './uploads/'),
    filename: (req, file, cb) => { const unique = Date.now() + '-' + Math.round(Math.random() * 1e9); cb(null, unique + path.extname(file.originalname)); }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => { const allowed = /jpeg|jpg|png|gif|webp/; const ext = allowed.test(path.extname(file.originalname).toLowerCase()); const mime = allowed.test(file.mimetype); if (ext && mime) cb(null, true); else cb(new Error('อนุญาตเฉพาะไฟล์รูปภาพเท่านั้น')); } });

// 🔒 Helper: บันทึก audit log
function auditLog(userId, username, action, details, ip) {
    setImmediate(async () => {
        try { await db.query('INSERT INTO audit_logs (user_id, username, action, details, ip_address) VALUES (?,?,?,?,?)', [userId||null, username||null, action, details||null, ip||null]); }
        catch (e) { console.error('❌ [AuditLog] insert error:', e.message); }
    });
}

function authMiddleware(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'กรุณาเข้าสู่ระบบ' });
    try { req.user = jwt.verify(token, JWT_SECRET); next(); }
    catch { res.status(401).json({ success: false, message: 'Token ไม่ถูกต้องหรือหมดอายุ' }); }
}

function adminMiddleware(req, res, next) {
    if (!req.user || req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึง (Admin เท่านั้น)' });
    next();
}

const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

// 🔒 SECURITY: WebSocket auth ตรวจสอบ status='active' ด้วย
io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('กรุณาเข้าสู่ระบบ'));
    try {
        const user = jwt.verify(token, JWT_SECRET);
        if (!db) { socket.user = user; next(); return; }
        const [rows] = await db.query("SELECT id FROM users WHERE id=? AND status='active'", [user.id]);
        if (!rows.length) return next(new Error('บัญชีถูกปิดใช้งานหรือไม่พบผู้ใช้'));
        socket.user = user;
        next();
    } catch (err) { next(new Error('Token ไม่ถูกต้องหรือหมดอายุ')); }
});

const userSockets = new Map();

io.on('connection', (socket) => {
    const user = socket.user;
    console.log(`🔌 [Socket.IO] User connected: ${user.full_name} (${user.role}) [${socket.id}]`);
    userSockets.set(user.id, socket.id);
    if (user.role === 'admin') socket.join('admin-room');
    socket.join(`user-${user.id}`);

    socket.on('subscribe', (room) => {
        if (room === 'admin-room' && user.role !== 'admin') { socket.emit('error', { message: 'ไม่มีสิทธิ์เข้าถึง admin room' }); return; }
        socket.join(room);
    });
    socket.on('unsubscribe', (room) => { socket.leave(room); });

    socket.on('new-repair', (data) => {
        io.to('admin-room').emit('new-notification', { type: 'new-repair', title: 'มีคำแจ้งซ่อมใหม่', message: `คำแจ้งซ่อม ${data.ticket_number} โดย ${data.requester_name}`, data: data, timestamp: new Date().toISOString() });
        setImmediate(async () => {
            try {
                const [adminUsers] = await db.query("SELECT id FROM users WHERE role = 'admin' AND status = 'active'");
                for (const admin of adminUsers) await db.query("INSERT INTO notifications (user_id, title, message, type, related_type, related_id) VALUES (?, ?, ?, 'info', 'repair', ?)", [admin.id, 'มีคำแจ้งซ่อมใหม่', `คำแจ้งซ่อม ${data.ticket_number} โดย ${data.requester_name}`, data.repair_id || null]);
            } catch (err) { console.error('❌ [Socket.IO] Save notification error:', err.message); }
        });
    });

    socket.on('status-change', (data) => {
        io.to('admin-room').emit('repair-updated', { type: 'status-change', title: 'อัปเดตสถานะคำแจ้งซ่อม', message: `คำแจ้งซ่อม ${data.ticket_number} สถานะ: ${data.old_status} → ${data.new_status}`, data: data, timestamp: new Date().toISOString() });
        if (data.user_id) {
            io.to(`user-${data.user_id}`).emit('repair-updated', { type: 'status-change', title: 'สถานะคำแจ้งซ่อมของคุณถูกอัปเดต', message: `คำแจ้งซ่อม ${data.ticket_number} สถานะ: ${data.old_status} → ${data.new_status}`, data: data, timestamp: new Date().toISOString() });
            setImmediate(async () => {
                try { await db.query("INSERT INTO notifications (user_id, title, message, type, related_type, related_id) VALUES (?, ?, ?, 'warning', 'repair', ?)", [data.user_id, 'สถานะคำแจ้งซ่อมถูกอัปเดต', `คำแจ้งซ่อม ${data.ticket_number} สถานะ: ${data.old_status} → ${data.new_status}`, data.repair_id || null]); }
                catch (err) { console.error('❌ [Socket.IO] Save notification error:', err.message); }
            });
        }
    });
    socket.on('disconnect', () => { console.log(`🔌 [Socket.IO] User disconnected: ${user.full_name} [${socket.id}]`); userSockets.delete(user.id); });
});

function emitSocketEvent(event, room, payload) { try { io.to(room).emit(event, payload); } catch (err) { console.error('❌ [Socket.IO] Emit error:', err.message); } }
function generateTicketNumber() { const now = new Date(); const y = now.getFullYear(); const m = String(now.getMonth() + 1).padStart(2, '0'); const d = String(now.getDate()).padStart(2, '0'); return `REP-${y}${m}${d}-${Math.floor(Math.random() * 9000) + 1000}`; }

// =============================================
// AUTH
// =============================================
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE username=?', [username]);
        if (!rows.length) return res.status(401).json({ success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
        const user = rows[0];
        if (user.status !== 'active') return res.status(403).json({ success: false, message: 'บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ' });
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
        const token = jwt.sign({ id: user.id, username: user.username, role: user.role, full_name: user.full_name }, JWT_SECRET, { expiresIn: '8h' });
        const ip = req.ip || req.connection?.remoteAddress || null;
        auditLog(user.id, user.username, 'login', `User ${user.username} (${user.role}) logged in`, ip);
        res.json({ success: true, token, user: { id: user.id, username: user.username, role: user.role, full_name: user.full_name } });
    } catch (err) { console.error('❌ POST /api/auth/login:', err.message); res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' }); }
});

// =============================================
// 🆕 สมัครสมาชิกเอง (Public self-registration)
// บังคับกรอก username, password, full_name, email — เป็นข้อมูลพื้นฐานที่ต้องมี
// บัญชีที่สมัครใหม่ status='active' ทันที (ตกลงกันแล้วว่าไม่ต้องรอ admin อนุมัติ)
// =============================================
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
app.post('/api/auth/register', async (req, res) => {
    try {
        let { username, password, full_name, email, phone } = req.body;
        username = (username || '').trim();
        full_name = (full_name || '').trim();
        email = (email || '').trim().toLowerCase();
        phone = (phone || '').trim();

        // ---------- Validation ฝั่ง server (ห้ามพึ่งฝั่ง client อย่างเดียว) ----------
        if (!username || !password || !full_name || !email) {
            return res.status(400).json({ success: false, message: 'กรุณากรอก ชื่อผู้ใช้, รหัสผ่าน, ชื่อ-นามสกุล และอีเมล ให้ครบ' });
        }
        if (username.length < 3 || username.length > 100) {
            return res.status(400).json({ success: false, message: 'ชื่อผู้ใช้ต้องมีความยาว 3-100 ตัวอักษร' });
        }
        if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
            return res.status(400).json({ success: false, message: 'ชื่อผู้ใช้ใช้ได้เฉพาะตัวอักษรอังกฤษ ตัวเลข และ . _ -' });
        }
        if (password.length < 8) {
            return res.status(400).json({ success: false, message: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' });
        }
        if (!EMAIL_RE.test(email)) {
            return res.status(400).json({ success: false, message: 'รูปแบบอีเมลไม่ถูกต้อง' });
        }

        // ---------- ตรวจสอบ username/email ซ้ำ ----------
        const [existing] = await db.query('SELECT id FROM users WHERE username=? OR email=?', [username, email]);
        if (existing.length) {
            return res.status(409).json({ success: false, message: 'ชื่อผู้ใช้หรืออีเมลนี้ถูกใช้งานแล้ว' });
        }

        const hashed = await bcrypt.hash(password, 10);
        const [result] = await db.query(
            'INSERT INTO users (username, password, full_name, email, phone, role, status) VALUES (?,?,?,?,?,?,?)',
            [username, hashed, full_name, email, phone || null, 'user', 'active']
        );

        const newUser = { id: result.insertId, username, role: 'user', full_name };
        const token = jwt.sign(newUser, JWT_SECRET, { expiresIn: '8h' });
        const ip = req.ip || req.connection?.remoteAddress || null;
        auditLog(result.insertId, username, 'register', `New self-registered user: ${username} (${email})`, ip);

        res.json({ success: true, token, user: newUser });
    } catch (err) {
        console.error('❌ POST /api/auth/register:', err.message);
        // ป้องกัน race condition: ถ้า INSERT ชนกับ UNIQUE constraint พอดี (สมัครพร้อมกัน 2 request)
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'ชื่อผู้ใช้หรืออีเมลนี้ถูกใช้งานแล้ว' });
        res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' });
    }
});

// PROFILE
app.get('/api/profile', authMiddleware, async (req, res) => {
    try { const [rows] = await db.query('SELECT id, username, full_name, role, email, phone, avatar, telegram_chat_id, line_user_id, created_at FROM users WHERE id=?', [req.user.id]); res.json({ success: true, data: rows[0] || null }); }
    catch (err) { console.error('❌ GET /api/profile:', err.message); res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' }); }
});
app.put('/api/profile', authMiddleware, async (req, res) => {
    const { full_name, email, phone } = req.body;
    if (!full_name) return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อ-นามสกุล' });
    try { await db.query('UPDATE users SET full_name=?, email=?, phone=?, updated_at=NOW() WHERE id=?', [full_name, email||null, phone||null, req.user.id]); auditLog(req.user.id, req.user.username, 'update_profile', 'Updated profile info', req.ip); res.json({ success: true, message: 'อัพเดตโปรไฟล์สำเร็จ' }); }
    catch (err) { console.error('❌ PUT /api/profile:', err.message); res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' }); }
});
app.post('/api/profile/change-password', authMiddleware, async (req, res) => {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    if (new_password.length < 6) return res.status(400).json({ success: false, message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' });
    try {
        const [u] = await db.query('SELECT password FROM users WHERE id=?', [req.user.id]);
        if (!u.length) return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้' });
        if (!await bcrypt.compare(current_password, u[0].password)) return res.status(400).json({ success: false, message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
        await db.query('UPDATE users SET password=?, updated_at=NOW() WHERE id=?', [await bcrypt.hash(new_password,10), req.user.id]);
        auditLog(req.user.id, req.user.username, 'change_password', 'Password changed', req.ip);
        res.json({ success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
    } catch (err) { console.error('❌ POST /api/profile/change-password:', err.message); res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' }); }
});

// EQUIPMENT TYPES
app.get('/api/equipment-types', authMiddleware, async (req, res) => {
    try { const [types] = await db.query('SELECT * FROM equipment_types ORDER BY name'); for (let t of types) { const [parts] = await db.query('SELECT * FROM equipment_parts WHERE equipment_type_id=?', [t.id]); t.parts = parts; } res.json({ success: true, data: types }); }
    catch (err) { console.error('❌ GET /api/equipment-types:', err.message); res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' }); }
});

// EQUIPMENT
app.get('/api/equipment/code/:code', authMiddleware, async (req, res) => {
    try {
        const [rows] = await db.query("SELECT e.*, et.name as type_name, et.has_parts FROM equipment e JOIN equipment_types et ON e.equipment_type_id=et.id WHERE e.equipment_code=? AND e.status='active'", [req.params.code]);
        if (!rows.length) return res.status(404).json({ success: false, message: 'ไม่พบครุภัณฑ์' });
        const eq = rows[0];
        if (eq.has_parts) { const [parts] = await db.query('SELECT * FROM equipment_parts WHERE equipment_type_id=?', [eq.equipment_type_id]); eq.parts = parts; }
        res.json({ success: true, data: eq });
    } catch (err) { console.error('❌ GET /api/equipment/code:', err.message); res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' }); }
});

app.get('/api/equipment', authMiddleware, async (req, res) => {
    const { type_id, search } = req.query;
    let sql = "SELECT e.*, et.name as type_name FROM equipment e JOIN equipment_types et ON e.equipment_type_id=et.id WHERE e.status='active'";
    const params = [];
    if (type_id) { sql += ' AND e.equipment_type_id=?'; params.push(type_id); }
    if (search) { sql += ' AND (e.equipment_code LIKE ? OR e.equipment_name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    sql += ' ORDER BY e.created_at DESC';
    try { const [rows] = await db.query(sql, params); res.json({ success: true, data: rows }); }
    catch (err) { console.error('❌ GET /api/equipment:', err.message); res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' }); }
});

app.post('/api/equipment', authMiddleware, adminMiddleware, async (req, res) => {
    const { equipment_code, equipment_name, equipment_type_id, location_building, location_department, location_room } = req.body;
    if (!equipment_code || !equipment_name || !equipment_type_id) return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลที่จำเป็น' });
    try {
        const [existing] = await db.query('SELECT id FROM equipment WHERE equipment_code=?', [equipment_code]);
        if (existing.length) return res.status(409).json({ success: false, message: 'รหัสครุภัณฑ์นี้มีอยู่แล้ว' });
        await db.query('INSERT INTO equipment (equipment_code,equipment_name,equipment_type_id,location_building,location_department,location_room) VALUES (?,?,?,?,?,?)', [equipment_code, equipment_name, equipment_type_id, location_building, location_department, location_room]);
        auditLog(req.user.id, req.user.username, 'create_equipment', `Added equipment: ${equipment_code}`, req.ip);
        res.json({ success: true, message: 'เพิ่มครุภัณฑ์สำเร็จ' });
    } catch (err) { console.error('❌ POST /api/equipment:', err.message); res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' }); }
});

app.put('/api/equipment/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try { await db.query('UPDATE equipment SET equipment_code=?,equipment_name=?,equipment_type_id=?,location_building=?,location_department=?,location_room=? WHERE id=?', [req.body.equipment_code, req.body.equipment_name, req.body.equipment_type_id, req.body.location_building, req.body.location_department, req.body.location_room, req.params.id]); auditLog(req.user.id, req.user.username, 'update_equipment', `Updated equipment id=${req.params.id}`, req.ip); res.json({ success: true, message: 'อัพเดตครุภัณฑ์สำเร็จ' }); }
    catch (err) { console.error('❌ PUT /api/equipment:', err.message); res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' }); }
});

// QR Code route MUST be before /api/equipment/:id
app.get('/api/equipment/:id/qrcode', authMiddleware, async (req, res) => {
    try {
        const eqId = req.params.id;
        const [rows] = await db.query('SELECT equipment_code, equipment_name FROM equipment WHERE id=?', [eqId]);
        if (!rows.length) return res.status(404).json({ success: false, message: 'ไม่พบครุภัณฑ์' });
        const svg = await QRCode.toString(`${process.env.SYSTEM_URL||'http://localhost:3000'}/equipment-detail.html?id=${eqId}`, { type:'svg', width:256, margin:2, color:{ dark:'#1a2744', light:'#ffffff' } });
        res.setHeader('Content-Type','image/svg+xml'); res.setHeader('Cache-Control','public, max-age=86400'); res.send(svg);
    } catch (err) { console.error('❌ GET /api/equipment/:id/qrcode:', err.message); res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' }); }
});

app.get('/api/equipment/:id', authMiddleware, async (req, res) => {
    try { const [rows] = await db.query('SELECT e.*, et.name as type_name, et.has_parts FROM equipment e JOIN equipment_types et ON e.equipment_type_id=et.id WHERE e.id=?', [req.params.id]); if (!rows.length) return res.status(404).json({ success: false, message: 'ไม่พบครุภัณฑ์' }); res.json({ success: true, data: rows[0] }); }
    catch (err) { console.error('❌ GET /api/equipment/:id:', err.message); res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' }); }
});

app.delete('/api/equipment/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try { await db.query("UPDATE equipment SET status='inactive' WHERE id=?", [req.params.id]); auditLog(req.user.id, req.user.username, 'delete_equipment', `Soft-deleted equipment id=${req.params.id}`, req.ip); res.json({ success: true, message: 'ลบครุภัณฑ์สำเร็จ' }); }
    catch (err) { console.error('❌ DELETE /api/equipment:', err.message); res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' }); }
});

// REPAIR REQUESTS
app.post('/api/repairs', authMiddleware, upload.single('image'), async (req, res) => {
    const { equipment_id, equipment_parts, problem_description, requester_name, location_building, location_department, location_room, priority } = req.body;
    if (!equipment_id || !problem_description || !requester_name) return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลที่จำเป็น' });
    try {
        const ticket = generateTicketNumber();
        const userId = req.user?.id || null;
        await db.query("INSERT INTO repair_requests (ticket_number,equipment_id,equipment_parts,problem_description,requester_name,user_id,location_building,location_department,location_room,priority,image_path,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,'pending')", [ticket, equipment_id, equipment_parts||null, problem_description, requester_name, userId, location_building, location_department, location_room, priority||'normal', req.file?`/uploads/${req.file.filename}`:null]);
        const [newReq] = await db.query('SELECT id FROM repair_requests WHERE ticket_number=?', [ticket]);
        await db.query('INSERT INTO status_history (repair_request_id,old_status,new_status,note) VALUES (?,?,?,?)', [newReq[0].id, null, 'pending', 'สร้างคำแจ้งซ่อมใหม่']);
        auditLog(userId, requester_name, 'create_repair', `Created repair ${ticket}`, req.ip);
        try { sendNewRepairNotification(db, ticket, equipment_id, requester_name, location_building, location_department, location_room, priority, problem_description); } catch {}
        emitSocketEvent('new-notification', 'admin-room', { type: 'new-repair', title: 'มีคำแจ้งซ่อมใหม่', message: `คำแจ้งซ่อม ${ticket} โดย ${requester_name}`, data: { ticket_number: ticket, repair_id: newReq[0].id, equipment_id, requester_name, priority: priority||'normal', problem_description, location_building, location_department, location_room }, timestamp: new Date().toISOString() });
        res.json({ success: true, message: 'บันทึกคำแจ้งซ่อมสำเร็จ', ticket_number: ticket });
    } catch (err) { console.error('❌ POST /api/repairs:', err.message); res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' }); }
});

app.get('/api/repairs', authMiddleware, async (req, res) => {
    const { status, priority, search, date_from, date_to, limit=50, offset=0 } = req.query;
    let sql = 'SELECT rr.*, e.equipment_code, e.equipment_name, et.name as type_name FROM repair_requests rr JOIN equipment e ON rr.equipment_id=e.id JOIN equipment_types et ON e.equipment_type_id=et.id WHERE 1=1';
    const params = [];
    if (status) { sql += ' AND rr.status=?'; params.push(status); }
    if (priority) { sql += ' AND rr.priority=?'; params.push(priority); }
    if (search) { sql += ' AND (rr.ticket_number LIKE ? OR rr.requester_name LIKE ? OR e.equipment_code LIKE ?)'; params.push(`%${search}%`,`%${search}%`,`%${search}%`); }
    if (date_from) { sql += ' AND rr.requested_at>=?'; params.push(date_from+' 00:00:00'); }
    if (date_to) { sql += ' AND rr.requested_at<=?'; params.push(date_to+' 23:59:59'); }
    // 🔒 Filter by role: user => own, manager => managed departments, admin => all
    if (req.user.role === 'user') { sql += ' AND rr.user_id=?'; params.push(req.user.id); }
    else if (req.user.role === 'manager') { sql += ' AND (rr.department_id IN (SELECT id FROM departments WHERE manager_id=?) OR rr.department_id IS NULL)'; params.push(req.user.id); }
    sql += ' ORDER BY rr.requested_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    try {
        const [rows] = await db.query(sql, params);
        let countSql = 'SELECT COUNT(*) as count FROM repair_requests WHERE 1=1'; const countParams = [];
        if (status) { countSql += ' AND status=?'; countParams.push(status); }
        if (search) { countSql += ' AND (ticket_number LIKE ? OR requester_name LIKE ?)'; countParams.push(`%${search}%`,`%${search}%`); }
        if (req.user.role === 'user') { countSql += ' AND user_id=?'; countParams.push(req.user.id); }
        else if (req.user.role === 'manager') { countSql += ' AND (department_id IN (SELECT id FROM departments WHERE manager_id=?) OR department_id IS NULL)'; countParams.push(req.user.id); }
        const [countRows] = await db.query(countSql, countParams);
        res.json({ success: true, data: rows, total: countRows[0]?.count||0 });
    } catch (err) { console.error('❌ GET /api/repairs:', err.message); res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' }); }
});

// 🔒 IDOR Protection: GET /api/repairs/:id
app.get('/api/repairs/:id', authMiddleware, async (req, res) => {
    try {
        const id = req.params.id;
        let sql, params;
        if (req.user.role === 'user') {
            sql = 'SELECT rr.*, e.equipment_code, e.equipment_name, et.name as type_name FROM repair_requests rr JOIN equipment e ON rr.equipment_id=e.id JOIN equipment_types et ON e.equipment_type_id=et.id WHERE rr.id=? AND rr.user_id=?';
            params = [id, req.user.id];
        } else if (req.user.role === 'manager') {
            sql = `SELECT rr.*, e.equipment_code, e.equipment_name, et.name as type_name FROM repair_requests rr JOIN equipment e ON rr.equipment_id=e.id JOIN equipment_types et ON e.equipment_type_id=et.id WHERE rr.id=? AND (rr.department_id IN (SELECT id FROM departments WHERE manager_id=?) OR rr.department_id IS NULL)`;
            params = [id, req.user.id];
        } else {
            sql = 'SELECT rr.*, e.equipment_code, e.equipment_name, et.name as type_name FROM repair_requests rr JOIN equipment e ON rr.equipment_id=e.id JOIN equipment_types et ON e.equipment_type_id=et.id WHERE rr.id=?';
            params = [id];
        }
        const [rows] = await db.query(sql, params);
        if (!rows.length) return res.status(404).json({ success: false, message: 'ไม่พบคำแจ้งซ่อม' });
        const [history] = await db.query('SELECT sh.*, u.full_name as admin_name FROM status_history sh LEFT JOIN users u ON sh.changed_by=u.id WHERE sh.repair_request_id=? ORDER BY sh.changed_at ASC', [id]);
        res.json({ success: true, data: rows[0], history });
    } catch (err) { console.error('❌ GET /api/repairs/:id:', err.message); res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' }); }
});

app.patch('/api/repairs/:id/status', authMiddleware, adminMiddleware, async (req, res) => {
    const { status, admin_note } = req.body;
    const repairId = req.params.id;
    if (!status) return res.status(400).json({ success: false, message: 'กรุณาระบุสถานะ' });
    try {
        const [rows] = await db.query('SELECT status,ticket_number FROM repair_requests WHERE id=?', [repairId]);
        if (!rows.length) return res.status(404).json({ success: false, message: 'ไม่พบคำแจ้งซ่อม' });
        const oldStatus = rows[0].status;
        const completedAt = status==='completed' ? new Date() : null;
        await db.query('UPDATE repair_requests SET status=?, admin_note=?, completed_at=?, updated_at=NOW() WHERE id=?', [status, admin_note||null, completedAt, repairId]);
        await db.query('INSERT INTO status_history (repair_request_id,old_status,new_status,changed_by,note) VALUES (?,?,?,?,?)', [repairId, oldStatus, status, req.user.id, admin_note||null]);
        auditLog(req.user.id, req.user.username, `status_change_${status}`, `Repair ${rows[0].ticket_number}: ${oldStatus} → ${status}`, req.ip);
        sendStatusChangeNotification(db, repairId, oldStatus, status, admin_note);
        res.json({ success: true, message: 'อัพเดตสถานะสำเร็จ' });
    } catch (err) { console.error('❌ PATCH /api/repairs/:id/status:', err.message); res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' }); }
});

app.delete('/api/repairs/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try { await db.query('DELETE FROM repair_requests WHERE id=?', [req.params.id]); auditLog(req.user.id, req.user.username, 'delete_repair', `Deleted repair id=${req.params.id}`, req.ip); res.json({ success: true, message: 'ลบคำแจ้งซ่อมสำเร็จ' }); }
    catch (err) { console.error('❌ DELETE /api/repairs:', err.message); res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' }); }
});

app.put('/api/repairs/:id/cost', authMiddleware, adminMiddleware, async (req, res) => {
    try { await db.query('UPDATE repair_requests SET repair_cost=?, cost_note=? WHERE id=?', [parseFloat(req.body.repair_cost), req.body.cost_note||null, req.params.id]); auditLog(req.user.id, req.user.username, 'update_repair_cost', `Set cost for repair id=${req.params.id}`, req.ip); res.json({ success: true, message: 'บันทึกค่าใช้จ่ายสำเร็จ' }); }
    catch (err) { console.error('❌ PUT /api/repairs/:id/cost:', err.message); res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' }); }
});

// 🔒 IDOR Protection: GET /api/export-repair-doc/:id
app.get('/api/export-repair-doc/:id', authMiddleware, async (req, res) => {
    try {
        const id = req.params.id;
        let sql, params;
        if (req.user.role === 'user') {
            sql = 'SELECT rr.*, e.equipment_code, e.equipment_name, et.name as type_name FROM repair_requests rr JOIN equipment e ON rr.equipment_id=e.id JOIN equipment_types et ON e.equipment_type_id=et.id WHERE rr.id=? AND rr.user_id=?';
            params = [id, req.user.id];
        } else if (req.user.role === 'manager') {
            sql = `SELECT rr.*, e.equipment_code, e.equipment_name, et.name as type_name FROM repair_requests rr JOIN equipment e ON rr.equipment_id=e.id JOIN equipment_types et ON e.equipment_type_id=et.id WHERE rr.id=? AND (rr.department_id IN (SELECT id FROM departments WHERE manager_id=?) OR rr.department_id IS NULL)`;
            params = [id, req.user.id];
        } else {
            sql = 'SELECT rr.*, e.equipment_code, e.equipment_name, et.name as type_name FROM repair_requests rr JOIN equipment e ON rr.equipment_id=e.id JOIN equipment_types et ON e.equipment_type_id=et.id WHERE rr.id=?';
            params = [id];
        }
        const [rows] = await db.query(sql, params);
        if (!rows.length) return res.status(404).json({ success: false, message: 'ไม่พบข้อมูล' });
        const r = rows[0];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['ระบบแจ้งซ่อมครุภัณฑ์'],['เลขที่: '+r.ticket_number],['ผู้แจ้ง: '+r.requester_name],['ครุภัณฑ์: '+(r.equipment_name||'')+' ('+(r.equipment_code||'')+')'],['ปัญหา: '+(r.problem_description||'')]]), 'ขอซ่อม');
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=ซ่อม_${r.ticket_number}.xlsx`);
        res.send(buffer);
    } catch (err) { console.error('❌ GET /api/export-repair-doc/:id:', err.message); res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' }); }
});

app.get('/api/dashboard/stats', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const { date_from, date_to } = req.query;
        let whereExtra = '';
        const whereParams = [];
        if (date_from) { whereExtra += ' AND requested_at >= ?'; whereParams.push(date_from + ' 00:00:00'); }
        if (date_to) { whereExtra += ' AND requested_at <= ?'; whereParams.push(date_to + ' 23:59:59'); }

        const [totalRows] = await db.query(`SELECT COUNT(*) as total FROM repair_requests WHERE 1=1${whereExtra}`, whereParams);
        const [pendingRows] = await db.query(`SELECT COUNT(*) as pending FROM repair_requests WHERE status='pending'${whereExtra}`, whereParams);
        const [inProgressRows] = await db.query(`SELECT COUNT(*) as in_progress FROM repair_requests WHERE status='in_progress'${whereExtra}`, whereParams);
        const [sentRepairRows] = await db.query(`SELECT COUNT(*) as sent_repair FROM repair_requests WHERE status='sent_repair'${whereExtra}`, whereParams);
        const [completedRows] = await db.query(`SELECT COUNT(*) as completed FROM repair_requests WHERE status='completed'${whereExtra}`, whereParams);
        const [urgentRows] = await db.query(`SELECT COUNT(*) as urgent FROM repair_requests WHERE priority='urgent' AND status!='completed'${whereExtra}`, whereParams);

        // 📊 byType — แยกตามประเภทครุภัณฑ์
        const [byType] = await db.query(`SELECT et.name, COUNT(rr.id) as count FROM repair_requests rr JOIN equipment e ON rr.equipment_id=e.id JOIN equipment_types et ON e.equipment_type_id=et.id WHERE 1=1${whereExtra} GROUP BY et.id, et.name ORDER BY count DESC`, whereParams);

        // 📅 monthly — แยกตามเดือน (6 เดือนล่าสุด)
        const [monthly] = await db.query(`SELECT DATE_FORMAT(requested_at, '%Y-%m') as month, COUNT(*) as count FROM repair_requests WHERE requested_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)${whereExtra} GROUP BY DATE_FORMAT(requested_at, '%Y-%m') ORDER BY month ASC`, whereParams);

        res.json({
            success: true,
            stats: {
                total: totalRows[0].total || 0,
                pending: pendingRows[0].pending || 0,
                in_progress: inProgressRows[0].in_progress || 0,
                sent_repair: sentRepairRows[0].sent_repair || 0,
                completed: completedRows[0].completed || 0,
                urgent: urgentRows[0].urgent || 0
            },
            byType,
            monthly
        });
    } catch (err) { console.error('❌ GET /api/dashboard/stats:', err.message); res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' }); }
});

app.get('/api/users', authMiddleware, adminMiddleware, async (req, res) => {
    try { const [rows]=await db.query('SELECT id,username,full_name,role,status,email,phone,created_at FROM users ORDER BY created_at DESC'); res.json({ success: true, data: rows }); }
    catch (err) { console.error('❌ GET /api/users:', err.message); res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' }); }
});
app.post('/api/users', authMiddleware, adminMiddleware, async (req, res) => {
    try { const hashed = await bcrypt.hash(req.body.password,10); const [result]=await db.query('INSERT INTO users (username,password,full_name,role,status) VALUES (?,?,?,?,?)', [req.body.username,hashed,req.body.full_name,req.body.role||'user','active']); auditLog(req.user.id, req.user.username, 'create_user', `Created user: ${req.body.username}`, req.ip); res.json({ success: true, message: 'เพิ่มผู้ใช้สำเร็จ' }); }
    catch (err) { console.error('❌ POST /api/users:', err.message); res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' }); }
});
app.put('/api/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try { await db.query('UPDATE users SET username=?,full_name=?,role=? WHERE id=?', [req.body.username,req.body.full_name,req.body.role||'user',req.params.id]); auditLog(req.user.id, req.user.username, 'update_user', `Updated user: ${req.body.username}`, req.ip); res.json({ success: true, message: 'อัพเดตผู้ใช้สำเร็จ' }); }
    catch (err) { console.error('❌ PUT /api/users/:id:', err.message); res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' }); }
});
app.patch('/api/users/:id/status', authMiddleware, adminMiddleware, async (req, res) => {
    try { await db.query('UPDATE users SET status=? WHERE id=?', [req.body.status, req.params.id]); auditLog(req.user.id, req.user.username, 'update_user_status', `Set user id=${req.params.id} status=${req.body.status}`, req.ip); res.json({ success: true, message: 'เปลี่ยนสถานะสำเร็จ' }); }
    catch (err) { console.error('❌ PATCH /api/users/:id/status:', err.message); res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' }); }
});

app.put('/api/profile/telegram', authMiddleware, async (req, res) => {
    try { await db.query('UPDATE users SET telegram_chat_id=? WHERE id=?', [req.body.telegram_chat_id, req.user.id]); res.json({ success: true, message: 'บันทึก Telegram Chat ID สำเร็จ' }); }
    catch (err) { console.error('❌ PUT /api/profile/telegram:', err.message); res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' }); }
});

// LINE API endpoints
app.post('/api/profile/line-link-code', authMiddleware, (req, res) => {
    const code = lineService.createLinkCode(req.user.id);
    res.json({ success: true, code, expires_in_seconds: 600, message: 'นำรหัสนี้ไปพิมพ์ในแชท LINE OA ของระบบ ภายใน 10 นาที' });
});
app.get('/api/profile/line-status', authMiddleware, async (req, res) => {
    try { const [rows] = await db.query('SELECT line_user_id FROM users WHERE id=?', [req.user.id]); res.json({ success: true, connected: !!rows[0]?.line_user_id }); }
    catch (err) { console.error('❌ GET /api/profile/line-status:', err.message); res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' }); }
});
app.delete('/api/profile/line', authMiddleware, async (req, res) => {
    try { await db.query('UPDATE users SET line_user_id=NULL WHERE id=?', [req.user.id]); res.json({ success: true, message: 'ยกเลิกการเชื่อมต่อ LINE สำเร็จ' }); }
    catch (err) { console.error('❌ DELETE /api/profile/line:', err.message); res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' }); }
});
app.post('/webhook/line', (req, res) => lineService.lineWebhook(req, res, db));

// 🆕 NEW FEATURES ROUTES (2026-07-14)
require('./routes-new-features')(app, db, authMiddleware, adminMiddleware, JWT_SECRET, QRCode, emailUtils, auditLog);

// =============================================
// EMAIL + LINE + TELEGRAM NOTIFICATION HELPERS
// =============================================
function sendNewRepairNotification(database, ticket, equipmentId, requesterName, building, department, room, priority, problemDescription) {
    setImmediate(async () => {
        try {
            const [eqRows] = await database.query('SELECT e.equipment_code, e.equipment_name, et.name as type_name FROM equipment e JOIN equipment_types et ON e.equipment_type_id=et.id WHERE e.id=?', [equipmentId]);
            const eq = eqRows[0] || {};
            const [adminRows] = await database.query("SELECT email FROM users WHERE role='admin' AND status='active' AND email IS NOT NULL AND email!=''");
            const adminEmails = adminRows.map(r=>r.email).filter(Boolean);
            if (adminEmails.length) {
                const locationFull = [building, department, room].filter(Boolean).join(' > ') || '-';
                emailService.sendNewRepairEmail({ adminEmails, ticketNumber: ticket, requesterName, equipmentName: eq.equipment_name||'-', equipmentCode: eq.equipment_code||'-', typeName: eq.type_name||'-', problemDescription, locationFull, priority, requestedAt: new Date().toLocaleString('th-TH') }).catch(()=>{});
                const flex = lineService.buildNewRepairFlex({ ticketNumber: ticket, requesterName, equipmentName: eq.equipment_name, equipmentCode: eq.equipment_code, locationFull, problemDescription });
                const [adminLineRows] = await database.query("SELECT line_user_id FROM users WHERE role='admin' AND status='active' AND line_user_id IS NOT NULL");
                for (const a of adminLineRows) lineService.sendFlexMessage(a.line_user_id, flex).catch(()=>{});
            }
        } catch (err) { console.error('❌ [Email Hook] New repair error:', err.message); }
    });
}

function sendStatusChangeNotification(database, repairId, oldStatus, newStatus, note) {
    setImmediate(async () => {
        try {
            const changedAt = new Date().toLocaleString('th-TH');
            const [rows] = await database.query('SELECT rr.ticket_number,rr.requester_name,rr.user_id,e.equipment_code,e.equipment_name FROM repair_requests rr JOIN equipment e ON rr.equipment_id=e.id WHERE rr.id=?', [repairId]);
            if (!rows.length) return;
            const req = rows[0];
            const userId = req.user_id || null;
            let requesterEmail = null, telegramChatId = null, lineUserId = null;
            if (userId) { const [u]=await database.query("SELECT email,telegram_chat_id,line_user_id FROM users WHERE id=? AND status='active'",[userId]); requesterEmail=u[0]?.email||null; telegramChatId=u[0]?.telegram_chat_id||null; lineUserId=u[0]?.line_user_id||null; }
            if (!userId||!requesterEmail) { const [u]=await database.query("SELECT id,email,telegram_chat_id,line_user_id FROM users WHERE full_name=? AND status='active' AND (email IS NOT NULL OR telegram_chat_id IS NOT NULL OR line_user_id IS NOT NULL)",[req.requester_name]); requesterEmail=requesterEmail||u[0]?.email||null; telegramChatId=telegramChatId||u[0]?.telegram_chat_id||null; lineUserId=lineUserId||u[0]?.line_user_id||null; }

            const newStText = emailUtils.STATUS_MAP[newStatus]?.text||newStatus;
            const oldStText = emailUtils.STATUS_MAP[oldStatus]?.text||oldStatus;

            // 📧 EMAIL
            if (requesterEmail) {
                if (newStatus==='completed') {
                    const [c]=await database.query('SELECT repair_cost FROM repair_requests WHERE id=?',[repairId]);
                    emailService.sendRepairCompletedEmail({ requesterEmail, requesterName:req.requester_name, ticketNumber:req.ticket_number, equipmentName:req.equipment_name, equipmentCode:req.equipment_code, completedAt:changedAt, note, repairCost:c[0]?.repair_cost||0, pickupLocation:'งานพัสดุ' }).catch(()=>{});
                } else { emailService.sendStatusChangeEmail({ requesterEmail, requesterName:req.requester_name, ticketNumber:req.ticket_number, equipmentName:req.equipment_name, equipmentCode:req.equipment_code, oldStatus, newStatus, changedAt, note }).catch(()=>{}); }
            }

            // 🤖 TELEGRAM
            if (newStatus==='completed' && telegramChatId) { telegramBot.sendTelegramToUser(telegramChatId,{ requester_name:req.requester_name, ticket_number:req.ticket_number, equipment_name:req.equipment_name, equipment_code:req.equipment_code, completed_at:changedAt, note }).catch(()=>{}); }

            // 🔹 LINE Push Notification
            if (lineUserId) {
                if (newStatus==='completed') { lineService.sendRepairCompleted(lineUserId, { ticket_number:req.ticket_number, equipment_name:req.equipment_name, equipment_code:req.equipment_code, note }).catch(()=>{}); }
                else {
                    const flex = lineService.buildStatusChangeFlex({ ticketNumber:req.ticket_number, equipmentName:req.equipment_name, equipmentCode:req.equipment_code, oldStatusText:oldStText, newStatusText:newStText, note });
                    lineService.sendFlexMessage(lineUserId, flex).catch(()=>{});
                }
            }

            // 🔔 WEBSOCKET
            const adminPayload = { type: newStatus==='completed'?'repair-completed':'status-change', title: newStatus==='completed'?'✅ แจ้งซ่อมสำเร็จ':'🔄 อัปเดตสถานะคำแจ้งซ่อม', message: newStatus==='completed'?`คำแจ้งซ่อม ${req.ticket_number} — ซ่อมสำเร็จแล้ว`:`คำแจ้งซ่อม ${req.ticket_number}: ${oldStText} → ${newStText}`, data:{ repair_id:repairId, ticket_number:req.ticket_number, requester_name:req.requester_name, equipment_name:req.equipment_name, equipment_code:req.equipment_code, old_status:oldStatus, new_status:newStatus, admin_note:note||null, completed:newStatus==='completed' }, timestamp:new Date().toISOString() };
            emitSocketEvent('repair-updated', 'admin-room', adminPayload);
            if (userId) {
                emitSocketEvent('repair-updated', `user-${userId}`, { ...adminPayload, title: newStatus==='completed'?'✅ ครุภัณฑ์ของคุณซ่อมเสร็จแล้ว!':'🔄 สถานะคำแจ้งซ่อมของคุณถูกอัปเดต', message: newStatus==='completed'?`ครุภัณฑ์ ${req.equipment_name} (${req.equipment_code}) ซ่อมเสร็จแล้ว กรุณาติดต่อรับคืนที่งานพัสดุ`:`คำแจ้งซ่อม ${req.ticket_number}: ${oldStText} → ${newStText}` });
                database.query("INSERT INTO notifications (user_id,title,message,type,related_type,related_id) VALUES (?,?,?,?,'repair',?)", [userId, newStatus==='completed'?'ซ่อมสำเร็จ! ครุภัณฑ์ของคุณพร้อมรับคืน':'สถานะคำแจ้งซ่อมถูกอัปเดต', newStatus==='completed'?`คำแจ้งซ่อม ${req.ticket_number} — ${req.equipment_name} ซ่อมเสร็จแล้ว กรุณาติดต่อรับคืนที่งานพัสดุ`:`คำแจ้งซ่อม ${req.ticket_number}: ${oldStText} → ${newStText}`, newStatus==='completed'?'success':'warning', repairId]).catch(()=>{});
            }
        } catch (err) { console.error('❌ [Noti Hook] Error:', err.message); }
    });
}

// =============================================
// SERVE FRONTEND
// =============================================
app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ success: false, message: 'API endpoint not found' });
    const filePath = path.join(__dirname, 'frontend', req.path);
    if (fs.existsSync(filePath) && path.extname(filePath)) return res.sendFile(filePath);
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// =============================================
// START SERVER
// =============================================
connectDB().then(async () => {
    emailUtils.verifyEmailConnection().catch(() => {});
    emailUtils.initScheduler(db);
    server.listen(PORT, () => {
        console.log(`🚀 Server รันที่ http://localhost:${PORT}`);
        console.log(`🔌 WebSocket: พร้อมรับการเชื่อมต่อ`);
        console.log(`📊 Admin Dashboard: http://localhost:${PORT}/dashboard.html`);
        console.log(`📧 Email: ${process.env.EMAIL_ENABLED!=='false'?'ENABLED':'DISABLED'} | SMTP: ${process.env.SMTP_HOST||'smtp.gmail.com'}:${process.env.SMTP_PORT||587}`);
    });
});