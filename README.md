# 🧠 Tweet Text IQ Analyzer

A Chrome extension that analyzes tweets on X.com (Twitter) and displays estimated verbal IQ scores with color-coded badges.

## Features

- **Real-time Analysis**: Automatically analyzes tweets as you scroll
- **IQ Scoring**: Estimates verbal IQ from 60-145+ based on linguistic features
- **Color-coded Badges**: Gradient colors from red (simpler) to green (complex)
- **Linguistic Metrics**: Calculates IQ using:
  - Average word length
  - Unique word ratio
  - Sentence complexity and variance
  - Syllable complexity
  - Readability index
  - Vocabulary sophistication
  - Syntax complexity
- **Customizable Settings**: Toggle badges, breakdown info, and adjust scoring scale
- **Hover Details**: Detailed linguistic breakdown on badge hover (enabled by default)

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
4. Select the `IQGuessr` folder (this directory)
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

The linguistic breakdown includes:
- **Vocabulary**: Uniqueness percentage and level (Basic/Moderate/Advanced/Sophisticated)
- **Word Length**: Average characters per word
- **Syllables**: Average syllables per word
- **Sentence Structure**: Average words per sentence
- **Readability**: Complexity rating
- **Syntax Complexity**: Punctuation and clause usage
- **Overall Complexity**: Combined complexity assessment
- **Statistics**: Total word and sentence counts

### Reset Settings

Click "Reset to Defaults" in the popup to restore original settings.

## File Structure

```
IQGuessr/
├── manifest.json              # Extension manifest
├── content/
│   ├── iqCalculator.js        # IQ calculation algorithm
│   └── content.js             # Content script (tweet detection & badge injection)
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

The extension uses a sophisticated algorithm that analyzes multiple linguistic features:

1. **Word Length Analysis**: Longer words indicate higher vocabulary
2. **Uniqueness Ratio**: Diverse vocabulary suggests higher complexity
3. **Sentence Metrics**: Average length, variance, and maximum length
4. **Syllable Complexity**: More syllables per word indicates sophistication
5. **Readability Index**: Inverted Flesch Reading Ease score
6. **Vocabulary Sophistication**: Analysis of long words vs common words
7. **Syntax Complexity**: Punctuation usage and subordinate clauses

Each metric contributes to a weighted score that maps to the 60-145+ IQ range.

### Tweet Detection

The extension uses a `MutationObserver` to watch for new tweets appearing on the page. When a tweet is detected:
1. The tweet text is extracted
2. IQ is calculated using the algorithm
3. A badge is injected next to the tweet
4. The tweet is marked as processed to avoid duplicate analysis

## Technical Details

- **Manifest Version**: 3
- **Permissions**: `storage`, `activeTab`
- **Host Permissions**: `*.twitter.com/*`, `*.x.com/*`
- **Content Script**: Runs on X.com/Twitter pages
- **Storage**: Settings stored in `chrome.storage.sync`

## Customization

### Adjusting Color Gradients

Edit `content/content.js` and modify the `getIQColor()` function to change color ranges.

### Modifying IQ Algorithm

Edit `content/iqCalculator.js` to adjust:
- Weighting of different metrics
- Baseline values
- Score mapping to IQ range

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
- Scores are relative to other tweets, not absolute measurements

### Performance Issues

- The extension processes tweets as they appear
- If you notice slowdowns, try disabling "Show Linguistic Breakdown"
- The extension uses debouncing to limit processing frequency

## License

This extension is provided as-is for educational and demonstration purposes.

## Version

1.0.0

