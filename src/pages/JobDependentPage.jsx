import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Trash2 } from 'lucide-react';
import { listJobs, loadLastJobId, saveLastJobId, clearLastJobId, deleteJob } from '../api/index.js';
import { PageHeader } from '../components/layout/PageHeader.jsx';
import { BackendStatus } from '../components/BackendStatus.jsx';
import { Button, buttonVariants } from '../components/ui/button.jsx';
import { Card } from '../components/ui/card.jsx';
import LoadingBlock from '../components/ui/LoadingBlock.jsx';
import ErrorBanner from '../components/ui/ErrorBanner.jsx';
import { asList, normalizeJob } from '../lib/normalize.js';
import { cn } from '../lib/cn.js';
import { useT } from '../lib/i18n.js';

export default function JobDependentPage({
  title,
  subtitle,
  endpointTemplate,
  fetchByJobId,
  renderData,
  emptyHint,
}) {
  const { t } = useT();
  const [jobs, setJobs] = useState([]);
  const [jobId, setJobId] = useState(() => loadLastJobId());
  const [manualId, setManualId] = useState(() => loadLastJobId());
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [data, setData] = useState(null);
  const [jobsUnavailable, setJobsUnavailable] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      setLoadingJobs(true);
      try {
        const r = await listJobs({ limit: 40 });
        if (r.unavailable) {
          setJobsUnavailable(true);
          const last = loadLastJobId();
          if (last) {
            setJobId(last);
            setManualId(last);
          }
        } else {
          setJobsUnavailable(false);
          const list = asList(r.data).map(normalizeJob).filter(Boolean);
          setJobs(list);
          setJobId((prev) => {
            if (prev) return prev;
            const id = list[0]?.id || loadLastJobId() || '';
            if (id) setManualId(id);
            return id;
          });
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoadingJobs(false);
      }
    })();
  }, []);

  const load = useCallback(async (id) => {
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
  }, [fetchByJobId]);

  useEffect(() => {
    if (jobId) load(jobId);
  }, [jobId, load]);

  const applyManual = () => {
    const id = manualId.trim();
    if (!id) return;
    setJobId(id);
    saveLastJobId(id);
  };

  const reloadJobs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      const r = await listJobs({ limit: 40 });
      if (r.unavailable) {
        setJobsUnavailable(true);
        setJobs([]);
      } else {
        setJobsUnavailable(false);
        setJobs(asList(r.data).map(normalizeJob).filter(Boolean));
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  const handleDeleteJob = useCallback(async () => {
    const id = jobId || manualId;
    if (!id) return;
    if (!window.confirm(t('deleteJobConfirm') || '确定删除这条分析记录？')) return;
    setDeleting(true);
    setError('');
    try {
      const r = await deleteJob(id);
      if (r.unavailable) {
        setError(t('deleteJobUnavailable') || '后端尚未提供删除接口');
        return;
      }
      if (loadLastJobId() === String(id)) clearLastJobId();
      setJobId('');
      setManualId('');
      setData(null);
      await reloadJobs();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setDeleting(false);
    }
  }, [jobId, manualId, reloadJobs, t]);

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <>
            <BackendStatus />
            <Link to="/analyze" className={cn(buttonVariants({ size: 'sm' }), 'no-underline')}>
              {t('goAnalyze') || '去分析'}
            </Link>
            <Button
              variant="secondary"
              size="sm"
              disabled={!jobId || fetching}
              onClick={() => load(jobId)}
            >
              <RefreshCw className={cn('size-3.5', fetching && 'animate-spin')} />
              {t('refresh') || '刷新'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!jobId || deleting || fetching}
              onClick={handleDeleteJob}
              className="text-muted-foreground hover:text-red-500"
            >
              <Trash2 className={cn('size-3.5', deleting && 'animate-pulse')} />
              {t('deleteJob') || '删除'}
            </Button>
          </>
        }
      />

      <Card className="mb-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="block min-w-[200px] flex-1">
            <span className="mb-1 block text-xs text-muted-foreground">选择作业</span>
            <select
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary/40"
              value={jobId}
              disabled={loadingJobs || jobsUnavailable}
              onChange={(e) => {
                setJobId(e.target.value);
                setManualId(e.target.value);
              }}
            >
              <option value="">{jobsUnavailable ? '作业列表不可用' : '选择 Job…'}</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {(j.sourceName || j.id).slice(0, 48)} · {(j.status || '').toString()}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-[240px] flex-1">
            <span className="mb-1 block text-xs text-muted-foreground">或粘贴 JobId</span>
            <div className="flex gap-2">
              <input
                className="h-9 flex-1 rounded-lg border border-border bg-background px-3 font-mono text-sm outline-none focus:border-primary/40"
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                placeholder="guid / job id"
              />
              <Button size="sm" variant="secondary" onClick={applyManual}>
                加载
              </Button>
            </div>
          </label>
        </div>
        {endpointTemplate ? (
          <p className="mt-2 font-mono text-[11px] text-muted-foreground">
            {(endpointTemplate || '').replace('{jobId}', jobId || '{jobId}')}
          </p>
        ) : null}
      </Card>

      {error ? <div className="mb-4"><ErrorBanner message={error} /></div> : null}
      {fetching ? <LoadingBlock label="查询中…" /> : null}

      {!fetching && unavailable && (
        <Card className="py-10 text-center text-sm text-muted-foreground">
          <div className="font-medium text-foreground">接口暂不可用</div>
          <p className="mt-1 text-xs">
            {endpointTemplate
              ? endpointTemplate.replace('{jobId}', jobId || '{jobId}')
              : '请确认后端已开放对应端点'}
          </p>
          <p className="mt-2 text-xs">{emptyHint || '可先在「分析任务」完成一次异步分析，再将 JobId 粘贴到上方。'}</p>
        </Card>
      )}

      {!fetching && !unavailable && data != null && renderData?.(data, jobId)}

      {!fetching && !unavailable && data == null && jobId && !error && (
        <Card className="py-10 text-center text-sm text-muted-foreground">
          {emptyHint || '暂无数据'}
        </Card>
      )}
    </div>
  );
}
