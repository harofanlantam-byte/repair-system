-- =============================================
-- สร้าง MySQL user แยกสำหรับแอป (ไม่ใช้ root)
-- =============================================
-- วิธีรัน: เข้า MySQL ในฐานะ root แล้วรัน:
--   mysql -u root -p < migration-create-db-user.sql
-- หรือ copy ทีละคำสั่งไปวางใน phpMyAdmin / MySQL Workbench

CREATE USER IF NOT EXISTS 'repair_app'@'localhost' IDENTIFIED BY 'r3p41r_4pp_5tr0ng_p455_2026!';
GRANT SELECT, INSERT, UPDATE, DELETE ON repair_system.* TO 'repair_app'@'localhost';
FLUSH PRIVILEGES;

-- ตรวจสอบว่า user ถูกสร้างและมีสิทธิ์ถูกต้อง:
-- SHOW GRANTS FOR 'repair_app'@'localhost';

-- หลังจากรันเสร็จ ให้เปลี่ยน .env:
--   DB_USER=repair_app
--   DB_PASS=r3p41r_4pp_5tr0ng_p455_2026!