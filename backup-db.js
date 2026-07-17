// =============================================
// Database Backup Script (mysqldump + auto-cleanup)
// วิธีใช้: node backup-db.js
// Cron (Windows Task Scheduler): ทุกวัน 02:00
// =============================================
require('dotenv').config();
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASS = process.env.DB_PASS || '';
const DB_NAME = process.env.DB_NAME || 'repair_system';
const BACKUP_DIR = process.env.BACKUP_DIR || './backups';
const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || '14', 10);

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

const now = new Date();
const timestamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
const filename = `repair_system_${timestamp}.sql`;
const filepath = path.join(BACKUP_DIR, filename);

try {
    // Build mysqldump command
    // On XAMPP, mysqldump.exe is in C:\xampp\mysql\bin\
    const mysqldumpPath = process.env.MYSQLDUMP_PATH || 'mysqldump';
    const cmd = `"${mysqldumpPath}" -h ${DB_HOST} -u ${DB_USER} ${DB_PASS ? `-p"${DB_PASS}"` : ''} --single-transaction --routines --triggers --add-drop-table --default-character-set=utf8mb4 ${DB_NAME}`;
    
    const dump = execSync(cmd, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
    fs.writeFileSync(filepath, dump);
    console.log(`✅ Backup saved: ${filename} (${Math.round(dump.length / 1024)} KB)`);

    // Cleanup: ลบไฟล์ที่เก่ากว่า RETENTION_DAYS
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.sql'));
    let deleted = 0;
    for (const f of files) {
        const fp = path.join(BACKUP_DIR, f);
        if (fs.statSync(fp).mtimeMs < cutoff) {
            fs.unlinkSync(fp);
            deleted++;
        }
    }
    if (deleted > 0) console.log(`🗑️  Cleaned up ${deleted} old backup(s) (> ${RETENTION_DAYS} days)`);

} catch (err) {
    console.error('❌ Backup failed:', err.message);
    // Fallback: ถ้า mysqldump ไม่ได้ ให้ใช้ export แบบ manual ผ่าน Node.js แทน
    console.log('⚠️  Trying Node.js fallback backup...');
    manualBackup();
    process.exit(1);
}

// Fallback: export ทีละ table ด้วย SELECT (ใช้ตอน mysqldump ไม่พร้อม)
async function manualBackup() {
    const mysql = require('mysql2/promise');
    try {
        const conn = await mysql.createConnection({
            host: DB_HOST, user: DB_USER, password: DB_PASS, database: DB_NAME,
            charset: 'utf8mb4', multipleStatements: true
        });
        const [tables] = await conn.query('SHOW TABLES');
        let dump = `-- Backup: ${DB_NAME}\n-- Date: ${new Date().toISOString()}\n-- Method: manual (mysqldump fallback)\n\n`;
        
        for (const row of tables) {
            const tbl = Object.values(row)[0];
            const [rows] = await conn.query(`SELECT * FROM \`${tbl}\``);
            if (!rows.length) continue;
            const [createRow] = await conn.query(`SHOW CREATE TABLE \`${tbl}\``);
            dump += `DROP TABLE IF EXISTS \`${tbl}\`;\n${createRow[0]['Create Table']};\n\n`;
            
            for (const r of rows) {
                const cols = Object.keys(r);
                const vals = cols.map(k => {
                    const v = r[k];
                    if (v === null) return 'NULL';
                    if (typeof v === 'number') return String(v);
                    if (v instanceof Date) return `'${v.toISOString().slice(0, 19).replace('T', ' ')}'`;
                    return `'${String(v).replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
                });
                dump += `INSERT INTO \`${tbl}\` (\`${cols.join('`,`')}\`) VALUES (${vals.join(',')});\n`;
            }
            dump += '\n';
        }
        
        const fbFile = path.join(BACKUP_DIR, `repair_system_${timestamp}_fallback.sql`);
        fs.writeFileSync(fbFile, dump);
        console.log(`⚠️  Fallback backup saved: ${fbFile} (${Math.round(dump.length / 1024)} KB)`);
        await conn.end();
    } catch (e) {
        console.error('❌ Manual backup also failed:', e.message);
    }
}