import React, { useEffect, useState } from 'react';
import {
  Card, Table, Button, Input, Typography, Space, message, Tag, Tabs, Popconfirm, Upload, Descriptions,
} from 'antd';
import {
  SaveOutlined, DeleteOutlined, ImportOutlined, ExportOutlined, CopyOutlined, UploadOutlined,
} from '@ant-design/icons';
import api from '../api';
import type { AlgoTemplate, Evaluation, AuditLog, PredictionConfig } from '../types';

const { Title, Text } = Typography;

const ALGO_LABELS: Record<string, string> = {
  rule_based: '规则引擎',
  statistical: '统计分析',
  ml: '机器学习',
  deep_learning: '深度学习',
};

const PARAM_LABELS: Record<string, string> = {
  alert_weight: '告警权重',
  base_rul: '基础RUL',
  rul_decay_per_alert: '衰减RUL',
  noise_min: '噪声下限',
  noise_max: '噪声上限',
  risk_mean: '风险均值',
  risk_std: '风险标准差',
  rul_mean: 'RUL均值',
  rul_std: 'RUL标准差',
  confidence_min: '置信度下限',
  confidence_max: '置信度上限',
};

interface Props {
  currentConfig: PredictionConfig;
  onApplyTemplate: (template: AlgoTemplate) => void;
}

