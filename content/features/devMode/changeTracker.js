/**
 * Change Tracker for Dev Mode
 * Tracks and logs all changes to a badge element
 */

(function() {
  'use strict';

  const DevModeBadgeDetection = window.DevModeBadgeDetection || {};

  let trackedBadge = null;
  let mutationObserver = null;
  let trackedBadgeOriginalStyle = null;
  let trackedBadgeOriginalSetProperty = null;
  let trackedBadgeOriginalClassListAdd = null;
  let trackedBadgeOriginalClassListRemove = null;
  let trackedBadgeOriginalClassListToggle = null;
  let changeCount = 0;

  /**
   * Log a change to the tracked badge
   */
  function logChange(type, details, oldValue = null, newValue = null) {
    if (!trackedBadge) return;

    changeCount++;
    const timestamp = new Date().toISOString();

    console.group(`%c🔴 CHANGE #${changeCount} - ${type}`, 'color: #f44336; font-weight: bold; font-size: 12px;');
    console.log(`%cTime:`, 'color: #9e9e9e;', new Date(timestamp).toLocaleTimeString());

    if (oldValue !== null && newValue !== null) {
      console.log(`%cOld Value:`, 'color: #ff9800;', oldValue);
      console.log(`%cNew Value:`, 'color: #4caf50;', newValue);
    }

    if (details) {
      console.log(`%cDetails:`, 'color: #2196f3;', details);
    }

    console.log(`%cBadge Element:`, 'color: #9e9e9e;', trackedBadge);
    console.groupEnd();
  }

  /**
   * Create a proxy to intercept style changes
   */
  function createStyleProxy(badge) {
    const originalSetProperty = badge.style.setProperty.bind(badge.style);

    return new Proxy(badge.style, {
      set(target, prop, value) {
        const oldValue = target[prop];
        const result = Reflect.set(target, prop, value);

        if (trackedBadge === badge && oldValue !== value) {
          logChange('Style Property Changed', { property: prop, value: value }, oldValue, value);
        }

        return result;
      },
      get(target, prop) {
        if (prop === 'setProperty') {
          return function(property, value, priority) {
            const oldValue = target.getPropertyValue(property);
            const result = originalSetProperty(property, value, priority);

            if (trackedBadge === badge && oldValue !== value) {
              logChange('Style.setProperty()', { property, value, priority }, oldValue, value);
            }

            return result;
          };
        }
        return Reflect.get(target, prop);
      }
    });
  }

  /**
   * Start tracking a badge
   */
  function startTracking(badge) {
    if (trackedBadge === badge) {
      // Already tracking this badge, stop tracking
      stopTracking();
      return;
    }

    // Stop tracking previous badge if any
    if (trackedBadge) {
      stopTracking();
    }

    trackedBadge = badge;
    changeCount = 0;

    // Create style proxy to intercept style changes (but don't replace the style object)
    // We'll hook into setProperty instead to avoid changing appearance
    trackedBadgeOriginalStyle = badge.style;
    createStyleProxy(badge);

    // Intercept setProperty calls to track style changes (but don't replace the style object)
    // Save the original function before replacing it
    trackedBadgeOriginalSetProperty = badge.style.setProperty.bind(badge.style);
    const trackedBadgeRef = badge; // Store reference to the badge being tracked

    badge.style.setProperty = function(property, value, priority) {
      // Check if badge is still valid and being tracked
      if (!trackedBadgeRef || !trackedBadgeRef.parentElement || trackedBadge !== trackedBadgeRef) {
        // Badge was removed or tracking stopped, restore original and call it
        if (trackedBadgeOriginalSetProperty) {
          trackedBadgeRef.style.setProperty = trackedBadgeOriginalSetProperty;
          return trackedBadgeOriginalSetProperty.call(trackedBadgeRef.style, property, value, priority);
        }
        // Fallback: use native setProperty if available
        return CSSStyleDeclaration.prototype.setProperty.call(this, property, value, priority);
      }

      const oldValue = trackedBadgeRef.style.getPropertyValue(property);
      const result = trackedBadgeOriginalSetProperty.call(trackedBadgeRef.style, property, value, priority);

      // Track style changes (but ignore border changes we make for tracking indicator)
      if (oldValue !== value && property !== 'border') {
        logChange('Style.setProperty()', { property, value, priority }, oldValue, value);
      }

      return result;
    };

    // Set up MutationObserver to track DOM changes
    mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes') {
          const attrName = mutation.attributeName;
          const oldValue = mutation.oldValue;
          const newValue = badge.getAttribute(attrName);

          if (oldValue !== newValue) {
            logChange('Attribute Changed', { attribute: attrName }, oldValue, newValue);
          }
        } else if (mutation.type === 'childList') {
          if (mutation.addedNodes.length > 0) {
            logChange('Child Added', {
              nodes: Array.from(mutation.addedNodes).map(n => n.nodeName + (n.textContent ? `: "${n.textContent.substring(0, 50)}"` : ''))
            });
          }
          if (mutation.removedNodes.length > 0) {
            logChange('Child Removed', {
              nodes: Array.from(mutation.removedNodes).map(n => n.nodeName + (n.textContent ? `: "${n.textContent.substring(0, 50)}"` : ''))
            });
          }
        } else if (mutation.type === 'characterData') {
          logChange('Text Content Changed', {
            oldText: mutation.oldValue?.substring(0, 100),
            newText: badge.textContent?.substring(0, 100)
          }, mutation.oldValue, badge.textContent);
        }
      });
    });

    // Observe all changes
    mutationObserver.observe(badge, {
      attributes: true,
      attributeOldValue: true,
      childList: true,
      subtree: true,
      characterData: true,
      characterDataOldValue: true
    });

    // Track classList changes
    trackedBadgeOriginalClassListAdd = badge.classList.add.bind(badge.classList);
    trackedBadgeOriginalClassListRemove = badge.classList.remove.bind(badge.classList);
    trackedBadgeOriginalClassListToggle = badge.classList.toggle.bind(badge.classList);

    badge.classList.add = function(...tokens) {
      if (!trackedBadgeRef || !trackedBadgeRef.parentElement || trackedBadge !== trackedBadgeRef) {
        // Badge was removed or tracking stopped, restore original and call it
        if (trackedBadgeOriginalClassListAdd) {
          trackedBadgeRef.classList.add = trackedBadgeOriginalClassListAdd;
          return trackedBadgeOriginalClassListAdd.apply(trackedBadgeRef.classList, tokens);
        }
        return DOMTokenList.prototype.add.apply(this, tokens);
      }

      const oldClasses = trackedBadgeRef.className;
      const result = trackedBadgeOriginalClassListAdd.apply(trackedBadgeRef.classList, tokens);
      const newClasses = trackedBadgeRef.className;
      if (oldClasses !== newClasses) {
        logChange('Class Added', { classes: tokens.join(', ') }, oldClasses, newClasses);
      }
      return result;
    };

    badge.classList.remove = function(...tokens) {
      if (!trackedBadgeRef || !trackedBadgeRef.parentElement || trackedBadge !== trackedBadgeRef) {
        // Badge was removed or tracking stopped, restore original and call it
        if (trackedBadgeOriginalClassListRemove) {
          trackedBadgeRef.classList.remove = trackedBadgeOriginalClassListRemove;
          return trackedBadgeOriginalClassListRemove.apply(trackedBadgeRef.classList, tokens);
        }
        return DOMTokenList.prototype.remove.apply(this, tokens);
      }

      const oldClasses = trackedBadgeRef.className;
      const result = trackedBadgeOriginalClassListRemove.apply(trackedBadgeRef.classList, tokens);
      const newClasses = trackedBadgeRef.className;
      if (oldClasses !== newClasses) {
        logChange('Class Removed', { classes: tokens.join(', ') }, oldClasses, newClasses);
      }
      return result;
    };

    badge.classList.toggle = function(token, force) {
      if (!trackedBadgeRef || !trackedBadgeRef.parentElement || trackedBadge !== trackedBadgeRef) {
        // Badge was removed or tracking stopped, restore original and call it
        if (trackedBadgeOriginalClassListToggle) {
          trackedBadgeRef.classList.toggle = trackedBadgeOriginalClassListToggle;
          return trackedBadgeOriginalClassListToggle.call(trackedBadgeRef.classList, token, force);
        }
        return DOMTokenList.prototype.toggle.call(this, token, force);
      }

      const oldClasses = trackedBadgeRef.className;
      const hadClass = trackedBadgeRef.classList.contains(token);
      const result = trackedBadgeOriginalClassListToggle.call(trackedBadgeRef.classList, token, force);
      const newClasses = trackedBadgeRef.className;
      const nowHasClass = trackedBadgeRef.classList.contains(token);
      if (hadClass !== nowHasClass) {
        logChange('Class Toggled', { class: token, force, nowActive: nowHasClass }, oldClasses, newClasses);
      }
      return result;
    };

    // Track innerHTML changes
    let innerHTMLDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    if (!innerHTMLDescriptor) {
      innerHTMLDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'innerHTML');
    }

    if (innerHTMLDescriptor && innerHTMLDescriptor.set) {
      const originalSet = innerHTMLDescriptor.set;
      Object.defineProperty(badge, 'innerHTML', {
        set: function(value) {
          const oldValue = this.innerHTML;
          originalSet.call(this, value);
          if (oldValue !== value) {
            logChange('innerHTML Changed', {
              oldLength: oldValue?.length || 0,
              newLength: value?.length || 0
            }, oldValue?.substring(0, 100), value?.substring(0, 100));
          }
        },
        get: function() {
          return innerHTMLDescriptor.get.call(this);
        },
        configurable: true
      });
    }

    // Track textContent changes
    const textContentDescriptor = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
    if (textContentDescriptor && textContentDescriptor.set) {
      const originalSet = textContentDescriptor.set;
      Object.defineProperty(badge, 'textContent', {
        set: function(value) {
          const oldValue = this.textContent;
          originalSet.call(this, value);
          if (oldValue !== value) {
            logChange('textContent Changed', {
              oldLength: oldValue?.length || 0,
              newLength: value?.length || 0
            }, oldValue?.substring(0, 100), value?.substring(0, 100));
          }
        },
        get: function() {
          return textContentDescriptor.get.call(this);
        },
        configurable: true
      });
    }

    // Visual indicator
    const indicator = document.createElement('div');
    indicator.id = 'iq-dev-mode-tracking-indicator';
    indicator.textContent = `🔴 TRACKING: ${DevModeBadgeDetection.getBadgeType(badge)} - Right-click to stop`;
    indicator.style.cssText = `
      position: fixed;
      top: 50px;
      right: 10px;
      background: #f44336;
      color: white;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: bold;
      z-index: 999998;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
      pointer-events: none;
      animation: pulse 2s infinite;
    `;

    // Add pulse animation
    const style = document.createElement('style');
    style.id = 'iq-dev-mode-tracking-style';
    style.textContent = `
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(indicator);

    // Only add red border - don't change any other appearance
    // Use border instead of outline to avoid interfering with layout
    const currentBorder = badge.style.border;
    badge.style.setProperty('border', '3px solid #f44336', 'important');
    badge.setAttribute('data-dev-mode-tracking-border', currentBorder || '');

    console.log('%c🔴 TRACKING STARTED', 'color: #f44336; font-weight: bold; font-size: 14px;');
    console.log(`%cBadge:`, 'color: #ff9800; font-weight: bold;', badge);
    console.log(`%cType:`, 'color: #ff9800; font-weight: bold;', DevModeBadgeDetection.getBadgeType(badge));
    console.log(`%cRight-click the badge again to stop tracking`, 'color: #9e9e9e; font-style: italic;');
  }

  /**
   * Stop tracking the current badge
   */
  function stopTracking() {
    if (!trackedBadge) return;

    const badgeToRestore = trackedBadge; // Save reference before clearing

    // Restore original setProperty if we modified it
    if (trackedBadgeOriginalSetProperty && badgeToRestore && badgeToRestore.parentElement) {
      try {
        badgeToRestore.style.setProperty = trackedBadgeOriginalSetProperty;
      } catch (e) {
        // Badge might have been removed, ignore
        console.warn('Could not restore setProperty:', e);
      }
    }

    // Restore classList methods if we modified them
    if (badgeToRestore && badgeToRestore.parentElement) {
      try {
        if (trackedBadgeOriginalClassListAdd) {
          badgeToRestore.classList.add = trackedBadgeOriginalClassListAdd;
        }
        if (trackedBadgeOriginalClassListRemove) {
          badgeToRestore.classList.remove = trackedBadgeOriginalClassListRemove;
        }
        if (trackedBadgeOriginalClassListToggle) {
          badgeToRestore.classList.toggle = trackedBadgeOriginalClassListToggle;
        }
      } catch (e) {
        console.warn('Could not restore classList methods:', e);
      }
    }

    // Remove highlight (restore original border) - only if badge still exists
    if (badgeToRestore && badgeToRestore.parentElement) {
      try {
        const originalBorder = badgeToRestore.getAttribute('data-dev-mode-tracking-border');
        if (originalBorder) {
          badgeToRestore.style.setProperty('border', originalBorder, 'important');
        } else {
          badgeToRestore.style.removeProperty('border');
        }
        badgeToRestore.removeAttribute('data-dev-mode-tracking-border');
      } catch (e) {
        // Badge might have been removed, ignore
        console.warn('Could not restore border:', e);
      }
    }

    // Disconnect observer
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }

    // Remove visual indicator
    const indicator = document.getElementById('iq-dev-mode-tracking-indicator');
    if (indicator) {
      indicator.remove();
    }

    const style = document.getElementById('iq-dev-mode-tracking-style');
    if (style) {
      style.remove();
    }

    console.log(`%c🔴 TRACKING STOPPED (${changeCount} changes tracked)`, 'color: #9e9e9e; font-weight: bold; font-size: 14px;');

    trackedBadge = null;
    trackedBadgeOriginalStyle = null;
    trackedBadgeOriginalSetProperty = null;
    trackedBadgeOriginalClassListAdd = null;
    trackedBadgeOriginalClassListRemove = null;
    trackedBadgeOriginalClassListToggle = null;
    changeCount = 0;
  }

  /**
   * Get currently tracked badge
   */
  function getTrackedBadge() {
    return trackedBadge;
  }

  // Export for use in other modules
  if (typeof window !== 'undefined') {
    window.DevModeChangeTracker = {
      startTracking,
      stopTracking,
      getTrackedBadge
    };
  }

})();

