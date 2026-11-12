import { NavLink, Outlet } from 'react-router-dom';
import { Building2, Cable, FileText, LayoutDashboard, LogOut, Shield } from 'lucide-react';
import { clearAdminKey } from '../lib/api';

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/tenants', label: 'Tenants', icon: Building2 },
  { to: '/integrations', label: 'Integrations', icon: Cable },
  { to: '/invoices', label: 'Invoices', icon: FileText },
];

export default function Layout() {
  const handleLogout = () => {
    clearAdminKey();
    window.location.href = '/login';
  };

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-brand">
          <div className="app-brand-mark">
            <Shield size={18} />
          </div>
          <div className="min-w-0">
            <h1 className="app-brand-title">UAE-FATHOORA</h1>
            <p className="app-brand-sub">Admin console</p>
          </div>
        </div>
        <nav className="app-nav">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `app-nav-link${isActive ? ' is-active' : ''}`
              }
            >
              <Icon size={17} strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="app-sidebar-footer">
          <button type="button" onClick={handleLogout} className="app-nav-link w-full">
            <LogOut size={17} strokeWidth={1.75} />
            Sign out
          </button>
        </div>
        <div className="app-sidebar-mobile-actions">
          <button type="button" onClick={handleLogout} className="app-nav-link w-full">
            <LogOut size={17} strokeWidth={1.75} />
            Sign out
          </button>
        </div>
      </aside>
      <main className="app-main">
        <div className="app-main-inner">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
