/**
 * Tweet Processing
 * Handles processing of tweets and managing IQ badge creation/updates
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
const getDebugLog = () => window.DOMHelpers?.debugLog || (() => {});

// Local state
const processedTweets = new Set();

/**
 * Log badge position details for debugging
 */
// Store previous positions to detect changes
const badgePositions = new Map();

function logBadgePosition(badge, context, handle) {
  if (!badge) {
    console.log(`[BadgePosition:${context}] Badge is null`);
    return;
  }

  // Detect if we're on notifications page
  const isNotificationsPage = window.location.href.includes('/notifications');

  const rect = badge.getBoundingClientRect();
  const parent = badge.parentElement;
  const parentRect = parent ? parent.getBoundingClientRect() : null;

  // Find nearby elements to understand context
  const siblings = parent ? Array.from(parent.children) : [];
  const badgeIndex = siblings.indexOf(badge);
  const prevSibling = badgeIndex > 0 ? siblings[badgeIndex - 1] : null;
  const nextSibling = badgeIndex < siblings.length - 1 ? siblings[badgeIndex + 1] : null;

  // Check if in engagement bar
  const engagementBar = badge.closest('[role="group"]');

  // Check if near notification text
  const notificationText = Array.from(badge.closest('article')?.querySelectorAll('span') || []).find(span => {
    const text = (span.textContent || '').toLowerCase();
    return text.includes('liked your post') ||
           text.includes('reposted') ||
           text.includes('replied to') ||
           text.includes('quoted your post');
  });

  const currentPos = {
    top: Math.round(rect.top),
    left: Math.round(rect.left)
  };

  // Get previous position if exists
  const prevPos = badgePositions.get(handle);
  const positionChanged = prevPos && (prevPos.top !== currentPos.top || prevPos.left !== currentPos.left);

  // Store current position
  badgePositions.set(handle, currentPos);

  // Get detailed placement info for debugging
  const placement = isNotificationsPage ? findNotificationBadgePlacement(badge.closest('article') || badge.closest('article[data-testid="tweet"]')) : null;
  const shouldBeInEngagementBar = !isNotificationsPage && !!badge.closest('article')?.querySelector('[role="group"]');

  const positionInfo = {
    handle: handle || 'unknown',
    context: context,
    timestamp: Date.now(),
    positionChanged: positionChanged || false,
    previousPosition: prevPos || null,
    positionDelta: prevPos ? {
      top: currentPos.top - prevPos.top,
      left: currentPos.left - prevPos.left
    } : null,
    badge: {
      inDOM: document.body.contains(badge),
      hasParent: !!parent,
      parentTag: parent?.tagName || 'none',
      parentClass: parent?.className || 'none',
      position: {
        top: currentPos.top,
        left: currentPos.left,
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      },
      relativeToParent: parentRect ? {
        top: Math.round(rect.top - parentRect.top),
        left: Math.round(rect.left - parentRect.left)
      } : null
    },
    siblings: {
      total: siblings.length,
      index: badgeIndex,
      prevSiblingTag: prevSibling?.tagName || 'none',
      prevSiblingText: prevSibling ? (prevSibling.textContent || '').substring(0, 50) : 'none',
      nextSiblingTag: nextSibling?.tagName || 'none',
      nextSiblingText: nextSibling ? (nextSibling.textContent || '').substring(0, 50) : 'none'
    },
    contextChecks: {
      inEngagementBar: !!engagementBar,
      engagementBarText: engagementBar ? (engagementBar.textContent || '').substring(0, 50) : 'none',
      nearNotificationText: !!notificationText,
      notificationTextContent: notificationText ? (notificationText.textContent || '').substring(0, 50) : 'none',
      shouldBeInEngagementBar: shouldBeInEngagementBar,
      expectedPlacement: placement ? {
        placement: placement.placement,
        targetElementTag: placement.targetElement?.tagName || 'none',
        targetElementText: placement.targetElement ? (placement.targetElement.textContent || '').substring(0, 50) : 'none',
        parentElementTag: placement.parentElement?.tagName || 'none',
        parentElementClass: placement.parentElement?.className || 'none',
        badgeInCorrectParent: parent === placement.parentElement,
        badgeCorrectlyPositioned: placement.placement === 'before-tweet-content'
          ? (badgeIndex === siblings.indexOf(placement.targetElement) - 1 || badgeIndex === siblings.indexOf(placement.targetElement))
          : (badgeIndex === siblings.indexOf(placement.targetElement) + 1)
      } : null
    }
  };

  if (positionChanged) {
    console.warn(`[BadgePosition:${context}] POSITION CHANGED!`, positionInfo);
    console.warn(`[BadgePosition:${context}] Position moved:`, {
      from: prevPos,
      to: currentPos,
      delta: positionInfo.positionDelta,
      inEngagementBar: positionInfo.contextChecks.inEngagementBar,
      shouldBeInEngagementBar: positionInfo.contextChecks.shouldBeInEngagementBar,
      expectedPlacement: positionInfo.contextChecks.expectedPlacement
    });
  } else {
    console.log(`[BadgePosition:${context}]`, positionInfo);
  }
}

