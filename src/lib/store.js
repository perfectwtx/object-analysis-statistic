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
  locale: 'zh',

  toggleAlert: (id) =>
    set((s) => ({
      alerts: s.alerts.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)),
    })),

  setLocale: (locale) => {
    const next = locale === 'en' ? 'en' : 'zh';
    set({ locale: next });
    if (typeof document !== 'undefined') {
      document.documentElement.lang = next === 'en' ? 'en' : 'zh-CN';
      try {
        localStorage.setItem('oa-locale', next);
      } catch {
        /* ignore */
      }
    }
  },

  setTheme: (mode) => {
    const allowed = ['light', 'dark', 'eyecare', 'system'];
    const next = allowed.includes(mode) ? mode : 'dark';
    let resolved = next;
    if (next === 'system' && typeof window !== 'undefined' && window.matchMedia) {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    set({ theme: resolved === 'system' ? 'dark' : resolved });
    if (typeof document !== 'undefined') {
      const theme = resolved === 'system' ? 'dark' : resolved;
      document.documentElement.dataset.theme = theme;
      document.documentElement.classList.toggle('light', theme === 'light');
      document.documentElement.classList.toggle('eyecare', theme === 'eyecare');
      document.documentElement.classList.toggle('dark', theme === 'dark');
      document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
      try {
        localStorage.setItem('oa-theme', theme);
        localStorage.setItem('themeMode', next);
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
    const t = localStorage.getItem('themeMode') || localStorage.getItem('oa-theme');
    if (t === 'light' || t === 'dark' || t === 'eyecare' || t === 'system') {
      usePlatform.getState().setTheme(t);
    }
  } catch {
    /* ignore */
  }
}

export function hydrateLocale() {
  try {
    const loc = localStorage.getItem('oa-locale');
    if (loc === 'en' || loc === 'zh') usePlatform.getState().setLocale(loc);
  } catch {
    /* ignore */
  }
}
