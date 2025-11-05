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
      setTimeout(() => checkForStuckBadges(processedTweets), 1500); // Check after 1.5s
      setTimeout(() => checkForStuckBadges(processedTweets), 3000); // Check after 3s
      // Then check every 3 seconds thereafter
      setInterval(() => checkForStuckBadges(processedTweets), 3000);
    }

    const observer = new MutationObserver((mutations) => {
      const potentialTweets = [];
      const isNotificationsPageCheck = window.location.href.includes('/notifications');

      for (let i = 0; i < mutations.length; i++) {
        const mutation = mutations[i];
        for (let j = 0; j < mutation.addedNodes.length; j++) {
          const node = mutation.addedNodes[j];
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === 'ARTICLE') {
              potentialTweets.push(node);
            }
            if (node.querySelector) {
              const articles = node.querySelectorAll('article');
              if (articles.length > 0) {
                for (let k = 0; k < articles.length; k++) {
                  potentialTweets.push(articles[k]);
                }
              }
            }
          }
        }
      }

      if (potentialTweets.length > 0) {
        setTimeout(() => {
          potentialTweets.forEach((tweet) => {
            if (tweet.hasAttribute('data-iq-analyzed') ||
                tweet.hasAttribute('data-iq-processing') ||
                tweet.querySelector('.iq-badge')) {
              return;
            }

            // Skip follow notifications
            if (isNotificationsPageCheck && isFollowNotification && isFollowNotification(tweet)) {
              const hasTweetContent = tweet.querySelector('div[data-testid="tweetText"]') ||
                                      tweet.querySelector('div[lang]');
              if (!hasTweetContent) {
                return; // Skip follow notifications
              }
            }

            // Skip Community Notes notifications
            if (isNotificationsPageCheck && isCommunityNoteNotification(tweet)) {
              return; // Skip Community Notes notifications
            }

            if (addLoadingBadgeToTweet) {
              addLoadingBadgeToTweet(tweet);
            }
          });
        }, 0);
      }

      if (potentialTweets.length > 0 && processVisibleTweets) {
        setTimeout(() => {
          processVisibleTweets();
        }, 0);
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

