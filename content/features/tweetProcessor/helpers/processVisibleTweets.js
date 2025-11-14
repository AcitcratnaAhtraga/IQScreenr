/**
 * Process Visible Tweets Helper
 * Processes all visible tweets on the page
 */

(function() {
  'use strict';

  const getSettings = () => window.Settings || {};
  const getLoadingBadgeManager = () => window.LoadingBadgeManager || {};
  const getTweetProcessor = () => window.TweetProcessor || {};

  /**
   * Process all visible tweets on the page
   * PERFORMANCE OPTIMIZED: Cached selectors, batched DOM operations, early exits
   *
   * @param {Set} processedTweets - Set of processed tweets
   */
  function processVisibleTweets(processedTweets) {
    const settings = getSettings();
    const { addLoadingBadgeToTweet } = getLoadingBadgeManager();
    const { processTweet } = getTweetProcessor();
    const isNotificationsPage = window.location.href.includes('/notifications');

    // Performance optimization: Cache selector results
    // Use IntersectionObserver-friendly approach when possible
    const tweetSelectors = [
      'article[data-testid="tweet"]',
      'article[role="article"]',
      'div[data-testid="cellInnerDiv"] > article'
    ];

    let tweets = [];
    // Try cached selector first (most common case)
    const cachedSelector = processVisibleTweets._cachedSelector || tweetSelectors[0];
    tweets = document.querySelectorAll(cachedSelector);
    
    if (tweets.length === 0) {
      // Try other selectors
      for (const selector of tweetSelectors) {
        if (selector === cachedSelector) continue;
        tweets = document.querySelectorAll(selector);
        if (tweets.length > 0) {
          processVisibleTweets._cachedSelector = selector;
          break;
        }
      }
    } else {
      processVisibleTweets._cachedSelector = cachedSelector;
    }

    if (tweets.length === 0) {
      tweets = document.querySelectorAll('article');
    }

    const processedTweetElements = new Set();
    const newTweets = [];
    const skippedTweets = [];

    // Check if IqFiltr is available to skip removed/muted tweets
    const getIqFiltr = () => window.IqFiltr || {};
    const { shouldSkipTweet } = getIqFiltr();

    Array.from(tweets).forEach((tweet, index) => {
      if (!tweet) {
        if (isNotificationsPage && index < 5) {
          skippedTweets.push({ reason: 'tweet is null/falsy', index });
        }
        return;
      }

      // Skip tweets that were previously removed or muted
      if (shouldSkipTweet && shouldSkipTweet(tweet)) {
        return;
      }

      if (tweet.hasAttribute('data-iq-processing')) {
        if (isNotificationsPage && index < 5) {
          skippedTweets.push({ reason: 'already processing', index });
        }
        return;
      }

      const nestedTweet = tweet.querySelector('article[data-testid="tweet"]') ||
                          tweet.querySelector('article[role="article"]');

      let actualTweet = tweet;
      if (nestedTweet && nestedTweet !== tweet) {
        actualTweet = nestedTweet;
      }

      if (actualTweet.hasAttribute('data-iq-analyzed')) {
        const existingBadge = actualTweet.querySelector('.iq-badge');

        // Check if badge is a game mode guess badge (which is valid even without data-iq-score)
        const isGuessBadge = existingBadge && (
          existingBadge.classList.contains('iq-badge-guess') ||
          existingBadge.hasAttribute('data-iq-guess')
        );

        // Check if badge has a calculated score (either from game mode reveal or normal processing)
        const hasCalculatedScore = existingBadge && existingBadge.hasAttribute('data-iq-score');

        // Check if badge is a valid completed badge (score, invalid, or guess badge waiting for input)
        const isValidCompletedBadge = existingBadge && (
          hasCalculatedScore ||
          existingBadge.hasAttribute('data-iq-invalid') ||
          isGuessBadge
        );

        // Only consider it "stuck in loading" if it's actually a loading badge (not a guess badge)
        const isStuckInLoading = existingBadge && (
          existingBadge.hasAttribute('data-iq-loading') ||
          existingBadge.classList.contains('iq-badge-loading')
        ) && !isGuessBadge;

        if (isStuckInLoading) {
          // Tweet is stuck in loading state - force reprocess
          actualTweet.removeAttribute('data-iq-analyzed');
          if (processedTweets && processedTweets.delete) {
            processedTweets.delete(actualTweet);
          }
          if (existingBadge && existingBadge.parentElement) {
            existingBadge.remove();
          }
        } else if (!existingBadge && settings.showIQBadge) {
          // Badge was removed somehow - reprocess only if badges should be shown
          actualTweet.removeAttribute('data-iq-analyzed');
          if (processedTweets && processedTweets.delete) {
            processedTweets.delete(actualTweet);
          }
        } else if (isValidCompletedBadge || existingBadge) {
          // Tweet has a valid badge (completed, invalid, or guess badge) - don't reprocess
          return;
        }
      }

      if (nestedTweet && nestedTweet !== tweet) {
        // Skip nested tweet if it was removed or muted
        if (shouldSkipTweet && shouldSkipTweet(nestedTweet)) {
          return;
        }
        if (!nestedTweet.hasAttribute('data-iq-analyzed') &&
            !nestedTweet.hasAttribute('data-iq-processing') &&
            !processedTweetElements.has(nestedTweet)) {
          newTweets.push(nestedTweet);
          processedTweetElements.add(nestedTweet);
        }
      } else {
        const hasTweetText = tweet.querySelector('[data-testid="tweetText"]');
        const hasEngagementBar = tweet.querySelector('[role="group"]');

        if ((hasTweetText || hasEngagementBar) && !processedTweetElements.has(tweet)) {
          newTweets.push(tweet);
          processedTweetElements.add(tweet);
        }
      }
    });

    if (settings.showIQBadge && addLoadingBadgeToTweet) {
      // Performance optimization: Batch badge insertions using DocumentFragment
      // Save scroll position before inserting any badges
      const scrollBeforeBadges = window.scrollY;

      // Pre-filter tweets that need badges (reduce DOM queries)
      const badgesToInsert = [];
      const nestedTweetCache = new WeakMap(); // Cache nested tweet lookups
      
      for (const tweet of newTweets) {
        // Early exit: skip if already has badge
        if (tweet.querySelector('.iq-badge')) continue;
        
        let actualTweet = tweet;
        // Use cached nested tweet lookup if available
        if (!nestedTweetCache.has(tweet)) {
          const nestedTweet = tweet.querySelector('article[data-testid="tweet"]') ||
                              tweet.querySelector('article[role="article"]');
          if (nestedTweet && nestedTweet !== tweet) {
            actualTweet = nestedTweet;
          }
          nestedTweetCache.set(tweet, actualTweet);
        } else {
          actualTweet = nestedTweetCache.get(tweet);
        }
        
        // Don't add badge if tweet is already analyzed
        if (!actualTweet.hasAttribute('data-iq-analyzed')) {
          badgesToInsert.push(tweet);
        }
      }

      // Batch insert badges (skip removed/muted tweets)
      if (badgesToInsert.length > 0) {
        // Use requestIdleCallback for badge insertion if available
        const insertBadges = () => {
          badgesToInsert.forEach((tweet) => {
            // Double-check that tweet wasn't removed/muted before adding badge
            if (!shouldSkipTweet || !shouldSkipTweet(tweet)) {
              addLoadingBadgeToTweet(tweet);
            }
          });
        };

        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(insertBadges, { timeout: 50 });
        } else {
          requestAnimationFrame(insertBadges);
        }

        // Restore scroll position after all badges are inserted
        requestAnimationFrame(() => {
          const scrollAfterBadges = window.scrollY;
          if (Math.abs(scrollAfterBadges - scrollBeforeBadges) > 5) {
            // Restore scroll position to maintain user's viewport
            window.scrollTo({
              top: scrollBeforeBadges,
              behavior: 'instant'
            });
          }
        });
      }
    }

    // Performance optimization: Batch tweet processing with requestIdleCallback
    if (processTweet && newTweets.length > 0) {
      const processTweets = () => {
        // Process tweets in batches to avoid blocking
        const BATCH_SIZE = 5;
        let index = 0;
        
        const processBatch = () => {
          const batch = newTweets.slice(index, index + BATCH_SIZE);
          batch.forEach((tweet) => {
            processTweet(tweet);
          });
          index += BATCH_SIZE;
          
          if (index < newTweets.length) {
            // Schedule next batch
            if (typeof requestIdleCallback !== 'undefined') {
              requestIdleCallback(processBatch, { timeout: 100 });
            } else {
              setTimeout(processBatch, 0);
            }
          }
        };
        
        processBatch();
      };

      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(processTweets, { timeout: 100 });
      } else {
        requestAnimationFrame(processTweets);
      }
    }
  }

  // Export
  if (typeof window !== 'undefined') {
    window.ProcessVisibleTweets = {
      processVisibleTweets
    };
  }
})();

