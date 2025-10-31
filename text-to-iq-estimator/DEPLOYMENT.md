# Deployment Guide

## Overview

This guide covers how to deploy and use the Text-to-IQ Estimator system for integration with the IQGuessr project.

## Prerequisites

- Python 3.9+
- pip
- (Optional) GPU for faster embedding computation

## Installation

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Download spaCy Model

For POS tagging and dependency parsing:

```bash
python -m spacy download en_core_web_sm
```

### 3. Setup Configuration

Copy and customize the configuration file:

```bash
cp config/config.yaml config/config.local.yaml
# Edit config.local.yaml with your settings
```

## Integration with IQGuessr

### Option 1: Direct Python Integration

In your IQGuessr codebase, import and use the estimator:

```python
import sys
sys.path.append('/path/to/text-to-iq-estimator')

from src.pipeline import TextToIQUnderEstimator

# Initialize
estimator = TextToIQUnderEstimator(
    config_file='text-to-iq-estimator/config/config.yaml',
    mode='prose'
)

# Estimate IQ from text
result = estimator.estimate(user_text)
iq_estimate = result['iq_estimate']
```

### Option 2: REST API (To Be Implemented)

Create an API wrapper:

```python
from flask import Flask, request, jsonify
from src.pipeline import TextToIQUnderEstimator

app = Flask(__name__)
estimator = TextToIQUnderEstimator()

@app.route('/estimate', methods=['POST'])
def estimate_iq():
    data = request.json
    text = data.get('text')
    result = estimator.estimate(text)
    return jsonify(result)
```

### Option 3: Browser Extension Integration

For Chrome extension integration, you may need to:

1. Pre-compute features on the server
2. Load pre-trained models via the extension
3. Use TensorFlow.js or similar for client-side inference

## Training on Your Data

### 1. Prepare Training Data

```python
import pandas as pd

# Load your data with IQ labels
df = pd.read_csv('your_data.csv')
# Format: text, true_iq
```

### 2. Extract Features

```python
from src.pipeline import TextToIQUnderEstimator

estimator = TextToIQUnderEstimator()
features_list = []

for text in df['text']:
    result = estimator.estimate(text, return_details=True)
    features_list.append(result['features'])
```

### 3. Train Ensemble Model

```python
from src.models import EnsembleModel
import numpy as np

# Prepare features
X = np.array([extract_features(f) for f in features_list])
y = df['true_iq'].values

# Train
ensemble = EnsembleModel(
    base_learners=[
        {'elasticnet': {'alpha': 0.1}},
        {'gradient_boosting': {'n_estimators': 100}},
        {'random_forest': {'n_estimators': 200}},
        {'mlp': {'hidden_layer_sizes': (128, 64, 32)}},
    ],
    cv_folds=5
)

ensemble.fit(X, y)
```

### 4. Save Model

```python
import pickle

with open('models/trained_ensemble.pkl', 'wb') as f:
    pickle.dump(ensemble, f)
```

## Calibration

For domain-specific calibration:

```python
from src.models.calibration import IQCalibrator

# Train calibrator on your test data
calibrator = IQCalibrator(method='isotonic')
calibrator.fit(y_pred, y_true)

# Apply calibration
y_calibrated = calibrator.transform(y_pred)
```

## Monitoring and Evaluation

### Run Evaluation

```python
from src.evaluation import compute_metrics, evaluate_fairness

# Compute metrics
metrics = compute_metrics(y_true, y_pred)
print(f"RMSE: {metrics['rmse']:.2f}")
print(f"R²: {metrics['r2']:.3f}")

# Check fairness
fairness_results = evaluate_fairness(
    y_true, y_pred,
    groups={'gender': gender_labels, 'age': age_bins}
)
```

## Performance Considerations

1. **Embeddings**: Cache embeddings for repeated texts
2. **Batch Processing**: Process multiple texts in batches
3. **Model Caching**: Load models once and reuse
4. **Async Processing**: Use async I/O for web integration

## Troubleshooting

### Common Issues

1. **spaCy model not found**
   ```bash
   python -m spacy download en_core_web_sm
   ```

2. **Memory issues with embeddings**
   - Use smaller embedding models
   - Process texts in batches
   - Use CPU instead of GPU

3. **Slow processing**
   - Enable caching
   - Use faster embedding models (e.g., all-MiniLM instead of all-mpnet)
   - Disable optional features

## License and Ethics

⚠️ **IMPORTANT REMINDER**: This system is for **research and screening purposes only**. It should **NOT** be used for clinical diagnosis or high-stakes decisions.

- Always report uncertainty estimates
- Disclose limitations to users
- Implement bias monitoring
- Follow institutional review board (IRB) guidelines if needed

## Support

For issues or questions, please open an issue on the project repository.

