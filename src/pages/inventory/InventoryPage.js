export default function InventoryPage() {
  const items = [
    { name:'Coffee Beans', unit:'kg', stock:4.5, min:2, status:'ok' },
    { name:'Milk', unit:'litres', stock:8, min:5, status:'ok' },
    { name:'Sugar', unit:'kg', stock:1.2, min:2, status:'low' },
    { name:'Bread', unit:'loaves', stock:3, min:2, status:'ok' },
    { name:'Chicken', unit:'kg', stock:0.5, min:2, status:'critical' },
  ]
  return (
    <div>
      <h1 style={{ fontSize:22, fontWeight:800, color:'#1E293B', marginBottom:4 }}>Inventory</h1>
      <p style={{ color:'#64748B', fontSize:14, marginBottom:24 }}>Track raw materials, record stock and wastage</p>
      <div style={{ background:'#FEE2E2', border:'1px solid #FECACA', borderLeft:'4px solid #B91C1C', borderRadius:10, padding:'12px 18px', marginBottom:20, fontSize:13, color:'#B91C1C', fontWeight:600 }}>
        ⚠️ 2 items below minimum stock level — Chicken, Sugar
      </div>
      <div style={{ background:'#fff', borderRadius:12, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.07)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 20px', borderBottom:'1px solid #F1F5F9' }}>
          <div style={{ fontWeight:700, fontSize:14, color:'#1E293B' }}>Raw Materials</div>
          <div style={{ display:'flex', gap:8 }}>
            <button style={{ background:'#F1F5F9', color:'#64748B', border:'none', borderRadius:6, padding:'6px 14px', fontSize:12, cursor:'pointer' }}>+ Record Inward</button>
            <button style={{ background:'#F1F5F9', color:'#64748B', border:'none', borderRadius:6, padding:'6px 14px', fontSize:12, cursor:'pointer' }}>+ Record Wastage</button>
          </div>
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ background:'#F8FAFC' }}>
              {['Item','Unit','Current Stock','Min. Level','Status','Action'].map(h => (
                <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:11, color:'#94A3B8', fontWeight:700, borderBottom:'1px solid #E2E8F0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item,i) => (
              <tr key={i} style={{ borderBottom:'1px solid #F8FAFC' }}>
                <td style={{ padding:'12px 16px', fontWeight:600, color:'#1E293B' }}>{item.name}</td>
                <td style={{ padding:'12px 16px', color:'#64748B' }}>{item.unit}</td>
                <td style={{ padding:'12px 16px', fontWeight:700, color: item.status==='critical' ? '#B91C1C' : item.status==='low' ? '#B45309' : '#1E293B' }}>{item.stock} {item.unit}</td>
                <td style={{ padding:'12px 16px', color:'#94A3B8' }}>{item.min} {item.unit}</td>
                <td style={{ padding:'12px 16px' }}>
                  <span style={{ background: item.status==='ok' ? '#DCFCE7' : item.status==='low' ? '#FEF3C7' : '#FEE2E2', color: item.status==='ok' ? '#15803D' : item.status==='low' ? '#B45309' : '#B91C1C', padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700, textTransform:'capitalize' }}>{item.status}</span>
                </td>
                <td style={{ padding:'12px 16px' }}>
                  <button style={{ background:'#F1F5F9', border:'none', borderRadius:6, padding:'4px 12px', fontSize:11, cursor:'pointer', color:'#64748B' }}>Update</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
