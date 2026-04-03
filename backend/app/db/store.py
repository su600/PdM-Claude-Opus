"""SQLite-backed store: CRUD functions for all domain collections.

All data (users, devices, alerts, rules, predictions, templates, evaluations,
audit_logs, notification_events, datasources, maintenance_records, system_settings)
is persisted in /app/data/pdm.db via the database.tx() context manager.
"""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone

from app.db.database import tx

_now = lambda: datetime.now(timezone.utc).isoformat()
_id  = lambda: uuid.uuid4().hex[:12]


def _stable_id(namespace: str, name: str) -> str:
    return hashlib.sha256(f"{namespace}:{name}".encode()).hexdigest()[:12]


def _row(r) -> dict | None:
    return dict(r) if r else None

def _rows(rs) -> list[dict]:
    return [dict(r) for r in rs]


# ── Users ───────────────────────────────────────────────────────────────────

def get_user(uid: str) -> dict | None:
    with tx() as c:
        return _row(c.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone())

def get_user_by_username(username: str) -> dict | None:
    with tx() as c:
        return _row(c.execute("SELECT * FROM users WHERE username=?", (username,)).fetchone())

def get_all_users() -> list[dict]:
    with tx() as c:
        return _rows(c.execute("SELECT * FROM users").fetchall())

def create_user(data: dict) -> dict:
    with tx() as c:
        c.execute(
            "INSERT INTO users(id,username,hashed_password,role,display_name) VALUES(?,?,?,?,?)",
            (data["id"], data["username"], data["hashed_password"],
             data["role"], data["display_name"]),
        )
    return data


# ── Devices ─────────────────────────────────────────────────────────────────

def get_all_devices() -> list[dict]:
    with tx() as c:
        return _rows(c.execute("SELECT * FROM devices ORDER BY created_at").fetchall())

def get_device(did: str) -> dict | None:
    with tx() as c:
        return _row(c.execute("SELECT * FROM devices WHERE id=?", (did,)).fetchone())

def create_device(data: dict) -> dict:
    with tx() as c:
        c.execute(
            "INSERT INTO devices(id,name,device_type,location,status,model,manufacturer,"
            "manufacture_year,serial_number,description,datasource_tag,created_at) "
            "VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
            (data["id"], data["name"], data["device_type"], data["location"], data["status"],
             data.get("model"), data.get("manufacturer"), data.get("manufacture_year"),
             data.get("serial_number"), data.get("description"),
             data.get("datasource_tag"), data["created_at"]),
        )
    return get_device(data["id"])

def update_device(did: str, updates: dict) -> dict | None:
    _allowed = {"name","device_type","location","status","model","manufacturer",
                "manufacture_year","serial_number","description","datasource_tag"}
    fields = {k: v for k, v in updates.items() if k in _allowed}
    if fields:
        set_clause = ", ".join(f"{k}=?" for k in fields)
        with tx() as c:
            c.execute(f"UPDATE devices SET {set_clause} WHERE id=?",
                      list(fields.values()) + [did])
    return get_device(did)

def delete_device(did: str) -> bool:
    with tx() as c:
        c.execute("DELETE FROM maintenance_records WHERE device_id=?", (did,))
        cur = c.execute("DELETE FROM devices WHERE id=?", (did,))
        return cur.rowcount > 0


# ── Alerts ──────────────────────────────────────────────────────────────────

def get_all_alerts() -> list[dict]:
    with tx() as c:
        return _rows(c.execute("SELECT * FROM alerts ORDER BY created_at DESC").fetchall())

def get_alerts_for_device(device_id: str) -> list[dict]:
    with tx() as c:
        return _rows(c.execute(
            "SELECT * FROM alerts WHERE device_id=? ORDER BY created_at DESC",
            (device_id,)).fetchall())

def create_alert(data: dict) -> dict:
    with tx() as c:
        c.execute(
            "INSERT INTO alerts(id,device_id,device_name,level,message,metric,"
            "value,acknowledged,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
            (data["id"], data["device_id"], data["device_name"], data["level"],
             data["message"], data.get("metric"), data.get("value"), 0, data["created_at"]),
        )
    return data


