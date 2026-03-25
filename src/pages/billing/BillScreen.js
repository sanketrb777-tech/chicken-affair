import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { theme } from '../../lib/theme'

const STEP_BILL    = 'bill'
const STEP_PAYMENT = 'payment'
const STEP_CONFIRM = 'confirm'

const PAY_MODES = [
  { id: 'cash',    label: 'Cash',    icon: '💵', color: '#15803D', bg: '#DCFCE7', border: '#86EFAC' },
  { id: 'card',    label: 'Card',    icon: '💳', color: '#1D4ED8', bg: '#DBEAFE', border: '#93C5FD' },
  { id: 'online',  label: 'Online',  icon: '📱', color: '#6D28D9', bg: '#EDE9FE', border: '#C4B5FD' },
  { id: 'partial', label: 'Partial', icon: '⚖️', color: '#B45309', bg: '#FEF3C7', border: '#FCD34D' },
]

export default function BillScreen() {
  const { orderId } = useParams()
  const navigate    = useNavigate()
  const { profile } = useAuth()

  const [step, setStep]                   = useState(STEP_BILL)
  const [order, setOrder]                 = useState(null)
  const [orderItems, setOrderItems]       = useState([])
  const [discountTypes, setDiscountTypes] = useState([])
  const [gstRate, setGstRate]             = useState(5)
  const [loading, setLoading]             = useState(true)
  const [submitting, setSubmitting]       = useState(false)
  const [billPrinted, setBillPrinted]     = useState(false)

  // Payment state
  const [selectedDiscount, setSelectedDiscount] = useState(null)
  const [payMode, setPayMode]                   = useState(null)   // 'cash' | 'card' | 'online' | 'partial'
  const [cashAmount, setCashAmount]             = useState('')
  const [cardAmount, setCardAmount]             = useState('')
  const [upiAmount, setUpiAmount]               = useState('')
  const [notes, setNotes]                       = useState('')

  useEffect(() => { fetchData() }, [orderId])

  async function fetchData() {
    const { data: ord } = await supabase
      .from('orders').select('*, cafe_tables(number, name), staff(name)').eq('id', orderId).single()
    setOrder(ord)
    const { data: items } = await supabase
      .from('order_items').select('*, menu_items(name, gst_rate)').eq('order_id', orderId)
    setOrderItems(items || [])
    const { data: discounts } = await supabase
      .from('discount_types').select('*').eq('is_active', true).order('name')
    setDiscountTypes(discounts || [])
    const { data: setting } = await supabase
      .from('app_settings').select('value').eq('key', 'gst_rate').single()
    if (setting) setGstRate(parseFloat(setting.value))
    setLoading(false)
  }

  // ── Calculations ──
  const subtotal       = orderItems.reduce((sum, i) => sum + i.quantity * i.unit_price, 0)
  const discountPct    = selectedDiscount ? parseFloat(selectedDiscount.percentage) : 0
  const discountFactor = 1 - discountPct / 100
  const discountAmount = parseFloat(((subtotal * discountPct) / 100).toFixed(2))
  const afterDiscount  = subtotal - discountAmount

  const gstBreakdown = {}
  let totalGST = 0
  orderItems.forEach(item => {
    const itemTotal = item.quantity * item.unit_price * discountFactor
    const rate      = item.menu_items?.gst_rate ?? gstRate
    if (rate === 0) return
    const itemGST   = parseFloat(((itemTotal * rate) / (100 + rate)).toFixed(2))
    totalGST       += itemGST
    gstBreakdown[rate] = (gstBreakdown[rate] || 0) + itemGST
  })
  totalGST         = parseFloat(totalGST.toFixed(2))
  const grandTotal = afterDiscount

  const totalPaid = (parseFloat(cashAmount) || 0) + (parseFloat(cardAmount) || 0) + (parseFloat(upiAmount) || 0)
  const balance   = parseFloat((grandTotal - totalPaid).toFixed(2))

  const orderLabel = order?.cafe_tables
    ? (order.cafe_tables.name || `Table ${order.cafe_tables.number}`)
    : order?.customer_name || 'Order'

  // ── When pay mode changes, auto-fill amount ──
  function selectPayMode(mode) {
    setPayMode(mode)
    setCashAmount(''); setCardAmount(''); setUpiAmount('')
    if (mode === 'cash')   setCashAmount(grandTotal.toFixed(2))
    if (mode === 'card')   setCardAmount(grandTotal.toFixed(2))
    if (mode === 'online') setUpiAmount(grandTotal.toFixed(2))
    // partial: leave empty for manual input
  }

  // ── Print ──
  function printBill() {
    const now = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
    const paymentLine = [
      parseFloat(cashAmount) > 0 ? `Cash: ₹${parseFloat(cashAmount).toFixed(2)}`   : null,
      parseFloat(cardAmount) > 0 ? `Card: ₹${parseFloat(cardAmount).toFixed(2)}`   : null,
      parseFloat(upiAmount)  > 0 ? `UPI/Online: ₹${parseFloat(upiAmount).toFixed(2)}` : null,
    ].filter(Boolean).join(' + ')

    const receiptHTML = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <title>Bambini Cafe - Bill</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Courier New',monospace; font-size:12px; width:80mm; margin:0 auto; padding:8px; color:#000; }
        .center { text-align:center; }
        .bold { font-weight:bold; }
        .divider { border-top:1px dashed #000; margin:6px 0; }
        .row { display:flex; justify-content:space-between; margin:3px 0; }
        .row-3 { display:flex; margin:3px 0; }
        .row-3 .name { flex:1; }
        .row-3 .qty  { width:30px; text-align:center; }
        .row-3 .rate { width:55px; text-align:right; }
        .row-3 .amt  { width:65px; text-align:right; }
        .total-row { display:flex; justify-content:space-between; font-size:14px; font-weight:bold; margin:4px 0; }
        .small { font-size:10px; color:#444; }
        .logo { font-size:18px; font-weight:bold; letter-spacing:1px; }
        @media print { body { width:80mm; } @page { size:80mm auto; margin:0; } }
      </style></head><body>
      <div class="center" style="margin-bottom:10px">
        <div class="logo">Bambini Cafe</div>
        <div class="small" style="margin-top:2px">The Lake Side Cafe</div>
        <div class="small" style="margin-top:4px">${now}</div>
      </div>
      <div class="divider"></div>
      <div class="row"><span>${orderLabel}</span><span>${order?.order_type?.replace('_',' ') || ''}</span></div>
      <div class="row small"><span>Covers: ${order?.covers || 1}</span><span>Staff: ${order?.staff?.name || ''}</span></div>
      <div class="divider"></div>
      <div class="row-3 bold small">
        <span class="name">ITEM</span><span class="qty">QTY</span><span class="rate">RATE</span><span class="amt">AMT</span>
      </div>
      <div class="divider"></div>
      ${orderItems.map(item => `
        <div class="row-3">
          <span class="name">${item.menu_items?.name || ''}</span>
          <span class="qty">${item.quantity}</span>
          <span class="rate">₹${item.unit_price}</span>
          <span class="amt">₹${(item.quantity * item.unit_price).toFixed(2)}</span>
        </div>`).join('')}
      <div class="divider"></div>
      <div class="row"><span>Subtotal</span><span>₹${subtotal.toFixed(2)}</span></div>
      ${discountAmount > 0 ? `<div class="row"><span>Discount (${selectedDiscount?.name} ${discountPct}%)</span><span>- ₹${discountAmount.toFixed(2)}</span></div>` : ''}
      ${Object.entries(gstBreakdown).map(([r, a]) => `<div class="row small"><span>GST ${r}% (incl.)</span><span>₹${a.toFixed(2)}</span></div>`).join('')}
      ${totalGST > 0 ? `<div class="row small"><span>Total GST</span><span>₹${totalGST.toFixed(2)}</span></div>` : ''}
      <div class="divider"></div>
      <div class="total-row"><span>TOTAL</span><span>₹${grandTotal.toFixed(2)}</span></div>
      <div class="divider"></div>
      ${paymentLine ? `<div class="row small"><span>Payment</span><span>${paymentLine}</span></div>` : ''}
      ${notes ? `<div class="row small"><span>Note: ${notes}</span></div>` : ''}
      <div class="divider"></div>
      <div class="center small" style="margin-top:8px">
        <div>Thank you for dining with us!</div>
        <div style="margin-top:4px">Please visit again 🙏</div>
      </div></body></html>`

    const win = window.open('', '_blank', 'width=400,height=600')
    win.document.write(receiptHTML)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 300)
    setBillPrinted(true)
  }

  // ── Confirm Payment ──
  async function confirmPayment() {
    if (balance > 0.5) return alert(`Still ₹${balance} pending. Please enter the full amount.`)
    if (!payMode) return alert('Please select a payment mode.')
    setSubmitting(true)
    try {
      const billData = {
        order_id: orderId, subtotal,
        discount_type_id: selectedDiscount?.id || null,
        discount_name: selectedDiscount?.name || null,
        discount_percentage: discountPct, discount_amount: discountAmount,
        gst_amount: totalGST, total: grandTotal,
        cash_amount: parseFloat(cashAmount) || 0,
        card_amount: parseFloat(cardAmount) || 0,
        upi_amount:  parseFloat(upiAmount)  || 0,
        notes: notes || null, status: 'paid', biller_id: profile.id,
      }
      const { error } = await supabase.from('bills').insert(billData)
      if (error) throw error
      await supabase.from('orders').update({ status: 'completed' }).eq('id', orderId)
      await supabase.from('kots').update({ status: 'completed' }).eq('order_id', orderId)
      if (order?.table_id) {
        await supabase.from('cafe_tables').update({ status: 'free', captain_id: null }).eq('id', order.table_id)
      }
      navigate('/billing')
    } catch (err) {
      alert('Something went wrong. Please try again.')
    } finally { setSubmitting(false) }
  }

  if (loading) return <div style={{ padding: 40, color: theme.textLight }}>Loading bill...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 112px)', gap: 0 }}>

      {/* ── HEADER ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexShrink: 0 }}>
        <button onClick={() => step === STEP_BILL ? navigate('/billing') : setStep(step === STEP_CONFIRM ? STEP_PAYMENT : STEP_BILL)}
          style={{ background: '#fff', border: '1px solid ' + theme.border, borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer', color: theme.textMid, fontWeight: 600 }}>
          ← Back
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: theme.textDark, margin: 0 }}>{orderLabel}</h1>
          <p style={{ color: theme.textLight, fontSize: 13, marginTop: 2 }}>
            {order?.order_type?.replace('_', ' ')} · {order?.covers} cover{order?.covers !== 1 ? 's' : ''} · {order?.staff?.name}
          </p>
        </div>
        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {[
            { id: STEP_BILL,    label: 'Bill' },
            { id: STEP_PAYMENT, label: 'Payment' },
            { id: STEP_CONFIRM, label: 'Confirm' },
          ].map((s, i) => {
            const isActive = step === s.id
            const isDone   = (step === STEP_PAYMENT && i === 0) || (step === STEP_CONFIRM && i <= 1)
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {i > 0 && <div style={{ width: 20, height: 1, background: isDone ? '#092b33' : theme.border }} />}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: isDone ? '#092b33' : isActive ? '#092b33' : theme.bgWarm, border: '2px solid ' + (isActive || isDone ? '#092b33' : theme.border), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: isActive || isDone ? '#fff' : theme.textMuted }}>
                    {isDone ? '✓' : i + 1}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: isActive ? '#092b33' : isDone ? '#092b33' : theme.textMuted }}>{s.label}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── STEP 1: BILL ── */}
      {step === STEP_BILL && (
        <div style={{ display: 'flex', gap: 16, flex: 1, overflow: 'hidden' }}>

          {/* Bill items */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flex: 1, overflowY: 'auto', background: '#fff', borderRadius: 14, border: '1px solid ' + theme.border }}>
              <div style={{ display: 'flex', padding: '10px 18px', borderBottom: '2px solid ' + theme.bgWarm }}>
                {['Item', 'Qty', 'Rate', 'Amt'].map((h, i) => (
                  <div key={h} style={{ flex: i === 0 ? 1 : 0, width: i > 0 ? (i === 1 ? 40 : i === 2 ? 65 : 75) : undefined, textAlign: i > 0 ? 'right' : 'left', fontSize: 11, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {h}
                  </div>
                ))}
              </div>
              {orderItems.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', padding: '11px 18px', borderBottom: '1px solid ' + theme.bgWarm }}>
                  <div style={{ flex: 1, fontWeight: 600, fontSize: 13, color: theme.textDark }}>{item.menu_items?.name}</div>
                  <div style={{ width: 40, textAlign: 'right', fontSize: 13, color: theme.textMid }}>{item.quantity}</div>
                  <div style={{ width: 65, textAlign: 'right', fontSize: 13, color: theme.textMid }}>₹{item.unit_price}</div>
                  <div style={{ width: 75, textAlign: 'right', fontWeight: 700, fontSize: 13, color: theme.textDark }}>₹{(item.quantity * item.unit_price).toFixed(2)}</div>
                </div>
              ))}
              <div style={{ padding: '14px 18px', borderTop: '2px solid ' + theme.border }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: theme.textMid, marginBottom: 8 }}>
                  <span>Subtotal</span><span style={{ fontWeight: 700 }}>₹{subtotal.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#15803D', marginBottom: 8 }}>
                    <span>Discount ({selectedDiscount?.name} — {discountPct}%)</span>
                    <span style={{ fontWeight: 700 }}>— ₹{discountAmount.toFixed(2)}</span>
                  </div>
                )}
                {Object.entries(gstBreakdown).map(([rate, amount]) => (
                  <div key={rate} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: theme.textLight, marginBottom: 6 }}>
                    <span>GST {rate}% (inclusive)</span><span>₹{amount.toFixed(2)}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 900, color: theme.textDark, marginTop: 12, paddingTop: 12, borderTop: '2px solid ' + theme.border }}>
                  <span>Grand Total</span><span>₹{grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0 }}>
            {/* Discount */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid ' + theme.border, padding: '16px 18px' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Discount</label>
              <select value={selectedDiscount?.id || ''}
                onChange={e => setSelectedDiscount(discountTypes.find(d => d.id === e.target.value) || null)}
                style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 9, padding: '9px 12px', fontSize: 13, outline: 'none', background: '#fff', color: theme.textDark }}>
                <option value=''>No Discount</option>
                {discountTypes.map(d => <option key={d.id} value={d.id}>{d.name} ({d.percentage}%)</option>)}
              </select>
            </div>

            {/* Notes */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid ' + theme.border, padding: '16px 18px' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Notes <span style={{ fontWeight: 400 }}>(optional)</span></label>
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any billing notes..."
                style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 8, padding: '8px 12px', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
            </div>

            {/* Total summary */}
            <div style={{ background: '#092b33', borderRadius: 14, padding: '16px 18px' }}>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600 }}>Grand Total</div>
              <div style={{ color: '#D4A853', fontWeight: 900, fontSize: 28, marginTop: 4, letterSpacing: -1 }}>₹{grandTotal.toFixed(2)}</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button onClick={printBill}
                style={{ width: '100%', background: billPrinted ? theme.bgWarm : '#fff', border: '1.5px solid ' + (billPrinted ? theme.border : '#092b33'), borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: billPrinted ? theme.textMid : '#092b33', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                🖨️ {billPrinted ? 'Print Again' : 'Print Bill'}
              </button>
              <button onClick={() => setStep(STEP_PAYMENT)}
                style={{ width: '100%', background: '#092b33', color: '#fff', border: 'none', borderRadius: 10, padding: '14px', fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                Settle Bill →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 2: PAYMENT MODE ── */}
      {step === STEP_PAYMENT && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {/* Amount reminder */}
            <div style={{ background: '#092b33', borderRadius: 14, padding: '18px 22px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600 }}>Amount to Collect</div>
                <div style={{ color: '#D4A853', fontWeight: 900, fontSize: 28, letterSpacing: -1 }}>₹{grandTotal.toFixed(2)}</div>
              </div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
                {discountAmount > 0 && <div>Discount: -₹{discountAmount.toFixed(2)}</div>}
                <div>Subtotal: ₹{subtotal.toFixed(2)}</div>
              </div>
            </div>

            {/* Mode selection */}
            <div style={{ fontSize: 13, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Select Payment Mode</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
              {PAY_MODES.map(mode => {
                const selected = payMode === mode.id
                return (
                  <button key={mode.id} onClick={() => selectPayMode(mode.id)}
                    style={{ background: selected ? mode.bg : '#fff', border: '2.5px solid ' + (selected ? mode.color : theme.border), borderRadius: 14, padding: '20px 16px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>{mode.icon}</div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: selected ? mode.color : theme.textDark }}>{mode.label}</div>
                    <div style={{ fontSize: 11, color: selected ? mode.color : theme.textLight, marginTop: 3, fontWeight: 500 }}>
                      {mode.id === 'cash'    ? 'Pay with cash'         : ''}
                      {mode.id === 'card'    ? 'Debit / Credit card'   : ''}
                      {mode.id === 'online'  ? 'UPI / QR / Wallet'     : ''}
                      {mode.id === 'partial' ? 'Split across methods'  : ''}
                    </div>
                    {selected && <div style={{ marginTop: 8, fontSize: 11, fontWeight: 800, color: mode.color }}>✓ Selected</div>}
                  </button>
                )
              })}
            </div>

            {/* Amount input — shows for all modes */}
            {payMode && (
              <div style={{ background: '#fff', borderRadius: 14, border: '1px solid ' + theme.border, padding: '18px 20px', marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: theme.textDark, marginBottom: 14 }}>
                  {payMode === 'partial' ? 'Enter amounts for each method' : 'Confirm amount'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(payMode === 'cash' || payMode === 'partial') && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 80, fontSize: 13, fontWeight: 700, color: theme.textMid, display: 'flex', alignItems: 'center', gap: 6 }}>💵 Cash</div>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: theme.textLight, fontWeight: 700 }}>₹</span>
                        <input type="number" value={cashAmount} onChange={e => setCashAmount(e.target.value)} placeholder="0"
                          style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 8, padding: '10px 10px 10px 26px', fontSize: 14, fontWeight: 700, outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                    </div>
                  )}
                  {(payMode === 'card' || payMode === 'partial') && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 80, fontSize: 13, fontWeight: 700, color: theme.textMid, display: 'flex', alignItems: 'center', gap: 6 }}>💳 Card</div>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: theme.textLight, fontWeight: 700 }}>₹</span>
                        <input type="number" value={cardAmount} onChange={e => setCardAmount(e.target.value)} placeholder="0"
                          style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 8, padding: '10px 10px 10px 26px', fontSize: 14, fontWeight: 700, outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                    </div>
                  )}
                  {(payMode === 'online' || payMode === 'partial') && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 80, fontSize: 13, fontWeight: 700, color: theme.textMid, display: 'flex', alignItems: 'center', gap: 6 }}>📱 UPI</div>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: theme.textLight, fontWeight: 700 }}>₹</span>
                        <input type="number" value={upiAmount} onChange={e => setUpiAmount(e.target.value)} placeholder="0"
                          style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 8, padding: '10px 10px 10px 26px', fontSize: 14, fontWeight: 700, outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Balance indicator */}
                <div style={{ marginTop: 14, background: balance > 0.5 ? '#FEE2E2' : balance < -0.5 ? '#FEF3C7' : '#DCFCE7', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: balance > 0.5 ? '#B91C1C' : balance < -0.5 ? '#B45309' : '#15803D' }}>
                    {balance > 0.5 ? 'Remaining' : balance < -0.5 ? 'Change to return' : '✓ Fully Settled'}
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 900, color: balance > 0.5 ? '#B91C1C' : balance < -0.5 ? '#B45309' : '#15803D' }}>
                    {balance > 0.5 || balance < -0.5 ? '₹' + Math.abs(balance).toFixed(2) : ''}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Proceed button */}
          <div style={{ flexShrink: 0, paddingTop: 12 }}>
            <button
              onClick={() => setStep(STEP_CONFIRM)}
              disabled={!payMode || balance > 0.5}
              style={{ width: '100%', background: !payMode || balance > 0.5 ? theme.bgWarm : '#092b33', color: !payMode || balance > 0.5 ? theme.textMuted : '#fff', border: 'none', borderRadius: 12, padding: '15px', fontSize: 15, fontWeight: 800, cursor: !payMode || balance > 0.5 ? 'not-allowed' : 'pointer' }}>
              {!payMode ? 'Select a payment mode to continue' : balance > 0.5 ? `₹${balance.toFixed(2)} still pending` : 'Confirm Payment →'}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: CONFIRM ── */}
      {step === STEP_CONFIRM && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {/* Summary card */}
            <div style={{ background: '#092b33', borderRadius: 16, padding: '22px 24px', marginBottom: 16 }}>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Settling bill for</div>
              <div style={{ color: '#fff', fontWeight: 900, fontSize: 22 }}>{orderLabel}</div>
              <div style={{ color: '#D4A853', fontWeight: 900, fontSize: 32, marginTop: 8, letterSpacing: -1 }}>₹{grandTotal.toFixed(2)}</div>
            </div>

            {/* Payment breakdown */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid ' + theme.border, padding: '18px 20px', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>Payment Breakdown</div>
              {[
                { label: '💵 Cash',   value: parseFloat(cashAmount) || 0 },
                { label: '💳 Card',   value: parseFloat(cardAmount) || 0 },
                { label: '📱 UPI/Online', value: parseFloat(upiAmount) || 0 },
              ].filter(p => p.value > 0).map(p => (
                <div key={p.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, color: theme.textDark, marginBottom: 10 }}>
                  <span>{p.label}</span><span>₹{p.value.toFixed(2)}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid ' + theme.border, paddingTop: 12, marginTop: 4, display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 900, color: theme.textDark }}>
                <span>Total Collected</span><span>₹{Math.min(totalPaid, grandTotal).toFixed(2)}</span>
              </div>
            </div>

            {/* Order summary */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid ' + theme.border, padding: '18px 20px', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>Order Summary</div>
              {orderItems.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: theme.textMid, marginBottom: 8 }}>
                  <span>{item.menu_items?.name} ×{item.quantity}</span>
                  <span style={{ fontWeight: 700 }}>₹{(item.quantity * item.unit_price).toFixed(2)}</span>
                </div>
              ))}
              {discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#15803D', marginTop: 8, paddingTop: 8, borderTop: '1px solid ' + theme.border }}>
                  <span>Discount ({selectedDiscount?.name})</span>
                  <span style={{ fontWeight: 700 }}>— ₹{discountAmount.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div style={{ background: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 20 }}>✓</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#15803D' }}>Ready to confirm</div>
                <div style={{ fontSize: 12, color: '#166534' }}>This will close the table and mark the order as completed</div>
              </div>
            </div>
          </div>

          <div style={{ flexShrink: 0, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={printBill}
              style={{ width: '100%', background: '#fff', border: '1.5px solid ' + theme.border, borderRadius: 10, padding: '12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: theme.textMid }}>
              🖨️ Print Bill
            </button>
            <button onClick={confirmPayment} disabled={submitting}
              style={{ width: '100%', background: '#092b33', color: '#fff', border: 'none', borderRadius: 12, padding: '16px', fontSize: 15, fontWeight: 800, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.8 : 1 }}>
              {submitting ? 'Processing...' : '✓ Confirm Payment & Close Table'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}