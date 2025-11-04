/**
 * Tooltip Display for Dev Mode
 * Creates and manages the tooltip that shows badge information on hover
 */

(function() {
  'use strict';

  const DevModeUtils = window.DevModeUtils || {};
  const DevModeBadgeDetection = window.DevModeBadgeDetection || {};
  const DevModeConsoleLogger = window.DevModeConsoleLogger || {};

  let tooltipElement = null;

  /**
   * Create and show tooltip
   */
  function showTooltip(badge, x, y) {
    // Remove existing tooltip
    if (tooltipElement) {
      tooltipElement.remove();
    }

    // Log to console
    DevModeConsoleLogger.logToConsole(badge);

    // Create tooltip element
    tooltipElement = document.createElement('div');
    tooltipElement.className = 'iq-dev-mode-tooltip';
    tooltipElement.style.cssText = `
      position: fixed;
      left: ${x + 15}px;
      top: ${y + 15}px;
      background: #1a1a1a;
      color: #fff;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      line-height: 1.6;
      max-width: 500px;
      max-height: 600px;
      overflow-y: auto;
      z-index: 999999;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
      border: 2px solid #667eea;
      pointer-events: none;
    `;

    // Build tooltip content
    const badgeType = DevModeBadgeDetection.getBadgeType(badge);
    const badgeState = DevModeBadgeDetection.getBadgeState(badge);
    const locationInfo = DevModeBadgeDetection.getLocationInfo(badge);
    const dataAttrs = DevModeUtils.getDataAttributes(badge);
    const debugData = DevModeUtils.getDebugData(badge);
    const creationContext = DevModeUtils.getCreationContext(badge);
    const styles = DevModeUtils.getRelevantStyles(badge);
    const category = DevModeBadgeDetection.detectBadgeCategory(badge);
    const category10State = DevModeBadgeDetection.detectCategory10State(badge);

    let content = '<div style="margin-bottom: 8px;">';
    content += '<div style="color: #667eea; font-weight: bold; font-size: 13px; margin-bottom: 8px;">🔍 DEV MODE - Badge Details</div>';

    // Creation Context
    if (creationContext) {
      content += '<div style="margin-bottom: 6px; padding: 4px; background: rgba(233, 30, 99, 0.1); border-left: 3px solid #e91e63;">';
      content += '<span style="color: #e91e63; font-weight: bold;">📍 Creation Origin:</span>';
      content += '<div style="margin-left: 12px; margin-top: 4px;">';
      content += `<div style="color: #e91e63;">Badge Type: ${creationContext.badgeType}</div>`;
      content += `<div style="color: #e91e63;">Created: ${new Date(creationContext.timestamp).toLocaleString()}</div>`;
      if (creationContext.creator) {
        content += `<div style="color: #e91e63; font-weight: bold;">Creator: ${creationContext.creator}</div>`;
      }
      if (creationContext.functionNames && creationContext.functionNames.length > 0) {
        content += '<div style="color: #e91e63; margin-top: 4px;">Call Chain:</div>';
        creationContext.functionNames.slice(0, 5).forEach((funcName, index) => {
          content += `<div style="color: #e91e63; margin-left: 12px; font-size: 10px;">${index + 1}. ${funcName}</div>`;
        });
        if (creationContext.functionNames.length > 5) {
          content += `<div style="color: #9e9e9e; margin-left: 12px; font-size: 10px;">... and ${creationContext.functionNames.length - 5} more</div>`;
        }
      }
      content += '</div>';
      content += '</div>';
    }

    // Badge Category
    if (category.category) {
      content += '<div style="margin-bottom: 6px;">';
      content += `<span style="color: #9c27b0; font-weight: bold;">Category ${category.category}:</span> `;
      content += `<span style="color: #fff;">${category.name}</span>`;
      if (category.subcategory) {
        content += `<div style="margin-left: 12px; margin-top: 2px; color: #9c27b0;">Subcategory ${category.subcategory}: ${category.description}</div>`;
      } else {
        content += `<div style="margin-left: 12px; margin-top: 2px; color: #9c27b0;">${category.description}</div>`;
      }
      content += '</div>';
    }

    // Category 10 State
    if (category10State) {
      content += '<div style="margin-bottom: 6px; padding: 4px; background: rgba(76, 175, 80, 0.1); border-left: 3px solid #4caf50;">';
      content += `<span style="color: #4caf50; font-weight: bold;">Category 10 State ${category10State.state}:</span> `;
      content += `<span style="color: #fff;">${category10State.name}</span>`;
      content += `<div style="margin-left: 12px; margin-top: 2px; color: #4caf50; font-size: 10px;">${category10State.description}</div>`;
      content += `<div style="margin-left: 12px; margin-top: 2px; color: #4caf50; font-size: 10px;">Visual: ${category10State.visualIndicator}</div>`;
      content += '</div>';
    }

    // Badge Type
    content += '<div style="margin-bottom: 6px;">';
    content += '<span style="color: #ff9800; font-weight: bold;">Type:</span> ';
    content += `<span style="color: #fff;">${badgeType}</span>`;
    content += '</div>';

    // Badge State
    content += '<div style="margin-bottom: 6px;">';
    content += '<span style="color: #ff9800; font-weight: bold;">State:</span>';
    content += '<div style="margin-left: 12px; margin-top: 4px;">';
    badgeState.forEach(state => {
      content += `<div style="color: #ff9800;">• ${state}</div>`;
    });
    content += '</div>';
    content += '</div>';

    // Location Info
    content += '<div style="margin-bottom: 6px;">';
    content += '<span style="color: #ff9800; font-weight: bold;">Location:</span>';
    content += '<div style="margin-left: 12px; margin-top: 4px;">';
    locationInfo.forEach(info => {
      content += `<div style="color: #4caf50;">• ${info}</div>`;
    });
    content += '</div>';
    content += '</div>';

    // Data Attributes
    if (Object.keys(dataAttrs).length > 0) {
      content += '<div style="margin-bottom: 6px;">';
      content += '<span style="color: #ff9800; font-weight: bold;">Data Attributes:</span>';
      content += '<div style="margin-left: 12px; margin-top: 4px;">';
      Object.entries(dataAttrs).forEach(([key, value]) => {
        content += `<div style="color: #9c27b0;">${key}="${value}"</div>`;
      });
      content += '</div>';
      content += '</div>';
    }

    // Debug Data
    if (debugData) {
      content += '<div style="margin-bottom: 6px;">';
      content += '<span style="color: #ff9800; font-weight: bold;">Debug Data:</span>';
      content += '<div style="margin-left: 12px; margin-top: 4px;">';
      if (debugData.iq) content += `<div style="color: #2196f3;">IQ: ${debugData.iq}</div>`;
      if (debugData.confidence !== undefined && debugData.confidence !== null) {
        content += `<div style="color: #2196f3;">Confidence: ${debugData.confidence}%</div>`;
      }
      if (debugData.textLength) {
        content += `<div style="color: #2196f3;">Text Length: ${debugData.textLength} chars</div>`;
      }
      if (debugData.timestamp) {
        content += `<div style="color: #2196f3;">Timestamp: ${new Date(debugData.timestamp).toLocaleString()}</div>`;
      }
      if (debugData.dimensionScores) {
        content += '<div style="color: #2196f3;">Dimension Scores: Available</div>';
      }
      content += '</div>';
      content += '</div>';
    }

    // Styles
    content += '<div style="margin-bottom: 6px;">';
    content += '<span style="color: #ff9800; font-weight: bold;">Styles:</span>';
    content += '<div style="margin-left: 12px; margin-top: 4px;">';
    Object.entries(styles).forEach(([key, value]) => {
      content += `<div style="color: #00bcd4;">${key}: ${value}</div>`;
    });
    content += '</div>';
    content += '</div>';

    // Class List
    if (badge.className) {
      content += '<div style="margin-bottom: 6px;">';
      content += '<span style="color: #ff9800; font-weight: bold;">Classes:</span> ';
      content += `<span style="color: #fff;">${badge.className}</span>`;
      content += '</div>';
    }

    content += '</div>';

    tooltipElement.innerHTML = content;
    document.body.appendChild(tooltipElement);

    // Adjust position if tooltip goes off screen
    setTimeout(() => {
      if (tooltipElement) {
        const tooltipRect = tooltipElement.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (tooltipRect.right > viewportWidth) {
          tooltipElement.style.left = `${x - tooltipRect.width - 15}px`;
        }
        if (tooltipRect.bottom > viewportHeight) {
          tooltipElement.style.top = `${y - tooltipRect.height - 15}px`;
        }
      }
    }, 0);
  }

  /**
   * Hide tooltip
   */
  function hideTooltip() {
    if (tooltipElement) {
      tooltipElement.remove();
      tooltipElement = null;
    }
    // Reset last logged badge when tooltip is hidden
    if (window.DevModeConsoleLogger) {
      window.DevModeConsoleLogger.resetLastLoggedBadge();
    }
  }

  // Export for use in other modules
  if (typeof window !== 'undefined') {
    window.DevModeTooltip = {
      showTooltip,
      hideTooltip
    };
  }

})();

