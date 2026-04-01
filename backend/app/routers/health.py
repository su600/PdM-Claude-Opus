"""Health endpoint."""

from __future__ import annotations

from fastapi import APIRouter

from app.db.models import HealthResponse
from app.services.tdengine_svc import check_health

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health():
    td_ok = await check_health()
    return HealthResponse(service="ok", tdengine="ok" if td_ok else "error")
