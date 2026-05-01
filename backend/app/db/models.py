"""Pydantic models used across the application."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ── Enums ──────────────────────────────────────────────
class Role(str, Enum):
    admin = "admin"
    engineer = "engineer"
    supervisor = "supervisor"
    viewer = "viewer"


class AlertLevel(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class DeviceStatus(str, Enum):
    online = "online"
    offline = "offline"
    warning = "warning"
    error = "error"


# ── Auth ───────────────────────────────────────────────
class TokenRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ── User ───────────────────────────────────────────────
class UserCreate(BaseModel):
    username: str
    password: str
    role: Role = Role.viewer
    display_name: str = ""


class UserOut(BaseModel):
    id: str
    username: str
    role: Role
    display_name: str


# ── Device ─────────────────────────────────────────────
class DeviceCreate(BaseModel):
    name: str
    device_type: str
    location: str = ""
    status: DeviceStatus = DeviceStatus.online
    model: str = ""
    manufacturer: str = ""
    manufacture_year: int = 0
    serial_number: str = ""
    description: str = ""
    datasource_tag: str = ""


class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    device_type: Optional[str] = None
    location: Optional[str] = None
    status: Optional[DeviceStatus] = None
    model: Optional[str] = None
    manufacturer: Optional[str] = None
    manufacture_year: Optional[int] = None
    serial_number: Optional[str] = None
    description: Optional[str] = None
    datasource_tag: Optional[str] = None


class DeviceOut(BaseModel):
    id: str
    name: str
    device_type: str
    location: str
    status: DeviceStatus
    created_at: str
    model: str = ""
    manufacturer: str = ""
    manufacture_year: int = 0
    serial_number: str = ""
    description: str = ""
    datasource_tag: str = ""


# ── Alert ──────────────────────────────────────────────
class AlertCreate(BaseModel):
    device_id: str
    level: AlertLevel
    message: str
    metric: str = ""
    value: float = 0.0


class AlertOut(BaseModel):
    id: str
    device_id: str
    device_name: str = ""
    level: AlertLevel
    message: str
    metric: str
    value: float
    acknowledged: bool = False
    created_at: str


# ── Rule ───────────────────────────────────────────────
class RuleCreate(BaseModel):
    name: str
    device_type: str
    metric: str
    condition: str  # e.g. "> 80"
    level: AlertLevel
    enabled: bool = True


class RuleOut(BaseModel):
    id: str
    name: str
    device_type: str
    metric: str
    condition: str
    level: AlertLevel
    enabled: bool
    created_at: str


# ── Algorithm Parameters ───────────────────────────────
class AlgorithmParams(BaseModel):
    """各预测算法的真实可配置参数"""
    rule_based: Dict[str, float] = Field(default_factory=lambda: {
        "temp_threshold": 85.0,
        "vibration_threshold": 12.0,
        "pressure_low": 1.5,
        "rpm_threshold": 5000.0,
        "alert_decay": 0.3,
        "base_rul": 500.0,
    })
    statistical: Dict[str, float] = Field(default_factory=lambda: {
        "window_size": 50.0,
        "sigma_threshold": 3.0,
        "trend_weight": 0.4,
        "base_rul": 500.0,
    })
    ml: Dict[str, float] = Field(default_factory=lambda: {
        "n_trees": 100.0,
        "sample_size": 32.0,
        "contamination": 0.1,
        "base_rul": 400.0,
    })
    deep_learning: Dict[str, float] = Field(default_factory=lambda: {
        "alpha": 0.3,
        "beta": 0.1,
        "forecast_horizon": 24.0,
        "base_rul": 400.0,
    })


# ── Prediction ─────────────────────────────────────────
class PredictionRequest(BaseModel):
    device_id: str
    algorithms: Dict[str, bool] = Field(default_factory=lambda: {
        "rule_based": True, "statistical": True, "ml": True, "deep_learning": True
    })
    weights: Dict[str, float] = Field(default_factory=lambda: {
        "rule_based": 0.2, "statistical": 0.25, "ml": 0.3, "deep_learning": 0.25
    })
    thresholds: Dict[str, float] = Field(default_factory=lambda: {
        "high_risk": 0.7, "medium_risk": 0.4
    })
    algo_params: Optional[AlgorithmParams] = None


class AlgorithmOutput(BaseModel):
    algorithm: str
    risk_score: float
    rul_hours: float
    confidence: float
    details: str = ""


class PredictionResult(BaseModel):
    id: str
    device_id: str
    risk_score: float
    rul_hours: float
    confidence: float
    recommendation: str
    risk_level: str
    algorithm_outputs: List[AlgorithmOutput]
    created_at: str


# ── Algo Governance ────────────────────────────────────
class AlgoTemplate(BaseModel):
    id: str = ""
    name: str
    algorithms: Dict[str, bool] = {}
    weights: Dict[str, float] = {}
    thresholds: Dict[str, float] = {}
    algo_params: Dict[str, Dict[str, float]] = {}
    description: str = ""
    created_at: str = ""
    updated_at: str = ""


class Evaluation(BaseModel):
    id: str = ""
    device_id: str
    prediction_id: str
    hit_rate: float
    false_alarm_rate: float
    notes: str = ""
    created_at: str = ""


class AuditLog(BaseModel):
    id: str
    action: str
    target_type: str
    target_id: str
    user: str
    detail: str = ""
    created_at: str


# ── Notification ───────────────────────────────────────
class NotificationPush(BaseModel):
    title: str
    body: str
    level: AlertLevel = AlertLevel.medium
    target_url: str = ""


class NotificationEvent(BaseModel):
    id: str
    title: str
    body: str
    level: str
    status: str  # pending / success / failed
    target_url: str
    retries: int = 0
    error: str = ""
    created_at: str


# ── Telemetry ──────────────────────────────────────────
class TelemetryPoint(BaseModel):
    device_id: str
    ts: Optional[str] = None
    temperature: float = 0.0
    vibration: float = 0.0
    pressure: float = 0.0
    rpm: float = 0.0


# ── Health ─────────────────────────────────────────────
class HealthResponse(BaseModel):
    service: str  # "ok" or "error"
    tdengine: str  # "ok" or "error"


# ── Data Source ────────────────────────────────────────
class DataSourceConfig(BaseModel):
    id: str = ""
    name: str = "TDengine"
    ds_type: str = "tdengine"  # tdengine / mysql / postgres / influxdb
    host: str = "localhost"
    port: int = 6041
    username: str = "root"
    password: str = ""
    database: str = "pdm"
    enabled: bool = True
    status: str = "unknown"  # unknown / ok / error
    status_message: str = ""
    updated_at: str = ""


class DataSourceTestResult(BaseModel):
    ok: bool
    message: str
    latency_ms: float = 0.0


# ── Maintenance ───────────────────────────────────────
class MaintenanceType(str, Enum):
    preventive = "preventive"
    corrective = "corrective"
    predictive = "predictive"
    inspection = "inspection"


class MaintenanceRecordCreate(BaseModel):
    device_id: str
    date: str
    maintenance_type: MaintenanceType
    description: str
    operator: str
    cost: float = 0.0
    next_maintenance_date: Optional[str] = None


class MaintenanceRecordOut(BaseModel):
    id: str
    device_id: str
    date: str
    maintenance_type: MaintenanceType
    description: str
    operator: str
    cost: float
    next_maintenance_date: Optional[str] = None
    created_at: str


class InspectionOverviewItem(BaseModel):
    device_id: str
    device_name: str
    device_type: str
    location: str
    device_status: str
    last_maintenance_date: Optional[str] = None
    last_maintenance_type: Optional[str] = None
    last_operator: Optional[str] = None
    next_maintenance_date: Optional[str] = None
    days_until_next: Optional[int] = None
    inspection_status: str  # ok / upcoming / overdue / never


# ── System ────────────────────────────────────────────
class SystemInfo(BaseModel):
    version: str
    build_date: str
    tdengine_host: str
    tdengine_port: int
    tdengine_database: str
    tdengine_status: str
    backend_host: str
    backend_port: int
    notification_webhook_url: str
    notification_retry_max: int
    server_time: str
