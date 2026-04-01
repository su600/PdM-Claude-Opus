"""Rule-based threshold evaluation algorithm.

Evaluates the latest telemetry readings against configurable thresholds,
and factors in historical alert counts with exponential decay.
"""

from __future__ import annotations

from app.db import store
from app.db.models import AlgorithmOutput

from .base import (
    METRIC_DIRECTION,
    NO_DATA_CONFIDENCE,
    NO_DATA_DETAIL,
    NO_DATA_RISK,
    NO_DATA_RUL,
    clamp,
    telemetry_to_matrix,
)


def run(device_id: str, telemetry: list[dict], params: dict) -> AlgorithmOutput:
    """Run rule-based prediction.

    Parameters
    ----------
    params keys:
        temp_threshold : float (default 85)
        vibration_threshold : float (default 12)
        pressure_low : float (default 1.5)
        rpm_threshold : float (default 5000)
        alert_decay : float (default 0.3)  – risk contribution per alert
        base_rul : float (default 500)
    """
    temp_th = params.get("temp_threshold", 85.0)
    vib_th = params.get("vibration_threshold", 12.0)
    pres_low = params.get("pressure_low", 1.5)
    rpm_th = params.get("rpm_threshold", 5000.0)
    alert_decay = params.get("alert_decay", 0.3)
    base_rul = params.get("base_rul", 500.0)

    mat = telemetry_to_matrix(telemetry)
    if mat is None or len(mat) == 0:
        return AlgorithmOutput(
            algorithm="rule_based",
            risk_score=round(NO_DATA_RISK, 4),
            rul_hours=round(NO_DATA_RUL, 1),
            confidence=round(NO_DATA_CONFIDENCE, 4),
            details=NO_DATA_DETAIL,
        )

    # Use the most recent N points (up to 10) for evaluation stability
    recent = mat[-min(10, len(mat)):]
    avg_temp = float(recent[:, 0].mean())
    avg_vib = float(recent[:, 1].mean())
    avg_pres = float(recent[:, 2].mean())
    avg_rpm = float(recent[:, 3].mean())

    # Per-metric violation score: how much the value exceeds the threshold
    violations = {}
    violations["temperature"] = max(0.0, (avg_temp - temp_th) / temp_th) if temp_th > 0 else 0.0
    violations["vibration"] = max(0.0, (avg_vib - vib_th) / vib_th) if vib_th > 0 else 0.0
    violations["pressure"] = max(0.0, (pres_low - avg_pres) / pres_low) if pres_low > 0 else 0.0
    violations["rpm"] = max(0.0, (avg_rpm - rpm_th) / rpm_th) if rpm_th > 0 else 0.0

    violation_count = sum(1 for v in violations.values() if v > 0)
    metric_risk = clamp(sum(violations.values()) / 4.0 * 2.0)  # scale up

    # Historical alert contribution
    dev_alerts = store.get_alerts_for_device(device_id)
    high_alerts = sum(1 for a in dev_alerts if a["level"] in ("high", "critical"))
    med_alerts = sum(1 for a in dev_alerts if a["level"] == "medium")
    alert_risk = clamp((high_alerts * alert_decay + med_alerts * alert_decay * 0.5))

    risk_score = clamp(metric_risk * 0.7 + alert_risk * 0.3)
    rul = max(10.0, base_rul * (1.0 - risk_score))
    confidence = clamp(0.6 + 0.3 * min(len(mat), 50) / 50.0)

    violated_names = [k for k, v in violations.items() if v > 0]
    detail_parts = []
    if violated_names:
        detail_parts.append(f"阈值超限指标: {', '.join(violated_names)}")
    else:
        detail_parts.append("所有指标在阈值范围内")
    detail_parts.append(f"历史告警: {len(dev_alerts)} 条 (高危 {high_alerts})")
    detail_parts.append(
        f"实时读数 — 温度:{avg_temp:.1f}°C 振动:{avg_vib:.2f}mm/s "
        f"压力:{avg_pres:.2f}MPa 转速:{avg_rpm:.0f}rpm"
    )

    return AlgorithmOutput(
        algorithm="rule_based",
        risk_score=round(risk_score, 4),
        rul_hours=round(rul, 1),
        confidence=round(confidence, 4),
        details=" | ".join(detail_parts),
    )
