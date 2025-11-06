/**
 * IqFiltr Module
 * Removes tweets/replies/quoted posts based on IQ score thresholds
 * Elements are removed immediately after IQ calculation, before any animations
 */

(function() {
  'use strict';

  /**
   * Get settings helper
   */
  function getSettings() {
    return window.Settings || {};
  }

  /**
   * Get current user's handle
   * @returns {Promise<string|null>} Current user's handle or null
   */
  async function getCurrentUserHandle() {
    const getUserAverageIQ = () => window.UserAverageIQ || {};
    const { getUserHandle } = getUserAverageIQ();
    if (getUserHandle) {
      return await getUserHandle();
    }
    return null;
  }

  /**
   * Get tweet handle from element
   * @param {HTMLElement} tweetElement - The tweet element
   * @returns {string|null} The tweet handle or null
   */
  function getTweetHandle(tweetElement) {
    if (!tweetElement) return null;

    // First try to get from data attribute (set during processing)
    const handle = tweetElement.getAttribute('data-handle');
    if (handle) {
      return handle.toLowerCase().trim().replace(/^@/, '');
    }

    // Fallback: try to extract from element
    const getTextExtraction = () => window.TextExtraction || {};
    const { extractTweetHandle } = getTextExtraction();
    if (extractTweetHandle) {
      const extractedHandle = extractTweetHandle(tweetElement);
      if (extractedHandle) {
        return extractedHandle.toLowerCase().trim().replace(/^@/, '');
      }
    }

    return null;
  }

  /**
   * Check if an element is a reply
   * @param {HTMLElement} tweetElement - The tweet element to check
   * @returns {boolean} True if the element is a reply
   */
  function isReply(tweetElement) {
    if (!tweetElement) return false;

    // Check for reply indicators
    const hasReplyIndicator = tweetElement.querySelector('[aria-label*="Replying to"]') ||
                              tweetElement.querySelector('[data-testid*="reply"]') ||
                              tweetElement.closest('[data-testid="tweet"]')?.previousElementSibling;

    // Check if it's in a thread (has previous sibling tweet)
    const isInThread = tweetElement.previousElementSibling &&
                      (tweetElement.previousElementSibling.querySelector('[data-testid="tweet"]') ||
                       tweetElement.previousElementSibling.querySelector('article[role="article"]'));

    return !!(hasReplyIndicator || isInThread);
  }

  /**
   * Check if an element is a quoted tweet/post (a tweet that quotes another tweet)
   * @param {HTMLElement} tweetElement - The tweet element to check
   * @returns {boolean} True if the element is a quoted post
   */
  function isQuotedPost(tweetElement) {
    if (!tweetElement) return false;

    // A quote tweet is a tweet that contains a quoted tweet container
    // Check for quoted tweet containers within this tweet
    const quotedSelectors = [
      '[data-testid="quotedTweet"]',
      '[data-testid="quoteTweet"]'
    ];

    for (const selector of quotedSelectors) {
      try {
        const quotedContainer = tweetElement.querySelector(selector);
        if (quotedContainer) {
          // This tweet contains a quoted tweet, so it's a quote tweet
          return true;
        }
      } catch (e) {
        // Ignore selector errors
      }
    }

    // Also check if this element itself is marked as a quote tweet
    // (sometimes the main tweet element has this attribute)
    if (tweetElement.getAttribute('data-testid') === 'quotedTweet' ||
        tweetElement.getAttribute('data-testid') === 'quoteTweet') {
      return true;
    }

    return false;
  }

  /**
   * Check if an element is a regular tweet (not a reply or quoted post)
   * @param {HTMLElement} tweetElement - The tweet element to check
   * @returns {boolean} True if the element is a regular tweet
   */
  function isRegularTweet(tweetElement) {
    if (!tweetElement) return false;
    return !isReply(tweetElement) && !isQuotedPost(tweetElement);
  }

  /**
   * Check if a tweet should be filtered based on settings
   * @param {HTMLElement} tweetElement - The tweet element
   * @param {number} iq - The IQ score
   * @param {number|null} confidence - The confidence percentage (0-100)
   * @returns {Promise<boolean>} True if the tweet should be removed
   */
  async function shouldFilterTweet(tweetElement, iq, confidence) {
    const settings = getSettings();

    // Check if filtering is enabled
    if (!settings.enableIqFiltr) {
      return false;
    }

    // NEVER filter the current user's own tweets/replies/quoted posts
    const tweetHandle = getTweetHandle(tweetElement);
    if (tweetHandle) {
      const currentUserHandle = await getCurrentUserHandle();
      if (currentUserHandle && tweetHandle === currentUserHandle.toLowerCase().trim().replace(/^@/, '')) {
        return false; // Don't filter current user's content
      }
    }

    // Check IQ threshold
    const threshold = settings.filterIQThreshold || 100;
    const direction = settings.filterDirection || 'below';

    let matchesIQThreshold = false;
    if (direction === 'below') {
      matchesIQThreshold = iq < threshold;
    } else {
      matchesIQThreshold = iq > threshold;
    }

    if (!matchesIQThreshold) {
      return false;
    }

    // Check confidence threshold if enabled
    if (settings.useConfidenceInFilter && confidence !== null && confidence !== undefined) {
      const confidenceThreshold = Number(settings.filterConfidenceThreshold) || 0;
      const confidenceDirection = settings.filterConfidenceDirection || 'below';
      const confidenceValue = Number(confidence);

      // Ensure confidence is a valid number
      if (isNaN(confidenceValue)) {
        // If confidence is invalid, don't filter based on confidence
        return false;
      }

      let matchesConfidenceThreshold = false;
      if (confidenceDirection === 'below') {
        matchesConfidenceThreshold = confidenceValue < confidenceThreshold;
      } else {
        // 'above' direction: filter if confidence is greater than threshold
        matchesConfidenceThreshold = confidenceValue > confidenceThreshold;
      }

      if (!matchesConfidenceThreshold) {
        return false; // Don't filter if confidence doesn't match threshold
      }
    }

    // Check which types to filter
    const filterTweets = settings.filterTweets !== false;
    const filterReplies = settings.filterReplies !== false;
    const filterQuotedPosts = settings.filterQuotedPosts !== false;

    // Determine tweet type and check if it should be filtered
    if (isQuotedPost(tweetElement) && filterQuotedPosts) {
      return true;
    }

    if (isReply(tweetElement) && filterReplies) {
      return true;
    }

    if (isRegularTweet(tweetElement) && filterTweets) {
      return true;
    }

    return false;
  }

  // Batch removal queue to prevent scroll jumping
  let removalQueue = [];
  let removalScheduled = false;
  let lastRemovalTime = 0;
  const REMOVAL_BATCH_DELAY = 50; // Small delay between batches to prevent infinite scroll loops

  /**
   * Remove a tweet element completely from the DOM
   * This removes ALL elements (the entire tweet container)
   * Uses batching to preserve scroll position and prevent infinite scroll loops
   * @param {HTMLElement} tweetElement - The tweet element to remove
   */
  function removeTweetElement(tweetElement) {
    if (!tweetElement || !tweetElement.parentElement) {
      return;
    }

    // Find the outermost container - usually an article or div with role="article"
    // We want to remove the entire tweet, not just parts of it
    let containerToRemove = tweetElement;

    // Try to find the outermost article or tweet container
    let current = tweetElement;
    while (current && current !== document.body) {
      const tagName = current.tagName;
      const role = current.getAttribute('role');
      const testId = current.getAttribute('data-testid');

      // Check if this is a tweet container
      if (tagName === 'ARTICLE' || role === 'article' || testId === 'tweet') {
        containerToRemove = current;
        // Continue up to find the outermost container
        const parent = current.parentElement;
        if (parent && (parent.tagName === 'ARTICLE' || parent.getAttribute('role') === 'article')) {
          current = parent;
          continue;
        }
        break;
      }

      // Also check for common Twitter/X wrapper divs
      if (tagName === 'DIV' && current.classList.contains('css-')) {
        // Check if parent is also a div (likely a wrapper)
        const parent = current.parentElement;
        if (parent && parent.tagName === 'DIV') {
          current = parent;
          continue;
        }
      }

      current = current.parentElement;
    }

    // Add to removal queue instead of removing immediately
    if (containerToRemove && containerToRemove.parentElement) {
      removalQueue.push(containerToRemove);
      scheduleBatchRemoval();
    }
  }

  /**
   * Schedule batch removal of queued elements
   * This preserves scroll position and prevents infinite scroll loops
   */
  function scheduleBatchRemoval() {
    if (removalScheduled || removalQueue.length === 0) {
      return;
    }

    removalScheduled = true;

    // Add a small delay to batch multiple removals together and prevent rapid scroll changes
    const now = Date.now();
    const timeSinceLastRemoval = now - lastRemovalTime;
    const delay = timeSinceLastRemoval < REMOVAL_BATCH_DELAY ? REMOVAL_BATCH_DELAY - timeSinceLastRemoval : 0;

    setTimeout(() => {
      // Use requestAnimationFrame to batch removals and preserve scroll position
      requestAnimationFrame(() => {
      if (removalQueue.length === 0) {
        removalScheduled = false;
        return;
      }

      // Save current scroll position and find a scroll anchor
      const scrollTop = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight;
      const viewportHeight = window.innerHeight;

      // Find a visible tweet element that won't be removed to use as scroll anchor
      // This helps maintain scroll position when removing filtered tweets
      let scrollAnchor = null;
      let anchorOffset = 0;

      // Look for a visible tweet that's not in the removal queue
      const allTweets = document.querySelectorAll('article[data-testid="tweet"], article[role="article"]');
      const removalSet = new Set(removalQueue);

      for (let i = 0; i < allTweets.length; i++) {
        const tweet = allTweets[i];
        if (!removalSet.has(tweet) && tweet.parentElement) {
          const rect = tweet.getBoundingClientRect();
          const elementTop = scrollTop + rect.top;
          const elementBottom = elementTop + rect.height;

          // Check if element is visible in viewport
          if (elementTop < scrollTop + viewportHeight && elementBottom > scrollTop) {
            scrollAnchor = tweet;
            anchorOffset = rect.top;
            break;
          }
        }
      }

      // If no anchor found, use the first non-removed tweet
      if (!scrollAnchor && allTweets.length > 0) {
        for (let i = 0; i < allTweets.length; i++) {
          const tweet = allTweets[i];
          if (!removalSet.has(tweet) && tweet.parentElement) {
            scrollAnchor = tweet;
            const rect = tweet.getBoundingClientRect();
            anchorOffset = rect.top;
            break;
          }
        }
      }

      // Remove all queued elements
      const elementsToRemove = [...removalQueue];
      removalQueue = [];

      elementsToRemove.forEach(element => {
        if (element && element.parentElement) {
          element.remove();
        }
      });

      // Restore scroll position after removals
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        const newScrollHeight = document.documentElement.scrollHeight;
        const heightDiff = scrollHeight - newScrollHeight;

        // Calculate new scroll position
        let newScrollTop = scrollTop;

        // If we have a scroll anchor, use it to maintain position
        if (scrollAnchor && scrollAnchor.parentElement) {
          const newRect = scrollAnchor.getBoundingClientRect();
          const newAnchorTop = window.scrollY + newRect.top;
          // Calculate how much the anchor moved
          const anchorMovement = newRect.top - anchorOffset;
          // Adjust scroll to compensate
          newScrollTop = scrollTop - anchorMovement;
        } else {
          // Fallback: if we removed content, try to maintain relative position
          if (heightDiff > 0 && scrollTop > 0) {
            // Don't adjust too aggressively - only if significant content was removed
            // This prevents triggering infinite scroll
            if (heightDiff > viewportHeight * 0.5) {
              newScrollTop = Math.max(0, scrollTop - Math.min(heightDiff * 0.3, scrollTop * 0.2));
            }
          }
        }

        // Ensure scroll position is valid
        newScrollTop = Math.max(0, Math.min(newScrollTop, newScrollHeight - viewportHeight));

        // Restore scroll position
        window.scrollTo({
          top: newScrollTop,
          behavior: 'instant'
        });

        removalScheduled = false;
        lastRemovalTime = Date.now();

        // If there are more items queued, schedule another batch
        if (removalQueue.length > 0) {
          scheduleBatchRemoval();
        }
      });
      });
    }, delay);
  }

  /**
   * Mute a tweet element - hide content and show placeholder matching X's muted post style
   * @param {HTMLElement} tweetElement - The tweet element to mute
   */
  function muteTweetElement(tweetElement) {
    if (!tweetElement || !tweetElement.parentElement) {
      return;
    }

    // Check if already muted or manually revealed
    if (tweetElement.hasAttribute('data-iq-muted') || tweetElement.hasAttribute('data-iq-manually-revealed')) {
      return;
    }

    // Mark as muted
    tweetElement.setAttribute('data-iq-muted', 'true');

    // Find the main tweet content area
    const tweetContentArea = tweetElement.querySelector('[data-testid="tweet"]') || tweetElement;

    // Find and hide the avatar container
    const avatarContainer = tweetContentArea.querySelector('[data-testid="Tweet-User-Avatar"]');
    let avatarParent = null;
    if (avatarContainer) {
      // Find the parent container that holds the avatar
      // Look for the div with classes like r-18kxxzh that contains the avatar
      avatarParent = avatarContainer.closest('div.r-18kxxzh') ||
                     avatarContainer.closest('div[class*="r-18kxxzh"]') ||
                     avatarContainer.parentElement;

      if (avatarParent) {
        avatarParent.style.setProperty('display', 'none', 'important');
        avatarParent.setAttribute('data-iq-hidden-avatar', 'true');
      }
    }

    // Find the container that holds user info, tweet text, and engagement buttons
    // This is the div that comes after the avatar container
    // Look for the div with class r-1iusvr4 that contains the content (not the placeholder)
    let contentContainer = null;

    // Look for the div that contains User-Name, tweetText, and engagement bar
    const userInfo = tweetContentArea.querySelector('[data-testid="User-Name"]');
    const tweetText = tweetContentArea.querySelector('[data-testid="tweetText"]');
    const engagementBar = tweetContentArea.querySelector('[role="group"]');

    // Strategy: Find the div.r-1iusvr4 that contains the content elements
    // This is the content wrapper that comes after the avatar
    const contentWrappers = tweetContentArea.querySelectorAll('div.r-1iusvr4');
    for (const wrapper of contentWrappers) {
      // Skip if this is our placeholder
      if (wrapper.hasAttribute('data-iq-placeholder')) {
        continue;
      }

      // Check if this wrapper contains the actual content
      const hasUserInfo = userInfo && wrapper.contains(userInfo);
      const hasTweetText = tweetText && wrapper.contains(tweetText);
      const hasEngagement = engagementBar && wrapper.contains(engagementBar);

      // If it has at least user info or tweet text, and it's not the entire tweet
      if ((hasUserInfo || hasTweetText) &&
          wrapper !== tweetContentArea &&
          wrapper !== tweetElement &&
          wrapper.tagName !== 'ARTICLE' &&
          wrapper.getAttribute('data-testid') !== 'tweet') {
        // Prefer wrappers that have all three elements
        if (hasUserInfo && hasTweetText && hasEngagement) {
          contentContainer = wrapper;
          break;
        } else if (!contentContainer) {
          // Use this as fallback if we haven't found a better match
          contentContainer = wrapper;
        }
      }
    }

    // If we still don't have a container, try finding the parent of User-Name
    // but be very careful not to select too high
    if (!contentContainer && userInfo) {
      let current = userInfo.parentElement;
      let depth = 0;
      const maxDepth = 5; // Limit how far up we go

      while (current && current !== tweetContentArea && depth < maxDepth) {
        // Never select article or tweet containers
        if (current.tagName === 'ARTICLE' ||
            current.getAttribute('data-testid') === 'tweet' ||
            current === tweetElement) {
          break;
        }

        // Check if this container has the content elements
        const hasUserInfo = current.contains(userInfo);
        const hasTweetText = !tweetText || current.contains(tweetText);
        const hasEngagement = !engagementBar || current.contains(engagementBar);

        // If it has all elements and is a reasonable size, use it
        if (hasUserInfo && hasTweetText && hasEngagement) {
          // Make sure it's not too large (not the entire tweet structure)
          const children = current.children;
          if (children.length <= 10) { // Reasonable number of direct children
            contentContainer = current;
            break;
          }
        }

        current = current.parentElement;
        depth++;
      }
    }

    // Final safety check: make sure we're not hiding the entire tweet
    if (contentContainer) {
      // If the content container is the tweetContentArea or tweetElement itself, don't use it
      if (contentContainer === tweetContentArea ||
          contentContainer === tweetElement ||
          contentContainer.tagName === 'ARTICLE' ||
          contentContainer.getAttribute('data-testid') === 'tweet') {
        contentContainer = null;
      }
    }

    // Also find and hide tweet text, views/timestamp, and engagement bar separately if they're not in the content container
    const tweetTextContainer = tweetText ? tweetText.closest('div.r-1s2bzr4') || tweetText.parentElement : null;
    const engagementBarContainer = engagementBar ? engagementBar.parentElement : null;

    // Find the views/timestamp container (div.r-12kyg2d that contains timestamp and views)
    const viewsContainer = tweetContentArea.querySelector('div.r-12kyg2d');

    // Store all hidden elements for restoration
    const hiddenElements = [];

    // If we found a content container, hide it and add placeholder
    if (contentContainer && contentContainer.parentElement) {
      // Hide the content container
      contentContainer.style.setProperty('display', 'none', 'important');
      contentContainer.setAttribute('data-iq-hidden-content', 'true');
      hiddenElements.push(contentContainer);
    }

    // Also hide tweet text container if it's not already hidden
    if (tweetTextContainer &&
        !tweetTextContainer.hasAttribute('data-iq-hidden-content') &&
        tweetTextContainer !== contentContainer &&
        tweetTextContainer.parentElement) {
      tweetTextContainer.style.setProperty('display', 'none', 'important');
      tweetTextContainer.setAttribute('data-iq-hidden-content', 'true');
      hiddenElements.push(tweetTextContainer);
    }

    // Also hide engagement bar container if it's not already hidden
    if (engagementBarContainer &&
        !engagementBarContainer.hasAttribute('data-iq-hidden-content') &&
        engagementBarContainer !== contentContainer &&
        engagementBarContainer !== tweetTextContainer &&
        engagementBarContainer.parentElement) {
      engagementBarContainer.style.setProperty('display', 'none', 'important');
      engagementBarContainer.setAttribute('data-iq-hidden-content', 'true');
      hiddenElements.push(engagementBarContainer);
    }

    // Also hide views/timestamp container if it's not already hidden
    if (viewsContainer &&
        !viewsContainer.hasAttribute('data-iq-hidden-content') &&
        viewsContainer !== contentContainer &&
        viewsContainer !== tweetTextContainer &&
        viewsContainer !== engagementBarContainer &&
        viewsContainer.parentElement) {
      viewsContainer.style.setProperty('display', 'none', 'important');
      viewsContainer.setAttribute('data-iq-hidden-content', 'true');
      hiddenElements.push(viewsContainer);
    }

    // Only proceed if we have at least one element to hide
    if (hiddenElements.length === 0) {
      return;
    }

    // Create placeholder matching X's exact styling
    const placeholder = document.createElement('div');
    placeholder.className = 'css-175oi2r r-1iusvr4 r-16y2uox r-1777fci';
    placeholder.setAttribute('data-iq-placeholder', 'true');

    placeholder.innerHTML = `
        <div class="css-175oi2r r-1awozwy r-g2wdr4 r-16cnnyw r-1867qdf r-1phboty r-rs99b7 r-18u37iz r-1wtj0ep r-1mmae3n r-n7gxbd">
          <div class="css-175oi2r r-1adg3ll r-1wbh5a2 r-jusfrs">
            <div dir="auto" class="css-146c3p1 r-bcqeeo r-1ttztb7 r-qvutc0 r-37j5jr r-a023e6 r-rjixqe r-16dba41" style="color: rgb(113, 118, 123);">
              <span dir="ltr" class="css-1jxf684 r-bcqeeo r-1ttztb7 r-qvutc0 r-poiln3 r-1udh08x">
                <span class="css-1jxf684 r-bcqeeo r-1ttztb7 r-qvutc0 r-poiln3">This post has been filtered.</span>
              </span>
            </div>
          </div>
          <div class="css-175oi2r r-1kqz2tg">
            <button role="button" class="css-175oi2r r-sdzlij r-1phboty r-rs99b7 r-lrvibr r-faml9v r-2dysd3 r-15ysp7h r-4wgw6l r-3pj75a r-1loqt21 r-o7ynqc r-6416eg r-1ny4l3l iq-filtr-view-button" type="button" style="background-color: rgba(0, 0, 0, 0); border-color: rgba(0, 0, 0, 0);">
              <div dir="ltr" class="css-146c3p1 r-bcqeeo r-qvutc0 r-37j5jr r-q4m81j r-a023e6 r-rjixqe r-b88u0q r-1awozwy r-6koalj r-18u37iz r-16y2uox r-1777fci" style="color: rgb(239, 243, 244);">
                <span class="css-1jxf684 r-dnmrzs r-1udh08x r-1udbk01 r-3s2u2q r-bcqeeo r-1ttztb7 r-qvutc0 r-poiln3 r-1b43r93 r-1cwl3u0">
                  <span class="css-1jxf684 r-bcqeeo r-1ttztb7 r-qvutc0 r-poiln3">View</span>
                </span>
              </div>
            </button>
          </div>
        </div>
      `;

    // Store references to hidden content for restoration
    placeholder._hiddenContent = contentContainer;
    placeholder._hiddenElements = hiddenElements; // Store all hidden elements
    placeholder._hiddenAvatar = avatarParent;

    // Add click handler to reveal
      const viewButton = placeholder.querySelector('.iq-filtr-view-button');
    if (viewButton) {
      // Add hover effects
      viewButton.addEventListener('mouseenter', () => {
        viewButton.style.backgroundColor = 'rgba(239, 243, 244, 0.1)';
      });
      viewButton.addEventListener('mouseleave', () => {
        viewButton.style.backgroundColor = 'rgba(0, 0, 0, 0)';
      });

      viewButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (!tweetElement.hasAttribute('data-iq-manually-revealed')) {
          revealMutedTweet(tweetElement);
        }
      }, true);
    }

    // Also allow clicking the placeholder itself
    placeholder.addEventListener('click', (e) => {
        if (!e.target.closest('.iq-filtr-view-button') && !tweetElement.hasAttribute('data-iq-manually-revealed')) {
        e.preventDefault();
        e.stopPropagation();
        revealMutedTweet(tweetElement);
      }
    }, true);

    // Insert placeholder - find a good insertion point
    let insertionPoint = null;
    if (contentContainer && contentContainer.parentElement) {
      insertionPoint = contentContainer.parentElement;
      insertionPoint.insertBefore(placeholder, contentContainer.nextSibling);
    } else if (tweetTextContainer && tweetTextContainer.parentElement) {
      insertionPoint = tweetTextContainer.parentElement;
      insertionPoint.insertBefore(placeholder, tweetTextContainer.nextSibling);
    } else if (engagementBarContainer && engagementBarContainer.parentElement) {
      insertionPoint = engagementBarContainer.parentElement;
      insertionPoint.insertBefore(placeholder, engagementBarContainer.nextSibling);
    } else if (tweetContentArea) {
      // Last resort: insert at the end of the tweet content area
      tweetContentArea.appendChild(placeholder);
    }
  }

  /**
   * Reveal a muted tweet
   * @param {HTMLElement} tweetElement - The muted tweet element
   */
  function revealMutedTweet(tweetElement) {
    if (!tweetElement) {
      return;
    }

    // If already revealed, don't do anything
    if (tweetElement.hasAttribute('data-iq-manually-revealed')) {
      return;
    }

    // If not muted, nothing to reveal
    if (!tweetElement.hasAttribute('data-iq-muted')) {
      return;
    }

    // Mark as manually revealed - this prevents re-filtering
    tweetElement.setAttribute('data-iq-manually-revealed', 'true');
    tweetElement.removeAttribute('data-iq-muted');

    // Find and remove placeholder
    const placeholder = tweetElement.querySelector('[data-iq-placeholder="true"]');
    if (placeholder) {
      // Restore all hidden elements
      if (placeholder._hiddenElements && Array.isArray(placeholder._hiddenElements)) {
        placeholder._hiddenElements.forEach(element => {
          if (element && element.parentElement) {
            element.style.removeProperty('display');
            element.removeAttribute('data-iq-hidden-content');
          }
        });
      }
      // Also restore the main content container if it exists separately
      if (placeholder._hiddenContent && placeholder._hiddenContent.parentElement) {
        placeholder._hiddenContent.style.removeProperty('display');
        placeholder._hiddenContent.removeAttribute('data-iq-hidden-content');
      }
      // Restore hidden avatar if it exists
      if (placeholder._hiddenAvatar && placeholder._hiddenAvatar.parentElement) {
        placeholder._hiddenAvatar.style.removeProperty('display');
        placeholder._hiddenAvatar.removeAttribute('data-iq-hidden-avatar');
      }
      placeholder.remove();
    }
  }

  /**
   * Reveal all muted tweets (used when filter is disabled or mode changes)
   */
  function revealAllMutedTweets() {
    const mutedTweets = document.querySelectorAll('[data-iq-muted="true"]');
    mutedTweets.forEach(tweet => {
      // Remove manually revealed flag when filter is disabled
      tweet.removeAttribute('data-iq-manually-revealed');
      revealMutedTweet(tweet);
    });
  }

  /**
   * Check and filter a tweet based on its IQ score and confidence
   * This should be called immediately after IQ calculation, before any animations
   * @param {HTMLElement} tweetElement - The tweet element
   * @param {number} iq - The IQ score
   * @param {number|null} confidence - The confidence percentage (0-100)
   * @returns {Promise<boolean>} True if the tweet was filtered (removed or muted)
   */
  async function checkAndFilter(tweetElement, iq, confidence) {
    if (!tweetElement || iq === null || iq === undefined) {
      return false;
    }

    // Don't filter if manually revealed by user
    if (tweetElement.hasAttribute('data-iq-manually-revealed')) {
      return false;
    }

    const shouldFilter = await shouldFilterTweet(tweetElement, iq, confidence);
    if (shouldFilter) {
      const settings = getSettings();
      const filterMode = settings.filterMode || 'remove';

      if (filterMode === 'mute') {
        muteTweetElement(tweetElement);
      } else {
        removeTweetElement(tweetElement);
      }
      return true;
    } else {
      // If tweet should not be filtered, check if it's currently muted and reveal it
      // But only if it wasn't manually revealed (user might have changed settings)
      if (tweetElement.hasAttribute('data-iq-muted') && !tweetElement.hasAttribute('data-iq-manually-revealed')) {
        revealMutedTweet(tweetElement);
      }
    }

    return false;
  }

  /**
   * Apply filter to all currently visible tweets immediately
   * Called when filter settings change to apply filter without page refresh
   */
  async function applyFilterToVisibleTweets() {
    const settings = getSettings();

    // Only apply if filter is enabled
    if (!settings.enableIqFiltr) {
      return;
    }

    // Find all tweet elements that have IQ scores calculated
    const tweetSelectors = [
      'article[data-testid="tweet"]',
      'article[role="article"]',
      'div[data-testid="cellInnerDiv"] > article'
    ];

    let allTweets = [];
    for (const selector of tweetSelectors) {
      const tweets = document.querySelectorAll(selector);
      if (tweets.length > 0) {
        allTweets = Array.from(tweets);
        break;
      }
    }

    if (allTweets.length === 0) {
      allTweets = Array.from(document.querySelectorAll('article'));
    }

    // Check each tweet that has an IQ result
    for (const tweetElement of allTweets) {
      // Skip if already removed or doesn't exist
      if (!tweetElement || !tweetElement.parentElement) {
        continue;
      }

      // Check if this tweet has an IQ result stored
      const iqResult = tweetElement._iqResult;
      if (!iqResult || iqResult.iq === null || iqResult.iq === undefined) {
        // Try to get from badge if available
        const badge = tweetElement.querySelector('.iq-badge[data-iq-score]');
        if (badge) {
          const iqScore = badge.getAttribute('data-iq-score');
          const confidenceAttr = badge.getAttribute('data-confidence');

          if (iqScore && !isNaN(parseInt(iqScore, 10))) {
            const iq = parseInt(iqScore, 10);
            const confidence = confidenceAttr && !isNaN(parseInt(confidenceAttr, 10))
              ? parseInt(confidenceAttr, 10)
              : null;

            // Check and filter this tweet
            await checkAndFilter(tweetElement, iq, confidence);
          }
        }
        continue;
      }

      // Check and filter this tweet using stored IQ result
      const iq = iqResult.iq;
      const confidence = iqResult.confidence !== null && iqResult.confidence !== undefined
        ? iqResult.confidence
        : null;

      await checkAndFilter(tweetElement, iq, confidence);
    }
  }

  // Export for use in other modules
  if (typeof window !== 'undefined') {
    window.IqFiltr = {
      checkAndFilter,
      shouldFilterTweet,
      isReply,
      isQuotedPost,
      isRegularTweet,
      removeTweetElement,
      muteTweetElement,
      revealMutedTweet,
      revealAllMutedTweets,
      applyFilterToVisibleTweets
    };
  }

})();

