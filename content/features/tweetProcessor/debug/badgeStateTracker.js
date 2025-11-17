/**
 * Badge State Tracker - Debug Utility
 * Tracks badge states, mode transitions, and badge visibility for debugging
 */

(function() {
  'use strict';

  const DEBUG_PREFIX = '[BadgeStateTracker]';
  let isEnabled = true; // Set to false to disable all logging

  /**
   * Get current mode (normal or IqGuessr)
   */
  function getCurrentMode() {
    const gameManager = window.GameManager || {};
    const logic = window.GameManagerLogic || {};
    const isGameMode = (gameManager.isGameModeEnabled && gameManager.isGameModeEnabled()) ||
                       (logic.isGameModeEnabled && logic.isGameModeEnabled());
    return isGameMode ? 'IqGuessr' : 'Normal';
  }

  /**
   * Get badge type from badge element
   */
  function getBadgeType(badge) {
    if (!badge) return 'none';
    
    if (badge.classList.contains('iq-badge-loading')) return 'loading';
    if (badge.classList.contains('iq-badge-guess')) return 'guess';
    if (badge.classList.contains('iq-badge-invalid')) return 'invalid';
    if (badge.classList.contains('iq-badge-realtime')) return 'realtime';
    if (badge.hasAttribute('data-iq-score')) return 'calculated';
    if (badge.hasAttribute('data-iq-guess')) return 'guess';
    if (badge.hasAttribute('data-iq-loading')) return 'loading';
    
    return 'unknown';
  }

  /**
   * Get badge state details
   */
  function getBadgeState(badge) {
    if (!badge) return null;

    return {
      type: getBadgeType(badge),
      visible: badge.offsetParent !== null && 
               badge.style.display !== 'none' && 
               badge.style.visibility !== 'hidden' &&
               badge.style.opacity !== '0',
      inDOM: badge.isConnected,
      classes: Array.from(badge.classList).join(', '),
      attributes: {
        'data-iq-score': badge.getAttribute('data-iq-score'),
        'data-iq-guess': badge.getAttribute('data-iq-guess'),
        'data-iq-loading': badge.getAttribute('data-iq-loading'),
        'data-iq-animating': badge.getAttribute('data-iq-animating'),
        'data-iq-compared': badge.getAttribute('data-iq-compared'),
        'data-iq-guessed': badge.getAttribute('data-iq-guessed'),
        'data-confidence': badge.getAttribute('data-confidence'),
        'data-iq-compared': badge.getAttribute('data-iq-compared'),
      },
      computedStyle: {
        display: window.getComputedStyle(badge).display,
        visibility: window.getComputedStyle(badge).visibility,
        opacity: window.getComputedStyle(badge).opacity,
      },
      position: badge.getBoundingClientRect()
    };
  }

  /**
   * Get cache status for a tweet
   */
  async function getCacheStatus(tweetId, handle) {
    const gameManager = window.GameManager || {};
    const cache = window.GameManagerCache || {};
    const iqCache = window.IQCache || {};

    const status = {
      tweetId,
      handle,
      guessCache: null,
      revealedIQCache: null,
      iqCache: null,
    };

    // Get guess cache
    if (gameManager.getCachedGuess && tweetId) {
      try {
        status.guessCache = await gameManager.getCachedGuess(tweetId);
      } catch (e) {
        status.guessCache = { error: e.message };
      }
    }

    // Get revealed IQ cache
    if (gameManager.getCachedRevealedIQResult && tweetId) {
      try {
        status.revealedIQCache = await gameManager.getCachedRevealedIQResult(tweetId);
      } catch (e) {
        status.revealedIQCache = { error: e.message };
      }
    }

    // Get IQ cache (handle-based)
    if (iqCache.getCachedIQ && handle) {
      try {
        status.iqCache = iqCache.getCachedIQ(handle);
      } catch (e) {
        status.iqCache = { error: e.message };
      }
    }

    return status;
  }

  /**
   * Determine expected badge type based on mode and cache
   */
  async function getExpectedBadgeType(tweetId, handle, mode) {
    const cacheStatus = await getCacheStatus(tweetId, handle);
    
    if (mode === 'IqGuessr') {
      // In IqGuessr mode:
      // - If guess exists but no revealed IQ: show guess badge
      // - If guess exists and revealed IQ exists: show calculated badge
      // - If no guess: show guess badge (waiting for input)
      if (cacheStatus.guessCache && cacheStatus.guessCache.guess !== undefined) {
        if (cacheStatus.revealedIQCache && cacheStatus.revealedIQCache.iq) {
          return 'calculated';
        }
        return 'guess';
      }
      return 'guess'; // Waiting for guess input
    } else {
      // In Normal mode:
      // - If IQ cache exists: show calculated badge
      // - Otherwise: show loading -> calculated
      if (cacheStatus.iqCache && cacheStatus.iqCache.iq_estimate !== null) {
        return 'calculated';
      }
      return 'loading'; // Will become calculated
    }
  }

  /**
   * Log tweet badge state
   */
  async function logTweetBadgeState(tweetElement, context = '') {
    if (!isEnabled) return;

    const actualTweetElement = tweetElement.querySelector('article[data-testid="tweet"]') ||
                               tweetElement.querySelector('article[role="article"]') ||
                               tweetElement;

    const tweetId = actualTweetElement.getAttribute('data-tweet-id');
    const handle = actualTweetElement.querySelector('[data-testid="User-Name"]')?.textContent?.trim() ||
                   actualTweetElement.querySelector('a[href^="/"]')?.getAttribute('href')?.replace('/', '');

    const mode = getCurrentMode();
    
    // Find badge
    const badge = actualTweetElement.querySelector('.iq-badge') ||
                   actualTweetElement.querySelector('[class*="iq-badge"]') ||
                   actualTweetElement.parentElement?.querySelector('.iq-badge');

    const badgeState = getBadgeState(badge);
    const cacheStatus = await getCacheStatus(tweetId, handle);
    const expectedBadgeType = await getExpectedBadgeType(tweetId, handle, mode);

    const logData = {
      context,
      tweetId: tweetId || 'unknown',
      handle: handle || 'unknown',
      mode,
      currentBadge: badgeState,
      expectedBadgeType,
      cacheStatus,
      match: badgeState?.type === expectedBadgeType || (!badgeState && expectedBadgeType === 'none'),
      timestamp: new Date().toISOString()
    };

    console.group(`${DEBUG_PREFIX} Tweet Badge State ${context ? `(${context})` : ''}`);
    console.log('Tweet ID:', logData.tweetId);
    console.log('Handle:', logData.handle);
    console.log('Mode:', logData.mode);
    console.log('Current Badge:', badgeState);
    console.log('Expected Badge Type:', expectedBadgeType);
    console.log('Match:', logData.match ? '✅' : '❌');
    console.log('Cache Status:', cacheStatus);
    console.log('Full State:', logData);
    console.groupEnd();

    return logData;
  }

  /**
   * Log all tweets in viewport
   */
  async function logAllTweetsInViewport() {
    if (!isEnabled) return;

    const tweets = document.querySelectorAll('article[data-testid="tweet"], article[role="article"]');
    const mode = getCurrentMode();

    console.group(`${DEBUG_PREFIX} All Tweets in Viewport (${tweets.length} tweets, Mode: ${mode})`);

    const states = [];
    for (const tweet of tweets) {
      const state = await logTweetBadgeState(tweet, 'viewport-scan');
      states.push(state);
    }

    // Summary
    const summary = {
      total: states.length,
      mode,
      badges: {
        none: states.filter(s => !s.currentBadge).length,
        loading: states.filter(s => s.currentBadge?.type === 'loading').length,
        guess: states.filter(s => s.currentBadge?.type === 'guess').length,
        calculated: states.filter(s => s.currentBadge?.type === 'calculated').length,
        invalid: states.filter(s => s.currentBadge?.type === 'invalid').length,
        unknown: states.filter(s => s.currentBadge?.type === 'unknown').length,
      },
      matches: states.filter(s => s.match).length,
      mismatches: states.filter(s => !s.match).length,
    };

    console.log('Summary:', summary);
    console.groupEnd();

    return { states, summary };
  }

  /**
   * Log badge state change
   */
  function logBadgeStateChange(badge, fromState, toState, reason = '') {
    if (!isEnabled) return;

    const tweetElement = badge.closest('article[data-testid="tweet"]') ||
                         badge.closest('article[role="article"]') ||
                         badge.closest('article');
    const tweetId = tweetElement?.getAttribute('data-tweet-id');
    const mode = getCurrentMode();

    console.group(`${DEBUG_PREFIX} Badge State Change ${reason ? `(${reason})` : ''}`);
    console.log('Tweet ID:', tweetId || 'unknown');
    console.log('Mode:', mode);
    console.log('From:', fromState);
    console.log('To:', toState);
    console.log('Badge Element:', badge);
    console.log('Badge State:', getBadgeState(badge));
    console.groupEnd();
  }

  /**
   * Log mode change
   */
  function logModeChange(fromMode, toMode) {
    if (!isEnabled) return;

    console.group(`${DEBUG_PREFIX} Mode Change`);
    console.log('From:', fromMode);
    console.log('To:', toMode);
    console.log('Timestamp:', new Date().toISOString());
    console.groupEnd();

    // Log all tweets after mode change
    setTimeout(() => {
      logAllTweetsInViewport();
    }, 500);
  }

  /**
   * Enable/disable tracking
   */
  function setEnabled(enabled) {
    isEnabled = enabled;
    console.log(`${DEBUG_PREFIX} Tracking ${enabled ? 'enabled' : 'disabled'}`);
  }

  // Export
  if (typeof window !== 'undefined') {
    window.BadgeStateTracker = {
      logTweetBadgeState,
      logAllTweetsInViewport,
      logBadgeStateChange,
      logModeChange,
      getCurrentMode,
      getBadgeType,
      getBadgeState,
      getCacheStatus,
      getExpectedBadgeType,
      setEnabled
    };
  }
})();

