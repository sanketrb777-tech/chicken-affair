import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { theme } from '../../lib/theme'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { ShoppingBag, Truck, Utensils, Banknote, CreditCard, Smartphone, LayoutGrid, BarChart2, Calendar, ChevronDown, Eye, Printer, X } from 'lucide-react'

const FILTERS_BY_ROLE = {
  owner:   ['Today', 'Yesterday', 'Last 7 Days', 'Last 30 Days', 'Custom Range'],
  manager: ['Today', 'Yesterday', 'Last 3 Days'],
  captain: ['Today', 'Yesterday', 'Last 3 Days'],
  biller:  ['Today', 'Yesterday', 'Last 3 Days'],
}

function getDateRange(filter) {
  const now   = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  switch (filter) {
    case 'Today':       return { from: today, to: now }
    case 'Yesterday': {
      const y = new Date(today); y.setDate(y.getDate() - 1)
      const e = new Date(today); e.setMilliseconds(-1)
      return { from: y, to: e }
    }
    case 'Last 3 Days': { const f = new Date(today); f.setDate(f.getDate() - 2); return { from: f, to: now } }
    case 'Last 7 Days': { const f = new Date(today); f.setDate(f.getDate() - 6); return { from: f, to: now } }
    case 'Last 30 Days':{ const f = new Date(today); f.setDate(f.getDate() - 29);return { from: f, to: now } }
    default:            return { from: today, to: now }
  }
}

const CHART_COLORS = ['#7f1d1d', '#dc2626', '#ef4444', '#dc2626', '#B91C1C']

const ORDER_TYPE_BADGE = {
  dine_in:  { label: 'Dine In',  bg: '#fee2e2', color: '#dc2626' },
  takeaway: { label: 'Takeaway', bg: '#fee2e2', color: '#b91c1c' },
  delivery: { label: 'Delivery', bg: '#fff5f5', color: '#dc2626' },
}

