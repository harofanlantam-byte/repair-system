// =============================================
// CONFIG
// =============================================
const API = '';
let token = localStorage.getItem('repair_token') || '';
let currentUser = JSON.parse(localStorage.getItem('repair_user') || 'null');
let equipTypes = [];

// 🔒 SECURITY: HTML escape — ป้องกัน XSS
function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/[&<>"']/g, c => ({'&':'&','<':'<','>':'>','"':'"',"'":'&#39;'}[c]));
}

// =============================================
// INIT
// =============================================
(function init() {
  const path = window.location.pathname;

  if (path.includes('index.html') || path === '/') return;

  if (!token || !currentUser) {
    const inSubdir = path.includes('/admin/') || path.includes('/user/');
    window.location.href = inSubdir ? '../index.html' : 'index.html';
    return;
  }

  // 🔒 Role-based page guard — ป้องกัน user เข้าหน้า admin-only โดยตรง
  if (currentUser && currentUser.role === 'user') {
    const adminOnlyPages = ['dashboard.html', 'user-management.html', 'history.html'];
    const pageName = path.split('/').pop();
    if (adminOnlyPages.includes(pageName)) {
      const inSubdir = path.includes('/admin/') || path.includes('/user/');
      window.location.href = inSubdir ? '../home.html' : 'home.html';
      return;
    }
  }

  const nameEl = document.getElementById('topbar-uname');
  if (nameEl) nameEl.textContent = currentUser.full_name || currentUser.username;

  const roleEl = document.getElementById('topbar-role');
  if (roleEl) {
    if (currentUser.role === 'admin') {
      roleEl.textContent = '👑 Admin';
      roleEl.style.background = 'rgba(232,93,38,0.2)';
      roleEl.style.color = '#e85d26';
    } else if (currentUser.role === 'manager') {
      roleEl.textContent = '👔 Manager';
      roleEl.style.background = 'rgba(59,130,246,0.2)';
      roleEl.style.color = '#3b82f6';
    } else {
      roleEl.textContent = '👤 User';
      roleEl.style.background = 'rgba(59,130,246,0.15)';
      roleEl.style.color = '#3b82f6';
    }
  }

  initSidebar();
  initDarkMode();

  if (path.includes('type-select.html') || path.includes('equipment.html') || path.includes('repair-form.html')) {
    loadEquipTypes();
  }
  if (path.includes('dashboard.html')) loadDashboard();
  if (path.endsWith('/history.html') || path.endsWith('\\history.html') || path === '/history.html') loadHistory();
  if (path.includes('repair-form.html')) initRepairFormPage();
})();

