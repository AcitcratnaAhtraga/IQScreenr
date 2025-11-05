/**
 * Score Management for Game Manager
 * Handles score calculation, history, and game score updates
 */

(function() {
  'use strict';

  const GUESS_HISTORY_KEY = 'iqGuessrHistory';

  /**
   * Calculate score for a guess
   * Score is based on how close the guess is to the actual IQ, weighted by confidence
   */
  function calculateGuessScore(guess, actual, confidence) {
    const difference = Math.abs(guess - actual);
    const maxDifference = 90; // Max possible difference (145 - 55)
    const accuracy = 1 - (difference / maxDifference);

    // Base score: 0-100 points based on accuracy
    let baseScore = Math.round(accuracy * 100);

    // Weight by confidence: Higher confidence = more risk/reward
    // Low confidence (0-30%): 0.3x multiplier
    // Medium confidence (31-70%): 1x multiplier
    // High confidence (71-100%): 2x multiplier
    let multiplier;
    if (confidence < 31) {
      multiplier = 0.3;
    } else if (confidence < 71) {
      multiplier = 1.0;
    } else {
      multiplier = 2.0;
    }

    const finalScore = Math.round(baseScore * multiplier);

    return finalScore;
  }

  /**
   * Add score to the total game score
   */
  async function addToGameScore(points) {
    // Try to use storage abstraction first, fallback to direct chrome.storage if needed
    const storage = window.GameManagerStorage;

    // Check if we can use chrome.storage directly
    const canUseStorage = chrome && chrome.storage && chrome.storage.sync;

    if (!canUseStorage) {
      console.warn('[IQGuessr] Chrome storage not available, cannot update score');
      return;
    }

    try {
      // Get current score
      let currentScore = 0;

      if (storage && storage.isExtensionContextValid && storage.isExtensionContextValid()) {
        // Use abstraction if available
        const result = await storage.getStorage(['iqGuessrScore'], 'sync');
        currentScore = result.iqGuessrScore;
      } else {
        // Fallback to direct chrome.storage
        currentScore = await new Promise((resolve) => {
          chrome.storage.sync.get(['iqGuessrScore'], (result) => {
            if (chrome.runtime.lastError) {
              resolve(0);
            } else {
              resolve(result.iqGuessrScore || 0);
            }
          });
        });
      }

      // Convert to number if it's a string
      if (typeof currentScore === 'string') {
        currentScore = parseFloat(currentScore) || 0;
      }
      currentScore = Number(currentScore) || 0;

      const newScore = currentScore + points;

      console.log('[IqGuessr] Updating score:', { currentScore, points, newScore });

      // Set new score
      if (storage && storage.isExtensionContextValid && storage.isExtensionContextValid()) {
        await storage.setStorage({ iqGuessrScore: newScore }, 'sync');

        // Broadcast to popup if open
        if (storage.sendMessage) {
          try {
            await storage.sendMessage({
              type: 'updateIQGuessrScore',
              score: newScore
            });
          } catch (e) {
            // Ignore - popup might not be open
          }
        }
      } else {
        // Fallback to direct chrome.storage
        await new Promise((resolve) => {
          chrome.storage.sync.set({ iqGuessrScore: newScore }, () => {
            if (chrome.runtime.lastError) {
              console.warn('[IQGuessr] Error setting score:', chrome.runtime.lastError);
            }
            resolve();
          });
        });

        // Broadcast to popup if open
        try {
          if (chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({
              type: 'updateIQGuessrScore',
              score: newScore
            }, (response) => {
              // Ignore errors - popup might not be open
              if (chrome.runtime.lastError) {
                // This is expected when popup is closed, silently ignore
                return;
              }
            });
          }
        } catch (e) {
          // Ignore message errors
        }
      }
    } catch (error) {
      console.warn('[IQGuessr] Error updating score:', error);
    }
  }

  /**
   * Add a guess to history with full metadata
   */
  async function addGuessToHistory(tweetId, handle, guess, actualIQ, confidence, score) {
    if (!tweetId) return;

    const historyEntry = {
      tweetId: tweetId,
      handle: handle,
      guess: guess,
      actualIQ: actualIQ,
      confidence: confidence,
      score: score,
      difference: Math.abs(guess - actualIQ),
      accuracy: Math.max(0, 100 - (Math.abs(guess - actualIQ) / 90) * 100), // 0-100 based on 90 point range
      timestamp: new Date().toISOString()
    };

    const storage = window.GameManagerStorage;
    if (!storage || !storage.isExtensionContextValid()) {
      return;
    }

    try {
      // Get existing history
      const result = await storage.getStorage([GUESS_HISTORY_KEY]);
      let history = result[GUESS_HISTORY_KEY] || [];

      // Add new entry at the beginning
      history.unshift(historyEntry);

      // Keep only last 1000 guesses to prevent storage bloat
      if (history.length > 1000) {
        history = history.slice(0, 1000);
      }

      // Save back to storage
      await storage.setStorage({ [GUESS_HISTORY_KEY]: history });
    } catch (error) {
      console.warn('[IQGuessr] Error adding to history:', error);
    }
  }

  /**
   * Get all guess history
   */
  async function getGuessHistory() {
    const storage = window.GameManagerStorage;
    if (!storage || !storage.isExtensionContextValid()) {
      return [];
    }

    try {
      const result = await storage.getStorage([GUESS_HISTORY_KEY]);
      return result[GUESS_HISTORY_KEY] || [];
    } catch (error) {
      console.warn('[IQGuessr] Error getting history:', error);
      return [];
    }
  }

  /**
   * Clear all guess history
   */
  async function clearGuessHistory() {
    const storage = window.GameManagerStorage;
    if (!storage || !storage.isExtensionContextValid()) {
      return;
    }

    try {
      await storage.removeStorage([GUESS_HISTORY_KEY]);
    } catch (error) {
      console.warn('[IQGuessr] Error clearing history:', error);
    }
  }

  /**
   * Show score feedback on the badge
   */
  function showScoreFeedback(badge, score, guess, actual) {
    // Get badge position relative to viewport
    const badgeRect = badge.getBoundingClientRect();

    // Create a temporary overlay showing the score
    const overlay = document.createElement('div');
    overlay.className = 'iq-guessr-feedback';
    overlay.textContent = `+${score}`;

    // Calculate position relative to badge
    // Position it just above the badge, centered horizontally
    const topOffset = -20; // Closer to badge (was -30)

    overlay.style.cssText = `
      position: fixed;
      top: ${badgeRect.top + topOffset}px;
      left: ${badgeRect.left + (badgeRect.width / 2)}px;
      transform: translateX(-50%);
      background: #000000;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      white-space: nowrap;
      z-index: 10000;
      animation: scoreFloatUp 1s ease-out forwards;
      pointer-events: none;
    `;

    // Append to body for fixed positioning context
    document.body.appendChild(overlay);

    // Remove overlay after animation
    setTimeout(() => {
      if (overlay.parentElement) {
        overlay.parentElement.removeChild(overlay);
      }
    }, 1000);
  }

  // Export
  if (typeof window !== 'undefined') {
    window.GameManagerScore = {
      calculateGuessScore,
      addToGameScore,
      addGuessToHistory,
      getGuessHistory,
      clearGuessHistory,
      showScoreFeedback
    };
  }
})();
