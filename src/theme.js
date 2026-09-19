// 主题：跟随系统 / 浅色 / 深色 / 护眼
// data-theme: light | dark | eyecare

import { useCallback, useEffect, useState } from 'react';

const MODE_KEY = 'themeMode';
const CHANGE_EVENT = 'oa-theme-change';

export const THEME_MODES = [
  { key: 'system', labelKey: 'themeSystem' },
  { key: 'light', labelKey: 'themeLight' },
  { key: 'dark', labelKey: 'themeDark' },
  { key: 'eyecare', labelKey: 'themeEyecare' },
];

const hasDom = typeof window !== 'undefined' && typeof document !== 'undefined';

const darkQuery = hasDom && window.matchMedia
  ? window.matchMedia('(prefers-color-scheme: dark)')
  : null;

export function getMode() {
  if (!hasDom) return 'system';
  try {
    const saved = localStorage.getItem(MODE_KEY);
    return THEME_MODES.some((m) => m.key === saved) ? saved : 'system';
  } catch {
    return 'system';
  }
}

export function resolveTheme(mode) {
  if (mode === 'light' || mode === 'dark' || mode === 'eyecare') return mode;
  return darkQuery && !darkQuery.matches ? 'light' : 'dark';
}

export function applyTheme(mode = getMode()) {
  const theme = resolveTheme(mode);
  if (!hasDom) return theme;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme =
    theme === 'dark' ? 'dark' : 'light';
  document.documentElement.classList.toggle('light', theme === 'light');
  document.documentElement.classList.toggle('eyecare', theme === 'eyecare');
  document.documentElement.classList.toggle('dark', theme === 'dark');
  return theme;
}

export function persistMode(mode) {
  const next = THEME_MODES.some((m) => m.key === mode) ? mode : 'system';
  try {
    localStorage.setItem(MODE_KEY, next);
    localStorage.setItem('oa-theme', next === 'system' ? resolveTheme(next) : next);
  } catch {
    /* ignore */
  }
  return applyTheme(next);
}

export function useTheme() {
  const [mode, setModeState] = useState(getMode);
  const [theme, setTheme] = useState(() => resolveTheme(getMode()));

  useEffect(() => {
    setModeState(getMode());
    setTheme(applyTheme());
  }, []);

  useEffect(() => {
    const sync = () => {
      setModeState(getMode());
      setTheme(applyTheme());
    };
    const onSystem = () => {
      if (getMode() === 'system') sync();
    };

    if (darkQuery) {
      if (darkQuery.addEventListener) darkQuery.addEventListener('change', onSystem);
      else darkQuery.addListener(onSystem);
    }
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener('storage', sync);

    return () => {
      if (darkQuery) {
        if (darkQuery.removeEventListener) darkQuery.removeEventListener('change', onSystem);
        else darkQuery.removeListener(onSystem);
      }
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const setMode = useCallback((next) => {
    setModeState(next);
    setTheme(persistMode(next));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { mode, setMode, theme };
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
