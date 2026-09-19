import { Leaf, Monitor, Moon, Sun } from 'lucide-react';
import { THEME_MODES, useTheme } from '../theme.js';
import { usePlatform } from '../lib/store.js';
import { t } from '../lib/i18n.js';
import { cn } from '../lib/cn.js';

const ICONS = {
  system: Monitor,
  light: Sun,
  dark: Moon,
  eyecare: Leaf,
};

export default function ThemeSwitch({ compact = false }) {
  const { mode, setMode, theme } = useTheme();
  const locale = usePlatform((s) => s.locale);
  const setStoreTheme = usePlatform((s) => s.setTheme);

  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5 shadow-[var(--elev)]',
        compact && 'p-0.5',
      )}
      role="group"
      aria-label={t(locale, 'theme')}
    >
      {THEME_MODES.map((m) => {
        const Icon = ICONS[m.key] || Monitor;
        const active = mode === m.key;
        const label = t(locale, m.labelKey);
        return (
          <button
            key={m.key}
            type="button"
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs transition-colors',
              active
                ? 'bg-card text-foreground shadow-[var(--elev)]'
                : 'text-muted-foreground hover:text-foreground',
            )}
            aria-pressed={active}
            title={
              m.key === 'system'
                ? `${label} (${theme === 'dark' ? t(locale, 'themeDark') : t(locale, 'themeLight')})`
                : label
            }
            onClick={() => { setMode(m.key); setStoreTheme(m.key); }}
          >
            <Icon className="size-3.5 shrink-0" />
            {!compact ? <span className="hidden sm:inline">{label}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function LocaleSwitch() {
  const locale = usePlatform((s) => s.locale);
  const setLocale = usePlatform((s) => s.setLocale);

  return (
    <div
      className="inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5 shadow-[var(--elev)]"
      role="group"
      aria-label={t(locale, 'language')}
    >
      {[
        { key: 'zh', label: '中' },
        { key: 'en', label: 'EN' },
      ].map((m) => (
        <button
          key={m.key}
          type="button"
          className={cn(
            'rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
            locale === m.key
              ? 'bg-card text-foreground shadow-[var(--elev)]'
              : 'text-muted-foreground hover:text-foreground',
          )}
          aria-pressed={locale === m.key}
          onClick={() => setLocale(m.key)}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
