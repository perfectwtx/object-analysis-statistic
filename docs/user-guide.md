# 前端使用指南

面向 `object-analysis-statistic` Web UI：如何连接后端、完成一次分析，以及使用质量看板、问题中心与洞察页面。

配套后端：`ObjectAnalysisStatistic`（`ObjectAnalyzer.Api`）。  
相关文档：`docs/frontend-api-gaps.md`（接口缺口）、后端 `docs/api.md`。

---

## 1. 你能用它做什么

| 能力 | 说明 |
|------|------|
| 分析工作台 | 上传 / 粘贴 JSON、JSONL、CSV、Excel、XML、YAML，提交给后端做字段统计与质量校验 |
| 规则配置 | 可视化或 JSON 配置字段规则、运行时、valueParsers、PII、加解密 transform |
| 质量总览 | 五维质量分、趋势、字段质量、问题列表 |
| 基线与告警 | 质量基线、告警规则（依赖后端对应 API） |
| 洞察 | 字段相关、对象关系、Schema 影响、血缘、影响分析、修复建议、回归对比 |
| 主题与语言 | 浅色 / 深色 / 护眼色；中英文切换 |

**重要：** 统计与校验全部由 .NET 后端完成，浏览器只负责提交数据与展示结果。

---

## 2. 环境准备

### 2.1 依赖

- Node.js 18+（建议 20 LTS）
- 已启动的后端 API（默认开发代理到本机后端端口，见 `vite.config`）

### 2.2 安装与启动

```bash
git clone https://github.com/perfectwtx/object-analysis-statistic.git
cd object-analysis-statistic
npm install
npm run dev
```

浏览器打开：**http://localhost:5173**

生产构建：

```bash
npm run build
npm run preview
```

### 2.3 连接后端

开发模式下，Vite 会把 `/api` 代理到后端（见 `vite.config` 中的 `server.proxy`）。

可选环境变量（`.env` / `.env.local`）：

```bash
# 前端请求的 API 前缀；开发一般用默认 /api（走代理）
VITE_API_BASE=/api
```

若后端不在代理目标地址：

1. 修改 `vite.config` 里 proxy 的 `target`；或  
2. 在页面里设置 API Base（若 UI 提供覆盖项），写入 `localStorage` 键 `apiBaseOverride`。

确认后端健康后，顶栏 **BackendStatus** 应显示已连接；未连接时质量页可能显示「演示数据」。

---

## 3. 界面结构

顶部主导航大致分为四块：

| 导航 | 路径示例 | 内容 |
|------|----------|------|
| 总览 | `/` | 健康分、维度、最近问题摘要 |
| 分析 | `/analyze` | 分析工作台（上传、规则、结果表） |
| 质量 | `/quality`、`/quality/trend`、`/quality/fields`、`/issues`、`/baselines`、`/alerts`、`/regression` | 质量与问题运营 |
| 洞察 | `/relations`、`/relationships`、`/schema-impact`、`/lineage`、`/impact`、`/recommendations` | 依赖某次分析 Job 的深度结果 |

右上角通常包含：

- **主题**：浅色 / 深色 / 护眼 / 跟随系统  
- **语言**：中文 / English  
- **后端状态**

---

## 4. 分析工作台（核心流程）

路径：`/analyze`

### 4.1 准备数据

支持三种入口：

1. **选择文件**：JSON / JSONL / CSV / Excel / XML / YAML 等  
2. **粘贴文本**：打开粘贴对话框，选择格式后提交  
3. **内置样例**：快速体验全流程  

大文件会自动或可强制走 **异步分析**（`POST /api/analyze/async`），界面显示进度；可取消。

### 4.2 配置规则（推荐先配再分析）

点击规则 / 配置入口，打开 **「规则与运行配置」** 模态框，常见三个页签：

#### Runtime

- **flatten**：是否将嵌套对象展平为点路径（如 `address.city`）  
- **CSV 数字推断**、**强制后台分析**  
- 其它分析参数：`recordPath`、`rootPath`、字段过滤、`allowUnknownRules` 等（与后端表单字段对应）

