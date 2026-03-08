import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard',  icon: '⊞', module: 'dashboard' },
  { to: '/orders',    label: 'Orders',     icon: '🧾', module: 'orders'    },
  { to: '/tables',    label: 'Tables',     icon: '▦',  module: 'tables'    },
  { to: '/billing',   label: 'Billing',    icon: '₹',  module: 'billing'   },
  { to: '/menu',      label: 'Menu',       icon: '📋', module: 'menu'      },
  { to: '/inventory', label: 'Inventory',  icon: '📦', module: 'inventory' },
  { to: '/reports',   label: 'Reports',    icon: '↗',  module: 'reports'   },
  { to: '/staff',     label: 'Staff',      icon: '👥', module: 'staff'     },
  { to: '/settings',  label: 'Settings',   icon: '⚙',  module: 'settings'  },
]

const ROLE_LABELS = {
  owner:   'Owner',
  manager: 'Manager',
  captain: 'Captain',
  biller:  'Biller',
}

export default function Layout({ children }) {
  const { profile, signOut, can } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()

  const visibleNav = NAV_ITEMS.filter(item => can(item.module))

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: "'DM Sans', 'Segoe UI', sans-serif", background: '#FDFCF9', overflow: 'hidden' }}>

      {/* ── SIDEBAR ── */}
      <aside style={{
        width: collapsed ? 60 : 220,
        background: '#092b33',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s',
        flexShrink: 0,
        boxShadow: '2px 0 12px rgba(0,0,0,0.15)',
      }}>

        {/* Logo */}
        <div onClick={() => setCollapsed(!collapsed)} style={{ padding: collapsed ? '18px 15px' : '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #D4A853, #B8860B)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>☕</div>
          {!collapsed && (
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#fff', letterSpacing: -0.3 }}>Bambini</div>
              <div style={{ fontWeight: 600, fontSize: 10, color: '#D4A853', letterSpacing: 1.5, textTransform: 'uppercase' }}>Cafe</div>
            </div>
          )}
        </div>

        {/* Role badge */}
        {!collapsed && profile && (
          <div style={{ margin: '12px 14px 4px', background: 'rgba(212,168,83,0.12)', borderRadius: 8, padding: '8px 12px', border: '1px solid rgba(212,168,83,0.25)' }}>
            <div style={{ fontSize: 10, color: '#D4A853', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>{ROLE_LABELS[profile.role]}</div>
            <div style={{ fontSize: 13, color: '#fff', fontWeight: 600, marginTop: 1 }}>{profile.name}</div>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0', marginTop: 4 }}>
          {visibleNav.map(item => (
            <NavLink key={item.to} to={item.to}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: collapsed ? '11px 18px' : '11px 20px',
                textDecoration: 'none',
                background: isActive ? 'rgba(13,148,136,0.25)' : 'transparent',
borderLeft: isActive ? '3px solid #5EEAD4' : '3px solid transparent',
                transition: 'all 0.15s',
                margin: '1px 0',
              })}
            >
              <span style={{ fontSize: 15, flexShrink: 0 }}>{item.icon}</span>
              {!collapsed && (
                <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>{item.label}</span>
              )}
            </NavLink>
          ))}

          {/* KDS link */}
          {can('kds') && (
            <a href="/kds" target="_blank" rel="noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? '11px 18px' : '11px 20px', textDecoration: 'none', borderLeft: '3px solid transparent', margin: '1px 0' }}>
              <span style={{ fontSize: 15, flexShrink: 0 }}>📺</span>
              {!collapsed && <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>KDS Screen ↗</span>}
            </a>
          )}
        </nav>

        {/* Sign out */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: collapsed ? '14px 18px' : '14px 20px' }}>
          <div onClick={handleSignOut} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', opacity: 0.5 }}>
            <span style={{ fontSize: 15 }}>🚪</span>
            {!collapsed && <span style={{ fontSize: 13, color: '#fff', fontWeight: 600 }}>Sign Out</span>}
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Top bar */}
        <div style={{ background: '#fff', borderBottom: '1px solid #E8E0D5', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ fontSize: 12, color: '#A8917A' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#0D9488' }} />
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