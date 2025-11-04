/**
 * Badge Management for Game Manager
 * Handles badge creation, duplicate detection, and cleanup
 */

(function() {
  'use strict';

  // Track badge creation calls per tweet to detect duplicates
  const badgeCreationCount = new Map(); // tweetId -> count

  // Lock mechanism to prevent concurrent badge creation for the same tweet
  const badgeCreationLocks = new Set(); // Set of tweetIds that are currently creating badges

  /**
   * Create a grey guess badge that can be clicked to input a guess
   * @param {HTMLElement} tweetElement - Optional tweet element to track badge creation per tweet
   */
  function createGuessBadge(tweetElement = null) {
    // Track badge creation per tweet to detect duplicates
    let tweetId = null;
    let tweetHandle = null;

    if (tweetElement) {
      tweetId = tweetElement.getAttribute('data-tweet-id');
      tweetHandle = tweetElement.getAttribute('data-handle');

      // If no tweet ID, try to find nested tweet
      if (!tweetId) {
        const nestedTweet = tweetElement.querySelector('article[data-testid="tweet"]') ||
                           tweetElement.querySelector('article[role="article"]');
        if (nestedTweet && nestedTweet !== tweetElement) {
          tweetId = nestedTweet.getAttribute('data-tweet-id');
          tweetHandle = nestedTweet.getAttribute('data-handle');
        }
      }
    }

    // If we have a tweet ID, track creation count
    if (tweetId) {
      const currentCount = badgeCreationCount.get(tweetId) || 0;
      const newCount = currentCount + 1;
      badgeCreationCount.set(tweetId, newCount);
    }

    const badge = document.createElement('span');
    badge.className = 'iq-badge iq-badge-guess';
    badge.setAttribute('data-iq-guess', 'true');

    // Store tweet ID on badge for debugging
    if (tweetId) {
      badge.setAttribute('data-created-for-tweet-id', tweetId);
    }

    // Attach creation context if available
    if (window.BadgeCreation && window.BadgeCreation.attachCreationContext) {
      window.BadgeCreation.attachCreationContext(badge, 'guess');
    }

    // Grey background
    badge.style.setProperty('background-color', '#9e9e9e', 'important');
    badge.style.setProperty('color', '#000000', 'important');
    badge.style.setProperty('cursor', 'pointer', 'important');
    badge.style.setProperty('display', 'inline-flex', 'important');
    badge.style.setProperty('visibility', 'visible', 'important');
    badge.style.setProperty('opacity', '1', 'important');

    badge.innerHTML = `
      <span class="iq-label">IQ</span>
      <span class="iq-score">...</span>
    `;

    // Add click handler to make it editable
    badge.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Get makeBadgeEditable from GameManager
      const gameManager = window.GameManager;
      if (gameManager && gameManager.makeBadgeEditable) {
        gameManager.makeBadgeEditable(badge);
      }
    });

    // Add touchend handler for mobile compatibility
    badge.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Get makeBadgeEditable from GameManager
      const gameManager = window.GameManager;
      if (gameManager && gameManager.makeBadgeEditable) {
        gameManager.makeBadgeEditable(badge);
      }
    }, { passive: false });

    return badge;
  }

  /**
   * Helper function to find existing guess badge in a tweet element
   * Returns the existing badge if found, null otherwise
   */
  function findExistingGuessBadge(tweetElement) {
    if (!tweetElement) {
      return null;
    }

    // Check for nested tweet structure
    const nestedTweet = tweetElement.querySelector('article[data-testid="tweet"]') ||
                       tweetElement.querySelector('article[role="article"]');
    const actualTweetElement = nestedTweet && nestedTweet !== tweetElement ? nestedTweet : tweetElement;

    // Look for existing guess badges in both outer and nested tweet elements
    // Use more specific selector to catch all variations
    let existingGuessBadge = actualTweetElement.querySelector('.iq-badge[data-iq-guess="true"]') ||
                            actualTweetElement.querySelector('.iq-badge-guess') ||
                            actualTweetElement.querySelector('[data-iq-guess="true"]');

    // Also check in outer wrapper if nested
    if (!existingGuessBadge && nestedTweet && nestedTweet !== tweetElement) {
      existingGuessBadge = tweetElement.querySelector('.iq-badge[data-iq-guess="true"]') ||
                          tweetElement.querySelector('.iq-badge-guess') ||
                          tweetElement.querySelector('[data-iq-guess="true"]');
    }

    return existingGuessBadge || null;
  }

  /**
   * Cleanup duplicate guess badges in a tweet, keeping only one
   * Prioritizes badges that have been interacted with (data-iq-guessed)
   */
  function cleanupDuplicateGuessBadges(tweetElement) {
    if (!tweetElement) {
      return;
    }

    // Check for nested tweet structure
    const nestedTweet = tweetElement.querySelector('article[data-testid="tweet"]') ||
                       tweetElement.querySelector('article[role="article"]');
    const actualTweetElement = nestedTweet && nestedTweet !== tweetElement ? nestedTweet : tweetElement;

    // Find all guess badges in both outer and nested tweet elements
    // Also check within engagement bars specifically (where duplicates often appear)
    // Use multiple selectors to catch all variations
    const allGuessBadges = [
      ...actualTweetElement.querySelectorAll('.iq-badge[data-iq-guess="true"]'),
      ...actualTweetElement.querySelectorAll('.iq-badge-guess'),
      ...actualTweetElement.querySelectorAll('[data-iq-guess="true"]'),
      ...(nestedTweet && nestedTweet !== tweetElement ? [
        ...tweetElement.querySelectorAll('.iq-badge[data-iq-guess="true"]'),
        ...tweetElement.querySelectorAll('.iq-badge-guess'),
        ...tweetElement.querySelectorAll('[data-iq-guess="true"]')
      ] : [])
    ].filter((badge, index, self) =>
      // Remove duplicates from the array itself
      index === self.findIndex(b => b === badge)
    );

    // If we have duplicates, keep only one
    if (allGuessBadges.length > 1) {
      // Prioritize badge that has been interacted with (user typed in a guess)
      const interactedBadge = allGuessBadges.find(badge => badge.hasAttribute('data-iq-guessed'));

      // If no interacted badge, prioritize the first one in DOM order
      const badgeToKeep = interactedBadge || allGuessBadges[0];

      // Remove all others
      for (const badge of allGuessBadges) {
        if (badge !== badgeToKeep) {
          // Double-check it's actually a duplicate (same tweet)
          const badgeTweet = badge.closest('article[data-testid="tweet"]') ||
                            badge.closest('article[role="article"]') ||
                            badge.closest('article');
          const badgeTweetId = badgeTweet?.getAttribute('data-tweet-id');
          const actualTweetId = actualTweetElement?.getAttribute('data-tweet-id');

          // Only remove if it's on the same tweet
          if (!badgeTweetId || !actualTweetId || badgeTweetId === actualTweetId) {
            if (badge.parentElement) {
              badge.remove();
            }
          }
        }
      }

      return badgeToKeep;
    }

    return allGuessBadges.length > 0 ? allGuessBadges[0] : null;
  }

  /**
   * Set up MutationObserver to detect and remove duplicate guess badges
   * This catches duplicates that slip through the normal checks
   */
  function setupDuplicateBadgeObserver() {
    // Use a map to track last cleanup time per tweet to debounce
    const lastCleanupTime = new Map();
    let cleanupTimeout = null;

    const performCleanup = () => {
      // Find all tweets with guess badges
      const allTweets = document.querySelectorAll('article[data-testid="tweet"], article[role="article"]');
      const tweetsWithGuessBadges = new Set();

      allTweets.forEach(tweet => {
        const guessBadges = [
          ...tweet.querySelectorAll('.iq-badge[data-iq-guess="true"]'),
          ...tweet.querySelectorAll('.iq-badge-guess'),
          ...tweet.querySelectorAll('[data-iq-guess="true"]')
        ];

        if (guessBadges.length > 1) {
          tweetsWithGuessBadges.add(tweet);
        }
      });

      // Cleanup duplicates
      tweetsWithGuessBadges.forEach(tweet => {
        const tweetId = tweet.getAttribute('data-tweet-id');
        const now = Date.now();
        const lastCleanup = lastCleanupTime.get(tweetId) || 0;

        // Debounce: only cleanup once per tweet per 200ms
        if (now - lastCleanup > 200) {
          lastCleanupTime.set(tweetId, now);
          cleanupDuplicateGuessBadges(tweet);
        }
      });
    };

    const observer = new MutationObserver((mutations) => {
      let hasGuessBadgeChanges = false;

      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          // Check if the added node is a guess badge or contains guess badges
          if (node.nodeType === Node.ELEMENT_NODE) {
            const isGuessBadge = (node.classList && node.classList.contains('iq-badge-guess')) ||
                                 (node.hasAttribute && node.hasAttribute('data-iq-guess'));

            if (isGuessBadge || (node.querySelector && node.querySelector('.iq-badge-guess, [data-iq-guess="true"]'))) {
              hasGuessBadgeChanges = true;
            }
          }
        });
      });

      if (hasGuessBadgeChanges) {
        // Debounce cleanup to batch multiple mutations
        if (cleanupTimeout) {
          clearTimeout(cleanupTimeout);
        }
        cleanupTimeout = setTimeout(() => {
          performCleanup();
        }, 100);
      }
    });

    // Start observing the document for added nodes
    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }

    // Also run periodic cleanup every 2 seconds as a safety net
    setInterval(() => {
      performCleanup();
    }, 2000);

    return observer;
  }

  /**
   * Acquire lock for badge creation for a tweet
   */
  function acquireBadgeCreationLock(tweetId) {
    if (badgeCreationLocks.has(tweetId)) {
      return false;
    }
    badgeCreationLocks.add(tweetId);
    return true;
  }

  /**
   * Release lock for badge creation for a tweet
   */
  function releaseBadgeCreationLock(tweetId) {
    badgeCreationLocks.delete(tweetId);
  }

  /**
   * Check if lock is held for a tweet
   */
  function hasBadgeCreationLock(tweetId) {
    return badgeCreationLocks.has(tweetId);
  }

  // Set up the observer when the module loads
  if (typeof document !== 'undefined' && document.body) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setupDuplicateBadgeObserver();
      });
    } else {
      setupDuplicateBadgeObserver();
    }
  }

  // Export
  if (typeof window !== 'undefined') {
    window.GameManagerBadges = {
      createGuessBadge,
      findExistingGuessBadge,
      cleanupDuplicateGuessBadges,
      setupDuplicateBadgeObserver,
      acquireBadgeCreationLock,
      releaseBadgeCreationLock,
      hasBadgeCreationLock
    };
  }
})();
