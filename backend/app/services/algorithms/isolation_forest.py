"""Isolation Forest anomaly detection — pure numpy implementation.

Each tree randomly selects a feature and a split value within that feature's
range, recursively partitioning the data.  Anomalies are isolated in fewer
splits, yielding shorter average path lengths.
"""

from __future__ import annotations

import math

import numpy as np

from app.db.models import AlgorithmOutput

from .base import (
    NO_DATA_CONFIDENCE,
    NO_DATA_DETAIL,
    NO_DATA_RISK,
    NO_DATA_RUL,
    clamp,
    telemetry_to_matrix,
)


# ---------- Isolation Tree ----------

class _Node:
    __slots__ = ("left", "right", "feature", "threshold", "size")

    def __init__(self) -> None:
        self.left: _Node | None = None
        self.right: _Node | None = None
        self.feature: int = -1
        self.threshold: float = 0.0
        self.size: int = 0


def _build_tree(data: np.ndarray, rng: np.random.Generator, max_depth: int, depth: int = 0) -> _Node:
    node = _Node()
    n = len(data)
    node.size = n

    if n <= 1 or depth >= max_depth:
        return node

    n_features = data.shape[1]
    feat = rng.integers(0, n_features)
    col = data[:, feat]
    col_min, col_max = float(col.min()), float(col.max())

    if col_max - col_min < 1e-12:
        return node

    split = rng.uniform(col_min, col_max)
    node.feature = feat
    node.threshold = split

    left_mask = col < split
    right_mask = ~left_mask

    if left_mask.any() and right_mask.any():
        node.left = _build_tree(data[left_mask], rng, max_depth, depth + 1)
        node.right = _build_tree(data[right_mask], rng, max_depth, depth + 1)

    return node


def _path_length(node: _Node, point: np.ndarray, depth: int = 0) -> float:
    if node.left is None or node.right is None:
        return depth + _c(node.size)

    if point[node.feature] < node.threshold:
        return _path_length(node.left, point, depth + 1)
    else:
        return _path_length(node.right, point, depth + 1)


def _c(n: int) -> float:
    """Average path length of unsuccessful search in BST (normalization factor)."""
    if n <= 1:
        return 0.0
    if n == 2:
        return 1.0
    h = math.log(n - 1) + 0.5772156649  # Euler-Mascheroni constant
    return 2.0 * h - 2.0 * (n - 1) / n


# ---------- Isolation Forest ----------

class IsolationForest:
    """Lightweight Isolation Forest."""

    def __init__(self, n_trees: int = 100, sample_size: int = 32, seed: int = 42) -> None:
        self.n_trees = n_trees
        self.sample_size = sample_size
        self.rng = np.random.default_rng(seed)
        self.trees: list[_Node] = []
        self._n_samples = 0

    def fit(self, data: np.ndarray) -> None:
        n = len(data)
        self._n_samples = n
        max_depth = int(math.ceil(math.log2(max(self.sample_size, 2))))
        self.trees = []
        for _ in range(self.n_trees):
            if n > self.sample_size:
                idx = self.rng.choice(n, size=self.sample_size, replace=False)
                sample = data[idx]
            else:
                sample = data
            self.trees.append(_build_tree(sample, self.rng, max_depth))

    def anomaly_score(self, point: np.ndarray) -> float:
        """Return anomaly score in [0, 1]. Higher = more anomalous."""
        if not self.trees:
            return 0.5
        avg_path = sum(_path_length(t, point) for t in self.trees) / len(self.trees)
        c_n = _c(self.sample_size)
        if c_n < 1e-9:
            return 0.5
        # s(x, n) = 2^(-E(h(x)) / c(n))
        return float(2.0 ** (-avg_path / c_n))


# ---------- Algorithm entry point ----------

def run(device_id: str, telemetry: list[dict], params: dict) -> AlgorithmOutput:
    """Run Isolation Forest anomaly detection.

    Parameters
    ----------
    params keys:
        n_trees : int (default 100)
        sample_size : int (default 32)
        contamination : float (default 0.1)
        base_rul : float (default 400)
    """
    n_trees = int(params.get("n_trees", 100))
    sample_size = int(params.get("sample_size", 32))
    contamination = params.get("contamination", 0.1)
    base_rul = params.get("base_rul", 400.0)

    mat = telemetry_to_matrix(telemetry)
    if mat is None or len(mat) < 5:
        return AlgorithmOutput(
            algorithm="ml",
            risk_score=round(NO_DATA_RISK, 4),
            rul_hours=round(NO_DATA_RUL, 1),
            confidence=round(NO_DATA_CONFIDENCE, 4),
            details=NO_DATA_DETAIL,
        )

    # Normalize features to zero-mean unit-variance for fair splitting
    means = mat.mean(axis=0)
    stds = mat.std(axis=0)
    stds[stds < 1e-9] = 1.0
    normalized = (mat - means) / stds

    forest = IsolationForest(n_trees=n_trees, sample_size=min(sample_size, len(normalized)), seed=42)
    forest.fit(normalized)

    # Score the latest point
    latest = normalized[-1]
    score = forest.anomaly_score(latest)

    # Score all points to find the percentile/rank of the latest
    all_scores = np.array([forest.anomaly_score(normalized[i]) for i in range(len(normalized))])
    percentile = float(np.mean(all_scores <= score))

    # Adjust risk: use contamination as baseline expectation
    # If score > threshold implied by contamination, it's anomalous
    sorted_scores = np.sort(all_scores)
    threshold_idx = max(0, int(len(sorted_scores) * (1.0 - contamination)) - 1)
    threshold_score = float(sorted_scores[threshold_idx])
    is_anomaly = score > threshold_score

    risk_score = clamp(score)
    rul = max(10.0, base_rul * (1.0 - risk_score))
    confidence = clamp(0.5 + 0.4 * min(len(mat), 100) / 100.0)

    detail_parts = [
        f"Isolation Forest: {n_trees} 棵树, 采样 {min(sample_size, len(mat))}",
        f"异常评分: {score:.4f} (阈值: {threshold_score:.4f})",
        f"排名百分位: {percentile * 100:.1f}%",
        "状态: 异常" if is_anomaly else "状态: 正常",
        f"训练样本: {len(mat)} 点",
    ]

    return AlgorithmOutput(
        algorithm="ml",
        risk_score=round(risk_score, 4),
        rul_hours=round(rul, 1),
        confidence=round(confidence, 4),
        details=" | ".join(detail_parts),
    )
