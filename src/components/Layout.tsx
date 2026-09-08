import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useSalesforce } from '../auth/SalesforceContext';

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/compare/users', label: 'Users' },
  { to: '/compare/profiles', label: 'Profiles' },
  { to: '/compare/permission-sets', label: 'Permission Sets' },
  { to: '/compare/permission-set-groups', label: 'PSG Groups' },
];

export function Layout() {
  const { session, logout } = useSalesforce();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSwitchOrg = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="header-left">
          <button
            type="button"
            className="menu-toggle"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <Link to="/" className="brand">
            SF Permission Compare
          </Link>
        </div>

        <nav className={`app-nav ${menuOpen ? 'open' : ''}`}>
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={location.pathname === item.to ? 'active' : ''}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="header-right">
          {session && (
            <>
              <div className="org-badge" title={session.username}>
                <span className="org-badge-name">{session.orgName}</span>
                <span className="org-badge-user">{session.displayName}</span>
              </div>
              <button type="button" className="btn btn-ghost" onClick={handleSwitchOrg}>
                <LogOut size={16} />
                Disconnect
              </button>
            </>
          )}
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
