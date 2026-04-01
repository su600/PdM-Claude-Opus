# PdM 智能运维平台 — 完整复刻文档

> **生成时间**：2026-03-27  
> **使用 Agent 模型**：GitHub Copilot（Claude Opus 4.6）— VS Code Copilot Chat Agent 模式  
> **工作方式**：在 VS Code 中通过 Copilot Chat 以多轮对话方式，逐步构建整个项目。Copilot 直接在编辑器中创建/编辑文件、运行终端命令、调试错误、自动修复。  
> **项目定位**：工业设备预测性维护（Predictive Maintenance）平台，覆盖机加、复材铺丝、激光焊接、检验监测等场景。
# **核心功能**：多算法预测（参数可配置）与阈值治理、算法内部参数配置、模板管理与套用、通知事件推送与重试、TDengine 遥测数据采集与趋势查询、Dashboard KPI 动态计算、系统健康状态显示。
注：UI设计用GPT5.4更新了一版用力过猛，又简化回来了，最终版本在前端实现细节里有说明。-Su
---

## 一、技术栈总览

| 层级 | 技术 | 版本 |
|------|------|------|
| **后端框架** | Python + FastAPI | Python 3.11 / FastAPI 0.115.x |
| **认证** | python-jose (JWT HS256) + bcrypt | python-jose 3.x / bcrypt ≥4.0 |
| **HTTP 客户端** | httpx | 0.28.x |
| **配置管理** | pydantic-settings | 2.x |
| **前端框架** | React + TypeScript + Vite | React 18.3 / Vite 6.x |
| **UI 组件库** | Ant Design 5 + @ant-design/icons | antd 5.24.x |
| **图表** | ECharts + echarts-for-react | ECharts 5.6 |
| **路由** | react-router-dom (HashRouter) | 6.28.x |
| **HTTP 请求** | axios | 1.7.x |
| **时序数据库** | TDengine (REST SQL, 不依赖 libtaos) | 3.3.4.3 |
| **容器编排** | Docker Compose | v3.9 |
| **前端生产部署** | Nginx (Alpine) | - |

---

## 二、项目目录结构

```
PdM-Claude/
├── docker-compose.yml              # 三服务编排
├── .env.example                     # 环境变量模板
├── README.md
├── replication-requirements.md      # 复刻需求总文档
├── project-summary-by-opus46.md     # 本文档
│
├── backend/
│   ├── Dockerfile                   # Python 3.11-slim
│   ├── .dockerignore                # 排除 __pycache__、.git 等
│   ├── requirements.txt             # 9 个依赖
│   └── app/
│       ├── __init__.py
│       ├── main.py                  # FastAPI 入口 + CORS + Lifespan + 启动自检
│       ├── core/
│       │   ├── __init__.py
│       │   ├── config.py            # pydantic-settings 配置
│       │   └── security.py          # JWT 签发/验证 + bcrypt 密码哈希
│       ├── db/
│       │   ├── __init__.py
│       │   ├── models.py            # 全部 Pydantic 模型（20+ 个）
│       │   └── store.py             # 内存数据库 + 种子数据（动态读取 settings）
│       ├── routers/
│       │   ├── __init__.py
│       │   ├── auth.py              # 登录 + JWT 依赖 + RBAC
│       │   ├── users.py             # 用户管理
│       │   ├── devices.py           # 设备管理
│       │   ├── alerts.py            # 告警管理
│       │   ├── rules.py             # 规则中心
│       │   ├── predictions.py       # 预测接口
│       │   ├── governance.py        # 算法治理（模板/评估/审计）
│       │   ├── datasources.py       # 数据源 CRUD + 连接测试
│       │   ├── telemetry.py         # 遥测采集与查询
│       │   ├── notifications.py     # 通知推送 + 重试
│       │   └── health.py            # 健康检查
│       └── services/
│           ├── __init__.py
│           ├── prediction_svc.py    # 多算法加权融合
│           ├── tdengine_svc.py      # TDengine REST SQL 封装
│           └── notification_svc.py  # Webhook HMAC 签名 + 重试
│
├── frontend/
│   ├── Dockerfile                   # 二阶段构建 (Node build → Nginx)
│   ├── .dockerignore                # 排除 node_modules、dist 等
│   ├── nginx.conf                   # SPA fallback + 静态缓存
│   ├── package.json                 # 依赖清单
│   ├── tsconfig.json
│   ├── vite.config.ts               # 代理 /api → backend:8000
│   ├── index.html
│   └── src/
│       ├── main.tsx                 # React 入口 (HashRouter + ThemeProvider)
│       ├── App.tsx                  # 主框架 Shell + 路由 + 抽屉
│       ├── api.ts                   # axios 实例 + 拦截器
│       ├── styles.css               # 全局主题变量 + Ant Design 覆盖
│       ├── ThemeContext.tsx          # 亮/暗主题切换
│       ├── vite-env.d.ts
│       ├── components/
│       │   └── CommandPalette.tsx    # Ctrl+K 全局快捷导航
│       ├── pages/
│       │   ├── LoginPage.tsx        # 品牌化登录
│       │   ├── DashboardPage.tsx    # 运行总览
│       │   ├── PredictionPage.tsx   # 预测中心
│       │   ├── RulesPage.tsx        # 规则中心
│       │   ├── GovernancePage.tsx   # 算法治理
│       │   ├── NotificationsPage.tsx # 通知中心
│       │   └── DataSourcePage.tsx   # 数据源配置
│       └── types/
│           └── index.ts             # TypeScript 领域类型 + 统一中文标签常量
│
└── docs/
    └── notification-contract.md     # 通知推送协议文档
```

