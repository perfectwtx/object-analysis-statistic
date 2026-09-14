/**
 * 分析进度条（线框 ③ 操作条进度区）
 *
 * props:
 *   phase: 'idle' | 'submitting' | 'running' | 'done' | 'error' | 'cancelled'
 *   progress: { processedObjects, status, progressText }
 *   jobId?: string
 *   error?: string
 *   onCancel?: () => void
 *   onRetry?: () => void
 *   forceAsync?: boolean
 *   onForceAsyncChange?: (checked: boolean) => void
 *   showAsyncToggle?: boolean
 *   fileSize?: number
 *   asyncThreshold?: number
 */

import { ASYNC_THRESHOLD_BYTES } from '../api.js';

function formatCount(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return Number(n).toLocaleString();
}

function shortJobId(id) {
  if (!id) return '';
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

export default function JobProgress({
  phase = 'idle',
  progress = {},
  jobId,
  error,
  onCancel,
  onRetry,
  forceAsync = false,
  onForceAsyncChange,
  showAsyncToggle = true,
  fileSize = 0,
  asyncThreshold = ASYNC_THRESHOLD_BYTES,
}) {
  const busy = phase === 'submitting' || phase === 'running';
  const showBar = busy || phase === 'error' || phase === 'cancelled';
  const autoAsync = (fileSize || 0) >= asyncThreshold;

  let statusLabel = '';
  if (phase === 'submitting') statusLabel = '提交作业中…';
  else if (phase === 'running') {
    statusLabel = progress.progressText
      || (progress.processedObjects > 0
        ? `分析中 · 已处理 ${formatCount(progress.processedObjects)} 条`
        : '分析中…');
  } else if (phase === 'cancelled') statusLabel = '已取消';
  else if (phase === 'error') statusLabel = error || '分析失败';
  else if (phase === 'done') statusLabel = '完成';

  return (
    <div className={`job-progress ${phase}`}>
      {showAsyncToggle && (
        <label
          className="job-async-toggle"
          title={
            autoAsync
              ? `文件 ≥ ${(asyncThreshold / 1048576).toFixed(0)} MB，将自动走后台分析`
              : '勾选后即使小文件也走异步作业（可取消、可看进度）'
          }
        >
          <input
            type="checkbox"
            checked={forceAsync || autoAsync}
            disabled={busy || autoAsync}
            onChange={(e) => onForceAsyncChange?.(e.target.checked)}
          />
          后台分析
          {autoAsync && <span className="job-async-hint">（大文件已自动启用）</span>}
        </label>
      )}

      {showBar && (
        <div className="job-progress-body">
          <div className="job-progress-row">
            <span className={`job-status-text ${phase}`}>
              {busy && <span className="spinner" />}
              {statusLabel}
            </span>
            {busy && onCancel && (
              <button type="button" className="btn-link danger" onClick={onCancel}>
                取消
              </button>
            )}
            {(phase === 'error' || phase === 'cancelled') && onRetry && (
              <button type="button" className="btn-link" onClick={onRetry}>
                重新分析
              </button>
            )}
          </div>

          {busy && (
            <div className="job-progress-track" aria-hidden>
              <div className="job-progress-indeterminate" />
            </div>
          )}

          {jobId && (
            <div className="job-id-row">
              <span className="mono muted">Job {shortJobId(jobId)}</span>
            </div>
          )}

          {phase === 'error' && error && (
            <div className="job-error-detail">{error}</div>
          )}
        </div>
      )}
    </div>
  );
}
