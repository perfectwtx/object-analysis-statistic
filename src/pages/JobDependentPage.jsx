import { useEffect, useState } from 'react';
import { listJobs, loadLastJobId, saveLastJobId } from '../api/index.js';
import PageHeader from '../components/ui/PageHeader.jsx';
import LoadingBlock from '../components/ui/LoadingBlock.jsx';
import ErrorBanner from '../components/ui/ErrorBanner.jsx';
import ApiUnavailable from '../components/ui/ApiUnavailable.jsx';
import EmptyState from '../components/ui/EmptyState.jsx';

export default function JobDependentPage({
  title, subtitle, endpointTemplate, fetchByJobId, renderData,
}) {
  const [jobs, setJobs] = useState([]);
  const [jobId, setJobId] = useState(() => loadLastJobId());
  const [manualId, setManualId] = useState(() => loadLastJobId());
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
        if (r.unavailable) {
          setJobsUnavailable(true);
          const last = loadLastJobId();
          if (last) setJobId(last);
        } else {
          setJobsUnavailable(false);
          const list = Array.isArray(r.data) ? r.data : r.data?.items || r.data?.jobs || [];
          setJobs(list);
          if (!jobId && list[0]) {
            const id = list[0].id || list[0].Id || '';
            setJobId(id);
            setManualId(id);
          }
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const load = async (id = jobId) => {
    if (!id || !fetchByJobId) return;
    setFetching(true);
    setError('');
    try {
      const r = await fetchByJobId(id);
      if (r.unavailable) {
        setUnavailable(true);
        setData(null);
      } else {
        setUnavailable(false);
        setData(r.data);
        saveLastJobId(id);
      }
    } catch (e) {
      setError(e.message);
      setData(null);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (jobId) load(jobId);
  }, [jobId]);

  const applyManual = () => {
    const id = manualId.trim();
    if (!id) return;
    setJobId(id);
    saveLastJobId(id);
  };

  return (
    <div className="page">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <div className="page-actions-row">
            {!jobsUnavailable && jobs.length > 0 && (
              <select
                className="format-select"
                value={jobId}
                onChange={(e) => {
                  setJobId(e.target.value);
                  setManualId(e.target.value);
                }}
              >
                <option value="">选择作业</option>
                {jobs.map((j) => (
                  <option key={j.id || j.Id} value={j.id || j.Id}>
                    {j.sourceName || j.SourceName || j.id || j.Id}
                  </option>
                ))}
              </select>
            )}
            <div className="job-manual-row">
              <input
                className="job-id-input mono"
                placeholder="粘贴 JobId（异步分析返回）"
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyManual()}
              />
              <button type="button" className="btn" onClick={applyManual} disabled={!manualId.trim()}>
                使用
              </button>
              <button type="button" className="btn" onClick={() => load(jobId)} disabled={!jobId || fetching}>
                查询
              </button>
            </div>
          </div>
        }
      />
      <ErrorBanner message={error} onRetry={() => load(jobId)} />
      {loading && <LoadingBlock />}
      {!loading && jobsUnavailable && !jobId && (
        <EmptyState
          title="暂无作业列表"
          description="后端可能尚未提供 GET /api/jobs。可先在「分析任务」完成异步分析，将返回的 JobId 粘贴到上方查询。"
        />
      )}
      {fetching && <LoadingBlock label="查询中…" />}
      {!fetching && unavailable && (
        <ApiUnavailable
          feature={title}
          endpoint={(endpointTemplate || '').replace('{jobId}', jobId || '{jobId}')}
        />
      )}
      {!fetching && data && renderData?.(data)}
    </div>
  );
}
