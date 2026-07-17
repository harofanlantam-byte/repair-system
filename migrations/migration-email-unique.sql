-- =============================================
-- Migration: รองรับฟีเจอร์สมัครสมาชิกเอง (self-registration)
-- รันคำสั่งนี้ครั้งเดียว: mysql -u root repair_system < migration-email-unique.sql
-- =============================================
USE repair_system;

-- ก่อนรัน ควรเช็คก่อนว่ามีอีเมลซ้ำอยู่แล้วหรือไม่ (จาก user ที่ admin เคยสร้างไว้ก่อนหน้า)
--   SELECT email, COUNT(*) c FROM users WHERE email IS NOT NULL AND email != '' GROUP BY email HAVING c > 1;
-- ถ้าเจอ ให้แก้อีเมลที่ซ้ำให้ไม่ซ้ำกันก่อน (หรือเคลียร์ค่าที่ผิดเป็น NULL) แล้วค่อยรันบรรทัดถัดไป

-- MySQL อนุญาตให้มีค่า NULL ซ้ำกันได้หลายแถวใน UNIQUE KEY (ไม่กระทบ user เก่าที่ยังไม่มีอีเมล)
ALTER TABLE users ADD UNIQUE KEY uk_email (email);
