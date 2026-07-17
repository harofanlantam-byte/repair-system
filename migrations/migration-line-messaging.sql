-- =============================================
-- Migration: LINE Messaging API
-- เพิ่มคอลัมน์ line_user_id ในตาราง users
-- =============================================

USE repair_system;

ALTER TABLE users 
ADD COLUMN line_user_id VARCHAR(50) NULL COMMENT 'LINE User ID (Messaging API) — ได้จากการ follow LINE Official Account'
AFTER telegram_chat_id;