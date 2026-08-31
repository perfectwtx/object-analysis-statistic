import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { labelLayout, shortenLabel } from '../utils.js';
import { chartColors, useTheme } from '../theme.js';

export default function TypeChart({ fields }) {
  // 与 CoverageChart 同理：SVG 呈现属性不认 CSS 变量，只能在 JS 里按主题取色
  const { theme } = useTheme();
  const c = chartColors(theme);
  const TYPE_COLORS = c.types;

  const top = (fields || []).slice(0, 20);
  if (top.length === 0) return null;

  const data = top.map((f) => ({ name: f.fieldName, ...(f.typeCounts || {}) }));
  const types = [...new Set(top.flatMap((f) => Object.keys(f.typeCounts || {})))];
  const { bottom, height, angle } = labelLayout(data.map((d) => d.name));

  return (
    <div className="panel">
      <h3>字段类型分布（Top 20）</h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 16, bottom, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={c.grid} vertical={false} />
          {/* 图例必须放顶部：默认在底部，会和旋转后向下伸出的字段名标签重叠 */}
          <Legend verticalAlign="top" align="right" height={28} wrapperStyle={{ fontSize: 12 }} />
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
          <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ fill: c.cursor }}
            labelFormatter={(v) => `字段 ${v}`}
          />
          {types.map((t, i) => (
            <Bar
              key={t}
              dataKey={t}
              stackId="a"
              fill={TYPE_COLORS[t] || c.fallback}
              maxBarSize={36}
              radius={i === types.length - 1 ? [6, 6, 0, 0] : 0}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
