const CACHE_VERSION = '2';
const CACHE_NAME = `seguros-v${CACHE_VERSION}`;
const ASSETS_CACHE = `seguros-assets-v${CACHE_VERSION}`;

// Recursos del shell de la app para cachear
const APP_SHELL = [
  '/',
  '/index.html',
];

// Instalar: cachear el shell de la app
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activar: limpiar caches antiguas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== ASSETS_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: estrategia network-first para API, cache-first para assets estáticos
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Ignorar esquemas no soportados (chrome-extension, etc.)
  if (!request.url.startsWith('http')) return;

  const url = new URL(request.url);

  // Las peticiones a la API siempre van a la red
  if (url.pathname.startsWith('/api')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: 'Sin conexión' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 503,
        })
      )
    );
    return;
  }

  // Para navegación (HTML), red primero, caché como fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/index.html')
      )
    );
    return;
  }

  // Para assets estáticos: caché primero, red como fallback
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(ASSETS_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
