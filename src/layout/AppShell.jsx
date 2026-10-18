import { Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { TopNav } from '../components/layout/TopNav.jsx';
import { hydrateTheme, hydrateLocale, usePlatform } from '../lib/store.js';
import { cn } from '../lib/cn.js';
import ProductTour from '../components/tour/ProductTour.jsx';

export default function AppShell() {
  const { pathname } = useLocation();
  const flush = pathname.startsWith('/analyze');
  const refresh = usePlatform((s) => s.refresh);
  const source = usePlatform((s) => s.source);
  const error = usePlatform((s) => s.error);
  const locale = usePlatform((s) => s.locale);

  useEffect(() => {
    hydrateTheme();
    hydrateLocale();
    refresh();
  }, [refresh]);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <TopNav />
      <main className={cn(flush ? 'min-h-[calc(100dvh-57px)]' : 'mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10')}>
        {source === 'demo' || error ? (
          <div role="status" className="mb-4 rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground">
            {source === 'demo'
              ? locale === 'en' ? 'Demo mode: all platform metrics are sample data. Alert changes are local only.' : '演示模式：平台指标均为样例数据，告警切换仅在本地生效。'
              : error}
          </div>
        ) : null}
        <Outlet />
      </main>
      <ProductTour />
    </div>
  );
}
