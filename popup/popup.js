/**
 * Popup Script - Handles settings UI
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize defaults if not set
  chrome.storage.sync.get(['showIQBadge', 'showBreakdown', 'minIQ', 'maxIQ'], (result) => {
    // Set defaults if this is first run
    if (result.showIQBadge === undefined && result.showBreakdown === undefined &&
        result.minIQ === undefined && result.maxIQ === undefined) {
      chrome.storage.sync.set({
        showIQBadge: true,
        showBreakdown: false,
        minIQ: 60,
        maxIQ: 145
      });
      result = { showIQBadge: true, showBreakdown: false, minIQ: 60, maxIQ: 145 };
    }
    // Set checkbox states
    document.getElementById('showIQBadge').checked = result.showIQBadge !== false; // Default to true
    document.getElementById('showBreakdown').checked = result.showBreakdown === true;

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
    chrome.storage.sync.set({ showIQBadge: e.target.checked });
  });

  document.getElementById('showBreakdown').addEventListener('change', (e) => {
    chrome.storage.sync.set({ showBreakdown: e.target.checked });
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
      chrome.storage.sync.set({ maxIQ: parseInt(maxIQRange.value) });
    }

    chrome.storage.sync.set({ minIQ: value });
  });

  maxIQRange.addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    maxIQValue.textContent = value;

    // Ensure max doesn't go below min
    if (value <= parseInt(minIQRange.value)) {
      const newMin = value - 5;
      minIQRange.value = Math.max(50, newMin);
      minIQValue.textContent = minIQRange.value;
      chrome.storage.sync.set({ minIQ: parseInt(minIQRange.value) });
    }

    chrome.storage.sync.set({ maxIQ: value });
  });

  // Handle reset button
  document.getElementById('resetSettings').addEventListener('click', () => {
    if (confirm('Reset all settings to defaults?')) {
      const defaults = {
        showIQBadge: true,
        showBreakdown: false,
        minIQ: 60,
        maxIQ: 145
      };

      chrome.storage.sync.set(defaults, () => {
        // Update UI
        document.getElementById('showIQBadge').checked = defaults.showIQBadge;
        document.getElementById('showBreakdown').checked = defaults.showBreakdown;
        document.getElementById('minIQ').value = defaults.minIQ;
        document.getElementById('maxIQ').value = defaults.maxIQ;
        document.getElementById('minIQValue').textContent = defaults.minIQ;
        document.getElementById('maxIQValue').textContent = defaults.maxIQ;
      });
    }
  });
});

