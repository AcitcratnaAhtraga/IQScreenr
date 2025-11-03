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
        // Show all realtime badges
        realtimeBadges.forEach(badge => {
          badge.style.setProperty('display', 'inline-flex', 'important');
          badge.style.setProperty('visibility', 'visible', 'important');
          badge.style.setProperty('opacity', '1', 'important');
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
            badge.style.setProperty('background-color', newColor, 'important');
          }
        });
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
            const loadingBadge = badgeManager.createLoadingBadge();
            if (guessBadge.parentElement) {
              guessBadge.parentElement.insertBefore(loadingBadge, guessBadge);
              guessBadge.remove();
            }
          }
        });
      } else if (gameModeEnabled && gameManager && gameManager.replaceLoadingBadgeWithGuess && settings.showIQBadge) {
        // Game mode enabled: convert loading badges to guess badges
        const loadingBadges = document.querySelectorAll('.iq-badge-loading, [data-iq-loading="true"]');
        for (const loadingBadge of loadingBadges) {
          // Only convert badges that are still loading (not yet calculated)
          if (loadingBadge.hasAttribute('data-iq-loading') || loadingBadge.classList.contains('iq-badge-loading')) {
            await gameManager.replaceLoadingBadgeWithGuess(loadingBadge);
            // replaceLoadingBadgeWithGuess handles the replacement, so we don't need to do anything else
          }
        }

        // Reprocess visible tweets to apply game mode to new badges
        if (tweetProcessor && tweetProcessor.processVisibleTweets) {
          setTimeout(() => {
            tweetProcessor.processVisibleTweets();
          }, 100);
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
