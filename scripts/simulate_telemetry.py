"""
批量生成设备遥测模拟数据并写入 TDengine。

为每台设备生成过去 7 天的数据，每 30 秒一个数据点（共 ~20160 点/设备）。
每台设备的运行特征不同，部分设备包含渐变恶化趋势和突发异常。

运行前确保：
  1. docker-compose 已启动 (tdengine + backend)
  2. TDengine 端口 6041 可从本机访问

Usage:
    TDENGINE_HOST=localhost python scripts/simulate_telemetry.py
"""

from __future__ import annotations

import asyncio
import base64
import math
import random
import sys
import time
from datetime import datetime, timedelta, timezone

import httpx

# ── 需要能 import 后端代码 ──
sys.path.insert(0, "backend")

from app.core.config import settings

# ── 运行特征分配（按设备名称） ──────────────────────────
DEVICE_PROFILES = {
    "CNC-001": "normal",
    "AFP-002": "normal",
    "LW-003":  "degrading",       # 渐变恶化（温度上升、振动增大）
    "INS-004": "normal",
    "CNC-005": "intermittent",    # 间歇性异常
    "AFP-006": "normal",
}

# ── 各设备类型的基线参数 ──────────────────────────────
# (temp_mean, temp_std, vib_mean, vib_std, pres_mean, pres_std, rpm_mean, rpm_std)
BASELINES = {
    "机加中心":   (62.0, 3.0,  4.5, 0.8,  3.2, 0.3,  3500.0, 120.0),
    "复材铺丝机": (45.0, 2.5,  2.8, 0.5,  2.8, 0.2,  1800.0,  80.0),
    "激光焊接机": (75.0, 4.0,  6.2, 1.0,  3.0, 0.3,  2200.0, 100.0),
    "检验监测仪": (35.0, 1.5,  1.2, 0.3,  2.5, 0.15, 800.0,   40.0),
}

# ── 时间配置 ──────────────────────────────────────────
DAYS = 7
INTERVAL_SEC = 30
BATCH_SIZE = 200              # TDengine REST 每批行数
POINTS_PER_DEVICE = DAYS * 24 * 3600 // INTERVAL_SEC  # ~20160


# ── TDengine REST 直连 ────────────────────────────────

def _td_base():
    return f"http://{settings.TDENGINE_HOST}:{settings.TDENGINE_PORT}"

def _td_auth_header():
    cred = base64.b64encode(
        f"{settings.TDENGINE_USER}:{settings.TDENGINE_PASSWORD}".encode()
    ).decode()
    return {"Authorization": f"Basic {cred}", "Content-Type": "text/plain"}

async def td_exec(client: httpx.AsyncClient, sql: str) -> dict:
    r = await client.post(
        f"{_td_base()}/rest/sql/{settings.TDENGINE_DATABASE}",
        content=sql,
        headers=_td_auth_header(),
    )
    return r.json()


# ── 从后端容器获取设备列表 ─────────────────────────────

import json
import subprocess

