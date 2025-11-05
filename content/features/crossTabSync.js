/**
 * Cross-Tab Synchronization
 * Prevents cheating by syncing game mode state and revealed IQs across all browser tabs/windows
 */

(function() {
  'use strict';

  const CHANNEL_NAME = 'iqguessr_cross_tab';
  let broadcastChannel = null;
  let isIQGuessrEnabled = false;
  let revealedTweets = new Set(); // Track revealed tweet IDs across all tabs

  /**
   * Initialize BroadcastChannel for cross-tab communication
   */
  function initBroadcastChannel() {
    if (typeof BroadcastChannel === 'undefined') {
      console.warn('[IQGuessr] BroadcastChannel not supported, falling back to localStorage events');
      setupLocalStorageFallback();
      return;
    }

    try {
      broadcastChannel = new BroadcastChannel(CHANNEL_NAME);

      broadcastChannel.onmessage = (event) => {
        handleCrossTabMessage(event.data);
      };

      // Load initial state from storage
      loadInitialState();
    } catch (error) {
      console.warn('[IQGuessr] Failed to create BroadcastChannel:', error);
      setupLocalStorageFallback();
    }
  }

  /**
   * Fallback to localStorage events for browsers without BroadcastChannel
   */
  function setupLocalStorageFallback() {
    // Use storage event as fallback
    window.addEventListener('storage', (event) => {
      if (event.key === 'iqguessr_cross_tab_state') {
        try {
          const data = JSON.parse(event.newValue || '{}');
          handleCrossTabMessage(data);
        } catch (error) {
          console.warn('[IQGuessr] Failed to parse cross-tab message:', error);
        }
      }
    });

    loadInitialState();
  }

  /**
   * Load initial state from storage
   */
  async function loadInitialState() {
    try {
      // Check if IQGuessr mode is enabled
      const result = await new Promise((resolve) => {
        chrome.storage.sync.get(['enableIQGuessr'], resolve);
      });
      isIQGuessrEnabled = result.enableIQGuessr === true;

      // Load revealed tweets from storage
      const revealedResult = await new Promise((resolve) => {
        chrome.storage.local.get(['iqguessr_revealed_tweets'], resolve);
      });
      if (revealedResult.iqguessr_revealed_tweets) {
        revealedTweets = new Set(revealedResult.iqguessr_revealed_tweets);
      }

      // Broadcast our current state to other tabs
      broadcastStateUpdate();
    } catch (error) {
      console.warn('[IQGuessr] Failed to load initial state:', error);
    }
  }

  /**
   * Handle messages from other tabs
   */
  function handleCrossTabMessage(data) {
    if (!data || !data.type) {
      return;
    }

    switch (data.type) {
      case 'iqguessr_mode_changed':
        // Another tab enabled/disabled IQGuessr mode
        isIQGuessrEnabled = data.enabled === true;
        notifyIQGuessrModeChange(isIQGuessrEnabled);
        break;

      case 'iq_revealed':
        // Another tab revealed an IQ score
        if (data.tweetId) {
          revealedTweets.add(data.tweetId);
          saveRevealedTweets();
          notifyIQRevealed(data.tweetId);
        }
        break;

      case 'state_sync':
        // Another tab is broadcasting its state
        if (data.enabled !== undefined) {
          isIQGuessrEnabled = data.enabled === true;
        }
        if (data.revealedTweets && Array.isArray(data.revealedTweets)) {
          data.revealedTweets.forEach(tweetId => revealedTweets.add(tweetId));
          saveRevealedTweets();
        }
        break;
    }
  }

  /**
   * Broadcast state update to other tabs
   */
  function broadcastStateUpdate() {
    const message = {
      type: 'state_sync',
      enabled: isIQGuessrEnabled,
      revealedTweets: Array.from(revealedTweets),
      timestamp: Date.now()
    };

    if (broadcastChannel) {
      broadcastChannel.postMessage(message);
    } else {
      // Fallback to localStorage
      try {
        localStorage.setItem('iqguessr_cross_tab_state', JSON.stringify(message));
        // Remove immediately to trigger storage event (storage events only fire for other tabs)
        setTimeout(() => {
          localStorage.removeItem('iqguessr_cross_tab_state');
        }, 0);
      } catch (error) {
        console.warn('[IQGuessr] Failed to broadcast via localStorage:', error);
      }
    }
  }

  /**
   * Broadcast IQGuessr mode change
   */
  function broadcastIQGuessrModeChange(enabled) {
    isIQGuessrEnabled = enabled === true;
    const message = {
      type: 'iqguessr_mode_changed',
      enabled: isIQGuessrEnabled,
      timestamp: Date.now()
    };

    if (broadcastChannel) {
      broadcastChannel.postMessage(message);
    } else {
      // Fallback to localStorage
      try {
        localStorage.setItem('iqguessr_cross_tab_state', JSON.stringify(message));
        setTimeout(() => {
          localStorage.removeItem('iqguessr_cross_tab_state');
        }, 0);
      } catch (error) {
        console.warn('[IQGuessr] Failed to broadcast mode change:', error);
      }
    }

    saveRevealedTweets(); // Save state when mode changes
    notifyIQGuessrModeChange(isIQGuessrEnabled);
  }

  /**
   * Broadcast that an IQ was revealed
   */
  function broadcastIQRevealed(tweetId) {
    if (!tweetId) {
      return;
    }

    revealedTweets.add(tweetId);
    saveRevealedTweets();

    const message = {
      type: 'iq_revealed',
      tweetId: tweetId,
      timestamp: Date.now()
    };

    if (broadcastChannel) {
      broadcastChannel.postMessage(message);
    } else {
      // Fallback to localStorage
      try {
        localStorage.setItem('iqguessr_cross_tab_state', JSON.stringify(message));
        setTimeout(() => {
          localStorage.removeItem('iqguessr_cross_tab_state');
        }, 0);
      } catch (error) {
        console.warn('[IQGuessr] Failed to broadcast IQ reveal:', error);
      }
    }

    notifyIQRevealed(tweetId);
  }

  /**
   * Save revealed tweets to storage
   */
  function saveRevealedTweets() {
    try {
      chrome.storage.local.set({
        iqguessr_revealed_tweets: Array.from(revealedTweets)
      });
    } catch (error) {
      console.warn('[IQGuessr] Failed to save revealed tweets:', error);
    }
  }

  /**
   * Notify other modules about IQGuessr mode change
   */
  function notifyIQGuessrModeChange(enabled) {
    // Dispatch custom event for other modules
    window.dispatchEvent(new CustomEvent('iqguessr:modeChanged', {
      detail: { enabled: enabled }
    }));
  }

  /**
   * Notify other modules about IQ reveal
   */
  function notifyIQRevealed(tweetId) {
    window.dispatchEvent(new CustomEvent('iqguessr:iqRevealed', {
      detail: { tweetId: tweetId }
    }));
  }

  /**
   * Check if IQGuessr mode is enabled in any tab
   * This is used to prevent cheating by ensuring all tabs respect game mode
   */
  function isIQGuessrEnabledAnywhere() {
    // Return the current state (updated by storage listener and cross-tab messages)
    return isIQGuessrEnabled;
  }

  /**
   * Update the IQGuessr enabled state (called by storage listener)
   */
  function updateIQGuessrState(enabled) {
    const wasEnabled = isIQGuessrEnabled;
    isIQGuessrEnabled = enabled === true;

    // If state changed, broadcast to other tabs
    if (wasEnabled !== isIQGuessrEnabled) {
      broadcastIQGuessrModeChange(isIQGuessrEnabled);
    }
  }

  /**
   * Check if a tweet's IQ has been revealed in any tab
   */
  function isIQRevealed(tweetId) {
    if (!tweetId) {
      return false;
    }
    return revealedTweets.has(String(tweetId));
  }

  /**
   * Listen for storage changes from chrome.storage
   */
  function setupStorageListener() {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'sync' && changes.enableIQGuessr) {
        const enabled = changes.enableIQGuessr.newValue === true;
        updateIQGuessrState(enabled);
      }
    });
  }

  /**
   * Initialize the cross-tab sync
   */
  function init() {
    initBroadcastChannel();
    setupStorageListener();

    // Listen for IQGuessr mode changes from settings
    chrome.storage.sync.get(['enableIQGuessr'], (result) => {
      if (result.enableIQGuessr !== undefined) {
        isIQGuessrEnabled = result.enableIQGuessr === true;
        broadcastStateUpdate();
      }
    });
  }

  // Initialize on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Export API
  if (typeof window !== 'undefined') {
    window.CrossTabSync = {
      isIQGuessrEnabledAnywhere,
      isIQRevealed,
      broadcastIQRevealed,
      broadcastIQGuessrModeChange,
      updateIQGuessrState
    };
  }
})();

