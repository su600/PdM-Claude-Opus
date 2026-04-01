import React, { useState } from 'react';
import {
  Card, Row, Col, Select, Button, Slider, Switch, Typography, Tag, Descriptions, Space, message, Divider,
  Collapse, InputNumber, Modal, Tooltip,
} from 'antd';
import { ExperimentOutlined, ThunderboltOutlined, SettingOutlined, UndoOutlined, CodeOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import api from '../api';
import type { Device, PredictionResult, AlgorithmOutput, PredictionConfig, AlgorithmParams } from '../types';
import { LEVEL_COLOR, ALERT_LEVEL_LABEL } from '../types';
import { useTheme } from '../ThemeContext';

const { Title, Text } = Typography;

interface Props {
  devices: Device[];
  config: PredictionConfig;
  onConfigChange: (config: PredictionConfig) => void;
}

const ALGO_LABELS: Record<string, string> = {
  rule_based: '规则引擎',
  statistical: '统计分析 (Z-score)',
  ml: '机器学习 (Isolation Forest)',
  deep_learning: '时序预测 (Holt 平滑)',
};

const ALGO_DESCRIPTIONS: Record<string, string> = {
  rule_based: '阈值评估 + 告警历史衰减计分',
  statistical: 'Z-score 异常检测 + 最小二乘趋势分析',
  ml: '隔离森林异常检测，纯 numpy 实现',
  deep_learning: 'Holt 双指数平滑，level+trend 分解外推',
};

const ALGO_SOURCE_FILES: Record<string, string> = {
  rule_based: 'rule_based.py',
  statistical: 'statistical.py',
  ml: 'isolation_forest.py',
  deep_learning: 'time_series.py',
};

const PARAM_LABELS: Record<string, string> = {
  // Rule-based
  temp_threshold: '温度阈值 (°C)',
  vibration_threshold: '振动阈值 (mm/s)',
  pressure_low: '压力下限 (MPa)',
  rpm_threshold: '转速上限 (rpm)',
  alert_decay: '告警衰减系数',
  base_rul: '基础 RUL (h)',
  // Statistical
  window_size: '统计窗口 (点数)',
  sigma_threshold: '异常阈值 (σ)',
  trend_weight: '趋势权重',
  // ML (Isolation Forest)
  n_trees: '隔离树数量',
  sample_size: '子采样大小',
  contamination: '异常比例',
  // Deep Learning (Holt)
  alpha: '水平平滑系数 (α)',
  beta: '趋势平滑系数 (β)',
  forecast_horizon: '预测范围 (h)',
};

const PARAM_CONFIG: Record<string, { min: number; max: number; step: number }> = {
  // Rule-based
  temp_threshold: { min: 50, max: 150, step: 1 },
  vibration_threshold: { min: 1, max: 30, step: 0.5 },
  pressure_low: { min: 0.1, max: 5, step: 0.1 },
  rpm_threshold: { min: 1000, max: 10000, step: 100 },
  alert_decay: { min: 0.01, max: 1, step: 0.01 },
  base_rul: { min: 10, max: 2000, step: 10 },
  // Statistical
  window_size: { min: 10, max: 500, step: 5 },
  sigma_threshold: { min: 1, max: 5, step: 0.1 },
  trend_weight: { min: 0, max: 1, step: 0.05 },
  // ML
  n_trees: { min: 10, max: 500, step: 10 },
  sample_size: { min: 8, max: 128, step: 8 },
  contamination: { min: 0.01, max: 0.5, step: 0.01 },
  // Deep Learning
  alpha: { min: 0.01, max: 0.99, step: 0.01 },
  beta: { min: 0.01, max: 0.99, step: 0.01 },
  forecast_horizon: { min: 1, max: 168, step: 1 },
};

export const DEFAULT_ALGO_PARAMS: AlgorithmParams = {
  rule_based: {
    temp_threshold: 85, vibration_threshold: 12, pressure_low: 1.5,
    rpm_threshold: 5000, alert_decay: 0.3, base_rul: 500,
  },
  statistical: {
    window_size: 50, sigma_threshold: 3.0, trend_weight: 0.4, base_rul: 500,
  },
  ml: {
    n_trees: 100, sample_size: 32, contamination: 0.1, base_rul: 400,
  },
  deep_learning: {
    alpha: 0.3, beta: 0.1, forecast_horizon: 24, base_rul: 400,
  },
};

export const DEFAULT_PREDICTION_CONFIG: PredictionConfig = {
  algorithms: { rule_based: true, statistical: true, ml: true, deep_learning: true },
  weights: { rule_based: 20, statistical: 25, ml: 30, deep_learning: 25 },
  thresholds: { high_risk: 70, medium_risk: 40 },
  algoParams: DEFAULT_ALGO_PARAMS,
};

const levelColor = LEVEL_COLOR;

// ── GitHub-style Python syntax highlighting ──────────
const GH_FONT = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

const GH_COLORS = {
  dark: {
    bg: '#0d1117', lineNoBg: '#0d1117', lineNoBorder: '#30363d',
    lineNo: '#7d8590', text: '#e6edf3', hoverBg: '#161b22',
    keyword: '#ff7b72', string: '#a5d6ff', comment: '#8b949e',
    number: '#79c0ff', func: '#d2a8ff', decorator: '#d2a8ff',
    builtin: '#79c0ff', className: '#ffa657', operator: '#ff7b72',
    self: '#79c0ff', fString: '#a5d6ff',
  },
  light: {
    bg: '#ffffff', lineNoBg: '#f6f8fa', lineNoBorder: '#d0d7de',
    lineNo: '#636c76', text: '#1F2328', hoverBg: '#f6f8fa',
    keyword: '#cf222e', string: '#0a3069', comment: '#6e7781',
    number: '#0550ae', func: '#8250df', decorator: '#8250df',
    builtin: '#0550ae', className: '#953800', operator: '#cf222e',
    self: '#0550ae', fString: '#0a3069',
  },
};

const PY_KEYWORDS = new Set([
  'def', 'class', 'if', 'elif', 'else', 'for', 'while', 'return', 'import', 'from',
  'as', 'with', 'try', 'except', 'finally', 'raise', 'yield', 'lambda', 'and', 'or',
  'not', 'in', 'is', 'pass', 'break', 'continue', 'global', 'nonlocal', 'assert',
  'async', 'await', 'del',
]);
const PY_BUILTINS = new Set(['True', 'False', 'None', 'self', 'cls']);

// Simple regex tokenizer for Python — handles the main visual elements
const PY_TOKEN_RE = /(@\w+)|("""[\s\S]*?"""|'''[\s\S]*?'''|f"(?:[^"\\]|\\.)*"|f'(?:[^'\\]|\\.)*"|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(#.*$)|(\b\d+\.?\d*(?:e[+-]?\d+)?\b)|(\b[a-zA-Z_]\w*\b)|([+\-*/%=<>!&|^~:]+)/gm;

function highlightPython(line: string, dark: boolean): React.ReactNode {
  const c = dark ? GH_COLORS.dark : GH_COLORS.light;
  if (!line) return '\u00A0';

  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let prevToken = '';

  const re = new RegExp(PY_TOKEN_RE.source, PY_TOKEN_RE.flags);
  let m: RegExpExecArray | null;

  while ((m = re.exec(line)) !== null) {
    // plain text before this token
    if (m.index > lastIdx) {
      parts.push(line.slice(lastIdx, m.index));
    }

    const [token, decorator, str, comment, num, word, op] = m;
    let color: string | undefined;

    if (decorator) color = c.decorator;
    else if (str) color = str.startsWith('f') ? c.fString : c.string;
    else if (comment) color = c.comment;
    else if (num) color = c.number;
    else if (word) {
      if (PY_KEYWORDS.has(word)) color = c.keyword;
      else if (PY_BUILTINS.has(word)) color = c.builtin;
      else if (prevToken === 'def') color = c.func;
      else if (prevToken === 'class') color = c.className;
      // look-ahead: is this word followed by '(' ? → function call
      else if (line[re.lastIndex] === '(') color = c.func;
    } else if (op) {
      color = undefined; // operators in default text color mostly, except some
    }

    if (word) prevToken = word;

    if (color) {
      parts.push(<span key={m.index} style={{ color }}>{token}</span>);
    } else {
      parts.push(token);
    }
    lastIdx = m.index + token.length;
  }

  if (lastIdx < line.length) parts.push(line.slice(lastIdx));
  return parts.length ? parts : '\u00A0';
}

export default function PredictionPage({ devices, config, onConfigChange }: Props) {
  const { mode } = useTheme();
  const isDark = mode === 'dark';
  const [deviceId, setDeviceId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [history, setHistory] = useState<PredictionResult[]>([]);
  const [sourceModal, setSourceModal] = useState<{ open: boolean; title: string; code: string; loading: boolean }>({
    open: false, title: '', code: '', loading: false,
  });

  const { algorithms, weights, thresholds, algoParams } = config;

  const setAlgorithms = (updater: (prev: Record<string, boolean>) => Record<string, boolean>) => {
    onConfigChange({ ...config, algorithms: updater(algorithms) });
  };
  const setWeights = (updater: (prev: Record<string, number>) => Record<string, number>) => {
    onConfigChange({ ...config, weights: updater(weights) });
  };
  const setThresholds = (updater: (prev: Record<string, number>) => Record<string, number>) => {
    onConfigChange({ ...config, thresholds: updater(thresholds) });
  };
  const setAlgoParams = (newParams: AlgorithmParams) => {
    onConfigChange({ ...config, algoParams: newParams });
  };

  const updateAlgoParam = (algo: string, key: string, value: number | null) => {
    if (value === null) return;
    setAlgoParams({
      ...algoParams,
      [algo]: { ...algoParams[algo as keyof AlgorithmParams], [key]: value },
    });
  };

  const resetAlgoParams = () => {
    setAlgoParams(DEFAULT_ALGO_PARAMS);
    message.success('已恢复默认参数');
  };

  // ── 计算归一化后的有效权重 ──────────
  const enabledTotalW = Object.entries(algorithms)
    .filter(([_, v]) => v)
    .reduce((s, [k]) => s + (weights[k] || 0), 0) || 1;

  const effectiveWeight = (key: string) =>
    algorithms[key] ? Math.round((weights[key] || 0) / enabledTotalW * 100) : 0;

  const viewSource = async (algoKey: string) => {
    const filename = ALGO_SOURCE_FILES[algoKey] || algoKey;
    setSourceModal({ open: true, title: `${ALGO_LABELS[algoKey]} — ${filename}`, code: '', loading: true });
    try {
      const res = await api.get(`/predictions/algorithms/${algoKey}/source`);
      setSourceModal((prev) => ({ ...prev, code: res.data, loading: false }));
    } catch {
      setSourceModal((prev) => ({ ...prev, code: '// 无法加载源代码', loading: false }));
    }
  };

  const runPrediction = async () => {
    if (!deviceId) { message.warning('请选择设备'); return; }
    setLoading(true);
    try {
      const normWeights: Record<string, number> = {};
      for (const [k, v] of Object.entries(weights)) {
        normWeights[k] = v / enabledTotalW;
      }

      const res = await api.post('/predictions/infer', {
        device_id: deviceId,
        algorithms,
        weights: normWeights,
        thresholds: { high_risk: thresholds.high_risk / 100, medium_risk: thresholds.medium_risk / 100 },
        algo_params: algoParams,
      });

      setResult(res.data);
      setHistory((prev) => [res.data, ...prev].slice(0, 10));

      // Auto save evaluation
      try {
        await api.post('/algo-governance/evaluations', {
          device_id: deviceId,
          prediction_id: res.data.id,
          hit_rate: Math.round(res.data.confidence * 100) / 100,
          false_alarm_rate: Math.round((1 - res.data.confidence) * 0.3 * 100) / 100,
          notes: `自动评估 - 风险等级: ${res.data.risk_level}`,
        });
      } catch {}

      message.success('预测完成');
    } catch (err: any) {
      message.error(err.response?.data?.detail || '预测失败');
    } finally {
      setLoading(false);
    }
  };

  // Algorithm contribution pie
  const pieOption = result ? {
    backgroundColor: 'transparent',
    tooltip: { backgroundColor: isDark ? '#1a2236' : '#ffffff', borderColor: isDark ? '#2a3654' : '#e2e8f0', textStyle: { color: isDark ? '#e2e8f0' : '#1e293b' } },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      label: { color: isDark ? '#94a3b8' : '#475569', fontSize: 12 },
      data: result.algorithm_outputs.map((o: AlgorithmOutput) => ({
        name: ALGO_LABELS[o.algorithm] || o.algorithm,
        value: Math.round(o.risk_score * 1000) / 10,
      })),
      itemStyle: {
        borderColor: isDark ? '#1a2236' : '#ffffff',
        borderWidth: 2,
      },
      emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } },
    }],
  } : null;

  // Risk trend line
  const trendOption = history.length > 1 ? {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' as const, backgroundColor: isDark ? '#1a2236' : '#ffffff', borderColor: isDark ? '#2a3654' : '#e2e8f0', textStyle: { color: isDark ? '#e2e8f0' : '#1e293b' } },
    grid: { top: 16, right: 16, bottom: 56, left: 48 },
    dataZoom: [
      { type: 'slider', height: 18, bottom: 4, borderColor: isDark ? '#2a3654' : '#cbd5e1', textStyle: { color: isDark ? '#94a3b8' : '#475569' } },
      { type: 'inside' },
    ],
    xAxis: {
      type: 'category' as const,
      data: history.map((_, i) => `#${history.length - i}`).reverse(),
      axisLabel: { color: isDark ? '#64748b' : '#475569', fontSize: 11 },
      axisLine: { lineStyle: { color: isDark ? '#2a3654' : '#cbd5e1' } },
    },
    yAxis: {
      type: 'value' as const,
      min: 0, max: 1,
      axisLabel: { color: isDark ? '#64748b' : '#475569', fontSize: 11 },
      splitLine: { lineStyle: { color: isDark ? 'rgba(42,54,84,0.4)' : 'rgba(203,213,225,0.5)' } },
    },
    series: [{
      type: 'line',
      data: [...history].reverse().map((h) => h.risk_score),
      smooth: true,
      lineStyle: { width: 3, color: '#3b82f6' },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(59,130,246,0.3)' },
            { offset: 1, color: 'rgba(59,130,246,0.02)' },
          ],
        },
      },
      itemStyle: { color: '#3b82f6' },
      markLine: {
        silent: true,
        lineStyle: { type: 'dashed' as const },
        data: [
          { yAxis: thresholds.high_risk / 100, lineStyle: { color: '#ef4444' }, label: { formatter: '高风险', color: '#ef4444' } },
          { yAxis: thresholds.medium_risk / 100, lineStyle: { color: '#eab308' }, label: { formatter: '中风险', color: '#eab308' } },
        ],
      },
    }],
  } : null;

  const algoParamItems = Object.entries(ALGO_LABELS)
    .filter(([key]) => algorithms[key])
    .map(([algoKey, algoLabel]) => ({
      key: algoKey,
      label: (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div>
            <span style={{ color: 'var(--text-primary)' }}>{algoLabel}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 8 }}>
              {ALGO_SOURCE_FILES[algoKey]}
            </span>
          </div>
          <Button
            type="link"
            size="small"
            icon={<CodeOutlined />}
            onClick={(e) => { e.stopPropagation(); viewSource(algoKey); }}
            style={{ fontSize: 12, padding: '0 4px' }}
          >
            源码
          </Button>
        </div>
      ),
      children: (
        <div>
          <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 8 }}>
            {ALGO_DESCRIPTIONS[algoKey]}
          </div>
          <Row gutter={[12, 8]}>
            {Object.entries(algoParams[algoKey as keyof AlgorithmParams] || {}).map(([paramKey, paramVal]) => (
              <Col xs={24} sm={12} key={paramKey}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Text style={{ color: 'var(--text-secondary)', fontSize: 12, width: 120, flexShrink: 0 }}>
                    {PARAM_LABELS[paramKey] || paramKey}
                  </Text>
                  <InputNumber
                    size="small"
                    value={paramVal}
                    min={PARAM_CONFIG[paramKey]?.min ?? 0}
                    max={PARAM_CONFIG[paramKey]?.max ?? 9999}
                    step={PARAM_CONFIG[paramKey]?.step ?? 0.01}
                    onChange={(v) => updateAlgoParam(algoKey, paramKey, v)}
                    style={{ flex: 1 }}
                  />
                </div>
              </Col>
            ))}
          </Row>
        </div>
      ),
    }));

  return (
    <div style={{ padding: '16px 0' }}>
      <Title level={4} style={{ color: 'var(--text-primary)', marginBottom: 16 }}>预测中心</Title>

      <Row gutter={[16, 16]}>
        {/* Left: Config panel */}
        <Col xs={24} lg={10}>
          <Card title="预测配置" size="small">
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              {/* Device select */}
              <div>
                <Text style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>选择设备</Text>
                <Select
                  style={{ width: '100%' }}
                  placeholder="选择目标设备"
                  value={deviceId || undefined}
                  onChange={setDeviceId}
                  options={devices.map((d) => ({ label: `${d.name} (${d.device_type})`, value: d.id }))}
                />
              </div>

              <Divider style={{ margin: '8px 0', borderColor: 'var(--border-color)' }} />

              {/* Algorithm switches */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text strong style={{ color: 'var(--text-primary)' }}>算法开关与权重</Text>
                  <Tooltip title="滑块设置相对权重，右侧蓝色标签为归一化后的实际占比。所有启用算法的实际占比之和 = 100%">
                    <Text style={{ color: 'var(--text-muted)', fontSize: 11, cursor: 'help', borderBottom: '1px dashed var(--text-muted)' }}>
                      相对权重 → 实际占比
                    </Text>
                  </Tooltip>
                </div>
                {Object.entries(ALGO_LABELS).map(([key, label]) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Switch
                      size="small"
                      checked={algorithms[key]}
                      onChange={(v) => setAlgorithms((p) => ({ ...p, [key]: v }))}
                    />
                    <Tooltip title={ALGO_DESCRIPTIONS[key]}>
                      <Text style={{ color: 'var(--text-primary)', width: 180, flexShrink: 0, fontSize: 13 }}>{label}</Text>
                    </Tooltip>
                    <Slider
                      min={0} max={100}
                      value={weights[key]}
                      onChange={(v) => setWeights((p) => ({ ...p, [key]: v }))}
                      disabled={!algorithms[key]}
                      style={{ flex: 1 }}
                      tooltip={{ formatter: (v) => `相对: ${v}` }}
                    />
                    <Tag
                      color={algorithms[key] ? 'blue' : undefined}
                      style={{ minWidth: 48, textAlign: 'center', margin: 0 }}
                    >
                      {effectiveWeight(key)}%
                    </Tag>
                  </div>
                ))}
              </div>

              <Divider style={{ margin: '8px 0', borderColor: 'var(--border-color)' }} />

              {/* Thresholds */}
              <div>
                <Text strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 8 }}>风险阈值</Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <Tag color="#ef4444">高风险</Tag>
                  <Slider min={0} max={100} value={thresholds.high_risk}
                    onChange={(v) => setThresholds((p) => ({ ...p, high_risk: v }))}
                    style={{ flex: 1 }} tooltip={{ formatter: (v) => `${v}%` }} />
                  <Text style={{ color: 'var(--text-muted)', width: 36 }}>{thresholds.high_risk}%</Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Tag color="#eab308">中风险</Tag>
                  <Slider min={0} max={100} value={thresholds.medium_risk}
                    onChange={(v) => setThresholds((p) => ({ ...p, medium_risk: v }))}
                    style={{ flex: 1 }} tooltip={{ formatter: (v) => `${v}%` }} />
                  <Text style={{ color: 'var(--text-muted)', width: 36 }}>{thresholds.medium_risk}%</Text>
                </div>
              </div>

              <Divider style={{ margin: '8px 0', borderColor: 'var(--border-color)' }} />

              {/* Advanced algorithm parameters */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text strong style={{ color: 'var(--text-primary)' }}>
                    <SettingOutlined style={{ marginRight: 6 }} />算法参数配置
                  </Text>
                  <Button size="small" icon={<UndoOutlined />} onClick={resetAlgoParams}>恢复默认</Button>
                </div>
                <Collapse
                  size="small"
                  items={algoParamItems}
                  style={{ background: 'var(--card-bg)' }}
                />
              </div>

              <Button
                type="primary"
                icon={<ExperimentOutlined />}
                size="large"
                block
                loading={loading}
                onClick={runPrediction}
                style={{ marginTop: 8, height: 48, fontSize: 16, borderRadius: 10 }}
              >
                运行预测
              </Button>
            </Space>
          </Card>
        </Col>

        {/* Right: Results */}
        <Col xs={24} lg={14}>
          {result ? (
            <Space direction="vertical" style={{ width: '100%' }} size={16}>
              {/* Result summary */}
              <Card size="small" title="预测结果">
                <Row gutter={[16, 16]}>
                  <Col span={8}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        fontSize: 40, fontWeight: 800,
                        color: levelColor[result.risk_level] || '#3b82f6',
                        lineHeight: 1,
                      }}>
                        {(result.risk_score * 100).toFixed(1)}
                      </div>
                      <Text style={{ color: 'var(--text-secondary)', fontSize: 12 }}>风险分</Text>
                    </div>
                  </Col>
                  <Col span={8}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 40, fontWeight: 800, color: '#06b6d4', lineHeight: 1 }}>
                        {result.rul_hours.toFixed(0)}
                      </div>
                      <Text style={{ color: 'var(--text-secondary)', fontSize: 12 }}>RUL (小时)</Text>
                    </div>
                  </Col>
                  <Col span={8}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 40, fontWeight: 800, color: '#a855f7', lineHeight: 1 }}>
                        {(result.confidence * 100).toFixed(1)}
                      </div>
                      <Text style={{ color: 'var(--text-secondary)', fontSize: 12 }}>置信度 %</Text>
                    </div>
                  </Col>
                </Row>
                <Divider style={{ margin: '16px 0 12px', borderColor: 'var(--border-color)' }} />
                <Descriptions column={1} size="small">
                  <Descriptions.Item label={<span style={{ color: 'var(--text-secondary)' }}>风险等级</span>}>
                    <Tag color={levelColor[result.risk_level]} style={{ fontWeight: 600 }}>
                      {ALERT_LEVEL_LABEL[result.risk_level] || result.risk_level.toUpperCase()}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label={<span style={{ color: 'var(--text-secondary)' }}>建议措施</span>}>
                    <span style={{ color: 'var(--text-primary)' }}>{result.recommendation}</span>
                  </Descriptions.Item>
                </Descriptions>

                {/* Algorithm details */}
                <Divider style={{ margin: '12px 0', borderColor: 'var(--border-color)' }} />
                <Text strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 8 }}>算法详情</Text>
                {result.algorithm_outputs.map((o) => (
                  <div key={o.algorithm} style={{
                    padding: '8px 0', borderBottom: '1px solid rgba(42,54,84,0.3)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Space>
                        <Text style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                          {ALGO_LABELS[o.algorithm] || o.algorithm}
                        </Text>
                        <Button
                          type="link"
                          size="small"
                          icon={<CodeOutlined />}
                          onClick={() => viewSource(o.algorithm)}
                          style={{ fontSize: 11, padding: 0, height: 'auto' }}
                        >
                          源码
                        </Button>
                      </Space>
                      <Space>
                        <Tag color="blue">风险 {(o.risk_score * 100).toFixed(1)}%</Tag>
                        <Tag color="cyan">RUL {o.rul_hours.toFixed(0)}h</Tag>
                        <Tag color="purple">置信 {(o.confidence * 100).toFixed(1)}%</Tag>
                      </Space>
                    </div>
                    {o.details && (
                      <Text style={{ color: 'var(--text-muted)', fontSize: 11, display: 'block' }}>
                        {o.details}
                      </Text>
                    )}
                  </div>
                ))}
              </Card>

              {/* Charts row */}
              <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                  <Card size="small" title="算法贡献">
                    {pieOption && <ReactECharts option={pieOption} style={{ height: 240 }} />}
                  </Card>
                </Col>
                <Col xs={24} md={12}>
                  <Card size="small" title="风险趋势 (最近10次)">
                    {trendOption ? (
                      <ReactECharts option={trendOption} style={{ height: 240 }} />
                    ) : (
                      <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                        需要至少 2 次预测生成趋势
                      </div>
                    )}
                  </Card>
                </Col>
              </Row>
            </Space>
          ) : (
            <Card style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                <ThunderboltOutlined style={{ fontSize: 64, marginBottom: 16, opacity: 0.3 }} />
                <div>选择设备并运行预测查看结果</div>
              </div>
            </Card>
          )}
        </Col>
      </Row>

      {/* Source code modal — GitHub style */}
      <Modal
        title={<span><CodeOutlined style={{ marginRight: 8 }} />{sourceModal.title}</span>}
        open={sourceModal.open}
        onCancel={() => setSourceModal((prev) => ({ ...prev, open: false }))}
        footer={null}
        width={960}
        styles={{ body: { padding: 0 } }}
      >
        {sourceModal.loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>加载中...</div>
        ) : (() => {
          const ghc = isDark ? GH_COLORS.dark : GH_COLORS.light;
          const lines = sourceModal.code.split('\n');
          const gutterWidth = String(lines.length).length * 8 + 24;
          return (
            <div style={{
              maxHeight: '78vh',
              overflow: 'auto',
              background: ghc.bg,
              borderRadius: '0 0 8px 8px',
              borderTop: `1px solid ${ghc.lineNoBorder}`,
            }}>
              <table style={{
                borderCollapse: 'collapse',
                width: '100%',
                fontFamily: GH_FONT,
                fontSize: 12,
                lineHeight: '20px',
                tabSize: 4,
              }}>
                <tbody>
                  {lines.map((line, i) => (
                    <tr
                      key={i}
                      className="gh-code-line"
                      style={{ background: 'transparent' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = ghc.hoverBg; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <td style={{
                        color: ghc.lineNo,
                        textAlign: 'right',
                        padding: '0 16px 0 16px',
                        userSelect: 'none',
                        width: gutterWidth,
                        minWidth: gutterWidth,
                        whiteSpace: 'nowrap',
                        verticalAlign: 'top',
                        fontFamily: GH_FONT,
                        fontSize: 12,
                        lineHeight: '20px',
                        background: ghc.lineNoBg,
                        borderRight: `1px solid ${ghc.lineNoBorder}`,
                        position: 'sticky',
                        left: 0,
                      }}>
                        {i + 1}
                      </td>
                      <td style={{
                        color: ghc.text,
                        padding: '0 16px',
                        whiteSpace: 'pre',
                        fontFamily: GH_FONT,
                        fontSize: 12,
                        lineHeight: '20px',
                        tabSize: 4,
                      }}>
                        {highlightPython(line, isDark)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
