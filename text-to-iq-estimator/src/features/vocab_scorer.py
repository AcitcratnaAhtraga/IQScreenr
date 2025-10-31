"""
WASI-II Vocabulary automated scorer.

Implements methodology from Nnamoko et al. (2024):
- Automated scoring via cosine similarity to 0/1/2-point exemplars
- Word2Vec embedding approach (r≈0.61 vs manual)
"""

import logging
from typing import Dict, List, Optional, Tuple
import numpy as np

try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False

logger = logging.getLogger(__name__)


class WASIVocabScorer:
    """
    Automated WASI-II Vocabulary subtest scorer.

    Based on Nnamoko et al. (2024) cosine similarity approach.
    """

    def __init__(
        self,
        embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2",
        cosine_threshold_1pt: float = 0.3,
        cosine_threshold_2pt: float = 0.5,
        device: str = "cpu",
    ):
        """
        Initialize WASI-II Vocabulary scorer.

        Args:
            embedding_model: Embedding model to use
            cosine_threshold_1pt: Minimum cosine similarity for 1 point
            cosine_threshold_2pt: Minimum cosine similarity for 2 points
            device: Device to run model on
        """
        self.threshold_1pt = cosine_threshold_1pt
        self.threshold_2pt = cosine_threshold_2pt
        self.device = device

        # Load embedding model
        self.model = None
        if SENTENCE_TRANSFORMERS_AVAILABLE:
            try:
                self.model = SentenceTransformer(embedding_model, device=device)
                logger.info(f"Loaded embedding model: {embedding_model}")
            except Exception as e:
                logger.error(f"Error loading embedding model: {e}")

    def encode(self, text: str) -> np.ndarray:
        """
        Encode text to embedding.

        Args:
            text: Input text

        Returns:
            Embedding vector
        """
        if not self.model:
            raise ValueError("Embedding model not loaded")

        return self.model.encode(text, convert_to_numpy=True)

    def cosine_similarity(self, vec1: np.ndarray, vec2: np.ndarray) -> float:
        """
        Compute cosine similarity between two vectors.

        Args:
            vec1: First vector
            vec2: Second vector

        Returns:
            Cosine similarity score
        """
        # Normalize vectors
        vec1_norm = vec1 / (np.linalg.norm(vec1) + 1e-8)
        vec2_norm = vec2 / (np.linalg.norm(vec2) + 1e-8)

        return float(np.dot(vec1_norm, vec2_norm))

    def score_response(
        self,
        word: str,
        response: str,
        exemplars: Dict[int, List[str]]
    ) -> Tuple[int, Dict[str, float]]:
        """
        Score a vocabulary response.

        Args:
            word: The target word
            response: The response to score
            exemplars: Dictionary mapping score (0/1/2) to example responses

        Returns:
            Tuple of (score, similarity_details)
        """
        if not self.model:
            # Dummy scoring
            return 0, {"error": "Model not loaded"}

        try:
            # Encode the actual response
            response_embedding = self.encode(response.lower())

            # Encode exemplars and compute similarities
            similarities = {}
            best_score = 0
            best_similarity = -1

            for score, examples in exemplars.items():
                if not examples:
                    continue

                # Encode all exemplars for this score
                example_embeddings = [self.encode(ex.lower()) for ex in examples]

                # Compute max similarity to any exemplar
                similarities_to_score = [
                    self.cosine_similarity(response_embedding, ex_emb)
                    for ex_emb in example_embeddings
                ]
                max_similarity = max(similarities_to_score)
                similarities[f"score_{score}"] = max_similarity

                # Update best match
                if max_similarity > best_similarity:
                    best_similarity = max_similarity
                    best_score = score

            # Apply thresholds for final scoring
            # Per Nnamoko et al., we use thresholds to determine score
            if best_similarity >= self.threshold_2pt:
                final_score = 2
            elif best_similarity >= self.threshold_1pt:
                final_score = 1
            else:
                final_score = 0

            return final_score, similarities

        except Exception as e:
            logger.error(f"Error scoring response: {e}")
            return 0, {"error": str(e)}

    def score_vocab_test(
        self,
        test_items: List[Dict[str, any]]
    ) -> Dict[str, any]:
        """
        Score a complete vocabulary test.

        Args:
            test_items: List of test items, each with 'word', 'response',
                       and 'exemplars'

        Returns:
            Dictionary with raw score, VCI, and details
        """
        total_score = 0
        item_scores = []

        for item in test_items:
            word = item['word']
            response = item['response']
            exemplars = item.get('exemplars', {})

            score, similarities = self.score_response(word, response, exemplars)
            total_score += score

            item_scores.append({
                'word': word,
                'response': response,
                'score': score,
                'similarities': similarities,
            })

        # Convert raw score to VCI
        # Note: This requires the WASI-II manual conversion table
        # For now, we use a placeholder
        vci_estimate = self._raw_to_vci(total_score, num_items=len(test_items))

        return {
            'raw_score': total_score,
            'max_possible_score': 2 * len(test_items),
            'vci_estimate': vci_estimate,
            'item_scores': item_scores,
            'num_items': len(test_items),
        }

    def _raw_to_vci(self, raw_score: int, num_items: int) -> float:
        """
        Convert raw vocabulary score to VCI estimate.

        Note: This is a placeholder. The actual conversion requires
        WASI-II manual tables and age-based norms.

        Args:
            raw_score: Raw vocabulary score
            num_items: Number of test items

        Returns:
            VCI estimate
        """
        # Placeholder linear mapping
        # Actual mapping should use WASI-II tables
        percentage = raw_score / (2 * num_items) if num_items > 0 else 0

        # Rough estimate: 50th percentile = 100, std=15
        # This is NOT clinically valid - for demonstration only
        z_score = (percentage - 0.5) * 3  # Rough mapping
        vci = 100 + 15 * z_score

        return vci


if __name__ == "__main__":
    # Example usage
    scorer = WASIVocabScorer()

    test_items = [
        {
            'word': 'perspicacious',
            'response': 'able to understand things quickly',
            'exemplars': {
                0: ['able to fly', 'a type of animal'],
                1: ['having keen insight', 'smart person'],
                2: ['showing clear understanding', 'having good judgement'],
            }
        }
    ]

    result = scorer.score_vocab_test(test_items)
    print("\nWASI-II Vocabulary Scoring:")
    print(f"Raw Score: {result['raw_score']}/{result['max_possible_score']}")
    print(f"VCI Estimate: {result['vci_estimate']:.1f}")

