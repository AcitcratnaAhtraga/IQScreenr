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
      display: inline-flex !important;
      align-items: center;
      gap: 4px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
      color: white !important;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      margin-left: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      visibility: visible !important;
      opacity: 1 !important;
      position: relative !important;
      z-index: 1000 !important;
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
    // Primary target: Insert right after the display name/username, not in button area
    // Look for the UserName container which contains both display name and handle
    const userNameContainer = document.querySelector('div[data-testid="UserName"]');
    if (userNameContainer) {
      // Find the container that holds both display name and handle
      // This is usually the direct parent or grandparent of UserName
      let container = userNameContainer;

      // Try to find the flex container that holds name and handle together
      let parent = userNameContainer.parentElement;
      let bestContainer = userNameContainer;

      // Look for a container that has the name and handle as direct children
      // and doesn't contain edit button elements
      for (let i = 0; i < 3 && parent; i++) {
        const hasEditButton = parent.querySelector('button[data-testid*="edit"], button[role="button"]');
        const styles = window.getComputedStyle(parent);

        // Prefer containers without edit buttons and without overflow:hidden
        if (!hasEditButton && styles.overflow !== 'hidden') {
          bestContainer = parent;
          console.log('[ProfileBadge] Found container without edit button at level', i + 1);
        }

        parent = parent.parentElement;
      }

      // Check if bestContainer has overflow:hidden - if so, use its parent
      const bestStyles = window.getComputedStyle(bestContainer);
      if (bestStyles.overflow === 'hidden' && bestContainer.parentElement) {
        const parentStyles = window.getComputedStyle(bestContainer.parentElement);
        if (parentStyles.overflow !== 'hidden') {
          console.log('[ProfileBadge] Using parent container to avoid overflow:hidden');
          return bestContainer.parentElement;
        }
      }

      console.log('[ProfileBadge] Using UserName container area as insertion point');
      return bestContainer;
    }

    // Fallback: try finding by text content
    const selectors = [
      'div[data-testid="UserName"]',  // Main username container
      'a[href*="/"][role="link"] span', // User handle/name
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        // Check if this looks like a username/handle element
        const text = element.textContent || '';
        if (text === currentHandle || text.startsWith('@')) {
          // Find parent that doesn't have edit buttons
          let container = element.parentElement;
          for (let i = 0; i < 3 && container; i++) {
            const hasEditButton = container.querySelector('button[data-testid*="edit"], button[role="button"]');
            const styles = window.getComputedStyle(container);
            if (!hasEditButton && styles.overflow !== 'hidden') {
              return container;
            }
            container = container.parentElement;
          }
          // Fallback to parent
          return element.parentElement;
        }
      }
    }

    return null;
  }

  /**
   * Add the score badge to the profile page
   * @param {boolean} force - If true, bypass settings check and proceed directly
   */
  function addScoreBadge(force = false) {
    console.log('[ProfileBadge] addScoreBadge called, badgeAdded:', badgeAdded, 'force:', force);

    if (!force) {
      // Check settings only if not forced (e.g., from init or mutation observer)
      const settings = getSettings();
      const isGameModeEnabled = settings.enableIQGuessr === true;
      console.log('[ProfileBadge] Settings:', settings, 'isGameModeEnabled:', isGameModeEnabled);

      // Only show badge if game mode is enabled
      if (!isGameModeEnabled) {
        console.log('[ProfileBadge] Game mode not enabled, returning early');
        return;
      }
    } else {
      console.log('[ProfileBadge] Force mode - bypassing settings check');
    }

    // Check if we're on a profile page
    const onProfilePage = isProfilePage();
    console.log('[ProfileBadge] isProfilePage():', onProfilePage, 'pathname:', window.location.pathname);
    if (!onProfilePage) {
      console.log('[ProfileBadge] Not on profile page, returning early');
      return;
    }

    // Get the score from storage
    chrome.storage.sync.get(['iqGuessrScore'], (result) => {
      const score = result.iqGuessrScore || 0;
      console.log('[ProfileBadge] Score from storage:', score);

      // Find where to insert the badge
      const insertionPoint = findInsertionPoint();
      console.log('[ProfileBadge] Insertion point found:', insertionPoint !== null);
      if (!insertionPoint) {
        // Reset badgeAdded flag if we can't find insertion point yet
        // This allows retrying when DOM is ready
        console.log('[ProfileBadge] Could not find insertion point, resetting badgeAdded flag');
        badgeAdded = false;
        return;
      }

      // Check if badge already exists anywhere in the DOM
      const existingBadge = document.querySelector('.iq-guessr-score-badge');
      console.log('[ProfileBadge] Existing badge found:', existingBadge !== null);
      if (existingBadge) {
        // Update score in existing badge
        const scoreValue = existingBadge.querySelector('.score-value');
        if (scoreValue) {
          scoreValue.textContent = score;
        }
        // Make sure badge is visible
        existingBadge.style.display = 'inline-flex';
        badgeAdded = true;
        console.log('[ProfileBadge] Updated existing badge');
        return;
      }

      // Only create new badge if we haven't already added one
      if (badgeAdded) {
        console.log('[ProfileBadge] Badge already added, skipping creation');
        return;
      }

      // Create and insert the badge
      console.log('[ProfileBadge] Creating new badge with score:', score);
      console.log('[ProfileBadge] Insertion point element:', insertionPoint);
      console.log('[ProfileBadge] Insertion point tagName:', insertionPoint.tagName);
      console.log('[ProfileBadge] Insertion point classes:', insertionPoint.className);
      console.log('[ProfileBadge] Insertion point innerHTML before:', insertionPoint.innerHTML.substring(0, 200));

      const badge = createScoreBadge(score);

      // Check if insertion point has overflow:hidden - if so, try to insert at parent level
      const insertionStyles = window.getComputedStyle(insertionPoint);
      const hasOverflowHidden = insertionStyles.overflow === 'hidden';
      console.log('[ProfileBadge] Insertion point overflow:', insertionStyles.overflow, 'width:', insertionStyles.width);

      if (hasOverflowHidden) {
        // Try to find a parent without overflow:hidden
        let parent = insertionPoint.parentElement;
        let foundParent = null;
        for (let i = 0; i < 5 && parent; i++) {
          const parentStyles = window.getComputedStyle(parent);
          console.log('[ProfileBadge] Checking parent level', i + 1, 'overflow:', parentStyles.overflow);
          if (parentStyles.overflow !== 'hidden') {
            foundParent = parent;
            console.log('[ProfileBadge] Found parent without overflow:hidden');
            break;
          }
          parent = parent.parentElement;
        }

        if (foundParent) {
          // Insert badge after the UserName container within the parent
          const userNameContainer = foundParent.querySelector('div[data-testid="UserName"]');
          if (userNameContainer && userNameContainer.nextSibling) {
            foundParent.insertBefore(badge, userNameContainer.nextSibling);
            console.log('[ProfileBadge] Inserted badge as sibling of UserName container (above overflow:hidden)');
          } else if (userNameContainer) {
            // Insert right after UserName container
            userNameContainer.parentElement.insertBefore(badge, userNameContainer.nextSibling);
            console.log('[ProfileBadge] Inserted badge after UserName container');
          } else {
            foundParent.appendChild(badge);
            console.log('[ProfileBadge] Appended badge to parent without overflow:hidden');
          }
        } else {
          // Fallback: still insert in original location, but adjust positioning
          insertionPoint.appendChild(badge);
          console.log('[ProfileBadge] Appended to insertion point despite overflow:hidden (may be clipped)');
        }
      } else {
        // No overflow:hidden, can safely insert here
        // Find the UserName container and insert badge right after the handle/username text
        const userNameContainer = document.querySelector('div[data-testid="UserName"]');

        if (userNameContainer && userNameContainer.parentElement) {
          // Find the span with the handle (@username) - it's usually the last text element in UserName
          const handleSpan = Array.from(userNameContainer.querySelectorAll('span')).find(span =>
            span.textContent && (span.textContent.includes('@') || span.textContent === currentHandle)
          ) || userNameContainer.querySelector('span');

          if (handleSpan) {
            // Insert badge right after the handle span, within the UserName container
            if (handleSpan.nextSibling) {
              userNameContainer.insertBefore(badge, handleSpan.nextSibling);
              console.log('[ProfileBadge] Inserted badge after handle span within UserName container');
            } else {
              userNameContainer.appendChild(badge);
              console.log('[ProfileBadge] Appended badge to UserName container after handle');
            }
          } else {
            // Fallback: append to UserName container
            userNameContainer.appendChild(badge);
            console.log('[ProfileBadge] Appended badge to UserName container (fallback)');
          }
        } else {
          // Fallback: find username span and insert after it
          const usernameSpan = insertionPoint.querySelector('span[class*="css-1jxf684"]') ||
                              Array.from(insertionPoint.querySelectorAll('span')).find(span =>
                                span.textContent && (span.textContent.includes('@') || span.textContent === currentHandle)
                              ) ||
                              null;

          console.log('[ProfileBadge] Username span found:', usernameSpan !== null);

          if (usernameSpan) {
            // Insert as next sibling of the username span
            if (usernameSpan.nextSibling) {
              usernameSpan.parentElement.insertBefore(badge, usernameSpan.nextSibling);
              console.log('[ProfileBadge] Inserted badge as next sibling of username span');
            } else {
              // No next sibling, append after
              usernameSpan.parentElement.appendChild(badge);
              console.log('[ProfileBadge] Appended badge after username span');
            }
          } else {
            // Fallback: append to insertion point
            insertionPoint.appendChild(badge);
            console.log('[ProfileBadge] Appended badge to insertion point (fallback)');
          }
        }
      }

      badgeAdded = true;

      // Verify badge is in DOM and visible
      const badgeInDOM = document.querySelector('.iq-guessr-score-badge');
      console.log('[ProfileBadge] Badge exists in DOM after insertion:', badgeInDOM !== null);
      console.log('[ProfileBadge] Badge parent:', badgeInDOM?.parentElement);
      console.log('[ProfileBadge] Badge computed display:', badgeInDOM ? window.getComputedStyle(badgeInDOM).display : 'N/A');
      console.log('[ProfileBadge] Badge computed visibility:', badgeInDOM ? window.getComputedStyle(badgeInDOM).visibility : 'N/A');
      console.log('[ProfileBadge] Badge computed opacity:', badgeInDOM ? window.getComputedStyle(badgeInDOM).opacity : 'N/A');
      console.log('[ProfileBadge] Badge computed position:', badgeInDOM ? window.getComputedStyle(badgeInDOM).position : 'N/A');
      console.log('[ProfileBadge] Badge computed z-index:', badgeInDOM ? window.getComputedStyle(badgeInDOM).zIndex : 'N/A');
      console.log('[ProfileBadge] Badge offsetWidth:', badgeInDOM?.offsetWidth);
      console.log('[ProfileBadge] Badge offsetHeight:', badgeInDOM?.offsetHeight);
      console.log('[ProfileBadge] Badge getBoundingClientRect:', badgeInDOM ? badgeInDOM.getBoundingClientRect() : 'N/A');

      // Check parent container visibility
      const parent = badgeInDOM?.parentElement;
      if (parent) {
        const parentStyles = window.getComputedStyle(parent);
        console.log('[ProfileBadge] Parent computed display:', parentStyles.display);
        console.log('[ProfileBadge] Parent computed visibility:', parentStyles.visibility);
        console.log('[ProfileBadge] Parent computed overflow:', parentStyles.overflow);
        console.log('[ProfileBadge] Parent getBoundingClientRect:', parent.getBoundingClientRect());
      }

      console.log('[ProfileBadge] Insertion point innerHTML after:', insertionPoint.innerHTML.substring(0, 300));
      console.log('[ProfileBadge] Badge created and inserted successfully');
    });
  }

  /**
   * Remove the score badge from the profile page
   */
  function removeScoreBadge() {
    const badge = document.querySelector('.iq-guessr-score-badge');
    console.log('[ProfileBadge] removeScoreBadge called, badge found:', badge !== null);
    if (badge) {
      console.log('[ProfileBadge] Removing badge, parent:', badge.parentElement);
      console.log('[ProfileBadge] Badge before removal:', badge);
      badge.remove();
      badgeAdded = false;

      // Verify badge is removed
      const badgeStillExists = document.querySelector('.iq-guessr-score-badge');
      console.log('[ProfileBadge] Badge still exists after removal:', badgeStillExists !== null);
    } else {
      console.log('[ProfileBadge] No badge found to remove');
    }
  }

  /**
   * Monitor storage changes to update the badge
   */
  function setupStorageListener() {
    if (storageListenerSetup) {
      console.log('[ProfileBadge] Storage listener already set up');
      return; // Already set up
    }

    console.log('[ProfileBadge] Setting up storage listener');
    chrome.storage.onChanged.addListener((changes, areaName) => {
      console.log('[ProfileBadge] Storage changed:', areaName, Object.keys(changes));
      if (areaName === 'sync') {
        // Handle IQGuessr score updates
        if (changes.iqGuessrScore) {
          const newScore = changes.iqGuessrScore.newValue;
          const badge = document.querySelector('.iq-guessr-score-badge');
          if (badge) {
            const scoreValue = badge.querySelector('.score-value');
            if (scoreValue) {
              scoreValue.textContent = newScore;
            }
          }
        }

        // Handle enableIQGuessr toggle
        if (changes.enableIQGuessr) {
          const gameModeEnabled = changes.enableIQGuessr.newValue;
          console.log('[ProfileBadge] enableIQGuessr changed:', gameModeEnabled);

          if (gameModeEnabled) {
            // IQGuessr mode enabled - add badge immediately
            // Use force=true to bypass settings check since settings may not be updated yet
            console.log('[ProfileBadge] IQGuessr enabled, resetting badgeAdded and calling addScoreBadge with force=true');
            badgeAdded = false; // Reset flag to allow adding
            addScoreBadge(true); // Force bypass settings check
          } else {
            // IQGuessr mode disabled - verify storage before removing to avoid race conditions
            console.log('[ProfileBadge] IQGuessr disabled notification received, verifying storage...');
            chrome.storage.sync.get(['enableIQGuessr'], (result) => {
              const isActuallyDisabled = result.enableIQGuessr !== true;
              console.log('[ProfileBadge] Storage verification - enableIQGuessr:', result.enableIQGuessr, 'isActuallyDisabled:', isActuallyDisabled);

              if (isActuallyDisabled) {
                console.log('[ProfileBadge] Confirmed disabled, removing badge');
                removeScoreBadge();
              } else {
                console.log('[ProfileBadge] Storage shows enabled (race condition?), keeping badge');
              }
            });
          }
        }
      }
    });

    storageListenerSetup = true;
    console.log('[ProfileBadge] Storage listener setup complete');
  }

  /**
   * Initialize the profile badge feature
   */
  function init() {
    console.log('[ProfileBadge] init() called');
    // Clean up previous observer if it exists
    if (currentObserver) {
      currentObserver.disconnect();
      currentObserver = null;
    }

    const onProfilePage = isProfilePage();
    console.log('[ProfileBadge] init - isProfilePage():', onProfilePage);
    if (!onProfilePage) {
      console.log('[ProfileBadge] Not on profile page, exiting init');
      return;
    }

    currentHandle = getHandleFromUrl();
    console.log('[ProfileBadge] init - currentHandle:', currentHandle);
    if (!currentHandle) {
      console.log('[ProfileBadge] No handle found, exiting init');
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
    console.log('[ProfileBadge] init() completed');
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

