import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Navigation items — filtered by role permissions
const NAV_ITEMS = [
  { to: '/dashboard',  label: 'Dashboard',  icon: '⊞', module: 'dashboard'  },
  { to: '/orders',     label: 'Orders',     icon: '🧾', module: 'orders'     },
  { to: '/tables',     label: 'Tables',     icon: '▦',  module: 'tables'     },
  { to: '/billing',    label: 'Billing',    icon: '₹',  module: 'billing'    },
  { to: '/menu',       label: 'Menu',       icon: '📋', module: 'menu'       },
  { to: '/inventory',  label: 'Inventory',  icon: '📦', module: 'inventory'  },
  { to: '/reports',    label: 'Reports',    icon: '↗',  module: 'reports'    },
  { to: '/staff',      label: 'Staff',      icon: '👥', module: 'staff'      },
  { to: '/settings',   label: 'Settings',   icon: '⚙',  module: 'settings'   },
]

const ROLE_COLORS = {
  owner:   '#7C3AED',
  manager: '#1D4ED8',
  captain: '#0F766E',
  biller:  '#B45309',
}

const ROLE_LABELS = {
  owner:   'Owner',
  manager: 'Manager',
  captain: 'Captain',
  biller:  'Biller / Cashier',
}

export default function Layout({ children }) {
  const { profile, signOut, can } = useAuth()
  const [collapsed, setCollapsed]   = useState(false)
  const navigate = useNavigate()

  const roleColor = ROLE_COLORS[profile?.role] || '#64748B'
  const visibleNav = NAV_ITEMS.filter(item => can(item.module))

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div style={{ display:'flex', height:'100vh', fontFamily:"'DM Sans', 'Segoe UI', sans-serif", background:'#F1F5F9', overflow:'hidden' }}>

      {/* ── SIDEBAR ───────────────────────────────────────────────────── */}
      <aside style={{ width: collapsed ? 56 : 210, background:'#0F172A', display:'flex', flexDirection:'column', transition:'width 0.2s', flexShrink:0 }}>

        {/* Logo */}
        <div
          onClick={() => setCollapsed(!collapsed)}
          style={{ padding: collapsed ? '18px 13px' : '18px 16px', borderBottom:'1px solid #1E293B', display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}
        >
          <div style={{ width:30, height:30, background:`linear-gradient(135deg, ${roleColor}, #0F172A)`, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>☕</div>
          {!collapsed && <div style={{ fontWeight:800, fontSize:14, color:'#fff', letterSpacing:-0.3 }}>Bambini Cafe</div>}
        </div>

        {/* Role badge */}
        {!collapsed && profile && (
          <div style={{ margin:'10px 12px 4px', background: roleColor + '22', borderRadius:8, padding:'6px 12px', border:`1px solid ${roleColor}44` }}>
            <div style={{ fontSize:10, color: roleColor, fontWeight:700, textTransform:'uppercase', letterSpacing:1 }}>{ROLE_LABELS[profile.role]}</div>
            <div style={{ fontSize:12, color:'#CBD5E1', fontWeight:600, marginTop:1 }}>{profile.name}</div>
          </div>
        )}

        {/* Nav links */}
        <nav style={{ flex:1, overflowY:'auto', padding:'8px 0', marginTop:4 }}>
          {visibleNav.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                display:'flex', alignItems:'center', gap:10,
                padding: collapsed ? '10px 13px' : '10px 16px',
                textDecoration:'none',
                background: isActive ? '#1E293B' : 'transparent',
                borderLeft: isActive ? `3px solid ${roleColor}` : '3px solid transparent',
                transition:'all 0.15s',
              })}
            >
              <span style={{ fontSize:16, flexShrink:0 }}>{item.icon}</span>
              {!collapsed && (
                <span style={{ fontSize:12, fontWeight:600, color:'#94A3B8' }}>{item.label}</span>
              )}
            </NavLink>
          ))}

          {/* KDS link — opens in new tab */}
          {can('kds') && (
            <a
              href="/kds"
              target="_blank"
              rel="noreferrer"
              style={{ display:'flex', alignItems:'center', gap:10, padding: collapsed ? '10px 13px' : '10px 16px', textDecoration:'none', borderLeft:'3px solid transparent' }}
            >
              <span style={{ fontSize:16, flexShrink:0 }}>📺</span>
              {!collapsed && <span style={{ fontSize:12, fontWeight:600, color:'#94A3B8' }}>KDS Screen ↗</span>}
            </a>
          )}
        </nav>

        {/* Sign out */}
        <div style={{ borderTop:'1px solid #1E293B', padding: collapsed ? '12px 13px' : '12px 16px' }}>
          <div
            onClick={handleSignOut}
            style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', opacity:0.6 }}
          >
            <span style={{ fontSize:16 }}>🚪</span>
            {!collapsed && <span style={{ fontSize:12, color:'#94A3B8', fontWeight:600 }}>Sign Out</span>}
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ──────────────────────────────────────────────── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <main style={{ flex:1, overflowY:'auto', padding:24 }}>
          {children}
        </main>
      </div>
    </div>
  )
}
