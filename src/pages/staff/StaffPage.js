import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { theme } from '../../lib/theme'

const ROLES = ['owner', 'manager', 'captain', 'biller']

const ROLE_CONFIG = {
  owner:   { label: 'Owner',   bg: '#fdedec', color: '#a93226', border: '#f1948a' },
  manager: { label: 'Manager', bg: '#fdedec', color: '#a93226', border: '#f1948a' },
  captain: { label: 'Captain', bg: '#DCFCE7', color: '#15803D', border: '#86EFAC' },
  biller:  { label: 'Biller',  bg: '#fdedec', color: '#a93226', border: '#f1948a' },
}

export default function StaffPage() {
  const [staff, setStaff]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editStaff, setEditStaff] = useState(null)
  const [saving, setSaving]     = useState(false)
  const [inviting, setInviting] = useState(false)
  const { profile }             = useAuth()

  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'captain', password: '' })

  useEffect(() => { fetchStaff() }, [])

  async function fetchStaff() {
    const { data } = await supabase
      .from('staff')
      .select('*')
      .order('name')
    setStaff(data || [])
    setLoading(false)
  }

  function openAdd() {
    setForm({ name: '', email: '', phone: '', role: 'captain', password: '' })
    setEditStaff(null)
    setShowForm(true)
  }

  function openEdit(s) {
    setForm({ name: s.name, email: s.email || '', phone: s.phone || '', role: s.role })
    setEditStaff(s)
    setShowForm(true)
  }

  async function saveStaff() {
    if (!form.name.trim()) return alert('Name is required')
    setSaving(true)
    try {
      if (editStaff) {
        await supabase.from('staff').update({
          name:  form.name,
          phone: form.phone || null,
          role:  form.role,
        }).eq('id', editStaff.id)
        setShowForm(false)
        fetchStaff()
      } else {
        if (!form.email.trim()) return alert('Email is required')
        if (!form.password || form.password.length < 6) return alert('Password must be at least 6 characters')

        // Create auth user
        const { data, error } = await supabase.auth.signUp({
          email:    form.email,
          password: form.password,
        })
        if (error) throw error

        // Insert staff row
        await supabase.from('staff').insert({
          user_id:   data.user.id,
          name:      form.name,
          email:     form.email,
          phone:     form.phone || null,
          role:      form.role,
          is_active: true,
        })

        setShowForm(false)
        fetchStaff()
        alert(`Staff account created for ${form.name}. Share their email and password with them directly.`)
      }
    } catch (err) {
      console.error(err)
      alert('Error: ' + (err.message || 'Something went wrong.'))
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(s) {
    if (s.user_id === profile?.user_id) return alert('You cannot deactivate yourself.')
    await supabase.from('staff').update({ is_active: !s.is_active }).eq('id', s.id)
    fetchStaff()
  }

  async function deleteStaff(s) {
    if (s.user_id === profile?.user_id) return alert('You cannot delete yourself.')
    if (!window.confirm(`Delete ${s.name}? This cannot be undone.`)) return
    await supabase.from('staff').delete().eq('id', s.id)
    fetchStaff()
  }

  const activeStaff   = staff.filter(s => s.is_active)
  const inactiveStaff = staff.filter(s => !s.is_active)

  if (loading) return <div style={{ padding: 40, color: theme.textLight }}>Loading staff...</div>

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: theme.textDark, margin: 0 }}>Staff</h1>
          <p style={{ color: theme.textLight, fontSize: 14, marginTop: 4 }}>
            {activeStaff.length} active · {inactiveStaff.length} inactive
          </p>
        </div>
        <button onClick={openAdd}
          style={{ background: '#6b1f1f', color: '#fff', border: 'none', borderRadius: 9, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          + Invite Staff
        </button>
      </div>

      {/* Active staff */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
        {activeStaff.map(s => {
          const rc = ROLE_CONFIG[s.role] || ROLE_CONFIG.captain
          return (
            <div key={s.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid ' + theme.border, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              {/* Avatar */}
              <div style={{ width: 44, height: 44, background: '#6b1f1f', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, color: '#fff', flexShrink: 0 }}>
                {s.name.charAt(0).toUpperCase()}
              </div>

              {/* Details */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: theme.textDark }}>{s.name}</div>
                  {s.user_id === profile?.user_id && (
                    <span style={{ fontSize: 10, background: theme.bgWarm, color: theme.textLight, padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>You</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: theme.textLight, marginTop: 2 }}>
                  {s.email || '—'}
                  {s.phone && <span style={{ marginLeft: 10 }}>· {s.phone}</span>}
                </div>
              </div>

              {/* Role badge */}
              <span style={{ background: rc.bg, color: rc.color, border: '1px solid ' + rc.border, padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                {rc.label}
              </span>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button onClick={() => openEdit(s)}
                  style={{ background: theme.bgWarm, border: '1px solid ' + theme.border, borderRadius: 7, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: theme.textMid }}>
                  Edit
                </button>
                <button onClick={() => toggleActive(s)}
                  style={{ background: '#fdedec', border: '1px solid #f1948a', borderRadius: 7, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#a93226' }}>
                  Deactivate
                </button>
                <button onClick={() => deleteStaff(s)}
                  style={{ background: theme.redBg, border: '1px solid #FECACA', borderRadius: 7, padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: theme.red }}>
                  🗑
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Inactive staff */}
      {inactiveStaff.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
            Inactive Staff
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {inactiveStaff.map(s => {
              const rc = ROLE_CONFIG[s.role] || ROLE_CONFIG.captain
              return (
                <div key={s.id} style={{ background: '#fff', borderRadius: 12, border: '1px solid ' + theme.border, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, opacity: 0.6 }}>
                  <div style={{ width: 44, height: 44, background: theme.bgWarm, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, color: theme.textLight, flexShrink: 0 }}>
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: theme.textDark }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: theme.textLight, marginTop: 2 }}>{s.email || '—'}</div>
                  </div>
                  <span style={{ background: rc.bg, color: rc.color, border: '1px solid ' + rc.border, padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                    {rc.label}
                  </span>
                  <button onClick={() => toggleActive(s)}
                    style={{ background: '#DCFCE7', border: '1px solid #86EFAC', borderRadius: 7, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#15803D' }}>
                    Reactivate
                  </button>
                  <button onClick={() => deleteStaff(s)}
                    style={{ background: theme.redBg, border: '1px solid #FECACA', borderRadius: 7, padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: theme.red }}>
                    🗑
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}

      {staff.length === 0 && (
        <div style={{ background: '#fff', borderRadius: 14, padding: 56, textAlign: 'center', border: '2px dashed ' + theme.border }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>👤</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: theme.textDark, marginBottom: 6 }}>No staff yet</div>
          <div style={{ fontSize: 13, color: theme.textLight }}>Click "+ Invite Staff" to add your first team member</div>
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 18, padding: 32, width: 400, boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: theme.textDark, margin: '0 0 6px' }}>
              {editStaff ? 'Edit Staff' : 'Invite New Staff'}
            </h2>
            <p style={{ fontSize: 13, color: theme.textLight, margin: '0 0 24px' }}>
              {editStaff ? 'Update staff details' : 'An invite email will be sent to set their password'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Full Name *</label>
                <input autoFocus value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Rahul Sharma"
                  style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 9, padding: '10px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>

              {!editStaff && (
                <>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Email *</label>
                    <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="staff@Chicken Affair.com"
                      style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 9, padding: '10px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Temporary Password *</label>
                    <input type="text" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="Min 6 characters"
                      style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 9, padding: '10px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                    <div style={{ fontSize: 11, color: theme.textLight, marginTop: 5 }}>Share this with the staff member via WhatsApp</div>
                  </div>
                </>
              )}

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Phone</label>
                <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="e.g. 9876543210"
                  style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 9, padding: '10px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Role *</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {ROLES.map(r => {
                    const rc = ROLE_CONFIG[r]
                    return (
                      <button key={r} onClick={() => setForm(f => ({ ...f, role: r }))}
                        style={{ flex: 1, minWidth: 80, background: form.role === r ? rc.bg : theme.bgWarm, color: form.role === r ? rc.color : theme.textMid, border: '1.5px solid ' + (form.role === r ? rc.border : theme.border), borderRadius: 8, padding: '8px 0', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                        {rc.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
              <button onClick={() => setShowForm(false)}
                style={{ flex: 1, background: theme.bgWarm, border: '1px solid ' + theme.border, borderRadius: 9, padding: '12px', fontSize: 13, cursor: 'pointer', fontWeight: 600, color: theme.textMid }}>
                Cancel
              </button>
              <button onClick={saveStaff} disabled={saving || inviting}
                style={{ flex: 2, background: '#6b1f1f', color: '#fff', border: 'none', borderRadius: 9, padding: '12px', fontSize: 13, fontWeight: 700, cursor: (saving || inviting) ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving...' : editStaff ? 'Save Changes' : 'Create Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}