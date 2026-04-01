"""Data-source configuration router."""

from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException

from app.db import store
from app.db.models import DataSourceConfig, DataSourceTestResult
from app.routers.auth import get_current_user

router = APIRouter(prefix="/datasources", tags=["datasources"])

_now = lambda: datetime.now(timezone.utc).isoformat()
_id  = lambda: uuid.uuid4().hex[:12]


@router.get("", response_model=list[DataSourceConfig])
async def list_datasources(user: dict = Depends(get_current_user)):
    return [DataSourceConfig(**{**ds, "password": "********"})
            for ds in store.get_all_datasources()]


@router.get("/{ds_id}", response_model=DataSourceConfig)
async def get_datasource(ds_id: str, user: dict = Depends(get_current_user)):
    ds = store.get_datasource(ds_id)
    if not ds:
        raise HTTPException(404, "数据源不存在")
    return DataSourceConfig(**{**ds, "password": "********"})


@router.post("", response_model=DataSourceConfig)
async def create_datasource(body: DataSourceConfig, user: dict = Depends(get_current_user)):
    if user.get("role") not in ("admin", "engineer"):
        raise HTTPException(403, "权限不足")
    ds_id = _id()
    rec = body.model_dump()
    rec.update(id=ds_id, status="unknown", status_message="", updated_at=_now())
    saved = store.create_datasource(rec)
    return DataSourceConfig(**{**saved, "password": "********"})


@router.put("/{ds_id}", response_model=DataSourceConfig)
async def update_datasource(ds_id: str, body: DataSourceConfig,
                            user: dict = Depends(get_current_user)):
    if user.get("role") not in ("admin", "engineer"):
        raise HTTPException(403, "权限不足")
    existing = store.get_datasource(ds_id)
    if not existing:
        raise HTTPException(404, "数据源不存在")
    update = body.model_dump(exclude={"id"})
    if update.get("password") == "********":
        update["password"] = existing["password"]
    update["updated_at"] = _now()
    saved = store.update_datasource(ds_id, update)
    return DataSourceConfig(**{**saved, "password": "********"})


@router.delete("/{ds_id}")
async def delete_datasource(ds_id: str, user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "仅管理员可删除数据源")
    if not store.get_datasource(ds_id):
        raise HTTPException(404, "数据源不存在")
    store.delete_datasource(ds_id)
    return {"ok": True}


@router.post("/{ds_id}/test", response_model=DataSourceTestResult)
async def test_datasource(ds_id: str, user: dict = Depends(get_current_user)):
    ds = store.get_datasource(ds_id)
    if not ds:
        raise HTTPException(404, "数据源不存在")
    result = await _test_connection(ds)
    store.update_datasource(ds_id, {
        "status": "ok" if result.ok else "error",
        "status_message": result.message,
        "updated_at": _now(),
    })
    return result


@router.post("/test-new", response_model=DataSourceTestResult)
async def test_new_datasource(body: DataSourceConfig,
                              user: dict = Depends(get_current_user)):
    return await _test_connection(body.model_dump())


async def _test_connection(ds: dict) -> DataSourceTestResult:
    ds_type = ds.get("ds_type", "tdengine")
    host     = ds.get("host", "localhost")
    port     = ds.get("port", 6041)
    username = ds.get("username", "root")
    password = ds.get("password", "")
    database = ds.get("database", "pdm")

    if ds_type == "tdengine":
        url = f"http://{host}:{port}/rest/login/{username}/{password}"
        t0 = time.monotonic()
        try:
            async with httpx.AsyncClient(timeout=5) as c:
                r = await c.get(url)
                latency = (time.monotonic() - t0) * 1000
                if r.status_code == 200:
                    return DataSourceTestResult(
                        ok=True,
                        message=f"TDengine 连接成功 (数据库: {database})",
                        latency_ms=round(latency, 1))
                return DataSourceTestResult(
                    ok=False,
                    message=f"认证失败: HTTP {r.status_code}",
                    latency_ms=round(latency, 1))
        except httpx.ConnectError:
            return DataSourceTestResult(ok=False, message=f"无法连接 {host}:{port}")
        except httpx.TimeoutException:
            return DataSourceTestResult(ok=False, message=f"连接超时 ({host}:{port})")
        except Exception as e:
            return DataSourceTestResult(ok=False, message=str(e))
    return DataSourceTestResult(ok=False, message=f"暂不支持 {ds_type} 类型的连接测试")
