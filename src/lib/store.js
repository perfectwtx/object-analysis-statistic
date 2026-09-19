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
import { loadPlatformOverview } from './load-platform.js';

export const usePlatform = create((set, get) => ({
  jobs: SEED_JOBS,
  issues: SEED_ISSUES,
  fields: SEED_FIELDS,
  dims: SEED_DIMS,
  trend: buildTrend(),
  baselines: SEED_BASELINES,
  alerts: SEED_ALERTS,
  recommendations: SEED_RECS,
  score: SEED_JOBS[0]?.score ?? 87.4,
  source: 'demo',
  backendOk: false,
  loading: false,
  error: null,
  lastLoadedAt: null,
  theme: 'dark',

  toggleAlert: (id) =>
    set((s) => ({
      alerts: s.alerts.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)),
    })),

  setTheme: (t) => {
    set({ theme: t });
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('light', t === 'light');
      document.documentElement.dataset.theme = t;
      try {
        localStorage.setItem('oa-theme', t);
        localStorage.setItem('themeMode', t);
      } catch {
        /* ignore */
      }
    }
  },

  refresh: async () => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const data = await loadPlatformOverview();
      set({
        jobs: data.jobs,
        issues: data.issues,
        dims: data.dims,
        trend: data.trend,
        baselines: data.baselines,
        alerts: data.alerts,
        fields: data.fields || SEED_FIELDS,
        score: data.score,
        source: data.source,
        backendOk: data.backendOk,
        error: data.error || null,
        lastLoadedAt: Date.now(),
        loading: false,
      });
    } catch (e) {
      set({ loading: false, error: e.message });
    }
  },
}));

export function hydrateTheme() {
  try {
    const t = localStorage.getItem('oa-theme') || localStorage.getItem('themeMode');
    if (t === 'light' || t === 'dark') usePlatform.getState().setTheme(t);
  } catch {
    /* ignore */
  }
}
