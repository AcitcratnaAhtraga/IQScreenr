/**
 * Text Extraction Utilities
 * Handles extraction of tweet text and input text from various DOM structures
 */

(function() {
  'use strict';

/**
 * Remove URLs (especially image URLs) from extracted text
 * This ensures URLs don't affect IQ calculation
 */
function removeUrlsFromText(text) {
  if (!text || typeof text !== 'string') {
    return text;
  }

  let cleaned = text;

  // Step 1: Handle concatenated URLs (like "https://pic.x.com/xyzhttps://pic.x.com/xyz")
  // by adding a space before http/https when it's not preceded by a space
  cleaned = cleaned.replace(/([^\s])(https?:\/\/)/gi, '$1 $2');

  // Step 2: Remove all URLs (handling spaces in various positions)
  // Pattern to match URLs, including:
  // - pic.x.com/imageId (with or without spaces after "https://")
  // - pic.twitter.com/imageId
  // - pbs.twimg.com (Twitter media)
  // - Any https:// or http:// URL

  const urlPatterns = [
    // Image URLs from X/Twitter - handles "https:// pic.x.com/xyz" or "https://pic.x.com/xyz"
    // Matches: https:// followed by zero or more spaces, then pic.x.com/pic.twitter.com/pbs.twimg.com
    /https?:\/\/\s*(pic\.(x\.com|twitter\.com)|pbs\.twimg\.com)\/\S*/gi,
    // More aggressive: any URL pattern that might have spaces
    // Matches "https:// domain.com/path" or "https://domain.com/path"
    /\bhttps?:\/\/\s*[^\s]+\.[^\s]+(?:\/[^\s]*)?/gi,
    // Standard URLs (no spaces after protocol)
    /\bhttps?:\/\/[^\s]+/gi,
    // Catch any remaining "https://" or "http://" followed by space and domain
    /https?:\/\/\s+[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}(?:\/[^\s]*)?/gi
  ];

  // Apply patterns multiple times to catch all URLs (including nested/concatenated ones)
  let previousCleaned = '';
  let iterations = 0;
  while (previousCleaned !== cleaned && iterations < 10) {
    previousCleaned = cleaned;
    for (const pattern of urlPatterns) {
      cleaned = cleaned.replace(pattern, '').trim();
    }
    iterations++;
  }

  // Step 3: Remove any remaining URL fragments or standalone domains with paths
  // Catch standalone "pic.x.com/xyz" patterns (without protocol)
  cleaned = cleaned.replace(/\b(pic\.(x\.com|twitter\.com)|pbs\.twimg\.com)\/\S*/gi, '');

  // Step 4: Remove standalone domain patterns (without protocol) - like "domain.com/path"
  // This catches URLs that don't have http:// or https:// prefix
  cleaned = cleaned.replace(/\b[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}(?:\/[^\s]*)?/gi, '');

  // Step 5: Remove academic paper ID patterns (like "as.2414926122", "ev.12272", etc.)
  // These are often citation formats that look like: "as.1234567890" or similar
  // Pattern: 1-4 lowercase letters, dot, 5-12 digits (covers most academic IDs)
  cleaned = cleaned.replace(/\b[a-z]{1,4}\.[0-9]{5,12}\b/gi, '');

  // Step 6: Remove URL path fragments that look like paths
  // Matches patterns like: "path/to/something", "article-id", etc.
  // Only match if it contains a slash (indicating it's likely a URL path)
  cleaned = cleaned.replace(/\b[a-zA-Z0-9-]+\/[a-zA-Z0-9\/\-_]{3,}\b/g, '');

  // Step 7: Remove common URL path indicators that might be fragments
  // Patterns like numbers followed by paths like "1/cdev.12669"
  cleaned = cleaned.replace(/\b\d+\/[a-zA-Z0-9\/\-_.]+\b/g, '');

  // Step 7b: Remove standalone path segments starting with slash
  // But be careful not to remove normal punctuation - only if it looks like a URL path
  cleaned = cleaned.replace(/\s\/[a-zA-Z0-9\/\-_]{5,}\b/g, ' ');

  // Step 8: Remove any remaining "http://" or "https://" fragments followed by whitespace
  cleaned = cleaned.replace(/\bhttps?:\/\/\s*/gi, '');

  // Step 9: Remove t.co short links (Twitter URL shortener)
  cleaned = cleaned.replace(/\bt\.co\/[a-zA-Z0-9]+\b/gi, '');

  // Step 10: Clean up any remaining artifacts like double spaces or trailing/leading spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

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

  // Get helper functions from TweetDetection (loaded after this module, but will be available when called)
  const getElementDepth = window.TweetDetection?.getElementDepth || function(element, root) {
    let depth = 0;
    let current = element;
    while (current && current !== root && depth < 50) {
      current = current.parentElement;
      depth++;
      if (!current) break;
    }
    return depth;
  };

  const isInsideQuotedTweet = window.TweetDetection?.isInsideQuotedTweet || function(element, tweetElement) {
    const quotedSelectors = ['[data-testid="quotedTweet"]', '[data-testid="quoteTweet"]'];
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
    return false;
  };

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
    // Remove URLs from extracted text
    text = removeUrlsFromText(text);
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
    // Remove URLs from extracted text
    text = removeUrlsFromText(text);
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
        // Remove URLs from extracted text
        text = removeUrlsFromText(text);

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
    // Ensure URLs are removed even from stored text (in case it was stored before URL removal was implemented)
    return removeUrlsFromText(storedFullText);
  }

  // Method 0.5: Check React Fiber or internal state (if accessible)
  // Try to find the full text in aria-label or title attributes
  const textSpans = textContainer.querySelectorAll('span');
  for (const span of textSpans) {
    const ariaLabel = span.getAttribute('aria-label');
    const title = span.getAttribute('title');
    if (ariaLabel && ariaLabel.length > 200) {
      return removeUrlsFromText(ariaLabel.trim());
    }
    if (title && title.length > 200) {
      return removeUrlsFromText(title.trim());
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
    // Remove URLs from extracted text
    fullText = removeUrlsFromText(fullText);

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
    // Remove URLs from extracted text
    cleanedText = removeUrlsFromText(cleanedText);

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
      return removeUrlsFromText(dataText.trim());
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
    return removeUrlsFromText(longestText);
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
          // extractTweetText already removes URLs, but ensure it's cleaned
          fullText = removeUrlsFromText(currentText);

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

      // Function to apply CSS truncation
      const applyCssTruncation = () => {
        try {
          const currentText = extractTweetText(tweetElement);
          if (!currentText || currentText.length <= baselineLength + 50) {
            return; // Text hasn't expanded yet
          }

          const fullText = removeUrlsFromText(currentText);
          const expandedHeight = textContainer.getBoundingClientRect().height;
          const lineHeight = expandedHeight / (fullText.length / 50);
          const targetHeight = Math.max(originalHeight, lineHeight * 4);

          textContainer.style.maxHeight = `${targetHeight}px`;
          textContainer.style.overflow = 'hidden';
          textContainer.style.position = 'relative';
          textContainer.setAttribute('data-iq-truncated', 'true');
          textContainer.setAttribute('data-iq-target-height', targetHeight.toString());

          // Add custom toggle button if it doesn't exist
          let parentWrapper = textContainer.parentElement;
          if (!parentWrapper || !parentWrapper.querySelector('[data-iq-toggle-btn]')) {
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
                textContainer.style.maxHeight = 'none';
                textContainer.removeAttribute('data-iq-truncated');
                span.textContent = 'Show less';
              } else {
                textContainer.style.maxHeight = `${savedHeight}px`;
                textContainer.setAttribute('data-iq-truncated', 'true');
                span.textContent = 'Show more';
              }
            };

            if (parentWrapper) {
              parentWrapper.insertBefore(buttonWrapper, textContainer.nextSibling);
            } else {
              textContainer.parentNode.insertBefore(buttonWrapper, textContainer.nextSibling);
            }
          }

          // Store full text
          tweetElement.setAttribute('data-iq-full-text', fullText);
        } catch (e) {
          // Silently fail
        }
      };

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

      // Immediately try to collapse it back (before MutationObserver fires)
      // Try multiple times with increasing delays to catch expansion as quickly as possible
      const attemptCollapse = (attempt = 0) => {
        // Check if Twitter added a "Show less" button and click it
        const showLessButton = tweetElement.querySelector('button[data-testid="tweet-text-show-less-link"]') ||
          Array.from(tweetElement.querySelectorAll('button, span[role="button"]')).find(el => {
            const text = (el.textContent || '').trim().toLowerCase();
            return text === 'show less' || text === 'read less' ||
                   (text.includes('show') && text.includes('less'));
          });

        if (showLessButton) {
          // Twitter added a "Show less" button - click it immediately
          try {
            showLessButton.click();
            return; // Success, stop retrying
          } catch (e) {
            // Fallback to CSS truncation if clicking fails
            applyCssTruncation();
            return;
          }
        } else {
          // No "Show less" button yet, check if text expanded and apply CSS truncation
          const currentText = extractTweetText(tweetElement);
          if (currentText && currentText.length > baselineLength + 50) {
            applyCssTruncation();
            return; // Success, stop retrying
          }

          // Text not expanded yet, retry if we haven't tried too many times
          if (attempt < 5) {
            const delays = [10, 20, 30, 50, 100]; // Progressive delays
            setTimeout(() => attemptCollapse(attempt + 1), delays[attempt] || 100);
          }
        }
      };

      // Start immediately (synchronous check first)
      attemptCollapse(0);

      // Also try after one frame to catch any async updates
      requestAnimationFrame(() => {
        attemptCollapse(1);
      });

      // Fallback timeout - if MutationObserver doesn't catch it in time
      const capturedBaselineLength = baselineLength;
      setTimeout(() => {
        if (!expansionDetected) {
          observer.disconnect();
          const currentText = extractTweetText(tweetElement);
          if (currentText && currentText.length > capturedBaselineLength + 50) {
            // extractTweetText already removes URLs, but ensure it's cleaned
            const cleanedText = removeUrlsFromText(currentText);
            tweetElement.setAttribute('data-iq-full-text', cleanedText);

            // Apply visual truncation even in fallback case
            try {
              const expandedHeight = textContainer.getBoundingClientRect().height;
              const lineHeight = expandedHeight / (cleanedText.length / 50);
              const targetHeight = Math.max(originalHeight, lineHeight * 4);

              textContainer.style.maxHeight = `${targetHeight}px`;
              textContainer.style.overflow = 'hidden';
              textContainer.style.position = 'relative';
              textContainer.setAttribute('data-iq-truncated', 'true');
              textContainer.setAttribute('data-iq-target-height', targetHeight.toString());

              // Add custom toggle button
              let parentWrapper = textContainer.parentElement;
              if (!parentWrapper || !parentWrapper.querySelector('[data-iq-toggle-btn]')) {
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
                    textContainer.style.maxHeight = 'none';
                    textContainer.removeAttribute('data-iq-truncated');
                    span.textContent = 'Show less';
                  } else {
                    textContainer.style.maxHeight = `${savedHeight}px`;
                    textContainer.setAttribute('data-iq-truncated', 'true');
                    span.textContent = 'Show more';
                  }
                };

                if (parentWrapper) {
                  parentWrapper.insertBefore(buttonWrapper, textContainer.nextSibling);
                } else {
                  textContainer.parentNode.insertBefore(buttonWrapper, textContainer.nextSibling);
                }
              }
            } catch (e) {
              // Silently fail if truncation fails
            }

            resolve(cleanedText);
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
 * Expand truncated tweets by clicking "show more" button if present
 * Returns a promise that resolves when expansion is complete
 * Includes verification that expansion actually occurred
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
        showMoreButton.click();
      } catch (e1) {
        try {
          const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
          });
          showMoreButton.dispatchEvent(clickEvent);
        } catch (e2) {
          try {
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
 * Extract Twitter handle/username from a tweet element
 * Returns the handle without @ symbol (e.g., "username" not "@username")
 */
function extractTweetHandle(tweetElement) {
  if (!tweetElement) {
    return null;
  }

  // Handle nested tweet structures
  let actualTweetElement = tweetElement;
  const nestedTweet = tweetElement.querySelector('[data-testid="tweet"]') ||
                      tweetElement.querySelector('article[role="article"]');
  if (nestedTweet && nestedTweet !== tweetElement) {
    actualTweetElement = nestedTweet;
  }

  // Method 1: Look for links with href containing /@username pattern
  // Twitter/X uses links like: href="/username" or href="https://twitter.com/username"
  const userLinks = actualTweetElement.querySelectorAll('a[href*="/"]');
  for (const link of userLinks) {
    const href = link.getAttribute('href') || '';
    // Match patterns like /username or /@username or /username/status/...
    const match = href.match(/^\/(?:@)?([a-zA-Z0-9_]+)(?:\/|$)/);
    if (match && match[1]) {
      // Verify this is actually a user link (not a status link, etc.)
      // User links typically don't have "/status/" in them (unless it's part of the username)
      if (!href.includes('/status/') || href.indexOf('/status/') > match[1].length + 1) {
        return match[1];
      }
    }
  }

  // Method 2: Look for User-Name container (data-testid="User-Name")
  const userNameContainer = actualTweetElement.querySelector('[data-testid="User-Name"]');
  if (userNameContainer) {
    // Look for links inside the User-Name container
    const links = userNameContainer.querySelectorAll('a[href*="/"]');
    for (const link of links) {
      const href = link.getAttribute('href') || '';
      const match = href.match(/^\/(?:@)?([a-zA-Z0-9_]+)(?:\/|$)/);
      if (match && match[1]) {
        return match[1];
      }
    }
  }

  // Method 3: Look for text nodes starting with @ that appear to be usernames
  // This is a fallback - less reliable but might catch some cases
  const textNodes = [];
  const walker = document.createTreeWalker(
    actualTweetElement,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  let node;
  while (node = walker.nextNode()) {
    const text = node.textContent.trim();
    if (text.match(/^@[a-zA-Z0-9_]+$/)) {
      return text.substring(1); // Remove @ symbol
    }
  }

  return null;
}

/**
 * Extract tweet ID from a tweet element
 * Returns the tweet ID (e.g., "1234567890123456789") or null if not found
 */
function extractTweetId(tweetElement) {
  if (!tweetElement) {
    return null;
  }

  // Handle nested tweet structures
  let actualTweetElement = tweetElement;
  const nestedTweet = tweetElement.querySelector('[data-testid="tweet"]') ||
                      tweetElement.querySelector('article[role="article"]');
  if (nestedTweet && nestedTweet !== tweetElement) {
    actualTweetElement = nestedTweet;
  }

  // Method 1: Look for links with href containing /status/ pattern
  const links = actualTweetElement.querySelectorAll('a[href*="/status/"]');
  for (const link of links) {
    const href = link.getAttribute('href') || '';
    // Match patterns like /username/status/1234567890 or /status/1234567890
    const match = href.match(/\/status\/(\d+)/);
    if (match && match[1]) {
      return match[1];
    }
  }

  // Method 2: Look for time links which typically contain status URLs
  const timeLinks = actualTweetElement.querySelectorAll('a[href*="/status/"] time');
  for (const timeEl of timeLinks) {
    const link = timeEl.closest('a[href*="/status/"]');
    if (link) {
      const href = link.getAttribute('href') || '';
      const match = href.match(/\/status\/(\d+)/);
      if (match && match[1]) {
        return match[1];
      }
    }
  }

  // Method 3: Check data attributes on the article element itself
  const tweetId = actualTweetElement.getAttribute('data-tweet-id') ||
                  actualTweetElement.closest('[data-tweet-id]')?.getAttribute('data-tweet-id');
  if (tweetId) {
    return tweetId;
  }

  return null;
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.TextExtraction = {
    isTweetTruncated,
    extractTweetText,
    tryExtractFullTextWithoutExpanding,
    extractFullTextWithoutVisualExpansion,
    expandTruncatedTweet,
    getInputText,
    extractTweetHandle,
    extractTweetId,
    removeUrlsFromText
  };
}

})();
