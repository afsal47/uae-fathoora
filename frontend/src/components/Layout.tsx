import { NavLink, Outlet } from 'react-router-dom';
import { Building2, Cable, FileText, LayoutDashboard, LogOut } from 'lucide-react';
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
    <div className="flex h-screen bg-gray-50">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">E-Invoice Hub</h1>
          <p className="text-xs text-gray-500 mt-1">Admin Dashboard</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-200 space-y-2">
          <a
            href="http://localhost:3000/docs"
            target="_blank"
            rel="noreferrer"
            className="block text-xs text-gray-400 hover:text-blue-600 transition-colors"
          >
            Swagger API Docs
          </a>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 text-xs text-gray-500 hover:text-red-600 transition-colors"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
