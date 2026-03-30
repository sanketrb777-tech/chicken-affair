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
  { value: '', label: 'No unit' }, { value: 'ml', label: 'ml' }, { value: 'L', label: 'L (Litre)' },
  { value: 'g', label: 'g (gram)' }, { value: 'kg', label: 'kg' }, { value: 'oz', label: 'oz' },
  { value: 'lb', label: 'lb' }, { value: 'inches', label: 'inches' }, { value: 'cm', label: 'cm' },
  { value: 'pcs', label: 'pcs' }, { value: 'slice', label: 'slice' }, { value: 'plate', label: 'plate' }, { value: 'cup', label: 'cup' },
]
const EMPTY_PORTION = { name: '', unit: '', value: '', price: '' }

export default function MenuPage() {
  const { profile } = useAuth()
  const isManager = profile?.role === 'owner' || profile?.role === 'manager'

  const [categories, setCategories]   = useState([])
  const [items, setItems]             = useState([])
  const [portions, setPortions]       = useState({})
  const [variations, setVariations]   = useState({})   // itemId -> variations[]
  const [addonGroups, setAddonGroups] = useState({})   // itemId -> groups[] (each with addons[])
  const [activeCategory, setActiveCategory] = useState(null)
  const [loading, setLoading]         = useState(true)

  const [showCatForm, setShowCatForm]   = useState(false)
  const [showItemForm, setShowItemForm] = useState(false)
  const [editCat, setEditCat]     = useState(null)
  const [editItem, setEditItem]   = useState(null)
  const [saving, setSaving]       = useState(false)
  const [toggling, setToggling]   = useState(null)

  const [catForm, setCatForm]   = useState({ name: '', sort_order: 0 })
  const [itemForm, setItemForm] = useState({
    name: '', price: '', description: '', food_type: 'veg',
    is_available: true, sort_order: 0, gst_rate: 5, priority: 2,
    available_from: '', available_until: ''
  })

  // Portions
  const [portionList, setPortionList]     = useState([])
  const [portionForm, setPortionForm]     = useState(EMPTY_PORTION)
  const [editPortionIdx, setEditPortionIdx] = useState(null)
  const [showPortionForm, setShowPortionForm] = useState(false)
  const [savingPortion, setSavingPortion] = useState(false)

  // Variations
  const [variationList, setVariationList]     = useState([])
  const [showVariationForm, setShowVariationForm] = useState(false)
  const [editVariationIdx, setEditVariationIdx]   = useState(null)
  const [variationForm, setVariationForm]         = useState({ name: '', price: '' })
  const [savingVariation, setSavingVariation]     = useState(false)

  // Add-on groups
  const [addonGroupList, setAddonGroupList]     = useState([])   // [{id, name, min_select, max_select, addons:[]}]
  const [showAddonGroupForm, setShowAddonGroupForm] = useState(false)
  const [editAddonGroupIdx, setEditAddonGroupIdx]   = useState(null)
  const [addonGroupForm, setAddonGroupForm]         = useState({ name: '', min_select: 0, max_select: 1 })
  const [savingAddonGroup, setSavingAddonGroup]     = useState(false)
  // Add-on items
  const [showAddonItemForm, setShowAddonItemForm] = useState(false)
  const [editAddonItemIdx, setEditAddonItemIdx]   = useState(null)
  const [addonItemGroupIdx, setAddonItemGroupIdx] = useState(null)
  const [addonItemForm, setAddonItemForm]         = useState({ name: '', price: '' })
  const [savingAddonItem, setSavingAddonItem]     = useState(false)

  // Drag
  const dragIndex     = useRef(null)
  const dragOverIndex = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [dragOver, setDragOver] = useState(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    const [{ data: cats }, { data: menuItems }, { data: allPortions }, { data: allVariations }, { data: allAddonGroups }, { data: allAddons }] = await Promise.all([
      supabase.from('menu_categories').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('menu_items').select('*').order('sort_order'),
      supabase.from('item_portions').select('*').eq('is_available', true).order('sort_order'),
      supabase.from('item_variations').select('*').eq('is_available', true).order('sort_order'),
      supabase.from('item_addon_groups').select('*').order('sort_order'),
      supabase.from('item_addons').select('*').eq('is_available', true).order('sort_order'),
    ])
    setCategories(cats || [])
    setItems(menuItems || [])

    const portionMap = {}
    ;(allPortions || []).forEach(p => { if (!portionMap[p.menu_item_id]) portionMap[p.menu_item_id] = []; portionMap[p.menu_item_id].push(p) })
    setPortions(portionMap)

    const varMap = {}
    ;(allVariations || []).forEach(v => { if (!varMap[v.menu_item_id]) varMap[v.menu_item_id] = []; varMap[v.menu_item_id].push(v) })
    setVariations(varMap)

    const groupMap = {}
    const addonsByGroup = {}
    ;(allAddons || []).forEach(a => { if (!addonsByGroup[a.group_id]) addonsByGroup[a.group_id] = []; addonsByGroup[a.group_id].push(a) })
    ;(allAddonGroups || []).forEach(g => {
      if (!groupMap[g.menu_item_id]) groupMap[g.menu_item_id] = []
      groupMap[g.menu_item_id].push({ ...g, addons: addonsByGroup[g.id] || [] })
    })
    setAddonGroups(groupMap)

    if (cats && cats.length > 0 && !activeCategory) setActiveCategory(cats[0].id)
    setLoading(false)
  }

  // ── Drag ──
  function handleDragStart(e, idx) {
    dragIndex.current = idx; setDragging(true); e.dataTransfer.effectAllowed = 'move'
    const ghost = e.currentTarget.cloneNode(true); ghost.style.opacity = '0.01'; ghost.style.position = 'absolute'; ghost.style.top = '-1000px'
    document.body.appendChild(ghost); e.dataTransfer.setDragImage(ghost, 0, 0); setTimeout(() => document.body.removeChild(ghost), 0)
  }
  function handleDragEnter(idx) { if (dragIndex.current === idx) return; dragOverIndex.current = idx; setDragOver(idx) }
  function handleDragEnd() {
    setDragging(false); setDragOver(null)
    if (dragIndex.current === null || dragOverIndex.current === null || dragIndex.current === dragOverIndex.current) { dragIndex.current = null; dragOverIndex.current = null; return }
    const reordered = [...categories]; const [moved] = reordered.splice(dragIndex.current, 1); reordered.splice(dragOverIndex.current, 0, moved)
    dragIndex.current = null; dragOverIndex.current = null; setCategories(reordered)
    Promise.all(reordered.map((cat, idx) => supabase.from('menu_categories').update({ sort_order: idx }).eq('id', cat.id)))
  }

  // ── Category actions ──
  function openAddCat() { setCatForm({ name: '', sort_order: categories.length }); setEditCat(null); setShowCatForm(true) }
  function openEditCat(cat) { setCatForm({ name: cat.name, sort_order: cat.sort_order }); setEditCat(cat); setShowCatForm(true) }
  async function saveCat() {
    if (!catForm.name.trim()) return alert('Category name is required'); setSaving(true)
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
    setItemForm({ name: '', price: '', description: '', food_type: 'veg', is_available: true, sort_order: items.filter(i => i.category_id === activeCategory).length, gst_rate: 5, priority: 2, available_from: '', available_until: '' })
    setPortionList([]); setVariationList([]); setAddonGroupList([])
    setEditItem(null); setShowItemForm(true)
  }
  function openEditItem(item) {
    setItemForm({ name: item.name, price: item.price, description: item.description || '', food_type: item.food_type || 'veg', is_available: item.is_available, sort_order: item.sort_order, gst_rate: item.gst_rate ?? 5, priority: item.priority ?? 2, available_from: item.available_from || '', available_until: item.available_until || '' })
    setPortionList(portions[item.id] || [])
    setVariationList(variations[item.id] || [])
    setAddonGroupList(addonGroups[item.id] || [])
    setEditItem(item); setShowItemForm(true)
  }
  async function saveItem() {
    if (!itemForm.name.trim()) return alert('Item name is required')
    if (!itemForm.price) return alert('Price is required')
    setSaving(true)
    try {
      const payload = { name: itemForm.name, price: parseFloat(itemForm.price), description: itemForm.description || null, food_type: itemForm.food_type, is_available: itemForm.is_available, sort_order: parseInt(itemForm.sort_order), gst_rate: parseFloat(itemForm.gst_rate), priority: parseInt(itemForm.priority), available_from: itemForm.available_from || null, available_until: itemForm.available_until || null }
      let itemId = editItem?.id
      if (editItem) await supabase.from('menu_items').update(payload).eq('id', editItem.id)
      else { const { data } = await supabase.from('menu_items').insert({ ...payload, category_id: activeCategory }).select().single(); itemId = data?.id }
      setShowItemForm(false); fetchAll()
    } finally { setSaving(false) }
  }
  async function deleteItem(id) {
    if (!window.confirm('Delete this item?')) return
    await supabase.from('menu_items').delete().eq('id', id); fetchAll()
  }
  async function toggleAvailability(item) {
    if (!isManager) return; setToggling(item.id)
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
      const portionPayload = { menu_item_id: editItem?.id || null, name: portionForm.name.trim(), unit: portionForm.unit || '', value: parseFloat(portionForm.value) || 0, price: parseFloat(portionForm.price), sort_order: editPortionIdx !== null ? portionList[editPortionIdx].sort_order : portionList.length, is_available: true }
      if (editItem?.id) {
        if (editPortionIdx !== null && portionList[editPortionIdx]?.id) {
          await supabase.from('item_portions').update({ name: portionPayload.name, unit: portionPayload.unit, value: portionPayload.value, price: portionPayload.price }).eq('id', portionList[editPortionIdx].id)
          setPortionList(prev => prev.map((p, i) => i === editPortionIdx ? { ...p, ...portionPayload } : p))
        } else { const { data } = await supabase.from('item_portions').insert(portionPayload).select().single(); setPortionList(prev => [...prev, data]) }
      } else {
        if (editPortionIdx !== null) setPortionList(prev => prev.map((p, i) => i === editPortionIdx ? { ...portionPayload } : p))
        else setPortionList(prev => [...prev, portionPayload])
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
  function formatPortion(p) { if (!p.unit && !p.value) return p.name; if (!p.unit) return p.name; return `${p.name} · ${p.value}${p.unit}` }

  // ── Variation actions ──
  function openAddVariation() { setVariationForm({ name: '', price: '' }); setEditVariationIdx(null); setShowVariationForm(true) }
  function openEditVariation(v, idx) { setVariationForm({ name: v.name, price: v.price }); setEditVariationIdx(idx); setShowVariationForm(true) }
  async function saveVariation() {
    if (!variationForm.name.trim()) return alert('Variation name is required')
    if (!variationForm.price) return alert('Price is required')
    setSavingVariation(true)
    try {
      const vPayload = { menu_item_id: editItem?.id || null, name: variationForm.name.trim(), price: parseFloat(variationForm.price), sort_order: editVariationIdx !== null ? variationList[editVariationIdx]?.sort_order ?? variationList.length : variationList.length, is_available: true }
      if (editItem?.id) {
        if (editVariationIdx !== null && variationList[editVariationIdx]?.id) {
          await supabase.from('item_variations').update({ name: vPayload.name, price: vPayload.price }).eq('id', variationList[editVariationIdx].id)
          setVariationList(prev => prev.map((v, i) => i === editVariationIdx ? { ...v, name: vPayload.name, price: vPayload.price } : v))
        } else { const { data } = await supabase.from('item_variations').insert(vPayload).select().single(); setVariationList(prev => [...prev, data]) }
      } else {
        if (editVariationIdx !== null) setVariationList(prev => prev.map((v, i) => i === editVariationIdx ? { ...v, ...vPayload } : v))
        else setVariationList(prev => [...prev, { ...vPayload, id: null }])
      }
      setShowVariationForm(false)
    } finally { setSavingVariation(false) }
  }
  async function deleteVariation(v, idx) {
    if (!window.confirm('Delete this variation?')) return
    if (v.id) await supabase.from('item_variations').delete().eq('id', v.id)
    setVariationList(prev => prev.filter((_, i) => i !== idx))
  }

  // ── Add-on Group actions ──
  function openAddAddonGroup() { setAddonGroupForm({ name: '', min_select: 0, max_select: 1 }); setEditAddonGroupIdx(null); setShowAddonGroupForm(true) }
  function openEditAddonGroup(g, idx) { setAddonGroupForm({ name: g.name, min_select: g.min_select, max_select: g.max_select }); setEditAddonGroupIdx(idx); setShowAddonGroupForm(true) }
  async function saveAddonGroup() {
    if (!addonGroupForm.name.trim()) return alert('Group name is required')
    setSavingAddonGroup(true)
    try {
      const gPayload = { menu_item_id: editItem?.id || null, name: addonGroupForm.name.trim(), min_select: parseInt(addonGroupForm.min_select) || 0, max_select: parseInt(addonGroupForm.max_select) || 1, sort_order: editAddonGroupIdx !== null ? addonGroupList[editAddonGroupIdx]?.sort_order ?? addonGroupList.length : addonGroupList.length }
      if (editItem?.id) {
        if (editAddonGroupIdx !== null && addonGroupList[editAddonGroupIdx]?.id) {
          await supabase.from('item_addon_groups').update({ name: gPayload.name, min_select: gPayload.min_select, max_select: gPayload.max_select }).eq('id', addonGroupList[editAddonGroupIdx].id)
          setAddonGroupList(prev => prev.map((g, i) => i === editAddonGroupIdx ? { ...g, name: gPayload.name, min_select: gPayload.min_select, max_select: gPayload.max_select } : g))
        } else { const { data } = await supabase.from('item_addon_groups').insert(gPayload).select().single(); setAddonGroupList(prev => [...prev, { ...data, addons: [] }]) }
      } else {
        if (editAddonGroupIdx !== null) setAddonGroupList(prev => prev.map((g, i) => i === editAddonGroupIdx ? { ...g, ...gPayload } : g))
        else setAddonGroupList(prev => [...prev, { ...gPayload, id: null, addons: [] }])
      }
      setShowAddonGroupForm(false)
    } finally { setSavingAddonGroup(false) }
  }
  async function deleteAddonGroup(g, idx) {
    if (!window.confirm('Delete this add-on group and all its items?')) return
    if (g.id) await supabase.from('item_addon_groups').delete().eq('id', g.id)
    setAddonGroupList(prev => prev.filter((_, i) => i !== idx))
  }

  // ── Add-on Item actions ──
  function openAddAddonItem(groupIdx) { setAddonItemForm({ name: '', price: '' }); setAddonItemGroupIdx(groupIdx); setEditAddonItemIdx(null); setShowAddonItemForm(true) }
  function openEditAddonItem(item, itemIdx, groupIdx) { setAddonItemForm({ name: item.name, price: item.price }); setAddonItemGroupIdx(groupIdx); setEditAddonItemIdx(itemIdx); setShowAddonItemForm(true) }
  async function saveAddonItem() {
    if (!addonItemForm.name.trim()) return alert('Add-on name is required')
    setSavingAddonItem(true)
    try {
      const group = addonGroupList[addonItemGroupIdx]
      const aPayload = { group_id: group?.id || null, name: addonItemForm.name.trim(), price: parseFloat(addonItemForm.price) || 0, sort_order: editAddonItemIdx !== null ? group.addons[editAddonItemIdx]?.sort_order ?? group.addons.length : group.addons.length, is_available: true }
      if (group?.id) {
        if (editAddonItemIdx !== null && group.addons[editAddonItemIdx]?.id) {
          await supabase.from('item_addons').update({ name: aPayload.name, price: aPayload.price }).eq('id', group.addons[editAddonItemIdx].id)
          setAddonGroupList(prev => prev.map((g, gi) => gi === addonItemGroupIdx ? { ...g, addons: g.addons.map((a, ai) => ai === editAddonItemIdx ? { ...a, name: aPayload.name, price: aPayload.price } : a) } : g))
        } else { const { data } = await supabase.from('item_addons').insert(aPayload).select().single(); setAddonGroupList(prev => prev.map((g, gi) => gi === addonItemGroupIdx ? { ...g, addons: [...g.addons, data] } : g)) }
      } else {
        setAddonGroupList(prev => prev.map((g, gi) => gi === addonItemGroupIdx ? { ...g, addons: editAddonItemIdx !== null ? g.addons.map((a, ai) => ai === editAddonItemIdx ? { ...a, ...aPayload } : a) : [...g.addons, { ...aPayload, id: null }] } : g))
      }
      setShowAddonItemForm(false)
    } finally { setSavingAddonItem(false) }
  }
  async function deleteAddonItem(item, itemIdx, groupIdx) {
    if (!window.confirm('Delete this add-on?')) return
    if (item.id) await supabase.from('item_addons').delete().eq('id', item.id)
    setAddonGroupList(prev => prev.map((g, gi) => gi === groupIdx ? { ...g, addons: g.addons.filter((_, i) => i !== itemIdx) } : g))
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
            const isActive = activeCategory === cat.id; const isDragOver = dragOver === idx; const isDragging = dragging && dragIndex.current === idx
            return (
              <div key={cat.id} draggable onDragStart={e => handleDragStart(e, idx)} onDragEnter={() => handleDragEnter(idx)} onDragOver={e => e.preventDefault()} onDragEnd={handleDragEnd} onClick={() => setActiveCategory(cat.id)}
                style={{ padding: '11px 12px', cursor: 'grab', background: isActive ? '#092b33' : isDragOver ? '#E6F0FF' : 'transparent', borderBottom: '1px solid ' + (isDragOver ? '#3B82F6' : theme.bgWarm), borderTop: isDragOver ? '2px solid #3B82F6' : '2px solid transparent', opacity: isDragging ? 0.4 : 1, userSelect: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: isActive ? 'rgba(255,255,255,0.4)' : theme.textMuted, fontSize: 14, flexShrink: 0 }}>⠿</span>
                  <span style={{ fontSize: 9, fontWeight: 800, background: isActive ? 'rgba(255,255,255,0.15)' : '#F1F5F9', color: isActive ? '#fff' : theme.textMuted, padding: '1px 5px', borderRadius: 4, flexShrink: 0 }}>#{idx + 1}</span>
                  <div style={{ fontWeight: 700, fontSize: 13, color: isActive ? '#fff' : theme.textDark, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.name}</div>
                  <span style={{ fontSize: 10, background: isActive ? 'rgba(255,255,255,0.15)' : theme.bgWarm, color: isActive ? '#fff' : theme.textLight, padding: '2px 6px', borderRadius: 10, fontWeight: 700 }}>{items.filter(i => i.category_id === cat.id).length}</span>
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
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activeItems.map(item => {
                const ft = FOOD_TYPE[item.food_type] || FOOD_TYPE.veg
                const pri = PRIORITY_CONFIG[item.priority ?? 2]
                const isOn = item.is_available
                const itemPortions = portions[item.id] || []
                const itemVariations = variations[item.id] || []
                const itemAddonGroups = addonGroups[item.id] || []
                return (
                  <div key={item.id} style={{ background: isOn ? '#fff' : '#FAFAFA', borderRadius: 12, padding: '12px 16px', border: '1px solid ' + (isOn ? theme.border : '#FECACA'), display: 'flex', alignItems: 'center', gap: 12, opacity: isOn ? 1 : 0.75 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, border: '2px solid ' + ft.color, background: ft.color, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: isOn ? theme.textDark : theme.textLight, textDecoration: isOn ? 'none' : 'line-through' }}>{item.name}</div>
                        {!isOn && <span style={{ fontSize: 10, fontWeight: 800, background: '#FEE2E2', color: '#B91C1C', padding: '2px 7px', borderRadius: 10 }}>OUT OF STOCK</span>}
                        {(item.available_from || item.available_until) && <span style={{ fontSize: 10, fontWeight: 700, background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', padding: '2px 7px', borderRadius: 10 }}>🕐 {item.available_from?.slice(0,5)||'00:00'} – {item.available_until?.slice(0,5)||'23:59'}</span>}
                        {itemVariations.length > 0 && <span style={{ fontSize: 10, fontWeight: 700, background: '#F5F3FF', color: '#5B21B6', border: '1px solid #C4B5FD', padding: '2px 7px', borderRadius: 10 }}>⚙ {itemVariations.length} variation{itemVariations.length!==1?'s':''}</span>}
                        {itemAddonGroups.length > 0 && <span style={{ fontSize: 10, fontWeight: 700, background: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA', padding: '2px 7px', borderRadius: 10 }}>+ {itemAddonGroups.length} add-on group{itemAddonGroups.length!==1?'s':''}</span>}
                      </div>
                      {item.description && <div style={{ fontSize: 12, color: theme.textLight, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.description}</div>}
                      {itemPortions.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                          {itemPortions.map(p => <span key={p.id} style={{ background: '#F0FDF4', color: '#15803D', border: '1px solid #86EFAC', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10 }}>{formatPortion(p)} · ₹{p.price}</span>)}
                        </div>
                      )}
                    </div>
                    <span style={{ background: pri.bg, color: pri.color, border: '1px solid ' + pri.border, padding: '3px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{pri.label}</span>
                    <span style={{ background: ft.bg, color: ft.color, border: '1px solid ' + ft.border, padding: '3px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{ft.label}</span>
                    <div style={{ fontWeight: 800, fontSize: 15, color: theme.textDark, minWidth: 60, textAlign: 'right' }}>{itemPortions.length > 0 || itemVariations.length > 0 ? <span style={{ fontSize: 11, color: theme.textLight }}>see options</span> : `₹${item.price}`}</div>
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
          <div style={{ background: '#fff', borderRadius: 18, padding: 32, width: 560, maxHeight: '94vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: theme.textDark, margin: '0 0 20px' }}>{editItem ? 'Edit Item' : 'Add Item'}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Basic fields */}
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
                  <div style={{ fontSize: 10, color: theme.textLight, marginTop: 3 }}>Used when no variations/portions defined</div>
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
                <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>Kitchen Priority</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[1,2,3].map(p => { const cfg = PRIORITY_CONFIG[p]; const sel = parseInt(itemForm.priority) === p; return (
                    <button key={p} onClick={() => setItemForm(f => ({ ...f, priority: p }))}
                      style={{ flex: 1, background: sel ? cfg.bg : theme.bgWarm, color: sel ? cfg.color : theme.textMid, border: '1.5px solid ' + (sel ? cfg.border : theme.border), borderRadius: 8, padding: '10px 8px', fontSize: 12, fontWeight: 700, cursor: 'pointer', textAlign: 'center' }}>
                      <div style={{ fontSize: 15, fontWeight: 900 }}>P{p}</div>
                      <div style={{ fontSize: 10 }}>{p===1?'High':p===2?'Normal':'Low'}</div>
                    </button>
                  )})}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>GST Rate (%)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[0,5,12,18].map(rate => (
                    <button key={rate} onClick={() => setItemForm(f => ({ ...f, gst_rate: rate }))}
                      style={{ flex: 1, background: itemForm.gst_rate === rate ? '#092b33' : theme.bgWarm, color: itemForm.gst_rate === rate ? '#fff' : theme.textMid, border: '1.5px solid ' + (itemForm.gst_rate === rate ? '#092b33' : theme.border), borderRadius: 8, padding: '8px 0', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      {rate}%
                    </button>
                  ))}
                </div>
              </div>

              {/* Availability Timing */}
              <div style={{ borderTop: '2px solid ' + theme.bgWarm, paddingTop: 16 }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: theme.textDark, marginBottom: 4 }}>Available Hours <span style={{ fontWeight: 400, fontSize: 11, color: theme.textLight }}>(optional)</span></div>
                <div style={{ fontSize: 11, color: theme.textLight, marginBottom: 10 }}>Leave blank to show all day</div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>From</label>
                    <input type="time" value={itemForm.available_from} onChange={e => setItemForm(f => ({ ...f, available_from: e.target.value }))}
                      style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 9, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: theme.textDark, background: itemForm.available_from ? '#EFF6FF' : '#fff' }} />
                  </div>
                  <div style={{ paddingTop: 18, color: theme.textLight, fontWeight: 700 }}>–</div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>Until</label>
                    <input type="time" value={itemForm.available_until} onChange={e => setItemForm(f => ({ ...f, available_until: e.target.value }))}
                      style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 9, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box', color: theme.textDark, background: itemForm.available_until ? '#EFF6FF' : '#fff' }} />
                  </div>
                  {(itemForm.available_from || itemForm.available_until) && (
                    <button onClick={() => setItemForm(f => ({ ...f, available_from: '', available_until: '' }))}
                      style={{ paddingTop: 18, background: 'none', border: 'none', color: theme.red, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>✕</button>
                  )}
                </div>
              </div>

              {/* ── VARIATIONS ── */}
              <div style={{ borderTop: '2px solid ' + theme.bgWarm, paddingTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13, color: theme.textDark }}>Variations</div>
                    <div style={{ fontSize: 11, color: theme.textLight, marginTop: 2 }}>e.g. Veg ₹500, Chicken ₹550 — customer must pick one</div>
                  </div>
                  <button onClick={openAddVariation} style={{ background: '#5B21B6', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ Add Variation</button>
                </div>
                {variationList.length === 0 ? (
                  <div style={{ background: theme.bgWarm, borderRadius: 10, padding: '10px 14px', fontSize: 12, color: theme.textLight, textAlign: 'center' }}>No variations — item ordered at base price</div>
                ) : (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {variationList.map((v, idx) => (
                      <div key={idx} style={{ background: '#F5F3FF', border: '1px solid #C4B5FD', borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#3B0764' }}>{v.name}</div>
                          <div style={{ fontSize: 11, color: '#5B21B6' }}>₹{v.price}</div>
                        </div>
                        <button onClick={() => openEditVariation(v, idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: theme.textMid }}>✏️</button>
                        <button onClick={() => deleteVariation(v, idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: theme.red }}>🗑</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── ADD-ON GROUPS ── */}
              <div style={{ borderTop: '2px solid ' + theme.bgWarm, paddingTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13, color: theme.textDark }}>Add-on Groups</div>
                    <div style={{ fontSize: 11, color: theme.textLight, marginTop: 2 }}>e.g. "Add Cheese" (max 1) — optional extras per item</div>
                  </div>
                  <button onClick={openAddAddonGroup} style={{ background: '#C2410C', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ Add Group</button>
                </div>
                {addonGroupList.length === 0 ? (
                  <div style={{ background: theme.bgWarm, borderRadius: 10, padding: '10px 14px', fontSize: 12, color: theme.textLight, textAlign: 'center' }}>No add-ons configured</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {addonGroupList.map((g, gi) => (
                      <div key={gi} style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div>
                            <span style={{ fontWeight: 700, fontSize: 13, color: '#7C2D12' }}>{g.name}</span>
                            <span style={{ fontSize: 11, color: '#C2410C', marginLeft: 8 }}>Min: {g.min_select} · Max: {g.max_select}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => openAddAddonItem(gi)} style={{ background: '#C2410C', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>+ Item</button>
                            <button onClick={() => openEditAddonGroup(g, gi)} style={{ background: theme.bgWarm, border: '1px solid ' + theme.border, borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer', color: theme.textMid }}>✏️</button>
                            <button onClick={() => deleteAddonGroup(g, gi)} style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer', color: theme.red }}>🗑</button>
                          </div>
                        </div>
                        {g.addons.length === 0 ? (
                          <div style={{ fontSize: 11, color: theme.textLight }}>No add-on items yet — click "+ Item" to add</div>
                        ) : (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {g.addons.map((a, ai) => (
                              <div key={ai} style={{ background: '#fff', border: '1px solid #FED7AA', borderRadius: 8, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 12, fontWeight: 600, color: '#7C2D12' }}>{a.name}</span>
                                {a.price > 0 && <span style={{ fontSize: 11, color: '#C2410C' }}>+₹{a.price}</span>}
                                <button onClick={() => openEditAddonItem(a, ai, gi)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: theme.textMid, padding: 0 }}>✏️</button>
                                <button onClick={() => deleteAddonItem(a, ai, gi)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: theme.red, padding: 0 }}>✕</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── PORTIONS ── */}
              <div style={{ borderTop: '2px solid ' + theme.bgWarm, paddingTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13, color: theme.textDark }}>Portions / Sizes</div>
                    <div style={{ fontSize: 11, color: theme.textLight, marginTop: 2 }}>e.g. Half, Full, 500ml — each with its own price</div>
                  </div>
                  <button onClick={openAddPortion} style={{ background: '#092b33', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ Add Portion</button>
                </div>
                {portionList.length === 0 ? (
                  <div style={{ background: theme.bgWarm, borderRadius: 10, padding: '10px 14px', fontSize: 12, color: theme.textLight, textAlign: 'center' }}>No portions — item ordered at base price</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {portionList.map((p, idx) => (
                      <div key={idx} style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: theme.textDark }}>{formatPortion(p)}</div>
                          <div style={{ fontSize: 11, color: '#15803D' }}>₹{p.price}</div>
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

      {/* ── Variation Form Modal ── */}
      {showVariationForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: 360, boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: theme.textDark, margin: '0 0 18px' }}>{editVariationIdx !== null ? 'Edit Variation' : 'Add Variation'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>Variation Name *</label>
                <input autoFocus value={variationForm.name} onChange={e => setVariationForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Veg, Chicken, Small, Large"
                  style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>Price (₹) *</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: theme.textLight, fontWeight: 700 }}>₹</span>
                  <input type="number" value={variationForm.price} onChange={e => setVariationForm(f => ({ ...f, price: e.target.value }))} placeholder="0"
                    style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 8, padding: '9px 12px 9px 26px', fontSize: 14, fontWeight: 700, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowVariationForm(false)} style={{ flex: 1, background: theme.bgWarm, border: '1px solid ' + theme.border, borderRadius: 8, padding: '11px', fontSize: 13, cursor: 'pointer', fontWeight: 600, color: theme.textMid }}>Cancel</button>
              <button onClick={saveVariation} disabled={savingVariation} style={{ flex: 2, background: '#5B21B6', color: '#fff', border: 'none', borderRadius: 8, padding: '11px', fontSize: 13, fontWeight: 700, cursor: savingVariation ? 'not-allowed' : 'pointer' }}>{savingVariation ? 'Saving...' : editVariationIdx !== null ? 'Save Variation' : 'Add Variation'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add-on Group Form Modal ── */}
      {showAddonGroupForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: 380, boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: theme.textDark, margin: '0 0 18px' }}>{editAddonGroupIdx !== null ? 'Edit Add-on Group' : 'Add Add-on Group'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>Group Name *</label>
                <input autoFocus value={addonGroupForm.name} onChange={e => setAddonGroupForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Add Cheese, Extra Toppings, Sauce"
                  style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>Min Select</label>
                  <input type="number" min="0" value={addonGroupForm.min_select} onChange={e => setAddonGroupForm(f => ({ ...f, min_select: e.target.value }))} placeholder="0"
                    style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                  <div style={{ fontSize: 10, color: theme.textLight, marginTop: 3 }}>0 = optional</div>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>Max Select</label>
                  <input type="number" min="1" value={addonGroupForm.max_select} onChange={e => setAddonGroupForm(f => ({ ...f, max_select: e.target.value }))} placeholder="1"
                    style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowAddonGroupForm(false)} style={{ flex: 1, background: theme.bgWarm, border: '1px solid ' + theme.border, borderRadius: 8, padding: '11px', fontSize: 13, cursor: 'pointer', fontWeight: 600, color: theme.textMid }}>Cancel</button>
              <button onClick={saveAddonGroup} disabled={savingAddonGroup} style={{ flex: 2, background: '#C2410C', color: '#fff', border: 'none', borderRadius: 8, padding: '11px', fontSize: 13, fontWeight: 700, cursor: savingAddonGroup ? 'not-allowed' : 'pointer' }}>{savingAddonGroup ? 'Saving...' : editAddonGroupIdx !== null ? 'Save Group' : 'Add Group'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add-on Item Form Modal ── */}
      {showAddonItemForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: 360, boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: theme.textDark, margin: '0 0 4px' }}>{editAddonItemIdx !== null ? 'Edit Add-on Item' : 'Add Add-on Item'}</h3>
            <div style={{ fontSize: 12, color: theme.textLight, marginBottom: 18 }}>Group: {addonGroupList[addonItemGroupIdx]?.name}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>Add-on Name *</label>
                <input autoFocus value={addonItemForm.name} onChange={e => setAddonItemForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Cheese, Extra Sauce, Mushroom"
                  style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 8, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>Extra Price (₹)</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: theme.textLight, fontWeight: 700 }}>+₹</span>
                  <input type="number" value={addonItemForm.price} onChange={e => setAddonItemForm(f => ({ ...f, price: e.target.value }))} placeholder="0"
                    style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 8, padding: '9px 12px 9px 32px', fontSize: 14, fontWeight: 700, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ fontSize: 10, color: theme.textLight, marginTop: 3 }}>Set 0 for no extra charge</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowAddonItemForm(false)} style={{ flex: 1, background: theme.bgWarm, border: '1px solid ' + theme.border, borderRadius: 8, padding: '11px', fontSize: 13, cursor: 'pointer', fontWeight: 600, color: theme.textMid }}>Cancel</button>
              <button onClick={saveAddonItem} disabled={savingAddonItem} style={{ flex: 2, background: '#C2410C', color: '#fff', border: 'none', borderRadius: 8, padding: '11px', fontSize: 13, fontWeight: 700, cursor: savingAddonItem ? 'not-allowed' : 'pointer' }}>{savingAddonItem ? 'Saving...' : editAddonItemIdx !== null ? 'Save Add-on' : 'Add to Group'}</button>
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
                  <input type="number" value={portionForm.value} onChange={e => setPortionForm(f => ({ ...f, value: e.target.value }))} placeholder="e.g. 500"
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
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowPortionForm(false)} style={{ flex: 1, background: theme.bgWarm, border: '1px solid ' + theme.border, borderRadius: 8, padding: '11px', fontSize: 13, cursor: 'pointer', fontWeight: 600, color: theme.textMid }}>Cancel</button>
              <button onClick={savePortion} disabled={savingPortion} style={{ flex: 2, background: '#092b33', color: '#fff', border: 'none', borderRadius: 8, padding: '11px', fontSize: 13, fontWeight: 700, cursor: savingPortion ? 'not-allowed' : 'pointer' }}>{savingPortion ? 'Saving...' : editPortionIdx !== null ? 'Save Portion' : 'Add Portion'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}