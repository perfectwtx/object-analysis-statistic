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
import {
  TableShell, Table, THead, TH, TBody, TR, TD, EmptyRow,
} from '../components/ui/data-table.jsx';

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

  const displayScore = score ?? 0;
  const topIssues = (issues || []).slice(0, 4);

  return (
    <div>
      <PageHeader
        title="数据质量总览"
        subtitle={source === 'api' ? '实时对接后端平台数据。' : '演示模式 · 启动 ObjectAnalyzer.Api 后自动切换。'}
        actions={
          <>
            <BackendStatus />
            <Button variant="secondary" size="sm" onClick={() => refresh()} disabled={loading}>
              <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
              刷新
            </Button>
            <Link to="/analyze" className={cn(buttonVariants({ size: 'sm' }), 'no-underline')}>
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
          <div className="mt-6 grid grid-cols-3 gap-3 border-t border-border pt-4">
            <div>
              <div className="text-[11px] text-muted-foreground">作业</div>
              <div className="mt-0.5 text-lg font-medium tabular-nums">{jobs?.length ?? 0}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground">问题</div>
              <div className="mt-0.5 text-lg font-medium tabular-nums">{issues?.length ?? 0}</div>
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground">数据源</div>
              <div className="mt-0.5 text-sm font-medium">{source === 'api' ? 'API' : 'Demo'}</div>
            </div>
          </div>
        </Card>
        <Card>
          <CardTitle>五维质量</CardTitle>
          <CardHint>完整性 · 有效性 · 唯一性 · 一致性 · 异常</CardHint>
          <div className="mt-5">
            <DimBars dims={dims} />
          </div>
        </Card>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">最近作业</h2>
            <Link to="/quality" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'no-underline')}>
              全部
            </Link>
          </div>
          <TableShell>
            <Table dense>
              <THead>
                <tr>
                  <TH>来源</TH>
                  <TH align="right">分数</TH>
                  <TH align="right">问题</TH>
                </tr>
              </THead>
              <TBody>
                {jobs.slice(0, 5).map((j) => (
                  <TR key={j.id}>
                    <TD mono className="max-w-[12rem] truncate" title={j.sourceName}>{j.sourceName}</TD>
                    <TD align="right">{j.score != null ? formatNumber(j.score, 1) : '—'}</TD>
                    <TD align="right">{j.issueCount ?? '—'}</TD>
                  </TR>
                ))}
                {!jobs.length ? <EmptyRow colSpan={3}>暂无作业</EmptyRow> : null}
              </TBody>
            </Table>
          </TableShell>
        </div>
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">优先问题</h2>
            <Link to="/issues" className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'no-underline')}>
              问题中心
            </Link>
          </div>
          <div className="space-y-2">
            {topIssues.map((it) => (
              <Card key={it.id} className="flex items-start gap-3 p-3">
                <Badge tone={severityTone(it.severity)}>{SEVERITY_LABEL[it.severity] || it.severity}</Badge>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{it.title}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {it.field || '—'} · {DIM_LABEL[it.dimension] || it.dimension || '—'}
                  </div>
                </div>
              </Card>
            ))}
            {!topIssues.length ? (
              <Card className="py-8 text-center text-sm text-muted-foreground">暂无问题</Card>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
