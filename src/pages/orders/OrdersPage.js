import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

export function NewOrderPage() {
  const [searchParams]  = useSearchParams()
  const tableId         = searchParams.get('table')
  const tableNumber     = searchParams.get('tableNumber')
  const navigate        = useNavigate()
  const { profile }     = useAuth()

  const [categories, setCategories]         = useState([])
  const [items, setItems]                   = useState([])
  const [activeCategory, setActiveCategory] = useState(null)
  const [cart, setCart]                     = useState([])
  const [loading, setLoading]               = useState(true)
  const [submitting, setSubmitting]         = useState(false)
  const [covers, setCovers]                 = useState(1)

  useEffect(() => { fetchMenu() }, [])

  async function fetchMenu() {
    const { data: cats } = await supabase
      .from('menu_categories').select('*').eq('is_active', true).order('sort_order')
    const { data: menuItems } = await supabase
      .from('menu_items').select('*').eq('is_available', true).order('sort_order')
    setCategories(cats || [])
    setItems(menuItems || [])
    if (cats && cats.length > 0) setActiveCategory(cats[0].id)
    setLoading(false)
  }

  function getItemsForCategory(categoryId) {
    return items.filter(i => i.category_id === categoryId)
  }

  function addToCart(item) {
    setCart(prev => {
      const existing = prev.find(c => c.item.id === item.id)
      if (existing) return prev.map(c => c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)
      return [...prev, { item, quantity: 1, notes: '' }]
    })
  }

  function removeFromCart(itemId) {
    setCart(prev => {
      const existing = prev.find(c => c.item.id === itemId)
      if (existing && existing.quantity > 1) return prev.map(c => c.item.id === itemId ? { ...c, quantity: c.quantity - 1 } : c)
      return prev.filter(c => c.item.id !== itemId)
    })
  }

  function getCartQuantity(itemId) {
    return cart.find(c => c.item.id === itemId)?.quantity || 0
  }

  const cartTotal = cart.reduce((sum, c) => sum + c.item.price * c.quantity, 0)
  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0)

  async function fireKOT() {
    if (cart.length === 0) return
    setSubmitting(true)
    try {
      await supabase.from('cafe_tables').update({ status: 'occupied', captain_id: profile.id }).eq('id', tableId)

      const { data: order, error: orderError } = await supabase
        .from('orders').insert({ table_id: tableId, captain_id: profile.id, order_type: 'dine_in', covers }).select().single()
      if (orderError) throw orderError

      const orderItems = cart.map(c => ({
        order_id: order.id, item_id: c.item.id, quantity: c.quantity,
        unit_price: c.item.price, notes: c.notes, status: 'pending',
      }))
      const { data: createdItems, error: itemsError } = await supabase.from('order_items').insert(orderItems).select()
      if (itemsError) throw itemsError

      const { data: kot, error: kotError } = await supabase
        .from('kots').insert({ order_id: order.id, status: 'pending' }).select().single()
      if (kotError) throw kotError

      const kotItems = createdItems.map(oi => ({ kot_id: kot.id, order_item_id: oi.id, is_done: false }))
      await supabase.from('kot_items').insert(kotItems)

      navigate('/tables')
    } catch (err) {
      console.error('Error firing KOT:', err)
      alert('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div style={{ padding: 40, color: '#94A3B8' }}>Loading menu...</div>

  return (
    <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 80px)' }}>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ background: '#0F172A', borderRadius: 12, padding: '12px 18px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>Table {tableNumber}</div>
            <div style={{ color: '#64748B', fontSize: 12 }}>New Order</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: '#94A3B8', fontSize: 12 }}>Covers:</span>
            <button onClick={() => setCovers(c => Math.max(1, c - 1))} style={{ background: '#1E293B', border: 'none', color: '#fff', width: 28, height: 28, borderRadius: 6, cursor: 'pointer', fontSize: 16 }}>-</button>
            <span style={{ color: '#fff', fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{covers}</span>
            <button onClick={() => setCovers(c => c + 1)} style={{ background: '#1E293B', border: 'none', color: '#fff', width: 28, height: 28, borderRadius: 6, cursor: 'pointer', fontSize: 16 }}>+</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14, overflowX: 'auto', paddingBottom: 4 }}>
          {categories.map(cat => (
            <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
              style={{ background: activeCategory === cat.id ? '#0F172A' : '#fff', color: activeCategory === cat.id ? '#fff' : '#64748B', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
              {cat.name}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
            {getItemsForCategory(activeCategory).map(item => {
              const qty = getCartQuantity(item.id)
              return (
                <div key={item.id} style={{ background: '#fff', borderRadius: 10, padding: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', border: qty > 0 ? '2px solid #0F766E' : '2px solid transparent' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, border: '2px solid ' + (item.food_type === 'veg' ? '#15803D' : '#B91C1C'), background: item.food_type === 'veg' ? '#15803D' : '#B91C1C', flexShrink: 0, marginTop: 3 }} />
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#1E293B', lineHeight: 1.3 }}>{item.name}</div>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: '#1E293B', marginBottom: 10 }}>₹{item.price}</div>
                  {qty === 0 ? (
                    <button onClick={() => addToCart(item)} style={{ width: '100%', background: '#0F172A', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ Add</button>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0F766E', borderRadius: 6, overflow: 'hidden' }}>
                      <button onClick={() => removeFromCart(item.id)} style={{ background: 'none', border: 'none', color: '#fff', padding: '7px 14px', fontSize: 18, cursor: 'pointer', fontWeight: 700 }}>-</button>
                      <span style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>{qty}</span>
                      <button onClick={() => addToCart(item)} style={{ background: 'none', border: 'none', color: '#fff', padding: '7px 14px', fontSize: 18, cursor: 'pointer', fontWeight: 700 }}>+</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div style={{ width: 280, background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: '#1E293B', marginBottom: 14 }}>
          Order Summary {cartCount > 0 && <span style={{ background: '#0F766E', color: '#fff', borderRadius: 20, padding: '1px 8px', fontSize: 12 }}>{cartCount}</span>}
        </div>
        {cart.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 13, textAlign: 'center' }}>
            No items added yet.<br />Tap items from the menu.
          </div>
        ) : (
          <>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {cart.map(c => (
                <div key={c.item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#1E293B' }}>{c.item.name}</div>
                    <div style={{ fontSize: 12, color: '#94A3B8' }}>₹{c.item.price} × {c.quantity}</div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#1E293B' }}>₹{c.item.price * c.quantity}</div>
                </div>
              ))}
            </div>
            <div style={{ borderTop: '2px solid #F1F5F9', paddingTop: 12, marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontWeight: 700, color: '#1E293B' }}>Total</span>
                <span style={{ fontWeight: 800, fontSize: 18, color: '#1E293B' }}>₹{cartTotal}</span>
              </div>
              <button onClick={fireKOT} disabled={submitting}
                style={{ width: '100%', background: submitting ? '#94A3B8' : '#0F766E', color: '#fff', border: 'none', borderRadius: 8, padding: '13px', fontSize: 15, fontWeight: 800, cursor: submitting ? 'not-allowed' : 'pointer' }}>
                {submitting ? 'Sending to Kitchen...' : '🔥 Fire KOT'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function OrdersPage() {
  const [orders, setOrders]   = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => { fetchOrders() }, [])

  async function fetchOrders() {
    const { data, error } = await supabase
      .from('orders').select('*, cafe_tables(number), staff(name)')
      .eq('status', 'active').order('created_at', { ascending: false })
    if (!error) setOrders(data)
    setLoading(false)
  }

  if (loading) return <div style={{ padding: 40, color: '#94A3B8' }}>Loading orders...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1E293B', margin: 0 }}>Active Orders</h1>
          <p style={{ color: '#64748B', fontSize: 14, marginTop: 4 }}>{orders.length} active order{orders.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => navigate('/tables')} style={{ background: '#0F172A', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          + New Order via Tables
        </button>
      </div>
      {orders.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', color: '#94A3B8', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
          No active orders right now. Go to Tables to start a new order.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {orders.map(order => (
            <div key={order.id} onClick={() => navigate('/orders/table/' + order.table_id)}
              style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 44, height: 44, background: '#FEF3C7', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, color: '#B45309' }}>
                T{order.cafe_tables?.number}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#1E293B' }}>Table {order.cafe_tables?.number}</div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>Captain: {order.staff?.name} · {order.covers} cover{order.covers !== 1 ? 's' : ''}</div>
              </div>
              <div style={{ fontSize: 12, color: '#94A3B8' }}>{new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}