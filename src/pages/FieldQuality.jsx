import { useEffect, useState } from 'react';
import { getFieldQualityByJob, listJobs } from '../api/index.js';
import PageHeader from '../components/ui/PageHeader.jsx';
import LoadingBlock from '../components/ui/LoadingBlock.jsx';
import ErrorBanner from '../components/ui/ErrorBanner.jsx';
import ApiUnavailable from '../components/ui/ApiUnavailable.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';

function fmtPct(v) {
  if (v == null || Number.isNaN(Number(v))) return '—';
  const n = Number(v);
  return n <= 1 ? `${(n * 100).toFixed(1)}%` : `${n.toFixed(1)}%`;
}

export default function FieldQuality() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [jobId, setJobId] = useState('');
  const [jobs, setJobs] = useState([]);
  const [fields, setFields] = useState([]);

  useEffect(() => {
    (async () => {
      const r = await listJobs({ limit: 20 });
      if (!r.unavailable) {
        const list = Array.isArray(r.data) ? r.data : r.data?.items || [];
        setJobs(list);
        if (list[0]) setJobId(list[0].id || list[0].Id || '');
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!jobId) return;
    (async () => {
      setLoading(true); setError('');
      try {
        const r = await getFieldQualityByJob(jobId);
        if (r.unavailable) { setUnavailable(true); setFields([]); }
        else { setUnavailable(false); setFields(Array.isArray(r.data) ? r.data : r.data?.fields || []); }
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [jobId]);

  return (
    <div className="page">
      <PageHeader title="字段质量" subtitle="字段级覆盖率 / 空值 / 唯一性" actions={
        <select className="format-select" value={jobId} onChange={(e) => setJobId(e.target.value)} disabled={!jobs.length}>
          <option value="">选择作业</option>
          {jobs.map((j) => <option key={j.id || j.Id} value={j.id || j.Id}>{j.sourceName || j.id}</option>)}
        </select>
      } />
      <ErrorBanner message={error} />
      {loading && <LoadingBlock />}
      {!loading && unavailable && <ApiUnavailable feature="字段质量" endpoint="GET /api/quality/snapshots/{jobId}/fields" />}
      {!loading && !unavailable && !fields.length && <EmptyState title="暂无字段质量数据" />}
      {!loading && fields.length > 0 && (
        <div className="panel">
          <table className="data-table">
            <thead><tr><th>字段</th><th>覆盖率</th><th>空值率</th><th>唯一率</th><th>异常</th></tr></thead>
            <tbody>
              {fields.map((f) => (
                <tr key={f.fieldName || f.field}>
                  <td className="mono">{f.fieldName || f.FieldName || f.field}</td>
                  <td>{fmtPct(f.coverage ?? f.Coverage)}</td>
                  <td>{fmtPct(f.nullRate ?? f.NullRate)}</td>
                  <td>{fmtPct(f.uniqueness ?? f.Uniqueness)}</td>
                  <td>{f.outlierCount ?? f.OutlierCount ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
