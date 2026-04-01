import React, { useEffect, useState } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, InputNumber, Select, Switch, Tag, Space, Typography, message, Popconfirm, Descriptions,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ApiOutlined, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined,
} from '@ant-design/icons';
import api from '../api';
import type { DataSource, DataSourceTestResult } from '../types';

const { Title, Text } = Typography;

const DS_TYPES = [
  { label: 'TDengine', value: 'tdengine' },
  { label: 'MySQL', value: 'mysql' },
  { label: 'PostgreSQL', value: 'postgres' },
  { label: 'InfluxDB', value: 'influxdb' },
];

export default function DataSourcePage() {
  const [list, setList] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<DataSource | null>(null);
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [testResult, setTestResult] = useState<DataSourceTestResult | null>(null);
  const [testModalVisible, setTestModalVisible] = useState(false);
  const [form] = Form.useForm();

  const fetchList = async () => {
    setLoading(true);
    try {
      const r = await api.get('/datasources');
      setList(r.data);
    } catch { /* */ }
    setLoading(false);
  };

  useEffect(() => { fetchList(); }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ ds_type: 'tdengine', host: 'localhost', port: 6041, username: 'root', database: 'pdm', enabled: true });
    setModal(true);
  };

  const openEdit = (ds: DataSource) => {
    setEditing(ds);
    form.setFieldsValue(ds);
    setModal(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await api.put(`/datasources/${editing.id}`, values);
        message.success('数据源已更新');
      } else {
        await api.post('/datasources', values);
        message.success('数据源已创建');
      }
      setModal(false);
      fetchList();
    } catch (err: any) {
      if (err.response?.data?.detail) message.error(err.response.data.detail);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/datasources/${id}`);
      message.success('已删除');
      fetchList();
    } catch (err: any) {
      message.error(err.response?.data?.detail || '删除失败');
    }
  };

  const handleTest = async (ds: DataSource) => {
    setTesting((p) => ({ ...p, [ds.id]: true }));
    try {
      const r = await api.post(`/datasources/${ds.id}/test`);
      setTestResult(r.data);
      setTestModalVisible(true);
      fetchList(); // refresh status
    } catch {
      message.error('测试请求失败');
    }
    setTesting((p) => ({ ...p, [ds.id]: false }));
  };

  const handleTestNew = async () => {
    try {
      const values = await form.validateFields();
      const r = await api.post('/datasources/test-new', values);
      setTestResult(r.data);
      setTestModalVisible(true);
    } catch (err: any) {
      if (err.response?.data?.detail) message.error(err.response.data.detail);
    }
  };

  const statusIcon = (status: string) => {
    if (status === 'ok') return <CheckCircleOutlined style={{ color: 'var(--accent-green)' }} />;
    if (status === 'error') return <CloseCircleOutlined style={{ color: 'var(--accent-red)' }} />;
    return <ApiOutlined style={{ color: 'var(--text-muted)' }} />;
  };

  const columns = [
    {
      title: '状态',
      dataIndex: 'status',
      width: 70,
      render: (s: string) => statusIcon(s),
    },
    {
      title: '名称',
      dataIndex: 'name',
      render: (n: string, r: DataSource) => (
        <span>
          <Text strong style={{ color: 'var(--text-primary)' }}>{n}</Text>
          <br />
          <Text style={{ color: 'var(--text-muted)', fontSize: 12 }}>{r.ds_type.toUpperCase()}</Text>
        </span>
      ),
    },
    {
      title: '连接信息',
      render: (_: any, r: DataSource) => (
        <Text code style={{ fontSize: 12 }}>{r.host}:{r.port}/{r.database}</Text>
      ),
    },
    {
      title: '用户',
      dataIndex: 'username',
      width: 100,
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      width: 70,
      render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? '是' : '否'}</Tag>,
    },
    {
      title: '最后更新',
      dataIndex: 'updated_at',
      width: 170,
      render: (t: string) => t ? new Date(t).toLocaleString('zh-CN') : '-',
    },
    {
      title: '操作',
      width: 200,
      render: (_: any, r: DataSource) => (
        <Space size="small">
          <Button
            size="small"
            icon={testing[r.id] ? <LoadingOutlined /> : <ApiOutlined />}
            onClick={() => handleTest(r)}
            loading={testing[r.id]}
          >
            测试
          </Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="确认删除此数据源？" onConfirm={() => handleDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '16px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ color: 'var(--text-primary)', margin: 0 }}>数据源配置</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建数据源</Button>
      </div>

      <Card size="small">
        <Table
          dataSource={list}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={false}
          size="small"
          scroll={{ x: 700 }}
        />
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        title={editing ? '编辑数据源' : '新建数据源'}
        open={modal}
        onCancel={() => setModal(false)}
        footer={[
          <Button key="test" onClick={handleTestNew} icon={<ApiOutlined />}>测试连接</Button>,
          <Button key="cancel" onClick={() => setModal(false)}>取消</Button>,
          <Button key="ok" type="primary" onClick={handleSave}>保存</Button>,
        ]}
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="例如: TDengine 生产库" />
          </Form.Item>
          <Form.Item name="ds_type" label="类型" rules={[{ required: true }]}>
            <Select options={DS_TYPES} />
          </Form.Item>
          <Space size="middle" style={{ display: 'flex' }}>
            <Form.Item name="host" label="主机" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Input placeholder="localhost" />
            </Form.Item>
            <Form.Item name="port" label="端口" rules={[{ required: true }]} style={{ width: 120 }}>
              <InputNumber min={1} max={65535} style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Space size="middle" style={{ display: 'flex' }}>
            <Form.Item name="username" label="用户名" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item name="password" label="密码" style={{ flex: 1 }}>
              <Input.Password placeholder="留空保持不变" />
            </Form.Item>
          </Space>
          <Form.Item name="database" label="数据库" rules={[{ required: true }]}>
            <Input placeholder="pdm" />
          </Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* Test result modal */}
      <Modal
        title="连接测试结果"
        open={testModalVisible}
        onCancel={() => setTestModalVisible(false)}
        footer={<Button onClick={() => setTestModalVisible(false)}>关闭</Button>}
        width={420}
      >
        {testResult && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>
              {testResult.ok
                ? <CheckCircleOutlined style={{ color: 'var(--accent-green)' }} />
                : <CloseCircleOutlined style={{ color: 'var(--accent-red)' }} />}
            </div>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="结果">
                <Tag color={testResult.ok ? 'green' : 'red'}>{testResult.ok ? '连接成功' : '连接失败'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="详情">{testResult.message}</Descriptions.Item>
              {testResult.latency_ms > 0 && (
                <Descriptions.Item label="延迟">{testResult.latency_ms} ms</Descriptions.Item>
              )}
            </Descriptions>
          </div>
        )}
      </Modal>
    </div>
  );
}
