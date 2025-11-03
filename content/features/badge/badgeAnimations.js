/**
 * Badge Animation Utilities
 * Handles all badge animations: pulse, count-up, real-time updates
 */

(function() {
  'use strict';

// Get helper functions from other modules
const getDebugLog = () => window.DOMHelpers?.debugLog || (() => {});
const debugLog = getDebugLog();

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
      scoreElement.style.color = '#000000';
      badge.classList.remove('iq-badge-pulse');
    }
  }

  updateColor();
}

/**
 * Animate count-up from 0 to final IQ, then pulse animation
 */
function animateCountUp(badge, finalIQ, iqColor) {
  const isNotificationsPage = window.location.href.includes('/notifications');
  const { hexToRgb, desaturateColor, parseColor, interpolateRgbColor } = getColorUtils();

  // DEBUG: Log entry to animateCountUp (notifications page only)
  if (isNotificationsPage) {
    debugLog('[Badge animateCountUp DEBUG] Entry:', {
      finalIQ: finalIQ,
      hasAnimating: badge.hasAttribute('data-iq-animating'),
      hasAnimated: badge.hasAttribute('data-iq-animated'),
      className: badge.className,
      hasLoading: badge.hasAttribute('data-iq-loading'),
      inDOM: document.body.contains(badge)
    });
  }

  if (badge.hasAttribute('data-iq-animating') || badge.hasAttribute('data-iq-animated')) {
    if (isNotificationsPage) {
      debugLog('[Badge animateCountUp DEBUG] Already animating/animated - returning');
    }
    return;
  }

  const darkerRed = '#b71c1c';
  const rgb = hexToRgb(darkerRed);
  const desat = desaturateColor(rgb, 0.5);
  const loadingColor = `rgb(${desat.r}, ${desat.g}, ${desat.b})`;

  const finalColorRgb = parseColor(iqColor);

  function startAnimation() {
    if (badge.hasAttribute('data-iq-animating') || badge.hasAttribute('data-iq-animated')) {
      if (isNotificationsPage) {
        debugLog('[Badge startAnimation DEBUG] Already animating/animated - returning');
      }
      return;
    }

    // DEBUG: Log before setting animating attribute (notifications page only)
    if (isNotificationsPage) {
      debugLog('[Badge startAnimation DEBUG] Setting data-iq-animating');
    }

    badge.setAttribute('data-iq-animating', 'true');

    const scoreContainer = badge.querySelector('.iq-score');

    if (!scoreContainer) {
      // Preserve styles before innerHTML replacement
      const beforeMinHeight = badge.style.minHeight;
      const beforeMinWidth = badge.style.minWidth;
      const beforeDisplay = window.getComputedStyle(badge).display;

      badge.innerHTML = `
        <span class="iq-label">IQ</span>
        <span class="iq-score">${finalIQ}</span>
      `;
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

    if (hasFlipStructure) {
      scoreElement = badge.querySelector('.iq-badge-front .iq-score');
      if (!scoreElement) {
        const frontDiv = badge.querySelector('.iq-badge-front');
        if (frontDiv) {
          const label = frontDiv.querySelector('.iq-label') || document.createElement('span');
          if (!label.classList.contains('iq-label')) {
            label.className = 'iq-label';
            label.textContent = 'IQ';
          }
          const score = document.createElement('span');
          score.className = 'iq-score';
          score.textContent = '0';
          frontDiv.innerHTML = '';
          frontDiv.appendChild(label);
          frontDiv.appendChild(score);
          scoreElement = score;
        }
      } else {
        scoreElement.textContent = '0';
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

        badge.innerHTML = `
          <span class="iq-label">IQ</span>
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

    // DEBUG: Log before removing loading class (notifications page only)
    if (isNotificationsPage) {
      debugLog('[Badge startAnimation DEBUG] About to remove loading class:', {
        hasLoadingClass: badge.classList.contains('iq-badge-loading'),
        currentClass: badge.className,
        inDOM: document.body.contains(badge)
      });
    }

    badge.classList.remove('iq-badge-loading');

    // DEBUG: Log after removing loading class (notifications page only)
    if (isNotificationsPage) {
      debugLog('[Badge startAnimation DEBUG] Removed loading class:', {
        hasLoadingClass: badge.classList.contains('iq-badge-loading'),
        currentClass: badge.className
      });
    }

    const spinner = badge.querySelector('.iq-loading-spinner');
    if (spinner) {
      if (isNotificationsPage) {
        debugLog('[Badge startAnimation DEBUG] Found spinner, removing it');
      }
      spinner.remove();
    } else {
      if (isNotificationsPage) {
        debugLog('[Badge startAnimation DEBUG] No spinner found');
      }
    }

    // DEBUG: Log after spinner removal (notifications page only)
    if (isNotificationsPage) {
      debugLog('[Badge startAnimation DEBUG] After spinner removal:', {
        badgeHTML: badge.innerHTML.substring(0, 150),
        hasScoreElement: !!scoreElement,
        scoreElementText: scoreElement ? scoreElement.textContent : 'N/A'
      });
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
        scoreElement.innerHTML = '<span class="iq-loading-spinner">↻</span>';
      }

      if (!isFrozen && isShowingSpinner) {
        isShowingSpinner = false;
        const resumeIQ = Math.min(frozenAtIQ + 1, finalIQ);
        lastDisplayedIQ = resumeIQ;
        frozenAtIQ = -1;
        scoreElement.textContent = resumeIQ;
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
        if (willUpdate) {
          scoreElement.textContent = currentIQ;
          lastDisplayedIQ = currentIQ;
          lastUpdateTime = now;
          freezeDetectionTime = now;
        }

        const currentColor = interpolateRgbColor(
          parseColor(loadingColor),
          finalColorRgb,
          easedProgress
        );
        badge.style.setProperty('background-color', currentColor, 'important');
      } else if (isShowingSpinner) {
        const currentColor = interpolateRgbColor(
          parseColor(loadingColor),
          finalColorRgb,
          easedProgress
        );
        badge.style.setProperty('background-color', currentColor, 'important');
      }

      const hasReachedFinal = lastDisplayedIQ >= finalIQ;

      if (!hasReachedFinal) {
        animationFrameId = requestAnimationFrame(updateNumber);
      } else {
        if (isShowingSpinner) {
          isShowingSpinner = false;
          const spinner = scoreElement.querySelector('.iq-loading-spinner');
          if (spinner) {
            spinner.remove();
          }
        }

        scoreElement.textContent = finalIQ;
        badge.style.setProperty('background-color', iqColor, 'important');

        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }

        // DEBUG: Log before finishing animation (notifications page only)
        if (isNotificationsPage) {
          debugLog('[Badge updateNumber DEBUG] Animation complete, finalizing:', {
            finalIQ: finalIQ,
            scoreElementText: scoreElement.textContent,
            inDOM: document.body.contains(badge)
          });
        }

        badge.removeAttribute('data-iq-animating');
        badge.setAttribute('data-iq-animated', 'true');

        // DEBUG: Log after setting attributes (notifications page only)
        if (isNotificationsPage) {
          debugLog('[Badge updateNumber DEBUG] Set data-iq-animated, checking confidence');
        }

        const confidenceAttr = badge.getAttribute('data-confidence');
        if (confidenceAttr !== null) {
          const confidence = parseInt(confidenceAttr, 10);
          if (isNotificationsPage) {
            debugLog('[Badge updateNumber DEBUG] Calling updateBadgeWithFlipStructure:', {
              finalIQ: finalIQ,
              confidence: confidence
            });
          }
          // Call updateBadgeWithFlipStructure directly (we are in the same module)
          updateBadgeWithFlipStructure(badge, finalIQ, confidence);

          if (isNotificationsPage) {
            debugLog('[Badge updateNumber DEBUG] After updateBadgeWithFlipStructure:', {
              badgeHTML: badge.innerHTML.substring(0, 150),
              inDOM: document.body.contains(badge)
            });
          }
        } else {
          if (isNotificationsPage) {
            debugLog('[Badge updateNumber DEBUG] No confidence attribute, skipping flip structure');
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

  const rect = badge.getBoundingClientRect();
  const isVisible = rect.top < window.innerHeight + 50 && rect.bottom > -50;
  if (isVisible) {
    observer.disconnect();
    startAnimation();
  }
}

/**
 * Animate real-time badge update (count-up from current to new IQ)
 */
function animateRealtimeBadgeUpdate(badge, oldIQ, newIQ, iqColor) {
  if (badge._animationFrameId) {
    cancelAnimationFrame(badge._animationFrameId);
    badge._animationFrameId = null;
  }

  const { hexToRgb, desaturateColor, parseColor, interpolateRgbColor } = getColorUtils();
  const getBadgeManager = () => window.BadgeManager || {};

  badge.removeAttribute('data-iq-animating');
  badge.removeAttribute('data-iq-animated');

  const darkerRed = '#b71c1c';
  const rgb = hexToRgb(darkerRed);
  const desat = desaturateColor(rgb, 0.5);
  const loadingColor = `rgb(${desat.r}, ${desat.g}, ${desat.b})`;

  let scoreElement = badge.querySelector('.iq-badge-front .iq-score') ||
                     badge.querySelector('.iq-score');
  if (!scoreElement) {
    debugLog('[Real-time Badge Animation] ERROR: Could not find score element!', {
      hasFlip: badge.classList.contains('iq-badge-flip'),
      hasInner: !!badge.querySelector('.iq-badge-inner'),
      badgeHTML: badge.innerHTML.substring(0, 200)
    });
    return;
  }

  const startIQ = oldIQ >= 0 ? oldIQ : 0;
  scoreElement.textContent = String(startIQ);

  let startColorRgb;
  if (oldIQ < 0) {
    startColorRgb = parseColor(loadingColor);
    badge.style.setProperty('background-color', loadingColor, 'important');
  } else {
    const currentBgColor = badge.style.backgroundColor || loadingColor;
    startColorRgb = parseColor(currentBgColor);
  }

  const finalColorRgb = parseColor(iqColor);

  let currentIQ = startIQ;
  badge.setAttribute('data-iq-animating', 'true');

  const duration = 800;
  const startTime = performance.now();
  let lastDisplayedIQ = startIQ;

  function updateNumber() {
    const now = performance.now();
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);

    const easedProgress = 1 - Math.pow(1 - progress, 3);
    const iqDiff = newIQ - startIQ;
    const targetIQ = startIQ + Math.floor(easedProgress * iqDiff);
    const maxIncrement = Math.max(1, Math.ceil(Math.abs(iqDiff) / 30));

    if (progress >= 1) {
      currentIQ = newIQ;
    } else {
      const difference = targetIQ - currentIQ;
      if (Math.abs(difference) > maxIncrement) {
        currentIQ += difference > 0 ? maxIncrement : -maxIncrement;
      } else {
        currentIQ = targetIQ;
      }
    }

    if ((iqDiff > 0 && currentIQ > newIQ) || (iqDiff < 0 && currentIQ < newIQ)) {
      currentIQ = newIQ;
    }

    const currentColor = interpolateRgbColor(
      startColorRgb,
      finalColorRgb,
      easedProgress
    );
    badge.style.setProperty('background-color', currentColor, 'important');

    let currentScoreElement = badge.querySelector('.iq-badge-front .iq-score') ||
                               badge.querySelector('.iq-score');

    if (currentIQ !== lastDisplayedIQ) {
      if (currentScoreElement) {
        currentScoreElement.textContent = Math.max(0, Math.round(currentIQ));
        lastDisplayedIQ = currentIQ;
        scoreElement = currentScoreElement;
      } else {
        debugLog('[Real-time Badge Animation] WARNING: Score element lost during animation!');
        scoreElement = badge.querySelector('.iq-badge-front .iq-score') ||
                       badge.querySelector('.iq-score');
        if (scoreElement) {
          scoreElement.textContent = Math.max(0, Math.round(currentIQ));
          lastDisplayedIQ = currentIQ;
        }
      }
    }

    if (progress < 1 || lastDisplayedIQ !== newIQ) {
      badge._animationFrameId = requestAnimationFrame(updateNumber);
    } else {
      const finalScoreElement = badge.querySelector('.iq-badge-front .iq-score') ||
                                badge.querySelector('.iq-score');
      if (finalScoreElement) {
        finalScoreElement.textContent = newIQ;
      } else {
        debugLog('[Real-time Badge Animation] ERROR: Could not find score element for final update!');
        const fallbackScore = badge.querySelector('.iq-score');
        if (fallbackScore) {
          fallbackScore.textContent = newIQ;
        }
      }

      badge.style.setProperty('background-color', iqColor, 'important');
      badge.removeAttribute('data-iq-animating');
      badge.setAttribute('data-iq-animated', 'true');
      badge._animationFrameId = null;

      setTimeout(() => {
        triggerPulseAnimation(badge, iqColor);
      }, 100);
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
  const isNotificationsPage = window.location.href.includes('/notifications');
  const getDebugLog = () => window.DOMHelpers?.debugLog || (() => {});
  const debugLog = getDebugLog();

  // DEBUG: Log entry (notifications page only)
  if (isNotificationsPage) {
    debugLog('[updateBadgeWithFlipStructure DEBUG] Entry:', {
      iq: iq,
      confidence: confidence,
      hasLoadingClass: badge.classList.contains('iq-badge-loading'),
      hasDataIqLoading: badge.hasAttribute('data-iq-loading'),
      hasInner: !!badge.querySelector('.iq-badge-inner'),
      inDOM: document.body.contains(badge)
    });
  }

  if (badge.classList.contains('iq-badge-loading') || badge.hasAttribute('data-iq-loading')) {
    if (isNotificationsPage) {
      debugLog('[updateBadgeWithFlipStructure DEBUG] Still loading - returning');
    }
    return;
  }

  if (badge.querySelector('.iq-badge-inner')) {
    // DEBUG: Log if inner already exists (notifications page only)
    if (isNotificationsPage) {
      debugLog('[updateBadgeWithFlipStructure DEBUG] Inner structure exists, updating elements');
    }

    const frontScore = badge.querySelector('.iq-badge-front .iq-score');
    const backLabel = badge.querySelector('.iq-badge-back .iq-label');
    const backScore = badge.querySelector('.iq-badge-back .iq-score');

    if (frontScore) frontScore.textContent = iq;
    if (backLabel) backLabel.textContent = '%';
    if (backScore) backScore.textContent = confidence;

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
    return;
  }

  const currentLabel = badge.querySelector('.iq-label');
  const currentScore = badge.querySelector('.iq-score');
  const labelText = currentLabel ? currentLabel.textContent : 'IQ';
  const scoreText = currentScore ? currentScore.textContent : String(iq);

  // DEBUG: Log before creating inner structure (notifications page only)
  if (isNotificationsPage) {
    debugLog('[updateBadgeWithFlipStructure DEBUG] Creating new inner structure:', {
      labelText: labelText,
      scoreText: scoreText,
      confidence: confidence,
      currentHTML: badge.innerHTML.substring(0, 100)
    });
  }

  // Preserve styles before innerHTML replacement
  const beforeMinHeight = badge.style.minHeight;
  const beforeMinWidth = badge.style.minWidth;
  const beforeDisplay = window.getComputedStyle(badge).display;

  badge.innerHTML = `
    <div class="iq-badge-inner" style="transform: rotateY(0deg);">
      <div class="iq-badge-front">
        <span class="iq-label">${labelText}</span>
        <span class="iq-score">${scoreText}</span>
      </div>
      <div class="iq-badge-back">
        <span class="iq-label">%</span>
        <span class="iq-score">${confidence}</span>
      </div>
    </div>
  `;

  // DEBUG: Log after innerHTML replacement (notifications page only)
  if (isNotificationsPage) {
    debugLog('[updateBadgeWithFlipStructure DEBUG] After innerHTML replacement:', {
      newHTML: badge.innerHTML.substring(0, 150),
      inDOM: document.body.contains(badge)
    });
  }

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