# ── Rules ────────────────────────────────────────────────────────────────────

def _rule_row(r: dict) -> dict:
    if r:
        r["condition"] = r.pop("condition_expr", r.get("condition", ""))
        r["enabled"] = bool(r.get("enabled", 1))
    return r

def get_all_rules() -> list[dict]:
    with tx() as c:
        return [_rule_row(r) for r in _rows(c.execute("SELECT * FROM rules ORDER BY created_at").fetchall())]

def get_rule(rid: str) -> dict | None:
    with tx() as c:
        r = _row(c.execute("SELECT * FROM rules WHERE id=?", (rid,)).fetchone())
        return _rule_row(r) if r else None

def create_rule(data: dict) -> dict:
    with tx() as c:
        c.execute(
            "INSERT INTO rules(id,name,device_type,metric,condition_expr,level,enabled,created_at) "
            "VALUES(?,?,?,?,?,?,?,?)",
            (data["id"], data["name"], data["device_type"], data["metric"],
             data["condition"], data["level"], 1 if data.get("enabled", True) else 0,
             data["created_at"]),
        )
    return get_rule(data["id"])

def update_rule(rid: str, updates: dict) -> dict | None:
    if "enabled" in updates:
        with tx() as c:
            c.execute("UPDATE rules SET enabled=? WHERE id=?",
                      (1 if updates["enabled"] else 0, rid))
    return get_rule(rid)


# ── Predictions ──────────────────────────────────────────────────────────────

def _pred_row(r: dict) -> dict:
    if r:
        raw = r.get("algorithm_outputs") or "[]"
        r["algorithm_outputs"] = json.loads(raw) if isinstance(raw, str) else raw
    return r

def get_all_predictions() -> list[dict]:
    with tx() as c:
        return [_pred_row(r) for r in _rows(
            c.execute("SELECT * FROM predictions ORDER BY created_at DESC").fetchall())]

def get_predictions_for_device(device_id: str) -> list[dict]:
    with tx() as c:
        return [_pred_row(r) for r in _rows(c.execute(
            "SELECT * FROM predictions WHERE device_id=? ORDER BY created_at DESC",
            (device_id,)).fetchall())]

def prediction_stats() -> dict:
    with tx() as c:
        r = c.execute("SELECT COUNT(*) cnt, AVG(risk_score) avg FROM predictions").fetchone()
        return {"count": r["cnt"] or 0, "avg_risk": round(r["avg"] or 0, 4)}

def append_prediction(data: dict) -> None:
    ao = data.get("algorithm_outputs", [])
    if ao and hasattr(ao[0], "model_dump"):
        ao = [o.model_dump() for o in ao]
    with tx() as c:
        c.execute(
            "INSERT INTO predictions(id,device_id,risk_score,rul_hours,confidence,"
            "risk_level,recommendation,algorithm_outputs,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
            (data["id"], data["device_id"], data.get("risk_score"), data.get("rul_hours"),
             data.get("confidence"), data.get("risk_level"), data.get("recommendation"),
             json.dumps(ao, default=str), data["created_at"]),
        )
        # Keep only 200 most recent rows
        c.execute(
            "DELETE FROM predictions WHERE id NOT IN "
            "(SELECT id FROM predictions ORDER BY created_at DESC LIMIT 200)"
        )


# ── Templates ────────────────────────────────────────────────────────────────

def _tmpl_row(r: dict) -> dict:
    for field in ("algorithms", "weights", "thresholds", "algo_params"):
        v = r.get(field)
        if v and isinstance(v, str):
            r[field] = json.loads(v)
    return r

def get_all_templates() -> list[dict]:
    with tx() as c:
        return [_tmpl_row(r) for r in _rows(
            c.execute("SELECT * FROM templates ORDER BY created_at").fetchall())]

