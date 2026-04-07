import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { theme } from '../../lib/theme'

const APP_URL = 'https://Chicken Affairapp-hue.vercel.app'

// Card color by status — matching Petpooja style
const STATUS_CFG = {
  free:           { bg: '#fff5f5', border: '#fecaca', borderStyle: '2px dashed', color: '#374151' },
  occupied:       { bg: '#fff5f5', border: '#f87171', borderStyle: '2px solid',  color: '#991b1b' },
  bill_requested: { bg: '#FEF2F2', border: '#FCA5A5', borderStyle: '2px solid',  color: '#991B1B' },
  reserved:       { bg: '#fff5f5', border: '#fca5a5', borderStyle: '2px solid',  color: '#991b1b' },
  cleaning:       { bg: '#F8FAFC', border: '#CBD5E1', borderStyle: '2px dashed', color: '#64748B' },
}

export default function TablesPage() {
  const { profile } = useAuth()
  const isManager = profile?.role === 'owner' || profile?.role === 'manager'

  const [tables, setTables]               = useState([])
  const [tableStats, setTableStats]       = useState({})
  const [loading, setLoading]             = useState(true)
  const [now, setNow]                     = useState(new Date())
  const [changeTableModal, setChangeTableModal] = useState(null)
  const [changingTable, setChangingTable] = useState(false)
  const navigate = useNavigate()

  const [showForm, setShowForm]   = useState(false)
  const [editTable, setEditTable] = useState(null)
  const [saving, setSaving]       = useState(false)
  const [form, setForm]           = useState({ number: '', name: '', area: '', capacity: 4 })

  const [qrModal, setQrModal]         = useState(null)
  const [downloading, setDownloading] = useState(false)

  const fetchTables = useCallback(async () => {
    const { data: tablesData } = await supabase.from('cafe_tables').select('*').order('number')
    if (!tablesData) return
    setTables(tablesData)

    const occupiedTables = tablesData.filter(t => t.status === 'occupied' || t.status === 'bill_requested')
    if (occupiedTables.length > 0) {
      const stats = {}
      await Promise.all(occupiedTables.map(async (table) => {
        const { data: order } = await supabase
          .from('orders').select('id, created_at')
          .eq('table_id', table.id).eq('status', 'active').single()
        if (!order) return
        const { data: orderItems } = await supabase
          .from('order_items').select('quantity, unit_price').eq('order_id', order.id)
        const total = (orderItems || []).reduce((sum, i) => sum + i.quantity * i.unit_price, 0)
        const { data: lastKOT } = await supabase
          .from('kots').select('created_at')
          .eq('order_id', order.id).order('created_at', { ascending: false }).limit(1).single()
        stats[table.id] = {
          total,
          firstOrderTime: order.created_at,
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
    const channel = supabase
      .channel('tables-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cafe_tables' },      fetchTables)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' },           fetchTables)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_items' }, fetchTables)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'order_items' }, fetchTables)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'kots' },        fetchTables)
      .subscribe()
    return () => { supabase.removeChannel(channel); clearInterval(timer) }
  }, [fetchTables])

  function getElapsedMins(dateString) {
    if (!dateString) return 0
    return Math.floor((now - new Date(dateString)) / 60000)
  }

  function formatElapsed(mins) {
    if (mins < 60) return `${mins} Min`
    return `${Math.floor(mins / 60)}h ${mins % 60}m`
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

  function openAdd() {
    setForm({ number: '', name: '', area: '', capacity: 4 })
    setEditTable(null)
    setShowForm(true)
  }

  function openEdit(e, table) {
    e.stopPropagation()
    setForm({ number: table.number, name: table.name || '', area: table.area || '', capacity: table.capacity || 4 })
    setEditTable(table)
    setShowForm(true)
  }

  async function saveTable() {
    if (!form.number) return alert('Table number is required')
    setSaving(true)
    try {
      if (editTable) {
        await supabase.from('cafe_tables').update({
          number: parseInt(form.number), name: form.name || null,
          area: form.area || null, capacity: parseInt(form.capacity)
        }).eq('id', editTable.id)
      } else {
        await supabase.from('cafe_tables').insert({
          number: parseInt(form.number), name: form.name || null,
          area: form.area || null, capacity: parseInt(form.capacity), status: 'free'
        })
      }
      setShowForm(false)
      fetchTables()
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setSaving(false) }
  }

  async function deleteTable(id) {
    if (!window.confirm('Delete this table?')) return
    await supabase.from('cafe_tables').delete().eq('id', id)
    setShowForm(false)
    fetchTables()
  }

  async function downloadQR(table) {
    setDownloading(true)
    const url  = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${APP_URL}/menu/table/${table.id}`
    const res  = await fetch(url)
    const blob = await res.blob()
    const a    = document.createElement('a')
    a.href     = URL.createObjectURL(blob)
    a.download = `QR-${table.name || 'Table-' + table.number}.png`
    a.click()
    setDownloading(false)
  }

  // ── Group tables by area ──
  const areaMap = {}
  tables.forEach(t => {
    const area = t.area?.trim() || 'General'
    if (!areaMap[area]) areaMap[area] = []
    areaMap[area].push(t)
  })
  const areas = Object.keys(areaMap).sort()

  const freeTables    = tables.filter(t => t.status === 'free')
  const freeCount     = freeTables.length
  const occupiedCount = tables.filter(t => t.status === 'occupied' || t.status === 'bill_requested').length

  if (loading) return <div style={{ padding: 40, color: theme.textLight }}>Loading tables...</div>

  // ── SINGLE TABLE CARD ──
  function TableCard({ table }) {
    const cfg      = STATUS_CFG[table.status] || STATUS_CFG.free
    const stats    = tableStats[table.id]
    const isFree   = table.status === 'free'
    const isOcc    = table.status === 'occupied' || table.status === 'bill_requested'
    const elapsedMins = stats ? getElapsedMins(stats.firstOrderTime) : 0
    const displayName = table.name || `${table.number}`

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        <div
          onClick={() => handleTableClick(table)}
          style={{
            width: 130, height: 130,
            borderRadius: 12,
            border: cfg.borderStyle + ' ' + cfg.border,
            background: cfg.bg,
            cursor: 'pointer',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 8px 8px',
            position: 'relative',
            boxShadow: isOcc ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
            transition: 'transform 0.1s, box-shadow 0.1s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.03)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.12)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = isOcc ? '0 2px 8px rgba(0,0,0,0.1)' : 'none' }}>

          {/* Top: elapsed time or status */}
          <div style={{ width: '100%', textAlign: 'center' }}>
            {isOcc && stats ? (
              <div style={{ fontSize: 11, fontWeight: 800, color: cfg.color }}>{formatElapsed(elapsedMins)}</div>
            ) : (
              <div style={{ fontSize: 10, fontWeight: 600, color: cfg.color, opacity: 0.7 }}>
                {isFree ? 'Free' : table.status?.replace('_',' ')}
              </div>
            )}
          </div>

          {/* Center: table number */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: cfg.color, lineHeight: 1 }}>{displayName}</div>
            {isOcc && stats && (
              <div style={{ fontSize: 13, fontWeight: 800, color: cfg.color, marginTop: 4 }}>
                ₹{stats.total.toFixed(2)}
              </div>
            )}
          </div>

          {/* Bottom: action icon buttons */}
          <div style={{ display: 'flex', gap: 6, width: '100%', justifyContent: 'center' }}>
            {isOcc && stats ? (
              <>
                {/* Print / Bill */}
                <button
                  onClick={e => { e.stopPropagation(); navigate('/billing/order/' + stats.orderId) }}
                  style={{ background: 'rgba(255,255,255,0.85)', border: '1.5px solid ' + cfg.border, borderRadius: 8, width: 34, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  title="Generate Bill">
                  {/* Receipt icon */}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={cfg.color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16l3-2 2 2 3-2 3 2 3-2V8z"/>
                    <line x1="8" y1="10" x2="16" y2="10"/>
                    <line x1="8" y1="14" x2="14" y2="14"/>
                  </svg>
                </button>
                {/* View / Eye */}
                <button
                  onClick={e => { e.stopPropagation(); navigate('/orders/new?table=' + table.id + '&tableNumber=' + table.number) }}
                  style={{ background: 'rgba(255,255,255,0.85)', border: '1.5px solid ' + cfg.border, borderRadius: 8, width: 34, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  title="View Order">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={cfg.color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                </button>
                {/* Change table */}
                <button
                  onClick={e => openChangeTable(e, table)}
                  style={{ background: 'rgba(255,255,255,0.85)', border: '1.5px solid ' + cfg.border, borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: cfg.color }}
                  title="Change Table">⇄</button>
              </>
            ) : isFree && isManager ? (
              <>
                {/* QR */}
                <button
                  onClick={e => { e.stopPropagation(); setQrModal(table) }}
                  style={{ background: 'rgba(255,255,255,0.85)', border: '1.5px solid ' + cfg.border, borderRadius: 8, width: 34, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 13 }}
                  title="QR Code">🔲</button>
                {/* Edit */}
                <button
                  onClick={e => openEdit(e, table)}
                  style={{ background: 'rgba(255,255,255,0.85)', border: '1.5px solid ' + cfg.border, borderRadius: 8, width: 34, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 13 }}
                  title="Edit Table">✏️</button>
              </>
            ) : isFree ? (
              <button
                onClick={e => { e.stopPropagation(); setQrModal(table) }}
                style={{ background: 'rgba(255,255,255,0.85)', border: '1.5px solid ' + cfg.border, borderRadius: 8, width: 34, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 13 }}
                title="QR Code">🔲</button>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: theme.textDark, margin: 0 }}>Tables</h1>
          <p style={{ color: theme.textLight, fontSize: 14, marginTop: 4 }}>
            <span style={{ color: '#dc2626', fontWeight: 700 }}>{freeCount} free</span>
            {' · '}
            <span style={{ color: '#b91c1c', fontWeight: 700 }}>{occupiedCount} occupied</span>
            {' · '}
            {tables.length} total
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {[
              { label: 'Free',     bg: '#fff5f5', border: '#fecaca', color: '#374151' },
              { label: 'Occupied', bg: '#fff5f5', border: '#f87171', color: '#991b1b' },
              { label: 'Bill',     bg: '#FEF2F2', border: '#FCA5A5', color: '#991B1B' },
            ].map(s => (
              <span key={s.label} style={{ background: s.bg, color: s.color, border: '1.5px solid ' + s.border, padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                {s.label}
              </span>
            ))}
          </div>
          {isManager && (
            <button onClick={openAdd}
              style={{ background: '#7f1d1d', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
              + Add Table
            </button>
          )}
        </div>
      </div>

      {tables.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, color: theme.textLight, background: '#fff', borderRadius: 14, border: '2px dashed ' + theme.border }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🪑</div>
          <div style={{ fontWeight: 700, color: theme.textDark, marginBottom: 6 }}>No tables yet</div>
          {isManager && <button onClick={openAdd} style={{ background: '#7f1d1d', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 8 }}>+ Add your first table</button>}
        </div>
      )}

      {/* ── AREAS ── */}
      {areas.map(area => (
        <div key={area} style={{ marginBottom: 28 }}>
          {/* Area section header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: theme.textDark, textTransform: 'uppercase', letterSpacing: 1 }}>{area}</div>
            <div style={{ flex: 1, height: 1, background: theme.border }} />
            <div style={{ fontSize: 11, color: theme.textLight, fontWeight: 600 }}>
              {areaMap[area].filter(t => t.status === 'free').length} free / {areaMap[area].length} tables
            </div>
          </div>

          {/* Table cards grid */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {areaMap[area].map(table => (
              <TableCard key={table.id} table={table} />
            ))}
          </div>
        </div>
      ))}

      {/* ── ADD / EDIT MODAL ── */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 18, padding: 32, width: 400, boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: theme.textDark, margin: '0 0 20px' }}>
              {editTable ? 'Edit Table' : 'Add Table'}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Table No. *</label>
                  <input type="number" value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))} placeholder="1"
                    style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 9, padding: '10px 12px', fontSize: 14, fontWeight: 700, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Capacity</label>
                  <input type="number" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} placeholder="4"
                    style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 9, padding: '10px 12px', fontSize: 14, fontWeight: 700, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Display Name <span style={{ fontWeight: 400 }}>(optional)</span></label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Window Table, Corner Booth"
                  style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 9, padding: '10px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Area <span style={{ fontWeight: 400 }}>(optional)</span></label>
                <input type="text" value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))} placeholder="e.g. Indoor, Outdoor, Rooftop, Garden"
                  style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 9, padding: '10px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                <div style={{ fontSize: 11, color: theme.textLight, marginTop: 5 }}>Tables with the same area name are grouped together</div>
              </div>
            </div>

            {editTable && (
              <button onClick={() => deleteTable(editTable.id)}
                style={{ width: '100%', marginTop: 16, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 9, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#DC2626' }}>
                🗑 Delete this table
              </button>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button onClick={() => setShowForm(false)}
                style={{ flex: 1, background: theme.bgWarm, border: '1px solid ' + theme.border, borderRadius: 9, padding: '12px', fontSize: 13, cursor: 'pointer', fontWeight: 600, color: theme.textMid }}>
                Cancel
              </button>
              <button onClick={saveTable} disabled={saving}
                style={{ flex: 2, background: '#7f1d1d', color: '#fff', border: 'none', borderRadius: 9, padding: '12px', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving...' : editTable ? 'Save Changes' : 'Add Table'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CHANGE TABLE MODAL ── */}
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
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
                {freeTables.map(t => (
                  <button key={t.id} onClick={() => handleChangeTable(t)} disabled={changingTable}
                    style={{ background: '#fff5f5', border: '2px solid #fecaca', borderRadius: 12, padding: '14px 10px', cursor: 'pointer', textAlign: 'center', minWidth: 80 }}>
                    <div style={{ fontWeight: 900, fontSize: 18, color: theme.textDark }}>{t.number}</div>
                    {t.area && <div style={{ fontSize: 10, color: theme.textLight, marginTop: 2 }}>{t.area}</div>}
                    <div style={{ fontSize: 10, color: '#dc2626', fontWeight: 700, marginTop: 4 }}>Free</div>
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

      {/* ── QR MODAL ── */}
      {qrModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={e => e.target === e.currentTarget && setQrModal(null)}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 32, textAlign: 'center', width: 320, boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: theme.textDark, marginBottom: 4 }}>{qrModal.name || `Table ${qrModal.number}`}</div>
            <div style={{ fontSize: 12, color: theme.textLight, marginBottom: 20 }}>Scan to order from this table</div>
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${APP_URL}/menu/table/${qrModal.id}`}
              alt="QR Code" style={{ width: 220, height: 220, borderRadius: 12, border: '1px solid ' + theme.border }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setQrModal(null)}
                style={{ flex: 1, background: theme.bgWarm, border: '1px solid ' + theme.border, borderRadius: 9, padding: '11px', fontSize: 13, cursor: 'pointer', fontWeight: 600, color: theme.textMid }}>
                Close
              </button>
              <button onClick={() => downloadQR(qrModal)} disabled={downloading}
                style={{ flex: 2, background: '#7f1d1d', color: '#fff', border: 'none', borderRadius: 9, padding: '11px', fontSize: 13, fontWeight: 700, cursor: downloading ? 'not-allowed' : 'pointer' }}>
                {downloading ? 'Downloading...' : '⬇ Download QR'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}