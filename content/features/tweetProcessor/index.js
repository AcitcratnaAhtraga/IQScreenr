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

    // Export for use in other modules
    if (typeof window !== 'undefined') {
      window.TweetProcessor = {
        processTweet,
        processVisibleTweets: wrappedProcessVisibleTweets,
        addLoadingBadgeToTweet,
        setupObserver: () => setupObserver(processedTweets),
        processedTweets
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

