/* 빨간 우체통 알림·설치 도우미 (43번: 새 버전 43번으로 바꾸기)
   (42번: 알림 두 번 - 첫 번째는 조용히 폰 깨우기, 두 번째가 같은 자리를 덮어쓰며 소리 · 받는 사람에겐 알림 하나)
   (41번: 첫 알림부터 소리 - 화면을 막 끈 뒤에도 '보고 있다'로 착각하지 않게 앱에 직접 물어봐요)
   (40번: 새 버전 40번으로 바꾸기)
   (36번: 앱을 보고 있어도 알림은 조용히 띄워서 폰이 우리 알림을 낮춰 보지 않게)
   (34번: 알림마다 이름표를 달리 해서 매번 소리가 나요)
   - 화면이 꺼져 있어도 서버가 보낸 알림을 띄워요
   - 알림이 온 방이 목록에 없으면 앱이 열릴 때 넣도록 적어 둬요
   - 앱 파일은 폰에 저장해 두고, 열 때마다 몰래 새 버전을 받아 다음에 바뀌어요 */
const APP_CACHE = 'rp-app-43';
const INBOX = 'rp-inbox';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(k => k.startsWith('rp-app') && k !== APP_CACHE).map(k => caches.delete(k)));
  await self.clients.claim();
})()));

/* 앱 파일: 저장된 걸 먼저 보여 주고, 뒤에서 새 버전을 받아 둬요 */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const isPage = req.mode === 'navigate';
  if (!isPage && !/\.(html|json|png|webmanifest)$/.test(url.pathname)) return;
  const key = isPage ? new Request(url.origin + url.pathname) : req;
  e.respondWith((async () => {
    const c = await caches.open(APP_CACHE);
    const old = await c.match(key, { ignoreSearch: true });
    const fresh = fetch(req, { cache: 'no-cache' }).then(r => { if (r && r.ok) c.put(key, r.clone()); return r; });
    if (old) { e.waitUntil(fresh.catch(() => {})); return old; }
    return fresh;
  })());
});

/* 알림이 온 방 적어 두기 (앱이 열리면 목록에 넣어요) */
async function noteInbox(room, name, at){
  try {
    const c = await caches.open(INBOX), r = await c.match('/rp-inbox');
    const list = r ? await r.json() : [];
    if (!list.some(x => x.room === room)) list.push({ room, name, at });
    await c.put('/rp-inbox', new Response(JSON.stringify(list.slice(-50)), { headers: { 'Content-Type': 'application/json' } }));
  } catch (e) {}
}

self.addEventListener('push', e => {
  let p = {};
  try { p = e.data ? e.data.json() : {}; } catch (x) {}
  const d = p.data || {}, n = p.notification || {};
  const room = d.room || '', title = d.title || n.title || '빨간 우체통', body = d.body || n.body || '새 메시지가 왔어요';
  const wake = d.stage === 'wake';   // 42번: 첫 번째(깨우기)는 항상 소리 없이
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (!wake) {
      if (room) await noteInbox(room, d.name || title, +d.at || Date.now());
      wins.forEach(w => w.postMessage({ inbox: 1 }));
    }
    const looking = wake ? true : await reallyLooking(wins);   // 41번: 앱에 직접 물어봐서 진짜 보고 있을 때만 조용히
    await self.registration.showNotification(title, {
      body, tag: 'rp-' + room + '-' + (d.at || Date.now()), renotify: !looking, silent: looking, icon: 'icon-192.png', badge: 'icon-192.png',
      vibrate: [120, 60, 120], requireInteraction: false,
      data: { room, name: d.name || title, url: d.url || '' }
    });
  })());
});

/* 41번: 앱에 "지금 진짜 보고 있어요?" 물어보기 · 0.4초 안에 대답 없으면(화면 꺼짐) 소리 나게 */
function reallyLooking(wins){
  const vis = wins.filter(w => w.visibilityState === 'visible' && w.focused);
  if (!vis.length) return Promise.resolve(false);
  return Promise.race([
    Promise.all(vis.map(w => new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = e => res(!!(e.data && e.data.looking)); w.postMessage({ ask: 1 }, [ch.port2]); }))).then(a => a.some(Boolean)),
    new Promise(res => setTimeout(() => res(false), 400))
  ]);
}

/* 알림을 누르면 그 대화방으로 */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const { room, name, url } = e.notification.data || {};
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const w = wins.find(x => x.url.startsWith(self.registration.scope));
    if (w) { await w.focus(); if (room) w.postMessage({ room, name }); return; }
    const base = url || self.registration.scope;
    await self.clients.openWindow(room ? base + '?room=' + encodeURIComponent(room) : base);
  })());
});
