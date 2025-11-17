/**
 * Badge Animation Utilities
 * Handles all badge animations: pulse, count-up, real-time updates
 */

(function() {
  'use strict';

// Get color utilities
const getColorUtils = () => window.BadgeColorUtils || {};

/**
 * Trigger pulse animation with color transition
 */
function triggerPulseAnimation(badge, iqColor) {
  let scoreElement = badge.querySelector('.iq-badge-front .iq-score') ||
                     badge.querySelector('.iq-score');
  if (!scoreElement) return;

  badge.classList.add('iq-badge-pulse');

  const startTime = Date.now();
  const duration = 300;

  function updateColor() {
    const elapsed = Date.now() - startTime;

    if (elapsed < duration) {
      if (elapsed < 150) {
        const t = elapsed / 150;
        const value = Math.floor(0 + (255 - 0) * t);
        scoreElement.style.color = `rgb(${value}, ${value}, ${value})`;
      } else {
        const t = (elapsed - 150) / 150;
        const value = Math.floor(255 + (0 - 255) * t);
        scoreElement.style.color = `rgb(${value}, ${value}, ${value})`;
      }
      requestAnimationFrame(updateColor);
    } else {
      // Check if this is a guess badge - restore black color, otherwise remove inline style
      const isGuessBadge = badge.hasAttribute('data-iq-guessed') || 
                          badge.hasAttribute('data-iq-guess') ||
                          badge.classList.contains('iq-badge-guess');
      if (isGuessBadge) {
        // Restore black color for guess badges
        scoreElement.style.setProperty('color', '#000000', 'important');
        // Also ensure icon is black
        const iconElements = badge.querySelectorAll('.iq-icon');
        iconElements.forEach(el => el.style.setProperty('color', '#000000', 'important'));
      } else {
        // Remove inline color style to restore default CSS color (#71767A)
        scoreElement.style.removeProperty('color');
      }
      badge.classList.remove('iq-badge-pulse');
    }
  }

  updateColor();
}

/**
 * Animate count-up from 0 to final IQ, then pulse animation
 */
function animateCountUp(badge, finalIQ, iqColor) {
  // Validate finalIQ
  if (!finalIQ || isNaN(finalIQ) || finalIQ < 55 || finalIQ > 145) {
    return;
  }

  const { hexToRgb, desaturateColor, parseColor, interpolateRgbColor } = getColorUtils();

  if (badge.hasAttribute('data-iq-animating') || badge.hasAttribute('data-iq-animated')) {
    return;
  }

  const darkerRed = '#b71c1c';
  const rgb = hexToRgb(darkerRed);
  const desat = desaturateColor(rgb, 0.5);
  const loadingColor = `rgb(${desat.r}, ${desat.g}, ${desat.b})`;

  const finalColorRgb = parseColor(iqColor);

  function startAnimation() {
    if (badge.hasAttribute('data-iq-animating') || badge.hasAttribute('data-iq-animated')) {
      return;
    }

    badge.setAttribute('data-iq-animating', 'true');

    // CRITICAL: Check if badge will have flip structure BEFORE DOM manipulation
    // This prevents size changes from switching structures during animation
    const confidenceAttr = badge.getAttribute('data-confidence');
    const willHaveFlip = confidenceAttr !== null;

    const scoreContainer = badge.querySelector('.iq-score');

    if (!scoreContainer) {
      // Preserve styles before innerHTML replacement
      const beforeMinHeight = badge.style.minHeight;
      const beforeMinWidth = badge.style.minWidth;
      const beforeDisplay = window.getComputedStyle(badge).display;

      // Build final structure immediately to prevent size changes
      if (willHaveFlip) {
        const confidence = parseInt(confidenceAttr, 10);
        // Get badge icon from settings
        const getSettings = () => window.Settings || {};
        const settings = getSettings();
        const badgeIcon = settings.badgeIcon || 'fa-info';
        const getIconHelper = () => window.BadgeIconHelper || {};
        const { getBadgeIconSVG } = getIconHelper();
        const iconSVG = getBadgeIconSVG ? getBadgeIconSVG(badgeIcon) : '';
        badge.innerHTML = `
          <div class="iq-badge-inner" style="transform: rotateY(0deg);">
            <div class="iq-badge-front">
              <span class="iq-icon">${iconSVG}</span>
              <span class="iq-score">${finalIQ}</span>
            </div>
            <div class="iq-badge-back">
              <span class="iq-icon">${iconSVG}</span>
              <span class="iq-score">${confidence}%</span>
            </div>
          </div>
        `;
        badge.classList.add('iq-badge-flip');
      } else {
        // Get badge icon from settings
        const getSettings = () => window.Settings || {};
        const settings = getSettings();
        const badgeIcon = settings.badgeIcon || 'fa-info';
        const getIconHelper = () => window.BadgeIconHelper || {};
        const { getBadgeIconSVG } = getIconHelper();
        const iconSVG = getBadgeIconSVG ? getBadgeIconSVG(badgeIcon) : '';
        badge.innerHTML = `
          <span class="iq-icon">${iconSVG}</span>
          <span class="iq-score">${finalIQ}</span>
        `;
      }
      badge.classList.remove('iq-badge-loading');
      badge.removeAttribute('data-iq-animating');
      badge.setAttribute('data-iq-animated', 'true');

      // Preserve min-height/min-width if they were set
      if (beforeMinHeight) {
        badge.style.setProperty('min-height', beforeMinHeight, 'important');
      }
      if (beforeMinWidth) {
        badge.style.setProperty('min-width', beforeMinWidth, 'important');
      }
      // Preserve display if it was set to block
      if (beforeDisplay === 'block') {
        badge.style.setProperty('display', 'block', 'important');
      }

      return;
    }

    const hasFlipStructure = badge.querySelector('.iq-badge-inner');
    let scoreElement;

    // CRITICAL: If loading badge doesn't have flip structure but will need it,
    // build it NOW before animation starts to prevent size changes
    if (!hasFlipStructure && willHaveFlip) {
      const confidence = parseInt(confidenceAttr, 10);
      // Get badge icon from settings
      const getSettings = () => window.Settings || {};
      const settings = getSettings();
      const badgeIcon = settings.badgeIcon || 'fa-info';
      const getIconHelper = () => window.BadgeIconHelper || {};
      const { getBadgeIconSVG } = getIconHelper();
      const iconSVG = getBadgeIconSVG ? getBadgeIconSVG(badgeIcon) : '';
      // Remove spinner before building flip structure
      const spinner = badge.querySelector('.iq-loading-spinner');
      if (spinner) {
        spinner.remove();
      }
      badge.innerHTML = `
        <div class="iq-badge-inner" style="transform: rotateY(0deg);">
          <div class="iq-badge-front">
            <span class="iq-icon">${iconSVG}</span>
            <span class="iq-score">0</span>
          </div>
          <div class="iq-badge-back">
            <span class="iq-icon">${iconSVG}</span>
            <span class="iq-score">${confidence}%</span>
          </div>
        </div>
      `;
      badge.classList.add('iq-badge-flip');
      scoreElement = badge.querySelector('.iq-badge-front .iq-score');
    } else if (hasFlipStructure) {
      scoreElement = badge.querySelector('.iq-badge-front .iq-score');
      const frontDiv = badge.querySelector('.iq-badge-front');
      if (!scoreElement && frontDiv) {
        // Ensure icon exists, create score element if missing
        let iconElement = frontDiv.querySelector('.iq-icon');
        if (!iconElement) {
          // Get badge icon from settings
          const getSettings = () => window.Settings || {};
          const settings = getSettings();
          const badgeIcon = settings.badgeIcon || 'fa-info';
          const getIconHelper = () => window.BadgeIconHelper || {};
          const { getBadgeIconSVG } = getIconHelper();
          const iconSVG = getBadgeIconSVG ? getBadgeIconSVG(badgeIcon) : '';
          iconElement = document.createElement('span');
          iconElement.className = 'iq-icon';
          iconElement.innerHTML = iconSVG;
          frontDiv.insertBefore(iconElement, frontDiv.firstChild);
        }
        scoreElement = document.createElement('span');
        scoreElement.className = 'iq-score';
        scoreElement.textContent = '0';
        frontDiv.appendChild(scoreElement);
      } else if (scoreElement) {
        scoreElement.textContent = '0';
        // Ensure icon exists
        const frontDiv = badge.querySelector('.iq-badge-front');
        if (frontDiv && !frontDiv.querySelector('.iq-icon')) {
          const getSettings = () => window.Settings || {};
          const settings = getSettings();
          const badgeIcon = settings.badgeIcon || 'fa-info';
          const getIconHelper = () => window.BadgeIconHelper || {};
          const { getBadgeIconSVG } = getIconHelper();
          const iconSVG = getBadgeIconSVG ? getBadgeIconSVG(badgeIcon) : '';
          const iconElement = document.createElement('span');
          iconElement.className = 'iq-icon';
          iconElement.innerHTML = iconSVG;
          frontDiv.insertBefore(iconElement, scoreElement);
        }
      }
    } else {
      if (scoreContainer) {
        scoreContainer.innerHTML = '0';
        scoreElement = scoreContainer;
      } else {
        // Preserve min-height/min-width before replacing innerHTML
        const preserveMinHeight = badge.style.minHeight;
        const preserveMinWidth = badge.style.minWidth;
        const preserveDisplay = window.getComputedStyle(badge).display === 'block' ? 'block' : null;

        // Get badge icon from settings
        const getSettings = () => window.Settings || {};
        const settings = getSettings();
        const badgeIcon = settings.badgeIcon || 'fa-info';
        const getIconHelper = () => window.BadgeIconHelper || {};
        const { getBadgeIconSVG } = getIconHelper();
        const iconSVG = getBadgeIconSVG ? getBadgeIconSVG(badgeIcon) : '';
        badge.innerHTML = `
          <span class="iq-icon">${iconSVG}</span>
          <span class="iq-score">0</span>
        `;
        scoreElement = badge.querySelector('.iq-score');

        // Restore preserved styles immediately after innerHTML replacement
        if (preserveMinHeight) {
          badge.style.setProperty('min-height', preserveMinHeight, 'important');
        }
        if (preserveMinWidth) {
          badge.style.setProperty('min-width', preserveMinWidth, 'important');
        }
        if (preserveDisplay) {
          badge.style.setProperty('display', preserveDisplay, 'important');
        }
      }
    }

    badge.classList.remove('iq-badge-loading');

    const spinner = badge.querySelector('.iq-loading-spinner');
    if (spinner) {
      spinner.remove();
    }

    const duration = 1200;
    const startTime = performance.now();
    let lastDisplayedIQ = -1;
    let animationFrameId = null;
    let lastUpdateTime = startTime;
    let freezeDetectionTime = startTime;
    const FREEZE_THRESHOLD = 150;
    let isShowingSpinner = false;
    let frozenAtIQ = -1;

    function updateNumber() {
      const now = performance.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const timeSinceLastUpdate = now - freezeDetectionTime;
      const isFrozen = timeSinceLastUpdate > FREEZE_THRESHOLD && lastDisplayedIQ >= 0 && lastDisplayedIQ < finalIQ && !isShowingSpinner;

      if (isFrozen && !isShowingSpinner) {
        frozenAtIQ = lastDisplayedIQ;
        isShowingSpinner = true;
        if (scoreElement) {
          scoreElement.innerHTML = '<span class="iq-loading-spinner">↻</span>';
        }
      }

      if (!isFrozen && isShowingSpinner) {
        isShowingSpinner = false;
        const resumeIQ = Math.min(frozenAtIQ + 1, finalIQ);
        lastDisplayedIQ = resumeIQ;
        frozenAtIQ = -1;
        if (scoreElement) {
          scoreElement.textContent = resumeIQ;
        }
        freezeDetectionTime = now;
      }

      const easedProgress = 1 - Math.pow(1 - progress, 3);
      let targetIQ = progress >= 1 ? finalIQ : Math.floor(easedProgress * finalIQ);

      const maxIncrement = Math.max(1, Math.ceil(finalIQ / 50));
      let currentIQ = lastDisplayedIQ === -1 ? 0 : lastDisplayedIQ;

      if (progress >= 1) {
        currentIQ = Math.min(currentIQ + maxIncrement, finalIQ);
        targetIQ = finalIQ;
      } else if (targetIQ > currentIQ) {
        const difference = targetIQ - currentIQ;
        if (difference > maxIncrement) {
          currentIQ = currentIQ + maxIncrement;
        } else {
          currentIQ = targetIQ;
        }
      } else {
        currentIQ = targetIQ;
      }

      const timeSinceLastUpdate2 = now - lastUpdateTime;
      const shouldForceUpdate = timeSinceLastUpdate2 > 50;

      if ((currentIQ !== lastDisplayedIQ || shouldForceUpdate || progress >= 0.95) && !isShowingSpinner) {
        if (progress >= 0.95 && currentIQ < finalIQ - 1) {
          currentIQ = Math.min(currentIQ + 1, finalIQ);
        }

        if (currentIQ > finalIQ) {
          currentIQ = finalIQ;
        }

        const willUpdate = currentIQ !== lastDisplayedIQ || shouldForceUpdate || progress >= 0.95;
        if (willUpdate && scoreElement) {
          scoreElement.textContent = currentIQ;
          lastDisplayedIQ = currentIQ;
          lastUpdateTime = now;
          freezeDetectionTime = now;
        }

        // Check if this is a guess badge - maintain grey background during animation
        const isGuessBadge = badge.hasAttribute('data-iq-guessed') || 
                            badge.hasAttribute('data-iq-guess') ||
                            badge.classList.contains('iq-badge-guess');
        
        if (isGuessBadge) {
          // Maintain grey background and black text for guess badges during animation
          badge.style.setProperty('background-color', '#9e9e9e', 'important');
          badge.style.setProperty('color', '#000000', 'important');
          badge.style.setProperty('border-radius', '100%', 'important');
          // Ensure icon and score are black
          const iconElements = badge.querySelectorAll('.iq-icon');
          const scoreElements = badge.querySelectorAll('.iq-score');
          iconElements.forEach(el => el.style.setProperty('color', '#000000', 'important'));
          scoreElements.forEach(el => el.style.setProperty('color', '#000000', 'important'));
        } else {
          const currentColor = interpolateRgbColor(
            parseColor(loadingColor),
            finalColorRgb,
            easedProgress
          );
          // Only update CSS variable - no background fill (transparent styling)
          badge.style.setProperty('--iq-badge-bg-color', currentColor);
        }
      } else if (isShowingSpinner) {
        // Check if this is a guess badge - maintain grey background during spinner
        const isGuessBadge = badge.hasAttribute('data-iq-guessed') || 
                            badge.hasAttribute('data-iq-guess') ||
                            badge.classList.contains('iq-badge-guess');
        
        if (isGuessBadge) {
          // Maintain grey background and black text for guess badges during spinner
          badge.style.setProperty('background-color', '#9e9e9e', 'important');
          badge.style.setProperty('color', '#000000', 'important');
          badge.style.setProperty('border-radius', '100%', 'important');
        } else {
          const currentColor = interpolateRgbColor(
            parseColor(loadingColor),
            finalColorRgb,
            easedProgress
          );
          // Only update CSS variable - no background fill (transparent styling)
          badge.style.setProperty('--iq-badge-bg-color', currentColor);
        }
      }

      const hasReachedFinal = lastDisplayedIQ >= finalIQ;

      if (!hasReachedFinal) {
        animationFrameId = requestAnimationFrame(updateNumber);
      } else {
        if (isShowingSpinner) {
          isShowingSpinner = false;
          if (scoreElement) {
            const spinner = scoreElement.querySelector('.iq-loading-spinner');
            if (spinner) {
              spinner.remove();
            }
          }
        }

        // Ensure scoreElement exists and update it
        if (scoreElement) {
          scoreElement.textContent = finalIQ;
        } else {
          // Fallback: try to find score element again
          const frontScore = badge.querySelector('.iq-badge-front .iq-score');
          if (frontScore) {
            frontScore.textContent = finalIQ;
          } else {
            const anyScore = badge.querySelector('.iq-score');
            if (anyScore) {
              anyScore.textContent = finalIQ;
            }
          }
        }
        // Check if this badge was originally a guess badge - maintain grey styling
        const wasGuessBadge = badge.hasAttribute('data-iq-guessed') || 
                              badge.hasAttribute('data-created-for-tweet-id');
        
        if (wasGuessBadge) {
          // Maintain grey background and black text for guess badges
          badge.style.setProperty('background-color', '#9e9e9e', 'important');
          badge.style.setProperty('color', '#000000', 'important');
          badge.style.setProperty('border-radius', '100%', 'important');
          // Ensure icon and score are black
          const iconElements = badge.querySelectorAll('.iq-icon');
          const scoreElements = badge.querySelectorAll('.iq-score');
          iconElements.forEach(el => el.style.setProperty('color', '#000000', 'important'));
          scoreElements.forEach(el => el.style.setProperty('color', '#000000', 'important'));
        } else {
          // Use CSS variable for final color - CSS handles styling
          badge.style.setProperty('--iq-badge-bg-color', iqColor);
          // Remove inline background-color style so CSS hover rules can work
          badge.style.removeProperty('background-color');
        }
        
        // Store original background color in CSS variable for hover inversion
        if (badge.classList.contains('iq-badge-flip')) {
          badge.style.setProperty('--iq-badge-original-bg', iqColor, 'important');
          // Set confidence color for hover (critical for flip badges)
          const confidenceAttr = badge.getAttribute('data-confidence');
          if (confidenceAttr !== null) {
            const confidence = parseInt(confidenceAttr, 10);
            if (!isNaN(confidence)) {
              const getBadgeManager = () => window.BadgeManager || {};
              const { getConfidenceColor } = getBadgeManager();
              if (getConfidenceColor) {
                const confidenceColor = getConfidenceColor(confidence);
                badge.style.setProperty('--iq-badge-confidence-color', confidenceColor, 'important');
              }
            }
          }
        }

        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }

        badge.removeAttribute('data-iq-animating');
        badge.setAttribute('data-iq-animated', 'true');

        // Safety check: If confidence data exists but flip structure wasn't built,
        // add it now (this handles edge cases where attribute was set after animation started)
        const confidenceAttr = badge.getAttribute('data-confidence');
        const hasFlipStructure = badge.querySelector('.iq-badge-inner');
        if (confidenceAttr !== null && !hasFlipStructure) {
          const confidence = parseInt(confidenceAttr, 10);
          if (!isNaN(confidence)) {
            const updateBadgeWithFlipStructure = window.BadgeAnimations?.updateBadgeWithFlipStructure;
            if (updateBadgeWithFlipStructure) {
              updateBadgeWithFlipStructure(badge, finalIQ, confidence);
            }
          }
        }

        // Note: We already built the flip structure earlier if needed,
        // but the safety check above ensures it exists if confidence data is present

        // Add hover handlers for color inversion if badge has flip structure
        if (badge.classList.contains('iq-badge-flip')) {
          // Ensure inline background-color is removed so CSS hover rules can work
          badge.style.removeProperty('background-color');
          // Ensure CSS variable is set
          if (!badge.style.getPropertyValue('--iq-badge-bg-color')) {
            badge.style.setProperty('--iq-badge-bg-color', iqColor);
          }
          // Ensure original bg variable is set for hover
          if (!badge.style.getPropertyValue('--iq-badge-original-bg')) {
            badge.style.setProperty('--iq-badge-original-bg', iqColor, 'important');
          }

          // CRITICAL: Check for cached guess even when IQGuessr is disabled
          // This ensures badges that were previously guessed show the white border permanently
          // Check if attribute was set before animation (preserve it)
          const hasCompared = badge.hasAttribute('data-iq-compared');
          if (!hasCompared) {
            const tweetElement = badge.closest('article[data-testid="tweet"]') ||
                                badge.closest('article[role="article"]') ||
                                badge.closest('article');
            const tweetId = tweetElement?.getAttribute('data-tweet-id');
            if (tweetId) {
              const gameManager = window.GameManager || {};
              if (gameManager && gameManager.getCachedGuess) {
                gameManager.getCachedGuess(tweetId).then(cachedGuess => {
                  if (cachedGuess && cachedGuess.guess !== undefined) {
                    // There's a cached guess, mark badge as compared (will show white border)
                    badge.setAttribute('data-iq-compared', 'true');
                  }
                }).catch(() => {
                  // Ignore errors
                });
              }
            }
          }

          const getBadgeCreation = () => window.BadgeCreation || {};
          const { addFlipBadgeHoverHandlers, addMobileBadgeHandlers } = getBadgeCreation();
          if (addFlipBadgeHoverHandlers) {
            addFlipBadgeHoverHandlers(badge);
          }
          // Also add mobile handlers after animation completes
          if (addMobileBadgeHandlers) {
            addMobileBadgeHandlers(badge);
          }
        }

        setTimeout(() => {
          triggerPulseAnimation(badge, iqColor);
        }, 200);
      }
    }

    updateNumber();
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        observer.disconnect();
        startAnimation();
      }
    });
  }, {
    threshold: 0.01,
    rootMargin: '50px'
  });

  observer.observe(badge);

  // Check visibility after layout is complete
  requestAnimationFrame(() => {
    const rect = badge.getBoundingClientRect();
    const isVisible = rect.top < window.innerHeight + 50 && rect.bottom > -50;
    if (isVisible) {
      observer.disconnect();
      startAnimation();
    }
  });
}

