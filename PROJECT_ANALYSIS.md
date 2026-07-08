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
│       └────────────┴────────────┴────────┴─ manager-dashboard │ │
│                                                     │            │
│  ┌──────────────────────────────────────────────────┴──────────┐ │
│  │  script.js (1580 lines) - Shared Frontend Logic             │ │
│  │  style.css - Shared Styles (+ Notification CSS)             │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP REST API (JSON + JWT Auth)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SERVER (Node.js + Express)                   │
│  server.js (1365 lines)                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ Auth API     │  │ CRUD API     │  │ Utility                │ │
│  │ - /api/auth/ │  │ - equipment  │  │ - Multer (uploads)     │ │
│  │   login      │  │ - repairs    │  │ - JWT Middleware       │ │
│  │   register   │  │ - users      │  │ - RBAC (3 Roles)       │ │
│  │              │  │ - dashboard  │  │ - Proxy to GAS         │ │
│  │              │  │ - profile    │  │ - XLSX Export          │ │
│  │              │  │ - cost       │  │ - Notifications API    │ │
│  │              │  │ - departments│  │ - Approve/Reject API   │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
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
│  │          │ │     parts      │ │                      │       │
│  └──────────┘ └────────────────┘ └──────────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 โครงสร้างไฟล์ (File Structure)

| ไฟล์/โฟลเดอร์ | ประเภท | คำอธิบาย |
|:---|:---|:---|
| `server.js` | Backend | เซิร์ฟเวอร์หลัก - API, Auth, Middleware, File Upload, Export, Notifications |
| `script.js` | Frontend | ฟังก์ชันหลักทั้งระบบ - Auth, API calls, UI logic, RBAC, Sidebar, Dark Mode |
| `style.css` | Frontend | CSS หลัก - Theme, Topbar, Sidebar, Cards, Forms, Tables, Notifications |
| `schema.sql` | Database | Schema ฐานข้อมูล - สร้างตารางและ Seed Data |
| `setup.js` | Database | สคริปต์ตั้งค่าฐานข้อมูลอัตโนมัติ (`node setup.js`) |
| `migrate.js` | Database | สคริปต์อัปเกรดฐานข้อมูล (เพิ่ม Manager role, notifications, departments) |
| `package.json` | Config | Dependencies และ Scripts |
| `index.html` | Frontend | หน้าเข้าสู่ระบบ (Login) |
| `register.html` | Frontend | หน้าลงทะเบียน |
| `dashboard.html` | Frontend | หน้าแดชบอร์ด (Admin) - สถิติ, กราฟ |
| `manager-dashboard.html` | Frontend | หน้าแดชบอร์ด (Manager) - สถิติ, อนุมัติ/ปฏิเสธ |
| `equipment.html` | Frontend | จัดการทะเบียนครุภัณฑ์แยกตามประเภท (Admin) |
| `equipment-detail.html` | Frontend | ดูรายละเอียดครุภัณฑ์ + แก้ไขข้อมูล (Standalone) |
| `type-select.html` | Frontend | เลือกประเภทครุภัณฑ์เพื่อจัดการ หรือแจ้งซ่อม |
| `repair-form.html` | Frontend | ฟอร์มแจ้งซ่อม |
| `repair-document.html` | Frontend | เอกสารบันทึกข้อความขออนุมัติซ่อม (พิมพ์ PDF) |
| `history.html` | Frontend | ประวัติคำแจ้งซ่อมทั้งหมด (Admin) |
| `my-history.html` | Frontend | ประวัติคำแจ้งซ่อมของตัวเอง (User) |
| `service.html` | Frontend | หน้าดูรายละเอียดและจัดการคำแจ้งซ่อมรายการ |
| `profile.html` | Frontend | หน้าจัดการโปรไฟล์ผู้ใช้ |
| `account-settings.html` | Frontend | หน้าจัดการบัญชี (เปลี่ยนรหัสผ่าน) |
| `user-management.html` | Frontend | จัดการผู้ใช้ (Admin) |
| `uploads/` | Storage | เก็บไฟล์รูปภาพที่อัปโหลด |

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
| `avatar` | VARCHAR(500) | รูปโปรไฟล์ |
| `google_id` | VARCHAR(100) NULL | Google OAuth ID |
| `auth_provider` | ENUM('local','google') | วิธีการเข้าสู่ระบบ |
| `created_at` | TIMESTAMP | วันที่สร้าง |
| `updated_at` | TIMESTAMP | วันที่อัปเดตล่าสุด |

