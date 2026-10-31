/* Offline support: the page and the sky data are cached so the planetarium and calendar work in the field without a network.
   Page: network first, so a new version arrives as soon as there is a connection. Everything else: served from cache, refreshed in the background.
   Bump VERSION when files are renamed or removed. */
var VERSION = 'kosmos-v2';
var CORE = [
  './',
  'index.html',
  'astronomy.browser.min.js',
  'manifest.webmanifest',
  'icon.svg',
  'sky/catalog.json',
  'sky/stars.txt',
  'sky/starcons.txt',
  'sky/milkyway.jpg'
];
/* fonts and the orbit library; forecasts (Open-Meteo, CelesTrak, NOAA) are not cached here, the page keeps them itself */
var FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function put(req, res) {
  if (res && (res.ok || res.type === 'opaque')) {
    var copy = res.clone();
    caches.open(VERSION).then(function (c) { c.put(req, copy); });
  }
  return res;
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  var same = url.origin === self.location.origin;
  if (!same && FONT_HOSTS.indexOf(url.hostname) < 0) return;

  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(function (res) { return put(req, res); }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (hit) { return hit || caches.match('index.html'); });
    }));
    return;
  }

  e.respondWith(caches.match(req).then(function (hit) {
    var net = fetch(req).then(function (res) { return put(req, res); });
    if (hit) { e.waitUntil(net.catch(function () {})); return hit; }
    return net;
  }));
});
