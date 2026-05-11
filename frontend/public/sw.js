const VERSION = '1778401695279'
const CACHE = `hawk-games-v${VERSION}`

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
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api')) return
  if (url.pathname.startsWith('/_nuxt/')) return

  // Network-first for HTML navigation
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

  // Stale-while-revalidate for static assets:
  // return cached version immediately, update cache in background
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request)
      const fetchPromise = fetch(request)
        .then((res) => {
          if (res.ok) cache.put(request, res.clone())
          return res
        })
        .catch(() => null)
      return cached ?? fetchPromise
    })
  )
})