### ตาราง `notifications` (การแจ้งเตือน) — ❗新增
| Column | Type | Description |
|:---|:---|:---|
| `id` | INT AUTO_INCREMENT PK | รหัส |
| `user_id` | INT FK → users | ผู้รับแจ้ง |
| `title` | VARCHAR(200) | หัวข้อ |
| `message` | TEXT | ข้อความ |
| `type` | ENUM('info','success','warning','error') | ประเภท |
| `related_type` | VARCHAR(50) | ประเภทที่เกี่ยวข้อง (repair, equipment) |
| `related_id` | INT | ID ที่เกี่ยวข้อง |
| `is_read` | TINYINT(1) | สถานะอ่านแล้ว |
| `created_at` | TIMESTAMP | วันที่สร้าง |

### ตาราง `departments` (แผนก) — ❗新增
| Column | Type | Description |
|:---|:---|:---|
| `id` | INT AUTO_INCREMENT PK | รหัสแผนก |
| `name` | VARCHAR(100) | ชื่อแผนก |
| `description` | TEXT | คำอธิบาย |
| `manager_id` | INT FK → users | ผู้จัดการแผนก |
| `created_at` | TIMESTAMP | วันที่สร้าง |

### ตาราง `equipment_types` (ประเภทครุภัณฑ์)
| Column | Type | Description |
|:---|:---|:---|
| `id` | INT AUTO_INCREMENT PK | รหัสประเภท |
| `name` | VARCHAR(100) | ชื่อประเภท (เช่น คอมพิวเตอร์, เครื่องถ่ายเอกสาร) |
| `description` | TEXT | คำอธิบาย |
| `has_parts` | BOOLEAN | มีชิ้นส่วนย่อยหรือไม่ |

### ตาราง `equipment_parts` (ชิ้นส่วน)
| Column | Type | Description |
|:---|:---|:---|
| `id` | INT AUTO_INCREMENT PK | รหัสชิ้นส่วน |
| `equipment_type_id` | INT FK → equipment_types | รหัสประเภท |
| `part_name` | VARCHAR(100) | ชื่อชิ้นส่วน (เช่น CPU, RAM) |

### ตาราง `equipment` (ทะเบียนครุภัณฑ์)
| Column | Type | Description |
|:---|:---|:---|
| `id` | INT AUTO_INCREMENT PK | รหัสครุภัณฑ์ |
| `equipment_code` | VARCHAR(100) UNIQUE | รหัสครุภัณฑ์ (เช่น COM-001) |
| `equipment_name` | VARCHAR(200) | ชื่อครุภัณฑ์ |
| `equipment_type_id` | INT FK → equipment_types | ประเภท |
| `location_building` | VARCHAR(100) | ตึก/อาคาร |
| `location_department` | VARCHAR(100) | ฝ่าย/แผนก |
| `location_room` | VARCHAR(100) | ห้อง |
| `status` | ENUM('active','inactive') | สถานะ |

