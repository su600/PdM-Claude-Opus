# PdM 智能运维平台 — 完整复刻文档

> **生成时间**：2026-04-01（最近更新）
> **使用 Agent 模型**：Claude Sonnet 4.6 / Claude Code（VS Code）
> **工作方式**：通过 Claude Code 以多轮对话方式，逐步构建并迭代整个项目。Agent 直接在编辑器中创建/编辑文件、运行终端命令、调试错误、自动修复。
> **项目定位**：工业设备预测性维护（Predictive Maintenance）平台，覆盖机加、复材铺丝、激光焊接、检验监测等场景。
> **核心功能**：多算法预测（基于真实运行数据）+ 完整设备台账 + 维保记录 + SQLite 全持久化 + 系统管理页面。

注：UI 设计经历了"用力过猛又简化回来"的循环，最终版以简洁实用为主，微动效不过度。-Su

---

## 一、技术栈总览

| 层级 | 技术 | 版本 |
|------|------|------|
| **后端框架** | Python + FastAPI | Python 3.11 / FastAPI 0.115.x |
| **认证** | python-jose (JWT HS256) + bcrypt | python-jose 3.x / bcrypt ≥4.0 |
| **业务数据库** | SQLite（`sqlite3` 标准库，WAL 模式） | 内置，无需额外安装 |
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
PdM-Claude-Opus/
├── docker-compose.yml              # 三服务编排（含 pdm_data volume）
├── .env.example                    # 环境变量模板
├── README.md
├── project-summary-by-opus46.md   # 本文档
│
├── backend/
│   ├── Dockerfile                  # Python 3.11-slim
│   ├── .dockerignore
│   ├── requirements.txt            # 9 个依赖（无 SQLite 额外依赖）
│   └── app/
│       ├── main.py                 # FastAPI 入口 + Lifespan + SQLite 初始化 + 种子数据
│       ├── core/
│       │   ├── config.py           # pydantic-settings 配置
│       │   └── security.py         # JWT 签发/验证 + bcrypt 密码哈希
│       ├── db/
│       │   ├── database.py         # SQLite 连接管理 + WAL + DDL（12 张表）
│       │   ├── models.py           # 全部 Pydantic 模型（25+ 个）
│       │   └── store.py            # SQLite CRUD 函数集（替代原内存字典）
│       ├── routers/
│       │   ├── auth.py             # 登录 + JWT 依赖 + RBAC
│       │   ├── users.py            # 用户管理
│       │   ├── devices.py          # 设备管理（10 个端点，含维保/告警/预测）
│       │   ├── alerts.py           # 告警管理
│       │   ├── rules.py            # 规则中心
│       │   ├── predictions.py      # 预测接口 + 算法列表 + 源码查看
│       │   ├── governance.py       # 算法治理（模板/评估/审计）
│       │   ├── datasources.py      # 数据源 CRUD + 连接测试
│       │   ├── telemetry.py        # 运行数据采集与查询
│       │   ├── notifications.py    # 通知推送 + 重试
│       │   ├── system.py           # 系统信息 + 系统设置
│       │   └── health.py           # 健康检查
│       └── services/
│           ├── prediction_svc.py   # 多算法加权融合（基于真实运行数据）
│           ├── tdengine_svc.py     # TDengine REST SQL 封装
│           ├── notification_svc.py # Webhook HMAC 签名 + 重试
│           └── algorithms/
│               ├── base.py         # 公共工具函数（clamp、telemetry_to_matrix 等）
│               ├── rule_based.py   # 阈值评估 + 告警历史衰减计分
│               ├── statistical.py  # Z-score 异常检测 + OLS 趋势分析
│               ├── isolation_forest.py  # 隔离森林异常检测（纯 numpy 实现）
│               └── time_series.py  # Holt 双指数平滑时序预测
│
├── frontend/
│   ├── Dockerfile                  # 二阶段构建（Node build → Nginx）
│   ├── .dockerignore
│   ├── nginx.conf                  # SPA fallback + 静态缓存
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts              # 代理 /api → backend:8000
│   ├── index.html
│   └── src/
│       ├── main.tsx                # React 入口（HashRouter + ThemeProvider）
│       ├── App.tsx                 # 主框架 Shell + 路由 + 状态 + 抽屉
│       ├── api.ts                  # axios 实例 + 拦截器
│       ├── styles.css              # 全局主题变量 + Ant Design 覆盖
│       ├── ThemeContext.tsx         # 亮/暗主题切换
│       ├── components/
│       │   └── CommandPalette.tsx  # Ctrl+K 全局快捷导航
│       ├── pages/
│       │   ├── LoginPage.tsx       # 品牌化登录（粒子动效 + 渐入动画）
│       │   ├── DashboardPage.tsx   # 运行总览（KPI 动态计算 + 运行趋势）
│       │   ├── DeviceManagementPage.tsx  # 设备台账管理（新建/编辑/删除）
│       │   ├── DeviceDetailPage.tsx      # 设备详情（5 Tab 聚合视图）
│       │   ├── PredictionPage.tsx   # 预测中心（含算法参数配置面板）
│       │   ├── RulesPage.tsx        # 规则中心
│       │   ├── GovernancePage.tsx   # 算法治理（模板/评估/审计）
│       │   ├── NotificationsPage.tsx    # 通知中心
│       │   ├── DataSourcePage.tsx   # 数据源配置
│       │   └── SystemManagementPage.tsx  # 系统管理（版本/TDengine/通知配置）
│       └── types/
│           └── index.ts            # TypeScript 领域类型 + 统一中文标签常量
│
└── docs/
    └── notification-contract.md   # 通知推送协议文档
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
    volumes:
      - pdm_data:/app/data    # ⚠️ SQLite 持久化挂载点
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
  pdm_data:       # ← 业务数据库持久化 volume
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

