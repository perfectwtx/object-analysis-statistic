import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { listIssues, listJobs } from '../api/index.js';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { BackendStatus } from '../components/BackendStatus.jsx';
import { Badge, severityTone } from '../components/ui/badge.jsx';
import { Button } from '../components/ui/button.jsx';
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
  const filtered = useMemo(() => (!sevFilter ? issues : issues.filter((i) => i.severity === sevFilter)), [issues, sevFilter]);

  return (
    <div>
      <PageHeader title="问题中心" subtitle={source === 'api' ? '后端 Issue 列表。' : '演示问题 · 对接 GET /api/issues。'}
        actions={
          <>
            <BackendStatus />
            <select className="h-9 rounded-lg bg-muted px-3 text-sm shadow-[var(--elev)] outline-none" value={jobFilter} onChange={(e) => setJobFilter(e.target.value)}>
              <option value="">全部作业</option>
              {jobs.map((j) => <option key={j.id} value={j.id}>{j.sourceName}</option>)}
            </select>
            <select className="h-9 rounded-lg bg-muted px-3 text-sm shadow-[var(--elev)] outline-none" value={sevFilter} onChange={(e) => setSevFilter(e.target.value)}>
              <option value="">全部级别</option>
              <option value="critical">紧急</option><option value="high">高</option><option value="medium">中</option><option value="low">低</option>
            </select>
            <Button variant="secondary" size="sm" onClick={load} disabled={loading}><RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />刷新</Button>
          </>
        }
      />
      {error ? <div className="mb-4 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">{error}</div> : null}
      <div className="overflow-hidden rounded-xl bg-card shadow-[var(--elev)]">
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b border-border text-xs text-muted-foreground">
            <th className="px-4 py-3 font-medium">级别</th><th className="px-4 py-3 font-medium">问题</th>
            <th className="px-4 py-3 font-medium">字段</th><th className="px-4 py-3 font-medium">维度</th><th className="px-4 py-3 font-medium">数量</th>
          </tr></thead>
          <tbody>
            {filtered.map((it) => (
              <tr key={it.id} className="border-b border-border/70 last:border-0 align-top">
                <td className="px-4 py-3"><Badge tone={severityTone(it.severity)}>{SEVERITY_LABEL[it.severity] || it.severity}</Badge></td>
                <td className="px-4 py-3"><div>{it.title}</div>{it.detail ? <div className="mt-1 max-w-md text-xs text-muted-foreground line-clamp-2">{it.detail}</div> : null}</td>
                <td className="px-4 py-3 font-mono text-xs">{it.field}</td>
                <td className="px-4 py-3 text-muted-foreground">{DIM_LABEL[it.dimension] || it.dimension || '—'}</td>
                <td className="px-4 py-3 tabular-nums">{it.count}</td>
              </tr>
            ))}
            {!filtered.length ? <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">{loading ? '加载中…' : '暂无问题'}</td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