// =============================================
// SIDEBAR — Dynamic rendering (same menu on ALL pages)
// =============================================
function initSidebar() {
  const path = window.location.pathname;
  const userRole = currentUser ? currentUser.role : 'user';
  const isAdmin = userRole === 'admin';
  const isManager = userRole === 'manager';
  const isUserRole = !isAdmin && !isManager; // regular user only
  const parts = path.split('/').filter(p => p);
  const inSubdir = parts[0] === 'admin' || parts[0] === 'user';
  const isInUserDir = parts[0] === 'user';
  const isInAdminDir = parts[0] === 'admin';

  // 🔒 หน้า admin-only — ใช้เฉพาะ admin
  const adminOnly = ['dashboard.html', 'history.html', 'service.html', 'user-management.html'];

  // Helper: สร้างลิงค์ sidebar พร้อม active state
  function nav(href, label, extraClass) {
    const active = path.includes(href.replace('../','').replace('./','')) ? ' active' : '';
    return '<a href="' + href + '" class="nav-btn' + active + (extraClass ? ' ' + extraClass : '') + '">' + label + '</a>';
  }

  // 🔒 Shared pages (type-select, repair-form) — อยู่ที่ root level เท่านั้น
  //   user ใน user/ → ../page.html
  //   user ใน root → page.html
  //   admin ใน admin/ → ../page.html
  //   admin ใน root → page.html
  function sharedLink(page) {
    if (inSubdir) return '../' + page;
    return page;
  }

  // 🔒 Equipment page — อยู่แยกตาม role: admin → admin/equipment.html, user → user/equipment.html
  function equipmentLink() {
    const page = 'equipment.html';
    if (isUserRole) {
      if (isInUserDir) return page;
      else if (inSubdir) return '../user/' + page;
      else return 'user/' + page;
    } else {
      if (isInAdminDir) return page;
      else if (inSubdir) return '../admin/' + page;
      else return 'admin/' + page;
    }
  }

  // Helper: link สำหรับหน้า common (home, profile, my-history, account-settings) — root level
  function commonLink(page) {
    if (inSubdir) return '../' + page;
    return page;
  }

  const sidebarNav = document.querySelector('#sidebar .sidebar-nav');
  if (sidebarNav) {
    var items = [];

    // 🏠 หน้าแรก
    items.push(nav(commonLink('home.html'), '🏠 หน้าแรก'));

    // Admin separator
    if (isAdmin) {
      items.push('<div class="sidebar-divider">📊 ผู้ดูแลระบบ</div>');
      items.push(nav(isInAdminDir ? 'dashboard.html' : 'admin/dashboard.html', '📊 แดชบอร์ด', 'admin-only'));
    }

    // 🗄️ ครุภัณฑ์ — แยกตาม role: admin→admin/, user→user/
    var equipLabel = isAdmin ? '🗄️ จัดการครุภัณฑ์' : '🗄️ ครุภัณฑ์';
    items.push(nav(equipmentLink(), equipLabel));

    // 📂 ประเภท — root level (shared)
    items.push(nav(sharedLink('type-select.html'), '📂 ประเภท'));

    // 📝 แจ้งซ่อม — root level (shared)
    var repairLabel = (isAdmin || isManager) ? '📝 คำแจ้งซ่อม' : '📝 แจ้งซ่อม';
    items.push(nav(sharedLink('repair-form.html'), repairLabel));

    // 📋 ประวัติทั้งหมด (admin/manager only)
    if (isAdmin || isManager) {
      items.push(nav(isInAdminDir ? 'history.html' : 'admin/history.html', '📋 ประวัติทั้งหมด', 'admin-only'));
    }

    // 👤 บัญชีของฉัน
    items.push('<div class="sidebar-divider">👤 บัญชีของฉัน</div>');
    items.push(nav(commonLink('my-history.html'), '📋 ประวัติของฉัน'));
    items.push(nav(commonLink('profile.html'), '👤 โปรไฟล์'));
    items.push(nav(commonLink('account-settings.html'), '🔐 จัดการบัญชี'));

    // ⚙️ ผู้ดูแลระบบ
    if (isAdmin) {
      items.push('<div class="sidebar-divider admin-only">⚙️ ผู้ดูแลระบบ</div>');
      items.push(nav(isInAdminDir ? 'user-management.html' : 'admin/user-management.html', '👥 จัดการผู้ใช้', 'admin-only'));
    }

    sidebarNav.innerHTML = items.join('');
  }

  // Topbar nav — simple common links
  const topbarNav = document.getElementById('topbar-nav');
  if (topbarNav) {
    topbarNav.innerHTML = [
      nav(commonLink('home.html'), '🏠 หน้าแรก'),
      nav(commonLink('my-history.html'), '📋 ประวัติของฉัน'),
      nav(sharedLink('type-select.html'), '📂 ประเภท'),
      nav(sharedLink('repair-form.html'), '📝 แจ้งซ่อม')
    ].join('');
  }

  // Sidebar footer user info
  const nameEl = document.getElementById('sidebar-user-name');
  const roleEl = document.getElementById('sidebar-user-role');
  if (nameEl) nameEl.textContent = currentUser.full_name || currentUser.username;
  if (roleEl) {
    if (isAdmin) roleEl.textContent = '👑 Admin';
    else if (isManager) roleEl.textContent = '👔 Manager';
    else roleEl.textContent = '👤 User';
  }

  // Topbar user info
  const tName = document.getElementById('topbar-uname');
  const tRole = document.getElementById('topbar-role');
  if (tName) tName.textContent = currentUser.full_name || currentUser.username;
  if (tRole) {
    if (isAdmin) {
      tRole.textContent = '👑 Admin';
      tRole.style.background = 'rgba(232,93,38,0.2)';
      tRole.style.color = '#e85d26';
    } else if (isManager) {
      tRole.textContent = '👔 Manager';
      tRole.style.background = 'rgba(59,130,246,0.2)';
      tRole.style.color = '#3b82f6';
    } else {
      tRole.textContent = '👤 User';
      tRole.style.background = 'rgba(59,130,246,0.15)';
      tRole.style.color = '#3b82f6';
    }
  }

  // Hide admin-only elements for non-admins
  if (!isAdmin) {
    document.querySelectorAll('.admin-only').forEach(function(el) { el.style.display = 'none'; });
  }
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
  if (toggle) { toggle.textContent = saved === 'dark' ? '☀️' : '🌙'; toggle.onclick = toggleDarkMode; }
}

