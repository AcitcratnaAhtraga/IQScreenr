# Integration Guide: Text-to-IQ Estimator → IQGuessr

## Overview

This guide shows how to integrate the Text-to-IQ Estimator with the IQGuessr Chrome extension.

## Architecture

```
IQGuessr Extension
    ├── content/ (analyzes web page text)
    ├── popup/ (displays results)
    └── background/ (coordinates)
            ↓
    Calls Text-to-IQ Estimator
            ↓
    Returns IQ estimate + confidence
```

## Integration Steps

### 1. Install Text-to-IQ Estimator

```bash
# In IQGuessr root directory
cd ../text-to-iq-estimator
pip install -r requirements.txt
python setup.py install
```

### 2. Create Integration Script

Create `IQGuessr/text-iq-integration.py`:

```python
"""
Integration bridge for IQGuessr ↔ Text-to-IQ Estimator.
"""

import sys
from pathlib import Path

# Add text-to-iq-estimator to path
estimator_path = Path(__file__).parent.parent / 'text-to-iq-estimator'
sys.path.insert(0, str(estimator_path))

from src.pipeline import TextToIQUnderEstimator

class IQGuessrEstimator:
    """Bridge class for IQGuessr integration."""

    def __init__(self):
        """Initialize the estimator."""
        self.estimator = TextToIQUnderEstimator(
            config_file=str(estimator_path / 'config' / 'config.yaml'),
            mode='prose'
        )

    def analyze_text(self, text: str) -> dict:
        """
        Analyze text and return IQ estimate.

        Args:
            text: Input text to analyze

        Returns:
            Dictionary with IQ estimate and metadata
        """
        result = self.estimator.estimate(text)

        # Format for IQGuessr
        if result.get('is_valid'):
            return {
                'success': True,
                'iq_estimate': result.get('iq_estimate', 100),
                'confidence': self._compute_confidence(result),
                'method': 'text-to-iq-estimator',
                'features_used': self._get_features_used(result),
                'cwr_baseline': result.get('cwr_baseline'),
            }
        else:
            return {
                'success': False,
                'error': result.get('error', 'Unknown error'),
            }

    def _compute_confidence(self, result: dict) -> float:
        """Compute confidence score (0-100)."""
        # Simple heuristic based on text quality
        features = result.get('features', {})
        if 'stylometry' in features:
            # Higher lexical diversity → higher confidence
            stylo = features['stylometry']
            if 'ttr' in stylo.get('stylometry_features', {}):
                ttr = stylo['stylometry_features']['ttr']
                return min(100, max(0, ttr * 200))  # Scale TTR to confidence

        return 50.0  # Default moderate confidence

    def _get_features_used(self, result: dict) -> list:
        """Return list of features used."""
        return list(result.get('features', {}).keys())
```

### 3. Call from Chrome Extension

Update `content/content.js`:

```javascript
// content.js

// Initialize estimator (called once)
let estimatorReady = false;

// Load estimator if available
function initEstimator() {
    // For now, use browser local storage or pass to background
    estimatorReady = true;
}

// Analyze text from web page
async function analyzePageText() {
    const pageText = document.body.innerText;

    if (!pageText || pageText.length < 200) {
        console.log('Not enough text to analyze');
        return null;
    }

    // Send to background for processing
    return browser.runtime.sendMessage({
        action: 'estimateIQ',
        text: pageText
    });
}

// Listen for messages from popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'analyzePage') {
        analyzePageText().then(result => {
            sendResponse(result);
        });
        return true; // Keep channel open for async
    }
});
```

### 4. Background Processing

Update `background/background.js`:

```javascript
// background.js

// Handle IQ estimation requests
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'estimateIQ') {
        // Call Python script via Native Messaging or REST API
        estimateIQFromText(message.text)
            .then(result => sendResponse(result))
            .catch(error => {
                console.error('IQ estimation error:', error);
                sendResponse({success: false, error: error.message});
            });

        return true; // Keep channel open
    }
});

// Native messaging to Python (if set up)
function estimateIQFromText(text) {
    // Option 1: Use Native Messaging
    // (requires Chrome native messaging setup)

    // Option 2: Use REST API
    return fetch('http://localhost:5000/estimate', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({text: text})
    })
    .then(response => response.json());
}
```

