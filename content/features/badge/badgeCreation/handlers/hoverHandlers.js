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
   */
  function invertBadgeColorsOnHover(badge) {
    if (!badge || !badge.classList.contains('iq-badge-flip')) {
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

    // Invert: set background to black, text to original background color
    // Use direct style manipulation to ensure it overrides everything
    badge.style.backgroundColor = '#000000';
    badge.style.setProperty('background-color', '#000000', 'important');
    badge.style.setProperty('color', originalBgColor, 'important');

    // Update text elements
    const front = badge.querySelector('.iq-badge-front');
    const back = badge.querySelector('.iq-badge-back');
    if (front) {
      front.style.setProperty('color', originalBgColor, 'important');
      const frontLabel = front.querySelector('.iq-label');
      const frontScore = front.querySelector('.iq-score');
      if (frontLabel) frontLabel.style.setProperty('color', originalBgColor, 'important');
      if (frontScore) frontScore.style.setProperty('color', originalBgColor, 'important');
    }
    if (back) {
      back.style.setProperty('color', originalBgColor, 'important');
      const backLabel = back.querySelector('.iq-label');
      const backScore = back.querySelector('.iq-score');
      if (backLabel) backLabel.style.setProperty('color', originalBgColor, 'important');
      if (backScore) backScore.style.setProperty('color', originalBgColor, 'important');
    }
  }

  /**
   * Restore badge colors on mouse leave (helper function that can be called directly)
   */
  function restoreBadgeColorsOnLeave(badge) {
    if (!badge || !badge.classList.contains('iq-badge-flip')) {
      return;
    }

    const originalBgColor = badge.style.getPropertyValue('--iq-badge-original-bg');
    if (originalBgColor) {
      // Restore original colors
      badge.style.backgroundColor = originalBgColor;
      badge.style.setProperty('background-color', originalBgColor, 'important');
      badge.style.setProperty('color', '#000000', 'important');

      // Restore text elements
      const front = badge.querySelector('.iq-badge-front');
      const back = badge.querySelector('.iq-badge-back');
      if (front) {
        front.style.setProperty('color', '#000000', 'important');
        const frontLabel = front.querySelector('.iq-label');
        const frontScore = front.querySelector('.iq-score');
        if (frontLabel) frontLabel.style.setProperty('color', '#000000', 'important');
        if (frontScore) frontScore.style.setProperty('color', '#000000', 'important');
      }
      if (back) {
        back.style.setProperty('color', '#000000', 'important');
        const backLabel = back.querySelector('.iq-label');
        const backScore = back.querySelector('.iq-score');
        if (backLabel) backLabel.style.setProperty('color', '#000000', 'important');
        if (backScore) backScore.style.setProperty('color', '#000000', 'important');
      }
    }
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
      if (badge._debugData && logDebugInfo) {
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

