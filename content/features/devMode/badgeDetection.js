/**
 * Badge Detection and Categorization
 * Detects badge categories, types, states, and location information
 */

(function() {
  'use strict';

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

  // Export for use in other modules
  if (typeof window !== 'undefined') {
    window.DevModeBadgeDetection = {
      detectBadgeCategory,
      detectCategory10State,
      getBadgeType,
      getBadgeState,
      getLocationInfo
    };
  }

})();

