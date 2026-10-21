# API 对接契约与待联调项

更新：2026-10-21。本文描述当前前端的请求方式，不是后端实现完成证明。真实路由、请求体和鉴权以目标部署的接口文档与实际响应为准。

## 1. 请求与错误约定

默认 API 前缀为 `/api`，可通过 `VITE_API_BASE` 或旧版 localStorage 覆盖项修改。客户端统一处理超时、HTTP 错误、请求取消和 JSON／文本响应。

兼容探测将 404、405、501 视为路径或方法未实现；其他错误直接交由调用方处理。成功路径按后端地址、方法和路径组缓存，部分列表接口的未实现结果缓存 30 秒，能力探测也缓存 30 秒。切换 API 地址不会共用路径发现结果。

`source: 'api'` 只表示真实数据模式，不表示每个模块都可用。各模块独立记录 api、unavailable 或 error 状态；真实空数组保持为空，缺失分数保持 null。

## 2. 能力声明

前端尝试 `GET /capabilities`，其次 `GET /meta/capabilities`。支持直接对象或 `{ capabilities: {...} }`；只有布尔值参与能力判断。

```json
{
  "analyze": true,
  "qualityDashboard": true,
  "qualityTrend": true,
  "fieldQuality": true,
  "issues": true,
  "baselines": true,
  "alertRules": true,
  "relationships": true,
  "objectRelationships": true,
  "schemaImpact": false,
  "lineage": false,
  "impact": true,
  "recommendations": true,
  "regression": true
}
```

明确 false 会隐藏对应导航并阻止该页面展示；缺少声明是“未知”，不会误判为禁用。旧后端没有能力端点时继续按现有路径探测。能力声明主要控制导航／页面；当前总览仍会探测其模块，不能把能力声明当成后端权限控制。

## 3. 分析主链路

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/health` | 可达性探测 |
| POST | `/rules/validate` | 原始 JSON 文本校验；可选 `strict=false` |
| GET | `/rules/reference` | JSONC 参考文本 |
| POST | `/preflight` | multipart 预检 |
| POST | `/analyze` | multipart 同步分析 |
| POST | `/analyze/async` | multipart 提交异步作业 |
| GET | `/analyze/async/{jobId}` | 状态与结果 |
| GET | `/analyze/async/{jobId}/events` | SSE 进度 |
| POST | `/analyze/async/{jobId}/cancel` | 请求取消 |

预检与正式分析复用同一个表单构造函数：file、rulesJson、flatten、csvInferNumbers、allowUnknownRules、maxValues、fields、filter、rootPath、recordPath、sampleReservoir、sampleStep、maxParallel，以及启用的特征开关。

规则中 selectedFields 和 filter 优先于界面 runtime 的同名选项；flatten 优先读取显式规则值、规则 runtime.flatten，再读取运行设置。字段规则正文与请求层选项由纯函数构造，采样和并行参数必须是正整数。

异步提交需要 jobId 或 JobId。前端将 Running、Queued、Pending、Submitted 视为处理中；Completed、Succeeded、Success 视为成功，Cancelled／Canceled 视为取消，其他终态报告错误。状态与结果响应预期使用 camelCase 字段，未宣称支持任意大小写组合。

SSE 使用 progress、complete、gone 事件。complete 后再读取作业结果；SSE 失败回退轮询。轮询默认 1 秒，连续故障退避到最多 15 秒，默认连续 5 次错误停止；404 和 410 立即停止。

## 4. 平台标准路径

| 能力 | 优先请求路径 |
| --- | --- |
| 作业列表／详情／结果 | `/analysis/jobs`、`/analysis/jobs/{id}`、`/analysis/jobs/{id}/result` |
| 删除作业 | `DELETE /analysis/jobs/{id}` |
| 质量总览 | `/quality/dashboard` |
| 趋势与快照 | `/quality/trend?limit=30`，总览内复用一次响应 |
| 字段质量 | `/quality/fields/{jobId}` |
| 字段关系 | `/quality/relationships/{jobId}` |
| 对象关系 | `/quality/object-relationships/{jobId}` |
| Schema 影响 | `/quality/schema-impact/{jobId}` |
| 问题列表 | `/issues?jobId=&limit=` |
| 修复建议 | `/quality/recommendations` |
| 质量回归 | `/quality/regression` |
| 基线 | `/quality-baselines`，兼容 `/quality/baselines` |
| 告警 | `/alert-rules`，兼容 `/alerts/rules`、`/quality/alert-rules` |
| 血缘 | `/analysis/jobs/{jobId}/lineage` |
| 影响 | `/analysis/jobs/{jobId}/impact` |

完整候选路径以 `src/api/platform.js` 为准。列表适配支持数组或 items、jobs、snapshots、issues、fields、rules、baselines 等包装；领域字段由 normalize 和 normalize-extract 处理。分页仍由具体接口决定，前端 limit 不代表已实现全量翻页。

告警启停会在列表成功路径下 PUT `{id}`，保留原始规则中的阈值、Webhook 等字段并修改 enabled。需要联调确认目标后端接受此完整更新请求，以及返回成功是否表示持久化已完成。

基线页面目前以展示为主，客户端的写入封装不等于页面已提供完整 CRUD。问题状态写接口也不代表已形成完整责任分派和整改流程。

## 5. 尚需目标后端确认

- 异步分析与同步分析何时写入历史和质量快照，是否返回可复用的持久化作业 ID。
- 取消是否幂等、是否允许取消排队作业、取消失败后的状态如何查询。
- 预检是否支持上述全部字段，未开启特征如何表达 unavailable、reason 和空结果。
- 告警和基线更新的 PUT 请求体与路径；问题状态、权限及鉴权契约。
- SSE 经代理后是否实时送达，跨域或 Cookie 鉴权是否与 fetch 一致。
- 大报告服务端导出、分布快照与模糊去重等能力是否在当前 API 版本提供。

本次前端自动化使用受控响应验证请求行为；本地后端未连通，未对真实业务作业或告警执行写入测试。
