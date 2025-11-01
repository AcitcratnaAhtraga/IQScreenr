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

    // Feature Extraction Details
    console.group('%c🔍 Feature Extraction Details', 'color: #00BCD4; font-weight: bold;');

    // Re-extract features for detailed view (or use stored if available)
    const normalizedText = text
      .replace(/https?:\/\/[^\s]+/g, '')
      .replace(/@\w+/g, '')
      .replace(/#\w+/g, '')
      .replace(/[^\w\s.,!?;:()'-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const tokens = normalizedText.match(/\b\w+\b/g) || [];
    const sentences = normalizedText.split(/[.!?]+/).filter(s => s.trim().length > 0);

    const uniqueTokens = new Set(tokens.map(t => t.toLowerCase()));
    const ttr = tokens.length > 0 ? uniqueTokens.size / tokens.length : 0;
    const avgWordLength = tokens.length > 0
      ? tokens.reduce((sum, t) => sum + t.length, 0) / tokens.length
      : 0;
    const avgWordsPerSentence = sentences.length > 0 ? tokens.length / sentences.length : 0;

    console.log(`%cVocabulary Sophistication Features:`, 'font-weight: bold; color: #E91E63;');
    console.log(`  Average Word Length: ${avgWordLength.toFixed(2)} chars`);
    console.log(`  Total Words: ${tokens.length}`);
    console.log(`  Advanced Words (8+ chars): ${tokens.filter(t => t.length >= 8).length} (${((tokens.filter(t => t.length >= 8).length / tokens.length) * 100).toFixed(1)}%)`);

    console.log(`%cLexical Diversity Features:`, 'font-weight: bold; color: #3F51B5;');
    console.log(`  Type-Token Ratio (TTR): ${ttr.toFixed(4)}`);
    console.log(`  Unique Words: ${uniqueTokens.size} of ${tokens.length}`);
    console.log(`  Trained Mapping: IQ = 70 + (TTR - 0.659) × 170`);

    console.log(`%cSentence Complexity Features:`, 'font-weight: bold; color: #009688;');
    console.log(`  Average Words per Sentence: ${avgWordsPerSentence.toFixed(2)}`);
    console.log(`  Total Sentences: ${sentences.length}`);
    console.log(`  Trained Mapping: IQ = 60 + (avg_words - 11.0) × 6.0`);

    console.log(`%cGrammatical Precision Features:`, 'font-weight: bold; color: #FF5722;');
    const commas = (normalizedText.match(/,/g) || []).length;
    const semicolons = (normalizedText.match(/;/g) || []).length;
    const subordinateMarkers = ['which', 'that', 'who', 'although', 'because', 'however'].reduce((count, marker) => {
      const regex = new RegExp(`\\b${marker}\\b`, 'gi');
      return count + (normalizedText.match(regex) || []).length;
    }, 0);
    console.log(`  Punctuation Complexity: ${((commas + semicolons) / Math.max(1, sentences.length)).toFixed(2)} per sentence`);
    console.log(`  Subordinate Clauses: ${subordinateMarkers} markers found`);
    console.log(`  Estimated Dependency Depth: ~${(1.795 + ((commas + semicolons) / Math.max(1, sentences.length)) * 0.3).toFixed(2)}`);
    console.log(`  Trained Mapping: IQ = 53 + (dep_depth - 1.795) × 80`);

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

        // Create and inject badge (pass full result for debug)
        const badge = createIQBadge(iq, result, tweetText);

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

