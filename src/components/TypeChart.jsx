import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { labelLayout, shortenLabel } from '../utils.js';
import { chartColors, useTheme } from '../theme.js';

export default function TypeChart({ fields }) {
  const { theme } = useTheme();
  const c = chartColors(theme);
  const TYPE_COLORS = c.types || {};

  const top = (fields || []).slice(0, 20);
  if (top.length === 0) return null;

  const data = top.map((f) => ({ name: f.fieldName, ...(f.typeCounts || {}) }));
  const types = [...new Set(data.flatMap((d) => Object.keys(d).filter((k) => k !== 'name')))];
  const { bottom, height, angle } = labelLayout(data.map((d) => d.name));

  return (
    <div>
      <h3 className="mb-2 text-xs font-medium text-muted-foreground">类型分布（Top 20）</h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom, left: 0 }}>
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
          <YAxis fontSize={11} tickLine={false} axisLine={false} width={36} tick={{ fill: 'var(--muted-foreground)' }} />
          <Tooltip
            cursor={{ fill: c.cursor }}
            contentStyle={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {types.map((t, i) => (
            <Bar
              key={t}
              dataKey={t}
              stackId="a"
              fill={TYPE_COLORS[t] || `hsl(${(i * 47) % 360} 60% 55%)`}
              maxBarSize={36}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
