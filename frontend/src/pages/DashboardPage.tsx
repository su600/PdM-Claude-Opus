import React, { useEffect, useState } from 'react';
import {
  Card, Row, Col, Table, Tag, Statistic, Space, Button, Select, Empty, message,
} from 'antd';
import {
  DesktopOutlined, WarningOutlined, ThunderboltOutlined, LineChartOutlined, ReloadOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import api from '../api';
import type { Device, Alert, TelemetryPoint } from '../types';
import { LEVEL_COLOR, ALERT_LEVEL_LABEL } from '../types';
import { useTheme } from '../ThemeContext';

interface Props {
  devices: Device[];
  alerts: Alert[];
}

const levelColor = LEVEL_COLOR;

export default function DashboardPage({ devices, alerts }: Props) {
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
  const [predCount, setPredCount] = useState(0);
  const [avgRisk, setAvgRisk] = useState(0);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const { mode } = useTheme();
  const isDark = mode === 'dark';

  const onlineCount = devices.filter((d) => d.status === 'online').length;
  const highAlertCount = alerts.filter((a) => a.level === 'high' || a.level === 'critical').length;
  const availability = devices.length ? Math.round((onlineCount / devices.length) * 100) : 0;
  const avgRiskPct = Math.round(avgRisk * 100);
  const selectedDevice = devices.find((device) => device.id === selectedDeviceId) || devices[0];

  const fetchTelemetry = async (deviceId: string) => {
    try {
      const response = await api.get(`/telemetry/${deviceId}?limit=200`);
      if (Array.isArray(response.data) && response.data.length > 0) {
        setTelemetry(response.data.reverse());
      } else {
        setTelemetry([]);
      }
    } catch {
      setTelemetry([]);
    }
  };

  const fetchPredictionStats = async () => {
    try {
      const response = await api.get('/predictions/stats');
      setPredCount(response.data.count || 0);
      setAvgRisk(response.data.avg_risk || 0);
    } catch {
      setPredCount(0);
      setAvgRisk(0);
    }
  };

  useEffect(() => {
    if (!devices.length) {
      setSelectedDeviceId('');
      setTelemetry([]);
      return;
    }
    const selectedStillExists = devices.some((device) => device.id === selectedDeviceId);
    if (!selectedStillExists) {
      setSelectedDeviceId(devices[0].id);
    }
  }, [devices, selectedDeviceId]);

  useEffect(() => {
    if (selectedDeviceId) {
      void fetchTelemetry(selectedDeviceId);
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    void fetchPredictionStats();
  }, []);

  const tooltipStyle = {
    backgroundColor: isDark ? '#1a2236' : '#ffffff',
    borderColor: isDark ? '#2a3654' : '#e2e8f0',
    textStyle: { color: isDark ? '#e2e8f0' : '#1e293b' },
  };
  const axisLbl = { color: isDark ? '#64748b' : '#475569', fontSize: 11 };
  const axisLn = { lineStyle: { color: isDark ? '#2a3654' : '#cbd5e1' } };
  const splitLn = { lineStyle: { color: isDark ? 'rgba(42,54,84,0.4)' : 'rgba(203,213,225,0.5)' } };

  const chartOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' as const, ...tooltipStyle },
    legend: {
      data: ['温度 (°C)', '振动 (mm/s)', '压力 (MPa)', 'RPM'],
      textStyle: { color: isDark ? '#94a3b8' : '#475569' },
      top: 0,
    },
    grid: { top: 40, right: 60, bottom: 60, left: 48 },
    dataZoom: [
      { type: 'slider', height: 20, bottom: 8, borderColor: isDark ? '#2a3654' : '#cbd5e1', textStyle: { color: isDark ? '#94a3b8' : '#475569' } },
      { type: 'inside' },
    ],
    xAxis: {
      type: 'category' as const,
      data: telemetry.map((t) => {
        const d = new Date(t.ts);
        return `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      }),
      axisLabel: { ...axisLbl, rotate: 30 },
      axisLine: axisLn,
    },
    yAxis: [
      {
        type: 'value' as const,
        name: '温度/振动/压力',
        nameTextStyle: { color: isDark ? '#64748b' : '#475569', fontSize: 10 },
        axisLabel: axisLbl,
        splitLine: splitLn,
      },
      {
        type: 'value' as const,
        name: 'RPM',
        nameTextStyle: { color: isDark ? '#64748b' : '#475569', fontSize: 10 },
        axisLabel: axisLbl,
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '温度 (°C)',
        type: 'line',
        data: telemetry.map((t) => t.temperature),
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2 },
        itemStyle: { color: '#f97316' },
        areaStyle: { color: 'rgba(249,115,22,0.08)' },
      },
      {
        name: '振动 (mm/s)',
        type: 'line',
        data: telemetry.map((t) => t.vibration),
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2 },
        itemStyle: { color: '#3b82f6' },
        areaStyle: { color: 'rgba(59,130,246,0.08)' },
      },
      {
        name: '压力 (MPa)',
        type: 'line',
        data: telemetry.map((t) => t.pressure),
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2 },
        itemStyle: { color: '#22c55e' },
        areaStyle: { color: 'rgba(34,197,94,0.08)' },
      },
      {
        name: 'RPM',
        type: 'line',
        yAxisIndex: 1,
        data: telemetry.map((t) => t.rpm),
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 1.5, type: 'dashed' as const },
        itemStyle: { color: '#a855f7' },
      },
    ],
  };

  const handleRefresh = async () => {
    if (selectedDevice?.id) {
      await fetchTelemetry(selectedDevice.id);
    }
    await fetchPredictionStats();
    message.success('概览数据已刷新');
  };

  const alertColumns = [
    {
      title: '等级',
      dataIndex: 'level',
      key: 'level',
      width: 80,
      render: (level: string) => (
        <Tag color={levelColor[level]} style={{ fontWeight: 600 }}>{ALERT_LEVEL_LABEL[level] || level.toUpperCase()}</Tag>
      ),
    },
    { title: '设备', dataIndex: 'device_name', key: 'device_name', width: 120 },
    { title: '告警信息', dataIndex: 'message', key: 'message' },
    { title: '指标', dataIndex: 'metric', key: 'metric', width: 90 },
    {
      title: '值',
      dataIndex: 'value',
      key: 'value',
      width: 80,
      render: (v: number) => <span className="mono-value">{v}</span>,
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (t: string) => new Date(t).toLocaleString('zh-CN'),
    },
  ];

  return (
    <div className="page-shell page-shell--compact">
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }} className="kpi-row">
        <Col xs={24} sm={12} lg={6}>
          <Card className="kpi-card success metric-rack-card" size="small">
            <Statistic
              title={<span className="stat-title">在线设备</span>}
              value={onlineCount}
              suffix={<span className="stat-suffix">/ {devices.length}</span>}
              prefix={<DesktopOutlined style={{ color: '#22c55e' }} />}
              valueStyle={{ color: '#22c55e', fontSize: 32, fontWeight: 700 }}
            />
            <div className="metric-rack-card__foot">覆盖率 {availability}%</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className={`kpi-card ${highAlertCount > 0 ? 'danger' : 'success'} metric-rack-card`} size="small">
            <Statistic
              title={<span className="stat-title">高风险告警</span>}
              value={highAlertCount}
              prefix={<WarningOutlined style={{ color: highAlertCount > 0 ? '#ef4444' : '#22c55e' }} />}
              valueStyle={{ color: highAlertCount > 0 ? '#ef4444' : '#22c55e', fontSize: 32, fontWeight: 700 }}
            />
            <div className="metric-rack-card__foot">需要优先处理</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="kpi-card metric-rack-card" size="small">
            <Statistic
              title={<span className="stat-title">平均风险分</span>}
              value={avgRiskPct}
              suffix="%"
              prefix={<ThunderboltOutlined style={{ color: '#eab308' }} />}
              valueStyle={{ color: '#eab308', fontSize: 32, fontWeight: 700 }}
            />
            <div className="metric-rack-card__foot">由多算法加权输出</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="kpi-card metric-rack-card" size="small">
            <Statistic
              title={<span className="stat-title">最近预测</span>}
              value={predCount}
              suffix="次"
              prefix={<LineChartOutlined style={{ color: '#3b82f6' }} />}
              valueStyle={{ color: '#3b82f6', fontSize: 32, fontWeight: 700 }}
            />
            <div className="metric-rack-card__foot">近一轮推理输出数</div>
          </Card>
        </Col>
      </Row>

      <Card
        title={<span className="card-title">运行趋势</span>}
        size="small"
        className="section-card simple-card"
        style={{ marginBottom: 16 }}
        extra={
          <Space wrap>
            <Select
              value={selectedDevice?.id}
              style={{ minWidth: 220 }}
              placeholder="选择观察设备"
              options={devices.map((device) => ({
                label: `${device.name} · ${device.location}`,
                value: device.id,
              }))}
              onChange={(value) => setSelectedDeviceId(value)}
            />
            <Button icon={<ReloadOutlined />} onClick={() => void handleRefresh()}>
              刷新
            </Button>
          </Space>
        }
      >
        {selectedDevice && telemetry.length > 0 ? (
          <ReactECharts option={chartOption} style={{ height: 320 }} />
        ) : (
          <Empty description={selectedDevice ? '该设备暂无运行数据，请确认 TDengine 已写入数据' : '请选择一台设备查看运行趋势'} />
        )}
      </Card>

      <Card
        title={<span className="card-title">最新告警</span>}
        size="small"
        className="section-card table-card simple-card"
      >
        <Table
          dataSource={alerts.slice(0, 10)}
          columns={alertColumns}
          rowKey="id"
          pagination={false}
          size="small"
          scroll={{ x: 600 }}
        />
      </Card>
    </div>
  );
}
