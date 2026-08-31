// 迷你直方图（数值对数直方图 / 时间直方图）
export default function Sparkline({ data, width = 90, height = 26 }) {
  if (!data || data.length === 0) return <span className="dim">-</span>;
  const max = Math.max(...data.map((d) => d.count));
  const barW = width / data.length;
  const label = (d) =>
    d.from.length > 10 ? `${d.from.slice(0, 10)} ~ ${d.to.slice(0, 10)}: ${d.count}` : `[${d.from}, ${d.to}): ${d.count}`;
  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      preserveAspectRatio="none"
    >
      {data.map((d, i) => {
        const h = Math.max(1.5, (d.count / max) * (height - 3));
        return (
          <rect key={i} x={i * barW + 0.5} y={height - h} width={Math.max(1, barW - 1.5)} height={h} rx={1}>
            <title>{label(d)}</title>
          </rect>
        );
      })}
    </svg>
  );
}
