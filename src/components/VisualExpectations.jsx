import { useMemo } from 'react';
import { parseJsonc } from '../utils.js';

const EXPECTATION_DEFS = [
  { key: 'minRowCount', label: '最少行数', hint: '对象/行数量下限', placeholder: '3' },
  { key: 'maxRowCount', label: '最多行数', hint: '对象/行数量上限', placeholder: '可选' },
  { key: 'maxDuplicateRate', label: '最大重复率', hint: '0–1，超过则违规', placeholder: '0' },
  { key: 'minCoverage', label: '最小覆盖率', hint: '全局覆盖率下限 0–1', placeholder: '可选' },
];

function parseExpectations(text) {
  try {
    if (!text?.trim()) return {};
    const obj = parseJsonc(text);
    const e = obj?.expectations;
    if (!e || typeof e !== 'object') return {};
    return { ...e };
  } catch {
    return {};
  }
}

function writeExpectationsIntoText(text, expectations) {
  let obj;
  try {
    obj = text?.trim() ? parseJsonc(text) : {};
  } catch {
    obj = { runtime: { flatten: true }, fields: {}, expectations: {} };
  }
  if (!obj || typeof obj !== 'object') obj = {};
  const cleaned = {};
  for (const [k, v] of Object.entries(expectations || {})) {
    if (v === '' || v === null || v === undefined) continue;
    const n = Number(v);
    cleaned[k] = Number.isNaN(n) ? v : n;
  }
  if (Object.keys(cleaned).length) obj.expectations = cleaned;
  else delete obj.expectations;
  return `${JSON.stringify(obj, null, 2)}\n`;
}

/** Dataset-level expectations editor (rules.expectations). */
export default function VisualExpectations({ text, setText, busy }) {
  const expectations = useMemo(() => parseExpectations(text), [text]);

  return (
    <section className="rounded-xl border border-border bg-muted/20 p-3">
      <h3 className="text-sm font-medium">数据集期望 expectations</h3>
      <p className="mt-1 text-[11px] text-muted-foreground">
        写入规则 JSON 的 expectations 节点，分析后由后端校验整份数据。
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {EXPECTATION_DEFS.map((d) => (
          <label key={d.key} className="block">
            <span className="mb-1 flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium">{d.label}</span>
              <span className="text-[10px] text-muted-foreground">{d.hint}</span>
            </span>
            <input
              type="number"
              step="any"
              className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus:border-primary/40"
              placeholder={d.placeholder}
              disabled={busy}
              value={expectations[d.key] ?? ''}
              onChange={(e) => {
                const next = { ...expectations };
                if (e.target.value === '') delete next[d.key];
                else next[d.key] = e.target.value;
                setText?.(writeExpectationsIntoText(text, next));
              }}
            />
          </label>
        ))}
      </div>
    </section>
  );
}
