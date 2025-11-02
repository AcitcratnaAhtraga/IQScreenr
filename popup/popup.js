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
  });

  document.getElementById('useConfidenceForColor').addEventListener('change', (e) => {
    chrome.storage.sync.set({ useConfidenceForColor: e.target.checked }, () => {
      if (chrome.runtime.lastError) {
        showStatus('Error saving setting', 'error');
      } else {
        showStatus('Settings saved', 'success');
      }
    });
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
          showStatus('Settings reset to defaults', 'success');
        }
      });
    }
  });
});

