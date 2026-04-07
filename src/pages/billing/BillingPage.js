import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { theme } from '../../lib/theme'

export default function BillingPage() {
  const [orders, setOrders]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [clubMode, setClubMode]     = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    fetchOrders()
    const channel = supabase
      .channel('billing-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function fetchOrders() {
    const { data } = await supabase
      .from('orders')
      .select(`id, order_type, covers, created_at, customer_name, room_number, cafe_tables(number, name), staff(name), order_items(quantity, unit_price)`)
      .eq('status', 'active').order('created_at')
    setOrders(data || [])
    setLoading(false)
  }

  function getTotal(order) {
    return (order.order_items || []).reduce((sum, i) => sum + i.quantity * i.unit_price, 0)
  }

  function getElapsed(dateString) {
    const diff = Math.floor((new Date() - new Date(dateString)) / 60000)
    if (diff < 60) return diff + 'm'
    return Math.floor(diff / 60) + 'h ' + (diff % 60) + 'm'
  }

  function toggleSelect(id) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function handleCardClick(order) {
    if (clubMode) { toggleSelect(order.id); return }
    navigate('/billing/order/' + order.id)
  }

  function generateCombinedBill() {
    if (selectedIds.length < 2) return
    const [primary, ...rest] = selectedIds
    navigate('/billing/order/' + primary + '?club=' + rest.join(','))
  }

  const ORDER_TYPE_ICON = { dine_in: '🪑', takeaway: '🛍️', delivery: '🚚' }
  const clubTotal = orders.filter(o => selectedIds.includes(o.id)).reduce((s, o) => s + getTotal(o), 0)

  if (loading) return <div style={{ padding: 40, color: theme.textLight }}>Loading...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: theme.textDark, margin: 0 }}>Billing</h1>
          <p style={{ color: theme.textLight, fontSize: 14, marginTop: 4 }}>{orders.length} active order{orders.length !== 1 ? 's' : ''} pending bill</p>
        </div>
        {orders.length >= 2 && (
          <button onClick={() => { setClubMode(m => !m); setSelectedIds([]) }}
            style={{ background: clubMode ? '#6b1f1f' : '#fff', color: clubMode ? '#fff' : '#6b1f1f', border: '2px solid #6b1f1f', borderRadius: 9, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {clubMode ? '✕ Cancel Club' : '🔗 Club Bills'}
          </button>
        )}
      </div>

      {clubMode && (
        <div style={{ background: '#fdf9f9', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, color: '#a93226', fontWeight: 600 }}>
            {selectedIds.length === 0 ? 'Select 2 or more tables to club their bills together' :
             selectedIds.length === 1 ? '1 table selected — select at least 1 more' :
             `${selectedIds.length} tables selected · Combined total: ₹${clubTotal.toFixed(2)}`}
          </div>
          {selectedIds.length >= 2 && (
            <button onClick={generateCombinedBill}
              style={{ background: '#6b1f1f', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', marginLeft: 16 }}>
              Generate Combined Bill →
            </button>
          )}
        </div>
      )}

      {orders.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 14, padding: 56, textAlign: 'center', border: '1px solid ' + theme.border }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🧾</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: theme.textDark, marginBottom: 6 }}>No pending bills</div>
          <div style={{ fontSize: 13, color: theme.textLight }}>All tables are cleared</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
          {orders.map(order => {
            const total = getTotal(order)
            const elapsed = getElapsed(order.created_at)
            const label = order.cafe_tables ? (order.cafe_tables.name || 'Table ' + order.cafe_tables.number) : order.customer_name || 'Order'
            const isSelected = selectedIds.includes(order.id)
            return (
              <div key={order.id} onClick={() => handleCardClick(order)}
                style={{ background: '#fff', borderRadius: 14, border: '2px solid ' + (isSelected ? '#6b1f1f' : theme.border), overflow: 'hidden', cursor: 'pointer', boxShadow: isSelected ? '0 0 0 3px rgba(9,43,51,0.15)' : '0 1px 4px rgba(0,0,0,0.05)', transition: 'all 0.15s', position: 'relative' }}
                onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.borderColor = theme.primary; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.1)' }}}
                onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.borderColor = theme.border; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)' }}}>
                {/* Club mode checkbox */}
                {clubMode && (
                  <div style={{ position: 'absolute', top: 10, right: 10, width: 22, height: 22, borderRadius: 6, background: isSelected ? '#6b1f1f' : '#fff', border: '2px solid ' + (isSelected ? '#6b1f1f' : '#D1D5DB'), display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                    {isSelected && <span style={{ color: '#fff', fontSize: 13, fontWeight: 900 }}>✓</span>}
                  </div>
                )}
                <div style={{ background: theme.bgWarm, padding: '16px 18px', borderBottom: '1px solid ' + theme.border }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 18, color: theme.textDark }}>{label}</div>
                      <div style={{ fontSize: 11, color: theme.textLight, marginTop: 3 }}>
                        {ORDER_TYPE_ICON[order.order_type]} {order.order_type?.replace('_', ' ')} · {order.covers} cover{order.covers !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: theme.textLight, fontWeight: 600 }}>⏱ {elapsed}</div>
                  </div>
                </div>
                <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 11, color: theme.textLight, fontWeight: 600 }}>Total</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: theme.textDark }}>₹{total.toFixed(2)}</div>
                  </div>
                  {!clubMode && (
                    <div style={{ background: '#6b1f1f', color: '#fff', borderRadius: 9, padding: '8px 16px', fontSize: 12, fontWeight: 700 }}>
                      Generate Bill →
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}