# ObjectAnalysisStatistic Web UI

基于 React 的对象／字段分析与数据质量平台。前端负责文件提交、规则编辑、任务进度、结果展示和报告导出，统计由配套的 .NET `ObjectAnalyzer.Api` 完成；规则 JSONC 清洗、界面筛选、结果适配与报告生成在浏览器执行。

## 安装与运行

使用 Node.js 22（与 CI 一致；本次本地验证使用 Node.js 24）。

```bash
npm ci
npm run dev
```

默认打开 [本地开发页面](http://localhost:5173)。端口占用时 Vite 会选择下一个可用端口，以终端输出为准。

```bash
npm run check          # 全部源码语法、相对引用、锁文件元数据检查
npm test               # 业务回归检查
npm run build          # dist/ 与构建 manifest
npm run check:bundle   # 首屏静态 JS 依赖总量，预算 350 KiB
npm run preview        # 本地查看构建产物
```

Windows 的 npm 启动脚本若指向不存在的 npm-cli.js，先检查 `Get-Command node,npm` 与 Node 安装。可临时使用 `node <Node安装目录>/node_modules/npm/bin/npm-cli.js ci`。单独验证已有依赖时也可用 `node --test --test-concurrency=1 tests/*.test.mjs` 和 `node node_modules/vite/bin/vite.js build`。

仅在全局缓存无写权限时使用 `npm ci --cache ./.npm-cache`。无需在构建前手动删除 dist，也不要通过跨 shell 删除命令规避权限问题。

## 环境配置

复制 `.env.example` 为 `.env.local`，修改后重启开发服务；生产的 `VITE_*` 值在构建时固化。

| 配置 | 默认值 | 用途 |
| --- | --- | --- |
| `API_TARGET` | `http://localhost:5200` | Vite 开发代理目标 |
| `VITE_API_BASE` | `/api` | 浏览器 API 前缀，完整 URL 应包含 `/api` |
| `VITE_DEMO_MODE` | `false` | 只有显式设为 `true` 才展示平台样例 |

开发时 `/api/*` 经 Vite 代理；例如 PowerShell：

```powershell
$env:API_TARGET = 'http://localhost:5000'
npm run dev
```

旧版保存在 `localStorage.apiBaseOverride` 的地址优先于环境变量。切换环境时需检查此覆盖值。当前工作台没有后端地址编辑入口。

## 功能与边界

| 模块 | 当前前端能力 |
| --- | --- |
| 分析 | 上传文件、粘贴文本、样例、规则校验、预检、同步与异步任务 |
| 质量 | 总览、趋势、字段质量、问题筛选、基线展示、告警启停 |
| 洞察 | 字段关系、对象关联、Schema、血缘、影响、建议与回归展示；依赖部署支持 |
| 规则 | JSONC 与可视化编辑、字段校验、转换、PII、valueParsers、expectations |
| 导出 | JSON、CSV、Markdown、HTML、JSON Schema、Excel；当前没有 PDF 导出入口 |
| 界面 | 中英文、系统／浅色／深色／护眼主题、键盘弹窗与侧栏调宽、窄屏布局 |

可选择 JSON、JSONL、CSV、Excel、XML、YAML、TXT、ZIP、GZ 等文件；具体解析格式和压缩包能力以配套后端为准。前端不包含该后端服务。

文件达到 2 MiB 时默认使用后台任务，也可强制异步。SSE 不可用或断连时回退轮询。取消提交会等待返回的 jobId 后补发取消；离开页面只停止本地跟踪，保留后端长任务。若网络中断导致 jobId 未返回，前端无法单独保证服务端任务已取消。

API 成功且没有数据时展示空态；接口未实现和请求失败分别记录状态，不会自动补入演示指标。演示模式主要覆盖平台总览、趋势、字段、问题、基线与告警样例；分析工作台仍依赖后端。后端明确声明能力为 false 时，对应导航和页面禁用；旧后端没有能力接口时继续兼容探测。

CSV 导出会在以公式符号开头的文本前增加单引号，防止表格软件执行公式；原始 JSON 导出不修改文本。超大报告的浏览器导出资源消耗，以及不同表格软件对文本的显示行为，需要结合真实数据验证。

## 代码结构

```text
src/
  main.jsx / App.jsx        应用入口、按页面懒加载的路由
  layout/                  页面框架
  pages/                   平台业务页面
  workbench/               工作台编排与展示布局
  hooks/                   规则、预检、分析、导出、焦点与请求生命周期
  api/                     HTTP、分析接口、平台接口与兼容路径探测
  lib/                     平台聚合、状态、规范化、主题、能力与多语言
  adapter.js               分析响应到展示模型的适配
  exporters.js              文本报告和 Schema 生成
  styles/index.css          样式总入口及覆盖顺序
public/                    图标等静态文件
scripts/                   源码检查与构建体积检查
tests/                     Node test runner 业务回归
.github/workflows/ci.yml    安装、检查、测试、构建与体积预算
```

主题运行时由 `theme-controller` 管理，首屏由 index.html 预置；测试约束两者模式解析一致。产品主题令牌位于 `styles/product.css`，旧组件兼容令牌位于 `styles.css`；图表配色位于 `theme.js`。旧工作台覆盖文件已停用，保留文件不代表仍在加载。

## 进一步阅读

- [使用指南](docs/user-guide.md)
- [生产部署与验收](docs/deployment.md)
- [API 对接契约与待联调项](docs/frontend-api-gaps.md)
- [优化清单与实施记录](docs/project-optimization-plan.md)

本次已验证前端回归、构建、首屏体积，以及英文工作台、弹窗焦点和 390px 布局。真实后端写入、服务端能力和生产反向代理仍需目标环境联调；CI 文件已加入仓库，远端执行结果需推送后查看。
