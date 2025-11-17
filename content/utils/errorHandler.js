/**
 * Standardized Error Handling Utility
 * Provides consistent error handling patterns across all async functions
 */

(function() {
  'use strict';

  const Logger = window.Logger || console;

  /**
   * Handle errors with consistent logging and optional recovery
   * @param {Error|string} error - Error object or error message
   * @param {Object} options - Error handling options
   * @param {string} options.context - Context where error occurred (e.g., 'TweetProcessor', 'Cache')
   * @param {Function} options.onError - Optional callback to handle error
   * @param {*} options.defaultValue - Default value to return if error occurs
   * @param {boolean} options.silent - If true, don't log the error
   * @returns {*} Returns defaultValue if provided, otherwise null
   */
  function handleError(error, options = {}) {
    const {
      context = 'Unknown',
      onError = null,
      defaultValue = null,
      silent = false
    } = options;

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : null;

    if (!silent) {
      Logger.error(`[${context}] Error:`, errorMessage);
      if (errorStack && Logger.debug) {
        Logger.debug(`[${context}] Stack:`, errorStack);
      }
    }

    // Call custom error handler if provided
    if (onError && typeof onError === 'function') {
      try {
        onError(error);
      } catch (handlerError) {
        Logger.error(`[${context}] Error handler failed:`, handlerError);
      }
    }

    return defaultValue;
  }

  /**
   * Wrap an async function with standardized error handling
   * @param {Function} asyncFn - Async function to wrap
   * @param {Object} options - Error handling options
   * @returns {Function} Wrapped function with error handling
   */
  function wrapAsync(asyncFn, options = {}) {
    return async function(...args) {
      try {
        return await asyncFn.apply(this, args);
      } catch (error) {
        return handleError(error, {
          context: options.context || asyncFn.name || 'AsyncFunction',
          onError: options.onError,
          defaultValue: options.defaultValue,
          silent: options.silent
        });
      }
    };
  }

  /**
   * Wrap a promise with standardized error handling
   * @param {Promise} promise - Promise to wrap
   * @param {Object} options - Error handling options
   * @returns {Promise} Wrapped promise with error handling
   */
  function wrapPromise(promise, options = {}) {
    return promise
      .catch(error => {
        const result = handleError(error, {
          context: options.context || 'Promise',
          onError: options.onError,
          defaultValue: options.defaultValue,
          silent: options.silent
        });
        // If defaultValue is provided, return it; otherwise reject
        if (options.defaultValue !== undefined) {
          return result;
        }
        throw error; // Re-throw if no default value
      });
  }

  /**
   * Safe async execution with error handling
   * @param {Function} asyncFn - Async function to execute
   * @param {Object} options - Error handling options
   * @returns {Promise} Promise that resolves with result or defaultValue
   */
  async function safeAsync(asyncFn, options = {}) {
    try {
      return await asyncFn();
    } catch (error) {
      return handleError(error, {
        context: options.context || 'SafeAsync',
        onError: options.onError,
        defaultValue: options.defaultValue,
        silent: options.silent
      });
    }
  }

  /**
   * Retry an async function with exponential backoff
   * @param {Function} asyncFn - Async function to retry
   * @param {Object} options - Retry options
   * @param {number} options.maxRetries - Maximum number of retries (default: 3)
   * @param {number} options.initialDelay - Initial delay in ms (default: 100)
   * @param {string} options.context - Context for error logging
   * @returns {Promise} Promise that resolves with result
   */
  async function retryAsync(asyncFn, options = {}) {
    const {
      maxRetries = 3,
      initialDelay = 100,
      context = 'RetryAsync'
    } = options;

    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await asyncFn();
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          const delay = initialDelay * Math.pow(2, attempt);
          Logger.warn(`[${context}] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    return handleError(lastError, {
      context,
      silent: false
    });
  }

  /**
   * Execute multiple async functions in parallel with error handling
   * @param {Array<Function>} asyncFns - Array of async functions to execute
   * @param {Object} options - Error handling options
   * @param {boolean} options.failFast - If true, stop on first error (default: false)
   * @param {string} options.context - Context for error logging
   * @returns {Promise<Array>} Promise that resolves with array of results
   */
  async function parallelAsync(asyncFns, options = {}) {
    const {
      failFast = false,
      context = 'ParallelAsync'
    } = options;

    if (failFast) {
      // Execute sequentially, fail on first error
      const results = [];
      for (const fn of asyncFns) {
        try {
          results.push(await fn());
        } catch (error) {
          handleError(error, { context, silent: false });
          throw error;
        }
      }
      return results;
    } else {
      // Execute in parallel, collect all errors
      const promises = asyncFns.map(async (fn, index) => {
        try {
          return await fn();
        } catch (error) {
          handleError(error, {
            context: `${context}[${index}]`,
            silent: false
          });
          return null;
        }
      });
      return Promise.all(promises);
    }
  }

  // Export for use in other modules
  if (typeof window !== 'undefined') {
    window.ErrorHandler = {
      handleError,
      wrapAsync,
      wrapPromise,
      safeAsync,
      retryAsync,
      parallelAsync
    };
  }
})();

