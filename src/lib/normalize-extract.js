/** Response shape extractors for platform APIs */
import {
  asList,
  pick,
  normalizeField,
  normalizeIssue,
  normalizeJob,
  normalizeSnapshot,
} from './normalize.js';

function num(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function extractFieldsFromResponse(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data.map(normalizeField).filter(Boolean);
  const list =
    data.fields ||
    data.Fields ||
    data.normalizedFields ||
    data.NormalizedFields ||
    data.fieldStatistics ||
    data.FieldStatistics ||
    [];
  return asList(list).map(normalizeField).filter(Boolean);
}

export function extractIssuesFromResponse(data) {
  if (!data) return { jobs: [], issues: [], selectedJob: null };
  if (Array.isArray(data)) {
    return { jobs: [], issues: data.map(normalizeIssue).filter(Boolean), selectedJob: null };
  }
  return {
    jobs: asList(data.jobs || data.Jobs).map(normalizeJob).filter(Boolean),
    issues: asList(data.issues || data.Issues || data.selectedIssues).map(normalizeIssue).filter(Boolean),
    selectedJob: normalizeJob(data.selectedJob || data.SelectedJob),
  };
}

export function extractDashboard(data) {
  if (!data) return null;
  const metrics = data.metrics || data.Metrics || null;
  const job = normalizeJob(data.job || data.Job);
  const topIssues = asList(data.topIssues || data.TopIssues).map(normalizeIssue).filter(Boolean);
  const snapshots = asList(data.recentSnapshots || data.RecentSnapshots || data.snapshots).map(normalizeSnapshot).filter(Boolean);
  const dims = metrics
    ? {
        completeness: num(metrics.completeness ?? metrics.Completeness),
        validity: num(metrics.validity ?? metrics.Validity),
        uniqueness: num(metrics.uniqueness ?? metrics.Uniqueness),
        consistency: num(metrics.consistency ?? metrics.Consistency),
        anomaly: num(metrics.anomaly ?? metrics.Anomaly ?? metrics.anomalyControl),
      }
    : snapshots[0]?.dims || null;
  const score =
    num(metrics?.overallScore ?? metrics?.OverallScore ?? metrics?.score) ??
    snapshots[0]?.overallScore ??
    job?.score;
  return { job, metrics, dims, score, topIssues, snapshots, raw: data };
}

export function normalizeRecommendation(r) {
  if (!r) return null;
  return {
    field: pick(r, 'field', 'Field', 'fieldName') || '—',
    check: pick(r, 'check', 'Check') || '—',
    count: pick(r, 'count', 'Count') ?? 0,
    message: pick(r, 'message', 'Message') || '',
    action: pick(r, 'action', 'Action') || '',
    rule: pick(r, 'rule', 'Rule') || '',
    priority: pick(r, 'priority', 'Priority') ?? 1,
    priorityText: pick(r, 'priorityText', 'PriorityText') || '',
    raw: r,
  };
}

export function extractRecommendations(data) {
  if (!data) return { job: null, items: [] };
  if (Array.isArray(data)) return { job: null, items: data.map(normalizeRecommendation).filter(Boolean) };
  const items = asList(data.recommendations || data.Recommendations || data.items).map(normalizeRecommendation).filter(Boolean);
  return { job: normalizeJob(data.job || data.Job), items };
}
