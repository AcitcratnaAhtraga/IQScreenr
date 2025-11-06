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
  const getBadgeManager = () => window.BadgeManager || {};
  const getGameManager = () => window.GameManager || {};
  const getDebugLog = () => window.DOMHelpers?.debugLog || (() => {});
  const debugLog = getDebugLog();

  /**
   * Apply settings changes immediately
   */
  async function applySettingsChanges(changes) {
    const settings = getSettings();
    const tweetProcessor = getTweetProcessor();
    const realtimeManager = getRealtimeManager();
    const badgeManager = getBadgeManager();

    // Handle showIQBadge changes
    if (changes.showIQBadge !== undefined) {
      const showBadges = changes.showIQBadge.newValue;
      const allBadges = document.querySelectorAll('.iq-badge:not(.iq-badge-realtime)');

      if (showBadges) {
        // Show all badges
        allBadges.forEach(badge => {
          badge.style.setProperty('display', 'inline-flex', 'important');
          badge.style.setProperty('visibility', 'visible', 'important');
          badge.style.setProperty('opacity', '1', 'important');
        });
        // Don't reprocess - let observer handle new tweets
      } else {
        // Hide all badges
        allBadges.forEach(badge => {
          badge.style.setProperty('display', 'none', 'important');
          badge.style.setProperty('visibility', 'hidden', 'important');
        });
      }
    }

    // Handle showRealtimeBadge changes
    if (changes.showRealtimeBadge !== undefined) {
      const showRealtime = changes.showRealtimeBadge.newValue;
      const realtimeBadges = document.querySelectorAll('.iq-badge-realtime');

      if (showRealtime && settings.showIQBadge) {
        // Only show realtime badges that have text (updateRealtimeBadge handles showing/hiding based on text)
        // Don't force display - let updateRealtimeBadge control visibility based on whether user has typed
        realtimeBadges.forEach(badge => {
          // Check if badge has text by checking if it has an IQ score or is showing X
          const hasScore = badge.hasAttribute('data-iq-score');
          const scoreElement = badge.querySelector('.iq-score');
          const hasText = hasScore || (scoreElement && scoreElement.textContent && scoreElement.textContent.trim() !== '');

          // Only show if badge indicates user has typed (has score or shows X)
          if (hasText) {
            badge.style.setProperty('display', 'inline-flex', 'important');
            badge.style.setProperty('visibility', 'visible', 'important');
            badge.style.setProperty('opacity', '1', 'important');
          } else {
            // Hide if no text has been typed yet
            badge.style.setProperty('display', 'none', 'important');
          }
        });
        // Restart realtime monitoring if needed
        if (realtimeManager && realtimeManager.setupRealtimeComposeObserver) {
          realtimeManager.setupRealtimeComposeObserver();
        }
      } else {
        // Hide all realtime badges
        realtimeBadges.forEach(badge => {
          badge.remove();
        });
      }
    }

    // If showIQBadge is disabled, also hide realtime badges
    if (changes.showIQBadge !== undefined && !changes.showIQBadge.newValue) {
      const realtimeBadges = document.querySelectorAll('.iq-badge-realtime');
      realtimeBadges.forEach(badge => {
        badge.remove();
      });
    }

    // Handle useConfidenceForColor changes - update existing badge colors
    if (changes.useConfidenceForColor !== undefined) {
      const useConfidence = changes.useConfidenceForColor.newValue;
      const { getIQColor, getConfidenceColor } = badgeManager;

      if (getIQColor && getConfidenceColor) {
        const allBadges = document.querySelectorAll('.iq-badge:not(.iq-badge-loading):not(.iq-badge-invalid)');
        allBadges.forEach(badge => {
          const iqScore = badge.getAttribute('data-iq-score');
          const confidence = badge.getAttribute('data-confidence');

          if (iqScore && !isNaN(parseInt(iqScore, 10))) {
            const iq = parseInt(iqScore, 10);
            const newColor = useConfidence && confidence
              ? getConfidenceColor(parseInt(confidence, 10))
              : getIQColor(iq);
            // Use CSS variable instead of inline style - CSS handles styling
            badge.style.setProperty('--iq-badge-bg-color', newColor);
            if (badge.classList.contains('iq-badge-flip')) {
              badge.style.setProperty('--iq-badge-original-bg', newColor, 'important');
            }
          }
        });
      }
    }

    // Handle IQ filter settings changes - apply filter immediately
    const filterSettings = [
      'enableIQFilter',
      'filterTweets',
      'filterReplies',
      'filterQuotedPosts',
      'filterIQThreshold',
      'filterDirection',
      'filterConfidenceThreshold',
      'filterConfidenceDirection',
      'useConfidenceInFilter',
      'filterMode'
    ];

    const hasFilterChange = filterSettings.some(setting => changes[setting] !== undefined);
    if (hasFilterChange) {
      const getIQFilter = () => window.IQFilter || {};
      const { applyFilterToVisibleTweets, revealAllMutedTweets } = getIQFilter();

      // If filter is being disabled, reveal all muted tweets
      if (changes.enableIQFilter && !changes.enableIQFilter.newValue) {
        if (revealAllMutedTweets) {
          revealAllMutedTweets();
        }
      } else if (applyFilterToVisibleTweets) {
        // Apply filter immediately when settings change
        // Use setTimeout to ensure settings are updated first
        setTimeout(() => {
          applyFilterToVisibleTweets();
        }, 100);
      }

      // If filter mode changed from 'mute' to 'remove', remove all currently muted tweets that match filter
      if (changes.filterMode && changes.filterMode.oldValue === 'mute' && changes.filterMode.newValue === 'remove') {
        if (applyFilterToVisibleTweets) {
          setTimeout(() => {
            applyFilterToVisibleTweets();
          }, 150);
        }
      }
    }

    // Handle minIQ/maxIQ changes - hide/show badges based on range
    if (changes.minIQ !== undefined || changes.maxIQ !== undefined) {
      const minIQ = settings.minIQ || 60;
      const maxIQ = settings.maxIQ || 145;
      const allBadges = document.querySelectorAll('.iq-badge:not(.iq-badge-loading):not(.iq-badge-invalid)');

      allBadges.forEach(badge => {
        const iqScore = badge.getAttribute('data-iq-score');
        if (iqScore && !isNaN(parseInt(iqScore, 10))) {
          const iq = parseInt(iqScore, 10);
          if (iq < minIQ || iq > maxIQ) {
            badge.style.setProperty('display', 'none', 'important');
          } else {
            // Only show if showIQBadge is enabled
            if (settings.showIQBadge) {
              badge.style.setProperty('display', 'inline-flex', 'important');
              badge.style.setProperty('visibility', 'visible', 'important');
            }
          }
        }
      });
    }

    // Handle enableIQGuessr changes - convert badges between loading and guess modes
    if (changes.enableIQGuessr !== undefined) {
      const gameModeEnabled = changes.enableIQGuessr.newValue;
      const gameManager = getGameManager();
      const badgeManager = getBadgeManager();


      if (!gameModeEnabled && badgeManager && badgeManager.createLoadingBadge) {
        // Game mode disabled: convert guess badges back to loading badges
        const guessBadges = document.querySelectorAll('.iq-badge-guess, [data-iq-guess="true"]');
        guessBadges.forEach(guessBadge => {
          // Only convert badges that haven't been guessed yet
          if (!guessBadge.hasAttribute('data-iq-guessed') && !guessBadge.hasAttribute('data-iq-calculating')) {
            // Find the tweet element containing this badge
            const tweetElement = guessBadge.closest('article[data-testid="tweet"]') ||
                                guessBadge.closest('article[role="article"]') ||
                                guessBadge.closest('article');

            const tweetId = tweetElement?.getAttribute('data-tweet-id');

            const loadingBadge = badgeManager.createLoadingBadge();
            if (guessBadge.parentElement) {
              guessBadge.parentElement.insertBefore(loadingBadge, guessBadge);
              guessBadge.remove();
            }

            // Mark the tweet for reprocessing if it exists
            if (tweetElement) {
              tweetElement.removeAttribute('data-iq-analyzed');
              tweetElement.removeAttribute('data-iq-processing');
              tweetElement.removeAttribute('data-iq-processing-start');

              // Remove from processed tweets Set to allow reprocessing
              const tweetProcessorModule = getTweetProcessor();
              if (tweetProcessorModule && tweetProcessorModule.processedTweets) {
                tweetProcessorModule.processedTweets.delete(tweetElement);
              }
            }
          }
        });

        // Reprocess visible tweets to trigger IQ calculations for converted badges
        if (tweetProcessor && tweetProcessor.processVisibleTweets) {
          setTimeout(() => {
            tweetProcessor.processVisibleTweets();
          }, 100);
        }
      } else if (gameModeEnabled && gameManager && gameManager.replaceLoadingBadgeWithGuess && settings.showIQBadge) {
        // Game mode enabled: convert loading badges to guess badges
        // BUT: don't convert badges that are already calculated (they should stay calculated)
        const loadingBadges = document.querySelectorAll('.iq-badge-loading, [data-iq-loading="true"]');
        const calculatedBadges = document.querySelectorAll('.iq-badge[data-iq-score]:not([data-iq-guess]):not([data-iq-loading="true"])');

        // First, clean up duplicate badges for each tweet
        const processedTweetsForDupes = new Set();
        for (const loadingBadge of loadingBadges) {
          const tweetElement = loadingBadge.closest('article[data-testid="tweet"]') ||
                              loadingBadge.closest('article[role="article"]') ||
                              loadingBadge.closest('article');
          if (tweetElement && !processedTweetsForDupes.has(tweetElement)) {
            processedTweetsForDupes.add(tweetElement);
            // Find nested tweet if it exists
            const nestedTweet = tweetElement.querySelector('article[data-testid="tweet"]') ||
                               tweetElement.querySelector('article[role="article"]');
            const actualTweetElement = nestedTweet && nestedTweet !== tweetElement ? nestedTweet : tweetElement;

            // Find all badges in this tweet
            const allBadges = [
              ...actualTweetElement.querySelectorAll('.iq-badge'),
              ...(nestedTweet && nestedTweet !== tweetElement ? tweetElement.querySelectorAll('.iq-badge') : [])
            ];

            // Remove duplicates (keep the first one)
            if (allBadges.length > 1) {
              for (let i = 1; i < allBadges.length; i++) {
                if (allBadges[i].parentElement) {
                  allBadges[i].remove();
                }
              }
            }
          }
        }

        // Get loading badges again after cleanup (in case some were removed)
        const loadingBadgesAfterCleanup = document.querySelectorAll('.iq-badge-loading, [data-iq-loading="true"]');
        for (const loadingBadge of loadingBadgesAfterCleanup) {
          // Only convert badges that are still loading (not yet calculated)
          if (loadingBadge.hasAttribute('data-iq-loading') || loadingBadge.classList.contains('iq-badge-loading')) {
            const tweetElement = loadingBadge.closest('article[data-testid="tweet"]') ||
                                loadingBadge.closest('article[role="article"]') ||
                                loadingBadge.closest('article');
            const tweetId = tweetElement?.getAttribute('data-tweet-id');

            await gameManager.replaceLoadingBadgeWithGuess(loadingBadge);

            // replaceLoadingBadgeWithGuess handles the replacement, so we don't need to do anything else
          }
        }

        // Check calculated badges - if they have cached guesses, they should stay as calculated
        // (They're already calculated, so no action needed - just log it)
        for (const calculatedBadge of calculatedBadges) {
          const tweetElement = calculatedBadge.closest('article[data-testid="tweet"]') ||
                              calculatedBadge.closest('article[role="article"]') ||
                              calculatedBadge.closest('article');
          if (tweetElement) {
            const tweetId = tweetElement.getAttribute('data-tweet-id');
            if (tweetId) {
              const cachedGuess = await gameManager.getCachedGuess(tweetId);
              if (cachedGuess && cachedGuess.guess !== undefined) {
              } else {
              }
            }
          }
        }

        // No need to reprocess - conversion handles all visible badges
        // Reprocessing would only create duplicates for tweets that already have calculated badges
      }
    }
  }

  /**
   * Attach click handlers to existing badges to prevent navigation
   */
  function attachBadgeClickHandlers() {
    const badges = document.querySelectorAll('.iq-badge:not(.iq-badge-realtime)');
    badges.forEach(badge => {
      // Skip if handler already attached
      if (badge.hasAttribute('data-click-handler-attached')) {
        return;
      }

      // Skip guess badges - they already have their own handlers
      const isGuessBadge = badge.classList.contains('iq-badge-guess') || badge.hasAttribute('data-iq-guess');
      if (isGuessBadge) {
        return;
      }

      // Skip average IQ badges - they use CSS-only hover effects
      const isAverageBadge = badge.classList.contains('iq-badge-average') || badge.hasAttribute('data-iq-average');
      if (isAverageBadge) {
        return;
      }

      badge.setAttribute('data-click-handler-attached', 'true');

      const handleBadgeInteraction = (e) => {
        // Prevent navigation to tweet URL
        e.preventDefault();
        e.stopPropagation();

        // Only handle flip animation for badges with confidence data
        if (badge.classList.contains('iq-badge-flip')) {
          const inner = badge.querySelector('.iq-badge-inner');
          if (inner) {
            const currentTransform = window.getComputedStyle(inner).transform;
            const isFlipped = currentTransform && currentTransform !== 'none' && currentTransform.includes('180deg');

            // Toggle flip state
            if (isFlipped) {
              inner.style.setProperty('transform', 'rotateY(0deg)', 'important');
            } else {
              inner.style.setProperty('transform', 'rotateY(180deg)', 'important');
            }

            // Auto-flip back after 2 seconds on mobile
            setTimeout(() => {
              if (inner.style.transform.includes('180deg')) {
                inner.style.setProperty('transform', 'rotateY(0deg)', 'important');
              }
            }, 2000);
          }
        }
      };

      // Add both click and touchend handlers for mobile compatibility
      badge.addEventListener('click', handleBadgeInteraction, true);
      badge.addEventListener('touchend', (e) => {
        handleBadgeInteraction(e);
        // Also prevent the click event that follows touchend
        e.preventDefault();
      }, { passive: false, capture: true });
    });
  }

  /**
   * Apply IQGuessr mode on page load if enabled
   */
  async function applyIQGuessrModeOnLoad() {
    const settings = getSettings();
    const gameManager = getGameManager();
    const badgeManager = getBadgeManager();

    if (!settings.showIQBadge) {
      return;
    }

    if (settings.enableIQGuessr && gameManager && gameManager.replaceLoadingBadgeWithGuess && badgeManager) {
      // Game mode enabled on page load - convert loading badges to guess badges
      const loadingBadges = document.querySelectorAll('.iq-badge-loading, [data-iq-loading="true"]');

      // First, clean up duplicate badges for each tweet
      const processedTweetsForDupes = new Set();
      for (const loadingBadge of loadingBadges) {
        const tweetElement = loadingBadge.closest('article[data-testid="tweet"]') ||
                            loadingBadge.closest('article[role="article"]') ||
                            loadingBadge.closest('article');
        if (tweetElement && !processedTweetsForDupes.has(tweetElement)) {
          processedTweetsForDupes.add(tweetElement);
          // Find nested tweet if it exists
          const nestedTweet = tweetElement.querySelector('article[data-testid="tweet"]') ||
                             tweetElement.querySelector('article[role="article"]');
          const actualTweetElement = nestedTweet && nestedTweet !== tweetElement ? nestedTweet : tweetElement;

          // Find all badges in this tweet
          const allBadges = [
            ...actualTweetElement.querySelectorAll('.iq-badge'),
            ...(nestedTweet && nestedTweet !== tweetElement ? tweetElement.querySelectorAll('.iq-badge') : [])
          ];

          // Remove duplicates (keep the first one)
          if (allBadges.length > 1) {
            for (let i = 1; i < allBadges.length; i++) {
              if (allBadges[i].parentElement) {
                allBadges[i].remove();
              }
            }
          }
        }
      }

      // Get loading badges again after cleanup
      const loadingBadgesAfterCleanup = document.querySelectorAll('.iq-badge-loading, [data-iq-loading="true"]');
      for (const loadingBadge of loadingBadgesAfterCleanup) {
        // Only convert badges that are still loading (not yet calculated)
        if (loadingBadge.hasAttribute('data-iq-loading') || loadingBadge.classList.contains('iq-badge-loading')) {
          const tweetElement = loadingBadge.closest('article[data-testid="tweet"]') ||
                              loadingBadge.closest('article[role="article"]') ||
                              loadingBadge.closest('article');
          const tweetId = tweetElement?.getAttribute('data-tweet-id');

          await gameManager.replaceLoadingBadgeWithGuess(loadingBadge);

        }
      }

      // Final cleanup pass: remove any remaining duplicate guess badges across all tweets
      const allTweets = document.querySelectorAll('article[data-testid="tweet"], article[role="article"]');
      const processedTweetsForFinalCleanup = new Set();
      for (const tweet of allTweets) {
        const tweetId = tweet.getAttribute('data-tweet-id');
        if (tweetId && !processedTweetsForFinalCleanup.has(tweetId)) {
          processedTweetsForFinalCleanup.add(tweetId);
          // Use the cleanup function if available
          if (gameManager.cleanupDuplicateGuessBadges) {
            gameManager.cleanupDuplicateGuessBadges(tweet);
          }
        }
      }

      // Also handle calculated badges that already exist
      // These should stay as calculated badges (don't convert to guess badges)
      const calculatedBadges = document.querySelectorAll('.iq-badge[data-iq-score]:not([data-iq-guess]):not([data-iq-loading="true"])');
      for (const calculatedBadge of calculatedBadges) {
        const tweetElement = calculatedBadge.closest('article[data-testid="tweet"]') ||
                            calculatedBadge.closest('article[role="article"]') ||
                            calculatedBadge.closest('article');
        if (tweetElement) {
          const tweetId = tweetElement.getAttribute('data-tweet-id');
          if (tweetId) {
            const cachedGuess = await gameManager.getCachedGuess(tweetId);
            if (cachedGuess && cachedGuess.guess !== undefined) {
              // User has a cached guess, calculated badge should remain showing IQ score
              debugLog('[Content] Keeping calculated badge with cached guess for tweet:', tweetId);
            } else {
              // No cached guess but badge is already calculated - keep it as calculated
            }
          }
        }
      }
    }
  }

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

    // Attach click handlers to existing badges
    attachBadgeClickHandlers();

    // Set up observer to attach handlers to newly added badges
    const badgeObserver = new MutationObserver(() => {
      attachBadgeClickHandlers();
    });

    badgeObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    if (!realtimeManager || !realtimeManager.setupRealtimeComposeObserver) {
      console.error('RealtimeManager not available');
      setTimeout(init, 100); // Retry after modules load
      return;
    }

    const { processVisibleTweets, setupObserver } = tweetProcessor;
    const { setupRealtimeComposeObserver } = realtimeManager;
    const settings = getSettings();

    // Set up settings listener to apply changes immediately
    if (settings && settings.setupSettingsListener) {
      settings.setupSettingsListener((changes) => {
        // Apply settings changes immediately when they change
        if (changes && Object.keys(changes).length > 0) {
          applySettingsChanges(changes);
        }
      });
    }

    // Process existing tweets immediately to show loading badges as fast as possible
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        // Process immediately - badges should appear as soon as page loads
        processVisibleTweets();
        setupObserver();
        setupRealtimeComposeObserver();

        // Apply IQGuessr mode if enabled on page load
        applyIQGuessrModeOnLoad();
      });
    } else {
      // Page already loaded - process immediately
      processVisibleTweets();
      setupObserver();
      setupRealtimeComposeObserver();

      // Apply IQGuessr mode if enabled on page load
      applyIQGuessrModeOnLoad();
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
