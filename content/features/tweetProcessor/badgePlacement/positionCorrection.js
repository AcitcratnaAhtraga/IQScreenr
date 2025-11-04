/**
 * Badge Position Correction
 * Ensures badges are in the correct position, especially for notification pages
 */

(function() {
  'use strict';

  const getNotificationPlacement = () => window.NotificationBadgePlacement || {};

  /**
   * Ensure badge is in correct position for notification tweets
   * Returns true if badge was repositioned
   *
   * @param {HTMLElement} badge - The badge element
   * @param {HTMLElement} tweetElement - The tweet element
   * @param {boolean} isNotificationsPage - Whether we're on the notifications page
   * @returns {boolean} - True if badge was repositioned
   */
  function ensureCorrectBadgePosition(badge, tweetElement, isNotificationsPage) {
    if (!isNotificationsPage || !badge || !badge.parentElement) {
      return false;
    }

    const { findNotificationBadgePlacement } = getNotificationPlacement();
    if (!findNotificationBadgePlacement) {
      return false;
    }

    // Find where the badge should be
    const placement = findNotificationBadgePlacement(tweetElement);
    if (!placement) {
      return false; // Can't determine correct placement
    }

    const { targetElement, parentElement } = placement;

    // Check if badge is already in the correct location
    const currentParent = badge.parentElement;
    const isInCorrectParent = currentParent === parentElement;

    // Check if badge is in engagement bar (definitely wrong location)
    const engagementBar = badge.closest('[role="group"]');
    const isInEngagementBar = !!engagementBar;

    // Check if badge is positioned correctly relative to target element
    let isPositionedCorrectly = false;
    if (isInCorrectParent) {
      const siblings = Array.from(parentElement.children);
      const badgeIndex = siblings.indexOf(badge);
      const targetIndex = siblings.indexOf(targetElement);

      if (placement.placement === 'before-tweet-content') {
        // Badge should be right before target element
        isPositionedCorrectly = (badgeIndex === targetIndex - 1) || badgeIndex === targetIndex;
      } else {
        // Badge should be right after target element
        isPositionedCorrectly = badgeIndex === targetIndex + 1;
      }
    }

    // If badge is in engagement bar or not positioned correctly, move it
    if (isInEngagementBar || !isInCorrectParent || !isPositionedCorrectly) {
      // Remove from current location
      if (badge.parentElement) {
        badge.remove();
      }

      // Place in correct location - ALWAYS ensure badge appears on its own line
      if (placement.placement === 'before-tweet-content') {
        // Ensure we're inserting before the target, not replacing it
        if (parentElement.contains(targetElement)) {
          parentElement.insertBefore(badge, targetElement);
        } else {
          // Target not in parent anymore, append
          parentElement.appendChild(badge);
        }
        // Force block-level display
        badge.style.setProperty('display', 'block', 'important');
        badge.style.setProperty('width', '100%', 'important');
      } else {
        // After notification text/div/block - ensure block-level placement
        let insertionParent = parentElement;
        let insertionPoint = targetElement;

        // If targetElement is inline (span), find its block-level parent
        if (targetElement.tagName === 'SPAN') {
          let blockParent = targetElement.parentElement;
          while (blockParent && blockParent !== tweetElement) {
            const computedStyle = window.getComputedStyle(blockParent);
            const display = computedStyle.display;
            if (display === 'block' || display === 'flex' || display === 'grid' ||
                blockParent.tagName === 'DIV' || blockParent.tagName === 'ARTICLE') {
              insertionParent = blockParent;
              insertionPoint = blockParent;

              // Look for next sibling to insert before
              let nextSibling = blockParent.nextElementSibling;
              if (nextSibling) {
                insertionPoint = nextSibling;
              }
              break;
            }
            blockParent = blockParent.parentElement;
          }
        }

        // Insert badge to force it on a new line
        if (insertionPoint !== targetElement && insertionPoint.parentElement) {
          insertionPoint.parentElement.insertBefore(badge, insertionPoint);
        } else if (parentElement.contains(targetElement)) {
          if (targetElement.nextSibling) {
            parentElement.insertBefore(badge, targetElement.nextSibling);
          } else {
            parentElement.appendChild(badge);
          }
        } else {
          parentElement.appendChild(badge);
        }

        // Force badge to display as block to ensure it's on its own line
        badge.style.setProperty('display', 'block', 'important');
        badge.style.setProperty('width', '100%', 'important');
      }

      return true;
    }

    return false;
  }

  // Export
  if (typeof window !== 'undefined') {
    window.BadgePositionCorrection = {
      ensureCorrectBadgePosition
    };
  }
})();

