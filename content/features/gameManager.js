/**
 * Game Manager for IQ Guessr
 * Handles game logic, scoring, and guess input
 */

(function() {
  'use strict';

// Get dependencies from other modules
const getSettings = () => window.Settings || {};
const getBadgeManager = () => window.BadgeManager || {};
const getIQCache = () => window.IQCache || {};
const getTextExtraction = () => window.TextExtraction || {};
const getDebugLog = () => window.DOMHelpers?.debugLog || (() => {});
const debugLog = getDebugLog();


// Game state
const guessManager = new Map(); // tweetElement -> { guess: number, confidence: number }
const GUESS_CACHE_PREFIX = 'iq_guess_';
const REVEALED_CACHE_PREFIX = 'iq_revealed_';
const GUESS_HISTORY_KEY = 'iqGuessrHistory';

/**
 * Generate cache key from tweet ID
 */
function generateGuessCacheKey(tweetId) {
  if (!tweetId) return null;
  return String(tweetId).trim();
}

// Persistent guess cache
const persistentGuessCache = new Map();

/**
 * Get cached guess for a tweet ID (async)
 */
async function getCachedGuess(tweetId) {
  if (!tweetId) {
    return null;
  }

  const key = generateGuessCacheKey(tweetId);
  if (!key) {
    return null;
  }

  // Check memory cache first
  if (persistentGuessCache.has(key)) {
    return persistentGuessCache.get(key);
  }

  // Try to get from chrome storage
  const storageKey = GUESS_CACHE_PREFIX + key;
  return new Promise((resolve) => {
    chrome.storage.local.get([storageKey], (result) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }

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
 * Cache that an IQ was revealed for a tweet ID (even without a guess)
 * This ensures that if IQGuessr mode is re-enabled or page is refreshed,
 * the IQ stays as calculated instead of reverting to guess badge
 */
function cacheRevealedIQ(tweetId) {
  if (!tweetId) return;

  const key = generateGuessCacheKey(tweetId);
  if (!key) return;

  const revealedEntry = {
    revealed: true,
    timestamp: new Date().toISOString()
  };

  // Store in chrome storage
  const storageKey = REVEALED_CACHE_PREFIX + key;
  const storageData = {};
  storageData[storageKey] = revealedEntry;
  chrome.storage.local.set(storageData);
}

/**
 * Get cached revealed IQ status for a tweet ID (async)
 */
async function getCachedRevealedIQ(tweetId) {
  if (!tweetId) return null;

  const key = generateGuessCacheKey(tweetId);
  if (!key) return null;

  const storageKey = REVEALED_CACHE_PREFIX + key;
  return new Promise((resolve) => {
    chrome.storage.local.get([storageKey], (result) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }

      if (result[storageKey] && result[storageKey].revealed) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}

/**
 * Cache a guess for a tweet ID
 */
function cacheGuess(tweetId, guessData) {
  if (!tweetId) {
    return;
  }

  const key = generateGuessCacheKey(tweetId);
  if (!key) {
    return;
  }

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
  chrome.storage.local.set(storageData);
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

  // Check if there's a cached guess for this tweet
  const tweetElement = badge.closest('article[data-testid="tweet"]') ||
                      badge.closest('article[role="article"]') ||
                      badge.closest('article');

  if (tweetElement) {
    const tweetId = tweetElement.getAttribute('data-tweet-id');
    if (tweetId) {
      const cachedGuess = await getCachedGuess(tweetId);
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

        // Store the guess persistently using tweet ID
        const tweetId = tweetElement.getAttribute('data-tweet-id');
        if (tweetId) {
          cacheGuess(tweetId, { guess: value, confidence: confidence });
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

  // Debug: Log state transition from guess to calculated
  const tweetId = tweetElement?.getAttribute('data-tweet-id');

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

        // Add to history
        const tweetId = tweetElement ? tweetElement.getAttribute('data-tweet-id') : null;
        const handle = tweetElement ? tweetElement.getAttribute('data-handle') : null;
        if (tweetId) {
          addGuessToHistory(tweetId, handle, guessData.guess, actualIQ, guessData.confidence, score);
        }

      // Show score feedback
      showScoreFeedback(badge, score, guessData.guess, actualIQ);

      // Store that this IQ was revealed (so it stays calculated after refresh/iqguessr toggle)
      const tweetIdForReveal = tweetElement ? tweetElement.getAttribute('data-tweet-id') : null;
      if (tweetIdForReveal) {
        cacheRevealedIQ(tweetIdForReveal);
      }
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
async function replaceLoadingBadgeWithGuess(loadingBadge) {
  if (!isGameModeEnabled()) {
    return null;
  }

  // Check if we have a cached guess for this tweet
  const tweetElement = loadingBadge.closest('article[data-testid="tweet"]') ||
                      loadingBadge.closest('article[role="article"]') ||
                      loadingBadge.closest('article');

  if (tweetElement) {
    const tweetId = tweetElement.getAttribute('data-tweet-id');
    if (tweetId) {
      const cachedGuess = await getCachedGuess(tweetId);
      if (cachedGuess && cachedGuess.guess !== undefined) {
        // We have a cached guess, check if there's an actual IQ calculated
        let iqResult = tweetElement._iqResult;

        // If no IQ result on tweet element, try to get from IQ cache (handles page refresh)
        if (!iqResult || !iqResult.iq) {
          const { getCachedIQ } = getIQCache();
          const { extractTweetHandle, extractTweetText } = getTextExtraction();
          if (getCachedIQ && extractTweetHandle) {
            // Try to get handle from attribute first, then extract if needed
            let handle = tweetElement.getAttribute('data-handle');
            if (!handle) {
              handle = extractTweetHandle(tweetElement);
              // Cache it for future use
              if (handle) {
                tweetElement.setAttribute('data-handle', handle);
              }
            }

            if (handle) {
              const cachedIQ = getCachedIQ(handle);
              if (cachedIQ && cachedIQ.iq_estimate !== undefined) {
                // Extract tweet text for debug data
                const tweetText = extractTweetText ? extractTweetText(tweetElement) : null;
                // Convert cached IQ format to match expected format
                iqResult = {
                  iq: cachedIQ.iq_estimate,
                  result: cachedIQ,
                  confidence: cachedIQ.confidence,
                  text: tweetText
                };
              }
            }
          }
        }

        if (iqResult && iqResult.iq !== undefined && iqResult.result) {
          // We have the actual IQ, show it instead of a guess badge
          const badgeManager = getBadgeManager();
          if (badgeManager && badgeManager.createIQBadge) {
            const iq = Math.round(iqResult.iq);

            // Create the actual IQ badge with proper parameters
            const iqBadge = badgeManager.createIQBadge(iq, iqResult.result, iqResult.text);

            // Store the guess in memory for reference
            guessManager.set(tweetElement, {
              guess: cachedGuess.guess,
              confidence: cachedGuess.confidence
            });

            // Insert it in the same position
            if (loadingBadge.parentElement) {
              loadingBadge.parentElement.insertBefore(iqBadge, loadingBadge);
              loadingBadge.remove();
            }

            return iqBadge;
          }
        }
        // We have a guess but no IQ yet, create a regular guess badge with the cached value
        const guessBadge = createGuessBadge();

        // Set the cached guess value
        const scoreElement = guessBadge.querySelector('.iq-score');
        if (scoreElement) {
          scoreElement.textContent = cachedGuess.guess;
        }
        guessBadge.setAttribute('data-iq-guessed', cachedGuess.guess);

        // Store in memory
        guessManager.set(tweetElement, {
          guess: cachedGuess.guess,
          confidence: cachedGuess.confidence
        });

        // Insert it in the same position
        if (loadingBadge.parentElement) {
          loadingBadge.parentElement.insertBefore(guessBadge, loadingBadge);
          loadingBadge.remove();
        }

        return guessBadge;
      }
    }
  }

  // No cached guess - but check if there's a cached IQ (from previous calculation)
  // If IQ was already calculated, we should check if we want to show it directly
  // In IQGuessr mode: even without a guess, if IQ exists we could show it, but the game mode
  // requires a guess first, so we'll still create a guess badge.
  // However, if the tweet element already has the IQ result stored, we should use that.

  const tweetElementForDebug = loadingBadge.closest('article[data-testid="tweet"]') ||
                               loadingBadge.closest('article[role="article"]') ||
                               loadingBadge.closest('article');
  const tweetIdForDebug = tweetElementForDebug?.getAttribute('data-tweet-id');

  // Check if there's already an IQ result on the tweet element (from previous calculation)
  let iqResult = tweetElementForDebug?._iqResult;

  // Also try to get from IQ cache (for page refresh scenarios)
  if (!iqResult || !iqResult.iq) {
    const { getCachedIQ } = getIQCache();
    const { extractTweetHandle, extractTweetText } = getTextExtraction();
    if (getCachedIQ && extractTweetHandle && tweetElementForDebug) {
      const handle = extractTweetHandle(tweetElementForDebug);
      if (handle) {
        const cachedIQ = getCachedIQ(handle);
        if (cachedIQ && cachedIQ.iq_estimate !== undefined) {
          // Extract tweet text for debug data
          const tweetText = extractTweetText ? extractTweetText(tweetElementForDebug) : null;
          // Convert cached IQ format to match expected format
          iqResult = {
            iq: cachedIQ.iq_estimate,
            result: cachedIQ,
            confidence: cachedIQ.confidence,
            text: tweetText
          };

          // Store it on the tweet element for future use
          if (tweetElementForDebug) {
            tweetElementForDebug._iqResult = iqResult;
          }
        }
      }
    }
  }

  // Create a new guess badge (no cached guess, but IQ might be cached for later)
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

/**
 * Add a guess to history with full metadata
 */
function addGuessToHistory(tweetId, handle, guess, actualIQ, confidence, score) {
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

  // Get existing history
  chrome.storage.local.get([GUESS_HISTORY_KEY], (result) => {
    let history = result[GUESS_HISTORY_KEY] || [];

    // Add new entry at the beginning
    history.unshift(historyEntry);

    // Keep only last 1000 guesses to prevent storage bloat
    if (history.length > 1000) {
      history = history.slice(0, 1000);
    }

    // Save back to storage
    chrome.storage.local.set({ [GUESS_HISTORY_KEY]: history }, () => {});
  });
}

/**
 * Get all guess history
 */
function getGuessHistory(callback) {
  chrome.storage.local.get([GUESS_HISTORY_KEY], (result) => {
    callback(result[GUESS_HISTORY_KEY] || []);
  });
}

/**
 * Clear all guess history
 */
function clearGuessHistory(callback) {
  chrome.storage.local.remove([GUESS_HISTORY_KEY], () => {
    if (callback) callback();
  });
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
    cacheGuess,
    cacheRevealedIQ,
    getCachedRevealedIQ,
    addGuessToHistory,
    getGuessHistory,
    clearGuessHistory
  };
}

})();

