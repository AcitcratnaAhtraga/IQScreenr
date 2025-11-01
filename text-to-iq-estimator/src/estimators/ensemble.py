"""
Ensemble model implementation (SuperLearner).

Implements cross-validated blending approach inspired by Wolfram (2025).
"""

import logging
from typing import Dict, List, Any, Optional, Tuple
import numpy as np

try:
    from sklearn.model_selection import KFold
    from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False
    logger = logging.getLogger(__name__).warning("scikit-learn not available")

from .base_models import BaseModelFactory

logger = logging.getLogger(__name__)


class EnsembleModel:
    """
    SuperLearner ensemble for IQ estimation.

    Implements cross-validated blending with multiple base learners.
    """

    def __init__(
        self,
        base_learners: List[Dict[str, Any]],
        cv_folds: int = 5,
        metric: str = "rmse",
        n_jobs: int = -1,
    ):
        """
        Initialize ensemble model.

        Args:
            base_learners: List of base learner configs
            cv_folds: Number of CV folds
            metric: Metric for optimization
            n_jobs: Number of parallel jobs
        """
        if not SKLEARN_AVAILABLE:
            raise ImportError("scikit-learn required for ensemble models")

        self.base_learners_config = base_learners
        self.cv_folds = cv_folds
        self.metric = metric
        self.n_jobs = n_jobs

        # Create base learners
        self.base_learners = []
        self.learner_names = []
        for config in base_learners:
            for model_type, params in config.items():
                model = BaseModelFactory.create_model(model_type, **params)
                self.base_learners.append(model)
                self.learner_names.append(model_type)

        # Meta-learner for blending
        self.meta_learner = None
        self.is_fitted = False

    def _get_metric_func(self):
        """Get metric function."""
        if self.metric == "rmse":
            return lambda y_true, y_pred: np.sqrt(mean_squared_error(y_true, y_pred))
        elif self.metric == "mse":
            return mean_squared_error
        elif self.metric == "mae":
            return mean_absolute_error
        elif self.metric == "r2":
            return r2_score
        else:
            raise ValueError(f"Unknown metric: {self.metric}")

    def fit(
        self,
        X: np.ndarray,
        y: np.ndarray,
        verbose: bool = True
    ):
        """
        Fit ensemble model using cross-validated blending.

        Args:
            X: Feature matrix
            y: Target values
            verbose: Whether to print progress
        """
        if not SKLEARN_AVAILABLE:
            raise ImportError("scikit-learn required")

        from sklearn.model_selection import KFold
        from sklearn.linear_model import RidgeCV

        n_samples = X.shape[0]
        cv = KFold(n_splits=self.cv_folds, shuffle=True, random_state=42)

        # Get out-of-fold predictions from each base learner
        oof_predictions = np.zeros((n_samples, len(self.base_learners)))

        if verbose:
            logger.info(f"Training ensemble with {len(self.base_learners)} base learners")

        for i, (model, name) in enumerate(zip(self.base_learners, self.learner_names)):
            if verbose:
                logger.info(f"Training base learner {i+1}/{len(self.base_learners)}: {name}")

            fold_predictions = np.zeros(n_samples)

            for fold_idx, (train_idx, val_idx) in enumerate(cv.split(X)):
                X_train, X_val = X[train_idx], X[val_idx]
                y_train, y_val = y[train_idx], y[val_idx]

                # Train on fold
                model.fit(X_train, y_train)

                # Predict on validation fold
                fold_predictions[val_idx] = model.predict(X_val)

            oof_predictions[:, i] = fold_predictions

        # Train final base learners on full data
        for model in self.base_learners:
            model.fit(X, y)

        # Train meta-learner to blend base learner predictions
        # Use Ridge regression with cross-validation
        self.meta_learner = RidgeCV(alphas=np.logspace(-3, 3, 20), cv=cv)
        self.meta_learner.fit(oof_predictions, y)

        self.is_fitted = True

        if verbose:
            logger.info("Ensemble training completed")

    def predict(self, X: np.ndarray) -> np.ndarray:
        """
        Make predictions.

        Args:
            X: Feature matrix

        Returns:
            Predictions
        """
        if not self.is_fitted:
            raise ValueError("Model not fitted. Call fit() first.")

        # Get predictions from each base learner
        base_predictions = np.zeros((X.shape[0], len(self.base_learners)))
        for i, model in enumerate(self.base_learners):
            base_predictions[:, i] = model.predict(X)

        # Blend using meta-learner
        ensemble_prediction = self.meta_learner.predict(base_predictions)

        return ensemble_prediction

    def get_feature_importances(self) -> Dict[str, float]:
        """
        Get feature importances from ensemble.

        Returns:
            Dictionary of feature importances
        """
        if not self.is_fitted:
            return {}

        # Average importances across base learners that support it
        importances = {}
        for name, model in zip(self.learner_names, self.base_learners):
            if hasattr(model, 'feature_importances_'):
                importances[name] = model.feature_importances_
            elif hasattr(model, 'coef_'):
                importances[name] = np.abs(model.coef_)

        return importances

    def get_base_learner_predictions(self, X: np.ndarray) -> np.ndarray:
        """
        Get individual base learner predictions.

        Args:
            X: Feature matrix

        Returns:
            Array of predictions from each base learner
        """
        if not self.is_fitted:
            raise ValueError("Model not fitted. Call fit() first.")

        base_predictions = np.zeros((X.shape[0], len(self.base_learners)))
        for i, model in enumerate(self.base_learners):
            base_predictions[:, i] = model.predict(X)

        return base_predictions

    def evaluate(
        self,
        X: np.ndarray,
        y: np.ndarray
    ) -> Dict[str, float]:
        """
        Evaluate ensemble on test data.

        Args:
            X: Feature matrix
            y: True labels

        Returns:
            Dictionary of metrics
        """
        if not self.is_fitted:
            raise ValueError("Model not fitted. Call fit() first.")

        predictions = self.predict(X)

        from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error

        metrics = {
            'rmse': np.sqrt(mean_squared_error(y, predictions)),
            'mae': mean_absolute_error(y, predictions),
            'r2': r2_score(y, predictions),
            'correlation': np.corrcoef(y, predictions)[0, 1],
        }

        return metrics

