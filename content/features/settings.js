/**
 * Settings Management
 * Handles extension settings loading, storage, and updates
 */

(function() {
  'use strict';

const defaultSettings = {
  showIQBadge: true,
  showRealtimeBadge: true,
  minIQ: 60,
  maxIQ: 145,
  useConfidenceForColor: false
};

const settings = { ...defaultSettings };

/**
 * Load settings from storage
 */
function loadSettings() {
  chrome.storage.sync.get(['showIQBadge', 'showRealtimeBadge', 'minIQ', 'maxIQ', 'useConfidenceForColor'], (result) => {
    if (result.showIQBadge !== undefined) {
      settings.showIQBadge = result.showIQBadge;
    }
    if (result.showRealtimeBadge !== undefined) {
      settings.showRealtimeBadge = result.showRealtimeBadge;
    }
    if (result.minIQ !== undefined) {
      settings.minIQ = result.minIQ;
    }
    if (result.maxIQ !== undefined) {
      settings.maxIQ = result.maxIQ;
    }
    if (result.useConfidenceForColor !== undefined) {
      settings.useConfidenceForColor = result.useConfidenceForColor;
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
      if (changes.showRealtimeBadge) {
        settings.showRealtimeBadge = changes.showRealtimeBadge.newValue;
      }
      if (changes.minIQ) {
        settings.minIQ = changes.minIQ.newValue;
      }
      if (changes.maxIQ) {
        settings.maxIQ = changes.maxIQ.newValue;
      }
      if (changes.useConfidenceForColor) {
        settings.useConfidenceForColor = changes.useConfidenceForColor.newValue;
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
    get showRealtimeBadge() { return settings.showRealtimeBadge; },
    get minIQ() { return settings.minIQ; },
    get maxIQ() { return settings.maxIQ; },
    get useConfidenceForColor() { return settings.useConfidenceForColor; },
    loadSettings,
    setupSettingsListener,
    // Also export the raw settings object for modules that need it
    get settings() { return settings; }
  };
  window.IQSettings = window.Settings; // Legacy alias
}

})();

