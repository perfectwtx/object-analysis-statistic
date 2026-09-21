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

// ── Jobs / History ──
// 后端主路径：/analysis/jobs；别名：/jobs

export function listJobs(params = {}, opts) {
  const q = qs(params);
  return tryPaths([
    `/analysis/jobs${q}`,
    `/jobs${q}`,
    `/analyze/jobs${q}`,
  ], { timeout: 15_000, ...opts });
}

export function getJob(jobId, opts) {
  const id = encodeURIComponent(jobId);
  return tryPaths([
    `/analysis/jobs/${id}`,
    `/jobs/${id}`,
    `/analyze/async/${id}`,
  ], { timeout: 15_000, ...opts });
}

export function getJobResult(jobId, opts) {
  const id = encodeURIComponent(jobId);
  return tryPaths([
    `/analysis/jobs/${id}/result`,
    `/jobs/${id}/result`,
    `/analysis/jobs/${id}/overview`,
    `/analyze/async/${id}`,
  ], { timeout: 30_000, ...opts });
}

export function getJobOverview(jobId, opts) {
  const id = encodeURIComponent(jobId);
  return tryPaths([
    `/analysis/jobs/${id}/overview`,
    `/jobs/${id}/overview`,
  ], { timeout: 30_000, ...opts });
}

/**
 * 删除一条分析历史（及其关联结果）。
 * 后端约定：DELETE /api/analysis/jobs/{jobId}
 * 可选别名：DELETE /api/jobs/{jobId}
 * 成功 204/200；不存在 404；进行中可 409（前端会提示）。
 */
export function deleteJob(jobId, opts) {
  const id = encodeURIComponent(jobId);
  return tryPaths([
    `/analysis/jobs/${id}`,
    `/jobs/${id}`,
  ], { method: 'DELETE', timeout: 15_000, ...opts });
}

/** 批量删除：优先 body { ids }，失败则逐条 DELETE */
export async function deleteJobs(jobIds, opts) {
  const ids = (jobIds || []).map(String).filter(Boolean);
  if (!ids.length) return { data: { deleted: 0 }, unavailable: false };
  // 尝试批量端点
  const bulk = await tryPaths(
    ['/analysis/jobs', '/jobs'],
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
      timeout: 30_000,
      ...opts,
    },
  );
  if (!bulk.unavailable) return bulk;
  let deleted = 0;
  const failed = [];
  for (const id of ids) {
    const r = await deleteJob(id, opts);
    if (r.unavailable) failed.push(id);
    else deleted += 1;
  }
  return {
    data: { deleted, failed },
    unavailable: deleted === 0 && failed.length > 0,
  };
}

// ── Quality ──

export function getQualityDashboard(opts) {
  return tryPaths([
    '/quality/dashboard',
    '/quality-dashboard',
  ], { timeout: 15_000, ...opts });
}

export function listQualitySnapshots(params = {}, opts) {
  const q = qs(params);
  return tryPaths([
    `/quality/trend${q}`,
    `/quality/snapshots${q}`,
    `/quality-snapshots${q}`,
  ], { timeout: 15_000, ...opts });
}

export function getQualityTrend(params = {}, opts) {
  const q = qs(params);
  return tryPaths([
    `/quality/trend${q}`,
    `/quality-trend${q}`,
  ], { timeout: 15_000, ...opts });
}

/** 可查看字段质量的作业列表 */
export function listFieldQualityJobs(opts) {
  return tryPaths([
    '/quality/fields',
    '/analysis/jobs?limit=100',
  ], { timeout: 15_000, ...opts });
}

export function getFieldQualityByJob(jobId, opts) {
  const id = encodeURIComponent(jobId);
  return tryPaths([
    `/quality/fields/${id}`,
    `/quality/snapshots/${id}/fields`,
    `/jobs/${id}/fields`,
  ], { timeout: 15_000, ...opts });
}

export function getRelationships(jobId, opts) {
  const id = encodeURIComponent(jobId);
  return tryPaths([
    `/quality/relationships/${id}`,
    `/jobs/${id}/relationships`,
  ], { timeout: 30_000, ...opts });
}

