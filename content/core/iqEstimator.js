/**
 * Comprehensive IQ Estimator - Ultimate Version with Maximum Accuracy
 *
 * IMPROVEMENTS over Enhanced version:
 * 1. Better word normalization matching Python's approach
 * 2. Stemming/lemmatization for better AoA dictionary matching
 * 3. Proper pct_advanced calculation (AoA > 10)
 * 4. Better tokenization and punctuation handling
 * 5. Enhanced coverage blending
 * 6. More sophisticated vocabulary scoring
 */

class ComprehensiveIQEstimatorUltimate {
  constructor(options = {}) {
    // Trained weights
    this.dimensionWeights = {
      vocabulary_sophistication: 0.35,
      lexical_diversity: 0.25,
      sentence_complexity: 0.20,
      grammatical_precision: 0.20
    };

    // Twitter-specific weights (for texts <= 300 characters)
    // Vocabulary becomes MORE important in constrained spaces
    this.twitterWeights = {
      vocabulary_sophistication: 0.45,  // Increased from 0.35 - word choice efficiency matters more
      lexical_diversity: 0.25,           // Same - TTR still important
      sentence_complexity: 0.15,          // Reduced from 0.20 - constrained length limits complexity
      grammatical_precision: 0.15          // Reduced from 0.20 - syntax less important when space-constrained
    };

    // Twitter-specific sentence complexity baseline
    // In tweets, people write shorter sentences due to 280-char limit
    // High-IQ people (IQ 100) typically use ~8-9 words/sentence in tweets vs 11 in essays
    this.twitterSentenceBaseline = 8.5;  // Lowered from 11.0 for essay-length texts
    this.essaySentenceBaseline = 11.0;    // Original baseline for longer texts

    // AoA dictionary
    this.aoaDictionary = null;
    this.aoaDictionaryKeys = null; // Cached keys for faster fuzzy matching
    this.aoaDictionaryLoaded = false;
    this.aoaDictionaryPath = options.aoaDictionaryPath || 'content/data/aoa_dictionary.json';

    // Calibrated dependency depth coefficients
    this.depDepthCalibration = {
      intercept: 1.795,
      punctuation_coefficient: 0.3,  // Fallback to original
      clause_coefficient: 0.2
    };
    this.calibrationPath = options.calibrationPath || 'content/data/dependency_depth_calibration.json';

    // spaCy dependency parser (enhanced approximation method)
    this.spacyParser = null;
    this.useRealDependencyParsing = false; // Real parsing not available in extensions, using enhanced approximation

    // Hybrid calibration
    this.hybridCalibration = {
      enabled: options.hybridCalibration !== false,
      vocabularyAdjustment: true,
      syntaxAdjustment: true
    };

    // Stemming suffixes for better dictionary matching
    this.stemmingSuffixes = ['ing', 'ed', 'er', 'est', 'ly', 's', 'es', 'ies', 'ied', 'ying'];

    this._loadResources();

    // Initialize enhanced dependency parser
    // Will be available after dependencyParser.js loads
    if (typeof window !== 'undefined') {
      // Check immediately and also set up a delayed check for when dependencyParser loads
      if (window.spacyDependencyParser) {
        this.spacyParser = window.spacyDependencyParser;
      } else {
        // If not loaded yet, check after a short delay
        setTimeout(() => {
          if (window.spacyDependencyParser) {
            this.spacyParser = window.spacyDependencyParser;
          }
        }, 100);
      }
    }
  }

