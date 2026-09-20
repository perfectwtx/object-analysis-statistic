# 前端完善所需的后端 API 清单

> 对照前端仓库 `object-analysis-statistic`（`src/api/platform.js`、各 Dashboard 页）与后端 `ObjectAnalysisStatistic`（`src/ObjectAnalyzer.Api/Endpoints/*`）。  
> 目标：让质量 Dashboard、问题中心、基线、告警、血缘/影响等页面从 mock 切到真实数据。

---

## 1. 现状摘要

| 模块 | 后端 | 前端 | 主要卡点 |
|------|------|------|----------|
| 同步/异步分析 | ✅ 已有 | ✅ 已接 | — |
| Preflight / 规则校验 | ✅ 已有 | ✅ 已接 | — |
| 作业历史 | ✅ `/api/analysis/jobs` | 多路径探测 | **路径不一致** |
| 质量 Dashboard / 趋势 / 字段 | ✅ `/api/quality/*` | 部分探测 | **路径不一致** |
| 问题中心 | ✅ `/api/issues` | 已接尝试 | 缺运营写接口 |
| 血缘 / Impact | ✅ 文档 + 端点 | 占位页 | 需统一路径与空态 |
| 基线 / 告警 | 有 Endpoint 文件 | 有页面 | **CRUD 路径与 FE 对齐** |
| Capabilities | ❌ | 探测中 | **建议新增** |

**结论：** 分析主链路已够用；Dashboard 体系后端多数能力已实现，优先做 **路径别名 + capabilities + 基线/告警对齐**，再补问题运营写接口。

---

## 2. 路径对齐（优先，成本最低）

前端 `tryPaths` 会依次尝试多个路径，第一个非 404 才采用。后端真实路径与探测列表不一致时，会落到 mock。

### 2.1 建议后端增加的别名（推荐）

在现有实现上增加路由别名，避免改前端所有调用方：

| 别名 | 指向现有实现 |
|------|----------------|
| `GET /api/jobs` | `GET /api/analysis/jobs` |
| `GET /api/jobs/{jobId}` | `GET /api/analysis/jobs/{jobId}` |
| `GET /api/jobs/{jobId}/result` | `GET /api/analysis/jobs/{jobId}/result` |
| `GET /api/jobs/{jobId}/fields` | `GET /api/quality/fields/{jobId}` |
| `GET /api/jobs/{jobId}/lineage` | `GET /api/analysis/jobs/{jobId}/lineage` |
| `GET /api/jobs/{jobId}/impact` | `GET /api/analysis/jobs/{jobId}/impact` |
| `GET /api/jobs/{jobId}/schema-impact` | `GET /api/quality/schema-impact/{jobId}` |
| `GET /api/quality/snapshots` | `GET /api/quality/trend`（或同等快照列表） |
| `GET /api/quality/snapshots/{jobId}/fields` | `GET /api/quality/fields/{jobId}` |

### 2.2 后端已有、前端应优先使用的路径

| 能力 | 后端实际路径 |
|------|----------------|
| 作业列表 | `GET /api/analysis/jobs?limit=` |
| 作业详情 | `GET /api/analysis/jobs/{jobId}` |
| 作业结果 | `GET /api/analysis/jobs/{jobId}/result` |
| 作业总览 | `GET /api/analysis/jobs/{jobId}/overview` |
| 质量总览 | `GET /api/quality/dashboard` |
| 质量趋势 | `GET /api/quality/trend?sourceName=&limit=` |
| 可查字段质量的作业 | `GET /api/quality/fields` |
| 字段质量 | `GET /api/quality/fields/{jobId}` |
| 字段相关矩阵 | `GET /api/quality/relationships/{jobId}` |
| 对象关系 | `GET /api/quality/object-relationships/{jobId}` |
| Schema 影响 | `GET /api/quality/schema-impact/{jobId}` |
| 修复建议 | `GET /api/quality/recommendations` |
| 质量回归 | `GET /api/quality/regression` |
| 问题中心 | `GET /api/issues?jobId=` |
| 某作业问题 | `GET /api/issues/{jobId}` |

---

## 3. 建议新增 / 补齐的接口

