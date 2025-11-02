/**
 * Tweet Processing
 * Handles processing of tweets and managing IQ badge creation/updates
 */

(function() {
  'use strict';

// Get dependencies from other modules (loaded via window global objects)
const getTextExtraction = () => window.TextExtraction || {};
const getTweetDetection = () => window.TweetDetection || {};
const getBadgeManager = () => window.BadgeManager || {};
const getGameManager = () => window.GameManager || {};
const getIQCache = () => window.IQCache || {};
const getSettings = () => window.Settings || {};
const getDebugLog = () => window.DOMHelpers?.debugLog || (() => {});

// Local state
const processedTweets = new Set();

/**
 * Process a single tweet element
 */
async function processTweet(tweetElement) {
  const settings = getSettings();
  if (!tweetElement || !settings.showIQBadge) {
    return;
  }

  const { extractTweetText, isTweetTruncated, tryExtractFullTextWithoutExpanding, extractFullTextWithoutVisualExpansion, extractTweetHandle } = getTextExtraction();
  const { validateTweetText } = getTweetDetection();
  const badgeManager = getBadgeManager();
  if (!badgeManager || !badgeManager.createLoadingBadge) {
    const debugLogFn = getDebugLog();
    debugLogFn('BadgeManager not available yet');
    return;
  }
  const { createLoadingBadge, createInvalidBadge, getIQColor, getConfidenceColor, createIQBadge, animateCountUp, updateBadgeWithFlipStructure, logDebugInfo, hexToRgb, desaturateColor } = badgeManager;
  const { getCachedIQ, cacheIQ } = getIQCache();
  const debugLogFn = getDebugLog(); // Get debugLog function (avoid shadowing outer debugLog)
  const iqEstimator = window.ComprehensiveIQEstimatorUltimate ? new window.ComprehensiveIQEstimatorUltimate() : null;

  if (!iqEstimator) {
    debugLogFn('IQ Estimator not available yet');
    return;
  }

  // Handle nested tweet structures
  let actualTweetElement = tweetElement;
  const nestedTweet = tweetElement.querySelector('article[data-testid="tweet"]') ||
                      tweetElement.querySelector('article[role="article"]');
  if (nestedTweet && nestedTweet !== tweetElement) {
    actualTweetElement = nestedTweet;
    tweetElement.setAttribute('data-iq-analyzed', 'true');
  }

  if (actualTweetElement.hasAttribute('data-iq-analyzed')) {
    return;
  }

  const existingBadge = actualTweetElement.querySelector('.iq-badge');
  if (existingBadge && !existingBadge.hasAttribute('data-iq-loading') &&
      !existingBadge.classList.contains('iq-badge-loading') &&
      !existingBadge.hasAttribute('data-iq-invalid')) {
    actualTweetElement.setAttribute('data-iq-analyzed', 'true');
    return;
  }

  actualTweetElement.setAttribute('data-iq-processing', 'true');

  // Extract handle early for game mode
  let handle = extractTweetHandle(actualTweetElement);
  if (handle) {
    actualTweetElement.setAttribute('data-handle', handle);
  }

  let tweetText = extractTweetText(actualTweetElement);

  // Debug for notifications page user tweets
  const isNotificationsPage = window.location.href.includes('/notifications');
  const debugId = `tweet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Apply URL removal explicitly here as a safety measure
  // (extractTweetText should already do this, but ensure it happens)
  const { removeUrlsFromText } = getTextExtraction();
  if (tweetText && removeUrlsFromText) {
    const textBeforeCleaning = tweetText;
    tweetText = removeUrlsFromText(tweetText);

    if (isNotificationsPage && textBeforeCleaning !== tweetText) {
      console.log(`[TweetProcessor:${debugId}] URLs removed from text:`, {
        beforeLength: textBeforeCleaning.length,
        afterLength: tweetText.length,
        beforePreview: textBeforeCleaning.substring(0, 150),
        afterPreview: tweetText.substring(0, 150)
      });
    }
  }

  if (isNotificationsPage) {
    console.log(`[TweetProcessor:${debugId}] START Processing tweet on notifications page:`, {
      handle: handle,
      tweetTextLength: tweetText ? tweetText.length : 0,
      hasTweetText: !!tweetText,
      url: window.location.href,
      elementId: actualTweetElement.id || actualTweetElement.getAttribute('data-testid') || 'no-id',
      isAlreadyAnalyzed: actualTweetElement.hasAttribute('data-iq-analyzed'),
      isProcessing: actualTweetElement.hasAttribute('data-iq-processing'),
      hasExistingBadge: !!existingBadge
    });
  }

  if (!tweetText) {
    if (isNotificationsPage) {
      console.warn(`[TweetProcessor:${debugId}] No tweet text extracted - checking DOM structure:`, {
        handle: handle,
        hasTweetTextElement: !!actualTweetElement.querySelector('[data-testid="tweetText"]'),
        hasEngagementBar: !!actualTweetElement.querySelector('[role="group"]'),
        innerHTMLSample: actualTweetElement.innerHTML.substring(0, 200)
      });
    }
    if (settings.showIQBadge) {
      const existingBadge = actualTweetElement.querySelector('.iq-badge');
      if (existingBadge) {
        existingBadge.remove();
      }
      const invalidBadge = createInvalidBadge();
      const engagementBar = actualTweetElement.querySelector('[role="group"]');
      if (engagementBar) {
        const firstChild = engagementBar.firstElementChild;
        if (firstChild) {
          engagementBar.insertBefore(invalidBadge, firstChild);
        } else {
          engagementBar.appendChild(invalidBadge);
        }
      } else {
        const tweetContent = actualTweetElement.querySelector('div[data-testid="tweetText"]') ||
                            actualTweetElement.querySelector('div[lang]') ||
                            actualTweetElement.firstElementChild;
        if (tweetContent && tweetContent.parentElement) {
          tweetContent.parentElement.insertBefore(invalidBadge, tweetContent);
        } else {
          actualTweetElement.insertBefore(invalidBadge, actualTweetElement.firstChild);
        }
      }
    }
    actualTweetElement.setAttribute('data-iq-analyzed', 'true');
    actualTweetElement.removeAttribute('data-iq-processing');
    return;
  }

  if (isNotificationsPage) {
    console.log(`[TweetProcessor:${debugId}] Tweet text extracted successfully:`, {
      handle: handle,
      textLength: tweetText.length,
      textPreview: tweetText.substring(0, 100) + (tweetText.length > 100 ? '...' : '')
    });
  }

  const validation = validateTweetText(tweetText);
  if (isNotificationsPage) {
    console.log(`[TweetProcessor:${debugId}] Validation result:`, {
      handle: handle,
      isValid: validation.isValid,
      error: validation.error || 'none'
    });
  }
  if (!validation.isValid) {
    if (settings.showIQBadge) {
      const existingBadge = actualTweetElement.querySelector('.iq-badge');
      if (existingBadge) {
        existingBadge.remove();
      }
      const invalidBadge = createInvalidBadge();
      const engagementBar = actualTweetElement.querySelector('[role="group"]');
      if (engagementBar) {
        const firstChild = engagementBar.firstElementChild;
        if (firstChild) {
          engagementBar.insertBefore(invalidBadge, firstChild);
        } else {
          engagementBar.appendChild(invalidBadge);
        }
      } else {
        const tweetContent = actualTweetElement.querySelector('div[data-testid="tweetText"]') ||
                            actualTweetElement.querySelector('div[lang]') ||
                            actualTweetElement.firstElementChild;
        if (tweetContent && tweetContent.parentElement) {
          tweetContent.parentElement.insertBefore(invalidBadge, tweetContent);
        } else {
          actualTweetElement.insertBefore(invalidBadge, actualTweetElement.firstChild);
        }
      }
    }
    actualTweetElement.setAttribute('data-iq-analyzed', 'true');
    actualTweetElement.removeAttribute('data-iq-processing');
    return;
  }

  let loadingBadge = null;
  if (settings.showIQBadge) {
    loadingBadge = actualTweetElement.querySelector('.iq-badge[data-iq-loading="true"]') ||
                   actualTweetElement.querySelector('.iq-badge-loading');

    if (!loadingBadge) {
      loadingBadge = createLoadingBadge();
      const engagementBar = actualTweetElement.querySelector('[role="group"]');
      if (engagementBar) {
        const firstChild = engagementBar.firstElementChild;
        if (firstChild) {
          engagementBar.insertBefore(loadingBadge, firstChild);
        } else {
          engagementBar.appendChild(loadingBadge);
        }
      } else {
        const tweetContent = actualTweetElement.querySelector('div[data-testid="tweetText"]') ||
                            actualTweetElement.querySelector('div[lang]') ||
                            actualTweetElement.firstElementChild;
        if (tweetContent && tweetContent.parentElement) {
          tweetContent.parentElement.insertBefore(loadingBadge, tweetContent);
        } else {
          actualTweetElement.insertBefore(loadingBadge, actualTweetElement.firstChild);
        }
      }

      if (isNotificationsPage) {
        console.log(`[TweetProcessor:${debugId}] Loading badge created:`, {
          handle: handle,
          hasParent: !!loadingBadge.parentElement,
          parentElement: loadingBadge.parentElement?.tagName || 'none'
        });
      }
    }

    if (loadingBadge && loadingBadge.parentElement) {
      const engagementBar = actualTweetElement.querySelector('[role="group"]');
      if (engagementBar && !engagementBar.contains(loadingBadge)) {
        const firstChild = engagementBar.firstElementChild;
        if (firstChild) {
          engagementBar.insertBefore(loadingBadge, firstChild);
        } else {
          engagementBar.appendChild(loadingBadge);
        }
      }
    }

    if (isNotificationsPage && loadingBadge) {
      console.log(`[TweetProcessor:${debugId}] Loading badge status before IQ estimation:`, {
        handle: handle,
        hasLoadingBadge: !!loadingBadge,
        hasParent: !!loadingBadge?.parentElement,
        isLoadingState: loadingBadge?.hasAttribute('data-iq-loading'),
        badgeClasses: loadingBadge?.className || 'none'
      });
    }
  }

  if (settings.showIQBadge && loadingBadge) {
    if (!loadingBadge.parentElement) {
      loadingBadge = createLoadingBadge();
      const engagementBar = actualTweetElement.querySelector('[role="group"]');
      if (engagementBar) {
        const firstChild = engagementBar.firstElementChild;
        if (firstChild) {
          engagementBar.insertBefore(loadingBadge, firstChild);
        } else {
          engagementBar.appendChild(loadingBadge);
        }
      }
    }
  }

  // If game mode is enabled, replace loading badge with guess badge
  if (loadingBadge && settings.showIQBadge) {
    const gameManager = getGameManager();
    if (gameManager && gameManager.isGameModeEnabled && gameManager.isGameModeEnabled()) {
      const guessBadge = gameManager.replaceLoadingBadgeWithGuess(loadingBadge);
      if (guessBadge) {
        loadingBadge = guessBadge;
      }
    }
  }

  const alreadyExpanded = Array.from(actualTweetElement.querySelectorAll('span[role="button"], button, div[role="button"]')).some(el => {
    const text = el.textContent.trim().toLowerCase();
    return text === 'show less' || text === 'read less' ||
           (text.includes('show') && text.includes('less'));
  });

  if (alreadyExpanded) {
    const expandedTextRaw = extractTweetText(actualTweetElement);
    tweetText = expandedTextRaw && removeUrlsFromText ? removeUrlsFromText(expandedTextRaw) : expandedTextRaw;
  } else if (isTweetTruncated(actualTweetElement)) {
      tweetText = tryExtractFullTextWithoutExpanding(actualTweetElement);
      // Ensure URLs are removed
      if (tweetText && removeUrlsFromText) {
        tweetText = removeUrlsFromText(tweetText);
      }

      const baselineTextRaw = extractTweetText(actualTweetElement);
      // Ensure URLs are removed from baseline text too
      const baselineText = baselineTextRaw && removeUrlsFromText ? removeUrlsFromText(baselineTextRaw) : baselineTextRaw;
    const baselineLength = baselineText ? baselineText.length : 0;
    const extractedLength = tweetText ? tweetText.length : 0;
    const likelyTruncated = !tweetText ||
                            Math.abs(extractedLength - baselineLength) < 100;

    if (likelyTruncated && baselineLength > 50) {
      if (settings.showIQBadge && loadingBadge && !loadingBadge.parentElement) {
        loadingBadge = actualTweetElement.querySelector('.iq-badge[data-iq-loading="true"]') ||
                       actualTweetElement.querySelector('.iq-badge-loading');
        if (!loadingBadge) {
          loadingBadge = createLoadingBadge();
          const engagementBar = actualTweetElement.querySelector('[role="group"]');
          if (engagementBar) {
            const firstChild = engagementBar.firstElementChild;
            if (firstChild) {
              engagementBar.insertBefore(loadingBadge, firstChild);
            } else {
              engagementBar.appendChild(loadingBadge);
            }
          }
        }
      }

      const expandedTextRaw = await extractFullTextWithoutVisualExpansion(actualTweetElement);
      // Ensure URLs are removed from expanded text too
      const expandedText = expandedTextRaw && removeUrlsFromText ? removeUrlsFromText(expandedTextRaw) : expandedTextRaw;

      if (settings.showIQBadge && loadingBadge && !loadingBadge.parentElement) {
        loadingBadge = actualTweetElement.querySelector('.iq-badge[data-iq-loading="true"]') ||
                       actualTweetElement.querySelector('.iq-badge-loading');
        if (!loadingBadge) {
          loadingBadge = createLoadingBadge();
          const engagementBar = actualTweetElement.querySelector('[role="group"]');
          if (engagementBar) {
            const firstChild = engagementBar.firstElementChild;
            if (firstChild) {
              engagementBar.insertBefore(loadingBadge, firstChild);
            } else {
              engagementBar.appendChild(loadingBadge);
            }
          }
        }
      }

      if (expandedText && expandedText.length > Math.max(extractedLength, baselineLength) + 50) {
        tweetText = expandedText;
      } else if (expandedText && expandedText.length > extractedLength) {
        tweetText = expandedText;
      } else if (tweetText) {
        // Keep existing
      } else {
        tweetText = baselineText;
      }
    } else if (!tweetText) {
      tweetText = baselineText;
    }
  }

  try {
    if (settings.showIQBadge) {
      if (!loadingBadge || !loadingBadge.parentElement) {
        loadingBadge = actualTweetElement.querySelector('.iq-badge[data-iq-loading="true"]') ||
                       actualTweetElement.querySelector('.iq-badge-loading');
        if (!loadingBadge) {
          loadingBadge = createLoadingBadge();
          const engagementBar = actualTweetElement.querySelector('[role="group"]');
          if (engagementBar) {
            const firstChild = engagementBar.firstElementChild;
            if (firstChild) {
              engagementBar.insertBefore(loadingBadge, firstChild);
            } else {
              engagementBar.appendChild(loadingBadge);
            }
          }
        }
      }
    }

    // Extract limited metadata (privacy-compliant: no tweet text or URLs)
    let language = null;
    let hashtags = null;

    try {
      // Extract language from tweet element if available
      const tweetTextElement = actualTweetElement.querySelector('[data-testid="tweetText"]');
      if (tweetTextElement) {
        const langAttr = tweetTextElement.getAttribute('lang');
        if (langAttr) {
          language = langAttr;
        }
      }

      // Extract hashtags from tweet text (limited metadata - just the hashtag words, not full tweet)
      if (tweetText) {
        const hashtagMatches = tweetText.match(/#[\w]+/g);
        if (hashtagMatches && hashtagMatches.length > 0) {
          hashtags = hashtagMatches.map(tag => tag.substring(1).toLowerCase()); // Remove # and normalize
        }
      }
    } catch (e) {
      // Ignore errors in metadata extraction
    }

    // Get cached result by handle (not by tweet text)
    let result = handle ? getCachedIQ(handle) : null;
    let fromCache = false;

    if (isNotificationsPage) {
      console.log(`[TweetProcessor:${debugId}] About to estimate IQ:`, {
        handle: handle,
        hasHandle: !!handle,
        hasCachedResult: !!result,
        tweetTextLength: tweetText.length,
        iqEstimatorAvailable: !!iqEstimator
      });
    }

    if (!result) {
      // Not in cache, calculate new result
      console.log('[TweetProcessor] Cache miss, calculating IQ for handle:', handle);
      const startTime = performance.now();

      if (isNotificationsPage) {
        console.log(`[TweetProcessor:${debugId}] Calling iqEstimator.estimate()...`, {
          handle: handle,
          timestamp: new Date().toISOString()
        });
      }

      try {
        // Log the exact text being analyzed (for debugging)
        if (isNotificationsPage) {
          console.log(`[TweetProcessor:${debugId}] Text being analyzed:`, {
            length: tweetText.length,
            wordCount: tweetText.split(/\s+/).filter(w => w.length > 0).length,
            preview: tweetText.substring(0, 200) + (tweetText.length > 200 ? '...' : ''),
            fullText: tweetText
          });
        }

        result = await iqEstimator.estimate(tweetText);
        const endTime = performance.now();

        if (isNotificationsPage) {
          console.log(`[TweetProcessor:${debugId}] IQ estimation completed:`, {
            handle: handle,
            iq: result.iq_estimate,
            isValid: result.is_valid,
            confidence: result.confidence,
            error: result.error || 'none',
            timeMs: (endTime - startTime).toFixed(2),
            hasLoadingBadge: !!loadingBadge,
            loadingBadgeInDOM: loadingBadge ? !!loadingBadge.parentElement : false
          });
        }

        if (result.is_valid && result.iq_estimate !== null && handle) {
          // Cache with metadata: handle, timestamp, language, hashtags
          // Privacy-compliant: NO tweet text or tweet URLs stored
          const metadata = {
            timestamp: new Date().toISOString(),
            language: language,
            hashtags: hashtags,
            extensionVersion: chrome.runtime.getManifest().version || null
          };
          cacheIQ(handle, result, metadata);
        }
      } catch (estimateError) {
        console.error(`[TweetProcessor:${debugId}] ERROR in IQ estimation:`, {
          handle: handle,
          error: estimateError.message,
          stack: estimateError.stack,
          tweetTextLength: tweetText.length
        });
        throw estimateError; // Re-throw to be caught by outer try-catch
      }
    } else {
      fromCache = true;

      // Check if cached result was calculated with different text length
      // If so, the cache is stale (e.g., URLs were included before but removed now)
      const cachedTextLength = result.text_length;
      const currentTextLength = tweetText.length;

      // Also check word count as a secondary validation
      const cachedWordCount = result.word_count;
      const currentWordCount = tweetText.split(/\s+/).filter(w => w.length > 0).length;

      // Check Twitter calibration flag
      const cachedIsTwitterCalibrated = result.is_twitter_calibrated;
      const isTweetLength = currentTextLength <= 300; // Should use Twitter calibration
      const calibrationMismatch = cachedIsTwitterCalibrated !== undefined && cachedIsTwitterCalibrated !== isTweetLength;

      // Invalidate cache if:
      // 1. Text length is missing (old cache entry) OR lengths differ significantly (>5 chars)
      // 2. Word count is missing (old cache entry) OR word counts differ
      // 3. Twitter calibration flags differ (indicates different text processing)
      const textLengthMismatch = cachedTextLength === undefined || Math.abs(cachedTextLength - currentTextLength) > 5;
      const wordCountMismatch = cachedWordCount === undefined || Math.abs(cachedWordCount - currentWordCount) > 0;

      // Force recalculation if we detect any mismatch
      const shouldRecalculate = textLengthMismatch || wordCountMismatch || calibrationMismatch;

      if (isNotificationsPage) {
        console.log(`[TweetProcessor:${debugId}] Cache validation:`, {
          cachedTextLength: cachedTextLength,
          currentTextLength: currentTextLength,
          cachedWordCount: cachedWordCount,
          currentWordCount: currentWordCount,
          cachedIsTwitterCalibrated: cachedIsTwitterCalibrated,
          shouldBeTwitterCalibrated: isTweetLength,
          textLengthMismatch: textLengthMismatch,
          wordCountMismatch: wordCountMismatch,
          calibrationMismatch: calibrationMismatch,
          shouldRecalculate: shouldRecalculate
        });
      }

      if (shouldRecalculate) {
        // Cached result is for different text - recalculate
        if (isNotificationsPage) {
          console.log(`[TweetProcessor:${debugId}] Cache mismatch detected, recalculating:`, {
            handle: handle,
            cachedTextLength: cachedTextLength,
            currentTextLength: currentTextLength,
            cachedWordCount: cachedWordCount,
            currentWordCount: currentWordCount,
            textLengthDiff: Math.abs(cachedTextLength - currentTextLength),
            wordCountDiff: Math.abs(cachedWordCount - currentWordCount)
          });
        }

        fromCache = false;
        const startTime = performance.now();

        try {
          if (isNotificationsPage) {
            console.log(`[TweetProcessor:${debugId}] Text being analyzed (recalc):`, {
              length: tweetText.length,
              wordCount: tweetText.split(/\s+/).filter(w => w.length > 0).length,
              preview: tweetText.substring(0, 200) + (tweetText.length > 200 ? '...' : '')
            });
          }

          result = await iqEstimator.estimate(tweetText);
          const endTime = performance.now();

          if (isNotificationsPage) {
            console.log(`[TweetProcessor:${debugId}] IQ estimation completed (recalc):`, {
              handle: handle,
              iq: result.iq_estimate,
              isValid: result.is_valid,
              timeMs: (endTime - startTime).toFixed(2)
            });
          }

          if (result.is_valid && result.iq_estimate !== null && handle) {
            // Update cache with new result
            const metadata = {
              timestamp: new Date().toISOString(),
              language: language,
              hashtags: hashtags,
              extensionVersion: chrome.runtime.getManifest().version || null
            };
            cacheIQ(handle, result, metadata);
          }
        } catch (estimateError) {
          console.error(`[TweetProcessor:${debugId}] ERROR in IQ estimation (recalc):`, {
            handle: handle,
            error: estimateError.message,
            stack: estimateError.stack,
            tweetTextLength: tweetText.length
          });
          throw estimateError;
        }
      } else {
        // Cache is valid - text lengths match
        if (isNotificationsPage) {
          console.log(`[TweetProcessor:${debugId}] Cache hit for handle:`, {
            handle: handle,
            cachedIQ: result.iq_estimate,
            cachedIsValid: result.is_valid,
            cachedTextLength: cachedTextLength,
            currentTextLength: currentTextLength,
            textLengthsMatch: true
          });
        }
      }
    }

    if (result.is_valid && result.iq_estimate !== null && settings.showIQBadge) {
      const iq = Math.round(result.iq_estimate);
      const gameManager = getGameManager();
      const confidence = result.confidence ? Math.round(result.confidence) : null;

      if (isNotificationsPage) {
        console.log(`[TweetProcessor:${debugId}] About to update badge with IQ:`, {
          handle: handle,
          iq: iq,
          confidence: confidence,
          hasLoadingBadge: !!loadingBadge,
          loadingBadgeParent: loadingBadge ? !!loadingBadge.parentElement : false,
          loadingBadgeInDOM: loadingBadge ? document.body.contains(loadingBadge) : false,
          loadingBadgeState: loadingBadge ? {
            hasDataIqLoading: loadingBadge.hasAttribute('data-iq-loading'),
            classes: loadingBadge.className,
            parentTag: loadingBadge.parentElement?.tagName || 'none'
          } : null
        });
      }

      if (loadingBadge && loadingBadge.parentElement) {
        // Check if this is actually a guess badge now
        const isGuessBadge = loadingBadge.classList.contains('iq-badge-guess') ||
                            loadingBadge.hasAttribute('data-iq-guess');

        // If it's a guess badge, we should NOT automatically calculate
        // The user needs to click and guess first
        if (isGuessBadge) {
          // Store the result on the tweet element for later use when user guesses
          actualTweetElement._iqResult = {
            iq: iq,
            result: result,
            confidence: confidence,
            text: tweetText
          };
          processedTweets.add(actualTweetElement);
          actualTweetElement.setAttribute('data-iq-analyzed', 'true');
          actualTweetElement.removeAttribute('data-iq-processing');
        } else {
          // Use confidence color if setting is enabled, otherwise use IQ color
          const iqColor = (settings.useConfidenceForColor && confidence !== null)
            ? getConfidenceColor(confidence)
            : getIQColor(iq);

          // Check if game mode is enabled and we have a guess
          const guessData = gameManager && gameManager.getGuess ? gameManager.getGuess(actualTweetElement) : null;

          if (guessData && guessData.guess !== undefined) {
            // We have a guess, use the game manager's reveal function
            if (gameManager && gameManager.revealActualScore) {
              gameManager.revealActualScore(loadingBadge, iq, iqColor, confidence, result, tweetText);
            }
          } else {
            // No guess, proceed with normal animation
            loadingBadge.removeAttribute('data-iq-loading');
            loadingBadge.setAttribute('data-iq-score', iq);
            loadingBadge.style.setProperty('cursor', 'help', 'important');

            loadingBadge._animationData = {
              finalIQ: iq,
              iqColor: iqColor
            };

            animateCountUp(loadingBadge, iq, iqColor);

            // Store the EXACT text that was analyzed
            // Make sure it matches what was passed to estimate()
            const textForDebug = tweetText; // This should be the cleaned text

            loadingBadge._debugData = {
              iq: iq,
              result: result,
              text: textForDebug, // Store the exact analyzed text
              timestamp: new Date().toISOString(),
              analyzedTextLength: tweetText.length, // Store for verification
              analyzedWordCount: tweetText.split(/\s+/).filter(w => w.length > 0).length
            };

            if (confidence !== null) {
              loadingBadge.setAttribute('data-confidence', confidence);
              updateBadgeWithFlipStructure(loadingBadge, iq, confidence);
            }

            // Always add hover event listener for console debug info
            loadingBadge.addEventListener('mouseenter', () => {
              if (loadingBadge._debugData) {
                logDebugInfo(loadingBadge._debugData);
              }
            });
          }

          processedTweets.add(actualTweetElement);
          actualTweetElement.setAttribute('data-iq-analyzed', 'true');
          actualTweetElement.removeAttribute('data-iq-processing');

          if (isNotificationsPage) {
            console.log(`[TweetProcessor:${debugId}] Badge updated successfully (with loadingBadge):`, {
              handle: handle,
              iq: iq,
              badgeInDOM: loadingBadge ? document.body.contains(loadingBadge) : false
            });
          }
        }
      } else {
        if (isNotificationsPage) {
          console.warn(`[TweetProcessor:${debugId}] No loading badge found, creating new badge:`, {
            handle: handle,
            hasLoadingBadge: !!loadingBadge,
            loadingBadgeHasParent: loadingBadge ? !!loadingBadge.parentElement : false
          });
        }

        const badge = createIQBadge(iq, result, tweetText);

        const confidence = result.confidence ? Math.round(result.confidence) : null;
        if (confidence !== null) {
          badge.setAttribute('data-confidence', confidence);
        }

        // Use confidence color if setting is enabled, otherwise use IQ color
        const iqColor = (settings.useConfidenceForColor && confidence !== null)
          ? getConfidenceColor(confidence)
          : getIQColor(iq);
        badge._animationData = {
          finalIQ: iq,
          iqColor: iqColor
        };

        badge.setAttribute('data-final-iq', iq);

        const scoreElement = badge.querySelector('.iq-score');
        if (scoreElement) {
          scoreElement.textContent = '0';
        }

        // Use BadgeManager's helper functions if needed, but getIQColor handles colors
        // For loading state, we'll use a simple approach
        const darkerRed = '#b71c1c';
        const rgb = hexToRgb(darkerRed);
        const desat = desaturateColor(rgb, 0.5);
        const loadingColor = `rgb(${desat.r}, ${desat.g}, ${desat.b})`;
        badge.style.setProperty('background-color', loadingColor, 'important');

        animateCountUp(badge, iq, iqColor);

        const engagementBar = actualTweetElement.querySelector('[role="group"]');
        if (engagementBar) {
          const firstChild = engagementBar.firstElementChild;
          if (firstChild) {
            engagementBar.insertBefore(badge, firstChild);
          } else {
            engagementBar.appendChild(badge);
          }
        } else {
          actualTweetElement.appendChild(badge);
        }

        processedTweets.add(actualTweetElement);
        actualTweetElement.setAttribute('data-iq-analyzed', 'true');
        actualTweetElement.removeAttribute('data-iq-processing');

        if (isNotificationsPage) {
          console.log(`[TweetProcessor:${debugId}] Badge created and inserted (no loadingBadge):`, {
            handle: handle,
            iq: iq,
            badgeInDOM: document.body.contains(badge),
            hasEngagementBar: !!engagementBar
          });
        }
      }
    } else {
      if (isNotificationsPage) {
        console.warn(`[TweetProcessor:${debugId}] Result is invalid or IQ is null:`, {
          handle: handle,
          isValid: result.is_valid,
          iqEstimate: result.iq_estimate,
          error: result.error || 'none'
        });
      }
      if (loadingBadge) {
        loadingBadge.remove();
      }
      actualTweetElement.removeAttribute('data-iq-processing');
    }
  } catch (error) {
    console.error(`[TweetProcessor:${debugId}] ERROR processing tweet:`, {
      handle: handle,
      error: error.message,
      stack: error.stack,
      tweetTextLength: tweetText ? tweetText.length : 0,
      hasLoadingBadge: !!loadingBadge
    });
    if (loadingBadge) {
      loadingBadge.remove();
    }
  } finally {
    if (isNotificationsPage) {
      console.log(`[TweetProcessor:${debugId}] FINALLY block - cleaning up:`, {
        handle: handle,
        isProcessing: actualTweetElement.hasAttribute('data-iq-processing'),
        isAnalyzed: actualTweetElement.hasAttribute('data-iq-analyzed')
      });
    }
    actualTweetElement.removeAttribute('data-iq-processing');
  }
}

/**
 * Process all visible tweets
 */
function processVisibleTweets() {
  const settings = getSettings();
  const isNotificationsPage = window.location.href.includes('/notifications');

  if (isNotificationsPage) {
    console.log('[TweetProcessor] processVisibleTweets() called on notifications page');
  }

  const tweetSelectors = [
    'article[data-testid="tweet"]',
    'article[role="article"]',
    'div[data-testid="cellInnerDiv"] > article'
  ];

  let tweets = [];
  for (const selector of tweetSelectors) {
    tweets = document.querySelectorAll(selector);
    if (tweets.length > 0) break;
  }

  if (tweets.length === 0) {
    tweets = document.querySelectorAll('article');
  }

  if (isNotificationsPage) {
    console.log('[TweetProcessor] Found tweets:', {
      totalTweets: tweets.length,
      selectorsUsed: tweetSelectors
    });
  }

  const processedTweetElements = new Set();
  const newTweets = [];

  const skippedTweets = [];
  Array.from(tweets).forEach((tweet, index) => {
    if (!tweet) {
      if (isNotificationsPage && index < 5) {
        skippedTweets.push({ reason: 'tweet is null/falsy', index });
      }
      return;
    }

    if (tweet.hasAttribute('data-iq-processing')) {
      if (isNotificationsPage && index < 5) {
        skippedTweets.push({ reason: 'already processing', index });
      }
      return;
    }

    const nestedTweet = tweet.querySelector('article[data-testid="tweet"]') ||
                        tweet.querySelector('article[role="article"]');

    let actualTweet = tweet;
    if (nestedTweet && nestedTweet !== tweet) {
      actualTweet = nestedTweet;
    }

    if (actualTweet.hasAttribute('data-iq-analyzed')) {
      const existingBadge = actualTweet.querySelector('.iq-badge');
      const isStuckInLoading = existingBadge && (
        existingBadge.hasAttribute('data-iq-loading') ||
        existingBadge.classList.contains('iq-badge-loading') ||
        (!existingBadge.hasAttribute('data-iq-score') && !existingBadge.hasAttribute('data-iq-invalid'))
      );

      if (isStuckInLoading) {
        // Tweet is stuck in loading state - force reprocess
        if (isNotificationsPage) {
          console.log('[TweetProcessor] Found stuck loading badge - forcing reprocess:', {
            handle: actualTweet.getAttribute('data-handle'),
            hasLoadingAttr: existingBadge.hasAttribute('data-iq-loading'),
            hasLoadingClass: existingBadge.classList.contains('iq-badge-loading'),
            hasScore: existingBadge.hasAttribute('data-iq-score')
          });
        }
        actualTweet.removeAttribute('data-iq-analyzed');
        processedTweets.delete(actualTweet);
        if (existingBadge && existingBadge.parentElement) {
          existingBadge.remove();
        }
      } else if (!existingBadge && settings.showIQBadge) {
        actualTweet.removeAttribute('data-iq-analyzed');
        processedTweets.delete(actualTweet);
        if (isNotificationsPage) {
          console.log('[TweetProcessor] Re-processing tweet that was analyzed but badge missing:', {
            hasHandle: !!actualTweet.getAttribute('data-handle'),
            handle: actualTweet.getAttribute('data-handle')
          });
        }
      } else {
        if (isNotificationsPage && index < 5) {
          skippedTweets.push({
            reason: 'already analyzed with badge',
            index,
            hasBadge: !!existingBadge,
            isStuckInLoading: isStuckInLoading,
            handle: actualTweet.getAttribute('data-handle')
          });
        }
        return;
      }
    }

    if (nestedTweet && nestedTweet !== tweet) {
      if (!nestedTweet.hasAttribute('data-iq-analyzed') &&
          !nestedTweet.hasAttribute('data-iq-processing') &&
          !processedTweetElements.has(nestedTweet)) {
        newTweets.push(nestedTweet);
        processedTweetElements.add(nestedTweet);
      } else {
        if (isNotificationsPage && index < 5) {
          skippedTweets.push({
            reason: 'nested tweet conditions not met',
            index,
            isAnalyzed: nestedTweet.hasAttribute('data-iq-analyzed'),
            isProcessing: nestedTweet.hasAttribute('data-iq-processing'),
            alreadyInSet: processedTweetElements.has(nestedTweet),
            handle: nestedTweet.getAttribute('data-handle')
          });
        }
      }
    } else {
      const hasTweetText = tweet.querySelector('[data-testid="tweetText"]');
      const hasEngagementBar = tweet.querySelector('[role="group"]');

      if ((hasTweetText || hasEngagementBar) && !processedTweetElements.has(tweet)) {
        newTweets.push(tweet);
        processedTweetElements.add(tweet);
      } else {
        if (isNotificationsPage && index < 5) {
          skippedTweets.push({
            reason: 'direct tweet conditions not met',
            index,
            hasTweetText: !!hasTweetText,
            hasEngagementBar: !!hasEngagementBar,
            alreadyInSet: processedTweetElements.has(tweet),
            handle: tweet.getAttribute('data-handle')
          });
        }
      }
    }
  });

  if (isNotificationsPage && skippedTweets.length > 0) {
    console.log('[TweetProcessor] Skipped tweets (showing first 5):', skippedTweets);
  }

  if (isNotificationsPage && newTweets.length > 0) {
    console.log('[TweetProcessor] New tweets to process:', {
      count: newTweets.length,
      tweetElements: newTweets.map(t => ({
        hasTweetText: !!t.querySelector('[data-testid="tweetText"]'),
        hasEngagementBar: !!t.querySelector('[role="group"]'),
        isAnalyzed: t.hasAttribute('data-iq-analyzed'),
        isProcessing: t.hasAttribute('data-iq-processing')
      }))
    });
  }

  if (settings.showIQBadge) {
    newTweets.forEach((tweet) => {
      setTimeout(() => {
        if (!tweet.querySelector('.iq-badge')) {
          addLoadingBadgeToTweet(tweet);
        }
      }, 0);
    });
  }

  setTimeout(() => {
    if (isNotificationsPage && newTweets.length > 0) {
      console.log('[TweetProcessor] About to process new tweets:', {
        count: newTweets.length,
        tweets: newTweets.map(t => ({
          handle: t.getAttribute('data-handle') || 'not-set',
          isAnalyzed: t.hasAttribute('data-iq-analyzed'),
          isProcessing: t.hasAttribute('data-iq-processing'),
          hasBadge: !!t.querySelector('.iq-badge')
        }))
      });
    }

    newTweets.forEach((tweet, index) => {
      if (isNotificationsPage) {
        console.log(`[TweetProcessor] Calling processTweet(${index + 1}/${newTweets.length}) for tweet:`, {
          handle: tweet.getAttribute('data-handle') || 'not-set',
          hasNested: !!tweet.querySelector('article[data-testid="tweet"]')
        });
      }
      processTweet(tweet);
    });
  }, 0);
}

/**
 * Lightweight function to add a loading badge to a single tweet
 */
function addLoadingBadgeToTweet(tweet) {
  const settings = getSettings();
  const badgeManager = getBadgeManager();

  if (!badgeManager || !badgeManager.createLoadingBadge) {
    return; // BadgeManager not loaded yet
  }

  const { createLoadingBadge } = badgeManager;

  if (!settings.showIQBadge || tweet.querySelector('.iq-badge')) {
    return;
  }

  let actualTweet = tweet;
  const nestedTweet = tweet.querySelector('article[data-testid="tweet"]') ||
                      tweet.querySelector('article[role="article"]');
  if (nestedTweet && nestedTweet !== tweet) {
    actualTweet = nestedTweet;
  }

  const loadingBadge = createLoadingBadge();
  const engagementBar = actualTweet.querySelector('[role="group"]');

  if (engagementBar) {
    try {
      const firstChild = engagementBar.firstElementChild;
      if (firstChild) {
        engagementBar.insertBefore(loadingBadge, firstChild);
      } else {
        engagementBar.appendChild(loadingBadge);
      }
    } catch (e) {
      // Silent fail
    }
  } else {
    try {
      actualTweet.insertBefore(loadingBadge, actualTweet.firstChild);
    } catch (e) {
      // Silent fail
    }
  }
}

/**
 * Check for and reprocess stuck loading badges (safety net for notifications page)
 */
function checkForStuckBadges() {
  const isNotificationsPage = window.location.href.includes('/notifications');
  if (!isNotificationsPage) return;

  const loadingBadges = document.querySelectorAll('.iq-badge[data-iq-loading="true"], .iq-badge-loading');
  const stuckBadges = Array.from(loadingBadges).filter(badge => {
    // Check if badge has been loading for more than 5 seconds (has no score)
    const hasScore = badge.hasAttribute('data-iq-score');
    const hasInvalid = badge.hasAttribute('data-iq-invalid');
    const isReallyStuck = !hasScore && !hasInvalid;

    // Also check if badge is older than 5 seconds (we can approximate by checking if parent exists)
    if (isReallyStuck && badge.parentElement) {
      const tweetElement = badge.closest('article[data-testid="tweet"]') ||
                          badge.closest('article[role="article"]') ||
                          badge.closest('article');
      if (tweetElement) {
        return true;
      }
    }
    return false;
  });

  if (stuckBadges.length > 0) {
    console.log('[TweetProcessor] Found stuck loading badges, reprocessing:', {
      count: stuckBadges.length,
      badges: stuckBadges.map(badge => {
        const tweetElement = badge.closest('article[data-testid="tweet"]') ||
                            badge.closest('article[role="article"]') ||
                            badge.closest('article');
        const handle = tweetElement ? tweetElement.getAttribute('data-handle') : 'unknown';
        return {
          handle: handle,
          hasParent: !!badge.parentElement,
          hasLoadingAttr: badge.hasAttribute('data-iq-loading'),
          hasLoadingClass: badge.classList.contains('iq-badge-loading'),
          hasScore: badge.hasAttribute('data-iq-score')
        };
      })
    });

    stuckBadges.forEach(badge => {
      const tweetElement = badge.closest('article[data-testid="tweet"]') ||
                          badge.closest('article[role="article"]') ||
                          badge.closest('article');
      if (tweetElement) {
        const handle = tweetElement.getAttribute('data-handle');
        console.log('[TweetProcessor] Reprocessing stuck badge for tweet:', handle || 'unknown');

        // Remove the stuck badge and mark tweet for reprocessing
        if (tweetElement.hasAttribute('data-iq-analyzed')) {
          tweetElement.removeAttribute('data-iq-analyzed');
          processedTweets.delete(tweetElement);
        }
        if (badge.parentElement) {
          badge.remove();
        }
        // Reprocess after a short delay
        setTimeout(() => {
          processTweet(tweetElement);
        }, 100);
      }
    });
  }
}

/**
 * Setup MutationObserver to watch for new tweets
 */
function setupObserver() {
  const isNotificationsPage = window.location.href.includes('/notifications');

  // Setup periodic check for stuck badges on notifications page
  if (isNotificationsPage) {
    // Check immediately, then every 3 seconds
    setTimeout(checkForStuckBadges, 2000);
    setInterval(checkForStuckBadges, 3000);
  }

  const observer = new MutationObserver((mutations) => {
    const potentialTweets = [];
    const isNotificationsPageCheck = window.location.href.includes('/notifications');

    for (let i = 0; i < mutations.length; i++) {
      const mutation = mutations[i];
      for (let j = 0; j < mutation.addedNodes.length; j++) {
        const node = mutation.addedNodes[j];
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.tagName === 'ARTICLE') {
            potentialTweets.push(node);
          }
          if (node.querySelector) {
            const articles = node.querySelectorAll('article');
            if (articles.length > 0) {
              for (let k = 0; k < articles.length; k++) {
                potentialTweets.push(articles[k]);
              }
            }
          }
        }
      }
    }

    if (isNotificationsPageCheck && potentialTweets.length > 0) {
      console.log('[TweetProcessor] MutationObserver detected new articles on notifications page:', {
        count: potentialTweets.length,
        articles: potentialTweets.map(t => ({
          tagName: t.tagName,
          hasTweetTestId: t.hasAttribute('data-testid') && t.getAttribute('data-testid') === 'tweet',
          isAnalyzed: t.hasAttribute('data-iq-analyzed'),
          isProcessing: t.hasAttribute('data-iq-processing'),
          hasBadge: !!t.querySelector('.iq-badge'),
          hasTweetText: !!t.querySelector('[data-testid="tweetText"]'),
          hasEngagementBar: !!t.querySelector('[role="group"]')
        }))
      });
    }

    if (potentialTweets.length > 0) {
      setTimeout(() => {
        potentialTweets.forEach((tweet) => {
          if (tweet.hasAttribute('data-iq-analyzed') ||
              tweet.hasAttribute('data-iq-processing') ||
              tweet.querySelector('.iq-badge')) {
            return;
          }
          addLoadingBadgeToTweet(tweet);
        });
      }, 0);
    }

    if (potentialTweets.length > 0) {
      setTimeout(() => {
        processVisibleTweets();
      }, 0);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  if (isNotificationsPage) {
    console.log('[TweetProcessor] MutationObserver set up for notifications page');
  }

  return observer;
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.TweetProcessor = {
    processTweet,
    processVisibleTweets,
    addLoadingBadgeToTweet,
    setupObserver,
    processedTweets
  };
}

})();

