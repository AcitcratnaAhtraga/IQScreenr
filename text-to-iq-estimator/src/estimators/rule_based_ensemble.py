"""
Rule-based ensemble for combining features without training data.

Uses heuristics and domain knowledge to combine features when training data
is not available.
"""

import logging
from typing import Dict, Any
import numpy as np

logger = logging.getLogger(__name__)


class RuleBasedEnsemble:
    """
    Combines multiple features using rule-based heuristics.

    No training data required - uses domain knowledge from research.
    """

    def __init__(
        self,
        weight_cwr: float = 0.40,
        weight_stylometry: float = 0.30,
        weight_embeddings: float = 0.20,
        weight_aoa: float = 0.10,
    ):
        """
        Initialize rule-based ensemble.

        Args:
            weight_cwr: Weight for CWR baseline
            weight_stylometry: Weight for stylometry features
            weight_embeddings: Weight for embedding features
            weight_aoa: Weight for AoA features
        """
        self.weight_cwr = weight_cwr
        self.weight_stylometry = weight_stylometry
        self.weight_embeddings = weight_embeddings
        self.weight_aoa = weight_aoa

        # Normalize weights
        total = weight_cwr + weight_stylometry + weight_embeddings + weight_aoa
        if total > 0:
            self.weight_cwr /= total
            self.weight_stylometry /= total
            self.weight_embeddings /= total
            self.weight_aoa /= total

    def _extract_cwr_iq(self, features: Dict[str, Any]) -> float:
        """Extract IQ from CWR baseline."""
        if 'cwr' in features and 'cwr_baseline' in features['cwr']:
            return features['cwr']['cwr_baseline'].get('iq_estimate', 100.0)
        return 100.0

    def _estimate_iq_from_stylometry(self, features: Dict[str, Any]) -> float:
        """
        Estimate IQ from stylometry features.

        Uses correlations from research:
        - Higher TTR → higher IQ
        - Longer sentences → higher IQ (to a point)
        - Lower readability → higher IQ (harder text)
        """
        if 'stylometry' not in features:
            return None

        stylo = features['stylometry'].get('stylometry_features', {})
        if not stylo:
            return None

        iq_adjustment = 0

        # TTR adjustment (Type-Token Ratio)
        ttr = stylo.get('ttr', 0.5)
        if ttr > 0:
            # TTR varies 0.3-1.0, correlate with IQ range 90-130
            iq_adjustment += (ttr - 0.5) * 60  # Scale to IQ points

        # Sentence length adjustment
        avg_words = stylo.get('avg_words_per_sentence', 10)
        if avg_words > 0:
            # Optimal sentence length ~12-15 words for complexity
            if 12 <= avg_words <= 20:
                iq_adjustment += (avg_words - 10) * 2

        # Readability adjustment (inverse - harder text = higher IQ)
        # (Not currently computed due to textstat issues, but framework ready)

        base_iq = 100 + iq_adjustment

        # Cap at reasonable range
        return max(70, min(150, base_iq))

    def _estimate_iq_from_aoa(self, features: Dict[str, Any]) -> float:
        """
        Estimate IQ from AoA features.

        Higher AoA → higher vocabulary sophistication → higher IQ.
        """
        if 'aoa' not in features:
            return None

        aoa_features = features['aoa'].get('aoa_features', {})
        if not aoa_features:
            return None

        mean_aoa = aoa_features.get('mean_aoa_test', 8.0)
        pct_advanced = aoa_features.get('pct_advanced_test', 0)

        # AoA typically ranges 2-14
        # Scale to IQ: mean AoA 8 = 100 IQ
        base_iq = 100 + (mean_aoa - 8) * 7

        # Bonus for advanced words
        base_iq += pct_advanced * 0.5

        return max(70, min(150, base_iq))

    def _estimate_iq_from_embeddings(self, features: Dict[str, Any]) -> float:
        """
        Estimate IQ from embeddings.

        Note: Embeddings are hard to interpret without training.
        For now, use as a small adjustment based on magnitude.
        """
        if 'embeddings' not in features:
            return None

        # Placeholder: could use embedding statistics
        # For now, don't use embeddings without training
        return None

    def combine(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """
        Combine all features into IQ estimate.

        Args:
            features: Dictionary of extracted features

        Returns:
            Dictionary with combined IQ estimate and breakdown
        """
        # Get IQ estimates from each feature
        iq_cwr = self._extract_cwr_iq(features)
        iq_stylometry = self._estimate_iq_from_stylometry(features)
        iq_aoa = self._estimate_iq_from_aoa(features)
        iq_embeddings = self._estimate_iq_from_embeddings(features)

        # Collect available estimates
        estimates = {}
        weights = {}

        estimates['cwr'] = iq_cwr
        weights['cwr'] = self.weight_cwr

        if iq_stylometry is not None:
            estimates['stylometry'] = iq_stylometry
            weights['stylometry'] = self.weight_stylometry

        if iq_aoa is not None:
            estimates['aoa'] = iq_aoa
            weights['aoa'] = self.weight_aoa

        if iq_embeddings is not None:
            estimates['embeddings'] = iq_embeddings
            weights['embeddings'] = self.weight_embeddings

        # Re-normalize weights based on what's available
        total_weight = sum(weights.values())
        if total_weight > 0:
            weights = {k: v / total_weight for k, v in weights.items()}

        # Weighted average
        combined_iq = sum(estimates[k] * weights[k] for k in estimates.keys())

        # Confidence: higher if more features agree
        if len(estimates) > 1:
            std_dev = np.std(list(estimates.values()))
            confidence = max(50, 100 - std_dev * 2)  # Lower std = higher confidence
        else:
            confidence = 70  # Lower confidence with single feature

        return {
            'combined_iq': combined_iq,
            'confidence': confidence,
            'estimates_by_method': estimates,
            'weights_used': weights,
            'num_methods': len(estimates),
        }

