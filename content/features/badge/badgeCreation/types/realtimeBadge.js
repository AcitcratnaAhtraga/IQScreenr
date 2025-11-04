/**
 * Real-time Badge Creation
 * Create or update real-time IQ badge near the input area
 */

(function() {
  'use strict';

  // Get dependencies
  const getColorUtils = () => window.BadgeColorUtils || {};
  const getTextExtraction = () => window.TextExtraction || {};
  const getContext = () => window.BadgeCreationContext || {};

  /**
   * Create or update real-time IQ badge near the input area
   */
  function createRealtimeBadge(inputElement, container) {
    const { hexToRgb, desaturateColor, getIQColor, getConfidenceColor } = getColorUtils();
    const { getInputText } = getTextExtraction();
    const { attachCreationContext } = getContext();

    if (!container._iqInputElement) {
      container._iqInputElement = inputElement;
    }

    let badge = container.querySelector('.iq-badge-realtime');

    if (!badge) {
      let searchContainer = container.parentElement;
      for (let i = 0; i < 3 && searchContainer; i++) {
        badge = searchContainer.querySelector('.iq-badge-realtime');
        if (badge) break;
        searchContainer = searchContainer.parentElement;
      }
    }

    if (!badge && inputElement) {
      const allBadges = document.querySelectorAll('.iq-badge-realtime');
      for (const existingBadge of allBadges) {
        try {
          const inputRect = inputElement.getBoundingClientRect();
          const badgeRect = existingBadge.getBoundingClientRect();
          const distance = Math.abs(badgeRect.top - inputRect.bottom) + Math.abs(badgeRect.left - inputRect.left);
          if (distance < 300) {
            badge = existingBadge;
            container = badge.parentElement || container;
            break;
          }
        } catch (e) {
          // Skip
        }
      }
    }

    if (badge) {
      const allBadges = document.querySelectorAll('.iq-badge-realtime');
      let foundFirst = false;
      for (const existingBadge of allBadges) {
        if (existingBadge === badge) {
          foundFirst = true;
        } else if (foundFirst) {
          existingBadge.remove();
        } else {
          try {
            const inputRect = inputElement.getBoundingClientRect();
            const badgeRect = existingBadge.getBoundingClientRect();
            const distance = Math.abs(badgeRect.top - inputRect.bottom) + Math.abs(badgeRect.left - inputRect.left);
            if (distance < 300) {
              existingBadge.remove();
            }
          } catch (e) {
            if (existingBadge !== badge) {
              existingBadge.remove();
            }
          }
        }
      }

      const cachedNaturalHeight = badge.getAttribute('data-natural-height');
      if (cachedNaturalHeight) {
        const heightValue = `${cachedNaturalHeight}px`;
        badge.style.setProperty('height', heightValue, 'important');
        badge.style.setProperty('max-height', heightValue, 'important');
        badge.style.setProperty('min-height', heightValue, 'important');
      } else {
        const existingHeightValue = badge.style.height;
        if (existingHeightValue && existingHeightValue !== 'auto' && existingHeightValue.endsWith('px')) {
          const heightNum = parseFloat(existingHeightValue);
          if (!isNaN(heightNum) && heightNum > 0) {
            badge.style.setProperty('height', existingHeightValue, 'important');
            badge.style.setProperty('max-height', existingHeightValue, 'important');
            badge.style.setProperty('min-height', existingHeightValue, 'important');
            badge.setAttribute('data-natural-height', heightNum.toString());
          }
        }
      }
      badge.style.setProperty('flex-shrink', '0', 'important');
      badge.style.setProperty('flex-grow', '0', 'important');
      badge.style.setProperty('align-self', 'flex-start', 'important');
      badge.style.setProperty('color', '#000000', 'important');

      // Also set color on child elements to ensure it's applied
      const labelElement = badge.querySelector('.iq-label');
      const scoreElement = badge.querySelector('.iq-score');
      if (labelElement) {
        labelElement.style.setProperty('color', '#000000', 'important');
      }
      if (scoreElement) {
        scoreElement.style.setProperty('color', '#000000', 'important');
      }

      // Hide badge if no text has been typed yet
      // Check input element text to determine if badge should be visible
      if (inputElement) {
        if (getInputText) {
          const text = getInputText(inputElement).trim();
          if (!text || text.length === 0) {
            badge.style.setProperty('display', 'none', 'important');
          }
        } else {
          // If getInputText not available, hide by default
          badge.style.setProperty('display', 'none', 'important');
        }
      } else {
        // No input element, hide badge
        badge.style.setProperty('display', 'none', 'important');
      }

      return badge;
    }

    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'iq-badge iq-badge-realtime iq-badge-flip';
      badge.setAttribute('data-iq-realtime', 'true');
      badge.setAttribute('data-iq-score', '100');
      badge.setAttribute('data-confidence', '0');

      // Use confidence color for 0% confidence (starts at 0% and increases)
      const initialColor = getConfidenceColor ? getConfidenceColor(0) :
                          (getIQColor ? getIQColor(100) : '#4CAF50');

      badge.style.setProperty('background-color', initialColor, 'important');
      badge.style.setProperty('color', '#000000', 'important');
      // Hide badge initially - only show when user starts typing
      badge.style.setProperty('display', 'none', 'important');
      badge.style.setProperty('vertical-align', 'middle', 'important');
      badge.style.setProperty('margin-right', '8px', 'important');
      badge.style.setProperty('height', 'auto', 'important');
      badge.style.setProperty('max-height', 'none', 'important');
      badge.style.setProperty('flex-shrink', '0', 'important');
      badge.style.setProperty('flex-grow', '0', 'important');
      badge.style.setProperty('align-self', 'flex-start', 'important');

      // Attach creation context
      attachCreationContext(badge, 'realtime');

      // Create flip structure with 100 IQ and 0% confidence (starts at 0% and increases)
      badge.innerHTML = `
        <div class="iq-badge-inner" style="transform: rotateY(0deg); transform-style: preserve-3d;">
          <div class="iq-badge-front">
            <span class="iq-label">IQ</span>
            <span class="iq-score">100</span>
          </div>
          <div class="iq-badge-back">
            <span class="iq-label">%</span>
            <span class="iq-score">0</span>
          </div>
        </div>
      `;

      // Ensure color is set on child elements after innerHTML
      const labelElements = badge.querySelectorAll('.iq-label');
      const scoreElements = badge.querySelectorAll('.iq-score');
      labelElements.forEach(el => {
        el.style.setProperty('color', '#000000', 'important');
      });
      scoreElements.forEach(el => {
        el.style.setProperty('color', '#000000', 'important');
      });

      setTimeout(() => {
        const scoreElement = badge.querySelector('.iq-score');
        const labelElement = badge.querySelector('.iq-label');
        if (scoreElement && labelElement && !badge.getAttribute('data-natural-height')) {
          const clone = badge.cloneNode(true);
          clone.style.position = 'absolute';
          clone.style.visibility = 'hidden';
          clone.style.height = '';
          clone.style.maxHeight = '';
          clone.style.minHeight = '';
          clone.style.top = '-9999px';
          clone.style.left = '-9999px';
          clone.style.boxSizing = 'border-box';
          document.body.appendChild(clone);

          clone.offsetHeight;

          const naturalHeight = Math.max(
            clone.getBoundingClientRect().height,
            clone.offsetHeight
          );
          document.body.removeChild(clone);

          if (naturalHeight > 0) {
            badge.setAttribute('data-natural-height', naturalHeight.toString());
            badge.style.setProperty('height', `${naturalHeight}px`, 'important');
            badge.style.setProperty('max-height', `${naturalHeight}px`, 'important');
            badge.style.setProperty('min-height', `${naturalHeight}px`, 'important');
          }
        }
      }, 100);

      const replyVisibilitySelectors = [
        '[data-testid="replyVisibilityLabel"]',
        'div[role="button"][aria-label*="can reply"]',
        '*[aria-label*="can reply"]'
      ];

      let replyVisibilityElement = null;
      for (const selector of replyVisibilitySelectors) {
        replyVisibilityElement = container.querySelector(selector);
        if (replyVisibilityElement) break;
      }

      if (!replyVisibilityElement) {
        for (const selector of replyVisibilitySelectors) {
          const candidate = document.querySelector(selector);
          if (candidate) {
            if (container.contains(candidate)) {
              replyVisibilityElement = candidate;
              break;
            }
            if (inputElement) {
              try {
                const inputRect = inputElement.getBoundingClientRect();
                const replyRect = candidate.getBoundingClientRect();
                const distance = Math.abs(replyRect.top - inputRect.bottom);
                if (distance < 200) {
                  replyVisibilityElement = candidate;
                  break;
                }
              } catch (e) {
                // Skip
              }
            }
          }
        }
      }

      if (!replyVisibilityElement) {
        const containerElements = container.querySelectorAll('*');
        for (const el of containerElements) {
          const text = el.textContent || '';
          if (text.includes('can reply') || (text.includes('Everyone') && text.includes('reply'))) {
            replyVisibilityElement = el;
            break;
          }
        }

        if (!replyVisibilityElement && container.parentElement) {
          const nearbyElements = container.parentElement.querySelectorAll('*');
          for (const el of nearbyElements) {
            const text = el.textContent || '';
            if ((text.includes('can reply') || (text.includes('Everyone') && text.includes('reply'))) &&
                el !== badge) {
              replyVisibilityElement = el;
              break;
            }
          }
        }
      }

      const toolbarSelectors = [
        '[data-testid="toolBar"]',
        'div[role="toolbar"]',
        'div[data-testid*="toolbar"]',
        'div[role="group"]'
      ];

      let toolbarElement = null;
      let firstButtonInToolbar = null;
      const inputRect = inputElement ? inputElement.getBoundingClientRect() : null;

      for (const selector of toolbarSelectors) {
        const toolbars = container.querySelectorAll(selector);
        for (const toolbar of toolbars) {
          if (inputRect) {
            try {
              const toolbarRect = toolbar.getBoundingClientRect();
              const distance = Math.abs(toolbarRect.top - inputRect.bottom);
              if (distance > 200) {
                continue;
              }

              const originalPostArticles = document.querySelectorAll('article[data-testid="tweet"]');
              let isOriginalPostToolbar = false;
              for (const article of originalPostArticles) {
                const engagementBar = article.querySelector('[role="group"]');
                if (engagementBar && toolbar.contains(engagementBar)) {
                  isOriginalPostToolbar = true;
                  break;
                }
              }
              if (isOriginalPostToolbar) {
                continue;
              }
            } catch (e) {
              continue;
            }
          }

          const buttons = toolbar.querySelectorAll('button, div[role="button"]');
          if (buttons.length > 0) {
            let hasRelevantButtons = false;
            for (const btn of buttons) {
              const label = (btn.getAttribute('aria-label') || '').toLowerCase();
              const testId = (btn.getAttribute('data-testid') || '').toLowerCase();
              if (label.includes('image') || label.includes('photo') ||
                  label.includes('gif') || label.includes('poll') ||
                  label.includes('emoji') || label.includes('location') ||
                  testId.includes('image') || testId.includes('gif') ||
                  testId.includes('poll') || testId.includes('emoji')) {
                hasRelevantButtons = true;
                if (!firstButtonInToolbar) {
                  firstButtonInToolbar = btn;
                  toolbarElement = toolbar;
                }
                break;
              }
            }

            if (hasRelevantButtons && firstButtonInToolbar) {
              break;
            }
          }

          if (buttons.length > 0 && !firstButtonInToolbar) {
            firstButtonInToolbar = buttons[0];
            toolbarElement = toolbar;
          }
        }

        if (toolbarElement && firstButtonInToolbar) {
          break;
        }
      }

      if (toolbarElement && firstButtonInToolbar && firstButtonInToolbar.parentElement) {
        firstButtonInToolbar.parentElement.insertBefore(badge, firstButtonInToolbar);
      } else if (replyVisibilityElement && replyVisibilityElement.parentElement) {
        replyVisibilityElement.parentElement.insertBefore(badge, replyVisibilityElement);
      } else if (toolbarElement) {
        const firstChild = toolbarElement.firstElementChild;
        if (firstChild) {
          toolbarElement.insertBefore(badge, firstChild);
        } else {
          toolbarElement.appendChild(badge);
        }
      } else {
        const footerSelectors = [
          'div[role="group"]',
          '.css-1dbjc4n[style*="flex"]'
        ];

        let footerElement = null;
        for (const selector of footerSelectors) {
          footerElement = container.querySelector(selector);
          if (footerElement && footerElement !== badge.parentElement) {
            const firstChild = footerElement.firstElementChild;
            if (firstChild) {
              footerElement.insertBefore(badge, firstChild);
              break;
            } else {
              footerElement.appendChild(badge);
              break;
            }
          }
        }

        if (!badge.parentElement) {
          container.appendChild(badge);
          badge.style.setProperty('position', 'relative', 'important');
          badge.style.setProperty('float', 'left', 'important');
          badge.style.setProperty('margin-bottom', '8px', 'important');
        }
      }
    }

    return badge;
  }

  // Export for use in other modules
  if (typeof window !== 'undefined') {
    window.BadgeCreationTypes = window.BadgeCreationTypes || {};
    window.BadgeCreationTypes.createRealtimeBadge = createRealtimeBadge;
  }

})();

