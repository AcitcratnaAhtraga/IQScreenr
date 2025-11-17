/**
 * Tweet Processing Core
 * Orchestrates tweet processing by coordinating all specialized modules
 *
 * NOTE: This module has been refactored. Functions have been moved to:
 * - helpers/nestedTweetHandler.js (nested tweet structure handling)
 * - helpers/tweetValidation.js (tweet validation and invalid badge creation)
 * - helpers/textExpansion.js (text expansion for truncated tweets)
 * - badgeManagement/badgeRestoration.js (restore cached badges)
 * - badgeManagement/badgeUpdate.js (update badges with IQ results)
 * - badgeManagement/loadingBadgeManager.js (loading badge creation)
 * - badgeManagement/badgeCleanup.js (stuck badge cleanup)
 * - badgePlacement/notificationPlacement.js (notification badge placement)
 * - badgePlacement/positionCorrection.js (badge position correction)
 * - estimation/iqEstimation.js (IQ estimation and caching)
 * - observers/tweetObserver.js (mutation observer setup)
 * - helpers/processVisibleTweets.js (process visible tweets)
 * - notificationFilters/followNotificationFilter.js (follow notification detection)
 */

(function() {
  'use strict';

  // Get dependencies from other modules (loaded via window global objects)
  const getSettings = () => window.Settings || {};
  const getBadgeManager = () => window.BadgeManager || {};
  const getGameManager = () => window.GameManager || {};
  const getFollowNotificationFilter = () => window.FollowNotificationFilter || {};

  /**
   * Check if a tweet element is a Community Note notification
   * Community Notes notifications contain text like "Community Note" or "Readers added a Community Note"
   */
  function isCommunityNoteNotification(tweetElement) {
    if (!tweetElement) return false;

    // Get all text elements in the notification
    const allSpans = Array.from(tweetElement.querySelectorAll('span'));
    const allDivs = Array.from(tweetElement.querySelectorAll('div'));

    // Check for Community Note notification text
    const communityNoteText = [...allSpans, ...allDivs].find(element => {
      const text = (element.textContent || '').toLowerCase();
      return text.includes('community note') ||
             text.includes('readers added a community note') ||
             (text.includes('community') && text.includes('note'));
    });

    return !!communityNoteText;
  }

  // Get refactored modules
  const getNestedTweetHandler = () => window.NestedTweetHandler || {};
  const getTweetValidation = () => window.TweetValidation || {};
  const getTextExpansion = () => window.TextExpansion || {};
  const getBadgeRestoration = () => window.BadgeRestoration || {};
  const getBadgeUpdate = () => window.BadgeUpdate || {};
  const getIQEstimation = () => window.IQEstimation || {};
  const getLoadingBadgeManager = () => window.LoadingBadgeManager || {};
  const getNotificationPlacement = () => window.NotificationBadgePlacement || {};

  // Local processedTweets set (will be managed by index.js)
  // Keeping for backward compatibility
  const processedTweets = new Set();

  /**
   * Process a single tweet element
   * Orchestrates the entire tweet processing pipeline
   */
  async function processTweet(tweetElement) {
    const settings = getSettings();
    if (!tweetElement || !settings.showIQBadge) {
      return;
    }

    // Debug logging: Log tweet processing start
    const tracker = window.BadgeStateTracker || {};
    if (tracker.logTweetBadgeState) {
      await tracker.logTweetBadgeState(tweetElement, 'process-start');
    }

    const badgeManager = getBadgeManager();
    if (!badgeManager || !badgeManager.createLoadingBadge) {
      return;
    }

    const iqEstimator = window.ComprehensiveIQEstimatorUltimate ? new window.ComprehensiveIQEstimatorUltimate() : null;
    if (!iqEstimator) {
      return;
    }

    // Handle nested tweet structures
    const { handleNestedStructure, findExistingBadge, markAsAnalyzed } = getNestedTweetHandler();
    if (!handleNestedStructure) {
      console.warn('NestedTweetHandler module not loaded');
      return;
    }

    const { actualTweetElement, hasNestedStructure, outerElement } = handleNestedStructure(tweetElement);

    // Check if already analyzed
    if (actualTweetElement.hasAttribute('data-iq-analyzed')) {
      return;
    }

    // Check if tweet was previously removed or muted (skip processing entirely)
    const getIqFiltr = () => window.IqFiltr || {};
    const { shouldSkipTweet } = getIqFiltr();
    if (shouldSkipTweet) {
      // Check both the actual element and outer element for nested structures
      if (shouldSkipTweet(actualTweetElement) || (outerElement && shouldSkipTweet(outerElement))) {
        return;
      }
    }

    // Check if this is a follow notification or Community Note notification and skip processing
    const isNotificationsPage = window.location.href.includes('/notifications');
    if (isNotificationsPage) {
      const { isFollowNotification, skipFollowNotification } = getFollowNotificationFilter();
      if (isFollowNotification && isFollowNotification(actualTweetElement)) {
        skipFollowNotification(actualTweetElement, tweetElement, hasNestedStructure);
        return;
      }

      // Skip Community Notes notifications
      if (isCommunityNoteNotification(actualTweetElement)) {
        actualTweetElement.setAttribute('data-iq-analyzed', 'true');
        if (hasNestedStructure) {
          tweetElement.setAttribute('data-iq-analyzed', 'true');
        }
        // Remove any existing badges
        const existingBadge = actualTweetElement.querySelector('.iq-badge');
        if (existingBadge && existingBadge.parentElement) {
          existingBadge.remove();
        }
        if (hasNestedStructure) {
          const outerBadge = tweetElement.querySelector('.iq-badge');
          if (outerBadge && outerBadge.parentElement) {
            outerBadge.remove();
          }
        }
        return;
      }
    }

    // Check for existing badges and handle duplicates
    const existingBadge = findExistingBadge(actualTweetElement, outerElement, hasNestedStructure);

    // Debug logging: Log existing badge state
    if (tracker.logBadgeStateChange && existingBadge) {
      const badgeState = tracker.getBadgeState ? tracker.getBadgeState(existingBadge) : null;
      tracker.logBadgeStateChange(existingBadge, null, badgeState, 'existing-badge-found');
    }

    // Check badge state
    const { checkBadgeState } = getTweetValidation();
    if (!checkBadgeState) {
      console.warn('TweetValidation module not loaded');
      return;
    }

    const badgeState = checkBadgeState(existingBadge);
    const { isGuessBadge, hasScore, isInvalid, isNotLoading } = badgeState;

    // If badge exists and is a calculated badge (has score), check if we need to restore it in IQGuessr mode
    if (existingBadge && hasScore) {
      // In IQGuessr mode, if this is a calculated badge but no cached guess exists, it should stay calculated
      // (it was calculated when IQGuessr was disabled)
      const gameManagerForCheck = getGameManager();
      const isGameModeForCheck = gameManagerForCheck && gameManagerForCheck.isGameModeEnabled && gameManagerForCheck.isGameModeEnabled();
      if (isGameModeForCheck) {
        const tweetIdForCheck = actualTweetElement.getAttribute('data-tweet-id');
        if (tweetIdForCheck) {
          const cachedGuessForCheck = await gameManagerForCheck.getCachedGuess(tweetIdForCheck);
          // Keep calculated badge as is
          markAsAnalyzed(actualTweetElement, outerElement, hasNestedStructure, processedTweets);
          return;
        }
      }
      // Not in IQGuessr mode or no tweet ID - normal flow, keep calculated badge
      markAsAnalyzed(actualTweetElement, outerElement, hasNestedStructure, processedTweets);
      return;
    }

    // If badge exists and is valid (invalid, is a guess badge, or is not loading), mark as analyzed
    if (existingBadge && (isInvalid || isGuessBadge || isNotLoading)) {
      // Only skip if badge is completed or a guess badge waiting for input
      // Don't skip if it's stuck in loading state
      if (!existingBadge.hasAttribute('data-iq-loading') &&
          !existingBadge.classList.contains('iq-badge-loading')) {
        markAsAnalyzed(actualTweetElement, outerElement, hasNestedStructure, processedTweets);
        return;
      }
    }

    // Extract and validate tweet text
    const { extractAndValidateTweetText, looksLikeTweet, createOrTransitionInvalidBadge, handleAgeRestrictedContent } = getTweetValidation();

    const validationResult = extractAndValidateTweetText(actualTweetElement, outerElement, hasNestedStructure);
    const { text: tweetText, handle, tweetId, isValid, validationReason } = validationResult;

    // Set processing flags
    actualTweetElement.setAttribute('data-iq-processing', 'true');
    actualTweetElement.setAttribute('data-iq-processing-start', Date.now().toString());

    // Handle invalid tweets (no text or validation failure)
    if (!tweetText || !isValid) {
      // Special handling for age-restricted content - remove badge instead of showing invalid
      if (validationReason === 'Age-restricted content') {
        handleAgeRestrictedContent(actualTweetElement, outerElement, hasNestedStructure);
        markAsAnalyzed(actualTweetElement, outerElement, hasNestedStructure, processedTweets);
        actualTweetElement.removeAttribute('data-iq-processing');
        actualTweetElement.removeAttribute('data-iq-processing-start');
        return;
      }

      // Only show invalid badge for elements that look like actual tweets
      if (looksLikeTweet && settings.showIQBadge) {
        createOrTransitionInvalidBadge(actualTweetElement, outerElement, hasNestedStructure, isNotificationsPage);
      }

      // Check if invalid tweets should be filtered
      const getIqFiltr = () => window.IqFiltr || {};
      const { checkAndFilter } = getIqFiltr();
      if (checkAndFilter && settings.enableIqFiltr) {
        // Mark as invalid for filtering
        actualTweetElement.setAttribute('data-iq-invalid', 'true');
        // Check and filter invalid tweet (pass null for iq and confidence)
        await checkAndFilter(actualTweetElement, null, null);
      }

      markAsAnalyzed(actualTweetElement, outerElement, hasNestedStructure, processedTweets);
      actualTweetElement.removeAttribute('data-iq-processing');
      actualTweetElement.removeAttribute('data-iq-processing-start');
      return;
    }

    // CRITICAL: Expand tweet text BEFORE badge restoration
    // This ensures that badge restoration checks cache with the FULL expanded text,
    // not the truncated text. If we restore before expanding, we'll restore badges
    // calculated with truncated text, which is incorrect.
    const { expandTweetText } = getTextExpansion();
    let finalTweetText = tweetText;
    if (expandTweetText) {
      finalTweetText = await expandTweetText(actualTweetElement, outerElement, hasNestedStructure, isNotificationsPage, tweetText, null);
    }

    // NOW: Check if we should restore a calculated badge (cached guess + cached IQ)
    // This happens AFTER text expansion, so we check cache with the full expanded text
    // PERFORMANCE: In IqGuessr mode, skip restoration check if there's no existing badge hinting at cache
    // This avoids slow cache lookups for tweets that definitely don't have cache
    const gameManager = getGameManager();
    const isGameModeEnabled = gameManager && gameManager.isGameModeEnabled && gameManager.isGameModeEnabled();
    
    // Only check restoration if:
    // 1. Not in IqGuessr mode (always check in normal mode)
    // 2. OR in IqGuessr mode but there's an existing badge (might be from cache)
    // 3. OR in IqGuessr mode but no existing badge (skip - will create guess badge immediately)
    const shouldCheckRestoration = !isGameModeEnabled || existingBadge;
    
    const { tryRestoreBadge } = getBadgeRestoration();
    if (tryRestoreBadge && shouldCheckRestoration) {
      // Debug logging: Before restoration attempt
      if (tracker.logTweetBadgeState) {
        await tracker.logTweetBadgeState(tweetElement, 'before-restoration');
      }
      
      const restored = await tryRestoreBadge(actualTweetElement, outerElement, hasNestedStructure, tweetId, handle, isNotificationsPage, processedTweets, finalTweetText);
      if (restored) {
        // Badge was restored, processing complete
        // Debug logging: After restoration
        if (tracker.logTweetBadgeState) {
          await tracker.logTweetBadgeState(tweetElement, 'after-restoration-success');
        }
        return;
      } else {
        // Debug logging: Restoration failed
        if (tracker.logTweetBadgeState) {
          await tracker.logTweetBadgeState(tweetElement, 'after-restoration-failed');
        }
      }
    }

    // Create or find loading badge
    const { addLoadingBadgeToTweet } = getLoadingBadgeManager();
    let loadingBadge = null;
    if (settings.showIQBadge) {
      // Check for existing loading badge
      loadingBadge = actualTweetElement.querySelector('.iq-badge[data-iq-loading="true"]') ||
                     actualTweetElement.querySelector('.iq-badge-loading');
      if (!loadingBadge && hasNestedStructure && outerElement) {
        loadingBadge = outerElement.querySelector('.iq-badge[data-iq-loading="true"]') ||
                       outerElement.querySelector('.iq-badge-loading');
      }

      // Check if there's already a non-loading badge that should be converted
      if (!loadingBadge) {
        const anyExistingBadge = existingBadge;
        if (anyExistingBadge) {
          // If it's a loading badge, use it
          if (anyExistingBadge.hasAttribute('data-iq-loading') ||
              anyExistingBadge.classList.contains('iq-badge-loading')) {
            loadingBadge = anyExistingBadge;
          } else {
            // There's a non-loading badge - check if IQ was revealed and should show calculated IQ
            // If so, verify the badge is showing calculated IQ, not guess
            const gameManager = getGameManager();
            const isGameModeEnabled = gameManager && gameManager.isGameModeEnabled && gameManager.isGameModeEnabled();
            if (isGameModeEnabled && tweetId) {
              const cachedRevealed = gameManager.getCachedRevealedIQ ? await gameManager.getCachedRevealedIQ(tweetId) : false;
              if (cachedRevealed) {
                // IQ was revealed - check if badge is showing guess instead of calculated
                const isGuessBadgeCheck = anyExistingBadge.classList.contains('iq-badge-guess') ||
                                         anyExistingBadge.hasAttribute('data-iq-guess');
                const hasCalculatedScore = anyExistingBadge.hasAttribute('data-iq-score') &&
                                          !anyExistingBadge.hasAttribute('data-iq-guessed');

                // If it's a guess badge or doesn't have calculated score, try to restore calculated badge
                if (isGuessBadgeCheck || !hasCalculatedScore) {
                  // Try restoration again - it should handle this case
                  const restored = await tryRestoreBadge(actualTweetElement, outerElement, hasNestedStructure, tweetId, handle, isNotificationsPage, processedTweets);
                  if (restored) {
                    return;
                  }
                }
              }
            }

            // There's already a non-loading badge - mark as analyzed and return
            markAsAnalyzed(actualTweetElement, outerElement, hasNestedStructure, processedTweets);
            return;
          }
        }
      }

      // PERFORMANCE: In IqGuessr mode with no cache, create guess badge directly instead of loading badge
      // This avoids creating a loading badge that will immediately be replaced
      if (!loadingBadge && isGameModeEnabled && !shouldCheckRestoration) {
        // No cache, IqGuessr mode - create guess badge directly
        const gameManagerForDirectGuess = getGameManager();
        const badges = window.GameManagerBadges;
        if (gameManagerForDirectGuess && badges && badges.createGuessBadge) {
          // Check for existing guess badge first (race condition protection)
          const existingGuessBadge = badges.findExistingGuessBadge ? badges.findExistingGuessBadge(actualTweetElement) : null;
          if (existingGuessBadge) {
            // Badge already exists, mark as analyzed and return
            markAsAnalyzed(actualTweetElement, outerElement, hasNestedStructure, processedTweets);
            return;
          }
          
          // Create guess badge directly
          const guessBadge = badges.createGuessBadge(actualTweetElement);
          
          // CRITICAL: Remove any existing loading badges BEFORE placing the guess badge
          // This prevents double badges if processVisibleTweets or tweetObserver added a loading badge
          const allLoadingBadges = [
            ...actualTweetElement.querySelectorAll('.iq-badge-loading'),
            ...actualTweetElement.querySelectorAll('[data-iq-loading="true"]'),
            ...(hasNestedStructure && outerElement ? [
              ...outerElement.querySelectorAll('.iq-badge-loading'),
              ...outerElement.querySelectorAll('[data-iq-loading="true"]')
            ] : [])
          ];
          allLoadingBadges.forEach(badge => {
            if (badge.parentElement) {
              badge.remove();
            }
          });
          
          // Place it in the engagement bar (same logic as loading badge placement)
          const engagementBar = actualTweetElement.querySelector('[role="group"]');
          if (engagementBar) {
            const firstChild = engagementBar.firstElementChild;
            if (firstChild) {
              engagementBar.insertBefore(guessBadge, firstChild);
            } else {
              engagementBar.appendChild(guessBadge);
            }
          } else {
            // Fallback: insert at beginning of tweet element
            actualTweetElement.insertBefore(guessBadge, actualTweetElement.firstChild);
          }
          
          // Debug logging: After guess badge creation
          if (tracker.logBadgeStateChange) {
            const toState = tracker.getBadgeState ? tracker.getBadgeState(guessBadge) : null;
            tracker.logBadgeStateChange(guessBadge, null, toState, 'after-guess-creation-direct');
          }
          
          // Mark as analyzed and return early
          markAsAnalyzed(actualTweetElement, outerElement, hasNestedStructure, processedTweets);
          return;
        }
      }
      
      // Create loading badge if needed (for normal mode ONLY - IqGuessr mode creates guess badges directly)
      // CRITICAL: Don't add loading badges in IqGuessr mode - they're created directly as guess badges above
      if (!loadingBadge && addLoadingBadgeToTweet && !isGameModeEnabled) {
        // Use outer element for nested structures to ensure correct placement
        const targetForBadge = (hasNestedStructure && outerElement) ? outerElement : actualTweetElement;
        addLoadingBadgeToTweet(targetForBadge);
        // Find the badge after creation
        loadingBadge = actualTweetElement.querySelector('.iq-badge[data-iq-loading="true"]') ||
                       actualTweetElement.querySelector('.iq-badge-loading');
        if (!loadingBadge && hasNestedStructure && outerElement) {
          loadingBadge = outerElement.querySelector('.iq-badge[data-iq-loading="true"]') ||
                         outerElement.querySelector('.iq-badge-loading');
        }
      }
    }

    // If game mode is enabled, replace loading badge with guess badge
    // (Restoration already handled earlier if cached guess + IQ exist)
    if (loadingBadge && settings.showIQBadge) {
      const gameManagerForConversion = getGameManager();
      if (gameManagerForConversion && gameManagerForConversion.isGameModeEnabled && gameManagerForConversion.isGameModeEnabled()) {
        // Debug logging: Before guess badge conversion
        if (tracker.logBadgeStateChange && loadingBadge) {
          const fromState = tracker.getBadgeState ? tracker.getBadgeState(loadingBadge) : null;
          tracker.logBadgeStateChange(loadingBadge, fromState, null, 'before-guess-conversion');
        }
        
        // No cached guess+IQ combo found earlier, proceed with normal guess badge replacement
        const guessBadge = await gameManagerForConversion.replaceLoadingBadgeWithGuess(loadingBadge);
        if (guessBadge) {
          loadingBadge = guessBadge;
          
          // Debug logging: After guess badge conversion
          if (tracker.logBadgeStateChange) {
            const toState = tracker.getBadgeState ? tracker.getBadgeState(guessBadge) : null;
            tracker.logBadgeStateChange(guessBadge, null, toState, 'after-guess-conversion');
          }
        }
      }
    }

    // Text expansion already happened above (before badge restoration)
    // finalTweetText is already set to the expanded text

    // Ensure loading badge is in place before estimation
    if (settings.showIQBadge && loadingBadge) {
      const { ensureBadgeInDOM } = getBadgeUpdate();
      if (ensureBadgeInDOM) {
        ensureBadgeInDOM(loadingBadge, actualTweetElement, outerElement, hasNestedStructure, isNotificationsPage);
      }
    }

    try {
      // Check if IQ estimation should be skipped (IQGuessr mode)
      const { shouldSkipEstimation } = getIQEstimation();
      if (shouldSkipEstimation) {
        const shouldSkip = await shouldSkipEstimation(tweetId);
        if (shouldSkip) {
          // IQGuessr enabled but no guess yet - skip calculation, store IQ result as null
          // The badge is already a guess badge (converted earlier), so we're done
          markAsAnalyzed(actualTweetElement, outerElement, hasNestedStructure, processedTweets);
          actualTweetElement.removeAttribute('data-iq-processing');
          actualTweetElement.removeAttribute('data-iq-processing-start');
          return;
        }
      }

      // Estimate IQ
      const { estimateIQ } = getIQEstimation();
      if (!estimateIQ) {
        console.warn('IQEstimation module not loaded');
        markAsAnalyzed(actualTweetElement, outerElement, hasNestedStructure, processedTweets);
        actualTweetElement.removeAttribute('data-iq-processing');
        actualTweetElement.removeAttribute('data-iq-processing-start');
        return;
      }

      const estimationResult = await estimateIQ(finalTweetText, handle, actualTweetElement, iqEstimator);
      const { result, fromCache } = estimationResult;

      // Update badge with IQ result
      if (result && result.is_valid && result.iq_estimate !== null && settings.showIQBadge) {
        const iq = Math.round(result.iq_estimate);
        const confidence = result.confidence ? Math.round(result.confidence) : null;

        // Debug logging: Before badge update
        if (tracker.logBadgeStateChange && loadingBadge) {
          const fromState = tracker.getBadgeState ? tracker.getBadgeState(loadingBadge) : null;
          tracker.logBadgeStateChange(loadingBadge, fromState, null, 'before-update-with-IQ');
        }

        const { updateBadgeWithIQ } = getBadgeUpdate();
        if (updateBadgeWithIQ) {
          await updateBadgeWithIQ(loadingBadge, actualTweetElement, outerElement, hasNestedStructure, isNotificationsPage, iq, result, confidence, finalTweetText, tweetId);
          
          // Debug logging: After badge update
          if (tracker.logTweetBadgeState) {
            await tracker.logTweetBadgeState(tweetElement, 'after-update-with-IQ');
          }
        }

        // Mark as analyzed
        markAsAnalyzed(actualTweetElement, outerElement, hasNestedStructure, processedTweets);
        actualTweetElement.removeAttribute('data-iq-processing');
        actualTweetElement.removeAttribute('data-iq-processing-start');
      } else {
        // Invalid result - remove loading badge
        if (loadingBadge) {
          loadingBadge.remove();
        }
        actualTweetElement.removeAttribute('data-iq-processing');
        actualTweetElement.removeAttribute('data-iq-processing-start');
      }
    } catch (error) {
      console.error(`[TweetProcessor] ERROR processing tweet:`, error?.message || error);
      if (loadingBadge) {
        loadingBadge.remove();
      }
      markAsAnalyzed(actualTweetElement, outerElement, hasNestedStructure, processedTweets);
      actualTweetElement.removeAttribute('data-iq-processing');
      actualTweetElement.removeAttribute('data-iq-processing-start');
    }
  }

  // Export for use in other modules
  if (typeof window !== 'undefined') {
    window.TweetProcessorCore = {
      processTweet
    };
  }
})();

