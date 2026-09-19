import {
  listJobs,
  listIssues,
  listQualitySnapshots,
  getQualityTrend,
  listBaselines,
  listAlertRules,
} from '../api/index.js';
import { checkHealth } from '../api/client.js';
import {
  asList,
  normalizeJob,
  normalizeIssue,
  normalizeSnapshot,
  normalizeTrendPoint,
  dimsFromQuality,
} from './normalize.js';
import {
  SEED_ALERTS,
  SEED_BASELINES,
  SEED_DIMS,
  SEED_FIELDS,
  SEED_ISSUES,
  SEED_JOBS,
  buildTrend,
} from './mock-data.js';

export async function loadPlatformOverview() {
  const health = await checkHealth().catch(() => ({ ok: false }));
  const backendOk = !!health.ok;

  try {
    const [jr, ir, sr, tr] = await Promise.all([
      listJobs({ limit: 20 }),
      listIssues({ limit: 50 }),
      listQualitySnapshots({ limit: 20 }),
      getQualityTrend({ days: 30 }),
    ]);

    const anyApi =
      !jr.unavailable || !ir.unavailable || !sr.unavailable || !tr.unavailable;

    if (!anyApi && !backendOk) {
      return demoPayload('后端未连接，显示演示数据');
    }

    const jobs = asList(jr.data).map(normalizeJob).filter(Boolean);
    const issues = asList(ir.data).map(normalizeIssue).filter(Boolean);
    const snapshots = asList(sr.data).map(normalizeSnapshot).filter(Boolean);
    let trend = asList(tr.data).map(normalizeTrendPoint).filter((p) => p && p.day);

    const latestSnap = snapshots[0];
    const latestJob = jobs[0];
    let dims = latestSnap?.dims || null;
    if (dims && Object.values(dims).every((v) => v == null)) dims = null;
    if (!dims && latestSnap?.raw) dims = dimsFromQuality(latestSnap.raw);
    if (!dims) dims = { ...SEED_DIMS };

    for (const k of Object.keys(SEED_DIMS)) {
      if (dims[k] == null) dims[k] = SEED_DIMS[k];
    }

    const score =
      latestSnap?.overallScore ??
      latestJob?.score ??
      averageDims(dims);

    if (!trend.length) trend = buildTrend();

    const br = await listBaselines().catch(() => ({ unavailable: true, data: null }));
    const ar = await listAlertRules().catch(() => ({ unavailable: true, data: null }));
    const baselines = br.unavailable
      ? SEED_BASELINES
      : asList(br.data).map((b) => ({
          id: b.id || b.Id || b.sourceName,
          name: b.name || b.Name || b.sourceName || '基线',
          score: Number(b.minOverall ?? b.score ?? b.Score ?? 0),
          jobId: b.jobId || b.JobId,
        }));
    const alerts = ar.unavailable
      ? SEED_ALERTS
      : asList(ar.data).map((a) => ({
          id: a.id || a.Id,
          name: a.name || a.Name,
          condition: a.condition || a.Condition || a.expression,
          enabled: a.enabled ?? a.Enabled ?? true,
          lastFired: a.lastFired || a.LastFired,
        }));

    return {
      source: anyApi || backendOk ? 'api' : 'demo',
      backendOk,
      jobs: jobs.length ? jobs : SEED_JOBS,
      issues: issues.length ? issues : (anyApi ? [] : SEED_ISSUES),
      dims,
      score,
      trend,
      snapshots,
      baselines,
      alerts,
      fields: SEED_FIELDS,
    };
  } catch (e) {
    return { ...demoPayload(e.message), backendOk };
  }
}

function averageDims(dims) {
  const vals = Object.values(dims).filter((v) => v != null);
  if (!vals.length) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}

function demoPayload(error) {
  return {
    source: 'demo',
    backendOk: false,
    jobs: SEED_JOBS,
    issues: SEED_ISSUES,
    dims: SEED_DIMS,
    score: SEED_JOBS[0]?.score ?? 87.4,
    trend: buildTrend(),
    snapshots: [],
    baselines: SEED_BASELINES,
    alerts: SEED_ALERTS,
    fields: SEED_FIELDS,
    error,
  };
}
