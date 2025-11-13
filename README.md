# 🧠 IQScreenr

> **Real-time verbal IQ analysis for Twitter/X tweets**  
> A privacy-first browser extension that analyzes tweet text using research-validated linguistic metrics and displays estimated IQ scores with color-coded badges.

[![License](https://img.shields.io/badge/license-Custom-blue.svg)](LICENSE)
[![Chrome](https://img.shields.io/badge/Chrome-Extension-green.svg)](https://chrome.google.com/webstore)
[![Privacy](https://img.shields.io/badge/Privacy-Client--side-brightgreen.svg)](https://iqscreenr.win)

---

## ✨ Features

### 🎯 Core Functionality
- **Real-time Analysis**: Automatically analyzes tweets as you scroll through your Twitter/X feed
- **IQ Scoring**: Estimates verbal IQ from 60-145+ based on comprehensive linguistic analysis
- **Confidence-Based Colors**: Visual gradient indicators from red (low confidence) to green (high confidence)
- **Privacy-first**: All processing happens client-side in your browser - no data sent anywhere

### 🔬 Research-Validated
- **Z-Score Conversion**: Uses population norms and correlation coefficients from linguistic research
- **4-Dimensional Analysis**: Vocabulary Sophistication, Lexical Diversity, Sentence Complexity, Grammatical Precision
- **31,766-Word Dictionary**: Age of Acquisition (AoA) database from Kuperman et al. research
- **Sophisticated Content Detection**: Recognizes metaphors, abstract concepts, and structured organization

### 🎮 Interactive Features
- **IqGuessr Game Mode**: Guess the IQ of tweets before revealing scores
- **IqFiltr Filtering**: Filter tweets by IQ range to focus on specific content quality
- **Developer Mode**: Press `CTRL+I+Q` for detailed debugging and analysis breakdowns
- **Hover Details**: Comprehensive linguistic breakdown on badge hover (enabled by default)

### ⚙️ Customization
- **Toggle Badges**: Show/hide IQ scores on demand
- **Adjustable Scale**: Customize minimum and maximum IQ display range (default: 60-145)
- **Confidence Display**: Badge colors always reflect confidence levels (0-100%)
- **Linguistic Breakdown**: Enable/disable detailed analysis tooltips
- **Cache Management**: Clear cached scores for recalculation

---

## 🚀 Quick Start

### Installation

1. **Download the Extension**
   - Clone this repository or download the ZIP file
   - Extract to a folder on your computer

2. **Load in Chrome/Edge/Brave**
   - Open `chrome://extensions/` (or `edge://extensions/` for Edge)
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select the `IQScreenr` folder

3. **Verify Installation**
   - Navigate to [x.com](https://x.com) or [twitter.com](https://twitter.com)
   - IQ badges should automatically appear next to tweets
   - Click the extension icon in your toolbar to access settings

### First Use

1. Visit Twitter/X and scroll through your feed
2. Watch IQ badges appear next to each tweet
3. Hover over badges to see detailed linguistic breakdowns
4. Open browser console (F12) while hovering for comprehensive debug logs

---

## 📊 How It Works

### The Science Behind IQ Estimation

IQScreenr uses a **research-validated estimator** that analyzes four key dimensions of written language:

#### 1. Vocabulary Sophistication (35-45% weight)
**What it measures**: The complexity and sophistication of word choices

- Uses Age of Acquisition (AoA) ratings from a 31,766-word dictionary
- Higher AoA = words learned later in life = more sophisticated vocabulary
- **Formula**: `IQ = 100 + (z-score × 0.55 × 15)`
- **Population Norms**: Mean AoA = 9.02 years, StdDev = 3.76
- **Correlation**: r = 0.55 (research-validated)

**Example**: "utilize" (AoA ~12) vs "use" (AoA ~3) indicates higher sophistication

#### 2. Lexical Diversity (25% weight)
**What it measures**: Word variety and repetition patterns

- Analyzes Type-Token Ratio (TTR), Mean Segmental TTR (MSTTR), MTLD, and Yule's K
- Higher diversity = more varied vocabulary = higher IQ indicator
- **Formula**: `IQ = 100 + (z-score × 0.40 × 15)`
- **Population Norms**: Mean TTR = 0.65, StdDev = 0.12
- **Correlation**: r = 0.40 (research-validated)

**Example**: "The good idea was really good" (low diversity) vs "The excellent concept was truly innovative" (high diversity)

#### 3. Sentence Complexity (15-20% weight)
**What it measures**: Sentence structure and length patterns

- Analyzes average words per sentence with optimality factors
- Moderate complexity is optimal (extremely long sentences aren't always better)
- **Formula**: `IQ = 100 + (z-score × 0.35 × 15 × optimality_factor)`
- **Population Norms**: Mean = 12.5 words (essay), 8.5 words (Twitter)
- **Correlation**: r = 0.35 (research-validated)

**Twitter Adjustment**: Shorter sentences are normal due to character limits, so Twitter uses a lower baseline (8.5 vs 12.5 words)

#### 4. Grammatical Precision (15-20% weight)
**What it measures**: Grammar, punctuation, and syntactic complexity

- Approximates dependency depth from punctuation patterns, clauses, and sentence structure
- Analyzes punctuation entropy, subordinate clauses, and connective density
- **Formula**: `IQ = 100 + (z-score × 0.45 × 15)`
- **Population Norms**: Mean dependency depth = 1.95, StdDev = 0.35
- **Correlation**: r = 0.45 (research-validated)

**Example**: Proper comma usage, complex sentence structures, varied punctuation patterns

### Sophisticated Content Detection

The system recognizes advanced writing patterns that indicate higher cognitive sophistication:

- **Metaphorical Language**: Detects metaphors using a comprehensive 2,000+ pattern database
- **Abstract Concepts**: Identifies meta-cognition and abstract thinking patterns
- **Structured Organization**: Recognizes bullet points, numbered lists, and clear sections
- **Self-Reflection**: Detects personal insight and introspection
- **Practical Wisdom**: Identifies actionable advice and structured guidance

Sophisticated content receives bonuses and reduced repetition penalties, as thoughtful longer texts naturally have some repetition for coherence.

### Z-Score Conversion

All dimension scores use research-validated z-score conversion:

```
z-score = (feature_value - population_mean) / population_stddev
IQ = 100 + (z-score × correlation_coefficient × 15)
```

This ensures:
- ✅ Scores are standardized to IQ scale (mean=100, SD=15)
- ✅ Each dimension reflects its actual correlation with intelligence
- ✅ Population norms are based on real linguistic research
- ✅ Scores are comparable across different text types

### Final IQ Calculation

The final IQ is a **weighted combination** of the 4 dimensions:

- **Essay/Long Text**: Vocab 35% + Diversity 25% + Sentence 20% + Grammar 20%
- **Twitter (≤300 chars)**: Vocab 45% + Diversity 25% + Sentence 15% + Grammar 15%

Additional adjustments:
- Sophisticated content bonuses (metaphors, abstract concepts, structure)
- Run-on sentence penalties (for casual Twitter patterns)
- Final calibration pass for high/low IQ extremes
- Short text adjustments (for very brief tweets)

---

## 🎨 Understanding IQ Scores & Confidence

### Color Coding (Confidence-Based)

Badge colors reflect **confidence levels** (0-100%), not IQ scores. Higher confidence indicates more reliable IQ estimates:

| Confidence Range | Color | Interpretation |
|------------------|-------|----------------|
| 0-10% | 🔴 Dark Red | Very low confidence - unreliable estimate |
| 10-20% | 🟠 Red-Orange | Low confidence - estimate may be inaccurate |
| 20-30% | 🟠 Orange | Below average confidence |
| 30-40% | 🟡 Orange-Yellow | Moderate-low confidence |
| 40-50% | 🟡 Yellow | Moderate confidence |
| 50-60% | 🟢 Yellow-Green | Moderate-high confidence |
| 60-70% | 🟢 Light Green | Good confidence - reliable estimate |
| 70-80% | 🟢 Green | High confidence - very reliable |
| 80-90% | 🟢 Bright Green | Very high confidence - highly reliable |
| 90-95% | 🟢 Maximum Green | Maximum confidence - most reliable estimate |

**Why Confidence Matters**: Confidence reflects signal quality, dimension agreement, feature reliability, and text length. Longer, well-structured texts with consistent linguistic patterns receive higher confidence scores.

### What the IQ Scores Mean

IQ scores range from approximately 60-145+ and represent estimated verbal intelligence:

- **60-85**: Simple, straightforward language with basic vocabulary
- **85-105**: Average complexity, typical of general population
- **105-125**: Above average, sophisticated vocabulary and structure
- **125-145**: High complexity, advanced vocabulary and complex sentence structures
- **145+**: Exceptional complexity, rare sophisticated writing patterns

**Important Notes**: 
- These are **estimates** based on linguistic features, not actual IQ test results
- They provide insights into writing sophistication but should not be treated as definitive intelligence measurements
- **Confidence percentage** indicates how reliable each estimate is - always check both the IQ score and confidence level

---

## 🛠️ Developer Mode

Press `CTRL+I+Q` (or `CMD+I+Q` on Mac) to enable developer mode:

### Features
- **Hover**: See detailed tooltip with badge information
- **Click**: Recalculate IQ score for a badge
- **Right-click**: Track changes to a badge over time
- **Console**: Detailed debug logs appear in browser console (F12)

### Debug Information

When developer mode is enabled, hovering over badges shows:

- **Feature Extraction**: TTR, word length, sentence metrics, AoA, etc.
- **Dimension Breakdown**: Individual IQ scores for each dimension
- **Z-Score Calculations**: Exact z-score conversions for each dimension
- **Population Norms**: Research-validated norms used for conversion
- **Weighted Calculation**: Step-by-step breakdown of final IQ computation
- **Confidence Calculation**: Signal quality, dimension agreement, feature reliability, and length constraints
- **Sophisticated Content**: Metaphor counts, abstract concepts, structure analysis with gradual scaling formulas
- **Complete Result Object**: Full feature values and formulas

This helps you understand exactly how each tweet was analyzed.

---

## 📁 Project Structure

```
IQScreenr/
├── manifest.json                    # Extension manifest (Manifest V3)
├── LICENSE                           # Custom license (see below)
├── README.md                         # This file
│
├── content/                          # Content scripts
│   ├── core/
│   │   ├── iqEstimator.js           # Main IQ estimation engine
│   │   └── dependencyParser.js      # Dependency parsing approximation
│   ├── data/
│   │   ├── aoa_dictionary.json       # Age of Acquisition dictionary (31,766 words)
│   │   ├── dependency_depth_calibration.json
│   │   ├── metaphor_patterns.json    # Metaphor patterns database (2,000+ patterns)
│   │   ├── population_norms.json    # Research-validated population norms
│   │   └── casual_language_patterns.json
│   ├── features/
│   │   ├── badge/                   # Badge creation and management
│   │   ├── devMode/                 # Developer mode features
│   │   ├── gameManager/             # IqGuessr game features
│   │   ├── iqFiltr.js               # IQ filtering functionality
│   │   └── tweetProcessor/          # Tweet processing pipeline
│   ├── utils/                       # Utility functions
│   └── content.js                   # Main content script orchestrator
│
├── popup/                            # Settings popup UI
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
│
├── styles/
│   └── badge.css                    # Badge styling
│
├── background/
│   └── background.js                 # Background service worker
│
└── icons/                            # Extension icons
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## 🔬 Research Validation

IQScreenr uses research-validated methods and data:

### Data Sources
- **Kuperman Age of Acquisition Dictionary**: 31,766 English words with AoA ratings (Kuperman et al., 2012)
- **Population Norms**: Derived from corpus linguistics research and dictionary analysis
- **Correlation Coefficients**: Based on linguistic research linking features to intelligence

### Research Papers
- Kuperman, V., Stadthagen-Gonzalez, H., & Brysbaert, M. (2012). Age-of-acquisition ratings for 30,000 English words. *Behavior Research Methods*, 44(4), 978-990.
- Nnamoko et al. (2024). Age of Acquisition proxies for vocabulary sophistication estimation.
- Abramov (2018). Type-Token Ratio and lexical diversity metrics.
- Hendrix & Yampolskiy (2017). Sentence complexity analysis and intelligence.

### Methodology
- **Z-Score Conversion**: Standard statistical method for IQ score standardization
- **Multi-Dimensional Analysis**: Four independent dimensions combined with research-validated weights
- **Gradual Scaling**: Continuous functions instead of categorical thresholds for more accurate scoring

---

## ⚙️ Customization

### Adjusting Color Gradients

Edit `content/features/badge/colorUtils.js` to modify color ranges and gradients. Note that colors are based on confidence intervals (0-100%) by default, not IQ scores. The `getConfidenceColor()` function maps confidence percentages to the color gradient.

### Modifying IQ Algorithm

Edit `content/core/iqEstimator.js` to adjust:
- Dimension weights (35%, 25%, 20%, 20% for essays; 45%, 25%, 15%, 15% for tweets)
- Twitter-specific calibration (sentence baseline: 8.5 vs 12.5 for essays)
- Population norms (in `content/data/population_norms.json`)
- Correlation coefficients (research-validated values)
- Feature extraction logic

### Styling Badges

Edit `styles/badge.css` to customize badge appearance, size, and positioning.

---

## 🐛 Troubleshooting

### Badges Not Appearing
1. Refresh the X.com/Twitter page
2. Check that the extension is enabled in `chrome://extensions/`
3. Open browser console (F12) and check for errors
4. Verify you're on `x.com` or `twitter.com`

### Incorrect Scores
- The algorithm is an estimation based on linguistic features
- It may not accurately reflect actual IQ
- Scores are relative to population norms, not absolute measurements
- Use developer mode (`CTRL+I+Q`) to see detailed breakdown

### Cache Issues
- Use "Clear Cache" button in settings popup
- This clears all cached IQ scores and forces recalculation

### Performance Issues
- Very long threads may take time to process
- The extension processes tweets as you scroll
- Cached scores improve performance on subsequent visits

---

## 🔒 Privacy

**IQScreenr is privacy-first:**

- ✅ **100% Client-Side Processing**: All analysis happens in your browser
- ✅ **No Data Collection**: No tweets, scores, or personal data are sent anywhere
- ✅ **No Tracking**: No analytics, no telemetry, no external requests
- ✅ **Local Storage Only**: Settings and cache stored locally in your browser
- ✅ **Open Source**: Full code available for inspection

Your data stays on your device. Always.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Areas for Contribution
- Bug fixes and improvements
- Additional linguistic features
- Performance optimizations
- Documentation improvements
- Translation/localization

### Development Setup
1. Clone the repository
2. Load as unpacked extension in Chrome/Edge
3. Make changes and test locally
4. Submit a pull request with clear description

---

## 📝 License

This project is licensed under a **Custom License** - see the [LICENSE](LICENSE) file for details.

**Summary:**
- ✅ Free to use, modify, and distribute
- ✅ Attribution required
- ✅ Commercial/monetized use requires explicit permission
- ✅ Non-commercial use is free and open


---

## 📞 Support

- **Website**: [iqscreenr.win](https://iqscreenr.win)

---

## 🗺️ Roadmap

- [ ] Support for additional social media platforms
- [ ] Enhanced metaphor detection with ML models
- [ ] User-defined custom scoring rules
- [ ] Export analysis data
- [ ] Batch analysis mode
- [ ] API for developers

---

## ⚠️ Disclaimer

IQScreenr provides **estimates** based on linguistic analysis, not actual IQ test results. These scores:

- Are based on written language patterns only
- May not reflect actual intelligence accurately
- Should not be used for important decisions
- Are for entertainment and educational purposes

Use responsibly and remember: intelligence is multifaceted and cannot be fully captured by text analysis alone.

---


*Last updated: 2025*
