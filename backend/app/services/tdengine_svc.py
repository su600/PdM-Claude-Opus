"""TDengine REST-SQL service."""

from __future__ import annotations

import httpx

from app.core.config import settings

_base = lambda: f"http://{settings.TDENGINE_HOST}:{settings.TDENGINE_PORT}"


def _auth():
    import base64
    cred = base64.b64encode(f"{settings.TDENGINE_USER}:{settings.TDENGINE_PASSWORD}".encode()).decode()
    return {"Authorization": f"Basic {cred}"}


async def check_health() -> bool:
    """Return True if TDengine is reachable."""
    try:
        async with httpx.AsyncClient(timeout=3) as c:
            r = await c.get(f"{_base()}/rest/login/{settings.TDENGINE_USER}/{settings.TDENGINE_PASSWORD}")
            return r.status_code == 200
    except Exception:
        return False


async def execute_sql(sql: str) -> dict:
    """Execute a SQL statement against the TDengine REST interface."""
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.post(
                f"{_base()}/rest/sql/{settings.TDENGINE_DATABASE}",
                content=sql,
                headers={**_auth(), "Content-Type": "text/plain"},
            )
            return r.json()
    except Exception as e:
        return {"status": "error", "desc": str(e)}


async def init_database():
    """Create database and super-tables if they don't exist."""
    await execute_sql(f"CREATE DATABASE IF NOT EXISTS {settings.TDENGINE_DATABASE} KEEP 365 DURATION 10 BUFFER 16")
    await execute_sql(
        f"CREATE STABLE IF NOT EXISTS {settings.TDENGINE_DATABASE}.telemetry "
        "(ts TIMESTAMP, temperature FLOAT, vibration FLOAT, pressure FLOAT, rpm FLOAT) "
        "TAGS (device_id BINARY(64))"
    )


async def ingest_telemetry(device_id: str, temperature: float, vibration: float, pressure: float, rpm: float, ts: str | None = None):
    tag = device_id.replace("'", "")
    table = f"t_{tag}"
    ts_val = f"'{ts}'" if ts else "NOW"
    sql = (
        f"INSERT INTO {settings.TDENGINE_DATABASE}.{table} USING {settings.TDENGINE_DATABASE}.telemetry "
        f"TAGS ('{tag}') VALUES ({ts_val}, {temperature}, {vibration}, {pressure}, {rpm})"
    )
    return await execute_sql(sql)


async def query_telemetry(device_id: str, limit: int = 200):
    tag = device_id.replace("'", "")
    sql = (
        f"SELECT ts, temperature, vibration, pressure, rpm FROM {settings.TDENGINE_DATABASE}.telemetry "
        f"WHERE device_id = '{tag}' ORDER BY ts DESC LIMIT {limit}"
    )
    result = await execute_sql(sql)
    rows = []
    if result.get("data"):
        for row in result["data"]:
            rows.append({
                "ts": row[0],
                "temperature": row[1],
                "vibration": row[2],
                "pressure": row[3],
                "rpm": row[4],
            })
    return rows
