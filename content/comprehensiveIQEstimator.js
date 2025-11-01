/**
 * Comprehensive IQ Estimator - Client-side JavaScript implementation
 *
 * Ports the research-based estimation logic from the Python estimator to JavaScript.
 * Fully client-side, no server required. Uses the same 4 dimensions and trained weights.
 *
 * Based on:
 * - Vocabulary Sophistication (35%) - Age of Acquisition proxies
 * - Lexical Diversity (25%) - Type-Token Ratio (TTR)
 * - Sentence Complexity (20%) - Average words per sentence
 * - Grammatical Precision (20%) - Syntax complexity approximation
 */

class ComprehensiveIQEstimator {
  constructor() {
    // Trained weights from the Python estimator (optimized on 15 graded samples)
    this.dimensionWeights = {
      vocabulary_sophistication: 0.35,
      lexical_diversity: 0.25,
      sentence_complexity: 0.20,
      grammatical_precision: 0.20
    };
  }

  /**
   * Main estimation method - mirrors the Python estimator's estimate() function
   * @param {string} text - Text to analyze
   * @returns {Object} IQ estimate with breakdown
   */
  estimate(text) {
    if (!text || text.trim().length === 0) {
      return {
        iq_estimate: 85,
        confidence: 0,
        is_valid: false,
        error: 'Text is empty'
      };
    }

    // Extract features (simplified version of Python extractors)
    const features = this._extractFeatures(text);

    // Compute dimension scores (same logic as Python)
    const dimensions = this._computeDimensions(features);

    // Combine dimensions with trained weights
    const iq_estimate = this._combineDimensions(dimensions);

    // Calculate confidence
    const confidence = this._computeConfidence(dimensions, features);

    return {
      iq_estimate: iq_estimate,
      confidence: confidence,
      dimension_scores: dimensions,
      is_valid: true,
      error: null
    };
  }

  /**
   * Extract features from text (simplified stylometry features)
   */
  _extractFeatures(text) {
    const normalizedText = this._normalizeText(text);
    const tokens = this._tokenize(normalizedText);
    const sentences = this._sentences(normalizedText);

    return {
      tokens: tokens,
      sentences: sentences,
      avg_words_per_sentence: tokens.length / Math.max(1, sentences.length),
      ttr: this._computeTTR(tokens),
      msttr: this._computeMSTTR(tokens),
      avg_word_length: this._avgWordLength(tokens),
      avg_syllables: this._avgSyllables(tokens),
      punctuation_complexity: this._punctuationComplexity(normalizedText, sentences),
      subordinate_clauses: this._countSubordinateClauses(normalizedText, sentences),
      vocabulary_sophistication: this._vocabularySophistication(tokens)
    };
  }

  /**
   * Compute dimension scores - mirrors Python _compute_dimensions()
   */
  _computeDimensions(features) {
    return {
      vocabulary_sophistication: this._vocabularyIQ(features),
      lexical_diversity: this._diversityIQ(features),
      sentence_complexity: this._sentenceComplexityIQ(features),
      grammatical_precision: this._grammarIQ(features)
    };
  }

  /**
   * Vocabulary Sophistication IQ - uses word length and syllable complexity as AoA proxies
   * Trained mapping: base_iq = 70 + (mean_aoa - 3.91) * 24
   */
  _vocabularyIQ(features) {
    // Use average word length and syllables as proxies for AoA
    // Longer, more complex words = higher AoA = higher IQ
    const avgLength = features.avg_word_length || 4.5;
    const avgSyllables = features.avg_syllables || 1.5;

    // Estimate "mean AoA" from word characteristics
    // Base AoA ~3.91 corresponds to IQ 70
    // Word length factor (longer = later acquisition)
    const lengthFactor = (avgLength - 4.0) * 0.5; // +0.5 AoA per char above 4
    const syllableFactor = (avgSyllables - 1.5) * 0.3; // +0.3 AoA per syllable above 1.5

    // Estimate mean AoA
    const estimatedAoa = 3.91 + lengthFactor + syllableFactor;

    // Count advanced words (8+ chars) as percentage
    const advancedWords = features.tokens.filter(t => t.length >= 8).length;
    const pctAdvanced = features.tokens.length > 0 ? advancedWords / features.tokens.length : 0;

    // Apply trained mapping: base_iq = 70 + (mean_aoa - 3.91) * 24
    let baseIQ = 70 + (estimatedAoa - 3.91) * 24;

    // Add boost for advanced words (trained: +1.0 per %)
    baseIQ += pctAdvanced * 1.0;

    return Math.max(50, Math.min(130, baseIQ));
  }

