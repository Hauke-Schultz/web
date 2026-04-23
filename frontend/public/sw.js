const CACHE = 'hawk-games-v1'

// Assets to pre-cache on install
const PRECACHE = [
  '/games',
  '/games/hawkFruit',
  '/games/hawkDoubleUp',
  '/games/hawkTower',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
]

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
      caches.open(CACHE).then((cache) => cache.addAll(PRECACHE).catch(() => {}))
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
      caches.keys().then((keys) =>
          Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle same-origin GET requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  // Skip API calls — always go to network
  if (url.pathname.startsWith('/api')) return

  // Skip Nuxt/Vite internal assets — Vite handles caching via content hashes
  if (url.pathname.startsWith('/_nuxt/')) return

  // Network-first for HTML navigation (always fresh page, fall back to cache)
  if (request.mode === 'navigate') {
    event.respondWith(
        fetch(request)
            .then((res) => {
              const clone = res.clone()
              caches.open(CACHE).then((c) => c.put(request, clone))
              return res
            })
            .catch(() => caches.match(request))
    )
    return
  }

  // Cache-first for static assets (JS, CSS, images, fonts)
  event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((res) => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE).then((c) => c.put(request, clone))
          }
          return res
        })
      })
  )
})
