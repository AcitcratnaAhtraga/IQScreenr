"""
Quick start example for Text-to-IQ Estimator.

Demonstrates basic usage of the estimator for both prose and vocabulary modes.
"""

import logging
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.pipeline import TextToIQUnderEstimator
from src.utils.logging import setup_logging

# Setup logging
setup_logging(level="INFO")

def example_prose_mode():
    """Example using prose mode."""
    print("\n" + "="*60)
    print("EXAMPLE 1: Prose Mode - IQ Estimation from Free Text")
    print("="*60)

    # Initialize estimator
    estimator = TextToIQUnderEstimator(
        config_file='config/config.yaml',
        mode='prose'
    )

    # Relax min length for demo
    estimator.preprocessor.min_length_tokens = 100

    # Sample text (longer to meet minimum token requirement)
    text = """
    The empirical investigation demonstrates a significant correlation between
    sophisticated vocabulary acquisition and cognitive aptitude assessments.
    Lexical diversity serves as a robust predictor of verbal intelligence.
    Moreover, the analysis reveals complex patterns in linguistic structures.
    The comprehensive study examined numerous texts from various domains,
    ranging from academic journals to casual communications. Researchers
    discovered that vocabulary sophistication metrics effectively distinguish
    between different cognitive ability levels. These findings support the
    hypothesis that linguistic markers provide valid indicators of intellectual
    capacity. The methodological approach combined quantitative analysis with
    qualitative insights, ensuring robust statistical reliability across
    diverse population samples. Furthermore, the longitudinal research tracked
    participants over extended periods, revealing stable correlations between
    linguistic indicators and measured intelligence quotients. The sophisticated
    analytical framework integrated multiple computational approaches, including
    machine learning algorithms that processed vast corpora of written materials.
    Statistical validation procedures confirmed the reliability of vocabulary-based
    estimations across various demographic groups and educational backgrounds.
    """

    # Estimate IQ
    result = estimator.estimate(text)

    print(f"\nInput text length: {len(text)} characters")
    print(f"IQ Estimate: {result.get('iq_estimate', 'N/A')}")
    print(f"CWR Baseline: {result.get('cwr_baseline', 'N/A')}")

    if result.get('is_valid'):
        print("\n✓ Estimation successful")
    else:
        print(f"\n✗ Estimation failed: {result.get('error', 'Unknown error')}")


def example_vocab_mode():
    """Example using vocabulary mode."""
    print("\n" + "="*60)
    print("EXAMPLE 2: Vocabulary Mode - WASI-II Style Assessment")
    print("="*60)

    # Initialize estimator
    estimator = TextToIQUnderEstimator(
        config_file='config/config.yaml',
        mode='prose'
    )

    # Sample vocabulary test items
    vocab_items = [
        {
            'word': 'perspicacious',
            'response': 'able to understand things quickly and clearly',
            'exemplars': {
                0: ['able to fly', 'a type of animal', 'something old'],
                1: ['having keen insight', 'smart person', 'intelligent'],
                2: ['showing clear understanding', 'having good judgement', 'acute perception'],
            }
        },
        {
            'word': 'ephemeral',
            'response': 'lasting for a very short time',
            'exemplars': {
                0: ['long lasting', 'permanent', 'forever'],
                1: ['temporary', 'brief moment', 'not long'],
                2: ['lasting briefly', 'fleeting', 'transitory'],
            }
        }
    ]

    # Estimate VCI
    result = estimator.estimate_vocab(vocab_items)

    print(f"\nNumber of items: {len(vocab_items)}")
    print(f"Raw score: {result.get('raw_score', 'N/A')}/{result.get('max_score', 'N/A')}")
    print(f"VCI Estimate: {result.get('vci', 'N/A')}")
    print(f"FSIQ-2 Estimate: {result.get('fsiq2', 'N/A')}")

    if 'error' in result:
        print(f"\n✗ Error: {result['error']}")
    else:
        print("\n✓ Assessment complete")


def example_feature_inspection():
    """Example showing detailed feature extraction."""
    print("\n" + "="*60)
    print("EXAMPLE 3: Feature Inspection")
    print("="*60)

    from src.features import CWRFeatureExtractor, StylometryFeatureExtractor

    text = """
    Cognitive assessment through linguistic analysis represents an emerging
    paradigm in computational psychometrics. The lexical sophistication
    demonstrated in academic prose correlates systematically with standardized
    intelligence metrics.
    """

    # Extract CWR features
    cwr_extractor = CWRFeatureExtractor(
        lexicon_file='config/academic_lexicon.txt',
        background_corpus_mean=0.15,
        background_corpus_std=0.05
    )
    cwr_result = cwr_extractor.extract_features(text)

    print("\nCWR Features:")
    if 'cwr_baseline' in cwr_result:
        baseline = cwr_result['cwr_baseline']
        print(f"  CWR: {baseline.get('cwr', 0):.4f}")
        print(f"  Z-score: {baseline.get('z_score', 0):.2f}")
        print(f"  IQ Estimate: {baseline.get('iq_estimate', 0):.1f}")

    # Extract stylometry features
    stylo_extractor = StylometryFeatureExtractor()
    stylo_result = stylo_extractor.extract_features(text)

    print("\nStylometry Features:")
    if 'stylometry_features' in stylo_result:
        features = stylo_result['stylometry_features']
        for key, value in list(features.items())[:10]:  # Show first 10
            if isinstance(value, float):
                print(f"  {key}: {value:.4f}")
            else:
                print(f"  {key}: {value}")


if __name__ == "__main__":
    print("\n" + "="*60)
    print("Text-to-IQ Estimator - Quick Start Examples")
    print("="*60)

    # Run examples
    example_prose_mode()
    example_vocab_mode()
    example_feature_inspection()

    print("\n" + "="*60)
    print("Examples complete!")
    print("="*60)

