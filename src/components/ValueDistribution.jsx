const TOP_N = 8;

export default function ValueDistribution({ fields, bare }) {
  const list = (fields || []).filter((f) => Object.keys(f.valueCounts || {}).length > 0);

  if (list.length === 0) {
    return (
      <div className={bare ? '' : 'rounded-xl bg-card p-4 shadow-[var(--elev)]'}>
        <div className="py-8 text-center text-sm text-muted-foreground">后端未返回取值分布。</div>
      </div>
    );
  }

  return (
    <div className={bare ? '' : 'rounded-xl bg-card p-4 shadow-[var(--elev)]'}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium">取值分布（每字段 Top {TOP_N}）</h3>
        <span className="text-xs text-muted-foreground">{list.length} 个字段有统计</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((f) => {
          const entries = Object.entries(f.valueCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, TOP_N);
          const max = entries[0]?.[1] || 1;
          const total = f.count || entries.reduce((s, [, c]) => s + c, 0);
          const distinct = f.distinctApproximate ? `≈${f.distinctCount}` : String(f.distinctCount);

          return (
            <div key={f.fieldName} className="rounded-xl border border-border bg-muted/30 p-3">
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-xs">{f.fieldName}</span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {f.primaryType}
                </span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  唯一 {distinct}
                </span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  n={f.count}
                </span>
                {f.valueCountsTruncated ? (
                  <span className="rounded bg-warn/15 px-1.5 py-0.5 text-[10px] text-warn">已截断</span>
                ) : null}
              </div>
              <div className="space-y-1.5">
                {entries.map(([v, c]) => (
                  <div key={v} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 text-xs">
                    <div className="min-w-0">
                      <div className="truncate font-mono text-muted-foreground" title={v}>
                        {v === '' ? '(空字符串)' : v}
                      </div>
                      <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary/70"
                          style={{ width: `${(c / max) * 100}%` }}
                        />
                      </div>
                    </div>
                    <span className="tabular-nums">{c}</span>
                    <span className="w-12 text-right tabular-nums text-muted-foreground">
                      {total ? ((c / total) * 100).toFixed(1) : '0.0'}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
