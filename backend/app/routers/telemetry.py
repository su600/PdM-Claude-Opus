"""Telemetry router – ingest & query via TDengine."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.db.models import TelemetryPoint
from app.routers.auth import get_current_user
from app.services.tdengine_svc import ingest_telemetry, query_telemetry

router = APIRouter(prefix="/telemetry", tags=["telemetry"])


@router.post("/ingest")
async def ingest(body: TelemetryPoint, user: dict = Depends(get_current_user)):
    result = await ingest_telemetry(body.device_id, body.temperature, body.vibration, body.pressure, body.rpm, body.ts)
    return {"ok": True, "result": result}


@router.get("/{device_id}")
async def query(device_id: str, limit: int = 200, user: dict = Depends(get_current_user)):
    rows = await query_telemetry(device_id, limit)
    return rows