#### Rules

两种模式可切换，内容自动同步：

| 模式 | 适用 |
|------|------|
| **可视化** | 按字段勾选 required / unique / enum / pattern / 范围 / nullRate / transform / PII 等 |
| **JSON** | 直接编辑完整规则文档，支持校验、导入、模板、参考 |

常用操作：

- **从样本导入字段**：分析或 preflight 返回的字段名写入 `fields`  
- **正则预设**：邮箱、手机等常见 pattern  
- **PII 打码**：整值 / 保留前缀 / 保留后缀  
- **ValueParsers**：Excel/CSV 某列按 JSON 等再解析  
- **清空所有规则**：清空 fields / valueParsers / expectations，保留 runtime.flatten  

#### Features（深度特征）

按需开启，例如：

- 字段相关性  
- 字符串模式  
- Unicode 卫生  
- 时间序列  
- 分布快照（若仅 CLI，界面会标注）

深度特征会影响「洞察」里相关矩阵、模式等是否有数据。

### 4.3 执行分析

1. 选好数据源与规则  
2. 点击分析 / 应用规则  
3. 若触发 **preflight 警告**（规则字段与样本不一致等），按提示确认或调整后再跑  
4. 完成后查看：字段明细、取值分布、质量报告、深度分析 Tab  

成功后的异步 **JobId** 会记入浏览器本地（`oaLastJobId`），供血缘、关系等页默认选中。

### 4.4 导出结果

在结果区可导出 JSON / CSV / Markdown / HTML / Schema / Excel（视界面按钮而定）。  
大数据量优先用后端导出接口（若后端已提供）。

---

## 5. 质量与问题

### 5.1 质量总览 `/quality`

- 综合分与五维：完整性、有效性、唯一性、一致性、异常控制  
- 数据来自 `GET /api/quality/dashboard`（后端不可用时可能为演示数据）  
- 右上角可刷新  

### 5.2 质量趋势 `/quality/trend`

- 按时间查看质量分变化  
- 依赖历史快照；需多次成功分析才会形成曲线  

### 5.3 字段质量 `/quality/fields`

1. 从下拉框选择一次成功作业  
2. 查看各字段覆盖率、类型、唯一性、有效性、异常数等  
3. 数据来自 `GET /api/quality/fields/{jobId}`  

### 5.4 问题中心 `/issues`

- 按作业、严重级别筛选  
- 展示问题标题、字段、维度、次数  
- 责任人 / 整改 / 状态流转取决于后端是否开放对应写接口  

### 5.5 基线 `/baselines` 与告警 `/alerts`

- 列表展示后端返回的基线与告警规则  
- 启用/停用等操作在后端支持写接口后才会真正持久化  

### 5.6 质量回归 `/regression`

- 比较**最近两次**成功分析的差异  
- 需至少两次成功作业  

---

## 6. 洞察页面

多数页面依赖 **JobId**：

1. 先在工作台完成一次（建议开启需要的 Features）分析  
2. 进入对应洞察页  
3. 从下拉选择作业，或粘贴 JobId 后加载  

| 页面 | 路径 | 典型接口 | 注意 |
|------|------|----------|------|
| 字段关系 | `/relations` | `/api/quality/relationships/{jobId}` | 需开启字段相关性 |
| 对象关系 | `/relationships` | `/api/quality/object-relationships/{jobId}` | |
| Schema 影响 | `/schema-impact` | `/api/quality/schema-impact/{jobId}` | 需有可比的历史 Schema |
| 数据血缘 | `/lineage` | `/api/analysis/jobs/{jobId}/lineage` | |
| 影响分析 | `/impact` | `/api/analysis/jobs/{jobId}/impact` | |
| 修复建议 | `/recommendations` | `/api/quality/recommendations` | 通常基于最近一次成功分析 |

若返回 `available: false`，表示该作业未生成对应深度结果（例如未开相关特征），不是简单的网络错误。

