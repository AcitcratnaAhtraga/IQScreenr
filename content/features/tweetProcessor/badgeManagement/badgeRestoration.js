/**
 * Badge Restoration Manager
 * Handles restoration of cached badges (cached guesses and IQ results)
 *
 * CRITICAL: This module prioritizes tweet-ID-based cache over handle-based cache.
 * Handle-based cache is shared across all tweets by the same user, which causes
 * all tweets on a profile page to show the same IQ. Tweet-ID-based cache is
 * specific to each tweet and should be used first.
 */

(function() {
  'use strict';

  // Get dependencies from other modules
  const getTextExtraction = () => window.TextExtraction || {};
  const getBadgeManager = () => window.BadgeManager || {};
  const getGameManager = () => window.GameManager || {};
  const getIQCache = () => window.IQCache || {};
  const getSettings = () => window.Settings || {};
  const getNotificationPlacement = () => window.NotificationBadgePlacement || {};
  const getNestedTweetHandler = () => window.NestedTweetHandler || {};

  /**
   * Place a restored badge in the correct location
   *
   * @param {HTMLElement} iqBadge - The badge element to place
   * @param {HTMLElement} actualTweetElement - The actual tweet element
   * @param {HTMLElement} outerElement - The outer wrapper element (if nested)
   * @param {boolean} hasNestedStructure - Whether this is a nested structure
   * @param {boolean} isNotificationsPage - Whether we're on the notifications page
   */
  function placeRestoredBadge(iqBadge, actualTweetElement, outerElement, hasNestedStructure, isNotificationsPage) {
    const { findNotificationBadgePlacement } = getNotificationPlacement() || {};
    const { getPlacementTarget } = getNestedTweetHandler();

    if (isNotificationsPage) {
      const placementTarget = getPlacementTarget(actualTweetElement, outerElement, hasNestedStructure, isNotificationsPage);
      const placement = findNotificationBadgePlacement ? findNotificationBadgePlacement(placementTarget) : null;
      if (placement) {
        const { targetElement, parentElement } = placement;
        if (placement.placement === 'before-tweet-content') {
          parentElement.insertBefore(iqBadge, targetElement);
        } else {
          if (targetElement.nextSibling) {
            parentElement.insertBefore(iqBadge, targetElement.nextSibling);
          } else {
            parentElement.appendChild(iqBadge);
          }
        }
      } else {
        actualTweetElement.insertBefore(iqBadge, actualTweetElement.firstChild);
      }
    } else {
      const engagementBar = actualTweetElement.querySelector('[role="group"]');
      if (engagementBar) {
        const firstChild = engagementBar.firstElementChild;
        if (firstChild) {
          engagementBar.insertBefore(iqBadge, firstChild);
        } else {
          engagementBar.appendChild(iqBadge);
        }
      } else {
        const tweetContent = actualTweetElement.querySelector('div[data-testid="tweetText"]') ||
                            actualTweetElement.querySelector('div[lang]') ||
                            actualTweetElement.firstElementChild;
        if (tweetContent && tweetContent.parentElement) {
          tweetContent.parentElement.insertBefore(iqBadge, tweetContent);
        } else {
          actualTweetElement.insertBefore(iqBadge, actualTweetElement.firstChild);
        }
      }
    }
  }

  /**
   * Restore badge from revealed IQ (cached revealed IQ result)
   *
   * @param {HTMLElement} actualTweetElement - The actual tweet element
   * @param {HTMLElement} outerElement - The outer wrapper element (if nested)
   * @param {boolean} hasNestedStructure - Whether this is a nested structure
   * @param {string} tweetId - The tweet ID
   * @param {boolean} isNotificationsPage - Whether we're on the notifications page
   * @param {Set} processedTweets - Set of processed tweets to update
   * @returns {boolean} Whether a badge was restored
   */
  async function restoreFromRevealedIQ(actualTweetElement, outerElement, hasNestedStructure, tweetId, isNotificationsPage, processedTweets) {
    const settings = getSettings();
    if (!settings.showIQBadge) {
      return false;
    }

    const gameManager = getGameManager();
    if (!gameManager || !gameManager.getCachedRevealedIQResult) {
      return false;
    }

    // FIRST: Try to get IQ result directly by tweet ID (tweet-specific)
    const cachedIQResult = await gameManager.getCachedRevealedIQResult(tweetId);
    if (!cachedIQResult || !cachedIQResult.iq) {
      return false;
    }

    // Convert to expected format - merge result object if it exists
    const cachedIQ = {
      iq_estimate: cachedIQResult.iq,
      confidence: cachedIQResult.confidence,
      ...(cachedIQResult.result || {})
    };

    // CRITICAL: Do NOT fall back to handle-based cache when cachedRevealed is true
    // Handle-based cache is shared across all tweets by the same user, which causes
    // all tweets on a profile page to show the same IQ. If there's no tweet-ID-specific
    // cache, we should not restore the badge (it will show as a guess badge instead).
    // This prevents tweets that were calculated when IQGuessr was OFF from incorrectly
    // showing the handle-based cache result when IQGuessr is re-enabled.

    if (!cachedIQ || cachedIQ.iq_estimate === undefined) {
      return false;
    }

    // We have revealed IQ and cached IQ - restore calculated badge directly
    const badgeManager = getBadgeManager();
    if (!badgeManager || !badgeManager.createIQBadge) {
      return false;
    }

    const { extractTweetText } = getTextExtraction();
    const { findExistingBadge } = getNestedTweetHandler();

    const iq = Math.round(cachedIQ.iq_estimate);
    const confidence = cachedIQ.confidence ? Math.round(cachedIQ.confidence) : null;
    const tweetText = extractTweetText ? extractTweetText(actualTweetElement) : null;

    // CRITICAL: Check IQ filter IMMEDIATELY after getting IQ, before restoring badge
    const getIQFilter = () => window.IQFilter || {};
    const { checkAndFilter } = getIQFilter();
    if (checkAndFilter) {
      const elementToCheck = (hasNestedStructure && outerElement) ? outerElement : actualTweetElement;
      const wasFiltered = checkAndFilter(elementToCheck, iq);
      if (wasFiltered) {
        // Element was removed, stop restoration
        return true;
      }
    }

    const iqBadge = badgeManager.createIQBadge(iq, cachedIQ, tweetText);

    // Check if there's a cached guess (since cachedRevealed=true means it was compared)
    const cachedGuess = gameManager.getCachedGuess ? await gameManager.getCachedGuess(tweetId) : null;
    if (cachedGuess && cachedGuess.guess !== undefined) {
      iqBadge.setAttribute('data-iq-compared', 'true');
    }

    // Store IQ result on element for reference
    actualTweetElement._iqResult = {
      iq: iq,
      result: cachedIQ,
      confidence: confidence,
      text: tweetText
    };

    // Check if there's already a badge to replace
    const existingBadge = findExistingBadge(actualTweetElement, outerElement, hasNestedStructure);

    // Place the badge
    placeRestoredBadge(iqBadge, actualTweetElement, outerElement, hasNestedStructure, isNotificationsPage);

    // Remove existing badge if it exists
    if (existingBadge && existingBadge.parentElement) {
      existingBadge.remove();
    }

    return true;
  }

  /**
   * Restore badge from cached guess + cached IQ (handle-based)
   *
   * @param {HTMLElement} actualTweetElement - The actual tweet element
   * @param {HTMLElement} outerElement - The outer wrapper element (if nested)
   * @param {boolean} hasNestedStructure - Whether this is a nested structure
   * @param {string} tweetId - The tweet ID
   * @param {string} handle - The tweet handle
   * @param {boolean} isNotificationsPage - Whether we're on the notifications page
   * @param {Set} processedTweets - Set of processed tweets to update
   * @returns {boolean} Whether a badge was restored
   */
  async function restoreFromCachedGuess(actualTweetElement, outerElement, hasNestedStructure, tweetId, handle, isNotificationsPage, processedTweets) {
    const settings = getSettings();
    if (!settings.showIQBadge) {
      return false;
    }

    const gameManager = getGameManager();
    if (!gameManager || !gameManager.getCachedGuess) {
      return false;
    }

    const cachedGuess = await gameManager.getCachedGuess(tweetId);
    if (!cachedGuess || cachedGuess.guess === undefined) {
      return false;
    }

    // We have a cached guess - check if we have cached IQ to restore calculated badge
    const { getCachedIQ } = getIQCache();
    const { extractTweetHandle, extractTweetText } = getTextExtraction();

    if (!getCachedIQ || !extractTweetHandle) {
      return false;
    }

    let tweetHandle = handle;
    if (!tweetHandle) {
      tweetHandle = actualTweetElement.getAttribute('data-handle');
      if (!tweetHandle) {
        tweetHandle = extractTweetHandle(actualTweetElement);
        if (tweetHandle) {
          actualTweetElement.setAttribute('data-handle', tweetHandle);
        }
      }
    }

    if (!tweetHandle) {
      return false;
    }

    const cachedIQ = getCachedIQ(tweetHandle);
    if (!cachedIQ || cachedIQ.iq_estimate === undefined) {
      return false;
    }

    // We have both cached guess and cached IQ - restore calculated badge directly
    const badgeManager = getBadgeManager();
    if (!badgeManager || !badgeManager.createIQBadge) {
      return false;
    }

    const { findExistingBadge } = getNestedTweetHandler();

    const iq = Math.round(cachedIQ.iq_estimate);
    const confidence = cachedIQ.confidence ? Math.round(cachedIQ.confidence) : null;
    const tweetText = extractTweetText ? extractTweetText(actualTweetElement) : null;

    // CRITICAL: Check IQ filter IMMEDIATELY after getting IQ, before restoring badge
    const getIQFilter = () => window.IQFilter || {};
    const { checkAndFilter } = getIQFilter();
    if (checkAndFilter) {
      const elementToCheck = (hasNestedStructure && outerElement) ? outerElement : actualTweetElement;
      const wasFiltered = checkAndFilter(elementToCheck, iq);
      if (wasFiltered) {
        // Element was removed, stop restoration
        return true;
      }
    }

    const iqBadge = badgeManager.createIQBadge(iq, cachedIQ, tweetText);

    // Mark badge as compared since there's a cached guess (meaning it was compared)
    iqBadge.setAttribute('data-iq-compared', 'true');

    // Store IQ result on element for reference (guess is already cached persistently)
    actualTweetElement._iqResult = {
      iq: iq,
      result: cachedIQ,
      confidence: confidence,
      text: tweetText
    };

    // Check if there's already a badge to replace
    const existingBadge = findExistingBadge(actualTweetElement, outerElement, hasNestedStructure);

    // Place the badge
    placeRestoredBadge(iqBadge, actualTweetElement, outerElement, hasNestedStructure, isNotificationsPage);

    // Remove existing badge if it exists
    if (existingBadge && existingBadge.parentElement) {
      existingBadge.remove();
    }

    return true;
  }

  /**
   * Try to restore cached badge (either from revealed IQ or cached guess)
   *
   * @param {HTMLElement} actualTweetElement - The actual tweet element
   * @param {HTMLElement} outerElement - The outer wrapper element (if nested)
   * @param {boolean} hasNestedStructure - Whether this is a nested structure
   * @param {string} tweetId - The tweet ID
   * @param {string} handle - The tweet handle
   * @param {boolean} isNotificationsPage - Whether we're on the notifications page
   * @param {Set} processedTweets - Set of processed tweets to update
   * @returns {boolean} Whether a badge was restored (and processing should stop)
   */
  async function tryRestoreBadge(actualTweetElement, outerElement, hasNestedStructure, tweetId, handle, isNotificationsPage, processedTweets) {
    const settings = getSettings();
    if (!settings.showIQBadge) {
      return false;
    }

    const gameManager = getGameManager();
    if (!gameManager) {
      return false;
    }

    // Check if IQGuessr is enabled - if not, still check for cached revealed IQ to restore badges
    const isGameModeEnabled = gameManager.isGameModeEnabled && gameManager.isGameModeEnabled();

    if (!tweetId) {
      return false;
    }

    // FIRST: Check if IQ was previously revealed (either with or without a guess), show as calculated
    // This works even when IQGuessr is disabled - badges with cached IQ should still be restored
    const cachedRevealed = gameManager.getCachedRevealedIQ ? await gameManager.getCachedRevealedIQ(tweetId) : false;

    if (cachedRevealed) {
      // Try to restore from revealed IQ (tweet-ID-based cache)
      const restored = await restoreFromRevealedIQ(actualTweetElement, outerElement, hasNestedStructure, tweetId, isNotificationsPage, processedTweets);
      if (restored) {
        // Mark as analyzed and return early (skip calculation and all other processing)
        const { markAsAnalyzed } = getNestedTweetHandler();
        markAsAnalyzed(actualTweetElement, outerElement, hasNestedStructure, processedTweets);
        actualTweetElement.removeAttribute('data-iq-processing');
        actualTweetElement.removeAttribute('data-iq-processing-start');
        return true;
      }
    }

    // SECOND: Try to restore from cached guess + handle-based IQ cache
    // Only do this when IQGuessr is enabled (otherwise no guess badges should be shown)
    if (isGameModeEnabled) {
      const restored = await restoreFromCachedGuess(actualTweetElement, outerElement, hasNestedStructure, tweetId, handle, isNotificationsPage, processedTweets);
      if (restored) {
        // Mark as analyzed and return early (skip calculation and all other processing)
        const { markAsAnalyzed } = getNestedTweetHandler();
        markAsAnalyzed(actualTweetElement, outerElement, hasNestedStructure, processedTweets);
        actualTweetElement.removeAttribute('data-iq-processing');
        actualTweetElement.removeAttribute('data-iq-processing-start');
        return true;
      }
    }

    return false;
  }

  // Export for use in other modules
  if (typeof window !== 'undefined') {
    window.BadgeRestoration = {
      tryRestoreBadge,
      restoreFromRevealedIQ,
      restoreFromCachedGuess,
      placeRestoredBadge
    };
  }
})();

