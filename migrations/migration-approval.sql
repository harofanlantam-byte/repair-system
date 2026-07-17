-- =============================================
-- Migration: Manager Approval System
-- เพิ่มตาราง approvals สำหรับ Manager อนุมัติ/ปฏิเสธคำขอซ่อม
-- =============================================

USE repair_system;

CREATE TABLE IF NOT EXISTS approvals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    repair_request_id INT NOT NULL,
    manager_id INT NOT NULL,
    status ENUM('approved', 'rejected') NOT NULL,
    note TEXT NULL COMMENT 'เหตุผล/หมายเหตุ',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (repair_request_id) REFERENCES repair_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- เพิ่ม Manager ทดสอบ (ถ้ายังไม่มี)
INSERT IGNORE INTO users (username, password, full_name, role, status, email) VALUES
('manager', '$2b$10$8K1p/a9dLJk1w8K1p/a9dLJk1w8K1p/a9dLJk1w8K1p/a9dLJk1w', 'ผู้จัดการระบบ', 'manager', 'active', 'manager@repair-system.com');