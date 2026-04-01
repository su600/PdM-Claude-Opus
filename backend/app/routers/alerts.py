"""Alerts router."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from app.db import store
from app.db.models import AlertCreate, AlertOut
from app.routers.auth import get_current_user

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertOut])
def list_alerts(user: dict = Depends(get_current_user)):
    return [AlertOut(**a) for a in store.get_all_alerts()]


@router.post("", response_model=AlertOut)
def create_alert(body: AlertCreate, user: dict = Depends(get_current_user)):
    aid = uuid.uuid4().hex[:12]
    dev = store.get_device(body.device_id) or {}
    alert = store.create_alert({
        "id": aid,
        "device_id": body.device_id,
        "device_name": dev.get("name", ""),
        "level": body.level.value,
        "message": body.message,
        "metric": body.metric,
        "value": body.value,
        "acknowledged": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return AlertOut(**alert)
