/**
 * Badge Wrapper Utility
 * Wraps existing badges in containers to ensure equal spacing in engagement bars
 */

(function() {
  'use strict';

  /**
   * Wrap a badge in a container div matching engagement bar item structure
   * @param {HTMLElement} badge - The badge element to wrap
   * @returns {HTMLElement} The container div with badge inside
   */
  function wrapBadgeInContainer(badge) {
    // Check if badge is already wrapped in a proper container
    if (badge.parentElement && 
        badge.parentElement.getAttribute('data-iq-badge-container') === 'true') {
      return badge.parentElement;
    }

    // Create container matching engagement bar item structure
    const badgeContainer = document.createElement('div');
    badgeContainer.className = 'css-175oi2r r-18u37iz r-1h0z5md r-13awgt0';
    badgeContainer.setAttribute('data-iq-badge-container', 'true');
    badgeContainer.style.cssText = 'display: flex; align-items: center; justify-content: center; flex: 1 1 0%; min-width: 0;';
    
    // If badge is already in DOM, move it to container
    if (badge.parentElement) {
      badge.parentElement.insertBefore(badgeContainer, badge);
      badgeContainer.appendChild(badge);
    } else {
      badgeContainer.appendChild(badge);
    }
    
    return badgeContainer;
  }

  /**
   * Wrap all badges in engagement bars that aren't already wrapped
   * @param {HTMLElement} [rootElement=document] - Root element to search from
   */
  function wrapExistingBadges(rootElement = document) {
    const engagementBars = rootElement.querySelectorAll('[role="group"]');
    
    engagementBars.forEach(engagementBar => {
      const badges = engagementBar.querySelectorAll('.iq-badge:not(.iq-badge-realtime)');
      
      badges.forEach(badge => {
        // Check if badge is directly in engagement bar (not wrapped)
        if (badge.parentElement === engagementBar) {
          wrapBadgeInContainer(badge);
        }
        // Check if badge is in a container but container doesn't have flex properties
        else if (badge.parentElement && badge.parentElement !== engagementBar) {
          const container = badge.parentElement;
          const computedStyle = window.getComputedStyle(container);
          const flex = computedStyle.flex;
          
          // If container doesn't have flex: 1 1 0%, wrap it properly
          if (!flex || !flex.includes('1 1 0%')) {
            // Remove badge from current container
            const badgeClone = badge.cloneNode(true);
            badge.remove();
            
            // Wrap in proper container
            const newContainer = wrapBadgeInContainer(badgeClone);
            
            // Insert at same position
            if (container.nextSibling) {
              engagementBar.insertBefore(newContainer, container.nextSibling);
            } else {
              engagementBar.appendChild(newContainer);
            }
            
            // Remove old container if empty
            if (container.children.length === 0) {
              container.remove();
            }
          }
        }
      });
    });
  }

  // Export for use in other modules
  if (typeof window !== 'undefined') {
    window.BadgeWrapper = {
      wrapBadgeInContainer,
      wrapExistingBadges
    };
  }
})();

