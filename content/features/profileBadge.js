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
    const divisor = 100; // Controls how quickly duration decreases
    const minDuration = 0.05; // Minimum duration (maximum speed)

    const duration = Math.max(minDuration, baseDuration / (1 + score / divisor));
    return duration;
  }

  /**
   * Calculate icon size based on score
   * Higher score = larger icon
   * Formula: size = 40 + (120 - 40) * min(1, score / 10000000)
   * This gives: 0 score = 40px, 10,000,000 = 120px, and scales linearly
   */
  function calculateIconSize(score) {
    const baseSize = 40; // Starting size at score 0
    const maxSize = 120; // Maximum size at max score
    const maxScore = 10000000; // Score at which max size is reached

    // Linear scaling from baseSize to maxSize
    const size = baseSize + (maxSize - baseSize) * Math.min(1, score / maxScore);
    return Math.round(size);
  }

  /**
   * Calculate font size for score text based on icon size
   * Scales proportionally with icon size
   */
  function calculateFontSize(iconSize) {
    // Font size scales proportionally: 40px icon = 16px font, 120px icon = 48px font
    const baseIconSize = 40;
    const baseFontSize = 16;
    const maxIconSize = 120;
    const maxFontSize = 48;

    // Linear interpolation
    const fontSize = baseFontSize + (maxFontSize - baseFontSize) * ((iconSize - baseIconSize) / (maxIconSize - baseIconSize));
    return Math.round(fontSize);
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

    // Calculate rotation speed and icon size based on score
    const rotationDuration = calculateRotationDuration(score);
    const iconSize = calculateIconSize(score);
    const fontSize = 16; // Fixed font size, doesn't grow with icon

    badge.innerHTML = `
      <div style="position: relative; display: inline-block;">
        <img src="${chrome.runtime.getURL('icons/Variants/Fullsize/IqGuessrTrspW.png')}" alt="IqGuessr" class="iq-guessr-rotating-icon" style="width: ${iconSize}px; height: ${iconSize}px; display: block; animation-duration: ${rotationDuration}s; transition: animation-duration 0.3s ease;">
        <span class="score-value" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: ${fontSize}px; font-weight: 700; color: white; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9); pointer-events: none; z-index: 1;">${score}</span>
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

      // Slow down rotation to base speed (score 0) on hover
      const icon = badge.querySelector('.iq-guessr-rotating-icon');
      if (icon) {
        const baseDuration = 3; // Base duration for score 0
        icon.style.transition = 'animation-duration 0.3s ease';
        icon.style.animationDuration = `${baseDuration}s`;
      }
    };

    badge.onmouseleave = () => {
      badge.style.transform = 'scale(1)';

      // Return to normal rotation speed based on current score
      const icon = badge.querySelector('.iq-guessr-rotating-icon');
      if (icon) {
        const currentScore = parseInt(score) || 0;
        const normalDuration = calculateRotationDuration(currentScore);
        icon.style.transition = 'animation-duration 0.3s ease';
        icon.style.animationDuration = `${normalDuration}s`;
      }
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
   * Insert the badge to the right of the UserAvatar-Container
   */
  function findInsertionPoint() {
    // Primary target: Find the UserAvatar-Container element
    // This is the container that holds the profile picture on the profile page
    const avatarContainerSelectors = [
      'div[data-testid^="UserAvatar-Container-"]', // UserAvatar-Container-{username}
      'div[data-testid*="UserAvatar-Container"]', // Any UserAvatar-Container
    ];

    for (const selector of avatarContainerSelectors) {
      const avatarContainer = document.querySelector(selector);
      if (avatarContainer) {
        // Find the parent container that can hold both the avatar and the badge
        // Usually this is a flex container that has the avatar and other elements
        let parent = avatarContainer.parentElement;

        // Look for a suitable parent container (flex container, etc.)
        for (let i = 0; i < 5 && parent; i++) {
          const styles = window.getComputedStyle(parent);
          const display = styles.display;

          // Prefer flex containers that allow horizontal layout
          if (display === 'flex' || display === 'inline-flex') {
            // Check if it doesn't have overflow:hidden
            if (styles.overflow !== 'hidden') {
              return parent;
            }
          }

          // Also check if it's a container that holds profile elements
          if (parent.getAttribute('data-testid')?.includes('Profile') ||
              parent.getAttribute('data-testid')?.includes('User') ||
              parent.classList.toString().includes('r-18u37iz') || // Common Twitter flex class
              parent.classList.toString().includes('r-1w6e6rj')) { // Common Twitter flex class
            const parentStyles = window.getComputedStyle(parent);
            if (parentStyles.overflow !== 'hidden') {
              return parent;
            }
          }

          parent = parent.parentElement;
        }

        // If we found the avatar container but no suitable parent, return the parent
        // We'll insert after the avatar container
        if (avatarContainer.parentElement) {
          return avatarContainer.parentElement;
        }
      }
    }

    // Fallback: Try to find profile picture image and use its container
    const profilePics = document.querySelectorAll('img[src*="profile_images"], img[alt*="profile picture"], img[alt*="Profile picture"]');
    for (const img of profilePics) {
      const rect = img.getBoundingClientRect();
      // Profile pictures are typically square and reasonably sized (40px+)
      if (rect.width >= 40 && rect.height >= 40) {
        // Find the UserAvatar-Container by going up the DOM tree
        let element = img;
        for (let i = 0; i < 10 && element; i++) {
          if (element.getAttribute('data-testid')?.includes('UserAvatar-Container')) {
            // Found the avatar container, return its parent
            if (element.parentElement) {
              return element.parentElement;
            }
            return element;
          }
          element = element.parentElement;
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
        // Calculate new rotation duration and icon size based on updated score
        const rotationDuration = calculateRotationDuration(score);
        const iconSize = calculateIconSize(score);
        const fontSize = calculateFontSize(iconSize);

        // Update score in existing badge
        const scoreValue = existingBadge.querySelector('.score-value');
        const icon = existingBadge.querySelector('.iq-guessr-rotating-icon');

        if (scoreValue && icon) {
          scoreValue.textContent = score;
          // Update rotation speed and icon size
          // Only update animation duration if not currently hovering (to avoid interrupting hover slowdown)
          const isHovering = existingBadge.matches(':hover');
          if (!isHovering) {
            icon.style.animationDuration = `${rotationDuration}s`;
          }
          icon.style.width = `${iconSize}px`;
          icon.style.height = `${iconSize}px`;
          // Ensure transition is set for smooth animation changes
          icon.style.transition = 'animation-duration 0.3s ease';
          // Update font size proportionally
          scoreValue.style.fontSize = `${fontSize}px`;

          // Ensure hover handlers are attached (in case badge was created before hover handlers were added)
          if (!existingBadge.hasAttribute('data-hover-handlers-attached')) {
            existingBadge.setAttribute('data-hover-handlers-attached', 'true');
            existingBadge.onmouseenter = () => {
              existingBadge.style.transform = 'scale(1.1)';
              const hoverIcon = existingBadge.querySelector('.iq-guessr-rotating-icon');
              if (hoverIcon) {
                const baseDuration = 3; // Base duration for score 0
                hoverIcon.style.transition = 'animation-duration 0.3s ease';
                hoverIcon.style.animationDuration = `${baseDuration}s`;
              }
            };
            existingBadge.onmouseleave = () => {
              existingBadge.style.transform = 'scale(1)';
              const hoverIcon = existingBadge.querySelector('.iq-guessr-rotating-icon');
              if (hoverIcon) {
                const currentScore = parseInt(score) || 0;
                const normalDuration = calculateRotationDuration(currentScore);
                hoverIcon.style.transition = 'animation-duration 0.3s ease';
                hoverIcon.style.animationDuration = `${normalDuration}s`;
              }
            };
          }
        } else {
          // If badge structure changed, update the innerHTML
          const img = existingBadge.querySelector('img');
          if (img) {
            existingBadge.innerHTML = `
              <div style="position: relative; display: inline-block;">
                <img src="${chrome.runtime.getURL('icons/Variants/Fullsize/IqGuessrTrspW.png')}" alt="IqGuessr" class="iq-guessr-rotating-icon" style="width: ${iconSize}px; height: ${iconSize}px; display: block; animation-duration: ${rotationDuration}s;">
                <span class="score-value" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: ${fontSize}px; font-weight: 700; color: white; text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9); pointer-events: none; z-index: 1;">${score}</span>
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

      // Find the UserAvatar-Container within the insertion point
      const avatarContainer = insertionPoint.querySelector('div[data-testid^="UserAvatar-Container-"]') ||
                             insertionPoint.querySelector('div[data-testid*="UserAvatar-Container"]');

      if (avatarContainer) {
        // Insert badge right after the UserAvatar-Container
        if (avatarContainer.nextSibling) {
          insertionPoint.insertBefore(badge, avatarContainer.nextSibling);
        } else {
          // No next sibling, append after the avatar container
          insertionPoint.appendChild(badge);
        }
      } else {
        // Fallback: Try to find the avatar container by going through children
        const allElements = insertionPoint.querySelectorAll('div[data-testid*="UserAvatar"]');
        for (const element of allElements) {
          if (element.getAttribute('data-testid')?.includes('UserAvatar-Container')) {
            // Found avatar container, insert badge after it
            if (element.nextSibling) {
              insertionPoint.insertBefore(badge, element.nextSibling);
            } else {
              insertionPoint.appendChild(badge);
            }
            break;
          }
        }

        // If still not found, append to insertion point
        if (!badge.parentElement) {
          insertionPoint.appendChild(badge);
        }
      }

      // Update badge positioning to be next to profile picture
      badge.style.marginLeft = '12px';
      badge.style.marginTop = '0';
      badge.style.verticalAlign = 'middle';
      badge.style.alignSelf = 'center'; // Center vertically with avatar

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

            // Calculate new size and rotation based on updated score
            const rotationDuration = calculateRotationDuration(newScore);
            const iconSize = calculateIconSize(newScore);
            const fontSize = calculateFontSize(iconSize);

            if (scoreValue) {
              scoreValue.textContent = newScore;
              scoreValue.style.fontSize = `${fontSize}px`;
            }

            // Update rotation speed and icon size
            if (icon) {
              // Only update animation duration if not currently hovering (to avoid interrupting hover slowdown)
              const isHovering = badge.matches(':hover');
              if (!isHovering) {
                icon.style.animationDuration = `${rotationDuration}s`;
              }
              icon.style.width = `${iconSize}px`;
              icon.style.height = `${iconSize}px`;
              // Ensure transition is set for smooth animation changes
              icon.style.transition = 'animation-duration 0.3s ease';
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

