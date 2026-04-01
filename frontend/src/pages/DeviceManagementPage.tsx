import React, { useEffect, useState } from 'react';
import {
  Card, Table, Button, Tag, Space, Input, Modal, Form, Select, InputNumber,
  Popconfirm, message,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, RightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import type { Device } from '../types';
import { DEVICE_STATUS_LABEL } from '../types';

const STATUS_COLOR: Record<string, string> = {
  online: 'green', offline: 'default', warning: 'orange', error: 'red',
};

export default function DeviceManagementPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Device | null>(null);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const r = await api.get('/devices');
      setDevices(r.data);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { void fetchDevices(); }, []);

  const filtered = devices.filter((d) => {
    const q = search.toLowerCase();
    return !q || d.name.toLowerCase().includes(q) || d.device_type.includes(q)
      || d.model.toLowerCase().includes(q) || d.manufacturer.includes(q)
      || d.location.includes(q);
  });

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (dev: Device) => {
    setEditing(dev);
    form.setFieldsValue({ ...dev });
    setModalOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await api.put(`/devices/${editing.id}`, values);
        message.success('设备更新成功');
      } else {
        await api.post('/devices', values);
        message.success('设备创建成功');
      }
      setModalOpen(false);
      void fetchDevices();
    } catch {
      message.error('操作失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/devices/${id}`);
      message.success('设备已删除');
      void fetchDevices();
    } catch {
      message.error('删除失败');
    }
  };

  const columns = [
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: (s: string) => <Tag color={STATUS_COLOR[s]}>{DEVICE_STATUS_LABEL[s] || s}</Tag>,
    },
    {
      title: '设备名称', dataIndex: 'name', key: 'name', width: 130,
      render: (name: string, record: Device) => (
        <a onClick={() => navigate(`/devices/${record.id}`)} style={{ fontWeight: 600 }}>
          {name} <RightOutlined style={{ fontSize: 10, opacity: 0.5 }} />
        </a>
      ),
    },
    { title: '设备类型', dataIndex: 'device_type', key: 'device_type', width: 120 },
    { title: '型号', dataIndex: 'model', key: 'model', width: 110 },
    { title: '厂家', dataIndex: 'manufacturer', key: 'manufacturer', width: 100 },
    {
      title: '年份', dataIndex: 'manufacture_year', key: 'manufacture_year', width: 70,
      render: (y: number) => y || '-',
    },
    { title: '位置', dataIndex: 'location', key: 'location', width: 100 },
    { title: '序列号', dataIndex: 'serial_number', key: 'serial_number', width: 150 },
    {
      title: '操作', key: 'action', width: 100, fixed: 'right' as const,
      render: (_: unknown, record: Device) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          <Popconfirm title="确定删除该设备?" onConfirm={() => void handleDelete(record.id)} okText="确定" cancelText="取消">
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '16px 0' }}>
      <Card
        title={<span className="card-title">设备管理</span>}
        size="small"
        className="section-card simple-card"
        extra={
          <Space>
            <Input
              placeholder="搜索设备名称、类型、型号..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 260 }}
              allowClear
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建设备</Button>
          </Space>
        }
      >
        <Table
          dataSource={filtered}
          columns={columns}
          rowKey="id"
          size="small"
          loading={loading}
          scroll={{ x: 1100 }}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={editing ? '编辑设备' : '新建设备'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void handleSave()}
        width={640}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="设备名称" rules={[{ required: true, message: '请输入设备名称' }]}>
            <Input placeholder="如 CNC-007" />
          </Form.Item>
          <Space style={{ width: '100%' }} styles={{ item: { flex: 1 } }}>
            <Form.Item name="device_type" label="设备类型" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Select placeholder="选择类型" options={[
                { label: '机加中心', value: '机加中心' },
                { label: '复材铺丝机', value: '复材铺丝机' },
                { label: '激光焊接机', value: '激光焊接机' },
                { label: '检验监测仪', value: '检验监测仪' },
              ]} />
            </Form.Item>
            <Form.Item name="status" label="状态" initialValue="online" style={{ flex: 1 }}>
              <Select options={[
                { label: '在线', value: 'online' },
                { label: '离线', value: 'offline' },
                { label: '告警', value: 'warning' },
                { label: '故障', value: 'error' },
              ]} />
            </Form.Item>
          </Space>
          <Space style={{ width: '100%' }} styles={{ item: { flex: 1 } }}>
            <Form.Item name="model" label="型号" style={{ flex: 1 }}>
              <Input placeholder="如 VMC-850" />
            </Form.Item>
            <Form.Item name="manufacturer" label="厂家" style={{ flex: 1 }}>
              <Input placeholder="如 沈阳机床" />
            </Form.Item>
          </Space>
          <Space style={{ width: '100%' }} styles={{ item: { flex: 1 } }}>
            <Form.Item name="manufacture_year" label="生产年份" style={{ flex: 1 }}>
              <InputNumber placeholder="如 2021" min={1990} max={2030} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="serial_number" label="序列号" style={{ flex: 1 }}>
              <Input placeholder="如 SN-CNC-20210315" />
            </Form.Item>
          </Space>
          <Form.Item name="location" label="位置">
            <Input placeholder="如 A栋-1层" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="设备用途与特点说明" />
          </Form.Item>
          <Form.Item name="datasource_tag" label="数据源关联标签" extra="对应 TDengine 子表标签，留空则自动使用设备ID">
            <Input placeholder="TDengine device_id tag" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
