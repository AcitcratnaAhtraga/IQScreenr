/**
 * IQGuessr Browser Extension - Main Content Script
 *
 * This is the orchestrator that coordinates all modules:
 * - Core: dependencyParser, iqEstimator
 * - Utils: cache, domHelpers, textExtraction, tweetDetection
 * - Features: settings, badge, tweetProcessor, realtime
 *
 * All modules are loaded via manifest.json in the correct order.
 */

(function() {
  'use strict';

  // Get module references (all modules expose themselves via window global objects)
  const getSettings = () => window.Settings || {};
  const getTweetProcessor = () => window.TweetProcessor || {};
  const getRealtimeManager = () => window.RealtimeManager || {};

  /**
   * Initialize the extension
   */
  function init() {
    const tweetProcessor = getTweetProcessor();
    const realtimeManager = getRealtimeManager();

    if (!tweetProcessor || !tweetProcessor.processVisibleTweets || !tweetProcessor.setupObserver) {
      console.error('TweetProcessor not available');
      setTimeout(init, 100); // Retry after modules load
      return;
    }

    if (!realtimeManager || !realtimeManager.setupRealtimeComposeObserver) {
      console.error('RealtimeManager not available');
      setTimeout(init, 100); // Retry after modules load
      return;
    }

    const { processVisibleTweets, setupObserver } = tweetProcessor;
    const { setupRealtimeComposeObserver } = realtimeManager;

    // Process existing tweets immediately to show loading badges as fast as possible
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        // Process immediately - badges should appear as soon as page loads
        processVisibleTweets();
        setupObserver();
        setupRealtimeComposeObserver();
      });
    } else {
      // Page already loaded - process immediately
      processVisibleTweets();
      setupObserver();
      setupRealtimeComposeObserver();
    }

    // Also process on scroll (for lazy-loaded content) - with minimal delay
    let scrollTimeout;
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        processVisibleTweets();
      }, 100);
    });
  }

  // Wait a moment for all modules to load, then start
  // Modules are loaded synchronously via manifest, but we give a small delay
  // to ensure all window.* global objects are set up
  setTimeout(() => {
    init();
  }, 100);
})();
