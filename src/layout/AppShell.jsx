import { Outlet, useLocation } from 'react-router-dom';
import { Suspense, useEffect } from 'react';
import LoadingBlock from '../components/ui/LoadingBlock.jsx';
import { TopNav } from '../components/layout/TopNav.jsx';
import { hydrateLocale, usePlatform } from '../lib/store.js';
import { cn } from '../lib/cn.js';
import ProductTour from '../components/tour/ProductTour.jsx';
import { t } from '../lib/i18n.js';
import { routeEnabled } from '../lib/capabilities.js';

export default function AppShell() {
  const { pathname } = useLocation();
  const flush = pathname.startsWith('/analyze');
  const refresh = usePlatform((s) => s.ensureLoaded);
  const retry = usePlatform((s) => s.refresh);
  const modules = usePlatform((s) => s.modules);
  const loading = usePlatform((s) => s.loading);
  const source = usePlatform((s) => s.source);
  const error = usePlatform((s) => s.error);
  const locale = usePlatform((s) => s.locale);
  const moduleLabels = { jobs: 'jobs', issues: 'issues', snapshots: 'qualityTitle', trend: 'trend', dashboard: 'qualityTitle', baselines: 'baselines', alerts: 'alerts' };
  const capabilities = usePlatform((s) => s.capabilities);

  useEffect(() => {
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
              : Object.entries(modules).filter(([, m]) => m.error).map(([name, m]) => t(locale, moduleLabels[name]) + ': ' + (m.source === 'unavailable' ? t(locale, 'apiReadyLater') : m.error)).join(' · ') || error}
            {source !== 'demo' && Object.entries(modules).filter(([, m]) => m.error).map(([name]) => (
              <button key={name} type="button" disabled={loading} className="ml-3 underline disabled:opacity-50"
                onClick={() => retry({ module: name })}>
                {t(locale, 'retry')} · {t(locale, moduleLabels[name])}
              </button>
            ))}
          </div>
        ) : null}
        {routeEnabled(pathname, capabilities) ? <Suspense fallback={<LoadingBlock label={locale === 'en' ? 'Loading…' : '加载中…'} />}><Outlet /></Suspense> : (
          <div role="status" className="p-8 text-center text-muted-foreground">
            {locale === 'en' ? 'This feature is not enabled on the current server.' : '当前服务未启用此功能。'}
          </div>
        )}
      </main>
      <ProductTour />
    </div>
  );
}
