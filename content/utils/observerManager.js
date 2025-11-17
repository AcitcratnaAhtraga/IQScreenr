/**
 * Observer Management Utility
 * Tracks all MutationObservers and ensures proper cleanup
 */

(function() {
  'use strict';

  // Track all active observers
  const activeObservers = new Set();

  /**
   * Create a tracked MutationObserver
   * @param {Function} callback - Mutation callback
   * @returns {MutationObserver} Observer instance
   */
  function createObserver(callback) {
    const observer = new MutationObserver(callback);
    activeObservers.add(observer);
    return observer;
  }

  /**
   * Disconnect and remove an observer
   * @param {MutationObserver} observer - Observer to disconnect
   */
  function disconnectObserver(observer) {
    if (observer) {
      observer.disconnect();
      activeObservers.delete(observer);
    }
  }

  /**
   * Disconnect all observers
   */
  function disconnectAllObservers() {
    for (const observer of activeObservers) {
      observer.disconnect();
    }
    activeObservers.clear();
  }

  /**
   * Get count of active observers
   * @returns {number} Number of active observers
   */
  function getObserverCount() {
    return activeObservers.size;
  }

  // Cleanup on page unload
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', disconnectAllObservers);
    window.addEventListener('pagehide', disconnectAllObservers);
  }

  // Export for use in other modules
  if (typeof window !== 'undefined') {
    window.ObserverManager = {
      createObserver,
      disconnectObserver,
      disconnectAllObservers,
      getObserverCount
    };
  }
})();

