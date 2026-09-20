import { useMemo } from 'react';
import { parseJsonc } from '../utils.js';
import { cn } from '../lib/cn.js';

const PARSE_TYPES = [
  { value: 'auto', label: 'auto', hint: '能解析 JSON 则解析，失败回退原文' },
  { value: 'json', label: 'json', hint: '严格 JSON，失败报错' },
  { value: 'json-string', label: 'json-string', hint: '先剥一层字符串引号再解析' },
  { value: 'none', label: 'none', hint: '原样字符串，不解析' },
];

function parseValueParsers(text) {
  try {
    if (!text?.trim()) return [];
    const obj = parseJsonc(text);
    const list = obj?.valueParsers;
    if (!Array.isArray(list)) return [];
    return list.map((item, i) => ({
      _id: `vp-${i}-${item?.source || ''}`,
      source: item?.source != null ? String(item.source) : '',
      parseType: item?.parseType || 'auto',
      flatten: item?.flatten,
      header: item?.header,
    }));
  } catch {
    return [];
  }
}

function writeValueParsersIntoText(text, list) {
  let obj;
  try {
    obj = text?.trim() ? parseJsonc(text) : {};
  } catch {
    obj = { runtime: { flatten: true }, fields: {} };
  }
  if (!obj || typeof obj !== 'object') obj = {};

  const cleaned = (list || [])
    .map((row) => {
      const source = String(row.source || '').trim();
      if (!source) return null;
      const entry = { source };
      const pt = row.parseType || 'auto';
      if (pt) entry.parseType = pt;
      if (row.flatten === true) entry.flatten = true;
      if (row.flatten === false) entry.flatten = false;
      if (row.header !== '' && row.header != null && row.header !== undefined) {
        const n = Number(row.header);
        if (!Number.isNaN(n)) entry.header = n;
      }
      return entry;
    })
    .filter(Boolean);

  if (cleaned.length) obj.valueParsers = cleaned;
  else delete obj.valueParsers;

  return `${JSON.stringify(obj, null, 2)}\n`;
}

/**
 * Visual editor for top-level valueParsers[] —
 * Excel/CSV columns whose cell text should be parsed as JSON (or kept as string).
 */
export default function VisualValueParsers({ text, setText, busy }) {
  const rows = useMemo(() => parseValueParsers(text), [text]);

  const commit = (nextList) => setText?.(writeValueParsersIntoText(text, nextList));

  const updateRow = (index, patch) => {
    const next = rows.map((r, i) => (i === index ? { ...r, ...patch } : r));
    commit(next);
  };

  const removeRow = (index) => {
    commit(rows.filter((_, i) => i !== index));
  };

  const addRow = () => {
    commit([
      ...rows,
      { source: '', parseType: 'auto', flatten: undefined, header: 1 },
    ]);
  };

  return (
    <section className="rounded-xl border border-border bg-muted/20 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium">值解析器 valueParsers</h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            仅对 Excel / CSV 生效：把指定列的单元格按 JSON 解析后再统计。普通 JSON/JSONL/XML/YAML 配置了也不会改写解析器。
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={addRow}
          className="h-8 shrink-0 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
        >
          添加列
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="mt-3 rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
          未配置。适合「某一列整格是 JSON 字符串」的表格场景。
        </div>
      ) : (
        <ul className="mt-3 space-y-3">
          {rows.map((row, index) => (
            <li
              key={row._id || index}
              className="rounded-xl border border-border bg-background p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">列 #{index + 1}</span>
                <button
                  type="button"
                  disabled={busy}
                  className="text-xs text-danger hover:underline disabled:opacity-40"
                  onClick={() => removeRow(index)}
                >
                  删除
                </button>
              </div>

              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-[11px] text-muted-foreground">
                    source（列定位）
                  </span>
                  <input
                    className="h-9 w-full rounded-lg border border-border bg-muted/30 px-2.5 font-mono text-sm outline-none focus:border-primary/40"
                    placeholder="header≥1 用表头标题；header=0 用列字母如 B"
                    disabled={busy}
                    value={row.source}
                    onChange={(e) => updateRow(index, { source: e.target.value })}
                  />
                </label>

                <div className="sm:col-span-2">
                  <div className="mb-1.5 text-[11px] text-muted-foreground">parseType</div>
                  <div className="flex flex-wrap gap-1.5">
                    {PARSE_TYPES.map((pt) => (
                      <button
                        key={pt.value}
                        type="button"
                        disabled={busy}
                        title={pt.hint}
                        onClick={() => updateRow(index, { parseType: pt.value })}
                        className={cn(
                          'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                          (row.parseType || 'auto') === pt.value
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {pt.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {PARSE_TYPES.find((p) => p.value === (row.parseType || 'auto'))?.hint}
                  </p>
                </div>

                <label className="block">
                  <span className="mb-1 block text-[11px] text-muted-foreground">
                    header（表头行号）
                  </span>
                  <input
                    type="number"
                    min={0}
                    className="h-9 w-full rounded-lg border border-border bg-muted/30 px-2 text-sm outline-none focus:border-primary/40"
                    placeholder="1=首行表头，0=无表头"
                    disabled={busy}
                    value={row.header ?? ''}
                    onChange={(e) =>
                      updateRow(index, {
                        header: e.target.value === '' ? undefined : e.target.value,
                      })
                    }
                  />
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">
                    0 无表头 · 1 默认首行 · ≥2 第 N 行为表头
                  </span>
                </label>

                <div>
                  <div className="mb-1.5 text-[11px] text-muted-foreground">flatten（本列）</div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { value: undefined, label: '跟随全局' },
                      { value: true, label: '展开' },
                      { value: false, label: '不展开' },
                    ].map((opt) => (
                      <button
                        key={String(opt.value)}
                        type="button"
                        disabled={busy}
                        onClick={() => updateRow(index, { flatten: opt.value })}
                        className={cn(
                          'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                          row.flatten === opt.value
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
