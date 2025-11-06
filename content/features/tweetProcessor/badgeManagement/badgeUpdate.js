/**
 * Badge Update Manager
 * Handles updating badges with IQ estimation results
 */

(function() {
  'use strict';

  // Get dependencies from other modules
  const getBadgeManager = () => window.BadgeManager || {};
  const getGameManager = () => window.GameManager || {};
  const getSettings = () => window.Settings || {};
  const getBadgePositionCorrection = () => window.BadgePositionCorrection || {};
  const getNotificationPlacement = () => window.NotificationBadgePlacement || {};
  const getNestedTweetHandler = () => window.NestedTweetHandler || {};

  /**
   * Ensure badge is in DOM and properly positioned
   *
   * @param {HTMLElement} loadingBadge - The loading badge element
   * @param {HTMLElement} actualTweetElement - The actual tweet element
   * @param {HTMLElement} outerElement - The outer wrapper element (if nested)
   * @param {boolean} hasNestedStructure - Whether this is a nested structure
   * @param {boolean} isNotificationsPage - Whether we're on the notifications page
   */
  function ensureBadgeInDOM(loadingBadge, actualTweetElement, outerElement, hasNestedStructure, isNotificationsPage) {
    if (!loadingBadge || loadingBadge.parentElement) {
      return;
    }

    const { findNotificationBadgePlacement } = getNotificationPlacement() || {};
    const { getPlacementTarget } = getNestedTweetHandler();

    // Re-insert badge into DOM before transitioning
    if (isNotificationsPage) {
      // For nested structures, use outer wrapper for placement
      const placementTarget = getPlacementTarget(actualTweetElement, outerElement, hasNestedStructure, isNotificationsPage);
      const placement = findNotificationBadgePlacement ? findNotificationBadgePlacement(placementTarget) : null;
      if (placement) {
        const { targetElement, parentElement } = placement;
        if (placement.placement === 'before-tweet-content') {
          parentElement.insertBefore(loadingBadge, targetElement);
        } else {
          if (targetElement.nextSibling) {
            parentElement.insertBefore(loadingBadge, targetElement.nextSibling);
          } else {
            parentElement.appendChild(loadingBadge);
          }
        }
      } else {
        placementTarget.insertBefore(loadingBadge, placementTarget.firstChild);
      }
    } else {
      const targetElement = hasNestedStructure && outerElement ? outerElement : actualTweetElement;
      const engagementBar = targetElement.querySelector('[role="group"]');
      if (engagementBar) {
        const firstChild = engagementBar.firstElementChild;
        if (firstChild) {
          engagementBar.insertBefore(loadingBadge, firstChild);
        } else {
          engagementBar.appendChild(loadingBadge);
        }
      } else {
        const tweetContent = targetElement.querySelector('div[data-testid="tweetText"]') ||
                            targetElement.querySelector('div[lang]') ||
                            targetElement.firstElementChild;
        if (tweetContent && tweetContent.parentElement) {
          tweetContent.parentElement.insertBefore(loadingBadge, tweetContent);
        } else {
          targetElement.insertBefore(loadingBadge, targetElement.firstChild);
        }
      }
    }
  }

  /**
   * Ensure badge position is correct for notification pages
   *
   * @param {HTMLElement} loadingBadge - The loading badge element
   * @param {HTMLElement} actualTweetElement - The actual tweet element
   * @param {HTMLElement} outerElement - The outer wrapper element (if nested)
   * @param {boolean} hasNestedStructure - Whether this is a nested structure
   * @param {boolean} isNotificationsPage - Whether we're on the notifications page
   */
  function ensureBadgePosition(loadingBadge, actualTweetElement, outerElement, hasNestedStructure, isNotificationsPage) {
    if (!isNotificationsPage || !loadingBadge) {
      return;
    }

    const { ensureCorrectBadgePosition } = getBadgePositionCorrection() || {};
    if (!ensureCorrectBadgePosition) {
      return;
    }

    // Use outer wrapper for nested structures
    const positionCheckTarget = hasNestedStructure && outerElement ? outerElement : actualTweetElement;

    // Immediately fix position
    ensureCorrectBadgePosition(loadingBadge, positionCheckTarget, isNotificationsPage);

    // Use multiple checks to ensure position stays correct during animation
    // Check immediately after next frame
    requestAnimationFrame(() => {
      ensureCorrectBadgePosition(loadingBadge, positionCheckTarget, isNotificationsPage);
    });

    // Check after short delay
    setTimeout(() => {
      ensureCorrectBadgePosition(loadingBadge, positionCheckTarget, isNotificationsPage);
    }, 50);

    // Final check after DOM settles
    setTimeout(() => {
      ensureCorrectBadgePosition(loadingBadge, positionCheckTarget, isNotificationsPage);
    }, 200);
  }

  /**
   * Handle guess badge case (store result but don't reveal)
   *
   * @param {HTMLElement} loadingBadge - The loading badge element
   * @param {HTMLElement} actualTweetElement - The actual tweet element
   * @param {number} iq - The IQ score
   * @param {Object} result - The IQ estimation result
   * @param {number|null} confidence - The confidence score
   * @param {string} tweetText - The tweet text
   * @param {string} tweetId - The tweet ID
   */
  function handleGuessBadge(loadingBadge, actualTweetElement, iq, result, confidence, tweetText, tweetId) {
    // Store the result on the tweet element for later use when user guesses
    actualTweetElement._iqResult = {
      iq: iq,
      result: result,
      confidence: confidence,
      text: tweetText
    };

    // Cache as revealed immediately - once IQ is calculated, it should never allow guessing again
    const gameManager = getGameManager();
    if (tweetId && gameManager && gameManager.cacheRevealedIQ) {
      gameManager.cacheRevealedIQ(tweetId);
    }
  }

  /**
   * Update badge with IQ result (normal flow or game mode reveal)
   *
   * @param {HTMLElement} loadingBadge - The loading badge element
   * @param {HTMLElement} actualTweetElement - The actual tweet element
   * @param {HTMLElement} outerElement - The outer wrapper element (if nested)
   * @param {boolean} hasNestedStructure - Whether this is a nested structure
   * @param {boolean} isNotificationsPage - Whether we're on the notifications page
   * @param {number} iq - The IQ score
   * @param {Object} result - The IQ estimation result
   * @param {number|null} confidence - The confidence score
   * @param {string} tweetText - The tweet text
   * @param {string} tweetId - The tweet ID
   */
  async function updateBadgeWithIQ(loadingBadge, actualTweetElement, outerElement, hasNestedStructure, isNotificationsPage, iq, result, confidence, tweetText, tweetId) {
    const settings = getSettings();
    const badgeManager = getBadgeManager();
    const gameManager = getGameManager();
    const { getIQColor, getConfidenceColor, animateCountUp, logDebugInfo } = badgeManager || {};

    // CRITICAL: Check IqFiltr IMMEDIATELY after IQ calculation, before any animations or processing
    // This removes elements before they can be displayed or animated
    const getIqFiltr = () => window.IqFiltr || {};
    const { checkAndFilter } = getIqFiltr();
    if (checkAndFilter) {
      // Use the actual tweet element for filtering (or outer element if nested)
      const elementToCheck = (hasNestedStructure && outerElement) ? outerElement : actualTweetElement;
      const wasFiltered = await checkAndFilter(elementToCheck, iq, confidence);
      if (wasFiltered) {
        // Element was removed, stop processing immediately
        return;
      }
    }

    // Track user's average IQ if this is their own tweet
    const getUserAverageIQ = () => window.UserAverageIQ || {};
    const { addIQScore } = getUserAverageIQ();
    if (addIQScore && iq !== null && iq !== undefined && confidence !== null && confidence !== undefined) {
      // Get handle from tweet element
      const handle = actualTweetElement.getAttribute('data-handle');
      if (handle) {
        addIQScore(handle, iq, confidence, tweetId);
      }
    }

    if (!badgeManager || !getIQColor || !animateCountUp) {
      return;
    }

    // Ensure badge is in DOM
    ensureBadgeInDOM(loadingBadge, actualTweetElement, outerElement, hasNestedStructure, isNotificationsPage);

    // Ensure badge position is correct before update
    if (isNotificationsPage && loadingBadge) {
      ensureBadgePosition(loadingBadge, actualTweetElement, outerElement, hasNestedStructure, isNotificationsPage);
    }

    // CRITICAL: Check if badge is still in DOM before proceeding
    if (!document.body.contains(loadingBadge)) {
      return;
    }

    // Check if this is actually a guess badge now
    const isGuessBadge = loadingBadge.classList.contains('iq-badge-guess') ||
                        loadingBadge.hasAttribute('data-iq-guess');

    // If it's a guess badge, we should NOT automatically calculate
    // The user needs to click and guess first
    if (isGuessBadge) {
      handleGuessBadge(loadingBadge, actualTweetElement, iq, result, confidence, tweetText, tweetId);
      return;
    }

    // Use confidence color if setting is enabled, otherwise use IQ color
    const iqColor = (settings.useConfidenceForColor && confidence !== null)
      ? getConfidenceColor(confidence)
      : getIQColor(iq);

    // Check if game mode is enabled and we have a guess
    const guessData = gameManager && gameManager.getGuess ? gameManager.getGuess(actualTweetElement) : null;

    if (guessData && guessData.guess !== undefined) {
      // We have a guess, use the game manager's reveal function
      // Store that this IQ was revealed
      if (tweetId && gameManager && gameManager.cacheRevealedIQ) {
        gameManager.cacheRevealedIQ(tweetId);
      }
      if (gameManager && gameManager.revealActualScore) {
        gameManager.revealActualScore(loadingBadge, iq, iqColor, confidence, result, tweetText);
      }
      return;
    }

    // No guess, proceed with normal animation
    // Store that this IQ was revealed (so it stays calculated after refresh/iqguessr toggle)
    if (tweetId && gameManager && gameManager.cacheRevealedIQ) {
      gameManager.cacheRevealedIQ(tweetId);

      // Also cache the IQ result by tweet ID so it can be restored when IQGuessr is re-enabled
      // This ensures each tweet shows its own correct IQ score instead of falling back to handle-based cache
      if (gameManager.cacheRevealedIQResult) {
        const iqResultData = {
          iq: iq,
          confidence: confidence,
          result: result || {},
          timestamp: new Date().toISOString()
        };
        gameManager.cacheRevealedIQResult(tweetId, iqResultData);
      }
    }

    // CRITICAL: Double-check badge is still in DOM before accessing getBoundingClientRect
    if (!document.body.contains(loadingBadge)) {
      return;
    }

    // Preserve badge dimensions before transition to prevent layout shift
    const badgeRect = loadingBadge.getBoundingClientRect();
    const currentHeight = badgeRect.height;
    const currentWidth = badgeRect.width;

    if (currentHeight > 0 && currentWidth > 0) {
      loadingBadge.style.setProperty('min-height', `${currentHeight}px`, 'important');
      loadingBadge.style.setProperty('min-width', `${currentWidth}px`, 'important');
    }

    loadingBadge.removeAttribute('data-iq-loading');
    loadingBadge.setAttribute('data-iq-score', iq);
    loadingBadge.style.setProperty('cursor', 'help', 'important');

    loadingBadge._animationData = {
      finalIQ: iq,
      iqColor: iqColor
    };

    // For notification pages, store the correct position before animation
    let correctPosition = null;
    if (isNotificationsPage) {
      const { findNotificationBadgePlacement } = getNotificationPlacement() || {};
      const { getPlacementTarget } = getNestedTweetHandler();
      // For nested structures, use outer wrapper for placement
      const placementTarget = getPlacementTarget(actualTweetElement, outerElement, hasNestedStructure, isNotificationsPage);
      const placement = findNotificationBadgePlacement ? findNotificationBadgePlacement(placementTarget) : null;
      if (placement) {
        correctPosition = {
          targetElement: placement.targetElement,
          parentElement: placement.parentElement,
          placement: placement.placement
        };
      }
    }

    // CRITICAL: Final check before animating - badge must be in DOM
    if (!document.body.contains(loadingBadge)) {
      return;
    }

    // CRITICAL: Set data-confidence attribute BEFORE calling animateCountUp
    // animateCountUp checks for this attribute to determine if flip structure is needed
    // If we set it after, the flip structure won't be built and hover won't work
    if (confidence !== null) {
      loadingBadge.setAttribute('data-confidence', confidence);
    }

    // CRITICAL: Check for cached guess even when IQGuessr is disabled
    // This ensures badges that were previously guessed show the white border permanently
    if (tweetId && gameManager && gameManager.getCachedGuess) {
      const cachedGuess = await gameManager.getCachedGuess(tweetId);
      if (cachedGuess && cachedGuess.guess !== undefined) {
        // There's a cached guess, mark badge as compared (will show white border)
        loadingBadge.setAttribute('data-iq-compared', 'true');
      }
    }

    animateCountUp(loadingBadge, iq, iqColor);

    // Immediately after starting animation, ensure position is correct for notification pages
    if (isNotificationsPage && correctPosition) {
      const { getPlacementTarget } = getNestedTweetHandler();
      // Use outer wrapper for nested structures
      const positionCheckTarget = getPlacementTarget(actualTweetElement, outerElement, hasNestedStructure, isNotificationsPage);
      // Fix position immediately after animation frame
      requestAnimationFrame(() => {
        const { ensureCorrectBadgePosition } = getBadgePositionCorrection() || {};
        if (ensureCorrectBadgePosition) {
          ensureCorrectBadgePosition(loadingBadge, positionCheckTarget, isNotificationsPage);
        }
      });

      // Also fix after a short delay to catch any layout shifts
      setTimeout(() => {
        const { ensureCorrectBadgePosition } = getBadgePositionCorrection() || {};
        if (ensureCorrectBadgePosition) {
          ensureCorrectBadgePosition(loadingBadge, positionCheckTarget, isNotificationsPage);
        }
      }, 50);
    }

    // Store the EXACT text that was analyzed
    // Make sure it matches what was passed to estimate()
    const textForDebug = tweetText; // This should be the cleaned text

    loadingBadge._debugData = {
      iq: iq,
      result: result,
      text: textForDebug, // Store the exact analyzed text
      timestamp: new Date().toISOString(),
      analyzedTextLength: tweetText.length, // Store for verification
      analyzedWordCount: tweetText.split(/\s+/).filter(w => w.length > 0).length
    };

    // NOTE: We do NOT call updateBadgeWithFlipStructure here
    // It will be called automatically by animateCountUp when the animation completes
    // Calling it here would interfere with the animation by changing the badge structure

    // Always add hover event listener for console debug info with cooldown to prevent duplicate calls
    if (logDebugInfo) {
      loadingBadge.addEventListener('mouseenter', () => {
        // Prevent duplicate debug log calls within cooldown period
        const now = Date.now();
        const lastDebugLogTime = loadingBadge._lastDebugLogTime || 0;
        const DEBUG_LOG_COOLDOWN = 500; // 500ms cooldown between calls

        if (loadingBadge._debugData && (now - lastDebugLogTime >= DEBUG_LOG_COOLDOWN)) {
          loadingBadge._lastDebugLogTime = now;
          logDebugInfo(loadingBadge._debugData);
        }
      });
    }

    // Remove min-height/min-width after animation settles
    if (currentHeight > 0 && currentWidth > 0) {
      setTimeout(() => {
        requestAnimationFrame(() => {
          if (document.body.contains(loadingBadge)) {
            const newRect = loadingBadge.getBoundingClientRect();
            if (newRect.height >= currentHeight && newRect.width >= currentWidth) {
              loadingBadge.style.removeProperty('min-height');
              loadingBadge.style.removeProperty('min-width');
            } else {
              loadingBadge.style.setProperty('min-height', `${currentHeight}px`, 'important');
              loadingBadge.style.setProperty('min-width', `${currentWidth}px`, 'important');
            }
          }
        });
      }, 100);
    }

    // Ensure position is correct for notification pages
    if (isNotificationsPage) {
      ensureBadgePosition(loadingBadge, actualTweetElement, outerElement, hasNestedStructure, isNotificationsPage);
    }
  }

  // Export for use in other modules
  if (typeof window !== 'undefined') {
    window.BadgeUpdate = {
      updateBadgeWithIQ,
      handleGuessBadge,
      ensureBadgeInDOM,
      ensureBadgePosition
    };
  }
})();

