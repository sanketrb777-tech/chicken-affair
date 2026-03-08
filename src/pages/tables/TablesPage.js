export default function TablesPage() {
  const tables = Array.from({ length: 16 }, (_, i) => ({
    number: i + 1,
    status: ['free','free','free','occupied','occupied','bill_requested','free','free','occupied','free','free','free','occupied','free','free','free'][i],
  }))

  const statusConfig = {
    free:           { label:'Free',           bg:'#DCFCE7', color:'#15803D' },
    occupied:       { label:'Occupied',       bg:'#FEF3C7', color:'#B45309' },
    bill_requested: { label:'Bill Requested', bg:'#FEE2E2', color:'#B91C1C' },
    reserved:       { label:'Reserved',       bg:'#DBEAFE', color:'#1D4ED8' },
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'#1E293B', margin:0 }}>Tables</h1>
          <p style={{ color:'#64748B', fontSize:14, marginTop:4 }}>Live floor overview</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {Object.entries(statusConfig).map(([key, cfg]) => (
            <span key={key} style={{ background:cfg.bg, color:cfg.color, padding:'4px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>{cfg.label}</span>
          ))}
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(120px, 1fr))', gap:12 }}>
        {tables.map(t => {
          const cfg = statusConfig[t.status]
          return (
            <div key={t.number} style={{ background:'#fff', borderRadius:12, padding:20, textAlign:'center', boxShadow:'0 1px 4px rgba(0,0,0,0.07)', cursor:'pointer', border:`2px solid ${cfg.bg}`, transition:'all 0.15s' }}>
              <div style={{ fontSize:24, marginBottom:6 }}>🪑</div>
              <div style={{ fontWeight:800, fontSize:18, color:'#1E293B' }}>T{t.number}</div>
              <div style={{ background:cfg.bg, color:cfg.color, borderRadius:20, padding:'2px 8px', fontSize:10, fontWeight:700, marginTop:6, display:'inline-block' }}>{cfg.label}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
