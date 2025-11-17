/**
 * Popup Stats Management
 * Handles IQGuessr stats calculation and display
 */

(function() {
  'use strict';

  /**
   * Calculate stats from guess history
   */
  function calculateStatsFromHistory(history) {
    if (!history || history.length === 0) {
      return {
        totalGuesses: 0,
        totalScore: 0,
        averageScore: 0,
        averageAccuracy: 0,
        averageDifference: 0,
        bestGuess: null,
        worstGuess: null,
        recentGuesses: []
      };
    }

    const totalGuesses = history.length;
    let totalScore = 0;
    let totalAccuracy = 0;
    let totalConfidence = 0;
    let totalDifference = 0;
    let bestGuess = null;
    let worstGuess = null;
    let bestScore = -Infinity;
    let worstScore = Infinity;

    history.forEach(entry => {
      if (entry.score !== undefined) {
        totalScore += entry.score;
        if (entry.score > bestScore) {
          bestScore = entry.score;
          bestGuess = entry;
        }
        if (entry.score < worstScore) {
          worstScore = entry.score;
          worstGuess = entry;
        }
      }
      if (entry.accuracy !== undefined) {
        totalAccuracy += entry.accuracy;
      }
      if (entry.confidence !== undefined) {
        totalConfidence += entry.confidence;
      }
      if (entry.difference !== undefined) {
        totalDifference += Math.abs(entry.difference);
      }
    });

    return {
      totalGuesses,
      totalScore,
      averageScore: totalGuesses > 0 ? totalScore / totalGuesses : 0,
      averageAccuracy: totalGuesses > 0 ? totalAccuracy / totalGuesses : 0,
      averageConfidence: totalGuesses > 0 ? totalConfidence / totalGuesses : 0,
      averageDifference: totalGuesses > 0 ? totalDifference / totalGuesses : 0,
      bestGuess,
      worstGuess,
      recentGuesses: history.slice(-10).reverse().map(entry => ({
        guess: entry.guess,
        actualIQ: entry.actualIQ || entry.actual,
        difference: entry.difference,
        score: entry.score,
        accuracy: entry.accuracy,
        confidence: entry.confidence,
        handle: entry.handle,
        timestamp: entry.timestamp
      }))
    };
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
    } catch (e) {
      return 'Unknown';
    }
  }

  /**
   * Update IQGuessr score display
   */
  function updateIQGuessrScore(score) {
    const scoreElement = document.getElementById('iqGuessrScore');
    if (scoreElement) {
      scoreElement.textContent = score || 0;
    }
  }

  /**
   * Attach stats tooltip to score element
   */
  function attachStatsTooltipToScore() {
    const scoreElement = document.getElementById('iqGuessrScore');
    if (!scoreElement) return;

    let tooltip = null;
    let tooltipTimeout = null;

    scoreElement.addEventListener('mouseenter', async () => {
      if (tooltip) return;

      try {
        const [resultLocal, resultSync] = await Promise.all([
          new Promise((resolve) => chrome.storage.local.get(['iqGuessrHistory'], resolve)),
          new Promise((resolve) => chrome.storage.sync.get(['iqGuessrHistory'], resolve))
        ]);

        const history = resultLocal.iqGuessrHistory || resultSync.iqGuessrHistory || [];
        const stats = calculateStatsFromHistory(history);

        tooltip = document.createElement('div');
        tooltip.className = 'iq-guessr-stats-tooltip popup-stats-tooltip';
        tooltip.setAttribute('data-iq-guessr-tooltip', 'true');

        let content = '<div class="stats-header">📊 IqGuessr Stats</div>';
        content += '<div class="stats-content">';

        if (stats.totalGuesses === 0) {
          content += '<div class="stats-empty">No guesses yet! Start guessing to see your stats.</div>';
        } else {
          content += '<div class="stats-section">';
          content += '<div class="stats-row"><span class="stats-label">Total Guesses:</span><span class="stats-value">' + stats.totalGuesses + '</span></div>';
          content += '<div class="stats-row"><span class="stats-label">Total Score:</span><span class="stats-value">' + stats.totalScore + '</span></div>';
          content += '<div class="stats-row"><span class="stats-label">Average Score:</span><span class="stats-value">' + stats.averageScore.toFixed(1) + '</span></div>';
          content += '<div class="stats-row"><span class="stats-label">Average Accuracy:</span><span class="stats-value">' + stats.averageAccuracy.toFixed(1) + '%</span></div>';
          content += '<div class="stats-row"><span class="stats-label">Average Difference:</span><span class="stats-value">' + stats.averageDifference.toFixed(1) + ' pts</span></div>';
          if (stats.averageConfidence !== undefined) {
            content += '<div class="stats-row"><span class="stats-label">Average Confidence:</span><span class="stats-value">' + stats.averageConfidence.toFixed(1) + '%</span></div>';
          }
          content += '</div>';

          if (stats.bestGuess || stats.worstGuess) {
            content += '<div class="stats-section">';
            if (stats.bestGuess) {
              content += '<div class="stats-row"><span class="stats-label">Best Guess:</span><span class="stats-value">' + stats.bestGuess.score + ' pts</span></div>';
            }
            if (stats.worstGuess) {
              content += '<div class="stats-row"><span class="stats-label">Worst Guess:</span><span class="stats-value">' + stats.worstGuess.score + ' pts</span></div>';
            }
            content += '</div>';
          }

          if (stats.recentGuesses.length > 0) {
            content += '<div class="stats-section"><div class="stats-label">Recent Guesses:</div>';
            stats.recentGuesses.slice(0, 5).forEach((guess, index) => {
              content += '<div class="stats-row-small">';
              content += '<span>' + (guess.guess || '?') + ' → ' + (guess.actualIQ || guess.actual || '?') + '</span>';
              content += '<span class="stats-score">' + (guess.score || 0) + ' pts</span>';
              content += '<span class="stats-time">' + formatTimestamp(guess.timestamp) + '</span>';
              content += '</div>';
            });
            content += '</div>';
          }
        }

        content += '</div>';
        tooltip.innerHTML = content;

        document.body.appendChild(tooltip);

        const rect = scoreElement.getBoundingClientRect();
        tooltip.style.left = rect.left + 'px';
        tooltip.style.top = (rect.bottom + 5) + 'px';
      } catch (error) {
        const Logger = window.Logger || console;
        Logger.error('Error loading stats:', error);
      }
    });

    scoreElement.addEventListener('mouseleave', () => {
      if (tooltipTimeout) {
        clearTimeout(tooltipTimeout);
      }
      tooltipTimeout = setTimeout(() => {
        if (tooltip && tooltip.parentElement) {
          tooltip.remove();
          tooltip = null;
        }
      }, 100);
    });
  }

  // Export
  if (typeof window !== 'undefined') {
    window.PopupStats = {
      calculateStatsFromHistory,
      formatTimestamp,
      updateIQGuessrScore,
      attachStatsTooltipToScore
    };
  }
})();

