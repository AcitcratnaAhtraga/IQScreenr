/**
 * IQ Filter Module
 * Removes tweets/replies/quoted posts based on IQ score thresholds
 * Elements are removed immediately after IQ calculation, before any animations
 */

(function() {
  'use strict';

  /**
   * Get settings helper
   */
  function getSettings() {
    return window.Settings || {};
  }

  /**
   * Check if an element is a reply
   * @param {HTMLElement} tweetElement - The tweet element to check
   * @returns {boolean} True if the element is a reply
   */
  function isReply(tweetElement) {
    if (!tweetElement) return false;

    // Check for reply indicators
    const hasReplyIndicator = tweetElement.querySelector('[aria-label*="Replying to"]') ||
                              tweetElement.querySelector('[data-testid*="reply"]') ||
                              tweetElement.closest('[data-testid="tweet"]')?.previousElementSibling;

    // Check if it's in a thread (has previous sibling tweet)
    const isInThread = tweetElement.previousElementSibling &&
                      (tweetElement.previousElementSibling.querySelector('[data-testid="tweet"]') ||
                       tweetElement.previousElementSibling.querySelector('article[role="article"]'));

    return !!(hasReplyIndicator || isInThread);
  }

  /**
   * Check if an element is a quoted tweet/post (a tweet that quotes another tweet)
   * @param {HTMLElement} tweetElement - The tweet element to check
   * @returns {boolean} True if the element is a quoted post
   */
  function isQuotedPost(tweetElement) {
    if (!tweetElement) return false;

    // A quote tweet is a tweet that contains a quoted tweet container
    // Check for quoted tweet containers within this tweet
    const quotedSelectors = [
      '[data-testid="quotedTweet"]',
      '[data-testid="quoteTweet"]'
    ];

    for (const selector of quotedSelectors) {
      try {
        const quotedContainer = tweetElement.querySelector(selector);
        if (quotedContainer) {
          // This tweet contains a quoted tweet, so it's a quote tweet
          return true;
        }
      } catch (e) {
        // Ignore selector errors
      }
    }

    // Also check if this element itself is marked as a quote tweet
    // (sometimes the main tweet element has this attribute)
    if (tweetElement.getAttribute('data-testid') === 'quotedTweet' ||
        tweetElement.getAttribute('data-testid') === 'quoteTweet') {
      return true;
    }

    return false;
  }

  /**
   * Check if an element is a regular tweet (not a reply or quoted post)
   * @param {HTMLElement} tweetElement - The tweet element to check
   * @returns {boolean} True if the element is a regular tweet
   */
  function isRegularTweet(tweetElement) {
    if (!tweetElement) return false;
    return !isReply(tweetElement) && !isQuotedPost(tweetElement);
  }

  /**
   * Check if a tweet should be filtered based on settings
   * @param {HTMLElement} tweetElement - The tweet element
   * @param {number} iq - The IQ score
   * @returns {boolean} True if the tweet should be removed
   */
  function shouldFilterTweet(tweetElement, iq) {
    const settings = getSettings();

    // Check if filtering is enabled
    if (!settings.enableIQFilter) {
      return false;
    }

    // Check IQ threshold
    const threshold = settings.filterIQThreshold || 100;
    const direction = settings.filterDirection || 'below';

    let matchesThreshold = false;
    if (direction === 'below') {
      matchesThreshold = iq < threshold;
    } else {
      matchesThreshold = iq > threshold;
    }

    if (!matchesThreshold) {
      return false;
    }

    // Check which types to filter
    const filterTweets = settings.filterTweets !== false;
    const filterReplies = settings.filterReplies !== false;
    const filterQuotedPosts = settings.filterQuotedPosts !== false;

    // Determine tweet type and check if it should be filtered
    if (isQuotedPost(tweetElement) && filterQuotedPosts) {
      return true;
    }

    if (isReply(tweetElement) && filterReplies) {
      return true;
    }

    if (isRegularTweet(tweetElement) && filterTweets) {
      return true;
    }

    return false;
  }

  /**
   * Remove a tweet element completely from the DOM
   * This removes ALL elements (the entire tweet container)
   * @param {HTMLElement} tweetElement - The tweet element to remove
   */
  function removeTweetElement(tweetElement) {
    if (!tweetElement || !tweetElement.parentElement) {
      return;
    }

    // Find the outermost container - usually an article or div with role="article"
    // We want to remove the entire tweet, not just parts of it
    let containerToRemove = tweetElement;

    // Try to find the outermost article or tweet container
    let current = tweetElement;
    while (current && current !== document.body) {
      const tagName = current.tagName;
      const role = current.getAttribute('role');
      const testId = current.getAttribute('data-testid');

      // Check if this is a tweet container
      if (tagName === 'ARTICLE' || role === 'article' || testId === 'tweet') {
        containerToRemove = current;
        // Continue up to find the outermost container
        const parent = current.parentElement;
        if (parent && (parent.tagName === 'ARTICLE' || parent.getAttribute('role') === 'article')) {
          current = parent;
          continue;
        }
        break;
      }

      // Also check for common Twitter/X wrapper divs
      if (tagName === 'DIV' && current.classList.contains('css-')) {
        // Check if parent is also a div (likely a wrapper)
        const parent = current.parentElement;
        if (parent && parent.tagName === 'DIV') {
          current = parent;
          continue;
        }
      }

      current = current.parentElement;
    }

    // Remove the container immediately
    if (containerToRemove && containerToRemove.parentElement) {
      containerToRemove.remove();
    }
  }

  /**
   * Check and filter a tweet based on its IQ score
   * This should be called immediately after IQ calculation, before any animations
   * @param {HTMLElement} tweetElement - The tweet element
   * @param {number} iq - The IQ score
   * @returns {boolean} True if the tweet was filtered/removed
   */
  function checkAndFilter(tweetElement, iq) {
    if (!tweetElement || iq === null || iq === undefined) {
      return false;
    }

    if (shouldFilterTweet(tweetElement, iq)) {
      removeTweetElement(tweetElement);
      return true;
    }

    return false;
  }

  // Export for use in other modules
  if (typeof window !== 'undefined') {
    window.IQFilter = {
      checkAndFilter,
      shouldFilterTweet,
      isReply,
      isQuotedPost,
      isRegularTweet,
      removeTweetElement
    };
  }

})();

