import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, ClipboardList, LayoutGrid, Receipt,
  BookOpen, Package, BarChart2, Users, Settings,
  Monitor, LogOut, ChevronLeft, ChevronRight, Coffee
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, module: 'dashboard' },
  { to: '/orders',    label: 'Orders',    icon: ClipboardList,   module: 'orders'    },
  { to: '/tables',    label: 'Tables',    icon: LayoutGrid,         module: 'tables'    },
  { to: '/billing',   label: 'Billing',   icon: Receipt,         module: 'billing'   },
  { to: '/menu',      label: 'Menu',      icon: BookOpen,        module: 'menu'      },
  { to: '/inventory', label: 'Inventory', icon: Package,         module: 'inventory' },
  { to: '/reports',   label: 'Reports',   icon: BarChart2,       module: 'reports'   },
  { to: '/staff',     label: 'Staff',     icon: Users,           module: 'staff'     },
  { to: '/settings',  label: 'Settings',  icon: Settings,        module: 'settings'  },
]

const ROLE_LABELS = {
  owner:   'Owner',
  manager: 'Manager',
  captain: 'Captain',
  biller:  'Biller',
}

const ROLE_COLORS = {
  owner:   '#D4A853',
  manager: '#38BDF8',
  captain: '#34D399',
  biller:  '#F472B6',
}

export default function Layout({ children }) {
  const { profile, signOut, can } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()

  const visibleNav = NAV_ITEMS.filter(item => can(item.module))
  const roleColor  = ROLE_COLORS[profile?.role] || '#D4A853'

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: "'DM Sans', 'Segoe UI', sans-serif", background: '#FDFCF9', overflow: 'hidden' }}>

      {/* ── SIDEBAR ── */}
      <aside style={{
        width: collapsed ? 64 : 224,
        background: '#092b33',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
        flexShrink: 0,
        boxShadow: '2px 0 16px rgba(0,0,0,0.18)',
      }}>

        {/* Logo */}
        <div style={{ padding: collapsed ? '16px 16px' : '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, background: 'linear-gradient(135deg, #D4A853, #B8860B)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Coffee size={18} color="#fff" strokeWidth={2.5} />
            </div>
            {!collapsed && (
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#fff', letterSpacing: -0.3, lineHeight: 1 }}>Bambini</div>
                <div style={{ fontWeight: 600, fontSize: 9, color: '#D4A853', letterSpacing: 2, textTransform: 'uppercase', marginTop: 2 }}>Cafe</div>
              </div>
            )}
          </div>
          {!collapsed && (
            <div onClick={() => setCollapsed(true)} style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.3)', display: 'flex' }}>
              <ChevronLeft size={16} />
            </div>
          )}
        </div>

        {/* Collapsed expand button */}
        {collapsed && (
          <div onClick={() => setCollapsed(false)} style={{ display: 'flex', justifyContent: 'center', padding: '10px 0', cursor: 'pointer', color: 'rgba(255,255,255,0.3)' }}>
            <ChevronRight size={16} />
          </div>
        )}

        {/* Role badge */}
        {!collapsed && profile && (
          <div style={{ margin: '12px 14px 4px', background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '8px 12px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: 10, color: roleColor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
              {ROLE_LABELS[profile.role]}
            </div>
            <div style={{ fontSize: 13, color: '#fff', fontWeight: 600, marginTop: 2 }}>{profile.name}</div>
          </div>
        )}

        {/* Nav items */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 8px', marginTop: 2 }}>
          {visibleNav.map(item => {
            const Icon = item.icon
            return (
              <NavLink key={item.to} to={item.to}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: collapsed ? '10px 0' : '10px 12px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  textDecoration: 'none',
                  borderRadius: 9,
                  background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                  borderLeft: isActive ? '3px solid #38BDF8' : '3px solid transparent',
                  marginBottom: 2,
                  transition: 'all 0.15s',
                })}
              >
                {({ isActive }) => (
                  <>
                    <Icon size={17} color={isActive ? '#38BDF8' : 'rgba(255,255,255,0.55)'} strokeWidth={isActive ? 2.5 : 2} />
                    {!collapsed && (
                      <span style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? '#fff' : 'rgba(255,255,255,0.55)' }}>
                        {item.label}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            )
          })}

          {/* KDS link */}
          {can('kds') && (
            <a href="/kds" target="_blank" rel="noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? '10px 0' : '10px 12px', justifyContent: collapsed ? 'center' : 'flex-start', textDecoration: 'none', borderRadius: 9, borderLeft: '3px solid transparent', marginBottom: 2 }}>
              <Monitor size={17} color="rgba(255,255,255,0.55)" strokeWidth={2} />
              {!collapsed && <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.55)' }}>KDS Screen ↗</span>}
            </a>
          )}
        </nav>

        {/* Sign out */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: collapsed ? '14px 0' : '14px 12px', display: 'flex', justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <div onClick={handleSignOut} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', borderRadius: 9, padding: collapsed ? '8px' : '8px 12px', transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <LogOut size={16} color="rgba(255,255,255,0.35)" strokeWidth={2} />
            {!collapsed && <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>Sign Out</span>}
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ background: '#fff', borderBottom: '1px solid #EDE8E0', padding: '11px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 12, color: '#A8917A', fontWeight: 500 }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#0D9488' }} />
            <span style={{ fontSize: 12, color: '#A8917A', fontWeight: 600 }}>Live</span>
          </div>
        </div>
        <main style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {children}
        </main>
      </div>
    </div>
  )
}