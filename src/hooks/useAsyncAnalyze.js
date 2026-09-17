/**
 * 分析生命周期 Hook：同步 / 异步统一对外接口。
 *
 * phase:
 *   idle | submitting | running | done | error | cancelled
 *
 * 用法：
 *   const { phase, progress, result, error, jobId, start, cancel, reset } = useAsyncAnalyze();
 *   await start(file, options, { forceAsync, preferAsync });
 */

import { useCallback, useRef, useState } from 'react';
import {
  analyzeFile,
  analyzeFileAsync,
  getAnalyzeJob,
  cancelAnalyzeJob,
  subscribeAnalyzeEvents,
  pollAnalyzeJob,
  ASYNC_THRESHOLD_BYTES,
  saveLastJobId,
} from '../api/index.js';
import { adaptAnalysisResponse } from '../adapter.js';

function isRunning(status) {
  return String(status || '').toLowerCase() === 'running';
}

function isSuccess(status) {
  const s = String(status || '').toLowerCase();
  return s === 'completed' || s === 'succeeded' || s === 'success';
}

function isFailed(status) {
  return String(status || '').toLowerCase() === 'failed';
}

function isCancelled(status) {
  return String(status || '').toLowerCase() === 'cancelled';
}

function adaptFromJobSnap(snap, t0, file) {
  const payload = snap?.result
    ? {
        result: snap.result,
        preview: snap.preview,
        fileName: snap.meta?.dataFileName ?? snap.meta?.DataFileName,
        format: snap.meta?.format ?? snap.meta?.Format,
        piiRedacted: snap.piiRedacted,
        pii: snap.pii,
      }
    : snap;

  const adapted = adaptAnalysisResponse(payload);
  adapted._api = {
    ...(adapted._api || {}),
    elapsedMs: Math.round(performance.now() - t0),
    bytes: file?.size ?? null,
    jobId: snap?.id ?? snap?.Id ?? null,
    async: true,
  };
  return adapted;
}

