// =============================================
// CONFIG
// =============================================
const API = '';
let token = localStorage.getItem('repair_token') || '';
let currentUser = JSON.parse(localStorage.getItem('repair_user') || 'null');
let currentRepairId = null;
let equipTypes = [];

// =============================================
// INIT
// =============================================
(function init() {
  const path = window.location.pathname;

  // หน้าล็อกอิน ไม่ต้องเช็ค auth
  if (path.includes('index.html') || path === '/') return;

  // หน้าอื่นต้องมี token
  if (!token || !currentUser) {
    window.location.href = 'index.html';
    return;
  }

  // แสดงชื่อและบทบาทบน topbar
  const nameEl = document.getElementById('topbar-uname');
  if (nameEl) nameEl.textContent = currentUser.full_name || currentUser.username;

  const roleEl = document.getElementById('topbar-role');
  if (roleEl) {
    roleEl.textContent = '👑 Admin';
    roleEl.style.background = 'rgba(232,93,38,0.2)';
    roleEl.style.color = '#e85d26';
  }

  initSidebar();
  initDarkMode();

  // โหลดข้อมูลตามหน้า
  loadEquipTypes();
  if (path.includes('dashboard.html')) loadDashboard();
  if (path.includes('history.html')) loadHistory();
  if (path.includes('service.html')) loadServiceData();
  if (path.includes('repair-form.html')) initRepairFormPage();
})();

// =============================================
// SIDEBAR
// =============================================
function initSidebar() {
  const userNameEl = document.getElementById('sidebar-user-name');
  const userRoleEl = document.getElementById('sidebar-user-role');
  if (userNameEl) userNameEl.textContent = currentUser.full_name || currentUser.username;
  if (userRoleEl) userRoleEl.textContent = '👑 Admin';

  const path = window.location.pathname;
  document.querySelectorAll('#sidebar .nav-btn').forEach(btn => {
    const href = btn.getAttribute('href');
    if (href && path.includes(href)) btn.classList.add('active');
  });
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.toggle('open');
  if (overlay) overlay.classList.toggle('active');
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('active');
}

// =============================================
// DARK MODE
// =============================================
function initDarkMode() {
  const saved = localStorage.getItem('repair_theme');
  if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  const toggle = document.getElementById('theme-toggle');
  if (toggle) {
    toggle.textContent = saved === 'dark' ? '☀️' : '🌙';
    toggle.onclick = toggleDarkMode;
  }
}

function toggleDarkMode() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  if (isDark) {
    html.removeAttribute('data-theme');
    localStorage.setItem('repair_theme', 'light');
  } else {
    html.setAttribute('data-theme', 'dark');
    localStorage.setItem('repair_theme', 'dark');
  }
  const toggle = document.getElementById('theme-toggle');
  if (toggle) toggle.textContent = isDark ? '🌙' : '☀️';
}

// =============================================
// AUTH
// =============================================
async function doLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-err');
  errEl.style.display = 'none';
  if (!username || !password) { showErr(errEl, 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน'); return; }
  try {
    const res = await api('POST', '/api/auth/login', { username, password }, false);
    if (res.success) {
      token = res.token;
      currentUser = res.user;
      localStorage.setItem('repair_token', token);
      localStorage.setItem('repair_user', JSON.stringify(currentUser));
      window.location.href = 'dashboard.html';
    } else { showErr(errEl, res.message); }
  } catch (e) { showErr(errEl, 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้'); }
}

function doLogout() {
  token = ''; currentUser = null;
  localStorage.removeItem('repair_token');
  localStorage.removeItem('repair_user');
  window.location.href = 'index.html';
}

// =============================================
// API HELPER
// =============================================
async function api(method, url, data, auth) {
  if (auth === undefined) auth = true;
  const headers = { 'Content-Type': 'application/json' };
  if (auth && token) headers['Authorization'] = `Bearer ${token}`;
  const opts = { method, headers };
  if (data && method !== 'GET') opts.body = JSON.stringify(data);
  const res = await fetch(API + url, opts);
  if (res.status === 401) { doLogout(); throw new Error('Unauthorized'); }
  return res.json();
}

async function apiForm(method, url, formData) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(API + url, { method, headers, body: formData }).then(r => r.json());
}

// =============================================
// EQUIPMENT TYPES
// =============================================
async function loadEquipTypes() {
  try {
    const res = await api('GET', '/api/equipment-types');
    if (res.success) {
      equipTypes = res.data;
      populateTypeSelects();
      renderTypeGrid();
    }
  } catch {}
}

function populateTypeSelects() {
  const selects = ['rf-type', 'me-type', 'equip-type-filter'];
  selects.forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const extra = id === 'equip-type-filter' ? '<option value="">ทุกประเภท</option>' : '<option value="">-- เลือกประเภท --</option>';
    sel.innerHTML = extra + equipTypes.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
  });
}

