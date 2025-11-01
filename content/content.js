/**
 * Content Script - Analyzes tweets and injects IQ badges
 *
 * DEBUG MODE: Debug logging is enabled by default.
 * To disable, open browser console and run: window.__IQ_DEBUG__ = false;
 *
 * This logs detailed information about badge creation, validation, and transitions.
 */

(function() {
  'use strict';


  // Initialize Comprehensive IQ Estimator Ultimate (with real dependency parsing support)
  const iqEstimator = new ComprehensiveIQEstimatorUltimate();

  // State management
  const processedTweets = new Set();
  const settings = {
    showIQBadge: true,
    minIQ: 60,
    maxIQ: 145
  };

  // IQ cache for storing calculated scores to avoid recalculation
  const iqCache = new Map();
  const CACHE_KEY_PREFIX = 'iq_cache_';
  const MAX_CACHE_SIZE = 1000; // Limit to prevent excessive storage usage

  // Load settings and cache from storage
  chrome.storage.sync.get(['showIQBadge', 'minIQ', 'maxIQ'], (result) => {
    Object.assign(settings, result);
    if (result.showIQBadge !== undefined) {
      settings.showIQBadge = result.showIQBadge;
    }
    if (result.minIQ !== undefined) {
      settings.minIQ = result.minIQ;
    }
    if (result.maxIQ !== undefined) {
      settings.maxIQ = result.maxIQ;
    }
  });

  // Load IQ cache from local storage
  chrome.storage.local.get(null, (items) => {
    let loadedCount = 0;
    for (const [key, value] of Object.entries(items)) {
      if (key.startsWith(CACHE_KEY_PREFIX)) {
        const tweetHash = key.replace(CACHE_KEY_PREFIX, '');
        iqCache.set(tweetHash, value);
        loadedCount++;
      }
    }
    // Note: debugLog is defined later, so we'll just silently load the cache
    // if (loadedCount > 0) {
    //   debugLog(`Loaded ${loadedCount} cached IQ scores from storage`);
    // }
  });

  // Listen for settings changes
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync') {
      if (changes.showIQBadge) {
        settings.showIQBadge = changes.showIQBadge.newValue;
      }
      if (changes.minIQ) {
        settings.minIQ = changes.minIQ.newValue;
      }
      if (changes.maxIQ) {
        settings.maxIQ = changes.maxIQ.newValue;
      }
      // Re-process visible tweets if settings changed
      // Remove all existing badges and reprocess
      document.querySelectorAll('.iq-badge').forEach(badge => badge.remove());
      document.querySelectorAll('[data-iq-analyzed]').forEach(tweet => {
        tweet.removeAttribute('data-iq-analyzed');
      });
      processedTweets.clear();
      processVisibleTweets();
    }
  });

  /**
   * Check if a tweet is truncated (has a "show more" button and is NOT already expanded)
   */
  function isTweetTruncated(tweetElement) {
    // Look for various patterns of "show more" buttons - expanded selector list
    const showMoreButton =
      // Standard Twitter/X selectors
      tweetElement.querySelector('span[data-testid="expand-text"]') ||
      tweetElement.querySelector('button[data-testid="show-more"]') ||
      tweetElement.querySelector('[data-testid="app-text-transition-container"] span[role="button"]') ||
      // Look for elements with "Show" text inside various containers
      Array.from(tweetElement.querySelectorAll('span[role="button"]')).find(span => {
        const text = span.textContent.trim().toLowerCase();
        return text === 'show more' || text === 'read more' ||
               (text.includes('show') && text.includes('more') && !text.includes('less'));
      }) ||
      // Look for button elements
      Array.from(tweetElement.querySelectorAll('button')).find(btn => {
        const text = btn.textContent.trim().toLowerCase();
        return text === 'show more' || text === 'read more' ||
               (text.includes('show') && text.includes('more') && !text.includes('less'));
      }) ||
      // Look for divs with role="button" containing "show more"
      Array.from(tweetElement.querySelectorAll('div[role="button"]')).find(div => {
        const text = div.textContent.trim().toLowerCase();
        return text === 'show more' || text === 'read more' ||
               (text.includes('show') && text.includes('more') && !text.includes('less'));
      }) ||
      // Look for elements with aria-label containing "show more"
      Array.from(tweetElement.querySelectorAll('[aria-label]')).find(el => {
        const label = (el.getAttribute('aria-label') || '').toLowerCase();
        return label.includes('show') && label.includes('more') && !label.includes('less');
      });

    // If we found a "show more" button, the tweet is truncated
    // If we find "show less", the tweet is already expanded
    const showLessButton =
      Array.from(tweetElement.querySelectorAll('span[role="button"], button, div[role="button"]')).find(el => {
        const text = el.textContent.trim().toLowerCase();
        return text === 'show less' || text === 'read less' ||
               (text.includes('show') && text.includes('less'));
      }) ||
      Array.from(tweetElement.querySelectorAll('[aria-label]')).find(el => {
        const label = (el.getAttribute('aria-label') || '').toLowerCase();
        return label.includes('show') && label.includes('less');
      });

    // Tweet is truncated if it has "show more" button and NO "show less" button
    return !!showMoreButton && !showLessButton;
  }

  /**
   * Generate a hash for tweet text to use as cache key
   * Uses a robust hash function to minimize collisions
   */
  function hashTweetText(text) {
    if (!text) return '';

    // Normalize the text for hashing (remove extra whitespace, lowercase)
    const normalized = text.trim().toLowerCase().replace(/\s+/g, ' ');

    // Create a numeric hash using the entire normalized text
    // This provides good collision resistance while being efficient
    let numHash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      numHash = ((numHash << 5) - numHash) + char;
      numHash = numHash & numHash; // Convert to 32bit integer
    }

    // Combine with length to add more uniqueness
    return `${numHash}_${normalized.length}`;
  }

  /**
   * Get cached IQ result for tweet text
   */
  function getCachedIQ(tweetText) {
    const hash = hashTweetText(tweetText);
    return iqCache.get(hash);
  }

  /**
   * Store IQ result in cache for tweet text
   */
  function cacheIQ(tweetText, result) {
    const hash = hashTweetText(tweetText);

    // Check cache size and prune old entries if necessary
    if (iqCache.size >= MAX_CACHE_SIZE) {
      // Remove oldest 20% of entries (simple FIFO)
      const keysToRemove = Array.from(iqCache.keys()).slice(0, Math.floor(MAX_CACHE_SIZE * 0.2));
      keysToRemove.forEach(key => {
        iqCache.delete(key);
        chrome.storage.local.remove(CACHE_KEY_PREFIX + key, () => {});
      });
      debugLog(`Pruned cache, removed ${keysToRemove.length} old entries`);
    }

    // Store in memory cache
    iqCache.set(hash, result);

    // Store in persistent storage
    const cacheData = {};
    cacheData[CACHE_KEY_PREFIX + hash] = result;
    chrome.storage.local.set(cacheData, () => {});
  }

  /**
   * Try to extract full text from a truncated tweet without visually expanding it
   * Checks innerHTML, all text nodes, and data attributes that might contain full text
   */
  function tryExtractFullTextWithoutExpanding(tweetElement) {
    // Find the tweet text container
    const textContainer = tweetElement.querySelector('[data-testid="tweetText"]');
    if (!textContainer) {
      return null;
    }

    // Method 0: Check if we already stored the full text in a data attribute
    const storedFullText = tweetElement.getAttribute('data-iq-full-text');
    if (storedFullText && storedFullText.length > 50) {
      return storedFullText;
    }

    // Method 0.5: Check React Fiber or internal state (if accessible)
    // Try to find the full text in aria-label or title attributes
    const textSpans = textContainer.querySelectorAll('span');
    for (const span of textSpans) {
      const ariaLabel = span.getAttribute('aria-label');
      const title = span.getAttribute('title');
      if (ariaLabel && ariaLabel.length > 200) {
        return ariaLabel.trim();
      }
      if (title && title.length > 200) {
        return title.trim();
      }
    }

    // Method 1: Get ALL text nodes recursively (includes hidden/collapsed text)
    // This is the most reliable method - Twitter/X often has the full text in the DOM
    const walker = document.createTreeWalker(
      textContainer,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    const allTextParts = [];
    let node;
    while (node = walker.nextNode()) {
      const text = node.textContent.trim();
      // Filter out button text and UI elements
      if (text &&
          !text.toLowerCase().includes('show more') &&
          !text.toLowerCase().includes('read more') &&
          !text.toLowerCase().includes('show less') &&
          !text.toLowerCase().includes('read less') &&
          text.length > 0) {
        allTextParts.push(text);
      }
    }

    if (allTextParts.length > 0) {
      // Join all text parts and clean up
      let fullText = allTextParts.join(' ').replace(/\s+/g, ' ').trim();

      // Remove any remaining "Show more" text that might be embedded
      fullText = fullText.replace(/\bshow\s+more\b/gi, '').trim();

      if (fullText.length > 50) {
        return fullText;
      }
    }

    // Method 2: Check innerHTML - sometimes the full text is there but hidden via CSS
    const innerHTML = textContainer.innerHTML || '';
    if (innerHTML.length > 0) {
      // Create a temporary div to parse the HTML and get all text
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = innerHTML;
      const fullTextFromHTML = tempDiv.textContent || tempDiv.innerText || '';

      // Remove "Show more" button text if present
      let cleanedText = fullTextFromHTML.replace(/show\s+more/gi, '').replace(/\s+/g, ' ').trim();

      if (cleanedText.length > 50) {
        return cleanedText;
      }
    }

    // Method 3: Look for elements with aria-expanded or data attributes that might contain full text
    const expandedElements = textContainer.querySelectorAll('[aria-expanded], [data-full-text], [data-original-text]');
    for (const elem of expandedElements) {
      const dataText = elem.getAttribute('data-full-text') ||
                      elem.getAttribute('data-original-text') ||
                      (elem.textContent || '');

      if (dataText.length > 50 && !dataText.toLowerCase().includes('show more')) {
        return dataText.trim();
      }
    }

    // Method 4: Check all child elements regardless of visibility
    const allElements = textContainer.querySelectorAll('*');
    let longestText = '';
    for (const elem of allElements) {
      const text = (elem.textContent || elem.innerText || '').trim();
      if (text.length > longestText.length &&
          text.length > 50 &&
          !text.toLowerCase().includes('show more') &&
          !text.toLowerCase().includes('read more')) {
        longestText = text;
      }
    }

    if (longestText.length > 50) {
      return longestText;
    }

    return null;
  }

  /**
   * Extract full text from truncated tweet without visually expanding it
   * Uses MutationObserver to detect expansion, extracts text instantly, then manipulates DOM to restore truncated state
   */
  async function extractFullTextWithoutVisualExpansion(tweetElement) {
    return new Promise((resolve) => {
      try {
        // Find the actual "show more" button
        const showMoreButton = tweetElement.querySelector('button[data-testid="tweet-text-show-more-link"]') ||
          tweetElement.querySelector('span[data-testid="expand-text"]') ||
          Array.from(tweetElement.querySelectorAll('button, span[role="button"]')).find(el => {
            const text = (el.textContent || '').trim().toLowerCase();
            const testId = el.getAttribute('data-testid') || '';
            return (text.includes('show') && text.includes('more') && !text.includes('less')) ||
                   testId.includes('show-more') || testId.includes('expand');
          });

        if (!showMoreButton) {
          resolve(null);
          return;
        }

        // Get the text container first (needed for baseline measurement)
        const textContainer = tweetElement.querySelector('[data-testid="tweetText"]');
        if (!textContainer) {
          resolve(null);
          return;
        }

        // Store baseline text length before expansion
        const baselineText = extractTweetText(tweetElement);
        const baselineLength = baselineText ? baselineText.length : 0;

        // Store the original HTML structure before expansion
        const originalHTML = textContainer.innerHTML;

        // Set up MutationObserver to catch expansion immediately
        let expansionDetected = false;
        let fullText = null;

        // Store original container height before expansion for visual truncation
        const originalHeight = textContainer.getBoundingClientRect().height;

        const observer = new MutationObserver((mutations) => {
          // Check if text has expanded (length increased significantly)
          const currentText = extractTweetText(tweetElement);
          if (currentText && currentText.length > baselineLength + 50 && !expansionDetected) {
            expansionDetected = true;
            fullText = currentText;

            // Immediately stop observing
            observer.disconnect();

            try {
              // Store the full text in a data attribute for potential reuse
              tweetElement.setAttribute('data-iq-full-text', fullText);

              // Since X/Twitter removes the "Show more" button after expansion,
              // we need to visually truncate the text and add our own toggle button
              // Calculate height for visual truncation
              const expandedHeight = textContainer.getBoundingClientRect().height;
              const lineHeight = expandedHeight / (fullText.length / 50); // Rough estimate: ~50 chars per line
              const targetHeight = Math.max(originalHeight, lineHeight * 4); // Show ~4 lines initially

              // Apply CSS to visually truncate (but keep button visible)
              textContainer.style.maxHeight = `${targetHeight}px`;
              textContainer.style.overflow = 'hidden';
              textContainer.style.position = 'relative';
              textContainer.setAttribute('data-iq-truncated', 'true');
              textContainer.setAttribute('data-iq-target-height', targetHeight.toString());

              // Find or create the parent wrapper to place button outside truncated area
              let parentWrapper = textContainer.parentElement;
              if (!parentWrapper || !parentWrapper.querySelector('[data-iq-toggle-btn]')) {
                // Create a custom "Show more/Less" toggle button that matches X/Twitter's structure
                const buttonWrapper = document.createElement('button');
                buttonWrapper.setAttribute('data-iq-toggle-btn', 'true');
                buttonWrapper.setAttribute('type', 'button');
                buttonWrapper.setAttribute('dir', 'ltr');
                buttonWrapper.setAttribute('role', 'button');
                buttonWrapper.className = 'css-146c3p1 r-bcqeeo r-qvutc0 r-37j5jr r-a023e6 r-rjixqe r-16dba41 r-fdjqy7';
                buttonWrapper.style.cssText = 'color: rgb(29, 155, 240); background: none; border: none; cursor: pointer; padding: 0; margin: 0; font-size: inherit; font-family: inherit; display: inline-block; position: relative; z-index: 10;';

                const span = document.createElement('span');
                span.className = 'css-1jxf684 r-bcqeeo r-1ttztb7 r-qvutc0 r-poiln3';
                span.textContent = 'Show more';
                span.style.cssText = 'color: inherit;';

                buttonWrapper.appendChild(span);

                buttonWrapper.onclick = (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const isTruncated = textContainer.getAttribute('data-iq-truncated') === 'true';
                  const savedHeight = parseFloat(textContainer.getAttribute('data-iq-target-height') || targetHeight);
                  if (isTruncated) {
                    // Currently truncated, expand it
                    textContainer.style.maxHeight = 'none';
                    textContainer.removeAttribute('data-iq-truncated');
                    span.textContent = 'Show less';
                  } else {
                    // Currently expanded, truncate it
                    textContainer.style.maxHeight = `${savedHeight}px`;
                    textContainer.setAttribute('data-iq-truncated', 'true');
                    span.textContent = 'Show more';
                  }
                };

                // Insert button AFTER the text container (sibling, not child) so it's not hidden by overflow
                if (parentWrapper) {
                  parentWrapper.insertBefore(buttonWrapper, textContainer.nextSibling);
                } else {
                  textContainer.parentNode.insertBefore(buttonWrapper, textContainer.nextSibling);
                }
              }

              resolve(fullText);
            } catch (e) {
              resolve(fullText);
            }
          }
        });

        // Start observing
        observer.observe(textContainer, {
          childList: true,
          subtree: true,
          characterData: true
        });

        // Click the button to trigger expansion
        try {
          showMoreButton.click();
        } catch (e) {
          try {
            const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
            showMoreButton.dispatchEvent(clickEvent);
          } catch (e2) {
            observer.disconnect();
            resolve(null);
            return;
          }
        }

        // Fallback timeout - if MutationObserver doesn't catch it in time
        // Capture baselineLength in closure to ensure it's available
        const capturedBaselineLength = baselineLength;
        setTimeout(() => {
          if (!expansionDetected) {
            observer.disconnect();
            const currentText = extractTweetText(tweetElement);
            if (currentText && currentText.length > capturedBaselineLength + 50) {
              tweetElement.setAttribute('data-iq-full-text', currentText);
              resolve(currentText);
            } else {
              resolve(null);
            }
          }
        }, 500);

      } catch (e) {
        resolve(null);
      }
    });
  }

  /**
   * DEPRECATED: This function is no longer used.
   * We now extract full text using hidden clone method to avoid visual expansion.
   */
  function expandExtractCollapseTweet(tweetElement) {
    // Legacy stub - not used anymore, we now use extractFullTextWithoutVisualExpansion instead
    return Promise.resolve();
  }

  /**
   * Expand truncated tweets by clicking "show more" button if present
   * Returns a promise that resolves when expansion is complete
   * Includes verification that expansion actually occurred
   * NOTE: This function now tries to extract without expanding first
   */
  function expandTruncatedTweet(tweetElement) {
    return new Promise((resolve) => {
      // Get initial text length for comparison
      const initialText = extractTweetText(tweetElement);
      const initialLength = initialText ? initialText.length : 0;

      // Look for "Show more" button using expanded selector list
      const showMoreButton =
        // Standard Twitter/X selectors
        tweetElement.querySelector('span[data-testid="expand-text"]') ||
        tweetElement.querySelector('button[data-testid="show-more"]') ||
        tweetElement.querySelector('[data-testid="app-text-transition-container"] span[role="button"]') ||
        // Look for span elements with role="button"
        Array.from(tweetElement.querySelectorAll('span[role="button"]')).find(span => {
          const text = span.textContent.trim().toLowerCase();
          return text === 'show more' || text === 'read more' || text === 'show' ||
                 (text.includes('show') && text.includes('more'));
        }) ||
        // Look for button elements
        Array.from(tweetElement.querySelectorAll('button')).find(btn => {
          const text = btn.textContent.trim().toLowerCase();
          return text === 'show more' || text === 'read more' ||
                 (text.includes('show') && text.includes('more'));
        }) ||
        // Look for divs with role="button"
        Array.from(tweetElement.querySelectorAll('div[role="button"]')).find(div => {
          const text = div.textContent.trim().toLowerCase();
          return text === 'show more' || text === 'read more' ||
                 (text.includes('show') && text.includes('more'));
        }) ||
        // Look for elements with aria-label
        Array.from(tweetElement.querySelectorAll('[aria-label]')).find(el => {
          const label = (el.getAttribute('aria-label') || '').toLowerCase();
          return label.includes('show') && label.includes('more');
        });

      if (showMoreButton) {

        // Try multiple click methods for better compatibility
        try {
          // Method 1: Direct click
          showMoreButton.click();
        } catch (e1) {
          try {
            // Method 2: MouseEvent
            const clickEvent = new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              view: window
            });
            showMoreButton.dispatchEvent(clickEvent);
          } catch (e2) {
            try {
              // Method 3: Focus and Enter key
              if (showMoreButton.focus) {
                showMoreButton.focus();
              }
              const enterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                bubbles: true,
                cancelable: true
              });
              showMoreButton.dispatchEvent(enterEvent);
            } catch (e3) {
              // Silent fail
            }
          }
        }

        // Wait and verify expansion occurred
        let attempts = 0;
        const maxAttempts = 10; // Try for up to 1 second (10 * 100ms)

        const checkExpansion = () => {
          attempts++;
          const currentText = extractTweetText(tweetElement);
          const currentLength = currentText ? currentText.length : 0;

          // Check if:
          // 1. Text length increased significantly (expansion worked)
          // 2. The "show more" button disappeared (expansion worked)
          // 3. Maximum attempts reached (give up)
          const buttonStillExists = tweetElement.querySelector('span[data-testid="expand-text"]') ||
                                   Array.from(tweetElement.querySelectorAll('span[role="button"], button')).some(el => {
                                     const text = el.textContent.trim().toLowerCase();
                                     return (text.includes('show') && text.includes('more'));
                                   });

          if (currentLength > initialLength + 50 || !buttonStillExists || attempts >= maxAttempts) {
            // Expansion likely complete, or we've tried enough
            resolve();
          } else {
            // Keep checking
            setTimeout(checkExpansion, 100);
          }
        };

        // Start checking after initial delay
        setTimeout(checkExpansion, 200);
      } else {
        // No expansion needed, resolve immediately
        resolve();
      }
    });
  }

  /**
   * Extract tweet text from a tweet article element
   * Excludes usernames, metadata, quoted tweets, and other non-content text
   */
  function extractTweetText(tweetElement) {
    // Strategy: The main tweet text is typically the FIRST occurrence and shallower in the DOM
    // Quoted tweets are nested deeper and come later in the DOM tree
    // On single tweet pages, we need to be extra careful to exclude quoted content

    // Check if we're on a single tweet page (not feed)
    const isSingleTweetPage = /\/status\/\d+/.test(window.location.pathname);

    // First, find the main tweet container (the top-level article or div with tweet data-testid)
    // Handle nested structures (e.g., notifications where wrapper contains actual tweet)
    let mainTweetContainer = tweetElement.querySelector('[data-testid="tweet"]') ||
                            (tweetElement.getAttribute('data-testid') === 'tweet' ? tweetElement : null);

    // If we found a nested tweet container, use that as the main container
    // This handles notification pages where the wrapper article contains the actual tweet
    if (mainTweetContainer && mainTweetContainer !== tweetElement) {
      tweetElement = mainTweetContainer;
    }

    // Fallback to original element if no nested tweet found
    if (!mainTweetContainer) {
      mainTweetContainer = tweetElement;
    }

    // Find ALL tweetText elements in this article (main tweet + any quoted tweets)
    const allTweetTextElements = Array.from(tweetElement.querySelectorAll('[data-testid="tweetText"]'));

    if (allTweetTextElements.length === 0) {
      return null;
    }

    // If there's only one, use it (but verify it's not a quoted tweet)
    if (allTweetTextElements.length === 1) {
      const textElement = allTweetTextElements[0];
      const depth = getElementDepth(textElement, mainTweetContainer);
      const isQuoted = isInsideQuotedTweet(textElement, tweetElement);

      // Only skip if it's actually inside a quoted tweet container
      // Don't be too aggressive with "Quote" label checking - it might appear elsewhere on the page
      if (isQuoted) {
        return null;
      }

      // On single tweet pages, if the text is very deep (>12) and there's a quoted container,
      // check if this text element is actually inside the quoted container
      if (isSingleTweetPage && depth > 12) {
        const quotedContainer = tweetElement.querySelector('[data-testid="quotedTweet"]') ||
                               tweetElement.querySelector('[data-testid="quoteTweet"]');
        if (quotedContainer && quotedContainer.contains(textElement)) {
          return null; // This text is inside the quoted tweet, main tweet has no text
        }
      }

      // Extract and return the text if it exists
      let text = textElement.innerText || textElement.textContent || '';
      text = text.trim();
      if (text.length > 0) {
        return text;
      }
      return null;
    }

    // If multiple tweetText elements exist, find the one that's:
    // 1. Not inside a quoted tweet container
    // 2. Closest to the root (shallower in DOM)
    // 3. Comes first in document order

    let mainTextElement = null;
    let shallowestDepth = Infinity;
    let firstNonQuotedIndex = -1;

    for (let i = 0; i < allTweetTextElements.length; i++) {
      const textElement = allTweetTextElements[i];
      const isQuoted = isInsideQuotedTweet(textElement, tweetElement);
      const depth = getElementDepth(textElement, mainTweetContainer);

      // Skip if inside a quoted tweet
      if (isQuoted) {
        continue;
      }

      // Prefer the shallowest AND earliest in document order
      if (depth < shallowestDepth || (depth === shallowestDepth && firstNonQuotedIndex === -1)) {
        shallowestDepth = depth;
        mainTextElement = textElement;
        firstNonQuotedIndex = i;
      }
    }

    // Safety check: If we found a main text element, verify it's not suspiciously deep
    // Main tweet text should be relatively shallow (depth < 10 typically)
    if (mainTextElement && shallowestDepth > 12) {
      // This might actually be a quoted tweet that we didn't detect
      // Check if there's a shallower element we might have missed
      const previousElement = mainTextElement;
      mainTextElement = null;
      shallowestDepth = Infinity;

      // Try again with stricter depth limit
      for (let i = 0; i < allTweetTextElements.length; i++) {
        const textElement = allTweetTextElements[i];
        if (!isInsideQuotedTweet(textElement, tweetElement)) {
          const depth = getElementDepth(textElement, mainTweetContainer);
          if (depth < shallowestDepth && depth <= 10) {
            shallowestDepth = depth;
            mainTextElement = textElement;
          }
        }
      }

      if (!mainTextElement) {
        mainTextElement = previousElement;
      }
    }

    if (mainTextElement) {
      let text = mainTextElement.innerText || mainTextElement.textContent || '';
      text = text.trim();
      if (text.length > 0) {
        return text;
      }
    }

    // Fallback: If no tweetText elements worked, try other selectors but exclude quoted
    const textCandidates = tweetElement.querySelectorAll('div[lang], div[dir="auto"]');
    for (const candidate of textCandidates) {
      if (!isInsideQuotedTweet(candidate, tweetElement)) {
        const depth = getElementDepth(candidate, mainTweetContainer);
        if (depth <= 6) { // Main tweet text is usually shallow
          let text = candidate.innerText || candidate.textContent || '';
          text = text.trim();

          if (text.length > 5 &&
              !text.match(/^@\w+/) &&
              !text.match(/^\d+[h|m|d|w]?$/)) {
            return text;
          }
        }
      }
    }

    // If no meaningful text found in main tweet, return null
    return null;
  }

  /**
   * Check if an element is inside a quoted tweet container
   */
  function isInsideQuotedTweet(element, tweetElement) {
    const isSingleTweetPage = /\/status\/\d+/.test(window.location.pathname);

    // Check if element is inside any known quoted tweet containers
    const quotedSelectors = [
      '[data-testid="quotedTweet"]',
      '[data-testid="quoteTweet"]',
    ];

    // First, check if we're inside any explicitly marked quoted tweet
    for (const selector of quotedSelectors) {
      try {
        const quotedContainer = tweetElement.querySelector(selector);
        if (quotedContainer && quotedContainer.contains(element)) {
          return true;
        }
      } catch (e) {
        // Ignore selector errors
      }
    }

    // Check for nested articles - quoted tweets are nested articles within the same tweet
    let current = element;
    let articleCount = 0;
    const articles = [];

    while (current && current !== tweetElement) {
      // Count articles we encounter
      if (current.tagName === 'ARTICLE') {
        articleCount++;
        articles.push(current);

        // If we're inside a nested article (second+ article), check if it's actually a quoted tweet
        // Not just any article - must be nested within the tweet structure
        if (articleCount > 1) {
          // Double-check: see if this article is nested inside another article or tweet container
          // AND is marked as a quoted tweet
          const isQuotedContainer = current.querySelector('[data-testid="quotedTweet"]') ||
                                   current.querySelector('[data-testid="quoteTweet"]') ||
                                   current.getAttribute('data-testid') === 'quotedTweet';

          if (isQuotedContainer) {
            return true; // This is definitely inside a quoted tweet container
          }

          // Also check if parent structure indicates quoted tweet
          let parent = current.parentElement;
          while (parent && parent !== tweetElement) {
            if (parent.tagName === 'ARTICLE' ||
                parent.getAttribute('data-testid') === 'tweet' ||
                parent.querySelector('[data-testid="tweet"]')) {
              // Found nested article structure - but only return true if explicitly marked as quoted
              if (parent.querySelector('[data-testid="quotedTweet"]') ||
                  parent.querySelector('[data-testid="quoteTweet"]')) {
                return true;
              }
            }
            parent = parent.parentElement;
          }
        }
      }

      current = current.parentElement;
      if (!current) break;
    }

    // Also check depth - if the element is very deep, it might be in a quoted tweet
    // Main tweet text is usually at depth 4-8, quoted tweets are usually 10+
    const mainContainer = tweetElement.querySelector('[data-testid="tweet"]') || tweetElement;
    const depth = getElementDepth(element, mainContainer);

    // If depth > 15 and we're not sure, be cautious - likely quoted
    // But only if there's a shallower tweetText element (which would be the main tweet)
    if (depth > 15) {
      const allTexts = tweetElement.querySelectorAll('[data-testid="tweetText"]');
      for (const otherText of allTexts) {
        if (otherText !== element) {
          const otherDepth = getElementDepth(otherText, mainContainer);
          // Only return true if there's a MUCH shallower element (difference of 5+)
          // This indicates the main tweet text is at a normal depth and this is likely quoted
          if (otherDepth < depth - 5) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Calculate DOM depth of an element relative to a parent
   */
  function getElementDepth(element, root) {
    let depth = 0;
    let current = element;
    while (current && current !== root && depth < 50) {
      current = current.parentElement;
      depth++;
      if (!current) break;
    }
    return depth;
  }

  /**
   * Validate text before processing
   * Returns {isValid: boolean, reason: string}
   */
  function validateTweetText(text) {
    if (!text || text.trim().length === 0) {
      return { isValid: false, reason: 'Empty text' };
    }

    // Remove emojis and check if there are actual words
    const textWithoutEmoji = text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();

    if (textWithoutEmoji.length === 0) {
      return { isValid: false, reason: 'Emoji-only content' };
    }

    // Extract actual words (excluding emojis, symbols)
    const words = textWithoutEmoji.match(/\b[a-zA-Z]{2,}\b/g) || [];

    if (words.length < 5) {
      return {
        isValid: false,
        reason: `Too few words (${words.length}, minimum 5 required)`
      };
    }

    // Check if it's mostly just metadata/username
    // Allow @mentions at the start IF there's substantial content after them
    // Match @mention (username can contain letters, numbers, underscore)
    const startsWithMention = text.match(/^@[\w]+/);
    let textToCheck = text;

    // If starts with @mention, remove it for validation purposes
    // but only reject if the remaining text is too short
    if (startsWithMention) {
      // Remove the @mention and any trailing space
      const mentionMatch = text.match(/^@[\w]+\s*/);
      if (mentionMatch) {
        textToCheck = text.substring(mentionMatch[0].length).trim();
      } else {
        textToCheck = text.substring(startsWithMention[0].length).trim();
      }
      const remainingWords = textToCheck.match(/\b[a-zA-Z]{2,}\b/g) || [];
      // If after removing @mention, there are still at least 5 words, it's valid
      if (remainingWords.length >= 5) {
        // Valid - has @mention but also substantial content
        return { isValid: true, reason: null };
      }
      // Otherwise, treat as invalid (just @mention without sufficient content)
      return { isValid: false, reason: 'Starts with @mention but insufficient content after' };
    }

    // Check other metadata patterns
    const isLikelyMetadata =
      text.match(/^\d+[h|m|d|w|s]?\s*$/) ||  // Just time/date
      words.length < textWithoutEmoji.split(/\s+/).length * 0.3;  // Less than 30% actual words

    if (isLikelyMetadata) {
      return { isValid: false, reason: 'Appears to be metadata, not tweet content' };
    }

    return { isValid: true, reason: null };
  }

  /**
   * Get IQ color based on score (desaturated for elegant appearance)
   */
  function getIQColor(iq) {
    // Gradient from 55 (red) to 145+ (green)
    // 55-85: red to orange
    // 85-105: orange to yellow
    // 105-125: yellow to light green
    // 125-145+: light green to green
    let baseColor;

    if (iq < 70) {
      // Dark red
      baseColor = '#d32f2f';
    } else if (iq < 80) {
      // Red to orange-red
      const t = (iq - 70) / 10;
      baseColor = interpolateColor('#d32f2f', '#f57c00', t);
    } else if (iq < 90) {
      // Orange-red to orange
      const t = (iq - 80) / 10;
      baseColor = interpolateColor('#f57c00', '#fb8c00', t);
    } else if (iq < 95) {
      // Orange to yellow-orange
      const t = (iq - 90) / 5;
      baseColor = interpolateColor('#fb8c00', '#fbc02d', t);
    } else if (iq < 105) {
      // Yellow-orange to yellow
      const t = (iq - 95) / 10;
      baseColor = interpolateColor('#fbc02d', '#fdd835', t);
    } else if (iq < 115) {
      // Yellow to yellow-green
      const t = (iq - 105) / 10;
      baseColor = interpolateColor('#fdd835', '#c5e1a5', t);
    } else if (iq < 125) {
      // Yellow-green to light green
      const t = (iq - 115) / 10;
      baseColor = interpolateColor('#c5e1a5', '#81c784', t);
    } else if (iq < 135) {
      // Light green to green
      const t = (iq - 125) / 10;
      baseColor = interpolateColor('#81c784', '#66bb6a', t);
    } else if (iq < 145) {
      // Green to dark green
      const t = (iq - 135) / 10;
      baseColor = interpolateColor('#66bb6a', '#4caf50', t);
    } else {
      // Dark green for 145+
      baseColor = '#2e7d32';
    }

    // Desaturate the color for a more elegant appearance
    let rgb;
    if (baseColor.startsWith('rgb')) {
      // baseColor is already in RGB format from interpolateColor
      const match = baseColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (match) {
        rgb = { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) };
      } else {
        rgb = { r: 0, g: 0, b: 0 };
      }
    } else {
      // baseColor is hex format
      rgb = hexToRgb(baseColor);
    }
    const desat = desaturateColor(rgb, 0.5);
    return `rgb(${desat.r}, ${desat.g}, ${desat.b})`;
  }

  /**
   * Interpolate between two hex colors
   */
  function interpolateColor(color1, color2, t) {
    const c1 = hexToRgb(color1);
    const c2 = hexToRgb(color2);

    const r = Math.round(c1.r + (c2.r - c1.r) * t);
    const g = Math.round(c1.g + (c2.g - c1.g) * t);
    const b = Math.round(c1.b + (c2.b - c1.b) * t);

    return `rgb(${r}, ${g}, ${b})`;
  }

  /**
   * Convert hex color to RGB
   */
  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }

  /**
   * Desaturate a color by a percentage (0-1)
   */
  function desaturateColor(rgb, amount = 0.4) {
    const gray = Math.round(rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114);
    return {
      r: Math.round(rgb.r + (gray - rgb.r) * amount),
      g: Math.round(rgb.g + (gray - rgb.g) * amount),
      b: Math.round(rgb.b + (gray - rgb.b) * amount)
    };
  }

  /**
   * Create loading badge while IQ is being calculated
   * Uses a darker red than the lowest IQ color with a rotating spinner
   */
  function createLoadingBadge() {
    const badge = document.createElement('span');
    badge.className = 'iq-badge iq-badge-loading';
    badge.setAttribute('data-iq-loading', 'true');

    // Use a darker red than the lowest IQ color (#d32f2f)
    // Darker shade: #b71c1c (one shade darker)
    const darkerRed = '#b71c1c';
    const rgb = hexToRgb(darkerRed);
    // Apply desaturation like getIQColor does for consistency
    const desat = desaturateColor(rgb, 0.5);
    const loadingColor = `rgb(${desat.r}, ${desat.g}, ${desat.b})`;

    badge.style.setProperty('background-color', loadingColor, 'important');
    badge.style.setProperty('color', '#000000', 'important');
    badge.style.setProperty('cursor', 'wait', 'important');
    badge.style.setProperty('display', 'inline-flex', 'important');
    badge.style.setProperty('visibility', 'visible', 'important');
    badge.style.setProperty('opacity', '1', 'important');

    badge.innerHTML = `
      <span class="iq-label">IQ</span>
      <span class="iq-score">
        <span class="iq-loading-spinner">↻</span>
      </span>
    `;

    return badge;
  }

  /**
   * Create "X" badge for invalid tweets (no text, too short, etc.)
   */
  function createInvalidBadge() {
    const badge = document.createElement('span');
    badge.className = 'iq-badge iq-badge-invalid iq-badge-flip';
    badge.setAttribute('data-iq-invalid', 'true');

    // Use gray color for invalid tweets
    badge.style.setProperty('background-color', '#9e9e9e', 'important');
    badge.style.setProperty('color', '#000000', 'important');
    badge.style.setProperty('cursor', 'help', 'important');
    badge.style.setProperty('display', 'inline-flex', 'important');
    badge.style.setProperty('visibility', 'visible', 'important');
    badge.style.setProperty('opacity', '1', 'important');

    // Create flip structure: front shows "IQ X", back shows "NO text"
    badge.innerHTML = `
      <div class="iq-badge-inner">
        <div class="iq-badge-front">
          <span class="iq-label">IQ</span>
          <span class="iq-score">✕</span>
        </div>
        <div class="iq-badge-back">
          <span class="iq-label">NO</span>
          <span class="iq-score">text</span>
        </div>
      </div>
    `;

    return badge;
  }

  /**
   * Debug logging helper
   * Debug mode is enabled by default
   */
  // Enable debug mode by default
  if (typeof window.__IQ_DEBUG__ === 'undefined') {
    window.__IQ_DEBUG__ = true;
  }

  function debugLog(message, data = null) {
    if (window.__IQ_DEBUG__) {
      console.log(`[IQ Badge Debug] ${message}`, data || '');
    }
  }

  /**
   * Animate count-up from 0 to final IQ, then pulse animation
   * Uses ease-out for fast start, slow end
   * @param {HTMLElement} badge - The badge element
   * @param {number} finalIQ - The final IQ score
   * @param {string} iqColor - The final background color
   */
  function animateCountUp(badge, finalIQ, iqColor) {
    // Check if animation already started or completed
    if (badge.hasAttribute('data-iq-animating') || badge.hasAttribute('data-iq-animated')) {
      return;
    }

    // Get the loading color (darker red) for color interpolation
    const darkerRed = '#b71c1c';
    const rgb = hexToRgb(darkerRed);
    const desat = desaturateColor(rgb, 0.5);
    const loadingColor = `rgb(${desat.r}, ${desat.g}, ${desat.b})`;

    // Parse final color for interpolation
    const finalColorRgb = parseColor(iqColor);

    function startAnimation() {
      // Check again to avoid double-start
      if (badge.hasAttribute('data-iq-animating') || badge.hasAttribute('data-iq-animated')) {
        return;
      }

      // Mark as animating
      badge.setAttribute('data-iq-animating', 'true');

      // Replace spinner with score element for counting
      const scoreContainer = badge.querySelector('.iq-score');

      if (!scoreContainer) {
        // Fallback if score element doesn't exist
        badge.innerHTML = `
          <span class="iq-label">IQ</span>
          <span class="iq-score">${finalIQ}</span>
        `;
        badge.classList.remove('iq-badge-loading');
        badge.removeAttribute('data-iq-animating');
        badge.setAttribute('data-iq-animated', 'true');
        return;
      }

      // Remove spinner, start counting from 0
      // Check if we already have flip structure (confidence might have been set before animation)
      const hasFlipStructure = badge.querySelector('.iq-badge-inner');
      let scoreElement;

      if (hasFlipStructure) {
        // Use the front score element in flip structure
        scoreElement = badge.querySelector('.iq-badge-front .iq-score');
        if (!scoreElement) {
          // Create front score element if missing
          const frontDiv = badge.querySelector('.iq-badge-front');
          if (frontDiv) {
            const label = frontDiv.querySelector('.iq-label') || document.createElement('span');
            if (!label.classList.contains('iq-label')) {
              label.className = 'iq-label';
              label.textContent = 'IQ';
            }
            const score = document.createElement('span');
            score.className = 'iq-score';
            score.textContent = '0';
            frontDiv.innerHTML = '';
            frontDiv.appendChild(label);
            frontDiv.appendChild(score);
            scoreElement = score;
          }
        } else {
          scoreElement.textContent = '0';
        }
      } else {
        // No flip structure yet - use the scoreContainer directly
        if (scoreContainer) {
          scoreContainer.innerHTML = '0';
          scoreElement = scoreContainer;
        } else {
          // Create simple structure
          badge.innerHTML = `
            <span class="iq-label">IQ</span>
            <span class="iq-score">0</span>
          `;
          scoreElement = badge.querySelector('.iq-score');
        }
      }

      // Remove loading class and spinner
      badge.classList.remove('iq-badge-loading');
      const spinner = badge.querySelector('.iq-loading-spinner');
      if (spinner) {
        spinner.remove();
      }

      const duration = 1200; // Total animation duration in ms
      const startTime = performance.now(); // Use performance.now() for better precision
      let lastDisplayedIQ = -1;
      let animationFrameId = null;
      let lastUpdateTime = startTime;
      let freezeDetectionTime = startTime; // Track when we last updated to detect freezes
      const FREEZE_THRESHOLD = 150; // If no update for 150ms, consider it frozen
      let isShowingSpinner = false; // Track if we're currently showing the spinner
      let frozenAtIQ = -1; // Track the IQ value when we froze


      function updateNumber() {
        const now = performance.now();
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Freeze detection: if too much time has passed since last update, we're frozen
        // Only detect freezes after we've displayed at least one number (lastDisplayedIQ >= 0)
        const timeSinceLastUpdate = now - freezeDetectionTime;
        const isFrozen = timeSinceLastUpdate > FREEZE_THRESHOLD && lastDisplayedIQ >= 0 && lastDisplayedIQ < finalIQ && !isShowingSpinner;

        // If frozen and we're not already showing the spinner, show it
        if (isFrozen && !isShowingSpinner) {
          frozenAtIQ = lastDisplayedIQ;
          isShowingSpinner = true;
          // Replace the number with the loading spinner
          scoreElement.innerHTML = '<span class="iq-loading-spinner">↻</span>';
        }

        // If we were frozen but now we're updating again (unfrozen), resume from next number
        if (!isFrozen && isShowingSpinner) {
          isShowingSpinner = false;
          // Resume from the next number after where we froze
          const resumeIQ = Math.min(frozenAtIQ + 1, finalIQ);
          lastDisplayedIQ = resumeIQ;
          frozenAtIQ = -1; // Reset
          // Remove spinner and show the number
          scoreElement.textContent = resumeIQ;
          freezeDetectionTime = now; // Reset freeze detection
        }

        // Ease-out cubic function: fast start, slow end
        // f(t) = 1 - (1 - t)^3
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        let targetIQ = progress >= 1 ? finalIQ : Math.floor(easedProgress * finalIQ);

        // CRITICAL FIX: Ensure incremental updates - never jump more than a few numbers at a time
        // If browser throttles or frames are bunched, cap the maximum change per frame
        const maxIncrement = Math.max(1, Math.ceil(finalIQ / 50)); // Max 1/50th of total per frame
        let currentIQ = lastDisplayedIQ === -1 ? 0 : lastDisplayedIQ;

        // If we're past duration (progress >= 1), force increment towards final
        if (progress >= 1) {
          // After duration, increment by at least 1 per frame until we reach final
          currentIQ = Math.min(currentIQ + maxIncrement, finalIQ);
          targetIQ = finalIQ;
        } else if (targetIQ > currentIQ) {
          // Don't jump too far ahead - increment gradually
          const difference = targetIQ - currentIQ;
          if (difference > maxIncrement) {
            currentIQ = currentIQ + maxIncrement;
          } else {
            currentIQ = targetIQ;
          }
        } else {
          currentIQ = targetIQ;
        }

        // Force update if we haven't updated in a while (prevents stalling)
        const timeSinceLastUpdate2 = now - lastUpdateTime;
        const shouldForceUpdate = timeSinceLastUpdate2 > 50; // Force update every 50ms minimum

        // Always update if IQ changed OR if we need to force update OR if we're near the end
        // But don't update if we're currently showing the spinner (we're frozen)
        if ((currentIQ !== lastDisplayedIQ || shouldForceUpdate || progress >= 0.95) && !isShowingSpinner) {
          // If we're near the end and not at final, force progress
          if (progress >= 0.95 && currentIQ < finalIQ - 1) {
            currentIQ = Math.min(currentIQ + 1, finalIQ);
          }

          // Clamp to final IQ
          if (currentIQ > finalIQ) {
            currentIQ = finalIQ;
          }

          // Only update if it actually changed or we're forcing it
          const willUpdate = currentIQ !== lastDisplayedIQ || shouldForceUpdate || progress >= 0.95;
          if (willUpdate) {
            scoreElement.textContent = currentIQ;
            lastDisplayedIQ = currentIQ;
            lastUpdateTime = now;
            freezeDetectionTime = now; // Update freeze detection time when we successfully update
          }

          // Always update color smoothly (this helps with visual smoothness)
          const currentColor = interpolateRgbColor(
            parseColor(loadingColor),
            finalColorRgb,
            easedProgress
          );
          badge.style.setProperty('background-color', currentColor, 'important');
        } else if (isShowingSpinner) {
          // Even when frozen, update the color smoothly
          const currentColor = interpolateRgbColor(
            parseColor(loadingColor),
            finalColorRgb,
            easedProgress
          );
          badge.style.setProperty('background-color', currentColor, 'important');
        }

        // Continue animation until we've reached the final IQ
        // Don't stop just because progress >= 1, we need to actually reach the final number
        const hasReachedFinal = lastDisplayedIQ >= finalIQ;

        if (!hasReachedFinal) {
          // Continue animation - always schedule next frame
          animationFrameId = requestAnimationFrame(updateNumber);
        } else {
          // Animation complete - we've reached the final IQ

          // Remove spinner if it's still showing
          if (isShowingSpinner) {
            isShowingSpinner = false;
            const spinner = scoreElement.querySelector('.iq-loading-spinner');
            if (spinner) {
              spinner.remove();
            }
          }

          // Ensure final number and color are shown (should already be set, but just in case)
          scoreElement.textContent = finalIQ;
          badge.style.setProperty('background-color', iqColor, 'important');

          // Cancel any pending animation frame
          if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
          }

          // Mark as animated
          badge.removeAttribute('data-iq-animating');
          badge.setAttribute('data-iq-animated', 'true');

          // Set up flip structure with confidence if available (after animation completes)
          const confidenceAttr = badge.getAttribute('data-confidence');
          if (confidenceAttr !== null) {
            const confidence = parseInt(confidenceAttr, 10);
            updateBadgeWithFlipStructure(badge, finalIQ, confidence);
          }

          // Small delay before pulse animation to ensure final number is visible
          setTimeout(() => {
            // Trigger pulse animation with color transition
            triggerPulseAnimation(badge, iqColor);
          }, 200);
        }
      }

      // Start animation immediately
      updateNumber();
    }

    // Use IntersectionObserver to trigger animation when badge becomes visible
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // Badge is now visible - start animation
          observer.disconnect();
          startAnimation();
        }
      });
    }, {
      threshold: 0.01, // Trigger when badge is visible (even 1%)
      rootMargin: '50px' // Start a bit before it's fully visible
    });

    // Start observing the badge
    observer.observe(badge);

    // Also check if already visible (might be in viewport already)
    const rect = badge.getBoundingClientRect();
    const isVisible = rect.top < window.innerHeight + 50 && rect.bottom > -50;
    if (isVisible) {
      // Already visible, start animation immediately
      observer.disconnect();
      startAnimation();
    }
  }

  /**
   * Update badge HTML structure to support flip animation showing confidence
   */
  function updateBadgeWithFlipStructure(badge, iq, confidence) {
    // Only update if badge has finished animating (not loading)
    if (badge.classList.contains('iq-badge-loading') || badge.hasAttribute('data-iq-loading')) {
      return;
    }

    // Check if already has flip structure
    if (badge.querySelector('.iq-badge-inner')) {
      // Update existing structure
      const frontScore = badge.querySelector('.iq-badge-front .iq-score');
      const backLabel = badge.querySelector('.iq-badge-back .iq-label');
      const backScore = badge.querySelector('.iq-badge-back .iq-score');

      if (frontScore) {
        frontScore.textContent = iq;
      }
      if (backLabel) {
        backLabel.textContent = '%';
      }
      if (backScore) {
        backScore.textContent = confidence;
      }

      // CRITICAL: Ensure flip inner stays at 0deg (front visible) after update
      const inner = badge.querySelector('.iq-badge-inner');
      if (inner) {
        inner.style.transform = 'rotateY(0deg)';
        inner.style.transformStyle = 'preserve-3d';
        inner.style.margin = '0';
        inner.style.padding = '0';
      }

      // Ensure front and back maintain consistent positioning
      const front = badge.querySelector('.iq-badge-front');
      const back = badge.querySelector('.iq-badge-back');
      if (front) {
        front.style.margin = '0';
        front.style.padding = '0';
        front.style.top = '0';
      }
      if (back) {
        back.style.margin = '0';
        back.style.padding = '0';
        back.style.top = '0';
      }
      return;
    }

    // Get current badge content
    const currentLabel = badge.querySelector('.iq-label');
    const currentScore = badge.querySelector('.iq-score');
    const labelText = currentLabel ? currentLabel.textContent : 'IQ';
    const scoreText = currentScore ? currentScore.textContent : String(iq);

    // Create flip structure
    badge.innerHTML = `
      <div class="iq-badge-inner" style="transform: rotateY(0deg);">
        <div class="iq-badge-front">
          <span class="iq-label">${labelText}</span>
          <span class="iq-score">${scoreText}</span>
        </div>
        <div class="iq-badge-back">
          <span class="iq-label">%</span>
          <span class="iq-score">${confidence}</span>
        </div>
      </div>
    `;

    // Add class to indicate this badge has flip functionality
    badge.classList.add('iq-badge-flip');

    // CRITICAL: Ensure flip inner starts at 0deg (front visible)
    // Let CSS handle transform via .iq-badge-flip .iq-badge-inner rule
    const inner = badge.querySelector('.iq-badge-inner');
    if (inner) {
      // Remove inline transform to allow CSS hover to work properly
      inner.style.removeProperty('transform');
      inner.style.setProperty('transform-style', 'preserve-3d', 'important');
      inner.style.margin = '0';
      inner.style.padding = '0';
    }

    // Ensure front and back maintain consistent positioning
    const front = badge.querySelector('.iq-badge-front');
    const back = badge.querySelector('.iq-badge-back');
    if (front) {
      front.style.margin = '0';
      front.style.padding = '0';
      front.style.top = '0';
    }
    if (back) {
      back.style.margin = '0';
      back.style.padding = '0';
      back.style.top = '0';
    }
  }

  /**
   * Parse color string to RGB object
   */
  function parseColor(colorStr) {
    if (colorStr.startsWith('rgb')) {
      const match = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (match) {
        return { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) };
      }
    } else if (colorStr.startsWith('#')) {
      return hexToRgb(colorStr);
    }
    return { r: 0, g: 0, b: 0 };
  }

  /**
   * Interpolate between two RGB colors
   */
  function interpolateRgbColor(color1, color2, t) {
    const r = Math.round(color1.r + (color2.r - color1.r) * t);
    const g = Math.round(color1.g + (color2.g - color1.g) * t);
    const b = Math.round(color1.b + (color2.b - color1.b) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }

  /**
   * Trigger pulse animation with color transition (black -> white -> black)
   * @param {HTMLElement} badge - The badge element
   * @param {string} iqColor - The final background color
   */
  function triggerPulseAnimation(badge, iqColor) {
    // Find score element - could be in flip structure (front) or direct
    let scoreElement = badge.querySelector('.iq-badge-front .iq-score') ||
                       badge.querySelector('.iq-score');
    if (!scoreElement) return;

    // Add pulse animation class
    badge.classList.add('iq-badge-pulse');

    // Color transition: black -> white -> black
    const startTime = Date.now();
    const duration = 300;

    function updateColor() {
      const elapsed = Date.now() - startTime;

      if (elapsed < duration) {
        // Phase 1 (0-150ms): black to white
        if (elapsed < 150) {
          const t = elapsed / 150;
          const value = Math.floor(0 + (255 - 0) * t);
          scoreElement.style.color = `rgb(${value}, ${value}, ${value})`;
        } else {
          // Phase 2 (150-300ms): white to black
          const t = (elapsed - 150) / 150;
          const value = Math.floor(255 + (0 - 255) * t);
          scoreElement.style.color = `rgb(${value}, ${value}, ${value})`;
        }
        requestAnimationFrame(updateColor);
      } else {
        // Animation complete - reset to black
        scoreElement.style.color = '#000000';
        badge.classList.remove('iq-badge-pulse');
      }
    }

    updateColor();
  }

  /**
   * Create IQ badge element with debug data attached
   * @param {number} iq - Rounded IQ score
   * @param {Object} estimationResult - Full estimation result object
   * @param {string} tweetText - Original tweet text
   */
  function createIQBadge(iq, estimationResult, tweetText) {
    const badge = document.createElement('span');
    badge.className = 'iq-badge';
    badge.setAttribute('data-iq-score', iq);

    // Store confidence if available
    const confidence = estimationResult.confidence ? Math.round(estimationResult.confidence) : null;
    if (confidence !== null) {
      badge.setAttribute('data-confidence', confidence);
    }

    // Store debug data on the badge element for hover access
    badge._debugData = {
      iq: iq,
      result: estimationResult,
      text: tweetText,
      timestamp: new Date().toISOString()
    };

    const iqColor = getIQColor(iq);
    badge.style.setProperty('background-color', iqColor, 'important');
    badge.style.setProperty('color', '#000000', 'important');
    badge.style.setProperty('cursor', 'help', 'important');

    // Create flip structure if confidence is available, otherwise use simple structure
    if (confidence !== null) {
      badge.innerHTML = `
        <div class="iq-badge-inner">
          <div class="iq-badge-front">
            <span class="iq-label">IQ</span>
            <span class="iq-score">${iq}</span>
          </div>
          <div class="iq-badge-back">
            <span class="iq-label">%</span>
            <span class="iq-score">${confidence}</span>
          </div>
        </div>
      `;
      badge.classList.add('iq-badge-flip');
    } else {
      badge.innerHTML = `
        <span class="iq-label">IQ</span>
        <span class="iq-score">${iq}</span>
      `;
    }

    // Re-apply background color after innerHTML in case it got reset
    badge.style.setProperty('background-color', iqColor, 'important');
    badge.style.setProperty('color', '#000000', 'important');

    // Add hover event listeners for debug output (only if no confidence, since flip will show it)
    if (confidence === null) {
      badge.addEventListener('mouseenter', () => {
        logDebugInfo(badge._debugData);
      });
    }

    return badge;
  }

  /**
   * Log comprehensive debug information to console
   * @param {Object} debugData - Debug data stored on badge
   */
  function logDebugInfo(debugData) {
    const { iq, result, text, timestamp } = debugData;

    // Clear previous output with visual separator
    console.log(
      '%c' + '='.repeat(80),
      'color: #4CAF50; font-weight: bold; font-size: 14px;'
    );
    console.log(
      '%c🧠 IQ ESTIMATION DEBUG - Hover Details',
      'color: #2196F3; font-weight: bold; font-size: 16px; background: #E3F2FD; padding: 4px 8px;'
    );
    console.log('%c' + '='.repeat(80), 'color: #4CAF50; font-weight: bold;');

    // Original Text
    console.group('%c📝 Original Text', 'color: #FF9800; font-weight: bold;');
    console.log('%c' + text, 'color: #333; font-family: monospace; background: #FFF9C4; padding: 8px; border-left: 3px solid #FFC107;');
    console.log(`Length: ${text.length} characters, ${text.split(/\s+/).length} words`);
    console.groupEnd();

    // Final IQ Estimate
    console.group('%c🎯 Final IQ Estimate', 'color: #9C27B0; font-weight: bold;');
    console.log(
      '%c' + `IQ: ${iq.toFixed(1)}`,
      'font-size: 20px; font-weight: bold; color: #7B1FA2; background: #F3E5F5; padding: 8px;'
    );
    console.log(`Confidence: ${result.confidence?.toFixed(1) || 'N/A'}%`);
    console.log(`Method: ${result.dimension_scores ? 'Knowledge-Based (4 Dimensions)' : 'Unknown'}`);
    if (result.is_twitter_calibrated !== undefined) {
      const calibrationType = result.is_twitter_calibrated ? 'Twitter (≤300 chars)' : 'Essay/Long Text';
      console.log(`%cCalibration: ${calibrationType}`, `color: ${result.is_twitter_calibrated ? '#FF9800' : '#2196F3'}; font-weight: bold;`);
      console.log(`Text Length: ${result.text_length || text.length} characters`);
    }
    console.groupEnd();

    // Dimension Breakdown
    if (result.dimension_scores) {
      console.group('%c📊 Dimension Breakdown (Weighted Combination)', 'color: #2196F3; font-weight: bold;');

      // Use Twitter weights if Twitter calibration was applied
      const weights = result.is_twitter_calibrated ? {
        vocabulary_sophistication: 0.45,  // Increased for tweets - word choice efficiency matters more
        lexical_diversity: 0.25,
        sentence_complexity: 0.15,       // Reduced for tweets - constrained by 280 chars
        grammatical_precision: 0.15      // Reduced for tweets - syntax less important when space-constrained
      } : {
        vocabulary_sophistication: 0.35,
        lexical_diversity: 0.25,
        sentence_complexity: 0.20,
        grammatical_precision: 0.20
      };

      Object.entries(result.dimension_scores).forEach(([dim, dimIQ]) => {
        const weight = weights[dim] || 0;
        const contribution = dimIQ * weight;
        const contributionPercent = ((contribution / iq) * 100).toFixed(1);

        const dimName = dim
          .replace(/_/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase());

        console.log(
          `%c${dimName}: ${dimIQ.toFixed(1)} IQ`,
          `color: ${getDimensionColor(dim)}; font-weight: bold;`
        );
        console.log(`  Weight: ${(weight * 100).toFixed(0)}% | Contribution: ${contribution.toFixed(1)} (${contributionPercent}% of final)`);
      });

      console.groupEnd();
    }

    // Feature Extraction Details - Use actual computed features from result
    console.group('%c🔍 Feature Extraction Details', 'color: #00BCD4; font-weight: bold;');

    // Access features if stored in result, otherwise calculate basic ones
    const features = result.features || {};
    const tokens = features.tokens || text.match(/\b\w+\b/g) || [];
    const sentences = features.sentences || text.split(/[.!?]+/).filter(s => s.trim().length > 0);

    // Vocabulary Sophistication Features
    console.log(`%c📚 Vocabulary Sophistication Features:`, 'font-weight: bold; color: #E91E63;');
    console.log(`  Average Word Length: ${features.avg_word_length?.toFixed(2) || (tokens.length > 0 ? (tokens.reduce((s, t) => s + t.length, 0) / tokens.length).toFixed(2) : '0.00')} chars`);
    console.log(`  Average Syllables per Word: ${features.avg_syllables?.toFixed(2) || 'N/A'}`);
    console.log(`  Total Words: ${tokens.length}`);
    console.log(`  Advanced Words (8+ chars): ${tokens.filter(t => t.length >= 8).length} (${tokens.length > 0 ? ((tokens.filter(t => t.length >= 8).length / tokens.length) * 100).toFixed(1) : 0}%)`);
    if (features.mean_aoa !== undefined) {
      console.log(`  Mean Age of Acquisition (AoA): ${features.mean_aoa.toFixed(2)} years`);
      console.log(`  Advanced Vocabulary (%): ${features.pct_advanced?.toFixed(1) || 'N/A'}%`);
      console.log(`  AoA Dictionary Match Rate: ${features.aoa_match_rate?.toFixed(1) || 0}%`);
    }
    console.log(`  Trained Mapping: IQ = 70 + (mean_aoa - 3.91) × 24 + pct_advanced × 1.0`);

    // Lexical Diversity Features
    console.log(`%c🔤 Lexical Diversity Features:`, 'font-weight: bold; color: #3F51B5;');
    if (features.ttr !== undefined) {
      console.log(`  Type-Token Ratio (TTR): ${features.ttr.toFixed(4)}`);
    }
    if (features.msttr !== undefined) {
      console.log(`  Mean Segmental TTR (MSTTR): ${features.msttr.toFixed(4)}`);
    }
    if (features.mtld !== undefined) {
      console.log(`  Measure of Textual Lexical Diversity (MTLD): ${features.mtld.toFixed(2)}`);
      console.log(`    → Higher MTLD = more diverse vocabulary usage`);
    }
    if (features.yules_k !== undefined) {
      console.log(`  Yule's K (Vocabulary Richness): ${features.yules_k.toFixed(2)}`);
      console.log(`    → Lower Yule's K = more diverse, Higher = more repetitive`);
    }
    const uniqueTokens = new Set(tokens.map(t => t.toLowerCase()));
    console.log(`  Unique Words: ${uniqueTokens.size} of ${tokens.length}`);
    console.log(`  Trained Mapping: IQ = 70 + (TTR - 0.659) × 170 (+ MTLD & Yule's K adjustments)`);

    // Sentence Complexity Features
    console.log(`%c📝 Sentence Complexity Features:`, 'font-weight: bold; color: #009688;');
    console.log(`  Average Words per Sentence: ${features.avg_words_per_sentence?.toFixed(2) || (sentences.length > 0 ? (tokens.length / sentences.length).toFixed(2) : '0.00')}`);
    console.log(`  Total Sentences: ${sentences.length}`);
    if (features.sentence_variance !== undefined) {
      console.log(`  Sentence Length Variance (std dev): ${features.sentence_variance.toFixed(2)}`);
      console.log(`    → Higher variance = more variety in sentence structure`);
    }
    if (features.readability) {
      console.log(`  Readability Indices:`);
      console.log(`    Flesch-Kincaid Grade Level: ${features.readability.flesch_kincaid?.toFixed(1) || 'N/A'}`);
      console.log(`    SMOG Index: ${features.readability.smog?.toFixed(1) || 'N/A'}`);
      console.log(`    ARI (Automated Readability): ${features.readability.ari?.toFixed(1) || 'N/A'}`);
      console.log(`    LIX (Readability Index): ${features.readability.lix?.toFixed(1) || 'N/A'}`);
    }
    if (features.lexical_overlap !== undefined) {
      console.log(`  Lexical Overlap: ${features.lexical_overlap.toFixed(3)}`);
      console.log(`    → Lower overlap = more varied writing = higher complexity`);
    }
    const sentenceBaseline = result.is_twitter_calibrated ? 8.5 : 11.0;
    const calibrationNote = result.is_twitter_calibrated ? ' (Twitter-adjusted baseline)' : ' (+ variance & readability boosts)';
    console.log(`  Trained Mapping: IQ = 60 + (avg_words - ${sentenceBaseline}) × 6.0${calibrationNote}`);

    // Grammatical Precision Features
    console.log(`%c⚙️ Grammatical Precision Features:`, 'font-weight: bold; color: #FF5722;');
    if (features.punctuation_complexity !== undefined) {
      console.log(`  Punctuation Complexity: ${features.punctuation_complexity.toFixed(2)} per sentence`);
    }
    if (features.punctuation_entropy !== undefined) {
      console.log(`  Punctuation Entropy (Shannon): ${features.punctuation_entropy.toFixed(3)}`);
      console.log(`    → Higher entropy = more varied punctuation usage`);
    }
    if (features.subordinate_clauses !== undefined) {
      console.log(`  Subordinate Clauses: ${features.subordinate_clauses.toFixed(2)} per sentence`);
    }
    if (features.connective_density !== undefined) {
      console.log(`  Connective Density: ${features.connective_density.toFixed(4)}`);
      console.log(`    → Optimal range 0.08-0.20 indicates good logical flow`);
    }
    if (features.avg_dependency_depth !== undefined) {
      console.log(`  Average Dependency Depth: ${features.avg_dependency_depth.toFixed(3)}`);
      console.log(`    → Enhanced approximation (calibrated on Python spaCy results)`);
      console.log(`    → Uses: punctuation, clauses, relative clauses, sentence length, prepositions`);
    }
    console.log(`  Trained Mapping: IQ = 53 + (dep_depth - 1.795) × 80 (+ entropy & connectives)`);

    console.groupEnd();

    // Calculation Summary
    console.group('%c🧮 Calculation Summary', 'color: #795548; font-weight: bold;');
    console.log(`Weighted Average Formula:`);
    console.log(`  IQ = (Vocab × 35% + Diversity × 25% + Sentence × 20% + Grammar × 20%)`);
    if (result.dimension_scores) {
      const calculated =
        (result.dimension_scores.vocabulary_sophistication || 100) * 0.35 +
        (result.dimension_scores.lexical_diversity || 100) * 0.25 +
        (result.dimension_scores.sentence_complexity || 100) * 0.20 +
        (result.dimension_scores.grammatical_precision || 100) * 0.20;
      console.log(`  = (${(result.dimension_scores.vocabulary_sophistication || 100).toFixed(1)} × 0.35) + ` +
                  `(${(result.dimension_scores.lexical_diversity || 100).toFixed(1)} × 0.25) + ` +
                  `(${(result.dimension_scores.sentence_complexity || 100).toFixed(1)} × 0.20) + ` +
                  `(${(result.dimension_scores.grammatical_precision || 100).toFixed(1)} × 0.20)`);
      console.log(`  = ${calculated.toFixed(2)} → Rounded: ${Math.round(calculated)}`);
    }
    console.groupEnd();

    // Full Result Object (collapsed)
    console.groupCollapsed('%c📦 Full Result Object', 'color: #607D8B; font-weight: bold;');
    console.log(result);
    console.groupEnd();

    // Timestamp
    console.log(
      `%c⏰ Analyzed at: ${new Date(timestamp).toLocaleTimeString()}`,
      'color: #757575; font-style: italic;'
    );
    console.log(
      '%c' + '='.repeat(80),
      'color: #4CAF50; font-weight: bold; font-size: 14px;'
    );
  }

  /**
   * Get color for dimension in console output
   */
  function getDimensionColor(dimension) {
    const colors = {
      vocabulary_sophistication: '#E91E63',
      lexical_diversity: '#3F51B5',
      sentence_complexity: '#009688',
      grammatical_precision: '#FF5722'
    };
    return colors[dimension] || '#757575';
  }

  /**
   * Process a single tweet
   */
  async function processTweet(tweetElement) {
    if (!tweetElement || !settings.showIQBadge) {
      return;
    }

    // Handle nested tweet structures (notifications)
    // Find the actual tweet article if this is a wrapper
    let actualTweetElement = tweetElement;
    const nestedTweet = tweetElement.querySelector('article[data-testid="tweet"]') ||
                        tweetElement.querySelector('article[role="article"]');
    if (nestedTweet && nestedTweet !== tweetElement) {
      actualTweetElement = nestedTweet;
      // Mark the wrapper as analyzed to avoid reprocessing
      tweetElement.setAttribute('data-iq-analyzed', 'true');
    }

    // Skip if already processed (including invalid badges)
    if (actualTweetElement.hasAttribute('data-iq-analyzed')) {
      return;
    }

    // Check if badge already exists and is finalized (not loading)
    const existingBadge = actualTweetElement.querySelector('.iq-badge');
    if (existingBadge && !existingBadge.hasAttribute('data-iq-loading') &&
        !existingBadge.classList.contains('iq-badge-loading') &&
        !existingBadge.hasAttribute('data-iq-invalid')) {
      actualTweetElement.setAttribute('data-iq-analyzed', 'true');
      return;
    }

    // Mark as processing to avoid double-processing
    actualTweetElement.setAttribute('data-iq-processing', 'true');

    // STEP 1: Quick synchronous text extraction for early validation
    let tweetText = null;
    tweetText = extractTweetText(actualTweetElement);

    // STEP 2: Early validation - if invalid, show X badge immediately
    if (!tweetText) {
      if (settings.showIQBadge) {
        // Remove any loading badge and show X badge
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
        // Remove any loading badge and show X badge
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

    // STEP 3: Text is valid - ensure loading badge exists and persists
    let loadingBadge = null;
    if (settings.showIQBadge) {
      // Check for existing loading badge
      loadingBadge = actualTweetElement.querySelector('.iq-badge[data-iq-loading="true"]') ||
                     actualTweetElement.querySelector('.iq-badge-loading');

      // If no loading badge exists, create one now
      if (!loadingBadge) {
        loadingBadge = createLoadingBadge();

        // Try to find engagement bar
        const engagementBar = actualTweetElement.querySelector('[role="group"]');
        if (engagementBar) {
          const firstChild = engagementBar.firstElementChild;
          if (firstChild) {
            engagementBar.insertBefore(loadingBadge, firstChild);
          } else {
            engagementBar.appendChild(loadingBadge);
          }
        } else {
          // Fallback: attach to tweet element
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

      // Ensure the badge is in the right place (engagement bar is preferred)
      if (loadingBadge && loadingBadge.parentElement) {
        const engagementBar = actualTweetElement.querySelector('[role="group"]');
        if (engagementBar && !engagementBar.contains(loadingBadge)) {
          // Move badge to engagement bar if it exists
          const firstChild = engagementBar.firstElementChild;
          if (firstChild) {
            engagementBar.insertBefore(loadingBadge, firstChild);
          } else {
            engagementBar.appendChild(loadingBadge);
          }
        }
      }
    }

    // STEP 4: Now do async full text extraction for better accuracy

    // VERIFY loading badge is still visible before async operations
    if (settings.showIQBadge && loadingBadge) {
      if (!loadingBadge.parentElement) {
        // Recreate it if lost
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

    // First, check if tweet is already expanded - if so, just extract normally
    const alreadyExpanded = Array.from(actualTweetElement.querySelectorAll('span[role="button"], button, div[role="button"]')).some(el => {
      const text = el.textContent.trim().toLowerCase();
      return text === 'show less' || text === 'read less' ||
             (text.includes('show') && text.includes('less'));
    });

    // If already expanded, just extract normally (don't try to collapse it)
    if (alreadyExpanded) {
      tweetText = extractTweetText(actualTweetElement);
    } else if (isTweetTruncated(actualTweetElement)) {

      // Extract full text without visually expanding the tweet
      tweetText = tryExtractFullTextWithoutExpanding(actualTweetElement);

      // Get a baseline to compare - what would normal extraction give us?
      const baselineText = extractTweetText(actualTweetElement);
      const baselineLength = baselineText ? baselineText.length : 0;

      // If extracted text is similar to baseline (within 50 chars), it's likely truncated
      // Try the expansion method to get the full text
      const extractedLength = tweetText ? tweetText.length : 0;

      // Check if we're likely getting truncated text:
      // Since we detected a truncated tweet, if extracted text is similar to baseline,
      // we're definitely getting truncated text and should try expansion
      const likelyTruncated = !tweetText ||
                              Math.abs(extractedLength - baselineLength) < 100; // Within 100 chars means they're similar

      if (likelyTruncated && baselineLength > 50) {
        // Likely truncated - try expansion method

        // VERIFY badge before async expansion
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

        // VERIFY badge after async expansion
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
          // Even if not much better, use it if it's longer
          tweetText = expandedText;
        } else if (tweetText) {
          // Keep existing extracted text
        } else {
          tweetText = baselineText;
        }
      } else if (!tweetText) {
        tweetText = baselineText;
      }
    }

    // Continue with async extraction (already validated above, but get better text)
    // This is for truncated tweets - we already have a valid quick extract

    try {
      // VERIFY loading badge still exists before async operation
      if (settings.showIQBadge) {
        // Re-check loading badge in case it was removed
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

      // Check cache first to avoid recalculation
      let result = getCachedIQ(tweetText);
      let fromCache = false;

      if (!result) {
        // Calculate IQ using the comprehensive client-side estimator (async with real dependency parsing)
        result = await iqEstimator.estimate(tweetText);

        // Cache the result if valid
        if (result.is_valid && result.iq_estimate !== null) {
          cacheIQ(tweetText, result);
        }
      } else {
        fromCache = true;
        debugLog('Using cached IQ result for tweet');
      }

      // Only show badge if estimation was successful
      if (result.is_valid && result.iq_estimate !== null && settings.showIQBadge) {
        const iq = Math.round(result.iq_estimate);

        // If we have a loading badge, transition it to the final badge with count-up animation
        if (loadingBadge && loadingBadge.parentElement) {

          // Get the final IQ color
          const iqColor = getIQColor(iq);

          // Update badge attributes (keep loading spinner until animation starts)
          loadingBadge.removeAttribute('data-iq-loading');
          loadingBadge.setAttribute('data-iq-score', iq);
          // Don't change background color yet - let animation interpolate it
          loadingBadge.style.setProperty('cursor', 'help', 'important');

          // Store animation data on badge
          loadingBadge._animationData = {
            finalIQ: iq,
            iqColor: iqColor
          };

          // Start count-up animation from 0 to final IQ (will trigger when visible)
          // Animation will remove spinner and interpolate colors
          animateCountUp(loadingBadge, iq, iqColor);

          // Store debug data on the badge element for hover access
          loadingBadge._debugData = {
            iq: iq,
            result: result,
            text: tweetText,
            timestamp: new Date().toISOString()
          };

          // Store confidence for flip display
          const confidence = result.confidence ? Math.round(result.confidence) : null;
          if (confidence !== null) {
            loadingBadge.setAttribute('data-confidence', confidence);
            updateBadgeWithFlipStructure(loadingBadge, iq, confidence);
          }

          // Add hover event listener for debug info (only log if confidence not available)
          if (confidence === null) {
            loadingBadge.addEventListener('mouseenter', () => {
              logDebugInfo(loadingBadge._debugData);
            });
          }

          processedTweets.add(actualTweetElement);
          actualTweetElement.setAttribute('data-iq-analyzed', 'true');
          actualTweetElement.removeAttribute('data-iq-processing');
        } else {
          // Fallback: create new badge if loading badge doesn't exist
          const badge = createIQBadge(iq, result, tweetText);

          // Store confidence for flip display
          const confidence = result.confidence ? Math.round(result.confidence) : null;
          if (confidence !== null) {
            badge.setAttribute('data-confidence', confidence);
          }

          // Store animation data and prepare for animation
          const iqColor = getIQColor(iq);
          badge._animationData = {
            finalIQ: iq,
            iqColor: iqColor
          };

          // Store current IQ in a data attribute temporarily
          badge.setAttribute('data-final-iq', iq);

          // Don't change the badge yet - animation will handle it when visible
          // The badge already has the final IQ from createIQBadge, so we need to
          // set it to show 0 and keep loading state until animation starts

          // Replace final IQ with 0 temporarily, animation will count up
          const scoreElement = badge.querySelector('.iq-score');
          if (scoreElement) {
            scoreElement.textContent = '0';
          }

          // Set initial loading color (darker red)
          const darkerRed = '#b71c1c';
          const rgb = hexToRgb(darkerRed);
          const desat = desaturateColor(rgb, 0.5);
          const loadingColor = `rgb(${desat.r}, ${desat.g}, ${desat.b})`;
          badge.style.setProperty('background-color', loadingColor, 'important');

          // Start count-up animation (will trigger when visible)
          animateCountUp(badge, iq, iqColor);

          // Find the engagement bar (comments, retweets, likes, views, bookmarks)
          const engagementBar = actualTweetElement.querySelector('[role="group"]');
          if (engagementBar) {
            // Insert badge as the first item, before the comment icon
            const firstChild = engagementBar.firstElementChild;
            if (firstChild) {
              engagementBar.insertBefore(badge, firstChild);
            } else {
              engagementBar.appendChild(badge);
            }
          } else {
            // Fallback: append to the end of the tweet article
            actualTweetElement.appendChild(badge);
          }

          processedTweets.add(actualTweetElement);
          actualTweetElement.setAttribute('data-iq-analyzed', 'true');
          actualTweetElement.removeAttribute('data-iq-processing');
        }
      } else {
        // Remove loading badge if estimation failed
        if (loadingBadge) {
          loadingBadge.remove();
        }
        actualTweetElement.removeAttribute('data-iq-processing');
      }
    } catch (error) {
      console.error('Error processing tweet:', error);
      // Remove loading badge on error
      if (loadingBadge) {
        loadingBadge.remove();
      }
    } finally {
      // Remove processing flag even if there was an error
      actualTweetElement.removeAttribute('data-iq-processing');
    }
  }

  /**
   * Process all visible tweets
   */
  function processVisibleTweets() {
    // Find all tweet articles (X.com/Twitter structure)
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

    // Fallback: find any article elements that might be tweets
    if (tweets.length === 0) {
      tweets = document.querySelectorAll('article');
    }

    // Process tweets and handle nested structure (e.g., notifications)
    const processedTweetElements = new Set();
    const newTweets = [];

    Array.from(tweets).forEach((tweet, index) => {
      if (!tweet || tweet.hasAttribute('data-iq-processing')) {
        return;
      }

      // Check if this article contains a nested tweet article (common in notifications)
      // If so, prefer the nested one as it's the actual tweet
      const nestedTweet = tweet.querySelector('article[data-testid="tweet"]') ||
                          tweet.querySelector('article[role="article"]');

      let actualTweet = tweet;
      if (nestedTweet && nestedTweet !== tweet) {
        actualTweet = nestedTweet;
      }

      // Check if tweet was already processed but badge is missing (e.g., after scroll/virtualization)
      if (actualTweet.hasAttribute('data-iq-analyzed')) {
        // If badge is missing, we need to restore it
        const existingBadge = actualTweet.querySelector('.iq-badge');
        if (!existingBadge && settings.showIQBadge) {
          // Badge was removed - re-process the tweet to restore it
          // Clear the analyzed flag to allow reprocessing
          actualTweet.removeAttribute('data-iq-analyzed');
          // Remove from processedTweets set if it's there
          processedTweets.delete(actualTweet);
        } else {
          // Badge exists, skip this tweet
          return;
        }
      }

      // Now handle normal processing logic
      if (nestedTweet && nestedTweet !== tweet) {
        // Use the nested tweet if it hasn't been processed
        if (!nestedTweet.hasAttribute('data-iq-analyzed') &&
            !nestedTweet.hasAttribute('data-iq-processing') &&
            !processedTweetElements.has(nestedTweet)) {
          newTweets.push(nestedTweet);
          processedTweetElements.add(nestedTweet);
        }
      } else {
        // Use this tweet if it contains tweet text or has tweet indicators
        // Skip notification wrappers that don't have actual tweet content
        const hasTweetText = tweet.querySelector('[data-testid="tweetText"]');
        const hasEngagementBar = tweet.querySelector('[role="group"]');

        // Only process if it looks like an actual tweet (has text or engagement bar)
        // This prevents processing empty notification wrapper articles
        if ((hasTweetText || hasEngagementBar) && !processedTweetElements.has(tweet)) {
          newTweets.push(tweet);
          processedTweetElements.add(tweet);
        }
      }
    });

    // Add loading badges to ALL new tweets (completely non-blocking)
    if (settings.showIQBadge) {
      newTweets.forEach((tweet) => {
        // Use setTimeout(0) to schedule badge insertion without blocking
        setTimeout(() => {
          if (!tweet.querySelector('.iq-badge')) {
            addLoadingBadgeToTweet(tweet);
          }
        }, 0);
      });
    }

    // Process each tweet (non-blocking, separate from badge insertion)
    // This handles validation and IQ calculation - completely async
    setTimeout(() => {
      newTweets.forEach((tweet) => {
        processTweet(tweet);
      });
    }, 0);
  }

  /**
   * Lightweight function to add a loading badge to a single tweet
   * This is extremely lightweight and non-blocking
   */
  function addLoadingBadgeToTweet(tweet) {
    if (!settings.showIQBadge || tweet.querySelector('.iq-badge')) {
      return;
    }

    // Handle nested tweet structures (notifications)
    // Find the actual tweet article if this is a wrapper
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
        // Silently fail - don't log errors in hot path
      }
    } else {
      try {
        actualTweet.insertBefore(loadingBadge, actualTweet.firstChild);
      } catch (e) {
        // Silently fail
      }
    }
  }

  /**
   * Setup MutationObserver to watch for new tweets
   * Extremely lightweight - only schedules badge insertion, doesn't block anything
   */
  function setupObserver() {
    const observer = new MutationObserver((mutations) => {
      // Keep this callback EXTREMELY lightweight - just collect nodes
      const potentialTweets = [];

      for (let i = 0; i < mutations.length; i++) {
        const mutation = mutations[i];
        for (let j = 0; j < mutation.addedNodes.length; j++) {
          const node = mutation.addedNodes[j];
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Lightweight check - just tag name and basic attribute
            if (node.tagName === 'ARTICLE') {
              potentialTweets.push(node);
            }
            // Also check for articles in added nodes (lightweight)
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

      // Schedule badge insertion for later (completely non-blocking)
      // Use setTimeout(0) which is even lighter than requestAnimationFrame
      if (potentialTweets.length > 0) {
        setTimeout(() => {
          potentialTweets.forEach((tweet) => {
            // Skip if already processed or has badge
            if (tweet.hasAttribute('data-iq-analyzed') ||
                tweet.hasAttribute('data-iq-processing') ||
                tweet.querySelector('.iq-badge')) {
              return;
            }
            // Add badge - lightweight operation
            addLoadingBadgeToTweet(tweet);
          });
        }, 0);
      }

      // Schedule full processing for later (separate, non-blocking)
      if (potentialTweets.length > 0) {
        setTimeout(() => {
          processVisibleTweets();
        }, 0);
      }
    });

    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return observer;
  }

  /**
   * Real-time IQ badge for comments and posts
   * Monitors text input areas and shows live IQ score as user types
   */
  const realtimeBadgeManagers = new Map(); // Track active input areas

  /**
   * Find text input elements for new posts or comments
   * Prioritizes active/focused compose boxes, especially those in modals
   */
  function findTextInputs() {
    const inputs = [];
    const prioritizedInputs = [];

    // Helper to check if element is in a modal/overlay (higher priority)
    function isInModal(element) {
      let parent = element.parentElement;
      let depth = 0;
      while (parent && depth < 10) {
        const style = window.getComputedStyle(parent);
        const zIndex = parseInt(style.zIndex) || 0;
        // Modals typically have high z-index
        if (zIndex > 1000 ||
            parent.getAttribute('role') === 'dialog' ||
            parent.classList.contains('r-') && style.position === 'fixed') {
          return true;
        }
        parent = parent.parentElement;
        depth++;
      }
      return false;
    }

    // Helper to check if element is visible and not hidden
    function isVisible(element) {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' &&
             style.visibility !== 'hidden' &&
             style.opacity !== '0' &&
             rect.width > 0 &&
             rect.height > 0;
    }

    // Find textareas (used in some Twitter/X interfaces)
    const textareas = document.querySelectorAll('textarea[data-testid="tweetTextarea_0"], textarea[data-testid*="tweetTextarea"]');
    textareas.forEach(textarea => {
      if (!textarea.hasAttribute('data-iq-realtime-monitored') && isVisible(textarea)) {
        // Check if it's focused or in a modal - prioritize these
        if (document.activeElement === textarea ||
            textarea === document.activeElement?.closest('form')?.querySelector('textarea') ||
            isInModal(textarea)) {
          prioritizedInputs.push(textarea);
        } else {
          inputs.push(textarea);
        }
      }
    });

    // Find contenteditable divs (main Twitter/X compose box)
    // Use broader selectors to catch all compose contexts
    const contentEditables = document.querySelectorAll(
      'div[data-testid="tweetTextarea_0"], ' +
      'div[data-testid*="tweetTextarea"], ' +
      'div[role="textbox"][contenteditable="true"]'
    );
    contentEditables.forEach(div => {
      // Make sure it's actually a compose box, not just any contenteditable
      // Check for multiple indicators - compose boxes typically have:
      // 1. Toolbar nearby (with tweet/post button, media buttons, etc.)
      // 2. Tweet button nearby
      // 3. Specific data-testid attributes
      // 4. Location in a compose/post page (URL check)
      // 5. Contains media/gif/poll buttons nearby
      const hasToolbar = div.closest('[data-testid="toolBar"]');
      const hasTweetButton = div.closest('[data-testid="tweetButton"]') ||
                            div.closest('button[data-testid*="tweetButton"]') ||
                            document.querySelector('button[data-testid*="tweetButton"]')?.closest('div')?.contains(div);
      const hasTestId = div.getAttribute('data-testid')?.includes('tweetTextarea') ||
                       div.getAttribute('data-testid')?.includes('tweet');
      const hasComposeIndicators = div.closest('[aria-label*="Tweet"], [aria-label*="Post"]') ||
                                  div.closest('div[data-testid*="toolBar"]') ||
                                  div.parentElement?.querySelector('button[data-testid*="tweetButton"], button[aria-label*="Tweet"], button[aria-label*="Post"]');

      // Check if we're on a compose/post page
      const isComposePage = window.location.pathname.includes('/compose/') ||
                           window.location.pathname === '/compose/post' ||
                           window.location.href.includes('/compose/post');

      // If on compose page, any visible contenteditable textbox is likely a compose box
      const isComposeBox = hasToolbar ||
                          hasTweetButton ||
                          hasTestId ||
                          hasComposeIndicators ||
                          (isComposePage && isVisible(div));

      if (isComposeBox && !div.hasAttribute('data-iq-realtime-monitored') && isVisible(div)) {
        // Check if it's focused, contains focused element, or in a modal - prioritize these
        const isFocused = document.activeElement === div ||
                         div.contains(document.activeElement);
        const inModal = isInModal(div);

        // Also check if this input is in a visible modal/dialog that's currently active
        // and hide badges in other non-modal contexts when a modal is active
        const parentModal = div.closest('[role="dialog"], [data-testid*="modal"]');
        const hasActiveModal = parentModal && isVisible(parentModal);

        if (isFocused || inModal || hasActiveModal) {
          prioritizedInputs.push(div);
        } else {
          inputs.push(div);
        }
      }
    });

    // Return prioritized inputs first, then others
    return [...prioritizedInputs, ...inputs];
  }

  /**
   * Get text content from an input element (handles both textarea and contenteditable)
   */
  function getInputText(inputElement) {
    if (inputElement.tagName === 'TEXTAREA') {
      return inputElement.value || '';
    } else {
      // Contenteditable div
      return inputElement.textContent || inputElement.innerText || '';
    }
  }

  /**
   * Create or update real-time IQ badge near the input area
   * Positioned to the left of "Everyone can reply"
   */
  function createRealtimeBadge(inputElement, container) {
    // Store inputElement reference on container for later use
    if (!container._iqInputElement) {
      container._iqInputElement = inputElement;
    }

    // IMPORTANT: Search for existing badge more broadly to prevent duplicates
    // Check in container first, then in nearby parent elements
    let badge = container.querySelector('.iq-badge-realtime');

    // If not found in container, search in parent containers and document
    if (!badge) {
      let searchContainer = container.parentElement;
      for (let i = 0; i < 3 && searchContainer; i++) {
        badge = searchContainer.querySelector('.iq-badge-realtime');
        if (badge) break;
        searchContainer = searchContainer.parentElement;
      }
    }

    // Last resort: search entire document for any badge near this input
    if (!badge && inputElement) {
      const allBadges = document.querySelectorAll('.iq-badge-realtime');
      for (const existingBadge of allBadges) {
        // Check if this badge is near our input element
        try {
          const inputRect = inputElement.getBoundingClientRect();
          const badgeRect = existingBadge.getBoundingClientRect();
          const distance = Math.abs(badgeRect.top - inputRect.bottom) + Math.abs(badgeRect.left - inputRect.left);
          if (distance < 300) { // Within 300px
            badge = existingBadge;
            // Update container reference to badge's actual container
            container = badge.parentElement || container;
            break;
          }
        } catch (e) {
          // If getBoundingClientRect fails, skip
        }
      }
    }

    // If we found an existing badge, remove any other duplicates and return it
    if (badge) {
      // Remove any other duplicate badges (keep only the first one we found)
      const allBadges = document.querySelectorAll('.iq-badge-realtime');
      let foundFirst = false;
      for (const existingBadge of allBadges) {
        if (existingBadge === badge) {
          foundFirst = true;
        } else if (foundFirst) {
          // This is a duplicate - remove it
          existingBadge.remove();
        } else {
          // This might be the badge from a different input - check distance
          try {
            const inputRect = inputElement.getBoundingClientRect();
            const badgeRect = existingBadge.getBoundingClientRect();
            const distance = Math.abs(badgeRect.top - inputRect.bottom) + Math.abs(badgeRect.left - inputRect.left);
            if (distance < 300) {
              // Too close - might be duplicate, remove it
              existingBadge.remove();
            }
          } catch (e) {
            // If comparison fails, be safe and remove potential duplicate
            if (existingBadge !== badge) {
              existingBadge.remove();
            }
          }
        }
      }

      // CRITICAL: Reapply height constraints to prevent growth
      // Use cached natural height if available, otherwise preserve existing height
      const cachedNaturalHeight = badge.getAttribute('data-natural-height');
      if (cachedNaturalHeight) {
        const heightValue = `${cachedNaturalHeight}px`;
        badge.style.setProperty('height', heightValue, 'important');
        badge.style.setProperty('max-height', heightValue, 'important');
        badge.style.setProperty('min-height', heightValue, 'important');
      } else {
        // Fallback: preserve existing height if it's a valid pixel value
        const existingHeightValue = badge.style.height;
        if (existingHeightValue && existingHeightValue !== 'auto' && existingHeightValue.endsWith('px')) {
          const heightNum = parseFloat(existingHeightValue);
          if (!isNaN(heightNum) && heightNum > 0) {
            // Preserve the existing height by setting all three properties
            badge.style.setProperty('height', existingHeightValue, 'important');
            badge.style.setProperty('max-height', existingHeightValue, 'important');
            badge.style.setProperty('min-height', existingHeightValue, 'important');
            // Also cache it
            badge.setAttribute('data-natural-height', heightNum.toString());
          }
        }
      }
      badge.style.setProperty('flex-shrink', '0', 'important');
      badge.style.setProperty('flex-grow', '0', 'important');
      badge.style.setProperty('align-self', 'flex-start', 'important');

      return badge; // Return existing badge, don't create new one
    }

    // No existing badge found - create new one
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'iq-badge iq-badge-realtime';
      badge.setAttribute('data-iq-realtime', 'true');

      // Initialize with loading state
      const darkerRed = '#b71c1c';
      const rgb = hexToRgb(darkerRed);
      const desat = desaturateColor(rgb, 0.5);
      const loadingColor = `rgb(${desat.r}, ${desat.g}, ${desat.b})`;
      badge.style.setProperty('background-color', loadingColor, 'important');
      badge.style.setProperty('color', '#000000', 'important');
      badge.style.setProperty('display', 'inline-flex', 'important');
      badge.style.setProperty('vertical-align', 'middle', 'important');
      badge.style.setProperty('margin-right', '8px', 'important');
      // CRITICAL: Fix height to prevent growth
      badge.style.setProperty('height', 'auto', 'important');
      badge.style.setProperty('max-height', 'none', 'important');
      badge.style.setProperty('flex-shrink', '0', 'important');
      badge.style.setProperty('flex-grow', '0', 'important');
      badge.style.setProperty('align-self', 'flex-start', 'important');
      badge.innerHTML = `
        <span class="iq-label">IQ</span>
        <span class="iq-score">0</span>
      `;

      // CRITICAL: Measure and cache natural height immediately after creation
      // This prevents the shrinking feedback loop
      setTimeout(() => {
        const scoreElement = badge.querySelector('.iq-score');
        const labelElement = badge.querySelector('.iq-label');
        if (scoreElement && labelElement && !badge.getAttribute('data-natural-height')) {
          // Clone without any constraints to get true natural size
          // Keep classes and CSS styling but remove inline height constraints
          const clone = badge.cloneNode(true);
          // Remove only height-related inline styles, keep other styling
          clone.style.height = '';
          clone.style.maxHeight = '';
          clone.style.minHeight = '';
          clone.style.position = 'absolute';
          clone.style.visibility = 'hidden';
          clone.style.top = '-9999px';
          clone.style.left = '-9999px';
          // Ensure box-sizing includes padding
          clone.style.boxSizing = 'border-box';
          document.body.appendChild(clone);

          // Force layout
          clone.offsetHeight;

          // Use offsetHeight which includes padding, or getBoundingClientRect
          const naturalHeight = Math.max(
            clone.getBoundingClientRect().height,
            clone.offsetHeight
          );
          document.body.removeChild(clone);

          if (naturalHeight > 0) {
            badge.setAttribute('data-natural-height', naturalHeight.toString());
            badge.style.setProperty('height', `${naturalHeight}px`, 'important');
            badge.style.setProperty('max-height', `${naturalHeight}px`, 'important');
            badge.style.setProperty('min-height', `${naturalHeight}px`, 'important');
          }
        }
      }, 100); // Small delay to ensure badge is rendered

      // Find "Everyone can reply" element or similar reply visibility text
      // Look for elements containing "Everyone", "can reply", or similar text
      const replyVisibilitySelectors = [
        '[data-testid="replyVisibilityLabel"]',
        'div[role="button"][aria-label*="can reply"]',
        '*[aria-label*="can reply"]'
      ];

      let replyVisibilityElement = null;
      // First search within container
      for (const selector of replyVisibilitySelectors) {
        replyVisibilityElement = container.querySelector(selector);
        if (replyVisibilityElement) break;
      }

      // If not found in container, search in document
      if (!replyVisibilityElement) {
        for (const selector of replyVisibilitySelectors) {
          const candidate = document.querySelector(selector);
          if (candidate) {
            if (container.contains(candidate)) {
              replyVisibilityElement = candidate;
              break;
            }
            // Check if it's near the input element (within reasonable DOM distance)
            if (inputElement) {
              try {
                const inputRect = inputElement.getBoundingClientRect();
                const replyRect = candidate.getBoundingClientRect();
                const distance = Math.abs(replyRect.top - inputRect.bottom);
                if (distance < 200) { // Within 200px vertically
                  replyVisibilityElement = candidate;
                  break;
                }
              } catch (e) {
                // If getBoundingClientRect fails, skip this candidate
              }
            }
          }
        }
      }

      // Fallback: search for text containing "Everyone can reply" or "can reply"
      // Search in container first, then nearby elements
      if (!replyVisibilityElement) {
        // Search container
        const containerElements = container.querySelectorAll('*');
        for (const el of containerElements) {
          const text = el.textContent || '';
          if (text.includes('can reply') || (text.includes('Everyone') && text.includes('reply'))) {
            replyVisibilityElement = el;
            break;
          }
        }

        // If still not found, search nearby elements (siblings and parents)
        if (!replyVisibilityElement && container.parentElement) {
          const nearbyElements = container.parentElement.querySelectorAll('*');
          for (const el of nearbyElements) {
            const text = el.textContent || '';
            if ((text.includes('can reply') || (text.includes('Everyone') && text.includes('reply'))) &&
                el !== badge) {
              replyVisibilityElement = el;
              break;
            }
          }
        }
      }

      // PRIORITY 1: Look for toolbar with comment buttons (image, GIF, poll, emoji, location icons)
      // This is the row of buttons at the bottom of comment boxes
      // CRITICAL: Only use toolbars that are near the input element, not the original post
      const toolbarSelectors = [
        '[data-testid="toolBar"]',
        'div[role="toolbar"]',
        'div[data-testid*="toolbar"]',
        // Look for containers with multiple button icons (image, GIF, etc.)
        'div[role="group"]'
      ];

      let toolbarElement = null;
      let firstButtonInToolbar = null;
      const inputRect = inputElement ? inputElement.getBoundingClientRect() : null;

      for (const selector of toolbarSelectors) {
        const toolbars = container.querySelectorAll(selector);
        // Check all toolbars and find the one closest to the input
        for (const toolbar of toolbars) {
          // Verify this toolbar is near the input, not near original post
          if (inputRect) {
            try {
              const toolbarRect = toolbar.getBoundingClientRect();
              const distance = Math.abs(toolbarRect.top - inputRect.bottom);
              // If toolbar is too far from input (more than 200px), skip it
              // This prevents using the original post's toolbar
              if (distance > 200) {
                continue;
              }

              // Also check if this toolbar contains the original post's engagement bar
              const originalPostArticles = document.querySelectorAll('article[data-testid="tweet"]');
              let isOriginalPostToolbar = false;
              for (const article of originalPostArticles) {
                const engagementBar = article.querySelector('[role="group"]');
                if (engagementBar && toolbar.contains(engagementBar)) {
                  // This is the original post's engagement bar, skip it
                  isOriginalPostToolbar = true;
                  break;
                }
              }
              if (isOriginalPostToolbar) {
                continue;
              }
            } catch (e) {
              // If comparison fails, skip this toolbar
              continue;
            }
          }

          // Check if this toolbar has buttons (image, GIF icons, etc.)
          // Look for buttons with aria-label containing image, gif, poll, emoji, location
          const buttons = toolbar.querySelectorAll('button, div[role="button"]');
          if (buttons.length > 0) {
            // Check if buttons have relevant labels/icons
            let hasRelevantButtons = false;
            for (const btn of buttons) {
              const label = (btn.getAttribute('aria-label') || '').toLowerCase();
              const testId = (btn.getAttribute('data-testid') || '').toLowerCase();
              if (label.includes('image') || label.includes('photo') ||
                  label.includes('gif') || label.includes('poll') ||
                  label.includes('emoji') || label.includes('location') ||
                  testId.includes('image') || testId.includes('gif') ||
                  testId.includes('poll') || testId.includes('emoji')) {
                hasRelevantButtons = true;
                if (!firstButtonInToolbar) {
                  firstButtonInToolbar = btn;
                  toolbarElement = toolbar;
                }
                break;
              }
            }

            // If we found relevant buttons, use this toolbar
            if (hasRelevantButtons && firstButtonInToolbar) {
              break;
            }
          }

          // If toolbar has buttons but we didn't check labels, use first button anyway
          if (buttons.length > 0 && !firstButtonInToolbar) {
            firstButtonInToolbar = buttons[0];
            toolbarElement = toolbar;
          }
        }

        if (toolbarElement && firstButtonInToolbar) {
          break;
        }
      }

      // If we found the toolbar with buttons, place badge before the first button
      if (toolbarElement && firstButtonInToolbar && firstButtonInToolbar.parentElement) {
        firstButtonInToolbar.parentElement.insertBefore(badge, firstButtonInToolbar);
      } else if (replyVisibilityElement && replyVisibilityElement.parentElement) {
        // PRIORITY 2: Insert before reply visibility element
        replyVisibilityElement.parentElement.insertBefore(badge, replyVisibilityElement);
      } else if (toolbarElement) {
        // PRIORITY 3: Insert at start of toolbar
        const firstChild = toolbarElement.firstElementChild;
        if (firstChild) {
          toolbarElement.insertBefore(badge, firstChild);
        } else {
          toolbarElement.appendChild(badge);
        }
      } else {
        // Fallback: look for common compose box footer structure
        const footerSelectors = [
          'div[role="group"]',
          '.css-1dbjc4n[style*="flex"]'
        ];

        let footerElement = null;
        for (const selector of footerSelectors) {
          footerElement = container.querySelector(selector);
          if (footerElement && footerElement !== badge.parentElement) {
            const firstChild = footerElement.firstElementChild;
            if (firstChild) {
              footerElement.insertBefore(badge, firstChild);
              break;
            } else {
              footerElement.appendChild(badge);
              break;
            }
          }
        }

        // Last resort: append to container but position it better
        if (!badge.parentElement) {
          container.appendChild(badge);
          badge.style.setProperty('position', 'relative', 'important');
          badge.style.setProperty('float', 'left', 'important');
          badge.style.setProperty('margin-bottom', '8px', 'important');
        }
      }
    }

    return badge;
  }

  /**
   * Animate real-time badge update (count-up from current to new IQ)
   */
  function animateRealtimeBadgeUpdate(badge, oldIQ, newIQ, iqColor) {
    // Cancel any existing animation
    if (badge._animationFrameId) {
      cancelAnimationFrame(badge._animationFrameId);
      badge._animationFrameId = null;
    }

    // Reset animation state to allow new animation
    badge.removeAttribute('data-iq-animating');
    badge.removeAttribute('data-iq-animated');

    // Get loading color (darker red)
    const darkerRed = '#b71c1c';
    const rgb = hexToRgb(darkerRed);
    const desat = desaturateColor(rgb, 0.5);
    const loadingColor = `rgb(${desat.r}, ${desat.g}, ${desat.b})`;

    // Find score element - could be in flip structure (front) or direct
    let scoreElement = badge.querySelector('.iq-badge-front .iq-score') ||
                       badge.querySelector('.iq-score');
    if (!scoreElement) {
      debugLog('[Real-time Badge Animation] ERROR: Could not find score element!', {
        hasFlip: badge.classList.contains('iq-badge-flip'),
        hasInner: !!badge.querySelector('.iq-badge-inner'),
        badgeHTML: badge.innerHTML.substring(0, 200)
      });
      return;
    }

    // CRITICAL: Always reset score element to starting value BEFORE animation
    // Determine starting IQ - if oldIQ is -1, we start from 0 (first calculation)
    // If oldIQ >= 0, we start from that (updating from previous score)
    const startIQ = oldIQ >= 0 ? oldIQ : 0;

    // IMPORTANT: Set score element to startIQ immediately, before animation starts
    // This ensures the animation always starts from the correct value
    scoreElement.textContent = String(startIQ);

    // Determine starting color
    // If oldIQ is -1 (no previous score), start from loading color
    // Otherwise, start from current background color (or loading color if none)
    let startColorRgb;
    if (oldIQ < 0) {
      // First update - start from loading color and reset badge color
      startColorRgb = parseColor(loadingColor);
      badge.style.setProperty('background-color', loadingColor, 'important');
    } else {
      // Subsequent update - start from current background color
      const currentBgColor = badge.style.backgroundColor || loadingColor;
      startColorRgb = parseColor(currentBgColor);
    }

    const finalColorRgb = parseColor(iqColor);

    // Initialize current IQ for animation
    let currentIQ = startIQ;

    // Mark as animating (prevents duplicate animations)
    badge.setAttribute('data-iq-animating', 'true');

    const duration = 800; // Slightly faster for real-time updates
    const startTime = performance.now();
    let lastDisplayedIQ = startIQ;

    function updateNumber() {
      const now = performance.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-out cubic function
      const easedProgress = 1 - Math.pow(1 - progress, 3);

      // Calculate target IQ
      const iqDiff = newIQ - startIQ;
      const targetIQ = startIQ + Math.floor(easedProgress * iqDiff);

      // Smooth increment to avoid jumps
      const maxIncrement = Math.max(1, Math.ceil(Math.abs(iqDiff) / 30));

      if (progress >= 1) {
        currentIQ = newIQ;
      } else {
        const difference = targetIQ - currentIQ;
        if (Math.abs(difference) > maxIncrement) {
          currentIQ += difference > 0 ? maxIncrement : -maxIncrement;
        } else {
          currentIQ = targetIQ;
        }
      }

      // Clamp IQ
      if ((iqDiff > 0 && currentIQ > newIQ) || (iqDiff < 0 && currentIQ < newIQ)) {
        currentIQ = newIQ;
      }

      // Always update color based on progress (smooth color transition)
      const currentColor = interpolateRgbColor(
        startColorRgb,
        finalColorRgb,
        easedProgress
      );
      badge.style.setProperty('background-color', currentColor, 'important');

      // Update number display if it changed
      // CRITICAL: Re-find score element in case structure changed (flip added/removed)
      let currentScoreElement = badge.querySelector('.iq-badge-front .iq-score') ||
                                 badge.querySelector('.iq-score');

      if (currentIQ !== lastDisplayedIQ) {
        if (currentScoreElement) {
          currentScoreElement.textContent = Math.max(0, Math.round(currentIQ));
          lastDisplayedIQ = currentIQ;
          // Update the reference in case element changed
          scoreElement = currentScoreElement;
        } else {
          debugLog('[Real-time Badge Animation] WARNING: Score element lost during animation!');
          // Try to find it again
          scoreElement = badge.querySelector('.iq-badge-front .iq-score') ||
                         badge.querySelector('.iq-score');
          if (scoreElement) {
            scoreElement.textContent = Math.max(0, Math.round(currentIQ));
            lastDisplayedIQ = currentIQ;
          }
        }
      }

      // Continue or finish
      if (progress < 1 || lastDisplayedIQ !== newIQ) {
        // Continue animation if not complete OR if we haven't reached final IQ
        badge._animationFrameId = requestAnimationFrame(updateNumber);
      } else {
        // Animation complete - ensure final values are set
        // CRITICAL: Re-find score element in case structure changed
        const finalScoreElement = badge.querySelector('.iq-badge-front .iq-score') ||
                                  badge.querySelector('.iq-score');
        if (finalScoreElement) {
          finalScoreElement.textContent = newIQ;
        } else {
          debugLog('[Real-time Badge Animation] ERROR: Could not find score element for final update!');
          // Fallback: try direct query again
          const fallbackScore = badge.querySelector('.iq-score');
          if (fallbackScore) {
            fallbackScore.textContent = newIQ;
          }
        }

        badge.style.setProperty('background-color', iqColor, 'important');
        badge.removeAttribute('data-iq-animating');
        badge.setAttribute('data-iq-animated', 'true');

        // Clean up animation frame reference
        badge._animationFrameId = null;

        // Small pulse animation
        setTimeout(() => {
          triggerPulseAnimation(badge, iqColor);
        }, 100);
      }
    }

    // Start animation immediately (force first frame)
    // Use a small timeout to ensure the badge is ready and visible
    requestAnimationFrame(() => {
      updateNumber();
    });
  }

  /**
   * Update real-time badge with new IQ score
   */
  async function updateRealtimeBadge(inputElement, badge, container) {
    // CRITICAL: Always reapply height constraints to prevent badge from growing
    // Don't set to 'auto' - keep the existing fixed height if it exists
    const existingHeight = badge.style.height;
    if (!existingHeight || existingHeight === 'auto') {
      badge.style.setProperty('height', 'auto', 'important');
    }
    // max-height will be set after natural height measurement
    badge.style.setProperty('flex-shrink', '0', 'important');
    badge.style.setProperty('flex-grow', '0', 'important');
    badge.style.setProperty('align-self', 'flex-start', 'important');
    badge.style.setProperty('line-height', '1', 'important');
    badge.style.setProperty('overflow', 'visible', 'important');

    // Force specific height calculation - use natural content height
    // IMPORTANT: Only measure if we don't have a cached natural height
    // This prevents the shrinking feedback loop
    const scoreElement = badge.querySelector('.iq-score');
    const labelElement = badge.querySelector('.iq-label');

    // Check if badge has a cached natural height (set during creation)
    let naturalHeight = badge.getAttribute('data-natural-height');
    if (naturalHeight) {
      naturalHeight = parseFloat(naturalHeight);
    } else {
      // Only measure if we don't have a cached value
      if (scoreElement && labelElement) {
        // Measure natural height by cloning badge in isolation (removes flex container influence)
        // IMPORTANT: Reset all constraints on clone to get true natural size
        const clone = badge.cloneNode(true);
        clone.style.position = 'absolute';
        clone.style.visibility = 'hidden';
        clone.style.height = '';
        clone.style.maxHeight = '';
        clone.style.minHeight = '';
        clone.style.width = 'auto';
        clone.style.top = '-9999px';
        clone.style.left = '-9999px';
        clone.style.flexGrow = '';
        clone.style.flexShrink = '';
        clone.style.alignSelf = '';
        // Remove only height constraints, keep other styling for accurate measurement
        clone.style.height = '';
        clone.style.maxHeight = '';
        clone.style.minHeight = '';
        clone.style.position = 'absolute';
        clone.style.visibility = 'hidden';
        clone.style.top = '-9999px';
        clone.style.left = '-9999px';
        // Ensure box-sizing includes padding
        clone.style.boxSizing = 'border-box';

        document.body.appendChild(clone);

        // Force layout recalculation
        clone.offsetHeight;

        // Use offsetHeight which includes padding and borders
        naturalHeight = Math.max(
          clone.getBoundingClientRect().height,
          clone.offsetHeight
        );
        document.body.removeChild(clone);

        // Cache the natural height on the badge
        if (naturalHeight > 0) {
          badge.setAttribute('data-natural-height', naturalHeight.toString());
        }
      }
    }

    // Apply the height (use cached value if available)
    if (naturalHeight && naturalHeight > 0) {
      // CRITICAL: Set both height AND max-height to prevent parent flex from stretching
      badge.style.setProperty('height', `${naturalHeight}px`, 'important');
      badge.style.setProperty('max-height', `${naturalHeight}px`, 'important');
      badge.style.setProperty('min-height', `${naturalHeight}px`, 'important');
    } else {
      // Fallback: use a reasonable default based on content (shouldn't happen after first measurement)
      const estimatedHeight = 24; // Approximate height for label + score
      badge.style.setProperty('height', `${estimatedHeight}px`, 'important');
      badge.style.setProperty('max-height', `${estimatedHeight}px`, 'important');
      badge.style.setProperty('min-height', `${estimatedHeight}px`, 'important');
      badge.setAttribute('data-natural-height', estimatedHeight.toString());
    }

    // If height still doesn't match, force it one more time with requestAnimationFrame
    if (badge.style.height && badge.style.height !== 'auto') {
      const afterRect = badge.getBoundingClientRect();
      const expectedHeight = parseFloat(badge.style.height);
      if (Math.abs(afterRect.height - expectedHeight) > 1) {
        requestAnimationFrame(() => {
          badge.style.setProperty('height', badge.style.height, 'important');
          badge.style.setProperty('max-height', badge.style.maxHeight || badge.style.height, 'important');
          badge.style.setProperty('min-height', badge.style.minHeight || badge.style.height, 'important');
        });
      }
    }

    const text = getInputText(inputElement).trim();

    // If text is too short or empty, show loading state
    if (!text || text.length < 10) {
      const darkerRed = '#b71c1c';
      const rgb = hexToRgb(darkerRed);
      const desat = desaturateColor(rgb, 0.5);
      const loadingColor = `rgb(${desat.r}, ${desat.g}, ${desat.b})`;
      badge.style.setProperty('background-color', loadingColor, 'important');
      const scoreElement = badge.querySelector('.iq-score');
      if (scoreElement) {
        scoreElement.textContent = '0';
      }
      badge.removeAttribute('data-iq-score');
      return;
    }

    // Validate text
    const validation = validateTweetText(text);
    if (!validation.isValid) {
      // Show invalid state (gray)
      badge.style.setProperty('background-color', '#9e9e9e', 'important');

      // Find score element - could be in flip structure or direct
      let scoreElement = badge.querySelector('.iq-badge-front .iq-score') ||
                         badge.querySelector('.iq-score');
      if (scoreElement) {
        scoreElement.textContent = '✕';
      }

      // CRITICAL: Ensure consistent padding/margin when showing invalid state
      badge.style.setProperty('padding-top', '3px', 'important');
      badge.style.setProperty('padding-bottom', '3px', 'important');
      badge.style.setProperty('margin-top', '0', 'important');
      badge.style.setProperty('margin-bottom', '0', 'important');

      // Reset flip structure positioning if exists
      const inner = badge.querySelector('.iq-badge-inner');
      if (inner) {
        inner.style.margin = '0';
        inner.style.padding = '0';
      }
      const front = badge.querySelector('.iq-badge-front');
      if (front) {
        front.style.margin = '0';
        front.style.padding = '0';
        front.style.top = '0';
      }

      badge.removeAttribute('data-iq-score');
      // Cancel any ongoing animation
      if (badge._animationFrameId) {
        cancelAnimationFrame(badge._animationFrameId);
        badge._animationFrameId = null;
      }
      badge.removeAttribute('data-iq-animating');
      badge.removeAttribute('data-iq-animated');
      return;
    }

    try {
      // Calculate IQ
      const result = await iqEstimator.estimate(text);

      if (result.is_valid && result.iq_estimate !== null) {
        const newIQ = Math.round(result.iq_estimate);

        // IMPORTANT: Read oldIQ BEFORE setting new data attribute
        // We want to determine if there was a previous valid score to animate from
        // CRITICAL: Check both flip structure and direct structure
        let scoreElement = badge.querySelector('.iq-badge-front .iq-score') ||
                           badge.querySelector('.iq-score');
        let oldIQ = -1;

        // CRITICAL: Check if badge currently shows "✕" (invalid state)
        // If so, we're transitioning from invalid to valid - reset to start from 0
        const isTransitioningFromInvalid = scoreElement && scoreElement.textContent.trim() === '✕';

        if (isTransitioningFromInvalid) {
          // Transitioning from invalid to valid - start fresh from 0
          oldIQ = -1;
          // Clear the X and reset to 0 before animation
          scoreElement.textContent = '0';
          // Also clear any stale data attributes
          badge.removeAttribute('data-iq-score');
        } else {
          // Not transitioning from invalid - check for previous valid score
          // First check data attribute (most reliable)
          if (badge.hasAttribute('data-iq-score')) {
            const dataScore = parseInt(badge.getAttribute('data-iq-score'), 10);
            if (!isNaN(dataScore) && dataScore > 0) {
              oldIQ = dataScore;
            }
          }

          // Also check displayed score as secondary source
          // Only use it if it's different from 0 and ✕ (which indicate loading/invalid states)
          if (oldIQ < 0 && scoreElement && scoreElement.textContent) {
            const displayedText = scoreElement.textContent.trim();
            if (displayedText !== '0' && displayedText !== '✕' && displayedText.length > 0) {
              const displayedScore = parseInt(displayedText, 10);
              if (!isNaN(displayedScore) && displayedScore > 0) {
                oldIQ = displayedScore;
              }
            }
          }
        }

        // If oldIQ is still -1 or 0, treat as first calculation (animate from 0)
        // Note: oldIQ of 0 specifically means "animate from 0", while -1 also means that
        // We'll use -1 to indicate "no previous score" for color purposes
        if (oldIQ <= 0) {
          oldIQ = -1; // Will trigger animation from 0 with loading color
        }

        const iqColor = getIQColor(newIQ);

        // Store confidence if available (before animation, but animation will handle display)
        const confidence = result.confidence ? Math.round(result.confidence) : null;
        if (confidence !== null) {
          badge.setAttribute('data-confidence', confidence);
        }

        // Set data attribute before animation
        badge.setAttribute('data-iq-score', newIQ);

        // Update flip structure BEFORE animation if confidence available
        // This ensures the score element is in the right place when animation starts
        if (confidence !== null) {
          updateBadgeWithFlipStructure(badge, newIQ, confidence);

          // CRITICAL: Ensure flip inner is reset to show front (IQ), not back (confidence)
          const inner = badge.querySelector('.iq-badge-inner');
          if (inner) {
            // Remove inline transform to allow CSS hover to work properly
            inner.style.removeProperty('transform');
            inner.style.setProperty('transform-style', 'preserve-3d', 'important');
            // Ensure no padding/margin that causes vertical shift
            inner.style.margin = '0';
            inner.style.padding = '0';
          }

          // Ensure front and back have consistent styling
          const front = badge.querySelector('.iq-badge-front');
          const back = badge.querySelector('.iq-badge-back');
          if (front) {
            front.style.margin = '0';
            front.style.padding = '0';
            front.style.top = '0';
          }
          if (back) {
            back.style.margin = '0';
            back.style.padding = '0';
            back.style.top = '0';
          }
        }

        // Animate update (from oldIQ to newIQ)
        // Animation will update the score element - structure should already be set above
        animateRealtimeBadgeUpdate(badge, oldIQ, newIQ, iqColor);
      } else {
        // Invalid result - show loading state
        const darkerRed = '#b71c1c';
        const rgb = hexToRgb(darkerRed);
        const desat = desaturateColor(rgb, 0.5);
        const loadingColor = `rgb(${desat.r}, ${desat.g}, ${desat.b})`;
        badge.style.setProperty('background-color', loadingColor, 'important');
        const scoreElement = badge.querySelector('.iq-score');
        if (scoreElement) {
          scoreElement.textContent = '0';
        }
      }
    } catch (error) {
      console.error('Error updating real-time IQ badge:', error);
    }
  }

  /**
   * Setup real-time monitoring for an input element
   */
  function setupRealtimeMonitoring(inputElement) {
    // If already monitoring, ensure badge is attached to this input (not a stale one)
    if (inputElement.hasAttribute('data-iq-realtime-monitored')) {
      // Find existing badge and verify it's still in the correct container
      const existingBadges = document.querySelectorAll('.iq-badge-realtime');
      for (const badge of existingBadges) {
        const badgeInput = badge.closest('[data-testid="toolBar"]')?._iqInputElement ||
                          badge.closest('div[role="textbox"]')?.parentElement?.parentElement?._iqInputElement;
        // If this badge is associated with a different input in the same container,
        // we might need to reassign it
        if (badgeInput && badgeInput !== inputElement) {
          const container = inputElement.closest('[data-testid="toolBar"]') ||
                           inputElement.closest('div[role="textbox"]')?.parentElement?.parentElement;
          if (container && badge.parentElement === container) {
            // Badge is in the right container but attached to wrong input - reassign
            container._iqInputElement = inputElement;
          }
        }
      }
      return; // Already monitoring
    }

    inputElement.setAttribute('data-iq-realtime-monitored', 'true');

    // Add focus handler to ensure badge follows the focused input
    inputElement.addEventListener('focus', () => {
      // Check if this input is in a modal/dialog
      const parentModal = inputElement.closest('[role="dialog"], [data-testid*="modal"], [data-testid*="Dialog"]');
      const isInModal = !!parentModal;

      // Find container for this input - prefer modal containers
      let container = inputElement.closest('[data-testid="toolBar"]') ||
                     inputElement.closest('div[role="textbox"]')?.parentElement?.parentElement ||
                     inputElement.closest('[data-testid="tweetButton"]')?.parentElement?.parentElement;

      // If in a modal, try to find the modal's toolbar/container
      if (isInModal && parentModal) {
        const modalToolbar = parentModal.querySelector('[data-testid="toolBar"]');
        if (modalToolbar) {
          container = modalToolbar;
        } else {
          // Fallback: use a container within the modal
          const modalContainer = parentModal.querySelector('div[role="group"], div[style*="flex"]');
          if (modalContainer) {
            container = modalContainer;
          }
        }
      }

      if (container) {
        // First, hide badges in other containers (especially non-modal when modal is active)
        const allBadges = document.querySelectorAll('.iq-badge-realtime');
        allBadges.forEach(badge => {
          const badgeContainer = badge.closest('[data-testid="toolBar"]') ||
                               badge.closest('div[role="textbox"]')?.parentElement?.parentElement ||
                               badge.closest('[data-testid="tweetButton"]')?.parentElement?.parentElement;
          const badgeModal = badge.closest('[role="dialog"], [data-testid*="modal"], [data-testid*="Dialog"]');

          // Hide badge if:
          // 1. It's in a different container and that container's input is not focused
          // 2. This input is in a modal but badge is NOT in a modal (hide inline badges when modal opens)
          // 3. Badge is in a different modal
          if (badgeContainer && badgeContainer !== container) {
            const badgeInput = badgeContainer._iqInputElement;
            const badgeInputFocused = badgeInput && (document.activeElement === badgeInput || badgeInput.contains(document.activeElement));

            if (!badgeInputFocused) {
              if (isInModal && !badgeModal) {
                // Hide inline badges when modal compose is active
                badge.style.setProperty('display', 'none', 'important');
              } else if (badgeModal && badgeModal !== parentModal) {
                // Hide badges from other modals
                badge.style.setProperty('display', 'none', 'important');
              } else if (!isInModal && badgeModal) {
                // This shouldn't happen often, but hide modal badges when inline is focused
                // Actually, don't hide - keep both visible unless conflicting
              } else {
                // Different non-modal containers - hide if not focused
                badge.style.setProperty('display', 'none', 'important');
              }
            }
          }
        });

        // Show and ensure badge is attached to this input
        const existingBadge = container.querySelector('.iq-badge-realtime');
        if (existingBadge) {
          // Reassign badge to this input and make sure it's visible
          container._iqInputElement = inputElement;
          existingBadge.style.removeProperty('display'); // Show if it was hidden
          // Update badge to reflect current text in this input
          const badge = existingBadge;
          updateRealtimeBadge(inputElement, badge, container);
        } else {
          // No badge in this container, create one
          createRealtimeBadge(inputElement, container);
        }
      } else {
        // No container found - try to create badge anyway
        // This handles edge cases where container detection fails
        const fallbackContainer = inputElement.parentElement?.parentElement || inputElement.parentElement;
        if (fallbackContainer) {
          createRealtimeBadge(inputElement, fallbackContainer);
        }
      }
    }, { capture: true });

    // Find container for badge - look for compose box wrapper that contains reply settings
    // CRITICAL: Must be specific to THIS input element to avoid placing badge near original post
    // First check if we're in a modal/dialog - prioritize modal containers
    const parentModalForContainer = inputElement.closest('[role="dialog"], [data-testid*="modal"], [data-testid*="Dialog"]');
    let container = null;

    // Strategy: Find the closest container that's specific to THIS input, not the original post
    // Look for containers that are parents of the input but NOT parents of tweet articles

    // Check if this is a reply input (not original post compose)
    const isReplyInput = inputElement.closest('div[data-testid*="cellInnerDiv"]')?.querySelector('article[data-testid="tweet"]') ||
                        inputElement.closest('[aria-label*="Replying to"]') ||
                        window.location.pathname.includes('/status/');

    if (parentModalForContainer) {
      // In a modal - look for toolbar in modal first, but only within the modal
      container = parentModalForContainer.querySelector('[data-testid="toolBar"]') ||
                  parentModalForContainer.querySelector('div[role="group"]');

      // If not found, find container specifically near this input within modal
      if (!container) {
        let parent = inputElement.parentElement;
        for (let i = 0; i < 5 && parent && parent !== parentModalForContainer; i++) {
          // Check if this parent contains the input but not a tweet article (avoid original post)
          if (parent.contains(inputElement) && !parent.querySelector('article[data-testid="tweet"]')) {
            const hasToolbar = parent.querySelector('[data-testid="toolBar"]');
            if (hasToolbar) {
              container = parent;
              break;
            }
          }
          parent = parent.parentElement;
        }
      }
    }

    // For reply inputs (not modals), be very specific - find container that contains THIS input
    // but is NOT in the original tweet's engagement area
    if (!container && isReplyInput) {
      // Walk up from input element and find the FIRST container that:
      // 1. Contains this input
      // 2. Has a toolbar or tweet button
      // 3. Does NOT contain an article with the original post's structure
      let current = inputElement.parentElement;
      const originalTweetArticles = document.querySelectorAll('article[data-testid="tweet"]');

      for (let i = 0; i < 8 && current; i++) {
        // Check if this level has a toolbar
        const toolbar = current.querySelector('[data-testid="toolBar"]');
        if (toolbar && toolbar.contains(inputElement)) {
          // Verify this container is NOT the original post's container
          // by checking if it's far from original tweet articles
          let isOriginalPostContainer = false;
          for (const article of originalTweetArticles) {
            const engagementBar = article.querySelector('[role="group"]');
            if (engagementBar && current.contains(engagementBar)) {
              isOriginalPostContainer = true;
              break;
            }
          }
          if (!isOriginalPostContainer) {
            container = toolbar.parentElement || toolbar;
            break;
          }
        }
        current = current.parentElement;
      }
    }

    // Fallback to standard container detection, but still be careful
    if (!container) {
      // Try finding toolbar closest to this specific input
      const toolbars = Array.from(document.querySelectorAll('[data-testid="toolBar"]'));
      for (const toolbar of toolbars) {
        if (toolbar.contains(inputElement)) {
          // Verify it's not the original post's toolbar
          const article = toolbar.closest('article[data-testid="tweet"]');
          if (article) {
            const engagementBar = article.querySelector('[role="group"]');
            if (engagementBar && toolbar !== engagementBar) {
              // This toolbar is not the engagement bar, so it's likely a compose toolbar
              container = toolbar;
              break;
            }
          } else {
            // No article parent means it's likely a standalone compose box
            container = toolbar;
            break;
          }
        }
      }

      // Last resort: use parent hierarchy
      if (!container) {
        container = inputElement.closest('div[role="textbox"]')?.parentElement?.parentElement ||
                    inputElement.closest('[data-testid="tweetButton"]')?.parentElement?.parentElement ||
                    inputElement.closest('div[style*="flex"]')?.parentElement ||
                    inputElement.parentElement?.parentElement ||
                    inputElement.parentElement;
      }
    }

    // Try to find a container that actually has reply visibility text nearby
    let current = inputElement.parentElement;
    let bestContainer = container;
    for (let i = 0; i < 5 && current; i++) {
      const hasReplyText = Array.from(current.querySelectorAll('*')).some(el => {
        const text = el.textContent || '';
        return text.includes('can reply') || (text.includes('Everyone') && text.includes('reply'));
      });
      if (hasReplyText) {
        bestContainer = current;
        break;
      }
      current = current.parentElement;
    }

    container = bestContainer || container;

    if (!container) {
      container = inputElement.parentElement;
    }

    // Create badge
    const badge = createRealtimeBadge(inputElement, container);

    // Monitor badge height changes to prevent growth/shrinking
    let initialHeight = badge.getBoundingClientRect().height;
    let lastLoggedHeight = initialHeight;

    const heightObserver = new MutationObserver(() => {
      const currentHeight = badge.getBoundingClientRect().height;
      if (Math.abs(currentHeight - lastLoggedHeight) > 1) { // More than 1px change
        // Auto-fix if height grew unexpectedly (more than 3px from initial)
        // OR if height shrunk significantly (more than 2px below initial - indicates measurement error)
        if (currentHeight > initialHeight + 3 || currentHeight < initialHeight - 2) {
          // Use cached natural height if available, otherwise use initial height
          const cachedNaturalHeight = badge.getAttribute('data-natural-height');
          let targetHeight;

          if (cachedNaturalHeight) {
            targetHeight = parseFloat(cachedNaturalHeight);
          } else {
            targetHeight = initialHeight;
          }

          // Only fix if current height is significantly different from target
          if (Math.abs(currentHeight - targetHeight) > 2) {
            // CRITICAL: Set height, max-height, and min-height to prevent stretching/shrinking
            badge.style.setProperty('height', `${targetHeight}px`, 'important');
            badge.style.setProperty('max-height', `${targetHeight}px`, 'important');
            badge.style.setProperty('min-height', `${targetHeight}px`, 'important');
          }
        }

        lastLoggedHeight = badge.getBoundingClientRect().height; // Update after potential fix
      }
    });

    // Observe badge and parent for changes
    heightObserver.observe(badge, {
      attributes: true,
      attributeFilter: ['style', 'class'],
      childList: false,
      subtree: false
    });

    if (badge.parentElement) {
      heightObserver.observe(badge.parentElement, {
        attributes: true,
        attributeFilter: ['style', 'class'],
        childList: true,
        subtree: false
      });
    }

    // Store manager reference
    const manager = {
      inputElement,
      badge,
      container,
      lastUpdateTime: 0,
      updateTimeout: null,
      lastIQ: -1,
      heightObserver
    };

    realtimeBadgeManagers.set(inputElement, manager);

    // Debounced update function (300ms delay)
    const debouncedUpdate = () => {
      if (manager.updateTimeout) {
        clearTimeout(manager.updateTimeout);
      }

      manager.updateTimeout = setTimeout(async () => {
        await updateRealtimeBadge(inputElement, badge, container);
      }, 300);
    };

    // Monitor input events
    const eventTypes = ['input', 'keyup', 'paste', 'cut'];
    eventTypes.forEach(eventType => {
      inputElement.addEventListener(eventType, debouncedUpdate, { passive: true });
    });

    // Initial update after a short delay
    setTimeout(() => {
      updateRealtimeBadge(inputElement, badge, container);
    }, 500);
  }

  /**
   * Monitor for new compose boxes (posts/comments) and setup real-time IQ tracking
   */
  function setupRealtimeComposeObserver() {
    const observer = new MutationObserver(() => {
      if (!settings.showIQBadge) return;

      const inputs = findTextInputs();
      // Prioritize focused or modal inputs - process them first
      const prioritized = inputs.filter(input => {
        const isFocused = document.activeElement === input || input.contains(document.activeElement);
        // Check if in modal (high z-index parent or role="dialog")
        let parent = input.parentElement;
        for (let i = 0; i < 10 && parent; i++) {
          const style = window.getComputedStyle(parent);
          if (parseInt(style.zIndex) > 1000 || parent.getAttribute('role') === 'dialog') {
            return true;
          }
          parent = parent.parentElement;
        }
        return isFocused;
      });
      const others = inputs.filter(input => !prioritized.includes(input));

      // Process prioritized first (focused/modal), then others
      [...prioritized, ...others].forEach(input => {
        setupRealtimeMonitoring(input);
      });
    });

    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also check existing inputs immediately
    setTimeout(() => {
      const inputs = findTextInputs();
      // Prioritize focused or modal inputs
      const prioritized = inputs.filter(input => {
        const isFocused = document.activeElement === input || input.contains(document.activeElement);
        let parent = input.parentElement;
        for (let i = 0; i < 10 && parent; i++) {
          const style = window.getComputedStyle(parent);
          if (parseInt(style.zIndex) > 1000 || parent.getAttribute('role') === 'dialog') {
            return true;
          }
          parent = parent.parentElement;
        }
        return isFocused;
      });
      const others = inputs.filter(input => !prioritized.includes(input));

      [...prioritized, ...others].forEach(input => {
        setupRealtimeMonitoring(input);
      });
    }, 1000);

    // Also listen for focus events on the document to catch when user switches between inputs
    document.addEventListener('focusin', (e) => {
      if (!settings.showIQBadge) return;
      const target = e.target;
      // Check if it's a text input we care about - use broader detection
      const isTextarea = target.tagName === 'TEXTAREA' && (
        target.getAttribute('data-testid')?.includes('tweetTextarea') ||
        target.closest('[data-testid="toolBar"]') ||
        target.closest('[data-testid*="tweetButton"]')
      );
      const isContentEditable = (target.getAttribute('role') === 'textbox' || target.tagName === 'DIV') &&
                                target.getAttribute('contenteditable') === 'true';

      if (isTextarea || isContentEditable) {
        // Use the same compose box detection logic as findTextInputs
        const hasComposeIndicators = target.closest('[data-testid="toolBar"]') ||
                                    target.closest('[data-testid*="tweetButton"]') ||
                                    target.getAttribute('data-testid')?.includes('tweetTextarea') ||
                                    target.getAttribute('data-testid')?.includes('tweet');
        const isComposePage = window.location.pathname.includes('/compose/') ||
                             window.location.href.includes('/compose/post');

        if (hasComposeIndicators || isComposePage) {
          setupRealtimeMonitoring(target);
        }
      }
    }, true);

    // Listen for URL changes (for SPA navigation to compose pages)
    let lastUrl = window.location.href;
    const urlCheckInterval = setInterval(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        // URL changed - check for compose boxes (might have navigated to compose page)
        if (currentUrl.includes('/compose/')) {
          setTimeout(() => {
            const inputs = findTextInputs();
            inputs.forEach(input => {
              setupRealtimeMonitoring(input);
            });
          }, 500);
        }
      }
    }, 1000);

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      clearInterval(urlCheckInterval);
    });

    return observer;
  }

  /**
   * Initialize the extension
   */
  function init() {
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

  // Start the extension
  init();
})();



