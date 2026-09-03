// ============================================================
// HostelEats — Student Dashboard (v3)
// ============================================================
let currentWeekOffset = 0;
let selectedPref      = 'veg';

(function init() {
  const user = requireAuth();
  if (!user) return;
  if (user.role === 'admin') { window.location.href = '/pages/admin.html'; return; }

  document.getElementById('sidebarName').textContent   = user.name;
  document.getElementById('sidebarAvatar').textContent = user.name[0].toUpperCase();
  const prefMap = { veg: '🥦 Veg', nonveg: '🍗 Non-Veg', both: '🍱 Both' };
  document.getElementById('sidebarPref').textContent   = prefMap[user.foodPreference] || '🥦 Veg';

  const now = new Date();
  document.getElementById('currentDate').textContent =
    now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  document.getElementById('todayBadge').textContent =
    now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const hour = now.getHours();
  document.getElementById('welcomeMsg').textContent =
    `${hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'}, ${user.name.split(' ')[0]}! 👋`;

  const today = todayStr();
  if (document.getElementById('bookDate'))           document.getElementById('bookDate').value = today;
  if (document.getElementById('feedbackDate'))       document.getElementById('feedbackDate').value = today;
  if (document.getElementById('qrFilterDate'))       document.getElementById('qrFilterDate').value = today;
  if (document.getElementById('analyticsMonth'))     document.getElementById('analyticsMonth').value = today.slice(0,7);

  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  if (document.getElementById('bookingFilterStart')) document.getElementById('bookingFilterStart').value = weekAgo.toISOString().split('T')[0];
  if (document.getElementById('bookingFilterEnd'))   document.getElementById('bookingFilterEnd').value   = today;

  if (user.foodPreference) setPref(user.foodPreference);

  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault(); const page = item.dataset.page; if (!page) return;
      goToPage(page); loadPageData(page);
    });
  });

  document.getElementById('bookDate')?.addEventListener('change', () => {
    updateBookPreview(); checkDeadlines();
  });

  setupStarRating();
  loadOverview();
  loadWeekMenu();
  checkDeadlines();
})();

function loadPageData(page) {
  const map = {
    overview:     loadOverview,
    menu:         loadWeekMenu,
    'my-bookings':loadMyBookings,
    'my-qr':      loadQrPasses,
    feedback:     loadFeedbackHistory,
    analytics:    loadAnalytics,
    settings:     loadSettings,
    book: () => { updateBookPreview(); checkDeadlines(); },
  };
  map[page]?.();
}

// ─── FOOD PREFERENCE ────────────────────────────────────────
function setPref(pref) {
  selectedPref = pref;
  if (document.getElementById('foodPref')) document.getElementById('foodPref').value = pref;
  document.querySelectorAll('.pref-btn').forEach(b => b.classList.toggle('active', b.dataset.pref === pref));
}

// ─── DEADLINE BADGES ────────────────────────────────────────
async function checkDeadlines() {
  const date = document.getElementById('bookDate')?.value; if (!date) return;
  for (const meal of ['breakfast','lunch','snacks','dinner']) {
    const tag = document.getElementById(`dl-${meal}`);
    const cb  = document.querySelector(`.meal-options input[value="${meal}"]`);
    if (!tag) continue;
    try {
      const data = await bookingAPI.deadlineCheck(date, meal);
      tag.textContent  = data.allowed ? 'Open' : 'Closed';
      tag.className    = `deadline-tag ${data.allowed ? 'open' : 'closed'}`;
      if (cb) { cb.disabled = !data.allowed; if (!data.allowed) cb.checked = false; }
    } catch { tag.textContent = ''; }
  }
}

