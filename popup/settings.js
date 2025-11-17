/**
 * Popup Settings Management
 * Handles loading and saving settings
 */

(function() {
  'use strict';

  const Constants = window.Constants || {};
  const STORAGE = Constants.STORAGE || {};

  /**
   * Load all settings from storage
   */
  async function loadSettings() {
    try {
      const [syncResult, localResult] = await Promise.all([
        new Promise((resolve) => chrome.storage.sync.get(null, resolve)),
        new Promise((resolve) => chrome.storage.local.get(null, resolve))
      ]);

      return {
        ...syncResult,
        ...localResult
      };
    } catch (error) {
      const Logger = window.Logger || console;
      Logger.error('Error loading settings:', error);
      return {};
    }
  }

  /**
   * Save a setting to storage
   */
  function saveSetting(key, value, useLocal = false) {
    return new Promise((resolve, reject) => {
      const storage = useLocal ? chrome.storage.local : chrome.storage.sync;
      storage.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Save multiple settings at once
   */
  function saveSettings(settings, useLocal = false) {
    return new Promise((resolve, reject) => {
      const StorageBatch = window.StorageBatch || { setSync: chrome.storage.sync.set.bind(chrome.storage.sync), setLocal: chrome.storage.local.set.bind(chrome.storage.local) };
      const setFn = useLocal ? StorageBatch.setLocal : StorageBatch.setSync;
      
      setFn(settings, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  // Export
  if (typeof window !== 'undefined') {
    window.PopupSettings = {
      loadSettings,
      saveSetting,
      saveSettings
    };
  }
})();

