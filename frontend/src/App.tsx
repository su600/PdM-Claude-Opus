import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import {
  Layout, Menu, Button, Badge, Tag, Drawer, List, Typography, Space, message, Avatar, Tooltip,
} from 'antd';
import {
  DashboardOutlined, ExperimentOutlined, SafetyCertificateOutlined,
  SettingOutlined, BellOutlined, LogoutOutlined, MenuOutlined,
  SearchOutlined, DesktopOutlined, WarningOutlined, ReloadOutlined,
  DatabaseOutlined, SunOutlined, MoonOutlined, ToolOutlined, ControlOutlined,
} from '@ant-design/icons';
import api from './api';
import type { User, Device, Alert, HealthStatus, NotificationEvent, PredictionConfig, AlgoTemplate } from './types';
import { DEVICE_STATUS_LABEL, ALERT_LEVEL_LABEL, NOTIF_STATUS_LABEL, LEVEL_COLOR } from './types';
import { useTheme } from './ThemeContext';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PredictionPage, { DEFAULT_PREDICTION_CONFIG, DEFAULT_ALGO_PARAMS } from './pages/PredictionPage';
import RulesPage from './pages/RulesPage';
import GovernancePage from './pages/GovernancePage';
import NotificationsPage from './pages/NotificationsPage';
import DataSourcePage from './pages/DataSourcePage';
import DeviceManagementPage from './pages/DeviceManagementPage';
import DeviceDetailPage from './pages/DeviceDetailPage';
import SystemManagementPage from './pages/SystemManagementPage';
import CommandPalette, { type CommandItem } from './components/CommandPalette';

const { Header, Sider, Content, Footer } = Layout;
const { Text } = Typography;

const APP_SECTIONS = [
  {
    key: '/dashboard', icon: <DashboardOutlined />, label: '运行总览',
    description: '车间态势、在线率与风险窗口',
  },
  {
    key: '/prediction', icon: <ExperimentOutlined />, label: '预测中心',
    description: '多算法推理与风险评分编排',
  },
  {
    key: '/rules', icon: <SafetyCertificateOutlined />, label: '规则中心',
    description: '阈值告警与规则启停控制',
  },
  {
    key: '/governance', icon: <SettingOutlined />, label: '算法治理',
    description: '模板、权重和评估闭环',
  },
  {
    key: '/notifications', icon: <BellOutlined />, label: '通知中心',
    description: '推送成功率与失败重试积压',
  },
  {
    key: '/datasources', icon: <DatabaseOutlined />, label: '数据源',
    description: '数据接入状态和连接治理',
  },
  {
    key: '/devices', icon: <ToolOutlined />, label: '设备管理',
    description: '设备台账、维保记录和数据源关联',
  },
  {
    key: '/system', icon: <ControlOutlined />, label: '系统管理',
    description: '系统配置、连接状态与通知设置',
  },
];

const MENU_ITEMS = APP_SECTIONS.map((item) => ({
  key: item.key,
  icon: item.icon,
  label: item.label,
}));