### ตาราง `repair_requests` (คำแจ้งซ่อม)
| Column | Type | Description |
|:---|:---|:---|
| `id` | INT AUTO_INCREMENT PK | รหัสคำขอ |
| `ticket_number` | VARCHAR(20) UNIQUE | เลขตั๋ว (เช่น REP-20260626-1234) |
| `equipment_id` | INT FK → equipment | ครุภัณฑ์ที่แจ้ง |
| `equipment_parts` | TEXT | ชิ้นส่วนที่เลือก |
| `problem_description` | TEXT | อาการที่พบ |
| `requester_name` | VARCHAR(200) | ชื่อผู้แจ้ง |
| `department_id` | INT FK → departments | แผนก (❗新增) |
| `approved_by` | INT FK → users | ผู้อนุมัติ (❗新增) |
| `approved_at` | TIMESTAMP | วันที่อนุมัติ (❗新增) |
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
pending → in_progress → received → sent_repair → completed → returned
                                                    ↳ cancelled
```

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

---

## 🔐 ระบบ Authentication & Authorization

### Authentication
- ใช้ **JWT (JSON Web Token)** ในการยืนยันตัวตน
- Token มีอายุ **8 ชั่วโมง**
- SECRET KEY: กำหนดผ่าน Environment Variable `JWT_SECRET` หรือใช้ค่า default
- มี Middleware `authMiddleware` ตรวจสอบ token ทุก request
- Endpoint: `POST /api/auth/login`, `POST /api/auth/register`

### Authorization (RBAC) — 3 บทบาท
- **Admin**: เข้าถึงทุกหน้า — แดชบอร์ด, จัดการครุภัณฑ์, จัดการผู้ใช้, จัดการแผนก, ดูประวัติทั้งหมด, เปลี่ยนสถานะ, จัดการค่าใช้จ่าย
- **Manager**: เข้าถึง Manager Dashboard, อนุมัติ/ปฏิเสธคำขอซ่อม, ดูคำขอในแผนกตนเอง
- **User**: เข้าถึงจำกัด — เลือกประเภท, แจ้งซ่อม, ดูประวัติของตัวเอง, จัดการโปรไฟล์

---

## 🔄 Workflow กระบวนการแจ้งซ่อม (แบบใหม่)

```
1. ผู้ใช้ Login
       │
       ├── Admin → dashboard.html
       ├── Manager → manager-dashboard.html
       └── User → type-select.html

2. User: เลือกประเภทครุภัณฑ์ (type-select.html) → equipment.html?type_id=X
3. Admin: จัดการครุภัณฑ์แยกตามประเภท (equipment.html + equipment-detail.html)
4. User: แจ้งซ่อม → สถานะ pending

5. Manager: ดูคำขอ pending → อนุมัติ (approve) / ปฏิเสธ (reject)
   - อนุมัติ → สถานะ in_progress → แจ้งเตือน Admin
   - ปฏิเสธ → สถานะ cancelled

6. Admin: ดำเนินการต่อ:
   - เปลี่ยนสถานะ (7 สถานะ)
   - บันทึกค่าใช้จ่าย
   - Export Excel / พิมพ์ PDF
