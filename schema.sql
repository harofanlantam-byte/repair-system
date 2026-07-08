-- =============================================
-- ระบบเว็บแจ้งซ่อม - Database Schema (MySQL)
-- =============================================

CREATE DATABASE IF NOT EXISTS repair_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE repair_system;

-- ตาราง users (Admin)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    role ENUM('admin', 'manager', 'user') DEFAULT 'user',
    status ENUM('active', 'inactive') DEFAULT 'active',
    email VARCHAR(200),
    phone VARCHAR(20),
    avatar VARCHAR(500),
    google_id VARCHAR(100) NULL,
    auth_provider ENUM('local', 'google') DEFAULT 'local',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_google_id (google_id)
);

-- ตาราง notifications (การแจ้งเตือน)
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('info', 'success', 'warning', 'error') DEFAULT 'info',
    related_type VARCHAR(50) DEFAULT NULL,
    related_id INT DEFAULT NULL,
    is_read TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ตาราง departments (แผนกต่างๆ สำหรับ Manager)
CREATE TABLE IF NOT EXISTS departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    manager_id INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ตาราง audit_logs (ประวัติการกระทำ)
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT DEFAULT NULL,
    username VARCHAR(100) DEFAULT NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    ip_address VARCHAR(45) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ตาราง equipment_types (ประเภทครุภัณฑ์)
CREATE TABLE IF NOT EXISTS equipment_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    has_parts BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ตาราง equipment_parts (ชิ้นส่วนของครุภัณฑ์)
CREATE TABLE IF NOT EXISTS equipment_parts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    equipment_type_id INT NOT NULL,
    part_name VARCHAR(100) NOT NULL,
    FOREIGN KEY (equipment_type_id) REFERENCES equipment_types(id) ON DELETE CASCADE
);

-- ตาราง equipment (ทะเบียนครุภัณฑ์)
CREATE TABLE IF NOT EXISTS equipment (
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
);

-- ตาราง repair_requests (คำแจ้งซ่อม)
CREATE TABLE IF NOT EXISTS repair_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_number VARCHAR(20) NOT NULL UNIQUE,
    equipment_id INT NOT NULL,
    equipment_parts TEXT,
    problem_description TEXT NOT NULL,
    requester_name VARCHAR(200) NOT NULL,
    department_id INT DEFAULT NULL,
    approved_by INT DEFAULT NULL,
    approved_at TIMESTAMP NULL,
    location_building VARCHAR(100) NOT NULL,
    location_department VARCHAR(100) NOT NULL,
    location_room VARCHAR(100) NOT NULL,
    priority ENUM('urgent', 'normal', 'low') DEFAULT 'normal',
    image_path VARCHAR(500),
    status ENUM('pending', 'in_progress', 'received', 'sent_repair', 'completed', 'returned', 'cancelled') DEFAULT 'pending',
    repair_cost DECIMAL(10,2) DEFAULT 0.00,
    cost_note TEXT,
    admin_note TEXT,
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (equipment_id) REFERENCES equipment(id),
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ตาราง status_history (ประวัติการเปลี่ยนสถานะ)
CREATE TABLE IF NOT EXISTS status_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    repair_request_id INT NOT NULL,
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    changed_by INT,
    note TEXT,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (repair_request_id) REFERENCES repair_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(id)
);

-- =============================================
-- ข้อมูลเริ่มต้น (Seed Data)
-- =============================================

-- Admin เริ่มต้น (รหัสผ่าน: admin1234)
INSERT IGNORE INTO users (username, password, full_name, role) VALUES
('admin', '$2b$10$rQZ8Kl1mN2vX3wY4zA5bCuD6eF7gH8iJ9kL0mN1oP2qR3sT4uV5w', 'ผู้ดูแลระบบ', 'admin');

-- ประเภทครุภัณฑ์
INSERT IGNORE INTO equipment_types (name, description, has_parts) VALUES
('คอมพิวเตอร์', 'คอมพิวเตอร์ตั้งโต๊ะและอุปกรณ์เสริม', TRUE),
('เครื่องถ่ายเอกสาร', 'เครื่องถ่ายเอกสาร/ปริ้นเตอร์', FALSE),
('UPS', 'เครื่องสำรองไฟฟ้า', FALSE),
('Router', 'อุปกรณ์เครือข่าย Router/Switch', FALSE);

-- ชิ้นส่วนคอมพิวเตอร์
INSERT IGNORE INTO equipment_parts (equipment_type_id, part_name) VALUES
(1, 'CPU'),
(1, 'เมนบอร์ด'),
(1, 'RAM'),
(1, 'SSD'),
(1, 'HDD'),
(1, 'จอคอมพิวเตอร์'),
(1, 'PSU (Power Supply)');

-- ตัวอย่างครุภัณฑ์
INSERT IGNORE INTO equipment (equipment_code, equipment_name, equipment_type_id, location_building, location_department, location_room) VALUES
('COM-001', 'คอมพิวเตอร์ Dell Optiplex 7090', 1, 'อาคาร A', 'ฝ่ายการเงิน', '101'),
('COM-002', 'คอมพิวเตอร์ HP ProDesk 400', 1, 'อาคาร B', 'ฝ่ายบุคคล', '202'),
('COP-001', 'เครื่องถ่ายเอกสาร Ricoh MP2014', 2, 'อาคาร A', 'สำนักงานกลาง', '105'),
('UPS-001', 'UPS APC 1000VA', 3, 'อาคาร A', 'ห้องเซิร์ฟเวอร์', 'B01'),
('RTR-001', 'Router Cisco RV340', 4, 'อาคาร A', 'ห้องเซิร์ฟเวอร์', 'B01');