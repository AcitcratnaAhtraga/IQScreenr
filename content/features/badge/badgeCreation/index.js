/**
 * Badge Creation - Main Module
 * Aggregates all badge creation functionality from sub-modules
 *
 * This file acts as a facade that exports all badge creation functionality
 * from the modular sub-components:
 * - context: Creation context tracking
 * - types: Badge type creation (loading, invalid, IQ, realtime)
 * - handlers: Interaction handlers (hover, mobile)
 * - debug: Debug logging functionality
 */

(function() {
  'use strict';

  // Get all badge creation modules (they must be loaded before this file)
  const getContext = () => window.BadgeCreationContext || {};
  const getTypes = () => window.BadgeCreationTypes || {};
  const getHandlers = () => window.BadgeCreationHandlers || {};
  const getDebug = () => window.BadgeCreationDebug || {};

  /**
   * Aggregated BadgeCreation interface
   * Provides all badge creation functionality through a single interface
   * Maintains backward compatibility with existing code
   */
  const BadgeCreation = {
    // Context functions
    captureBadgeCreationContext: getContext().captureBadgeCreationContext,
    attachCreationContext: getContext().attachCreationContext,

    // Badge type creation functions
    createLoadingBadge: getTypes().createLoadingBadge,
    createInvalidBadge: getTypes().createInvalidBadge,
    createIQBadge: getTypes().createIQBadge,
    createRealtimeBadge: getTypes().createRealtimeBadge,

    // Handler functions
    addFlipBadgeHoverHandlers: getHandlers().addFlipBadgeHoverHandlers,
    addMobileBadgeHandlers: getHandlers().addMobileBadgeHandlers,
    invertBadgeColorsOnHover: getHandlers().invertBadgeColorsOnHover,
    restoreBadgeColorsOnLeave: getHandlers().restoreBadgeColorsOnLeave,

    // Debug functions
    logDebugInfo: getDebug().logDebugInfo
  };

  // Export for use in other modules (maintains backward compatibility)
  if (typeof window !== 'undefined') {
    window.BadgeCreation = BadgeCreation;
  }

})();