  /**
   * Load AoA dictionary and calibration data asynchronously
   */
  async _loadResources() {
    try {
      if (typeof fetch !== 'undefined') {
        // Use chrome.runtime.getURL for extension context, fallback to relative path
        const getResourceURL = (path) => {
          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
            return chrome.runtime.getURL(path);
          }
          return path;
        };

        try {
          const aoaUrl = getResourceURL(this.aoaDictionaryPath);
          const response = await fetch(aoaUrl);
          if (response.ok) {
            this.aoaDictionary = await response.json();
            this.aoaDictionaryKeys = Object.keys(this.aoaDictionary);
            this.aoaDictionaryLoaded = true;
            console.debug('[IQEstimator] AoA dictionary loaded successfully');
          } else {
            console.warn('[IQEstimator] Failed to load AoA dictionary:', response.status, aoaUrl);
          }
        } catch (e) {
          // Check if error is due to extension context invalidated (common during hot reload)
          const isContextInvalidated = e.message && (
            e.message.includes('Extension context invalidated') ||
            e.message.includes('message handler closed') ||
            e.message.includes('Receiving end does not exist')
          );

          if (isContextInvalidated) {
            // This is expected during extension reload - silently continue without dictionary
            // The estimator will work fine without it, using approximations
            console.debug('[IQEstimator] Extension context invalidated - AoA dictionary not available (this is normal during extension reload)');
          } else {
            // Other errors - log with full details
            console.warn('[IQEstimator] Error loading AoA dictionary:', e.message, 'Path:', this.aoaDictionaryPath);
          }
          // Silent fail, will use approximation
        }

        try {
          const calUrl = getResourceURL(this.calibrationPath);
          const response = await fetch(calUrl);
          if (response.ok) {
            const calibration = await response.json();
            this.depDepthCalibration = {
              intercept: calibration.intercept || 1.795,
              punctuation_coefficient: Math.abs(calibration.punctuation_coefficient) > 0.01
                ? calibration.punctuation_coefficient : 0.3,
              clause_coefficient: Math.abs(calibration.clause_coefficient) > 0.01
                ? calibration.clause_coefficient : 0.2
            };
            console.debug('[IQEstimator] Dependency depth calibration loaded successfully');
          } else {
            console.warn('[IQEstimator] Failed to load calibration:', response.status, calUrl);
          }
        } catch (e) {
          // Check if error is due to extension context invalidated
          const isContextInvalidated = e.message && (
            e.message.includes('Extension context invalidated') ||
            e.message.includes('message handler closed') ||
            e.message.includes('Receiving end does not exist')
          );

          if (isContextInvalidated) {
            // Expected during extension reload - silently continue
            console.debug('[IQEstimator] Extension context invalidated - Calibration not available (this is normal during extension reload)');
          } else {
            // Other errors - log with full details
            console.warn('[IQEstimator] Error loading calibration:', e.message, 'Path:', this.calibrationPath);
          }
          // Silent fail, use defaults
        }
      }
    } catch (e) {
      // Silent fail
    }
  }

  /**
   * Load resources synchronously (for Node.js)
   */
  _loadResourcesSync(fs, pathModule) {
    try {
      let aoaPath = this.aoaDictionaryPath;
      if (pathModule && !pathModule.isAbsolute(aoaPath)) {
        aoaPath = pathModule.join(pathModule.dirname(require.main.filename || __filename || '.'), '..', aoaPath);
      }

      if (fs.existsSync(aoaPath)) {
        const data = fs.readFileSync(aoaPath, 'utf8');
        this.aoaDictionary = JSON.parse(data);
        this.aoaDictionaryKeys = Object.keys(this.aoaDictionary);
        this.aoaDictionaryLoaded = true;
      }

      let calPath = this.calibrationPath;
      if (pathModule && !pathModule.isAbsolute(calPath)) {
        calPath = pathModule.join(pathModule.dirname(require.main.filename || __filename || '.'), '..', calPath);
      }

      if (fs.existsSync(calPath)) {
        const data = fs.readFileSync(calPath, 'utf8');
        const calibration = JSON.parse(data);
        this.depDepthCalibration = {
          intercept: calibration.intercept || 1.795,
          punctuation_coefficient: Math.abs(calibration.punctuation_coefficient) > 0.01
            ? calibration.punctuation_coefficient : 0.3,
          clause_coefficient: Math.abs(calibration.clause_coefficient) > 0.01
            ? calibration.clause_coefficient : 0.2
        };
      }
    } catch (e) {
      // Silent fail
    }
  }

  /**
   * Normalize word for AoA lookup (matches Python's approach)
   */
  _normalizeWord(word) {
    // Remove punctuation and lowercase (matching Python's re.sub(r'[^\w\s]', '', word).lower())
    let normalized = word.toLowerCase().replace(/[^\w]/g, '');

    // Don't over-stem - Python doesn't do aggressive stemming
    // Only remove suffixes if word is long enough and suffix is clear
    if (normalized.length > 4) {
      // Remove common suffixes (but be conservative)
      for (const suffix of this.stemmingSuffixes) {
        if (normalized.length > suffix.length + 2 && normalized.endsWith(suffix)) {
          normalized = normalized.slice(0, -suffix.length);
          break; // Only remove one suffix
        }
      }
    }

    return normalized;
  }

  /**
   * Calculate letter similarity between two words (0-1, where 1 = identical)
   * Uses longest common subsequence approach for better matching
   */
  _letterSimilarity(word1, word2) {
    if (!word1 || !word2) return 0;

    // Convert to lowercase for comparison
    const w1 = word1.toLowerCase();
    const w2 = word2.toLowerCase();

    // If exact match
    if (w1 === w2) return 1;

    // Calculate longest common subsequence (LCS)
    const len1 = w1.length;
    const len2 = w2.length;

    // Dynamic programming for LCS
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

    // Return similarity as percentage of matching letters
    return lcsLength / maxLen;
  }

  /**
   * Find best fuzzy match in dictionary (80% letter match threshold)
   * Optimized to only check words of similar length
   */
  _fuzzyMatch(word) {
    if (!this.aoaDictionary || !this.aoaDictionaryKeys) return null;

    const cleaned = word.toLowerCase().replace(/[^\w]/g, '');
    if (cleaned.length < 2) return null; // Skip very short words

    let bestMatch = null;
    let bestSimilarity = 0.8; // 80% threshold

    const wordLen = cleaned.length;
    // Only check words within 30% length difference for performance
    const minLen = Math.max(2, Math.floor(wordLen * 0.7));
    const maxLen = Math.ceil(wordLen * 1.3);

    // Performance optimization: limit candidate checking to avoid hanging on large dictionaries
    let candidatesChecked = 0;
    const maxCandidatesToCheck = 500; // Limit to prevent hanging on notifications page

    // Search through dictionary for best match (optimized with length filter)
    for (const dictWord of this.aoaDictionaryKeys) {
      // Skip words that are too different in length
      if (dictWord.length < minLen || dictWord.length > maxLen) continue;

      candidatesChecked++;
      if (candidatesChecked > maxCandidatesToCheck) {
        // Stop searching after checking enough candidates to prevent performance issues
        break;
      }

      const similarity = this._letterSimilarity(cleaned, dictWord);
      if (similarity >= 0.8 && similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = dictWord;
      }
    }

    return bestMatch ? this.aoaDictionary[bestMatch] : null;
  }

  /**
   * Look up AoA for a word with multiple fallback strategies
   */
  _lookupAoA(word) {
    if (!this.aoaDictionary) return null;

    // Skip 1-letter words - they're not meaningful for AoA analysis
    const cleaned = word.toLowerCase().replace(/[^\w]/g, '');
    if (cleaned.length <= 1) return null;

    // Strategy 1: Direct match (lowercase, no punctuation)
    if (this.aoaDictionary[cleaned] !== undefined) {
      return this.aoaDictionary[cleaned];
    }

    // Strategy 2: Try stemmed version
    const normalized = this._normalizeWord(word);
    if (normalized !== cleaned && this.aoaDictionary[normalized] !== undefined) {
      return this.aoaDictionary[normalized];
    }

    // Strategy 3: Try common word variations (plural/singular, -ing, -ed)
    const variations = this._getWordVariations(cleaned);
    for (const variant of variations) {
      if (this.aoaDictionary[variant] !== undefined) {
        return this.aoaDictionary[variant];
      }
    }

    // Strategy 4: Fuzzy matching (80% letter match)
    const fuzzyMatch = this._fuzzyMatch(word);
    if (fuzzyMatch !== null) {
      return fuzzyMatch;
    }

    return null;
  }

  /**
   * Generate word variations for dictionary lookup (enhanced)
   */
  _getWordVariations(word) {
    const variations = [];

    // Try removing common suffixes
    if (word.endsWith('s') && word.length > 3) {
      variations.push(word.slice(0, -1)); // Remove 's'
    }
    if (word.endsWith('es') && word.length > 4) {
      variations.push(word.slice(0, -2)); // Remove 'es'
      if (word.length > 5) {
        variations.push(word.slice(0, -2) + 'e'); // Try adding 'e' back
      }
    }
    if (word.endsWith('ies') && word.length > 4) {
      variations.push(word.slice(0, -3) + 'y'); // Try 'y' version
    }
    if (word.endsWith('ing') && word.length > 4) {
      variations.push(word.slice(0, -3)); // Remove 'ing'
      variations.push(word.slice(0, -3) + 'e'); // Try 'e' version (like 'making' -> 'make')
      // Also try without 'e' (like 'arising' -> 'arise', 'rising')
      if (word.slice(0, -3).endsWith('is')) {
        variations.push(word.slice(0, -5) + 'e'); // 'arising' -> 'arise'
      }
    }
    if (word.endsWith('ed') && word.length > 3) {
      variations.push(word.slice(0, -2)); // Remove 'ed'
      variations.push(word.slice(0, -2) + 'e'); // Try with 'e'
      if (word.endsWith('ied')) {
        variations.push(word.slice(0, -3) + 'y'); // Try 'y' version
      }
      // Handle 'ed' after consonant doubling (like 'perceived' -> 'perceive')
      if (word.length > 4 && word[word.length - 4] === word[word.length - 3]) {
        variations.push(word.slice(0, -3)); // Remove doubled consonant + 'ed'
      }
    }
    if (word.endsWith('er') && word.length > 3 && !word.endsWith('ier')) {
      variations.push(word.slice(0, -2)); // Remove 'er'
      variations.push(word.slice(0, -2) + 'e'); // Try with 'e'
    }
    if (word.endsWith('ly') && word.length > 3) {
      variations.push(word.slice(0, -2)); // Remove 'ly'
    }
    // Handle -tion, -sion, -ation endings
    if (word.endsWith('tion') && word.length > 5) {
      variations.push(word.slice(0, -3) + 'e'); // 'rotation' -> 'rotate'
      variations.push(word.slice(0, -4) + 'te'); // Alternative
    }
    if (word.endsWith('sion') && word.length > 5) {
      variations.push(word.slice(0, -3) + 'e');
    }
    if (word.endsWith('ation') && word.length > 6) {
      variations.push(word.slice(0, -4) + 'e');
    }
    // Handle -al, -ic, -ical endings
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
   * Compute comprehensive AoA features (matching Python's approach)
   */
  _computeAoAFeatures(tokens) {
    const aoaValues = [];
    let matchedCount = 0;

    // Filter out 1-letter words - they're not meaningful for AoA analysis
    const meaningfulTokens = tokens.filter(token => {
      const cleaned = token.toLowerCase().replace(/[^\w]/g, '');
      return cleaned.length > 1;
    });

    for (const token of meaningfulTokens) {
      const aoa = this._lookupAoA(token);
      if (aoa !== null) {
        aoaValues.push(aoa);
        matchedCount++;
      }
    }

    // Use meaningfulTokens for calculations, not original tokens
    const totalWordCount = meaningfulTokens.length;

    if (aoaValues.length === 0 || totalWordCount === 0) {
      // Even with no matches, estimate from word characteristics
      const avgLength = meaningfulTokens.reduce((sum, t) => sum + t.length, 0) / meaningfulTokens.length;
      const avgSyllables = this._avgSyllables(meaningfulTokens);
      // Long, complex words suggest high AoA
      const longWordRatio = meaningfulTokens.filter(t => t.length >= 8).length / meaningfulTokens.length;
      const veryLongWordRatio = meaningfulTokens.filter(t => t.length >= 12).length / meaningfulTokens.length;
      const estimatedAoa = 3.91 + (avgLength - 4.0) * 0.6 + (avgSyllables - 1.5) * 0.4 + (longWordRatio * 2.5) + (veryLongWordRatio * 4);

      return {
        mean_aoa: estimatedAoa,
        pct_advanced: (longWordRatio + veryLongWordRatio * 0.5) * 100,
        match_rate: 0,
        use_approximation: true
      };
    }

    // Calculate statistics (matching Python's np.mean, etc.)
    const sum = aoaValues.reduce((a, b) => a + b, 0);
    const meanAoa = sum / aoaValues.length;

    // Calculate percentage of advanced words (AoA > 10 = college level)
    // Also consider very advanced (AoA > 12) separately
    const advancedCount = aoaValues.filter(aoa => aoa > 10).length;
    const veryAdvancedCount = aoaValues.filter(aoa => aoa > 12).length;
    const pctAdvanced = (advancedCount / aoaValues.length) * 100;
    // Weight very advanced words more
    const pctVeryAdvanced = (veryAdvancedCount / aoaValues.length) * 100;
    const adjustedPctAdvanced = pctAdvanced + (pctVeryAdvanced * 0.5); // Extra weight for very advanced

    const matchRate = (matchedCount / totalWordCount) * 100;

    // Estimate AoA for unmatched sophisticated words
    const unmatchedTokens = meaningfulTokens.filter((t) => {
      return this._lookupAoA(t) === null;
    });

    let estimatedUnmatchedAoa = null;
    if (unmatchedTokens.length > 0 && matchRate < 80) {
      // Estimate AoA for unmatched words based on characteristics
      const unmatchedLengths = unmatchedTokens.map(t => t.length);
      const unmatchedSyllables = unmatchedTokens.map(t => this._countSyllables(t));
      const avgUnmatchedLength = unmatchedLengths.reduce((a, b) => a + b, 0) / unmatchedLengths.length;
      const avgUnmatchedSyllables = unmatchedSyllables.reduce((a, b) => a + b, 0) / unmatchedSyllables.length;

      // Sophisticated unmatched words (long, multi-syllable) likely have high AoA
      const longUnmatched = unmatchedTokens.filter(t => t.length >= 10).length;
      const veryLongUnmatched = unmatchedTokens.filter(t => t.length >= 12).length;

      estimatedUnmatchedAoa = 3.91 +
        (avgUnmatchedLength - 4.0) * 0.7 +
        (avgUnmatchedSyllables - 1.5) * 0.6 +
        (longUnmatched / unmatchedTokens.length) * 4 +
        (veryLongUnmatched / unmatchedTokens.length) * 6;

      // Blend matched and estimated unmatched AoA
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

    return {
      mean_aoa: meanAoa,
      pct_advanced: adjustedPctAdvanced,
      pct_very_advanced: pctVeryAdvanced,
      match_rate: matchRate,
      num_matched: matchedCount,
      total_words: totalWordCount,
      use_approximation: matchRate < 50  // Blend if low coverage
    };
  }

  /**
   * Detect gibberish/nonsensical text using multiple heuristics
   * @param {string} text - The text to check
   * @param {Array<string>} words - Array of extracted words
   * @returns {Object} - {isValid: boolean, error: string}
   */
  _detectGibberish(text, words) {
    // Check 1: Excessive character repetition (like "aaaa bbbbb cccc")
    const repeatRatio = words.filter(word => {
      if (word.length < 3) return false;
      const uniqueChars = new Set(word.toLowerCase()).size;
      // Words with very few unique characters relative to length are suspicious
      return uniqueChars <= 2;
    }).length / words.length;

    if (repeatRatio > 0.3) {
      return {
        isValid: false,
        error: 'High character repetition detected'
      };
    }

    // Check 2: Low dictionary match rate with AoA dictionary (if loaded)
    // This is the most effective check for gibberish when the dictionary is available
    if (this.aoaDictionaryLoaded && words.length >= 10) {
      let matchedWords = 0;
      words.forEach(word => {
        const normalized = this._normalizeWord(word);
        if (this.aoaDictionary[normalized] || this._fuzzyMatch(normalized)) {
          matchedWords++;
        }
      });

      const matchRate = (matchedWords / words.length) * 100;
      // If less than 10% of words match common English words, it's likely gibberish
      // Lowered threshold from 20% to be more aggressive
      if (matchRate < 10) {
        return {
          isValid: false,
          error: 'Low word recognition rate'
        };
      }
    } else if (!this.aoaDictionaryLoaded && words.length >= 15) {
      // Fallback: When AoA dictionary is not loaded, use a heuristic based on word structure
      // Check for very unusual sequences that don't appear in real words
      let verySuspiciousWords = 0;
      words.forEach(word => {
        const lowerWord = word.toLowerCase();
        const len = lowerWord.length;

        // Skip very short words and common suffixes/prefixes
        if (len <= 2) return;

        // Check for words with very unusual consonant clusters
        // Most real English words don't have 3+ consonant clusters in the middle
        if (/[bcdfghjklmnpqrstvwxz]{4,}[aeiou]/.test(lowerWord) ||
            /[aeiou][bcdfghjklmnpqrstvwxz]{4,}/.test(lowerWord)) {
          verySuspiciousWords++;
        }

        // Check for impossible sequences
        if (/q[^u]/.test(lowerWord) || /[bcdfghjklmnpqrstvwxz]{5,}/.test(lowerWord)) {
          verySuspiciousWords++;
        }
      });

      const suspiciousRatio = verySuspiciousWords / words.length;
      // If more than 15% of words have very suspicious patterns, likely gibberish
      if (suspiciousRatio > 0.15) {
        return {
          isValid: false,
          error: 'Low word recognition rate'
        };
      }
    }

    // Check 3: Consonant-to-vowel ratio (English typically has balanced ratio)
    const allText = text.toLowerCase().replace(/[^a-z]/g, '');
    if (allText.length > 20) {
      const vowels = (allText.match(/[aeiou]/g) || []).length;
      const consonants = allText.length - vowels;
      const consonantRatio = consonants / allText.length;
      // English typically has ~60% consonants, extreme ratios suggest gibberish
      if (consonantRatio > 0.85 || consonantRatio < 0.35) {
        return {
          isValid: false,
          error: 'Unnatural consonant-vowel pattern'
        };
      }
    }

    // Check 4: Average word length heuristic (English words typically 4-5 chars avg)
    // Gibberish often has unusual word length patterns
    const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / words.length;
    if (words.length >= 15 && avgWordLength > 8 && !this.aoaDictionaryLoaded) {
      // Very long average word length without dictionary validation is suspicious
      return {
        isValid: false,
        error: 'Suspicious word length pattern'
      };
    }

    // Check 5: Gibberish can still have normal-looking stats but lack real words
    // Check for suspicious character sequences that don't appear in real English
    if (words.length >= 20) {
      let suspiciousWords = 0;
      words.forEach(word => {
        const lowerWord = word.toLowerCase();

        // Check for unusual consonant clusters (4+ consonants together, which is very rare in English)
        // Most English words have max 2-3 consecutive consonants
        if (/[bcdfghjklmnpqrstvwxz]{4,}/i.test(word)) {
          suspiciousWords++;
          return; // Count word once even if multiple patterns match
        }

        // Check for unusual vowel clusters (5+ vowels together)
        if (/[aeiou]{5,}/i.test(word)) {
          suspiciousWords++;
          return;
        }

        // Check for impossible letter combinations in English
        const hasImpossibleCombo = /([bcdfghjklmnpqrstvwxz]{2,}q[^u])|(zx[^a])|(xq)|(jx)|(q[^u][bcdfghjklmnpqrstvwxz])/i.test(word);
        if (hasImpossibleCombo) {
          suspiciousWords++;
        }
      });

      const suspiciousRatio = suspiciousWords / words.length;
      // If more than 25% of words have suspicious patterns, likely gibberish
      // Relaxed threshold to avoid false positives
      if (suspiciousRatio > 0.25) {
        return {
          isValid: false,
          error: 'Suspicious letter patterns detected'
        };
      }
    }

    return { isValid: true, error: null };
  }

  /**
   * Main estimation method (async version with real dependency parsing)
   */
  async estimate(text) {
    if (!text || text.trim().length === 0) {
      return {
        iq_estimate: null,
        confidence: 0,
        is_valid: false,
        error: 'Text is empty'
      };
    }

    const textWithoutEmoji = text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
    const words = textWithoutEmoji.match(/\b[a-zA-Z]{2,}\b/g) || [];

    if (words.length < 5) {
      return {
        iq_estimate: null,
        confidence: Math.max(0, words.length * 10),
        is_valid: false,
        error: `Too few words (${words.length}, minimum 5 required)`,
        word_count: words.length
      };
    }

    // Detect gibberish/nonsensical text
    const gibberishCheck = this._detectGibberish(textWithoutEmoji, words);
    if (!gibberishCheck.isValid) {
      return {
        iq_estimate: null,
        confidence: 0,
        is_valid: false,
        error: gibberishCheck.error,
        word_count: words.length
      };
    }

    // Detect if this is a tweet-length text (Twitter 280-char limit + buffer)
    const isTweetLength = text.length <= 300;

    // Extract features with real dependency parsing if available
    const features = await this._extractFeatures(text);
    const dimensions = this._computeDimensions(features, isTweetLength);

    // Apply hybrid calibration
    if (this.hybridCalibration.enabled) {
      this._applyHybridCalibration(dimensions, features);
    }

    let iq_estimate = this._combineDimensions(dimensions, features, isTweetLength);

    // Final calibration pass - adjust based on cross-dimensional signals
    iq_estimate = this._finalCalibrationPass(iq_estimate, dimensions, features);

    // Global upward bias: +20 points to compensate for systematic underestimation
    // Research shows our methodologies tend to underestimate high-IQ texts
    iq_estimate += 20;

    // Cap after bias adjustment (keep display range at 55-145)
    iq_estimate = Math.max(55, Math.min(145, iq_estimate));

    const confidence = this._computeConfidence(dimensions, features, words.length, text);

    return {
      iq_estimate: iq_estimate,
      confidence: confidence,
      dimension_scores: dimensions,
      features: features, // Include all computed features for debugging
      is_valid: true,
      error: null,
      word_count: words.length,
      is_twitter_calibrated: isTweetLength,  // Flag indicating Twitter-specific calibration was used
      text_length: text.length,
      improvements_used: {
        aoa_dictionary: this.aoaDictionaryLoaded,
        enhanced_dependency_approximation: true,
        hybrid_calibration: this.hybridCalibration.enabled,
        improved_normalization: true,
        advanced_word_detection: true,
        final_calibration: true,
        twitter_calibration: isTweetLength
      }
    };
  }

  /**
   * Synchronous estimate method (for backwards compatibility)
   * Uses approximation for dependency depth
   */
  estimateSync(text) {
    if (!text || text.trim().length === 0) {
      return {
        iq_estimate: null,
        confidence: 0,
        is_valid: false,
        error: 'Text is empty'
      };
    }

    const textWithoutEmoji = text.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
    const words = textWithoutEmoji.match(/\b[a-zA-Z]{2,}\b/g) || [];

    if (words.length < 5) {
      return {
        iq_estimate: null,
        confidence: Math.max(0, words.length * 10),
        is_valid: false,
        error: `Too few words (${words.length}, minimum 5 required)`,
        word_count: words.length
      };
    }

    // Detect gibberish/nonsensical text
    const gibberishCheck = this._detectGibberish(textWithoutEmoji, words);
    if (!gibberishCheck.isValid) {
      return {
        iq_estimate: null,
        confidence: 0,
        is_valid: false,
        error: gibberishCheck.error,
        word_count: words.length
      };
    }

    // Detect if this is a tweet-length text (Twitter 280-char limit + buffer)
    const isTweetLength = text.length <= 300;

    const features = this._extractFeaturesSync(text);
    const dimensions = this._computeDimensions(features, isTweetLength);

    if (this.hybridCalibration.enabled) {
      this._applyHybridCalibration(dimensions, features);
    }

    let iq_estimate = this._combineDimensions(dimensions, features, isTweetLength);
    iq_estimate = this._finalCalibrationPass(iq_estimate, dimensions, features);

    // Global upward bias: +20 points to compensate for systematic underestimation
    // Research shows our methodologies tend to underestimate high-IQ texts
    iq_estimate += 20;

    // Cap after bias adjustment (keep display range at 55-145)
    iq_estimate = Math.max(55, Math.min(145, iq_estimate));

    const confidence = this._computeConfidence(dimensions, features, words.length, text);

    return {
      iq_estimate: iq_estimate,
      confidence: confidence,
      dimension_scores: dimensions,
      features: features, // Include all computed features for debugging
      is_valid: true,
      error: null,
      word_count: words.length,
      is_twitter_calibrated: isTweetLength,  // Flag indicating Twitter-specific calibration was used
      text_length: text.length,
      improvements_used: {
        aoa_dictionary: this.aoaDictionaryLoaded,
        enhanced_dependency_approximation: true,
        hybrid_calibration: this.hybridCalibration.enabled,
        improved_normalization: true,
        advanced_word_detection: true,
        final_calibration: true,
        twitter_calibration: isTweetLength
      }
    };
  }

  /**
   * Final calibration pass - fine-tune based on cross-dimensional analysis
   */
  _finalCalibrationPass(iqEstimate, dimensions, features) {
    const vocab = dimensions.vocabulary_sophistication;
    const diversity = dimensions.lexical_diversity;
    const sentence = dimensions.sentence_complexity;
    const grammar = dimensions.grammatical_precision;

    // Calculate dimension average for reference
    const avgDimension = (vocab + diversity + sentence + grammar) / 4;

    // AGGRESSIVE HIGH-IQ CALIBRATION - Address underestimation at high IQ levels
    // Case 1: Very high dimensions but moderate estimate (common at IQ 120+)
    if (avgDimension > 120 && iqEstimate < 110) {
      // Strong boost - dimensions suggest high IQ but estimate is low
      iqEstimate = (iqEstimate * 0.5) + (avgDimension * 0.5);
    }
    // Case 2: High dimensions (115+) but estimate below 120
    else if (avgDimension > 115 && iqEstimate < 115) {
      // Moderate boost towards dimension average
      iqEstimate = (iqEstimate * 0.6) + (avgDimension * 0.4);
    }
    // Case 3: Moderate-high dimensions (110+) but estimate below dimension average
    else if (avgDimension > 110 && iqEstimate < avgDimension - 3) {
      // Adjust towards dimension average
      iqEstimate = (iqEstimate * 0.7) + (avgDimension * 0.3);
    }

    // Check for underestimation patterns - more aggressive
    // High vocab + high grammar + high sentence but lower IQ suggests underestimation
    if (vocab > 120 && grammar > 115 && sentence > 110 && iqEstimate < 115) {
      // Strong boost for very sophisticated text
      iqEstimate = Math.min(150, iqEstimate * 1.08);
    }
    else if (vocab > 115 && grammar > 105 && sentence > 100 && iqEstimate < 110) {
      // Moderate boost for sophisticated text
      iqEstimate = Math.min(150, iqEstimate * 1.05);
    }

    // High AoA with good match rate but low estimate - more trust in vocabulary
    if (this.aoaDictionaryLoaded && features.mean_aoa > 10 &&
        features.aoa_match_rate > 70 && iqEstimate < vocab) {
      // Trust vocabulary dimension more when AoA is strong
      const trustFactor = vocab > 125 ? 0.7 : 0.75; // More trust for very high vocab
      iqEstimate = (iqEstimate * trustFactor) + (vocab * (1 - trustFactor));
    }

    // Very high AoA (college+ level) - strong signal
    if (this.aoaDictionaryLoaded && features.mean_aoa > 12 &&
        features.aoa_match_rate > 75 && vocab > 115 && iqEstimate < vocab + 10) {
      // Boost towards vocab score for extremely sophisticated vocabulary
      iqEstimate = (iqEstimate * 0.65) + (vocab * 0.35);
    }

    // Handle case where we have many sophisticated unmatched words
    // (indicated by low match rate but long/complex words)
    if (this.aoaDictionaryLoaded && features.aoa_match_rate < 60) {
      const avgWordLength = features.avg_word_length || 0;
      const longWords = features.tokens ? features.tokens.filter(t => t.length >= 10).length : 0;
      const longWordPct = features.tokens ? (longWords / features.tokens.length) * 100 : 0;

      // If we have many long words but low match rate, they're likely sophisticated
      if (avgWordLength > 6 && longWordPct > 15 && iqEstimate < vocab + 5) {
        // Boost estimate - sophisticated unmatched words
        iqEstimate = Math.min(150, iqEstimate * 1.06);
      }
    }

    // Check for overestimation patterns
    // Low diversity + low grammar but high IQ might be overestimated
    if (diversity < 70 && grammar < 80 && iqEstimate > 100) {
      // Slight reduction for inconsistent signals
      iqEstimate = Math.max(50, iqEstimate * 0.98);
    }

    // Final safeguard: if all dimensions are very high (130+), ensure estimate reflects that
    const highDimensionCount = [vocab, diversity, sentence, grammar].filter(d => d > 125).length;
    if (highDimensionCount >= 3 && iqEstimate < 125) {
      // Multiple dimensions agree on very high IQ
      const highAvg = [vocab, diversity, sentence, grammar]
        .filter(d => d > 125)
        .reduce((a, b) => a + b, 0) / highDimensionCount;
      iqEstimate = Math.max(iqEstimate, highAvg * 0.85); // At least 85% of high dimension average
    }

    return Math.max(50, Math.min(150, iqEstimate));
  }

  /**
   * Extract features with improved AoA calculation (uses enhanced dependency approximation)
   */
  async _extractFeatures(text) {
    const normalizedText = this._normalizeText(text);
    const tokens = this._tokenize(normalizedText);
    const sentences = this._sentences(normalizedText);

    // Use enhanced dependency depth approximation (calibrated on Python results)
    let avgDependencyDepth = null;
    let usingRealParsing = false;

    if (this.spacyParser) {
      try {
        const depResult = await this.spacyParser.computeDependencyDepth(text);
        if (depResult) {
          avgDependencyDepth = depResult.avg_dependency_depth;
          usingRealParsing = false; // It's enhanced approximation, not real parsing
        }
      } catch (error) {
        console.warn('[IQEstimator] Dependency calculation failed:', error);
      }
    }

    // Compute AoA features with improved matching
    const aoaFeatures = this._computeAoAFeatures(tokens);

    // If low coverage, blend with approximation (improved blending)
    let meanAoa = aoaFeatures.mean_aoa;
    if (aoaFeatures.use_approximation) {
      const avgLength = tokens.reduce((sum, t) => sum + t.length, 0) / tokens.length;
      const avgSyllables = this._avgSyllables(tokens);
      const lengthFactor = (avgLength - 4.0) * 0.5;
      const syllableFactor = (avgSyllables - 1.5) * 0.3;
      const approximatedAoa = 3.91 + lengthFactor + syllableFactor;

      // Improved blending: trust dictionary more when match rate is higher
      // Use sigmoid-like function for smoother blending
      const matchRate = aoaFeatures.match_rate || 0;
      const blendFactor = Math.pow(matchRate / 100, 1.5); // More weight to dictionary when coverage is good
      meanAoa = meanAoa * blendFactor + approximatedAoa * (1 - blendFactor);
    }

    // Calculate sentence length variance (indicates complexity)
    const sentenceLengths = sentences.map(s => {
      const words = s.match(/\b\w+\b/g);
      return words ? words.length : 0;
    }).filter(len => len > 0);

    let sentenceVariance = 0;
    if (sentenceLengths.length > 1) {
      const avgSentLen = sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length;
      const variance = sentenceLengths.reduce((sum, len) => sum + Math.pow(len - avgSentLen, 2), 0) / sentenceLengths.length;
      sentenceVariance = Math.sqrt(variance); // Standard deviation
    }

    // Compute dependency depth using enhanced approximation
    let estimatedDepDepth;
    if (avgDependencyDepth !== null) {
      estimatedDepDepth = avgDependencyDepth;
    } else {
      // Fallback to basic approximation
      const punctComplexity = this._punctuationComplexity(normalizedText, sentences);
      const subClauses = this._countSubordinateClauses(normalizedText, sentences);
      estimatedDepDepth = this.depDepthCalibration.intercept +
        (punctComplexity * this.depDepthCalibration.punctuation_coefficient) +
        (subClauses * this.depDepthCalibration.clause_coefficient);
    }

    return {
      tokens: tokens,
      sentences: sentences,
      word_count: tokens.length, // Add word count for length-based adjustments
      sentence_count: sentences.length,
      original_text: normalizedText, // Add original text for casual structure detection
      avg_words_per_sentence: tokens.length / Math.max(1, sentences.length),
      sentence_variance: sentenceVariance,
      ttr: this._computeTTR(tokens),
      msttr: this._computeMSTTR(tokens),
      mtld: this._computeMTLD(tokens),
      yules_k: this._computeYulesK(tokens),
      avg_word_length: this._avgWordLength(tokens),
      avg_syllables: this._avgSyllables(tokens),
      punctuation_complexity: this._punctuationComplexity(normalizedText, sentences),
      punctuation_entropy: this._computePunctuationEntropy(normalizedText),
      subordinate_clauses: this._countSubordinateClauses(normalizedText, sentences),
      lexical_overlap: this._computeLexicalOverlap(sentences),
      connective_density: this._computeConnectiveDensity(normalizedText, tokens),
      readability: this._computeReadability(normalizedText, sentences, tokens),
      vocabulary_sophistication: this._vocabularySophistication(tokens),
      mean_aoa: meanAoa,
      pct_advanced: aoaFeatures.pct_advanced,
      aoa_match_rate: aoaFeatures.match_rate,
      avg_dependency_depth: estimatedDepDepth,
      using_real_dependency_parsing: usingRealParsing
    };
  }

  /**
   * Extract features synchronously (uses approximation for dependency depth)
   */
  _extractFeaturesSync(text) {
    const normalizedText = this._normalizeText(text);
    const tokens = this._tokenize(normalizedText);
    const sentences = this._sentences(normalizedText);

    // Compute AoA features with improved matching
    const aoaFeatures = this._computeAoAFeatures(tokens);

    // If low coverage, blend with approximation (improved blending)
    let meanAoa = aoaFeatures.mean_aoa;
    if (aoaFeatures.use_approximation) {
      const avgLength = tokens.reduce((sum, t) => sum + t.length, 0) / tokens.length;
      const avgSyllables = this._avgSyllables(tokens);
      const lengthFactor = (avgLength - 4.0) * 0.5;
      const syllableFactor = (avgSyllables - 1.5) * 0.3;
      const approximatedAoa = 3.91 + lengthFactor + syllableFactor;

      // Improved blending: trust dictionary more when match rate is higher
      const matchRate = aoaFeatures.match_rate || 0;
      const blendFactor = Math.pow(matchRate / 100, 1.5);
      meanAoa = meanAoa * blendFactor + approximatedAoa * (1 - blendFactor);
    }

    // Calculate sentence length variance
    const sentenceLengths = sentences.map(s => {
      const words = s.match(/\b\w+\b/g);
      return words ? words.length : 0;
    }).filter(len => len > 0);

    let sentenceVariance = 0;
    if (sentenceLengths.length > 1) {
      const avgSentLen = sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length;
      const variance = sentenceLengths.reduce((sum, len) => sum + Math.pow(len - avgSentLen, 2), 0) / sentenceLengths.length;
      sentenceVariance = Math.sqrt(variance);
    }

    // Use approximation for dependency depth (sync version)
    const punctComplexity = this._punctuationComplexity(normalizedText, sentences);
    const subClauses = this._countSubordinateClauses(normalizedText, sentences);
    const estimatedDepDepth = this.depDepthCalibration.intercept +
      (punctComplexity * this.depDepthCalibration.punctuation_coefficient) +
      (subClauses * this.depDepthCalibration.clause_coefficient);

    return {
      tokens: tokens,
      sentences: sentences,
      word_count: tokens.length, // Add word count for length-based adjustments
      sentence_count: sentences.length,
      original_text: normalizedText, // Add original text for casual structure detection
      avg_words_per_sentence: tokens.length / Math.max(1, sentences.length),
      sentence_variance: sentenceVariance,
      ttr: this._computeTTR(tokens),
      msttr: this._computeMSTTR(tokens),
      mtld: this._computeMTLD(tokens),
      yules_k: this._computeYulesK(tokens),
      avg_word_length: this._avgWordLength(tokens),
      avg_syllables: this._avgSyllables(tokens),
      punctuation_complexity: punctComplexity,
      punctuation_entropy: this._computePunctuationEntropy(normalizedText),
      subordinate_clauses: subClauses,
      lexical_overlap: this._computeLexicalOverlap(sentences),
      connective_density: this._computeConnectiveDensity(normalizedText, tokens),
      readability: this._computeReadability(normalizedText, sentences, tokens),
      vocabulary_sophistication: this._vocabularySophistication(tokens),
      mean_aoa: meanAoa,
      pct_advanced: aoaFeatures.pct_advanced,
      aoa_match_rate: aoaFeatures.match_rate,
      avg_dependency_depth: estimatedDepDepth,
      using_real_dependency_parsing: false
    };
  }

  /**
   * Compute dimension scores
   * @param {boolean} isTweetLength - If true, apply Twitter-specific adjustments
   */
  _computeDimensions(features, isTweetLength = false) {
    return {
      vocabulary_sophistication: this._vocabularyIQ(features, isTweetLength),
      lexical_diversity: this._diversityIQ(features),
      sentence_complexity: this._sentenceComplexityIQ(features, isTweetLength),
      grammatical_precision: this._grammarIQ(features)
    };
  }

  /**
   * Vocabulary Sophistication IQ - improved with proper pct_advanced
   * Twitter adjustment: Vocabulary choice becomes MORE critical in constrained spaces
   */
  _vocabularyIQ(features, isTweetLength = false) {
    const meanAoa = features.mean_aoa || 3.91;

    // Use pct_advanced from AoA dictionary if available, otherwise fallback
    let pctAdvanced = features.pct_advanced || 0;
    if (!this.aoaDictionaryLoaded || features.aoa_match_rate < 50) {
      // Fallback: count advanced words (8+ chars)
      const advancedWords = features.tokens.filter(t => t.length >= 8).length;
      pctAdvanced = features.tokens.length > 0 ? (advancedWords / features.tokens.length) * 100 : 0;
    }

    // Apply trained mapping: base_iq = 70 + (mean_aoa - 3.91) * 24
    let baseIQ = 70 + (meanAoa - 3.91) * 24;

    // Add boost for advanced words (trained: +1.0 per %)
    // But scale based on match rate for accuracy
    // For tweets, word efficiency matters MORE - add slight boost
    const matchRate = features.aoa_match_rate || 0;
    let advancedBoost = this.aoaDictionaryLoaded && matchRate > 50
      ? (pctAdvanced / 100) * 1.0  // Full boost with good dictionary coverage
      : (pctAdvanced / 100) * 0.8;  // Reduced boost with approximation
    // Twitter adjustment: 20% boost for word efficiency in constrained space
    if (isTweetLength) {
      advancedBoost *= 1.2;
    }
    baseIQ += advancedBoost;

    // Remove hard cap at 130 - allow higher scores for very sophisticated vocabulary
    // Cap at 145 to allow room for very high IQ while preventing outliers
    return Math.max(50, Math.min(145, baseIQ));
  }

  /**
   * Lexical Diversity IQ - enhanced with MTLD and Yule's K
   * FIXED: Applies length-based normalization to prevent inflation for short texts
   */
  _diversityIQ(features) {
    const ttr = features.ttr || 0.5;
    const wordCount = features.word_count || (features.tokens?.length || 0);

    // REMOVED: Length-adjusted TTR - TTR is already a ratio and should be length-independent
    // A short text with high TTR is genuinely more diverse, not an artifact
    // Quality of vocabulary choice matters, not the quantity of words
    let adjustedTTR = ttr;

    let iq = 70 + (adjustedTTR - 0.659) * 170;

    // Boost for MTLD (higher = more diverse vocabulary usage)
    // MTLD naturally increases with length, so we normalize it to be length-independent
    const mtld = features.mtld || 0;
    if (mtld > 20 && wordCount > 0) {
      // Normalize MTLD by word count to make it length-independent
      // A short text with high MTLD/word ratio should score similarly to a long text
      // Use ratio instead of absolute value to prevent length bias
      const mtldRatio = mtld / wordCount;
      // Scale based on ratio: higher ratio = more diverse relative to length
      let mtldBoost = (mtldRatio * 100 - 0.2) * 0.5; // Adjusted scaling for ratio
      // Cap the boost and only apply if ratio indicates meaningful diversity
      if (mtldRatio > 0.2 && mtldRatio < 1.0) { // Reasonable range
        iq += Math.min(5, Math.max(0, mtldBoost));
      } else if (mtld > 20 && wordCount < 50) {
        // For very short texts, use absolute value but with lower threshold
        // This handles edge cases where ratio might be misleading
        let absoluteBoost = (mtld - 15) * 0.15;
        if (mtld >= wordCount * 0.8) {
          absoluteBoost *= 0.5; // Reduce if MTLD is close to word count (artifact)
        }
        iq += Math.min(3, Math.max(0, absoluteBoost));
      }
    }

    // Adjust for Yule's K (lower = more diverse, higher = repetitive)
    const yulesK = features.yules_k || 0;
    if (yulesK > 0 && yulesK < 100) {
      // Lower Yule's K indicates more diversity
      iq += Math.min(3, (100 - yulesK) * 0.03);
    } else if (yulesK > 200) {
      // High Yule's K indicates repetitiveness
      iq -= Math.min(5, (yulesK - 200) * 0.02);
    }

    // REMOVED: Length-based cap - length should not limit IQ score
    // A short, diverse text can score as high as a long one

    // Allow higher diversity scores for very sophisticated texts
    return Math.max(50, Math.min(145, iq));
  }

  /**
   * Sentence Complexity IQ - enhanced with variance, readability, and lexical overlap
   * FIXED: Detects casual run-on sentences with parentheticals to prevent inflation
   * Twitter adjustment: Lower baseline for tweet-length texts due to 280-char constraint
   */
  _sentenceComplexityIQ(features, isTweetLength = false) {
    const avgWords = features.avg_words_per_sentence || 10;
    const sentenceCount = features.sentence_count || 1;
    const wordCount = features.word_count || (features.tokens?.length || 0);
    const originalText = features.original_text || '';

    // Use Twitter-adjusted baseline for tweet-length texts
    const baseline = isTweetLength ? this.twitterSentenceBaseline : this.essaySentenceBaseline;
    let iq = 60 + (avgWords - baseline) * 6.0;

    // ENHANCED: Detect casual Twitter run-on sentences
    // On social media, people string thoughts together without proper punctuation
    // This is NOT sophisticated writing - it's just how Twitter incentivizes casual communication

    // 1. Detect parenthetical-heavy casual writing
    const parentheticalCount = (originalText.match(/\([^)]+\)/g) || []).length;
    const parentheticalRatio = sentenceCount > 0 ? parentheticalCount / sentenceCount : 0;

    // 2. Detect LOW punctuation density (indicates run-on, not sophisticated structure)
    const punctuationMarks = (originalText.match(/[,;:.—-]/g) || []).length;
    const punctuationDensity = wordCount > 0 ? punctuationMarks / wordCount : 0;

    // 3. Detect casual connective patterns (strings thoughts together)
    const casualConnectives = /\b(and\s+also|also\s+note|and\s+then|and\s+so|and\s+but)\b/gi;
    const casualConnectiveCount = (originalText.match(casualConnectives) || []).length;

    // 4. Detect sentences that start with casual connectives (common Twitter pattern)
    const startsWithCasual = /^(and\s+|also\s+|then\s+|so\s+)/i.test(originalText.trim());

    // Calculate run-on score (higher = more likely to be casual run-on)
    let runOnScore = 0;

    // Single long sentence with low punctuation = run-on
    if (sentenceCount === 1 && avgWords > 15) {
      // Penalty increases with length and decreases with punctuation density
      // Sophisticated writing uses punctuation to structure long sentences
      if (punctuationDensity < 0.05) { // Less than 1 punctuation per 20 words
        // Very likely a run-on
        runOnScore += (avgWords - 15) * 0.5; // More penalty for longer sentences
      } else if (punctuationDensity < 0.10) { // Less than 1 punctuation per 10 words
        // Possibly a run-on
        runOnScore += (avgWords - 15) * 0.25;
      }

      // Additional penalty for casual connectives
      if (startsWithCasual) {
        runOnScore += 5; // Starting with "And also" etc. is very casual
      }
      runOnScore += casualConnectiveCount * 3; // Each casual connective pattern adds penalty
    }

    // Parenthetical-heavy pattern (existing detection, enhanced)
    if (sentenceCount === 1 && parentheticalRatio >= 0.5 && avgWords > 30) {
      runOnScore += 10;
    }

    // Apply penalty based on run-on score
    // Higher score = more likely casual run-on = more penalty
    if (runOnScore > 0) {
      // Cap penalty at 60% reduction for extreme cases
      const penaltyPercent = Math.min(0.6, runOnScore / 30); // Scale to 0-0.6
      const reductionFactor = penaltyPercent;
      iq *= (1 - reductionFactor);

      // Additional penalty: reduce or eliminate length bonus for obvious run-ons
      if (runOnScore > 15 && avgWords > 20) {
        // For very obvious run-ons, cap the sentence length bonus
        // Don't reward length if it's just a run-on
        const lengthBonus = (avgWords - baseline) * 6.0;
        if (lengthBonus > 30) { // Only penalize if there's a significant bonus
          iq -= (lengthBonus - 30) * 0.5; // Reduce excessive length bonus
        }
      }
    }

    // Boost for sentence variance (variety indicates sophistication)
    // Normalize by sentence count to prevent longer texts from getting inflated scores
    // Only apply if we have multiple sentences (variance is meaningful)
    const variance = features.sentence_variance || 0;
    if (variance > 5 && avgWords > 12 && sentenceCount > 1) {
      // Normalize variance boost by sentence count to make it length-independent
      // This ensures a 2-sentence tweet with high variance scores similarly to a 20-sentence essay
      const normalizedVariance = variance / Math.sqrt(sentenceCount);
      iq += Math.min(8, normalizedVariance * 0.6);
    }

    // Readability boost (higher grade level = more complex writing)
    // Normalize by sentence count to prevent longer texts from getting inflated scores
    // Readability metrics naturally favor longer texts, so we normalize them
    const readability = features.readability || {};
    if (readability.flesch_kincaid) {
      const fkGrade = readability.flesch_kincaid;
      if (fkGrade > 12) {
        let readabilityBoost = (fkGrade - 12) * 0.5;
        // Normalize by sentence count - a complex 2-sentence tweet should score
        // similarly to a complex 20-sentence essay with same grade level
        // Use log scaling to prevent over-penalizing longer texts
        if (sentenceCount > 1) {
          readabilityBoost *= Math.min(1.0, Math.log(sentenceCount + 1) / Math.log(3));
        } else {
          // Single sentence - reduce boost as it's often length-inflated
          readabilityBoost *= 0.5;
        }
        iq += Math.min(5, readabilityBoost);
      }
    }

    // Lower lexical overlap = more varied writing = higher complexity
    // Only apply for multi-sentence texts
    // This metric is already normalized (ratio), so length doesn't directly affect it
    // But we should ensure avgWords requirement isn't biasing toward longer texts
    const lexicalOverlap = features.lexical_overlap || 0;
    if (lexicalOverlap < 0.2 && avgWords > 15 && sentenceCount > 1) {
      // Very low overlap with long sentences = sophisticated writing
      // This boost is appropriate as lexical overlap is already a percentage/ratio
      iq += Math.min(4, (0.2 - lexicalOverlap) * 20);
    }

    // REMOVED: Length-based cap - length should not limit IQ score
    // A short, sophisticated text can score as high as a long one

    return Math.max(50, Math.min(145, iq));
  }

  /**
   * Grammatical Precision IQ - enhanced with punctuation entropy and connectives
   * FIXED: Reduces punctuation boost for parenthetical-heavy casual texts
   */
  _grammarIQ(features) {
    const wordCount = features.word_count || (features.tokens?.length || 0);
    const originalText = features.original_text || '';
    const sentenceCount = features.sentence_count || 1;
    const avgWords = features.avg_words_per_sentence || (wordCount / sentenceCount);

    // Use enhanced dependency depth approximation
    const depDepth = features.avg_dependency_depth ||
      (this.depDepthCalibration.intercept +
       ((features.punctuation_complexity || 0) * this.depDepthCalibration.punctuation_coefficient) +
       ((features.subordinate_clauses || 0) * this.depDepthCalibration.clause_coefficient));

    let iq = 53 + (depDepth - 1.795) * 80;

    // ENHANCED: Detect casual Twitter run-on patterns that inflate dependency depth
    // High dependency depth from run-ons (lack of punctuation) != sophisticated grammar
    // Sophisticated writing uses punctuation to structure complex sentences

    // 1. Detect LOW punctuation density (indicates run-on)
    const punctuationMarks = (originalText.match(/[,;:.—-]/g) || []).length;
    const punctuationDensity = wordCount > 0 ? punctuationMarks / wordCount : 0;

    // 2. Detect casual connective patterns
    const casualConnectives = /\b(and\s+also|also\s+note|and\s+then|and\s+so|and\s+but)\b/gi;
    const casualConnectiveCount = (originalText.match(casualConnectives) || []).length;
    const startsWithCasual = /^(and\s+|also\s+|then\s+|so\s+)/i.test(originalText.trim());

    // 3. Calculate run-on penalty for dependency depth
    // If dependency depth is high due to run-on (not sophisticated structure), reduce it
    let runOnDepthPenalty = 0;
    let runOnIQPenalty = 0; // Direct IQ penalty for obvious run-ons

    // Single long sentence with low punctuation = run-on inflating depth
    if (sentenceCount === 1 && avgWords > 15) {
      // Sophisticated long sentences use punctuation to structure (commas, semicolons, etc.)
      // Run-ons just string words together without structure
      if (punctuationDensity < 0.05) {
        // Very low punctuation = run-on, depth is artificially inflated
        // Penalty scales with how long the sentence is (longer = more inflated)
        runOnDepthPenalty = (avgWords - 15) * 0.03; // Increased from 0.02 - more aggressive
        // Also add direct IQ penalty for very obvious run-ons
        runOnIQPenalty += (avgWords - 15) * 1.5; // Direct IQ reduction
      } else if (punctuationDensity < 0.10) {
        // Moderate punctuation = possibly a run-on
        runOnDepthPenalty = (avgWords - 15) * 0.015;
        runOnIQPenalty += (avgWords - 15) * 0.75;
      }

      // Additional penalty for casual connectives (confirms it's a run-on)
      // These patterns strongly indicate casual speech, not sophisticated grammar
      if (startsWithCasual) {
        runOnDepthPenalty += 0.25; // Increased from 0.15
        runOnIQPenalty += 15; // Starting with "And also" is very casual - direct penalty
      }
      runOnDepthPenalty += casualConnectiveCount * 0.12; // Increased from 0.08
      runOnIQPenalty += casualConnectiveCount * 8; // Each casual connective = direct penalty

      // Apply penalty: reduce the effective dependency depth
      if (runOnDepthPenalty > 0) {
        const adjustedDepDepth = Math.max(1.795, depDepth - runOnDepthPenalty);
        // Recalculate IQ with adjusted depth
        iq = 53 + (adjustedDepDepth - 1.795) * 80;
      }

      // Apply direct IQ penalty for obvious run-ons
      // Run-ons demonstrate poor grammar control, not sophistication
      if (runOnIQPenalty > 0) {
        iq = Math.max(50, iq - runOnIQPenalty);
      }
    }

    // Detect parenthetical-heavy casual writing
    const parentheticalCount = (originalText.match(/\([^)]+\)/g) || []).length;
    const parentheticalRatio = wordCount > 0 ? parentheticalCount / wordCount : 0;

    // Boost for punctuation entropy (more varied punctuation = more sophisticated)
    // But reduce boost if text is heavily parenthetical (casual style)
    const punctEntropy = features.punctuation_entropy || 0;
    if (punctEntropy > 2.0) {
      let entropyBoost = (punctEntropy - 2.0) * 1.0;
      // Reduce boost for parenthetical-heavy texts (casual, not sophisticated)
      if (parentheticalRatio > 0.05) {
        entropyBoost *= (1 - parentheticalRatio * 10); // Reduce based on ratio
      }
      iq += Math.min(4, Math.max(0, entropyBoost));
    }

    // Boost for connective density (better logical flow = higher IQ)
    const connectiveDensity = features.connective_density || 0;
    if (connectiveDensity > 0.08 && connectiveDensity < 0.20) {
      // Optimal connective density (too much = repetitive)
      iq += Math.min(3, (connectiveDensity - 0.08) * 25);
    }

    // REMOVED: Length-based cap - length should not limit IQ score
    // A short, grammatically precise text can score as high as a long one

    return Math.max(50, Math.min(145, iq));
  }

  /**
   * Apply hybrid calibration adjustments (optimized for accuracy)
   */
  _applyHybridCalibration(dimensions, features) {
    // Enhanced vocabulary adjustment - more nuanced
    if (this.hybridCalibration.vocabularyAdjustment && this.aoaDictionaryLoaded) {
      const vocabScore = dimensions.vocabulary_sophistication;
      const meanAoa = features.mean_aoa || 0;
      const matchRate = features.aoa_match_rate || 0;
      const pctAdvanced = features.pct_advanced || 0;

      // High AoA with good coverage and high advanced word percentage
      if (meanAoa > 8 && matchRate > 65 && pctAdvanced > 20 && vocabScore < 120) {
        const boost = Math.min(1.15, 1.0 + (pctAdvanced / 100) * 0.6);
        dimensions.vocabulary_sophistication = Math.min(145, vocabScore * boost);
      }
      // Very sophisticated vocabulary (AoA > 10)
      else if (meanAoa > 10 && matchRate > 70 && vocabScore > 100 && vocabScore < 135) {
        dimensions.vocabulary_sophistication = Math.min(145, vocabScore * 1.08);
      }
      // Extreme sophistication (AoA > 12) - more aggressive boost
      else if (meanAoa > 12 && matchRate > 75) {
        if (vocabScore < 135) {
          dimensions.vocabulary_sophistication = Math.min(145, vocabScore * 1.12);
        } else if (vocabScore < 140) {
          dimensions.vocabulary_sophistication = Math.min(145, vocabScore * 1.05);
        }
      }
    }

    // Enhanced syntax adjustment - more precise
    if (this.hybridCalibration.syntaxAdjustment) {
      const grammarScore = dimensions.grammatical_precision;
      const punctComplexity = features.punctuation_complexity || 0;
      const subClauses = features.subordinate_clauses || 0;
      const avgWords = features.avg_words_per_sentence || 0;

      // Moderate complexity that might be underestimated
      if (punctComplexity > 2.5 && subClauses > 1.2 && avgWords > 15 && grammarScore < 105) {
        dimensions.grammatical_precision = Math.min(145, grammarScore * 1.1);
      }
      // High complexity with long sentences
      else if (punctComplexity > 3.5 && subClauses > 1.8 && avgWords > 20 && grammarScore < 120) {
        dimensions.grammatical_precision = Math.min(145, grammarScore * 1.15);
      }
      // Very high complexity
      else if (punctComplexity > 4.5 && subClauses > 2.5 && grammarScore < 135) {
        dimensions.grammatical_precision = Math.min(145, grammarScore * 1.18);
      }
      // Extreme complexity
      else if (punctComplexity > 5.5 && subClauses > 3.0 && grammarScore < 140) {
        dimensions.grammatical_precision = Math.min(145, grammarScore * 1.2);
      }
    }
  }

  /**
   * Combine dimensions
   * FIXED: Applies length-based penalty for very short texts
   */
  _combineDimensions(dimensions, features = null, isTweetLength = false) {
    let totalWeight = 0;
    let weightedSum = 0;

    // Use Twitter-specific weights for tweet-length texts
    const weights = isTweetLength ? this.twitterWeights : this.dimensionWeights;

    for (const [dim, iq] of Object.entries(dimensions)) {
      const weight = weights[dim] || 0;
      weightedSum += iq * weight;
      totalWeight += weight;
    }

    if (totalWeight === 0) {
      return 100.0;
    }

    let finalIQ = weightedSum / totalWeight;

    // REMOVED: Length-based penalty - length should not affect IQ score
    // A short, complex tweet should score the same as a long, complex essay
    // Quality matters, not quantity

    return Math.max(50, Math.min(150, finalIQ));
  }

  /**
   * Compute confidence - Anti-Gaming, Quality-Focused Approach
   *
   * Confidence reflects RELIABILITY of the IQ estimate, based on:
   * 1. Signal quality (not just quantity) - Are metrics meaningful or noise?
   * 2. Dimension agreement - Do all 4 dimensions converge on same estimate?
   * 3. Feature reliability - Dictionary coverage, metric stability
   * 4. Text coherence - Is it actual sophisticated writing or padded text?
   *
   * KEY: Length helps ONLY if it provides MEANINGFUL VARIETY, not repetition.
   * Cannot be gamed by just writing more words - quality matters more.
   */
  _computeConfidence(dimensions, features, wordCount, originalText) {
    // ========== 1. SIGNAL QUALITY FACTOR (Primary - Cannot be gamed) ==========
    // Measure how STRONG and RELIABLE the signal is, not just how much text exists
    let signalQuality = 0;

    // Lexical diversity ratio (TTR) - Higher = more varied vocabulary
    // This can't be gamed by length alone - repetition lowers TTR
    const ttr = features.ttr || 0.5;
    const uniqueWords = new Set((features.tokens || []).map(t => t.toLowerCase())).size;
    const totalWords = features.tokens?.length || wordCount;
    const actualTTR = totalWords > 0 ? uniqueWords / totalWords : 0;

    // Signal quality from vocabulary diversity (0-25 points, stricter)
    // Most tweets have TTR around 0.5-0.7, so we're conservative
    if (actualTTR >= 0.8) {
      signalQuality += 25; // Extremely diverse (rare)
    } else if (actualTTR >= 0.7) {
      signalQuality += 20; // Very diverse
    } else if (actualTTR >= 0.6) {
      signalQuality += 15; // Good diversity
    } else if (actualTTR >= 0.5) {
      signalQuality += 10; // Moderate diversity (typical)
    } else if (actualTTR >= 0.4) {
      signalQuality += 5; // Low diversity (repetitive)
    } else {
      signalQuality += 0; // Very repetitive (weak signal)
    }

    // Sentence variety (variance) - Multiple varied sentences = stronger signal
    const sentenceCount = features.sentences?.length || features.sentence_count || 1;
    const sentenceVariance = features.sentence_variance || 0;
    if (sentenceCount >= 5 && sentenceVariance > 3) {
      signalQuality += 15; // Multiple varied sentences = reliable
    } else if (sentenceCount >= 3 && sentenceVariance > 2) {
      signalQuality += 10; // Some variety
    } else if (sentenceCount >= 2) {
      signalQuality += 5; // At least multiple sentences
    } else {
      signalQuality += 0; // Single sentence = limited signal
    }

    // ENHANCED: Detect run-on sentences (low punctuation density = weak signal quality)
    // Run-ons indicate casual speech patterns, not sophisticated writing
    // This reduces signal quality because the metrics are less reliable
    // (variables declared here, reused later in anti-gaming checks)
    const avgWordsPerSentence = features.avg_words_per_sentence || (wordCount / sentenceCount);
    let punctuationMarks = (originalText.match(/[,;:.—-]/g) || []).length;
    let punctuationDensity = wordCount > 0 ? punctuationMarks / wordCount : 0;
    if (sentenceCount === 1 && avgWordsPerSentence > 15 && punctuationDensity < 0.05) {
      // Very low punctuation in long sentence = run-on = weaker signal
      signalQuality -= 5; // Reduce signal quality for obvious run-ons
    }

    // Word sophistication (AoA) - Advanced vocabulary indicates meaningful signal
    const meanAoa = features.mean_aoa || 0;
    if (meanAoa >= 10) {
      signalQuality += 15; // Very sophisticated vocabulary
    } else if (meanAoa >= 8) {
      signalQuality += 10; // Moderately sophisticated
    } else if (meanAoa >= 6) {
      signalQuality += 5; // Some sophistication
    } else {
      signalQuality += 0; // Basic vocabulary
    }

    // Apply sample size penalty - short texts have less reliable metrics
    // Even good signal is less reliable with less data
    let sampleSizePenalty = 0;
    if (wordCount < 15) {
      sampleSizePenalty = 15; // Significant penalty for very short texts
    } else if (wordCount < 25) {
      sampleSizePenalty = 10; // Penalty for short texts
    } else if (wordCount < 50) {
      sampleSizePenalty = 5; // Small penalty for medium texts
    }

    signalQuality = Math.max(0, signalQuality - sampleSizePenalty);

    // Normalize signal quality to 0-100 scale (max possible: 55 from above)
    // Use stricter normalization - don't inflate mediocre scores
    signalQuality = Math.min(100, (signalQuality / 55) * 100);

    // ========== 2. DIMENSION AGREEMENT FACTOR (Critical - Cannot be faked) ==========
    // When all 4 dimensions agree, we have high confidence
    // When they disagree, the estimate is less reliable
    const iqValues = Object.values(dimensions);
    let agreementScore = 30; // Lower default - start from skepticism

    if (iqValues.length >= 4) {
      const mean = iqValues.reduce((a, b) => a + b, 0) / iqValues.length;
      const variance = iqValues.reduce((sum, iq) => sum + Math.pow(iq - mean, 2), 0) / iqValues.length;
      const stdDev = Math.sqrt(variance);

      // Stricter agreement scoring - most tweets have moderate disagreement
      // Perfect agreement (stdDev = 0) → 100% confidence
      // High agreement (stdDev ≤ 5) → 85-100% confidence
      // Moderate agreement (stdDev 5-10) → 60-85% confidence
      // Low agreement (stdDev 10-15) → 40-60% confidence
      // Poor agreement (stdDev > 15) → 20-40% confidence
      if (stdDev <= 3) {
        agreementScore = 100 - (stdDev * 3); // 91% at stdDev=3
      } else if (stdDev <= 5) {
        agreementScore = 91 - ((stdDev - 3) * 3); // 85% at stdDev=5
      } else if (stdDev <= 10) {
        agreementScore = 85 - ((stdDev - 5) * 5); // 60% at stdDev=10
      } else if (stdDev <= 15) {
        agreementScore = 60 - ((stdDev - 10) * 4); // 40% at stdDev=15
      } else {
        agreementScore = Math.max(20, 40 - ((stdDev - 15) * 1.33)); // Min 20%
      }
    }

    // ========== 3. FEATURE RELIABILITY FACTOR ==========
    // How reliable are the features we're using?
    let featureReliability = 30; // Lower default - start skeptical

    // AoA dictionary coverage - Higher match rate = more reliable vocabulary analysis
    if (this.aoaDictionaryLoaded) {
      const matchRate = features.aoa_match_rate || 0;
      if (matchRate >= 80) {
        featureReliability = 90; // Excellent - most words matched
      } else if (matchRate >= 65) {
        featureReliability = 70; // Good coverage
      } else if (matchRate >= 50) {
        featureReliability = 50; // Moderate coverage
      } else if (matchRate >= 35) {
        featureReliability = 35; // Low coverage
      } else {
        featureReliability = 25; // Poor coverage - unreliable
      }
    } else {
      // No dictionary - using approximations, less reliable
      featureReliability = 20;
    }

    // Feature completeness - Having all metrics available
    const hasReadability = features.readability && Object.keys(features.readability).length > 0;
    const hasDiversityMetrics = features.ttr !== undefined && features.mtld !== undefined;
    const hasGrammarMetrics = features.avg_dependency_depth !== undefined ||
                              features.punctuation_complexity !== undefined;

    if (hasReadability && hasDiversityMetrics && hasGrammarMetrics) {
      featureReliability = Math.min(100, featureReliability + 10); // All features available
    } else if ((hasReadability && hasDiversityMetrics) ||
               (hasReadability && hasGrammarMetrics) ||
               (hasDiversityMetrics && hasGrammarMetrics)) {
      featureReliability = Math.min(100, featureReliability + 5); // Most features available
    }

    // ========== 4. ANTI-GAMING CHECKS ==========
    // Detect attempts to inflate confidence through padding/repetition
    let gamingPenalty = 0;

    // Check for excessive repetition (can't game by repeating words)
    const repetitionRatio = totalWords > 0 ? (totalWords - uniqueWords) / totalWords : 0;
    if (repetitionRatio > 0.6 && wordCount > 30) {
      gamingPenalty += 15; // Highly repetitive = weak signal
    } else if (repetitionRatio > 0.5 && wordCount > 20) {
      gamingPenalty += 10; // Moderately repetitive
    } else if (repetitionRatio > 0.4 && wordCount > 15) {
      gamingPenalty += 5; // Some repetition
    }

    // Check for meaningless padding (very short sentences, fragments)
    // Reuse avgWordsPerSentence already declared in signal quality section
    if (avgWordsPerSentence < 4 && sentenceCount > 3) {
      gamingPenalty += 10; // Fragmentary text = weak signal
    }

        // ENHANCED: Detect casual Twitter run-on patterns (same logic as IQ calculations)
    // Run-ons create artificial dimension inflation and reduce reliability
    // Reuse variables already declared in signal quality section above
    const casualConnectives = /\b(and\s+also|also\s+note|and\s+then|and\s+so|and\s+but)\b/gi;
    const casualConnectiveCount = (originalText.match(casualConnectives) || []).length;
    const startsWithCasual = /^(and\s+|also\s+|then\s+|so\s+)/i.test(originalText.trim());

    let runOnConfidencePenalty = 0;

    // Single long sentence with low punctuation = run-on (less reliable)
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

      // Parenthetical-heavy pattern (existing check, enhanced)
      const parentheticalCount = (originalText.match(/\([^)]+\)/g) || []).length;
      if (parentheticalCount >= 4) {
        runOnConfidencePenalty += 8; // Casual run-on pattern
      }
    }

    gamingPenalty += runOnConfidencePenalty;

    // ========== 5. SAMPLE SIZE CONSTRAINT ==========
    // Short texts inherently have less reliable estimates
    // Use smooth, continuous scaling instead of coarse steps to avoid clustering
    let sampleSizeConstraint = 1.0; // Multiplier

    if (wordCount < 100) {
      // Smooth scaling: confidence increases logarithmically with word count
      // At 10 words: ~0.42, at 50 words: ~0.78, at 100 words: ~1.0
      // This creates natural variation instead of clustering at fixed multipliers
      const logFactor = Math.log(wordCount + 1) / Math.log(101); // Normalized log scale
      sampleSizeConstraint = 0.35 + (logFactor * 0.65); // Range: 0.35 to 1.0
    }
    // 100+ words: Full confidence allowed (no constraint)

    // ========== 6. COMBINE FACTORS ==========
    // Weight factors based on their importance for RELIABILITY
    // Signal quality and agreement matter most - these can't be gamed
    const signalWeight = 0.40;      // Most important: signal strength
    const agreementWeight = 0.40;   // Equally important: dimension consensus
    const featureWeight = 0.20;     // Important: measurement reliability

    let confidence = (signalQuality * signalWeight) +
                     (agreementScore * agreementWeight) +
                     (featureReliability * featureWeight);

    // Apply gaming penalties
    confidence -= gamingPenalty;

    // Apply sample size constraint (reduces confidence for short texts)
    // This naturally handles length limitations - no need for hard caps
    confidence *= sampleSizeConstraint;

    // ========== 7. FINAL BOUNDS ==========
    // Only apply absolute minimum/maximum bounds - let calculation flow naturally
    // The sample size constraint and penalties already handle length limitations

    // Absolute minimum: Even perfect agreement needs some data
    // Absolute maximum: Even perfect signal has some uncertainty
    confidence = Math.max(12, Math.min(94, confidence));

    // Round to whole number for display (preserves precision from calculation)
    return Math.round(confidence);
  }

  // ========== Feature Extraction Helpers ==========

  _normalizeText(text) {
    return text
      .replace(/https?:\/\/[^\s]+/g, '')
      .replace(/\bwww\.[^\s]+/g, '')
      .replace(/\b(x\.com|twitter\.com)[^\s]*/g, '')
      .replace(/\bt\.co\/[a-zA-Z0-9]+/g, '')
      .replace(/\b[a-zA-Z0-9-]+\.(com|org|net|io|co|edu|gov)[^\s]*/g, '')
      // Remove standalone domain patterns (without protocol)
      .replace(/\b[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}(?:\/[^\s]*)?/gi, '')
      // Remove academic paper ID patterns (like "as.2414926122", "ev.12272")
      .replace(/\b[a-z]{1,4}\.[0-9]{5,12}\b/gi, '')
      // Remove URL path fragments with slashes
      .replace(/\b[a-zA-Z0-9-]+\/[a-zA-Z0-9\/\-_]{3,}\b/g, '')
      // Remove numbers followed by paths
      .replace(/\b\d+\/[a-zA-Z0-9\/\-_.]+\b/g, '')
      // Remove standalone path segments
      .replace(/\s\/[a-zA-Z0-9\/\-_]{5,}\b/g, ' ')
      .replace(/@\w+/g, '')
      .replace(/#\w+/g, '')
      .replace(/[^\w\s.,!?;:()'-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  _tokenize(text) {
    const matches = text.match(/\b\w+\b/g);
    return matches ? matches.map(w => w.toLowerCase()) : [];
  }

  _sentences(text) {
    return text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  }

  _computeTTR(tokens) {
    if (tokens.length === 0) return 0;
    const uniqueTokens = new Set(tokens).size;
    return uniqueTokens / tokens.length;
  }

  _computeMSTTR(tokens, segmentSize = 100) {
    if (tokens.length === 0) return 0;
    const segments = [];
    for (let i = 0; i < tokens.length; i += segmentSize) {
      segments.push(tokens.slice(i, i + segmentSize));
    }
    if (segments.length === 0) return 0;
    const ttrs = segments.map(seg => {
      const unique = new Set(seg).size;
      return unique / seg.length;
    });
    return ttrs.reduce((a, b) => a + b, 0) / ttrs.length;
  }

  _avgWordLength(tokens) {
    if (tokens.length === 0) return 0;
    const totalChars = tokens.reduce((sum, t) => sum + t.length, 0);
    return totalChars / tokens.length;
  }

  _avgSyllables(tokens) {
    if (tokens.length === 0) return 0;
    const totalSyllables = tokens.reduce((sum, word) => {
      return sum + this._countSyllables(word);
    }, 0);
    return totalSyllables / tokens.length;
  }

  _countSyllables(word) {
    word = word.toLowerCase().replace(/[^a-z]/g, '');
    if (word.length <= 3) return 1;
    const vowels = word.match(/[aeiouy]+/g);
    if (!vowels) return 1;
    let count = vowels.length;
    if (word.endsWith('e')) count--;
    const diphthongs = word.match(/[aeiou]{2,}/g);
    if (diphthongs) {
      diphthongs.forEach(d => {
        if (d.length > 2) count -= (d.length - 2);
      });
    }
    return Math.max(1, count);
  }

  _punctuationComplexity(text, sentences) {
    const commas = (text.match(/,/g) || []).length;
    const semicolons = (text.match(/;/g) || []).length;
    const colons = (text.match(/:/g) || []).length;
    const dashes = (text.match(/[—–-]/g) || []).length;
    const parentheses = (text.match(/[()]/g) || []).length / 2;
    const totalPunct = commas + semicolons + colons + dashes + parentheses;
    return sentences.length > 0 ? totalPunct / sentences.length : 0;
  }

  _countSubordinateClauses(text, sentences) {
    const markers = ['which', 'that', 'who', 'whom', 'whose', 'where', 'when', 'why',
                     'although', 'though', 'because', 'since', 'while', 'whereas', 'if',
                     'unless', 'until', 'before', 'after', 'whether', 'however', 'therefore',
                     'furthermore', 'moreover', 'nevertheless', 'consequently'];
    let count = 0;
    const lowerText = text.toLowerCase();
    markers.forEach(marker => {
      const regex = new RegExp(`\\b${marker}\\b`, 'gi');
      const matches = lowerText.match(regex);
      if (matches) count += matches.length;
    });
    return sentences.length > 0 ? count / sentences.length : 0;
  }

  _vocabularySophistication(tokens) {
    const longWords = tokens.filter(w => w.length >= 8).length;
    const veryLongWords = tokens.filter(w => w.length >= 12).length;
    const simpleWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
                        'have', 'has', 'had', 'do', 'does', 'did', 'get', 'got', 'go',
                        'went', 'see', 'saw', 'know', 'think', 'say', 'said', 'come',
                        'came', 'like', 'just', 'really', 'very', 'much', 'many'];
    const simpleCount = tokens.filter(w => simpleWords.includes(w)).length;
    const simpleRatio = tokens.length > 0 ? simpleCount / tokens.length : 0;
    const sophistication = (longWords + veryLongWords * 2) / Math.max(1, tokens.length) - simpleRatio;
    return sophistication;
  }

  /**
   * Compute MTLD (Measure of Textual Lexical Diversity)
   * Based on McCarthy & Jarvis (2010)
   */
  _computeMTLD(tokens) {
    if (tokens.length === 0) return 0;

    const threshold = 0.72;
    const factorLengths = [];
    let currentFactor = [];
    let currentTypes = new Set();

    for (const token of tokens) {
      currentFactor.push(token);
      currentTypes.add(token.toLowerCase());

      if (currentFactor.length > 0) {
        const ttr = currentTypes.size / currentFactor.length;
        if (ttr < threshold) {
          factorLengths.push(currentFactor.length);
          currentFactor = [];
          currentTypes = new Set();
        }
      }
    }

    // Handle remaining factor
    if (currentFactor.length > 0) {
      factorLengths.push(currentFactor.length);
    }

    if (factorLengths.length === 0) return 0;
    return factorLengths.reduce((a, b) => a + b, 0) / factorLengths.length;
  }

  /**
   * Compute Yule's K (vocabulary richness measure)
   * Yule's K = 10,000 * (sum(f_i^2) - N) / N^2
   */
  _computeYulesK(tokens) {
    if (tokens.length === 0) return 0;

    const wordCounts = {};
    for (const token of tokens) {
      const lower = token.toLowerCase();
      wordCounts[lower] = (wordCounts[lower] || 0) + 1;
    }

    const totalWords = tokens.length;
    let sumFiSquared = 0;
    for (const count of Object.values(wordCounts)) {
      sumFiSquared += count * count;
    }

    const yulesK = 10000 * (sumFiSquared - totalWords) / (totalWords * totalWords);
    return yulesK;
  }

  /**
   * Compute punctuation entropy (Shannon entropy)
   */
  _computePunctuationEntropy(text) {
    const punctChars = text.match(/[.,;:!?()\-\[\]{}"']/g);
    if (!punctChars || punctChars.length === 0) return 0;

    const punctCounts = {};
    for (const char of punctChars) {
      punctCounts[char] = (punctCounts[char] || 0) + 1;
    }

    const total = punctChars.length;
    let entropy = 0;
    for (const count of Object.values(punctCounts)) {
      const prob = count / total;
      entropy -= prob * Math.log2(prob);
    }

    return entropy;
  }

  /**
   * Compute lexical overlap between adjacent sentences
   */
  _computeLexicalOverlap(sentences) {
    if (sentences.length < 2) return 0;

    const overlaps = [];
    for (let i = 0; i < sentences.length - 1; i++) {
      const words1 = new Set(sentences[i].toLowerCase().match(/\b\w+\b/g) || []);
      const words2 = new Set(sentences[i + 1].toLowerCase().match(/\b\w+\b/g) || []);

      if (words1.size === 0 || words2.size === 0) continue;

      const intersection = new Set([...words1].filter(x => words2.has(x)));
      const overlap = intersection.size / Math.max(words1.size, words2.size);
      overlaps.push(overlap);
    }

    if (overlaps.length === 0) return 0;
    return overlaps.reduce((a, b) => a + b, 0) / overlaps.length;
  }

  /**
   * Compute connective density
   */
  _computeConnectiveDensity(text, tokens) {
    const connectives = [
      'and', 'but', 'or', 'so', 'because', 'since', 'although', 'though',
      'however', 'therefore', 'furthermore', 'moreover', 'nevertheless',
      'thus', 'consequently', 'hence', 'meanwhile', 'additionally',
      'while', 'whereas', 'if', 'unless', 'until', 'before', 'after'
    ];

    const lowerTokens = tokens.map(t => t.toLowerCase());
    let connectiveCount = 0;
    for (const token of lowerTokens) {
      if (connectives.includes(token)) {
        connectiveCount++;
      }
    }

    return tokens.length > 0 ? connectiveCount / tokens.length : 0;
  }

  /**
   * Compute readability indices (Flesch-Kincaid, SMOG, ARI, LIX)
   */
  _computeReadability(text, sentences, tokens) {
    const words = tokens;
    const sentenceCount = sentences.length;
    const wordCount = words.length;

    if (wordCount === 0 || sentenceCount === 0) {
      return {
        flesch_kincaid: 0,
        smog: 0,
        ari: 0,
        lix: 0
      };
    }

    // Count syllables
    let totalSyllables = 0;
    let polysyllableWords = 0; // Words with 3+ syllables (for SMOG)
    for (const word of words) {
      const syllables = this._countSyllables(word);
      totalSyllables += syllables;
      if (syllables >= 3) polysyllableWords++;
    }
    const avgSyllablesPerWord = totalSyllables / wordCount;

    // Average sentence length
    const avgSentenceLength = wordCount / sentenceCount;

    // Average word length (characters)
    const totalChars = words.reduce((sum, w) => sum + w.length, 0);
    const avgWordLength = totalChars / wordCount;

    // Flesch-Kincaid Grade Level
    const fleschKincaid = 0.39 * avgSentenceLength + 11.8 * avgSyllablesPerWord - 15.59;

    // SMOG Index (requires polysyllable words per sentence)
    const smog = Math.sqrt(polysyllableWords * (30 / sentenceCount)) + 3;

    // Automated Readability Index (ARI)
    const ari = 4.71 * (totalChars / wordCount) + 0.5 * (wordCount / sentenceCount) - 21.43;

    // LIX (Läsbarhetsindex - Swedish readability index)
    const longWords = words.filter(w => w.length > 6).length;
    const lix = (wordCount / sentenceCount) + (longWords * 100 / wordCount);

    return {
      flesch_kincaid: Math.max(0, fleschKincaid),
      smog: Math.max(0, smog),
      ari: Math.max(0, ari),
      lix: Math.max(0, lix)
    };
  }
}

// Export for use in content script
if (typeof window !== 'undefined') {
  window.ComprehensiveIQEstimatorUltimate = ComprehensiveIQEstimatorUltimate;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ComprehensiveIQEstimatorUltimate;
}

