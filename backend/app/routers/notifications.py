"""Notification router."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.db import store
from app.db.models import NotificationEvent, NotificationPush
from app.routers.auth import get_current_user
from app.services.notification_svc import push_notification, retry_failed

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.post("/push")
async def push(body: NotificationPush, user: dict = Depends(get_current_user)):
    result = await push_notification(body.title, body.body, body.level.value, body.target_url)
    return result


@router.get("/events", response_model=list[NotificationEvent])
def list_events(user: dict = Depends(get_current_user)):
    return [NotificationEvent(**e) for e in store.get_all_notification_events()]


@router.post("/retry-failed")
async def retry(user: dict = Depends(get_current_user)):
    return await retry_failed()
