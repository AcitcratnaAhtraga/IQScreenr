/**
 * Tweet Detection Utilities
 * Handles detection and validation of tweet elements and text
 */

(function() {
  'use strict';

/**
 * Check if an element is inside a quoted tweet container
 */
function isInsideQuotedTweet(element, tweetElement) {
  const isSingleTweetPage = /\/status\/\d+/.test(window.location.pathname);

  // Check if element is inside any known quoted tweet containers
  const quotedSelectors = [
    '[data-testid="quotedTweet"]',
    '[data-testid="quoteTweet"]',
  ];

  // First, check if we're inside any explicitly marked quoted tweet
  for (const selector of quotedSelectors) {
    try {
      const quotedContainer = tweetElement.querySelector(selector);
      if (quotedContainer && quotedContainer.contains(element)) {
        return true;
      }
    } catch (e) {
      // Ignore selector errors
    }
  }

  // Check for nested articles - quoted tweets are nested articles within the same tweet
  let current = element;
  let articleCount = 0;
  const articles = [];

  while (current && current !== tweetElement) {
    // Count articles we encounter
    if (current.tagName === 'ARTICLE') {
      articleCount++;
      articles.push(current);

      // If we're inside a nested article (second+ article), check if it's actually a quoted tweet
      // Not just any article - must be nested within the tweet structure
      if (articleCount > 1) {
        // Double-check: see if this article is nested inside another article or tweet container
        // AND is marked as a quoted tweet
        const isQuotedContainer = current.querySelector('[data-testid="quotedTweet"]') ||
                                 current.querySelector('[data-testid="quoteTweet"]') ||
                                 current.getAttribute('data-testid') === 'quotedTweet';

        if (isQuotedContainer) {
          return true; // This is definitely inside a quoted tweet container
        }

        // Also check if parent structure indicates quoted tweet
        let parent = current.parentElement;
        while (parent && parent !== tweetElement) {
          if (parent.tagName === 'ARTICLE' ||
              parent.getAttribute('data-testid') === 'tweet' ||
              parent.querySelector('[data-testid="tweet"]')) {
            // Found nested article structure - but only return true if explicitly marked as quoted
            if (parent.querySelector('[data-testid="quotedTweet"]') ||
                parent.querySelector('[data-testid="quoteTweet"]')) {
              return true;
            }
          }
          parent = parent.parentElement;
        }
      }
    }

    current = current.parentElement;
    if (!current) break;
  }

  // Also check depth - if the element is very deep, it might be in a quoted tweet
  // Main tweet text is usually at depth 4-8, quoted tweets are usually 10+
  const mainContainer = tweetElement.querySelector('[data-testid="tweet"]') || tweetElement;
  const depth = getElementDepth(element, mainContainer);

  // If depth > 15 and we're not sure, be cautious - likely quoted
  // But only if there's a shallower tweetText element (which would be the main tweet)
  if (depth > 15) {
    const allTexts = tweetElement.querySelectorAll('[data-testid="tweetText"]');
    for (const otherText of allTexts) {
      if (otherText !== element) {
        const otherDepth = getElementDepth(otherText, mainContainer);
        // Only return true if there's a MUCH shallower element (difference of 5+)
        // This indicates the main tweet text is at a normal depth and this is likely quoted
        if (otherDepth < depth - 5) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Calculate DOM depth of an element relative to a parent
 */
function getElementDepth(element, root) {
  let depth = 0;
  let current = element;
  while (current && current !== root && depth < 50) {
    current = current.parentElement;
    depth++;
    if (!current) break;
  }
  return depth;
}

/**
 * Validate text before processing
 * Returns {isValid: boolean, reason: string}
 */
function validateTweetText(text) {
  if (!text || text.trim().length === 0) {
    return { isValid: false, reason: 'Empty text' };
  }

  // Check for age-restricted content warning
  const ageRestrictionPattern = /due to local laws.*restricting access.*estimate your age/i;
  if (ageRestrictionPattern.test(text)) {
    return { isValid: false, reason: 'Age-restricted content' };
  }

  // Remove emojis and check if there are actual words
  const textWithoutEmoji = text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();

  if (textWithoutEmoji.length === 0) {
    return { isValid: false, reason: 'Emoji-only content' };
  }

  // Extract actual words (excluding emojis, symbols)
  const words = textWithoutEmoji.match(/\b[a-zA-Z]{2,}\b/g) || [];

  if (words.length < 1) {
    return {
      isValid: false,
      reason: `Too few words (${words.length}, minimum 1 required)`
    };
  }

  // Check if it's mostly just metadata/username
  // Allow @mentions at the start IF there's substantial content after them
  // Match @mention (username can contain letters, numbers, underscore)
  const startsWithMention = text.match(/^@[\w]+/);
  let textToCheck = text;

  // If starts with @mention, remove it for validation purposes
  // but only reject if the remaining text is too short
  if (startsWithMention) {
    // Remove the @mention and any trailing space
    const mentionMatch = text.match(/^@[\w]+\s*/);
    if (mentionMatch) {
      textToCheck = text.substring(mentionMatch[0].length).trim();
    } else {
      textToCheck = text.substring(startsWithMention[0].length).trim();
    }
    const remainingWords = textToCheck.match(/\b[a-zA-Z]{2,}\b/g) || [];
    // If after removing @mention, there are still at least 1 word, it's valid
    if (remainingWords.length >= 1) {
      // Valid - has @mention but also substantial content
      return { isValid: true, reason: null };
    }
    // Otherwise, treat as invalid (just @mention without sufficient content)
    return { isValid: false, reason: 'Starts with @mention but insufficient content after' };
  }

  // Check other metadata patterns
  const isLikelyMetadata =
    text.match(/^\d+[h|m|d|w|s]?\s*$/) ||  // Just time/date
    words.length < textWithoutEmoji.split(/\s+/).length * 0.3;  // Less than 30% actual words

  if (isLikelyMetadata) {
    return { isValid: false, reason: 'Appears to be metadata, not tweet content' };
  }

  return { isValid: true, reason: null };
}

/**
 * Find text input elements for new posts or comments
 * Prioritizes active/focused compose boxes, especially those in modals
 */
function findTextInputs() {
  const inputs = [];
  const prioritizedInputs = [];

  // Helper to check if element is in a modal/overlay (higher priority)
  function isInModal(element) {
    let parent = element.parentElement;
    let depth = 0;
    while (parent && depth < 10) {
      const style = window.getComputedStyle(parent);
      const zIndex = parseInt(style.zIndex) || 0;
      // Modals typically have high z-index
      if (zIndex > 1000 ||
          parent.getAttribute('role') === 'dialog' ||
          parent.classList.contains('r-') && style.position === 'fixed') {
        return true;
      }
      parent = parent.parentElement;
      depth++;
    }
    return false;
  }

  // Helper to check if element is visible and not hidden
  function isVisible(element) {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' &&
           style.visibility !== 'hidden' &&
           style.opacity !== '0' &&
           rect.width > 0 &&
           rect.height > 0;
  }

  // Find textareas (used in some Twitter/X interfaces)
  const textareas = document.querySelectorAll('textarea[data-testid="tweetTextarea_0"], textarea[data-testid*="tweetTextarea"]');
  textareas.forEach(textarea => {
    if (!textarea.hasAttribute('data-iq-realtime-monitored') && isVisible(textarea)) {
      // Check if it's focused or in a modal - prioritize these
      if (document.activeElement === textarea ||
          textarea === document.activeElement?.closest('form')?.querySelector('textarea') ||
          isInModal(textarea)) {
        prioritizedInputs.push(textarea);
      } else {
        inputs.push(textarea);
      }
    }
  });

  // Find contenteditable divs (main Twitter/X compose box)
  // Use broader selectors to catch all compose contexts
  const contentEditables = document.querySelectorAll(
    'div[data-testid="tweetTextarea_0"], ' +
    'div[data-testid*="tweetTextarea"], ' +
    'div[role="textbox"][contenteditable="true"]'
  );
  contentEditables.forEach(div => {
    // Make sure it's actually a compose box, not just any contenteditable
    // Check for multiple indicators - compose boxes typically have:
    // 1. Toolbar nearby (with tweet/post button, media buttons, etc.)
    // 2. Tweet button nearby
    // 3. Specific data-testid attributes
    // 4. Location in a compose/post page (URL check)
    // 5. Contains media/gif/poll buttons nearby
    const hasToolbar = div.closest('[data-testid="toolBar"]');
    const hasTweetButton = div.closest('[data-testid="tweetButton"]') ||
                          div.closest('button[data-testid*="tweetButton"]') ||
                          document.querySelector('button[data-testid*="tweetButton"]')?.closest('div')?.contains(div);
    const hasTestId = div.getAttribute('data-testid')?.includes('tweetTextarea') ||
                     div.getAttribute('data-testid')?.includes('tweet');
    const hasComposeIndicators = div.closest('[aria-label*="Tweet"], [aria-label*="Post"]') ||
                                div.closest('div[data-testid*="toolBar"]') ||
                                div.parentElement?.querySelector('button[data-testid*="tweetButton"], button[aria-label*="Tweet"], button[aria-label*="Post"]');

    // Check if we're on a compose/post page
    const isComposePage = window.location.pathname.includes('/compose/') ||
                         window.location.pathname === '/compose/post' ||
                         window.location.href.includes('/compose/post');

    // If on compose page, any visible contenteditable textbox is likely a compose box
    const isComposeBox = hasToolbar ||
                        hasTweetButton ||
                        hasTestId ||
                        hasComposeIndicators ||
                        (isComposePage && isVisible(div));

    if (isComposeBox && !div.hasAttribute('data-iq-realtime-monitored') && isVisible(div)) {
      // Check if it's focused, contains focused element, or in a modal - prioritize these
      const isFocused = document.activeElement === div ||
                       div.contains(document.activeElement);
      const inModal = isInModal(div);

      // Also check if this input is in a visible modal/dialog that's currently active
      // and hide badges in other non-modal contexts when a modal is active
      const parentModal = div.closest('[role="dialog"], [data-testid*="modal"]');
      const hasActiveModal = parentModal && isVisible(parentModal);

      if (isFocused || inModal || hasActiveModal) {
        prioritizedInputs.push(div);
      } else {
        inputs.push(div);
      }
    }
  });

  // Return prioritized inputs first, then others
  return [...prioritizedInputs, ...inputs];
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.TweetDetection = {
    isInsideQuotedTweet,
    getElementDepth,
    validateTweetText,
    findTextInputs
  };
}

})();
