// =============================================
// Email Utils - ฟังก์ชันช่วยเหลืองานอีเมล
// =============================================

const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const nodemailer = require('nodemailer');

// =============================================
// SMTP Configuration
// =============================================
const smtpConfig = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
    }
};

const EMAIL_FROM = process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@repair-system.com';
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || 'ระบบแจ้งซ่อมครุภัณฑ์';
const SYSTEM_URL = process.env.SYSTEM_URL || 'http://localhost:3000';
const EMAIL_ENABLED = process.env.EMAIL_ENABLED !== 'false';

// =============================================
// Status & Priority Maps
// =============================================
const STATUS_MAP = {
    pending:     { text: 'รอดำเนินการ',      color: 'background-color:#fde68a;color:#92400e;' },
    in_progress: { text: 'กำลังดำเนินการ',     color: 'background-color:#bfdbfe;color:#1e40af;' },
    received:    { text: 'รับเรื่องแล้ว',      color: 'background-color:#c7d2fe;color:#3730a3;' },
    sent_repair: { text: 'ส่งซ่อมภายนอก',     color: 'background-color:#fca5a5;color:#991b1b;' },
    completed:   { text: 'ดำเนินการเสร็จสิ้น', color: 'background-color:#bbf7d0;color:#166534;' },
    returned:    { text: 'ส่งคืนแล้ว',        color: 'background-color:#ddd6fe;color:#5b21b6;' },
    cancelled:   { text: 'ยกเลิก',           color: 'background-color:#e2e8f0;color:#475569;' }
};

const PRIORITY_MAP = {
    urgent: { text: '🔴 ด่วนมาก', color: '#dc2626' },
    normal: { text: '🟡 ปกติ',   color: '#d97706' },
    low:    { text: '🟢 ต่ำ',    color: '#059669' }
};

// =============================================
// SMTP Transporter (singleton)
// =============================================
let transporter = null;
let usingEthereal = false;

async function getTransporter() {
    if (transporter) return transporter;

    // ลองใช้ Gmail/Outlook SMTP ก่อน
    if (smtpConfig.auth.user && smtpConfig.auth.pass) {
        transporter = nodemailer.createTransport(smtpConfig);
        try {
            await transporter.verify();
            console.log(`� [Email] เชื่อมต่อ SMTP สำเร็จ: ${smtpConfig.host}:${smtpConfig.port}`);
            return transporter;
        } catch (err) {
            console.warn(`⚠️ [Email] SMTP ${smtpConfig.host} ล้มเหลว: ${err.message}`);
            transporter = null;
        }
    }

    // Fallback: ใช้ Ethereal (อีเมลจำลอง ฟรี ไม่ต้องตั้งค่า)
    console.log('� [Email] กำลังสร้าง Ethereal test account...');
    try {
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: await testAccount.smtp.port || 587,
            secure: false,
            auth: { user: testAccount.user, pass: testAccount.pass }
        });
        usingEthereal = true;
        console.log(`🟢 [Email] ใช้ Ethereal (อีเมลจำลอง): ${testAccount.user}`);
        console.log(`🔗 ดูผลได้ที่: https://ethereal.email/`);
        console.log(`   Login: ${testAccount.user} / ${testAccount.pass}`);
        return transporter;
    } catch (e2) {
        console.error('🔴 [Email] สร้าง Ethereal account ไม่สำเร็จ:', e2.message);
        return null;
    }
}

async function verifyEmailConnection() {
    const t = await getTransporter();
    return !!t;
}

// =============================================
// Template Engine
// =============================================
function loadTemplate(templateName) {
    const templatePath = path.join(__dirname, '..', 'templates', 'email', `${templateName}.html`);
    if (!fs.existsSync(templatePath)) {
        console.warn(`⚠️ [Email] ไม่พบ template: ${templateName}.html`);
        return null;
    }
    return fs.readFileSync(templatePath, 'utf-8');
}

