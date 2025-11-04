/**
 * Badge Mobile Handlers
 * Handles click/touch interactions for mobile devices
 */

(function() {
  'use strict';

  // Get dependencies
  const getHoverHandlers = () => window.BadgeCreationHandlers || {};

  /**
   * Add mobile click/touch handlers to a badge (extracted for reuse)
   */
  function addMobileBadgeHandlers(badge) {
    if (!badge) {
      console.warn('⚠️ addMobileBadgeHandlers: No badge provided');
      return;
    }

    const isGuessBadge = badge.classList.contains('iq-badge-guess') || badge.hasAttribute('data-iq-guess');
    if (isGuessBadge) {
      console.log('Skipping mobile handlers for guess badge');
      return;
    }

    // Check if handlers already added
    if (badge._mobileHandlersAdded) {
      console.log('Mobile handlers already added to badge');
      return;
    }

    const { invertBadgeColorsOnHover, restoreBadgeColorsOnLeave } = getHoverHandlers();

    // Add click/touch handlers for mobile to prevent navigation and trigger flip
    const handleBadgeInteraction = (e) => {
      // Prevent navigation to tweet URL
      e.preventDefault();
      e.stopPropagation();

      // Only handle flip animation for badges with confidence data
      if (badge.classList.contains('iq-badge-flip')) {
        const inner = badge.querySelector('.iq-badge-inner');

        if (inner) {
          // Get ALL style values - both computed and inline
          const computedBg = window.getComputedStyle(badge).backgroundColor;
          const computedColor = window.getComputedStyle(badge).color;
          const inlineBg = badge.style.backgroundColor;
          const inlineBgProperty = badge.style.getPropertyValue('background-color');
          const inlineColor = badge.style.color;
          const inlineColorProperty = badge.style.getPropertyValue('color');
          const originalBgFromVar = badge.style.getPropertyValue('--iq-badge-original-bg');

          const computedTransform = window.getComputedStyle(inner).transform;
          const inlineTransform = inner.style.transform || 'none';

          // Check if colors are inverted - check BOTH computed and inline styles
          // Inverted = black background OR text color matches original BG
          const isBgBlackComputed = computedBg === 'rgb(0, 0, 0)' || computedBg === 'rgba(0, 0, 0, 1)' ||
                                    computedBg === 'rgba(0, 0, 0, 0.99)' || computedBg === 'rgba(0, 0, 0, 0.98)';
          const isBgBlackInline = inlineBg === 'rgb(0, 0, 0)' || inlineBg === '#000000' ||
                                 inlineBgProperty === 'rgb(0, 0, 0)' || inlineBgProperty === '#000000';
          const isColorOriginal = originalBgFromVar &&
                                  (computedColor === originalBgFromVar ||
                                   inlineColor === originalBgFromVar ||
                                   inlineColorProperty === originalBgFromVar);

          // Check if transform shows flipped - PRIORITIZE computed transform (what's actually rendered)
          // Computed transform is what the browser actually displays, so it's more reliable
          const isFlippedByComputedTransform = computedTransform && computedTransform !== 'none' &&
                                        computedTransform !== 'matrix(1, 0, 0, 1, 0, 0)' &&
                                        (computedTransform.includes('180deg') ||
                                         computedTransform.includes('-1, 0, 0, 1') ||
                                         computedTransform.includes('-1,0,0,1'));

          // Only use inline transform if computed transform is identity/null (not flipped)
          // This handles cases where the computed transform hasn't updated yet during transition
          // But we should NOT trust inline transform if computed shows identity - that means it's NOT flipped
          const isFlippedByInlineTransform = false; // Don't trust inline transform - computed is authoritative

          // Badge is showing confidence if:
          // 1. Background is black (computed OR inline) - this is the most reliable indicator, OR
          // 2. Color matches original BG (text is colored with original BG), OR
          // 3. Transform is 180deg (ONLY trust computed transform, not inline)
          const isInverted = isBgBlackComputed || isBgBlackInline || isColorOriginal;
          const isFlipped = isFlippedByComputedTransform; // Only trust computed transform
          const isShowingConfidence = isInverted || isFlipped;

          // Toggle flip state
          // Use combined detection: if showing confidence (by transform OR color), flip back
          // Otherwise, flip to confidence
          if (isShowingConfidence) {
            // Flipping back to show IQ - restore original colors
            inner.style.setProperty('transform', 'rotateY(0deg)', 'important');

            // Clear any pending auto-flip timeout
            if (badge._autoFlipTimeout) {
              clearTimeout(badge._autoFlipTimeout);
              badge._autoFlipTimeout = null;
            }

            // Restore colors immediately (same logic as restoreBadgeColorsOnLeave)
            const originalBgColor = badge.style.getPropertyValue('--iq-badge-original-bg');

            if (originalBgColor) {
              // CRITICAL: Disable transition to prevent CSS from animating the color change
              badge.style.setProperty('transition', 'none', 'important');

              // Force remove any existing background-color first
              badge.style.removeProperty('background-color');
              badge.style.removeProperty('color');

              // Then set the new values with !important
              badge.style.setProperty('background-color', originalBgColor, 'important');
              badge.style.setProperty('color', '#000000', 'important');

              // Also set direct property as backup
              badge.style.backgroundColor = originalBgColor;
              badge.style.color = '#000000';

              const front = badge.querySelector('.iq-badge-front');
              const back = badge.querySelector('.iq-badge-back');

              if (front) {
                front.style.removeProperty('color');
                front.style.setProperty('color', '#000000', 'important');
                const frontLabel = front.querySelector('.iq-label');
                const frontScore = front.querySelector('.iq-score');
                if (frontLabel) {
                  frontLabel.style.removeProperty('color');
                  frontLabel.style.setProperty('color', '#000000', 'important');
                }
                if (frontScore) {
                  frontScore.style.removeProperty('color');
                  frontScore.style.setProperty('color', '#000000', 'important');
                }
              }
              if (back) {
                back.style.removeProperty('color');
                back.style.setProperty('color', '#000000', 'important');
                const backLabel = back.querySelector('.iq-label');
                const backScore = back.querySelector('.iq-score');
                if (backLabel) {
                  backLabel.style.removeProperty('color');
                  backLabel.style.setProperty('color', '#000000', 'important');
                }
                if (backScore) {
                  backScore.style.removeProperty('color');
                  backScore.style.setProperty('color', '#000000', 'important');
                }
              }

              // Force a reflow to ensure styles are applied
              void badge.offsetHeight;

              // Re-enable transition after a short delay to allow immediate color change
              setTimeout(() => {
                badge.style.removeProperty('transition');
              }, 10);

              // Check styles after change and force correction if needed
              setTimeout(() => {
                const afterBg = window.getComputedStyle(badge).backgroundColor;
                const afterColor = window.getComputedStyle(badge).color;
                const bgMatches = afterBg === originalBgColor ||
                                afterBg === originalBgColor.replace('rgb', 'rgba').replace(')', ', 1)') ||
                                badge.style.backgroundColor === originalBgColor;
                const colorMatches = afterColor === 'rgb(0, 0, 0)' ||
                                   afterColor === 'rgba(0, 0, 0, 1)' ||
                                   badge.style.color === '#000000';

                // If still not correct, force it again
                if (!bgMatches || !colorMatches) {
                  badge.style.setProperty('transition', 'none', 'important');
                  badge.style.setProperty('background-color', originalBgColor, 'important');
                  badge.style.backgroundColor = originalBgColor;
                  badge.style.setProperty('color', '#000000', 'important');
                  badge.style.color = '#000000';
                  setTimeout(() => {
                    badge.style.removeProperty('transition');
                  }, 10);
                }
              }, 200);
            }
          } else {
            // Flipping to show confidence - invert colors
            inner.style.setProperty('transform', 'rotateY(180deg)', 'important');

            // Invert colors immediately (same logic as invertBadgeColorsOnHover)
            let originalBg = badge.style.getPropertyValue('--iq-badge-original-bg');

            if (!originalBg) {
              const computedBg = window.getComputedStyle(badge).backgroundColor;
              if (computedBg && computedBg !== 'rgba(0, 0, 0, 0)' && computedBg !== 'transparent') {
                badge.style.setProperty('--iq-badge-original-bg', computedBg, 'important');
                originalBg = computedBg;
              }
            }

            const originalBgColor = originalBg || window.getComputedStyle(badge).backgroundColor;

            if (originalBgColor && originalBgColor !== 'rgba(0, 0, 0, 0)' && originalBgColor !== 'transparent') {
              // CRITICAL: Disable transition to prevent CSS from animating the color change
              badge.style.setProperty('transition', 'none', 'important');

              badge.style.backgroundColor = '#000000';
              badge.style.setProperty('background-color', '#000000', 'important');
              badge.style.setProperty('color', originalBgColor, 'important');

              const front = badge.querySelector('.iq-badge-front');
              const back = badge.querySelector('.iq-badge-back');

              if (front) {
                front.style.setProperty('color', originalBgColor, 'important');
                const frontLabel = front.querySelector('.iq-label');
                const frontScore = front.querySelector('.iq-score');
                if (frontLabel) frontLabel.style.setProperty('color', originalBgColor, 'important');
                if (frontScore) frontScore.style.setProperty('color', originalBgColor, 'important');
              }
              if (back) {
                back.style.setProperty('color', originalBgColor, 'important');
                const backLabel = back.querySelector('.iq-label');
                const backScore = back.querySelector('.iq-score');
                if (backLabel) backLabel.style.setProperty('color', originalBgColor, 'important');
                if (backScore) backScore.style.setProperty('color', originalBgColor, 'important');
              }

              // Force a reflow
              void badge.offsetHeight;

              // Re-enable transition after a short delay to allow immediate color change
              setTimeout(() => {
                badge.style.removeProperty('transition');
              }, 10);

              // Check styles after change and force correction if needed
              setTimeout(() => {
                const afterBg = window.getComputedStyle(badge).backgroundColor;
                if (afterBg !== 'rgb(0, 0, 0)' && afterBg !== 'rgba(0, 0, 0, 1)') {
                  badge.style.setProperty('transition', 'none', 'important');
                  badge.style.setProperty('background-color', '#000000', 'important');
                  badge.style.backgroundColor = '#000000';
                  setTimeout(() => {
                    badge.style.removeProperty('transition');
                  }, 10);
                }
              }, 200);
            }

            // Auto-flip back after 2 seconds on mobile and restore colors
            if (badge._autoFlipTimeout) {
              clearTimeout(badge._autoFlipTimeout);
            }
            badge._autoFlipTimeout = setTimeout(() => {
              const transformCheck = inner && inner.style.transform.includes('180deg');
              const computedTransformCheck = inner && window.getComputedStyle(inner).transform.includes('matrix') &&
                                            !window.getComputedStyle(inner).transform.includes('matrix(1, 0, 0, 1, 0, 0)');
              const isStillInverted = window.getComputedStyle(badge).backgroundColor === 'rgb(0, 0, 0)' ||
                                      window.getComputedStyle(badge).backgroundColor === 'rgba(0, 0, 0, 1)';

              if (inner && (transformCheck || computedTransformCheck || isStillInverted)) {
                inner.style.setProperty('transform', 'rotateY(0deg)', 'important');

                // Restore colors
                const originalBgColor = badge.style.getPropertyValue('--iq-badge-original-bg');

                if (originalBgColor) {
                  // CRITICAL: Disable transition to prevent CSS from animating the color change
                  badge.style.setProperty('transition', 'none', 'important');

                  // Remove properties first
                  badge.style.removeProperty('background-color');
                  badge.style.removeProperty('color');

                  badge.style.backgroundColor = originalBgColor;
                  badge.style.setProperty('background-color', originalBgColor, 'important');
                  badge.style.setProperty('color', '#000000', 'important');

                  const front = badge.querySelector('.iq-badge-front');
                  const back = badge.querySelector('.iq-badge-back');

                  if (front) {
                    front.style.removeProperty('color');
                    front.style.setProperty('color', '#000000', 'important');
                    const frontLabel = front.querySelector('.iq-label');
                    const frontScore = front.querySelector('.iq-score');
                    if (frontLabel) {
                      frontLabel.style.removeProperty('color');
                      frontLabel.style.setProperty('color', '#000000', 'important');
                    }
                    if (frontScore) {
                      frontScore.style.removeProperty('color');
                      frontScore.style.setProperty('color', '#000000', 'important');
                    }
                  }
                  if (back) {
                    back.style.removeProperty('color');
                    back.style.setProperty('color', '#000000', 'important');
                    const backLabel = back.querySelector('.iq-label');
                    const backScore = back.querySelector('.iq-score');
                    if (backLabel) {
                      backLabel.style.removeProperty('color');
                      backLabel.style.setProperty('color', '#000000', 'important');
                    }
                    if (backScore) {
                      backScore.style.removeProperty('color');
                      backScore.style.setProperty('color', '#000000', 'important');
                    }
                  }

                  // Force a reflow
                  void badge.offsetHeight;

                  // Re-enable transition after a short delay to allow immediate color change
                  setTimeout(() => {
                    badge.style.removeProperty('transition');
                  }, 10);

                  // Check styles after change and force correction if needed
                  setTimeout(() => {
                    const afterBg = window.getComputedStyle(badge).backgroundColor;
                    if (afterBg !== originalBgColor && afterBg !== 'rgb(0, 0, 0)') {
                      badge.style.setProperty('transition', 'none', 'important');
                      badge.style.setProperty('background-color', originalBgColor, 'important');
                      badge.style.backgroundColor = originalBgColor;
                      setTimeout(() => {
                        badge.style.removeProperty('transition');
                      }, 10);
                    }
                  }, 200);
                }
              }
              badge._autoFlipTimeout = null;
            }, 2000);
          }
        }
      }
    };

    badge.addEventListener('click', handleBadgeInteraction, true);

    badge.addEventListener('touchend', handleBadgeInteraction, { capture: true, passive: false });

    badge.addEventListener('touchstart', (e) => {
      // Prevent default to avoid navigation on touch
      e.preventDefault();
    }, { capture: true, passive: false });

    badge._mobileHandlersAdded = true;
  }

  // Export for use in other modules
  if (typeof window !== 'undefined') {
    window.BadgeCreationHandlers = window.BadgeCreationHandlers || {};
    window.BadgeCreationHandlers.addMobileBadgeHandlers = addMobileBadgeHandlers;
  }

})();

