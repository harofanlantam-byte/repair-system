// =============================================
// New Features Routes (2026-07-14)
// =============================================
// 🔔 Real-Time Notification API
// ✅ Manager Approval Workflow
// 📱 QR Code Generator
// ⭐ Rating System
// =============================================

const jwt = require('jsonwebtoken');
const emailService = require('./services/emailService');

function managerMiddleware(req, res, next) {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'manager')) {
        return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึง (Admin/Manager เท่านั้น)' });
    }
    next();
}

function emitSocketEvent(io, event, room, payload) {
    try { io.to(room).emit(event, payload); } catch (e) { console.error('❌ [Socket] Emit error:', e.message); }
}

module.exports = function (app, db, authMiddleware, adminMiddleware, JWT_SECRET, QRCode, emailUtils, auditLog) {

    // Get io instance from app
    app.set('db', db);

    // =============================================
    // 🔔 NOTIFICATIONS API
    // =============================================

    // GET /api/notifications
    app.get('/api/notifications', authMiddleware, async (req, res) => {
        try {
            const userId = req.user.id;
            const limit = parseInt(req.query.limit) || 20;
            const [rows] = await db.query(
                'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
                [userId, limit]
            );
            const [unread] = await db.query(
                'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
                [userId]
            );
            res.json({ success: true, data: rows, unread_count: unread[0]?.count || 0 });
        } catch (err) {
            console.error('❌ GET /api/notifications:', err.message);
            res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' });
        }
    });

    // PATCH /api/notifications/:id/read
    app.patch('/api/notifications/:id/read', authMiddleware, async (req, res) => {
        try {
            await db.query('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
                [req.params.id, req.user.id]);
            res.json({ success: true, message: 'Marked as read' });
        } catch (err) {
            console.error('❌ PATCH /api/notifications/:id/read:', err.message);
            res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' });
        }
    });

    // PATCH /api/notifications/read-all
    app.patch('/api/notifications/read-all', authMiddleware, async (req, res) => {
        try {
            await db.query('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
                [req.user.id]);
            res.json({ success: true, message: 'All marked as read' });
        } catch (err) {
            console.error('❌ PATCH /api/notifications/read-all:', err.message);
            res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' });
        }
    });

    // =============================================
    // ✅ MANAGER APPROVAL API
    // =============================================

    // POST /api/repairs/:id/approve
    app.post('/api/repairs/:id/approve', authMiddleware, managerMiddleware, async (req, res) => {
        const repairId = req.params.id;
        const { note } = req.body;
        try {
            // 🔒 Manager ต้องกรองด้วย department_id ที่ตัวเองดูแล
            let checkSql, checkParams;
            if (req.user.role === 'manager') {
                checkSql = 'SELECT rr.id,rr.status,rr.ticket_number FROM repair_requests rr WHERE rr.id=? AND (rr.department_id IN (SELECT id FROM departments WHERE manager_id=?) OR rr.department_id IS NULL)';
                checkParams = [repairId, req.user.id];
            } else {
                checkSql = 'SELECT id,status,ticket_number FROM repair_requests WHERE id=?';
                checkParams = [repairId];
            }
            const [rows] = await db.query(checkSql, checkParams);
            if (!rows.length) return res.status(404).json({ success: false, message: 'ไม่พบคำแจ้งซ่อม หรือคุณไม่มีสิทธิ์ในแผนกนี้' });
            if (rows[0].status !== 'pending') {
                return res.status(400).json({ success: false, message: 'คำแจ้งซ่อมนี้ไม่อยู่ในสถานะรอดำเนินการ' });
            }

            const oldStatus = rows[0].status;
            const newStatus = 'in_progress';

            await db.query('UPDATE repair_requests SET status = ?, approved_by = ?, approved_at = NOW() WHERE id = ?', [newStatus, req.user.id, repairId]);
            await db.query(
                'INSERT INTO status_history (repair_request_id, old_status, new_status, changed_by, note) VALUES (?, ?, ?, ?, ?)',
                [repairId, oldStatus, newStatus, req.user.id, note || 'Manager อนุมัติคำขอ']
            );
            await db.query(
                'INSERT INTO approvals (repair_request_id, manager_id, status, note) VALUES (?, ?, ?, ?)',
                [repairId, req.user.id, 'approved', note || null]
            );
            if (typeof auditLog === 'function') auditLog(req.user.id, req.user.username, 'approve_repair', `Approved repair ${rows[0].ticket_number}`, req.ip);
            res.json({ success: true, message: 'อนุมัติคำขอสำเร็จ → ดำเนินการต่อ' });
        } catch (err) {
            console.error('❌ POST /api/repairs/:id/approve:', err.message);
            res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' });
        }
    });

    // POST /api/repairs/:id/reject
    app.post('/api/repairs/:id/reject', authMiddleware, managerMiddleware, async (req, res) => {
        const repairId = req.params.id;
        const { note } = req.body;
        if (!note) return res.status(400).json({ success: false, message: 'กรุณาระบุเหตุผลที่ปฏิเสธ' });

        try {
            // 🔒 Manager ต้องกรองด้วย department_id ที่ตัวเองดูแล
            let checkSql, checkParams;
            if (req.user.role === 'manager') {
                checkSql = 'SELECT rr.id,rr.status,rr.ticket_number FROM repair_requests rr WHERE rr.id=? AND (rr.department_id IN (SELECT id FROM departments WHERE manager_id=?) OR rr.department_id IS NULL)';
                checkParams = [repairId, req.user.id];
            } else {
                checkSql = 'SELECT id,status,ticket_number FROM repair_requests WHERE id=?';
                checkParams = [repairId];
            }
            const [rows] = await db.query(checkSql, checkParams);
            if (!rows.length) return res.status(404).json({ success: false, message: 'ไม่พบคำแจ้งซ่อม หรือคุณไม่มีสิทธิ์ในแผนกนี้' });
            if (rows[0].status !== 'pending') {
                return res.status(400).json({ success: false, message: 'คำแจ้งซ่อมนี้ไม่อยู่ในสถานะรอดำเนินการ' });
            }

            await db.query('UPDATE repair_requests SET status = \'pending\', admin_note = ? WHERE id = ?',
                [`ปฏิเสธโดย Manager: ${note}`, repairId]);
            await db.query(
                'INSERT INTO status_history (repair_request_id, old_status, new_status, changed_by, note) VALUES (?, ?, ?, ?, ?)',
                [repairId, 'pending', 'pending', req.user.id, `ปฏิเสธ: ${note}`]
            );
            await db.query(
                'INSERT INTO approvals (repair_request_id, manager_id, status, note) VALUES (?, ?, ?, ?)',
                [repairId, req.user.id, 'rejected', note]
            );
            if (typeof auditLog === 'function') auditLog(req.user.id, req.user.username, 'reject_repair', `Rejected repair ${rows[0].ticket_number}: ${note}`, req.ip);
            res.json({ success: true, message: 'ปฏิเสธคำขอ — ผู้แจ้งต้องแก้ไขและส่งใหม่' });
        } catch (err) {
            console.error('❌ POST /api/repairs/:id/reject:', err.message);
            res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' });
        }
    });

    // GET /api/approvals/pending — รายการที่รอ Manager อนุมัติ
    // 🔒 Manager: กรองเฉพาะแผนกที่ตัวเองดูแล
    app.get('/api/approvals/pending', authMiddleware, managerMiddleware, async (req, res) => {
        try {
            let sql, params;
            if (req.user.role === 'manager') {
                sql = `SELECT rr.*, e.equipment_code, e.equipment_name, et.name as type_name
                       FROM repair_requests rr
                       JOIN equipment e ON rr.equipment_id = e.id
                       JOIN equipment_types et ON e.equipment_type_id = et.id
                       WHERE rr.status = 'pending' AND (rr.department_id IN (SELECT id FROM departments WHERE manager_id=?) OR rr.department_id IS NULL)
                       ORDER BY rr.requested_at DESC`;
                params = [req.user.id];
            } else {
                sql = `SELECT rr.*, e.equipment_code, e.equipment_name, et.name as type_name
                       FROM repair_requests rr
                       JOIN equipment e ON rr.equipment_id = e.id
                       JOIN equipment_types et ON e.equipment_type_id = et.id
                       WHERE rr.status = 'pending'
                       ORDER BY rr.requested_at DESC`;
                params = [];
            }
            const [rows] = await db.query(sql, params);
            res.json({ success: true, data: rows, total: rows.length });
        } catch (err) {
            console.error('❌ GET /api/approvals/pending:', err.message);
            res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' });
        }
    });

    // =============================================
    // ⭐ RATING API
    // =============================================

    // POST /api/repairs/:id/rate
    app.post('/api/repairs/:id/rate', authMiddleware, async (req, res) => {
        const repairId = req.params.id;
        const { rating, comment } = req.body;
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ success: false, message: 'กรุณาให้คะแนน 1-5 ดาว' });
        }

        try {
            // 🔒 ตรวจสอบว่า repair นี้เป็นของผู้ใช้จริง และสถานะ completed
            const [rows] = await db.query(
                'SELECT id, user_id, status FROM repair_requests WHERE id = ?',
                [repairId]
            );
            if (!rows.length) return res.status(404).json({ success: false, message: 'ไม่พบคำแจ้งซ่อม' });
            if (req.user.role === 'user' && rows[0].user_id !== req.user.id) {
                return res.status(403).json({ success: false, message: 'คุณไม่มีสิทธิ์ให้คะแนนคำแจ้งนี้' });
            }
            if (rows[0].status !== 'completed') {
                return res.status(400).json({ success: false, message: 'ให้คะแนนได้เฉพาะคำแจ้งที่ซ่อมเสร็จแล้ว' });
            }

            // ตรวจสอบว่าให้คะแนนไปแล้วหรือยัง
            const [existing] = await db.query('SELECT id FROM ratings WHERE repair_request_id = ?', [repairId]);
            if (existing.length) {
                return res.status(400).json({ success: false, message: 'คุณให้คะแนนคำแจ้งนี้ไปแล้ว' });
            }

            await db.query(
                'INSERT INTO ratings (repair_request_id, user_id, rating, comment) VALUES (?, ?, ?, ?)',
                [repairId, req.user.id, parseInt(rating), comment || null]
            );
            if (typeof auditLog === 'function') auditLog(req.user.id, req.user.username, 'rate_repair', `Rated repair ${repairId}: ${rating} stars`, req.ip);
            res.json({ success: true, message: 'ขอบคุณสำหรับคะแนน! ⭐', rating: parseInt(rating) });
        } catch (err) {
            console.error('❌ POST /api/repairs/:id/rate:', err.message);
            res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' });
        }
    });

    // GET /api/ratings/summary
    app.get('/api/ratings/summary', authMiddleware, adminMiddleware, async (req, res) => {
        try {
            const [summary] = await db.query(
                `SELECT AVG(rating) as avg_rating, COUNT(*) as total_ratings,
                        SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as star5,
                        SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as star4,
                        SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as star3,
                        SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as star2,
                        SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as star1
                 FROM ratings`
            );
            const [recent] = await db.query(
                `SELECT r.rating, r.comment, r.created_at, rr.ticket_number, rr.equipment_name, u.full_name
                 FROM ratings r
                 JOIN repair_requests rr ON r.repair_request_id = rr.id
                 JOIN users u ON r.user_id = u.id
                 ORDER BY r.created_at DESC LIMIT 10`
            );
            res.json({ success: true, summary: summary[0], recent });
        } catch (err) {
            console.error('❌ GET /api/ratings/summary:', err.message);
            res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' });
        }
    });

    // GET /api/repairs/:id/rating — เช็คว่าผู้ใช้ให้คะแนนรายการนี้ไปหรือยัง
    app.get('/api/repairs/:id/rating', authMiddleware, async (req, res) => {
        try {
            const [rows] = await db.query(
                'SELECT rating, comment, created_at FROM ratings WHERE repair_request_id = ?',
                [req.params.id]
            );
            res.json({ success: true, data: rows[0] || null });
        } catch (err) {
            console.error('❌ GET /api/repairs/:id/rating:', err.message);
            res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในระบบ' });
        }
    });

    console.log('✅ New Features API loaded: Notifications, Manager Approval, QR Code, Ratings');
};