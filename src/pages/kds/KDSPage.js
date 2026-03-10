import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function KDSPage() {
  const [orders, setOrders] = useState([])
  const [time, setTime]     = useState('')

  useEffect(() => {
    updateClock()
    fetchKOTs()

    const channel = supabase
      .channel('kds-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'kots' },  () => fetchKOTs())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'kots' },  () => fetchKOTs())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => fetchKOTs())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => fetchKOTs())
      .subscribe((status) => {
        console.log('KDS realtime status:', status)
      })

    const clockTimer   = setInterval(updateClock, 1000)
    const refreshTimer = setInterval(fetchKOTs, 30000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(clockTimer)
      clearInterval(refreshTimer)
    }
  }, [])

  function updateClock() {
    setTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }))
  }

  async function fetchKOTs() {
    const { data, error } = await supabase
      .from('kots')
      .select(`
        id, status, created_at,
        orders ( id, order_type, customer_name, covers, cafe_tables ( number ) ),
        kot_items (
          id,
          order_items ( quantity, notes, menu_items ( name ) )
        )
      `)
      .in('status', ['pending', 'in_progress', 'ready'])
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at')

    if (error) return

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

    setOrders(Object.values(orderMap))
  }

  function getElapsed(createdAt) {
    return Math.floor((new Date() - new Date(createdAt)) / 60000)
  }

  function formatTime(ts) {
    return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  }

  function getOrderLabel(order) {
    if (order.orderType === 'dine_in')  return 'Table ' + order.tableNumber
    if (order.orderType === 'takeaway') return order.customerName ? order.customerName : 'Takeaway'
    if (order.orderType === 'delivery') return order.customerName ? order.customerName : 'Delivery'
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ background: '#D4A853', borderRadius: 12, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 22 }}>☕</span>
          </div>
          <div>
            <div style={{ color: '#F8FAFC', fontWeight: 800, fontSize: 20, letterSpacing: -0.5 }}>Bambini Cafe — Kitchen</div>
            <div style={{ fontSize: 13, marginTop: 2 }}>
              {pendingCount === 0
                ? <span style={{ color: '#22C55E', fontWeight: 600 }}>✓ All clear</span>
                : <span style={{ color: '#94A3B8' }}>{pendingCount} order{pendingCount !== 1 ? 's' : ''} pending</span>}
            </div>
          </div>
        </div>
        <div style={{ background: '#161B22', border: '1px solid #30363D', borderRadius: 12, padding: '10px 20px' }}>
          <div style={{ color: '#F8FAFC', fontSize: 24, fontWeight: 800, fontFamily: 'monospace', letterSpacing: 1, textTransform: 'uppercase' }}>{time}</div>
        </div>
      </div>

      {/* Empty state */}
      {orders.length === 0 && (
        <div style={{ textAlign: 'center', marginTop: 100 }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(34,197,94,0.1)', border: '2px solid #22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 32 }}>✓</div>
          <div style={{ color: '#22C55E', fontSize: 24, fontWeight: 800 }}>All Orders Done</div>
          <div style={{ color: '#475569', fontSize: 14, marginTop: 8 }}>Waiting for new orders...</div>
        </div>
      )}

      {/* Order Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
        {orders.map(order => {
          const colors   = getAccentColor(order.kots)
          const allReady = order.kots.every(k => k.status === 'ready')
          const elapsed  = getElapsed(order.kots[0].created_at)

          return (
            <div key={order.orderId} style={{ background: '#161B22', borderRadius: 16, overflow: 'hidden', border: '1.5px solid ' + colors.border, opacity: allReady ? 0.5 : 1, transition: 'opacity 0.3s' }}>

              {/* Card header */}
              <div style={{ background: colors.bg, borderBottom: '1px solid ' + colors.border, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: '#F8FAFC', fontWeight: 900, fontSize: 22, letterSpacing: -0.5 }}>{getOrderLabel(order)}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: colors.badge, background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: 99, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {order.orderType?.replace('_', ' ')}
                    </span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8' }}>
                      {allReady ? '· All Ready' : `· ${order.kots.filter(k => k.status !== 'ready').length} pending`}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: colors.badge, fontWeight: 900, fontSize: 20 }}>{elapsed} min</div>
                  <div style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>{formatTime(order.kots[0].created_at)}</div>
                </div>
              </div>

              {/* KOTs */}
              <div style={{ padding: '14px 18px' }}>
                {order.kots.map((kot, kotIdx) => {
                  const isReady = kot.status === 'ready'
                  return (
                    <div key={kot.id} style={{ marginTop: kotIdx > 0 ? 16 : 0 }}>

                      {/* KOT label */}
                      {order.kots.length > 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                            KOT {kotIdx + 1} · {formatTime(kot.created_at)}
                          </div>
                          {isReady && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#22C55E', background: 'rgba(34,197,94,0.1)', padding: '2px 8px', borderRadius: 99 }}>READY</span>
                          )}
                        </div>
                      )}

                      {/* Items */}
                      {kot.kot_items.map(kotItem => {
                        const name  = kotItem.order_items?.menu_items?.name
                        const qty   = kotItem.order_items?.quantity
                        const notes = kotItem.order_items?.notes
                        return (
                          <div key={kotItem.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #21262D', opacity: isReady ? 0.35 : 1 }}>
                            <div>
                              <div style={{ color: '#F8FAFC', fontSize: 17, fontWeight: 700, textDecoration: isReady ? 'line-through' : 'none' }}>{name}</div>
                              {notes && <div style={{ fontSize: 12, color: '#F59E0B', marginTop: 3 }}>{notes}</div>}
                            </div>
                            <div style={{ background: '#21262D', border: '1px solid #30363D', color: '#F8FAFC', fontWeight: 900, fontSize: 18, borderRadius: 8, padding: '4px 12px', minWidth: 44, textAlign: 'center' }}>
                              ×{qty}
                            </div>
                          </div>
                        )
                      })}

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
    </div>
  )
}