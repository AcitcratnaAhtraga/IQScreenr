/**
 * User Average IQ Management
 * Tracks all IQ scores for the logged-in user and calculates weighted average
 */

(function() {
  'use strict';

  const STORAGE_KEY = 'userAverageIQ';
  const USER_IQ_HISTORY_KEY = 'userIQHistory';
  const MAX_HISTORY_SIZE = 1000; // Limit to prevent storage bloat

  /**
   * Get user's handle from storage or URL
   * @returns {Promise<string|null>} User's handle or null
   */
  async function getUserHandle() {
    return new Promise((resolve) => {
      // Try to get from storage first
      chrome.storage.sync.get(['twitterHandle', 'userHandle', 'handle'], (result) => {
        const storedHandle = result.twitterHandle || result.userHandle || result.handle;
        if (storedHandle) {
          resolve(storedHandle.toLowerCase());
          return;
        }

        // Try to get from URL (if on own profile page)
        const pathname = window.location.pathname;
        const urlHandle = pathname.match(/^\/([a-zA-Z0-9_]+)/)?.[1];
        if (urlHandle) {
          // Check if Edit Profile button exists (indicates own profile)
          const editProfileButton = document.querySelector('a[data-testid="editProfileButton"]');
          if (editProfileButton) {
            resolve(urlHandle.toLowerCase());
            return;
          }
        }

        resolve(null);
      });
    });
  }

  /**
   * Add a new IQ score to the user's history
   * @param {string} handle - The user's handle
   * @param {number} iq - The IQ score
   * @param {number} confidence - The confidence percentage (0-100)
   * @param {string} tweetId - Optional tweet ID for tracking
   */
  async function addIQScore(handle, iq, confidence, tweetId = null) {
    if (!handle || iq === null || iq === undefined || confidence === null || confidence === undefined) {
      return;
    }

    const normalizedHandle = handle.toLowerCase().trim().replace(/^@/, '');

    // Get user's handle to check if this is their own tweet
    const userHandle = await getUserHandle();
    if (!userHandle || userHandle !== normalizedHandle) {
      // This is not the user's own tweet, skip
      return;
    }

    try {
      // Get existing history
      const result = await new Promise((resolve) => {
        chrome.storage.local.get([USER_IQ_HISTORY_KEY], resolve);
      });

      let history = result[USER_IQ_HISTORY_KEY] || [];

      // Add new entry
      const entry = {
        handle: normalizedHandle,
        iq: Math.round(iq),
        confidence: Math.round(confidence),
        tweetId: tweetId,
        timestamp: new Date().toISOString()
      };

      // Check if we already have this tweet ID (avoid duplicates)
      if (tweetId) {
        const existingIndex = history.findIndex(e => e.tweetId === tweetId);
        if (existingIndex >= 0) {
          // Update existing entry
          history[existingIndex] = entry;
        } else {
          // Add new entry
          history.push(entry);
        }
      } else {
        // No tweet ID, just add (might have duplicates but that's okay)
        history.push(entry);
      }

      // Keep only last MAX_HISTORY_SIZE entries
      if (history.length > MAX_HISTORY_SIZE) {
        // Sort by timestamp (newest first) and keep most recent
        history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        history = history.slice(0, MAX_HISTORY_SIZE);
      }

      // Save history
      await new Promise((resolve) => {
        chrome.storage.local.set({ [USER_IQ_HISTORY_KEY]: history }, resolve);
      });

      // Recalculate average
      await calculateAndStoreAverage(history);
    } catch (error) {
      console.warn('[UserAverageIQ] Error adding IQ score:', error);
    }
  }

  /**
   * Calculate weighted average IQ using confidence intervals
   * Uses inverse variance weighting: weight = confidence^2 / (1 - confidence/100)
   * This gives higher weight to higher confidence scores
   *
   * @param {Array} history - Array of IQ score entries
   * @returns {Object} Object containing averageIQ and averageConfidence
   */
  function calculateWeightedAverage(history) {
    if (!history || history.length === 0) {
      return {
        averageIQ: null,
        averageConfidence: null,
        count: 0
      };
    }

    // Filter out invalid entries
    const validEntries = history.filter(e =>
      e.iq !== null &&
      e.iq !== undefined &&
      e.confidence !== null &&
      e.confidence !== undefined &&
      e.confidence > 0
    );

    if (validEntries.length === 0) {
      return {
        averageIQ: null,
        averageConfidence: null,
        count: 0
      };
    }

    // Calculate weights based on confidence
    // Use confidence^2 as weight to emphasize higher confidence scores
    // Normalize confidence to 0-1 range for calculation
    const entriesWithWeights = validEntries.map(e => {
      const confidenceNorm = e.confidence / 100; // 0-1 range
      // Weight = confidence^2, but ensure minimum weight for very low confidence
      const weight = Math.max(0.01, confidenceNorm * confidenceNorm);
      return {
        iq: e.iq,
        confidence: e.confidence,
        weight: weight
      };
    });

    // Calculate weighted sum and total weight
    let weightedSum = 0;
    let totalWeight = 0;
    let confidenceSum = 0;

    entriesWithWeights.forEach(e => {
      weightedSum += e.iq * e.weight;
      totalWeight += e.weight;
      confidenceSum += e.confidence;
    });

    // Calculate weighted average IQ
    const averageIQ = totalWeight > 0 ? weightedSum / totalWeight : null;

    // Calculate average confidence (simple average)
    const averageConfidence = validEntries.length > 0
      ? confidenceSum / validEntries.length
      : null;

    // Calculate overall confidence of the average
    // This represents how confident we are in the average itself
    // Based on: number of samples, average confidence, and variance
    let overallConfidence = null;
    if (validEntries.length > 0 && averageIQ !== null) {
      // Calculate variance
      let variance = 0;
      entriesWithWeights.forEach(e => {
        const diff = e.iq - averageIQ;
        variance += diff * diff * e.weight;
      });
      variance = totalWeight > 0 ? variance / totalWeight : 0;

      // Calculate standard deviation
      const stdDev = Math.sqrt(variance);

      // Overall confidence based on:
      // 1. Average confidence (higher = better)
      // 2. Number of samples (more = better, up to a point)
      // 3. Consistency (lower stdDev = better)
      const sampleFactor = Math.min(1, validEntries.length / 50); // Max at 50 samples
      const consistencyFactor = Math.max(0, 1 - (stdDev / 50)); // Penalize high variance
      const avgConfFactor = averageConfidence / 100; // Normalize to 0-1

      // Combine factors (weighted average)
      overallConfidence = (avgConfFactor * 0.4 + sampleFactor * 0.3 + consistencyFactor * 0.3) * 100;
      overallConfidence = Math.max(0, Math.min(100, Math.round(overallConfidence)));
    }

    return {
      averageIQ: averageIQ !== null ? Math.round(averageIQ) : null,
      averageConfidence: averageConfidence !== null ? Math.round(averageConfidence) : null,
      overallConfidence: overallConfidence,
      count: validEntries.length
    };
  }

  /**
   * Calculate and store the average IQ
   * @param {Array} history - Optional history array (if not provided, loads from storage)
   */
  async function calculateAndStoreAverage(history = null) {
    try {
      // Load history if not provided
      if (!history) {
        const result = await new Promise((resolve) => {
          chrome.storage.local.get([USER_IQ_HISTORY_KEY], resolve);
        });
        history = result[USER_IQ_HISTORY_KEY] || [];
      }

      // Calculate weighted average
      const average = calculateWeightedAverage(history);

      // Store average
      const averageData = {
        averageIQ: average.averageIQ,
        averageConfidence: average.averageConfidence,
        overallConfidence: average.overallConfidence,
        count: average.count,
        lastUpdated: new Date().toISOString()
      };

      await new Promise((resolve) => {
        chrome.storage.local.set({ [STORAGE_KEY]: averageData }, resolve);
      });

      return averageData;
    } catch (error) {
      console.warn('[UserAverageIQ] Error calculating average:', error);
      return null;
    }
  }

  /**
   * Get the user's average IQ
   * @returns {Promise<Object>} Average IQ data
   */
  async function getAverageIQ() {
    try {
      // First, recalculate to ensure it's up to date
      await calculateAndStoreAverage();

      const result = await new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEY], resolve);
      });

      return result[STORAGE_KEY] || {
        averageIQ: null,
        averageConfidence: null,
        overallConfidence: null,
        count: 0
      };
    } catch (error) {
      console.warn('[UserAverageIQ] Error getting average IQ:', error);
      return {
        averageIQ: null,
        averageConfidence: null,
        overallConfidence: null,
        count: 0
      };
    }
  }

  /**
   * Get user's IQ history
   * @returns {Promise<Array>} Array of IQ score entries
   */
  async function getIQHistory() {
    try {
      const result = await new Promise((resolve) => {
        chrome.storage.local.get([USER_IQ_HISTORY_KEY], resolve);
      });

      return result[USER_IQ_HISTORY_KEY] || [];
    } catch (error) {
      console.warn('[UserAverageIQ] Error getting IQ history:', error);
      return [];
    }
  }

  /**
   * Clear user's IQ history and average
   */
  async function clearHistory() {
    try {
      await new Promise((resolve) => {
        chrome.storage.local.remove([STORAGE_KEY, USER_IQ_HISTORY_KEY], resolve);
      });
    } catch (error) {
      console.warn('[UserAverageIQ] Error clearing history:', error);
    }
  }

  // Export for use in other modules
  if (typeof window !== 'undefined') {
    window.UserAverageIQ = {
      addIQScore,
      getAverageIQ,
      getIQHistory,
      calculateAndStoreAverage,
      getUserHandle,
      clearHistory
    };
  }
})();