---

## 三、Docker Compose 编排

```yaml
version: "3.9"

services:
  tdengine:
    image: tdengine/tdengine:3.3.4.3
    container_name: pdm-tdengine
    ports:
      - "6030:6030"
      - "6041:6041"
    volumes:
      - tdengine_data:/var/lib/taos
    healthcheck:
      # ⚠️ 关键：必须使用 /rest/login/root/taosdata，不能用 /rest/login
      test: ["CMD", "curl", "-f", "http://localhost:6041/rest/login/root/taosdata"]
      interval: 5s
      timeout: 5s
      retries: 30
      start_period: 15s

  backend:
    build: ./backend
    container_name: pdm-backend
    ports:
      - "8000:8000"
    env_file: [.env]
    environment:
      - TDENGINE_HOST=tdengine
    depends_on:
      tdengine: { condition: service_healthy }
    restart: unless-stopped

  frontend:
    build: ./frontend
    container_name: pdm-frontend
    ports:
      - "5173:80"
    depends_on: [backend]
    restart: unless-stopped

volumes:
  tdengine_data:
```

---

## 四、后端 API 完整接口清单

### 4.1 认证与用户

| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| `POST` | `/auth/token` | 用户名密码登录，返回 JWT | 公开 |
| `GET` | `/users/me` | 当前用户信息 | 已登录 |
| `GET` | `/users` | 用户列表 | 已登录 |
| `POST` | `/users` | 创建用户 | admin |

### 4.2 设备与告警

| 方法 | 路径 | 描述 |
|------|------|------|
| `GET` | `/devices` | 设备列表 |
| `POST` | `/devices` | 创建设备 |
| `GET` | `/alerts` | 告警列表 |
| `POST` | `/alerts` | 创建告警 |

### 4.3 规则中心

| 方法 | 路径 | 描述 |
|------|------|------|
| `GET` | `/rules` | 规则列表 |
| `POST` | `/rules` | 创建规则 |
| `POST` | `/rules/{rule_id}/toggle` | 启停切换 |

### 4.4 预测

| 方法 | 路径 | 描述 |
|------|------|------|
| `POST` | `/predictions/infer` | 运行预测（多算法加权融合，支持自定义算法参数） |
| `GET` | `/predictions/stats` | 预测统计（总次数 + 平均风险分） |

