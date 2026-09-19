import { useEffect, useMemo, useState } from 'react';
import { Modal } from './ui/modal.jsx';
import RulesEditor, { RULES_TEMPLATE } from './RulesEditor.jsx';
import { parseJsonc } from '../utils.js';
import { cn } from '../lib/cn.js';

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
}) {
  const [tab, setTab] = useState('runtime');
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
    return bits.join(' · ');
  }, [applied, flatten, forceAsync, csvInfer, features]);

  const patchFlatten = (next) => {
    setFlatten(next);
    setRulesText((prev) => writeRuntimeIntoRulesText(prev || RULES_TEMPLATE, { flatten: next }));
  };

  const footer = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-[11px] text-muted-foreground line-clamp-1">{appliedSummary}</p>
      <div className="flex gap-2">
        <button
          type="button"
          className="h-9 rounded-lg px-3 text-sm text-muted-foreground hover:bg-muted"
          onClick={onClose}
        >
          关闭
        </button>
        <button
          type="button"
          className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
          disabled={busy}
          onClick={async () => {
            await onApply?.();
            onClose?.();
          }}
        >
          应用并关闭
        </button>
      </div>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="规则与运行配置"
      description="配置分析 runtime、字段规则 JSON，以及深度分析特征开关。"
      size="xl"
      footer={footer}
    >
      <div className="mb-4 flex gap-1 rounded-full bg-muted p-1 shadow-[var(--elev)]">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={cn(
              'flex-1 rounded-full px-3 py-1.5 text-sm transition-colors',
              tab === t.key
                ? 'bg-card text-foreground shadow-[var(--elev)]'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'runtime' ? (
        <div className="space-y-4">
          <section className="rounded-xl border border-border bg-muted/30 p-4">
            <h3 className="text-sm font-medium">解析 Runtime</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              写入规则 JSON 的 <code className="font-mono">runtime</code> 节点；旧版顶层{' '}
              <code className="font-mono">flatten</code> 会自动迁移。
            </p>
            <label className="mt-4 flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-0.5 size-4 rounded border-border"
                checked={flatten}
                disabled={busy}
                onChange={(e) => patchFlatten(e.target.checked)}
              />
              <span>
                <span className="text-sm">Flatten 嵌套对象</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  开启后将嵌套字段展开为点号路径（如 address.city）。
                </span>
              </span>
            </label>
          </section>

          <section className="rounded-xl border border-border bg-muted/30 p-4">
            <h3 className="text-sm font-medium">执行选项</h3>
            <p className="mt-1 text-xs text-muted-foreground">影响 API 调用方式，不写入规则文件。</p>
            <div className="mt-4 space-y-3">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 rounded border-border"
                  checked={!!csvInfer}
                  disabled={busy}
                  onChange={onToggleCsvInfer}
                />
                <span>
                  <span className="text-sm">CSV 数值推断</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    将可解析为数字的 CSV 单元格推断为 Number。
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 rounded border-border"
                  checked={!!forceAsync}
                  disabled={busy}
                  onChange={(e) => setForceAsync?.(e.target.checked)}
                />
                <span>
                  <span className="text-sm">强制后台分析</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    小文件也走异步作业 + 进度轮询；大文件默认已启用。
                  </span>
                </span>
              </label>
            </div>
          </section>
        </div>
      ) : null}

      {tab === 'rules' ? (
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
      ) : null}

      {tab === 'features' ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            深度分析特征会随分析请求一并提交；仅 CLI 的项前端无法开启。
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(featureDefs || []).map((fd) => (
              <label
                key={fd.key}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/30 p-3',
                  fd.cliOnly && 'opacity-50',
                )}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 rounded border-border"
                  checked={!!features?.[fd.key]}
                  disabled={fd.cliOnly || busy}
                  onChange={() => onToggleFeature?.(fd.key)}
                />
                <span>
                  <span className="text-sm">{fd.label}</span>
                  {fd.cliOnly ? (
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">仅 CLI</span>
                  ) : null}
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