def get_template(tid: str) -> dict | None:
    with tx() as c:
        r = _row(c.execute("SELECT * FROM templates WHERE id=?", (tid,)).fetchone())
        return _tmpl_row(r) if r else None

def create_template(data: dict) -> dict:
    with tx() as c:
        c.execute(
            "INSERT INTO templates(id,name,algorithms,weights,thresholds,"
            "algo_params,description,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",
            (data["id"], data["name"],
             json.dumps(data.get("algorithms", {})),
             json.dumps(data.get("weights", {})),
             json.dumps(data.get("thresholds", {})),
             json.dumps(data.get("algo_params")) if data.get("algo_params") else None,
             data.get("description"), data["created_at"], data["updated_at"]),
        )
    return get_template(data["id"])

def update_template(tid: str, data: dict) -> dict | None:
    with tx() as c:
        c.execute(
            "UPDATE templates SET name=?,algorithms=?,weights=?,thresholds=?,"
            "algo_params=?,description=?,updated_at=? WHERE id=?",
            (data["name"],
             json.dumps(data.get("algorithms", {})),
             json.dumps(data.get("weights", {})),
             json.dumps(data.get("thresholds", {})),
             json.dumps(data.get("algo_params")) if data.get("algo_params") else None,
             data.get("description"), data["updated_at"], tid),
        )
    return get_template(tid)

def delete_template(tid: str) -> bool:
    with tx() as c:
        cur = c.execute("DELETE FROM templates WHERE id=?", (tid,))
        return cur.rowcount > 0


# ── Evaluations ──────────────────────────────────────────────────────────────

def get_all_evaluations() -> list[dict]:
    with tx() as c:
        return _rows(c.execute("SELECT * FROM evaluations ORDER BY created_at DESC").fetchall())

def create_evaluation(data: dict) -> dict:
    with tx() as c:
        c.execute(
            "INSERT INTO evaluations(id,device_id,prediction_id,hit_rate,"
            "false_alarm_rate,notes,created_at) VALUES(?,?,?,?,?,?,?)",
            (data["id"], data["device_id"], data.get("prediction_id"),
             data.get("hit_rate"), data.get("false_alarm_rate"),
             data.get("notes"), data["created_at"]),
        )
    return data


# ── Audit Logs ───────────────────────────────────────────────────────────────

def get_all_audit_logs() -> list[dict]:
    with tx() as c:
        rows = _rows(c.execute(
            "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500").fetchall())
        for r in rows:
            r["user"] = r.pop("username", "")
        return rows

def append_audit_log(data: dict) -> None:
    username = data.get("user") or data.get("username", "")
    with tx() as c:
        c.execute(
            "INSERT INTO audit_logs(id,action,target_type,target_id,username,detail,created_at) "
            "VALUES(?,?,?,?,?,?,?)",
            (data["id"], data["action"], data["target_type"], data["target_id"],
             username, data.get("detail"), data["created_at"]),
        )


# ── Notification Events ──────────────────────────────────────────────────────

def get_all_notification_events() -> list[dict]:
    with tx() as c:
        return _rows(c.execute(
            "SELECT * FROM notification_events ORDER BY created_at DESC").fetchall())

def get_failed_notification_events() -> list[dict]:
    with tx() as c:
        return _rows(c.execute(
            "SELECT * FROM notification_events WHERE status='failed'").fetchall())

def create_notification_event(data: dict) -> dict:
    with tx() as c:
        c.execute(
            "INSERT INTO notification_events(id,title,body,level,status,target_url,"
            "retries,error,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
            (data["id"], data["title"], data["body"], data["level"],
             data.get("status", "pending"), data.get("target_url"),
             data.get("retries", 0), data.get("error", ""), data["created_at"]),
        )
    return data

def update_notification_event(eid: str, updates: dict) -> None:
    _allowed = {"status", "retries", "error"}
    fields = {k: v for k, v in updates.items() if k in _allowed}
    if not fields:
        return
    set_clause = ", ".join(f"{k}=?" for k in fields)
    with tx() as c:
        c.execute(f"UPDATE notification_events SET {set_clause} WHERE id=?",
                  list(fields.values()) + [eid])


