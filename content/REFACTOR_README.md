# Content Script Refactoring

## New Structure

The content script has been refactored into a modular structure for better organization and maintainability:

```
content/
├── core/                          # Core IQ estimation logic
│   ├── iqEstimator.js            # ComprehensiveIQEstimatorUltimate (from comprehensiveIQEstimatorUltimate.js)
│   └── dependencyParser.js       # SpacyDependencyParser (from spacyDependencyParser.js)
│
├── utils/                         # Utility functions
│   ├── cache.js                  # IQ cache management (hashTweetText, getCachedIQ, cacheIQ, loadCache)
│   ├── textExtraction.js         # Text extraction functions (extractTweetText, tryExtractFullTextWithoutExpanding, etc.)
│   ├── tweetDetection.js         # Tweet detection and validation (isInsideQuotedTweet, getElementDepth, validateTweetText, findTextInputs)
│   └── domHelpers.js             # DOM manipulation helpers (debugLog)
│
├── features/                      # Feature modules
│   ├── settings.js               # Settings management
│   ├── badge.js                  # Badge creation and styling (createIQBadge, createLoadingBadge, animateCountUp, etc.)
│   ├── tweetProcessor.js         # Main tweet processing (processTweet, processVisibleTweets, setupObserver)
│   └── realtime.js               # Real-time IQ monitoring (setupRealtimeMonitoring, updateRealtimeBadge)
│
└── content.js                    # Main orchestrator (imports all modules, initializes extension)
```

## Module Dependencies

All modules use the window global namespace pattern (no ES6 modules) for browser extension compatibility:

- `window.spacyDependencyParser` - Dependency parser instance
- `window.ComprehensiveIQEstimatorUltimate` - IQ estimator class
- `window.IQCache` - Cache utilities
- `window.IQSettings` - Settings management
- `window.TextExtraction` - Text extraction utilities
- `window.TweetDetection` - Tweet detection utilities
- `window.DOMHelpers` - DOM helper functions
- `window.BadgeManager` - Badge management
- `window.TweetProcessor` - Tweet processing
- `window.RealtimeManager` - Real-time monitoring

## Migration Notes

All original functionality has been preserved. The refactoring only reorganizes the code structure for better maintainability.

## Loading Order (manifest.json)

1. `core/dependencyParser.js` - Initialize dependency parser
2. `core/iqEstimator.js` - Initialize IQ estimator
3. `utils/cache.js` - Initialize cache
4. `utils/domHelpers.js` - Initialize helpers
5. `utils/textExtraction.js` - Text extraction utilities
6. `utils/tweetDetection.js` - Tweet detection utilities
7. `features/settings.js` - Initialize settings
8. `features/badge.js` - Badge functionality
9. `features/tweetProcessor.js` - Tweet processing
10. `features/realtime.js` - Real-time monitoring
11. `content.js` - Main orchestrator

