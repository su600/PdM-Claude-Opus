# PdM 智能运维平台

工业设备预测性维护平台，覆盖机加、复材铺丝、激光焊接、检验监测等场景。

当前工程为可运行版本
## 1. 技术栈

### 后端


### 前端


### 基础设施
- Docker Compose
- TDengine 3.x

## 2. 主要能力

- 登录认证与角色权限控制
- 设备管理、告警管理、规则中心
- **多算法预测（参数可配置）与阈值治理**
- **算法内部参数配置**（每个算法的均值、标准差、置信度范围等均可调节）
- 算法模板管理（保存当前配置、套用、导入、导出）
- **模板套用功能打通**（套用后自动加载配置到预测中心）
- 治理审计日志
- 通知事件推送与失败重试
- TDengine 遥测数据采集与趋势查询
- **Dashboard KPI 动态计算**（平均风险分、预测次数从真实数据获取）
- 系统健康状态显示（平台服务 + TDengine）

## 3. 前端页面与交互

### 路由页面
- /dashboard 运行总览（KPI 动态计算）
- /prediction 预测中心（含高级算法参数配置面板）
- /rules 规则中心
- /governance 算法治理（模板创建使用当前配置、套用跳转预测页、展开行查看参数详情）
- /notifications 通知中心
- /datasources 数据源配置

### 交互增强
- 顶部设备与高风险告警快捷标签（可展开明细抽屉）
- 顶部通知中心抽屉（未处理计数、最近事件、快速重试）
- 全局快捷导航（Ctrl + K）
- 路由切页过渡动画
- 深色企业主题与移动端自适应
- 预测页可折叠"算法参数配置"面板，支持恢复默认

## 4. 目录结构

~~~text
PdM/
├─ backend/
│  ├─ app/
│  │  ├─ routers/                # 业务接口
│  │  ├─ services/               # 预测、TDengine、通知等服务
│  │  ├─ db/                     # 模型与数据库访问
│  │  └─ core/                   # 配置与基础能力
│  └─ requirements.txt
├─ frontend/
│  ├─ src/
│  │  ├─ pages/                  # 路由页面
│  │  ├─ components/             # 公共组件
│  │  ├─ types/                  # 领域类型
│  │  ├─ App.tsx
│  │  └─ styles.css
│  └─ package.json
├─ docs/
│  ├─ notification-contract.md
│  └─ replication-requirements.md
├─ docker-compose.yml
├─ .env.example
└─ README.md
~~~

## 5. 快速启动（推荐）

### 前置条件
- Docker Desktop（或可用的 Docker Engine + Compose）

### 步骤
1. 复制环境文件

~~~bash
cp .env.example .env
~~~

Windows PowerShell 可用：

~~~powershell
Copy-Item .env.example .env
~~~

2. 启动服务

~~~bash
docker compose up --build -d
~~~

3. 访问地址
- 前端: http://localhost:5173
- 后端 Swagger: http://localhost:8000/docs

## 6. 本地开发（不使用 Docker）

### 后端

~~~bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
~~~

### 前端

~~~bash
cd frontend
npm install
npm run dev
~~~

## 7. 默认账号

- 用户名: admin
- 密码: Admin@123

说明：服务启动时会自动种子初始化默认管理员、样例设备、样例规则、样例算法模板和部分演示告警数据。

## 8. 环境变量说明

请参考 .env.example，关键变量如下：

- JWT_SECRET
- ACCESS_TOKEN_EXPIRE_MINUTES
- CORS_ORIGINS
- PY_ENV
- TDENGINE_HOST
- TDENGINE_PORT
- TDENGINE_USER
- TDENGINE_PASSWORD
- TDENGINE_DATABASE
- DEFAULT_WEBHOOK_URL
- WEBHOOK_SIGNING_SECRET

安全建议：
- 生产环境必须设置强随机 JWT_SECRET 与 WEBHOOK_SIGNING_SECRET。
- 生产环境建议设置 PY_ENV=prod。

## 9. TDengine 说明（重要）

- 后端通过 REST SQL 访问 TDengine（端口 6041），不依赖本地 taos 动态库。
- Compose 健康检查必须可访问：

~~~text
http://localhost:6041/rest/login/root/taosdata
~~~

## 10. 核心 API 列表

### 认证与用户
- POST /auth/token
- GET /users/me
- GET /users
- POST /users

### 设备与告警
- GET /devices
- POST /devices
- GET /alerts
- POST /alerts

### 预测与治理
- POST /predictions/infer（支持 algo_params 算法参数配置）
- GET /predictions/stats（预测统计：次数 + 平均风险分）
- GET /algo-governance/templates
- POST /algo-governance/templates
- PUT /algo-governance/templates/{template_id}
- DELETE /algo-governance/templates/{template_id}
- GET /algo-governance/templates/export
- POST /algo-governance/templates/import
- POST /algo-governance/evaluations
- GET /algo-governance/evaluations
- GET /algo-governance/audit-logs

### 遥测与规则
- POST /telemetry/ingest
- GET /telemetry/{device_id}
- GET /rules
- POST /rules
- POST /rules/{rule_id}/toggle

### 通知与健康
- POST /notifications/push
- GET /notifications/events
- POST /notifications/retry-failed
- GET /health

## 11. 通知签名与回调协议

通知外推协议见：docs/notification-contract.md

## 12. 复刻说明文档

完整复刻需求总文档见：docs/replication-requirements.md

该文档适合直接提供给其他 AI 进行同构重建。

## 13. 常见问题

### Q1：前端启动了但请求后端失败
- 检查 backend 容器是否正常。
- 检查浏览器网络请求目标是否为 http://localhost:8000。

### Q2：backend 启动慢或 TDengine 报错
- 先确认 tdengine 容器健康状态。
- 确认 TDengine 健康检查 URL 使用 /rest/login/root/taosdata。

### Q3：登录失败
- 使用默认账号 admin / Admin@123。
- 确认数据库卷未损坏；必要时清理容器与卷后重建。

## 14. 验收建议

1. 启动后可访问前端与 /docs。
2. 使用默认账号登录成功。
3. 6 个路由页面可正常切换。
4. 运行预测可返回结果并在治理日志中看到记录。
5. 预测中心展开"算法参数配置"，修改参数后运行预测，确认结果受参数影响。
6. 算法治理页"保存当前配置为模板"保存的是实际配置（非默认值）。
7. 模板"套用"后自动跳转预测页并加载模板配置。
8. 模板导出 JSON 包含 algo_params 字段，导入后可用。
9. Dashboard "平均风险分"和"最近预测"在运行预测后动态更新。
10. 通知中心可查看事件并重试失败消息。
11. 顶部状态栏可反映 /health 状态。
