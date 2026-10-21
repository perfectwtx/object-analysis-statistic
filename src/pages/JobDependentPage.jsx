import { useLatestRequest } from '../hooks/useLatestRequest.js';
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
import { ConfirmDialog } from '../components/ui/ConfirmDialog.jsx';

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
  const [confirmOpen, setConfirmOpen] = useState(false);

  const jobsRequest = useLatestRequest();
  const detailRequest = useLatestRequest();
  const reloadJobs = useCallback(() => jobsRequest.run(
    (signal) => listJobs({ limit: 40 }, { signal }), {
      onStart: () => setLoadingJobs(true),
      onSuccess: (r) => {
        setJobsUnavailable(!!r.unavailable);
        const list = r.unavailable ? [] : asList(r.data).map(normalizeJob).filter(Boolean);
        setJobs(list);
        setJobId((prev) => {
          const id = prev || list[0]?.id || loadLastJobId() || '';
          if (!prev && id) setManualId(id);
          return id;
        });
      },
      onError: (e) => setError(e.message), onFinally: () => setLoadingJobs(false),
    }), [jobsRequest]);
  useEffect(() => { reloadJobs(); return () => jobsRequest.cancel(); }, [reloadJobs, jobsRequest]);

  const load = useCallback((id) => {
    if (!id || !fetchByJobId) return;
    return detailRequest.run((signal) => fetchByJobId(id, { signal }), {
      onStart: () => { setFetching(true); setError(''); setData(null); setUnavailable(false); },
      onSuccess: (r) => {
        setUnavailable(!!r.unavailable); setData(r.unavailable ? null : r.data);
        if (!r.unavailable) saveLastJobId(id);
      },
      onError: (e) => { setError(e.message); setData(null); },
      onFinally: () => setFetching(false),
    });
  }, [fetchByJobId, detailRequest]);
  useEffect(() => {
    if (jobId) load(jobId);
    else { detailRequest.cancel(); setData(null); setFetching(false); }
    return () => detailRequest.cancel();
  }, [jobId, load, detailRequest]);
  const applyManual = () => {
    const id = manualId.trim();
    if (!id) return;
    if (id === jobId) load(id); else setJobId(id);
  };

  const performDeleteJob = useCallback(async () => {
    const id = jobId || manualId;
    if (!id) return;
    detailRequest.cancel();
    setDeleting(true);
    setError('');
    try {
      const r = await deleteJob(id);
      if (r.unavailable) {
        setError(t('deleteJobUnavailable'));
        return;
      }
      if (loadLastJobId() === String(id)) clearLastJobId();
      setJobId('');
      setManualId('');
      setData(null);
      setConfirmOpen(false);
      await reloadJobs();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setDeleting(false);
    }
  }, [jobId, manualId, reloadJobs, t, detailRequest]);

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <>
            <BackendStatus />
            <Link to="/analyze" className={cn(buttonVariants({ size: 'sm' }), 'no-underline')}>
              {t('goAnalyze')}
            </Link>
            <Button
              variant="secondary"
              size="sm"
              disabled={!jobId || fetching}
              onClick={() => load(jobId)}
            >
              <RefreshCw className={cn('size-3.5', fetching && 'animate-spin')} />
              {t('refresh')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!jobId || deleting || fetching}
              onClick={() => setConfirmOpen(true)}
              className="text-muted-foreground hover:text-red-500"
            >
              <Trash2 className={cn('size-3.5', deleting && 'animate-pulse')} />
              {t('deleteJob')}
            </Button>
          </>
        }
      />

      <Card className="mb-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <label className="block min-w-[200px] flex-1">
            <span className="mb-1 block text-xs text-muted-foreground">{t('selectJob')}</span>
            <select
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary/40"
              value={jobId}
              disabled={loadingJobs || jobsUnavailable || deleting}
              onChange={(e) => {
                setJobId(e.target.value);
                setManualId(e.target.value);
              }}
            >
              <option value="">{jobsUnavailable ? t('noJobList') : t('selectJob')}</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {(j.sourceName || j.id).slice(0, 48)} · {(j.status || '').toString()}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-[240px] flex-1">
            <span className="mb-1 block text-xs text-muted-foreground">{t('jobDependentHint')}</span>
            <div className="flex gap-2">
              <input
                className="h-9 flex-1 rounded-lg border border-border bg-background px-3 font-mono text-sm outline-none focus:border-primary/40"
                value={manualId}
                disabled={deleting}
                onChange={(e) => setManualId(e.target.value)}
                placeholder="guid / job id"
              />
              <Button size="sm" variant="secondary" onClick={applyManual} disabled={deleting}>
                {t('refresh')}
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
      {fetching ? <LoadingBlock label={t('loading')} /> : null}

      {!fetching && unavailable && (
        <Card className="py-10 text-center text-sm text-muted-foreground">
          <div className="font-medium text-foreground">{t('apiReadyLater')}</div>
          <p className="mt-1 text-xs">
            {endpointTemplate
              ? endpointTemplate.replace('{jobId}', jobId || '{jobId}')
              : t('jobDependentHint')}
          </p>
          <p className="mt-2 text-xs">{emptyHint || t('jobDependentHint')}</p>
        </Card>
      )}

      {!fetching && !unavailable && data != null && renderData?.(data, jobId)}

      {!fetching && !unavailable && data == null && jobId && !error && (
        <Card className="py-10 text-center text-sm text-muted-foreground">
          {emptyHint || t('noData')}
        </Card>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => !deleting && setConfirmOpen(false)}
        onConfirm={performDeleteJob}
        title={t('deleteJob')}
        description={t('deleteJobConfirm')}
        confirmLabel={t('confirmDelete')}
        cancelLabel={t('confirmCancel')}
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