### 4.2 设备与维保

| 方法 | 路径 | 描述 |
|------|------|------|
| `GET` | `/devices` | 设备列表（含扩展台账字段） |
| `POST` | `/devices` | 创建设备 |
| `GET` | `/devices/{id}` | 单设备详情 |
| `PUT` | `/devices/{id}` | 更新设备信息 |
| `DELETE` | `/devices/{id}` | 删除设备（级联删除维保记录） |
| `GET` | `/devices/{id}/maintenance` | 该设备维保记录列表 |
| `POST` | `/devices/{id}/maintenance` | 新增维保记录 |
| `DELETE` | `/devices/{id}/maintenance/{record_id}` | 删除维保记录 |
| `GET` | `/devices/{id}/alerts` | 该设备告警历史 |
| `GET` | `/devices/{id}/predictions` | 该设备预测历史 |

### 4.3 告警与规则

| 方法 | 路径 | 描述 |
|------|------|------|
| `GET` | `/alerts` | 告警列表 |
| `POST` | `/alerts` | 创建告警 |
| `GET` | `/rules` | 规则列表 |
| `POST` | `/rules` | 创建规则 |
| `POST` | `/rules/{rule_id}/toggle` | 启停切换 |

### 4.4 预测

| 方法 | 路径 | 描述 |
|------|------|------|
| `POST` | `/predictions/infer` | 运行预测（多算法加权融合 + 自定义参数） |
| `GET` | `/predictions/stats` | 预测统计（总次数 + 平均风险分，单 SQL） |
| `GET` | `/predictions/algorithms` | 算法描述列表（名称/文件/说明） |
| `GET` | `/predictions/algorithms/{algo_key}/source` | 查看算法源码（PlainText） |

`/predictions/infer` 请求体中 `algo_params` 字段（可选）：
```json
{
  "algo_params": {
    "rule_based": {
      "temp_threshold": 85, "vibration_threshold": 12,
      "pressure_low": 1.5, "rpm_threshold": 5000,
      "alert_decay": 0.3, "base_rul": 500
    },
    "statistical": { "zscore_threshold": 2.0, "trend_weight": 0.3 },
    "ml": { "contamination": 0.1 },
    "deep_learning": { "alpha": 0.3, "beta": 0.1, "forecast_steps": 5 }
  }
}
```

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

