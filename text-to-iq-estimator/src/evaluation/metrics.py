"""
Evaluation metrics module.
"""

import numpy as np
from typing import Dict
from scipy.stats import pearsonr, spearmanr


def compute_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
    """
    Compute evaluation metrics.

    Args:
        y_true: True labels
        y_pred: Predictions

    Returns:
        Dictionary of metrics
    """
    mse = np.mean((y_true - y_pred) ** 2)
    rmse = np.sqrt(mse)
    mae = np.mean(np.abs(y_true - y_pred))

    # R-squared
    ss_res = np.sum((y_true - y_pred) ** 2)
    ss_tot = np.sum((y_true - np.mean(y_true)) ** 2)
    r2 = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0

    # Correlations
    pearson_r, pearson_p = pearsonr(y_true, y_pred) if len(y_true) > 1 else (0, 0)
    spearman_rho, spearman_p = spearmanr(y_true, y_pred) if len(y_true) > 1 else (0, 0)

    return {
        'mse': mse,
        'rmse': rmse,
        'mae': mae,
        'r2': r2,
        'pearson_r': pearson_r,
        'pearson_p': pearson_p,
        'spearman_rho': spearman_rho,
        'spearman_p': spearman_p,
    }


def compute_correlation(y1: np.ndarray, y2: np.ndarray) -> Dict[str, float]:
    """
    Compute correlation between two vectors.

    Args:
        y1: First vector
        y2: Second vector

    Returns:
        Correlation metrics
    """
    if len(y1) < 2:
        return {'pearson_r': 0, 'pearson_p': 1, 'spearman_rho': 0, 'spearman_p': 1}

    pearson_r, pearson_p = pearsonr(y1, y2)
    spearman_rho, spearman_p = spearmanr(y1, y2)

    return {
        'pearson_r': pearson_r,
        'pearson_p': pearson_p,
        'spearman_rho': spearman_rho,
        'spearman_p': spearman_p,
    }

