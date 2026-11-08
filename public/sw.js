/**
 * CipherVault Service Worker - Offline & Standalone PWA Support
 */

const CACHE_NAME = 'ciphervault-pwa-v2';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('ciphervault-') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  // External APIs, particularly breach checks, must never use stale cached results.
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || event.request.cache === 'no-store') return;
  if (event.request.mode !== 'navigate' && !/\.(js|css|png|svg|ico|woff2?|json)$/.test(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    let response;
    try { response = await fetch(event.request); }
    catch (error) {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      throw error;
    }
    if (response.ok) {
      try { await cache.put(event.request, response.clone()); } catch { /* Cache quota must not hide a valid network response. */ }
    }
    return response;
  })());
});