请求体新增字段 `algo_params`（可选），结构：
```json
{
  "algo_params": {
    "rule_based": { "alert_weight": 0.25, "base_rul": 500, ... },
    "statistical": { "risk_mean": 0.35, "risk_std": 0.15, ... },
    "ml": { "risk_mean": 0.40, "risk_std": 0.18, ... },
    "deep_learning": { "risk_mean": 0.38, "risk_std": 0.20, ... }
  }
}
```

返回结构：`risk_score`, `rul_hours`, `confidence`, `recommendation`, `risk_level`, `algorithm_outputs[]`

### 4.5 算法治理

| 方法 | 路径 | 描述 |
|------|------|------|
| `GET` | `/algo-governance/templates` | 模板列表 |
| `POST` | `/algo-governance/templates` | 创建模板 |
| `PUT` | `/algo-governance/templates/{id}` | 更新模板 |
| `DELETE` | `/algo-governance/templates/{id}` | 删除模板 |
| `GET` | `/algo-governance/templates/export` | 导出全部模板 JSON |
| `POST` | `/algo-governance/templates/import` | 导入模板 JSON (multipart) |
| `GET` | `/algo-governance/evaluations` | 评估记录列表 |
| `POST` | `/algo-governance/evaluations` | 创建评估记录 |
| `GET` | `/algo-governance/audit-logs` | 审计日志 |

### 4.6 遥测

| 方法 | 路径 | 描述 |
|------|------|------|
| `POST` | `/telemetry/ingest` | 写入遥测点 (→ TDengine) |
| `GET` | `/telemetry/{device_id}` | 查询设备遥测 |

### 4.7 通知

| 方法 | 路径 | 描述 |
|------|------|------|
| `POST` | `/notifications/push` | 推送通知（HMAC 签名 + 重试） |
| `GET` | `/notifications/events` | 事件列表 |
| `POST` | `/notifications/retry-failed` | 手动重试失败事件 |

### 4.8 数据源

| 方法 | 路径 | 描述 |
|------|------|------|
| `GET` | `/datasources` | 数据源列表（密码脱敏） |
| `GET` | `/datasources/{id}` | 单个数据源 |
| `POST` | `/datasources` | 创建数据源 |
| `PUT` | `/datasources/{id}` | 更新数据源 |
| `DELETE` | `/datasources/{id}` | 删除数据源 |
| `POST` | `/datasources/{id}/test` | 测试已有数据源连接 |
| `POST` | `/datasources/test-new` | 测试新配置（不保存） |

### 4.9 健康检查

| 方法 | 路径 | 描述 |
|------|------|------|
| `GET` | `/health` | 返回 `{ service: "ok", tdengine: "ok"|"error" }` |

---

## 五、后端核心实现细节

### 5.1 配置 (config.py)
- 使用 `pydantic-settings` 的 `BaseSettings`，支持 `.env` 文件加载
- 关键配置项：`JWT_SECRET`, `WEBHOOK_SIGNING_SECRET`, TDengine 连接参数
- CORS 允许 `localhost:5173/5174/5175`

### 5.2 认证与安全 (security.py)
- 密码哈希：直接使用 `bcrypt` 库（**不用 passlib**，因为 passlib 与 bcrypt 5.x 不兼容）
- JWT：`python-jose` HS256，默认 8 小时过期
- 依赖注入：`get_current_user` 从 `HTTPBearer` 提取 token → 解码 → 查找用户
- RBAC：`require_roles("admin", "engineer")` 工厂函数

### 5.3 数据存储 (store.py)
- **内存字典/列表**作为 demo 数据库（非持久化）
- 启动时 `_seed()` 自动注入：
  - 1 个管理员用户 (`admin` / `Admin@123`)
  - 6 台演示设备（机加、铺丝、焊接、监测）
  - 4 条演示告警
  - 4 条演示规则
  - 1 个默认数据源配置（**动态读取 `settings.TDENGINE_HOST/PORT` 等**，确保 Docker 环境与本地环境统一）
  - 1 个默认算法模板（**含完整 algo_params 算法参数配置**）

