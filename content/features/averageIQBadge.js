/**
 * Average IQ Badge Feature
 * Displays user's average IQ badge on profile page
 */

(function() {
  'use strict';

  const getSettings = () => window.Settings || {};
  const getBadgeManager = () => window.BadgeManager || {};
  const getUserAverageIQ = () => window.UserAverageIQ || {};

  let badgeObserver = null;
  let insertBadgeTimeout = null;

  /**
   * Create average IQ badge element
   */
  function createAverageIQBadge(averageIQ, overallConfidence) {
    const badgeManager = getBadgeManager();
    const { getConfidenceColor } = badgeManager || {};

    const badge = document.createElement('span');
    badge.className = 'iq-badge iq-badge-average iq-badge-flip';
    badge.setAttribute('data-iq-average', 'true');
    badge.setAttribute('data-iq-score', averageIQ);
    badge.setAttribute('data-confidence', overallConfidence);

    // Calculate color based on confidence
    const confidenceNorm = overallConfidence / 100;
    let color;
    if (getConfidenceColor) {
      color = getConfidenceColor(overallConfidence);
    } else {
      // Fallback color calculation
      if (confidenceNorm < 0.1) {
        color = '#d32f2f';
      } else if (confidenceNorm < 0.2) {
        color = '#f57c00';
      } else if (confidenceNorm < 0.3) {
        color = '#fb8c00';
      } else if (confidenceNorm < 0.4) {
        color = '#fbc02d';
      } else if (confidenceNorm < 0.5) {
        color = '#fdd835';
      } else if (confidenceNorm < 0.6) {
        color = '#c5e1a5';
      } else if (confidenceNorm < 0.7) {
        color = '#81c784';
      } else if (confidenceNorm < 0.8) {
        color = '#66bb6a';
      } else if (confidenceNorm < 0.9) {
        color = '#4caf50';
      } else {
        color = '#2e7d32';
      }
    }

    badge.style.cssText = `
      display: inline-flex !important;
      align-items: center;
      gap: 4px;
      background-color: ${color};
      color: #000000 !important;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      cursor: help;
      /* Transition handled by CSS - no inline override needed */
      visibility: visible !important;
      opacity: 1 !important;
      margin-left: 8px;
      line-height: 1.2;
    `;

    badge.innerHTML = `
      <div class="iq-badge-inner">
        <div class="iq-badge-front">
          <span class="iq-label">IQ</span>
          <span class="iq-score">${averageIQ}</span>
        </div>
        <div class="iq-badge-back">
          <span class="iq-label">%</span>
          <span class="iq-score">${Math.round(overallConfidence)}</span>
        </div>
      </div>
    `;

    // Add line-height to inner elements for proper text positioning
    const labelElements = badge.querySelectorAll('.iq-label');
    const scoreElements = badge.querySelectorAll('.iq-score');
    labelElements.forEach(el => {
      el.style.lineHeight = '1';
    });
    scoreElements.forEach(el => {
      el.style.lineHeight = '1.2';
    });

    // Store original background color in CSS variable for hover inversion
    badge.style.setProperty('--iq-badge-original-bg', color, 'important');

    // Don't add any JavaScript handlers - CSS handles both flip animation and color inversion
    // The CSS hover rules in badge.css handle everything automatically
    // Mobile touch support is also handled by CSS (touch events work with :hover on modern browsers)

    // Mark badge to prevent handlers from being added
    badge.setAttribute('data-no-js-handlers', 'true');
    badge._skipHandlers = true;

    return badge;
  }

  /**
   * Find the insertion point for the average IQ badge on profile page
   * Should be after the "X following" and "X followers" elements
   */
  function findBadgeInsertionPoint() {
    // Look for the container with "Following" and "Followers"
    // Based on the user's HTML structure:
    // <div class="css-175oi2r r-13awgt0 r-18u37iz r-1w6e6rj">
    //   <div class="css-175oi2r r-1rtiivn">
    //     <a href="/HagazagaH/following">...Following...</a>
    //   </div>
    //   <div class="css-175oi2r">
    //     <a href="/HagazagaH/verified_followers">...Followers...</a>
    //   </div>
    // </div>
    // We want to insert the badge as a new child after the followers div

    // Strategy 1: Find followers link and walk up to find the container
    const followersLinks = document.querySelectorAll('a[href*="/followers"], a[href*="/verified_followers"]');
    for (const followersLink of followersLinks) {
      const href = followersLink.getAttribute('href') || '';
      if (href.includes('followers') || href.includes('verified_followers')) {
        // Walk up to find the parent container
        let current = followersLink.parentElement;
        while (current && current !== document.body) {
          // Check if this container has both following and followers links
          const hasFollowing = current.querySelector('a[href*="/following"]:not([href*="verified_followers"])');
          const hasFollowers = current.querySelector('a[href*="/followers"], a[href*="/verified_followers"]');

          if (hasFollowing && hasFollowers) {
            // Found the container - insert after the followers parent div
            const followersParent = followersLink.parentElement;
            if (followersParent && current.contains(followersParent)) {
              return {
                parent: current,
                afterElement: followersParent
              };
            }
          }
          current = current.parentElement;
        }
      }
    }

    // Strategy 2: Find following link and walk up
    const followingLinks = document.querySelectorAll('a[href*="/following"]');
    for (const followingLink of followingLinks) {
      const href = followingLink.getAttribute('href') || '';
      if (href.includes('/following') && !href.includes('verified_followers')) {
        // Walk up to find the container
        let current = followingLink.parentElement;
        while (current && current !== document.body) {
          // Check if this container has both following and followers links
          const hasFollowing = current.querySelector('a[href*="/following"]:not([href*="verified_followers"])');
          const hasFollowers = current.querySelector('a[href*="/followers"], a[href*="/verified_followers"]');

          if (hasFollowing && hasFollowers) {
            // Find the followers parent div
            const followersLink = current.querySelector('a[href*="/followers"], a[href*="/verified_followers"]');
            if (followersLink) {
              const followersParent = followersLink.parentElement;
              if (followersParent && current.contains(followersParent)) {
                return {
                  parent: current,
                  afterElement: followersParent
                };
              }
            }
          }
          current = current.parentElement;
        }
      }
    }

    // Strategy 3: Try to find by class patterns and structure
    const containers = document.querySelectorAll('div[class*="r-18u37iz"]');
    for (const container of containers) {
      const hasFollowing = container.querySelector('a[href*="/following"]:not([href*="verified_followers"])');
      const hasFollowers = container.querySelector('a[href*="/followers"], a[href*="/verified_followers"]');

      if (hasFollowing && hasFollowers) {
        // Find the followers parent div
        const followersLink = container.querySelector('a[href*="/followers"], a[href*="/verified_followers"]');
        if (followersLink) {
          const followersParent = followersLink.parentElement;
          if (followersParent && container.contains(followersParent)) {
            return {
              parent: container,
              afterElement: followersParent
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Check if we're on the user's own profile page
   */
  async function isOwnProfilePage() {
    const { getUserHandle } = getUserAverageIQ();
    if (!getUserHandle) {
      return false;
    }

    const userHandle = await getUserHandle();
    if (!userHandle) {
      return false;
    }

    // Check URL
    const pathname = window.location.pathname;
    const urlHandle = pathname.match(/^\/([a-zA-Z0-9_]+)/)?.[1];
    if (urlHandle && urlHandle.toLowerCase() === userHandle.toLowerCase()) {
      return true;
    }

    // Check for Edit Profile button
    const editProfileButton = document.querySelector('a[data-testid="editProfileButton"]');
    return !!editProfileButton;
  }

  /**
   * Insert or update the average IQ badge on profile page
   */
  async function insertAverageIQBadge() {
    // Get settings (may need to load from storage)
    let settings = getSettings();
    if (!settings || settings.showAverageIQ === undefined) {
      // Try to get from storage directly
      const storageResult = await new Promise((resolve) => {
        chrome.storage.sync.get(['showAverageIQ'], resolve);
      });
      if (storageResult.showAverageIQ === false) {
        // Setting is explicitly false, remove badge
        const existingBadge = document.querySelector('.iq-badge-average[data-iq-average="true"]');
        if (existingBadge) {
          existingBadge.remove();
        }
        return;
      }
      // If not set, default to false but continue (might be first run)
    }

    // Check if average IQ badge is enabled
    if (settings && settings.showAverageIQ === false) {
      // Remove badge if it exists
      const existingBadge = document.querySelector('.iq-badge-average[data-iq-average="true"]');
      if (existingBadge) {
        existingBadge.remove();
      }
      return;
    }

    // Check if we're on own profile page
    const isOwnProfile = await isOwnProfilePage();
    if (!isOwnProfile) {
      // Remove badge if it exists
      const existingBadge = document.querySelector('.iq-badge-average[data-iq-average="true"]');
      if (existingBadge) {
        existingBadge.remove();
      }
      return;
    }

    // Get average IQ
    const { getAverageIQ } = getUserAverageIQ();
    if (!getAverageIQ) {
      return;
    }

    const averageData = await getAverageIQ();
    if (!averageData || averageData.averageIQ === null || averageData.averageIQ === undefined) {
      // No average IQ yet, remove badge if it exists
      const existingBadge = document.querySelector('.iq-badge-average[data-iq-average="true"]');
      if (existingBadge) {
        existingBadge.remove();
      }
      return;
    }

    const averageIQ = averageData.averageIQ;
    const overallConfidence = averageData.overallConfidence !== null && averageData.overallConfidence !== undefined
      ? averageData.overallConfidence
      : averageData.averageConfidence || 0;

    // Check if badge already exists (look for badge inside wrapper)
    const existingWrapper = document.querySelector('.iq-badge-average[data-iq-average="true"]')?.parentElement;
    let badge = document.querySelector('.iq-badge-average[data-iq-average="true"]');
    if (badge) {
      // If badge has handlers attached, recreate it to remove them
      // This ensures clean state without conflicting handlers
      if (badge._hoverHandlers || badge._mobileHandlersAdded || !badge.hasAttribute('data-no-js-handlers')) {
        // Remove old badge and create a new one
        const wrapper = badge.parentElement;
        badge.remove();
        badge = createAverageIQBadge(averageIQ, overallConfidence);
        if (wrapper) {
          wrapper.appendChild(badge);
        }
        return;
      }

      // Check if values actually changed - if not, skip update to avoid infinite loop
      const currentIQ = parseInt(badge.getAttribute('data-iq-score'), 10);
      const currentConfidence = parseInt(badge.getAttribute('data-confidence'), 10);
      if (currentIQ === averageIQ && currentConfidence === Math.round(overallConfidence)) {
        // Values haven't changed, no need to update
        return;
      }

      // Temporarily disconnect observer to prevent infinite loop
      const wasObserving = badgeObserver && badgeObserver._isObserving;
      if (badgeObserver) {
        badgeObserver.disconnect();
        badgeObserver._isObserving = false;
      }

      // Update existing badge (no handlers attached)
      badge.setAttribute('data-iq-score', averageIQ);
      badge.setAttribute('data-confidence', overallConfidence);
      const frontScore = badge.querySelector('.iq-badge-front .iq-score');
      const backScore = badge.querySelector('.iq-badge-back .iq-score');
      if (frontScore) frontScore.textContent = averageIQ;
      if (backScore) backScore.textContent = Math.round(overallConfidence);

      // Update color
      const badgeManager = getBadgeManager();
      const { getConfidenceColor } = badgeManager || {};
      const color = getConfidenceColor ? getConfidenceColor(overallConfidence) : '#4caf50';
      // Don't use !important on background-color so CSS hover rules can override it
      badge.style.setProperty('background-color', color);
      badge.style.setProperty('--iq-badge-original-bg', color, 'important');

      // Transition is handled by CSS - don't set it inline

      // Mark badge to prevent handlers
      badge.setAttribute('data-no-js-handlers', 'true');
      badge._skipHandlers = true;

      // Reconnect observer after a short delay
      if (wasObserving) {
        setTimeout(() => {
          if (badgeObserver && !badgeObserver._isObserving) {
            badgeObserver.observe(document.body, {
              childList: true,
              subtree: true
            });
            badgeObserver._isObserving = true;
          }
        }, 100);
      }

      return;
    }

    // Temporarily disconnect observer to prevent infinite loop
    const wasObserving = badgeObserver && badgeObserver._isObserving;
    if (badgeObserver) {
      badgeObserver.disconnect();
      badgeObserver._isObserving = false;
    }

    // Create new badge
    badge = createAverageIQBadge(averageIQ, overallConfidence);

    // Wrap badge in a div to match the structure of following/followers divs
    const badgeWrapper = document.createElement('div');
    badgeWrapper.className = 'css-175oi2r';
    badgeWrapper.style.cssText = 'display: inline-block;';
    badgeWrapper.appendChild(badge);

    // Find insertion point
    const insertionPoint = findBadgeInsertionPoint();
    if (!insertionPoint) {
      // Reconnect observer if insertion failed
      if (wasObserving) {
        setTimeout(() => {
          if (badgeObserver && !badgeObserver._isObserving) {
            badgeObserver.observe(document.body, {
              childList: true,
              subtree: true
            });
            badgeObserver._isObserving = true;
          }
        }, 100);
      }
      return;
    }

    const { parent, afterElement } = insertionPoint;

    // Verify elements exist
    if (!parent || !afterElement || !parent.contains(afterElement)) {
      // Reconnect observer if insertion failed
      if (wasObserving) {
        setTimeout(() => {
          if (badgeObserver && !badgeObserver._isObserving) {
            badgeObserver.observe(document.body, {
              childList: true,
              subtree: true
            });
            badgeObserver._isObserving = true;
          }
        }, 100);
      }
      return;
    }

    // Insert badge wrapper after the followers element
    try {
      if (afterElement.nextSibling) {
        parent.insertBefore(badgeWrapper, afterElement.nextSibling);
      } else {
        parent.appendChild(badgeWrapper);
      }
    } catch (e) {
      // Silently fail
    }

    // Reconnect observer after a short delay
    if (wasObserving) {
      setTimeout(() => {
        if (badgeObserver && !badgeObserver._isObserving) {
          badgeObserver.observe(document.body, {
            childList: true,
            subtree: true
          });
          badgeObserver._isObserving = true;
        }
      }, 100);
    }
  }

  /**
   * Set up observer to watch for profile page changes
   */
  function setupBadgeObserver() {
    // Check if we're on a profile page
    const isProfilePage = /^\/[a-zA-Z0-9_]+(\/(with_replies|media|likes))?\/?$/.test(window.location.pathname);
    if (!isProfilePage) {
      // Not on a profile page, clean up observer if it exists
      if (badgeObserver) {
        badgeObserver.disconnect();
        badgeObserver = null;
      }
      return;
    }

    // If observer already exists, just trigger insertion check
    if (badgeObserver) {
      insertAverageIQBadge();
      return;
    }

    // Debounced function to insert badge
    const debouncedInsert = () => {
      if (insertBadgeTimeout) {
        clearTimeout(insertBadgeTimeout);
      }
      insertBadgeTimeout = setTimeout(() => {
        insertAverageIQBadge();
      }, 300);
    };

    // Try to insert badge immediately
    insertAverageIQBadge();

    // Set up observer to watch for DOM changes (debounced)
    badgeObserver = new MutationObserver((mutations) => {
      // Ignore mutations that come from our own badge element
      const shouldIgnore = mutations.some(mutation => {
        // Check if mutation is related to our badge
        const badge = document.querySelector('.iq-badge-average[data-iq-average="true"]');
        if (!badge) return false;

        // Check if any added/removed nodes are part of our badge tree
        for (const node of [...(mutation.addedNodes || []), ...(mutation.removedNodes || [])]) {
          if (node === badge || badge.contains(node) || (node.nodeType === 1 && node.closest('.iq-badge-average[data-iq-average="true"]'))) {
            return true;
          }
        }

        // Check if the target is part of our badge
        if (mutation.target && (mutation.target === badge || badge.contains(mutation.target))) {
          return true;
        }

        return false;
      });

      if (!shouldIgnore) {
        debouncedInsert();
      }
    });

    badgeObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
    badgeObserver._isObserving = true;

    // Also try again after delays to catch late-loading elements
    setTimeout(() => {
      insertAverageIQBadge();
    }, 1000);

    setTimeout(() => {
      insertAverageIQBadge();
    }, 3000);

    setTimeout(() => {
      insertAverageIQBadge();
    }, 5000);
  }

  /**
   * Handle URL changes (for client-side navigation)
   */
  let lastUrl = window.location.href;
  function checkUrlChange() {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      // Reset observer and set it up again for new page
      if (badgeObserver) {
        badgeObserver.disconnect();
        badgeObserver = null;
      }
      setTimeout(() => {
        setupBadgeObserver();
      }, 500);
    }
  }

  // Monitor URL changes
  setInterval(checkUrlChange, 1000);

  /**
   * Monitor storage changes to update the badge
   */
  function setupStorageListener() {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'sync') {
        // Handle showAverageIQ setting changes
        if (changes.showAverageIQ !== undefined) {
          setTimeout(() => {
            insertAverageIQBadge();
          }, 100);
        }
      }

      if (areaName === 'local') {
        // Handle userAverageIQ updates
        if (changes.userAverageIQ) {
          setTimeout(() => {
            insertAverageIQBadge();
          }, 100);
        }
      }
    });
  }

  // Set up storage listener on initialization
  setupStorageListener();

  // Set up badge observer on initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setupBadgeObserver();
    });
  } else {
    setupBadgeObserver();
  }

  // Export for debugging
  if (typeof window !== 'undefined') {
    window.AverageIQBadge = {
      insertAverageIQBadge,
      createAverageIQBadge,
      isOwnProfilePage
    };
  }
})();

