// Shared by the page and the service worker: tiny IndexedDB key-value store + date helpers.
var EDD_DB = (function () {
  var DB_NAME = 'edd-planner', STORE = 'kv', dbp = null;
  function open() {
    if (!dbp) dbp = new Promise(function (res, rej) {
      var r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(STORE); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
    return dbp;
  }
  function tx(mode, fn) {
    return open().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction(STORE, mode), req = fn(t.objectStore(STORE));
        t.oncomplete = function () { res(req && req.result); };
        t.onerror = function () { rej(t.error); };
      });
    });
  }
  return {
    get: function (k) { return tx('readonly', function (s) { return s.get(k); }); },
    set: function (k, v) { return tx('readwrite', function (s) { return s.put(v, k); }); }
  };
})();

function pad2(n) { return (n < 10 ? '0' : '') + n; }
function ymd(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
function parseYmd(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
function addDays(d, n) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; }
function today0() { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }

var TYPE_LABEL = { normal: 'Normal', cs: 'C-Section', undecided: 'Not decided' };

// Builds and shows the "tomorrow" reminder once per day, after the chosen hour.
function eddCheckReminder(reg, force) {
  return Promise.all([EDD_DB.get('settings'), EDD_DB.get('patients')]).then(function (r) {
    var s = r[0] || {}, pts = r[1] || [], now = new Date(), todayStr = ymd(now);
    if (!force) {
      if (!s.reminderOn) return;
      if (s.lastNotified === todayStr) return;
      if (now.getHours() < (s.reminderHour == null ? 20 : s.reminderHour)) return;
    }
    var tmr = ymd(addDays(now, 1));
    var list = pts.filter(function (p) { return !p.delivered && p.edd === tmr; });
    var c = { normal: 0, cs: 0, undecided: 0 };
    list.forEach(function (p) { c[p.type]++; });
    var title, body;
    if (list.length) {
      title = list.length + (list.length === 1 ? ' delivery' : ' deliveries') + ' expected tomorrow';
      var parts = [];
      if (c.cs) parts.push(c.cs + ' C-Section');
      if (c.normal) parts.push(c.normal + ' Normal');
      if (c.undecided) parts.push(c.undecided + ' Not decided');
      body = parts.join(' · ') + '\n' + list.map(function (p) { return p.name; }).join(', ');
    } else {
      title = 'No deliveries expected tomorrow';
      body = 'Your schedule for tomorrow is clear.';
    }
    if (!force) s.lastNotified = todayStr;
    return EDD_DB.set('settings', s).then(function () {
      return reg.showNotification(title, {
        body: body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png',
        tag: 'edd-daily', renotify: true, data: { date: tmr }
      });
    });
  });
}
