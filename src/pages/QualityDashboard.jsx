import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listJobs, listQualitySnapshots } from '../api/index.js';
import PageHeader from '../components/ui/PageHeader.jsx';
import LoadingBlock from '../components/ui/LoadingBlock.jsx';
import ErrorBanner from '../components/ui/ErrorBanner.jsx';
import ApiUnavailable from '../components/ui/ApiUnavailable.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';

export default function QualityDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [jobs, setJobs] = useState(null);
  const [snapshots, setSnapshots] = useState(null);
  const [jobsUnavailable, setJobsUnavailable] = useState(false);
  const [snapUnavailable, setSnapUnavailable] = useState(false);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [j, s] = await Promise.all([listJobs({ limit: 10 }), listQualitySnapshots({ limit: 10 })]);
      setJobsUnavailable(j.unavailable); setSnapUnavailable(s.unavailable);
      setJobs(Array.isArray(j.data) ? j.data : j.data?.items ?? j.data?.jobs ?? null);
      setSnapshots(Array.isArray(s.data) ? s.data : s.data?.items ?? s.data?.snapshots ?? null);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  if (loading) return <LoadingBlock label="加载质量总览…" />;
  const latest = snapshots?.[0] || jobs?.[0];
  const score = latest?.overallScore ?? latest?.qualityScore ?? latest?.OverallScore ?? null;

  return (
    <div className="page">
      <PageHeader title="质量 Dashboard" subtitle="最近作业与综合质量分" actions={<button type="button" className="btn" onClick={load}>刷新</button>} />
      <ErrorBanner message={error} onRetry={load} />
      {jobsUnavailable && snapUnavailable ? (
        <ApiUnavailable feature="质量 Dashboard" endpoint="GET /api/jobs · GET /api/quality/snapshots" />
      ) : (
        <>
          <div className="stat-grid">
            <div className="stat-card"><div className="stat-label">综合质量分</div><div className="stat-value">{score != null ? Number(score).toFixed(1) : '—'}</div></div>
            <div className="stat-card"><div className="stat-label">最近作业数</div><div className="stat-value">{jobs?.length ?? '—'}</div></div>
            <div className="stat-card"><div className="stat-label">快照数</div><div className="stat-value">{snapshots?.length ?? '—'}</div></div>
          </div>
          <section className="panel">
            <h2 className="panel-title">最近分析任务</h2>
            {jobsUnavailable && <ApiUnavailable feature="作业列表" endpoint="GET /api/jobs" />}
            {!jobsUnavailable && (!jobs || !jobs.length) && (
              <EmptyState title="暂无历史作业" action={<Link className="btn primary" to="/">去分析</Link>} />
            )}
            {jobs?.length > 0 && (
              <table className="data-table">
                <thead><tr><th>来源</th><th>状态</th><th>对象数</th><th>质量分</th><th>问题</th></tr></thead>
                <tbody>
                  {jobs.map((j) => (
                    <tr key={j.id || j.Id}>
                      <td className="mono">{j.sourceName || j.SourceName || '—'}</td>
                      <td>{j.status || j.Status}</td>
                      <td>{j.totalObjects ?? j.TotalObjects ?? '—'}</td>
                      <td>{j.qualityScore ?? j.QualityScore ?? '—'}</td>
                      <td>{j.issueCount ?? j.IssueCount ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}