// ─── OVERVIEW ───────────────────────────────────────────────
async function loadOverview() {
  const container = document.getElementById('todayMenuCards');
  container.innerHTML = skeletonCards(4, '140px');
  try {
    const data = await menuAPI.getToday();
    const m = data.menu;
    const meals = [
      { key:'breakfast', emoji:'🌅', label:'Breakfast' },
      { key:'lunch',     emoji:'☀️', label:'Lunch'     },
      { key:'snacks',    emoji:'🍪', label:'Snacks'    },
      { key:'dinner',    emoji:'🌙', label:'Dinner'    },
    ];
    container.innerHTML = meals.map(({ key, emoji, label }) => {
      const meal = m[key];
      return `<div class="menu-meal-card">
        <div class="meal-card-header">
          <span class="meal-card-emoji">${emoji}</span>
          <div><div class="meal-card-title">${label}</div><div class="meal-card-time">${meal?.time || ''}</div></div>
        </div>
        ${meal?.veg    ? `<div class="meal-section-row"><span class="tag-veg">🥦 Veg</span><span class="meal-card-items">${meal.veg}</span></div>` : ''}
        ${meal?.nonVeg ? `<div class="meal-section-row"><span class="tag-nonveg">🍗 Non-Veg</span><span class="meal-card-items">${meal.nonVeg}</span></div>` : ''}
        ${!meal?.veg && !meal?.nonVeg ? '<p style="color:var(--text-muted);font-size:13px;margin:0">Not set yet</p>' : ''}
      </div>`;
    }).join('');
  } catch {
    container.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">📭</div><p>No menu for today yet.</p></div>`;
  }
}

// ─── WEEKLY MENU ────────────────────────────────────────────
function getWeekRange(offset = 0) {
  const now = new Date();
  const s   = new Date(now); s.setDate(now.getDate() - now.getDay() + offset * 7);
  const e   = new Date(s);   e.setDate(s.getDate() + 6);
  return {
    start: s.toISOString().split('T')[0],
    end:   e.toISOString().split('T')[0],
    label: `${s.toLocaleDateString('en-IN',{day:'numeric',month:'short'})} – ${e.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}`
  };
}

