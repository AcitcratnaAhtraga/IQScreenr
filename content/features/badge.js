/**
 * Badge Management
 * Handles creation, styling, and animation of IQ badges
 */

(function() {
  'use strict';

// Get helper functions from other modules
const getDebugLog = () => window.DOMHelpers?.debugLog || (() => {});
const debugLog = getDebugLog();

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
 * Get IQ color based on score (desaturated for elegant appearance)
 */
function getIQColor(iq) {
  // Gradient from 55 (red) to 145+ (green)
  let baseColor;

  if (iq < 70) {
    baseColor = '#d32f2f';
  } else if (iq < 80) {
    const t = (iq - 70) / 10;
    baseColor = interpolateColor('#d32f2f', '#f57c00', t);
  } else if (iq < 90) {
    const t = (iq - 80) / 10;
    baseColor = interpolateColor('#f57c00', '#fb8c00', t);
  } else if (iq < 95) {
    const t = (iq - 90) / 5;
    baseColor = interpolateColor('#fb8c00', '#fbc02d', t);
  } else if (iq < 105) {
    const t = (iq - 95) / 10;
    baseColor = interpolateColor('#fbc02d', '#fdd835', t);
  } else if (iq < 115) {
    const t = (iq - 105) / 10;
    baseColor = interpolateColor('#fdd835', '#c5e1a5', t);
  } else if (iq < 125) {
    const t = (iq - 115) / 10;
    baseColor = interpolateColor('#c5e1a5', '#81c784', t);
  } else if (iq < 135) {
    const t = (iq - 125) / 10;
    baseColor = interpolateColor('#81c784', '#66bb6a', t);
  } else if (iq < 145) {
    const t = (iq - 135) / 10;
    baseColor = interpolateColor('#66bb6a', '#4caf50', t);
  } else {
    baseColor = '#2e7d32';
  }

  // Desaturate the color for a more elegant appearance
  let rgb;
  if (baseColor.startsWith('rgb')) {
    const match = baseColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      rgb = { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) };
    } else {
      rgb = { r: 0, g: 0, b: 0 };
    }
  } else {
    rgb = hexToRgb(baseColor);
  }
  const desat = desaturateColor(rgb, 0.5);
  return `rgb(${desat.r}, ${desat.g}, ${desat.b})`;
}

/**
 * Create loading badge while IQ is being calculated
 */
