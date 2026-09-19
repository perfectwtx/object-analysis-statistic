import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { download, toCsv, toHtml, toJson, toJsonSchema, toMarkdown } from '../exporters.js';
import {
  fetchRulesReference,
  preflight,
  validateRules,
  ASYNC_THRESHOLD_BYTES,
} from '../api/index.js';
import { useAsyncAnalyze } from '../hooks/useAsyncAnalyze.js';
import JobProgress from '../components/JobProgress.jsx';
import { computeRuleFieldWarning, formatRulesError, parseJsonc, toBackendRulesText } from '../utils.js';
import { SAMPLE_DATA } from '../sampleData.js';
import OverviewCards from '../components/OverviewCards.jsx';
import CoverageChart from '../components/CoverageChart.jsx';
import TypeChart from '../components/TypeChart.jsx';
import FieldTable from '../components/FieldTable.jsx';
import ValueDistribution from '../components/ValueDistribution.jsx';
import RulesEditor, { RULES_TEMPLATE } from '../components/RulesEditor.jsx';
import QualityPanel from '../components/QualityPanel.jsx';
import InsightsPanel from '../components/InsightsPanel.jsx';
import ErrorBoundary from '../components/ErrorBoundary.jsx';

const TABS = [
  { key: 'fields', label: '字段明细' },
  { key: 'insights', label: '深度分析' },
  { key: 'values', label: '取值分布' },
  { key: 'quality', label: '质量报告' },
];
const TEXT_FORMATS = ['json', 'jsonl', 'csv', 'yaml', 'xml'];
const EMPTY_INSIGHTS = {
  correlations: { fields: [], pairs: [], strongPairs: [] },
  patterns: {}, hygiene: {},
  fuzzy: { groups: [], groupCount: 0, similarDuplicates: 0, totalSamples: 0, uniqueCanonical: 0 },
};
const FEATURE_DEFS = [
  { key: 'enableCorrelation', label: '字段相关性' },
  { key: 'enableStringPatterns', label: '字符串模式' },
  { key: 'enableUnicodeHygiene', label: 'Unicode 卫生' },
  { key: 'enableTimeSeries', label: '时间序列' },
  { key: 'enableDistributionSnapshot', label: '分布快照', cliOnly: true },
];
const DEFAULT_FEATURES = {
  enableCorrelation: true, enableStringPatterns: true, enableUnicodeHygiene: true,
  enableTimeSeries: false, enableDistributionSnapshot: false,
};
const CSV_INFER_KEY = 'apiCsvInferNumbers';
function loadFeatures() {
  try {
    const saved = JSON.parse(localStorage.getItem('apiFeatures'));
    return saved ? { ...DEFAULT_FEATURES, ...saved } : DEFAULT_FEATURES;
  } catch { return DEFAULT_FEATURES; }
}
function loadCsvInfer() { return localStorage.getItem(CSV_INFER_KEY) !== 'false'; }
function kb(b) {
  if (b == null) return '';
  return b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`;
}

export default function Workbench() {
  const [source, setSource] = useState(null);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [rulesText, setRulesText] = useState(RULES_TEMPLATE);
  const [rules, setRules] = useState(null);
  const [rulesError, setRulesError] = useState('');
  const [rulesCheck, setRulesCheck] = useState(null);
  const [tab, setTab] = useState('fields');
  const [textFormat, setTextFormat] = useState('json');
  const fileInput = useRef(null);
  const [result, setResult] = useState(null);
  const [elapsed, setElapsed] = useState(null);
  const [preflightModal, setPreflightModal] = useState(null);
  const [pendingRun, setPendingRun] = useState(null);
  const [features, setFeatures] = useState(loadFeatures);
  const [csvInfer, setCsvInfer] = useState(loadCsvInfer);
  const [forceAsync, setForceAsync] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [sidebarW, setSidebarW] = useState(() => {
    const saved = Number(localStorage.getItem('wbSidebarW'));
    return saved >= 240 && saved <= 640 ? saved : 320;
  });
  const dragState = useRef(null);

  const {
    phase, busy, progress, result: asyncResult, error: asyncError, jobId,
    start: startAnalyze, cancel: cancelAnalysis,
  } = useAsyncAnalyze();

  useEffect(() => {
    if (phase === 'done' && asyncResult) {
      setResult(asyncResult);
      setElapsed(asyncResult._api?.elapsedMs ?? null);
      setError('');
    }
  }, [phase, asyncResult]);

  useEffect(() => {
    if ((phase === 'error' || phase === 'cancelled') && asyncError) setError(asyncError);
  }, [phase, asyncError]);

  const toggleFeature = (key) => {
    setFeatures((f) => {
      const next = { ...f, [key]: !f[key] };
      localStorage.setItem('apiFeatures', JSON.stringify(next));
      return next;
    });
  };
  const toggleCsvInfer = () => {
    setCsvInfer((v) => { localStorage.setItem(CSV_INFER_KEY, String(!v)); return !v; });
  };

  const onResizeStart = (e) => {
    e.preventDefault();
    dragState.current = { startX: e.clientX, startW: sidebarW };
    document.body.classList.add('col-resizing');
    const onMove = (ev) => {
      const { startX, startW } = dragState.current;
      setSidebarW(Math.min(640, Math.max(240, startW + ev.clientX - startX)));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.classList.remove('col-resizing');
      setSidebarW((w) => { localStorage.setItem('wbSidebarW', String(w)); return w; });
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

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
  const ruleFieldWarning = useMemo(() => {
    if (!result || !rules) return null;
    const w = computeRuleFieldWarning(Object.keys(rules.fields || {}), result.fieldStatistics.map((f) => f.fieldName));
    return w.hasWarning ? w : null;
  }, [result, rules]);

  const executeAnalysis = useCallback(async (src, opts) => {
    if (!src?.file) return;
    setError('');
    const preferAsync = forceAsync || (src.file.size ?? 0) >= ASYNC_THRESHOLD_BYTES;
    await startAnalyze(src.file, opts, { forceAsync: preferAsync, forceSync: !preferAsync && !forceAsync });
  }, [startAnalyze, forceAsync]);

  const runAnalysis = useCallback(async (src, _rulesJsonText, rulesOverride) => {
    if (!src?.file) return;
    const activeRules = rulesOverride !== undefined ? rulesOverride : rules;
    const { flatten, selectedFields, filter, ...ruleBody } = activeRules || {};
    const rulesJson = activeRules ? JSON.stringify(ruleBody) : null;
    const opts = { rulesJson, flatten, fields: selectedFields?.join(','), filter, features, csvInferNumbers: csvInfer };
    if (rulesJson) {
      try {
        const pf = await preflight(src.file, { rulesJson, flatten, csvInferNumbers: csvInfer });
        if (pf?.hasWarning) {
          setPreflightModal({ ruleFields: pf.ruleFields ?? [], sampleFields: pf.sampleFields ?? [], truncated: pf.truncatedSampleFieldCount ?? 0 });
          setPendingRun({ src, opts });
          return;
        }
      } catch { /* ignore */ }
    }
    await executeAnalysis(src, opts);
  }, [rules, features, csvInfer, executeAnalysis]);

  const confirmPreflight = () => {
    const pending = pendingRun;
    setPreflightModal(null); setPendingRun(null);
    if (pending) executeAnalysis(pending.src, pending.opts);
  };
  const cancelPreflight = () => { setPreflightModal(null); setPendingRun(null); };

  const checkRules = useCallback(async (text) => {
    if (!text?.trim()) { setRulesCheck(null); return { ok: true, empty: true }; }
    let parsed;
    try { parsed = parseJsonc(text); }
    catch (e) { setRulesCheck({ state: 'error', message: e.message, source: 'local' }); return { ok: false, message: e.message }; }
    setRulesCheck({ state: 'checking' });
    const r = await validateRules(toBackendRulesText(text));
    if (r.ok) { setRulesCheck({ state: 'ok', fields: r.fields }); return { ok: true, parsed, fields: r.fields, unknowns: r.unknowns }; }
    if (r.offline) { setRulesCheck({ state: 'offline' }); return { ok: true, parsed, degraded: true }; }
    const unknowns = r.unknowns || [];
    const message = unknowns.length ? r.error || `有 ${unknowns.length} 个规则名不被后端识别` : formatRulesError(r.error);
    setRulesCheck({ state: 'error', message, fields: r.fields, unknowns: unknowns.length ? unknowns : undefined, source: 'backend' });
    return { ok: false, message };
  }, []);

  const applyRules = async () => {
    const check = await checkRules(rulesText);
    if (!check.ok) { setRulesError('规则未通过校验，已取消分析'); return; }
    if (check.empty) { setRules(null); setRulesError(''); return; }
    setRules(check.parsed); setRulesError('');
    if (source) await runAnalysis(source, rulesText, check.parsed);
  };
  const clearRules = () => {
    setRules(null); setRulesError(''); setRulesCheck(null);
    if (source) runAnalysis(source, null);
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    const src = { file, name: file.name };
    setSource(src); setFileName(file.name); setError('');
    await runAnalysis(src, rulesText);
  };
  const onPaste = async () => {
    const text = window.prompt('粘贴数据内容（JSON / JSONL / CSV / YAML / XML）：');
    if (!text) return;
    const name = `粘贴的数据（${textFormat}）`;
    setFileName(name); setError('');
    const file = new File([text], `pasted.${textFormat}`, { type: 'text/plain' });
    const src = { file, name }; setSource(src);
    await runAnalysis(src, rulesText);
  };
  const loadSample = async () => {
    setFileName('内置样例数据'); setError('');
    const file = new File([JSON.stringify(SAMPLE_DATA)], 'sample.json', { type: 'application/json' });
    const src = { file, name: '内置样例数据' }; setSource(src);
    await runAnalysis(src, rulesText);
  };
  const fetchReference = async () => {
    try {
      const ref = await fetchRulesReference();
      const text = typeof ref === 'string' ? ref : JSON.stringify(ref, null, 2);
      setRulesText(text); setRulesError('');
      await checkRules(text);
    } catch (e) { setRulesError(`拉取参考模板失败：${e.message}`); }
  };

  const exportReport = async (fmt) => {
    setExportOpen(false);
    if (!result) return;
    if (fmt === 'json') download(toJson(result), 'report.json', 'application/json');
    else if (fmt === 'csv') download(toCsv(result), 'report.csv', 'text/csv');
    else if (fmt === 'md') download(toMarkdown(result, fileName), 'report.md', 'text/markdown');
    else if (fmt === 'html') download(toHtml(result, fileName), 'report.html', 'text/html');
    else if (fmt === 'schema') download(toJsonSchema(result), 'report.schema.json', 'application/json');
    else if (fmt === 'xlsx') {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      const rows = result.fieldStatistics.map((f) => ({
        字段名: f.fieldName, 覆盖率: +(f.coverage * 100).toFixed(1), 主导类型: f.primaryType,
        唯一值: f.distinctCount, 出现次数: f.count,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), '字段统计');
      XLSX.writeFile(wb, 'report.xlsx');
    }
  };

  return (
    <div className={`flex h-[calc(100dvh-57px)] min-h-[480px] overflow-hidden bg-background${busy ? ' select-none' : ''}`}>
      <aside className="flex shrink-0 flex-col border-r border-border bg-card" style={{ width: sidebarW }}>
        <div className="flex-1 overflow-y-auto">
          <section className="border-b border-border p-4">
            <div className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">深度分析</div>
            <div className="grid gap-2">
              {FEATURE_DEFS.map((fd) => (
                <label key={fd.key} className={`flex cursor-pointer items-center gap-2 text-sm ${fd.cliOnly ? 'opacity-50' : ''}`}>
                  <input type="checkbox" className="size-3.5 rounded border-border" checked={!!features[fd.key]} disabled={fd.cliOnly} onChange={() => toggleFeature(fd.key)} />
                  <span>{fd.label}</span>
                  {fd.cliOnly ? <span className="text-[10px] text-muted-foreground">仅 CLI</span> : null}
                </label>
              ))}
            </div>
          </section>
          <section className="border-b border-border p-4">
            <div className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">数据源</div>
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm shadow-[var(--elev)]">
              <span className={`size-1.5 shrink-0 rounded-full ${fileName ? 'bg-ok' : 'bg-muted-foreground'}`} />
              <span className="truncate font-mono text-xs">{fileName || '未选择'}</span>
            </div>
            {error ? <div className="mb-3 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{error}</div> : null}
            <div className="grid gap-2">
              <button type="button" className="inline-flex h-10 items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40" onClick={() => fileInput.current?.click()} disabled={busy}>上传文件</button>
              <input ref={fileInput} type="file" className="hidden" accept=".json,.jsonl,.txt,.csv,.xml,.yaml,.yml,.xlsx,.xls,.gz,.zip" onChange={onFile} />
              <div className="flex gap-2">
                <select className="h-10 flex-1 rounded-lg bg-muted px-2 text-sm shadow-[var(--elev)] outline-none" value={textFormat} onChange={(e) => setTextFormat(e.target.value)} disabled={busy}>
                  {TEXT_FORMATS.map((f) => <option key={f} value={f}>{f.toUpperCase()}</option>)}
                </select>
                <button type="button" className="h-10 rounded-lg bg-muted px-3 text-sm shadow-[var(--elev)] hover:bg-muted/80 disabled:opacity-40" onClick={onPaste} disabled={busy}>粘贴</button>
              </div>
              <button type="button" className="h-9 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40" onClick={loadSample} disabled={busy}>加载样例数据</button>
              <button type="button" className="h-9 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40" onClick={() => source && runAnalysis(source, rulesText)} disabled={busy || !source}>重新分析</button>
            </div>
            <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={csvInfer} onChange={toggleCsvInfer} disabled={busy} /> CSV 数值推断
            </label>
            <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={forceAsync} onChange={(e) => setForceAsync(e.target.checked)} disabled={busy} /> 强制后台分析
            </label>
          </section>
          <section className="p-4">
            <div className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">规则</div>
            <RulesEditor text={rulesText} setText={setRulesText} error={rulesError} check={rulesCheck} onValidate={(x) => checkRules(x ?? rulesText)} onApply={applyRules} onClear={clearRules} onFetchReference={fetchReference} applied={!!rules} busy={busy} />
            {busy ? (
              <button type="button" className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-lg text-sm text-danger hover:bg-danger/10" onClick={cancelAnalysis}>取消分析</button>
            ) : null}
          </section>
        </div>
      </aside>
      <div role="separator" aria-orientation="vertical" className="w-1 shrink-0 cursor-col-resize bg-border/50 hover:bg-primary/40" onMouseDown={onResizeStart} />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {(busy || phase === 'error' || phase === 'cancelled') ? (
          <div className="border-b border-border bg-card px-4 py-3">
            <JobProgress phase={phase} progress={progress} jobId={jobId} error={asyncError} onCancel={cancelAnalysis} onRetry={() => source && runAnalysis(source, rulesText)} forceAsync={forceAsync} onForceAsyncChange={setForceAsync} showAsyncToggle fileSize={source?.file?.size ?? 0} />
          </div>
        ) : null}
        {result ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{fileName || '分析结果'}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {result.fieldStatistics?.length ?? 0} 字段{elapsed != null ? ` · ${elapsed} ms` : ''}{result._api?.bytes != null ? ` · ${kb(result._api.bytes)}` : ''}{jobId ? ` · job ${jobId}` : ''}
                </div>
              </div>
              <div className="relative">
                <button type="button" className="h-9 rounded-lg bg-muted px-3 text-sm shadow-[var(--elev)]" onClick={() => setExportOpen((v) => !v)}>导出</button>
                {exportOpen ? (
                  <div className="absolute top-full right-0 z-20 mt-1 min-w-[140px] overflow-hidden rounded-xl bg-card py-1 shadow-[var(--elev)]">
                    {[['json','JSON'],['csv','CSV'],['md','Markdown'],['html','HTML'],['schema','JSON Schema'],['xlsx','Excel']].map(([fmt, label]) => (
                      <button key={fmt} type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => exportReport(fmt)}>{label}</button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            {ruleFieldWarning ? <div className="border-b border-border bg-warn/10 px-4 py-2 text-xs text-warn">规则字段与数据重叠不足，部分校验可能未命中。</div> : null}
            <div className="border-b border-border px-4 pt-3"><OverviewCards result={result} /></div>
            <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-2">
              <div className="rounded-xl bg-card p-3 shadow-[var(--elev)]"><CoverageChart fields={result.fieldStatistics} /></div>
              <div className="rounded-xl bg-card p-3 shadow-[var(--elev)]"><TypeChart fields={result.fieldStatistics} /></div>
            </div>
            <div className="flex items-center gap-1 overflow-x-auto border-b border-border px-4">
              {TABS.map((t) => (
                <button key={t.key} type="button" className={`relative shrink-0 px-3 py-2.5 text-sm ${tab === t.key ? 'text-foreground after:absolute after:right-3 after:bottom-0 after:left-3 after:h-0.5 after:rounded-full after:bg-primary' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => setTab(t.key)}>
                  {t.label}
                  {t.key === 'quality' && rules && violationCount > 0 ? <span className="ml-1.5 rounded-full bg-danger/15 px-1.5 py-0.5 text-[10px] text-danger">{violationCount}</span> : null}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4">
              <ErrorBoundary key={tab}>
                {tab === 'fields' && <FieldTable fields={result.fieldStatistics} rules={rules} bare />}
                {tab === 'insights' && deepInsights && <InsightsPanel result={result} insights={deepInsights} features={features} fileName={fileName} />}
                {tab === 'values' && <ValueDistribution fields={result.fieldStatistics} bare />}
                {tab === 'quality' && (rules ? <QualityPanel violations={result.qualityViolations || []} bare /> : <div className="rounded-xl bg-muted px-4 py-8 text-center text-sm text-muted-foreground">尚未应用规则。</div>)}
              </ErrorBoundary>
            </div>
          </div>
        ) : null}
        {!result && !busy ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground shadow-[var(--elev)]">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><path d="M4 19V5M4 19h16M8 15l3.2-4.5 2.8 2.2L18 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <h2 className="text-lg font-medium tracking-tight">开始一次分析</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">在左侧选择数据源：上传文件、粘贴文本，或加载内置样例。大文件可勾选「强制后台分析」。</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">JSON / CSV / YAML / XML / Excel</span>
              <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">规则校验与预检</span>
              <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">对接 ObjectAnalyzer.Api</span>
            </div>
            <button type="button" className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90" onClick={() => fileInput.current?.click()}>选择文件</button>
          </div>
        ) : null}
      </main>
      {preflightModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-[var(--elev)]">
            <h3 className="text-base font-medium">规则与数据可能不匹配</h3>
            <p className="mt-2 text-sm text-muted-foreground">预检发现规则字段与样本数据重叠不足，确认仍要继续分析？</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="h-9 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted" onClick={cancelPreflight}>取消并修改规则</button>
              <button type="button" className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground" onClick={confirmPreflight}>仍然继续分析</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