### 5.4 数据模型 (models.py)
- **AlgorithmParams** 模型：定义四种算法的可配置内部参数
  - `rule_based`：alert_weight, base_rul, rul_decay_per_alert, noise_min, noise_max, confidence_min, confidence_max
  - `statistical / ml / deep_learning`：risk_mean, risk_std, rul_mean, rul_std, confidence_min, confidence_max
- **PredictionRequest**：新增可选 `algo_params: Optional[AlgorithmParams]` 字段
- **AlgoTemplate**：新增 `algo_params: Dict[str, Dict[str, float]]` 字段，模板可保存/导入导出完整参数

### 5.4 应用启动自检 (main.py lifespan)
- **Lifespan** 启动流程：
  1. 尝试初始化 TDengine 数据库（`init_database()`）
  2. 调用 `check_health()` 探测 TDengine 连接状态
  3. 遍历所有 `tdengine` 类型数据源，同步更新 `status` 字段（`"ok"` / `"error"`）和 `status_message`
- 确保 `/health` 端点与数据源页面状态始终一致

### 5.5 预测服务 (prediction_svc.py)
四种算法模拟器（**参数均可通过 API 自定义**）：
1. **规则引擎** (`rule_based`)：基于告警数量推断风险，参数：alert_weight, base_rul, rul_decay_per_alert, noise_min/max, confidence_min/max
2. **统计分析** (`statistical`)：高斯分布模拟，参数：risk_mean/std, rul_mean/std, confidence_min/max
3. **机器学习** (`ml`)：随机森林+XGBoost 集成模拟，参数同上
4. **深度学习** (`deep_learning`)：LSTM-Attention 模拟，参数同上

所有算法函数签名为 `_xxx(device, params)`，从传入的 params dict 读取参数，未传时使用默认值。

融合逻辑：
- 按用户配置的权重加权求和
- 归一化权重 → 计算 risk_score / rul_hours / confidence
- 基于阈值判定 risk_level (low/medium/high)
- 生成维护建议 recommendation
- 保留最近 200 条预测

### 5.5 TDengine 服务 (tdengine_svc.py)
- REST SQL 接口（不依赖本地 `libtaos`）
- Base64 Basic Auth 认证
- `init_database()`：创建数据库 + 超级表 `telemetry`
- 超级表结构：`ts TIMESTAMP, temperature FLOAT, vibration FLOAT, pressure FLOAT, rpm FLOAT, TAGS(device_id BINARY(64))`
- 子表自动创建：`t_{device_id}`

### 5.6 通知服务 (notification_svc.py)
- HMAC-SHA256 签名（`WEBHOOK_SIGNING_SECRET` 为密钥）
- Header: `X-PdM-Signature` + `X-PdM-Timestamp`
- 超时 4 秒，重试 3 次（1s/2s/3s 回退）
- 状态跟踪：pending → success / failed

---

## 六、前端完整实现细节

### 6.1 入口与路由
- `main.tsx`：`HashRouter` + `ThemeProvider` + `App`
- `App.tsx`：
  - 未登录 → 渲染 `LoginPage`
  - 已登录 → 渲染 `AppShell`（含侧边栏 + 顶部栏 + 路由页面）
- 路由配置：
  - `/dashboard` — 运行总览
  - `/prediction` — 预测中心
  - `/rules` — 规则中心
  - `/governance` — 算法治理
  - `/notifications` — 通知中心
  - `/datasources` — 数据源配置
  - `*` → `/dashboard`

### 6.2 主框架 Shell (App.tsx)
- **左侧导航**：桌面端 Sider（可折叠）+ 移动端 Drawer
- **顶部栏**：
  - 设备数 Tag（点击展开设备抽屉）
  - 高风险告警 Tag（点击展开告警抽屉）
  - 亮/暗主题切换按钮
  - 快捷导航按钮（打开 CommandPalette）
  - 通知 Badge（未处理计数，点击展开通知抽屉）
  - 用户头像 Tooltip
  - 退出按钮
