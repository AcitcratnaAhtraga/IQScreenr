/**
 * IQ Calculator - Estimates Verbal IQ based on linguistic features
 * Scales from 60-145+ to approximate real IQ ranges
 */

class IQCalculator {
  constructor() {
    // Average word length baselines
    this.avgWordLengthBaseline = 4.5; // Average English word length
    this.highWordLengthThreshold = 6.0;

    // Vocabulary complexity thresholds
    this.uniqueWordRatioBaseline = 0.6;
    this.highUniqueWordRatio = 0.75;

    // Sentence complexity
    this.avgSentenceLengthBaseline = 15; // words per sentence
    this.highSentenceLength = 25;

    // Syllable complexity
    this.avgSyllablesPerWordBaseline = 1.5;
    this.highSyllablesPerWord = 2.2;

    // Readability index (higher = more complex)
    this.readabilityBaseline = 50; // Flesch Reading Ease equivalent
  }

  /**
   * Calculate IQ score from tweet text
   * @param {string} text - The tweet text to analyze
   * @returns {number} - IQ score between 60-145+
   */
  calculateIQ(text) {
    if (!text || text.trim().length === 0) {
      return 85; // Default for empty text
    }

    const normalizedText = this.normalizeText(text);

    // Extract features
    const words = this.extractWords(normalizedText);
    const sentences = this.extractSentences(normalizedText);

    if (words.length === 0 || sentences.length === 0) {
      return 85;
    }

    // Calculate metrics
    const avgWordLength = this.calculateAverageWordLength(words);
    const uniqueWordRatio = this.calculateUniqueWordRatio(words);
    const sentenceMetrics = this.calculateSentenceMetrics(sentences, words);
    const syllableMetrics = this.calculateSyllableMetrics(words);
    const readabilityScore = this.calculateReadabilityIndex(words, sentences);
    const vocabularySophistication = this.assessVocabularySophistication(words);
    const syntaxComplexity = this.assessSyntaxComplexity(normalizedText, sentences);

    // Weighted scoring (totals to ~100 points, scaled to 60-145+ range)
    const scores = {
      wordLength: this.scoreWordLength(avgWordLength), // 15 points
      uniqueness: this.scoreUniqueness(uniqueWordRatio), // 15 points
      sentenceComplexity: this.scoreSentenceComplexity(sentenceMetrics), // 20 points
      syllableComplexity: this.scoreSyllableComplexity(syllableMetrics), // 15 points
      readability: this.scoreReadability(readabilityScore), // 15 points
      vocabulary: this.scoreVocabulary(vocabularySophistication), // 12 points
      syntax: this.scoreSyntax(syntaxComplexity), // 8 points
    };

    // Calculate base IQ (0-100 scale mapped to 60-145)
    const totalScore = Object.values(scores).reduce((sum, val) => sum + val, 0);

    // Map 0-100 to 60-145 range with bonus for exceptional scores
    let iq = 60 + (totalScore / 100) * 85;

    // Add bonus for exceptional performance (can exceed 145)
    if (totalScore > 90) {
      iq += (totalScore - 90) * 0.5; // Up to +7.5 bonus
    }

    // Ensure minimum and maximum bounds
    iq = Math.max(60, Math.min(152, Math.round(iq)));

    return iq;
  }

