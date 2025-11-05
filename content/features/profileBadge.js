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
   * Formula: size = 40 + 12 * log10(max(score, 10) / 10)
   * This gives: 0-10 score = 40px, 100 = 52px, 1000 = 64px, 10000 = 76px, etc.
   * Grows smoothly by 12px for every 10x increase in score
   */
  function calculateIconSize(score) {
    const baseSize = 40; // Base size at score 0-10
    const sizeIncrement = 12; // Pixels added per 10x score increase

    // Ensure score is at least 10 for logarithm calculation
    const adjustedScore = Math.max(score, 10);

    // Calculate size using logarithmic scaling
    // log10(adjustedScore / 10) gives us the number of 10x increments
    const size = baseSize + sizeIncrement * Math.log10(adjustedScore / 10);

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
        <span class="score-value" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: ${fontSize}px; font-weight: 700; color: black; text-shadow: 0 1px 3px rgba(255, 255, 255, 0.9); pointer-events: none; z-index: 1;">${score}</span>
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

    let avatarContainer = null;
    for (const selector of avatarContainerSelectors) {
      avatarContainer = document.querySelector(selector);
      if (avatarContainer) {
        break;
      }
    }

    if (!avatarContainer) {
      return null;
    }

    // Now find the correct parent container
    // The target parent should have classes like: r-1habvwh r-18u37iz r-1w6e6rj r-1wtj0ep
    // and should contain both the avatar container and the "Edit profile" button
    let parent = avatarContainer.parentElement;

    // Look for the specific container that has the flex classes and contains both avatar and edit button
    for (let i = 0; i < 8 && parent; i++) {
      const styles = window.getComputedStyle(parent);
      const display = styles.display;
      const classList = parent.classList.toString();

      // Check if this is the target container (has the flex classes)
      const hasTargetClasses = classList.includes('r-18u37iz') &&
                                classList.includes('r-1w6e6rj') &&
                                (classList.includes('r-1habvwh') || classList.includes('r-1wtj0ep'));

      // Check if it contains both avatar and edit button (confirms it's the right container)
      const hasEditButton = parent.querySelector('a[data-testid="editProfileButton"], a[href*="/settings/profile"]');
      const hasAvatar = parent.contains(avatarContainer);

      // Prefer containers that are flex and have the target classes
      if ((display === 'flex' || display === 'inline-flex') &&
          (hasTargetClasses || (hasEditButton && hasAvatar))) {
        // Make sure it doesn't have overflow:hidden
        if (styles.overflow !== 'hidden') {
          return parent;
        }
      }

      // Also check if it's a container that holds profile elements (backup)
      if (hasEditButton && hasAvatar && styles.overflow !== 'hidden') {
        return parent;
      }

      parent = parent.parentElement;
    }

    // Fallback: If we found the avatar container but no suitable parent,
    // try to find a parent that's a flex container
    parent = avatarContainer.parentElement;
    for (let i = 0; i < 5 && parent; i++) {
      const styles = window.getComputedStyle(parent);
      if ((styles.display === 'flex' || styles.display === 'inline-flex') &&
          styles.overflow !== 'hidden') {
        return parent;
      }
      parent = parent.parentElement;
    }

    // Last resort: return the immediate parent
    if (avatarContainer.parentElement) {
      return avatarContainer.parentElement;
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
      const showProfileBadge = settings.showProfileScoreBadge !== false; // Default to true

      // Only show badge if game mode is enabled AND profile badge is enabled
      if (!isGameModeEnabled || !showProfileBadge) {
        // Remove badge if it exists but settings are disabled
        if (!isGameModeEnabled || !showProfileBadge) {
          removeScoreBadge();
        }
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
        const fontSize = 16; // Fixed font size, doesn't grow with icon

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
          // Keep font size fixed and ensure color is black with white shadow
          scoreValue.style.fontSize = `${fontSize}px`;
          scoreValue.style.color = 'black';
          scoreValue.style.textShadow = '0 1px 3px rgba(255, 255, 255, 0.9)';

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
                <span class="score-value" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: ${fontSize}px; font-weight: 700; color: black; text-shadow: 0 1px 3px rgba(255, 255, 255, 0.9); pointer-events: none; z-index: 1;">${score}</span>
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
      // First try to find it directly in the insertion point
      let avatarContainer = insertionPoint.querySelector('div[data-testid^="UserAvatar-Container-"]') ||
                           insertionPoint.querySelector('div[data-testid*="UserAvatar-Container"]');

      // If not found, search more broadly but ensure it's a direct child or close descendant
      if (!avatarContainer) {
        // Try to find it by going up from any avatar containers in the document
        const allAvatarContainers = document.querySelectorAll('div[data-testid*="UserAvatar-Container"]');
        for (const container of allAvatarContainers) {
          if (insertionPoint.contains(container)) {
            avatarContainer = container;
            break;
          }
        }
      }

      if (avatarContainer) {
        // Ensure the avatar container is actually in the insertion point
        if (insertionPoint.contains(avatarContainer)) {
          // Insert badge right after the UserAvatar-Container
          if (avatarContainer.nextSibling) {
            insertionPoint.insertBefore(badge, avatarContainer.nextSibling);
          } else {
            // No next sibling, insert after the avatar container
            avatarContainer.parentElement.insertBefore(badge, avatarContainer.nextSibling);
            // If that didn't work, append to insertion point
            if (!badge.parentElement) {
              insertionPoint.appendChild(badge);
            }
          }
        } else {
          // Avatar container is not in insertion point, find it and insert after it
          const avatarParent = avatarContainer.parentElement;
          if (avatarParent && insertionPoint.contains(avatarParent)) {
            // Insert after the avatar container within its parent
            if (avatarContainer.nextSibling) {
              avatarParent.insertBefore(badge, avatarContainer.nextSibling);
            } else {
              avatarParent.appendChild(badge);
            }
          } else {
            // Last resort: append to insertion point
            insertionPoint.appendChild(badge);
          }
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

      // Ensure badge is visible and properly positioned
      badge.style.display = 'inline-flex';
      badge.style.visibility = 'visible';
      badge.style.opacity = '1';

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
            const fontSize = 16; // Fixed font size, doesn't grow with icon

            if (scoreValue) {
              scoreValue.textContent = newScore;
              scoreValue.style.fontSize = `${fontSize}px`;
              scoreValue.style.color = 'black';
              scoreValue.style.textShadow = '0 1px 3px rgba(255, 255, 255, 0.9)';
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
            // IQGuessr mode enabled - add badge immediately (if profile badge is also enabled)
            // Use force=false to respect profile badge setting
            badgeAdded = false; // Reset flag to allow adding
            addScoreBadge(false); // Check all settings
          } else {
            // IQGuessr mode disabled - remove badge
            removeScoreBadge();
          }
        }

        // Handle showProfileScoreBadge toggle
        if (changes.showProfileScoreBadge) {
          const showBadge = changes.showProfileScoreBadge.newValue !== false;

          if (showBadge) {
            // Profile badge enabled - add it if IqGuessr is also enabled
            badgeAdded = false;
            addScoreBadge(false);
          } else {
            // Profile badge disabled - remove it
            removeScoreBadge();
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

