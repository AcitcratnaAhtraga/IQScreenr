/**
 * Stats Tooltip Component for IQGuessr
 * Displays comprehensive statistics in a tooltip/popover
 */

(function() {
  'use strict';

  let currentTooltip = null;

  /**
   * Create and show stats tooltip
   */
  async function showStatsTooltip(element) {
    // Hide existing tooltip if any
    if (currentTooltip) {
      hideStatsTooltip();
    }

    // Calculate stats
    const statsManager = window.GameManagerStats;
    if (!statsManager) {
      console.warn('[IQGuessr] Stats manager not available');
      return;
    }

    const stats = await statsManager.calculateStats();
    if (!stats) {
      return;
    }

    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.className = 'iq-guessr-stats-tooltip';
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
          const timeStr = statsManager.formatTimestamp(guess.timestamp);
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

    // Style the tooltip
    tooltip.style.cssText = `
      position: fixed;
      background: #000000;
      color: white;
      padding: 16px;
      border-radius: 8px;
      font-size: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4), 0 8px 24px rgba(0, 0, 0, 0.3);
      z-index: 100000;
      max-width: 400px;
      max-height: 500px;
      overflow-y: auto;
      pointer-events: auto;
      line-height: 1.5;
    `;

    // Position tooltip
    positionTooltip(tooltip, element);

    // Add to document
    document.body.appendChild(tooltip);
    currentTooltip = tooltip;

    // Handle clicks outside to close (for mobile)
    const handleClickOutside = (e) => {
      if (tooltip && !tooltip.contains(e.target) && !element.contains(e.target)) {
        hideStatsTooltip();
        document.removeEventListener('click', handleClickOutside);
      }
    };

    // For mobile, also close on scroll
    const handleScroll = () => {
      hideStatsTooltip();
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('click', handleClickOutside);
    };

    // Delay to avoid immediate closing on mobile
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
    }, 100);
  }

  /**
   * Position tooltip relative to element
   */
  function positionTooltip(tooltip, element) {
    const elementRect = element.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Default: position below, centered
    let top = elementRect.bottom + 8;
    let left = elementRect.left + (elementRect.width / 2) - (tooltipRect.width / 2);

    // Adjust if tooltip would go off screen
    if (left < 8) {
      left = 8;
    } else if (left + tooltipRect.width > viewportWidth - 8) {
      left = viewportWidth - tooltipRect.width - 8;
    }

    // If tooltip would go below viewport, position above
    if (top + tooltipRect.height > viewportHeight - 8) {
      top = elementRect.top - tooltipRect.height - 8;
    }

    // If tooltip would go above viewport, position below
    if (top < 8) {
      top = elementRect.bottom + 8;
    }

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
  }

  /**
   * Hide stats tooltip
   */
  function hideStatsTooltip() {
    if (currentTooltip && currentTooltip.parentElement) {
      currentTooltip.parentElement.removeChild(currentTooltip);
    }
    currentTooltip = null;
  }

  /**
   * Add tooltip handlers to an element
   */
  function attachTooltipHandlers(element) {
    if (!element) return;

    let hoverTimeout = null;
    let isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    // Desktop: hover
    element.addEventListener('mouseenter', () => {
      if (isMobile) return;

      hoverTimeout = setTimeout(() => {
        showStatsTooltip(element);
      }, 300); // Small delay to avoid accidental hovers
    });

    element.addEventListener('mouseleave', () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
        hoverTimeout = null;
      }
      // Small delay before hiding to allow moving to tooltip
      setTimeout(() => {
        if (currentTooltip && !currentTooltip.matches(':hover')) {
          hideStatsTooltip();
        }
      }, 100);
    });

    // Also allow hover on tooltip itself
    document.addEventListener('mouseenter', (e) => {
      if (e.target && e.target.nodeType === Node.ELEMENT_NODE && typeof e.target.closest === 'function' && e.target.closest('.iq-guessr-stats-tooltip')) {
        // Don't hide when hovering over tooltip
      }
    }, true);

    // Mobile: click/tap
    element.addEventListener('click', (e) => {
      if (!isMobile) return;

      e.preventDefault();
      e.stopPropagation();

      if (currentTooltip) {
        hideStatsTooltip();
      } else {
        showStatsTooltip(element);
      }
    });

    // Close tooltip when clicking outside (for mobile)
    document.addEventListener('click', (e) => {
      if (isMobile && currentTooltip &&
          !currentTooltip.contains(e.target) &&
          !element.contains(e.target)) {
        hideStatsTooltip();
      }
    });
  }

  // Export
  if (typeof window !== 'undefined') {
    window.StatsTooltip = {
      show: showStatsTooltip,
      hide: hideStatsTooltip,
      attach: attachTooltipHandlers
    };
  }
})();

