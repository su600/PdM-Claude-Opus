"""Prediction service – multi-algorithm weighted fusion with real telemetry data."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from app.db import store
from app.db.models import AlgorithmOutput, AlgorithmParams, PredictionResult
from app.services.algorithms import ALGO_MAP
from app.services.tdengine_svc import query_telemetry


def _clamp(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, v))


async def run_prediction(
    device_id: str,
    algorithms: dict,
    weights: dict,
    thresholds: dict,
    algo_params: AlgorithmParams | None = None,
) -> PredictionResult:
    device = store.get_device(device_id)
    if not device:
        raise ValueError("设备不存在")

    if algo_params is None:
        algo_params = AlgorithmParams()

    params_map = {
        "rule_based":    algo_params.rule_based,
        "statistical":   algo_params.statistical,
        "ml":            algo_params.ml,
        "deep_learning": algo_params.deep_learning,
    }

    try:
        telemetry = await query_telemetry(device_id, limit=500)
    except Exception:
        telemetry = []

    outputs: list[AlgorithmOutput] = []
    for algo_key, enabled in algorithms.items():
        if enabled and algo_key in ALGO_MAP:
            params = params_map.get(algo_key, {})
            outputs.append(ALGO_MAP[algo_key](device_id, telemetry, params))

    if not outputs:
        raise ValueError("至少启用一种算法")

    total_w = w_risk = w_rul = w_conf = 0.0
    for o in outputs:
        w = weights.get(o.algorithm, 0.25)
        total_w += w
        w_risk  += o.risk_score * w
        w_rul   += o.rul_hours  * w
        w_conf  += o.confidence * w

    if total_w == 0:
        total_w = 1.0

    risk_score = round(_clamp(w_risk / total_w), 4)
    rul_hours  = round(w_rul  / total_w, 1)
    confidence = round(_clamp(w_conf / total_w), 4)

    high_th = thresholds.get("high_risk", 0.7)
    med_th  = thresholds.get("medium_risk", 0.4)
    if risk_score >= high_th:
        risk_level     = "high"
        recommendation = "建议立即安排停机检修，预防非计划停机"
    elif risk_score >= med_th:
        risk_level     = "medium"
        recommendation = "建议在下次计划停机时进行针对性检查"
    else:
        risk_level     = "low"
        recommendation = "设备状态良好，按常规维护计划执行"

    pred_id = uuid.uuid4().hex[:12]
    result  = PredictionResult(
        id=pred_id,
        device_id=device_id,
        risk_score=risk_score,
        rul_hours=rul_hours,
        confidence=confidence,
        recommendation=recommendation,
        risk_level=risk_level,
        algorithm_outputs=outputs,
        created_at=datetime.now(timezone.utc).isoformat(),
    )

    store.append_prediction(result.model_dump())
    return result
