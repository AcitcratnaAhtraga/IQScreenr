"""
Stylometry feature extraction module.

Implements linguistic features inspired by Abramov (2018):
- Lexical richness metrics (TTR, MSTTR, MTLD, Yule's K)
- Structural features (POS, syntax, sentence complexity)
- Readability indices (FKGL, SMOG, ARI, LIX)
- Cohesion features (lexical overlap, referentiality)
"""

import logging
import re
from collections import Counter
from typing import Dict, List
import statistics

try:
    import spacy
    SPACY_AVAILABLE = True
except ImportError:
    SPACY_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.warning("spaCy not available. POS and syntax features will be limited.")

try:
    import textstat
    TEXTSTAT_AVAILABLE = True
except ImportError:
    TEXTSTAT_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.warning("textstat not available. Readability indices will be limited.")

logger = logging.getLogger(__name__)


class StylometryFeatureExtractor:
    """
    Extract comprehensive stylometry features.

    Features inspired by Abramov (2018) text-based cognitive assessment work.
    """

    def __init__(
        self,
        compute_ttr: bool = True,
        compute_msttr: bool = True,
        compute_mtld: bool = True,
        compute_yules_k: bool = True,
        compute_length_stats: bool = True,
        compute_punctuation_entropy: bool = True,
        compute_pos_ratios: bool = True,
        compute_dependency_depth: bool = True,
        compute_clause_density: bool = True,
        compute_readability: bool = True,
        compute_lexical_overlap: bool = True,
        compute_referential_coherence: bool = True,
        compute_connectives: bool = True,
    ):
        """
        Initialize stylometry feature extractor.

        Args:
            compute_ttr: Compute Type-Token Ratio
            compute_msttr: Compute Mean Segmental TTR
            compute_mtld: Compute Measure of Textual Lexical Diversity
            compute_yules_k: Compute Yule's K
            compute_length_stats: Compute length statistics
            compute_punctuation_entropy: Compute punctuation entropy
            compute_pos_ratios: Compute POS tag ratios
            compute_dependency_depth: Compute dependency depth
            compute_clause_density: Compute clause density
            compute_readability: Compute readability indices
            compute_lexical_overlap: Compute lexical overlap
            compute_referential_coherence: Compute referential coherence
            compute_connectives: Compute connective density
        """
        self.compute_ttr = compute_ttr
        self.compute_msttr = compute_msttr
        self.compute_mtld = compute_mtld
        self.compute_yules_k = compute_yules_k
        self.compute_length_stats = compute_length_stats
        self.compute_punctuation_entropy = compute_punctuation_entropy
        self.compute_pos_ratios = compute_pos_ratios
        self.compute_dependency_depth = compute_dependency_depth
        self.compute_clause_density = compute_clause_density
        self.compute_readability = compute_readability
        self.compute_lexical_overlap = compute_lexical_overlap
        self.compute_referential_coherence = compute_referential_coherence
        self.compute_connectives = compute_connectives

        # Try to load spaCy model
        self.nlp = None
        if SPACY_AVAILABLE and (self.compute_pos_ratios or self.compute_dependency_depth):
            try:
                self.nlp = spacy.load("en_core_web_sm")
                logger.info("Loaded spaCy model for POS/syntax features")
            except OSError:
                logger.warning("spaCy model not found. Install with: python -m spacy download en_core_web_sm")

    def _tokenize(self, text: str) -> List[str]:
        """Simple tokenization."""
        return text.split()

    def _sentences(self, text: str) -> List[str]:
        """Simple sentence splitting."""
        sentences = re.split(r'[.!?]+\s+', text)
        return [s.strip() for s in sentences if s.strip()]

    def _compute_ttr(self, tokens: List[str]) -> float:
        """Compute Type-Token Ratio."""
        if not tokens:
            return 0.0
        unique_tokens = len(set(tokens))
        return unique_tokens / len(tokens)

    def _compute_msttr(self, tokens: List[str], segment_size: int = 100) -> float:
        """Compute Mean Segmental Type-Token Ratio."""
        if not tokens:
            return 0.0

        segment_ttrs = []
        for i in range(0, len(tokens), segment_size):
            segment = tokens[i:i + segment_size]
            if len(segment) >= segment_size:
                ttr = self._compute_ttr(segment)
                segment_ttrs.append(ttr)

        return statistics.mean(segment_ttrs) if segment_ttrs else 0.0

    def _compute_mtld(self, tokens: List[str]) -> float:
        """Compute Measure of Textual Lexical Diversity."""
        if not tokens:
            return 0.0

        threshold = 0.72
        factor_lengths = []
        current_factor = []
        current_types = set()

        for token in tokens:
            current_factor.append(token)
            current_types.add(token.lower())

            if len(current_factor) > 0:
                ttr = len(current_types) / len(current_factor)
                if ttr < threshold:
                    factor_lengths.append(len(current_factor))
                    current_factor = []
                    current_types = set()

        # Handle remaining factor
        if current_factor:
            factor_lengths.append(len(current_factor))

        return statistics.mean(factor_lengths) if factor_lengths else 0.0

    def _compute_yules_k(self, tokens: List[str]) -> float:
        """Compute Yule's K (vocabulary richness measure)."""
        if not tokens:
            return 0.0

        word_counts = Counter(tokens)
        total_words = len(tokens)

        # Yule's K = 10,000 * (sum(f_i^2) - N) / N^2
        # where f_i is frequency of word i
        sum_fi_squared = sum(count ** 2 for count in word_counts.values())

        if total_words == 0:
            return 0.0

        yules_k = 10000 * (sum_fi_squared - total_words) / (total_words ** 2)
        return yules_k

    def _compute_length_stats(self, text: str, sentences: List[str], tokens: List[str]) -> Dict[str, float]:
        """Compute various length statistics."""
        if not sentences or not tokens:
            return {
                "avg_chars_per_word": 0.0,
                "avg_chars_per_sentence": 0.0,
                "avg_words_per_sentence": 0.0,
                "std_words_per_sentence": 0.0,
                "median_words_per_sentence": 0.0,
            }

        # Character lengths
        avg_chars_per_word = sum(len(token) for token in tokens) / len(tokens)
        avg_chars_per_sentence = sum(len(s) for s in sentences) / len(sentences)

        # Word counts per sentence
        words_per_sentence = [len(s.split()) for s in sentences]
        avg_words_per_sentence = statistics.mean(words_per_sentence)
        std_words_per_sentence = statistics.stdev(words_per_sentence) if len(words_per_sentence) > 1 else 0.0
        median_words_per_sentence = statistics.median(words_per_sentence)

        return {
            "avg_chars_per_word": avg_chars_per_word,
            "avg_chars_per_sentence": avg_chars_per_sentence,
            "avg_words_per_sentence": avg_words_per_sentence,
            "std_words_per_sentence": std_words_per_sentence,
            "median_words_per_sentence": median_words_per_sentence,
        }

    def _compute_punctuation_entropy(self, text: str) -> float:
        """Compute punctuation entropy."""
        punct_chars = [c for c in text if c in '.,;:!?()-[]{}"\'']
        if not punct_chars:
            return 0.0

        punct_counts = Counter(punct_chars)
        total = len(punct_chars)

        # Shannon entropy
        import math
        entropy = -sum(
            (count / total) * math.log2(count / total)
            for count in punct_counts.values()
            if count > 0
        )

        return entropy

    def _compute_pos_ratios(self, text: str) -> Dict[str, float]:
        """Compute POS tag ratios."""
        if not self.nlp:
            return {}

        try:
            doc = self.nlp(text)

            pos_counts = Counter(token.pos_ for token in doc)
            total_tokens = len([t for t in doc if not t.is_punct and not t.is_space])

            if total_tokens == 0:
                return {}

            pos_ratios = {
                f"pos_{pos.lower()}_ratio": count / total_tokens
                for pos, count in pos_counts.items()
            }

            return pos_ratios
        except Exception as e:
            logger.warning(f"Error computing POS ratios: {e}")
            return {}

    def _compute_dependency_depth(self, text: str) -> Dict[str, float]:
        """Compute dependency depth and clause density."""
        if not self.nlp:
            return {}

        try:
            doc = self.nlp(text)

            # Compute average dependency depth per sentence
            depths = []
            for sent in doc.sents:
                # For each token, compute its depth from root
                sent_depths = []
                for token in sent:
                    if token.dep_ != 'ROOT':
                        depth = 0
                        ancestor = token
                        while ancestor.dep_ != 'ROOT':
                            ancestor = ancestor.head
                            depth += 1
                        sent_depths.append(depth)

                if sent_depths:
                    avg_depth = statistics.mean(sent_depths)
                    depths.append(avg_depth)

            result = {}
            if depths:
                result['avg_dependency_depth'] = statistics.mean(depths)
                result['max_dependency_depth'] = max(depths)
            else:
                result['avg_dependency_depth'] = 0.0
                result['max_dependency_depth'] = 0.0

            return result
        except Exception as e:
            logger.warning(f"Error computing dependency depth: {e}")
            return {}

    def _compute_readability(self, text: str) -> Dict[str, float]:
        """Compute readability indices."""
        if not TEXTSTAT_AVAILABLE:
            return {}

        try:
            return {
                "flesch_kincaid": textstat.flesch_kincaid_grade(text),
                "smog": textstat.smog_index(text),
                "ari": textstat.automated_readability_index(text),
                "lix": textstat.lix(text),
            }
        except Exception as e:
            logger.warning(f"Error computing readability: {e}")
            return {}

    def _compute_lexical_overlap(self, sentences: List[str], window: int = 2) -> Dict[str, float]:
        """Compute lexical overlap between adjacent sentences."""
        if len(sentences) < 2:
            return {"avg_lexical_overlap": 0.0}

        overlaps = []
        for i in range(len(sentences) - 1):
            words1 = set(sentences[i].lower().split())
            words2 = set(sentences[i + 1].lower().split())

            if len(words1) == 0 or len(words2) == 0:
                continue

            overlap = len(words1 & words2) / max(len(words1), len(words2))
            overlaps.append(overlap)

        return {
            "avg_lexical_overlap": statistics.mean(overlaps) if overlaps else 0.0,
        }

    def _compute_connectives(self, text: str) -> Dict[str, float]:
        """Compute connective density."""
        connectives = [
            'and', 'but', 'or', 'so', 'because', 'since', 'although',
            'however', 'therefore', 'furthermore', 'moreover', 'nevertheless',
            'thus', 'consequently', 'hence', 'meanwhile', 'additionally'
        ]

        tokens = text.lower().split()
        connective_count = sum(1 for token in tokens if token in connectives)
        connective_density = connective_count / len(tokens) if tokens else 0.0

        return {
            "connective_density": connective_density,
            "connective_count": connective_count,
        }

    def extract_features(self, text: str) -> Dict[str, any]:
        """
        Extract all stylometry features from text.

        Args:
            text: Input text

        Returns:
            Dictionary with stylometry features
        """
        features = {}

        # Tokenize and split sentences
        tokens = self._tokenize(text)
        sentences = self._sentences(text)

        # Lexical features
        if self.compute_ttr:
            features['ttr'] = self._compute_ttr(tokens)

        if self.compute_msttr:
            features['msttr'] = self._compute_msttr(tokens)

        if self.compute_mtld:
            features['mtld'] = self._compute_mtld(tokens)

        if self.compute_yules_k:
            features['yules_k'] = self._compute_yules_k(tokens)

        # Length statistics
        if self.compute_length_stats:
            length_features = self._compute_length_stats(text, sentences, tokens)
            features.update(length_features)

        # Punctuation
        if self.compute_punctuation_entropy:
            features['punct_entropy'] = self._compute_punctuation_entropy(text)

        # POS and syntax
        if self.compute_pos_ratios:
            pos_features = self._compute_pos_ratios(text)
            features.update(pos_features)

        if self.compute_dependency_depth:
            dep_features = self._compute_dependency_depth(text)
            features.update(dep_features)

        # Readability
        if self.compute_readability:
            readability_features = self._compute_readability(text)
            features.update(readability_features)

        # Cohesion
        if self.compute_lexical_overlap:
            overlap_features = self._compute_lexical_overlap(sentences)
            features.update(overlap_features)

        if self.compute_connectives:
            connective_features = self._compute_connectives(text)
            features.update(connective_features)

        return {
            "stylometry_features": features,
            "feature_name": "stylometry",
            "num_features": len(features),
        }

    def get_feature_names(self) -> List[str]:
        """Return list of feature names."""
        names = []

        if self.compute_ttr:
            names.append('ttr')
        if self.compute_msttr:
            names.append('msttr')
        if self.compute_mtld:
            names.append('mtld')
        if self.compute_yules_k:
            names.append('yules_k')
        if self.compute_length_stats:
            names.extend([
                'avg_chars_per_word',
                'avg_chars_per_sentence',
                'avg_words_per_sentence',
                'std_words_per_sentence',
                'median_words_per_sentence',
            ])
        if self.compute_punctuation_entropy:
            names.append('punct_entropy')
        if self.compute_connectives:
            names.extend(['connective_density', 'connective_count'])

        return names


if __name__ == "__main__":
    # Example usage
    extractor = StylometryFeatureExtractor()

    test_text = """
    The empirical investigation demonstrates a significant correlation between
    sophisticated vocabulary acquisition and cognitive aptitude assessments.
    Lexical diversity serves as a robust predictor of verbal intelligence.
    Moreover, the analysis reveals complex patterns in linguistic structures.
    """

    result = extractor.extract_features(test_text)
    print("\nStylometry Features:")
    for key, value in result['stylometry_features'].items():
        print(f"{key}: {value:.4f}" if isinstance(value, float) else f"{key}: {value}")

