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
    const useConfidenceForColor = document.getElementById('useConfidenceForColor');
    const showRealtimeBadge = document.getElementById('showRealtimeBadge');

    const isEnabled = showIQBadge.checked;
    useConfidenceForColor.disabled = !isEnabled;
    showRealtimeBadge.disabled = !isEnabled;

    // If main toggle is off, uncheck dependent options and save
    if (!isEnabled) {
      if (useConfidenceForColor.checked) {
        useConfidenceForColor.checked = false;
        chrome.storage.sync.set({ useConfidenceForColor: false });
      }
      if (showRealtimeBadge.checked) {
        showRealtimeBadge.checked = false;
        chrome.storage.sync.set({ showRealtimeBadge: false });
      }
    }

    // Update legend display based on confidence color setting
    updateLegendDisplay();
  }

  // Helper function to update legend display
  function updateLegendDisplay() {
    const useConfidenceForColor = document.getElementById('useConfidenceForColor');
    const showIQBadge = document.getElementById('showIQBadge');
    const iqLegend = document.getElementById('iqLegend');
    const confidenceLegend = document.getElementById('confidenceLegend');

    // Show the appropriate legend based on settings
    if (showIQBadge.checked && useConfidenceForColor.checked) {
      iqLegend.style.display = 'none';
      confidenceLegend.style.display = 'block';
    } else {
      iqLegend.style.display = 'block';
      confidenceLegend.style.display = 'none';
    }
  }

  // Helper function to update IQ Guessr score display
  function updateIQGuessrScore(score) {
    const scoreElement = document.getElementById('iqGuessrScore');
    const scoreValue = document.getElementById('iqGuessrScoreValue');
    const enableCheckbox = document.getElementById('enableIQGuessr');

    if (enableCheckbox && enableCheckbox.checked) {
      scoreElement.style.display = 'flex';
      if (scoreValue) {
        scoreValue.textContent = score;
      }
    } else {
      scoreElement.style.display = 'none';
    }
  }

  // Initialize defaults if not set
  chrome.storage.sync.get(['showIQBadge', 'showRealtimeBadge', 'useConfidenceForColor', 'enableDebugLogging', 'enableIQGuessr', 'iqGuessrScore'], (result) => {
    // Set defaults if this is first run
    if (result.showIQBadge === undefined) {
      chrome.storage.sync.set({
        showIQBadge: true,
        showRealtimeBadge: true,
        useConfidenceForColor: false,
        enableDebugLogging: true,
        enableIQGuessr: false,
        iqGuessrScore: 0
      }, () => {
        if (chrome.runtime.lastError) {
          showStatus('Error loading settings', 'error');
        }
      });
      result = { showIQBadge: true, showRealtimeBadge: true, useConfidenceForColor: false, enableDebugLogging: true, enableIQGuessr: false, iqGuessrScore: 0 };
    }
    // Set checkbox states
    document.getElementById('showIQBadge').checked = result.showIQBadge !== false; // Default to true
    document.getElementById('showRealtimeBadge').checked = result.showRealtimeBadge !== false; // Default to true
    document.getElementById('useConfidenceForColor').checked = result.useConfidenceForColor === true; // Default to false
    document.getElementById('enableDebugLogging').checked = result.enableDebugLogging !== false; // Default to true
    document.getElementById('enableIQGuessr').checked = result.enableIQGuessr === true; // Default to false

    // Update IQ Guessr score display
    updateIQGuessrScore(result.iqGuessrScore || 0);

    // Update dependent checkboxes state
    updateDependentCheckboxes();
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

  document.getElementById('useConfidenceForColor').addEventListener('change', (e) => {
    chrome.storage.sync.set({ useConfidenceForColor: e.target.checked }, () => {
      if (chrome.runtime.lastError) {
        showStatus('Error saving setting', 'error');
      } else {
        showStatus('Settings saved', 'success');
      }
    });
    // Update legend display when confidence color toggle changes
    updateLegendDisplay();
  });

  document.getElementById('showRealtimeBadge').addEventListener('change', (e) => {
    chrome.storage.sync.set({ showRealtimeBadge: e.target.checked }, () => {
      if (chrome.runtime.lastError) {
        showStatus('Error saving setting', 'error');
      } else {
        showStatus('Settings saved', 'success');
      }
    });
  });

  // Handle IQ Guessr checkbox
  document.getElementById('enableIQGuessr').addEventListener('change', (e) => {
    chrome.storage.sync.set({ enableIQGuessr: e.target.checked }, () => {
      if (chrome.runtime.lastError) {
        showStatus('Error saving setting', 'error');
      } else {
        showStatus('Settings saved', 'success');
        // Update score display visibility
        updateIQGuessrScore(0);
      }
    });
  });

  document.getElementById('enableDebugLogging').addEventListener('change', (e) => {
    chrome.storage.sync.set({ enableDebugLogging: e.target.checked }, () => {
      if (chrome.runtime.lastError) {
        showStatus('Error saving setting', 'error');
      } else {
        showStatus('Settings saved', 'success');
      }
    });
  });

  // Handle reset button
  document.getElementById('resetSettings').addEventListener('click', () => {
    if (confirm('Reset all settings to defaults?')) {
      const defaults = {
        showIQBadge: true,
        showRealtimeBadge: true,
        useConfidenceForColor: false,
        enableDebugLogging: true,
        enableIQGuessr: false,
        iqGuessrScore: 0
      };

      chrome.storage.sync.set(defaults, () => {
        if (chrome.runtime.lastError) {
          showStatus('Error resetting settings', 'error');
        } else {
          // Update UI
          document.getElementById('showIQBadge').checked = defaults.showIQBadge;
          document.getElementById('showRealtimeBadge').checked = defaults.showRealtimeBadge;
          document.getElementById('useConfidenceForColor').checked = defaults.useConfidenceForColor;
          document.getElementById('enableDebugLogging').checked = defaults.enableDebugLogging;
          document.getElementById('enableIQGuessr').checked = defaults.enableIQGuessr;
          // Update dependent checkboxes state
          updateDependentCheckboxes();
          updateIQGuessrScore(defaults.iqGuessrScore);
          showStatus('Settings reset to defaults', 'success');
        }
      });
    }
  });

  // Listen for IQ Guessr score updates from content script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'updateIQGuessrScore') {
      updateIQGuessrScore(message.score);
    }
  });

  // Also periodically refresh the score display in case we missed a message
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync' && changes.iqGuessrScore) {
      updateIQGuessrScore(changes.iqGuessrScore.newValue);
    }
  });
});