---

## 7. 规则配置速查

字段规则常见项（可视化与 JSON 一致）：

| 配置 | 含义 |
|------|------|
| `required` | 必填 |
| `unique` | 唯一 |
| `enumValues` | 枚举白名单 |
| `pattern` | 正则 |
| `minValue` / `maxValue` | 数值范围 |
| `nullRateMax` | 空值率上限 |
| `primaryType` | 期望主类型 |
| `maxOutlierRatio` | 异常值比例 |
| `transform` | 解析/加解密（json、jwt、base64、aes、sm4 等） |
| `pii` / `redact` | 敏感信息与打码 |
| `defaultValue` | 默认值 |
| `valueParsers` | 按列再解析（表格类数据） |
| `expectations` | 数据集级期望（如最小行数） |

JSON 模式支持注释（JSONC）；保存前建议点 **校验**。

---

## 8. 主题与语言

- **主题**：浅色、深色、护眼（暖绿灰）、系统；保存在本地，刷新不丢失  
- **语言**：中文 / English；文案通过 `useT` 与字典切换  

若某页仍有个别硬编码文案，以界面实际显示为准，后续版本会继续补全 i18n。

---

## 9. 推荐日常用法

```text
1. 启动后端 API → npm run dev
2. 打开 /analyze，加载样例或真实文件
3. 打开规则配置：flatten + 必要字段规则 + 需要的 Features
4. 运行分析，确认字段明细与质量报告正常
5. 到 /quality、/issues 查看总览与问题
6. 需要相关/血缘时，确认 Features 已开，再打开洞察页并选同一 JobId
7. 多次分析后查看 /quality/trend 与 /regression
```

---

## 10. 常见问题

### 页面一直是「演示数据」

- 后端未启动或代理错误  
- CORS / 地址不对：检查 `VITE_API_BASE` 与 vite proxy  
- 看浏览器 Network：`/api/quality/dashboard`、`/api/analysis/jobs` 是否 200  

### 洞察页没有数据

- 未先完成分析，或 JobId 不对  
- 未开启对应深度 Feature（如相关性）  
- 后端对该 Job 返回空或 `available: false`  

### 分析很慢或卡住

- 大文件应走异步；可勾选「强制后台分析」  
- 看 SSE `/analyze/async/{id}/events` 或轮询状态  
- 不要在规则里误开过重的全量特征（若数据量极大）  

### 规则校验失败

- JSON 语法错误（逗号、引号）  
- 字段名与样本不一致：用 preflight / 导入样本字段  
- 未知规则名：开启 `allowUnknownRules` 或对照后端规则参考  

### 粘贴 JobId 仍 404

- 确认是**历史库中的** JobId（持久化后的 GUID），不是仅进程内已清理的短时 ID  
- 路径应为后端提供的 `/api/analysis/jobs/...` 或文档中的别名  

---

## 11. 开发者提示

| 位置 | 说明 |
|------|------|
| `src/api/analyze.js` | 同步/异步分析、SSE、规则校验 |
| `src/api/platform.js` | 质量、问题、基线、告警、血缘等 |
| `src/lib/load-platform.js` | 首页总览聚合加载 |
| `src/lib/normalize*.js` | 后端多种响应形态归一化 |
| `src/workbench/` | 分析工作台壳与布局 |
| `src/pages/` | 各业务页面 |

本地改完后：

```bash
npm run build   # 确认无编译错误
```

接口契约以运行中的后端 OpenAPI / Scalar 为准；前端对部分路径做了多候选探测（`tryPaths`），后端增加别名可减少 404。

---

## 12. 版本与反馈

- 前端仓库：https://github.com/perfectwtx/object-analysis-statistic  
- 后端仓库：ObjectAnalysisStatistic（ObjectAnalyzer.Api）  

使用中若某页长期不可用，请附上：浏览器 Network 中失败请求的 **方法、路径、状态码、响应体摘要**，便于对照 `docs/frontend-api-gaps.md` 排查。
