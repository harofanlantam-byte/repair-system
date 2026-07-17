-- =============================================
-- Migration: แก้ปัญหาการผูก LINE User ID
-- รันคำสั่งนี้ครั้งเดียว: mysql -u root repair_system < migration-line-fix.sql
-- =============================================
USE repair_system;

-- เผื่อฐานข้อมูลเดิมยังไม่มีคอลัมน์นี้ (ถ้ามีอยู่แล้วจะข้ามด้วย error ที่ไม่กระทบข้อมูล)
ALTER TABLE users ADD COLUMN IF NOT EXISTS line_user_id VARCHAR(100) NULL;

-- ป้องกัน LINE User ID เดียวถูกผูกกับหลายบัญชีพร้อมกัน (ต้นเหตุของอาการเชื่อมต่อ "หลุด/สลับ" ที่เจอ)
-- หมายเหตุ: ถ้ารันแล้วเจอ error ว่ามีค่าซ้ำอยู่ก่อน ให้รันคำสั่งนี้ก่อนเพื่อดูว่าใครชนกัน:
--   SELECT line_user_id, COUNT(*) c FROM users WHERE line_user_id IS NOT NULL GROUP BY line_user_id HAVING c > 1;
-- แล้วเคลียร์ค่าที่ผูกผิดคน (SET line_user_id = NULL ให้บัญชีที่ไม่ถูกต้อง) ก่อนรันบรรทัดถัดไป
ALTER TABLE users ADD UNIQUE KEY uk_line_user_id (line_user_id);
