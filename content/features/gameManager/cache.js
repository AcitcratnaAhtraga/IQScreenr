/**
 * Cache Manager for Game Manager
 * Handles caching of guesses, revealed IQs, and related data
 */

(function() {
  'use strict';

  const GUESS_CACHE_PREFIX = 'iq_guess_';
  const REVEALED_CACHE_PREFIX = 'iq_revealed_';
  const REVEALED_IQ_CACHE_PREFIX = 'iq_revealed_iq_'; // Store IQ result by tweet ID as fallback

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
   */
  async function loadGuessCache() {
    const storage = window.GameManagerStorage;
    if (!storage || !storage.isExtensionContextValid()) {
      return;
    }

    try {
      const items = await storage.getStorage(null);

      for (const [key, value] of Object.entries(items)) {
        if (key.startsWith(GUESS_CACHE_PREFIX)) {
          const cacheKey = key.replace(GUESS_CACHE_PREFIX, '');
          if (value && typeof value === 'object') {
            persistentGuessCache.set(cacheKey, value);
          }
        }
      }
    } catch (error) {
      console.warn('[IQGuessr] Error loading guess cache:', error);
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
      const checkStorage = setInterval(() => {
        if (window.GameManagerStorage) {
          clearInterval(checkStorage);
          loadGuessCache();
        }
      }, 100);

      // Timeout after 5 seconds
      setTimeout(() => clearInterval(checkStorage), 5000);
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
      getCachedRevealedIQResult
    };
  }
})();
