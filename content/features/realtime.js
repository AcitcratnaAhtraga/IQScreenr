/**
 * Real-time IQ Badge for Compose Boxes
 * Monitors text input areas and shows live IQ score as user types
 */

(function() {
  'use strict';

// Get dependencies from other modules
const getTextExtraction = () => window.TextExtraction || {};
const getTweetDetection = () => window.TweetDetection || {};
const getBadgeManager = () => window.BadgeManager || {};
const getSettings = () => window.Settings || {};
const getDebugLog = () => window.DOMHelpers?.debugLog || (() => {});

// Track active input areas
const realtimeBadgeManagers = new Map();

/**
 * Update real-time badge with new IQ score
 */
async function updateRealtimeBadge(inputElement, badge, container) {
  const { getInputText } = getTextExtraction();
  const { validateTweetText } = getTweetDetection();
  const { getIQColor, getConfidenceColor, animateRealtimeBadgeUpdate, updateBadgeWithFlipStructure, hexToRgb, desaturateColor } = getBadgeManager();
  const iqEstimator = window.ComprehensiveIQEstimatorUltimate ? new window.ComprehensiveIQEstimatorUltimate() : null;

  if (!iqEstimator) {
    return;
  }

  const existingHeight = badge.style.height;
  if (!existingHeight || existingHeight === 'auto') {
    badge.style.setProperty('height', 'auto', 'important');
  }
  badge.style.setProperty('flex-shrink', '0', 'important');
  badge.style.setProperty('flex-grow', '0', 'important');
  badge.style.setProperty('align-self', 'flex-start', 'important');
  badge.style.setProperty('line-height', '1', 'important');
  badge.style.setProperty('overflow', 'visible', 'important');

  const scoreElement = badge.querySelector('.iq-score');
  const labelElement = badge.querySelector('.iq-label');

  let naturalHeight = badge.getAttribute('data-natural-height');
  if (naturalHeight) {
    naturalHeight = parseFloat(naturalHeight);
  } else {
    if (scoreElement && labelElement) {
      const clone = badge.cloneNode(true);
      clone.style.position = 'absolute';
      clone.style.visibility = 'hidden';
      clone.style.height = '';
      clone.style.maxHeight = '';
      clone.style.minHeight = '';
      clone.style.width = 'auto';
      clone.style.top = '-9999px';
      clone.style.left = '-9999px';
      clone.style.flexGrow = '';
      clone.style.flexShrink = '';
      clone.style.alignSelf = '';
      clone.style.boxSizing = 'border-box';

      document.body.appendChild(clone);
      clone.offsetHeight;

      naturalHeight = Math.max(
        clone.getBoundingClientRect().height,
        clone.offsetHeight
      );
      document.body.removeChild(clone);

      if (naturalHeight > 0) {
        badge.setAttribute('data-natural-height', naturalHeight.toString());
      }
    }
  }

  if (naturalHeight && naturalHeight > 0) {
    badge.style.setProperty('height', `${naturalHeight}px`, 'important');
    badge.style.setProperty('max-height', `${naturalHeight}px`, 'important');
    badge.style.setProperty('min-height', `${naturalHeight}px`, 'important');
  } else {
    const estimatedHeight = 24;
    badge.style.setProperty('height', `${estimatedHeight}px`, 'important');
    badge.style.setProperty('max-height', `${estimatedHeight}px`, 'important');
    badge.style.setProperty('min-height', `${estimatedHeight}px`, 'important');
    badge.setAttribute('data-natural-height', estimatedHeight.toString());
  }

  if (badge.style.height && badge.style.height !== 'auto') {
    const afterRect = badge.getBoundingClientRect();
    const expectedHeight = parseFloat(badge.style.height);
    if (Math.abs(afterRect.height - expectedHeight) > 1) {
      requestAnimationFrame(() => {
        badge.style.setProperty('height', badge.style.height, 'important');
        badge.style.setProperty('max-height', badge.style.maxHeight || badge.style.height, 'important');
        badge.style.setProperty('min-height', badge.style.minHeight || badge.style.height, 'important');
      });
    }
  }

  const text = getInputText(inputElement).trim();

  // Hide badge if no text has been typed yet
  if (!text || text.length === 0) {
    badge.style.setProperty('display', 'none', 'important');
    badge.removeAttribute('data-iq-score');
    badge.removeAttribute('data-confidence');
    if (badge._animationFrameId) {
      cancelAnimationFrame(badge._animationFrameId);
      badge._animationFrameId = null;
    }
    badge.removeAttribute('data-iq-animating');
    badge.removeAttribute('data-iq-animated');
    return;
  }

  // Show badge now that user has started typing
  badge.style.setProperty('display', 'inline-flex', 'important');

  // Count words in the text
  const wordCount = text.trim() ? text.trim().split(/\s+/).filter(word => word.length > 0).length : 0;

  // Show X badge until 1 word is written
  if (wordCount < 1) {
    badge.style.setProperty('background-color', '#000000', 'important');
    badge.style.setProperty('color', '#9e9e9e', 'important');

    // Remove flip structure if it exists, show simple X
    const inner = badge.querySelector('.iq-badge-inner');
    if (inner) {
      badge.innerHTML = `
        <span class="iq-label">IQ</span>
        <span class="iq-score">✕</span>
      `;
      badge.classList.remove('iq-badge-flip');
    } else {
      let scoreElement = badge.querySelector('.iq-score');
      if (scoreElement) {
        scoreElement.textContent = '✕';
      } else {
        badge.innerHTML = `
          <span class="iq-label">IQ</span>
          <span class="iq-score">✕</span>
        `;
      }
    }

    badge.style.setProperty('padding-top', '3px', 'important');
    badge.style.setProperty('padding-bottom', '3px', 'important');
    badge.style.setProperty('margin-top', '0', 'important');
    badge.style.setProperty('margin-bottom', '0', 'important');

    badge.removeAttribute('data-iq-score');
    badge.removeAttribute('data-confidence');
    if (badge._animationFrameId) {
      cancelAnimationFrame(badge._animationFrameId);
      badge._animationFrameId = null;
    }
    badge.removeAttribute('data-iq-animating');
    badge.removeAttribute('data-iq-animated');
    return;
  }

  const validation = validateTweetText(text);
  if (!validation.isValid) {
    badge.style.setProperty('background-color', '#000000', 'important');
    badge.style.setProperty('color', '#9e9e9e', 'important');

    let scoreElement = badge.querySelector('.iq-badge-front .iq-score') ||
                       badge.querySelector('.iq-score');
    if (scoreElement) {
      scoreElement.textContent = '✕';
    }

    badge.style.setProperty('padding-top', '3px', 'important');
    badge.style.setProperty('padding-bottom', '3px', 'important');
    badge.style.setProperty('margin-top', '0', 'important');
    badge.style.setProperty('margin-bottom', '0', 'important');

    const inner = badge.querySelector('.iq-badge-inner');
    if (inner) {
      inner.style.margin = '0';
      inner.style.padding = '0';
    }
    const front = badge.querySelector('.iq-badge-front');
    if (front) {
      front.style.margin = '0';
      front.style.padding = '0';
      front.style.top = '0';
    }

    badge.removeAttribute('data-iq-score');
    if (badge._animationFrameId) {
      cancelAnimationFrame(badge._animationFrameId);
      badge._animationFrameId = null;
    }
    badge.removeAttribute('data-iq-animating');
    badge.removeAttribute('data-iq-animated');
    return;
  }

  try {
    const result = await iqEstimator.estimate(text);

    if (result.is_valid && result.iq_estimate !== null) {
      const newIQ = Math.round(result.iq_estimate);

      // Store debug data for hover (detailed analysis breakdown)
      // Always update debug data when we have a new result
      const badgeManager = getBadgeManager();
      const logDebugInfo = badgeManager?.logDebugInfo || window.BadgeCreation?.logDebugInfo;

      // Always update debug data with latest result (even if logDebugInfo isn't available yet)
      badge._debugData = {
        iq: newIQ,
        result: result,
        text: text,
        timestamp: new Date().toISOString()
      };

      // Set cursor to help to indicate hover will show debug info
      badge.style.setProperty('cursor', 'help', 'important');

      // Add hover event listener if not already added and logDebugInfo is available
      if (logDebugInfo && !badge._realtimeDebugHandlerAdded) {
        // Track last call time to prevent duplicate calls
        let lastDebugLogTime = 0;
        const DEBUG_LOG_COOLDOWN = 500; // 500ms cooldown between calls

        // Use a single handler that works for both badge and child elements
        const hoverHandler = (e) => {
          // Prevent duplicate calls within cooldown period
          const now = Date.now();
          if (now - lastDebugLogTime < DEBUG_LOG_COOLDOWN) {
            return;
          }
          lastDebugLogTime = now;

          // Find the badge element (could be the target or a parent)
          const badgeElement = e.target.closest('.iq-badge-realtime') || badge;

          // Always check for fresh debug data
          if (badgeElement._debugData || badge._debugData) {
            const debugData = badgeElement._debugData || badge._debugData;
            // logDebugInfo internally checks settings.enableDebugLogging
            // So we can call it directly like regular badges do
            try {
              // Call logDebugInfo - it will check settings internally
              logDebugInfo(debugData);
            } catch (err) {
              console.error('Error logging debug info for real-time badge:', err);
            }
          }
        };

        // Use only one mouseenter handler (capture phase to ensure it fires first)
        // This ensures it runs even if dev mode or other handlers intercept the event
        badge.addEventListener('mouseenter', hoverHandler, { capture: true, passive: true });

        badge._realtimeDebugHandlerAdded = true;
      }

      let scoreElement = badge.querySelector('.iq-badge-front .iq-score') ||
                         badge.querySelector('.iq-score');
      let oldIQ = 100; // Default to 100 as starting point
      let oldConfidence = 0; // Default to 0% as starting point (increases as confidence grows)

      const isTransitioningFromInvalid = scoreElement && scoreElement.textContent.trim() === '✕';

      if (isTransitioningFromInvalid) {
        oldIQ = 100; // Start from 100 even when transitioning from invalid
        oldConfidence = 0; // Start from 0% confidence (will increase)

        // Restore flip structure for smooth transition
        if (!badge.querySelector('.iq-badge-inner')) {
          updateBadgeWithFlipStructure(badge, 100, 0);
        } else {
          const frontScore = badge.querySelector('.iq-badge-front .iq-score');
          const backScore = badge.querySelector('.iq-badge-back .iq-score');
          if (frontScore) frontScore.textContent = '100';
          if (backScore) backScore.textContent = '0';
        }

        badge.setAttribute('data-iq-score', '100');
        badge.setAttribute('data-confidence', '0');
      } else {
        if (badge.hasAttribute('data-iq-score')) {
          const dataScore = parseInt(badge.getAttribute('data-iq-score'), 10);
          if (!isNaN(dataScore) && dataScore >= 0) {
            oldIQ = dataScore;
          }
        }

        if (oldIQ < 0 && scoreElement && scoreElement.textContent) {
          const displayedText = scoreElement.textContent.trim();
          if (displayedText !== '0' && displayedText !== '✕' && displayedText.length > 0) {
            const displayedScore = parseInt(displayedText, 10);
            if (!isNaN(displayedScore) && displayedScore >= 0) {
              oldIQ = displayedScore;
            }
          }
        }
      }

      // If we still don't have a valid oldIQ, default to 100
      if (oldIQ < 0) {
        oldIQ = 100;
      }

      const confidence = result.confidence ? Math.round(result.confidence) : null;

      // Get old confidence for smooth transition (only if not transitioning from invalid)
      if (!isTransitioningFromInvalid) {
        if (badge.hasAttribute('data-confidence')) {
          const dataConfidence = parseInt(badge.getAttribute('data-confidence'), 10);
          if (!isNaN(dataConfidence) && dataConfidence >= 0) {
            oldConfidence = dataConfidence;
          } else {
            // If confidence is invalid or not set, start at 0%
            oldConfidence = 0;
          }
        } else {
          // No confidence attribute set, start at 0%
          oldConfidence = 0;
        }
      }

      // Use confidence color if setting is enabled, otherwise use IQ color
      const settings = getSettings();
      const iqColor = (settings.useConfidenceForColor && confidence !== null)
        ? getConfidenceColor(confidence)
        : getIQColor(newIQ);

      if (confidence !== null) {
        badge.setAttribute('data-confidence', confidence);
      }

      badge.setAttribute('data-iq-score', newIQ);

      if (confidence !== null) {
        // Ensure flip structure exists before animating
        if (!badge.querySelector('.iq-badge-inner')) {
          updateBadgeWithFlipStructure(badge, oldIQ, oldConfidence);
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

      badge.style.setProperty('color', '#000000', 'important');
      // Ensure child elements also have black color
      const labelEl = badge.querySelector('.iq-label') || badge.querySelector('.iq-badge-front .iq-label');
      const scoreEl = badge.querySelector('.iq-score') || badge.querySelector('.iq-badge-front .iq-score');
      if (labelEl) {
        labelEl.style.setProperty('color', '#000000', 'important');
      }
      if (scoreEl) {
        scoreEl.style.setProperty('color', '#000000', 'important');
      }

      // Animate both IQ and confidence transitions
      animateRealtimeBadgeUpdate(badge, oldIQ, newIQ, iqColor, oldConfidence, confidence);
    } else {
      // Keep showing 100 IQ and 0% confidence when result is invalid (confidence starts at 0%)
      const { getIQColor, getConfidenceColor } = getBadgeManager();
      // Use confidence color for 0% confidence (starts low)
      const initialColor = getConfidenceColor ? getConfidenceColor(0) :
                          (getIQColor ? getIQColor(100) : '#4CAF50');
      badge.style.setProperty('background-color', initialColor, 'important');
      badge.style.setProperty('color', '#000000', 'important');

      // Ensure flip structure exists
      if (!badge.querySelector('.iq-badge-inner')) {
        const { updateBadgeWithFlipStructure } = getBadgeManager();
        if (updateBadgeWithFlipStructure) {
          updateBadgeWithFlipStructure(badge, 100, 0);
        }
      }

      const scoreElement = badge.querySelector('.iq-badge-front .iq-score') || badge.querySelector('.iq-score');
      if (scoreElement) {
        scoreElement.textContent = '100';
        scoreElement.style.setProperty('color', '#000000', 'important');
      }
      const backScore = badge.querySelector('.iq-badge-back .iq-score');
      if (backScore) {
        backScore.textContent = '0';
        backScore.style.setProperty('color', '#000000', 'important');
      }

      const labelElements = badge.querySelectorAll('.iq-label');
      labelElements.forEach(labelElement => {
        labelElement.style.setProperty('color', '#000000', 'important');
      });

      badge.setAttribute('data-iq-score', '100');
      badge.setAttribute('data-confidence', '0');
    }
  } catch (error) {
    console.error('Error updating real-time IQ badge:', error);
  }
}

/**
 * Setup real-time monitoring for an input element
 */
function setupRealtimeMonitoring(inputElement) {
  const { createRealtimeBadge } = getBadgeManager();
  const { findTextInputs } = getTweetDetection();
  const settings = getSettings();

  if (!settings.showIQBadge || !settings.showRealtimeBadge) {
    return;
  }

  if (inputElement.hasAttribute('data-iq-realtime-monitored')) {
    const existingBadges = document.querySelectorAll('.iq-badge-realtime');
    for (const badge of existingBadges) {
      const badgeInput = badge.closest('[data-testid="toolBar"]')?._iqInputElement ||
                        badge.closest('div[role="textbox"]')?.parentElement?.parentElement?._iqInputElement;
      if (badgeInput && badgeInput !== inputElement) {
        const container = inputElement.closest('[data-testid="toolBar"]') ||
                         inputElement.closest('div[role="textbox"]')?.parentElement?.parentElement;
        if (container && badge.parentElement === container) {
          container._iqInputElement = inputElement;
        }
      }
    }
    return;
  }

  inputElement.setAttribute('data-iq-realtime-monitored', 'true');

  inputElement.addEventListener('focus', () => {
    const parentModal = inputElement.closest('[role="dialog"], [data-testid*="modal"], [data-testid*="Dialog"]');
    const isInModal = !!parentModal;

    let container = inputElement.closest('[data-testid="toolBar"]') ||
                   inputElement.closest('div[role="textbox"]')?.parentElement?.parentElement ||
                   inputElement.closest('[data-testid="tweetButton"]')?.parentElement?.parentElement;

    if (isInModal && parentModal) {
      const modalToolbar = parentModal.querySelector('[data-testid="toolBar"]');
      if (modalToolbar) {
        container = modalToolbar;
      } else {
        const modalContainer = parentModal.querySelector('div[role="group"], div[style*="flex"]');
        if (modalContainer) {
          container = modalContainer;
        }
      }
    }

    if (container) {
      const allBadges = document.querySelectorAll('.iq-badge-realtime');
      allBadges.forEach(badge => {
        const badgeContainer = badge.closest('[data-testid="toolBar"]') ||
                             badge.closest('div[role="textbox"]')?.parentElement?.parentElement ||
                             badge.closest('[data-testid="tweetButton"]')?.parentElement?.parentElement;
        const badgeModal = badge.closest('[role="dialog"], [data-testid*="modal"], [data-testid*="Dialog"]');

        if (badgeContainer && badgeContainer !== container) {
          const badgeInput = badgeContainer._iqInputElement;
          const badgeInputFocused = badgeInput && (document.activeElement === badgeInput || badgeInput.contains(document.activeElement));

          if (!badgeInputFocused) {
            if (isInModal && !badgeModal) {
              badge.style.setProperty('display', 'none', 'important');
            } else if (badgeModal && badgeModal !== parentModal) {
              badge.style.setProperty('display', 'none', 'important');
            } else {
              badge.style.setProperty('display', 'none', 'important');
            }
          }
        }
      });

      const existingBadge = container.querySelector('.iq-badge-realtime');
      if (existingBadge) {
        container._iqInputElement = inputElement;
        // Don't show badge on focus - only show when user types
        // updateRealtimeBadge will handle showing it when text is present
        updateRealtimeBadge(inputElement, existingBadge, container);
      } else {
        createRealtimeBadge(inputElement, container);
      }
    } else {
      const fallbackContainer = inputElement.parentElement?.parentElement || inputElement.parentElement;
      if (fallbackContainer) {
        createRealtimeBadge(inputElement, fallbackContainer);
      }
    }
  }, { capture: true });

  const parentModalForContainer = inputElement.closest('[role="dialog"], [data-testid*="modal"], [data-testid*="Dialog"]');
  let container = null;

  const isReplyInput = inputElement.closest('div[data-testid*="cellInnerDiv"]')?.querySelector('article[data-testid="tweet"]') ||
                      inputElement.closest('[aria-label*="Replying to"]') ||
                      window.location.pathname.includes('/status/');

  if (parentModalForContainer) {
    container = parentModalForContainer.querySelector('[data-testid="toolBar"]') ||
                parentModalForContainer.querySelector('div[role="group"]');

    if (!container) {
      let parent = inputElement.parentElement;
      for (let i = 0; i < 5 && parent && parent !== parentModalForContainer; i++) {
        if (parent.contains(inputElement) && !parent.querySelector('article[data-testid="tweet"]')) {
          const hasToolbar = parent.querySelector('[data-testid="toolBar"]');
          if (hasToolbar) {
            container = parent;
            break;
          }
        }
        parent = parent.parentElement;
      }
    }
  }

  if (!container && isReplyInput) {
    let current = inputElement.parentElement;
    const originalTweetArticles = document.querySelectorAll('article[data-testid="tweet"]');

    for (let i = 0; i < 8 && current; i++) {
      const toolbar = current.querySelector('[data-testid="toolBar"]');
      if (toolbar && toolbar.contains(inputElement)) {
        let isOriginalPostContainer = false;
        for (const article of originalTweetArticles) {
          const engagementBar = article.querySelector('[role="group"]');
          if (engagementBar && current.contains(engagementBar)) {
            isOriginalPostContainer = true;
            break;
          }
        }
        if (!isOriginalPostContainer) {
          container = toolbar.parentElement || toolbar;
          break;
        }
      }
      current = current.parentElement;
    }
  }

  if (!container) {
    const toolbars = Array.from(document.querySelectorAll('[data-testid="toolBar"]'));
    for (const toolbar of toolbars) {
      if (toolbar.contains(inputElement)) {
        const article = toolbar.closest('article[data-testid="tweet"]');
        if (article) {
          const engagementBar = article.querySelector('[role="group"]');
          if (engagementBar && toolbar !== engagementBar) {
            container = toolbar;
            break;
          }
        } else {
          container = toolbar;
          break;
        }
      }
    }

    if (!container) {
      container = inputElement.closest('div[role="textbox"]')?.parentElement?.parentElement ||
                  inputElement.closest('[data-testid="tweetButton"]')?.parentElement?.parentElement ||
                  inputElement.closest('div[style*="flex"]')?.parentElement ||
                  inputElement.parentElement?.parentElement ||
                  inputElement.parentElement;
    }
  }

  let current = inputElement.parentElement;
  let bestContainer = container;
  for (let i = 0; i < 5 && current; i++) {
    const hasReplyText = Array.from(current.querySelectorAll('*')).some(el => {
      const text = el.textContent || '';
      return text.includes('can reply') || (text.includes('Everyone') && text.includes('reply'));
    });
    if (hasReplyText) {
      bestContainer = current;
      break;
    }
    current = current.parentElement;
  }

  container = bestContainer || container;

  if (!container) {
    container = inputElement.parentElement;
  }

  const badge = createRealtimeBadge(inputElement, container);

  let initialHeight = badge.getBoundingClientRect().height;
  let lastLoggedHeight = initialHeight;

  const heightObserver = new MutationObserver(() => {
    const currentHeight = badge.getBoundingClientRect().height;
    if (Math.abs(currentHeight - lastLoggedHeight) > 1) {
      if (currentHeight > initialHeight + 3 || currentHeight < initialHeight - 2) {
        const cachedNaturalHeight = badge.getAttribute('data-natural-height');
        let targetHeight;

        if (cachedNaturalHeight) {
          targetHeight = parseFloat(cachedNaturalHeight);
        } else {
          targetHeight = initialHeight;
        }

        if (Math.abs(currentHeight - targetHeight) > 2) {
          badge.style.setProperty('height', `${targetHeight}px`, 'important');
          badge.style.setProperty('max-height', `${targetHeight}px`, 'important');
          badge.style.setProperty('min-height', `${targetHeight}px`, 'important');
        }
      }

      lastLoggedHeight = badge.getBoundingClientRect().height;
    }
  });

  heightObserver.observe(badge, {
    attributes: true,
    attributeFilter: ['style', 'class'],
    childList: false,
    subtree: false
  });

  if (badge.parentElement) {
    heightObserver.observe(badge.parentElement, {
      attributes: true,
      attributeFilter: ['style', 'class'],
      childList: true,
      subtree: false
    });
  }

  const manager = {
    inputElement,
    badge,
    container,
    lastUpdateTime: 0,
    updateTimeout: null,
    lastIQ: -1,
    heightObserver
  };

  realtimeBadgeManagers.set(inputElement, manager);

  const debouncedUpdate = () => {
    if (manager.updateTimeout) {
      clearTimeout(manager.updateTimeout);
    }

    manager.updateTimeout = setTimeout(async () => {
      await updateRealtimeBadge(inputElement, badge, container);
    }, 300);
  };

  const eventTypes = ['input', 'keyup', 'paste', 'cut'];
  eventTypes.forEach(eventType => {
    inputElement.addEventListener(eventType, debouncedUpdate, { passive: true });
  });

  // Don't call updateRealtimeBadge immediately - wait for user to type
  // The badge will be shown when user starts typing via the input event handlers
}

/**
 * Monitor for new compose boxes and setup real-time IQ tracking
 */
function setupRealtimeComposeObserver() {
  const { findTextInputs } = getTweetDetection();
  const settings = getSettings();

  const observer = new MutationObserver(() => {
    if (!settings.showIQBadge || !settings.showRealtimeBadge) return;

    const inputs = findTextInputs();
    const prioritized = inputs.filter(input => {
      const isFocused = document.activeElement === input || input.contains(document.activeElement);
      let parent = input.parentElement;
      for (let i = 0; i < 10 && parent; i++) {
        const style = window.getComputedStyle(parent);
        if (parseInt(style.zIndex) > 1000 || parent.getAttribute('role') === 'dialog') {
          return true;
        }
        parent = parent.parentElement;
      }
      return isFocused;
    });
    const others = inputs.filter(input => !prioritized.includes(input));

    [...prioritized, ...others].forEach(input => {
      setupRealtimeMonitoring(input);
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  setTimeout(() => {
    const inputs = findTextInputs();
    const prioritized = inputs.filter(input => {
      const isFocused = document.activeElement === input || input.contains(document.activeElement);
      let parent = input.parentElement;
      for (let i = 0; i < 10 && parent; i++) {
        const style = window.getComputedStyle(parent);
        if (parseInt(style.zIndex) > 1000 || parent.getAttribute('role') === 'dialog') {
          return true;
        }
        parent = parent.parentElement;
      }
      return isFocused;
    });
    const others = inputs.filter(input => !prioritized.includes(input));

    [...prioritized, ...others].forEach(input => {
      setupRealtimeMonitoring(input);
    });
  }, 1000);

  document.addEventListener('focusin', (e) => {
    if (!settings.showIQBadge || !settings.showRealtimeBadge) return;
    const target = e.target;
    const isTextarea = target.tagName === 'TEXTAREA' && (
      target.getAttribute('data-testid')?.includes('tweetTextarea') ||
      target.closest('[data-testid="toolBar"]') ||
      target.closest('[data-testid*="tweetButton"]')
    );
    const isContentEditable = (target.getAttribute('role') === 'textbox' || target.tagName === 'DIV') &&
                              target.getAttribute('contenteditable') === 'true';

    if (isTextarea || isContentEditable) {
      const hasComposeIndicators = target.closest('[data-testid="toolBar"]') ||
                                  target.closest('[data-testid*="tweetButton"]') ||
                                  target.getAttribute('data-testid')?.includes('tweetTextarea') ||
                                  target.getAttribute('data-testid')?.includes('tweet');
      const isComposePage = window.location.pathname.includes('/compose/') ||
                           window.location.href.includes('/compose/post');

      if (hasComposeIndicators || isComposePage) {
        setupRealtimeMonitoring(target);
      }
    }
  }, true);

  let lastUrl = window.location.href;
  const urlCheckInterval = setInterval(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      if (currentUrl.includes('/compose/')) {
        setTimeout(() => {
          const inputs = findTextInputs();
          inputs.forEach(input => {
            setupRealtimeMonitoring(input);
          });
        }, 500);
      }
    }
  }, 1000);

  window.addEventListener('beforeunload', () => {
    clearInterval(urlCheckInterval);
  });

  return observer;
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.RealtimeManager = {
    setupRealtimeMonitoring,
    updateRealtimeBadge,
    setupRealtimeComposeObserver,
    realtimeBadgeManagers
  };
}

})();

