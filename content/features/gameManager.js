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
const getTweetProcessor = () => window.TweetProcessor || {};


// Game state
const guessManager = new Map(); // tweetElement -> { guess: number, confidence: number }
const GUESS_CACHE_PREFIX = 'iq_guess_';
const REVEALED_CACHE_PREFIX = 'iq_revealed_';
const REVEALED_IQ_CACHE_PREFIX = 'iq_revealed_iq_'; // Store IQ result by tweet ID as fallback
const GUESS_HISTORY_KEY = 'iqGuessrHistory';

// Track badge creation calls per tweet to detect duplicates
const badgeCreationCount = new Map(); // tweetId -> count

// Lock mechanism to prevent concurrent badge creation for the same tweet
const badgeCreationLocks = new Set(); // Set of tweetIds that are currently creating badges

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
  // Check if extension context is still valid
  if (!chrome || !chrome.storage || !chrome.runtime || !chrome.runtime.id) {
    return null;
  }

  const storageKey = GUESS_CACHE_PREFIX + key;
  return new Promise((resolve) => {
    try {
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
    } catch (error) {
      // Extension context invalidated or other error
      console.warn('[IQGuessr] Extension context invalidated, returning null for cached guess');
      resolve(null);
    }
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
  // Check if extension context is still valid
  if (!chrome || !chrome.storage || !chrome.runtime || !chrome.runtime.id) {
    return;
  }

  try {
    const storageKey = REVEALED_CACHE_PREFIX + key;
    const storageData = {};
    storageData[storageKey] = revealedEntry;
    chrome.storage.local.set(storageData);
  } catch (error) {
    console.warn('[IQGuessr] Extension context invalidated, cannot cache revealed IQ');
  }
}

/**
 * Get cached revealed IQ status for a tweet ID (async)
 */
async function getCachedRevealedIQ(tweetId) {
  if (!tweetId) return null;

  const key = generateGuessCacheKey(tweetId);
  if (!key) return null;

  // Check if extension context is still valid
  if (!chrome || !chrome.storage || !chrome.runtime || !chrome.runtime.id) {
    return null;
  }

  const storageKey = REVEALED_CACHE_PREFIX + key;
  return new Promise((resolve) => {
    try {
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
    } catch (error) {
      // Extension context invalidated or other error
      console.warn('[IQGuessr] Extension context invalidated, returning null for cached revealed IQ');
      resolve(null);
    }
  });
}

/**
 * Cache the revealed IQ result by tweet ID as a fallback
 * This ensures we can restore calculated badges even if handle lookup fails
 */
function cacheRevealedIQResult(tweetId, iqResultData) {
  if (!tweetId || !iqResultData) return;

  const key = generateGuessCacheKey(tweetId);
  if (!key) return;

  // Check if extension context is still valid
  if (!chrome || !chrome.storage || !chrome.runtime || !chrome.runtime.id) {
    return;
  }

  try {
    const storageKey = REVEALED_IQ_CACHE_PREFIX + key;
    const storageData = {};
    storageData[storageKey] = iqResultData;
    chrome.storage.local.set(storageData);
  } catch (error) {
    console.warn('[IQGuessr] Extension context invalidated, cannot cache revealed IQ result');
  }
}

/**
 * Get cached revealed IQ result by tweet ID (async)
 * This is a fallback when handle-based lookup fails
 */
async function getCachedRevealedIQResult(tweetId) {
  if (!tweetId) return null;

  const key = generateGuessCacheKey(tweetId);
  if (!key) return null;

  // Check if extension context is still valid
  if (!chrome || !chrome.storage || !chrome.runtime || !chrome.runtime.id) {
    return null;
  }

  const storageKey = REVEALED_IQ_CACHE_PREFIX + key;
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get([storageKey], (result) => {
        if (chrome.runtime.lastError) {
          resolve(null);
          return;
        }

        if (result[storageKey]) {
          resolve(result[storageKey]);
        } else {
          resolve(null);
        }
      });
    } catch (error) {
      // Extension context invalidated or other error
      console.warn('[IQGuessr] Extension context invalidated, returning null for cached revealed IQ result');
      resolve(null);
    }
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
  // Check if extension context is still valid
  if (!chrome || !chrome.storage || !chrome.runtime || !chrome.runtime.id) {
    return;
  }

  try {
    const storageKey = GUESS_CACHE_PREFIX + key;
    const storageData = {};
    storageData[storageKey] = cacheEntry;
    chrome.storage.local.set(storageData);
  } catch (error) {
    console.warn('[IQGuessr] Extension context invalidated, cannot cache guess');
  }
}

/**
 * Load all guesses from storage into memory
 */
