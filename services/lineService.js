// =============================================
// services/lineService.js
// LINE Official Account — Messaging API (รวมทุกฟังก์ชันไว้ที่เดียว)
// แทนที่ lineNotifyService.js (LINE Notify ปิดบริการถาวรตั้งแต่ 31 มี.ค. 2025)
// และ lineMessagingService.js เดิม (รวมเข้ามาที่นี่แล้ว ไม่ต้องใช้ไฟล์แยก)
// =============================================
const crypto = require('crypto');
const { messagingApi } = require('@line/bot-sdk');

const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || '';
const LINE_ENABLED = process.env.LINE_ENABLED !== 'false' && !!LINE_CHANNEL_ACCESS_TOKEN;

const client = new messagingApi.MessagingApiClient({ channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN });

// =============================================
// LINKING CODE — วิธีผูก LINE User ID กับบัญชีในระบบแบบปลอดภัย
// ผู้ใช้ต้อง login เว็บก่อน ถึงจะขอรหัสได้ (แทนการพิมพ์ #register {username} แบบเดิมที่ไม่มี auth)
// =============================================
const linkCodes = new Map(); // code -> { appUserId, expires }
const CODE_TTL_MS = 10 * 60 * 1000; // 10 นาที

function createLinkCode(appUserId) {
    // ลบรหัสเก่าของ user เดิมก่อน กันมีหลายรหัสค้าง
    for (const [code, entry] of linkCodes.entries()) {
        if (entry.appUserId === appUserId) linkCodes.delete(code);
    }
    let code;
    do { code = Math.floor(100000 + Math.random() * 900000).toString(); } while (linkCodes.has(code));
    linkCodes.set(code, { appUserId, expires: Date.now() + CODE_TTL_MS });
    return code;
}

function consumeLinkCode(code) {
    const entry = linkCodes.get(code);
    if (!entry) return null;
    linkCodes.delete(code);
    if (entry.expires < Date.now()) return null;
    return entry.appUserId;
}

// เก็บกวาดรหัสหมดอายุเป็นระยะ กันหน่วยความจำรั่วถ้าไม่มีใครมากดยืนยัน
setInterval(() => {
    const now = Date.now();
    for (const [code, entry] of linkCodes.entries()) if (entry.expires < now) linkCodes.delete(code);
}, 5 * 60 * 1000);