  /**
   * Lexical Diversity IQ - uses TTR (Type-Token Ratio)
   * Trained mapping: iq = 70 + (ttr - 0.659) * 170
   */
  _diversityIQ(features) {
    const ttr = features.ttr || 0.5;

    // Trained mapping: iq = 70 + (ttr - 0.659) * 170
    const iq = 70 + (ttr - 0.659) * 170;

    return Math.max(50, Math.min(130, iq));
  }

  /**
   * Sentence Complexity IQ - uses average words per sentence
   * Trained mapping: iq = 60 + (avg_words - 11.0) * 6.0
   */
  _sentenceComplexityIQ(features) {
    const avgWords = features.avg_words_per_sentence || 10;

    // Trained mapping: iq = 60 + (avg_words - 11.0) * 6.0
    const iq = 60 + (avgWords - 11.0) * 6.0;

    return Math.max(50, Math.min(130, iq));
  }

  /**
   * Grammatical Precision IQ - approximates dependency depth using punctuation and clauses
   * Trained mapping: iq = 53 + (dep_depth - 1.795) * 80
   */
  _grammarIQ(features) {
    // Approximate dependency depth from punctuation and subordinate clauses
    // More punctuation and clauses = deeper structure = higher IQ
    const punctComplexity = features.punctuation_complexity || 0;
    const subClauses = features.subordinate_clauses || 0;

    // Estimate dependency depth (avg dependency depth ~1.795 for baseline)
    // Higher punctuation = deeper structure
    const estimatedDepDepth = 1.795 + (punctComplexity * 0.3) + (subClauses * 0.2);

    // Trained mapping: iq = 53 + (dep_depth - 1.795) * 80
    const iq = 53 + (estimatedDepDepth - 1.795) * 80;

    return Math.max(50, Math.min(130, iq));
  }

  /**
   * Combine dimensions with trained weights - mirrors Python _combine_dimensions()
   */
  _combineDimensions(dimensions) {
    let totalWeight = 0;
    let weightedSum = 0;

    for (const [dim, iq] of Object.entries(dimensions)) {
      const weight = this.dimensionWeights[dim] || 0;
      weightedSum += iq * weight;
      totalWeight += weight;
    }

    if (totalWeight === 0) {
      return 100.0;
    }

    const finalIQ = weightedSum / totalWeight;

    // Cap at reasonable range
    return Math.max(50, Math.min(150, finalIQ));
  }

  /**
   * Compute confidence based on feature agreement
   */
  _computeConfidence(dimensions, features) {
    // Agreement: lower variance = higher confidence
    const iqValues = Object.values(dimensions);

    if (iqValues.length > 1) {
      const mean = iqValues.reduce((a, b) => a + b, 0) / iqValues.length;
      const variance = iqValues.reduce((sum, iq) => sum + Math.pow(iq - mean, 2), 0) / iqValues.length;
      const stdDev = Math.sqrt(variance);

      // Lower std = higher confidence
      const agreementScore = Math.max(50, 100 - stdDev * 5);

      // Availability: check if we have good feature coverage
      const hasGoodFeatures = features.ttr && features.avg_words_per_sentence && features.avg_word_length;
      const availabilityScore = hasGoodFeatures ? 80 : 50;

      // Combine
      const confidence = (agreementScore * 0.7 + availabilityScore * 0.3);

      return Math.max(30, Math.min(95, confidence));
    }

    return 50;
  }

