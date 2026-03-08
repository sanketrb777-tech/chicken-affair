export default function BillingPage() {
  return (
    <div>
      <h1 style={{ fontSize:22, fontWeight:800, color:'#1E293B', marginBottom:4 }}>Billing</h1>
      <p style={{ color:'#64748B', fontSize:14, marginBottom:24 }}>Generate bills, apply discounts, print receipts</p>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
        {[
          { label:'Bills Today',     value:'—', color:'#1D4ED8' },
          { label:'Total Collected', value:'₹—', color:'#15803D' },
          { label:'Discounts Given', value:'₹—', color:'#B45309' },
          { label:'Pending Tables',  value:'—', color:'#B91C1C' },
        ].map((k,i) => (
          <div key={i} style={{ background:'#fff', borderRadius:12, padding:'16px 20px', boxShadow:'0 1px 4px rgba(0,0,0,0.07)', borderLeft:`4px solid ${k.color}` }}>
            <div style={{ fontSize:11, color:'#94A3B8', fontWeight:600 }}>{k.label}</div>
            <div style={{ fontSize:26, fontWeight:800, color:'#1E293B', marginTop:2 }}>{k.value}</div>
          </div>
        ))}
      </div>
      <div style={{ background:'#fff', borderRadius:12, padding:32, textAlign:'center', color:'#94A3B8', boxShadow:'0 1px 4px rgba(0,0,0,0.07)' }}>
        🚧 Billing module — coming in next build phase.
        <br /><br />
        <span style={{ fontSize:12 }}>Will include: Bill generation, GST auto-calc, discounts, print/WhatsApp bill, table clearing</span>
      </div>
    </div>
  )
}