/**
 * Find the correct placement location for notification badges
 * Returns the target element and parent where badge should be placed
 * Always places badge BELOW notification text (on a new line) for consistency
 */
function findNotificationBadgePlacement(tweetElement) {
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

/**
 * Ensure badge is in correct position for notification tweets
 * Returns true if badge was repositioned
 */
function ensureCorrectBadgePosition(badge, tweetElement, isNotificationsPage) {
  if (!isNotificationsPage || !badge || !badge.parentElement) {
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
    const beforePos = badge.getBoundingClientRect();

    console.log(`[ensureCorrectBadgePosition] Repositioning badge for ${tweetElement.getAttribute('data-handle') || 'unknown'}:`, {
      isInEngagementBar,
      isInCorrectParent,
      isPositionedCorrectly,
      currentParent: currentParent?.tagName || 'none',
      correctParent: parentElement?.tagName || 'none',
      placement: placement.placement,
      targetElement: targetElement?.tagName || 'none',
      beforePosition: { top: Math.round(beforePos.top), left: Math.round(beforePos.left) }
    });

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

    const afterPos = badge.getBoundingClientRect();
    console.log(`[ensureCorrectBadgePosition] Badge repositioned:`, {
      afterPosition: { top: Math.round(afterPos.top), left: Math.round(afterPos.left) },
      positionDelta: {
        top: Math.round(afterPos.top - beforePos.top),
        left: Math.round(afterPos.left - beforePos.left)
      }
    });

    return true;
  }

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

  const { extractTweetText, isTweetTruncated, tryExtractFullTextWithoutExpanding, extractFullTextWithoutVisualExpansion, extractTweetHandle } = getTextExtraction();
  const { validateTweetText } = getTweetDetection();
  const badgeManager = getBadgeManager();
  if (!badgeManager || !badgeManager.createLoadingBadge) {
    const debugLogFn = getDebugLog();
    debugLogFn('BadgeManager not available yet');
    return;
  }
  const { createLoadingBadge, createInvalidBadge, getIQColor, getConfidenceColor, createIQBadge, animateCountUp, updateBadgeWithFlipStructure, logDebugInfo, hexToRgb, desaturateColor } = badgeManager;
  const { getCachedIQ, cacheIQ } = getIQCache();
  const debugLogFn = getDebugLog(); // Get debugLog function (avoid shadowing outer debugLog)
  const iqEstimator = window.ComprehensiveIQEstimatorUltimate ? new window.ComprehensiveIQEstimatorUltimate() : null;

  if (!iqEstimator) {
    debugLogFn('IQ Estimator not available yet');
    return;
  }

  // Handle nested tweet structures
  let actualTweetElement = tweetElement;
  const nestedTweet = tweetElement.querySelector('article[data-testid="tweet"]') ||
                      tweetElement.querySelector('article[role="article"]');
  if (nestedTweet && nestedTweet !== tweetElement) {
    actualTweetElement = nestedTweet;
    tweetElement.setAttribute('data-iq-analyzed', 'true');
  }

  if (actualTweetElement.hasAttribute('data-iq-analyzed')) {
    return;
  }

  const existingBadge = actualTweetElement.querySelector('.iq-badge');
  if (existingBadge && !existingBadge.hasAttribute('data-iq-loading') &&
      !existingBadge.classList.contains('iq-badge-loading') &&
      !existingBadge.hasAttribute('data-iq-invalid')) {
    actualTweetElement.setAttribute('data-iq-analyzed', 'true');
    return;
  }

  actualTweetElement.setAttribute('data-iq-processing', 'true');

  // Extract handle early for game mode
  let handle = extractTweetHandle(actualTweetElement);
  if (handle) {
    actualTweetElement.setAttribute('data-handle', handle);
  }

  let tweetText = extractTweetText(actualTweetElement);

  // Debug for notifications page user tweets
  const isNotificationsPage = window.location.href.includes('/notifications');
  const debugId = `tweet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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
      const existingBadge = actualTweetElement.querySelector('.iq-badge');
      if (existingBadge) {
        existingBadge.remove();
      }
      const invalidBadge = createInvalidBadge();
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
    actualTweetElement.setAttribute('data-iq-analyzed', 'true');
    actualTweetElement.removeAttribute('data-iq-processing');
    return;
  }

  const validation = validateTweetText(tweetText);
  if (!validation.isValid) {
    if (settings.showIQBadge) {
      const existingBadge = actualTweetElement.querySelector('.iq-badge');
      if (existingBadge) {
        existingBadge.remove();
      }
      const invalidBadge = createInvalidBadge();
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
    actualTweetElement.setAttribute('data-iq-analyzed', 'true');
    actualTweetElement.removeAttribute('data-iq-processing');
    return;
  }

  let loadingBadge = null;
  if (settings.showIQBadge) {
    loadingBadge = actualTweetElement.querySelector('.iq-badge[data-iq-loading="true"]') ||
                   actualTweetElement.querySelector('.iq-badge-loading');

    if (!loadingBadge) {
      loadingBadge = createLoadingBadge();

      // Special handling for notification page tweets
      if (isNotificationsPage) {
        // Use helper function to find correct placement
        const placement = findNotificationBadgePlacement(actualTweetElement);

        console.log(`[BadgePlacement:initial] Finding placement for ${handle || 'unknown'}:`, {
          foundPlacement: !!placement,
          placementType: placement?.placement || 'none',
          targetElementTag: placement?.targetElement?.tagName || 'none',
          targetElementText: placement?.targetElement ? (placement.targetElement.textContent || '').substring(0, 50) : 'none',
          parentElementTag: placement?.parentElement?.tagName || 'none'
        });

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

          const afterInsertPos = loadingBadge.getBoundingClientRect();
          console.log(`[BadgePlacement:initial] Badge inserted for ${handle || 'unknown'}:`, {
            beforePosition: { top: Math.round(beforeInsertPos.top), left: Math.round(beforeInsertPos.left) },
            afterPosition: { top: Math.round(afterInsertPos.top), left: Math.round(afterInsertPos.left) },
            parent: loadingBadge.parentElement?.tagName || 'none',
            siblingsCount: loadingBadge.parentElement ? loadingBadge.parentElement.children.length : 0,
            badgeIndex: loadingBadge.parentElement ? Array.from(loadingBadge.parentElement.children).indexOf(loadingBadge) : -1,
            targetIndex: loadingBadge.parentElement && targetElement.parentElement === parentElement
              ? Array.from(parentElement.children).indexOf(targetElement) : -1
          });
        } else {
          console.warn(`[BadgePlacement:initial] No placement found for ${handle || 'unknown'}, using fallback`);
          // Last resort: place at start of tweet element
          actualTweetElement.insertBefore(loadingBadge, actualTweetElement.firstChild);
        }

        // Verify and fix position if needed - check immediately and after delay
        requestAnimationFrame(() => {
          const wasRepositioned = ensureCorrectBadgePosition(loadingBadge, actualTweetElement, isNotificationsPage);
          if (wasRepositioned) {
            console.log(`[BadgePlacement:initial] Badge was repositioned (RAF) for ${handle || 'unknown'}`);
          }
        });

        setTimeout(() => {
          const wasRepositioned = ensureCorrectBadgePosition(loadingBadge, actualTweetElement, isNotificationsPage);
          if (wasRepositioned) {
            console.log(`[BadgePlacement:initial] Badge was repositioned (50ms delay) for ${handle || 'unknown'}`);
          }
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

      // Log badge position after initial placement
      if (isNotificationsPage) {
        // Immediately verify and fix position
        ensureCorrectBadgePosition(loadingBadge, actualTweetElement, isNotificationsPage);
        // Use setTimeout to log after any DOM updates from repositioning
        setTimeout(() => {
          logBadgePosition(loadingBadge, 'initial-placement', handle);
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

    // Log badge position before IQ estimation
    if (isNotificationsPage && loadingBadge) {
      // Ensure badge is in correct position before IQ estimation
      ensureCorrectBadgePosition(loadingBadge, actualTweetElement, isNotificationsPage);
      logBadgePosition(loadingBadge, 'before-iq-estimation', handle);
    }
  }

  if (settings.showIQBadge && loadingBadge) {
    if (!loadingBadge.parentElement) {
      loadingBadge = createLoadingBadge();

      // Use the same placement logic as initial creation
      if (isNotificationsPage) {
        // For notification tweets, place badge after notification text
        const allSpans = Array.from(actualTweetElement.querySelectorAll('span'));
        const notificationText = allSpans.find(span => {
          const text = (span.textContent || '').toLowerCase();
          return text.includes('liked your post') ||
                 text.includes('reposted') ||
                 text.includes('replied to') ||
                 text.includes('quoted your post') ||
                 text.includes('liked') && text.includes('post') ||
                 text.includes('repost');
        });

        const notificationDiv = !notificationText ? Array.from(actualTweetElement.querySelectorAll('div')).find(div => {
          const text = (div.textContent || '').toLowerCase();
          return (text.includes('liked your post') ||
                  text.includes('reposted') ||
                  text.includes('replied to') ||
                  text.includes('quoted your post')) &&
                 !div.querySelector('article[data-testid="tweet"]');
        }) : null;

        const targetElement = notificationText || notificationDiv;

        if (targetElement && targetElement.parentElement) {
          const notificationParent = targetElement.parentElement;
          if (targetElement.nextSibling) {
            notificationParent.insertBefore(loadingBadge, targetElement.nextSibling);
          } else {
            notificationParent.appendChild(loadingBadge);
          }
        } else {
          const tweetContent = actualTweetElement.querySelector('div[data-testid="tweetText"]') ||
                              actualTweetElement.querySelector('div[lang]');
          if (tweetContent && tweetContent.parentElement) {
            tweetContent.parentElement.insertBefore(loadingBadge, tweetContent);
          } else {
            actualTweetElement.insertBefore(loadingBadge, actualTweetElement.firstChild);
          }
        }
      } else {
        // Normal tweet pages: use engagement bar
        const engagementBar = actualTweetElement.querySelector('[role="group"]');
        if (engagementBar) {
          const firstChild = engagementBar.firstElementChild;
          if (firstChild) {
            engagementBar.insertBefore(loadingBadge, firstChild);
          } else {
            engagementBar.appendChild(loadingBadge);
          }
        }
      }
    }
  }

  // If game mode is enabled, replace loading badge with guess badge
  if (loadingBadge && settings.showIQBadge) {
    const gameManager = getGameManager();
    if (gameManager && gameManager.isGameModeEnabled && gameManager.isGameModeEnabled()) {
      const guessBadge = gameManager.replaceLoadingBadgeWithGuess(loadingBadge);
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
        loadingBadge = actualTweetElement.querySelector('.iq-badge[data-iq-loading="true"]') ||
                       actualTweetElement.querySelector('.iq-badge-loading');
        if (!loadingBadge) {
          loadingBadge = createLoadingBadge();

          // Use correct placement logic for notification pages
          if (isNotificationsPage) {
            const placement = findNotificationBadgePlacement(actualTweetElement);
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
            }
          }
        }
      }

      const expandedTextRaw = await extractFullTextWithoutVisualExpansion(actualTweetElement);
      // Ensure URLs are removed from expanded text too
      const expandedText = expandedTextRaw && removeUrlsFromText ? removeUrlsFromText(expandedTextRaw) : expandedTextRaw;

      if (settings.showIQBadge && loadingBadge && !loadingBadge.parentElement) {
        loadingBadge = actualTweetElement.querySelector('.iq-badge[data-iq-loading="true"]') ||
                       actualTweetElement.querySelector('.iq-badge-loading');
        if (!loadingBadge) {
          loadingBadge = createLoadingBadge();

          // Use correct placement logic for notification pages
          if (isNotificationsPage) {
            const placement = findNotificationBadgePlacement(actualTweetElement);
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
      if (!loadingBadge || !loadingBadge.parentElement) {
        loadingBadge = actualTweetElement.querySelector('.iq-badge[data-iq-loading="true"]') ||
                       actualTweetElement.querySelector('.iq-badge-loading');
        if (!loadingBadge) {
          loadingBadge = createLoadingBadge();
          const engagementBar = actualTweetElement.querySelector('[role="group"]');
          if (engagementBar) {
            const firstChild = engagementBar.firstElementChild;
            if (firstChild) {
              engagementBar.insertBefore(loadingBadge, firstChild);
            } else {
              engagementBar.appendChild(loadingBadge);
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

    // Get cached result by handle (not by tweet text)
    let result = handle ? getCachedIQ(handle) : null;
    let fromCache = false;

    if (!result) {
      // Not in cache, calculate new result
      const startTime = performance.now();

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

      // Log badge position before update
      if (isNotificationsPage && loadingBadge) {
        // Ensure badge is in correct position before update
        ensureCorrectBadgePosition(loadingBadge, actualTweetElement, isNotificationsPage);
        logBadgePosition(loadingBadge, 'before-update', handle);
      }

      if (loadingBadge && loadingBadge.parentElement) {
        // Check if this is actually a guess badge now
        const isGuessBadge = loadingBadge.classList.contains('iq-badge-guess') ||
                            loadingBadge.hasAttribute('data-iq-guess');

        // If it's a guess badge, we should NOT automatically calculate
        // The user needs to click and guess first
        if (isGuessBadge) {
          // Store the result on the tweet element for later use when user guesses
          actualTweetElement._iqResult = {
            iq: iq,
            result: result,
            confidence: confidence,
            text: tweetText
          };
          processedTweets.add(actualTweetElement);
          actualTweetElement.setAttribute('data-iq-analyzed', 'true');
          actualTweetElement.removeAttribute('data-iq-processing');
        } else {
          // Use confidence color if setting is enabled, otherwise use IQ color
          const iqColor = (settings.useConfidenceForColor && confidence !== null)
            ? getConfidenceColor(confidence)
            : getIQColor(iq);

          // Check if game mode is enabled and we have a guess
          const guessData = gameManager && gameManager.getGuess ? gameManager.getGuess(actualTweetElement) : null;

          if (guessData && guessData.guess !== undefined) {
            // We have a guess, use the game manager's reveal function
            if (gameManager && gameManager.revealActualScore) {
              gameManager.revealActualScore(loadingBadge, iq, iqColor, confidence, result, tweetText);
            }
          } else {
            // No guess, proceed with normal animation
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
              const placement = findNotificationBadgePlacement(actualTweetElement);
              if (placement) {
                correctPosition = {
                  targetElement: placement.targetElement,
                  parentElement: placement.parentElement,
                  placement: placement.placement
                };
              }
            }

            animateCountUp(loadingBadge, iq, iqColor);

            // Immediately after starting animation, ensure position is correct for notification pages
            if (isNotificationsPage && correctPosition) {
              // Fix position immediately after animation frame
              requestAnimationFrame(() => {
                ensureCorrectBadgePosition(loadingBadge, actualTweetElement, isNotificationsPage);
              });

              // Also fix after a short delay to catch any layout shifts
              setTimeout(() => {
                ensureCorrectBadgePosition(loadingBadge, actualTweetElement, isNotificationsPage);
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

            if (confidence !== null) {
              loadingBadge.setAttribute('data-confidence', confidence);
              updateBadgeWithFlipStructure(loadingBadge, iq, confidence);
            }

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

          // Log badge position after update
          if (isNotificationsPage && loadingBadge) {
            // Immediately fix position
            ensureCorrectBadgePosition(loadingBadge, actualTweetElement, isNotificationsPage);

            // Use multiple checks to ensure position stays correct during animation
            // Check immediately after next frame
            requestAnimationFrame(() => {
              ensureCorrectBadgePosition(loadingBadge, actualTweetElement, isNotificationsPage);
            });

            // Check after short delay
            setTimeout(() => {
              ensureCorrectBadgePosition(loadingBadge, actualTweetElement, isNotificationsPage);
            }, 50);

            // Final check and log after DOM settles
            setTimeout(() => {
              ensureCorrectBadgePosition(loadingBadge, actualTweetElement, isNotificationsPage);
              logBadgePosition(loadingBadge, 'after-update', handle);
            }, 200);
          }
        }
      } else {
        const badge = createIQBadge(iq, result, tweetText);

        const confidence = result.confidence ? Math.round(result.confidence) : null;
        if (confidence !== null) {
          badge.setAttribute('data-confidence', confidence);
        }

        // Use confidence color if setting is enabled, otherwise use IQ color
        const iqColor = (settings.useConfidenceForColor && confidence !== null)
          ? getConfidenceColor(confidence)
          : getIQColor(iq);
        badge._animationData = {
          finalIQ: iq,
          iqColor: iqColor
        };

        badge.setAttribute('data-final-iq', iq);

        const scoreElement = badge.querySelector('.iq-score');
        if (scoreElement) {
          scoreElement.textContent = '0';
        }

        // Use BadgeManager's helper functions if needed, but getIQColor handles colors
        // For loading state, we'll use a simple approach
        const darkerRed = '#b71c1c';
        const rgb = hexToRgb(darkerRed);
        const desat = desaturateColor(rgb, 0.5);
        const loadingColor = `rgb(${desat.r}, ${desat.g}, ${desat.b})`;
        badge.style.setProperty('background-color', loadingColor, 'important');

        animateCountUp(badge, iq, iqColor);

        // Use correct placement logic for notification pages
        if (isNotificationsPage) {
          const placement = findNotificationBadgePlacement(actualTweetElement);
          if (placement) {
            const { targetElement, parentElement } = placement;

            // Always ensure badge appears on its own line (below notification)
            if (placement.placement === 'before-tweet-content') {
              parentElement.insertBefore(badge, targetElement);
            } else {
              // After notification - find block-level container
              let insertionParent = parentElement;
              let insertionPoint = targetElement;

              if (targetElement.tagName === 'SPAN') {
                let blockParent = targetElement.parentElement;
                while (blockParent && blockParent !== actualTweetElement) {
                  const computedStyle = window.getComputedStyle(blockParent);
                  const display = computedStyle.display;
                  if (display === 'block' || display === 'flex' || display === 'grid' ||
                      blockParent.tagName === 'DIV' || blockParent.tagName === 'ARTICLE') {
                    insertionParent = blockParent;
                    insertionPoint = blockParent;

                    let nextSibling = blockParent.nextElementSibling;
                    if (nextSibling) {
                      insertionPoint = nextSibling;
                    }
                    break;
                  }
                  blockParent = blockParent.parentElement;
                }
              }

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
            }

            // Force block-level display to ensure badge appears on its own line
            badge.style.setProperty('display', 'block', 'important');
            badge.style.setProperty('width', '100%', 'important');
          } else {
            actualTweetElement.appendChild(badge);
          }
        } else {
          const engagementBar = actualTweetElement.querySelector('[role="group"]');
          if (engagementBar) {
            const firstChild = engagementBar.firstElementChild;
            if (firstChild) {
              engagementBar.insertBefore(badge, firstChild);
            } else {
              engagementBar.appendChild(badge);
            }
          } else {
            actualTweetElement.appendChild(badge);
          }
        }

        processedTweets.add(actualTweetElement);
        actualTweetElement.setAttribute('data-iq-analyzed', 'true');
        actualTweetElement.removeAttribute('data-iq-processing');

        // Log badge position after creation
        if (isNotificationsPage) {
          setTimeout(() => {
            logBadgePosition(badge, 'after-creation', handle);
          }, 100);
        }
      }
    } else {
      if (loadingBadge) {
        loadingBadge.remove();
      }
      actualTweetElement.removeAttribute('data-iq-processing');
    }
  } catch (error) {
    console.error(`[TweetProcessor] ERROR processing tweet:`, error?.message || error);
    if (loadingBadge) {
      loadingBadge.remove();
    }
  } finally {
    actualTweetElement.removeAttribute('data-iq-processing');
  }
}

/**
 * Process all visible tweets
 */
function processVisibleTweets() {
  const settings = getSettings();
  const isNotificationsPage = window.location.href.includes('/notifications');

  const tweetSelectors = [
    'article[data-testid="tweet"]',
    'article[role="article"]',
    'div[data-testid="cellInnerDiv"] > article'
  ];

  let tweets = [];
  for (const selector of tweetSelectors) {
    tweets = document.querySelectorAll(selector);
    if (tweets.length > 0) break;
  }

  if (tweets.length === 0) {
    tweets = document.querySelectorAll('article');
  }


  const processedTweetElements = new Set();
  const newTweets = [];

  const skippedTweets = [];
  Array.from(tweets).forEach((tweet, index) => {
    if (!tweet) {
      if (isNotificationsPage && index < 5) {
        skippedTweets.push({ reason: 'tweet is null/falsy', index });
      }
      return;
    }

    if (tweet.hasAttribute('data-iq-processing')) {
      if (isNotificationsPage && index < 5) {
        skippedTweets.push({ reason: 'already processing', index });
      }
      return;
    }

    const nestedTweet = tweet.querySelector('article[data-testid="tweet"]') ||
                        tweet.querySelector('article[role="article"]');

    let actualTweet = tweet;
    if (nestedTweet && nestedTweet !== tweet) {
      actualTweet = nestedTweet;
    }

    if (actualTweet.hasAttribute('data-iq-analyzed')) {
      const existingBadge = actualTweet.querySelector('.iq-badge');
      const isStuckInLoading = existingBadge && (
        existingBadge.hasAttribute('data-iq-loading') ||
        existingBadge.classList.contains('iq-badge-loading') ||
        (!existingBadge.hasAttribute('data-iq-score') && !existingBadge.hasAttribute('data-iq-invalid'))
      );

      if (isStuckInLoading) {
        // Tweet is stuck in loading state - force reprocess
        actualTweet.removeAttribute('data-iq-analyzed');
        processedTweets.delete(actualTweet);
        if (existingBadge && existingBadge.parentElement) {
          existingBadge.remove();
        }
      } else if (!existingBadge && settings.showIQBadge) {
        actualTweet.removeAttribute('data-iq-analyzed');
        processedTweets.delete(actualTweet);
      } else {
        if (isNotificationsPage && index < 5) {
          skippedTweets.push({
            reason: 'already analyzed with badge',
            index,
            hasBadge: !!existingBadge,
            isStuckInLoading: isStuckInLoading,
            handle: actualTweet.getAttribute('data-handle')
          });
        }
        return;
      }
    }

    if (nestedTweet && nestedTweet !== tweet) {
      if (!nestedTweet.hasAttribute('data-iq-analyzed') &&
          !nestedTweet.hasAttribute('data-iq-processing') &&
          !processedTweetElements.has(nestedTweet)) {
        newTweets.push(nestedTweet);
        processedTweetElements.add(nestedTweet);
      } else {
        if (isNotificationsPage && index < 5) {
          skippedTweets.push({
            reason: 'nested tweet conditions not met',
            index,
            isAnalyzed: nestedTweet.hasAttribute('data-iq-analyzed'),
            isProcessing: nestedTweet.hasAttribute('data-iq-processing'),
            alreadyInSet: processedTweetElements.has(nestedTweet),
            handle: nestedTweet.getAttribute('data-handle')
          });
        }
      }
    } else {
      const hasTweetText = tweet.querySelector('[data-testid="tweetText"]');
      const hasEngagementBar = tweet.querySelector('[role="group"]');

      if ((hasTweetText || hasEngagementBar) && !processedTweetElements.has(tweet)) {
        newTweets.push(tweet);
        processedTweetElements.add(tweet);
      } else {
        if (isNotificationsPage && index < 5) {
          skippedTweets.push({
            reason: 'direct tweet conditions not met',
            index,
            hasTweetText: !!hasTweetText,
            hasEngagementBar: !!hasEngagementBar,
            alreadyInSet: processedTweetElements.has(tweet),
            handle: tweet.getAttribute('data-handle')
          });
        }
      }
    }
  });


  if (settings.showIQBadge) {
    newTweets.forEach((tweet) => {
      setTimeout(() => {
        if (!tweet.querySelector('.iq-badge')) {
          addLoadingBadgeToTweet(tweet);
        }
      }, 0);
    });
  }

  setTimeout(() => {
    newTweets.forEach((tweet) => {
      processTweet(tweet);
    });
  }, 0);
}

/**
 * Lightweight function to add a loading badge to a single tweet
 */
function addLoadingBadgeToTweet(tweet) {
  const settings = getSettings();
  const badgeManager = getBadgeManager();

  if (!badgeManager || !badgeManager.createLoadingBadge) {
    return; // BadgeManager not loaded yet
  }

  const { createLoadingBadge } = badgeManager;

  if (!settings.showIQBadge || tweet.querySelector('.iq-badge')) {
    return;
  }

  let actualTweet = tweet;
  const nestedTweet = tweet.querySelector('article[data-testid="tweet"]') ||
                      tweet.querySelector('article[role="article"]');
  if (nestedTweet && nestedTweet !== tweet) {
    actualTweet = nestedTweet;
  }

  const isNotificationsPage = window.location.href.includes('/notifications');
  const loadingBadge = createLoadingBadge();

  // Special handling for notification page tweets
  if (isNotificationsPage) {
    const placement = findNotificationBadgePlacement(actualTweet);
    if (placement) {
      const { targetElement, parentElement } = placement;
      try {
        if (placement.placement === 'before-tweet-content') {
          parentElement.insertBefore(loadingBadge, targetElement);
        } else {
          // After notification text/div
          if (targetElement.nextSibling) {
            parentElement.insertBefore(loadingBadge, targetElement.nextSibling);
          } else {
            parentElement.appendChild(loadingBadge);
          }
        }
      } catch (e) {
        // Silent fail
      }
    } else {
      // Fallback: place at start of tweet element
      try {
        actualTweet.insertBefore(loadingBadge, actualTweet.firstChild);
      } catch (e) {
        // Silent fail
      }
    }
  } else {
    // Normal tweet pages: use engagement bar if available
    const engagementBar = actualTweet.querySelector('[role="group"]');
    if (engagementBar) {
      try {
        const firstChild = engagementBar.firstElementChild;
        if (firstChild) {
          engagementBar.insertBefore(loadingBadge, firstChild);
        } else {
          engagementBar.appendChild(loadingBadge);
        }
      } catch (e) {
        // Silent fail
      }
    } else {
      try {
        actualTweet.insertBefore(loadingBadge, actualTweet.firstChild);
      } catch (e) {
        // Silent fail
      }
    }
  }
}

/**
 * Check for and reprocess stuck loading badges (safety net for notifications page)
 */
function checkForStuckBadges() {
  const isNotificationsPage = window.location.href.includes('/notifications');
  if (!isNotificationsPage) return;

  const loadingBadges = document.querySelectorAll('.iq-badge[data-iq-loading="true"], .iq-badge-loading');
  const stuckBadges = Array.from(loadingBadges).filter(badge => {
    // Check if badge has been loading for more than 5 seconds (has no score)
    const hasScore = badge.hasAttribute('data-iq-score');
    const hasInvalid = badge.hasAttribute('data-iq-invalid');
    const isReallyStuck = !hasScore && !hasInvalid;

    // Also check if badge is older than 5 seconds (we can approximate by checking if parent exists)
    if (isReallyStuck && badge.parentElement) {
      const tweetElement = badge.closest('article[data-testid="tweet"]') ||
                          badge.closest('article[role="article"]') ||
                          badge.closest('article');
      if (tweetElement) {
        return true;
      }
    }
    return false;
  });

  if (stuckBadges.length > 0) {
    stuckBadges.forEach(badge => {
      const tweetElement = badge.closest('article[data-testid="tweet"]') ||
                          badge.closest('article[role="article"]') ||
                          badge.closest('article');
      if (tweetElement) {
        const handle = tweetElement.getAttribute('data-handle');

        // Remove the stuck badge and mark tweet for reprocessing
        if (tweetElement.hasAttribute('data-iq-analyzed')) {
          tweetElement.removeAttribute('data-iq-analyzed');
          processedTweets.delete(tweetElement);
        }
        if (badge.parentElement) {
          badge.remove();
        }
        // Reprocess after a short delay
        setTimeout(() => {
          processTweet(tweetElement);
        }, 100);
      }
    });
  }
}

/**
 * Setup MutationObserver to watch for new tweets
 */
function setupObserver() {
  const isNotificationsPage = window.location.href.includes('/notifications');

  // Setup periodic check for stuck badges on notifications page
  if (isNotificationsPage) {
    // Check immediately, then every 3 seconds
    setTimeout(checkForStuckBadges, 2000);
    setInterval(checkForStuckBadges, 3000);
  }

  const observer = new MutationObserver((mutations) => {
    const potentialTweets = [];
    const isNotificationsPageCheck = window.location.href.includes('/notifications');

    for (let i = 0; i < mutations.length; i++) {
      const mutation = mutations[i];
      for (let j = 0; j < mutation.addedNodes.length; j++) {
        const node = mutation.addedNodes[j];
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.tagName === 'ARTICLE') {
            potentialTweets.push(node);
          }
          if (node.querySelector) {
            const articles = node.querySelectorAll('article');
            if (articles.length > 0) {
              for (let k = 0; k < articles.length; k++) {
                potentialTweets.push(articles[k]);
              }
            }
          }
        }
      }
    }


    if (potentialTweets.length > 0) {
      setTimeout(() => {
        potentialTweets.forEach((tweet) => {
          if (tweet.hasAttribute('data-iq-analyzed') ||
              tweet.hasAttribute('data-iq-processing') ||
              tweet.querySelector('.iq-badge')) {
            return;
          }
          addLoadingBadgeToTweet(tweet);
        });
      }, 0);
    }

    if (potentialTweets.length > 0) {
      setTimeout(() => {
        processVisibleTweets();
      }, 0);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });


  return observer;
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.TweetProcessor = {
    processTweet,
    processVisibleTweets,
    addLoadingBadgeToTweet,
    setupObserver,
    processedTweets
  };
}

})();

