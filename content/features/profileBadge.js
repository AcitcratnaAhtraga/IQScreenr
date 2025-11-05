/**
 * Profile Badge Feature
 * Adds IQGuessr total score badge on user profile pages
 */

(function() {
  'use strict';

  const getSettings = () => window.Settings || {};

  let storageListenerSetup = false;
  let profileBadgeObserver = null;
  let insertProfileBadgeTimeout = null;



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
      // Check if badge is positioned with top: 50% (profile page positioning)
      const computedStyle = window.getComputedStyle(badge);
      const topValue = badge.style.top || computedStyle.top;
      const hasTop50 = topValue === '50%' || topValue.includes('50%');

      // Combine scale with translateY(-50%) if badge is vertically centered
      if (hasTop50) {
        badge.style.transform = 'translateY(-50%) scale(1.1)';
      } else {
        badge.style.transform = 'scale(1.1)';
      }

      // Slow down rotation to base speed (score 0) on hover
      const icon = badge.querySelector('.iq-guessr-rotating-icon');
      if (icon) {
        const baseDuration = 3; // Base duration for score 0
        icon.style.transition = 'animation-duration 0.3s ease';
        icon.style.animationDuration = `${baseDuration}s`;
      }
    };

    badge.onmouseleave = () => {
      // Check if badge is positioned with top: 50% (profile page positioning)
      const computedStyle = window.getComputedStyle(badge);
      const topValue = badge.style.top || computedStyle.top;
      const hasTop50 = topValue === '50%' || topValue.includes('50%');

      // Restore transform, preserving translateY(-50%) if badge is vertically centered
      if (hasTop50) {
        badge.style.transform = 'translateY(-50%) scale(1)';
      } else {
        badge.style.transform = 'scale(1)';
      }

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
              // Check if badge is positioned with top: 50% (profile page positioning)
              const computedStyle = window.getComputedStyle(existingBadge);
              const topValue = existingBadge.style.top || computedStyle.top;
              const hasTop50 = topValue === '50%' || topValue.includes('50%');

              // Combine scale with translateY(-50%) if badge is vertically centered
              if (hasTop50) {
                existingBadge.style.transform = 'translateY(-50%) scale(1.1)';
              } else {
                existingBadge.style.transform = 'scale(1.1)';
              }

              const hoverIcon = existingBadge.querySelector('.iq-guessr-rotating-icon');
              if (hoverIcon) {
                const baseDuration = 3; // Base duration for score 0
                hoverIcon.style.transition = 'animation-duration 0.3s ease';
                hoverIcon.style.animationDuration = `${baseDuration}s`;
              }
            };
            existingBadge.onmouseleave = () => {
              // Check if badge is positioned with top: 50% (profile page positioning)
              const computedStyle = window.getComputedStyle(existingBadge);
              const topValue = existingBadge.style.top || computedStyle.top;
              const hasTop50 = topValue === '50%' || topValue.includes('50%');

              // Restore transform, preserving translateY(-50%) if badge is vertically centered
              if (hasTop50) {
                existingBadge.style.transform = 'translateY(-50%) scale(1)';
              } else {
                existingBadge.style.transform = 'scale(1)';
              }

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
   * Check if we're on the user's own profile page
   * Compares the current URL handle with the stored handle, or checks for Edit Profile button
   */
  function isOwnProfilePage() {
    return new Promise((resolve) => {
      // Primary check: Look for Edit Profile button (only appears on own profile)
      const editProfileButton = document.querySelector('a[data-testid="editProfileButton"]');
      if (editProfileButton) {
        resolve(true);
        return;
      }

      // Secondary check: Compare URL handle with stored handle
      const pathname = window.location.pathname;
      const urlHandle = pathname.match(/^\/([a-zA-Z0-9_]+)/)?.[1];

      if (!urlHandle) {
        resolve(false);
        return;
      }

      // Try multiple possible storage keys for the handle
      chrome.storage.sync.get(['twitterHandle', 'userHandle', 'handle'], (result) => {
        const storedHandle = result.twitterHandle || result.userHandle || result.handle;
        if (storedHandle && storedHandle.toLowerCase() === urlHandle.toLowerCase()) {
          resolve(true);
        } else {
          // If no stored handle matches, check if Edit Profile button exists (it might have been added)
          setTimeout(() => {
            const editBtn = document.querySelector('a[data-testid="editProfileButton"]');
            resolve(!!editBtn);
          }, 100);
        }
      });
    });
  }

  /**
   * Find the insertion point for the badge on own profile page
   * Should be after profile picture and before Edit Profile button
   */
  function findProfileBadgeInsertionPoint() {
    // Find the Edit Profile button
    const editProfileButton = document.querySelector('a[data-testid="editProfileButton"]');
    if (!editProfileButton) {
      return null;
    }

    // Find the parent container that contains both the profile picture and the Edit Profile button
    // The structure is: container > [profile picture container] > [badge wrapper?] > [Edit Profile button]
    const container = editProfileButton.closest('div[class*="r-1habvwh"]');
    if (!container) {
      return null;
    }

    // Find the profile picture container (UserAvatar container)
    const profilePicContainer = container.querySelector('[data-testid*="UserAvatar"]');
    if (!profilePicContainer) {
      // If we can't find the profile pic container, try to find the parent of edit button
      const editButtonParent = editProfileButton.parentElement;
      if (editButtonParent && editButtonParent.parentElement) {
        return {
          parent: editButtonParent.parentElement,
          beforeElement: editButtonParent
        };
      }
      return null;
    }

    // Find the container that holds both the profile pic and the edit button
    // This is typically a flex container with class r-18u37iz or similar
    const flexContainer = profilePicContainer.closest('div[class*="r-18u37iz"]');
    if (flexContainer) {
      // Find the container that comes after the profile pic and before the edit button
      const editButtonParent = editProfileButton.parentElement;
      if (editButtonParent && editButtonParent.parentElement === flexContainer) {
        return {
          parent: flexContainer,
          beforeElement: editButtonParent
        };
      }
    }

    // Fallback: insert before the edit button's parent
    const editButtonParent = editProfileButton.parentElement;
    if (editButtonParent && editButtonParent.parentElement) {
      return {
        parent: editButtonParent.parentElement,
        beforeElement: editButtonParent
      };
    }

    return null;
  }

  /**
   * Insert or move the badge to the correct position on own profile page
   */
  async function insertProfileBadge() {
    const settings = getSettings();

    // Check if profile badge is enabled
    if (!settings.showProfileScoreBadge) {
      return;
    }

    // Check if we're on own profile page
    const isOwnProfile = await isOwnProfilePage();
    if (!isOwnProfile) {
      return;
    }

    // Get or create the badge
    const badge = await getScoreAndUpdateBadge();
    if (!badge) {
      return;
    }

    // Find insertion point
    const insertionPoint = findProfileBadgeInsertionPoint();
    if (!insertionPoint) {
      return;
    }

    const { parent, beforeElement } = insertionPoint;

    // Check if badge is already in a wrapper
    let wrapper = badge.closest('.iq-guessr-profile-badge-wrapper');
    if (!wrapper) {
      // Create wrapper if it doesn't exist
      wrapper = document.createElement('span');
      wrapper.className = 'iq-guessr-profile-badge-wrapper';
      wrapper.style.cssText = `
        display: inline-block !important;
        height: 0px !important;
        width: auto !important;
        overflow: visible !important;
        vertical-align: middle !important;
        position: relative !important;
        margin-left: 8px !important;
        margin-right: 8px !important;
      `;
      // Remove badge from current location if it exists elsewhere
      if (badge.parentElement) {
        badge.parentElement.removeChild(badge);
      }
      wrapper.appendChild(badge);
    } else {
      // Badge is already in a wrapper, check if wrapper is in the correct position
      if (wrapper.parentElement === parent && wrapper.nextSibling === beforeElement) {
        return; // Already in correct position
      }
      // Remove wrapper from current location
      if (wrapper.parentElement) {
        wrapper.parentElement.removeChild(wrapper);
      }
    }

    // Update badge positioning styles for profile page
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
      margin: 0 !important;
      cursor: pointer;
      transition: all 0.2s ease;
      visibility: visible !important;
      opacity: 1 !important;
      position: absolute !important;
      z-index: 1000 !important;
      top: 50% !important;
      left: 0px !important;
      transform: translateY(-50%);
      border: none;
      box-shadow: none;
    `;

    // Insert wrapper before the Edit Profile button's parent
    try {
      parent.insertBefore(wrapper, beforeElement);
    } catch (e) {
      console.warn('[IqGuessr] Error inserting profile badge:', e);
    }
  }

  /**
   * Set up observer to watch for profile page changes
   */
  function setupProfileBadgeObserver() {
    // Check if we're on a profile page
    const isProfilePage = /^\/[a-zA-Z0-9_]+(\/(with_replies|media|likes))?\/?$/.test(window.location.pathname);
    if (!isProfilePage) {
      // Not on a profile page, clean up observer if it exists
      if (profileBadgeObserver) {
        profileBadgeObserver.disconnect();
        profileBadgeObserver = null;
      }
      return;
    }

    // If observer already exists, just trigger insertion check
    if (profileBadgeObserver) {
      insertProfileBadge();
      return;
    }

    // Debounced function to insert badge
    const debouncedInsert = () => {
      if (insertProfileBadgeTimeout) {
        clearTimeout(insertProfileBadgeTimeout);
      }
      insertProfileBadgeTimeout = setTimeout(() => {
        insertProfileBadge();
      }, 300);
    };

    // Try to insert badge immediately
    insertProfileBadge();

    // Set up observer to watch for DOM changes (debounced)
    profileBadgeObserver = new MutationObserver(() => {
      debouncedInsert();
    });

    profileBadgeObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also try again after delays to catch late-loading elements
    setTimeout(() => {
      insertProfileBadge();
    }, 1000);

    setTimeout(() => {
      insertProfileBadge();
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
      if (profileBadgeObserver) {
        profileBadgeObserver.disconnect();
        profileBadgeObserver = null;
      }
      setTimeout(() => {
        setupProfileBadgeObserver();
      }, 500);
    }
  }

  // Monitor URL changes
  setInterval(checkUrlChange, 1000);

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

  // Set up storage listener on initialization
  setupStorageListener();

  // Set up profile badge observer on initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setupProfileBadgeObserver();
    });
  } else {
    setupProfileBadgeObserver();
  }

  // Export for debugging
  if (typeof window !== 'undefined') {
    window.ProfileBadge = {
      getScoreAndUpdateBadge,
      createScoreBadge,
      calculateRotationDuration,
      calculateIconSize,
      insertProfileBadge,
      isOwnProfilePage
    };
  }
})();