function toggleDarkMode() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  isDark ? html.removeAttribute('data-theme') : html.setAttribute('data-theme', 'dark');
  localStorage.setItem('repair_theme', isDark ? 'light' : 'dark');
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
      window.location.href = 'home.html';
    } else { showErr(errEl, res.message); }
  } catch (e) { showErr(errEl, 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้'); }
}

// =============================================
// สมัครสมาชิก (Self-registration)
// =============================================
function showLoginForm() {
  document.getElementById('login-form-box').style.display = 'block';
  document.getElementById('register-form-box').style.display = 'none';
}
function showRegisterForm() {
  document.getElementById('login-form-box').style.display = 'none';
  document.getElementById('register-form-box').style.display = 'block';
}

async function doRegister() {
  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value;
  const password2 = document.getElementById('reg-password2').value;
  const full_name = document.getElementById('reg-fullname').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  const errEl = document.getElementById('register-err');
  errEl.style.display = 'none';

  if (!username || !password || !full_name || !email) {
    showErr(errEl, 'กรุณากรอกข้อมูลที่มีเครื่องหมาย * ให้ครบ (ชื่อผู้ใช้, รหัสผ่าน, ชื่อ-นามสกุล, อีเมล)');
    return;
  }
  if (password.length < 8) { showErr(errEl, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'); return; }
  if (password !== password2) { showErr(errEl, 'รหัสผ่านทั้งสองช่องไม่ตรงกัน'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showErr(errEl, 'รูปแบบอีเมลไม่ถูกต้อง'); return; }

  try {
    const res = await api('POST', '/api/auth/register', { username, password, full_name, email, phone }, false);
    if (res.success) {
      token = res.token;
      currentUser = res.user;
      localStorage.setItem('repair_token', token);
      localStorage.setItem('repair_user', JSON.stringify(currentUser));
      window.location.href = 'home.html';
    } else {
      showErr(errEl, res.message);
    }
  } catch (e) { showErr(errEl, 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้'); }
}

function doLogout() {
  token = ''; currentUser = null;
  localStorage.removeItem('repair_token');
  localStorage.removeItem('repair_user');
  const path = window.location.pathname;
  const inSubdir = path.includes('/admin/') || path.includes('/user/');
  window.location.href = inSubdir ? '../index.html' : 'index.html';
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
    if (res.success) { equipTypes = res.data; populateTypeSelects(); renderTypeGrid(); }
  } catch {}
}

function populateTypeSelects() {
  ['rf-type', 'me-type', 'equip-type-filter'].forEach(id => {
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
    const df = document.getElementById('dash-date-start')?.value || '';
    const dt = document.getElementById('dash-date-end')?.value || '';
    let apiUrl = '/api/dashboard/stats?';
    if (df) apiUrl += `date_from=${encodeURIComponent(df)}&`;
    if (dt) apiUrl += `date_to=${encodeURIComponent(dt)}&`;

    const res = await api('GET', apiUrl);
    if (!res.success) return;
    document.getElementById('stat-total').textContent = res.stats.total;
    document.getElementById('stat-pending').textContent = res.stats.pending;
    document.getElementById('stat-inprogress').textContent = res.stats.in_progress;
    document.getElementById('stat-completed').textContent = res.stats.completed;
    document.getElementById('stat-urgent').textContent = res.stats.urgent;

    let recentUrl = '/api/repairs?limit=5';
    if (df) recentUrl += `&date_from=${df}`;
    if (dt) recentUrl += `&date_to=${dt}`;
    const recent = await api('GET', recentUrl);
    const tbody = document.getElementById('dash-recent');
    if (recent.success && recent.data.length) {
      tbody.innerHTML = recent.data.map(r => `<tr style="cursor:pointer" onclick="openService(${r.id})"><td style="font-family:'Space Mono';font-size:12px">${escapeHtml(r.ticket_number)}</td><td>${escapeHtml(r.equipment_name)}</td><td>${escapeHtml(r.requester_name)}</td><td>${statusBadge(r.status)}</td></tr>`).join('');
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
    data: { labels: data.map(d => d.month), datasets: [{ label: 'จำนวนคำแจ้งซ่อม', data: data.map(d => d.count), backgroundColor: 'rgba(232, 93, 38, 0.7)', borderColor: '#e85d26', borderWidth: 1, borderRadius: 4 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
  });
}

function renderStatusPieChart(stats) {
  const ctx = document.getElementById('chart-status-pie');
  if (!ctx) return;
  if (chartStatusPie) chartStatusPie.destroy();
  chartStatusPie = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: ['รอดำเนินการ','กำลังดำเนินการ','ส่งซ่อม','ซ่อมสำเร็จ'], datasets: [{ data: [stats.pending||0, stats.in_progress||0, stats.sent_repair||0, stats.completed||0], backgroundColor: ['#f59e0b','#3b82f6','#8b5cf6','#10b981'], borderWidth: 2, borderColor: '#fff' }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true } } } }
  });
}

// =============================================
// REPAIR FORM
// =============================================
function initRepairFormPage() {}

// =============================================
// HISTORY
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
      const isAdmin = currentUser && currentUser.role === 'admin';
      tbody.innerHTML = res.data.map(r => `<tr onclick="openService(${r.id})" style="cursor:pointer">
        <td style="font-family:'Space Mono';font-size:12px">${escapeHtml(r.ticket_number)}</td>
        <td>${escapeHtml(r.equipment_name) || '-'}</td>
        <td>${escapeHtml(r.type_name) || '-'}</td>
        <td>${escapeHtml(r.requester_name) || '-'}</td>
        <td>${formatDate(r.requested_at)}</td>
        <td>${priorityBadge(r.priority)}</td>
        <td>${statusBadge(r.status)}</td>
        <td>${isAdmin ? `<button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteRepair(${r.id},'${escapeHtml(r.ticket_number)}')">🗑️</button>` : ''}</td>
      </tr>`).join('');
    } else {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:32px">ไม่พบข้อมูล</td></tr>';
    }
  } catch {}
}

// =============================================
// SERVICE
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
      const isAdmin = currentUser && currentUser.role === 'admin';
      container.innerHTML = `<div class="card mb-20">
          <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;">
            <div><h3>🔧 รายละเอียดคำแจ้งซ่อม</h3><small style="font-family:'Space Mono'">#${escapeHtml(r.ticket_number)}</small></div>
            <div>${statusBadge(r.status)}</div>
          </div>
          <div class="card-body">
            <div class="grid-2">
              <div><strong>ครุภัณฑ์:</strong> ${escapeHtml(r.equipment_name)}</div>
              <div><strong>รหัสครุภัณฑ์:</strong> ${escapeHtml(r.equipment_code)}</div>
              <div><strong>ประเภท:</strong> ${escapeHtml(r.type_name)}</div>
              <div><strong>ผู้แจ้ง:</strong> ${escapeHtml(r.requester_name)}</div>
              <div><strong>สถานที่:</strong> ${escapeHtml([r.location_building, r.location_department, r.location_room].filter(Boolean).join(' > ') || '-')}</div>
              <div><strong>ความเร่งด่วน:</strong> ${priorityBadge(r.priority)}</div>
            </div>
            <div style="margin-top:12px"><strong>อาการที่พบ:</strong><p>${escapeHtml(r.problem_description || '-')}</p></div>
            ${r.equipment_parts ? `<div style="margin-top:12px"><strong>ชิ้นส่วน:</strong> ${escapeHtml(r.equipment_parts)}</div>` : ''}
            ${r.image_path ? `<div style="margin-top:12px"><img src="${escapeHtml(r.image_path)}" style="max-width:300px;border-radius:8px"></div>` : ''}
            ${r.admin_note ? `<div style="margin-top:12px"><strong>บันทึก Admin:</strong> ${escapeHtml(r.admin_note)}</div>` : ''}
          </div>
        </div>
        ${r.repair_cost ? `<div class="card mb-20"><div class="card-header"><h3>💰 ค่าใช้จ่าย</h3></div><div class="card-body"><div><strong>ค่าใช้จ่าย:</strong> ${Number(r.repair_cost).toLocaleString()} บาท</div>${r.cost_note ? '<div><strong>หมายเหตุ:</strong> ' + escapeHtml(r.cost_note) + '</div>' : ''}</div></div>` : ''}
        <div class="card mb-20"><div class="card-header"><h3>📋 ประวัติการดำเนินการ</h3></div><div class="card-body">${res.history && res.history.length ? res.history.map(h => `<div style="display:flex;gap:12px;padding:8px 0;border-bottom:1px solid var(--border)"><div style="min-width:100px;font-size:12px;color:var(--text-muted)">${formatDate(h.changed_at)}</div><div>${statusBadge(h.new_status)}</div><div style="color:var(--text-muted)">${escapeHtml(h.note || '')} ${h.admin_name ? '- ' + escapeHtml(h.admin_name) : ''}</div></div>`).join('') : '<div style="color:var(--text-muted)">ไม่มีประวัติ</div>'}</div></div>
        ${isAdmin ? `<div class="card"><div class="card-header"><h3>⚙️ จัดการสถานะ</h3></div><div class="card-body">
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <select id="sv-status" class="form-input" style="width:200px">
                <option value="">-- เลือกสถานะ --</option>
                <option value="in_progress">กำลังดำเนินการ</option><option value="received">รับครุภัณฑ์</option><option value="sent_repair">ส่งซ่อม</option><option value="completed">ซ่อมเสร็จ</option><option value="returned">คืนผู้แจ้ง</option><option value="cancelled">ยกเลิก</option>
              </select>
              <input type="text" id="sv-note" class="form-input" style="width:250px" placeholder="หมายเหตุ (ถ้ามี)">
              <button class="btn btn-primary" onclick="updateServiceStatus(${id})">💾 อัพเดต</button>
            </div>
            <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
              <button class="btn btn-outline" onclick="openRepairDoc(${id})">📄 ดูเอกสาร</button>
              <button class="btn btn-outline" onclick="exportExcel(${id})">📊 Export Excel</button>
            </div>
        </div></div>` : ''}`;
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
function openService(id) {
  const path = window.location.pathname;
  const isAdmin = currentUser && currentUser.role === 'admin';
  if (isAdmin) {
    const parts = path.split('/').filter(p => p);
    const inSubdir = parts[0] === 'admin' || parts[0] === 'user';
    window.location.href = (inSubdir ? '' : 'admin/') + 'service.html?id=' + id;
  } else {
    window.location.href = 'service.html?id=' + id;
  }
}

function openRepairDoc(id) {
  localStorage.setItem('repair_document_single', JSON.stringify({ id }));
  const parts = window.location.pathname.split('/').filter(p => p);
  const inSubdir = parts[0] === 'admin' || parts[0] === 'user';
  window.location.href = (inSubdir ? '../' : '') + 'repair-document.html?id=' + id;
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
// SKELETON UI HELPERS
// =============================================
function skeletonRow(cols, wideIdx) {
  let cells = '';
  for (let i = 0; i < cols; i++) {
    var cls = '';
    if (wideIdx !== undefined && wideIdx === i) cls = ' sk-cell-xl';
    else if (wideIdx !== undefined && wideIdx + 1 === i) cls = ' sk-cell-lg';
    else if (i === 0) cls = ' sk-cell-sm';
    else cls = ' sk-cell-md';
    cells += '<div class="sk-cell skeleton' + cls + '"></div>';
  }
  return '<div class="skeleton-row">' + cells + '</div>';
}

function skeletonTable(rows, cols, wideIdx) {
  var html = '';
  for (var i = 0; i < rows; i++) html += skeletonRow(cols, wideIdx);
  return html;
}

function skeletonGrid(count) {
  var html = '';
  for (var i = 0; i < count; i++) {
    html += '<div class="skeleton-card"><div class="sk-icon skeleton"></div><div class="sk-title skeleton"></div><div class="sk-sub skeleton"></div></div>';
  }
  return html;
}

function skeletonStats(count) {
  var html = '';
  for (var i = 0; i < count; i++) {
    html += '<div class="skeleton-stat"><div class="sk-num skeleton"></div><div class="sk-label skeleton"></div></div>';
  }
  return html;
}


// =============================================
// NOTIFICATION BELL (Topbar)
// =============================================
function initNotificationBell() {
  const topbarRight = document.querySelector('.topbar-right');
  if (!topbarRight || document.getElementById('notification-bell')) return;
  
  const bellBtn = document.createElement('button');
  bellBtn.id = 'notification-bell';
  bellBtn.title = 'การแจ้งเตือน';
  bellBtn.innerHTML = '🔔<span class="badge" id="notif-count"></span>';
  bellBtn.onclick = toggleNotificationDropdown;
  
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    topbarRight.insertBefore(bellBtn, themeToggle);
  } else {
    topbarRight.prepend(bellBtn);
  }
  
  const indicator = document.createElement('span');
  indicator.className = 'rt-indicator';
  indicator.innerHTML = '<span class="rt-dot"></span> Live';
  topbarRight.appendChild(indicator);
  
  const dropdown = document.createElement('div');
  dropdown.className = 'notif-dropdown';
  dropdown.id = 'notif-dropdown';
  dropdown.innerHTML = `
    <div class="notif-dropdown-header">
      <span>🔔 การแจ้งเตือน</span>
      <button onclick="clearNotifications()">ล้างทั้งหมด</button>
    </div>
    <div class="notif-dropdown-empty">ยังไม่มีการแจ้งเตือน</div>
  `;
  document.body.appendChild(dropdown);
  
  renderNotificationDropdown();
}

let notificationCount = 0;
let notificationsList = JSON.parse(localStorage.getItem('repair_notifications') || '[]');

function addNotification(notif) {
  notif.id = Date.now();
  notif.time = new Date().toLocaleTimeString('th-TH');
  notif.read = false;
  notificationsList.unshift(notif);
  if (notificationsList.length > 50) notificationsList = notificationsList.slice(0, 50);
  localStorage.setItem('repair_notifications', JSON.stringify(notificationsList));
  updateBellBadge();
  renderNotificationDropdown();
}

function updateBellBadge() {
  const unread = notificationsList.filter(n => !n.read).length;
  notificationCount = unread;
  const badge = document.getElementById('notif-count');
  if (badge) {
    badge.textContent = unread > 0 ? unread : '';
    badge.style.display = unread > 0 ? 'flex' : 'none';
  }
}

function toggleNotificationDropdown() {
  const dropdown = document.getElementById('notif-dropdown');
  if (!dropdown) return;
  dropdown.classList.toggle('show');
  if (dropdown.classList.contains('show')) {
    markAllNotificationsRead();
  }
}

function markAllNotificationsRead() {
  notificationsList.forEach(n => n.read = true);
  localStorage.setItem('repair_notifications', JSON.stringify(notificationsList));
  updateBellBadge();
}

function clearNotifications() {
  notificationsList = [];
  localStorage.setItem('repair_notifications', JSON.stringify([]));
  updateBellBadge();
  renderNotificationDropdown();
}

function renderNotificationDropdown() {
  const dropdown = document.getElementById('notif-dropdown');
  if (!dropdown) return;
  
  let html = `
    <div class="notif-dropdown-header">
      <span>🔔 การแจ้งเตือน</span>
      <button onclick="clearNotifications()">ล้างทั้งหมด</button>
    </div>
  `;
  
  if (notificationsList.length === 0) {
    html += '<div class="notif-dropdown-empty">ยังไม่มีการแจ้งเตือน</div>';
  } else {
    html += notificationsList.slice(0, 20).map(n => `
      <div class="notif-item ${n.read ? '' : 'unread'}" onclick="markNotifRead(${n.id})">
        <div class="notif-title">${escapeHtml(n.title || 'แจ้งเตือน')}</div>
        <div class="notif-msg">${escapeHtml(n.message || n.msg || '')}</div>
        <div class="notif-time">${escapeHtml(n.time || '')}</div>
      </div>
    `).join('');
  }
  
  dropdown.innerHTML = html;
}

function markNotifRead(id) {
  const notif = notificationsList.find(n => n.id === id);
  if (notif) notif.read = true;
  localStorage.setItem('repair_notifications', JSON.stringify(notificationsList));
  updateBellBadge();
  renderNotificationDropdown();
}

// =============================================
// SOCKET.IO Integration
// =============================================
function initSocketIntegration() {
  if (!window.socketClient) return;
  
  const path = window.location.pathname;
  
  window.socketClient.on('connect', () => {
    const indicator = document.querySelector('.rt-indicator');
    if (indicator) indicator.classList.add('connected');
  });
  
  window.socketClient.on('disconnect', () => {
    const indicator = document.querySelector('.rt-indicator');
    if (indicator) indicator.classList.remove('connected');
  });
  
  if (window.socketClient.isConnected && window.socketClient.isConnected()) {
    const indicator = document.querySelector('.rt-indicator');
    if (indicator) indicator.classList.add('connected');
  }
  
  window.socketClient.on('new-notification', (data) => {
    showToast(data.message || data.title, data.type === 'error' ? 'error' : 'info', {
      title: data.title,
      onClick: () => {
        if (data.data && data.data.repair_id) {
          openService(data.data.repair_id);
        }
      }
    });
    
    addNotification({
      title: data.title,
      message: data.message,
      type: data.type || 'info'
    });
    
    if (path.includes('dashboard.html') && typeof loadDashboard === 'function') {
      setTimeout(() => loadDashboard(), 500);
    }
    
    if ((path.includes('history.html') || path.includes('my-history.html')) && typeof loadHistory === 'function') {
      setTimeout(() => loadHistory(), 500);
    }
  });
  
  window.socketClient.on('repair-updated', (data) => {
    addNotification({
      title: data.title || 'อัปเดตสถานะ',
      message: data.message,
      type: 'warning'
    });
    
    if (path.includes('dashboard.html') && typeof loadDashboard === 'function') {
      setTimeout(() => loadDashboard(), 500);
    }
    
    if ((path.includes('history.html') || path.includes('my-history.html')) && typeof loadHistory === 'function') {
      setTimeout(() => loadHistory(), 500);
    }
  });

  window.socketClient.on('repair-completed', (data) => {
    addNotification({
      title: '✅ ' + (data.title || 'ซ่อมสำเร็จ!'),
      message: data.message,
      type: 'success'
    });

    if (path.includes('dashboard.html') && typeof loadDashboard === 'function') {
      setTimeout(() => loadDashboard(), 500);
    }
    
    if ((path.includes('history.html') || path.includes('my-history.html')) && typeof loadHistory === 'function') {
      setTimeout(() => loadHistory(), 500);
    }

    if (path.includes('service.html') && typeof loadServiceData === 'function') {
      setTimeout(() => loadServiceData(), 500);
    }
  });
}

// =============================================
// 🛎️ Toast Notification System
// =============================================
function showToast(message, type, options) {
  if (type === undefined) type = 'info';
  var opts = options;
  if (typeof options === 'number') {
    opts = { duration: options };
  }
  if (!opts) opts = {};

  const duration = opts.duration || 4000;
  const title = opts.title || null;

  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 420px;
    `;
    document.body.appendChild(container);
  }

  const config = {
    info:    { bg: '#1a73e8', icon: '\u2139\ufe0f', emoji: '\ud83d\udce2' },
    success: { bg: '#16a34a', icon: '\u2705', emoji: '\ud83c\udf89' },
    warning: { bg: '#d97706', icon: '\u26a0\ufe0f', emoji: '\ud83d\udd27' },
    error:   { bg: '#dc2626', icon: '\u274c', emoji: '\ud83d\udea8' }
  };
  const cfg = config[type] || config.info;

  const toast = document.createElement('div');
  toast.style.cssText = `
    background: ${cfg.bg};
    color: white;
    padding: 14px 20px;
    border-radius: 10px;
    box-shadow: 0 6px 24px rgba(0,0,0,0.2);
    font-family: 'Sarabun', 'Tahoma', sans-serif;
    font-size: 14px;
    line-height: 1.5;
    display: flex;
    align-items: flex-start;
    gap: 10px;
    animation: toastSlideIn 0.35s ease-out;
    cursor: pointer;
    transition: opacity 0.3s, transform 0.3s;
  `;

  const titleHtml = title ? `<strong style="display:block;margin-bottom:2px;">${title}</strong>` : '';
  toast.innerHTML = `
    <span style="font-size:18px;flex-shrink:0;">${cfg.emoji}</span>
    <span style="flex:1;">${titleHtml}${message}</span>
    <span style="font-size:12px;opacity:0.7;cursor:pointer;flex-shrink:0;padding:2px;" 
          onclick="this.parentElement.remove()">\u2715</span>
  `;

  toast.addEventListener('click', (e) => {
    if (e.target.tagName === 'SPAN' && e.target.textContent === '\u2715') return;
    if (opts.onClick) {
      opts.onClick();
    }
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  });

  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }
  }, duration);
}

