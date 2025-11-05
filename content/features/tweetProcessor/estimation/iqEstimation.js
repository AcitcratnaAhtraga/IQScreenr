/**
 * IQ Estimation Manager
 * Handles IQ estimation, caching, and cache validation
 */

(function() {
  'use strict';

  // Get dependencies from other modules
  const getTextExtraction = () => window.TextExtraction || {};
  const getIQCache = () => window.IQCache || {};
  const getGameManager = () => window.GameManager || {};

  /**
   * Extract metadata from tweet (privacy-compliant: no tweet text or URLs)
   *
   * @param {HTMLElement} actualTweetElement - The actual tweet element
   * @param {string} tweetText - The tweet text (for hashtag extraction only)
   * @returns {Object} Metadata object containing language and hashtags
   */
  function extractMetadata(actualTweetElement, tweetText) {
    let language = null;
    let hashtags = null;

    try {
      // Extract language from tweet element if available
      const tweetTextElement = actualTweetElement.querySelector('[data-testid="tweetText"]');
      if (tweetTextElement) {
        const langAttr = tweetTextElement.getAttribute('lang');
        if (langAttr) {
          language = langAttr;
        }
      }

      // Extract hashtags from tweet text (limited metadata - just the hashtag words, not full tweet)
      if (tweetText) {
        const hashtagMatches = tweetText.match(/#[\w]+/g);
        if (hashtagMatches && hashtagMatches.length > 0) {
          hashtags = hashtagMatches.map(tag => tag.substring(1).toLowerCase()); // Remove # and normalize
        }
      }
    } catch (e) {
      // Ignore errors in metadata extraction
    }

    return { language, hashtags };
  }

  /**
   * Check if cached result is valid for current text
   * Validates text length, word count, and Twitter calibration flag
   *
   * @param {Object} cachedResult - The cached IQ result
   * @param {string} currentText - The current tweet text
   * @returns {boolean} Whether the cache is valid (false means should recalculate)
   */
  function isCacheValid(cachedResult, currentText) {
    if (!cachedResult) {
      return false;
    }

    // Check if cached result was calculated with different text length
    // If so, the cache is stale (e.g., URLs were included before but removed now)
    const cachedTextLength = cachedResult.text_length;
    const currentTextLength = currentText.length;

    // Also check word count as a secondary validation
    const cachedWordCount = cachedResult.word_count;
    const currentWordCount = currentText.split(/\s+/).filter(w => w.length > 0).length;

    // Check Twitter calibration flag
    const cachedIsTwitterCalibrated = cachedResult.is_twitter_calibrated;
    const isTweetLength = currentTextLength <= 300; // Should use Twitter calibration
    const calibrationMismatch = cachedIsTwitterCalibrated !== undefined && cachedIsTwitterCalibrated !== isTweetLength;

    // Invalidate cache if:
    // 1. Text length is missing (old cache entry) OR lengths differ significantly (>5 chars)
    // 2. Word count is missing (old cache entry) OR word counts differ
    // 3. Twitter calibration flags differ (indicates different text processing)
    const textLengthMismatch = cachedTextLength === undefined || Math.abs(cachedTextLength - currentTextLength) > 5;
    const wordCountMismatch = cachedWordCount === undefined || Math.abs(cachedWordCount - currentWordCount) > 0;

    // Force recalculation if we detect any mismatch
    return !(textLengthMismatch || wordCountMismatch || calibrationMismatch);
  }

  /**
   * Estimate IQ for tweet text
   * Handles caching, cache validation, and recalculation when needed
   *
   * @param {string} tweetText - The tweet text to analyze
   * @param {string} handle - The tweet handle (for caching)
   * @param {HTMLElement} actualTweetElement - The actual tweet element (for metadata)
   * @param {Object} iqEstimator - The IQ estimator instance
   * @returns {Promise<Object>} Object containing:
   *   - result: The IQ estimation result
   *   - fromCache: Whether the result came from cache
   */
  async function estimateIQ(tweetText, handle, actualTweetElement, iqEstimator) {
    const { removeUrlsFromText } = getTextExtraction();
    const { getCachedIQ, cacheIQ } = getIQCache();

    // Extract metadata (privacy-compliant: no tweet text or URLs)
    const metadata = extractMetadata(actualTweetElement, tweetText);

    // CRITICAL: Final URL removal pass before estimation to ensure text is clean
    let cleanedText = tweetText;
    if (cleanedText && removeUrlsFromText) {
      cleanedText = removeUrlsFromText(cleanedText);
    }

    // Get cached result by handle (not by tweet text)
    let result = handle ? getCachedIQ(handle) : null;
    let fromCache = false;

    if (!result) {
      // Not in cache, calculate new result
      try {
        result = await iqEstimator.estimate(cleanedText);

        if (result.is_valid && result.iq_estimate !== null && handle) {
          // Cache with metadata: handle, timestamp, language, hashtags
          // Privacy-compliant: NO tweet text or tweet URLs stored
          const cacheMetadata = {
            timestamp: new Date().toISOString(),
            language: metadata.language,
            hashtags: metadata.hashtags,
            extensionVersion: chrome.runtime.getManifest().version || null
          };
          cacheIQ(handle, result, cacheMetadata);
        }
      } catch (estimateError) {
        console.error(`[IQEstimation] ERROR in IQ estimation:`, estimateError?.message || estimateError);
        throw estimateError;
      }
    } else {
      fromCache = true;

      // Check if cached result is valid for current text
      if (!isCacheValid(result, cleanedText)) {
        // Cached result is for different text - recalculate
        fromCache = false;

        // CRITICAL: Final URL removal pass before estimation to ensure text is clean
        if (cleanedText && removeUrlsFromText) {
          cleanedText = removeUrlsFromText(cleanedText);
        }

        try {
          result = await iqEstimator.estimate(cleanedText);

          if (result.is_valid && result.iq_estimate !== null && handle) {
            // Update cache with new result
            const cacheMetadata = {
              timestamp: new Date().toISOString(),
              language: metadata.language,
              hashtags: metadata.hashtags,
              extensionVersion: chrome.runtime.getManifest().version || null
            };
            cacheIQ(handle, result, cacheMetadata);
          }
        } catch (estimateError) {
          console.error(`[IQEstimation] ERROR in IQ estimation (recalc):`, estimateError?.message || estimateError);
          throw estimateError;
        }
      }
    }

    return {
      result,
      fromCache
    };
  }

  /**
   * Check if IQ estimation should be skipped (IQGuessr mode)
   *
   * @param {string} tweetId - The tweet ID
   * @returns {Promise<boolean>} Whether estimation should be skipped (true = skip)
   */
  async function shouldSkipEstimation(tweetId) {
    const gameManager = getGameManager();
    if (!gameManager || !gameManager.isGameModeEnabled || !gameManager.isGameModeEnabled()) {
      return false;
    }

    if (!tweetId) {
      return false;
    }

    // In IQGuessr mode: only calculate if user already made a guess (cached guess exists)
    const cachedGuess = await gameManager.getCachedGuess(tweetId);
    if (!cachedGuess || cachedGuess.guess === undefined) {
      // IQGuessr enabled but no guess yet - skip calculation
      return true;
    }

    return false;
  }

  // Export for use in other modules
  if (typeof window !== 'undefined') {
    window.IQEstimation = {
      estimateIQ,
      shouldSkipEstimation,
      extractMetadata,
      isCacheValid
    };
  }
})();

