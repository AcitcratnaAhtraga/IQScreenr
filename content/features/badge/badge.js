/**
 * Badge Management - Main Module
 * Aggregates all badge-related functionality from sub-modules
 *
 * This file acts as a facade that exports all badge functionality
 * from the modular sub-components:
 * - colorUtils: Color conversion and generation
 * - badgeAnimations: Animation logic for badges
 * - badgeCreation: Badge element creation
 */

(function() {
  'use strict';

  // Get all badge modules (they must be loaded before this file)
  const getColorUtils = () => window.BadgeColorUtils || {};
  const getAnimations = () => window.BadgeAnimations || {};
  const getCreation = () => window.BadgeCreation || {};

  /**
   * Aggregated BadgeManager interface
   * Provides all badge functionality through a single interface
   */
  const BadgeManager = {
    // Color utilities
    ...getColorUtils(),

    // Badge creation functions
    ...getCreation(),

    // Animation functions
    ...getAnimations()
  };

  // Export for use in other modules (maintains backward compatibility)
  if (typeof window !== 'undefined') {
    window.BadgeManager = BadgeManager;
  }

})();