(function addToastStyles() {
  if (document.getElementById('toast-styles')) return;
  const style = document.createElement('style');
  style.id = 'toast-styles';
  style.textContent = `
    @keyframes toastSlideIn {
      from { opacity: 0; transform: translateX(100%); }
      to   { opacity: 1; transform: translateX(0); }
    }
  `;
  document.head.appendChild(style);
})();

// =============================================
// 🔔 Notification Badge Management
// =============================================
function updateNotificationBadge() {
  const badge = document.getElementById('noti-badge-count');
  if (!badge) return;

  try {
    const stored = JSON.parse(localStorage.getItem('noti_unread_count') || '0');
    const count = parseInt(stored) || 0;
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  } catch (e) {
    badge.style.display = 'none';
  }
}

function clearNotificationBadge() {
  localStorage.setItem('noti_unread_count', '0');
  updateNotificationBadge();
}

function incrementUnreadCount() {
  try {
    const stored = JSON.parse(localStorage.getItem('noti_unread_count') || '0');
    const count = (parseInt(stored) || 0) + 1;
    localStorage.setItem('noti_unread_count', count.toString());
    updateNotificationBadge();
  } catch (e) {
    // ignore
  }
}

(function patchBadgeIncrement() {
  const origInterval = setInterval(() => {
    if (window.socketClient && window.socketClient._incrementBadge) {
      const orig = window.socketClient._incrementBadge;
      window.socketClient._incrementBadge = function () {
        incrementUnreadCount();
        return orig.call(this);
      };
      clearInterval(origInterval);
      console.log('✅ [Noti] Badge increment patched to use localStorage');
    }
  }, 500);
  setTimeout(() => clearInterval(origInterval), 10000);
})();

