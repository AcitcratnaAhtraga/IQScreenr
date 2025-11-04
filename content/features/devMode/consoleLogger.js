/**
 * Console Logger for Dev Mode
 * Logs detailed badge information to the browser console
 */

(function() {
  'use strict';

  const DevModeUtils = window.DevModeUtils || {};
  const DevModeBadgeDetection = window.DevModeBadgeDetection || {};

  let lastLoggedBadge = null;

  /**
   * Log badge details to console
   */
  function logToConsole(badge) {
    // Only log if this is a different badge to avoid spam
    if (badge === lastLoggedBadge) {
      return;
    }
    lastLoggedBadge = badge;

    const badgeType = DevModeBadgeDetection.getBadgeType(badge);
    const badgeState = DevModeBadgeDetection.getBadgeState(badge);
    const locationInfo = DevModeBadgeDetection.getLocationInfo(badge);
    const dataAttrs = DevModeUtils.getDataAttributes(badge);
    const debugData = DevModeUtils.getDebugData(badge);
    const creationContext = DevModeUtils.getCreationContext(badge);
    const styles = DevModeUtils.getRelevantStyles(badge);
    const rect = badge.getBoundingClientRect();
    const category = DevModeBadgeDetection.detectBadgeCategory(badge);
    const category10State = DevModeBadgeDetection.detectCategory10State(badge);

    console.group('%c🔍 DEV MODE - Badge Details', 'color: #667eea; font-weight: bold; font-size: 14px;');

    // Creation Context
    if (creationContext) {
      console.group('%c📍 Creation Origin:', 'color: #e91e63; font-weight: bold;');
      console.log(`%cBadge Type:`, 'color: #e91e63; font-weight: bold;', creationContext.badgeType);
      console.log(`%cCreated At:`, 'color: #e91e63; font-weight: bold;', new Date(creationContext.timestamp).toLocaleString());
      console.log(`%cURL:`, 'color: #e91e63; font-weight: bold;', creationContext.url);
      console.log(`%cPathname:`, 'color: #e91e63; font-weight: bold;', creationContext.pathname);

      if (creationContext.creator) {
        console.log(`%cCreator Function:`, 'color: #e91e63; font-weight: bold;', creationContext.creator);
      }

      if (creationContext.functionNames && creationContext.functionNames.length > 0) {
        console.group('%cCall Chain:', 'color: #e91e63; font-weight: bold;');
        creationContext.functionNames.forEach((funcName, index) => {
          console.log(`%c  ${index + 1}. ${funcName}`, 'color: #e91e63;');
        });
        console.groupEnd();
      }

      if (creationContext.callStack && creationContext.callStack.length > 0) {
        console.groupCollapsed('%cFull Call Stack:', 'color: #e91e63; font-weight: bold;');
        creationContext.callStack.forEach((frame, index) => {
          if (frame.function && frame.file) {
            console.log(`%c  ${index + 1}. ${frame.function}`, 'color: #e91e63;');
            console.log(`%c     ${frame.file}:${frame.line}:${frame.column}`, 'color: #9e9e9e; font-size: 10px;');
          } else if (frame.raw) {
            console.log(`%c  ${frame.raw}`, 'color: #9e9e9e; font-size: 10px;');
          }
        });
        console.groupEnd();
      }

      console.groupEnd();
    }

    // Badge Category
    if (category.category) {
      console.group(`%cCategory ${category.category}: ${category.name}`, 'color: #9c27b0; font-weight: bold;');
      if (category.subcategory) {
        console.log(`%cSubcategory: ${category.subcategory}`, 'color: #9c27b0;');
      }
      console.log(`%cDescription: ${category.description}`, 'color: #9c27b0;');
      console.groupEnd();
    }

    // Category 10 State (if applicable)
    if (category10State) {
      console.group(`%cCategory 10 State ${category10State.state}: ${category10State.name}`, 'color: #4caf50; font-weight: bold;');
      console.log(`%cDescription: ${category10State.description}`, 'color: #4caf50;');
      console.log(`%cVisual Indicator: ${category10State.visualIndicator}`, 'color: #4caf50;');
      if (category10State.hasCompared) {
        console.log(`%cHas Compared Status: Yes (green outline border)`, 'color: #4caf50;');
      }
      console.groupEnd();
    }

    // Badge Type
    console.log('%cType:', 'color: #ff9800; font-weight: bold;', badgeType);

    // Badge State
    console.group('%cState:', 'color: #ff9800; font-weight: bold;');
    badgeState.forEach(state => {
      console.log(`%c  • ${state}`, 'color: #ff9800;');
    });
    console.groupEnd();

    // Location Info
    console.group('%cLocation:', 'color: #ff9800; font-weight: bold;');
    locationInfo.forEach(info => {
      console.log(`%c  • ${info}`, 'color: #4caf50;');
    });
    console.groupEnd();

    // Data Attributes
    if (Object.keys(dataAttrs).length > 0) {
      console.group('%cData Attributes:', 'color: #ff9800; font-weight: bold;');
      Object.entries(dataAttrs).forEach(([key, value]) => {
        console.log(`%c  ${key}="${value}"`, 'color: #9c27b0;');
      });
      console.groupEnd();
    }

    // Debug Data
    if (debugData) {
      console.group('%cDebug Data:', 'color: #ff9800; font-weight: bold;');
      if (debugData.iq) console.log(`%c  IQ: ${debugData.iq}`, 'color: #2196f3;');
      if (debugData.confidence !== undefined && debugData.confidence !== null) {
        console.log(`%c  Confidence: ${debugData.confidence}%`, 'color: #2196f3;');
      }
      if (debugData.textLength) {
        console.log(`%c  Text Length: ${debugData.textLength} chars`, 'color: #2196f3;');
      }
      if (debugData.timestamp) {
        console.log(`%c  Timestamp: ${new Date(debugData.timestamp).toLocaleString()}`, 'color: #2196f3;');
      }
      if (debugData.dimensionScores) {
        console.log('%c  Dimension Scores:', 'color: #2196f3;', debugData.dimensionScores);
      }
      if (badge._debugData && badge._debugData.result) {
        console.log('%c  Full Result Object:', 'color: #2196f3;', badge._debugData.result);
      }
      if (badge._debugData && badge._debugData.text) {
        console.log(`%c  Original Text:`, 'color: #2196f3;');
        console.log(`%c${badge._debugData.text}`, 'color: #333; font-family: monospace; background: #FFF9C4; padding: 4px; border-left: 3px solid #FFC107;');
      }
      console.groupEnd();
    }

    // Styles
    console.group('%cComputed Styles:', 'color: #ff9800; font-weight: bold;');
    Object.entries(styles).forEach(([key, value]) => {
      console.log(`%c  ${key}: ${value}`, 'color: #00bcd4;');
    });
    console.groupEnd();

    // Class List
    if (badge.className) {
      console.log('%cClasses:', 'color: #ff9800; font-weight: bold;', badge.className);
    }

    // Element Reference
    console.log('%cElement:', 'color: #ff9800; font-weight: bold;', badge);

    // DOM Path
    const path = [];
    let element = badge;
    while (element && element !== document.body) {
      let selector = element.tagName.toLowerCase();
      if (element.id) {
        selector += `#${element.id}`;
      } else if (element.className) {
        const classes = element.className.split(' ').filter(c => c).slice(0, 2).join('.');
        if (classes) selector += `.${classes}`;
      }
      path.unshift(selector);
      element = element.parentElement;
    }
    console.log('%cDOM Path:', 'color: #ff9800; font-weight: bold;', path.join(' > '));

    console.groupEnd();
  }

  /**
   * Reset the last logged badge (called when tooltip is hidden)
   */
  function resetLastLoggedBadge() {
    lastLoggedBadge = null;
  }

  // Export for use in other modules
  if (typeof window !== 'undefined') {
    window.DevModeConsoleLogger = {
      logToConsole,
      resetLastLoggedBadge
    };
  }

})();

