// 屏幕播放器的离线缓存：页面、播放器和图片存在屏幕本地；有网时优先取新的 slides.json，没网用缓存。
const CACHE = 'jojomelon-screens-v1';
self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || !url.pathname.startsWith('/e/')) return;
  const isManifestOrPage = url.pathname.endsWith('slides.json') || url.pathname.endsWith('/') || url.pathname.endsWith('.html') || url.pathname.endsWith('.js');
  if (isManifestOrPage) {
    // 先上网取，失败用缓存
    e.respondWith(fetch(e.request).then((r) => {
      const copy = r.clone(); const key = url.origin + url.pathname;
      caches.open(CACHE).then((c) => c.put(key, copy)); return r;
    }).catch(() => caches.match(url.origin + url.pathname)));
  } else {
    // 图片：先用缓存，没有再上网取并存起来
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => {
      const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r;
    })));
  }
});
