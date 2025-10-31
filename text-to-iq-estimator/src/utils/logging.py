"""
Logging configuration.
"""

import logging
import sys
from pathlib import Path


def setup_logging(
    level: str = "INFO",
    log_file: str = None,
    format_string: str = None
):
    """
    Setup logging configuration.

    Args:
        level: Logging level
        log_file: Optional log file path
        format_string: Custom format string
    """
    from typing import Optional

    log_level = getattr(logging, level.upper(), logging.INFO)

    if format_string is None:
        format_string = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'

    handlers = [logging.StreamHandler(sys.stdout)]

    if log_file:
        log_path = Path(log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        handlers.append(logging.FileHandler(log_file))

    logging.basicConfig(
        level=log_level,
        format=format_string,
        handlers=handlers
    )

    logging.info("Logging configured successfully")

