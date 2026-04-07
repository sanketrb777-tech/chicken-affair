import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const TEAL  = '#6b1f1f'
const TEAL2 = '#c0392b'
const GOLD  = '#cd6155'
const BG    = '#fdf9f9'
const WHITE = '#FFFFFF'
const BORDER = '#E5E7EB'
const TEXTD = '#1a1a1a'
const TEXTL = '#6B7280'

const STEP_IDENTITY = 'identity'
const STEP_MENU     = 'menu'
const STEP_CONFIRM  = 'confirm'
const STEP_PLACED   = 'placed'
const STEP_PAYMENT  = 'payment'

export default function CustomerMenuPage() {
  const { tableId } = useParams()
  const [step, setStep]             = useState(STEP_IDENTITY)
  const [table, setTable]           = useState(null)
  const [categories, setCategories] = useState([])
  const [items, setItems]           = useState([])
  const [portions, setPortions]     = useState({})
  const [variations, setVariations] = useState({})
  const [addonGroups, setAddonGroups] = useState({})
  const [activeCategory, setActiveCategory] = useState(null)
  const [cart, setCart]             = useState([])
  const [search, setSearch]         = useState('')
  const [loading, setLoading]       = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [placedOrderId, setPlacedOrderId] = useState(null)
  const [paymentPref, setPaymentPref]     = useState(null)
  const [roundCount, setRoundCount]       = useState(0)
  const [runningTotal, setRunningTotal]   = useState(0)

  const [name, setName]     = useState('')
  const [nameErr, setNameErr] = useState('')

  const [pickerItem, setPickerItem]           = useState(null)
  const [pickerVariation, setPickerVariation] = useState(null)
  const [pickerAddons, setPickerAddons]       = useState({})

  useEffect(() => { fetchData() }, [tableId])

  async function fetchData() {
    const [{ data: tableData }, { data: cats }, { data: menuItems }, { data: allPortions }, { data: allVariations }, { data: allAddonGroups }, { data: allAddons }] = await Promise.all([
      supabase.from('cafe_tables').select('*').eq('id', tableId).single(),
      supabase.from('menu_categories').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('menu_items').select('*').eq('is_available', true).order('sort_order'),
      supabase.from('item_portions').select('*').eq('is_available', true).order('sort_order'),
      supabase.from('item_variations').select('*').eq('is_available', true).order('sort_order'),
      supabase.from('item_addon_groups').select('*').order('sort_order'),
      supabase.from('item_addons').select('*').order('sort_order'),
    ])
    setTable(tableData)

    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
    const todayDay = days[new Date().getDay()]
    const availableCats = (cats || []).filter(c => !c.available_days || c.available_days.length === 0 || c.available_days.includes(todayDay))
    setCategories(availableCats)

    const now = new Date(); const nowMins = now.getHours() * 60 + now.getMinutes()
    const toMins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
    const timeFiltered = (menuItems || []).filter(item => {
      if (!item.available_from && !item.available_until) return true
      const from  = item.available_from  ? toMins(item.available_from)  : 0
      const until = item.available_until ? toMins(item.available_until) : 1439
      return nowMins >= from && nowMins <= until
    })
    setItems(timeFiltered)

    const portionMap = {}
    ;(allPortions || []).forEach(p => { if (!portionMap[p.menu_item_id]) portionMap[p.menu_item_id] = []; portionMap[p.menu_item_id].push(p) })
    setPortions(portionMap)

    const varMap = {}
    ;(allVariations || []).forEach(v => { if (!varMap[v.menu_item_id]) varMap[v.menu_item_id] = []; varMap[v.menu_item_id].push(v) })
    setVariations(varMap)

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

    if (availableCats?.length) setActiveCategory(availableCats[0].id)
    setLoading(false)
  }

  async function refreshRunningTotal(orderId) {
    const { data } = await supabase.from('order_items').select('quantity, unit_price, addons_total').eq('order_id', orderId)
    setRunningTotal((data || []).reduce((s, i) => s + i.quantity * (i.unit_price + (i.addons_total || 0)), 0))
  }

  function handleStartOrdering() {
    if (!name.trim()) return setNameErr('Please enter your name')
    setStep(STEP_MENU)
  }

  function openPicker(item) { setPickerItem(item); setPickerVariation(null); setPickerAddons({}) }
  function closePicker() { setPickerItem(null); setPickerVariation(null); setPickerAddons({}) }

  function adjustAddon(addon, delta) {
    setPickerAddons(prev => {
      const current = prev[addon.id] || 0
      const newQty = Math.max(0, current + delta)
      if (newQty === 0) { const next = { ...prev }; delete next[addon.id]; return next }
      return { ...prev, [addon.id]: newQty }
    })
  }

  function canConfirmPicker() {
    const item = pickerItem; if (!item) return false
    const itemVariations = variations[item.id] || []
    if (itemVariations.length > 0 && !pickerVariation) return false
    return true
  }

  function confirmPicker(portion = null) {
    const item = pickerItem; if (!item) return
    let addonsTotal = 0; const addonsArr = []
    const itemAddonList = addonGroups[item.id] || []
    itemAddonList.forEach(a => {
      const qty = pickerAddons[a.id] || 0
      if (qty > 0) { addonsTotal += a.price * qty; addonsArr.push({ id: a.id, name: a.name, price: a.price, qty }) }
    })
    const unitPrice = portion ? parseFloat(portion.price) : pickerVariation ? parseFloat(pickerVariation.price) : parseFloat(item.price)
    const portionLabel = portion ? `${portion.name}${portion.value ? ` · ${portion.value}${portion.unit || ''}` : ''}` : null
    const variationLabel = pickerVariation ? pickerVariation.name : null
    const addonKey = Object.entries(pickerAddons).sort().map(([id, qty]) => id + 'x' + qty).join('|')
    const key = `${item.id}_${pickerVariation?.id || 'base'}_${portion?.id || 'noport'}_${addonKey}`
    setCart(prev => {
      const ex = prev.find(c => c.key === key)
      if (ex) return prev.map(c => c.key === key ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { key, item, qty: 1, portionId: portion?.id || null, portionName: portionLabel, variationId: pickerVariation?.id || null, variationName: variationLabel, unitPrice, addons: addonsArr, addonsTotal }]
    })
    closePicker()
  }

  function itemNeedsPicker(item) {
    return (variations[item.id]?.length > 0) || (addonGroups[item.id]?.length > 0) || (portions[item.id]?.length > 0)
  }

  function addToCart(item) {
    if (itemNeedsPicker(item)) { openPicker(item); return }
    const key = `${item.id}_base_noport_`
    setCart(prev => {
      const ex = prev.find(c => c.key === key)
      if (ex) return prev.map(c => c.key === key ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { key, item, qty: 1, portionId: null, portionName: null, variationId: null, variationName: null, unitPrice: parseFloat(item.price), addons: [], addonsTotal: 0 }]
    })
  }

  function removeFromCart(key) {
    setCart(prev => {
      const ex = prev.find(c => c.key === key)
      if (ex?.qty > 1) return prev.map(c => c.key === key ? { ...c, qty: c.qty - 1 } : c)
      return prev.filter(c => c.key !== key)
    })
  }

  function getQtyForItem(itemId) { return cart.filter(c => c.item.id === itemId).reduce((s, c) => s + c.qty, 0) }

  const cartTotal = cart.reduce((s, c) => s + (c.unitPrice + c.addonsTotal) * c.qty, 0)
  const cartCount = cart.reduce((s, c) => s + c.qty, 0)

  async function placeOrder() {
    if (cart.length === 0) return
    setSubmitting(true)
    try {
      let orderId = placedOrderId
      if (!orderId) {
        const { data: order, error: oErr } = await supabase.from('orders').insert({ table_id: tableId, order_type: 'dine_in', customer_name: name || 'Guest', covers: 1, status: 'active' }).select().single()
        if (oErr) throw oErr
        orderId = order.id; setPlacedOrderId(orderId)
        await supabase.from('cafe_tables').update({ status: 'occupied' }).eq('id', tableId)
      }
      const orderItems = cart.map(c => ({
        order_id: orderId, item_id: c.item.id, quantity: c.qty, unit_price: c.unitPrice, status: 'pending',
        portion_id: c.portionId || null, portion_name: c.portionName || null,
        variation_id: c.variationId || null, variation_name: c.variationName || null,
        addons: c.addons || [], addons_total: c.addonsTotal || 0
      }))
      const { data: createdItems, error: iErr } = await supabase.from('order_items').insert(orderItems).select()
      if (iErr) throw iErr
      const { data: kot, error: kErr } = await supabase.from('kots').insert({ order_id: orderId, status: 'pending' }).select().single()
      if (kErr) throw kErr
      await supabase.from('kot_items').insert(createdItems.map(oi => ({ kot_id: kot.id, order_item_id: oi.id, is_done: false })))
      setRoundCount(r => r + 1)
      await refreshRunningTotal(orderId)
      setCart([])
      setStep(STEP_PLACED)
    } catch (err) { alert('Something went wrong.\n' + err.message) } finally { setSubmitting(false) }
  }

  async function handlePaymentChoice(pref) {
    setPaymentPref(pref)
    if (placedOrderId) await supabase.from('orders').update({ payment_preference: pref }).eq('id', placedOrderId)
    setStep(STEP_PAYMENT)
  }

  const displayItems = search
    ? items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    : items.filter(i => i.category_id === activeCategory)

  if (loading) return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 44, height: 44, border: '4px solid ' + BORDER, borderTopColor: TEAL, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 14px' }} />
        <div style={{ color: TEXTL, fontSize: 14 }}>Loading menu...</div>
      </div>
      <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
    </div>
  )

  if (!table) return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: TEXTL }}><div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div><div style={{ fontWeight: 700, color: TEXTD }}>Table not found</div></div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: "'DM Sans', 'Segoe UI', sans-serif", maxWidth: 480, margin: '0 auto' }}>
      <style>{"@keyframes spin { to { transform: rotate(360deg); } } @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } * { box-sizing: border-box; } input:focus { outline: none; }"}</style>

      {/* HEADER */}
      <div style={{ background: TEAL, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ width: 38, height: 38, background: GOLD, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🍗</div>
        <div>
          <div style={{ color: WHITE, fontWeight: 800, fontSize: 16 }}>Chicken Affair</div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{table.name || `Table ${table.number}`}{table.area ? ` · ${table.area}` : ''}</div>
        </div>
        {step === STEP_MENU && cartCount > 0 && (
          <button onClick={() => setStep(STEP_CONFIRM)} style={{ marginLeft: 'auto', background: GOLD, border: 'none', borderRadius: 20, padding: '6px 14px', color: WHITE, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
            🛒 {cartCount} · ₹{cartTotal.toFixed(0)}
          </button>
        )}
        {step === STEP_MENU && runningTotal > 0 && cartCount === 0 && (
          <div style={{ marginLeft: 'auto', color: GOLD, fontWeight: 700, fontSize: 13 }}>Total: ₹{runningTotal.toFixed(0)}</div>
        )}
      </div>

      {/* ITEM PICKER BOTTOM SHEET */}
      {pickerItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }}
          onClick={e => e.target === e.currentTarget && closePicker()}>
          <div style={{ background: WHITE, borderRadius: '20px 20px 0 0', padding: 24, width: '100%', maxWidth: 480, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 -8px 32px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: pickerItem.food_type === 'veg' ? '#15803D' : '#a93226', flexShrink: 0 }} />
              <div style={{ fontWeight: 800, fontSize: 17, color: TEXTD, flex: 1 }}>{pickerItem.name}</div>
              {!variations[pickerItem.id]?.length && !portions[pickerItem.id]?.length && (
                <div style={{ fontWeight: 900, fontSize: 16, color: TEAL }}>₹{pickerItem.price}</div>
              )}
            </div>

            {/* Variations */}
            {(variations[pickerItem.id] || []).length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: TEXTD, marginBottom: 12 }}>
                  Variation <span style={{ color: '#a93226', fontSize: 11, fontWeight: 600 }}>* Required</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
                  {(variations[pickerItem.id] || []).map(v => {
                    const dotColor = /chicken|mutton|prawn|fish|egg|non.?veg/i.test(v.name) ? '#a93226' : '#15803D'
                    return (
                      <button key={v.id} onClick={() => setPickerVariation(v)}
                        style={{ background: pickerVariation?.id === v.id ? '#922b21' : '#fdf9f9', color: pickerVariation?.id === v.id ? WHITE : '#6b1f1f', border: '2px solid ' + (pickerVariation?.id === v.id ? '#922b21' : '#f1948a'), borderRadius: 14, padding: '16px 10px', cursor: 'pointer', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
                          <div style={{ width: 9, height: 9, borderRadius: 2, border: '2px solid ' + dotColor, background: dotColor, flexShrink: 0 }} />
                          <span style={{ fontWeight: 800, fontSize: 15 }}>{v.name}</span>
                        </div>
                        <div style={{ fontSize: 14 }}>₹{v.price}</div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Portions */}
            {(portions[pickerItem.id] || []).length > 0 && !(variations[pickerItem.id] || []).length && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: TEXTD, marginBottom: 12 }}>
                  Portion / Size <span style={{ color: '#a93226', fontSize: 11, fontWeight: 600 }}>* Required</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(portions[pickerItem.id] || []).map(p => (
                    <button key={p.id} onClick={() => confirmPicker(p)}
                      style={{ background: '#fdf9f9', border: '2px solid #fadbd8', borderRadius: 14, padding: '14px 18px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: TEXTD }}>{p.name}</div>
                        {p.value > 0 && p.unit && <div style={{ fontSize: 12, color: TEXTL, marginTop: 2 }}>{p.value}{p.unit}</div>}
                      </div>
                      <div style={{ fontWeight: 900, fontSize: 18, color: TEAL }}>₹{p.price}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Add-ons */}
            {(addonGroups[pickerItem.id] || []).length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: TEXTD, marginBottom: 10 }}>
                  Add-ons <span style={{ fontSize: 11, fontWeight: 400, color: TEXTL }}>optional</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(addonGroups[pickerItem.id] || []).map(addon => {
                    const qty = pickerAddons[addon.id] || 0
                    return (
                      <div key={addon.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: qty > 0 ? '#fdf9f9' : '#F9FAFB', borderRadius: 12, border: '1px solid ' + (qty > 0 ? '#fadbd8' : BORDER) }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 15, color: TEXTD }}>{addon.name}</div>
                          {addon.price > 0 && <div style={{ fontSize: 12, color: '#C2410C', fontWeight: 600, marginTop: 2 }}>+₹{addon.price}</div>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {qty > 0 && (
                            <>
                              <button onClick={() => adjustAddon(addon, -1)} style={{ background: '#fdedec', border: 'none', borderRadius: 8, width: 32, height: 32, fontSize: 18, cursor: 'pointer', fontWeight: 700, color: '#a93226', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>-</button>
                              <span style={{ fontWeight: 800, fontSize: 16, minWidth: 20, textAlign: 'center' }}>{qty}</span>
                            </>
                          )}
                          <button onClick={() => adjustAddon(addon, 1)} style={{ background: TEAL, border: 'none', borderRadius: 8, width: 32, height: 32, fontSize: 18, cursor: 'pointer', fontWeight: 700, color: WHITE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {((variations[pickerItem.id] || []).length > 0 || (addonGroups[pickerItem.id] || []).length > 0) && (
              <div style={{ display: 'flex', gap: 10, paddingTop: 8 }}>
                <button onClick={closePicker} style={{ flex: 1, background: BG, border: '1px solid ' + BORDER, borderRadius: 14, padding: '14px 0', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: TEXTL }}>Cancel</button>
                <button onClick={() => confirmPicker()} disabled={!canConfirmPicker()}
                  style={{ flex: 2, background: canConfirmPicker() ? TEAL : '#E5E7EB', color: canConfirmPicker() ? WHITE : TEXTL, border: 'none', borderRadius: 14, padding: '14px 0', fontSize: 15, fontWeight: 700, cursor: canConfirmPicker() ? 'pointer' : 'not-allowed' }}>
                  {canConfirmPicker() ? `Add to Order →` : 'Select required options'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP: IDENTITY — Simple name only, no OTP */}
      {step === STEP_IDENTITY && (
        <div style={{ padding: 24, animation: 'fadeIn 0.3s ease' }}>
          <div style={{ textAlign: 'center', marginBottom: 32, marginTop: 20 }}>
            <div style={{ fontSize: 48, marginBottom: 10 }}>🍗</div>
            <div style={{ fontWeight: 800, fontSize: 24, color: TEXTD }}>Welcome!</div>
            <div style={{ color: TEXTL, fontSize: 14, marginTop: 6 }}>{table.name || `Table ${table.number}`} · {table.area || 'Main'}</div>
          </div>
          <div style={{ background: WHITE, borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: TEXTL, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>Your Name</label>
              <input
                value={name}
                onChange={e => { setName(e.target.value); setNameErr('') }}
                placeholder="e.g. Rahul"
                onKeyDown={e => e.key === 'Enter' && handleStartOrdering()}
                style={{ width: '100%', border: '1.5px solid ' + (nameErr ? '#cd6155' : BORDER), borderRadius: 10, padding: '13px 14px', fontSize: 16, color: TEXTD, background: '#FAFAFA' }}
              />
              {nameErr && <div style={{ color: '#cd6155', fontSize: 12, marginTop: 5, fontWeight: 600 }}>{nameErr}</div>}
            </div>
            <button onClick={handleStartOrdering}
              style={{ width: '100%', background: TEAL, color: WHITE, border: 'none', borderRadius: 12, padding: '15px 0', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
              View Menu →
            </button>
          </div>
        </div>
      )}

      {/* STEP: MENU */}
      {step === STEP_MENU && (
        <div style={{ animation: 'fadeIn 0.3s ease', paddingBottom: cartCount > 0 ? 80 : 20 }}>
          <div style={{ background: TEAL + '18', borderBottom: '1px solid ' + TEAL + '22', padding: '10px 20px', fontSize: 13, color: TEAL, fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>👋 Hi <strong>{name}</strong>! {roundCount > 0 ? `Round ${roundCount + 1}` : 'What would you like?'}</span>
            {runningTotal > 0 && <span style={{ fontWeight: 800 }}>₹{runningTotal.toFixed(0)} so far</span>}
          </div>
          <div style={{ padding: '14px 16px 0', position: 'relative' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search dishes..."
              style={{ width: '100%', border: '1.5px solid ' + BORDER, borderRadius: 10, padding: '10px 14px 10px 38px', fontSize: 14, color: TEXTD, background: WHITE }} />
            <span style={{ position: 'absolute', left: 28, top: '50%', transform: 'translateY(-20%)', fontSize: 16 }}>🔍</span>
          </div>
          {!search && (
            <div style={{ display: 'flex', gap: 8, padding: '12px 16px', overflowX: 'auto', scrollbarWidth: 'none' }}>
              {categories.map(cat => (
                <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                  style={{ background: activeCategory === cat.id ? TEAL : WHITE, color: activeCategory === cat.id ? WHITE : TEXTL, border: '1.5px solid ' + (activeCategory === cat.id ? TEAL : BORDER), borderRadius: 20, padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {cat.name}
                </button>
              ))}
            </div>
          )}
          <div style={{ padding: '0 16px' }}>
            {displayItems.map(item => {
              const hasOptions = itemNeedsPicker(item)
              const totalQty   = getQtyForItem(item.id)
              const itemVars   = variations[item.id] || []
              const itemAGs    = addonGroups[item.id] || []
              const itemPorts  = portions[item.id] || []
              return (
                <div key={item.id} style={{ background: WHITE, borderRadius: 12, padding: 14, marginBottom: 10, border: '1px solid ' + (totalQty > 0 ? TEAL2 : BORDER), boxShadow: '0 1px 4px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      {itemVars.length > 0 ? (
                        <div style={{ width: 10, height: 10, borderRadius: 2, border: '2px solid #9CA3AF', background: '#9CA3AF', flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 10, height: 10, borderRadius: 2, border: '2px solid ' + (item.food_type === 'veg' ? '#15803D' : '#a93226'), background: item.food_type === 'veg' ? '#15803D' : '#a93226', flexShrink: 0 }} />
                      )}
                      <div style={{ fontWeight: 700, fontSize: 15, color: TEXTD }}>{item.name}</div>
                    </div>
                    {hasOptions ? (
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#922b21' }}>
                        {itemVars.length > 0 ? `Veg & Non-Veg options available` : ''}
                        {itemVars.length === 0 && itemAGs.length > 0 ? `${itemAGs.length} add-on${itemAGs.length !== 1 ? 's' : ''} available` : ''}
                        {itemPorts.length > 0 && !itemVars.length ? `${itemPorts.length} sizes available` : ''}
                      </div>
                    ) : (
                      <div style={{ fontWeight: 800, fontSize: 15, color: TEAL }}>₹{item.price}</div>
                    )}
                    {item.description && <div style={{ fontSize: 11, color: TEXTL, marginTop: 2 }}>{item.description}</div>}
                    {cart.filter(c => c.item.id === item.id).map(c => (
                      <div key={c.key} style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: TEAL2, fontWeight: 600 }}>
                          {c.variationName || c.portionName || 'Regular'} ×{c.qty} — ₹{((c.unitPrice + c.addonsTotal) * c.qty).toFixed(0)}
                        </span>
                        {c.addons?.length > 0 && <span style={{ fontSize: 10, color: '#C2410C' }}>+ {c.addons.map(a => a.name).join(', ')}</span>}
                        <div style={{ display: 'flex', alignItems: 'center', background: TEAL, borderRadius: 6, overflow: 'hidden' }}>
                          <button onClick={() => removeFromCart(c.key)} style={{ background: 'none', border: 'none', color: WHITE, padding: '3px 8px', fontSize: 14, cursor: 'pointer', fontWeight: 700 }}>-</button>
                          <span style={{ color: WHITE, fontWeight: 800, fontSize: 12, minWidth: 16, textAlign: 'center' }}>{c.qty}</span>
                          <button onClick={() => addToCart(item)} style={{ background: 'none', border: 'none', color: WHITE, padding: '3px 8px', fontSize: 14, cursor: 'pointer', fontWeight: 700 }}>+</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => addToCart(item)}
                    style={{ background: hasOptions ? '#922b21' : TEAL, color: WHITE, border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                    {hasOptions ? 'Choose →' : totalQty === 0 ? '+ Add' : '+ More'}
                  </button>
                </div>
              )
            })}
          </div>
          {cartCount > 0 && (
            <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 40px)', maxWidth: 440, zIndex: 100 }}>
              <button onClick={() => setStep(STEP_CONFIRM)}
                style={{ width: '100%', background: TEAL, color: WHITE, border: 'none', borderRadius: 14, padding: '14px 20px', fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 8px 24px rgba(107,31,31,0.4)' }}>
                <span>🛒 {cartCount} item{cartCount !== 1 ? 's' : ''}</span>
                <span>View Order · ₹{cartTotal.toFixed(0)}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP: CONFIRM */}
      {step === STEP_CONFIRM && (
        <div style={{ padding: 20, animation: 'fadeIn 0.3s ease' }}>
          <button onClick={() => setStep(STEP_MENU)} style={{ background: 'none', border: 'none', color: TEAL, fontWeight: 700, fontSize: 13, cursor: 'pointer', padding: '0 0 16px' }}>← Back to Menu</button>
          <div style={{ fontWeight: 800, fontSize: 20, color: TEXTD, marginBottom: roundCount > 0 ? 6 : 20 }}>
            {roundCount > 0 ? `Round ${roundCount + 1} — Add to Order` : 'Your Order'}
          </div>
          {roundCount > 0 && <div style={{ fontSize: 13, color: TEXTL, marginBottom: 16 }}>These items will be added to your existing order (₹{runningTotal.toFixed(0)} so far)</div>}
          <div style={{ background: WHITE, borderRadius: 16, overflow: 'hidden', border: '1px solid ' + BORDER, marginBottom: 16 }}>
            {cart.map((c, i) => (
              <div key={c.key} style={{ padding: '14px 16px', borderBottom: i < cart.length - 1 ? '1px solid ' + BORDER : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: TEXTD }}>{c.item.name}</div>
                  {c.variationName && <div style={{ fontSize: 12, color: '#922b21', fontWeight: 600, marginTop: 2 }}>{c.variationName}</div>}
                  {c.portionName && <div style={{ fontSize: 12, color: TEAL2, fontWeight: 600, marginTop: 2 }}>{c.portionName}</div>}
                  {c.addons?.length > 0 && <div style={{ fontSize: 11, color: '#C2410C', marginTop: 2 }}>+ {c.addons.map(a => a.name).join(', ')}</div>}
                  <div style={{ fontSize: 12, color: TEXTL }}>₹{(c.unitPrice + c.addonsTotal).toFixed(0)} each</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', background: BG, borderRadius: 8, overflow: 'hidden' }}>
                    <button onClick={() => removeFromCart(c.key)} style={{ background: 'none', border: 'none', padding: '6px 10px', fontSize: 16, cursor: 'pointer', color: TEAL, fontWeight: 700 }}>-</button>
                    <span style={{ fontWeight: 800, fontSize: 14, minWidth: 20, textAlign: 'center', color: TEXTD }}>{c.qty}</span>
                    <button onClick={() => addToCart(c.item)} style={{ background: 'none', border: 'none', padding: '6px 10px', fontSize: 16, cursor: 'pointer', color: TEAL, fontWeight: 700 }}>+</button>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: TEXTD, minWidth: 60, textAlign: 'right' }}>₹{((c.unitPrice + c.addonsTotal) * c.qty).toFixed(0)}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ background: WHITE, borderRadius: 16, padding: 16, border: '1px solid ' + BORDER, marginBottom: 20 }}>
            {roundCount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: TEXTL, marginBottom: 8 }}><span>Previous rounds</span><span>₹{runningTotal.toFixed(0)}</span></div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: TEXTL, marginBottom: 8 }}><span>This round</span><span>₹{cartTotal.toFixed(0)}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: TEXTL, paddingBottom: 12, borderBottom: '1px solid ' + BORDER, marginBottom: 12 }}><span>GST</span><span>Included</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 800, color: TEXTD }}><span>New Total</span><span>₹{(runningTotal + cartTotal).toFixed(0)}</span></div>
          </div>
          <div style={{ background: TEAL + '10', borderRadius: 12, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: TEAL, fontWeight: 600 }}>
            📋 Order for <strong>{name}</strong> · {table.name || `Table ${table.number}`}
          </div>
          <button onClick={placeOrder} disabled={submitting || cart.length === 0}
            style={{ width: '100%', background: TEAL, color: WHITE, border: 'none', borderRadius: 14, padding: '15px 0', fontSize: 16, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.8 : 1 }}>
            {submitting ? 'Placing Order...' : roundCount > 0 ? '🔥 Add to Order' : '🔥 Place Order'}
          </button>
        </div>
      )}

      {/* STEP: PLACED */}
      {step === STEP_PLACED && (
        <div style={{ padding: 24, animation: 'fadeIn 0.3s ease' }}>
          <div style={{ background: '#fdf9f9', border: '1px solid #fadbd8', borderRadius: 16, padding: 24, textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 48, marginBottom: 10 }}>✅</div>
            <div style={{ fontWeight: 800, fontSize: 20, color: TEAL, marginBottom: 6 }}>{roundCount === 1 ? 'Order Placed!' : `Round ${roundCount} Added!`}</div>
            <div style={{ fontSize: 14, color: TEXTL }}>{roundCount === 1 ? 'Your order is being prepared!' : 'New items sent to kitchen!'}</div>
            {runningTotal > 0 && <div style={{ marginTop: 10, fontWeight: 800, fontSize: 18, color: TEAL }}>Total so far: ₹{runningTotal.toFixed(0)}</div>}
          </div>
          <div style={{ fontWeight: 800, fontSize: 17, color: TEXTD, marginBottom: 16, textAlign: 'center' }}>How would you like to pay?</div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            <button onClick={() => handlePaymentChoice('pay_at_table')} disabled={submitting}
              style={{ flex: 1, background: WHITE, border: '2.5px solid ' + TEAL, borderRadius: 16, padding: '20px 12px', cursor: 'pointer', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🛋</div>
              <div style={{ fontWeight: 800, fontSize: 14, color: TEAL }}>Pay at Table</div>
              <div style={{ fontSize: 11, color: TEXTL, lineHeight: 1.4 }}>Staff will come to you</div>
            </button>
            <button onClick={() => handlePaymentChoice('pay_at_reception')} disabled={submitting}
              style={{ flex: 1, background: WHITE, border: '2.5px solid ' + TEAL, borderRadius: 16, padding: '20px 12px', cursor: 'pointer', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🏧</div>
              <div style={{ fontWeight: 800, fontSize: 14, color: TEAL }}>Pay at Reception</div>
              <div style={{ fontSize: 11, color: TEXTL, lineHeight: 1.4 }}>Visit the counter</div>
            </button>
          </div>
          <button onClick={() => { setCart([]); setStep(STEP_MENU) }}
            style={{ width: '100%', background: BG, border: '1px solid ' + BORDER, borderRadius: 14, padding: '13px 0', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: TEXTL }}>
            + Order More Items
          </button>
        </div>
      )}

      {/* STEP: PAYMENT */}
      {step === STEP_PAYMENT && (
        <div style={{ padding: 24, animation: 'fadeIn 0.3s ease' }}>
          <div style={{ background: WHITE, borderRadius: 20, padding: 32, textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', marginBottom: 20 }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>{paymentPref === 'pay_at_table' ? '🛋' : '🏧'}</div>
            <div style={{ fontWeight: 800, fontSize: 22, color: TEXTD, marginBottom: 10 }}>{paymentPref === 'pay_at_table' ? 'Pay at Table' : 'Pay at Reception'}</div>
            <div style={{ fontSize: 14, color: TEXTL, lineHeight: 1.6, marginBottom: 24 }}>
              {paymentPref === 'pay_at_table' ? 'Stay seated — a staff member will come to your table to collect payment.' : "Please visit the reception counter when you're ready to pay."}
            </div>
            <div style={{ background: TEAL + '10', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: TEAL, fontWeight: 600, marginBottom: 8 }}>
              📋 {table.name || `Table ${table.number}`} · {name} · ₹{runningTotal.toFixed(0)}
            </div>
            <div style={{ fontSize: 12, color: TEXTL, marginTop: 8 }}>✓ Staff has been notified</div>
          </div>
          <button onClick={() => { setCart([]); setStep(STEP_MENU) }}
            style={{ width: '100%', background: TEAL, color: WHITE, border: 'none', borderRadius: 14, padding: '14px 0', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            + Order More Items
          </button>
        </div>
      )}
    </div>
  )
}