/**
 * Text Expansion Helper
 * Handles expansion of truncated tweet text to get full content
 */

(function() {
  'use strict';

  // Get dependencies from other modules
  const getTextExtraction = () => window.TextExtraction || {};
  const getSettings = () => window.Settings || {};
  const getBadgeManager = () => window.BadgeManager || {};
  const getNotificationPlacement = () => window.NotificationBadgePlacement || {};
  const getNestedTweetHandler = () => window.NestedTweetHandler || {};

  /**
   * Check if tweet is already expanded
   *
   * @param {HTMLElement} actualTweetElement - The actual tweet element
   * @returns {boolean} Whether the tweet is already expanded
   */
  function isTweetAlreadyExpanded(actualTweetElement) {
    return Array.from(actualTweetElement.querySelectorAll('span[role="button"], button, div[role="button"]')).some(el => {
      const text = el.textContent.trim().toLowerCase();
      return text === 'show less' || text === 'read less' ||
             (text.includes('show') && text.includes('less'));
    });
  }

  /**
   * Expand tweet text if truncated
   * Handles both already-expanded tweets and truncated tweets
   *
   * @param {HTMLElement} actualTweetElement - The actual tweet element
   * @param {HTMLElement} outerElement - The outer wrapper element (if nested)
   * @param {boolean} hasNestedStructure - Whether this is a nested structure
   * @param {boolean} isNotificationsPage - Whether we're on the notifications page
   * @param {string} currentText - The current extracted text
   * @param {HTMLElement} loadingBadge - The loading badge element (if any)
   * @returns {Promise<string>} The expanded tweet text
   */
  async function expandTweetText(actualTweetElement, outerElement, hasNestedStructure, isNotificationsPage, currentText, loadingBadge) {
    const settings = getSettings();
    const { extractTweetText, isTweetTruncated, tryExtractFullTextWithoutExpanding, extractFullTextWithoutVisualExpansion, removeUrlsFromText } = getTextExtraction();
    const { getPlacementTarget } = getNestedTweetHandler();
    const { findNotificationBadgePlacement } = getNotificationPlacement() || {};
    const badgeManager = getBadgeManager();
    const { createLoadingBadge } = badgeManager || {};

    const alreadyExpanded = isTweetAlreadyExpanded(actualTweetElement);

    if (alreadyExpanded) {
      const expandedTextRaw = extractTweetText(actualTweetElement);
      const result = expandedTextRaw && removeUrlsFromText ? removeUrlsFromText(expandedTextRaw) : expandedTextRaw;
      return result;
    }

    const isTruncated = isTweetTruncated(actualTweetElement);

    if (isTruncated) {
      // First try non-visual extraction as optimization (might get full text from DOM)
      let tweetText = tryExtractFullTextWithoutExpanding(actualTweetElement);
      
      // Ensure URLs are removed
      if (tweetText && removeUrlsFromText) {
        tweetText = removeUrlsFromText(tweetText);
      }

      const baselineTextRaw = extractTweetText(actualTweetElement);
      
      // Ensure URLs are removed from baseline text too
      const baselineText = baselineTextRaw && removeUrlsFromText ? removeUrlsFromText(baselineTextRaw) : baselineTextRaw;
      const baselineLength = baselineText ? baselineText.length : 0;
      const extractedLength = tweetText ? tweetText.length : 0;
      
      // If we detected a "show more" button, we need to expand to get the full text
      // Non-visual extraction might only get partial text from DOM
      // Check if extracted text seems incomplete (ends abruptly, too short, or similar to baseline)
      const textEndsAbruptly = tweetText && (
        tweetText.endsWith('...') ||
        tweetText.endsWith('…')
      );
      
      // Determine if we should expand: if no text extracted, or difference is small, or ends abruptly
      // More aggressive threshold: if extracted is less than 250 chars longer than baseline, likely incomplete
      const shouldExpand = !tweetText ||
                          Math.abs(extractedLength - baselineLength) < 250 ||
                          textEndsAbruptly ||
                          (baselineLength > 20 && extractedLength < baselineLength + 300);

      // Always expand if we detected truncation and baseline text exists
      // This ensures we get the FULL text, not just what's visible in DOM
      if (shouldExpand && baselineLength > 15) {
        // Ensure loading badge is in place before expanding
        let badgeToEnsure = loadingBadge;
        if (settings.showIQBadge) {
          if (!badgeToEnsure || !badgeToEnsure.parentElement) {
            // Re-insert existing badge instead of creating new one
            if (isNotificationsPage) {
              // For nested structures, use outer wrapper for placement
              const placementTarget = getPlacementTarget(actualTweetElement, outerElement, hasNestedStructure, isNotificationsPage);
              const placement = findNotificationBadgePlacement ? findNotificationBadgePlacement(placementTarget) : null;
              if (placement) {
                const { targetElement, parentElement } = placement;
                if (placement.placement === 'before-tweet-content') {
                  if (badgeToEnsure) {
                    parentElement.insertBefore(badgeToEnsure, targetElement);
                  }
                } else {
                  if (badgeToEnsure) {
                    if (targetElement.nextSibling) {
                      parentElement.insertBefore(badgeToEnsure, targetElement.nextSibling);
                    } else {
                      parentElement.appendChild(badgeToEnsure);
                    }
                  }
                }
              } else {
                if (badgeToEnsure) {
                  actualTweetElement.insertBefore(badgeToEnsure, actualTweetElement.firstChild);
                }
              }
            } else {
              if (badgeToEnsure) {
                const engagementBar = actualTweetElement.querySelector('[role="group"]');
                if (engagementBar) {
                  const firstChild = engagementBar.firstElementChild;
                  if (firstChild) {
                    engagementBar.insertBefore(badgeToEnsure, firstChild);
                  } else {
                    engagementBar.appendChild(badgeToEnsure);
                  }
                } else {
                  const tweetContent = actualTweetElement.querySelector('div[data-testid="tweetText"]') ||
                                      actualTweetElement.querySelector('div[lang]') ||
                                      actualTweetElement.firstElementChild;
                  if (tweetContent && tweetContent.parentElement) {
                    tweetContent.parentElement.insertBefore(badgeToEnsure, tweetContent);
                  } else {
                    actualTweetElement.insertBefore(badgeToEnsure, actualTweetElement.firstChild);
                  }
                }
              }
            }
          }

          if (!badgeToEnsure) {
            // No loading badge exists, try to find one
            badgeToEnsure = actualTweetElement.querySelector('.iq-badge[data-iq-loading="true"]') ||
                           actualTweetElement.querySelector('.iq-badge-loading');
            if (!badgeToEnsure && hasNestedStructure && outerElement) {
              badgeToEnsure = outerElement.querySelector('.iq-badge[data-iq-loading="true"]') ||
                             outerElement.querySelector('.iq-badge-loading');
            }

            if (!badgeToEnsure && createLoadingBadge) {
              // Only create new badge if none exists
              badgeToEnsure = createLoadingBadge();

              // Use correct placement logic for notification pages
              if (isNotificationsPage) {
                // For nested structures, use outer wrapper for placement
                const placementTarget = getPlacementTarget(actualTweetElement, outerElement, hasNestedStructure, isNotificationsPage);
                const placement = findNotificationBadgePlacement ? findNotificationBadgePlacement(placementTarget) : null;
                if (placement) {
                  const { targetElement, parentElement } = placement;
                  if (placement.placement === 'before-tweet-content') {
                    parentElement.insertBefore(badgeToEnsure, targetElement);
                  } else {
                    if (targetElement.nextSibling) {
                      parentElement.insertBefore(badgeToEnsure, targetElement.nextSibling);
                    } else {
                      parentElement.appendChild(badgeToEnsure);
                    }
                  }
                } else {
                  actualTweetElement.insertBefore(badgeToEnsure, actualTweetElement.firstChild);
                }
              } else {
                const engagementBar = actualTweetElement.querySelector('[role="group"]');
                if (engagementBar) {
                  const firstChild = engagementBar.firstElementChild;
                  if (firstChild) {
                    engagementBar.insertBefore(badgeToEnsure, firstChild);
                  } else {
                    engagementBar.appendChild(badgeToEnsure);
                  }
                } else {
                  const tweetContent = actualTweetElement.querySelector('div[data-testid="tweetText"]') ||
                                      actualTweetElement.querySelector('div[lang]') ||
                                      actualTweetElement.firstElementChild;
                  if (tweetContent && tweetContent.parentElement) {
                    tweetContent.parentElement.insertBefore(badgeToEnsure, tweetContent);
                  } else {
                    actualTweetElement.insertBefore(badgeToEnsure, actualTweetElement.firstChild);
                  }
                }
              }
            }
          }
        }

        // Expand text without visual expansion
        const expandedTextRaw = await extractFullTextWithoutVisualExpansion(actualTweetElement);
        
        // Ensure URLs are removed from expanded text too
        const expandedText = expandedTextRaw && removeUrlsFromText ? removeUrlsFromText(expandedTextRaw) : expandedTextRaw;

        // Ensure badge is still in place after expansion
        if (settings.showIQBadge && badgeToEnsure && !badgeToEnsure.parentElement) {
          // Re-insert existing badge instead of creating new one
          if (isNotificationsPage) {
            // For nested structures, use outer wrapper for placement
            const placementTarget = getPlacementTarget(actualTweetElement, outerElement, hasNestedStructure, isNotificationsPage);
            const placement = findNotificationBadgePlacement ? findNotificationBadgePlacement(placementTarget) : null;
            if (placement) {
              const { targetElement, parentElement } = placement;
              if (placement.placement === 'before-tweet-content') {
                parentElement.insertBefore(badgeToEnsure, targetElement);
              } else {
                if (targetElement.nextSibling) {
                  parentElement.insertBefore(badgeToEnsure, targetElement.nextSibling);
                } else {
                  parentElement.appendChild(badgeToEnsure);
                }
              }
            } else {
              actualTweetElement.insertBefore(badgeToEnsure, actualTweetElement.firstChild);
            }
          } else {
            const engagementBar = actualTweetElement.querySelector('[role="group"]');
            if (engagementBar) {
              const firstChild = engagementBar.firstElementChild;
              if (firstChild) {
                engagementBar.insertBefore(badgeToEnsure, firstChild);
              } else {
                engagementBar.appendChild(badgeToEnsure);
              }
            } else {
              const tweetContent = actualTweetElement.querySelector('div[data-testid="tweetText"]') ||
                                  actualTweetElement.querySelector('div[lang]') ||
                                  actualTweetElement.firstElementChild;
              if (tweetContent && tweetContent.parentElement) {
                tweetContent.parentElement.insertBefore(badgeToEnsure, tweetContent);
              } else {
                actualTweetElement.insertBefore(badgeToEnsure, actualTweetElement.firstChild);
              }
            }
          }
        }

        // Choose the best text based on length
        if (expandedText && expandedText.length > Math.max(extractedLength, baselineLength) + 50) {
          return expandedText;
        } else if (expandedText && expandedText.length > extractedLength) {
          return expandedText;
        } else if (tweetText) {
          return tweetText;
        } else {
          return baselineText;
        }
      } else {
        if (!tweetText) {
          return baselineText;
        }
        return tweetText;
      }
    }

    return currentText;
  }

  // Export for use in other modules
  if (typeof window !== 'undefined') {
    window.TextExpansion = {
      isTweetAlreadyExpanded,
      expandTweetText
    };
  }
})();