export function useAsyncAnalyze() {
  const [phase, setPhase] = useState('idle');
  const [progress, setProgress] = useState({
    processedObjects: 0,
    status: null,
    progressText: null,
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [jobId, setJobId] = useState(null);

  const abortRef = useRef(null);
  const cancelledRef = useRef(false);
  const sseRef = useRef(null);
  const pollRef = useRef(null);
  const jobIdRef = useRef(null);
  const t0Ref = useRef(0);
  const fileRef = useRef(null);

  const cleanup = useCallback(() => {
    sseRef.current?.close?.();
    sseRef.current = null;
    pollRef.current?.stop?.();
    pollRef.current = null;
  }, []);

  const reset = useCallback(() => {
    cleanup();
    cancelledRef.current = false;
    abortRef.current = null;
    jobIdRef.current = null;
    setPhase('idle');
    setProgress({ processedObjects: 0, status: null, progressText: null });
    setResult(null);
    setError(null);
    setJobId(null);
  }, [cleanup]);

  const finishFromSnap = useCallback((snap) => {
    const status = snap?.status;
    if (isSuccess(status)) {
      try {
        const adapted = adaptFromJobSnap(snap, t0Ref.current, fileRef.current);
        setResult(adapted);
        setPhase('done');
        setProgress((p) => ({
          ...p,
          status: String(status),
          processedObjects: snap.processedObjects ?? p.processedObjects,
        }));
      } catch (e) {
        setError(e.message || '结果适配失败');
        setPhase('error');
      }
      return;
    }
    if (isFailed(status)) {
      setError(snap.error || '分析失败');
      setPhase('error');
      return;
    }
    if (isCancelled(status)) {
      setPhase('cancelled');
      setError('已取消分析');
      return;
    }
    setError(snap.error || `未知作业状态：${status}`);
    setPhase('error');
  }, []);

  const watchJob = useCallback(
    (id) => {
      cleanup();

      let sseFailed = false;
      sseRef.current = subscribeAnalyzeEvents(id, {
        onProgress: (p) => {
          setProgress({
            processedObjects: p.processedObjects ?? 0,
            status: p.status ?? 'Running',
            progressText: null,
          });
        },
        onComplete: async () => {
          try {
            const snap = await getAnalyzeJob(id);
            finishFromSnap(snap);
          } catch (e) {
            setError(e.message || '拉取结果失败');
            setPhase('error');
          }
        },
        onGone: () => {
          setError('作业已过期或不存在，请重新提交');
          setPhase('error');
        },
        onError: () => {
          sseFailed = true;
          if (cancelledRef.current) return;
          pollRef.current = pollAnalyzeJob(id, {
            intervalMs: 1000,
            onUpdate: (snap) => {
              setProgress({
                processedObjects: snap.processedObjects ?? 0,
                status: snap.status,
                progressText: snap.progressText ?? null,
              });
            },
            onTerminal: (snap) => finishFromSnap(snap),
            onError: (e) => {
              console.warn('[pollAnalyzeJob]', e.message);
            },
          });
        },
      });

      if (typeof EventSource === 'undefined') {
        sseRef.current?.close?.();
        pollRef.current = pollAnalyzeJob(id, {
          intervalMs: 1000,
          onUpdate: (snap) => {
            setProgress({
              processedObjects: snap.processedObjects ?? 0,
              status: snap.status,
              progressText: snap.progressText ?? null,
            });
          },
          onTerminal: (snap) => finishFromSnap(snap),
        });
      }

      return () => {
        if (sseFailed) {
          /* poll already started in onError */
        }
      };
    },
    [cleanup, finishFromSnap],
  );

  const start = useCallback(
    async (file, options = {}, mode = {}) => {
      if (!file) return;

      cleanup();
      cancelledRef.current = false;
      fileRef.current = file;
      t0Ref.current = performance.now();
      setError(null);
      setResult(null);
      setJobId(null);
      jobIdRef.current = null;
      setProgress({ processedObjects: 0, status: null, progressText: null });

      const preferAsync =
        mode.forceAsync === true ||
        (mode.forceSync !== true &&
          (options.preferAsync === true || (file.size ?? 0) >= ASYNC_THRESHOLD_BYTES));

      if (!preferAsync) {
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        setPhase('running');
        try {
          const payload = await analyzeFile(file, {
            ...options,
            request: { signal: ctrl.signal, ...(options.request || {}) },
          });
          if (cancelledRef.current) {
            setPhase('cancelled');
            setError('已取消分析');
            return;
          }
          const adapted = adaptAnalysisResponse(payload);
          adapted._api = {
            ...(adapted._api || {}),
            elapsedMs: Math.round(performance.now() - t0Ref.current),
            bytes: file.size ?? null,
            async: false,
          };
          setResult(adapted);
          setPhase('done');
        } catch (e) {
          if (cancelledRef.current) {
            setPhase('cancelled');
            setError('已取消分析');
          } else {
            setError(e.message || '分析失败');
            setPhase('error');
          }
        } finally {
          if (abortRef.current === ctrl) abortRef.current = null;
        }
        return;
      }

      setPhase('submitting');
      try {
        const res = await analyzeFileAsync(file, options);
        if (cancelledRef.current) {
          setPhase('cancelled');
          setError('已取消分析');
          return;
        }
        const id = res.jobId || res.JobId;
        if (!id) throw new Error('后端未返回 jobId');
        jobIdRef.current = id;
        setJobId(id);
        saveLastJobId(id);
        setPhase('running');
        setProgress({
          processedObjects: 0,
          status: res.status || 'Running',
          progressText: null,
        });
        watchJob(id);
      } catch (e) {
        if (cancelledRef.current) {
          setPhase('cancelled');
          setError('已取消分析');
        } else {
          setError(e.message || '提交作业失败');
          setPhase('error');
        }
      }
    },
    [cleanup, watchJob],
  );

  const cancel = useCallback(async () => {
    cancelledRef.current = true;
    const id = jobIdRef.current;

    abortRef.current?.abort();

    cleanup();
    if (id) {
      try {
        await cancelAnalyzeJob(id);
      } catch {
        /* 作业可能已终态 */
      }
    }
    setPhase('cancelled');
    setError('已取消分析');
  }, [cleanup]);

  const busy = phase === 'submitting' || phase === 'running';

  return {
    phase,
    busy,
    progress,
    result,
    error,
    jobId,
    start,
    cancel,
    reset,
  };
}

export default useAsyncAnalyze;