function printBill(bill) {
  const w = window.open('', '_blank', 'width=400,height=700')
  if (!w) return
  const date = new Date(bill.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  const paymentParts = []
  if (bill.cash_amount > 0) paymentParts.push(`Cash ₹${parseFloat(bill.cash_amount).toFixed(2)}`)
  if (bill.card_amount > 0) paymentParts.push(`Card ₹${parseFloat(bill.card_amount).toFixed(2)}`)
  if (bill.upi_amount  > 0) paymentParts.push(`UPI ₹${parseFloat(bill.upi_amount).toFixed(2)}`)

  const itemsHtml = (bill.items || []).map(i =>
    `<tr>
      <td style="padding:3px 0">${i.name}</td>
      <td style="text-align:center;padding:3px 4px">${i.quantity}</td>
      <td style="text-align:right;padding:3px 0">₹${(i.price * i.quantity).toFixed(2)}</td>
    </tr>`
  ).join('')

  const subtotal  = parseFloat(bill.total || 0) / 1.18
  const gstAmount = parseFloat(bill.total || 0) - subtotal

  w.document.write(`<!DOCTYPE html><html><head>
    <title>Bill #${bill.id?.slice(0,8)}</title>
    <style>
      body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; margin: 0 auto; padding: 10px; color: #000; }
      h2 { text-align: center; font-size: 16px; margin: 0 0 2px; }
      .sub { text-align: center; font-size: 11px; color: #444; margin-bottom: 8px; }
      .divider { border-top: 1px dashed #000; margin: 8px 0; }
      table { width: 100%; border-collapse: collapse; }
      th { font-size: 10px; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 4px; }
      .total-row td { font-weight: bold; font-size: 13px; padding-top: 6px; }
      .footer { text-align: center; font-size: 11px; margin-top: 12px; color: #555; }
      @media print { body { margin: 0; } }
    </style>
  </head><body>
    <h2>Cafe Chicken Affair</h2>
    <div class="sub">Chicken Affair · Pune</div>
    <div class="divider"></div>
    <div style="font-size:11px">
      <div><b>Date:</b> ${date}</div>
      ${bill.table_name ? `<div><b>Table:</b> ${bill.table_name}</div>` : ''}
      ${bill.order_type ? `<div><b>Type:</b> ${bill.order_type.replace('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}</div>` : ''}
      <div><b>Bill #:</b> ${bill.id?.slice(0,8).toUpperCase()}</div>
    </div>
    <div class="divider"></div>
    <table>
      <thead><tr>
        <th style="text-align:left">Item</th>
        <th style="text-align:center">Qty</th>
        <th style="text-align:right">Amt</th>
      </tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <div class="divider"></div>
    <table>
      <tr><td>Subtotal</td><td style="text-align:right">₹${subtotal.toFixed(2)}</td></tr>
      <tr><td>CGST 9%</td><td style="text-align:right">₹${(gstAmount/2).toFixed(2)}</td></tr>
      <tr><td>SGST 9%</td><td style="text-align:right">₹${(gstAmount/2).toFixed(2)}</td></tr>
      <tr class="total-row"><td>TOTAL</td><td style="text-align:right">₹${parseFloat(bill.total).toFixed(2)}</td></tr>
    </table>
    <div class="divider"></div>
    <div style="font-size:11px"><b>Payment:</b> ${paymentParts.join(' + ') || 'N/A'}</div>
    <div class="divider"></div>
    <div class="footer">Thank you for visiting!<br/>Please visit again 😊</div>
  </body></html>`)
  w.document.close()
  w.focus()
  setTimeout(() => { w.print() }, 400)
}

function BillViewModal({ bill, onClose }) {
  const [items, setItems]     = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('order_items')
        .select('*, menu_items(name)')
        .eq('order_id', bill.order_id)
      setItems(data || [])
      setLoading(false)
    }
    load()
  }, [bill.order_id])

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0)
  const gst      = parseFloat(bill.gst_amount || 0)
  const payParts = []
  if (parseFloat(bill.cash_amount) > 0) payParts.push(`Cash ₹${parseFloat(bill.cash_amount).toFixed(2)}`)
  if (parseFloat(bill.card_amount) > 0) payParts.push(`Card ₹${parseFloat(bill.card_amount).toFixed(2)}`)
  if (parseFloat(bill.upi_amount)  > 0) payParts.push(`UPI ₹${parseFloat(bill.upi_amount).toFixed(2)}`)
  const badge = ORDER_TYPE_BADGE[bill.order_type] || { label: '—', bg: theme.bgWarm, color: theme.textLight }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>

        <div style={{ background: '#7f1d1d', borderRadius: '16px 16px 0 0', padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>Bill #{bill.id?.slice(0,8).toUpperCase()}</div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 3 }}>
              {new Date(bill.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {bill.table_name && (
              <span style={{ background: theme.bgWarm, color: theme.textMid, fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 20 }}>
                🪑 {bill.table_name}
              </span>
            )}
            <span style={{ background: badge.bg, color: badge.color, fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20 }}>
              {badge.label}
            </span>
          </div>

          <div style={{ border: '1px solid ' + theme.border, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'flex', padding: '8px 14px', background: theme.bgWarm, borderBottom: '1px solid ' + theme.border }}>
              <div style={{ flex: 1, fontSize: 11, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase' }}>Item</div>
              <div style={{ width: 36, textAlign: 'center', fontSize: 11, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase' }}>Qty</div>
              <div style={{ width: 75, textAlign: 'right', fontSize: 11, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase' }}>Amount</div>
            </div>
            {loading ? (
              <div style={{ padding: 20, textAlign: 'center', color: theme.textLight, fontSize: 13 }}>Loading items...</div>
            ) : items.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: theme.textLight, fontSize: 13 }}>No items found</div>
            ) : items.map((item, i) => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', padding: '9px 14px', borderBottom: i < items.length - 1 ? '1px solid ' + theme.bgWarm : 'none' }}>
                <div style={{ flex: 1, fontSize: 13, color: theme.textDark, fontWeight: 500 }}>{item.menu_items?.name}</div>
                <div style={{ width: 36, textAlign: 'center', fontSize: 13, color: theme.textMid }}>{item.quantity}</div>
                <div style={{ width: 75, textAlign: 'right', fontSize: 13, fontWeight: 700, color: theme.textDark }}>₹{(item.quantity * item.unit_price).toFixed(2)}</div>
              </div>
            ))}
          </div>

          <div style={{ border: '1px solid ' + theme.border, borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', borderBottom: '1px solid ' + theme.bgWarm, fontSize: 13, color: theme.textMid }}>
              <span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span>
            </div>
            {parseFloat(bill.discount_amount) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', borderBottom: '1px solid ' + theme.bgWarm, fontSize: 13, color: '#15803D' }}>
                <span>Discount{bill.discount_name ? ` (${bill.discount_name})` : ''}</span>
                <span>— ₹{parseFloat(bill.discount_amount).toFixed(2)}</span>
              </div>
            )}
            {gst > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', borderBottom: '1px solid ' + theme.bgWarm, fontSize: 13, color: theme.textLight }}>
                <span>GST (incl.)</span><span>₹{gst.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', fontSize: 15, fontWeight: 900, color: theme.textDark }}>
              <span>Total</span><span>₹{parseFloat(bill.total).toFixed(2)}</span>
            </div>
          </div>

          <div style={{ background: '#F0FDF4', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#15803D', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Payment</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#15803D' }}>{payParts.join(' + ') || '—'}</div>
          </div>

          {bill.notes && (
            <div style={{ background: theme.bgWarm, borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Notes</div>
              <div style={{ fontSize: 13, color: theme.textMid }}>{bill.notes}</div>
            </div>
          )}

          <button onClick={onClose} style={{ width: '100%', background: '#7f1d1d', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { profile } = useAuth()
  const role        = profile?.role || 'captain'
  const filters     = FILTERS_BY_ROLE[role] || FILTERS_BY_ROLE.captain

  const [activeFilter, setActiveFilter] = useState('Today')
  const [showDropdown, setShowDropdown] = useState(false)
  const [customFrom, setCustomFrom]     = useState('')
  const [customTo, setCustomTo]         = useState('')
  const [showCustom, setShowCustom]     = useState(false)
  const [loading, setLoading]           = useState(true)
  const [chartType, setChartType]       = useState('bar')
  const [showChartDropdown, setShowChartDropdown] = useState(false)
  const [printingId, setPrintingId]     = useState(null)
  const [viewBill, setViewBill]         = useState(null)
  const dropdownRef      = useRef(null)
  const chartDropdownRef = useRef(null)

  const [totalRevenue, setTotalRevenue]       = useState(0)
  const [dineInRevenue, setDineInRevenue]     = useState(0)
  const [takeawayRevenue, setTakeawayRevenue] = useState(0)
  const [deliveryRevenue, setDeliveryRevenue] = useState(0)
  const [cashTotal, setCashTotal]             = useState(0)
  const [cardTotal, setCardTotal]             = useState(0)
  const [upiTotal, setUpiTotal]               = useState(0)
  const [activeOrders, setActiveOrders]       = useState(0)
  const [freeTables, setFreeTables]           = useState(0)
  const [occupiedTables, setOccupiedTables]   = useState(0)
  const [totalTables, setTotalTables]         = useState(0)
  const [billCount, setBillCount]             = useState(0)
  const [chartData, setChartData]             = useState([])
  const [billList, setBillList]               = useState([])

  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false)
      if (chartDropdownRef.current && !chartDropdownRef.current.contains(e.target)) setShowChartDropdown(false)
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

    const { data: bills } = await supabase
      .from('bills')
      .select('id, total, cash_amount, card_amount, upi_amount, created_at, order_id, notes, discount_amount, discount_name, discount_percentage, gst_amount')
      .eq('status', 'paid')
      .gte('created_at', fromISO)
      .lte('created_at', toISO)
      .order('created_at', { ascending: false })

    const rawBills = bills || []
    setBillCount(rawBills.length)

    const orderIds = rawBills.map(b => b.order_id).filter(Boolean)
    let orderMap = {}
    if (orderIds.length > 0) {
      const { data: ordersData } = await supabase
        .from('orders').select('id, order_type, table_id').in('id', orderIds)
      ;(ordersData || []).forEach(o => { orderMap[o.id] = o })
    }

    const tableIds = Object.values(orderMap).map(o => o.table_id).filter(Boolean)
    let tableMap = {}
    if (tableIds.length > 0) {
      const { data: tablesData } = await supabase
        .from('cafe_tables').select('id, name').in('id', tableIds)
      ;(tablesData || []).forEach(t => { tableMap[t.id] = t.name })
    }

    const enrichedBills = rawBills.map(b => {
      const order = orderMap[b.order_id] || {}
      return {
        ...b,
        order_type: order.order_type || null,
        table_name: order.table_id ? tableMap[order.table_id] : null,
      }
    })
    setBillList(enrichedBills)

    let total = 0, dineIn = 0, takeaway = 0, delivery = 0, cash = 0, card = 0, upi = 0
    enrichedBills.forEach(b => {
      const amt = parseFloat(b.total || 0)
      total += amt
      cash  += parseFloat(b.cash_amount || 0)
      card  += parseFloat(b.card_amount || 0)
      upi   += parseFloat(b.upi_amount  || 0)
      if (b.order_type === 'dine_in')  dineIn   += amt
      if (b.order_type === 'takeaway') takeaway += amt
      if (b.order_type === 'delivery') delivery += amt
    })

    setTotalRevenue(total); setDineInRevenue(dineIn)
    setTakeawayRevenue(takeaway); setDeliveryRevenue(delivery)
    setCashTotal(cash); setCardTotal(card); setUpiTotal(upi)

    const isHourly = activeFilter === 'Today' || activeFilter === 'Yesterday'
    const grouped  = {}
    if (isHourly) {
      const startHour = activeFilter === 'Yesterday' ? 0 : from.getHours()
      const endHour   = activeFilter === 'Yesterday' ? 23 : new Date().getHours()
      for (let h = startHour; h <= endHour; h++) {
        const key = h + ':00'
        grouped[key] = { label: key, 'Dine In': 0, Takeaway: 0, Delivery: 0, Total: 0 }
      }
    } else {
      const cursor = new Date(from)
      while (cursor <= to) {
        const key = cursor.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
        grouped[key] = { label: key, 'Dine In': 0, Takeaway: 0, Delivery: 0, Total: 0 }
        cursor.setDate(cursor.getDate() + 1)
      }
    }
    enrichedBills.forEach(b => {
      const d   = new Date(b.created_at)
      const key = isHourly
        ? d.getHours() + ':00'
        : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
      if (!grouped[key]) grouped[key] = { label: key, 'Dine In': 0, Takeaway: 0, Delivery: 0, Total: 0 }
      const amt = parseFloat(b.total || 0)
      grouped[key].Total += amt
      if (b.order_type === 'dine_in')  grouped[key]['Dine In']  += amt
      if (b.order_type === 'takeaway') grouped[key]['Takeaway'] += amt
      if (b.order_type === 'delivery') grouped[key]['Delivery'] += amt
    })
    const sortedChart = Object.values(grouped).sort((a, b) => {
      if (isHourly) return parseInt(a.label) - parseInt(b.label)
      return new Date(a.label) - new Date(b.label)
    })
    setChartData(sortedChart)

    const { data: orders } = await supabase.from('orders').select('id').eq('status', 'active')
    setActiveOrders((orders || []).length)
    const { data: tables } = await supabase.from('cafe_tables').select('status')
    setTotalTables((tables || []).length)
    setFreeTables((tables || []).filter(t => t.status === 'free').length)
    setOccupiedTables((tables || []).filter(t => t.status === 'occupied' || t.status === 'bill_requested').length)

    setLoading(false)
  }

  async function handlePrint(bill) {
    setPrintingId(bill.id)
    const { data } = await supabase
      .from('order_items')
      .select('unit_price, quantity, menu_items(name)')
      .eq('order_id', bill.order_id)
    const items = (data || []).map(i => ({ name: i.menu_items?.name, quantity: i.quantity, price: i.unit_price }))
    printBill({ ...bill, items })
    setPrintingId(null)
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

  const occupancyPct = totalTables > 0 ? Math.round((occupiedTables / totalTables) * 100) : 0
  const paymentTotal = cashTotal + cardTotal + upiTotal

  const pieData = [
    { name: 'Dine In',  value: dineInRevenue },
    { name: 'Takeaway', value: takeawayRevenue },
    { name: 'Delivery', value: deliveryRevenue },
  ].filter(d => d.value > 0)

  const CHART_TYPE_LABELS = { bar: 'Bar Chart', line: 'Line Chart', pie: 'Pie Chart' }

  const PAYMENT_MODE_LABEL = (b) => {
    const parts = []
    if (parseFloat(b.cash_amount) > 0) parts.push('Cash')
    if (parseFloat(b.card_amount) > 0) parts.push('Card')
    if (parseFloat(b.upi_amount)  > 0) parts.push('UPI')
    return parts.join(' + ') || '—'
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: theme.textDark, margin: 0 }}>
            Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, {profile?.name?.split(' ')[0]} 👋
          </h1>
          <p style={{ color: theme.textLight, fontSize: 14, marginTop: 4 }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button onClick={() => setShowDropdown(d => !d)}
            style={{ background: '#fff', border: '1px solid ' + theme.border, borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: theme.textDark, display: 'flex', alignItems: 'center', gap: 8, minWidth: 160, justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Calendar size={14} />{getFilterLabel()}</span>
            <ChevronDown size={14} color={theme.textLight} />
          </button>
          {showDropdown && (
            <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', background: '#fff', border: '1px solid ' + theme.border, borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100, minWidth: 180, overflow: 'hidden' }}>
              {filters.map(f => (
                <div key={f} onClick={() => selectFilter(f)}
                  style={{ padding: '11px 16px', fontSize: 13, fontWeight: activeFilter === f ? 700 : 500, color: activeFilter === f ? '#fff' : theme.textDark, background: activeFilter === f ? '#7f1d1d' : 'transparent', cursor: 'pointer' }}
                  onMouseEnter={e => { if (activeFilter !== f) e.currentTarget.style.background = theme.bgWarm }}
                  onMouseLeave={e => { if (activeFilter !== f) e.currentTarget.style.background = 'transparent' }}>
                  {f}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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
          {/* Row 1 — Revenue cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 14 }}>
            <div style={{ background: '#7f1d1d', borderRadius: 14, padding: '20px 22px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Total Revenue</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#ef4444', letterSpacing: -1 }}>₹{totalRevenue.toFixed(0)}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{billCount} bill{billCount !== 1 ? 's' : ''} · {getFilterLabel()}</div>
            </div>
            {[
              { label: 'Dine In',  value: dineInRevenue },
              { label: 'Takeaway', value: takeawayRevenue },
              { label: 'Delivery', value: deliveryRevenue },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: '#fff', borderRadius: 14, padding: '20px 22px', border: '1px solid ' + theme.border }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  {label === 'Dine In'  && <Utensils size={14} color={theme.textLight} />}
                  {label === 'Takeaway' && <ShoppingBag size={14} color={theme.textLight} />}
                  {label === 'Delivery' && <Truck size={14} color={theme.textLight} />}
                  <span style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</span>
                </div>
                <div style={{ fontSize: 26, fontWeight: 900, color: theme.textDark, letterSpacing: -1 }}>₹{value.toFixed(0)}</div>
                <div style={{ fontSize: 12, color: theme.textLight, marginTop: 4 }}>
                  {totalRevenue > 0 ? Math.round((value / totalRevenue) * 100) : 0}% of total
                </div>
              </div>
            ))}
          </div>

          {/* Row 2 — Payment + Active + Tables */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div style={{ background: '#fff', borderRadius: 14, padding: '20px 22px', border: '1px solid ' + theme.border }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: theme.textDark, marginBottom: 16 }}>Payment Modes</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: 'Cash', value: cashTotal,  color: '#15803D' },
                  { label: 'Card', value: cardTotal,  color: '#b91c1c' },
                  { label: 'UPI',  value: upiTotal,   color: '#b91c1c' },
                ].map(({ label, value, color }) => {
                  const pct = paymentTotal > 0 ? Math.round((value / paymentTotal) * 100) : 0
                  return (
                    <div key={label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                        <span style={{ fontWeight: 600, color: theme.textMid, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {label === 'Cash' && <Banknote size={14} />}
                          {label === 'Card' && <CreditCard size={14} />}
                          {label === 'UPI'  && <Smartphone size={14} />}
                          {label}
                        </span>
                        <span style={{ fontWeight: 800, color: theme.textDark }}>₹{value.toFixed(0)} <span style={{ fontSize: 11, color: theme.textLight, fontWeight: 500 }}>({pct}%)</span></span>
                      </div>
                      <div style={{ height: 7, background: theme.bgWarm, borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: pct + '%', background: color, borderRadius: 99 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: '#fff', borderRadius: 14, padding: '20px 22px', border: '1px solid ' + theme.border }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Active Orders Right Now</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: activeOrders > 0 ? '#b91c1c' : theme.textDark }}>{activeOrders}</div>
              </div>
              <div style={{ background: '#fff', borderRadius: 14, padding: '20px 22px', border: '1px solid ' + theme.border, flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: theme.textDark, display: 'flex', alignItems: 'center', gap: 6 }}><LayoutGrid size={14} />Tables</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: theme.textLight }}>{occupancyPct}% occupied</div>
                </div>
                <div style={{ height: 7, background: theme.bgWarm, borderRadius: 99, overflow: 'hidden', marginBottom: 12 }}>
                  <div style={{ height: '100%', width: occupancyPct + '%', background: occupancyPct > 70 ? theme.red : occupancyPct > 40 ? '#ef4444' : '#dc2626', borderRadius: 99 }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'Free',     value: freeTables,     color: '#dc2626', bg: '#fee2e2' },
                    { label: 'Occupied', value: occupiedTables, color: '#b91c1c', bg: '#fee2e2' },
                    { label: 'Total',    value: totalTables,    color: theme.textDark, bg: theme.bgWarm },
                  ].map(s => (
                    <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: '10px', textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 10, color: s.color, fontWeight: 600, marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Row 3 — Sales Chart */}
          <div style={{ background: '#fff', borderRadius: 14, padding: '20px 22px', border: '1px solid ' + theme.border, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: theme.textDark }}>Sales Data</div>
                <div style={{ fontSize: 12, color: theme.textLight, marginTop: 2 }}>
                  {activeFilter === 'Today' || activeFilter === 'Yesterday' ? 'Hourly breakdown' : 'Daily breakdown'} by order type
                </div>
              </div>
              <div ref={chartDropdownRef} style={{ position: 'relative' }}>
                <button onClick={() => setShowChartDropdown(d => !d)}
                  style={{ background: theme.bgWarm, border: '1px solid ' + theme.border, borderRadius: 9, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', color: theme.textDark, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BarChart2 size={14} />{CHART_TYPE_LABELS[chartType]}
                  <ChevronDown size={13} color={theme.textLight} />
                </button>
                {showChartDropdown && (
                  <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', background: '#fff', border: '1px solid ' + theme.border, borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 100, minWidth: 160, overflow: 'hidden' }}>
                    {Object.entries(CHART_TYPE_LABELS).map(([key, label]) => (
                      <div key={key} onClick={() => { setChartType(key); setShowChartDropdown(false) }}
                        style={{ padding: '11px 16px', fontSize: 13, fontWeight: chartType === key ? 700 : 500, color: chartType === key ? '#fff' : theme.textDark, background: chartType === key ? '#7f1d1d' : 'transparent', cursor: 'pointer' }}
                        onMouseEnter={e => { if (chartType !== key) e.currentTarget.style.background = theme.bgWarm }}
                        onMouseLeave={e => { if (chartType !== key) e.currentTarget.style.background = 'transparent' }}>
                        {label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {chartData.length === 0 ? (
              <div style={{ textAlign: 'center', color: theme.textMuted, fontSize: 13, padding: '40px 0' }}>No sales data in this period</div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                {chartType === 'bar' ? (
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.bgWarm} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: theme.textLight }} />
                    <YAxis tick={{ fontSize: 11, fill: theme.textLight }} tickFormatter={v => '₹' + v} />
                    <Tooltip formatter={(value) => ['₹' + value.toFixed(0)]} contentStyle={{ borderRadius: 10, border: '1px solid ' + theme.border, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Dine In"  fill="#7f1d1d" radius={[4,4,0,0]} />
                    <Bar dataKey="Takeaway" fill="#dc2626" radius={[4,4,0,0]} />
                    <Bar dataKey="Delivery" fill="#ef4444" radius={[4,4,0,0]} />
                  </BarChart>
                ) : chartType === 'line' ? (
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.bgWarm} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: theme.textLight }} />
                    <YAxis tick={{ fontSize: 11, fill: theme.textLight }} tickFormatter={v => '₹' + v} />
                    <Tooltip formatter={(value) => ['₹' + value.toFixed(0)]} contentStyle={{ borderRadius: 10, border: '1px solid ' + theme.border, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="Dine In"  stroke="#7f1d1d" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="Takeaway" stroke="#dc2626" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="Delivery" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                ) : (
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={110} dataKey="value" nameKey="name"
                      label={({ name, percent }) => name + ' ' + (percent * 100).toFixed(0) + '%'}
                      labelLine={true}>
                      {pieData.map((entry, index) => (
                        <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => ['₹' + value.toFixed(0)]} contentStyle={{ borderRadius: 10, border: '1px solid ' + theme.border, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                )}
              </ResponsiveContainer>
            )}
          </div>

          {/* Row 4 — Bills List */}
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid ' + theme.border, overflow: 'hidden' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid ' + theme.border, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: theme.textDark }}>Bills</div>
                <div style={{ fontSize: 12, color: theme.textLight, marginTop: 2 }}>{billCount} paid bill{billCount !== 1 ? 's' : ''} · {getFilterLabel()}</div>
              </div>
            </div>

            {billList.length === 0 ? (
              <div style={{ textAlign: 'center', color: theme.textLight, fontSize: 13, padding: '40px 0' }}>No bills in this period</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: theme.bgWarm }}>
                      {['Bill #', 'Time', 'Table', 'Type', 'Payment', 'Amount', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: h === 'Amount' ? 'right' : 'left', fontWeight: 700, fontSize: 11, color: theme.textLight, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {billList.map((bill, i) => {
                      const badge = ORDER_TYPE_BADGE[bill.order_type] || { label: '—', bg: theme.bgWarm, color: theme.textLight }
                      const isOdd = i % 2 === 0
                      return (
                        <tr key={bill.id} style={{ background: isOdd ? '#fff' : theme.bgWarm + '55', borderBottom: '1px solid ' + theme.border }}>
                          <td style={{ padding: '12px 16px', fontWeight: 700, color: theme.textDark }}>
                            #{bill.id?.slice(0,8).toUpperCase()}
                          </td>
                          <td style={{ padding: '12px 16px', color: theme.textMid, whiteSpace: 'nowrap' }}>
                            {new Date(bill.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                            <div style={{ fontSize: 11, color: theme.textLight }}>
                              {new Date(bill.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', color: theme.textMid }}>
                            {bill.table_name || '—'}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ background: badge.bg, color: badge.color, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20 }}>
                              {badge.label}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', color: theme.textMid, fontSize: 12 }}>
                            {PAYMENT_MODE_LABEL(bill)}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, color: theme.textDark }}>
                            ₹{parseFloat(bill.total).toFixed(0)}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                onClick={() => setViewBill(bill)}
                                style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#fff5f5', border: 'none', borderRadius: 7, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#b91c1c', cursor: 'pointer' }}>
                                <Eye size={13} /> View
                              </button>
                              <button
                                onClick={() => handlePrint(bill)}
                                disabled={printingId === bill.id}
                                style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#F0FDF4', border: 'none', borderRadius: 7, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#15803D', cursor: 'pointer', opacity: printingId === bill.id ? 0.6 : 1 }}>
                                <Printer size={13} /> {printingId === bill.id ? '...' : 'Print'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {viewBill && <BillViewModal bill={viewBill} onClose={() => setViewBill(null)} />}
    </div>
  )
}