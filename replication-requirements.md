# PdM Platform 复刻需求总文档 by codex5.3

> 目标：把当前项目完整复刻为“Python 后端 + React 前端 + TDengine + Docker Compose”的可运行系统，并还原主要页面、交互与视觉效果。

## 1. 项目定位
- 类型：工业设备预测性维护（PdM）平台。
- 业务场景：机加、复材铺丝、激光焊接、检验监测等设备状态监控与风险预测。
- 使用角色：`admin`、`engineer`、`supervisor`、`viewer`。

## 2. 固定技术路线（必须）
- 后端：Python + FastAPI。
- 前端：React + TypeScript + Vite + Ant Design + ECharts。
- 时序库：TDengine（通过 REST SQL 接口，不依赖本地 `libtaos`）。
- 容器编排：Docker Compose。

## 3. 架构与运行要求
### 3.1 服务编排
- `tdengine`：端口 `6030/6041`。
- `backend`：端口 `8000`，依赖 TDengine 健康。
- `frontend`：端口 `5173`，依赖 backend。

### 3.2 TDengine 健康检查（关键）
- 健康检查 URL 必须使用：`http://localhost:6041/rest/login/root/taosdata`。
- 不能使用 `/rest/login`（会导致 404，影响依赖启动）。

### 3.3 环境变量
- 必须支持：`JWT_SECRET`、`WEBHOOK_SIGNING_SECRET`、TDengine 连接配置（host/port/user/password/database）。
- 生产环境禁止弱默认密钥。

## 4. 后端功能需求（FastAPI）
### 4.1 认证与权限
- `POST /auth/token`：用户名密码登录，返回 JWT。
- `GET /users/me`：当前用户信息。
- RBAC 生效：不同角色对编辑操作受限。

### 4.2 用户与设备
- `GET /users`、`POST /users`。
- `GET /devices`、`POST /devices`。

### 4.3 告警与规则
- `GET /alerts`、`POST /alerts`。
- `GET /rules`、`POST /rules`、`POST /rules/{rule_id}/toggle`。

### 4.4 预测与治理
- `POST /predictions/infer`：返回 `risk_score`、`rul_hours`、`confidence`、`recommendation`、`algorithm_outputs`。
- `POST /algo-governance/evaluations`：保存评估。
- `GET /algo-governance/evaluations`。
- `GET /algo-governance/templates`、`POST /algo-governance/templates`、`PUT /algo-governance/templates/{id}`、`DELETE /algo-governance/templates/{id}`。
- `GET /algo-governance/templates/export`、`POST /algo-governance/templates/import`。
- `GET /algo-governance/audit-logs`。

### 4.5 遥测与通知
- `POST /telemetry/ingest`、`GET /telemetry/{device_id}`。
- `POST /notifications/push`、`GET /notifications/events`、`POST /notifications/retry-failed`。
- `GET /health`：返回 `{ service, tdengine }`，供前端状态栏轮询。

### 4.6 通知契约
- 外推通知采用 HTTP POST JSON。
- Header：`X-PdM-Signature`、`X-PdM-Timestamp`。
- 签名：HMAC-SHA256（基于原始 body）。
- 超时：4s；重试：3 次（1s/2s/3s 回退）。

## 5. 前端功能需求（React）
## 5.1 必须是多路由架构（不是单文件条件渲染）
- 路由页：
  - `/dashboard` 运行总览
  - `/prediction` 预测中心
  - `/rules` 规则中心
  - `/governance` 算法治理
  - `/notifications` 通知中心
- 路由兜底：`* -> /dashboard`。

### 5.2 登录页
- 品牌化登录卡片、Logo、版本信息、默认账号提示。
- 视觉需为企业级深色风格，非默认样式。

### 5.3 主框架（Shell）
- 左侧导航（桌面端）+ 抽屉导航（移动端）。
- 顶部栏：
  - 设备数 chip（可点开设备抽屉）
  - 高风险告警 chip（可点开告警抽屉）
  - 快捷导航按钮
  - 通知按钮（未处理计数）
  - 退出按钮
- 内容区顶部状态栏：平台服务、TDengine、当前角色、最近同步时间。
- 页脚：版本、环境、运行状态。