const ROLE_LABEL: Record<string, string> = {
  admin: '管理员',
  engineer: '工程师',
  supervisor: '车间主任',
  viewer: '只读',
};

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, toggle: toggleTheme } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawer, setMobileDrawer] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [health, setHealth] = useState<HealthStatus>({ service: 'ok', tdengine: 'error' });
  const [lastSync, setLastSync] = useState('');
  const [clock, setClock] = useState(() => new Date().toLocaleTimeString('zh-CN'));
  const [deviceDrawer, setDeviceDrawer] = useState(false);
  const [alertDrawer, setAlertDrawer] = useState(false);
  const [notifDrawer, setNotifDrawer] = useState(false);
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
  const [cmdPalette, setCmdPalette] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 760);
  const [predictionConfig, setPredictionConfig] = useState<PredictionConfig>(DEFAULT_PREDICTION_CONFIG);

  const handleApplyTemplate = (template: AlgoTemplate) => {
    // Convert template weights (0-1) back to 0-100 for the UI
    const uiWeights: Record<string, number> = {};
    for (const [k, v] of Object.entries(template.weights || {})) {
      uiWeights[k] = Math.round(v * 100);
    }
    const uiThresholds = {
      high_risk: Math.round((template.thresholds?.high_risk || 0.7) * 100),
      medium_risk: Math.round((template.thresholds?.medium_risk || 0.4) * 100),
    };
    // Build algo params, falling back to defaults
    const algoParams = {
      rule_based: { ...DEFAULT_ALGO_PARAMS.rule_based, ...(template.algo_params?.rule_based || {}) },
      statistical: { ...DEFAULT_ALGO_PARAMS.statistical, ...(template.algo_params?.statistical || {}) },
      ml: { ...DEFAULT_ALGO_PARAMS.ml, ...(template.algo_params?.ml || {}) },
      deep_learning: { ...DEFAULT_ALGO_PARAMS.deep_learning, ...(template.algo_params?.deep_learning || {}) },
    };
    setPredictionConfig({
      algorithms: template.algorithms || DEFAULT_PREDICTION_CONFIG.algorithms,
      weights: uiWeights,
      thresholds: uiThresholds,
      algoParams,
    });
    navigate('/prediction');
  };

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 760);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCmdPalette((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [uRes, dRes, aRes, hRes, nRes] = await Promise.all([
        api.get('/users/me'),
        api.get('/devices'),
        api.get('/alerts'),
        api.get('/health'),
        api.get('/notifications/events'),
      ]);
      setUser(uRes.data);
      setDevices(dRes.data);
      setAlerts(aRes.data);
      setHealth(hRes.data);
      setNotifications(nRes.data);
      setLastSync(new Date().toLocaleTimeString('zh-CN'));
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 30000);
    return () => clearInterval(iv);
  }, [fetchData]);

  // Real-time clock (updates every second)
  useEffect(() => {
    const tick = setInterval(() => setClock(new Date().toLocaleTimeString('zh-CN')), 1000);
    return () => clearInterval(tick);
  }, []);

  const highAlerts = alerts.filter((a) => a.level === 'high' || a.level === 'critical');
  const onlineDevices = devices.filter((d) => d.status === 'online');
  const pendingNotifs = notifications.filter((n) => n.status !== 'success');
  const platformHealthy = health.service === 'ok' && health.tdengine === 'ok';
  const currentSection = APP_SECTIONS.find((item) => location.pathname.startsWith(item.key)) || APP_SECTIONS[0];

  const handleLogout = () => {
    localStorage.removeItem('pdm_token');
    localStorage.removeItem('pdm_user');
    window.location.reload();
  };

  const commandItems: CommandItem[] = [
    ...APP_SECTIONS.map((section) => ({
      id: `route:${section.key}`,
      label: section.label,
      description: section.description,
      icon: section.icon,
      hint: section.key,
      keywords: [section.label, section.description, section.key],
    })),
    {
      id: 'action:refresh',
      label: '刷新全局数据',
      description: '立即同步用户、设备、告警和通知数据',
      icon: <ReloadOutlined />,
      hint: 'SYNC',
      keywords: ['刷新', '同步', '数据', 'reload'],
    },
    {
      id: 'action:devices',
      label: '打开设备面板',
      description: '查看设备在线状态和位置分布',
      icon: <DesktopOutlined />,
      hint: 'DRAWER',
      keywords: ['设备', '在线', 'drawer'],
    },
    {
      id: 'action:alerts',
      label: '查看高风险告警',
      description: '聚焦 high 与 critical 告警列表',
      icon: <WarningOutlined />,
      hint: 'RISK',
      keywords: ['告警', '高风险', 'critical'],
    },
    {
      id: 'action:notifications',
      label: '打开通知抽屉',
      description: '检查失败推送并触发重试',
      icon: <BellOutlined />,
      hint: 'EVENT',
      keywords: ['通知', '重试', 'failed'],
    },
    {
      id: 'action:theme',
      label: mode === 'dark' ? '切换亮色主题' : '切换暗色主题',
      description: '在工业暗色和亮色模式之间切换',
      icon: mode === 'dark' ? <SunOutlined /> : <MoonOutlined />,
      hint: 'THEME',
      keywords: ['主题', '亮色', '暗色'],
    },
    {
      id: 'action:logout',
      label: '退出登录',
      description: '清理当前令牌并返回登录页',
      icon: <LogoutOutlined />,
      hint: 'EXIT',
      keywords: ['退出', '登录', 'logout'],
    },
  ];

  const executeCommand = async (commandId: string) => {
    setCmdPalette(false);
    if (commandId.startsWith('route:')) {
      navigate(commandId.slice('route:'.length));
      return;
    }
    switch (commandId) {
      case 'action:refresh':
        await fetchData();
        message.success('态势数据已刷新');
        break;
      case 'action:devices':
        setDeviceDrawer(true);
        break;
      case 'action:alerts':
        setAlertDrawer(true);
        break;
      case 'action:notifications':
        setNotifDrawer(true);
        break;
      case 'action:theme':
        toggleTheme();
        break;
      case 'action:logout':
        handleLogout();
        break;
      default:
        break;
    }
  };

  const retryNotifs = async () => {
    try {
      await api.post('/notifications/retry-failed');
      message.success('重试已触发');
      fetchData();
    } catch {
      message.error('重试失败');
    }
  };

  const siderContent = (
    <>
      <div className={`sidebar-brand ${collapsed ? 'is-collapsed' : ''}`}>
        <div className="sidebar-brand__mark">PdM</div>
        {!collapsed && (
          <div className="sidebar-brand__copy">
            <strong>智能运维中枢</strong>
            <span>Predictive Maintenance</span>
          </div>
        )}
      </div>
      <Menu
        theme={mode}
        mode="inline"
        selectedKeys={[APP_SECTIONS.find((s) => location.pathname.startsWith(s.key))?.key || location.pathname]}
        items={MENU_ITEMS}
        onClick={({ key }) => { navigate(key); setMobileDrawer(false); }}
        style={{ borderRight: 0, marginTop: 8 }}
      />
    </>
  );

  const levelColor = (level: string) => LEVEL_COLOR[level] || '#64748b';

  return (
    <Layout className="app-shell" style={{ minHeight: '100vh' }}>
      {/* Desktop sider */}
      {!isMobile && (
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          width={220}
          collapsedWidth={64}
          style={{ position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 100 }}
        >
          {siderContent}
        </Sider>
      )}

      {/* Mobile drawer */}
      <Drawer
        placement="left"
        open={mobileDrawer}
        onClose={() => setMobileDrawer(false)}
        width={220}
        styles={{ body: { padding: 0 } }}
      >
        {siderContent}
      </Drawer>

      <Layout style={{ marginLeft: isMobile ? 0 : (collapsed ? 64 : 220), transition: 'margin-left 0.2s', height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Header className="control-header">
          <div className="control-header__title">
            <h1>{currentSection.label}</h1>
          </div>
          <div className="control-header__actions">
            {isMobile && (
              <Button type="text" icon={<MenuOutlined />} onClick={() => setMobileDrawer(true)}
                style={{ color: 'var(--text-primary)' }} />
            )}
            <Button
              className="toolbar-search"
              icon={<SearchOutlined />}
              onClick={() => setCmdPalette(true)}
            >
              搜索
              <span>Ctrl+K</span>
            </Button>
            <Tooltip title="刷新态势数据">
              <Button type="text" icon={<ReloadOutlined />} onClick={() => void fetchData()}
                style={{ color: 'var(--text-secondary)' }} />
            </Tooltip>
            <Tooltip title={mode === 'dark' ? '切换亮色主题' : '切换暗色主题'}>
              <Button type="text" icon={mode === 'dark' ? <SunOutlined /> : <MoonOutlined />} onClick={toggleTheme}
                style={{ color: 'var(--text-secondary)' }} />
            </Tooltip>
            <Badge count={pendingNotifs.length} size="small" offset={[-4, 4]}>
              <Button type="text" icon={<BellOutlined />} onClick={() => setNotifDrawer(true)}
                style={{ color: 'var(--text-secondary)' }} />
            </Badge>
            {user && (
              <div className="user-badge">
                <Tooltip title={`${user.display_name} (${user.role})`}>
                  <Avatar size="small" style={{ backgroundColor: '#3b82f6', fontSize: 12 }}>
                    {user.display_name?.[0] || 'U'}
                  </Avatar>
                </Tooltip>
                {!isMobile && (
                  <div className="user-badge__copy">
                    <strong>{user.display_name}</strong>
                    <span>{ROLE_LABEL[user.role] || user.role}</span>
                  </div>
                )}
              </div>
            )}
            <Tooltip title="退出登录">
              <Button type="text" icon={<LogoutOutlined />} onClick={handleLogout}
                style={{ color: 'var(--text-secondary)' }} />
            </Tooltip>
          </div>
        </Header>

        {/* Status bar */}
        <div className="status-wrap">
          <div className="status-bar">
            <div className="status-cell">
              <span className="status-cell__label">服务</span>
              <strong className="status-cell__value">
                <span className={`status-dot ${health.service === 'ok' ? 'ok' : 'error'}`} />
                {health.service === 'ok' ? '正常' : '异常'}
              </strong>
            </div>
            <div className="status-cell">
              <span className="status-cell__label">时序库</span>
              <strong className="status-cell__value">
                <span className={`status-dot ${health.tdengine === 'ok' ? 'ok' : 'error'}`} />
                {health.tdengine === 'ok' ? '已连接' : '离线'}
              </strong>
            </div>
            <div className="status-cell">
              <span className="status-cell__label">角色</span>
              <strong className="status-cell__value">{ROLE_LABEL[user?.role || ''] || user?.role || '-'}</strong>
            </div>
            <div className="status-cell">
              <span className="status-cell__label">同步</span>
              <strong className="status-cell__value">{lastSync || '等待中'}</strong>
            </div>
            <div className="status-cell align-right">
              <span className="status-cell__label">系统时间</span>
              <strong className="status-cell__value clock-value">{clock}</strong>
            </div>
          </div>
        </div>

        {/* Content */}
        <Content className="content-shell" style={{ padding: '0 16px 16px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          <div className="page-enter-active" key={location.pathname}>
            <Routes>
              <Route path="/dashboard" element={<DashboardPage devices={devices} alerts={alerts} />} />
              <Route path="/prediction" element={<PredictionPage devices={devices} config={predictionConfig} onConfigChange={setPredictionConfig} />} />
              <Route path="/rules" element={<RulesPage />} />
              <Route path="/governance" element={<GovernancePage currentConfig={predictionConfig} onApplyTemplate={handleApplyTemplate} />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/datasources" element={<DataSourcePage />} />
              <Route path="/devices" element={<DeviceManagementPage />} />
              <Route path="/devices/:id" element={<DeviceDetailPage />} />
              <Route path="/system" element={<SystemManagementPage />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </Content>

        {/* Footer */}
        <Footer className="app-footer">
          PdM 智能运维平台 v1.0.0 | {platformHealthy ? '运行正常' : '存在异常'} | 环境: DEV
        </Footer>
      </Layout>

      {/* Device drawer */}
      <Drawer title={`设备列表 · ${onlineDevices.length}/${devices.length} 在线`} open={deviceDrawer} onClose={() => setDeviceDrawer(false)} width={400}>
        <List
          dataSource={devices}
          renderItem={(d) => (
            <List.Item>
              <List.Item.Meta
                title={<span className="primary-text">{d.name}</span>}
                description={
                  <span className="secondary-text">
                    {d.device_type} · {d.location}
                  </span>
                }
              />
              <Tag color={d.status === 'online' ? 'green' : d.status === 'warning' ? 'orange' : d.status === 'error' ? 'red' : 'default'}>
                {DEVICE_STATUS_LABEL[d.status] || d.status}
              </Tag>
            </List.Item>
          )}
        />
      </Drawer>

      {/* Alert drawer */}
      <Drawer title={`高风险告警 · ${highAlerts.length}`} open={alertDrawer} onClose={() => setAlertDrawer(false)} width={460}>
        <List
          dataSource={highAlerts}
          renderItem={(a) => (
            <List.Item>
              <List.Item.Meta
                title={<span className="primary-text">{a.message}</span>}
                description={
                  <span className="secondary-text">
                    {a.device_name} · {a.metric}: {a.value}
                  </span>
                }
              />
              <Tag color={levelColor(a.level)}>{ALERT_LEVEL_LABEL[a.level] || a.level}</Tag>
            </List.Item>
          )}
        />
      </Drawer>

      {/* Notification drawer */}
      <Drawer
        title={<>通知中心 <Badge count={pendingNotifs.length} style={{ marginLeft: 8 }} /></>}
        open={notifDrawer}
        onClose={() => setNotifDrawer(false)}
        width={460}
        extra={
          <Button size="small" icon={<ReloadOutlined />} onClick={retryNotifs}>
            重试失败
          </Button>
        }
      >
        <List
          dataSource={notifications.slice(0, 20)}
          renderItem={(n) => (
            <List.Item>
              <List.Item.Meta
                title={<span className="primary-text">{n.title}</span>}
                description={
                  <span className="secondary-text secondary-text--sm">
                    {n.body?.substring(0, 80)}
                  </span>
                }
              />
              <Tag color={n.status === 'success' ? 'green' : n.status === 'failed' ? 'red' : 'blue'}>
                {NOTIF_STATUS_LABEL[n.status] || n.status}
              </Tag>
            </List.Item>
          )}
        />
      </Drawer>

      {/* Command palette */}
      {cmdPalette && (
        <CommandPalette
          items={commandItems}
          onClose={() => setCmdPalette(false)}
          onExecute={(commandId) => { void executeCommand(commandId); }}
        />
      )}
    </Layout>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(!!localStorage.getItem('pdm_token'));

  if (!authed) {
    return <LoginPage onSuccess={() => setAuthed(true)} />;
  }

  return <AppShell />;
}
