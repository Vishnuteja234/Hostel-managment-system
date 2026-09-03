// ============================================================
// HostelEats — Shared API client + UI utilities  (v3)
// ============================================================
const API_BASE = '/api';

// --- Auth storage ---
const getToken  = ()       => localStorage.getItem('hfms_token');
const getUser   = ()       => JSON.parse(localStorage.getItem('hfms_user') || 'null');
const setAuth   = (t, u)   => { localStorage.setItem('hfms_token', t); localStorage.setItem('hfms_user', JSON.stringify(u)); };
const clearAuth = ()       => { localStorage.removeItem('hfms_token'); localStorage.removeItem('hfms_user'); };

// --- Core fetch ---
async function apiFetch(endpoint, options = {}) {
  const token   = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res  = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

// --- API namespaces ---
const authAPI = {
  register:        (b) => apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(b) }),
  login:           (b) => apiFetch('/auth/login',    { method: 'POST', body: JSON.stringify(b) }),
  me:              ()  => apiFetch('/auth/me'),
  updateProfile:   (b) => apiFetch('/auth/profile',           { method: 'PUT',  body: JSON.stringify(b) }),
  updateNotifPrefs:(b) => apiFetch('/auth/notification-prefs',{ method: 'PUT',  body: JSON.stringify(b) }),
};

const menuAPI = {
  getAll:   (p = '') => apiFetch(`/menu${p}`),
  getToday: ()       => apiFetch('/menu/today'),
  create:   (b)      => apiFetch('/menu', { method: 'POST', body: JSON.stringify(b) }),
  update:   (id, b)  => apiFetch(`/menu/${id}`, { method: 'PUT',  body: JSON.stringify(b) }),
  delete:   (id)     => apiFetch(`/menu/${id}`, { method: 'DELETE' }),
  notify:   (id)     => apiFetch(`/menu/${id}/notify`, { method: 'POST' }),
};

const bookingAPI = {
  book:        (b)      => apiFetch('/bookings/book-meal', { method: 'POST', body: JSON.stringify(b) }),
  cancel:      (b)      => apiFetch('/bookings/cancel',    { method: 'PUT',  body: JSON.stringify(b) }),
  myMeals:     (p = '') => apiFetch(`/bookings/my-meals${p}`),
  getQR:       (id)     => apiFetch(`/bookings/qr/${id}`),
  mealCount:   (p = '') => apiFetch(`/bookings/meal-count${p}`),
  attendance:  (p = '') => apiFetch(`/bookings/attendance${p}`),
  markConsumed:(b)      => apiFetch('/bookings/mark-consumed', { method: 'PUT', body: JSON.stringify(b) }),
  scan:        (b)      => apiFetch('/bookings/scan', { method: 'POST', body: JSON.stringify(b) }),
  deadlineCheck:(d,m)   => apiFetch(`/bookings/deadline-check?date=${d}&mealType=${m}`),
};

const feedbackAPI = {
  submit:  (b)      => apiFetch('/feedback', { method: 'POST', body: JSON.stringify(b) }),
  getAll:  (p = '') => apiFetch(`/feedback${p}`),
  summary: ()       => apiFetch('/feedback/summary'),
};

const adminAPI = {
  dashboard:     () => apiFetch('/admin/dashboard'),
  students:      () => apiFetch('/admin/students'),
  deleteStudent: (id) => apiFetch(`/admin/students/${id}`, { method: 'DELETE' }),
};

const billingAPI = {
  myBill:      (month) => apiFetch(`/billing/my-bill?month=${month}`),
  allBills:    (month) => apiFetch(`/billing/all?month=${month}`),
  generate:    (month) => apiFetch(`/billing/generate?month=${month}`, { method: 'POST' }),
  updateStatus:(id, b) => apiFetch(`/billing/${id}/status`, { method: 'PUT', body: JSON.stringify(b) }),
  downloadPDF: async (id, name, month) => {
    const res = await fetch(`${API_BASE}/billing/${id}/pdf`, { headers: { Authorization: `Bearer ${getToken()}` } });
    if (!res.ok) throw new Error('PDF generation failed');
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: `bill-${name}-${month}.pdf` });
    a.click(); URL.revokeObjectURL(url);
  }
};

