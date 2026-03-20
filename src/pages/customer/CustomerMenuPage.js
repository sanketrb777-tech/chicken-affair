import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const TEAL    = '#092b33'
const TEAL2   = '#0D9488'
const GOLD    = '#D4A853'
const BG      = '#F4F6F5'
const WHITE   = '#FFFFFF'
const BORDER  = '#E5E7EB'
const TEXTD   = '#1a1a1a'
const TEXTL   = '#6B7280'

const STEP_IDENTITY = 'identity'
const STEP_OTP      = 'otp'
const STEP_MENU     = 'menu'
const STEP_CONFIRM  = 'confirm'
const STEP_PLACED   = 'placed'

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

async function sendOTPviaWATI(phone, otp) {
  try {
    const response = await fetch(
      `https://live-mt-server.wati.io/10112850/api/v1/sendTemplateMessage?whatsappNumber=91${phone}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': process.env.REACT_APP_WATI_TOKEN,
        },
        body: JSON.stringify({
          template_name: 'bambini_otp',
          broadcast_name: 'bambini_otp',
          parameters: [
            { name: '1', value: otp },
            { name: '2', value: '5' },
          ],
        }),
      }
    )
    const data = await response.json()
    console.log('WATI response:', data)
    return true
  } catch (err) {
    console.error('WATI error:', err)
    return false
  }
}

export default function CustomerMenuPage() {
  const { tableId } = useParams()
  const [step, setStep]         = useState(STEP_IDENTITY)
  const [table, setTable]       = useState(null)
  const [categories, setCategories] = useState([])
  const [items, setItems]       = useState([])
  const [activeCategory, setActiveCategory] = useState(null)
  const [cart, setCart]         = useState([])
  const [search, setSearch]     = useState('')
  const [loading, setLoading]   = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [placedOrder, setPlacedOrder] = useState(null)

  const [name, setName]   = useState('')
  const [phone, setPhone] = useState('')
  const [nameErr, setNameErr]   = useState('')
  const [phoneErr, setPhoneErr] = useState('')

  const [otp, setOtp]         = useState(['', '', '', '', '', ''])
  const [generatedOtp, setGeneratedOtp] = useState('')
  const [otpError, setOtpError]   = useState('')
  const [resendTimer, setResendTimer] = useState(30)
  const otpRefs = useRef([])

  useEffect(() => { fetchData() }, [tableId])

  useEffect(() => {
    if (step === STEP_OTP) {
      let t = 30
      setResendTimer(t)
      const interval = setInterval(() => {
        t -= 1
        setResendTimer(t)
        if (t <= 0) clearInterval(interval)
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [step])

  async function fetchData() {
    const [{ data: tableData }, { data: cats }, { data: menuItems }] = await Promise.all([
      supabase.from('cafe_tables').select('*').eq('id', tableId).single(),
      supabase.from('menu_categories').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('menu_items').select('*').eq('is_available', true).order('sort_order'),
    ])
    setTable(tableData)
    setCategories(cats || [])
    setItems(menuItems || [])
    if (cats?.length) setActiveCategory(cats[0].id)
    setLoading(false)
  }

  async function handleSendOTP() {
    setNameErr('')
    setPhoneErr('')
    if (!name.trim()) return setNameErr('Please enter your name')
    if (!/^[6-9]\d{9}$/.test(phone)) return setPhoneErr('Enter a valid 10-digit Indian mobile number')
    setSubmitting(true)
    const newOtp = generateOTP()
    setGeneratedOtp(newOtp)
    const sent = await sendOTPviaWATI(phone, newOtp)
    setSubmitting(false)
    if (!sent) return setPhoneErr('Failed to send OTP. Please try again.')
    setStep(STEP_OTP)
  }

  function handleOtpInput(val, idx) {
    const digits = val.replace(/\D/g, '').slice(0, 1)
    const newOtp = [...otp]
    newOtp[idx] = digits
    setOtp(newOtp)
    setOtpError('')
    if (digits && idx < 5) otpRefs.current[idx + 1]?.focus()
  }

  function handleOtpKeyDown(e, idx) {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus()
    }
  }

  function handleVerifyOTP() {
    const entered = otp.join('')
    if (entered.length < 6) return setOtpError('Enter the 6-digit OTP')
    if (entered !== generatedOtp) return setOtpError('Incorrect OTP. Please try again.')
    setStep(STEP_MENU)
  }

  async function handleResendOTP() {
    const newOtp = generateOTP()
    setGeneratedOtp(newOtp)
    setOtp(['', '', '', '', '', ''])
    setOtpError('')
    await sendOTPviaWATI(phone, newOtp)
    setResendTimer(30)
  }

  function addToCart(item) {
    setCart(prev => {
      const ex = prev.find(c => c.item.id === item.id)
      if (ex) return prev.map(c => c.item.id === item.id ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { item, qty: 1 }]
    })
  }

  function removeFromCart(itemId) {
    setCart(prev => {
      const ex = prev.find(c => c.item.id === itemId)
      if (ex?.qty > 1) return prev.map(c => c.item.id === itemId ? { ...c, qty: c.qty - 1 } : c)
      return prev.filter(c => c.item.id !== itemId)
    })
  }

  function getQty(itemId) { return cart.find(c => c.item.id === itemId)?.qty || 0 }

  const cartTotal = cart.reduce((s, c) => s + c.item.price * c.qty, 0)
  const cartCount = cart.reduce((s, c) => s + c.qty, 0)

  async function placeOrder() {
    if (cart.length === 0) return
    setSubmitting(true)
    try {
      const { data: order, error: oErr } = await supabase.from('orders').insert({
        table_id: tableId,
        order_type: 'dine_in',
        customer_name: name,
        customer_phone: phone,
        covers: 1,
        status: 'active',
      }).select().single()
      if (oErr) throw oErr

      await supabase.from('cafe_tables').update({ status: 'occupied' }).eq('id', tableId)

      const orderItems = cart.map(c => ({
        order_id: order.id,
        item_id: c.item.id,
        quantity: c.qty,
        unit_price: c.item.price,
        status: 'pending',
      }))
      const { data: createdItems, error: iErr } = await supabase.from('order_items').insert(orderItems).select()
      if (iErr) throw iErr

      const { data: kot, error: kErr } = await supabase.from('kots').insert({ order_id: order.id, status: 'pending' }).select().single()
      if (kErr) throw kErr

      await supabase.from('kot_items').insert(createdItems.map(oi => ({ kot_id: kot.id, order_item_id: oi.id, is_done: false })))

      setPlacedOrder(order)
      setStep(STEP_PLACED)
    } catch (err) {
      alert('Something went wrong. Please try again.\n' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const displayItems = search
    ? items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    : items.filter(i => i.category_id === activeCategory)

  if (loading) return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 48, height: 48, border: '4px solid ' + BORDER, borderTopColor: TEAL, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
        <div style={{ color: TEXTL, fontSize: 14 }}>Loading menu...</div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  if (!table) return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: TEXTL }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
        <div style={{ fontWeight: 700, color: TEXTD }}>Table not found</div>
        <div style={{ fontSize: 13, marginTop: 6 }}>Please scan the correct QR code.</div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: "'DM Sans', 'Segoe UI', sans-serif", maxWidth: 480, margin: '0 auto' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; }
        input:focus { outline: none; }
      `}</style>

      {/* HEADER */}
      <div style={{ background: TEAL, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ width: 38, height: 38, background: GOLD, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>☕</div>
        <div>
          <div style={{ color: WHITE, fontWeight: 800, fontSize: 16 }}>Bambini Cafe</div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
            {table.name || `Table ${table.number}`} {table.area ? `· ${table.area}` : ''}
          </div>
        </div>
        {step === STEP_MENU && cartCount > 0 && (
          <button onClick={() => setStep(STEP_CONFIRM)}
            style={{ marginLeft: 'auto', background: GOLD, border: 'none', borderRadius: 20, padding: '6px 14px', color: TEAL, fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            🛒 {cartCount} · ₹{cartTotal}
          </button>
        )}
      </div>

      {/* STEP: IDENTITY */}
      {step === STEP_IDENTITY && (
        <div style={{ padding: 24, animation: 'fadeIn 0.3s ease' }}>
          <div style={{ textAlign: 'center', marginBottom: 32, marginTop: 12 }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>👋</div>
            <div style={{ fontWeight: 800, fontSize: 22, color: TEXTD }}>Welcome!</div>
            <div style={{ color: TEXTL, fontSize: 14, marginTop: 6 }}>Tell us who you are to start ordering</div>
          </div>

          <div style={{ background: WHITE, borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: TEXTL, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>Your Name</label>
              <input value={name} onChange={e => { setName(e.target.value); setNameErr('') }}
                placeholder="e.g. Rahul Sharma"
                style={{ width: '100%', border: '1.5px solid ' + (nameErr ? '#EF4444' : BORDER), borderRadius: 10, padding: '12px 14px', fontSize: 15, color: TEXTD, background: '#FAFAFA' }} />
              {nameErr && <div style={{ color: '#EF4444', fontSize: 12, marginTop: 5, fontWeight: 600 }}>{nameErr}</div>}
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: TEXTL, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>WhatsApp Number</label>
              <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid ' + (phoneErr ? '#EF4444' : BORDER), borderRadius: 10, background: '#FAFAFA', overflow: 'hidden' }}>
                <div style={{ padding: '12px 12px', borderRight: '1px solid ' + BORDER, color: TEXTL, fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}>🇮🇳 +91</div>
                <input value={phone} onChange={e => { setPhone(e.target.value.replace(/\D/g, '').slice(0, 10)); setPhoneErr('') }}
                  placeholder="10-digit mobile number" type="tel" inputMode="numeric"
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
          <button onClick={() => setStep(STEP_IDENTITY)}
            style={{ background: 'none', border: 'none', color: TEAL, fontWeight: 700, fontSize: 13, cursor: 'pointer', padding: '0 0 20px', display: 'flex', alignItems: 'center', gap: 4 }}>
            ← Back
          </button>

          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📲</div>
            <div style={{ fontWeight: 800, fontSize: 22, color: TEXTD }}>Enter OTP</div>
            <div style={{ color: TEXTL, fontSize: 14, marginTop: 6 }}>
              Sent to <strong style={{ color: TEXTD }}>+91 {phone}</strong> on WhatsApp
            </div>
          </div>

          <div style={{ background: WHITE, borderRadius: 16, padding: 24, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 20 }}>
              {otp.map((digit, idx) => (
                <input key={idx}
                  ref={el => otpRefs.current[idx] = el}
                  value={digit}
                  onChange={e => handleOtpInput(e.target.value, idx)}
                  onKeyDown={e => handleOtpKeyDown(e, idx)}
                  maxLength={1} inputMode="numeric" type="tel"
                  style={{ width: 46, height: 56, textAlign: 'center', fontSize: 22, fontWeight: 800, border: '2px solid ' + (digit ? TEAL : BORDER), borderRadius: 10, color: TEXTD, background: digit ? '#F0FDF9' : '#FAFAFA', transition: 'all 0.15s' }} />
              ))}
            </div>

            {otpError && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', color: '#DC2626', fontSize: 13, fontWeight: 600, textAlign: 'center', marginBottom: 16 }}>
                {otpError}
              </div>
            )}

            <button onClick={handleVerifyOTP}
              style={{ width: '100%', background: TEAL, color: WHITE, border: 'none', borderRadius: 12, padding: '14px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 16 }}>
              Verify OTP
            </button>

            <div style={{ textAlign: 'center', fontSize: 13, color: TEXTL }}>
              {resendTimer > 0
                ? <>Resend OTP in <strong style={{ color: TEXTD }}>{resendTimer}s</strong></>
                : <button onClick={handleResendOTP} style={{ background: 'none', border: 'none', color: TEAL, fontWeight: 700, fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>Resend OTP</button>}
            </div>
          </div>
        </div>
      )}

      {/* STEP: MENU */}
      {step === STEP_MENU && (
        <div style={{ animation: 'fadeIn 0.3s ease', paddingBottom: cartCount > 0 ? 80 : 20 }}>
          <div style={{ background: TEAL + '18', borderBottom: '1px solid ' + TEAL + '22', padding: '10px 20px', fontSize: 13, color: TEAL, fontWeight: 600 }}>
            👋 Hi <strong>{name}</strong>! What would you like to order?
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
              const qty = getQty(item.id)
              return (
                <div key={item.id} style={{ background: WHITE, borderRadius: 12, padding: '14px', marginBottom: 10, border: '1px solid ' + (qty > 0 ? TEAL2 : BORDER), boxShadow: '0 1px 4px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, border: '2px solid ' + (item.food_type === 'veg' ? '#15803D' : '#B91C1C'), background: item.food_type === 'veg' ? '#15803D' : '#B91C1C', flexShrink: 0 }} />
                      <div style={{ fontWeight: 700, fontSize: 15, color: TEXTD }}>{item.name}</div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: TEAL }}>₹{item.price}</div>
                    {item.description && <div style={{ fontSize: 11, color: TEXTL, marginTop: 2 }}>{item.description}</div>}
                  </div>
                  {qty === 0 ? (
                    <button onClick={() => addToCart(item)}
                      style={{ background: TEAL, color: WHITE, border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                      + Add
                    </button>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', background: TEAL, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
                      <button onClick={() => removeFromCart(item.id)} style={{ background: 'none', border: 'none', color: WHITE, padding: '8px 12px', fontSize: 18, cursor: 'pointer', fontWeight: 700 }}>-</button>
                      <span style={{ color: WHITE, fontWeight: 800, fontSize: 14, minWidth: 20, textAlign: 'center' }}>{qty}</span>
                      <button onClick={() => addToCart(item)} style={{ background: 'none', border: 'none', color: WHITE, padding: '8px 12px', fontSize: 18, cursor: 'pointer', fontWeight: 700 }}>+</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {cartCount > 0 && (
            <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 40px)', maxWidth: 440, zIndex: 100 }}>
              <button onClick={() => setStep(STEP_CONFIRM)}
                style={{ width: '100%', background: TEAL, color: WHITE, border: 'none', borderRadius: 14, padding: '14px 20px', fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 8px 24px rgba(9,43,51,0.4)' }}>
                <span>🛒 {cartCount} item{cartCount !== 1 ? 's' : ''}</span>
                <span>View Order · ₹{cartTotal}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP: CONFIRM */}
      {step === STEP_CONFIRM && (
        <div style={{ padding: 20, animation: 'fadeIn 0.3s ease' }}>
          <button onClick={() => setStep(STEP_MENU)}
            style={{ background: 'none', border: 'none', color: TEAL, fontWeight: 700, fontSize: 13, cursor: 'pointer', padding: '0 0 16px', display: 'flex', alignItems: 'center', gap: 4 }}>
            ← Back to Menu
          </button>

          <div style={{ fontWeight: 800, fontSize: 20, color: TEXTD, marginBottom: 20 }}>Your Order</div>

          <div style={{ background: WHITE, borderRadius: 16, overflow: 'hidden', border: '1px solid ' + BORDER, marginBottom: 16 }}>
            {cart.map((c, i) => (
              <div key={c.item.id} style={{ padding: '14px 16px', borderBottom: i < cart.length - 1 ? '1px solid ' + BORDER : 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: TEXTD }}>{c.item.name}</div>
                  <div style={{ fontSize: 12, color: TEXTL }}>₹{c.item.price} each</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', background: BG, borderRadius: 8, overflow: 'hidden' }}>
                    <button onClick={() => removeFromCart(c.item.id)} style={{ background: 'none', border: 'none', padding: '6px 10px', fontSize: 16, cursor: 'pointer', color: TEAL, fontWeight: 700 }}>-</button>
                    <span style={{ fontWeight: 800, fontSize: 14, minWidth: 20, textAlign: 'center', color: TEXTD }}>{c.qty}</span>
                    <button onClick={() => addToCart(c.item)} style={{ background: 'none', border: 'none', padding: '6px 10px', fontSize: 16, cursor: 'pointer', color: TEAL, fontWeight: 700 }}>+</button>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: TEXTD, minWidth: 60, textAlign: 'right' }}>₹{c.item.price * c.qty}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: WHITE, borderRadius: 16, padding: 16, border: '1px solid ' + BORDER, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: TEXTL, marginBottom: 8 }}>
              <span>Subtotal</span><span>₹{cartTotal}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: TEXTL, paddingBottom: 12, borderBottom: '1px solid ' + BORDER, marginBottom: 12 }}>
              <span>GST</span><span>Included</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 800, color: TEXTD }}>
              <span>Total</span><span>₹{cartTotal}</span>
            </div>
          </div>

          <div style={{ background: TEAL + '10', borderRadius: 12, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: TEAL, fontWeight: 600 }}>
            📋 Order for <strong>{name}</strong> · {table.name || `Table ${table.number}`}
          </div>

          <button onClick={placeOrder} disabled={submitting || cart.length === 0}
            style={{ width: '100%', background: TEAL, color: WHITE, border: 'none', borderRadius: 14, padding: '15px 0', fontSize: 16, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.8 : 1 }}>
            {submitting ? 'Placing Order...' : '🔥 Place Order'}
          </button>
        </div>
      )}

      {/* STEP: PLACED */}
      {step === STEP_PLACED && (
        <div style={{ padding: 24, animation: 'fadeIn 0.3s ease' }}>
          <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 16, padding: '24px', textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 48, marginBottom: 10 }}>✅</div>
            <div style={{ fontWeight: 800, fontSize: 20, color: '#15803D', marginBottom: 6 }}>Order Placed!</div>
            <div style={{ fontSize: 14, color: '#166534' }}>Your order is being prepared. We'll serve it to your table shortly.</div>
          </div>

          <div style={{ background: WHITE, borderRadius: 16, overflow: 'hidden', border: '1px solid ' + BORDER, marginBottom: 16 }}>
            <div style={{ background: TEAL, padding: '14px 18px' }}>
              <div style={{ color: WHITE, fontWeight: 800, fontSize: 15 }}>Order Summary</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 }}>
                {table.name || `Table ${table.number}`} · {name}
              </div>
            </div>
            {cart.map((c, i) => (
              <div key={c.item.id} style={{ padding: '12px 16px', borderBottom: i < cart.length - 1 ? '1px solid ' + BORDER : 'none', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, color: TEXTD, fontWeight: 600 }}>{c.item.name} ×{c.qty}</span>
                <span style={{ fontSize: 14, color: TEXTD, fontWeight: 700 }}>₹{c.item.price * c.qty}</span>
              </div>
            ))}
            <div style={{ padding: '14px 16px', background: BG, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 800, fontSize: 15, color: TEXTD }}>Total</span>
              <span style={{ fontWeight: 800, fontSize: 15, color: TEAL }}>₹{cartTotal}</span>
            </div>
          </div>

          <div style={{ fontWeight: 700, fontSize: 15, color: TEXTD, marginBottom: 12 }}>How would you like to pay?</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => alert('Please pay at your table. A staff member will assist you.')}
              style={{ flex: 1, background: WHITE, border: '2px solid ' + TEAL, borderRadius: 14, padding: '16px 12px', cursor: 'pointer', textAlign: 'center' }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>🪑</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: TEAL }}>Pay at Table</div>
              <div style={{ fontSize: 11, color: TEXTL, marginTop: 3 }}>Staff will come to you</div>
            </button>
            <button onClick={() => alert('Please visit the reception counter to pay. Thank you!')}
              style={{ flex: 1, background: WHITE, border: '2px solid ' + TEAL, borderRadius: 14, padding: '16px 12px', cursor: 'pointer', textAlign: 'center' }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>🏧</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: TEAL }}>Pay at Reception</div>
              <div style={{ fontSize: 11, color: TEXTL, marginTop: 3 }}>Visit the counter</div>
            </button>
          </div>

          <button onClick={() => { setCart([]); setStep(STEP_MENU) }}
            style={{ width: '100%', marginTop: 16, background: BG, border: '1px solid ' + BORDER, borderRadius: 14, padding: '13px 0', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: TEXTL }}>
            + Order More Items
          </button>
        </div>
      )}
    </div>
  )
}