function renderTemplate(templateContent, variables = {}) {
    let html = templateContent;
    const allVars = { ...variables, year: new Date().getFullYear(), system_url: SYSTEM_URL };
    Object.entries(allVars).forEach(([key, value]) => {
        html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value !== null && value !== undefined ? String(value) : '');
    });
    return html;
}

function htmlToPlainText(html) {
    return html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]*>/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

// =============================================
// Email Logging
// =============================================
function logEmail({ type, to, subject, messageId, response, error }) {
    const timestamp = new Date().toISOString();
    const logEntry = JSON.stringify({ timestamp, type, to, subject, messageId, response, error }) + '\n';
    const logDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
    fs.appendFileSync(path.join(logDir, 'email.log'), logEntry);
}

// =============================================
// Database Helpers (require db reference)
// =============================================
let db = null;

function setDatabase(database) {
    db = database;
}

async function getAdminEmails() {
    if (!db) return [];
    try {
        const [rows] = await db.query(
            "SELECT email FROM users WHERE role = 'admin' AND status = 'active' AND email IS NOT NULL AND email != ''"
        );
        return rows.map(r => r.email).filter(Boolean);
    } catch (err) {
        console.error('❌ [Email] ดึงอีเมล Admin ไม่สำเร็จ:', err.message);
        return [];
    }
}

// =============================================
// Cron Jobs
// =============================================
const CRON_DAILY_SUMMARY = process.env.CRON_DAILY_SUMMARY || '0 8 * * *';
const CRON_REMINDER = process.env.CRON_REMINDER || '0 9 * * *';

async function runDailySummary() {
    if (!db) {
        console.warn('⚠️ [Scheduler] ข้าม daily summary — ไม่มีการเชื่อมต่อ DB');
        return;
    }
    console.log('📊 [Scheduler] เริ่มสร้างรายงานสรุปประจำวัน...');
    const today = new Date();
    const reportDate = today.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Bangkok' });
    const todayStr = today.toISOString().split('T')[0];

    try {
        const adminEmails = await getAdminEmails();
        if (adminEmails.length === 0) {
            console.log('📵 [Scheduler] ไม่พบอีเมล Admin — ข้าม daily summary');
            return;
        }
        const [newRows] = await db.query('SELECT COUNT(*) as count FROM repair_requests WHERE DATE(requested_at) = ?', [todayStr]);
        const totalNew = newRows[0]?.count || 0;
        const [completedRows] = await db.query('SELECT COUNT(*) as count FROM repair_requests WHERE DATE(completed_at) = ?', [todayStr]);
        const totalCompleted = completedRows[0]?.count || 0;
        const [statusRows] = await db.query('SELECT status, COUNT(*) as count FROM repair_requests GROUP BY status');
        const statusSummary = {};
        let totalAll = 0;
        statusRows.forEach(r => { statusSummary[r.status] = r.count; totalAll += r.count; });
        const [newTickets] = await db.query(
            `SELECT rr.ticket_number, rr.requester_name, rr.status, e.equipment_name
             FROM repair_requests rr JOIN equipment e ON rr.equipment_id = e.id
             WHERE DATE(rr.requested_at) = ? ORDER BY rr.requested_at DESC LIMIT 10`,
            [todayStr]
        );

        // dynamic require to avoid circular dependency
        const emailService = require('../services/emailService');
        const result = await emailService.sendDailySummaryEmail({ adminEmails, reportDate, totalNew, totalCompleted, totalAll, statusSummary, newTickets });
        if (result.success) {
            console.log(`✅ [Scheduler] ส่งรายงานสรุปประจำวันสำเร็จ (ใหม่ ${totalNew} | เสร็จ ${totalCompleted} | รวม ${totalAll})`);
        }
    } catch (err) {
        console.error('❌ [Scheduler] สร้างรายงานสรุปประจำวันไม่สำเร็จ:', err.message);
    }
}

