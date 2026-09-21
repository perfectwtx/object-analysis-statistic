import JobProgress from '../components/JobProgress.jsx';
import OverviewCards from '../components/OverviewCards.jsx';
import CoverageChart from '../components/CoverageChart.jsx';
import TypeChart from '../components/TypeChart.jsx';
import FieldTable from '../components/FieldTable.jsx';
import ValueDistribution from '../components/ValueDistribution.jsx';
import QualityPanel from '../components/QualityPanel.jsx';
import InsightsPanel from '../components/InsightsPanel.jsx';
import ErrorBoundary from '../components/ErrorBoundary.jsx';
import RulesRuntimeSection from '../components/RulesRuntimeSection.jsx';
import PasteDataModal from '../components/PasteDataModal.jsx';

/** Presentational layout for analysis workbench */
export default function WorkbenchLayout({
  busy, sidebarW, onResizeStart,
  fileName, error, fileInput, onFile, onPaste, loadSample,
  pasteOpen, setPasteOpen, onSubmitPaste, defaultPasteFormat,
  source, runAnalysis, rulesText, cancelAnalysis,
  phase, progress, jobId, asyncError, forceAsync, setForceAsync,
  result, elapsed, exportOpen, setExportOpen, exportReport, kb,
  ruleFieldWarning, tab, setTab, TABS, violationCount,
  deepInsights, features, rules,
  preflightModal, cancelPreflight, confirmPreflight,
  rulesError, rulesCheck, checkRules, applyRules, clearRules, fetchReference,
  setRulesText, csvInfer, toggleCsvInfer, FEATURE_DEFS, toggleFeature,
  configOpen, setConfigOpen,
  analyzeOptions, setAnalyzeOptions,
  sampleFields,
  onImportSampleFields,
}) {
  return (
    <div className={`flex h-[calc(100dvh-57px)] min-h-[480px] overflow-hidden bg-background${busy ? ' select-none' : ''}`}>
      <aside className="flex shrink-0 flex-col border-r border-border bg-card" style={{ width: sidebarW }}>
        <div className="flex-1 overflow-y-auto">
          <section className="border-b border-border p-4">
            <div className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">数据源</div>
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm shadow-[var(--elev)]">
              <span className={`size-1.5 shrink-0 rounded-full ${fileName ? 'bg-ok' : 'bg-muted-foreground'}`} />
              <span className="truncate font-mono text-xs">{fileName || '未选择'}</span>
            </div>
            {error ? <div className="mb-3 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{error}</div> : null}
            <div data-tour="data-source" className="grid gap-2">
              <button type="button" className="inline-flex h-10 items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40" onClick={() => fileInput.current?.click()} disabled={busy}>上传文件</button>
              <input ref={fileInput} type="file" className="hidden" accept=".json,.jsonl,.txt,.csv,.xml,.yaml,.yml,.xlsx,.xls,.gz,.zip" onChange={onFile} />
              <button type="button" className="inline-flex h-10 items-center justify-center rounded-lg bg-muted text-sm font-medium text-foreground shadow-[var(--elev)] hover:bg-muted/80 disabled:opacity-40" onClick={onPaste} disabled={busy}>粘贴数据</button>
              <button type="button" className="h-9 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40" onClick={loadSample} disabled={busy}>加载样例数据</button>
              <button type="button" className="h-9 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40" onClick={() => source && runAnalysis(source, rulesText)} disabled={busy || !source}>重新分析</button>
            </div>
          </section>
          <RulesRuntimeSection
            rulesText={rulesText}
            setRulesText={setRulesText}
            rules={rules}
            rulesError={rulesError}
            rulesCheck={rulesCheck}
            checkRules={checkRules}
            applyRules={applyRules}
            clearRules={clearRules}
            fetchReference={fetchReference}
            busy={busy}
            cancelAnalysis={cancelAnalysis}
            forceAsync={forceAsync}
            setForceAsync={setForceAsync}
            csvInfer={csvInfer}
            toggleCsvInfer={toggleCsvInfer}
            features={features}
            featureDefs={FEATURE_DEFS}
            toggleFeature={toggleFeature}
            configOpen={configOpen}
            setConfigOpen={setConfigOpen}
            analyzeOptions={analyzeOptions}
            setAnalyzeOptions={setAnalyzeOptions}
            sampleFields={sampleFields}
          />
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
          <div data-tour="results-panel" className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
                  {t.label}{t.key === 'quality' && violationCount > 0 ? ` (${violationCount})` : ''}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <ErrorBoundary>
                {tab === 'fields' && <FieldTable fields={result.fieldStatistics || []} rules={rules} bare />}
                {tab === 'insights' && deepInsights && <InsightsPanel result={result} insights={deepInsights} features={features} fileName={fileName} />}
                {tab === 'values' && <ValueDistribution fields={result.fieldStatistics || []} bare />}
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
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">在左侧选择数据源，或打开「配置」编辑规则与 runtime。</p>
            <button type="button" className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90" onClick={() => fileInput.current?.click()}>选择文件</button>
          </div>
        ) : null}
      </main>
      {pasteOpen ? (
        <PasteDataModal open={pasteOpen} onClose={() => setPasteOpen?.(false)} onSubmit={onSubmitPaste} busy={busy} defaultFormat={defaultPasteFormat || 'json'} />
      ) : null}
      {preflightModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-[var(--elev)]">
            <h3 className="text-base font-medium">规则与数据可能不匹配</h3>
            <p className="mt-2 text-sm text-muted-foreground">预检发现规则字段与样本数据重叠不足，确认仍要继续分析？</p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" className="h-9 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted" onClick={() => { onImportSampleFields?.(); cancelPreflight?.(); }}>用样本字段更新规则</button>
              <button type="button" className="h-9 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted" onClick={cancelPreflight}>取消并修改规则</button>
              <button type="button" className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground" onClick={confirmPreflight}>仍然继续分析</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
