"""
I/O utilities for data handling.
"""

import pickle
import json
from pathlib import Path
from typing import Any, Dict, List
import pandas as pd


def load_data(filepath: str, format: str = "auto") -> Any:
    """
    Load data from file.

    Args:
        filepath: Path to file
        format: File format ("auto", "csv", "json", "pkl")

    Returns:
        Loaded data
    """
    path = Path(filepath)

    if format == "auto":
        format = path.suffix[1:]  # Remove dot

    if format == "csv":
        return pd.read_csv(path)
    elif format == "json":
        with open(path, 'r') as f:
            return json.load(f)
    elif format == "pkl":
        with open(path, 'rb') as f:
            return pickle.load(f)
    else:
        raise ValueError(f"Unsupported format: {format}")


def save_data(data: Any, filepath: str, format: str = "auto"):
    """
    Save data to file.

    Args:
        data: Data to save
        filepath: Output path
        format: File format ("auto", "csv", "json", "pkl")
    """
    path = Path(filepath)
    path.parent.mkdir(parents=True, exist_ok=True)

    if format == "auto":
        format = path.suffix[1:]

    if format == "csv":
        data.to_csv(path, index=False)
    elif format == "json":
        with open(path, 'w') as f:
            json.dump(data, f, indent=2)
    elif format == "pkl":
        with open(path, 'wb') as f:
            pickle.dump(data, f)
    else:
        raise ValueError(f"Unsupported format: {format}")

