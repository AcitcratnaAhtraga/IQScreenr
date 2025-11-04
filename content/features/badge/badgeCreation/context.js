/**
 * Badge Creation Context
 * Tracks where badges were created from (call stack, function names, etc.)
 */

(function() {
  'use strict';

  /**
   * Capture creation context for a badge
   * Tracks where the badge was created from (call stack, function names, etc.)
   */
  function captureBadgeCreationContext(badgeType) {
    const context = {
      badgeType: badgeType,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      pathname: window.location.pathname,
      creator: null,
      callStack: [],
      functionNames: []
    };

    try {
      // Get call stack
      const stack = new Error().stack;
      if (stack) {
        const stackLines = stack.split('\n').slice(2); // Skip Error and this function

        // Extract function names and file locations
        context.callStack = stackLines.map((line, index) => {
          const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)|at\s+(.+?):(\d+):(\d+)|at\s+(.+)/);
          if (match) {
            return {
              index: index,
              function: match[1] || match[8] || 'anonymous',
              file: match[2] || match[5] || 'unknown',
              line: match[3] || match[6] || 'unknown',
              column: match[4] || match[7] || 'unknown',
              raw: line.trim()
            };
          }
          return { index: index, raw: line.trim() };
        }).filter(frame => frame.raw && !frame.raw.includes('badgeCreation.js') || frame.index < 5);

        // Extract meaningful function names
        context.functionNames = stackLines
          .map(line => {
            const match = line.match(/at\s+(.+?)\s+\(/);
            if (match) {
              const funcName = match[1];
              // Filter out internal functions
              if (!funcName.includes('badgeCreation.js') &&
                  !funcName.includes('captureBadgeCreationContext') &&
                  funcName !== 'Error') {
                return funcName;
              }
            }
            return null;
          })
          .filter(f => f !== null)
          .slice(0, 10); // Limit to first 10 meaningful functions

        // Find the creator function (first meaningful function in stack)
        if (context.functionNames.length > 0) {
          context.creator = context.functionNames[0];
        }
      }
    } catch (e) {
      // Fallback if stack trace not available
      context.error = 'Could not capture stack trace';
    }

    return context;
  }

  /**
   * Attach creation context to a badge
   */
  function attachCreationContext(badge, badgeType) {
    if (!badge) return;

    const context = captureBadgeCreationContext(badgeType);
    badge._creationContext = context;

    // Also store as data attribute for easy access
    if (context.creator) {
      badge.setAttribute('data-created-by', context.creator);
    }
    badge.setAttribute('data-created-at', context.timestamp);
  }

  // Export for use in other modules
  if (typeof window !== 'undefined') {
    window.BadgeCreationContext = {
      captureBadgeCreationContext,
      attachCreationContext
    };
  }

})();

