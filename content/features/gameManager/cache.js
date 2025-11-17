/**
 * Cache Manager for Game Manager
 * Handles caching of guesses, revealed IQs, and related data
 */

(function() {
  'use strict';

  const Constants = typeof window !== 'undefined' && window.Constants ? window.Constants : {};
  const GUESS_CACHE_PREFIX = 'iq_guess_';
  const REVEALED_CACHE_PREFIX = 'iq_revealed_';
  const REVEALED_IQ_CACHE_PREFIX = 'iq_revealed_iq_'; // Store IQ result by tweet ID as fallback
  const MAX_CACHE_SIZE = Constants.CACHE?.MAX_SIZE || 1000; // Limit to prevent excessive storage usage

  // In-memory cache
  const persistentGuessCache = new Map();

  /**
   * Generate cache key from tweet ID
   */
  function generateGuessCacheKey(tweetId) {
    if (!tweetId) return null;
    return String(tweetId).trim();
  }

  /**
   * Get cached guess for a tweet ID (async)
   */
  async function getCachedGuess(tweetId) {
    if (!tweetId) {
      return null;
    }

    const key = generateGuessCacheKey(tweetId);
    if (!key) {
      return null;
    }

    // Check memory cache first
    if (persistentGuessCache.has(key)) {
      return persistentGuessCache.get(key);
    }

    // Try to get from chrome storage
    const storage = window.GameManagerStorage;
    if (!storage || !storage.isExtensionContextValid()) {
      return null;
    }

    const storageKey = GUESS_CACHE_PREFIX + key;
    const result = await storage.getStorage([storageKey]);

    if (result[storageKey]) {
      persistentGuessCache.set(key, result[storageKey]);
      return result[storageKey];
    }

    return null;
  }

  /**
   * Cache a guess for a tweet ID
   */
  function cacheGuess(tweetId, guessData) {
    if (!tweetId) {
      return;
    }

    const key = generateGuessCacheKey(tweetId);
    if (!key) {
      return;
    }

    const cacheEntry = {
      guess: guessData.guess,
      confidence: guessData.confidence,
      timestamp: new Date().toISOString()
    };

    // Store in memory
    persistentGuessCache.set(key, cacheEntry);

    // Prune cache if it exceeds max size
    if (persistentGuessCache.size > MAX_CACHE_SIZE) {
      // Remove oldest 20% of entries
      const entries = Array.from(persistentGuessCache.entries());
      const toRemove = Math.floor(MAX_CACHE_SIZE * 0.2);
      for (let i = 0; i < toRemove; i++) {
        persistentGuessCache.delete(entries[i][0]);
      }
    }

    // Store in chrome storage
    const storage = window.GameManagerStorage;
    if (!storage || !storage.isExtensionContextValid()) {
      return;
    }

    const storageKey = GUESS_CACHE_PREFIX + key;
    storage.setStorage({ [storageKey]: cacheEntry });
  }

  /**
   * Load all guesses from storage into memory
   * Enforces size limits during loading
   */
  async function loadGuessCache() {
    const storage = window.GameManagerStorage;
    if (!storage || !storage.isExtensionContextValid()) {
      return;
    }

    try {
      const items = await storage.getStorage(null);
      const entries = [];

      // Collect all cache entries
      for (const [key, value] of Object.entries(items)) {
        if (key.startsWith(GUESS_CACHE_PREFIX)) {
          const cacheKey = key.replace(GUESS_CACHE_PREFIX, '');
          if (value && typeof value === 'object' && value.timestamp) {
            entries.push({ key: cacheKey, value, timestamp: new Date(value.timestamp).getTime() });
          }
        }
      }

      // Sort by timestamp (newest first)
      entries.sort((a, b) => b.timestamp - a.timestamp);

      // Load only up to MAX_CACHE_SIZE entries
      const entriesToLoad = entries.slice(0, MAX_CACHE_SIZE);
      for (const entry of entriesToLoad) {
        persistentGuessCache.set(entry.key, entry.value);
      }
    } catch (error) {
      const Logger = window.Logger || console;
      Logger.warn('[IQGuessr] Error loading guess cache:', error);
    }
  }

  /**
   * Cache that an IQ was revealed for a tweet ID (even without a guess)
   * This ensures that if IQGuessr mode is re-enabled or page is refreshed,
   * the IQ stays as calculated instead of reverting to guess badge
   */
  function cacheRevealedIQ(tweetId) {
    if (!tweetId) return;

    const key = generateGuessCacheKey(tweetId);
    if (!key) return;

    const revealedEntry = {
      revealed: true,
      timestamp: new Date().toISOString()
    };

    const storage = window.GameManagerStorage;
    if (!storage || !storage.isExtensionContextValid()) {
      return;
    }

    const storageKey = REVEALED_CACHE_PREFIX + key;
    storage.setStorage({ [storageKey]: revealedEntry });
  }

  /**
   * Get cached revealed IQ status for a tweet ID (async)
   */
  async function getCachedRevealedIQ(tweetId) {
    if (!tweetId) return null;

    const key = generateGuessCacheKey(tweetId);
    if (!key) return null;

    const storage = window.GameManagerStorage;
    if (!storage || !storage.isExtensionContextValid()) {
      return null;
    }

    const storageKey = REVEALED_CACHE_PREFIX + key;
    const result = await storage.getStorage([storageKey]);

    if (result[storageKey] && result[storageKey].revealed) {
      return true;
    }

    return false;
  }

  /**
   * Cache the revealed IQ result by tweet ID as a fallback
   * This ensures we can restore calculated badges even if handle lookup fails
   */
  function cacheRevealedIQResult(tweetId, iqResultData) {
    if (!tweetId || !iqResultData) return;

    const key = generateGuessCacheKey(tweetId);
    if (!key) return;

    const storage = window.GameManagerStorage;
    if (!storage || !storage.isExtensionContextValid()) {
      return;
    }

    const storageKey = REVEALED_IQ_CACHE_PREFIX + key;
    storage.setStorage({ [storageKey]: iqResultData });
  }

  /**
   * Get cached revealed IQ result by tweet ID (async)
   * This is a fallback when handle-based lookup fails
   */
  async function getCachedRevealedIQResult(tweetId) {
    if (!tweetId) return null;

    const key = generateGuessCacheKey(tweetId);
    if (!key) return null;

    const storage = window.GameManagerStorage;
    if (!storage || !storage.isExtensionContextValid()) {
      return null;
    }

    const storageKey = REVEALED_IQ_CACHE_PREFIX + key;
    const result = await storage.getStorage([storageKey]);

    if (result[storageKey]) {
      return result[storageKey];
    }

    return null;
  }

  // Load cache on initialization
  if (typeof window !== 'undefined' && window.GameManagerStorage) {
    loadGuessCache();
  } else {
    // Wait for storage to be available
    if (typeof window !== 'undefined') {
      const timerManager = window.TimerManager || window;
      const checkStorage = timerManager.setInterval ? 
        timerManager.setInterval(() => {
          if (window.GameManagerStorage) {
            timerManager.clearInterval(checkStorage);
            loadGuessCache();
          }
        }, 100) :
        setInterval(() => {
          if (window.GameManagerStorage) {
            clearInterval(checkStorage);
            loadGuessCache();
          }
      }, 100);

      // Timeout after 5 seconds
      setTimeout(() => clearInterval(checkStorage), 5000);
    }
  }

  /**
   * Clear all caches
   */
  function clearCache() {
    persistentGuessCache.clear();
    
    const storage = window.GameManagerStorage;
    if (storage && storage.isExtensionContextValid()) {
      // Clear all game-related cache entries
      storage.getStorage(null).then(items => {
        const keysToRemove = [];
        for (const key of Object.keys(items)) {
          if (key.startsWith(GUESS_CACHE_PREFIX) ||
              key.startsWith(REVEALED_CACHE_PREFIX) ||
              key.startsWith(REVEALED_IQ_CACHE_PREFIX)) {
            keysToRemove.push(key);
          }
        }
        if (keysToRemove.length > 0) {
          chrome.storage.local.remove(keysToRemove);
        }
      });
    }
  }

  // Export
  if (typeof window !== 'undefined') {
    window.GameManagerCache = {
      getCachedGuess,
      cacheGuess,
      loadGuessCache,
      cacheRevealedIQ,
      getCachedRevealedIQ,
      cacheRevealedIQResult,
      getCachedRevealedIQResult,
      clearCache
    };
  }
})();
