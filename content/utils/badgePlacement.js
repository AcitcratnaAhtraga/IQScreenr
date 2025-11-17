/**
 * Centralized Badge Placement Utility
 * Consolidates all badge placement logic to eliminate duplication
 */

(function() {
  'use strict';

  const Constants = window.Constants || {};
  const SELECTORS = Constants.SELECTORS || {};

  /**
   * Get notification badge placement (for notification pages)
   * @param {HTMLElement} tweetElement - The tweet element
   * @returns {Object|null} Placement object with targetElement, parentElement, and placement type
   */
  function getNotificationPlacement(tweetElement) {
    const getNotificationPlacementModule = () => window.NotificationBadgePlacement || {};
    const { findNotificationBadgePlacement } = getNotificationPlacementModule();
    
    if (findNotificationBadgePlacement) {
      return findNotificationBadgePlacement(tweetElement);
    }
    
    // Fallback implementation
    const tweetContent = tweetElement.querySelector(SELECTORS.TWEET_TEXT || '[data-testid="tweetText"]') ||
                        tweetElement.querySelector('div[lang]');
    if (tweetContent && tweetContent.parentElement) {
      return {
        targetElement: tweetContent,
        parentElement: tweetContent.parentElement,
        placement: 'before-tweet-content'
      };
    }
    
    return null;
  }

  /**
   * Get engagement bar for a tweet element
   * @param {HTMLElement} tweetElement - The tweet element
   * @returns {HTMLElement|null} Engagement bar element
   */
  function getEngagementBar(tweetElement) {
    const domCache = window.DOMCache || {};
    if (domCache.getEngagementBar) {
      return domCache.getEngagementBar(tweetElement);
    }
    return tweetElement.querySelector(SELECTORS.ENGAGEMENT_BAR || '[role="group"]');
  }

  /**
   * Place a badge in the correct location
   * @param {HTMLElement} badge - The badge element to place
   * @param {HTMLElement} actualTweetElement - The actual tweet element
   * @param {HTMLElement} [outerElement] - The outer wrapper element (if nested)
   * @param {boolean} [hasNestedStructure] - Whether this is a nested structure
   * @param {boolean} [isNotificationsPage] - Whether we're on the notifications page
   * @returns {boolean} True if badge was placed successfully
   */
  function placeBadge(badge, actualTweetElement, outerElement, hasNestedStructure, isNotificationsPage) {
    if (!badge || !actualTweetElement) {
      return false;
    }

    // Determine target element for placement
    const getNestedTweetHandler = () => window.NestedTweetHandler || {};
    const { getPlacementTarget } = getNestedTweetHandler();
    
    let targetElement = actualTweetElement;
    if (hasNestedStructure && isNotificationsPage && outerElement && getPlacementTarget) {
      targetElement = getPlacementTarget(actualTweetElement, outerElement, hasNestedStructure, isNotificationsPage);
    } else if (hasNestedStructure && outerElement) {
      targetElement = outerElement;
    }

    try {
      // Notification page placement
      if (isNotificationsPage) {
        const placement = getNotificationPlacement(targetElement);
        if (placement) {
          const { targetElement: placementTarget, parentElement } = placement;
          if (placement.placement === 'before-tweet-content') {
            parentElement.insertBefore(badge, placementTarget);
          } else {
            if (placementTarget.nextSibling) {
              parentElement.insertBefore(badge, placementTarget.nextSibling);
            } else {
              parentElement.appendChild(badge);
            }
          }
          return true;
        }
        // Fallback: place at start of target element
        targetElement.insertBefore(badge, targetElement.firstChild);
        return true;
      }

      // Normal tweet page placement: use engagement bar
      const engagementBar = getEngagementBar(targetElement);
      if (engagementBar) {
        const firstChild = engagementBar.firstElementChild;
        if (firstChild) {
          engagementBar.insertBefore(badge, firstChild);
        } else {
          engagementBar.appendChild(badge);
        }
        return true;
      }

      // Fallback: place before tweet content
      const tweetContent = targetElement.querySelector(SELECTORS.TWEET_TEXT || '[data-testid="tweetText"]') ||
                          targetElement.querySelector('div[lang]') ||
                          targetElement.firstElementChild;
      if (tweetContent && tweetContent.parentElement) {
        tweetContent.parentElement.insertBefore(badge, tweetContent);
        return true;
      }

      // Last resort: place at beginning of target element
      targetElement.insertBefore(badge, targetElement.firstChild);
      return true;
    } catch (error) {
      // Silent fail - placement failed
      return false;
    }
  }

  /**
   * Ensure badge is in DOM and correctly positioned
   * @param {HTMLElement} badge - The badge element
   * @param {HTMLElement} actualTweetElement - The actual tweet element
   * @param {HTMLElement} [outerElement] - The outer wrapper element (if nested)
   * @param {boolean} [hasNestedStructure] - Whether this is a nested structure
   * @param {boolean} [isNotificationsPage] - Whether we're on the notifications page
   * @returns {boolean} True if badge is now in correct position
   */
  function ensureBadgePosition(badge, actualTweetElement, outerElement, hasNestedStructure, isNotificationsPage) {
    if (!badge || !actualTweetElement) {
      return false;
    }

    // If badge is not in DOM, place it
    if (!badge.parentElement) {
      return placeBadge(badge, actualTweetElement, outerElement, hasNestedStructure, isNotificationsPage);
    }

    // Badge is in DOM - verify it's in the correct location
    // For notification pages, check if it needs repositioning
    if (isNotificationsPage) {
      const getBadgePositionCorrection = () => window.BadgePositionCorrection || {};
      const { ensureCorrectBadgePosition } = getBadgePositionCorrection();
      if (ensureCorrectBadgePosition) {
        const targetElement = hasNestedStructure && outerElement ? outerElement : actualTweetElement;
        return ensureCorrectBadgePosition(badge, targetElement, isNotificationsPage);
      }
    }

    return true;
  }

  // Export for use in other modules
  if (typeof window !== 'undefined') {
    window.BadgePlacement = {
      placeBadge,
      ensureBadgePosition,
      getNotificationPlacement,
      getEngagementBar
    };
  }
})();