# ── Datasources ──────────────────────────────────────────────────────────────

def _ds_row(r: dict) -> dict:
    if r:
        r["database"] = r.pop("database_name", r.get("database", ""))
        r["enabled"] = bool(r.get("enabled", 1))
    return r

def get_all_datasources() -> list[dict]:
    with tx() as c:
        return [_ds_row(r) for r in _rows(c.execute("SELECT * FROM datasources").fetchall())]

def get_datasource(dsid: str) -> dict | None:
    with tx() as c:
        r = _row(c.execute("SELECT * FROM datasources WHERE id=?", (dsid,)).fetchone())
        return _ds_row(r) if r else None

def create_datasource(data: dict) -> dict:
    with tx() as c:
        c.execute(
            "INSERT INTO datasources(id,name,ds_type,host,port,username,password,"
            "database_name,enabled,status,status_message,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
            (data["id"], data["name"], data["ds_type"], data.get("host"), data.get("port"),
             data.get("username"), data.get("password"), data.get("database"),
             1 if data.get("enabled", True) else 0,
             data.get("status", "unknown"), data.get("status_message", ""), data.get("updated_at")),
        )
    return get_datasource(data["id"])

def update_datasource(dsid: str, updates: dict) -> dict | None:
    _allowed = {"name","ds_type","host","port","username","password","database_name",
                "enabled","status","status_message","updated_at"}
    if "database" in updates:
        updates["database_name"] = updates.pop("database")
    if "enabled" in updates:
        updates["enabled"] = 1 if updates["enabled"] else 0
    fields = {k: v for k, v in updates.items() if k in _allowed}
    if fields:
        set_clause = ", ".join(f"{k}=?" for k in fields)
        with tx() as c:
            c.execute(f"UPDATE datasources SET {set_clause} WHERE id=?",
                      list(fields.values()) + [dsid])
    return get_datasource(dsid)

def delete_datasource(dsid: str) -> bool:
    with tx() as c:
        cur = c.execute("DELETE FROM datasources WHERE id=?", (dsid,))
        return cur.rowcount > 0


# ── Maintenance Records ──────────────────────────────────────────────────────

def get_maintenance_for_device(device_id: str) -> list[dict]:
    with tx() as c:
        return _rows(c.execute(
            "SELECT * FROM maintenance_records WHERE device_id=? ORDER BY date DESC",
            (device_id,)).fetchall())

def get_maintenance_record(mid: str) -> dict | None:
    with tx() as c:
        return _row(c.execute("SELECT * FROM maintenance_records WHERE id=?", (mid,)).fetchone())

def create_maintenance_record(data: dict) -> dict:
    with tx() as c:
        c.execute(
            "INSERT INTO maintenance_records(id,device_id,date,maintenance_type,"
            "description,operator,cost,created_at) VALUES(?,?,?,?,?,?,?,?)",
            (data["id"], data["device_id"], data["date"], data["maintenance_type"],
             data.get("description"), data.get("operator"), data.get("cost"), data["created_at"]),
        )
    return data

def delete_maintenance_record(mid: str) -> bool:
    with tx() as c:
        cur = c.execute("DELETE FROM maintenance_records WHERE id=?", (mid,))
        return cur.rowcount > 0


# ── System Settings ──────────────────────────────────────────────────────────

def get_system_settings() -> dict:
    with tx() as c:
        rows = c.execute("SELECT key, value FROM system_settings").fetchall()
    result: dict = {}
    for r in rows:
        try:
            result[r["key"]] = json.loads(r["value"])
        except (json.JSONDecodeError, ValueError):
            result[r["key"]] = r["value"]
    return result

def update_system_settings(updates: dict) -> dict:
    with tx() as c:
        for k, v in updates.items():
            c.execute("INSERT OR REPLACE INTO system_settings(key,value) VALUES(?,?)",
                      (k, json.dumps(v)))
    return get_system_settings()


