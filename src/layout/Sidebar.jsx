import { NavLink } from 'react-router-dom';
import { NAV_GROUPS } from './nav.js';

export default function Sidebar({ apiState, onRetryHealth }) {
  return (
    <aside className="app-sidebar">
      <div className="app-brand">
        <div className="logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3v18h18" /><path d="M7 15l4-6 4 3 5-8" />
          </svg>
        </div>
        <div>
          <div className="brand-name">Object Analyzer</div>
          <div className="brand-sub">数据质量平台</div>
        </div>
      </div>
      <div className={`api-pill ${apiState?.status || 'unknown'}`}>
        <span className="api-dot" />
        {apiState?.status === 'ok' && <span>API 就绪{apiState.version ? ` · v${apiState.version}` : ''}</span>}
        {apiState?.status === 'checking' && <span>连接中…</span>}
        {apiState?.status === 'error' && (
          <span>离线 <button type="button" className="btn-link" onClick={onRetryHealth}>重试</button></span>
        )}
      </div>
      <nav className="app-nav">
        {NAV_GROUPS.map((g) => (
          <div key={g.id} className="nav-group">
            <div className="nav-group-label">{g.label}</div>
            {g.items.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
