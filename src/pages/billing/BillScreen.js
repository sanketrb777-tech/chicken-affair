import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { theme } from '../../lib/theme'

const STEP_BILL    = 'bill'
const STEP_PAYMENT = 'payment'
const STEP_CONFIRM = 'confirm'

export default function BillScreen() {
  const { orderId } = useParams()
  const navigate    = useNavigate()
  const { profile } = useAuth()

  const [step, setStep]               = useState(STEP_BILL)
  const [order, setOrder]             = useState(null)
  const [orderItems, setOrderItems]   = useState([])
  const [gstRate, setGstRate]         = useState(5)
  const [loading, setLoading]         = useState(true)
  const [submitting, setSubmitting]   = useState(false)
  const [billPrinted, setBillPrinted] = useState(false)

  // Discount
  const [discountPct, setDiscountPct]       = useState('')
  const [discountReason, setDiscountReason] = useState('')

  // Payment
  const [payMode, setPayMode]         = useState('')
  const [cashAmount, setCashAmount]   = useState('')
  const [cardAmount, setCardAmount]   = useState('')
  const [upiAmount, setUpiAmount]     = useState('')
  const [notes, setNotes]             = useState('')

  useEffect(() => { fetchData() }, [orderId])

  async function fetchData() {
    const { data: ord } = await supabase
      .from('orders').select('*, cafe_tables(number, name), staff(name)').eq('id', orderId).single()
    setOrder(ord)
    const { data: items } = await supabase
      .from('order_items').select('*, menu_items(name, gst_rate)').eq('order_id', orderId)
    setOrderItems(items || [])
    const { data: setting } = await supabase
      .from('app_settings').select('value').eq('key', 'gst_rate').single()
    if (setting) setGstRate(parseFloat(setting.value))
    setLoading(false)
  }

  // ── Calculations ──
  const subtotal = orderItems.reduce((sum, i) => sum + i.quantity * i.unit_price, 0)

  const discountPctNum  = Math.min(Math.max(parseFloat(discountPct) || 0, 0), 100)
  const discountAmount  = parseFloat(((subtotal * discountPctNum) / 100).toFixed(2))
  const discountFactor  = 1 - discountPctNum / 100
  const afterDiscount   = subtotal - discountAmount

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
  const grandTotal = parseFloat(afterDiscount.toFixed(2))

  const totalPaid = (parseFloat(cashAmount) || 0) + (parseFloat(cardAmount) || 0) + (parseFloat(upiAmount) || 0)
  const balance   = parseFloat((grandTotal - totalPaid).toFixed(2))

  const orderLabel = order?.cafe_tables
    ? (order.cafe_tables.name || `Table ${order.cafe_tables.number}`)
    : order?.customer_name || 'Order'

  // Auto-fill amount when non-partial mode selected
  function handlePayModeChange(mode) {
    setPayMode(mode)
    setCashAmount(''); setCardAmount(''); setUpiAmount('')
    if (mode === 'cash')   setCashAmount(grandTotal.toFixed(2))
    if (mode === 'card')   setCardAmount(grandTotal.toFixed(2))
    if (mode === 'online') setUpiAmount(grandTotal.toFixed(2))
    // partial: leave empty
  }

  // ── Print ──
  function printBill() {
    const now = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
    const paymentLine = [
      parseFloat(cashAmount) > 0 ? `Cash: ₹${parseFloat(cashAmount).toFixed(2)}` : null,
      parseFloat(cardAmount) > 0 ? `Card: ₹${parseFloat(cardAmount).toFixed(2)}` : null,
      parseFloat(upiAmount)  > 0 ? `Online/UPI: ₹${parseFloat(upiAmount).toFixed(2)}` : null,
    ].filter(Boolean).join(' + ')

    const receiptHTML = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <title>Bambini Cafe - Bill</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Courier New',monospace; font-size:12px; width:80mm; margin:0 auto; padding:8px; color:#000; }
        .center { text-align:center; } .bold { font-weight:bold; }
        .divider { border-top:1px dashed #000; margin:6px 0; }
        .row { display:flex; justify-content:space-between; margin:3px 0; }
        .row-3 { display:flex; margin:3px 0; }
        .row-3 .name { flex:1; } .row-3 .qty { width:30px; text-align:center; }
        .row-3 .rate { width:55px; text-align:right; } .row-3 .amt { width:65px; text-align:right; }
        .total-row { display:flex; justify-content:space-between; font-size:14px; font-weight:bold; margin:4px 0; }
        .small { font-size:10px; color:#444; }
        @media print { body { width:80mm; } @page { size:80mm auto; margin:0; } }
      </style></head><body>
      <div class="center" style="margin-bottom:10px">
        <div style="font-size:18px;font-weight:bold;letter-spacing:1px">Bambini Cafe</div>
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
      ${discountAmount > 0 ? `<div class="row"><span>Discount (${discountPctNum}%${discountReason ? ' - ' + discountReason : ''})</span><span>- ₹${discountAmount.toFixed(2)}</span></div>` : ''}
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
    if (!payMode) return alert('Please select a payment mode.')
    if (balance > 0.5) return alert(`Still ₹${balance.toFixed(2)} pending.`)
    if (discountPctNum > 0 && !discountReason.trim()) return alert('Please enter a reason for the discount.')
    setSubmitting(true)
    try {
      const billData = {
        order_id: orderId, subtotal,
        discount_type_id: null,
        discount_name: discountReason || null,
        discount_percentage: discountPctNum, discount_amount: discountAmount,
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

  // Step indicator
  const steps = [
    { id: STEP_BILL, label: 'Bill' },
    { id: STEP_PAYMENT, label: 'Payment' },
    { id: STEP_CONFIRM, label: 'Confirm' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 112px)' }}>

      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexShrink: 0 }}>
        <button
          onClick={() => step === STEP_BILL ? navigate('/billing') : setStep(step === STEP_CONFIRM ? STEP_PAYMENT : STEP_BILL)}
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
          {steps.map((s, i) => {
            const isActive = step === s.id
            const isDone   = steps.findIndex(x => x.id === step) > i
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {i > 0 && <div style={{ width: 20, height: 1, background: isDone ? '#092b33' : theme.border }} />}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: isActive || isDone ? '#092b33' : theme.bgWarm, border: '2px solid ' + (isActive || isDone ? '#092b33' : theme.border), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: isActive || isDone ? '#fff' : theme.textMuted }}>
                    {isDone ? '✓' : i + 1}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: isActive || isDone ? '#092b33' : theme.textMuted }}>{s.label}</span>
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
                  <div key={h} style={{ flex: i === 0 ? 1 : 0, width: i > 0 ? [40, 65, 75][i - 1] : undefined, textAlign: i > 0 ? 'right' : 'left', fontSize: 11, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: 0.5 }}>
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

              {/* Totals */}
              <div style={{ padding: '14px 18px', borderTop: '2px solid ' + theme.border }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: theme.textMid, marginBottom: 8 }}>
                  <span>Subtotal</span><span style={{ fontWeight: 700 }}>₹{subtotal.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#15803D', marginBottom: 8 }}>
                    <span>Discount ({discountPctNum}%{discountReason ? ` — ${discountReason}` : ''})</span>
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
              <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Discount %</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="number" min="0" max="100" value={discountPct}
                  onChange={e => { setDiscountPct(e.target.value); if (!e.target.value) setDiscountReason('') }}
                  placeholder="0"
                  style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 9, padding: '9px 32px 9px 12px', fontSize: 14, fontWeight: 700, outline: 'none', boxSizing: 'border-box', color: theme.textDark }} />
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, fontWeight: 700, color: theme.textLight }}>%</span>
              </div>

              {/* Reason box — only when discount entered */}
              {discountPctNum > 0 && (
                <div style={{ marginTop: 10 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Reason for Discount *</label>
                  <input
                    value={discountReason}
                    onChange={e => setDiscountReason(e.target.value)}
                    placeholder="e.g. Regular customer, Staff meal, Complaint"
                    style={{ width: '100%', border: '1.5px solid ' + (discountReason.trim() ? theme.border : '#FCA5A5'), borderRadius: 9, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: theme.textDark }} />
                  {!discountReason.trim() && (
                    <div style={{ fontSize: 11, color: '#B91C1C', marginTop: 4, fontWeight: 600 }}>Required when applying a discount</div>
                  )}
                </div>
              )}

              {discountAmount > 0 && (
                <div style={{ marginTop: 10, background: '#DCFCE7', borderRadius: 8, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#15803D', fontWeight: 600 }}>Saving</span>
                  <span style={{ color: '#15803D', fontWeight: 800 }}>₹{discountAmount.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Notes */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid ' + theme.border, padding: '16px 18px' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Notes <span style={{ fontWeight: 400 }}>(optional)</span></label>
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any billing notes..."
                style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 8, padding: '8px 12px', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
            </div>

            {/* Grand total */}
            <div style={{ background: '#092b33', borderRadius: 14, padding: '16px 18px' }}>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600 }}>Grand Total</div>
              <div style={{ color: '#D4A853', fontWeight: 900, fontSize: 28, marginTop: 4, letterSpacing: -1 }}>₹{grandTotal.toFixed(2)}</div>
              {discountAmount > 0 && <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 4 }}>After {discountPctNum}% discount</div>}
            </div>

            <button onClick={printBill}
              style={{ width: '100%', background: billPrinted ? theme.bgWarm : '#fff', border: '1.5px solid ' + (billPrinted ? theme.border : '#092b33'), borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer', color: billPrinted ? theme.textMid : '#092b33' }}>
              🖨️ {billPrinted ? 'Print Again' : 'Print Bill'}
            </button>

            <button
              onClick={() => setStep(STEP_PAYMENT)}
              disabled={discountPctNum > 0 && !discountReason.trim()}
              style={{ width: '100%', background: discountPctNum > 0 && !discountReason.trim() ? theme.bgWarm : '#092b33', color: discountPctNum > 0 && !discountReason.trim() ? theme.textMuted : '#fff', border: 'none', borderRadius: 10, padding: '14px', fontSize: 14, fontWeight: 800, cursor: discountPctNum > 0 && !discountReason.trim() ? 'not-allowed' : 'pointer' }}>
              Settle Bill →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: PAYMENT MODE ── */}
      {step === STEP_PAYMENT && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto' }}>

            {/* Amount banner */}
            <div style={{ background: '#092b33', borderRadius: 14, padding: '18px 22px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600 }}>Amount to Collect</div>
                <div style={{ color: '#D4A853', fontWeight: 900, fontSize: 28, letterSpacing: -1 }}>₹{grandTotal.toFixed(2)}</div>
              </div>
              {discountAmount > 0 && (
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'right' }}>
                  <div>Discount: −₹{discountAmount.toFixed(2)}</div>
                  <div>Subtotal: ₹{subtotal.toFixed(2)}</div>
                </div>
              )}
            </div>

            {/* Payment mode dropdown */}
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid ' + theme.border, padding: '18px 20px', marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Payment Mode
              </label>
              <select
                value={payMode}
                onChange={e => handlePayModeChange(e.target.value)}
                style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 9, padding: '11px 14px', fontSize: 14, fontWeight: 600, outline: 'none', background: '#fff', color: payMode ? theme.textDark : theme.textLight, cursor: 'pointer' }}>
                <option value="">— Select mode —</option>
                <option value="cash">💵 Cash</option>
                <option value="card">💳 Card</option>
                <option value="online">📱 Online (UPI / QR / Wallet)</option>
                <option value="partial">⚖️ Partial (Split Payment)</option>
              </select>

              {/* Amount fields — auto-filled for single modes, manual for partial */}
              {payMode && (
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(payMode === 'cash' || payMode === 'partial') && (
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>💵 Cash</label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: theme.textLight, fontWeight: 700 }}>₹</span>
                        <input type="number" value={cashAmount} onChange={e => setCashAmount(e.target.value)} placeholder="0"
                          style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 9, padding: '10px 10px 10px 28px', fontSize: 14, fontWeight: 700, outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                    </div>
                  )}
                  {(payMode === 'card' || payMode === 'partial') && (
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>💳 Card</label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: theme.textLight, fontWeight: 700 }}>₹</span>
                        <input type="number" value={cardAmount} onChange={e => setCardAmount(e.target.value)} placeholder="0"
                          style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 9, padding: '10px 10px 10px 28px', fontSize: 14, fontWeight: 700, outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                    </div>
                  )}
                  {(payMode === 'online' || payMode === 'partial') && (
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>📱 Online / UPI</label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: theme.textLight, fontWeight: 700 }}>₹</span>
                        <input type="number" value={upiAmount} onChange={e => setUpiAmount(e.target.value)} placeholder="0"
                          style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 9, padding: '10px 10px 10px 28px', fontSize: 14, fontWeight: 700, outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                    </div>
                  )}

                  {/* Balance indicator */}
                  <div style={{ background: balance > 0.5 ? '#FEE2E2' : balance < -0.5 ? '#FEF3C7' : '#DCFCE7', borderRadius: 10, padding: '11px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: balance > 0.5 ? '#B91C1C' : balance < -0.5 ? '#B45309' : '#15803D' }}>
                      {balance > 0.5 ? 'Remaining' : balance < -0.5 ? 'Change to return' : '✓ Fully Settled'}
                    </span>
                    <span style={{ fontSize: 15, fontWeight: 900, color: balance > 0.5 ? '#B91C1C' : balance < -0.5 ? '#B45309' : '#15803D' }}>
                      {Math.abs(balance) > 0.01 ? '₹' + Math.abs(balance).toFixed(2) : ''}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

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
            <div style={{ background: '#092b33', borderRadius: 16, padding: '22px 24px', marginBottom: 16 }}>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Settling bill for</div>
              <div style={{ color: '#fff', fontWeight: 900, fontSize: 22 }}>{orderLabel}</div>
              <div style={{ color: '#D4A853', fontWeight: 900, fontSize: 32, marginTop: 8, letterSpacing: -1 }}>₹{grandTotal.toFixed(2)}</div>
            </div>

            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid ' + theme.border, padding: '18px 20px', marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>Payment Breakdown</div>
              {[
                { label: '💵 Cash',       value: parseFloat(cashAmount) || 0 },
                { label: '💳 Card',       value: parseFloat(cardAmount) || 0 },
                { label: '📱 Online/UPI', value: parseFloat(upiAmount)  || 0 },
              ].filter(p => p.value > 0).map(p => (
                <div key={p.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, color: theme.textDark, marginBottom: 10 }}>
                  <span>{p.label}</span><span>₹{p.value.toFixed(2)}</span>
                </div>
              ))}
              <div style={{ borderTop: '1px solid ' + theme.border, paddingTop: 12, marginTop: 4, display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 900, color: theme.textDark }}>
                <span>Total Collected</span><span>₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>

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
                  <span>Discount ({discountPctNum}% — {discountReason})</span>
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