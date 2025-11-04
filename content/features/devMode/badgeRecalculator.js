/**
 * Badge Recalculator for Dev Mode
 * Recalculates IQ scores for badges when clicked in dev mode
 */

(function() {
  'use strict';

  /**
   * Recalculate IQ for a badge
   */
  async function recalculateBadge(badge) {
    if (!badge) return;

    // Check if badge has an IQ score (already calculated)
    const hasIQScore = badge.hasAttribute('data-iq-score');
    const isRealtime = badge.classList.contains('iq-badge-realtime') || badge.hasAttribute('data-iq-realtime');

    if (!hasIQScore && !isRealtime) {
      console.log('%c⚠️ Badge does not have an IQ score to recalculate', 'color: #ff9800; font-weight: bold;');
      return;
    }

    console.log('%c🔄 Recalculating badge IQ...', 'color: #2196f3; font-weight: bold;');

    // Get dependencies
    const getTextExtraction = () => window.TextExtraction || {};
    const getBadgeManager = () => window.BadgeManager || {};
    const getSettings = () => window.Settings || {};

    const { extractTweetText, getInputText } = getTextExtraction();
    const badgeManager = getBadgeManager();
    const settings = getSettings();

    if (!badgeManager || !badgeManager.createIQBadge) {
      console.error('BadgeManager not available');
      return;
    }

    const iqEstimator = window.ComprehensiveIQEstimatorUltimate ? new window.ComprehensiveIQEstimatorUltimate() : null;
    if (!iqEstimator) {
      console.error('IQ Estimator not available');
      return;
    }

    let tweetText = null;

    // For real-time badges, get text from input element
    if (isRealtime) {
      // Find the associated input element
      const container = badge.closest('[data-testid="toolBar"]') || badge.parentElement;
      const inputElement = container?._iqInputElement ||
                          container?.querySelector('[contenteditable="true"]') ||
                          container?.querySelector('[role="textbox"]');

      if (inputElement && getInputText) {
        tweetText = getInputText(inputElement).trim();
      }
    } else {
      // For regular badges, find the tweet element and extract text
      const tweetElement = badge.closest('article[data-testid="tweet"]') ||
                          badge.closest('article[role="article"]') ||
                          badge.closest('article');

      if (tweetElement && extractTweetText) {
        tweetText = extractTweetText(tweetElement);
      }
    }

    if (!tweetText || tweetText.trim().length === 0) {
      console.log('%c⚠️ Could not extract text for recalculation', 'color: #ff9800; font-weight: bold;');
      return;
    }

    // Show loading state
    const oldIQ = badge.getAttribute('data-iq-score');
    badge.classList.add('iq-badge-calculating');
    badge.setAttribute('data-iq-recalculating', 'true');

    try {
      // Recalculate IQ
      const result = await iqEstimator.estimate(tweetText);

      if (result.is_valid && result.iq_estimate !== null) {
        const newIQ = Math.round(result.iq_estimate);
        const confidence = result.confidence ? Math.round(result.confidence) : null;

        // Update badge with new result
        const { getIQColor, getConfidenceColor, animateCountUp, updateBadgeWithFlipStructure } = badgeManager;

        // Update debug data
        badge._debugData = {
          iq: newIQ,
          result: result,
          text: tweetText,
          timestamp: new Date().toISOString()
        };

        // Get color
        const iqColor = (settings.useConfidenceForColor && confidence !== null)
          ? getConfidenceColor(confidence)
          : getIQColor(newIQ);

        // Update attributes
        badge.setAttribute('data-iq-score', newIQ);
        if (confidence !== null) {
          badge.setAttribute('data-confidence', confidence);
        } else {
          badge.removeAttribute('data-confidence');
        }

        // Reset animation state to allow re-animation
        badge.removeAttribute('data-iq-animating');
        badge.removeAttribute('data-iq-animated');

        // Cancel any existing animation frame
        if (badge._animationFrameId) {
          cancelAnimationFrame(badge._animationFrameId);
          badge._animationFrameId = null;
        }

        // Prepare badge for count-up animation from 0
        // Set initial score to 0 before animation
        if (confidence !== null) {
          // Ensure flip structure exists
          if (!badge.querySelector('.iq-badge-inner')) {
            if (updateBadgeWithFlipStructure) {
              updateBadgeWithFlipStructure(badge, 0, confidence);
            } else {
              badge.innerHTML = `
                <div class="iq-badge-inner">
                  <div class="iq-badge-front">
                    <span class="iq-label">IQ</span>
                    <span class="iq-score">0</span>
                  </div>
                  <div class="iq-badge-back">
                    <span class="iq-label">%</span>
                    <span class="iq-score">${confidence}</span>
                  </div>
                </div>
              `;
            }
          } else {
            // Reset existing flip structure to 0
            const frontScore = badge.querySelector('.iq-badge-front .iq-score');
            const backScore = badge.querySelector('.iq-badge-back .iq-score');
            if (frontScore) frontScore.textContent = '0';
            if (backScore) backScore.textContent = confidence;
          }
          badge.classList.add('iq-badge-flip');
        } else {
          // Simple badge without confidence - reset to 0
          badge.innerHTML = `
            <span class="iq-label">IQ</span>
            <span class="iq-score">0</span>
          `;
          badge.classList.remove('iq-badge-flip');
        }

        // Set initial color (loading color) - animateCountUp will transition to final color
        const { hexToRgb, desaturateColor } = badgeManager;
        if (hexToRgb && desaturateColor) {
          const darkerRed = '#b71c1c';
          const rgb = hexToRgb(darkerRed);
          const desat = desaturateColor(rgb, 0.5);
          const loadingColor = `rgb(${desat.r}, ${desat.g}, ${desat.b})`;
          badge.style.setProperty('background-color', loadingColor, 'important');
        } else {
          badge.style.setProperty('background-color', iqColor, 'important');
        }

        // Trigger count-up animation from 0 to newIQ
        if (animateCountUp) {
          animateCountUp(badge, newIQ, iqColor);
        } else {
          // Fallback if animation not available - just set the final value
          const scoreElement = badge.querySelector('.iq-score') || badge.querySelector('.iq-badge-front .iq-score');
          if (scoreElement) {
            scoreElement.textContent = newIQ;
          }
          badge.style.setProperty('background-color', iqColor, 'important');
        }

        console.log(`%c✅ Recalculation complete: ${oldIQ} → ${newIQ}`, 'color: #4caf50; font-weight: bold;');
        if (confidence !== null) {
          console.log(`%c   Confidence: ${confidence}%`, 'color: #4caf50;');
        }
      } else {
        console.log('%c⚠️ Recalculation returned invalid result', 'color: #ff9800; font-weight: bold;', result);
      }
    } catch (error) {
      console.error('Error recalculating badge:', error);
    } finally {
      badge.classList.remove('iq-badge-calculating');
      badge.removeAttribute('data-iq-recalculating');
    }
  }

  // Export for use in other modules
  if (typeof window !== 'undefined') {
    window.DevModeBadgeRecalculator = {
      recalculateBadge
    };
  }

})();

