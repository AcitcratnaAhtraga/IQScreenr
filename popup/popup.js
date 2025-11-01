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
  chrome.storage.sync.get(['showIQBadge', 'minIQ', 'maxIQ'], (result) => {
    // Set defaults if this is first run
    if (result.showIQBadge === undefined && result.minIQ === undefined && result.maxIQ === undefined) {
      chrome.storage.sync.set({
        showIQBadge: true,
        minIQ: 60,
        maxIQ: 145
      }, () => {
        if (chrome.runtime.lastError) {
          showStatus('Error loading settings', 'error');
        }
      });
      result = { showIQBadge: true, minIQ: 60, maxIQ: 145 };
    }
    // Set checkbox states
    document.getElementById('showIQBadge').checked = result.showIQBadge !== false; // Default to true

    // Set range values
    const minIQ = result.minIQ || 60;
    const maxIQ = result.maxIQ || 145;

    document.getElementById('minIQ').value = minIQ;
    document.getElementById('maxIQ').value = maxIQ;
    document.getElementById('minIQValue').textContent = minIQ;
    document.getElementById('maxIQValue').textContent = maxIQ;
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

  // Handle range changes
  const minIQRange = document.getElementById('minIQ');
  const maxIQRange = document.getElementById('maxIQ');
  const minIQValue = document.getElementById('minIQValue');
  const maxIQValue = document.getElementById('maxIQValue');

  minIQRange.addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    minIQValue.textContent = value;

    // Ensure min doesn't exceed max
    if (value >= parseInt(maxIQRange.value)) {
      const newMax = value + 5;
      maxIQRange.value = Math.min(160, newMax);
      maxIQValue.textContent = maxIQRange.value;
      chrome.storage.sync.set({ maxIQ: parseInt(maxIQRange.value) }, () => {
        if (chrome.runtime.lastError) {
          showStatus('Error saving setting', 'error');
        }
      });
    }

    chrome.storage.sync.set({ minIQ: value }, () => {
      if (chrome.runtime.lastError) {
        showStatus('Error saving setting', 'error');
      } else {
        showStatus('Settings saved', 'success');
      }
    });
  });

  maxIQRange.addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    maxIQValue.textContent = value;

    // Ensure max doesn't go below min
    if (value <= parseInt(minIQRange.value)) {
      const newMin = value - 5;
      minIQRange.value = Math.max(50, newMin);
      minIQValue.textContent = minIQRange.value;
      chrome.storage.sync.set({ minIQ: parseInt(minIQRange.value) }, () => {
        if (chrome.runtime.lastError) {
          showStatus('Error saving setting', 'error');
        }
      });
    }

    chrome.storage.sync.set({ maxIQ: value }, () => {
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
        minIQ: 60,
        maxIQ: 145
      };

      chrome.storage.sync.set(defaults, () => {
        if (chrome.runtime.lastError) {
          showStatus('Error resetting settings', 'error');
        } else {
          // Update UI
          document.getElementById('showIQBadge').checked = defaults.showIQBadge;
          document.getElementById('minIQ').value = defaults.minIQ;
          document.getElementById('maxIQ').value = defaults.maxIQ;
          document.getElementById('minIQValue').textContent = defaults.minIQ;
          document.getElementById('maxIQValue').textContent = defaults.maxIQ;
          showStatus('Settings reset to defaults', 'success');
        }
      });
    }
  });
});

