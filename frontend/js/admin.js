// ============================================================
// HostelEats — Admin Dashboard
// ============================================================
const MEAL_PRICES = { breakfast: 60, lunch: 60, snacks: 50, dinner: 70 };
const MEAL_EMOJI  = { breakfast: '🌅', lunch: '☀️', snacks: '🍪', dinner: '🌙' };
let currentBillId = null;

(function init() {
  const user = requireAuth();
  if (!user) return;
  if (user.role !== 'admin') { window.location.href = '/pages/student.html'; return; }

  document.getElementById('sidebarName').textContent   = user.name;
  document.getElementById('sidebarAvatar').textContent = user.name[0].toUpperCase();
  document.getElementById('currentDate').textContent   = new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' });

  const today   = todayStr();
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const setVal  = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };

  setVal('mealCountDate',      today);
  setVal('attendanceDate',     today);
  setVal('feedbackFilterDate', today);
  setVal('menuFilterStart',    weekAgo.toISOString().split('T')[0]);
  setVal('menuFilterEnd',      today);
  setVal('exportStart',        weekAgo.toISOString().split('T')[0]);
  setVal('exportEnd',          today);

  ['billingMonth', 'generateBillingMonth'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = monthOptions(today.slice(0, 7));
  });

  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const page = item.dataset.page;
      if (!page) return;
      goToPage(page);
      loadAdminPageData(page);
    });
  });

  // Try to load PhonePe QR image
  const qrBox = document.getElementById('paymentQRBox');
  if (qrBox) {
    const img = new Image();
    img.onload = () => { qrBox.innerHTML = ''; qrBox.appendChild(img); };
    img.style.cssText = 'width:200px;height:200px;object-fit:contain';
    img.src = '../phonepe-qr.png';
    img.alt = 'PhonePe QR';
  }

  loadDashboard();
})();

function loadAdminPageData(page) {
  const map = {
    dashboard:    loadDashboard,
    'menu-mgmt':  loadMenuList,
    'bulk-upload': () => {},
    'meal-count': loadMealCounts,
    attendance:   loadAttendance,
    wastage:      loadWastage,
    billing:      loadBilling,
    feedbacks:    () => { loadFeedbackSummary(); loadFeedbacks(); },
    students:     loadStudents,
  };
  if (map[page]) map[page]();
}

