export const DIM_LABEL = {
  completeness: '完整',
  validity: '有效',
  uniqueness: '唯一',
  consistency: '一致',
  anomaly: '异常',
};

export const SEVERITY_LABEL = {
  critical: '紧急',
  high: '高',
  medium: '中',
  low: '低',
};

export const SEED_DIMS = {
  completeness: 90,
  validity: 88,
  uniqueness: 91,
  consistency: 82,
  anomaly: 86,
};

export const SEED_JOBS = [
  { id: 'job_8f2a', sourceName: 'orders_aug.json', status: 'done', rows: 25, fields: 8, score: 87.4, issueCount: 8, elapsedMs: 412, bytes: 18420, format: 'json', createdAt: '2026-09-18T10:12:00Z' },
  { id: 'job_3c91', sourceName: 'customers.csv', status: 'done', rows: 1204, fields: 14, score: 91.2, issueCount: 3, elapsedMs: 1880, bytes: 240112, format: 'csv', createdAt: '2026-09-17T16:40:00Z' },
  { id: 'job_aa10', sourceName: 'events.jsonl', status: 'done', rows: 8400, fields: 11, score: 79.8, issueCount: 21, elapsedMs: 6400, bytes: 1900221, format: 'jsonl', createdAt: '2026-09-16T09:04:00Z' },
];

export const SEED_ISSUES = [
  { id: 'iss_1', title: 'order_id 出现重复键', field: 'order_id', dimension: 'uniqueness', severity: 'critical', count: 2, detail: 'ORD-1001 出现两次，主键约束会被下游打穿。', jobId: 'job_8f2a', createdAt: '2026-09-18T10:12:00Z' },
  { id: 'iss_2', title: 'email 格式不合法', field: 'email', dimension: 'validity', severity: 'high', count: 3, detail: '存在 not-an-email、ivy@、空值等无法投递的地址。', jobId: 'job_8f2a', createdAt: '2026-09-18T10:12:00Z' },
  { id: 'iss_3', title: 'country 编码混用', field: 'country', dimension: 'consistency', severity: 'high', count: 4, detail: '同时出现 US / USA / us 以及 JP / JPN。', jobId: 'job_8f2a', createdAt: '2026-09-18T10:12:00Z' },
  { id: 'iss_4', title: 'amount 出现负值', field: 'amount', dimension: 'anomaly', severity: 'medium', count: 1, detail: '退款应走 status，而不是把成交额写成负数。', jobId: 'job_8f2a', createdAt: '2026-09-18T10:12:00Z' },
  { id: 'iss_5', title: 'created_at 缺失', field: 'created_at', dimension: 'completeness', severity: 'medium', count: 1, detail: '时间序列与新鲜度监控无法覆盖空时间戳行。', jobId: 'job_8f2a', createdAt: '2026-09-18T10:12:00Z' },
  { id: 'iss_6', title: 'coupon 空串与 null 混用', field: 'coupon', dimension: 'consistency', severity: 'low', count: 2, detail: '空字符串与 null 在聚合时会被当成两类缺失。', jobId: 'job_8f2a', createdAt: '2026-09-18T10:12:00Z' },
  { id: 'iss_7', title: 'phone 覆盖率偏低', field: 'phone', dimension: 'completeness', severity: 'medium', count: 418, detail: 'customers.csv 中 34% 行缺少电话。', jobId: 'job_3c91', createdAt: '2026-09-17T16:40:00Z' },
  { id: 'iss_8', title: 'event_ts 时钟回拨', field: 'event_ts', dimension: 'anomaly', severity: 'high', count: 17, detail: 'events.jsonl 出现早于前序批次的时间戳。', jobId: 'job_aa10', createdAt: '2026-09-16T09:04:00Z' },
];

export const SEED_FIELDS = [
  { name: 'order_id', primaryType: 'string', coverage: 1, distinct: 24, uniqueness: 0.96, validity: 1 },
  { name: 'email', primaryType: 'string', coverage: 0.96, distinct: 12, uniqueness: 0.5, validity: 0.88 },
  { name: 'country', primaryType: 'string', coverage: 1, distinct: 9, uniqueness: 0.36, validity: 0.84 },
  { name: 'amount', primaryType: 'number', coverage: 1, distinct: 22, uniqueness: 0.88, validity: 0.96 },
  { name: 'status', primaryType: 'string', coverage: 1, distinct: 4, uniqueness: 0.16, validity: 1 },
  { name: 'created_at', primaryType: 'datetime', coverage: 0.96, distinct: 24, uniqueness: 0.96, validity: 0.96 },
  { name: 'coupon', primaryType: 'string', coverage: 0.28, distinct: 4, uniqueness: 0.57, validity: 0.92 },
];

export function buildTrend() {
  const out = [];
  const start = new Date('2026-08-20T00:00:00Z');
  for (let i = 0; i < 30; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    const wobble = Math.sin(i / 4) * 2.2;
    out.push({ day: d.toISOString().slice(0, 10), score: Math.min(96, 84 + i * 0.12 + wobble) });
  }
  return out;
}

export const SEED_BASELINES = [
  { id: 'bl_prod', name: '生产基线 · 9 月', score: 87.4, jobId: 'job_8f2a' },
  { id: 'bl_aug', name: '8 月冻结', score: 84.1, jobId: 'job_aa10' },
];

export const SEED_ALERTS = [
  { id: 'al_1', name: '综合分 < 85', condition: 'overall_score < 85', enabled: true, lastFired: '2026-09-16T09:10:00Z' },
  { id: 'al_2', name: '紧急问题 > 0', condition: 'critical_issues > 0', enabled: true, lastFired: '2026-09-18T10:12:00Z' },
  { id: 'al_3', name: '完整率日降 > 3%', condition: 'delta(completeness) < -0.03', enabled: false },
  { id: 'al_4', name: '主键重复', condition: 'duplicate_key_count > 0', enabled: true, lastFired: '2026-09-18T10:12:00Z' },
];

export const SEED_RECS = [
  { id: 'r1', title: '为 order_id 建立唯一约束并清洗重复行', why: '重复主键会让下游订单事实表膨胀。', impact: 'high', effort: 'S' },
  { id: 'r2', title: '把 country 规范化为 ISO-3166 alpha-2', why: 'US / USA / us 导致国家维度裂变。', impact: 'high', effort: 'M' },
  { id: 'r3', title: '校验 email 并隔离无效地址', why: '投递失败会污染触达指标。', impact: 'medium', effort: 'S' },
  { id: 'r4', title: 'coupon 空值统一为 null', why: '空串与 null 混用会让优惠券覆盖率失真。', impact: 'low', effort: 'S' },
];

export const SEED_SCHEMA = [
  { id: 'sc1', field: 'coupon', change: 'added', to: 'string', impact: '营销漏斗新增维度，3 张下游表需补列。' },
  { id: 'sc2', field: 'amount', change: 'type', from: 'integer', to: 'number', impact: '小数金额进入，聚合 SQL 需改精度。' },
  { id: 'sc3', field: 'legacy_sku', change: 'removed', from: 'string', impact: '库存报表仍引用该列，将空跑。' },
];

export const LINEAGE_NODES = [
  { id: 'src_orders', label: 'orders_aug.json', kind: 'source' },
  { id: 'src_cust', label: 'customers.csv', kind: 'source' },
  { id: 'job_a', label: '分析 job_8f2a', kind: 'job' },
  { id: 'snap', label: '质量快照', kind: 'snapshot' },
  { id: 'dash', label: '质量总览', kind: 'asset' },
  { id: 'bi', label: '营收看板', kind: 'asset' },
];
