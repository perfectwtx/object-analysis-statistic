import { useMemo, useState } from 'react';
import Sparkline from './Sparkline.jsx';
import {
  TableShell, Table, THead, TH, TBody, TR, TD, EmptyRow,
} from './ui/data-table.jsx';
import { useT } from '../lib/i18n.js';

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

function TypeBadge({ type }) {
  if (!type) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
      {type}
    </span>
  );
}

export default function FieldTable({ fields = [], rules, bare }) {
  const { t } = useT();
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

  const table = (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
          placeholder={t('filterFields')}
          className="h-9 w-full max-w-xs rounded-lg bg-muted px-3 text-sm shadow-[var(--elev)] outline-none placeholder:text-muted-foreground"
        />
        <span className="text-xs text-muted-foreground">{filtered.length} {t('fieldsCount')}</span>
      </div>

      <TableShell maxHeight="min(60vh, 520px)">
        <Table dense className="min-w-[960px]">
          <THead sticky>
            <tr>
              <TH sticky className="min-w-[9rem]">{t('field')}</TH>
              <TH>{t('semantic')}</TH>
              <TH className="min-w-[7.5rem]">{t('coverage')}</TH>
              <TH>{t('primaryType')}</TH>
              <TH align="right">{t('distinct')}</TH>
              <TH align="right">{t('count')}</TH>
              <TH>{t('defaultValue')}</TH>
              <TH>{t('distribution')}</TH>
              <TH>{t('rules')}</TH>
              <TH>{t('topValues')}</TH>
            </tr>
          </THead>
          <TBody>
            {rows.map((f) => (
              <TR key={f.fieldName}>
                <TD sticky mono className="bg-card group-hover:bg-muted/30">
                  <div className="max-w-[11rem] truncate" title={f.fieldName}>
                    {f.fieldName}
                  </div>
                  {f.outlierCount > 0 ? (
                    <span
                      className="mt-1 inline-block rounded bg-warn/15 px-1.5 py-0.5 text-[10px] text-warn"
                      title={`${f.outlierMethod || 'IQR'} outliers ${f.outlierCount}`}
                    >
                      ×{f.outlierCount}
                    </span>
                  ) : null}
                </TD>
                <TD muted className="whitespace-nowrap text-xs">
                  {f.semanticType || '—'}
                </TD>
                <TD>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-ok"
                        style={{ width: `${Math.min(100, (f.coverage ?? 0) * 100)}%` }}
                      />
                    </div>
                    <span className="w-12 text-right tabular-nums text-xs">
                      {((f.coverage ?? 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                </TD>
                <TD>
                  <TypeBadge type={f.primaryType} />
                </TD>
                <TD align="right" className="text-xs">
                  {f.distinctCount ?? '—'}
                </TD>
                <TD align="right" className="text-xs">
                  {f.count ?? '—'}
                </TD>
                <TD mono muted className="max-w-[6rem] truncate" title={f.defaultValue ?? ''}>
                  {f.defaultValue ?? '—'}
                </TD>
                <TD>
                  {f.histogram || f.dateHistogram ? (
                    <Sparkline data={f.histogram || f.dateHistogram} />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TD>
                <TD>
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
                    <span className="text-muted-foreground">—</span>
                  )}
                </TD>
                <TD>
                  <div className="flex max-w-[11rem] flex-wrap gap-1">
                    {Object.entries(f.valueCounts || {})
                      .slice(0, 3)
                      .map(([v, c]) => (
                        <span
                          key={v}
                          className="max-w-[7rem] truncate rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                          title={`${v} × ${c}`}
                        >
                          {(v.length > 10 ? `${v.slice(0, 10)}…` : v) || '(empty)'} ×{c}
                        </span>
                      ))}
                  </div>
                </TD>
              </TR>
            ))}
            {rows.length === 0 ? <EmptyRow colSpan={10}>{t('noMatchingFields')}</EmptyRow> : null}
          </TBody>
        </Table>
      </TableShell>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <button
          type="button"
          className="rounded-lg px-3 py-1.5 hover:bg-muted disabled:opacity-40"
          disabled={cur === 0}
          onClick={() => setPage(cur - 1)}
        >
          {t('prevPage')}
        </button>
        <span className="tabular-nums">
          {cur + 1} / {pages}
          <span className="mx-1 text-border">·</span>
          {filtered.length}
        </span>
        <button
          type="button"
          className="rounded-lg px-3 py-1.5 hover:bg-muted disabled:opacity-40"
          disabled={cur >= pages - 1}
          onClick={() => setPage(cur + 1)}
        >
          {t('nextPage')}
        </button>
      </div>
    </>
  );

  if (bare) return <div>{table}</div>;
  return <div className="rounded-xl bg-card p-4 shadow-[var(--elev)]">{table}</div>;
}