/**
 * Animate real-time badge update (count-up from current to new IQ and confidence)
 */
function animateRealtimeBadgeUpdate(badge, oldIQ, newIQ, iqColor, oldConfidence, newConfidence) {
  if (badge._animationFrameId) {
    cancelAnimationFrame(badge._animationFrameId);
    badge._animationFrameId = null;
  }

  const { hexToRgb, desaturateColor, parseColor, interpolateRgbColor } = getColorUtils();
  const getBadgeManager = () => window.BadgeManager || {};
  const { getIQColor } = getBadgeManager();

  badge.removeAttribute('data-iq-animating');
  badge.removeAttribute('data-iq-animated');

  // Use current background color as starting point, or IQ 100 color if badge just initialized
  const startIQ = oldIQ >= 0 ? oldIQ : 100;
  // For real-time badges, confidence starts at 0% and increases
  const startConfidence = (oldConfidence !== null && oldConfidence !== undefined && oldConfidence >= 0) ? oldConfidence : 0;

  let scoreElement = badge.querySelector('.iq-badge-front .iq-score') ||
                     badge.querySelector('.iq-score');
  if (!scoreElement) {
    return;
  }

  // Initialize starting values
  scoreElement.textContent = String(startIQ);

  // Update confidence display if flip structure exists
  const backScoreElement = badge.querySelector('.iq-badge-back .iq-score');
  if (backScoreElement && (newConfidence !== null && newConfidence !== undefined)) {
    backScoreElement.textContent = String(startConfidence);
  }

  // Get starting color (either current or 0% confidence color for real-time badges)
  let startColorRgb;
  const { getConfidenceColor } = getBadgeManager();
  if (oldIQ < 0 || oldIQ === 100) {
    // Starting fresh - use 0% confidence color (starts at 0% and increases)
    const initialColor = getConfidenceColor ? getConfidenceColor(0) :
                        (getIQColor ? getIQColor(100) : '#4CAF50');
    startColorRgb = parseColor(initialColor);
    badge.style.setProperty('background-color', initialColor, 'important');
  } else {
    const defaultColor = getConfidenceColor ? getConfidenceColor(0) :
                        (getIQColor ? getIQColor(100) : '#4CAF50');
    const currentBgColor = badge.style.backgroundColor || defaultColor;
    startColorRgb = parseColor(currentBgColor);
  }
  badge.style.setProperty('color', '#000000', 'important');

  const finalColorRgb = parseColor(iqColor);

  let currentIQ = startIQ;
  let currentConfidence = startConfidence;
  badge.setAttribute('data-iq-animating', 'true');

  const duration = 800;
  const startTime = performance.now();
  let lastDisplayedIQ = startIQ;
  let lastDisplayedConfidence = startConfidence;

  function updateNumber() {
    const now = performance.now();
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);

    const easedProgress = 1 - Math.pow(1 - progress, 3);

    // Animate IQ
    const iqDiff = newIQ - startIQ;
    const targetIQ = startIQ + Math.floor(easedProgress * iqDiff);
    const maxIncrementIQ = Math.max(1, Math.ceil(Math.abs(iqDiff) / 30));

    if (progress >= 1) {
      currentIQ = newIQ;
    } else {
      const difference = targetIQ - currentIQ;
      if (Math.abs(difference) > maxIncrementIQ) {
        currentIQ += difference > 0 ? maxIncrementIQ : -maxIncrementIQ;
      } else {
        currentIQ = targetIQ;
      }
    }

    if ((iqDiff > 0 && currentIQ > newIQ) || (iqDiff < 0 && currentIQ < newIQ)) {
      currentIQ = newIQ;
    }

    // Animate confidence if provided
    if (newConfidence !== null && newConfidence !== undefined) {
      const confidenceDiff = newConfidence - startConfidence;
      const targetConfidence = startConfidence + Math.floor(easedProgress * confidenceDiff);
      const maxIncrementConf = Math.max(1, Math.ceil(Math.abs(confidenceDiff) / 30));

      if (progress >= 1) {
        currentConfidence = newConfidence;
      } else {
        const difference = targetConfidence - currentConfidence;
        if (Math.abs(difference) > maxIncrementConf) {
          currentConfidence += difference > 0 ? maxIncrementConf : -maxIncrementConf;
        } else {
          currentConfidence = targetConfidence;
        }
      }

      if ((confidenceDiff > 0 && currentConfidence > newConfidence) || (confidenceDiff < 0 && currentConfidence < newConfidence)) {
        currentConfidence = newConfidence;
      }
    }

    // Interpolate color
    const currentColor = interpolateRgbColor(
      startColorRgb,
      finalColorRgb,
      easedProgress
    );
    badge.style.setProperty('background-color', currentColor, 'important');
    badge.style.setProperty('color', '#000000', 'important');

    // Update IQ display
    let currentScoreElement = badge.querySelector('.iq-badge-front .iq-score') ||
                               badge.querySelector('.iq-score');

    if (currentIQ !== lastDisplayedIQ) {
      if (currentScoreElement) {
        currentScoreElement.textContent = Math.max(0, Math.round(currentIQ));
        lastDisplayedIQ = currentIQ;
        scoreElement = currentScoreElement;
      } else {
        scoreElement = badge.querySelector('.iq-badge-front .iq-score') ||
                       badge.querySelector('.iq-score');
        if (scoreElement) {
          scoreElement.textContent = Math.max(0, Math.round(currentIQ));
          lastDisplayedIQ = currentIQ;
        }
      }
    }

    // Update confidence display
    if (newConfidence !== null && newConfidence !== undefined && currentConfidence !== lastDisplayedConfidence) {
      const currentBackScoreElement = badge.querySelector('.iq-badge-back .iq-score');
      if (currentBackScoreElement) {
        currentBackScoreElement.textContent = Math.max(0, Math.round(currentConfidence));
        lastDisplayedConfidence = currentConfidence;
      }
    }

    const iqComplete = (progress >= 1 && lastDisplayedIQ === newIQ);
    const confidenceComplete = (newConfidence === null || newConfidence === undefined || (progress >= 1 && lastDisplayedConfidence === newConfidence));

    if (!iqComplete || !confidenceComplete) {
      badge._animationFrameId = requestAnimationFrame(updateNumber);
    } else {
      // Finalize values
      const finalScoreElement = badge.querySelector('.iq-badge-front .iq-score') ||
                                badge.querySelector('.iq-score');
      if (finalScoreElement) {
        finalScoreElement.textContent = newIQ;
      } else {
        const fallbackScore = badge.querySelector('.iq-score');
        if (fallbackScore) {
          fallbackScore.textContent = newIQ;
        }
      }

      if (newConfidence !== null && newConfidence !== undefined) {
        const finalBackScoreElement = badge.querySelector('.iq-badge-back .iq-score');
        if (finalBackScoreElement) {
          finalBackScoreElement.textContent = newConfidence;
        }
      }

      // Use CSS variable instead of inline style - CSS handles styling
      badge.style.setProperty('--iq-badge-bg-color', iqColor);
      // Remove inline background-color so CSS hover rules can work
      badge.style.removeProperty('background-color');
      // Store original background color in CSS variable for hover inversion
      if (badge.classList.contains('iq-badge-flip')) {
        badge.style.setProperty('--iq-badge-original-bg', iqColor, 'important');
        // Add hover handlers for color inversion
        const getBadgeCreation = () => window.BadgeCreation || {};
        const { addFlipBadgeHoverHandlers } = getBadgeCreation();
        if (addFlipBadgeHoverHandlers) {
          addFlipBadgeHoverHandlers(badge);
        }
      }
      badge.removeAttribute('data-iq-animating');
      badge.setAttribute('data-iq-animated', 'true');
      badge._animationFrameId = null;

      // Skip pulse animation for real-time badges
      const isRealtimeBadge = badge.classList.contains('iq-badge-realtime') ||
                              badge.hasAttribute('data-iq-realtime');
      if (!isRealtimeBadge) {
        setTimeout(() => {
          triggerPulseAnimation(badge, iqColor);
        }, 100);
      }
    }
  }

  requestAnimationFrame(() => {
    updateNumber();
  });
}

