import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { theme } from '../../lib/theme'
import { Calendar, ChevronDown, TrendingUp, ShoppingBag, Truck, Utensils, Banknote, CreditCard, Smartphone } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

const FILTERS = ['Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'Custom Range']

function getDateRange(filter) {
  const now   = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  switch (filter) {
    case 'Today':        return { from: today, to: now }
    case 'Yesterday': {
      const y = new Date(today); y.setDate(y.getDate() - 1)
      const e = new Date(today); e.setMilliseconds(-1)
      return { from: y, to: e }
    }
    case 'Last 7 Days':  { const f = new Date(today); f.setDate(f.getDate() - 6);  return { from: f, to: now } }
    case 'Last 30 Days': { const f = new Date(today); f.setDate(f.getDate() - 29); return { from: f, to: now } }
    default:             return { from: today, to: now }
  }
}

export default function ReportsPage() {
  const { profile } = useAuth()

  const [activeFilter, setActiveFilter] = useState('Today')
  const [showDropdown, setShowDropdown] = useState(false)
  const [customFrom, setCustomFrom]     = useState('')
  const [customTo, setCustomTo]         = useState('')
  const [showCustom, setShowCustom]     = useState(false)
  const [loading, setLoading]           = useState(true)
  const dropdownRef                     = useRef(null)

  // Data
  const [totalRevenue, setTotalRevenue]       = useState(0)
  const [billCount, setBillCount]             = useState(0)
  const [avgBill, setAvgBill]                 = useState(0)
  const [dineInRevenue, setDineInRevenue]     = useState(0)
  const [takeawayRevenue, setTakeawayRevenue] = useState(0)
  const [deliveryRevenue, setDeliveryRevenue] = useState(0)
  const [cashTotal, setCashTotal]             = useState(0)
  const [cardTotal, setCardTotal]             = useState(0)
  const [upiTotal, setUpiTotal]               = useState(0)
  const [itemSales, setItemSales]             = useState([])
  const [dailySales, setDailySales]           = useState([])

  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (activeFilter === 'Custom Range') {
      if (customFrom && customTo) fetchData()
    } else {
      fetchData()
    }
  }, [activeFilter, customFrom, customTo])

  async function fetchData() {
    setLoading(true)
    let from, to
    if (activeFilter === 'Custom Range' && customFrom && customTo) {
      from = new Date(customFrom)
      to   = new Date(customTo); to.setHours(23, 59, 59, 999)
    } else {
      const range = getDateRange(activeFilter)
      from = range.from; to = range.to
    }
    const fromISO = from.toISOString()
    const toISO   = to.toISOString()

    // Bills
    const { data: bills } = await supabase
      .from('bills')
      .select('id, total, cash_amount, card_amount, upi_amount, created_at, order_id')
      .eq('status', 'paid')
      .gte('created_at', fromISO)
      .lte('created_at', toISO)

    const billList = bills || []
    setBillCount(billList.length)

    const total = billList.reduce((sum, b) => sum + parseFloat(b.total || 0), 0)
    setTotalRevenue(total)
    setAvgBill(billList.length ? total / billList.length : 0)
    setCashTotal(billList.reduce((sum, b) => sum + parseFloat(b.cash_amount || 0), 0))
    setCardTotal(billList.reduce((sum, b) => sum + parseFloat(b.card_amount || 0), 0))
    setUpiTotal(billList.reduce((sum, b) => sum + parseFloat(b.upi_amount  || 0), 0))

    // Order types
    const orderIds = billList.map(b => b.order_id).filter(Boolean)
    let orderTypeMap = {}
    if (orderIds.length > 0) {
      const { data: ordersData } = await supabase
        .from('orders').select('id, order_type').in('id', orderIds)
      ;(ordersData || []).forEach(o => { orderTypeMap[o.id] = o.order_type })
    }

    let dineIn = 0, takeaway = 0, delivery = 0
    billList.forEach(b => {
      const amt  = parseFloat(b.total || 0)
      const type = orderTypeMap[b.order_id]
      if (type === 'dine_in')  dineIn   += amt
      if (type === 'takeaway') takeaway += amt
      if (type === 'delivery') delivery += amt
    })
    setDineInRevenue(dineIn); setTakeawayRevenue(takeaway); setDeliveryRevenue(delivery)

    // Daily sales
    const dayMap = {}
    const cursor = new Date(from)
    while (cursor <= to) {
      const key = cursor.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
      dayMap[key] = { date: key, Revenue: 0, Bills: 0 }
      cursor.setDate(cursor.getDate() + 1)
    }
    billList.forEach(b => {
      const key = new Date(b.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
      if (!dayMap[key]) dayMap[key] = { date: key, Revenue: 0, Bills: 0 }
      dayMap[key].Revenue += parseFloat(b.total || 0)
      dayMap[key].Bills   += 1
    })
    setDailySales(Object.values(dayMap))

    // Item-wise sales
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('quantity, unit_price, menu_items(name)')
      .gte('created_at', fromISO)
      .lte('created_at', toISO)

    const itemMap = {}
    ;(orderItems || []).forEach(oi => {
      const name = oi.menu_items?.name
      if (!name) return
      if (!itemMap[name]) itemMap[name] = { name, qty: 0, revenue: 0 }
      itemMap[name].qty     += oi.quantity
      itemMap[name].revenue += oi.quantity * parseFloat(oi.unit_price || 0)
    })
    setItemSales(Object.values(itemMap).sort((a, b) => b.revenue - a.revenue))

    setLoading(false)
  }

  function selectFilter(f) {
    setActiveFilter(f)
    if (f === 'Custom Range') { setShowCustom(true); setShowDropdown(false) }
    else { setShowCustom(false); setShowDropdown(false) }
  }

  function getFilterLabel() {
    if (activeFilter === 'Custom Range' && customFrom && customTo) return customFrom + ' → ' + customTo
    return activeFilter
  }

  const paymentTotal = cashTotal + cardTotal + upiTotal

  const card = (children, style = {}) => (
    <div style={{ background: '#fff', borderRadius: 14, padding: '20px 22px', border: '1px solid ' + theme.border, ...style }}>
      {children}
    </div>
  )

  const sectionTitle = (title, subtitle) => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: theme.textDark }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: theme.textLight, marginTop: 2 }}>{subtitle}</div>}
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: theme.textDark, margin: 0 }}>Reports</h1>
          <p style={{ color: theme.textLight, fontSize: 14, marginTop: 4 }}>Sales and revenue breakdown</p>
        </div>

        {/* Filter dropdown */}
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button onClick={() => setShowDropdown(d => !d)}
            style={{ background: '#fff', border: '1px solid ' + theme.border, borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: theme.textDark, display: 'flex', alignItems: 'center', gap: 8, minWidth: 160, justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Calendar size={14} />{getFilterLabel()}</span>
            <ChevronDown size={14} color={theme.textLight} />
          </button>
          {showDropdown && (
            <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', background: '#fff', border: '1px solid ' + theme.border, borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100, minWidth: 180, overflow: 'hidden' }}>
              {FILTERS.map(f => (
                <div key={f} onClick={() => selectFilter(f)}
                  style={{ padding: '11px 16px', fontSize: 13, fontWeight: activeFilter === f ? 700 : 500, color: activeFilter === f ? '#fff' : theme.textDark, background: activeFilter === f ? '#092b33' : 'transparent', cursor: 'pointer' }}
                  onMouseEnter={e => { if (activeFilter !== f) e.currentTarget.style.background = theme.bgWarm }}
                  onMouseLeave={e => { if (activeFilter !== f) e.currentTarget.style.background = 'transparent' }}>
                  {f}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Custom range picker */}
      {showCustom && activeFilter === 'Custom Range' && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid ' + theme.border, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: theme.textMid }}>From</span>
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
            style={{ border: '1.5px solid ' + theme.border, borderRadius: 8, padding: '7px 12px', fontSize: 13, outline: 'none' }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: theme.textMid }}>To</span>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
            style={{ border: '1.5px solid ' + theme.border, borderRadius: 8, padding: '7px 12px', fontSize: 13, outline: 'none' }} />
          <button onClick={() => { setShowCustom(false); setActiveFilter('Today') }}
            style={{ background: theme.bgWarm, border: '1px solid ' + theme.border, borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: theme.textMid }}>
            Clear
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ color: theme.textLight, padding: 40, textAlign: 'center' }}>Loading...</div>
      ) : (
        <>
          {/* Row 1 — Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 14 }}>
            <div style={{ background: '#092b33', borderRadius: 14, padding: '20px 22px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Total Revenue</div>
              <div style={{ fontSize: 30, fontWeight: 900, color: '#D4A853', letterSpacing: -1 }}>₹{totalRevenue.toFixed(0)}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{getFilterLabel()}</div>
            </div>
            <div style={{ background: '#fff', borderRadius: 14, padding: '20px 22px', border: '1px solid ' + theme.border }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Bills Generated</div>
              <div style={{ fontSize: 30, fontWeight: 900, color: theme.textDark, letterSpacing: -1 }}>{billCount}</div>
              <div style={{ fontSize: 12, color: theme.textLight, marginTop: 4 }}>Avg ₹{avgBill.toFixed(0)} per bill</div>
            </div>
            <div style={{ background: '#fff', borderRadius: 14, padding: '20px 22px', border: '1px solid ' + theme.border }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Avg Bill Value</div>
              <div style={{ fontSize: 30, fontWeight: 900, color: theme.textDark, letterSpacing: -1 }}>₹{avgBill.toFixed(0)}</div>
              <div style={{ fontSize: 12, color: theme.textLight, marginTop: 4 }}>Per transaction</div>
            </div>
          </div>

          {/* Row 2 — Order type + Payment mode */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>

            {/* Order type breakdown */}
            {card(<>
              {sectionTitle('Order Type Breakdown')}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: 'Dine In',  value: dineInRevenue,   icon: <Utensils size={14} />,   color: '#092b33' },
                  { label: 'Takeaway', value: takeawayRevenue, icon: <ShoppingBag size={14} />, color: '#0D9488' },
                  { label: 'Delivery', value: deliveryRevenue, icon: <Truck size={14} />,       color: '#D4A853' },
                ].map(({ label, value, icon, color }) => {
                  const pct = totalRevenue > 0 ? Math.round((value / totalRevenue) * 100) : 0
                  return (
                    <div key={label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                        <span style={{ fontWeight: 600, color: theme.textMid, display: 'flex', alignItems: 'center', gap: 6 }}>{icon}{label}</span>
                        <span style={{ fontWeight: 800, color: theme.textDark }}>₹{value.toFixed(0)} <span style={{ fontSize: 11, color: theme.textLight, fontWeight: 500 }}>({pct}%)</span></span>
                      </div>
                      <div style={{ height: 7, background: theme.bgWarm, borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: pct + '%', background: color, borderRadius: 99 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </>)}

            {/* Payment mode breakdown */}
            {card(<>
              {sectionTitle('Payment Mode Breakdown')}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: 'Cash', value: cashTotal,  icon: <Banknote size={14} />,  color: '#15803D' },
                  { label: 'Card', value: cardTotal,  icon: <CreditCard size={14} />, color: '#1D4ED8' },
                  { label: 'UPI',  value: upiTotal,   icon: <Smartphone size={14} />, color: '#6D28D9' },
                ].map(({ label, value, icon, color }) => {
                  const pct = paymentTotal > 0 ? Math.round((value / paymentTotal) * 100) : 0
                  return (
                    <div key={label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                        <span style={{ fontWeight: 600, color: theme.textMid, display: 'flex', alignItems: 'center', gap: 6 }}>{icon}{label}</span>
                        <span style={{ fontWeight: 800, color: theme.textDark }}>₹{value.toFixed(0)} <span style={{ fontSize: 11, color: theme.textLight, fontWeight: 500 }}>({pct}%)</span></span>
                      </div>
                      <div style={{ height: 7, background: theme.bgWarm, borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: pct + '%', background: color, borderRadius: 99 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </>)}
          </div>

          {/* Row 3 — Daily sales chart */}
          {card(<>
            {sectionTitle('Daily Sales', 'Revenue per day')}
            {dailySales.length === 0 ? (
              <div style={{ textAlign: 'center', color: theme.textMuted, fontSize: 13, padding: '30px 0' }}>No data in this period</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={dailySales} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.bgWarm} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: theme.textLight }} />
                  <YAxis tick={{ fontSize: 11, fill: theme.textLight }} tickFormatter={v => '₹' + v} />
                  <Tooltip formatter={(value, name) => [name === 'Revenue' ? '₹' + value.toFixed(0) : value, name]} contentStyle={{ borderRadius: 10, border: '1px solid ' + theme.border, fontSize: 12 }} />
                  <Bar dataKey="Revenue" fill="#092b33" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </>, { marginBottom: 14 })}

          {/* Row 4 — Item-wise sales table */}
          {card(<>
            {sectionTitle('Item-wise Sales', 'Sorted by revenue')}
            {itemSales.length === 0 ? (
              <div style={{ textAlign: 'center', color: theme.textMuted, fontSize: 13, padding: '30px 0' }}>No items sold in this period</div>
            ) : (
              <div>
                {/* Table header */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 100px', padding: '8px 12px', background: theme.bgWarm, borderRadius: 8, marginBottom: 4 }}>
                  {['Item', 'Qty', 'Revenue', '% Share'].map(h => (
                    <div key={h} style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: h === 'Item' ? 'left' : 'right' }}>{h}</div>
                  ))}
                </div>
                {itemSales.map((item, idx) => {
                  const pct = totalRevenue > 0 ? ((item.revenue / totalRevenue) * 100).toFixed(1) : 0
                  return (
                    <div key={item.name} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 100px', padding: '11px 12px', borderBottom: '1px solid ' + theme.bgWarm, alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: theme.textMuted, width: 20 }}>#{idx + 1}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: theme.textDark }}>{item.name}</span>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: theme.textMid }}>{item.qty}</div>
                      <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: theme.textDark }}>₹{item.revenue.toFixed(0)}</div>
                      <div style={{ textAlign: 'right', fontSize: 13, color: theme.textLight }}>{pct}%</div>
                    </div>
                  )
                })}
                {/* Total row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px 100px', padding: '12px 12px', background: theme.bgWarm, borderRadius: 8, marginTop: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: theme.textDark }}>Total</div>
                  <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 800, color: theme.textDark }}>{itemSales.reduce((s, i) => s + i.qty, 0)}</div>
                  <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 800, color: theme.textDark }}>₹{totalRevenue.toFixed(0)}</div>
                  <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 800, color: theme.textDark }}>100%</div>
                </div>
              </div>
            )}
          </>)}
        </>
      )}
    </div>
  )
}