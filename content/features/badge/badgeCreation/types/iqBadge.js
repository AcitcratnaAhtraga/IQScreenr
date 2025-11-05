/**
 * IQ Badge Creation
 * Creates IQ badge element with debug data attached
 */

(function() {
  'use strict';

  // Get dependencies
  const getColorUtils = () => window.BadgeColorUtils || {};
  const getContext = () => window.BadgeCreationContext || {};
  const getHandlers = () => window.BadgeCreationHandlers || {};

  /**
   * Create IQ badge element with debug data attached
   */
  function createIQBadge(iq, estimationResult, tweetText) {
    const { getIQColor, getConfidenceColor } = getColorUtils();
    const { attachCreationContext } = getContext();
    const { addFlipBadgeHoverHandlers, addMobileBadgeHandlers } = getHandlers();
    const getSettings = () => window.Settings || {};
    const settings = getSettings();

    const badge = document.createElement('span');
    badge.className = 'iq-badge';
    badge.setAttribute('data-iq-score', iq);

    const confidence = estimationResult.confidence ? Math.round(estimationResult.confidence) : null;
    if (confidence !== null) {
      badge.setAttribute('data-confidence', confidence);
    }

    badge._debugData = {
      iq: iq,
      result: estimationResult,
      text: tweetText,
      timestamp: new Date().toISOString()
    };

    // Attach creation context
    attachCreationContext(badge, 'iq');

    // Use confidence color if setting is enabled, otherwise use IQ color
    const iqColor = (settings.useConfidenceForColor && confidence !== null)
      ? getConfidenceColor(confidence)
      : getIQColor(iq);

    // Set CSS variables instead of inline styles - CSS handles all styling
    badge.style.setProperty('--iq-badge-bg-color', iqColor);
    badge.style.setProperty('cursor', 'help', 'important');

    if (confidence !== null) {
      badge.innerHTML = `
        <div class="iq-badge-inner">
          <div class="iq-badge-front">
            <span class="iq-label">IQ</span>
            <span class="iq-score">${iq}</span>
          </div>
          <div class="iq-badge-back">
            <span class="iq-label">%</span>
            <span class="iq-score">${confidence}</span>
          </div>
        </div>
      `;
      badge.classList.add('iq-badge-flip');
      // Store original background color in CSS variable for hover inversion
      badge.style.setProperty('--iq-badge-original-bg', iqColor, 'important');
    } else {
      badge.innerHTML = `
        <span class="iq-label">IQ</span>
        <span class="iq-score">${iq}</span>
      `;
    }

    // Add hover handlers for color inversion on flip badges
    addFlipBadgeHoverHandlers(badge);

    // Add mobile handlers for click/touch
    addMobileBadgeHandlers(badge);

    return badge;
  }

  // Export for use in other modules
  if (typeof window !== 'undefined') {
    window.BadgeCreationTypes = window.BadgeCreationTypes || {};
    window.BadgeCreationTypes.createIQBadge = createIQBadge;
  }

})();

