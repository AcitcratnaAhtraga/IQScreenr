/**
 * Timer Management Utility
 * Centralized timer management with automatic cleanup on page unload
 */

(function() {
  'use strict';

  const Constants = window.Constants || {};
  const TIMERS = Constants.TIMERS || {};

  // Track all active timers
  const activeTimers = new Set();
  const activeIntervals = new Set();

  /**
   * Wrapped setTimeout with automatic cleanup tracking
   * @param {Function} callback - Function to call
   * @param {number} delay - Delay in milliseconds
   * @returns {number} Timer ID
   */
  function setTimeout(callback, delay) {
    const timerId = window.setTimeout(() => {
      activeTimers.delete(timerId);
      callback();
    }, delay);
    activeTimers.add(timerId);
    return timerId;
  }

  /**
   * Wrapped setInterval with automatic cleanup tracking
   * @param {Function} callback - Function to call
   * @param {number} delay - Delay in milliseconds
   * @returns {number} Interval ID
   */
  function setInterval(callback, delay) {
    const intervalId = window.setInterval(callback, delay);
    activeIntervals.add(intervalId);
    return intervalId;
  }

  /**
   * Clear a timeout timer
   * @param {number} timerId - Timer ID
   */
  function clearTimeout(timerId) {
    if (timerId) {
      window.clearTimeout(timerId);
      activeTimers.delete(timerId);
    }
  }

  /**
   * Clear an interval timer
   * @param {number} intervalId - Interval ID
   */
  function clearInterval(intervalId) {
    if (intervalId) {
      window.clearInterval(intervalId);
      activeIntervals.delete(intervalId);
    }
  }

  /**
   * Clear all active timers
   */
  function clearAllTimers() {
    // Clear all timeouts
    for (const timerId of activeTimers) {
      window.clearTimeout(timerId);
    }
    activeTimers.clear();

    // Clear all intervals
    for (const intervalId of activeIntervals) {
      window.clearInterval(intervalId);
    }
    activeIntervals.clear();
  }

  /**
   * Get count of active timers
   * @returns {Object} Object with timeout and interval counts
   */
  function getTimerCounts() {
    return {
      timeouts: activeTimers.size,
      intervals: activeIntervals.size,
      total: activeTimers.size + activeIntervals.size
    };
  }

  // Cleanup on page unload
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', clearAllTimers);
    window.addEventListener('pagehide', clearAllTimers);
    
    // Also cleanup on visibility change (when tab becomes hidden)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Optionally clear timers when tab is hidden
        // Uncomment if you want aggressive cleanup:
        // clearAllTimers();
      }
    });
  }

  // Export for use in other modules
  if (typeof window !== 'undefined') {
    window.TimerManager = {
      setTimeout,
      setInterval,
      clearTimeout,
      clearInterval,
      clearAllTimers,
      getTimerCounts
    };
  }
})();