  // ========== Feature Extraction Helpers ==========

  /**
   * Normalize text for analysis
   */
  _normalizeText(text) {
    return text
      .replace(/https?:\/\/[^\s]+/g, '') // Remove URLs
      .replace(/@\w+/g, '') // Remove mentions
      .replace(/#\w+/g, '') // Remove hashtags
      .replace(/[^\w\s.,!?;:()'-]/g, ' ') // Keep punctuation
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Tokenize text into words
   */
  _tokenize(text) {
    const matches = text.match(/\b\w+\b/g);
    return matches ? matches.map(w => w.toLowerCase()) : [];
  }

  /**
   * Split text into sentences
   */
  _sentences(text) {
    return text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  }

  /**
   * Compute Type-Token Ratio (TTR)
   */
  _computeTTR(tokens) {
    if (tokens.length === 0) return 0;
    const uniqueTokens = new Set(tokens).size;
    return uniqueTokens / tokens.length;
  }

  /**
   * Compute Mean Segmental Type-Token Ratio (MSTTR)
   */
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

  /**
   * Average word length
   */
  _avgWordLength(tokens) {
    if (tokens.length === 0) return 0;
    const totalChars = tokens.reduce((sum, t) => sum + t.length, 0);
    return totalChars / tokens.length;
  }

  /**
   * Average syllables per word (approximate)
   */
  _avgSyllables(tokens) {
    if (tokens.length === 0) return 0;

    const totalSyllables = tokens.reduce((sum, word) => {
      return sum + this._countSyllables(word);
    }, 0);

    return totalSyllables / tokens.length;
  }

  /**
   * Count syllables in a word (approximate)
   */
  _countSyllables(word) {
    word = word.toLowerCase().replace(/[^a-z]/g, '');
    if (word.length <= 3) return 1;

    const vowels = word.match(/[aeiouy]+/g);
    if (!vowels) return 1;

    let count = vowels.length;

    // Adjust for silent e
    if (word.endsWith('e')) count--;

    // Adjust for diphthongs
    const diphthongs = word.match(/[aeiou]{2,}/g);
    if (diphthongs) {
      diphthongs.forEach(d => {
        if (d.length > 2) count -= (d.length - 2);
      });
    }

    return Math.max(1, count);
  }

  /**
   * Punctuation complexity (approximation of syntactic depth)
   */
  _punctuationComplexity(text, sentences) {
    const commas = (text.match(/,/g) || []).length;
    const semicolons = (text.match(/;/g) || []).length;
    const colons = (text.match(/:/g) || []).length;
    const dashes = (text.match(/[—–-]/g) || []).length;
    const parentheses = (text.match(/[()]/g) || []).length / 2;

    const totalPunct = commas + semicolons + colons + dashes + parentheses;
    return sentences.length > 0 ? totalPunct / sentences.length : 0;
  }

  /**
   * Count subordinate clauses
   */
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

  /**
   * Vocabulary sophistication score (additional metric)
   */
  _vocabularySophistication(tokens) {
    const longWords = tokens.filter(w => w.length >= 8).length;
    const veryLongWords = tokens.filter(w => w.length >= 12).length;

    // Common simple words
    const simpleWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
                        'have', 'has', 'had', 'do', 'does', 'did', 'get', 'got', 'go',
                        'went', 'see', 'saw', 'know', 'think', 'say', 'said', 'come',
                        'came', 'like', 'just', 'really', 'very', 'much', 'many'];

    const simpleCount = tokens.filter(w => simpleWords.includes(w)).length;
    const simpleRatio = tokens.length > 0 ? simpleCount / tokens.length : 0;

    const sophistication = (longWords + veryLongWords * 2) / Math.max(1, tokens.length) - simpleRatio;

    return sophistication;
  }
}

// Export for use in content script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ComprehensiveIQEstimator;
}
