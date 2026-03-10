import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { theme } from '../../lib/theme'

const ORDER_TYPES = {
  dine_in:  { label: 'Dine In',  icon: '🪑', color: '#0D9488' },
  takeaway: { label: 'Takeaway', icon: '🛍️', color: '#D4A853' },
  delivery: { label: 'Delivery', icon: '🚚', color: '#7C3AED' },
}

export function NewOrderPage() {
  const [searchParams]  = useSearchParams()
  const tableId         = searchParams.get('table')
  const tableNumber     = searchParams.get('tableNumber')
  const navigate        = useNavigate()
  const { profile }     = useAuth()

  const [orderType, setOrderType]           = useState(tableId ? 'dine_in' : 'takeaway')
  const [categories, setCategories]         = useState([])
  const [items, setItems]                   = useState([])
  const [activeCategory, setActiveCategory] = useState(null)
  const [cart, setCart]                     = useState([])
  const [loading, setLoading]               = useState(true)
  const [submitting, setSubmitting]         = useState(false)
  const [covers, setCovers]                 = useState(1)
  const [held, setHeld]                     = useState(false)
  const [existingOrder, setExistingOrder]   = useState(null)
  const [existingKOTs, setExistingKOTs]     = useState([])
  const [runningTotal, setRunningTotal]     = useState(0)
  const [mobileTab, setMobileTab]           = useState('menu') // 'menu' | 'order'

  const [customerName, setCustomerName]   = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [roomNumber, setRoomNumber]       = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchMenu()
    if (tableId) fetchExistingOrder()
  }, [tableId])

  async function fetchMenu() {
    const { data: cats }      = await supabase.from('menu_categories').select('*').eq('is_active', true).order('sort_order')
    const { data: menuItems } = await supabase.from('menu_items').select('*').eq('is_available', true).order('sort_order')
    setCategories(cats || [])
    setItems(menuItems || [])
    if (cats && cats.length > 0) setActiveCategory(cats[0].id)
    setLoading(false)
  }

  async function fetchExistingOrder() {
    const { data: order } = await supabase
      .from('orders').select('*').eq('table_id', tableId).eq('status', 'active').single()
    if (!order) return
    setExistingOrder(order)
    setCovers(order.covers)
    const { data: kots } = await supabase
      .from('kots')
      .select(`id, status, created_at, kot_number, kot_items (id, is_done, order_items ( quantity, unit_price, notes, menu_items ( name ) ))`)
      .eq('order_id', order.id).order('created_at')
    setExistingKOTs(kots || [])
    const { data: orderItems } = await supabase.from('order_items').select('quantity, unit_price').eq('order_id', order.id)
    const total = (orderItems || []).reduce((sum, i) => sum + i.quantity * i.unit_price, 0)
    setRunningTotal(total)
  }

  function getItemsForCategory(categoryId) {
    let filtered = items.filter(i => i.category_id === categoryId)
    if (search) filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    return filtered
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

  async function markKOTReady(kotId) {
    await supabase.from('kots').update({ status: 'ready' }).eq('id', kotId)
    await fetchExistingOrder()
  }

  async function fireKOT(hold = false) {
    if (cart.length === 0) return
    setSubmitting(true)
    try {
      let orderId = existingOrder?.id
      if (!orderId) {
        if (tableId) {
          await supabase.from('cafe_tables').update({ status: 'occupied', captain_id: profile.id }).eq('id', tableId)
        }
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .insert({ table_id: tableId || null, captain_id: profile.id, order_type: orderType, covers, customer_name: customerName || null, customer_phone: customerPhone || null, room_number: roomNumber || null, status: 'active' })
          .select().single()
        if (orderError) throw orderError
        orderId = order.id
        setExistingOrder(order)
      }
      if (hold) { setHeld(true); setSubmitting(false); return }
      const orderItems = cart.map(c => ({ order_id: orderId, item_id: c.item.id, quantity: c.quantity, unit_price: c.item.price, notes: c.notes, status: 'pending' }))
      const { data: createdItems, error: itemsError } = await supabase.from('order_items').insert(orderItems).select()
      if (itemsError) throw itemsError
      const { data: kot, error: kotError } = await supabase.from('kots').insert({ order_id: orderId, status: 'pending' }).select().single()
      if (kotError) throw kotError
      await supabase.from('kot_items').insert(createdItems.map(oi => ({ kot_id: kot.id, order_item_id: oi.id, is_done: false })))
      setCart([])
      await fetchExistingOrder()
    } catch (err) {
      console.error('Error firing KOT:', err)
      alert('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div style={{ padding: 40, color: theme.textLight }}>Loading menu...</div>

  const displayItems = search
    ? items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    : getItemsForCategory(activeCategory)

  // ── SHARED PANELS ──────────────────────────────────────────────

  const menuPanel = (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
      {/* Order type + table info */}
      <div style={{ background: '#092b33', borderRadius: 12, padding: '12px 16px', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>
            {tableId ? `Table ${tableNumber}` : 'New Order'}
            {existingOrder && <span style={{ fontSize: 11, color: '#D4A853', marginLeft: 8, fontWeight: 600 }}>● Active</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Covers:</span>
            <button onClick={() => setCovers(c => Math.max(1, c - 1))} style={{ background: '#1E3A3A', border: 'none', color: '#fff', width: 26, height: 26, borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>-</button>
            <span style={{ color: '#fff', fontWeight: 700, minWidth: 18, textAlign: 'center', fontSize: 13 }}>{covers}</span>
            <button onClick={() => setCovers(c => c + 1)} style={{ background: '#1E3A3A', border: 'none', color: '#fff', width: 26, height: 26, borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>+</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {Object.entries(ORDER_TYPES).map(([key, cfg]) => (
            <button key={key} onClick={() => setOrderType(key)}
              style={{ flex: 1, background: orderType === key ? cfg.color : 'rgba(255,255,255,0.07)', color: orderType === key ? '#fff' : 'rgba(255,255,255,0.5)', border: 'none', borderRadius: 8, padding: '7px 0', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              {cfg.icon} {cfg.label}
            </button>
          ))}
        </div>
        {orderType !== 'dine_in' && !existingOrder && (
          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {orderType === 'delivery' && (
              <input value={roomNumber} onChange={e => setRoomNumber(e.target.value)} placeholder="Room / Villa No."
                style={{ flex: 1, minWidth: 100, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, padding: '7px 10px', fontSize: 12, color: '#fff', outline: 'none' }} />
            )}
            <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Customer Name"
              style={{ flex: 2, minWidth: 120, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, padding: '7px 10px', fontSize: 12, color: '#fff', outline: 'none' }} />
            <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Phone"
              style={{ flex: 1, minWidth: 100, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7, padding: '7px 10px', fontSize: 12, color: '#fff', outline: 'none' }} />
          </div>
        )}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search menu items..."
          style={{ width: '100%', background: '#fff', border: '1px solid ' + theme.border, borderRadius: 9, padding: '9px 14px 9px 36px', fontSize: 13, color: theme.textDark, outline: 'none', boxSizing: 'border-box' }} />
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: theme.textLight }}>🔍</span>
      </div>

      {/* Category tabs */}
      {!search && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto', paddingBottom: 4, flexShrink: 0 }}>
          {categories.map(cat => (
            <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
              style={{ background: activeCategory === cat.id ? '#092b33' : '#fff', color: activeCategory === cat.id ? '#fff' : theme.textMid, border: '1px solid ' + theme.border, borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Menu grid */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
          {displayItems.map(item => {
            const qty = getCartQuantity(item.id)
            return (
              <div key={item.id} style={{ background: '#fff', borderRadius: 10, padding: 12, border: qty > 0 ? '2px solid #0D9488' : '1px solid ' + theme.border, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 6 }}>
                  <div style={{ width: 9, height: 9, borderRadius: 2, border: '2px solid ' + (item.food_type === 'veg' ? '#15803D' : '#B91C1C'), background: item.food_type === 'veg' ? '#15803D' : '#B91C1C', flexShrink: 0, marginTop: 3 }} />
                  <div style={{ fontWeight: 700, fontSize: 12, color: theme.textDark, lineHeight: 1.3 }}>{item.name}</div>
                </div>
                <div style={{ fontWeight: 800, fontSize: 13, color: theme.textDark, marginBottom: 8 }}>₹{item.price}</div>
                {qty === 0 ? (
                  <button onClick={() => addToCart(item)} style={{ width: '100%', background: '#092b33', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 0', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ Add</button>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#0D9488', borderRadius: 6, overflow: 'hidden' }}>
                    <button onClick={() => removeFromCart(item.id)} style={{ background: 'none', border: 'none', color: '#fff', padding: '6px 12px', fontSize: 16, cursor: 'pointer', fontWeight: 700 }}>-</button>
                    <span style={{ color: '#fff', fontWeight: 800, fontSize: 13 }}>{qty}</span>
                    <button onClick={() => addToCart(item)} style={{ background: 'none', border: 'none', color: '#fff', padding: '6px 12px', fontSize: 16, cursor: 'pointer', fontWeight: 700 }}>+</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  const orderPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
      {/* Header */}
      <div style={{ background: '#092b33', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '12px 12px 0 0' }}>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>Order Summary</div>
        {runningTotal > 0 && <div style={{ color: '#D4A853', fontWeight: 800, fontSize: 13 }}>₹{runningTotal} total</div>}
      </div>

      {/* Existing KOTs */}
      {existingKOTs.length > 0 && (
        <div style={{ borderBottom: '2px solid ' + theme.border, overflowY: 'auto', maxHeight: 220 }}>
          {existingKOTs.map((kot, idx) => (
            <div key={kot.id} style={{ padding: '10px 14px', borderBottom: '1px solid ' + theme.bgWarm }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                KOT {idx + 1} · {new Date(kot.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                <span style={{ marginLeft: 8, background: kot.status === 'ready' ? theme.greenBg : theme.yellowBg, color: kot.status === 'ready' ? theme.green : theme.yellow, padding: '1px 6px', borderRadius: 10, fontSize: 9 }}>
                  {kot.status}
                </span>
              </div>
              {kot.kot_items.map((ki, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: theme.textMid, padding: '2px 0' }}>
                  <span>{ki.order_items?.menu_items?.name}</span>
                  <span style={{ color: theme.textLight }}>×{ki.order_items?.quantity}</span>
                </div>
              ))}
              {kot.status !== 'ready' ? (
                <button onClick={() => markKOTReady(kot.id)}
                  style={{ width: '100%', marginTop: 8, background: '#DCFCE7', color: '#15803D', border: '1px solid #86EFAC', borderRadius: 7, padding: '7px 0', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  ✓ Mark as Ready
                </button>
              ) : (
                <div style={{ width: '100%', marginTop: 8, background: '#DCFCE7', color: '#15803D', border: '1px solid #86EFAC', borderRadius: 7, padding: '7px 0', fontSize: 11, fontWeight: 700, textAlign: 'center' }}>
                  ✓ Ready
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Cart items */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
        {cart.length === 0 ? (
          <div style={{ textAlign: 'center', color: theme.textMuted, fontSize: 12, marginTop: 20 }}>
            {existingKOTs.length > 0 ? 'Add items for next round' : 'Tap items to add to order'}
          </div>
        ) : (
          <>
            {existingKOTs.length > 0 && (
              <div style={{ fontSize: 10, fontWeight: 700, color: theme.primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>New Round</div>
            )}
            {cart.map(c => (
              <div key={c.item.id} style={{ padding: '8px 0', borderBottom: '1px solid ' + theme.bgWarm }}>
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <div style={{ flex: 1 }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: theme.textDark }}>{c.item.name}</div>
      <div style={{ fontSize: 11, color: theme.textLight }}>₹{c.item.price} × {c.quantity}</div>
    </div>
    <div style={{ fontWeight: 700, fontSize: 13, color: theme.textDark }}>₹{c.item.price * c.quantity}</div>
  </div>
  <input
    value={c.notes}
    onChange={e => setCart(prev => prev.map(ci => ci.item.id === c.item.id ? { ...ci, notes: e.target.value } : ci))}
    placeholder="Add note (e.g. no onion, extra spicy...)"
    style={{ width: '100%', marginTop: 6, background: '#F8F6F2', border: '1px solid ' + theme.border, borderRadius: 6, padding: '5px 10px', fontSize: 11, color: theme.textDark, outline: 'none', boxSizing: 'border-box' }}
  />
</div>
            ))}
          </>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ padding: '12px 14px', borderTop: '2px solid ' + theme.border, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {cart.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: theme.textMid }}>New items</span>
            <span style={{ fontWeight: 800, fontSize: 15, color: theme.textDark }}>₹{cartTotal}</span>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button onClick={() => fireKOT(true)} disabled={cart.length === 0 || submitting}
            style={{ background: cart.length === 0 ? theme.bgWarm : '#FEF3C7', color: cart.length === 0 ? theme.textMuted : '#B45309', border: '1px solid ' + (cart.length === 0 ? theme.border : '#FCD34D'), borderRadius: 8, padding: '10px 0', fontSize: 12, fontWeight: 700, cursor: cart.length === 0 ? 'not-allowed' : 'pointer' }}>
            ⏸ Hold
          </button>
          <button onClick={() => fireKOT(false)} disabled={cart.length === 0 || submitting}
            style={{ background: cart.length === 0 ? theme.bgWarm : '#0D9488', color: cart.length === 0 ? theme.textMuted : '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 12, fontWeight: 700, cursor: cart.length === 0 ? 'not-allowed' : 'pointer' }}>
            {submitting ? 'Sending...' : '🔥 KOT'}
          </button>
        </div>
        <button onClick={() => fireKOT(false)} disabled={cart.length === 0 || submitting}
          style={{ background: cart.length === 0 ? theme.bgWarm : '#092b33', color: cart.length === 0 ? theme.textMuted : '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 700, cursor: cart.length === 0 ? 'not-allowed' : 'pointer' }}>
          🔥 KOT & Print
        </button>
        {existingOrder && (
          <button onClick={() => navigate('/billing/order/' + existingOrder.id)}
            style={{ background: '#D4A853', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            ₹ Generate Bill
          </button>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* ── DESKTOP: side by side ── */}
      <div className="orders-desktop" style={{ display: 'flex', gap: 16, height: 'calc(100vh - 112px)' }}>
        {menuPanel}
        <div style={{ width: 290, background: '#fff', borderRadius: 12, border: '1px solid ' + theme.border, display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
          {orderPanel}
        </div>
      </div>

      {/* ── MOBILE: tabbed ── */}
      <div className="orders-mobile" style={{ display: 'none', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
        {/* Tab switcher */}
        <div style={{ display: 'flex', background: '#092b33', borderRadius: 10, padding: 4, marginBottom: 12, flexShrink: 0 }}>
          <button onClick={() => setMobileTab('menu')}
            style={{ flex: 1, padding: '8px 0', borderRadius: 7, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', background: mobileTab === 'menu' ? '#fff' : 'transparent', color: mobileTab === 'menu' ? '#092b33' : 'rgba(255,255,255,0.6)', transition: 'all 0.15s' }}>
            🍽 Menu
          </button>
          <button onClick={() => setMobileTab('order')}
            style={{ flex: 1, padding: '8px 0', borderRadius: 7, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', background: mobileTab === 'order' ? '#fff' : 'transparent', color: mobileTab === 'order' ? '#092b33' : 'rgba(255,255,255,0.6)', transition: 'all 0.15s', position: 'relative' }}>
            🧾 Order {cartCount > 0 && <span style={{ background: '#0D9488', color: '#fff', borderRadius: 10, fontSize: 10, padding: '1px 6px', marginLeft: 4 }}>{cartCount}</span>}
          </button>
        </div>

        {/* Active tab content */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {mobileTab === 'menu' ? menuPanel : (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid ' + theme.border, display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
              {orderPanel}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .orders-desktop { display: none !important; }
          .orders-mobile  { display: flex !important; }
        }
      `}</style>
    </>
  )
}

// ─── ORDERS LIST PAGE ──────────────────────────────────────────────────────────
export default function OrdersPage() {
  const [orders, setOrders]   = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => { fetchOrders() }, [])

  async function fetchOrders() {
    const { data, error } = await supabase
      .from('orders').select('*, cafe_tables(number), staff(name)').eq('status', 'active').order('created_at', { ascending: false })
    if (!error) setOrders(data)
    setLoading(false)
  }

  if (loading) return <div style={{ padding: 40, color: theme.textLight }}>Loading orders...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: theme.textDark, margin: 0 }}>Active Orders</h1>
          <p style={{ color: theme.textLight, fontSize: 14, marginTop: 4 }}>{orders.length} active order{orders.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => navigate('/tables')}
          style={{ background: '#092b33', color: '#fff', border: 'none', borderRadius: 9, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          + New Order
        </button>
      </div>

      {orders.length === 0 ? (
        <div style={{ ...theme.card, textAlign: 'center', padding: 48, color: theme.textLight }}>
          No active orders. Go to Tables to start a new order.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {orders.map(order => {
            const typeConfig = ORDER_TYPES[order.order_type] || ORDER_TYPES.dine_in
            return (
              <div key={order.id} onClick={() => navigate('/orders/new?table=' + order.table_id + '&tableNumber=' + order.cafe_tables?.number)}
                style={{ background: '#fff', borderRadius: 12, padding: '14px 18px', border: '1px solid ' + theme.border, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ width: 42, height: 42, background: typeConfig.color + '18', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                  {typeConfig.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: theme.textDark }}>
                    {order.cafe_tables ? 'Table ' + order.cafe_tables.number : order.customer_name || 'Order'}
                  </div>
                  <div style={{ fontSize: 12, color: theme.textLight, marginTop: 2 }}>
                    {typeConfig.label} · {order.covers} cover{order.covers !== 1 ? 's' : ''} · {order.staff?.name}
                  </div>
                </div>
                <div style={{ fontSize: 12, color: theme.textLight }}>
                  {new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}