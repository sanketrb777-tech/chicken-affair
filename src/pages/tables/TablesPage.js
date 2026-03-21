import { useEffect, useState, useCallback } from 'react'
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
  const [tables, setTables]               = useState([])
  const [tableStats, setTableStats]       = useState({})
  const [loading, setLoading]             = useState(true)
  const [now, setNow]                     = useState(new Date())
  const [changeTableModal, setChangeTableModal] = useState(null)
  const [changingTable, setChangingTable] = useState(false)
  const navigate = useNavigate()

  const fetchTables = useCallback(async () => {
    const { data: tablesData } = await supabase
      .from('cafe_tables').select('*').order('number')
    if (!tablesData) return
    setTables(tablesData)

    const occupiedTables = tablesData.filter(t => t.status === 'occupied' || t.status === 'bill_requested')
    if (occupiedTables.length > 0) {
      const stats = {}
      await Promise.all(occupiedTables.map(async (table) => {
        // Get active order
        const { data: order } = await supabase
          .from('orders').select('id, created_at')
          .eq('table_id', table.id).eq('status', 'active').single()
        if (!order) return

        // Running total from ALL order_items for this order
        const { data: orderItems } = await supabase
          .from('order_items').select('quantity, unit_price').eq('order_id', order.id)
        const total = (orderItems || []).reduce((sum, i) => sum + i.quantity * i.unit_price, 0)

        // Last KOT time
        const { data: lastKOT } = await supabase
          .from('kots').select('created_at')
          .eq('order_id', order.id)
          .order('created_at', { ascending: false }).limit(1).single()

        stats[table.id] = {
          total,
          lastKOTTime: lastKOT?.created_at || order.created_at,
          orderId: order.id,
        }
      }))
      setTableStats(stats)
    } else {
      setTableStats({})
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchTables()

    const timer = setInterval(() => setNow(new Date()), 30000)

    // Subscribe to ALL relevant table changes for realtime updates
    const channel = supabase
      .channel('tables-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cafe_tables' },  fetchTables)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' },       fetchTables)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_items' }, fetchTables)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'order_items' }, fetchTables)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'kots' },    fetchTables)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      clearInterval(timer)
    }
  }, [fetchTables])

  function getElapsed(dateString) {
    if (!dateString) return null
    const diff = Math.floor((now - new Date(dateString)) / 60000)
    if (diff < 60) return diff + 'm'
    return Math.floor(diff / 60) + 'h ' + (diff % 60) + 'm'
  }

  function handleTableClick(table) {
    navigate('/orders/new?table=' + table.id + '&tableNumber=' + table.number)
  }

  function openChangeTable(e, table) {
    e.stopPropagation()
    const stats = tableStats[table.id]
    if (!stats?.orderId) return
    setChangeTableModal({ fromTable: table, orderId: stats.orderId })
  }

  async function handleChangeTable(toTable) {
    if (!changeTableModal) return
    setChangingTable(true)
    try {
      const { fromTable, orderId } = changeTableModal
      await supabase.from('orders').update({ table_id: toTable.id }).eq('id', orderId)
      await supabase.from('cafe_tables').update({ status: 'free', captain_id: null }).eq('id', fromTable.id)
      await supabase.from('cafe_tables').update({ status: 'occupied' }).eq('id', toTable.id)
      setChangeTableModal(null)
      fetchTables()
    } catch (err) {
      alert('Failed to change table: ' + err.message)
    } finally {
      setChangingTable(false)
    }
  }

  const freeTables    = tables.filter(t => t.status === 'free')
  const freeCount     = freeTables.length
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
        <div style={{ textAlign: 'center', padding: 48, color: theme.textLight }}>
          No tables found. Add tables in Settings first.
        </div>
      )}

      {/* Table grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14 }}>
        {tables.map(table => {
          const cfg        = STATUS_CONFIG[table.status] || STATUS_CONFIG.free
          const stats      = tableStats[table.id]
          const isFree     = table.status === 'free'
          const isOccupied = table.status === 'occupied' || table.status === 'bill_requested'

          return (
            <div key={table.id} onClick={() => handleTableClick(table)}
              style={{ borderRadius: 14, padding: '16px 14px', textAlign: 'center', cursor: 'pointer', border: '2px solid ' + cfg.border, background: cfg.bg, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', transition: 'transform 0.15s, box-shadow 0.15s', minHeight: 130, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, position: 'relative' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.1)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)' }}
            >
              <div style={{ fontWeight: 900, fontSize: 22, color: theme.textDark, letterSpacing: -0.5 }}>T{table.number}</div>
              {table.area && <div style={{ fontSize: 10, color: theme.textLight, textTransform: 'uppercase', letterSpacing: 0.5 }}>{table.area}</div>}

              {!isFree && stats ? (
                <>
                  <div style={{ fontWeight: 800, fontSize: 16, color: theme.textDark, marginTop: 4 }}>₹{stats.total}</div>
                  <div style={{ fontSize: 11, color: cfg.color, fontWeight: 700 }}>⏱ {getElapsed(stats.lastKOTTime)}</div>
                </>
              ) : isFree ? (
                <div style={{ fontSize: 11, color: cfg.color, fontWeight: 600, marginTop: 4 }}>Tap to order</div>
              ) : (
                <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>Loading...</div>
              )}

              <div style={{ background: '#fff', color: cfg.color, borderRadius: 20, padding: '2px 10px', fontSize: 10, fontWeight: 700, marginTop: 6, border: '1px solid ' + cfg.border }}>
                {cfg.label}
              </div>

              {/* Change table button */}
              {isOccupied && stats && (
                <button onClick={e => openChangeTable(e, table)}
                  style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(255,255,255,0.9)', border: '1px solid ' + cfg.border, borderRadius: 6, padding: '3px 7px', fontSize: 10, fontWeight: 700, cursor: 'pointer', color: cfg.color }}
                  title="Change Table">
                  ⇄
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Change Table Modal */}
      {changeTableModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
          onClick={e => e.target === e.currentTarget && setChangeTableModal(null)}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: theme.textDark, marginBottom: 6 }}>Change Table</div>
            <div style={{ fontSize: 13, color: theme.textLight, marginBottom: 20 }}>
              Moving order from <strong style={{ color: theme.textDark }}>T{changeTableModal.fromTable.number}</strong> — all order data stays unchanged.
            </div>
            {freeTables.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: theme.textLight, fontSize: 13 }}>No free tables available.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 10, marginBottom: 20 }}>
                {freeTables.map(t => (
                  <button key={t.id} onClick={() => handleChangeTable(t)} disabled={changingTable}
                    style={{ background: '#E6FAF8', border: '2px solid #99E6E0', borderRadius: 12, padding: '14px 10px', cursor: 'pointer', textAlign: 'center' }}>
                    <div style={{ fontWeight: 900, fontSize: 18, color: theme.textDark }}>T{t.number}</div>
                    {t.area && <div style={{ fontSize: 10, color: theme.textLight, marginTop: 2 }}>{t.area}</div>}
                    <div style={{ fontSize: 10, color: '#0D9488', fontWeight: 700, marginTop: 4 }}>Free</div>
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setChangeTableModal(null)}
              style={{ width: '100%', background: theme.bgWarm, border: '1px solid ' + theme.border, borderRadius: 10, padding: '11px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: theme.textMid }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}