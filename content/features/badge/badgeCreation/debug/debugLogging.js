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

    // Run-on detection analysis for Sentence Complexity
    const avgWords = features.avg_words_per_sentence || (sentences.length > 0 ? (tokens.length / sentences.length) : 0);
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
        const originalIQ = 60 + (avgWords - sentenceBaseline) * 6.0;
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
      console.log(`    → Enhanced approximation (calibrated on Python spaCy results)`);
      console.log(`    → Uses: punctuation, clauses, relative clauses, sentence length, prepositions`);

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
          const adjustedDepth = Math.max(1.795, originalDepDepth - depthPenalty);
          const originalGrammarIQ = 53 + (originalDepDepth - 1.795) * 80;
          const adjustedGrammarIQ = 53 + (adjustedDepth - 1.795) * 80;
          const finalGrammarIQ = Math.max(50, adjustedGrammarIQ - iqPenalty);

          console.log(`  %c🚫 Run-on Adjustment (Dependency Depth):`, 'font-weight: bold; color: #F44336;');
          console.log(`    Depth Penalty: ${depthPenalty.toFixed(3)} → Adjusted Depth: ${adjustedDepth.toFixed(3)}`);
          console.log(`    Direct IQ Penalty: ${iqPenalty.toFixed(1)} points`);
          console.log(`    Base Grammar IQ: ${originalGrammarIQ.toFixed(1)} → After adjustments: ${finalGrammarIQ.toFixed(1)}`);
          console.log(`    %cNote: High dependency depth from run-ons (lack of punctuation) is penalized`, 'color: #666; font-style: italic;');
        }
      }
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

      // Sample size penalty
      let sampleSizePenalty = 0;
      if (wordCount < 15) {
        sampleSizePenalty = 15;
      } else if (wordCount < 25) {
        sampleSizePenalty = 10;
      } else if (wordCount < 50) {
        sampleSizePenalty = 5;
      }

      const signalQualityAfterPenalty = Math.max(0, signalQualityScore - sampleSizePenalty - runOnSignalPenalty);
      // Updated normalization: max possible is ~65 with enhanced validated metrics
      const signalQualityNormalized = Math.min(100, (signalQualityAfterPenalty / 65) * 100);

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
      console.log(`  Dictionary Match Rate: ${features.aoa_match_rate?.toFixed(1) || 'N/A'}%`);
      console.log(`  Feature Completeness:`);
      console.log(`    ${hasReadability ? '✓' : '✗'} Readability metrics (Flesch-Kincaid, SMOG, ARI, LIX)`);
      console.log(`    ${hasDiversityMetrics ? '✓' : '✗'} Diversity metrics (TTR, MTLD, Yule's K)`);
      console.log(`    ${hasGrammarMetrics ? '✓' : '✗'} Grammar metrics (Dependency depth, Punctuation entropy/complexity)`);
      console.log(`    ${hasComplexityMetrics ? '✓' : '✗'} Complexity metrics (Subordinate clauses, Connectives, Lexical overlap)`);
      console.log(`    ${hasAdvancedVocab ? '✓' : '✗'} Advanced vocabulary metrics (AoA, pct_advanced)`);
      if (completenessBonus > 0) {
        console.log(`  Completeness Bonus: +${completenessBonus} pts (${hasReadability && hasDiversityMetrics && hasGrammarMetrics && hasComplexityMetrics && hasAdvancedVocab ? 'All validated metrics available' : 'Most validated metrics available'})`);
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

  // Export for use in other modules
  if (typeof window !== 'undefined') {
    window.BadgeCreationDebug = {
      logDebugInfo
    };
  }

})();

