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
    const enableIqFiltr = document.getElementById('enableIqFiltr');

    if (!showIQBadge || !enableIQGuessr || !enableDebugLogging) {
      return; // Required elements not found
    }

    const isEnabled = showIQBadge.checked;
    // Real-time badge is hidden, but keep logic intact for backend
    if (showRealtimeBadge) {
      showRealtimeBadge.disabled = !isEnabled;
    }
    enableIQGuessr.disabled = !isEnabled;
    enableDebugLogging.disabled = !isEnabled;

    // IqFiltr requires Others' IQ to be enabled
    if (enableIqFiltr) {
      enableIqFiltr.disabled = !isEnabled;
    }

    // Get IqGuessr enabled state (needed for profile score badge visibility)
    const isGameModeEnabled = enableIQGuessr ? enableIQGuessr.checked : false;

    // Show profile score badge is only visible when IqGuessr is enabled
    if (showProfileScoreBadge) {
      const profileScoreBadgeContainer = showProfileScoreBadge.closest('.setting-item-sub');
      if (profileScoreBadgeContainer) {
        profileScoreBadgeContainer.style.display = isGameModeEnabled ? 'block' : 'none';
      } else {
        // Fallback: hide the label parent if container not found
        const labelParent = showProfileScoreBadge.closest('label')?.parentElement;
        if (labelParent) {
          labelParent.style.display = isGameModeEnabled ? 'block' : 'none';
        }
      }
    }

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
      // Uncheck IqFiltr if Others' IQ is disabled
      if (enableIqFiltr && enableIqFiltr.checked) {
        enableIqFiltr.checked = false;
        chrome.storage.sync.set({ enableIqFiltr: false });
        // Also hide the options
        const iqFiltrOptions = document.getElementById('iqFiltrOptions');
        if (iqFiltrOptions) {
          iqFiltrOptions.style.display = 'none';
        }
      }
    }

    // If IqGuessr mode is off, uncheck profile score badge
    if (!isGameModeEnabled && showProfileScoreBadge) {
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
    console.log('[IqGuessr Debug] updateIQGuessrScore called with score:', score);

    const scoreElement = document.getElementById('iqGuessrScore');
    const scoreValue = document.getElementById('iqGuessrScoreValue');
    const enableCheckbox = document.getElementById('enableIQGuessr');

    console.log('[IqGuessr Debug] Elements found:', {
      scoreElement: !!scoreElement,
      scoreValue: !!scoreValue,
      enableCheckbox: !!enableCheckbox
    });

    if (!scoreElement || !scoreValue) {
      console.warn('[IqGuessr Debug] Missing elements:', {
        scoreElement: !!scoreElement,
        scoreValue: !!scoreValue
      });
      return;
    }

    // Check if IqGuessr is enabled (either from checkbox or from storage)
    let isEnabled = false;
    if (enableCheckbox) {
      isEnabled = enableCheckbox.checked;
      console.log('[IqGuessr Debug] Checkbox state:', {
        checked: enableCheckbox.checked,
        isEnabled: isEnabled
      });
    } else {
      console.log('[IqGuessr Debug] Checkbox not found, checking storage...');
      // Fallback: check storage if checkbox not found
      chrome.storage.sync.get(['enableIQGuessr'], (result) => {
        console.log('[IqGuessr Debug] Storage result:', result);
        if (result.enableIQGuessr === true) {
          console.log('[IqGuessr Debug] Enabling score display from storage');
          scoreElement.style.display = 'flex';
          scoreValue.textContent = score;
          attachStatsTooltipToScore();
        } else {
          console.log('[IqGuessr Debug] Disabling score display (not enabled in storage)');
          scoreElement.style.display = 'none';
        }
      });
      return;
    }

    if (isEnabled) {
      console.log('[IqGuessr Debug] Enabling score display, setting score to:', score);

      // Ensure the parent collapsible section is expanded
      const gameModeContent = document.getElementById('gameModeContent');
      if (gameModeContent) {
        const isCollapsed = gameModeContent.classList.contains('collapsed') ||
                           gameModeContent.style.maxHeight === '0px' ||
                           gameModeContent.style.maxHeight === '0';
        console.log('[IqGuessr Debug] gameModeContent state:', {
          exists: !!gameModeContent,
          hasCollapsedClass: gameModeContent.classList.contains('collapsed'),
          maxHeight: gameModeContent.style.maxHeight,
          computedMaxHeight: window.getComputedStyle(gameModeContent).maxHeight,
          isCollapsed: isCollapsed
        });

        if (isCollapsed) {
          console.log('[IqGuessr Debug] Expanding gameModeContent section');
          gameModeContent.classList.remove('collapsed');
          gameModeContent.style.maxHeight = gameModeContent.scrollHeight + 'px';
        }
      }

      scoreElement.style.display = 'flex';
      scoreElement.style.visibility = 'visible';
      scoreElement.style.opacity = '1';
      scoreValue.textContent = score;

      // Log computed styles to verify visibility
      const computedStyle = window.getComputedStyle(scoreElement);
      console.log('[IqGuessr Debug] Score element styles:', {
        display: computedStyle.display,
        visibility: computedStyle.visibility,
        opacity: computedStyle.opacity,
        height: computedStyle.height,
        width: computedStyle.width,
        parentDisplay: window.getComputedStyle(scoreElement.parentElement).display
      });

      // Log element position in DOM
      console.log('[IqGuessr Debug] Score element DOM info:', {
        offsetParent: !!scoreElement.offsetParent,
        offsetHeight: scoreElement.offsetHeight,
        offsetWidth: scoreElement.offsetWidth,
        clientHeight: scoreElement.clientHeight,
        clientWidth: scoreElement.clientWidth,
        scrollHeight: scoreElement.scrollHeight,
        scrollWidth: scoreElement.scrollWidth
      });

      // Attach tooltip handlers to score display
      attachStatsTooltipToScore();
    } else {
      console.log('[IqGuessr Debug] Disabling score display (IqGuessr not enabled)');
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
    new Promise((resolve) => chrome.storage.sync.get(['showIQBadge', 'showRealtimeBadge', 'useConfidenceForColor', 'enableDebugLogging', 'enableIQGuessr', 'showProfileScoreBadge', 'showAverageIQ', 'iqGuessrScore', 'enableIqFiltr', 'filterTweets', 'filterReplies', 'filterQuotedPosts', 'filterIQThreshold', 'filterDirection', 'filterConfidenceThreshold', 'filterConfidenceDirection', 'useConfidenceInFilter', 'filterMode'], resolve)),
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
        enableDebugLogging: false,
        enableIQGuessr: false,
        showProfileScoreBadge: true, // Default to showing profile badge
        showAverageIQ: false, // Default to not showing average IQ
        enableIqFiltr: false,
        filterTweets: true,
        filterReplies: true,
        filterQuotedPosts: true,
        filterIQThreshold: 100,
        filterDirection: 'below',
        filterConfidenceThreshold: 50,
        filterConfidenceDirection: 'above',
        useConfidenceInFilter: false,
        filterMode: 'mute'
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
      result.enableDebugLogging = false;
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
    document.getElementById('enableDebugLogging').checked = result.enableDebugLogging === true; // Default to false
    document.getElementById('enableIQGuessr').checked = result.enableIQGuessr === true; // Default to false
    document.getElementById('showProfileScoreBadge').checked = result.showProfileScoreBadge !== false; // Default to true
    // Update dependent checkboxes to set initial visibility state
    updateDependentCheckboxes();
    document.getElementById('showAverageIQ').checked = result.showAverageIQ === true; // Default to false

    // Load filter settings
    const enableIqFiltrElement = document.getElementById('enableIqFiltr');
    const iqFiltrOptions = document.getElementById('iqFiltrOptions');
    if (enableIqFiltrElement) {
      enableIqFiltrElement.checked = result.enableIqFiltr === true; // Default to false
      if (iqFiltrOptions) {
        iqFiltrOptions.style.display = enableIqFiltrElement.checked ? 'block' : 'none';
      }
    }
    if (result.filterTweets !== undefined) {
      const filterTweetsElement = document.getElementById('filterTweets');
      if (filterTweetsElement) filterTweetsElement.checked = result.filterTweets !== false;
    }
    if (result.filterReplies !== undefined) {
      const filterRepliesElement = document.getElementById('filterReplies');
      if (filterRepliesElement) filterRepliesElement.checked = result.filterReplies !== false;
    }
    if (result.filterQuotedPosts !== undefined) {
      const filterQuotedPostsElement = document.getElementById('filterQuotedPosts');
      if (filterQuotedPostsElement) filterQuotedPostsElement.checked = result.filterQuotedPosts !== false;
    }
    const filterIQThresholdElement = document.getElementById('filterIQThreshold');
    if (filterIQThresholdElement) {
      filterIQThresholdElement.value = result.filterIQThreshold !== undefined ? result.filterIQThreshold : 100;
    }
    const filterDirectionElement = document.getElementById('filterDirection');
    if (filterDirectionElement) {
      filterDirectionElement.value = result.filterDirection !== undefined ? result.filterDirection : 'below';
    }

    // Load confidence filter settings
    const useConfidenceInFilterElement = document.getElementById('useConfidenceInFilter');
    const confidenceFilterOptions = document.getElementById('confidenceFilterOptions');
    if (useConfidenceInFilterElement) {
      useConfidenceInFilterElement.checked = result.useConfidenceInFilter === true;
      if (confidenceFilterOptions) {
        confidenceFilterOptions.style.display = useConfidenceInFilterElement.checked ? 'block' : 'none';
      }
    }
    const filterConfidenceThresholdElement = document.getElementById('filterConfidenceThreshold');
    if (filterConfidenceThresholdElement) {
      filterConfidenceThresholdElement.value = result.filterConfidenceThreshold !== undefined ? result.filterConfidenceThreshold : 50;
      // Update color preview
      updateConfidenceColorPreview(filterConfidenceThresholdElement.value);
    }
    const filterConfidenceDirectionElement = document.getElementById('filterConfidenceDirection');
    if (filterConfidenceDirectionElement) {
      filterConfidenceDirectionElement.value = result.filterConfidenceDirection !== undefined ? result.filterConfidenceDirection : 'above';
    }
    const filterModeElement = document.getElementById('filterMode');
    if (filterModeElement) {
      filterModeElement.value = result.filterMode !== undefined ? result.filterMode : 'mute';
    }

    // Update IqGuessr score display - call after checkbox state is set
    // Use setTimeout to ensure checkbox state is fully set and DOM is ready
    console.log('[IqGuessr Debug] Initial load - score:', score, 'enableIQGuessr:', result.enableIQGuessr);
    setTimeout(() => {
      const enableCheckbox = document.getElementById('enableIQGuessr');
      console.log('[IqGuessr Debug] After setTimeout - checkbox found:', !!enableCheckbox, 'checked:', enableCheckbox?.checked);
      if (enableCheckbox && enableCheckbox.checked) {
        console.log('[IqGuessr Debug] Calling updateIQGuessrScore with score:', score);
        updateIQGuessrScore(score);
      } else {
        console.log('[IqGuessr Debug] Calling updateIQGuessrScore with score 0 (not enabled)');
        updateIQGuessrScore(0);
      }
    }, 50);

    // Update average IQ badge display
    if (typeof updateAverageIQBadge === 'function') {
      updateAverageIQBadge();
    }

    // Update dependent checkboxes state
    updateDependentCheckboxes();
  }).catch((error) => {
    console.warn('[IqGuessr] Error loading settings:', error);
    // Fallback: try sync storage only
    chrome.storage.sync.get(['showIQBadge', 'showRealtimeBadge', 'useConfidenceForColor', 'enableDebugLogging', 'enableIQGuessr', 'showProfileScoreBadge', 'showAverageIQ', 'iqGuessrScore', 'enableIqFiltr', 'filterTweets', 'filterReplies', 'filterQuotedPosts', 'filterIQThreshold', 'filterDirection', 'filterConfidenceThreshold', 'filterConfidenceDirection', 'useConfidenceInFilter', 'filterMode'], (result) => {
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
      // Update dependent checkboxes to set initial visibility state
      updateDependentCheckboxes();
      // Update score display after checkbox state is set
      setTimeout(() => {
        updateIQGuessrScore(result.iqGuessrScore ?? 0);
      }, 0);
      if (typeof updateAverageIQBadge === 'function') {
        updateAverageIQBadge();
      }
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

      // Update visibility immediately (before storage save)
      updateDependentCheckboxes();

      // Update score display immediately with current score
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

      chrome.storage.sync.set({ enableIQGuessr: isEnabled }, () => {
        if (chrome.runtime.lastError) {
          showStatus('Error saving setting', 'error');
        } else {
          showStatus('Settings saved', 'success');
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

  // Handle IqFiltr settings
  const enableIqFiltrElement = document.getElementById('enableIqFiltr');
  if (enableIqFiltrElement) {
    enableIqFiltrElement.addEventListener('change', (e) => {
      // Prevent enabling if Others' IQ is not checked
      const showIQBadge = document.getElementById('showIQBadge');
      if (!showIQBadge || !showIQBadge.checked) {
        e.target.checked = false;
        showStatus('Others\' IQ must be enabled to use IqFiltr', 'error');
        return;
      }

      const isEnabled = e.target.checked;
      const iqFiltrOptions = document.getElementById('iqFiltrOptions');
      if (iqFiltrOptions) {
        iqFiltrOptions.style.display = isEnabled ? 'block' : 'none';
        // Trigger height recalculation for smooth transition
        if (isEnabled) {
          setTimeout(() => {
            const content = document.getElementById('iqFiltrContent');
            if (content && !content.classList.contains('collapsed')) {
              content.style.maxHeight = content.scrollHeight + 'px';
            }
          }, 10);
        }
      }
      chrome.storage.sync.set({ enableIqFiltr: isEnabled }, () => {
        if (chrome.runtime.lastError) {
          showStatus('Error saving setting', 'error');
        } else {
          showStatus('Settings saved', 'success');
        }
      });
    });

    // Also handle when checkbox is clicked - don't collapse the section
    enableIqFiltrElement.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  // Handle IqGuessr checkbox - don't collapse when clicked
  const enableIQGuessrElement = document.getElementById('enableIQGuessr');
  if (enableIQGuessrElement) {
    enableIQGuessrElement.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  const filterTweetsElement = document.getElementById('filterTweets');
  if (filterTweetsElement) {
    filterTweetsElement.addEventListener('change', (e) => {
      chrome.storage.sync.set({ filterTweets: e.target.checked }, () => {
        if (chrome.runtime.lastError) {
          showStatus('Error saving setting', 'error');
        } else {
          showStatus('Settings saved', 'success');
        }
      });
    });
  }

  const filterRepliesElement = document.getElementById('filterReplies');
  if (filterRepliesElement) {
    filterRepliesElement.addEventListener('change', (e) => {
      chrome.storage.sync.set({ filterReplies: e.target.checked }, () => {
        if (chrome.runtime.lastError) {
          showStatus('Error saving setting', 'error');
        } else {
          showStatus('Settings saved', 'success');
        }
      });
    });
  }

  const filterQuotedPostsElement = document.getElementById('filterQuotedPosts');
  if (filterQuotedPostsElement) {
    filterQuotedPostsElement.addEventListener('change', (e) => {
      chrome.storage.sync.set({ filterQuotedPosts: e.target.checked }, () => {
        if (chrome.runtime.lastError) {
          showStatus('Error saving setting', 'error');
        } else {
          showStatus('Settings saved', 'success');
        }
      });
    });
  }

  const filterIQThresholdElement = document.getElementById('filterIQThreshold');
  if (filterIQThresholdElement) {
    filterIQThresholdElement.addEventListener('change', (e) => {
      const value = parseInt(e.target.value, 10);
      if (value >= 55 && value <= 145) {
        chrome.storage.sync.set({ filterIQThreshold: value }, () => {
          if (chrome.runtime.lastError) {
            showStatus('Error saving setting', 'error');
          } else {
            showStatus('Settings saved', 'success');
          }
        });
      }
    });
  }

  const filterDirectionElement = document.getElementById('filterDirection');
  if (filterDirectionElement) {
    filterDirectionElement.addEventListener('change', (e) => {
      chrome.storage.sync.set({ filterDirection: e.target.value }, () => {
        if (chrome.runtime.lastError) {
          showStatus('Error saving setting', 'error');
        } else {
          showStatus('Settings saved', 'success');
        }
      });
    });
  }

  // Helper function to get confidence color (matches BadgeColorUtils.getConfidenceColor)
  function getConfidenceColor(confidence) {
    // Map confidence percentage (0-100) with clear color transitions
    let baseColor;

    if (confidence < 10) {
      baseColor = '#d32f2f'; // Darkest red for very low confidence (0-10%)
    } else if (confidence < 20) {
      const t = (confidence - 10) / 10;
      baseColor = interpolateColor('#d32f2f', '#f57c00', t);
    } else if (confidence < 30) {
      const t = (confidence - 20) / 10;
      baseColor = interpolateColor('#f57c00', '#fb8c00', t);
    } else if (confidence < 40) {
      const t = (confidence - 30) / 10;
      baseColor = interpolateColor('#fb8c00', '#fbc02d', t);
    } else if (confidence < 50) {
      const t = (confidence - 40) / 10;
      baseColor = interpolateColor('#fbc02d', '#fdd835', t);
    } else if (confidence < 60) {
      const t = (confidence - 50) / 10;
      baseColor = interpolateColor('#fdd835', '#c5e1a5', t);
    } else if (confidence < 70) {
      const t = (confidence - 60) / 10;
      baseColor = interpolateColor('#c5e1a5', '#81c784', t);
    } else if (confidence < 80) {
      const t = (confidence - 70) / 10;
      baseColor = interpolateColor('#81c784', '#66bb6a', t);
    } else if (confidence < 90) {
      const t = (confidence - 80) / 10;
      baseColor = interpolateColor('#66bb6a', '#4caf50', t);
    } else {
      // Use maximum vibrant green for 90-100% confidence
      baseColor = '#4caf50';
    }

    // Desaturate the color for a more elegant appearance (matching BadgeColorUtils)
    // Handle both hex and RGB strings
    let rgb;
    if (baseColor.startsWith('rgb')) {
      const match = baseColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (match) {
        rgb = { r: parseInt(match[1], 10), g: parseInt(match[2], 10), b: parseInt(match[3], 10) };
      } else {
        rgb = { r: 0, g: 0, b: 0 };
      }
    } else {
      rgb = hexToRgb(baseColor);
    }

    // Use minimal desaturation for 100% confidence to maintain maximum green
    const desaturationAmount = confidence === 100 ? 0.1 : 0.5;
    const gray = Math.round(rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114);
    const desat = {
      r: Math.round(rgb.r + (gray - rgb.r) * desaturationAmount),
      g: Math.round(rgb.g + (gray - rgb.g) * desaturationAmount),
      b: Math.round(rgb.b + (gray - rgb.b) * desaturationAmount)
    };

    return `rgb(${desat.r}, ${desat.g}, ${desat.b})`;
  }

  // Helper functions for color interpolation
  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }

  function interpolateColor(color1, color2, t) {
    const c1 = hexToRgb(color1);
    const c2 = hexToRgb(color2);
    const r = Math.round(c1.r + (c2.r - c1.r) * t);
    const g = Math.round(c1.g + (c2.g - c1.g) * t);
    const b = Math.round(c1.b + (c2.b - c1.b) * t);
    // Return RGB string to match BadgeColorUtils implementation
    return `rgb(${r}, ${g}, ${b})`;
  }

  // Helper function to update confidence color preview
  function updateConfidenceColorPreview(confidence) {
    const preview = document.getElementById('confidenceColorPreview');
    if (preview && confidence !== null && confidence !== undefined) {
      const color = getConfidenceColor(parseInt(confidence, 10));
      preview.style.backgroundColor = color;
    }
  }

  // Handle useConfidenceInFilter checkbox
  const useConfidenceInFilterElement = document.getElementById('useConfidenceInFilter');
  if (useConfidenceInFilterElement) {
    useConfidenceInFilterElement.addEventListener('change', (e) => {
      const isEnabled = e.target.checked;
      const confidenceFilterOptions = document.getElementById('confidenceFilterOptions');
      if (confidenceFilterOptions) {
        confidenceFilterOptions.style.display = isEnabled ? 'block' : 'none';
      }
      chrome.storage.sync.set({ useConfidenceInFilter: isEnabled }, () => {
        if (chrome.runtime.lastError) {
          showStatus('Error saving setting', 'error');
        } else {
          showStatus('Settings saved', 'success');
        }
      });
    });
  }

  // Handle filterConfidenceThreshold input
  const filterConfidenceThresholdElement = document.getElementById('filterConfidenceThreshold');
  if (filterConfidenceThresholdElement) {
    filterConfidenceThresholdElement.addEventListener('input', (e) => {
      const value = parseInt(e.target.value, 10);
      if (value >= 0 && value <= 100) {
        updateConfidenceColorPreview(value);
      }
    });
    filterConfidenceThresholdElement.addEventListener('change', (e) => {
      const value = parseInt(e.target.value, 10);
      if (value >= 0 && value <= 100) {
        chrome.storage.sync.set({ filterConfidenceThreshold: value }, () => {
          if (chrome.runtime.lastError) {
            showStatus('Error saving setting', 'error');
          } else {
            showStatus('Settings saved', 'success');
          }
        });
      }
    });
  }

  // Handle filterConfidenceDirection select
  const filterConfidenceDirectionElement = document.getElementById('filterConfidenceDirection');
  if (filterConfidenceDirectionElement) {
    filterConfidenceDirectionElement.addEventListener('change', (e) => {
      chrome.storage.sync.set({ filterConfidenceDirection: e.target.value }, () => {
        if (chrome.runtime.lastError) {
          showStatus('Error saving setting', 'error');
        } else {
          showStatus('Settings saved', 'success');
        }
      });
    });
  }

  // Handle filterMode select
  const filterModeElement = document.getElementById('filterMode');
  if (filterModeElement) {
    filterModeElement.addEventListener('change', (e) => {
      chrome.storage.sync.set({ filterMode: e.target.value }, () => {
        if (chrome.runtime.lastError) {
          showStatus('Error saving setting', 'error');
        } else {
          showStatus('Settings saved', 'success');
        }
      });
    });
  }

  // Collapsible sections functionality
  function setupCollapsibleSections() {
    const collapsibleHeaders = document.querySelectorAll('.collapsible-header');
    collapsibleHeaders.forEach(header => {
      const targetId = header.getAttribute('data-target');
      const content = document.getElementById(targetId);
      if (!content) return;

      // Set initial state - expand Game Mode and IqFiltr by default
      if (targetId === 'gameModeContent' || targetId === 'iqFiltrContent') {
        // Expanded by default - set maxHeight to actual height
        content.style.maxHeight = content.scrollHeight + 'px';
      } else {
        // Collapsed by default
        content.classList.add('collapsed');
        header.classList.add('collapsed');
        content.style.maxHeight = '0';
      }

      header.addEventListener('click', (e) => {
        // Don't collapse if clicking on a checkbox or input inside
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.closest('label')) {
          return;
        }

        e.preventDefault();
        e.stopPropagation();

        const targetId = header.getAttribute('data-target');
        const content = document.getElementById(targetId);
        if (!content) return;

        const isCollapsed = content.classList.contains('collapsed') ||
                           content.style.maxHeight === '0px' ||
                           parseInt(content.style.maxHeight) === 0;

        if (isCollapsed) {
          // Expand
          content.classList.remove('collapsed');
          header.classList.remove('collapsed');
          // Get actual height
          content.style.maxHeight = 'none';
          const height = content.scrollHeight;
          content.style.maxHeight = '0';
          // Force reflow and animate
          setTimeout(() => {
            content.style.maxHeight = height + 'px';
          }, 10);
        } else {
          // Collapse
          const currentHeight = content.scrollHeight;
          content.style.maxHeight = currentHeight + 'px';
          // Force reflow
          setTimeout(() => {
            content.classList.add('collapsed');
            header.classList.add('collapsed');
            content.style.maxHeight = '0';
          }, 10);
        }
      });
    });
  }

  // Initialize collapsible sections after a short delay to ensure DOM is ready
  setTimeout(() => {
    setupCollapsibleSections();
  }, 50);

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

      // Add tooltip explaining how average IQ and confidence are calculated
      const tooltipText = `Average IQ Calculation:\n\n` +
        `• Average IQ: Weighted average of all your tweets' IQ scores, where each tweet's weight is based on its confidence level.\n\n` +
        `• Overall Confidence: Calculated from three factors:\n` +
        `  - Average confidence of all tweets (40%)\n` +
        `  - Number of samples (30%)\n` +
        `  - Consistency/variance of IQ scores (30%)\n\n` +
        `• More tweets with higher individual confidence and consistent scores result in higher overall confidence.`;
      badge.setAttribute('title', tooltipText);

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
        enableDebugLogging: false,
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

