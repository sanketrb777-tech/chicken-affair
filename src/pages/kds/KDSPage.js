import { useEffect, useState } from 'react'

// KDS — runs in a dedicated full-screen browser tab in the kitchen
// No login required on this screen — it's always-on

const SAMPLE_KOTS = [
  { id:1, table:'T3', items:[{ name:'Cappuccino', qty:2, done:false },{ name:'Bruschetta', qty:1, done:true }], time:'10:32 AM', elapsed:8 },
  { id:2, table:'T7', items:[{ name:'Cold Coffee', qty:1, done:false },{ name:'Masala Chai', qty:2, done:false }], time:'10:38 AM', elapsed:2 },
  { id:3, table:'T12', items:[{ name:'Chicken Sandwich', qty:2, done:false },{ name:'Mojito', qty:2, done:false }], time:'10:40 AM', elapsed:1 },
]

export default function KDSPage() {
  const [kots, setKots] = useState(SAMPLE_KOTS)
  const [time, setTime] = useState(new Date().toLocaleTimeString())

  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000)
    return () => clearInterval(t)
  }, [])

  function toggleItem(kotId, itemIndex) {
    setKots(prev => prev.map(k => k.id === kotId
      ? { ...k, items: k.items.map((item, i) => i === itemIndex ? { ...item, done: !item.done } : item) }
      : k
    ))
  }

  function markReady(kotId) {
    setKots(prev => prev.filter(k => k.id !== kotId))
  }

  return (
    <div style={{ minHeight:'100vh', background:'#0F172A', padding:20, fontFamily:"'DM Sans', 'Segoe UI', sans-serif" }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:24 }}>☕</span>
          <div>
            <div style={{ color:'#fff', fontWeight:800, fontSize:20 }}>Bambini Cafe — Kitchen Display</div>
            <div style={{ color:'#64748B', fontSize:13 }}>{kots.length} active order{kots.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <div style={{ color:'#64748B', fontSize:22, fontWeight:700, fontFamily:'monospace' }}>{time}</div>
      </div>

      {/* KOT Cards */}
      {kots.length === 0 ? (
        <div style={{ textAlign:'center', color:'#334155', fontSize:18, marginTop:100 }}>
          ✓ All caught up — no pending orders
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:16 }}>
          {kots.map(kot => {
            const allDone = kot.items.every(i => i.done)
            const borderColor = kot.elapsed > 15 ? '#EF4444' : kot.elapsed > 8 ? '#F59E0B' : '#22C55E'
            return (
              <div key={kot.id} style={{ background:'#1E293B', borderRadius:12, overflow:'hidden', border:`2px solid ${borderColor}` }}>
                <div style={{ background: borderColor + '22', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ color:'#fff', fontWeight:800, fontSize:18 }}>{kot.table}</span>
                  <span style={{ color: borderColor, fontWeight:700, fontSize:13 }}>{kot.elapsed} min</span>
                </div>
                <div style={{ padding:'12px 16px' }}>
                  {kot.items.map((item, idx) => (
                    <div key={idx} onClick={() => toggleItem(kot.id, idx)}
                      style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', cursor:'pointer', borderBottom:'1px solid #334155' }}>
                      <div style={{ width:20, height:20, borderRadius:4, background: item.done ? '#22C55E' : '#334155', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, flexShrink:0 }}>
                        {item.done ? '✓' : ''}
                      </div>
                      <span style={{ flex:1, color: item.done ? '#64748B' : '#fff', textDecoration: item.done ? 'line-through' : 'none', fontSize:14 }}>{item.name}</span>
                      <span style={{ color:'#64748B', fontSize:13 }}>×{item.qty}</span>
                    </div>
                  ))}
                </div>
                <div style={{ padding:'12px 16px' }}>
                  <button
                    onClick={() => markReady(kot.id)}
                    disabled={!allDone}
                    style={{ width:'100%', background: allDone ? '#22C55E' : '#334155', color: allDone ? '#fff' : '#64748B', border:'none', borderRadius:8, padding:'10px', fontSize:14, fontWeight:700, cursor: allDone ? 'pointer' : 'not-allowed' }}>
                    {allDone ? '✓ Mark as Ready' : 'Mark items to complete'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
