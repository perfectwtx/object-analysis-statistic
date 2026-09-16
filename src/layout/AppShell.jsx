import { useCallback, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { health, getBaseUrl, setBaseUrl } from '../api/index.js';
import ThemeSwitch from '../components/ThemeSwitch.jsx';
import Sidebar from './Sidebar.jsx';

export default function AppShell() {
  const [apiState, setApiState] = useState({ status: 'unknown', version: null, error: null });
  const [baseUrlInput, setBaseUrlInput] = useState(() => getBaseUrl());

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
    <div className="app-shell">
      <Sidebar apiState={apiState} onRetryHealth={checkApi} />
      <div className="app-main-col">
        <header className="app-topbar">
          <div className="topbar-api">
            <input className="api-base-input" value={baseUrlInput} onChange={(e) => setBaseUrlInput(e.target.value)} placeholder="/api 或 http://host:port/api" />
            <button type="button" className="btn" onClick={() => { setBaseUrl(baseUrlInput); checkApi(); }}>应用</button>
          </div>
          <ThemeSwitch />
        </header>
        <div className="app-content">
          <Outlet context={{ apiState, checkApi }} />
        </div>
      </div>
    </div>
  );
}
