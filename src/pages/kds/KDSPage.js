import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

const TEAL       = '#6b1f1f'
const TEAL_LIGHT = '#c0392b'
const TEAL_BG    = '#fdedec'
const BORDER     = '#E5E7EB'
const TEXT_DARK  = '#111827'
const TEXT_MID   = '#374151'
const TEXT_LIGHT = '#6B7280'
const WHITE      = '#FFFFFF'
const BG         = '#fdf9f9'

export default function KDSPage() {
  const [groups, setGroups]           = useState([])
  const [categories, setCategories]   = useState([])
  const [kotItems, setKotItems]       = useState({})
  const [collapsedCats, setCollapsedCats] = useState({})
  const [time, setTime]               = useState('')
  const [connected, setConnected]     = useState(false)
  const debounceRef = useRef(null)

  const debouncedFetch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchAll(), 300)
  }, [])

  useEffect(() => {
    updateClock()
    fetchAll()
    const channel = supabase
      .channel('kds-v5')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kots' },           debouncedFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kot_items' },      debouncedFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' },         debouncedFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_categories' }, fetchAll)
      .subscribe(status => setConnected(status === 'SUBSCRIBED'))
    const clockTimer   = setInterval(updateClock, 1000)
    const refreshTimer = setInterval(fetchAll, 15000)
    return () => {
      supabase.removeChannel(channel)
      clearInterval(clockTimer)
      clearInterval(refreshTimer)
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [debouncedFetch])

  function updateClock() {
    setTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }))
  }

  async function fetchAll() {
    const { data: cats } = await supabase
      .from('menu_categories').select('id, name, sort_order').eq('is_active', true).order('sort_order')
    setCategories(cats || [])

    const { data, error } = await supabase
      .from('kots')
      .select(`
        id, status, created_at,
        orders ( id, order_type, customer_name, covers, table_id, cafe_tables ( id, number, name ) ),
        kot_items (
          id, is_done,
          order_items ( id, quantity, notes, menu_items ( id, name, priority, category_id, food_type ) )
        )
      `)
      .in('status', ['pending', 'in_progress'])
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at')

    if (error) { console.error('KDS error:', error); return }
    const kotList = data || []

    const groupMap = {}
    kotList.forEach(kot => {
      const order = kot.orders
      if (!order) return
      const tableId  = order.cafe_tables?.id
      const groupKey = order.order_type === 'dine_in' && tableId ? `table_${tableId}` : `order_${order.id}`
      if (!groupMap[groupKey]) {
        groupMap[groupKey] = {
          groupKey, orderType: order.order_type, tableNum: order.cafe_tables?.number,
          tableName: order.cafe_tables?.name, customerName: order.customer_name,
          tableId, firstKotTime: kot.created_at, kots: [],
        }
      }
      if (kot.created_at < groupMap[groupKey].firstKotTime) groupMap[groupKey].firstKotTime = kot.created_at
      groupMap[groupKey].kots.push(kot)
    })

    setGroups(Object.values(groupMap).sort((a, b) => new Date(a.firstKotTime) - new Date(b.firstKotTime)))

    const itemMap = {}
    kotList.forEach(kot => kot.kot_items.forEach(ki => { itemMap[ki.id] = ki.is_done }))
    setKotItems(prev => ({ ...itemMap, ...Object.fromEntries(Object.entries(prev).filter(([k]) => itemMap[k] !== undefined)) }))
  }

  async function toggleItem(kotItemId, currentDone, groupKey, kotId) {
    const newDone = !currentDone
    setKotItems(prev => ({ ...prev, [kotItemId]: newDone }))
    await supabase.from('kot_items').update({ is_done: newDone }).eq('id', kotItemId)
    if (newDone) {
      const group = groups.find(g => g.groupKey === groupKey)
      const kot   = group?.kots.find(k => k.id === kotId)
      if (kot) {
        const allDone = kot.kot_items.every(ki => ki.id === kotItemId ? newDone : (kotItems[ki.id] ?? ki.is_done))
        if (allDone) {
          await supabase.from('kots').update({ status: 'ready' }).eq('id', kotId)
          const updatedKots = group.kots.map(k => k.id === kotId ? { ...k, status: 'ready' } : k)
          if (updatedKots.every(k => k.status === 'ready')) {
            setGroups(prev => prev.filter(g => g.groupKey !== groupKey))
          } else {
            setGroups(prev => prev.map(g => g.groupKey === groupKey ? { ...g, kots: g.kots.filter(k => k.id !== kotId) } : g))
          }
        }
      }
    }
  }

  async function markGroupReady(group) {
    await Promise.all(group.kots.map(async kot => {
      await Promise.all(kot.kot_items.map(ki => supabase.from('kot_items').update({ is_done: true }).eq('id', ki.id)))
      await supabase.from('kots').update({ status: 'ready' }).eq('id', kot.id)
    }))
    setGroups(prev => prev.filter(g => g.groupKey !== group.groupKey))
    setKotItems(prev => {
      const next = { ...prev }
      group.kots.forEach(kot => kot.kot_items.forEach(ki => { next[ki.id] = true }))
      return next
    })
  }

  function getElapsed(createdAt) {
    const diff = Math.floor((new Date() - new Date(createdAt)) / 60000)
    return diff < 10 ? `0${diff} min` : `${diff} min`
  }

  function getElapsedColor(createdAt) {
    const diff = Math.floor((new Date() - new Date(createdAt)) / 60000)
    if (diff > 15) return '#c0392b'
    if (diff > 8)  return '#c0392b'
    return TEAL
  }

  function getGroupLabel(group) {
    if (group.orderType === 'dine_in') return { label: 'Dine In', sub: group.tableName || `Table ${group.tableNum}`, badge: `T${group.tableNum}` }
    if (group.orderType === 'takeaway') return { label: 'Takeaway', sub: group.customerName || '', badge: '??' }
    if (group.orderType === 'delivery') return { label: 'Delivery', sub: group.customerName || '', badge: '??' }
    return { label: 'Order', sub: '', badge: '#' }
  }

  function toggleCat(catId) { setCollapsedCats(prev => ({ ...prev, [catId]: !prev[catId] })) }

  const batchByCat = {}
  groups.forEach(group => {
    group.kots.forEach(kot => {
      kot.kot_items.forEach(ki => {
        const isDone = kotItems[ki.id] ?? ki.is_done
        if (isDone) return
        const item = ki.order_items?.menu_items
        if (!item) return
        const catId = item.category_id
        if (!batchByCat[catId]) batchByCat[catId] = {}
        if (!batchByCat[catId][item.name]) batchByCat[catId][item.name] = { name: item.name, qty: 0, priority: item.priority ?? 2, foodType: item.food_type }
        batchByCat[catId][item.name].qty += ki.order_items?.quantity || 0
      })
    })
  })

  const batchCategories = categories
    .filter(cat => batchByCat[cat.id] && Object.keys(batchByCat[cat.id]).length > 0)
    .map(cat => ({ ...cat, items: Object.values(batchByCat[cat.id]).sort((a, b) => a.priority - b.priority) }))

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: "'DM Sans', 'Segoe UI', sans-serif", display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: TEAL, padding: '0 20px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ color: WHITE, fontWeight: 900, fontSize: 20, letterSpacing: 0.5 }}>KDS Dashboard</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontFamily: 'monospace', letterSpacing: 1 }}>{time}</div>
          <div style={{ background: WHITE, borderRadius: 20, padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: connected ? TEAL_LIGHT : '#c0392b' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? '#22C55E' : '#c0392b', display: 'inline-block' }} />
            {connected ? 'Online' : 'Offline'}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ width: 240, background: WHITE, borderRight: '1px solid ' + BORDER, display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto' }}>
          {batchCategories.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: TEXT_LIGHT, fontSize: 13, marginTop: 40 }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>?</div>All items done
            </div>
          ) : batchCategories.map(cat => (
            <div key={cat.id} style={{ borderBottom: '1px solid ' + BORDER }}>
              <div onClick={() => toggleCat(cat.id)}
                style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: '#F9FAFB', userSelect: 'none' }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: TEXT_DARK, textTransform: 'uppercase', letterSpacing: 0.5 }}>{cat.name}</div>
                <span style={{ fontSize: 14, color: TEXT_LIGHT, transform: collapsedCats[cat.id] ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 0.15s', display: 'inline-block' }}>?</span>
              </div>
              {!collapsedCats[cat.id] && cat.items.map(item => (
                <div key={item.name} style={{ padding: '9px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid ' + BORDER, background: WHITE }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid ' + (item.foodType === 'veg' ? '#15803D' : '#c0392b'), background: item.foodType === 'non_veg' ? '#c0392b' : 'transparent', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: TEXT_MID, fontWeight: 500, lineHeight: 1.3 }}>{item.name}</span>
                  </div>
                  <div style={{ background: TEAL, color: WHITE, borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, flexShrink: 0, marginLeft: 8 }}>
                    {item.qty}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {groups.length === 0 ? (
            <div style={{ textAlign: 'center', marginTop: 80 }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: TEAL_BG, border: '2px solid ' + TEAL_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 32 }}>?</div>
              <div style={{ color: TEAL_LIGHT, fontSize: 22, fontWeight: 800 }}>All Orders Done</div>
              <div style={{ color: TEXT_LIGHT, fontSize: 14, marginTop: 8 }}>Waiting for new orders...</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {groups.map((group) => {
                const { label, sub, badge } = getGroupLabel(group)
                const elapsed      = getElapsed(group.firstKotTime)
                const elapsedColor = getElapsedColor(group.firstKotTime)
                const allItemsDone = group.kots.every(kot => kot.kot_items.every(ki => kotItems[ki.id] ?? ki.is_done))

                return (
                  <div key={group.groupKey} style={{ background: WHITE, borderRadius: 12, border: '1px solid ' + BORDER, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
                    <div style={{ background: allItemsDone ? TEAL_BG : '#F9FAFB', padding: '10px 14px', borderBottom: '1px solid ' + BORDER, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid ' + (allItemsDone ? TEAL_LIGHT : TEAL), background: allItemsDone ? TEAL_LIGHT : 'transparent', flexShrink: 0 }} />
                        <span style={{ fontWeight: 700, fontSize: 14, color: TEXT_DARK }}>{label}</span>
                        {sub && <span style={{ fontSize: 12, color: TEXT_LIGHT }}>· {sub}</span>}
                      </div>
                      <span style={{ fontWeight: 900, fontSize: 16, color: TEXT_DARK }}>{badge}</span>
                    </div>

                    <div style={{ padding: '7px 14px', borderBottom: '1px solid ' + BORDER, display: 'flex', alignItems: 'center', gap: 10, background: WHITE }}>
                      <div style={{ fontSize: 11, color: TEXT_LIGHT, fontWeight: 600 }}>{group.kots.length} KOT{group.kots.length !== 1 ? 's' : ''}</div>
                      <div style={{ background: elapsedColor, color: WHITE, borderRadius: 12, padding: '2px 10px', fontSize: 11, fontWeight: 800 }}>{elapsed}</div>
                      <div style={{ marginLeft: 'auto', fontSize: 11, color: TEXT_LIGHT }}>
                        {new Date(group.firstKotTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      </div>
                    </div>

                    {group.kots.map((kot, kotIdx) => {
                      const kotAllDone = kot.kot_items.every(ki => kotItems[ki.id] ?? ki.is_done)
                      return (
                        <div key={kot.id}>
                          {group.kots.length > 1 && (
                            <div style={{ padding: '5px 14px', background: kotAllDone ? '#F0FDF4' : '#FAFAFA', borderBottom: '1px solid ' + BORDER, display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: 10, fontWeight: 800, color: TEXT_LIGHT, textTransform: 'uppercase', letterSpacing: 0.8 }}>Round {kotIdx + 1}</span>
                              <span style={{ fontSize: 10, color: TEXT_LIGHT }}>{new Date(kot.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                            </div>
                          )}
                          {kot.kot_items.map((ki) => {
                            const item   = ki.order_items?.menu_items
                            const qty    = ki.order_items?.quantity || 0
                            const notes  = ki.order_items?.notes
                            const isDone = kotItems[ki.id] ?? ki.is_done
                            return (
                              <div key={ki.id} style={{ padding: '10px 14px', borderBottom: '1px solid ' + BORDER, display: 'flex', alignItems: 'center', gap: 10, background: isDone ? '#F0FDF4' : WHITE, transition: 'background 0.2s' }}>
                                <div style={{ fontWeight: 800, fontSize: 14, color: TEXT_DARK, minWidth: 18, textAlign: 'center', flexShrink: 0 }}>{qty}</div>
                                {item?.food_type === 'non_veg' && <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#c0392b', border: '2px solid #c0392b', flexShrink: 0 }} />}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: isDone ? TEXT_LIGHT : TEXT_DARK, textDecoration: isDone ? 'line-through' : 'none', lineHeight: 1.3 }}>{item?.name}</div>
                                  {notes && <div style={{ fontSize: 11, color: '#c0392b', marginTop: 2 }}>{notes}</div>}
                                </div>
                                <div onClick={() => toggleItem(ki.id, isDone, group.groupKey, kot.id)}
                                  style={{ position: 'relative', width: 44, height: 24, borderRadius: 12, background: isDone ? TEAL_LIGHT : '#D1D5DB', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
                                  <div style={{ position: 'absolute', top: 3, left: isDone ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: WHITE, boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}

                    <div style={{ padding: '12px 14px', borderTop: '1px solid ' + BORDER }}>
                      <button onClick={() => markGroupReady(group)}
                        style={{ width: '100%', background: allItemsDone ? TEAL : '#E5E7EB', color: allItemsDone ? WHITE : TEXT_LIGHT, border: 'none', borderRadius: 8, padding: '11px 0', fontSize: 14, fontWeight: 800, cursor: allItemsDone ? 'pointer' : 'default', transition: 'all 0.2s' }}>
                        {allItemsDone ? '? Food Ready' : 'Food Ready'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
