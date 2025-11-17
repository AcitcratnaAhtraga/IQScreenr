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
    
    // Debug logging: Log all tweets in viewport (DISABLED by default - too verbose)
    // Only enable if explicitly needed for debugging
    // const tracker = window.BadgeStateTracker || {};
    // if (tracker.logAllTweetsInViewport) {
    //   tracker.logAllTweetsInViewport();
    // }

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
        // CRITICAL: Use findExistingBadge to check both actualTweet and outer wrapper
        // Badges can be placed in outer wrapper for nested structures, so we must check both
        const getNestedTweetHandler = () => window.NestedTweetHandler || {};
        const { findExistingBadge } = getNestedTweetHandler();
        
        // Determine if this is a nested structure
        const outerElement = nestedTweet && nestedTweet !== tweet ? tweet : null;
        const hasNestedStructure = !!outerElement;
        
        // Use the proper badge finder that checks both locations
        const existingBadge = findExistingBadge 
          ? findExistingBadge(actualTweet, outerElement, hasNestedStructure)
          : actualTweet.querySelector('.iq-badge');

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
        // AND it's been loading for more than 3 seconds (not just recently created)
        const isStuckInLoading = existingBadge && (
          existingBadge.hasAttribute('data-iq-loading') ||
          existingBadge.classList.contains('iq-badge-loading')
        ) && !isGuessBadge;
        
        // Check if badge has been stuck for a while (not just recently created)
        let isActuallyStuck = false;
        if (isStuckInLoading) {
          const badgeCreatedAt = existingBadge?.getAttribute('data-created-at');
          if (badgeCreatedAt) {
            try {
              const createdTime = new Date(badgeCreatedAt).getTime();
              const age = Date.now() - createdTime;
              // Only consider it stuck if it's been loading for more than 3 seconds
              isActuallyStuck = age > 3000;
            } catch (e) {
              // If we can't parse the date, assume it's stuck
              isActuallyStuck = true;
            }
          } else {
            // No creation timestamp - assume it's stuck
            isActuallyStuck = true;
          }
        }

        if (isActuallyStuck) {
          // Tweet is stuck in loading state - force reprocess
          actualTweet.removeAttribute('data-iq-analyzed');
          actualTweet.removeAttribute('data-iq-processing');
          actualTweet.removeAttribute('data-iq-processing-start');
          if (processedTweets && processedTweets.delete) {
            processedTweets.delete(actualTweet);
          }
          // Don't remove the badge - let it be processed
        } else if (!existingBadge && settings.showIQBadge) {
          // Badge was removed somehow - reprocess only if badges should be shown
          // BUT: Double-check by searching more thoroughly before reprocessing
          const thoroughSearch = tweet.querySelector('.iq-badge') || 
                                 (outerElement && outerElement.querySelector('.iq-badge'));
          if (!thoroughSearch) {
            // Badge really doesn't exist - reprocess
            actualTweet.removeAttribute('data-iq-analyzed');
            actualTweet.removeAttribute('data-iq-processing');
            actualTweet.removeAttribute('data-iq-processing-start');
            if (processedTweets && processedTweets.delete) {
              processedTweets.delete(actualTweet);
            }
          }
          // If thoroughSearch found a badge, don't reprocess - it exists somewhere
        } else if (isValidCompletedBadge || (existingBadge && !isStuckInLoading)) {
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

    // PERFORMANCE: In IqGuessr mode, skip adding loading badges - processTweet will create guess badges directly
    // This prevents double badges (loading + guess) from appearing
    const getGameManager = () => window.GameManager || {};
    const gameManager = getGameManager();
    const isGameModeEnabled = gameManager && gameManager.isGameModeEnabled && gameManager.isGameModeEnabled();
    
    // In IqGuessr mode, don't add loading badges - processTweet will create guess badges directly
    // This prevents the double badge issue (loading badge + guess badge)
    if (settings.showIQBadge && addLoadingBadgeToTweet && !isGameModeEnabled) {
      // Performance optimization: Batch badge insertions using DocumentFragment
      // Save scroll position before inserting any badges
      const scrollBeforeBadges = window.scrollY;

      // Pre-filter tweets that need badges (reduce DOM queries)
      const badgesToInsert = [];
      const nestedTweetCache = new WeakMap(); // Cache nested tweet lookups
      
      for (const tweet of newTweets) {
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
        
        // CRITICAL: Check for ANY existing badge (including guess badges) before adding loading badge
        // This prevents adding loading badges when guess badges already exist
        const existingBadge = actualTweet.querySelector('.iq-badge') ||
                              (tweet !== actualTweet ? tweet.querySelector('.iq-badge') : null);
        if (existingBadge) {
          // Badge already exists - skip adding loading badge
          continue;
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

