import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const TEAL  = '#092b33'
const TEAL2 = '#0D9488'
const GOLD  = '#D4A853'
const BG    = '#F4F6F5'
const WHITE = '#FFFFFF'
const BORDER = '#E5E7EB'
const TEXTD = '#1a1a1a'
const TEXTL = '#6B7280'

const STEP_IDENTITY = 'identity'
const STEP_OTP      = 'otp'
const STEP_MENU     = 'menu'
const STEP_CONFIRM  = 'confirm'
const STEP_PLACED   = 'placed'
const STEP_PAYMENT  = 'payment'

function generateOTP() { return Math.floor(100000 + Math.random() * 900000).toString() }

async function sendOTPviaWATI(phone, otp) {
  try {
    const response = await fetch('/api/send-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, otp }) })
    return response.ok
  } catch { return false }
}

export default function CustomerMenuPage() {
  const { tableId } = useParams()
  const [step, setStep]             = useState(STEP_IDENTITY)
  const [table, setTable]           = useState(null)
  const [categories, setCategories] = useState([])
  const [items, setItems]           = useState([])
  const [portions, setPortions]     = useState({})
  const [variations, setVariations] = useState({})
  const [addonGroups, setAddonGroups] = useState({})  // itemId -> flat addons[]
  const [activeCategory, setActiveCategory] = useState(null)
  const [cart, setCart]             = useState([])
  const [search, setSearch]         = useState('')
  const [loading, setLoading]       = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const [placedOrderId, setPlacedOrderId] = useState(null)
  const [paymentPref, setPaymentPref]     = useState(null)
  const [roundCount, setRoundCount]       = useState(0)
  const [runningTotal, setRunningTotal]   = useState(0)

  const [name, setName]   = useState('')
  const [phone, setPhone] = useState('')
  const [nameErr, setNameErr]   = useState('')
  const [phoneErr, setPhoneErr] = useState('')

  const [otp, setOtp]                   = useState(['', '', '', '', '', ''])
  const [generatedOtp, setGeneratedOtp] = useState('')
  const [otpError, setOtpError]         = useState('')
  const [resendTimer, setResendTimer]   = useState(30)
  const otpRefs = useRef([])

  const [pickerItem, setPickerItem]           = useState(null)
  const [pickerVariation, setPickerVariation] = useState(null)
  const [pickerAddons, setPickerAddons]       = useState({}) // addonId -> qty (flat)

  useEffect(() => { fetchData() }, [tableId])
  useEffect(() => {
    if (step !== STEP_OTP) return
    let t = 30; setResendTimer(t)
    const interval = setInterval(() => { t -= 1; setResendTimer(t); if (t <= 0) clearInterval(interval) }, 1000)
    return () => clearInterval(interval)
  }, [step])

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

    if (availableCats?.length) setActiveCategory(availableCats[0].id)
    setLoading(false)
  }

  async function refreshRunningTotal(orderId) {
    const { data } = await supabase.from('order_items').select('quantity, unit_price, addons_total').eq('order_id', orderId)
    setRunningTotal((data || []).reduce((s, i) => s + i.quantity * (i.unit_price + (i.addons_total || 0)), 0))
  }

  async function handleSendOTP() {
    setNameErr(''); setPhoneErr('')
    if (!name.trim()) return setNameErr('Please enter your name')
    if (!/^[6-9]\d{9}$/.test(phone)) return setPhoneErr('Enter a valid 10-digit mobile number')
    setSubmitting(true)
    const newOtp = generateOTP(); setGeneratedOtp(newOtp)
    const sent = await sendOTPviaWATI(phone, newOtp)
    setSubmitting(false)
    if (!sent) return setPhoneErr('Failed to send OTP. Please try again.')
    setStep(STEP_OTP)
  }

  function handleOtpInput(val, idx) {
    const digit = val.replace(/\D/g, '').slice(0, 1)
    const newOtp = [...otp]; newOtp[idx] = digit; setOtp(newOtp); setOtpError('')
    if (digit && idx < 5) otpRefs.current[idx + 1]?.focus()
  }
  function handleOtpKeyDown(e, idx) { if (e.key === 'Backspace' && !otp[idx] && idx > 0) otpRefs.current[idx - 1]?.focus() }
  function handleVerifyOTP() {
    const entered = otp.join('')
    if (entered.length < 6) return setOtpError('Enter the 6-digit OTP')
    if (entered !== generatedOtp) return setOtpError('Incorrect OTP. Please try again.')
    setStep(STEP_MENU)
  }
  async function handleResendOTP() {
    const newOtp = generateOTP(); setGeneratedOtp(newOtp); setOtp(['','','','','','']); setOtpError(''); setResendTimer(30)
    await sendOTPviaWATI(phone, newOtp)
  }

  // Item Picker
  function itemNeedsPicker(item) {
    return (variations[item.id]?.length > 0) || (addonGroups[item.id]?.length > 0) || (portions[item.id]?.length > 0)
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
        const { data: order, error: oErr } = await supabase.from('orders').insert({ table_id: tableId, order_type: 'dine_in', customer_name: name, customer_phone: phone, covers: 1, status: 'active' }).select().single()
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
        <div style={{ width: 38, height: 38, background: GOLD, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>☕</div>
        <div>
          <div style={{ color: WHITE, fontWeight: 800, fontSize: 16 }}>Bambini Cafe</div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{table.name || `Table ${table.number}`}{table.area ? ` · ${table.area}` : ''}</div>
        </div>
        {step === STEP_MENU && cartCount > 0 && (
          <button onClick={() => setStep(STEP_CONFIRM)} style={{ marginLeft: 'auto', background: GOLD, border: 'none', borderRadius: 20, padding: '6px 14px', color: TEAL, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
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
              <div style={{ width: 10, height: 10, borderRadius: 2, background: pickerItem.food_type === 'veg' ? '#15803D' : '#B91C1C', flexShrink: 0 }} />
              <div style={{ fontWeight: 800, fontSize: 17, color: TEXTD, flex: 1 }}>{pickerItem.name}</div>
              {!variations[pickerItem.id]?.length && !portions[pickerItem.id]?.length && (
                <div style={{ fontWeight: 900, fontSize: 16, color: TEAL }}>₹{pickerItem.price}</div>
              )}
            </div>

            {/* Variations */}
            {(variations[pickerItem.id] || []).length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: TEXTD, marginBottom: 12 }}>
                  Variation <span style={{ color: '#B91C1C', fontSize: 11, fontWeight: 600 }}>* Required</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
                  {(variations[pickerItem.id] || []).map(v => {
                    const dotColor = /chicken|mutton|prawn|fish|egg|non.?veg/i.test(v.name) ? '#B91C1C' : '#15803D'
                    return (
                      <button key={v.id} onClick={() => setPickerVariation(v)}
                        style={{ background: pickerVariation?.id === v.id ? '#5B21B6' : '#F5F3FF', color: pickerVariation?.id === v.id ? WHITE : '#3B0764', border: '2px solid ' + (pickerVariation?.id === v.id ? '#5B21B6' : '#C4B5FD'), borderRadius: 14, padding: '16px 10px', cursor: 'pointer', textAlign: 'center' }}>
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

            {/* Portions (only if no variations) */}
            {(portions[pickerItem.id] || []).length > 0 && !(variations[pickerItem.id] || []).length && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: TEXTD, marginBottom: 12 }}>
                  Portion / Size <span style={{ color: '#B91C1C', fontSize: 11, fontWeight: 600 }}>* Required</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(portions[pickerItem.id] || []).map(p => (
                    <button key={p.id} onClick={() => confirmPicker(p)}
                      style={{ background: '#F0FDF4', border: '2px solid #86EFAC', borderRadius: 14, padding: '14px 18px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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

            {/* Add-ons (flat) */}
            {(addonGroups[pickerItem.id] || []).length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: TEXTD, marginBottom: 10 }}>
                  Add-ons <span style={{ fontSize: 11, fontWeight: 400, color: TEXTL }}>optional</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(addonGroups[pickerItem.id] || []).map(addon => {
                    const qty = pickerAddons[addon.id] || 0
                    return (
                      <div key={addon.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: qty > 0 ? '#FFF7ED' : '#F9FAFB', borderRadius: 12, border: '1px solid ' + (qty > 0 ? '#FED7AA' : BORDER) }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 15, color: TEXTD }}>{addon.name}</div>
                          {addon.price > 0 && <div style={{ fontSize: 12, color: '#C2410C', fontWeight: 600, marginTop: 2 }}>+₹{addon.price}</div>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {qty > 0 && (
                            <>
                              <button onClick={() => adjustAddon(addon, -1)}
                                style={{ background: '#FEE2E2', border: 'none', borderRadius: 8, width: 32, height: 32, fontSize: 18, cursor: 'pointer', fontWeight: 700, color: '#B91C1C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>-</button>
                              <span style={{ fontWeight: 800, fontSize: 16, minWidth: 20, textAlign: 'center' }}>{qty}</span>
                            </>
                          )}
                          <button onClick={() => adjustAddon(addon, 1)}
                            style={{ background: TEAL, border: 'none', borderRadius: 8, width: 32, height: 32, fontSize: 18, cursor: 'pointer', fontWeight: 700, color: WHITE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Confirm button */}
            {((variations[pickerItem.id] || []).length > 0 || (addonGroups[pickerItem.id] || []).length > 0) && (
              <div style={{ display: 'flex', gap: 10, paddingTop: 8 }}>
                <button onClick={closePicker}
                  style={{ flex: 1, background: BG, border: '1px solid ' + BORDER, borderRadius: 14, padding: '14px 0', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: TEXTL }}>
                  Cancel
                </button>
                <button onClick={() => confirmPicker()} disabled={!canConfirmPicker()}
                  style={{ flex: 2, background: canConfirmPicker() ? TEAL : '#E5E7EB', color: canConfirmPicker() ? WHITE : TEXTL, border: 'none', borderRadius: 14, padding: '14px 0', fontSize: 15, fontWeight: 700, cursor: canConfirmPicker() ? 'pointer' : 'not-allowed' }}>
                  {canConfirmPicker() ? `Add to Order →` : 'Select required options'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP: IDENTITY */}
      {step === STEP_IDENTITY && (
        <div style={{ padding: 24, animation: 'fadeIn 0.3s ease' }}>
          <div style={{ textAlign: 'center', marginBottom: 32, marginTop: 12 }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>👋</div>
            <div style={{ fontWeight: 800, fontSize: 22, color: TEXTD }}>Welcome!</div>
            <div style={{ color: TEXTL, fontSize: 14, marginTop: 6 }}>Tell us who you are to start ordering</div>
          </div>
          <div style={{ background: WHITE, borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: TEXTL, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>Your Name</label>
              <input value={name} onChange={e => { setName(e.target.value); setNameErr('') }} placeholder="e.g. Rahul Sharma"
                style={{ width: '100%', border: '1.5px solid ' + (nameErr ? '#EF4444' : BORDER), borderRadius: 10, padding: '12px 14px', fontSize: 15, color: TEXTD, background: '#FAFAFA' }} />
              {nameErr && <div style={{ color: '#EF4444', fontSize: 12, marginTop: 5, fontWeight: 600 }}>{nameErr}</div>}
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: TEXTL, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>WhatsApp Number</label>
              <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid ' + (phoneErr ? '#EF4444' : BORDER), borderRadius: 10, background: '#FAFAFA', overflow: 'hidden' }}>
                <div style={{ padding: '12px', borderRight: '1px solid ' + BORDER, color: TEXTL, fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}>🇮🇳 +91</div>
                <input value={phone} onChange={e => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setPhoneErr('') }} placeholder="10-digit number" type="tel" inputMode="numeric"
                  style={{ flex: 1, border: 'none', background: 'transparent', padding: '12px 14px', fontSize: 15, color: TEXTD }} />
              </div>
              {phoneErr && <div style={{ color: '#EF4444', fontSize: 12, marginTop: 5, fontWeight: 600 }}>{phoneErr}</div>}
              <div style={{ fontSize: 11, color: TEXTL, marginTop: 6 }}>📲 OTP will be sent to this WhatsApp number</div>
            </div>
            <button onClick={handleSendOTP} disabled={submitting}
              style={{ width: '100%', background: TEAL, color: WHITE, border: 'none', borderRadius: 12, padding: '14px 0', fontSize: 15, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.8 : 1 }}>
              {submitting ? 'Sending OTP...' : 'Get OTP on WhatsApp →'}
            </button>
          </div>
        </div>
      )}

      {/* STEP: OTP */}
      {step === STEP_OTP && (
        <div style={{ padding: 24, animation: 'fadeIn 0.3s ease' }}>
          <button onClick={() => { setStep(STEP_IDENTITY); setOtp(['','','','','','']); setOtpError('') }} style={{ background: 'none', border: 'none', color: TEAL, fontWeight: 700, fontSize: 13, cursor: 'pointer', padding: '0 0 20px', display: 'flex', alignItems: 'center', gap: 4 }}>← Back</button>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📲</div>
            <div style={{ fontWeight: 800, fontSize: 22, color: TEXTD }}>Enter OTP</div>
            <div style={{ color: TEXTL, fontSize: 14, marginTop: 6 }}>Sent to <strong style={{ color: TEXTD }}>+91 {phone}</strong> on WhatsApp</div>
          </div>
          <div style={{ background: WHITE, borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 20 }}>
              {otp.map((digit, idx) => (
                <input key={idx} ref={el => otpRefs.current[idx] = el} value={digit} onChange={e => handleOtpInput(e.target.value, idx)} onKeyDown={e => handleOtpKeyDown(e, idx)} maxLength={1} inputMode="numeric" type="tel"
                  style={{ width: 46, height: 56, textAlign: 'center', fontSize: 22, fontWeight: 800, border: '2px solid ' + (digit ? TEAL : BORDER), borderRadius: 10, color: TEXTD, background: digit ? '#F0FDF9' : '#FAFAFA' }} />
              ))}
            </div>
            {otpError && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', color: '#DC2626', fontSize: 13, fontWeight: 600, textAlign: 'center', marginBottom: 16 }}>{otpError}</div>}
            <button onClick={handleVerifyOTP} style={{ width: '100%', background: TEAL, color: WHITE, border: 'none', borderRadius: 12, padding: '14px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 16 }}>Verify OTP</button>
            <div style={{ textAlign: 'center', fontSize: 13, color: TEXTL }}>
              {resendTimer > 0 ? <>Resend OTP in <strong style={{ color: TEXTD }}>{resendTimer}s</strong></> : <button onClick={handleResendOTP} style={{ background: 'none', border: 'none', color: TEAL, fontWeight: 700, fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>Resend OTP</button>}
            </div>
          </div>
        </div>
      )}

      {/* STEP: MENU */}
      {step === STEP_MENU && (
        <div style={{ animation: 'fadeIn 0.3s ease', paddingBottom: cartCount > 0 ? 80 : 20 }}>
          <div style={{ background: TEAL + '18', borderBottom: '1px solid ' + TEAL + '22', padding: '10px 20px', fontSize: 13, color: TEAL, fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>👋 Hi <strong>{name}</strong>! {roundCount > 0 ? `Round ${roundCount + 1}` : 'What would you like to order?'}</span>
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
                        <div style={{ width: 10, height: 10, borderRadius: 2, border: '2px solid ' + (item.food_type === 'veg' ? '#15803D' : '#B91C1C'), background: item.food_type === 'veg' ? '#15803D' : '#B91C1C', flexShrink: 0 }} />
                      )}
                      <div style={{ fontWeight: 700, fontSize: 15, color: TEXTD }}>{item.name}</div>
                    </div>
                    {hasOptions ? (
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#5B21B6' }}>
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
                    style={{ background: hasOptions ? '#5B21B6' : TEAL, color: WHITE, border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                    {hasOptions ? 'Choose →' : totalQty === 0 ? '+ Add' : '+ More'}
                  </button>
                </div>
              )
            })}
          </div>
          {cartCount > 0 && (
            <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 40px)', maxWidth: 440, zIndex: 100 }}>
              <button onClick={() => setStep(STEP_CONFIRM)}
                style={{ width: '100%', background: TEAL, color: WHITE, border: 'none', borderRadius: 14, padding: '14px 20px', fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 8px 24px rgba(9,43,51,0.4)' }}>
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
                  {c.variationName && <div style={{ fontSize: 12, color: '#5B21B6', fontWeight: 600, marginTop: 2 }}>{c.variationName}</div>}
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
          <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 16, padding: 24, textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 48, marginBottom: 10 }}>✅</div>
            <div style={{ fontWeight: 800, fontSize: 20, color: '#15803D', marginBottom: 6 }}>{roundCount === 1 ? 'Order Placed!' : `Round ${roundCount} Added!`}</div>
            <div style={{ fontSize: 14, color: '#166534' }}>{roundCount === 1 ? 'Your order is being prepared!' : 'New items sent to kitchen!'}</div>
            {runningTotal > 0 && <div style={{ marginTop: 10, fontWeight: 800, fontSize: 18, color: '#15803D' }}>Total so far: ₹{runningTotal.toFixed(0)}</div>}
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

      {/* STEP: PAYMENT CONFIRMATION */}
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