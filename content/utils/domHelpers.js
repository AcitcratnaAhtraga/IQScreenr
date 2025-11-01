/**
 * DOM Helper Utilities
 * General DOM manipulation and helper functions
 */

(function() {
  'use strict';

/**
 * Debug logging helper
 * Debug mode is enabled by default
 */
if (typeof window.__IQ_DEBUG__ === 'undefined') {
  window.__IQ_DEBUG__ = true;
}

function debugLog(message, data = null) {
  if (window.__IQ_DEBUG__) {
    console.log(`[IQ Badge Debug] ${message}`, data || '');
  }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.DOMHelpers = {
    debugLog
  };
}

})();