### 4.6 运行数据（TDengine）

| 方法 | 路径 | 描述 |
|------|------|------|
| `POST` | `/telemetry/ingest` | 写入运行数据点（→ TDengine） |
| `GET` | `/telemetry/{device_id}` | 查询设备运行数据 |

### 4.7 通知

| 方法 | 路径 | 描述 |
|------|------|------|
| `POST` | `/notifications/push` | 推送通知（HMAC 签名 + 自动重试） |
| `GET` | `/notifications/events` | 事件列表（最新优先） |
| `POST` | `/notifications/retry-failed` | 手动重试失败事件 |

### 4.8 系统管理

| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| `GET` | `/system/info` | 系统信息（版本/TDengine 状态/服务器时间） | 已登录 |
| `GET` | `/system/settings` | 系统设置（Webhook URL/重试次数） | 已登录 |
| `PUT` | `/system/settings` | 更新系统设置 | admin |

### 4.9 数据源

| 方法 | 路径 | 描述 |
|------|------|------|
| `GET` | `/datasources` | 数据源列表（密码脱敏） |
| `GET` | `/datasources/{id}` | 单个数据源 |
| `POST` | `/datasources` | 创建数据源 |
| `PUT` | `/datasources/{id}` | 更新数据源 |
| `DELETE` | `/datasources/{id}` | 删除数据源 |
| `POST` | `/datasources/{id}/test` | 测试已有数据源 |
| `POST` | `/datasources/test-new` | 测试新配置（不保存） |

### 4.10 健康检查

| 方法 | 路径 | 描述 |
|------|------|------|
| `GET` | `/health` | 返回 `{ service: "ok", tdengine: "ok"|"error" }` |

---

## 五、后端核心实现细节

### 5.1 配置 (config.py)
- 使用 `pydantic-settings` 的 `BaseSettings`，支持 `.env` 文件加载
- CORS 允许 `localhost:5173/5174/5175`

### 5.2 认证与安全 (security.py)
- 密码哈希：直接使用 `bcrypt` 库（**不用 passlib**，因为 passlib 与 bcrypt 5.x 不兼容）
- JWT：`python-jose` HS256，默认 8 小时过期
- 依赖注入：`get_current_user` → `require_roles("admin")` 工厂函数

### 5.3 数据库层 (database.py)

SQLite，WAL 模式，存储位置：`/app/data/pdm.db`（挂载到 `pdm_data` Named Volume）。

12 张表：`users`, `devices`, `alerts`, `rules`, `predictions`, `templates`, `evaluations`,
`audit_logs`, `notification_events`, `datasources`, `maintenance_records`, `system_settings`

`tx()` 上下文管理器：每次创建新连接，提交/回滚后关闭，天然并发安全：
```python
@contextmanager
def tx():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
```

注意列名规避 SQL 关键字：
- `rules` 表使用 `condition_expr`（替代 `condition`），读取时由 `_rule_row()` 重命名
- `datasources` 表使用 `database_name`（替代 `database`），读写时由辅助函数映射

### 5.4 数据存储 (store.py)
原内存字典/列表全部**替换为 SQLite CRUD 函数**，主要函数：

**设备：** `get_all_devices()`, `get_device(id)`, `create_device(data)`, `update_device(id, updates)`, `delete_device(id)`（级联删除 maintenance_records）

**维保：** `get_maintenance_for_device(device_id)`, `create_maintenance_record(data)`, `get_maintenance_record(id)`, `delete_maintenance_record(id)`

**告警：** `get_all_alerts()`, `get_alerts_for_device(device_id)`, `create_alert(data)`

**预测：** `get_predictions_for_device(device_id)`, `append_prediction(data)`（事务内 trim 至 200 条）, `prediction_stats()`（单 SQL 返回 count + avg）

