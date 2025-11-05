/**
 * Popup Script - Handles settings UI
 */

document.addEventListener('DOMContentLoaded', () => {
  const saveStatus = document.getElementById('saveStatus');

  // Helper function to show save status
  function showStatus(message, type = 'success') {
    saveStatus.textContent = message;
    saveStatus.className = `status ${type}`;
    if (type === 'success') {
      setTimeout(() => {
        saveStatus.textContent = '';
        saveStatus.className = 'status';
      }, 2000);
    }
  }

  // Helper function to update dependent checkboxes enabled/disabled state
  function updateDependentCheckboxes() {
    const showIQBadge = document.getElementById('showIQBadge');
    const showRealtimeBadge = document.getElementById('showRealtimeBadge'); // Hidden/disabled
    const enableIQGuessr = document.getElementById('enableIQGuessr');
    const showProfileScoreBadge = document.getElementById('showProfileScoreBadge');
    const enableDebugLogging = document.getElementById('enableDebugLogging');

    if (!showIQBadge || !enableIQGuessr || !showProfileScoreBadge || !enableDebugLogging) {
      return; // Required elements not found
    }

    const isEnabled = showIQBadge.checked;
    // Real-time badge is hidden, but keep logic intact for backend
    if (showRealtimeBadge) {
      showRealtimeBadge.disabled = !isEnabled;
    }
    enableIQGuessr.disabled = !isEnabled;
    enableDebugLogging.disabled = !isEnabled;

    // Show profile score badge is only enabled when IqGuessr is enabled
    const isGameModeEnabled = enableIQGuessr.checked;
    showProfileScoreBadge.disabled = !isGameModeEnabled;

    // If main toggle is off, uncheck dependent options and save
    if (!isEnabled) {
      // Real-time badge is hidden, but keep logic intact for backend
      if (showRealtimeBadge && showRealtimeBadge.checked) {
        showRealtimeBadge.checked = false;
        chrome.storage.sync.set({ showRealtimeBadge: false });
      }
      if (enableIQGuessr.checked) {
        enableIQGuessr.checked = false;
        chrome.storage.sync.set({ enableIQGuessr: false });
      }
      if (enableDebugLogging.checked) {
        enableDebugLogging.checked = false;
        chrome.storage.sync.set({ enableDebugLogging: false });
      }
    }

    // If IqGuessr mode is off, uncheck profile score badge
    if (!isGameModeEnabled) {
      if (showProfileScoreBadge.checked) {
        showProfileScoreBadge.checked = false;
        chrome.storage.sync.set({ showProfileScoreBadge: false });
      }
    }

    // Always show confidence legend (confidence is always used for color)
    updateLegendDisplay();
  }

  // Helper function to update legend display
  function updateLegendDisplay() {
    const showIQBadge = document.getElementById('showIQBadge');
    const iqLegend = document.getElementById('iqLegend');
    const confidenceLegend = document.getElementById('confidenceLegend');

    // Always show confidence legend (confidence is always used for color)
    if (showIQBadge.checked) {
      iqLegend.style.display = 'none';
      confidenceLegend.style.display = 'block';
    } else {
      iqLegend.style.display = 'none';
      confidenceLegend.style.display = 'none';
    }
  }

  // Helper function to update IqGuessr score display
  function updateIQGuessrScore(score) {
    const scoreElement = document.getElementById('iqGuessrScore');
    const scoreValue = document.getElementById('iqGuessrScoreValue');
    const enableCheckbox = document.getElementById('enableIQGuessr');

    if (enableCheckbox && enableCheckbox.checked) {
      scoreElement.style.display = 'flex';
      if (scoreValue) {
        scoreValue.textContent = score;
      }

      // Attach tooltip handlers to score display
      attachStatsTooltipToScore();
    } else {
      scoreElement.style.display = 'none';
    }
  }

  // Helper function to attach stats tooltip to score display in popup
  function attachStatsTooltipToScore() {
    const scoreElement = document.getElementById('iqGuessrScore');
    if (!scoreElement) return;

    // Check if already attached
    if (scoreElement.hasAttribute('data-stats-tooltip-attached')) {
      return;
    }

    scoreElement.setAttribute('data-stats-tooltip-attached', 'true');
    scoreElement.style.cursor = 'pointer';
    scoreElement.title = 'Click to view detailed stats';

    // Create stats tooltip functionality for popup
    let currentTooltip = null;

    async function showStatsTooltip() {
      // Hide existing tooltip if any
      if (currentTooltip) {
        hideStatsTooltip();
        return;
      }

      try {
        // Get guess history from storage (try both local and sync)
        const resultLocal = await new Promise((resolve) => {
          chrome.storage.local.get(['iqGuessrHistory'], resolve);
        });
        const resultSync = await new Promise((resolve) => {
          chrome.storage.sync.get(['iqGuessrHistory'], resolve);
        });

        const history = resultLocal.iqGuessrHistory || resultSync.iqGuessrHistory || [];

        const stats = calculateStatsFromHistory(history);

        // Create tooltip element
        const tooltip = document.createElement('div');
        tooltip.className = 'iq-guessr-stats-tooltip popup-stats-tooltip';
        tooltip.setAttribute('data-iq-guessr-tooltip', 'true');

        // Build tooltip content
        let content = '<div class="stats-header">📊 IqGuessr Stats</div>';
        content += '<div class="stats-content">';

        if (stats.totalGuesses === 0) {
          content += '<div class="stats-empty">No guesses yet! Start guessing to see your stats.</div>';
        } else {
          // Overall stats
          content += '<div class="stats-section">';
          content += '<div class="stats-row">';
          content += `<span class="stats-label">Total Guesses:</span>`;
          content += `<span class="stats-value">${stats.totalGuesses}</span>`;
          content += '</div>';
          content += '<div class="stats-row">';
          content += `<span class="stats-label">Total Score:</span>`;
          content += `<span class="stats-value">${stats.totalScore}</span>`;
          content += '</div>';
          content += '<div class="stats-row">';
          content += `<span class="stats-label">Average Score:</span>`;
          content += `<span class="stats-value">${stats.averageScore.toFixed(1)}</span>`;
          content += '</div>';
          content += '<div class="stats-row">';
          content += `<span class="stats-label">Average Accuracy:</span>`;
          content += `<span class="stats-value">${stats.averageAccuracy.toFixed(1)}%</span>`;
          content += '</div>';
          content += '<div class="stats-row">';
          content += `<span class="stats-label">Average Difference:</span>`;
          content += `<span class="stats-value">${stats.averageDifference.toFixed(1)} pts</span>`;
          content += '</div>';
          content += '<div class="stats-row">';
          content += `<span class="stats-label">Average Confidence:</span>`;
          content += `<span class="stats-value">${stats.averageConfidence.toFixed(1)}%</span>`;
          content += '</div>';
          content += '</div>';

          // Best/Worst guesses
          if (stats.bestGuess || stats.worstGuess) {
            content += '<div class="stats-section">';
            content += '<div class="stats-section-title">Best & Worst</div>';

            if (stats.bestGuess) {
              content += '<div class="stats-row stats-highlight stats-good">';
              content += '<span class="stats-label">🎯 Best Guess:</span>';
              content += `<span class="stats-value">${stats.bestGuess.guess} → ${stats.bestGuess.actualIQ} (${stats.bestGuess.difference.toFixed(1)} pts off)</span>`;
              content += '</div>';
            }

            if (stats.worstGuess) {
              content += '<div class="stats-row stats-highlight stats-bad">';
              content += '<span class="stats-label">⚠️ Worst Guess:</span>';
              content += `<span class="stats-value">${stats.worstGuess.guess} → ${stats.worstGuess.actualIQ} (${stats.worstGuess.difference.toFixed(1)} pts off)</span>`;
              content += '</div>';
            }

            content += '</div>';
          }

          // Recent guesses
          if (stats.recentGuesses && stats.recentGuesses.length > 0) {
            content += '<div class="stats-section">';
            content += '<div class="stats-section-title">Recent Guesses</div>';
            stats.recentGuesses.forEach((guess, index) => {
              const timeStr = formatTimestamp(guess.timestamp);
              content += '<div class="stats-row stats-small">';
              content += `<span class="stats-label">${index + 1}.</span>`;
              content += `<span class="stats-value">${guess.guess} → ${guess.actual} (${guess.difference.toFixed(1)} off, ${guess.score} pts) <span class="stats-time">${timeStr}</span></span>`;
              content += '</div>';
            });
            content += '</div>';
          }
        }

        content += '</div>';
        tooltip.innerHTML = content;

        // Get the score element width to match tooltip width
        const scoreElementWidth = scoreElement.offsetWidth;
        const scoreElementRect = scoreElement.getBoundingClientRect();

        // Style the tooltip for popup context - match width of score element
        tooltip.style.cssText = `
          position: absolute;
          background: #000000;
          color: white;
          padding: 16px;
          border-radius: 8px;
          font-size: 12px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4), 0 8px 24px rgba(0, 0, 0, 0.3);
          z-index: 10000;
          width: ${scoreElementWidth}px;
          max-height: 400px;
          overflow-y: auto;
          pointer-events: auto;
          line-height: 1.5;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          margin-bottom: 8px;
          box-sizing: border-box;
        `;

        // Position relative to score element
        scoreElement.style.position = 'relative';
        scoreElement.appendChild(tooltip);
        currentTooltip = tooltip;

        // Close on click outside
        const handleClickOutside = (e) => {
          if (tooltip && !tooltip.contains(e.target) && !scoreElement.contains(e.target)) {
            hideStatsTooltip();
            document.removeEventListener('click', handleClickOutside);
          }
        };

        setTimeout(() => {
          document.addEventListener('click', handleClickOutside);
        }, 100);
      } catch (error) {
        console.warn('[IQGuessr] Error showing stats tooltip:', error);
      }
    }

    function hideStatsTooltip() {
      if (currentTooltip && currentTooltip.parentElement) {
        currentTooltip.parentElement.removeChild(currentTooltip);
      }
      currentTooltip = null;
    }

    // Calculate stats from history (same logic as content script)
    function calculateStatsFromHistory(history) {
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

      const totalGuesses = history.length;
      const totalScore = history.reduce((sum, entry) => sum + (entry.score || 0), 0);
      const totalAccuracy = history.reduce((sum, entry) => sum + (entry.accuracy || 0), 0);
      const totalConfidence = history.reduce((sum, entry) => sum + (entry.confidence || 0), 0);
      const totalDifference = history.reduce((sum, entry) => sum + (entry.difference || 0), 0);

      const averageScore = Math.round((totalScore / totalGuesses) * 10) / 10;
      const averageAccuracy = Math.round((totalAccuracy / totalGuesses) * 10) / 10;
      const averageConfidence = Math.round((totalConfidence / totalGuesses) * 10) / 10;
      const averageDifference = Math.round((totalDifference / totalGuesses) * 10) / 10;

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
    }

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

    // Attach click handler
    scoreElement.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showStatsTooltip();
    });
  }

  // Initialize defaults if not set
  Promise.all([
    new Promise((resolve) => chrome.storage.sync.get(['showIQBadge', 'showRealtimeBadge', 'useConfidenceForColor', 'enableDebugLogging', 'enableIQGuessr', 'showProfileScoreBadge', 'showAverageIQ', 'iqGuessrScore'], resolve)),
    new Promise((resolve) => chrome.storage.local.get(['iqGuessrScore'], resolve)),
    new Promise((resolve) => chrome.storage.sync.get(null, resolve)), // Get all sync keys
    new Promise((resolve) => chrome.storage.local.get(null, resolve))  // Get all local keys
  ]).then(([syncResult, localResult, allSync, allLocal]) => {
    const result = syncResult;
    // Get score from multiple sources, convert to number
    let score = syncResult.iqGuessrScore ?? localResult.iqGuessrScore ??
                allSync.iqGuessrScore ?? allLocal.iqGuessrScore ?? 0;

    // Convert to number if it's a string
    if (typeof score === 'string') {
      score = parseFloat(score) || 0;
    }
    score = Number(score) || 0;

    // Debug logging
    if (score === 0 && (allSync.iqGuessrScore || allLocal.iqGuessrScore)) {
      console.log('[IqGuessr Popup] Score found but was 0:', {
        syncResult: syncResult.iqGuessrScore,
        localResult: localResult.iqGuessrScore,
        allSync: allSync.iqGuessrScore,
        allLocal: allLocal.iqGuessrScore
      });
    }

    // Set defaults if this is first run
    // IMPORTANT: Don't overwrite iqGuessrScore if it already exists
    if (result.showIQBadge === undefined) {
      const settingsToSet = {
        showIQBadge: true,
        showRealtimeBadge: true,
        useConfidenceForColor: true, // Always enabled
        enableDebugLogging: true,
        enableIQGuessr: false,
        showProfileScoreBadge: true, // Default to showing profile badge
        showAverageIQ: false // Default to not showing average IQ
      };
      // Only set score if it doesn't exist
      if (score === 0 && !allSync.iqGuessrScore && !allLocal.iqGuessrScore) {
        settingsToSet.iqGuessrScore = 0;
      }
      chrome.storage.sync.set(settingsToSet, () => {
        if (chrome.runtime.lastError) {
          showStatus('Error loading settings', 'error');
        }
      });
      result.showIQBadge = true;
      result.showRealtimeBadge = true;
      result.useConfidenceForColor = true;
      result.enableDebugLogging = true;
      result.enableIQGuessr = false;
    }

    // Always set useConfidenceForColor to true (it's always enabled now)
    chrome.storage.sync.set({ useConfidenceForColor: true });

    // Set checkbox states
    document.getElementById('showIQBadge').checked = result.showIQBadge !== false; // Default to true
    // Real-time badge is hidden, but keep logic intact for backend
    const showRealtimeBadgeElement = document.getElementById('showRealtimeBadge');
    if (showRealtimeBadgeElement) {
      showRealtimeBadgeElement.checked = result.showRealtimeBadge !== false; // Default to true
    }
    document.getElementById('enableDebugLogging').checked = result.enableDebugLogging !== false; // Default to true
    document.getElementById('enableIQGuessr').checked = result.enableIQGuessr === true; // Default to false
    document.getElementById('showProfileScoreBadge').checked = result.showProfileScoreBadge !== false; // Default to true
    document.getElementById('showAverageIQ').checked = result.showAverageIQ === true; // Default to false

    // Update IqGuessr score display
    updateIQGuessrScore(score);

    // Update average IQ badge display
    if (typeof updateAverageIQBadge === 'function') {
      updateAverageIQBadge();
    }

    // Update dependent checkboxes state
    updateDependentCheckboxes();
  }).catch((error) => {
    console.warn('[IqGuessr] Error loading settings:', error);
    // Fallback: try sync storage only
    chrome.storage.sync.get(['showIQBadge', 'showRealtimeBadge', 'useConfidenceForColor', 'enableDebugLogging', 'enableIQGuessr', 'showProfileScoreBadge', 'showAverageIQ', 'iqGuessrScore'], (result) => {
      document.getElementById('showIQBadge').checked = result.showIQBadge !== false;
      // Real-time badge is hidden, but keep logic intact for backend
      const showRealtimeBadgeElement = document.getElementById('showRealtimeBadge');
      if (showRealtimeBadgeElement) {
        showRealtimeBadgeElement.checked = result.showRealtimeBadge !== false;
      }
      document.getElementById('enableDebugLogging').checked = result.enableDebugLogging !== false;
      document.getElementById('enableIQGuessr').checked = result.enableIQGuessr === true;
      document.getElementById('showProfileScoreBadge').checked = result.showProfileScoreBadge !== false;
      document.getElementById('showAverageIQ').checked = result.showAverageIQ === true;
      updateIQGuessrScore(result.iqGuessrScore ?? 0);
      if (typeof updateAverageIQBadge === 'function') {
        updateAverageIQBadge();
      }
      updateDependentCheckboxes();
    });
  });

  // Handle checkbox changes
  document.getElementById('showIQBadge').addEventListener('change', (e) => {
    chrome.storage.sync.set({ showIQBadge: e.target.checked }, () => {
      if (chrome.runtime.lastError) {
        showStatus('Error saving setting', 'error');
      } else {
        showStatus('Settings saved', 'success');
      }
    });
    // Update dependent checkboxes state when main toggle changes
    updateDependentCheckboxes();
  });


  // Real-time badge is hidden, but keep event listener intact for backend
  const showRealtimeBadgeElement = document.getElementById('showRealtimeBadge');
  if (showRealtimeBadgeElement) {
    showRealtimeBadgeElement.addEventListener('change', (e) => {
      chrome.storage.sync.set({ showRealtimeBadge: e.target.checked }, () => {
        if (chrome.runtime.lastError) {
          showStatus('Error saving setting', 'error');
        } else {
          showStatus('Settings saved', 'success');
        }
      });
    });
  }

  // Handle IqGuessr checkbox
  const enableIQGuessrCheckbox = document.getElementById('enableIQGuessr');
  if (enableIQGuessrCheckbox) {
    enableIQGuessrCheckbox.addEventListener('change', (e) => {
      const isEnabled = e.target.checked;
      console.log(`[IQGuessr Debug] IQGuessr ${isEnabled ? 'ENABLED' : 'DISABLED'} via popup checkbox`);

      chrome.storage.sync.set({ enableIQGuessr: isEnabled }, () => {
        if (chrome.runtime.lastError) {
          showStatus('Error saving setting', 'error');
        } else {
          showStatus('Settings saved', 'success');
          // Update dependent checkboxes state (enables/disables profile score badge checkbox)
          updateDependentCheckboxes();
          // Fetch and update score display with actual score from storage
          if (isEnabled) {
            Promise.all([
              new Promise((resolve) => chrome.storage.sync.get(['iqGuessrScore'], resolve)),
              new Promise((resolve) => chrome.storage.local.get(['iqGuessrScore'], resolve))
            ]).then(([syncResult, localResult]) => {
              const score = syncResult.iqGuessrScore ?? localResult.iqGuessrScore ?? 0;
              updateIQGuessrScore(score);
            }).catch(() => {
              chrome.storage.sync.get(['iqGuessrScore'], (result) => {
                updateIQGuessrScore(result.iqGuessrScore ?? 0);
              });
            });
          } else {
            updateIQGuessrScore(0);
          }
        }
      });
    });
  }

  const enableDebugLoggingCheckbox = document.getElementById('enableDebugLogging');
  if (enableDebugLoggingCheckbox) {
    enableDebugLoggingCheckbox.addEventListener('change', (e) => {
      chrome.storage.sync.set({ enableDebugLogging: e.target.checked }, () => {
        if (chrome.runtime.lastError) {
          showStatus('Error saving setting', 'error');
        } else {
          showStatus('Settings saved', 'success');
        }
      });
    });
  }

  // Handle showProfileScoreBadge checkbox
  document.getElementById('showProfileScoreBadge').addEventListener('change', (e) => {
    chrome.storage.sync.set({ showProfileScoreBadge: e.target.checked }, () => {
      if (chrome.runtime.lastError) {
        showStatus('Error saving settings', 'error');
      } else {
        showStatus('Settings saved', 'success');
      }
    });
  });

  // Helper function to update average IQ badge display
  async function updateAverageIQBadge() {
    const showAverageIQCheckbox = document.getElementById('showAverageIQ');
    const badgeContainer = document.getElementById('averageIQBadge');

    if (!showAverageIQCheckbox || !badgeContainer) {
      return;
    }

    const isEnabled = showAverageIQCheckbox.checked;

    if (!isEnabled) {
      badgeContainer.style.display = 'none';
      badgeContainer.innerHTML = '';
      return;
    }

    // Get average IQ from storage
    try {
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(['userAverageIQ'], resolve);
      });

      const averageData = result.userAverageIQ;

      if (!averageData || averageData.averageIQ === null || averageData.averageIQ === undefined) {
        badgeContainer.style.display = 'block';
        badgeContainer.innerHTML = '<span style="color: #6b7280; font-size: 12px;">No average IQ calculated yet. Tweet some tweets to see your average!</span>';
        return;
      }

      const averageIQ = averageData.averageIQ;
      const overallConfidence = averageData.overallConfidence !== null && averageData.overallConfidence !== undefined
        ? averageData.overallConfidence
        : averageData.averageConfidence || 0;

      // Check if badge already exists with the same data to prevent unnecessary re-renders
      const existingBadge = badgeContainer.querySelector('.iq-badge-average[data-iq-average="true"]');
      if (existingBadge) {
        const existingIQ = existingBadge.getAttribute('data-iq-score');
        const existingConfidence = existingBadge.getAttribute('data-confidence');
        if (existingIQ === String(averageIQ) && existingConfidence === String(Math.round(overallConfidence))) {
          // Badge already exists with same data, no need to recreate
          return;
        }
      }

      // Calculate color based on confidence (using same logic as badges)
      const confidenceNorm = overallConfidence / 100;
      let color;
      if (confidenceNorm < 0.1) {
        color = '#d32f2f';
      } else if (confidenceNorm < 0.2) {
        color = '#f57c00';
      } else if (confidenceNorm < 0.3) {
        color = '#fb8c00';
      } else if (confidenceNorm < 0.4) {
        color = '#fbc02d';
      } else if (confidenceNorm < 0.5) {
        color = '#fdd835';
      } else if (confidenceNorm < 0.6) {
        color = '#c5e1a5';
      } else if (confidenceNorm < 0.7) {
        color = '#81c784';
      } else if (confidenceNorm < 0.8) {
        color = '#66bb6a';
      } else if (confidenceNorm < 0.9) {
        color = '#4caf50';
      } else {
        color = '#2e7d32';
      }

      // Create badge HTML using same structure as profile page badge
      badgeContainer.style.display = 'block';

      // Create badge element using the same approach as profile page
      const badge = document.createElement('span');
      badge.className = 'iq-badge iq-badge-average iq-badge-flip';
      badge.setAttribute('data-iq-average', 'true');
      badge.setAttribute('data-iq-score', averageIQ);
      badge.setAttribute('data-confidence', Math.round(overallConfidence));
      badge.setAttribute('data-no-js-handlers', 'true');

      // Use CSS variables and minimal inline styles - same as profile page
      badge.style.setProperty('--iq-badge-bg-color', color);
      badge.style.setProperty('cursor', 'help', 'important');
      badge.style.setProperty('visibility', 'visible', 'important');
      badge.style.setProperty('opacity', '1', 'important');

      badge.innerHTML = `
        <div class="iq-badge-inner">
          <div class="iq-badge-front">
            <span class="iq-label">IQ</span>
            <span class="iq-score">${averageIQ}</span>
          </div>
          <div class="iq-badge-back">
            <span class="iq-label">%</span>
            <span class="iq-score">${Math.round(overallConfidence)}</span>
          </div>
        </div>
      `;

      // Store original background color in CSS variable for hover inversion
      badge.style.setProperty('--iq-badge-original-bg', color, 'important');

      // Clear container and add badge + tweet count
      badgeContainer.innerHTML = '';
      badgeContainer.appendChild(badge);

      // Add tweet count text
      const countText = document.createElement('span');
      countText.style.cssText = 'margin-left: 8px; color: #6b7280; font-size: 11px;';
      countText.textContent = `(${averageData.count} tweets)`;
      badgeContainer.appendChild(countText);
    } catch (error) {
      console.warn('[IqGuessr] Error updating average IQ badge:', error);
      badgeContainer.style.display = 'block';
      badgeContainer.innerHTML = '<span style="color: #6b7280; font-size: 12px;">Error loading average IQ</span>';
    }
  }

  // Handle showAverageIQ checkbox
  const showAverageIQCheckbox = document.getElementById('showAverageIQ');
  if (showAverageIQCheckbox) {
    showAverageIQCheckbox.addEventListener('change', (e) => {
      chrome.storage.sync.set({ showAverageIQ: e.target.checked }, () => {
        if (chrome.runtime.lastError) {
          showStatus('Error saving setting', 'error');
        } else {
          showStatus('Settings saved', 'success');
          updateAverageIQBadge();
        }
      });
    });

    // Listen for storage changes to update badge
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.userAverageIQ) {
        updateAverageIQBadge();
      }
    });

    // Initial update (after DOM is ready)
    setTimeout(() => {
      updateAverageIQBadge();
    }, 100);
  }

  // Handle reset button
  document.getElementById('resetSettings').addEventListener('click', () => {
    // Get current score before resetting
    Promise.all([
      new Promise((resolve) => chrome.storage.sync.get(['iqGuessrScore'], resolve)),
      new Promise((resolve) => chrome.storage.local.get(['iqGuessrScore'], resolve))
    ]).then(([syncResult, localResult]) => {
      const currentScore = syncResult.iqGuessrScore ?? localResult.iqGuessrScore ?? 0;

      if (confirm(`Reset all settings to defaults?\n\n⚠️ WARNING: This will reset your IqGuessr score from ${currentScore} to 0!\n\nAre you sure you want to continue?`)) {
      const defaults = {
        showIQBadge: true,
        showRealtimeBadge: true,
        useConfidenceForColor: true, // Always enabled
        enableDebugLogging: true,
        enableIQGuessr: false,
        showProfileScoreBadge: true,
        showAverageIQ: false,
        iqGuessrScore: 0
      };

        chrome.storage.sync.set(defaults, () => {
          if (chrome.runtime.lastError) {
            showStatus('Error resetting settings', 'error');
          } else {
            // Update UI
          document.getElementById('showIQBadge').checked = defaults.showIQBadge;
          // Real-time badge is hidden, but keep logic intact for backend
          const showRealtimeBadgeElement = document.getElementById('showRealtimeBadge');
          if (showRealtimeBadgeElement) {
            showRealtimeBadgeElement.checked = defaults.showRealtimeBadge;
          }
          document.getElementById('enableDebugLogging').checked = defaults.enableDebugLogging;
          document.getElementById('enableIQGuessr').checked = defaults.enableIQGuessr;
          document.getElementById('showProfileScoreBadge').checked = defaults.showProfileScoreBadge;
          document.getElementById('showAverageIQ').checked = defaults.showAverageIQ;
          // Update dependent checkboxes state
          updateDependentCheckboxes();
          updateIQGuessrScore(defaults.iqGuessrScore);
          if (typeof updateAverageIQBadge === 'function') {
            updateAverageIQBadge();
          }
          showStatus('Settings reset to defaults', 'success');
          }
        });
      }
    });
  });

  // Listen for IqGuessr score updates from content script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'updateIQGuessrScore') {
      updateIQGuessrScore(message.score);
    }
  });

  // Listen for storage changes to update the score display
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync') {
      // Update score when it changes
      if (changes.iqGuessrScore) {
        updateIQGuessrScore(changes.iqGuessrScore.newValue);
      }

      // When enableIQGuessr is toggled, update dependent checkboxes and fetch score
      if (changes.enableIQGuessr) {
        // Update checkbox state first
        const enableIQGuessrCheckbox = document.getElementById('enableIQGuessr');
        if (enableIQGuessrCheckbox) {
          enableIQGuessrCheckbox.checked = changes.enableIQGuessr.newValue === true;
        }
        // Update dependent checkboxes (enables/disables profile score badge checkbox)
        updateDependentCheckboxes();

        // Fetch and display the current score if enabled
        if (changes.enableIQGuessr.newValue === true) {
          Promise.all([
            new Promise((resolve) => chrome.storage.sync.get(['iqGuessrScore'], resolve)),
            new Promise((resolve) => chrome.storage.local.get(['iqGuessrScore'], resolve))
          ]).then(([syncResult, localResult]) => {
            const score = syncResult.iqGuessrScore ?? localResult.iqGuessrScore ?? 0;
            updateIQGuessrScore(score);
          }).catch(() => {
            chrome.storage.sync.get(['iqGuessrScore'], (result) => {
              updateIQGuessrScore(result.iqGuessrScore ?? 0);
            });
          });
        } else {
          updateIQGuessrScore(0);
        }
      }
    }
  });
});

