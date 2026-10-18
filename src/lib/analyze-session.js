export const idleAnalysis = () => ({
  phase: 'idle', progress: { processedObjects: 0, status: null, progressText: null },
  result: null, error: null, jobId: null,
});

// 与 React 解耦，保证每个回调只属于创建它的执行实例。
export function createAnalyzeSession(api, adapt, emit) {
  let current = null;
  const isCurrent = (run) => current === run && !run.detached;
  const active = (run) => isCurrent(run) && !run.cancelled && !run.finished;
  function publish(run, patch) { if (isCurrent(run)) emit(patch); }
  function cleanup(run) {
    run.sse?.close(); run.poll?.stop(); run.resultCtrl?.abort();
    run.sse = null; run.poll = null;
    run.removeSignal?.();
  }
  async function cancelBackend(run) {
    if (!run.id || run.cancelSent) return;
    run.cancelSent = true;
    try {
      await api.cancelAnalyzeJob(run.id);
      publish(run, { error: '已请求取消分析' });
    }
    catch (e) {
      // 用户必须能区分本地停止跟踪和后端已确认取消。
      publish(run, { error: `取消请求失败，后端任务可能仍在运行：${e.message}` });
    }
  }
  function retire(run, cancel = false) {
    if (!run) return;
    cleanup(run);
    run.syncCtrl?.abort();
    if (cancel && !run.finished) { run.cancelled = true; void cancelBackend(run); }
    run.detached = true;
  }
  function fail(run, e) {
    if (!active(run)) return;
    cleanup(run); run.finished = true;
    publish(run, { phase: 'error', error: e.message || String(e) });
  }
  function finish(run, snap) {
    if (!active(run)) return;
    const status = String(snap?.status || '').toLowerCase();
    if (['running', 'queued', 'pending', 'submitted'].includes(status)) return;
    cleanup(run);
    try {
      if (['completed', 'succeeded', 'success'].includes(status)) {
        const payload = snap.result ? {
          result: snap.result, preview: snap.preview,
          fileName: snap.meta?.dataFileName ?? snap.meta?.DataFileName,
          format: snap.meta?.format ?? snap.meta?.Format,
          piiRedacted: snap.piiRedacted, pii: snap.pii,
        } : snap;
        const result = adapt(payload);
        result._api = { ...result._api, elapsedMs: Math.round(performance.now() - run.t0), bytes: run.file.size ?? null, jobId: run.id, async: true };
        run.finished = true;
        publish(run, { phase: 'done', result, progress: { processedObjects: snap.processedObjects ?? 0, status: snap.status, progressText: null } });
        api.onCompleted?.();
      } else if (['cancelled', 'canceled'].includes(status)) {
        run.finished = true;
        publish(run, { phase: 'cancelled', error: '已取消分析' });
      } else {
        fail(run, new Error(snap.error || `未知或失败的作业状态：${snap.status}`));
      }
    } catch (e) { fail(run, e); }
  }
  function watch(run) {
    const update = (p) => {
      if (active(run)) publish(run, { progress: { processedObjects: p.processedObjects ?? 0, status: p.status, progressText: p.progressText ?? null } });
    };
    const poll = () => {
      if (!active(run) || run.poll) return;
      run.sse?.close(); run.sse = null;
      run.poll = api.pollAnalyzeJob(run.id, {
        onUpdate: update, onTerminal: (s) => finish(run, s),
        onError: (e, { terminal } = {}) => { if (terminal) fail(run, e); },
      });
    };
    if (typeof EventSource === 'undefined') { poll(); return; }
    try {
      run.sse = api.subscribeAnalyzeEvents(run.id, {
        onProgress: update,
        onComplete: async () => {
          if (!active(run)) return;
          run.resultCtrl = new AbortController();
          try {
            const snap = await api.getAnalyzeJob(run.id, { signal: run.resultCtrl.signal });
            finish(run, snap);
            if (active(run)) poll();
          } catch { if (active(run)) poll(); }
        },
        onGone: () => fail(run, new Error('作业已过期或不存在，请重新提交')),
        onError: poll,
      });
    } catch { poll(); }
  }
  async function cancel() {
    const run = current;
    if (!run || !active(run)) return;
    run.cancelled = true;
    cleanup(run); run.syncCtrl?.abort();
    publish(run, { phase: 'cancelled', error: run.id ? '正在请求取消分析' : run.syncCtrl ? '已取消分析' : '已停止本地跟踪；若提交成功，将自动请求取消后端任务' });
    await cancelBackend(run);
  }
  async function start(file, options = {}, mode = {}) {
    if (!file) return;
    retire(current, true);
    const run = { file, t0: performance.now(), id: null, cancelled: false, detached: false, finished: false };
    current = run;
    const asyncMode = mode.forceAsync === true || (mode.forceSync !== true && (options.preferAsync === true || file.size >= api.ASYNC_THRESHOLD_BYTES));
    publish(run, { ...idleAnalysis(), phase: asyncMode ? 'submitting' : 'running' });
    const externalSignal = options.request?.signal;
    if (externalSignal) {
      const onAbort = () => { if (isCurrent(run)) void cancel(); };
      externalSignal.addEventListener('abort', onAbort, { once: true });
      run.removeSignal = () => externalSignal.removeEventListener('abort', onAbort);
      if (externalSignal.aborted) { await cancel(); return; }
    }
    try {
      if (!asyncMode) {
        run.syncCtrl = new AbortController();
        const payload = await api.analyzeFile(file, { ...options, request: { ...options.request, signal: run.syncCtrl.signal } });
        if (!active(run)) return;
        const result = adapt(payload);
        result._api = { ...result._api, elapsedMs: Math.round(performance.now() - run.t0), bytes: file.size ?? null, async: false };
        cleanup(run); run.finished = true;
        publish(run, { phase: 'done', result });
        api.onCompleted?.();
      } else {
        // 提交不能盲目中止：后端可能已经建好任务。保留响应以取得 jobId，取消后补发取消请求。
        const res = await api.analyzeFileAsync(file, { ...options, request: { ...options.request, signal: undefined } });
        run.id = res.jobId || res.JobId;
        if (!run.id) throw new Error('后端未返回 jobId');
        if (run.cancelled) { publish(run, { jobId: run.id }); await cancelBackend(run); return; }
        if (!active(run)) return;
        api.saveLastJobId(run.id);
        publish(run, { phase: 'running', jobId: run.id });
        watch(run);
      }
    } catch (e) { fail(run, e); }
  }
  return {
    start, cancel,
    reset() { retire(current, true); current = null; emit(idleAnalysis()); },
    // 离开页面仅停止本地跟踪，不取消服务端长任务。
    dispose() { retire(current); current = null; },
  };
}
