# ObjectAnalysisStatistic（Web UI）

对象/字段分析统计工具的 Web 界面。对 JSON、JSONL、CSV、Excel、XML、YAML 等数据源做**扁平化展开 + 字段级统计 + 质量校验 + 深度分析**，支持规则驱动的类型转换与校验规则。

功能对齐 .NET 参考项目 [`ObjectAnalyzer`](../Items/ObjectAnalysisStatistic)。**所有统计均由 .NET 后端 `ObjectAnalyzer.Api` 计算**，前端只负责提交数据源与渲染结果——浏览器内不做任何解析或分析。

## 快速开始

```bash
npm install
npm run dev      # 开发服务器 http://localhost:5173（热更新）
npm run build    # 产物输出到 dist/
npm run preview  # 本地预览构建产物
```

> 本机沙箱环境下 `npm install` 需指定本地缓存：`npm install --cache ./.npm-cache`。

## 架构：纯后端分析

早期版本在浏览器内用 JS 复刻了一套分析引擎（`analysis.js` + `parsers.js`），带来两个问题：与 .NET 实现存在偏差，且**大数据集会把浏览器主线程卡死**——其中模糊去重是 O(n²) 全量两两比对，5000 条耗时 27 秒，2 万条可达分钟级。

现在已移除这套本地引擎，分析链路只剩一次 HTTP 请求：

```
选择文件 / 粘贴文本 → FormData → POST /api/analyze → .NET 计算 → 适配层 → 渲染
```

实测端到端耗时（含上传，经 Vite 代理，P4 全开）：

| 数据量 | 文件大小 | 耗时 |
| --- | --- | --- |
| 1,000 条 | 228 KB | 0.05 s |
| 5,000 条 | 1.1 MB | 0.23 s |
| 20,000 条 | 4.7 MB | 0.68 s |

页面右上角会显示本次分析的端到端耗时与数据量。

### 后端对接

1. 启动 .NET 后端：
   ```bash
   dotnet run --project src/ObjectAnalyzer.Api
   ```
2. 前端默认请求 `/api/*`，由 Vite 代理转发到 `http://localhost:5200`（`vite.config.js`），无需处理 CORS。
   换端口：`API_TARGET=http://localhost:5000 npm run dev`。
3. 直连后端（生产/跨机）：在侧栏「后端地址」填 `http://host:port/api`，或建 `.env.local` 设置 `VITE_API_BASE`。

接口清单：

- `GET /api/health` → `{ status, version }`
- `POST /api/analyze` multipart：`file`、`rulesJson`（内联规则）、`flatten`、`fields`、`filter`、`rootPath`、`recordPath`、`sampleReservoir`、`sampleStep`、`maxParallel` 及 P4 开关
- `POST /api/analyze/raw?format=json` 请求体即文本。规则走查询参数 `rulesJson=`（请求体被数据占用，受请求行长度限制，约 8KB），另有 `allowUnknownRules`；规则较长时改用 `/api/analyze` —— 前端「粘贴数据」就是把文本包装成 File 走 multipart 的
- `POST /api/rules/validate` **raw body**（不是 multipart），返回 `{ valid, fields, unknowns, error? }`；结构/类型非法时 400 + `{ error }`
- `GET /api/rules/reference` 返回 `rules_full_reference.jsonc` 原文（纯文本，非 JSON）

## 目录结构

```
src/
  App.jsx            工作台布局、数据源与规则编排、分析提交
  api.js             Mini API 客户端（超时、错误处理、地址覆盖）
  adapter.js         后端 camelCase 响应 → 前端内部结构的适配层
  exporters.js       报告导出（JSON/CSV/Markdown/HTML/JSON Schema/Excel/PDF）
  schemaDiff.js      Schema 快照与 Diff
  theme.js           主题模式（跟随系统/浅色/深色）与图表配色表
  utils.js           展示用常量（质量检查项中文标签）
  components/        字段明细表、深度分析、取值分布、质量报告、规则编辑器、主题切换等
```

标签页：**字段明细 / 深度分析 / 取值分布 / 质量报告**。其中「取值分布」直接渲染后端返回的 `valueCounts`，因此大文件、压缩包、Excel 等无法在浏览器展开的数据源同样可用。

## 功能概览

