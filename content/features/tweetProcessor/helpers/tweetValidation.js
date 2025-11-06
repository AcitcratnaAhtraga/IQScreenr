/**
 * Tweet Validation Helper
 * Handles tweet text extraction, validation, and invalid badge creation
 */

(function() {
  'use strict';

  // Get dependencies from other modules
  const getTextExtraction = () => window.TextExtraction || {};
  const getTweetDetection = () => window.TweetDetection || {};
  const getBadgeManager = () => window.BadgeManager || {};
  const getSettings = () => window.Settings || {};
  const getNotificationPlacement = () => window.NotificationBadgePlacement || {};
  const getNestedTweetHandler = () => window.NestedTweetHandler || {};

  /**
   * Extract and validate tweet text
   * Returns validation result with text and metadata
   *
   * @param {HTMLElement} actualTweetElement - The actual tweet element
   * @param {HTMLElement} outerElement - The outer wrapper element (if nested)
   * @param {boolean} hasNestedStructure - Whether this is a nested structure
   * @returns {Object} Object containing:
   *   - text: The extracted tweet text (or null)
   *   - handle: The tweet handle (or null)
   *   - tweetId: The tweet ID (or null)
   *   - isValid: Whether the tweet text is valid
   *   - validationReason: Reason for invalidation (if invalid)
   */
  function extractAndValidateTweetText(actualTweetElement, outerElement, hasNestedStructure) {
    const { extractTweetText, extractTweetHandle, extractTweetId, removeUrlsFromText } = getTextExtraction();
    const { validateTweetText } = getTweetDetection();

    // Extract tweet ID early - declare it here so it's available throughout
    let tweetId = actualTweetElement.getAttribute('data-tweet-id');
    if (!tweetId && extractTweetId) {
      tweetId = extractTweetId(actualTweetElement);
      if (tweetId) {
        actualTweetElement.setAttribute('data-tweet-id', tweetId);
      }
    }

    // Extract handle early for game mode
    let handle = extractTweetHandle(actualTweetElement);
    if (handle) {
      actualTweetElement.setAttribute('data-handle', handle);
    }

    let tweetText = extractTweetText(actualTweetElement);

    // Apply URL removal explicitly here as a safety measure
    // (extractTweetText should already do this, but ensure it happens)
    if (tweetText && removeUrlsFromText) {
      tweetText = removeUrlsFromText(tweetText);
    }

    if (!tweetText) {
      return {
        text: null,
        handle: handle,
        tweetId: tweetId,
        isValid: false,
        validationReason: 'No text found'
      };
    }

    const validation = validateTweetText(tweetText);
    return {
      text: tweetText,
      handle: handle,
      tweetId: tweetId,
      isValid: validation.isValid,
      validationReason: validation.reason || null
    };
  }

  /**
   * Check if element looks like a real tweet
   *
   * @param {HTMLElement} actualTweetElement - The actual tweet element
   * @returns {boolean} Whether the element looks like a tweet
   */
  function looksLikeTweet(actualTweetElement) {
    const hasTweetTextElement = !!actualTweetElement.querySelector('[data-testid="tweetText"]');
    const hasEngagementBar = !!actualTweetElement.querySelector('[role="group"]');
    return hasTweetTextElement || hasEngagementBar;
  }

  /**
   * Create or transition to invalid badge
   * Handles both creating new invalid badges and transitioning existing badges
   *
   * @param {HTMLElement} actualTweetElement - The actual tweet element
   * @param {HTMLElement} outerElement - The outer wrapper element (if nested)
   * @param {boolean} hasNestedStructure - Whether this is a nested structure
   * @param {boolean} isNotificationsPage - Whether we're on the notifications page
   * @returns {HTMLElement|null} The invalid badge element (or null if creation failed)
   */
  function createOrTransitionInvalidBadge(actualTweetElement, outerElement, hasNestedStructure, isNotificationsPage) {
    const settings = getSettings();
    if (!settings.showIQBadge) {
      return null;
    }

    const badgeManager = getBadgeManager();
    const { createInvalidBadge } = badgeManager || {};
    if (!createInvalidBadge) {
      return null;
    }

    const { findExistingBadge } = getNestedTweetHandler();
    const { getPlacementTarget } = getNestedTweetHandler();
    const { findNotificationBadgePlacement } = getNotificationPlacement() || {};

    // Get or transition existing badge instead of creating new one
    // Check both nested and outer wrapper for nested structures
    let invalidBadge = findExistingBadge(actualTweetElement, outerElement, hasNestedStructure);

    if (invalidBadge) {
      // Transition existing badge to invalid state
      invalidBadge.innerHTML = `
        <div class="iq-badge-inner">
          <div class="iq-badge-front">
            <span class="iq-label">IQ</span>
            <span class="iq-score">✕</span>
          </div>
          <div class="iq-badge-back">
            <span class="iq-label">NO</span>
            <span class="iq-score">text</span>
          </div>
        </div>
      `;
      invalidBadge.className = 'iq-badge iq-badge-invalid iq-badge-flip';
      invalidBadge.setAttribute('data-iq-invalid', 'true');
      invalidBadge.removeAttribute('data-iq-loading');
      invalidBadge.removeAttribute('data-iq-score');
      invalidBadge.style.setProperty('background-color', '#000000', 'important');
      invalidBadge.style.setProperty('color', '#9e9e9e', 'important');
      invalidBadge.style.setProperty('cursor', 'help', 'important');

      // Ensure badge is in DOM (use appropriate element based on where badge is)
      if (!invalidBadge.parentElement) {
        const targetElement = hasNestedStructure && !actualTweetElement.contains(invalidBadge)
          ? outerElement
          : actualTweetElement;

        if (isNotificationsPage && findNotificationBadgePlacement) {
          const placement = findNotificationBadgePlacement(targetElement);
          if (placement) {
            const { targetElement: placementTarget, parentElement } = placement;
            if (placement.placement === 'before-tweet-content') {
              parentElement.insertBefore(invalidBadge, placementTarget);
            } else {
              if (placementTarget.nextSibling) {
                parentElement.insertBefore(invalidBadge, placementTarget.nextSibling);
              } else {
                parentElement.appendChild(invalidBadge);
              }
            }
          } else {
            targetElement.insertBefore(invalidBadge, targetElement.firstChild);
          }
        } else {
          const engagementBar = targetElement.querySelector('[role="group"]');
          if (engagementBar) {
            const firstChild = engagementBar.firstElementChild;
            if (firstChild) {
              engagementBar.insertBefore(invalidBadge, firstChild);
            } else {
              engagementBar.appendChild(invalidBadge);
            }
          } else {
            const tweetContent = targetElement.querySelector('div[data-testid="tweetText"]') ||
                                targetElement.querySelector('div[lang]') ||
                                targetElement.firstElementChild;
            if (tweetContent && tweetContent.parentElement) {
              tweetContent.parentElement.insertBefore(invalidBadge, tweetContent);
            } else {
              targetElement.insertBefore(invalidBadge, targetElement.firstChild);
            }
          }
        }
      }
    } else {
      // No existing badge, create new invalid badge
      invalidBadge = createInvalidBadge();
      // For nested structures on notifications page, use outer wrapper for placement
      const targetElement = getPlacementTarget(actualTweetElement, outerElement, hasNestedStructure, isNotificationsPage);

      if (isNotificationsPage && findNotificationBadgePlacement) {
        const placement = findNotificationBadgePlacement(targetElement);
        if (placement) {
          const { targetElement: placementTarget, parentElement } = placement;
          if (placement.placement === 'before-tweet-content') {
            parentElement.insertBefore(invalidBadge, placementTarget);
          } else {
            if (placementTarget.nextSibling) {
              parentElement.insertBefore(invalidBadge, placementTarget.nextSibling);
            } else {
              parentElement.appendChild(invalidBadge);
            }
          }
        } else {
          targetElement.insertBefore(invalidBadge, targetElement.firstChild);
        }
      } else {
        const engagementBar = targetElement.querySelector('[role="group"]');
        if (engagementBar) {
          const firstChild = engagementBar.firstElementChild;
          if (firstChild) {
            engagementBar.insertBefore(invalidBadge, firstChild);
          } else {
            engagementBar.appendChild(invalidBadge);
          }
        } else {
          const tweetContent = targetElement.querySelector('div[data-testid="tweetText"]') ||
                              targetElement.querySelector('div[lang]') ||
                              targetElement.firstElementChild;
          if (tweetContent && tweetContent.parentElement) {
            tweetContent.parentElement.insertBefore(invalidBadge, tweetContent);
          } else {
            targetElement.insertBefore(invalidBadge, targetElement.firstChild);
          }
        }
      }
    }

    return invalidBadge;
  }

  /**
   * Handle age-restricted content by removing badge
   *
   * @param {HTMLElement} actualTweetElement - The actual tweet element
   * @param {HTMLElement} outerElement - The outer wrapper element (if nested)
   * @param {boolean} hasNestedStructure - Whether this is a nested structure
   */
  function handleAgeRestrictedContent(actualTweetElement, outerElement, hasNestedStructure) {
    const { findExistingBadge } = getNestedTweetHandler();
    const existingBadge = findExistingBadge(actualTweetElement, outerElement, hasNestedStructure);
    if (existingBadge) {
      existingBadge.remove();
    }
  }

  /**
   * Check if badge is a valid completed badge
   *
   * @param {HTMLElement} badge - The badge element to check
   * @returns {Object} Object containing badge state flags:
   *   - isGuessBadge: Whether it's a guess badge
   *   - hasScore: Whether it has a calculated score
   *   - isInvalid: Whether it's marked as invalid
   *   - isNotLoading: Whether it's not in loading state
   */
  function checkBadgeState(badge) {
    if (!badge) {
      return {
        isGuessBadge: false,
        hasScore: false,
        isInvalid: false,
        isNotLoading: false
      };
    }

    const isGuessBadge = badge.classList.contains('iq-badge-guess') ||
                        badge.hasAttribute('data-iq-guess');
    const hasScore = badge.hasAttribute('data-iq-score');
    const isInvalid = badge.hasAttribute('data-iq-invalid');
    const isNotLoading = !badge.hasAttribute('data-iq-loading') &&
                        !badge.classList.contains('iq-badge-loading');

    return {
      isGuessBadge,
      hasScore,
      isInvalid,
      isNotLoading
    };
  }

  // Export for use in other modules
  if (typeof window !== 'undefined') {
    window.TweetValidation = {
      extractAndValidateTweetText,
      looksLikeTweet,
      createOrTransitionInvalidBadge,
      handleAgeRestrictedContent,
      checkBadgeState
    };
  }
})();



