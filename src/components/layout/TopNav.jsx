import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, HelpCircle } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PRIMARY_NAV, SEARCH_TARGETS, activeSection } from '../../lib/nav.js';
import { usePlatform } from '../../lib/store.js';
import { t } from '../../lib/i18n.js';
import { cn } from '../../lib/cn.js';
import { BackendStatus } from '../BackendStatus.jsx';
import ThemeSwitch, { LocaleSwitch } from '../ThemeSwitch.jsx';
import { startProductTour } from '../tour/ProductTour.jsx';

export function TopNav() {
  const { pathname } = useLocation();
  const section = activeSection(pathname);
  const locale = usePlatform((s) => s.locale);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const navigate = useNavigate();

  const hits = useMemo(() => {
    const s = q.trim().toLowerCase();
    const mapped = SEARCH_TARGETS.map((item) => ({
      ...item,
      label: t(locale, item.labelKey),
      hint: t(locale, item.hintKey),
    }));
    if (!s) return mapped.slice(0, 6);
    return mapped
      .filter(
        (item) =>
          item.label.toLowerCase().includes(s) ||
          item.hint.toLowerCase().includes(s) ||
          item.to.includes(s),
      )
      .slice(0, 8);
  }, [q, locale]);

  useEffect(() => {
    const onDoc = (e) => {
      if (box.current && !box.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const tourAttr = (id) => {
    if (id === 'analyze') return 'nav-analyze';
    if (id === 'quality') return 'nav-quality';
    if (id === 'insights') return 'nav-insights';
    return undefined;
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link
          to="/"
          data-tour="logo"
          className="flex shrink-0 items-center gap-2.5 text-foreground no-underline"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4 19V5M4 19h16M7 15l3.5-5 2.8 2.4L18 7"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="hidden leading-tight sm:block">
            <span className="block text-sm font-medium">{t(locale, 'appName')}</span>
            <span className="block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Quality
            </span>
          </span>
        </Link>

        <nav className="flex min-w-0 flex-1 items-center overflow-x-auto">
          <div
            data-tour="primary-nav"
            className="mx-auto flex rounded-full bg-muted p-1 shadow-[var(--elev)]"
          >
            {PRIMARY_NAV.map((item) => {
              const on = item.match(pathname);
              return (
                <Link
                  key={item.id}
                  to={item.to}
                  data-tour={tourAttr(item.id)}
                  className={cn(
                    'shrink-0 rounded-full px-3.5 py-1.5 text-sm no-underline transition-colors',
                    on
                      ? 'bg-card text-foreground shadow-[var(--elev)]'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t(locale, item.labelKey)}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="relative hidden w-44 md:block lg:w-52" ref={box}>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={t(locale, 'searchPlaceholder')}
            className="h-10 w-full rounded-lg bg-muted pl-9 pr-3 text-sm text-foreground shadow-[var(--elev)] outline-none placeholder:text-muted-foreground"
          />
          {open ? (
            <div className="absolute top-[calc(100%+8px)] right-0 left-0 z-50 overflow-hidden rounded-xl bg-card py-1 shadow-[var(--elev)]">
              {hits.map((h) => (
                <button
                  key={h.to}
                  type="button"
                  className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-muted"
                  onClick={() => {
                    navigate(h.to);
                    setOpen(false);
                    setQ('');
                  }}
                >
                  <span className="text-sm">{h.label}</span>
                  <span className="text-xs text-muted-foreground line-clamp-1">{h.hint}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <BackendStatus className="hidden lg:inline-flex" />
        <div data-tour="theme-locale" className="flex items-center gap-0.5">
          <button
            type="button"
            title={t(locale, 'tourHelp')}
            aria-label={t(locale, 'tourHelp')}
            onClick={() => startProductTour()}
            className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <HelpCircle className="size-4" />
          </button>
          <LocaleSwitch />
          <ThemeSwitch compact />
        </div>
      </div>

      {section?.children?.length ? (
        <div className="border-t border-border/70">
          <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-2 sm:px-6">
            {section.children.map((c) => {
              const on = c.exact
                ? pathname === c.to
                : pathname === c.to || pathname.startsWith(`${c.to}/`);
              return (
                <Link
                  key={c.to}
                  to={c.to}
                  className={cn(
                    'shrink-0 rounded-full px-3 py-1.5 text-sm no-underline',
                    on ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t(locale, c.labelKey)}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </header>
  );
}
