"""Rules router."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.db import store
from app.db.models import RuleCreate, RuleOut
from app.routers.auth import get_current_user

router = APIRouter(prefix="/rules", tags=["rules"])


@router.get("", response_model=list[RuleOut])
def list_rules(user: dict = Depends(get_current_user)):
    return [RuleOut(**r) for r in store.get_all_rules()]


@router.post("", response_model=RuleOut)
def create_rule(body: RuleCreate, user: dict = Depends(get_current_user)):
    rule = store.create_rule({
        "id": uuid.uuid4().hex[:12],
        "name": body.name,
        "device_type": body.device_type,
        "metric": body.metric,
        "condition": body.condition,
        "level": body.level.value,
        "enabled": body.enabled,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return RuleOut(**rule)


@router.post("/{rule_id}/toggle")
def toggle_rule(rule_id: str, user: dict = Depends(get_current_user)):
    rule = store.get_rule(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="规则不存在")
    new_enabled = not bool(rule["enabled"])
    store.update_rule(rule_id, {"enabled": new_enabled})
    return {"id": rule_id, "enabled": new_enabled}