document.addEventListener('DOMContentLoaded', () => {
  initNotificationBell();
  updateNotificationBadge();
  
  setTimeout(() => {
    initSocketIntegration();
  }, 1500);
});

// =============================================
// PROFILE FUNCTIONS
// =============================================
async function loadProfile() {
  try {
    const res = await api('GET', '/api/profile');
    if (res.success) {
      const user = res.data;
      const uname = document.getElementById('profile-username');
      const fname = document.getElementById('profile-fullname');
      const email = document.getElementById('profile-email');
      const phone = document.getElementById('profile-phone');
      if (uname) uname.value = user.username || '';
      if (fname) fname.value = user.full_name || '';
      if (email) email.value = user.email || '';
      if (phone) phone.value = user.phone || '';
      if (user.avatar) {
        const imgEl = document.getElementById('avatar-img');
        const iconEl = document.getElementById('avatar-icon');
        if (imgEl && iconEl) {
          imgEl.src = user.avatar + '?t=' + Date.now();
          imgEl.style.display = 'block';
          iconEl.style.display = 'none';
        }
      }
    }
  } catch (e) {
    console.error('Error loading profile:', e);
  }
}

async function updateProfile() {
  const full_name = document.getElementById('profile-fullname').value.trim();
  const email = document.getElementById('profile-email').value.trim();
  const phone = document.getElementById('profile-phone').value.trim();
  const alertEl = document.getElementById('profile-alert');
  
  if (!full_name) {
    if (alertEl) alertEl.innerHTML = '<div class="alert alert-error">❌ กรุณากรอกชื่อ-นามสกุล</div>';
    return;
  }
  
  try {
    const res = await api('PUT', '/api/profile', { full_name, email, phone });
    if (res.success) {
      if (alertEl) alertEl.innerHTML = '<div class="alert alert-success">✅ อัพเดตโปรไฟล์สำเร็จ</div>';
      setTimeout(() => { if (alertEl) alertEl.innerHTML = ''; }, 3000);
      const topbarName = document.getElementById('topbar-uname');
      if (topbarName) topbarName.textContent = full_name;
      const user = JSON.parse(localStorage.getItem('repair_user') || '{}');
      user.full_name = full_name;
      localStorage.setItem('repair_user', JSON.stringify(user));
    } else {
      if (alertEl) alertEl.innerHTML = `<div class="alert alert-error">❌ ${res.message}</div>`;
    }
  } catch {
    if (alertEl) alertEl.innerHTML = '<div class="alert alert-error">❌ เกิดข้อผิดพลาด</div>';
  }
}