async function runReminder() {
    if (!db) {
        console.warn('⚠️ [Scheduler] ข้าม reminder — ไม่มีการเชื่อมต่อ DB');
        return;
    }
    console.log('⚠️ [Scheduler] เริ่มตรวจสอบครุภัณฑ์ใกล้หมดอายุ...');
    try {
        const adminEmails = await getAdminEmails();
        if (adminEmails.length === 0) {
            console.log('📵 [Scheduler] ไม่พบอีเมล Admin — ข้าม reminder');
            return;
        }
        const [colExists] = await db.query(
            "SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'equipment' AND COLUMN_NAME = 'warranty_expire'",
            [process.env.DB_NAME || 'repair_system']
        );
        if (!colExists[0]?.cnt) {
            console.log('ℹ️ [Scheduler] ไม่มีคอลัมน์ warranty_expire ในตาราง equipment — ข้าม reminder');
            return;
        }
        const [expiring] = await db.query(
            `SELECT equipment_code, equipment_name, warranty_expire, DATEDIFF(warranty_expire, CURDATE()) as days_until_expire
             FROM equipment WHERE status = 'active' AND warranty_expire IS NOT NULL
             AND warranty_expire <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) AND warranty_expire >= CURDATE()
             ORDER BY warranty_expire ASC`
        );
        if (expiring.length === 0) {
            console.log('✅ [Scheduler] ไม่มีครุภัณฑ์ใกล้หมดอายุในช่วง 30 วัน');
            return;
        }
        const equipmentList = expiring.map(eq => ({
            equipment_code: eq.equipment_code,
            equipment_name: eq.equipment_name,
            expire_date: eq.warranty_expire ? new Date(eq.warranty_expire).toLocaleDateString('th-TH') : 'N/A',
            daysUntilExpire: eq.days_until_expire
        }));

        const emailService = require('../services/emailService');
        const result = await emailService.sendReminderEmail({ adminEmails, equipmentList });
        if (result.success) {
            console.log(`✅ [Scheduler] ส่งอีเมลแจ้งเตือนครุภัณฑ์ใกล้หมดอายุ ${expiring.length} รายการสำเร็จ`);
        }
    } catch (err) {
        console.error('❌ [Scheduler] แจ้งเตือนครุภัณฑ์ไม่สำเร็จ:', err.message);
    }
}

function initScheduler(database) {
    setDatabase(database);
    cron.schedule(CRON_DAILY_SUMMARY, () => {
        console.log('⏰ [Scheduler] Cron: Daily Summary triggered');
        runDailySummary().catch(err => console.error('❌ [Scheduler] Daily Summary error:', err.message));
    }, { timezone: 'Asia/Bangkok' });
    cron.schedule(CRON_REMINDER, () => {
        console.log('⏰ [Scheduler] Cron: Reminder triggered');
        runReminder().catch(err => console.error('❌ [Scheduler] Reminder error:', err.message));
    }, { timezone: 'Asia/Bangkok' });
    console.log('🕐 [Scheduler] Cron Jobs เริ่มทำงานแล้ว:');
    console.log(`   📊 Daily Summary: "${CRON_DAILY_SUMMARY}" (Asia/Bangkok)`);
    console.log(`   ⚠️  Reminder:      "${CRON_REMINDER}" (Asia/Bangkok)`);
}

module.exports = {
    // config
    EMAIL_FROM, EMAIL_FROM_NAME, SYSTEM_URL, EMAIL_ENABLED,
    smtpConfig,
    // transporter
    getTransporter, verifyEmailConnection,
    // maps
    STATUS_MAP, PRIORITY_MAP,
    // template
    loadTemplate, renderTemplate, htmlToPlainText,
    // logging
    logEmail,
    // database
    setDatabase, getAdminEmails,
    // cron
    initScheduler, runDailySummary, runReminder
};