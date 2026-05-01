"""Device management router."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from app.db import store
from app.db.models import (
    DeviceCreate, DeviceOut, DeviceUpdate,
    MaintenanceRecordCreate, MaintenanceRecordOut, InspectionOverviewItem,
    AlertOut, PredictionResult,
)
from app.routers.auth import get_current_user

router = APIRouter(prefix="/devices", tags=["devices"])

_now = lambda: datetime.now(timezone.utc).isoformat()
_id  = lambda: uuid.uuid4().hex[:12]


def _get_device(device_id: str) -> dict:
    dev = store.get_device(device_id)
    if not dev:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="设备不存在")
    return dev


# ── Device CRUD ───────────────────────────────────────────────────────────────

@router.get("", response_model=list[DeviceOut])
def list_devices(user: dict = Depends(get_current_user)):
    return [DeviceOut(**d) for d in store.get_all_devices()]


@router.get("/{device_id}", response_model=DeviceOut)
def get_device(device_id: str, user: dict = Depends(get_current_user)):
    return DeviceOut(**_get_device(device_id))


@router.post("", response_model=DeviceOut)
def create_device(body: DeviceCreate, user: dict = Depends(get_current_user)):
    did = _id()
    dev = store.create_device({
        "id": did,
        "name": body.name,
        "device_type": body.device_type,
        "location": body.location,
        "status": body.status.value,
        "model": body.model,
        "manufacturer": body.manufacturer,
        "manufacture_year": body.manufacture_year,
        "serial_number": body.serial_number,
        "description": body.description,
        "datasource_tag": body.datasource_tag or did,
        "created_at": _now(),
    })
    return DeviceOut(**dev)


@router.put("/{device_id}", response_model=DeviceOut)
def update_device(device_id: str, body: DeviceUpdate, user: dict = Depends(get_current_user)):
    _get_device(device_id)
    updates = body.model_dump(exclude_none=True)
    if "status" in updates:
        updates["status"] = updates["status"].value if hasattr(updates["status"], "value") else updates["status"]
    dev = store.update_device(device_id, updates)
    return DeviceOut(**dev)


@router.delete("/{device_id}")
def delete_device(device_id: str, user: dict = Depends(get_current_user)):
    if not store.delete_device(device_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="设备不存在")
    return {"ok": True}


# ── Maintenance Records ───────────────────────────────────────────────────────

@router.get("/{device_id}/maintenance", response_model=list[MaintenanceRecordOut])
def list_maintenance(device_id: str, user: dict = Depends(get_current_user)):
    _get_device(device_id)
    return [MaintenanceRecordOut(**m) for m in store.get_maintenance_for_device(device_id)]


@router.post("/{device_id}/maintenance", response_model=MaintenanceRecordOut)
def create_maintenance(device_id: str, body: MaintenanceRecordCreate,
                       user: dict = Depends(get_current_user)):
    _get_device(device_id)
    record = store.create_maintenance_record({
        "id": _id(),
        "device_id": device_id,
        "date": body.date,
        "maintenance_type": body.maintenance_type.value,
        "description": body.description,
        "operator": body.operator,
        "cost": body.cost,
        "next_maintenance_date": body.next_maintenance_date,
        "created_at": _now(),
    })
    return MaintenanceRecordOut(**record)


@router.delete("/{device_id}/maintenance/{record_id}")
def delete_maintenance(device_id: str, record_id: str, user: dict = Depends(get_current_user)):
    _get_device(device_id)
    if not store.get_maintenance_record(record_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="维保记录不存在")
    store.delete_maintenance_record(record_id)
    return {"ok": True}


# ── Related data ──────────────────────────────────────────────────────────────

@router.get("/{device_id}/alerts", response_model=list[AlertOut])
def device_alerts(device_id: str, user: dict = Depends(get_current_user)):
    _get_device(device_id)
    return [AlertOut(**a) for a in store.get_alerts_for_device(device_id)]


@router.get("/{device_id}/predictions", response_model=list[PredictionResult])
def device_predictions(device_id: str, user: dict = Depends(get_current_user)):
    _get_device(device_id)
    return [PredictionResult(**p) for p in store.get_predictions_for_device(device_id)]


# ── Inspection Overview ───────────────────────────────────────────────────────

@router.get("/inspection/overview", response_model=list[InspectionOverviewItem])
def inspection_overview(user: dict = Depends(get_current_user)):
    return [InspectionOverviewItem(**item) for item in store.get_inspection_overview()]
