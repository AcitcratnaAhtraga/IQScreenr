"""Tests for feature extraction."""

import unittest
from src.features import CWRFeatureExtractor


class TestFeatureExtractors(unittest.TestCase):
    """Test cases for feature extractors."""

    def setUp(self):
        """Set up test fixtures."""
        self.cwr_extractor = CWRFeatureExtractor(
            background_corpus_mean=0.15,
            background_corpus_std=0.05
        )

    def test_cwr_extraction(self):
        """Test CWR feature extraction."""
        text = "The empirical investigation demonstrates sophistication."
        result = self.cwr_extractor.extract_features(text)

        self.assertIn('cwr_baseline', result)
        self.assertIn('cwr', result['cwr_baseline'])


if __name__ == '__main__':
    unittest.main()

