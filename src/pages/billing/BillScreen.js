import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { theme } from '../../lib/theme'

export default function BillScreen() {
  const { orderId } = useParams()
  console.log('BillScreen loaded, orderId:', orderId)
  const navigate    = useNavigate()
  const { profile } = useAuth()

  const [order, setOrder]               = useState(null)
  const [orderItems, setOrderItems]     = useState([])
  const [discountTypes, setDiscountTypes] = useState([])
  const [gstRate, setGstRate]           = useState(5)
  const [loading, setLoading]           = useState(true)
  const [submitting, setSubmitting]     = useState(false)

  const [selectedDiscount, setSelectedDiscount] = useState(null)
  const [cashAmount, setCashAmount]     = useState('')
  const [cardAmount, setCardAmount]     = useState('')
  const [upiAmount, setUpiAmount]       = useState('')
  const [notes, setNotes]               = useState('')

  useEffect(() => { fetchData() }, [orderId])

  async function fetchData() {
    // Fetch order
    const { data: ord } = await supabase
      .from('orders')
      .select('*, cafe_tables(number), staff(name)')
      .eq('id', orderId)
      .single()
    setOrder(ord)

    // Fetch order items with menu item names
    const { data: items } = await supabase
      .from('order_items')
      .select('*, menu_items(name, gst_rate)')
      .eq('order_id', orderId)
    setOrderItems(items || [])

    // Fetch discount types
    const { data: discounts } = await supabase
      .from('discount_types')
      .select('*')
      .eq('is_active', true)
      .order('name')
    setDiscountTypes(discounts || [])

    // Fetch GST rate
    const { data: setting } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'gst_rate')
      .single()
    if (setting) setGstRate(parseFloat(setting.value))

    setLoading(false)
  }

  // ── Calculations ──
  const subtotal = orderItems.reduce((sum, i) => sum + i.quantity * i.unit_price, 0)

  const discountPct    = selectedDiscount ? parseFloat(selectedDiscount.percentage) : 0
  const discountFactor = 1 - discountPct / 100
  const discountAmount = parseFloat(((subtotal * discountPct) / 100).toFixed(2))
  const afterDiscount  = subtotal - discountAmount

  // GST per item — inclusive, extract from each item's discounted amount
  const gstBreakdown = {}
  let totalGST = 0
  orderItems.forEach(item => {
    const itemTotal      = item.quantity * item.unit_price * discountFactor
    const rate           = item.menu_items?.gst_rate ?? gstRate
    if (rate === 0) return
    const itemGST        = parseFloat(((itemTotal * rate) / (100 + rate)).toFixed(2))
    totalGST            += itemGST
    gstBreakdown[rate]   = (gstBreakdown[rate] || 0) + itemGST
  })
  totalGST             = parseFloat(totalGST.toFixed(2))
  const grandTotal     = afterDiscount

  const totalPaid = (parseFloat(cashAmount) || 0) + (parseFloat(cardAmount) || 0) + (parseFloat(upiAmount) || 0)
  const balance   = parseFloat((grandTotal - totalPaid).toFixed(2))

  async function confirmPayment() {
    if (balance > 0.5) return alert(`Still ₹${balance} pending. Please enter the full amount.`)
    setSubmitting(true)
    try {
      const billData = {
        order_id:            orderId,
        subtotal:            subtotal,
        discount_type_id:    selectedDiscount?.id || null,
        discount_name:       selectedDiscount?.name || null,
        discount_percentage: discountPct,
        discount_amount:     discountAmount,
        gst_rate:            null,
        gst_amount:          totalGST,
        total:               grandTotal,
        cash_amount:         parseFloat(cashAmount) || 0,
        card_amount:         parseFloat(cardAmount) || 0,
        upi_amount:          parseFloat(upiAmount)  || 0,
        notes:               notes || null,
        status:              'paid',
        biller_id:           profile.id,
      }
      console.log('Inserting bill:', billData)
      const { data, error } = await supabase.from('bills').insert(billData).select()
      console.log('Bill result:', data, error)

      // Mark order as completed
      // Mark order as completed
      await supabase.from('orders').update({ status: 'completed' }).eq('id', orderId)

      // Mark all KOTs as completed so they disappear from KDS
      await supabase.from('kots').update({ status: 'completed' }).eq('order_id', orderId)

      // Free the table
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

  return (
    <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 112px)' }}>

      {/* ── LEFT: Itemized bill ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button onClick={() => navigate('/billing')}
            style={{ background: '#fff', border: '1px solid ' + theme.border, borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer', color: theme.textMid, fontWeight: 600 }}>
            ← Back
          </button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: theme.textDark, margin: 0 }}>
              {order?.cafe_tables ? 'Table ' + order.cafe_tables.number : order?.customer_name || 'Order'}
            </h1>
            <p style={{ color: theme.textLight, fontSize: 13, marginTop: 2 }}>
              {order?.order_type?.replace('_', ' ')} · {order?.covers} cover{order?.covers !== 1 ? 's' : ''} · {order?.staff?.name}
            </p>
          </div>
        </div>

        {/* Items */}
        <div style={{ flex: 1, overflowY: 'auto', background: '#fff', borderRadius: 14, border: '1px solid ' + theme.border, padding: '4px 0' }}>
          {/* Column headers */}
          <div style={{ display: 'flex', padding: '10px 18px', borderBottom: '2px solid ' + theme.bgWarm }}>
            <div style={{ flex: 1, fontSize: 11, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: 0.5 }}>Item</div>
            <div style={{ width: 50, textAlign: 'center', fontSize: 11, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: 0.5 }}>Qty</div>
            <div style={{ width: 70, textAlign: 'right', fontSize: 11, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: 0.5 }}>Rate</div>
            <div style={{ width: 80, textAlign: 'right', fontSize: 11, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: 0.5 }}>Amount</div>
          </div>

          {orderItems.map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', padding: '11px 18px', borderBottom: '1px solid ' + theme.bgWarm }}>
              <div style={{ flex: 1, fontWeight: 600, fontSize: 13, color: theme.textDark }}>{item.menu_items?.name}</div>
              <div style={{ width: 50, textAlign: 'center', fontSize: 13, color: theme.textMid }}>{item.quantity}</div>
              <div style={{ width: 70, textAlign: 'right', fontSize: 13, color: theme.textMid }}>₹{item.unit_price}</div>
              <div style={{ width: 80, textAlign: 'right', fontWeight: 700, fontSize: 13, color: theme.textDark }}>₹{(item.quantity * item.unit_price).toFixed(2)}</div>
            </div>
          ))}

          {/* Totals section */}
          <div style={{ padding: '14px 18px', borderTop: '2px solid ' + theme.border, marginTop: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: theme.textMid, marginBottom: 8 }}>
              <span>Subtotal</span>
              <span style={{ fontWeight: 700 }}>₹{subtotal.toFixed(2)}</span>
            </div>

            {discountAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#15803D', marginBottom: 8 }}>
                <span>Discount ({selectedDiscount?.name} — {discountPct}%)</span>
                <span style={{ fontWeight: 700 }}>— ₹{discountAmount.toFixed(2)}</span>
              </div>
            )}

            {Object.entries(gstBreakdown).map(([rate, amount]) => (
              <div key={rate} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: theme.textLight, marginBottom: 6 }}>
                <span>GST {rate}% (inclusive)</span>
                <span>₹{amount.toFixed(2)}</span>
              </div>
            ))}
            {totalGST > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: theme.textLight, marginBottom: 8 }}>
                <span>Total GST</span>
                <span>₹{totalGST.toFixed(2)}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 900, color: theme.textDark, marginTop: 12, paddingTop: 12, borderTop: '2px solid ' + theme.border }}>
              <span>Grand Total</span>
              <span>₹{grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT: Payment panel ── */}
      <div style={{ width: 300, background: '#fff', borderRadius: 14, border: '1px solid ' + theme.border, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ background: '#092b33', padding: '14px 18px' }}>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: 15 }}>Collect Payment</div>
          <div style={{ color: '#D4A853', fontWeight: 900, fontSize: 22, marginTop: 4 }}>₹{grandTotal.toFixed(2)}</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Discount */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Discount</label>
            <select value={selectedDiscount?.id || ''}
              onChange={e => {
                const d = discountTypes.find(d => d.id === e.target.value)
                setSelectedDiscount(d || null)
              }}
              style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 9, padding: '9px 12px', fontSize: 13, outline: 'none', background: '#fff', color: theme.textDark }}>
              <option value=''>No Discount</option>
              {discountTypes.map(d => (
                <option key={d.id} value={d.id}>{d.name} ({d.percentage}%)</option>
              ))}
            </select>
          </div>

          {/* Payment split */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Payment Split</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: '💵 Cash',  value: cashAmount,  setter: setCashAmount },
                { label: '💳 Card',  value: cardAmount,  setter: setCardAmount },
                { label: '📱 UPI',   value: upiAmount,   setter: setUpiAmount  },
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

          {/* Balance indicator */}
          <div style={{ background: balance > 0.5 ? '#FEE2E2' : '#DCFCE7', borderRadius: 10, padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: balance > 0.5 ? theme.red : '#15803D' }}>
              {balance > 0.5 ? 'Remaining' : balance < -0.5 ? 'Change' : '✓ Settled'}
            </span>
            <span style={{ fontSize: 15, fontWeight: 900, color: balance > 0.5 ? theme.red : '#15803D' }}>
              {balance > 0.5 ? '₹' + balance.toFixed(2) : balance < -0.5 ? '₹' + Math.abs(balance).toFixed(2) : ''}
            </span>
          </div>

          {/* Quick fill button */}
          <button onClick={() => { setCashAmount(grandTotal.toFixed(2)); setCardAmount(''); setUpiAmount('') }}
            style={{ background: theme.bgWarm, border: '1px solid ' + theme.border, borderRadius: 8, padding: '8px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: theme.textMid }}>
            Full amount in Cash
          </button>

          {/* Notes */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Notes <span style={{ fontWeight: 400 }}>(optional)</span></label>
            <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any billing notes..."
              style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 8, padding: '8px 12px', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
          </div>
        </div>

        {/* Confirm button */}
        <div style={{ padding: 16, borderTop: '2px solid ' + theme.border }}>
          <button onClick={confirmPayment} disabled={submitting || balance > 0.5}
            style={{ width: '100%', background: balance > 0.5 ? theme.bgWarm : '#092b33', color: balance > 0.5 ? theme.textMuted : '#fff', border: 'none', borderRadius: 10, padding: '14px', fontSize: 14, fontWeight: 800, cursor: balance > 0.5 ? 'not-allowed' : 'pointer' }}>
            {submitting ? 'Processing...' : '✓ Confirm Payment & Close Table'}
          </button>
        </div>
      </div>
    </div>
  )
}