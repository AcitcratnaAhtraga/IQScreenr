"""
Main pipeline orchestrator for Text-to-IQ estimation.

Coordinates preprocessing, feature extraction, modeling, and calibration.
"""

import logging
import yaml
from pathlib import Path
from typing import Dict, List, Optional, Any
import numpy as np

from .preprocessing import TextPreprocessor
from .features import (
    CWRFeatureExtractor,
    StylometryFeatureExtractor,
    EmbeddingFeatureExtractor,
    WASIVocabScorer,
    AoAFeatureExtractor
)
from .models import EnsembleModel
from .models.calibration import IQCalibrator

logger = logging.getLogger(__name__)


class TextToIQUnderEstimator:
    """
    Main Text-to-IQ estimation pipeline.

    Orchestrates preprocessing, feature extraction, modeling, and calibration.
    """

    def __init__(
        self,
        config_file: Optional[str] = None,
        mode: str = "prose"
    ):
        """
        Initialize the estimator.

        Args:
            config_file: Path to configuration file
            mode: Processing mode ("prose" or "vocab")
        """
        self.mode = mode
        self.config = self._load_config(config_file) if config_file else {}

        # Initialize components
        self.preprocessor = self._init_preprocessor()
        self.feature_extractors = self._init_feature_extractors()
        self.model = None
        self.calibrator = None

        logger.info(f"Initialized TextToIQUnderEstimator in {mode} mode")

    def _load_config(self, config_file: str) -> Dict:
        """Load configuration from file."""
        try:
            with open(config_file, 'r') as f:
                config = yaml.safe_load(f)
            logger.info(f"Loaded configuration from {config_file}")
            return config
        except Exception as e:
            logger.error(f"Error loading config: {e}")
            return {}

    def _init_preprocessor(self) -> TextPreprocessor:
        """Initialize preprocessor."""
        proc_config = self.config.get('processing', {})

        return TextPreprocessor(
            min_length_tokens=proc_config.get('min_length_tokens', 200),
            min_length_vocab=proc_config.get('min_length_vocab', 15),
            strip_urls=proc_config.get('strip_urls', True),
            strip_code=proc_config.get('strip_code', True),
            strip_quotes=proc_config.get('strip_quotes', True),
            normalize_unicode=proc_config.get('normalize_unicode', True),
            language=proc_config.get('language', 'en'),
        )

    def _init_feature_extractors(self) -> Dict[str, Any]:
        """Initialize feature extractors."""
        extractors = {}
        features_config = self.config.get('features', {})

        # CWR baseline
        if features_config.get('cwr', {}).get('enabled', True):
            cwr_config = features_config.get('cwr', {})
            extractors['cwr'] = CWRFeatureExtractor(
                lexicon_file=cwr_config.get('lexicon_file'),
                background_corpus_mean=cwr_config.get('background_corpus_mean', 0.15),
                background_corpus_std=cwr_config.get('background_corpus_std', 0.05),
                use_lemmatization=cwr_config.get('use_lemmatization', True),
            )

        # Stylometry
        if features_config.get('stylometry', {}).get('enabled', True):
            stylo_config = features_config.get('stylometry', {})
            extractors['stylometry'] = StylometryFeatureExtractor(
                compute_ttr=stylo_config.get('compute_ttr', True),
                compute_msttr=stylo_config.get('compute_msttr', True),
                compute_mtld=stylo_config.get('compute_mtld', True),
                compute_yules_k=stylo_config.get('compute_yules_k', True),
                compute_length_stats=stylo_config.get('compute_length_stats', True),
                compute_punctuation_entropy=stylo_config.get('compute_punctuation_entropy', True),
                compute_pos_ratios=stylo_config.get('compute_pos_ratios', True),
                compute_readability=stylo_config.get('compute_flesch_kincaid', True) or
                                  stylo_config.get('compute_smog', True) or
                                  stylo_config.get('compute_ari', True),
                compute_lexical_overlap=stylo_config.get('compute_lexical_overlap', True),
                compute_connectives=stylo_config.get('compute_connectives', True),
            )

        # Embeddings
        if features_config.get('embeddings', {}).get('enabled', True):
            emb_config = features_config.get('embeddings', {})
            extractors['embeddings'] = EmbeddingFeatureExtractor(
                model_name=emb_config.get('model_name', 'sentence-transformers/all-mpnet-base-v2'),
                compute_paragraph_embedding=emb_config.get('compute_paragraph_embedding', True),
                compute_sentence_embeddings=emb_config.get('compute_sentence_embeddings', True),
                device=emb_config.get('device', 'cpu'),
            )

        # WASI-II Vocabulary scorer
        if features_config.get('vocab_scorer', {}).get('enabled', True):
            vocab_config = features_config.get('vocab_scorer', {})
            extractors['vocab'] = WASIVocabScorer(
                embedding_model=vocab_config.get('embedding_model', 'sentence-transformers/all-MiniLM-L6-v2'),
                cosine_threshold_1pt=vocab_config.get('cosine_threshold_1pt', 0.3),
                cosine_threshold_2pt=vocab_config.get('cosine_threshold_2pt', 0.5),
                device=vocab_config.get('device', 'cpu'),
            )

        # AoA features
        if features_config.get('aoa', {}).get('enabled', True):
            aoa_config = features_config.get('aoa', {})
            extractors['aoa'] = AoAFeatureExtractor(
                aoa_file=aoa_config.get('aoa_file'),
                use_lemmatization=aoa_config.get('use_lemmatization', False),
                use_stemming=aoa_config.get('use_stemming', False),
            )

        logger.info(f"Initialized {len(extractors)} feature extractors")
        return extractors

    def estimate(
        self,
        text: str,
        return_details: bool = True
    ) -> Dict[str, Any]:
        """
        Estimate IQ from text.

        Args:
            text: Input text
            return_details: Whether to return detailed features

        Returns:
            Dictionary with IQ estimate and details
        """
        # Preprocess
        preprocessed = self.preprocessor.preprocess(text, mode=self.mode)

        if not preprocessed['is_valid']:
            return {
                'iq_estimate': None,
                'error': preprocessed['reason'],
                'is_valid': False,
            }

        processed_text = preprocessed['processed_text']

        # Extract features
        all_features = {}
        raw_features_dict = {}

        for name, extractor in self.feature_extractors.items():
            if name == 'vocab':  # Skip vocab scorer for prose mode
                continue

            try:
                result = extractor.extract_features(processed_text)
                all_features[name] = result
            except Exception as e:
                logger.error(f"Error extracting {name} features: {e}")
                all_features[name] = {'error': str(e)}

        # Get CWR baseline (if available)
        cwr_baseline = None
        if 'cwr' in all_features and 'cwr_baseline' in all_features['cwr']:
            cwr_baseline = all_features['cwr']['cwr_baseline'].get('iq_estimate', 100.0)

        # For now, use CWR baseline as main estimate
        # In production, would use trained ensemble model
        iq_estimate = cwr_baseline if cwr_baseline else 100.0

        result = {
            'iq_estimate': iq_estimate,
            'is_valid': True,
            'cwr_baseline': cwr_baseline,
        }

        if return_details:
            result['preprocessing'] = preprocessed['metadata']
            result['features'] = all_features

        return result

    def estimate_vocab(
        self,
        vocab_items: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Estimate VCI using WASI-II Vocabulary approach.

        Args:
            vocab_items: List of vocabulary test items

        Returns:
            Dictionary with VCI/FSIQ estimates
        """
        if 'vocab' not in self.feature_extractors:
            return {
                'error': 'WASI-II Vocabulary scorer not available',
                'vci': None,
                'fsiq2': None,
            }

        try:
            scorer = self.feature_extractors['vocab']
            result = scorer.score_vocab_test(vocab_items)

            return {
                'vci': result['vci_estimate'],
                'fsiq2': result['vci_estimate'],  # Placeholder - would need matrix reasoning
                'raw_score': result['raw_score'],
                'max_score': result['max_possible_score'],
                'item_details': result['item_scores'],
            }
        except Exception as e:
            logger.error(f"Error in vocabulary estimation: {e}")
            return {
                'error': str(e),
                'vci': None,
                'fsiq2': None,
            }


if __name__ == "__main__":
    # Example usage
    import logging
    logging.basicConfig(level=logging.INFO)

    estimator = TextToIQUnderEstimator(
        config_file='config/config.yaml',
        mode='prose'
    )

    test_text = """
    The empirical investigation demonstrates a significant correlation between
    sophisticated vocabulary acquisition and cognitive aptitude assessments.
    Lexical diversity serves as a robust predictor of verbal intelligence.
    """

    result = estimator.estimate(test_text)
    print("\nIQ Estimation Result:")
    print(f"IQ Estimate: {result['iq_estimate']:.1f}")
    print(f"CWR Baseline: {result.get('cwr_baseline', 'N/A')}")

