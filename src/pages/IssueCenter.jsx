import { useEffect, useState } from 'react';
import { listIssues, listJobs } from '../api/index.js';
import PageHeader from '../components/ui/PageHeader.jsx';
import LoadingBlock from '../components/ui/LoadingBlock.jsx';
import ErrorBanner from '../components/ui/ErrorBanner.jsx';
import ApiUnavailable from '../components/ui/ApiUnavailable.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';

export default function IssueCenter() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [issues, setIssues] = useState([]);
  const [jobFilter, setJobFilter] = useState('');
  const [jobs, setJobs] = useState([]);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const jr = await listJobs({ limit: 30 });
      if (!jr.unavailable) setJobs(Array.isArray(jr.data) ? jr.data : jr.data?.items || []);
      const r = await listIssues({ jobId: jobFilter || undefined, limit: 100 });
      if (r.unavailable) { setUnavailable(true); setIssues([]); }
      else { setUnavailable(false); setIssues(Array.isArray(r.data) ? r.data : r.data?.items || []); }
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [jobFilter]);

  return (
    <div className="page">
      <PageHeader title="Issue Center" subtitle="质量问题列表" actions={
        <select className="format-select" value={jobFilter} onChange={(e) => setJobFilter(e.target.value)}>
          <option value="">全部作业</option>
          {jobs.map((j) => <option key={j.id || j.Id} value={j.id || j.Id}>{j.sourceName || j.id}</option>)}
        </select>
      } />
      <ErrorBanner message={error} onRetry={load} />
      {loading && <LoadingBlock />}
      {!loading && unavailable && <ApiUnavailable feature="Issue Center" endpoint="GET /api/issues" />}
      {!loading && !unavailable && !issues.length && <EmptyState title="暂无质量问题" />}
      {!loading && issues.length > 0 && (
        <div className="panel">
          <table className="data-table">
            <thead><tr><th>字段</th><th>检查项</th><th>数量</th><th>说明</th></tr></thead>
            <tbody>
              {issues.map((it, i) => (
                <tr key={it.id || i}>
                  <td className="mono">{it.field || it.Field || '（数据集）'}</td>
                  <td>{it.check || it.Check}</td>
                  <td>{it.count ?? it.Count ?? '—'}</td>
                  <td>{it.message || it.Message || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
