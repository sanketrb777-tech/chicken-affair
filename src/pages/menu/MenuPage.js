import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { theme } from '../../lib/theme'

const FOOD_TYPE = {
  veg:     { label: 'Veg',     color: '#15803D', bg: '#DCFCE7', border: '#86EFAC' },
  non_veg: { label: 'Non-Veg', color: '#B91C1C', bg: '#FEE2E2', border: '#FCA5A5' },
  egg:     { label: 'Egg',     color: '#B45309', bg: '#FEF3C7', border: '#FCD34D' },
}

export default function MenuPage() {
  const [categories, setCategories]       = useState([])
  const [items, setItems]                 = useState([])
  const [activeCategory, setActiveCategory] = useState(null)
  const [loading, setLoading]             = useState(true)

  const [showCatForm, setShowCatForm]     = useState(false)
  const [showItemForm, setShowItemForm]   = useState(false)
  const [editCat, setEditCat]             = useState(null)
  const [editItem, setEditItem]           = useState(null)
  const [saving, setSaving]               = useState(false)

  const [catForm, setCatForm]   = useState({ name: '', sort_order: 0 })
  const [itemForm, setItemForm] = useState({ name: '', price: '', description: '', food_type: 'veg', is_available: true, sort_order: 0 })

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const { data: cats }  = await supabase.from('menu_categories').select('*').eq('is_active', true).order('sort_order')
    const { data: menuItems } = await supabase.from('menu_items').select('*').order('sort_order')
    setCategories(cats || [])
    setItems(menuItems || [])
    if (cats && cats.length > 0 && !activeCategory) setActiveCategory(cats[0].id)
    setLoading(false)
  }

  // ── Category actions ──
  function openAddCat() {
    setCatForm({ name: '', sort_order: categories.length })
    setEditCat(null)
    setShowCatForm(true)
  }

  function openEditCat(cat) {
    setCatForm({ name: cat.name, sort_order: cat.sort_order })
    setEditCat(cat)
    setShowCatForm(true)
  }

  async function saveCat() {
    if (!catForm.name.trim()) return alert('Category name is required')
    setSaving(true)
    try {
      if (editCat) {
        await supabase.from('menu_categories').update({ name: catForm.name, sort_order: parseInt(catForm.sort_order) }).eq('id', editCat.id)
      } else {
        await supabase.from('menu_categories').insert({ name: catForm.name, sort_order: parseInt(catForm.sort_order), is_active: true })
      }
      setShowCatForm(false)
      fetchAll()
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

  async function toggleCat(cat) {
    await supabase.from('menu_categories').update({ is_active: !cat.is_active }).eq('id', cat.id)
    fetchAll()
  }

  // ── Item actions ──
  function openAddItem() {
    setItemForm({ name: '', price: '', description: '', food_type: 'veg', is_available: true, sort_order: items.filter(i => i.category_id === activeCategory).length })
    setEditItem(null)
    setShowItemForm(true)
  }

  function openEditItem(item) {
    setItemForm({ name: item.name, price: item.price, description: item.description || '', food_type: item.food_type || 'veg', is_available: item.is_available, sort_order: item.sort_order })
    setEditItem(item)
    setShowItemForm(true)
  }

  async function saveItem() {
    if (!itemForm.name.trim()) return alert('Item name is required')
    if (!itemForm.price) return alert('Price is required')
    setSaving(true)
    try {
      if (editItem) {
        await supabase.from('menu_items').update({
          name: itemForm.name, price: parseFloat(itemForm.price),
          description: itemForm.description || null, food_type: itemForm.food_type,
          is_available: itemForm.is_available, sort_order: parseInt(itemForm.sort_order)
        }).eq('id', editItem.id)
      } else {
        await supabase.from('menu_items').insert({
          name: itemForm.name, price: parseFloat(itemForm.price),
          description: itemForm.description || null, food_type: itemForm.food_type,
          is_available: itemForm.is_available, sort_order: parseInt(itemForm.sort_order),
          category_id: activeCategory
        })
      }
      setShowItemForm(false)
      fetchAll()
    } finally { setSaving(false) }
  }

  async function deleteItem(id) {
    if (!window.confirm('Delete this item?')) return
    await supabase.from('menu_items').delete().eq('id', id)
    fetchAll()
  }

  async function toggleItem(item) {
    await supabase.from('menu_items').update({ is_available: !item.is_available }).eq('id', item.id)
    fetchAll()
  }

  const activeItems = items.filter(i => i.category_id === activeCategory)
  const activeCat   = categories.find(c => c.id === activeCategory)

  if (loading) return <div style={{ padding: 40, color: theme.textLight }}>Loading menu...</div>

  return (
    <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 112px)' }}>

      {/* ── LEFT: Categories ── */}
      <div style={{ width: 220, display: 'flex', flexDirection: 'column', gap: 0, background: '#fff', borderRadius: 14, border: '1px solid ' + theme.border, overflow: 'hidden' }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid ' + theme.border, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: theme.textDark }}>Categories</div>
          <button onClick={openAddCat}
            style={{ background: '#092b33', color: '#fff', border: 'none', borderRadius: 6, width: 26, height: 26, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>+</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {categories.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: theme.textMuted, fontSize: 12 }}>No categories yet</div>
          )}
          {categories.map(cat => {
            const catItemCount = items.filter(i => i.category_id === cat.id).length
            const isActive = activeCategory === cat.id
            return (
              <div key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                style={{ padding: '12px 16px', cursor: 'pointer', background: isActive ? '#092b33' : 'transparent', borderBottom: '1px solid ' + theme.bgWarm, transition: 'background 0.15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: isActive ? '#fff' : theme.textDark }}>{cat.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, background: isActive ? 'rgba(255,255,255,0.15)' : theme.bgWarm, color: isActive ? '#fff' : theme.textLight, padding: '2px 7px', borderRadius: 10, fontWeight: 700 }}>
                      {catItemCount}
                    </span>
                    {!isActive && (
                      <button onClick={e => { e.stopPropagation(); openEditCat(cat) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.textMuted, fontSize: 12, padding: 2 }}>✏️</button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── RIGHT: Items ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Items header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: theme.textDark, margin: 0 }}>
              {activeCat ? activeCat.name : 'Menu'}
            </h1>
            <p style={{ color: theme.textLight, fontSize: 13, marginTop: 3 }}>
              {activeItems.length} item{activeItems.length !== 1 ? 's' : ''}
              {activeCat && (
                <>
                  <span style={{ margin: '0 8px', color: theme.border }}>·</span>
                  <span onClick={() => openEditCat(activeCat)} style={{ color: theme.primary, cursor: 'pointer', fontWeight: 600 }}>Edit category</span>
                  <span style={{ margin: '0 8px', color: theme.border }}>·</span>
                  <span onClick={() => deleteCat(activeCat.id)} style={{ color: theme.red, cursor: 'pointer', fontWeight: 600 }}>Delete</span>
                </>
              )}
            </p>
          </div>
          <button onClick={openAddItem} disabled={!activeCategory}
            style={{ background: '#092b33', color: '#fff', border: 'none', borderRadius: 9, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: activeCategory ? 'pointer' : 'not-allowed', opacity: activeCategory ? 1 : 0.5 }}>
            + Add Item
          </button>
        </div>

        {/* Items list */}
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
                const ft = FOOD_TYPE[item.food_type] || FOOD_TYPE.veg
                return (
                  <div key={item.id} style={{ background: '#fff', borderRadius: 12, padding: '14px 18px', border: '1px solid ' + theme.border, display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', opacity: item.is_available ? 1 : 0.55 }}>
                    {/* Veg/non-veg dot */}
                    <div style={{ width: 12, height: 12, borderRadius: 3, border: '2px solid ' + ft.color, background: ft.color, flexShrink: 0 }} />

                    {/* Name + description */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: theme.textDark }}>{item.name}</div>
                      {item.description && <div style={{ fontSize: 12, color: theme.textLight, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.description}</div>}
                    </div>

                    {/* Food type badge */}
                    <span style={{ background: ft.bg, color: ft.color, border: '1px solid ' + ft.border, padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                      {ft.label}
                    </span>

                    {/* Price */}
                    <div style={{ fontWeight: 800, fontSize: 15, color: theme.textDark, minWidth: 60, textAlign: 'right' }}>₹{item.price}</div>

                    {/* Availability toggle */}
                    <div onClick={() => toggleItem(item)}
                      style={{ background: item.is_available ? '#DCFCE7' : theme.bgWarm, color: item.is_available ? '#15803D' : theme.textMuted, border: '1px solid ' + (item.is_available ? '#86EFAC' : theme.border), padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                      {item.is_available ? 'Available' : 'Off'}
                    </div>

                    {/* Edit */}
                    <button onClick={() => openEditItem(item)}
                      style={{ background: theme.bgWarm, border: '1px solid ' + theme.border, borderRadius: 7, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: theme.textMid, flexShrink: 0 }}>
                      Edit
                    </button>

                    {/* Delete */}
                    <button onClick={() => deleteItem(item.id)}
                      style={{ background: theme.redBg, border: '1px solid #FECACA', borderRadius: 7, padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: theme.red, flexShrink: 0 }}>
                      🗑
                    </button>
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
            <h2 style={{ fontSize: 18, fontWeight: 800, color: theme.textDark, margin: '0 0 20px' }}>
              {editCat ? 'Edit Category' : 'Add Category'}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Category Name *</label>
                <input autoFocus value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Starters, Main Course, Beverages"
                  style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 9, padding: '10px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={() => setShowCatForm(false)}
                style={{ flex: 1, background: theme.bgWarm, border: '1px solid ' + theme.border, borderRadius: 9, padding: '12px', fontSize: 13, cursor: 'pointer', fontWeight: 600, color: theme.textMid }}>
                Cancel
              </button>
              <button onClick={saveCat} disabled={saving}
                style={{ flex: 2, background: '#092b33', color: '#fff', border: 'none', borderRadius: 9, padding: '12px', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving...' : editCat ? 'Save Changes' : 'Add Category'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Item Modal ── */}
      {showItemForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 18, padding: 32, width: 420, boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: theme.textDark, margin: '0 0 20px' }}>
              {editItem ? 'Edit Item' : 'Add Item'}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Item Name *</label>
                <input autoFocus value={itemForm.name} onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Paneer Tikka"
                  style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 9, padding: '10px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Price (₹) *</label>
                  <input type="number" value={itemForm.price} onChange={e => setItemForm(f => ({ ...f, price: e.target.value }))}
                    placeholder="0"
                    style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 9, padding: '10px 12px', fontSize: 14, fontWeight: 700, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Availability</label>
                  <button onClick={() => setItemForm(f => ({ ...f, is_available: !f.is_available }))}
                    style={{ width: '100%', background: itemForm.is_available ? '#DCFCE7' : theme.bgWarm, color: itemForm.is_available ? '#15803D' : theme.textMid, border: '1.5px solid ' + (itemForm.is_available ? '#86EFAC' : theme.border), borderRadius: 9, padding: '10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    {itemForm.is_available ? '✓ Available' : '✗ Unavailable'}
                  </button>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Description <span style={{ fontWeight: 400 }}>(optional)</span></label>
                <input value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Short description for the item"
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
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={() => setShowItemForm(false)}
                style={{ flex: 1, background: theme.bgWarm, border: '1px solid ' + theme.border, borderRadius: 9, padding: '12px', fontSize: 13, cursor: 'pointer', fontWeight: 600, color: theme.textMid }}>
                Cancel
              </button>
              <button onClick={saveItem} disabled={saving}
                style={{ flex: 2, background: '#092b33', color: '#fff', border: 'none', borderRadius: 9, padding: '12px', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving...' : editItem ? 'Save Changes' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}