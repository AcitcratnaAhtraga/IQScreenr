/**
 * Game Logic for Game Manager
 * Handles guess input, revealing scores, and core game mechanics
 */

(function() {
  'use strict';

  // Game state
  const guessManager = new Map(); // tweetElement -> { guess: number, confidence: number }

  /**
   * Check if IQ Guessr mode is enabled
   */
  function isGameModeEnabled() {
    const settings = window.Settings || {};
    return settings.enableIQGuessr === true;
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
        const cache = window.GameManagerCache;
        if (cache && cache.getCachedGuess) {
          const cachedGuess = await cache.getCachedGuess(tweetId);
          if (cachedGuess && cachedGuess.guess !== undefined) {
            // Already guessed this tweet, don't allow editing
            return;
          }
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
            const cache = window.GameManagerCache;
            if (cache && cache.cacheGuess) {
              cache.cacheGuess(tweetId, { guess: value, confidence: confidence });
            }
          }

          if (iqResult && iqResult.iq !== null && iqResult.iq !== undefined) {
            // Get badge manager to get colors
            const badgeManager = window.BadgeManager;
            if (badgeManager && badgeManager.getIQColor) {
              const settings = window.Settings || {};
              const iqColor = settings.useConfidenceForColor && iqResult.confidence
                ? badgeManager.getConfidenceColor(iqResult.confidence)
                : badgeManager.getIQColor(iqResult.iq);

              // Call revealActualScore directly since we're in the same scope
              const gameManager = window.GameManager;
              if (gameManager && gameManager.revealActualScore) {
                setTimeout(() => {
                  gameManager.revealActualScore(badge, iqResult.iq, iqColor, iqResult.confidence, iqResult.result, iqResult.text);
                }, 250);
              }
            }
          } else {
            // If calculation hasn't happened yet, trigger it
            triggerIQCalculation(tweetElement, badge);
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
   * Trigger IQ calculation for a tweet
   */
  function triggerIQCalculation(tweetElement, badge) {
    // Check both actualTweetElement and tweetElement for nested structures
    const actualTweetElement = tweetElement.querySelector('article[data-testid="tweet"]') ||
                             tweetElement.querySelector('article[role="article"]') ||
                             tweetElement;

    // If already analyzed but no IQ result, force calculation
    if (actualTweetElement.hasAttribute('data-iq-analyzed') && !actualTweetElement._iqResult) {
      // Try to force calculation by removing the analyzed flag and calling processTweet
      const tweetProcessor = window.TweetProcessor;
      if (tweetProcessor && tweetProcessor.processTweet) {
        actualTweetElement.removeAttribute('data-iq-analyzed');

        tweetProcessor.processTweet(tweetElement).then(() => {
          const newIqResult = actualTweetElement._iqResult || tweetElement._iqResult;

          if (newIqResult && newIqResult.iq !== null && newIqResult.iq !== undefined) {
            const badgeManager = window.BadgeManager;
            if (badgeManager && badgeManager.getIQColor) {
              const settings = window.Settings || {};
              const iqColor = settings.useConfidenceForColor && newIqResult.confidence
                ? badgeManager.getConfidenceColor(newIqResult.confidence)
                : badgeManager.getIQColor(newIqResult.iq);

              const gameManager = window.GameManager;
              if (gameManager && gameManager.revealActualScore) {
                gameManager.revealActualScore(badge, newIqResult.iq, iqColor, newIqResult.confidence, newIqResult.result, newIqResult.text);
              }
            }
          } else {
            // Fallback: Calculate IQ directly
            calculateIQDirectly(actualTweetElement, badge);
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
            const badgeManager = window.BadgeManager;
            if (badgeManager && badgeManager.getIQColor) {
              const settings = window.Settings || {};
              const iqColor = settings.useConfidenceForColor && newIqResult.confidence
                ? badgeManager.getConfidenceColor(newIqResult.confidence)
                : badgeManager.getIQColor(newIqResult.iq);

              const gameManager = window.GameManager;
              if (gameManager && gameManager.revealActualScore) {
                gameManager.revealActualScore(badge, newIqResult.iq, iqColor, newIqResult.confidence, newIqResult.result, newIqResult.text);
              }
            }
          }
        } else if (checkCount >= 30) {
          // Timeout after 3 seconds (30 * 100ms)
          clearInterval(checkInterval);
        }
      }, 100);
    } else {
      // Not analyzed yet, trigger calculation
      const tweetProcessor = window.TweetProcessor;
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
            const badgeManager = window.BadgeManager;
            if (badgeManager && badgeManager.getIQColor) {
              const settings = window.Settings || {};
              const iqColor = settings.useConfidenceForColor && newIqResult.confidence
                ? badgeManager.getConfidenceColor(newIqResult.confidence)
                : badgeManager.getIQColor(newIqResult.iq);

              const gameManager = window.GameManager;
              if (gameManager && gameManager.revealActualScore) {
                gameManager.revealActualScore(badge, newIqResult.iq, iqColor, newIqResult.confidence, newIqResult.result, newIqResult.text);
              }
            }
          }
        }).catch(() => {
          // Silently fail
        });
      }
    }
  }

  /**
   * Calculate IQ directly as fallback
   */
  function calculateIQDirectly(tweetElement, badge) {
    const textExtraction = window.TextExtraction || {};
    const extractTweetText = textExtraction.extractTweetText;

    if (extractTweetText) {
      const tweetText = extractTweetText(tweetElement);

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
              tweetElement._iqResult = {
                iq: iq,
                result: result,
                confidence: confidence,
                text: tweetText
              };

              // Reveal score
              const badgeManager = window.BadgeManager;
              if (badgeManager && badgeManager.getIQColor) {
                const settings = window.Settings || {};
                const iqColor = settings.useConfidenceForColor && confidence
                  ? badgeManager.getConfidenceColor(confidence)
                  : badgeManager.getIQColor(iq);

                const gameManager = window.GameManager;
                if (gameManager && gameManager.revealActualScore) {
                  gameManager.revealActualScore(badge, iq, iqColor, confidence, result, tweetText);
                }
              }
            }
          }).catch(() => {
            // Silently fail
          });
        }
      }
    }
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
      const badgeManager = window.BadgeManager;
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
        const cache = window.GameManagerCache;
        if (cache && tweetId) {
          cache.cacheRevealedIQ(tweetId);

          // Also cache the IQ result by tweet ID as a fallback (in case handle lookup fails)
          // This ensures we can restore the calculated badge even if handle extraction fails
          const iqResultData = {
            iq: actualIQ,
            confidence: confidence,
            result: result || {}, // Ensure result exists, use empty object if not
            timestamp: new Date().toISOString()
          };
          cache.cacheRevealedIQResult(tweetId, iqResultData);
        }

        // Calculate and add score
        if (hasGuess && guessData) {
          const scoreManager = window.GameManagerScore;
          if (scoreManager) {
            const score = scoreManager.calculateGuessScore(guessData.guess, actualIQ, guessData.confidence);
            scoreManager.addToGameScore(score);

            // Mark badge as compared (has been compared to a guess)
            badge.setAttribute('data-iq-compared', 'true');

            // Add to history
            const tweetId = tweetElement ? tweetElement.getAttribute('data-tweet-id') : null;
            const handle = tweetElement ? tweetElement.getAttribute('data-handle') : null;
            if (tweetId) {
              scoreManager.addGuessToHistory(tweetId, handle, guessData.guess, actualIQ, guessData.confidence, score);
            }

            // Show score feedback
            scoreManager.showScoreFeedback(badge, score, guessData.guess, actualIQ);
          }
        }
      }
    }, 1500); // 1.5 second loading animation
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
   * Set guess for a tweet element (used when restoring from cache)
   */
  function setGuess(tweetElement, guessData) {
    guessManager.set(tweetElement, guessData);
  }

  // Export
  if (typeof window !== 'undefined') {
    window.GameManagerLogic = {
      isGameModeEnabled,
      makeBadgeEditable,
      revealActualScore,
      getGuess,
      clearGuess,
      setGuess
    };
  }
})();
