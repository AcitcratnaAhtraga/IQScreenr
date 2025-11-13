# 🧠 IQScreenr - Tweet Text IQ Analyzer

A Chrome extension that analyzes tweets on X.com (Twitter) and displays estimated verbal IQ scores with color-coded badges. Uses research-validated linguistic metrics and z-score conversion for accurate IQ estimation.

## Features

- **Real-time Analysis**: Automatically analyzes tweets as you scroll
- **IQ Scoring**: Estimates verbal IQ from 60-145+ based on linguistic features
- **Color-coded Badges**: Gradient colors from red (simpler) to green (complex)
- **Research-Validated Metrics**: Uses z-score conversion with population norms
- **Sophisticated Content Detection**: Recognizes metaphors, abstract concepts, and structured organization
- **Customizable Settings**: Toggle badges, breakdown info, and adjust scoring scale
- **Hover Details**: Detailed linguistic breakdown on badge hover (enabled by default)
- **Developer Mode**: Press `CTRL+I+Q` to enable dev mode with detailed debugging

## Installation

### Step 1: Prepare Icons

You'll need to create icon files for the extension. Create three PNG images:
- `icons/icon16.png` (16x16 pixels)
- `icons/icon48.png` (48x48 pixels)
- `icons/icon128.png` (128x128 pixels)

You can use any image editor or online tools to create a brain emoji (🧠) icon or any design you prefer.

### Step 2: Load the Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in the top-right corner)
3. Click "Load unpacked"
4. Select the `IQScreenr` folder (this directory)
5. The extension should now appear in your extensions list

### Step 3: Verify Installation

1. Navigate to https://x.com or https://twitter.com
2. The extension will automatically start analyzing tweets
3. You should see IQ badges (🧠 IQ XX) appearing next to tweets

## Usage

### Viewing IQ Scores

IQ badges appear automatically next to each tweet. The color indicates the complexity:
- **Red (60-70)**: Very simple phrasing
- **Orange (70-85)**: Simple phrasing
- **Yellow-Orange (85-95)**: Below average
- **Yellow (95-105)**: Average
- **Yellow-Green (105-115)**: Above average
- **Light Green (115-125)**: High complexity
- **Green (125-135)**: Very high complexity
- **Dark Green (135-145)**: Superior complexity
- **Very Dark Green (145+)**: Exceptional complexity

### Settings

Click the extension icon in your Chrome toolbar to open the settings popup:

- **Show IQ Badge**: Toggle to show/hide IQ scores
- **Show Linguistic Breakdown**: Enable/disable detailed analysis on badge hover (on by default)
- **Scoring Scale**: Adjust minimum and maximum IQ values (default: 60-145)
- **Clear Cache**: Clear all cached IQ scores and recalculation data

The linguistic breakdown includes:
- **Vocabulary**: Age of Acquisition (AoA), advanced vocabulary percentage
- **Word Length**: Average characters per word
- **Syllables**: Average syllables per word
- **Sentence Structure**: Average words per sentence, variance
- **Readability**: Flesch-Kincaid, SMOG, ARI, LIX indices
- **Syntax Complexity**: Dependency depth, punctuation entropy, subordinate clauses
- **Lexical Diversity**: Type-Token Ratio (TTR), MSTTR, MTLD, Yule's K
- **Overall Complexity**: Combined complexity assessment
- **Statistics**: Total word and sentence counts

### Developer Mode

Press `CTRL+I+Q` (or `CMD+I+Q` on Mac) to toggle developer mode:

- **Hover**: See detailed badge information in tooltip
- **Click**: Recalculate IQ score for a badge
- **Right-click**: Track changes to a badge over time
- **Console**: Detailed debug logs appear in browser console (F12)

### Reset Settings

Click "Reset to Defaults" in the popup to restore original settings.

## File Structure

