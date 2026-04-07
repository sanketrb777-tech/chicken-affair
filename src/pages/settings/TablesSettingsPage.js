import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { theme } from '../../lib/theme'

const APP_URL = 'https://chicken-affair.vercel.app'

export default function TablesSettingsPage() {
  const [tables, setTables]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editTable, setEditTable] = useState(null)
  const [saving, setSaving]       = useState(false)
  const [qrModal, setQrModal]     = useState(null)
  const [downloading, setDownloading] = useState(false)
  const navigate = useNavigate()

  const [form, setForm] = useState({ number: '', name: '', area: '', capacity: 4 })

  useEffect(() => { fetchTables() }, [])

  async function fetchTables() {
    const { data } = await supabase.from('cafe_tables').select('*').order('number')
    setTables(data || [])
    setLoading(false)
  }

  function openAdd() {
    setForm({ number: '', name: '', area: '', capacity: 4 })
    setEditTable(null)
    setShowForm(true)
  }

  function openEdit(table) {
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
      alert('Error saving table: ' + err.message)
    } finally {
      setSaving(false) }
  }

  async function deleteTable(id) {
    if (!window.confirm('Delete this table?')) return
    await supabase.from('cafe_tables').delete().eq('id', id)
    fetchTables()
  }

  async function downloadQR(tableId, tableName) {
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${APP_URL}/menu/table/${tableId}`
    const res  = await fetch(url)
    const blob = await res.blob()
    const a    = document.createElement('a')
    a.href     = URL.createObjectURL(blob)
    a.download = `QR-${tableName}.png`
    a.click()
  }

  async function handleDownloadQR(table) {
    setDownloading(true)
    await downloadQR(table.id, table.name || `Table-${table.number}`)
    setDownloading(false)
  }

  const areas = [...new Set(tables.map(t => t.area || 'General'))]

  if (loading) return <div style={{ padding: 40, color: theme.textLight }}>Loading...</div>

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
        <button onClick={() => navigate('/settings')}
          style={{ background: '#fff', border: '1px solid ' + theme.border, borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer', color: theme.textMid, fontWeight: 600 }}>
          ? Back
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: theme.textDark, margin: 0 }}>Tables & Areas</h1>
          <p style={{ color: theme.textLight, fontSize: 14, marginTop: 4 }}>{tables.length} tables across {areas.length} area{areas.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openAdd}
          style={{ background: '#6b1f1f', color: '#fff', border: 'none', borderRadius: 9, padding: '10px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          + Add Table
        </button>
      </div>

      {tables.length === 0 && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 48, textAlign: 'center', border: '2px dashed ' + theme.border, color: theme.textLight }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>??</div>
          <div style={{ fontWeight: 700, color: theme.textDark, marginBottom: 6 }}>No tables yet</div>
          <div style={{ fontSize: 13 }}>Click "+ Add Table" to get started</div>
        </div>
      )}

      {/* Areas */}
      {areas.map(area => {
        const areaTables = tables.filter(t => (t.area || 'General') === area)
        return (
          <div key={area} style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, background: '#6b1f1f', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>
                ??
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: theme.textDark }}>{area}</div>
                <div style={{ fontSize: 11, color: theme.textLight }}>{areaTables.length} table{areaTables.length !== 1 ? 's' : ''}</div>
              </div>
              <div style={{ flex: 1, height: 1, background: theme.border, marginLeft: 8 }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
              {areaTables.map(table => {
                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${APP_URL}/menu/table/${table.id}`
                return (
                  <div key={table.id} style={{ background: '#fff', borderRadius: 14, border: '1.5px solid ' + theme.border, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                    <div style={{ background: theme.bgWarm, padding: '14px 14px 12px', textAlign: 'center', borderBottom: '1px solid ' + theme.border }}>
                      <div style={{ width: 44, height: 44, background: '#6b1f1f', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', fontWeight: 900, fontSize: 15, color: '#fff' }}>
                        T{table.number}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: theme.textDark }}>{table.name || `Table ${table.number}`}</div>
                      <div style={{ fontSize: 11, color: theme.textLight, marginTop: 2 }}>?? {table.capacity} seats</div>
                      <img src={qrUrl} alt="QR" style={{ width: 64, height: 64, marginTop: 10, borderRadius: 6 }} />
                      <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 4, cursor: 'pointer', textDecoration: 'underline' }}
                        onClick={() => setQrModal(table)}>
                        Tap to view QR
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 0 }}>
                      <button onClick={() => openEdit(table)}
                        style={{ flex: 1, background: 'none', border: 'none', borderRight: '1px solid ' + theme.border, padding: '10px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: theme.textMid }}>
                        ?? Edit
                      </button>
                      <button onClick={() => setQrModal(table)}
                        style={{ flex: 1, background: 'none', border: 'none', borderRight: '1px solid ' + theme.border, padding: '10px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#a93226' }}>
                        ?? QR
                      </button>
                      <button onClick={() => deleteTable(table.id)}
                        style={{ flex: 1, background: 'none', border: 'none', padding: '10px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: theme.red }}>
                        ?? Del
                      </button>
                    </div>
                  </div>
                )
              })}

              {/* Add table to area shortcut */}
              <div onClick={openAdd}
                style={{ background: '#fff', borderRadius: 14, border: '2px dashed ' + theme.border, padding: '30px 14px', textAlign: 'center', cursor: 'pointer', color: theme.textMuted, transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#6b1f1f'; e.currentTarget.style.color = '#6b1f1f' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = theme.border; e.currentTarget.style.color = theme.textMuted }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>+</div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>Add table to {area}</div>
              </div>
            </div>
          </div>
        )
      })}

      {/* Add / Edit Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 18, padding: 32, width: 400, boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: theme.textDark, margin: '0 0 6px' }}>
              {editTable ? 'Edit Table' : 'Add Table'}
            </h2>
            <p style={{ color: theme.textLight, fontSize: 13, margin: '0 0 20px' }}>
              {editTable ? 'Update table details below' : 'Fill in the details for the new table'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Table No. *</label>
                  <input type="number" value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))}
                    placeholder="1"
                    style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 9, padding: '10px 12px', fontSize: 14, fontWeight: 700, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Capacity</label>
                  <input type="number" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))}
                    placeholder="4"
                    style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 9, padding: '10px 12px', fontSize: 14, fontWeight: 700, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Display Name <span style={{ fontWeight: 400 }}>(optional)</span></label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Window Table, Corner Booth"
                  style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 9, padding: '10px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Area <span style={{ fontWeight: 400 }}>(optional)</span></label>
                <input type="text" value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))}
                  placeholder="e.g. Indoor, Rooftop, Garden, Terrace"
                  style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 9, padding: '10px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                <div style={{ fontSize: 11, color: theme.textLight, marginTop: 5 }}>Type any area name you like</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={() => setShowForm(false)}
                style={{ flex: 1, background: theme.bgWarm, border: '1px solid ' + theme.border, borderRadius: 9, padding: '12px', fontSize: 13, cursor: 'pointer', fontWeight: 600, color: theme.textMid }}>
                Cancel
              </button>
              <button onClick={saveTable} disabled={saving}
                style={{ flex: 2, background: '#6b1f1f', color: '#fff', border: 'none', borderRadius: 9, padding: '12px', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving...' : editTable ? 'Save Changes' : 'Add Table'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {qrModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={e => e.target === e.currentTarget && setQrModal(null)}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 32, textAlign: 'center', width: 320, boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: theme.textDark, marginBottom: 4 }}>
              {qrModal.name || `Table ${qrModal.number}`}
            </div>
            <div style={{ fontSize: 12, color: theme.textLight, marginBottom: 20 }}>Scan to order from this table</div>
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${APP_URL}/menu/table/${qrModal.id}`}
              alt="QR Code" style={{ width: 220, height: 220, borderRadius: 12, border: '1px solid ' + theme.border }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setQrModal(null)}
                style={{ flex: 1, background: theme.bgWarm, border: '1px solid ' + theme.border, borderRadius: 9, padding: '11px', fontSize: 13, cursor: 'pointer', fontWeight: 600, color: theme.textMid }}>
                Close
              </button>
              <button onClick={() => handleDownloadQR(qrModal)} disabled={downloading}
                style={{ flex: 2, background: '#6b1f1f', color: '#fff', border: 'none', borderRadius: 9, padding: '11px', fontSize: 13, fontWeight: 700, cursor: downloading ? 'not-allowed' : 'pointer' }}>
                {downloading ? 'Downloading...' : '? Download QR'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
