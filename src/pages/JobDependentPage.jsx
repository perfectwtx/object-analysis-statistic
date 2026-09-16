import { useEffect, useState } from 'react';
import { listJobs } from '../api/index.js';
import PageHeader from '../components/ui/PageHeader.jsx';
import LoadingBlock from '../components/ui/LoadingBlock.jsx';
import ErrorBanner from '../components/ui/ErrorBanner.jsx';
import ApiUnavailable from '../components/ui/ApiUnavailable.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';

export default function JobDependentPage({
  title, subtitle, endpointTemplate, fetchByJobId, renderData,
}) {
  const [jobs, setJobs] = useState([]);
  const [jobId, setJobId] = useState('');
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [data, setData] = useState(null);
  const [jobsUnavailable, setJobsUnavailable] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await listJobs({ limit: 30 });
        if (r.unavailable) setJobsUnavailable(true);
        else {
          const list = Array.isArray(r.data) ? r.data : r.data?.items || [];
          setJobs(list);
          if (list[0]) setJobId(list[0].id || list[0].Id || '');
        }
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  const load = async () => {
    if (!jobId || !fetchByJobId) return;
    setFetching(true); setError('');
    try {
      const r = await fetchByJobId(jobId);
      if (r.unavailable) { setUnavailable(true); setData(null); }
      else { setUnavailable(false); setData(r.data); }
    } catch (e) { setError(e.message); setData(null); }
    finally { setFetching(false); }
  };

  useEffect(() => { if (jobId) load(); }, [jobId]);

  return (
    <div className="page">
      <PageHeader title={title} subtitle={subtitle} actions={
        <div className="page-actions-row">
          <select className="format-select" value={jobId} onChange={(e) => setJobId(e.target.value)} disabled={jobsUnavailable || !jobs.length}>
            <option value="">选择作业</option>
            {jobs.map((j) => <option key={j.id || j.Id} value={j.id || j.Id}>{j.sourceName || j.SourceName || j.id}</option>)}
          </select>
          <button type="button" className="btn" onClick={load} disabled={!jobId || fetching}>查询</button>
        </div>
      } />
      <ErrorBanner message={error} onRetry={load} />
      {loading && <LoadingBlock />}
      {!loading && jobsUnavailable && (
        <ApiUnavailable feature={title} endpoint={`${endpointTemplate || ''} · GET /api/jobs`} />
      )}
      {!loading && !jobsUnavailable && !jobs.length && (
        <EmptyState title="暂无作业" description="请先完成分析并确保后端持久化 Job。" />
      )}
      {fetching && <LoadingBlock label="查询中…" />}
      {!fetching && unavailable && (
        <ApiUnavailable feature={title} endpoint={(endpointTemplate || '').replace('{jobId}', jobId || '{jobId}')} />
      )}
      {!fetching && data && renderData?.(data)}
    </div>
  );
}
