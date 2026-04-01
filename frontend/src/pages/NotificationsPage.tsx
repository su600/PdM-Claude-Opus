import React, { useEffect, useState } from 'react';
import {
  Card, Table, Button, Tag, message, Space,
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import api from '../api';
import type { NotificationEvent } from '../types';
import { NOTIF_STATUS_LABEL, ALERT_LEVEL_LABEL } from '../types';

export default function NotificationsPage() {
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await api.get('/notifications/events');
      setEvents(res.data);
    } catch {
      message.error('获取通知事件失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEvents(); }, []);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const res = await api.post('/notifications/retry-failed');
      message.success(`已重试 ${res.data.retried} 个失败事件`);
      fetchEvents();
    } catch {
      message.error('重试失败');
    } finally {
      setRetrying(false);
    }
  };

  const statusColor: Record<string, string> = {
    success: 'green', failed: 'red', pending: 'blue',
  };

  const columns = [
    { title: '标题', dataIndex: 'title', key: 'title', width: 160 },
    {
      title: '类型',
      dataIndex: 'level',
      key: 'level',
      width: 80,
      render: (level: string) => {
        const colors: Record<string, string> = { low: 'green', medium: 'gold', high: 'orange', critical: 'red' };
        return <Tag color={colors[level] || 'blue'}>{ALERT_LEVEL_LABEL[level] || level}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) => <Tag color={statusColor[status] || 'default'}>{NOTIF_STATUS_LABEL[status] || status}</Tag>,
    },
    {
      title: '重试次数',
      dataIndex: 'retries',
      key: 'retries',
      width: 80,
      render: (v: number) => <span className="mono-value">{v}</span>,
    },
    {
      title: '目标地址',
      dataIndex: 'target_url',
      key: 'target_url',
      ellipsis: true,
      render: (url: string) => <span className="secondary-text secondary-text--sm">{url}</span>,
    },
    {
      title: '错误',
      dataIndex: 'error',
      key: 'error',
      ellipsis: true,
      render: (err: string) => err ? <span className="danger-text danger-text--sm">{err}</span> : '-',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (t: string) => new Date(t).toLocaleString('zh-CN'),
    },
  ];

  const failedCount = events.filter((e) => e.status === 'failed').length;

  return (
    <div className="page-shell page-shell--compact">
      <Card
        className="section-card table-card simple-card"
        size="small"
        title="通知事件"
        extra={
          <Space wrap>
            {failedCount > 0 && <Tag color="red">失败 {failedCount}</Tag>}
            <Button icon={<ReloadOutlined />} onClick={() => void fetchEvents()}>
              刷新
            </Button>
            <Button
              type="primary"
              danger
              icon={<ReloadOutlined />}
              onClick={handleRetry}
              loading={retrying}
              disabled={failedCount === 0}
            >
              重试失败
            </Button>
          </Space>
        }
      >
        <Table
          dataSource={events}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 15 }}
          size="small"
          scroll={{ x: 800 }}
        />
      </Card>
    </div>
  );
}