export default function GovernancePage({ currentConfig, onApplyTemplate }: Props) {
  const [templates, setTemplates] = useState<AlgoTemplate[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [audits, setAudits] = useState<AuditLog[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [tRes, eRes, aRes] = await Promise.all([
        api.get('/algo-governance/templates'),
        api.get('/algo-governance/evaluations'),
        api.get('/algo-governance/audit-logs'),
      ]);
      setTemplates(tRes.data);
      setEvaluations(eRes.data);
      setAudits(aRes.data);
    } catch {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) { message.warning('请输入模板名称'); return; }
    try {
      // Normalize weights from 0-100 to 0-1 for storage
      const normWeights: Record<string, number> = {};
      const totalW = Object.entries(currentConfig.algorithms)
        .filter(([_, v]) => v)
        .reduce((s, [k]) => s + (currentConfig.weights[k] || 0), 0) || 100;
      for (const [k, v] of Object.entries(currentConfig.weights)) {
        normWeights[k] = Math.round((v / totalW) * 10000) / 10000;
      }

      // Build algo_params from current config
      const algoParams: Record<string, Record<string, number>> = {};
      for (const [key, params] of Object.entries(currentConfig.algoParams)) {
        algoParams[key] = { ...params };
      }

      await api.post('/algo-governance/templates', {
        name: templateName,
        algorithms: currentConfig.algorithms,
        weights: normWeights,
        thresholds: {
          high_risk: currentConfig.thresholds.high_risk / 100,
          medium_risk: currentConfig.thresholds.medium_risk / 100,
        },
        algo_params: algoParams,
        description: `用户保存模板: ${templateName}`,
      });
      message.success('模板保存成功（已使用当前预测配置）');
      setTemplateName('');
      fetchAll();
    } catch {
      message.error('保存失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/algo-governance/templates/${id}`);
      message.success('模板已删除');
      fetchAll();
    } catch {
      message.error('删除失败');
    }
  };

  const handleExport = async () => {
    try {
      const res = await api.get('/algo-governance/templates/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'templates.json';
      link.click();
      window.URL.revokeObjectURL(url);
      message.success('导出成功');
    } catch {
      message.error('导出失败');
    }
  };

  const handleImport = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post('/algo-governance/templates/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      message.success(`导入成功: ${res.data.imported} 个模板`);
      fetchAll();
    } catch {
      message.error('导入失败');
    }
    return false;
  };

  const handleApply = (template: AlgoTemplate) => {
    onApplyTemplate(template);
    message.success(`已套用模板: ${template.name}，配置已加载到预测中心`);
  };

  const templateColumns = [
    { title: '模板名称', dataIndex: 'name', key: 'name' },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '算法',
      dataIndex: 'algorithms',
      key: 'algorithms',
      render: (algos: Record<string, boolean>) => (
        <Space wrap>
          {Object.entries(algos || {}).filter(([_, v]) => v).map(([k]) => (
            <Tag key={k} color="blue" style={{ fontSize: 11 }}>{ALGO_LABELS[k] || k}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 160,
      render: (t: string) => t ? new Date(t).toLocaleString('zh-CN') : '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_: any, record: AlgoTemplate) => (
        <Space>
          <Button size="small" icon={<CopyOutlined />} onClick={() => handleApply(record)}>套用</Button>
          <Popconfirm title="确认删除?" onConfirm={() => handleDelete(record.id)} okText="删除" cancelText="取消">
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const expandedRowRender = (record: AlgoTemplate) => {
    const algoParams = record.algo_params || {};
    if (Object.keys(algoParams).length === 0) {
      return <Text style={{ color: 'var(--text-muted)' }}>此模板无算法参数配置</Text>;
    }
    return (
      <div style={{ padding: '8px 0' }}>
        <Text strong style={{ color: 'var(--text-primary)', marginBottom: 8, display: 'block' }}>算法参数详情</Text>
        {Object.entries(algoParams).map(([algoKey, params]) => (
          <div key={algoKey} style={{ marginBottom: 8 }}>
            <Tag color="blue" style={{ marginBottom: 4 }}>{ALGO_LABELS[algoKey] || algoKey}</Tag>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginLeft: 8 }}>
              {Object.entries(params).map(([pKey, pVal]) => (
                <Tag key={pKey} style={{ fontSize: 11 }}>
                  {PARAM_LABELS[pKey] || pKey}: {typeof pVal === 'number' ? pVal : String(pVal)}
                </Tag>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const evalColumns = [
    { title: '设备ID', dataIndex: 'device_id', key: 'device_id', width: 120 },
    { title: '预测ID', dataIndex: 'prediction_id', key: 'prediction_id', width: 120 },
    {
      title: '命中率',
      dataIndex: 'hit_rate',
      key: 'hit_rate',
      width: 80,
      render: (v: number) => <span style={{ color: '#22c55e' }}>{(v * 100).toFixed(1)}%</span>,
    },
    {
      title: '误报率',
      dataIndex: 'false_alarm_rate',
      key: 'false_alarm_rate',
      width: 80,
      render: (v: number) => <span style={{ color: '#ef4444' }}>{(v * 100).toFixed(1)}%</span>,
    },
    { title: '备注', dataIndex: 'notes', key: 'notes', ellipsis: true },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (t: string) => t ? new Date(t).toLocaleString('zh-CN') : '-',
    },
  ];

  const auditColumns = [
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      width: 80,
      render: (a: string) => {
        const colors: Record<string, string> = { create: 'green', update: 'blue', delete: 'red', import: 'purple' };
        return <Tag color={colors[a] || 'default'}>{a}</Tag>;
      },
    },
    { title: '目标类型', dataIndex: 'target_type', key: 'target_type', width: 100 },
    { title: '用户', dataIndex: 'user', key: 'user', width: 100 },
    { title: '详情', dataIndex: 'detail', key: 'detail', ellipsis: true },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (t: string) => new Date(t).toLocaleString('zh-CN'),
    },
  ];

  return (
    <div style={{ padding: '16px 0' }}>
      <Title level={4} style={{ color: 'var(--text-primary)', marginBottom: 16 }}>算法治理</Title>

      <Tabs
        defaultActiveKey="templates"
        items={[
          {
            key: 'templates',
            label: '模板管理',
            children: (
              <Space direction="vertical" style={{ width: '100%' }} size={16}>
                {/* Save new template */}
                <Card size="small">
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Input
                      placeholder="输入模板名称"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      style={{ maxWidth: 300 }}
                      onPressEnter={handleSaveTemplate}
                    />
                    <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveTemplate}>
                      保存当前配置为模板
                    </Button>
                    <Button icon={<ExportOutlined />} onClick={handleExport}>导出</Button>
                    <Upload
                      accept=".json"
                      showUploadList={false}
                      beforeUpload={handleImport}
                    >
                      <Button icon={<ImportOutlined />}>导入</Button>
                    </Upload>
                  </div>
                </Card>

                <Card size="small">
                  <Table
                    dataSource={templates}
                    columns={templateColumns}
                    rowKey="id"
                    loading={loading}
                    pagination={{ pageSize: 8 }}
                    size="small"
                    scroll={{ x: 700 }}
                    expandable={{ expandedRowRender }}
                  />
                </Card>
              </Space>
            ),
          },
          {
            key: 'evaluations',
            label: '评估记录',
            children: (
              <Card size="small">
                <Table
                  dataSource={evaluations}
                  columns={evalColumns}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                  size="small"
                  scroll={{ x: 600 }}
                />
              </Card>
            ),
          },
          {
            key: 'audit',
            label: '审计日志',
            children: (
              <Card size="small">
                <Table
                  dataSource={audits}
                  columns={auditColumns}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                  size="small"
                  scroll={{ x: 600 }}
                />
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}
