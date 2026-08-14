/**
 * Offline Storage Manager
 * Uses IndexedDB for local data persistence
 */

const OfflineStorage = {
    dbName: 'AgroEcomDB',
    dbVersion: 1,
    db: null,

    /**
     * Initialize the database
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('Failed to open IndexedDB:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('IndexedDB initialized');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create object stores
                const storeNames = ['farmers', 'records', 'cache', 'syncQueue'];
                storeNames.forEach((storeName) => {
                    if (!db.objectStoreNames.contains(storeName)) {
                        if (storeName === 'syncQueue') {
                            db.createObjectStore(storeName, { autoIncrement: true });
                        } else {
                            db.createObjectStore(storeName, { keyPath: 'id' });
                        }
                        console.log(`Created store: ${storeName}`);
                    }
                });
            };
        });
    },

    /**
     * Save farmers to local storage
     */
    async saveFarmers(farmers) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('farmers', 'readwrite');
            const store = tx.objectStore('farmers');

            // Clear existing data
            store.clear();

            // Add all farmers
            farmers.forEach((farmer) => {
                store.add(farmer);
            });

            tx.oncomplete = () => {
                console.log('Farmers saved to IndexedDB:', farmers.length);
                resolve();
            };

            tx.onerror = () => reject(tx.error);
        });
    },

    /**
     * Get all farmers from local storage
     */
    async getFarmers() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('farmers', 'readonly');
            const store = tx.objectStore('farmers');
            const request = store.getAll();

            request.onsuccess = () => {
                console.log('Retrieved farmers from IndexedDB:', request.result.length);
                resolve(request.result);
            };

            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Save records to local storage
     */
    async saveRecords(records) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('records', 'readwrite');
            const store = tx.objectStore('records');

            store.clear();
            records.forEach((record) => {
                store.add(record);
            });

            tx.oncomplete = () => {
                console.log('Records saved to IndexedDB:', records.length);
                resolve();
            };

            tx.onerror = () => reject(tx.error);
        });
    },

    /**
     * Get all records from local storage
     */
    async getRecords() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('records', 'readonly');
            const store = tx.objectStore('records');
            const request = store.getAll();

            request.onsuccess = () => {
                console.log('Retrieved records from IndexedDB:', request.result.length);
                resolve(request.result);
            };

            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Cache API response
     */
    async cacheData(key, data, expiryMinutes = 60) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('cache', 'readwrite');
            const store = tx.objectStore('cache');

            const cacheEntry = {
                id: key,
                data: data,
                timestamp: Date.now(),
                expiry: Date.now() + expiryMinutes * 60 * 1000
            };

            const request = store.put(cacheEntry);

            request.onsuccess = () => {
                console.log('Data cached:', key);
                resolve();
            };

            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Get cached data
     */
    async getCachedData(key) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('cache', 'readonly');
            const store = tx.objectStore('cache');
            const request = store.get(key);

            request.onsuccess = () => {
                const entry = request.result;
                if (entry && entry.expiry > Date.now()) {
                    console.log('Cache hit:', key);
                    resolve(entry.data);
                } else {
                    console.log('Cache miss or expired:', key);
                    resolve(null);
                }
            };

            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Queue a request for sync
     */
    async queueRequest(request) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('syncQueue', 'readwrite');
            const store = tx.objectStore('syncQueue');

            const queueEntry = {
                url: request.url,
                method: request.method,
                headers: Object.fromEntries(request.headers),
                body: request.body,
                timestamp: Date.now(),
                retries: 0
            };

            const dbRequest = store.add(queueEntry);

            dbRequest.onsuccess = () => {
                console.log('Request queued for sync:', request.url);
                resolve(dbRequest.result);
            };

            dbRequest.onerror = () => reject(dbRequest.error);
        });
    },

    /**
     * Get all queued requests
     */
    async getQueuedRequests() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('syncQueue', 'readonly');
            const store = tx.objectStore('syncQueue');
            const request = store.getAll();

            request.onsuccess = () => {
                console.log('Queued requests:', request.result.length);
                resolve(request.result);
            };

            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Remove request from queue
     */
    async removeQueuedRequest(key) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('syncQueue', 'readwrite');
            const store = tx.objectStore('syncQueue');
            const request = store.delete(key);

            request.onsuccess = () => {
                console.log('Removed from queue:', key);
                resolve();
            };

            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Get queue size
     */
    async getQueueSize() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction('syncQueue', 'readonly');
            const store = tx.objectStore('syncQueue');
            const request = store.count();

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Clear all data (factory reset)
     */
    async clearAll() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const stores = ['farmers', 'records', 'cache', 'syncQueue'];
            const tx = this.db.transaction(stores, 'readwrite');

            let cleared = 0;
            stores.forEach((storeName) => {
                const store = tx.objectStore(storeName);
                const request = store.clear();

                request.onsuccess = () => {
                    cleared++;
                    if (cleared === stores.length) {
                        console.log('All data cleared from IndexedDB');
                        resolve();
                    }
                };
            });

            tx.onerror = () => reject(tx.error);
        });
    },

    /**
     * Get database size info
     */
    async getStorageInfo() {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            const estimate = await navigator.storage.estimate();
            return {
                usage: estimate.usage,
                quota: estimate.quota,
                percentage: ((estimate.usage / estimate.quota) * 100).toFixed(2)
            };
        }
        return null;
    }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OfflineStorage;
}
