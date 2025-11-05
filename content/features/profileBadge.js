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
   * Calculate rotation duration based on score
   * Higher score = faster rotation (shorter duration)
   * Formula: duration = max(0.05, 3 / (1 + score / 100))
   * This gives: 0 score = 3s, 100 = 1.5s, 1000 = 0.27s, 10000 = 0.03s, etc.
   */
  function calculateRotationDuration(score) {
    const baseDuration = 3; // Base duration in seconds for score 0
    const divisor = 10000; // Controls how quickly duration decreases
    const minDuration = 0.05; // Minimum duration (maximum speed)

    const duration = Math.max(minDuration, baseDuration / (1 + score / divisor));
    return duration;
  }

  /**
   * Create a score badge element
   */
  function createScoreBadge(score) {
    const badge = document.createElement('span');
    badge.className = 'iq-guessr-score-badge';
    badge.setAttribute('data-iq-guessr-score', 'true');

    // Attach creation context if available
    if (window.BadgeCreation && window.BadgeCreation.attachCreationContext) {
      window.BadgeCreation.attachCreationContext(badge, 'score');
    }

    // Calculate rotation speed based on score
    const rotationDuration = calculateRotationDuration(score);

    badge.innerHTML = `
      <div style="position: relative; display: inline-block;">
        <img src="${chrome.runtime.getURL('icons/Variants/Fullsize/IqGuessrTrspW.png')}" alt="IqGuessr" class="iq-guessr-rotating-icon" style="width: 40px; height: 40px; display: block; animation-duration: ${rotationDuration}s;">
        <span class="score-value" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 16px; font-weight: 700; color: white; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9); pointer-events: none; z-index: 1;">${score}</span>
      </div>
    `;

    badge.style.cssText = `
      display: inline-flex !important;
      align-items: center;
      gap: 4px;
      background: transparent !important;
      color: white !important;
      padding: 0;
      border-radius: 0;
      font-size: 12px;
      font-weight: 600;
      margin-left: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      visibility: visible !important;
      opacity: 1 !important;
      position: relative !important;
      z-index: 1000 !important;
      border: none;
      box-shadow: none;
    `;

    badge.onmouseenter = () => {
      badge.style.transform = 'scale(1.1)';
    };

    badge.onmouseleave = () => {
      badge.style.transform = 'scale(1)';
    };

    // Attach stats tooltip handlers
    if (window.StatsTooltip && window.StatsTooltip.attach) {
      // Wait a bit for StatsTooltip to be fully initialized
      setTimeout(() => {
        window.StatsTooltip.attach(badge);
      }, 100);
    }

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
        }

        parent = parent.parentElement;
      }

      // Check if bestContainer has overflow:hidden - if so, use its parent
      const bestStyles = window.getComputedStyle(bestContainer);
      if (bestStyles.overflow === 'hidden' && bestContainer.parentElement) {
        const parentStyles = window.getComputedStyle(bestContainer.parentElement);
        if (parentStyles.overflow !== 'hidden') {
          return bestContainer.parentElement;
        }
      }

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
    if (!force) {
      // Check settings only if not forced (e.g., from init or mutation observer)
      const settings = getSettings();
      const isGameModeEnabled = settings.enableIQGuessr === true;

      // Only show badge if game mode is enabled
      if (!isGameModeEnabled) {
        return;
      }
    }

    // Check if we're on a profile page
    const onProfilePage = isProfilePage();
    if (!onProfilePage) {
      return;
    }

    // Get the score from storage (check both sync and local, and all keys)
    Promise.all([
      new Promise((resolve) => chrome.storage.sync.get(['iqGuessrScore'], resolve)),
      new Promise((resolve) => chrome.storage.local.get(['iqGuessrScore'], resolve)),
      new Promise((resolve) => chrome.storage.sync.get(null, resolve)), // Get all sync keys
      new Promise((resolve) => chrome.storage.local.get(null, resolve))  // Get all local keys
    ]).then(([syncResult, localResult, allSync, allLocal]) => {
      // Try to get score from multiple sources
      let score = syncResult.iqGuessrScore ?? localResult.iqGuessrScore ??
                  allSync.iqGuessrScore ?? allLocal.iqGuessrScore ?? 0;

      // Convert to number if it's a string
      if (typeof score === 'string') {
        score = parseFloat(score) || 0;
      }
      score = Number(score) || 0;

      // Debug logging
      if (score === 0 && (allSync.iqGuessrScore || allLocal.iqGuessrScore)) {
        console.log('[IqGuessr] Score found but was 0, checking all storage:', {
          syncResult,
          localResult,
          allSync: allSync.iqGuessrScore,
          allLocal: allLocal.iqGuessrScore
        });
      }

      // Find where to insert the badge
      const insertionPoint = findInsertionPoint();
      if (!insertionPoint) {
        // Reset badgeAdded flag if we can't find insertion point yet
        // This allows retrying when DOM is ready
        badgeAdded = false;
        return;
      }

      // Check if badge already exists anywhere in the DOM
      const existingBadge = document.querySelector('.iq-guessr-score-badge');
      if (existingBadge) {
        // Calculate new rotation duration based on updated score
        const rotationDuration = calculateRotationDuration(score);

        // Update score in existing badge
        const scoreValue = existingBadge.querySelector('.score-value');
        const icon = existingBadge.querySelector('.iq-guessr-rotating-icon');

        if (scoreValue) {
          scoreValue.textContent = score;
          // Update rotation speed
          if (icon) {
            icon.style.animationDuration = `${rotationDuration}s`;
          }
        } else {
          // If badge structure changed, update the innerHTML
          const img = existingBadge.querySelector('img');
          if (img) {
            existingBadge.innerHTML = `
              <div style="position: relative; display: inline-block;">
                <img src="${chrome.runtime.getURL('icons/Variants/Fullsize/IqGuessrInvert.png')}" alt="IqGuessr" class="iq-guessr-rotating-icon" style="width: 40px; height: 40px; display: block; animation-duration: ${rotationDuration}s;">
                <span class="score-value" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 16px; font-weight: 700; color: white; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9); pointer-events: none; z-index: 1;">${score}</span>
              </div>
            `;
          }
        }
        // Make sure badge is visible
        existingBadge.style.display = 'inline-flex';

        // Ensure tooltip handlers are attached (in case they weren't before)
        if (window.StatsTooltip && window.StatsTooltip.attach) {
          const hasTooltipAttr = existingBadge.hasAttribute('data-stats-tooltip-attached');
          if (!hasTooltipAttr) {
            existingBadge.setAttribute('data-stats-tooltip-attached', 'true');
            window.StatsTooltip.attach(existingBadge);
          }
        }

        badgeAdded = true;
        return;
      }

      // Only create new badge if we haven't already added one
      if (badgeAdded) {
        return;
      }

      // Create and insert the badge
      const badge = createScoreBadge(score);

      // Mark that tooltip handlers will be attached
      badge.setAttribute('data-stats-tooltip-attached', 'true');

      // Check if insertion point has overflow:hidden - if so, try to insert at parent level
      const insertionStyles = window.getComputedStyle(insertionPoint);
      const hasOverflowHidden = insertionStyles.overflow === 'hidden';

      if (hasOverflowHidden) {
        // Try to find a parent without overflow:hidden
        let parent = insertionPoint.parentElement;
        let foundParent = null;
        for (let i = 0; i < 5 && parent; i++) {
          const parentStyles = window.getComputedStyle(parent);
          if (parentStyles.overflow !== 'hidden') {
            foundParent = parent;
            break;
          }
          parent = parent.parentElement;
        }

        if (foundParent) {
          // Insert badge after the UserName container within the parent
          const userNameContainer = foundParent.querySelector('div[data-testid="UserName"]');
          if (userNameContainer && userNameContainer.nextSibling) {
            foundParent.insertBefore(badge, userNameContainer.nextSibling);
          } else if (userNameContainer) {
            // Insert right after UserName container
            userNameContainer.parentElement.insertBefore(badge, userNameContainer.nextSibling);
          } else {
            foundParent.appendChild(badge);
          }
        } else {
          // Fallback: still insert in original location, but adjust positioning
          insertionPoint.appendChild(badge);
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
            } else {
              userNameContainer.appendChild(badge);
            }
          } else {
            // Fallback: append to UserName container
            userNameContainer.appendChild(badge);
          }
        } else {
          // Fallback: find username span and insert after it
          const usernameSpan = insertionPoint.querySelector('span[class*="css-1jxf684"]') ||
                              Array.from(insertionPoint.querySelectorAll('span')).find(span =>
                                span.textContent && (span.textContent.includes('@') || span.textContent === currentHandle)
                              ) ||
                              null;

          if (usernameSpan) {
            // Insert as next sibling of the username span
            if (usernameSpan.nextSibling) {
              usernameSpan.parentElement.insertBefore(badge, usernameSpan.nextSibling);
            } else {
              // No next sibling, append after
              usernameSpan.parentElement.appendChild(badge);
            }
          } else {
            // Fallback: append to insertion point
            insertionPoint.appendChild(badge);
          }
        }
      }

      badgeAdded = true;
    }).catch((error) => {
      console.warn('[IqGuessr] Error loading score:', error);
      // Fallback: try all storage methods
      chrome.storage.sync.get(null, (allSync) => {
        chrome.storage.local.get(null, (allLocal) => {
          let score = allSync.iqGuessrScore ?? allLocal.iqGuessrScore ?? 0;

          // Convert to number
          if (typeof score === 'string') {
            score = parseFloat(score) || 0;
          }
          score = Number(score) || 0;

          console.log('[IqGuessr] Fallback score retrieval:', { score, allSync: allSync.iqGuessrScore, allLocal: allLocal.iqGuessrScore });

          const existingBadge = document.querySelector('.iq-guessr-score-badge');
          if (existingBadge) {
            const scoreValue = existingBadge.querySelector('.score-value');
            const icon = existingBadge.querySelector('.iq-guessr-rotating-icon');

            if (scoreValue) {
              scoreValue.textContent = score;
            }

            // Update rotation speed
            if (icon) {
              const rotationDuration = calculateRotationDuration(score);
              icon.style.animationDuration = `${rotationDuration}s`;
            }
          }
        });
      });
    });
  }

  /**
   * Remove the score badge from the profile page
   */
  function removeScoreBadge() {
    const badge = document.querySelector('.iq-guessr-score-badge');
    if (badge) {
      badge.remove();
      badgeAdded = false;
    }
  }

  /**
   * Monitor storage changes to update the badge
   */
  function setupStorageListener() {
    if (storageListenerSetup) {
      return; // Already set up
    }

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'sync') {
        // Handle IQGuessr score updates
        if (changes.iqGuessrScore) {
          let newScore = changes.iqGuessrScore.newValue ?? 0;

          // Convert to number
          if (typeof newScore === 'string') {
            newScore = parseFloat(newScore) || 0;
          }
          newScore = Number(newScore) || 0;

          const badge = document.querySelector('.iq-guessr-score-badge');
          if (badge) {
            const scoreValue = badge.querySelector('.score-value');
            const icon = badge.querySelector('.iq-guessr-rotating-icon');

            if (scoreValue) {
              scoreValue.textContent = newScore;
            }

            // Update rotation speed based on new score
            if (icon) {
              const rotationDuration = calculateRotationDuration(newScore);
              icon.style.animationDuration = `${rotationDuration}s`;
            }
          }
        }

        // Handle enableIQGuessr toggle
        if (changes.enableIQGuessr) {
          const gameModeEnabled = changes.enableIQGuessr.newValue;

          if (gameModeEnabled) {
            // IQGuessr mode enabled - add badge immediately
            // Use force=true to bypass settings check since settings may not be updated yet
            badgeAdded = false; // Reset flag to allow adding
            addScoreBadge(true); // Force bypass settings check
          } else {
            // IQGuessr mode disabled - verify storage before removing to avoid race conditions
            chrome.storage.sync.get(['enableIQGuessr'], (result) => {
              const isActuallyDisabled = result.enableIQGuessr !== true;

              if (isActuallyDisabled) {
                removeScoreBadge();
              }
            });
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

    const onProfilePage = isProfilePage();
    if (!onProfilePage) {
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

