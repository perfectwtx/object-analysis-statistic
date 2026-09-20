import { useEffect, useMemo, useState } from 'react';
import { Modal } from './ui/modal.jsx';
import RulesEditor, { RULES_TEMPLATE } from './RulesEditor.jsx';
import VisualFieldRules from './VisualFieldRules.jsx';
import { parseJsonc } from '../utils.js';
import { cn } from '../lib/cn.js';
import { ANALYZE_OPTION_DEFS } from '../lib/analyzeOptions.js';

const TABS = [
  { key: 'runtime', label: 'Runtime' },
  { key: 'rules', label: 'Rules' },
  { key: 'features', label: 'Features' },
];

export function readRuntimeFromRulesText(text) {
  try {
    if (!text?.trim()) return { flatten: true };
    const obj = parseJsonc(text);
    const flatten =
      obj?.runtime?.flatten != null
        ? !!obj.runtime.flatten
        : obj?.flatten != null
          ? !!obj.flatten
          : true;
    return { flatten };
  } catch {
    return { flatten: true };
  }
}

export function writeRuntimeIntoRulesText(text, runtime) {
  let obj;
  try {
    obj = text?.trim() ? parseJsonc(text) : {};
  } catch {
    return text;
  }
  if (!obj || typeof obj !== 'object') obj = {};
  const next = { ...obj };
  delete next.flatten;
  next.runtime = { ...(next.runtime || {}), flatten: !!runtime.flatten };
  return JSON.stringify(next, null, 2);
}

