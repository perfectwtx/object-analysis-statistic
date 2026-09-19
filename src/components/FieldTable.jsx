import { useMemo, useState } from 'react';
import Sparkline from './Sparkline.jsx';

const PAGE = 20;
const RULE_KEY_LABELS = {
  required: '必填',
  unique: '唯一',
  enumValues: '枚举',
  pattern: '正则',
  minValue: '最小',
  maxValue: '最大',
  nullRateMax: '空值上限',
  transform: '转换',
};

function fmt(v) {
  if (v == null || v === '') return '—';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(3);
  return String(v);
}

function fmtBounds(b) {
  if (!b) return '—';
  if (Array.isArray(b)) return b.map(fmt).join(', ');
  return String(b);
}

function TypeBadge({ t }) {
  if (!t) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
      {t}
    </span>
  );
}

export default function FieldTable({ fields = [], rules, bare }) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);

  const fieldRules = rules?.fields || {};

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return fields;
    return fields.filter((f) => (f.fieldName || '').toLowerCase().includes(s));
  }, [fields, q]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const rows = filtered.slice(cur * PAGE, cur * PAGE + PAGE);

  return (
    <div className={bare ? '' : 'rounded-xl bg-card p-4 shadow-[var(--elev)]'}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
          placeholder="筛选字段…"
          className="h-9 w-full max-w-xs rounded-lg bg-muted px-3 text-sm shadow-[var(--elev)] outline-none placeholder:text-muted-foreground"
        />
        <span className="text-xs text-muted-foreground">{filtered.length} 个字段</span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
              <th className="px-3 py-2.5 font-medium">字段</th>
              <th className="px-3 py-2.5 font-medium">语义</th>
              <th className="px-3 py-2.5 font-medium min-w-[120px]">覆盖率</th>
              <th className="px-3 py-2.5 font-medium">类型</th>
              <th className="px-3 py-2.5 font-medium">唯一</th>
              <th className="px-3 py-2.5 font-medium">计数</th>
              <th className="px-3 py-2.5 font-medium">默认值</th>
              <th className="px-3 py-2.5 font-medium">分布</th>
              <th className="px-3 py-2.5 font-medium">规则</th>
              <th className="px-3 py-2.5 font-medium">高频值</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr key={f.fieldName} className="border-b border-border/70 last:border-0 align-top">
                <td className="px-3 py-2.5">
                  <div className="font-mono text-xs">{f.fieldName}</div>
                  {f.outlierCount > 0 ? (
                    <span
                      className="mt-1 inline-block rounded bg-warn/15 px-1.5 py-0.5 text-[10px] text-warn"
                      title={`${f.outlierMethod || 'IQR'} 异常 ${f.outlierCount} · 边界 [${fmtBounds(f.outlierBounds)}]`}
                    >
                      异常×{f.outlierCount}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">
                  {f.semanticType || '—'}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-ok"
                        style={{ width: `${Math.min(100, (f.coverage ?? 0) * 100)}%` }}
                      />
                    </div>
                    <span className="tabular-nums text-xs">
                      {((f.coverage ?? 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <TypeBadge t={f.primaryType} />
                </td>
                <td className="px-3 py-2.5 tabular-nums text-xs">{f.distinctCount ?? '—'}</td>
                <td className="px-3 py-2.5 tabular-nums text-xs">{f.count ?? '—'}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                  {f.defaultValue ?? '—'}
                </td>
                <td className="px-3 py-2.5">
                  {f.histogram || f.dateHistogram ? (
                    <Sparkline data={f.histogram || f.dateHistogram} />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  {fieldRules[f.fieldName] ? (
                    <div className="flex flex-wrap gap-1">
                      {[
                        ...new Set(
                          Object.keys(fieldRules[f.fieldName])
                            .map((k) => RULE_KEY_LABELS[k])
                            .filter(Boolean),
                        ),
                      ].map((l) => (
                        <span
                          key={l}
                          className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary"
                        >
                          {l}
                        </span>
                      ))}
                    </div>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex max-w-[180px] flex-wrap gap-1">
                    {Object.entries(f.valueCounts || {})
                      .slice(0, 3)
                      .map(([v, c]) => (
                        <span
                          key={v}
                          className="truncate rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                          title={`${v} × ${c}`}
                        >
                          {(v.length > 10 ? `${v.slice(0, 10)}…` : v) || '(空)'} ×{c}
                        </span>
                      ))}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-10 text-center text-muted-foreground">
                  无匹配字段
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <button
          type="button"
          className="rounded-lg px-3 py-1.5 hover:bg-muted disabled:opacity-40"
          disabled={cur === 0}
          onClick={() => setPage(cur - 1)}
        >
          上一页
        </button>
        <span>
          {cur + 1} / {pages}（共 {filtered.length}）
        </span>
        <button
          type="button"
          className="rounded-lg px-3 py-1.5 hover:bg-muted disabled:opacity-40"
          disabled={cur >= pages - 1}
          onClick={() => setPage(cur + 1)}
        >
          下一页
        </button>
      </div>
    </div>
  );
}
