/**
 * Tweet Observer
 * Sets up MutationObserver to watch for new tweets and process them
 */

(function() {
  'use strict';

  const getLoadingBadgeManager = () => window.LoadingBadgeManager || {};
  const getTweetProcessor = () => window.TweetProcessor || {};
  const getBadgeCleanup = () => window.BadgeCleanup || {};
  const getFollowNotificationFilter = () => window.FollowNotificationFilter || {};

  /**
   * Check if a tweet element is a Community Note notification
   * Community Notes notifications contain text like "Community Note" or "Readers added a Community Note"
   */
  function isCommunityNoteNotification(tweetElement) {
    if (!tweetElement) return false;

    // Get all text elements in the notification
    const allSpans = Array.from(tweetElement.querySelectorAll('span'));
    const allDivs = Array.from(tweetElement.querySelectorAll('div'));

    // Check for Community Note notification text
    const communityNoteText = [...allSpans, ...allDivs].find(element => {
      const text = (element.textContent || '').toLowerCase();
      return text.includes('community note') ||
             text.includes('readers added a community note') ||
             (text.includes('community') && text.includes('note'));
    });

    return !!communityNoteText;
  }

  /**
   * Setup MutationObserver to watch for new tweets
   * PERFORMANCE OPTIMIZED: Debounced callbacks, batched processing, early filtering
   *
   * @param {Set} processedTweets - Set of processed tweets
   * @returns {MutationObserver} - The observer instance
   */
  function setupObserver(processedTweets) {
    const isNotificationsPage = window.location.href.includes('/notifications');
    const { checkForStuckBadges } = getBadgeCleanup();
    const { addLoadingBadgeToTweet } = getLoadingBadgeManager();
    const { processVisibleTweets } = getTweetProcessor();
    const { isFollowNotification } = getFollowNotificationFilter();

    // Setup periodic check for stuck badges on notifications page
    if (isNotificationsPage && checkForStuckBadges) {
      // Check more aggressively on initial load - immediately, then frequently
      // This fixes the issue where badges get stuck on first page load
      checkForStuckBadges(processedTweets); // Run immediately
      setTimeout(() => checkForStuckBadges(processedTweets), 500); // Check after 500ms
      setTimeout(() => checkForStuckBadges(processedTweets), 1000); // Check after 1s
      setTimeout(() => checkForStuckBadges(processedTweets), 1500); // Check after 1.5s
      setTimeout(() => checkForStuckBadges(processedTweets), 2500); // Check after 2.5s
      setTimeout(() => checkForStuckBadges(processedTweets), 3500); // Check after 3.5s
      // Then check every 2 seconds thereafter (more frequent)
      setInterval(() => checkForStuckBadges(processedTweets), 2000);
    }

    // Performance optimization: Debounce and batch processing
    let pendingTweets = new Set();
    let processingTimeout = null;
    let rafScheduled = false;

    const processPendingTweets = () => {
      if (pendingTweets.size === 0) {
        rafScheduled = false;
        return;
      }

      const tweetsToProcess = Array.from(pendingTweets);
      pendingTweets.clear();
      rafScheduled = false;

      // Use requestIdleCallback for non-critical processing if available
      const scheduleProcessing = (callback) => {
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(callback, { timeout: 100 });
        } else {
          requestAnimationFrame(callback);
        }
      };

      scheduleProcessing(() => {
        // Check if IqFiltr is available to skip removed/muted tweets
        const getIqFiltr = () => window.IqFiltr || {};
        const { shouldSkipTweet } = getIqFiltr();
        const isNotificationsPageCheck = window.location.href.includes('/notifications');

        const validTweets = [];
        for (const tweet of tweetsToProcess) {
          // Early filtering - skip if already processed
          if (tweet.hasAttribute('data-iq-analyzed') ||
              tweet.hasAttribute('data-iq-processing') ||
              tweet.querySelector('.iq-badge')) {
            continue;
          }

          // Skip tweets that were previously removed or muted
          if (shouldSkipTweet && shouldSkipTweet(tweet)) {
            continue;
          }

          // Skip follow notifications
          if (isNotificationsPageCheck && isFollowNotification && isFollowNotification(tweet)) {
            const hasTweetContent = tweet.querySelector('div[data-testid="tweetText"]') ||
                                    tweet.querySelector('div[lang]');
            if (!hasTweetContent) {
              continue; // Skip follow notifications
            }
          }

          // Skip Community Notes notifications
          if (isNotificationsPageCheck && isCommunityNoteNotification(tweet)) {
            continue; // Skip Community Notes notifications
          }

          validTweets.push(tweet);
        }

        // Batch badge insertions
        if (validTweets.length > 0 && addLoadingBadgeToTweet) {
          validTweets.forEach((tweet) => {
            addLoadingBadgeToTweet(tweet);
          });
        }

        // Process visible tweets (batched)
        if (validTweets.length > 0 && processVisibleTweets) {
          processVisibleTweets();
        }
      });
    };

    const observer = new MutationObserver((mutations) => {
      // Performance optimization: Early exit if no relevant mutations
      let hasArticleNodes = false;
      for (let i = 0; i < mutations.length && !hasArticleNodes; i++) {
        const mutation = mutations[i];
        if (mutation.addedNodes.length === 0) continue;
        
        for (let j = 0; j < mutation.addedNodes.length; j++) {
          const node = mutation.addedNodes[j];
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === 'ARTICLE' || (node.querySelector && node.querySelector('article'))) {
              hasArticleNodes = true;
              break;
            }
          }
        }
      }

      if (!hasArticleNodes) return;

      // Collect potential tweets efficiently
      const potentialTweets = [];
      for (let i = 0; i < mutations.length; i++) {
        const mutation = mutations[i];
        for (let j = 0; j < mutation.addedNodes.length; j++) {
          const node = mutation.addedNodes[j];
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === 'ARTICLE') {
              potentialTweets.push(node);
            } else if (node.querySelector) {
              // Use querySelector for first match instead of querySelectorAll when possible
              const firstArticle = node.querySelector('article');
              if (firstArticle) {
                potentialTweets.push(firstArticle);
                // Only query all if we need more (rare case)
                const allArticles = node.querySelectorAll('article');
                if (allArticles.length > 1) {
                  for (let k = 1; k < allArticles.length; k++) {
                    potentialTweets.push(allArticles[k]);
                  }
                }
              }
            }
          }
        }
      }

      if (potentialTweets.length > 0) {
        // Add to pending set (deduplicates automatically)
        potentialTweets.forEach(tweet => pendingTweets.add(tweet));

        // Debounce processing - clear existing timeout
        if (processingTimeout) {
          clearTimeout(processingTimeout);
        }

        // Schedule processing with debouncing
        processingTimeout = setTimeout(() => {
          processingTimeout = null;
          if (!rafScheduled) {
            rafScheduled = true;
            requestAnimationFrame(processPendingTweets);
          }
        }, 16); // ~60fps debounce
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return observer;
  }

  // Export
  if (typeof window !== 'undefined') {
    window.TweetObserver = {
      setupObserver
    };
  }
})();

