// =============================================
// backup.js - สำรองข้อมูล MySQL อัตโนมัติ
// ใช้: node backup.js
// หรือตั้ง Cron job ให้รันทุกวัน
// =============================================
require('dotenv').config();
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Config
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASS = process.env.DB_PASS || '';
const DB_NAME = process.env.DB_NAME || 'repair_system';
const BACKUP_DIR = path.resolve(process.env.BACKUP_DIR || './backups');

// สร้างชื่อไฟล์
const now = new Date();
const dateStr = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
const filename = `repair_${dateStr}.sql`;
const filepath = path.join(BACKUP_DIR, filename);

// สร้างโฟลเดอร์ backups ถ้ายังไม่มี
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`📁 สร้างโฟลเดอร์: ${BACKUP_DIR}`);
}

// สร้าง mysqldump command
const mysqldumpPath = 'C:\\xampp\\mysql\\bin\\mysqldump.exe';
const cmd = `"${mysqldumpPath}" -h ${DB_HOST} -u ${DB_USER} ${DB_PASS ? '-p' + DB_PASS : ''} --routines --triggers --add-drop-database ${DB_NAME} > "${filepath}"`;

console.log(`⏳ กำลังสำรองฐานข้อมูล ${DB_NAME}...`);

exec(cmd, { shell: true }, (err, stdout, stderr) => {
    if (err) {
        // ถ้าใช้ XAMPP path ไม่เจอ ลอง mysqldump ปกติ
        const altCmd = `mysqldump -h ${DB_HOST} -u ${DB_USER} ${DB_PASS ? '-p' + DB_PASS : ''} --routines --triggers ${DB_NAME} > "${filepath}"`;
        exec(altCmd, { shell: true }, (err2, stdout2, stderr2) => {
            if (err2) {
                console.error('❌ Backup ล้มเหลว:', err2.message);
                console.log('💡 ตรวจสอบว่า XAMPP MySQL ทำงานอยู่และ mysqldump มีใน PATH');
                return;
            }
            const stats = fs.statSync(filepath);
            console.log(`✅ สำรองข้อมูลสำเร็จ! ไฟล์: ${filename} (${(stats.size/1024).toFixed(1)} KB)`);
        });
        return;
    }
    const stats = fs.statSync(filepath);
    console.log(`✅ สำรองข้อมูลสำเร็จ! ไฟล์: ${filename} (${(stats.size/1024).toFixed(1)} KB)`);
    
    // ลบไฟล์ที่เก่ากว่า 30 วัน
    cleanupOldBackups();
});

function cleanupOldBackups() {
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('repair_') && f.endsWith('.sql'));
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    let deleted = 0;
    
    files.forEach(f => {
        const fp = path.join(BACKUP_DIR, f);
        const stat = fs.statSync(fp);
        if (stat.mtimeMs < thirtyDaysAgo) {
            fs.unlinkSync(fp);
            deleted++;
        }
    });
    
    if (deleted > 0) {
        console.log(`🧹 ลบไฟล์สำรองเก่า (${deleted} ไฟล์) ที่เกิน 30 วัน`);
    }
}