```

---

## 📡 API Endpoints (ทั้งหมด 40+ Routes)

### Authentication
| Method | Endpoint | Auth | Description |
|:---|:---|:---|:---|
| POST | `/api/auth/login` | Public | เข้าสู่ระบบ |
| POST | `/api/auth/register` | Public | ลงทะเบียน |

### Dashboard
| Method | Endpoint | Auth | Description |
|:---|:---|:---|:---|
| GET | `/api/dashboard/stats` | Admin | สถิติแดชบอร์ด |
| GET | `/api/manager/stats` | Manager/Admin | สถิติผู้จัดการ |

### Equipment
| Method | Endpoint | Auth | Description |
|:---|:---|:---|:---|
| GET | `/api/equipment` | All | รายการครุภัณฑ์ (filter: type_id, search) |
| GET | `/api/equipment/:id` | All | ดึงครุภัณฑ์ตาม ID (❗新增) |
| POST | `/api/equipment` | Admin | เพิ่มครุภัณฑ์ |
| PUT | `/api/equipment/:id` | Admin | แก้ไขครุภัณฑ์ (❗新增) |
| DELETE | `/api/equipment/:id` | Admin | ลบครุภัณฑ์ (soft delete) |
| GET | `/api/equipment/code/:code` | All | ค้นหาครุภัณฑ์ด้วยรหัส |

### Equipment Types
| Method | Endpoint | Auth | Description |
|:---|:---|:---|:---|
| GET | `/api/equipment-types` | All | รายการประเภทครุภัณฑ์ (รวม parts) |

### Repair Requests
| Method | Endpoint | Auth | Description |
|:---|:---|:---|:---|
| POST | `/api/repairs` | All | สร้างคำแจ้งซ่อมใหม่ |
| GET | `/api/repairs` | All/Admin | รายการคำแจ้ง |
| GET | `/api/repairs/:id` | All | ดูรายละเอียด + status history |
| PATCH | `/api/repairs/:id/status` | Admin | เปลี่ยนสถานะ |
| DELETE | `/api/repairs/:id` | Admin | ลบคำแจ้ง |
| PUT | `/api/repairs/:id/cost` | Admin | บันทึกค่าใช้จ่าย |
| GET | `/api/repairs/:id/cost` | All | ดูข้อมูลค่าใช้จ่าย |
| POST | `/api/repairs/:id/approve` | Manager/Admin | อนุมัติคำขอ (❗新增) |
| POST | `/api/repairs/:id/reject` | Manager/Admin | ปฏิเสธคำขอ (❗新增) |

### Notifications
| Method | Endpoint | Auth | Description |
|:---|:---|:---|:---|
| GET | `/api/notifications` | All | ดึงการแจ้งเตือน (❗新增) |
| PATCH | `/api/notifications/read/:id` | All | อ่านแล้ว (❗新增) |
| PATCH | `/api/notifications/read-all` | All | อ่านทั้งหมด (❗新增) |

### Departments
| Method | Endpoint | Auth | Description |
|:---|:---|:---|:---|
| GET | `/api/departments` | All | รายการแผนก (❗新增) |
| POST | `/api/departments` | Admin | เพิ่มแผนก (❗新增) |
| PUT | `/api/departments/:id` | Admin | แก้ไขแผนก (❗新增) |
| DELETE | `/api/departments/:id` | Admin | ลบแผนก (❗新增) |

### User Management
| Method | Endpoint | Auth | Description |
|:---|:---|:---|:---|
| GET | `/api/users` | Admin | รายการผู้ใช้ |
| GET | `/api/users/:id` | Admin | ดูข้อมูลผู้ใช้ |
| POST | `/api/users` | Admin | สร้างผู้ใช้ใหม่ |
| PUT | `/api/users/:id` | Admin | แก้ไขผู้ใช้ |
| PATCH | `/api/users/:id/status` | Admin | เปลี่ยนสถานะ |
| DELETE | `/api/users/:id` | Admin | ลบผู้ใช้ |

### Profile
| Method | Endpoint | Auth | Description |
|:---|:---|:---|:---|
| GET | `/api/profile` | All | ดูโปรไฟล์ตัวเอง |
| PUT | `/api/profile` | All | แก้ไขโปรไฟล์ |
| POST | `/api/profile/avatar` | All | อัปโหลดรูปโปรไฟล์ |
| POST | `/api/profile/change-password` | All | เปลี่ยนรหัสผ่าน |

### Reports & Export
| Method | Endpoint | Auth | Description |
|:---|:---|:---|:---|
| GET | `/api/reports/cost-summary` | Admin | สรุปค่าใช้จ่าย |
| GET | `/api/export-repair-doc/:id` | All | Export Excel (.xlsx) |

### Utility
| Method | Endpoint | Auth | Description |
|:---|:---|:---|:---|
| POST | `/api/proxy-gas` | All | Proxy ไป Google Apps Script |

---

## 🛠️ เทคโนโลยีที่ใช้ (Technology Stack)

### Backend
| Technology | Version | Purpose |
|:---|:---|:---|
| Node.js | - | Runtime |
| Express.js | ^4.18.2 | Web Framework |
| MySQL2 | ^3.6.5 | Database Driver (Promise-based) |
| bcrypt | ^5.1.1 | Password Hashing |
| jsonwebtoken | ^9.0.2 | JWT Authentication |
| multer | ^1.4.5 | File Upload |
| cors | ^2.8.5 | Cross-Origin Resource Sharing |
| xlsx | ^0.18.5 | Excel File Generation |

### Frontend
| Technology | Purpose |
|:---|:---|
| HTML5 | Structure |
| CSS3 | Styling (CSS Variables, Flexbox, Glassmorphism, Dark Mode) |
| Vanilla JavaScript | All application logic (no frameworks) |
| Chart.js | Dashboard charts |
| Google Fonts (Noto Sans Thai, Sarabun, Space Mono) | Typography |

### Infrastructure
| Technology | Purpose |
|:---|:---|
| XAMPP | Local MySQL & Apache |
| MySQL | Database Server |
| Localhost:3000 | Application Server |

---

## 🎨 ระบบ Dark Mode

ระบบรองรับ **Dark Mode** ผ่าน CSS Variables และ JavaScript:
- ปุ่ม toggle `🌙/☀️` บน Topbar
- ฟังก์ชัน `initDarkMode()` / `toggleDarkMode()` ใน `script.js`
- ใช้ `data-theme` attribute บน `<html>` เปลี่ยนค่าตัวแปร CSS ทั้งหมด
- เก็บค่าผ่าน `localStorage('repair_theme')`
- มี Transition animation 0.3s

---

## 🧭 ระบบ Navigation

### Topbar (ทุกหน้า)
- เมนูลัด: แดชบอร์ด, ผู้จัดการ, ครุภัณฑ์, ประเภท, แจ้งซ่อม, ประวัติ
- ปุ่ม Dark Mode toggle
- ปุ่ม 🔔 แจ้งเตือน
- ชื่อ + บทบาทผู้ใช้ (Admin/Manager/User)

### Sidebar
- Fixed 250px ด้านซ้าย
- แบ่งเป็นหมวด: การจัดการ, งานหลัก, บัญชีของฉัน, ผู้ดูแลระบบ
- `admin-only` — ซ่อนสำหรับ User
- `manager-only` — ซ่อนสำหรับ User

---

## 📄 เอกสารขออนุมัติซ่อม (repair-document.html)

หน้าเอกสารบันทึกข้อความขออนุมัติซ่อมบำรุง:
- รองรับการพิมพ์ (A4, margin 2.54cm)
- มีข้อมูลครบตามฟอร์มราชการ
- Export Excel ผ่าน API `/api/export-repair-doc/:id`
- Auto-fill จาก localStorage `repair_document_single`
- ฟังก์ชัน `numberToThaiText()` แปลงตัวเลขเป็นภาษาไทย

---

## 🔧 การติดตั้งและใช้งาน (Setup)

### Requirements
- Node.js (v14+)
- XAMPP (MySQL running on localhost:3306)

### ขั้นตอนการติดตั้ง

```bash
# 1. ติดตั้ง Dependencies
cd c:\xampp\htdocs\my-project
npm install