function loadGuessCache() {
  // Check if extension context is still valid
  if (!chrome || !chrome.storage || !chrome.runtime || !chrome.runtime.id) {
    return;
  }

  try {
    chrome.storage.local.get(null, (items) => {
      if (chrome.runtime.lastError) {
        return;
      }

      for (const [key, value] of Object.entries(items)) {
        if (key.startsWith(GUESS_CACHE_PREFIX)) {
          const cacheKey = key.replace(GUESS_CACHE_PREFIX, '');
          if (value && typeof value === 'object') {
            persistentGuessCache.set(cacheKey, value);
          }
        }
      }
    });
  } catch (error) {
    console.warn('[IQGuessr] Extension context invalidated, cannot load guess cache');
  }
}

// Load cache on initialization
loadGuessCache();

/**
 * Set up MutationObserver to detect and remove duplicate guess badges
 * This catches duplicates that slip through the normal checks
 */
function setupDuplicateBadgeObserver() {
  // Use a map to track last cleanup time per tweet to debounce
  const lastCleanupTime = new Map();
  let cleanupTimeout = null;

  const performCleanup = () => {
    // Find all tweets with guess badges
    const allTweets = document.querySelectorAll('article[data-testid="tweet"], article[role="article"]');
    const tweetsWithGuessBadges = new Set();

    allTweets.forEach(tweet => {
      const guessBadges = [
        ...tweet.querySelectorAll('.iq-badge[data-iq-guess="true"]'),
        ...tweet.querySelectorAll('.iq-badge-guess'),
        ...tweet.querySelectorAll('[data-iq-guess="true"]')
      ];

      if (guessBadges.length > 1) {
        tweetsWithGuessBadges.add(tweet);
      }
    });

    // Cleanup duplicates
    tweetsWithGuessBadges.forEach(tweet => {
      const tweetId = tweet.getAttribute('data-tweet-id');
      const now = Date.now();
      const lastCleanup = lastCleanupTime.get(tweetId) || 0;

      // Debounce: only cleanup once per tweet per 200ms
      if (now - lastCleanup > 200) {
        lastCleanupTime.set(tweetId, now);
        cleanupDuplicateGuessBadges(tweet);
      }
    });
  };

  const observer = new MutationObserver((mutations) => {
    let hasGuessBadgeChanges = false;

    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        // Check if the added node is a guess badge or contains guess badges
        if (node.nodeType === Node.ELEMENT_NODE) {
          const isGuessBadge = (node.classList && node.classList.contains('iq-badge-guess')) ||
                               (node.hasAttribute && node.hasAttribute('data-iq-guess'));

          if (isGuessBadge || (node.querySelector && node.querySelector('.iq-badge-guess, [data-iq-guess="true"]'))) {
            hasGuessBadgeChanges = true;
          }
        }
      });
    });

    if (hasGuessBadgeChanges) {
      // Debounce cleanup to batch multiple mutations
      if (cleanupTimeout) {
        clearTimeout(cleanupTimeout);
      }
      cleanupTimeout = setTimeout(() => {
        performCleanup();
      }, 100);
    }
  });

  // Start observing the document for added nodes
  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Also run periodic cleanup every 2 seconds as a safety net
  setInterval(() => {
    performCleanup();
  }, 2000);

  return observer;
}

// Set up the observer when the module loads
if (typeof document !== 'undefined' && document.body) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setupDuplicateBadgeObserver();
    });
  } else {
    setupDuplicateBadgeObserver();
  }
}

/**
 * Check if IQ Guessr mode is enabled
 */
function isGameModeEnabled() {
  const settings = getSettings();
  return settings.enableIQGuessr === true;
}

/**
 * Create a grey guess badge that can be clicked to input a guess
 * @param {HTMLElement} tweetElement - Optional tweet element to track badge creation per tweet
 */
