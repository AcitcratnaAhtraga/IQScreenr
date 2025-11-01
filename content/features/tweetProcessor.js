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
  const { createLoadingBadge, createInvalidBadge, getIQColor, createIQBadge, animateCountUp, updateBadgeWithFlipStructure, logDebugInfo, hexToRgb, desaturateColor } = badgeManager;
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

  let tweetText = extractTweetText(actualTweetElement);

  if (!tweetText) {
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

  const validation = validateTweetText(tweetText);
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

  const alreadyExpanded = Array.from(actualTweetElement.querySelectorAll('span[role="button"], button, div[role="button"]')).some(el => {
    const text = el.textContent.trim().toLowerCase();
    return text === 'show less' || text === 'read less' ||
           (text.includes('show') && text.includes('less'));
  });

  if (alreadyExpanded) {
    tweetText = extractTweetText(actualTweetElement);
  } else if (isTweetTruncated(actualTweetElement)) {
    tweetText = tryExtractFullTextWithoutExpanding(actualTweetElement);

    const baselineText = extractTweetText(actualTweetElement);
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

      const expandedText = await extractFullTextWithoutVisualExpansion(actualTweetElement);

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

    // Extract handle and other metadata from tweet
    const handle = extractTweetHandle(actualTweetElement);

    // Try to extract tweet URL if available
    let tweetUrl = null;
    try {
      // Look for links to the tweet status
      const statusLinks = actualTweetElement.querySelectorAll('a[href*="/status/"]');
      if (statusLinks.length > 0) {
        const href = statusLinks[0].getAttribute('href') || '';
        if (href.startsWith('http')) {
          tweetUrl = href;
        } else if (href.startsWith('/')) {
          tweetUrl = window.location.origin + href;
        }
      }
    } catch (e) {
      // Ignore errors in URL extraction
    }

    let result = getCachedIQ(tweetText);
    let fromCache = false;

    if (!result) {
      result = await iqEstimator.estimate(tweetText);

      if (result.is_valid && result.iq_estimate !== null) {
        // Cache with metadata: handle, timestamp, tweetUrl, and any other useful data
        const metadata = {
          handle: handle,
          timestamp: new Date().toISOString(),
          tweetUrl: tweetUrl
        };
        cacheIQ(tweetText, result, metadata);
      }
    } else {
      fromCache = true;
    }

    if (result.is_valid && result.iq_estimate !== null && settings.showIQBadge) {
      const iq = Math.round(result.iq_estimate);

      if (loadingBadge && loadingBadge.parentElement) {
        const iqColor = getIQColor(iq);

        loadingBadge.removeAttribute('data-iq-loading');
        loadingBadge.setAttribute('data-iq-score', iq);
        loadingBadge.style.setProperty('cursor', 'help', 'important');

        loadingBadge._animationData = {
          finalIQ: iq,
          iqColor: iqColor
        };

        animateCountUp(loadingBadge, iq, iqColor);

        loadingBadge._debugData = {
          iq: iq,
          result: result,
          text: tweetText,
          timestamp: new Date().toISOString()
        };

        const confidence = result.confidence ? Math.round(result.confidence) : null;
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

        processedTweets.add(actualTweetElement);
        actualTweetElement.setAttribute('data-iq-analyzed', 'true');
        actualTweetElement.removeAttribute('data-iq-processing');
      } else {
        const badge = createIQBadge(iq, result, tweetText);

        const confidence = result.confidence ? Math.round(result.confidence) : null;
        if (confidence !== null) {
          badge.setAttribute('data-confidence', confidence);
        }

        const iqColor = getIQColor(iq);
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
      }
    } else {
      if (loadingBadge) {
        loadingBadge.remove();
      }
      actualTweetElement.removeAttribute('data-iq-processing');
    }
  } catch (error) {
    console.error('Error processing tweet:', error);
    if (loadingBadge) {
      loadingBadge.remove();
    }
  } finally {
    actualTweetElement.removeAttribute('data-iq-processing');
  }
}

/**
 * Process all visible tweets
 */
function processVisibleTweets() {
  const settings = getSettings();

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

  const processedTweetElements = new Set();
  const newTweets = [];

  Array.from(tweets).forEach((tweet) => {
    if (!tweet || tweet.hasAttribute('data-iq-processing')) {
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
      if (!existingBadge && settings.showIQBadge) {
        actualTweet.removeAttribute('data-iq-analyzed');
        processedTweets.delete(actualTweet);
      } else {
        return;
      }
    }

    if (nestedTweet && nestedTweet !== tweet) {
      if (!nestedTweet.hasAttribute('data-iq-analyzed') &&
          !nestedTweet.hasAttribute('data-iq-processing') &&
          !processedTweetElements.has(nestedTweet)) {
        newTweets.push(nestedTweet);
        processedTweetElements.add(nestedTweet);
      }
    } else {
      const hasTweetText = tweet.querySelector('[data-testid="tweetText"]');
      const hasEngagementBar = tweet.querySelector('[role="group"]');

      if ((hasTweetText || hasEngagementBar) && !processedTweetElements.has(tweet)) {
        newTweets.push(tweet);
        processedTweetElements.add(tweet);
      }
    }
  });

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
    newTweets.forEach((tweet) => {
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
 * Setup MutationObserver to watch for new tweets
 */
function setupObserver() {

  const observer = new MutationObserver((mutations) => {
    const potentialTweets = [];

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

