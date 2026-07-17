// =============================================
// Email Service - ฟังก์ชันส่งอีเมล
// =============================================
// ใช้ฟังก์ชันช่วยเหลือจาก utils/emailUtils.js

const emailUtils = require('../utils/emailUtils');

// =============================================
// Core Send Function
// =============================================
async function sendEmail({ to, cc, bcc, subject, html, text, template, variables }) {
    if (!emailUtils.EMAIL_ENABLED) {
        console.log('📵 [Email] ระบบอีเมลถูกปิดใช้งาน (EMAIL_ENABLED=false)');
        return { success: false, message: 'Email disabled' };
    }

    const transporter = emailUtils.getTransporter();
    if (!transporter) {
        return { success: false, message: 'SMTP not configured' };
    }

    if (!to) {
        return { success: false, message: 'No recipient' };
    }

    let htmlBody = html || null;
    let textBody = text || null;

    // โหลด template ถ้าระบุ (และไม่มี HTML ดิบ)
    if (template && !htmlBody) {
        const templateContent = emailUtils.loadTemplate(template);
        if (templateContent) {
            htmlBody = emailUtils.renderTemplate(templateContent, variables || {});
            if (!textBody) {
                textBody = emailUtils.htmlToPlainText(htmlBody);
            }
        }
    }

    // ถ้าไม่มีทั้ง html และ text → ใช้ subject เป็นข้อความขั้นต่ำ
    if (!htmlBody && !textBody) {
        textBody = subject || '(No Content)';
    }

    const mailOptions = {
        from: `"${emailUtils.EMAIL_FROM_NAME}" <${emailUtils.EMAIL_FROM}>`,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject: subject || '(No Subject)',
        html: htmlBody || undefined,
        text: textBody || (htmlBody ? emailUtils.htmlToPlainText(htmlBody) : undefined)
    };

    if (cc) mailOptions.cc = Array.isArray(cc) ? cc.join(', ') : cc;
    if (bcc) mailOptions.bcc = Array.isArray(bcc) ? bcc.join(', ') : bcc;

    try {
        const info = await transporter.sendMail(mailOptions);
        emailUtils.logEmail({ type: 'sent', to, subject, messageId: info.messageId, response: info.response });
        console.log(`✅ [Email] ส่งอีเมล "${subject}" ไปยัง ${Array.isArray(to) ? to.join(',') : to} สำเร็จ (${info.messageId})`);
        return { success: true, messageId: info.messageId, response: info.response };
    } catch (err) {
        emailUtils.logEmail({ type: 'error', to, subject, error: err.message });
        console.error(`❌ [Email] ส่งอีเมล "${subject}" ไม่สำเร็จ: ${err.message}`);
        // ไม่ throw – ไม่กระทบระบบหลัก
        return { success: false, message: err.message };
    }
}

// =============================================
// sendStatusChangeEmail()
// =============================================
async function sendStatusChangeEmail({ requesterEmail, requesterName, ticketNumber, equipmentName, equipmentCode,
                                        oldStatus, newStatus, changedAt, note }) {
    const oldSt = emailUtils.STATUS_MAP[oldStatus] || { text: oldStatus || '-', color: '' };
    const newSt = emailUtils.STATUS_MAP[newStatus] || { text: newStatus, color: '' };

    return sendEmail({
        to: requesterEmail,
        subject: `🔧 อัปเดตสถานะคำแจ้งซ่อม ${ticketNumber} — ${newSt.text}`,
        template: 'status-change',
        variables: {
            requester_name: requesterName,
            ticket_number: ticketNumber,
            equipment_name: equipmentName,
            equipment_code: equipmentCode,
            old_status_text: oldSt.text,
            new_status_text: newSt.text,
            status_color: newSt.color,
            changed_at: changedAt || new Date().toLocaleString('th-TH'),
            note: note || '-'
        }
    });
}

// =============================================
// sendNewRepairEmail()
// =============================================
async function sendNewRepairEmail({ adminEmails, ticketNumber, requesterName, equipmentName, equipmentCode,
                                      typeName, problemDescription, locationFull, priority, requestedAt }) {
    if (!adminEmails || adminEmails.length === 0) {
        console.log('📵 [Email] ไม่มีอีเมล Admin — ข้าม new repair notification');
        return { success: false, message: 'No admin emails' };
    }

    const prio = emailUtils.PRIORITY_MAP[priority] || emailUtils.PRIORITY_MAP['normal'];

    return sendEmail({
        to: adminEmails,
        subject: `🚨 คำแจ้งซ่อมใหม่ ${ticketNumber} — ${equipmentName} [${prio.text}]`,
        template: 'new-repair',
        variables: {
            ticket_number: ticketNumber,
            requester_name: requesterName,
            equipment_name: equipmentName,
            equipment_code: equipmentCode,
            type_name: typeName,
            location_full: locationFull,
            priority_text: prio.text,
            problem_description: problemDescription || '-',
            requested_at: requestedAt || new Date().toLocaleString('th-TH')
        }
    });
}

