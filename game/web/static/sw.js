// 말뚝 서비스 워커 (홈 화면 앱용). 화면 주소(문서)만 다루고, 항상 서버의 최신 판을 먼저 받는다.
// 인터넷이 끊겼을 때만 마지막으로 받은 화면을 보여준다. 서버(Supabase)·광고·통계 요청은 건드리지 않는다.
const CACHE = 'malttuk-shell-v1';
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.add('/')).catch(() => {})); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.mode !== 'navigate' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(fetch(req).then((res) => {
    if (res.ok && new URL(req.url).pathname === '/') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('/', copy)); }
    return res;
  }).catch(() => caches.match(req).then((hit) => hit || caches.match('/'))));
});
