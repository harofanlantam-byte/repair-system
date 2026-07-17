# 📊 ER Diagram - ระบบแจ้งซ่อมครุภัณฑ์ (Database: repair_system)

```mermaid
erDiagram
    users ||--o{ repair_requests : "แจ้งซ่อม (requester_name)"
    users ||--o{ status_history : "เปลี่ยนสถานะ (changed_by)"
    equipment_types ||--|{ equipment : "จัดประเภท"
    equipment_types ||--|{ equipment_parts : "มีชิ้นส่วน"
    equipment ||--o{ repair_requests : "ถูกแจ้งซ่อม"
    repair_requests ||--o{ status_history : "มีประวัติ"

    users {
        INT id PK "รหัสผู้ใช้"
        VARCHAR username UK "ชื่อผู้ใช้"
        VARCHAR password "รหัสผ่าน (bcrypt)"
        VARCHAR full_name "ชื่อ-นามสกุล"
        ENUM role "admin | user"
        ENUM status "active | inactive"
        VARCHAR email "อีเมล"
        VARCHAR phone "เบอร์โทร"
        VARCHAR avatar "รูปโปรไฟล์"
        TIMESTAMP created_at "วันที่สร้าง"
        TIMESTAMP updated_at "อัปเดตล่าสุด"
    }

    equipment_types {
        INT id PK "รหัสประเภท"
        VARCHAR name "ชื่อประเภท"
        TEXT description "คำอธิบาย"
        BOOLEAN has_parts "มีชิ้นส่วนย่อย?"
        TIMESTAMP created_at "วันที่สร้าง"
    }

    equipment_parts {
        INT id PK "รหัสชิ้นส่วน"
        INT equipment_type_id FK "FK → equipment_types"
        VARCHAR part_name "ชื่อชิ้นส่วน"
    }

    equipment {
        INT id PK "รหัสครุภัณฑ์"
        VARCHAR equipment_code UK "รหัสครุภัณฑ์"
        VARCHAR equipment_name "ชื่อครุภัณฑ์"
        INT equipment_type_id FK "FK → equipment_types"
        VARCHAR location_building "ตึก/อาคาร"
        VARCHAR location_department "ฝ่าย/แผนก"
        VARCHAR location_room "ห้อง"
        ENUM status "active | inactive"
        TIMESTAMP created_at "วันที่สร้าง"
        TIMESTAMP updated_at "อัปเดตล่าสุด"
    }

    repair_requests {
        INT id PK "รหัสคำขอ"
        VARCHAR ticket_number UK "เลขตั๋ว (REP-YYYYMMDD-XXXX)"
        INT equipment_id FK "FK → equipment"
        TEXT equipment_parts "ชิ้นส่วนที่เลือก"
        TEXT problem_description "อาการที่พบ"
        VARCHAR requester_name "ชื่อผู้แจ้ง"
        VARCHAR location_building "ตึก/อาคาร"
        VARCHAR location_department "ฝ่าย/แผนก"
        VARCHAR location_room "ห้อง"
        ENUM priority "urgent | normal | low"
        VARCHAR image_path "ไฟล์รูปประกอบ"
        VARCHAR status "pending|in_progress|received|sent_repair|completed|returned|cancelled"
        DECIMAL repair_cost "ค่าใช้จ่ายซ่อม"
        TEXT cost_note "บันทึกค่าใช้จ่าย"
        TEXT admin_note "บันทึกโดย Admin"
        TIMESTAMP requested_at "วันที่แจ้ง"
        TIMESTAMP updated_at "อัปเดตล่าสุด"
        TIMESTAMP completed_at "วันที่เสร็จสิ้น"
    }

    status_history {
        INT id PK "รหัส"
        INT repair_request_id FK "FK → repair_requests"
        VARCHAR old_status "สถานะเดิม"
        VARCHAR new_status "สถานะใหม่"
        INT changed_by FK "FK → users"
        TEXT note "หมายเหตุ"
        TIMESTAMP changed_at "วันที่เปลี่ยน"
    }
```

---

## 🔗 ความสัมพันธ์ระหว่างตาราง (Relationships)

| Parent (ต้นทาง) | Child (ปลายทาง) | Cardinality | FK Column | Description |
|:---|:---|:---|:---|:---|
| `equipment_types` | `equipment` | 1 : N | `equipment_type_id` | ครุภัณฑ์แต่ละชิ้นมีประเภทเดียว |
| `equipment_types` | `equipment_parts` | 1 : N | `equipment_type_id` | แต่ละประเภทมีได้หลายชิ้นส่วน |
| `equipment` | `repair_requests` | 1 : N | `equipment_id` | ครุภัณฑ์หนึ่งชิ้นถูกแจ้งซ่อมได้หลายครั้ง |
| `users` | `repair_requests` | 1 : N | `requester_name` | ผู้ใช้แจ้งซ่อมได้หลายครั้ง (link by name) |
| `users` | `status_history` | 1 : N | `changed_by` | Admin เปลี่ยนสถานะได้หลายครั้ง |
| `repair_requests` | `status_history` | 1 : N | `repair_request_id` | แต่ละคำขอมีประวัติการเปลี่ยนสถานะ |

---

## 📊 สถานะคำแจ้งซ่อม (Status Flow)

```mermaid
stateDiagram-v2
    [*] --> pending : สร้างคำแจ้งซ่อมใหม่
    pending --> in_progress : Admin รับเรื่อง
    in_progress --> received : รับงานเข้าซ่อม
    received --> sent_repair : ส่งซ่อมภายนอก
    sent_repair --> completed : ซ่อมเสร็จ
    completed --> returned : คืนครุภัณฑ์
    pending --> cancelled : ยกเลิก
    in_progress --> cancelled : ยกเลิก
    received --> cancelled : ยกเลิก
    sent_repair --> cancelled : ยกเลิก
    returned --> [*]
    cancelled --> [*]

    note right of pending : User สร้างคำแจ้ง
    note right of completed : Admin บันทึกค่าใช้จ่าย