/**
 * Profile Badge Feature
 * Adds IQGuessr total score badge on user profile pages
 */

(function() {
  'use strict';

  const getSettings = () => window.Settings || {};

  let storageListenerSetup = false;
  let profileObserverSetup = false;



  /**
   * Calculate rotation duration based on score
   * Higher score = faster rotation (shorter duration)
   * Formula: duration = max(0.05, 3 / (1 + score / 100))
   * This gives: 0 score = 3s, 100 = 1.5s, 1000 = 0.27s, 10000 = 0.03s, etc.
   */
  function calculateRotationDuration(score) {
    const baseDuration = 20; // Base duration in seconds for score 0
    const divisor = 10000; // Controls how quickly duration decreases
    const minDuration = 0.05; // Minimum duration (maximum speed)

    const duration = Math.max(minDuration, baseDuration / (1 + score / divisor));
    return duration;
  }

  /**
   * Calculate icon size based on score
   * Higher score = larger icon
   * Formula: size = 40 + 13 * log10(max(score, 10) / 10)
   * This gives: 0-10 score = 40px, 100 = 53px, 1000 = 66px, 10000 = 79px, etc.
   * Grows smoothly by 13px for every 10x increase in score
   */
  function calculateIconSize(score) {
    const baseSize = 40; // Base size at score 0-10
    const sizeIncrement = 13; // Pixels added per 10x score increase

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
   * Get score from storage and update/create badge
   * Returns the badge element if created, or updates existing badge
   * Does NOT insert the badge into the DOM - that will be handled separately
   */
  function getScoreAndUpdateBadge() {
    // Get the score from storage (check both sync and local, and all keys)
    return Promise.all([
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

      // Check if badge already exists
      const existingBadge = document.querySelector('.iq-guessr-score-badge');
      if (existingBadge) {
        // Update existing badge
        const rotationDuration = calculateRotationDuration(score);
        const iconSize = calculateIconSize(score);
        const fontSize = 16; // Fixed font size, doesn't grow with icon

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
        }

        return existingBadge;
      } else {
        // Create new badge
        const badge = createScoreBadge(score);
        badge.setAttribute('data-stats-tooltip-attached', 'true');
        return badge;
      }
    }).catch((error) => {
      console.warn('[IqGuessr] Error loading score:', error);
      // Fallback: try all storage methods
      return new Promise((resolve) => {
        chrome.storage.sync.get(null, (allSync) => {
          chrome.storage.local.get(null, (allLocal) => {
            let score = allSync.iqGuessrScore ?? allLocal.iqGuessrScore ?? 0;

            // Convert to number
            if (typeof score === 'string') {
              score = parseFloat(score) || 0;
            }
            score = Number(score) || 0;

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
              resolve(existingBadge);
            } else {
              resolve(null);
            }
          });
        });
      });
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

      }
    });

    storageListenerSetup = true;
  }

  /**
   * Get the current user's handle from storage or detect from page
   */
  function getCurrentUserHandle() {
    return new Promise((resolve) => {
      // Try to get from storage first
      chrome.storage.sync.get(['userHandle', 'twitterHandle'], (result) => {
        if (result.userHandle) {
          resolve(result.userHandle);
          return;
        }
        if (result.twitterHandle) {
          resolve(result.twitterHandle);
          return;
        }

        // Try to detect from the page - look for the current user's handle in the sidebar/navigation
        // Check for nav links that point to the current user's profile
        const navLinks = document.querySelectorAll('nav a[href^="/"]');
        for (const link of navLinks) {
          const href = link.getAttribute('href');
          if (href && /^\/[a-zA-Z0-9_]+$/.test(href)) {
            const handle = href.slice(1); // Remove leading slash
            // Store it for future use
            chrome.storage.sync.set({ userHandle: handle });
            resolve(handle);
            return;
          }
        }

        // Fallback: try to get from URL pathname if we're on a profile page
        const pathname = window.location.pathname;
        const match = pathname.match(/^\/([a-zA-Z0-9_]+)(?:\/(with_replies|media|likes))?\/?$/);
        if (match && match[1]) {
          // Check if there's an "Edit Profile" button (only on own profile)
          const editProfileButton = findEditProfileButton();
          if (editProfileButton) {
            const handle = match[1];
            chrome.storage.sync.set({ userHandle: handle });
            resolve(handle);
            return;
          }
        }

        resolve(null);
      });
    });
  }

  /**
   * Check if we're on the user's own profile page
   */
  async function isOwnProfile() {
    const pathname = window.location.pathname;
    const match = pathname.match(/^\/([a-zA-Z0-9_]+)(?:\/(with_replies|media|likes))?\/?$/);
    if (!match || !match[1]) {
      return false;
    }

    const currentHandle = match[1];
    const userHandle = await getCurrentUserHandle();

    // If we have a stored handle, compare it
    if (userHandle && currentHandle.toLowerCase() === userHandle.toLowerCase()) {
      return true;
    }

    // Fallback: check if "Edit Profile" button exists (only appears on own profile)
    const editProfileButton = findEditProfileButton();
    return editProfileButton !== null;
  }

  /**
   * Find the "Edit Profile" button on the profile page
   */
  function findEditProfileButton() {
    // Try multiple selectors for the Edit Profile button
    const selectors = [
      'a[href="/settings/profile"]',
      'a[href*="/settings/profile"]',
      'div[role="button"][aria-label*="Edit profile"]',
      'div[role="button"][aria-label*="Edit Profile"]',
      'button[aria-label*="edit profile"]',
      'button[aria-label*="Edit Profile"]'
    ];

    for (const selector of selectors) {
      const button = document.querySelector(selector);
      if (button) {
        return button;
      }
    }

    // Try to find by text content
    const allButtons = document.querySelectorAll('a, button, div[role="button"]');
    for (const button of allButtons) {
      const text = button.textContent?.toLowerCase() || '';
      if (text.includes('edit profile') || text.includes('editprofile')) {
        return button;
      }
    }

    return null;
  }

  /**
   * Add the score badge under the Edit Profile button on own profile page
   */
  async function addScoreBadgeToOwnProfile() {
    const settings = getSettings();

    // Check if feature is enabled
    if (!settings.showProfileScoreBadge || !settings.enableIQGuessr) {
      return;
    }

    // Check if we're on own profile
    const isOwn = await isOwnProfile();
    if (!isOwn) {
      return;
    }

    // Find the Edit Profile button
    const editProfileButton = findEditProfileButton();
    if (!editProfileButton) {
      return;
    }

    // Find the profile picture container
    const profilePicture = document.querySelector('div[data-testid*="UserAvatar-Container"]') ||
                          document.querySelector('div[data-testid*="UserAvatar"]');

    // Find the container that holds both the profile picture and Edit Profile button
    // This is the parent container that has both elements as direct or indirect children
    let container = editProfileButton.parentElement;

    // Look for the container that contains both the profile picture and the button
    // We need to find a common parent that has both
    while (container && container !== document.body) {
      const hasProfilePic = profilePicture && container.contains(profilePicture);
      const hasButton = container.contains(editProfileButton);

      // Check if this container has both elements
      if (hasProfilePic && hasButton) {
        // Make sure this container is the direct parent of both, or find the right level
        // If the profile picture and button share the same parent, use that
        if (profilePicture && editProfileButton.parentElement === container) {
          // They're siblings in this container, perfect
          break;
        } else if (profilePicture && profilePicture.parentElement === container &&
                   editProfileButton.parentElement === container) {
          // Both are direct children
          break;
        }
      }
      container = container.parentElement;
    }

    // If we couldn't find a good container, use the button's parent
    if (!container || container === document.body) {
      container = editProfileButton.parentElement;
    }

    // Check if badge already exists and is already placed correctly
    const existingBadge = document.querySelector('.iq-guessr-score-badge');
    if (existingBadge) {
      // Check if it's already in a wrapper and in the right container
      const existingWrapper = existingBadge.closest('.iq-guessr-profile-badge-wrapper');
      if (existingWrapper && container && container.contains(existingWrapper)) {
        // Badge is already placed correctly, just update it
        await getScoreAndUpdateBadge();
        return;
      }
      // Badge exists but not in the right place - clean up and remove it
      // Clean up any position update handlers
      if (existingBadge._positionUpdateHandler) {
        window.removeEventListener('resize', existingBadge._positionUpdateHandler);
        window.removeEventListener('scroll', existingBadge._positionUpdateHandler, true);
        delete existingBadge._positionUpdateHandler;
      }
      // Remove wrapper if it exists
      if (existingWrapper) {
        existingWrapper.remove();
      } else {
        existingBadge.remove();
      }
    }

    // Get or create the badge
    const badge = await getScoreAndUpdateBadge();
    if (!badge) {
      return;
    }

    // Create a wrapper that takes horizontal space but no vertical space
    const badgeWrapper = document.createElement('span');
    badgeWrapper.className = 'iq-guessr-profile-badge-wrapper';
    badgeWrapper.style.cssText = `
      display: inline-block !important;
      height: 0 !important;
      width: auto !important;
      overflow: visible !important;
      vertical-align: middle !important;
      position: relative !important;
      margin-left: 8px !important;
      margin-right: 8px !important;
    `;

    // Style the badge to be absolutely positioned within the wrapper
    // This way it doesn't affect vertical layout but still takes horizontal space
    badge.style.setProperty('position', 'absolute', 'important');
    badge.style.setProperty('top', '50%', 'important');
    badge.style.setProperty('left', '0', 'important');
    badge.style.setProperty('transform', 'translateY(-50%)', 'important');
    badge.style.setProperty('margin', '0', 'important');
    badge.style.setProperty('margin-left', '0', 'important');
    badge.style.setProperty('margin-right', '0', 'important');
    badge.style.setProperty('display', 'inline-flex', 'important');

    // Put badge inside wrapper
    badgeWrapper.appendChild(badge);

    // Insert the badge between the profile picture and Edit Profile button
    // Find where to insert it in the container
    if (container) {
      // Get all children of the container
      const children = Array.from(container.children);

      // Find the index of the Edit Profile button
      let buttonIndex = -1;
      for (let i = 0; i < children.length; i++) {
        if (children[i].contains(editProfileButton) || children[i] === editProfileButton) {
          buttonIndex = i;
          break;
        }
      }

      // Find the profile picture index
      let profilePicIndex = -1;
      if (profilePicture) {
        for (let i = 0; i < children.length; i++) {
          if (children[i].contains(profilePicture) || children[i] === profilePicture) {
            profilePicIndex = i;
            break;
          }
        }
      }

      // Insert the badge wrapper between profile picture and button
      if (buttonIndex >= 0) {
        // Insert before the button's container
        const targetElement = children[buttonIndex];
        if (targetElement === editProfileButton) {
          // Button is direct child, insert before it
          container.insertBefore(badgeWrapper, editProfileButton);
        } else {
          // Button is in a child element, insert before that child
          container.insertBefore(badgeWrapper, targetElement);
        }
      } else {
        // Fallback: insert before the button
        if (editProfileButton.parentElement === container) {
          container.insertBefore(badgeWrapper, editProfileButton);
        } else {
          // Insert at the end
          container.appendChild(badgeWrapper);
        }
      }
    } else {
      // Last resort: insert before the button
      if (editProfileButton.parentElement) {
        editProfileButton.parentElement.insertBefore(badgeWrapper, editProfileButton);
      }
    }
  }

  /**
   * Set up observer to monitor profile page changes
   */
  function setupProfileObserver() {
    if (profileObserverSetup) {
      return;
    }

    // Initial check
    addScoreBadgeToOwnProfile();

    // Set up MutationObserver to watch for DOM changes
    const observer = new MutationObserver(() => {
      addScoreBadgeToOwnProfile();
    });

    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also check on URL changes (for SPA navigation)
    let lastUrl = window.location.href;
    const urlCheckInterval = setInterval(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        // Small delay to let DOM update
        setTimeout(() => {
          addScoreBadgeToOwnProfile();
        }, 500);
      }
    }, 1000);

    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
      clearInterval(urlCheckInterval);
      observer.disconnect();
    });

    profileObserverSetup = true;
  }

  // Set up storage listener on initialization
  setupStorageListener();

  // Set up profile observer when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        setupProfileObserver();
      }, 1000); // Give page time to render
    });
  } else {
    setTimeout(() => {
      setupProfileObserver();
    }, 1000);
  }

  // Export for debugging
  if (typeof window !== 'undefined') {
    window.ProfileBadge = {
      getScoreAndUpdateBadge,
      createScoreBadge,
      calculateRotationDuration,
      calculateIconSize,
      addScoreBadgeToOwnProfile,
      isOwnProfile,
      findEditProfileButton
    };
  }
})();