// =============================================
// DASHBOARD
// =============================================
let chartMonthly = null;
let chartStatusPie = null;

async function loadDashboard() {
  if (!document.getElementById('stat-total')) return;
  try {
    const dateFrom = document.getElementById('dash-date-start')?.value || '';
    const dateTo = document.getElementById('dash-date-end')?.value || '';
    let apiUrl = '/api/dashboard/stats?';
    if (dateFrom) apiUrl += `date_from=${encodeURIComponent(dateFrom)}&`;
    if (dateTo) apiUrl += `date_to=${encodeURIComponent(dateTo)}&`;

    const res = await api('GET', apiUrl);
    if (!res.success) return;
    document.getElementById('stat-total').textContent = res.stats.total;
    document.getElementById('stat-pending').textContent = res.stats.pending;
    document.getElementById('stat-inprogress').textContent = res.stats.in_progress;
    document.getElementById('stat-completed').textContent = res.stats.completed;
    document.getElementById('stat-urgent').textContent = res.stats.urgent;

    let recentUrl = '/api/repairs?limit=5';
    if (dateFrom) recentUrl += `&date_from=${dateFrom}`;
    if (dateTo) recentUrl += `&date_to=${dateTo}`;
    const recent = await api('GET', recentUrl);
    const tbody = document.getElementById('dash-recent');
    if (recent.success && recent.data.length) {
      tbody.innerHTML = recent.data.map(r => `<tr style="cursor:pointer" onclick="openService(${r.id})"><td style="font-family:'Space Mono';font-size:12px">${r.ticket_number}</td><td>${r.equipment_name}</td><td>${r.requester_name}</td><td>${statusBadge(r.status)}</td></tr>`).join('');
    } else { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:24px">ยังไม่มีคำแจ้งซ่อม</td></tr>'; }

    const byType = document.getElementById('dash-bytype');
    if (res.byType && res.byType.length) {
      byType.innerHTML = res.byType.map(t => `<div style="display:flex;justify-content:space-between;margin-bottom:12px;"><span>${t.name}</span><div><div style="width:120px;height:8px;background:#f0f2f5;border-radius:4px;overflow:hidden"><div style="width:${Math.min(100,(t.count/res.stats.total*100)||0)}%;height:100%;background:var(--accent);border-radius:4px"></div></div><span style="margin-left:10px;">${t.count}</span></div></div>`).join('');
    }

    renderMonthlyChart(res.monthly || []);
    renderStatusPieChart(res.stats);
  } catch (e) { console.error(e); }
}

function renderMonthlyChart(data) {
  const ctx = document.getElementById('chart-monthly');
  if (!ctx) return;
  if (chartMonthly) chartMonthly.destroy();
  chartMonthly = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => d.month),
      datasets: [{ label: 'จำนวนคำแจ้งซ่อม', data: data.map(d => d.count), backgroundColor: 'rgba(232, 93, 38, 0.7)', borderColor: '#e85d26', borderWidth: 1, borderRadius: 4 }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
  });
}

