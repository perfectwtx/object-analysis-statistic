import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { download, toCsv, toHtml, toJson, toJsonSchema, toMarkdown } from './exporters.js';
import { analyzeFile, fetchRulesReference, getBaseUrl, health, preflight, runAsyncJob, setBaseUrl, validateRules } from './api.js';
import { adaptAnalysisResponse } from './adapter.js';
import { computeRuleFieldWarning, formatRulesError, parseJsonc, toBackendRulesText } from './utils.js';
import { SAMPLE_DATA } from './sampleData.js';
import OverviewCards from './components/OverviewCards.jsx';
import CoverageChart from './components/CoverageChart.jsx';
import TypeChart from './components/TypeChart.jsx';
import FieldTable from './components/FieldTable.jsx';
import PreviewTable from './components/PreviewTable.jsx';
import ValueDistribution from './components/ValueDistribution.jsx';
import RulesEditor, { RULES_TEMPLATE } from './components/RulesEditor.jsx';
import FieldRulesModal from './components/FieldRulesModal.jsx';
import PasteModal from './components/PasteModal.jsx';
import QualityPanel from './components/QualityPanel.jsx';
import InsightsPanel from './components/InsightsPanel.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import ThemeSwitch from './components/ThemeSwitch.jsx';

// 说明：所有统计均由 ObjectAnalyzer.Api（.NET）计算，浏览器端不做任何数据分析。

const TABS = [
  { key: 'preview', label: '数据预览' },
  { key: 'fields', label: '字段明细' },
  { key: 'insights', label: '深度分析' },
  { key: 'values', label: '取值分布' },
  { key: 'quality', label: '质量报告' },
];

// 异步作业的等待上限：与后端 AnalysisJobRegistry 的 5 分钟保留窗口对齐
const JOB_WAIT_TIMEOUT = 300_000;

const EXPORT_FORMATS = [
  { key: 'json', label: 'JSON 报告', ext: 'json', mime: 'application/json', gen: (r) => toJson(r) },
  { key: 'csv', label: 'CSV 报告', ext: 'csv', mime: 'text/csv', gen: (r) => toCsv(r) },
  { key: 'md', label: 'Markdown 报告', ext: 'md', mime: 'text/markdown', gen: (r, n) => toMarkdown(r, n) },
  { key: 'html', label: 'HTML 报告', ext: 'html', mime: 'text/html', gen: (r, n) => toHtml(r, n) },
  { key: 'xlsx', label: 'Excel 报告', ext: 'xlsx' },
  { key: 'pdf', label: 'PDF 报告（打印）', ext: 'pdf' },
  { key: 'schema', label: 'JSON Schema', ext: 'schema.json', mime: 'application/json', gen: (r) => toJsonSchema(r) },
];

const EMPTY_INSIGHTS = {
  correlations: { fields: [], pairs: [], strongPairs: [] },
  patterns: {},
  hygiene: {},
  fuzzy: { groups: [], groupCount: 0, similarDuplicates: 0, totalSamples: 0, uniqueCanonical: 0 },
};

// P4 深度分析开关：交给后端计算，未开启的项前端不再补算
const FEATURE_DEFS = [
  { key: 'enableCorrelation', label: '字段相关性' },
  { key: 'enableStringPatterns', label: '字符串模式' },
  { key: 'enableUnicodeHygiene', label: 'Unicode 卫生' },
  { key: 'enableTimeSeries', label: '时间序列' },
  // 分布快照依赖 CLI 的 --snapshot 输出文件，API 不会在响应里返回，故置灰
  { key: 'enableDistributionSnapshot', label: '分布快照', cliOnly: true },
];

const DEFAULT_FEATURES = {
  enableCorrelation: true,
  enableStringPatterns: true,
  enableUnicodeHygiene: true,
  enableTimeSeries: false,
  enableDistributionSnapshot: false,
};

function loadFeatures() {
  try {
    const saved = JSON.parse(localStorage.getItem('apiFeatures'));
    return saved ? { ...DEFAULT_FEATURES, ...saved } : DEFAULT_FEATURES;
  } catch {
    return DEFAULT_FEATURES;
  }
}

