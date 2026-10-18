import * as platformApi from '../api/index.js';
import { asList, normalizeJob, normalizeIssue, normalizeSnapshot, normalizeTrendPoint, dimsFromQuality } from './normalize.js';
import { extractDashboard, extractIssuesFromResponse } from './normalize-extract.js';
import { DEMO_MODE, initialPlatformData } from './data-mode.js';

export async function loadPlatformOverview({ demo = DEMO_MODE, api = platformApi } = {}) {
  if (demo) return { ...initialPlatformData(true), backendOk: false, error: null };
  const names = ['jobs', 'issues', 'snapshots', 'trend', 'dashboard', 'baselines', 'alerts'];
  const [health, ...results] = await Promise.allSettled([
    api.checkHealth(), api.listJobs({ limit: 20 }), api.listIssues({ limit: 50 }),
    api.listQualitySnapshots({ limit: 20 }), api.getQualityTrend({ days: 30 }),
    api.getQualityDashboard(), api.listBaselines(), api.listAlertRules(),
  ]);
  const modules = {};
  const responses = results.map((r, i) => {
    const failed = r.status === 'rejected';
    const response = failed ? { unavailable: true, data: null } : r.value;
    modules[names[i]] = {
      source: failed ? 'error' : response.unavailable ? 'unavailable' : 'api',
      error: failed ? r.reason?.message || String(r.reason) : response.unavailable ? '接口未启用' : null,
    };
    return response;
  });
  const [jr, ir, sr, tr, dr, br, ar] = responses;
  const data = initialPlatformData(false);
  let jobs = asList(jr.data).map(normalizeJob).filter(Boolean);
  const issuePack = extractIssuesFromResponse(ir.data);
  let issues = issuePack.issues.length ? issuePack.issues : asList(ir.data).map(normalizeIssue).filter(Boolean);
  if (jr.unavailable && issuePack.jobs.length) jobs = issuePack.jobs;
  let snapshots = asList(sr.data).map(normalizeSnapshot).filter(Boolean);
  let trend = asList(tr.data).map(normalizeTrendPoint).filter((p) => p && p.day);
  const dash = dr.unavailable ? null : extractDashboard(dr.data);
  if (sr.unavailable && dash?.snapshots?.length) snapshots = dash.snapshots;
  if (ir.unavailable && dash?.topIssues?.length) issues = dash.topIssues;
  if (jr.unavailable && dash?.job && !jobs.find((j) => j.id === dash.job.id)) jobs = [dash.job, ...jobs];
  const rawDims = dash?.dims || snapshots[0]?.dims || (snapshots[0]?.raw ? dimsFromQuality(snapshots[0].raw) : null);
  const dims = Object.fromEntries(Object.keys(data.dims).map((k) => [k, rawDims?.[k] ?? null]));
  // 总分只采用后端提供的值，缺失维度不参与推算。
  const score = dash?.score ?? snapshots[0]?.overallScore ?? jobs[0]?.score ?? null;
  if (tr.unavailable && snapshots.length) {
    trend = snapshots.map((s) => ({ day: (s.createdAt || '').slice(0, 10), score: s.overallScore }))
      .filter((p) => p.day && p.score != null).reverse();
  }
  const labels = { jobs: '作业', issues: '问题', snapshots: '质量快照', trend: '趋势', dashboard: '质量总览', baselines: '基线', alerts: '告警' };
  const errors = Object.entries(modules).filter(([, m]) => m.error).map(([name, m]) => labels[name] + ': ' + m.error);
  const backendOk = health.status === 'fulfilled' && !!health.value.ok;
  if (!backendOk) errors.unshift(health.status === 'rejected' ? health.reason?.message : health.value.error || '健康检查失败');
  return {
    ...data, backendOk, jobs, issues, snapshots, trend, dims, score, modules,
    error: errors.filter(Boolean).join('；') || null,
    baselines: asList(br.data).map((b) => ({
      id: b.id || b.Id || b.sourceName, name: b.name || b.Name || b.sourceName || '基线',
      score: b.minOverallScore ?? b.minOverall ?? b.score ?? b.Score ?? null, jobId: b.jobId || b.JobId,
    })),
    alerts: asList(ar.data).map((a) => ({
      id: a.id || a.Id, name: a.name || a.Name, condition: a.condition || a.Condition || a.expression,
      enabled: a.enabled ?? a.Enabled ?? true, lastFired: a.lastFired || a.LastFired,
      raw: a, updateBase: ar.path,
    })),
  };
}
