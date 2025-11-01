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
  chrome.storage.sync.get(['showIQBadge'], (result) => {
    // Set defaults if this is first run
    if (result.showIQBadge === undefined) {
      chrome.storage.sync.set({
        showIQBadge: true
      }, () => {
        if (chrome.runtime.lastError) {
          showStatus('Error loading settings', 'error');
        }
      });
      result = { showIQBadge: true };
    }
    // Set checkbox states
    document.getElementById('showIQBadge').checked = result.showIQBadge !== false; // Default to true
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

  // Handle reset button
  document.getElementById('resetSettings').addEventListener('click', () => {
    if (confirm('Reset all settings to defaults?')) {
      const defaults = {
        showIQBadge: true
      };

      chrome.storage.sync.set(defaults, () => {
        if (chrome.runtime.lastError) {
          showStatus('Error resetting settings', 'error');
        } else {
          // Update UI
          document.getElementById('showIQBadge').checked = defaults.showIQBadge;
          showStatus('Settings reset to defaults', 'success');
        }
      });
    }
  });
});

