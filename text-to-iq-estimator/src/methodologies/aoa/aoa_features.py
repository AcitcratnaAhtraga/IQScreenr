"""
Age of Acquisition (AoA) feature extractor.

Uses AoA test-based and rating data to compute vocabulary sophistication metrics.
Based on Brysbaert & Biemiller (2017) test-based AoA norms.
"""

import logging
from pathlib import Path
from typing import Dict, List, Optional
import re
import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)


class AoAFeatureExtractor:
    """
    Extract AoA-based vocabulary sophistication features.

    Uses test-based AoA grades (2-14) and adult-rated AoA (years)
    to assess lexical sophistication.
    """

    def __init__(
        self,
        aoa_file: Optional[str] = None,
        use_lemmatization: bool = False,
        use_stemming: bool = False,
    ):
        """
        Initialize AoA feature extractor.

        Args:
            aoa_file: Path to AoA master Excel file
            use_lemmatization: Whether to lemmatize before matching
            use_stemming: Whether to stem before matching
        """
        self.use_lemmatization = use_lemmatization
        self.use_stemming = use_stemming

        # Load AoA data
        self.aoa_df = None
        self.aoa_dict = {}
        self.aoa_rating_dict = {}

        if aoa_file and Path(aoa_file).exists():
            self._load_aoa_data(aoa_file)
        else:
            logger.warning(f"AoA file not found: {aoa_file}")

    def _load_aoa_data(self, aoa_file: str):
        """Load AoA data from Excel file."""
        try:
            self.aoa_df = pd.read_excel(aoa_file)

            # Create dictionaries for fast lookup
            for _, row in self.aoa_df.iterrows():
                word = str(row['WORD']).lower().strip()
                aoa_test = row.get('AoAtestbased', np.nan)
                aoa_rating = row.get('AoArating', np.nan)

                # Store test-based AoA (priority)
                if not pd.isna(aoa_test):
                    if word not in self.aoa_dict:
                        self.aoa_dict[word] = []
                    self.aoa_dict[word].append(aoa_test)

                # Store adult-rated AoA
                if not pd.isna(aoa_rating):
                    if word not in self.aoa_rating_dict:
                        self.aoa_rating_dict[word] = []
                    self.aoa_rating_dict[word].append(aoa_rating)

            logger.info(
                f"Loaded {len(self.aoa_dict):,} words with AoA test-based scores, "
                f"{len(self.aoa_rating_dict):,} words with AoA ratings"
            )
        except Exception as e:
            logger.error(f"Error loading AoA data: {e}")
            self.aoa_df = None
            self.aoa_dict = {}
            self.aoa_rating_dict = {}

    def _normalize_word(self, word: str) -> str:
        """Normalize word for AoA lookup."""
        # Remove punctuation and lowercase
        word = re.sub(r'[^\w\s]', '', word).lower()

        # Simple stemming if enabled
        if self.use_stemming and len(word) > 3:
            suffixes = ['ing', 'ed', 'er', 'est', 'ly', 's', 'es']
            for suffix in suffixes:
                if word.endswith(suffix):
                    word = word[:-len(suffix)]
                    break

        return word

    def _lookup_aoa(self, word: str) -> Optional[float]:
        """Look up AoA value for a word."""
        normalized = self._normalize_word(word)

        if normalized in self.aoa_dict:
            # Return mean if multiple entries
            values = self.aoa_dict[normalized]
            return float(np.mean(values))

        return None

    def _lookup_aoa_rating(self, word: str) -> Optional[float]:
        """Look up adult-rated AoA for a word."""
        normalized = self._normalize_word(word)

        if normalized in self.aoa_rating_dict:
            values = self.aoa_rating_dict[normalized]
            return float(np.mean(values))

        return None

    def extract_features(self, text: str) -> Dict:
        """
        Extract AoA-based features from text.

        Args:
            text: Input text

        Returns:
            Dictionary with AoA features
        """
        if not self.aoa_dict:
            return {
                "aoa_features": {},
                "error": "AoA data not loaded",
                "feature_name": "aoa",
            }

        # Tokenize
        tokens = text.split()
        if not tokens:
            return {
                "aoa_features": {},
                "error": "Empty text",
                "feature_name": "aoa",
            }

        # Collect AoA values for matched words
        aoa_values = []
        aoa_rating_values = []
        matched_words = []

        for token in tokens:
            aoa = self._lookup_aoa(token)
            if aoa is not None:
                aoa_values.append(aoa)
                matched_words.append(token)

                aoa_rating = self._lookup_aoa_rating(token)
                if aoa_rating is not None:
                    aoa_rating_values.append(aoa_rating)

        if not aoa_values:
            return {
                "aoa_features": {
                    "mean_aoa_test": np.nan,
                    "std_aoa_test": np.nan,
                    "median_aoa_test": np.nan,
                    "max_aoa_test": np.nan,
                    "min_aoa_test": np.nan,
                    "pct_advanced_test": 0.0,
                    "match_rate": 0.0,
                    "num_matched": 0,
                    "total_words": len(tokens),
                },
                "feature_name": "aoa",
                "num_matched": 0,
            }

        aoa_array = np.array(aoa_values)

        # Compute statistics
        mean_aoa = float(np.mean(aoa_array))
        std_aoa = float(np.std(aoa_array))
        median_aoa = float(np.median(aoa_array))
        max_aoa = float(np.max(aoa_array))
        min_aoa = float(np.min(aoa_array))

        # Percentage of advanced words (AoA > 10 = college level)
        pct_advanced = float(np.mean(aoa_array > 10)) * 100

        # Match rate
        match_rate = len(aoa_values) / len(tokens) * 100

        # Adult-rated AoA statistics (if available)
        mean_aoa_rating = float(np.mean(aoa_rating_values)) if aoa_rating_values else np.nan
        std_aoa_rating = float(np.std(aoa_rating_values)) if len(aoa_rating_values) > 1 else np.nan

        features = {
            "mean_aoa_test": mean_aoa,
            "std_aoa_test": std_aoa,
            "median_aoa_test": median_aoa,
            "max_aoa_test": max_aoa,
            "min_aoa_test": min_aoa,
            "pct_advanced_test": pct_advanced,
            "match_rate": match_rate,
            "num_matched": len(aoa_values),
            "total_words": len(tokens),
        }

        # Add adult-rated AoA if available
        if not np.isnan(mean_aoa_rating):
            features["mean_aoa_rating"] = mean_aoa_rating
            features["std_aoa_rating"] = std_aoa_rating

        return {
            "aoa_features": features,
            "feature_name": "aoa",
            "matched_words_sample": matched_words[:10],  # For debugging
        }

    def get_feature_names(self) -> List[str]:
        """Return list of feature names."""
        return [
            "mean_aoa_test",
            "std_aoa_test",
            "median_aoa_test",
            "max_aoa_test",
            "min_aoa_test",
            "pct_advanced_test",
            "match_rate",
            "num_matched",
            "total_words",
            "mean_aoa_rating",  # Optional
            "std_aoa_rating",   # Optional
        ]


if __name__ == "__main__":
    # Example usage
    extractor = AoAFeatureExtractor(
        aoa_file="../../IQresearch/Master file with all values for test based AoA measures.xlsx"
    )

    test_text = """
    The empirical investigation demonstrates a significant correlation between
    sophisticated vocabulary acquisition and cognitive aptitude assessments.
    """

    result = extractor.extract_features(test_text)
    print("\nAoA Features:")
    for key, value in result['aoa_features'].items():
        if isinstance(value, float):
            print(f"{key}: {value:.4f}")
        else:
            print(f"{key}: {value}")

