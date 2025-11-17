/**
 * Centralized Badge Cleanup Utility
 * Consolidates all badge cleanup logic to eliminate duplication
 */

(function() {
  'use strict';

  /**
   * Find nested tweet structure
   * @param {HTMLElement} tweetElement - The tweet element
   * @returns {Object} Object with actualTweetElement and nestedTweet info
   */
  function findNestedStructure(tweetElement) {
    const nestedTweet = tweetElement.querySelector('article[data-testid="tweet"]') ||
                        tweetElement.querySelector('article[role="article"]');
    const hasNestedStructure = nestedTweet && nestedTweet !== tweetElement;
    const actualTweetElement = hasNestedStructure ? nestedTweet : tweetElement;
    
    return {
      actualTweetElement,
      nestedTweet: hasNestedStructure ? nestedTweet : null,
      outerElement: hasNestedStructure ? tweetElement : null,
      hasNestedStructure
    };
  }

  /**
   * Remove all loading badges from a tweet
   * @param {HTMLElement} tweetElement - The tweet element
   * @param {HTMLElement} [actualTweetElement] - The actual tweet element (if nested)
   * @returns {number} Number of badges removed
   */
  function removeAllLoadingBadges(tweetElement, actualTweetElement) {
    const structure = actualTweetElement ? 
      { actualTweetElement, hasNestedStructure: tweetElement !== actualTweetElement, outerElement: tweetElement } :
      findNestedStructure(tweetElement);
    
    const { actualTweetElement: actual, outerElement, hasNestedStructure } = structure;
    
    // Find all loading badges in both outer and nested tweet elements
    const allLoadingBadges = [
      ...actual.querySelectorAll('.iq-badge-loading'),
      ...actual.querySelectorAll('[data-iq-loading="true"]'),
      ...(hasNestedStructure && outerElement ? [
        ...outerElement.querySelectorAll('.iq-badge-loading'),
        ...outerElement.querySelectorAll('[data-iq-loading="true"]')
      ] : [])
    ].filter((badge, index, self) =>
      // Remove duplicates from the array itself
      index === self.findIndex(b => b === badge)
    );

    // Remove all loading badges
    let removedCount = 0;
    allLoadingBadges.forEach(badge => {
      if (badge.parentElement) {
        badge.remove();
        removedCount++;
      }
    });

    return removedCount;
  }

  /**
   * Remove all guess badges from a tweet
   * @param {HTMLElement} tweetElement - The tweet element
   * @param {HTMLElement} [actualTweetElement] - The actual tweet element (if nested)
   * @returns {number} Number of badges removed
   */
  function removeAllGuessBadges(tweetElement, actualTweetElement) {
    const structure = actualTweetElement ? 
      { actualTweetElement, hasNestedStructure: tweetElement !== actualTweetElement, outerElement: tweetElement } :
      findNestedStructure(tweetElement);
    
    const { actualTweetElement: actual, outerElement, hasNestedStructure } = structure;
    
    // Find all guess badges in both outer and nested tweet elements
    const allGuessBadges = [
      ...actual.querySelectorAll('.iq-badge-guess'),
      ...actual.querySelectorAll('[data-iq-guess="true"]'),
      ...(hasNestedStructure && outerElement ? [
        ...outerElement.querySelectorAll('.iq-badge-guess'),
        ...outerElement.querySelectorAll('[data-iq-guess="true"]')
      ] : [])
    ].filter((badge, index, self) =>
      index === self.findIndex(b => b === badge)
    );

    // Remove all guess badges
    let removedCount = 0;
    allGuessBadges.forEach(badge => {
      if (badge.parentElement) {
        badge.remove();
        removedCount++;
      }
    });

    return removedCount;
  }

  /**
   * Remove duplicate badges, keeping only one based on priority
   * Priority: calculated > guess > loading > others
   * @param {HTMLElement} tweetElement - The tweet element
   * @param {HTMLElement} [actualTweetElement] - The actual tweet element (if nested)
   * @param {HTMLElement} [outerElement] - The outer wrapper element (if nested)
   * @param {boolean} [hasNestedStructure] - Whether this is a nested structure
   * @returns {HTMLElement|null} The badge that was kept, or null if none
   */
  function removeDuplicateBadges(tweetElement, actualTweetElement, outerElement, hasNestedStructure) {
    const structure = actualTweetElement ? 
      { actualTweetElement, outerElement, hasNestedStructure } :
      findNestedStructure(tweetElement);
    
    const { actualTweetElement: actual, outerElement: outer, hasNestedStructure: nested } = structure;
    
    // Collect all badges
    const allBadgesInActual = actual.querySelectorAll('.iq-badge');
    const allBadgesInOuter = nested && outer ? outer.querySelectorAll('.iq-badge') : [];
    const allBadges = [...allBadgesInActual, ...allBadgesInOuter];
    
    if (allBadges.length <= 1) {
      return allBadges[0] || null;
    }

    // Categorize badges by type
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
   * Cleanup duplicate guess badges in a tweet, keeping only one
   * Prioritizes badges that have been interacted with (data-iq-guessed)
   * @param {HTMLElement} tweetElement - The tweet element
   * @returns {HTMLElement|null} The badge that was kept, or null if none
   */
  function cleanupDuplicateGuessBadges(tweetElement) {
    if (!tweetElement) {
      return null;
    }

    const structure = findNestedStructure(tweetElement);
    const { actualTweetElement, nestedTweet, outerElement, hasNestedStructure } = structure;

    // Find all guess badges in both outer and nested tweet elements
    const allGuessBadges = [
      ...actualTweetElement.querySelectorAll('.iq-badge[data-iq-guess="true"]'),
      ...actualTweetElement.querySelectorAll('.iq-badge-guess'),
      ...actualTweetElement.querySelectorAll('[data-iq-guess="true"]'),
      ...(hasNestedStructure && outerElement ? [
        ...outerElement.querySelectorAll('.iq-badge[data-iq-guess="true"]'),
        ...outerElement.querySelectorAll('.iq-badge-guess'),
        ...outerElement.querySelectorAll('[data-iq-guess="true"]')
      ] : [])
    ].filter((badge, index, self) =>
      // Remove duplicates from the array itself
      index === self.findIndex(b => b === badge)
    );

    // If we have duplicates, keep only one
    if (allGuessBadges.length > 1) {
      // Prioritize badge that has been interacted with (user typed in a guess)
      const interactedBadge = allGuessBadges.find(badge => badge.hasAttribute('data-iq-guessed'));

      // If no interacted badge, prioritize the first one in DOM order
      const badgeToKeep = interactedBadge || allGuessBadges[0];

      // Remove all others
      for (const badge of allGuessBadges) {
        if (badge !== badgeToKeep) {
          // Double-check it's actually a duplicate (same tweet)
          const badgeTweet = badge.closest('article[data-testid="tweet"]') ||
                            badge.closest('article[role="article"]') ||
                            badge.closest('article');
          const badgeTweetId = badgeTweet?.getAttribute('data-tweet-id');
          const actualTweetId = actualTweetElement?.getAttribute('data-tweet-id');

          // Only remove if it's on the same tweet
          if (!badgeTweetId || !actualTweetId || badgeTweetId === actualTweetId) {
            if (badge.parentElement) {
              badge.remove();
            }
          }
        }
      }

      return badgeToKeep;
    }

    return allGuessBadges.length > 0 ? allGuessBadges[0] : null;
  }

  /**
   * Remove all badges of a specific type from a tweet
   * @param {HTMLElement} tweetElement - The tweet element
   * @param {string} badgeType - Type of badge to remove ('loading', 'guess', 'all')
   * @param {HTMLElement} [actualTweetElement] - The actual tweet element (if nested)
   * @returns {number} Number of badges removed
   */
  function removeBadgesByType(tweetElement, badgeType, actualTweetElement) {
    switch (badgeType) {
      case 'loading':
        return removeAllLoadingBadges(tweetElement, actualTweetElement);
      case 'guess':
        return removeAllGuessBadges(tweetElement, actualTweetElement);
      case 'all':
        const structure = actualTweetElement ? 
          { actualTweetElement, hasNestedStructure: tweetElement !== actualTweetElement, outerElement: tweetElement } :
          findNestedStructure(tweetElement);
        const { actualTweetElement: actual, outerElement, hasNestedStructure } = structure;
        const allBadges = [
          ...actual.querySelectorAll('.iq-badge'),
          ...(hasNestedStructure && outerElement ? outerElement.querySelectorAll('.iq-badge') : [])
        ];
        let removedCount = 0;
        allBadges.forEach(badge => {
          if (badge.parentElement) {
            badge.remove();
            removedCount++;
          }
        });
        return removedCount;
      default:
        return 0;
    }
  }

  // Export for use in other modules
  if (typeof window !== 'undefined') {
    window.BadgeCleanupUtils = {
      findNestedStructure,
      removeAllLoadingBadges,
      removeAllGuessBadges,
      removeDuplicateBadges,
      cleanupDuplicateGuessBadges,
      removeBadgesByType
    };
  }
})();