**模板/治理：** `get_all_templates()`, `create_template(data)`, `update_template(id, updates)`, `delete_template(id)`; `get_all_evaluations()`, `create_evaluation(data)`; `append_audit_log(data)`

**通知：** `get_all_notification_events()`, `create_notification_event(data)`, `update_notification_event(id, updates)`, `get_failed_notification_events()`

**系统：** `get_system_settings()`, `update_system_settings(updates)`

**种子数据：** `is_empty()`（检查 users 表行数） + `seed()`（6 台设备含完整台账、15 条维保记录、4 条告警、4 条规则、1 个模板、1 个数据源、系统默认设置）

### 5.5 数据模型 (models.py)

**设备相关（扩展）：**
- `DeviceCreate` / `DeviceOut`：新增 `model`, `manufacturer`, `manufacture_year`, `serial_number`, `description`, `datasource_tag`
- `DeviceUpdate`：所有字段可选，用于 PATCH 语义的 PUT 操作
- `MaintenanceType` 枚举：preventive / corrective / predictive / inspection
- `MaintenanceRecordCreate` / `MaintenanceRecordOut`

**系统：**
- `SystemInfo`：版本、构建日期、TDengine 连接信息、通知配置、服务器时间

**预测：**
- `AlgorithmParams`：四种算法各自的可配置内部参数字典
- `PredictionRequest`：含可选 `algo_params: AlgorithmParams`
- `AlgorithmOutput`：algorithm, risk_score, rul_hours, confidence, details

### 5.6 应用启动自检 (main.py lifespan)
1. `create_tables()` — 建表（幂等，IF NOT EXISTS）
2. `store.is_empty()` → `store.seed()` — 首次运行播种数据
3. `init_database()` — 初始化 TDengine 数据库与超级表
4. `check_health()` — 探测 TDengine 连接
5. 遍历 tdengine 类型数据源，同步 `status` 字段，确保页面与 /health 一致

### 5.7 预测算法（真实运行数据驱动）

四种算法均接收 `telemetry: list[dict]` 真实运行数据，函数签名 `run(device_id, telemetry, params) -> AlgorithmOutput`：

1. **规则引擎** (`rule_based.py`)：取最近 10 条数据平均，计算各指标对阈值的超限比例；叠加历史告警指数衰减评分；直接使用 `store.get_alerts_for_device(device_id)` 查询 SQLite。

2. **统计分析** (`statistical.py`)：Z-score 异常检测；可选最小二乘趋势推断；无数据则返回 NO_DATA 默认值。

3. **隔离森林** (`isolation_forest.py`)：纯 numpy 实现，无 sklearn 依赖；随机超平面切分计算异常分数。

4. **Holt 双指数平滑** (`time_series.py`)：level + trend 分解外推，预测未来数个时间步趋势，估算 RUL。

融合逻辑（prediction_svc.py）：
- 查询 TDengine 最近 500 条运行数据（`query_telemetry`）；无数据时各算法返回 NO_DATA 默认输出（不报错）
- 按配置权重加权，归一化后计算 risk_score / rul_hours / confidence
- 基于阈值判定 risk_level，生成中文建议
- 事务内写入 SQLite 并 trim 至 200 条

### 5.8 TDengine 服务 (tdengine_svc.py)
- REST SQL（端口 6041），Base64 Basic Auth
- `init_database()`：创建 pdm 数据库 + 超级表 `telemetry`
- 超级表结构：`ts TIMESTAMP, temperature FLOAT, vibration FLOAT, pressure FLOAT, rpm FLOAT, TAGS(device_id BINARY(64))`
- 子表自动创建：`t_{device_id}`（设备 ID 需清理特殊字符防注入）

### 5.9 通知服务 (notification_svc.py)
- HMAC-SHA256 签名：Header `X-PdM-Signature` + `X-PdM-Timestamp`
- 超时 4 秒，最多 4 次尝试（重试间隔 1s / 2s / 3s）
- 每次状态变更通过 `store.update_notification_event()` 持久化到 SQLite

---

## 六、前端完整实现细节

