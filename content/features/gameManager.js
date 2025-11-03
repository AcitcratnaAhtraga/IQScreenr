/**
 * Game Manager for IQ Guessr
 * Handles game logic, scoring, and guess input
 */

(function() {
  'use strict';

// Get dependencies from other modules
const getSettings = () => window.Settings || {};
const getBadgeManager = () => window.BadgeManager || {};
const getDebugLog = () => window.DOMHelpers?.debugLog || (() => {});
const debugLog = getDebugLog();

// Game state
const guessManager = new Map(); // tweetElement -> { guess: number, confidence: number }
const GUESS_CACHE_PREFIX = 'iq_guess_';

/**
 * Generate cache key from handle
 */
function generateGuessCacheKey(handle) {
  if (!handle) return null;
  return handle.trim().toLowerCase().replace(/^@/, '');
}

// Persistent guess cache
const persistentGuessCache = new Map();

/**
 * Get cached guess for a handle (async)
 */
async function getCachedGuess(handle) {
  if (!handle) return null;

  const key = generateGuessCacheKey(handle);
  if (!key) return null;

  // Check memory cache first
  if (persistentGuessCache.has(key)) {
    return persistentGuessCache.get(key);
  }

  // Try to get from chrome storage
  const storageKey = GUESS_CACHE_PREFIX + key;
  return new Promise((resolve) => {
    chrome.storage.local.get([storageKey], (result) => {
      if (result[storageKey]) {
        persistentGuessCache.set(key, result[storageKey]);
        resolve(result[storageKey]);
      } else {
        resolve(null);
      }
    });
  });
}

/**
 * Cache a guess for a handle
 */
function cacheGuess(handle, guessData) {
  if (!handle) return;

  const key = generateGuessCacheKey(handle);
  if (!key) return;

  const cacheEntry = {
    guess: guessData.guess,
    confidence: guessData.confidence,
    timestamp: new Date().toISOString()
  };

  // Store in memory
  persistentGuessCache.set(key, cacheEntry);

  // Store in chrome storage
  const storageKey = GUESS_CACHE_PREFIX + key;
  const storageData = {};
  storageData[storageKey] = cacheEntry;
  chrome.storage.local.set(storageData, () => {});
}

/**
 * Load all guesses from storage into memory
 */
function loadGuessCache() {
  chrome.storage.local.get(null, (items) => {
    for (const [key, value] of Object.entries(items)) {
      if (key.startsWith(GUESS_CACHE_PREFIX)) {
        const cacheKey = key.replace(GUESS_CACHE_PREFIX, '');
        if (value && typeof value === 'object') {
          persistentGuessCache.set(cacheKey, value);
        }
      }
    }
  });
}

// Load cache on initialization
loadGuessCache();

/**
 * Check if IQ Guessr mode is enabled
 */
function isGameModeEnabled() {
  const settings = getSettings();
  return settings.enableIQGuessr === true;
}

/**
 * Create a grey guess badge that can be clicked to input a guess
 */
function createGuessBadge() {
  const badge = document.createElement('span');
  badge.className = 'iq-badge iq-badge-guess';
  badge.setAttribute('data-iq-guess', 'true');

  // Grey background
  badge.style.setProperty('background-color', '#9e9e9e', 'important');
  badge.style.setProperty('color', '#000000', 'important');
  badge.style.setProperty('cursor', 'pointer', 'important');
  badge.style.setProperty('display', 'inline-flex', 'important');
  badge.style.setProperty('visibility', 'visible', 'important');
  badge.style.setProperty('opacity', '1', 'important');

  badge.innerHTML = `
    <span class="iq-label">IQ</span>
    <span class="iq-score">...</span>
  `;

  // Add click handler to make it editable
  badge.addEventListener('click', (e) => {
    e.stopPropagation();
    makeBadgeEditable(badge);
  });

  return badge;
}

/**
 * Make a badge editable to accept guess input
 */
async function makeBadgeEditable(badge) {
  // Don't allow editing if a guess already exists or if we're calculating
  if (badge.hasAttribute('data-iq-guessed') || badge.hasAttribute('data-iq-calculating')) {
    return;
  }

  const scoreElement = badge.querySelector('.iq-score');
  if (!scoreElement) return;

  // Check if there's a cached guess for this handle
  const tweetElement = badge.closest('article[data-testid="tweet"]') ||
                      badge.closest('article[role="article"]') ||
                      badge.closest('article');

  if (tweetElement) {
    const handle = tweetElement.getAttribute('data-handle');
    if (handle) {
      const cachedGuess = await getCachedGuess(handle);
      if (cachedGuess && cachedGuess.guess !== undefined) {
        // Already guessed this tweet, don't allow editing
        return;
      }
    }
  }

  const currentText = scoreElement.textContent;
  const oldValue = currentText && currentText !== '...' ? currentText : '';

  // Create input element
  const input = document.createElement('input');
  input.type = 'number';
  input.min = 55;
  input.max = 145;
  input.value = oldValue;
  input.className = 'iq-guess-input';
  input.style.cssText = `
    width: 100%;
    text-align: center;
    border: none;
    background: transparent;
    color: #000;
    font-size: 12px;
    font-weight: 700;
    padding: 0;
    margin: 0;
    outline: none;
  `;

  // Replace score element with input
  scoreElement.replaceWith(input);
  input.focus();
  input.select();

  // Track if guess has been submitted to prevent double submission
  let submitted = false;

  // Handle blur or enter key
  const submitGuess = () => {
    if (submitted) {
      return;
    }

    const value = parseInt(input.value, 10);
    if (value >= 55 && value <= 145) {
      submitted = true; // Mark as submitted immediately
      badge.setAttribute('data-iq-guessed', value);

      // Restore score element
      const newScoreElement = document.createElement('span');
      newScoreElement.className = 'iq-score';
      newScoreElement.textContent = value;

      // Check if input is still in the DOM before replacing
      if (input.parentElement) {
        input.replaceWith(newScoreElement);
      }

      // Trigger small confirmation animation
      badge.style.transform = 'scale(1.2)';
      badge.style.transition = 'transform 0.2s ease';
      setTimeout(() => {
        badge.style.transform = 'scale(1)';
      }, 200);

      // Store the guess
      const tweetElement = badge.closest('article[data-testid="tweet"]') ||
                          badge.closest('article[role="article"]') ||
                          badge.closest('article');
      if (tweetElement) {
        // Get confidence from existing badge data if available
        let confidence = badge.hasAttribute('data-confidence')
          ? parseInt(badge.getAttribute('data-confidence'), 10)
          : 50; // Default confidence

        // Check if we have a stored IQ result (means calculation already happened)
        const iqResult = tweetElement._iqResult;

        // If we have IQ result, use the confidence from there
        if (iqResult && iqResult.confidence !== null && iqResult.confidence !== undefined) {
          confidence = iqResult.confidence;
        }

        guessManager.set(tweetElement, {
          guess: value,
          confidence: confidence
        });

        // Store the guess persistently using handle
        const handle = tweetElement.getAttribute('data-handle');
        if (handle) {
          cacheGuess(handle, { guess: value, confidence: confidence });
        }

        if (iqResult) {
          // Get badge manager to get colors
          const badgeManager = getBadgeManager();
          if (badgeManager && badgeManager.getIQColor) {
            const iqColor = getSettings().useConfidenceForColor && iqResult.confidence
              ? badgeManager.getConfidenceColor(iqResult.confidence)
              : badgeManager.getIQColor(iqResult.iq);

            // Call revealActualScore directly since we're in the same scope
            setTimeout(() => {
              revealActualScore(badge, iqResult.iq, iqColor, iqResult.confidence, iqResult.result, iqResult.text);
            }, 250);
          }
        }
      }
    } else {
      // Invalid value, restore original
      const newScoreElement = document.createElement('span');
      newScoreElement.className = 'iq-score';
      newScoreElement.textContent = oldValue || '...';

      // Check if input is still in the DOM before replacing
      if (input.parentElement) {
        input.replaceWith(newScoreElement);
      }
    }
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitGuess();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      submitted = true; // Prevent blur from firing
      // Restore original score element
      const newScoreElement = document.createElement('span');
      newScoreElement.className = 'iq-score';
      newScoreElement.textContent = oldValue || '...';

      // Check if input is still in the DOM before replacing
      if (input.parentElement) {
        input.replaceWith(newScoreElement);
      }
    }
  });

  input.addEventListener('blur', submitGuess);

  // Prevent click events from bubbling up while editing
  input.addEventListener('click', (e) => e.stopPropagation());
}

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
 * Reveal the actual IQ score with a loading animation
 */