- **字段明细**：覆盖率、类型分布、高频值、数值剖析（min/max/avg/中位数/P90/P95/P99/标准差）、直方图、IQR 异常值、日期剖析与直方图
- **深度分析**：字段相关性（Pearson + Spearman）、字符串模式、Unicode 卫生、时间分布与趋势、Schema 快照 Diff。全部由后端计算，未开启的开关对应卡片会显示引导提示（前端不再本地补算）
- **质量校验**：规则面板支持 `required` / `enum` / `range` / `pattern` / `unique` / `nullRateMax` / `expectations`，以及 `transform`（json/jwt/base64/url 解析后多级展开）
- **规则支持 JSONC**：规则配置可写 `//` 与 `/* */` 注释、容忍尾随逗号（见 `src/utils.js` 的 `stripJsonComments` / `parseJsonc`）
- **规则校验走后端**：点「校验」或「应用规则」时提交给 `POST /api/rules/validate`，由后端的 `AnalysisRules` 反序列化做权威检查。两段式：本地先查语法（能给出编辑器里的行列），通过后交后端查结构与类型。后端能查出 `"minValue": "abc"` 这类类型错误（`JSON.parse` 会放行）
- **拼错的规则名直接报错**：`System.Text.Json` 默认静默忽略不认识的键（规则看似生效实则没有），校验接口额外扫描并返回 `unknowns`，带上路径和建议写法（如 `fields.age` 的 `minValue2` → `minValue`）。这类问题**判为校验失败**（红色错误条逐条列出改法），并阻断分析——否则跑出来的结果看着正常，实则那条规则压根没生效。分析接口 `/api/analyze` 同样会拦截并返回 400。确实要放行：校验加 `?strict=false`（只警告），分析加表单字段 `allowUnknownRules=true`；CLI 加 `--allow-unknown-rules`
- **导入导出**：多格式导入；报告可导出为 JSON、CSV、Markdown、HTML、JSON Schema、Excel、PDF
- **CSV 数值列推断**：CSV 没有类型信息，后端（MiniExcel）取出的单元格一律是字符串，因此默认把「看起来是数字」的还原成 `long`/`double`，让 CSV 也能拿到均值 / 标准差 / 分位数 / 直方图 / 相关性。界面「数据源」区可关（存 `localStorage.apiCsvInferNumbers`），对应后端参数 `csvInferNumbers` / CLI `--no-csv-number-inference`
- **推断是保守的**：以下一律**保持字符串**，宁可漏转也不误转——前导零（`007` 是编码不是数字 7）、超过 15 位（精度风险）、科学计数法、千分位、带单位。**只作用于 CSV**：xlsx 单元格自带类型，JSON 的数字本来就是数字
- **明暗主题**：顶栏右侧三档切换（跟随系统 / 浅色 / 深色），选择存 `localStorage`。存的是「模式」而非明暗结果，因此跟随系统时系统偏好一变会立即跟着变，手动选过则不受系统影响。首屏由 `index.html` 的内联脚本预置 `data-theme`，不会闪色

### 主题实现约定

- **明暗只写 `<html data-theme="light|dark">`**，样式表里不出现 `prefers-color-scheme` 媒体查询——否则「手动选深色但系统是浅色」时两套规则会打架。系统偏好只在 JS 里解析（见 `src/theme.js` 的 `resolveTheme`）
- **颜色令牌化**：`styles.css` 的 `:root` 是深色，浅色只在 `[data-theme='light']` 里覆盖同名变量（当前 86 个令牌，浅色覆盖 84 个，仅尺寸类的 `--radius` / `--sidebar-w` 不覆盖）。改配色只动这两块，不要在组件里写死颜色
- **图表是例外**：recharts 的 `stroke` / `fill` / `stopColor` 是 SVG 呈现属性，**不解析 `var(--x)`**，所以图表颜色只能在 JS 里按主题取值——统一放在 `src/theme.js` 的 `CHART_COLORS`，与 CSS 变量各存一份，改配色时两处都要动
- 导出的 HTML 报告是独立文件，拿不到界面主题，改用 `prefers-color-scheme` 跟随阅读者的系统偏好

## 已知限制

- **模糊去重不可用**：后端 `ObjectAnalyzer.Analyze` 不产出 `FuzzyDuplicates`（该结果只在 CLI 的 `AnalysisRunner` 路径生成），界面上该卡片标注「未开启」。需要这项能力得改后端，让 API 路径也执行该逻辑
- 相关性有前置条件：至少 2 个数值字段且每字段样本数 ≥ 3，否则后端返回空
- 分布快照依赖 CLI 的 `--snapshot` 导出文件，API 响应不返回，界面上该项置灰标注「仅 CLI」
- 后端不返回原始记录，因此没有行级「数据预览」；改用「取值分布」展示各字段高频值
- 后端的 `System.Text.Json` 规则反序列化开了 `ReadCommentHandling.Skip`（**能读注释**），但没开 `AllowTrailingCommas`（**不接受尾随逗号**）。因此提交分两种形态：校验用 `toBackendRulesText()`（只去尾随逗号、保留注释与换行，保证后端报错的 `LineNumber` 能对齐编辑器），分析用 `toJsonText()`（压成紧凑 JSON）
- 后端规则校验**不认尾随逗号**，而前端允许；若不做清洗，用户写了尾随逗号会被后端报成语法错误——属于前端特性与后端能力的落差，已在清洗层抹平
- 未知规则名的检查实现在 Core（`ObjectAnalyzer.Core/Analysis/Rules/RulesLint.cs`，对规则原文做旁检查），API 与 CLI 共用。没有开 `JsonUnmappedMemberHandling.Disallow`（那会让含历史字段的旧规则文件直接加载失败），而是在**反序列化之前**先扫一遍原文拦下来
- 大文件上传耗时取决于网络与后端解析，浏览器端不再有计算开销

## 本地环境注意事项

- `npm install` 需带 `--cache ./.npm-cache`（全局缓存目录不可写时会静默失败）
- Vite 重启批量删除 `node_modules/.vite/deps` 会被安全删除拦截，用 `mv node_modules/.vite node_modules/.vite.bak` 重命名绕过
- `npm run build` 前先 `rm -rf dist`，避免清空 dist 时触发同样的拦截
