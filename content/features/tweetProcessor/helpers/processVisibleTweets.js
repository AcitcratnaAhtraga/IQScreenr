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
   *
   * @param {Set} processedTweets - Set of processed tweets
   */
  function processVisibleTweets(processedTweets) {
    const settings = getSettings();
    const { addLoadingBadgeToTweet } = getLoadingBadgeManager();
    const { processTweet } = getTweetProcessor();
    const isNotificationsPage = window.location.href.includes('/notifications');

    const tweetSelectors = [
      'article[data-testid="tweet"]',
      'article[role="article"]',
      'div[data-testid="cellInnerDiv"] > article'
    ];

    let tweets = [];
    for (const selector of tweetSelectors) {
      tweets = document.querySelectorAll(selector);
      if (tweets.length > 0) break;
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
      // Batch badge insertions to prevent scroll jumping
      // Save scroll position before inserting any badges
      const scrollBeforeBadges = window.scrollY;

      // Insert all badges synchronously to minimize layout shifts
      const badgesToInsert = [];
      newTweets.forEach((tweet) => {
        // Only add badge if tweet doesn't already have one and isn't already analyzed
        if (!tweet.querySelector('.iq-badge')) {
          let actualTweet = tweet;
          const nestedTweet = tweet.querySelector('article[data-testid="tweet"]') ||
                              tweet.querySelector('article[role="article"]');
          if (nestedTweet && nestedTweet !== tweet) {
            actualTweet = nestedTweet;
          }
          // Don't add badge if tweet is already analyzed (shouldn't happen, but be safe)
          if (!actualTweet.hasAttribute('data-iq-analyzed')) {
            badgesToInsert.push(tweet);
          }
        }
      });

      // Insert all badges at once (but skip removed/muted tweets)
      badgesToInsert.forEach((tweet) => {
        // Double-check that tweet wasn't removed/muted before adding badge
        if (!shouldSkipTweet || !shouldSkipTweet(tweet)) {
          addLoadingBadgeToTweet(tweet);
        }
      });

      // Restore scroll position after all badges are inserted
      if (badgesToInsert.length > 0) {
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

    if (processTweet) {
      setTimeout(() => {
        newTweets.forEach((tweet) => {
          processTweet(tweet);
        });
      }, 0);
    }
  }

  // Export
  if (typeof window !== 'undefined') {
    window.ProcessVisibleTweets = {
      processVisibleTweets
    };
  }
})();

