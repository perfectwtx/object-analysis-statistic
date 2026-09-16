import { request, tryRequest } from './client.js';

function qs(params = {}) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export function listJobs(params = {}, opts) {
  return tryRequest(`/jobs${qs(params)}`, { timeout: 15_000, ...opts });
}
export function getJob(jobId, opts) {
  return tryRequest(`/jobs/${encodeURIComponent(jobId)}`, { timeout: 15_000, ...opts });
}
export function getJobResult(jobId, opts) {
  return tryRequest(`/jobs/${encodeURIComponent(jobId)}/result`, { timeout: 30_000, ...opts });
}
export function listQualitySnapshots(params = {}, opts) {
  return tryRequest(`/quality/snapshots${qs(params)}`, { timeout: 15_000, ...opts });
}
export function getQualityTrend(params = {}, opts) {
  return tryRequest(`/quality/trend${qs(params)}`, { timeout: 15_000, ...opts });
}
export function getFieldQualityByJob(jobId, opts) {
  return tryRequest(`/quality/snapshots/${encodeURIComponent(jobId)}/fields`, { timeout: 15_000, ...opts });
}
export function getQualityRegression(params = {}, opts) {
  return tryRequest(`/quality/regression${qs(params)}`, { timeout: 15_000, ...opts });
}
export function listIssues(params = {}, opts) {
  return tryRequest(`/issues${qs(params)}`, { timeout: 15_000, ...opts });
}
export function getJobIssues(jobId, opts) {
  return tryRequest(`/jobs/${encodeURIComponent(jobId)}/issues`, { timeout: 15_000, ...opts });
}
export function listBaselines(opts) {
  return tryRequest('/quality-baselines', { timeout: 15_000, ...opts });
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
  return tryRequest('/alert-rules', { timeout: 15_000, ...opts });
}
export function listWebhookDeliveries(params = {}, opts) {
  return tryRequest(`/webhooks/deliveries${qs(params)}`, { timeout: 15_000, ...opts });
}
export function getDataLineage(jobId, opts) {
  return tryRequest(`/analysis/jobs/${encodeURIComponent(jobId)}/lineage`, { timeout: 30_000, ...opts });
}
export function getImpactAnalysis(jobId, opts) {
  return tryRequest(`/analysis/jobs/${encodeURIComponent(jobId)}/impact`, { timeout: 30_000, ...opts });
}
export function getCapabilities(opts) {
  return tryRequest('/capabilities', { timeout: 5_000, ...opts });
}