function createGuessBadge(tweetElement = null) {
  // Track badge creation per tweet to detect duplicates
  let tweetId = null;
  let tweetHandle = null;

  if (tweetElement) {
    tweetId = tweetElement.getAttribute('data-tweet-id');
    tweetHandle = tweetElement.getAttribute('data-handle');

    // If no tweet ID, try to find nested tweet
    if (!tweetId) {
      const nestedTweet = tweetElement.querySelector('article[data-testid="tweet"]') ||
                         tweetElement.querySelector('article[role="article"]');
      if (nestedTweet && nestedTweet !== tweetElement) {
        tweetId = nestedTweet.getAttribute('data-tweet-id');
        tweetHandle = nestedTweet.getAttribute('data-handle');
      }
    }
  }

  // If we have a tweet ID, track creation count
  if (tweetId) {
    const currentCount = badgeCreationCount.get(tweetId) || 0;
    const newCount = currentCount + 1;
    badgeCreationCount.set(tweetId, newCount);
  }

  const badge = document.createElement('span');
  badge.className = 'iq-badge iq-badge-guess';
  badge.setAttribute('data-iq-guess', 'true');

  // Store tweet ID on badge for debugging
  if (tweetId) {
    badge.setAttribute('data-created-for-tweet-id', tweetId);
  }

  // Attach creation context if available
  if (window.BadgeCreation && window.BadgeCreation.attachCreationContext) {
    window.BadgeCreation.attachCreationContext(badge, 'guess');
  }

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
    e.preventDefault();
    e.stopPropagation();
    makeBadgeEditable(badge);
  });

  // Add touchend handler for mobile compatibility
  badge.addEventListener('touchend', (e) => {
    e.preventDefault();
    e.stopPropagation();
    makeBadgeEditable(badge);
  }, { passive: false });

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

  // Ensure input receives focus properly - use setTimeout for mobile compatibility
  setTimeout(() => {
    if (input.parentElement && document.activeElement !== input) {
      input.focus();
      input.select();
    }
  }, 50);

  // Track if guess has been submitted to prevent double submission
  let submitted = false;

  // Handle blur or enter key
  const submitGuess = () => {
    if (submitted) {
      return;
    }

    const value = parseInt(input.value, 10);

    if (value >= 55 && value <= 145) {
      // Mark as submitted AFTER validation passes to prevent double submission
      submitted = true;
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
        // Check both actualTweetElement and tweetElement for nested structures
        const actualTweetElement = tweetElement.querySelector('article[data-testid="tweet"]') ||
                                 tweetElement.querySelector('article[role="article"]') ||
                                 tweetElement;

        const iqResult = actualTweetElement._iqResult || tweetElement._iqResult;

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

        if (iqResult && iqResult.iq !== null && iqResult.iq !== undefined) {
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
        } else {
          // If calculation hasn't happened yet, trigger it
          // Check both actualTweetElement and tweetElement for nested structures
          const actualTweetElement = tweetElement.querySelector('article[data-testid="tweet"]') ||
                                   tweetElement.querySelector('article[role="article"]') ||
                                   tweetElement;

          // If already analyzed but no IQ result, force calculation
          if (actualTweetElement.hasAttribute('data-iq-analyzed') && !actualTweetElement._iqResult) {
            // Try to force calculation by removing the analyzed flag and calling processTweet
            const tweetProcessor = getTweetProcessor();
            if (tweetProcessor && tweetProcessor.processTweet) {
              actualTweetElement.removeAttribute('data-iq-analyzed');

              tweetProcessor.processTweet(tweetElement).then(() => {
                const newIqResult = actualTweetElement._iqResult || tweetElement._iqResult;

                if (newIqResult && newIqResult.iq !== null && newIqResult.iq !== undefined) {
                  const badgeManager = getBadgeManager();
                  if (badgeManager && badgeManager.getIQColor) {
                    const iqColor = getSettings().useConfidenceForColor && newIqResult.confidence
                      ? badgeManager.getConfidenceColor(newIqResult.confidence)
                      : badgeManager.getIQColor(newIqResult.iq);
                    revealActualScore(badge, newIqResult.iq, iqColor, newIqResult.confidence, newIqResult.result, newIqResult.text);
                  }
                } else {
                  // Fallback: Calculate IQ directly
                  const textExtraction = getTextExtraction();
                  const extractTweetText = textExtraction ? textExtraction.extractTweetText : null;

                  if (extractTweetText) {
                    const tweetText = extractTweetText(actualTweetElement);

                    if (tweetText && tweetText.trim().length > 0) {
                      // Get IQ estimator - need to instantiate it
                      const IQEstimatorClass = window.ComprehensiveIQEstimatorUltimate;
                      if (IQEstimatorClass) {
                        const iqEstimator = new IQEstimatorClass();
                        iqEstimator.estimate(tweetText).then((result) => {
                          if (result && result.is_valid && result.iq_estimate !== null) {
                            const iq = Math.round(result.iq_estimate);
                            const confidence = result.confidence ? Math.round(result.confidence) : null;

                            // Store result
                            actualTweetElement._iqResult = {
                              iq: iq,
                              result: result,
                              confidence: confidence,
                              text: tweetText
                            };

                            // Reveal score
                            const badgeManager = getBadgeManager();
                            if (badgeManager && badgeManager.getIQColor) {
                              const iqColor = getSettings().useConfidenceForColor && confidence
                                ? badgeManager.getConfidenceColor(confidence)
                                : badgeManager.getIQColor(iq);
                              revealActualScore(badge, iq, iqColor, confidence, result, tweetText);
                            }
                          }
                        }).catch(() => {
                          // Silently fail
                        });
                      }
                    }
                  }
                }
              }).catch(() => {
                // Silently fail
              });
            }

            // Also wait a bit in case calculation is in progress
            let checkCount = 0;
            const checkInterval = setInterval(() => {
              checkCount++;
              const currentResult = actualTweetElement._iqResult || tweetElement._iqResult;

              if (currentResult) {
                clearInterval(checkInterval);
                const newIqResult = currentResult;
                if (newIqResult && newIqResult.iq !== null && newIqResult.iq !== undefined) {
                  const badgeManager = getBadgeManager();
                  if (badgeManager && badgeManager.getIQColor) {
                    const iqColor = getSettings().useConfidenceForColor && newIqResult.confidence
                      ? badgeManager.getConfidenceColor(newIqResult.confidence)
                      : badgeManager.getIQColor(newIqResult.iq);
                    revealActualScore(badge, newIqResult.iq, iqColor, newIqResult.confidence, newIqResult.result, newIqResult.text);
                  }
                }
              } else if (checkCount >= 30) {
                // Timeout after 3 seconds (30 * 100ms)
                clearInterval(checkInterval);
              }
            }, 100);
          } else {
            // Not analyzed yet, trigger calculation
            const tweetProcessor = getTweetProcessor();
            if (tweetProcessor && tweetProcessor.processTweet) {
              // Remove analyzed flag temporarily to allow processing
              const wasAnalyzed = actualTweetElement.hasAttribute('data-iq-analyzed');
              if (wasAnalyzed) {
                actualTweetElement.removeAttribute('data-iq-analyzed');
              }

              tweetProcessor.processTweet(tweetElement).then(() => {
                // Check both actualTweetElement and tweetElement for nested structures
                const newIqResult = actualTweetElement._iqResult || tweetElement._iqResult;
                if (newIqResult && newIqResult.iq !== null && newIqResult.iq !== undefined) {
                  const badgeManager = getBadgeManager();
                  if (badgeManager && badgeManager.getIQColor) {
                    const iqColor = getSettings().useConfidenceForColor && newIqResult.confidence
                      ? badgeManager.getConfidenceColor(newIqResult.confidence)
                      : badgeManager.getIQColor(newIqResult.iq);
                    revealActualScore(badge, newIqResult.iq, iqColor, newIqResult.confidence, newIqResult.result, newIqResult.text);
                  }
                }
              }).catch(() => {
                // Silently fail
              });
            }
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

  // Track if Enter is being processed to prevent duplicate submissions
  let enterProcessing = false;

  // Handle Enter key - support multiple event types for better compatibility
  const handleEnterKey = (e) => {
    // Check for Enter key in multiple ways for compatibility
    const isEnter = e.key === 'Enter' ||
                   e.keyCode === 13 ||
                   e.which === 13 ||
                   e.code === 'Enter' ||
                   (e.type === 'keypress' && (e.keyCode === 13 || e.which === 13));

    if (isEnter) {
      // Prevent duplicate processing if already handling Enter
      if (enterProcessing || submitted) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      e.preventDefault();
      e.stopPropagation();
      enterProcessing = true; // Mark as processing to prevent duplicate calls

      // Use setTimeout(0) to ensure this happens after current event loop
      setTimeout(() => {
        submitGuess();
        enterProcessing = false; // Reset after processing
      }, 0);

      return false;
    }
    return true;
  };

  // Only add keydown listener - keypress can cause duplicate submissions
  input.addEventListener('keydown', handleEnterKey, true);

  // Also handle Enter via keyup as fallback (some mobile keyboards)
  input.addEventListener('keyup', (e) => {
    const isEnter = e.key === 'Enter' || e.keyCode === 13 || e.which === 13 || e.code === 'Enter';

    // Only process if not already submitted and not currently processing
    if (isEnter && !submitted && !enterProcessing) {
      e.preventDefault();
      e.stopPropagation();
      enterProcessing = true;
      setTimeout(() => {
        submitGuess();
        enterProcessing = false;
      }, 0);
    }
  }, true);

  // Handle Escape key
  input.addEventListener('keydown', (e) => {
    const isEscape = e.key === 'Escape' || e.keyCode === 27 || e.which === 27;
    if (isEscape) {
      e.preventDefault();
      e.stopPropagation();
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
  }, true);

  // Delay blur handler to allow Enter key to process first
  let blurTimeout;
  input.addEventListener('blur', (e) => {
    // Clear any existing timeout
    if (blurTimeout) {
      clearTimeout(blurTimeout);
    }
    // Delay blur handling slightly to allow Enter key to process
    blurTimeout = setTimeout(() => {
      if (!submitted) {
        submitGuess();
      }
    }, 150);
  });

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
  // Validate actualIQ - if it's invalid or NaN, return early
  if (!actualIQ || isNaN(actualIQ) || actualIQ < 55 || actualIQ > 145) {
    return;
  }

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

      // Store that this IQ was revealed (so it stays calculated after refresh/iqguessr toggle)
      // This should happen regardless of whether there's a guess
      const tweetIdForReveal = tweetElement ? tweetElement.getAttribute('data-tweet-id') : null;
      if (tweetIdForReveal) {
        cacheRevealedIQ(tweetIdForReveal);

        // Also cache the IQ result by tweet ID as a fallback (in case handle lookup fails)
        // This ensures we can restore the calculated badge even if handle extraction fails
        const iqResultData = {
          iq: actualIQ,
          confidence: confidence,
          result: result || {}, // Ensure result exists, use empty object if not
          timestamp: new Date().toISOString()
        };
        cacheRevealedIQResult(tweetIdForReveal, iqResultData);
      }

      // Calculate and add score
      if (hasGuess && guessData) {
        const score = calculateGuessScore(guessData.guess, actualIQ, guessData.confidence);
        addToGameScore(score);

        // Mark badge as compared (has been compared to a guess)
        badge.setAttribute('data-iq-compared', 'true');

        // Add to history
        const tweetId = tweetElement ? tweetElement.getAttribute('data-tweet-id') : null;
        const handle = tweetElement ? tweetElement.getAttribute('data-handle') : null;
        if (tweetId) {
          addGuessToHistory(tweetId, handle, guessData.guess, actualIQ, guessData.confidence, score);
        }

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
  // Check if extension context is still valid
  if (!chrome || !chrome.storage || !chrome.runtime || !chrome.runtime.id) {
    console.warn('[IQGuessr] Extension context invalidated, cannot update score');
    return;
  }

  try {
    chrome.storage.sync.get(['iqGuessrScore'], (result) => {
      if (chrome.runtime.lastError) {
        return;
      }

      const currentScore = result.iqGuessrScore || 0;
      const newScore = currentScore + points;

      try {
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
      } catch (error) {
        console.warn('[IQGuessr] Extension context invalidated, cannot save score');
      }
    });
  } catch (error) {
    console.warn('[IQGuessr] Extension context invalidated, cannot get score');
  }
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
 * Helper function to find existing guess badge in a tweet element
 * Returns the existing badge if found, null otherwise
 */
function findExistingGuessBadge(tweetElement) {
  if (!tweetElement) {
    return null;
  }

  // Check for nested tweet structure
  const nestedTweet = tweetElement.querySelector('article[data-testid="tweet"]') ||
                     tweetElement.querySelector('article[role="article"]');
  const actualTweetElement = nestedTweet && nestedTweet !== tweetElement ? nestedTweet : tweetElement;

  // Look for existing guess badges in both outer and nested tweet elements
  // Use more specific selector to catch all variations
  let existingGuessBadge = actualTweetElement.querySelector('.iq-badge[data-iq-guess="true"]') ||
                          actualTweetElement.querySelector('.iq-badge-guess') ||
                          actualTweetElement.querySelector('[data-iq-guess="true"]');

  // Also check in outer wrapper if nested
  if (!existingGuessBadge && nestedTweet && nestedTweet !== tweetElement) {
    existingGuessBadge = tweetElement.querySelector('.iq-badge[data-iq-guess="true"]') ||
                        tweetElement.querySelector('.iq-badge-guess') ||
                        tweetElement.querySelector('[data-iq-guess="true"]');
  }

  return existingGuessBadge || null;
}

/**
 * Cleanup duplicate guess badges in a tweet, keeping only one
 * Prioritizes badges that have been interacted with (data-iq-guessed)
 */
function cleanupDuplicateGuessBadges(tweetElement) {
  if (!tweetElement) {
    return;
  }

  // Check for nested tweet structure
  const nestedTweet = tweetElement.querySelector('article[data-testid="tweet"]') ||
                     tweetElement.querySelector('article[role="article"]');
  const actualTweetElement = nestedTweet && nestedTweet !== tweetElement ? nestedTweet : tweetElement;

  // Find all guess badges in both outer and nested tweet elements
  // Also check within engagement bars specifically (where duplicates often appear)
  // Use multiple selectors to catch all variations
  const allGuessBadges = [
    ...actualTweetElement.querySelectorAll('.iq-badge[data-iq-guess="true"]'),
    ...actualTweetElement.querySelectorAll('.iq-badge-guess'),
    ...actualTweetElement.querySelectorAll('[data-iq-guess="true"]'),
    ...(nestedTweet && nestedTweet !== tweetElement ? [
      ...tweetElement.querySelectorAll('.iq-badge[data-iq-guess="true"]'),
      ...tweetElement.querySelectorAll('.iq-badge-guess'),
      ...tweetElement.querySelectorAll('[data-iq-guess="true"]')
    ] : [])
  ].filter((badge, index, self) =>
    // Remove duplicates from the array itself
    index === self.findIndex(b => b === badge)
  );

  // If we have duplicates, keep only one
  if (allGuessBadges.length > 1) {
    // Prioritize badge that has been interacted with (user typed in a guess)
    const interactedBadge = allGuessBadges.find(badge => badge.hasAttribute('data-iq-guessed'));

    // If no interacted badge, prioritize the first one in DOM order
    const badgeToKeep = interactedBadge || allGuessBadges[0];

    // Remove all others
    for (const badge of allGuessBadges) {
      if (badge !== badgeToKeep) {
        // Double-check it's actually a duplicate (same tweet)
        const badgeTweet = badge.closest('article[data-testid="tweet"]') ||
                          badge.closest('article[role="article"]') ||
                          badge.closest('article');
        const badgeTweetId = badgeTweet?.getAttribute('data-tweet-id');
        const actualTweetId = actualTweetElement?.getAttribute('data-tweet-id');

        // Only remove if it's on the same tweet
        if (!badgeTweetId || !actualTweetId || badgeTweetId === actualTweetId) {
          if (badge.parentElement) {
            badge.remove();
          }
        }
      }
    }

    return badgeToKeep;
  }

  return allGuessBadges.length > 0 ? allGuessBadges[0] : null;
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

  if (!tweetElement) {
    return null;
  }

  const tweetId = tweetElement.getAttribute('data-tweet-id');

  if (!tweetId) {
    return null;
  }

  // CRITICAL: Lock mechanism to prevent concurrent badge creation for the same tweet
  // If another call is already creating a badge for this tweet, wait and check again
  if (badgeCreationLocks.has(tweetId)) {
    // Wait a bit and check if a badge was created by the other call
    await new Promise(resolve => setTimeout(resolve, 50));
    const existingBadge = findExistingGuessBadge(tweetElement);
    if (existingBadge) {
      // Another call created the badge, just remove this loading badge and return existing
      if (loadingBadge.parentElement && loadingBadge !== existingBadge) {
        loadingBadge.remove();
      }
      return existingBadge;
    }
    // Still no badge, continue (but this shouldn't happen often)
  }

  // Acquire lock for this tweet
  badgeCreationLocks.add(tweetId);

  try {
    // CRITICAL: Check if there's already a badge on this tweet (guess or calculated)
    // Check for nested tweet structure
    const nestedTweet = tweetElement.querySelector('article[data-testid="tweet"]') ||
                       tweetElement.querySelector('article[role="article"]');
    const actualTweetElement = nestedTweet && nestedTweet !== tweetElement ? nestedTweet : tweetElement;

    // First check for calculated badges (flip badges) - these take priority
    let existingCalculatedBadge = actualTweetElement.querySelector('.iq-badge-flip') ||
                                  actualTweetElement.querySelector('.iq-badge[data-iq-score]') ||
                                  actualTweetElement.querySelector('[data-iq-score]');

    // Also check in outer wrapper if nested
    if (!existingCalculatedBadge && nestedTweet && nestedTweet !== tweetElement) {
      existingCalculatedBadge = tweetElement.querySelector('.iq-badge-flip') ||
                                tweetElement.querySelector('.iq-badge[data-iq-score]') ||
                                tweetElement.querySelector('[data-iq-score]');
    }

    if (existingCalculatedBadge) {
      // There's already a calculated badge - remove the loading badge and return the existing one
      if (loadingBadge.parentElement && loadingBadge !== existingCalculatedBadge) {
        loadingBadge.remove();
      }
      return existingCalculatedBadge;
    }

    // Then check for guess badges
    const existingGuessBadge = findExistingGuessBadge(tweetElement);
    if (existingGuessBadge) {
      // There's already a guess badge - remove the loading badge and return the existing one
      if (loadingBadge.parentElement && loadingBadge !== existingGuessBadge) {
        loadingBadge.remove();
      }
      return existingGuessBadge;
    }

    // CRITICAL: FIRST check if IQ was already revealed (calculated score badge should be shown)
    // This must happen BEFORE checking for cached guess to ensure calculated badges always take priority
    const cachedRevealed = await getCachedRevealedIQ(tweetId);

    if (cachedRevealed) {
      // IQ was previously revealed - try to restore calculated badge
      let iqResult = tweetElement._iqResult;

      // If no IQ result on tweet element, try to get from IQ cache
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
            let cachedIQ = getCachedIQ(handle);

            // If cachedRevealed=true but cachedIQ is null, wait and retry multiple times (cache might still be loading from storage)
            if (!cachedIQ && cachedRevealed) {
              // Try loading from storage directly if cache module has loadCache function
              const { loadCache } = getIQCache();
              if (loadCache) {
                // Force reload from storage
                loadCache();
                // Wait a bit for async load to complete
                await new Promise(resolve => setTimeout(resolve, 150));
                cachedIQ = getCachedIQ(handle);
              }

              // If still not found, wait a bit more and retry once more
              if (!cachedIQ) {
                await new Promise(resolve => setTimeout(resolve, 150));
                cachedIQ = getCachedIQ(handle);
              }

              // If still not found via handle, try fallback: get IQ result directly by tweet ID
              if (!cachedIQ || !cachedIQ.iq_estimate) {
                const cachedIQResult = await getCachedRevealedIQResult(tweetId);
                if (cachedIQResult && cachedIQResult.iq) {
                  // Convert to expected format - merge result object if it exists
                  cachedIQ = {
                    iq_estimate: cachedIQResult.iq,
                    confidence: cachedIQResult.confidence,
                    ...(cachedIQResult.result || {})
                  };
                }
              }
            }

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
              // Store it on the tweet element for future use
              tweetElement._iqResult = iqResult;
            }
          }
        }
      }

      if (iqResult && iqResult.iq !== undefined && iqResult.result) {
        // We have revealed IQ and cached IQ - create calculated badge
        const badgeManager = getBadgeManager();
        if (badgeManager && badgeManager.createIQBadge) {
          const iq = Math.round(iqResult.iq);

          // Create the actual IQ badge with proper parameters
          const iqBadge = badgeManager.createIQBadge(iq, iqResult.result, iqResult.text);

          // Also check if there's a cached guess to store in memory for reference
          const cachedGuess = await getCachedGuess(tweetId);
          if (cachedGuess && cachedGuess.guess !== undefined) {
            guessManager.set(tweetElement, {
              guess: cachedGuess.guess,
              confidence: cachedGuess.confidence
            });
            // Mark badge as compared if there's both a cached guess and revealed IQ
            iqBadge.setAttribute('data-iq-compared', 'true');
          }

          // CRITICAL: Final duplicate check RIGHT BEFORE insertion to prevent race conditions
          const finalCheckBadgeIQ = findExistingGuessBadge(tweetElement);
          if (finalCheckBadgeIQ && finalCheckBadgeIQ !== iqBadge) {
            // Another badge was inserted while we were creating this one - remove this one and return the existing
            if (loadingBadge.parentElement) {
              loadingBadge.remove();
            }
            return finalCheckBadgeIQ;
          }

          // Insert it in the same position
          if (loadingBadge.parentElement) {
            loadingBadge.parentElement.insertBefore(iqBadge, loadingBadge);
            loadingBadge.remove();
          }

          return iqBadge;
        }
        }
    }

    // Get tweet ID (already checked above, but need it for async operations)
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

            // Mark badge as compared since there's a cached guess (meaning it was compared)
            iqBadge.setAttribute('data-iq-compared', 'true');

            // Store the guess in memory for reference
            guessManager.set(tweetElement, {
              guess: cachedGuess.guess,
              confidence: cachedGuess.confidence
            });

            // CRITICAL: Final duplicate check RIGHT BEFORE insertion to prevent race conditions
            const finalCheckBadgeIQ = findExistingGuessBadge(tweetElement);
            if (finalCheckBadgeIQ && finalCheckBadgeIQ !== iqBadge) {
              // Another badge was inserted while we were creating this one - remove this one and return the existing
              if (loadingBadge.parentElement) {
                loadingBadge.remove();
              }
              return finalCheckBadgeIQ;
            }

            // Insert it in the same position
            if (loadingBadge.parentElement) {
              loadingBadge.parentElement.insertBefore(iqBadge, loadingBadge);
              loadingBadge.remove();
            }

            return iqBadge;
          }
        }
        // We have a guess but no IQ yet, create a regular guess badge with the cached value
        // Double-check for existing guess badge before creating (race condition protection)
        const existingGuessBadgeCheck = findExistingGuessBadge(tweetElement);
        if (existingGuessBadgeCheck) {
          // Badge already exists, just remove loading badge and return existing
          if (loadingBadge.parentElement && loadingBadge !== existingGuessBadgeCheck) {
            loadingBadge.remove();
          }
          return existingGuessBadgeCheck;
        }

        const guessBadge = createGuessBadge(tweetElement);

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

        // CRITICAL: Final duplicate check RIGHT BEFORE insertion to prevent race conditions
        const finalCheckBadge = findExistingGuessBadge(tweetElement);
        if (finalCheckBadge && finalCheckBadge !== guessBadge) {
          // Another badge was inserted while we were creating this one - remove this one and return the existing
          if (loadingBadge.parentElement) {
            loadingBadge.remove();
          }
          return finalCheckBadge;
        }

        // Insert it in the same position
        if (loadingBadge.parentElement) {
          loadingBadge.parentElement.insertBefore(guessBadge, loadingBadge);
          loadingBadge.remove();
        }

        return guessBadge;
      }
    }

    // No cached guess - but check if there's a cached IQ (from previous calculation)
    // If IQ was already calculated, we should check if we want to show it directly
    // In IQGuessr mode: even without a guess, if IQ exists we could show it, but the game mode
    // requires a guess first, so we'll still create a guess badge.
    // However, if the tweet element already has the IQ result stored, we should use that.

    // Check if there's already an IQ result on the tweet element (from previous calculation)
    let iqResult = tweetElement._iqResult;

    // Also try to get from IQ cache (for page refresh scenarios)
    if (!iqResult || !iqResult.iq) {
      const { getCachedIQ } = getIQCache();
      const { extractTweetHandle, extractTweetText } = getTextExtraction();
      if (getCachedIQ && extractTweetHandle && tweetElement) {
        const handle = extractTweetHandle(tweetElement);
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

            // Store it on the tweet element for future use
            if (tweetElement) {
              tweetElement._iqResult = iqResult;
            }
          }
        }
      }
    }

    // Create a new guess badge (no cached guess, but IQ might be cached for later)
    // Final check for existing guess badge before creating (race condition protection)
    const existingGuessBadgeFinal = findExistingGuessBadge(tweetElement);
    if (existingGuessBadgeFinal) {
      // Badge already exists, just remove loading badge and return existing
      if (loadingBadge.parentElement && loadingBadge !== existingGuessBadgeFinal) {
        loadingBadge.remove();
      }
      return existingGuessBadgeFinal;
    }

    const guessBadge = createGuessBadge(tweetElement);

    // CRITICAL: Final duplicate check RIGHT BEFORE insertion to prevent race conditions
    const finalCheckBadge = findExistingGuessBadge(tweetElement);
    if (finalCheckBadge && finalCheckBadge !== guessBadge) {
      // Another badge was inserted while we were creating this one - remove this one and return the existing
      if (loadingBadge.parentElement) {
        loadingBadge.remove();
      }
      return finalCheckBadge;
    }

    // Insert it in the same position
    if (loadingBadge.parentElement) {
      loadingBadge.parentElement.insertBefore(guessBadge, loadingBadge);
      loadingBadge.remove();
    }

    return guessBadge;
  } finally {
    // Always release the lock, even if an error occurred
    badgeCreationLocks.delete(tweetId);
  }
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

  // Check if extension context is still valid
  if (!chrome || !chrome.storage || !chrome.runtime || !chrome.runtime.id) {
    return;
  }

  // Get existing history
  try {
    chrome.storage.local.get([GUESS_HISTORY_KEY], (result) => {
      if (chrome.runtime.lastError) {
        return;
      }

      let history = result[GUESS_HISTORY_KEY] || [];

      // Add new entry at the beginning
      history.unshift(historyEntry);

      // Keep only last 1000 guesses to prevent storage bloat
      if (history.length > 1000) {
        history = history.slice(0, 1000);
      }

      // Save back to storage
      try {
        chrome.storage.local.set({ [GUESS_HISTORY_KEY]: history }, () => {});
      } catch (error) {
        console.warn('[IQGuessr] Extension context invalidated, cannot save history');
      }
    });
  } catch (error) {
    console.warn('[IQGuessr] Extension context invalidated, cannot get history');
  }
}

