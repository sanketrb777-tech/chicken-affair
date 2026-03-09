import { useAuth } from '../../context/AuthContext'
import { theme } from '../../lib/theme'

const KPI = ({ label, value, icon, color, bg }) => (
  <div style={{ ...theme.card, flex: 1, minWidth: 160, borderTop: `3px solid ${color}` }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <div style={{ fontSize: 11, color: theme.textLight, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
        <div style={{ fontSize: 30, fontWeight: 900, color: theme.textDark, marginTop: 6, letterSpacing: -1 }}>{value}</div>
      </div>
      <div style={{ width: 42, height: 42, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{icon}</div>
    </div>
  </div>
)

export default function DashboardPage() {
  const { profile } = useAuth()

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: theme.textDark, margin: 0, letterSpacing: -0.5 }}>
          {greeting}, {profile?.name} ☕
        </h1>
        <p style={theme.pageSubtitle}>Here's what's happening at Bambini Cafe today.</p>
      </div>

      {/* KPI Row */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <KPI label="Orders Today"     value="—"  icon="🧾" color={theme.primary} bg="#E6FAF8" />
        <KPI label="Active Tables"    value="—"  icon="🪑" color={theme.gold}    bg={theme.goldLight} />
        <KPI label="Revenue Today"    value="₹—" icon="💰" color={theme.green}   bg={theme.greenBg} />
        <KPI label="Items Sold"       value="—"  icon="🍽️" color={theme.blue}    bg={theme.blueBg} />
      </div>

      {/* Quick actions */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Quick Actions</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'New Order',      icon: '➕', color: theme.primary,  bg: '#E6FAF8',        link: '/tables'    },
            { label: 'View Tables',    icon: '▦',  color: theme.gold,     bg: theme.goldLight,  link: '/tables'    },
            { label: 'Open KDS',       icon: '📺', color: '#7C3AED',      bg: '#EDE9FE',        link: '/kds'       },
            { label: 'Today\'s Report',icon: '📊', color: theme.green,    bg: theme.greenBg,    link: '/reports'   },
          ].map((a, i) => (
            <a key={i} href={a.link} style={{ textDecoration: 'none', background: '#fff', border: `1px solid ${theme.border}`, borderRadius: 10, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: a.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{a.icon}</div>
              <span style={{ fontWeight: 700, fontSize: 13, color: theme.textDark }}>{a.label}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Placeholder for live data */}
      <div style={{ ...theme.card, textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
        <div style={{ fontWeight: 700, fontSize: 16, color: theme.textDark, marginBottom: 6 }}>Live charts coming soon</div>
        <div style={{ fontSize: 13, color: theme.textLight }}>Revenue trends, occupancy heatmap and hourly breakdown will appear here.</div>
      </div>
    </div>
  )
}