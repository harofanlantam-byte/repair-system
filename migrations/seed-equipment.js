// =============================================
// Seed Script: เพิ่มครุภัณฑ์สุ่ม 10 รายการต่อประเภท (4 ประเภท = 40 รายการ)
// รันด้วย: node seed-equipment.js
// =============================================

require('dotenv').config();
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'repair_system',
  charset: 'utf8mb4'
};

// ข้อมูลสุ่ม
const buildings = ['อาคาร A', 'อาคาร B', 'อาคาร C', 'อาคาร D', 'อาคารผู้ป่วยนอก', 'อาคารอำนวยการ'];
const departments = ['ฝ่ายการเงิน', 'ฝ่ายบุคคล', 'ฝ่ายไอที', 'ฝ่ายเภสัช', 'ฝ่ายการพยาบาล', 'ฝ่ายเวชระเบียน', 'สำนักงานกลาง', 'งานซ่อมบำรุง', 'ฝ่ายรังสี', 'ห้องปฏิบัติการ'];
const rooms = ['101', '102', '103', '201', '202', '203', '301', '302', '105', '106', 'B01', 'B02', '401', '402'];

// ข้อมูลต่อประเภท
const types = [
  {
    id: 1,
    name: 'คอมพิวเตอร์',
    brands: ['Dell Optiplex', 'HP ProDesk', 'Lenovo ThinkCentre', 'Acer Veriton', 'ASUS ExpertCenter', 'Dell Inspiron', 'HP EliteDesk', 'Lenovo IdeaCentre', 'Acer Aspire', 'Custom Build'],
    models: ['7090', '400 G7', 'M720q', 'X4660G', 'D500MA', '3510', '800 G6', '3 27IMB05', 'TC-1760', 'Ryzen5'],
    codePrefix: 'COM'
  },
  {
    id: 2,
    name: 'เครื่องถ่ายเอกสาร',
    brands: ['Ricoh', 'Canon', 'Xerox', 'Sharp', 'Kyocera', 'Brother', 'Toshiba', 'Konica Minolta', 'HP LaserJet', 'Samsung'],
    models: ['MP2014', 'iR-ADV C3520', 'WorkCentre 6515', 'MX-4070N', 'TASKalfa 3051ci', 'MFC-L6900DW', 'e-STUDIO 4518A', 'bizhub C300i', 'MFP M479fdw', 'SCX-8230NA'],
    codePrefix: 'COP'
  },
  {
    id: 3,
    name: 'UPS',
    brands: ['APC', 'CyberPower', 'Eaton', 'Tripp Lite', 'Vertiv', 'Schneider', 'Legrand', 'Delta', 'Santak', 'Zircon'],
    models: ['BR1500GI', 'CP1500AVRLCD', '5PX1500RT', 'SMART1500LCD', 'GXT5-1500IRT', 'SUA1500I', '1500VA', 'N-series 2KVA', 'C2K', 'UPS-2000VA'],
    codePrefix: 'UPS'
  },
  {
    id: 4,
    name: 'Router',
    brands: ['Cisco', 'MikroTik', 'TP-Link', 'D-Link', 'Juniper', 'Ubiquiti', 'Huawei', 'Netgear', 'Asus', 'Zyxel'],
    models: ['RV340', 'RB4011', 'TL-ER7206', 'DSR-1000AC', 'SRX300', 'EdgeRouter 4', 'AR1220E', 'BR200', 'RT-AC88U', 'USG Flex 200'],
    codePrefix: 'RTR'
  }
];

function random(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomCode(prefix, index) {
  const num = String(index).padStart(3, '0');
  return `${prefix}-${num}`;
}

async function seed() {
  let db;
  try {
    db = await mysql.createConnection(dbConfig);
    console.log('✅ เชื่อมต่อฐานข้อมูลสำเร็จ\n');

    // ล้างข้อมูลเดิมตามลำดับ foreign key
    console.log('🗑️ กำลังล้างข้อมูลเดิม...');
    await db.execute('DELETE FROM status_history');
    await db.execute('DELETE FROM repair_requests');
    await db.execute('DELETE FROM equipment');
    console.log('✅ ล้างข้อมูลครุภัณฑ์, คำแจ้งซ่อม และประวัติ เสร็จสิ้น\n');

    let totalInserted = 0;

    for (const type of types) {
      console.log(`📦 กำลังสร้างครุภัณฑ์ประเภท: ${type.name} (10 รายการ)...`);

      for (let i = 1; i <= 10; i++) {
        const code = randomCode(type.codePrefix, i);
        const brand = random(type.brands);
        const model = random(type.models);
        const name = `${type.name} ${brand} ${model}`;
        const building = random(buildings);
        const department = random(departments);
        const room = random(rooms);

        await db.execute(
          'INSERT INTO equipment (equipment_code, equipment_name, equipment_type_id, location_building, location_department, location_room, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [code, name, type.id, building, department, room, 'active']
        );

        console.log(`  ✅ [${code}] ${name} → ${building} / ${department} / ห้อง ${room}`);
        totalInserted++;
      }
      console.log('');
    }

    console.log('========================================');
    console.log(`🎉 เสร็จสิ้น! เพิ่มครุภัณฑ์ทั้งหมด ${totalInserted} รายการ`);
    console.log('========================================');

  } catch (err) {
    console.error('❌ เกิดข้อผิดพลาด:', err.message);
    process.exit(1);
  } finally {
    if (db) await db.end();
  }
}

seed();