/**
 * Profile Badge Feature
 * Adds IQGuessr total score badge on user profile pages
 */

(function() {
  'use strict';

  const getSettings = () => window.Settings || {};

  let badgeAdded = false;
  let currentHandle = null;
  let currentObserver = null;
  let storageListenerSetup = false;

  /**
   * Check if we're on a profile page
   */
  function isProfilePage() {
    const pathname = window.location.pathname;
    // Profile pages match pattern: /username or /username/ or /username/with_replies or /username/media
    // Exclude special paths like /home, /explore, /notifications, /messages, /compose, etc.
    const specialPaths = ['/home', '/explore', '/notifications', '/messages', '/compose', '/settings', '/search'];
    if (specialPaths.some(path => pathname.startsWith(path))) {
      return false;
    }

    // Profile pages typically have /username or /username/tabs like /with_replies, /media, etc.
    // But we need to match /username without requiring a trailing slash or path
    const profilePattern = /^\/[a-zA-Z0-9_]+(\/(with_replies|media|likes))?\/?$/;
    return profilePattern.test(pathname);
  }

  /**
   * Extract the handle from the URL
   */
  function getHandleFromUrl() {
    const pathname = window.location.pathname;
    const match = pathname.match(/^\/([a-zA-Z0-9_]+)/);
    return match ? match[1] : null;
  }

  /**
   * Create a score badge element
   */
  function createScoreBadge(score) {
    const badge = document.createElement('span');
    badge.className = 'iq-guessr-score-badge';
    badge.setAttribute('data-iq-guessr-score', 'true');
    badge.innerHTML = `
      <span class="score-label">IQGuessr</span>
      <span class="score-value">${score}</span>
    `;

    badge.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      margin-left: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
    `;

    badge.onmouseenter = () => {
      badge.style.transform = 'scale(1.05)';
      badge.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
    };

    badge.onmouseleave = () => {
      badge.style.transform = 'scale(1)';
      badge.style.boxShadow = 'none';
    };

    return badge;
  }

  /**
   * Find the insertion point for the badge on the profile page
   * Twitter/X profile pages have various layouts - we'll try multiple locations
   */
  function findInsertionPoint() {
    // Try multiple selectors for the profile header
    const selectors = [
      'div[data-testid="UserName"]',  // Main username container
      'a[href*="/"][role="link"] span', // User handle/name
      'div[dir="ltr"] span span', // Alternative container
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        // Check if this looks like a username/handle element
        const text = element.textContent || '';
        if (text === currentHandle || text.startsWith('@')) {
          return element.parentElement;
        }
      }
    }

    // Fallback: look for User-Name container
    const userNameContainer = document.querySelector('div[data-testid="UserName"]');
    if (userNameContainer) {
      return userNameContainer;
    }

    return null;
  }

  /**
   * Add the score badge to the profile page
   */
  function addScoreBadge() {
    if (badgeAdded) return;

    const settings = getSettings();
    const isGameModeEnabled = settings.enableIQGuessr === true;

    // Only show badge if game mode is enabled
    if (!isGameModeEnabled) {
      return;
    }

    // Get the score from storage
    chrome.storage.sync.get(['iqGuessrScore'], (result) => {
      const score = result.iqGuessrScore || 0;

      // Find where to insert the badge
      const insertionPoint = findInsertionPoint();
      if (!insertionPoint) {
        console.log('[ProfileBadge] Could not find insertion point for badge');
        return;
      }

      // Check if badge already exists
      const existingBadge = insertionPoint.querySelector('.iq-guessr-score-badge');
      if (existingBadge) {
        // Update score in existing badge
        const scoreValue = existingBadge.querySelector('.score-value');
        if (scoreValue) {
          scoreValue.textContent = score;
        }
        return;
      }

      // Create and insert the badge
      const badge = createScoreBadge(score);
      insertionPoint.appendChild(badge);
      badgeAdded = true;

      console.log('[ProfileBadge] Added score badge to profile page');
    });
  }

  /**
   * Monitor storage changes to update the badge
   */
  function setupStorageListener() {
    if (storageListenerSetup) {
      return; // Already set up
    }

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'sync' && changes.iqGuessrScore) {
        const newScore = changes.iqGuessrScore.newValue;
        const badge = document.querySelector('.iq-guessr-score-badge');
        if (badge) {
          const scoreValue = badge.querySelector('.score-value');
          if (scoreValue) {
            scoreValue.textContent = newScore;
          }
        }
      }
    });

    storageListenerSetup = true;
  }

  /**
   * Initialize the profile badge feature
   */
  function init() {
    // Clean up previous observer if it exists
    if (currentObserver) {
      currentObserver.disconnect();
      currentObserver = null;
    }

    if (!isProfilePage()) {
      return;
    }

    currentHandle = getHandleFromUrl();
    if (!currentHandle) {
      return;
    }

    // Set up storage listener
    setupStorageListener();

    // Try to add the badge immediately
    addScoreBadge();

    // Also set up a MutationObserver to watch for DOM changes
    // Profile pages can load content dynamically
    const observer = new MutationObserver(() => {
      if (!badgeAdded) {
        addScoreBadge();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    currentObserver = observer;
  }

  // Start observing when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Also run on navigation (Twitter/X is a SPA)
  let currentUrl = window.location.href;
  setInterval(() => {
    const newUrl = window.location.href;
    if (newUrl !== currentUrl) {
      currentUrl = newUrl;
      badgeAdded = false;
      init();
    }
  }, 1000);

  // Export for debugging
  if (typeof window !== 'undefined') {
    window.ProfileBadge = {
      addScoreBadge,
      isProfilePage,
      getHandleFromUrl
    };
  }
})();

