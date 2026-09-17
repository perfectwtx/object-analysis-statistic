import { useCallback, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { health, getBaseUrl, setBaseUrl } from '../api/index.js';
import ThemeSwitch from '../components/ThemeSwitch.jsx';
import Sidebar from './Sidebar.jsx';

const SIDEBAR_KEY = 'oaSidebarCollapsed';

export default function AppShell() {
  const [apiState, setApiState] = useState({ status: 'unknown', version: null, error: null });
  const [baseUrlInput, setBaseUrlInput] = useState(() => getBaseUrl());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === '1'; } catch { return false; }
  });

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const checkApi = useCallback(async () => {
    setApiState({ status: 'checking', version: null, error: null });
    try {
      const h = await health();
      setApiState({ status: 'ok', version: h?.version ?? null, error: null });
    } catch (e) {
      setApiState({ status: 'error', version: null, error: e.message });
    }
  }, []);

  useEffect(() => { checkApi(); }, [checkApi]);

  return (
    <div className={`app-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      <Sidebar
        apiState={apiState}
        onRetryHealth={checkApi}
        collapsed={sidebarCollapsed}
        onToggle={toggleSidebar}
      />
      <div className="app-main-col">
        <header className="app-topbar">
          <button
            type="button"
            className="sidebar-toggle"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? '展开侧栏' : '收起侧栏'}
            aria-label={sidebarCollapsed ? '展开侧栏' : '收起侧栏'}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {sidebarCollapsed
                ? <path d="M4 6h16M4 12h16M4 18h16" />
                : <path d="M4 6h16M4 12h10M4 18h16" />}
            </svg>
          </button>
          <div className="topbar-api">
            <input
              className="api-base-input"
              value={baseUrlInput}
              onChange={(e) => setBaseUrlInput(e.target.value)}
              placeholder="/api 或 http://host:port/api"
            />
            <button type="button" className="btn" onClick={() => { setBaseUrl(baseUrlInput); checkApi(); }}>
              应用
            </button>
          </div>
          <ThemeSwitch />
        </header>
        <div className="app-content">
          <Outlet context={{ apiState, checkApi, sidebarCollapsed, toggleSidebar }} />
        </div>
      </div>
    </div>
  );
}
