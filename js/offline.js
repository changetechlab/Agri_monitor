/**
 * Agri Monitor — js/offline.js
 * IndexedDB-based offline queue for rural low-connectivity support
 * Stores pending operations and syncs when connection is restored
 */

window.AgriOffline = (() => {
  const DB_NAME = (window.AgriConfig || {}).IDB_NAME || 'agri_monitor_offline';
  const DB_VERSION = 1;
  let db = null;
  let pendingCount = 0;

  // ============================================================
  // IndexedDB Init
  // ============================================================
  async function init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const idb = event.target.result;

        // Pending operations queue
        if (!idb.objectStoreNames.contains('pending_ops')) {
          const ops = idb.createObjectStore('pending_ops', { keyPath: 'id', autoIncrement: true });
          ops.createIndex('type', 'type', { unique: false });
          ops.createIndex('created_at', 'created_at', { unique: false });
        }

        // Cached farmer data for offline viewing
        if (!idb.objectStoreNames.contains('farmers_cache')) {
          idb.createObjectStore('farmers_cache', { keyPath: 'id' });
        }

        // Cached fields data
        if (!idb.objectStoreNames.contains('fields_cache')) {
          idb.createObjectStore('fields_cache', { keyPath: 'id' });
        }

        // Cached alerts
        if (!idb.objectStoreNames.contains('alerts_cache')) {
          idb.createObjectStore('alerts_cache', { keyPath: 'id' });
        }

        // Pending image uploads (store as blob)
        if (!idb.objectStoreNames.contains('pending_images')) {
          const imgs = idb.createObjectStore('pending_images', { keyPath: 'id', autoIncrement: true });
          imgs.createIndex('field_id', 'field_id', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        db = event.target.result;
        console.log('[Offline] IndexedDB initialized');
        resolve(db);
      };

      request.onerror = (event) => {
        console.error('[Offline] IndexedDB error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  // ============================================================
  // Queue an operation for later sync
  // ============================================================
  async function queueOperation(type, table, data) {
    if (!db) await init();

    return new Promise((resolve, reject) => {
      const tx = db.transaction('pending_ops', 'readwrite');
      const store = tx.objectStore('pending_ops');
      const op = {
        type,          // 'insert' | 'update' | 'delete'
        table,         // 'farmers' | 'fields' | 'field_images' | etc.
        data,
        created_at: new Date().toISOString(),
        retry_count: 0
      };
      const req = store.add(op);
      req.onsuccess = () => {
        pendingCount++;
        updatePendingBadge();
        resolve(req.result);
      };
      req.onerror = () => reject(req.error);
    });
  }

  // ============================================================
  // Queue an image upload (stored as Blob)
  // ============================================================
  async function queueImageUpload(imageBlob, metadata) {
    if (!db) await init();

    return new Promise((resolve, reject) => {
      const tx = db.transaction('pending_images', 'readwrite');
      const store = tx.objectStore('pending_images');
      const req = store.add({
        blob: imageBlob,
        field_id: metadata.field_id,
        farmer_id: metadata.farmer_id,
        lat: metadata.lat,
        lng: metadata.lng,
        issue_type: metadata.issue_type,
        caption: metadata.caption,
        taken_at: metadata.taken_at || new Date().toISOString(),
        created_at: new Date().toISOString()
      });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // ============================================================
  // Get all pending operations
  // ============================================================
  async function getPendingOps() {
    if (!db) await init();

    return new Promise((resolve, reject) => {
      const tx = db.transaction('pending_ops', 'readonly');
      const store = tx.objectStore('pending_ops');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // ============================================================
  // Get all pending images
  // ============================================================
  async function getPendingImages() {
    if (!db) await init();

    return new Promise((resolve, reject) => {
      const tx = db.transaction('pending_images', 'readonly');
      const store = tx.objectStore('pending_images');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // ============================================================
  // Remove a synced operation
  // ============================================================
  async function removePendingOp(id) {
    if (!db) await init();

    return new Promise((resolve, reject) => {
      const tx = db.transaction('pending_ops', 'readwrite');
      const store = tx.objectStore('pending_ops');
      const req = store.delete(id);
      req.onsuccess = () => {
        pendingCount = Math.max(0, pendingCount - 1);
        updatePendingBadge();
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  // ============================================================
  // Cache data for offline viewing
  // ============================================================
  async function cacheData(storeName, records) {
    if (!db) await init();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);

      // Clear existing and repopulate
      store.clear();
      records.forEach(record => store.put(record));

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ============================================================
  // Get cached data
  // ============================================================
  async function getCachedData(storeName) {
    if (!db) await init();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // ============================================================
  // Sync all pending operations to Supabase
  // ============================================================
  async function syncAll() {
    if (!navigator.onLine) {
      console.log('[Offline] No network — sync deferred');
      return { synced: 0, failed: 0 };
    }

    if (!window.AgriDB) {
      console.log('[Offline] Supabase not initialized');
      return { synced: 0, failed: 0 };
    }

    const ops = await getPendingOps();
    let synced = 0;
    let failed = 0;

    for (const op of ops) {
      try {
        if (op.type === 'insert') {
          const { error } = await window.AgriDB.from(op.table).insert(op.data);
          if (error) throw error;
        } else if (op.type === 'update') {
          const { error } = await window.AgriDB.from(op.table).update(op.data).eq('id', op.data.id);
          if (error) throw error;
        } else if (op.type === 'delete') {
          const { error } = await window.AgriDB.from(op.table).delete().eq('id', op.data.id);
          if (error) throw error;
        }
        await removePendingOp(op.id);
        synced++;
      } catch (err) {
        console.error('[Offline] Sync failed for op:', op.id, err);
        // Increment retry count — remove after 5 failures
        if (op.retry_count >= 5) {
          await removePendingOp(op.id);
          console.warn('[Offline] Dropped operation after 5 retries:', op);
        } else {
          // Update retry count
          const tx = db.transaction('pending_ops', 'readwrite');
          const store = tx.objectStore('pending_ops');
          store.put({ ...op, retry_count: (op.retry_count || 0) + 1 });
        }
        failed++;
      }
    }

    // Sync pending images
    const images = await getPendingImages();
    for (const img of images) {
      try {
        const path = `fields/${img.field_id || 'unknown'}/${Date.now()}.jpg`;
        const { error: uploadError } = await window.AgriDB.storage
          .from('field-images')
          .upload(path, img.blob, { contentType: 'image/jpeg', upsert: false });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = window.AgriDB.storage
          .from('field-images')
          .getPublicUrl(path);

        await window.AgriDB.from('field_images').insert({
          field_id: img.field_id,
          farmer_id: img.farmer_id,
          storage_path: path,
          public_url: publicUrl,
          lat: img.lat, lng: img.lng,
          issue_type: img.issue_type,
          caption: img.caption,
          taken_at: img.taken_at
        });

        // Remove synced image from IDB
        const tx = db.transaction('pending_images', 'readwrite');
        tx.objectStore('pending_images').delete(img.id);
        synced++;
      } catch (err) {
        console.error('[Offline] Image sync failed:', err);
        failed++;
      }
    }

    if (synced > 0) {
      showSyncNotification(synced);
    }

    console.log(`[Offline] Sync complete — ${synced} synced, ${failed} failed`);
    return { synced, failed };
  }

  // ============================================================
  // UI Helpers
  // ============================================================
  function updatePendingBadge() {
    const badge = document.getElementById('sync-pending');
    if (!badge) return;
    if (pendingCount > 0) {
      badge.textContent = pendingCount;
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  }

  function showSyncNotification(count) {
    const notif = document.createElement('div');
    notif.className = 'sync-toast';
    notif.innerHTML = `✅ ${count} रिकॉर्ड सिंक हुए`;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 3000);
  }

  async function refreshPendingCount() {
    const ops = await getPendingOps();
    const imgs = await getPendingImages();
    pendingCount = ops.length + imgs.length;
    updatePendingBadge();
  }

  // ============================================================
  // Network status monitoring
  // ============================================================
  function initNetworkWatcher() {
    const indicator = document.getElementById('offline-indicator');

    function updateStatus() {
      if (indicator) {
        indicator.textContent = navigator.onLine ? '🟢 ऑनलाइन' : '🔴 ऑफलाइन';
        indicator.className = navigator.onLine ? 'online-status online' : 'online-status offline';
      }
      if (navigator.onLine) {
        syncAll();
        // Register background sync via service worker
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
          navigator.serviceWorker.ready.then(reg => {
            reg.sync.register('sync-farmers').catch(() => {});
            reg.sync.register('sync-observations').catch(() => {});
            reg.sync.register('sync-images').catch(() => {});
          });
        }
      }
    }

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    updateStatus();
  }

  // ============================================================
  // Message from Service Worker
  // ============================================================
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      const { type } = event.data;
      if (type === 'SYNC_FARMERS' || type === 'SYNC_OBSERVATIONS' || type === 'SYNC_IMAGES') {
        syncAll();
      }
    });
  }

  return {
    init,
    queueOperation,
    queueImageUpload,
    getPendingOps,
    getPendingImages,
    removePendingOp,
    cacheData,
    getCachedData,
    syncAll,
    refreshPendingCount,
    initNetworkWatcher
  };
})();
