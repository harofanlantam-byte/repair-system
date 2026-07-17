# ระบบเว็บแจ้งซ่อมครุภัณฑ์ (Repair Management System)

## 📋 ภาพรวมโปรเจค (Project Overview)

ระบบเว็บแอปพลิเคชันสำหรับจัดการคำแจ้งซ่อมครุภัณฑ์/วัสดุของหน่วยงาน โรงพยาบาลเหนือคลอง อำเภอเหนือคลอง จังหวัดกระบี่ รองรับการทำงานแบบ Role-Based Access Control (RBAC) แบ่งเป็น 3 บทบาท คือ **Admin (ผู้ดูแลระบบ)**, **Manager (ผู้จัดการ)** และ **User (ผู้ใช้งานทั่วไป)**

แพลตฟอร์ม: **Local Web Application**  
URL: `http://localhost:3000`  
ฐานข้อมูล: **MySQL** (ผ่าน XAMPP)  
Backend Runtime: **Node.js + Express.js**  

---

## 🏗️ สถาปัตยกรรมระบบ (System Architecture)

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────────┐ │
│  │ index    │ │register  │ │dashboard │ │ equipment,         │ │
│  │ (Login)  │ │.html     │ │.html     │ │ equipment-detail,  │ │
│  │ .html    │ │          │ │(Admin)   │ │ repair-form,       │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ │ type-select,       │ │
│       │            │            │        │ history, service,  │ │
│       └────────────┴────────────┴────────┴─ my-history        │ │
│                                                     │            │
│  ┌──────────────────────────────────────────────────┴──────────┐ │
│  │  script.js - Shared Frontend Logic                          │ │
│  │  style.css - Shared Styles                                  │ │
│  │  socket-client.js - Real-Time WebSocket Notifications       │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ HTTP REST API (JSON + JWT Auth)
                                │ WebSocket (Socket.IO)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SERVER (Node.js + Express)                   │
│  server.js                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ Auth API     │  │ CRUD API     │  │ Utility                │ │
│  │ - /api/auth/ │  │ - equipment  │  │ - Multer (uploads)     │ │
│  │   login      │  │ - repairs    │  │ - JWT Middleware       │ │
│  │   register   │  │ - users      │  │ - RBAC (3 Roles)       │ │
│  │              │  │ - dashboard  │  │ - XLSX Export          │ │
│  │              │  │ - profile    │  │ - Notifications API    │ │
│  │              │  │ - cost       │  │ - Approve/Reject API   │ │
│  │              │  │ - departments│  │ - QR Code Generator    │ │
│  │              │  │ - ratings ⭐  │  │ - Rating API          │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │  Socket.IO - Real-Time Notification System                  ││
│  │  - JWT Authentication per socket                            ││
│  │  - Room-based messaging (admin-room, user-{id})             ││
│  │  - Events: new-repair, status-change, repair-updated        ││
│  └──────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     DATABASE (MySQL - XAMPP)                     │
│  Database: repair_system                                        │
│  ┌──────────┐ ┌────────────────┐ ┌──────────────────────┐       │
│  │ users    │ │ equipment      │ │ repair_requests      │       │
│  │ (3 roles)│ │ ├─ equipment_  │ │ ├─ status_history    │       │
│  │          │ │ │   types       │ │ ├─ departments      │       │
│  │          │ │ ├─ equipment_  │ │ ├─ notifications    │       │
│  │          │ │     parts      │ │ ├─ approvals        │       │
│  │          │ │                │ │ ├─ ratings ⭐        │       │
│  └──────────┘ └────────────────┘ └──────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 โครงสร้างไฟล์ (File Structure)

