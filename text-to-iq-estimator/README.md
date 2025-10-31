# Text-to-IQ Estimator

A comprehensive system for estimating verbal/fluid IQ from text input using multiple validated methodologies:

1. **CWR Baseline** (Hendrix & Yampolskiy, 2017): Collegiate Word Ratio mapping via z-score calibration
2. **Stylometry Bundle** (Abramov, 2018): Rich linguistic feature extraction (lexical richness, POS, syntax, readability)
3. **Embedding Ensemble** (Wolfram, 2025): Modern ML approach with stacked ensemble models
4. **WASI-II Vocabulary Scorer** (Nnamoko et al., 2024): Automated vocabulary subtest scoring
5. **AoA Vocabulary Sophistication** (Brysbaert & Biemiller, 2017): Age of Acquisition features from 43,991 word norms

## Project Structure

```
text-to-iq-estimator/
├── README.md
├── requirements.txt
├── setup.py
├── config/
│   ├── __init__.py
│   ├── config.yaml
│   └── academic_lexicon.txt
├── src/
│   ├── __init__.py
│   ├── pipeline.py          # Main orchestrator
│   ├── preprocessing.py     # Text QC and normalization
│   ├── features/
│   │   ├── __init__.py
│   │   ├── cwr.py          # Collegiate Word Ratio baseline
│   │   ├── stylometry.py   # Linguistic feature extraction
│   │   ├── embeddings.py   # Dense embedding features
│   │   ├── vocab_scorer.py # WASI-II Vocabulary scorer
│   │   └── aoa_features.py # AoA vocabulary sophistication
│   ├── models/
│   │   ├── __init__.py
│   │   ├── ensemble.py     # SuperLearner ensemble
│   │   ├── calibration.py  # IQ scale calibration
│   │   └── base_models.py  # Individual model components
│   ├── evaluation/
│   │   ├── __init__.py
│   │   ├── metrics.py      # Evaluation metrics
│   │   ├── fairness.py     # Bias and fairness checks
│   │   └── diagnostics.py  # DIF and validity diagnostics
│   └── utils/
│       ├── __init__.py
│       ├── io.py           # Data I/O utilities
│       └── logging.py      # Logging configuration
├── data/
│   ├── raw/                # Raw input texts
│   ├── processed/          # Preprocessed texts
│   ├── features/           # Extracted features
│   ├── models/             # Trained models
│   └── calibration/        # Calibration data
├── notebooks/
│   ├── 01_data_exploration.ipynb
│   ├── 02_feature_analysis.ipynb
│   ├── 03_model_training.ipynb
│   └── 04_evaluation.ipynb
└── tests/
    ├── __init__.py
    ├── test_preprocessing.py
    ├── test_features.py
    ├── test_models.py
    └── test_evaluation.py
```

## Installation

```bash
cd text-to-iq-estimator
pip install -r requirements.txt
python setup.py install
```

## Usage

### Basic Usage

```python
from src.pipeline import TextToIQUnderEstimator

estimator = TextToIQUnderEstimator()
result = estimator.estimate("Your text here...")

print(f"Estimated IQ: {result['iq_estimate']:.1f}")
print(f"95% Prediction Interval: {result['confidence_interval']}")
print(f"CWR Baseline: {result['cwr_baseline']:.1f}")
```

### WASI-II Vocabulary Mode

```python
estimator = TextToIQUnderEstimator(mode='vocab')

# Define vocabulary test items
vocab_items = [
    {"word": "perspicacious", "answers": [
        "able to read minds",  # 0 points
        "having keen insight",  # 1 point
        "showing clear understanding"  # 2 points
    ]}
]

result = estimator.estimate_vocab(vocab_items)
print(f"VCI: {result['vci']:.1f}")
print(f"FSIQ-2: {result['fsiq2']:.1f}")
```

## Methodology

### 1. CWR Baseline (Hendrix & Yampolskiy, 2017)

- Compute Collegiate Word Ratio over academic lexicon
- Z-score calibration using background corpus
- Direct mapping: IQ = 100 + 15×z

### 2. Stylometry Bundle (Abramov, 2018)

Lexical features:
- Type-Token Ratio variants (MSTTR, MTLD)
- Yule's K
- Age of Acquisition norms
- Concreteness scores

Structural features:
- POS tag ratios
- Dependency parsing depth
- Clause density
- Sentence complexity

Readability indices:
- FKGL (Flesch-Kincaid Grade Level)
- SMOG
- ARI (Automated Readability Index)
- LIX (Readability Index)

Cohesion features:
- Lexical overlap
- Referential coherence
- Connectives density

### 3. Embedding Ensemble (Wolfram, 2025)

- Dense text embeddings (sentence/paragraph level)
- Stacked ensemble: ElasticNet + GradientBoosting + RandomForest + MLP
- Cross-validated blending (SuperLearner)
- Near test-retest reliability

### 4. WASI-II Vocabulary Scorer (Nnamoko et al., 2024)

- Automated scoring via cosine similarity to 0/1/2-point exemplars
- Word2Vec embedding approach (r≈0.61 vs manual)
- Raw score → VCI conversion using published tables
- VCI → FSIQ-2 mapping

## Evaluation

Run comprehensive evaluation:

```bash
python -m src.evaluation.metrics
python -m src.evaluation.fairness
python -m src.evaluation.diagnostics
```

## Governance & Ethics

⚠️ **Clinical Disclaimer**: This system is for **screening and estimation purposes only**. It should **NOT** substitute for professional neuropsychological assessment.

- Position as estimation with error bars
- Report differential item functioning (DIF)
- Stratified calibration by age, education, L1/L2
- Monitor for systematic biases
- Transparent reporting of confidence intervals

## License

[Specify license]

## Citation

If you use this system, please cite:

- Hendrix, P., & Yampolskiy, R. V. (2017). Collegiate Word Ratio as a Predictor of Cognitive Ability
- Abramov, A. (2018). Text-Based Cognitive Assessment via Stylometry
- Nnamoko, et al. (2024). Automated WASI-II Vocabulary Scoring
- Wolfram (2025). LLM-Based Cognitive Prediction

## Contact

[Your contact information]