### 6.1 入口与路由 (main.tsx + App.tsx)
- `HashRouter` + `ThemeProvider` + `App`
- 未登录 → `LoginPage`；已登录 → `AppShell`（Sider + Header + Routes）
- 路由配置：
  - `/dashboard` — 运行总览
  - `/devices` — 设备管理列表
  - `/devices/:id` — 设备详情
  - `/prediction` — 预测中心
  - `/rules` — 规则中心
  - `/governance` — 算法治理
  - `/notifications` — 通知中心
  - `/datasources` — 数据源配置
  - `/system` — 系统管理
  - `*` → `/dashboard`

### 6.2 主框架 Shell (App.tsx)
- **侧边栏**：桌面端可折叠 Sider + 移动端 Drawer
- **顶部栏**：设备 Tag、高风险告警 Tag、主题切换、快捷导航、通知 Badge、用户头像、退出
- **共享状态**：`predictionConfig`（algorithms, weights, thresholds, algoParams）+ 模板套用联动
- **状态栏**：平台服务状态、TDengine 状态（正常/异常）、当前角色、最近同步时间
- **定时轮询**：每 30 秒刷新 users/me、devices、alerts、health、notifications

### 6.3 登录页 (LoginPage.tsx)
- 品牌化深色登录卡片，渐变 Logo
- `login-particles` 浮动背景粒子元素
- `login-fadein-up` 渐入上升动画（各元素错开延迟）
- `login-feature-icon` 颜色差异化特性图标
- 默认填充 `admin / Admin@123`

### 6.4 运行总览 (DashboardPage.tsx)
- 4 个 KPI 卡片：在线设备、高风险告警、**平均风险分（动态）**、**最近预测次数（动态）**
- 运行趋势图（ECharts 折线图：温度/振动/压力）+ dataZoom 滑动条（无数据时演示曲线）
- 最新告警表格（等级 Tag 分色，中文标签）

### 6.5 设备管理页 (DeviceManagementPage.tsx)
- 可搜索/过滤的设备表格（状态、名称、类型、型号、厂家、位置）
- 点击设备名跳转到 `/devices/:id` 详情页
- 新建/编辑 Modal（含型号/厂家/年份/序列号/描述/数据源标签等全字段）
- 删除操作 Popconfirm 确认

### 6.6 设备详情页 (DeviceDetailPage.tsx)
- `useParams()` 获取 id，返回按钮回到列表
- **5 个 Tab**：
  1. **基本信息** — Descriptions 展示全部台账字段 + 内联编辑
  2. **维保记录** — 维保表格（类型/日期/操作人/费用）+ 新建/删除
  3. **告警历史** — 该设备告警列表（等级/消息/时间）
  4. **预测历史** — 该设备预测记录 + 风险趋势折线图
  5. **运行数据** — ECharts 四指标曲线（温度/振动/压力/RPM）+ 数据量选择 + 刷新

### 6.7 预测中心 (PredictionPage.tsx)
- 左侧：设备选择、算法开关 + 权重 Slider、风险阈值 Slider、可折叠算法参数配置面板
- 右侧：风险分/RUL/置信度大数字、风险等级 Tag + 建议、算法贡献饼图、风险趋势折线图
- 每次预测自动提交治理评估记录

### 6.8 规则中心 (RulesPage.tsx)
- 规则列表（名称/设备类型/指标/条件/等级/启停）
- 新建规则 Modal + 启停切换

### 6.9 算法治理 (GovernancePage.tsx)
- 3 个 Tab：模板管理（含套用/导入/导出/展开参数详情）、评估记录、审计日志
- 模板保存使用当前预测页实际配置（通过 App.tsx 共享状态）

### 6.10 通知中心 (NotificationsPage.tsx)
- 事件表格（等级/状态/重试次数/目标地址/错误）
- 重试失败事件按钮

### 6.11 数据源配置 (DataSourcePage.tsx)
- 数据源列表 + 新建/编辑 Modal + 测试连接

