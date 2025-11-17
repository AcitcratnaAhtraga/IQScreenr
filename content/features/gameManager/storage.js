/**
 * Storage Abstraction for Game Manager
 * Handles Chrome storage operations with error handling
 */

(function() {
  'use strict';

  /**
   * Check if extension context is still valid
   */
  function isExtensionContextValid() {
    // Check if chrome.storage is available (primary requirement)
    // chrome.runtime.id might not always be available in all contexts, so we check for storage first
    return chrome && chrome.storage && chrome.storage.sync;
  }

  /**
   * Get value from Chrome storage
   * @param {string|string[]|object|null} keys - Keys to get, or null for all
   * @param {string} area - Storage area ('local' or 'sync')
   * @returns {Promise<object>}
   */
  function getStorage(keys, area = 'local') {
    if (!isExtensionContextValid()) {
      return Promise.resolve({});
    }

    return new Promise((resolve) => {
      try {
        const storage = area === 'sync' ? chrome.storage.sync : chrome.storage.local;
        if (!storage) {
          resolve({});
          return;
        }
        storage.get(keys, (result) => {
          if (chrome.runtime && chrome.runtime.lastError) {
            // Extension context invalidated
            resolve({});
            return;
          }
          resolve(result || {});
        });
      } catch (error) {
        // Extension context invalidated or other error
        resolve({});
      }
    });
  }

  /**
   * Set value in Chrome storage
   * @param {object} items - Items to set
   * @param {string} area - Storage area ('local' or 'sync')
   * @returns {Promise<void>}
   */
  function setStorage(items, area = 'local') {
    if (!isExtensionContextValid()) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      try {
        const storage = area === 'sync' ? chrome.storage.sync : chrome.storage.local;
        if (!storage) {
          resolve();
          return;
        }
        storage.set(items, () => {
          if (chrome.runtime && chrome.runtime.lastError) {
            // Extension context invalidated, silently ignore
          }
          resolve();
        });
      } catch (error) {
        // Extension context invalidated or other error
        resolve();
      }
    });
  }

  /**
   * Remove keys from Chrome storage
   * @param {string|string[]} keys - Keys to remove
   * @param {string} area - Storage area ('local' or 'sync')
   * @returns {Promise<void>}
   */
  function removeStorage(keys, area = 'local') {
    if (!isExtensionContextValid()) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      try {
        const storage = area === 'sync' ? chrome.storage.sync : chrome.storage.local;
        if (!storage) {
          resolve();
          return;
        }
        storage.remove(keys, () => {
          if (chrome.runtime && chrome.runtime.lastError) {
            // Extension context invalidated, silently ignore
          }
          resolve();
        });
      } catch (error) {
        // Extension context invalidated or other error
        resolve();
      }
    });
  }

  /**
   * Send message to extension runtime
   * @param {object} message - Message to send
   * @returns {Promise<void>}
   */
  function sendMessage(message) {
    if (!isExtensionContextValid() || !chrome.runtime.sendMessage) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          // Ignore errors - popup might not be open
          if (chrome.runtime.lastError) {
            // This is expected when popup is closed, silently ignore
            resolve();
            return;
          }
          resolve();
        });
      } catch (error) {
        // Silently fail
        resolve();
      }
    });
  }

  // Export
  if (typeof window !== 'undefined') {
    window.GameManagerStorage = {
      getStorage,
      setStorage,
      removeStorage,
      sendMessage,
      isExtensionContextValid
    };
  }
})();
