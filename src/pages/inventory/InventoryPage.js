import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { theme } from '../../lib/theme'
import { Plus, Pencil, Trash2, X, Check, AlertTriangle, Package } from 'lucide-react'

const UNITS = ['kg', 'g', 'L', 'ml', 'pcs', 'box', 'bag', 'bottle', 'pack', 'dozen']
const EMPTY = { name: '', unit: 'kg', current_stock: '', min_stock: '' }

export default function InventoryPage() {
  const [items, setItems]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [filter, setFilter]     = useState('all') // all | low | ok
  const [modal, setModal]       = useState(null)  // null | { mode: 'add'|'edit'|'adjust', ... }
  const [form, setForm]         = useState(EMPTY)
  const [adjust, setAdjust]     = useState({ qty: '', type: 'add' })
  const [saving, setSaving]     = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [error, setError]       = useState('')

  useEffect(() => { fetchItems() }, [])

  async function fetchItems() {
    const { data } = await supabase.from('inventory_items').select('*').order('name')
    setItems(data || [])
    setLoading(false)
  }

  function openAdd() {
    setForm(EMPTY)
    setError('')
    setModal({ mode: 'add' })
  }

  function openEdit(item) {
    setForm({ name: item.name, unit: item.unit, current_stock: item.current_stock, min_stock: item.min_stock })
    setError('')
    setModal({ mode: 'edit', id: item.id })
  }

  function openAdjust(item) {
    setAdjust({ qty: '', type: 'add' })
    setError('')
    setModal({ mode: 'adjust', item })
  }

  async function handleSave() {
    if (!form.name.trim()) return setError('Name is required')
    if (form.current_stock === '') return setError('Current stock is required')
    if (form.min_stock === '') return setError('Minimum stock is required')
    setSaving(true)
    setError('')
    const payload = {
      name: form.name.trim(),
      unit: form.unit,
      current_stock: parseFloat(form.current_stock),
      min_stock: parseFloat(form.min_stock),
    }
    let err
    if (modal.mode === 'add') {
      ;({ error: err } = await supabase.from('inventory_items').insert(payload))
    } else {
      ;({ error: err } = await supabase.from('inventory_items').update(payload).eq('id', modal.id))
    }
    setSaving(false)
    if (err) return setError(err.message)
    setModal(null)
    fetchItems()
  }

  async function handleAdjust() {
    if (!adjust.qty || isNaN(parseFloat(adjust.qty))) return setError('Enter a valid quantity')
    setSaving(true)
    setError('')
    const qty     = parseFloat(adjust.qty)
    const current = parseFloat(modal.item.current_stock)
    const newStock = adjust.type === 'add' ? current + qty : Math.max(0, current - qty)
    const { error: err } = await supabase.from('inventory_items').update({ current_stock: newStock }).eq('id', modal.item.id)
    setSaving(false)
    if (err) return setError(err.message)
    setModal(null)
    fetchItems()
  }

  async function handleDelete() {
    await supabase.from('inventory_items').delete().eq('id', deleteId)
    setDeleteId(null)
    fetchItems()
  }

  const filtered = items.filter(i => {
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase())
    const isLow = parseFloat(i.current_stock) <= parseFloat(i.min_stock)
    if (filter === 'low') return matchSearch && isLow
    if (filter === 'ok')  return matchSearch && !isLow
    return matchSearch
  })

  const lowCount = items.filter(i => parseFloat(i.current_stock) <= parseFloat(i.min_stock)).length

  if (loading) return <div style={{ padding: 40, color: theme.textLight }}>Loading...</div>

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: theme.textDark, margin: 0 }}>Inventory</h1>
          <p style={{ color: theme.textLight, fontSize: 14, marginTop: 4 }}>
            {items.length} items · {lowCount > 0
              ? <span style={{ color: '#D97706', fontWeight: 700 }}>⚠ {lowCount} low stock</span>
              : <span style={{ color: '#15803D' }}>✓ All stocked</span>}
          </p>
        </div>
        <button onClick={openAdd}
          style={{ background: '#092b33', color: '#fff', border: 'none', borderRadius: 9, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} /> Add Item
        </button>
      </div>

      {/* Low stock banner */}
      {lowCount > 0 && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={18} color='#D97706' />
          <span style={{ fontSize: 13, color: '#92400E', fontWeight: 600 }}>
            {lowCount} item{lowCount !== 1 ? 's are' : ' is'} running low and need{lowCount === 1 ? 's' : ''} restocking.
          </span>
          <button onClick={() => setFilter('low')}
            style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: '#D97706', background: 'none', border: '1px solid #FCD34D', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
            View Low Stock
          </button>
        </div>
      )}

      {/* Search + filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items..."
            style={{ width: '100%', border: '1px solid ' + theme.border, borderRadius: 9, padding: '9px 14px 9px 36px', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: theme.textDark, background: '#fff' }} />
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14 }}>🔍</span>
        </div>
        <div style={{ display: 'flex', background: '#fff', border: '1px solid ' + theme.border, borderRadius: 9, overflow: 'hidden' }}>
          {[['all', 'All'], ['low', '⚠ Low'], ['ok', '✓ OK']].map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)}
              style={{ padding: '9px 16px', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer', background: filter === val ? '#092b33' : 'transparent', color: filter === val ? '#fff' : theme.textMid, borderRight: val !== 'ok' ? '1px solid ' + theme.border : 'none' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Items table */}
      {filtered.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid ' + theme.border, textAlign: 'center', padding: '60px 20px', color: theme.textLight }}>
          <Package size={36} color={theme.border} style={{ marginBottom: 12 }} />
          <div style={{ fontWeight: 700, color: theme.textDark, marginBottom: 6 }}>
            {items.length === 0 ? 'No items yet' : 'No items match your filter'}
          </div>
          <div style={{ fontSize: 13 }}>
            {items.length === 0 ? 'Click "+ Add Item" to start tracking inventory.' : 'Try adjusting your search or filter.'}
          </div>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid ' + theme.border, overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 120px 120px 160px', padding: '10px 18px', borderBottom: '2px solid ' + theme.border, background: theme.bgWarm }}>
            {['Item Name', 'Unit', 'In Stock', 'Min Stock', 'Actions'].map((h, i) => (
              <div key={h} style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: i >= 2 ? 'center' : 'left' }}>{h}</div>
            ))}
          </div>

          {filtered.map((item, idx) => {
            const isLow    = parseFloat(item.current_stock) <= parseFloat(item.min_stock)
            const stockPct = Math.min(100, (parseFloat(item.current_stock) / Math.max(parseFloat(item.min_stock) * 2, 1)) * 100)
            return (
              <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 120px 120px 160px', padding: '14px 18px', borderBottom: idx < filtered.length - 1 ? '1px solid ' + theme.bgWarm : 'none', alignItems: 'center', background: isLow ? '#FFFBEB' : '#fff', transition: 'background 0.1s' }}>
                {/* Name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {isLow && <AlertTriangle size={14} color='#D97706' style={{ flexShrink: 0 }} />}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: theme.textDark }}>{item.name}</div>
                    {isLow && <div style={{ fontSize: 11, color: '#D97706', fontWeight: 600, marginTop: 1 }}>Low stock</div>}
                  </div>
                </div>

                {/* Unit */}
                <div style={{ fontSize: 13, color: theme.textLight, fontWeight: 600 }}>{item.unit}</div>

                {/* Current stock */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: isLow ? '#D97706' : theme.textDark }}>{item.current_stock}</div>
                  <div style={{ height: 4, background: theme.bgWarm, borderRadius: 99, marginTop: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: stockPct + '%', background: isLow ? '#F59E0B' : '#0D9488', borderRadius: 99, transition: 'width 0.3s' }} />
                  </div>
                </div>

                {/* Min stock */}
                <div style={{ textAlign: 'center', fontSize: 13, color: theme.textLight, fontWeight: 600 }}>{item.min_stock}</div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                  <button onClick={() => openAdjust(item)}
                    style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 7, padding: '6px 12px', fontSize: 12, fontWeight: 700, color: '#15803D', cursor: 'pointer' }}>
                    ± Stock
                  </button>
                  <button onClick={() => openEdit(item)}
                    style={{ background: theme.bgWarm, border: 'none', borderRadius: 7, padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <Pencil size={14} color={theme.textMid} />
                  </button>
                  <button onClick={() => setDeleteId(item.id)}
                    style={{ background: '#FEF2F2', border: 'none', borderRadius: 7, padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <Trash2 size={14} color='#DC2626' />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modal && (modal.mode === 'add' || modal.mode === 'edit') && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
          onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: theme.textDark }}>{modal.mode === 'add' ? 'Add Item' : 'Edit Item'}</div>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} color={theme.textLight} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>Item Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Whole Milk"
                  style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: theme.textDark }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>Unit *</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {UNITS.map(u => (
                    <button key={u} onClick={() => setForm(f => ({ ...f, unit: u }))}
                      style={{ background: form.unit === u ? '#092b33' : theme.bgWarm, color: form.unit === u ? '#fff' : theme.textMid, border: 'none', borderRadius: 7, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      {u}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>Current Stock *</label>
                  <input type="number" value={form.current_stock} onChange={e => setForm(f => ({ ...f, current_stock: e.target.value }))} placeholder="0"
                    style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: theme.textDark }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>Min Stock *</label>
                  <input type="number" value={form.min_stock} onChange={e => setForm(f => ({ ...f, min_stock: e.target.value }))} placeholder="0"
                    style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: theme.textDark }} />
                </div>
              </div>
            </div>
            {error && <div style={{ marginTop: 12, fontSize: 12, color: '#DC2626', fontWeight: 600 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              <button onClick={() => setModal(null)}
                style={{ flex: 1, background: theme.bgWarm, border: 'none', borderRadius: 9, padding: '11px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: theme.textMid }}>
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                style={{ flex: 2, background: '#092b33', color: '#fff', border: 'none', borderRadius: 9, padding: '11px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Check size={15} /> {saving ? 'Saving...' : modal.mode === 'add' ? 'Add Item' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {modal?.mode === 'adjust' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
          onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: theme.textDark }}>Adjust Stock</div>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={18} color={theme.textLight} /></button>
            </div>
            <div style={{ fontSize: 13, color: theme.textLight, marginBottom: 20 }}>
              {modal.item.name} · Current: <strong style={{ color: theme.textDark }}>{modal.item.current_stock} {modal.item.unit}</strong>
            </div>

            {/* Add / Remove toggle */}
            <div style={{ display: 'flex', background: theme.bgWarm, borderRadius: 9, padding: 4, marginBottom: 16 }}>
              {[['add', '+ Add Stock'], ['remove', '− Remove Stock']].map(([val, label]) => (
                <button key={val} onClick={() => setAdjust(a => ({ ...a, type: val }))}
                  style={{ flex: 1, padding: '9px 0', borderRadius: 7, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', background: adjust.type === val ? (val === 'add' ? '#0D9488' : '#DC2626') : 'transparent', color: adjust.type === val ? '#fff' : theme.textMid, transition: 'all 0.15s' }}>
                  {label}
                </button>
              ))}
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>
                Quantity ({modal.item.unit})
              </label>
              <input type="number" value={adjust.qty} onChange={e => setAdjust(a => ({ ...a, qty: e.target.value }))}
                placeholder="0" autoFocus
                style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 8, padding: '10px 12px', fontSize: 16, fontWeight: 700, outline: 'none', boxSizing: 'border-box', color: theme.textDark, textAlign: 'center' }} />
            </div>

            {/* Preview */}
            {adjust.qty && !isNaN(parseFloat(adjust.qty)) && (
              <div style={{ marginTop: 12, background: theme.bgWarm, borderRadius: 9, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: theme.textLight }}>New stock will be</span>
                <strong style={{ color: theme.textDark }}>
                  {adjust.type === 'add'
                    ? parseFloat(modal.item.current_stock) + parseFloat(adjust.qty)
                    : Math.max(0, parseFloat(modal.item.current_stock) - parseFloat(adjust.qty))
                  } {modal.item.unit}
                </strong>
              </div>
            )}

            {error && <div style={{ marginTop: 10, fontSize: 12, color: '#DC2626', fontWeight: 600 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setModal(null)}
                style={{ flex: 1, background: theme.bgWarm, border: 'none', borderRadius: 9, padding: '11px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: theme.textMid }}>
                Cancel
              </button>
              <button onClick={handleAdjust} disabled={saving}
                style={{ flex: 2, background: adjust.type === 'add' ? '#0D9488' : '#DC2626', color: '#fff', border: 'none', borderRadius: 9, padding: '11px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {saving ? 'Saving...' : adjust.type === 'add' ? '+ Add Stock' : '− Remove Stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 360, textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#FEF2F2', border: '2px solid #FECACA', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Trash2 size={22} color='#DC2626' />
            </div>
            <div style={{ fontWeight: 800, fontSize: 16, color: theme.textDark, marginBottom: 8 }}>Delete Item?</div>
            <div style={{ fontSize: 13, color: theme.textLight, marginBottom: 22 }}>This item will be permanently removed from inventory.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteId(null)}
                style={{ flex: 1, background: theme.bgWarm, border: 'none', borderRadius: 9, padding: '11px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: theme.textMid }}>
                Cancel
              </button>
              <button onClick={handleDelete}
                style={{ flex: 1, background: '#DC2626', color: '#fff', border: 'none', borderRadius: 9, padding: '11px 0', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}