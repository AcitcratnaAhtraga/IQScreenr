/**
 * Profile Badge Feature
 * Adds IQGuessr total score badge on user profile pages
 */

(function() {
  'use strict';

  const getSettings = () => window.Settings || {};

  let storageListenerSetup = false;



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

  // Set up storage listener on initialization
  setupStorageListener();

  // Export for debugging
  if (typeof window !== 'undefined') {
    window.ProfileBadge = {
      getScoreAndUpdateBadge,
      createScoreBadge,
      calculateRotationDuration,
      calculateIconSize
    };
  }
})();

