"""
Fairness evaluation and bias detection.
"""

import numpy as np
from typing import Dict, List, Optional
import pandas as pd


def evaluate_fairness(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    groups: Dict[str, np.ndarray]
) -> Dict[str, any]:
    """
    Evaluate fairness across groups.

    Args:
        y_true: True labels
        y_pred: Predictions
        groups: Dictionary of group membership arrays

    Returns:
        Fairness metrics
    """
    results = {}

    for group_name, group_labels in groups.items():
        group_metrics = {}

        # Compute metrics for each group value
        unique_groups = np.unique(group_labels)

        for group_val in unique_groups:
            mask = group_labels == group_val
            if np.sum(mask) < 2:
                continue

            group_true = y_true[mask]
            group_pred = y_pred[mask]

            # Compute errors
            errors = np.abs(group_true - group_pred)

            group_metrics[f"group_{group_val}"] = {
                'n': int(np.sum(mask)),
                'mean_error': float(np.mean(errors)),
                'std_error': float(np.std(errors)),
                'max_error': float(np.max(errors)),
                'rmse': float(np.sqrt(np.mean(errors ** 2))),
            }

        # Compare across groups
        if len(unique_groups) >= 2:
            mean_errors = []
            for group_val in unique_groups:
                mask = group_labels == group_val
                if np.sum(mask) < 2:
                    continue
                errors = np.abs(y_true[mask] - y_pred[mask])
                mean_errors.append(np.mean(errors))

            if mean_errors:
                max_diff = max(mean_errors) - min(mean_errors)
                group_metrics['max_error_difference'] = max_diff

        results[group_name] = group_metrics

    return results


def compute_dif(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    groups: Dict[str, np.ndarray]
) -> Dict[str, any]:
    """
    Compute Differential Item Functioning (DIF).

    Args:
        y_true: True labels
        y_pred: Predictions
        groups: Dictionary of group membership arrays

    Returns:
        DIF statistics
    """
    return evaluate_fairness(y_true, y_pred, groups)

