import { useAuth } from '../../context/AuthContext'

export default function DashboardPage() {
  const { profile } = useAuth()
  return (
    <div>
      <h1 style={{ fontSize:22, fontWeight:800, color:'#1E293B', marginBottom:4 }}>
        Good morning, {profile?.name} 👋
      </h1>
      <p style={{ color:'#64748B', fontSize:14, marginBottom:28 }}>Here's what's happening at Bambini Cafe today.</p>
      <div style={{ display:'flex', gap:14, flexWrap:'wrap', marginBottom:24 }}>
        {[
          { label:'Orders Today',  value:'—',  color:'#1D4ED8' },
          { label:'Active Tables', value:'—',  color:'#0F766E' },
          { label:'Revenue Today', value:'₹—', color:'#15803D' },
          { label:'Items Sold',    value:'—',  color:'#7C3AED' },
        ].map((k,i) => (
          <div key={i} style={{ background:'#fff', borderRadius:12, padding:'18px 22px', flex:1, minWidth:140, boxShadow:'0 1px 4px rgba(0,0,0,0.07)', borderTop:`3px solid ${k.color}` }}>
            <div style={{ fontSize:11, color:'#94A3B8', fontWeight:600, textTransform:'uppercase', letterSpacing:1 }}>{k.label}</div>
            <div style={{ fontSize:28, fontWeight:800, color:'#1E293B', marginTop:4 }}>{k.value}</div>
          </div>
        ))}
      </div>
      <div style={{ background:'#fff', borderRadius:12, padding:32, textAlign:'center', color:'#94A3B8', boxShadow:'0 1px 4px rgba(0,0,0,0.07)' }}>
        🚧 Live data loads once Supabase is connected.
      </div>
    </div>
  )
}
