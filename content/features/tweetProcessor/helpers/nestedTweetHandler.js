/**
 * Nested Tweet Handler
 * Utilities for handling nested tweet structures (e.g., notifications page)
 */

(function() {
  'use strict';

  /**
   * Detect and handle nested tweet structures
   * Returns information about the actual tweet element and nested structure status
   *
   * @param {HTMLElement} tweetElement - The tweet element to analyze
   * @returns {Object} Object containing:
   *   - actualTweetElement: The actual tweet element to process
   *   - hasNestedStructure: Whether this is a nested structure
   *   - outerElement: The outer wrapper element (if nested)
   */
  function handleNestedStructure(tweetElement) {
    let actualTweetElement = tweetElement;
    const nestedTweet = tweetElement.querySelector('article[data-testid="tweet"]') ||
                        tweetElement.querySelector('article[role="article"]');
    const hasNestedStructure = nestedTweet && nestedTweet !== tweetElement;

    if (hasNestedStructure) {
      actualTweetElement = nestedTweet;
      // Don't mark outer as analyzed yet - we need to process the nested tweet
      // Only mark outer as analyzed if nested is already analyzed
      if (nestedTweet.hasAttribute('data-iq-analyzed')) {
        tweetElement.setAttribute('data-iq-analyzed', 'true');
      }
    }

    return {
      actualTweetElement,
      hasNestedStructure,
      outerElement: hasNestedStructure ? tweetElement : null
    };
  }

  /**
   * Find existing badges in both nested and outer wrapper elements
   * Handles duplicate badge removal
   *
   * @param {HTMLElement} actualTweetElement - The actual tweet element
   * @param {HTMLElement} outerElement - The outer wrapper element (if nested)
   * @param {boolean} hasNestedStructure - Whether this is a nested structure
   * @returns {HTMLElement|null} The primary badge element (first one found, duplicates removed)
   */
  function findExistingBadge(actualTweetElement, outerElement, hasNestedStructure) {
    // For nested structures, check for badge in both outer wrapper and nested tweet
    // This fixes the issue where badges are placed in outer wrapper but we only search nested tweet
    // Also check for and remove duplicate badges
    const allBadgesInActual = actualTweetElement.querySelectorAll('.iq-badge');
    const allBadgesInOuter = hasNestedStructure && outerElement ? outerElement.querySelectorAll('.iq-badge') : [];

    // Collect all badges
    const allBadges = [...allBadgesInActual, ...allBadgesInOuter];
    
    if (allBadges.length === 0) {
      return null;
    }
    
    if (allBadges.length === 1) {
      return allBadges[0];
    }

    // CRITICAL: If multiple badges found, prioritize guess badges over loading badges
    // In IqGuessr mode, guess badges should always take precedence
    const guessBadges = allBadges.filter(badge => 
      badge.classList.contains('iq-badge-guess') || 
      badge.hasAttribute('data-iq-guess')
    );
    
    const calculatedBadges = allBadges.filter(badge => 
      badge.hasAttribute('data-iq-score') && 
      !badge.hasAttribute('data-iq-guessed')
    );
    
    const loadingBadges = allBadges.filter(badge => 
      badge.classList.contains('iq-badge-loading') || 
      badge.hasAttribute('data-iq-loading')
    );

    // Priority: calculated > guess > loading > others
    let badgeToKeep = null;
    let badgesToRemove = [];
    
    if (calculatedBadges.length > 0) {
      badgeToKeep = calculatedBadges[0];
      badgesToRemove = [...calculatedBadges.slice(1), ...guessBadges, ...loadingBadges, ...allBadges.filter(b => 
        !calculatedBadges.includes(b) && !guessBadges.includes(b) && !loadingBadges.includes(b)
      )];
    } else if (guessBadges.length > 0) {
      badgeToKeep = guessBadges[0];
      badgesToRemove = [...guessBadges.slice(1), ...loadingBadges, ...allBadges.filter(b => 
        !guessBadges.includes(b) && !loadingBadges.includes(b)
      )];
    } else if (loadingBadges.length > 0) {
      badgeToKeep = loadingBadges[0];
      badgesToRemove = [...loadingBadges.slice(1), ...allBadges.filter(b => !loadingBadges.includes(b))];
    } else {
      // Fallback: keep first, remove others
      badgeToKeep = allBadges[0];
      badgesToRemove = allBadges.slice(1);
    }

    // Remove duplicate badges
    badgesToRemove.forEach(badge => {
      if (badge.parentElement && badge !== badgeToKeep) {
        badge.remove();
      }
    });

    return badgeToKeep;
  }

  /**
   * Find all badges in nested structures (for duplicate detection)
   *
   * @param {HTMLElement} actualTweetElement - The actual tweet element
   * @param {HTMLElement} outerElement - The outer wrapper element (if nested)
   * @param {boolean} hasNestedStructure - Whether this is a nested structure
   * @returns {Array<HTMLElement>} Array of all badge elements found
   */
  function findAllBadges(actualTweetElement, outerElement, hasNestedStructure) {
    const allBadgesInActual = actualTweetElement.querySelectorAll('.iq-badge');
    const allBadgesInOuter = hasNestedStructure && outerElement ? outerElement.querySelectorAll('.iq-badge') : [];
    return [...allBadgesInActual, ...allBadgesInOuter];
  }

  /**
   * Get the appropriate target element for badge placement
   * For nested structures on notifications page, use outer wrapper
   *
   * @param {HTMLElement} actualTweetElement - The actual tweet element
   * @param {HTMLElement} outerElement - The outer wrapper element (if nested)
   * @param {boolean} hasNestedStructure - Whether this is a nested structure
   * @param {boolean} isNotificationsPage - Whether we're on the notifications page
   * @returns {HTMLElement} The target element for badge placement
   */
  function getPlacementTarget(actualTweetElement, outerElement, hasNestedStructure, isNotificationsPage) {
    if (hasNestedStructure && isNotificationsPage && outerElement) {
      return outerElement;
    }
    return actualTweetElement;
  }

  /**
   * Mark both nested and outer elements as analyzed
   *
   * @param {HTMLElement} actualTweetElement - The actual tweet element
   * @param {HTMLElement} outerElement - The outer wrapper element (if nested)
   * @param {boolean} hasNestedStructure - Whether this is a nested structure
   * @param {Set} processedTweets - Set of processed tweets to update
   */
  function markAsAnalyzed(actualTweetElement, outerElement, hasNestedStructure, processedTweets) {
    actualTweetElement.setAttribute('data-iq-analyzed', 'true');
    processedTweets.add(actualTweetElement);

    if (hasNestedStructure && outerElement) {
      outerElement.setAttribute('data-iq-analyzed', 'true');
      processedTweets.add(outerElement);
    }
  }

  // Export for use in other modules
  if (typeof window !== 'undefined') {
    window.NestedTweetHandler = {
      handleNestedStructure,
      findExistingBadge,
      findAllBadges,
      getPlacementTarget,
      markAsAnalyzed
    };
  }
})();