| ไฟล์/โฟลเดอร์ | ประเภท | คำอธิบาย |
|:---|:---|:---|
| `server.js` | Backend | เซิร์ฟเวอร์หลัก - API, Auth, Middleware, File Upload, Export, Notifications, Socket.IO, Manager Approval, QR Code, Rating |
| `script.js` | Frontend | ฟังก์ชันหลักทั้งระบบ - Auth, API calls, UI logic, RBAC, Sidebar, Dark Mode, Notification Bell |
| `style.css` | Frontend | CSS หลัก - Theme, Topbar, Sidebar, Cards, Forms, Tables, Notifications, Notification Bell |
| `schema.sql` | Database | Schema ฐานข้อมูล - สร้างตารางและ Seed Data |
| `migration-approval.sql` | Database | Migration: เพิ่มตาราง approvals สำหรับ Manager อนุมัติคำขอ |
| `migration-rating.sql` | Database | Migration: เพิ่มตาราง ratings สำหรับให้คะแนน ⭐ |
| `migration-user-id.sql` | Database | Migration: เพิ่ม user_id ใน repair_requests |
| `migration-telegram.sql` | Database | Migration: เพิ่ม telegram_chat_id ใน users |
| `seed-equipment.js` | Database | สคริปต์สร้างข้อมูลครุภัณฑ์สุ่ม 40 รายการ (`node seed-equipment.js`) |
| `package.json` | Config | Dependencies และ Scripts |
| `index.html` | Frontend | หน้าเข้าสู่ระบบ (Login) |
| `dashboard.html` | Frontend | หน้าแดชบอร์ด (Admin-only, redirect non-admin) |
| `equipment.html` | Frontend | จัดการทะเบียนครุภัณฑ์ (root, ใช้ร่วมกัน Admin/User, มีตัวกรอง ห้อง/แผนก/ตึก/สถานะ) |
| `equipment-detail.html` | Frontend | ดูรายละเอียดครุภัณฑ์ + แก้ไขข้อมูล + QR Code |
| `type-select.html` | Frontend | เลือกประเภทครุภัณฑ์เพื่อจัดการ หรือแจ้งซ่อม (root, ใช้ร่วมกัน Admin/User) |
| `repair-form.html` | Frontend | ฟอร์มแจ้งซ่อม (root, auto-fill ชื่อผู้แจ้งจาก localStorage) |
| `repair-document.html` | Frontend | เอกสารบันทึกข้อความขออนุมัติซ่อม (พิมพ์ PDF) |
| `history.html` | Frontend | ประวัติคำแจ้งซ่อมทั้งหมด (Admin-only) |
| `my-history.html` | Frontend | ประวัติคำแจ้งซ่อมของตัวเอง (root, ใช้ร่วมกัน Admin/User) |
| `service.html` | Frontend | หน้าดูรายละเอียดและจัดการคำแจ้งซ่อมรายการ |
| `profile.html` | Frontend | หน้าจัดการโปรไฟล์ผู้ใช้ |
| `account-settings.html` | Frontend | หน้าจัดการบัญชี (เปลี่ยนรหัสผ่าน) |
| `user-management.html` | Frontend | จัดการผู้ใช้ (Admin) |
| `admin/` | Frontend | หน้าเฉพาะ Admin (dashboard, equipment, history, my-history, service, type-select) |
| `user/` | Frontend | หน้าเฉพาะ User (my-history, repair-form, type-user) |
| `templates/email/` | Frontend | Email Templates (status-change, new-repair, repair-completed, reminder, daily-summary) |
| `services/` | Backend | Services: emailService, lineNotifyService, telegramBotService |
| `utils/` | Backend | Utilities: emailUtils (SMTP, Templates, Cron) |
| `uploads/` | Storage | เก็บไฟล์รูปภาพที่อัปโหลด |

---

## 🆕 ฟีเจอร์ใหม่ (2026-07-14)

### 1. 🔔 Real-Time Notifications (เพิ่มการแสดงผล)
- **สถานะ:** ✅ เสร็จสมบูรณ์
- Socket.IO Server พร้อมใช้งานแล้ว
- เพิ่ม Notification Bell 🔔 บน Topbar ทุกหน้า — แสดงจำนวนแจ้งเตือนที่ยังไม่ได้อ่าน
- Dropdown แสดงรายการแจ้งเตือนล่าสุด
- แจ้งเตือนแบบ Real-time ทันทีที่มีคำแจ้งซ่อมใหม่ หรือสถานะเปลี่ยน
- เล่นเสียงแจ้งเตือนเมื่อซ่อมเสร็จ
- Toast notification แสดงที่มุมขวาล่าง

### 2. ✅ Manager Approval Workflow
- **สถานะ:** ✅ เสร็จสมบูรณ์
- เพิ่มตาราง `approvals` ในฐานข้อมูล
- Manager สามารถ อนุมัติ (Approve) / ปฏิเสธ (Reject) คำแจ้งซ่อมก่อนส่งต่อให้ Admin
- Workflow ใหม่: `pending` → Manager Approve → `in_progress` → ... → `completed`
- หาก Manager ปฏิเสธ: สถานะกลับเป็น `pending` พร้อมระบุเหตุผล
- API: `POST /api/repairs/:id/approve`, `POST /api/repairs/:id/reject`
- หน้า `service.html` แสดงปุ่ม Approve/Reject สำหรับ Manager