  /**
   * Calculate breakdown metrics for display
   * @param {string} text - The tweet text to analyze
   * @returns {object} - Breakdown metrics
   */
  calculateBreakdown(text) {
    if (!text || text.trim().length === 0) {
      return { vocabulary: 'N/A', readability: 'N/A', complexity: 'N/A' };
    }

    const normalizedText = this.normalizeText(text);
    const words = this.extractWords(normalizedText);
    const sentences = this.extractSentences(normalizedText);

    if (words.length === 0 || sentences.length === 0) {
      return { vocabulary: 'N/A', readability: 'N/A', complexity: 'N/A' };
    }

    const avgWordLength = this.calculateAverageWordLength(words);
    const uniqueWordRatio = this.calculateUniqueWordRatio(words);
    const readabilityScore = this.calculateReadabilityIndex(words, sentences);
    const vocabularySophistication = this.assessVocabularySophistication(words);
    const sentenceMetrics = this.calculateSentenceMetrics(sentences, words);
    const syllableMetrics = this.calculateSyllableMetrics(words);
    const syntaxComplexity = this.assessSyntaxComplexity(normalizedText, sentences);

    // Format vocabulary (unique word ratio as percentage)
    const vocabPercent = Math.round(uniqueWordRatio * 100);
    const vocabLevel = vocabPercent < 50 ? 'Basic' : vocabPercent < 65 ? 'Moderate' : vocabPercent < 80 ? 'Advanced' : 'Sophisticated';

    // Format readability (inverted, so higher = more complex)
    const readabilityPercent = Math.round(readabilityScore);
    const readabilityLevel = readabilityPercent < 30 ? 'Simple' : readabilityPercent < 50 ? 'Moderate' : readabilityPercent < 70 ? 'Complex' : 'Very Complex';

    // Format complexity (based on sentence variance and vocabulary)
    const complexityScore = (sentenceMetrics.variance / 10) + (vocabularySophistication.sophisticationScore * 20);
    const complexityLevel = complexityScore < 5 ? 'Low' : complexityScore < 10 ? 'Moderate' : complexityScore < 15 ? 'High' : 'Very High';

    // Format word length
    const avgWordLengthFormatted = avgWordLength.toFixed(1);
    const wordLengthLevel = avgWordLength < 4 ? 'Short' : avgWordLength < 5.5 ? 'Average' : avgWordLength < 7 ? 'Long' : 'Very Long';

    // Format syllable complexity
    const avgSyllables = syllableMetrics.avgSyllablesPerWord.toFixed(2);
    const syllableLevel = avgSyllables < 1.3 ? 'Simple' : avgSyllables < 1.8 ? 'Moderate' : avgSyllables < 2.3 ? 'Complex' : 'Very Complex';

    // Format sentence complexity
    const avgSentenceLength = Math.round(sentenceMetrics.avgLength);
    const sentenceLevel = avgSentenceLength < 10 ? 'Short' : avgSentenceLength < 15 ? 'Moderate' : avgSentenceLength < 25 ? 'Long' : 'Very Long';

    // Format syntax complexity
    const syntaxLevel = syntaxComplexity.overallComplexity < 1 ? 'Simple' : syntaxComplexity.overallComplexity < 2.5 ? 'Moderate' : syntaxComplexity.overallComplexity < 4 ? 'Complex' : 'Very Complex';

    return {
      vocabulary: `${vocabLevel} (${vocabPercent}% unique)`,
      readability: `${readabilityLevel} (${readabilityPercent}/100)`,
      complexity: complexityLevel,
      wordLength: `${wordLengthLevel} (${avgWordLengthFormatted} chars avg)`,
      syllables: `${syllableLevel} (${avgSyllables} per word)`,
      sentenceStructure: `${sentenceLevel} (${avgSentenceLength} words avg)`,
      syntax: `${syntaxLevel}`,
      totalWords: words.length,
      totalSentences: sentences.length
    };
  }