- **共享状态管理**：
  - `predictionConfig` 状态（algorithms, weights, thresholds, algoParams）在 AppShell 中维护
  - PredictionPage 通过 `config` + `onConfigChange` props 双向绑定
  - GovernancePage 通过 `currentConfig` + `onApplyTemplate` props 读取配置和套用模板
  - 模板套用时自动转换权重（0-1 → 0-100）、阈值，合并 algo_params，并跳转预测页
- **状态栏**：平台服务状态、TDengine 状态（正常/异常，用词统一）、当前角色、最近同步时间
- **页脚**：版本号、运行状态标识（同时检查 service 和 tdengine 双状态）、环境标识
- **定时轮询**：每 30 秒刷新 users/me、devices、alerts、health、notifications

### 6.3 登录页 (LoginPage.tsx)
- 品牌化深色登录卡片
- 渐变 Logo + 标题 + 副标题
- 默认填充 `admin / Admin@123`
- 版本信息显示
- `axios POST /auth/token` → token 存 `localStorage`

### 6.4 运行总览 (DashboardPage.tsx)
- 4 个 KPI 卡片：在线设备、高风险告警、**平均风险分（从 `/predictions/stats` 动态获取）**、**最近预测次数（动态获取）**
- 遥测趋势图（ECharts 折线图：温度/振动/压力）
  - 有真实数据用真实数据，无数据时生成演示曲线
  - 包含 dataZoom 滑动条
- 最新告警表格（等级 Tag 分色，中文标签：低/中/高/危急）

### 6.5 预测中心 (PredictionPage.tsx)
- **左侧配置面板**：
  - 设备选择下拉
  - 4 种算法开关 (Switch) + 权重滑块 (Slider)
  - 高/中风险阈值滑块
  - **可折叠"算法参数配置"面板**（Collapse 组件）：
    - 每个启用的算法展示其内部参数（InputNumber 编辑）
    - rule_based：告警权重、基础 RUL、每告警衰减 RUL、噪声范围、置信度范围
    - statistical / ml / deep_learning：风险分均值/标准差、RUL 均值/标准差、置信度范围
    - 每个参数带中文标签和合理的 min/max/step 限制
    - "恢复默认"按钮重置为出厂默认值
  - "运行预测"按钮（将 algo_params 一同发送给后端）
- **右侧结果面板**：
  - 风险分 / RUL / 置信度大数字展示
  - 风险等级 Tag（中文标签：低/中/高/危急）+ 建议措施
  - 各算法详情行
  - 算法贡献饼图 (ECharts)
  - 风险趋势折线图（最近 10 次 + 阈值标线）
- 每次预测自动提交评估记录到 `/algo-governance/evaluations`
- **配置状态通过 props 与 App.tsx 共享**，治理页可读取当前配置

### 6.6 规则中心 (RulesPage.tsx)
- 规则列表表格（名称、设备类型、指标、条件、等级、启停 Switch、时间）
- "新建规则"弹窗 Modal（带完整字段校验）
- 启停切换调用 `POST /rules/{id}/toggle`

### 6.7 算法治理 (GovernancePage.tsx)
- 三个 Tab 页：
  1. **模板管理**：
     - "保存当前配置为模板"按钮（**使用预测中心当前实际配置，包括 algo_params**，非硬编码默认值）
     - 导出 JSON（包含 algo_params 字段）、导入 JSON (Upload)
     - **套用按钮：真正加载模板配置到预测中心并跳转**（通过 App.tsx 共享状态传递）
     - 删除 (Popconfirm)
     - **模板表格支持展开行查看各算法参数详情**
  2. **评估记录**：设备ID、预测ID、命中率、误报率、备注、时间
  3. **审计日志**：操作类型(Tag)、目标类型、用户、详情、时间
- 接收 `currentConfig` 和 `onApplyTemplate` props 与 App.tsx 联动

### 6.8 通知中心 (NotificationsPage.tsx)
- 事件列表表格：标题、等级（中文标签）、状态（待发送/成功/失败）、重试次数、目标地址、错误信息、时间
- "重试失败事件"按钮（failedCount 为 0 时禁用）

