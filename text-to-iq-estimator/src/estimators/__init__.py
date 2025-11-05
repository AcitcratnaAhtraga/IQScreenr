"""
IQ Estimation and Combination Modules.

Contains methods for combining methodology features into IQ estimates:
- ensemble: SuperLearner ensemble (requires training)
- knowledge_based_iq: Research-calibrated estimator (no training needed)
- rule_based_ensemble: Simple weighted combination
- calibration: Post-hoc IQ calibration
- base_models: Base model factory for ensembles
"""

from .knowledge_based_iq import KnowledgeBasedIQEstimator
from .rule_based_ensemble import RuleBasedEnsemble
from .ensemble import EnsembleModel
from .base_models import BaseModelFactory

__all__ = [
    "KnowledgeBasedIQEstimator",
    "RuleBasedEnsemble",
    "EnsembleModel",
    "BaseModelFactory",
]