async function loadWeekMenu() {
  const { start, end, label } = getWeekRange(currentWeekOffset);
  document.getElementById('weekLabel').textContent = label;
  const c = document.getElementById('menuGrid');
  c.innerHTML = skeletonCards(3, '160px');
  try {
    const data = await menuAPI.getAll(`?startDate=${start}&endDate=${end}`);
    if (!data.menus.length) { c.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>No menu this week.</p></div>'; return; }
    const today = todayStr();
    c.innerHTML = data.menus.map(m => `
      <div class="menu-day-row">
        <div class="menu-day-header">
          <span>${formatDate(m.date)}</span>
          ${m.date === today ? '<span class="today-marker">Today</span>' : ''}
        </div>
        <div class="menu-day-meals">
          ${['breakfast','lunch','snacks','dinner'].map((key,i) => {
            const emoji = ['🌅','☀️','🍪','🌙'][i];
            const lbl   = ['Breakfast','Lunch','Snacks','Dinner'][i];
            const meal  = m[key];
            return `<div class="menu-meal-col">
              <div class="meal-col-head">${emoji} ${lbl}</div>
              <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px">${meal?.time||''}</div>
              ${meal?.veg    ? `<div class="mini-tag-row"><span class="tag-veg">🥦</span><span class="meal-col-items">${meal.veg}</span></div>` : ''}
              ${meal?.nonVeg ? `<div class="mini-tag-row"><span class="tag-nonveg">🍗</span><span class="meal-col-items">${meal.nonVeg}</span></div>` : ''}
              ${!meal?.veg && !meal?.nonVeg ? '<span style="color:var(--text-muted);font-size:12px">—</span>' : ''}
            </div>`;
          }).join('')}
        </div>
      </div>`).join('');
  } catch { c.innerHTML = '<div class="empty-state"><p>Failed to load menu.</p></div>'; }
}

function changeWeek(dir) { currentWeekOffset += dir; loadWeekMenu(); }

// ─── BOOK MEALS ─────────────────────────────────────────────
async function updateBookPreview() {
  const date = document.getElementById('bookDate')?.value; if (!date) return;
  const preview = document.getElementById('bookPreviewContent');
  try {
    const data = await menuAPI.getAll(`?date=${date}`);
    if (!data.menus.length) { preview.innerHTML = '<p style="color:var(--text-muted);font-size:13px">No menu set for this date yet.</p>'; return; }
    const m = data.menus[0];
    preview.innerHTML = ['breakfast','lunch','snacks','dinner'].map((key,i) => {
      const emoji = ['🌅','☀️','🍪','🌙'][i];
      const lbl   = ['Breakfast','Lunch','Snacks','Dinner'][i];
      const meal  = m[key];
      return `<div style="padding:10px;background:var(--dark-3);border-radius:8px;margin-bottom:8px">
        <div style="font-size:12px;font-weight:700;margin-bottom:6px">${emoji} ${lbl}</div>
        ${meal?.veg    ? `<div class="mini-tag-row"><span class="tag-veg">🥦 Veg</span><span style="font-size:12px;color:var(--text-muted)">${meal.veg}</span></div>` : ''}
        ${meal?.nonVeg ? `<div class="mini-tag-row"><span class="tag-nonveg">🍗 Non-Veg</span><span style="font-size:12px;color:var(--text-muted)">${meal.nonVeg}</span></div>` : ''}
        ${!meal?.veg && !meal?.nonVeg ? '<span style="font-size:12px;color:var(--text-muted)">Not set</span>' : ''}
      </div>`;
    }).join('');
  } catch { preview.innerHTML = '<p style="color:var(--text-muted);font-size:13px">Could not load menu.</p>'; }
}

async function submitBooking() {
  const date    = document.getElementById('bookDate')?.value;
  const pref    = document.getElementById('foodPref')?.value || 'veg';
  const checked = [...document.querySelectorAll('.meal-options input:checked')].map(c => c.value);
  if (!date)          { showToast('Please select a date.', 'error'); return; }
  if (!checked.length){ showToast('Please select at least one meal.', 'error'); return; }

  const qrDataUrls = [];
  let success = 0, failed = 0;
  for (const mealType of checked) {
    try {
      const res = await bookingAPI.book({ date, mealType, foodPreference: pref });
      if (res.qrDataUrl) qrDataUrls.push({ mealType, qrDataUrl: res.qrDataUrl });
      success++;
    } catch (err) {
      showToast(`${mealType}: ${err.message}`, 'error');
      failed++;
    }
  }
  if (success) {
    showToast(`✅ ${success} meal(s) booked successfully!`, 'success');
    if (qrDataUrls.length) showQrModal(qrDataUrls, date);
  }
}

function showQrModal(qrItems, date) {
  const mealEmoji = { breakfast:'🌅', lunch:'☀️', snacks:'🍪', dinner:'🌙' };
  document.getElementById('qrModalDesc').textContent = `Show these at the mess — ${formatDate(date)}`;
  document.getElementById('qrCodesContainer').innerHTML = qrItems.map(item => `
    <div class="qr-item">
      <div class="qr-meal-label">${mealEmoji[item.mealType]||''} ${item.mealType}</div>
      <img src="${item.qrDataUrl}" alt="QR" class="qr-img" />
      <button class="btn-secondary" style="width:100%;margin-top:8px;font-size:12px" onclick="downloadQR('${item.qrDataUrl}','${item.mealType}-${date}')">⬇ Download</button>
    </div>`).join('');
  document.getElementById('qrSuccessModal').classList.remove('hidden');
}
function closeQrModal() { document.getElementById('qrSuccessModal').classList.add('hidden'); }

// ─── MY BOOKINGS ────────────────────────────────────────────
async function loadMyBookings() {
  const start = document.getElementById('bookingFilterStart')?.value;
  const end   = document.getElementById('bookingFilterEnd')?.value;
  const c = document.getElementById('myBookingsTable');
  c.innerHTML = skeletonRows(5);
  try {
    const params = start && end ? `?startDate=${start}&endDate=${end}` : '';
    const data   = await bookingAPI.myMeals(params);
    if (!data.bookings.length) { c.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>No bookings found.</p></div>'; return; }
    const emoji = { breakfast:'🌅', lunch:'☀️', snacks:'🍪', dinner:'🌙' };
    c.innerHTML = `<table class="data-table"><thead><tr>
      <th>Date</th><th>Meal</th><th>Pref</th><th>Status</th><th>Actions</th>
    </tr></thead><tbody>${data.bookings.map(b => `<tr>
      <td>${formatDate(b.date)}</td>
      <td>${emoji[b.mealType]||''} ${b.mealType}</td>
      <td><span class="food-pref-pill ${b.foodPreference==='nonveg'?'nonveg':'veg'}">${b.foodPreference==='nonveg'?'🍗 Non-Veg':b.foodPreference==='both'?'🍱 Both':'🥦 Veg'}</span></td>
      <td><span class="badge badge-${b.status}">${b.status}</span></td>
      <td><div class="table-actions">
        ${b.status==='booked'?`
          <button class="btn-icon" title="View QR" onclick="viewQR('${b._id}')">📱</button>
          <button class="btn-danger" onclick="cancelBooking('${b.date}','${b.mealType}','${b._id}')">Cancel</button>`:'—'}
      </div></td>
    </tr>`).join('')}</tbody></table>`;
  } catch (err) { c.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`; }
}

async function viewQR(bookingId) {
  try {
    const data = await bookingAPI.getQR(bookingId);
    if (data.qrDataUrl) showQrModal([{ mealType: data.booking.mealType, qrDataUrl: data.qrDataUrl }], data.booking.date);
  } catch (err) { showToast(err.message, 'error'); }
}

async function cancelBooking(date, mealType, id) {
  const ok = await showConfirm(`Cancel ${mealType} on ${formatDate(date)}? You won't be able to recover this booking.`, 'Cancel Booking?');
  if (!ok) return;
  try { await bookingAPI.cancel({ date, mealType }); showToast('Booking cancelled.', 'info'); loadMyBookings(); }
  catch (err) { showToast(err.message, 'error'); }
}

// ─── QR PASSES ──────────────────────────────────────────────
async function loadQrPasses() {
  const date = document.getElementById('qrFilterDate')?.value;
  const c    = document.getElementById('qrPassesGrid');
  if (!date) { c.innerHTML = '<div class="empty-state"><p>Select a date.</p></div>'; return; }
  c.innerHTML = skeletonCards(3, '300px');
  try {
    const data   = await bookingAPI.myMeals(`?startDate=${date}&endDate=${date}`);
    const active = data.bookings.filter(b => b.status === 'booked');
    if (!active.length) { c.innerHTML = `<div class="empty-state"><div class="empty-icon">🎫</div><p>No active bookings for ${formatDate(date)}.</p></div>`; return; }
    const cards = await Promise.all(active.map(async b => {
      try { const q = await bookingAPI.getQR(b._id); return { booking: b, qrDataUrl: q.qrDataUrl }; }
      catch { return { booking: b, qrDataUrl: null }; }
    }));
    const emoji = { breakfast:'🌅', lunch:'☀️', snacks:'🍪', dinner:'🌙' };
    c.innerHTML = cards.map(({ booking: b, qrDataUrl }) => `
      <div class="qr-pass-card">
        <div class="qr-pass-header">
          <span class="qr-pass-meal">${emoji[b.mealType]||''} ${b.mealType.charAt(0).toUpperCase()+b.mealType.slice(1)}</span>
          <span class="food-pref-pill ${b.foodPreference==='nonveg'?'nonveg':'veg'}">${b.foodPreference==='nonveg'?'🍗':'🥦'} ${b.foodPreference}</span>
        </div>
        <div class="qr-pass-date">${formatDate(b.date)}</div>
        ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR" class="qr-pass-img"/>` : '<div style="padding:40px;text-align:center;color:var(--text-muted);font-size:13px">QR unavailable</div>'}
        <div class="qr-pass-footer">
          <span class="badge badge-booked">Valid</span>
          ${qrDataUrl ? `<button class="btn-secondary" style="font-size:12px;padding:6px 12px" onclick="downloadQR('${qrDataUrl}','${b.mealType}-${b.date}')">⬇ Save</button>` : ''}
        </div>
      </div>`).join('');
  } catch (err) { c.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`; }
}

// ─── FEEDBACK ───────────────────────────────────────────────
function setupStarRating() {
  const stars = document.querySelectorAll('#starRating span');
  stars.forEach(s => {
    s.addEventListener('mouseover', () => stars.forEach(st => st.classList.toggle('active', +st.dataset.val <= +s.dataset.val)));
    s.addEventListener('mouseout',  () => { const cur = +document.getElementById('ratingValue').value; stars.forEach(st => st.classList.toggle('active', +st.dataset.val <= cur)); });
    s.addEventListener('click',     () => { document.getElementById('ratingValue').value = s.dataset.val; stars.forEach(st => st.classList.toggle('active', +st.dataset.val <= +s.dataset.val)); });
  });
}

async function submitFeedback() {
  const date    = document.getElementById('feedbackDate')?.value;
  const mealType= document.getElementById('feedbackMeal')?.value;
  const rating  = +document.getElementById('ratingValue')?.value;
  const comment = document.getElementById('feedbackComment')?.value.trim();
  if (!date || !mealType) { showToast('Date and meal are required.', 'error'); return; }
  if (!rating)            { showToast('Please select a star rating.', 'error'); return; }
  try {
    await feedbackAPI.submit({ date, mealType, rating, comment });
    showToast('⭐ Feedback submitted! Thank you.', 'success');
    document.getElementById('feedbackComment').value = '';
    document.getElementById('ratingValue').value = '0';
    document.querySelectorAll('#starRating span').forEach(s => s.classList.remove('active'));
    loadFeedbackHistory();
  } catch (err) { showToast(err.message, 'error'); }
}

async function loadFeedbackHistory() {
  const c = document.getElementById('feedbackList');
  c.innerHTML = '<div class="loading-state">Loading...</div>';
  try {
    const data = await feedbackAPI.getAll();
    if (!data.feedbacks.length) { c.innerHTML = '<div class="empty-state"><p>No feedback submitted yet.</p></div>'; return; }
    const emoji = { breakfast:'🌅', lunch:'☀️', snacks:'🍪', dinner:'🌙' };
    c.innerHTML = data.feedbacks.map(f => `
      <div class="feedback-item">
        <div class="feedback-item-header">
          <span>${emoji[f.mealType]||''} ${f.mealType}</span>
          <span class="feedback-stars">${starsHTML(f.rating)}</span>
        </div>
        <div class="feedback-meta">${formatDate(f.date)}</div>
        ${f.comment ? `<div class="feedback-comment">${f.comment}</div>` : ''}
      </div>`).join('');
  } catch (err) { c.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`; }
}

// ─── ANALYTICS ──────────────────────────────────────────────
async function loadAnalytics() {
  const c = document.getElementById('analyticsView');
  c.innerHTML = skeletonCards(4, '100px');
  try {
    const data = await analyticsAPI.myHistory(3);
    const a    = data.analytics;
    const emoji = { breakfast:'🌅', lunch:'☀️', snacks:'🍪', dinner:'🌙' };

    c.innerHTML = `
      <!-- Stat cards -->
      <div class="stats-grid" style="margin-bottom:24px">
        <div class="stat-card"><div class="stat-label">Total Meals</div><div><span class="stat-icon">🍽️</span><span class="stat-value">${a.totalBookings}</span></div></div>
        <div class="stat-card"><div class="stat-label">Consumed</div><div><span class="stat-icon">✅</span><span class="stat-value">${a.totalConsumed}</span></div></div>
        <div class="stat-card"><div class="stat-label">Fave Meal</div><div><span class="stat-icon">${emoji[a.mostBookedMeal]||'🍽️'}</span><span class="stat-value" style="font-size:20px;text-transform:capitalize">${a.mostBookedMeal}</span></div></div>
        <div class="stat-card"><div class="stat-label">Avg Rating Given</div><div><span class="stat-icon">⭐</span><span class="stat-value">${a.avgRatingGiven||'—'}</span></div></div>
      </div>

      <!-- Meal breakdown bar chart -->
      <div class="chart-card" style="margin-bottom:20px">
        <h3>Meals Booked by Type (last 3 months)</h3>
        <div class="bar-chart">
          ${Object.entries(a.mealCount).map(([meal, count]) => {
            const max = Math.max(...Object.values(a.mealCount), 1);
            return `<div class="bar-row">
              <div class="bar-label">${emoji[meal]||''} ${meal}</div>
              <div class="bar-track"><div class="bar-fill ${meal}" style="width:${Math.round(count/max*100)}%">${count}</div></div>
            </div>`;
          }).join('')}
        </div>
      </div>

      <!-- Monthly trend -->
      <div class="chart-card">
        <h3>Monthly Meal Activity</h3>
        <div class="bar-chart">
          ${a.monthly.map(m => {
            const max = Math.max(...a.monthly.map(x => x.total), 1);
            return `<div class="bar-row">
              <div class="bar-label">${m.month}</div>
              <div class="bar-track"><div class="bar-fill rating" style="width:${Math.round(m.total/max*100)}%">${m.total} meals</div></div>
            </div>`;
          }).join('')}
        </div>
      </div>
    `;
  } catch (err) { c.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`; }
}

// ─── SETTINGS ───────────────────────────────────────────────
async function loadSettings() {
  const user = getUser();
  const c    = document.getElementById('settingsView');
  const np   = user.notificationPrefs || {};
  c.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <!-- Profile Card -->
      <div style="background:var(--dark-2);border:1px solid var(--border);border-radius:14px;padding:24px">
        <h3 style="font-family:var(--font-head);font-weight:700;margin-bottom:20px">👤 Profile</h3>
        <div class="form-group"><label>Room Number</label><input type="text" id="settingRoom" value="${user.roomNumber||''}" placeholder="A-101"/></div>
        <div class="form-group"><label>Food Preference</label>
          <select id="settingFoodPref">
            <option value="veg"    ${user.foodPreference==='veg'   ?'selected':''}>🥦 Veg</option>
            <option value="nonveg" ${user.foodPreference==='nonveg'?'selected':''}>🍗 Non-Veg</option>
            <option value="both"   ${user.foodPreference==='both'  ?'selected':''}>🍱 Both</option>
          </select>
        </div>
        <button class="btn-primary" onclick="saveProfile()"><span>Save Profile</span></button>
      </div>
      <!-- Notification Prefs Card -->
      <div style="background:var(--dark-2);border:1px solid var(--border);border-radius:14px;padding:24px">
        <h3 style="font-family:var(--font-head);font-weight:700;margin-bottom:20px">🔔 Notifications</h3>
        <div class="notify-toggle-row" style="margin-bottom:12px">
          <label class="toggle-label">
            <input type="checkbox" id="notifEmail" ${np.emailEnabled!==false?'checked':''}/>
            <span class="toggle-switch"></span>
            <span>📧 Email notifications</span>
          </label>
        </div>
        <p style="font-size:12px;color:var(--text-muted);margin-bottom:14px">Choose which meals to get notified about:</p>
        ${['breakfast','lunch','snacks','dinner'].map(m => `
          <div class="notify-toggle-row" style="margin-bottom:8px">
            <label class="toggle-label">
              <input type="checkbox" id="notif_${m}" ${(np.meals?.[m]!==false)?'checked':''}/>
              <span class="toggle-switch"></span>
              <span>${{breakfast:'🌅',lunch:'☀️',snacks:'🍪',dinner:'🌙'}[m]} ${m.charAt(0).toUpperCase()+m.slice(1)}</span>
            </label>
          </div>`).join('')}
        <button class="btn-primary" style="margin-top:16px" onclick="saveNotifPrefs()"><span>Save Preferences</span></button>
      </div>
    </div>
  `;
}

async function saveProfile() {
  try {
    const data = await authAPI.updateProfile({
      roomNumber:     document.getElementById('settingRoom').value.trim(),
      foodPreference: document.getElementById('settingFoodPref').value,
    });
    const user = getUser(); user.foodPreference = data.user.foodPreference; user.roomNumber = data.user.roomNumber;
    localStorage.setItem('hfms_user', JSON.stringify(user));
    showToast('Profile saved!', 'success');
  } catch (err) { showToast(err.message, 'error'); }
}

async function saveNotifPrefs() {
  try {
    const meals = {};
    ['breakfast','lunch','snacks','dinner'].forEach(m => {
      meals[m] = document.getElementById(`notif_${m}`)?.checked ?? true;
    });
    await authAPI.updateNotifPrefs({ emailEnabled: document.getElementById('notifEmail')?.checked ?? true, meals });
    showToast('Notification preferences saved!', 'success');
  } catch (err) { showToast(err.message, 'error'); }
}
