export default function OverviewCards({ result }) {
  if (!result) return null;
  const fields = result.fieldStatistics || [];
  const avgCov =
    fields.length === 0
      ? null
      : (fields.reduce((s, f) => s + (f.coverage ?? 0), 0) / fields.length) * 100;

  const cards = [
    { label: '对象总数', value: fmt(result.totalObjects) },
    { label: '唯一对象', value: fmt(result.totalUniqueObjects) },
    { label: '重复组', value: fmt(result.totalDuplicateGroups) },
    { label: '字段数', value: fmt(fields.length) },
    { label: '平均覆盖率', value: avgCov == null ? '—' : `${avgCov.toFixed(1)}%` },
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
