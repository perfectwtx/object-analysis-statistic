import { readRuntimeFromRulesText } from '../components/RulesConfigModal.jsx';
import { useSidebarWidth } from '../hooks/useSidebarWidth.js';
import { translate as tx, useT } from '../lib/i18n.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReportExport } from '../hooks/useReportExport.js';
import {
  ASYNC_THRESHOLD_BYTES,
  saveLastJobId,
} from '../api/index.js';
import { useAsyncAnalyze } from '../hooks/useAsyncAnalyze.js';
import { computeRuleFieldWarning, parseJsonc } from '../utils.js';
import { SAMPLE_DATA, FULL_SAMPLE_DATA, FULL_RULES_TEXT } from '../sampleData.js';
import { useWorkbenchRules } from '../hooks/useWorkbenchRules.js';
import { useAnalysisPreflight } from '../hooks/useAnalysisPreflight.js';
import { buildAnalysisOptions } from '../lib/build-analysis-options.js';
import WorkbenchLayout from './WorkbenchLayout.jsx';
import {
  loadAnalyzeOptions,
  saveAnalyzeOptions,
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
  useT();
  const [source, setSource] = useState(null);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const ruleState = useWorkbenchRules();
  const { rulesText, setRulesText, rules, setRules, rulesError, setRulesError, rulesCheck, setRulesCheck, checkRules, fetchReference } = ruleState;
  const [tab, setTab] = useState('fields');
  const [textFormat, setTextFormat] = useState('json');
  const fileInput = useRef(null);
  const [result, setResult] = useState(null);
  const [elapsed, setElapsed] = useState(null);
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
  const { sidebarW, onResizeStart, onResizeKeyDown } = useSidebarWidth();

  const {
    phase, busy, progress, result: asyncResult, error: asyncError, jobId,
    start: startAnalyze, cancel: cancelAnalysis,
  } = useAsyncAnalyze();

  useEffect(() => {
    if (phase === 'done' && asyncResult) {
      setResult(asyncResult);
      setElapsed(asyncResult._api?.elapsedMs ?? null);
      setError('');
      if (jobId) saveLastJobId(jobId);
      const names = (asyncResult.fieldStatistics || []).map((f) => f.fieldName).filter(Boolean);
      if (names.length) {
        setLastSampleFields(names);
        setRulesText((prev) => mergeFieldNamesIntoRulesText(prev, names));
      }
    }
  }, [phase, asyncResult, jobId]);

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
    setResult(null);
    setElapsed(null);
    const preferAsync = forceAsync || (src.file.size ?? 0) >= ASYNC_THRESHOLD_BYTES;
    await startAnalyze(src.file, opts, { forceAsync: preferAsync, forceSync: !preferAsync && !forceAsync });
  }, [startAnalyze, forceAsync]);

  const { prepare, preparing, preflightModal, confirmPreflight, cancelPreflight } = useAnalysisPreflight({
    execute: executeAnalysis,
    onSampleFields: (names) => { setLastSampleFields(names); setRulesText((prev) => mergeFieldNamesIntoRulesText(prev, names)); },
    onError: (e) => setError(e.message),
  });
  const runAnalysis = async ({ source: src = source, rules: activeRules = rules } = {}) => {
    if (!src?.file) return;
    setError('');
    try { await prepare(src, buildAnalysisOptions({ rules: activeRules, features, csvInfer, runtime: { ...analyzeOptions, ...readRuntimeFromRulesText(rulesText) } })); }
    catch (e) { setError(e.message); }
  };
  const cancelAll = () => { cancelPreflight(); return cancelAnalysis(); };
  const onImportSampleFields = () => {
    if (!lastSampleFields?.length) return;
    setRulesText((prev) => mergeFieldNamesIntoRulesText(prev, lastSampleFields));
  };

  const applyRules = async () => {
    const check = await checkRules(rulesText);
    if (!check) return false;
    if (!check.ok) { setRulesError(tx("规则未通过校验，已取消分析")); return false; }
    if (check.empty) { ruleState.clear(); if (source) await runAnalysis({ source, rules: null }); return true; }
    setRules(check.parsed); setRulesError('');
    if (source) await runAnalysis({ source, rules: check.parsed });
    return true;
  };
  const clearRules = ({ rulesText: nextText } = {}) => {
    ruleState.clear(nextText ? { rulesText: nextText } : undefined);
    if (source) return runAnalysis({ source, rules: null });
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    const src = { file, name: file.name };
    setSource(src); setFileName(file.name); setError('');
    await runAnalysis({ source: src });
  };
  const openPaste = () => setPasteOpen(true);
  const submitPaste = async (text, format) => {
    const fmt = format || textFormat || 'json';
    setTextFormat(fmt);
    const name = tx("粘贴的数据（{0}）", {0: fmt});
    setFileName(name); setError('');
    const file = new File([text], `pasted.${fmt}`, { type: 'text/plain' });
    const src = { file, name }; setSource(src);
    await runAnalysis({ source: src });
  };
  const loadSample = async () => {
    setFileName(tx("内置样例数据")); setError('');
    const file = new File([JSON.stringify(SAMPLE_DATA)], 'sample.json', { type: 'application/json' });
    const src = { file, name: tx("内置样例数据") }; setSource(src);
    await runAnalysis({ source: src });
  };

  /** 一键加载全量样例数据 + 全量规则，并立即分析 */
  const loadFullSample = async () => {
    setError('');
    setRulesError('');
    let parsed = null;
    try {
      parsed = parseJsonc(FULL_RULES_TEXT);
    } catch (e) {
      setRulesError(tx("全量规则解析失败：{0}", {0: e.message}));
      return;
    }
    setRulesText(FULL_RULES_TEXT);
    setRules(parsed);
    setRulesCheck({ state: 'ok', fields: Object.keys(parsed?.fields || {}).length });
    setFileName(tx("全量样例数据"));
    const file = new File([JSON.stringify(FULL_SAMPLE_DATA, null, 2)], 'full-sample.json', { type: 'application/json' });
    const src = { file, name: tx("全量样例数据") };
    setSource(src);
    await runAnalysis({ source: src, rules: parsed });
  };

  const { exporting, exportReport } = useReportExport({
    result, fileName, onClose: () => setExportOpen(false),
    onError: (e) => setError(tx("导出失败：") + e.message),
  });

  return (
    <WorkbenchLayout
      busy={busy || preparing}
      sidebarW={sidebarW}
      onResizeStart={onResizeStart}
      onResizeKeyDown={onResizeKeyDown}
      fileName={fileName}
      error={error}
      fileInput={fileInput}
      onFile={onFile}
      onPaste={openPaste}
      loadSample={loadSample}
      loadFullSample={loadFullSample}
      source={source}
      runAnalysis={runAnalysis}
      rulesText={rulesText}
      cancelAnalysis={cancelAll}
      phase={preparing ? 'submitting' : phase}
      progress={progress}
      jobId={jobId}
      asyncError={asyncError}
      forceAsync={forceAsync}
      setForceAsync={setForceAsync}
      result={result}
      elapsed={elapsed}
      exportOpen={exportOpen}
      setExportOpen={setExportOpen}
      exporting={exporting}
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
