/**
 * Content Script - Analyzes tweets and injects IQ badges
 */

(function() {
  'use strict';

  // Initialize Comprehensive IQ Estimator (fully client-side, no server needed)
  const iqEstimator = new ComprehensiveIQEstimator();

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
   * Extract tweet text from a tweet article element
   */
  function extractTweetText(tweetElement) {
    // Try multiple selectors to find tweet text
    const selectors = [
      'div[lang]',
      '[data-testid="tweetText"]',
      '.tweet-text',
      '[dir="auto"] span',
      'div[dir="auto"]'
    ];

    for (const selector of selectors) {
      const element = tweetElement.querySelector(selector);
      if (element) {
        const text = element.innerText || element.textContent || '';
        if (text.trim().length > 0) {
          return text.trim();
        }
      }
    }

    // Fallback: collect all text nodes
    const walker = document.createTreeWalker(
      tweetElement,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let text = '';
    let node;
    while (node = walker.nextNode()) {
      if (node.textContent && node.textContent.trim()) {
        text += node.textContent + ' ';
      }
    }

    return text.trim();
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
   * Create IQ badge element
   */
  function createIQBadge(iq) {
    const badge = document.createElement('span');
    badge.className = 'iq-badge';
    badge.setAttribute('data-iq-score', iq);

    const iqColor = getIQColor(iq);
    badge.style.setProperty('background-color', iqColor, 'important');
    badge.style.setProperty('color', '#000000', 'important');

    badge.innerHTML = `
      <span class="iq-label">IQ</span>
      <span class="iq-score">${iq}</span>
    `;

    // Re-apply background color after innerHTML in case it got reset
    badge.style.setProperty('background-color', iqColor, 'important');
    badge.style.setProperty('color', '#000000', 'important');

    return badge;
  }

  /**
   * Process a single tweet
   */
  function processTweet(tweetElement) {
    // Skip if already processed
    if (tweetElement.hasAttribute('data-iq-analyzed')) {
      return;
    }

    // Check if badge already exists
    if (tweetElement.querySelector('.iq-badge')) {
      tweetElement.setAttribute('data-iq-analyzed', 'true');
      return;
    }

    // Extract text
    const tweetText = extractTweetText(tweetElement);

    if (!tweetText || tweetText.length < 3) {
      return; // Skip tweets that are too short
    }

    // Mark as processing to avoid duplicate calculations
    tweetElement.setAttribute('data-iq-processing', 'true');

    try {
      // Calculate IQ using the comprehensive client-side estimator
      const result = iqEstimator.estimate(tweetText);

      // Only show badge if estimation was successful
      if (result.is_valid && result.iq_estimate !== null && settings.showIQBadge) {
        const iq = Math.round(result.iq_estimate);

        // Create and inject badge
        const badge = createIQBadge(iq);

        // Find the engagement bar (comments, retweets, likes, views, bookmarks)
        const engagementBar = tweetElement.querySelector('[role="group"]');

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
      }
    } catch (error) {
      console.error('Error processing tweet:', error);
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

    tweets.forEach(tweet => {
      if (tweet && !tweet.hasAttribute('data-iq-analyzed') && !tweet.hasAttribute('data-iq-processing')) {
        processTweet(tweet);
      }
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
        setTimeout(processVisibleTweets, 1000);
        setupObserver();
      });
    } else {
      setTimeout(processVisibleTweets, 1000);
      setupObserver();
    }

    // Also process on scroll (for lazy-loaded content)
    let scrollTimeout;
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(processVisibleTweets, 500);
    });
  }

  // Start the extension
  init();
})();