# ── Bootstrap ────────────────────────────────────────────────────────────────

def is_empty() -> bool:
    with tx() as c:
        r = c.execute("SELECT COUNT(*) cnt FROM users").fetchone()
        return r["cnt"] == 0


def seed() -> None:
    """Populate demo data on first run (called once when DB is empty)."""
    from app.core.config import settings
    from app.core.security import hash_password
    from app.db.models import AlertLevel, DeviceStatus

    admin_id = _id()
    create_user({
        "id": admin_id, "username": "admin",
        "hashed_password": hash_password("Admin@123"),
        "role": "admin", "display_name": "系统管理员",
    })

    demo_devices = [
        ("CNC-001", "机加中心",  "A栋-1层", DeviceStatus.online,
         "VMC-850", "沈阳机床", 2021, "SN-CNC-20210315", "五轴立式加工中心，用于航空结构件精密加工"),
        ("AFP-002", "复材铺丝机","B栋-2层", DeviceStatus.online,
         "AFP-3000","中航复材", 2022, "SN-AFP-20220610", "大型自动铺丝机，碳纤维复合材料成型"),
        ("LW-003",  "激光焊接机","C栋-1层", DeviceStatus.warning,
         "LW-5000", "华工激光", 2020, "SN-LW-20200801",  "光纤激光焊接系统，钛合金薄壁件焊接"),
        ("INS-004", "检验监测仪","A栋-3层", DeviceStatus.online,
         "CMM-Pro", "海克斯康", 2023, "SN-INS-20230112", "三坐标精密检测系统，尺寸与形位公差测量"),
        ("CNC-005", "机加中心",  "A栋-2层", DeviceStatus.offline,
         "VMC-650", "大连机床",  2019, "SN-CNC-20190720", "三轴立式加工中心，通用零件加工"),
        ("AFP-006", "复材铺丝机","B栋-1层", DeviceStatus.online,
         "AFP-1500","中航复材", 2023, "SN-AFP-20230305", "中型自动铺丝机，小型复材构件铺放"),
    ]
    device_ids: list[str] = []
    for name, dtype, loc, status, model, mfr, year, sn, desc in demo_devices:
        did = _stable_id("device", name)
        create_device({
            "id": did, "name": name, "device_type": dtype, "location": loc,
            "status": status.value, "model": model, "manufacturer": mfr,
            "manufacture_year": year, "serial_number": sn, "description": desc,
            "datasource_tag": did, "created_at": _now(),
        })
        device_ids.append(did)

    devs = {d["id"]: d for d in get_all_devices()}
    for dev_id, level, msg, metric, val in [
        (device_ids[2], "high",     "主轴温度超阈值",   "temperature", 92.5),
        (device_ids[2], "critical", "振动频率异常飙升", "vibration",   15.8),
        (device_ids[4], "medium",   "润滑油压力偏低",   "pressure",    1.2),
        (device_ids[0], "low",      "转速轻微波动",     "rpm",         3002.0),
    ]:
        create_alert({
            "id": _id(), "device_id": dev_id,
            "device_name": devs.get(dev_id, {}).get("name", ""),
            "level": level, "message": msg, "metric": metric,
            "value": val, "acknowledged": False, "created_at": _now(),
        })

    for name, dtype, metric, cond, level in [
        ("温度过高告警", "机加中心",   "temperature", "> 85",  AlertLevel.high),
        ("振动异常告警", "激光焊接机", "vibration",   "> 12",  AlertLevel.critical),
        ("压力偏低告警", "机加中心",   "pressure",    "< 1.5", AlertLevel.medium),
        ("转速超限告警", "复材铺丝机", "rpm",         "> 5000",AlertLevel.high),
    ]:
        create_rule({
            "id": _id(), "name": name, "device_type": dtype, "metric": metric,
            "condition": cond, "level": level.value, "enabled": True, "created_at": _now(),
        })

    dsid = _id()
    create_datasource({
        "id": dsid, "name": "TDengine (默认)", "ds_type": "tdengine",
        "host": settings.TDENGINE_HOST, "port": settings.TDENGINE_PORT,
        "username": settings.TDENGINE_USER, "password": settings.TDENGINE_PASSWORD,
        "database": settings.TDENGINE_DATABASE,
        "enabled": True, "status": "unknown", "status_message": "", "updated_at": _now(),
    })

    tid = _id()
    create_template({
        "id": tid, "name": "默认均衡模板",
        "algorithms": {"rule_based": True, "statistical": True, "ml": True, "deep_learning": True},
        "weights":    {"rule_based": 0.2,  "statistical": 0.25, "ml": 0.3, "deep_learning": 0.25},
        "thresholds": {"high_risk": 0.7, "medium_risk": 0.4},
        "algo_params": {
            "rule_based":    {"temp_threshold": 85.0, "vibration_threshold": 12.0,
                              "pressure_low": 1.5, "rpm_threshold": 5000.0,
                              "alert_decay": 0.3, "base_rul": 500.0},
            "statistical":   {"window_size": 50.0, "sigma_threshold": 3.0,
                              "trend_weight": 0.4, "base_rul": 500.0},
            "ml":            {"n_trees": 100.0, "sample_size": 32.0,
                              "contamination": 0.1, "base_rul": 400.0},
            "deep_learning": {"alpha": 0.3, "beta": 0.1,
                              "forecast_horizon": 24.0, "base_rul": 400.0},
        },
        "description": "四算法均衡权重模板",
        "created_at": _now(), "updated_at": _now(),
    })

    for dev_id, date, mtype, desc, operator, cost in [
        (device_ids[0], "2025-08-15", "preventive",  "主轴润滑油更换及冷却系统清洗",       "张工", 2800.0),
        (device_ids[0], "2025-11-20", "corrective",  "X轴丝杠更换，消除定位误差",           "李工", 15600.0),
        (device_ids[0], "2026-02-10", "inspection",  "年度精度检测与校准",                  "张工", 1200.0),
        (device_ids[1], "2025-09-10", "inspection",  "铺丝头张力校准及导轨清洁",            "王工", 1200.0),
        (device_ids[1], "2026-01-05", "preventive",  "伺服电机保养及编码器检查",            "王工", 3500.0),
        (device_ids[2], "2025-07-22", "corrective",  "激光器光路校准，功率恢复至额定值",    "陈工", 8500.0),
        (device_ids[2], "2025-10-18", "preventive",  "冷却水路清洗及滤芯更换",              "陈工", 2200.0),
        (device_ids[2], "2026-03-01", "predictive",  "基于振动趋势预警，提前更换轴承",      "李工", 6800.0),
        (device_ids[3], "2025-06-30", "inspection",  "测头更换及测量软件升级",              "赵工", 4500.0),
        (device_ids[3], "2025-12-15", "preventive",  "气浮轴承维护及空气滤芯更换",          "赵工", 1800.0),
        (device_ids[4], "2025-05-12", "corrective",  "主轴电机绕组故障维修",                "张工", 22000.0),
        (device_ids[4], "2025-09-28", "preventive",  "刀库换刀机构保养及刀爪更换",          "李工", 3200.0),
        (device_ids[4], "2026-01-20", "corrective",  "Y轴伺服驱动器更换",                   "张工", 12500.0),
        (device_ids[5], "2025-10-05", "inspection",  "铺丝精度验证及软件参数优化",          "王工", 900.0),
        (device_ids[5], "2026-02-28", "preventive",  "导轨润滑及张力传感器校准",            "王工", 2100.0),
    ]:
        create_maintenance_record({
            "id": _id(), "device_id": dev_id, "date": date,
            "maintenance_type": mtype, "description": desc,
            "operator": operator, "cost": cost, "created_at": _now(),
        })

    update_system_settings({"notification_webhook_url": "", "notification_retry_max": 3})