// ─── DASHBOARD ──────────────────────────────────────────────
async function loadDashboard() {
  const sg = document.getElementById('statsGrid');
  sg.innerHTML = skeletonCards(4, '90px');
  try {
    const { stats: s } = await adminAPI.dashboard();
    sg.innerHTML = `
      <div class="stat-card"><div class="stat-label">Total Students</div><div><span class="stat-icon">👥</span><span class="stat-value">${s.totalStudents}</span></div></div>
      <div class="stat-card"><div class="stat-label">Today's Bookings</div><div><span class="stat-icon">🍽️</span><span class="stat-value">${s.todayBookings}</span></div></div>
      <div class="stat-card"><div class="stat-label">Total Feedbacks</div><div><span class="stat-icon">💬</span><span class="stat-value">${s.totalFeedbacks}</span></div></div>
      <div class="stat-card"><div class="stat-label">Avg. Rating</div><div><span class="stat-icon">⭐</span><span class="stat-value">${s.avgRating || '—'}</span></div></div>`;

    const mealMap = {};
    (s.todayMeals || []).forEach(m => { mealMap[m._id] = m; });
    const meals   = ['breakfast','lunch','snacks','dinner'];
    const maxCount = Math.max(...meals.map(k => (mealMap[k]?.booked||0)+(mealMap[k]?.consumed||0)), 1);

    document.getElementById('todayMealChart').innerHTML = meals.map(k => {
      const total = (mealMap[k]?.booked||0)+(mealMap[k]?.consumed||0);
      return `<div class="bar-row"><div class="bar-label">${MEAL_EMOJI[k]} ${k}</div><div class="bar-track"><div class="bar-fill ${k}" style="width:${Math.round(total/maxCount*100)}%">${total}</div></div></div>`;
    }).join('');

    try {
      const fData = await feedbackAPI.summary();
      const rm = {}; fData.summary.forEach(r => { rm[r._id] = r; });
      document.getElementById('ratingChart').innerHTML = meals.map(k => {
        const avg = rm[k]?.avgRating || 0;
        return `<div class="bar-row"><div class="bar-label">${MEAL_EMOJI[k]} ${k}</div><div class="bar-track"><div class="bar-fill rating" style="width:${Math.round(avg/5*100)}%">${avg ? avg.toFixed(1)+'★' : '—'}</div></div></div>`;
      }).join('');
    } catch { document.getElementById('ratingChart').innerHTML = '<p class="loading-state">No feedback data yet.</p>'; }
  } catch (err) { sg.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`; }
}

// ─── MENU MANAGEMENT ────────────────────────────────────────
async function loadMenuList() {
  const start = document.getElementById('menuFilterStart')?.value;
  const end   = document.getElementById('menuFilterEnd')?.value;
  const c     = document.getElementById('menuTable');
  c.innerHTML = skeletonRows(5);
  try {
    const { menus } = await menuAPI.getAll(start && end ? `?startDate=${start}&endDate=${end}` : '');
    if (!menus.length) {
      c.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>No menus found. Click "+ Add Menu" to create one.</p></div>';
      return;
    }
    let rows = '';
    menus.forEach(m => {
      const safe = JSON.stringify(JSON.stringify(m)); // double-encode for onclick attr
      rows += `<tr>
        <td><strong>${formatDate(m.date)}</strong></td>
        <td style="font-size:11px;max-width:130px">${m.breakfast?.veg ? '<div><span class="tag-veg-sm">🥦</span>'+m.breakfast.veg+'</div>' : ''}${m.breakfast?.nonVeg ? '<div><span class="tag-nv-sm">🍗</span>'+m.breakfast.nonVeg+'</div>' : ''}${!m.breakfast?.veg && !m.breakfast?.nonVeg ? '—' : ''}</td>
        <td style="font-size:11px;max-width:130px">${m.lunch?.veg ? '<div><span class="tag-veg-sm">🥦</span>'+m.lunch.veg+'</div>' : ''}${m.lunch?.nonVeg ? '<div><span class="tag-nv-sm">🍗</span>'+m.lunch.nonVeg+'</div>' : ''}${!m.lunch?.veg && !m.lunch?.nonVeg ? '—' : ''}</td>
        <td style="font-size:11px;max-width:130px">${m.snacks?.veg ? '<div><span class="tag-veg-sm">🥦</span>'+m.snacks.veg+'</div>' : ''}${m.snacks?.nonVeg ? '<div><span class="tag-nv-sm">🍗</span>'+m.snacks.nonVeg+'</div>' : ''}${!m.snacks?.veg && !m.snacks?.nonVeg ? '—' : ''}</td>
        <td style="font-size:11px;max-width:130px">${m.dinner?.veg ? '<div><span class="tag-veg-sm">🥦</span>'+m.dinner.veg+'</div>' : ''}${m.dinner?.nonVeg ? '<div><span class="tag-nv-sm">🍗</span>'+m.dinner.nonVeg+'</div>' : ''}${!m.dinner?.veg && !m.dinner?.nonVeg ? '—' : ''}</td>
        <td style="text-align:center">${m.notificationSent ? '✅' : '—'}</td>
        <td><div class="table-actions">
          <button class="btn-icon" title="Edit" onclick="editMenu('${m._id}',${safe})">✏️</button>
          <button class="btn-icon" title="Notify" onclick="sendMenuNotify('${m._id}')">📧</button>
          <button class="btn-icon delete" title="Delete" onclick="deleteMenuRow('${m._id}')">🗑️</button>
        </div></td>
      </tr>`;
    });
    c.innerHTML = `<table class="data-table">
      <thead><tr><th>Date</th><th>Breakfast</th><th>Lunch</th><th>Snacks</th><th>Dinner</th><th>Notified</th><th>Actions</th></tr></thead>
      <tbody>${rows}</tbody></table>`;
  } catch (err) { c.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`; }
}

