/** 把后端多种形态的响应规整成前端统一结构 */

export function asList(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.jobs)) return data.jobs;
  if (Array.isArray(data.snapshots)) return data.snapshots;
  if (Array.isArray(data.issues)) return data.issues;
  if (Array.isArray(data.fields)) return data.fields;
  if (Array.isArray(data.rules)) return data.rules;
  if (Array.isArray(data.baselines)) return data.baselines;
  return [];
}

export function pick(obj, ...keys) {
  if (!obj) return undefined;
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return undefined;
}

export function normalizeJob(j) {
  if (!j) return null;
  return {
    id: String(pick(j, 'id', 'Id', 'jobId', 'JobId') ?? ''),
    sourceName: pick(j, 'sourceName', 'SourceName', 'fileName', 'FileName') || '—',
    status: String(pick(j, 'status', 'Status') || 'unknown').toLowerCase(),
    rows: pick(j, 'totalObjects', 'TotalObjects', 'rows', 'Rows', 'recordCount') ?? null,
    fields: pick(j, 'fieldCount', 'FieldCount', 'fields') ?? null,
    score: num(pick(j, 'qualityScore', 'QualityScore', 'overallScore', 'OverallScore', 'score')),
    issueCount: pick(j, 'issueCount', 'IssueCount') ?? null,
    elapsedMs: pick(j, 'elapsedMs', 'ElapsedMs', 'durationMs') ?? null,
    bytes: pick(j, 'bytes', 'Bytes', 'size') ?? null,
    format: pick(j, 'format', 'Format') ?? null,
    createdAt: pick(j, 'createdAt', 'CreatedAt', 'startedAt', 'StartedAt') ?? null,
    raw: j,
  };
}

export function normalizeIssue(it) {
  if (!it) return null;
  const severity = String(
    pick(it, 'severity', 'Severity', 'level', 'Level') || 'medium',
  ).toLowerCase();
  return {
    id: String(pick(it, 'id', 'Id') ?? `${pick(it, 'field', 'Field')}-${pick(it, 'check', 'Check')}`),
    title: pick(it, 'title', 'Title', 'message', 'Message', 'check', 'Check') || '质量问题',
    field: pick(it, 'field', 'Field', 'fieldName', 'FieldName') || '（数据集）',
    dimension: mapDimension(pick(it, 'dimension', 'Dimension', 'check', 'Check')),
    severity: normalizeSeverity(severity),
    count: pick(it, 'count', 'Count') ?? 1,
    detail: pick(it, 'detail', 'Detail', 'message', 'Message', 'description') || '',
    jobId: pick(it, 'jobId', 'JobId') ?? null,
    check: pick(it, 'check', 'Check') ?? null,
    createdAt: pick(it, 'createdAt', 'CreatedAt') ?? null,
    raw: it,
  };
}

export function normalizeSnapshot(s) {
  if (!s) return null;
  const dims = {
    completeness: num(pick(s, 'completeness', 'Completeness')),
    validity: num(pick(s, 'validity', 'Validity')),
    uniqueness: num(pick(s, 'uniqueness', 'Uniqueness')),
    consistency: num(pick(s, 'consistency', 'Consistency')),
    anomaly: num(pick(s, 'anomaly', 'Anomaly', 'anomalyControl', 'AnomalyControl')),
  };
  return {
    jobId: pick(s, 'jobId', 'JobId', 'id', 'Id'),
    sourceName: pick(s, 'sourceName', 'SourceName') || '—',
    overallScore: num(pick(s, 'overallScore', 'OverallScore', 'qualityScore', 'QualityScore', 'score')),
    dims,
    createdAt: pick(s, 'createdAt', 'CreatedAt') ?? null,
    raw: s,
  };
}

export function normalizeField(f) {
  if (!f) return null;
  const coverage = ratio(pick(f, 'coverage', 'Coverage'));
  const nullRate = ratio(pick(f, 'nullRate', 'NullRate'));
  return {
    name: pick(f, 'fieldName', 'FieldName', 'field', 'Field', 'name') || '—',
    primaryType: pick(f, 'primaryType', 'PrimaryType', 'type') || 'unknown',
    coverage: coverage ?? (nullRate != null ? 1 - nullRate : null),
    nullRate,
    distinct: pick(f, 'distinctCount', 'DistinctCount', 'distinct') ?? null,
    uniqueness: ratio(pick(f, 'uniqueness', 'Uniqueness')),
    validity: ratio(pick(f, 'validity', 'Validity')),
    outlierCount: pick(f, 'outlierCount', 'OutlierCount') ?? null,
    raw: f,
  };
}

export function normalizeTrendPoint(p) {
  if (!p) return null;
  return {
    day: pick(p, 'day', 'date', 'Date', 'timestamp', 'Timestamp') || '',
    score: num(pick(p, 'score', 'Score', 'overallScore', 'OverallScore')),
  };
}

function num(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function ratio(v) {
  const n = num(v);
  if (n == null) return null;
  return n > 1 ? n / 100 : n;
}

function normalizeSeverity(s) {
  if (['critical', 'error', '紧急'].includes(s)) return 'critical';
  if (['high', '高'].includes(s)) return 'high';
  if (['low', 'info', '低'].includes(s)) return 'low';
  return 'medium';
}

function mapDimension(check) {
  if (!check) return 'validity';
  const c = String(check).toLowerCase();
  if (/complet|null|missing|空|缺失/.test(c)) return 'completeness';
  if (/unique|duplicate|重复|唯一/.test(c)) return 'uniqueness';
  if (/consist|format|编码|一致/.test(c)) return 'consistency';
  if (/anomal|outlier|异常/.test(c)) return 'anomaly';
  if (/valid|type|pattern|有效/.test(c)) return 'validity';
  return 'validity';
}

export function dimsFromQuality(q) {
  if (!q) return null;
  const d = {
    completeness: scale100(pick(q, 'completeness', 'Completeness')),
    validity: scale100(pick(q, 'validity', 'Validity')),
    uniqueness: scale100(pick(q, 'uniqueness', 'Uniqueness')),
    consistency: scale100(pick(q, 'consistency', 'Consistency')),
    anomaly: scale100(pick(q, 'anomaly', 'Anomaly', 'anomalyControl', 'AnomalyControl')),
  };
  if (Object.values(d).every((x) => x == null)) return null;
  return d;
}

function scale100(v) {
  const n = num(v);
  if (n == null) return null;
  return n <= 1 ? Math.round(n * 1000) / 10 : n;
}