export default function RulesConfigModal({
  open,
  onClose,
  rulesText,
  setRulesText,
  rulesError,
  rulesCheck,
  onValidate,
  onApply,
  onClear,
  onFetchReference,
  applied,
  busy,
  forceAsync,
  setForceAsync,
  csvInfer,
  onToggleCsvInfer,
  features,
  featureDefs,
  onToggleFeature,
  analyzeOptions,
  setAnalyzeOptions,
}) {
  const [tab, setTab] = useState('runtime');
  const [rulesMode, setRulesMode] = useState('visual');
  const [flatten, setFlatten] = useState(true);

  useEffect(() => {
    if (!open) return;
    setFlatten(readRuntimeFromRulesText(rulesText).flatten);
    setTab('runtime');
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const appliedSummary = useMemo(() => {
    const bits = [];
    if (applied) bits.push('规则已应用');
    bits.push(flatten ? 'flatten' : 'no-flatten');
    if (forceAsync) bits.push('强制异步');
    if (csvInfer) bits.push('CSV 推断');
    const on = Object.entries(features || {}).filter(([, v]) => v).length;
    bits.push(`${on} 项特征`);
    if (analyzeOptions?.recordPath) bits.push('recordPath');
    if (analyzeOptions?.rootPath) bits.push('rootPath');
    if (analyzeOptions?.fields) bits.push('字段过滤');
    if (analyzeOptions?.allowUnknownRules) bits.push('允许未知规则');
    return bits.join(' · ');
  }, [applied, flatten, forceAsync, csvInfer, features, analyzeOptions]);

  const patchFlatten = (next) => {
    setFlatten(next);
    setRulesText((prev) => writeRuntimeIntoRulesText(prev || RULES_TEMPLATE, { flatten: next }));
  };

  const footer = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-[11px] text-muted-foreground line-clamp-1">{appliedSummary}</p>
      <div className="flex gap-2">
        <button type="button" className="h-9 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted" onClick={onClose}>关闭</button>
        <button
          type="button"
          className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
          disabled={busy}
          onClick={async () => { await onApply?.(); onClose?.(); }}
        >应用并关闭</button>
      </div>
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title="规则与运行配置" description="配置分析 runtime、接口参数、字段规则与深度特征。" size="xl" footer={footer}>
      <div className="mb-4 flex gap-1 rounded-full bg-muted p-1 shadow-[var(--elev)]">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={cn('flex-1 rounded-full px-3 py-1.5 text-sm transition-colors', tab === t.key ? 'bg-card text-foreground shadow-[var(--elev)]' : 'text-muted-foreground hover:text-foreground')}
            onClick={() => setTab(t.key)}
          >{t.label}</button>
        ))}
      </div>

      {tab === 'runtime' ? (
        <div className="space-y-4">
          <section className="rounded-xl border border-border bg-muted/30 p-4">
            <h3 className="text-sm font-medium">解析 Runtime</h3>
            <p className="mt-1 text-xs text-muted-foreground">写入规则 JSON 的 <code className="font-mono">runtime</code> 节点。</p>
            <label className="mt-4 flex cursor-pointer items-start gap-3">
              <input type="checkbox" className="mt-0.5 size-4 rounded border-border" checked={flatten} disabled={busy} onChange={(e) => patchFlatten(e.target.checked)} />
              <span>
                <span className="text-sm">展开嵌套对象 (flatten)</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">将嵌套字段展平为点路径，便于按字段写规则。</span>
              </span>
            </label>
          </section>

          <section className="rounded-xl border border-border bg-muted/30 p-4">
            <h3 className="text-sm font-medium">请求行为</h3>
            <div className="mt-3 space-y-3">
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" className="mt-0.5 size-4 rounded border-border" checked={!!csvInfer} disabled={busy} onChange={() => onToggleCsvInfer?.()} />
                <span>
                  <span className="text-sm">CSV 数字推断</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">将可解析为数字的 CSV 单元格推断为 Number。</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" className="mt-0.5 size-4 rounded border-border" checked={!!forceAsync} disabled={busy} onChange={(e) => setForceAsync?.(e.target.checked)} />
                <span>
                  <span className="text-sm">强制后台分析</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">小文件也走异步作业 + 进度轮询；大文件默认已启用。</span>
                </span>
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-muted/30 p-4">
            <h3 className="text-sm font-medium">分析接口参数</h3>
            <p className="mt-1 text-xs text-muted-foreground">对应 POST /analyze 与 /analyze/async 的表单字段（rulesJson / features 除外）。</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {ANALYZE_OPTION_DEFS.map((d) => {
                const val = analyzeOptions?.[d.key];
                if (d.type === 'bool') {
                  return (
                    <label key={d.key} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background px-3 py-2.5 sm:col-span-2">
                      <input
                        type="checkbox"
                        className="mt-0.5 size-4 rounded border-border"
                        checked={!!val}
                        disabled={busy}
                        onChange={(e) => setAnalyzeOptions?.((prev) => ({ ...(prev || {}), [d.key]: e.target.checked }))}
                      />
                      <span>
                        <span className="text-sm font-medium">{d.label}</span>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">{d.hint}</span>
                      </span>
                    </label>
                  );
                }
                return (
                  <label key={d.key} className="block">
                    <span className="mb-1 flex flex-col gap-0.5">
                      <span className="text-xs font-medium">{d.label}</span>
                      <span className="text-[10px] text-muted-foreground">{d.hint}</span>
                    </span>
                    <input
                      type={d.type === 'number' ? 'number' : 'text'}
                      min={d.min}
                      className="h-9 w-full rounded-lg border border-border bg-background px-2.5 font-mono text-sm outline-none focus:border-primary/40"
                      placeholder={d.placeholder}
                      disabled={busy}
                      value={val ?? ''}
                      onChange={(e) => setAnalyzeOptions?.((prev) => ({ ...(prev || {}), [d.key]: e.target.value }))}
                    />
                  </label>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}

      {tab === 'rules' ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex rounded-full bg-muted p-0.5 shadow-[var(--elev)]">
              {[ { key: 'visual', label: '可视化' }, { key: 'json', label: 'JSON' } ].map((m) => (
                <button
                  key={m.key}
                  type="button"
                  className={cn('rounded-full px-3 py-1 text-xs font-medium transition-colors', rulesMode === m.key ? 'bg-card text-foreground shadow-[var(--elev)]' : 'text-muted-foreground hover:text-foreground')}
                  onClick={() => setRulesMode(m.key)}
                >{m.label}</button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">{rulesMode === 'visual' ? '点选字段属性，自动同步 JSON' : '直接编辑完整规则文档'}</p>
          </div>
          {rulesMode === 'visual' ? (
            <VisualFieldRules text={rulesText} setText={setRulesText} busy={busy} />
          ) : (
            <RulesEditor
              text={rulesText}
              setText={setRulesText}
              error={rulesError}
              check={rulesCheck}
              onValidate={onValidate}
              onApply={onApply}
              onClear={onClear}
              onFetchReference={onFetchReference}
              applied={applied}
              busy={busy}
            />
          )}
        </div>
      ) : null}

      {tab === 'features' ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">深度分析特征会随分析请求一并提交；仅 CLI 的项前端无法开启。</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(featureDefs || []).map((fd) => (
              <label key={fd.key} className={cn('flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/30 p-3', fd.cliOnly && 'opacity-50')}>
                <input type="checkbox" className="mt-0.5 size-4 rounded border-border" checked={!!features?.[fd.key]} disabled={fd.cliOnly || busy} onChange={() => onToggleFeature?.(fd.key)} />
                <span>
                  <span className="text-sm">{fd.label}</span>
                  {fd.cliOnly ? <span className="mt-0.5 block text-[10px] text-muted-foreground">仅 CLI</span> : null}
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
