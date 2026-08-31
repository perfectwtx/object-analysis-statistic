// 取值分布：直接渲染后端 FieldStatistic.valueCounts，不需要原始数据，
// 因此大文件、压缩包、xlsx 等无法在浏览器展开的数据源同样可用。

const TOP_N = 8;

export default function ValueDistribution({ fields, bare }) {
  const list = (fields || []).filter((f) => {
    const vc = f.valueCounts || {};
    return Object.keys(vc).length > 0;
  });

  if (list.length === 0) {
    return (
      <div className={bare ? '' : 'panel'}>
        <div className="empty-tab">后端未返回取值分布。</div>
      </div>
    );
  }

  return (
    <div className={bare ? '' : 'panel'}>
      <div className="vd-head">
        <h3>取值分布（每字段 Top {TOP_N}）</h3>
        <span className="dim">{list.length} 个字段有取值统计</span>
      </div>
      <div className="vd-list">
        {list.map((f) => {
          const entries = Object.entries(f.valueCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, TOP_N);
          const max = entries[0]?.[1] || 1;
          const total = f.count || entries.reduce((s, [, c]) => s + c, 0);
          const distinct = f.distinctApproximate
            ? `≈${f.distinctCount}`
            : String(f.distinctCount);

          return (
            <div className="vd-card" key={f.fieldName}>
              <div className="vd-title">
                <span className="mono">{f.fieldName}</span>
                <span className="chip">{f.primaryType}</span>
                <span className="chip">唯一 {distinct}</span>
                <span className="chip">n={f.count}</span>
                {f.valueCountsTruncated && (
                  <span className="chip warn-chip" title="取值种类过多，后端只保留高频部分">已截断</span>
                )}
              </div>
              <div className="vd-rows">
                {entries.map(([v, c]) => (
                  <div className="vd-row" key={v}>
                    <span className="vd-val mono" title={v}>{v === '' ? '(空字符串)' : v}</span>
                    <div className="vd-bar-wrap">
                      <div className="vd-bar" style={{ width: `${(c / max) * 100}%` }} />
                    </div>
                    <span className="vd-count">{c}</span>
                    <span className="vd-pct">{total ? ((c / total) * 100).toFixed(1) : '0.0'}%</span>
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