### 3. 📱 QR Code Generator
- **สถานะ:** ✅ เสร็จสมบูรณ์
- แสดง QR Code บนหน้า `equipment-detail.html` สำหรับครุภัณฑ์แต่ละชิ้น
- API: `GET /api/equipment/:id/qrcode` — สร้าง QR Code แบบ SVG
- เมื่อสแกน QR Code → เปิดหน้า equipment-detail พร้อมแสดงข้อมูลครุภัณฑ์
- สามารถสแกนเพื่อแจ้งซ่อมได้ทันที
- ใช้ library `qrcode`

### 4. ⭐ Rating System
- **สถานะ:** ✅ เสร็จสมบูรณ์
- เพิ่มตาราง `ratings` ในฐานข้อมูล
- ผู้ใช้ให้คะแนน 1-5 ดาว หลังจากซ่อมเสร็จ (completed)
- แสดงคะแนนเฉลี่ยของช่าง/Admin ใน dashboard
- API: `POST /api/repairs/:id/rate`, `GET /api/ratings/summary`
- UI: แสดงดาว ⭐ ใน `my-history.html` และ `service.html`

### 5. 🗺️ Feature Roadmap (แผนในอนาคต)

| Priority | ฟีเจอร์ | รายละเอียด | สถานะ |
|----------|---------|-----------|--------|
| 🔴 P0 | Gmail SMTP | แก้ App Password → ระบบส่งอีเมลทำงานได้ | ⏳ รอ App Password ใหม่ |
| 🔴 P0 | LINE Notify | แจ้งเตือนผ่าน LINE (ฟรี สร้าง Token 30 วิ) | ⏳ รอ Token |
| 🟡 P1 | Telegram Bot | แจ้งเตือนผ่าน Telegram ส่วนตัว | ⏳ รอเปิดใช้ |
| 🟡 P1 | Dashboard Real-time | อัปเดตตัวเลขแดชบอร์ดอัตโนมัติผ่าน WebSocket | 📋 Planned |
| 🟢 P2 | Export PDF Report | รายงานประจำเดือน พร้อมกราฟและสถิติ | 📋 Planned |
| 🟢 P2 | Inventory/อะไหล่ | จัดการสต็อกอะไหล่ เชื่อมกับงานซ่อม | 📋 Planned |
| 🟢 P2 | Warranty Alert | แจ้งเตือนก่อนประกันหมด 30/14/7 วัน | ✅ มี Cron อยู่แล้ว |

---

## 🔧 การแก้ไขบัคและปรับปรุงล่าสุด (2026-07-14)

### New Feature: Real-Time Notification System (UI Enhancement)
- เพิ่ม Notification Bell 🔔 บน Topbar (ทุกหน้า) พร้อม Badge Count
- Notification Dropdown แสดง 5 รายการล่าสุด
- Mark as read / Mark all as read
- Toast Notification แบบ Real-time ที่มุมขวาล่าง
- เล่นเสียงเมื่อซ่อมเสร็จ (Web Audio API)

### New Feature: Manager Approval Workflow
- เพิ่มตาราง `approvals` สำหรับเก็บประวัติการอนุมัติ
- Manager API: approve/reject repair requests
- ปรับ workflow ให้ Manager อนุมัติก่อน Admin ดำเนินการ
- เพิ่มปุ่ม Approve/Reject ใน `service.html` สำหรับ Manager

### New Feature: QR Code Generator
- ติดตั้ง `qrcode` package
- API endpoint สำหรับสร้าง QR Code แบบ SVG
- แสดง QR Code ใน `equipment-detail.html`
- สแกนแล้วไปหน้า equipment-detail พร้อมแจ้งซ่อมได้ทันที

### New Feature: Rating System
- เพิ่มตาราง `ratings` เก็บคะแนน 1-5 ดาว
- ผู้ใช้ให้คะแนนหลังจากซ่อมเสร็จ
- แสดงคะแนนเฉลี่ยใน Dashboard
- UI Rating Stars แบบ Interactive

