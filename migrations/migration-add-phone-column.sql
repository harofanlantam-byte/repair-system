-- =============================================
-- Migration: แก้ปัญหา "Unknown column 'phone' in 'field list'"
-- สาเหตุ: ฐานข้อมูลจริงถูกสร้างก่อน schema.sql จะถูกอัปเดตให้มีคอลัมน์ phone
--         (หรือแก้ schema.sql แล้วแต่ไม่เคย ALTER TABLE กับฐานข้อมูลจริง)
-- รันคำสั่งนี้ครั้งเดียว: mysql -u root repair_system < migration-add-phone-column.sql
-- =============================================
USE repair_system;

-- 1) เช็คก่อนว่าตอนนี้มีคอลัมน์อะไรอยู่บ้าง (รันดูเฉยๆ เพื่อยืนยัน ไม่ต้องแก้อะไร)
-- DESCRIBE users;

-- 2) เพิ่มคอลัมน์ phone ถ้ายังไม่มี
--    (MySQL 8.0.29+ รองรับ ADD COLUMN IF NOT EXISTS ถ้าเวอร์ชันเก่ากว่านี้ error "Duplicate column
--     name 'phone'" แปลว่ามีอยู่แล้วจริง ไม่ต้องกังวล ข้ามไปได้เลย)
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20) NULL AFTER email;

-- 3) เผื่อคอลัมน์อื่นที่ schema.sql มีแต่ฐานข้อมูลจริงอาจขาดไปด้วย เช่นกัน — เพิ่มไว้กันเหนียว
--    (ถ้ามีอยู่แล้วจะ error "Duplicate column name" เฉยๆ ไม่กระทบข้อมูลเดิม ข้ามได้เลย)
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar VARCHAR(500) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(50) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS line_user_id VARCHAR(100) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(100) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider ENUM('local','google') DEFAULT 'local';

-- 4) ตรวจสอบผลลัพธ์อีกครั้งหลังรัน
DESCRIBE users;
