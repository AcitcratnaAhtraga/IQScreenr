/**
 * Popup UI Management
 * Handles UI updates and dependent checkbox logic
 */

(function() {
  'use strict';

  /**
   * Update dependent checkboxes enabled/disabled state
   */
  function updateDependentCheckboxes() {
    const showIQBadge = document.getElementById('showIQBadge');
    const showRealtimeBadge = document.getElementById('showRealtimeBadge');
    const enableIQGuessr = document.getElementById('enableIQGuessr');
    const showProfileScoreBadge = document.getElementById('showProfileScoreBadge');
    const enableDebugLogging = document.getElementById('enableDebugLogging');
    const enableIqFiltr = document.getElementById('enableIqFiltr');

    if (!showIQBadge || !enableIQGuessr || !enableDebugLogging) {
      return;
    }

    const isEnabled = showIQBadge.checked;
    if (showRealtimeBadge) {
      showRealtimeBadge.disabled = !isEnabled;
    }
    enableIQGuessr.disabled = !isEnabled;
    enableDebugLogging.disabled = !isEnabled;

    if (enableIqFiltr) {
      enableIqFiltr.disabled = !isEnabled;
    }

    const isGameModeEnabled = enableIQGuessr ? enableIQGuessr.checked : false;

    if (showProfileScoreBadge) {
      const profileScoreBadgeContainer = showProfileScoreBadge.closest('.setting-item-sub');
      if (profileScoreBadgeContainer) {
        profileScoreBadgeContainer.style.display = isGameModeEnabled ? 'block' : 'none';
      } else {
        const labelParent = showProfileScoreBadge.closest('label')?.parentElement;
        if (labelParent) {
          labelParent.style.display = isGameModeEnabled ? 'block' : 'none';
        }
      }
    }

    if (!isEnabled) {
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
      if (enableIqFiltr && enableIqFiltr.checked) {
        enableIqFiltr.checked = false;
        chrome.storage.sync.set({ enableIqFiltr: false });
        const iqFiltrOptions = document.getElementById('iqFiltrOptions');
        if (iqFiltrOptions) {
          iqFiltrOptions.style.display = 'none';
        }
      }
    }

    if (!isGameModeEnabled && showProfileScoreBadge) {
      if (showProfileScoreBadge.checked) {
        showProfileScoreBadge.checked = false;
        chrome.storage.sync.set({ showProfileScoreBadge: false });
      }
    }

    updateLegendDisplay();
  }

  /**
   * Update legend display visibility
   */
  function updateLegendDisplay() {
    const showIQBadge = document.getElementById('showIQBadge');
    const iqLegend = document.getElementById('iqLegend');
    const confidenceLegend = document.getElementById('confidenceLegend');

    if (!showIQBadge) return;

    const isEnabled = showIQBadge.checked;

    if (iqLegend) {
      iqLegend.style.display = isEnabled ? 'block' : 'none';
    }

    // Confidence legend is always shown (confidence is always used for color)
    if (confidenceLegend) {
      confidenceLegend.style.display = isEnabled ? 'block' : 'none';
    }
  }

  /**
   * Setup collapsible sections
   */
  function setupCollapsibleSections() {
    const collapsibles = document.querySelectorAll('.collapsible');
    collapsibles.forEach(collapsible => {
      const header = collapsible.querySelector('.collapsible-header');
      if (header) {
        header.addEventListener('click', () => {
          collapsible.classList.toggle('expanded');
          const content = collapsible.querySelector('.collapsible-content');
          if (content) {
            content.style.display = collapsible.classList.contains('expanded') ? 'block' : 'none';
          }
        });
      }
    });
  }

  // Export
  if (typeof window !== 'undefined') {
    window.PopupUI = {
      updateDependentCheckboxes,
      updateLegendDisplay,
      setupCollapsibleSections
    };
  }
})();

