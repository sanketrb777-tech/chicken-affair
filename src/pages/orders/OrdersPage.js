import { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { theme } from '../../lib/theme'
import { Trash2 } from 'lucide-react'

const ORDER_TYPES = {
  dine_in:  { label: 'Dine In',  icon: '🛋️', color: '#0D9488' },
  takeaway: { label: 'Takeaway', icon: '🛍️', color: '#D4A853' },
  delivery: { label: 'Delivery', icon: '🚚', color: '#7C3AED' },
}

export function NewOrderPage() {
  const [searchParams]  = useSearchParams()
  const tableId         = searchParams.get('table')
  const tableNumber     = searchParams.get('tableNumber')
  const typeParam       = searchParams.get('type')
  const navigate        = useNavigate()
  const { profile }     = useAuth()

  const [orderType, setOrderType]           = useState(tableId ? 'dine_in' : (typeParam || 'takeaway'))
  const [categories, setCategories]         = useState([])
  const [items, setItems]                   = useState([])
  const [portions, setPortions]             = useState({})
  const [variations, setVariations]         = useState({})
  const [addonGroups, setAddonGroups]       = useState({})
  const [activeCategory, setActiveCategory] = useState(null)
  const [cart, setCart]                     = useState([])
  const [loading, setLoading]               = useState(true)
  const [submitting, setSubmitting]         = useState(false)
  const [covers, setCovers]                 = useState(1)
  const [existingOrder, setExistingOrder]   = useState(null)
  const [existingKOTs, setExistingKOTs]     = useState([])
  const [runningTotal, setRunningTotal]     = useState(0)
  const [mobileTab, setMobileTab]           = useState('menu')
  const [search, setSearch]                 = useState('')
  const [customerName, setCustomerName]     = useState('')
  const [customerPhone, setCustomerPhone]   = useState('')
  const [roomNumber, setRoomNumber]         = useState('')

  const [pickerItem, setPickerItem]           = useState(null)
  const [pickerVariation, setPickerVariation] = useState(null)
  const [pickerAddons, setPickerAddons]       = useState({})

  // KOT item edit/delete (manager/owner only)
  const [editingKOTItem, setEditingKOTItem]   = useState(null) // { ki, kotIdx, itemIdx }
  const [editQty, setEditQty]                 = useState(1)
  const isManager = profile?.role === 'owner' || profile?.role === 'manager'

  const isOffTable = !tableId

  useEffect(() => {
    fetchMenu()
    if (tableId) fetchExistingOrder()
  }, [tableId])

  async function fetchMenu() {
    const [
      { data: cats },
      { data: menuItems },
      { data: allPortions },
      { data: allVariations },
      { data: allAddonGroups },
      { data: allAddons },
    ] = await Promise.all([
      supabase.from('menu_categories').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('menu_items').select('*').eq('is_available', true).order('sort_order'),
      supabase.from('item_portions').select('*').eq('is_available', true).order('sort_order'),
      supabase.from('item_variations').select('*').eq('is_available', true).order('sort_order'),
      supabase.from('item_addon_groups').select('*').order('sort_order'),
      supabase.from('item_addons').select('*').order('sort_order'),
    ])
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
    const todayDay = days[new Date().getDay()]
    const availableCats = (cats || []).filter(c => !c.available_days || c.available_days.length === 0 || c.available_days.includes(todayDay))
    setCategories(availableCats)

    const now = new Date()
    const nowMins = now.getHours() * 60 + now.getMinutes()
    const toMins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
    const timeFiltered = (menuItems || []).filter(item => {
      if (!item.available_from && !item.available_until) return true
      const from  = item.available_from  ? toMins(item.available_from)  : 0
      const until = item.available_until ? toMins(item.available_until) : 1439
      return nowMins >= from && nowMins <= until
    })
    setItems(timeFiltered)

    const portionMap = {}
    ;(allPortions || []).forEach(p => {
      if (!portionMap[p.menu_item_id]) portionMap[p.menu_item_id] = []
      portionMap[p.menu_item_id].push(p)
    })
    setPortions(portionMap)

    const varMap = {}
    ;(allVariations || []).forEach(v => {
      if (!varMap[v.menu_item_id]) varMap[v.menu_item_id] = []
      varMap[v.menu_item_id].push(v)
    })
    setVariations(varMap)

    // Flat addon map: itemId -> addons[]
    const groupByItem = {}
    ;(allAddonGroups || []).forEach(g => { groupByItem[g.id] = g.menu_item_id })
    const groupMap = {}
    ;(allAddons || []).forEach(a => {
      const itemId = groupByItem[a.group_id]
      if (!itemId) return
      if (!groupMap[itemId]) groupMap[itemId] = []
      groupMap[itemId].push(a)
    })
    setAddonGroups(groupMap)

    if (availableCats.length > 0) setActiveCategory(availableCats[0].id)
    setLoading(false)
  }

  async function fetchExistingOrder() {
    const { data: order } = await supabase.from('orders').select('*').eq('table_id', tableId).eq('status', 'active').single()
    if (!order) return
    setExistingOrder(order)
    setCovers(order.covers)
    const { data: kots } = await supabase
      .from('kots')
      .select('id, status, created_at, kot_items(id, is_done, order_item_id, order_items(id, quantity, unit_price, notes, portion_name, variation_name, addons, menu_items(name)))')
      .eq('order_id', order.id).order('created_at')
    setExistingKOTs(kots || [])
    const { data: orderItems } = await supabase.from('order_items').select('quantity, unit_price, addons_total').eq('order_id', order.id)
    const total = (orderItems || []).reduce((sum, i) => sum + i.quantity * (i.unit_price + (i.addons_total || 0)), 0)
    setRunningTotal(total)
  }

  function itemNeedsPicker(item) {
    return (variations[item.id]?.length > 0) || (addonGroups[item.id]?.length > 0) || (portions[item.id]?.length > 0)
  }

  function openPicker(item) {
    setPickerItem(item)
    setPickerVariation(null)
    setPickerAddons({})
  }

  function closePicker() {
    setPickerItem(null)
    setPickerVariation(null)
    setPickerAddons({})
  }

  function pickerAddonCount() {
    return Object.values(pickerAddons).reduce((s, q) => s + q, 0)
  }

  function adjustAddon(addon, delta) {
    setPickerAddons(prev => {
      const current = prev[addon.id] || 0
      const newQty = Math.max(0, current + delta)
      if (newQty === 0) { const next = { ...prev }; delete next[addon.id]; return next }
      return { ...prev, [addon.id]: newQty }
    })
  }

  function canConfirmPicker() {
    if (!pickerItem) return false
    const itemVariations = variations[pickerItem.id] || []
    if (itemVariations.length > 0 && !pickerVariation) return false
    return true
  }

  function confirmPicker(portion) {
    const item = pickerItem
    if (!item) return

    let addonsTotal = 0
    const addonsArr = []
    const itemAddonList = addonGroups[item.id] || []
    itemAddonList.forEach(a => {
      const qty = pickerAddons[a.id] || 0
      if (qty > 0) {
        addonsTotal += a.price * qty
        addonsArr.push({ id: a.id, name: a.name, price: a.price, qty })
      }
    })

    const unitPrice = portion
      ? parseFloat(portion.price)
      : pickerVariation
        ? parseFloat(pickerVariation.price)
        : parseFloat(item.price)

    const portionLabel    = portion ? `${portion.name}${portion.value ? ' · ' + portion.value + (portion.unit || '') : ''}` : null
    const variationLabel  = pickerVariation ? pickerVariation.name : null
    const addonKey        = Object.entries(pickerAddons).sort().map(([id, qty]) => id + 'x' + qty).join('|')
    const key             = `${item.id}_${pickerVariation?.id || 'base'}_${portion?.id || 'noport'}_${addonKey}`

    setCart(prev => {
      const existing = prev.find(c => c.key === key)
      if (existing) return prev.map(c => c.key === key ? { ...c, quantity: c.quantity + 1 } : c)
      return [...prev, { key, item, quantity: 1, notes: '', portionId: portion?.id || null, portionName: portionLabel, variationId: pickerVariation?.id || null, variationName: variationLabel, unitPrice, addons: addonsArr, addonsTotal }]
    })
    closePicker()
  }

  function addToCart(item) {
    if (itemNeedsPicker(item)) { openPicker(item); return }
    const key = `${item.id}_base_noport_`
    setCart(prev => {
      const existing = prev.find(c => c.key === key)
      if (existing) return prev.map(c => c.key === key ? { ...c, quantity: c.quantity + 1 } : c)
      return [...prev, { key, item, quantity: 1, notes: '', portionId: null, portionName: null, variationId: null, variationName: null, unitPrice: parseFloat(item.price), addons: [], addonsTotal: 0 }]
    })
  }

  function removeFromCart(key) {
    setCart(prev => {
      const existing = prev.find(c => c.key === key)
      if (existing && existing.quantity > 1) return prev.map(c => c.key === key ? { ...c, quantity: c.quantity - 1 } : c)
      return prev.filter(c => c.key !== key)
    })
  }

  function getCartQuantityForItem(itemId) {
    return cart.filter(c => c.item.id === itemId).reduce((sum, c) => sum + c.quantity, 0)
  }

  const cartTotal = cart.reduce((sum, c) => sum + (c.unitPrice + c.addonsTotal) * c.quantity, 0)
  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0)

  async function markKOTReady(kotId) {
    await supabase.from('kots').update({ status: 'ready' }).eq('id', kotId)
    await fetchExistingOrder()
  }

  async function deleteKOTItem(ki) {
    if (!window.confirm(`Remove "${ki.order_items?.menu_items?.name}" from this KOT?`)) return
    await supabase.from('kot_items').delete().eq('id', ki.id)
    await supabase.from('order_items').delete().eq('id', ki.order_item_id)
    await fetchExistingOrder()
  }

  async function saveKOTItemQty() {
    const ki = editingKOTItem?.ki
    if (!ki) return
    const qty = parseInt(editQty)
    if (qty <= 0) { await deleteKOTItem(ki); setEditingKOTItem(null); return }
    await supabase.from('order_items').update({ quantity: qty }).eq('id', ki.order_item_id)
    setEditingKOTItem(null)
    await fetchExistingOrder()
  }

  async function deleteKOTItem(kotItemId, orderItemId) {
    if (!window.confirm('Remove this item from the KOT?')) return
    await supabase.from('kot_items').delete().eq('id', kotItemId)
    await supabase.from('order_items').delete().eq('id', orderItemId)
    await fetchExistingOrder()
  }

  async function updateKOTItemQty(orderItemId, newQty) {
    if (newQty < 1) return
    await supabase.from('order_items').update({ quantity: newQty }).eq('id', orderItemId)
    await fetchExistingOrder()
  }

  async function fireKOT(hold) {
    if (cart.length === 0) return
    setSubmitting(true)
    try {
      let orderId = existingOrder?.id
      if (!orderId) {
        if (tableId) await supabase.from('cafe_tables').update({ status: 'occupied', captain_id: profile.id }).eq('id', tableId)
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .insert({ table_id: tableId || null, captain_id: profile.id, order_type: orderType, covers, customer_name: customerName || null, customer_phone: customerPhone || null, room_number: roomNumber || null, status: 'active' })
          .select().single()
        if (orderError) throw orderError
        orderId = order.id
        setExistingOrder(order)
      }
      if (hold) { setSubmitting(false); return }
      const orderItems = cart.map(c => ({
        order_id: orderId, item_id: c.item.id, quantity: c.quantity, unit_price: c.unitPrice,
        notes: c.notes, portion_id: c.portionId || null, portion_name: c.portionName || null,
        variation_id: c.variationId || null, variation_name: c.variationName || null,
        addons: c.addons || [], addons_total: c.addonsTotal || 0, status: 'pending',
      }))
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
    : items.filter(i => i.category_id === activeCategory)

  const customerPanel = isOffTable && !existingOrder && (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid ' + theme.border, padding: '14px 16px', marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {Object.entries(ORDER_TYPES).filter(([k]) => k !== 'dine_in').map(([key, cfg]) => (
          <button key={key} onClick={() => setOrderType(key)}
            style={{ flex: 1, background: orderType === key ? cfg.color : theme.bgWarm, color: orderType === key ? '#fff' : theme.textMid, border: 'none', borderRadius: 8, padding: '9px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {cfg.icon} {cfg.label}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>Customer Name *</label>
            <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="e.g. Rahul Sharma"
              style={{ width: '100%', border: '1.5px solid ' + (customerName ? '#0D9488' : theme.border), borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: theme.textDark }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>Phone *</label>
            <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="9876543210" type="tel"
              style={{ width: '100%', border: '1.5px solid ' + (customerPhone ? '#0D9488' : theme.border), borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: theme.textDark }} />
          </div>
        </div>
        {orderType === 'delivery' && (
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>Room / Address</label>
            <input value={roomNumber} onChange={e => setRoomNumber(e.target.value)} placeholder="e.g. Room 12, Villa B"
              style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: theme.textDark }} />
          </div>
        )}
      </div>
    </div>
  )

  const existingCustomerBadge = isOffTable && existingOrder && (
    <div style={{ background: ORDER_TYPES[orderType]?.color + '18', border: '1px solid ' + ORDER_TYPES[orderType]?.color + '33', borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
      <span style={{ fontSize: 20 }}>{ORDER_TYPES[orderType]?.icon}</span>
      <div>
        <div style={{ fontWeight: 700, fontSize: 14, color: theme.textDark }}>{existingOrder.customer_name || '—'}</div>
        {existingOrder.customer_phone && <div style={{ fontSize: 12, color: theme.textLight, marginTop: 2 }}>📞 {existingOrder.customer_phone}</div>}
      </div>
      <span style={{ marginLeft: 'auto', background: '#D4FAD4', color: '#15803D', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20 }}>● Active</span>
    </div>
  )

  const menuPanel = (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
      {customerPanel}
      {existingCustomerBadge}

      {!isOffTable && (
        <div style={{ background: '#092b33', borderRadius: 12, padding: '12px 16px', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>
              {tableId ? 'Table ' + tableNumber : 'New Order'}
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
        </div>
      )}

      {isOffTable && (
        <div style={{ background: '#092b33', borderRadius: 12, padding: '10px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>{ORDER_TYPES[orderType]?.icon} {ORDER_TYPES[orderType]?.label} Order</div>
          <button onClick={() => navigate('/orders')} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'rgba(255,255,255,0.7)', borderRadius: 7, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>← Back</button>
        </div>
      )}

      <div style={{ position: 'relative', marginBottom: 10 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search menu items..."
          style={{ width: '100%', background: '#fff', border: '1px solid ' + theme.border, borderRadius: 9, padding: '9px 14px 9px 36px', fontSize: 13, color: theme.textDark, outline: 'none', boxSizing: 'border-box' }} />
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: theme.textLight }}>🔍</span>
      </div>

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

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
          {displayItems.map(item => {
            const qty          = getCartQuantityForItem(item.id)
            const hasOptions   = itemNeedsPicker(item)
            const itemVars     = variations[item.id] || []
            const itemAGs      = addonGroups[item.id] || []
            return (
              <div key={item.id} style={{ background: '#fff', borderRadius: 10, padding: 12, border: qty > 0 ? '2px solid #0D9488' : '1px solid ' + theme.border, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 6 }}>
                  {itemVars.length > 0 ? (
                    <div style={{ width: 9, height: 9, borderRadius: 2, border: '2px solid #9CA3AF', background: '#9CA3AF', flexShrink: 0, marginTop: 3 }} />
                  ) : (
                    <div style={{ width: 9, height: 9, borderRadius: 2, border: '2px solid ' + (item.food_type === 'veg' ? '#15803D' : '#B91C1C'), background: item.food_type === 'veg' ? '#15803D' : '#B91C1C', flexShrink: 0, marginTop: 3 }} />
                  )}
                  <div style={{ fontWeight: 700, fontSize: 12, color: theme.textDark, lineHeight: 1.3 }}>{item.name}</div>
                </div>
                {hasOptions ? (
                  <div style={{ fontSize: 10, color: '#5B21B6', fontWeight: 700, marginBottom: 6 }}>
                    {itemVars.length > 0 ? 'Veg & Non-Veg options' : ''}
                    {itemVars.length > 0 && itemAGs.length > 0 ? ' · ' : ''}
                    {itemAGs.length > 0 ? itemAGs.length + ' add-on' + (itemAGs.length !== 1 ? 's' : '') : ''}
                  </div>
                ) : (
                  <div style={{ fontWeight: 800, fontSize: 13, color: theme.textDark, marginBottom: 8 }}>₹{item.price}</div>
                )}
                <button onClick={() => addToCart(item)}
                  style={{ width: '100%', background: hasOptions ? '#5B21B6' : '#092b33', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 0', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  {hasOptions ? 'Choose →' : qty === 0 ? '+ Add' : '+ Add (' + qty + ')'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  const orderPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
      <div style={{ background: '#092b33', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: '12px 12px 0 0' }}>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>Order Summary</div>
        {runningTotal > 0 && <div style={{ color: '#D4A853', fontWeight: 800, fontSize: 13 }}>₹{runningTotal.toFixed(0)} total</div>}
      </div>

      {existingKOTs.length > 0 && (
        <div style={{ borderBottom: '2px solid ' + theme.border, overflowY: 'auto', maxHeight: 220 }}>
          {existingKOTs.map((kot, idx) => (
            <div key={kot.id} style={{ padding: '10px 14px', borderBottom: '1px solid ' + theme.bgWarm }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                KOT {idx + 1} · {new Date(kot.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                <span style={{ marginLeft: 8, background: kot.status === 'ready' ? '#DCFCE7' : '#FEF3C7', color: kot.status === 'ready' ? '#15803D' : '#B45309', padding: '1px 6px', borderRadius: 10, fontSize: 9 }}>{kot.status}</span>
              </div>
              {kot.kot_items.map((ki, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: theme.textMid, padding: '3px 0' }}>
                  <div style={{ flex: 1 }}>
                    <span>{ki.order_items?.menu_items?.name}</span>
                    {ki.order_items?.variation_name && <span style={{ color: '#5B21B6', fontWeight: 600 }}> ({ki.order_items.variation_name})</span>}
                    {ki.order_items?.portion_name && <span style={{ color: '#0D9488', fontWeight: 600 }}> [{ki.order_items.portion_name}]</span>}
                  </div>
                  {editingKOTItem?.ki?.id === ki.id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input type="number" min="0" value={editQty} onChange={e => setEditQty(e.target.value)} autoFocus
                        style={{ width: 40, border: '1.5px solid #0D9488', borderRadius: 5, padding: '2px 5px', fontSize: 12, fontWeight: 700, textAlign: 'center', outline: 'none' }} />
                      <button onClick={saveKOTItemQty} style={{ background: '#0D9488', border: 'none', color: '#fff', borderRadius: 5, padding: '2px 7px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✓</button>
                      <button onClick={() => setEditingKOTItem(null)} style={{ background: theme.bgWarm, border: '1px solid ' + theme.border, borderRadius: 5, padding: '2px 6px', fontSize: 11, cursor: 'pointer', color: theme.textMid }}>✕</button>
                    </div>
                  ) : (
                    <>
                      <span style={{ color: theme.textLight, fontWeight: 700 }}>×{ki.order_items?.quantity}</span>
                      {isManager && (
                        <>
                          <button onClick={() => { setEditingKOTItem({ ki }); setEditQty(ki.order_items?.quantity || 1) }}
                            style={{ background: '#EFF6FF', border: 'none', borderRadius: 5, padding: '2px 6px', fontSize: 10, cursor: 'pointer', color: '#1D4ED8', fontWeight: 700 }}>✏️</button>
                          <button onClick={() => deleteKOTItem(ki)}
                            style={{ background: '#FEE2E2', border: 'none', borderRadius: 5, padding: '2px 6px', fontSize: 10, cursor: 'pointer', color: '#B91C1C', fontWeight: 700 }}>✕</button>
                        </>
                      )}
                    </>
                  )}
                </div>
              ))}
              {kot.status !== 'ready' ? (
                <button onClick={() => markKOTReady(kot.id)} style={{ width: '100%', marginTop: 8, background: '#DCFCE7', color: '#15803D', border: '1px solid #86EFAC', borderRadius: 7, padding: '7px 0', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✓ Mark as Ready</button>
              ) : (
                <div style={{ width: '100%', marginTop: 8, background: '#DCFCE7', color: '#15803D', border: '1px solid #86EFAC', borderRadius: 7, padding: '7px 0', fontSize: 11, fontWeight: 700, textAlign: 'center' }}>✓ Ready</div>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
        {cart.length === 0 ? (
          <div style={{ textAlign: 'center', color: theme.textMuted, fontSize: 12, marginTop: 20 }}>
            {existingKOTs.length > 0 ? 'Add items for next round' : 'Tap items to add to order'}
          </div>
        ) : (
          <>
            {existingKOTs.length > 0 && <div style={{ fontSize: 10, fontWeight: 700, color: theme.primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>New Round</div>}
            {cart.map(c => (
              <div key={c.key} style={{ padding: '8px 0', borderBottom: '1px solid ' + theme.bgWarm }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: theme.textDark }}>{c.item.name}</div>
                    {c.variationName && <div style={{ fontSize: 11, color: '#5B21B6', fontWeight: 600 }}>{c.variationName}</div>}
                    {c.portionName && <div style={{ fontSize: 11, color: '#0D9488', fontWeight: 600 }}>{c.portionName}</div>}
                    {c.addons && c.addons.length > 0 && <div style={{ fontSize: 11, color: '#C2410C' }}>+ {c.addons.map(a => a.name).join(', ')}</div>}
                    <div style={{ fontSize: 11, color: theme.textLight }}>₹{(c.unitPrice + c.addonsTotal).toFixed(0)} × {c.quantity}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button onClick={() => removeFromCart(c.key)} style={{ background: theme.bgWarm, border: '1px solid ' + theme.border, borderRadius: 5, width: 22, height: 22, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: theme.textMid }}>-</button>
                    <span style={{ fontWeight: 700, fontSize: 13, color: theme.textDark, minWidth: 20, textAlign: 'center' }}>{c.quantity}</span>
                    <button onClick={() => addToCart(c.item)} style={{ background: '#0D9488', border: 'none', borderRadius: 5, width: 22, height: 22, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#fff' }}>+</button>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: theme.textDark }}>₹{((c.unitPrice + c.addonsTotal) * c.quantity).toFixed(0)}</div>
                </div>
                <input value={c.notes} onChange={e => setCart(prev => prev.map(ci => ci.key === c.key ? { ...ci, notes: e.target.value } : ci))}
                  placeholder="Add note (e.g. no onion...)"
                  style={{ width: '100%', marginTop: 6, background: '#F8F6F2', border: '1px solid ' + theme.border, borderRadius: 6, padding: '5px 10px', fontSize: 11, color: theme.textDark, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}
          </>
        )}
      </div>

      <div style={{ padding: '12px 14px', borderTop: '2px solid ' + theme.border, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {cart.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: theme.textMid }}>New items</span>
            <span style={{ fontWeight: 800, fontSize: 15, color: theme.textDark }}>₹{cartTotal.toFixed(0)}</span>
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
      {/* ITEM PICKER MODAL */}
      {pickerItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) closePicker() }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: pickerItem.food_type === 'veg' ? '#15803D' : '#B91C1C', flexShrink: 0 }} />
              <div style={{ fontWeight: 800, fontSize: 18, color: theme.textDark, flex: 1 }}>{pickerItem.name}</div>
              <div style={{ fontWeight: 900, fontSize: 16, color: '#092b33' }}>₹{pickerItem.price}</div>
            </div>

            {/* Variations */}
            {(variations[pickerItem.id] || []).length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: theme.textDark, marginBottom: 12 }}>
                  Variation <span style={{ color: '#B91C1C', fontSize: 11 }}>* Required</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
                  {(variations[pickerItem.id] || []).map(v => {
                    const dotColor = /chicken|mutton|prawn|fish|egg|non.?veg/i.test(v.name) ? '#B91C1C' : '#15803D'
                    const selected = pickerVariation?.id === v.id
                    return (
                      <button key={v.id} onClick={() => setPickerVariation(v)}
                        style={{ background: selected ? '#5B21B6' : '#F5F3FF', color: selected ? '#fff' : '#3B0764', border: '2px solid ' + (selected ? '#5B21B6' : '#C4B5FD'), borderRadius: 12, padding: '14px 10px', cursor: 'pointer', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
                          <div style={{ width: 9, height: 9, borderRadius: 2, border: '2px solid ' + dotColor, background: dotColor, flexShrink: 0 }} />
                          <span style={{ fontWeight: 800, fontSize: 14 }}>{v.name}</span>
                        </div>
                        <div style={{ fontSize: 13 }}>₹{v.price}</div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Portions */}
            {(portions[pickerItem.id] || []).length > 0 && (variations[pickerItem.id] || []).length === 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: theme.textDark, marginBottom: 12 }}>
                  Portion / Size <span style={{ color: '#B91C1C', fontSize: 11 }}>* Required</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(portions[pickerItem.id] || []).map(p => (
                    <button key={p.id} onClick={() => confirmPicker(p)}
                      style={{ background: '#F0FDF4', border: '2px solid #86EFAC', borderRadius: 12, padding: '12px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: theme.textDark }}>{p.name}</div>
                        {p.value > 0 && p.unit && <div style={{ fontSize: 12, color: theme.textLight }}>{p.value}{p.unit}</div>}
                      </div>
                      <div style={{ fontWeight: 900, fontSize: 16, color: '#092b33' }}>₹{p.price}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Add-ons (flat) */}
            {(addonGroups[pickerItem.id] || []).length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: theme.textDark, marginBottom: 10 }}>
                  Add-ons <span style={{ fontSize: 11, fontWeight: 400, color: theme.textLight }}>optional</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(addonGroups[pickerItem.id] || []).map(addon => {
                    const qty = pickerAddons[addon.id] || 0
                    return (
                      <div key={addon.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: qty > 0 ? '#FFF7ED' : '#F9FAFB', borderRadius: 10, border: '1px solid ' + (qty > 0 ? '#FED7AA' : theme.border) }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14, color: theme.textDark }}>{addon.name}</div>
                          {addon.price > 0 && <div style={{ fontSize: 12, color: '#C2410C', fontWeight: 600 }}>+₹{addon.price}</div>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {qty > 0 && (
                            <>
                              <button onClick={() => adjustAddon(addon, -1)} style={{ background: '#FEE2E2', border: 'none', borderRadius: 6, width: 28, height: 28, fontSize: 16, cursor: 'pointer', fontWeight: 700, color: '#B91C1C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>-</button>
                              <span style={{ fontWeight: 800, fontSize: 14, minWidth: 20, textAlign: 'center' }}>{qty}</span>
                            </>
                          )}
                          <button onClick={() => adjustAddon(addon, 1)}
                            style={{ background: '#092b33', border: 'none', borderRadius: 6, width: 28, height: 28, fontSize: 16, cursor: 'pointer', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Confirm / Cancel */}
            {((variations[pickerItem.id] || []).length > 0 || (addonGroups[pickerItem.id] || []).length > 0) && (
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={closePicker} style={{ flex: 1, background: theme.bgWarm, border: '1px solid ' + theme.border, borderRadius: 10, padding: '12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: theme.textMid }}>Cancel</button>
                <button onClick={() => confirmPicker(null)} disabled={!canConfirmPicker()}
                  style={{ flex: 2, background: canConfirmPicker() ? '#092b33' : theme.bgWarm, color: canConfirmPicker() ? '#fff' : theme.textMuted, border: 'none', borderRadius: 10, padding: '12px', fontSize: 13, fontWeight: 700, cursor: canConfirmPicker() ? 'pointer' : 'not-allowed' }}>
                  Add to Order →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* DESKTOP LAYOUT */}
      <div className="orders-desktop" style={{ display: 'flex', gap: 16, height: 'calc(100vh - 112px)' }}>
        {menuPanel}
        <div style={{ width: 290, background: '#fff', borderRadius: 12, border: '1px solid ' + theme.border, display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
          {orderPanel}
        </div>
      </div>

      {/* MOBILE LAYOUT */}
      <div className="orders-mobile" style={{ display: 'none', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
        <div style={{ display: 'flex', background: '#092b33', borderRadius: 10, padding: 4, marginBottom: 12, flexShrink: 0 }}>
          <button onClick={() => setMobileTab('menu')} style={{ flex: 1, padding: '8px 0', borderRadius: 7, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', background: mobileTab === 'menu' ? '#fff' : 'transparent', color: mobileTab === 'menu' ? '#092b33' : 'rgba(255,255,255,0.6)' }}>🍽 Menu</button>
          <button onClick={() => setMobileTab('order')} style={{ flex: 1, padding: '8px 0', borderRadius: 7, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', background: mobileTab === 'order' ? '#fff' : 'transparent', color: mobileTab === 'order' ? '#092b33' : 'rgba(255,255,255,0.6)' }}>
            🧾 Order {cartCount > 0 && <span style={{ background: '#0D9488', color: '#fff', borderRadius: 10, fontSize: 10, padding: '1px 6px', marginLeft: 4 }}>{cartCount}</span>}
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {mobileTab === 'menu' ? menuPanel : (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid ' + theme.border, display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>{orderPanel}</div>
          )}
        </div>
      </div>

      <style>{"@media (max-width: 768px) { .orders-desktop { display: none !important; } .orders-mobile { display: flex !important; } }"}</style>
    </>
  )
}

// ORDERS LIST PAGE
export default function OrdersPage() {
  const [orders, setOrders]               = useState([])
  const [loading, setLoading]             = useState(true)
  const [showTypeMenu, setShowTypeMenu]   = useState(false)
  const [deleteOrderId, setDeleteOrderId] = useState(null)
  const dropdownRef = useRef(null)
  const navigate    = useNavigate()
  const { profile } = useAuth()

  useEffect(() => {
    fetchOrders()
    const now = new Date(); const midnight = new Date(now); midnight.setHours(24, 0, 0, 0)
    const timer = setTimeout(() => fetchOrders(), midnight - now)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    function handleClick(e) { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowTypeMenu(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function fetchOrders() {
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const end   = new Date(); end.setHours(23, 59, 59, 999)
    const { data, error } = await supabase
      .from('orders').select('*, cafe_tables(number), staff(name)')
      .gte('created_at', start.toISOString()).lte('created_at', end.toISOString())
      .order('created_at', { ascending: false })
    if (!error) {
      const sorted = (data || []).sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1
        if (a.status !== 'active' && b.status === 'active') return 1
        return new Date(b.created_at) - new Date(a.created_at)
      })
      setOrders(sorted)
    }
    setLoading(false)
  }

  async function deleteOrder(id) {
    try {
      const order = orders.find(o => o.id === id)
      if (order?.table_id) await supabase.from('cafe_tables').update({ status: 'free', captain_id: null }).eq('id', order.table_id)
      await supabase.from('bills').delete().eq('order_id', id)
      const { data: kots } = await supabase.from('kots').select('id').eq('order_id', id)
      if (kots?.length) {
        await supabase.from('kot_items').delete().in('kot_id', kots.map(k => k.id))
        await supabase.from('kots').delete().eq('order_id', id)
      }
      await supabase.from('order_items').delete().eq('order_id', id)
      await supabase.from('orders').delete().eq('id', id)
      setDeleteOrderId(null)
      fetchOrders()
    } catch (err) {
      console.error('Delete failed:', err)
      alert('Delete failed: ' + err.message)
    }
  }

  function handleTypeSelect(type) {
    setShowTypeMenu(false)
    if (type === 'dine_in') navigate('/tables')
    else navigate('/orders/new?type=' + type)
  }

  if (loading) return <div style={{ padding: 40, color: theme.textLight }}>Loading orders...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: theme.textDark, margin: 0 }}>Today's Orders</h1>
          <p style={{ color: theme.textLight, fontSize: 14, marginTop: 4 }}>
            {orders.filter(o => o.status === 'active').length} active · {orders.filter(o => o.status !== 'active').length} completed
          </p>
        </div>
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button onClick={() => setShowTypeMenu(d => !d)}
            style={{ background: '#092b33', color: '#fff', border: 'none', borderRadius: 9, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            + New Order <span style={{ fontSize: 10, opacity: 0.6 }}>▼</span>
          </button>
          {showTypeMenu && (
            <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', background: '#fff', border: '1px solid ' + theme.border, borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.14)', zIndex: 100, minWidth: 200, overflow: 'hidden' }}>
              {Object.entries(ORDER_TYPES).map(([key, cfg], i, arr) => (
                <div key={key} onClick={() => handleTypeSelect(key)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', fontSize: 13, color: theme.textDark, cursor: 'pointer', borderBottom: i < arr.length - 1 ? '1px solid ' + theme.bgWarm : 'none' }}
                  onMouseEnter={e => e.currentTarget.style.background = theme.bgWarm}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <span style={{ fontSize: 20 }}>{cfg.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700 }}>{cfg.label}</div>
                    <div style={{ fontSize: 11, color: theme.textLight }}>
                      {key === 'dine_in' ? 'Select a table' : key === 'takeaway' ? 'Customer picks up' : 'Deliver to address'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {orders.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid ' + theme.border, textAlign: 'center', padding: 48, color: theme.textLight }}>
          No orders today. Click "+ New Order" to get started.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {orders.map(order => {
            const typeConfig = ORDER_TYPES[order.order_type] || ORDER_TYPES.dine_in
            const isOffTable = !order.table_id
            const isActive   = order.status === 'active'
            const canDelete  = ['owner', 'manager'].includes(profile?.role)
            return (
              <div key={order.id} style={{ position: 'relative' }}>
                <div
                  onClick={() => isActive ? (isOffTable ? navigate('/orders/new?type=' + order.order_type) : navigate('/orders/new?table=' + order.table_id + '&tableNumber=' + order.cafe_tables?.number)) : null}
                  style={{ background: '#fff', borderRadius: 12, padding: '14px 18px', paddingRight: canDelete ? 52 : 18, border: '1px solid ' + (isActive ? theme.border : theme.bgWarm), cursor: isActive ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', opacity: isActive ? 1 : 0.65 }}>
                  <div style={{ width: 42, height: 42, background: typeConfig.color + '18', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{typeConfig.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: theme.textDark }}>
                        {order.cafe_tables ? 'Table ' + order.cafe_tables.number : order.customer_name || typeConfig.label}
                      </div>
                      {!isActive && <span style={{ fontSize: 10, fontWeight: 700, background: '#DCFCE7', color: '#15803D', padding: '2px 8px', borderRadius: 20 }}>✓ Done</span>}
                    </div>
                    <div style={{ fontSize: 12, color: theme.textLight, marginTop: 2 }}>
                      {typeConfig.label}
                      {order.customer_phone && ' · 📞 ' + order.customer_phone}
                      {!isOffTable && ' · ' + order.covers + ' cover' + (order.covers !== 1 ? 's' : '')}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: theme.textLight }}>
                    {new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                {canDelete && (
                  <button onClick={e => { e.stopPropagation(); setDeleteOrderId(order.id) }}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 7, padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <Trash2 size={14} color="#DC2626" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {deleteOrderId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 360, textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#FEF2F2', border: '2px solid #FECACA', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Trash2 size={22} color="#DC2626" />
            </div>
            <div style={{ fontWeight: 800, fontSize: 16, color: theme.textDark, marginBottom: 8 }}>Delete Order?</div>
            <div style={{ fontSize: 13, color: theme.textLight, marginBottom: 22 }}>This will permanently delete the order, its bill, all KOTs, and free the table.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteOrderId(null)} style={{ flex: 1, background: theme.bgWarm, border: 'none', borderRadius: 9, padding: '11px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: theme.textMid }}>Cancel</button>
              <button onClick={() => deleteOrder(deleteOrderId)} style={{ flex: 1, background: '#DC2626', color: '#fff', border: 'none', borderRadius: 9, padding: '11px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}