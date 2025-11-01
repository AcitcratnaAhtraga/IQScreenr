/**
 * IQ Cache Management
 * Handles caching of IQ estimation results to avoid recalculation
 */

(function() {
  'use strict';

const CACHE_KEY_PREFIX = 'iq_cache_';
const MAX_CACHE_SIZE = 1000; // Limit to prevent excessive storage usage

// IQ cache for storing calculated scores
const iqCache = new Map();

/**
 * Generate a hash for tweet text to use as cache key
 * Uses a robust hash function to minimize collisions
 */
function hashTweetText(text) {
  if (!text) return '';

  // Normalize the text for hashing (remove extra whitespace, lowercase)
  const normalized = text.trim().toLowerCase().replace(/\s+/g, ' ');

  // Create a numeric hash using the entire normalized text
  let numHash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    numHash = ((numHash << 5) - numHash) + char;
    numHash = numHash & numHash; // Convert to 32bit integer
  }

  // Combine with length to add more uniqueness
  return `${numHash}_${normalized.length}`;
}

/**
 * Get cached IQ result for tweet text
 */
function getCachedIQ(tweetText) {
  const hash = hashTweetText(tweetText);
  return iqCache.get(hash);
}

/**
 * Store IQ result in cache for tweet text
 */
function cacheIQ(tweetText, result) {
  const hash = hashTweetText(tweetText);

  // Check cache size and prune old entries if necessary
  if (iqCache.size >= MAX_CACHE_SIZE) {
    // Remove oldest 20% of entries (simple FIFO)
    const keysToRemove = Array.from(iqCache.keys()).slice(0, Math.floor(MAX_CACHE_SIZE * 0.2));
    keysToRemove.forEach(key => {
      iqCache.delete(key);
      chrome.storage.local.remove(CACHE_KEY_PREFIX + key, () => {});
    });
  }

  // Store in memory cache
  iqCache.set(hash, result);

  // Store in persistent storage
  const cacheData = {};
  cacheData[CACHE_KEY_PREFIX + hash] = result;
  chrome.storage.local.set(cacheData, () => {});
}

/**
 * Load IQ cache from local storage
 */
function loadCache() {
  chrome.storage.local.get(null, (items) => {
    let loadedCount = 0;
    for (const [key, value] of Object.entries(items)) {
      if (key.startsWith(CACHE_KEY_PREFIX)) {
        const tweetHash = key.replace(CACHE_KEY_PREFIX, '');
        iqCache.set(tweetHash, value);
        loadedCount++;
      }
    }
  });
}

// Initialize cache on load
loadCache();

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.IQCache = {
    getCachedIQ,
    cacheIQ,
    hashTweetText,
    loadCache
  };
}

})();

