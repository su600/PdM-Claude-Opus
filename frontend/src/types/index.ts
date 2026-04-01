/* ── Domain types ──────────────────────────────────── */

export type Role = 'admin' | 'engineer' | 'supervisor' | 'viewer';
export type AlertLevel = 'low' | 'medium' | 'high' | 'critical';
export type DeviceStatus = 'online' | 'offline' | 'warning' | 'error';

export interface User {
  id: string;
  username: string;
  role: Role;
  display_name: string;
}

export interface Device {
  id: string;
  name: string;
  device_type: string;
  location: string;
  status: DeviceStatus;
  created_at: string;
  model: string;
  manufacturer: string;
  manufacture_year: number;
  serial_number: string;
  description: string;
  datasource_tag: string;
}

export interface Alert {
  id: string;
  device_id: string;
  device_name: string;
  level: AlertLevel;
  message: string;
  metric: string;
  value: number;
  acknowledged: boolean;
  created_at: string;
}

export interface Rule {
  id: string;
  name: string;
  device_type: string;
  metric: string;
  condition: string;
  level: AlertLevel;
  enabled: boolean;
  created_at: string;
}

export interface AlgorithmOutput {
  algorithm: string;
  risk_score: number;
  rul_hours: number;
  confidence: number;
  details: string;
}

export interface PredictionResult {
  id: string;
  device_id: string;
  risk_score: number;
  rul_hours: number;
  confidence: number;
  recommendation: string;
  risk_level: string;
  algorithm_outputs: AlgorithmOutput[];
  created_at: string;
}

export interface AlgorithmParams {
  rule_based: Record<string, number>;
  statistical: Record<string, number>;
  ml: Record<string, number>;
  deep_learning: Record<string, number>;
}

export interface PredictionConfig {
  algorithms: Record<string, boolean>;
  weights: Record<string, number>;
  thresholds: Record<string, number>;
  algoParams: AlgorithmParams;
}

export interface AlgoTemplate {
  id: string;
  name: string;
  algorithms: Record<string, boolean>;
  weights: Record<string, number>;
  thresholds: Record<string, number>;
  algo_params: Record<string, Record<string, number>>;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface Evaluation {
  id: string;
  device_id: string;
  prediction_id: string;
  hit_rate: number;
  false_alarm_rate: number;
  notes: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  action: string;
  target_type: string;
  target_id: string;
  user: string;
  detail: string;
  created_at: string;
}

export interface NotificationEvent {
  id: string;
  title: string;
  body: string;
  level: string;
  status: string;
  target_url: string;
  retries: number;
  error: string;
  created_at: string;
}

export interface HealthStatus {
  service: string;
  tdengine: string;
}

export interface TelemetryPoint {
  ts: string;
  temperature: number;
  vibration: number;
  pressure: number;
  rpm: number;
}

export interface DataSource {
  id: string;
  name: string;
  ds_type: string;
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  enabled: boolean;
  status: string;
  status_message: string;
  updated_at: string;
}

export interface DataSourceTestResult {
  ok: boolean;
  message: string;
  latency_ms: number;
}

/* ── 统一中文标签映射 ─────────────────────────────── */

export const DEVICE_STATUS_LABEL: Record<string, string> = {
  online: '在线', offline: '离线', warning: '告警', error: '故障',
};

export const ALERT_LEVEL_LABEL: Record<string, string> = {
  low: '低', medium: '中', high: '高', critical: '危急',
};

export const NOTIF_STATUS_LABEL: Record<string, string> = {
  pending: '待发送', success: '成功', failed: '失败',
};

export const LEVEL_COLOR: Record<string, string> = {
  low: '#22c55e', medium: '#eab308', high: '#f97316', critical: '#ef4444',
};

/* ── Maintenance ─────────────────────────────────────── */

export type MaintenanceType = 'preventive' | 'corrective' | 'predictive' | 'inspection';

export interface MaintenanceRecord {
  id: string;
  device_id: string;
  date: string;
  maintenance_type: MaintenanceType;
  description: string;
  operator: string;
  cost: number;
  created_at: string;
}

export const MAINTENANCE_TYPE_LABEL: Record<string, string> = {
  preventive: '预防性维护', corrective: '纠正性维修', predictive: '预测性维护', inspection: '巡检',
};

export const MAINTENANCE_TYPE_COLOR: Record<string, string> = {
  preventive: '#3b82f6', corrective: '#ef4444', predictive: '#a855f7', inspection: '#22c55e',
};

/* ── System ──────────────────────────────────────────── */

export interface SystemInfo {
  version: string;
  build_date: string;
  tdengine_host: string;
  tdengine_port: number;
  tdengine_database: string;
  tdengine_status: string;
  backend_host: string;
  backend_port: number;
  notification_webhook_url: string;
  notification_retry_max: number;
  server_time: string;
}
