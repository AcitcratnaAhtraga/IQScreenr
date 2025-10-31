"""
Collegiate Word Ratio (CWR) baseline feature extractor.

Implements the methodology from Hendrix & Yampolskiy, 2017:
- Compute CWR over academic lexicon
- Z-score calibration using background corpus
- Direct mapping: IQ = 100 + 15×z
"""

import logging
from pathlib import Path
from typing import Dict, List, Optional
import re

logger = logging.getLogger(__name__)


class CWRFeatureExtractor:
    """
    Extract Collegiate Word Ratio features for IQ estimation baseline.

    Method from Hendrix & Yampolskiy (2017): "Collegiate Word Ratio
    as a Predictor of Cognitive Ability"
    """

    def __init__(
        self,
        lexicon_file: Optional[str] = None,
        background_corpus_mean: float = 0.15,
        background_corpus_std: float = 0.05,
        use_lemmatization: bool = True,
        use_stemming: bool = False,
    ):
        """
        Initialize CWR feature extractor.

        Args:
            lexicon_file: Path to academic lexicon file
            background_corpus_mean: Mean CWR from background corpus
            background_corpus_std: Std dev CWR from background corpus
            use_lemmatization: Whether to lemmatize words before matching
            use_stemming: Whether to stem words before matching
        """
        self.background_mean = background_corpus_mean
        self.background_std = background_corpus_std
        self.use_lemmatization = use_lemmatization
        self.use_stemming = use_stemming

        # Load lexicon
        self.lexicon = set()
        if lexicon_file and Path(lexicon_file).exists():
            self._load_lexicon(lexicon_file)
        else:
            logger.warning(f"Lexicon file not found: {lexicon_file}. Using empty lexicon.")

        logger.info(f"Loaded {len(self.lexicon)} words from lexicon")

    def _load_lexicon(self, lexicon_file: str):
        """Load academic lexicon from file."""
        try:
            with open(lexicon_file, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#'):
                        # Add word in various forms
                        self.lexicon.add(line.lower())
                        self.lexicon.add(line.upper())
                        self.lexicon.add(line.capitalize())
        except Exception as e:
            logger.error(f"Error loading lexicon: {e}")
            self.lexicon = set()

    def _normalize_word(self, word: str) -> str:
        """
        Normalize word for lexicon matching.

        Args:
            word: Input word

        Returns:
            Normalized word
        """
        # Remove punctuation and lowercase
        word = re.sub(r'[^\w\s]', '', word).lower()

        # Simple stemming (remove common suffixes)
        if self.use_stemming and len(word) > 3:
            suffixes = ['ing', 'ed', 'er', 'est', 'ly', 's', 'es']
            for suffix in suffixes:
                if word.endswith(suffix):
                    word = word[:-len(suffix)]
                    break

        return word

    def compute_cwr(self, tokens: List[str]) -> Dict[str, float]:
        """
        Compute Collegiate Word Ratio.

        Args:
            tokens: List of tokenized words

        Returns:
            Dictionary with CWR features
        """
        if not tokens:
            return {
                "cwr": 0.0,
                "z_score": 0.0,
                "iq_estimate": 100.0,
                "num_collegiate_words": 0,
                "total_words": 0,
            }

        total_words = len(tokens)
        collegiate_count = 0
        collegiate_words = []

        # Count collegiate words
        for token in tokens:
            normalized = self._normalize_word(token)
            if normalized in self.lexicon or any(
                normalized.startswith(col_word) or col_word.startswith(normalized)
                for col_word in self.lexicon
            ):
                collegiate_count += 1
                collegiate_words.append(token)

        # Compute CWR
        cwr = collegiate_count / total_words if total_words > 0 else 0.0

        # Compute z-score
        if self.background_std > 0:
            z_score = (cwr - self.background_mean) / self.background_std
        else:
            z_score = 0.0

        # Compute IQ estimate
        iq_estimate = 100 + 15 * z_score

        return {
            "cwr": cwr,
            "z_score": z_score,
            "iq_estimate": iq_estimate,
            "num_collegiate_words": collegiate_count,
            "total_words": total_words,
            "collegiate_words": collegiate_words[:20],  # Sample for debugging
        }

    def extract_features(self, text: str) -> Dict[str, any]:
        """
        Extract CWR features from text.

        Args:
            text: Input text

        Returns:
            Dictionary with CWR features
        """
        # Tokenize
        tokens = text.split()

        # Compute CWR
        cwr_features = self.compute_cwr(tokens)

        return {
            "cwr_baseline": cwr_features,
            "feature_name": "cwr",
        }

    def get_feature_names(self) -> List[str]:
        """Return list of feature names."""
        return [
            "cwr",
            "z_score",
            "iq_estimate",
            "num_collegiate_words",
            "total_words",
        ]


if __name__ == "__main__":
    # Example usage
    extractor = CWRFeatureExtractor(
        lexicon_file="config/academic_lexicon.txt",
        background_corpus_mean=0.15,
        background_corpus_std=0.05,
    )

    test_text = """
    The empirical investigation demonstrates a significant correlation between
    sophisticated vocabulary acquisition and cognitive aptitude assessments.
    """

    result = extractor.extract_features(test_text)
    print("\nCWR Features:")
    print(f"CWR: {result['cwr_baseline']['cwr']:.4f}")
    print(f"Z-score: {result['cwr_baseline']['z_score']:.2f}")
    print(f"IQ Estimate: {result['cwr_baseline']['iq_estimate']:.1f}")
    print(f"Collegiate words: {result['cwr_baseline']['num_collegiate_words']}")

