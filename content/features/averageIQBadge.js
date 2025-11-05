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
      background-color: ${color} !important;
      color: #000000 !important;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      cursor: help;
      transition: all 0.2s ease;
      visibility: visible !important;
      opacity: 1 !important;
      margin-left: 8px;
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

    // Store original background color in CSS variable for hover inversion
    badge.style.setProperty('--iq-badge-original-bg', color, 'important');

    // Add hover handlers for flip animation
    const addFlipBadgeHoverHandlers = window.BadgeCreationHandlers?.addFlipBadgeHoverHandlers;
    if (addFlipBadgeHoverHandlers) {
      addFlipBadgeHoverHandlers(badge);
    }

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

    // Try to find links with following/followers
    const followingLinks = document.querySelectorAll('a[href*="/following"]');
    const followersLinks = document.querySelectorAll('a[href*="/followers"], a[href*="/verified_followers"]');

    let followingLink = null;
    let followersLink = null;

    // Find the following link (not verified_followers)
    for (const link of followingLinks) {
      const href = link.getAttribute('href') || '';
      if (href.includes('/following') && !href.includes('verified_followers')) {
        followingLink = link;
        break;
      }
    }

    // Find the followers link
    for (const link of followersLinks) {
      const href = link.getAttribute('href') || '';
      if (href.includes('followers') || href.includes('verified_followers')) {
        followersLink = link;
        break;
      }
    }

    // Find the common parent container
    if (followingLink && followersLink) {
      // Find the parent container that contains both
      let followingParent = followingLink.parentElement;
      let followersParent = followersLink.parentElement;

      // They should be siblings, so find their common parent
      if (followingParent && followersParent && followingParent.parentElement === followersParent.parentElement) {
        // They're siblings - find the parent container
        const parentContainer = followingParent.parentElement;
        if (parentContainer) {
          // Insert after the followers parent div
          return {
            parent: parentContainer,
            afterElement: followersParent
          };
        }
      }

      // Alternative: walk up to find common ancestor
      let currentFollowing = followingParent;
      while (currentFollowing && currentFollowing !== document.body) {
        if (currentFollowing.contains(followersLink)) {
          // Found common ancestor
          return {
            parent: currentFollowing,
            afterElement: followersParent
          };
        }
        currentFollowing = currentFollowing.parentElement;
      }
    }

    // Fallback: try to find by structure using class patterns
    const container = document.querySelector('div[class*="r-18u37iz"][class*="r-13awgt0"]');
    if (container) {
      // Find the last child that contains a followers/following link
      const children = Array.from(container.children);
      for (let i = children.length - 1; i >= 0; i--) {
        const child = children[i];
        const link = child.querySelector('a[href*="/following"], a[href*="/followers"]');
        if (link) {
          return {
            parent: container,
            afterElement: child
          };
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
    const settings = getSettings();

    // Check if average IQ badge is enabled
    if (!settings.showAverageIQ) {
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

    // Check if badge already exists
    let badge = document.querySelector('.iq-badge-average[data-iq-average="true"]');
    if (badge) {
      // Update existing badge
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
      badge.style.setProperty('background-color', color, 'important');
      badge.style.setProperty('--iq-badge-original-bg', color, 'important');
      return;
    }

    // Create new badge
    badge = createAverageIQBadge(averageIQ, overallConfidence);

    // Find insertion point
    const insertionPoint = findBadgeInsertionPoint();
    if (!insertionPoint) {
      return;
    }

    const { parent, afterElement } = insertionPoint;

    // Insert badge after the followers element
    try {
      if (afterElement.nextSibling) {
        parent.insertBefore(badge, afterElement.nextSibling);
      } else {
        parent.appendChild(badge);
      }
    } catch (e) {
      console.warn('[AverageIQBadge] Error inserting badge:', e);
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
    badgeObserver = new MutationObserver(() => {
      debouncedInsert();
    });

    badgeObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also try again after delays to catch late-loading elements
    setTimeout(() => {
      insertAverageIQBadge();
    }, 1000);

    setTimeout(() => {
      insertAverageIQBadge();
    }, 3000);
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

