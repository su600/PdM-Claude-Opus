"""Time-series forecasting using Holt's double exponential smoothing.

Decomposes each metric into level + trend components, then extrapolates
to predict when metrics will cross danger thresholds.  The earliest
predicted crossing determines the RUL.
"""

from __future__ import annotations

import numpy as np

from app.db.models import AlgorithmOutput

from .base import (
    DEFAULT_THRESHOLDS,
    METRIC_DIRECTION,
    METRIC_KEYS,
    NO_DATA_CONFIDENCE,
    NO_DATA_DETAIL,
    NO_DATA_RISK,
    NO_DATA_RUL,
    clamp,
    telemetry_to_matrix,
)


def _holt_smooth(series: np.ndarray, alpha: float, beta: float) -> tuple[float, float]:
    """Apply Holt's linear trend method.

    Returns (level, trend) at the end of the series.
    """
    if len(series) < 2:
        return float(series[0]) if len(series) == 1 else (0.0, 0.0)

    level = float(series[0])
    trend = float(series[1] - series[0])

    for i in range(1, len(series)):
        new_level = alpha * float(series[i]) + (1 - alpha) * (level + trend)
        new_trend = beta * (new_level - level) + (1 - beta) * trend
        level = new_level
        trend = new_trend

    return level, trend


def _forecast_steps_to_threshold(level: float, trend: float, threshold: float,
                                  direction: int, max_steps: int = 10000) -> float | None:
    """Estimate how many steps until the forecasted value crosses the threshold.

    direction=1: crossing happens when value > threshold (increasing trend)
    direction=-1: crossing happens when value < threshold (decreasing trend)

    Returns None if crossing is not predicted within max_steps.
    """
    if abs(trend) < 1e-12:
        return None

    if direction > 0:
        # danger when value > threshold
        if level >= threshold:
            return 0.0
        if trend <= 0:
            return None  # moving away from danger
        steps = (threshold - level) / trend
    else:
        # danger when value < threshold
        if level <= threshold:
            return 0.0
        if trend >= 0:
            return None  # moving away from danger
        steps = (level - threshold) / abs(trend)

    return steps if 0 < steps <= max_steps else None


def run(device_id: str, telemetry: list[dict], params: dict) -> AlgorithmOutput:
    """Run Holt double exponential smoothing forecasting.

    Parameters
    ----------
    params keys:
        alpha : float (default 0.3) – level smoothing
        beta : float (default 0.1) – trend smoothing
        forecast_horizon : int (default 24) – hours to look ahead
        base_rul : float (default 400)
    """
    alpha = clamp(params.get("alpha", 0.3), 0.01, 0.99)
    beta = clamp(params.get("beta", 0.1), 0.01, 0.99)
    forecast_horizon = int(params.get("forecast_horizon", 24))
    base_rul = params.get("base_rul", 400.0)

    mat = telemetry_to_matrix(telemetry)
    if mat is None or len(mat) < 5:
        return AlgorithmOutput(
            algorithm="deep_learning",
            risk_score=round(NO_DATA_RISK, 4),
            rul_hours=round(NO_DATA_RUL, 1),
            confidence=round(NO_DATA_CONFIDENCE, 4),
            details=NO_DATA_DETAIL,
        )

    # Chronological order (oldest first)
    data = mat[::-1] if len(mat) > 1 else mat

    # Per-metric forecasting
    risk_scores = []
    forecast_details = []
    min_rul = base_rul

    for i, key in enumerate(METRIC_KEYS):
        series = data[:, i]
        level, trend = _holt_smooth(series, alpha, beta)
        direction = METRIC_DIRECTION[key]
        threshold = DEFAULT_THRESHOLDS[key]

        # Forecast value at horizon
        forecast_val = level + trend * forecast_horizon

        # Check if forecast exceeds threshold
        steps = _forecast_steps_to_threshold(level, trend, threshold, direction)

        # Risk contribution from this metric
        if direction > 0:
            # danger when high
            current_ratio = level / threshold if threshold > 0 else 0
            forecast_ratio = forecast_val / threshold if threshold > 0 else 0
        else:
            # danger when low
            current_ratio = threshold / level if level > 0 else 2.0
            forecast_ratio = threshold / forecast_val if forecast_val > 0 else 2.0

        metric_risk = clamp((current_ratio + forecast_ratio) / 2.0 - 0.5)
        risk_scores.append(metric_risk)

        if steps is not None and steps < base_rul:
            step_hours = steps  # approximate each data point as ~1 hour
            min_rul = min(min_rul, max(10.0, step_hours))
            forecast_details.append(
                f"{key}: 预计 {step_hours:.0f}h 后超限 (当前={level:.1f}, 趋势={trend:+.3f}/步)"
            )
        else:
            forecast_details.append(
                f"{key}: 趋势平稳 (当前={level:.1f}, 趋势={trend:+.3f}/步)"
            )

    risk_score = clamp(float(np.mean(risk_scores)))
    rul = min(min_rul, max(10.0, base_rul * (1.0 - risk_score)))
    confidence = clamp(0.5 + 0.35 * min(len(data), 100) / 100.0)

    parts = [
        f"Holt 双指数平滑 (α={alpha}, β={beta}), 预测范围: {forecast_horizon}h",
    ] + forecast_details
    parts.append(f"数据点数: {len(data)}")

    return AlgorithmOutput(
        algorithm="deep_learning",
        risk_score=round(risk_score, 4),
        rul_hours=round(rul, 1),
        confidence=round(confidence, 4),
        details=" | ".join(parts),
    )
