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
  let trackedBadge = null;
  let mutationObserver = null;
  let trackedBadgeStyleProxy = null;
  let trackedBadgeOriginalStyle = null;
  let changeCount = 0;
  let ctrlKeyProcessed = false;

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
   * Detect badge category based on location and context (Categories 1-10)
   */
  function detectBadgeCategory(badge) {
    const pathname = window.location.pathname;
    const isNotificationsPage = pathname.includes('/notifications');
    const isComposePage = pathname.includes('/compose/post');
    const isProfilePage = /^\/[a-zA-Z0-9_]+(\/(with_replies|media|likes))?\/?$/.test(pathname);
    const isStatusPage = pathname.includes('/status/');

    const tweetElement = badge.closest('article[data-testid="tweet"]') ||
                        badge.closest('article[role="article"]') ||
                        badge.closest('article');

    const engagementBar = badge.closest('[role="group"]');
    const composeBox = badge.closest('[data-testid="toolBar"]') ||
                       badge.closest('[role="textbox"]') ||
                       badge.closest('[contenteditable="true"]');
    const toolbar = badge.closest('[data-testid="toolBar"]');

    // CATEGORY 7 & 8: Profile page badges
    if (badge.classList.contains('iq-guessr-score-badge')) {
      const currentHandle = pathname.match(/^\/([a-zA-Z0-9_]+)/)?.[1];
      return {
        category: 8, // Assume own profile, could be 7 or 8
        name: 'Profile Page Badge',
        subcategory: null,
        description: 'IQGuessr score badge on profile page'
      };
    }

    // CATEGORY 6: Real-time badges (compose boxes)
    if (badge.classList.contains('iq-badge-realtime') || badge.hasAttribute('data-iq-realtime')) {
      let subcategory = null;
      let description = 'Real-time badge in compose box';

      // Check for reply compose box
      const replyContext = badge.closest('[aria-label*="Replying to"]') ||
                          (isStatusPage && composeBox && !engagementBar);
      if (replyContext) {
        if (isStatusPage) {
          subcategory = '6.4';
          description = 'Reply Compose Box (From Tweet Detail Page)';
        } else {
          subcategory = '6.2';
          description = 'Reply Compose Box (From Feed)';
        }
      }
      // Check for quote tweet
      else if (composeBox && composeBox.closest('[data-testid*="quote"]')) {
        subcategory = '6.5';
        description = 'Quote Tweet Compose Box';
      }
      // Check for compose modal
      else if (isComposePage || badge.closest('[role="dialog"]') || badge.closest('[data-testid*="modal"]')) {
        subcategory = '6.3';
        description = 'Compose Modal (/compose/post)';
      }
      // Default to home feed compose box
      else {
        subcategory = '6.1';
        description = 'Home Feed Compose Box';
      }

      return {
        category: 6,
        name: 'Real-time Badge',
        subcategory: subcategory,
        description: description
      };
    }

    // CATEGORY 3: Notification badges
    if (isNotificationsPage && tweetElement) {
      const notificationText = Array.from(tweetElement.querySelectorAll('span, div'))
        .find(el => {
          const text = (el.textContent || '').toLowerCase();
          return text.includes('liked') || text.includes('reposted') ||
                 text.includes('replied') || text.includes('quoted');
        });

      let subcategory = null;
      let description = 'Notification badge';

      if (notificationText) {
        const text = notificationText.textContent.toLowerCase();
        if (text.includes('liked')) {
          subcategory = '3.1';
          description = 'Liked Tweet Notification';
        } else if (text.includes('reposted') || text.includes('repost')) {
          subcategory = '3.2';
          description = 'Reposted Tweet Notification';
        } else if (text.includes('replied')) {
          subcategory = '3.3';
          description = 'Reply Notification';
        } else if (text.includes('quoted')) {
          subcategory = '3.4';
          description = 'Quote Tweet Notification';
        }
      }

      return {
        category: 3,
        name: 'Notification Badge',
        subcategory: subcategory,
        description: description
      };
    }

    // CATEGORY 4 & 5: Tweet detail page badges
    if (isStatusPage && tweetElement) {
      // Check if it's the original poster's tweet (has engagement bar)
      const isOriginalPoster = engagementBar &&
                               engagementBar.querySelector('button[data-testid*="like"]');

      return {
        category: isOriginalPoster ? 5 : 4,
        name: isOriginalPoster ? 'Original Poster Badge' : 'Tweet Detail Page Badge',
        subcategory: null,
        description: isOriginalPoster ?
          'Badge on original poster\'s tweet in status page' :
          'Badge on tweet detail page (main tweet or reply)'
      };
    }

    // CATEGORY 2 & 9: Reply badges
    if (tweetElement) {
      // Check if it's a reply (has reply indicator or is in a thread)
      const isReply = tweetElement.querySelector('[aria-label*="Replying to"]') ||
                     tweetElement.closest('[data-testid="tweet"]')?.previousElementSibling ||
                     engagementBar?.querySelector('button[data-testid*="reply"]');

      if (isReply) {
        return {
          category: 9,
          name: 'Reply/Comment Badge',
          subcategory: null,
          description: 'Badge on someone else\'s reply/comment in a thread'
        };
      }
    }

    // CATEGORY 1: Regular feed tweets (default)
    if (tweetElement && engagementBar) {
      return {
        category: 1,
        name: 'Tweet Badge (Regular Feed)',
        subcategory: null,
        description: 'Regular tweet badge in home feed, explore feed, search results, or profile timeline'
      };
    }

    // Default fallback
    return {
      category: null,
      name: 'Unknown Category',
      subcategory: null,
      description: 'Could not determine badge category'
    };
  }

  /**
   * Detect Category 10 states (Reloaded Tweet Guessed IQ Badges)
   */
  function detectCategory10State(badge) {
    const hasCompared = badge.hasAttribute('data-iq-compared') &&
                       badge.getAttribute('data-iq-compared') === 'true';
    const hasIQScore = badge.hasAttribute('data-iq-score');
    const hasGuessed = badge.hasAttribute('data-iq-guessed');
    const isGuessBadge = badge.classList.contains('iq-badge-guess');
    const isCalculated = hasIQScore && !isGuessBadge;

    if (isCalculated && hasCompared) {
      return {
        state: '10.1',
        name: 'Calculated Badge with Compared Status',
        description: 'IQ was calculated and compared to user\'s guess. Has pale dark green outline border.',
        hasCompared: true,
        visualIndicator: 'Pale dark green outline border (rgba(85, 107, 47, 0.6))'
      };
    }

    if (isCalculated && !hasCompared) {
      return {
        state: '10.2',
        name: 'Calculated Badge without Compared Status',
        description: 'IQ was calculated but no guess was submitted. Standard calculated badge styling.',
        hasCompared: false,
        visualIndicator: 'Standard calculated badge (no green outline)'
      };
    }

    if (isGuessBadge && hasGuessed) {
      return {
        state: '10.3',
        name: 'Guess Badge (Waiting for IQ Calculation)',
        description: 'User submitted a guess, waiting for IQ calculation to complete.',
        hasCompared: false,
        visualIndicator: 'Gray guess badge (no green outline)'
      };
    }

    return null;
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
    if (badge.classList.contains('iq-badge-pulse')) types.push('Pulse');
    if (badge.classList.contains('iq-guessr-score-badge')) types.push('Score Badge');

    if (badge.hasAttribute('data-iq-loading')) types.push('[data-iq-loading]');
    if (badge.hasAttribute('data-iq-guess')) types.push('[data-iq-guess]');
    if (badge.hasAttribute('data-iq-realtime')) types.push('[data-iq-realtime]');
    if (badge.hasAttribute('data-iq-invalid')) types.push('[data-iq-invalid]');
    if (badge.hasAttribute('data-iq-guessed')) types.push(`[data-iq-guessed="${badge.getAttribute('data-iq-guessed')}"]`);
    if (badge.hasAttribute('data-iq-calculating')) types.push('[data-iq-calculating]');
    if (badge.hasAttribute('data-iq-score')) types.push(`[data-iq-score="${badge.getAttribute('data-iq-score')}"]`);
    if (badge.hasAttribute('data-confidence')) types.push(`[data-confidence="${badge.getAttribute('data-confidence')}"]`);
    if (badge.hasAttribute('data-iq-compared')) types.push(`[data-iq-compared="${badge.getAttribute('data-iq-compared')}"]`);
    if (badge.hasAttribute('data-iq-guessr-score')) types.push('[data-iq-guessr-score]');

    return types.length > 0 ? types.join(', ') : 'Standard IQ Badge';
  }

  /**
   * Get badge state information with all nuances
   */
  function getBadgeState(badge) {
    const states = [];

    // Basic states
    if (badge.classList.contains('iq-badge-loading')) states.push('Loading IQ calculation');
    if (badge.classList.contains('iq-badge-guess')) states.push('Waiting for guess input');
    if (badge.classList.contains('iq-badge-realtime')) states.push('Real-time calculation');
    if (badge.classList.contains('iq-badge-invalid')) states.push('Invalid tweet (no text)');
    if (badge.classList.contains('iq-badge-calculating')) states.push('Calculating/revealing score');
    if (badge.classList.contains('iq-badge-pulse')) states.push('Pulse animation active');
    if (badge.hasAttribute('data-iq-guessed')) states.push(`Guess submitted: ${badge.getAttribute('data-iq-guessed')}`);
    if (badge.hasAttribute('data-iq-calculating')) states.push('Currently calculating');

    // IQ and confidence
    const iqScore = badge.getAttribute('data-iq-score');
    if (iqScore) {
      states.push(`IQ Score: ${iqScore}`);
    }

    const confidence = badge.getAttribute('data-confidence');
    if (confidence) {
      states.push(`Confidence: ${confidence}%`);
    }

    // Category 10 states (reloaded badges)
    const category10State = detectCategory10State(badge);
    if (category10State) {
      states.push(`Category 10 State: ${category10State.name}`);
      if (category10State.hasCompared) {
        states.push('Has compared status (green outline)');
      }
    }

    // Check if badge has been compared
    if (badge.hasAttribute('data-iq-compared') && badge.getAttribute('data-iq-compared') === 'true') {
      states.push('Compared to guess (data-iq-compared="true")');
    }

    // Check if it's a flip badge (has confidence data)
    if (badge.classList.contains('iq-badge-flip')) {
      states.push('Flip badge (has confidence data, flips on hover/click)');
    }

    // Real-time badge special properties
    if (badge.classList.contains('iq-badge-realtime')) {
      states.push('Real-time: Updates live as user types (debounced 300ms)');
      states.push('Real-time: Height dynamically managed to prevent layout shifts');
    }

    return states.length > 0 ? states : ['Active'];
  }

  /**
   * Get location information about the badge with detailed context
   */
  function getLocationInfo(badge) {
    const info = [];
    const category = detectBadgeCategory(badge);

    // Get bounding rect
    const rect = badge.getBoundingClientRect();
    info.push(`Position: (${Math.round(rect.left)}, ${Math.round(rect.top)})`);
    info.push(`Size: ${Math.round(rect.width)} × ${Math.round(rect.height)}px`);

    // Badge Category
    if (category.category) {
      info.push(`Category: ${category.category} - ${category.name}`);
      if (category.subcategory) {
        info.push(`Subcategory: ${category.subcategory} - ${category.description}`);
      } else {
        info.push(`Description: ${category.description}`);
      }
    }

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

      // Check if it's a reply
      const isReply = tweetElement.querySelector('[aria-label*="Replying to"]') ||
                     tweetElement.getAttribute('data-reply-to');
      if (isReply) {
        info.push('Tweet Type: Reply');
      }
    }

    // Check if in engagement bar
    const engagementBar = badge.closest('[role="group"]');
    if (engagementBar) {
      info.push('Placement: Engagement bar [role="group"] (like/retweet/reply area)');

      // Check placement position
      const isFirstChild = engagementBar.firstElementChild === badge;
      if (isFirstChild) {
        info.push('Placement Position: First child of engagement bar (before buttons)');
      }
    }

    // Check if in compose box
    const composeBox = badge.closest('[data-testid="toolBar"]') ||
                       badge.closest('[role="textbox"]') ||
                       badge.closest('[contenteditable="true"]');
    if (composeBox) {
      if (composeBox.getAttribute('data-testid') === 'toolBar') {
        info.push('Placement: Toolbar [data-testid="toolBar"] before first button');
      } else {
        info.push('Placement: Compose box');
      }
    }

    // Check notification placement
    const isNotificationsPage = window.location.pathname.includes('/notifications');
    if (isNotificationsPage && tweetElement) {
      const tweetContent = tweetElement.querySelector('div[data-testid="tweetText"]') ||
                          tweetElement.querySelector('div[lang]');
      if (tweetContent && badge.compareDocumentPosition(tweetContent) & Node.DOCUMENT_POSITION_PRECEDING) {
        info.push('Placement: Below notification text, before tweet content (on its own line)');
      }
    }

    // Check if in profile page
    const profileBadge = badge.classList.contains('iq-guessr-score-badge');
    if (profileBadge) {
      const userNameContainer = badge.closest('div[data-testid="UserName"]');
      if (userNameContainer) {
        info.push('Placement: After username/handle in div[data-testid="UserName"]');
      }
    }

    // Page context
    const pathname = window.location.pathname;
    if (pathname === '/home' || pathname === '/') {
      info.push('Page: Home feed');
    } else if (pathname.includes('/explore')) {
      info.push('Page: Explore feed');
    } else if (pathname.includes('/search')) {
      info.push('Page: Search results');
    } else if (isNotificationsPage) {
      info.push('Page: Notifications');
    } else if (pathname.includes('/status/')) {
      info.push('Page: Tweet detail page (/status/[tweetId])');
    } else if (pathname.includes('/compose/post')) {
      info.push('Page: Compose modal (/compose/post)');
    } else if (/^\/[a-zA-Z0-9_]+(\/(with_replies|media|likes))?\/?$/.test(pathname)) {
      info.push('Page: Profile page');
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
   * Get creation context if available
   */
  function getCreationContext(badge) {
    if (badge._creationContext) {
      return badge._creationContext;
    }
    return null;
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
    const creationContext = getCreationContext(badge);
    const styles = getRelevantStyles(badge);
    const rect = badge.getBoundingClientRect();

    console.group('%c🔍 DEV MODE - Badge Details', 'color: #667eea; font-weight: bold; font-size: 14px;');

    // Creation Context
    if (creationContext) {
      console.group('%c📍 Creation Origin:', 'color: #e91e63; font-weight: bold;');
      console.log(`%cBadge Type:`, 'color: #e91e63; font-weight: bold;', creationContext.badgeType);
      console.log(`%cCreated At:`, 'color: #e91e63; font-weight: bold;', new Date(creationContext.timestamp).toLocaleString());
      console.log(`%cURL:`, 'color: #e91e63; font-weight: bold;', creationContext.url);
      console.log(`%cPathname:`, 'color: #e91e63; font-weight: bold;', creationContext.pathname);

      if (creationContext.creator) {
        console.log(`%cCreator Function:`, 'color: #e91e63; font-weight: bold;', creationContext.creator);
      }

      if (creationContext.functionNames && creationContext.functionNames.length > 0) {
        console.group('%cCall Chain:', 'color: #e91e63; font-weight: bold;');
        creationContext.functionNames.forEach((funcName, index) => {
          console.log(`%c  ${index + 1}. ${funcName}`, 'color: #e91e63;');
        });
        console.groupEnd();
      }

      if (creationContext.callStack && creationContext.callStack.length > 0) {
        console.groupCollapsed('%cFull Call Stack:', 'color: #e91e63; font-weight: bold;');
        creationContext.callStack.forEach((frame, index) => {
          if (frame.function && frame.file) {
            console.log(`%c  ${index + 1}. ${frame.function}`, 'color: #e91e63;');
            console.log(`%c     ${frame.file}:${frame.line}:${frame.column}`, 'color: #9e9e9e; font-size: 10px;');
          } else if (frame.raw) {
            console.log(`%c  ${frame.raw}`, 'color: #9e9e9e; font-size: 10px;');
          }
        });
        console.groupEnd();
      }

      console.groupEnd();
    }

    // Badge Category
    const category = detectBadgeCategory(badge);
    if (category.category) {
      console.group(`%cCategory ${category.category}: ${category.name}`, 'color: #9c27b0; font-weight: bold;');
      if (category.subcategory) {
        console.log(`%cSubcategory: ${category.subcategory}`, 'color: #9c27b0;');
      }
      console.log(`%cDescription: ${category.description}`, 'color: #9c27b0;');
      console.groupEnd();
    }

    // Category 10 State (if applicable)
    const category10State = detectCategory10State(badge);
    if (category10State) {
      console.group(`%cCategory 10 State ${category10State.state}: ${category10State.name}`, 'color: #4caf50; font-weight: bold;');
      console.log(`%cDescription: ${category10State.description}`, 'color: #4caf50;');
      console.log(`%cVisual Indicator: ${category10State.visualIndicator}`, 'color: #4caf50;');
      if (category10State.hasCompared) {
        console.log(`%cHas Compared Status: Yes (green outline border)`, 'color: #4caf50;');
      }
      console.groupEnd();
    }

    // Badge Type
    console.log('%cType:', 'color: #ff9800; font-weight: bold;', badgeType);

    // Badge State
    console.group('%cState:', 'color: #ff9800; font-weight: bold;');
    badgeState.forEach(state => {
      console.log(`%c  • ${state}`, 'color: #ff9800;');
    });
    console.groupEnd();

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
    const creationContext = getCreationContext(badge);
    const styles = getRelevantStyles(badge);
    const category = detectBadgeCategory(badge);
    const category10State = detectCategory10State(badge);

    let content = '<div style="margin-bottom: 8px;">';
    content += '<div style="color: #667eea; font-weight: bold; font-size: 13px; margin-bottom: 8px;">🔍 DEV MODE - Badge Details</div>';

    // Creation Context
    if (creationContext) {
      content += '<div style="margin-bottom: 6px; padding: 4px; background: rgba(233, 30, 99, 0.1); border-left: 3px solid #e91e63;">';
      content += '<span style="color: #e91e63; font-weight: bold;">📍 Creation Origin:</span>';
      content += '<div style="margin-left: 12px; margin-top: 4px;">';
      content += `<div style="color: #e91e63;">Badge Type: ${creationContext.badgeType}</div>`;
      content += `<div style="color: #e91e63;">Created: ${new Date(creationContext.timestamp).toLocaleString()}</div>`;
      if (creationContext.creator) {
        content += `<div style="color: #e91e63; font-weight: bold;">Creator: ${creationContext.creator}</div>`;
      }
      if (creationContext.functionNames && creationContext.functionNames.length > 0) {
        content += '<div style="color: #e91e63; margin-top: 4px;">Call Chain:</div>';
        creationContext.functionNames.slice(0, 5).forEach((funcName, index) => {
          content += `<div style="color: #e91e63; margin-left: 12px; font-size: 10px;">${index + 1}. ${funcName}</div>`;
        });
        if (creationContext.functionNames.length > 5) {
          content += `<div style="color: #9e9e9e; margin-left: 12px; font-size: 10px;">... and ${creationContext.functionNames.length - 5} more</div>`;
        }
      }
      content += '</div>';
      content += '</div>';
    }

    // Badge Category
    if (category.category) {
      content += '<div style="margin-bottom: 6px;">';
      content += `<span style="color: #9c27b0; font-weight: bold;">Category ${category.category}:</span> `;
      content += `<span style="color: #fff;">${category.name}</span>`;
      if (category.subcategory) {
        content += `<div style="margin-left: 12px; margin-top: 2px; color: #9c27b0;">Subcategory ${category.subcategory}: ${category.description}</div>`;
      } else {
        content += `<div style="margin-left: 12px; margin-top: 2px; color: #9c27b0;">${category.description}</div>`;
      }
      content += '</div>';
    }

    // Category 10 State
    if (category10State) {
      content += '<div style="margin-bottom: 6px; padding: 4px; background: rgba(76, 175, 80, 0.1); border-left: 3px solid #4caf50;">';
      content += `<span style="color: #4caf50; font-weight: bold;">Category 10 State ${category10State.state}:</span> `;
      content += `<span style="color: #fff;">${category10State.name}</span>`;
      content += `<div style="margin-left: 12px; margin-top: 2px; color: #4caf50; font-size: 10px;">${category10State.description}</div>`;
      content += `<div style="margin-left: 12px; margin-top: 2px; color: #4caf50; font-size: 10px;">Visual: ${category10State.visualIndicator}</div>`;
      content += '</div>';
    }

    // Badge Type
    content += '<div style="margin-bottom: 6px;">';
    content += '<span style="color: #ff9800; font-weight: bold;">Type:</span> ';
    content += `<span style="color: #fff;">${badgeType}</span>`;
    content += '</div>';

    // Badge State
    content += '<div style="margin-bottom: 6px;">';
    content += '<span style="color: #ff9800; font-weight: bold;">State:</span>';
    content += '<div style="margin-left: 12px; margin-top: 4px;">';
    badgeState.forEach(state => {
      content += `<div style="color: #ff9800;">• ${state}</div>`;
    });
    content += '</div>';
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

    // Create style proxy to intercept style changes
    trackedBadgeOriginalStyle = badge.style;
    trackedBadgeStyleProxy = createStyleProxy(badge);
    badge.style = trackedBadgeStyleProxy;

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
    const originalAdd = badge.classList.add.bind(badge.classList);
    const originalRemove = badge.classList.remove.bind(badge.classList);
    const originalToggle = badge.classList.toggle.bind(badge.classList);

    badge.classList.add = function(...tokens) {
      const oldClasses = badge.className;
      const result = originalAdd(...tokens);
      const newClasses = badge.className;
      if (oldClasses !== newClasses) {
        logChange('Class Added', { classes: tokens.join(', ') }, oldClasses, newClasses);
      }
      return result;
    };

    badge.classList.remove = function(...tokens) {
      const oldClasses = badge.className;
      const result = originalRemove(...tokens);
      const newClasses = badge.className;
      if (oldClasses !== newClasses) {
        logChange('Class Removed', { classes: tokens.join(', ') }, oldClasses, newClasses);
      }
      return result;
    };

    badge.classList.toggle = function(token, force) {
      const oldClasses = badge.className;
      const hadClass = badge.classList.contains(token);
      const result = originalToggle(token, force);
      const newClasses = badge.className;
      const nowHasClass = badge.classList.contains(token);
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
    indicator.textContent = `🔴 TRACKING: ${getBadgeType(badge)} - Right-click to stop`;
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

    // Also highlight the badge
    badge.style.setProperty('outline', '3px solid #f44336', 'important');
    badge.style.setProperty('outline-offset', '2px', 'important');

    console.log('%c🔴 TRACKING STARTED', 'color: #f44336; font-weight: bold; font-size: 14px;');
    console.log(`%cBadge:`, 'color: #ff9800; font-weight: bold;', badge);
    console.log(`%cType:`, 'color: #ff9800; font-weight: bold;', getBadgeType(badge));
    console.log(`%cRight-click the badge again to stop tracking`, 'color: #9e9e9e; font-style: italic;');
  }

  /**
   * Stop tracking the current badge
   */
  function stopTracking() {
    if (!trackedBadge) return;

    // Restore original style object
    if (trackedBadgeStyleProxy && trackedBadgeOriginalStyle) {
      trackedBadge.style = trackedBadgeOriginalStyle;
    }

    // Remove highlight
    trackedBadge.style.removeProperty('outline');
    trackedBadge.style.removeProperty('outline-offset');

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
    trackedBadgeStyleProxy = null;
    trackedBadgeOriginalStyle = null;
    changeCount = 0;
  }

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

  /**
   * Handle click on badges (for recalculation in dev mode)
   */
  function handleBadgeClick(e) {
    if (!devModeActive) return;

    const target = e.target;

    // Check if we're clicking on a badge or inside a badge
    let badge = null;
    if (isExtensionElement(target)) {
      badge = target;
    } else {
      badge = target.closest('.iq-badge, .iq-guessr-score-badge');
      if (badge && !isExtensionElement(badge)) {
        badge = null;
      }
    }

    if (badge) {
      // Check if it's a calculated badge (has IQ score) or real-time badge
      const hasIQScore = badge.hasAttribute('data-iq-score');
      const isRealtime = badge.classList.contains('iq-badge-realtime') || badge.hasAttribute('data-iq-realtime');

      // Don't recalculate if it's a guess badge or loading badge
      const isGuessBadge = badge.classList.contains('iq-badge-guess') || badge.hasAttribute('data-iq-guess');
      const isLoadingBadge = badge.classList.contains('iq-badge-loading') || badge.hasAttribute('data-iq-loading');
      const isCalculating = badge.hasAttribute('data-iq-recalculating');

      if ((hasIQScore || isRealtime) && !isGuessBadge && !isLoadingBadge && !isCalculating) {
        e.preventDefault();
        e.stopPropagation();

        // Recalculate the badge
        recalculateBadge(badge);
      }
    }
  }

  /**
   * Handle right-click on badges
   */
  function handleContextMenu(e) {
    if (!devModeActive) return;

    const target = e.target;

    // Check if we're clicking on a badge or inside a badge
    let badge = null;
    if (isExtensionElement(target)) {
      badge = target;
    } else {
      badge = target.closest('.iq-badge, .iq-guessr-score-badge');
      if (badge && !isExtensionElement(badge)) {
        badge = null;
      }
    }

    if (badge) {
      e.preventDefault();
      e.stopPropagation();

      if (trackedBadge === badge) {
        // Stop tracking
        stopTracking();
      } else {
        // Start tracking
        startTracking(badge);
      }
    }
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
   * Activate dev mode
   */
  function activateDevMode() {
    if (devModeActive) return;

    devModeActive = true;
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('click', handleBadgeClick, true);
    document.body.style.cursor = 'crosshair';

    // Show indicator
    const indicator = document.createElement('div');
    indicator.id = 'iq-dev-mode-indicator';
        indicator.textContent = '🔍 DEV MODE ACTIVE - Hover: details | Click: recalculate | Right-click: track changes | CTRL: toggle off';
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
      max-width: 400px;
    `;
    document.body.appendChild(indicator);
  }

  /**
   * Deactivate dev mode
   */
  function deactivateDevMode() {
    if (!devModeActive) return;

    devModeActive = false;
    document.removeEventListener('mousemove', handleMouseMove, true);
    document.removeEventListener('contextmenu', handleContextMenu, true);
    document.removeEventListener('click', handleBadgeClick, true);
    document.body.style.cursor = '';
    hideTooltip();

    // Stop tracking if active
    if (trackedBadge) {
      stopTracking();
    }

    // Remove indicator
    const indicator = document.getElementById('iq-dev-mode-indicator');
    if (indicator) {
      indicator.remove();
    }
  }

  /**
   * Handle CTRL key press - toggle dev mode
   */
  function handleKeyDown(e) {
    // Check if CTRL is pressed (without other modifiers that might interfere)
    // Only process if CTRL key itself is pressed (not just held)
    if (e.key === 'Control' || e.keyCode === 17 || e.which === 17) {
      if (!ctrlKeyProcessed) {
        ctrlKeyProcessed = true;

        // Toggle dev mode
        if (devModeActive) {
          deactivateDevMode();
        } else {
          activateDevMode();
        }

        // Prevent default to avoid browser shortcuts
        e.preventDefault();
      }
    }
  }

  /**
   * Handle CTRL key release - reset processed flag
   */
  function handleKeyUp(e) {
    if (e.key === 'Control' || e.keyCode === 17 || e.which === 17) {
      ctrlKeyProcessed = false;
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
        deactivateDevMode();
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
      activate: activateDevMode,
      deactivate: deactivateDevMode,
      toggle: () => {
        if (devModeActive) {
          deactivateDevMode();
        } else {
          activateDevMode();
        }
      }
    };
  }

})();

