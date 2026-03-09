import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { theme } from '../../lib/theme'

const STATUS_CONFIG = {
  free:           { label: 'Free',     bg: '#E6FAF8', color: '#0D9488', border: '#99E6E0' },
  occupied:       { label: 'Occupied', bg: '#FEF3C7', color: '#B45309', border: '#FCD34D' },
  bill_requested: { label: 'Bill',     bg: '#FEE2E2', color: '#B91C1C', border: '#FCA5A5' },
  reserved:       { label: 'Reserved', bg: '#EDE9FE', color: '#6D28D9', border: '#C4B5FD' },
  cleaning:       { label: 'Cleaning', bg: '#F1F5F9', color: '#64748B', border: '#CBD5E1' },
}

export default function TablesPage() {
  const [tables, setTables]         = useState([])
  const [tableStats, setTableStats] = useState({}) // { tableId: { total, elapsed } }
  const [loading, setLoading]       = useState(true)
  const [now, setNow]               = useState(new Date())
  const navigate = useNavigate()

  useEffect(() => {
    fetchTables()

    // Refresh elapsed time every 30 seconds
    const timer = setInterval(() => setNow(new Date()), 30000)

    // Live updates when any table status changes
    const channel = supabase
      .channel('tables-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cafe_tables' }, () => fetchTables())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchTables())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      clearInterval(timer)
    }
  }, [])

  async function fetchTables() {
    const { data: tablesData } = await supabase
      .from('cafe_tables')
      .select('*')
      .order('number')

    if (!tablesData) return
    setTables(tablesData)

    // For occupied tables, fetch running total and last KOT time
    const occupiedTables = tablesData.filter(t => t.status === 'occupied' || t.status === 'bill_requested')

    if (occupiedTables.length > 0) {
      const stats = {}

      for (const table of occupiedTables) {
        // Get active order for this table
        const { data: order } = await supabase
          .from('orders')
          .select('id, created_at')
          .eq('table_id', table.id)
          .eq('status', 'active')
          .single()

        if (!order) continue

        // Get running total
        const { data: orderItems } = await supabase
          .from('order_items')
          .select('quantity, unit_price')
          .eq('order_id', order.id)

        const total = (orderItems || []).reduce((sum, i) => sum + i.quantity * i.unit_price, 0)

        // Get last KOT time
        const { data: lastKOT } = await supabase
          .from('kots')
          .select('created_at')
          .eq('order_id', order.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        stats[table.id] = {
          total,
          lastKOTTime: lastKOT?.created_at || order.created_at,
        }
      }

      setTableStats(stats)
    }

    setLoading(false)
  }

  function getElapsed(dateString) {
    if (!dateString) return null
    const diff = Math.floor((now - new Date(dateString)) / 60000)
    if (diff < 60) return diff + 'm'
    return Math.floor(diff / 60) + 'h ' + (diff % 60) + 'm'
  }

  function handleTableClick(table) {
    if (table.status === 'free') {
      navigate('/orders/new?table=' + table.id + '&tableNumber=' + table.number)
    } else {
      navigate('/orders/new?table=' + table.id + '&tableNumber=' + table.number)
    }
  }

  const freeCount     = tables.filter(t => t.status === 'free').length
  const occupiedCount = tables.filter(t => t.status === 'occupied' || t.status === 'bill_requested').length

  if (loading) return <div style={{ padding: 40, color: theme.textLight }}>Loading tables...</div>

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: theme.textDark, margin: 0 }}>Tables</h1>
          <p style={{ color: theme.textLight, fontSize: 14, marginTop: 4 }}>
            <span style={{ color: '#0D9488', fontWeight: 700 }}>{freeCount} free</span>
            {' · '}
            <span style={{ color: '#B45309', fontWeight: 700 }}>{occupiedCount} occupied</span>
            {' · '}
            {tables.length} total
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <span key={key} style={{ background: cfg.bg, color: cfg.color, border: '1px solid ' + cfg.border, padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
              {cfg.label}
            </span>
          ))}
        </div>
      </div>

      {tables.length === 0 && (
        <div style={{ ...theme.card, textAlign: 'center', padding: 48, color: theme.textLight }}>
          No tables found. Add tables in Settings first.
        </div>
      )}

      {/* Table grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14 }}>
        {tables.map(table => {
          const cfg   = STATUS_CONFIG[table.status] || STATUS_CONFIG.free
          const stats = tableStats[table.id]
          const isFree = table.status === 'free'

          return (
            <div key={table.id} onClick={() => handleTableClick(table)}
              style={{
                borderRadius: 14,
                padding: '16px 14px',
                textAlign: 'center',
                cursor: 'pointer',
                border: '2px solid ' + cfg.border,
                background: cfg.bg,
                boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                transition: 'transform 0.15s, box-shadow 0.15s',
                minHeight: 130,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.1)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)' }}
            >
              {/* Table number */}
              <div style={{ fontWeight: 900, fontSize: 22, color: theme.textDark, letterSpacing: -0.5 }}>
                T{table.number}
              </div>

              {/* Area */}
              {table.area && (
                <div style={{ fontSize: 10, color: theme.textLight, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {table.area}
                </div>
              )}

              {/* Stats for occupied tables */}
              {!isFree && stats ? (
                <>
                  <div style={{ fontWeight: 800, fontSize: 16, color: theme.textDark, marginTop: 4 }}>
                    ₹{stats.total}
                  </div>
                  <div style={{ fontSize: 11, color: cfg.color, fontWeight: 700 }}>
                    ⏱ {getElapsed(stats.lastKOTTime)}
                  </div>
                </>
              ) : isFree ? (
                <div style={{ fontSize: 11, color: cfg.color, fontWeight: 600, marginTop: 4 }}>
                  Tap to order
                </div>
              ) : (
                <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>Loading...</div>
              )}

              {/* Status badge */}
              <div style={{ background: '#fff', color: cfg.color, borderRadius: 20, padding: '2px 10px', fontSize: 10, fontWeight: 700, marginTop: 6, border: '1px solid ' + cfg.border }}>
                {cfg.label}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}