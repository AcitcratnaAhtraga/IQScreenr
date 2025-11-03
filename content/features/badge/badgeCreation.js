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

  console.groupCollapsed('%c📝 Original Text', 'color: #FF9800; font-weight: bold;');
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
    console.groupCollapsed('%c📊 Dimension Breakdown (Weighted Combination)', 'color: #2196F3; font-weight: bold;');

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

  console.groupCollapsed('%c🔍 Feature Extraction Details', 'color: #00BCD4; font-weight: bold;');
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

  console.groupCollapsed('%c🧮 Calculation Summary', 'color: #795548; font-weight: bold;');
  console.log(`Weighted Average Formula:`);

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

  if (result.dimension_scores) {
    const calculated =
      (result.dimension_scores.vocabulary_sophistication || 100) * weights.vocabulary_sophistication +
      (result.dimension_scores.lexical_diversity || 100) * weights.lexical_diversity +
      (result.dimension_scores.sentence_complexity || 100) * weights.sentence_complexity +
      (result.dimension_scores.grammatical_precision || 100) * weights.grammatical_precision;
    console.log(`  IQ = (Vocab × ${(weights.vocabulary_sophistication * 100).toFixed(0)}% + Diversity × ${(weights.lexical_diversity * 100).toFixed(0)}% + Sentence × ${(weights.sentence_complexity * 100).toFixed(0)}% + Grammar × ${(weights.grammatical_precision * 100).toFixed(0)}%)`);
    console.log(`  = (${(result.dimension_scores.vocabulary_sophistication || 100).toFixed(1)} × ${weights.vocabulary_sophistication.toFixed(2)}) + ` +
                `(${(result.dimension_scores.lexical_diversity || 100).toFixed(1)} × ${weights.lexical_diversity.toFixed(2)}) + ` +
                `(${(result.dimension_scores.sentence_complexity || 100).toFixed(1)} × ${weights.sentence_complexity.toFixed(2)}) + ` +
                `(${(result.dimension_scores.grammatical_precision || 100).toFixed(1)} × ${weights.grammatical_precision.toFixed(2)})`);
    console.log(`  = ${calculated.toFixed(2)} → Final: ${iq.toFixed(1)}`);
    console.log(`  %cNote: IQ score is length-independent - quality matters, not quantity`, 'color: #666; font-style: italic;');
  }
  console.groupEnd();

  console.groupCollapsed('%c📊 Confidence Calculation (Anti-Gaming)', 'color: #9C27B0; font-weight: bold;');
  if (result.confidence !== undefined && result.confidence !== null) {
    const wordCount = features.word_count || tokens.length;
    const sentenceCount = features.sentence_count || sentences.length;
    const uniqueWords = new Set(tokens.map(t => t.toLowerCase().replace(/[^\w]/g, ''))).size;
    const actualTTR = tokens.length > 0 ? uniqueWords / tokens.length : 0;

    // Calculate dimension agreement
    let agreementInfo = 'N/A';
    let agreementScore = 'N/A';
    if (result.dimension_scores) {
      const iqValues = Object.values(result.dimension_scores);
      if (iqValues.length >= 4) {
        const mean = iqValues.reduce((a, b) => a + b, 0) / iqValues.length;
        const variance = iqValues.reduce((sum, iq) => sum + Math.pow(iq - mean, 2), 0) / iqValues.length;
        const stdDev = Math.sqrt(variance);
        agreementInfo = `${stdDev.toFixed(2)}`;
        // Calculate agreement score using same formula as confidence calculation
        if (stdDev <= 3) {
          agreementScore = (100 - (stdDev * 3)).toFixed(1);
        } else if (stdDev <= 5) {
          agreementScore = (91 - ((stdDev - 3) * 3)).toFixed(1);
        } else if (stdDev <= 10) {
          agreementScore = (85 - ((stdDev - 5) * 5)).toFixed(1);
        } else if (stdDev <= 15) {
          agreementScore = (60 - ((stdDev - 10) * 4)).toFixed(1);
        } else {
          agreementScore = Math.max(20, (40 - ((stdDev - 15) * 1.33))).toFixed(1);
        }
      }
    }

    // Calculate signal quality components
    let signalQualityComponents = [];
    let signalQualityScore = 0;

    // TTR component (0-25 points)
    if (actualTTR >= 0.8) {
      signalQualityComponents.push(`TTR Diversity: 25 pts (TTR=${actualTTR.toFixed(2)}, extremely diverse)`);
      signalQualityScore += 25;
    } else if (actualTTR >= 0.7) {
      signalQualityComponents.push(`TTR Diversity: 20 pts (TTR=${actualTTR.toFixed(2)}, very diverse)`);
      signalQualityScore += 20;
    } else if (actualTTR >= 0.6) {
      signalQualityComponents.push(`TTR Diversity: 15 pts (TTR=${actualTTR.toFixed(2)}, good diversity)`);
      signalQualityScore += 15;
    } else if (actualTTR >= 0.5) {
      signalQualityComponents.push(`TTR Diversity: 10 pts (TTR=${actualTTR.toFixed(2)}, moderate)`);
      signalQualityScore += 10;
    } else if (actualTTR >= 0.4) {
      signalQualityComponents.push(`TTR Diversity: 5 pts (TTR=${actualTTR.toFixed(2)}, low diversity)`);
      signalQualityScore += 5;
    } else {
      signalQualityComponents.push(`TTR Diversity: 0 pts (TTR=${actualTTR.toFixed(2)}, repetitive)`);
    }

    // Sentence variety component (0-15 points)
    const sentenceVariance = features.sentence_variance || 0;
    if (sentenceCount >= 5 && sentenceVariance > 3) {
      signalQualityComponents.push(`Sentence Variety: 15 pts (${sentenceCount} sentences, variance=${sentenceVariance.toFixed(2)})`);
      signalQualityScore += 15;
    } else if (sentenceCount >= 3 && sentenceVariance > 2) {
      signalQualityComponents.push(`Sentence Variety: 10 pts (${sentenceCount} sentences, variance=${sentenceVariance.toFixed(2)})`);
      signalQualityScore += 10;
    } else if (sentenceCount >= 2) {
      signalQualityComponents.push(`Sentence Variety: 5 pts (${sentenceCount} sentences)`);
      signalQualityScore += 5;
    } else {
      signalQualityComponents.push(`Sentence Variety: 0 pts (single sentence)`);
    }

    // AoA sophistication component (0-15 points)
    const meanAoa = features.mean_aoa || 0;
    if (meanAoa >= 10) {
      signalQualityComponents.push(`Vocabulary Sophistication: 15 pts (AoA=${meanAoa.toFixed(2)}, very advanced)`);
      signalQualityScore += 15;
    } else if (meanAoa >= 8) {
      signalQualityComponents.push(`Vocabulary Sophistication: 10 pts (AoA=${meanAoa.toFixed(2)}, moderate)`);
      signalQualityScore += 10;
    } else if (meanAoa >= 6) {
      signalQualityComponents.push(`Vocabulary Sophistication: 5 pts (AoA=${meanAoa.toFixed(2)}, some sophistication)`);
      signalQualityScore += 5;
    } else {
      signalQualityComponents.push(`Vocabulary Sophistication: 0 pts (AoA=${meanAoa.toFixed(2)}, basic)`);
    }

    // Sample size penalty
    let sampleSizePenalty = 0;
    if (wordCount < 15) {
      sampleSizePenalty = 15;
    } else if (wordCount < 25) {
      sampleSizePenalty = 10;
    } else if (wordCount < 50) {
      sampleSizePenalty = 5;
    }

    const signalQualityAfterPenalty = Math.max(0, signalQualityScore - sampleSizePenalty);
    const signalQualityNormalized = Math.min(100, (signalQualityAfterPenalty / 55) * 100);

    // Sample size constraint multiplier
    let sampleSizeConstraint = 1.0;
    let constraintNote = '';
    if (wordCount < 100) {
      const logFactor = Math.log(wordCount + 1) / Math.log(101);
      sampleSizeConstraint = 0.35 + (logFactor * 0.65);
      constraintNote = ` (logarithmic scaling: ${sampleSizeConstraint.toFixed(3)}x)`;
    }

    // Feature reliability
    let featureReliability = 30;
    if (features.aoa_match_rate !== undefined) {
      const matchRate = features.aoa_match_rate;
      if (matchRate >= 80) {
        featureReliability = 90;
      } else if (matchRate >= 65) {
        featureReliability = 70;
      } else if (matchRate >= 50) {
        featureReliability = 50;
      } else if (matchRate >= 35) {
        featureReliability = 35;
      } else {
        featureReliability = 25;
      }
    }

    // Check feature completeness
    const hasReadability = features.readability && Object.keys(features.readability).length > 0;
    const hasDiversityMetrics = features.ttr !== undefined && features.mtld !== undefined;
    const hasGrammarMetrics = features.avg_dependency_depth !== undefined || features.punctuation_complexity !== undefined;
    if (hasReadability && hasDiversityMetrics && hasGrammarMetrics) {
      featureReliability = Math.min(100, featureReliability + 10);
    } else if ((hasReadability && hasDiversityMetrics) || (hasReadability && hasGrammarMetrics) || (hasDiversityMetrics && hasGrammarMetrics)) {
      featureReliability = Math.min(100, featureReliability + 5);
    }

    console.log(`%cConfidence: ${result.confidence.toFixed(1)}%`, 'font-size: 16px; font-weight: bold; color: #7B1FA2;');
    console.log('');
    console.log(`%c1. Signal Quality (40% weight):`, 'font-weight: bold; color: #2196F3;');
    signalQualityComponents.forEach(comp => console.log(`  ${comp}`));
    if (sampleSizePenalty > 0) {
      console.log(`  %cSample Size Penalty: -${sampleSizePenalty} pts (${wordCount} words)`, 'color: #F44336;');
    }
    console.log(`  Raw Score: ${signalQualityScore} pts ${sampleSizePenalty > 0 ? `→ ${signalQualityAfterPenalty} pts after penalty` : ''}`);
    console.log(`  Normalized: ${signalQualityNormalized.toFixed(1)}%`);

    console.log('');
    console.log(`%c2. Dimension Agreement (40% weight):`, 'font-weight: bold; color: #4CAF50;');
    if (result.dimension_scores) {
      const iqValues = Object.values(result.dimension_scores);
      if (iqValues.length >= 4) {
        const mean = iqValues.reduce((a, b) => a + b, 0) / iqValues.length;
        console.log(`  Standard Deviation: ${agreementInfo}`);
        console.log(`  Agreement Score: ${agreementScore}%`);
        console.log(`    → Lower stdDev = higher agreement = more reliable`);
        console.log(`    → Dimensions: Vocab=${(result.dimension_scores.vocabulary_sophistication || 0).toFixed(1)}, Diversity=${(result.dimension_scores.lexical_diversity || 0).toFixed(1)}, Sentence=${(result.dimension_scores.sentence_complexity || 0).toFixed(1)}, Grammar=${(result.dimension_scores.grammatical_precision || 0).toFixed(1)}`);
      } else {
        console.log(`  Insufficient dimensions for agreement calculation`);
      }
    }

    console.log('');
    console.log(`%c3. Feature Reliability (20% weight):`, 'font-weight: bold; color: #FF9800;');
    console.log(`  Dictionary Match Rate: ${features.aoa_match_rate?.toFixed(1) || 'N/A'}%`);
    console.log(`  Feature Completeness: ${hasReadability ? '✓' : '✗'} Readability, ${hasDiversityMetrics ? '✓' : '✗'} Diversity, ${hasGrammarMetrics ? '✓' : '✗'} Grammar`);
    console.log(`  Feature Reliability Score: ${featureReliability.toFixed(1)}%`);

    console.log('');
    console.log(`%c4. Sample Size Constraint:`, 'font-weight: bold; color: #9E9E9E;');
    console.log(`  Word Count: ${wordCount} words${constraintNote}`);
    console.log(`  Constraint Multiplier: ${sampleSizeConstraint.toFixed(3)}x`);
    console.log(`  %cNote: Length matters for confidence (not IQ) - more data = more reliable`, 'color: #666; font-style: italic;');

    console.log('');
    console.log(`%cCombined Calculation:`, 'font-weight: bold;');
    const calculatedConfidence = (signalQualityNormalized * 0.40) +
                                  (parseFloat(agreementScore) * 0.40) +
                                  (featureReliability * 0.20);
    const afterConstraint = calculatedConfidence * sampleSizeConstraint;
    console.log(`  = (Signal: ${signalQualityNormalized.toFixed(1)}% × 40%) + (Agreement: ${agreementScore}% × 40%) + (Features: ${featureReliability.toFixed(1)}% × 20%)`);
    console.log(`  = ${calculatedConfidence.toFixed(2)}%`);
    console.log(`  × Sample Size Constraint (${sampleSizeConstraint.toFixed(3)}x)`);
    console.log(`  = ${afterConstraint.toFixed(2)}%`);
    console.log(`  %c→ Final: ${result.confidence.toFixed(1)}%`, 'font-weight: bold; color: #7B1FA2;');
    console.log(`  %cAnti-Gaming: Confidence reflects signal quality & agreement, not just length`, 'color: #666; font-style: italic;');
  } else {
    console.log(`Confidence: N/A`);
  }
  console.groupEnd();

  console.groupCollapsed('%c📦 Full Result Object', 'color: #607D8B; font-weight: bold;');
  console.log(result);
  console.groupEnd();

  console.log(
    `%c⏰ Analyzed at: ${new Date(timestamp).toLocaleTimeString()}`,
    'color: #757575; font-style: italic;'
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
    badge.style.setProperty('color', '#000000', 'important');

    // Also set color on child elements to ensure it's applied
    const labelElement = badge.querySelector('.iq-label');
    const scoreElement = badge.querySelector('.iq-score');
    if (labelElement) {
      labelElement.style.setProperty('color', '#000000', 'important');
    }
    if (scoreElement) {
      scoreElement.style.setProperty('color', '#000000', 'important');
    }

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

    // Ensure color is set on child elements after innerHTML
    const labelElement = badge.querySelector('.iq-label');
    const scoreElement = badge.querySelector('.iq-score');
    if (labelElement) {
      labelElement.style.setProperty('color', '#000000', 'important');
    }
    if (scoreElement) {
      scoreElement.style.setProperty('color', '#000000', 'important');
    }

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