### 5.4 Dashboard（运行总览）
- KPI 卡片：在线设备、高风险告警、平均风险分、最近预测次数。
- 遥测趋势图。
- 最新告警列表（带分级 tag）。

### 5.5 Prediction（预测中心）
- 设备选择、阈值设置、运行预测。
- 算法开关与权重配置（规则/统计/ML/DL）。
- 预测结果展示：risk/rul/confidence/recommendation。
- 算法贡献图 + 风险趋势（最近 10 次）。
- 运行预测后落治理评估记录。

### 5.6 Rules（规则中心）
- 规则列表（名称、设备类型、指标、条件、等级、启停状态）。
- 新建规则弹窗（字段完整校验）。

### 5.7 Governance（算法治理）
- 模板名称输入 + 保存当前配置为模板。
- 模板列表 + 套用模板。
- 审计日志表格。
- 后端已有模板导入导出接口，前端可继续补导入导出操作入口。

### 5.8 Notifications（通知中心）
- 事件列表（类型、状态、重试次数、目标地址、错误、创建时间）。
- “重试失败事件”按钮。

## 6. 交互体验硬性要求
### 6.1 已确认要有的交互
- 顶部设备与高风险告警标签可点击展开详情抽屉。
- 风险等级颜色分级（`low/medium/high/critical` 对应不同色）。
- 风险趋势图标签不能与图形重叠（需要通过 legend/grid/xAxis label 调整解决）。
- 路由切页有平滑过渡动效。
- 全局命令面板：`Ctrl + K` 呼出快捷导航。
- 顶部通知中心抽屉：显示未处理计数、最近事件、快速重试。

### 6.2 易用性与可读性
- 深色主题下所有二级菜单、下拉、弹窗、表格、输入框文本必须可读。
- 输入与选择控件需具备基本可访问性命名（避免 a11y 报错）。

## 7. 视觉规范（可复刻）
- 风格：工业科技感深色主题，层次分明，卡片与边框有弱发光。
- 背景：多层渐变/径向光斑，不可纯平色。
- 卡片：悬停轻微上浮。
- 状态 chip：有明确语义色（好/警告/危险）。
- 响应式：1100px 与 760px 两档布局收敛。

## 8. 数据与计算逻辑要求
- 加权风险分必须从 `algorithm_outputs` 中按算法类型提取数值并归一化计算，避免 `NaN`。
- 预测历史保留最近 10 次。
- 评估指标：命中率、误报率在前端有可解释口径并可落库。

## 9. 已知边界（复刻时不要误解）
- 当前没有“TDengine 连接配置可视化页面”，连接参数在后端配置中。
- 当前“算法导入”是模板配置导入导出，不是上传 Python 源码并动态执行。

## 10. 质量门禁（验收标准）
### 10.1 功能验收
- 登录后可进入 5 个路由页面并正常切换。
- 预测链路可跑通，并在治理页看到评估/审计更新。
- 通知页与顶部通知中心数据一致。
- 设备/告警抽屉可展开查看明细。

### 10.2 工程验收
- `npm run build` 成功。
- `docker compose up --build` 后前后端与 TDengine 可用。
- `GET /health` 在前端状态栏正确反映服务状态。

### 10.3 UI 验收
- 不出现“深色背景黑字不可读”。
- 图表标签与组件不重叠。
- 移动端导航与布局可用。

## 11. 建议给其他 AI 的执行顺序
1. 先搭后端接口与 RBAC。
2. 接 TDengine REST 与 health。
3. 前端先搭路由壳与 5 页面骨架。
4. 再接 API 与状态管理。
5. 最后做视觉主题、交互动效、可读性和响应式收敛。
6. 通过 Docker Compose 一键启动验收。

## 12. 复刻交付物清单
- 可运行源码（backend/frontend）。
- `docker-compose.yml`。
- `.env.example`。
- API 文档（FastAPI docs）。
- 前端页面截图（登录、总览、预测、规则、治理、通知、抽屉、快捷面板）。
- 简要测试记录（启动、登录、预测、通知重试、健康状态）。
