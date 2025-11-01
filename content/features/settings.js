/**
 * Settings Management
 * Handles extension settings loading, storage, and updates
 */

(function() {
  'use strict';

const defaultSettings = {
  showIQBadge: true,
  minIQ: 60,
  maxIQ: 145
};

const settings = { ...defaultSettings };

/**
 * Load settings from storage
 */
function loadSettings() {
  chrome.storage.sync.get(['showIQBadge', 'minIQ', 'maxIQ'], (result) => {
    if (result.showIQBadge !== undefined) {
      settings.showIQBadge = result.showIQBadge;
    }
    if (result.minIQ !== undefined) {
      settings.minIQ = result.minIQ;
    }
    if (result.maxIQ !== undefined) {
      settings.maxIQ = result.maxIQ;
    }
  });
}

/**
 * Listen for settings changes
 */
function setupSettingsListener(onChange) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync') {
      if (changes.showIQBadge) {
        settings.showIQBadge = changes.showIQBadge.newValue;
      }
      if (changes.minIQ) {
        settings.minIQ = changes.minIQ.newValue;
      }
      if (changes.maxIQ) {
        settings.maxIQ = changes.maxIQ.newValue;
      }

      if (onChange) {
        onChange();
      }
    }
  });
}

// Initialize settings on load
loadSettings();

// Export for use in other modules
if (typeof window !== 'undefined') {
  // Export settings object directly with getters that reflect current values
  window.Settings = {
    get showIQBadge() { return settings.showIQBadge; },
    get minIQ() { return settings.minIQ; },
    get maxIQ() { return settings.maxIQ; },
    loadSettings,
    setupSettingsListener,
    // Also export the raw settings object for modules that need it
    get settings() { return settings; }
  };
  window.IQSettings = window.Settings; // Legacy alias
}

})();

