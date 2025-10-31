"""
Base model factory for ensemble construction.

Implements individual learners for the SuperLearner ensemble.
"""

import logging
from typing import Dict, Any, List

try:
    from sklearn.linear_model import ElasticNet
    from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
    from sklearn.neural_network import MLPRegressor
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

logger = logging.getLogger(__name__)


class BaseModelFactory:
    """Factory for creating base models for ensemble."""

    @staticmethod
    def create_elasticnet(**params) -> Any:
        """
        Create ElasticNet model.

        Args:
            **params: Model parameters

        Returns:
            ElasticNet model instance
        """
        if not SKLEARN_AVAILABLE:
            raise ImportError("scikit-learn not available")

        default_params = {
            'alpha': 0.1,
            'l1_ratio': 0.5,
            'max_iter': 1000,
        }
        default_params.update(params)

        return ElasticNet(**default_params)

    @staticmethod
    def create_gradient_boosting(**params) -> Any:
        """
        Create GradientBoostingRegressor model.

        Args:
            **params: Model parameters

        Returns:
            GradientBoostingRegressor instance
        """
        if not SKLEARN_AVAILABLE:
            raise ImportError("scikit-learn not available")

        default_params = {
            'n_estimators': 100,
            'learning_rate': 0.1,
            'max_depth': 5,
            'subsample': 0.8,
        }
        default_params.update(params)

        return GradientBoostingRegressor(**default_params)

    @staticmethod
    def create_random_forest(**params) -> Any:
        """
        Create RandomForestRegressor model.

        Args:
            **params: Model parameters

        Returns:
            RandomForestRegressor instance
        """
        if not SKLEARN_AVAILABLE:
            raise ImportError("scikit-learn not available")

        default_params = {
            'n_estimators': 200,
            'max_depth': 15,
            'min_samples_split': 5,
            'min_samples_leaf': 2,
        }
        default_params.update(params)

        return RandomForestRegressor(**default_params)

    @staticmethod
    def create_mlp(**params) -> Any:
        """
        Create MLPRegressor model.

        Args:
            **params: Model parameters

        Returns:
            MLPRegressor instance
        """
        if not SKLEARN_AVAILABLE:
            raise ImportError("scikit-learn not available")

        default_params = {
            'hidden_layer_sizes': (128, 64, 32),
            'learning_rate_init': 0.001,
            'max_iter': 300,
            'early_stopping': True,
        }
        default_params.update(params)

        return MLPRegressor(**default_params)

    @staticmethod
    def create_model(model_type: str, **params) -> Any:
        """
        Create model by type name.

        Args:
            model_type: Type of model to create
            **params: Model parameters

        Returns:
            Model instance
        """
        creators = {
            'elasticnet': BaseModelFactory.create_elasticnet,
            'gradient_boosting': BaseModelFactory.create_gradient_boosting,
            'random_forest': BaseModelFactory.create_random_forest,
            'mlp': BaseModelFactory.create_mlp,
        }

        creator = creators.get(model_type.lower())
        if not creator:
            raise ValueError(f"Unknown model type: {model_type}")

        return creator(**params)

    @staticmethod
    def get_available_models() -> List[str]:
        """Get list of available model types."""
        return ['elasticnet', 'gradient_boosting', 'random_forest', 'mlp']

