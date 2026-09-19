import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { getFieldQualityByJob, listJobs } from '../api/index.js';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { BackendStatus } from '../components/BackendStatus.jsx';
import { Button } from '../components/ui/button.jsx';
import { Bar } from '../components/ui/progress.jsx';
import { SEED_FIELDS } from '../lib/mock-data.js';
import { asList, normalizeField, normalizeJob } from '../lib/normalize.js';
import { cn, formatPct } from '../lib/cn.js';

export default function FieldQuality() {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState([]);
  const [jobId, setJobId] = useState('');
  const [fields, setFields] = useState(SEED_FIELDS);
  const [source, setSource] = useState('demo');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await listJobs({ limit: 30 });
        if (!r.unavailable) {
          const list = asList(r.data).map(normalizeJob).filter(Boolean);
          setJobs(list);
          if (list[0]) setJobId(list[0].id);
        }
      } finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (!jobId) return;
    (async () => {
      setLoading(true); setError('');
      try {
        const r = await getFieldQualityByJob(jobId);
        if (r.unavailable) { setSource('demo'); setFields(SEED_FIELDS); }
        else {
          setSource('api');
          const list = asList(r.data).map(normalizeField).filter(Boolean);
          setFields(list.length ? list : SEED_FIELDS);
        }
      } catch (e) { setError(e.message); setSource('demo'); setFields(SEED_FIELDS); }
      finally { setLoading(false); }
    })();
  }, [jobId]);

  return (
    <div>
      <PageHeader title="字段质量" subtitle={source === 'api' ? '列级覆盖与唯一性。' : '演示字段 · 选择后端作业后加载。'}
        actions={
          <>
            <BackendStatus />
            <select className="h-9 max-w-[220px] rounded-lg bg-muted px-3 text-sm shadow-[var(--elev)] outline-none" value={jobId} onChange={(e) => setJobId(e.target.value)}>
              <option value="">选择作业</option>
              {jobs.map((j) => <option key={j.id} value={j.id}>{j.sourceName}</option>)}
            </select>
            <Button variant="secondary" size="sm" disabled={loading}><RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />{loading ? '加载中' : '已同步'}</Button>
          </>
        }
      />
      {error ? <div className="mb-4 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">{error}</div> : null}
      <div className="overflow-hidden rounded-xl bg-card shadow-[var(--elev)]">
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b border-border text-xs text-muted-foreground">
            <th className="px-4 py-3 font-medium">字段</th><th className="px-4 py-3 font-medium">类型</th>
            <th className="px-4 py-3 font-medium min-w-[140px]">覆盖率</th><th className="px-4 py-3 font-medium">唯一率</th>
            <th className="px-4 py-3 font-medium">有效率</th><th className="px-4 py-3 font-medium">异常数</th>
          </tr></thead>
          <tbody>
            {fields.map((f) => {
              const cov = f.coverage != null ? (f.coverage <= 1 ? f.coverage * 100 : f.coverage) : null;
              const uni = f.uniqueness != null ? (f.uniqueness <= 1 ? f.uniqueness * 100 : f.uniqueness) : null;
              const val = f.validity != null ? (f.validity <= 1 ? f.validity * 100 : f.validity) : null;
              return (
                <tr key={f.name} className="border-b border-border/70 last:border-0">
                  <td className="px-4 py-3 font-mono text-xs">{f.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{f.primaryType}</td>
                  <td className="px-4 py-3">{cov != null ? <div className="flex items-center gap-2"><Bar value={cov} className="max-w-[100px]" /><span className="tabular-nums text-xs">{formatPct(cov / 100)}</span></div> : '—'}</td>
                  <td className="px-4 py-3 tabular-nums text-xs">{uni != null ? formatPct(uni / 100) : '—'}</td>
                  <td className="px-4 py-3 tabular-nums text-xs">{val != null ? formatPct(val / 100) : '—'}</td>
                  <td className="px-4 py-3 tabular-nums">{f.outlierCount ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
