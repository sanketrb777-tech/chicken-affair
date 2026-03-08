import { useState } from 'react'

const SAMPLE_CATEGORIES = [
  { id:1, name:'Hot Beverages', items:[
    { id:1, name:'Cappuccino', price:180, veg:true, available:true },
    { id:2, name:'Espresso', price:120, veg:true, available:true },
    { id:3, name:'Masala Chai', price:80, veg:true, available:false },
  ]},
  { id:2, name:'Cold Beverages', items:[
    { id:4, name:'Cold Coffee', price:200, veg:true, available:true },
    { id:5, name:'Mojito', price:160, veg:true, available:true },
  ]},
  { id:3, name:'Food', items:[
    { id:6, name:'Bruschetta', price:280, veg:true, available:true },
    { id:7, name:'Chicken Sandwich', price:340, veg:false, available:true },
  ]},
]

export default function MenuPage() {
  const [activeCategory, setActiveCategory] = useState(1)
  const category = SAMPLE_CATEGORIES.find(c => c.id === activeCategory)

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'#1E293B', margin:0 }}>Menu</h1>
          <p style={{ color:'#64748B', fontSize:14, marginTop:4 }}>Manage categories, items, pricing and availability</p>
        </div>
        <button style={{ background:'#1D4ED8', color:'#fff', border:'none', borderRadius:8, padding:'10px 20px', fontSize:13, fontWeight:700, cursor:'pointer' }}>+ Add Item</button>
      </div>
      <div style={{ display:'flex', gap:16 }}>
        {/* Category list */}
        <div style={{ width:200, background:'#fff', borderRadius:12, padding:12, boxShadow:'0 1px 4px rgba(0,0,0,0.07)', alignSelf:'start' }}>
          <div style={{ fontSize:11, color:'#94A3B8', fontWeight:700, textTransform:'uppercase', letterSpacing:1, marginBottom:8, padding:'0 4px' }}>Categories</div>
          {SAMPLE_CATEGORIES.map(cat => (
            <div key={cat.id} onClick={() => setActiveCategory(cat.id)}
              style={{ padding:'9px 12px', borderRadius:8, cursor:'pointer', marginBottom:2, background: activeCategory===cat.id ? '#EFF6FF' : 'transparent', color: activeCategory===cat.id ? '#1D4ED8' : '#1E293B', fontWeight: activeCategory===cat.id ? 700 : 500, fontSize:13 }}>
              {cat.name} <span style={{ color:'#94A3B8', fontSize:11 }}>({cat.items.length})</span>
            </div>
          ))}
        </div>
        {/* Items */}
        <div style={{ flex:1 }}>
          {category?.items.map(item => (
            <div key={item.id} style={{ background:'#fff', borderRadius:12, padding:'14px 18px', marginBottom:10, boxShadow:'0 1px 4px rgba(0,0,0,0.07)', display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ width:10, height:10, borderRadius:2, border:`2px solid ${item.veg ? '#15803D' : '#B91C1C'}`, background: item.veg ? '#15803D' : '#B91C1C', flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:14, color:'#1E293B' }}>{item.name}</div>
              </div>
              <div style={{ fontWeight:700, fontSize:14, color:'#1E293B' }}>₹{item.price}</div>
              <div style={{ background: item.available ? '#DCFCE7' : '#F1F5F9', color: item.available ? '#15803D' : '#94A3B8', padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:700 }}>
                {item.available ? 'Available' : 'Unavailable'}
              </div>
              <button style={{ background:'#F1F5F9', border:'none', borderRadius:6, padding:'5px 12px', fontSize:12, cursor:'pointer', color:'#64748B' }}>Edit</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
