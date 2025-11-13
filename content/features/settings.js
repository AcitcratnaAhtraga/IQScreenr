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
  enableDebugLogging: false,
  enableIQGuessr: false,
  enableIqFiltr: false,
  filterIQThreshold: 100,
  filterDirection: 'below', // 'below' or 'above'
  filterConfidenceThreshold: 50, // 0-100, default 50
  filterConfidenceDirection: 'above', // 'below' or 'above' - independent of IQ direction
  useIQInFilter: true, // Whether to use IQ threshold in filtering (default true)
  useConfidenceInFilter: false, // Whether to use confidence in filtering
  filterInvalidTweets: false, // Whether to filter tweets with IQ X (invalid/too short)
  filterUserPosts: false, // Whether to filter the user's own posts if they meet the criteria
  filterMode: 'mute' // 'remove' or 'mute' - how to handle filtered tweets
};

const settings = { ...defaultSettings };

/**
 * Load settings from storage
 */
function loadSettings() {
  chrome.storage.sync.get(['showIQBadge', 'showRealtimeBadge', 'minIQ', 'maxIQ', 'useConfidenceForColor', 'enableDebugLogging', 'enableIQGuessr', 'showProfileScoreBadge', 'showAverageIQ', 'enableIqFiltr', 'filterIQThreshold', 'filterDirection', 'filterConfidenceThreshold', 'filterConfidenceDirection', 'useIQInFilter', 'useConfidenceInFilter', 'filterInvalidTweets', 'filterUserPosts', 'filterMode'], (result) => {
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
    if (result.showAverageIQ !== undefined) {
      settings.showAverageIQ = result.showAverageIQ;
    }
    if (result.enableIqFiltr !== undefined) {
      settings.enableIqFiltr = result.enableIqFiltr;
    }
    if (result.filterIQThreshold !== undefined) {
      settings.filterIQThreshold = result.filterIQThreshold;
    }
    if (result.filterDirection !== undefined) {
      settings.filterDirection = result.filterDirection;
    }
    if (result.filterConfidenceThreshold !== undefined) {
      settings.filterConfidenceThreshold = result.filterConfidenceThreshold;
    }
    if (result.filterConfidenceDirection !== undefined) {
      settings.filterConfidenceDirection = result.filterConfidenceDirection;
    }
    if (result.useIQInFilter !== undefined) {
      settings.useIQInFilter = result.useIQInFilter;
    }
    if (result.useConfidenceInFilter !== undefined) {
      settings.useConfidenceInFilter = result.useConfidenceInFilter;
    }
    if (result.filterInvalidTweets !== undefined) {
      settings.filterInvalidTweets = result.filterInvalidTweets;
    }
    if (result.filterUserPosts !== undefined) {
      settings.filterUserPosts = result.filterUserPosts;
    }
    if (result.filterMode !== undefined) {
      settings.filterMode = result.filterMode;
    }
  });
}

/**
 * Listen for settings changes
 */
function setupSettingsListener(onChange) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync') {
      const debugLogging = settings.enableDebugLogging;
      

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
      if (changes.enableIqFiltr) {
        settings.enableIqFiltr = changes.enableIqFiltr.newValue;
        relevantChanges.enableIqFiltr = changes.enableIqFiltr;
      }
      if (changes.filterIQThreshold) {
        settings.filterIQThreshold = changes.filterIQThreshold.newValue;
        relevantChanges.filterIQThreshold = changes.filterIQThreshold;
      }
      if (changes.filterDirection) {
        settings.filterDirection = changes.filterDirection.newValue;
        relevantChanges.filterDirection = changes.filterDirection;
      }
      if (changes.filterConfidenceThreshold) {
        settings.filterConfidenceThreshold = changes.filterConfidenceThreshold.newValue;
        relevantChanges.filterConfidenceThreshold = changes.filterConfidenceThreshold;
      }
      if (changes.useIQInFilter) {
        settings.useIQInFilter = changes.useIQInFilter.newValue;
        relevantChanges.useIQInFilter = changes.useIQInFilter;
      }
      if (changes.useConfidenceInFilter) {
        settings.useConfidenceInFilter = changes.useConfidenceInFilter.newValue;
        relevantChanges.useConfidenceInFilter = changes.useConfidenceInFilter;
      }
      if (changes.filterInvalidTweets) {
        settings.filterInvalidTweets = changes.filterInvalidTweets.newValue;
        relevantChanges.filterInvalidTweets = changes.filterInvalidTweets;
      }
      if (changes.filterConfidenceDirection) {
        settings.filterConfidenceDirection = changes.filterConfidenceDirection.newValue;
        relevantChanges.filterConfidenceDirection = changes.filterConfidenceDirection;
      }
      if (changes.filterMode) {
        settings.filterMode = changes.filterMode.newValue;
        relevantChanges.filterMode = changes.filterMode;
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
    get enableIqFiltr() { return settings.enableIqFiltr; },
    get filterIQThreshold() { return settings.filterIQThreshold; },
    get filterDirection() { return settings.filterDirection; },
    get filterConfidenceThreshold() { return settings.filterConfidenceThreshold; },
    get filterConfidenceDirection() { return settings.filterConfidenceDirection; },
    get useIQInFilter() { return settings.useIQInFilter; },
    get useConfidenceInFilter() { return settings.useConfidenceInFilter; },
    get filterInvalidTweets() { return settings.filterInvalidTweets; },
    get filterUserPosts() { return settings.filterUserPosts; },
    get filterMode() { return settings.filterMode; },
    loadSettings,
    setupSettingsListener,
    // Also export the raw settings object for modules that need it
    get settings() { return settings; }
  };
  window.IQSettings = window.Settings; // Legacy alias
}

})();

