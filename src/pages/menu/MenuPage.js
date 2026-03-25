import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { theme } from '../../lib/theme'

const FOOD_TYPE = {
  veg:     { label: 'Veg',     color: '#15803D', bg: '#DCFCE7', border: '#86EFAC' },
  non_veg: { label: 'Non-Veg', color: '#B91C1C', bg: '#FEE2E2', border: '#FCA5A5' },
  egg:     { label: 'Egg',     color: '#B45309', bg: '#FEF3C7', border: '#FCD34D' },
}

const PRIORITY_CONFIG = {
  1: { label: 'P1', color: '#B91C1C', bg: '#FEE2E2', border: '#FCA5A5', desc: 'Rush items, fire first' },
  2: { label: 'P2', color: '#B45309', bg: '#FEF3C7', border: '#FCD34D', desc: 'Standard priority' },
  3: { label: 'P3', color: '#15803D', bg: '#DCFCE7', border: '#86EFAC', desc: 'Can wait, fire last' },
}

const UNITS = [
  { value: '',      label: 'No unit'  },
  { value: 'ml',    label: 'ml'       },
  { value: 'L',     label: 'L (Litre)'},
  { value: 'g',     label: 'g (gram)' },
  { value: 'kg',    label: 'kg'       },
  { value: 'oz',    label: 'oz'       },
  { value: 'lb',    label: 'lb'       },
  { value: 'inches',label: 'inches'   },
  { value: 'cm',    label: 'cm'       },
  { value: 'pcs',   label: 'pcs'      },
  { value: 'slice', label: 'slice'    },
  { value: 'plate', label: 'plate'    },
  { value: 'cup',   label: 'cup'      },
]

const EMPTY_PORTION = { name: '', unit: '', value: '', price: '' }

