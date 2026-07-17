-- =============================================
-- Migration: เพิ่มคอลัมน์ user_id ใน repair_requests
-- สำหรับส่งแจ้งเตือนด้วย ID แทนการ match ด้วยชื่อ
-- =============================================
-- รันคำสั่งนี้ใน phpMyAdmin หรือ MySQL CLI

-- Step 1: เพิ่มคอลัมน์ user_id
ALTER TABLE `repair_requests`
  ADD COLUMN `user_id` INT NULL
  COMMENT 'FK ไป users — ใช้ส่งแจ้งเตือน (อีเมล/Telegram/WebSocket)'
  AFTER `requester_name`;

-- Step 2: เพิ่ม Foreign Key
ALTER TABLE `repair_requests`
  ADD CONSTRAINT `fk_repair_user`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
  ON DELETE SET NULL;

-- Step 3: เติม user_id ในข้อมูลเก่า (match จาก requester_name)
UPDATE `repair_requests` rr
LEFT JOIN `users` u ON rr.requester_name = u.full_name AND u.status = 'active'
SET rr.user_id = u.id
WHERE rr.user_id IS NULL;

-- Step 4 (Optional): เพิ่ม Index
-- ALTER TABLE `repair_requests` ADD INDEX `idx_user_id` (`user_id`);