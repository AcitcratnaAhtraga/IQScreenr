/**
 * Loading Badge Creation
 * Creates loading badge while IQ is being calculated
 */

(function() {
  'use strict';

  // Get dependencies
  const getColorUtils = () => window.BadgeColorUtils || {};
  const getContext = () => window.BadgeCreationContext || {};

  /**
   * Create loading badge while IQ is being calculated
   */
  function createLoadingBadge() {
    const { hexToRgb, desaturateColor } = getColorUtils();
    const { attachCreationContext } = getContext();

    const badge = document.createElement('span');
    badge.className = 'iq-badge iq-badge-loading';
    badge.setAttribute('data-iq-loading', 'true');

    const darkerRed = '#b71c1c';
    const rgb = hexToRgb(darkerRed);
    const desat = desaturateColor(rgb, 0.5);
    const loadingColor = `rgb(${desat.r}, ${desat.g}, ${desat.b})`;

    // Use CSS variable for background color - CSS handles styling
    badge.style.setProperty('--iq-badge-bg-color', loadingColor);
    badge.style.setProperty('cursor', 'wait', 'important');
    badge.style.setProperty('display', 'inline-flex', 'important');
    badge.style.setProperty('visibility', 'visible', 'important');
    badge.style.setProperty('opacity', '1', 'important');

    badge.innerHTML = `
      <span class="iq-label">IQ</span>
      <span class="iq-score">
        <span class="iq-loading-spinner">↻</span>
      </span>
    `;

    // Attach creation context
    attachCreationContext(badge, 'loading');

    return badge;
  }

  // Export for use in other modules
  if (typeof window !== 'undefined') {
    window.BadgeCreationTypes = window.BadgeCreationTypes || {};
    window.BadgeCreationTypes.createLoadingBadge = createLoadingBadge;
  }

})();

