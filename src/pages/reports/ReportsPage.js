export default function ReportsPage() {
  const reports = [
    { icon:'📊', title:'Daily Sales Report',       desc:'Total revenue, order count, hourly breakdown' },
    { icon:'🍽️', title:'Item-wise Report',          desc:'Best sellers, revenue per item, quantity sold' },
    { icon:'🗂️', title:'Category-wise Report',      desc:'Food vs Beverages vs Desserts revenue split' },
    { icon:'👤', title:'Staff Activity Report',     desc:'Orders per captain, bills per biller' },
    { icon:'❌', title:'Cancelled Orders Report',   desc:'What was cancelled, who cancelled it, why' },
    { icon:'🏷️', title:'Discount Report',           desc:'All discounts applied, by whom, total amount' },
    { icon:'📦', title:'Inventory Consumption',     desc:'Ingredients consumed per day vs stock received' },
    { icon:'🪑', title:'Table / Covers Report',     desc:'Guests served, average spend, peak hours' },
  ]
  return (
    <div>
      <h1 style={{ fontSize:22, fontWeight:800, color:'#1E293B', marginBottom:4 }}>Reports</h1>
      <p style={{ color:'#64748B', fontSize:14, marginBottom:24 }}>Business insights and exportable reports</p>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:14 }}>
        {reports.map((r,i) => (
          <div key={i} style={{ background:'#fff', borderRadius:12, padding:'20px 22px', boxShadow:'0 1px 4px rgba(0,0,0,0.07)', cursor:'pointer', transition:'all 0.15s' }}>
            <div style={{ fontSize:28, marginBottom:10 }}>{r.icon}</div>
            <div style={{ fontWeight:700, fontSize:14, color:'#1E293B', marginBottom:4 }}>{r.title}</div>
            <div style={{ fontSize:12, color:'#94A3B8' }}>{r.desc}</div>
            <div style={{ marginTop:14, color:'#1D4ED8', fontSize:12, fontWeight:600 }}>View Report →</div>
          </div>
        ))}
      </div>
    </div>
  )
}