function renderStatusPieChart(stats) {
  const ctx = document.getElementById('chart-status-pie');
  if (!ctx) return;
  if (chartStatusPie) chartStatusPie.destroy();
  chartStatusPie = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['รอดำเนินการ', 'กำลังดำเนินการ', 'ส่งซ่อม', 'ซ่อมสำเร็จ'],
      datasets: [{ data: [stats.pending || 0, stats.in_progress || 0, stats.sent_repair || 0, stats.completed || 0], backgroundColor: ['#f59e0b', '#3b82f6', '#8b5cf6', '#10b981'], borderWidth: 2, borderColor: '#fff' }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true } } } }
  });
}

// =============================================
// REPAIR FORM (หน้า repair-form.html)
// =============================================
function initRepairFormPage() {
  // ใช้ฟังก์ชัน lookupEquip, selectEquipment, displayEquipmentInfo ที่อยู่ใน HTML
  // script.js ไม่ต้องทำอะไรเพิ่ม
}

// =============================================
// HISTORY (หน้า history.html)
// =============================================
async function loadHistory() {
  if (!document.getElementById('hist-table') && !document.getElementById('history-table')) return;
  const status = document.getElementById('hist-status')?.value || document.getElementById('filter-status')?.value || '';
  const search = document.getElementById('hist-search')?.value || document.getElementById('filter-search')?.value || '';
  const dateFrom = document.getElementById('hist-date-start')?.value || document.getElementById('filter-date-start')?.value || '';
  const dateTo = document.getElementById('hist-date-end')?.value || document.getElementById('filter-date-end')?.value || '';
  const priority = document.getElementById('hist-priority')?.value || document.getElementById('filter-priority')?.value || '';

  let url = '/api/repairs?limit=200';
  if (status) url += `&status=${status}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  if (dateFrom) url += `&date_from=${dateFrom}`;
  if (dateTo) url += `&date_to=${dateTo}`;
  if (priority) url += `&priority=${priority}`;

  try {
    const res = await api('GET', url);
    const tbody = document.getElementById('hist-table') || document.getElementById('history-table');
    if (res.success && res.data.length) {
      tbody.innerHTML = res.data.map(r => `<tr onclick="openService(${r.id})" style="cursor:pointer">
        <td style="font-family:'Space Mono';font-size:12px">${r.ticket_number}</td>
        <td>${r.equipment_name || '-'}</td>
        <td>${r.type_name || '-'}</td>
        <td>${r.requester_name || '-'}</td>
        <td>${formatDate(r.requested_at)}</td>
        <td>${priorityBadge(r.priority)}</td>
        <td>${statusBadge(r.status)}</td>
        <td><button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteRepair(${r.id},'${r.ticket_number}')">🗑️</button></td>
      </tr>`).join('');
    } else {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:32px">ไม่พบข้อมูล</td></tr>';
    }
  } catch {}
}

// =============================================
// SERVICE (ดูรายละเอียดคำแจ้งซ่อม)
// =============================================
async function loadServiceData() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const container = document.getElementById('service-container');
  if (!container) return;
  if (!id) { container.innerHTML = '<div style="text-align:center;padding:48px">ไม่พบรหัสคำแจ้งซ่อม</div>'; return; }
  try {
    const res = await api('GET', `/api/repairs/${id}`);
    if (res.success) {
      const r = res.data;
      container.innerHTML = `
        <div class="card mb-20">
          <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;">
            <div><h3>🔧 รายละเอียดคำแจ้งซ่อม</h3><small style="font-family:'Space Mono'">#${r.ticket_number}</small></div>
            <div>${statusBadge(r.status)}</div>
          </div>
          <div class="card-body">
            <div class="grid-2">
              <div><strong>ครุภัณฑ์:</strong> ${r.equipment_name}</div>
              <div><strong>รหัสครุภัณฑ์:</strong> ${r.equipment_code}</div>
              <div><strong>ประเภท:</strong> ${r.type_name}</div>
              <div><strong>ผู้แจ้ง:</strong> ${r.requester_name}</div>
              <div><strong>สถานที่:</strong> ${[r.location_building, r.location_department, r.location_room].filter(Boolean).join(' > ') || '-'}</div>
              <div><strong>ความเร่งด่วน:</strong> ${priorityBadge(r.priority)}</div>
            </div>
            <div style="margin-top:12px"><strong>อาการที่พบ:</strong><p>${r.problem_description || '-'}</p></div>
            ${r.equipment_parts ? `<div style="margin-top:12px"><strong>ชิ้นส่วน:</strong> ${r.equipment_parts}</div>` : ''}
            ${r.image_path ? `<div style="margin-top:12px"><img src="${r.image_path}" style="max-width:300px;border-radius:8px"></div>` : ''}
            ${r.admin_note ? `<div style="margin-top:12px"><strong>บันทึก Admin:</strong> ${r.admin_note}</div>` : ''}
          </div>
        </div>
        ${r.repair_cost ? `<div class="card mb-20"><div class="card-header"><h3>💰 ค่าใช้จ่าย</h3></div><div class="card-body"><div><strong>ค่าใช้จ่าย:</strong> ${Number(r.repair_cost).toLocaleString()} บาท</div>${r.cost_note ? '<div><strong>หมายเหตุ:</strong> ' + r.cost_note + '</div>' : ''}</div></div>` : ''}
        <div class="card mb-20">
          <div class="card-header"><h3>📋 ประวัติการดำเนินการ</h3></div>
          <div class="card-body">
            ${res.history && res.history.length ? res.history.map(h => `
              <div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid var(--border)">
                <div style="min-width:100px;font-size:12px;color:var(--text-muted)">${formatDate(h.changed_at)}</div>
                <div>${statusBadge(h.new_status)}</div>
                <div style="color:var(--text-muted)">${h.note || ''} ${h.admin_name ? '- ' + h.admin_name : ''}</div>
              </div>
            `).join('') : '<div style="color:var(--text-muted)">ไม่มีประวัติ</div>'}
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>⚙️ จัดการสถานะ</h3></div>
          <div class="card-body">
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <select id="sv-status" class="form-input" style="width:200px">
                <option value="">-- เลือกสถานะ --</option>
                <option value="in_progress">กำลังดำเนินการ</option>
                <option value="received">รับครุภัณฑ์</option>
                <option value="sent_repair">ส่งซ่อม</option>
                <option value="completed">ซ่อมเสร็จ</option>
                <option value="returned">คืนผู้แจ้ง</option>
                <option value="cancelled">ยกเลิก</option>
              </select>
              <input type="text" id="sv-note" class="form-input" style="width:250px" placeholder="หมายเหตุ (ถ้ามี)">
              <button class="btn btn-primary" onclick="updateServiceStatus(${id})">💾 อัพเดต</button>
            </div>
            <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
              <button class="btn btn-outline" onclick="openRepairDoc(${id})">📄 ดูเอกสาร</button>
              <button class="btn btn-outline" onclick="exportExcel(${id})">📊 Export Excel</button>
            </div>
          </div>
        </div>`;
    } else {
      container.innerHTML = '<div style="text-align:center;padding:48px">ไม่พบข้อมูลคำแจ้งซ่อม</div>';
    }
  } catch { container.innerHTML = '<div style="text-align:center;padding:48px">เกิดข้อผิดพลาด</div>'; }
}

async function updateServiceStatus(repairId) {
  const status = document.getElementById('sv-status').value;
  const note = document.getElementById('sv-note').value.trim();
  if (!status) { alert('กรุณาเลือกสถานะ'); return; }
  try {
    const res = await api('PATCH', `/api/repairs/${repairId}/status`, { status, admin_note: note });
    if (res.success) { alert('✅ อัพเดตสถานะสำเร็จ'); loadServiceData(); }
    else { alert('❌ ' + res.message); }
  } catch { alert('❌ เกิดข้อผิดพลาด'); }
}

// =============================================
// DELETE REPAIR
// =============================================
async function deleteRepair(id, ticketNumber) {
  if (!confirm(`⚠️ คุณต้องการลบคำร้องขอซ่อมหมายเลข ${ticketNumber} ใช่หรือไม่?`)) return;
  try {
    const res = await api('DELETE', `/api/repairs/${id}`);
    if (res.success) { alert('✅ ลบสำเร็จ'); loadHistory(); }
    else { alert('❌ ' + (res.message || 'ลบไม่สำเร็จ')); }
  } catch { alert('❌ เกิดข้อผิดพลาด'); }
}

// =============================================
// FUNCTIONS
// =============================================
function openService(id) { window.location.href = 'service.html?id=' + id; }

function openRepairDoc(id) {
  localStorage.setItem('repair_document_single', JSON.stringify({ id }));
  window.location.href = 'repair-document.html?id=' + id;
}

async function exportExcel(id) {
  try {
    const res = await fetch(`/api/export-repair-doc/${id}`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `ขอซ่อม_${id}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } else { alert('❌ ไม่สามารถดาวน์โหลด Excel'); }
  } catch { alert('❌ เกิดข้อผิดพลาด'); }
}

