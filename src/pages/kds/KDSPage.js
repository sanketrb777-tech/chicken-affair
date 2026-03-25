import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

export default function KDSPage() {
  const [orders, setOrders]         = useState([])
  const [batchItems, setBatchItems] = useState([])
  const [categoryOrder, setCategoryOrder] = useState({}) // categoryId -> sort_order
  const [time, setTime]             = useState('')
  const [connected, setConnected]   = useState(false)
  const [activeView, setActiveView] = useState('orders')
  const debounceRef = useRef(null)

  const debouncedFetch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchKOTs(), 300)
  }, [])

  useEffect(() => {
    updateClock()
    fetchCategories()
    fetchKOTs()

    const channel = supabase
      .channel('kds-realtime-v3')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'kots' },           debouncedFetch)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'kots' },           debouncedFetch)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'kot_items' },      debouncedFetch)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'kot_items' },      debouncedFetch)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' },         debouncedFetch)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' },         debouncedFetch)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'menu_categories' }, fetchCategories)
      .subscribe(status => setConnected(status === 'SUBSCRIBED'))

    const clockTimer   = setInterval(updateClock, 1000)
    const refreshTimer = setInterval(fetchKOTs, 15000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(clockTimer)
      clearInterval(refreshTimer)
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [debouncedFetch])

  function updateClock() {
    setTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }))
  }

  async function fetchCategories() {
    const { data } = await supabase.from('menu_categories').select('id, sort_order').order('sort_order')
    if (!data) return
    const map = {}
    data.forEach(c => { map[c.id] = c.sort_order })
    setCategoryOrder(map)
  }

  async function fetchKOTs() {
    const { data, error } = await supabase
      .from('kots')
      .select(`
        id, status, created_at,
        orders ( id, order_type, customer_name, covers, cafe_tables ( number ) ),
        kot_items (
          id,
          order_items ( quantity, notes, menu_items ( id, name, priority, category_id ) )
        )
      `)
      .in('status', ['pending', 'in_progress', 'ready'])
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at')

    if (error) { console.error('KDS fetch error:', error); return }

    // Build order map
    const orderMap = {}
    ;(data || []).forEach(kot => {
      const orderId = kot.orders?.id
      if (!orderId) return
      if (!orderMap[orderId]) {
        orderMap[orderId] = {
          orderId,
          orderType:    kot.orders?.order_type,
          customerName: kot.orders?.customer_name,
          tableNumber:  kot.orders?.cafe_tables?.number,
          kots:         []
        }
      }
      orderMap[orderId].kots.push(kot)
    })

    // Sort kot_items within each KOT by: category sort_order first, then item priority
    Object.values(orderMap).forEach(order => {
      order.kots.forEach(kot => {
        kot.kot_items.sort((a, b) => {
          const catA = a.order_items?.menu_items?.category_id
          const catB = b.order_items?.menu_items?.category_id
          const catOrderA = categoryOrder[catA] ?? 999
          const catOrderB = categoryOrder[catB] ?? 999
          if (catOrderA !== catOrderB) return catOrderA - catOrderB
          // Within same category, sort by item priority (1 = highest)
          const priA = a.order_items?.menu_items?.priority ?? 2
          const priB = b.order_items?.menu_items?.priority ?? 2
          return priA - priB
        })
      })
    })

    setOrders(Object.values(orderMap))

    // Build batch view — same item within 5 min
    const itemMap    = {}
    const fiveMinAgo = Date.now() - 5 * 60 * 1000

    ;(data || []).forEach(kot => {
      if (kot.status === 'ready') return
      const kotTime = new Date(kot.created_at).getTime()
      if (kotTime < fiveMinAgo) return

      const tableNum     = kot.orders?.cafe_tables?.number
      const customerName = kot.orders?.customer_name
      const orderType    = kot.orders?.order_type

      kot.kot_items.forEach(ki => {
        const name     = ki.order_items?.menu_items?.name
        const qty      = ki.order_items?.quantity || 0
        const catId    = ki.order_items?.menu_items?.category_id
        const catOrder = categoryOrder[catId] ?? 999
        if (!name) return
        if (!itemMap[name]) itemMap[name] = { name, catOrder, entries: [] }
        const existing = itemMap[name].entries.find(e => e.tableNumber === tableNum && e.orderType === orderType)
        if (existing) { existing.qty += qty } else {
          itemMap[name].entries.push({ tableNumber: tableNum, qty, orderType, customerName })
        }
      })
    })

    const batched = Object.values(itemMap)
      .filter(b => b.entries.length > 1 || b.entries.reduce((s, e) => s + e.qty, 0) > 1)
      .sort((a, b) => a.catOrder - b.catOrder || b.entries.reduce((s,e)=>s+e.qty,0) - a.entries.reduce((s,e)=>s+e.qty,0))
      .map(b => ({ ...b, totalQty: b.entries.reduce((s, e) => s + e.qty, 0) }))

    setBatchItems(batched)
  }

  async function markKOTDone(kotId) {
    await supabase.from('kots').update({ status: 'ready' }).eq('id', kotId)
    setOrders(prev => prev.map(order => ({
      ...order,
      kots: order.kots.map(k => k.id === kotId ? { ...k, status: 'ready' } : k)
    })))
  }

  function getElapsed(createdAt) {
    return Math.floor((new Date() - new Date(createdAt)) / 60000)
  }

  function formatTime(ts) {
    return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  }

  function getOrderLabel(order) {
    if (order.orderType === 'dine_in')  return 'Table ' + order.tableNumber
    if (order.orderType === 'takeaway') return order.customerName || 'Takeaway'
    if (order.orderType === 'delivery') return order.customerName || 'Delivery'
    return 'Order'
  }

  function getAccentColor(kots) {
    const pending = kots.filter(k => k.status !== 'ready')
    if (pending.length === 0) return { bg: '#14532D', border: '#22C55E', badge: '#22C55E' }
    const elapsed = getElapsed(pending[0].created_at)
    if (elapsed > 15) return { bg: '#7F1D1D', border: '#EF4444', badge: '#EF4444' }
    if (elapsed > 8)  return { bg: '#78350F', border: '#F59E0B', badge: '#F59E0B' }
    return { bg: '#14532D', border: '#22C55E', badge: '#22C55E' }
  }

  const pendingCount = orders.filter(o => o.kots.some(k => k.status !== 'ready')).length

  return (
    <div style={{ minHeight: '100vh', background: '#0D1117', padding: '20px 24px', fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ background: '#D4A853', borderRadius: 12, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 22 }}>☕</span>
          </div>
          <div>
            <div style={{ color: '#F8FAFC', fontWeight: 800, fontSize: 20, letterSpacing: -0.5 }}>Bambini Cafe – Kitchen</div>
            <div style={{ fontSize: 13, marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
              {pendingCount === 0
                ? <span style={{ color: '#22C55E', fontWeight: 600 }}>✓ All clear</span>
                : <span style={{ color: '#94A3B8' }}>{pendingCount} order{pendingCount !== 1 ? 's' : ''} pending</span>}
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: connected ? '#22C55E' : '#EF4444' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: connected ? '#22C55E' : '#EF4444', display: 'inline-block' }} />
                {connected ? 'Live' : 'Reconnecting...'}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', background: '#161B22', border: '1px solid #30363D', borderRadius: 10, overflow: 'hidden' }}>
            <button onClick={() => setActiveView('orders')}
              style={{ padding: '8px 16px', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', background: activeView === 'orders' ? '#092b33' : 'transparent', color: activeView === 'orders' ? '#fff' : '#94A3B8' }}>
              🍽 Orders
            </button>
            <button onClick={() => setActiveView('batch')}
              style={{ padding: '8px 16px', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', background: activeView === 'batch' ? '#D4A853' : 'transparent', color: activeView === 'batch' ? '#092b33' : '#94A3B8', position: 'relative' }}>
              🔥 Batch
              {batchItems.length > 0 && (
                <span style={{ background: '#EF4444', color: '#fff', borderRadius: 10, fontSize: 9, padding: '1px 5px', marginLeft: 5, fontWeight: 800 }}>{batchItems.length}</span>
              )}
            </button>
          </div>
          <div style={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 12, padding: '10px 20px' }}>
            <div style={{ color: '#F8FAFC', fontSize: 24, fontWeight: 800, fontFamily: 'monospace', letterSpacing: 1, textTransform: 'uppercase' }}>{time}</div>
          </div>
        </div>
      </div>

      {/* ── ORDERS VIEW ── */}
      {activeView === 'orders' && (
        <>
          {orders.length === 0 && (
            <div style={{ textAlign: 'center', marginTop: 100 }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(34,197,94,0.1)', border: '2px solid #22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 32 }}>✓</div>
              <div style={{ color: '#22C55E', fontSize: 24, fontWeight: 800 }}>All Orders Done</div>
              <div style={{ color: '#475569', fontSize: 14, marginTop: 8 }}>Waiting for new orders...</div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {orders.map(order => {
              const colors   = getAccentColor(order.kots)
              const allReady = order.kots.every(k => k.status === 'ready')
              const elapsed  = getElapsed(order.kots[0].created_at)

              return (
                <div key={order.orderId} style={{ background: '#161B22', borderRadius: 16, overflow: 'hidden', border: '1.5px solid ' + colors.border, opacity: allReady ? 0.5 : 1, transition: 'opacity 0.3s' }}>
                  <div style={{ background: colors.bg, borderBottom: '1px solid ' + colors.border, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ color: '#F8FAFC', fontWeight: 900, fontSize: 22, letterSpacing: -0.5 }}>{getOrderLabel(order)}</div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: colors.badge, background: 'rgba(0,0,0,0.3)', padding: '3px 9px', borderRadius: 99, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          {order.orderType?.replace('_', ' ')}
                        </span>
                      </div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', marginTop: 4 }}>
                        {allReady ? 'All Ready' : `${order.kots.filter(k => k.status !== 'ready').length} pending`}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: colors.badge, fontWeight: 900, fontSize: 20 }}>{elapsed} min</div>
                      <div style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>{formatTime(order.kots[0].created_at)}</div>
                    </div>
                  </div>

                  <div style={{ padding: '14px 18px' }}>
                    {order.kots.map((kot, kotIdx) => {
                      const isReady = kot.status === 'ready'
                      return (
                        <div key={kot.id} style={{ marginTop: kotIdx > 0 ? 16 : 0 }}>
                          {order.kots.length > 1 && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                                KOT {kotIdx + 1} · {formatTime(kot.created_at)}
                              </div>
                              {isReady && <span style={{ fontSize: 10, fontWeight: 700, color: '#22C55E', background: 'rgba(34,197,94,0.1)', padding: '2px 8px', borderRadius: 99 }}>READY</span>}
                            </div>
                          )}

                          {kot.kot_items.map(kotItem => {
                            const name     = kotItem.order_items?.menu_items?.name
                            const qty      = kotItem.order_items?.quantity
                            const notes    = kotItem.order_items?.notes
                            const priority = kotItem.order_items?.menu_items?.priority ?? 2
                            const catId    = kotItem.order_items?.menu_items?.category_id
                            const catPos   = categoryOrder[catId] ?? 999

                            return (
                              <div key={kotItem.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #21262D', opacity: isReady ? 0.35 : 1 }}>
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ color: '#F8FAFC', fontSize: 17, fontWeight: 700, textDecoration: isReady ? 'line-through' : 'none' }}>{name}</div>
                                    {priority === 1 && <span style={{ fontSize: 9, fontWeight: 800, background: '#7F1D1D', color: '#FCA5A5', padding: '2px 6px', borderRadius: 99 }}>P1</span>}
                                    {priority === 3 && <span style={{ fontSize: 9, fontWeight: 800, background: '#14532D', color: '#86EFAC', padding: '2px 6px', borderRadius: 99 }}>P3</span>}
                                  </div>
                                  {notes && <div style={{ fontSize: 12, color: '#F59E0B', marginTop: 3 }}>{notes}</div>}
                                </div>
                                <div style={{ background: '#21262D', border: '1px solid #30363D', color: '#F8FAFC', fontWeight: 900, fontSize: 18, borderRadius: 8, padding: '4px 12px', minWidth: 44, textAlign: 'center' }}>
                                  ×{qty}
                                </div>
                              </div>
                            )
                          })}

                          {!isReady && (
                            <button onClick={() => markKOTDone(kot.id)}
                              style={{ width: '100%', marginTop: 12, background: '#22C55E', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer', letterSpacing: 0.3 }}>
                              ✓ Mark as Done
                            </button>
                          )}
                          {order.kots.length === 1 && isReady && (
                            <div style={{ textAlign: 'center', color: '#22C55E', fontWeight: 700, fontSize: 13, paddingTop: 12 }}>✓ Ready</div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── BATCH VIEW ── */}
      {activeView === 'batch' && (
        <>
          <div style={{ color: '#94A3B8', fontSize: 13, marginBottom: 16, background: '#161B22', borderRadius: 10, padding: '10px 16px', border: '1px solid #30363D' }}>
            🔥 <strong style={{ color: '#D4A853' }}>Batch View</strong> — Same items ordered across multiple tables in the last <strong style={{ color: '#fff' }}>5 minutes</strong>. Sorted by category priority. Cook them all together!
          </div>

          {batchItems.length === 0 ? (
            <div style={{ textAlign: 'center', marginTop: 80 }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🍳</div>
              <div style={{ color: '#475569', fontSize: 16, fontWeight: 700 }}>No batch items right now</div>
              <div style={{ color: '#334155', fontSize: 13, marginTop: 8 }}>Items will appear here when the same dish is ordered from multiple tables within 5 minutes</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {batchItems.map(batch => (
                <div key={batch.name} style={{ background: '#161B22', borderRadius: 16, overflow: 'hidden', border: '1.5px solid #D4A853' }}>
                  <div style={{ background: '#78350F', borderBottom: '1px solid #D4A853', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ color: '#F8FAFC', fontWeight: 900, fontSize: 20 }}>{batch.name}</div>
                      <div style={{ fontSize: 11, color: '#FCD34D', marginTop: 3, fontWeight: 600 }}>{batch.entries.length} orders · Cook all together</div>
                    </div>
                    <div style={{ background: '#D4A853', color: '#092b33', fontWeight: 900, fontSize: 28, borderRadius: 12, padding: '6px 16px', minWidth: 60, textAlign: 'center' }}>
                      ×{batch.totalQty}
                    </div>
                  </div>
                  <div style={{ padding: '14px 18px' }}>
                    {batch.entries.map((entry, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < batch.entries.length - 1 ? '1px solid #21262D' : 'none' }}>
                        <div style={{ color: '#F8FAFC', fontSize: 14, fontWeight: 600 }}>
                          {entry.orderType === 'dine_in' ? `Table ${entry.tableNumber}` : entry.customerName || entry.orderType}
                        </div>
                        <div style={{ background: '#21262D', border: '1px solid #30363D', color: '#F8FAFC', fontWeight: 900, fontSize: 16, borderRadius: 8, padding: '4px 12px', minWidth: 44, textAlign: 'center' }}>
                          ×{entry.qty}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}