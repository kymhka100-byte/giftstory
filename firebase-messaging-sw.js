// 빨간 우체통 알림 도우미 (index.html 과 같은 곳에 올려 주세요)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// 서버에서 보내는 푸시 알림 (앱이 닫혀 있을 때)
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { notification: { body: e.data ? e.data.text() : '' } }; }
  const n = d.notification || {}, data = d.data || {};
  e.waitUntil(self.registration.showNotification(n.title || data.title || '빨간 우체통', {
    body: n.body || data.body || '새 소식이 왔어요',
    tag: data.room ? 'rp-' + data.room : 'rp',
    renotify: true,
    data: { url: data.url || self.registration.scope }
  }));
});

// 알림을 누르면 앱 열기
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if (c.url.startsWith(self.registration.scope)) return c.focus();
    return self.clients.openWindow(url);
  }));
});
