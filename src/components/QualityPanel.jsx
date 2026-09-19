export default function QualityPanel({ violations = [], bare }) {
  if (!violations.length) {
    return (
      <div className={bare ? '' : 'rounded-xl bg-card p-4 shadow-[var(--elev)]'}>
        <div className="rounded-xl bg-ok/10 px-4 py-8 text-center text-sm text-ok">
          未发现质量违规
        </div>
      </div>
    );
  }

  return (
    <div className={bare ? '' : 'rounded-xl bg-card p-4 shadow-[var(--elev)]'}>
      <div className="mb-3 text-sm font-medium">
        质量违规
        <span className="ml-2 rounded-full bg-danger/15 px-2 py-0.5 text-xs text-danger">
          {violations.length}
        </span>
      </div>
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
              <th className="px-3 py-2.5 font-medium">字段</th>
              <th className="px-3 py-2.5 font-medium">检查项</th>
              <th className="px-3 py-2.5 font-medium">数量</th>
              <th className="px-3 py-2.5 font-medium">说明</th>
            </tr>
          </thead>
          <tbody>
            {violations.map((v, i) => (
              <tr key={i} className="border-b border-border/70 last:border-0 align-top">
                <td className="px-3 py-2.5 font-mono text-xs">{v.field || v.Field || '（数据集）'}</td>
                <td className="px-3 py-2.5">{v.check || v.Check || v.rule || '—'}</td>
                <td className="px-3 py-2.5 tabular-nums">{v.count ?? v.Count ?? '—'}</td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">
                  {v.message || v.Message || v.detail || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
