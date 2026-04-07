import { useNavigate } from 'react-router-dom'
import { theme } from '../../lib/theme'
import { LayoutGrid, Printer } from 'lucide-react'

const SECTIONS = [
  { icon: LayoutGrid, title: 'Tables & Areas',  desc: 'Add, edit and remove tables and seating areas', path: '/settings/tables'  },
  { icon: Printer,    title: 'Printer Setup',    desc: 'Configure KOT printer and bill printer',        path: '/settings/printer' },
]

export default function SettingsPage() {
  const navigate = useNavigate()
  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: theme.textDark, margin: 0 }}>Settings</h1>
        <p style={{ color: theme.textLight, fontSize: 14, marginTop: 4 }}>Configure your café</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        {SECTIONS.map((s, i) => {
          const Icon = s.icon
          return (
            <div key={i} onClick={() => navigate(s.path)}
              style={{ background: '#fff', borderRadius: 14, padding: '20px 22px', border: '1px solid ' + theme.border, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.08)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: theme.bgWarm, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Icon size={20} color={theme.textMid} />
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, color: theme.textDark, marginBottom: 4 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: theme.textLight }}>{s.desc}</div>
              <div style={{ marginTop: 14, color: '#6b1f1f', fontSize: 12, fontWeight: 700 }}>Configure ?</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}