export default function App() {
  const [source, setSource] = useState(null); // { file, name }
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [rulesText, setRulesText] = useState(RULES_TEMPLATE);
  const [rules, setRules] = useState(null);
  const [rulesError, setRulesError] = useState('');
  // 规则校验结果：{ state: 'checking' | 'ok' | 'error' | 'offline', message?, fields? }
  const [rulesCheck, setRulesCheck] = useState(null);
  const [tab, setTab] = useState('fields');
  const [textFormat, setTextFormat] = useState('json');
  // 「粘贴数据」弹窗（格式选择与「格式化」都在弹窗里）
  const [pasteOpen, setPasteOpen] = useState(false);
  const fileInput = useRef(null);
  // 分析请求的中止控制器与取消标记：busy 时提供「取消」按钮真实中止 fetch
  const abortRef = useRef(null);
  const cancelledRef = useRef(false);

  // 分析结果与后端状态
  const [result, setResult] = useState(null);
  const [apiState, setApiState] = useState({ status: 'unknown', version: null, error: null });
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(null);
  // 异步作业进度：{ processedObjects, status }，由 SSE 推送（断流时前端轮询兜底）
  const [progress, setProgress] = useState(null);
  // 方案 B：预检命中「用错规则文件」时挂起的确认弹框与待执行分析参数
  const [preflightModal, setPreflightModal] = useState(null); // { ruleFields, sampleFields, truncated }
  // 字段规则可视化配置弹窗
  const [fieldRulesOpen, setFieldRulesOpen] = useState(false);
  const [fieldRulesSource, setFieldRulesSource] = useState('analysis'); // 'preflight' | 'analysis'
  const [fieldRulesFields, setFieldRulesFields] = useState([]); // [{ name, stat? }]
  const [pendingRun, setPendingRun] = useState(null); // { src, opts }
  const [baseUrlInput, setBaseUrlInput] = useState(() => getBaseUrl());
  const [features, setFeatures] = useState(loadFeatures);

  const toggleFeature = (key) => {
    setFeatures((f) => {
      const next = { ...f, [key]: !f[key] };
      localStorage.setItem('apiFeatures', JSON.stringify(next));
      return next;
    });
  };

  // 边栏宽度拖拽（持久化到 localStorage）
  const [sidebarW, setSidebarW] = useState(() => {
    const saved = Number(localStorage.getItem('sidebarW'));
    return saved >= 240 && saved <= 640 ? saved : 330;
  });
  const dragState = useRef(null);

  const onResizeStart = (e) => {
    e.preventDefault();
    dragState.current = { startX: e.clientX, startW: sidebarW };
    document.body.classList.add('col-resizing');
    const onMove = (ev) => {
      const { startX, startW } = dragState.current;
      const w = Math.min(640, Math.max(240, startW + ev.clientX - startX));
      setSidebarW(w);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.classList.remove('col-resizing');
      setSidebarW((w) => { localStorage.setItem('sidebarW', String(w)); return w; });
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // ---------- 深度分析：全部取自后端响应，缺失即未开启 ----------
  const deepInsights = useMemo(() => {
    if (!result) return null;
    const d = result.deep || {};
    return {
      correlations: d.correlations || EMPTY_INSIGHTS.correlations,
      patterns: d.patterns || EMPTY_INSIGHTS.patterns,
      hygiene: d.hygiene || EMPTY_INSIGHTS.hygiene,
      fuzzy: d.fuzzy || EMPTY_INSIGHTS.fuzzy,
      timeSeries: result.apiExtras?.timeSeriesAnalyses || null,
    };
  }, [result]);

  const violationCount = result?.qualityViolations?.length ?? 0;

  // ---------- 方案 D：分析完成后再次校验规则字段是否命中数据字段（对齐后端 ResultWarning） ----------
  // 复刻后端 ObjectAnalyzer.Web 的"兜底"防御：规则里配置的字段若在分析结果中一个都没出现，
  // 大概率是"用错了规则文件"（规则与数据不匹配）。直接展示横幅提示，避免用户误以为分析成功。
  // 判定语义与后端 PreflightChecker.Build 完全一致（大小写不敏感 + 父路径匹配）。
  const ruleFieldWarning = useMemo(() => {
    if (!result || !rules) return null;
    const ruleFields = Object.keys(rules.fields || {});
    const dataFields = result.fieldStatistics.map((f) => f.fieldName);
    const w = computeRuleFieldWarning(ruleFields, dataFields);
    return w.hasWarning ? w : null;
  }, [result, rules]);

  // ---------- 后端健康检查 ----------
  const checkApi = useCallback(async () => {
    setApiState({ status: 'checking', version: null, error: null });
    try {
      const h = await health();
      setApiState({ status: 'ok', version: h?.version ?? null, error: null });
    } catch (e) {
      setApiState({ status: 'error', version: null, error: e.message });
    }
  }, []);

  useEffect(() => { checkApi(); }, [checkApi]);

  // ---------- 分析（全部由后端执行） ----------
  // 实际发起分析请求。预检通过 / 无规则 / 无命中后都会走到这里；
  // 预检弹框「仍然继续分析」也是调用它（沿用挂起的 opts）。
  //
  // 走异步作业接口：提交即返回 jobId，进度由 SSE 推送，终态后拉结果。
  // 相比同步 /api/analyze 有两个实打实的好处：
  //   1. 大文件不会卡在代理/网关的超时上，中途还能看到已处理条数；
  //   2. 取消会打到 /cancel 真正中止后端计算（同步接口 abort 只是断开连接，后端照算不误）。
  const executeAnalysis = useCallback(async (src, opts) => {
    if (!src?.file) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    cancelledRef.current = false;
    setBusy(true);
    setError('');
    setProgress({ processedObjects: 0, status: 'Running' });
    const t0 = performance.now();
    try {
      let payload;
      try {
        payload = await runAsyncJob(src.file, opts, {
          onProgress: setProgress,
          signal: ctrl.signal,
          timeout: JOB_WAIT_TIMEOUT,
        });
      } catch (e) {
        // 后端仍是旧版（没有 /analyze/async）时退回同步接口，不至于整个用不了。
        // 只认 HTTP 404 —— 其它错误（规则 400、解析失败等）照常抛给用户。
        if (!/HTTP 404/.test(e.message)) throw e;
        payload = await analyzeFile(src.file, { ...opts, request: { signal: ctrl.signal } });
      }
      const adapted = adaptAnalysisResponse(payload);
      adapted._api.elapsedMs = Math.round(performance.now() - t0);
      adapted._api.bytes = src.file.size ?? null;
      setResult(adapted);
      setElapsed(adapted._api.elapsedMs);
      setApiState((s) => (s.status === 'ok' ? s : { ...s, status: 'ok', error: null }));
    } catch (e) {
      if (cancelledRef.current || /已取消/.test(e.message)) setError('已取消分析');
      else setError(`分析失败：${e.message}`);
      setResult(null);
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null;
      setBusy(false);
      setProgress(null);
    }
  }, []);

  // 分析进行中点击「取消」：中止底层 fetch（runAsyncJob 会连带调用 /cancel 让后端停手）
  const cancelAnalysis = () => {
    cancelledRef.current = true;
    abortRef.current?.abort();
  };

  // 分析入口：先做「方案 B」预检，规则字段与数据零重叠则弹确认框，用户确认后再真正分析。
  // rulesOverride：applyRules 里刚解析出来的规则还没进 state，需要显式传进来，
  // 否则「应用规则」第一次点击会因为闭包里的 rules 仍是旧值而漏发规则。
  const runAnalysis = useCallback(async (src, rulesJsonText, rulesOverride) => {
    if (!src?.file) return;
    const activeRules = rulesOverride !== undefined ? rulesOverride : rules;
    // 新后端把 flatten/selectedFields/filter 从规则顶层迁到了 runtime.*，
    // 旧式顶层写法会被判为未知键（valid:false）阻断分析。这里剥离后改走请求选项，
    // 同时兼容用户在规则里直接写 runtime.* 的新式写法。
    const { flatten, selectedFields, filter, ...ruleBody } = activeRules || {};
    const rulesJson = activeRules ? JSON.stringify(ruleBody) : null;
    const opts = {
      // ruleBody 已是解析后的纯对象（注释/尾随逗号在 checkRules 阶段已清掉），
      // 直接 JSON.stringify 即可；绝不能传 toJsonText(object) —— 它会把对象当成 JSONC
      // 文本去 JSON.parse，失败回退后 FormData 把对象压成 "[object Object]"，
      // 后端反序列化直接报「could not be converted to AnalysisRules」。
      rulesJson,
      flatten,
      fields: selectedFields?.join(','),
      filter,
      features,
    };

    // 方案 B：只要应用了规则（rulesJson 非空）就先预检。
    // 不再要求规则必须有显式 fields —— 用 transform / runtime 描述字段的规则（如 Logs 规则）
    // 同样该被拦截。后端 PreflightChecker 在规则没有任何可校验字段时会返回 hasWarning=false，
    // 不会误报，所以放宽到"有规则即预检"是安全的。
    if (rulesJson) {
      try {
        const pf = await preflight(src.file, { rulesJson, flatten });
        if (pf?.hasWarning) {
          setPreflightModal({
            ruleFields: pf.ruleFields ?? [],
            sampleFields: pf.sampleFields ?? [],
            truncated: pf.truncatedSampleFieldCount ?? 0,
          });
          setPendingRun({ src, opts });
          return;
        }
      } catch {
        // 预检异常（后端离线 / 规则解析失败等）不阻断分析；方案 D 结果横幅兜底
      }
    }

    await executeAnalysis(src, opts);
  }, [rules, features, executeAnalysis]);

  // 预检弹框：确认继续 → 消费挂起参数立即分析；取消 → 仅关闭，引导去侧栏换规则
  const confirmPreflight = () => {
    const pending = pendingRun;
    setPreflightModal(null);
    setPendingRun(null);
    if (pending) executeAnalysis(pending.src, pending.opts);
  };
  const cancelPreflight = () => {
    setPreflightModal(null);
    setPendingRun(null);
  };

  // ---------- 规则校验 ----------
  // 两段式：先本地查语法（能给出编辑器里的行列），再交后端查结构与类型。
  // 后端是权威 —— 像 "minValue": "abc" 这种类型写错，本地 JSON.parse 是放行的，
  // 只有后端的 AnalysisRules 反序列化会拒绝。
  // 后端还会返回 unknowns：写了但它不认识的键（拼错/已废弃），反序列化时被静默忽略。
  // 这类问题与类型错误同等对待 —— 一律判失败并阻断分析：留着跑出来的结果看着正常，
  // 实则那条规则压根没生效，比直接报错更难发现。
  const checkRules = useCallback(async (text) => {
    if (!text?.trim()) {
      setRulesCheck(null);
      return { ok: true, empty: true };
    }
    let parsed;
    try {
      parsed = parseJsonc(text);
    } catch (e) {
      setRulesCheck({ state: 'error', message: e.message, source: 'local' });
      return { ok: false, message: e.message };
    }

    setRulesCheck({ state: 'checking' });
    const r = await validateRules(toBackendRulesText(text));

    if (r.ok) {
      setRulesCheck({ state: 'ok', fields: r.fields });
      return { ok: true, parsed, fields: r.fields, unknowns: r.unknowns };
    }
    if (r.offline) {
      // 后端不可用时降级：语法已确认合法，但没经过结构/类型校验，要明确告知
      setRulesCheck({ state: 'offline' });
      return { ok: true, parsed, degraded: true };
    }
    // 未知键由后端直接给出中文说明；其余是反序列化错误，需翻译
    const unknowns = r.unknowns || [];
    const message = unknowns.length
      ? r.error || `有 ${unknowns.length} 个规则名不被后端识别`
      : formatRulesError(r.error);
    setRulesCheck({
      state: 'error',
      message,
      fields: r.fields,
      unknowns: unknowns.length ? unknowns : undefined,
      source: 'backend',
    });
    return { ok: false, message };
  }, []);

  const applyRules = async () => {
    const check = await checkRules(rulesText);
    if (!check.ok) {
      // 具体错误已由校验状态条展示，这里只说明后果
      setRulesError('规则未通过校验，已取消分析');
      return;
    }
    if (check.empty) {
      setRules(null);
      setRulesError('');
      return;
    }
    setRules(check.parsed);
    setRulesError('');
    if (source) await runAnalysis(source, rulesText, check.parsed);
  };

  const clearRules = () => {
    setRules(null);
    setRulesError('');
    setRulesCheck(null);
    if (source) runAnalysis(source, null);
  };

  // ---------- 字段级规则可视化配置 ----------
  // 打开弹窗：根据来源提供字段列表（preflight 用样本字段名，analysis 用结果字段含元数据）
  const openFieldRules = useCallback((src) => {
    if (src === 'preflight') {
      const names = preflightModal?.sampleFields ?? [];
      setFieldRulesFields(names.map((name) => ({ name })));
      setFieldRulesSource('preflight');
    } else {
      const stats = result?.fieldStatistics ?? [];
      setFieldRulesFields(stats.map((f) => ({ name: f.fieldName, stat: f })));
      setFieldRulesSource('analysis');
    }
    setFieldRulesOpen(true);
  }, [preflightModal, result]);

  // 弹窗确认：写回规则文本并触发后端校验，返回是否通过（不通过则弹窗保持打开）
  const applyFieldRules = useCallback(async (text) => {
    setRulesText(text);
    setRulesError('');
    const res = await checkRules(text);
    return res.ok;
  }, [checkRules]);

  // ---------- 数据源载入 ----------
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const src = { file, name: file.name };
    setSource(src);
    setFileName(file.name);
    setError('');
    await runAnalysis(src, rulesText);
  };

  // 粘贴弹窗「确定」：按所选格式包装成文件提交，后缀决定后端的解析格式
  const submitPaste = (text) => {
    setPasteOpen(false);
    const name = `粘贴的数据（${textFormat}）`;
    setFileName(name);
    setError('');
    const file = new File([text], `pasted.${textFormat}`, { type: 'text/plain' });
    const src = { file, name };
    setSource(src);
    runAnalysis(src, rulesText);
  };

  const loadSample = async () => {
    setFileName('内置样例数据');
    setError('');
    const file = new File([JSON.stringify(SAMPLE_DATA)], 'sample.json', { type: 'application/json' });
    const src = { file, name: '内置样例数据' };
    setSource(src);
    await runAnalysis(src, rulesText);
  };

  const fetchReference = async () => {
    try {
      const ref = await fetchRulesReference();
      const text = typeof ref === 'string' ? ref : JSON.stringify(ref, null, 2);
      setRulesText(text);
      setRulesError('');
      // 模板本身是 JSONC，顺手验一遍，确认能直接提交给后端
      await checkRules(text);
    } catch (e) {
      setRulesError(`拉取参考模板失败：${e.message}`);
    }
  };

  // ---------- 导出 ----------
  const [exportOpen, setExportOpen] = useState(false);
  const exportReport = async (fmt) => {
    setExportOpen(false);
    if (fmt.key === 'xlsx') {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      const fieldRows = result.fieldStatistics.map((f) => ({
        字段名: f.fieldName,
        覆盖率: +(f.coverage * 100).toFixed(1),
        主导类型: f.primaryType,
        类型分布: Object.entries(f.typeCounts).map(([t, c]) => `${t}:${c}`).join(' '),
        唯一值: f.distinctCount,
        出现次数: f.count,
        默认值: f.defaultValue ?? '',
        语义类型: f.semanticType ?? '',
        P50: f.median ?? '', P90: f.p90 ?? '', P95: f.p95 ?? '', P99: f.p99 ?? '',
        异常值: f.outlierCount ?? '',
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fieldRows), '字段统计');
      if (result.qualityViolations?.length) {
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(result.qualityViolations.map((v) => ({
            字段: v.field || '（数据集）', 检查项: v.check, 违规数: v.count, 说明: v.message,
          }))),
          '质量违规'
        );
      }
      XLSX.writeFile(wb, 'report.xlsx');
      return;
    }
    if (fmt.key === 'pdf') {
      const w = window.open('', '_blank');
      if (!w) { setError('浏览器拦截了弹出窗口，请允许弹出后重试'); return; }
      w.document.write(toHtml(result, fileName) + '<script>window.onload=function(){window.print()}<\/script>');
      w.document.close();
      return;
    }
    download(fmt.gen(result, fileName), `report.${fmt.ext}`, fmt.mime);
  };

  const apiReady = apiState.status === 'ok';
  const kb = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);

  return (
    <div className="workbench">
      {/* ---------- 左侧边栏 ---------- */}
      <aside className="sidebar" style={{ width: sidebarW }}>
        <div className="brand">
          <div className="logo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ stroke: 'var(--on-gradient)' }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18" /><path d="M7 15l4-6 4 3 5-8" />
            </svg>
          </div>
          <div>
            <div className="brand-name">对象分析统计</div>
            <div className="brand-sub">Object Analyzer</div>
          </div>
        </div>

        {/* ---------- 后端状态 ---------- */}
        <div className="side-section">
          <div className="side-title">分析后端</div>
          <div className={`api-status ${apiState.status}`}>
            <span className="api-dot" />
            {apiState.status === 'checking' && <span>正在连接后端…</span>}
            {apiState.status === 'ok' && (
              <span>后端就绪{apiState.version ? ` · v${apiState.version}` : ''}</span>
            )}
            {apiState.status === 'error' && (
              <span className="api-err">
                {apiState.error}
                <button type="button" className="btn-link" onClick={checkApi}>重试</button>
              </span>
            )}
              <details className="api-features">
                <summary>深度分析（P4）</summary>
                <div className="feature-list">
                  {FEATURE_DEFS.map((fd) => (
                    <label
                      key={fd.key}
                      className={`feature-item ${fd.cliOnly ? 'disabled' : ''}`}
                      title={fd.cliOnly ? 'API 不在响应中返回分布快照（需 CLI 的 --snapshot 导出文件），此项对接口无效' : ''}
                    >
                      <input
                        type="checkbox"
                        checked={!!features[fd.key]}
                        disabled={fd.cliOnly}
                        onChange={() => toggleFeature(fd.key)}
                      />
                      {fd.label}
                      {fd.cliOnly && <span className="cli-tag">仅 CLI</span>}
                    </label>
                  ))}
                </div>
                <div className="api-hint">
                  未开启的项不会返回数据，前端不再本地补算。改动后需重新分析。
                </div>
              </details>

              <details className="api-base">
                <summary>后端地址</summary>
                <input
                  className="base-input mono"
                  value={baseUrlInput}
                  onChange={(e) => setBaseUrlInput(e.target.value)}
                  onBlur={() => { setBaseUrl(baseUrlInput); checkApi(); }}
                  spellCheck={false}
                />
                <div className="api-hint">
                  默认 /api 走 Vite 代理（→ http://localhost:5200）。直连请填完整地址，如 http://localhost:5200/api
                </div>
              </details>
          </div>
        </div>

        {/* ---------- 数据源 ---------- */}
        <div className="side-section">
          <div className="side-title">数据源</div>
          <div className="source-current" title={fileName}>
            <span className="source-dot" />
            <span className="mono source-name">{fileName || '未选择'}</span>
          </div>
          {error && <div className="error side-error">{error}</div>}
          <div className="side-actions">
            <button className="btn primary block" onClick={() => fileInput.current?.click()} disabled={busy}>
              {busy ? '分析中…' : '上传文件'}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".json,.jsonl,.txt,.csv,.xml,.yaml,.yml,.xlsx,.xls,.gz,.zip"
              hidden
              onChange={onFile}
            />
            <div className="btn-row">
              <button className="btn half" onClick={() => setPasteOpen(true)} disabled={busy}>粘贴数据</button>
              <button className="btn half" onClick={loadSample} disabled={busy}>加载样例</button>
            </div>
            <button
              className="btn block"
              onClick={() => source && runAnalysis(source, rulesText)}
              disabled={busy || !source}
              title="按当前开关与规则重新提交分析"
            >
              重新分析
            </button>
          </div>
        </div>

        {/* ---------- 规则配置 ---------- */}
        <div className="side-section grow">
          <div className="side-title">
            规则配置
            {rules && <span className="badge semantic rules-on">已生效</span>}
            <button
              className="btn link sm"
              onClick={() => openFieldRules('analysis')}
              title="可视化配置规则：全局 runtime / expectations、值解析，以及逐字段类型·转换·质量检查·PII（含规则框里已配置的字段）"
            >
              配置
            </button>
          </div>
          <RulesEditor
            text={rulesText}
            setText={setRulesText}
            error={rulesError}
            check={rulesCheck}
            onValidate={(t) => checkRules(t ?? rulesText)}
            onApply={applyRules}
            onClear={clearRules}
            onFetchReference={fetchReference}
            applied={!!rules}
            busy={busy}
          />
        </div>

        {/* ---------- 导出 ---------- */}
        <div className="side-footer">
          <div className="export-wrap">
            <button className="btn block" onClick={() => setExportOpen(!exportOpen)} disabled={!result}>
              导出报告 / Schema ▾
            </button>
            {exportOpen && result && (
              <>
                <div className="export-mask" onClick={() => setExportOpen(false)} />
                <div className="export-menu">
                  {EXPORT_FORMATS.map((f) => (
                    <button key={f.key} className="export-item" onClick={() => exportReport(f)}>
                      {f.label}
                      <span className="export-ext">.{f.ext}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* ---------- 拖拽手柄 ---------- */}
      <div className="resize-handle" onMouseDown={onResizeStart} title="拖拽调整边栏宽度" />

      {/* ---------- 主内容区 ---------- */}
      <main className="main">
        <div className="topbar">
          <div>
            <h1>分析概览</h1>
            <p className="subtitle">由 ObjectAnalyzer.Api（.NET）执行分析</p>
          </div>
          <div className="topbar-status">
            {busy && (
              <span className="busy-indicator">
                <span className="spinner" />
                {progress?.processedObjects > 0
                  ? `已处理 ${progress.processedObjects.toLocaleString()} 条…`
                  : '提交中…'}
                <button type="button" className="btn-link danger" onClick={cancelAnalysis}>取消</button>
              </span>
            )}
            {!busy && elapsed != null && (
              <span className="chip api-chip" title="本次分析从提交到拿到结果的端到端耗时">
                耗时 {(elapsed / 1000).toFixed(2)}s
                {result?._api?.bytes != null ? ` · ${kb(result._api.bytes)}` : ''}
              </span>
            )}
            {!busy && apiReady && result?._api?.format && (
              <span className="chip api-chip">
                {result._api.format}
                {result._api.rulesSource ? ` · 规则(${result._api.rulesSource})` : ''}
              </span>
            )}
            {rules && (
              <span className={`quality-status ${violationCount === 0 ? 'pass' : 'fail'}`}>
                {violationCount === 0 ? '✓ 质量校验 PASS' : `✗ ${violationCount} 项违规`}
              </span>
            )}
          </div>
          <ThemeSwitch />
        </div>

        {result && (
          <>
            {ruleFieldWarning && (
              <div className="rule-warning" role="alert">
                <div className="rule-warning-title">⚠ 规则字段与数据字段零重叠</div>
                <div className="rule-warning-text">
                  当前规则配置的字段（{ruleFieldWarning.ruleFields.join('、')}）在分析结果中没有任何命中，
                  可能用错了规则文件（规则与数据不匹配）。请确认左侧「规则配置」是否为该数据对应的规则后重新分析。
                </div>
                <details className="rule-warning-detail">
                  <summary>查看字段明细</summary>
                  <div className="rule-warning-cols">
                    <div>
                      <div className="rw-col-title">规则字段</div>
                      <ul>
                        {ruleFieldWarning.ruleFields.map((f) => <li key={f} className="mono">{f}</li>)}
                      </ul>
                    </div>
                    <div>
                      <div className="rw-col-title">数据字段（前 {Math.min(ruleFieldWarning.dataFields.length, 20)} 个）</div>
                      <ul>
                        {ruleFieldWarning.dataFields.slice(0, 20).map((f) => <li key={f} className="mono">{f}</li>)}
                      </ul>
                    </div>
                  </div>
                  {ruleFieldWarning.dataFields.length > 20 && (
                    <div className="rw-trunc">…共 {ruleFieldWarning.dataFields.length} 个数据字段</div>
                  )}
                </details>
              </div>
            )}
            <OverviewCards result={result} />
            <div className="charts">
              <CoverageChart fields={result.fieldStatistics} />
              <TypeChart fields={result.fieldStatistics} />
            </div>

            <div className="panel tabs-panel">
              <div className="tabs">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    className={`tab ${tab === t.key ? 'active' : ''}`}
                    onClick={() => setTab(t.key)}
                  >
                    {t.label}
                    {t.key === 'quality' && rules && violationCount > 0 && (
                      <span className="tab-badge">{violationCount}</span>
                    )}
                  </button>
                ))}
              </div>
              <div className="tab-content">
                {/* 单个标签页渲染出错时只影响该标签页；key 保证切换标签会重置错误状态 */}
                <ErrorBoundary key={tab}>
                  {tab === 'preview' && <PreviewTable preview={result.preview} bare />}
                  {tab === 'fields' && (
                    <FieldTable
                      fields={result.fieldStatistics}
                      rules={rules}
                      totalObjects={result.totalObjects}
                      bare
                    />
                  )}
                  {tab === 'insights' && deepInsights && (
                    <InsightsPanel
                      result={result}
                      insights={deepInsights}
                      features={features}
                      fileName={fileName}
                    />
                  )}
                  {tab === 'values' && <ValueDistribution fields={result.fieldStatistics} bare />}
                  {tab === 'quality' && (
                    rules
                      ? <QualityPanel violations={result.qualityViolations || []} bare />
                      : <div className="empty-tab">尚未应用规则。在左侧边栏配置规则后，这里会显示质量校验报告。</div>
                  )}
                </ErrorBoundary>
              </div>
            </div>
          </>
        )}

        {!result && !busy && (
          <div className="empty-tab">
            {apiState.status === 'error'
              ? '后端未连接。请启动 ObjectAnalyzer.Api 后点击重试。'
              : '选择数据源后由后端执行分析（上传文件 / 粘贴数据 / 加载样例）。'}
          </div>
        )}
      </main>

      {/* ---------- 粘贴数据弹窗 ---------- */}
      <PasteModal
        open={pasteOpen}
        format={textFormat}
        onFormatChange={setTextFormat}
        busy={busy}
        onClose={() => setPasteOpen(false)}
        onSubmit={submitPaste}
      />

      {/* ---------- 方案 B：用错规则文件预检确认框（分析前拦截） ---------- */}
      {preflightModal && (
        <div className="preflight-backdrop" role="dialog" aria-modal="true" aria-labelledby="pf-title">
          <div className="preflight-modal">
            <h3 id="pf-title" className="preflight-title">⚠ 规则与数据可能不匹配</h3>
            <p className="preflight-explain">
              规则里配置的字段，在前几条数据记录中<strong>一个都没匹配上</strong>，可能是
              <strong>用错了规则文件</strong>（规则与本数据不对应）。请确认左侧「规则配置」是否为该数据对应的规则：
            </p>
            <div className="preflight-fields">
              <div className="preflight-col">
                <div className="preflight-col-title">规则字段（{preflightModal.ruleFields.length}）</div>
                {preflightModal.ruleFields.length === 0 ? (
                  <span className="preflight-empty">—</span>
                ) : (
                  <ul className="preflight-chips">
                    {preflightModal.ruleFields.map((f) => (
                      <li key={f} className="preflight-chip rule-chip"><code>{f}</code></li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="preflight-col">
                <div className="preflight-col-title">
                  数据样本字段（{preflightModal.sampleFields.length}
                  {preflightModal.truncated > 0 ? `，已截断 +${preflightModal.truncated}` : ''}）
                </div>
                {preflightModal.sampleFields.length === 0 ? (
                  <span className="preflight-empty">—</span>
                ) : (
                  <ul className="preflight-chips">
                    {preflightModal.sampleFields.map((f) => (
                      <li key={f} className="preflight-chip sample-chip"><code>{f}</code></li>
                    ))}
                  </ul>
                )}
                {preflightModal.truncated > 0 && (
                  <p className="preflight-hint">仅展示前 {preflightModal.sampleFields.length} 个样本字段，其余 {preflightModal.truncated} 个已省略。</p>
                )}
              </div>
            </div>
            <div className="preflight-actions">
              <button className="btn primary" onClick={confirmPreflight}>仍然继续分析</button>
              <button className="btn outline" onClick={cancelPreflight}>取消并修改规则</button>
              <button
                className="btn outline"
                onClick={() => { setPreflightModal(null); openFieldRules('preflight'); }}
                title="打开可视化规则配置（样本字段 + 规则里已配置的字段）"
              >
                打开规则配置
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- 字段级规则可视化配置弹窗 ---------- */}
      <FieldRulesModal
        open={fieldRulesOpen}
        source={fieldRulesSource}
        inputFormat={fieldRulesSource === 'analysis'
          ? (result?._api?.format ?? '')
          : (() => {
              const name = source?.file?.name?.toLowerCase() ?? '';
              if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.xlsm')) return 'excel';
              if (name.endsWith('.csv')) return 'csv';
              return '';
            })()}
        fields={fieldRulesFields}
        rulesText={rulesText}
        onApply={applyFieldRules}
        onClose={() => setFieldRulesOpen(false)}
      />
    </div>
  );
}
