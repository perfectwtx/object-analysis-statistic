import { create } from 'zustand';
import { initialPlatformData } from './data-mode.js';
import { loadPlatformOverview } from './load-platform.js';
import { getBaseUrl } from '../api/client.js';
import { getCapabilities, updateAlertRule } from '../api/platform.js';

export const usePlatform = create((set, get) => ({
  ...initialPlatformData(),
  backendOk: false,
  loading: false,
  error: null,
  lastLoadedAt: null,
  locale: 'zh',

  capabilities: {}, capabilitiesError: null, backendBase: null,
  loadCapabilities: async () => {
    const base = getBaseUrl();
    try {
      const r = await getCapabilities();
      if (base === getBaseUrl()) set({ capabilities: r.data, capabilitiesError: null });
    } catch (e) { if (base === getBaseUrl()) set({ capabilities: {}, capabilitiesError: e.message }); }
  },
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

  /** 本地先去掉一条作业（删除 API 成功后调用），再可选 refresh */
  removeJobLocal: (jobId) => {
    const id = String(jobId || '');
    if (!id) return;
    set((s) => ({
      jobs: (s.jobs || []).filter((j) => String(j.id) !== id),
    }));
  },

  ensureLoaded: () => {
    if (get().backendBase === getBaseUrl() && get().lastLoadedAt && Date.now() - get().lastLoadedAt < 30000) return;
    return get().refresh();
  },
  refresh: async ({ module } = {}) => {
    if (get().loading || Object.keys(get().alertSaving).length) return;
    const base = getBaseUrl();
    set({ loading: true, error: null });
    void get().loadCapabilities();
    try {
      const data = await loadPlatformOverview({ previous: get().overview, only: module ? [module] : undefined });
      set({
        overview: data,
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

export function hydrateLocale() {
  try {
    const loc = localStorage.getItem('oa-locale');
    if (loc === 'en' || loc === 'zh') usePlatform.getState().setLocale(loc);
  } catch {
    /* ignore */
  }
}
