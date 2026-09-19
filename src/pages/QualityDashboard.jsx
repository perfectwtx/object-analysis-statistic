import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { DimBars } from '../components/DimBars.jsx';
import { ScoreRing } from '../components/ScoreRing.jsx';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { BackendStatus } from '../components/BackendStatus.jsx';
import { Button, buttonVariants } from '../components/ui/button.jsx';
import { Card, CardHint, CardTitle } from '../components/ui/card.jsx';
import { usePlatform } from '../lib/store.js';
import { cn, formatNumber } from '../lib/cn.js';

export default function QualityDashboard() {
  const jobs = usePlatform((s) => s.jobs);
  const dims = usePlatform((s) => s.dims);
  const score = usePlatform((s) => s.score);
  const source = usePlatform((s) => s.source);
  const loading = usePlatform((s) => s.loading);
  const refresh = usePlatform((s) => s.refresh);
  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div>
      <PageHeader
        title="质量健康"
        subtitle={source === 'api' ? '来自后端质量快照与最近作业。' : '演示数据 · 启动后端后刷新。'}
        actions={
          <>
            <BackendStatus />
            <Button variant="secondary" size="sm" onClick={() => refresh()} disabled={loading}>
              <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
              刷新
            </Button>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6"><ScoreRing score={score ?? 0} label="综合健康分" /></Card>
        <Card>
          <CardTitle>五维明细</CardTitle>
          <CardHint>任一项过低都会拖累整体可信度。</CardHint>
          <div className="mt-5"><DimBars dims={dims} /></div>
        </Card>
      </div>
      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">最近作业</h2>
          <Link to="/analyze" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'no-underline')}>新建分析</Link>
        </div>
        <div className="overflow-hidden rounded-xl bg-card shadow-[var(--elev)]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">来源</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">行数</th>
                <th className="px-4 py-3 font-medium">分数</th>
                <th className="px-4 py-3 font-medium">问题</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="border-b border-border/70 last:border-0">
                  <td className="px-4 py-3 font-mono text-xs">{j.sourceName}</td>
                  <td className="px-4 py-3 capitalize text-muted-foreground">{j.status}</td>
                  <td className="px-4 py-3 tabular-nums">{j.rows ?? '—'}</td>
                  <td className="px-4 py-3 tabular-nums">{j.score != null ? formatNumber(j.score, 1) : '—'}</td>
                  <td className="px-4 py-3">{j.issueCount ?? '—'}</td>
                </tr>
              ))}
              {!jobs.length ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">暂无作业</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
