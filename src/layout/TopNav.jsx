import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { PRIMARY_NAV, activeSection } from './nav.js';
import ThemeSwitch from '../components/ThemeSwitch.jsx';

export default function TopNav({
  apiState,
  onRetryHealth,
  baseUrlInput,
  setBaseUrlInput,
  onApplyBaseUrl,
}) {
  const { pathname } = useLocation();
  const section = activeSection(pathname);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef(null);

  useEffect(() => {
    if (!settingsOpen) return;
    const onDoc = (e) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [settingsOpen]);

  return (
    <header className="product-header">
      <div className="product-header-inner">
        <Link to="/" className="product-brand">
          <span className="product-logo" aria-hidden>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 19V5M4 19h16M8 15l3.2-4.5 2.8 2.2L18 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="product-brand-text">
            <span className="product-name">Object Analyzer</span>
            <span className="product-tag">Quality</span>
          </span>
        </Link>

        <nav className="product-primary" aria-label="主导航">
          {PRIMARY_NAV.map((item) => {
            const isActive = item.match(pathname);
            return (
              <NavLink
                key={item.id}
                to={item.to}
                end={item.to === '/'}
                className={`product-pill${isActive ? ' is-active' : ''}`}
              >
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="product-actions">
          <button
            type="button"
            className={`product-status ${apiState?.status || 'unknown'}`}
            onClick={onRetryHealth}
            title={apiState?.error || 'API 状态'}
          >
            <span className="product-status-dot" />
            <span className="product-status-label">
              {apiState?.status === 'ok' && (apiState.version ? `v${apiState.version}` : '在线')}
              {apiState?.status === 'checking' && '连接中'}
              {apiState?.status === 'error' && '离线'}
              {(!apiState?.status || apiState?.status === 'unknown') && 'API'}
            </span>
          </button>

          <div className="product-settings-wrap" ref={settingsRef}>
            <button
              type="button"
              className={`product-icon-btn${settingsOpen ? ' is-open' : ''}`}
              onClick={() => setSettingsOpen((v) => !v)}
              aria-label="连接设置"
              title="连接设置"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
            </button>
            {settingsOpen && (
              <div className="product-settings-panel">
                <div className="product-settings-title">API 地址</div>
                <div className="product-settings-row">
                  <input
                    className="product-settings-input"
                    value={baseUrlInput}
                    onChange={(e) => setBaseUrlInput(e.target.value)}
                    placeholder="/api 或 http://host:port/api"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onApplyBaseUrl();
                        setSettingsOpen(false);
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn primary product-settings-apply"
                    onClick={() => {
                      onApplyBaseUrl();
                      setSettingsOpen(false);
                    }}
                  >
                    应用
                  </button>
                </div>
                <p className="product-settings-hint">
                  分析请求会发到此地址。本地默认多为 http://localhost:5xxx/api
                </p>
              </div>
            )}
          </div>

          <ThemeSwitch />
        </div>
      </div>

      {section?.children?.length > 0 && (
        <div className="product-subnav" role="navigation" aria-label={`${section.label} 子导航`}>
          <div className="product-subnav-inner">
            {section.children.map((c) => (
              <NavLink
                key={c.to}
                to={c.to}
                end={c.to === '/quality' || c.to === section.to}
                className={({ isActive }) => `product-chip${isActive ? ' is-active' : ''}`}
              >
                {c.label}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
