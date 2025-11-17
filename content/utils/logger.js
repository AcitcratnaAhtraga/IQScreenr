/**
 * Centralized Logging Utility
 * Wraps all console calls with enableDebugLogging checks
 */

(function() {
  'use strict';

  /**
   * Check if debug logging is enabled
   * @returns {boolean} True if debug logging is enabled
   */
  function isDebugEnabled() {
    const settings = window.Settings || {};
    return settings.enableDebugLogging === true;
  }

  /**
   * Log message if debug is enabled
   * @param {...any} args - Arguments to log
   */
  function log(...args) {
    if (isDebugEnabled()) {
      console.log(...args);
    }
  }

  /**
   * Log warning if debug is enabled
   * @param {...any} args - Arguments to log
   */
  function warn(...args) {
    if (isDebugEnabled()) {
      console.warn(...args);
    }
  }

  /**
   * Log error (always logged, regardless of debug setting)
   * @param {...any} args - Arguments to log
   */
  function error(...args) {
    // Errors are always logged
    console.error(...args);
  }

  /**
   * Log debug message if debug is enabled
   * @param {...any} args - Arguments to log
   */
  function debug(...args) {
    if (isDebugEnabled()) {
      console.debug(...args);
    }
  }

  /**
   * Log info message if debug is enabled
   * @param {...any} args - Arguments to log
   */
  function info(...args) {
    if (isDebugEnabled()) {
      console.info(...args);
    }
  }

  /**
   * Group console logs if debug is enabled
   * @param {...any} args - Arguments for group
   * @returns {Object} Group object with end method
   */
  function group(...args) {
    if (isDebugEnabled()) {
      console.group(...args);
      return {
        end: () => console.groupEnd()
      };
    }
    return {
      end: () => {} // No-op if debug disabled
    };
  }

  /**
   * Group collapsed console logs if debug is enabled
   * @param {...any} args - Arguments for group
   * @returns {Object} Group object with end method
   */
  function groupCollapsed(...args) {
    if (isDebugEnabled()) {
      console.groupCollapsed(...args);
      return {
        end: () => console.groupEnd()
      };
    }
    return {
      end: () => {} // No-op if debug disabled
    };
  }

  // Export for use in other modules
  if (typeof window !== 'undefined') {
    window.Logger = {
      log,
      warn,
      error,
      debug,
      info,
      group,
      groupCollapsed,
      isDebugEnabled
    };
  }
})();

