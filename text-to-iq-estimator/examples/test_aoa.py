"""
Test script for AoA feature extraction.

Demonstrates the AoA vocabulary sophistication features.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.features import AoAFeatureExtractor

def main():
    print("=" * 70)
    print("AoA Feature Extraction Test")
    print("=" * 70)

    # Initialize extractor with AoA data
    # Update this path to point to your AoA Excel file
    aoa_file = "../../IQresearch/Master file with all values for test based AoA measures.xlsx"

    # Try to find the file from current directory
    from pathlib import Path
    base_path = Path(__file__).parent.parent.parent
    aoa_path = base_path / "IQresearch" / "Master file with all values for test based AoA measures.xlsx"

    if aoa_path.exists():
        extractor = AoAFeatureExtractor(aoa_file=str(aoa_path))
    else:
        print(f"AoA file not found at: {aoa_path}")
        print("Please update the path in test_aoa.py")
        return

    # Test texts of varying sophistication
    test_texts = [
        ("Simple Text",
         "The dog ran fast. It was happy. We had fun. The sun was bright."),

        ("Academic Text",
         "The empirical investigation demonstrates a significant correlation "
         "between sophisticated vocabulary acquisition and cognitive aptitude "
         "assessments. Lexical diversity serves as a robust predictor of "
         "verbal intelligence."),

        ("Advanced Academic Text",
         "The epistemological foundations of cognitive assessment reveal "
         "systematic interactions between metacognitive processes and "
         "lexical sophistication metrics. Phenomenological analyses "
         "underscore the hermeneutical nature of intelligence estimation."),
    ]

    for title, text in test_texts:
        print(f"\n{title}:")
        print(f"Text: '{text[:80]}...'")
        print("-" * 70)

        result = extractor.extract_features(text)

        if 'error' in result:
            print(f"Error: {result['error']}")
            continue

        features = result['aoa_features']

        print(f"Mean AoA (test-based): {features['mean_aoa_test']:.2f} grade levels")
        print(f"Std AoA: {features['std_aoa_test']:.2f}")
        print(f"Median AoA: {features['median_aoa_test']:.2f}")
        print(f"Advanced words (AoA>10): {features['pct_advanced_test']:.1f}%")
        print(f"Match rate: {features['match_rate']:.1f}%")
        print(f"Matched words: {features['num_matched']}/{features['total_words']}")

        if 'mean_aoa_rating' in features and not features['mean_aoa_rating'] is None:
            print(f"Mean AoA (adult-rated): {features['mean_aoa_rating']:.2f} years")

    print("\n" + "=" * 70)
    print("Test complete!")
    print("=" * 70)


if __name__ == "__main__":
    main()

