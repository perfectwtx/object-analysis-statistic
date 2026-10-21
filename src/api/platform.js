import { request, tryRequest, getBaseUrl } from './client.js';
import { normalizeCapabilities } from '../lib/capabilities.js';

const routeCache = new Map();
const capabilityCache = new Map();
const CACHE_MS = 30_000;
export function clearApiDiscovery() { routeCache.clear(); capabilityCache.clear(); }

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
  const key = `${getBaseUrl()}|${opts?.method || 'GET'}|${paths.map((p) => p.split('?')[0]).join('|')}`;
  const cachedRoute = routeCache.get(key);
  if (!opts?.forceDiscovery && opts?.cacheUnavailable && cachedRoute?.unavailable && Date.now() - cachedRoute.at < CACHE_MS) return cachedRoute.result;
  const preferred = cachedRoute?.index;
  const indices = paths.map((_, i) => i);
  if (preferred != null) {
    indices.splice(indices.indexOf(preferred), 1);
    indices.unshift(preferred);
  }
  let last = { data: null, unavailable: true };
  for (const index of indices) {
    const path = paths[index];
    const r = await tryRequest(path, opts);
    if (!r.unavailable) { routeCache.set(key, { index }); return { ...r, path }; }
    last = r;
  }
  if (opts?.cacheUnavailable) routeCache.set(key, { unavailable: true, at: Date.now(), result: last });
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
  ], { timeout: 15_000, cacheUnavailable: true, ...opts });
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
  ], { timeout: 15_000, cacheUnavailable: true, ...opts });
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
  ], { timeout: 15_000, cacheUnavailable: true, ...opts });
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
  ], { timeout: 15_000, cacheUnavailable: true, ...opts });
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
  return tryPaths(['/quality-baselines', '/quality/baselines'], { timeout: 15_000, cacheUnavailable: true, ...opts });
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
  return tryPaths([`/quality-baselines/${encodeURIComponent(id)}`, `/quality/baselines/${encodeURIComponent(id)}`], {
    method: 'PUT', body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' }, timeout: 15_000, ...opts,
  }).then(unwrapMutation);
}

export function deleteBaseline(id, opts) {
  return tryPaths([`/quality-baselines/${encodeURIComponent(id)}`, `/quality/baselines/${encodeURIComponent(id)}`], { method: 'DELETE', timeout: 10_000, ...opts }).then(unwrapMutation);
}

function unwrapMutation(result) {
  if (result.unavailable) throw new Error(result.error || '接口未启用');
  return result.data;
}

// ── Alerts / Webhooks ──

export function listAlertRules(opts) {
  return tryPaths(['/alert-rules', '/alerts/rules', '/quality/alert-rules'], { timeout: 15_000, cacheUnavailable: true, ...opts });
}

export function createAlertRule(body, opts) {
  return request('/alert-rules', {
    method: 'POST', body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' }, timeout: 15_000, ...opts,
  });
}

export function updateAlertRule(id, body, opts) {
  const { basePath = '/alert-rules', ...requestOpts } = opts || {};
  if (!['/alert-rules', '/alerts/rules', '/quality/alert-rules'].includes(basePath)) {
    throw new Error('告警更新路径无效');
  }
  return request(`${basePath}/${encodeURIComponent(id)}`, {
    method: 'PUT', body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' }, timeout: 15_000, ...requestOpts,
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

export async function getCapabilities({ force = false, ...opts } = {}) {
  const base = getBaseUrl();
  const cached = capabilityCache.get(base);
  if (!force && cached && Date.now() - cached.at < CACHE_MS) return cached.promise;
  const promise = tryPaths(['/capabilities', '/meta/capabilities'], { timeout: 5_000, ...opts })
    .then((r) => ({ ...r, data: r.unavailable ? {} : normalizeCapabilities(r.data) }));
  capabilityCache.set(base, { at: Date.now(), promise });
  try { return await promise; } catch (e) { capabilityCache.delete(base); throw e; }
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
