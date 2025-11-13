/**
 * Badge Debug Logging
 * Log comprehensive debug information to console (on hover)
 */

(function() {
  'use strict';

  // Get dependencies
  const getColorUtils = () => window.BadgeColorUtils || {};

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
    // Get population norms for display (must match actual calculation)
    const vocabNorms = { mean: 9.02, stddev: 3.76 }; // From Kuperman AoA dictionary analysis
    const vocabZScore = features.mean_aoa !== undefined ? (features.mean_aoa - vocabNorms.mean) / vocabNorms.stddev : 0;
    const vocabCorrelation = 0.55; // Research-validated correlation
    let vocabIQFromZ = 100 + (vocabZScore * vocabCorrelation * 15);
    
    // Calculate advanced boost (must match _vocabularyIQ method exactly)
    const pctAdvanced = features.pct_advanced || 0;
    const matchRate = features.aoa_match_rate || 0;
    const isTweetLength = result.is_twitter_calibrated || false;
    const aoaDictionaryLoaded = features.aoa_match_rate !== undefined && features.aoa_match_rate !== null;
    
    // Advanced boost calculation (matches actual method)
    let advancedBoost = aoaDictionaryLoaded && matchRate > 50
      ? (pctAdvanced / 100) * 1.0  // Full boost with good dictionary coverage
      : (pctAdvanced / 100) * 0.8;  // Reduced boost with approximation
    // Twitter adjustment: 20% boost for word efficiency in constrained space
    if (isTweetLength) {
      advancedBoost *= 1.2;
    }
    const vocabIQWithBoost = vocabIQFromZ + advancedBoost;
    const finalVocabIQ = Math.max(50, Math.min(145, vocabIQWithBoost));
    
    console.log(`  Research-Validated Mapping (Z-Score Conversion):`);
    console.log(`    Population Norms: Mean AoA = ${vocabNorms.mean}, StdDev = ${vocabNorms.stddev}`);
    console.log(`    Z-Score: ${vocabZScore.toFixed(3)} = (${features.mean_aoa?.toFixed(2) || 'N/A'} - ${vocabNorms.mean}) / ${vocabNorms.stddev}`);
    console.log(`    Base IQ = 100 + (z-score × correlation × 15) = 100 + (${vocabZScore.toFixed(3)} × ${vocabCorrelation} × 15) = ${vocabIQFromZ.toFixed(1)}`);
    if (advancedBoost > 0) {
      console.log(`    Advanced Vocabulary Boost: +${advancedBoost.toFixed(2)} pts (${pctAdvanced.toFixed(1)}% advanced words${isTweetLength ? ', Twitter 20% bonus' : ''})`);
      console.log(`    = ${vocabIQFromZ.toFixed(1)} + ${advancedBoost.toFixed(2)} = ${vocabIQWithBoost.toFixed(1)}`);
    }
    console.log(`    Final Vocabulary IQ: ${finalVocabIQ.toFixed(1)} (clamped to 50-145)`);
    console.log(`    %cNote: Uses research-validated population norms and correlation coefficients`, 'color: #666; font-style: italic;');

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
    // Get population norms for display
    const diversityNorms = { mean: 0.65, stddev: 0.12 }; // Research-validated norms
    const diversityMetric = features.msttr || features.ttr || 0.5;
    const diversityZScore = (diversityMetric - diversityNorms.mean) / diversityNorms.stddev;
    const diversityCorrelation = 0.40; // Research-validated correlation
    const diversityIQFromZ = 100 + (diversityZScore * diversityCorrelation * 15);
    
    console.log(`  Research-Validated Mapping (Z-Score Conversion):`);
    console.log(`    Population Norms: Mean TTR/MSTTR = ${diversityNorms.mean}, StdDev = ${diversityNorms.stddev}`);
    console.log(`    Z-Score: ${diversityZScore.toFixed(3)} = (${diversityMetric.toFixed(4)} - ${diversityNorms.mean}) / ${diversityNorms.stddev}`);
    console.log(`    IQ = 100 + (z-score × correlation × 15) = 100 + (${diversityZScore.toFixed(3)} × ${diversityCorrelation} × 15) = ${diversityIQFromZ.toFixed(1)}`);
    console.log(`    %cNote: Uses research-validated population norms and correlation coefficients`, 'color: #666; font-style: italic;');

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
    // Get population norms for display
    const sentenceNorms = result.is_twitter_calibrated 
      ? { mean: 8.5, stddev: 3.0 }  // Twitter norms
      : { mean: 12.5, stddev: 4.5 }; // Essay norms
    const avgWords = features.avg_words_per_sentence || (sentences.length > 0 ? (tokens.length / sentences.length) : 0);
    const sentenceZScore = (avgWords - sentenceNorms.mean) / sentenceNorms.stddev;
    const sentenceCorrelation = 0.35; // Research-validated correlation
    const optimalityFactor = Math.max(0, 1 - Math.abs(sentenceZScore) * 0.3); // Diminishing returns for extremes
    const sentenceIQFromZ = 100 + (sentenceZScore * sentenceCorrelation * 15 * optimalityFactor);
    
    console.log(`  Research-Validated Mapping (Z-Score Conversion):`);
    console.log(`    Population Norms: Mean = ${sentenceNorms.mean} words/sentence, StdDev = ${sentenceNorms.stddev} ${result.is_twitter_calibrated ? '(Twitter-adjusted)' : '(Essay)'}`);
    console.log(`    Z-Score: ${sentenceZScore.toFixed(3)} = (${avgWords.toFixed(2)} - ${sentenceNorms.mean}) / ${sentenceNorms.stddev}`);
    console.log(`    Optimality Factor: ${optimalityFactor.toFixed(3)} (moderate complexity optimal)`);
    console.log(`    IQ = 100 + (z-score × correlation × 15 × optimality) = 100 + (${sentenceZScore.toFixed(3)} × ${sentenceCorrelation} × 15 × ${optimalityFactor.toFixed(3)}) = ${sentenceIQFromZ.toFixed(1)}`);
    console.log(`    %cNote: Uses research-validated population norms and correlation coefficients`, 'color: #666; font-style: italic;');

    // Run-on detection analysis for Sentence Complexity
    const sentenceCount = sentences.length;
    const punctuationMarks = (text.match(/[,;:.—-]/g) || []).length;
    const punctuationDensity = tokens.length > 0 ? punctuationMarks / tokens.length : 0;
    const casualConnectives = /\b(and\s+also|also\s+note|and\s+then|and\s+so|and\s+but)\b/gi;
    const casualConnectiveCount = (text.match(casualConnectives) || []).length;
    const startsWithCasual = /^(and\s+|also\s+|then\s+|so\s+)/i.test(text.trim());

    if (sentenceCount === 1 && avgWords > 15) {
      let runOnScore = 0;
      if (punctuationDensity < 0.05) {
        runOnScore += (avgWords - 15) * 0.5;
      } else if (punctuationDensity < 0.10) {
        runOnScore += (avgWords - 15) * 0.25;
      }
      if (startsWithCasual) runOnScore += 5;
      runOnScore += casualConnectiveCount * 3;

      if (runOnScore > 0) {
        const penaltyPercent = Math.min(0.6, runOnScore / 30);
          // Calculate using z-score conversion
        const sentenceNorms = result.is_twitter_calibrated ? { mean: 8.5, stddev: 3.0 } : { mean: 12.5, stddev: 4.5 };
        const sentenceZScore = (avgWords - sentenceNorms.mean) / sentenceNorms.stddev;
        const sentenceCorrelation = 0.35;
        const optimalityFactor = Math.max(0, 1 - Math.abs(sentenceZScore) * 0.3);
        const originalIQ = 100 + (sentenceZScore * sentenceCorrelation * 15 * optimalityFactor);
        const adjustedIQ = originalIQ * (1 - penaltyPercent);

        console.log(`  %c🚫 Run-on Detection (Twitter Casual Pattern):`, 'font-weight: bold; color: #F44336;');
        console.log(`    Punctuation Density: ${(punctuationDensity * 100).toFixed(1)}% ${punctuationDensity < 0.05 ? '(VERY LOW - likely run-on)' : punctuationDensity < 0.10 ? '(Low - possibly run-on)' : ''}`);
        console.log(`    Starts with casual connective: ${startsWithCasual ? 'Yes' : 'No'}`);
        console.log(`    Casual connective patterns: ${casualConnectiveCount}`);
        console.log(`    Run-on Score: ${runOnScore.toFixed(1)} → Penalty: ${(penaltyPercent * 100).toFixed(1)}%`);
        console.log(`    Base IQ: ${originalIQ.toFixed(1)} → After penalty: ${adjustedIQ.toFixed(1)}`);
        console.log(`    %cNote: Casual Twitter run-ons are penalized - they indicate stream-of-consciousness writing, not sophistication`, 'color: #666; font-style: italic;');
      }
    }

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
      const originalDepDepth = features.avg_dependency_depth;
      console.log(`  Average Dependency Depth: ${originalDepDepth.toFixed(3)}`);
      console.log(`    → Enhanced approximation (calibrated against Python spaCy results)`);
      console.log(`    → Uses: punctuation, clauses, relative clauses, sentence length, prepositions`);
      
      // Get population norms for display
      const grammarNorms = { mean: 1.95, stddev: 0.35 }; // Research-validated norms
      const grammarZScore = (originalDepDepth - grammarNorms.mean) / grammarNorms.stddev;
      const grammarCorrelation = 0.45; // Research-validated correlation
      const grammarIQFromZ = 100 + (grammarZScore * grammarCorrelation * 15);
      
      console.log(`  Research-Validated Mapping (Z-Score Conversion):`);
      console.log(`    Population Norms: Mean Dependency Depth = ${grammarNorms.mean}, StdDev = ${grammarNorms.stddev}`);
      console.log(`    Z-Score: ${grammarZScore.toFixed(3)} = (${originalDepDepth.toFixed(3)} - ${grammarNorms.mean}) / ${grammarNorms.stddev}`);
      let grammarIQWithBoosts = grammarIQFromZ;
      
      // Show punctuation entropy boost (if applicable)
      const punctEntropy = features.punctuation_entropy || 0;
      const originalTextForGrammar = result.features?.original_text || text || '';
      const wordCountForGrammar = features.word_count || tokens.length;
      const parentheticalCount = (originalTextForGrammar.match(/\([^)]+\)/g) || []).length;
      const parentheticalRatio = wordCountForGrammar > 0 ? parentheticalCount / wordCountForGrammar : 0;
      if (punctEntropy > 2.0) {
        let entropyBoost = (punctEntropy - 2.0) * 1.0;
        if (parentheticalRatio > 0.05) {
          entropyBoost *= (1 - parentheticalRatio * 10);
        }
        const finalEntropyBoost = Math.min(4, Math.max(0, entropyBoost));
        if (finalEntropyBoost > 0) {
          grammarIQWithBoosts += finalEntropyBoost;
          console.log(`    Punctuation Entropy Boost: +${finalEntropyBoost.toFixed(2)} pts (entropy=${punctEntropy.toFixed(2)}${parentheticalRatio > 0.05 ? `, reduced for parenthetical-heavy text` : ''})`);
        }
      }
      
      // Show connective density boost (if applicable)
      const connectiveDensity = features.connective_density || 0;
      if (connectiveDensity > 0.08 && connectiveDensity < 0.20) {
        const connectiveBoost = Math.min(3, (connectiveDensity - 0.08) * 25);
        grammarIQWithBoosts += connectiveBoost;
        console.log(`    Connective Density Boost: +${connectiveBoost.toFixed(2)} pts (density=${connectiveDensity.toFixed(4)}, optimal range)`);
      }
      
      const finalGrammarIQ = Math.max(50, Math.min(145, grammarIQWithBoosts));
      console.log(`    Base IQ = 100 + (z-score × correlation × 15) = 100 + (${grammarZScore.toFixed(3)} × ${grammarCorrelation} × 15) = ${grammarIQFromZ.toFixed(1)}`);
      if (grammarIQWithBoosts !== grammarIQFromZ) {
        console.log(`    With boosts: ${grammarIQWithBoosts.toFixed(1)}`);
      }
      console.log(`    Final Grammar IQ: ${finalGrammarIQ.toFixed(1)} (clamped to 50-145)`);

      // Show run-on adjustments for dependency depth
      const avgWordsForGrammar = features.avg_words_per_sentence || (sentences.length > 0 ? (tokens.length / sentences.length) : 0);
      const sentenceCountForGrammar = sentences.length;
      if (sentenceCountForGrammar === 1 && avgWordsForGrammar > 15) {
        let depthPenalty = 0;
        let iqPenalty = 0;

        if (punctuationDensity < 0.05) {
          depthPenalty = (avgWordsForGrammar - 15) * 0.03;
          iqPenalty += (avgWordsForGrammar - 15) * 1.5;
        } else if (punctuationDensity < 0.10) {
          depthPenalty = (avgWordsForGrammar - 15) * 0.015;
          iqPenalty += (avgWordsForGrammar - 15) * 0.75;
        }

        if (startsWithCasual) {
          depthPenalty += 0.25;
          iqPenalty += 15;
        }
        depthPenalty += casualConnectiveCount * 0.12;
        iqPenalty += casualConnectiveCount * 8;

        if (depthPenalty > 0 || iqPenalty > 0) {
          const adjustedDepth = Math.max(1.795, originalDepDepth - depthPenalty); // Use 1.795 as minimum (matches actual code)
          // Calculate using z-score conversion (must match actual calculation)
          const grammarNorms = { mean: 1.95, stddev: 0.35 };
          const grammarCorrelation = 0.45;
          const originalGrammarZScore = (originalDepDepth - grammarNorms.mean) / grammarNorms.stddev;
          const adjustedGrammarZScore = (adjustedDepth - grammarNorms.mean) / grammarNorms.stddev;
          const originalGrammarIQ = 100 + (originalGrammarZScore * grammarCorrelation * 15);
          let adjustedGrammarIQ = 100 + (adjustedGrammarZScore * grammarCorrelation * 15);
          // Apply direct IQ penalty for run-ons
          adjustedGrammarIQ = Math.max(50, adjustedGrammarIQ - iqPenalty);

          console.log(`  %c🚫 Run-on Adjustment (Dependency Depth):`, 'font-weight: bold; color: #F44336;');
          console.log(`    Depth Penalty: ${depthPenalty.toFixed(3)} → Adjusted Depth: ${adjustedDepth.toFixed(3)}`);
          console.log(`    Direct IQ Penalty: ${iqPenalty.toFixed(1)} points`);
          console.log(`    Base Grammar IQ: ${originalGrammarIQ.toFixed(1)} → After depth adjustment: ${(100 + (adjustedGrammarZScore * grammarCorrelation * 15)).toFixed(1)} → After IQ penalty: ${adjustedGrammarIQ.toFixed(1)}`);
          console.log(`    %cNote: High dependency depth from run-ons (lack of punctuation) is penalized`, 'color: #666; font-style: italic;');
        }
      }
    }
    if (features.avg_dependency_depth === undefined) {
      const grammarNorms = { mean: 1.95, stddev: 0.35 }; // Research-validated norms
      console.log(`  Research-Validated Mapping (Z-Score Conversion):`);
      console.log(`    Population Norms: Mean Dependency Depth = ${grammarNorms.mean}, StdDev = ${grammarNorms.stddev}`);
      console.log(`    IQ = 100 + (z-score × correlation × 15) where correlation = 0.45`);
      console.log(`    %cNote: Uses research-validated population norms and correlation coefficients`, 'color: #666; font-style: italic;');
    }

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
      console.log(`  = ${calculated.toFixed(2)}`);
      console.log(`  %cNote: This is the weighted combination. Final IQ may include additional adjustments from final calibration pass (sophisticated content bonuses, high-IQ calibration, etc.)`, 'color: #666; font-style: italic;');
      console.log(`  Final IQ (after all adjustments): ${iq.toFixed(1)}`);
      if (Math.abs(calculated - iq) > 2) {
        console.log(`  %c⚠️ Note: Final IQ differs from weighted combination by ${Math.abs(calculated - iq).toFixed(1)} points due to final calibration adjustments`, 'color: #FF9800; font-style: italic;');
      }

      // Show run-on penalty notice if applicable
      const hasRunOnPenalty = (sentenceCount === 1 && avgWords > 15 &&
                               (punctuationDensity < 0.10 || startsWithCasual || casualConnectiveCount > 0));
      if (hasRunOnPenalty) {
        console.log(`  %c⚠️ Run-on penalties applied: Casual Twitter patterns reduce sentence complexity and grammar scores`, 'color: #FF9800; font-style: italic;');
      }
    }
    console.groupEnd();

    console.groupCollapsed('%c📊 Confidence Calculation', 'color: #9C27B0; font-weight: bold;');
    if (result.confidence !== undefined && result.confidence !== null) {
      const wordCount = features.word_count || tokens.length;
      const sentenceCount = features.sentence_count || sentences.length;
      const uniqueWords = new Set(tokens.map(t => t.toLowerCase().replace(/[^\w]/g, ''))).size;
      const actualTTR = tokens.length > 0 ? uniqueWords / tokens.length : 0;

      // Calculate dimension agreement (must match actual calculation with updated values)
      let agreementInfo = 'N/A';
      let agreementScore = 50; // Updated default to match actual calculation
      if (result.dimension_scores) {
        const iqValues = Object.values(result.dimension_scores);
        if (iqValues.length >= 4) {
          const mean = iqValues.reduce((a, b) => a + b, 0) / iqValues.length;
          const variance = iqValues.reduce((sum, iq) => sum + Math.pow(iq - mean, 2), 0) / iqValues.length;
          const stdDev = Math.sqrt(variance);
          agreementInfo = `${stdDev.toFixed(2)}`;
          // Calculate agreement score using updated formula (must match actual calculation)
          if (stdDev <= 3) {
            agreementScore = 100 - (stdDev * 2); // Updated: was * 3, now * 2
          } else if (stdDev <= 5) {
            agreementScore = 94 - ((stdDev - 3) * 2); // Updated: was 91 - * 3, now 94 - * 2
          } else if (stdDev <= 10) {
            agreementScore = 90 - ((stdDev - 5) * 4); // Updated: was 85 - * 5, now 90 - * 4
          } else if (stdDev <= 15) {
            agreementScore = 70 - ((stdDev - 10) * 3); // Updated: was 60 - * 4, now 70 - * 3
          } else {
            agreementScore = Math.max(40, 55 - ((stdDev - 15) * 1)); // Updated: was min 20, now min 40
          }
          agreementScore = agreementScore.toFixed(1);
        }
      }

      // Calculate signal quality components using validated intelligence metrics
      let signalQualityComponents = [];
      let signalQualityScore = 0;

      // Enhanced vocabulary diversity (0-25 points) using multiple validated metrics
      const mtld = features.mtld || 0;
      const yulesK = features.yules_k || 0;
      const msttr = features.msttr || actualTTR;
      const bestTTR = Math.max(actualTTR, msttr);
      
      let diversityScore = 0;
      if (bestTTR >= 0.8 || mtld > 60) {
        diversityScore = 25;
        signalQualityComponents.push(`Vocabulary Diversity: 25 pts (TTR=${actualTTR.toFixed(2)}, MSTTR=${msttr.toFixed(2)}, MTLD=${mtld.toFixed(1)}, extremely diverse)`);
      } else if (bestTTR >= 0.7 || mtld > 50) {
        diversityScore = 20;
        signalQualityComponents.push(`Vocabulary Diversity: 20 pts (TTR=${actualTTR.toFixed(2)}, MSTTR=${msttr.toFixed(2)}, MTLD=${mtld.toFixed(1)}, very diverse)`);
      } else if (bestTTR >= 0.6 || mtld > 40) {
        diversityScore = 15;
        signalQualityComponents.push(`Vocabulary Diversity: 15 pts (TTR=${actualTTR.toFixed(2)}, MSTTR=${msttr.toFixed(2)}, MTLD=${mtld.toFixed(1)}, good diversity)`);
      } else if (bestTTR >= 0.5 || mtld > 30) {
        diversityScore = 10;
        signalQualityComponents.push(`Vocabulary Diversity: 10 pts (TTR=${actualTTR.toFixed(2)}, MSTTR=${msttr.toFixed(2)}, MTLD=${mtld.toFixed(1)}, moderate)`);
      } else if (bestTTR >= 0.4 || mtld > 20) {
        diversityScore = 5;
        signalQualityComponents.push(`Vocabulary Diversity: 5 pts (TTR=${actualTTR.toFixed(2)}, MSTTR=${msttr.toFixed(2)}, MTLD=${mtld.toFixed(1)}, low diversity)`);
      } else {
        diversityScore = 0;
        signalQualityComponents.push(`Vocabulary Diversity: 0 pts (TTR=${actualTTR.toFixed(2)}, MSTTR=${msttr.toFixed(2)}, MTLD=${mtld.toFixed(1)}, repetitive)`);
      }
      
      // Yule's K bonus (vocabulary richness - validated metric)
      let yulesBonus = 0;
      if (yulesK > 0 && yulesK < 80) {
        yulesBonus = 3;
        signalQualityComponents.push(`  + Yule's K Bonus: +3 pts (Yule's K=${yulesK.toFixed(1)}, excellent richness)`);
      } else if (yulesK >= 80 && yulesK < 120) {
        yulesBonus = 2;
        signalQualityComponents.push(`  + Yule's K Bonus: +2 pts (Yule's K=${yulesK.toFixed(1)}, good richness)`);
      } else if (yulesK >= 120 && yulesK < 200) {
        yulesBonus = 1;
        signalQualityComponents.push(`  + Yule's K Bonus: +1 pt (Yule's K=${yulesK.toFixed(1)}, moderate richness)`);
      }
      
      signalQualityScore += Math.min(25, diversityScore + yulesBonus);

      // Enhanced sentence complexity (0-20 points) using validated metrics
      const sentenceVariance = features.sentence_variance || 0;
      const subordinateClauses = features.subordinate_clauses || 0;
      const readability = features.readability || {};
      const fleschKincaid = readability.flesch_kincaid || 0;
      const clausesPerSentence = sentenceCount > 0 ? subordinateClauses / sentenceCount : 0;
      
      let sentenceComplexityScore = 0;
      if (sentenceCount >= 5 && sentenceVariance > 3) {
        sentenceComplexityScore = 15;
        signalQualityComponents.push(`Sentence Variety: 15 pts (${sentenceCount} sentences, variance=${sentenceVariance.toFixed(2)})`);
      } else if (sentenceCount >= 3 && sentenceVariance > 2) {
        sentenceComplexityScore = 10;
        signalQualityComponents.push(`Sentence Variety: 10 pts (${sentenceCount} sentences, variance=${sentenceVariance.toFixed(2)})`);
      } else if (sentenceCount >= 2) {
        sentenceComplexityScore = 5;
        signalQualityComponents.push(`Sentence Variety: 5 pts (${sentenceCount} sentences)`);
      } else {
        sentenceComplexityScore = 0;
        signalQualityComponents.push(`Sentence Variety: 0 pts (single sentence)`);
      }
      
      // Subordinate clauses bonus (grammatical sophistication - validated intelligence marker)
      if (clausesPerSentence >= 0.5) {
        sentenceComplexityScore += 3;
        signalQualityComponents.push(`  + Subordinate Clauses: +3 pts (${subordinateClauses.toFixed(1)} clauses, ${clausesPerSentence.toFixed(2)}/sentence, high complexity)`);
      } else if (clausesPerSentence >= 0.3) {
        sentenceComplexityScore += 2;
        signalQualityComponents.push(`  + Subordinate Clauses: +2 pts (${subordinateClauses.toFixed(1)} clauses, ${clausesPerSentence.toFixed(2)}/sentence, moderate complexity)`);
      } else if (clausesPerSentence >= 0.1) {
        sentenceComplexityScore += 1;
        signalQualityComponents.push(`  + Subordinate Clauses: +1 pt (${subordinateClauses.toFixed(1)} clauses, ${clausesPerSentence.toFixed(2)}/sentence, some complexity)`);
      }
      
      // Readability bonus (Flesch-Kincaid grade level - validated complexity measure)
      if (fleschKincaid >= 14 && sentenceCount >= 3) {
        sentenceComplexityScore += 2;
        signalQualityComponents.push(`  + Readability: +2 pts (Flesch-Kincaid=${fleschKincaid.toFixed(1)}, very sophisticated)`);
      } else if (fleschKincaid >= 12 && sentenceCount >= 2) {
        sentenceComplexityScore += 1;
        signalQualityComponents.push(`  + Readability: +1 pt (Flesch-Kincaid=${fleschKincaid.toFixed(1)}, sophisticated)`);
      }
      
      signalQualityScore += Math.min(20, sentenceComplexityScore);

      // Enhanced vocabulary sophistication (0-18 points) with pct_advanced bonus
      const meanAoa = features.mean_aoa || 0;
      const pctAdvanced = features.pct_advanced || 0;
      
      let sophisticationScore = 0;
      if (meanAoa >= 10) {
        sophisticationScore = 15;
        signalQualityComponents.push(`Vocabulary Sophistication: 15 pts (AoA=${meanAoa.toFixed(2)}, very advanced)`);
      } else if (meanAoa >= 8) {
        sophisticationScore = 10;
        signalQualityComponents.push(`Vocabulary Sophistication: 10 pts (AoA=${meanAoa.toFixed(2)}, moderate)`);
      } else if (meanAoa >= 6) {
        sophisticationScore = 5;
        signalQualityComponents.push(`Vocabulary Sophistication: 5 pts (AoA=${meanAoa.toFixed(2)}, some sophistication)`);
      } else {
        sophisticationScore = 0;
        signalQualityComponents.push(`Vocabulary Sophistication: 0 pts (AoA=${meanAoa.toFixed(2)}, basic)`);
      }
      
      // Percentage of advanced words bonus (validated intelligence marker)
      if (pctAdvanced >= 20) {
        sophisticationScore += 3;
        signalQualityComponents.push(`  + Advanced Words Bonus: +3 pts (${pctAdvanced.toFixed(1)}% advanced words, AoA>10)`);
      } else if (pctAdvanced >= 15) {
        sophisticationScore += 2;
        signalQualityComponents.push(`  + Advanced Words Bonus: +2 pts (${pctAdvanced.toFixed(1)}% advanced words)`);
      } else if (pctAdvanced >= 10) {
        sophisticationScore += 1;
        signalQualityComponents.push(`  + Advanced Words Bonus: +1 pt (${pctAdvanced.toFixed(1)}% advanced words)`);
      }
      
      signalQualityScore += Math.min(18, sophisticationScore);

      // Punctuation sophistication (punctuation entropy & complexity - validated metrics)
      const punctuationEntropy = features.punctuation_entropy || 0;
      const punctuationComplexity = features.punctuation_complexity || 0;
      let punctuationBonus = 0;
      
      if (punctuationEntropy > 2.0 && punctuationDensity > 0.08) {
        punctuationBonus += 3;
        signalQualityComponents.push(`Punctuation Sophistication: +3 pts (entropy=${punctuationEntropy.toFixed(2)}, sophisticated usage)`);
      } else if (punctuationEntropy > 1.5 && punctuationDensity > 0.05) {
        punctuationBonus += 2;
        signalQualityComponents.push(`Punctuation Sophistication: +2 pts (entropy=${punctuationEntropy.toFixed(2)}, good variety)`);
      } else if (punctuationEntropy > 1.0) {
        punctuationBonus += 1;
        signalQualityComponents.push(`Punctuation Sophistication: +1 pt (entropy=${punctuationEntropy.toFixed(2)}, some variety)`);
      }
      
      if (punctuationComplexity > 0.15) {
        punctuationBonus += 2;
        signalQualityComponents.push(`  + Punctuation Complexity: +2 pts (complexity=${punctuationComplexity.toFixed(2)}, high)`);
      } else if (punctuationComplexity > 0.10) {
        punctuationBonus += 1;
        signalQualityComponents.push(`  + Punctuation Complexity: +1 pt (complexity=${punctuationComplexity.toFixed(2)}, moderate)`);
      }
      
      signalQualityScore += punctuationBonus;
      
      // Logical flow (connective density - validated intelligence marker)
      const connectiveDensity = features.connective_density || 0;
      if (connectiveDensity >= 0.10 && connectiveDensity <= 0.20) {
        signalQualityScore += 2;
        signalQualityComponents.push(`Logical Flow: +2 pts (connective density=${connectiveDensity.toFixed(3)}, optimal range)`);
      } else if (connectiveDensity >= 0.08 && connectiveDensity < 0.25) {
        signalQualityScore += 1;
        signalQualityComponents.push(`Logical Flow: +1 pt (connective density=${connectiveDensity.toFixed(3)}, good flow)`);
      }
      
      // Coherence (lexical overlap - validated metric)
      const lexicalOverlap = features.lexical_overlap || 0;
      if (lexicalOverlap >= 0.15 && lexicalOverlap <= 0.35 && sentenceCount >= 2) {
        signalQualityScore += 2;
        signalQualityComponents.push(`Coherence: +2 pts (lexical overlap=${lexicalOverlap.toFixed(3)}, good coherence)`);
      } else if (lexicalOverlap >= 0.10 && lexicalOverlap <= 0.40 && sentenceCount >= 2) {
        signalQualityScore += 1;
        signalQualityComponents.push(`Coherence: +1 pt (lexical overlap=${lexicalOverlap.toFixed(3)}, moderate coherence)`);
      }
      
      // Run-on penalty (reduces signal quality for casual Twitter patterns)
      let runOnSignalPenalty = 0;
      const avgWordsForSignal = features.avg_words_per_sentence || (sentences.length > 0 ? (tokens.length / sentences.length) : 0);
      if (sentenceCount === 1 && avgWordsForSignal > 15 && punctuationDensity < 0.05) {
        runOnSignalPenalty = 5;
        signalQualityComponents.push(`%cRun-on Penalty: -5 pts (low punctuation density = casual pattern)`, 'color: #F44336;');
      }

      // Sample size penalty (must match actual calculation)
      let sampleSizePenalty = 0;
      if (wordCount < 15) {
        sampleSizePenalty = 10; // Updated to match actual: reduced from 15
      } else if (wordCount < 25) {
        sampleSizePenalty = 6; // Updated to match actual: reduced from 10
      } else if (wordCount < 50) {
        sampleSizePenalty = 3; // Updated to match actual: reduced from 5
      }

      const signalQualityAfterPenalty = Math.max(0, signalQualityScore - sampleSizePenalty - runOnSignalPenalty);
      // Updated normalization: max possible is ~65 with enhanced validated metrics
      const signalQualityNormalized = Math.min(100, (signalQualityAfterPenalty / 65) * 100);

      // Sample size constraint multiplier (must match actual calculation)
      let sampleSizeConstraint = 1.0;
      let constraintNote = '';
      if (wordCount < 100) {
        const logFactor = Math.log(wordCount + 1) / Math.log(101);
        sampleSizeConstraint = 0.55 + (logFactor * 0.45); // Updated to match actual: 0.55-1.0 range
        constraintNote = ` (logarithmic scaling: ${sampleSizeConstraint.toFixed(3)}x)`;
      }

      // Feature reliability (must match actual calculation exactly)
      // The actual code checks aoaDictionaryLoaded first, then matchRate
      // If dictionary is loaded but matchRate is 0, it's still "loaded" (just matched 0 words)
      // If matchRate is undefined/null, dictionary likely not loaded
      let featureReliability = 50; // Updated default to match actual calculation
      const matchRate = features.aoa_match_rate;
      const dictionaryLoaded = matchRate !== undefined && matchRate !== null; // Infer from matchRate presence
      
      if (dictionaryLoaded) {
        // Dictionary is loaded (matchRate could be 0% or higher)
        const actualMatchRate = matchRate || 0; // Treat null/undefined as 0
        if (actualMatchRate >= 80) {
          featureReliability = 95; // Updated to match actual
        } else if (actualMatchRate >= 65) {
          featureReliability = 80; // Updated to match actual
        } else if (actualMatchRate >= 50) {
          featureReliability = 65; // Updated to match actual
        } else if (actualMatchRate >= 35) {
          featureReliability = 50; // Updated to match actual
        } else {
          featureReliability = 40; // Updated to match actual (for matchRate < 35, including 0%)
        }
      } else {
        // No dictionary loaded or match rate not available
        featureReliability = 45; // Updated default when no dictionary
      }

      // Enhanced feature completeness check using validated intelligence metrics
      const hasReadability = features.readability && Object.keys(features.readability).length > 0;
      const hasDiversityMetrics = features.ttr !== undefined && features.mtld !== undefined && features.yules_k !== undefined;
      const hasGrammarMetrics = features.avg_dependency_depth !== undefined ||
                                features.punctuation_complexity !== undefined ||
                                features.punctuation_entropy !== undefined;
      const hasComplexityMetrics = features.subordinate_clauses !== undefined &&
                                   features.connective_density !== undefined &&
                                   features.lexical_overlap !== undefined;
      const hasAdvancedVocab = features.pct_advanced !== undefined && features.mean_aoa !== undefined;
      
      let completenessBonus = 0;
      if (hasReadability && hasDiversityMetrics && hasGrammarMetrics && hasComplexityMetrics && hasAdvancedVocab) {
        completenessBonus = 15;
        featureReliability = Math.min(100, featureReliability + 15);
      } else if ((hasReadability && hasDiversityMetrics && hasGrammarMetrics) ||
                 (hasDiversityMetrics && hasComplexityMetrics && hasAdvancedVocab) ||
                 (hasGrammarMetrics && hasComplexityMetrics && hasReadability)) {
        completenessBonus = 10;
        featureReliability = Math.min(100, featureReliability + 10);
      } else if ((hasReadability && hasDiversityMetrics) ||
                 (hasDiversityMetrics && hasGrammarMetrics) ||
                 (hasGrammarMetrics && hasComplexityMetrics)) {
        completenessBonus = 5;
        featureReliability = Math.min(100, featureReliability + 5);
      }

      console.log(`%cConfidence: ${result.confidence.toFixed(1)}%`, 'font-size: 16px; font-weight: bold; color: #7B1FA2;');
      console.log('');
      console.log(`%c1. Signal Quality (40% weight):`, 'font-weight: bold; color: #2196F3;');
      signalQualityComponents.forEach(comp => console.log(`  ${comp}`));
      if (sampleSizePenalty > 0) {
        console.log(`  %cSample Size Penalty: -${sampleSizePenalty} pts (${wordCount} words)`, 'color: #F44336;');
      }
      console.log(`  Raw Score: ${signalQualityScore.toFixed(1)} pts ${sampleSizePenalty > 0 || runOnSignalPenalty > 0 ? `→ ${signalQualityAfterPenalty.toFixed(1)} pts after penalty` : ''}`);
      console.log(`  Normalized: ${signalQualityNormalized.toFixed(1)}% (max possible: ~65 pts with enhanced validated metrics)`);
      console.log(`  %cNote: Signal quality uses 10+ validated linguistic metrics (MTLD, Yule's K, punctuation entropy, subordinate clauses, connective density, lexical overlap, readability indices, pct_advanced)`, 'color: #666; font-style: italic;');

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
      const baseFeatureReliability = featureReliability - completenessBonus; // Show base before bonus
      console.log(`  Dictionary Match Rate: ${features.aoa_match_rate !== undefined && features.aoa_match_rate !== null ? features.aoa_match_rate.toFixed(1) : 'N/A'}%`);
      console.log(`  Base Reliability: ${baseFeatureReliability.toFixed(1)}% (from dictionary match rate)`);
      console.log(`  Feature Completeness:`);
      console.log(`    ${hasReadability ? '✓' : '✗'} Readability metrics (Flesch-Kincaid, SMOG, ARI, LIX)`);
      console.log(`    ${hasDiversityMetrics ? '✓' : '✗'} Diversity metrics (TTR, MTLD, Yule's K)`);
      console.log(`    ${hasGrammarMetrics ? '✓' : '✗'} Grammar metrics (Dependency depth, Punctuation entropy/complexity)`);
      console.log(`    ${hasComplexityMetrics ? '✓' : '✗'} Complexity metrics (Subordinate clauses, Connectives, Lexical overlap)`);
      console.log(`    ${hasAdvancedVocab ? '✓' : '✗'} Advanced vocabulary metrics (AoA, pct_advanced)`);
      if (completenessBonus > 0) {
        console.log(`  Completeness Bonus: +${completenessBonus} pts (${hasReadability && hasDiversityMetrics && hasGrammarMetrics && hasComplexityMetrics && hasAdvancedVocab ? 'All validated metrics available' : 'Most validated metrics available'})`);
        console.log(`  = ${baseFeatureReliability.toFixed(1)}% + ${completenessBonus} pts = ${featureReliability.toFixed(1)}%`);
      }
      console.log(`  Feature Reliability Score: ${featureReliability.toFixed(1)}%`);
      console.log(`  %cNote: Using research-validated linguistic metrics that correlate with intelligence`, 'color: #666; font-style: italic;');

      console.log('');
      console.log(`%c4. Sample Size Constraint:`, 'font-weight: bold; color: #9E9E9E;');
      console.log(`  Word Count: ${wordCount} words${constraintNote}`);
      console.log(`  Constraint Multiplier: ${sampleSizeConstraint.toFixed(3)}x`);
      console.log(`  %cNote: Length matters for confidence (not IQ) - more data = more reliable`, 'color: #666; font-style: italic;');

      // Show run-on penalty for confidence (if applicable)
      const avgWordsForConfidence = features.avg_words_per_sentence || (sentences.length > 0 ? (tokens.length / sentences.length) : 0);
      if (sentenceCount === 1 && avgWordsForConfidence > 15) {
        let runOnConfidencePenalty = 0;
        if (punctuationDensity < 0.05) {
          runOnConfidencePenalty += (avgWordsForConfidence - 15) * 0.3 + 10;
        } else if (punctuationDensity < 0.10) {
          runOnConfidencePenalty += (avgWordsForConfidence - 15) * 0.15 + 5;
        }
        if (startsWithCasual) runOnConfidencePenalty += 8;
        runOnConfidencePenalty += casualConnectiveCount * 5;

        if (runOnConfidencePenalty > 0) {
          console.log('');
          console.log(`%c5. Run-on Penalty:`, 'font-weight: bold; color: #FF5722;');
          console.log(`  Run-on Detection: ${runOnConfidencePenalty.toFixed(1)} pts penalty`);
          console.log(`  Reason: Casual Twitter run-ons reduce confidence (artificial dimension inflation)`);
          console.log(`  %cNote: Run-ons create unreliable IQ estimates - confidence reflects this`, 'color: #666; font-style: italic;');
        }
      }

      // Calculate gaming penalty (must match actual calculation exactly)
      // NOTE: This must match _computeConfidence method in iqEstimator.js
      let gamingPenalty = 0;
      const repetitionRatio = wordCount > 0 ? (wordCount - uniqueWords) / wordCount : 0;
      
      // Detect sophisticated content to reduce repetition penalties (must match actual calculation)
      // This checks for metaphors, abstract concepts, and structured organization
      const originalText = result.features?.original_text || text || '';
      const lowerText = originalText.toLowerCase();
      let metaphorCount = 0;
      let abstractCount = 0;
      let hasStructure = false;
      
      // Basic sophisticated content detection (simplified version matching actual logic)
      const metaphorPatterns = /\b(metaphor|analogy|symbol|symbolic|represent|embody|reflect|mirror|echo|resonate)\b/gi;
      const abstractPatterns = /\b(thought|thinking|pattern|process|mechanism|system|structure|framework|concept|idea|notion|principle|theory|approach|method|strategy|technique)\b/gi;
      const structurePatterns = /(^|\n)[\s]*[-•*]\s+|\d+\.\s+|(first|second|third|finally|in conclusion|to summarize)/i;
      
      metaphorCount = (originalText.match(metaphorPatterns) || []).length;
      abstractCount = (originalText.match(abstractPatterns) || []).length;
      hasStructure = structurePatterns.test(originalText);
      
      const sophisticatedContent = {
        hasSophisticatedMarkers: metaphorCount >= 2 || abstractCount >= 5 || (hasStructure && wordCount > 200)
      };
      
      // Repetition penalties with sophisticated content reduction (must match exactly)
      if (repetitionRatio > 0.6 && wordCount > 30) {
        let penalty = 15; // Highly repetitive = weak signal
        if (wordCount > 200 && sophisticatedContent.hasSophisticatedMarkers) {
          penalty *= 0.4; // Reduce penalty significantly for sophisticated longer texts
        } else if (wordCount > 150 && sophisticatedContent.hasSophisticatedMarkers) {
          penalty *= 0.6; // Reduce penalty moderately
        }
        gamingPenalty += penalty;
      } else if (repetitionRatio > 0.5 && wordCount > 20) {
        let penalty = 10; // Moderately repetitive
        if (wordCount > 200 && sophisticatedContent.hasSophisticatedMarkers) {
          penalty *= 0.5;
        } else if (wordCount > 150 && sophisticatedContent.hasSophisticatedMarkers) {
          penalty *= 0.7;
        }
        gamingPenalty += penalty;
      } else if (repetitionRatio > 0.4 && wordCount > 15) {
        let penalty = 5; // Some repetition
        if (wordCount > 200 && sophisticatedContent.hasSophisticatedMarkers) {
          penalty *= 0.6;
        }
        gamingPenalty += penalty;
      }
      
      // Check for fragmentary text
      const avgWordsPerSentence = features.avg_words_per_sentence || (sentences.length > 0 ? (tokens.length / sentences.length) : 0);
      if (avgWordsPerSentence < 4 && sentenceCount > 3) {
        gamingPenalty += 10; // Fragmentary text = weak signal
      }
      
      // Run-on confidence penalty (if applicable) - must match actual calculation
      let runOnConfidencePenalty = 0;
      if (sentenceCount === 1 && avgWordsPerSentence > 15) {
        // Low punctuation density indicates run-on, not sophisticated structure
        if (punctuationDensity < 0.05) {
          // Very likely a run-on - significant penalty
          runOnConfidencePenalty += (avgWordsPerSentence - 15) * 0.3; // Scale with length
          runOnConfidencePenalty += 10; // Base penalty for run-on pattern
        } else if (punctuationDensity < 0.10) {
          // Possibly a run-on
          runOnConfidencePenalty += (avgWordsPerSentence - 15) * 0.15;
          runOnConfidencePenalty += 5;
        }

        // Additional penalty for casual connectives (confirms casual speech pattern)
        if (startsWithCasual) {
          runOnConfidencePenalty += 8; // Starting with "And also" = casual, less reliable
        }
        runOnConfidencePenalty += casualConnectiveCount * 5; // Each casual connective reduces reliability

        // Parenthetical-heavy pattern
        const parentheticalCount = (originalText.match(/\([^)]+\)/g) || []).length;
        if (parentheticalCount >= 4) {
          runOnConfidencePenalty += 8; // Casual run-on pattern
        }
      }
      gamingPenalty += runOnConfidencePenalty;

      // Calculate word count minimum floor (must match actual calculation)
      let wordCountMinimum = 0;
      if (wordCount <= 10) {
        const baseMin = 8;
        const maxMin = 26;
        const k = 0.3;
        const exponentialFactor = 1 - Math.exp(-k * (wordCount - 1));
        wordCountMinimum = baseMin + (maxMin - baseMin) * exponentialFactor;
        wordCountMinimum = Math.min(wordCountMinimum, maxMin);
      } else if (wordCount < 20) {
        const transitionFactor = (20 - wordCount) / 10;
        wordCountMinimum = 26 * transitionFactor;
      }

      console.log('');
      console.log(`%cCombined Calculation:`, 'font-weight: bold;');
      
      // Step 1: Weighted combination
      const weightedCombination = (signalQualityNormalized * 0.40) +
                                  (parseFloat(agreementScore) * 0.40) +
                                  (featureReliability * 0.20);
      console.log(`  Step 1: Weighted Combination`);
      console.log(`    = (Signal: ${signalQualityNormalized.toFixed(1)}% × 40%) + (Agreement: ${agreementScore}% × 40%) + (Features: ${featureReliability.toFixed(1)}% × 20%)`);
      console.log(`    = ${weightedCombination.toFixed(2)}%`);
      
      // Step 2: Apply gaming penalties
      let afterGamingPenalty = weightedCombination;
      let stepNumber = 2;
      if (gamingPenalty > 0) {
        afterGamingPenalty = weightedCombination - gamingPenalty;
        console.log(`  Step ${stepNumber}: Apply Gaming Penalties`);
        console.log(`    - Gaming Penalty: ${gamingPenalty.toFixed(1)} pts`);
        if (runOnConfidencePenalty > 0 && runOnConfidencePenalty < gamingPenalty) {
          const repetitionPenalty = gamingPenalty - runOnConfidencePenalty;
          if (repetitionPenalty > 0) {
            console.log(`      (Repetition penalty: ${repetitionPenalty.toFixed(1)} pts)`);
          }
          console.log(`      (Run-on penalty: ${runOnConfidencePenalty.toFixed(1)} pts)`);
        }
        console.log(`    = ${afterGamingPenalty.toFixed(2)}%`);
        stepNumber++;
      }
      
      // Step 3: Apply sample size constraint
      const afterConstraint = afterGamingPenalty * sampleSizeConstraint;
      if (sampleSizeConstraint < 1.0) {
        console.log(`  Step ${stepNumber}: Apply Sample Size Constraint`);
        console.log(`    × Sample Size Multiplier: ${sampleSizeConstraint.toFixed(3)}x`);
        console.log(`    = ${afterConstraint.toFixed(2)}%`);
        stepNumber++;
      } else if (gamingPenalty > 0) {
        // If no constraint but had gaming penalty, show this step anyway for clarity
        console.log(`  Step ${stepNumber}: Apply Sample Size Constraint`);
        console.log(`    × Sample Size Multiplier: ${sampleSizeConstraint.toFixed(3)}x (no constraint for ${wordCount}+ words)`);
        console.log(`    = ${afterConstraint.toFixed(2)}%`);
        stepNumber++;
      }
      
      // Step 4: Apply minimum floor
      let finalBeforeRound = afterConstraint;
      if (wordCountMinimum > 0 && afterConstraint < wordCountMinimum) {
        finalBeforeRound = wordCountMinimum;
        console.log(`  Step ${stepNumber}: Apply Minimum Floor`);
        console.log(`    Minimum Floor (${wordCount} words): ${wordCountMinimum.toFixed(1)}%`);
        console.log(`    = ${finalBeforeRound.toFixed(2)}% (raised from ${afterConstraint.toFixed(2)}%)`);
        stepNumber++;
      }
      
      // Step 5: Final bounds and rounding
      const finalConfidence = Math.max(wordCountMinimum, Math.min(95, finalBeforeRound));
      console.log(`  Step ${stepNumber}: Final Bounds & Rounding`);
      console.log(`    Clamped to range: [${wordCountMinimum > 0 ? wordCountMinimum.toFixed(1) : '0'}, 95%]`);
      if (finalBeforeRound !== finalConfidence) {
        console.log(`    Adjusted: ${finalConfidence.toFixed(2)}%`);
      }
      console.log(`    Rounded: ${Math.round(finalConfidence)}%`);
      console.log(`  %c→ Final Confidence: ${result.confidence.toFixed(1)}%`, 'font-weight: bold; color: #7B1FA2;');
      
      // Show breakdown if there's a discrepancy
      if (Math.abs(parseFloat(result.confidence) - Math.round(finalConfidence)) > 0.5) {
        console.log(`  %c⚠️ Note: There may be additional adjustments not shown in this breakdown`, 'color: #FF9800; font-style: italic;');
      }
      
      console.log(`  %cNote: Confidence reflects signal quality, agreement, feature reliability, and length constraints`, 'color: #666; font-style: italic;');
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

  // Export for use in other modules
  if (typeof window !== 'undefined') {
    window.BadgeCreationDebug = {
      logDebugInfo
    };
  }

})();