export default function MenuPage() {
  const { profile } = useAuth()
  const isManager = profile?.role === 'owner' || profile?.role === 'manager'

  const [categories, setCategories]         = useState([])
  const [items, setItems]                   = useState([])
  const [portions, setPortions]             = useState({}) // itemId -> portions[]
  const [activeCategory, setActiveCategory] = useState(null)
  const [loading, setLoading]               = useState(true)

  const [showCatForm, setShowCatForm]   = useState(false)
  const [showItemForm, setShowItemForm] = useState(false)
  const [editCat, setEditCat]           = useState(null)
  const [editItem, setEditItem]         = useState(null)
  const [saving, setSaving]             = useState(false)
  const [toggling, setToggling]         = useState(null)

  const [catForm, setCatForm]   = useState({ name: '', sort_order: 0 })
  const [itemForm, setItemForm] = useState({
    name: '', price: '', description: '', food_type: 'veg',
    is_available: true, sort_order: 0, gst_rate: 5, priority: 2
  })

  // Portions management inside item modal
  const [portionList, setPortionList]   = useState([]) // portions for item being edited
  const [portionForm, setPortionForm]   = useState(EMPTY_PORTION)
  const [editPortionIdx, setEditPortionIdx] = useState(null) // index being edited, null = new
  const [showPortionForm, setShowPortionForm] = useState(false)
  const [savingPortion, setSavingPortion] = useState(false)

  // Drag
  const dragIndex     = useRef(null)
  const dragOverIndex = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [dragOver, setDragOver] = useState(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const { data: cats }      = await supabase.from('menu_categories').select('*').eq('is_active', true).order('sort_order')
    const { data: menuItems } = await supabase.from('menu_items').select('*').order('sort_order')
    const { data: allPortions } = await supabase.from('item_portions').select('*').eq('is_available', true).order('sort_order')
    setCategories(cats || [])
    setItems(menuItems || [])
    // Group portions by menu_item_id
    const portionMap = {}
    ;(allPortions || []).forEach(p => {
      if (!portionMap[p.menu_item_id]) portionMap[p.menu_item_id] = []
      portionMap[p.menu_item_id].push(p)
    })
    setPortions(portionMap)
    if (cats && cats.length > 0 && !activeCategory) setActiveCategory(cats[0].id)
    setLoading(false)
  }

  // ── Drag handlers ──
  function handleDragStart(e, idx) {
    dragIndex.current = idx; setDragging(true)
    e.dataTransfer.effectAllowed = 'move'
    const ghost = e.currentTarget.cloneNode(true)
    ghost.style.opacity = '0.01'; ghost.style.position = 'absolute'; ghost.style.top = '-1000px'
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 0, 0)
    setTimeout(() => document.body.removeChild(ghost), 0)
  }
  function handleDragEnter(idx) { if (dragIndex.current === idx) return; dragOverIndex.current = idx; setDragOver(idx) }
  function handleDragEnd() {
    setDragging(false); setDragOver(null)
    if (dragIndex.current === null || dragOverIndex.current === null || dragIndex.current === dragOverIndex.current) {
      dragIndex.current = null; dragOverIndex.current = null; return
    }
    const reordered = [...categories]
    const [moved] = reordered.splice(dragIndex.current, 1)
    reordered.splice(dragOverIndex.current, 0, moved)
    dragIndex.current = null; dragOverIndex.current = null
    setCategories(reordered)
    Promise.all(reordered.map((cat, idx) => supabase.from('menu_categories').update({ sort_order: idx }).eq('id', cat.id)))
  }

  // ── Category actions ──
  function openAddCat() { setCatForm({ name: '', sort_order: categories.length }); setEditCat(null); setShowCatForm(true) }
  function openEditCat(cat) { setCatForm({ name: cat.name, sort_order: cat.sort_order }); setEditCat(cat); setShowCatForm(true) }
  async function saveCat() {
    if (!catForm.name.trim()) return alert('Category name is required')
    setSaving(true)
    try {
      if (editCat) await supabase.from('menu_categories').update({ name: catForm.name, sort_order: parseInt(catForm.sort_order) }).eq('id', editCat.id)
      else await supabase.from('menu_categories').insert({ name: catForm.name, sort_order: parseInt(catForm.sort_order), is_active: true })
      setShowCatForm(false); fetchAll()
    } finally { setSaving(false) }
  }
  async function deleteCat(id) {
    const count = items.filter(i => i.category_id === id).length
    if (count > 0) return alert(`This category has ${count} items. Delete or move them first.`)
    if (!window.confirm('Delete this category?')) return
    await supabase.from('menu_categories').delete().eq('id', id)
    if (activeCategory === id) setActiveCategory(categories[0]?.id || null)
    fetchAll()
  }

  // ── Item actions ──
  function openAddItem() {
    setItemForm({ name: '', price: '', description: '', food_type: 'veg', is_available: true, sort_order: items.filter(i => i.category_id === activeCategory).length, gst_rate: 5, priority: 2 })
    setPortionList([])
    setEditItem(null); setShowItemForm(true)
  }
  function openEditItem(item) {
    setItemForm({ name: item.name, price: item.price, description: item.description || '', food_type: item.food_type || 'veg', is_available: item.is_available, sort_order: item.sort_order, gst_rate: item.gst_rate ?? 5, priority: item.priority ?? 2 })
    setPortionList(portions[item.id] || [])
    setEditItem(item); setShowItemForm(true)
  }
  async function saveItem() {
    if (!itemForm.name.trim()) return alert('Item name is required')
    if (!itemForm.price) return alert('Price is required')
    setSaving(true)
    try {
      const payload = { name: itemForm.name, price: parseFloat(itemForm.price), description: itemForm.description || null, food_type: itemForm.food_type, is_available: itemForm.is_available, sort_order: parseInt(itemForm.sort_order), gst_rate: parseFloat(itemForm.gst_rate), priority: parseInt(itemForm.priority) }
      let itemId = editItem?.id
      if (editItem) await supabase.from('menu_items').update(payload).eq('id', editItem.id)
      else {
        const { data } = await supabase.from('menu_items').insert({ ...payload, category_id: activeCategory }).select().single()
        itemId = data?.id
      }
      setShowItemForm(false); fetchAll()
    } finally { setSaving(false) }
  }
  async function deleteItem(id) {
    if (!window.confirm('Delete this item?')) return
    await supabase.from('menu_items').delete().eq('id', id)
    fetchAll()
  }
  async function toggleAvailability(item) {
    if (!isManager) return
    setToggling(item.id)
    await supabase.from('menu_items').update({ is_available: !item.is_available }).eq('id', item.id)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_available: !i.is_available } : i))
    setToggling(null)
  }

  // ── Portion actions ──
  function openAddPortion() { setPortionForm(EMPTY_PORTION); setEditPortionIdx(null); setShowPortionForm(true) }
  function openEditPortion(p, idx) { setPortionForm({ name: p.name, unit: p.unit || '', value: p.value, price: p.price }); setEditPortionIdx(idx); setShowPortionForm(true) }

  async function savePortion() {
    if (!portionForm.name.trim()) return alert('Portion name is required')
    if (!portionForm.price) return alert('Price is required')
    setSavingPortion(true)
    try {
      const portionPayload = {
        menu_item_id: editItem?.id || null,
        name: portionForm.name.trim(),
        unit: portionForm.unit || '',
        value: parseFloat(portionForm.value) || 0,
        price: parseFloat(portionForm.price),
        sort_order: editPortionIdx !== null ? portionList[editPortionIdx].sort_order : portionList.length,
        is_available: true,
      }
      if (editItem?.id) {
        // Saving directly to DB
        if (editPortionIdx !== null && portionList[editPortionIdx]?.id) {
          await supabase.from('item_portions').update({ name: portionPayload.name, unit: portionPayload.unit, value: portionPayload.value, price: portionPayload.price }).eq('id', portionList[editPortionIdx].id)
          setPortionList(prev => prev.map((p, i) => i === editPortionIdx ? { ...p, ...portionPayload } : p))
        } else {
          const { data } = await supabase.from('item_portions').insert(portionPayload).select().single()
          setPortionList(prev => [...prev, data])
        }
      } else {
        // New item not saved yet — store locally
        if (editPortionIdx !== null) {
          setPortionList(prev => prev.map((p, i) => i === editPortionIdx ? { ...portionPayload } : p))
        } else {
          setPortionList(prev => [...prev, portionPayload])
        }
      }
      setShowPortionForm(false)
    } finally { setSavingPortion(false) }
  }

  async function deletePortion(p, idx) {
    if (!window.confirm('Delete this portion?')) return
    if (p.id) await supabase.from('item_portions').delete().eq('id', p.id)
    setPortionList(prev => prev.filter((_, i) => i !== idx))
    if (editItem?.id) fetchAll()
  }

  function formatPortion(p) {
    if (!p.unit && !p.value) return p.name
    if (!p.unit) return `${p.name}`
    return `${p.name} · ${p.value}${p.unit}`
  }

  const activeItems = items.filter(i => i.category_id === activeCategory)
  const activeCat   = categories.find(c => c.id === activeCategory)
  const disabledCount = activeItems.filter(i => !i.is_available).length

  if (loading) return <div style={{ padding: 40, color: theme.textLight }}>Loading menu...</div>

  return (
    <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 112px)' }}>

      {/* ── LEFT: Categories ── */}
      <div style={{ width: 220, display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 14, border: '1px solid ' + theme.border, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid ' + theme.border }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: theme.textDark }}>Categories</div>
            <button onClick={openAddCat} style={{ background: '#092b33', color: '#fff', border: 'none', borderRadius: 6, width: 26, height: 26, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>+</button>
          </div>
          <div style={{ fontSize: 10, color: theme.textMuted }}>⠿ Drag to reorder priority</div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {categories.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: theme.textMuted, fontSize: 12 }}>No categories yet</div>}
          {categories.map((cat, idx) => {
            const catItemCount = items.filter(i => i.category_id === cat.id).length
            const isActive = activeCategory === cat.id
            const isDragOver = dragOver === idx
            const isDragging = dragging && dragIndex.current === idx
            return (
              <div key={cat.id} draggable onDragStart={e => handleDragStart(e, idx)} onDragEnter={() => handleDragEnter(idx)} onDragOver={e => e.preventDefault()} onDragEnd={handleDragEnd} onClick={() => setActiveCategory(cat.id)}
                style={{ padding: '11px 12px', cursor: 'grab', background: isActive ? '#092b33' : isDragOver ? '#E6F0FF' : 'transparent', borderBottom: '1px solid ' + (isDragOver ? '#3B82F6' : theme.bgWarm), borderTop: isDragOver ? '2px solid #3B82F6' : '2px solid transparent', opacity: isDragging ? 0.4 : 1, userSelect: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: isActive ? 'rgba(255,255,255,0.4)' : theme.textMuted, fontSize: 14, flexShrink: 0 }}>⠿</span>
                  <span style={{ fontSize: 9, fontWeight: 800, background: isActive ? 'rgba(255,255,255,0.15)' : '#F1F5F9', color: isActive ? '#fff' : theme.textMuted, padding: '1px 5px', borderRadius: 4, flexShrink: 0 }}>#{idx + 1}</span>
                  <div style={{ fontWeight: 700, fontSize: 13, color: isActive ? '#fff' : theme.textDark, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.name}</div>
                  <span style={{ fontSize: 10, background: isActive ? 'rgba(255,255,255,0.15)' : theme.bgWarm, color: isActive ? '#fff' : theme.textLight, padding: '2px 6px', borderRadius: 10, fontWeight: 700 }}>{catItemCount}</span>
                  {!isActive && <button onClick={e => { e.stopPropagation(); openEditCat(cat) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted, fontSize: 11, padding: '1px 3px' }}>✏️</button>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── RIGHT: Items ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: theme.textDark, margin: 0 }}>{activeCat ? activeCat.name : 'Menu'}</h1>
            <p style={{ color: theme.textLight, fontSize: 13, marginTop: 3 }}>
              {activeItems.length} item{activeItems.length !== 1 ? 's' : ''}
              {disabledCount > 0 && <span style={{ marginLeft: 6, background: '#FEE2E2', color: '#B91C1C', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10 }}>{disabledCount} disabled</span>}
              {activeCat && (<><span style={{ margin: '0 8px', color: theme.border }}>·</span><span onClick={() => openEditCat(activeCat)} style={{ color: theme.primary, cursor: 'pointer', fontWeight: 600 }}>Edit category</span><span style={{ margin: '0 8px', color: theme.border }}>·</span><span onClick={() => deleteCat(activeCat.id)} style={{ color: theme.red, cursor: 'pointer', fontWeight: 600 }}>Delete</span></>)}
            </p>
          </div>
          <button onClick={openAddItem} disabled={!activeCategory} style={{ background: '#092b33', color: '#fff', border: 'none', borderRadius: 9, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: activeCategory ? 'pointer' : 'not-allowed', opacity: activeCategory ? 1 : 0.5 }}>+ Add Item</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {activeItems.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 14, padding: 56, textAlign: 'center', border: '2px dashed ' + theme.border }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🍽️</div>
              <div style={{ fontWeight: 700, color: theme.textDark, marginBottom: 6 }}>No items in this category</div>
              <div style={{ fontSize: 13, color: theme.textLight }}>Click "+ Add Item" to add your first item</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activeItems.map(item => {
                const ft  = FOOD_TYPE[item.food_type] || FOOD_TYPE.veg
                const pri = PRIORITY_CONFIG[item.priority ?? 2]
                const isOn = item.is_available
                const itemPortions = portions[item.id] || []
                return (
                  <div key={item.id} style={{ background: isOn ? '#fff' : '#FAFAFA', borderRadius: 12, padding: '12px 16px', border: '1px solid ' + (isOn ? theme.border : '#FECACA'), display: 'flex', alignItems: 'center', gap: 12, opacity: isOn ? 1 : 0.75 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, border: '2px solid ' + ft.color, background: ft.color, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: isOn ? theme.textDark : theme.textLight, textDecoration: isOn ? 'none' : 'line-through' }}>{item.name}</div>
                        {!isOn && <span style={{ fontSize: 10, fontWeight: 800, background: '#FEE2E2', color: '#B91C1C', padding: '2px 7px', borderRadius: 10, flexShrink: 0 }}>OUT OF STOCK</span>}
                      </div>
                      {item.description && <div style={{ fontSize: 12, color: theme.textLight, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.description}</div>}
                      {/* Portion tags */}
                      {itemPortions.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
                          {itemPortions.map(p => (
                            <span key={p.id} style={{ background: '#F0FDF4', color: '#15803D', border: '1px solid #86EFAC', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10 }}>
                              {formatPortion(p)} · ₹{p.price}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span style={{ background: pri.bg, color: pri.color, border: '1px solid ' + pri.border, padding: '3px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{pri.label}</span>
                    <span style={{ background: ft.bg, color: ft.color, border: '1px solid ' + ft.border, padding: '3px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{ft.label}</span>
                    <div style={{ fontWeight: 800, fontSize: 15, color: theme.textDark, minWidth: 60, textAlign: 'right' }}>
                      {itemPortions.length > 0 ? <span style={{ fontSize: 11, color: theme.textLight }}>see portions</span> : `₹${item.price}`}
                    </div>
                    {isManager && (
                      <button onClick={() => toggleAvailability(item)} disabled={toggling === item.id}
                        style={{ background: isOn ? '#FEF2F2' : '#DCFCE7', color: isOn ? '#B91C1C' : '#15803D', border: '1.5px solid ' + (isOn ? '#FECACA' : '#86EFAC'), borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer', flexShrink: 0, minWidth: 80, textAlign: 'center' }}>
                        {toggling === item.id ? '...' : isOn ? '🚫 Disable' : '✓ Enable'}
                      </button>
                    )}
                    <button onClick={() => openEditItem(item)} style={{ background: theme.bgWarm, border: '1px solid ' + theme.border, borderRadius: 7, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: theme.textMid, flexShrink: 0 }}>Edit</button>
                    <button onClick={() => deleteItem(item.id)} style={{ background: theme.redBg, border: '1px solid #FECACA', borderRadius: 7, padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: theme.red, flexShrink: 0 }}>🗑</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Category Modal ── */}
      {showCatForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 18, padding: 32, width: 380, boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: theme.textDark, margin: '0 0 20px' }}>{editCat ? 'Edit Category' : 'Add Category'}</h2>
            <input autoFocus value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Starters, Main Course"
              style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 9, padding: '10px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={() => setShowCatForm(false)} style={{ flex: 1, background: theme.bgWarm, border: '1px solid ' + theme.border, borderRadius: 9, padding: '12px', fontSize: 13, cursor: 'pointer', fontWeight: 600, color: theme.textMid }}>Cancel</button>
              <button onClick={saveCat} disabled={saving} style={{ flex: 2, background: '#092b33', color: '#fff', border: 'none', borderRadius: 9, padding: '12px', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : editCat ? 'Save Changes' : 'Add Category'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Item Modal ── */}
      {showItemForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 18, padding: 32, width: 520, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: theme.textDark, margin: '0 0 20px' }}>{editItem ? 'Edit Item' : 'Add Item'}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Item Name *</label>
                <input autoFocus value={itemForm.name} onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Paneer Tikka"
                  style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 9, padding: '10px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Base Price (₹) *</label>
                  <input type="number" value={itemForm.price} onChange={e => setItemForm(f => ({ ...f, price: e.target.value }))} placeholder="0"
                    style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 9, padding: '10px 12px', fontSize: 14, fontWeight: 700, outline: 'none', boxSizing: 'border-box' }} />
                  <div style={{ fontSize: 10, color: theme.textLight, marginTop: 4 }}>Used when no portions defined</div>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Status</label>
                  <button onClick={() => setItemForm(f => ({ ...f, is_available: !f.is_available }))}
                    style={{ width: '100%', background: itemForm.is_available ? '#DCFCE7' : '#FEE2E2', color: itemForm.is_available ? '#15803D' : '#B91C1C', border: '1.5px solid ' + (itemForm.is_available ? '#86EFAC' : '#FECACA'), borderRadius: 9, padding: '10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    {itemForm.is_available ? '✓ Available' : '🚫 Disabled'}
                  </button>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Description <span style={{ fontWeight: 400 }}>(optional)</span></label>
                <input value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))} placeholder="Short description"
                  style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 9, padding: '10px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Food Type</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {Object.entries(FOOD_TYPE).map(([key, cfg]) => (
                    <button key={key} onClick={() => setItemForm(f => ({ ...f, food_type: key }))}
                      style={{ flex: 1, background: itemForm.food_type === key ? cfg.bg : theme.bgWarm, color: itemForm.food_type === key ? cfg.color : theme.textMid, border: '1.5px solid ' + (itemForm.food_type === key ? cfg.border : theme.border), borderRadius: 8, padding: '8px 0', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Kitchen Priority <span style={{ fontWeight: 400, textTransform: 'none' }}>(1 = highest)</span></label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[1, 2, 3].map(p => {
                    const cfg = PRIORITY_CONFIG[p]; const selected = parseInt(itemForm.priority) === p
                    return (
                      <button key={p} onClick={() => setItemForm(f => ({ ...f, priority: p }))}
                        style={{ flex: 1, background: selected ? cfg.bg : theme.bgWarm, color: selected ? cfg.color : theme.textMid, border: '1.5px solid ' + (selected ? cfg.border : theme.border), borderRadius: 8, padding: '10px 8px', fontSize: 12, fontWeight: 700, cursor: 'pointer', textAlign: 'center' }}>
                        <div style={{ fontSize: 15, fontWeight: 900 }}>P{p}</div>
                        <div style={{ fontSize: 10, opacity: 0.8 }}>{p === 1 ? 'High' : p === 2 ? 'Normal' : 'Low'}</div>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>GST Rate (%)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[0, 5, 12, 18].map(rate => (
                    <button key={rate} onClick={() => setItemForm(f => ({ ...f, gst_rate: rate }))}
                      style={{ flex: 1, background: itemForm.gst_rate === rate ? '#092b33' : theme.bgWarm, color: itemForm.gst_rate === rate ? '#fff' : theme.textMid, border: '1.5px solid ' + (itemForm.gst_rate === rate ? '#092b33' : theme.border), borderRadius: 8, padding: '8px 0', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      {rate}%
                    </button>
                  ))}
                </div>
              </div>

              {/* ── PORTIONS ── */}
              <div style={{ borderTop: '2px solid ' + theme.bgWarm, paddingTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13, color: theme.textDark }}>Portions / Sizes</div>
                    <div style={{ fontSize: 11, color: theme.textLight, marginTop: 2 }}>e.g. Half, Full, 500ml, 1L — each with its own price</div>
                  </div>
                  <button onClick={openAddPortion}
                    style={{ background: '#092b33', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ Add Portion</button>
                </div>

                {portionList.length === 0 ? (
                  <div style={{ background: theme.bgWarm, borderRadius: 10, padding: '12px 16px', fontSize: 12, color: theme.textLight, textAlign: 'center' }}>
                    No portions — item will be ordered at base price (₹{itemForm.price || '0'})
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {portionList.map((p, idx) => (
                      <div key={idx} style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: theme.textDark }}>{formatPortion(p)}</div>
                          <div style={{ fontSize: 11, color: '#15803D', marginTop: 2 }}>₹{p.price}</div>
                        </div>
                        <button onClick={() => openEditPortion(p, idx)} style={{ background: theme.bgWarm, border: '1px solid ' + theme.border, borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: theme.textMid }}>Edit</button>
                        <button onClick={() => deletePortion(p, idx)} style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer', color: '#B91C1C' }}>🗑</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={() => setShowItemForm(false)} style={{ flex: 1, background: theme.bgWarm, border: '1px solid ' + theme.border, borderRadius: 9, padding: '12px', fontSize: 13, cursor: 'pointer', fontWeight: 600, color: theme.textMid }}>Cancel</button>
              <button onClick={saveItem} disabled={saving} style={{ flex: 2, background: '#092b33', color: '#fff', border: 'none', borderRadius: 9, padding: '12px', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : editItem ? 'Save Changes' : 'Add Item'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Portion Form Modal ── */}
      {showPortionForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: 380, boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: theme.textDark, margin: '0 0 18px' }}>{editPortionIdx !== null ? 'Edit Portion' : 'Add Portion'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>Portion Name *</label>
                <input autoFocus value={portionForm.name} onChange={e => setPortionForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Half, Full, Regular, Large"
                  style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>Value</label>
                  <input type="number" value={portionForm.value} onChange={e => setPortionForm(f => ({ ...f, value: e.target.value }))} placeholder="e.g. 500, 1, 6"
                    style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>Unit</label>
                  <select value={portionForm.unit} onChange={e => setPortionForm(f => ({ ...f, unit: e.target.value }))}
                    style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', background: '#fff', color: theme.textDark }}>
                    {UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>Price (₹) *</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: theme.textLight, fontWeight: 700 }}>₹</span>
                  <input type="number" value={portionForm.price} onChange={e => setPortionForm(f => ({ ...f, price: e.target.value }))} placeholder="0"
                    style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 8, padding: '9px 12px 9px 26px', fontSize: 14, fontWeight: 700, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              {/* Preview */}
              {portionForm.name && (
                <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#15803D', fontWeight: 600 }}>
                  Preview: {portionForm.name}{portionForm.value ? ` · ${portionForm.value}${portionForm.unit || ''}` : ''} — ₹{portionForm.price || '0'}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowPortionForm(false)} style={{ flex: 1, background: theme.bgWarm, border: '1px solid ' + theme.border, borderRadius: 8, padding: '11px', fontSize: 13, cursor: 'pointer', fontWeight: 600, color: theme.textMid }}>Cancel</button>
              <button onClick={savePortion} disabled={savingPortion} style={{ flex: 2, background: '#092b33', color: '#fff', border: 'none', borderRadius: 8, padding: '11px', fontSize: 13, fontWeight: 700, cursor: savingPortion ? 'not-allowed' : 'pointer' }}>
                {savingPortion ? 'Saving...' : editPortionIdx !== null ? 'Save Portion' : 'Add Portion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}