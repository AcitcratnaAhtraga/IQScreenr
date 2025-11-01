/**
 * Content Script - Analyzes tweets and injects IQ badges
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

  // Load settings from storage
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

        // Store baseline text length before expansion
        const baselineText = extractTweetText(tweetElement);
        const baselineLength = baselineText ? baselineText.length : 0;

        // Get the text container
        const textContainer = tweetElement.querySelector('[data-testid="tweetText"]');
        if (!textContainer) {
          resolve(null);
          return;
        }

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
        setTimeout(() => {
          if (!expansionDetected) {
            observer.disconnect();
            const currentText = extractTweetText(tweetElement);
            if (currentText && currentText.length > baselineLength + 50) {
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
    const mainTweetContainer = tweetElement.querySelector('[data-testid="tweet"]') ||
                                (tweetElement.getAttribute('data-testid') === 'tweet' ? tweetElement : null) ||
                                tweetElement;

    // Find ALL tweetText elements in this article (main tweet + any quoted tweets)
    const allTweetTextElements = Array.from(tweetElement.querySelectorAll('[data-testid="tweetText"]'));

    if (allTweetTextElements.length === 0) {
      return null;
    }

    // If there's only one, use it (but verify it's not a quoted tweet)
    // On single tweet pages, be extra cautious - if it's the only one and looks quoted, return null
    if (allTweetTextElements.length === 1) {
      const textElement = allTweetTextElements[0];
      const depth = getElementDepth(textElement, mainTweetContainer);

      // CRITICAL: On single tweet pages with "Quote" visible, if there's only ONE tweetText,
      // it MUST be the quoted tweet's text (since the main tweet has no text - just an image/GIF)
      if (isSingleTweetPage) {
        const hasQuoteLabel = tweetElement.textContent.includes('Quote') ||
                             tweetElement.querySelector('span')?.textContent?.includes('Quote');

        if (hasQuoteLabel) {
          // This is a quote tweet page, and the only text found is from the quoted tweet
          // The main tweet (PunishedAbammon) has no text - just a GIF
          return null;
        }
      }

      const isQuoted = isInsideQuotedTweet(textElement, tweetElement);

      // On single tweet pages, if the only text is very deep (>10), it might be quoted content
      // Check if there's a quoted tweet container - if so, this might be the quoted text
      if (isSingleTweetPage && depth > 10) {
        const hasQuotedContainer = tweetElement.querySelector('[data-testid="quotedTweet"]') ||
                                   tweetElement.querySelector('[data-testid="quoteTweet"]') ||
                                   tweetElement.querySelectorAll('article').length > 1;

        if (hasQuotedContainer) {
          return null; // Likely quoted content, main tweet has no text
        }
      }

      // Check if it's inside a quoted tweet container
      if (!isQuoted) {
        let text = textElement.innerText || textElement.textContent || '';
        text = text.trim();
        if (text.length > 0) {
          return text;
        }
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

    // NEW: Look for visual/hierarchical indicators of quoted content
    // On single tweet pages, check if there's a "Quote" label or quoted tweet structure
    if (isSingleTweetPage) {
      // Check if there's a "Quote" text/label in the tweet (indicates this is a quote tweet page)
      const hasQuoteLabel = tweetElement.textContent.includes('Quote') ||
                           tweetElement.querySelector('[data-testid="quoteTweet"]') ||
                           tweetElement.querySelector('div[dir="auto"]')?.textContent?.includes('Quote');

      // Check if the element is in a section that appears after the main content
      // Quoted tweets are usually in a distinct visual block
      let current = element;
      let foundQuoteIndicator = false;

      // Walk up the DOM tree looking for quoted tweet indicators
      while (current && current !== tweetElement) {
        // Check if current or parent has quote-related attributes/classes
        const parentText = current.parentElement?.textContent || '';

        // Look for nested structure that indicates quoted content
        // Quoted tweets often have the quoted author's info nearby
        if (current.closest('[data-testid="tweet"]') !== tweetElement.querySelector('[data-testid="tweet"]:first-of-type')) {
          foundQuoteIndicator = true;
          break;
        }

        // Check for nested divs with specific structure (quoted tweets often in nested divs)
        if (current.tagName === 'DIV') {
          const siblings = Array.from(current.parentElement?.children || []);
          // If we're in a div that has a "Quote" text sibling or parent
          if (siblings.some(sib => sib.textContent?.includes('Quote'))) {
            foundQuoteIndicator = true;
            break;
          }
        }

        current = current.parentElement;
        if (!current) break;
      }

      // If we found quote indicators AND we're not in the main tweet text area, it's quoted
      if (hasQuoteLabel && foundQuoteIndicator) {
        return true;
      }
    }

    // Check for nested articles - quoted tweets are nested articles
    let current = element;
    let articleCount = 0;
    const articles = [];

    while (current && current !== tweetElement) {
      // Count articles we encounter
      if (current.tagName === 'ARTICLE') {
        articleCount++;
        articles.push(current);

        // On single tweet pages, be more aggressive: any nested article is likely quoted
        if (isSingleTweetPage && articleCount > 1) {
          return true;
        }

        // If we're inside a nested article (second+ article), it's likely a quoted tweet
        if (articleCount > 1) {
          // Double-check: see if this article is nested inside another article or tweet container
          let parent = current.parentElement;
          while (parent && parent !== tweetElement) {
            if (parent.tagName === 'ARTICLE' ||
                parent.getAttribute('data-testid') === 'tweet' ||
                parent.querySelector('[data-testid="tweet"]')) {
              return true; // Nested article = quoted tweet
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

    // On single tweet pages with quote tweets, check if there's a "Quote" text visible
    // AND if this element is in a visually distinct section
    if (isSingleTweetPage) {
      // Check if there's any "Quote" text in the tweet (indicates it's a quote tweet)
      const tweetHasQuoteLabel = tweetElement.textContent.includes('Quote') ||
                                 tweetElement.querySelector('span')?.textContent?.includes('Quote');

      if (tweetHasQuoteLabel) {
        // If depth > 8 on a quote tweet page, it's likely quoted content
        if (depth > 8) {
          return true;
        }

        // Additional check: if the element is not directly under the main tweet container
        // and there's a Quote label, it's likely quoted
        const mainTweetContainer = tweetElement.querySelector('[data-testid="tweet"]');
        if (mainTweetContainer && !mainTweetContainer.contains(element)) {
          return true;
        }
      }
    }

    // If depth > 12 and we're not sure, be cautious - likely quoted
    if (depth > 12) {
      // Check if there's a shallower tweetText element (which would be the main tweet)
      const allTexts = tweetElement.querySelectorAll('[data-testid="tweetText"]');
      for (const otherText of allTexts) {
        if (otherText !== element) {
          const otherDepth = getElementDepth(otherText, mainContainer);
          if (otherDepth < depth - 2) {
            // There's a much shallower text element, so this one is likely quoted
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
    const isLikelyMetadata =
      text.match(/^@\w+/) ||  // Starts with @username
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
    // Gradient from 60 (red) to 145+ (green)
    // 60-85: red to orange
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
   */
  function createLoadingBadge() {
    const badge = document.createElement('span');
    badge.className = 'iq-badge iq-badge-loading';
    badge.setAttribute('data-iq-loading', 'true');

    badge.style.setProperty('background-color', '#bdbdbd', 'important');
    badge.style.setProperty('color', '#000000', 'important');
    badge.style.setProperty('cursor', 'wait', 'important');

    badge.innerHTML = `
      <span class="iq-label">IQ</span>
      <span class="iq-score">...</span>
    `;

    return badge;
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

    badge.innerHTML = `
      <span class="iq-label">IQ</span>
      <span class="iq-score">${iq}</span>
    `;

    // Re-apply background color after innerHTML in case it got reset
    badge.style.setProperty('background-color', iqColor, 'important');
    badge.style.setProperty('color', '#000000', 'important');

    // Add hover event listeners for debug output
    badge.addEventListener('mouseenter', () => {
      logDebugInfo(badge._debugData);
    });

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
    console.groupEnd();

    // Dimension Breakdown
    if (result.dimension_scores) {
      console.group('%c📊 Dimension Breakdown (Weighted Combination)', 'color: #2196F3; font-weight: bold;');

      const weights = {
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
    console.log(`  Trained Mapping: IQ = 60 + (avg_words - 11.0) × 6.0 (+ variance & readability boosts)`);

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
    // Skip if already processed
    if (tweetElement.hasAttribute('data-iq-analyzed')) {
      return;
    }

    // Check if badge already exists
    if (tweetElement.querySelector('.iq-badge')) {
      tweetElement.setAttribute('data-iq-analyzed', 'true');
      return;
    }

    // Mark as processing to avoid double-processing
    tweetElement.setAttribute('data-iq-processing', 'true');

    // Try to extract full text without visually expanding the tweet
    let tweetText = null;

    // First, check if tweet is already expanded - if so, just extract normally
    const alreadyExpanded = Array.from(tweetElement.querySelectorAll('span[role="button"], button, div[role="button"]')).some(el => {
      const text = el.textContent.trim().toLowerCase();
      return text === 'show less' || text === 'read less' ||
             (text.includes('show') && text.includes('less'));
    });

    // If already expanded, just extract normally (don't try to collapse it)
    if (alreadyExpanded) {
      tweetText = extractTweetText(tweetElement);
    } else if (isTweetTruncated(tweetElement)) {

      // Extract full text without visually expanding the tweet
      tweetText = tryExtractFullTextWithoutExpanding(tweetElement);

      // Get a baseline to compare - what would normal extraction give us?
      const baselineText = extractTweetText(tweetElement);
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
        const expandedText = await extractFullTextWithoutVisualExpansion(tweetElement);
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

    // Extract text (either we already have it from above, or use normal extraction)
    if (!tweetText) {
      tweetText = extractTweetText(tweetElement);
    }

    // Validate text before processing
    if (!tweetText) {
      tweetElement.removeAttribute('data-iq-processing');
      return; // Skip if no text extracted
    }

    const validation = validateTweetText(tweetText);
    if (!validation.isValid) {
      tweetElement.removeAttribute('data-iq-processing');
      // Skip invalid tweets (emoji-only, too short, metadata, etc.)
      return;
    }

    // Show loading indicator while processing (especially for dependency parsing)
    let loadingBadge = null;
    const engagementBar = tweetElement.querySelector('[role="group"]');
    if (engagementBar && settings.showIQBadge) {
      loadingBadge = createLoadingBadge();
      const firstChild = engagementBar.firstElementChild;
      if (firstChild) {
        engagementBar.insertBefore(loadingBadge, firstChild);
      } else {
        engagementBar.appendChild(loadingBadge);
      }
    }

    try {
      // Calculate IQ using the comprehensive client-side estimator (async with real dependency parsing)
      const result = await iqEstimator.estimate(tweetText);

      // Remove loading badge
      if (loadingBadge) {
        loadingBadge.remove();
      }

      // Only show badge if estimation was successful
      if (result.is_valid && result.iq_estimate !== null && settings.showIQBadge) {
        const iq = Math.round(result.iq_estimate);

        // Create and inject badge (pass full result for debug)
        const badge = createIQBadge(iq, result, tweetText);

        // Find the engagement bar (comments, retweets, likes, views, bookmarks)
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
          tweetElement.appendChild(badge);
        }

        processedTweets.add(tweetElement);
        tweetElement.setAttribute('data-iq-analyzed', 'true');
        tweetElement.removeAttribute('data-iq-processing');
      }
    } catch (error) {
      console.error('Error processing tweet:', error);
      // Remove loading badge on error
      if (loadingBadge) {
        loadingBadge.remove();
      }
    } finally {
      // Remove processing flag even if there was an error
      tweetElement.removeAttribute('data-iq-processing');
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

    const newTweets = Array.from(tweets).filter(tweet =>
      tweet && !tweet.hasAttribute('data-iq-analyzed') && !tweet.hasAttribute('data-iq-processing')
    );

    newTweets.forEach((tweet) => {
      processTweet(tweet);
    });
  }

  /**
   * Setup MutationObserver to watch for new tweets
   */
  function setupObserver() {
    const observer = new MutationObserver((mutations) => {
      let shouldProcess = false;

      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if the added node is a tweet or contains tweets
            if (node.tagName === 'ARTICLE' || node.querySelector?.('article')) {
              shouldProcess = true;
            }
          }
        });
      });

      if (shouldProcess) {
        // Debounce processing
        setTimeout(processVisibleTweets, 300);
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
   * Initialize the extension
   */
  function init() {
    // Process existing tweets
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
          processVisibleTweets();
        }, 1000);
        setupObserver();
      });
    } else {
      setTimeout(() => {
        processVisibleTweets();
      }, 1000);
      setupObserver();
    }

    // Also process on scroll (for lazy-loaded content)
    let scrollTimeout;
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        processVisibleTweets();
      }, 500);
    });
  }

  // Start the extension
  init();
})();



