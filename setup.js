// =============================================
// setup.js - ตั้งค่าฐานข้อมูลระบบแจ้งซ่อม
// ใช้งาน: node setup.js
// =============================================
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const fs = require('fs');

async function setup() {
    console.log('🔧 กำลังตั้งค่าฐานข้อมูล...');
    
    // เชื่อมต่อ MySQL (แบบไม่มี database)
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: ''
    });

    try {
        // ลบ Database เก่าถ้ามี และสร้างใหม่
        await connection.query('DROP DATABASE IF EXISTS repair_system');
        await connection.query('CREATE DATABASE repair_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
        console.log('✅ สร้าง Database ใหม่สำเร็จ');
        await connection.end();

        // เชื่อมต่อกับ database repair_system
        const db = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: '',
            database: 'repair_system'
        });

        // =============================================
        // ตาราง users (มี status column + Google OAuth)
        // =============================================
        await db.query(`
            CREATE TABLE users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(100) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                full_name VARCHAR(200) NOT NULL,
                role ENUM('admin', 'user') DEFAULT 'user',
                email VARCHAR(200) NULL,
                phone VARCHAR(20) NULL,
                avatar VARCHAR(500) NULL,
                status ENUM('active', 'inactive') DEFAULT 'active',
                google_id VARCHAR(100) NULL,
                auth_provider ENUM('local', 'google') DEFAULT 'local',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uk_google_id (google_id)
            )
        `);
        console.log('✅ สร้างตาราง users สำเร็จ');

        // =============================================
        // ตาราง equipment_types
        // =============================================
        await db.query(`
            CREATE TABLE equipment_types (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                has_parts BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ สร้างตาราง equipment_types สำเร็จ');

        // =============================================
        // ตาราง equipment_parts
        // =============================================
        await db.query(`
            CREATE TABLE equipment_parts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                equipment_type_id INT NOT NULL,
                part_name VARCHAR(100) NOT NULL,
                FOREIGN KEY (equipment_type_id) REFERENCES equipment_types(id) ON DELETE CASCADE
            )
        `);
        console.log('✅ สร้างตาราง equipment_parts สำเร็จ');

        // =============================================
        // ตาราง equipment
        // =============================================
        await db.query(`
            CREATE TABLE equipment (
                id INT AUTO_INCREMENT PRIMARY KEY,
                equipment_code VARCHAR(100) NOT NULL UNIQUE,
                equipment_name VARCHAR(200) NOT NULL,
                equipment_type_id INT NOT NULL,
                location_building VARCHAR(100),
                location_department VARCHAR(100),
                location_room VARCHAR(100),
                status ENUM('active', 'inactive') DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (equipment_type_id) REFERENCES equipment_types(id)
            )
        `);
        console.log('✅ สร้างตาราง equipment สำเร็จ');

        // =============================================
        // ตาราง repair_requests
        // =============================================
        await db.query(`
            CREATE TABLE repair_requests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                ticket_number VARCHAR(20) NOT NULL UNIQUE,
                equipment_id INT NOT NULL,
                equipment_parts TEXT,
                problem_description TEXT NOT NULL,
                requester_name VARCHAR(200) NOT NULL,
                location_building VARCHAR(100) NOT NULL,
                location_department VARCHAR(100) NOT NULL,
                location_room VARCHAR(100) NOT NULL,
                priority ENUM('urgent', 'normal', 'low') DEFAULT 'normal',
                image_path VARCHAR(500),
                status VARCHAR(50) DEFAULT 'pending',
                repair_cost DECIMAL(10,2) DEFAULT 0,
                cost_note TEXT NULL,
                admin_note TEXT,
                requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                completed_at TIMESTAMP NULL,
                FOREIGN KEY (equipment_id) REFERENCES equipment(id)
            )
        `);
        console.log('✅ สร้างตาราง repair_requests สำเร็จ');

        // =============================================
        // ตาราง status_history
        // =============================================
        await db.query(`
            CREATE TABLE status_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                repair_request_id INT NOT NULL,
                old_status VARCHAR(50),
                new_status VARCHAR(50) NOT NULL,
                changed_by INT,
                note TEXT,
                changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (repair_request_id) REFERENCES repair_requests(id) ON DELETE CASCADE,
                FOREIGN KEY (changed_by) REFERENCES users(id)
            )
        `);
        console.log('✅ สร้างตาราง status_history สำเร็จ');

        // =============================================
        // ตาราง audit_logs
        // =============================================
        await db.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                username VARCHAR(100),
                action VARCHAR(255),
                details TEXT,
                ip_address VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ สร้างตาราง audit_logs สำเร็จ');

        // =============================================
        // Seed Data
        // =============================================

        // Admin เริ่มต้น (รหัสผ่าน: admin1234)
        const hashedPassword = await bcrypt.hash('admin1234', 10);
        await db.query(
            "INSERT INTO users (username, password, full_name, role, status) VALUES ('admin', ?, 'ผู้ดูแลระบบ', 'admin', 'active')",
            [hashedPassword]
        );
        console.log('✅ เพิ่มผู้ใช้ admin สำเร็จ (admin / admin1234)');

        // User ทั่วไป (รหัสผ่าน: user1234)
        const userPassword = await bcrypt.hash('user1234', 10);
        await db.query(
            "INSERT INTO users (username, password, full_name, role, status) VALUES ('user', ?, 'พนักงานทั่วไป', 'user', 'active')",
            [userPassword]
        );
        console.log('✅ เพิ่มผู้ใช้ user สำเร็จ (user / user1234)');

        // ประเภทครุภัณฑ์
        await db.query(`
            INSERT INTO equipment_types (name, description, has_parts) VALUES
            ('คอมพิวเตอร์', 'คอมพิวเตอร์ตั้งโต๊ะและอุปกรณ์เสริม', TRUE),
            ('เครื่องถ่ายเอกสาร', 'เครื่องถ่ายเอกสาร/ปริ้นเตอร์', FALSE),
            ('UPS', 'เครื่องสำรองไฟฟ้า', FALSE),
            ('Router', 'อุปกรณ์เครือข่าย Router/Switch', FALSE)
        `);
        console.log('✅ เพิ่มประเภทครุภัณฑ์สำเร็จ');

        // ชิ้นส่วนคอมพิวเตอร์
        await db.query(`
            INSERT INTO equipment_parts (equipment_type_id, part_name) VALUES
            (1, 'CPU'),
            (1, 'เมนบอร์ด'),
            (1, 'RAM'),
            (1, 'SSD'),
            (1, 'HDD'),
            (1, 'จอคอมพิวเตอร์'),
            (1, 'PSU (Power Supply)')
        `);
        console.log('✅ เพิ่มชิ้นส่วนสำเร็จ');

        // ตัวอย่างครุภัณฑ์
        await db.query(`
            INSERT INTO equipment (equipment_code, equipment_name, equipment_type_id, location_building, location_department, location_room) VALUES
            ('COM-001', 'คอมพิวเตอร์ Dell Optiplex 7090', 1, 'อาคาร A', 'ฝ่ายการเงิน', '101'),
            ('COM-002', 'คอมพิวเตอร์ HP ProDesk 400', 1, 'อาคาร B', 'ฝ่ายบุคคล', '202'),
            ('COP-001', 'เครื่องถ่ายเอกสาร Ricoh MP2014', 2, 'อาคาร A', 'สำนักงานกลาง', '105'),
            ('UPS-001', 'UPS APC 1000VA', 3, 'อาคาร A', 'ห้องเซิร์ฟเวอร์', 'B01'),
            ('RTR-001', 'Router Cisco RV340', 4, 'อาคาร A', 'ห้องเซิร์ฟเวอร์', 'B01')
        `);
        console.log('✅ เพิ่มครุภัณฑ์ตัวอย่างสำเร็จ');

        // สร้างโฟลเดอร์ uploads
        if (!fs.existsSync('./uploads')) {
            fs.mkdirSync('./uploads');
            console.log('✅ สร้างโฟลเดอร์ uploads สำเร็จ');
        }

        await db.end();

        console.log('\n🎉 ========== ตั้งค่าสำเร็จ! ==========');
        console.log('📝 Username: admin');
        console.log('🔑 Password: admin1234');
        console.log('📝 Username: user');
        console.log('🔑 Password: user1234');
        console.log('🌐 เปิดเบราว์เซอร์ที่: http://localhost:3000');
        console.log('======================================\n');

    } catch (err) {
        console.error('❌ เกิดข้อผิดพลาด:', err.message);
        console.error(err);
    }
}

setup();