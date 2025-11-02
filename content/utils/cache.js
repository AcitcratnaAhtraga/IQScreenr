/**
 * IQ Cache Management
 * Handles caching of IQ estimation results based on Twitter handles
 * Privacy-compliant: Only stores scores, handles, and limited metadata (no tweet text)
 */

(function() {
  'use strict';

const CACHE_KEY_PREFIX = 'iq_cache_';
const MAX_CACHE_SIZE = 1000; // Limit to prevent excessive storage usage

// IQ cache for storing calculated scores with metadata
const iqCache = new Map();

/**
 * Generate a cache key from handle
 * Uses normalized handle (lowercase) as the key
 */
function generateCacheKey(handle) {
  if (!handle) return null;
  // Normalize handle: lowercase, trim whitespace, remove @ if present
  return handle.trim().toLowerCase().replace(/^@/, '');
}

/**
 * Get cached IQ result for a handle
 * Returns the most recent IQ result for the given handle
 * @param {string} handle - Twitter handle/username (without @)
 * @param {object} options - Optional options
 * @returns {object|null} The cached IQ result object, or null if not found
 */
function getCachedIQ(handle, options = {}) {
  if (!handle) return null;

  const key = generateCacheKey(handle);
  if (!key) return null;

  const cached = iqCache.get(key);

  if (!cached) {
    return null;
  }

  // Handle backward compatibility: old entries stored just the result
  // New entries store {result, metadata}
  if (cached && typeof cached === 'object' && cached.result !== undefined) {
    // New format with metadata
    return cached.result;
  } else {
    // Old format: just the result
    return cached;
  }
}

/**
 * Store IQ result in cache for a handle with metadata
 * Privacy-compliant: Does NOT store tweet text, only scores and metadata
 * @param {string} handle - Twitter handle/username (without @) - REQUIRED
 * @param {object} result - The IQ estimation result
 * @param {object} metadata - Optional metadata object with:
 *   - timestamp: When the score was calculated (defaults to now)
 *   - language: Tweet language if available
 *   - hashtags: Array of hashtags if available (optional)
 *   - extensionVersion: Browser extension version (optional)
 *   Note: tweetUrl and tweetText are NOT stored for privacy compliance
 */
function cacheIQ(handle, result, metadata = {}) {
  if (!handle) {
    console.warn('cacheIQ: handle is required but not provided');
    return;
  }

  const key = generateCacheKey(handle);
  if (!key) {
    console.warn('cacheIQ: invalid handle provided');
    return;
  }

  // Check cache size and prune old entries if necessary
  if (iqCache.size >= MAX_CACHE_SIZE) {
    // Remove oldest 20% of entries based on timestamp (simple FIFO)
    const entries = Array.from(iqCache.entries()).map(([k, v]) => ({
      key: k,
      timestamp: v?.metadata?.timestamp || '0',
      value: v
    }));

    // Sort by timestamp (oldest first)
    entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    // Remove oldest 20%
    const keysToRemove = entries
      .slice(0, Math.floor(MAX_CACHE_SIZE * 0.2))
      .map(e => e.key);

    keysToRemove.forEach(keyToRemove => {
      iqCache.delete(keyToRemove);
      chrome.storage.local.remove(CACHE_KEY_PREFIX + keyToRemove, () => {});
    });
  }

  // Prepare metadata object with defaults
  // Store only allowed metadata: timestamp, language, hashtags, extension version
  // DO NOT store tweet text or tweet URLs
  const cacheEntry = {
    result: result,
    metadata: {
      handle: key, // Store normalized handle
      timestamp: metadata.timestamp || new Date().toISOString(),
      language: metadata.language || null,
      hashtags: metadata.hashtags && Array.isArray(metadata.hashtags) ? metadata.hashtags : null,
      extensionVersion: metadata.extensionVersion || null
      // Explicitly NOT storing: tweetText, tweetUrl
    }
  };

  // Store in memory cache
  iqCache.set(key, cacheEntry);

  // Store in persistent storage
  const cacheData = {};
  cacheData[CACHE_KEY_PREFIX + key] = cacheEntry;
  chrome.storage.local.set(cacheData, () => {});
}

/**
 * Load IQ cache from local storage
 * Handles migration from old format (text-based keys) to new format (handle-based keys)
 * Old entries are loaded for backward compatibility but will be replaced as new entries are cached
 */
function loadCache() {
  chrome.storage.local.get(null, (items) => {
    let loadedCount = 0;
    for (const [key, value] of Object.entries(items)) {
      if (key.startsWith(CACHE_KEY_PREFIX)) {
        const cacheKey = key.replace(CACHE_KEY_PREFIX, '');

        // Handle migration: old format used text hashes as keys
        // New format uses handles as keys
        // We'll load old entries but they'll be gradually replaced
        if (value && typeof value === 'object' && value.result !== undefined) {
          // New format or migrated format with metadata
          const handle = value.metadata?.handle;
          if (handle) {
            // Already using handle-based key, store directly
            const normalizedHandle = generateCacheKey(handle);
            if (normalizedHandle) {
              iqCache.set(normalizedHandle, value);
            }
          } else {
            // Old format entry: try to extract handle from metadata if present
            // Otherwise store with old key (will be migrated on next cache write)
            iqCache.set(cacheKey, value);
          }
        } else {
          // Old format: store as-is for backward compatibility
          iqCache.set(cacheKey, value);
        }
        loadedCount++;
      }
    }
  });
}

/**
 * Get all cached entries with their metadata
 * Useful for debugging or future features (e.g., viewing cache stats by handle)
 * Returns only entries with valid metadata (scores and handles)
 */
function getAllCachedEntries() {
  const entries = [];
  for (const [key, value] of iqCache.entries()) {
    if (value && typeof value === 'object' && value.result !== undefined) {
      entries.push({
        handle: value.metadata?.handle || key,
        result: value.result,
        metadata: value.metadata
      });
    } else {
      // Old format entry (will be migrated eventually)
      entries.push({
        handle: key, // May be a hash, not a handle
        result: value,
        metadata: null
      });
    }
  }
  return entries;
}

/**
 * Clear all cached entries
 * Useful for privacy compliance or manual cache clearing
 */
function clearCache() {
  iqCache.clear();
  chrome.storage.local.get(null, (items) => {
    const keysToRemove = Object.keys(items)
      .filter(key => key.startsWith(CACHE_KEY_PREFIX))
      .map(key => key);

    if (keysToRemove.length > 0) {
      chrome.storage.local.remove(keysToRemove, () => {});
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
    generateCacheKey,
    loadCache,
    getAllCachedEntries,
    clearCache
  };
}

})();