### 6.9 数据源配置 (DataSourcePage.tsx)
- 数据源列表表格（状态图标、名称、连接信息、用户、启用、更新时间、操作）
- 新建/编辑 Modal：名称、类型(TDengine/MySQL/PostgreSQL/InfluxDB)、主机、端口、用户名、密码、数据库、启用开关
- Modal 内"测试连接"按钮
- 测试结果弹窗（成功/失败图标 + 延迟 ms）

### 6.10 快捷导航 (CommandPalette.tsx)
- `Ctrl+K` 全局快捷键呼出
- 搜索输入框 + 路由项列表（键盘上下选择 + 回车导航）
- ESC 关闭

### 6.11 主题系统 (ThemeContext.tsx)
- 亮/暗双主题，默认暗色
- Ant Design `ConfigProvider` + `darkAlgorithm` / `defaultAlgorithm`
- 自定义 token（`colorPrimary`, `colorBgContainer`, `colorBorder` 等）
- `localStorage` 持久化主题偏好
- `data-theme` 属性挂载到 HTML 根元素

### 6.12 API 层 (api.ts)
- axios 实例，baseURL 从 `VITE_API_BASE` 环境变量读取
- 请求拦截器：自动注入 `Bearer {token}`
- 响应拦截器：401 时清除 token 并跳转登录

### 6.13 统一标签体系 (types/index.ts)
- **AlgorithmParams** 接口：四种算法各自的参数字典类型
- **PredictionConfig** 接口：完整预测配置（algorithms, weights, thresholds, algoParams），用于跨页面状态共享
- **AlgoTemplate** 接口：含 `algo_params` 字段，支持模板保存/导入导出完整参数
- **设备状态**：`DEVICE_STATUS_LABEL` — online=在线, offline=离线, warning=告警, error=故障
- **告警等级**：`ALERT_LEVEL_LABEL` — low=低, medium=中, high=高, critical=危急
- **通知状态**：`NOTIF_STATUS_LABEL` — pending=待发送, success=成功, failed=失败
- **颜色映射**：`LEVEL_COLOR` — 与告警等级对应的统一色值（绿/黄/橙/红）
- 所有页面（App.tsx、DashboardPage、PredictionPage、NotificationsPage）从此常量集中引用，确保全局统一

---

## 七、样式与视觉规范 (styles.css)

### 7.1 CSS 变量体系
- 两套完整配色：dark（默认）和 light
- 变量覆盖：`--bg-primary`, `--bg-card`, `--border-color`, `--text-primary`, `--accent-*`, `--shadow-*`, `--chart-*` 等 30+ 个变量

### 7.2 视觉特征
- **背景**：多层径向渐变光斑（蓝/青/紫），非纯平色
- **卡片**：12px 圆角、hover 上浮 2px、边框微发光
- **KPI 卡片**：顶部 3px 渐变色条（success/warning/danger 语义色）
- **登录页**：毛玻璃效果登录卡片、渐变背景
- **状态点**：ok 绿色发光 / error 红色发光
- **滚动条**：自定义窄滚动条
- **页面切换**：opacity + translateY 过渡动画

### 7.3 响应式断点
- `≤1100px`：登录卡片缩小
- `≤760px`：登录卡片全宽、状态栏缩小、KPI 卡片竖排、侧边栏变抽屉

### 7.4 Ant Design 深度覆盖
- 覆盖了 Layout、Sider、Menu、Card、Table、Modal、Input、Select、Drawer、Tag、Switch、Slider、Popover、Tooltip、Badge、Pagination、Tabs 等组件的背景色/文字色/边框色，确保在暗色主题下可读

---

## 八、后端依赖 (requirements.txt)

```
fastapi==0.115.*
uvicorn[standard]==0.34.*
pydantic==2.*
pydantic-settings==2.*
python-jose[cryptography]==3.*
bcrypt>=4.0
python-multipart==0.*
httpx==0.28.*
apscheduler==3.*
```

---

## 九、前端依赖 (package.json)