/**
 * Get all guess history
 */
function getGuessHistory(callback) {
  // Check if extension context is still valid
  if (!chrome || !chrome.storage || !chrome.runtime || !chrome.runtime.id) {
    callback([]);
    return;
  }

  try {
    chrome.storage.local.get([GUESS_HISTORY_KEY], (result) => {
      if (chrome.runtime.lastError) {
        callback([]);
        return;
      }
      callback(result[GUESS_HISTORY_KEY] || []);
    });
  } catch (error) {
    console.warn('[IQGuessr] Extension context invalidated, cannot get history');
    callback([]);
  }
}

/**
 * Clear all guess history
 */
function clearGuessHistory(callback) {
  // Check if extension context is still valid
  if (!chrome || !chrome.storage || !chrome.runtime || !chrome.runtime.id) {
    if (callback) callback();
    return;
  }

  try {
    chrome.storage.local.remove([GUESS_HISTORY_KEY], () => {
      if (callback) callback();
    });
  } catch (error) {
    console.warn('[IQGuessr] Extension context invalidated, cannot clear history');
    if (callback) callback();
  }
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
    cacheRevealedIQResult,
    getCachedRevealedIQResult,
    addGuessToHistory,
    getGuessHistory,
    clearGuessHistory,
    cleanupDuplicateGuessBadges
  };
}

})();

