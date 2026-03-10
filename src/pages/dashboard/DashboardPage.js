import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { theme } from '../../lib/theme'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { TrendingUp, ShoppingBag, Truck, Utensils, Banknote, CreditCard, Smartphone, ClipboardList, LayoutGrid, BarChart2, Calendar, ChevronDown } from 'lucide-react'

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

const CHART_COLORS = ['#092b33', '#0D9488', '#D4A853', '#7C3AED', '#B91C1C']

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

    // Bills
    const { data: bills } = await supabase
      .from('bills')
      .select('total_amount, cash_amount, card_amount, upi_amount, created_at, orders(order_type)')
      .eq('status', 'paid')
      .gte('created_at', fromISO)
      .lte('created_at', toISO)

    let total = 0, dineIn = 0, takeaway = 0, delivery = 0, cash = 0, card = 0, upi = 0
    ;(bills || []).forEach(b => {
      const amt = parseFloat(b.total_amount || 0)
      total    += amt
      cash     += parseFloat(b.cash_amount || 0)
      card     += parseFloat(b.card_amount || 0)
      upi      += parseFloat(b.upi_amount  || 0)
      const type = b.orders?.order_type
      if (type === 'dine_in')  dineIn   += amt
      if (type === 'takeaway') takeaway += amt
      if (type === 'delivery') delivery += amt
    })

    setTotalRevenue(total); setDineInRevenue(dineIn)
    setTakeawayRevenue(takeaway); setDeliveryRevenue(delivery)
    setCashTotal(cash); setCardTotal(card); setUpiTotal(upi)
    setBillCount((bills || []).length)

    // Build chart data
    const isHourly = activeFilter === 'Today' || activeFilter === 'Yesterday'
    const grouped  = {}

    ;(bills || []).forEach(b => {
      const d   = new Date(b.created_at)
      const key = isHourly
        ? d.getHours() + ':00'
        : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
      if (!grouped[key]) grouped[key] = { label: key, 'Dine In': 0, Takeaway: 0, Delivery: 0, Total: 0 }
      const amt  = parseFloat(b.total_amount || 0)
      const type = b.orders?.order_type
      grouped[key].Total    += amt
      if (type === 'dine_in')  grouped[key]['Dine In']  += amt
      if (type === 'takeaway') grouped[key]['Takeaway'] += amt
      if (type === 'delivery') grouped[key]['Delivery'] += amt
    })

    // Fill in missing hours/days
    if (isHourly) {
      const startHour = activeFilter === 'Yesterday' ? 0 : from.getHours()
      const endHour   = activeFilter === 'Yesterday' ? 23 : new Date().getHours()
      for (let h = startHour; h <= endHour; h++) {
        const key = h + ':00'
        if (!grouped[key]) grouped[key] = { label: key, 'Dine In': 0, Takeaway: 0, Delivery: 0, Total: 0 }
      }
    } else {
      const cursor = new Date(from)
      while (cursor <= to) {
        const key = cursor.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
        if (!grouped[key]) grouped[key] = { label: key, 'Dine In': 0, Takeaway: 0, Delivery: 0, Total: 0 }
        cursor.setDate(cursor.getDate() + 1)
      }
    }

    const sortedChart = Object.values(grouped).sort((a, b) => {
      if (isHourly) return parseInt(a.label) - parseInt(b.label)
      return new Date(a.label) - new Date(b.label)
    })
    setChartData(sortedChart)

    // Active orders + tables
    const { data: orders } = await supabase.from('orders').select('id').eq('status', 'active')
    setActiveOrders((orders || []).length)
    const { data: tables } = await supabase.from('cafe_tables').select('status')
    setTotalTables((tables || []).length)
    setFreeTables((tables || []).filter(t => t.status === 'free').length)
    setOccupiedTables((tables || []).filter(t => t.status === 'occupied' || t.status === 'bill_requested').length)

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

  const occupancyPct = totalTables > 0 ? Math.round((occupiedTables / totalTables) * 100) : 0
  const paymentTotal = cashTotal + cardTotal + upiTotal

  // Pie chart data
  const pieData = [
    { name: 'Dine In',  value: dineInRevenue },
    { name: 'Takeaway', value: takeawayRevenue },
    { name: 'Delivery', value: deliveryRevenue },
  ].filter(d => d.value > 0)

  const CHART_TYPE_LABELS = { bar: 'Bar Chart', line: 'Line Chart', pie: 'Pie Chart' }

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

        {/* Filter dropdown */}
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
          {/* Row 1 — Revenue cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 14 }}>
            <div style={{ background: '#092b33', borderRadius: 14, padding: '20px 22px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Total Revenue</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#D4A853', letterSpacing: -1 }}>₹{totalRevenue.toFixed(0)}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{billCount} bill{billCount !== 1 ? 's' : ''} · {getFilterLabel()}</div>
            </div>
            {[
              { label: 'Dine In',  value: dineInRevenue },
            { label: 'Takeaway', value: takeawayRevenue },
            { label: 'Delivery', value: deliveryRevenue },
            ].map(({ label, icon, value }) => (
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
                  { label: 'Card', value: cardTotal,  color: '#1D4ED8' },
                  { label: 'UPI',  value: upiTotal,   color: '#6D28D9' },
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
                <div style={{ fontSize: 28, fontWeight: 900, color: activeOrders > 0 ? '#B45309' : theme.textDark }}>{activeOrders}</div>
              </div>
              <div style={{ background: '#fff', borderRadius: 14, padding: '20px 22px', border: '1px solid ' + theme.border, flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: theme.textDark, display: 'flex', alignItems: 'center', gap: 6 }}><LayoutGrid size={14} />Tables</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: theme.textLight }}>{occupancyPct}% occupied</div>
                </div>
                <div style={{ height: 7, background: theme.bgWarm, borderRadius: 99, overflow: 'hidden', marginBottom: 12 }}>
                  <div style={{ height: '100%', width: occupancyPct + '%', background: occupancyPct > 70 ? theme.red : occupancyPct > 40 ? '#D4A853' : '#0D9488', borderRadius: 99 }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'Free',     value: freeTables,     color: '#0D9488', bg: '#E6FAF8' },
                    { label: 'Occupied', value: occupiedTables, color: '#B45309', bg: '#FEF3C7' },
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
          <div style={{ background: '#fff', borderRadius: 14, padding: '20px 22px', border: '1px solid ' + theme.border }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: theme.textDark }}>Sales Data</div>
                <div style={{ fontSize: 12, color: theme.textLight, marginTop: 2 }}>
                  {activeFilter === 'Today' || activeFilter === 'Yesterday' ? 'Hourly breakdown' : 'Daily breakdown'} by order type
                </div>
              </div>

              {/* Chart type dropdown */}
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
                        style={{ padding: '11px 16px', fontSize: 13, fontWeight: chartType === key ? 700 : 500, color: chartType === key ? '#fff' : theme.textDark, background: chartType === key ? '#092b33' : 'transparent', cursor: 'pointer' }}
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
                    <Bar dataKey="Dine In"  fill="#092b33" radius={[4,4,0,0]} />
                    <Bar dataKey="Takeaway" fill="#0D9488" radius={[4,4,0,0]} />
                    <Bar dataKey="Delivery" fill="#D4A853" radius={[4,4,0,0]} />
                  </BarChart>
                ) : chartType === 'line' ? (
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.bgWarm} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: theme.textLight }} />
                    <YAxis tick={{ fontSize: 11, fill: theme.textLight }} tickFormatter={v => '₹' + v} />
                    <Tooltip formatter={(value) => ['₹' + value.toFixed(0)]} contentStyle={{ borderRadius: 10, border: '1px solid ' + theme.border, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="Dine In"  stroke="#092b33" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="Takeaway" stroke="#0D9488" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="Delivery" stroke="#D4A853" strokeWidth={2} dot={{ r: 4 }} />
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
        </>
      )}
    </div>
  )
}