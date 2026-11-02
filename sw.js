/* PAAADEL offline cache: app shell network-first (so updates land), heavy/static files cache-first. */
const CACHE = 'paaadel-v2';
const FONTS = ['inter-latin-500-normal', 'inter-latin-600-normal', 'inter-latin-700-normal', 'inter-latin-800-normal', 'inter-latin-900-normal',
  'plus-jakarta-sans-latin-400-normal', 'plus-jakarta-sans-latin-500-normal', 'plus-jakarta-sans-latin-600-normal', 'plus-jakarta-sans-latin-700-normal', 'plus-jakarta-sans-latin-800-normal'].map(f => 'fonts/' + f + '.woff2');
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'vendor/three.min.js',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'].concat(FONTS);

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const staticFile = /\/(vendor|icons|fonts)\//.test(url.pathname);
  if (staticFile) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res;
    })));
    return;
  }
  e.respondWith(fetch(req).then(res => {
    const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res;
  }).catch(() => caches.match(req).then(hit => hit || caches.match('index.html'))));
});
