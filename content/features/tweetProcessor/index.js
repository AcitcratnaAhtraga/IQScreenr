/**
 * Tweet Processor - Main Entry Point
 * Orchestrates all tweet processing modules
 */

(function() {
  'use strict';

  // Local state (shared across modules)
  const processedTweets = new Set();

  // Get module references
  const getTweetProcessorCore = () => window.TweetProcessorCore || {};
  const getLoadingBadgeManager = () => window.LoadingBadgeManager || {};
  const getTweetObserver = () => window.TweetObserver || {};
  const getProcessVisibleTweets = () => window.ProcessVisibleTweets || {};

  // Wait for all modules to be loaded
  function initialize() {
    const processTweet = getTweetProcessorCore().processTweet;
    const processVisibleTweets = getProcessVisibleTweets().processVisibleTweets;
    const addLoadingBadgeToTweet = getLoadingBadgeManager().addLoadingBadgeToTweet;
    const setupObserver = getTweetObserver().setupObserver;

    if (!processTweet || !processVisibleTweets || !addLoadingBadgeToTweet || !setupObserver) {
      // Modules not loaded yet, retry
      setTimeout(initialize, 100);
      return;
    }

    // Wrap processVisibleTweets to pass processedTweets
    const wrappedProcessVisibleTweets = () => {
      if (processVisibleTweets) {
        processVisibleTweets(processedTweets);
      }
    };

    // Periodic cleanup: Remove loading badges when guess badges exist (prevents double badges)
    function cleanupDoubleBadges() {
      const getGameManager = () => window.GameManager || {};
      const gameManager = getGameManager();
      const isGameModeEnabled = gameManager && gameManager.isGameModeEnabled && gameManager.isGameModeEnabled();
      
      if (!isGameModeEnabled) {
        return; // Only cleanup in IqGuessr mode
      }
      
      // Find all tweets with badges
      const tweets = document.querySelectorAll('article[data-testid="tweet"], article[role="article"]');
      
      tweets.forEach(tweet => {
        const allBadges = tweet.querySelectorAll('.iq-badge');
        if (allBadges.length <= 1) {
          return; // No duplicates
        }
        
        const guessBadges = Array.from(allBadges).filter(badge => 
          badge.classList.contains('iq-badge-guess') || 
          badge.hasAttribute('data-iq-guess')
        );
        
        if (guessBadges.length > 0) {
          // Remove all loading badges when guess badges exist
          allBadges.forEach(badge => {
            if ((badge.classList.contains('iq-badge-loading') || badge.hasAttribute('data-iq-loading')) &&
                !guessBadges.includes(badge)) {
              if (badge.parentElement) {
                badge.remove();
              }
            }
          });
        }
      });
    }
    
    // Run cleanup periodically (every 2 seconds) to catch any double badges
    setInterval(cleanupDoubleBadges, 2000);

    // Export for use in other modules
    if (typeof window !== 'undefined') {
      window.TweetProcessor = {
        processTweet,
        processVisibleTweets: wrappedProcessVisibleTweets,
        addLoadingBadgeToTweet,
        setupObserver: () => setupObserver(processedTweets),
        processedTweets,
        cleanupDoubleBadges
      };
    }
  }

  // Start initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();

