import RulesConfigModal, { readRuntimeFromRulesText } from './RulesConfigModal.jsx';

/**
 * Sidebar: rules summary + config modal entry.
 */
export default function RulesRuntimeSection({
  rulesText,
  setRulesText,
  rules,
  rulesError,
  rulesCheck,
  checkRules,
  applyRules,
  clearRules,
  fetchReference,
  busy,
  cancelAnalysis,
  forceAsync,
  setForceAsync,
  csvInfer,
  toggleCsvInfer,
  features,
  featureDefs,
  toggleFeature,
  configOpen,
  setConfigOpen,
}) {
  return (
    <>
      <section className="p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">规则与运行</div>
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-muted px-2.5 text-xs font-medium text-foreground shadow-[var(--elev)] hover:bg-muted/80 disabled:opacity-40"
            onClick={() => setConfigOpen(true)}
            disabled={busy}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" strokeLinecap="round" />
            </svg>
            配置
          </button>
        </div>
        <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          <div className="flex flex-wrap gap-1.5">
            <span className={`rounded-full px-2 py-0.5 ${rules ? 'bg-ok/15 text-ok' : 'bg-muted text-muted-foreground'}`}>
              {rules ? '规则已应用' : '未应用规则'}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5">
              {readRuntimeFromRulesText(rulesText).flatten ? 'flatten' : 'no-flatten'}
            </span>
            {csvInfer ? <span className="rounded-full bg-muted px-2 py-0.5">CSV 推断</span> : null}
            {forceAsync ? <span className="rounded-full bg-muted px-2 py-0.5">强制异步</span> : null}
            <span className="rounded-full bg-muted px-2 py-0.5">
              {Object.values(features).filter(Boolean).length}/{featureDefs.length} 特征
            </span>
          </div>
          {rulesError ? <div className="mt-2 text-danger">{rulesError}</div> : null}
          {rulesCheck?.state === 'ok' ? <div className="mt-2 text-ok">校验通过</div> : null}
          {rulesCheck?.state === 'error' ? <div className="mt-2 text-danger">{rulesCheck.message}</div> : null}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            className="h-9 rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
            onClick={applyRules}
            disabled={busy}
          >
            应用规则
          </button>
          <button
            type="button"
            className="h-9 rounded-lg bg-muted text-sm text-muted-foreground shadow-[var(--elev)] hover:text-foreground disabled:opacity-40"
            onClick={() => setConfigOpen(true)}
            disabled={busy}
          >
            编辑 JSON
          </button>
        </div>
        {busy ? (
          <button type="button" className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-lg text-sm text-danger hover:bg-danger/10" onClick={cancelAnalysis}>取消分析</button>
        ) : null}
      </section>
      <RulesConfigModal
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        rulesText={rulesText}
        setRulesText={setRulesText}
        rulesError={rulesError}
        rulesCheck={rulesCheck}
        onValidate={(x) => checkRules(x ?? rulesText)}
        onApply={applyRules}
        onClear={clearRules}
        onFetchReference={fetchReference}
        applied={!!rules}
        busy={busy}
        forceAsync={forceAsync}
        setForceAsync={setForceAsync}
        csvInfer={csvInfer}
        onToggleCsvInfer={toggleCsvInfer}
        features={features}
        featureDefs={featureDefs}
        onToggleFeature={toggleFeature}
      />
    </>
  );
}
