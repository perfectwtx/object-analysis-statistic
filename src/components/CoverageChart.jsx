import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { labelLayout, shortenLabel } from '../utils.js';
import { chartColors, useTheme } from '../theme.js';

export default function CoverageChart({ fields }) {
  // recharts 的 stroke / stopColor 是 SVG 呈现属性，写 var(--x) 不会被解析，只能在 JS 里按主题取色
  const { theme } = useTheme();
  const c = chartColors(theme);

  const top = (fields || []).slice(0, 20);
  if (top.length === 0) return null;

  const data = top.map((f) => ({
    name: f.fieldName,
    覆盖率: +((f.coverage ?? 0) * 100).toFixed(1),
  }));
  const { bottom, height, angle } = labelLayout(data.map((d) => d.name));

  return (
    <div className="panel">
      <h3>字段覆盖率（Top 20）</h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 16, bottom, left: 8 }}>
          <defs>
            <linearGradient id="covGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c.barFrom} />
              <stop offset="100%" stopColor={c.barTo} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
          <XAxis
            dataKey="name"
            angle={angle}
            textAnchor="end"
            interval={0}
            fontSize={11}
            tickLine={false}
            tickFormatter={shortenLabel}
            axisLine={{ stroke: c.axis }}
          />
          <YAxis unit="%" domain={[0, 100]} fontSize={12} tickLine={false} axisLine={false} />
          <Tooltip
            formatter={(v) => v + '%'}
            labelFormatter={(v) => `字段 ${v}`}
            cursor={{ fill: c.cursor }}
          />
          <Bar dataKey="覆盖率" fill="url(#covGrad)" radius={[6, 6, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