// =============================================
// SIGNATURE VERIFICATION — ป้องกันคนปลอมยิง request มาที่ /webhook/line
// ต้องใช้คู่กับ express.json({ verify }) ที่เก็บ req.rawBody ไว้ใน server.js
// =============================================
function verifyLineSignature(req) {
    if (!LINE_CHANNEL_SECRET) {
        console.warn('⚠️ [LINE] ไม่ได้ตั้งค่า LINE_CHANNEL_SECRET — ข้ามการตรวจสอบลายเซ็น (ไม่ปลอดภัย ควรตั้งค่าก่อนใช้จริง)');
        return true;
    }
    const signature = req.headers['x-line-signature'];
    if (!signature || !req.rawBody) return false;
    const hash = crypto.createHmac('sha256', LINE_CHANNEL_SECRET).update(req.rawBody).digest('base64');
    // timingSafeEqual ป้องกัน timing attack
    try {
        const a = Buffer.from(signature);
        const b = Buffer.from(hash);
        return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch { return false; }
}

// =============================================
// PUSH MESSAGE (ข้อความธรรมดา)
// =============================================
async function sendLineMessage(userId, message) {
    if (!LINE_ENABLED) { console.log('📵 [LINE] ปิดใช้งานหรือไม่มี Token'); return { success: false, message: 'LINE disabled or no token' }; }
    if (!userId) { console.log('📵 [LINE] ไม่มี LINE User ID — ข้าม'); return { success: false, message: 'No LINE User ID' }; }
    try {
        await client.pushMessage({ to: userId, messages: [{ type: 'text', text: message }] });
        console.log(`✅ [LINE] ส่งข้อความสำเร็จ → ${userId}`);
        return { success: true };
    } catch (err) {
        console.error('❌ [LINE] ส่งข้อความไม่สำเร็จ:', err.message);
        return { success: false, message: err.message };
    }
}

// =============================================
// PUSH FLEX MESSAGE (การ์ดสวยงาม)
// =============================================
async function sendFlexMessage(userId, flexMessage) {
    if (!LINE_ENABLED) return { success: false, message: 'LINE disabled or no token' };
    if (!userId) return { success: false, message: 'No LINE User ID' };
    try {
        await client.pushMessage({ to: userId, messages: [flexMessage] });
        console.log(`✅ [LINE] ส่ง Flex Message สำเร็จ → ${userId}`);
        return { success: true };
    } catch (err) {
        console.error('❌ [LINE] ส่ง Flex Message ไม่สำเร็จ:', err.message);
        return { success: false, message: err.message };
    }
}

// =============================================
// FLEX MESSAGE BUILDERS (ย้ายมาจาก lineMessagingService.js เดิม)
// =============================================
function buildNewRepairFlex({ ticketNumber, requesterName, equipmentName, equipmentCode, locationFull, problemDescription }) {
    return {
        type: 'flex',
        altText: `🚨 คำแจ้งซ่อมใหม่ ${ticketNumber}`,
        contents: {
            type: 'bubble', size: 'kilo',
            header: { type: 'box', layout: 'vertical', backgroundColor: '#E85D26', contents: [{ type: 'text', text: '🚨 คำแจ้งซ่อมใหม่', color: '#FFFFFF', weight: 'bold', size: 'md', align: 'center' }] },
            body: {
                type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '16px',
                contents: [
                    { type: 'text', text: `📌 ${ticketNumber}`, weight: 'bold', size: 'sm', color: '#1A2744' },
                    { type: 'text', text: `👤 ${requesterName}`, size: 'xs', color: '#6B7A99' },
                    { type: 'text', text: `📦 ${equipmentName || '-'} (${equipmentCode || '-'})`, size: 'xs', color: '#6B7A99' },
                    { type: 'text', text: `📍 ${locationFull || '-'}`, size: 'xs', color: '#6B7A99' },
                    { type: 'text', text: problemDescription ? `📝 ${problemDescription.substring(0, 50)}...` : '📝 ไม่มีรายละเอียด', size: 'xs', color: '#6B7A99', wrap: true }
                ]
            }
        }
    };
}

function buildRepairCompletedFlex({ ticketNumber, equipmentName, equipmentCode, note }) {
    return {
        type: 'flex',
        altText: `✅ ซ่อมสำเร็จ! ${ticketNumber}`,
        contents: {
            type: 'bubble', size: 'kilo',
            header: { type: 'box', layout: 'vertical', backgroundColor: '#22C55E', contents: [{ type: 'text', text: '✅ ซ่อมสำเร็จ!', color: '#FFFFFF', weight: 'bold', size: 'md', align: 'center' }] },
            body: {
                type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '16px',
                contents: [
                    { type: 'text', text: `📌 ${ticketNumber}`, weight: 'bold', size: 'sm', color: '#1A2744' },
                    { type: 'text', text: `📦 ${equipmentName || '-'} (${equipmentCode || '-'})`, size: 'xs', color: '#6B7A99' },
                    { type: 'text', text: '📍 กรุณาติดต่อรับคืนที่งานพัสดุ', size: 'xs', color: '#6B7A99' },
                    { type: 'text', text: `📝 ${note || 'ไม่มีหมายเหตุ'}`, size: 'xs', color: '#6B7A99', wrap: true }
                ]
            }
        }
    };
}

function buildStatusChangeFlex({ ticketNumber, equipmentName, equipmentCode, oldStatusText, newStatusText, note }) {
    return {
        type: 'flex',
        altText: `🔧 อัปเดตสถานะ ${ticketNumber}`,
        contents: {
            type: 'bubble', size: 'kilo',
            header: { type: 'box', layout: 'vertical', backgroundColor: '#D97706', contents: [{ type: 'text', text: '🔧 อัปเดตสถานะ', color: '#FFFFFF', weight: 'bold', size: 'md', align: 'center' }] },
            body: {
                type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '16px',
                contents: [
                    { type: 'text', text: `📌 ${ticketNumber}`, weight: 'bold', size: 'sm', color: '#1A2744' },
                    { type: 'text', text: `📦 ${equipmentName || '-'}`, size: 'xs', color: '#6B7A99' },
                    { type: 'text', text: `🔄 ${oldStatusText} → ${newStatusText}`, size: 'xs', color: '#D97706', weight: 'bold' },
                    { type: 'text', text: note ? `📝 ${note}` : ' ', size: 'xs', color: '#6B7A99', wrap: true }
                ]
            }
        }
    };
}

// =============================================
// ฟังก์ชันสะดวกใช้ — ส่งแจ้งซ่อมเสร็จเป็น Flex (fallback เป็น text ถ้า flex พัง)
// =============================================
async function sendRepairCompleted(userId, repair) {
    const flex = buildRepairCompletedFlex({ ticketNumber: repair.ticket_number, equipmentName: repair.equipment_name, equipmentCode: repair.equipment_code, note: repair.note });
    const result = await sendFlexMessage(userId, flex);
    if (result.success) return result;
    // fallback เป็นข้อความธรรมดาถ้า flex ส่งไม่ผ่าน
    const text = `✅ ครุภัณฑ์ของคุณซ่อมเสร็จแล้ว!\n\n📝 เลขที่: ${repair.ticket_number}\n📦 ครุภัณฑ์: ${repair.equipment_name}\n\n📍 สามารถมารับคืนได้ที่งานพัสดุ\n\n🙏 ขอบคุณที่ใช้บริการ`;
    return sendLineMessage(userId, text);
}

// =============================================
// WEBHOOK — รับ event จาก LINE
// รับ db (connection/pool ที่ใช้ร่วมกับ server.js) เป็นพารามิเตอร์ ไม่เปิด connection ใหม่เอง
// =============================================
const STATUS_TEXT_MAP = { pending: '⏳ รอดำเนินการ', in_progress: '🔧 กำลังดำเนินการ', received: '📦 รับครุภัณฑ์', sent_repair: '🔩 ส่งซ่อม', completed: '✅ ซ่อมสำเร็จ', returned: '↩️ คืนผู้แจ้ง', cancelled: '❌ ยกเลิก' };

// หมายเหตุ: รับ db เป็นพารามิเตอร์ที่ 3 (ไม่ใช้ factory/closure) เพื่อให้ server.js
// ส่ง reference ของตัวแปร db ปัจจุบันเข้ามาได้ทุกครั้งที่มี request — กัน bug กรณี route
// ถูก register ก่อน connectDB() เชื่อมต่อเสร็จ (ตัวแปร db ตอนนั้นยังเป็น undefined อยู่)
async function lineWebhook(req, res, db) {
    // 1) ตรวจลายเซ็นก่อนอย่างอื่นทั้งหมด — ถ้าไม่ผ่าน ปฏิเสธทันที ไม่แตะฐานข้อมูล
    if (!verifyLineSignature(req)) {
        console.warn('⚠️ [LINE] Signature ไม่ถูกต้อง — ปฏิเสธ request');
        return res.sendStatus(401);
    }

    // 2) ตอบ 200 กลับให้ LINE เร็วที่สุด เพื่อกัน LINE ยิง webhook ซ้ำเพราะ timeout
    //    แล้วค่อยประมวลผล event แบบ async (แพทเทิร์นเดียวกับ setImmediate ที่ใช้ใน server.js)
    res.sendStatus(200);

    {
        const events = req.body?.events || [];
        for (const event of events) {
            try {
                if (event.type === 'follow') {
                    const userId = event.source.userId;
                    console.log(`🟢 [LINE] New follower: ${userId}`);
                    await client.replyMessage({
                        replyToken: event.replyToken,
                        messages: [{ type: 'text', text: '👋 สวัสดี! ยินดีต้อนรับสู่ระบบแจ้งซ่อมครุภัณฑ์\n\n📌 กรุณาเข้าเว็บระบบ → หน้าโปรไฟล์ → กด "เชื่อมต่อ LINE" เพื่อขอรหัส 6 หลัก\n📌 แล้วส่งรหัสนั้นมาที่แชทนี้ เช่น: 482913' }]
                    });
                }

                if (event.type === 'message' && event.message.type === 'text') {
                    const userId = event.source.userId;
                    const text = event.message.text.trim();

                    // 🔑 ผูกบัญชีด้วยรหัส 6 หลัก (แทน #register {username} เดิมที่ไม่มี auth)
                    if (/^\d{6}$/.test(text)) {
                        const appUserId = consumeLinkCode(text);
                        if (!appUserId) {
                            await client.replyMessage({ replyToken: event.replyToken, messages: [{ type: 'text', text: '❌ รหัสไม่ถูกต้องหรือหมดอายุ (รหัสใช้ได้ 10 นาที)\n\nกรุณาขอรหัสใหม่จากหน้าเว็บ' }] });
                            continue;
                        }
                        await db.query('UPDATE users SET line_user_id=? WHERE id=?', [userId, appUserId]);
                        const [u] = await db.query('SELECT full_name FROM users WHERE id=?', [appUserId]);
                        await client.replyMessage({ replyToken: event.replyToken, messages: [{ type: 'text', text: `✅ เชื่อมต่อ LINE สำเร็จ!\n\n👤 บัญชี: ${u[0]?.full_name || '-'}\n\n🎉 จากนี้คุณจะได้รับแจ้งเตือนผ่าน LINE เมื่อสถานะคำแจ้งซ่อมเปลี่ยนแปลง!` }] });
                        console.log(`✅ [LINE] Linked appUserId=${appUserId} ↔ lineUserId=${userId}`);
                        continue;
                    }

                    if (text.includes('สถานะ')) {
                        await client.replyMessage({ replyToken: event.replyToken, messages: [{ type: 'text', text: '🔍 ส่ง #mytickets เพื่อดูรายการคำแจ้งของฉัน' }] });
                        continue;
                    }

                    if (text.toLowerCase() === '#mytickets') {
                        const [user] = await db.query('SELECT id FROM users WHERE line_user_id = ?', [userId]);
                        if (!user.length) {
                            await client.replyMessage({ replyToken: event.replyToken, messages: [{ type: 'text', text: '❌ ยังไม่ได้เชื่อมต่อบัญชี\n\n📌 เข้าเว็บ → โปรไฟล์ → เชื่อมต่อ LINE เพื่อขอรหัส' }] });
                            continue;
                        }
                        const [repairs] = await db.query(
                            'SELECT ticket_number, equipment_name, status, requested_at FROM repair_requests rr JOIN equipment e ON rr.equipment_id = e.id WHERE rr.user_id = ? ORDER BY rr.requested_at DESC LIMIT 5',
                            [user[0].id]
                        );
                        if (!repairs.length) {
                            await client.replyMessage({ replyToken: event.replyToken, messages: [{ type: 'text', text: '📋 คุณยังไม่มีคำแจ้งซ่อมในระบบ' }] });
                        } else {
                            const list = repairs.map(r => `📌 ${r.ticket_number} — ${r.equipment_name || '-'}\n   ${STATUS_TEXT_MAP[r.status] || r.status} | ${new Date(r.requested_at).toLocaleDateString('th-TH')}`).join('\n\n');
                            await client.replyMessage({ replyToken: event.replyToken, messages: [{ type: 'text', text: `📋 คำแจ้งซ่อมล่าสุดของคุณ:\n\n${list}` }] });
                        }
                        continue;
                    }

                    if (text.toLowerCase() === '#help') {
                        await client.replyMessage({ replyToken: event.replyToken, messages: [{ type: 'text', text: '🤖 คำสั่งที่ใช้ได้:\n\n📌 พิมพ์รหัส 6 หลักจากหน้าเว็บ — เชื่อมต่อบัญชี\n📌 #mytickets — ดูคำแจ้งของฉัน\n📌 #help — คำสั่งทั้งหมด' }] });
                        continue;
                    }

                    await client.replyMessage({ replyToken: event.replyToken, messages: [{ type: 'text', text: '📩 รับข้อความของคุณแล้ว เจ้าหน้าที่จะติดต่อกลับ\n\n💡 ส่ง #help เพื่อดูคำสั่งทั้งหมด' }] });
                }
            } catch (err) {
                console.error('❌ [LINE Webhook] Event error:', err.message);
                // ไม่ throw ต่อ — ให้ event ถัดไปใน loop ทำงานต่อได้ ไม่ให้ event เดียวพังทั้ง batch
            }
        }
    }
}


module.exports = {
    sendLineMessage,
    sendFlexMessage,
    sendRepairCompleted,
    buildNewRepairFlex,
    buildRepairCompletedFlex,
    buildStatusChangeFlex,
    createLinkCode,
    lineWebhook,
    LINE_ENABLED
};