function revealActualScore(badge, actualIQ, iqColor, confidence, result, tweetText) {
  // Mark as calculating to prevent re-editing
  badge.setAttribute('data-iq-calculating', 'true');

  // Store the actual IQ for later scoring
  const tweetElement = badge.closest('article[data-testid="tweet"]') ||
                      badge.closest('article[role="article"]') ||
                      badge.closest('article');

  const guessData = tweetElement ? guessManager.get(tweetElement) : null;
  const hasGuess = guessData && guessData.guess !== undefined;

  // Add rotating border animation
  badge.classList.add('iq-badge-calculating');
  badge.style.animation = 'rotatingBorder 1s linear infinite';

  // After a short delay, show the actual score
  setTimeout(() => {
    badge.classList.remove('iq-badge-calculating');
    badge.style.animation = '';

    // Update badge to show actual IQ
    const badgeManager = getBadgeManager();
    if (badgeManager && badgeManager.animateCountUp) {
      badge.removeAttribute('data-iq-guess');
      badge.classList.remove('iq-badge-guess');

      // Store confidence BEFORE calling animateCountUp so it can build the correct structure
      if (confidence !== null) {
        badge.setAttribute('data-confidence', confidence);
      }

      // Add debug data for hover
      if (result && tweetText) {
        badge._debugData = {
          iq: actualIQ,
          result: result,
          text: tweetText,
          timestamp: new Date().toISOString()
        };

        // Add hover event listener
        badge.addEventListener('mouseenter', () => {
          if (badge._debugData && badgeManager.logDebugInfo) {
            badgeManager.logDebugInfo(badge._debugData);
          }
        });
      }

      // Use the count-up animation to reveal the score
      badgeManager.animateCountUp(badge, actualIQ, iqColor);

      // Calculate and add score
      if (hasGuess && guessData) {
        const score = calculateGuessScore(guessData.guess, actualIQ, guessData.confidence);
        addToGameScore(score);

        // Show score feedback
        showScoreFeedback(badge, score, guessData.guess, actualIQ);
      }
    }
  }, 1500); // 1.5 second loading animation
}

