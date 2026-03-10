import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { theme } from '../../lib/theme'

const AREAS = ['Main', 'Garden', 'Terrace', 'Indoor', 'Outdoor', 'Rooftop', 'Private']

const AREA_ICONS = {
  Main: '🏠', Garden: '🌿', Terrace: '☀️', Indoor: '🪟',
  Outdoor: '🌳', Rooftop: '🌆', Private: '🔒',
}

export default function TablesSettingsPage() {
  const [tables, setTables]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [editTable, setEditTable] = useState(null)
  const [saving, setSaving]       = useState(false)
  const navigate = useNavigate()

  const [form, setForm] = useState({ number: '', name: '', area: 'Main', capacity: 4 })

  useEffect(() => { fetchTables() }, [])

  async function fetchTables() {
    const { data } = await supabase.from('cafe_tables').select('*').order('number')
    setTables(data || [])
    setLoading(false)
  }

  function openAdd() {
    setForm({ number: '', name: '', area: 'Main', capacity: 4 })
    setEditTable(null)
    setShowForm(true)
  }

  function openEdit(table) {
    setForm({ number: table.number, name: table.name || '', area: table.area || 'Main', capacity: table.capacity || 4 })
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
          area: form.area, capacity: parseInt(form.capacity)
        }).eq('id', editTable.id)
      } else {
        await supabase.from('cafe_tables').insert({
          number: parseInt(form.number), name: form.name || null,
          area: form.area, capacity: parseInt(form.capacity), status: 'free'
        })
      }
      setShowForm(false)
      fetchTables()
    } catch (err) {
      alert('Error saving table. Make sure the table number is unique.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteTable(id) {
    if (!window.confirm('Delete this table? This cannot be undone.')) return
    await supabase.from('cafe_tables').delete().eq('id', id)
    fetchTables()
  }

  const areas = [...new Set(tables.map(t => t.area || 'Main'))]

  if (loading) return <div style={{ padding: 40, color: theme.textLight }}>Loading...</div>

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
        <button onClick={() => navigate('/settings')}
          style={{ background: '#fff', border: '1px solid ' + theme.border, borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer', color: theme.textMid, fontWeight: 600 }}>
          ← Back
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: theme.textDark, margin: 0 }}>Tables & Areas</h1>
          <p style={{ color: theme.textLight, fontSize: 14, marginTop: 4 }}>{tables.length} tables across {areas.length} area{areas.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openAdd}
          style={{ background: '#092b33', color: '#fff', border: 'none', borderRadius: 9, padding: '10px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          + Add Table
        </button>
      </div>

      {tables.length === 0 && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 56, textAlign: 'center', color: theme.textLight, border: '1px solid ' + theme.border }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🪑</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: theme.textDark, marginBottom: 6 }}>No tables yet</div>
          <div style={{ fontSize: 13 }}>Click "+ Add Table" to get started</div>
        </div>
      )}

      {/* Areas */}
      {areas.map(area => {
        const areaTable = tables.filter(t => (t.area || 'Main') === area)
        return (
          <div key={area} style={{ marginBottom: 32 }}>
            {/* Area header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, background: '#092b33', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>
                {AREA_ICONS[area] || '🪑'}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: theme.textDark }}>{area}</div>
                <div style={{ fontSize: 11, color: theme.textLight }}>{areaTable.length} table{areaTable.length !== 1 ? 's' : ''}</div>
              </div>
              <div style={{ flex: 1, height: 1, background: theme.border, marginLeft: 8 }} />
            </div>

            {/* Table cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
              {areaTable.map(table => (
                <div key={table.id} style={{ background: '#fff', borderRadius: 14, border: '2px solid ' + theme.borderWarm, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
                  {/* Card top */}
                  <div style={{ background: theme.bgWarm, padding: '16px 16px 14px', textAlign: 'center', borderBottom: '1px solid ' + theme.border }}>
                    <div style={{ width: 48, height: 48, background: '#092b33', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', fontWeight: 900, fontSize: 16, color: '#fff', letterSpacing: -0.5 }}>
                      T{table.number}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: theme.textDark }}>
                      {table.name || 'Table ' + table.number}
                    </div>
                    <div style={{ fontSize: 11, color: theme.textLight, marginTop: 3 }}>
                      👥 {table.capacity} seats
                    </div>
                  </div>
                  {/* Card actions */}
                  <div style={{ display: 'flex' }}>
                    <button onClick={() => openEdit(table)}
                      style={{ flex: 1, background: 'none', border: 'none', borderRight: '1px solid ' + theme.border, padding: '10px 0', fontSize: 12, fontWeight: 700, color: theme.primary, cursor: 'pointer' }}>
                      ✏️ Edit
                    </button>
                    <button onClick={() => deleteTable(table.id)}
                      style={{ flex: 1, background: 'none', border: 'none', padding: '10px 0', fontSize: 12, fontWeight: 700, color: theme.red, cursor: 'pointer' }}>
                      🗑 Delete
                    </button>
                  </div>
                </div>
              ))}

              {/* Add table shortcut card */}
              <div onClick={openAdd}
                style={{ background: '#fff', borderRadius: 14, border: '2px dashed ' + theme.border, padding: '30px 16px', textAlign: 'center', cursor: 'pointer', color: theme.textMuted, transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = theme.primary; e.currentTarget.style.color = theme.primary }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = theme.border; e.currentTarget.style.color = theme.textMuted }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>+</div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>Add table to {area}</div>
              </div>
            </div>
          </div>
        )
      })}

      {/* Add/Edit Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 18, padding: 32, width: 400, boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: theme.textDark, margin: '0 0 6px' }}>
              {editTable ? 'Edit Table' : 'Add New Table'}
            </h2>
            <p style={{ fontSize: 13, color: theme.textLight, margin: '0 0 24px' }}>
              {editTable ? 'Update table details below' : 'Fill in the details for the new table'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Table No. *</label>
                  <input type="number" value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))}
                    placeholder="1"
                    style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 9, padding: '10px 12px', fontSize: 14, fontWeight: 700, outline: 'none', boxSizing: 'border-box', textAlign: 'center' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Capacity</label>
                  <input type="number" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))}
                    placeholder="4"
                    style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 9, padding: '10px 12px', fontSize: 14, fontWeight: 700, outline: 'none', boxSizing: 'border-box', textAlign: 'center' }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Display Name <span style={{ fontWeight: 400 }}>(optional)</span></label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Window Table, Corner Booth"
                  style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 9, padding: '10px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div>
  <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Area</label>
  <input
    type="text"
    value={form.area}
    onChange={e => setForm(f => ({ ...f, area: e.target.value }))}
    placeholder="e.g. Indoor, Terrace, Garden"
    style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 9, padding: '10px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box', marginBottom: 10 }}
  />
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
    {AREAS.map(a => (
      <button key={a} onClick={() => setForm(f => ({ ...f, area: a }))}
        style={{ background: form.area === a ? '#092b33' : theme.bgWarm, color: form.area === a ? '#fff' : theme.textMid, border: '1.5px solid ' + (form.area === a ? '#092b33' : theme.border), borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
        {AREA_ICONS[a]} {a}
      </button>
    ))}
  </div>
</div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
              <button onClick={() => setShowForm(false)}
                style={{ flex: 1, background: theme.bgWarm, border: '1px solid ' + theme.border, borderRadius: 9, padding: '12px', fontSize: 13, cursor: 'pointer', fontWeight: 600, color: theme.textMid }}>
                Cancel
              </button>
              <button onClick={saveTable} disabled={saving}
                style={{ flex: 2, background: '#092b33', color: '#fff', border: 'none', borderRadius: 9, padding: '12px', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving...' : editTable ? 'Save Changes' : 'Add Table'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}