### Bug Fix: MySQL InnoDB Log Corruption (2026-07-14)
- ลบไฟล์ `ib_logfile0`, `ib_logfile1` ที่เสียหาย
- ลบไฟล์ replication ที่เสียหาย (`master-*`, `relay-log-*`, `multi-master.info`)
- เพิ่ม `skip-slave-start` ใน `my.ini` เพื่อป้องกันการเกิดซ้ำ

### Bug Fix: `my-history.html` ไม่แสดงประวัติหลังแจ้งซ่อม (2026-07-09)
- **สาเหตุ:** ช่อง "ชื่อผู้แจ้ง" ใน `repair-form.html` (root และ user/) ไม่ได้ auto-fill ชื่อจาก localStorage ทำให้ผู้ใช้พิมพ์ชื่อไม่ตรงกับ `full_name` ที่ใช้กรองใน `my-history.html`
- **แก้ไข:** เพิ่ม IIFE ใน `repair-form.html` และ `user/repair-form.html` ให้ auto-fill `rf-requester` จาก `user.full_name || user.username`

### Bug Fix: เรียกฟังก์ชันซ้ำซ้อนใน `script.js` (2026-07-09)
- **สาเหตุ:** `path.includes('history.html')` ตรงกับทั้ง `history.html` และ `my-history.html` ทำให้ `loadHistory()` ถูกเรียกในหน้า `my-history.html` โดยไม่จำเป็น
- **แก้ไข:** เปลี่ยนเป็น `path.endsWith('/history.html') || path.endsWith('\\history.html') || path === '/history.html'` เพื่อตรวจสอบแบบเจาะจง

### Bug Fix: ปุ่ม "แจ้งซ่อม" ใน `equipment.html` ไม่ส่งข้อมูลครุภัณฑ์ (2026-07-09)
- **สาเหตุ:** พารามิเตอร์ `equip_id` vs `equipment_id` ไม่ตรงกันระหว่าง `goToRepair()` ใน `equipment.html` และ `DOMContentLoaded` ใน `repair-form.html`
- **แก้ไข:** เปลี่ยน `goToRepair` ส่ง `equipment_id` ให้ตรงกับที่ `repair-form.html` อ่าน

### Improvement: ซ่อนเมนู Admin สำหรับ User ใน root pages (2026-07-09)
- เพิ่มคลาส `admin-only` ใน sidebar/topbar ทุก root page
- เพิ่ม JS ซ่อน `.admin-only` elements สำหรับผู้ใช้ที่ไม่ใช่ admin
- หน้า `dashboard.html` และ `history.html` redirect ผู้ใช้ทั่วไปไป `my-history.html`

### New File: `my-history.html` (root) (2026-07-09)
- สร้างหน้า `my-history.html` ที่ root directory
- รองรับทั้ง Admin และ User (ซ่อนเมนู admin สำหรับ user)

---

## 🗄️ โครงสร้างฐานข้อมูล (Database Schema)

### ตาราง `users` (ผู้ใช้งานระบบ)
| Column | Type | Description |
|:---|:---|:---|
| `id` | INT AUTO_INCREMENT PK | รหัสผู้ใช้ |
| `username` | VARCHAR(100) UNIQUE | ชื่อผู้ใช้ |
| `password` | VARCHAR(255) | รหัสผ่าน (bcrypt hash) |
| `full_name` | VARCHAR(200) | ชื่อ-นามสกุล |
| `role` | ENUM('admin','manager','user') | บทบาท (Admin/Manager/User) |
| `status` | ENUM('active','inactive') | สถานะบัญชี |
| `email` | VARCHAR(200) | อีเมล |
| `phone` | VARCHAR(20) | เบอร์โทร |
| `telegram_chat_id` | VARCHAR(50) | Telegram Chat ID |
| `avatar` | VARCHAR(500) | รูปโปรไฟล์ |
| `google_id` | VARCHAR(100) | Google OAuth ID |
| `auth_provider` | ENUM('local','google') | วิธีการล็อกอิน |

### ตาราง `equipment_types` (ประเภทครุภัณฑ์)
| Column | Type | Description |
|:---|:---|:---|
| `id` | INT AUTO_INCREMENT PK | รหัสประเภท |
| `name` | VARCHAR(100) | ชื่อประเภท |
| `description` | TEXT | คำอธิบาย |
| `has_parts` | BOOLEAN | มีชิ้นส่วนย่อยหรือไม่ |

