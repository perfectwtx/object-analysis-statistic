import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Moon, Search, Sun } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../ui/button.jsx';
import { PRIMARY_NAV, SEARCH_TARGETS, activeSection } from '../../lib/nav.js';
import { usePlatform } from '../../lib/store.js';
import { cn } from '../../lib/cn.js';
import { BackendStatus } from '../BackendStatus.jsx';

export function TopNav() {
  const { pathname } = useLocation();
  const section = activeSection(pathname);
  const theme = usePlatform((s) => s.theme);
  const setTheme = usePlatform((s) => s.setTheme);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const navigate = useNavigate();

  const hits = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return SEARCH_TARGETS.slice(0, 6);
    return SEARCH_TARGETS.filter(
      (t) => t.label.toLowerCase().includes(s) || t.hint.includes(s) || t.to.includes(s),
    ).slice(0, 8);
  }, [q]);

  useEffect(() => {
    const onDoc = (e) => {
      if (box.current && !box.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2.5 text-foreground no-underline">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M4 19V5M4 19h16M7 15l3.5-5 2.8 2.4L18 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="hidden leading-tight sm:block">
            <span className="block text-sm font-medium">Object Analyzer</span>
            <span className="block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Quality</span>
          </span>
        </Link>

        <nav className="flex min-w-0 flex-1 items-center overflow-x-auto">
          <div className="mx-auto flex rounded-full bg-muted p-1 shadow-[var(--elev)]">
            {PRIMARY_NAV.map((item) => {
              const on = item.match(pathname);
              return (
                <Link
                  key={item.id}
                  to={item.to}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-sm no-underline transition-colors sm:px-4',
                    on ? 'bg-card text-foreground shadow-[var(--elev)]' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="relative hidden w-52 md:block" ref={box}>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="搜索页面"
            className="h-10 w-full rounded-lg bg-muted pl-9 pr-3 text-sm text-foreground shadow-[var(--elev)] outline-none placeholder:text-muted-foreground"
          />
          {open ? (
            <div className="absolute top-[calc(100%+8px)] right-0 left-0 overflow-hidden rounded-xl bg-card py-1 shadow-[var(--elev)]">
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
                  <span className="text-xs text-muted-foreground">{h.hint}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <BackendStatus className="hidden sm:inline-flex" />
        <Button
          variant="ghost"
          size="icon"
          aria-label="切换主题"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
      </div>

      {section?.children?.length ? (
        <div className="border-t border-border/70">
          <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-2 sm:px-6">
            {section.children.map((c) => {
              const on = c.exact ? pathname === c.to : pathname === c.to || pathname.startsWith(`${c.to}/`);
              return (
                <Link
                  key={c.to}
                  to={c.to}
                  className={cn(
                    'shrink-0 rounded-full px-3 py-1.5 text-sm no-underline',
                    on ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {c.label}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </header>
  );
}
