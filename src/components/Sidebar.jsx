import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, Users, Printer, Upload,
  LogOut, CreditCard, Settings
} from 'lucide-react'
import toast from 'react-hot-toast'

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/employees', icon: Users, label: 'Employees' },
  { path: '/print', icon: Printer, label: 'Print IDs' },
  { path: '/import', icon: Upload, label: 'Import CSV' },
]

export default function Sidebar() {
  const { pathname } = useLocation()
  const { user, signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
    toast.success('Signed out')
  }

  const initials = user?.email?.slice(0, 2).toUpperCase() || 'HR'

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, background: 'var(--primary)',
            borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0
          }}>
            <CreditCard size={18} color="white" />
          </div>
          <div>
            <div className="sidebar-logo-title">ID System</div>
            <div className="sidebar-logo-sub">Dagupan · HR</div>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Navigation</div>
        {navItems.map(({ path, icon: Icon, label }) => (
          <Link
            key={path}
            to={path}
            className={`nav-item ${pathname === path ? 'active' : ''}`}
          >
            <Icon size={17} />
            {label}
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div style={{
          display: 'flex', alignItems: 'center', gap: 9,
          padding: '8px 10px', marginBottom: 6
        }}>
          <div className="avatar" style={{ width: 30, height: 30, fontSize: '0.7rem' }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--gray-700)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--gray-400)' }}>HR Admin</div>
          </div>
        </div>
        <button className="nav-item" onClick={handleSignOut} style={{ color: 'var(--danger)' }}>
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
