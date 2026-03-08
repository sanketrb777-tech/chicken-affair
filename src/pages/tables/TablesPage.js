import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

const STATUS_CONFIG = {
  free:           { label: 'Free',     bg: '#DCFCE7', color: '#15803D', border: '#86EFAC' },
  occupied:       { label: 'Occupied', bg: '#FEF3C7', color: '#B45309', border: '#FCD34D' },
  bill_requested: { label: 'Bill',     bg: '#FEE2E2', color: '#B91C1C', border: '#FCA5A5' },
  reserved:       { label: 'Reserved', bg: '#DBEAFE', color: '#1D4ED8', border: '#93C5FD' },
  cleaning:       { label: 'Cleaning', bg: '#F3F4F6', color: '#6B7280', border: '#D1D5DB' },
}

export default function TablesPage() {
  const [tables, setTables]   = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    fetchTables()
    const channel = supabase
      .channel('tables-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cafe_tables' }, () => fetchTables())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function fetchTables() {
    const { data, error } = await supabase.from('cafe_tables').select('*').order('number')
    if (!error) setTables(data)
    setLoading(false)
  }

  function handleTableClick(table) {
    if (table.status === 'free') {
      navigate('/orders/new?table=' + table.id + '&tableNumber=' + table.number)
    } else {
      navigate('/orders/table/' + table.id)
    }
  }

  const freeCount     = tables.filter(t => t.status === 'free').length
  const occupiedCount = tables.filter(t => t.status === 'occupied' || t.status === 'bill_requested').length

  if (loading) return <div style={{ padding: 40, color: '#94A3B8' }}>Loading tables...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1E293B', margin: 0 }}>Tables</h1>
          <p style={{ color: '#64748B', fontSize: 14, marginTop: 4 }}>
            {freeCount} free · {occupiedCount} occupied
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <span key={key} style={{ background: cfg.bg, color: cfg.color, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
              {cfg.label}
            </span>
          ))}
        </div>
      </div>

      {tables.length === 0 && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', color: '#94A3B8' }}>
          No tables found. Add tables in Settings → Tables first.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 }}>
        {tables.map(table => {
          const cfg = STATUS_CONFIG[table.status] || STATUS_CONFIG.free
          return (
            <div
              key={table.id}
              onClick={() => handleTableClick(table)}
              style={{
                background: '#fff',
                borderRadius: 12,
                padding: '20px 12px',
                textAlign: 'center',
                boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                cursor: 'pointer',
                border: '2px solid ' + cfg.border,
                transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 6 }}>🪑</div>
              <div style={{ fontWeight: 800, fontSize: 20, color: '#1E293B' }}>T{table.number}</div>
              {table.name && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{table.name}</div>}
              <div style={{ background: cfg.bg, color: cfg.color, borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 700, marginTop: 8, display: 'inline-block' }}>
                {cfg.label}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}