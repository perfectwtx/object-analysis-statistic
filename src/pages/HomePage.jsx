import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { DimBars } from '../components/DimBars.jsx';
import { ScoreRing } from '../components/ScoreRing.jsx';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { BackendStatus } from '../components/BackendStatus.jsx';
import { Badge, severityTone } from '../components/ui/badge.jsx';
import { Button, buttonVariants } from '../components/ui/button.jsx';
import { Card, CardHint, CardTitle } from '../components/ui/card.jsx';
import { DIM_LABEL, SEVERITY_LABEL } from '../lib/mock-data.js';
import { usePlatform } from '../lib/store.js';
import { cn, formatNumber } from '../lib/cn.js';

export default function HomePage() {
  const jobs = usePlatform((s) => s.jobs);
  const issues = usePlatform((s) => s.issues);
  const dims = usePlatform((s) => s.dims);
  const score = usePlatform((s) => s.score);
  const source = usePlatform((s) => s.source);
  const loading = usePlatform((s) => s.loading);
  const error = usePlatform((s) => s.error);
  const refresh = usePlatform((s) => s.refresh);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const open = issues.filter((i) => i.severity === 'critical' || i.severity === 'high');
  const displayScore = score ?? jobs[0]?.score ?? 0;

  return (
    <div>
      <PageHeader
        title="数据是否可信，一眼能看出来。"
        subtitle={
          source === 'api'
            ? '数据来自 ObjectAnalyzer.Api。健康分、未关闭问题和最近分析都在这里。'
            : '当前为演示数据。启动后端后点刷新即可切换到真实结果。'
        }
        actions={
          <>
            <BackendStatus />
            <Button variant="secondary" size="sm" onClick={() => refresh()} disabled={loading}>
              <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
              刷新
            </Button>
            <Link to="/analyze" className={cn(buttonVariants(), 'no-underline')}>
              新建分析
              <ArrowRight className="size-4" />
            </Link>
          </>
        }
      />

      {error && source === 'demo' ? (
        <div className="mb-6 rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="flex flex-col justify-between p-6">
          <ScoreRing score={displayScore} />
          <div className="mt-6 grid grid-cols-3 gap-3 border-t border-border pt-5">
            <Kpi label="待处理问题" value={String(issues.length)} hint={`${open.length} 项高优`} />
            <Kpi
              label="已完成分析"
              value={String(jobs.filter((j) => ['done', 'completed', 'succeeded'].includes(j.status)).length || jobs.length)}
            />
            <Kpi label="最近来源" value={jobs[0]?.sourceName ?? '—'} />
          </div>
        </Card>
        <Card>
          <CardTitle>五维质量</CardTitle>
          <CardHint>完整、有效、唯一、一致、异常。短板决定你先修什么。</CardHint>
          <div className="mt-5">
            <DimBars dims={dims} />
          </div>
        </Card>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">需要处理</h2>
            <Link to="/issues" className="text-sm text-muted-foreground no-underline hover:text-foreground">
              全部问题
            </Link>
          </div>
          <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card shadow-[var(--elev)]">
            {issues.slice(0, 5).map((iss) => (
              <li key={iss.id} className="flex items-start gap-3 px-4 py-3">
                <Badge tone={severityTone(iss.severity)}>{SEVERITY_LABEL[iss.severity] || iss.severity}</Badge>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{iss.title}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {iss.field} · {DIM_LABEL[iss.dimension] || iss.dimension} · {iss.count} 条
                  </div>
                </div>
              </li>
            ))}
            {!issues.length ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">暂无问题</li>
            ) : null}
          </ul>
        </div>
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">最近分析</h2>
            <Link to="/quality" className="text-sm text-muted-foreground no-underline hover:text-foreground">
              质量健康
            </Link>
          </div>
          <div className="overflow-hidden rounded-xl bg-card shadow-[var(--elev)]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">来源</th>
                  <th className="px-4 py-3 font-medium">分数</th>
                  <th className="px-4 py-3 font-medium">问题</th>
                </tr>
              </thead>
              <tbody>
                {jobs.slice(0, 5).map((j) => (
                  <tr key={j.id} className="border-b border-border/70 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs">{j.sourceName}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {j.score != null ? formatNumber(j.score, 1) : '—'}
                    </td>
                    <td className="px-4 py-3">{j.issueCount ?? '—'}</td>
                  </tr>
                ))}
                {!jobs.length ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                      暂无分析任务，
                      <Link to="/analyze" className="text-foreground underline-offset-2 hover:underline">
                        去工作台
                      </Link>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, hint }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-sm font-medium tabular-nums">{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
