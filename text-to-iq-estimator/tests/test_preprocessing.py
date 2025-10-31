"""Tests for text preprocessing."""

import unittest
from src.preprocessing import TextPreprocessor


class TestTextPreprocessor(unittest.TestCase):
    """Test cases for TextPreprocessor."""

    def setUp(self):
        """Set up test fixtures."""
        self.preprocessor = TextPreprocessor(min_length_tokens=10)

    def test_basic_preprocessing(self):
        """Test basic preprocessing."""
        text = "This is a test sentence with multiple words."
        result = self.preprocessor.preprocess(text)

        self.assertTrue(result['is_valid'])
        self.assertGreater(result['metadata']['num_tokens'], 0)

    def test_url_stripping(self):
        """Test URL stripping."""
        text = "Visit https://example.com for more info."
        result = self.preprocessor.preprocess(text)

        self.assertNotIn('https://example.com', result['processed_text'])

    def test_min_length_check(self):
        """Test minimum length validation."""
        text = "Short."
        result = self.preprocessor.preprocess(text)

        self.assertFalse(result['is_valid'])
        self.assertIn('too short', result['reason'].lower())


if __name__ == '__main__':
    unittest.main()

