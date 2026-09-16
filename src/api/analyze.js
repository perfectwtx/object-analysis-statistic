import { request, getBaseUrl } from './client.js';

export const ASYNC_THRESHOLD_BYTES = 2 * 1024 * 1024;

export function appendAnalyzeOptions(form, options = {}) {
  if (options.rulesJson) form.append('rulesJson', options.rulesJson);
  else if (options.rules) form.append('rules', options.rules);
  const num = (v) => (v === undefined || v === null || v === '' ? null : String(v));
  const append = (k, v) => { if (v !== null && v !== undefined && v !== '') form.append(k, String(v)); };
  if (options.flatten !== undefined) form.append('flatten', String(options.flatten));
  if (options.csvInferNumbers !== undefined) form.append('csvInferNumbers', String(options.csvInferNumbers));
  if (options.allowUnknownRules !== undefined) form.append('allowUnknownRules', String(options.allowUnknownRules));
  append('maxValues', num(options.maxValues));
  append('fields', options.fields);
  append('filter', options.filter);
  append('rootPath', options.rootPath);
  append('recordPath', options.recordPath);
  append('sampleReservoir', num(options.sampleReservoir));
  append('sampleStep', num(options.sampleStep));
  append('maxParallel', num(options.maxParallel));
  for (const [k, v] of Object.entries(options.features || {})) {
    if (v !== undefined && v !== null) form.append(k, String(v));
  }
}

export function analyzeFile(file, options = {}) {
  const form = new FormData();
  form.append('file', file);
  appendAnalyzeOptions(form, options);
  return request('/analyze', { method: 'POST', body: form, ...options.request });
}

export function analyzeFileAsync(file, options = {}) {
  const form = new FormData();
  form.append('file', file);
  appendAnalyzeOptions(form, options);
  return request('/analyze/async', { method: 'POST', body: form, timeout: 60_000, ...options.request });
}

export function getAnalyzeJob(jobId, opts = {}) {
  return request(`/analyze/async/${encodeURIComponent(jobId)}`, { timeout: 15_000, ...opts });
}

export function cancelAnalyzeJob(jobId, opts = {}) {
  return request(`/analyze/async/${encodeURIComponent(jobId)}/cancel`, { method: 'POST', timeout: 10_000, ...opts });
}

export function subscribeAnalyzeEvents(jobId, { onProgress, onComplete, onGone, onError } = {}) {
  const url = `${getBaseUrl()}/analyze/async/${encodeURIComponent(jobId)}/events`;
  const es = new EventSource(url);
  let closed = false;
  const safeParse = (data) => { try { return JSON.parse(data); } catch { return {}; } };
  es.addEventListener('progress', (e) => onProgress?.(safeParse(e.data)));
  es.addEventListener('complete', (e) => { const p = safeParse(e.data); onProgress?.(p); onComplete?.(p); close(); });
  es.addEventListener('gone', (e) => { onGone?.(safeParse(e.data)); close(); });
  es.onerror = () => { if (!closed) { onError?.(new Error('SSE 连接中断')); close(); } };
  function close() { if (closed) return; closed = true; try { es.close(); } catch {} }
  return { close };
}

export function pollAnalyzeJob(jobId, { intervalMs = 1000, onUpdate, onTerminal, onError } = {}) {
  let stopped = false, timer = null;
  const tick = async () => {
    if (stopped) return;
    try {
      const snap = await getAnalyzeJob(jobId);
      onUpdate?.(snap);
      if (!/^running$/i.test(String(snap?.status || ''))) { onTerminal?.(snap); stop(); return; }
    } catch (e) { onError?.(e); }
    if (!stopped) timer = setTimeout(tick, intervalMs);
  };
  timer = setTimeout(tick, 0);
  function stop() { stopped = true; if (timer) clearTimeout(timer); }
  return { stop };
}

export async function validateRules(rulesText, opts = {}) {
  const { strict, ...req } = opts;
  try {
    const r = await request(`/rules/validate${strict === false ? '?strict=false' : ''}`, {
      method: 'POST', body: rulesText, headers: { 'Content-Type': 'application/json' }, timeout: 15_000, ...req,
    });
    return { ok: r?.valid !== false, fields: r?.fields ?? 0, unknowns: r?.unknowns ?? [], error: r?.error };
  } catch (e) {
    return { ok: false, error: e.message, offline: /无法连接后端/.test(e.message) };
  }
}

export function fetchRulesReference(opts) {
  return request('/rules/reference', { timeout: 10_000, ...opts });
}

export async function preflight(file, options = {}) {
  const form = new FormData();
  form.append('file', file);
  if (options.rulesJson) form.append('rulesJson', options.rulesJson);
  else if (options.rules) form.append('rules', options.rules);
  if (options.flatten !== undefined) form.append('flatten', String(options.flatten));
  if (options.csvInferNumbers !== undefined) form.append('csvInferNumbers', String(options.csvInferNumbers));
  if (options.recordPath) form.append('recordPath', options.recordPath);
  if (options.allowUnknownRules !== undefined) form.append('allowUnknownRules', String(options.allowUnknownRules));
  const r = await request('/preflight', { method: 'POST', body: form, timeout: 30_000 });
  return r?.preflight ?? r;
}

export const health = (opts) => request('/health', { timeout: 5000, ...opts });
