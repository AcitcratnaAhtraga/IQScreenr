"""
Calibrate dependency depth approximation by comparing Python (real) vs JavaScript (approximated) values.

This script:
1. Runs Python estimator on test samples to get real dependency depths
2. Calculates JavaScript approximations for same samples
3. Fits a calibration function to map approximation -> real depth
"""

import json
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

import numpy as np
from scipy.optimize import minimize
from src.pipeline import TextToIQUnderEstimator
from src.utils import load_graded_samples

def calculate_js_approximation(text):
    """Calculate JavaScript-style dependency depth approximation."""
    import re

    # Extract sentences
    sentences = re.split(r'[.!?]+', text)
    sentences = [s.strip() for s in sentences if s.strip()]

    if not sentences:
        return 0

    # Count punctuation
    commas = text.count(',')
    semicolons = text.count(';')
    colons = text.count(':')
    dashes = len(re.findall(r'[—–-]', text))
    parentheses = len(re.findall(r'[()]', text)) / 2

    total_punct = commas + semicolons + colons + dashes + parentheses
    punct_per_sentence = total_punct / len(sentences) if sentences else 0

    # Count subordinate clauses
    subordinate_markers = [
        'which', 'that', 'who', 'whom', 'whose', 'where', 'when', 'why',
        'although', 'though', 'because', 'since', 'while', 'whereas', 'if',
        'unless', 'until', 'before', 'after', 'whether', 'however', 'therefore',
        'furthermore', 'moreover', 'nevertheless', 'consequently'
    ]

    text_lower = text.lower()
    clause_count = 0
    for marker in subordinate_markers:
        clause_count += len(re.findall(rf'\b{marker}\b', text_lower))

    clauses_per_sentence = clause_count / len(sentences) if sentences else 0

    # Current approximation formula
    estimated_depth = 1.795 + (punct_per_sentence * 0.3) + (clauses_per_sentence * 0.2)

    return estimated_depth, punct_per_sentence, clauses_per_sentence

def calibrate_coefficients(real_depths, approximated_depths, punct_features, clause_features):
    """Find optimal coefficients for approximation."""

    def error_function(coeffs):
        """Calculate RMSE of approximation."""
        intercept, punct_coeff, clause_coeff = coeffs
        predicted = intercept + (punct_features * punct_coeff) + (clause_features * clause_coeff)
        mse = np.mean((predicted - real_depths) ** 2)
        return np.sqrt(mse)

    # Initial guess: current coefficients
    initial = [1.795, 0.3, 0.2]

    # Optimize
    result = minimize(error_function, initial, method='Nelder-Mead')

    return result.x, result.fun

def main():
    """Main calibration function."""
    print("Calibrating Dependency Depth Approximation")
    print("=" * 60)

    # Load test samples
    samples = load_graded_samples()
    print(f"Loaded {len(samples)} test samples\n")

    # Initialize Python estimator
    print("Loading Python estimator...")
    estimator = TextToIQUnderEstimator('config/config.yaml')

    # Get real dependency depths
    print("\nExtracting real dependency depths from Python estimator...")
    real_depths = []
    approximated_depths = []
    punct_features = []
    clause_features = []
    texts = []

    for sample in samples:
        text = sample['text']
        texts.append(text)

        # Get real depth from Python
        result = estimator.estimate(text)
        features = result.get('all_features', {})
        stylo = features.get('stylometry', {}).get('stylometry_features', {})
        real_depth = stylo.get('avg_dependency_depth', 1.795)

        if real_depth is None or real_depth == 0:
            real_depth = 1.795  # Default

        real_depths.append(real_depth)

        # Calculate JavaScript approximation
        est_depth, punct, clauses = calculate_js_approximation(text)
        approximated_depths.append(est_depth)
        punct_features.append(punct)
        clause_features.append(clauses)

    # Convert to numpy arrays
    real_depths = np.array(real_depths)
    approximated_depths = np.array(approximated_depths)
    punct_features = np.array(punct_features)
    clause_features = np.array(clause_features)

    print(f"\nReal dependency depths range: {real_depths.min():.3f} - {real_depths.max():.3f}")
    print(f"Approximated depths range: {approximated_depths.min():.3f} - {approximated_depths.max():.3f}")

    # Calibrate coefficients
    print("\nCalibrating coefficients...")
    coeffs, rmse = calibrate_coefficients(real_depths, approximated_depths, punct_features, clause_features)
    intercept, punct_coeff, clause_coeff = coeffs

    print(f"\nCalibration Results:")
    print(f"  Intercept (baseline): {intercept:.3f} (was 1.795)")
    print(f"  Punctuation coefficient: {punct_coeff:.3f} (was 0.3)")
    print(f"  Clause coefficient: {clause_coeff:.3f} (was 0.2)")
    print(f"  RMSE: {rmse:.3f}")

    # Calculate improvement
    old_rmse = np.sqrt(np.mean((approximated_depths - real_depths) ** 2))
    improvement = ((old_rmse - rmse) / old_rmse) * 100
    print(f"\n  Old RMSE: {old_rmse:.3f}")
    print(f"  Improvement: {improvement:.1f}%")

    # Save calibration
    calibration = {
        'intercept': float(intercept),
        'punctuation_coefficient': float(punct_coeff),
        'clause_coefficient': float(clause_coeff),
        'rmse': float(rmse),
        'old_rmse': float(old_rmse),
        'improvement_percent': float(improvement)
    }

    output_path = Path(__file__).parent.parent.parent / 'content' / 'data' / 'dependency_depth_calibration.json'
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, 'w') as f:
        json.dump(calibration, f, indent=2)

    print(f"\n✅ Saved calibration to: {output_path}")

    return calibration

if __name__ == '__main__':
    main()