const analyticsAPI = {
  myHistory: (months = 3)  => apiFetch(`/analytics/my-history?months=${months}`),
  wastage:   (weeks  = 4)  => apiFetch(`/analytics/wastage?weeks=${weeks}`),
};

const aiAPI = {
  generateMenu: (theme) => apiFetch('/ai/generate-menu', { method: 'POST', body: JSON.stringify({ theme }) }),
};

// ============================================================
// TOAST NOTIFICATION SYSTEM
// ============================================================
(function initToast() {
  const container = document.createElement('div');
  container.id = 'toast-container';
  container.style.cssText = `
    position:fixed; bottom:24px; right:24px; z-index:9999;
    display:flex; flex-direction:column-reverse; gap:10px; pointer-events:none;
  `;
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(container));
})();

function showToast(message, type = 'info', duration = 4000) {
  const colors = {
    success: { bg: 'rgba(74,222,128,0.12)',  border: 'rgba(74,222,128,0.4)',  icon: '✅', text: '#4ade80' },
    error:   { bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.4)', icon: '❌', text: '#f87171' },
    info:    { bg: 'rgba(46,196,182,0.12)',   border: 'rgba(46,196,182,0.4)',  icon: 'ℹ️', text: '#2ec4b6' },
    warning: { bg: 'rgba(251,191,36,0.12)',   border: 'rgba(251,191,36,0.4)',  icon: '⚠️', text: '#fbbf24' },
  };
  const c = colors[type] || colors.info;
  const toast = document.createElement('div');
  toast.style.cssText = `
    background:${c.bg}; border:1px solid ${c.border}; color:#f0f2f8;
    padding:12px 16px; border-radius:10px; font-size:13px; font-family:'DM Sans',sans-serif;
    display:flex; align-items:center; gap:10px; pointer-events:all;
    max-width:320px; box-shadow:0 8px 24px rgba(0,0,0,0.4);
    animation: toastIn 0.3s ease; backdrop-filter:blur(8px);
  `;
  toast.innerHTML = `
    <span style="font-size:16px;flex-shrink:0">${c.icon}</span>
    <span style="flex:1;color:${c.text}">${message}</span>
    <button onclick="this.parentElement.remove()" style="background:none;border:none;color:#8b91a8;cursor:pointer;font-size:16px;padding:0;line-height:1">×</button>
  `;
  if (!document.querySelector('#toast-keyframes')) {
    const style = document.createElement('style');
    style.id = 'toast-keyframes';
    style.textContent = `@keyframes toastIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:none}}`;
    document.head.appendChild(style);
  }
  const container = document.getElementById('toast-container');
  if (container) {
    container.appendChild(toast);
    setTimeout(() => toast.style.cssText += 'opacity:0;transition:opacity 0.3s', duration - 300);
    setTimeout(() => toast.remove(), duration);
  }
  return toast;
}

// ============================================================
// CONFIRM DIALOG (replaces browser confirm())
// ============================================================
function showConfirm(message, title = 'Are you sure?') {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9998;
      display:flex;align-items:center;justify-content:center;padding:20px;
      backdrop-filter:blur(4px); animation:fadeIn 0.15s ease;
    `;
    overlay.innerHTML = `
      <div style="background:#1a1d27;border:1px solid rgba(255,255,255,0.08);border-radius:14px;
           padding:28px;max-width:380px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.5);
           animation:modalIn 0.2s ease; font-family:'DM Sans',sans-serif;">
        <div style="font-size:28px;margin-bottom:12px;text-align:center">⚠️</div>
        <h3 style="font-family:'Syne',sans-serif;font-weight:700;font-size:17px;margin:0 0 8px;text-align:center;color:#f0f2f8">${title}</h3>
        <p style="color:#8b91a8;font-size:14px;text-align:center;margin:0 0 24px;line-height:1.5">${message}</p>
        <div style="display:flex;gap:10px">
          <button id="confirmNo" style="flex:1;padding:11px;background:#252836;border:1px solid rgba(255,255,255,0.08);color:#8b91a8;border-radius:8px;font-size:14px;cursor:pointer;font-family:'DM Sans',sans-serif">Cancel</button>
          <button id="confirmYes" style="flex:1;padding:11px;background:#f87171;border:none;color:white;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;font-family:'Syne',sans-serif">Confirm</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#confirmYes').onclick = () => { overlay.remove(); resolve(true);  };
    overlay.querySelector('#confirmNo').onclick  = () => { overlay.remove(); resolve(false); };
    overlay.onclick = (e) => { if (e.target === overlay) { overlay.remove(); resolve(false); } };
  });
}

