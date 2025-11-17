/**
 * Storage Batching Utility
 * Batches chrome.storage operations to reduce I/O overhead
 */

(function() {
  'use strict';

  const Constants = window.Constants || {};
  const BATCH = Constants.BATCH || { STORAGE_WRITE_DEBOUNCE: 100 };

  // Pending storage operations
  const pendingSync = {};
  const pendingLocal = {};
  let syncTimeout = null;
  let localTimeout = null;

  /**
   * Batch set operation for chrome.storage.sync
   * @param {Object} items - Items to store
   * @param {Function} [callback] - Optional callback
   */
  function batchSetSync(items, callback) {
    Object.assign(pendingSync, items);
    
    if (syncTimeout) {
      clearTimeout(syncTimeout);
    }
    
    syncTimeout = setTimeout(() => {
      const toStore = { ...pendingSync };
      pendingSync = {};
      syncTimeout = null;
      
      chrome.storage.sync.set(toStore, callback || (() => {}));
    }, BATCH.STORAGE_WRITE_DEBOUNCE || 100);
  }

  /**
   * Batch set operation for chrome.storage.local
   * @param {Object} items - Items to store
   * @param {Function} [callback] - Optional callback
   */
  function batchSetLocal(items, callback) {
    Object.assign(pendingLocal, items);
    
    if (localTimeout) {
      clearTimeout(localTimeout);
    }
    
    localTimeout = setTimeout(() => {
      const toStore = { ...pendingLocal };
      pendingLocal = {};
      localTimeout = null;
      
      chrome.storage.local.set(toStore, callback || (() => {}));
    }, BATCH.STORAGE_WRITE_DEBOUNCE || 100);
  }

  /**
   * Batch get operation (no batching needed, but provides consistent API)
   * @param {string|string[]|Object} keys - Keys to retrieve
   * @param {Function} callback - Callback function
   */
  function batchGetSync(keys, callback) {
    chrome.storage.sync.get(keys, callback);
  }

  /**
   * Batch get operation for local storage
   * @param {string|string[]|Object} keys - Keys to retrieve
   * @param {Function} callback - Callback function
   */
  function batchGetLocal(keys, callback) {
    chrome.storage.local.get(keys, callback);
  }

  /**
   * Flush all pending operations immediately
   */
  function flush() {
    if (syncTimeout) {
      clearTimeout(syncTimeout);
      syncTimeout = null;
      if (Object.keys(pendingSync).length > 0) {
        chrome.storage.sync.set({ ...pendingSync }, () => {});
        Object.keys(pendingSync).forEach(key => delete pendingSync[key]);
      }
    }
    
    if (localTimeout) {
      clearTimeout(localTimeout);
      localTimeout = null;
      if (Object.keys(pendingLocal).length > 0) {
        chrome.storage.local.set({ ...pendingLocal }, () => {});
        Object.keys(pendingLocal).forEach(key => delete pendingLocal[key]);
      }
    }
  }

  // Export for use in other modules
  if (typeof window !== 'undefined') {
    window.StorageBatch = {
      setSync: batchSetSync,
      setLocal: batchSetLocal,
      getSync: batchGetSync,
      getLocal: batchGetLocal,
      flush
    };
  }
})();

