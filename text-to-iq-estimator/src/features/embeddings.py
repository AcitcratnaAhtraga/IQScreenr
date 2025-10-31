"""
Embedding-based feature extraction.

Implements dense text embeddings using modern sentence transformers,
inspired by Wolfram (2025) approach.
"""

import logging
from typing import Dict, List, Optional
import numpy as np

try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False
    logging.getLogger(__name__).warning("sentence-transformers not available")

logger = logging.getLogger(__name__)


class EmbeddingFeatureExtractor:
    """
    Extract dense embedding features from text.

    Inspired by Wolfram (2025): uses sentence/paragraph embeddings
    combined with ensemble models for cognitive prediction.
    """

    def __init__(
        self,
        model_name: str = "sentence-transformers/all-mpnet-base-v2",
        compute_paragraph_embedding: bool = True,
        compute_sentence_embeddings: bool = True,
        device: str = "cpu",
    ):
        """
        Initialize embedding feature extractor.

        Args:
            model_name: Name of sentence transformer model
            compute_paragraph_embedding: Whether to compute paragraph-level embedding
            compute_sentence_embeddings: Whether to compute sentence-level embeddings
            device: Device to run model on ('cpu' or 'cuda')
        """
        self.model_name = model_name
        self.compute_paragraph_embedding = compute_paragraph_embedding
        self.compute_sentence_embeddings = compute_sentence_embeddings
        self.device = device

        # Load model
        self.model = None
        if SENTENCE_TRANSFORMERS_AVAILABLE:
            try:
                self.model = SentenceTransformer(model_name, device=device)
                self.embedding_dim = self.model.get_sentence_embedding_dimension()
                logger.info(f"Loaded embedding model: {model_name}, dim={self.embedding_dim}")
            except Exception as e:
                logger.error(f"Error loading embedding model: {e}")
                self.model = None
        else:
            logger.warning("sentence-transformers not available. Embeddings will be dummy.")
            self.embedding_dim = 768  # Default

    def _split_sentences(self, text: str) -> List[str]:
        """Split text into sentences."""
        import re
        sentences = re.split(r'[.!?]+\s+', text)
        return [s.strip() for s in sentences if s.strip()]

    def encode_text(self, text: str) -> Optional[np.ndarray]:
        """
        Encode text to embedding vector.

        Args:
            text: Input text

        Returns:
            Embedding vector or None if model unavailable
        """
        if not self.model:
            # Return dummy embedding
            return np.zeros(self.embedding_dim)

        try:
            embedding = self.model.encode(text, convert_to_numpy=True)
            return embedding
        except Exception as e:
            logger.error(f"Error encoding text: {e}")
            return np.zeros(self.embedding_dim)

    def encode_sentences(self, sentences: List[str]) -> List[np.ndarray]:
        """
        Encode multiple sentences.

        Args:
            sentences: List of sentence strings

        Returns:
            List of embedding vectors
        """
        if not self.model or not sentences:
            return []

        try:
            embeddings = self.model.encode(
                sentences,
                convert_to_numpy=True,
                show_progress_bar=False
            )
            return list(embeddings)
        except Exception as e:
            logger.error(f"Error encoding sentences: {e}")
            return []

    def extract_features(self, text: str) -> Dict:
        """
        Extract embedding features from text.

        Args:
            text: Input text

        Returns:
            Dictionary with embedding features
        """
        features = {}
        raw_embeddings = {}

        # Paragraph-level embedding
        if self.compute_paragraph_embedding:
            para_embedding = self.encode_text(text)
            raw_embeddings['paragraph_embedding'] = para_embedding
            features['paragraph_embedding'] = para_embedding.tolist()

        # Sentence-level embeddings
        if self.compute_sentence_embeddings:
            sentences = self._split_sentences(text)
            if sentences:
                sent_embeddings = self.encode_sentences(sentences)

                if sent_embeddings:
                    # Statistics over sentence embeddings
                    sent_array = np.array(sent_embeddings)

                    # Mean pooling
                    mean_sent_embedding = np.mean(sent_array, axis=0)
                    features['sentence_embedding_mean'] = mean_sent_embedding.tolist()

                    # Max pooling
                    max_sent_embedding = np.max(sent_array, axis=0)
                    features['sentence_embedding_max'] = max_sent_embedding.tolist()

                    # Std dev
                    std_sent_embedding = np.std(sent_array, axis=0)
                    features['sentence_embedding_std'] = std_sent_embedding.tolist()

                    # Number of sentences
                    features['num_sentences'] = len(sentences)

        # Store raw embeddings separately for model input
        raw_embeddings['all_embeddings'] = raw_embeddings.get('paragraph_embedding', np.array([]))

        return {
            "embedding_features": features,
            "raw_embeddings": raw_embeddings,
            "feature_name": "embeddings",
            "embedding_dim": self.embedding_dim,
        }

    def get_feature_names(self) -> List[str]:
        """Return list of feature names."""
        names = []

        if self.compute_paragraph_embedding:
            names.append(f'paragraph_embedding_dim_{self.embedding_dim}')

        if self.compute_sentence_embeddings:
            names.extend([
                f'sentence_embedding_mean_dim_{self.embedding_dim}',
                f'sentence_embedding_max_dim_{self.embedding_dim}',
                f'sentence_embedding_std_dim_{self.embedding_dim}',
                'num_sentences',
            ])

        return names


if __name__ == "__main__":
    # Example usage
    extractor = EmbeddingFeatureExtractor()

    test_text = """
    The empirical investigation demonstrates a significant correlation between
    sophisticated vocabulary acquisition and cognitive aptitude assessments.
    Lexical diversity serves as a robust predictor of verbal intelligence.
    """

    result = extractor.extract_features(test_text)
    print("\nEmbedding Features:")
    print(f"Embedding dim: {result['embedding_dim']}")
    print(f"Has paragraph embedding: {'paragraph_embedding' in result['embedding_features']}")
    print(f"Has sentence embeddings: {'sentence_embedding_mean' in result['embedding_features']}")

