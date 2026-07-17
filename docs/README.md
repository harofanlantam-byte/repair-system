# ระบบเว็บแจ้งซ่อมครุภัณฑ์ (Repair Management System)

ระบบเว็บแอปพลิเคชันสำหรับจัดการคำแจ้งซ่อมครุภัณฑ์ของหน่วยงาน  
**โรงพยาบาลเหนือคลอง อำเภอเหนือคลอง จังหวัดกระบี่**

---

## 📋 ความต้องการของระบบ (Requirements)

| รายการ | รายละเอียด |
|:---|:---|
| **Node.js** | version 14 ขึ้นไป (ดาวน์โหลด: https://nodejs.org) |
| **XAMPP** | สำหรับรัน MySQL (ดาวน์โหลด: https://www.apachefriends.org) |
| **Git** | สำหรับ Clone โปรเจค (ดาวน์โหลด: https://git-scm.com/download/win) |
| **เบราว์เซอร์** | Chrome, Edge, Firefox |

---

## ⬇️ ขั้นตอนการติดตั้งบนเครื่องใหม่ (ทีละขั้นตอน)

### ขั้นตอนที่ 1: Clone โปรเจคจาก GitHub

เปิด **Command Prompt** หรือ **Terminal** แล้วพิมพ์:

```cmd
cd Desktop
git clone https://github.com/harofanlantam-byte/repair-system.git
cd repair-system
```

> ✅ เสร็จแล้วจะได้โฟลเดอร์ `repair-system` บน Desktop

### ขั้นตอนที่ 2: ติดตั้ง Dependencies

```cmd
npm install
```

> ⏳ รอจนกว่าจะ安装เสร็จ (อาจใช้เวลา 1-2 นาที)

### ขั้นตอนที่ 3: เปิด MySQL (XAMPP)

1. เปิด **XAMPP Control Panel**
2. คลิกปุ่ม **Start** ที่ **MySQL**
3. ถ้าขึ้นไฟเขียว แสดงว่า MySQL พร้อมใช้งานแล้ว ✅

### ขั้นตอนที่ 4: สร้างฐานข้อมูล

```cmd
node setup.js
```

จากนั้นรัน:

```cmd
node migrate.js
```

> ✅ ฐานข้อมูล `repair_system` จะถูกสร้างพร้อมตารางทั้งหมด

### ขั้นตอนที่ 5: เริ่มเซิร์ฟเวอร์

```cmd
npm start
```

> ✅ จะเห็นข้อความ: `🚀 Server รันที่ http://localhost:3000`

### ขั้นตอนที่ 6: เปิดเว็บไซต์

เปิดเบราว์เซอร์ไปที่: **http://localhost:3000**

---

## 🔑 บัญชีผู้ใช้เริ่มต้น

| ชื่อผู้ใช้ | รหัสผ่าน | บทบาท |
|:---|:---|:---|
| **admin** | **admin1234** | Admin (ผู้ดูแลระบบ) |

> **⚠️ หมายเหตุ:** ระบบนี้เป็น **Admin Only** — เฉพาะผู้ดูแลระบบเท่านั้นที่เข้าใช้งานได้

---

## 📄 หน้าเว็บต่างๆ

| URL | คำอธิบาย |
|:---|:---|
| `http://localhost:3000` | หน้า Login |
| `http://localhost:3000/dashboard.html` | แดชบอร์ด - สถิติ + กราฟ |
| `http://localhost:3000/equipment.html` | จัดการครุภัณฑ์ |
| `http://localhost:3000/type-select.html` | เลือกประเภทครุภัณฑ์ |
| `http://localhost:3000/repair-form.html` | ฟอร์มแจ้งซ่อม |
| `http://localhost:3000/history.html` | ประวัติคำแจ้งซ่อมทั้งหมด |
| `http://localhost:3000/service.html?id=1` | รายละเอียด + จัดการสถานะ |
| `http://localhost:3000/profile.html` | โปรไฟล์ผู้ใช้ |
| `http://localhost:3000/account-settings.html` | เปลี่ยนรหัสผ่าน |
| `http://localhost:3000/repair-document.html` | เอกสารขออนุมัติซ่อม (PDF) |

---

## 🔄 การอัปเดตโค้ดเวอร์ชันใหม่จาก GitHub

เมื่อมีคนแก้ไขโค้ดและอัปโหลดขึ้น GitHub แล้ว ให้ทำตามนี้:

```cmd
cd Desktop\repair-system
git pull
npm install
npm start
```

> 🔄 คำสั่ง `git pull` จะดึงโค้ดเวอร์ชันล่าสุดจาก GitHub มาใช้

---

## ⚠️ ปัญหาที่พบบ่อยและการแก้ไข

### ❌ `'git' is not recognized`
**สาเหตุ:** ยังไม่ได้ติดตั้ง Git หรือยังไม่ได้เปิด Terminal ใหม่  
**วิธีแก้:** 
- ติดตั้ง Git จาก https://git-scm.com/download/win
- ปิด Command Prompt แล้วเปิดใหม่

### ❌ `ECONNREFUSED` หรือ "ไม่สามารถเชื่อมต่อฐานข้อมูล"
**สาเหตุ:** MySQL ยังไม่ได้เปิด  
**วิธีแก้:**
- เปิด XAMPP Control Panel
- คลิก **Start** ที่ MySQL

### ❌ `npm install` error
**สาเหตุ:** ไฟล์เสียหรือ网络ขัดข้อง  
**วิธีแก้:**
```cmd
rmdir /s node_modules
npm install
```

### ❌ "ฐานข้อมูล repair_system ไม่มี"
**สาเหตุ:** ยังไม่ได้รัน setup.js  
**วิธีแก้:**
```cmd
node setup.js
node migrate.js
```

### ❌ Token GitHub หมดอายุ
**สาเหตุ:** Personal Access Token หมดอายุ  
**วิธีแก้:**
- ไปที่ https://github.com/settings/tokens
- สร้าง Token ใหม่ (classic)
- ติ๊ก ✅ repo
- Generate แล้วใช้ Token ใหม่

---

## 🛠️ สำหรับ Developer: อัปเดตโค้ดขึ้น GitHub

เมื่อแก้ไขโค้ดเสร็จและต้องการ Backup ขึ้น GitHub:

```cmd
cd C:\Users\GIGABYTE\Desktop\น้องฝึกงาน\project.3
set PATH=%PATH%;C:\Program Files\Git\bin

git add .
git commit -m "อธิบายสิ่งที่แก้ไข เช่น แก้ไขบัค profile route"
git push
```

> 💡 **แนะนำ:** ให้ commit ทุกครั้งหลังจากแก้ไขเสร็จ เพื่อให้มีประวัติการเปลี่ยนแปลง

---

## 📁 โครงสร้างไฟล์ที่สำคัญ

```
project.3/
├── server.js              # Backend (API, Auth, Database)
├── script.js              # Frontend (ฟังก์ชันหลักทั้งระบบ)
├── style.css              # ตกแต่งหน้าเว็บ
├── index.html             # หน้า Login
├── dashboard.html         # แดชบอร์ด Admin
├── equipment.html         # จัดการครุภัณฑ์
├── equipment-detail.html  # รายละเอียดครุภัณฑ์
├── type-select.html       # เลือกประเภท
├── repair-form.html       # ฟอร์มแจ้งซ่อม
├── repair-document.html   # เอกสารขออนุมัติซ่อม
├── history.html           # ประวัติทั้งหมด
├── service.html           # รายละเอียดคำแจ้งซ่อม
├── profile.html           # โปรไฟล์
├── account-settings.html  # ตั้งค่าบัญชี
├── schema.sql             # โครงสร้างฐานข้อมูล
├── setup.js               # สคริปต์สร้างฐานข้อมูล
├── migrate.js             # สคริปต์อัปเกรดฐานข้อมูล
├── package.json           # รายการ dependencies
└── .env                   # ตั้งค่า Database
```

---

## 🔗 ลิงก์สำคัญ

| รายการ | ลิงก์ |
|:---|:---|
| GitHub Repository | https://github.com/harofanlantam-byte/repair-system |
| Node.js | https://nodejs.org |
| XAMPP | https://www.apachefriends.org |
| Git | https://git-scm.com/download/win |

---

```
🎉 ระบบพร้อมใช้งาน! หากพบปัญหากรุณาติดต่อผู้ดูแลระบบ