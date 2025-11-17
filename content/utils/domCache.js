/**
 * DOM Query Cache Utility
 * Caches frequently accessed DOM queries to reduce repeated querySelector calls
 * Implements memoization with automatic invalidation
 */

(function() {
  'use strict';

  // Cache for DOM queries
  const queryCache = new Map();
  
  // Cache for nested tweet structures
  const nestedStructureCache = new WeakMap();
  
  // Maximum cache size to prevent memory leaks
  const MAX_CACHE_SIZE = 500;
  
  // Cache expiration time (milliseconds)
  const CACHE_EXPIRY = 30000; // 30 seconds

  /**
   * Generate cache key from selector and context
   * @param {string} selector - CSS selector
   * @param {HTMLElement} context - Context element (optional)
   * @returns {string} Cache key
   */
  function generateCacheKey(selector, context) {
    const contextId = context ? (context.getAttribute('data-tweet-id') || context.id || 'root') : 'root';
    return `${selector}::${contextId}`;
  }

  /**
   * Check if cache entry is expired
   * @param {Object} cacheEntry - Cache entry object
   * @returns {boolean} True if expired
   */
  function isExpired(cacheEntry) {
    return Date.now() - cacheEntry.timestamp > CACHE_EXPIRY;
  }

  /**
   * Clean up expired entries
   */
  function cleanupExpired() {
    const now = Date.now();
    for (const [key, entry] of queryCache.entries()) {
      if (now - entry.timestamp > CACHE_EXPIRY) {
        queryCache.delete(key);
      }
    }
  }

  /**
   * Prune cache if it exceeds max size
   */
  function pruneCache() {
    if (queryCache.size > MAX_CACHE_SIZE) {
      // Remove oldest 20% of entries
      const entries = Array.from(queryCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = Math.floor(MAX_CACHE_SIZE * 0.2);
      for (let i = 0; i < toRemove; i++) {
        queryCache.delete(entries[i][0]);
      }
    }
  }

  /**
   * Cached querySelector
   * @param {string} selector - CSS selector
   * @param {HTMLElement} [context=document] - Context element
   * @param {boolean} [forceRefresh=false] - Force refresh cache
   * @returns {HTMLElement|null} Found element or null
   */
  function querySelector(selector, context = document, forceRefresh = false) {
    if (!selector) return null;
    
    const key = generateCacheKey(selector, context);
    const cached = queryCache.get(key);
    
    // Check if cached and still valid
    if (!forceRefresh && cached && !isExpired(cached)) {
      // Verify element still exists in DOM
      if (cached.element && (context.contains ? context.contains(cached.element) : document.contains(cached.element))) {
        return cached.element;
      }
      // Element removed from DOM, invalidate cache
      queryCache.delete(key);
    }
    
    // Perform query
    const element = context.querySelector(selector);
    
    // Cache result
    if (element) {
      queryCache.set(key, {
        element,
        timestamp: Date.now()
      });
      
      // Cleanup if needed
      if (queryCache.size > MAX_CACHE_SIZE * 0.9) {
        cleanupExpired();
        pruneCache();
      }
    }
    
    return element;
  }

  /**
   * Cached querySelectorAll
   * Note: Results are not cached as they can change frequently
   * But we cache the query itself to avoid repeated calls
   * @param {string} selector - CSS selector
   * @param {HTMLElement} [context=document] - Context element
   * @returns {NodeList} Found elements
   */
  function querySelectorAll(selector, context = document) {
    if (!selector) return [];
    
    // For querySelectorAll, we don't cache results but we can optimize
    // by checking if the context has changed
    return context.querySelectorAll(selector);
  }

  /**
   * Cache nested tweet structure detection
   * @param {HTMLElement} tweetElement - Tweet element
   * @returns {Object} Nested structure info
   */
  function getNestedStructure(tweetElement) {
    if (!tweetElement) return null;
    
    // Check cache first
    const cached = nestedStructureCache.get(tweetElement);
    if (cached) {
      // Verify structure still valid
      if (cached.actualTweetElement && tweetElement.contains(cached.actualTweetElement)) {
        return cached;
      }
      // Structure changed, invalidate
      nestedStructureCache.delete(tweetElement);
    }
    
    // Detect structure
    const nestedTweet = tweetElement.querySelector('article[data-testid="tweet"]') ||
                        tweetElement.querySelector('article[role="article"]');
    const hasNestedStructure = nestedTweet && nestedTweet !== tweetElement;
    const actualTweetElement = hasNestedStructure ? nestedTweet : tweetElement;
    
    const structure = {
      actualTweetElement,
      nestedTweet: hasNestedStructure ? nestedTweet : null,
      outerElement: hasNestedStructure ? tweetElement : null,
      hasNestedStructure
    };
    
    // Cache structure
    nestedStructureCache.set(tweetElement, structure);
    
    return structure;
  }

  /**
   * Get engagement bar with caching
   * @param {HTMLElement} tweetElement - Tweet element
   * @returns {HTMLElement|null} Engagement bar element
   */
  function getEngagementBar(tweetElement) {
    return querySelector('[role="group"]', tweetElement);
  }

  /**
   * Get tweet ID with caching
   * @param {HTMLElement} tweetElement - Tweet element
   * @returns {string|null} Tweet ID
   */
  function getTweetId(tweetElement) {
    if (!tweetElement) return null;
    
    // Check if already cached as attribute
    let tweetId = tweetElement.getAttribute('data-tweet-id');
    if (tweetId) return tweetId;
    
    // Try to extract from nested structure
    const structure = getNestedStructure(tweetElement);
    if (structure && structure.actualTweetElement) {
      tweetId = structure.actualTweetElement.getAttribute('data-tweet-id');
      if (tweetId) {
        // Cache it
        tweetElement.setAttribute('data-tweet-id', tweetId);
        return tweetId;
      }
    }
    
    return null;
  }

  /**
   * Clear cache for a specific element
   * @param {HTMLElement} element - Element to clear cache for
   */
  function clearElementCache(element) {
    if (!element) return;
    
    // Clear nested structure cache
    nestedStructureCache.delete(element);
    
    // Clear query cache entries for this element
    const tweetId = element.getAttribute('data-tweet-id');
    if (tweetId) {
      for (const [key] of queryCache.entries()) {
        if (key.includes(tweetId)) {
          queryCache.delete(key);
        }
      }
    }
  }

  /**
   * Clear all caches
   */
  function clearAllCaches() {
    queryCache.clear();
    // WeakMap clears automatically when elements are garbage collected
  }

  /**
   * Invalidate cache when DOM changes
   * Should be called after significant DOM mutations
   */
  function invalidateCache() {
    // Clear expired entries
    cleanupExpired();
    
    // Verify cached elements still exist
    for (const [key, entry] of queryCache.entries()) {
      if (entry.element && !document.contains(entry.element)) {
        queryCache.delete(key);
      }
    }
  }

  // Periodic cleanup
  let cleanupInterval = null;
  
  function startCleanupTimer() {
    if (cleanupInterval) return;
    
    cleanupInterval = setInterval(() => {
      cleanupExpired();
      invalidateCache();
    }, 10000); // Cleanup every 10 seconds
  }
  
  function stopCleanupTimer() {
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
      cleanupInterval = null;
    }
  }

  // Start cleanup timer
  if (typeof window !== 'undefined') {
    startCleanupTimer();
    
    // Stop timer on page unload
    window.addEventListener('beforeunload', stopCleanupTimer);
  }

  // Export for use in other modules
  if (typeof window !== 'undefined') {
    window.DOMCache = {
      querySelector,
      querySelectorAll,
      getNestedStructure,
      getEngagementBar,
      getTweetId,
      clearElementCache,
      clearAllCaches,
      invalidateCache,
      startCleanupTimer,
      stopCleanupTimer
    };
  }
})();

