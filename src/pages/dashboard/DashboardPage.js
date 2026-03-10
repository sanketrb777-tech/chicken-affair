import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { theme } from '../../lib/theme'

export default function BillScreen() {
  const { orderId } = useParams()
  const navigate    = useNavigate()
  const { profile } = useAuth()

  const [order, setOrder]                 = useState(null)
  const [orderItems, setOrderItems]       = useState([])
  const [discountTypes, setDiscountTypes] = useState([])
  const [gstRate, setGstRate]             = useState(5)
  const [loading, setLoading]             = useState(true)
  const [submitting, setSubmitting]       = useState(false)
  const [mobileTab, setMobileTab]         = useState('bill')

  const [selectedDiscount, setSelectedDiscount] = useState(null)
  const [cashAmount, setCashAmount] = useState('')
  const [cardAmount, setCardAmount] = useState('')
  const [upiAmount, setUpiAmount]   = useState('')
  const [notes, setNotes]           = useState('')

  useEffect(() => { fetchData() }, [orderId])

  async function fetchData() {
    const { data: ord } = await supabase
      .from('orders').select('*, cafe_tables(number), staff(name)').eq('id', orderId).single()
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
  const totalPaid  = (parseFloat(cashAmount) || 0) + (parseFloat(cardAmount) || 0) + (parseFloat(upiAmount) || 0)
  const balance    = parseFloat((grandTotal - totalPaid).toFixed(2))

  // ── Print ──
  function printBill() {
    const orderLabel = order?.cafe_tables ? 'Table ' + order.cafe_tables.number : order?.customer_name || 'Order'
    const now = new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
    const paymentLine = [
      parseFloat(cashAmount) > 0 ? `Cash: ₹${parseFloat(cashAmount).toFixed(2)}` : null,
      parseFloat(cardAmount) > 0 ? `Card: ₹${parseFloat(cardAmount).toFixed(2)}` : null,
      parseFloat(upiAmount)  > 0 ? `UPI: ₹${parseFloat(upiAmount).toFixed(2)}`   : null,
    ].filter(Boolean).join(' + ')

    const receiptHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <title>Cafe Bambini - Bill</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; margin: 0 auto; padding: 8px; color: #000; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 6px 0; }
          .row { display: flex; justify-content: space-between; margin: 3px 0; }
          .row-3 { display: flex; margin: 3px 0; }
          .row-3 .name { flex: 1; }
          .row-3 .qty  { width: 30px; text-align: center; }
          .row-3 .rate { width: 55px; text-align: right; }
          .row-3 .amt  { width: 65px; text-align: right; }
          .total-row { display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; margin: 4px 0; }
          .small { font-size: 10px; color: #444; }
          .logo { font-size: 18px; font-weight: bold; letter-spacing: 1px; }
          .tagline { font-size: 10px; margin-top: 2px; color: #555; }
          @media print {
            body { width: 80mm; }
            @page { size: 80mm auto; margin: 0; }
          }
        </style>
      </head>
      <body>
        <div class="center" style="margin-bottom:10px">
          <div class="logo">Cafe Bambini</div>
          <div class="tagline">The Lake Side Cafe</div>
          <div class="small" style="margin-top:4px">${now}</div>
        </div>

        <div class="divider"></div>

        <div class="row">
          <span>${orderLabel}</span>
          <span>${order?.order_type?.replace('_', ' ') || ''}</span>
        </div>
        <div class="row small">
          <span>Covers: ${order?.covers || 1}</span>
          <span>Staff: ${order?.staff?.name || ''}</span>
        </div>

        <div class="divider"></div>

        <div class="row-3 bold small">
          <span class="name">ITEM</span>
          <span class="qty">QTY</span>
          <span class="rate">RATE</span>
          <span class="amt">AMT</span>
        </div>
        <div class="divider"></div>

        ${orderItems.map(item => `
          <div class="row-3">
            <span class="name">${item.menu_items?.name || ''}</span>
            <span class="qty">${item.quantity}</span>
            <span class="rate">₹${item.unit_price}</span>
            <span class="amt">₹${(item.quantity * item.unit_price).toFixed(2)}</span>
          </div>
        `).join('')}

        <div class="divider"></div>

        <div class="row">
          <span>Subtotal</span>
          <span>₹${subtotal.toFixed(2)}</span>
        </div>

        ${discountAmount > 0 ? `
          <div class="row">
            <span>Discount (${selectedDiscount?.name} ${discountPct}%)</span>
            <span>- ₹${discountAmount.toFixed(2)}</span>
          </div>
        ` : ''}

        ${Object.entries(gstBreakdown).map(([rate, amount]) => `
          <div class="row small">
            <span>GST ${rate}% (incl.)</span>
            <span>₹${amount.toFixed(2)}</span>
          </div>
        `).join('')}

        ${totalGST > 0 ? `
          <div class="row small">
            <span>Total GST</span>
            <span>₹${totalGST.toFixed(2)}</span>
          </div>
        ` : ''}

        <div class="divider"></div>
        <div class="total-row">
          <span>TOTAL</span>
          <span>₹${grandTotal.toFixed(2)}</span>
        </div>
        <div class="divider"></div>

        ${paymentLine ? `<div class="row small"><span>Payment</span><span>${paymentLine}</span></div>` : ''}
        ${notes ? `<div class="row small"><span>Note: ${notes}</span></div>` : ''}

        <div class="divider"></div>
        <div class="center small" style="margin-top:8px">
          <div>Thank you for dining with us!</div>
          <div style="margin-top:4px">Please visit again 🙏</div>
        </div>
      </body>
      </html>
    `

    const win = window.open('', '_blank', 'width=400,height=600')
    win.document.write(receiptHTML)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 300)
  }

  async function confirmPayment() {
    if (balance > 0.5) return alert(`Still ₹${balance} pending. Please enter the full amount.`)
    setSubmitting(true)
    try {
      const billData = {
        order_id: orderId, subtotal, discount_type_id: selectedDiscount?.id || null,
        discount_name: selectedDiscount?.name || null, discount_percentage: discountPct,
        discount_amount: discountAmount, gst_rate: null, gst_amount: totalGST,
        total: grandTotal, cash_amount: parseFloat(cashAmount) || 0,
        card_amount: parseFloat(cardAmount) || 0, upi_amount: parseFloat(upiAmount) || 0,
        notes: notes || null, status: 'paid', biller_id: profile.id,
      }
      const { error } = await supabase.from('bills').insert(billData).select()
      if (error) throw error
      await supabase.from('orders').update({ status: 'completed' }).eq('id', orderId)
      await supabase.from('kots').update({ status: 'completed' }).eq('order_id', orderId)
      if (order?.table_id) {
        await supabase.from('cafe_tables').update({ status: 'free', captain_id: null }).eq('id', order.table_id)
      }
      navigate('/billing')
    } catch (err) {
      console.error(err)
      alert('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div style={{ padding: 40, color: theme.textLight }}>Loading bill...</div>

  // ── SHARED PANELS ────────────────────────────────────────────────

  const billPanel = (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => navigate('/billing')}
          style={{ background: '#fff', border: '1px solid ' + theme.border, borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer', color: theme.textMid, fontWeight: 600 }}>
          ← Back
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: theme.textDark, margin: 0 }}>
            {order?.cafe_tables ? 'Table ' + order.cafe_tables.number : order?.customer_name || 'Order'}
          </h1>
          <p style={{ color: theme.textLight, fontSize: 13, marginTop: 2 }}>
            {order?.order_type?.replace('_', ' ')} · {order?.covers} cover{order?.covers !== 1 ? 's' : ''} · {order?.staff?.name}
          </p>
        </div>
        <button onClick={printBill}
          style={{ background: '#092b33', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          🖨️ Print
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', background: '#fff', borderRadius: 14, border: '1px solid ' + theme.border, padding: '4px 0' }}>
        <div style={{ display: 'flex', padding: '10px 18px', borderBottom: '2px solid ' + theme.bgWarm }}>
          <div style={{ flex: 1, fontSize: 11, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: 0.5 }}>Item</div>
          <div style={{ width: 40, textAlign: 'center', fontSize: 11, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase' }}>Qty</div>
          <div style={{ width: 65, textAlign: 'right', fontSize: 11, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase' }}>Rate</div>
          <div style={{ width: 75, textAlign: 'right', fontSize: 11, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase' }}>Amt</div>
        </div>

        {orderItems.map(item => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', padding: '11px 18px', borderBottom: '1px solid ' + theme.bgWarm }}>
            <div style={{ flex: 1, fontWeight: 600, fontSize: 13, color: theme.textDark }}>{item.menu_items?.name}</div>
            <div style={{ width: 40, textAlign: 'center', fontSize: 13, color: theme.textMid }}>{item.quantity}</div>
            <div style={{ width: 65, textAlign: 'right', fontSize: 13, color: theme.textMid }}>₹{item.unit_price}</div>
            <div style={{ width: 75, textAlign: 'right', fontWeight: 700, fontSize: 13, color: theme.textDark }}>₹{(item.quantity * item.unit_price).toFixed(2)}</div>
          </div>
        ))}

        <div style={{ padding: '14px 18px', borderTop: '2px solid ' + theme.border, marginTop: 4 }}>
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
          {totalGST > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: theme.textLight, marginBottom: 8 }}>
              <span>Total GST</span><span>₹{totalGST.toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 900, color: theme.textDark, marginTop: 12, paddingTop: 12, borderTop: '2px solid ' + theme.border }}>
            <span>Grand Total</span><span>₹{grandTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  )

  const paymentPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
      <div style={{ background: '#092b33', padding: '14px 18px', borderRadius: '12px 12px 0 0' }}>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>Collect Payment</div>
        <div style={{ color: '#D4A853', fontWeight: 900, fontSize: 22, marginTop: 4 }}>₹{grandTotal.toFixed(2)}</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Discount</label>
          <select value={selectedDiscount?.id || ''}
            onChange={e => setSelectedDiscount(discountTypes.find(d => d.id === e.target.value) || null)}
            style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 9, padding: '9px 12px', fontSize: 13, outline: 'none', background: '#fff', color: theme.textDark }}>
            <option value=''>No Discount</option>
            {discountTypes.map(d => <option key={d.id} value={d.id}>{d.name} ({d.percentage}%)</option>)}
          </select>
        </div>

        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Payment Split</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: '💵 Cash', value: cashAmount, setter: setCashAmount },
              { label: '💳 Card', value: cardAmount, setter: setCardAmount },
              { label: '📱 UPI',  value: upiAmount,  setter: setUpiAmount  },
            ].map(({ label, value, setter }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 65, fontSize: 12, fontWeight: 700, color: theme.textMid }}>{label}</span>
                <div style={{ position: 'relative', flex: 1 }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: theme.textLight, fontWeight: 700 }}>₹</span>
                  <input type="number" value={value} onChange={e => setter(e.target.value)} placeholder="0"
                    style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 8, padding: '8px 10px 8px 24px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: balance > 0.5 ? '#FEE2E2' : '#DCFCE7', borderRadius: 10, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: balance > 0.5 ? theme.red : '#15803D' }}>
            {balance > 0.5 ? 'Remaining' : balance < -0.5 ? 'Change' : '✓ Settled'}
          </span>
          <span style={{ fontSize: 15, fontWeight: 900, color: balance > 0.5 ? theme.red : '#15803D' }}>
            {balance > 0.5 ? '₹' + balance.toFixed(2) : balance < -0.5 ? '₹' + Math.abs(balance).toFixed(2) : ''}
          </span>
        </div>

        <button onClick={() => { setCashAmount(grandTotal.toFixed(2)); setCardAmount(''); setUpiAmount('') }}
          style={{ background: theme.bgWarm, border: '1px solid ' + theme.border, borderRadius: 8, padding: '8px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: theme.textMid }}>
          Full amount in Cash
        </button>

        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Notes <span style={{ fontWeight: 400 }}>(optional)</span></label>
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any billing notes..."
            style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 8, padding: '8px 12px', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
        </div>
      </div>

      <div style={{ padding: 16, borderTop: '2px solid ' + theme.border, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button onClick={printBill}
          style={{ width: '100%', background: theme.bgWarm, color: theme.textDark, border: '1px solid ' + theme.border, borderRadius: 10, padding: '11px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          🖨️ Print Bill
        </button>
        <button onClick={confirmPayment} disabled={submitting || balance > 0.5}
          style={{ width: '100%', background: balance > 0.5 ? theme.bgWarm : '#092b33', color: balance > 0.5 ? theme.textMuted : '#fff', border: 'none', borderRadius: 10, padding: '14px', fontSize: 14, fontWeight: 800, cursor: balance > 0.5 ? 'not-allowed' : 'pointer' }}>
          {submitting ? 'Processing...' : '✓ Confirm Payment & Close Table'}
        </button>
      </div>
    </div>
  )

  return (
    <>
      <div className="bill-desktop" style={{ display: 'flex', gap: 16, height: 'calc(100vh - 112px)' }}>
        {billPanel}
        <div style={{ width: 300, background: '#fff', borderRadius: 14, border: '1px solid ' + theme.border, display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
          {paymentPanel}
        </div>
      </div>

      <div className="bill-mobile" style={{ display: 'none', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
        <div style={{ display: 'flex', background: '#092b33', borderRadius: 10, padding: 4, marginBottom: 12, flexShrink: 0 }}>
          <button onClick={() => setMobileTab('bill')}
            style={{ flex: 1, padding: '8px 0', borderRadius: 7, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', background: mobileTab === 'bill' ? '#fff' : 'transparent', color: mobileTab === 'bill' ? '#092b33' : 'rgba(255,255,255,0.6)', transition: 'all 0.15s' }}>
            🧾 Bill
          </button>
          <button onClick={() => setMobileTab('payment')}
            style={{ flex: 1, padding: '8px 0', borderRadius: 7, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', background: mobileTab === 'payment' ? '#fff' : 'transparent', color: mobileTab === 'payment' ? '#092b33' : 'rgba(255,255,255,0.6)', transition: 'all 0.15s' }}>
            💳 Payment · ₹{grandTotal.toFixed(0)}
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {mobileTab === 'bill' ? billPanel : (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid ' + theme.border, display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
              {paymentPanel}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .bill-desktop { display: none !important; }
          .bill-mobile  { display: flex !important; }
        }
      `}</style>
    </>
  )
}