def fetch_devices_sync() -> list[dict]:
    """通过 docker exec 从运行中的后端获取设备列表（含 hex id）。"""
    cmd = [
        "docker", "exec", "pdm-backend", "python", "-c",
        "from app.db import store; import json; "
        "print(json.dumps([{'id':d['id'],'name':d['name'],'device_type':d['device_type']} "
        "for d in store.devices.values()]))"
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
    if result.returncode != 0:
        raise RuntimeError(f"docker exec failed: {result.stderr}")
    return json.loads(result.stdout.strip())


# ── 数据生成 ──────────────────────────────────────────

def _add_daily_cycle(hour: float, amplitude: float) -> float:
    """日内周期：白天（6-18 点）温度/负载偏高。"""
    if 6 <= hour <= 18:
        return amplitude * math.sin(math.pi * (hour - 6) / 12)
    return 0.0


def generate_device_data(device: dict, start: datetime) -> list[tuple]:
    """为一台设备生成所有数据点。返回 [(ts_str, temp, vib, pres, rpm), ...]"""
    name = device["name"]
    dtype = device["device_type"]
    profile = DEVICE_PROFILES.get(name, "normal")
    rng = random.Random(hash(name))  # 可复现

    bl = BASELINES.get(dtype, (50.0, 3.0, 3.0, 0.5, 3.0, 0.2, 2000.0, 100.0))
    temp_m, temp_s, vib_m, vib_s, pres_m, pres_s, rpm_m, rpm_s = bl

    total = POINTS_PER_DEVICE
    points: list[tuple] = []

    for i in range(total):
        t = start + timedelta(seconds=i * INTERVAL_SEC)
        ts_str = t.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        hour = t.hour + t.minute / 60.0
        progress = i / total  # 0->1

        # 日内周期
        day_adj = _add_daily_cycle(hour, 3.0)

        # 基础噪声
        temp = temp_m + day_adj + rng.gauss(0, temp_s)
        vib  = vib_m  + rng.gauss(0, vib_s)
        pres = pres_m + rng.gauss(0, pres_s)
        rpm  = rpm_m  + rng.gauss(0, rpm_s)

        # ── 恶化模式 ──
        if profile == "degrading":
            if progress > 0.57:
                degrade = (progress - 0.57) / 0.43
                temp += 20.0 * degrade
                vib  += 5.0 * degrade
                pres -= 0.8 * degrade
                rpm  += 300.0 * degrade

        # ── 间歇性异常 ──
        elif profile == "intermittent":
            hour_seed = int(t.timestamp()) // 3600
            burst_rng = random.Random(hour_seed + hash(name))
            if burst_rng.random() < 0.18:
                minute_in_hour = t.minute + t.second / 60
                burst_start = burst_rng.uniform(0, 45)
                if burst_start <= minute_in_hour <= burst_start + 15:
                    temp += rng.uniform(15, 30)
                    vib  += rng.uniform(4, 10)
                    pres -= rng.uniform(0.5, 1.2)

        # 物理合理性
        temp = max(15.0, min(120.0, temp))
        vib  = max(0.1, min(25.0, vib))
        pres = max(0.5, min(6.0, pres))
        rpm  = max(100.0, min(8000.0, rpm))

        points.append((
            ts_str,
            round(temp, 2),
            round(vib, 2),
            round(pres, 2),
            round(rpm, 1),
        ))

    return points


def build_batch_sql(device_id: str, batch: list[tuple]) -> str:
    """构造批量 INSERT SQL。device_id 是后端 hex ID。"""
    db = settings.TDENGINE_DATABASE
    tag = device_id.replace("'", "")
    table = f"t_{tag}"

    values = " ".join(
        f"('{ts}', {temp}, {vib}, {pres}, {rpm})"
        for ts, temp, vib, pres, rpm in batch
    )
    return (
        f"INSERT INTO {db}.{table} USING {db}.telemetry "
        f"TAGS ('{tag}') VALUES {values}"
    )


async def ingest_device(client: httpx.AsyncClient, device: dict, start: datetime) -> int:
    """为一台设备生成并写入数据，返回写入行数。"""
    device_id = device["id"]
    name = device["name"]
    print(f"  [{name} ({device_id})] generating {POINTS_PER_DEVICE:,} points ...")
    points = generate_device_data(device, start)

    written = 0
    total_batches = (len(points) + BATCH_SIZE - 1) // BATCH_SIZE
    for i in range(0, len(points), BATCH_SIZE):
        batch = points[i : i + BATCH_SIZE]
        sql = build_batch_sql(device_id, batch)
        result = await td_exec(client, sql)
        if result.get("code") and result["code"] != 0:
            print(f"    [ERROR] batch {i//BATCH_SIZE}: {result}")
            break
        else:
            written += len(batch)
        batch_no = i // BATCH_SIZE
        if batch_no % 20 == 0 or batch_no == total_batches - 1:
            pct = min(100, int((i + len(batch)) / len(points) * 100))
            print(f"    [{name}] {pct}% ({written:,}/{len(points):,})")

    print(f"  [{name}] done: {written:,} rows")
    return written


async def main():
    t0 = time.time()
    print("=" * 60)
    print("PdM Telemetry Simulator")
    print(f"TDengine: {settings.TDENGINE_HOST}:{settings.TDENGINE_PORT}")
    print(f"Database: {settings.TDENGINE_DATABASE}")
    print("=" * 60)

    # 1. 从后端容器获取真实设备列表
    print("\n[1/4] Fetching devices from backend container ...")
    try:
        devices = fetch_devices_sync()
    except Exception as e:
        print(f"  ERROR: Cannot fetch devices ({e})")
        print("  Make sure pdm-backend container is running")
        sys.exit(1)

    print(f"  Found {len(devices)} devices:")
    for d in devices:
        profile = DEVICE_PROFILES.get(d["name"], "normal")
        print(f"    {d['name']} (id={d['id']}, type={d['device_type']}, profile={profile})")

    print(f"\n  Span: {DAYS} days, interval: {INTERVAL_SEC}s")
    print(f"  Per device: ~{POINTS_PER_DEVICE:,} points")
    print(f"  Total: ~{POINTS_PER_DEVICE * len(devices):,} data points")

    # 2. 初始化 TDengine schema
    print("\n[2/4] Initializing TDengine schema ...")
    async with httpx.AsyncClient(timeout=30) as client:
        await td_exec(client,
            f"CREATE DATABASE IF NOT EXISTS {settings.TDENGINE_DATABASE} KEEP 365 DURATION 10 BUFFER 16")
        await td_exec(client, (
            f"CREATE STABLE IF NOT EXISTS {settings.TDENGINE_DATABASE}.telemetry "
            "(ts TIMESTAMP, temperature FLOAT, vibration FLOAT, pressure FLOAT, rpm FLOAT) "
            "TAGS (device_id BINARY(64))"
        ))
    print("  OK")

    # 3. 清理旧数据
    print("\n[3/4] Dropping old child tables ...")
    async with httpx.AsyncClient(timeout=30) as client:
        for d in devices:
            tag = d["id"].replace("'", "")
            table = f"t_{tag}"
            await td_exec(client, f"DROP TABLE IF EXISTS {settings.TDENGINE_DATABASE}.{table}")
    print("  OK")

    # 4. 写入模拟数据
    start = datetime.now(timezone.utc) - timedelta(days=DAYS)
    print(f"\n[4/4] Ingesting simulated data (start: {start.isoformat()}) ...")

    total_written = 0
    async with httpx.AsyncClient(timeout=30) as client:
        for dev in devices:
            n = await ingest_device(client, dev, start)
            total_written += n

    elapsed = time.time() - t0
    print(f"\n{'=' * 60}")
    print(f"ALL DONE!")
    print(f"  Total rows: {total_written:,}")
    print(f"  Elapsed:    {elapsed:.1f}s")
    if elapsed > 0:
        print(f"  Rate:       {total_written / elapsed:,.0f} rows/s")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
