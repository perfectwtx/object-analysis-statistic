import { create } from 'zustand';
import { initialPlatformData } from './data-mode.js';
import { loadPlatformOverview } from './load-platform.js';
import { updateAlertRule } from '../api/platform.js';

export const usePlatform = create((set, get) => ({
  ...initialPlatformData(),
  backendOk: false,
  loading: false,
  error: null,
  lastLoadedAt: null,
  theme: 'dark',
  locale: 'zh',

  alertSaving: {},
  toggleAlert: async (id) => {
    const state = get();
    if (state.alertSaving[id]) return;
    const alert = state.alerts.find((a) => a.id === id);
    if (!alert) return;
    const enabled = !alert.enabled;
    if (state.source === 'demo') {
      set((s) => ({ alerts: s.alerts.map((a) => a.id === id ? { ...a, enabled } : a) }));
      return;
    }
    if (state.loading || state.modules.alerts?.source !== 'api') throw new Error('告警接口尚未就绪');
    set((s) => ({ alertSaving: { ...s.alertSaving, [id]: true } }));
    try {
      // 保留后端原始规则中的阈值、Webhook 等字段，兼容完整 PUT 契约。
      const body = { ...alert.raw, enabled };
      if ('Enabled' in body) body.Enabled = enabled;
      await updateAlertRule(id, body, { basePath: alert.updateBase || '/alert-rules' });
      set((s) => ({ alerts: s.alerts.map((a) => a.id === id ? { ...a, enabled, raw: body } : a) }));
    } finally {
      set((s) => {
        const alertSaving = { ...s.alertSaving };
        delete alertSaving[id];
        return { alertSaving };
      });
    }
  },

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

  /** 本地先去掉一条作业（删除 API 成功后调用），再可选 refresh */
  removeJobLocal: (jobId) => {
    const id = String(jobId || '');
    if (!id) return;
    set((s) => ({
      jobs: (s.jobs || []).filter((j) => String(j.id) !== id),
    }));
  },

  refresh: async () => {
    if (get().loading || Object.keys(get().alertSaving).length) return;
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
        fields: data.fields || [],
        modules: data.modules,
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