/**
 * Update badge HTML structure to support flip animation showing confidence
 */
function updateBadgeWithFlipStructure(badge, iq, confidence) {
  if (badge.classList.contains('iq-badge-loading') || badge.hasAttribute('data-iq-loading')) {
    return;
  }

  // Preserve dimensions if they're locked (during animation)
  const lockedHeight = badge.style.height;
  const lockedWidth = badge.style.width;
  const hasLockedDimensions = lockedHeight && lockedHeight !== 'auto' && lockedWidth && lockedWidth !== 'auto';

  // Preserve or set CSS variable for original background color (for hover inversion)
  let originalBgColor = badge.style.getPropertyValue('--iq-badge-original-bg');
  if (!originalBgColor) {
    // Get current background color from CSS variable first, then computed style
    const bgColorVar = badge.style.getPropertyValue('--iq-badge-bg-color');
    if (bgColorVar) {
      originalBgColor = bgColorVar;
    } else {
      // Get current background color from computed style
      const computedStyle = window.getComputedStyle(badge);
      originalBgColor = computedStyle.backgroundColor;
    }
    if (originalBgColor && originalBgColor !== 'rgba(0, 0, 0, 0)' && originalBgColor !== 'transparent') {
      badge.style.setProperty('--iq-badge-original-bg', originalBgColor, 'important');
      // Also ensure CSS variable is set
      if (!bgColorVar) {
        badge.style.setProperty('--iq-badge-bg-color', originalBgColor);
      }
    }
  }

  // Remove inline background-color so CSS hover rules can work
  badge.style.removeProperty('background-color');

  if (badge.querySelector('.iq-badge-inner')) {

    const frontScore = badge.querySelector('.iq-badge-front .iq-score');
    const backScore = badge.querySelector('.iq-badge-back .iq-score');
    const frontIcon = badge.querySelector('.iq-badge-front .iq-icon');
    const backIcon = badge.querySelector('.iq-badge-back .iq-icon');

    if (frontScore) frontScore.textContent = iq;
    if (backScore) backScore.textContent = `${confidence}%`;
    // Ensure icons exist if they don't already
    if (!frontIcon || !backIcon) {
      // Get badge icon from settings
      const getSettings = () => window.Settings || {};
      const settings = getSettings();
      const badgeIcon = settings.badgeIcon || 'fa-info';
      const getIconHelper = () => window.BadgeIconHelper || {};
      const { getBadgeIconSVG } = getIconHelper();
      const iconSVG = getBadgeIconSVG ? getBadgeIconSVG(badgeIcon) : '';
      if (!frontIcon && badge.querySelector('.iq-badge-front')) {
        const front = badge.querySelector('.iq-badge-front');
        const iconSpan = document.createElement('span');
        iconSpan.className = 'iq-icon';
        iconSpan.innerHTML = iconSVG;
        front.insertBefore(iconSpan, front.firstChild);
      }
      if (!backIcon && badge.querySelector('.iq-badge-back')) {
        const back = badge.querySelector('.iq-badge-back');
        const iconSpan = document.createElement('span');
        iconSpan.className = 'iq-icon';
        iconSpan.innerHTML = iconSVG;
        back.insertBefore(iconSpan, back.firstChild);
      }
    }

    const inner = badge.querySelector('.iq-badge-inner');
    if (inner) {
      inner.style.transform = 'rotateY(0deg)';
      inner.style.transformStyle = 'preserve-3d';
      inner.style.margin = '0';
      inner.style.padding = '0';
    }

    const front = badge.querySelector('.iq-badge-front');
    const back = badge.querySelector('.iq-badge-back');
    if (front) {
      front.style.margin = '0';
      front.style.padding = '0';
      front.style.top = '0';
    }
  if (back) {
    back.style.margin = '0';
    back.style.padding = '0';
    back.style.top = '0';
  }
  badge.style.setProperty('color', '#000000', 'important');
  // Remove inline background-color so CSS hover rules can work
  badge.style.removeProperty('background-color');
  // Ensure CSS variable is preserved
  if (originalBgColor) {
    badge.style.setProperty('--iq-badge-original-bg', originalBgColor, 'important');
    // Also ensure CSS variable is set
    badge.style.setProperty('--iq-badge-bg-color', originalBgColor);
  }
  // Set confidence color for hover (critical for flip badges)
  if (badge.classList.contains('iq-badge-flip') && confidence !== null && confidence !== undefined) {
    const getBadgeManager = () => window.BadgeManager || {};
    const { getConfidenceColor } = getBadgeManager();
    if (getConfidenceColor) {
      const confidenceColor = getConfidenceColor(confidence);
      badge.style.setProperty('--iq-badge-confidence-color', confidenceColor, 'important');
    }
  }
  return;
  }

  const currentIcon = badge.querySelector('.iq-icon');
  const currentScore = badge.querySelector('.iq-score');
  const scoreText = currentScore ? currentScore.textContent : String(iq);

  // Preserve styles before innerHTML replacement
  const beforeMinHeight = badge.style.minHeight;
  const beforeMinWidth = badge.style.minWidth;
  const beforeDisplay = window.getComputedStyle(badge).display;

  // Ensure CSS variable for original background color is set (for hover inversion)
  if (!originalBgColor) {
    // Get current background color from CSS variable first, then computed style
    const bgColorVar = badge.style.getPropertyValue('--iq-badge-bg-color');
    if (bgColorVar) {
      originalBgColor = bgColorVar;
    } else {
      const computedStyle = window.getComputedStyle(badge);
      originalBgColor = computedStyle.backgroundColor;
    }
    if (originalBgColor && originalBgColor !== 'rgba(0, 0, 0, 0)' && originalBgColor !== 'transparent') {
      badge.style.setProperty('--iq-badge-original-bg', originalBgColor, 'important');
      // Also ensure CSS variable is set
      if (!bgColorVar) {
        badge.style.setProperty('--iq-badge-bg-color', originalBgColor);
      }
    }
  }

  // Remove inline background-color so CSS hover rules can work
  badge.style.removeProperty('background-color');

  // Get badge icon from settings
  const getSettings = () => window.Settings || {};
  const settings = getSettings();
  const badgeIcon = settings.badgeIcon || 'fa-info';
  const getIconHelper = () => window.BadgeIconHelper || {};
  const { getBadgeIconSVG } = getIconHelper();
  const iconSVG = getBadgeIconSVG ? getBadgeIconSVG(badgeIcon) : '';
  // Preserve existing icon if available, otherwise use default
  const iconToUse = currentIcon ? currentIcon.innerHTML : iconSVG;

  badge.innerHTML = `
    <div class="iq-badge-inner" style="transform: rotateY(0deg);">
      <div class="iq-badge-front">
        <span class="iq-icon">${iconToUse}</span>
        <span class="iq-score">${scoreText}</span>
      </div>
      <div class="iq-badge-back">
        <span class="iq-icon">${iconToUse}</span>
        <span class="iq-score">${confidence}%</span>
      </div>
    </div>
  `;

  badge.classList.add('iq-badge-flip');

  // Preserve min-height/min-width if they were set
  if (beforeMinHeight) {
    badge.style.setProperty('min-height', beforeMinHeight, 'important');
  }
  if (beforeMinWidth) {
    badge.style.setProperty('min-width', beforeMinWidth, 'important');
  }
  // Preserve display if it was set to block
  if (beforeDisplay === 'block') {
    badge.style.setProperty('display', 'block', 'important');
  }

  // Restore locked dimensions if they were set (during animation)
  if (hasLockedDimensions) {
    badge.style.setProperty('height', lockedHeight, 'important');
    badge.style.setProperty('width', lockedWidth, 'important');
    badge.style.setProperty('min-height', lockedHeight, 'important');
    badge.style.setProperty('min-width', lockedWidth, 'important');
    badge.style.setProperty('max-height', lockedHeight, 'important');
    badge.style.setProperty('max-width', lockedWidth, 'important');
  }

  const inner = badge.querySelector('.iq-badge-inner');
  if (inner) {
    inner.style.removeProperty('transform');
    inner.style.setProperty('transform-style', 'preserve-3d', 'important');
    inner.style.margin = '0';
    inner.style.padding = '0';
  }

  const front = badge.querySelector('.iq-badge-front');
  const back = badge.querySelector('.iq-badge-back');
  if (front) {
    front.style.margin = '0';
    front.style.padding = '0';
    front.style.top = '0';
  }
  if (back) {
    back.style.margin = '0';
    back.style.padding = '0';
    back.style.top = '0';
  }

  badge.style.setProperty('color', '#000000', 'important');
  // Ensure CSS variable for original background color is preserved (for hover inversion)
  if (originalBgColor) {
    badge.style.setProperty('--iq-badge-original-bg', originalBgColor, 'important');
  }

  // Set confidence color for hover (critical for flip badges)
  if (badge.classList.contains('iq-badge-flip') && confidence !== null && confidence !== undefined) {
    const getBadgeManager = () => window.BadgeManager || {};
    const { getConfidenceColor } = getBadgeManager();
    if (getConfidenceColor) {
      const confidenceColor = getConfidenceColor(confidence);
      badge.style.setProperty('--iq-badge-confidence-color', confidenceColor, 'important');
    }
  }

  // Add hover handlers for color inversion if not already added
  if (badge.classList.contains('iq-badge-flip')) {
    const getBadgeCreation = () => window.BadgeCreation || {};
    const { addFlipBadgeHoverHandlers } = getBadgeCreation();
    if (addFlipBadgeHoverHandlers) {
      addFlipBadgeHoverHandlers(badge);
    }
  }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.BadgeAnimations = {
    triggerPulseAnimation,
    animateCountUp,
    animateRealtimeBadgeUpdate,
    updateBadgeWithFlipStructure
  };
}

})();