### ตาราง `equipment_parts` (ชิ้นส่วน)
| Column | Type | Description |
|:---|:---|:---|
| `id` | INT AUTO_INCREMENT PK | รหัสชิ้นส่วน |
| `equipment_type_id` | INT FK | รหัสประเภท |
| `part_name` | VARCHAR(100) | ชื่อชิ้นส่วน |

### ตาราง `equipment` (ทะเบียนครุภัณฑ์)
| Column | Type | Description |
|:---|:---|:---|
| `id` | INT AUTO_INCREMENT PK | รหัสครุภัณฑ์ |
| `equipment_code` | VARCHAR(100) UNIQUE | รหัสครุภัณฑ์ |
| `equipment_name` | VARCHAR(200) | ชื่อครุภัณฑ์ |
| `equipment_type_id` | INT FK | ประเภท |
| `location_building` | VARCHAR(100) | ตึก/อาคาร |
| `location_department` | VARCHAR(100) | ฝ่าย/แผนก |
| `location_room` | VARCHAR(100) | ห้อง |
| `status` | ENUM('active','inactive') | สถานะ |

### ตาราง `repair_requests` (คำแจ้งซ่อม)
| Column | Type | Description |
|:---|:---|:---|
| `id` | INT AUTO_INCREMENT PK | รหัสคำขอ |
| `ticket_number` | VARCHAR(20) UNIQUE | เลขตั๋ว |
| `equipment_id` | INT FK | ครุภัณฑ์ที่แจ้ง |
| `user_id` | INT FK | ผู้แจ้ง (FK → users) |
| `equipment_parts` | TEXT | ชิ้นส่วนที่เลือก |
| `problem_description` | TEXT | อาการที่พบ |
| `requester_name` | VARCHAR(200) | ชื่อผู้แจ้ง |
| `location_building/department/room` | VARCHAR(100) | สถานที่ |
| `priority` | ENUM('urgent','normal','low') | ความเร่งด่วน |
| `image_path` | VARCHAR(500) | ไฟล์รูปประกอบ |
| `status` | VARCHAR(50) | สถานะ (7 สถานะ) |
| `repair_cost` | DECIMAL(10,2) | ค่าใช้จ่าย |
| `cost_note` | TEXT | บันทึกค่าใช้จ่าย |
| `admin_note` | TEXT | บันทึกโดย Admin |
| `requested_at` | TIMESTAMP | วันที่แจ้ง |
| `completed_at` | TIMESTAMP | วันที่เสร็จสิ้น |

**สถานะคำแจ้งซ่อม (7 สถานะ):**
```
pending → (Manager Approve) → in_progress → received → sent_repair → completed → returned
                                                     ↳ cancelled (Manager Reject)
```

### ตาราง `approvals` 🆕 (การอนุมัติโดย Manager)
| Column | Type | Description |
|:---|:---|:---|
| `id` | INT AUTO_INCREMENT PK | รหัส |
| `repair_request_id` | INT FK | รหัสคำแจ้ง |
| `manager_id` | INT FK → users | Manager ผู้อนุมัติ |
| `status` | ENUM('approved','rejected') | ผลการอนุมัติ |
| `note` | TEXT | หมายเหตุ/เหตุผล |
| `created_at` | TIMESTAMP | วันที่อนุมัติ/ปฏิเสธ |

### ตาราง `ratings` 🆕 (การให้คะแนน)
| Column | Type | Description |
|:---|:---|:---|
| `id` | INT AUTO_INCREMENT PK | รหัส |
| `repair_request_id` | INT FK | รหัสคำแจ้ง |
| `user_id` | INT FK → users | ผู้ให้คะแนน |
| `rating` | TINYINT(1-5) | คะแนน 1-5 |
| `comment` | TEXT | ความคิดเห็น |
| `created_at` | TIMESTAMP | วันที่ให้คะแนน |

### ตาราง `status_history` (ประวัติการเปลี่ยนสถานะ)
| Column | Type | Description |
|:---|:---|:---|
| `id` | INT AUTO_INCREMENT PK | รหัส |
| `repair_request_id` | INT FK | รหัสคำแจ้ง |
| `old_status` | VARCHAR(50) | สถานะเดิม |
| `new_status` | VARCHAR(50) | สถานะใหม่ |
| `changed_by` | INT FK → users | ผู้เปลี่ยน |
| `note` | TEXT | หมายเหตุ |
| `changed_at` | TIMESTAMP | วันที่เปลี่ยน |

