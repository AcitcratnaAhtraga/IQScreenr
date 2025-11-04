/**
 * Game Manager for IQ Guessr
 * Main entry point that coordinates all game manager modules
 * Handles game logic, scoring, and guess input
 */

(function() {
  'use strict';

  /**
   * Get dependencies from other modules
   */
  const getSettings = () => window.Settings || {};
  const getBadgeManager = () => window.BadgeManager || {};
  const getIQCache = () => window.IQCache || {};
  const getTextExtraction = () => window.TextExtraction || {};
  const getTweetProcessor = () => window.TweetProcessor || {};

  /**
   * Check if IQ Guessr mode is enabled
   */
  function isGameModeEnabled() {
    const logic = window.GameManagerLogic;
    return logic && logic.isGameModeEnabled ? logic.isGameModeEnabled() : false;
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

    const badges = window.GameManagerBadges;
    const cache = window.GameManagerCache;

    if (!badges || !cache) {
      return null;
    }

    // CRITICAL: Lock mechanism to prevent concurrent badge creation for the same tweet
    // If another call is already creating a badge for this tweet, wait and check again
    if (badges.hasBadgeCreationLock && badges.hasBadgeCreationLock(tweetId)) {
      // Wait a bit and check if a badge was created by the other call
      await new Promise(resolve => setTimeout(resolve, 50));
      const existingBadge = badges.findExistingGuessBadge(tweetElement);
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
    if (badges.acquireBadgeCreationLock && !badges.acquireBadgeCreationLock(tweetId)) {
      // Failed to acquire lock, wait and check again
      await new Promise(resolve => setTimeout(resolve, 50));
      const existingBadge = badges.findExistingGuessBadge(tweetElement);
      if (existingBadge) {
        if (loadingBadge.parentElement && loadingBadge !== existingBadge) {
          loadingBadge.remove();
        }
        return existingBadge;
      }
    }

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
      const existingGuessBadge = badges.findExistingGuessBadge(tweetElement);
      if (existingGuessBadge) {
        // There's already a guess badge - remove the loading badge and return the existing one
        if (loadingBadge.parentElement && loadingBadge !== existingGuessBadge) {
          loadingBadge.remove();
        }
        return existingGuessBadge;
      }

      // CRITICAL: FIRST check if IQ was already revealed (calculated score badge should be shown)
      // This must happen BEFORE checking for cached guess to ensure calculated badges always take priority
      const cachedRevealed = await cache.getCachedRevealedIQ(tweetId);

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
                  const cachedIQResult = await cache.getCachedRevealedIQResult(tweetId);
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
            const cachedGuess = await cache.getCachedGuess(tweetId);
            const logic = window.GameManagerLogic;
            if (cachedGuess && cachedGuess.guess !== undefined && logic && logic.setGuess) {
              // Store guess in memory for reference
              logic.setGuess(tweetElement, {
                guess: cachedGuess.guess,
                confidence: cachedGuess.confidence
              });
              // Mark badge as compared if there's a cached guess
              iqBadge.setAttribute('data-iq-compared', 'true');
            }

            // CRITICAL: Final duplicate check RIGHT BEFORE insertion to prevent race conditions
            const finalCheckBadgeIQ = badges.findExistingGuessBadge(tweetElement);
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
        const cachedGuess = await cache.getCachedGuess(tweetId);
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
              const logic = window.GameManagerLogic;
              if (logic && logic.setGuess) {
                logic.setGuess(tweetElement, {
                  guess: cachedGuess.guess,
                  confidence: cachedGuess.confidence
                });
              }

              // CRITICAL: Final duplicate check RIGHT BEFORE insertion to prevent race conditions
              const finalCheckBadgeIQ = badges.findExistingGuessBadge(tweetElement);
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
          const existingGuessBadgeCheck = badges.findExistingGuessBadge(tweetElement);
          if (existingGuessBadgeCheck) {
            // Badge already exists, just remove loading badge and return existing
            if (loadingBadge.parentElement && loadingBadge !== existingGuessBadgeCheck) {
              loadingBadge.remove();
            }
            return existingGuessBadgeCheck;
          }

          const guessBadge = badges.createGuessBadge(tweetElement);

          // Set the cached guess value
          const scoreElement = guessBadge.querySelector('.iq-score');
          if (scoreElement) {
            scoreElement.textContent = cachedGuess.guess;
          }
          guessBadge.setAttribute('data-iq-guessed', cachedGuess.guess);

          // Store in memory
          const logic = window.GameManagerLogic;
          if (logic && logic.setGuess) {
            logic.setGuess(tweetElement, {
              guess: cachedGuess.guess,
              confidence: cachedGuess.confidence
            });
          }

          // CRITICAL: Final duplicate check RIGHT BEFORE insertion to prevent race conditions
          const finalCheckBadge = badges.findExistingGuessBadge(tweetElement);
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
      const existingGuessBadgeFinal = badges.findExistingGuessBadge(tweetElement);
      if (existingGuessBadgeFinal) {
        // Badge already exists, just remove loading badge and return existing
        if (loadingBadge.parentElement && loadingBadge !== existingGuessBadgeFinal) {
          loadingBadge.remove();
        }
        return existingGuessBadgeFinal;
      }

      const guessBadge = badges.createGuessBadge(tweetElement);

      // CRITICAL: Final duplicate check RIGHT BEFORE insertion to prevent race conditions
      const finalCheckBadge = badges.findExistingGuessBadge(tweetElement);
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
      if (badges.releaseBadgeCreationLock) {
        badges.releaseBadgeCreationLock(tweetId);
      }
    }
  }

  // Export for use in other modules
  if (typeof window !== 'undefined') {
    window.GameManager = {
      isGameModeEnabled,
      createGuessBadge: function(tweetElement) {
        const badges = window.GameManagerBadges;
        return badges && badges.createGuessBadge ? badges.createGuessBadge(tweetElement) : null;
      },
      replaceLoadingBadgeWithGuess,
      revealActualScore: function(badge, actualIQ, iqColor, confidence, result, tweetText) {
        const logic = window.GameManagerLogic;
        return logic && logic.revealActualScore ? logic.revealActualScore(badge, actualIQ, iqColor, confidence, result, tweetText) : null;
      },
      getGuess: function(tweetElement) {
        const logic = window.GameManagerLogic;
        return logic && logic.getGuess ? logic.getGuess(tweetElement) : null;
      },
      clearGuess: function(tweetElement) {
        const logic = window.GameManagerLogic;
        return logic && logic.clearGuess ? logic.clearGuess(tweetElement) : null;
      },
      calculateGuessScore: function(guess, actual, confidence) {
        const score = window.GameManagerScore;
        return score && score.calculateGuessScore ? score.calculateGuessScore(guess, actual, confidence) : null;
      },
      addToGameScore: function(points) {
        const score = window.GameManagerScore;
        return score && score.addToGameScore ? score.addToGameScore(points) : null;
      },
      getCachedGuess: function(tweetId) {
        const cache = window.GameManagerCache;
        return cache && cache.getCachedGuess ? cache.getCachedGuess(tweetId) : null;
      },
      cacheGuess: function(tweetId, guessData) {
        const cache = window.GameManagerCache;
        return cache && cache.cacheGuess ? cache.cacheGuess(tweetId, guessData) : null;
      },
      cacheRevealedIQ: function(tweetId) {
        const cache = window.GameManagerCache;
        return cache && cache.cacheRevealedIQ ? cache.cacheRevealedIQ(tweetId) : null;
      },
      getCachedRevealedIQ: function(tweetId) {
        const cache = window.GameManagerCache;
        return cache && cache.getCachedRevealedIQ ? cache.getCachedRevealedIQ(tweetId) : null;
      },
      cacheRevealedIQResult: function(tweetId, iqResultData) {
        const cache = window.GameManagerCache;
        return cache && cache.cacheRevealedIQResult ? cache.cacheRevealedIQResult(tweetId, iqResultData) : null;
      },
      getCachedRevealedIQResult: function(tweetId) {
        const cache = window.GameManagerCache;
        return cache && cache.getCachedRevealedIQResult ? cache.getCachedRevealedIQResult(tweetId) : null;
      },
      addGuessToHistory: function(tweetId, handle, guess, actualIQ, confidence, score) {
        const scoreModule = window.GameManagerScore;
        return scoreModule && scoreModule.addGuessToHistory ? scoreModule.addGuessToHistory(tweetId, handle, guess, actualIQ, confidence, score) : null;
      },
      getGuessHistory: function() {
        const score = window.GameManagerScore;
        return score && score.getGuessHistory ? score.getGuessHistory() : null;
      },
      clearGuessHistory: function() {
        const score = window.GameManagerScore;
        return score && score.clearGuessHistory ? score.clearGuessHistory() : null;
      },
      cleanupDuplicateGuessBadges: function(tweetElement) {
        const badges = window.GameManagerBadges;
        return badges && badges.cleanupDuplicateGuessBadges ? badges.cleanupDuplicateGuessBadges(tweetElement) : null;
      },
      makeBadgeEditable: function(badge) {
        const logic = window.GameManagerLogic;
        return logic && logic.makeBadgeEditable ? logic.makeBadgeEditable(badge) : null;
      }
    };
  }
})();