### 3.1 P0 — Dashboard 与能力探测

#### `GET /api/capabilities`

返回当前部署已启用的模块，前端据此隐藏/展示菜单与是否走 mock。

**响应示例：**

```json
{
  "analyze": true,
  "asyncAnalyze": true,
  "preflight": true,
  "qualityDashboard": true,
  "qualityTrend": true,
  "issues": true,
  "baselines": true,
  "alertRules": true,
  "lineage": true,
  "impact": true,
  "webhooks": true
}
```

也可使用：`GET /api/meta/capabilities`。

#### 确认已注册且可访问

- `GET /api/quality/dashboard`
- `GET /api/analysis/jobs`

异步作业完成后必须写入 `IAnalysisHistoryStore`，否则历史列表为空。

---

### 3.2 P1 — 问题中心可运营

查询已有；建议补状态与聚合，便于 Issue Center 从只读变为可办。

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/issues/summary` | 按 severity / check / field 聚合 |
| `GET` | `/api/issues?jobId=&severity=&check=&status=&limit=&offset=` | 统一筛选与分页 |
| `PATCH` 或 `PUT` | `/api/issues/{jobId}/{fieldName}/{check}/status` | 更新状态：`Open` / `InProgress` / `Resolved` / `Ignored` |

**已有可继续用：**

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/issues/{jobId}/responsibilities` | 责任人 |
| `PUT` | `/api/issues/{jobId}/responsibilities/{fieldName}/{check}` | 保存责任分配 |
| `GET` | `/api/issues/{jobId}/remediations/{fieldName}/{check}` | 整改记录 |
| `POST` | `/api/issues/{jobId}/remediations` | 新增整改 |

---

### 3.3 P2 — 质量基线

前端页面：`BaselinesPage`；客户端：`listBaselines` / `createBaseline` / `updateBaseline` / `deleteBaseline`。

| 方法 | 建议路径 | 说明 |
|------|----------|------|
| `GET` | `/api/quality-baselines` | 列表 |
| `POST` | `/api/quality-baselines` | 创建 |
| `GET` | `/api/quality-baselines/{id}` | 详情 |
| `PUT` | `/api/quality-baselines/{id}` | 更新 |
| `DELETE` | `/api/quality-baselines/{id}` | 删除 |
| `POST` | `/api/quality-baselines/{id}/evaluate?jobId=` | 相对某次作业评估（可选） |

若后端已是 `/api/quality/baselines`，请与前端约定统一，或两边都支持别名。

**创建 body 示例：**

```json
{
  "name": "生产主链路基线",
  "sourceName": "orders.json",
  "minOverallScore": 80,
  "minCompleteness": 0.95,
  "maxCriticalIssues": 0
}
```

---

### 3.4 P2 — 告警规则与 Webhook

前端页面：`AlertRulesPage`；客户端：`listAlertRules`、`listWebhookDeliveries`。

| 方法 | 建议路径 | 说明 |
|------|----------|------|
| `GET` | `/api/alert-rules` | 规则列表 |
| `POST` | `/api/alert-rules` | 创建 |
| `GET` | `/api/alert-rules/{id}` | 详情 |
| `PUT` | `/api/alert-rules/{id}` | 更新（阈值、启用、Webhook URL） |
| `DELETE` | `/api/alert-rules/{id}` | 删除 |
| `GET` | `/api/webhooks/deliveries?limit=&status=` | Outbox 投递记录 |
| `POST` | `/api/webhooks/deliveries/{id}/retry` | 失败重试（可选） |

**规则 body 示例：**

```json
{
  "name": "质量分低于 70",
  "enabled": true,
  "condition": "overallScoreBelow",
  "threshold": 70,
  "webhookUrl": "https://example.com/hooks/oa"
}
```

文档中已支持的条件类型可映射为：`overallScoreBelow`、`completenessBelow`、`scoreDrop`、`criticalIssue`、`breakingSchemaChange`、`distributionDrift`。

---