### ตาราง `notifications` (การแจ้งเตือน)
| Column | Type | Description |
|:---|:---|:---|
| `id` | INT AUTO_INCREMENT PK | รหัส |
| `user_id` | INT FK → users | ผู้รับการแจ้งเตือน |
| `title` | VARCHAR(200) | หัวข้อ |
| `message` | TEXT | ข้อความ |
| `type` | ENUM('info','success','warning','error') | ประเภท |
| `related_type` | VARCHAR(50) | ประเภทที่เกี่ยวข้อง |
| `related_id` | INT | รหัสที่เกี่ยวข้อง |
| `is_read` | TINYINT(1) | อ่านแล้วหรือยัง |
| `created_at` | TIMESTAMP | วันที่สร้าง |

### ตาราง `departments` (แผนก)
| Column | Type | Description |
|:---|:---|:---|
| `id` | INT AUTO_INCREMENT PK | รหัสแผนก |
| `name` | VARCHAR(100) | ชื่อแผนก |
| `description` | TEXT | คำอธิบาย |
| `manager_id` | INT FK → users | Manager ประจำแผนก |

### ตาราง `audit_logs` (ประวัติการกระทำ)
| Column | Type | Description |
|:---|:---|:---|
| `id` | INT AUTO_INCREMENT PK | รหัส |
| `user_id` | INT FK → users | ผู้กระทำ |
| `username` | VARCHAR(100) | ชื่อผู้ใช้ |
| `action` | VARCHAR(100) | การกระทำ |
| `details` | TEXT | รายละเอียด |
| `ip_address` | VARCHAR(45) | IP Address |
| `created_at` | TIMESTAMP | วันที่ |

---

## 🔐 ระบบ Authentication & Authorization

### Authentication
- ใช้ **JWT (JSON Web Token)** ในการยืนยันตัวตน
- Token มีอายุ **8 ชั่วโมง**
- มี Middleware `authMiddleware` ตรวจสอบ token ทุก request
- Endpoint: `POST /api/auth/login`, `POST /api/auth/register`

### Authorization (RBAC) — 3 บทบาท
| บทบาท | สิทธิ์ |
|-------|-------|
| **Admin** | ทุกอย่าง — แดชบอร์ด, จัดการครุภัณฑ์, จัดการผู้ใช้, ดูประวัติทั้งหมด, เปลี่ยนสถานะ, จัดการค่าใช้จ่าย |
| **Manager** | อนุมัติ/ปฏิเสธคำขอซ่อม, ดูคำขอในแผนกตนเอง, ดูประวัติ, แจ้งซ่อม |
| **User** | แจ้งซ่อม, ดูประวัติของตัวเอง, ให้คะแนน ⭐, จัดการโปรไฟล์ |

---

## 🔄 Workflow กระบวนการแจ้งซ่อม (Updated)

```
1. ผู้ใช้ Login
       │
       ├── Admin → home.html (Admin Dashboard)
       ├── Manager → home.html (Manager View)
       └── User → home.html (User View)

2. User: เลือกประเภทครุภัณฑ์ → equipment.html
3. User: ค้นหาครุภัณฑ์ หรือสแกน QR Code
4. User: กด "📝 แจ้งซ่อม" → repair-form.html (auto-fill ข้อมูล)
5. User: กรอกรายละเอียด + กดบันทึก → สถานะ pending

6. 🆕 Manager: ดูคำขอที่ต้องอนุมัติ → อนุมัติ (Approve) / ปฏิเสธ (Reject)
   ├── Approve → สถานะ in_progress → ส่งต่อ Admin
   └── Reject → สถานะ pending (กลับไปให้ผู้ใช้แก้ไข)

7. Admin: ดำเนินการซ่อม → เปลี่ยนสถานะตาม workflow
   pending → in_progress → received → sent_repair → completed → returned

8. 🆕 User: เมื่อสถานะเป็น completed → ให้คะแนน ⭐ (1-5 ดาว)
```

---

## 📡 API Endpoints (สำคัญ)

