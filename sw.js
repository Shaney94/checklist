// Keep property details and calendar data out of offline caches.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  if(event.request.mode !== 'navigate' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).catch(()=>new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Turnli — Offline</title><body style="font-family:system-ui;background:#f8faf9;color:#142a24;padding:24px"><h1>You’re offline</h1><p>Reconnect to check the latest cleaning dates and open your checklists.</p><button onclick="location.reload()" style="font:inherit;padding:12px 20px">Try again</button></body></html>`,{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}})));
});
