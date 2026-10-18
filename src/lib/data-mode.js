import { DIM_LABEL, SEED_ALERTS, SEED_BASELINES, SEED_DIMS, SEED_FIELDS, SEED_ISSUES, SEED_JOBS, SEED_RECS, buildTrend } from './mock-data.js';

// 演示数据仅由显式构建配置启用，不根据接口失败或空数组推断。
export const DEMO_MODE = import.meta.env?.VITE_DEMO_MODE === 'true';

export function initialPlatformData(demo = DEMO_MODE) {
  return {
    source: demo ? 'demo' : 'api',
    jobs: demo ? SEED_JOBS : [], issues: demo ? SEED_ISSUES : [], fields: demo ? SEED_FIELDS : [],
    dims: demo ? { ...SEED_DIMS } : Object.fromEntries(Object.keys(DIM_LABEL).map((k) => [k, null])),
    trend: demo ? buildTrend() : [], baselines: demo ? SEED_BASELINES : [], alerts: demo ? SEED_ALERTS : [],
    recommendations: demo ? SEED_RECS : [], score: demo ? SEED_JOBS[0]?.score ?? null : null,
    snapshots: [], modules: {},
  };
}