/**
 * Add score to the total game score
 */
function addToGameScore(points) {
  chrome.storage.sync.get(['iqGuessrScore'], (result) => {
    const currentScore = result.iqGuessrScore || 0;
    const newScore = currentScore + points;

    chrome.storage.sync.set({ iqGuessrScore: newScore }, () => {
      // Broadcast to popup if open
      if (chrome.runtime && chrome.runtime.sendMessage) {
        try {
          chrome.runtime.sendMessage({
            type: 'updateIQGuessrScore',
            score: newScore
          });
        } catch (e) {
          // Popup might not be listening
        }
      }
    });
  });
}

/**
 * Show score feedback on the badge
 */
function showScoreFeedback(badge, score, guess, actual) {
  // Create a temporary overlay showing the score
  const overlay = document.createElement('div');
  overlay.className = 'iq-guessr-feedback';
  overlay.textContent = `+${score}`;
  overlay.style.cssText = `
    position: absolute;
    top: -30px;
    left: 50%;
    transform: translateX(-50%);
    background: #2563eb;
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

  badge.parentElement.style.position = 'relative';
  badge.parentElement.appendChild(overlay);

  // Remove overlay after animation
  setTimeout(() => {
    if (overlay.parentElement) {
      overlay.parentElement.removeChild(overlay);
    }
  }, 1000);
}

/**
 * Replace a loading badge with a guess badge if game mode is enabled
 */
function replaceLoadingBadgeWithGuess(loadingBadge) {
  if (!isGameModeEnabled()) {
    return null;
  }

  const guessBadge = createGuessBadge();

  // Insert it in the same position
  if (loadingBadge.parentElement) {
    loadingBadge.parentElement.insertBefore(guessBadge, loadingBadge);
    loadingBadge.remove();
  }

  return guessBadge;
}

/**
 * Get guess for a tweet element
 */
function getGuess(tweetElement) {
  return guessManager.get(tweetElement) || null;
}

/**
 * Clear guess for a tweet element
 */
function clearGuess(tweetElement) {
  guessManager.delete(tweetElement);
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.GameManager = {
    isGameModeEnabled,
    createGuessBadge,
    replaceLoadingBadgeWithGuess,
    revealActualScore,
    getGuess,
    clearGuess,
    calculateGuessScore,
    addToGameScore,
    getCachedGuess,
    cacheGuess
  };
}

})();