// =============================================
// sendRepairCompletedEmail()
// =============================================
async function sendRepairCompletedEmail({ requesterEmail, requesterName, ticketNumber, equipmentName, equipmentCode,
                                            completedAt, note, repairCost, pickupLocation }) {
  if (!requesterEmail) {
    console.log('📵 [Email] ไม่มีอีเมลผู้แจ้ง — ข้าม repair-completed notification');
    return { success: false, message: 'No requester email' };
  }

  const location = pickupLocation || 'งานพัสดุ';

  return sendEmail({
    to: requesterEmail,
    subject: `✅ ซ่อมสำเร็จ! ${ticketNumber} — ${equipmentName} พร้อมรับคืน`,
    template: 'repair-completed',
    variables: {
      requester_name: requesterName,
      ticket_number: ticketNumber,
      equipment_name: equipmentName,
      equipment_code: equipmentCode,
      completed_at: completedAt || new Date().toLocaleString('th-TH'),
      note: note || '-',
      repair_cost: repairCost ? Number(repairCost).toLocaleString() + ' บาท' : '-',
      pickup_location: location
    }
  });
}

// =============================================
// sendReminderEmail()
// =============================================
async function sendReminderEmail({ adminEmails, equipmentList }) {
    if (!adminEmails || adminEmails.length === 0) {
        return { success: false, message: 'No admin emails' };
    }
    if (!equipmentList || equipmentList.length === 0) {
        return { success: false, message: 'No equipment to remind' };
    }

    const reminderRows = equipmentList.map(eq => {
        const daysLeft = eq.daysUntilExpire || 0;
        const daysText = daysLeft <= 0 ? 'หมดอายุแล้ว' : `${daysLeft} วัน`;
        const rowBg = daysLeft <= 7 ? 'background:#fef2f2;' : '';
        return `<tr style="${rowBg}">
            <td style="font-size:12px;color:#78350f;padding:6px 8px;">${eq.equipment_code || '-'}</td>
            <td style="font-size:12px;color:#78350f;padding:6px 8px;">${eq.equipment_name || '-'}</td>
            <td style="font-size:12px;color:#78350f;padding:6px 8px;">${eq.expire_date || '-'}</td>
            <td style="font-size:12px;color:#78350f;padding:6px 8px;font-weight:600;">${daysText}</td>
        </tr>`;
    }).join('');

    return sendEmail({
        to: adminEmails,
        subject: `⚠️ แจ้งเตือนครุภัณฑ์ใกล้หมดอายุ — ${equipmentList.length} รายการ`,
        template: 'reminder',
        variables: {
            reminder_rows: reminderRows,
            total_items: String(equipmentList.length)
        }
    });
}

// =============================================
// sendDailySummaryEmail()
// =============================================
async function sendDailySummaryEmail({ adminEmails, reportDate, totalNew, totalCompleted, totalAll, statusSummary, newTickets }) {
    if (!adminEmails || adminEmails.length === 0) {
        return { success: false, message: 'No admin emails' };
    }

    const statusRows = Object.entries(statusSummary || {})
        .map(([status, count]) => `
            <tr>
                <td style="font-size:12px;color:#475569;padding:4px 0;">${emailUtils.STATUS_MAP[status]?.text || status}</td>
                <td style="font-size:12px;color:#1e293b;font-weight:600;text-align:right;">${count}</td>
            </tr>
        `).join('');

    const newTicketRows = (newTickets || []).slice(0, 10).map(t => `
        <tr>
            <td style="font-size:11px;color:#475569;padding:4px 8px;">${t.ticket_number || '-'}</td>
            <td style="font-size:11px;color:#475569;padding:4px 8px;">${t.requester_name || '-'}</td>
            <td style="font-size:11px;color:#475569;padding:4px 8px;">${t.equipment_name || '-'}</td>
            <td style="font-size:11px;color:#475569;padding:4px 8px;">${(emailUtils.STATUS_MAP[t.status] || {}).text || t.status}</td>
        </tr>
    `).join('');

    const displayTicketRows = newTicketRows || '<tr><td colspan="4" style="font-size:11px;color:#94a3b8;padding:8px;text-align:center;">ไม่มีคำแจ้งซ่อมใหม่วันนี้</td></tr>';

    return sendEmail({
        to: adminEmails,
        subject: `📊 สรุปรายงานประจำวัน ${reportDate} — ใหม่ ${totalNew} | เสร็จ ${totalCompleted}`,
        template: 'daily-summary',
        variables: {
            report_date: reportDate,
            total_new: String(totalNew),
            total_completed: String(totalCompleted),
            total_all: String(totalAll),
            status_rows: statusRows,
            new_ticket_rows: displayTicketRows
        }
    });
}

module.exports = {
    sendEmail,
    sendStatusChangeEmail,
    sendNewRepairEmail,
    sendRepairCompletedEmail,
    sendReminderEmail,
    sendDailySummaryEmail
};
