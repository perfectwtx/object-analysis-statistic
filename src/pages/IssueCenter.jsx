import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { listIssues, listJobs } from '../api/index.js';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { BackendStatus } from '../components/BackendStatus.jsx';
import { Badge, severityTone } from '../components/ui/badge.jsx';
import { Button } from '../components/ui/button.jsx';
import {
  TableShell, Table, THead, TH, TBody, TR, TD, EmptyRow,
} from '../components/ui/data-table.jsx';
import { DIM_LABEL, SEVERITY_LABEL, SEED_ISSUES } from '../lib/mock-data.js';
import { asList, normalizeIssue, normalizeJob } from '../lib/normalize.js';
import { cn } from '../lib/cn.js';

export default function IssueCenter() {
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState('demo');
  const [issues, setIssues] = useState(SEED_ISSUES);
  const [jobs, setJobs] = useState([]);
  const [jobFilter, setJobFilter] = useState('');
  const [sevFilter, setSevFilter] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const jr = await listJobs({ limit: 40 });
      if (!jr.unavailable) setJobs(asList(jr.data).map(normalizeJob).filter(Boolean));
      const r = await listIssues({ jobId: jobFilter || undefined, limit: 200 });
      if (r.unavailable) { setSource('demo'); setIssues(SEED_ISSUES); }
      else { setSource('api'); setIssues(asList(r.data).map(normalizeIssue).filter(Boolean)); }
    } catch (e) { setError(e.message); setSource('demo'); setIssues(SEED_ISSUES); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [jobFilter]);
  const filtered = useMemo(
    () => (!sevFilter ? issues : issues.filter((i) => i.severity === sevFilter)),
    [issues, sevFilter],
  );

  return (
    <div>
      <PageHeader
        title="问题中心"
        subtitle={source === 'api' ? '后端 Issue 列表。' : '演示问题 · 对接 GET /api/issues。'}
        actions={
          <>
            <BackendStatus />
            <select
              className="h-9 rounded-lg bg-muted px-3 text-sm shadow-[var(--elev)] outline-none"
              value={jobFilter}
              onChange={(e) => setJobFilter(e.target.value)}
            >
              <option value="">全部作业</option>
              {jobs.map((j) => <option key={j.id} value={j.id}>{j.sourceName}</option>)}
            </select>
            <select
              className="h-9 rounded-lg bg-muted px-3 text-sm shadow-[var(--elev)] outline-none"
              value={sevFilter}
              onChange={(e) => setSevFilter(e.target.value)}
            >
              <option value="">全部级别</option>
              <option value="critical">紧急</option>
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>
            <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
              刷新
            </Button>
          </>
        }
      />
      {error ? (
        <div className="mb-4 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">{error}</div>
      ) : null}
      <TableShell>
        <Table dense>
          <THead sticky>
            <tr>
              <TH className="w-[4.5rem]">级别</TH>
              <TH>问题</TH>
              <TH>字段</TH>
              <TH>维度</TH>
              <TH align="right">数量</TH>
            </tr>
          </THead>
          <TBody>
            {filtered.map((it) => (
              <TR key={it.id} className="align-top">
                <TD>
                  <Badge tone={severityTone(it.severity)}>
                    {SEVERITY_LABEL[it.severity] || it.severity}
                  </Badge>
                </TD>
                <TD>
                  <div className="font-medium leading-snug">{it.title}</div>
                  {it.detail ? (
                    <div className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground line-clamp-2">
                      {it.detail}
                    </div>
                  ) : null}
                </TD>
                <TD mono className="max-w-[10rem] truncate" title={it.field}>
                  {it.field || '—'}
                </TD>
                <TD muted className="whitespace-nowrap">
                  {DIM_LABEL[it.dimension] || it.dimension || '—'}
                </TD>
                <TD align="right">{it.count ?? '—'}</TD>
              </TR>
            ))}
            {!filtered.length ? (
              <EmptyRow colSpan={5}>{loading ? '加载中…' : '暂无问题'}</EmptyRow>
            ) : null}
          </TBody>
        </Table>
      </TableShell>
    </div>
  );
}
