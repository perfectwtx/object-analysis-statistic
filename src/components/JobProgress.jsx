import { useT } from '../lib/i18n.js';
/**
 * 分析进度条
 * phase: idle | submitting | running | done | error | cancelled
 */
export default function JobProgress({
  phase = 'idle',
  progress = {},
  jobId,
  error,
  onCancel,
  onRetry,
  forceAsync = false,
  onForceAsyncChange,
  showAsyncToggle = false,
  fileSize = 0,
}) {
  const { t } = useT();
  const busy = phase === 'submitting' || phase === 'running';
  const show = busy || phase === 'error' || phase === 'cancelled';
  if (!show && phase === 'idle') {
    if (!showAsyncToggle) return null;
    return (
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {showAsyncToggle ? (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={forceAsync}
              onChange={(e) => onForceAsyncChange?.(e.target.checked)}
            />
            {t('forceAsync')}
            {fileSize > 0 ? <span>（{(fileSize / 1024).toFixed(0)} KB）</span> : null}
          </label>
        ) : null}
      </div>
    );
  }
  if (!show) return null;

  let statusLabel = '';
  if (phase === 'submitting') statusLabel = t('submitting');
  else if (phase === 'running') {
    const n = progress.processedObjects;
    statusLabel =
      n > 0 ? `${t('analyzing')} · ${Number(n).toLocaleString()}` : t('analyzing');
    if (progress.progressText) statusLabel = progress.progressText;
  } else if (phase === 'cancelled') statusLabel = t('cancelled');
  else if (phase === 'error') statusLabel = error || t('analyzeFailed');
  else if (phase === 'done') statusLabel = t('done');

  const pct =
    progress.percent != null
      ? Math.min(100, Math.max(0, Number(progress.percent)))
      : busy
        ? null
        : 100;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          {busy ? (
            <span className="size-2 shrink-0 animate-pulse rounded-full bg-primary" />
          ) : phase === 'error' ? (
            <span className="size-2 shrink-0 rounded-full bg-danger" />
          ) : (
            <span className="size-2 shrink-0 rounded-full bg-muted-foreground" />
          )}
          <span className="truncate">{statusLabel}</span>
          {jobId ? (
            <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">
              {jobId}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {busy && onCancel ? (
            <button
              type="button"
              className="text-xs text-danger hover:underline"
              onClick={onCancel}
            >
              {t('cancel')}
            </button>
          ) : null}
          {(phase === 'error' || phase === 'cancelled') && onRetry ? (
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={onRetry}
            >
              {t('retry')}
            </button>
          ) : null}
        </div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${
            phase === 'error' ? 'bg-danger' : 'bg-primary'
          } ${busy && pct == null ? 'w-1/3 animate-pulse' : ''}`}
          style={pct != null ? { width: `${pct}%` } : undefined}
        />
      </div>
      {phase === 'error' && error ? (
        <div className="text-xs text-danger">{error}</div>
      ) : null}
    </div>
  );
}
