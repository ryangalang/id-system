import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, Users, Printer, FileUp,
  LogOut, CreditCard, ChevronRight, ScanLine, CalendarCheck
} from 'lucide-react'
import toast from 'react-hot-toast'

const navItems = [
  { path: '/',           icon: LayoutDashboard, label: 'Dashboard'  },
  { path: '/employees',  icon: Users,           label: 'Employees'  },
  { path: '/print',      icon: Printer,         label: 'Print IDs'  },
  { path: '/import',     icon: FileUp,          label: 'Import CSV' },
]

const attendanceItems = [
  { path: '/scanner',    icon: ScanLine,        label: 'QR Scanner',   badge: 'LIVE' },
  { path: '/attendance', icon: CalendarCheck,   label: 'Attendance'    },
]

export default function Sidebar() {
  const { pathname } = useLocation()
  const { user, signOut } = useAuth()
  const initials = (user?.email || 'HR').slice(0, 2).toUpperCase()

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:38,height:38, background:'linear-gradient(135deg,rgba(255,255,255,0.2),rgba(255,255,255,0.08))', border:'1px solid rgba(255,255,255,0.15)', borderRadius:10, display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
            <CreditCard size={20} color="white"/>
          </div>
          <div>
            <div className="sidebar-logo-title">Attendance</div>
            <div className="sidebar-logo-sub">HR Management System</div>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {/* Main nav */}
        <div className="sidebar-section-label">Main Menu</div>
        {navItems.map(({ path, icon: Icon, label }) => {
          const active = pathname === path
          return (
            <Link key={path} to={path} className={`nav-item ${active ? 'active' : ''}`}>
              <Icon size={17}/>
              <span style={{ flex:1 }}>{label}</span>
              {active && <ChevronRight size={14} style={{ opacity:0.5 }}/>}
            </Link>
          )
        })}

        {/* Attendance nav */}
        <div className="sidebar-section-label" style={{ marginTop:14 }}>Attendance</div>
        {attendanceItems.map(({ path, icon: Icon, label, badge }) => {
          const active = pathname === path
          return (
            <Link key={path} to={path} className={`nav-item ${active ? 'active' : ''}`}>
              <Icon size={17}/>
              <span style={{ flex:1 }}>{label}</span>
              {badge && (
                <span style={{ background:'#0d9488', color:'white', fontSize:'0.6rem', fontWeight:800, padding:'2px 6px', borderRadius:999, letterSpacing:'0.05em' }}>
                  {badge}
                </span>
              )}
              {active && !badge && <ChevronRight size={14} style={{ opacity:0.5 }}/>}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div style={{ display:'flex',alignItems:'center',gap:10,padding:'9px 10px',marginBottom:4,background:'rgba(255,255,255,0.05)',borderRadius:8 }}>
          <div style={{ width:32,height:32,borderRadius:'50%',background:'rgba(255,255,255,0.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.72rem',fontWeight:700,color:'white',flexShrink:0 }}>
            {initials}
          </div>
          <div style={{ flex:1,minWidth:0 }}>
            <div style={{ fontSize:'0.775rem',fontWeight:600,color:'white',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{user?.email}</div>
            <div style={{ fontSize:'0.675rem',color:'rgba(255,255,255,0.4)',marginTop:1 }}>HR Administrator</div>
          </div>
        </div>
        <button className="nav-item" onClick={async () => { await signOut(); toast.success('Signed out') }} style={{ color:'rgba(255,100,100,0.85)', marginTop:2 }}>
          <LogOut size={15}/> Sign Out
        </button>
      </div>
    </aside>
  )
}
