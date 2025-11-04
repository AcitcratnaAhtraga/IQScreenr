/**
 * Badge Cleanup
 * Handles checking for and cleaning up stuck badges
 */

(function() {
  'use strict';

  const getTweetProcessor = () => window.TweetProcessor || {};

  /**
   * Check for and reprocess stuck loading badges (safety net for notifications page)
   *
   * @param {Set} processedTweets - Set of processed tweets
   */
  function checkForStuckBadges(processedTweets) {
    const isNotificationsPage = window.location.href.includes('/notifications');
    if (!isNotificationsPage) return;

    const loadingBadges = document.querySelectorAll('.iq-badge[data-iq-loading="true"], .iq-badge-loading');
    const stuckBadges = Array.from(loadingBadges).filter(badge => {
      // Check if badge has been loading (has no score)
      const hasScore = badge.hasAttribute('data-iq-score');
      const hasInvalid = badge.hasAttribute('data-iq-invalid');
      const isReallyStuck = !hasScore && !hasInvalid;

      // Check if badge is stuck and has a parent (meaning it's in the DOM)
      // We don't need to wait 5 seconds - if it's stuck, reprocess it
      if (isReallyStuck && badge.parentElement) {
        const tweetElement = badge.closest('article[data-testid="tweet"]') ||
                            badge.closest('article[role="article"]') ||
                            badge.closest('article');
        if (tweetElement) {
          // Check if tweet is marked as processing - if so, it might still be processing
          // But if it's been more than 3 seconds, force reprocess
          const isProcessing = tweetElement.hasAttribute('data-iq-processing');
          const isAnalyzed = tweetElement.hasAttribute('data-iq-analyzed');

          // If it's marked as analyzed but still has a loading badge, it's stuck
          // If it's processing for too long (we'll check time via a data attribute)
          if (isAnalyzed || (!isProcessing && !isAnalyzed)) {
            return true;
          }

          // If it's processing, check if it's been stuck in processing state
          // Use a timestamp attribute to track when processing started
          if (isProcessing) {
            const processingStart = tweetElement.getAttribute('data-iq-processing-start');
            if (!processingStart) {
              // Mark when processing started
              tweetElement.setAttribute('data-iq-processing-start', Date.now().toString());
              return false; // Give it time to process
            } else {
              const processingTime = Date.now() - parseInt(processingStart, 10);
              // If processing for more than 5 seconds, it's stuck
              if (processingTime > 5000) {
                return true;
              }
            }
          }
        }
      }
      return false;
    });

    if (stuckBadges.length > 0) {
      const { processTweet } = getTweetProcessor();
      if (!processTweet) return;

      stuckBadges.forEach(badge => {
        const tweetElement = badge.closest('article[data-testid="tweet"]') ||
                            badge.closest('article[role="article"]') ||
                            badge.closest('article');
        if (tweetElement) {
          // Remove the stuck badge and mark tweet for reprocessing
          if (tweetElement.hasAttribute('data-iq-analyzed')) {
            tweetElement.removeAttribute('data-iq-analyzed');
            if (processedTweets && processedTweets.delete) {
              processedTweets.delete(tweetElement);
            }
          }
          tweetElement.removeAttribute('data-iq-processing');
          tweetElement.removeAttribute('data-iq-processing-start');
          if (badge.parentElement) {
            badge.remove();
          }
          // Reprocess after a short delay to give DOM time to settle
          setTimeout(() => {
            processTweet(tweetElement);
          }, 200);
        }
      });
    }
  }

  // Export
  if (typeof window !== 'undefined') {
    window.BadgeCleanup = {
      checkForStuckBadges
    };
  }
})();

