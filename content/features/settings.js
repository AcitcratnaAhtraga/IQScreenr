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
  useConfidenceForColor: true, // Always enabled - badge colors always reflect confidence
  enableDebugLogging: true,
  enableIQGuessr: false
};

const settings = { ...defaultSettings };

/**
 * Load settings from storage
 */
function loadSettings() {
  chrome.storage.sync.get(['showIQBadge', 'showRealtimeBadge', 'minIQ', 'maxIQ', 'useConfidenceForColor', 'enableDebugLogging', 'enableIQGuessr', 'showProfileScoreBadge'], (result) => {
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
    // useConfidenceForColor is always true - always use confidence for color
    settings.useConfidenceForColor = true;
    // Ensure it's set in storage
    chrome.storage.sync.set({ useConfidenceForColor: true });
    if (result.enableDebugLogging !== undefined) {
      settings.enableDebugLogging = result.enableDebugLogging;
    }
    if (result.enableIQGuessr !== undefined) {
      settings.enableIQGuessr = result.enableIQGuessr;
    }
    if (result.showProfileScoreBadge !== undefined) {
      settings.showProfileScoreBadge = result.showProfileScoreBadge;
    }
  });
}

/**
 * Listen for settings changes
 */
function setupSettingsListener(onChange) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync') {
      const relevantChanges = {};

      if (changes.showIQBadge) {
        settings.showIQBadge = changes.showIQBadge.newValue;
        relevantChanges.showIQBadge = changes.showIQBadge;
      }
      if (changes.showRealtimeBadge) {
        settings.showRealtimeBadge = changes.showRealtimeBadge.newValue;
        relevantChanges.showRealtimeBadge = changes.showRealtimeBadge;
      }
      if (changes.minIQ) {
        settings.minIQ = changes.minIQ.newValue;
        relevantChanges.minIQ = changes.minIQ;
      }
      if (changes.maxIQ) {
        settings.maxIQ = changes.maxIQ.newValue;
        relevantChanges.maxIQ = changes.maxIQ;
      }
      if (changes.useConfidenceForColor) {
        settings.useConfidenceForColor = changes.useConfidenceForColor.newValue;
        relevantChanges.useConfidenceForColor = changes.useConfidenceForColor;
      }
      if (changes.enableDebugLogging) {
        settings.enableDebugLogging = changes.enableDebugLogging.newValue;
        relevantChanges.enableDebugLogging = changes.enableDebugLogging;
      }
      if (changes.enableIQGuessr) {
        settings.enableIQGuessr = changes.enableIQGuessr.newValue;
        relevantChanges.enableIQGuessr = changes.enableIQGuessr;
      }
      if (changes.showProfileScoreBadge) {
        settings.showProfileScoreBadge = changes.showProfileScoreBadge.newValue;
        relevantChanges.showProfileScoreBadge = changes.showProfileScoreBadge;
      }

      if (onChange && Object.keys(relevantChanges).length > 0) {
        onChange(relevantChanges);
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
    get enableDebugLogging() { return settings.enableDebugLogging; },
    get enableIQGuessr() { return settings.enableIQGuessr; },
    get showProfileScoreBadge() { return settings.showProfileScoreBadge !== false; },
    loadSettings,
    setupSettingsListener,
    // Also export the raw settings object for modules that need it
    get settings() { return settings; }
  };
  window.IQSettings = window.Settings; // Legacy alias
}

})();

