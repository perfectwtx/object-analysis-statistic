import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { download, toCsv, toHtml, toJson, toJsonSchema, toMarkdown } from '../exporters.js';
import {
  fetchRulesReference,
  preflight,
  validateRules,
  ASYNC_THRESHOLD_BYTES,
} from '../api/index.js';
import { useAsyncAnalyze } from '../hooks/useAsyncAnalyze.js';
import { computeRuleFieldWarning, formatRulesError, parseJsonc, toBackendRulesText } from '../utils.js';
import { SAMPLE_DATA } from '../sampleData.js';
import { RULES_TEMPLATE, EMPTY_RULES } from '../components/RulesEditor.jsx';
import WorkbenchLayout from './WorkbenchLayout.jsx';
import {
  loadAnalyzeOptions,
  saveAnalyzeOptions,
  toAnalyzeRequestOptions,
} from '../lib/analyzeOptions.js';
import { mergeFieldNamesIntoRulesText } from '../lib/fieldRules.js';

const TABS = [
  { key: 'fields', label: '字段明细' },
  { key: 'insights', label: '深度分析' },
  { key: 'values', label: '取值分布' },
  { key: 'quality', label: '质量报告' },
];
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
  const [analyzeOptions, setAnalyzeOptionsState] = useState(loadAnalyzeOptions);
  const setAnalyzeOptions = (updater) => {
    setAnalyzeOptionsState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveAnalyzeOptions(next);
      return next;
    });
  };
  const [configOpen, setConfigOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [lastSampleFields, setLastSampleFields] = useState([]);
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
      const names = (asyncResult.fieldStatistics || []).map((f) => f.fieldName).filter(Boolean);
      if (names.length) {
        setLastSampleFields(names);
        setRulesText((prev) => mergeFieldNamesIntoRulesText(prev, names));
      }
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
    const apiOpts = toAnalyzeRequestOptions(analyzeOptions);
    const opts = {
      rulesJson,
      flatten,
      fields: selectedFields?.length ? selectedFields.join(',') : apiOpts.fields,
      filter: filter || apiOpts.filter,
      features,
      csvInferNumbers: csvInfer,
      ...apiOpts,
      ...(selectedFields?.length ? { fields: selectedFields.join(',') } : {}),
      ...(filter ? { filter } : {}),
    };
    if (rulesJson) {
      try {
        const pf = await preflight(src.file, { rulesJson, flatten, csvInferNumbers: csvInfer, ...toAnalyzeRequestOptions(analyzeOptions) });
        const sample = pf?.sampleFields ?? pf?.SampleFields ?? [];
        if (Array.isArray(sample) && sample.length) {
          setLastSampleFields(sample);
          setRulesText((prev) => mergeFieldNamesIntoRulesText(prev, sample));
        }
        if (pf?.hasWarning) {
          setPreflightModal({ ruleFields: pf.ruleFields ?? [], sampleFields: sample, truncated: pf.truncatedSampleFieldCount ?? 0 });
          setPendingRun({ src, opts });
          return;
        }
      } catch { /* ignore */ }
    }
    await executeAnalysis(src, opts);
  }, [rules, features, csvInfer, executeAnalysis, analyzeOptions]);

  const confirmPreflight = () => {
    const pending = pendingRun;
    setPreflightModal(null); setPendingRun(null);
    if (pending) executeAnalysis(pending.src, pending.opts);
  };
  const cancelPreflight = () => { setPreflightModal(null); setPendingRun(null); };
  const onImportSampleFields = () => {
    if (!lastSampleFields?.length) return;
    setRulesText((prev) => mergeFieldNamesIntoRulesText(prev, lastSampleFields));
  };

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
    setRulesText(EMPTY_RULES);
    if (source) runAnalysis(source, null);
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    const src = { file, name: file.name };
    setSource(src); setFileName(file.name); setError('');
    await runAnalysis(src, rulesText);
  };
  const openPaste = () => setPasteOpen(true);
  const submitPaste = async (text, format) => {
    const fmt = format || textFormat || 'json';
    setTextFormat(fmt);
    const name = `粘贴的数据（${fmt}）`;
    setFileName(name); setError('');
    const file = new File([text], `pasted.${fmt}`, { type: 'text/plain' });
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
    <WorkbenchLayout
      busy={busy}
      sidebarW={sidebarW}
      onResizeStart={onResizeStart}
      fileName={fileName}
      error={error}
      fileInput={fileInput}
      onFile={onFile}
      onPaste={openPaste}
      loadSample={loadSample}
      source={source}
      runAnalysis={runAnalysis}
      rulesText={rulesText}
      cancelAnalysis={cancelAnalysis}
      phase={phase}
      progress={progress}
      jobId={jobId}
      asyncError={asyncError}
      forceAsync={forceAsync}
      setForceAsync={setForceAsync}
      result={result}
      elapsed={elapsed}
      exportOpen={exportOpen}
      setExportOpen={setExportOpen}
      exportReport={exportReport}
      kb={kb}
      ruleFieldWarning={ruleFieldWarning}
      tab={tab}
      setTab={setTab}
      TABS={TABS}
      violationCount={violationCount}
      deepInsights={deepInsights}
      features={features}
      rules={rules}
      preflightModal={preflightModal}
      cancelPreflight={cancelPreflight}
      confirmPreflight={confirmPreflight}
      rulesError={rulesError}
      rulesCheck={rulesCheck}
      checkRules={checkRules}
      applyRules={applyRules}
      clearRules={clearRules}
      fetchReference={fetchReference}
      setRulesText={setRulesText}
      csvInfer={csvInfer}
      toggleCsvInfer={toggleCsvInfer}
      FEATURE_DEFS={FEATURE_DEFS}
      toggleFeature={toggleFeature}
      configOpen={configOpen}
      setConfigOpen={setConfigOpen}
      pasteOpen={pasteOpen}
      setPasteOpen={setPasteOpen}
      onSubmitPaste={submitPaste}
      defaultPasteFormat={textFormat}
      analyzeOptions={analyzeOptions}
      setAnalyzeOptions={setAnalyzeOptions}
      sampleFields={lastSampleFields}
      onImportSampleFields={onImportSampleFields}
    />
  );
}
