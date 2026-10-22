(function () {
  'use strict';

  var state = {
    patients: [],
    settings: {},
    tab: 'day',
    day: ymd(addDays(today0(), 1)),   // opens on tomorrow
    weekStart: mondayOf(today0()),
    month: firstOfMonth(today0()),
    plist: 'upcoming',
    search: ''
  };

  var $view = document.getElementById('view');
  var $sheetWrap = document.getElementById('sheetWrap');
  var $sheetBody = document.getElementById('sheetBody');
  var DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  /* ---------- helpers ---------- */
  function mondayOf(d) { var k = (d.getDay() + 6) % 7; return addDays(d, -k); }
  function firstOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(s) { if (!s) return '—'; var d = parseYmd(s); return DOW[d.getDay()] + ', ' + d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); }
  function fmtShort(s) { var d = parseYmd(s); return d.getDate() + ' ' + MON[d.getMonth()]; }
  function daysBetween(a, b) { return Math.round((parseYmd(b) - parseYmd(a)) / 86400000); }
  function relLabel(s) {
    var n = daysBetween(ymd(today0()), s);
    if (n === 0) return 'Today'; if (n === 1) return 'Tomorrow'; if (n === -1) return 'Yesterday';
    return n > 0 ? 'In ' + n + ' days' : Math.abs(n) + ' days ago';
  }
  // Gestational age on a given date, from EDD (EDD = 40w 0d).
  function gaOn(edd, onDate) {
    var days = 280 - daysBetween(onDate, edd);
    if (days < 0 || days > 320) return '';
    return Math.floor(days / 7) + 'w ' + (days % 7) + 'd';
  }
  function shortName(n) { var p = n.trim().split(/\s+/); return p.length > 1 ? p[0] + ' ' + p[1].charAt(0) + '.' : p[0]; }
  function active() { return state.patients.filter(function (p) { return !p.delivered; }); }
  function onDate(s) { return active().filter(function (p) { return p.edd === s; }).sort(typeSort); }
  var TYPE_ORDER = { cs: 0, normal: 1, undecided: 2 };
  function typeSort(a, b) { return TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || a.name.localeCompare(b.name); }
  function overdue() { var t = ymd(today0()); return active().filter(function (p) { return p.edd < t; }); }
  function counts(list) { var c = { normal: 0, cs: 0, undecided: 0 }; list.forEach(function (p) { c[p.type]++; }); return c; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, 2400);
  }

  function save() {
    return EDD_DB.set('patients', state.patients).catch(function () { alert('Could not save data on this device.'); });
  }
  function saveSettings() { return EDD_DB.set('settings', state.settings); }

  /* ---------- rendering ---------- */
  function render() {
    document.querySelectorAll('.tabs button').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === state.tab); });
    document.getElementById('fab').hidden = state.tab === 'settings';
    ({ day: renderDay, week: renderWeek, month: renderMonth, patients: renderPatients, settings: renderSettings })[state.tab]();
  }

  function summaryHtml(list) {
    var c = counts(list);
    return '<div class="summary">' +
      '<div><b>' + list.length + '</b><span>Total</span></div>' +
      '<div class="cs"><b>' + c.cs + '</b><span>C-Section</span></div>' +
      '<div class="normal"><b>' + c.normal + '</b><span>Normal</span></div>' +
      '<div class="undecided"><b>' + c.undecided + '</b><span>Not decided</span></div></div>';
  }

  function cardHtml(p, metaMode) {
    var meta;
    if (metaMode === 'edd') meta = 'EDD ' + fmt(p.edd) + (p.delivered ? '' : ' · ' + relLabel(p.edd));
    else meta = gaOn(p.edd, ymd(today0())) ? 'GA today ' + gaOn(p.edd, ymd(today0())) : '';
    if (p.delivered) meta = 'Delivered ' + fmt(p.deliveredOn) + ' · EDD was ' + fmtShort(p.edd);
    return '<button class="card ' + p.type + (p.delivered ? ' done' : '') + '" data-open="' + p.id + '">' +
      '<div class="main"><div class="name">' + esc(p.name) + '</div><div class="meta">' + esc(meta) + '</div></div>' +
      '<span class="badge ' + (p.delivered ? 'delivered' : p.type) + '">' + (p.delivered ? 'Delivered' : TYPE_LABEL[p.type]) + '</span></button>';
  }

  function renderDay() {
    var list = onDate(state.day), t = ymd(today0()), tm = ymd(addDays(today0(), 1));
    var od = overdue();
    var h = '<div class="navrow"><button class="arrow" data-day="-1" aria-label="Previous day">‹</button>' +
      '<div class="title"><strong>' + fmt(state.day) + '</strong><small>' + relLabel(state.day) + '</small></div>' +
      '<button class="arrow" data-day="1" aria-label="Next day">›</button></div>' +
      '<div class="quick"><button class="pill' + (state.day === t ? ' on' : '') + '" data-goto="' + t + '">Today</button>' +
      '<button class="pill' + (state.day === tm ? ' on' : '') + '" data-goto="' + tm + '">Tomorrow</button>' +
      '<label class="pill">Pick date <input type="date" id="pickDay" value="' + state.day + '" style="width:0;height:0;opacity:0;border:0;padding:0"></label></div>';
    if (od.length) h += '<button class="alert" data-overdue>⚠ ' + od.length + ' patient' + (od.length > 1 ? 's are' : ' is') + ' past EDD and not marked delivered. Tap to review.</button>';
    h += summaryHtml(list);
    if (list.length) h += list.map(function (p) { return cardHtml(p); }).join('');
    else h += '<div class="empty"><div class="big">🗓</div>No expected deliveries on this day.</div>';
    $view.innerHTML = h;
    var pick = document.getElementById('pickDay');
    pick.parentNode.addEventListener('click', function () { if (pick.showPicker) try { pick.showPicker(); } catch (e) {} });
    pick.addEventListener('change', function () { if (pick.value) { state.day = pick.value; render(); } });
  }

  function renderWeek() {
    var ws = state.weekStart, we = addDays(ws, 6), t = ymd(today0()), all = [];
    var rows = '';
    for (var i = 0; i < 7; i++) {
      var d = addDays(ws, i), s = ymd(d), list = onDate(s);
      all = all.concat(list);
      rows += '<div class="wrow' + (s === t ? ' today' : '') + '">' +
        '<button class="wday" data-goto="' + s + '"><span>' + DOW[d.getDay()] + '</span><b>' + d.getDate() + '</b></button>' +
        '<div class="wchips">' + (list.length ? list.map(function (p) {
          return '<button class="chip ' + p.type + '" data-open="' + p.id + '">' + esc(shortName(p.name)) + '</button>';
        }).join('') : '<span class="nochip">—</span>') + '</div>' +
        (list.length ? '<div class="wcount">' + list.length + '</div>' : '') + '</div>';
    }
    var label = ws.getDate() + ' ' + MON[ws.getMonth()] + ' – ' + we.getDate() + ' ' + MON[we.getMonth()] + ' ' + we.getFullYear();
    var thisWeek = ymd(ws) === ymd(mondayOf(today0()));
    $view.innerHTML = '<div class="navrow"><button class="arrow" data-week="-1" aria-label="Previous week">‹</button>' +
      '<div class="title"><strong>' + label + '</strong><small>' + weekRel(ws) + '</small></div>' +
      '<button class="arrow" data-week="1" aria-label="Next week">›</button></div>' +
      (thisWeek ? '' : '<div class="quick"><button class="pill" data-thisweek>Back to this week</button></div>') +
      summaryHtml(all) + '<div class="week">' + rows + '</div>';
  }
  function weekRel(ws) {
    var n = Math.round(daysBetween(ymd(mondayOf(today0())), ymd(ws)) / 7);
    if (n === 0) return 'This week'; if (n === 1) return 'Next week'; if (n === -1) return 'Last week';
    return n > 0 ? 'In ' + n + ' weeks' : Math.abs(n) + ' weeks ago';
  }

  function renderMonth() {
    var m = state.month, start = mondayOf(m), t = ymd(today0()), cells = '', monthList = [];
    var last = new Date(m.getFullYear(), m.getMonth() + 1, 0);
    var end = addDays(mondayOf(last), 6);
    for (var d = start; d <= end; d = addDays(d, 1)) {
      var s = ymd(d), inMonth = d.getMonth() === m.getMonth(), list = onDate(s);
      if (inMonth) monthList = monthList.concat(list);
      var bars = list.slice(0, 3).map(function (p) { return '<div class="mbar ' + p.type + '">' + esc(p.name.split(/\s+/)[0]) + '</div>'; }).join('');
      if (list.length > 3) bars += '<div class="mmore">+' + (list.length - 3) + ' more</div>';
      cells += '<button class="mcell' + (inMonth ? '' : ' out') + (s === t ? ' today' : '') + '" data-goto="' + s + '">' +
        '<span class="mnum">' + d.getDate() + '</span><div class="mbars">' + bars + '</div></button>';
    }
    var isThis = m.getFullYear() === today0().getFullYear() && m.getMonth() === today0().getMonth();
    $view.innerHTML = '<div class="navrow"><button class="arrow" data-month="-1" aria-label="Previous month">‹</button>' +
      '<div class="title"><strong>' + MONTH_FULL[m.getMonth()] + ' ' + m.getFullYear() + '</strong><small>' + (isThis ? 'This month' : '&nbsp;') + '</small></div>' +
      '<button class="arrow" data-month="1" aria-label="Next month">›</button></div>' +
      (isThis ? '' : '<div class="quick"><button class="pill" data-thismonth>Back to this month</button></div>') +
      summaryHtml(monthList) +
      '<div class="month"><div class="mhead"><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div><div>Sun</div></div>' +
      '<div class="mgrid">' + cells + '</div></div>' +
      '<p style="text-align:center;color:var(--muted);font-size:13px">Tap any day to see its full list.</p>';
  }

  function renderPatients() {
    var t = ymd(today0()), q = state.search.toLowerCase(), list;
    var od = overdue();
    if (state.plist === 'upcoming') list = active().filter(function (p) { return p.edd >= t; }).sort(function (a, b) { return a.edd.localeCompare(b.edd); });
    else if (state.plist === 'overdue') list = od.sort(function (a, b) { return a.edd.localeCompare(b.edd); });
    else list = state.patients.filter(function (p) { return p.delivered; }).sort(function (a, b) { return (b.deliveredOn || '').localeCompare(a.deliveredOn || ''); });
    if (q) list = list.filter(function (p) { return (p.name + ' ' + (p.phone || '') + ' ' + (p.obs || '') + ' ' + (p.notes || '')).toLowerCase().indexOf(q) >= 0; });
    var seg = function (k, label) { return '<button class="' + (state.plist === k ? 'on' : '') + '" data-plist="' + k + '">' + label + '</button>'; };
    $view.innerHTML = '<input class="search" id="search" type="search" placeholder="Search name, phone, notes…" value="' + esc(state.search) + '">' +
      '<div class="seg">' + seg('upcoming', 'Upcoming') + seg('overdue', 'Past EDD' + (od.length ? ' (' + od.length + ')' : '')) + seg('delivered', 'Delivered') + '</div>' +
      (list.length ? list.map(function (p) { return cardHtml(p, 'edd'); }).join('') :
        '<div class="empty"><div class="big">📋</div>' + (q ? 'No match found.' : state.plist === 'upcoming' ? 'No upcoming patients yet. Tap + to add one.' : state.plist === 'overdue' ? 'Nobody is past EDD. 👍' : 'No delivered patients yet.') + '</div>');
    var s = document.getElementById('search');
    s.addEventListener('input', function () {
      state.search = s.value; var pos = s.selectionStart; renderPatients();
      var n = document.getElementById('search'); n.focus(); n.setSelectionRange(pos, pos);
    });
  }

  function renderSettings() {
    var s = state.settings, hour = s.reminderHour == null ? 20 : s.reminderHour, opts = '';
    for (var h = 5; h <= 23; h++) opts += '<option value="' + h + '"' + (h === hour ? ' selected' : '') + '>' + ((h % 12) || 12) + ':00 ' + (h < 12 ? 'AM' : 'PM') + '</option>';
    var notifState = !('Notification' in window) ? 'not supported' : Notification.permission;
    $view.innerHTML =
      '<div class="panel"><h2>🔔 Daily reminder</h2><p>Every evening the app tells you how many deliveries are expected tomorrow.</p>' +
      '<div class="row"><label for="remOn">Reminder on</label><input type="checkbox" class="switch" id="remOn"' + (s.reminderOn ? ' checked' : '') + '></div>' +
      '<div class="row"><label for="remHour">Remind me after</label><select id="remHour" style="padding:8px;border-radius:10px;border:1px solid var(--line)">' + opts + '</select></div>' +
      '<p style="font-size:12px">Notification permission: <b>' + notifState + '</b>. Android sends the reminder in the background once the app is installed on the home screen; if the phone is in deep battery saving it may come a little late, and it also appears whenever you open the app after the chosen time.</p>' +
      '<button class="btn ghost block" id="testRem">Send a test reminder now</button></div>' +

      '<div class="panel"><h2>💾 Backup</h2><p>Your data is stored only on this phone. Save a backup file regularly (e.g. send it to yourself on WhatsApp or email) so nothing is lost if the phone is changed or reset.</p>' +
      '<div class="btns"><button class="btn" id="exportBtn">Save backup</button><button class="btn ghost" id="importBtn">Restore backup</button></div>' +
      '<input type="file" id="importFile" accept=".json,application/json" hidden>' +
      '<p style="font-size:12px;margin-top:10px">' + state.patients.length + ' patients saved' + (s.lastBackup ? ' · last backup ' + fmt(s.lastBackup) : ' · no backup yet') + '</p></div>' +

      '<div class="panel"><h2>🎨 Colours</h2>' +
      '<div class="btns" style="gap:6px"><span class="chip cs">C-Section</span><span class="chip normal">Normal delivery</span><span class="chip undecided">Not decided yet</span></div></div>' +

      '<div class="panel"><h2>About</h2><p>EDD Planner · made for Prof. Dr. Sajida Guftaar for personal use. Works fully offline; no account and no cloud storage.</p></div>';

    document.getElementById('remOn').addEventListener('change', function (e) { toggleReminder(e.target.checked, e.target); });
    document.getElementById('remHour').addEventListener('change', function (e) {
      state.settings.reminderHour = +e.target.value; state.settings.lastNotified = null; saveSettings(); toast('Reminder time saved');
    });
    document.getElementById('testRem').addEventListener('click', testReminder);
    document.getElementById('exportBtn').addEventListener('click', exportData);
    document.getElementById('importBtn').addEventListener('click', function () { document.getElementById('importFile').click(); });
    document.getElementById('importFile').addEventListener('change', importData);
  }

  /* ---------- sheets ---------- */
  // Sheets push a history entry so the Android back button closes them instead of the app.
  function openSheet(html) {
    if ($sheetWrap.hidden) history.pushState({ sheet: 1 }, '');
    $sheetBody.innerHTML = html; $sheetWrap.hidden = false; document.body.style.overflow = 'hidden'; $sheetBody.parentNode.scrollTop = 0;
  }
  function closeSheet(fromBack) {
    if ($sheetWrap.hidden) return;
    $sheetWrap.hidden = true; $sheetBody.innerHTML = ''; document.body.style.overflow = '';
    if (!fromBack && history.state && history.state.sheet) history.back();
  }
  $sheetWrap.addEventListener('click', function (e) { if (e.target.hasAttribute('data-close')) closeSheet(); });

  function showDetail(id) {
    var p = state.patients.find(function (x) { return x.id === id; });
    if (!p) return;
    var ga = gaOn(p.edd, ymd(today0()));
    var rows = [
      ['EDD', fmt(p.edd) + (p.delivered ? '' : ' (' + relLabel(p.edd) + ')')],
      ['GA today', p.delivered ? '' : ga],
      ['EDD given on', p.givenOn ? fmt(p.givenOn) : ''],
      ['Delivered on', p.delivered ? fmt(p.deliveredOn) : ''],
      ['G / P', p.obs || '']
    ].filter(function (r) { return r[1]; });
    var h = '<div class="detail-head"><h2>' + esc(p.name) + '</h2><span class="badge ' + p.type + '">' + TYPE_LABEL[p.type] + '</span></div>' +
      '<dl class="dl">' + rows.map(function (r) { return '<div><dt>' + (r[0] || '&nbsp;') + '</dt><dd>' + esc(r[1]) + '</dd></div>'; }).join('') +
      (p.phone ? '<div><dt>Phone</dt><dd><a href="tel:' + esc(p.phone) + '" style="color:var(--brand)">' + esc(p.phone) + ' 📞</a></dd></div>' : '') + '</dl>' +
      (p.notes ? '<div class="notes"><small>NOTES</small>' + esc(p.notes) + '</div>' : '') +
      '<div class="btns" style="margin-bottom:8px">' +
      (p.delivered ? '<button class="btn ghost" data-act="undeliver">Undo delivered</button>' : '<button class="btn" data-act="deliver">✓ Mark delivered</button>') +
      '<button class="btn ghost" data-act="edit">Edit</button></div>' +
      '<div class="btns"><button class="btn danger" data-act="delete">Delete</button><button class="btn ghost" data-close>Close</button></div>';
    openSheet(h);
    $sheetBody.querySelectorAll('[data-act]').forEach(function (b) {
      b.addEventListener('click', function () {
        var a = b.dataset.act;
        if (a === 'edit') showForm(p);
        if (a === 'deliver') showDeliver(p);
        if (a === 'undeliver') { p.delivered = false; p.deliveredOn = null; save(); closeSheet(); render(); toast('Moved back to upcoming'); }
        if (a === 'delete' && confirm('Delete ' + p.name + ' permanently?')) {
          state.patients = state.patients.filter(function (x) { return x.id !== p.id; }); save(); closeSheet(); render(); toast('Patient deleted');
        }
      });
    });
  }

  function typeButtons(cur) {
    return '<div class="types">' + ['cs', 'normal', 'undecided'].map(function (k) {
      return '<span><input type="radio" name="type" id="t_' + k + '" value="' + k + '"' + (cur === k ? ' checked' : '') + '><label class="' + k + '" for="t_' + k + '">' + TYPE_LABEL[k] + '</label></span>';
    }).join('') + '</div>';
  }

  function showDeliver(p) {
    openSheet('<h2>Mark delivered</h2><p style="margin-top:-6px;color:var(--muted)">' + esc(p.name) + '</p>' +
      '<div class="field"><label>Delivery date</label><input type="date" id="dDate" value="' + ymd(today0()) + '"></div>' +
      '<div class="field"><label>Mode of delivery</label>' + typeButtons(p.type === 'undecided' ? '' : p.type).replace('<span><input type="radio" name="type" id="t_undecided" value="undecided"><label class="undecided" for="t_undecided">Not decided</label></span>', '') + '</div>' +
      '<div class="btns"><button class="btn" id="dSave">Save</button><button class="btn ghost" data-close>Cancel</button></div>');
    $sheetBody.querySelector('.types').style.gridTemplateColumns = '1fr 1fr';
    document.getElementById('dSave').addEventListener('click', function () {
      var t = $sheetBody.querySelector('input[name=type]:checked');
      p.delivered = true; p.deliveredOn = document.getElementById('dDate').value || ymd(today0());
      if (t) p.type = t.value;
      save(); closeSheet(); render(); toast('Marked as delivered');
    });
  }

  function showForm(p) {
    var isNew = !p;
    p = p || { type: 'undecided', givenOn: ymd(today0()) };
    var hasOptional = p.phone || p.obs || p.notes;
    openSheet('<h2>' + (isNew ? 'Add patient' : 'Edit patient') + '</h2><form id="pf" autocomplete="off">' +
      '<div class="field"><label for="fName">Patient name *</label><input id="fName" required value="' + esc(p.name || '') + '" placeholder="e.g. Ayesha Khan"></div>' +
      '<div class="two"><div class="field"><label for="fEdd">Expected delivery date *</label><input type="date" id="fEdd" required value="' + (p.edd || '') + '"></div>' +
      '<div class="field"><label for="fGiven">Date given</label><input type="date" id="fGiven" value="' + (p.givenOn || '') + '"></div></div>' +
      '<div class="field"><label for="fLmp">Or calculate EDD from LMP</label><input type="date" id="fLmp"><div class="hint">Picking LMP fills EDD automatically (LMP + 280 days).</div></div>' +
      '<div class="field"><label>Delivery plan</label>' + typeButtons(p.type) + '</div>' +
      '<details class="optional"' + (hasOptional ? ' open' : '') + '><summary>More details (optional)</summary>' +
      '<div class="two"><div class="field"><label for="fObs">G / P</label><input id="fObs" value="' + esc(p.obs || '') + '" placeholder="e.g. G3P2"></div>' +
      '<div class="field"><label for="fPhone">Phone</label><input id="fPhone" type="tel" value="' + esc(p.phone || '') + '" placeholder="03xx xxxxxxx"></div></div>' +
      '<div class="field"><label for="fNotes">Doctor’s notes</label><textarea id="fNotes" placeholder="e.g. Previous LSCS, anaemia, breech…">' + esc(p.notes || '') + '</textarea></div></details>' +
      '<div class="btns" style="margin-top:8px"><button class="btn" type="submit">' + (isNew ? 'Save patient' : 'Save changes') + '</button><button class="btn ghost" type="button" data-close>Cancel</button></div></form>');
    document.getElementById('fLmp').addEventListener('change', function (e) {
      if (e.target.value) document.getElementById('fEdd').value = ymd(addDays(parseYmd(e.target.value), 280));
    });
    if (isNew) setTimeout(function () { document.getElementById('fName').focus(); }, 150);
    document.getElementById('pf').addEventListener('submit', function (e) {
      e.preventDefault();
      var name = document.getElementById('fName').value.trim(), edd = document.getElementById('fEdd').value;
      if (!name || !edd) { toast('Name and EDD are required'); return; }
      var rec = isNew ? { id: uid(), createdAt: new Date().toISOString(), delivered: false } : p;
      rec.name = name; rec.edd = edd;
      rec.givenOn = document.getElementById('fGiven').value || '';
      rec.type = ($sheetBody.querySelector('input[name=type]:checked') || {}).value || 'undecided';
      rec.obs = document.getElementById('fObs').value.trim();
      rec.phone = document.getElementById('fPhone').value.trim();
      rec.notes = document.getElementById('fNotes').value.trim();
      if (isNew) state.patients.push(rec);
      save(); closeSheet();
      if (isNew && state.tab === 'day') state.day = edd;
      render();
      toast(isNew ? 'Saved · EDD ' + fmt(edd) : 'Changes saved');
    });
  }

  /* ---------- reminder ---------- */
  function swReady() { return 'serviceWorker' in navigator ? navigator.serviceWorker.ready : Promise.reject(new Error('no sw')); }

  function toggleReminder(on, input) {
    if (!on) { state.settings.reminderOn = false; saveSettings(); unregisterSync(); toast('Reminder turned off'); return; }
    if (!('Notification' in window)) { input.checked = false; toast('Notifications are not supported here'); return; }
    Notification.requestPermission().then(function (perm) {
      if (perm !== 'granted') { input.checked = false; toast('Please allow notifications for this app'); renderSettings(); return; }
      state.settings.reminderOn = true;
      if (state.settings.reminderHour == null) state.settings.reminderHour = 20;
      saveSettings().then(registerSync);
      toast('Daily reminder is on');
      renderSettings();
    });
  }
  function registerSync() {
    return swReady().then(function (reg) {
      if (!reg.periodicSync) return;
      return navigator.permissions.query({ name: 'periodic-background-sync' }).then(function (st) {
        if (st.state === 'granted') return reg.periodicSync.register('edd-daily', { minInterval: 6 * 60 * 60 * 1000 });
      });
    }).catch(function () {});
  }
  function unregisterSync() {
    swReady().then(function (reg) { if (reg.periodicSync) reg.periodicSync.unregister('edd-daily'); }).catch(function () {});
  }
  function testReminder() {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      Notification && Notification.requestPermission && Notification.requestPermission().then(function (p) { if (p === 'granted') testReminder(); else toast('Please allow notifications first'); });
      return;
    }
    swReady().then(function (reg) { return eddCheckReminder(reg, true); }).then(function () { toast('Test reminder sent'); })
      .catch(function () { toast('Install the app first, then try again'); });
  }
  function checkReminderNow() {
    if (state.settings.reminderOn && 'Notification' in window && Notification.permission === 'granted')
      swReady().then(function (reg) { return eddCheckReminder(reg, false); }).catch(function () {});
  }

  /* ---------- backup ---------- */
  function exportData() {
    var data = JSON.stringify({ app: 'edd-planner', version: 1, exportedAt: new Date().toISOString(), patients: state.patients }, null, 1);
    var name = 'EDD-Planner-backup-' + ymd(today0()) + '.json';
    var blob = new Blob([data], { type: 'application/json' });
    var done = function () { state.settings.lastBackup = ymd(today0()); saveSettings(); renderSettings(); };
    var file;
    try { file = new File([blob], name, { type: 'application/json' }); } catch (e) {}
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: 'EDD Planner backup' }).then(done).catch(function (e) { if (e.name !== 'AbortError') download(); });
    } else download();
    function download() {
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click(); a.remove(); done(); toast('Backup saved to Downloads');
    }
  }
  function importData(e) {
    var f = e.target.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var d = JSON.parse(r.result), list = Array.isArray(d) ? d : d.patients;
        if (!Array.isArray(list)) throw new Error('bad');
        list = list.filter(function (p) { return p && p.id && p.name && /^\d{4}-\d{2}-\d{2}$/.test(p.edd); });
        if (!confirm('Restore ' + list.length + ' patients from this backup?\nPatients already on the phone are kept; matching ones are updated.')) return;
        var byId = {}; state.patients.forEach(function (p) { byId[p.id] = p; });
        list.forEach(function (p) { if (!TYPE_LABEL[p.type]) p.type = 'undecided'; byId[p.id] = p; });
        state.patients = Object.keys(byId).map(function (k) { return byId[k]; });
        save(); render(); toast('Backup restored');
      } catch (err) { alert('This file is not a valid EDD Planner backup.'); }
      e.target.value = '';
    };
    r.readAsText(f);
  }

  /* ---------- events ---------- */
  document.querySelector('.tabs').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    state.tab = b.dataset.tab;
    if (state.tab === 'day' && b.classList.contains('active')) state.day = ymd(addDays(today0(), 1));
    render(); window.scrollTo(0, 0);
  });
  document.getElementById('fab').addEventListener('click', function () { showForm(null); });

  $view.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var ds = b.dataset;
    if (ds.open) { showDetail(ds.open); return; }
    if (ds.day) { state.day = ymd(addDays(parseYmd(state.day), +ds.day)); render(); }
    else if (ds.goto) { state.day = ds.goto; state.tab = 'day'; render(); window.scrollTo(0, 0); }
    else if (ds.week) { state.weekStart = addDays(state.weekStart, 7 * ds.week); render(); }
    else if ('thisweek' in ds) { state.weekStart = mondayOf(today0()); render(); }
    else if (ds.month) { state.month = new Date(state.month.getFullYear(), state.month.getMonth() + (+ds.month), 1); render(); }
    else if ('thismonth' in ds) { state.month = firstOfMonth(today0()); render(); }
    else if (ds.plist) { state.plist = ds.plist; render(); }
    else if ('overdue' in ds) { state.tab = 'patients'; state.plist = 'overdue'; render(); }
  });

  // Swipe left/right to move between days / weeks / months.
  var sx = null, sy = null;
  $view.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  $view.addEventListener('touchend', function (e) {
    if (sx == null) return;
    var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = null;
    if (Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
    var dir = dx < 0 ? 1 : -1;
    if (state.tab === 'day') state.day = ymd(addDays(parseYmd(state.day), dir));
    else if (state.tab === 'week') state.weekStart = addDays(state.weekStart, 7 * dir);
    else if (state.tab === 'month') state.month = new Date(state.month.getFullYear(), state.month.getMonth() + dir, 1);
    else return;
    render();
  }, { passive: true });

  window.addEventListener('popstate', function () { closeSheet(true); });

  function applyHash() {
    var m = /day=(\d{4}-\d{2}-\d{2})/.exec(location.hash);
    if (m) { state.tab = 'day'; state.day = m[1]; history.replaceState(null, '', location.pathname + location.search); }
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') { applyHash(); render(); checkReminderNow(); }
  });

  /* ---------- start ---------- */
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});

  Promise.all([EDD_DB.get('patients'), EDD_DB.get('settings')]).then(function (r) {
    state.patients = r[0] || [];
    state.settings = r[1] || {};
    applyHash();
    render();
    if (state.settings.reminderOn) registerSync();
    checkReminderNow();
  }).catch(function () {
    $view.innerHTML = '<div class="empty">This browser cannot store data. Please open the app in Chrome.</div>';
  });
})();
