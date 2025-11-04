/**
 * Dev Mode Feature
 * When CTRL is pressed, reveals all details about extension-created elements on hover
 */

(function() {
  'use strict';

  let devModeActive = false;
  let tooltipElement = null;
  let currentBadge = null;
  let lastLoggedBadge = null;

  /**
   * Check if an element is created by the extension
   */
  function isExtensionElement(element) {
    if (!element) return false;

    // Check for extension badge classes
    return element.classList.contains('iq-badge') ||
           element.classList.contains('iq-guessr-score-badge');
  }

  /**
   * Get badge type information
   */
  function getBadgeType(badge) {
    const types = [];

    if (badge.classList.contains('iq-badge-loading')) types.push('Loading');
    if (badge.classList.contains('iq-badge-guess')) types.push('Guess');
    if (badge.classList.contains('iq-badge-realtime')) types.push('Real-time');
    if (badge.classList.contains('iq-badge-invalid')) types.push('Invalid');
    if (badge.classList.contains('iq-badge-flip')) types.push('Flip');
    if (badge.classList.contains('iq-badge-calculating')) types.push('Calculating');
    if (badge.classList.contains('iq-guessr-score-badge')) types.push('Score Badge');

    if (badge.hasAttribute('data-iq-loading')) types.push('[data-iq-loading]');
    if (badge.hasAttribute('data-iq-guess')) types.push('[data-iq-guess]');
    if (badge.hasAttribute('data-iq-realtime')) types.push('[data-iq-realtime]');
    if (badge.hasAttribute('data-iq-invalid')) types.push('[data-iq-invalid]');
    if (badge.hasAttribute('data-iq-guessed')) types.push(`[data-iq-guessed="${badge.getAttribute('data-iq-guessed')}"]`);
    if (badge.hasAttribute('data-iq-calculating')) types.push('[data-iq-calculating]');
    if (badge.hasAttribute('data-iq-score')) types.push(`[data-iq-score="${badge.getAttribute('data-iq-score')}"]`);
    if (badge.hasAttribute('data-confidence')) types.push(`[data-confidence="${badge.getAttribute('data-confidence')}"]`);
    if (badge.hasAttribute('data-iq-guessr-score')) types.push('[data-iq-guessr-score]');

    return types.length > 0 ? types.join(', ') : 'Standard IQ Badge';
  }

  /**
   * Get badge state information
   */
  function getBadgeState(badge) {
    const states = [];

    if (badge.classList.contains('iq-badge-loading')) states.push('Loading IQ calculation');
    if (badge.classList.contains('iq-badge-guess')) states.push('Waiting for guess input');
    if (badge.classList.contains('iq-badge-realtime')) states.push('Real-time calculation');
    if (badge.classList.contains('iq-badge-invalid')) states.push('Invalid tweet (no text)');
    if (badge.classList.contains('iq-badge-calculating')) states.push('Calculating/revealing score');
    if (badge.hasAttribute('data-iq-guessed')) states.push(`Guess submitted: ${badge.getAttribute('data-iq-guessed')}`);
    if (badge.hasAttribute('data-iq-calculating')) states.push('Currently calculating');

    const iqScore = badge.getAttribute('data-iq-score');
    if (iqScore) {
      states.push(`IQ Score: ${iqScore}`);
    }

    const confidence = badge.getAttribute('data-confidence');
    if (confidence) {
      states.push(`Confidence: ${confidence}%`);
    }

    return states.length > 0 ? states : ['Active'];
  }

  /**
   * Get location information about the badge
   */
  function getLocationInfo(badge) {
    const info = [];

    // Get bounding rect
    const rect = badge.getBoundingClientRect();
    info.push(`Position: (${Math.round(rect.left)}, ${Math.round(rect.top)})`);
    info.push(`Size: ${Math.round(rect.width)} × ${Math.round(rect.height)}px`);

    // Get parent information
    const parent = badge.parentElement;
    if (parent) {
      const parentTag = parent.tagName.toLowerCase();
      const parentClass = parent.className || '';
      const parentRole = parent.getAttribute('role') || '';
      const parentTestId = parent.getAttribute('data-testid') || '';

      let parentInfo = `Parent: ${parentTag}`;
      if (parentRole) parentInfo += ` [role="${parentRole}"]`;
      if (parentTestId) parentInfo += ` [data-testid="${parentTestId}"]`;
      if (parentClass) parentInfo += ` .${parentClass.split(' ')[0]}`;

      info.push(parentInfo);
    }

    // Check if in tweet/article
    const tweetElement = badge.closest('article[data-testid="tweet"]') ||
                        badge.closest('article[role="article"]') ||
                        badge.closest('article');
    if (tweetElement) {
      const tweetId = tweetElement.getAttribute('data-tweet-id');
      if (tweetId) {
        info.push(`Tweet ID: ${tweetId}`);
      }
      info.push('Context: Tweet/Article');
    }

    // Check if in engagement bar
    const engagementBar = badge.closest('[role="group"]');
    if (engagementBar) {
      info.push('Context: Engagement bar (like/retweet/reply area)');
    }

    // Check if in compose box
    const composeBox = badge.closest('[data-testid="toolBar"]') ||
                       badge.closest('[role="textbox"]') ||
                       badge.closest('[contenteditable="true"]');
    if (composeBox) {
      info.push('Context: Compose box');
    }

    // Check if in profile page
    const profileBadge = badge.classList.contains('iq-guessr-score-badge');
    if (profileBadge) {
      info.push('Context: Profile page');
    }

    // Check if in notifications
    const isNotificationsPage = window.location.pathname.includes('/notifications');
    if (isNotificationsPage && tweetElement) {
      info.push('Context: Notifications page');
    }

    return info;
  }

  /**
   * Get all data attributes
   */
  function getDataAttributes(badge) {
    const attrs = {};
    Array.from(badge.attributes).forEach(attr => {
      if (attr.name.startsWith('data-')) {
        attrs[attr.name] = attr.value;
      }
    });
    return attrs;
  }

  /**
   * Get debug data if available
   */
  function getDebugData(badge) {
    if (badge._debugData) {
      return {
        iq: badge._debugData.iq,
        confidence: badge._debugData.result?.confidence,
        textLength: badge._debugData.text?.length,
        timestamp: badge._debugData.timestamp,
        hasFullResult: !!badge._debugData.result,
        dimensionScores: badge._debugData.result?.dimension_scores || null
      };
    }
    return null;
  }

  /**
   * Get computed styles relevant to the badge
   */
  function getRelevantStyles(badge) {
    const styles = window.getComputedStyle(badge);
    return {
      display: styles.display,
      visibility: styles.visibility,
      opacity: styles.opacity,
      backgroundColor: styles.backgroundColor,
      color: styles.color,
      position: styles.position,
      zIndex: styles.zIndex,
      cursor: styles.cursor
    };
  }

  /**
   * Log badge details to console
   */
  function logToConsole(badge) {
    // Only log if this is a different badge to avoid spam
    if (badge === lastLoggedBadge) {
      return;
    }
    lastLoggedBadge = badge;

    const badgeType = getBadgeType(badge);
    const badgeState = getBadgeState(badge);
    const locationInfo = getLocationInfo(badge);
    const dataAttrs = getDataAttributes(badge);
    const debugData = getDebugData(badge);
    const styles = getRelevantStyles(badge);
    const rect = badge.getBoundingClientRect();

    console.group('%c🔍 DEV MODE - Badge Details', 'color: #667eea; font-weight: bold; font-size: 14px;');

    // Badge Type
    console.log('%cType:', 'color: #ff9800; font-weight: bold;', badgeType);

    // Badge State
    console.log('%cState:', 'color: #ff9800; font-weight: bold;', badgeState.join(', '));

    // Location Info
    console.group('%cLocation:', 'color: #ff9800; font-weight: bold;');
    locationInfo.forEach(info => {
      console.log(`%c  • ${info}`, 'color: #4caf50;');
    });
    console.groupEnd();

    // Data Attributes
    if (Object.keys(dataAttrs).length > 0) {
      console.group('%cData Attributes:', 'color: #ff9800; font-weight: bold;');
      Object.entries(dataAttrs).forEach(([key, value]) => {
        console.log(`%c  ${key}="${value}"`, 'color: #9c27b0;');
      });
      console.groupEnd();
    }

    // Debug Data
    if (debugData) {
      console.group('%cDebug Data:', 'color: #ff9800; font-weight: bold;');
      if (debugData.iq) console.log(`%c  IQ: ${debugData.iq}`, 'color: #2196f3;');
      if (debugData.confidence !== undefined && debugData.confidence !== null) {
        console.log(`%c  Confidence: ${debugData.confidence}%`, 'color: #2196f3;');
      }
      if (debugData.textLength) {
        console.log(`%c  Text Length: ${debugData.textLength} chars`, 'color: #2196f3;');
      }
      if (debugData.timestamp) {
        console.log(`%c  Timestamp: ${new Date(debugData.timestamp).toLocaleString()}`, 'color: #2196f3;');
      }
      if (debugData.dimensionScores) {
        console.log('%c  Dimension Scores:', 'color: #2196f3;', debugData.dimensionScores);
      }
      if (badge._debugData && badge._debugData.result) {
        console.log('%c  Full Result Object:', 'color: #2196f3;', badge._debugData.result);
      }
      if (badge._debugData && badge._debugData.text) {
        console.log(`%c  Original Text:`, 'color: #2196f3;');
        console.log(`%c${badge._debugData.text}`, 'color: #333; font-family: monospace; background: #FFF9C4; padding: 4px; border-left: 3px solid #FFC107;');
      }
      console.groupEnd();
    }

    // Styles
    console.group('%cComputed Styles:', 'color: #ff9800; font-weight: bold;');
    Object.entries(styles).forEach(([key, value]) => {
      console.log(`%c  ${key}: ${value}`, 'color: #00bcd4;');
    });
    console.groupEnd();

    // Class List
    if (badge.className) {
      console.log('%cClasses:', 'color: #ff9800; font-weight: bold;', badge.className);
    }

    // Element Reference
    console.log('%cElement:', 'color: #ff9800; font-weight: bold;', badge);

    // DOM Path
    const path = [];
    let element = badge;
    while (element && element !== document.body) {
      let selector = element.tagName.toLowerCase();
      if (element.id) {
        selector += `#${element.id}`;
      } else if (element.className) {
        const classes = element.className.split(' ').filter(c => c).slice(0, 2).join('.');
        if (classes) selector += `.${classes}`;
      }
      path.unshift(selector);
      element = element.parentElement;
    }
    console.log('%cDOM Path:', 'color: #ff9800; font-weight: bold;', path.join(' > '));

    console.groupEnd();
  }

  /**
   * Create and show tooltip
   */
  function showTooltip(badge, x, y) {
    // Remove existing tooltip
    if (tooltipElement) {
      tooltipElement.remove();
    }

    // Log to console
    logToConsole(badge);

    // Create tooltip element
    tooltipElement = document.createElement('div');
    tooltipElement.className = 'iq-dev-mode-tooltip';
    tooltipElement.style.cssText = `
      position: fixed;
      left: ${x + 15}px;
      top: ${y + 15}px;
      background: #1a1a1a;
      color: #fff;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      line-height: 1.6;
      max-width: 500px;
      max-height: 600px;
      overflow-y: auto;
      z-index: 999999;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
      border: 2px solid #667eea;
      pointer-events: none;
    `;

    // Build tooltip content
    const badgeType = getBadgeType(badge);
    const badgeState = getBadgeState(badge);
    const locationInfo = getLocationInfo(badge);
    const dataAttrs = getDataAttributes(badge);
    const debugData = getDebugData(badge);
    const styles = getRelevantStyles(badge);

    let content = '<div style="margin-bottom: 8px;">';
    content += '<div style="color: #667eea; font-weight: bold; font-size: 13px; margin-bottom: 8px;">🔍 DEV MODE - Badge Details</div>';

    // Badge Type
    content += '<div style="margin-bottom: 6px;">';
    content += '<span style="color: #ff9800; font-weight: bold;">Type:</span> ';
    content += `<span style="color: #fff;">${badgeType}</span>`;
    content += '</div>';

    // Badge State
    content += '<div style="margin-bottom: 6px;">';
    content += '<span style="color: #ff9800; font-weight: bold;">State:</span> ';
    content += `<span style="color: #fff;">${badgeState.join(', ')}</span>`;
    content += '</div>';

    // Location Info
    content += '<div style="margin-bottom: 6px;">';
    content += '<span style="color: #ff9800; font-weight: bold;">Location:</span>';
    content += '<div style="margin-left: 12px; margin-top: 4px;">';
    locationInfo.forEach(info => {
      content += `<div style="color: #4caf50;">• ${info}</div>`;
    });
    content += '</div>';
    content += '</div>';

    // Data Attributes
    if (Object.keys(dataAttrs).length > 0) {
      content += '<div style="margin-bottom: 6px;">';
      content += '<span style="color: #ff9800; font-weight: bold;">Data Attributes:</span>';
      content += '<div style="margin-left: 12px; margin-top: 4px;">';
      Object.entries(dataAttrs).forEach(([key, value]) => {
        content += `<div style="color: #9c27b0;">${key}="${value}"</div>`;
      });
      content += '</div>';
      content += '</div>';
    }

    // Debug Data
    if (debugData) {
      content += '<div style="margin-bottom: 6px;">';
      content += '<span style="color: #ff9800; font-weight: bold;">Debug Data:</span>';
      content += '<div style="margin-left: 12px; margin-top: 4px;">';
      if (debugData.iq) content += `<div style="color: #2196f3;">IQ: ${debugData.iq}</div>`;
      if (debugData.confidence !== undefined && debugData.confidence !== null) {
        content += `<div style="color: #2196f3;">Confidence: ${debugData.confidence}%</div>`;
      }
      if (debugData.textLength) {
        content += `<div style="color: #2196f3;">Text Length: ${debugData.textLength} chars</div>`;
      }
      if (debugData.timestamp) {
        content += `<div style="color: #2196f3;">Timestamp: ${new Date(debugData.timestamp).toLocaleString()}</div>`;
      }
      if (debugData.dimensionScores) {
        content += '<div style="color: #2196f3;">Dimension Scores: Available</div>';
      }
      content += '</div>';
      content += '</div>';
    }

    // Styles
    content += '<div style="margin-bottom: 6px;">';
    content += '<span style="color: #ff9800; font-weight: bold;">Styles:</span>';
    content += '<div style="margin-left: 12px; margin-top: 4px;">';
    Object.entries(styles).forEach(([key, value]) => {
      content += `<div style="color: #00bcd4;">${key}: ${value}</div>`;
    });
    content += '</div>';
    content += '</div>';

    // Class List
    if (badge.className) {
      content += '<div style="margin-bottom: 6px;">';
      content += '<span style="color: #ff9800; font-weight: bold;">Classes:</span> ';
      content += `<span style="color: #fff;">${badge.className}</span>`;
      content += '</div>';
    }

    content += '</div>';

    tooltipElement.innerHTML = content;
    document.body.appendChild(tooltipElement);

    // Adjust position if tooltip goes off screen
    setTimeout(() => {
      if (tooltipElement) {
        const tooltipRect = tooltipElement.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (tooltipRect.right > viewportWidth) {
          tooltipElement.style.left = `${x - tooltipRect.width - 15}px`;
        }
        if (tooltipRect.bottom > viewportHeight) {
          tooltipElement.style.top = `${y - tooltipRect.height - 15}px`;
        }
      }
    }, 0);
  }

  /**
   * Hide tooltip
   */
  function hideTooltip() {
    if (tooltipElement) {
      tooltipElement.remove();
      tooltipElement = null;
    }
    currentBadge = null;
    lastLoggedBadge = null;
  }

  /**
   * Handle mouse move over badges
   */
  function handleMouseMove(e) {
    if (!devModeActive) {
      hideTooltip();
      return;
    }

    const target = e.target;

    // Check if we're hovering over a badge or inside a badge
    let badge = null;
    if (isExtensionElement(target)) {
      badge = target;
    } else {
      // Check if we're inside a badge
      badge = target.closest('.iq-badge, .iq-guessr-score-badge');
      if (badge && !isExtensionElement(badge)) {
        badge = null;
      }
    }

    if (badge && badge !== currentBadge) {
      currentBadge = badge;
      const rect = badge.getBoundingClientRect();
      showTooltip(badge, e.clientX, e.clientY);
    } else if (!badge) {
      hideTooltip();
      lastLoggedBadge = null;
    }
  }

  /**
   * Handle CTRL key press
   */
  function handleKeyDown(e) {
    // Check if CTRL is pressed (without other modifiers that might interfere)
    if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
      if (!devModeActive) {
        devModeActive = true;
        document.addEventListener('mousemove', handleMouseMove, true);
        document.body.style.cursor = 'crosshair';

        // Show indicator
        const indicator = document.createElement('div');
        indicator.id = 'iq-dev-mode-indicator';
        indicator.textContent = '🔍 DEV MODE ACTIVE - Hover over badges to see details';
        indicator.style.cssText = `
          position: fixed;
          top: 10px;
          right: 10px;
          background: #667eea;
          color: white;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: bold;
          z-index: 999998;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
          pointer-events: none;
        `;
        document.body.appendChild(indicator);
      }
    }
  }

  /**
   * Handle CTRL key release
   */
  function handleKeyUp(e) {
    if (!e.ctrlKey) {
      if (devModeActive) {
        devModeActive = false;
        document.removeEventListener('mousemove', handleMouseMove, true);
        document.body.style.cursor = '';
        hideTooltip();

        // Remove indicator
        const indicator = document.getElementById('iq-dev-mode-indicator');
        if (indicator) {
          indicator.remove();
        }
      }
    }
  }

  /**
   * Initialize dev mode
   */
  function init() {
    // Listen for CTRL key
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keyup', handleKeyUp, true);

    // Also handle window blur to deactivate dev mode
    window.addEventListener('blur', () => {
      if (devModeActive) {
        devModeActive = false;
        document.removeEventListener('mousemove', handleMouseMove, true);
        document.body.style.cursor = '';
        hideTooltip();

        const indicator = document.getElementById('iq-dev-mode-indicator');
        if (indicator) {
          indicator.remove();
        }
      }
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Export for debugging
  if (typeof window !== 'undefined') {
    window.DevMode = {
      isActive: () => devModeActive,
      activate: () => {
        if (!devModeActive) {
          handleKeyDown({ ctrlKey: true, shiftKey: false, altKey: false, metaKey: false });
        }
      },
      deactivate: () => {
        if (devModeActive) {
          handleKeyUp({ ctrlKey: false });
        }
      }
    };
  }

})();

