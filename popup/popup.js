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

  // Initialize defaults if not set
  chrome.storage.sync.get(['showIQBadge', 'showRealtimeBadge', 'useConfidenceForColor'], (result) => {
    // Set defaults if this is first run
    if (result.showIQBadge === undefined) {
      chrome.storage.sync.set({
        showIQBadge: true,
        showRealtimeBadge: true,
        useConfidenceForColor: false
      }, () => {
        if (chrome.runtime.lastError) {
          showStatus('Error loading settings', 'error');
        }
      });
      result = { showIQBadge: true, showRealtimeBadge: true, useConfidenceForColor: false };
    }
    // Set checkbox states
    document.getElementById('showIQBadge').checked = result.showIQBadge !== false; // Default to true
    document.getElementById('showRealtimeBadge').checked = result.showRealtimeBadge !== false; // Default to true
    document.getElementById('useConfidenceForColor').checked = result.useConfidenceForColor === true; // Default to false

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

  // Handle reset button
  document.getElementById('resetSettings').addEventListener('click', () => {
    if (confirm('Reset all settings to defaults?')) {
      const defaults = {
        showIQBadge: true,
        showRealtimeBadge: true,
        useConfidenceForColor: false
      };

      chrome.storage.sync.set(defaults, () => {
        if (chrome.runtime.lastError) {
          showStatus('Error resetting settings', 'error');
        } else {
          // Update UI
          document.getElementById('showIQBadge').checked = defaults.showIQBadge;
          document.getElementById('showRealtimeBadge').checked = defaults.showRealtimeBadge;
          document.getElementById('useConfidenceForColor').checked = defaults.useConfidenceForColor;
          // Update dependent checkboxes state
          updateDependentCheckboxes();
          showStatus('Settings reset to defaults', 'success');
        }
      });
    }
  });
});