// Helper: safely get input value
function mealVal(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function openMenuModal() {
  document.getElementById('menuModalTitle').textContent = 'Add Menu';
  document.getElementById('menuEditId').value  = '';
  document.getElementById('menuDate').value    = todayStr();
  document.getElementById('sendNotification').checked = false;
  document.getElementById('menuModalAlert').classList.add('hidden');
  // Clear all meal fields
  ['breakfast','lunch','snacks','dinner'].forEach(m => {
    ['Veg','NonVeg','Time'].forEach(f => {
      const el = document.getElementById(m + f);
      if (el) el.value = '';
    });
  });
  document.querySelector('#menuModal .btn-primary span').textContent = '💾 Save Menu';
  document.getElementById('menuModal').classList.remove('hidden');
}

function editMenu(id, jsonString) {
  const m = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
  document.getElementById('menuModalTitle').textContent = 'Edit Menu';
  document.getElementById('menuEditId').value  = id;
  document.getElementById('menuDate').value    = m.date;
  document.getElementById('sendNotification').checked = false;
  document.getElementById('menuModalAlert').classList.add('hidden');
  ['breakfast','lunch','snacks','dinner'].forEach(k => {
    const vegEl  = document.getElementById(k + 'Veg');
    const nvEl   = document.getElementById(k + 'NonVeg');
    const timeEl = document.getElementById(k + 'Time');
    if (vegEl)  vegEl.value  = m[k]?.veg    || '';
    if (nvEl)   nvEl.value   = m[k]?.nonVeg || '';
    if (timeEl) timeEl.value = m[k]?.time   || '';
  });
  document.querySelector('#menuModal .btn-primary span').textContent = '💾 Save Menu';
  document.getElementById('menuModal').classList.remove('hidden');
}

function closeMenuModal() {
  document.getElementById('menuModal').classList.add('hidden');
  document.getElementById('menuModalAlert').classList.add('hidden');
}

async function saveMenu() {
  const id   = document.getElementById('menuEditId').value;
  const date = document.getElementById('menuDate').value;
  if (!date) { showAlert('menuModalAlert', 'Please select a date.', 'error'); return; }

  const defaults = { breakfast:'7:00 AM - 9:00 AM', lunch:'12:00 PM - 2:00 PM', snacks:'4:00 PM - 5:00 PM', dinner:'7:00 PM - 9:00 PM' };
  const body  = { date, sendNotification: document.getElementById('sendNotification').checked };

  ['breakfast','lunch','snacks','dinner'].forEach(k => {
    body[k] = {
      veg:    mealVal(k + 'Veg'),
      nonVeg: mealVal(k + 'NonVeg'),
      time:   mealVal(k + 'Time') || defaults[k],
    };
  });

  const hasContent = ['breakfast','lunch','snacks','dinner'].some(k => body[k].veg || body[k].nonVeg);
  if (!hasContent) {
    showAlert('menuModalAlert', 'Please add items for at least one meal.', 'error');
    return;
  }

  const btn = document.querySelector('#menuModal .btn-primary span');
  btn.textContent = 'Saving…';
  try {
    if (id) await menuAPI.update(id, body);
    else    await menuAPI.create(body);
    closeMenuModal();
    loadMenuList();
    showToast(id ? '✅ Menu updated!' : '✅ Menu created successfully!', 'success');
  } catch (err) {
    showAlert('menuModalAlert', err.message, 'error');
    btn.textContent = '💾 Save Menu';
  }
}

async function sendMenuNotify(id) {
  const ok = await showConfirm('Send email notification to all students about this menu?', 'Send Notification?');
  if (!ok) return;
  try { const d = await menuAPI.notify(id); showToast(d.message, 'success'); loadMenuList(); }
  catch (err) { showToast(err.message, 'error'); }
}

async function deleteMenuRow(id) {
  const ok = await showConfirm('Delete this menu permanently?', 'Delete Menu?');
  if (!ok) return;
  try { await menuAPI.delete(id); showToast('Menu deleted.', 'info'); loadMenuList(); }
  catch (err) { showToast(err.message, 'error'); }
}

// ─── BULK UPLOAD ────────────────────────────────────────────
function downloadTemplate() {
  const h = 'date,breakfast_veg,breakfast_nonveg,breakfast_time,lunch_veg,lunch_nonveg,lunch_time,snacks_veg,snacks_nonveg,snacks_time,dinner_veg,dinner_nonveg,dinner_time\n';
  const r = `${todayStr()},Idli Sambar,Egg Bhurji,7:00 AM - 9:00 AM,Rice Dal Sabzi,Chicken Curry,12:00 PM - 2:00 PM,Biscuits Chai,Samosa,4:00 PM - 5:00 PM,Roti Paneer,Mutton Curry,7:00 PM - 9:00 PM\n`;
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([h+r],{type:'text/csv'})), download:'menu-template.csv' });
  a.click();
}

