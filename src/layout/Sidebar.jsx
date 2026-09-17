import { NavLink } from 'react-router-dom';
import { NAV_GROUPS } from './nav.js';

export default function Sidebar({ apiState, onRetryHealth, collapsed, onToggle }) {
  return (
    <aside className={`app-sidebar${collapsed ? ' is-collapsed' : ''}`} aria-hidden={collapsed}>
      <div className="app-brand">
        <div className="logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3v18h18" /><path d="M7 15l4-6 4 3 5-8" />
          </svg>
        </div>
        {!collapsed && (
          <div>
            <div className="brand-name">Object Analyzer</div>
            <div className="brand-sub">数据质量平台</div>
          </div>
        )}
        <button
          type="button"
          className="sidebar-close"
          onClick={onToggle}
          title="收起侧栏"
          aria-label="收起侧栏"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </div>
      {!collapsed && (
        <>
          <div className={`api-pill ${apiState?.status || 'unknown'}`}>
            <span className="api-dot" />
            {apiState?.status === 'ok' && (
              <span>API 就绪{apiState.version ? ` · v${apiState.version}` : ''}</span>
            )}
            {apiState?.status === 'checking' && <span>连接中…</span>}
            {apiState?.status === 'error' && (
              <span>
                离线{' '}
                <button type="button" className="btn-link" onClick={onRetryHealth}>重试</button>
              </span>
            )}
          </div>
          <nav className="app-nav">
            {NAV_GROUPS.map((g) => (
              <div key={g.id} className="nav-group">
                <div className="nav-group-label">{g.label}</div>
                {g.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
        </>
      )}
    </aside>
  );
}
