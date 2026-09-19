import { create } from 'zustand';
import {
  SEED_ALERTS,
  SEED_BASELINES,
  SEED_DIMS,
  SEED_FIELDS,
  SEED_ISSUES,
  SEED_JOBS,
  SEED_RECS,
  buildTrend,
} from './mock-data.js';

export const usePlatform = create((set) => ({
  jobs: SEED_JOBS,
  issues: SEED_ISSUES,
  fields: SEED_FIELDS,
  dims: SEED_DIMS,
  trend: buildTrend(),
  baselines: SEED_BASELINES,
  alerts: SEED_ALERTS,
  recommendations: SEED_RECS,
  theme: 'dark',
  toggleAlert: (id) =>
    set((s) => ({
      alerts: s.alerts.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)),
    })),
  setTheme: (t) => {
    set({ theme: t });
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('light', t === 'light');
      try {
        localStorage.setItem('oa-theme', t);
      } catch {
        /* ignore */
      }
    }
  },
}));

export function hydrateTheme() {
  try {
    const t = localStorage.getItem('oa-theme');
    if (t === 'light' || t === 'dark') usePlatform.getState().setTheme(t);
  } catch {
    /* ignore */
  }
}
