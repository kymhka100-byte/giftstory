/* 빨간 우체통 서비스 워커 (24번)
   · 폰에 앱을 저장해 두고 폰에 있는 걸로 바로 열어요 (GitHub에서 매번 안 받음)
   · 열 때 새 버전을 몰래 받아 두고 → 다음에 열면 새 버전
   · 알림 (앱을 닫아도 와요) */
const CACHE = 'rp-app';

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(
    ['./', 'manifest.json', 'icon-192.png'].map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {}))
  )));
});
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || r.headers.has('range')) return;
  const u = new URL(r.url);
  if (u.origin !== location.origin) return;   // 파이어베이스 · 유튜브 · 노래 파일은 그대로
  const page = r.mode === 'navigate';
  const key = page ? u.origin + u.pathname : r.url;   // ?room= 은 빼고 저장
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(key);
    const net = fetch(page ? u.href : r.url, { cache: 'no-cache' }).then(res => {
      if (res && res.ok && res.status === 200) c.put(key, res.clone()).catch(() => {});
      return res;
    });
    if (hit) { e.waitUntil(net.catch(() => {})); return hit; }   // 폰에 있는 걸로 열고, 새 버전은 뒤에서 받아 둠
    return net.catch(async () => (await c.match(u.origin + '/')) || Response.error());
  }));
});

/* ----- 알림 ----- */
try {
  importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
                'https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');
  firebase.initializeApp({
    apiKey: 'AIzaSyDnsj9dxYrPow82Wd6kUnqVJvfACTqMWf4',
    authDomain: 'giftwav-9ab6b.firebaseapp.com',
    databaseURL: 'https://giftwav-9ab6b-default-rtdb.asia-southeast1.firebasedatabase.app',
    projectId: 'giftwav-9ab6b',
    storageBucket: 'giftwav-9ab6b.firebasestorage.app',
    messagingSenderId: '790729206880',
    appId: '1:790729206880:web:173a3a34e29e49a0b0a705'
  });
  firebase.messaging().onBackgroundMessage(p => {
    if (p.notification) return;   // 알림 내용이 있으면 저절로 떠요
    const d = p.data || {};
    return self.registration.showNotification(d.title || '빨간 우체통', {
      body: d.body || '새 메시지가 왔어요', icon: 'icon-192.png', tag: d.room ? 'rp-' + d.room : 'rp', renotify: true, data: d
    });
  });
} catch (e) {}

/* 알림을 누르면 그 방으로 */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const d = e.notification.data || {}, f = d.FCM_MSG || {};
  const url = d.url || d.link || (f.fcmOptions && f.fcmOptions.link) || (f.data && f.data.url) || './';
  let rm = d.room || (f.data && f.data.room) || null;
  try { rm = rm || new URL(url, location.origin).searchParams.get('room'); } catch (x) {}
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const w = list.find(x => new URL(x.url).origin === location.origin);
    if (w) { if (rm) w.postMessage({ room: rm }); return w.focus(); }
    return self.clients.openWindow(url);
  }));
});
