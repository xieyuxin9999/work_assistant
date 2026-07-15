/**
 * Service Worker — 离线缓存
 * 策略：网络优先（确保最新版本），离线回退缓存
 */
const CACHE_NAME = 'dashboard-v4';
const CACHE_URLS = [
  './',
  './index.html',
  './css/style.css',
  './css/components.css',
  './css/responsive.css',
  './js/store.js',
  './js/db.js',
  './js/crypto.js',
  './js/sync.js',
  './js/router.js',
  './js/app.js',
  './js/modules/dashboard.js',
  './js/modules/weather.js',
  './js/modules/checklist.js',
  './js/modules/todo.js',
  './js/modules/notes.js',
  './js/modules/meetings.js',
  './js/modules/files.js',
  './js/modules/habits.js',
  './js/modules/settings.js',
  './js/modules/trash.js',
  './lib/marked.min.js',
  './manifest.json',
];

// 安装：预缓存核心资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CACHE_URLS).catch(err => {
        console.log('Cache addAll error:', err);
      });
    })
  );
  self.skipWaiting();
});

// 激活：清理旧缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// 请求拦截：网络优先
self.addEventListener('fetch', (event) => {
  // 只处理 GET 请求
  if (event.request.method !== 'GET') return;

  // API 请求（天气、GitHub Gist 等）不走缓存
  const url = new URL(event.request.url);
  if (url.hostname.includes('open-meteo') || url.hostname.includes('geocoding-api') || url.hostname.includes('api.github.com')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request);
      })
    );
    return;
  }

  // 本地资源：网络优先（确保始终拿到最新版本），离线时回退缓存
  event.respondWith(
    fetch(event.request).then((response) => {
      // 成功获取，更新缓存
      if (response.ok && url.origin === self.location.origin) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => {
      // 离线回退到缓存
      return caches.match(event.request).then((cached) => {
        if (cached) return cached;
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
