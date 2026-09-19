import { useT } from '../lib/i18n.js';

export default function OverviewCards({ result }) {
  const { t } = useT();
  if (!result) return null;
  const fields = result.fieldStatistics || [];
  const avgCov =
    fields.length === 0
      ? null
      : (fields.reduce((s, f) => s + (f.coverage ?? 0), 0) / fields.length) * 100;

  const cards = [
    { label: t('totalObjects'), value: fmt(result.totalObjects) },
    { label: t('uniqueObjects'), value: fmt(result.totalUniqueObjects) },
    { label: t('duplicateGroups'), value: fmt(result.totalDuplicateGroups) },
    { label: t('fieldCount'), value: fmt(fields.length) },
    { label: t('avgCoverage'), value: avgCov == null ? '—' : `${avgCov.toFixed(1)}%` },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl bg-muted/60 px-3 py-3 shadow-[var(--elev)]">
          <div className="text-[11px] text-muted-foreground">{c.label}</div>
          <div className="mt-1 text-lg font-medium tabular-nums tracking-tight">{c.value}</div>
        </div>
      ))}
    </div>
  );
}

function fmt(v) {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString();
}