```
IQScreenr/
├── manifest.json              # Extension manifest
├── content/
│   ├── core/
│   │   ├── iqEstimator.js                  # Research-based IQ estimator with z-score conversion
│   │   └── dependencyParser.js              # Dependency parsing approximation
│   ├── data/
│   │   ├── aoa_dictionary.json             # Age of Acquisition dictionary (31,766 words)
│   │   ├── dependency_depth_calibration.json # Dependency depth calibration coefficients
│   │   ├── metaphor_patterns.json           # Metaphor and abstract concept patterns database
│   │   └── population_norms.json            # Research-validated population norms for z-score conversion
│   ├── features/
│   │   ├── badge/                           # Badge creation and management
│   │   ├── devMode/                         # Developer mode features
│   │   ├── gameManager/                     # IQ guessing game features
│   │   └── tweetProcessor/                  # Tweet processing pipeline
│   └── content.js                          # Content script (tweet detection & badge injection)
├── popup/
│   ├── popup.html             # Settings UI
│   ├── popup.css              # Popup styles
│   └── popup.js               # Popup logic
├── styles/
│   └── badge.css              # Badge styling
├── background/
│   └── background.js          # Background service worker
├── icons/                     # Extension icons (you need to add these)
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md                  # This file
```

## How It Works

### IQ Calculation

The extension uses a **research-validated estimator** with z-score conversion. It analyzes 4 dimensions:

1. **Vocabulary Sophistication (35% weight, 45% for tweets ≤300 chars)**: Age of Acquisition (AoA)
   - Uses z-score conversion: `IQ = 100 + (z-score × 0.55 × 15)`
   - Population norms: Mean AoA = 9.02 years, StdDev = 3.76 (from Kuperman dictionary analysis)
   - Higher AoA = more sophisticated vocabulary = higher IQ
   - Correlation coefficient: r = 0.55 (research-validated)

2. **Lexical Diversity (25% weight)**: Type-Token Ratio (TTR) and Mean Segmental TTR (MSTTR)
   - Uses z-score conversion: `IQ = 100 + (z-score × 0.40 × 15)`
   - Population norms: Mean TTR = 0.65, StdDev = 0.12
   - Also considers MTLD and Yule's K for comprehensive diversity assessment
   - Correlation coefficient: r = 0.40 (research-validated)

3. **Sentence Complexity (20% weight, 15% for tweets ≤300 chars)**: Average words per sentence
   - Uses z-score conversion: `IQ = 100 + (z-score × 0.35 × 15 × optimality_factor)`
   - Population norms: Mean = 12.5 words (essay), 8.5 words (Twitter), StdDev = 4.5/3.0
   - Moderate complexity optimal (diminishing returns for extremes)
   - Correlation coefficient: r = 0.35 (research-validated)

4. **Grammatical Precision (20% weight, 15% for tweets ≤300 chars)**: Dependency depth approximation
   - Uses z-score conversion: `IQ = 100 + (z-score × 0.45 × 15)`
   - Population norms: Mean dependency depth = 1.95, StdDev = 0.35
   - Approximates dependency depth from punctuation, clauses, and sentence structure
   - Correlation coefficient: r = 0.45 (research-validated)

### Sophisticated Content Detection

The system recognizes sophisticated writing patterns:
- **Metaphorical Language**: Uses comprehensive metaphor patterns database (2,000+ patterns)
- **Structured Organization**: Detects bullet points, numbered lists, clear sections
- **Abstract Concepts**: Identifies meta-cognition and abstract thinking patterns
- **Self-Reflection**: Detects personal insight and introspection
- **Practical Wisdom**: Recognizes actionable advice and structured guidance

Sophisticated content receives bonuses and reduced repetition penalties, as thoughtful longer texts naturally have some repetition for coherence.

### Z-Score Conversion

All dimension scores use research-validated z-score conversion:

```
z-score = (feature_value - population_mean) / population_stddev
IQ = 100 + (z-score × correlation_coefficient × 15)
```

This ensures:
- Scores are standardized to IQ scale (mean=100, SD=15)
- Each dimension reflects its actual correlation with intelligence
- Population norms are based on real linguistic research
- Scores are comparable across different text types

