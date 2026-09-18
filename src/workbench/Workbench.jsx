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
    <div className={`workbench wb-embedded${busy ? ' is-analyzing' : ''}`}>
      <aside className="sidebar" style={{ width: sidebarW }}>
        <div className="side-section">
          <div className="side-title">深度分析</div>
          <div className="feature-list">
            {FEATURE_DEFS.map((fd) => (
              <label key={fd.key} className={`feature-item ${fd.cliOnly ? 'disabled' : ''}`}>
                <input type="checkbox" checked={!!features[fd.key]} disabled={fd.cliOnly} onChange={() => toggleFeature(fd.key)} />
                {fd.label}{fd.cliOnly && <span className="cli-tag">仅 CLI</span>}
              </label>
            ))}
          </div>
        </div>
        <div className="side-section">
          <div className="side-title">数据源</div>
          <div className="source-current" title={fileName}>
            <span className="source-dot" /><span className="mono source-name">{fileName || '未选择'}</span>
          </div>
          {error && <div className="error side-error">{error}</div>}
          <div className="side-actions">
            <button type="button" className="btn primary block" onClick={() => fileInput.current?.click()} disabled={busy}>
              {busy ? '分析中…' : '上传文件'}
            </button>
            <input ref={fileInput} type="file" accept=".json,.jsonl,.txt,.csv,.xml,.yaml,.yml,.xlsx,.xls,.gz,.zip" hidden onChange={onFile} />
            <div className="btn-row">
              <button type="button" className="btn half" onClick={onPaste} disabled={busy}>粘贴数据</button>
              <button type="button" className="btn half" onClick={loadSample} disabled={busy}>加载样例</button>
            </div>
            <button type="button" className="btn block" onClick={() => source && runAnalysis(source, rulesText)} disabled={busy || !source}>重新分析</button>
            <div className="side-section job-section" style={{ marginTop: 8, padding: 0, border: 'none' }}>
              <JobProgress
                phase={phase} progress={progress} jobId={jobId} error={asyncError}
                onCancel={cancelAnalysis} onRetry={() => source && runAnalysis(source, rulesText)}
                forceAsync={forceAsync} onForceAsyncChange={setForceAsync}
                showAsyncToggle fileSize={source?.file?.size ?? 0}
              />
            </div>
            <div className="format-row">
              <label htmlFor="text-format">文本格式</label>
              <select id="text-format" className="format-select" value={textFormat} onChange={(e) => setTextFormat(e.target.value)}>
                {TEXT_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <label className="feature-item csv-infer">
              <input type="checkbox" checked={csvInfer} onChange={toggleCsvInfer} />CSV 数字列推断
            </label>
          </div>
        </div>
        <div className="side-section">
          <div className="side-title">规则</div>
          <RulesEditor
            text={rulesText} setText={setRulesText} error={rulesError} check={rulesCheck}
            onValidate={(t) => checkRules(t ?? rulesText)} onApply={applyRules} onClear={clearRules}
            onFetchReference={fetchReference} applied={!!rules} busy={busy}
          />
        </div>
        <div className="side-section">
          <button type="button" className="btn block" onClick={() => setExportOpen(!exportOpen)} disabled={!result}>导出报告 ▾</button>
          {exportOpen && result && (
            <>
              <div className="export-mask" onClick={() => setExportOpen(false)} />
              <div className="export-menu">
                {['json', 'csv', 'md', 'html', 'schema', 'xlsx'].map((k) => (
                  <button key={k} type="button" className="export-item" onClick={() => exportReport(k)}>{k.toUpperCase()}</button>
                ))}
              </div>
            </>
          )}
        </div>
      </aside>
      <div className="resize-handle" onMouseDown={onResizeStart} title="拖拽调整宽度" />
      <main className="main">
        <div className="topbar wb-page-header">
          <div>
            <h1>分析</h1>
            <p className="subtitle">上传或粘贴数据，由 API 计算统计与质量指标</p>
          </div>
          <div className="topbar-status">
            {busy && (
              <span className="busy-indicator">
                <span className="spinner" />
                {phase === 'submitting' ? '提交中…' : (progress.processedObjects > 0 ? `分析中 · ${Number(progress.processedObjects).toLocaleString()} 条` : '分析中…')}
                <button type="button" className="btn-link danger" onClick={cancelAnalysis}>取消</button>
              </span>
            )}
            {!busy && elapsed != null && (
              <span className="chip api-chip">耗时 {(elapsed / 1000).toFixed(2)}s{result?._api?.bytes != null ? ` · ${kb(result._api.bytes)}` : ''}</span>
            )}
            {!busy && result?._api?.format && (
              <span className="chip api-chip">{result._api.format}{result._api.rulesSource ? ` · 规则(${result._api.rulesSource})` : ''}</span>
            )}
            {rules && (
              <span className={`quality-status ${violationCount === 0 ? 'pass' : 'fail'}`}>
                {violationCount === 0 ? '✓ 质量校验 PASS' : `✗ ${violationCount} 项违规`}
              </span>
            )}
          </div>
        </div>
        {ruleFieldWarning && (
          <div className="rule-field-warning">规则字段与数据可能不匹配，请确认是否用错规则文件。</div>
        )}
        {result && (
          <>
            <OverviewCards result={result} />
            <div className="charts">
              <CoverageChart fields={result.fieldStatistics} />
              <TypeChart fields={result.fieldStatistics} />
            </div>
            <div className="panel tabs-panel">
              <div className="tabs">
                {TABS.map((t) => (
                  <button key={t.key} type="button" className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
                    {t.label}
                    {t.key === 'quality' && rules && violationCount > 0 && <span className="tab-badge">{violationCount}</span>}
                  </button>
                ))}
              </div>
              <div className="tab-content">
                <ErrorBoundary key={tab}>
                  {tab === 'fields' && <FieldTable fields={result.fieldStatistics} rules={rules} bare />}
                  {tab === 'insights' && deepInsights && (
                    <InsightsPanel result={result} insights={deepInsights} features={features} fileName={fileName} />
                  )}
                  {tab === 'values' && <ValueDistribution fields={result.fieldStatistics} bare />}
                  {tab === 'quality' && (rules
                    ? <QualityPanel violations={result.qualityViolations || []} bare />
                    : <div className="empty-tab">尚未应用规则。</div>)}
                </ErrorBoundary>
              </div>
            </div>
          </>
        )}
        {!result && !busy && (
          <div className="wb-empty">
            <div className="wb-empty-icon" aria-hidden>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M4 19V5M4 19h16M8 15l3.2-4.5 2.8 2.2L18 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="wb-empty-title">开始一次分析</div>
            <p className="wb-empty-desc">
              在左侧选择数据源：上传文件、粘贴文本，或加载内置样例。大文件可勾选「后台分析」查看进度。
            </p>
            <div className="wb-empty-hints">
              <span>JSON / JSONL / CSV / YAML / XML / Excel</span>
              <span>支持规则校验与预检</span>
            </div>
          </div>
        )}
      </main>
      {preflightModal && (
        <div className="modal-mask">
          <div className="modal">
            <h3>规则与数据可能不匹配</h3>
            <p>预检发现规则字段与样本数据重叠不足，确认仍要继续分析？</p>
            <div className="modal-actions">
              <button type="button" className="btn primary" onClick={confirmPreflight}>仍然继续分析</button>
              <button type="button" className="btn outline" onClick={cancelPreflight}>取消并修改规则</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
