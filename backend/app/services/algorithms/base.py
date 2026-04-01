"""Shared utilities for prediction algorithms."""

from __future__ import annotations

import numpy as np


def clamp(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, v))


def safe_std(arr: np.ndarray) -> float:
    """Standard deviation that returns 1.0 for constant or single-element arrays."""
    if len(arr) < 2:
        return 1.0
    s = float(np.std(arr, ddof=1))
    return s if s > 1e-9 else 1.0


def linear_slope(arr: np.ndarray) -> float:
    """Compute the linear regression slope of a 1-D array (index as x).

    Returns 0.0 if there are fewer than 2 points.
    """
    n = len(arr)
    if n < 2:
        return 0.0
    x = np.arange(n, dtype=np.float64)
    x_mean = x.mean()
    y_mean = arr.mean()
    denom = float(np.sum((x - x_mean) ** 2))
    if denom < 1e-12:
        return 0.0
    return float(np.sum((x - x_mean) * (arr - y_mean)) / denom)


# Telemetry metric keys and their "danger direction".
# positive = higher is worse, negative = lower is worse.
METRIC_KEYS = ["temperature", "vibration", "pressure", "rpm"]
METRIC_DIRECTION = {
    "temperature": 1,   # higher → worse
    "vibration": 1,     # higher → worse
    "pressure": -1,     # lower  → worse
    "rpm": 1,           # higher → worse
}

# Default safe thresholds (used as fallback references)
DEFAULT_THRESHOLDS = {
    "temperature": 85.0,
    "vibration": 12.0,
    "pressure": 1.5,     # low threshold
    "rpm": 5000.0,
}


def telemetry_to_matrix(rows: list[dict]) -> np.ndarray | None:
    """Convert a list of telemetry dicts to an (N, 4) numpy array.

    Column order: temperature, vibration, pressure, rpm.
    Returns None if rows is empty.
    """
    if not rows:
        return None
    data = []
    for r in rows:
        data.append([
            float(r.get("temperature", 0)),
            float(r.get("vibration", 0)),
            float(r.get("pressure", 0)),
            float(r.get("rpm", 0)),
        ])
    return np.array(data, dtype=np.float64)


NO_DATA_RISK = 0.5
NO_DATA_CONFIDENCE = 0.3
NO_DATA_RUL = 999.0
NO_DATA_DETAIL = "运行数据不足，结果仅供参考"
