/**
 * IQ Cache Management
 * Handles caching of IQ estimation results to avoid recalculation
 * Cache entries now include metadata: handle, timestamp, and other useful data
 */

(function() {
  'use strict';

const CACHE_KEY_PREFIX = 'iq_cache_';
const MAX_CACHE_SIZE = 1000; // Limit to prevent excessive storage usage

// IQ cache for storing calculated scores with metadata
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
 * Returns the IQ result object (which may be the result directly for backward compatibility,
 * or an object with {result, metadata} for new cache entries)
 */
function getCachedIQ(tweetText, options = {}) {
  const hash = hashTweetText(tweetText);
  const cached = iqCache.get(hash);

  if (!cached) {
    return null;
  }

  // Handle backward compatibility: old entries stored just the result
  // New entries store {result, metadata}
  if (cached && typeof cached === 'object' && cached.result !== undefined) {
    // New format with metadata
    // If filtering by handle is requested
    if (options.handle && cached.metadata && cached.metadata.handle) {
      if (cached.metadata.handle.toLowerCase() !== options.handle.toLowerCase()) {
        return null; // Handle doesn't match
      }
    }
    return cached.result;
  } else {
    // Old format: just the result
    return cached;
  }
}

/**
 * Store IQ result in cache for tweet text with metadata
 * @param {string} tweetText - The tweet text content
 * @param {object} result - The IQ estimation result
 * @param {object} metadata - Optional metadata object with:
 *   - handle: Twitter handle/username (without @)
 *   - timestamp: When the score was calculated (defaults to now)
 *   - tweetUrl: URL of the tweet (if available)
 *   - other fields as needed in the future
 */
function cacheIQ(tweetText, result, metadata = {}) {
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

  // Prepare metadata object with defaults
  // Spread metadata first to allow overrides, then set explicit defaults
  const cacheEntry = {
    result: result,
    metadata: {
      ...metadata, // Allow any metadata fields to be passed
      handle: metadata.handle !== undefined ? metadata.handle : null,
      timestamp: metadata.timestamp || new Date().toISOString(),
      tweetUrl: metadata.tweetUrl !== undefined ? metadata.tweetUrl : null
    }
  };

  // Store in memory cache
  iqCache.set(hash, cacheEntry);

  // Store in persistent storage
  const cacheData = {};
  cacheData[CACHE_KEY_PREFIX + hash] = cacheEntry;
  chrome.storage.local.set(cacheData, () => {});
}

/**
 * Load IQ cache from local storage
 * Handles both old format (just result) and new format (result + metadata)
 */
function loadCache() {
  chrome.storage.local.get(null, (items) => {
    let loadedCount = 0;
    for (const [key, value] of Object.entries(items)) {
      if (key.startsWith(CACHE_KEY_PREFIX)) {
        const tweetHash = key.replace(CACHE_KEY_PREFIX, '');

        // Handle migration: if old format (just result), wrap it for consistency
        // but keep it backward compatible
        if (value && typeof value === 'object' && value.result !== undefined) {
          // New format
          iqCache.set(tweetHash, value);
        } else {
          // Old format: store as-is for backward compatibility
          iqCache.set(tweetHash, value);
        }
        loadedCount++;
      }
    }
  });
}

/**
 * Get all cached entries with their metadata
 * Useful for debugging or future features (e.g., viewing cache stats by handle)
 */
function getAllCachedEntries() {
  const entries = [];
  for (const [hash, value] of iqCache.entries()) {
    if (value && typeof value === 'object' && value.result !== undefined) {
      entries.push({
        hash,
        result: value.result,
        metadata: value.metadata
      });
    } else {
      // Old format entry
      entries.push({
        hash,
        result: value,
        metadata: null
      });
    }
  }
  return entries;
}

// Initialize cache on load
loadCache();

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.IQCache = {
    getCachedIQ,
    cacheIQ,
    hashTweetText,
    loadCache,
    getAllCachedEntries
  };
}

})();

