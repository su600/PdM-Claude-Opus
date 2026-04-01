"""Prediction router."""

from __future__ import annotations

import pathlib

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse

from app.db import store
from app.db.models import PredictionRequest, PredictionResult
from app.routers.auth import get_current_user
from app.services.prediction_svc import run_prediction

router = APIRouter(prefix="/predictions", tags=["predictions"])

_ALGO_SOURCE_FILES = {
    "rule_based":    "rule_based.py",
    "statistical":   "statistical.py",
    "ml":            "isolation_forest.py",
    "deep_learning": "time_series.py",
}
_ALGO_DIR = pathlib.Path(__file__).resolve().parent.parent / "services" / "algorithms"


@router.post("/infer", response_model=PredictionResult)
async def infer(body: PredictionRequest, user: dict = Depends(get_current_user)):
    try:
        return await run_prediction(
            body.device_id, body.algorithms, body.weights,
            body.thresholds, body.algo_params,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/stats")
def prediction_stats(user: dict = Depends(get_current_user)):
    return store.prediction_stats()


@router.get("/algorithms")
def list_algorithms(user: dict = Depends(get_current_user)):
    return {
        "rule_based":    {"name": "规则引擎",                      "file": "rule_based.py",      "desc": "阈值评估 + 告警历史衰减计分"},
        "statistical":   {"name": "统计分析 (Z-score)",             "file": "statistical.py",     "desc": "Z-score 异常检测 + 最小二乘趋势分析"},
        "ml":            {"name": "机器学习 (Isolation Forest)",    "file": "isolation_forest.py","desc": "隔离森林异常检测，纯 numpy 实现"},
        "deep_learning": {"name": "时序预测 (Holt 平滑)",           "file": "time_series.py",     "desc": "Holt 双指数平滑，level+trend 分解外推"},
    }


@router.get("/algorithms/{algo_key}/source")
def get_algorithm_source(algo_key: str, user: dict = Depends(get_current_user)):
    filename = _ALGO_SOURCE_FILES.get(algo_key)
    if not filename:
        raise HTTPException(status_code=404, detail=f"未知算法: {algo_key}")
    source_path = _ALGO_DIR / filename
    if not source_path.exists():
        raise HTTPException(status_code=404, detail=f"源文件不存在: {filename}")
    return PlainTextResponse(source_path.read_text(encoding="utf-8"))