### Final IQ Calculation

The final IQ is a **weighted combination** of these 4 dimensions:
- Essay/Long Text: Vocab 35% + Diversity 25% + Sentence 20% + Grammar 20%
- Twitter (≤300 chars): Vocab 45% + Diversity 25% + Sentence 15% + Grammar 15%

Additional adjustments:
- Sophisticated content bonuses
- Run-on sentence penalties (for casual Twitter patterns)
- Final calibration pass for high/low IQ extremes

All processing happens **client-side** in your browser - no data is sent anywhere.

### Debug Mode

**Hover over any IQ badge** and open the browser console (F12) to see:
- Detailed feature extraction (TTR, word length, sentence metrics, AoA, etc.)
- Dimension breakdown with individual IQ scores
- Z-score calculations for each dimension
- Population norms used for conversion
- Weighted calculation showing how final IQ was computed
- Confidence calculation breakdown
- Full feature values and research-validated formulas
- Complete result object

This helps you understand exactly how each tweet was analyzed.

### Developer Mode (CTRL+I+Q)

Press `CTRL+I+Q` (or `CMD+I+Q` on Mac) to enable developer mode:

- **Hover over badges**: See detailed tooltip with badge information
- **Click badges**: Recalculate IQ score
- **Right-click badges**: Track changes over time
- **Console logging**: Detailed debug information in browser console

### Tweet Detection

The extension uses a `MutationObserver` to watch for new tweets appearing on the page. When a tweet is detected:
1. The tweet text is extracted
2. IQ is calculated using the research-validated algorithm
3. A badge is injected next to the tweet
4. The tweet is marked as processed to avoid duplicate analysis

## Technical Details

- **Manifest Version**: 3
- **Permissions**: `storage`, `activeTab`
- **Host Permissions**: `*.twitter.com/*`, `*.x.com/*`
- **Content Script**: Runs on X.com/Twitter pages
- **Storage**: Settings stored in `chrome.storage.sync`, IQ scores cached in `chrome.storage.local`
- **Resources**: AoA dictionary, metaphor patterns, population norms loaded as web-accessible resources

## Research Validation

The IQ estimation system uses:
- **Kuperman Age of Acquisition Dictionary**: 31,766 English words with AoA ratings
- **Research-Validated Correlation Coefficients**: Based on linguistic research linking features to intelligence
- **Population Norms**: Derived from corpus linguistics research and dictionary analysis
- **Z-Score Conversion**: Standard statistical method for IQ score standardization

## Customization

### Adjusting Color Gradients

Edit `content/content.js` and modify the `getIQColor()` function to change color ranges.

### Modifying IQ Algorithm

Edit `content/core/iqEstimator.js` to adjust:
- Dimension weights (35%, 25%, 20%, 20% for essays; 45%, 25%, 15%, 15% for tweets ≤300 chars)
- Twitter-specific calibration (sentence baseline: 8.5 vs 12.5 for essays)
- Population norms (in `content/data/population_norms.json`)
- Correlation coefficients (research-validated values)
- Feature extraction logic

### Styling Badges

Edit `styles/badge.css` to customize badge appearance, size, and positioning.

## Troubleshooting

### Badges Not Appearing

1. Refresh the X.com/Twitter page
2. Check that the extension is enabled in `chrome://extensions/`
3. Open the browser console (F12) and check for errors
4. Verify you're on `x.com` or `twitter.com`

### Incorrect Scores

- The algorithm is an estimation based on linguistic features
- It may not accurately reflect actual IQ
- Scores are relative to population norms, not absolute measurements
- Use developer mode (`CTRL+I+Q`) to see detailed breakdown

### Cache Issues

- Use "Clear Cache" button in settings popup
- This clears all cached IQ scores and forces recalculation

## License

This extension is provided as-is for educational and demonstration purposes.

## Version

2.0.0 - Research-validated z-score conversion with population norms