function resetProfileForm() {
  document.getElementById('profile-alert').innerHTML = '';
}

async function loadMyStats() {
  try {
    const res = await api('GET', '/api/repairs?limit=1000');
    if (res.success) {
      const repairs = res.data;
      const total = repairs.length;
      const pending = repairs.filter(r => r.status === 'pending').length;
      const completed = repairs.filter(r => r.status === 'completed').length;
      const totalCost = repairs.reduce((sum, r) => sum + (parseFloat(r.repair_cost) || 0), 0);
      
      const totalEl = document.getElementById('my-stat-total');
      const pendingEl = document.getElementById('my-stat-pending');
      const completedEl = document.getElementById('my-stat-completed');
      const costEl = document.getElementById('my-stat-cost');
      
      if (totalEl) totalEl.textContent = total;
      if (pendingEl) pendingEl.textContent = pending;
      if (completedEl) completedEl.textContent = completed;
      if (costEl) costEl.textContent = totalCost.toLocaleString();
    }
  } catch {}
}

async function uploadAvatar(file) {
  const formData = new FormData();
  formData.append('avatar', file);
  const statusEl = document.getElementById('avatar-status');
  try {
    statusEl.innerHTML = '<div style="color:var(--accent);">⏳ กำลังอัปโหลด...</div>';
    const response = await fetch('/api/profile/avatar', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
      body: formData
    });
    const result = await response.json();
    if (result.success) {
      document.getElementById('avatar-img').src = result.avatar + '?t=' + Date.now();
      document.getElementById('avatar-img').style.display = 'block';
      document.getElementById('avatar-icon').style.display = 'none';
      statusEl.innerHTML = '<div style="color:#22c55e;">✅ อัปโหลดสำเร็จ</div>';
    } else {
      statusEl.innerHTML = `<div style="color:#ef4444;">❌ ${result.message}</div>`;
    }
  } catch {
    statusEl.innerHTML = '<div style="color:#ef4444;">❌ เกิดข้อผิดพลาด</div>';
  }
}

