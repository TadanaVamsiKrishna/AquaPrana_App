import { NavLink } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { APP_NAME, NAV_ITEMS } from '../../utils/constants'
import { Button } from '../common/Button'

export function Sidebar() {
  const { user, logout } = useAuth()

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo" aria-hidden>
          AP
        </div>
        <div className="sidebar-brand-text">
          <strong>AQUAPRANA</strong>
          <span>Admin Panel</span>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label={APP_NAME}>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <p>Signed in as {user?.name ?? 'AquaPrana Admin'}</p>
        <Button type="button" variant="outline" fullWidth className="btn-logout" onClick={logout}>
          Logout
        </Button>
      </div>
    </aside>
  )
}