function createLoadingBadge() {
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

  badge.style.setProperty('background-color', '#9e9e9e', 'important');
  badge.style.setProperty('color', '#000000', 'important');
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
 * Create IQ badge element with debug data attached
 */
function createIQBadge(iq, estimationResult, tweetText) {
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

  if (confidence === null) {
    badge.addEventListener('mouseenter', () => {
      logDebugInfo(badge._debugData);
    });
  }

  return badge;
}

/**
 * Update badge HTML structure to support flip animation showing confidence
 */
function updateBadgeWithFlipStructure(badge, iq, confidence) {
  if (badge.classList.contains('iq-badge-loading') || badge.hasAttribute('data-iq-loading')) {
    return;
  }

  if (badge.querySelector('.iq-badge-inner')) {
    const frontScore = badge.querySelector('.iq-badge-front .iq-score');
    const backLabel = badge.querySelector('.iq-badge-back .iq-label');
    const backScore = badge.querySelector('.iq-badge-back .iq-score');

    if (frontScore) frontScore.textContent = iq;
    if (backLabel) backLabel.textContent = '%';
    if (backScore) backScore.textContent = confidence;

    const inner = badge.querySelector('.iq-badge-inner');
    if (inner) {
      inner.style.transform = 'rotateY(0deg)';
      inner.style.transformStyle = 'preserve-3d';
      inner.style.margin = '0';
      inner.style.padding = '0';
    }

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

  const currentLabel = badge.querySelector('.iq-label');
  const currentScore = badge.querySelector('.iq-score');
  const labelText = currentLabel ? currentLabel.textContent : 'IQ';
  const scoreText = currentScore ? currentScore.textContent : String(iq);

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

  badge.classList.add('iq-badge-flip');

  const inner = badge.querySelector('.iq-badge-inner');
  if (inner) {
    inner.style.removeProperty('transform');
    inner.style.setProperty('transform-style', 'preserve-3d', 'important');
    inner.style.margin = '0';
    inner.style.padding = '0';
  }

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
 * Trigger pulse animation with color transition
 */
function triggerPulseAnimation(badge, iqColor) {
  let scoreElement = badge.querySelector('.iq-badge-front .iq-score') ||
                     badge.querySelector('.iq-score');
  if (!scoreElement) return;

  badge.classList.add('iq-badge-pulse');

  const startTime = Date.now();
  const duration = 300;

  function updateColor() {
    const elapsed = Date.now() - startTime;

    if (elapsed < duration) {
      if (elapsed < 150) {
        const t = elapsed / 150;
        const value = Math.floor(0 + (255 - 0) * t);
        scoreElement.style.color = `rgb(${value}, ${value}, ${value})`;
      } else {
        const t = (elapsed - 150) / 150;
        const value = Math.floor(255 + (0 - 255) * t);
        scoreElement.style.color = `rgb(${value}, ${value}, ${value})`;
      }
      requestAnimationFrame(updateColor);
    } else {
      scoreElement.style.color = '#000000';
      badge.classList.remove('iq-badge-pulse');
    }
  }

  updateColor();
}

/**
 * Animate count-up from 0 to final IQ, then pulse animation
 */
function animateCountUp(badge, finalIQ, iqColor) {
  if (badge.hasAttribute('data-iq-animating') || badge.hasAttribute('data-iq-animated')) {
    return;
  }

  const darkerRed = '#b71c1c';
  const rgb = hexToRgb(darkerRed);
  const desat = desaturateColor(rgb, 0.5);
  const loadingColor = `rgb(${desat.r}, ${desat.g}, ${desat.b})`;

  const finalColorRgb = parseColor(iqColor);

  function startAnimation() {
    if (badge.hasAttribute('data-iq-animating') || badge.hasAttribute('data-iq-animated')) {
      return;
    }

    badge.setAttribute('data-iq-animating', 'true');

    const scoreContainer = badge.querySelector('.iq-score');

    if (!scoreContainer) {
      badge.innerHTML = `
        <span class="iq-label">IQ</span>
        <span class="iq-score">${finalIQ}</span>
      `;
      badge.classList.remove('iq-badge-loading');
      badge.removeAttribute('data-iq-animating');
      badge.setAttribute('data-iq-animated', 'true');
      return;
    }

    const hasFlipStructure = badge.querySelector('.iq-badge-inner');
    let scoreElement;

    if (hasFlipStructure) {
      scoreElement = badge.querySelector('.iq-badge-front .iq-score');
      if (!scoreElement) {
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
      if (scoreContainer) {
        scoreContainer.innerHTML = '0';
        scoreElement = scoreContainer;
      } else {
        badge.innerHTML = `
          <span class="iq-label">IQ</span>
          <span class="iq-score">0</span>
        `;
        scoreElement = badge.querySelector('.iq-score');
      }
    }

    badge.classList.remove('iq-badge-loading');
    const spinner = badge.querySelector('.iq-loading-spinner');
    if (spinner) {
      spinner.remove();
    }

    const duration = 1200;
    const startTime = performance.now();
    let lastDisplayedIQ = -1;
    let animationFrameId = null;
    let lastUpdateTime = startTime;
    let freezeDetectionTime = startTime;
    const FREEZE_THRESHOLD = 150;
    let isShowingSpinner = false;
    let frozenAtIQ = -1;

    function updateNumber() {
      const now = performance.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const timeSinceLastUpdate = now - freezeDetectionTime;
      const isFrozen = timeSinceLastUpdate > FREEZE_THRESHOLD && lastDisplayedIQ >= 0 && lastDisplayedIQ < finalIQ && !isShowingSpinner;

      if (isFrozen && !isShowingSpinner) {
        frozenAtIQ = lastDisplayedIQ;
        isShowingSpinner = true;
        scoreElement.innerHTML = '<span class="iq-loading-spinner">↻</span>';
      }

      if (!isFrozen && isShowingSpinner) {
        isShowingSpinner = false;
        const resumeIQ = Math.min(frozenAtIQ + 1, finalIQ);
        lastDisplayedIQ = resumeIQ;
        frozenAtIQ = -1;
        scoreElement.textContent = resumeIQ;
        freezeDetectionTime = now;
      }

      const easedProgress = 1 - Math.pow(1 - progress, 3);
      let targetIQ = progress >= 1 ? finalIQ : Math.floor(easedProgress * finalIQ);

      const maxIncrement = Math.max(1, Math.ceil(finalIQ / 50));
      let currentIQ = lastDisplayedIQ === -1 ? 0 : lastDisplayedIQ;

      if (progress >= 1) {
        currentIQ = Math.min(currentIQ + maxIncrement, finalIQ);
        targetIQ = finalIQ;
      } else if (targetIQ > currentIQ) {
        const difference = targetIQ - currentIQ;
        if (difference > maxIncrement) {
          currentIQ = currentIQ + maxIncrement;
        } else {
          currentIQ = targetIQ;
        }
      } else {
        currentIQ = targetIQ;
      }

      const timeSinceLastUpdate2 = now - lastUpdateTime;
      const shouldForceUpdate = timeSinceLastUpdate2 > 50;

      if ((currentIQ !== lastDisplayedIQ || shouldForceUpdate || progress >= 0.95) && !isShowingSpinner) {
        if (progress >= 0.95 && currentIQ < finalIQ - 1) {
          currentIQ = Math.min(currentIQ + 1, finalIQ);
        }

        if (currentIQ > finalIQ) {
          currentIQ = finalIQ;
        }

        const willUpdate = currentIQ !== lastDisplayedIQ || shouldForceUpdate || progress >= 0.95;
        if (willUpdate) {
          scoreElement.textContent = currentIQ;
          lastDisplayedIQ = currentIQ;
          lastUpdateTime = now;
          freezeDetectionTime = now;
        }

        const currentColor = interpolateRgbColor(
          parseColor(loadingColor),
          finalColorRgb,
          easedProgress
        );
        badge.style.setProperty('background-color', currentColor, 'important');
      } else if (isShowingSpinner) {
        const currentColor = interpolateRgbColor(
          parseColor(loadingColor),
          finalColorRgb,
          easedProgress
        );
        badge.style.setProperty('background-color', currentColor, 'important');
      }

      const hasReachedFinal = lastDisplayedIQ >= finalIQ;

      if (!hasReachedFinal) {
        animationFrameId = requestAnimationFrame(updateNumber);
      } else {
        if (isShowingSpinner) {
          isShowingSpinner = false;
          const spinner = scoreElement.querySelector('.iq-loading-spinner');
          if (spinner) {
            spinner.remove();
          }
        }

        scoreElement.textContent = finalIQ;
        badge.style.setProperty('background-color', iqColor, 'important');

        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }

        badge.removeAttribute('data-iq-animating');
        badge.setAttribute('data-iq-animated', 'true');

        const confidenceAttr = badge.getAttribute('data-confidence');
        if (confidenceAttr !== null) {
          const confidence = parseInt(confidenceAttr, 10);
          updateBadgeWithFlipStructure(badge, finalIQ, confidence);
        }

        setTimeout(() => {
          triggerPulseAnimation(badge, iqColor);
        }, 200);
      }
    }

    updateNumber();
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        observer.disconnect();
        startAnimation();
      }
    });
  }, {
    threshold: 0.01,
    rootMargin: '50px'
  });

  observer.observe(badge);

  const rect = badge.getBoundingClientRect();
  const isVisible = rect.top < window.innerHeight + 50 && rect.bottom > -50;
  if (isVisible) {
    observer.disconnect();
    startAnimation();
  }
}

