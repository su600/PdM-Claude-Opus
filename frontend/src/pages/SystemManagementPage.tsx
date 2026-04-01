import React, { useEffect, useState } from 'react';
import { Card, Descriptions, Tag, Form, Input, InputNumber, Button, Space, Divider, message } from 'antd';
import {
  ClockCircleOutlined, DatabaseOutlined, BellOutlined, InfoCircleOutlined, SaveOutlined,
} from '@ant-design/icons';
import api from '../api';
import type { SystemInfo } from '../types';

export default function SystemManagementPage() {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [clock, setClock] = useState(new Date().toLocaleString('zh-CN'));
  const [form] = Form.useForm();

  const fetchInfo = async () => {
    setLoading(true);
    try {
      const r = await api.get('/system/info');
      setInfo(r.data);
      form.setFieldsValue({
        notification_webhook_url: r.data.notification_webhook_url,
        notification_retry_max: r.data.notification_retry_max,
      });
    } catch { /* */ }
    setLoading(false);
  };

  useEffect(() => { void fetchInfo(); }, []);

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date().toLocaleString('zh-CN')), 1000);
    return () => clearInterval(timer);
  }, []);

  const saveSettings = async () => {
    const values = await form.validateFields();
    try {
      await api.put('/system/settings', values);
      message.success('系统设置已保存');
    } catch {
      message.error('保存失败');
    }
  };

  return (
    <div style={{ padding: '16px 0' }}>
      <Card title={<span className="card-title">系统管理</span>} size="small" className="section-card simple-card" loading={loading}>
        {info && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* 系统概览 */}
            <div>
              <Divider orientation="left" style={{ margin: '0 0 16px' }}>
                <Space><InfoCircleOutlined />系统概览</Space>
              </Divider>
              <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
                <Descriptions.Item label="系统版本">
                  <Tag color="blue">v{info.version}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="构建日期">{info.build_date}</Descriptions.Item>
                <Descriptions.Item label="后端地址">
                  <code>{info.backend_host}:{info.backend_port}</code>
                </Descriptions.Item>
                <Descriptions.Item label="服务器时间">
                  <Space><ClockCircleOutlined />{clock}</Space>
                </Descriptions.Item>
              </Descriptions>
            </div>

            {/* 时序数据库 */}
            <div>
              <Divider orientation="left" style={{ margin: '0 0 16px' }}>
                <Space><DatabaseOutlined />时序数据库 (TDengine)</Space>
              </Divider>
              <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
                <Descriptions.Item label="主机">
                  <code>{info.tdengine_host}</code>
                </Descriptions.Item>
                <Descriptions.Item label="端口">
                  <code>{info.tdengine_port}</code>
                </Descriptions.Item>
                <Descriptions.Item label="数据库">
                  <code>{info.tdengine_database}</code>
                </Descriptions.Item>
                <Descriptions.Item label="连接状态">
                  <Tag color={info.tdengine_status === 'ok' ? 'green' : 'red'}>
                    {info.tdengine_status === 'ok' ? '连接正常' : '连接异常'}
                  </Tag>
                </Descriptions.Item>
              </Descriptions>
            </div>

            {/* 通知配置 */}
            <div>
              <Divider orientation="left" style={{ margin: '0 0 16px' }}>
                <Space><BellOutlined />通知配置</Space>
              </Divider>
              <Form form={form} layout="vertical" style={{ maxWidth: 560 }}>
                <Form.Item name="notification_webhook_url" label="Webhook URL" extra="告警通知推送地址 (HTTP/HTTPS)">
                  <Input placeholder="https://hooks.example.com/webhook" />
                </Form.Item>
                <Form.Item name="notification_retry_max" label="最大重试次数" extra="推送失败后的自动重试上限">
                  <InputNumber min={0} max={10} style={{ width: 160 }} />
                </Form.Item>
                <Form.Item>
                  <Button type="primary" icon={<SaveOutlined />} onClick={() => void saveSettings()}>
                    保存设置
                  </Button>
                </Form.Item>
              </Form>
            </div>

          </div>
        )}
      </Card>
    </div>
  );
}
