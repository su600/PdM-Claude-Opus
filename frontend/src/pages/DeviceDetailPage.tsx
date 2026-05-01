import React, { useEffect, useState } from 'react';
import {
  Card, Tabs, Descriptions, Table, Tag, Button, Space, Empty, Modal, Form,
  Input, InputNumber, Select, DatePicker, Popconfirm, Statistic, Row, Col, message,
} from 'antd';
import {
  ArrowLeftOutlined, EditOutlined, PlusOutlined, DeleteOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import api from '../api';
import type { Device, Alert, MaintenanceRecord, PredictionResult, TelemetryPoint } from '../types';
import {
  DEVICE_STATUS_LABEL, LEVEL_COLOR, ALERT_LEVEL_LABEL,
  MAINTENANCE_TYPE_LABEL, MAINTENANCE_TYPE_COLOR,
} from '../types';
import { useTheme } from '../ThemeContext';

const STATUS_COLOR: Record<string, string> = {
  online: 'green', offline: 'default', warning: 'orange', error: 'red',
};

export default function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { mode } = useTheme();
  const isDark = mode === 'dark';

  const [device, setDevice] = useState<Device | null>(null);
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [predictions, setPredictions] = useState<PredictionResult[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryPoint[]>([]);
  const [telemetryLimit, setTelemetryLimit] = useState(200);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [maintModalOpen, setMaintModalOpen] = useState(false);
  const [editForm] = Form.useForm();
  const [maintForm] = Form.useForm();

  const fetchDevice = async () => {
    try { const r = await api.get(`/devices/${id}`); setDevice(r.data); } catch { /* */ }
  };
  const fetchMaintenance = async () => {
    try { const r = await api.get(`/devices/${id}/maintenance`); setMaintenance(r.data); } catch { /* */ }
  };
  const fetchAlerts = async () => {
    try { const r = await api.get(`/devices/${id}/alerts`); setAlerts(r.data); } catch { /* */ }
  };
  const fetchPredictions = async () => {
    try { const r = await api.get(`/devices/${id}/predictions`); setPredictions(r.data); } catch { /* */ }
  };
  const fetchTelemetry = async (limit = telemetryLimit) => {
    const tag = device?.datasource_tag || id;
    try { const r = await api.get(`/telemetry/${tag}?limit=${limit}`); setTelemetry(Array.isArray(r.data) ? r.data.reverse() : []); } catch { setTelemetry([]); }
  };

  useEffect(() => {
    if (!id) return;
    void fetchDevice();
    void fetchMaintenance();
    void fetchAlerts();
    void fetchPredictions();
  }, [id]);

  useEffect(() => {
    if (device) void fetchTelemetry();
  }, [device, telemetryLimit]);

  // ── Edit device ──
  const openEdit = () => {
    if (!device) return;
    editForm.setFieldsValue({ ...device });
    setEditModalOpen(true);
  };
  const saveEdit = async () => {
    const values = await editForm.validateFields();
    try {
      await api.put(`/devices/${id}`, values);
      message.success('设备信息已更新');
      setEditModalOpen(false);
      void fetchDevice();
    } catch { message.error('更新失败'); }
  };

  // ── Maintenance CRUD ──
  const saveMaint = async () => {
    const values = await maintForm.validateFields();
    const payload = {
      ...values,
      device_id: id,
      date: values.date.format('YYYY-MM-DD'),
      next_maintenance_date: values.next_maintenance_date
        ? values.next_maintenance_date.format('YYYY-MM-DD')
        : null,
    };
    try {
      await api.post(`/devices/${id}/maintenance`, payload);
      message.success('维保记录已添加');
      setMaintModalOpen(false);
      maintForm.resetFields();
      void fetchMaintenance();
    } catch { message.error('添加失败'); }
  };
  const deleteMaint = async (recordId: string) => {
    try {
      await api.delete(`/devices/${id}/maintenance/${recordId}`);
      message.success('已删除');
      void fetchMaintenance();
    } catch { message.error('删除失败'); }
  };

  if (!device) return <Card loading style={{ margin: 16 }} />;

  // ── Chart styles ──
  const tooltipStyle = {
    backgroundColor: isDark ? '#1a2236' : '#ffffff',
    borderColor: isDark ? '#2a3654' : '#e2e8f0',
    textStyle: { color: isDark ? '#e2e8f0' : '#1e293b' },
  };
  const axisLbl = { color: isDark ? '#64748b' : '#475569', fontSize: 11 };
  const axisLn = { lineStyle: { color: isDark ? '#2a3654' : '#cbd5e1' } };
  const splitLn = { lineStyle: { color: isDark ? 'rgba(42,54,84,0.4)' : 'rgba(203,213,225,0.5)' } };

  const telemetryChart = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' as const, ...tooltipStyle },
    legend: {
      data: ['温度 (°C)', '振动 (mm/s)', '压力 (MPa)', 'RPM'],
      textStyle: { color: isDark ? '#94a3b8' : '#475569' }, top: 0,
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
      axisLabel: { ...axisLbl, rotate: 30 }, axisLine: axisLn,
    },
    yAxis: [
      { type: 'value' as const, name: '温度/振动/压力', nameTextStyle: { color: isDark ? '#64748b' : '#475569', fontSize: 10 }, axisLabel: axisLbl, splitLine: splitLn },
      { type: 'value' as const, name: 'RPM', nameTextStyle: { color: isDark ? '#64748b' : '#475569', fontSize: 10 }, axisLabel: axisLbl, splitLine: { show: false } },
    ],
    series: [
      { name: '温度 (°C)', type: 'line', data: telemetry.map((t) => t.temperature), smooth: true, showSymbol: false, lineStyle: { width: 2 }, itemStyle: { color: '#f97316' }, areaStyle: { color: 'rgba(249,115,22,0.08)' } },
      { name: '振动 (mm/s)', type: 'line', data: telemetry.map((t) => t.vibration), smooth: true, showSymbol: false, lineStyle: { width: 2 }, itemStyle: { color: '#3b82f6' }, areaStyle: { color: 'rgba(59,130,246,0.08)' } },
      { name: '压力 (MPa)', type: 'line', data: telemetry.map((t) => t.pressure), smooth: true, showSymbol: false, lineStyle: { width: 2 }, itemStyle: { color: '#22c55e' }, areaStyle: { color: 'rgba(34,197,94,0.08)' } },
      { name: 'RPM', type: 'line', yAxisIndex: 1, data: telemetry.map((t) => t.rpm), smooth: true, showSymbol: false, lineStyle: { width: 1.5, type: 'dashed' as const }, itemStyle: { color: '#a855f7' } },
    ],
  };

  const RISK_LEVEL_TAG: Record<string, { color: string; label: string }> = {
    low: { color: 'green', label: '低风险' },
    medium: { color: 'orange', label: '中风险' },
    high: { color: 'red', label: '高风险' },
  };

  const maintColumns = [
    { title: '日期', dataIndex: 'date', key: 'date', width: 120 },
    {
      title: '类型', dataIndex: 'maintenance_type', key: 'maintenance_type', width: 110,
      render: (t: string) => <Tag color={MAINTENANCE_TYPE_COLOR[t]}>{MAINTENANCE_TYPE_LABEL[t] || t}</Tag>,
    },
    { title: '描述', dataIndex: 'description', key: 'description' },
    { title: '操作人', dataIndex: 'operator', key: 'operator', width: 80 },
    {
      title: '费用', dataIndex: 'cost', key: 'cost', width: 100,
      render: (v: number) => `¥${v.toLocaleString()}`,
    },
    {
      title: '下次维保日期', dataIndex: 'next_maintenance_date', key: 'next_maintenance_date', width: 130,
      render: (v: string | undefined) => {
        if (!v) return <span style={{ color: '#94a3b8' }}>-</span>;
        const today = new Date();
        const next = new Date(v);
        const diffDays = Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const color = diffDays < 0 ? '#ef4444' : diffDays <= 7 ? '#f97316' : '#22c55e';
        return <span style={{ color, fontWeight: 600 }}>{v}</span>;
      },
    },
    {
      title: '操作', key: 'action', width: 60,
      render: (_: unknown, record: MaintenanceRecord) => (
        <Popconfirm title="确定删除?" onConfirm={() => void deleteMaint(record.id)} okText="确定" cancelText="取消">
          <Button type="link" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  const alertColumns = [
    {
      title: '等级', dataIndex: 'level', key: 'level', width: 80,
      render: (level: string) => <Tag color={LEVEL_COLOR[level]} style={{ fontWeight: 600 }}>{ALERT_LEVEL_LABEL[level] || level}</Tag>,
    },
    { title: '告警信息', dataIndex: 'message', key: 'message' },
    { title: '指标', dataIndex: 'metric', key: 'metric', width: 90 },
    {
      title: '值', dataIndex: 'value', key: 'value', width: 80,
      render: (v: number) => <span className="mono-value">{v}</span>,
    },
    {
      title: '时间', dataIndex: 'created_at', key: 'created_at', width: 160,
      render: (t: string) => new Date(t).toLocaleString('zh-CN'),
    },
  ];

  const predColumns = [
    {
      title: '风险分', dataIndex: 'risk_score', key: 'risk_score', width: 90,
      render: (v: number) => <span className="mono-value" style={{ fontWeight: 700 }}>{Math.round(v * 100)}%</span>,
    },
    {
      title: 'RUL (h)', dataIndex: 'rul_hours', key: 'rul_hours', width: 90,
      render: (v: number) => <span className="mono-value">{v.toFixed(0)}</span>,
    },
    {
      title: '置信度', dataIndex: 'confidence', key: 'confidence', width: 90,
      render: (v: number) => <span className="mono-value">{Math.round(v * 100)}%</span>,
    },
    {
      title: '风险等级', dataIndex: 'risk_level', key: 'risk_level', width: 90,
      render: (l: string) => {
        const cfg = RISK_LEVEL_TAG[l] || { color: 'default', label: l };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    { title: '建议', dataIndex: 'recommendation', key: 'recommendation' },
    {
      title: '时间', dataIndex: 'created_at', key: 'created_at', width: 160,
      render: (t: string) => new Date(t).toLocaleString('zh-CN'),
    },
  ];

  const totalMaintCost = maintenance.reduce((s, m) => s + m.cost, 0);

  const tabItems = [
    {
      key: 'info', label: '基本信息',
      children: (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <Button icon={<EditOutlined />} onClick={openEdit}>编辑</Button>
          </div>
          <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
            <Descriptions.Item label="设备名称">{device.name}</Descriptions.Item>
            <Descriptions.Item label="状态"><Tag color={STATUS_COLOR[device.status]}>{DEVICE_STATUS_LABEL[device.status]}</Tag></Descriptions.Item>
            <Descriptions.Item label="设备类型">{device.device_type}</Descriptions.Item>
            <Descriptions.Item label="型号">{device.model || '-'}</Descriptions.Item>
            <Descriptions.Item label="厂家">{device.manufacturer || '-'}</Descriptions.Item>
            <Descriptions.Item label="生产年份">{device.manufacture_year || '-'}</Descriptions.Item>
            <Descriptions.Item label="序列号">{device.serial_number || '-'}</Descriptions.Item>
            <Descriptions.Item label="位置">{device.location || '-'}</Descriptions.Item>
            <Descriptions.Item label="描述" span={2}>{device.description || '-'}</Descriptions.Item>
            <Descriptions.Item label="数据源关联">
              <code style={{ fontSize: 12 }}>TDengine 子表: t_{device.datasource_tag || device.id}</code>
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">{new Date(device.created_at).toLocaleString('zh-CN')}</Descriptions.Item>
          </Descriptions>
        </div>
      ),
    },
    {
      key: 'maintenance', label: `维保记录 (${maintenance.length})`,
      children: (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Space>
              <Statistic title="维保次数" value={maintenance.length} valueStyle={{ fontSize: 20 }} />
              <Statistic title="累计费用" prefix="¥" value={totalMaintCost} valueStyle={{ fontSize: 20 }} style={{ marginLeft: 32 }} />
            </Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { maintForm.resetFields(); setMaintModalOpen(true); }}>
              新增记录
            </Button>
          </div>
          <Table dataSource={maintenance} columns={maintColumns} rowKey="id" size="small" pagination={{ pageSize: 10 }} />
        </div>
      ),
    },
    {
      key: 'alerts', label: `告警历史 (${alerts.length})`,
      children: alerts.length > 0 ? (
        <Table dataSource={alerts} columns={alertColumns} rowKey="id" size="small" pagination={{ pageSize: 10 }} />
      ) : (
        <Empty description="暂无告警记录" />
      ),
    },
    {
      key: 'predictions', label: `预测历史 (${predictions.length})`,
      children: predictions.length > 0 ? (
        <Table dataSource={predictions} columns={predColumns} rowKey="id" size="small" pagination={{ pageSize: 10 }} />
      ) : (
        <Empty description="暂无预测记录，请在预测中心运行推理" />
      ),
    },
    {
      key: 'telemetry', label: '运行数据',
      children: (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
            <Select value={telemetryLimit} onChange={(v) => setTelemetryLimit(v)} style={{ width: 130 }}
              options={[{ label: '100 条', value: 100 }, { label: '200 条', value: 200 }, { label: '500 条', value: 500 }]}
            />
            <Button icon={<ReloadOutlined />} onClick={() => void fetchTelemetry()}>刷新</Button>
          </div>
          {telemetry.length > 0 ? (
            <ReactECharts option={telemetryChart} style={{ height: 360 }} />
          ) : (
            <Empty description="暂无运行数据" />
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: '16px 0' }}>
      <Card
        size="small"
        className="section-card simple-card"
        title={
          <Space>
            <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate('/devices')} />
            <span className="card-title">{device.name}</span>
            <Tag color={STATUS_COLOR[device.status]}>{DEVICE_STATUS_LABEL[device.status]}</Tag>
            <span className="secondary-text--sm">{device.device_type} · {device.location}</span>
          </Space>
        }
      >
        <Tabs items={tabItems} />
      </Card>

      {/* 编辑设备 Modal */}
      <Modal title="编辑设备" open={editModalOpen} onCancel={() => setEditModalOpen(false)} onOk={() => void saveEdit()} width={600} okText="保存" cancelText="取消" destroyOnClose>
        <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="设备名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Space style={{ width: '100%' }} styles={{ item: { flex: 1 } }}>
            <Form.Item name="device_type" label="设备类型" style={{ flex: 1 }}>
              <Select options={[
                { label: '机加中心', value: '机加中心' }, { label: '复材铺丝机', value: '复材铺丝机' },
                { label: '激光焊接机', value: '激光焊接机' }, { label: '检验监测仪', value: '检验监测仪' },
              ]} />
            </Form.Item>
            <Form.Item name="status" label="状态" style={{ flex: 1 }}>
              <Select options={[
                { label: '在线', value: 'online' }, { label: '离线', value: 'offline' },
                { label: '告警', value: 'warning' }, { label: '故障', value: 'error' },
              ]} />
            </Form.Item>
          </Space>
          <Space style={{ width: '100%' }} styles={{ item: { flex: 1 } }}>
            <Form.Item name="model" label="型号" style={{ flex: 1 }}><Input /></Form.Item>
            <Form.Item name="manufacturer" label="厂家" style={{ flex: 1 }}><Input /></Form.Item>
          </Space>
          <Space style={{ width: '100%' }} styles={{ item: { flex: 1 } }}>
            <Form.Item name="manufacture_year" label="生产年份" style={{ flex: 1 }}><InputNumber min={1990} max={2030} style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="serial_number" label="序列号" style={{ flex: 1 }}><Input /></Form.Item>
          </Space>
          <Form.Item name="location" label="位置"><Input /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="datasource_tag" label="数据源关联标签"><Input /></Form.Item>
        </Form>
      </Modal>

      {/* 新增维保记录 Modal */}
      <Modal title="新增维保记录" open={maintModalOpen} onCancel={() => setMaintModalOpen(false)} onOk={() => void saveMaint()} okText="保存" cancelText="取消" destroyOnClose>
        <Form form={maintForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="date" label="维保日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="maintenance_type" label="维保类型" rules={[{ required: true }]}>
            <Select options={[
              { label: '预防性维护', value: 'preventive' }, { label: '纠正性维修', value: 'corrective' },
              { label: '预测性维护', value: 'predictive' }, { label: '巡检', value: 'inspection' },
            ]} />
          </Form.Item>
          <Form.Item name="description" label="描述" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="维保内容说明" />
          </Form.Item>
          <Space style={{ width: '100%' }} styles={{ item: { flex: 1 } }}>
            <Form.Item name="operator" label="操作人" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Input placeholder="如 张工" />
            </Form.Item>
            <Form.Item name="cost" label="费用 (元)" initialValue={0} style={{ flex: 1 }}>
              <InputNumber min={0} step={100} style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Form.Item name="next_maintenance_date" label="下次维保日期">
            <DatePicker style={{ width: '100%' }} placeholder="选择下次维保计划日期（可选）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
