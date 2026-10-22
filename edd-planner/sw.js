importScripts('db.js');
var CACHE = 'edd-planner-v3';
var FILES = ['./', 'index.html', 'app.css', 'app.js', 'db.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (hit) {
    return hit || fetch(e.request).catch(function () { return caches.match('index.html'); });
  }));
});

self.addEventListener('periodicsync', function (e) {
  if (e.tag === 'edd-daily') e.waitUntil(eddCheckReminder(self.registration, false));
});
self.addEventListener('message', function (e) {
  if (e.data === 'check-reminder') e.waitUntil(eddCheckReminder(self.registration, false));
  if (e.data === 'test-reminder') e.waitUntil(eddCheckReminder(self.registration, true));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = './#day=' + ((e.notification.data && e.notification.data.date) || '');
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
    for (var i = 0; i < cs.length; i++) { if ('focus' in cs[i]) { cs[i].navigate(url); return cs[i].focus(); } }
    return self.clients.openWindow(url);
  }));
});
