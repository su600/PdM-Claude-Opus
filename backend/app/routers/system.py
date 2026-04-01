"""System management router."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.config import settings
from app.db import store
from app.db.models import SystemInfo
from app.routers.auth import get_current_user, require_roles
from app.services.tdengine_svc import check_health

router = APIRouter(prefix="/system", tags=["system"])


class SystemSettingsUpdate(BaseModel):
    notification_webhook_url: Optional[str] = None
    notification_retry_max: Optional[int] = None


@router.get("/info", response_model=SystemInfo)
async def system_info(user: dict = Depends(get_current_user)):
    td_ok = await check_health()
    cfg = store.get_system_settings()
    return SystemInfo(
        version="1.0.0",
        build_date="2026-03-30",
        tdengine_host=settings.TDENGINE_HOST,
        tdengine_port=settings.TDENGINE_PORT,
        tdengine_database=settings.TDENGINE_DATABASE,
        tdengine_status="ok" if td_ok else "error",
        backend_host="0.0.0.0",
        backend_port=8000,
        notification_webhook_url=cfg.get("notification_webhook_url", ""),
        notification_retry_max=cfg.get("notification_retry_max", 3),
        server_time=datetime.now(timezone.utc).isoformat(),
    )


@router.get("/settings")
def get_settings(user: dict = Depends(get_current_user)):
    return store.get_system_settings()


@router.put("/settings")
def update_settings(body: SystemSettingsUpdate,
                    user: dict = Depends(require_roles("admin"))):
    updates = body.model_dump(exclude_none=True)
    return store.update_system_settings(updates)