### 5. Create REST API Server

Create `text-to-iq-estimator/server.py`:

```python
"""
REST API server for Text-to-IQ Estimator.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from src.pipeline import TextToIQUnderEstimator

app = Flask(__name__)
CORS(app)  # Enable CORS for Chrome extension

estimator = TextToIQUnderEstimator()

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({'status': 'healthy'}), 200

@app.route('/estimate', methods=['POST'])
def estimate():
    """Estimate IQ from text."""
    try:
        data = request.json
        text = data.get('text', '')

        if not text:
            return jsonify({'error': 'No text provided'}), 400

        # Estimate
        result = estimator.estimate(text)

        if result.get('is_valid'):
            return jsonify({
                'success': True,
                'iq_estimate': result.get('iq_estimate'),
                'cwr_baseline': result.get('cwr_baseline'),
                'confidence_interval': [result.get('iq_estimate') - 10,
                                       result.get('iq_estimate') + 10],
            }), 200
        else:
            return jsonify({
                'success': False,
                'error': result.get('error', 'Unknown error')
            }), 400

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
```

### 6. Start Server

```bash
# In terminal
cd text-to-iq-estimator
python server.py
```

### 7. Display Results in Popup

Update `popup/popup.js`:

```javascript
// popup.js

async function updateResults() {
    try {
        // Get current tab
        const tabs = await browser.tabs.query({active: true, currentWindow: true});
        const tab = tabs[0];

        // Request analysis from content script
        const result = await browser.tabs.sendMessage(tab.id, {
            action: 'analyzePage'
        });

        if (result && result.success) {
            displayIQEstimate(result);
        } else {
            displayError(result.error || 'Could not analyze page');
        }
    } catch (error) {
        console.error('Error:', error);
        displayError('Could not analyze page');
    }
}

function displayIQEstimate(result) {
    const container = document.getElementById('results');
    container.innerHTML = `
        <div class="iq-display">
            <h2>IQ Estimate</h2>
            <div class="iq-value">${Math.round(result.iq_estimate)}</div>
            <div class="confidence">
                Confidence: ${result.confidence}%
            </div>
            <div class="method">
                Method: ${result.method}
            </div>
            ${result.cwr_baseline ?
                `<div class="baseline">CWR Baseline: ${Math.round(result.cwr_baseline)}</div>`
                : ''}
            <div class="interval">
                Range: ${Math.round(result.confidence_interval[0])} - ${Math.round(result.confidence_interval[1])}
            </div>
        </div>
    `;
}
```

## Testing

### Test Local Integration

```bash
# In one terminal: start API server
cd text-to-iq-estimator
python server.py

# In another terminal: test the API
curl -X POST http://localhost:5000/estimate \
  -H "Content-Type: application/json" \
  -d '{"text": "The empirical investigation demonstrates sophistication."}'
```

### Test Chrome Extension

1. Load extension in Chrome (Developer Mode)
2. Navigate to a page with substantial text
3. Click extension icon
4. Verify IQ estimate displays

## Alternative: Client-Side Implementation

If you prefer not to run a server, you can:

1. Pre-compute features offline
2. Use TensorFlow.js for embedding computation
3. Load a compressed model in the extension
4. Run inference entirely in the browser

(More complex but fully client-side)

## Next Steps

1. Train on real data with known IQ labels
2. Calibrate model for your specific use case
3. Add bias monitoring
4. Implement confidence intervals
5. Add user feedback loop for improvement

## Security Considerations

- Never expose API publicly without authentication
- Sanitize user inputs
- Rate limit API calls
- Monitor for abuse
- Consider data privacy regulations (GDPR, etc.)

## Support

See `DEPLOYMENT.md` for deployment best practices.

