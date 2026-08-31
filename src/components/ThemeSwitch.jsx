import { THEME_MODES, useTheme } from '../theme.js';

// 24×24、stroke 用 currentColor，颜色由 .theme-opt 的文字色决定
const ICONS = {
  system: (
    <>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </>
  ),
  light: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 1.8v2M12 20.2v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M1.8 12h2M20.2 12h2M4.6 19.4L6 18M18 6l1.4-1.4" />
    </>
  ),
  dark: (
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  ),
};

/**
 * 三档主题切换：跟随系统 / 浅色 / 深色。
 * 选择存 localStorage，跟随系统时还会监听系统偏好变化。
 */
export default function ThemeSwitch() {
  const { mode, setMode, theme } = useTheme();

  return (
    <div className="theme-switch" role="group" aria-label="主题">
      {THEME_MODES.map((m) => (
        <button
          key={m.key}
          type="button"
          className={`theme-opt ${mode === m.key ? 'active' : ''}`}
          aria-pressed={mode === m.key}
          title={m.key === 'system' ? `跟随系统（当前${theme === 'dark' ? '深色' : '浅色'}）` : m.label}
          onClick={() => setMode(m.key)}
        >
          <svg
            viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
          >
            {ICONS[m.key]}
          </svg>
          <span>{m.label}</span>
        </button>
      ))}
    </div>
  );
}
