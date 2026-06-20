/**
 * Agri Monitor — Service Worker
 * Offline-first PWA for mountain farming regions
 * Handles asset caching, background sync, and API caching
 */

const CACHE_VERSION = 'agri-monitor-v1.1.1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DATA_CACHE = `${CACHE_VERSION}-data`;

// Assets to cache on install (app shell)
const STATIC_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/map.js',
  './js/layers.js',
  './js/ndvi.js',
  './js/farmers.js',
  './js/alerts.js',
  './js/clf.js',
  './js/auth.js',
  './js/upload.js',
  './js/charts.js',
  './js/offline.js',
  './js/report.js',
  './js/dummyData.js',
  './js/config.js',
  './manifest.json',
  // Local Vendor Assets
  './js/vendor/leaflet.min.css',
  './js/vendor/leaflet.min.js',
  './js/vendor/leaflet.draw.min.css',
  './js/vendor/leaflet.draw.min.js',
  './js/vendor/MarkerCluster.min.css',
  './js/vendor/MarkerCluster.Default.min.css',
  './js/vendor/leaflet.markercluster.min.js',
  './js/vendor/chart.min.js',
  './js/vendor/supabase-js.min.js',
  './js/vendor/jspdf.umd.min.js',
  './public/fonts/noto-sans-devanagari.woff2',
  './carbon_calculator.html',
  './climate-activities.html',
  './css/carbon-calc.css',
  './css/climate.css',
  './js/modules/carbon-calc.js',
  './js/modules/climate.js'
];

// Tile hosts — use cache-then-network for map tiles
const TILE_HOSTS = [
  'tile.openstreetmap.org',
  'a.tile.openstreetmap.org',
  'b.tile.openstreetmap.org',
  'c.tile.openstreetmap.org',
  'tiles.maps.eox.at',
  'opentopomap.org'
];

// ============================================================
// INSTALL — Cache static assets
// ============================================================
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Agri Monitor service worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static assets');
      // Cache what we can, ignore failures (CDN might be slow)
      return Promise.allSettled(
        STATIC_ASSETS.map(url =>
          cache.add(url).catch(err => console.warn('[SW] Could not cache:', url, err.message))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ============================================================
// ACTIVATE — Clean old caches
// ============================================================
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter(name => name.startsWith('agri-monitor-') && name !== STATIC_CACHE && name !== DATA_CACHE)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ============================================================
// FETCH — Strategy: Cache-first for static, network-first for API
// ============================================================
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip Supabase API calls (always need fresh data)
  if (url.hostname.includes('supabase.co')) return;

  // Map tiles — cache with stale-while-revalidate
  if (TILE_HOSTS.some(host => url.hostname.includes(host))) {
    event.respondWith(tileStrategy(event.request));
    return;
  }

  // Static assets — cache-first
  event.respondWith(staticStrategy(event.request));
});

const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Cache-first strategy for static assets
 * Falls back to network, then offline fallback
 */
async function staticStrategy(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  
  if (cached) {
    // Check age
    const cacheTime = cached.headers.get('sw-fetch-time');
    if (cacheTime && Date.now() - parseInt(cacheTime) < CACHE_MAX_AGE) {
      return cached;
    }
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const respCopy = response.clone();
      const respHeaders = new Headers(respCopy.headers);
      respHeaders.set('sw-fetch-time', Date.now().toString());
      const respWithTime = new Response(respCopy.body, {
        status: respCopy.status,
        statusText: respCopy.statusText,
        headers: respHeaders,
      });
      cache.put(request, respWithTime);
    }
    return response;
  } catch (err) {
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const offlinePage = await caches.match('./index.html');
      return offlinePage || new Response('Offline — Agri Monitor', { status: 503 });
    }
    throw err;
  }
}

/**
 * Stale-while-revalidate strategy for map tiles
 * Returns cached tile immediately, updates cache in background
 */
async function tileStrategy(request) {
  const cache = await caches.open(DATA_CACHE);
  const cachedTile = await cache.match(request);

  // Fetch new tile in background regardless
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => null);

  return cachedTile || fetchPromise;
}

// ============================================================
// BACKGROUND SYNC — Sync pending offline data when online
// ============================================================
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);

  if (event.tag === 'sync-farmers') {
    event.waitUntil(syncFarmers());
  }
  if (event.tag === 'sync-observations') {
    event.waitUntil(syncObservations());
  }
  if (event.tag === 'sync-images') {
    event.waitUntil(syncImages());
  }
});

async function syncFarmers() {
  // Notify app to sync pending farmer records
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'SYNC_FARMERS' });
  });
}

async function syncObservations() {
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'SYNC_OBSERVATIONS' });
  });
}

async function syncImages() {
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'SYNC_IMAGES' });
  });
}

// ============================================================
// PUSH NOTIFICATIONS (future: server sends alerts)
// ============================================================
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();

  const options = {
    body: data.body || data.body_hindi || 'नई अलर्ट मिली',
    icon: './icons/icon-192.png',
    badge: './icons/icon-72.png',
    tag: data.alert_type || 'agri-alert',
    data: { url: data.url || './?tab=alerts' },
    actions: [
      { action: 'view', title: 'देखें' },
      { action: 'dismiss', title: 'बंद करें' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Agri Monitor अलर्ट', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'view' || !event.action) {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});
