import { Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { TopNav } from '../components/layout/TopNav.jsx';
import { hydrateTheme } from '../lib/store.js';
import { cn } from '../lib/cn.js';

export default function AppShell() {
  const { pathname } = useLocation();
  const flush = pathname.startsWith('/analyze');

  useEffect(() => {
    hydrateTheme();
  }, []);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <TopNav />
      <main className={cn(flush ? 'min-h-[calc(100dvh-57px)]' : 'mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10')}>
        <Outlet />
      </main>
    </div>
  );
}
