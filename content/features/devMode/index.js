/**
 * Dev Mode Feature - Main Controller
 * When CTRL is pressed, reveals all details about extension-created elements on hover
 *
 * Features:
 * - Hover over badges to see detailed information in tooltip
 * - Click badges to recalculate IQ scores
 * - Right-click badges to track all changes
 * - Press CTRL to toggle dev mode on/off
 */

(function() {
  'use strict';

  const DevModeUtils = window.DevModeUtils || {};
  const DevModeTooltip = window.DevModeTooltip || {};
  const DevModeChangeTracker = window.DevModeChangeTracker || {};
  const DevModeBadgeRecalculator = window.DevModeBadgeRecalculator || {};
  const DevModeConsoleLogger = window.DevModeConsoleLogger || {};

  let devModeActive = false;
  let currentBadge = null;
  let ctrlKeyProcessed = false;

  /**
   * Handle click on badges (for recalculation in dev mode)
   */
  function handleBadgeClick(e) {
    if (!devModeActive) return;

    const badge = DevModeUtils.findBadgeFromTarget(e.target);
    if (!badge) return;

    // Check if it's a calculated badge (has IQ score) or real-time badge
    const hasIQScore = badge.hasAttribute('data-iq-score');
    const isRealtime = badge.classList.contains('iq-badge-realtime') || badge.hasAttribute('data-iq-realtime');

    // Don't recalculate if it's a guess badge or loading badge
    const isGuessBadge = badge.classList.contains('iq-badge-guess') || badge.hasAttribute('data-iq-guess');
    const isLoadingBadge = badge.classList.contains('iq-badge-loading') || badge.hasAttribute('data-iq-loading');
    const isCalculating = badge.hasAttribute('data-iq-recalculating');

    if ((hasIQScore || isRealtime) && !isGuessBadge && !isLoadingBadge && !isCalculating) {
      e.preventDefault();
      e.stopPropagation();

      // Recalculate the badge
      DevModeBadgeRecalculator.recalculateBadge(badge);
    }
  }

  /**
   * Handle right-click on badges
   */
  function handleContextMenu(e) {
    if (!devModeActive) return;

    const badge = DevModeUtils.findBadgeFromTarget(e.target);
    if (!badge) return;

    e.preventDefault();
    e.stopPropagation();

    const trackedBadge = DevModeChangeTracker.getTrackedBadge();
    if (trackedBadge === badge) {
      // Stop tracking
      DevModeChangeTracker.stopTracking();
    } else {
      // Start tracking
      DevModeChangeTracker.startTracking(badge);
    }
  }

  /**
   * Handle mouse move over badges
   */
  function handleMouseMove(e) {
    if (!devModeActive) {
      DevModeTooltip.hideTooltip();
      return;
    }

    const badge = DevModeUtils.findBadgeFromTarget(e.target);

    if (badge && badge !== currentBadge) {
      currentBadge = badge;
      const rect = badge.getBoundingClientRect();
      DevModeTooltip.showTooltip(badge, e.clientX, e.clientY);

      // If this is a tracked badge, also log hover info to track changes
      const trackedBadge = DevModeChangeTracker.getTrackedBadge();
      if (trackedBadge === badge) {
        DevModeConsoleLogger.logToConsole(badge);
      }
    } else if (!badge) {
      DevModeTooltip.hideTooltip();
    }
  }

  /**
   * Activate dev mode
   */
  function activateDevMode() {
    if (devModeActive) return;

    devModeActive = true;
    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('click', handleBadgeClick, true);
    document.body.style.cursor = 'crosshair';

    // Show indicator
    const indicator = document.createElement('div');
    indicator.id = 'iq-dev-mode-indicator';
    indicator.textContent = '🔍 DEV MODE ACTIVE - Hover: details | Click: recalculate | Right-click: track changes | CTRL: toggle off';
    indicator.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: #667eea;
      color: white;
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: bold;
      z-index: 999998;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
      pointer-events: none;
      max-width: 400px;
    `;
    document.body.appendChild(indicator);
  }

  /**
   * Deactivate dev mode
   */
  function deactivateDevMode() {
    if (!devModeActive) return;

    devModeActive = false;
    document.removeEventListener('mousemove', handleMouseMove, true);
    document.removeEventListener('contextmenu', handleContextMenu, true);
    document.removeEventListener('click', handleBadgeClick, true);
    document.body.style.cursor = '';
    DevModeTooltip.hideTooltip();

    // Stop tracking if active
    DevModeChangeTracker.stopTracking();

    // Remove indicator
    const indicator = document.getElementById('iq-dev-mode-indicator');
    if (indicator) {
      indicator.remove();
    }
  }

  /**
   * Handle CTRL key press - toggle dev mode
   */
  function handleKeyDown(e) {
    // Check if CTRL is pressed (without other modifiers that might interfere)
    // Only process if CTRL key itself is pressed (not just held)
    if (e.key === 'Control' || e.keyCode === 17 || e.which === 17) {
      if (!ctrlKeyProcessed) {
        ctrlKeyProcessed = true;

        // Toggle dev mode
        if (devModeActive) {
          deactivateDevMode();
        } else {
          activateDevMode();
        }

        // Prevent default to avoid browser shortcuts
        e.preventDefault();
      }
    }
  }

  /**
   * Handle CTRL key release - reset processed flag
   */
  function handleKeyUp(e) {
    if (e.key === 'Control' || e.keyCode === 17 || e.which === 17) {
      ctrlKeyProcessed = false;
    }
  }

  /**
   * Initialize dev mode
   */
  function init() {
    // Listen for CTRL key
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keyup', handleKeyUp, true);

    // Also handle window blur to deactivate dev mode
    window.addEventListener('blur', () => {
      if (devModeActive) {
        deactivateDevMode();
      }
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Export for debugging
  if (typeof window !== 'undefined') {
    window.DevMode = {
      isActive: () => devModeActive,
      activate: activateDevMode,
      deactivate: deactivateDevMode,
      toggle: () => {
        if (devModeActive) {
          deactivateDevMode();
        } else {
          activateDevMode();
        }
      }
    };
  }

})();

