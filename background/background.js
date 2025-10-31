/**
 * Background Service Worker
 * Handles extension lifecycle and settings management
 */

// Set default settings on installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.sync.set({
      showIQBadge: true,
      showBreakdown: false,
      minIQ: 60,
      maxIQ: 145
    });
  }
});

// Listen for messages from content script if needed
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSettings') {
    chrome.storage.sync.get(['showIQBadge', 'showBreakdown', 'minIQ', 'maxIQ'], (result) => {
      sendResponse(result);
    });
    return true; // Keep message channel open for async response
  }
});