### 3.5 P3 — 血缘 / 影响 / 关系

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/analysis/jobs/{jobId}/lineage` | 数据血缘 |
| `GET` | `/api/analysis/jobs/{jobId}/impact` | 变更影响 |
| `GET` | `/api/quality/object-relationships/{jobId}` | 对象关系 |
| `GET` | `/api/quality/relationships/{jobId}` | 字段相关矩阵 |
| `GET` | `/api/quality/schema-impact/{jobId}` | Schema Diff |

**空态约定（建议）：** 深度分析未开启时不要只返回空数组，明确说明原因，例如：

```json
{
  "available": false,
  "reason": "correlation not enabled for this job",
  "data": null
}
```

---

### 3.6 P4 — 可选增强

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/analysis/jobs/{jobId}/export?format=json\|csv\|xlsx` | 服务端导出大结果 |
| `GET` | `/api/rules/reference` | 全量规则参考模板（JSONC） |
| `POST` | `/api/rules/validate` | 与现有校验路径统一对外名 |
| `GET` | `/api/health`、`GET /api/ready` | 前端 BackendStatus |
| — | 异步取消后 history 状态同步为 `Cancelled` | 与 Registry 一致 |

---

## 4. 分析主链路（已具备，保持即可）

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/analyze` | 同步分析（multipart） |
| `POST` | `/api/analyze/async` | 异步提交 |
| `GET` | `/api/analyze/async/{jobId}` | 状态 / 结果 |
| `GET` | `/api/analyze/async/{jobId}/events` | SSE 进度 |
| `POST` | `/api/analyze/async/{jobId}/cancel` | 取消 |
| `POST` | `/api/preflight` | 预处理 / 样本字段 |
| — | 规则校验 / 参考模板 | 见 `RulesEndpoints` |

表单字段需继续支持：`file`、`rulesJson`、`flatten`、`csvInferNumbers`、`features`、`valueParsers`（经 rules）、以及 runtime 相关选项。

---

## 5. 推荐落地顺序

```text
1. 路径别名（/api/jobs、/quality/snapshots…）或前端 tryPaths 改真实路径
2. GET /api/capabilities
3. 确认 dashboard + analysis/jobs 有数据（异步成功写入 history）
4. 基线 CRUD 路径与 FE 对齐
5. 告警规则 CRUD + webhook deliveries
6. Issue status / summary
7. lineage / impact 空态与持久化可读性
8. 导出 / 健康检查等可选项
```

---

## 6. 验收清单（前端视角）

- [ ] `GET /api/analysis/jobs` 或 `/api/jobs` 能列出最近异步作业
- [ ] `GET /api/quality/dashboard` 返回最近成功分析的五维分与 top issues
- [ ] `GET /api/quality/trend` 有时间序列快照
- [ ] `GET /api/quality/fields/{jobId}` 字段表可渲染
- [ ] `GET /api/issues` Issue Center 可筛选
- [ ] 基线页可增删改查
- [ ] 告警页可列出规则；deliveries 可查
- [ ] 血缘/影响页在给定 `jobId` 下返回结构化数据或明确 `available: false`
- [ ] `GET /api/capabilities` 与菜单显隐一致

---

## 7. 相关代码位置

**后端**

- `src/ObjectAnalyzer.Api/Endpoints/QualityEndpoints.cs`
- `src/ObjectAnalyzer.Api/Endpoints/IssueEndpoints.cs`
- `src/ObjectAnalyzer.Api/Endpoints/AsyncAnalyzeEndpoints.cs`
- `src/ObjectAnalyzer.Api/Endpoints/DataLineageEndpoints.cs`
- `src/ObjectAnalyzer.Api/Endpoints/ImpactAnalysisEndpoints.cs`
- `src/ObjectAnalyzer.Api/Endpoints/QualityBaselineEndpoints.cs`
- `src/ObjectAnalyzer.Api/Endpoints/AlertRuleEndpoints.cs`
- `docs/api.md`、`docs/issues.md`、`docs/alerts.md`、`docs/history.md`

**前端**

- `src/api/platform.js` — 平台 API 与 `tryPaths`
- `src/api/analyze.js` — 分析 / preflight / 规则
- `src/pages/*` — Dashboard、Issue、Baseline、Alert、Lineage 等页

---

*文档版本：与 2026-09 前后端对照整理。接口细节以运行中的 OpenAPI / Scalar 为准。*
