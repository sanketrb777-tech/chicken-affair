import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard, ClipboardList, LayoutGrid, Receipt,
  BookOpen, Package, BarChart2, Users, Settings,
  Monitor, LogOut, ChevronLeft, ChevronRight, Coffee, Menu, X
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, module: 'dashboard' },
  { to: '/orders',    label: 'Orders',    icon: ClipboardList,   module: 'orders'    },
  { to: '/tables',    label: 'Tables',    icon: LayoutGrid,      module: 'tables'    },
  { to: '/billing',   label: 'Billing',   icon: Receipt,         module: 'billing'   },
  { to: '/menu',      label: 'Menu',      icon: BookOpen,        module: 'menu'      },
  { to: '/inventory', label: 'Inventory', icon: Package,         module: 'inventory' },
  { to: '/reports',   label: 'Reports',   icon: BarChart2,       module: 'reports'   },
  { to: '/staff',     label: 'Staff',     icon: Users,           module: 'staff'     },
  { to: '/settings',  label: 'Settings',  icon: Settings,        module: 'settings'  },
]

const ROLE_LABELS = { owner: 'Owner', manager: 'Manager', captain: 'Captain', biller: 'Biller' }
const ROLE_COLORS = { owner: '#cd6155', manager: '#e8a09a', captain: '#34D399', biller: '#e8a09a' }

// Bottom nav shows only the most important 5 items on mobile
const BOTTOM_NAV_MODULES = ['dashboard', 'tables', 'orders', 'billing', 'menu']

