import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
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
    <div className="app">
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
          <span className="logo">⚡</span>
          <Link to="/">
            <h1>SF Permission Compare</h1>
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
              <span className="org-badge" title={session.username}>
                {session.orgName}
                <span className="org-badge-user">{session.displayName}</span>
              </span>
              <button type="button" className="btn-outline" onClick={handleSwitchOrg}>
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
