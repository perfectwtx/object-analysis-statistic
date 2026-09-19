import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { labelLayout, shortenLabel } from '../utils.js';
import { chartColors, useTheme } from '../theme.js';

export default function CoverageChart({ fields }) {
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
    <div>
      <h3 className="mb-2 text-xs font-medium text-muted-foreground">字段覆盖率（Top 20）</h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom, left: 0 }}>
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
            tick={{ fill: 'var(--muted-foreground)' }}
          />
          <YAxis
            unit="%"
            domain={[0, 100]}
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={36}
            tick={{ fill: 'var(--muted-foreground)' }}
          />
          <Tooltip
            formatter={(v) => `${v}%`}
            labelFormatter={(v) => `字段 ${v}`}
            cursor={{ fill: c.cursor }}
            contentStyle={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              fontSize: 12,
            }}
          />
          <Bar dataKey="覆盖率" fill="url(#covGrad)" radius={[6, 6, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