// TYPE GRID (type-select.html)
// =============================================
function renderTypeGrid() {
  const container = document.getElementById('type-grid');
  if (!container) return;
  const loadingEl = document.getElementById('loadingState');
  if (loadingEl) loadingEl.style.display = 'none';
  const countEl = document.getElementById('typeCount');
  if (countEl) countEl.textContent = equipTypes.length ? `ทั้งหมด ${equipTypes.length} ประเภท` : '0 ประเภท';
  if (!equipTypes.length) {
    container.innerHTML = '<div style="text-align:center;padding:48px">ยังไม่มีประเภทครุภัณฑ์ในระบบ</div>';
    return;
  }
  const icons = { 'คอมพิวเตอร์': '🖥️', 'เครื่องถ่ายเอกสาร': '🖨️', 'UPS': '🔋', 'Router': '📡' };
  // 🔒 Role-based routing — ต้องคำนึงถึง directory ปัจจุบันด้วย
  //   user ใน user/ → equipment.html
  //   user ใน root → user/equipment.html
  //   admin ใน admin/ → equipment.html
  //   admin ใน root → admin/equipment.html
  const userRole = currentUser ? currentUser.role : 'user';
  const parts = window.location.pathname.split('/').filter(p => p);
  const inSubdir = parts[0] === 'admin' || parts[0] === 'user';
  const isAdminOrMgr = userRole === 'admin' || userRole === 'manager';
  let equipPath;
  if (isAdminOrMgr) {
    equipPath = (parts[0] === 'admin') ? 'equipment.html' : 'admin/equipment.html';
  } else {
    equipPath = (parts[0] === 'user') ? 'equipment.html' : 'user/equipment.html';
  }
  container.innerHTML = equipTypes.map(t => `
    <a href="${equipPath}?type_id=${t.id}" class="type-card" style="text-decoration:none;color:inherit;">
      <div class="type-icon" style="font-size:48px">${icons[t.name] || '📦'}</div>
      <div class="type-name" style="font-weight:600">${t.name}</div>
      <div class="type-desc" style="font-size:13px;color:var(--text-muted)">${t.description || 'ไม่มีคำอธิบาย'}</div>
    </a>
  `).join('');
}