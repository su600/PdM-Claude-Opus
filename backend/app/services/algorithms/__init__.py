"""Prediction algorithm registry."""

from __future__ import annotations

from app.db.models import AlgorithmOutput

from . import isolation_forest, rule_based, statistical, time_series

ALGO_MAP: dict[str, callable] = {
    "rule_based": rule_based.run,
    "statistical": statistical.run,
    "ml": isolation_forest.run,
    "deep_learning": time_series.run,
}

__all__ = ["ALGO_MAP", "AlgorithmOutput"]