function statusBadge(status) {
  const map = {
    'pending': '<span class="badge badge-warning">⏳ รอดำเนินการ</span>',
    'in_progress': '<span class="badge badge-info">🔧 กำลังดำเนินการ</span>',
    'received': '<span class="badge badge-info">📦 รับครุภัณฑ์</span>',
    'sent_repair': '<span class="badge badge-primary">🔩 ส่งซ่อม</span>',
    'completed': '<span class="badge badge-success">✅ ซ่อมสำเร็จ</span>',
    'returned': '<span class="badge badge-secondary">↩️ คืนผู้แจ้ง</span>',
    'cancelled': '<span class="badge badge-error">❌ ยกเลิก</span>'
  };
  return map[status] || `<span class="badge">${status}</span>`;
}

function priorityBadge(p) {
  const map = { 'urgent': '<span class="badge badge-error">🔴 ด่วน</span>', 'normal': '<span class="badge badge-info">🟡 ปกติ</span>', 'low': '<span class="badge badge-secondary">🟢 ต่ำ</span>' };
  return map[p] || `<span class="badge">${p}</span>`;
}

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function showErr(el, msg) { el.textContent = '❌ ' + msg; el.style.display = 'block'; }

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) { el.style.display = 'none'; el.classList.remove('open'); }
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) { el.style.display = 'flex'; el.classList.add('open'); }
}

// =============================================
// TYPE GRID (type-select.html)
// =============================================
function renderTypeGrid() {
  const container = document.getElementById('type-grid');
  if (!container) return;
  if (!equipTypes.length) {
    container.innerHTML = '<div style="text-align:center;padding:48px">ยังไม่มีประเภทครุภัณฑ์ในระบบ</div>';
    return;
  }
  const icons = { 'คอมพิวเตอร์': '🖥️', 'เครื่องถ่ายเอกสาร': '🖨️', 'UPS': '🔋', 'Router': '📡' };
  container.innerHTML = equipTypes.map(t => `
    <a href="equipment.html?type_id=${t.id}" class="type-card" style="text-decoration:none;color:inherit;">
      <div class="type-icon" style="font-size:48px">${icons[t.name] || '📦'}</div>
      <div class="type-name" style="font-weight:600">${t.name}</div>
      <div class="type-desc" style="font-size:13px;color:var(--text-muted)">${t.description || 'ไม่มีคำอธิบาย'}</div>
    </a>
  `).join('');
}