async function uploadMenuFile() {
  const file = document.getElementById('menuUploadFile')?.files[0];
  if (!file) { showToast('Please select a file first.', 'error'); return; }
  const fd = new FormData(); fd.append('file', file);
  const result = document.getElementById('uploadResult');
  result.innerHTML = '<div class="loading-state">Uploading…</div>';
  try {
    const res  = await fetch('/api/menu/bulk-upload', { method:'POST', headers:{ Authorization:`Bearer ${getToken()}` }, body:fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    result.innerHTML = `<div class="alert alert-success">✅ Created: ${data.results.created}, Updated: ${data.results.updated}${data.results.errors.length ? '<br/>⚠️ ' + data.results.errors.slice(0,3).join(', ') : ''}</div>`;
    showToast(`Upload complete! ${data.results.created} created, ${data.results.updated} updated.`, 'success');
  } catch (err) {
    result.innerHTML = `<div class="alert alert-error">❌ ${err.message}</div>`;
    showToast(err.message, 'error');
  }
}

// ─── MEAL COUNTS ────────────────────────────────────────────
async function loadMealCounts() {
  const date = document.getElementById('mealCountDate')?.value;
  const c    = document.getElementById('mealCountView');
  if (!date) { c.innerHTML = '<div class="loading-state">Please select a date.</div>'; return; }
  c.innerHTML = skeletonCards(4, '140px');
  try {
    const { counts } = await bookingAPI.mealCount(`?date=${date}`);
    const summary = {};
    counts.forEach(item => {
      const meal = item._id.mealType; const pref = item._id.foodPreference || 'veg';
      if (!summary[meal]) summary[meal] = { veg:0, nonveg:0, both:0 };
      summary[meal][pref] = (summary[meal][pref] || 0) + item.count;
    });
    let cards = '';
    ['breakfast','lunch','snacks','dinner'].forEach(meal => {
      const d = summary[meal] || { veg:0, nonveg:0, both:0 };
      const total = d.veg + d.nonveg + (d.both||0);
      cards += `<div class="meal-count-card">
        <div class="mc-emoji">${MEAL_EMOJI[meal]}</div>
        <div class="mc-title">${meal.charAt(0).toUpperCase()+meal.slice(1)}</div>
        <div class="mc-count">${total}</div><div class="mc-label">total booked</div>
        <div class="mc-breakdown"><span class="tag-veg-sm">🥦 ${d.veg}</span> <span class="tag-nv-sm">🍗 ${d.nonveg}</span></div>
      </div>`;
    });
    c.innerHTML = `<h3 style="font-family:var(--font-head);font-size:16px;margin-bottom:16px">Meal Counts — ${formatDate(date)}</h3><div class="meal-count-grid">${cards}</div>`;
  } catch (err) { c.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`; }
}

// ─── ATTENDANCE ─────────────────────────────────────────────
async function loadAttendance() {
  const date = document.getElementById('attendanceDate')?.value;
  const c    = document.getElementById('attendanceView');
  if (!date) { c.innerHTML = '<div class="loading-state">Please select a date.</div>'; return; }
  c.innerHTML = skeletonRows(4);
  try {
    const { stats } = await bookingAPI.attendance(`?date=${date}`);
    const map = {};
    stats.forEach(s => {
      const meal = s._id.mealType; const status = s._id.status;
      if (!map[meal]) map[meal] = { booked:0, consumed:0, cancelled:0 };
      map[meal][status] = s.count;
    });
    if (['breakfast','lunch','snacks','dinner'].every(m => !map[m])) {
      c.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>No bookings for this date.</p></div>';
      return;
    }
    let rows = '';
    ['breakfast','lunch','snacks','dinner'].forEach(meal => {
      const d = map[meal] || { booked:0, consumed:0, cancelled:0 };
      const maxV = Math.max(d.booked+d.consumed+d.cancelled, 1);
      rows += `<div class="att-row"><div class="att-meal">${MEAL_EMOJI[meal]} ${meal}</div>
        <div class="att-bars">
          ${[['booked',d.booked],['consumed',d.consumed],['cancelled',d.cancelled]].map(([st,cnt]) =>
            `<div class="att-bar-row"><div class="att-bar-label">${st} (${cnt})</div><div class="att-track"><div class="att-fill ${st}" style="width:${Math.round(cnt/maxV*100)}%">${cnt||''}</div></div></div>`
          ).join('')}
        </div></div>`;
    });
    c.innerHTML = `<h3 style="font-family:var(--font-head);font-size:16px;margin-bottom:16px">Attendance — ${formatDate(date)}</h3><div class="attendance-grid">${rows}</div>`;
  } catch (err) { c.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`; }
}

// ─── WASTAGE ────────────────────────────────────────────────
async function loadWastage() {
  const weeks = parseInt(document.getElementById('wastageWeeks')?.value) || 4;
  const c     = document.getElementById('wastageView');
  c.innerHTML = skeletonCards(4, '120px');
  try {
    const { trend, byMeal } = await analyticsAPI.wastage(weeks);
    let mealCards = '';
    ['breakfast','lunch','snacks','dinner'].forEach(meal => {
      const d     = byMeal[meal] || { booked:0, consumed:0, wastePct:'0.0' };
      const pct   = parseFloat(d.wastePct);
      const color = pct > 30 ? 'var(--error)' : pct > 15 ? 'var(--warning)' : 'var(--success)';
      mealCards += `<div class="meal-count-card">
        <div class="mc-emoji">${MEAL_EMOJI[meal]}</div>
        <div class="mc-title">${meal.charAt(0).toUpperCase()+meal.slice(1)}</div>
        <div class="mc-count" style="color:${color}">${d.wastePct}%</div>
        <div class="mc-label">waste rate</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:6px">${d.booked} booked · ${d.consumed} eaten</div>
      </div>`;
    });
    const trendBars = trend.length ? '<div class="bar-chart">' + trend.map(w => {
      const color = w.wastePct > 30 ? '#f87171' : w.wastePct > 15 ? '#fbbf24' : '#4ade80';
      return `<div class="bar-row">
        <div class="bar-label" style="font-size:11px">w/o ${w.week}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.min(w.wastePct,100)}%;background:${color}">${w.wastePct}%</div></div>
        <div style="font-size:11px;color:var(--text-muted);width:90px;flex-shrink:0">${w.wasted}/${w.totalBooked}</div>
      </div>`;
    }).join('') + '</div>' : '<p class="loading-state">No data yet.</p>';
    c.innerHTML = `<div class="meal-count-grid" style="margin-bottom:24px">${mealCards}</div><div class="chart-card"><h3>Weekly Trend — Last ${weeks} weeks</h3>${trendBars}</div>`;
  } catch (err) { c.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`; }
}

// ─── BILLING ────────────────────────────────────────────────
// Bills count booked + consumed meals (not cancelled)
// Prices: Breakfast ₹60 | Lunch ₹60 | Snacks ₹50 | Dinner ₹70
async function loadBilling() {
  const month = document.getElementById('billingMonth')?.value || todayStr().slice(0,7);
  const c     = document.getElementById('billingTable');
  c.innerHTML = skeletonRows(5);
  try {
    const { bills } = await billingAPI.allBills(month);
    if (!bills.length) {
      c.innerHTML = `<div class="empty-state">
        <div class="empty-icon">💰</div>
        <p style="font-size:15px;font-weight:600;margin-bottom:8px">No bills for ${month}</p>
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:20px">Click Generate Bills to calculate bills from this month's bookings.</p>
        <button class="btn-primary" onclick="document.getElementById('generateBillingMonth').value='${month}';generateBills()" style="width:auto;padding:12px 24px;margin:0">
          <span>⚡ Generate Bills for ${month}</span>
        </button>
      </div>`;
      return;
    }
    const totalRevenue = bills.reduce((s,b) => s + b.totalAmount, 0);
    const paidCount    = bills.filter(b => b.status === 'paid').length;
    const pendingCount = bills.filter(b => b.status === 'pending').length;
    const paidAmount   = bills.filter(b => b.status === 'paid').reduce((s,b) => s + b.totalAmount, 0);

    let rows = '';
    bills.forEach(b => {
      const name  = (b.userId?.name || '—').replace(/'/g, "\\'");
      const amt   = b.totalAmount;
      const bid   = b._id;
      const bmonth = b.month;
      let breakdown = '';
      ['breakfast','lunch','snacks','dinner'].forEach(k => {
        const d = b.breakdown?.[k];
        if (d?.count) breakdown += MEAL_EMOJI[k] + '×' + d.count + '  ';
      });
      const statusBadge = b.status === 'paid'
        ? '<span class="badge badge-consumed">✅ Paid</span>'
        : b.status === 'waived'
        ? '<span class="badge badge-cancelled">Waived</span>'
        : '<span class="badge badge-booked">⏳ Pending</span>';

      const payBtn = b.status === 'pending'
        ? `<button style="display:inline-flex;align-items:center;gap:6px;padding:9px 14px;background:linear-gradient(135deg,#FF6B35,#ff9a6c);color:white;border:none;border-radius:8px;font-family:var(--font-head);font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap;margin-bottom:6px" onclick="openPaymentModal('${bid}','${name}','${amt}')">💳 Collect ₹${amt}</button>`
        : '';

      const safeName = (b.userId?.name || 'student').replace(/\s/g,'_').replace(/[^a-zA-Z0-9_]/g,'');
      rows += `<tr>
        <td>
          <div style="font-weight:600">${b.userId?.name || '—'}</div>
          <div style="font-size:11px;color:var(--text-muted)">${b.userId?.email || ''}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${breakdown}</div>
        </td>
        <td>${b.userId?.roomNumber || '—'}</td>
        <td>
          <div style="font-size:28px;font-family:var(--font-head);font-weight:800;color:var(--accent);line-height:1">₹${amt}</div>
          <div style="font-size:11px;color:var(--text-muted)">${b.totalMeals} meals</div>
        </td>
        <td>${statusBadge}</td>
        <td>
          ${payBtn}
          <div style="display:flex;gap:6px">
            <button class="btn-icon" title="View Details" onclick="viewBillDetail('${bid}','${bmonth}')">📋</button>
            <button class="btn-icon" title="Download PDF" onclick="downloadBillPDFById('${bid}','${safeName}','${bmonth}')">📄</button>
          </div>
        </td>
      </tr>`;
    });

    c.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
        <div style="background:var(--dark-2);border:1px solid var(--border);border-radius:10px;padding:14px 16px"><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Total Billed</div><div style="font-size:26px;font-weight:800;font-family:var(--font-head);color:var(--accent)">₹${totalRevenue}</div></div>
        <div style="background:var(--dark-2);border:1px solid var(--border);border-radius:10px;padding:14px 16px"><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Collected</div><div style="font-size:26px;font-weight:800;font-family:var(--font-head);color:var(--success)">₹${paidAmount}</div></div>
        <div style="background:var(--dark-2);border:1px solid var(--border);border-radius:10px;padding:14px 16px"><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Paid</div><div style="font-size:26px;font-weight:800;font-family:var(--font-head);color:var(--success)">${paidCount} students</div></div>
        <div style="background:var(--dark-2);border:1px solid var(--border);border-radius:10px;padding:14px 16px"><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Pending</div><div style="font-size:26px;font-weight:800;font-family:var(--font-head);color:var(--warning)">${pendingCount} students</div></div>
      </div>
      <table class="data-table">
        <thead><tr><th>Student</th><th>Room</th><th>Total Amount</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  } catch (err) { c.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`; }
}

async function generateBills() {
  const month = document.getElementById('generateBillingMonth')?.value || todayStr().slice(0,7);
  const ok = await showConfirm(
    `Generate bills for ALL students for ${month}?\n\nCounts all booked + consumed meals (not cancelled). Prices: Breakfast ₹60, Lunch ₹60, Snacks ₹50, Dinner ₹70.\n\nExisting bills will be overwritten.`,
    '⚡ Generate Monthly Bills'
  );
  if (!ok) return;
  const btnSpan = document.querySelector('#page-billing .btn-primary span');
  if (btnSpan) btnSpan.textContent = 'Generating…';
  try {
    const data = await billingAPI.generate(month);
    showToast('✅ ' + data.message, 'success');
    if (data.results?.length) {
      const total = data.results.reduce((s,r) => s+(r.total||0), 0);
      showToast(`Total billed: ₹${total} across ${data.results.length} students`, 'info');
    }
    const viewEl = document.getElementById('billingMonth');
    if (viewEl) viewEl.value = month;
    loadBilling();
  } catch (err) { showToast(err.message, 'error'); }
  finally { if (btnSpan) btnSpan.textContent = '⚡ Generate Bills'; }
}

async function viewBillDetail(billId, month) {
  const body = document.getElementById('billDetailBody');
  body.innerHTML = '<div class="loading-state">Loading…</div>';
  document.getElementById('billDetailModal').classList.remove('hidden');
  currentBillId = billId;
  try {
    const viewMonth = month || document.getElementById('billingMonth')?.value || todayStr().slice(0,7);
    const { bills } = await billingAPI.allBills(viewMonth);
    const b = bills.find(x => x._id === billId);
    if (!b) { body.innerHTML = '<p class="empty-state">Bill not found.</p>'; return; }

    let mealRows = '';
    ['breakfast','lunch','snacks','dinner'].forEach(k => {
      const d    = b.breakdown?.[k] || { count:0, amount:0 };
      const fade = d.count > 0 ? '' : 'opacity:0.4';
      mealRows += `<tr style="${fade}">
        <td style="padding:12px 16px"><span style="font-size:18px;margin-right:8px">${MEAL_EMOJI[k]}</span><strong>${k.charAt(0).toUpperCase()+k.slice(1)}</strong><div style="font-size:11px;color:var(--text-muted)">₹${MEAL_PRICES[k]} per meal</div></td>
        <td style="text-align:center;font-size:22px;font-weight:700">${d.count}</td>
        <td style="text-align:center;color:var(--text-muted)">× ₹${MEAL_PRICES[k]}</td>
        <td style="text-align:right;font-family:var(--font-head);font-weight:800;font-size:18px;color:${d.count>0?'var(--accent)':'var(--text-muted)'}">₹${d.amount}</td>
      </tr>`;
    });

    const statusColor = b.status === 'paid' ? 'var(--success)' : b.status === 'waived' ? 'var(--text-muted)' : 'var(--warning)';
    const safeName = (b.userId?.name||'student').replace(/\s/g,'_').replace(/[^a-zA-Z0-9_]/g,'');
    body.innerHTML = `
      <div style="background:linear-gradient(135deg,#FF6B35,#ff9a6c);border-radius:12px;padding:20px;margin-bottom:20px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div style="font-size:11px;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Student</div>
            <div style="font-family:var(--font-head);font-size:20px;font-weight:800;color:#fff">${b.userId?.name||'—'}</div>
            <div style="color:rgba(255,255,255,0.8);font-size:13px">Room ${b.userId?.roomNumber||'—'} · ${b.month}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:11px;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Total Due</div>
            <div style="font-family:var(--font-head);font-size:40px;font-weight:800;color:#fff;line-height:1">₹${b.totalAmount}</div>
            <div style="color:${statusColor};font-size:13px;font-weight:700;text-transform:uppercase;margin-top:4px">${b.status}</div>
          </div>
        </div>
      </div>
      <table class="data-table" style="margin-bottom:16px">
        <thead><tr><th>Meal</th><th style="text-align:center">Days</th><th style="text-align:center">Rate</th><th style="text-align:right">Amount</th></tr></thead>
        <tbody>
          ${mealRows}
          <tr style="background:var(--dark-3);border-top:2px solid var(--accent)">
            <td style="padding:14px 16px;font-family:var(--font-head);font-weight:700">TOTAL</td>
            <td style="text-align:center;font-weight:700">${b.totalMeals} meals</td>
            <td></td>
            <td style="text-align:right;font-family:var(--font-head);font-size:26px;font-weight:800;color:var(--accent);padding-right:16px">₹${b.totalAmount}</td>
          </tr>
        </tbody>
      </table>
      ${b.status === 'pending' ? `
        <div style="background:rgba(255,107,53,0.08);border:1px solid rgba(255,107,53,0.3);border-radius:10px;padding:16px;display:flex;align-items:center;justify-content:space-between;gap:12px">
          <div>
            <div style="font-weight:700">Payment Pending</div>
            <div style="font-size:13px;color:var(--text-muted);margin-top:2px">Collect ₹${b.totalAmount} via PhonePe</div>
          </div>
          <button onclick="openPaymentModal('${b._id}','${(b.userId?.name||'').replace(/'/g,"\\'")}','${b.totalAmount}')" style="padding:11px 18px;background:linear-gradient(135deg,#FF6B35,#ff9a6c);color:white;border:none;border-radius:8px;font-family:var(--font-head);font-size:14px;font-weight:700;cursor:pointer;white-space:nowrap">💳 Collect ₹${b.totalAmount}</button>
        </div>` : ''}`;

    document.getElementById('billPdfBtn').onclick = () => downloadBillPDFById(billId, safeName, b.month);
  } catch (err) { body.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`; }
}

function closeBillModal() { document.getElementById('billDetailModal').classList.add('hidden'); }

function openPaymentModal(billId, studentName, amount) {
  currentBillId = billId;
  document.getElementById('paymentAmount').textContent  = '₹' + amount;
  document.getElementById('paymentStudent').textContent = 'Bill for: ' + studentName;
  document.getElementById('paymentModal').classList.remove('hidden');
  document.getElementById('confirmPayBtn').onclick = async () => {
    const ok = await showConfirm('Confirm ₹' + amount + ' received from ' + studentName + ' via PhonePe?', 'Confirm Payment');
    if (!ok) return;
    try {
      await billingAPI.updateStatus(billId, { status:'paid', notes:'Paid via PhonePe' });
      closePaymentModal(); closeBillModal();
      showToast('✅ Payment of ₹' + amount + ' confirmed for ' + studentName + '!', 'success');
      loadBilling();
    } catch (err) { showToast(err.message, 'error'); }
  };
}

function closePaymentModal() { document.getElementById('paymentModal').classList.add('hidden'); }

async function downloadBillPDFById(id, name, month) {
  showToast('Generating PDF…', 'info');
  try { await billingAPI.downloadPDF(id, name || 'bill', month); showToast('PDF downloaded!', 'success'); }
  catch (err) { showToast('PDF failed: ' + err.message, 'error'); }
}

async function downloadBillPDF() { if (currentBillId) downloadBillPDFById(currentBillId, 'bill', todayStr().slice(0,7)); }

// ─── FEEDBACKS ──────────────────────────────────────────────
async function loadFeedbackSummary() {
  try {
    const { summary } = await feedbackAPI.summary();
    const map = {}; summary.forEach(s => { map[s._id] = s; });
    let html = '';
    ['breakfast','lunch','snacks','dinner'].forEach(meal => {
      const s = map[meal]; const avg = s?.avgRating?.toFixed(1) || '—';
      html += `<div class="summary-card"><div class="summary-meal">${MEAL_EMOJI[meal]} ${meal}</div><div class="summary-rating">${avg}</div><div class="summary-stars">${starsHTML(Math.round(s?.avgRating||0))}</div><div class="summary-count">${s?.count||0} reviews</div></div>`;
    });
    document.getElementById('feedbackSummary').innerHTML = html;
  } catch {}
}

async function loadFeedbacks() {
  const meal = document.getElementById('feedbackFilterMeal')?.value;
  const date = document.getElementById('feedbackFilterDate')?.value;
  const c    = document.getElementById('feedbacksTable');
  c.innerHTML = skeletonRows(4);
  try {
    const params = [meal ? 'mealType='+meal : '', date ? 'date='+date : ''].filter(Boolean);
    const { feedbacks } = await feedbackAPI.getAll(params.length ? '?'+params.join('&') : '');
    if (!feedbacks.length) { c.innerHTML = '<div class="empty-state"><div class="empty-icon">💬</div><p>No feedback found.</p></div>'; return; }
    let rows = '';
    feedbacks.forEach(f => {
      rows += `<tr>
        <td>${f.userId?.name||'Unknown'}</td><td>${f.userId?.roomNumber||'—'}</td>
        <td>${formatDate(f.date)}</td><td>${MEAL_EMOJI[f.mealType]||''} ${f.mealType}</td>
        <td>${starsHTML(f.rating)} <span style="font-size:12px;color:var(--text-muted)">(${f.rating}/5)</span></td>
        <td style="font-size:13px;max-width:200px;color:var(--text-muted)">${f.comment||'—'}</td>
      </tr>`;
    });
    c.innerHTML = `<table class="data-table"><thead><tr><th>Student</th><th>Room</th><th>Date</th><th>Meal</th><th>Rating</th><th>Comment</th></tr></thead><tbody>${rows}</tbody></table>`;
  } catch (err) { c.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`; }
}

// ─── STUDENTS ───────────────────────────────────────────────
async function loadStudents() {
  const c = document.getElementById('studentsTable');
  c.innerHTML = skeletonRows(5);
  try {
    const { students } = await adminAPI.students();
    if (!students.length) { c.innerHTML = '<div class="empty-state"><div class="empty-icon">👥</div><p>No students registered.</p></div>'; return; }
    let rows = '';
    students.forEach(s => {
      const prefLabel = s.foodPreference === 'nonveg' ? '🍗 Non-Veg' : s.foodPreference === 'both' ? '🍱 Both' : '🥦 Veg';
      const prefClass = s.foodPreference === 'nonveg' ? 'nonveg' : 'veg';
      rows += `<tr>
        <td><div style="display:flex;align-items:center;gap:10px">
          <div style="width:32px;height:32px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0">${s.name[0].toUpperCase()}</div>${s.name}
        </div></td>
        <td style="color:var(--text-muted)">${s.email}</td>
        <td>${s.roomNumber||'—'}</td>
        <td><span class="food-pref-pill ${prefClass}">${prefLabel}</span></td>
        <td>${new Date(s.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</td>
        <td><button class="btn-danger" onclick="removeStudent('${s._id}','${s.name.replace(/'/g,"\\'")}')">Remove</button></td>
      </tr>`;
    });
    c.innerHTML = `<table class="data-table"><thead><tr><th>Name</th><th>Email</th><th>Room</th><th>Food Pref</th><th>Joined</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table>`;
  } catch (err) { c.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`; }
}

async function removeStudent(id, name) {
  const ok = await showConfirm('Remove student "' + name + '"?', 'Remove Student?');
  if (!ok) return;
  try { await adminAPI.deleteStudent(id); showToast('Student removed.', 'info'); loadStudents(); }
  catch (err) { showToast(err.message, 'error'); }
}

// ─── EXPORT ─────────────────────────────────────────────────
function exportReport() { document.getElementById('exportModal').classList.remove('hidden'); }
function closeExportModal() { document.getElementById('exportModal').classList.add('hidden'); }

async function downloadExport() {
  const start = document.getElementById('exportStart')?.value;
  const end   = document.getElementById('exportEnd')?.value;
  const btn   = document.querySelector('#exportModal .btn-primary span');
  if (btn) btn.textContent = 'Generating…';
  try {
    const params = start && end ? '?startDate='+start+'&endDate='+end : '';
    const res    = await fetch('/api/export/meal-report'+params, { headers:{ Authorization:'Bearer '+getToken() } });
    if (!res.ok) { const e = await res.json(); throw new Error(e.message||'Export failed'); }
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href:url, download:'hostel-report.xlsx' }).click();
    URL.revokeObjectURL(url);
    closeExportModal();
    showToast('✅ Excel report downloaded!', 'success');
  } catch (err) { showToast('Export failed: ' + err.message, 'error'); }
  finally { if (btn) btn.textContent = '📥 Download'; }
}

// ─── AI ASSISTANT ───────────────────────────────────────────
async function generateWithAI() {
  const theme = prompt("What's the theme for the menu? (e.g. 'High Protein', 'Student Favorites', 'Summer Specials')");
  if (!theme) return;

  const btn = event.target;
  const originalText = btn.textContent;
  btn.textContent = '✨ Generating...';
  btn.disabled = true;

  try {
    const { data } = await aiAPI.generateMenu(theme);
    
    // Open the modal first (to clear previous values and set defaults)
    openMenuModal();
    
    // Fill the fields with AI suggestions
    ['breakfast', 'lunch', 'snacks', 'dinner'].forEach(k => {
      if (data[k]) {
        const vegEl = document.getElementById(k + 'Veg');
        const nvEl  = document.getElementById(k + 'NonVeg');
        if (vegEl) vegEl.value = data[k].veg || '';
        if (nvEl)  nvEl.value  = data[k].nonVeg || '';
      }
    });
    
    showToast('✨ AI has suggested a menu! Review and save it.', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}
