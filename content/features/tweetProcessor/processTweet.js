/**
 * Tweet Processing Core
 * Handles processing of tweets and managing IQ badge creation/updates
 *
 * NOTE: This module has been refactored. Some functions have been moved to:
 * - badgePlacement/notificationPlacement.js (findNotificationBadgePlacement)
 * - badgePlacement/positionCorrection.js (ensureCorrectBadgePosition)
 * - badgeManagement/loadingBadgeManager.js (addLoadingBadgeToTweet)
 * - badgeManagement/badgeCleanup.js (checkForStuckBadges)
 * - observers/tweetObserver.js (setupObserver)
 * - helpers/processVisibleTweets.js (processVisibleTweets)
 * - notificationFilters/followNotificationFilter.js (follow notification detection)
 */

(function() {
  'use strict';

// Get dependencies from other modules (loaded via window global objects)
const getTextExtraction = () => window.TextExtraction || {};
const getTweetDetection = () => window.TweetDetection || {};
const getBadgeManager = () => window.BadgeManager || {};
const getGameManager = () => window.GameManager || {};
const getIQCache = () => window.IQCache || {};
const getSettings = () => window.Settings || {};

// Get refactored modules
const getNotificationPlacement = () => window.NotificationBadgePlacement || {};
const getBadgePositionCorrection = () => window.BadgePositionCorrection || {};
const getFollowNotificationFilter = () => window.FollowNotificationFilter || {};

// Store previous positions to detect changes
const badgePositions = new Map();

// Local processedTweets set (will be managed by index.js in refactored version)
// Keeping for backward compatibility
const processedTweets = new Set();

// Helper to get findNotificationBadgePlacement from refactored module
function findNotificationBadgePlacement(tweetElement) {
  const { findNotificationBadgePlacement } = getNotificationPlacement();
  if (findNotificationBadgePlacement) {
    return findNotificationBadgePlacement(tweetElement);
  }
  // Fallback if module not loaded (shouldn't happen)
  return null;
}

// Function removed - now in badgePlacement/notificationPlacement.js

// Helper to get ensureCorrectBadgePosition from refactored module
function ensureCorrectBadgePosition(badge, tweetElement, isNotificationsPage) {
  const { ensureCorrectBadgePosition } = getBadgePositionCorrection();
  if (ensureCorrectBadgePosition) {
    return ensureCorrectBadgePosition(badge, tweetElement, isNotificationsPage);
  }
  // Fallback if module not loaded (shouldn't happen)
  return false;
}

/**
 * Process a single tweet element
 */
async function processTweet(tweetElement) {
  const settings = getSettings();
  if (!tweetElement || !settings.showIQBadge) {
    return;
  }

  const { extractTweetText, isTweetTruncated, tryExtractFullTextWithoutExpanding, extractFullTextWithoutVisualExpansion, extractTweetHandle, extractTweetId } = getTextExtraction();
  const { validateTweetText } = getTweetDetection();
  const badgeManager = getBadgeManager();
  if (!badgeManager || !badgeManager.createLoadingBadge) {
    return;
  }
  const { createLoadingBadge, createInvalidBadge, getIQColor, getConfidenceColor, createIQBadge, animateCountUp, updateBadgeWithFlipStructure, logDebugInfo, hexToRgb, desaturateColor } = badgeManager;
  const { getCachedIQ, cacheIQ } = getIQCache();
  const iqEstimator = window.ComprehensiveIQEstimatorUltimate ? new window.ComprehensiveIQEstimatorUltimate() : null;

  if (!iqEstimator) {
    return;
  }

  // Handle nested tweet structures
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

  if (actualTweetElement.hasAttribute('data-iq-analyzed')) {
    return;
  }

  // Check if this is a follow notification and skip processing
  const isNotificationsPage = window.location.href.includes('/notifications');
  if (isNotificationsPage) {
    const { isFollowNotification, skipFollowNotification } = getFollowNotificationFilter();
    if (isFollowNotification && isFollowNotification(actualTweetElement)) {
      skipFollowNotification(actualTweetElement, tweetElement, hasNestedStructure);
      return;
    }
  }

  // For nested structures, check for badge in both outer wrapper and nested tweet
  // This fixes the issue where badges are placed in outer wrapper but we only search nested tweet
  // Also check for and remove duplicate badges
  let existingBadge = actualTweetElement.querySelector('.iq-badge');
  const allBadgesInActual = actualTweetElement.querySelectorAll('.iq-badge');
  const allBadgesInOuter = hasNestedStructure ? tweetElement.querySelectorAll('.iq-badge') : [];

  // If multiple badges found, keep only the first one and remove duplicates
  const allBadges = [...allBadgesInActual, ...allBadgesInOuter];
  if (allBadges.length > 1) {
    // Keep the first badge, remove all others
    for (let i = 1; i < allBadges.length; i++) {
      if (allBadges[i].parentElement) {
        allBadges[i].remove();
      }
    }
    existingBadge = allBadges[0];
  }

  if (!existingBadge && hasNestedStructure) {
    existingBadge = tweetElement.querySelector('.iq-badge');
  }

  // Check if badge is a valid completed badge (score, invalid, or guess badge)
  const isGuessBadge = existingBadge && (
    existingBadge.classList.contains('iq-badge-guess') ||
    existingBadge.hasAttribute('data-iq-guess')
  );

  const hasScore = existingBadge && existingBadge.hasAttribute('data-iq-score');
  const isInvalid = existingBadge && existingBadge.hasAttribute('data-iq-invalid');
  const isNotLoading = existingBadge && !existingBadge.hasAttribute('data-iq-loading') &&
                       !existingBadge.classList.contains('iq-badge-loading');

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
        actualTweetElement.setAttribute('data-iq-analyzed', 'true');
        return;
      }
    }
    // Not in IQGuessr mode or no tweet ID - normal flow, keep calculated badge
    actualTweetElement.setAttribute('data-iq-analyzed', 'true');
    return;
  }

  // If badge exists and is valid (invalid, is a guess badge, or is not loading), mark as analyzed
  if (existingBadge && (isInvalid || isGuessBadge || isNotLoading)) {
    // Only skip if badge is completed or a guess badge waiting for input
    // Don't skip if it's stuck in loading state
    if (!existingBadge.hasAttribute('data-iq-loading') &&
        !existingBadge.classList.contains('iq-badge-loading')) {
      actualTweetElement.setAttribute('data-iq-analyzed', 'true');
      return;
    }
  }

  // Extract tweet ID early - declare it here so it's available throughout the function
  // This must be done before the early restoration check
  // NOTE: extractTweetId comes from TextExtraction (already destructured above)
  let tweetId = actualTweetElement.getAttribute('data-tweet-id');

  if (!tweetId && extractTweetId) {
    tweetId = extractTweetId(actualTweetElement);
    if (tweetId) {
      actualTweetElement.setAttribute('data-tweet-id', tweetId);
    }
  }

  actualTweetElement.setAttribute('data-iq-processing', 'true');
  actualTweetElement.setAttribute('data-iq-processing-start', Date.now().toString());

  // Extract handle early for game mode
  let handle = extractTweetHandle(actualTweetElement);
  if (handle) {
    actualTweetElement.setAttribute('data-handle', handle);
  }

  let tweetText = extractTweetText(actualTweetElement);

  // Apply URL removal explicitly here as a safety measure
  // (extractTweetText should already do this, but ensure it happens)
  const { removeUrlsFromText } = getTextExtraction();
  if (tweetText && removeUrlsFromText) {
    tweetText = removeUrlsFromText(tweetText);
  }

  if (!tweetText) {
    // Only log warnings for elements that look like actual tweets (have engagement bar or tweet text element)
    // This reduces noise from non-tweet elements that match the article selector
    const hasTweetTextElement = !!actualTweetElement.querySelector('[data-testid="tweetText"]');
    const hasEngagementBar = !!actualTweetElement.querySelector('[role="group"]');
    const looksLikeTweet = hasTweetTextElement || hasEngagementBar;

    if (looksLikeTweet && isNotificationsPage) {
      // Get more detailed info about why extraction failed
      const tweetTextElement = actualTweetElement.querySelector('[data-testid="tweetText"]');
      const textContent = tweetTextElement ? tweetTextElement.textContent : null;
      const innerText = tweetTextElement ? tweetTextElement.innerText : null;
      const allTextElements = actualTweetElement.querySelectorAll('[data-testid="tweetText"]');

      // Check if text exists but becomes empty after URL removal (tweets with only URLs/images)
      const { removeUrlsFromText } = getTextExtraction();
      const textBeforeUrlRemoval = textContent || innerText || '';
      const textAfterUrlRemoval = removeUrlsFromText ? removeUrlsFromText(textBeforeUrlRemoval.trim()) : textBeforeUrlRemoval.trim();
      const isOnlyUrls = textBeforeUrlRemoval.length > 0 && textAfterUrlRemoval.length === 0;

      // Only warn if this looks like a real issue (not just a tweet with only URLs/images)
      // Silent skip for tweets that only contain URLs/images (no actual text content)
      // Silent skip for tweets that only contain URLs/images (no actual text content)
    }
    // Silent skip for elements that don't look like tweets
    if (settings.showIQBadge) {
      // Get or transition existing badge instead of creating new one
      // Check both nested and outer wrapper for nested structures
      let invalidBadge = actualTweetElement.querySelector('.iq-badge');
      if (!invalidBadge && hasNestedStructure) {
        invalidBadge = tweetElement.querySelector('.iq-badge');
      }

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

        // Ensure badge is in DOM
        if (!invalidBadge.parentElement) {
          const engagementBar = actualTweetElement.querySelector('[role="group"]');
          if (engagementBar) {
            const firstChild = engagementBar.firstElementChild;
            if (firstChild) {
              engagementBar.insertBefore(invalidBadge, firstChild);
            } else {
              engagementBar.appendChild(invalidBadge);
            }
          } else {
            const tweetContent = actualTweetElement.querySelector('div[data-testid="tweetText"]') ||
                                actualTweetElement.querySelector('div[lang]') ||
                                actualTweetElement.firstElementChild;
            if (tweetContent && tweetContent.parentElement) {
              tweetContent.parentElement.insertBefore(invalidBadge, tweetContent);
            } else {
              actualTweetElement.insertBefore(invalidBadge, actualTweetElement.firstChild);
            }
          }
        }
      } else {
        // No existing badge, create new invalid badge
        invalidBadge = createInvalidBadge();
        const engagementBar = actualTweetElement.querySelector('[role="group"]');
        if (engagementBar) {
          const firstChild = engagementBar.firstElementChild;
          if (firstChild) {
            engagementBar.insertBefore(invalidBadge, firstChild);
          } else {
            engagementBar.appendChild(invalidBadge);
          }
        } else {
          const tweetContent = actualTweetElement.querySelector('div[data-testid="tweetText"]') ||
                              actualTweetElement.querySelector('div[lang]') ||
                              actualTweetElement.firstElementChild;
          if (tweetContent && tweetContent.parentElement) {
            tweetContent.parentElement.insertBefore(invalidBadge, tweetContent);
          } else {
            actualTweetElement.insertBefore(invalidBadge, actualTweetElement.firstChild);
          }
        }
      }
    }
    actualTweetElement.setAttribute('data-iq-analyzed', 'true');
    actualTweetElement.removeAttribute('data-iq-processing');
    actualTweetElement.removeAttribute('data-iq-processing-start');
    return;
  }

  const validation = validateTweetText(tweetText);
  if (!validation.isValid) {
    // Special handling for age-restricted content - remove badge instead of showing invalid
    if (validation.reason === 'Age-restricted content') {
      // Check both nested and outer wrapper for nested structures
      let existingBadge = actualTweetElement.querySelector('.iq-badge');
      if (!existingBadge && hasNestedStructure) {
        existingBadge = tweetElement.querySelector('.iq-badge');
      }
      if (existingBadge) {
        existingBadge.remove();
      }
      actualTweetElement.setAttribute('data-iq-analyzed', 'true');
      actualTweetElement.removeAttribute('data-iq-processing');
    actualTweetElement.removeAttribute('data-iq-processing-start');
      return;
    }

    if (settings.showIQBadge) {
      // Get or transition existing badge instead of creating new one
      // Check both nested and outer wrapper for nested structures
      let invalidBadge = actualTweetElement.querySelector('.iq-badge');
      if (!invalidBadge && hasNestedStructure) {
        invalidBadge = tweetElement.querySelector('.iq-badge');
      }

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
            ? tweetElement
            : actualTweetElement;
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
      } else {
        // No existing badge, create new invalid badge
        invalidBadge = createInvalidBadge();
        // For nested structures on notifications page, use outer wrapper for placement
        const targetElement = (hasNestedStructure && isNotificationsPage) ? tweetElement : actualTweetElement;
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
    actualTweetElement.setAttribute('data-iq-analyzed', 'true');
    actualTweetElement.removeAttribute('data-iq-processing');
    actualTweetElement.removeAttribute('data-iq-processing-start');
    return;
  }

  // FIRST: Check if we should restore a calculated badge (cached guess + cached IQ)
  // This must happen BEFORE we create or convert any badges
  // Note: tweetId is already declared above, so we can use it here
  const gameManager = getGameManager();
  const isGameModeEnabled = gameManager && gameManager.isGameModeEnabled && gameManager.isGameModeEnabled();

  if (isGameModeEnabled && tweetId && settings.showIQBadge) {
    const cachedGuess = await gameManager.getCachedGuess(tweetId);
    const cachedRevealed = gameManager.getCachedRevealedIQ ? await gameManager.getCachedRevealedIQ(tweetId) : false;

    // If IQ was previously revealed (either with or without a guess), show as calculated
    if (cachedRevealed) {

      // We have revealed IQ - check if we have cached IQ to restore calculated badge
      const { getCachedIQ } = getIQCache();
      const { extractTweetHandle, extractTweetText } = getTextExtraction();

      if (getCachedIQ && extractTweetHandle) {
        let handle = actualTweetElement.getAttribute('data-handle');
        if (!handle) {
          handle = extractTweetHandle(actualTweetElement);
          if (handle) {
            actualTweetElement.setAttribute('data-handle', handle);
          }
        }

        if (handle) {
          let cachedIQ = getCachedIQ(handle);

          // If cachedRevealed=true but cachedIQ is null, wait and retry multiple times (cache might still be loading from storage)
          if (!cachedIQ && cachedRevealed) {
            // Try loading from storage directly if cache module has loadCache function
            const { loadCache } = getIQCache();
            if (loadCache) {
              // Force reload from storage
              loadCache();
              // Wait a bit for async load to complete
              await new Promise(resolve => setTimeout(resolve, 150));
              cachedIQ = getCachedIQ(handle);
            }

            // If still not found, wait a bit more and retry once more
            if (!cachedIQ) {
              await new Promise(resolve => setTimeout(resolve, 150));
              cachedIQ = getCachedIQ(handle);
            }

            // If still not found via handle, try fallback: get IQ result directly by tweet ID
            if (!cachedIQ || !cachedIQ.iq_estimate) {
              const gameManagerForIQ = getGameManager();
              if (gameManagerForIQ && gameManagerForIQ.getCachedRevealedIQResult) {
                const cachedIQResult = await gameManagerForIQ.getCachedRevealedIQResult(tweetId);
                if (cachedIQResult && cachedIQResult.iq) {
                  // Convert to expected format - merge result object if it exists
                  cachedIQ = {
                    iq_estimate: cachedIQResult.iq,
                    confidence: cachedIQResult.confidence,
                    ...(cachedIQResult.result || {})
                  };
                }
              }
            }
          }

          if (cachedIQ && cachedIQ.iq_estimate !== undefined) {
            // We have revealed IQ and cached IQ - restore calculated badge directly
            const badgeManager = getBadgeManager();
            if (badgeManager && badgeManager.createIQBadge) {
              const iq = Math.round(cachedIQ.iq_estimate);
              const confidence = cachedIQ.confidence ? Math.round(cachedIQ.confidence) : null;
              const tweetText = extractTweetText ? extractTweetText(actualTweetElement) : null;

              const iqBadge = badgeManager.createIQBadge(iq, cachedIQ, tweetText);

              // Mark badge as compared if there's a cached guess (since cachedRevealed=true means it was compared)
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
              let existingBadge = actualTweetElement.querySelector('.iq-badge');
              if (!existingBadge && hasNestedStructure) {
                existingBadge = tweetElement.querySelector('.iq-badge');
              }

              // Find where to place the badge (same logic as before)
              const isNotificationsPage = window.location.href.includes('/notifications');
              if (isNotificationsPage) {
                const placementTarget = hasNestedStructure ? tweetElement : actualTweetElement;
                const placement = findNotificationBadgePlacement(placementTarget);
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

              // Remove existing badge if it exists
              if (existingBadge && existingBadge.parentElement) {
                existingBadge.remove();
              }

              // Mark as analyzed and return early (skip calculation and all other processing)
              processedTweets.add(actualTweetElement);
              actualTweetElement.setAttribute('data-iq-analyzed', 'true');
              actualTweetElement.removeAttribute('data-iq-processing');
              actualTweetElement.removeAttribute('data-iq-processing-start');
              if (hasNestedStructure) {
                tweetElement.setAttribute('data-iq-analyzed', 'true');
                processedTweets.add(tweetElement);
              }
              return; // Exit early, don't process further
            }
          }
        }
      }
    }

    if (cachedGuess && cachedGuess.guess !== undefined) {
      // We have a cached guess - check if we have cached IQ to restore calculated badge
      const { getCachedIQ } = getIQCache();
      const { extractTweetHandle, extractTweetText } = getTextExtraction();

      if (getCachedIQ && extractTweetHandle) {
        let handle = actualTweetElement.getAttribute('data-handle');
        if (!handle) {
          handle = extractTweetHandle(actualTweetElement);
          if (handle) {
            actualTweetElement.setAttribute('data-handle', handle);
          }
        }

        if (handle) {
          const cachedIQ = getCachedIQ(handle);
          if (cachedIQ && cachedIQ.iq_estimate !== undefined) {
            // We have both cached guess and cached IQ - restore calculated badge directly

            const badgeManager = getBadgeManager();
            if (badgeManager && badgeManager.createIQBadge) {
              const iq = Math.round(cachedIQ.iq_estimate);
              const confidence = cachedIQ.confidence ? Math.round(cachedIQ.confidence) : null;
              const tweetText = extractTweetText ? extractTweetText(actualTweetElement) : null;

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
              let existingBadge = actualTweetElement.querySelector('.iq-badge');
              if (!existingBadge && hasNestedStructure) {
                existingBadge = tweetElement.querySelector('.iq-badge');
              }

              // Find where to place the badge
              const isNotificationsPage = window.location.href.includes('/notifications');
              if (isNotificationsPage) {
                const placementTarget = hasNestedStructure ? tweetElement : actualTweetElement;
                const placement = findNotificationBadgePlacement(placementTarget);
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

              // Remove existing badge if it exists
              if (existingBadge && existingBadge.parentElement) {
                existingBadge.remove();
              }

              // Mark as analyzed and return early (skip calculation and all other processing)
              processedTweets.add(actualTweetElement);
              actualTweetElement.setAttribute('data-iq-analyzed', 'true');
              actualTweetElement.removeAttribute('data-iq-processing');
              actualTweetElement.removeAttribute('data-iq-processing-start');
              if (hasNestedStructure) {
                tweetElement.setAttribute('data-iq-analyzed', 'true');
                processedTweets.add(tweetElement);
              }
              return; // Exit early, don't process further
            }
          }
        }
      }
    }
  }

  let loadingBadge = null;
  if (settings.showIQBadge) {
    // Check both nested and outer wrapper for nested structures
    // Also check for ALL badges to detect and remove duplicates
    const allBadgesForLoadingCheck = [
      ...actualTweetElement.querySelectorAll('.iq-badge'),
      ...(hasNestedStructure ? tweetElement.querySelectorAll('.iq-badge') : [])
    ];

    // If multiple badges found, remove duplicates (keep the first one)
    if (allBadgesForLoadingCheck.length > 1) {
      for (let i = 1; i < allBadgesForLoadingCheck.length; i++) {
        if (allBadgesForLoadingCheck[i].parentElement) {
          allBadgesForLoadingCheck[i].remove();
        }
      }
    }

    loadingBadge = actualTweetElement.querySelector('.iq-badge[data-iq-loading="true"]') ||
                   actualTweetElement.querySelector('.iq-badge-loading');
    if (!loadingBadge && hasNestedStructure) {
      loadingBadge = tweetElement.querySelector('.iq-badge[data-iq-loading="true"]') ||
                     tweetElement.querySelector('.iq-badge-loading');
    }

    // If we already found a badge (any type), don't create a new one
    // BUT: Check if IQ was revealed and badge should be calculated (not guess)
    if (!loadingBadge) {
      const anyExistingBadge = actualTweetElement.querySelector('.iq-badge') ||
                               (hasNestedStructure ? tweetElement.querySelector('.iq-badge') : null);
      if (anyExistingBadge) {
        // If it's a loading badge, use it
        if (anyExistingBadge.hasAttribute('data-iq-loading') ||
            anyExistingBadge.classList.contains('iq-badge-loading')) {
          loadingBadge = anyExistingBadge;
        } else {
          // There's a non-loading badge - check if IQ was revealed and should show calculated IQ
          // If so, verify the badge is showing calculated IQ, not guess
          if (isGameModeEnabled && tweetId) {
            const cachedRevealed = gameManager.getCachedRevealedIQ ? await gameManager.getCachedRevealedIQ(tweetId) : false;

            if (cachedRevealed) {
              // IQ was revealed - check if badge is showing guess instead of calculated
              const isGuessBadge = anyExistingBadge.classList.contains('iq-badge-guess') ||
                                   anyExistingBadge.hasAttribute('data-iq-guess');
              const hasCalculatedScore = anyExistingBadge.hasAttribute('data-iq-score') &&
                                        !anyExistingBadge.hasAttribute('data-iq-guessed');

              // If it's a guess badge or doesn't have calculated score, remove it and restore calculated badge
              if (isGuessBadge || !hasCalculatedScore) {
                // Badge should be calculated but isn't - restore calculated badge
                const { getCachedIQ } = getIQCache();
                const { extractTweetHandle, extractTweetText } = getTextExtraction();

                if (getCachedIQ && extractTweetHandle) {
                  let handle = actualTweetElement.getAttribute('data-handle');
                  if (!handle) {
                    handle = extractTweetHandle(actualTweetElement);
                    if (handle) {
                      actualTweetElement.setAttribute('data-handle', handle);
                    }
                  }

                  if (handle) {
                    const cachedIQ = getCachedIQ(handle);

                    if (cachedIQ && cachedIQ.iq_estimate !== undefined) {
                      // We have revealed IQ and cached IQ - restore calculated badge
                      const badgeManager = getBadgeManager();

                      if (badgeManager && badgeManager.createIQBadge) {
                        const iq = Math.round(cachedIQ.iq_estimate);
                        const confidence = cachedIQ.confidence ? Math.round(cachedIQ.confidence) : null;
                        const tweetText = extractTweetText ? extractTweetText(actualTweetElement) : null;

                        const iqBadge = badgeManager.createIQBadge(iq, cachedIQ, tweetText);

                        // Mark badge as compared if there's a cached guess (since cachedRevealed=true means it was compared)
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

                        // Replace the incorrect badge
                        if (anyExistingBadge.parentElement) {
                          anyExistingBadge.parentElement.insertBefore(iqBadge, anyExistingBadge);
                          anyExistingBadge.remove();
                        } else {
                          // Fallback: just remove old badge and place new one
                          anyExistingBadge.remove();
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

                        // Mark as analyzed and return
                        processedTweets.add(actualTweetElement);
                        actualTweetElement.setAttribute('data-iq-analyzed', 'true');
                        actualTweetElement.removeAttribute('data-iq-processing');
                        actualTweetElement.removeAttribute('data-iq-processing-start');
                        if (hasNestedStructure) {
                          tweetElement.setAttribute('data-iq-analyzed', 'true');
                          processedTweets.add(tweetElement);
                        }
                        return;
                      }
                    }
                  }
                }
              }
            }
          }

          // There's already a non-loading badge - mark as analyzed and return
          actualTweetElement.setAttribute('data-iq-analyzed', 'true');
          if (hasNestedStructure) {
            tweetElement.setAttribute('data-iq-analyzed', 'true');
          }
          return;
        }
      }
    }

    if (!loadingBadge) {
      loadingBadge = createLoadingBadge();

      // Special handling for notification page tweets
      if (isNotificationsPage) {
        // Use helper function to find correct placement
        // For nested structures, use outer wrapper for placement on notifications page
        const placementTarget = hasNestedStructure ? tweetElement : actualTweetElement;
        const placement = findNotificationBadgePlacement(placementTarget);

        if (placement) {
          const { targetElement, parentElement } = placement;

          const beforeInsertPos = loadingBadge.getBoundingClientRect();

          // Place badge after the notification text or before tweet content
          // ALWAYS ensure badge appears on its own line (below notification)
          if (placement.placement === 'before-tweet-content') {
            parentElement.insertBefore(loadingBadge, targetElement);
          } else {
            // After notification text/div - ensure block-level placement
            let insertionParent = parentElement;
            let insertionPoint = targetElement;

            // If targetElement is inline (span), find its block-level parent
            if (targetElement.tagName === 'SPAN') {
              let blockParent = targetElement.parentElement;
              while (blockParent && blockParent !== actualTweetElement) {
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
              insertionPoint.parentElement.insertBefore(loadingBadge, insertionPoint);
            } else if (parentElement.contains(targetElement)) {
              if (targetElement.nextSibling) {
                parentElement.insertBefore(loadingBadge, targetElement.nextSibling);
              } else {
                parentElement.appendChild(loadingBadge);
              }
            } else {
              parentElement.appendChild(loadingBadge);
            }

            // Force badge to display as block to ensure it's on its own line
            loadingBadge.style.setProperty('display', 'block', 'important');
            loadingBadge.style.setProperty('width', '100%', 'important');
          }
        } else {
          // Last resort: place at start of tweet element (use outer wrapper for nested structures)
          const fallbackTarget = hasNestedStructure ? tweetElement : actualTweetElement;
          fallbackTarget.insertBefore(loadingBadge, fallbackTarget.firstChild);
        }

        // Verify and fix position if needed - check immediately and after delay
        // Use outer wrapper for nested structures
        const positionCheckTarget = hasNestedStructure ? tweetElement : actualTweetElement;
        requestAnimationFrame(() => {
          ensureCorrectBadgePosition(loadingBadge, positionCheckTarget, isNotificationsPage);
        });

        setTimeout(() => {
          ensureCorrectBadgePosition(loadingBadge, positionCheckTarget, isNotificationsPage);
        }, 50);
      } else {
        // Normal tweet pages: use engagement bar if available
        const engagementBar = actualTweetElement.querySelector('[role="group"]');
        if (engagementBar) {
          const firstChild = engagementBar.firstElementChild;
          if (firstChild) {
            engagementBar.insertBefore(loadingBadge, firstChild);
          } else {
            engagementBar.appendChild(loadingBadge);
          }
        } else {
          const tweetContent = actualTweetElement.querySelector('div[data-testid="tweetText"]') ||
                              actualTweetElement.querySelector('div[lang]') ||
                              actualTweetElement.firstElementChild;
          if (tweetContent && tweetContent.parentElement) {
            tweetContent.parentElement.insertBefore(loadingBadge, tweetContent);
          } else {
            actualTweetElement.insertBefore(loadingBadge, actualTweetElement.firstChild);
          }
        }
      }

      // Verify and fix position after initial placement
      if (isNotificationsPage) {
        // Use outer wrapper for nested structures
        const positionCheckTarget = hasNestedStructure ? tweetElement : actualTweetElement;
        // Immediately verify and fix position
        ensureCorrectBadgePosition(loadingBadge, positionCheckTarget, isNotificationsPage);
        // Check again after DOM updates
        setTimeout(() => {
          ensureCorrectBadgePosition(loadingBadge, positionCheckTarget, isNotificationsPage);
        }, 10);
      }
    }

    // Only reposition badge if it's not already in the right place
    // On notification pages, don't move it to engagement bar
    if (loadingBadge && loadingBadge.parentElement && !isNotificationsPage) {
      const engagementBar = actualTweetElement.querySelector('[role="group"]');
      if (engagementBar && !engagementBar.contains(loadingBadge)) {
        const firstChild = engagementBar.firstElementChild;
        if (firstChild) {
          engagementBar.insertBefore(loadingBadge, firstChild);
        } else {
          engagementBar.appendChild(loadingBadge);
        }
      }
    }

    // Ensure badge is in correct position before IQ estimation
    if (isNotificationsPage && loadingBadge) {
      // Use outer wrapper for nested structures
      const positionCheckTarget = hasNestedStructure ? tweetElement : actualTweetElement;
      ensureCorrectBadgePosition(loadingBadge, positionCheckTarget, isNotificationsPage);
    }
  }

  if (settings.showIQBadge && loadingBadge) {
    if (!loadingBadge.parentElement) {
      // Re-insert existing badge instead of creating new one
      if (isNotificationsPage) {
        // For nested structures, use outer wrapper for placement
        const placementTarget = hasNestedStructure ? tweetElement : actualTweetElement;
        const placement = findNotificationBadgePlacement(placementTarget);
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
              targetElementForPlacement.insertBefore(loadingBadge, targetElementForPlacement.firstChild);
            }
          } else {
            // Normal tweet pages: use engagement bar
            const targetElement = hasNestedStructure ? tweetElement : actualTweetElement;
            const engagementBar = targetElement.querySelector('[role="group"]');
        if (engagementBar) {
          const firstChild = engagementBar.firstElementChild;
          if (firstChild) {
            engagementBar.insertBefore(loadingBadge, firstChild);
          } else {
            engagementBar.appendChild(loadingBadge);
          }
        } else {
          const tweetContent = actualTweetElement.querySelector('div[data-testid="tweetText"]') ||
                              actualTweetElement.querySelector('div[lang]') ||
                              actualTweetElement.firstElementChild;
          if (tweetContent && tweetContent.parentElement) {
            tweetContent.parentElement.insertBefore(loadingBadge, tweetContent);
          } else {
            actualTweetElement.insertBefore(loadingBadge, actualTweetElement.firstChild);
          }
        }
      }
    }
  }

  // If game mode is enabled, replace loading badge with guess badge
  // (Restoration already handled earlier if cached guess + IQ exist)
  if (loadingBadge && settings.showIQBadge) {
    const gameManagerForConversion = getGameManager();
    if (gameManagerForConversion && gameManagerForConversion.isGameModeEnabled && gameManagerForConversion.isGameModeEnabled()) {
      // No cached guess+IQ combo found earlier, proceed with normal guess badge replacement
      const guessBadge = await gameManagerForConversion.replaceLoadingBadgeWithGuess(loadingBadge);
      if (guessBadge) {
        loadingBadge = guessBadge;
      }
    }
  }

  const alreadyExpanded = Array.from(actualTweetElement.querySelectorAll('span[role="button"], button, div[role="button"]')).some(el => {
    const text = el.textContent.trim().toLowerCase();
    return text === 'show less' || text === 'read less' ||
           (text.includes('show') && text.includes('less'));
  });

  if (alreadyExpanded) {
    const expandedTextRaw = extractTweetText(actualTweetElement);
    tweetText = expandedTextRaw && removeUrlsFromText ? removeUrlsFromText(expandedTextRaw) : expandedTextRaw;
  } else if (isTweetTruncated(actualTweetElement)) {
      tweetText = tryExtractFullTextWithoutExpanding(actualTweetElement);
      // Ensure URLs are removed
      if (tweetText && removeUrlsFromText) {
        tweetText = removeUrlsFromText(tweetText);
      }

      const baselineTextRaw = extractTweetText(actualTweetElement);
      // Ensure URLs are removed from baseline text too
      const baselineText = baselineTextRaw && removeUrlsFromText ? removeUrlsFromText(baselineTextRaw) : baselineTextRaw;
    const baselineLength = baselineText ? baselineText.length : 0;
    const extractedLength = tweetText ? tweetText.length : 0;
    const likelyTruncated = !tweetText ||
                            Math.abs(extractedLength - baselineLength) < 100;

    if (likelyTruncated && baselineLength > 50) {
      if (settings.showIQBadge && loadingBadge && !loadingBadge.parentElement) {
        // Re-insert existing badge instead of creating new one
        if (isNotificationsPage) {
          // For nested structures, use outer wrapper for placement
          const placementTarget = hasNestedStructure ? tweetElement : actualTweetElement;
          const placement = findNotificationBadgePlacement(placementTarget);
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
            actualTweetElement.insertBefore(loadingBadge, actualTweetElement.firstChild);
          }
        } else {
          const engagementBar = actualTweetElement.querySelector('[role="group"]');
          if (engagementBar) {
            const firstChild = engagementBar.firstElementChild;
            if (firstChild) {
              engagementBar.insertBefore(loadingBadge, firstChild);
            } else {
              engagementBar.appendChild(loadingBadge);
            }
          } else {
            const tweetContent = actualTweetElement.querySelector('div[data-testid="tweetText"]') ||
                                actualTweetElement.querySelector('div[lang]') ||
                                actualTweetElement.firstElementChild;
            if (tweetContent && tweetContent.parentElement) {
              tweetContent.parentElement.insertBefore(loadingBadge, tweetContent);
            } else {
              actualTweetElement.insertBefore(loadingBadge, actualTweetElement.firstChild);
            }
          }
        }
      } else if (settings.showIQBadge && !loadingBadge) {
        // No loading badge exists, try to find one
        // Check both nested and outer wrapper for nested structures
        loadingBadge = actualTweetElement.querySelector('.iq-badge[data-iq-loading="true"]') ||
                       actualTweetElement.querySelector('.iq-badge-loading');
        if (!loadingBadge && hasNestedStructure) {
          loadingBadge = tweetElement.querySelector('.iq-badge[data-iq-loading="true"]') ||
                         tweetElement.querySelector('.iq-badge-loading');
        }
        if (!loadingBadge) {
          // Only create new badge if none exists
          loadingBadge = createLoadingBadge();

          // Use correct placement logic for notification pages
          if (isNotificationsPage) {
            // For nested structures, use outer wrapper for placement
            const placementTarget = hasNestedStructure ? tweetElement : actualTweetElement;
            const placement = findNotificationBadgePlacement(placementTarget);
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
              actualTweetElement.insertBefore(loadingBadge, actualTweetElement.firstChild);
            }
          } else {
            const engagementBar = actualTweetElement.querySelector('[role="group"]');
            if (engagementBar) {
              const firstChild = engagementBar.firstElementChild;
              if (firstChild) {
                engagementBar.insertBefore(loadingBadge, firstChild);
              } else {
                engagementBar.appendChild(loadingBadge);
              }
            } else {
              const tweetContent = actualTweetElement.querySelector('div[data-testid="tweetText"]') ||
                                  actualTweetElement.querySelector('div[lang]') ||
                                  actualTweetElement.firstElementChild;
              if (tweetContent && tweetContent.parentElement) {
                tweetContent.parentElement.insertBefore(loadingBadge, tweetContent);
              } else {
                actualTweetElement.insertBefore(loadingBadge, actualTweetElement.firstChild);
              }
            }
          }
        }
      }

      const expandedTextRaw = await extractFullTextWithoutVisualExpansion(actualTweetElement);
      // Ensure URLs are removed from expanded text too
      const expandedText = expandedTextRaw && removeUrlsFromText ? removeUrlsFromText(expandedTextRaw) : expandedTextRaw;

      if (settings.showIQBadge && loadingBadge && !loadingBadge.parentElement) {
        // Re-insert existing badge instead of creating new one
        if (isNotificationsPage) {
          // For nested structures, use outer wrapper for placement
          const placementTarget = hasNestedStructure ? tweetElement : actualTweetElement;
          const placement = findNotificationBadgePlacement(placementTarget);
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
            actualTweetElement.insertBefore(loadingBadge, actualTweetElement.firstChild);
          }
        } else {
          const engagementBar = actualTweetElement.querySelector('[role="group"]');
          if (engagementBar) {
            const firstChild = engagementBar.firstElementChild;
            if (firstChild) {
              engagementBar.insertBefore(loadingBadge, firstChild);
            } else {
              engagementBar.appendChild(loadingBadge);
            }
          } else {
            const tweetContent = actualTweetElement.querySelector('div[data-testid="tweetText"]') ||
                                actualTweetElement.querySelector('div[lang]') ||
                                actualTweetElement.firstElementChild;
            if (tweetContent && tweetContent.parentElement) {
              tweetContent.parentElement.insertBefore(loadingBadge, tweetContent);
            } else {
              actualTweetElement.insertBefore(loadingBadge, actualTweetElement.firstChild);
            }
          }
        }
      } else if (settings.showIQBadge && !loadingBadge) {
        // No loading badge exists, try to find one
        // Check both nested and outer wrapper for nested structures
        loadingBadge = actualTweetElement.querySelector('.iq-badge[data-iq-loading="true"]') ||
                       actualTweetElement.querySelector('.iq-badge-loading');
        if (!loadingBadge && hasNestedStructure) {
          loadingBadge = tweetElement.querySelector('.iq-badge[data-iq-loading="true"]') ||
                         tweetElement.querySelector('.iq-badge-loading');
        }
        if (!loadingBadge) {
          // Only create new badge if none exists
          loadingBadge = createLoadingBadge();

          // Use correct placement logic for notification pages
          if (isNotificationsPage) {
            // For nested structures, use outer wrapper for placement
            const placementTarget = hasNestedStructure ? tweetElement : actualTweetElement;
            const placement = findNotificationBadgePlacement(placementTarget);
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
              actualTweetElement.insertBefore(loadingBadge, actualTweetElement.firstChild);
            }
          } else {
            const engagementBar = actualTweetElement.querySelector('[role="group"]');
            if (engagementBar) {
              const firstChild = engagementBar.firstElementChild;
              if (firstChild) {
                engagementBar.insertBefore(loadingBadge, firstChild);
              } else {
                engagementBar.appendChild(loadingBadge);
              }
            } else {
              const tweetContent = actualTweetElement.querySelector('div[data-testid="tweetText"]') ||
                                  actualTweetElement.querySelector('div[lang]') ||
                                  actualTweetElement.firstElementChild;
              if (tweetContent && tweetContent.parentElement) {
                tweetContent.parentElement.insertBefore(loadingBadge, tweetContent);
              } else {
                actualTweetElement.insertBefore(loadingBadge, actualTweetElement.firstChild);
              }
            }
          }
        }
      }

      if (expandedText && expandedText.length > Math.max(extractedLength, baselineLength) + 50) {
        tweetText = expandedText;
      } else if (expandedText && expandedText.length > extractedLength) {
        tweetText = expandedText;
      } else if (tweetText) {
        // Keep existing
      } else {
        tweetText = baselineText;
      }
    } else if (!tweetText) {
      tweetText = baselineText;
    }
  }

  try {
    if (settings.showIQBadge) {
      if (!loadingBadge) {
        // Check both nested and outer wrapper for nested structures
        loadingBadge = actualTweetElement.querySelector('.iq-badge[data-iq-loading="true"]') ||
                       actualTweetElement.querySelector('.iq-badge-loading');
        if (!loadingBadge && hasNestedStructure) {
          loadingBadge = tweetElement.querySelector('.iq-badge[data-iq-loading="true"]') ||
                         tweetElement.querySelector('.iq-badge-loading');
        }
        if (!loadingBadge) {
          loadingBadge = createLoadingBadge();
          // For nested structures on notifications page, use outer wrapper for placement
          const targetElement = (hasNestedStructure && isNotificationsPage) ? tweetElement : actualTweetElement;
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
      } else if (!loadingBadge.parentElement) {
        // Badge exists but not in DOM - re-insert it
        // For nested structures, use appropriate element based on where badge should be
        const targetElementForPlacement = (hasNestedStructure && isNotificationsPage) ? tweetElement : actualTweetElement;
        if (isNotificationsPage) {
          const placement = findNotificationBadgePlacement(targetElementForPlacement);
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
            actualTweetElement.insertBefore(loadingBadge, actualTweetElement.firstChild);
          }
        } else {
          const engagementBar = actualTweetElement.querySelector('[role="group"]');
          if (engagementBar) {
            const firstChild = engagementBar.firstElementChild;
            if (firstChild) {
              engagementBar.insertBefore(loadingBadge, firstChild);
            } else {
              engagementBar.appendChild(loadingBadge);
            }
          } else {
            const tweetContent = actualTweetElement.querySelector('div[data-testid="tweetText"]') ||
                                actualTweetElement.querySelector('div[lang]') ||
                                actualTweetElement.firstElementChild;
            if (tweetContent && tweetContent.parentElement) {
              tweetContent.parentElement.insertBefore(loadingBadge, tweetContent);
            } else {
              actualTweetElement.insertBefore(loadingBadge, actualTweetElement.firstChild);
            }
          }
        }
      }
    }

    // Extract limited metadata (privacy-compliant: no tweet text or URLs)
    let language = null;
    let hashtags = null;

    try {
      // Extract language from tweet element if available
      const tweetTextElement = actualTweetElement.querySelector('[data-testid="tweetText"]');
      if (tweetTextElement) {
        const langAttr = tweetTextElement.getAttribute('lang');
        if (langAttr) {
          language = langAttr;
        }
      }

      // Extract hashtags from tweet text (limited metadata - just the hashtag words, not full tweet)
      if (tweetText) {
        const hashtagMatches = tweetText.match(/#[\w]+/g);
        if (hashtagMatches && hashtagMatches.length > 0) {
          hashtags = hashtagMatches.map(tag => tag.substring(1).toLowerCase()); // Remove # and normalize
        }
      }
    } catch (e) {
      // Ignore errors in metadata extraction
    }

    // Check if IQGuessr mode is enabled - if so, don't calculate until user guesses
    const gameManager = getGameManager();
    const isGameModeEnabled = gameManager && gameManager.isGameModeEnabled && gameManager.isGameModeEnabled();
    // tweetId is already declared at function scope, just get it if needed
    if (!tweetId) {
      tweetId = actualTweetElement.getAttribute('data-tweet-id');
    }

    // In IQGuessr mode: only calculate if user already made a guess (cached guess exists)
    if (isGameModeEnabled && tweetId) {
      const cachedGuess = await gameManager.getCachedGuess(tweetId);
      if (!cachedGuess || cachedGuess.guess === undefined) {
        // IQGuessr enabled but no guess yet - skip calculation, store IQ result as null
        // The badge is already a guess badge (converted earlier), so we're done
        processedTweets.add(actualTweetElement);
        actualTweetElement.setAttribute('data-iq-analyzed', 'true');
        actualTweetElement.removeAttribute('data-iq-processing');
        actualTweetElement.removeAttribute('data-iq-processing-start');
        // Also mark outer wrapper as analyzed for nested structures
        if (hasNestedStructure) {
          tweetElement.setAttribute('data-iq-analyzed', 'true');
          processedTweets.add(tweetElement);
        }
        return; // Exit early, don't calculate
      }
      // Has cached guess - continue with calculation (will reveal after calculation)
    }

    // Get cached result by handle (not by tweet text)
    let result = handle ? getCachedIQ(handle) : null;
    let fromCache = false;

    if (!result) {
      // Not in cache, calculate new result
      const startTime = performance.now();

      // CRITICAL: Final URL removal pass before estimation to ensure text is clean
      if (tweetText && removeUrlsFromText) {
        const cleanedBeforeEstimate = removeUrlsFromText(tweetText);
        if (cleanedBeforeEstimate !== tweetText) {
          tweetText = cleanedBeforeEstimate;
        }
      }

      try {
        result = await iqEstimator.estimate(tweetText);

        if (result.is_valid && result.iq_estimate !== null && handle) {
          // Cache with metadata: handle, timestamp, language, hashtags
          // Privacy-compliant: NO tweet text or tweet URLs stored
          const metadata = {
            timestamp: new Date().toISOString(),
            language: language,
            hashtags: hashtags,
            extensionVersion: chrome.runtime.getManifest().version || null
          };
          cacheIQ(handle, result, metadata);
        }
      } catch (estimateError) {
        console.error(`[TweetProcessor] ERROR in IQ estimation:`, estimateError?.message || estimateError);
        throw estimateError;
      }
    } else {
      fromCache = true;

      // Check if cached result was calculated with different text length
      // If so, the cache is stale (e.g., URLs were included before but removed now)
      const cachedTextLength = result.text_length;
      const currentTextLength = tweetText.length;

      // Also check word count as a secondary validation
      const cachedWordCount = result.word_count;
      const currentWordCount = tweetText.split(/\s+/).filter(w => w.length > 0).length;

      // Check Twitter calibration flag
      const cachedIsTwitterCalibrated = result.is_twitter_calibrated;
      const isTweetLength = currentTextLength <= 300; // Should use Twitter calibration
      const calibrationMismatch = cachedIsTwitterCalibrated !== undefined && cachedIsTwitterCalibrated !== isTweetLength;

      // Invalidate cache if:
      // 1. Text length is missing (old cache entry) OR lengths differ significantly (>5 chars)
      // 2. Word count is missing (old cache entry) OR word counts differ
      // 3. Twitter calibration flags differ (indicates different text processing)
      const textLengthMismatch = cachedTextLength === undefined || Math.abs(cachedTextLength - currentTextLength) > 5;
      const wordCountMismatch = cachedWordCount === undefined || Math.abs(cachedWordCount - currentWordCount) > 0;

      // Force recalculation if we detect any mismatch
      const shouldRecalculate = textLengthMismatch || wordCountMismatch || calibrationMismatch;

      if (shouldRecalculate) {
        // Cached result is for different text - recalculate
        fromCache = false;
        const startTime = performance.now();

        // CRITICAL: Final URL removal pass before estimation to ensure text is clean
        if (tweetText && removeUrlsFromText) {
          const cleanedBeforeEstimate = removeUrlsFromText(tweetText);
          if (cleanedBeforeEstimate !== tweetText) {
            tweetText = cleanedBeforeEstimate;
          }
        }

        try {
          result = await iqEstimator.estimate(tweetText);

          if (result.is_valid && result.iq_estimate !== null && handle) {
            // Update cache with new result
            const metadata = {
              timestamp: new Date().toISOString(),
              language: language,
              hashtags: hashtags,
              extensionVersion: chrome.runtime.getManifest().version || null
            };
            cacheIQ(handle, result, metadata);
          }
        } catch (estimateError) {
          console.error(`[TweetProcessor] ERROR in IQ estimation (recalc):`, estimateError?.message || estimateError);
          throw estimateError;
        }
      }
    }

    if (result && result.is_valid && result.iq_estimate !== null && settings.showIQBadge) {
      const iq = Math.round(result.iq_estimate);
      const gameManager = getGameManager();
      const confidence = result.confidence ? Math.round(result.confidence) : null;

      // Ensure badge is in correct position before update
      if (isNotificationsPage && loadingBadge) {
        // Use outer wrapper for nested structures
        const positionCheckTarget = hasNestedStructure ? tweetElement : actualTweetElement;
        ensureCorrectBadgePosition(loadingBadge, positionCheckTarget, isNotificationsPage);
      }

      if (loadingBadge && loadingBadge.parentElement) {
        // Check if this is actually a guess badge now
        const isGuessBadge = loadingBadge.classList.contains('iq-badge-guess') ||
                            loadingBadge.hasAttribute('data-iq-guess');

        // If it's a guess badge, we should NOT automatically calculate
        // The user needs to click and guess first
        if (isGuessBadge) {
          // Store the result on the tweet element for later use when user guesses
          const tweetIdForLog = actualTweetElement.getAttribute('data-tweet-id');
          actualTweetElement._iqResult = {
            iq: iq,
            result: result,
            confidence: confidence,
            text: tweetText
          };

          // Cache as revealed immediately - once IQ is calculated, it should never allow guessing again
          if (tweetIdForLog && gameManager && gameManager.cacheRevealedIQ) {
            gameManager.cacheRevealedIQ(tweetIdForLog);
          }

          processedTweets.add(actualTweetElement);
          actualTweetElement.setAttribute('data-iq-analyzed', 'true');
          actualTweetElement.removeAttribute('data-iq-processing');
          actualTweetElement.removeAttribute('data-iq-processing-start');
          // Also mark outer wrapper as analyzed for nested structures
          if (hasNestedStructure) {
            tweetElement.setAttribute('data-iq-analyzed', 'true');
            processedTweets.add(tweetElement);
          }
        } else {
          // Use confidence color if setting is enabled, otherwise use IQ color
          const iqColor = (settings.useConfidenceForColor && confidence !== null)
            ? getConfidenceColor(confidence)
            : getIQColor(iq);

          // Check if game mode is enabled and we have a guess
          const guessData = gameManager && gameManager.getGuess ? gameManager.getGuess(actualTweetElement) : null;

          if (guessData && guessData.guess !== undefined) {
            // We have a guess, use the game manager's reveal function
            const tweetIdForLog = actualTweetElement.getAttribute('data-tweet-id');
            // Store that this IQ was revealed
            if (tweetIdForLog && gameManager && gameManager.cacheRevealedIQ) {
              gameManager.cacheRevealedIQ(tweetIdForLog);
            }
            if (gameManager && gameManager.revealActualScore) {
              gameManager.revealActualScore(loadingBadge, iq, iqColor, confidence, result, tweetText);
            }
          } else {
            // Store that this IQ was revealed (so it stays calculated after refresh/iqguessr toggle)
            const tweetIdForLog = actualTweetElement.getAttribute('data-tweet-id');
            if (tweetIdForLog && gameManager && gameManager.cacheRevealedIQ) {
              gameManager.cacheRevealedIQ(tweetIdForLog);
            }

            // No guess, proceed with normal animation

            // CRITICAL: Check if badge is still in DOM before proceeding
            if (!document.body.contains(loadingBadge)) {
              return;
            }

            // CRITICAL: Double-check badge is still in DOM before accessing getBoundingClientRect
            if (!document.body.contains(loadingBadge)) {
              return;
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
              // For nested structures, use outer wrapper for placement
              const placementTarget = hasNestedStructure ? tweetElement : actualTweetElement;
              const placement = findNotificationBadgePlacement(placementTarget);
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

            animateCountUp(loadingBadge, iq, iqColor);

            // Immediately after starting animation, ensure position is correct for notification pages
            if (isNotificationsPage && correctPosition) {
              // Use outer wrapper for nested structures
              const positionCheckTarget = hasNestedStructure ? tweetElement : actualTweetElement;
              // Fix position immediately after animation frame
              requestAnimationFrame(() => {
                ensureCorrectBadgePosition(loadingBadge, positionCheckTarget, isNotificationsPage);
              });

              // Also fix after a short delay to catch any layout shifts
              setTimeout(() => {
                ensureCorrectBadgePosition(loadingBadge, positionCheckTarget, isNotificationsPage);
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

            // Always add hover event listener for console debug info
            loadingBadge.addEventListener('mouseenter', () => {
              if (loadingBadge._debugData) {
                logDebugInfo(loadingBadge._debugData);
              }
            });
          }

          processedTweets.add(actualTweetElement);
          actualTweetElement.setAttribute('data-iq-analyzed', 'true');
          actualTweetElement.removeAttribute('data-iq-processing');
    actualTweetElement.removeAttribute('data-iq-processing-start');
          // Also mark outer wrapper as analyzed for nested structures
          if (hasNestedStructure) {
            tweetElement.setAttribute('data-iq-analyzed', 'true');
            processedTweets.add(tweetElement);
          }

          // Log badge position after update
          if (isNotificationsPage && loadingBadge) {
            // Use outer wrapper for nested structures
            const positionCheckTarget = hasNestedStructure ? tweetElement : actualTweetElement;
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
        }
      } else {
        // loadingBadge exists but doesn't have parentElement - transition it instead of creating new
        // First, ensure the badge is in the DOM
        if (!loadingBadge.parentElement) {
          // Re-insert badge into DOM before transitioning
          if (isNotificationsPage) {
            // For nested structures, use outer wrapper for placement
            const placementTarget = hasNestedStructure ? tweetElement : actualTweetElement;
            const placement = findNotificationBadgePlacement(placementTarget);
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
            const targetElement = hasNestedStructure ? tweetElement : actualTweetElement;
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

        // Now transition the existing badge (same logic as above)
        const confidence = result.confidence ? Math.round(result.confidence) : null;
        const iqColor = (settings.useConfidenceForColor && confidence !== null)
          ? getConfidenceColor(confidence)
          : getIQColor(iq);

        // Ensure badge is still in DOM before proceeding
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

        // Final check before animating
        if (!document.body.contains(loadingBadge)) {
          return;
        }

        // CRITICAL: Set data-confidence attribute BEFORE calling animateCountUp
        // animateCountUp checks for this attribute to determine if flip structure is needed
        // If we set it after, the flip structure won't be built and hover won't work
        if (confidence !== null) {
          loadingBadge.setAttribute('data-confidence', confidence);
        }

        animateCountUp(loadingBadge, iq, iqColor);

        // Remove min-height/min-width after animation settles
        setTimeout(() => {
          requestAnimationFrame(() => {
            const newRect = loadingBadge.getBoundingClientRect();
            if (newRect.height >= currentHeight && newRect.width >= currentWidth) {
              loadingBadge.style.removeProperty('min-height');
              loadingBadge.style.removeProperty('min-width');
            } else {
              loadingBadge.style.setProperty('min-height', `${currentHeight}px`, 'important');
              loadingBadge.style.setProperty('min-width', `${currentWidth}px`, 'important');
            }
          });
        }, 100);

        // Ensure position is correct for notification pages
        if (isNotificationsPage) {
          // Use outer wrapper for nested structures
          const positionCheckTarget = hasNestedStructure ? tweetElement : actualTweetElement;
          requestAnimationFrame(() => {
            ensureCorrectBadgePosition(loadingBadge, positionCheckTarget, isNotificationsPage);
          });
          setTimeout(() => {
            ensureCorrectBadgePosition(loadingBadge, positionCheckTarget, isNotificationsPage);
          }, 50);
        }

        // Store debug data
        loadingBadge._debugData = {
          iq: iq,
          result: result,
          text: tweetText,
          timestamp: new Date().toISOString(),
          analyzedTextLength: tweetText.length,
          analyzedWordCount: tweetText.split(/\s+/).filter(w => w.length > 0).length
        };

        if (confidence !== null) {
          if (document.body.contains(loadingBadge)) {
            loadingBadge.setAttribute('data-confidence', confidence);
          }
        }

        // Add hover event listener
        loadingBadge.addEventListener('mouseenter', () => {
          if (loadingBadge._debugData) {
            logDebugInfo(loadingBadge._debugData);
          }
        });

        processedTweets.add(actualTweetElement);
        actualTweetElement.setAttribute('data-iq-analyzed', 'true');
        actualTweetElement.removeAttribute('data-iq-processing');
    actualTweetElement.removeAttribute('data-iq-processing-start');

        // Final position check for notification pages
        if (isNotificationsPage) {
          // Use outer wrapper for nested structures
          const positionCheckTarget = hasNestedStructure ? tweetElement : actualTweetElement;
          setTimeout(() => {
            ensureCorrectBadgePosition(loadingBadge, positionCheckTarget, isNotificationsPage);
          }, 100);
        }
      }
    } else {
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
  } finally {
    actualTweetElement.removeAttribute('data-iq-processing');
    actualTweetElement.removeAttribute('data-iq-processing-start');
  }
}

/**
 * Process all visible tweets
 * NOTE: This function has been moved to helpers/processVisibleTweets.js
 * Keeping for backward compatibility - will be removed in future version
 */
function processVisibleTweets() {
  // Delegate to refactored module
  const { processVisibleTweets } = window.ProcessVisibleTweets || {};
  if (processVisibleTweets) {
    return processVisibleTweets(processedTweets);
  }
  // If module not loaded, log error (shouldn't happen)
  console.warn('ProcessVisibleTweets module not loaded');
}

/**
 * Lightweight function to add a loading badge to a single tweet
 * NOTE: This function has been moved to badgeManagement/loadingBadgeManager.js
 * Keeping for backward compatibility - will be removed in future version
 */
function addLoadingBadgeToTweet(tweet) {
  // Delegate to refactored module
  const { addLoadingBadgeToTweet } = window.LoadingBadgeManager || {};
  if (addLoadingBadgeToTweet) {
    return addLoadingBadgeToTweet(tweet);
  }
  // If module not loaded, log error (shouldn't happen)
  console.warn('LoadingBadgeManager module not loaded');
}

/**
 * Check for and reprocess stuck loading badges (safety net for notifications page)
 * NOTE: This function has been moved to badgeManagement/badgeCleanup.js
 * Keeping for backward compatibility - will be removed in future version
 */
function checkForStuckBadges() {
  // Delegate to refactored module
  const { checkForStuckBadges } = window.BadgeCleanup || {};
  if (checkForStuckBadges) {
    return checkForStuckBadges(processedTweets);
  }
  // If module not loaded, log error (shouldn't happen)
  console.warn('BadgeCleanup module not loaded');
}

/**
 * Setup MutationObserver to watch for new tweets
 * NOTE: This function has been moved to observers/tweetObserver.js
 * Keeping for backward compatibility - will be removed in future version
 */
function setupObserver() {
  // Delegate to refactored module
  const { setupObserver } = window.TweetObserver || {};
  if (setupObserver) {
    return setupObserver(processedTweets);
  }
  // If module not loaded, log error (shouldn't happen)
  console.warn('TweetObserver module not loaded');
  return null;
}

// Export for use in other modules (now handled by index.js)
if (typeof window !== 'undefined') {
  window.TweetProcessorCore = {
    processTweet
  };
}

})();