export default function Layout({ children }) {
  const { profile, signOut, can } = useAuth()
  const [collapsed, setCollapsed]     = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const navigate = useNavigate()

  const visibleNav   = NAV_ITEMS.filter(item => can(item.module))
  const bottomNav    = NAV_ITEMS.filter(item => BOTTOM_NAV_MODULES.includes(item.module) && can(item.module))
  const roleColor    = ROLE_COLORS[profile?.role] || '#cd6155'

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: "'DM Sans', 'Segoe UI', sans-serif", background: '#ffffff', overflow: 'hidden' }}>

      {/* ── DESKTOP SIDEBAR (hidden on mobile) ── */}
      <aside style={{
        width: collapsed ? 64 : 224,
        background: '#6b1f1f',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
        flexShrink: 0,
        boxShadow: '2px 0 16px rgba(0,0,0,0.18)',
        // Hide on mobile
        position: 'relative',
        zIndex: 10,
      }}
        className="desktop-sidebar"
      >
        {/* Logo */}
        <div style={{ padding: collapsed ? '16px 16px' : '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, background: 'linear-gradient(135deg, #cd6155, #b91c1c)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Coffee size={18} color="#fff" strokeWidth={2.5} />
            </div>
            {!collapsed && (
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#fff', letterSpacing: -0.3, lineHeight: 1 }}>Chicken Affair</div>
                <div style={{ fontWeight: 600, fontSize: 9, color: '#cd6155', letterSpacing: 2, textTransform: 'uppercase', marginTop: 2 }}>Cafe</div>
              </div>
            )}
          </div>
          {!collapsed && (
            <div onClick={() => setCollapsed(true)} style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.3)', display: 'flex' }}>
              <ChevronLeft size={16} />
            </div>
          )}
        </div>

        {collapsed && (
          <div onClick={() => setCollapsed(false)} style={{ display: 'flex', justifyContent: 'center', padding: '10px 0', cursor: 'pointer', color: 'rgba(255,255,255,0.3)' }}>
            <ChevronRight size={16} />
          </div>
        )}

        {!collapsed && profile && (
          <div style={{ margin: '12px 14px 4px', background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '8px 12px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: 10, color: roleColor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>{ROLE_LABELS[profile.role]}</div>
            <div style={{ fontSize: 13, color: '#fff', fontWeight: 600, marginTop: 2 }}>{profile.name}</div>
          </div>
        )}

        <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 8px', marginTop: 2 }}>
          {visibleNav.map(item => {
            const Icon = item.icon
            return (
              <NavLink key={item.to} to={item.to}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: collapsed ? '10px 0' : '10px 12px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  textDecoration: 'none', borderRadius: 9,
                  background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                  borderLeft: isActive ? '3px solid #e8a09a' : '3px solid transparent',
                  marginBottom: 2, transition: 'all 0.15s',
                })}
              >
                {({ isActive }) => (
                  <>
                    <Icon size={17} color={isActive ? '#e8a09a' : 'rgba(255,255,255,0.55)'} strokeWidth={isActive ? 2.5 : 2} />
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

          {can('kds') && (
            <a href="/kds" target="_blank" rel="noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: collapsed ? '10px 0' : '10px 12px', justifyContent: collapsed ? 'center' : 'flex-start', textDecoration: 'none', borderRadius: 9, borderLeft: '3px solid transparent', marginBottom: 2 }}>
              <Monitor size={17} color="rgba(255,255,255,0.55)" strokeWidth={2} />
              {!collapsed && <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.55)' }}>KDS Screen ↗</span>}
            </a>
          )}
        </nav>

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

      {/* ── MOBILE DRAWER OVERLAY ── */}
      {mobileMenuOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }}>
          {/* Backdrop */}
          <div onClick={() => setMobileMenuOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} />
          {/* Drawer */}
          <div style={{ position: 'relative', width: 240, background: '#6b1f1f', height: '100%', display: 'flex', flexDirection: 'column', zIndex: 51 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, background: 'linear-gradient(135deg, #cd6155, #b91c1c)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Coffee size={18} color="#fff" strokeWidth={2.5} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>Chicken Affair</div>
                  <div style={{ fontWeight: 600, fontSize: 9, color: '#cd6155', letterSpacing: 2, textTransform: 'uppercase' }}>Cafe</div>
                </div>
              </div>
              <div onClick={() => setMobileMenuOpen(false)} style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}>
                <X size={20} />
              </div>
            </div>

            {profile && (
              <div style={{ margin: '12px 14px 4px', background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '8px 12px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: 10, color: roleColor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>{ROLE_LABELS[profile.role]}</div>
                <div style={{ fontSize: 13, color: '#fff', fontWeight: 600, marginTop: 2 }}>{profile.name}</div>
              </div>
            )}

            <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
              {visibleNav.map(item => {
                const Icon = item.icon
                return (
                  <NavLink key={item.to} to={item.to} onClick={() => setMobileMenuOpen(false)}
                    style={({ isActive }) => ({
                      display: 'flex', alignItems: 'center', gap: 10, padding: '12px 12px',
                      textDecoration: 'none', borderRadius: 9,
                      background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                      borderLeft: isActive ? '3px solid #e8a09a' : '3px solid transparent',
                      marginBottom: 2,
                    })}
                  >
                    {({ isActive }) => (
                      <>
                        <Icon size={18} color={isActive ? '#e8a09a' : 'rgba(255,255,255,0.55)'} strokeWidth={isActive ? 2.5 : 2} />
                        <span style={{ fontSize: 14, fontWeight: isActive ? 700 : 500, color: isActive ? '#fff' : 'rgba(255,255,255,0.55)' }}>{item.label}</span>
                      </>
                    )}
                  </NavLink>
                )
              })}
            </nav>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '14px 12px' }}>
              <div onClick={handleSignOut} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', borderRadius: 9, padding: '8px 12px' }}>
                <LogOut size={16} color="rgba(255,255,255,0.35)" />
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>Sign Out</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Top bar */}
        <div style={{ background: '#fff', borderBottom: '1px solid #fee2e2', padding: '11px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          {/* Hamburger — mobile only */}
          <div onClick={() => setMobileMenuOpen(true)} className="mobile-menu-btn" style={{ cursor: 'pointer', display: 'none', color: '#6b1f1f' }}>
            <Menu size={22} />
          </div>
          <div style={{ fontSize: 12, color: '#e8a09a', fontWeight: 500 }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#c0392b' }} />
            <span style={{ fontSize: 12, color: '#e8a09a', fontWeight: 600 }}>Live</span>
          </div>
        </div>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: 16 }} className="main-content">
          {children}
        </main>

        {/* ── MOBILE BOTTOM NAV ── */}
        <nav className="mobile-bottom-nav" style={{ display: 'none', background: '#6b1f1f', borderTop: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
          {bottomNav.map(item => {
            const Icon = item.icon
            return (
              <NavLink key={item.to} to={item.to}
                style={({ isActive }) => ({
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', padding: '8px 4px', textDecoration: 'none',
                  color: isActive ? '#e8a09a' : 'rgba(255,255,255,0.45)',
                  borderTop: isActive ? '2px solid #e8a09a' : '2px solid transparent',
                  gap: 3,
                })}
              >
                {({ isActive }) => (
                  <>
                    <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                    <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 500 }}>{item.label}</span>
                  </>
                )}
              </NavLink>
            )
          })}
          {/* More button → opens drawer */}
          <div onClick={() => setMobileMenuOpen(true)}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px 4px', cursor: 'pointer', color: 'rgba(255,255,255,0.45)', gap: 3 }}>
            <Menu size={20} strokeWidth={2} />
            <span style={{ fontSize: 10, fontWeight: 500 }}>More</span>
          </div>
        </nav>
      </div>

      {/* ── RESPONSIVE CSS ── */}
      <style>{`
        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
          .mobile-bottom-nav { display: flex !important; }
          .main-content { padding: 12px !important; padding-bottom: 8px !important; }
        }
      `}</style>
    </div>
  )
}