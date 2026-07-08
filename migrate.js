const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
    const c = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
        database: process.env.DB_NAME || 'repair_system',
        charset: 'utf8mb4'
    });
    
    try {
        // 1. Create audit_logs table
        await c.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT DEFAULT NULL,
                username VARCHAR(100) DEFAULT NULL,
                action VARCHAR(100) NOT NULL,
                details TEXT,
                ip_address VARCHAR(45) DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            )
        `);
        console.log('✅ audit_logs table created');

        // 2. Create notifications table
        await c.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                title VARCHAR(200) NOT NULL,
                message TEXT NOT NULL,
                type ENUM('info','success','warning','error') DEFAULT 'info',
                related_type VARCHAR(50) DEFAULT NULL,
                related_id INT DEFAULT NULL,
                is_read TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ notifications table created');

        // 3. Create departments table
        await c.query(`
            CREATE TABLE IF NOT EXISTS departments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                manager_id INT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL
            )
        `);
        console.log('✅ departments table created');

        // 4. Modify users role ENUM
        try {
            await c.query("ALTER TABLE users MODIFY COLUMN role ENUM('admin','manager','user') DEFAULT 'user'");
            console.log('✅ users role ENUM updated');
        } catch(e) { console.log('⚠️ users role:', e.message); }

        // 5. Add columns to repair_requests
        const cols = [
            'department_id INT DEFAULT NULL',
            'approved_by INT DEFAULT NULL',
            'approved_at TIMESTAMP NULL'
        ];
        for (const col of cols) {
            try {
                await c.query(`ALTER TABLE repair_requests ADD COLUMN ${col}`);
            } catch(e) { /* already exists */ }
        }
        console.log('✅ repair_requests columns upgraded');

        console.log('\n🎉 Migration completed successfully!');
    } catch(err) {
        console.error('❌ Migration error:', err.message);
    } finally {
        await c.end();
    }
}

migrate();