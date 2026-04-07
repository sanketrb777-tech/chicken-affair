import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { theme } from '../../lib/theme'

export default function DiscountsSettingsPage() {
  const [discounts, setDiscounts] = useState([])
  const [gstRate, setGstRate]     = useState('5')
  const [savingGST, setSavingGST] = useState(false)
  const [showForm, setShowForm]   = useState(false)
  const [editItem, setEditItem]   = useState(null)
  const [saving, setSaving]       = useState(false)
  const [form, setForm]           = useState({ name: '', percentage: '' })
  const navigate = useNavigate()

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const { data: disc } = await supabase.from('discount_types').select('*').order('name')
    setDiscounts(disc || [])

    const { data: setting } = await supabase.from('app_settings').select('value').eq('key', 'gst_rate').single()
    if (setting) setGstRate(setting.value)
  }

  async function saveGST() {
    setSavingGST(true)
    await supabase.from('app_settings').upsert({ key: 'gst_rate', value: gstRate, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    setSavingGST(false)
    alert('GST rate updated.')
  }

  function openAdd() {
    setForm({ name: '', percentage: '' })
    setEditItem(null)
    setShowForm(true)
  }

  function openEdit(d) {
    setForm({ name: d.name, percentage: d.percentage })
    setEditItem(d)
    setShowForm(true)
  }

  async function saveDiscount() {
    if (!form.name.trim()) return alert('Name is required')
    if (!form.percentage) return alert('Percentage is required')
    setSaving(true)
    try {
      if (editItem) {
        await supabase.from('discount_types').update({ name: form.name, percentage: parseFloat(form.percentage) }).eq('id', editItem.id)
      } else {
        await supabase.from('discount_types').insert({ name: form.name, percentage: parseFloat(form.percentage), is_active: true })
      }
      setShowForm(false)
      fetchAll()
    } finally { setSaving(false) }
  }

  async function toggleDiscount(d) {
    await supabase.from('discount_types').update({ is_active: !d.is_active }).eq('id', d.id)
    fetchAll()
  }

  async function deleteDiscount(id) {
    if (!window.confirm('Delete this discount type?')) return
    await supabase.from('discount_types').delete().eq('id', id)
    fetchAll()
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
        <button onClick={() => navigate('/settings')}
          style={{ background: '#fff', border: '1px solid ' + theme.border, borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer', color: theme.textMid, fontWeight: 600 }}>
          ← Back
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: theme.textDark, margin: 0 }}>Discounts & GST</h1>
          <p style={{ color: theme.textLight, fontSize: 14, marginTop: 4 }}>Configure GST rate and discount types</p>
        </div>
      </div>

      {/* GST Rate */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid ' + theme.border, padding: '22px 24px', marginBottom: 28, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        <div style={{ fontWeight: 800, fontSize: 15, color: theme.textDark, marginBottom: 4 }}>GST Rate</div>
        <div style={{ fontSize: 13, color: theme.textLight, marginBottom: 16 }}>Applied as inclusive GST on all bills. Change only when government rate changes.</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <input type="number" value={gstRate} onChange={e => setGstRate(e.target.value)}
              style={{ width: 100, border: '1.5px solid ' + theme.border, borderRadius: 9, padding: '10px 28px 10px 12px', fontSize: 16, fontWeight: 800, outline: 'none', textAlign: 'center' }} />
            <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, fontWeight: 700, color: theme.textLight }}>%</span>
          </div>
          <button onClick={saveGST} disabled={savingGST}
            style={{ background: '#092b33', color: '#fff', border: 'none', borderRadius: 9, padding: '10px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {savingGST ? 'Saving...' : 'Update GST Rate'}
          </button>
        </div>
      </div>

      {/* Discount Types */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: theme.textDark }}>Discount Types</div>
          <div style={{ fontSize: 13, color: theme.textLight, marginTop: 2 }}>These appear as options in the billing screen dropdown</div>
        </div>
        <button onClick={openAdd}
          style={{ background: '#092b33', color: '#fff', border: 'none', borderRadius: 9, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          + Add Discount
        </button>
      </div>

      {discounts.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 14, padding: 48, textAlign: 'center', border: '2px dashed ' + theme.border }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🏷️</div>
          <div style={{ fontWeight: 700, color: theme.textDark, marginBottom: 6 }}>No discount types yet</div>
          <div style={{ fontSize: 13, color: theme.textLight }}>Add discounts like Staff Discount, Senior Citizen, Happy Hour etc.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {discounts.map(d => (
            <div key={d.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid ' + theme.border, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', opacity: d.is_active ? 1 : 0.55 }}>
              <div style={{ width: 48, height: 48, background: theme.bgWarm, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 16, color: theme.primary, flexShrink: 0 }}>
                {d.percentage}%
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: theme.textDark }}>{d.name}</div>
                <div style={{ fontSize: 12, color: theme.textLight, marginTop: 2 }}>{d.percentage}% off on total bill</div>
              </div>
              <div onClick={() => toggleDiscount(d)}
                style={{ background: d.is_active ? '#DCFCE7' : theme.bgWarm, color: d.is_active ? '#15803D' : theme.textMuted, border: '1px solid ' + (d.is_active ? '#86EFAC' : theme.border), padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                {d.is_active ? 'Active' : 'Inactive'}
              </div>
              <button onClick={() => openEdit(d)}
                style={{ background: theme.bgWarm, border: '1px solid ' + theme.border, borderRadius: 7, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: theme.textMid }}>
                Edit
              </button>
              <button onClick={() => deleteDiscount(d.id)}
                style={{ background: theme.redBg, border: '1px solid #FECACA', borderRadius: 7, padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: theme.red }}>
                🗑
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 18, padding: 32, width: 380, boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: theme.textDark, margin: '0 0 20px' }}>
              {editItem ? 'Edit Discount' : 'Add Discount Type'}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Discount Name *</label>
                <input autoFocus value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Staff Discount, Senior Citizen, Happy Hour"
                  style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 9, padding: '10px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Percentage (%) *</label>
                <input type="number" value={form.percentage} onChange={e => setForm(f => ({ ...f, percentage: e.target.value }))}
                  placeholder="e.g. 10"
                  style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 9, padding: '10px 12px', fontSize: 14, fontWeight: 700, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={() => setShowForm(false)}
                style={{ flex: 1, background: theme.bgWarm, border: '1px solid ' + theme.border, borderRadius: 9, padding: '12px', fontSize: 13, cursor: 'pointer', fontWeight: 600, color: theme.textMid }}>
                Cancel
              </button>
              <button onClick={saveDiscount} disabled={saving}
                style={{ flex: 2, background: '#092b33', color: '#fff', border: 'none', borderRadius: 9, padding: '12px', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving...' : editItem ? 'Save Changes' : 'Add Discount'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}