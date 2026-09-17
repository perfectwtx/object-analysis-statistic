import { request, tryRequest } from './client.js';

function qs(params = {}) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/** 依次尝试多个路径，第一个非 404 的结果返回 */
async function tryPaths(paths, opts) {
  let last = { data: null, unavailable: true };
  for (const path of paths) {
    const r = await tryRequest(path, opts);
    if (!r.unavailable) return r;
    last = r;
  }
  return last;
}

export function listJobs(params = {}, opts) {
  const q = qs(params);
  return tryPaths([
    `/jobs${q}`,
    `/analyze/jobs${q}`,
    `/analysis/jobs${q}`,
    `/analyze/async${q}`,
  ], { timeout: 15_000, ...opts });
}

export function getJob(jobId, opts) {
  const id = encodeURIComponent(jobId);
  return tryPaths([
    `/jobs/${id}`,
    `/analyze/async/${id}`,
    `/analyze/jobs/${id}`,
    `/analysis/jobs/${id}`,
  ], { timeout: 15_000, ...opts });
}

export function getJobResult(jobId, opts) {
  const id = encodeURIComponent(jobId);
  return tryPaths([
    `/jobs/${id}/result`,
    `/analyze/async/${id}`,
    `/analyze/jobs/${id}/result`,
  ], { timeout: 30_000, ...opts });
}

export function listQualitySnapshots(params = {}, opts) {
  const q = qs(params);
  return tryPaths([
    `/quality/snapshots${q}`,
    `/quality-snapshots${q}`,
    `/analysis/quality/snapshots${q}`,
  ], { timeout: 15_000, ...opts });
}

export function getQualityTrend(params = {}, opts) {
  const q = qs(params);
  return tryPaths([
    `/quality/trend${q}`,
    `/quality-trend${q}`,
  ], { timeout: 15_000, ...opts });
}

export function getFieldQualityByJob(jobId, opts) {
  const id = encodeURIComponent(jobId);
  return tryPaths([
    `/quality/snapshots/${id}/fields`,
    `/jobs/${id}/fields`,
    `/analyze/async/${id}`,
  ], { timeout: 15_000, ...opts });
}

export function getQualityRegression(params = {}, opts) {
  return tryRequest(`/quality/regression${qs(params)}`, { timeout: 15_000, ...opts });
}

export function listIssues(params = {}, opts) {
  const q = qs(params);
  return tryPaths([
    `/issues${q}`,
    `/quality/issues${q}`,
    `/analysis/issues${q}`,
  ], { timeout: 15_000, ...opts });
}

export function getJobIssues(jobId, opts) {
  const id = encodeURIComponent(jobId);
  return tryPaths([
    `/jobs/${id}/issues`,
    `/issues${qs({ jobId })}`,
  ], { timeout: 15_000, ...opts });
}

export function listBaselines(opts) {
  return tryPaths(['/quality-baselines', '/quality/baselines'], { timeout: 15_000, ...opts });
}

export function getBaseline(id, opts) {
  return tryRequest(`/quality-baselines/${encodeURIComponent(id)}`, { timeout: 10_000, ...opts });
}

export function createBaseline(body, opts) {
  return request('/quality-baselines', {
    method: 'POST', body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' }, timeout: 15_000, ...opts,
  });
}

export function updateBaseline(id, body, opts) {
  return request(`/quality-baselines/${encodeURIComponent(id)}`, {
    method: 'PUT', body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' }, timeout: 15_000, ...opts,
  });
}

export function deleteBaseline(id, opts) {
  return request(`/quality-baselines/${encodeURIComponent(id)}`, { method: 'DELETE', timeout: 10_000, ...opts });
}

export function listAlertRules(opts) {
  return tryPaths(['/alert-rules', '/alerts/rules', '/quality/alert-rules'], { timeout: 15_000, ...opts });
}

export function listWebhookDeliveries(params = {}, opts) {
  return tryRequest(`/webhooks/deliveries${qs(params)}`, { timeout: 15_000, ...opts });
}

export function getDataLineage(jobId, opts) {
  const id = encodeURIComponent(jobId);
  return tryPaths([
    `/analysis/jobs/${id}/lineage`,
    `/jobs/${id}/lineage`,
    `/analyze/async/${id}/lineage`,
  ], { timeout: 30_000, ...opts });
}

export function getImpactAnalysis(jobId, opts) {
  const id = encodeURIComponent(jobId);
  return tryPaths([
    `/analysis/jobs/${id}/impact`,
    `/jobs/${id}/impact`,
    `/analyze/async/${id}/impact`,
  ], { timeout: 30_000, ...opts });
}

export function getCapabilities(opts) {
  return tryPaths(['/capabilities', '/meta/capabilities'], { timeout: 5_000, ...opts });
}

/** 工作台完成分析后写入，供血缘/影响等页默认带上 */
export const LAST_JOB_KEY = 'oaLastJobId';
export function saveLastJobId(id) {
  if (!id) return;
  try { localStorage.setItem(LAST_JOB_KEY, String(id)); } catch { /* ignore */ }
}
export function loadLastJobId() {
  try { return localStorage.getItem(LAST_JOB_KEY) || ''; } catch { return ''; }
}
