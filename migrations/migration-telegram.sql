-- =============================================
-- Migration: เพิ่มคอลัมน์ telegram_chat_id ในตาราง users
-- สำหรับ Telegram Bot Notification เมื่อซ่อมเสร็จ
-- =============================================
-- รันคำสั่งนี้ใน phpMyAdmin หรือ MySQL CLI

-- Step 1: เพิ่มคอลัมน์ (ถ้ายังไม่มี)
ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `telegram_chat_id` VARCHAR(50) NULL
  COMMENT 'Telegram Chat ID สำหรับส่งแจ้งเตือนเมื่อซ่อมเสร็จ'
  AFTER `email`;

-- Step 2 (Optional): เพิ่ม Index เพื่อให้ค้นหาเร็ว
-- ALTER TABLE `users` ADD INDEX `idx_telegram_chat_id` (`telegram_chat_id`);

-- =============================================
-- วิธีใช้งาน Telegram Bot:
-- =============================================
-- 1. สร้าง Bot: คุยกับ @BotFather ใน Telegram
--    - ส่ง /newbot
--    - ตั้งชื่อ bot (เช่น "Repair System Notification")
--    - ตั้ง username bot (เช่น @repair_noti_bot)
--    - จะได้ TELEGRAM_BOT_TOKEN
--
-- 2. หา Chat ID:
--    - ผู้ใช้คุยกับ @userinfobot แล้วกด /start
--    - หรือ @getidsbot
--    - จะได้ Chat ID (ตัวเลข)
--
-- 3. บันทึก Chat ID ให้ผู้ใช้:
--    UPDATE users
--    SET telegram_chat_id = '123456789'
--    WHERE username = 'ชื่อผู้ใช้';
--
-- 4. ตั้งค่า .env:
--    TELEGRAM_ENABLED=true
--    TELEGRAM_BOT_TOKEN=your-token-from-botfather
--
-- 5. ผู้ใช้ต้องเริ่มคุยกับ Bot ก่อนจึงจะได้รับข้อความ
--    ส่ง /start ไปที่ @repair_noti_bot (หรือชื่อ bot ที่ตั้งไว้)
-- =============================================