### Equipment
| Method | Endpoint | Auth | Description |
|:---|:---|:---|:---|
| GET | `/api/equipment` | All | รายการครุภัณฑ์ (filter: type_id, search, room, department, building, status) |
| GET | `/api/equipment/:id` | All | ดึงครุภัณฑ์ตาม ID |
| GET | `/api/equipment/:id/qrcode` 🆕 | All | สร้าง QR Code (SVG) |
| POST | `/api/equipment` | Admin | เพิ่มครุภัณฑ์ |
| PUT | `/api/equipment/:id` | Admin | แก้ไขครุภัณฑ์ |
| DELETE | `/api/equipment/:id` | Admin | ลบครุภัณฑ์ |

### Repair Requests
| Method | Endpoint | Auth | Description |
|:---|:---|:---|:---|
| POST | `/api/repairs` | All | สร้างคำแจ้งซ่อมใหม่ |
| GET | `/api/repairs` | All | รายการคำแจ้ง (filter: status, search, date) |
| GET | `/api/repairs/:id` | All | ดูรายละเอียด + status history + rating |
| PATCH | `/api/repairs/:id/status` | Admin | เปลี่ยนสถานะ |
| DELETE | `/api/repairs/:id` | Admin | ลบคำแจ้ง |
| PUT | `/api/repairs/:id/cost` | Admin | บันทึกค่าใช้จ่าย |

### Manager Approval 🆕
| Method | Endpoint | Auth | Description |
|:---|:---|:---|:---|
| POST | `/api/repairs/:id/approve` | Manager | อนุมัติคำขอ → in_progress |
| POST | `/api/repairs/:id/reject` | Manager | ปฏิเสธคำขอ → pending + เหตุผล |
| GET | `/api/approvals/pending` | Manager | รายการที่รออนุมัติ |

### Rating 🆕
| Method | Endpoint | Auth | Description |
|:---|:---|:---|:---|
| POST | `/api/repairs/:id/rate` | All | ให้คะแนน 1-5 ดาว |
| GET | `/api/ratings/summary` | Admin | สรุปคะแนนเฉลี่ย |

### Notifications
| Method | Endpoint | Auth | Description |
|:---|:---|:---|:---|
| GET | `/api/notifications` | All | ดึงการแจ้งเตือนของ user |
| PATCH | `/api/notifications/:id/read` | All | Mark as read |
| PATCH | `/api/notifications/read-all` | All | Mark all as read |

---

## 🛠️ เทคโนโลยีที่ใช้ (Technology Stack)

### Backend
| Technology | Purpose |
|:---|:---|
| Node.js | Runtime |
| Express.js | Web Framework |
| MySQL2 | Database Driver (Promise-based) |
| Socket.IO | Real-Time WebSocket Communication |
| bcrypt | Password Hashing |
| jsonwebtoken | JWT Authentication |
| multer | File Upload |
| xlsx | Excel File Generation |
| qrcode 🆕 | QR Code Generation (SVG) |
| nodemailer | Email Sending (SMTP) |
| node-cron | Scheduled Tasks (Daily Summary, Reminders) |
| helmet | Security Headers |
| express-rate-limit | Rate Limiting |

### Frontend
| Technology | Purpose |
|:---|:---|
| HTML5 | Structure |
| CSS3 | Styling (Variables, Flexbox, Dark Mode) |
| Vanilla JavaScript | All logic (no frameworks) |
| Socket.IO Client | Real-Time Notifications |
| Chart.js | Dashboard charts |
| Google Fonts | Noto Sans Thai, Space Mono |

---

## 🎨 ระบบ Dark Mode

- ปุ่ม toggle `🌙/☀️` บน Topbar
- ฟังก์ชัน `initDarkMode()` / `toggleDarkMode()` ใน `script.js`
- ใช้ `data-theme` attribute บน `<html>`
- เก็บค่าผ่าน `localStorage('repair_theme')`

---

## 🔧 การติดตั้งและใช้งาน (Setup)

### Requirements
- Node.js (v14+)
- XAMPP (MySQL running on localhost:3306)

### ขั้นตอนการติดตั้ง

```bash
# 1. ติดตั้ง Dependencies
npm install

# 2. เริ่ม XAMPP MySQL

# 3. ตั้งค่าฐานข้อมูล
node setup.js

# 4. รัน Migration สำหรับฟีเจอร์ใหม่ 🆕
mysql -u root repair_system < migration-approval.sql
mysql -u root repair_system < migration-rating.sql

# 5. สร้างข้อมูลทดสอบ (40 รายการ)
node seed-equipment.js

# 6. เริ่มเซิร์ฟเวอร์
npm start

# 7. เปิดเบราว์เซอร์
http://localhost:3000
```

