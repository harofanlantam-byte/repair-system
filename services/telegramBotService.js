// =============================================
// Telegram Bot Service — แจ้งเตือนผ่าน Telegram
// =============================================
// ใช้ Telegram Bot API (ฟรี)
// วิธีสร้าง Bot: คุยกับ @BotFather ใน Telegram
// วิธีหา Chat ID: คุยกับ @userinfobot หรือ @getidsbot

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_ENABLED = process.env.TELEGRAM_ENABLED !== 'false';

/**
 * ส่งข้อความแจ้งเตือนผ่าน Telegram Bot
 * @param {string} chatId — Telegram Chat ID ของผู้รับ
 * @param {string} message — ข้อความที่ต้องการส่ง (รองรับ Markdown)
 * @returns {object} { success, message }
 */
async function sendTelegramMessage(chatId, message) {
    if (!TELEGRAM_ENABLED || !TELEGRAM_BOT_TOKEN) {
        console.log('📵 [Telegram] Telegram Bot ถูกปิดหรือไม่มี Token');
        return { success: false, message: 'Telegram Bot disabled or no token' };
    }

    if (!chatId) {
        console.log('📵 [Telegram] ไม่มี Chat ID — ข้ามการส่ง');
        return { success: false, message: 'No Telegram Chat ID' };
    }

    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

        const body = {
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML',
            disable_web_page_preview: true
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const result = await response.json();

        if (result.ok) {
            console.log(`✅ [Telegram] ส่งข้อความถึง chat_id=${chatId} สำเร็จ`);
            return { success: true, messageId: result.result?.message_id };
        } else {
            console.error(`❌ [Telegram] ส่งไม่สำเร็จ: ${result.description}`);
            return { success: false, message: result.description };
        }
    } catch (err) {
        console.error(`❌ [Telegram] Error: ${err.message}`);
        return { success: false, message: err.message };
    }
}

/**
 * ส่งแจ้งเตือนเมื่อซ่อมเสร็จ (completed)
 * @param {string} chatId — Telegram Chat ID ของผู้ใช้
 * @param {object} data — ข้อมูลคำแจ้งซ่อม
 */
async function sendRepairCompletedNotification(chatId, data) {
    const {
        requester_name,
        ticket_number,
        equipment_name,
        equipment_code,
        completed_at,
        note
    } = data;

    const message = [
        '✅ <b>ซ่อมสำเร็จ! ครุภัณฑ์ของคุณพร้อมรับคืนแล้ว</b>',
        '',
        `📌 <b>เลขที่คำร้อง:</b> ${ticket_number}`,
        `📦 <b>ครุภัณฑ์:</b> ${equipment_name} (${equipment_code})`,
        `👤 <b>ผู้แจ้ง:</b> ${requester_name}`,
        `🕐 <b>วันที่เสร็จ:</b> ${completed_at || '-'}`,
        `📝 <b>หมายเหตุ:</b> ${note || '-'}`,
        '',
        '📍 กรุณาติดต่อรับคืนที่งานพัสดุ',
        '',
        '🔗 <i>สามารถดูรายละเอียดเพิ่มเติมได้ในระบบแจ้งซ่อม</i>'
    ].join('\n');

    return sendTelegramMessage(chatId, message);
}

/**
 * ส่งแจ้งเตือนสถานะเปลี่ยน (ทั่วไป)
 * @param {string} chatId — Telegram Chat ID
 * @param {object} data — ข้อมูล
 */
async function sendStatusChangeNotification(chatId, data) {
    const {
        requester_name,
        ticket_number,
        equipment_name,
        equipment_code,
        old_status,
        new_status,
        changed_at,
        note
    } = data;

    const message = [
        '🔧 <b>อัปเดตสถานะคำแจ้งซ่อม</b>',
        '',
        `📌 <b>เลขที่คำร้อง:</b> ${ticket_number}`,
        `📦 <b>ครุภัณฑ์:</b> ${equipment_name} (${equipment_code})`,
        `👤 <b>ผู้แจ้ง:</b> ${requester_name}`,
        `🔄 <b>สถานะ:</b> ${old_status} → ${new_status}`,
        `🕐 <b>วันที่อัปเดต:</b> ${changed_at || '-'}`,
        `📝 <b>หมายเหตุ:</b> ${note || '-'}`,
        '',
        '🔗 <i>สามารถดูรายละเอียดเพิ่มเติมได้ในระบบแจ้งซ่อม</i>'
    ].join('\n');

    return sendTelegramMessage(chatId, message);
}

/**
 * ฟอร์แมตข้อความแจ้งซ่อมสำเร็จให้สวยงาม
 * @param {object} data — ข้อมูลคำแจ้งซ่อม
 * @returns {string} — ข้อความที่ฟอร์แมตแล้ว
 */
function formatRepairCompletedMessage(data) {
    const {
        requester_name,
        ticket_number,
        equipment_name,
        equipment_code,
        completed_at,
        note,
        repair_cost,
        pickup_location
    } = data;

    const location = pickup_location || 'งานพัสดุ';
    const cost = repair_cost ? `\n💰 <b>ค่าใช้จ่าย:</b> ${Number(repair_cost).toLocaleString()} บาท` : '';

    return [
        '✅ <b>ซ่อมสำเร็จ! ครุภัณฑ์ของคุณพร้อมรับคืนแล้ว</b>',
        '',
        `🎉 <b>เลขที่คำร้อง:</b> ${ticket_number}`,
        `📦 <b>ครุภัณฑ์:</b> ${equipment_name} (${equipment_code})`,
        `👤 <b>ผู้แจ้ง:</b> ${requester_name}`,
        `🕐 <b>วันที่เสร็จ:</b> ${completed_at || '-'}`,
        `📝 <b>หมายเหตุ:</b> ${note || '-'}`
        + cost,
        '',
        `📍 <b>กรุณาติดต่อรับคืนที่:</b> ${location}`,
        '',
        '💡 <i>หากมีข้อสงสัย สามารถติดต่อเจ้าหน้าที่พัสดุได้ในช่วงเวลาทำการ</i>',
        '',
        '🔗 <i>สามารถดูรายละเอียดเพิ่มเติมได้ในระบบแจ้งซ่อม</i>'
    ].join('\n');
}

/**
 * ส่งข้อความ Telegram ถึงผู้ใช้ (เช็ค enabled/chatId อัตโนมัติ)
 * @param {string} chatId — Telegram Chat ID
 * @param {string|object} data — ข้อความ หรือ object สำหรับ formatRepairCompletedMessage
 * @returns {object} { success, message }
 */
async function sendTelegramToUser(chatId, data) {
    if (typeof data === 'object' && data.ticket_number) {
        return sendRepairCompletedNotification(chatId, data);
    }
    // fallback: ส่งเป็น string
    const message = typeof data === 'string' ? data : JSON.stringify(data);
    return sendTelegramMessage(chatId, message);
}

module.exports = {
    sendTelegramMessage,
    sendRepairCompletedNotification,
    sendStatusChangeNotification,
    formatRepairCompletedMessage,
    sendTelegramToUser
};
