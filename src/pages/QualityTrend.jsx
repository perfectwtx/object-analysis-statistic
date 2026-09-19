import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { BackendStatus } from '../components/BackendStatus.jsx';
import { Button } from '../components/ui/button.jsx';
import { Card, CardHint, CardTitle } from '../components/ui/card.jsx';
import { usePlatform } from '../lib/store.js';
import { cn, formatNumber } from '../lib/cn.js';

export default function QualityTrend() {
  const trend = usePlatform((s) => s.trend);
  const source = usePlatform((s) => s.source);
  const loading = usePlatform((s) => s.loading);
  const refresh = usePlatform((s) => s.refresh);
  useEffect(() => { refresh(); }, [refresh]);
  const last = trend[trend.length - 1];
  const first = trend[0];
  const delta = last && first && last.score != null && first.score != null ? last.score - first.score : null;

  return (
    <div>
      <PageHeader title="质量趋势" subtitle={source === 'api' ? '后端质量分时间序列。' : '演示趋势 · 对接 /api/quality/trend。'}
        actions={<><BackendStatus /><Button variant="secondary" size="sm" onClick={() => refresh()} disabled={loading}><RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />刷新</Button></>} />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-card px-4 py-3 shadow-[var(--elev)]"><div className="text-xs text-muted-foreground">最新分数</div><div className="mt-1 text-lg font-medium tabular-nums">{last?.score != null ? formatNumber(last.score, 1) : '—'}</div></div>
        <div className="rounded-xl bg-card px-4 py-3 shadow-[var(--elev)]"><div className="text-xs text-muted-foreground">区间变化</div><div className="mt-1 text-lg font-medium tabular-nums">{delta == null ? '—' : `${delta >= 0 ? '+' : ''}${formatNumber(delta, 1)}`}</div></div>
        <div className="rounded-xl bg-card px-4 py-3 shadow-[var(--elev)]"><div className="text-xs text-muted-foreground">采样点数</div><div className="mt-1 text-lg font-medium tabular-nums">{trend.length}</div></div>
      </div>
      <Card className="p-4 sm:p-6">
        <CardTitle>综合分走势</CardTitle>
        <CardHint>近 30 天（或后端返回的时间窗）</CardHint>
        <div className="mt-6 h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs><linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--ok)" stopOpacity={0.35} /><stop offset="100%" stopColor="var(--ok)" stopOpacity={0} /></linearGradient></defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis domain={[60, 100]} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
              <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }} />
              <Area type="monotone" dataKey="score" stroke="var(--ok)" fill="url(#scoreFill)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
