/**
 * Vocabulary Analyzer for IQ Estimator
 * Handles AoA features, word normalization, stemming, and vocabulary sophistication calculations
 */

class VocabularyAnalyzer {
  constructor(resourceLoader) {
    this.resourceLoader = resourceLoader;
    this.stemmingSuffixes = ['ing', 'ed', 'er', 'est', 'ly', 's', 'es', 'ies', 'ied', 'ying'];
    
    // Performance optimization: Cache lookup results
    this._aoaLookupCache = new Map();
    this._aoaLookupCacheMaxSize = 10000;
  }

  /**
   * Normalize word for AoA lookup (matches Python's approach)
   */
  normalizeWord(word) {
    let normalized = word.toLowerCase().replace(/[^\w]/g, '');

    if (normalized.length > 4) {
      for (const suffix of this.stemmingSuffixes) {
        if (normalized.length > suffix.length + 2 && normalized.endsWith(suffix)) {
          normalized = normalized.slice(0, -suffix.length);
          break;
        }
      }
    }

    return normalized;
  }

  /**
   * Calculate letter similarity between two words (0-1, where 1 = identical)
   */
  letterSimilarity(word1, word2) {
    if (!word1 || !word2) return 0;

    const w1 = word1.toLowerCase();
    const w2 = word2.toLowerCase();

    if (w1 === w2) return 1;

    const len1 = w1.length;
    const len2 = w2.length;
    const dp = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (w1[i - 1] === w2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    const lcsLength = dp[len1][len2];
    const maxLen = Math.max(len1, len2);
    return lcsLength / maxLen;
  }

  /**
   * Find best fuzzy match in dictionary (80% letter match threshold)
   */
  fuzzyMatch(word) {
    const aoaDictionary = this.resourceLoader.aoaDictionary;
    const aoaDictionaryKeys = this.resourceLoader.aoaDictionaryKeys;
    
    if (!aoaDictionary || !aoaDictionaryKeys) return null;

    const cleaned = word.toLowerCase().replace(/[^\w]/g, '');
    if (cleaned.length < 2) return null;

    let bestMatch = null;
    let bestSimilarity = 0.8;

    const wordLen = cleaned.length;
    const minLen = Math.max(2, Math.floor(wordLen * 0.7));
    const maxLen = Math.ceil(wordLen * 1.3);

    let candidatesChecked = 0;
    const maxCandidatesToCheck = 500;

    for (const dictWord of aoaDictionaryKeys) {
      if (dictWord.length < minLen || dictWord.length > maxLen) continue;

      candidatesChecked++;
      if (candidatesChecked > maxCandidatesToCheck) break;

      const similarity = this.letterSimilarity(cleaned, dictWord);
      if (similarity >= 0.8 && similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = dictWord;
      }
    }

    return bestMatch ? aoaDictionary[bestMatch] : null;
  }

  /**
   * Generate word variations for dictionary lookup
   */
  getWordVariations(word) {
    const variations = [];

    if (word.endsWith('s') && word.length > 3) {
      variations.push(word.slice(0, -1));
    }
    if (word.endsWith('es') && word.length > 4) {
      variations.push(word.slice(0, -2));
      if (word.length > 5) {
        variations.push(word.slice(0, -2) + 'e');
      }
    }
    if (word.endsWith('ies') && word.length > 4) {
      variations.push(word.slice(0, -3) + 'y');
    }
    if (word.endsWith('ing') && word.length > 4) {
      variations.push(word.slice(0, -3));
      variations.push(word.slice(0, -3) + 'e');
      if (word.slice(0, -3).endsWith('is')) {
        variations.push(word.slice(0, -5) + 'e');
      }
    }
    if (word.endsWith('ed') && word.length > 3) {
      variations.push(word.slice(0, -2));
      variations.push(word.slice(0, -2) + 'e');
      if (word.endsWith('ied')) {
        variations.push(word.slice(0, -3) + 'y');
      }
      if (word.length > 4 && word[word.length - 4] === word[word.length - 3]) {
        variations.push(word.slice(0, -3));
      }
    }
    if (word.endsWith('er') && word.length > 3 && !word.endsWith('ier')) {
      variations.push(word.slice(0, -2));
      variations.push(word.slice(0, -2) + 'e');
    }
    if (word.endsWith('ly') && word.length > 3) {
      variations.push(word.slice(0, -2));
    }
    if (word.endsWith('tion') && word.length > 5) {
      variations.push(word.slice(0, -3) + 'e');
      variations.push(word.slice(0, -4) + 'te');
    }
    if (word.endsWith('sion') && word.length > 5) {
      variations.push(word.slice(0, -3) + 'e');
    }
    if (word.endsWith('ation') && word.length > 6) {
      variations.push(word.slice(0, -4) + 'e');
    }
    if (word.endsWith('al') && word.length > 4) {
      variations.push(word.slice(0, -2));
    }
    if (word.endsWith('ic') && word.length > 4) {
      variations.push(word.slice(0, -2));
    }
    if (word.endsWith('ical') && word.length > 6) {
      variations.push(word.slice(0, -4));
      variations.push(word.slice(0, -4) + 'y');
    }

    return variations;
  }

  /**
   * Look up AoA for a word with multiple fallback strategies
   */
  lookupAoA(word) {
    const aoaDictionary = this.resourceLoader.aoaDictionary;
    if (!aoaDictionary) return null;

    const cleaned = word.toLowerCase().replace(/[^\w]/g, '');
    if (cleaned.length <= 1) return null;

    // Check cache first
    if (this._aoaLookupCache.has(cleaned)) {
      return this._aoaLookupCache.get(cleaned);
    }

    let result = null;

    // Strategy 1: Direct match
    if (aoaDictionary[cleaned] !== undefined) {
      result = aoaDictionary[cleaned];
    } else {
      // Strategy 2: Try stemmed version
      const normalized = this.normalizeWord(word);
      if (normalized !== cleaned && aoaDictionary[normalized] !== undefined) {
        result = aoaDictionary[normalized];
      } else {
        // Strategy 3: Try word variations
        const variations = this.getWordVariations(cleaned);
        for (const variant of variations) {
          if (aoaDictionary[variant] !== undefined) {
            result = aoaDictionary[variant];
            break;
          }
        }

        // Strategy 4: Fuzzy matching
        if (!result) {
          result = this.fuzzyMatch(word);
        }
      }
    }

    // Cache result
    if (this._aoaLookupCache.size >= this._aoaLookupCacheMaxSize) {
      const entriesToRemove = Math.floor(this._aoaLookupCacheMaxSize * 0.2);
      const keysToRemove = Array.from(this._aoaLookupCache.keys()).slice(0, entriesToRemove);
      keysToRemove.forEach(key => this._aoaLookupCache.delete(key));
    }
    this._aoaLookupCache.set(cleaned, result);

    return result;
  }

  /**
   * Compute comprehensive AoA features (matching Python's approach)
   */
  computeAoAFeatures(tokens, avgSyllablesFn) {
    const aoaValues = [];
    let matchedCount = 0;

    const meaningfulTokens = tokens.filter(token => {
      const cleaned = token.toLowerCase().replace(/[^\w]/g, '');
      return cleaned.length > 1;
    });

    for (const token of meaningfulTokens) {
      const aoa = this.lookupAoA(token);
      if (aoa !== null) {
        aoaValues.push(aoa);
        matchedCount++;
      }
    }

    const totalWordCount = meaningfulTokens.length;

    if (aoaValues.length === 0 || totalWordCount === 0) {
      const avgLength = meaningfulTokens.reduce((sum, t) => sum + t.length, 0) / meaningfulTokens.length;
      const avgSyllables = avgSyllablesFn(meaningfulTokens);
      const longWordRatio = meaningfulTokens.filter(t => t.length >= 8).length / meaningfulTokens.length;
      const veryLongWordRatio = meaningfulTokens.filter(t => t.length >= 12).length / meaningfulTokens.length;
      
      const technicalTerms = /^(agi|compute|liability|commodities|hardware|performance|negligible|algorithm|rational|incentives|behavioral|sophisticated|methodology|systematic|underestimate|calibration|dimension|lexical|diversity|complexity|grammatical|precision|vocabulary|sophistication|connective|subordinate|punctuation|entropy|readability|flesch|kincaid|smog|ari|lix|yule|mtld|msttr|ttr|dependency|coherence|overlap)$/i;
      const technicalCount = meaningfulTokens.filter(t => technicalTerms.test(t.toLowerCase())).length;
      const technicalRatio = technicalCount / meaningfulTokens.length;
      
      const estimatedAoa = 3.91 + 
        (avgLength - 4.0) * 0.8 +
        (avgSyllables - 1.5) * 0.5 +
        (longWordRatio * 3.5) +
        (veryLongWordRatio * 5.0) +
        (technicalRatio * 4.0);

      return {
        mean_aoa: estimatedAoa,
        pct_advanced: Math.min(100, (longWordRatio + veryLongWordRatio * 0.5 + technicalRatio * 0.3) * 100),
        match_rate: 0,
        use_approximation: true
      };
    }

    const sum = aoaValues.reduce((a, b) => a + b, 0);
    const meanAoa = sum / aoaValues.length;

    const advancedCount = aoaValues.filter(aoa => aoa > 10).length;
    const veryAdvancedCount = aoaValues.filter(aoa => aoa > 12).length;
    const pctAdvanced = (advancedCount / aoaValues.length) * 100;
    const pctVeryAdvanced = (veryAdvancedCount / aoaValues.length) * 100;
    const adjustedPctAdvanced = pctAdvanced + (pctVeryAdvanced * 0.5);

    const matchRate = (matchedCount / totalWordCount) * 100;

    // Estimate AoA for unmatched sophisticated words
    if (matchRate < 50 && meaningfulTokens.length >= 10) {
      const unmatchedTokens = meaningfulTokens.filter(token => {
        const aoa = this.lookupAoA(token);
        return aoa === null;
      });

      if (unmatchedTokens.length > 0) {
        const unmatchedLengths = unmatchedTokens.map(t => t.length);
        const avgUnmatchedLength = unmatchedLengths.reduce((a, b) => a + b, 0) / unmatchedLengths.length;
        const unmatchedSyllables = unmatchedTokens.map(t => avgSyllablesFn([t]));
        const avgUnmatchedSyllables = unmatchedSyllables.reduce((a, b) => a + b, 0) / unmatchedSyllables.length;

        const longUnmatched = unmatchedTokens.filter(t => t.length >= 10).length;
        const veryLongUnmatched = unmatchedTokens.filter(t => t.length >= 12).length;

        const estimatedUnmatchedAoa = 3.91 +
          (avgUnmatchedLength - 4.0) * 0.7 +
          (avgUnmatchedSyllables - 1.5) * 0.6 +
          (longUnmatched / unmatchedTokens.length) * 4 +
          (veryLongUnmatched / unmatchedTokens.length) * 6;

        const matchedRatio = matchRate / 100;
        const unmatchedRatio = (100 - matchRate) / 100;
        const blendedAoa = (meanAoa * matchedRatio) + (estimatedUnmatchedAoa * unmatchedRatio);

        return {
          mean_aoa: blendedAoa,
          pct_advanced: adjustedPctAdvanced + (longUnmatched / totalWordCount * 100 * 0.5),
          pct_very_advanced: pctVeryAdvanced,
          match_rate: matchRate,
          num_matched: matchedCount,
          total_words: totalWordCount,
          use_approximation: matchRate < 50,
          estimated_unmatched: true
        };
      }
    }

    return {
      mean_aoa: meanAoa,
      pct_advanced: adjustedPctAdvanced,
      pct_very_advanced: pctVeryAdvanced,
      match_rate: matchRate,
      num_matched: matchedCount,
      total_words: totalWordCount,
      use_approximation: matchRate < 50
    };
  }
}

// Export
if (typeof window !== 'undefined') {
  window.VocabularyAnalyzer = VocabularyAnalyzer;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VocabularyAnalyzer;
}