```json
{
  "dependencies": {
    "@ant-design/icons": "^5.6.1",
    "antd": "^5.24.2",
    "axios": "^1.7.9",
    "dayjs": "^1.11.13",
    "echarts": "^5.6.0",
    "echarts-for-react": "^3.0.2",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "~5.6.2",
    "vite": "^6.0.1"
  }
}
```

---

## 十、环境变量 (.env.example)

```env
JWT_SECRET=change-me-to-a-strong-random-secret
WEBHOOK_SIGNING_SECRET=change-me-webhook-secret
TDENGINE_HOST=tdengine
TDENGINE_PORT=6041
TDENGINE_USER=root
TDENGINE_PASSWORD=taosdata
TDENGINE_DATABASE=pdm
DEFAULT_WEBHOOK_URL=http://localhost:9999/webhook
```

---

## 十一、已知坑点与注意事项

| # | 问题 | 解决方案 |
|---|------|----------|
| 1 | `passlib` + `bcrypt≥5` 不兼容 | 不用 passlib，直接 `import bcrypt` |
| 2 | TDengine 健康检查 URL | 必须用 `/rest/login/root/taosdata`，不能用 `/rest/login`（404） |
| 3 | 前端路由与 Nginx | 使用 `HashRouter`，Nginx 配 `try_files $uri $uri/ /index.html` |
| 4 | Vite 开发代理 | `/api` → `http://localhost:8000`，生产环境用 `VITE_API_BASE` 直连 |
| 5 | 预测权重归一化 | 前端滑块值 0-100，发送前除以总和归一化，避免 NaN |
| 6 | TDengine 子表命名 | `t_{device_id}`，设备 ID 需去除单引号防注入 |
| 7 | Docker build 前端 | `VITE_API_BASE=http://localhost:8000` 写在 Dockerfile ENV 中 |
| 8 | 数据源种子 host 不能硬编码 `localhost` | Docker 容器间网络用服务名 `tdengine`，须用 `settings.TDENGINE_HOST` 动态读取 |
| 9 | `/health` 与数据源页面状态不一致 | 启动 lifespan 中主动探测 TDengine 并同步数据源记录状态 |
| 10 | 前端状态标签英文不友好 | 统一在 `types/index.ts` 中定义中文标签常量，所有页面引用 |
| 11 | Docker build 上下文过大 | 必须创建 `.dockerignore` 排除 `node_modules`、`__pycache__`、`.git` 等 |
| 12 | 治理页模板"套用"按钮无实际效果 | 通过 App.tsx 共享 `predictionConfig` 状态，套用时转换参数并跳转预测页 |
| 13 | 治理页新建模板总是写死默认值 | GovernancePage 接收 `currentConfig` props，保存模板时使用当前实际配置 |
| 14 | Dashboard KPI 平均风险分硬编码 0.35 | 新增 `GET /predictions/stats` 端点，前端动态获取 |

---

## 十二、默认账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | `admin` | `Admin@123` |

---

## 十三、快速启动步骤

```bash
# 1. 复制环境变量
cp .env.example .env         # Linux/Mac
# Copy-Item .env.example .env  # Windows PowerShell

# 2. 一键启动
docker compose up --build -d

# 3. 等待 TDengine 健康检查通过（约 15-30 秒）
docker compose logs -f

# 4. 访问
# 前端: http://localhost:5173
# 后端 Swagger: http://localhost:8000/docs
# TDengine REST: http://localhost:6041
```

---

## 十四、复刻执行建议（给其他 AI 的指令）

如果使用其他 AI Agent 从零复刻此项目，建议按以下顺序执行：

