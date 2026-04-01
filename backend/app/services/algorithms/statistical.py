"""Statistical anomaly detection: Z-score + linear trend analysis.

For each telemetry metric, computes the Z-score of the latest reading
relative to the historical window, and estimates the linear trend slope.
"""

from __future__ import annotations

import numpy as np

from app.db.models import AlgorithmOutput

from .base import (
    METRIC_DIRECTION,
    METRIC_KEYS,
    NO_DATA_CONFIDENCE,
    NO_DATA_DETAIL,
    NO_DATA_RISK,
    NO_DATA_RUL,
    clamp,
    linear_slope,
    safe_std,
    telemetry_to_matrix,
)


def run(device_id: str, telemetry: list[dict], params: dict) -> AlgorithmOutput:
    """Run statistical anomaly detection.

    Parameters
    ----------
    params keys:
        window_size : int (default 50)
        sigma_threshold : float (default 3.0)
        trend_weight : float (default 0.4)
        base_rul : float (default 500)
    """
    window_size = int(params.get("window_size", 50))
    sigma_th = params.get("sigma_threshold", 3.0)
    trend_weight = clamp(params.get("trend_weight", 0.4), 0.0, 1.0)
    base_rul = params.get("base_rul", 500.0)

    mat = telemetry_to_matrix(telemetry)
    if mat is None or len(mat) < 3:
        return AlgorithmOutput(
            algorithm="statistical",
            risk_score=round(NO_DATA_RISK, 4),
            rul_hours=round(NO_DATA_RUL, 1),
            confidence=round(NO_DATA_CONFIDENCE, 4),
            details=NO_DATA_DETAIL,
        )

    # Use last `window_size` rows (data is ordered newest-first from TDengine,
    # but we reverse to chronological order for trend analysis)
    window = mat[-window_size:] if len(mat) >= window_size else mat
    # Ensure chronological order: oldest first
    window = window[::-1] if len(window) > 1 else window

    latest = window[-1]  # most recent values
    n_metrics = 4

    # --- Z-score anomaly detection ---
    anomaly_scores = []
    anomaly_details = []
    for i, key in enumerate(METRIC_KEYS):
        col = window[:, i]
        mean = float(col.mean())
        std = safe_std(col)
        z = abs(float(latest[i]) - mean) / std
        is_anomaly = z > sigma_th
        # Direction-aware: for pressure, low values are bad
        direction = METRIC_DIRECTION[key]
        if direction < 0:
            # Lower is worse: anomaly if value is unusually low
            directional_z = (mean - float(latest[i])) / std
        else:
            directional_z = (float(latest[i]) - mean) / std
        # Convert to 0-1 risk contribution
        anomaly_risk = clamp(max(0.0, directional_z) / (sigma_th * 2.0))
        anomaly_scores.append(anomaly_risk)
        if is_anomaly:
            anomaly_details.append(f"{key}(Z={z:.2f})")

    z_risk = float(np.mean(anomaly_scores))

    # --- Trend analysis (linear slope) ---
    trend_scores = []
    trend_details = []
    for i, key in enumerate(METRIC_KEYS):
        col = window[:, i]
        slope = linear_slope(col)
        std = safe_std(col)
        # Normalize slope relative to the metric's std dev
        normalized_slope = slope / std if std > 1e-9 else 0.0
        direction = METRIC_DIRECTION[key]
        # If slope goes in the "danger direction", it contributes to risk
        trend_risk = clamp(max(0.0, normalized_slope * direction) / 3.0)
        trend_scores.append(trend_risk)
        if abs(normalized_slope) > 0.5:
            arrow = "↑" if slope > 0 else "↓"
            trend_details.append(f"{key}{arrow}")

    trend_risk = float(np.mean(trend_scores))

    # --- Combine ---
    risk_score = clamp(z_risk * (1.0 - trend_weight) + trend_risk * trend_weight)
    rul = max(10.0, base_rul * (1.0 - risk_score * 0.9))
    confidence = clamp(0.5 + 0.4 * min(len(window), window_size) / window_size)

    n_anomalies = len(anomaly_details)
    parts = [f"Z-score 异常指标数: {n_anomalies}/{n_metrics} (σ阈值={sigma_th})"]
    if anomaly_details:
        parts.append(f"异常: {', '.join(anomaly_details)}")
    if trend_details:
        parts.append(f"趋势恶化: {', '.join(trend_details)}")
    else:
        parts.append("各指标趋势平稳")
    parts.append(f"统计窗口: {len(window)} 点")

    return AlgorithmOutput(
        algorithm="statistical",
        risk_score=round(risk_score, 4),
        rul_hours=round(rul, 1),
        confidence=round(confidence, 4),
        details=" | ".join(parts),
    )
