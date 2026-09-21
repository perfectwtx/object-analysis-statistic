import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { TOUR_STEPS, TOUR_STORAGE_KEY } from './tourSteps.js';
import { usePlatform } from '../../lib/store.js';
import { t } from '../../lib/i18n.js';
import { cn } from '../../lib/cn.js';
import { Button } from '../ui/button.jsx';

const PAD = 10;

function measure(selector) {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 && r.height < 2) return null;
  return {
    top: r.top - PAD,
    left: r.left - PAD,
    width: r.width + PAD * 2,
    height: r.height + PAD * 2,
  };
}

function tooltipStyle(rect, placement, tipW = 320, tipH = 160) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (!rect || placement === 'center') {
    return {
      top: Math.max(24, (vh - tipH) / 2),
      left: Math.max(16, (vw - tipW) / 2),
      width: Math.min(tipW, vw - 32),
    };
  }
  let top = rect.top + rect.height + 12;
  let left = rect.left;
  if (placement === 'top') top = rect.top - tipH - 12;
  if (placement === 'right') {
    top = rect.top;
    left = rect.left + rect.width + 12;
  }
  if (placement === 'left') {
    top = rect.top;
    left = rect.left - tipW - 12;
  }
  left = Math.min(Math.max(16, left), vw - tipW - 16);
  top = Math.min(Math.max(16, top), vh - tipH - 16);
  return { top, left, width: tipW };
}

export function startProductTour() {
  window.dispatchEvent(new CustomEvent('oa-tour-start'));
}

export default function ProductTour() {
  const locale = usePlatform((s) => s.locale);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);

  const step = TOUR_STEPS[index];
  const total = TOUR_STEPS.length;

  const close = useCallback((markSeen = true) => {
    setActive(false);
    document.body.style.overflow = '';
    if (markSeen) {
      try {
        localStorage.setItem(TOUR_STORAGE_KEY, '1');
      } catch { /* ignore */ }
    }
  }, []);

  const open = useCallback(() => {
    setIndex(0);
    setActive(true);
    document.body.style.overflow = 'hidden';
  }, []);

  useEffect(() => {
    const onStart = () => open();
    window.addEventListener('oa-tour-start', onStart);
    return () => window.removeEventListener('oa-tour-start', onStart);
  }, [open]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e) => {
      if (e.key === 'Escape') close(true);
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        setIndex((i) => {
          if (i >= TOUR_STEPS.length - 1) {
            close(true);
            return i;
          }
          return i + 1;
        });
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, close]);

  // First visit: auto-open after layout is ready
  useEffect(() => {
    let cancelled = false;
    try {
      if (localStorage.getItem(TOUR_STORAGE_KEY)) return;
    } catch { /* ignore */ }

    const tryOpen = () => {
      if (cancelled) return;
      // Wait until primary nav exists so spotlight has a real target
      const ready = document.querySelector('[data-tour="logo"], [data-tour="primary-nav"]');
      if (ready) {
        open();
        return true;
      }
      return false;
    };

    // Try a few times as React finishes painting
    let attempts = 0;
    const tick = () => {
      if (cancelled) return;
      if (tryOpen()) return;
      attempts += 1;
      if (attempts < 12) setTimeout(tick, 150);
      else open(); // fallback: open even without target
    };
    const tmr = setTimeout(tick, 600);
    return () => {
      cancelled = true;
      clearTimeout(tmr);
    };
  }, [open]);

  useEffect(() => {
    if (!active || !step?.route) return;
    if (pathname !== step.route && !pathname.startsWith(step.route + '/')) {
      navigate(step.route);
    }
  }, [active, step, pathname, navigate]);

  const refreshRect = useCallback(() => {
    if (!active || !step) return;
    setRect(measure(step.target));
  }, [active, step]);

  useLayoutEffect(() => {
    if (!active) return;
    const run = () => {
      refreshRect();
      requestAnimationFrame(refreshRect);
      setTimeout(refreshRect, 120);
      setTimeout(refreshRect, 320);
    };
    run();
    window.addEventListener('resize', refreshRect);
    window.addEventListener('scroll', refreshRect, true);
    return () => {
      window.removeEventListener('resize', refreshRect);
      window.removeEventListener('scroll', refreshRect, true);
    };
  }, [active, index, pathname, refreshRect]);

  if (!active || !step) return null;

  const tip = tooltipStyle(rect, step.placement || 'bottom');
  const isLast = index >= total - 1;

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label={t(locale, 'tourAria')}>
      {/* backdrop with spotlight hole */}
      <div
        className="absolute inset-0 transition-[clip-path] duration-300 ease-out"
        style={{
          background: 'rgba(0,0,0,0.55)',
          clipPath: rect
            ? `polygon(0% 0%, 0% 100%, ${rect.left}px 100%, ${rect.left}px ${rect.top}px, ${rect.left + rect.width}px ${rect.top}px, ${rect.left + rect.width}px ${rect.top + rect.height}px, ${rect.left}px ${rect.top + rect.height}px, ${rect.left}px 100%, 100% 100%, 100% 0%)`
            : undefined,
        }}
        onClick={() => close(true)}
      />
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-primary shadow-[0_0_0_4px_rgba(59,130,246,0.25)] transition-all duration-300 ease-out"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          }}
        />
      ) : null}

      <div
        className="absolute z-[101] rounded-2xl border border-border bg-card p-4 shadow-[var(--elev)]"
        style={{ top: tip.top, left: tip.left, width: tip.width }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="size-4 shrink-0" />
            <span className="text-xs font-medium tracking-wide uppercase opacity-80">
              {t(locale, 'tourBadge')} · {index + 1}/{total}
            </span>
          </div>
          <button
            type="button"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => close(true)}
            aria-label={t(locale, 'tourSkip')}
          >
            <X className="size-4" />
          </button>
        </div>
        <h3 className="text-base font-medium leading-snug text-foreground">{t(locale, step.titleKey)}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(locale, step.bodyKey)}</p>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => close(true)}
          >
            {t(locale, 'tourSkip')}
          </button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={index === 0}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
            >
              <ChevronLeft className="size-3.5" />
              {t(locale, 'tourPrev')}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (isLast) close(true);
                else setIndex((i) => Math.min(total - 1, i + 1));
              }}
            >
              {isLast ? t(locale, 'tourFinish') : t(locale, 'tourNext')}
              {!isLast ? <ChevronRight className="size-3.5" /> : null}
            </Button>
          </div>
        </div>

        {/* progress dots */}
        <div className="mt-3 flex justify-center gap-1.5">
          {TOUR_STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === index ? 'w-5 bg-primary' : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50',
              )}
              onClick={() => setIndex(i)}
              aria-label={`Step ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