### บัญชีเริ่มต้น
| Username | Password | Role |
|:---|:---|:---|
| admin | admin1234 | Admin (ผู้ดูแลระบบ) |
| manager | manager1234 | Manager (ผู้จัดการ) 🆕 |
| user | user1234 | User (พนักงานทั่วไป) |

---

## 📋 สรุปฟีเจอร์ทั้งหมด

### สำหรับ Admin
- ✅ แดชบอร์ดพร้อมสถิติ + กราฟ (Chart.js)
- ✅ จัดการทะเบียนครุภัณฑ์ (เพิ่ม/ลบ/แก้ไข/ตรวจสอบ) แยกตามประเภท
- ✅ ตัวกรองขั้นสูง: ห้อง, แผนก, ตึก, สถานะ
- ✅ จัดการผู้ใช้ (เพิ่ม/แก้ไข/ลบ/เปลี่ยนสถานะ)
- ✅ ดูประวัติคำแจ้งซ่อมทั้งหมด
- ✅ เปลี่ยนสถานะคำแจ้ง (7 สถานะ)
- ✅ บันทึกค่าใช้จ่ายซ่อม
- ✅ Export เอกสาร Excel / พิมพ์ PDF
- ✅ ดูสรุปคะแนนความพึงพอใจ ⭐ 🆕
- ✅ QR Code สำหรับครุภัณฑ์ 🆕
- ✅ Real-time Notifications 🔔 🆕
- ✅ Dark Mode

### สำหรับ Manager 🆕
- ✅ อนุมัติ/ปฏิเสธคำขอซ่อม
- ✅ ดูคำขอที่รออนุมัติ
- ✅ ดูประวัติการอนุมัติ
- ✅ ดูประวัติคำแจ้งทั้งหมดในแผนก
- ✅ Real-time Notifications 🔔
- ✅ แจ้งซ่อม

### สำหรับ User
- ✅ เลือกประเภทครุภัณฑ์ → equipment.html
- ✅ ค้นหาครุภัณฑ์ด้วยรหัส หรือกรองด้วย ห้อง/แผนก/ตึก/สถานะ
- ✅ สแกน QR Code แจ้งซ่อม 📱 🆕
- ✅ แจ้งซ่อม (เลือกชิ้นส่วน, อัปโหลดรูป, ระบุความเร่งด่วน)
- ✅ ดูประวัติคำแจ้งของตัวเอง
- ✅ ให้คะแนนความพึงพอใจ ⭐ 🆕
- ✅ ดูสถานะและรายละเอียด
- ✅ พิมพ์เอกสารขออนุมัติซ่อม
- ✅ Real-time Notifications 🔔 🆕
- ✅ เมนู Admin ถูกซ่อนอัตโนมัติ

### คุณสมบัติทั่วไป
- ✅ JWT Authentication
- ✅ Role-Based Access Control (3 บทบาท)
- ✅ Socket.IO Real-Time Notifications 🔔
- ✅ Notification Bell พร้อม Badge Count
- ✅ Dark Mode / Light Mode
- ✅ Responsive Design
- ✅ Form Validation
- ✅ QR Code Generator 📱
- ✅ Rating System ⭐
- ✅ Manager Approval Workflow
- ✅ Email Notifications (Gmail SMTP)
- ✅ LINE Notify (optional)
- ✅ Telegram Bot (optional)

---

## 📝 หมายเหตุสำคัญ

1. โปรเจคนี้รันบน Localhost ผ่าน XAMPP เท่านั้น
2. MySQL connection ใช้ root user ไม่มีรหัสผ่าน (development mode)
3. หาก MySQL มีปัญหา: อาจเกิดจาก InnoDB log ไฟล์เสียหาย → แก้ไขโดยลบ `ib_logfile*` และเพิ่ม `skip-slave-start` ใน `my.ini`
4. รัน `node migrate.js` เพื่ออัปเกรดฐานข้อมูล
5. รัน `node seed-equipment.js` เพื่อสร้างข้อมูลครุภัณฑ์ทดสอบ 40 รายการ
6. Gmail SMTP ต้องใช้ App Password 16 หลัก (ไม่ใช่รหัสผ่านปกติ)