/**
 * Log comprehensive debug information to console
 */
function logDebugInfo(debugData) {
  const { iq, result, text, timestamp } = debugData;

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
        `color: ${getDimensionColor(dim)}; font-weight: bold;`
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
 * Create or update real-time IQ badge near the input area
 */
function createRealtimeBadge(inputElement, container) {
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

/**
 * Animate real-time badge update (count-up from current to new IQ)
 */
function animateRealtimeBadgeUpdate(badge, oldIQ, newIQ, iqColor) {
  if (badge._animationFrameId) {
    cancelAnimationFrame(badge._animationFrameId);
    badge._animationFrameId = null;
  }

  badge.removeAttribute('data-iq-animating');
  badge.removeAttribute('data-iq-animated');

  const darkerRed = '#b71c1c';
  const rgb = hexToRgb(darkerRed);
  const desat = desaturateColor(rgb, 0.5);
  const loadingColor = `rgb(${desat.r}, ${desat.g}, ${desat.b})`;

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

  const startIQ = oldIQ >= 0 ? oldIQ : 0;
  scoreElement.textContent = String(startIQ);

  let startColorRgb;
  if (oldIQ < 0) {
    startColorRgb = parseColor(loadingColor);
    badge.style.setProperty('background-color', loadingColor, 'important');
  } else {
    const currentBgColor = badge.style.backgroundColor || loadingColor;
    startColorRgb = parseColor(currentBgColor);
  }

  const finalColorRgb = parseColor(iqColor);

  let currentIQ = startIQ;
  badge.setAttribute('data-iq-animating', 'true');

  const duration = 800;
  const startTime = performance.now();
  let lastDisplayedIQ = startIQ;

  function updateNumber() {
    const now = performance.now();
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);

    const easedProgress = 1 - Math.pow(1 - progress, 3);
    const iqDiff = newIQ - startIQ;
    const targetIQ = startIQ + Math.floor(easedProgress * iqDiff);
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

    if ((iqDiff > 0 && currentIQ > newIQ) || (iqDiff < 0 && currentIQ < newIQ)) {
      currentIQ = newIQ;
    }

    const currentColor = interpolateRgbColor(
      startColorRgb,
      finalColorRgb,
      easedProgress
    );
    badge.style.setProperty('background-color', currentColor, 'important');

    let currentScoreElement = badge.querySelector('.iq-badge-front .iq-score') ||
                               badge.querySelector('.iq-score');

    if (currentIQ !== lastDisplayedIQ) {
      if (currentScoreElement) {
        currentScoreElement.textContent = Math.max(0, Math.round(currentIQ));
        lastDisplayedIQ = currentIQ;
        scoreElement = currentScoreElement;
      } else {
        debugLog('[Real-time Badge Animation] WARNING: Score element lost during animation!');
        scoreElement = badge.querySelector('.iq-badge-front .iq-score') ||
                       badge.querySelector('.iq-score');
        if (scoreElement) {
          scoreElement.textContent = Math.max(0, Math.round(currentIQ));
          lastDisplayedIQ = currentIQ;
        }
      }
    }

    if (progress < 1 || lastDisplayedIQ !== newIQ) {
      badge._animationFrameId = requestAnimationFrame(updateNumber);
    } else {
      const finalScoreElement = badge.querySelector('.iq-badge-front .iq-score') ||
                                badge.querySelector('.iq-score');
      if (finalScoreElement) {
        finalScoreElement.textContent = newIQ;
      } else {
        debugLog('[Real-time Badge Animation] ERROR: Could not find score element for final update!');
        const fallbackScore = badge.querySelector('.iq-score');
        if (fallbackScore) {
          fallbackScore.textContent = newIQ;
        }
      }

      badge.style.setProperty('background-color', iqColor, 'important');
      badge.removeAttribute('data-iq-animating');
      badge.setAttribute('data-iq-animated', 'true');
      badge._animationFrameId = null;

      setTimeout(() => {
        triggerPulseAnimation(badge, iqColor);
      }, 100);
    }
  }

  requestAnimationFrame(() => {
    updateNumber();
  });
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.BadgeManager = {
    getIQColor,
    hexToRgb,
    interpolateColor,
    desaturateColor,
    parseColor,
    interpolateRgbColor,
    createLoadingBadge,
    createInvalidBadge,
    createIQBadge,
    updateBadgeWithFlipStructure,
    triggerPulseAnimation,
    animateCountUp,
    logDebugInfo,
    getDimensionColor,
    createRealtimeBadge,
    animateRealtimeBadgeUpdate
  };
}

})();