1. **后端骨架**：创建 FastAPI 项目结构、配置、安全模块
2. **数据模型**：定义所有 Pydantic 模型（**含 AlgorithmParams 算法参数模型**）和内存 store（数据源种子须从 settings 读取 host/port）
3. **认证路由**：实现登录 + JWT + RBAC 依赖
4. **业务路由**：devices → alerts → rules → predictions（**含 algo_params 字段传递 + /stats 端点**） → governance
5. **预测服务**：四个算法函数接收 params dict 参数驱动 + 加权融合
6. **TDengine 服务**：init_database + ingest + query
6. **通知服务**：HMAC 签名 + 重试机制
7. **数据源路由**：CRUD + 连接测试
8. **健康检查**：GET /health
9. **启动自检**：lifespan 中探测 TDengine 并同步数据源状态
10. **Docker 配置**：后端 Dockerfile + .dockerignore + docker-compose.yml
11. **前端骨架**：Vite + React + TypeScript + router 配置
12. **API 层**：axios 实例 + 拦截器
13. **类型定义**：TypeScript interface（对齐后端模型，**含 AlgorithmParams、PredictionConfig**）+ 统一中文标签常量
14. **主题系统**：ThemeContext + styles.css (暗/亮双主题)
15. **主框架 Shell**：Sider + Header + StatusBar + Footer + Drawers + **共享 predictionConfig 状态**
16. **6 个路由页面**：逐一实现（所有状态/等级标签引用统一常量，**预测页含 algo_params 面板**，**治理页模板套用联动**，**Dashboard KPI 动态获取**）
17. **快捷导航**：CommandPalette 组件
18. **前端 Docker**：多阶段构建 + .dockerignore + Nginx
19. **联调测试**：`docker compose up --build` 验收

---

## 十五、验收标准

### 功能验收
- [ ] 登录后可进入 6 个路由页面并正常切换
- [ ] 预测链路跑通（配置 → 运行 → 结果 → 图表 → 评估记录更新）
- [ ] **预测中心展开"算法参数配置"面板，修改参数后预测结果受影响**
- [ ] **"恢复默认"按钮正确重置所有算法参数**
- [ ] 规则 CRUD + 启停切换正常
- [ ] **模板"保存当前配置为模板"使用当前预测页的实际配置（含 algo_params）**
- [ ] **模板"套用"后自动跳转预测中心并加载完整配置**
- [ ] **模板表格展开行可查看各算法参数详情**
- [ ] 模板导出 JSON 包含 algo_params 字段，导入后可用
- [ ] **Dashboard "平均风险分"和"最近预测"在运行预测后动态更新（非占位符）**
- [ ] 通知页与顶部通知中心数据一致
- [ ] 设备/告警/通知抽屉可展开查看明细
- [ ] 数据源连接测试可用
- [ ] `Ctrl+K` 快捷导航正常

### 状态一致性验收
- [ ] `GET /health` 返回 `{ service: "ok", tdengine: "ok" }`
- [ ] 数据源页面 TDengine 状态与 `/health` 端点一致（均为 ok / 均为 error）
- [ ] 状态栏平台服务与 TDengine 均使用"正常/异常"用词
- [ ] 页脚运行状态同时检查 service 和 tdengine 双状态
- [ ] 设备抽屉显示中文状态（在线/离线/告警/故障）
- [ ] 告警抽屉 & 仪表盘告警表格显示中文等级（低/中/高/危急）
- [ ] 通知抽屉 & 通知页面显示中文状态（待发送/成功/失败）
- [ ] 预测中心风险等级显示中文标签

### 工程验收
- [ ] `npm run build` 成功
- [ ] `docker compose up --build` 三服务均正常启动
- [ ] `GET /health` 返回 `{ service: "ok", tdengine: "ok" }`

### UI 验收
- [ ] 暗色主题下所有文字、表格、弹窗、下拉框均可读
- [ ] 亮色主题切换正常
- [ ] 图表标签不重叠
- [ ] 移动端（≤760px）导航和布局可用

---

## 十六、本次使用的 AI Agent 信息

| 项目 | 值 |
|------|-----|
| **Agent 入口** | VS Code Copilot Chat（Agent 模式） |
| **底层模型** | Claude Opus 4.6 (Anthropic) |
| **调用方式** | GitHub Copilot 代理，在 VS Code 中对话式开发 |
| **工作能力** | 文件创建/编辑、终端命令执行、语义搜索、多文件并行读取、错误诊断 |
| **对话轮次** | 多轮迭代（骨架搭建 → 逐模块实现 → Bug 修复 → 视觉优化） |
| **总文件数** | ~35 个源文件 |
