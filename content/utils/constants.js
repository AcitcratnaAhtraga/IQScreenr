/**
 * Constants and Configuration
 * Centralized location for all magic numbers and configuration values
 */

(function() {
  'use strict';

  const CONSTANTS = {
    // Cache settings
    CACHE: {
      MAX_SIZE: 1000,
      EXPIRY_MS: 30000, // 30 seconds
      PRUNE_THRESHOLD: 0.9, // Prune at 90% capacity
      PRUNE_PERCENTAGE: 0.2 // Remove 20% when pruning
    },
    
    // DOM Cache settings
    DOM_CACHE: {
      MAX_SIZE: 500,
      EXPIRY_MS: 30000, // 30 seconds
      CLEANUP_INTERVAL_MS: 10000 // Cleanup every 10 seconds
    },
    
    // Timer intervals
    TIMERS: {
      BADGE_CLEANUP_INTERVAL: 2000, // 2 seconds
      STUCK_BADGE_CHECK: 3000, // 3 seconds
      PROCESSING_TIMEOUT: 1500, // 1.5 seconds
      REPROCESS_DELAY: 200, // 200ms
      SETTINGS_APPLY_DELAY: 100, // 100ms
      DOM_READY_DELAY: 50, // 50ms
      ANIMATION_DELAY: 100, // 100ms
      DEBUG_LOG_COOLDOWN: 500, // 500ms
      TOOLTIP_DELAY: 200, // 200ms
      SCROLL_DEBOUNCE: 100 // 100ms
    },
    
    // IQ estimation settings
    IQ: {
      MIN: 60,
      MAX: 145,
      DEFAULT_MIN: 60,
      DEFAULT_MAX: 145
    },
    
    // Badge settings
    BADGE: {
      CREATED_AT_ATTRIBUTE: 'data-created-at',
      PROCESSING_START_ATTRIBUTE: 'data-iq-processing-start',
      TWEET_ID_ATTRIBUTE: 'data-tweet-id',
      HANDLE_ATTRIBUTE: 'data-handle'
    },
    
    // Selectors (commonly used)
    SELECTORS: {
      TWEET: 'article[data-testid="tweet"], article[role="article"]',
      TWEET_BY_TESTID: 'article[data-testid="tweet"]',
      TWEET_BY_ROLE: 'article[role="article"]',
      ENGAGEMENT_BAR: '[role="group"]',
      TWEET_TEXT: '[data-testid="tweetText"]',
      IQ_BADGE: '.iq-badge',
      LOADING_BADGE: '.iq-badge-loading, [data-iq-loading="true"]',
      GUESS_BADGE: '.iq-badge-guess, [data-iq-guess="true"]',
      CALCULATED_BADGE: '.iq-badge-flip, .iq-badge[data-iq-score]'
    },
    
    // Storage keys
    STORAGE: {
      PREFIX: {
        IQ_CACHE: 'iq_cache_',
        GUESS: 'iq_guess_',
        REVEALED: 'iq_revealed_',
        REVEALED_IQ: 'iq_revealed_iq_'
      },
      KEYS: {
        SHOW_IQ_BADGE: 'showIQBadge',
        SHOW_REALTIME_BADGE: 'showRealtimeBadge',
        USE_CONFIDENCE_FOR_COLOR: 'useConfidenceForColor',
        ENABLE_DEBUG_LOGGING: 'enableDebugLogging',
        ENABLE_IQ_GUESSR: 'enableIQGuessr',
        SHOW_PROFILE_SCORE_BADGE: 'showProfileScoreBadge',
        SHOW_AVERAGE_IQ: 'showAverageIQ',
        IQ_GUESSR_SCORE: 'iqGuessrScore',
        ENABLE_IQ_FILTR: 'enableIqFiltr',
        FILTER_IQ_THRESHOLD: 'filterIQThreshold',
        FILTER_DIRECTION: 'filterDirection',
        FILTER_CONFIDENCE_THRESHOLD: 'filterConfidenceThreshold',
        FILTER_CONFIDENCE_DIRECTION: 'filterConfidenceDirection',
        USE_IQ_IN_FILTER: 'useIQInFilter',
        USE_CONFIDENCE_IN_FILTER: 'useConfidenceInFilter',
        FILTER_INVALID_TWEETS: 'filterInvalidTweets',
        FILTER_USER_POSTS: 'filterUserPosts',
        FILTER_MODE: 'filterMode',
        MIN_IQ: 'minIQ',
        MAX_IQ: 'maxIQ',
        USER_AVERAGE_IQ: 'userAverageIQ',
        IQ_GUESSR_HISTORY: 'iqGuessrHistory'
      }
    },
    
    // Batch processing
    BATCH: {
      CACHE_LOAD_SIZE: 50,
      STORAGE_WRITE_DEBOUNCE: 100 // 100ms
    },
    
    // Request idle callback timeout
    IDLE_CALLBACK: {
      TIMEOUT: 200, // 200ms
      CACHE_LOAD_TIMEOUT: 500, // 500ms
      DEBUG_TIMEOUT: 1000 // 1000ms
    }
  };

  // Export for use in other modules
  if (typeof window !== 'undefined') {
    window.Constants = CONSTANTS;
  }
})();

