import { useSyncExternalStore } from 'react';
import { createThemeController } from './lib/theme-controller.js';

let storage;
try { storage = typeof localStorage !== 'undefined' ? localStorage : undefined; } catch { /* private mode */ }
const browser = typeof window === 'undefined' ? undefined : window;
const controller = createThemeController({
  storage, document: typeof document === 'undefined' ? undefined : document,
  matchMedia: browser?.matchMedia?.bind(browser),
  addEventListener: browser?.addEventListener?.bind(browser), removeEventListener: browser?.removeEventListener?.bind(browser),
});
export const THEME_MODES = [
  { key: 'system', labelKey: 'themeSystem' }, { key: 'light', labelKey: 'themeLight' },
  { key: 'dark', labelKey: 'themeDark' }, { key: 'eyecare', labelKey: 'themeEyecare' },
];
export const getMode = () => controller.getSnapshot().mode;
export const resolveTheme = controller.resolve;
export const applyTheme = controller.apply;
export const persistMode = controller.setMode;
export function useTheme() {
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  return { ...snapshot, setMode: controller.setMode };
}

export const CHART_COLORS = {
  dark: {
    grid: 'rgba(255,255,255,0.06)',
    axis: 'rgba(255,255,255,0.10)',
    cursor: 'rgba(99,102,241,0.08)',
    barFrom: '#22d3ee',
    barTo: '#6366f1',
    fallback: '#64748b',
    types: {
      String: '#6366f1', Number: '#34d399', Boolean: '#fbbf24',
      Null: '#64748b', Array: '#a78bfa', Object: '#f472b6',
    },
  },
  light: {
    grid: 'rgba(15,23,42,0.08)',
    axis: 'rgba(15,23,42,0.14)',
    cursor: 'rgba(79,70,229,0.08)',
    barFrom: '#0891b2',
    barTo: '#4f46e5',
    fallback: '#94a3b8',
    types: {
      String: '#4f46e5', Number: '#059669', Boolean: '#d97706',
      Null: '#64748b', Array: '#7c3aed', Object: '#db2777',
    },
  },
  eyecare: {
    grid: 'rgba(60,70,50,0.12)',
    axis: 'rgba(60,70,50,0.18)',
    cursor: 'rgba(90,120,70,0.12)',
    barFrom: '#5a8f6a',
    barTo: '#6b8f5a',
    fallback: '#8a9080',
    types: {
      String: '#5a7a9a', Number: '#5a8f6a', Boolean: '#b08a40',
      Null: '#8a9080', Array: '#7a6a9a', Object: '#9a6a7a',
    },
  },
};

export const chartColors = (theme) => CHART_COLORS[theme] || CHART_COLORS.dark;