### 6.12 系统管理页 (SystemManagementPage.tsx)
- **系统概览** — 版本号、构建日期、服务器实时时钟、后端地址
- **时序数据库** — TDengine host/port/database/连接状态
- **通知配置** — Webhook URL、最大重试次数（admin 可编辑保存）

### 6.13 快捷导航 (CommandPalette.tsx)
- `Ctrl+K` 呼出，搜索 + 键盘导航 + 回车跳转 + ESC 关闭

### 6.14 主题系统 (ThemeContext.tsx)
- 亮/暗双主题，默认暗色，`localStorage` 持久化
- Ant Design `ConfigProvider` + `darkAlgorithm` / `defaultAlgorithm`
- `data-theme` 挂载到 HTML 根元素供 CSS 变量切换

### 6.15 API 层 (api.ts)
- axios 实例，baseURL 从 `VITE_API_BASE` 读取
- 请求拦截器：自动注入 Bearer token；响应拦截器：401 清 token 跳转登录

---

## 七、样式与视觉规范 (styles.css)

### 7.1 CSS 变量体系
- 两套完整配色：dark（默认）和 light，30+ 个 CSS 变量
- Logo 淡发光动画（`logo-pulse`，低强度，不过度）

### 7.2 视觉特征
- **背景**：多层径向渐变光斑（蓝/青/紫）
- **卡片**：12px 圆角、hover 上浮 2px、边框微发光
- **KPI 卡片**：顶部 3px 渐变色条（success/warning/danger）
- **登录页**：粒子动效浮动背景 + 各元素错开渐入上升动画 + 颜色差异化特性图标
- **状态点**：ok 绿色发光 / error 红色发光
- **页面切换**：opacity + translateY 过渡动画

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

注：SQLite 使用 Python 标准库 `sqlite3`，不需要额外依赖。

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
| 4 | Vite 开发代理 | `/api` → `http://localhost:8000`，生产用 `VITE_API_BASE` 直连 |
| 5 | 预测权重归一化 | 前端 Slider 值 0-100，发送前除以总和归一化 |
| 6 | TDengine 子表命名 | `t_{device_id}`，设备 ID 清理特殊字符防注入 |
| 7 | Docker build 前端 | `VITE_API_BASE=http://localhost:8000` 写在 Dockerfile ENV 中 |
| 8 | 数据源种子 host 不能硬编码 `localhost` | Docker 容器间用服务名 `tdengine`，须用 `settings.TDENGINE_HOST` 动态读取 |
| 9 | `/health` 与数据源页面状态一致性 | 启动 lifespan 中主动探测 TDengine 并同步数据源 status 字段 |
| 10 | 前端标签英文 | 统一在 `types/index.ts` 中定义中文标签常量，所有页面引用 |
| 11 | Docker build 上下文过大 | 必须创建 `.dockerignore` 排除 `node_modules`、`__pycache__`、`.git` |
| 12 | 治理页模板套用无实际效果 | 通过 App.tsx 共享 `predictionConfig`，套用时转换参数并跳转 |
| 13 | 治理页模板保存写死默认值 | GovernancePage 接收 `currentConfig` props，使用当前实际配置 |
| 14 | Dashboard KPI 硬编码 | 新增 `GET /predictions/stats`，单 SQL 返回 count + avg |
| 15 | SQLite `condition` 是关键字 | `rules` 表列名用 `condition_expr`，读取时 `_rule_row()` 重命名 |
| 16 | SQLite `database` 是关键字 | `datasources` 表列名用 `database_name`，辅助函数双向映射 |
| 17 | SQLite 并发写 | `tx()` 每次新建连接 + WAL 模式，避免多协程共享连接问题 |
| 18 | SQLite volume 丢失 | `docker compose down -v` 会删除 volume，重置数据；正常重启用 `docker compose restart` |
| 19 | 术语"遥测"不适合工业 PdM | UI 文本全部改为"运行数据/运行趋势"；API 路由 `/telemetry` 作为内部标识保持不变 |

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

