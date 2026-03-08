import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function KDSPage() {
  const [kots, setKots] = useState([])
  const [time, setTime] = useState(new Date().toLocaleTimeString())

  useEffect(() => {
    fetchKOTs()

    const channel = supabase
      .channel('kds-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kots' }, () => fetchKOTs())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kot_items' }, () => fetchKOTs())
      .subscribe()

    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString())
      fetchKOTs() // refresh elapsed times every minute
    }, 30000)

    const clockTimer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(timer)
      clearInterval(clockTimer)
    }
  }, [])

  async function fetchKOTs() {
    const { data, error } = await supabase
      .from('kots')
      .select(`
        id, status, created_at,
        orders ( id, covers, cafe_tables ( number ) ),
        kot_items (
          id, is_done,
          order_items ( quantity, notes, menu_items ( name ) )
        )
      `)
      .in('status', ['pending', 'in_progress'])
      .order('created_at')

    if (!error) setKots(data || [])
  }

  function getElapsed(createdAt) {
    return Math.floor((new Date() - new Date(createdAt)) / 60000)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0F1E', padding: 24, fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, borderBottom: '1px solid #1E293B', paddingBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 32 }}>☕</span>
          <div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 26 }}>Bambini Cafe — Kitchen</div>
            <div style={{ color: '#475569', fontSize: 15 }}>
              {kots.length === 0 ? 'All clear — no pending orders' : `${kots.length} order${kots.length !== 1 ? 's' : ''} pending`}
            </div>
          </div>
        </div>
        <div style={{ color: '#475569', fontSize: 28, fontWeight: 700, fontFamily: 'monospace' }}>{time}</div>
      </div>

      {/* Empty state */}
      {kots.length === 0 && (
        <div style={{ textAlign: 'center', marginTop: 120 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>✓</div>
          <div style={{ color: '#22C55E', fontSize: 28, fontWeight: 800 }}>All Orders Done</div>
          <div style={{ color: '#334155', fontSize: 16, marginTop: 8 }}>Waiting for new orders...</div>
        </div>
      )}

      {/* KOT Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
        {kots.map(kot => {
          const elapsed     = getElapsed(kot.created_at)
          const borderColor = elapsed > 15 ? '#EF4444' : elapsed > 8 ? '#F59E0B' : '#22C55E'
          const tableNumber = kot.orders?.cafe_tables?.number

          return (
            <div key={kot.id} style={{ background: '#0F172A', borderRadius: 16, overflow: 'hidden', border: '3px solid ' + borderColor }}>

              {/* Table + time */}
              <div style={{ background: borderColor, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#fff', fontWeight: 900, fontSize: 28, letterSpacing: -1 }}>Table {tableNumber}</span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#fff', fontWeight: 800, fontSize: 22 }}>{elapsed} min</div>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
                    {new Date(kot.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>

              {/* Items list */}
              <div style={{ padding: '16px 20px' }}>
                {kot.kot_items.map(kotItem => {
                  const itemName = kotItem.order_items?.menu_items?.name
                  const qty      = kotItem.order_items?.quantity
                  const notes    = kotItem.order_items?.notes
                  return (
                    <div key={kotItem.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #1E293B' }}>
                      <div>
                        <div style={{ color: '#F1F5F9', fontSize: 20, fontWeight: 700 }}>{itemName}</div>
                        {notes && (
                          <div style={{ fontSize: 13, color: '#F59E0B', marginTop: 3 }}>📝 {notes}</div>
                        )}
                      </div>
                      <div style={{ background: '#1E293B', color: '#fff', fontWeight: 900, fontSize: 22, borderRadius: 8, padding: '4px 14px', minWidth: 48, textAlign: 'center' }}>
                        ×{qty}
                      </div>
                    </div>
                  )
                })}
              </div>

            </div>
          )
        })}
      </div>
    </div>
  )
}