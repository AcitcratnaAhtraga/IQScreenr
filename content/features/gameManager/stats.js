/**
 * Stats Calculator for IQGuessr
 * Calculates comprehensive statistics from guess history
 */

(function() {
  'use strict';

  const GUESS_HISTORY_KEY = 'iqGuessrHistory';

  /**
   * Calculate comprehensive stats from guess history
   */
  async function calculateStats() {
    const storage = window.GameManagerStorage;
    if (!storage || !storage.isExtensionContextValid()) {
      return null;
    }

    try {
      // Get guess history (try both local and sync storage)
      const resultLocal = await storage.getStorage([GUESS_HISTORY_KEY], 'local');
      const resultSync = await storage.getStorage([GUESS_HISTORY_KEY], 'sync');
      const history = resultLocal[GUESS_HISTORY_KEY] || resultSync[GUESS_HISTORY_KEY] || [];

      if (history.length === 0) {
        return {
          totalGuesses: 0,
          totalScore: 0,
          averageScore: 0,
          averageAccuracy: 0,
          averageConfidence: 0,
          bestGuess: null,
          worstGuess: null,
          averageDifference: 0,
          recentGuesses: []
        };
      }

      // Calculate totals
      const totalGuesses = history.length;
      const totalScore = history.reduce((sum, entry) => sum + (entry.score || 0), 0);
      const totalAccuracy = history.reduce((sum, entry) => sum + (entry.accuracy || 0), 0);
      const totalConfidence = history.reduce((sum, entry) => sum + (entry.confidence || 0), 0);
      const totalDifference = history.reduce((sum, entry) => sum + (entry.difference || 0), 0);

      // Calculate averages
      const averageScore = Math.round((totalScore / totalGuesses) * 10) / 10;
      const averageAccuracy = Math.round((totalAccuracy / totalGuesses) * 10) / 10;
      const averageConfidence = Math.round((totalConfidence / totalGuesses) * 10) / 10;
      const averageDifference = Math.round((totalDifference / totalGuesses) * 10) / 10;

      // Find best and worst guesses (by difference)
      let bestGuess = null;
      let worstGuess = null;

      history.forEach(entry => {
        if (!bestGuess || entry.difference < bestGuess.difference) {
          bestGuess = entry;
        }
        if (!worstGuess || entry.difference > worstGuess.difference) {
          worstGuess = entry;
        }
      });

      // Get recent guesses (last 5)
      const recentGuesses = history.slice(0, 5).map(entry => ({
        guess: entry.guess,
        actual: entry.actualIQ,
        difference: entry.difference,
        score: entry.score,
        accuracy: entry.accuracy,
        confidence: entry.confidence,
        handle: entry.handle,
        timestamp: entry.timestamp
      }));

      return {
        totalGuesses,
        totalScore,
        averageScore,
        averageAccuracy,
        averageConfidence,
        bestGuess,
        worstGuess,
        averageDifference,
        recentGuesses
      };
    } catch (error) {
      console.warn('[IQGuessr] Error calculating stats:', error);
      return null;
    }
  }

  /**
   * Format timestamp for display
   */
  function formatTimestamp(timestamp) {
    if (!timestamp) return 'Unknown';

    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString();
    } catch (error) {
      return 'Unknown';
    }
  }

  // Export
  if (typeof window !== 'undefined') {
    window.GameManagerStats = {
      calculateStats,
      formatTimestamp
    };
  }
})();

