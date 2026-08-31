// 主题：跟随系统 / 浅色 / 深色
//
// 设计要点：
// 1. 存的是「模式」（system / light / dark），不是解析后的明暗。跟随系统时系统偏好一变就要能跟着变。
// 2. 解析后的结果写到 <html data-theme="light|dark">，CSS 只认这两个值，不写 prefers-color-scheme
//    媒体查询 —— 否则「手动选深色但系统是浅色」时两套规则会打架。
// 3. index.html 里有一段同步内联脚本，在任何 CSS/JS 执行前就把 data-theme 设好，避免首屏闪一下白/黑。
// 4. 同时设置 color-scheme，让浏览器原生控件（滚动条、下拉框、日期选择）跟着走。
//
// 色值只在这里（图表）和 styles.css 的 CSS 变量里各存一份，改配色时两处都要动。

import { useCallback, useEffect, useState } from 'react';

const MODE_KEY = 'themeMode';
const CHANGE_EVENT = 'oa-theme-change';

export const THEME_MODES = [
  { key: 'system', label: '跟随系统' },
  { key: 'light', label: '浅色' },
  { key: 'dark', label: '深色' },
];

const hasDom = typeof window !== 'undefined' && typeof document !== 'undefined';

const darkQuery = hasDom && window.matchMedia
  ? window.matchMedia('(prefers-color-scheme: dark)')
  : null;

/** 读取持久化的模式；无效值（含空）一律当 system。 */
export function getMode() {
  if (!hasDom) return 'system';
  try {
    const saved = localStorage.getItem(MODE_KEY);
    return THEME_MODES.some((m) => m.key === saved) ? saved : 'system';
  } catch {
    return 'system'; // 隐私模式下 localStorage 可能直接抛
  }
}

/** 模式 → 明暗。没有 matchMedia（老浏览器 / SSR）时退回深色，与改造前的行为一致。 */
export function resolveTheme(mode) {
  if (mode === 'light' || mode === 'dark') return mode;
  return darkQuery && !darkQuery.matches ? 'light' : 'dark';
}

/** 把解析结果写到 <html> 上。返回实际生效的明暗。 */
export function applyTheme(mode = getMode()) {
  const theme = resolveTheme(mode);
  if (!hasDom) return theme;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  return theme;
}

/** 持久化模式并立即生效。 */
export function persistMode(mode) {
  const next = THEME_MODES.some((m) => m.key === mode) ? mode : 'system';
  try {
    localStorage.setItem(MODE_KEY, next);
  } catch {
    /* 存不进去也要能切换 */
  }
  return applyTheme(next);
}

/**
 * 订阅主题。多个组件各自调用也能保持一致：
 * 同页靠自定义事件，跨标签页靠 storage 事件，系统偏好变化由 matchMedia 通知。
 */
export function useTheme() {
  const [mode, setModeState] = useState(getMode);
  const [theme, setTheme] = useState(() => resolveTheme(getMode()));

  // 首挂载时兜一次：内联脚本已经设过，这里主要防 SSR / HMR 后状态漂移
  useEffect(() => {
    setModeState(getMode());
    setTheme(applyTheme());
  }, []);

  useEffect(() => {
    const sync = () => {
      setModeState(getMode());
      setTheme(applyTheme());
    };
    // 只在「跟随系统」时响应系统偏好变化，否则会把用户手动选的覆盖掉
    const onSystem = () => { if (getMode() === 'system') sync(); };

    // Safari < 14 只有 addListener
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

// ───────────────────────── 图表配色 ─────────────────────────
// recharts 的 stroke / fill / stopColor 是 SVG 呈现属性，不能写 var(--x)
// （呈现属性不解析 CSS 变量），所以图表颜色只能在 JS 里按主题取值。
// 与 styles.css 的 --accent / --accent2 / --grid / --track 保持一致。

export const CHART_COLORS = {
  dark: {
    grid: 'rgba(255,255,255,0.06)',
    axis: 'rgba(255,255,255,0.10)',
    cursor: 'rgba(99,102,241,0.08)',
    barFrom: '#22d3ee',
    barTo: '#6366f1',
    fallback: '#64748b', // 类型表里没有的类型
    types: {
      String: '#6366f1',
      Number: '#34d399',
      Boolean: '#fbbf24',
      Null: '#64748b',
      Array: '#a78bfa',
      Object: '#f472b6',
    },
  },
  light: {
    grid: 'rgba(15,23,42,0.08)',
    axis: 'rgba(15,23,42,0.14)',
    cursor: 'rgba(79,70,229,0.08)',
    // 浅底上要压暗一档，否则 indigo-500 / cyan-400 在白底几乎看不见
    barFrom: '#0891b2',
    barTo: '#4f46e5',
    fallback: '#94a3b8',
    types: {
      String: '#4f46e5',
      Number: '#059669',
      Boolean: '#d97706',
      Null: '#64748b',
      Array: '#7c3aed',
      Object: '#db2777',
    },
  },
};

export const chartColors = (theme) => CHART_COLORS[theme] || CHART_COLORS.dark;
