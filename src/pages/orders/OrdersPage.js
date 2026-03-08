export default function OrdersPage() {
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'#1E293B', margin:0 }}>Orders</h1>
          <p style={{ color:'#64748B', fontSize:14, marginTop:4 }}>Take and manage table orders</p>
        </div>
        <button style={{ background:'#0F766E', color:'#fff', border:'none', borderRadius:8, padding:'10px 20px', fontSize:13, fontWeight:700, cursor:'pointer' }}>
          + New Order
        </button>
      </div>
      <div style={{ background:'#fff', borderRadius:12, padding:32, textAlign:'center', color:'#94A3B8', boxShadow:'0 1px 4px rgba(0,0,0,0.07)' }}>
        🚧 Order taking module — coming in next build phase.
        <br /><br />
        <span style={{ fontSize:12 }}>Will include: Table selection → Menu browsing → Item notes → KOT firing → Additional rounds</span>
      </div>
    </div>
  )
}