# 2. เริ่ม XAMPP MySQL

# 3. ตั้งค่าฐานข้อมูล
node setup.js

# 4. อัปเกรดฐานข้อมูล (เพิ่ม Manager role, notifications, departments)
node migrate.js

# 5. เริ่มเซิร์ฟเวอร์
npm start

# 6. เปิดเบราว์เซอร์
http://localhost:3000
```

### บัญชีเริ่มต้น
| Username | Password | Role |
|:---|:---|:---|
| admin | admin1234 | Admin (ผู้ดูแลระบบ) |
| user | user1234 | User (พนักงานทั่วไป) |

---

## 📋 สรุปฟีเจอร์ทั้งหมด

### สำหรับ Admin
- ✅ แดชบอร์ดพร้อมสถิติ + กราฟ (Chart.js)
- ✅ จัดการทะเบียนครุภัณฑ์ (เพิ่ม/ลบ/แก้ไข/ตรวจสอบ) แยกตามประเภท
- ✅ equipment-detail.html — ดูข้อมูลครุภัณฑ์ + แก้ไขในหน้าเดียว
- ✅ จัดการผู้ใช้ (เพิ่ม/แก้ไข/ลบ/เปลี่ยนสถานะ) + ตั้งค่า Manager
- ✅ จัดการแผนก (เพิ่ม/แก้ไข/ลบ)
- ✅ ดูประวัติคำแจ้งซ่อมทั้งหมด
- ✅ เปลี่ยนสถานะคำแจ้ง (7 สถานะ)
- ✅ อนุมัติ/ปฏิเสธคำขอซ่อม
- ✅ บันทึกค่าใช้จ่ายซ่อม
- ✅ Export เอกสาร Excel
- ✅ พิมพ์เอกสารขออนุมัติซ่อม (PDF)
- ✅ กรองข้อมูลตามวันที่
- ✅ ระบบแจ้งเตือน (Notification Bell 🔔)
- ✅ Proxy ไป Google Apps Script
- ✅ อัปโหลดรูปโปรไฟล์

### สำหรับ Manager (❗新增)
- ✅ Manager Dashboard — สถิติเฉพาะทีม
- ✅ อนุมัติ/ปฏิเสธคำขอซ่อม
- ✅ ดูประวัติคำขอในแผนกตนเอง
- ✅ ระบบแจ้งเตือน

### สำหรับ User
- ✅ ลงทะเบียน
- ✅ แก้ไขโปรไฟล์ + อัปโหลดรูป
- ✅ เลือกประเภทครุภัณฑ์ → equipment.html
- ✅ ค้นหาครุภัณฑ์ด้วยรหัส
- ✅ แจ้งซ่อม (เลือกชิ้นส่วน, อัปโหลดรูป, ระบุความเร่งด่วน)
- ✅ ดูประวัติคำแจ้งของตัวเอง
- ✅ ดูสถานะและรายละเอียด
- ✅ พิมพ์เอกสารขออนุมัติซ่อม

### คุณสมบัติทั่วไป
- ✅ JWT Authentication
- ✅ Role-Based Access Control (3 บทบาท)
- ✅ Dark Mode / Light Mode
- ✅ Responsive Design (Desktop + Mobile)
- ✅ Form Validation
- ✅ Code Formatting (รหัสครุภัณฑ์รูปแบบ XXXX-XXX-XXXX/XX/XX)
- ✅ Thai Bath Text Conversion
- ✅ Ticket Number Auto-Generation
- ✅ Soft Delete (เปลี่ยน status แทนการลบจริง)
- ✅ ระบบแจ้งเตือนแบบเรียลไทม์
- ✅ หน้า equipment-detail.html แบบ Standalone (ไม่พึ่ง script.js)

---

## 📝 หมายเหตุสำคัญ

1. โปรเจคนี้รันบน Localhost ผ่าน XAMPP เท่านั้น ไม่ได้ deploy บน cloud
2. MySQL connection ใช้ root user ไม่มีรหัสผ่าน (development mode)
3. รัน `node migrate.js` เพื่ออัปเกรดฐานข้อมูล (เพิ่ม Manager role, notifications, departments)
4. หน้า equipment-detail.html ถูกเขียนแบบ **Standalone** — ไม่พึ่งฟังก์ชันจาก script.js
5. ระบบแจ้งเตือน (Notification) รองรับ Admin และ Manager
6. รูปครุฑใช้ไฟล์ `uploads/garuda-logo.png`
7. ฟอร์มแจ้งซ่อมรองรับรูปแบบรหัสครุภัณฑ์แบบกำหนดเอง: `XXXX-XXX-XXXX/XX/XX`