# 重置数据（清空并重播种）
docker compose down -v && docker compose up -d
```

---

## 十四、复刻执行建议（给其他 AI 的指令）

按以下顺序执行：

1. **后端骨架**：FastAPI 项目结构、配置、安全模块
2. **数据库层**：`database.py`（SQLite DDL + `tx()` 管理器，12 张表，WAL 模式）
3. **数据模型**：Pydantic 模型（含 AlgorithmParams、DeviceUpdate、MaintenanceRecord、SystemInfo）
4. **CRUD 层**：`store.py`（全部 SQLite CRUD 函数 + seed()）
5. **认证路由**：登录 + JWT + RBAC
6. **业务路由**：devices（含 10 个端点）→ alerts → rules → predictions → governance → system
7. **算法服务**：4 个算法函数，接收真实 telemetry 数据，可配置参数
8. **TDengine 服务**：init_database + ingest + query_telemetry
9. **通知服务**：HMAC 签名 + 重试 + SQLite 状态跟踪
10. **main.py lifespan**：建表 → 播种 → TDengine 初始化 → 健康探测 → 数据源同步
11. **Docker 配置**：backend Dockerfile + pdm_data volume
12. **前端骨架**：Vite + React + TypeScript + HashRouter
13. **类型定义**：TypeScript interface（对齐后端模型）+ 中文标签常量
14. **主题系统**：ThemeContext + styles.css（亮/暗）
15. **主框架 Shell**：Sider + Header + 共享 predictionConfig 状态
16. **10 个路由页面**：Dashboard → DeviceManagement → DeviceDetail → Prediction → Rules → Governance → Notifications → DataSource → System（Login 最后）
17. **前端 Docker**：多阶段构建 + Nginx
18. **联调测试**：`docker compose up --build` 验收

---

## 十五、验收标准

### 功能验收
- [ ] 登录后可进入 9 个路由页面并正常切换
- [ ] 设备管理页显示 6 台完整台账信息，可新建/编辑/删除
- [ ] 设备详情页 5 个 Tab 均正常加载（基本信息/维保/告警/预测/运行数据）
- [ ] 维保记录可新增/删除
- [ ] 预测链路跑通（配置 → 运行 → 结果 → 图表 → 评估记录更新）
- [ ] 预测中心展开"算法参数配置"面板，修改参数后预测结果受影响
- [ ] 模板保存使用当前预测页实际配置（含 algo_params）
- [ ] 模板套用后自动跳转预测中心并加载完整配置
- [ ] Dashboard"平均风险分"和"最近预测"在预测后动态更新
- [ ] 系统管理页显示版本信息和 TDengine 状态，通知 Webhook 可编辑

### 持久化验收
- [ ] `docker restart pdm-backend` 后登录仍成功
- [ ] 重启后设备列表、预测记录、告警、维保记录均保留
- [ ] `docker compose down && docker compose up -d`（不加 `-v`）数据保留
- [ ] 加 `-v` 清空后自动重播种，6 台设备 + 15 条维保记录出现

### 状态一致性验收
- [ ] `GET /health` 返回 `{ service: "ok", tdengine: "ok" }`
- [ ] 数据源页面与 /health 端点状态一致
- [ ] 状态栏、页脚、系统管理页 TDengine 状态用词一致（正常/异常）

### 工程验收
- [ ] `npm run build` 成功
- [ ] `docker compose up --build` 三服务均正常启动

---

## 十六、本次使用的 AI Agent 信息

| 项目 | 值 |
|------|-----|
| **Agent 入口** | Claude Code（VS Code 集成） |
| **底层模型** | Claude Sonnet 4.6 / Claude Opus 4.6（Anthropic） |
| **工作方式** | 多轮对话式开发，直接操作文件系统与终端 |
| **工作能力** | 文件创建/编辑、终端命令执行、语义搜索、多文件并行读取、错误诊断、数据库迁移 |
| **总源文件数** | ~42 个源文件 |
| **主要迭代** | 骨架搭建 → 逐模块实现 → 算法真实数据驱动 → SQLite 持久化迁移 → 设备台账扩展 → UI 美化 |
