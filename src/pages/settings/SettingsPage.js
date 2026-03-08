export default function SettingsPage() {
  const sections = [
    { icon:'🪑', title:'Tables & Areas',    desc:'Add/rename tables, configure seating areas' },
    { icon:'📋', title:'Menu Configuration', desc:'GST rates, tax settings, default order notes' },
    { icon:'🖨️', title:'Printer Setup',      desc:'Configure KOT printer and bill printer' },
    { icon:'📺', title:'KDS Configuration',  desc:'Kitchen display screen station assignments' },
    { icon:'🏷️', title:'Discount & Offers',  desc:'Create discount types available at billing' },
    { icon:'🏪', title:'Outlet Details',     desc:'Cafe name, address, GSTIN, logo for bills' },
  ]
  return (
    <div>
      <h1 style={{ fontSize:22, fontWeight:800, color:'#1E293B', marginBottom:4 }}>Settings</h1>
      <p style={{ color:'#64748B', fontSize:14, marginBottom:24 }}>Configure your café — only owners can access this</p>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:14 }}>
        {sections.map((s,i) => (
          <div key={i} style={{ background:'#fff', borderRadius:12, padding:'20px 22px', boxShadow:'0 1px 4px rgba(0,0,0,0.07)', cursor:'pointer' }}>
            <div style={{ fontSize:28, marginBottom:10 }}>{s.icon}</div>
            <div style={{ fontWeight:700, fontSize:14, color:'#1E293B', marginBottom:4 }}>{s.title}</div>
            <div style={{ fontSize:12, color:'#94A3B8' }}>{s.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