export function getObjectRelationships(jobId, opts) {
  const id = encodeURIComponent(jobId);
  return tryPaths([
    `/quality/object-relationships/${id}`,
    `/jobs/${id}/object-relationships`,
  ], { timeout: 30_000, ...opts });
}

export function getSchemaImpact(jobId, opts) {
  const id = encodeURIComponent(jobId);
  return tryPaths([
    `/quality/schema-impact/${id}`,
    `/jobs/${id}/schema-impact`,
    `/analysis/jobs/${id}/impact`,
  ], { timeout: 30_000, ...opts });
}

export function getRecommendations(params = {}, opts) {
  const q = qs(params);
  return tryPaths([
    `/quality/recommendations${q}`,
    `/recommendations${q}`,
  ], { timeout: 15_000, ...opts });
}

export function getQualityRegression(params = {}, opts) {
  const q = qs(params);
  return tryPaths([
    `/quality/regression${q}`,
    `/quality-regression${q}`,
  ], { timeout: 15_000, ...opts });
}

// ── Issues ──

export function listIssues(params = {}, opts) {
  const q = qs(params);
  return tryPaths([
    `/issues${q}`,
    `/quality/issues${q}`,
  ], { timeout: 15_000, ...opts });
}

export function getJobIssues(jobId, opts) {
  const id = encodeURIComponent(jobId);
  return tryPaths([
    `/issues/${id}`,
    `/jobs/${id}/issues`,
    `/issues${qs({ jobId })}`,
  ], { timeout: 15_000, ...opts });
}

export function getIssueSummary(params = {}, opts) {
  return tryRequest(`/issues/summary${qs(params)}`, { timeout: 15_000, ...opts });
}

export function updateIssueStatus(jobId, fieldName, check, body, opts) {
  const path = `/issues/${encodeURIComponent(jobId)}/${encodeURIComponent(fieldName)}/${encodeURIComponent(check)}/status`;
  return request(path, {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    timeout: 15_000,
    ...opts,
  });
}

// ── Baselines ──

export function listBaselines(opts) {
  return tryPaths(['/quality-baselines', '/quality/baselines'], { timeout: 15_000, ...opts });
}

export function getBaseline(id, opts) {
  return tryPaths([
    `/quality-baselines/${encodeURIComponent(id)}`,
    `/quality/baselines/${encodeURIComponent(id)}`,
  ], { timeout: 10_000, ...opts });
}

export function createBaseline(body, opts) {
  return request('/quality-baselines', {
    method: 'POST', body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' }, timeout: 15_000, ...opts,
  }).catch(async (e) => {
    if (e?.status === 404) {
      return request('/quality/baselines', {
        method: 'POST', body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' }, timeout: 15_000, ...opts,
      });
    }
    throw e;
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

// ── Alerts / Webhooks ──

export function listAlertRules(opts) {
  return tryPaths(['/alert-rules', '/alerts/rules', '/quality/alert-rules'], { timeout: 15_000, ...opts });
}

export function createAlertRule(body, opts) {
  return request('/alert-rules', {
    method: 'POST', body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' }, timeout: 15_000, ...opts,
  });
}

export function updateAlertRule(id, body, opts) {
  return request(`/alert-rules/${encodeURIComponent(id)}`, {
    method: 'PUT', body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' }, timeout: 15_000, ...opts,
  });
}

export function deleteAlertRule(id, opts) {
  return request(`/alert-rules/${encodeURIComponent(id)}`, { method: 'DELETE', timeout: 10_000, ...opts });
}

export function listWebhookDeliveries(params = {}, opts) {
  return tryRequest(`/webhooks/deliveries${qs(params)}`, { timeout: 15_000, ...opts });
}

// ── Lineage / Impact ──

export function getDataLineage(jobId, opts) {
  const id = encodeURIComponent(jobId);
  return tryPaths([
    `/analysis/jobs/${id}/lineage`,
    `/jobs/${id}/lineage`,
  ], { timeout: 30_000, ...opts });
}

export function getImpactAnalysis(jobId, opts) {
  const id = encodeURIComponent(jobId);
  return tryPaths([
    `/analysis/jobs/${id}/impact`,
    `/jobs/${id}/impact`,
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
export function clearLastJobId() {
  try { localStorage.removeItem(LAST_JOB_KEY); } catch { /* ignore */ }
}
