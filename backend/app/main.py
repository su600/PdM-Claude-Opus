"""PdM Backend – FastAPI application entry point."""

from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.database import create_tables
from app.db import store
from app.routers import (
    alerts, auth, datasources, devices, governance,
    health, notifications, predictions, rules, system, telemetry, users,
)
from app.services.tdengine_svc import check_health, init_database


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialise SQLite schema (idempotent)
    create_tables()

    # Seed demo data on first run
    if store.is_empty():
        store.seed()

    # Initialise TDengine schema
    td_ok = False
    try:
        await init_database()
        td_ok = True
    except Exception as e:
        print(f"[WARN] TDengine init skipped: {e}")

    if not td_ok:
        td_ok = await check_health()

    # Sync default datasource status with actual TDengine connectivity
    now = datetime.now(timezone.utc).isoformat()
    for ds in store.get_all_datasources():
        if ds.get("ds_type") == "tdengine":
            store.update_datasource(ds["id"], {
                "status": "ok" if td_ok else "error",
                "status_message": "启动自检: 连接正常" if td_ok else "启动自检: 连接失败",
                "updated_at": now,
            })

    yield


app = FastAPI(
    title="PdM 智能运维平台",
    version="1.0.0",
    description="工业设备预测性维护平台 API",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(devices.router)
app.include_router(alerts.router)
app.include_router(rules.router)
app.include_router(predictions.router)
app.include_router(governance.router)
app.include_router(datasources.router)
app.include_router(telemetry.router)
app.include_router(notifications.router)
app.include_router(system.router)
app.include_router(health.router)
