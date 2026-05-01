import React, { useEffect, useState } from 'react';
import {
  Card, Table, Tag, Button, Space, Badge, Statistic, Row, Col, Modal, Form,
  Input, InputNumber, Select, DatePicker, message, Tooltip,
} from 'antd';
import {
  ReloadOutlined, PlusOutlined, CheckCircleOutlined, ClockCircleOutlined,
  ExclamationCircleOutlined, QuestionCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../api';
import type { InspectionOverviewItem } from '../types';
import {
  INSPECTION_STATUS_LABEL, INSPECTION_STATUS_COLOR,
  DEVICE_STATUS_LABEL, MAINTENANCE_TYPE_LABEL,
} from '../types';

const DEVICE_STATUS_COLOR: Record<string, string> = {
  online: 'green', offline: 'default', warning: 'orange', error: 'red',
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  ok: <CheckCircleOutlined style={{ color: '#22c55e' }} />,
  upcoming: <ClockCircleOutlined style={{ color: '#f97316' }} />,
  overdue: <ExclamationCircleOutlined style={{ color: '#ef4444' }} />,
  never: <QuestionCircleOutlined style={{ color: '#94a3b8' }} />,
};

export default function InspectionPage() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<InspectionOverviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<InspectionOverviewItem | null>(null);
  const [form] = Form.useForm();

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const r = await api.get('/devices/inspection/overview');
      setOverview(r.data);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { void fetchOverview(); }, []);

  const openAddRecord = (item: InspectionOverviewItem) => {
    setSelectedDevice(item);
    form.resetFields();
    setModalOpen(true);
  };

  const saveRecord = async () => {
    if (!selectedDevice) return;
    const values = await form.validateFields();
    const payload = {
      ...values,
      device_id: selectedDevice.device_id,
      date: values.date.format('YYYY-MM-DD'),
      next_maintenance_date: values.next_maintenance_date
        ? values.next_maintenance_date.format('YYYY-MM-DD')
        : null,
    };
    try {
      await api.post(`/devices/${selectedDevice.device_id}/maintenance`, payload);
      message.success('点检记录已添加');
      setModalOpen(false);
      void fetchOverview();
    } catch { message.error('添加失败'); }
  };

  // Summary counts
  const total = overview.length;
  const overdueCount = overview.filter((i: InspectionOverviewItem) => i.inspection_status === 'overdue').length;
  const upcomingCount = overview.filter((i: InspectionOverviewItem) => i.inspection_status === 'upcoming').length;
  const neverCount = overview.filter((i: InspectionOverviewItem) => i.inspection_status === 'never').length;
  const okCount = overview.filter((i: InspectionOverviewItem) => i.inspection_status === 'ok').length;

  const columns = [
    {
      title: '设备名称', dataIndex: 'device_name', key: 'device_name', width: 130,
      render: (name: string, record: InspectionOverviewItem) => (
        <a onClick={() => navigate(`/devices/${record.device_id}`)} style={{ fontWeight: 600 }}>
          {name}
        </a>
      ),
    },
    { title: '设备类型', dataIndex: 'device_type', key: 'device_type', width: 110 },
    { title: '位置', dataIndex: 'location', key: 'location', width: 100 },
    {
      title: '设备状态', dataIndex: 'device_status', key: 'device_status', width: 90,
      render: (s: string) => <Tag color={DEVICE_STATUS_COLOR[s]}>{DEVICE_STATUS_LABEL[s] || s}</Tag>,
    },
    {
      title: '上次维保日期', dataIndex: 'last_maintenance_date', key: 'last_maintenance_date', width: 130,
      render: (v?: string) => v || <span style={{ color: '#94a3b8' }}>-</span>,
    },
    {
      title: '维保类型', dataIndex: 'last_maintenance_type', key: 'last_maintenance_type', width: 110,
      render: (v?: string) => v
        ? <Tag>{MAINTENANCE_TYPE_LABEL[v] || v}</Tag>
        : <span style={{ color: '#94a3b8' }}>-</span>,
    },
    {
      title: '下次维保日期', dataIndex: 'next_maintenance_date', key: 'next_maintenance_date', width: 130,
      render: (v?: string, record?: InspectionOverviewItem) => {
        if (!v) return <span style={{ color: '#94a3b8' }}>-</span>;
        const color = record?.inspection_status === 'overdue' ? '#ef4444'
          : record?.inspection_status === 'upcoming' ? '#f97316' : '#22c55e';
        return <span style={{ color, fontWeight: 600 }}>{v}</span>;
      },
    },
    {
      title: '剩余天数', dataIndex: 'days_until_next', key: 'days_until_next', width: 90,
      sorter: (a: InspectionOverviewItem, b: InspectionOverviewItem) => {
        const av = a.days_until_next ?? Infinity;
        const bv = b.days_until_next ?? Infinity;
        return av - bv;
      },
      render: (v?: number) => {
        if (v === undefined || v === null) return <span style={{ color: '#94a3b8' }}>-</span>;
        if (v < 0) return <span style={{ color: '#ef4444', fontWeight: 700 }}>{v} 天</span>;
        if (v <= 7) return <span style={{ color: '#f97316', fontWeight: 600 }}>{v} 天</span>;
        return <span style={{ color: '#22c55e' }}>{v} 天</span>;
      },
    },
    {
      title: '点检状态', dataIndex: 'inspection_status', key: 'inspection_status', width: 110,
      filters: [
        { text: '正常', value: 'ok' },
        { text: '即将到期', value: 'upcoming' },
        { text: '已逾期', value: 'overdue' },
        { text: '未记录', value: 'never' },
      ],
      onFilter: (value: unknown, record: InspectionOverviewItem) => record.inspection_status === value,
        <Space size={4}>
          {STATUS_ICON[s]}
          <Tag color={INSPECTION_STATUS_COLOR[s]}>{INSPECTION_STATUS_LABEL[s] || s}</Tag>
        </Space>
      ),
    },
    {
      title: '操作', key: 'action', width: 100, fixed: 'right' as const,
      render: (_: unknown, record: InspectionOverviewItem) => (
        <Tooltip title="新增点检记录">
          <Button
            type="link"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => openAddRecord(record)}
          >
            记录
          </Button>
        </Tooltip>
      ),
    },
  ];

  return (
    <div style={{ padding: '16px 0' }}>
      {/* Summary statistics */}
      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small" className="section-card simple-card">
            <Statistic
              title="设备总数"
              value={total}
              valueStyle={{ fontSize: 24 }}
              prefix={<Badge color="#3b82f6" />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" className="section-card simple-card">
            <Statistic
              title={<><ExclamationCircleOutlined style={{ color: '#ef4444', marginRight: 4 }} />已逾期</>}
              value={overdueCount}
              valueStyle={{ fontSize: 24, color: '#ef4444' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" className="section-card simple-card">
            <Statistic
              title={<><ClockCircleOutlined style={{ color: '#f97316', marginRight: 4 }} />即将到期 (≤7天)</>}
              value={upcomingCount}
              valueStyle={{ fontSize: 24, color: '#f97316' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" className="section-card simple-card">
            <Statistic
              title={<><CheckCircleOutlined style={{ color: '#22c55e', marginRight: 4 }} />状态正常</>}
              value={okCount}
              valueStyle={{ fontSize: 24, color: '#22c55e' }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={<span className="card-title">设备点检管理</span>}
        size="small"
        className="section-card simple-card"
        extra={
          <Space>
            {neverCount > 0 && (
              <Tag color="default" style={{ marginRight: 8 }}>
                <QuestionCircleOutlined style={{ marginRight: 4 }} />
                {neverCount} 台设备尚无点检记录
              </Tag>
            )}
            <Button icon={<ReloadOutlined />} onClick={() => void fetchOverview()}>
              刷新
            </Button>
          </Space>
        }
      >
        <Table
          dataSource={overview}
          columns={columns}
          rowKey="device_id"
          size="small"
          loading={loading}
          scroll={{ x: 1100 }}
          pagination={{ pageSize: 10 }}
          rowClassName={(record: InspectionOverviewItem) => {
            if (record.inspection_status === 'overdue') return 'row-overdue';
            if (record.inspection_status === 'upcoming') return 'row-upcoming';
            return '';
          }}
        />
      </Card>

      {/* 新增点检记录 Modal */}
      <Modal
        title={`新增点检记录 – ${selectedDevice?.device_name || ''}`}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void saveRecord()}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="date" label="本次维保日期" rules={[{ required: true }]}
            initialValue={dayjs()}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="maintenance_type" label="维保类型" rules={[{ required: true }]}
            initialValue="inspection">
            <Select options={[
              { label: '巡检', value: 'inspection' },
              { label: '预防性维护', value: 'preventive' },
              { label: '纠正性维修', value: 'corrective' },
              { label: '预测性维护', value: 'predictive' },
            ]} />
          </Form.Item>
          <Form.Item name="description" label="点检说明" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="描述本次点检内容、发现的问题等" />
          </Form.Item>
          <Space style={{ width: '100%' }} styles={{ item: { flex: 1 } }}>
            <Form.Item name="operator" label="操作人" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Input placeholder="如 张工" />
            </Form.Item>
            <Form.Item name="cost" label="费用 (元)" initialValue={0} style={{ flex: 1 }}>
              <InputNumber min={0} step={100} style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Form.Item name="next_maintenance_date" label="下次维保计划日期">
            <DatePicker
              style={{ width: '100%' }}
              placeholder="选择下次维保计划日期（可选）"
              disabledDate={(current: dayjs.Dayjs) => current && current < dayjs().startOf('day')}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
