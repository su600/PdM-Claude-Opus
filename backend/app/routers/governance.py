"""Algorithm governance router – templates, evaluations, audit logs."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response

from app.db import store
from app.db.models import AlgoTemplate, AuditLog, Evaluation
from app.routers.auth import get_current_user

router = APIRouter(prefix="/algo-governance", tags=["governance"])

_now = lambda: datetime.now(timezone.utc).isoformat()
_id  = lambda: uuid.uuid4().hex[:12]


def _audit(action: str, target_type: str, target_id: str, user: dict, detail: str = "") -> None:
    store.append_audit_log({
        "id": _id(), "action": action, "target_type": target_type,
        "target_id": target_id, "user": user["username"],
        "detail": detail, "created_at": _now(),
    })


# ── Templates ────────────────────────────────────────────────────────────────

@router.get("/templates", response_model=list[AlgoTemplate])
def list_templates(user: dict = Depends(get_current_user)):
    return [AlgoTemplate(**t) for t in store.get_all_templates()]


@router.post("/templates", response_model=AlgoTemplate)
def create_template(body: AlgoTemplate, user: dict = Depends(get_current_user)):
    tid = _id()
    t = body.model_dump()
    t["id"] = tid
    t["created_at"] = _now()
    t["updated_at"] = _now()
    saved = store.create_template(t)
    _audit("create", "template", tid, user, f"创建模板: {body.name}")
    return AlgoTemplate(**saved)


@router.put("/templates/{template_id}", response_model=AlgoTemplate)
def update_template(template_id: str, body: AlgoTemplate,
                    user: dict = Depends(get_current_user)):
    existing = store.get_template(template_id)
    if not existing:
        raise HTTPException(status_code=404, detail="模板不存在")
    t = body.model_dump()
    t["id"] = template_id
    t["created_at"] = existing["created_at"]
    t["updated_at"] = _now()
    saved = store.update_template(template_id, t)
    _audit("update", "template", template_id, user, f"更新模板: {body.name}")
    return AlgoTemplate(**saved)


@router.delete("/templates/{template_id}")
def delete_template(template_id: str, user: dict = Depends(get_current_user)):
    existing = store.get_template(template_id)
    if not existing:
        raise HTTPException(status_code=404, detail="模板不存在")
    store.delete_template(template_id)
    _audit("delete", "template", template_id, user, f"删除模板: {existing.get('name', '')}")
    return {"ok": True}


@router.get("/templates/export")
def export_templates(user: dict = Depends(get_current_user)):
    data = store.get_all_templates()
    return Response(
        content=json.dumps(data, ensure_ascii=False, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=templates.json"},
    )


@router.post("/templates/import")
async def import_templates(file: UploadFile = File(...),
                           user: dict = Depends(get_current_user)):
    content = await file.read()
    try:
        items = json.loads(content)
    except Exception:
        raise HTTPException(status_code=400, detail="无效的 JSON 文件")
    imported = 0
    for item in items:
        item["id"] = _id()
        item["created_at"] = item.get("created_at", _now())
        item["updated_at"] = _now()
        store.create_template(item)
        imported += 1
    _audit("import", "template", "", user, f"导入 {imported} 个模板")
    return {"imported": imported}


# ── Evaluations ──────────────────────────────────────────────────────────────

@router.post("/evaluations", response_model=Evaluation)
def create_evaluation(body: Evaluation, user: dict = Depends(get_current_user)):
    eid = _id()
    ev = body.model_dump()
    ev["id"] = eid
    ev["created_at"] = _now()
    saved = store.create_evaluation(ev)
    _audit("create", "evaluation", eid, user, f"设备 {body.device_id} 评估记录")
    return Evaluation(**saved)


@router.get("/evaluations", response_model=list[Evaluation])
def list_evaluations(user: dict = Depends(get_current_user)):
    return [Evaluation(**e) for e in store.get_all_evaluations()]


# ── Audit Logs ───────────────────────────────────────────────────────────────

@router.get("/audit-logs", response_model=list[AuditLog])
def list_audit_logs(user: dict = Depends(get_current_user)):
    return [AuditLog(**a) for a in store.get_all_audit_logs()]