  /**
   * Normalize text for analysis
   */
  normalizeText(text) {
    return text
      .replace(/https?:\/\/[^\s]+/g, '') // Remove URLs
      .replace(/@\w+/g, '') // Remove mentions
      .replace(/#\w+/g, '') // Remove hashtags
      .replace(/[^\w\s.,!?;:()'-]/g, ' ') // Keep punctuation, remove emoji
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extract words from text
   */
  extractWords(text) {
    return text.match(/\b\w+\b/g) || [];
  }

  /**
   * Extract sentences from text
   */
  extractSentences(text) {
    // Split by sentence endings, keep the punctuation
    return text.split(/([.!?]+)/).filter(s => s.trim().length > 0);
  }

  /**
   * Calculate average word length
   */
  calculateAverageWordLength(words) {
    if (words.length === 0) return 0;
    const totalChars = words.reduce((sum, word) => sum + word.length, 0);
    return totalChars / words.length;
  }

  /**
   * Calculate unique word ratio
   */
  calculateUniqueWordRatio(words) {
    if (words.length === 0) return 0;
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    return uniqueWords.size / words.length;
  }

  /**
   * Calculate sentence metrics
   */
  calculateSentenceMetrics(sentences, allWords) {
    const sentenceLengths = sentences
      .map(s => s.match(/\b\w+\b/g)?.length || 0)
      .filter(len => len > 0);

    if (sentenceLengths.length === 0) {
      return {
        avgLength: 0,
        variance: 0,
        maxLength: 0,
        minLength: 0
      };
    }

    const avgLength = sentenceLengths.reduce((sum, len) => sum + len, 0) / sentenceLengths.length;
    const variance = sentenceLengths.reduce((sum, len) => {
      return sum + Math.pow(len - avgLength, 2);
    }, 0) / sentenceLengths.length;

    return {
      avgLength,
      variance: Math.sqrt(variance), // Standard deviation
      maxLength: Math.max(...sentenceLengths),
      minLength: Math.min(...sentenceLengths)
    };
  }

  /**
   * Calculate syllable metrics
   */
  calculateSyllableMetrics(words) {
    let totalSyllables = 0;
    let totalWords = 0;

    words.forEach(word => {
      const syllables = this.countSyllables(word);
      if (syllables > 0) {
        totalSyllables += syllables;
        totalWords++;
      }
    });

    return {
      avgSyllablesPerWord: totalWords > 0 ? totalSyllables / totalWords : 0,
      totalSyllables
    };
  }

  /**
   * Count syllables in a word (approximate)
   */
  countSyllables(word) {
    word = word.toLowerCase();
    if (word.length <= 3) return 1;

    word = word.replace(/[^a-z]/g, '');
    const vowels = word.match(/[aeiouy]+/g);
    if (!vowels) return 1;

    let count = vowels.length;

    // Adjust for silent e
    if (word.endsWith('e')) count--;

    // Adjust for diphthongs and triphthongs
    const diphthongs = word.match(/[aeiou]{2,}/g);
    if (diphthongs) {
      diphthongs.forEach(d => {
        if (d.length > 2) count -= (d.length - 2);
      });
    }

    return Math.max(1, count);
  }

  /**
   * Calculate readability index (simplified Flesch-like score)
   */
  calculateReadabilityIndex(words, sentences) {
    if (words.length === 0 || sentences.length === 0) return 0;

    const avgSentenceLength = words.length / sentences.length;
    const avgSyllablesPerWord = this.calculateSyllableMetrics(words).avgSyllablesPerWord;

    // Simplified Flesch Reading Ease (higher = easier, lower = harder)
    // We invert it so higher = more complex
    const fleschScore = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);

    // Invert and normalize to 0-100 scale where higher = more complex
    return Math.max(0, Math.min(100, 100 - fleschScore));
  }

  /**
   * Assess vocabulary sophistication
   */
  assessVocabularySophistication(words) {
    // Check for longer, less common words
    const longWords = words.filter(w => w.length >= 8).length;
    const veryLongWords = words.filter(w => w.length >= 12).length;

    // Common words that indicate simpler vocabulary
    const commonSimpleWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'can', 'could', 'should', 'may', 'might', 'get', 'got', 'go', 'went', 'see', 'saw', 'know', 'think', 'say', 'said', 'come', 'came', 'like', 'just', 'really', 'very', 'much', 'many', 'some', 'any', 'all', 'good', 'bad', 'nice', 'cool', 'awesome', 'great', 'ok', 'okay', 'yeah', 'yes', 'no', 'not', 'but', 'and', 'or', 'so', 'then', 'this', 'that', 'what', 'when', 'where', 'why', 'how', 'if', 'as', 'at', 'in', 'on', 'up', 'out', 'off', 'over', 'under', 'to', 'for', 'with', 'from', 'by', 'about', 'into', 'through', 'during', 'including', 'against', 'among', 'throughout', 'despite', 'towards', 'upon', 'concerning', 'throughout'];

    const simpleWordCount = words.filter(w => commonSimpleWords.includes(w.toLowerCase())).length;
    const simpleWordRatio = simpleWordCount / words.length;

    return {
      longWordRatio: longWords / words.length,
      veryLongWordRatio: veryLongWords / words.length,
      simpleWordRatio,
      sophisticationScore: (longWords + veryLongWords * 2) / words.length - simpleWordRatio
    };
  }

  /**
   * Assess syntax complexity
   */
  assessSyntaxComplexity(text, sentences) {
    // Check for complex punctuation and structures
    const commas = (text.match(/,/g) || []).length;
    const semicolons = (text.match(/;/g) || []).length;
    const colons = (text.match(/:/g) || []).length;
    const dashes = (text.match(/[—–-]/g) || []).length;
    const parentheses = (text.match(/[()]/g) || []).length / 2;

    const totalPunctuation = commas + semicolons + colons + dashes + parentheses;
    const punctuationPerSentence = sentences.length > 0 ? totalPunctuation / sentences.length : 0;

    // Check for subordinate clauses (words like "which", "that", "although", etc.)
    const subordinateMarkers = ['which', 'that', 'who', 'whom', 'whose', 'where', 'when', 'why', 'although', 'though', 'because', 'since', 'while', 'whereas', 'if', 'unless', 'until', 'before', 'after', 'whether', 'however', 'therefore', 'furthermore', 'moreover', 'nevertheless', 'consequently'];
    const subordinateCount = subordinateMarkers.reduce((count, marker) => {
      const regex = new RegExp(`\\b${marker}\\b`, 'gi');
      return count + (text.match(regex) || []).length;
    }, 0);

    return {
      punctuationComplexity: punctuationPerSentence,
      subordinateClauses: subordinateCount / sentences.length,
      overallComplexity: (punctuationPerSentence * 0.6) + (subordinateCount / sentences.length * 0.4)
    };
  }

  /**
   * Score word length (0-15 points)
   */
  scoreWordLength(avgWordLength) {
    if (avgWordLength < this.avgWordLengthBaseline) {
      return (avgWordLength / this.avgWordLengthBaseline) * 10;
    } else if (avgWordLength < this.highWordLengthThreshold) {
      return 10 + ((avgWordLength - this.avgWordLengthBaseline) / (this.highWordLengthThreshold - this.avgWordLengthBaseline)) * 3;
    } else {
      return 13 + Math.min(2, (avgWordLength - this.highWordLengthThreshold) * 0.5);
    }
  }

  /**
   * Score uniqueness (0-15 points)
   */
  scoreUniqueness(uniqueRatio) {
    if (uniqueRatio < this.uniqueWordRatioBaseline) {
      return (uniqueRatio / this.uniqueWordRatioBaseline) * 10;
    } else if (uniqueRatio < this.highUniqueWordRatio) {
      return 10 + ((uniqueRatio - this.uniqueWordRatioBaseline) / (this.highUniqueWordRatio - this.uniqueWordRatioBaseline)) * 3;
    } else {
      return 13 + Math.min(2, (uniqueRatio - this.highUniqueWordRatio) * 4);
    }
  }

  /**
   * Score sentence complexity (0-20 points)
   */
  scoreSentenceComplexity(metrics) {
    const { avgLength, variance, maxLength } = metrics;

    let score = 0;

    // Average length component (0-10 points)
    if (avgLength < this.avgSentenceLengthBaseline) {
      score += (avgLength / this.avgSentenceLengthBaseline) * 7;
    } else if (avgLength < this.highSentenceLength) {
      score += 7 + ((avgLength - this.avgSentenceLengthBaseline) / (this.highSentenceLength - this.avgSentenceLengthBaseline)) * 3;
    } else {
      score += 10;
    }

    // Variance component (0-5 points) - variety in sentence length
    score += Math.min(5, variance * 0.3);

    // Max length component (0-5 points) - ability to handle long sentences
    if (maxLength > this.highSentenceLength) {
      score += Math.min(5, (maxLength - this.highSentenceLength) * 0.2);
    }

    return Math.min(20, score);
  }

  /**
   * Score syllable complexity (0-15 points)
   */
  scoreSyllableComplexity(metrics) {
    const { avgSyllablesPerWord } = metrics;

    if (avgSyllablesPerWord < this.avgSyllablesPerWordBaseline) {
      return (avgSyllablesPerWord / this.avgSyllablesPerWordBaseline) * 10;
    } else if (avgSyllablesPerWord < this.highSyllablesPerWord) {
      return 10 + ((avgSyllablesPerWord - this.avgSyllablesPerWordBaseline) / (this.highSyllablesPerWord - this.avgSyllablesPerWordBaseline)) * 3;
    } else {
      return 13 + Math.min(2, (avgSyllablesPerWord - this.highSyllablesPerWord) * 2);
    }
  }

  /**
   * Score readability (0-15 points)
   */
  scoreReadability(readabilityScore) {
    // Higher readability score = more complex = higher IQ
    return (readabilityScore / 100) * 15;
  }

  /**
   * Score vocabulary sophistication (0-12 points)
   */
  scoreVocabulary(vocabMetrics) {
    const { longWordRatio, veryLongWordRatio, sophisticationScore } = vocabMetrics;

    let score = (longWordRatio * 5) + (veryLongWordRatio * 4);
    score += Math.max(0, sophisticationScore * 3);

    return Math.min(12, score);
  }

  /**
   * Score syntax complexity (0-8 points)
   */
  scoreSyntax(syntaxMetrics) {
    const { overallComplexity } = syntaxMetrics;
    return Math.min(8, overallComplexity * 4);
  }
}

// Export for use in content script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = IQCalculator;
}

