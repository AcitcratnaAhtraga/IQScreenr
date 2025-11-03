/**
 * Badge Creation Utilities
 * Handles creation of different badge types: loading, invalid, IQ badges, and real-time badges
 */

(function() {
  'use strict';

// Get color utilities
const getColorUtils = () => window.BadgeColorUtils || {};

/**
 * Create loading badge while IQ is being calculated
 */
function createLoadingBadge() {
  const { hexToRgb, desaturateColor } = getColorUtils();

  const badge = document.createElement('span');
  badge.className = 'iq-badge iq-badge-loading';
  badge.setAttribute('data-iq-loading', 'true');

  const darkerRed = '#b71c1c';
  const rgb = hexToRgb(darkerRed);
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
 * Create "X" badge for invalid tweets
 */
function createInvalidBadge() {
  const badge = document.createElement('span');
  badge.className = 'iq-badge iq-badge-invalid iq-badge-flip';
  badge.setAttribute('data-iq-invalid', 'true');

  badge.style.setProperty('background-color', '#000000', 'important');
  badge.style.setProperty('color', '#9e9e9e', 'important');
  badge.style.setProperty('cursor', 'help', 'important');
  badge.style.setProperty('display', 'inline-flex', 'important');
  badge.style.setProperty('visibility', 'visible', 'important');
  badge.style.setProperty('opacity', '1', 'important');

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
 * Log comprehensive debug information to console (on hover)
 */
function logDebugInfo(debugData) {
  if (!debugData) return;

  const { iq, result, text, timestamp } = debugData;
  const { getDimensionColor } = getColorUtils();

  // Check if debug logging is enabled via settings
  const settings = window.Settings || {};
  if (settings.enableDebugLogging === false) {
    return;
  }

  console.log(
    '%c' + '='.repeat(80),
    'color: #4CAF50; font-weight: bold; font-size: 14px;'
  );
  console.log(
    '%c🧠 IQ ESTIMATION DEBUG - Hover Details',
    'color: #2196F3; font-weight: bold; font-size: 16px; background: #E3F2FD; padding: 4px 8px;'
  );
  console.log('%c' + '='.repeat(80), 'color: #4CAF50; font-weight: bold;');

  console.group('%c📝 Original Text', 'color: #FF9800; font-weight: bold;');
  console.log('%c' + text, 'color: #333; font-family: monospace; background: #FFF9C4; padding: 8px; border-left: 3px solid #FFC107;');
  console.log(`Length: ${text.length} characters, ${text.split(/\s+/).length} words`);
  console.groupEnd();

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

  if (result.dimension_scores) {
    console.group('%c📊 Dimension Breakdown (Weighted Combination)', 'color: #2196F3; font-weight: bold;');

    const weights = result.is_twitter_calibrated ? {
      vocabulary_sophistication: 0.45,
      lexical_diversity: 0.25,
      sentence_complexity: 0.15,
      grammatical_precision: 0.15
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
        `color: ${getDimensionColor ? getDimensionColor(dim) : '#333'}; font-weight: bold;`
      );
      console.log(`  Weight: ${(weight * 100).toFixed(0)}% | Contribution: ${contribution.toFixed(1)} (${contributionPercent}% of final)`);
    });

    console.groupEnd();
  }

  console.group('%c🔍 Feature Extraction Details', 'color: #00BCD4; font-weight: bold;');
  const features = result.features || {};
  const tokens = features.tokens || text.match(/\b\w+\b/g) || [];
  const sentences = features.sentences || text.split(/[.!?]+/).filter(s => s.trim().length > 0);

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

  console.groupCollapsed('%c📦 Full Result Object', 'color: #607D8B; font-weight: bold;');
  console.log(result);
  console.groupEnd();

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
 * Create IQ badge element with debug data attached
 */
function createIQBadge(iq, estimationResult, tweetText) {
  const { getIQColor } = getColorUtils();
  const { updateBadgeWithFlipStructure } = window.BadgeAnimations || {};

  const badge = document.createElement('span');
  badge.className = 'iq-badge';
  badge.setAttribute('data-iq-score', iq);

  const confidence = estimationResult.confidence ? Math.round(estimationResult.confidence) : null;
  if (confidence !== null) {
    badge.setAttribute('data-confidence', confidence);
  }

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

  badge.style.setProperty('background-color', iqColor, 'important');
  badge.style.setProperty('color', '#000000', 'important');

  // Always add hover event listener for console debug info
  badge.addEventListener('mouseenter', () => {
    if (badge._debugData) {
      logDebugInfo(badge._debugData);
    }
  });

  return badge;
}

/**
 * Create or update real-time IQ badge near the input area
 */
function createRealtimeBadge(inputElement, container) {
  const { hexToRgb, desaturateColor } = getColorUtils();

  if (!container._iqInputElement) {
    container._iqInputElement = inputElement;
  }

  let badge = container.querySelector('.iq-badge-realtime');

  if (!badge) {
    let searchContainer = container.parentElement;
    for (let i = 0; i < 3 && searchContainer; i++) {
      badge = searchContainer.querySelector('.iq-badge-realtime');
      if (badge) break;
      searchContainer = searchContainer.parentElement;
    }
  }

  if (!badge && inputElement) {
    const allBadges = document.querySelectorAll('.iq-badge-realtime');
    for (const existingBadge of allBadges) {
      try {
        const inputRect = inputElement.getBoundingClientRect();
        const badgeRect = existingBadge.getBoundingClientRect();
        const distance = Math.abs(badgeRect.top - inputRect.bottom) + Math.abs(badgeRect.left - inputRect.left);
        if (distance < 300) {
          badge = existingBadge;
          container = badge.parentElement || container;
          break;
        }
      } catch (e) {
        // Skip
      }
    }
  }

  if (badge) {
    const allBadges = document.querySelectorAll('.iq-badge-realtime');
    let foundFirst = false;
    for (const existingBadge of allBadges) {
      if (existingBadge === badge) {
        foundFirst = true;
      } else if (foundFirst) {
        existingBadge.remove();
      } else {
        try {
          const inputRect = inputElement.getBoundingClientRect();
          const badgeRect = existingBadge.getBoundingClientRect();
          const distance = Math.abs(badgeRect.top - inputRect.bottom) + Math.abs(badgeRect.left - inputRect.left);
          if (distance < 300) {
            existingBadge.remove();
          }
        } catch (e) {
          if (existingBadge !== badge) {
            existingBadge.remove();
          }
        }
      }
    }

    const cachedNaturalHeight = badge.getAttribute('data-natural-height');
    if (cachedNaturalHeight) {
      const heightValue = `${cachedNaturalHeight}px`;
      badge.style.setProperty('height', heightValue, 'important');
      badge.style.setProperty('max-height', heightValue, 'important');
      badge.style.setProperty('min-height', heightValue, 'important');
    } else {
      const existingHeightValue = badge.style.height;
      if (existingHeightValue && existingHeightValue !== 'auto' && existingHeightValue.endsWith('px')) {
        const heightNum = parseFloat(existingHeightValue);
        if (!isNaN(heightNum) && heightNum > 0) {
          badge.style.setProperty('height', existingHeightValue, 'important');
          badge.style.setProperty('max-height', existingHeightValue, 'important');
          badge.style.setProperty('min-height', existingHeightValue, 'important');
          badge.setAttribute('data-natural-height', heightNum.toString());
        }
      }
    }
    badge.style.setProperty('flex-shrink', '0', 'important');
    badge.style.setProperty('flex-grow', '0', 'important');
    badge.style.setProperty('align-self', 'flex-start', 'important');

    return badge;
  }

  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'iq-badge iq-badge-realtime';
    badge.setAttribute('data-iq-realtime', 'true');

    const darkerRed = '#b71c1c';
    const rgb = hexToRgb(darkerRed);
    const desat = desaturateColor(rgb, 0.5);
    const loadingColor = `rgb(${desat.r}, ${desat.g}, ${desat.b})`;
    badge.style.setProperty('background-color', loadingColor, 'important');
    badge.style.setProperty('color', '#000000', 'important');
    badge.style.setProperty('display', 'inline-flex', 'important');
    badge.style.setProperty('vertical-align', 'middle', 'important');
    badge.style.setProperty('margin-right', '8px', 'important');
    badge.style.setProperty('height', 'auto', 'important');
    badge.style.setProperty('max-height', 'none', 'important');
    badge.style.setProperty('flex-shrink', '0', 'important');
    badge.style.setProperty('flex-grow', '0', 'important');
    badge.style.setProperty('align-self', 'flex-start', 'important');
    badge.innerHTML = `
      <span class="iq-label">IQ</span>
      <span class="iq-score">0</span>
    `;

    setTimeout(() => {
      const scoreElement = badge.querySelector('.iq-score');
      const labelElement = badge.querySelector('.iq-label');
      if (scoreElement && labelElement && !badge.getAttribute('data-natural-height')) {
        const clone = badge.cloneNode(true);
        clone.style.position = 'absolute';
        clone.style.visibility = 'hidden';
        clone.style.height = '';
        clone.style.maxHeight = '';
        clone.style.minHeight = '';
        clone.style.top = '-9999px';
        clone.style.left = '-9999px';
        clone.style.boxSizing = 'border-box';
        document.body.appendChild(clone);

        clone.offsetHeight;

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
    }, 100);

    const replyVisibilitySelectors = [
      '[data-testid="replyVisibilityLabel"]',
      'div[role="button"][aria-label*="can reply"]',
      '*[aria-label*="can reply"]'
    ];

    let replyVisibilityElement = null;
    for (const selector of replyVisibilitySelectors) {
      replyVisibilityElement = container.querySelector(selector);
      if (replyVisibilityElement) break;
    }

    if (!replyVisibilityElement) {
      for (const selector of replyVisibilitySelectors) {
        const candidate = document.querySelector(selector);
        if (candidate) {
          if (container.contains(candidate)) {
            replyVisibilityElement = candidate;
            break;
          }
          if (inputElement) {
            try {
              const inputRect = inputElement.getBoundingClientRect();
              const replyRect = candidate.getBoundingClientRect();
              const distance = Math.abs(replyRect.top - inputRect.bottom);
              if (distance < 200) {
                replyVisibilityElement = candidate;
                break;
              }
            } catch (e) {
              // Skip
            }
          }
        }
      }
    }

    if (!replyVisibilityElement) {
      const containerElements = container.querySelectorAll('*');
      for (const el of containerElements) {
        const text = el.textContent || '';
        if (text.includes('can reply') || (text.includes('Everyone') && text.includes('reply'))) {
          replyVisibilityElement = el;
          break;
        }
      }

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

    const toolbarSelectors = [
      '[data-testid="toolBar"]',
      'div[role="toolbar"]',
      'div[data-testid*="toolbar"]',
      'div[role="group"]'
    ];

    let toolbarElement = null;
    let firstButtonInToolbar = null;
    const inputRect = inputElement ? inputElement.getBoundingClientRect() : null;

    for (const selector of toolbarSelectors) {
      const toolbars = container.querySelectorAll(selector);
      for (const toolbar of toolbars) {
        if (inputRect) {
          try {
            const toolbarRect = toolbar.getBoundingClientRect();
            const distance = Math.abs(toolbarRect.top - inputRect.bottom);
            if (distance > 200) {
              continue;
            }

            const originalPostArticles = document.querySelectorAll('article[data-testid="tweet"]');
            let isOriginalPostToolbar = false;
            for (const article of originalPostArticles) {
              const engagementBar = article.querySelector('[role="group"]');
              if (engagementBar && toolbar.contains(engagementBar)) {
                isOriginalPostToolbar = true;
                break;
              }
            }
            if (isOriginalPostToolbar) {
              continue;
            }
          } catch (e) {
            continue;
          }
        }

        const buttons = toolbar.querySelectorAll('button, div[role="button"]');
        if (buttons.length > 0) {
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

          if (hasRelevantButtons && firstButtonInToolbar) {
            break;
          }
        }

        if (buttons.length > 0 && !firstButtonInToolbar) {
          firstButtonInToolbar = buttons[0];
          toolbarElement = toolbar;
        }
      }

      if (toolbarElement && firstButtonInToolbar) {
        break;
      }
    }

    if (toolbarElement && firstButtonInToolbar && firstButtonInToolbar.parentElement) {
      firstButtonInToolbar.parentElement.insertBefore(badge, firstButtonInToolbar);
    } else if (replyVisibilityElement && replyVisibilityElement.parentElement) {
      replyVisibilityElement.parentElement.insertBefore(badge, replyVisibilityElement);
    } else if (toolbarElement) {
      const firstChild = toolbarElement.firstElementChild;
      if (firstChild) {
        toolbarElement.insertBefore(badge, firstChild);
      } else {
        toolbarElement.appendChild(badge);
      }
    } else {
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

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.BadgeCreation = {
    createLoadingBadge,
    createInvalidBadge,
    createIQBadge,
    createRealtimeBadge,
    logDebugInfo
  };
}

})();

