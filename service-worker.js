/**
 * Service Worker for AgroEcom Offline Support
 * Handles caching, offline detection, and background sync
 */

const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `agro-ecom-${CACHE_VERSION}`;
const RUNTIME_CACHE = 'agro-ecom-runtime';

// Files to cache on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/mobile.html',
    '/launcher.html',
    '/app.js',
    '/style.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching static assets');
            return cache.addAll(STATIC_ASSETS).catch((err) => {
                console.warn('[Service Worker] Some assets failed to cache:', err);
                // Continue even if some assets fail
                return Promise.resolve();
            });
        })
    );
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip API calls - handle separately
    if (url.pathname.includes('/api/')) {
        event.respondWith(handleApiRequest(request));
        return;
    }

    // For HTML, CSS, JS - cache first
    event.respondWith(
        caches.match(request).then((response) => {
            if (response) {
                return response;
            }

            return fetch(request).then((response) => {
                // Don't cache non-successful responses
                if (!response || response.status !== 200 || response.type === 'error') {
                    return response;
                }

                // Clone and cache successful responses
                const responseToCache = response.clone();
                caches.open(RUNTIME_CACHE).then((cache) => {
                    cache.put(request, responseToCache);
                });

                return response;
            }).catch(() => {
                // Offline fallback
                return caches.match(request).then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    // Return offline page if available
                    return caches.match('/index.html');
                });
            });
        })
    );
});

/**
 * Handle API requests with offline support
 * Cache successful responses, queue failed requests
 */
function handleApiRequest(request) {
    // Only cache read operations (GET)
    if (request.method === 'GET') {
        return fetch(request)
            .then((response) => {
                if (response.ok) {
                    // Cache successful API responses
                    const responseToCache = response.clone();
                    caches.open(RUNTIME_CACHE).then((cache) => {
                        cache.put(request, responseToCache);
                    });
                }
                return response;
            })
            .catch(() => {
                // Try to return cached response
                return caches.match(request).then((cachedResponse) => {
                    if (cachedResponse) {
                        console.log('[Service Worker] Returning cached API response');
                        return cachedResponse;
                    }
                    // Return offline error
                    return new Response(
                        JSON.stringify({
                            error: 'offline',
                            message: 'You are offline. Please check your connection.'
                        }),
                        {
                            status: 503,
                            statusText: 'Offline',
                            headers: { 'Content-Type': 'application/json' }
                        }
                    );
                });
            });
    } else {
        // For POST/PUT/DELETE - queue for sync when online
        return fetch(request)
            .then((response) => response)
            .catch(() => {
                console.log('[Service Worker] Queueing request for sync:', request.url);
                // Queue this request for later sync
                return queueRequestForSync(request).then(() => {
                    return new Response(
                        JSON.stringify({
                            queued: true,
                            message: 'Request queued. Will sync when online.'
                        }),
                        {
                            status: 202,
                            statusText: 'Accepted',
                            headers: { 'Content-Type': 'application/json' }
                        }
                    );
                });
            });
    }
}

/**
 * Queue requests for background sync
 */
function queueRequestForSync(request) {
    return new Promise(async (resolve) => {
        const requestData = {
            url: request.url,
            method: request.method,
            headers: Array.from(request.headers.entries()),
            body: await request.text(),
            timestamp: Date.now()
        };

        // Use IndexedDB to store the request
        const db = await openDatabase();
        const tx = db.transaction('syncQueue', 'readwrite');
        const store = tx.objectStore('syncQueue');
        store.add(requestData);

        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve(); // Resolve anyway to prevent hanging
    });
}

/**
 * Open IndexedDB database
 */
function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('AgroEcomDB', 1);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('syncQueue')) {
                db.createObjectStore('syncQueue', { autoIncrement: true });
            }
            if (!db.objectStoreNames.contains('farmers')) {
                db.createObjectStore('farmers', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('records')) {
                db.createObjectStore('records', { keyPath: 'id' });
            }
        };
    });
}

// Listen for sync event (when back online)
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-data') {
        event.waitUntil(syncPendingRequests());
    }
});

/**
 * Sync pending requests when back online
 */
async function syncPendingRequests() {
    console.log('[Service Worker] Syncing pending requests...');
    
    try {
        const db = await openDatabase();
        const tx = db.transaction('syncQueue', 'readonly');
        const store = tx.objectStore('syncQueue');
        const requests = await new Promise((resolve, reject) => {
            const result = [];
            const cursor = store.openCursor();
            cursor.onsuccess = (e) => {
                if (e.target.result) {
                    result.push(e.target.result.value);
                    e.target.result.continue();
                } else {
                    resolve(result);
                }
            };
            cursor.onerror = () => reject(cursor.error);
        });

        // Send each queued request
        for (const requestData of requests) {
            try {
                const response = await fetch(requestData.url, {
                    method: requestData.method,
                    headers: new Headers(requestData.headers),
                    body: requestData.body
                });

                if (response.ok) {
                    // Remove from queue
                    await removeFromSyncQueue(requestData.timestamp);
                    console.log('[Service Worker] Synced request:', requestData.url);
                }
            } catch (error) {
                console.error('[Service Worker] Sync failed:', error);
            }
        }

        // Notify all clients that sync is complete
        const clients = await self.clients.matchAll();
        clients.forEach((client) => {
            client.postMessage({
                type: 'SYNC_COMPLETE',
                queuedCount: requests.length
            });
        });
    } catch (error) {
        console.error('[Service Worker] Sync error:', error);
    }
}

/**
 * Remove synced request from queue
 */
async function removeFromSyncQueue(timestamp) {
    const db = await openDatabase();
    const tx = db.transaction('syncQueue', 'readwrite');
    const store = tx.objectStore('syncQueue');
    const cursor = store.openCursor();

    return new Promise((resolve) => {
        cursor.onsuccess = (e) => {
            if (e.target.result) {
                if (e.target.result.value.timestamp === timestamp) {
                    e.target.result.delete();
                }
                e.target.result.continue();
            } else {
                resolve();
            }
        };
    });
}

// Listen for messages from clients
self.addEventListener('message', (event) => {
    if (event.data.type === 'SYNC_QUEUE') {
        syncPendingRequests();
    }
});

console.log('[Service Worker] Loaded');
