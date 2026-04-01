"""Notification push service with HMAC signing and retry."""

from __future__ import annotations

import hashlib
import hmac
import json
import time
import uuid
from datetime import datetime, timezone

import httpx

from app.core.config import settings
from app.db import store


def _sign(body: bytes) -> str:
    return hmac.new(
        settings.WEBHOOK_SIGNING_SECRET.encode(),
        body,
        hashlib.sha256,
    ).hexdigest()


async def push_notification(title: str, body: str, level: str,
                            target_url: str = "") -> dict:
    url       = target_url or settings.DEFAULT_WEBHOOK_URL
    event_id  = uuid.uuid4().hex[:12]
    now_iso   = datetime.now(timezone.utc).isoformat()

    event = store.create_notification_event({
        "id": event_id, "title": title, "body": body, "level": level,
        "status": "pending", "target_url": url,
        "retries": 0, "error": "", "created_at": now_iso,
    })

    payload = json.dumps({"title": title, "body": body,
                          "level": level, "event_id": event_id}).encode()
    sig     = _sign(payload)
    headers = {
        "Content-Type":    "application/json",
        "X-PdM-Signature": sig,
        "X-PdM-Timestamp": str(int(time.time())),
    }

    delays   = [1, 2, 3]
    last_err = ""
    for attempt in range(4):
        try:
            async with httpx.AsyncClient(timeout=4) as c:
                r = await c.post(url, content=payload, headers=headers)
                if r.status_code < 300:
                    store.update_notification_event(
                        event_id, {"status": "success", "retries": attempt})
                    event.update(status="success", retries=attempt)
                    return event
                last_err = f"HTTP {r.status_code}"
        except Exception as e:
            last_err = str(e)

        store.update_notification_event(event_id, {"retries": attempt + 1})
        if attempt < 3:
            import asyncio
            await asyncio.sleep(delays[attempt])

    store.update_notification_event(
        event_id, {"status": "failed", "error": last_err})
    event.update(status="failed", error=last_err)
    return event


async def retry_failed() -> dict:
    failed  = store.get_failed_notification_events()
    results = []
    for ev in failed:
        store.update_notification_event(ev["id"], {"status": "pending", "error": ""})
        result = await push_notification(
            ev["title"], ev["body"], ev["level"], ev.get("target_url", ""))
        results.append(result)
    return {"retried": len(results)}
