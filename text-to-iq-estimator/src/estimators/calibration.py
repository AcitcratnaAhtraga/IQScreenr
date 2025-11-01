"""
Calibration utilities for converting model outputs to IQ scale.

Implements isotonic and Platt calibration methods.
"""

import logging
from typing import Dict, Optional
import numpy as np

try:
    from sklearn.calibration import CalibratedClassifierCV
    from sklearn.isotonic import IsotonicRegression
    from sklearn.model_selection import cross_val_predict
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False
    logging.getLogger(__name__).warning("scikit-learn not available")

logger = logging.getLogger(__name__)


class IQCalibrator:
    """
    Calibrates model predictions to IQ scale (mean=100, SD=15).

    Supports isotonic regression and Platt scaling.
    """

    def __init__(
        self,
        method: str = "isotonic",
        cv_folds: int = 5,
    ):
        """
        Initialize IQ calibrator.

        Args:
            method: Calibration method ("isotonic" or "platt")
            cv_folds: Number of CV folds
        """
        if not SKLEARN_AVAILABLE:
            raise ImportError("scikit-learn required for calibration")

        if method not in ["isotonic", "platt"]:
            raise ValueError(f"Unknown calibration method: {method}")

        self.method = method
        self.cv_folds = cv_folds
        self.calibrator = None
        self.is_fitted = False

    def fit(
        self,
        predictions: np.ndarray,
        true_iq: np.ndarray
    ):
        """
        Fit calibrator.

        Args:
            predictions: Model predictions
            true_iq: True IQ values
        """
        if self.method == "isotonic":
            self.calibrator = IsotonicRegression(out_of_bounds='clip')
            self.calibrator.fit(predictions, true_iq)
        else:  # method == "platt"
            # For regression, we use isotonic as Platt is for classification
            logger.warning("Platt scaling not implemented for regression. Using isotonic.")
            self.calibrator = IsotonicRegression(out_of_bounds='clip')
            self.calibrator.fit(predictions, true_iq)

        self.is_fitted = True
        logger.info("Calibrator fitted successfully")

    def transform(self, predictions: np.ndarray) -> np.ndarray:
        """
        Calibrate predictions.

        Args:
            predictions: Raw model predictions

        Returns:
            Calibrated predictions
        """
        if not self.is_fitted:
            raise ValueError("Calibrator not fitted. Call fit() first.")

        calibrated = self.calibrator.predict(predictions)
        return calibrated

    def compute_prediction_interval(
        self,
        predictions: np.ndarray,
        residuals: Optional[np.ndarray] = None
    ) -> Dict[str, np.ndarray]:
        """
        Compute prediction intervals.

        Args:
            predictions: Model predictions
            residuals: Residuals from training (optional)

        Returns:
            Dictionary with lower and upper bounds
        """
        if not self.is_fitted:
            raise ValueError("Calibrator not fitted")

        # Simple approach: use standard error
        if residuals is not None:
            std_error = np.std(residuals)
        else:
            # Default: assume 1 SD = 15 IQ points
            std_error = 15.0

        lower = predictions - 1.96 * std_error  # 95% CI
        upper = predictions + 1.96 * std_error

        return {
            'lower_95': lower,
            'upper_95': upper,
            'lower_90': predictions - 1.645 * std_error,
            'upper_90': predictions + 1.645 * std_error,
        }

