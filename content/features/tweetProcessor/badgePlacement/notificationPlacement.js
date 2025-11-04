/**
 * Notification Badge Placement
 * Handles finding the correct placement location for badges on notification pages
 */

(function() {
  'use strict';

  /**
   * Find the correct placement location for notification badges
   * Returns the target element and parent where badge should be placed
   * Always places badge BELOW notification text (on a new line) for consistency
   *
   * @param {HTMLElement} tweetElement - The tweet element to find placement for
   * @returns {Object|null} - Placement object with targetElement, parentElement, and placement type, or null
   */
  function findNotificationBadgePlacement(tweetElement) {
    if (!tweetElement) {
      return null;
    }

    // PRIORITY 1: Find tweet content and place badge BEFORE it
    // This ensures badge always appears on its own line, below notification text
    const tweetContent = tweetElement.querySelector('div[data-testid="tweetText"]') ||
                          tweetElement.querySelector('div[lang]');
    if (tweetContent && tweetContent.parentElement) {
      return {
        targetElement: tweetContent,
        parentElement: tweetContent.parentElement,
        placement: 'before-tweet-content'
      };
    }

    // PRIORITY 2: Find notification text in spans, then find its block-level container
    // This ensures badge appears below on a new line
    const allSpans = Array.from(tweetElement.querySelectorAll('span'));
    const notificationText = allSpans.find(span => {
      const text = (span.textContent || '').toLowerCase();
      return text.includes('liked your post') ||
             text.includes('reposted') ||
             text.includes('replied to') ||
             text.includes('quoted your post') ||
             (text.includes('liked') && text.includes('post')) ||
             text.includes('repost');
    });

    if (notificationText) {
      // Find the nearest block-level parent container
      let blockContainer = notificationText.parentElement;
      let current = notificationText.parentElement;

      // Walk up the DOM to find a block-level container (div, article, etc.)
      while (current && current !== tweetElement) {
        const computedStyle = window.getComputedStyle(current);
        const display = computedStyle.display;

        // Check if this is a block-level element
        if (display === 'block' || display === 'flex' || display === 'grid' ||
            current.tagName === 'DIV' || current.tagName === 'ARTICLE' || current.tagName === 'SECTION') {
          blockContainer = current;

          // Look for the next sibling that's the tweet content or a block element
          let nextSibling = current.nextElementSibling;
          while (nextSibling) {
            if (nextSibling.querySelector('div[data-testid="tweetText"]') ||
                nextSibling.querySelector('div[lang]') ||
                nextSibling.tagName === 'DIV') {
              return {
                targetElement: nextSibling,
                parentElement: current.parentElement || current,
                placement: 'before-tweet-content'
              };
            }
            nextSibling = nextSibling.nextElementSibling;
          }
          break;
        }
        current = current.parentElement;
      }

      // If we found a block container, place badge after notification text container
      // But ensure it's wrapped in a block context
      if (blockContainer && blockContainer.parentElement) {
        return {
          targetElement: blockContainer,
          parentElement: blockContainer.parentElement,
          placement: 'after-notification-block'
        };
      }
    }

    // PRIORITY 3: Try divs that contain notification text
    const allDivs = Array.from(tweetElement.querySelectorAll('div'));
    const notificationDiv = allDivs.find(div => {
      const text = (div.textContent || '').toLowerCase();
      return (text.includes('liked your post') ||
              text.includes('reposted') ||
              text.includes('replied to') ||
              text.includes('quoted your post')) &&
             !div.querySelector('article[data-testid="tweet"]'); // Exclude nested tweets
    });

    if (notificationDiv && notificationDiv.parentElement) {
      // Find the next block element after this div (the tweet content)
      let nextSibling = notificationDiv.nextElementSibling;
      while (nextSibling) {
        if (nextSibling.querySelector('div[data-testid="tweetText"]') ||
            nextSibling.querySelector('div[lang]') ||
            nextSibling.tagName === 'DIV') {
          return {
            targetElement: nextSibling,
            parentElement: notificationDiv.parentElement,
            placement: 'before-tweet-content'
          };
        }
        nextSibling = nextSibling.nextElementSibling;
      }

      // If no next sibling, just place after the div in its parent
      return {
        targetElement: notificationDiv,
        parentElement: notificationDiv.parentElement,
        placement: 'after-notification-div'
      };
    }

    return null;
  }

  // Export
  if (typeof window !== 'undefined') {
    window.NotificationBadgePlacement = {
      findNotificationBadgePlacement
    };
  }
})();

