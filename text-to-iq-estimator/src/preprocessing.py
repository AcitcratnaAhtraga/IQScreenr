"""
Text preprocessing and quality control module.

Handles language detection, normalization, filtering, and basic QC heuristics.
"""

import re
import logging
from typing import Optional, Dict, List

logger = logging.getLogger(__name__)


class TextPreprocessor:
    """Handles text preprocessing and quality control."""

    def __init__(
        self,
        min_length_tokens: int = 200,
        min_length_vocab: int = 15,
        strip_urls: bool = True,
        strip_code: bool = True,
        strip_quotes: bool = True,
        normalize_unicode: bool = True,
        language: str = "en",
    ):
        """
        Initialize the text preprocessor.

        Args:
            min_length_tokens: Minimum token count for free prose
            min_length_vocab: Minimum token count for vocabulary mode
            strip_urls: Whether to remove URLs
            strip_code: Whether to remove code blocks
            strip_quotes: Whether to remove quotes
            normalize_unicode: Whether to normalize Unicode characters
            language: Expected language code
        """
        self.min_length_tokens = min_length_tokens
        self.min_length_vocab = min_length_vocab
        self.strip_urls = strip_urls
        self.strip_code = strip_code
        self.strip_quotes = strip_quotes
        self.normalize_unicode = normalize_unicode
        self.language = language

        # Compile regex patterns
        self.url_pattern = re.compile(
            r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+'
        )
        self.code_pattern = re.compile(r'```[\s\S]*?```|`[^`]*`')
        self.quote_pattern = re.compile(r'[""\u201C\u201D]|[''\u2018\u2019]')

    def detect_language(self, text: str) -> Optional[str]:
        """
        Detect text language.

        Args:
            text: Input text

        Returns:
            Language code or None if detection fails
        """
        # Simple heuristic: check for common English words
        # In production, use langdetect or similar
        common_english = [
            'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that',
            'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he'
        ]

        words = text.lower().split()
        english_count = sum(1 for word in words[:100] if word in common_english)

        if english_count > 10:
            return 'en'

        return 'unknown'

    def _normalize_unicode(self, text: str) -> str:
        """
        Normalize Unicode characters.

        Args:
            text: Input text

        Returns:
            Normalized text
        """
        # Normalize common Unicode quotes and dashes
        replacements = {
            '\u201C': '"', '\u201D': '"',  # Smart quotes
            '\u2018': "'", '\u2019': "'",  # Smart apostrophes
            '\u2013': '-', '\u2014': '--',  # En/em dashes
            '\u2026': '...',  # Ellipsis
        }

        for old, new in replacements.items():
            text = text.replace(old, new)

        return text

    def _strip_urls(self, text: str) -> str:
        """Remove URLs from text."""
        return self.url_pattern.sub(' ', text)

    def _strip_code(self, text: str) -> str:
        """Remove code blocks from text."""
        return self.code_pattern.sub(' ', text)

    def _strip_quotes(self, text: str) -> str:
        """Remove quotes from text."""
        return self.quote_pattern.sub(' ', text)

    def preprocess(
        self,
        text: str,
        mode: str = "prose"
    ) -> Dict[str, any]:
        """
        Preprocess text with quality control.

        Args:
            text: Input text
            mode: Processing mode ("prose" or "vocab")

        Returns:
            Dictionary with processed text and metadata
        """
        if not text or not isinstance(text, str):
            return {
                "processed_text": "",
                "is_valid": False,
                "reason": "Empty or invalid input",
                "metadata": {}
            }

        # Store original
        original_text = text
        original_length = len(text)

        # Apply normalization
        if self.normalize_unicode:
            text = self._normalize_unicode(text)

        # Apply stripping filters
        if self.strip_urls:
            text = self._strip_urls(text)
        if self.strip_code:
            text = self._strip_code(text)
        if self.strip_quotes:
            text = self._strip_quotes(text)

        # Clean up whitespace
        text = re.sub(r'\s+', ' ', text).strip()

        # Tokenize (simple split for now)
        tokens = text.split()
        num_tokens = len(tokens)

        # Quality control
        is_valid = True
        reason = ""

        # Check length
        min_length = self.min_length_vocab if mode == "vocab" else self.min_length_tokens
        if num_tokens < min_length:
            is_valid = False
            reason = f"Text too short: {num_tokens} tokens (minimum: {min_length})"

        # Check for repeated characters (possible spam)
        if num_tokens > 0:
            repeat_ratio = sum(
                1 for word in tokens
                if len(set(word.lower())) <= 2 and len(word) > 2
            ) / num_tokens
            if repeat_ratio > 0.3:
                is_valid = False
                reason = f"High repetition detected: {repeat_ratio:.2%}"

        # Detect language
        detected_lang = self.detect_language(text)
        lang_match = (detected_lang == self.language or
                     detected_lang == 'unknown' and self.language == 'en')

        metadata = {
            "original_length": original_length,
            "processed_length": len(text),
            "num_tokens": num_tokens,
            "language_detected": detected_lang,
            "language_match": lang_match,
            "strips_applied": {
                "urls": self.strip_urls,
                "code": self.strip_code,
                "quotes": self.strip_quotes,
            }
        }

        return {
            "processed_text": text if is_valid else "",
            "original_text": original_text,
            "is_valid": is_valid,
            "reason": reason,
            "metadata": metadata,
        }

    def tokenize(self, text: str) -> List[str]:
        """
        Simple tokenization.

        Args:
            text: Input text

        Returns:
            List of tokens
        """
        return text.split()


if __name__ == "__main__":
    # Example usage
    preprocessor = TextPreprocessor()

    test_text = "This is a sample text. It contains various words and phrases."
    result = preprocessor.preprocess(test_text)

    print("Preprocessing result:")
    print(f"Valid: {result['is_valid']}")
    print(f"Tokens: {result['metadata']['num_tokens']}")
    print(f"Text: {result['processed_text'][:100]}...")

