/**
 * Follow Notification Filter
 * Detects and filters out follow notifications to prevent badge processing
 */

(function() {
  'use strict';

  /**
   * Check if a tweet element is a follow notification
   * Follow notifications don't have tweet content, only notification text
   *
   * @param {HTMLElement} tweetElement - The tweet element to check
   * @returns {boolean} - True if this is a follow notification without tweet content
   */
  function isFollowNotification(tweetElement) {
    if (!tweetElement) {
      return false;
    }

    // Check for follow notification text
    const allSpans = Array.from(tweetElement.querySelectorAll('span'));
    const allDivs = Array.from(tweetElement.querySelectorAll('div'));
    const allTextElements = [...allSpans, ...allDivs];

    const followNotificationText = allTextElements.find(element => {
      const text = (element.textContent || '').toLowerCase();
      return text.includes('followed you') ||
             text.includes('follows you') ||
             text.includes('started following') ||
             text.includes('following you');
    });

    // If we found follow notification text, check if there's actual tweet content
    if (followNotificationText) {
      const hasTweetContent = tweetElement.querySelector('div[data-testid="tweetText"]') ||
                              tweetElement.querySelector('div[lang]');

      // If it's a follow notification without tweet content, return true
      return !hasTweetContent;
    }

    return false;
  }

  /**
   * Remove badges from a follow notification and mark it as analyzed
   *
   * @param {HTMLElement} actualTweetElement - The actual tweet element
   * @param {HTMLElement} tweetElement - The outer tweet element (for nested structures)
   * @param {boolean} hasNestedStructure - Whether there's a nested structure
   */
  function skipFollowNotification(actualTweetElement, tweetElement, hasNestedStructure) {
    // Remove any existing badges that might have been added
    const existingBadge = actualTweetElement.querySelector('.iq-badge');
    if (existingBadge && existingBadge.parentElement) {
      existingBadge.remove();
    }

    // Also check outer wrapper for nested structures
    if (hasNestedStructure) {
      const outerBadge = tweetElement.querySelector('.iq-badge');
      if (outerBadge && outerBadge.parentElement) {
        outerBadge.remove();
      }
    }

    // Mark as analyzed to prevent further processing
    actualTweetElement.setAttribute('data-iq-analyzed', 'true');
    if (hasNestedStructure) {
      tweetElement.setAttribute('data-iq-analyzed', 'true');
    }
  }

  // Export
  if (typeof window !== 'undefined') {
    window.FollowNotificationFilter = {
      isFollowNotification,
      skipFollowNotification
    };
  }
})();

