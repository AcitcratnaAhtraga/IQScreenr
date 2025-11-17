/**
 * Badge Icon Helper
 * Provides SVG icons for badges (since Font Awesome is blocked by CSP)
 */

(function() {
  'use strict';

  /**
   * Get SVG icon based on icon name
   * Returns inline SVG string matching Twitter engagement icon style
   */
  function getBadgeIconSVG(iconName) {
    const icons = {
      'fa-brain': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44L4.5 17.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44L19.5 17.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        <path d="M12 4.5v15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M7 7h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M7 12h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M7 17h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>`,
      'fa-lightbulb': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: inherit;">
        <path d="M9 21h6"/>
        <path d="M12 3a6 6 0 0 0-6 6c0 2.5-1.5 4-1.5 4h15s-1.5-1.5-1.5-4a6 6 0 0 0-6-6z"/>
        <path d="M12 13v4"/>
        <path d="M9 17h6"/>
      </svg>`,
      'fa-graduation-cap': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: inherit;">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
        <path d="M6 12v5c3 3 9 3 12 0v-5"/>
      </svg>`,
      'fa-book-open': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: inherit;">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
      </svg>`,
      'fa-q': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: inherit;">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 16v-4"/>
        <path d="M12 8h.01"/>
      </svg>`,
      'fa-info': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: inherit;">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 16v-4"/>
        <path d="M12 8h.01"/>
      </svg>`,
      'fa-calculator': `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: inherit;">
        <rect x="4" y="2" width="16" height="20" rx="2"/>
        <path d="M8 6h8"/>
        <path d="M8 10h8"/>
        <path d="M8 14h4"/>
        <path d="M8 18h4"/>
        <path d="M14 14h2"/>
        <path d="M14 18h2"/>
      </svg>`
    };

    return icons[iconName] || icons['fa-info'];
  }

  // Export for use in other modules
  if (typeof window !== 'undefined') {
    window.BadgeIconHelper = {
      getBadgeIconSVG
    };
  }

})();

