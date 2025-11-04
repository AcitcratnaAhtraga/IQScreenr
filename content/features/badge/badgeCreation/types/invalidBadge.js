/**
 * Invalid Badge Creation
 * Creates "X" badge for invalid tweets
 */

(function() {
  'use strict';

  // Get dependencies
  const getContext = () => window.BadgeCreationContext || {};

  /**
   * Create "X" badge for invalid tweets
   */
  function createInvalidBadge() {
    const { attachCreationContext } = getContext();

    const badge = document.createElement('span');
    badge.className = 'iq-badge iq-badge-invalid iq-badge-flip';
    badge.setAttribute('data-iq-invalid', 'true');

    badge.style.setProperty('background-color', '#000000', 'important');
    badge.style.setProperty('color', '#9e9e9e', 'important');
    badge.style.setProperty('cursor', 'help', 'important');
    badge.style.setProperty('display', 'inline-flex', 'important');
    badge.style.setProperty('visibility', 'visible', 'important');
    badge.style.setProperty('opacity', '1', 'important');

    badge.innerHTML = `
      <div class="iq-badge-inner">
        <div class="iq-badge-front">
          <span class="iq-label">IQ</span>
          <span class="iq-score">✕</span>
        </div>
        <div class="iq-badge-back">
          <span class="iq-label">NO</span>
          <span class="iq-score">text</span>
        </div>
      </div>
    `;

    // Attach creation context
    attachCreationContext(badge, 'invalid');

    return badge;
  }

  // Export for use in other modules
  if (typeof window !== 'undefined') {
    window.BadgeCreationTypes = window.BadgeCreationTypes || {};
    window.BadgeCreationTypes.createInvalidBadge = createInvalidBadge;
  }

})();

