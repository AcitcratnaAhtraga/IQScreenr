"""
Evaluation modules.
"""

from .metrics import compute_metrics, compute_correlation
from .fairness import evaluate_fairness, compute_dif

__all__ = ["compute_metrics", "compute_correlation", "evaluate_fairness", "compute_dif"]

