import React, { useEffect, useState } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Select, Tag, Switch, message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import axios from 'axios';
import api from '../api';
import type { AlertLevel, Rule } from '../types';

const levelColor: Record<string, string> = {
  low: '#22c55e', medium: '#eab308', high: '#f97316', critical: '#ef4444',
};

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const fetchRules = async () => {
    setLoading(true);
    try {
      const res = await api.get('/rules');
      setRules(res.data);
    } catch {
      message.error('获取规则失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRules(); }, []);

  interface CreateRuleValues {
    name: string;
    device_type: string;
    metric: string;
    condition: string;
    level: AlertLevel;
  }

  const handleCreate = async (values: CreateRuleValues) => {
    try {
      await api.post('/rules', values);
      message.success('规则创建成功');
      setModalOpen(false);
      form.resetFields();
      fetchRules();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        message.error(err.response?.data?.detail || '创建失败');
        return;
      }
      message.error('创建失败');
    }
  };

  const handleToggle = async (ruleId: string) => {
    try {
      await api.post(`/rules/${ruleId}/toggle`);
      fetchRules();
    } catch {
      message.error('操作失败');
    }
  };

  const columns = [
    { title: '规则名称', dataIndex: 'name', key: 'name' },
    { title: '设备类型', dataIndex: 'device_type', key: 'device_type', width: 130 },
    { title: '监控指标', dataIndex: 'metric', key: 'metric', width: 100 },
    {
      title: '条件',
      dataIndex: 'condition',
      key: 'condition',
      width: 100,
      render: (v: string) => <code className="accent-code">{v}</code>,
    },
    {
      title: '告警等级',
      dataIndex: 'level',
      key: 'level',
      width: 100,
      render: (level: string) => <Tag color={levelColor[level]}>{level.toUpperCase()}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (enabled: boolean, record: Rule) => (
        <Switch size="small" checked={enabled} onChange={() => handleToggle(record.id)} />
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (t: string) => new Date(t).toLocaleString('zh-CN'),
    },
  ];
  return (
    <div className="page-shell page-shell--compact">
      <Card
        className="section-card table-card simple-card"
        size="small"
        title="规则列表"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            新建规则
          </Button>
        }
      >
        <Table
          dataSource={rules}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          size="small"
          scroll={{ x: 700 }}
        />
      </Card>

      <Modal
        title="新建规则"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        okText="创建"
        cancelText="取消"
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="规则名称" rules={[{ required: true, message: '请输入规则名称' }]}>
            <Input placeholder="例：温度过高告警" />
          </Form.Item>
          <Form.Item name="device_type" label="设备类型" rules={[{ required: true, message: '请选择设备类型' }]}>
            <Select placeholder="选择设备类型" options={[
              { label: '机加中心', value: '机加中心' },
              { label: '复材铺丝机', value: '复材铺丝机' },
              { label: '激光焊接机', value: '激光焊接机' },
              { label: '检验监测仪', value: '检验监测仪' },
            ]} />
          </Form.Item>
          <Form.Item name="metric" label="监控指标" rules={[{ required: true, message: '请选择指标' }]}>
            <Select placeholder="选择指标" options={[
              { label: '温度 (temperature)', value: 'temperature' },
              { label: '振动 (vibration)', value: 'vibration' },
              { label: '压力 (pressure)', value: 'pressure' },
              { label: '转速 (rpm)', value: 'rpm' },
            ]} />
          </Form.Item>
          <Form.Item name="condition" label="触发条件" rules={[{ required: true, message: '请输入条件' }]}>
            <Input placeholder="例：> 85" />
          </Form.Item>
          <Form.Item name="level" label="告警等级" rules={[{ required: true, message: '请选择等级' }]}>
            <Select placeholder="选择等级" options={[
              { label: 'LOW', value: 'low' },
              { label: 'MEDIUM', value: 'medium' },
              { label: 'HIGH', value: 'high' },
              { label: 'CRITICAL', value: 'critical' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
