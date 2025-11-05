/**
 * Badge Hover Handlers
 * Handles color inversion on hover for flip badges
 */

(function() {
  'use strict';

  // Get dependencies
  const getDebug = () => window.BadgeCreationDebug || {};

  /**
   * Invert badge colors on hover (helper function that can be called directly)
   * For badges with data-no-js-handlers, this does nothing - CSS handles hover
   */
  function invertBadgeColorsOnHover(badge) {
    if (!badge || !badge.classList.contains('iq-badge-flip')) {
      return;
    }

    // Skip if badge should use CSS-only hover (no JS handlers)
    if (badge.hasAttribute('data-no-js-handlers') || badge._skipHandlers) {
      return;
    }

    // Store original background color if not already stored
    let originalBg = badge.style.getPropertyValue('--iq-badge-original-bg');
    if (!originalBg) {
      const computedBg = window.getComputedStyle(badge).backgroundColor;
      if (computedBg && computedBg !== 'rgba(0, 0, 0, 0)' && computedBg !== 'transparent') {
        badge.style.setProperty('--iq-badge-original-bg', computedBg, 'important');
        originalBg = computedBg;
      }
    }

    // Get the original background color from CSS variable or computed style
    const originalBgColor = originalBg || window.getComputedStyle(badge).backgroundColor;

    if (!originalBgColor || originalBgColor === 'rgba(0, 0, 0, 0)' || originalBgColor === 'transparent') {
      return; // Can't invert if we don't have a valid color
    }

    // Use CSS class instead of inline styles - CSS handles the actual styling
    // This allows CSS to handle hover with proper specificity
    badge.classList.add('iq-badge-hover-active');
  }

  /**
   * Restore badge colors on mouse leave (helper function that can be called directly)
   * For badges with data-no-js-handlers, this does nothing - CSS handles hover
   */
  function restoreBadgeColorsOnLeave(badge) {
    if (!badge || !badge.classList.contains('iq-badge-flip')) {
      return;
    }

    // Skip if badge should use CSS-only hover (no JS handlers)
    if (badge.hasAttribute('data-no-js-handlers') || badge._skipHandlers) {
      return;
    }

    // Remove CSS class - CSS handles the actual styling
    badge.classList.remove('iq-badge-hover-active');
  }

  /**
   * Add hover handlers for color inversion on flip badges
   */
  function addFlipBadgeHoverHandlers(badge) {
    const { logDebugInfo } = getDebug();

    if (!badge || !badge.classList.contains('iq-badge-flip')) {
      // If badge doesn't have flip class yet but has confidence, wait a bit and try again
      if (badge && badge.hasAttribute('data-confidence')) {
        setTimeout(() => {
          if (badge.classList.contains('iq-badge-flip')) {
            addFlipBadgeHoverHandlers(badge);
          }
        }, 100);
      }
      return;
    }

    // Remove existing handlers if they exist (to avoid duplicates)
    if (badge._hoverHandlers) {
      try {
        if (badge._hoverHandlers.mouseenter) {
          badge.removeEventListener('mouseenter', badge._hoverHandlers.mouseenter, { capture: true });
        }
        if (badge._hoverHandlers.mouseleave) {
          badge.removeEventListener('mouseleave', badge._hoverHandlers.mouseleave, { capture: true });
        }
      } catch (e) {
        // Ignore errors when removing listeners
      }
    }

    const mouseenterHandler = () => {
      // Prevent duplicate debug log calls within cooldown period
      const now = Date.now();
      const lastDebugLogTime = badge._lastDebugLogTime || 0;
      const DEBUG_LOG_COOLDOWN = 500; // 500ms cooldown between calls

      if (badge._debugData && logDebugInfo && (now - lastDebugLogTime >= DEBUG_LOG_COOLDOWN)) {
        badge._lastDebugLogTime = now;
        logDebugInfo(badge._debugData);
      }

      // Always try to invert colors (helper function handles validation)
      invertBadgeColorsOnHover(badge);
    };

    const mouseleaveHandler = () => {
      restoreBadgeColorsOnLeave(badge);
    };

    // Add handlers - use capture phase to ensure they run before other handlers
    badge.addEventListener('mouseenter', mouseenterHandler, { capture: true, passive: true });
    badge.addEventListener('mouseleave', mouseleaveHandler, { capture: true, passive: true });
    badge._hoverHandlersAdded = true;
    badge._hoverHandlers = { mouseenter: mouseenterHandler, mouseleave: mouseleaveHandler };

    // Also add a CSS-based fallback using mouseover (bubbles and works even if handlers fail)
    const mouseoverHandler = (e) => {
      if (e.target === badge || badge.contains(e.target)) {
        invertBadgeColorsOnHover(badge);
      }
    };

    const mouseoutHandler = (e) => {
      if (e.target === badge || badge.contains(e.target)) {
        // Only restore if we're actually leaving the badge (not just moving to a child)
        if (!badge.contains(e.relatedTarget)) {
          restoreBadgeColorsOnLeave(badge);
        }
      }
    };

    badge.addEventListener('mouseover', mouseoverHandler, { capture: true, passive: true });
    badge.addEventListener('mouseout', mouseoutHandler, { capture: true, passive: true });

    // Store these as well for cleanup
    if (!badge._hoverHandlers) {
      badge._hoverHandlers = {};
    }
    badge._hoverHandlers.mouseover = mouseoverHandler;
    badge._hoverHandlers.mouseout = mouseoutHandler;
  }

  // Export for use in other modules
  if (typeof window !== 'undefined') {
    window.BadgeCreationHandlers = window.BadgeCreationHandlers || {};
    window.BadgeCreationHandlers.invertBadgeColorsOnHover = invertBadgeColorsOnHover;
    window.BadgeCreationHandlers.restoreBadgeColorsOnLeave = restoreBadgeColorsOnLeave;
    window.BadgeCreationHandlers.addFlipBadgeHoverHandlers = addFlipBadgeHoverHandlers;
  }

})();