// ============================================================
// SKELETON LOADER
// ============================================================
function skeletonCards(count = 3, height = '120px') {
  return Array.from({ length: count }, () => `
    <div style="background:var(--dark-2);border:1px solid var(--border);border-radius:14px;
         padding:20px;height:${height};overflow:hidden;position:relative;">
      <div class="skeleton-shimmer" style="position:absolute;inset:0;
        background:linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.04) 50%,transparent 100%);
        background-size:200% 100%;animation:shimmer 1.5s infinite;"></div>
      <div style="height:12px;background:rgba(255,255,255,0.06);border-radius:6px;width:60%;margin-bottom:12px"></div>
      <div style="height:10px;background:rgba(255,255,255,0.04);border-radius:6px;width:40%;margin-bottom:8px"></div>
      <div style="height:10px;background:rgba(255,255,255,0.04);border-radius:6px;width:80%"></div>
    </div>
  `).join('');
}

function skeletonRows(count = 4) {
  return `<div style="background:var(--dark-2);border:1px solid var(--border);border-radius:14px;overflow:hidden">
    ${Array.from({ length: count }, (_, i) => `
      <div style="padding:14px 20px;border-bottom:1px solid var(--border);display:flex;gap:16px;align-items:center;${i===0?'background:var(--dark-3)':''}">
        ${[60,100,80,120].map(w => `<div style="height:10px;background:rgba(255,255,255,0.06);border-radius:5px;width:${w}px"></div>`).join('')}
      </div>`).join('')}
  </div>`;
}

if (!document.querySelector('#skeleton-style')) {
  const s = document.createElement('style');
  s.id = 'skeleton-style';
  s.textContent = `@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`;
  document.head.appendChild(s);
}

// ============================================================
// SHARED UTILITIES
// ============================================================
function logout() { clearAuth(); window.location.href = '/'; }

function requireAuth() {
  const token = getToken(); const user = getUser();
  if (!token || !user) { window.location.href = '/'; return null; }
  return user;
}

function todayStr() { return new Date().toISOString().split('T')[0]; }

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function starsHTML(rating) {
  return Array.from({ length: 5 }, (_, i) =>
    `<span style="color:${i < rating ? '#fbbf24' : '#333'}">★</span>`
  ).join('');
}

function toggleSidebar() { document.getElementById('sidebar')?.classList.toggle('open'); }

function goToPage(pageId) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.page === pageId));
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === `page-${pageId}`));
  const label = document.querySelector(`[data-page="${pageId}"] span:last-child`)?.textContent || pageId;
  const el = document.getElementById('pageTitle'); if (el) el.textContent = label;
}

// Legacy showAlert — now delegates to toast
function showAlert(elId, message, type = 'error') {
  const el = document.getElementById(elId);
  if (el) {
    el.className = `alert alert-${type}`;
    el.textContent = message;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 4500);
  }
  showToast(message, type === 'success' ? 'success' : type === 'error' ? 'error' : 'info');
}

function downloadQR(dataUrl, filename) {
  const a = Object.assign(document.createElement('a'), { href: dataUrl, download: `meal-qr-${filename}.png` });
  a.click();
}

// Month options helper
function monthOptions(selectedMonth) {
  const opts = []; const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = d.toISOString().slice(0, 7);
    opts.push(`<option value="${val}" ${val === selectedMonth ? 'selected' : ''}>${d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</option>`);
  }
  return opts.join('');
}
