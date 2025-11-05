/**
 * Loading Badge Manager
 * Handles adding loading badges to tweets
 */

(function() {
  'use strict';

  const getSettings = () => window.Settings || {};
  const getBadgeManager = () => window.BadgeManager || {};
  const getNotificationPlacement = () => window.NotificationBadgePlacement || {};
  const getFollowNotificationFilter = () => window.FollowNotificationFilter || {};

  /**
   * Check if a tweet element is a Community Note notification
   * Community Notes notifications contain text like "Community Note" or "Readers added a Community Note"
   */
  function isCommunityNoteNotification(tweetElement) {
    if (!tweetElement) return false;

    // Get all text elements in the notification
    const allSpans = Array.from(tweetElement.querySelectorAll('span'));
    const allDivs = Array.from(tweetElement.querySelectorAll('div'));

    // Check for Community Note notification text
    const communityNoteText = [...allSpans, ...allDivs].find(element => {
      const text = (element.textContent || '').toLowerCase();
      return text.includes('community note') ||
             text.includes('readers added a community note') ||
             (text.includes('community') && text.includes('note'));
    });

    return !!communityNoteText;
  }

  /**
   * Lightweight function to add a loading badge to a single tweet
   *
   * @param {HTMLElement} tweet - The tweet element to add badge to
   */
  function addLoadingBadgeToTweet(tweet) {
    const settings = getSettings();
    const badgeManager = getBadgeManager();

    if (!badgeManager || !badgeManager.createLoadingBadge) {
      return; // BadgeManager not loaded yet
    }

    const { createLoadingBadge } = badgeManager;
    const { findNotificationBadgePlacement } = getNotificationPlacement();
    const { isFollowNotification } = getFollowNotificationFilter();

    let actualTweet = tweet;
    const nestedTweet = tweet.querySelector('article[data-testid="tweet"]') ||
                        tweet.querySelector('article[role="article"]');
    if (nestedTweet && nestedTweet !== tweet) {
      actualTweet = nestedTweet;
    }

    // Don't add badge if tweet is already analyzed or already has a badge
    if (!settings.showIQBadge ||
        actualTweet.hasAttribute('data-iq-analyzed') ||
        actualTweet.querySelector('.iq-badge')) {
      return;
    }

    const isNotificationsPage = window.location.href.includes('/notifications');

    // Skip follow notifications
    if (isNotificationsPage && isFollowNotification && isFollowNotification(actualTweet)) {
      // Mark as analyzed to prevent further processing
      actualTweet.setAttribute('data-iq-analyzed', 'true');
      return; // Skip follow notifications
    }

    // Skip Community Notes notifications
    if (isNotificationsPage && isCommunityNoteNotification(actualTweet)) {
      // Mark as analyzed to prevent further processing
      actualTweet.setAttribute('data-iq-analyzed', 'true');
      return; // Skip Community Notes notifications
    }

    const loadingBadge = createLoadingBadge();

    // Special handling for notification page tweets
    if (isNotificationsPage && findNotificationBadgePlacement) {
      const placement = findNotificationBadgePlacement(actualTweet);
      if (placement) {
        const { targetElement, parentElement } = placement;
        try {
          if (placement.placement === 'before-tweet-content') {
            parentElement.insertBefore(loadingBadge, targetElement);
          } else {
            // After notification text/div
            if (targetElement.nextSibling) {
              parentElement.insertBefore(loadingBadge, targetElement.nextSibling);
            } else {
              parentElement.appendChild(loadingBadge);
            }
          }
        } catch (e) {
          // Silent fail
        }
      } else {
        // Fallback: place at start of tweet element
        try {
          actualTweet.insertBefore(loadingBadge, actualTweet.firstChild);
        } catch (e) {
          // Silent fail
        }
      }
    } else {
      // Normal tweet pages: use engagement bar if available
      const engagementBar = actualTweet.querySelector('[role="group"]');
      if (engagementBar) {
        try {
          const firstChild = engagementBar.firstElementChild;
          if (firstChild) {
            engagementBar.insertBefore(loadingBadge, firstChild);
          } else {
            engagementBar.appendChild(loadingBadge);
          }
        } catch (e) {
          // Silent fail
        }
      } else {
        try {
          actualTweet.insertBefore(loadingBadge, actualTweet.firstChild);
        } catch (e) {
          // Silent fail
        }
      }
    }
  }

  // Export
  if (typeof window !== 'undefined') {
    window.LoadingBadgeManager = {
      addLoadingBadgeToTweet
    };
  }
})();

