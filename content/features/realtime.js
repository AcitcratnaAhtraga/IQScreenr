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

  if (!text || text.length < 10) {
    const darkerRed = '#b71c1c';
    const rgb = hexToRgb(darkerRed);
    const desat = desaturateColor(rgb, 0.5);
    const loadingColor = `rgb(${desat.r}, ${desat.g}, ${desat.b})`;
    badge.style.setProperty('background-color', loadingColor, 'important');
    const scoreElement = badge.querySelector('.iq-score');
    if (scoreElement) {
      scoreElement.textContent = '0';
    }
    badge.removeAttribute('data-iq-score');
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

      let scoreElement = badge.querySelector('.iq-badge-front .iq-score') ||
                         badge.querySelector('.iq-score');
      let oldIQ = -1;

      const isTransitioningFromInvalid = scoreElement && scoreElement.textContent.trim() === '✕';

      if (isTransitioningFromInvalid) {
        oldIQ = -1;
        scoreElement.textContent = '0';
        badge.removeAttribute('data-iq-score');
      } else {
        if (badge.hasAttribute('data-iq-score')) {
          const dataScore = parseInt(badge.getAttribute('data-iq-score'), 10);
          if (!isNaN(dataScore) && dataScore > 0) {
            oldIQ = dataScore;
          }
        }

        if (oldIQ < 0 && scoreElement && scoreElement.textContent) {
          const displayedText = scoreElement.textContent.trim();
          if (displayedText !== '0' && displayedText !== '✕' && displayedText.length > 0) {
            const displayedScore = parseInt(displayedText, 10);
            if (!isNaN(displayedScore) && displayedScore > 0) {
              oldIQ = displayedScore;
            }
          }
        }
      }

      if (oldIQ <= 0) {
        oldIQ = -1;
      }

      const confidence = result.confidence ? Math.round(result.confidence) : null;
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
        updateBadgeWithFlipStructure(badge, newIQ, confidence);

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

      animateRealtimeBadgeUpdate(badge, oldIQ, newIQ, iqColor);
    } else {
      const darkerRed = '#b71c1c';
      const rgb = hexToRgb(darkerRed);
      const desat = desaturateColor(rgb, 0.5);
      const loadingColor = `rgb(${desat.r}, ${desat.g}, ${desat.b})`;
      badge.style.setProperty('background-color', loadingColor, 'important');
      const scoreElement = badge.querySelector('.iq-score');
      if (scoreElement) {
        scoreElement.textContent = '0';
      }
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
        existingBadge.style.removeProperty('display');
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

  setTimeout(() => {
    updateRealtimeBadge(inputElement, badge, container);
  }, 500);
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

