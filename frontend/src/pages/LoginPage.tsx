import React, { useState } from 'react';
import { Form, Input, Button, message, Typography } from 'antd';
import {
  UserOutlined, LockOutlined, ThunderboltOutlined, SafetyCertificateOutlined, DatabaseOutlined,
} from '@ant-design/icons';
import api from '../api';

const { Text } = Typography;

interface Props {
  onSuccess: () => void;
}

export default function LoginPage({ onSuccess }: Props) {
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/token', values);
      localStorage.setItem('pdm_token', res.data.access_token);
      message.success('登录成功');
      onSuccess();
    } catch (err: any) {
      message.error(err.response?.data?.detail || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Floating particles */}
      <div className="login-particles" aria-hidden>
        <span /><span /><span /><span /><span />
      </div>

      <div className="login-shell">
        <div className="login-aside login-fadein-up" style={{ animationDelay: '0.1s' }}>
          <span className="login-aside__kicker">Predictive Maintenance Hub</span>
          <h2>让车间态势、模型预测和告警通知在同一控制台闭环运行。</h2>
          <p>
            面向中型制造场景的工业控制台，强调高密度信息、异常优先级和快速操作入口。
          </p>
          <div className="login-feature-list">
            <div className="login-feature-item login-fadein-up" style={{ animationDelay: '0.25s' }}>
              <ThunderboltOutlined className="login-feature-icon icon-thunder" />
              <div>
                <strong>多算法预测</strong>
                <span>规则、统计、机器学习与深度学习并行输出</span>
              </div>
            </div>
            <div className="login-feature-item login-fadein-up" style={{ animationDelay: '0.35s' }}>
              <SafetyCertificateOutlined className="login-feature-icon icon-shield" />
              <div>
                <strong>风险闭环</strong>
                <span>从告警、通知到治理模板应用保持同频</span>
              </div>
            </div>
            <div className="login-feature-item login-fadein-up" style={{ animationDelay: '0.45s' }}>
              <DatabaseOutlined className="login-feature-icon icon-db" />
              <div>
                <strong>实时数据接入</strong>
                <span>TDengine 数据采集状态一屏可见</span>
              </div>
            </div>
          </div>
          <div className="login-badges login-fadein-up" style={{ animationDelay: '0.55s' }}>
            <span>中型产线</span>
            <span>标准 RBAC</span>
            <span>外部推送接口</span>
          </div>
        </div>

        <div className="login-card login-fadein-up" style={{ animationDelay: '0.2s' }}>
          <div className="login-logo">
            <div className="login-logo__mark">PdM</div>
            <h1>PdM 智能运维平台</h1>
            <p>工业设备预测性维护系统</p>
          </div>

          <Form onFinish={onFinish} size="large" initialValues={{ username: 'admin', password: 'Admin@123' }}>
            <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
              <Input prefix={<UserOutlined />} placeholder="用户名" autoComplete="username" />
            </Form.Item>
            <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="密码" autoComplete="current-password" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block
                className="login-submit-btn"
                style={{ height: 46, fontSize: 16, borderRadius: 12 }}>
                进入控制台
              </Button>
            </Form.Item>
          </Form>

          <div className="login-meta login-meta--first">
            <Text style={{ color: 'var(--text-muted)', fontSize: 12 }}>
              默认账号: admin / Admin@123
            </Text>
          </div>
          <div className="login-meta">
            <Text style={{ color: 'var(--text-muted)', fontSize: 11 }}>
              v1.0.0 · Industrial PdM Platform
            </Text>
          </div>
        </div>
      </div>
    </div>
  );
}
