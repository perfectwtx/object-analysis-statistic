import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { health, getBaseUrl, setBaseUrl } from '../api/index.js';
import TopNav from './TopNav.jsx';

export default function AppShell() {
  const { pathname } = useLocation();
  const isWorkbench = pathname === '/' || pathname === '';
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

  useEffect(() => {
    checkApi();
  }, [checkApi]);

  const onApplyBaseUrl = useCallback(() => {
    setBaseUrl(baseUrlInput);
    checkApi();
  }, [baseUrlInput, checkApi]);

  return (
    <div className={`product-shell${isWorkbench ? ' is-workbench' : ''}`}>
      <TopNav
        apiState={apiState}
        onRetryHealth={checkApi}
        baseUrlInput={baseUrlInput}
        setBaseUrlInput={setBaseUrlInput}
        onApplyBaseUrl={onApplyBaseUrl}
      />
      <main className={`product-main${isWorkbench ? ' is-flush' : ''}`}>
        <Outlet context={{ apiState, checkApi }} />
      </main>
    </div>
  );
}
