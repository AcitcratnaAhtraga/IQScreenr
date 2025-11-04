/**
 * Dev Mode Utility Functions
 * Helper functions for badge detection and data extraction
 */

(function() {
  'use strict';

  /**
   * Check if an element is created by the extension
   */
  function isExtensionElement(element) {
    if (!element) return false;

    // Check for extension badge classes
    return element.classList.contains('iq-badge') ||
           element.classList.contains('iq-guessr-score-badge');
  }

  /**
   * Get all data attributes
   */
  function getDataAttributes(badge) {
    const attrs = {};
    Array.from(badge.attributes).forEach(attr => {
      if (attr.name.startsWith('data-')) {
        attrs[attr.name] = attr.value;
      }
    });
    return attrs;
  }

  /**
   * Get creation context if available
   */
  function getCreationContext(badge) {
    if (badge._creationContext) {
      return badge._creationContext;
    }
    return null;
  }

  /**
   * Get debug data if available
   */
  function getDebugData(badge) {
    if (badge._debugData) {
      return {
        iq: badge._debugData.iq,
        confidence: badge._debugData.result?.confidence,
        textLength: badge._debugData.text?.length,
        timestamp: badge._debugData.timestamp,
        hasFullResult: !!badge._debugData.result,
        dimensionScores: badge._debugData.result?.dimension_scores || null
      };
    }
    return null;
  }

  /**
   * Get computed styles relevant to the badge
   */
  function getRelevantStyles(badge) {
    const styles = window.getComputedStyle(badge);
    return {
      display: styles.display,
      visibility: styles.visibility,
      opacity: styles.opacity,
      backgroundColor: styles.backgroundColor,
      color: styles.color,
      position: styles.position,
      zIndex: styles.zIndex,
      cursor: styles.cursor
    };
  }

  /**
   * Find badge element from event target
   */
  function findBadgeFromTarget(target) {
    if (isExtensionElement(target)) {
      return target;
    }
    const badge = target.closest('.iq-badge, .iq-guessr-score-badge');
    if (badge && isExtensionElement(badge)) {
      return badge;
    }
    return null;
  }

  // Export for use in other modules
  if (typeof window !== 'undefined') {
    window.DevModeUtils = {
      isExtensionElement,
      getDataAttributes,
      getCreationContext,
      getDebugData,
      getRelevantStyles,
      findBadgeFromTarget
    };
  }

})();

