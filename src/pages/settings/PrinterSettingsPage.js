import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { theme } from '../../lib/theme'

export default function PrinterSettingsPage() {
  const navigate  = useNavigate()
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)

  const [printerIp,       setPrinterIp]       = useState('')
  const [paperSize,       setPaperSize]       = useState('80')
  const [autoKot,         setAutoKot]         = useState(true)
  const [autoBill,        setAutoBill]        = useState(false)

  useEffect(() => { fetchSettings() }, [])

  async function fetchSettings() {
    const { data } = await supabase.from('app_settings').select('key, value')
    const map = {}
    ;(data || []).forEach(r => { map[r.key] = r.value })
    if (map.printer_ip)         setPrinterIp(map.printer_ip)
    if (map.printer_paper_size) setPaperSize(map.printer_paper_size)
    if (map.printer_auto_kot !== undefined) setAutoKot(map.printer_auto_kot === 'true')
    if (map.printer_auto_bill !== undefined) setAutoBill(map.printer_auto_bill === 'true')
    setLoading(false)
  }

  async function saveSettings() {
    setSaving(true)
    const updates = [
      { key: 'printer_ip',         value: printerIp },
      { key: 'printer_paper_size', value: paperSize },
      { key: 'printer_auto_kot',   value: String(autoKot) },
      { key: 'printer_auto_bill',  value: String(autoBill) },
    ]
    for (const u of updates) {
      await supabase.from('app_settings').upsert(u, { onConflict: 'key' })
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const toggle = (value, setter) => (
    <div onClick={() => setter(!value)}
      style={{ width: 44, height: 24, borderRadius: 99, background: value ? '#092b33' : theme.border, cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
      <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: value ? 23 : 3, transition: 'left 0.2s' }} />
    </div>
  )

  const field = (label, sublabel, input) => (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: theme.textDark, marginBottom: 2 }}>{label}</div>
      {sublabel && <div style={{ fontSize: 12, color: theme.textLight, marginBottom: 8 }}>{sublabel}</div>}
      {input}
    </div>
  )

  if (loading) return <div style={{ padding: 40, color: theme.textLight }}>Loading...</div>

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <button onClick={() => navigate('/settings')}
          style={{ background: '#fff', border: '1px solid ' + theme.border, borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer', color: theme.textMid, fontWeight: 600 }}>
          ← Back
        </button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: theme.textDark, margin: 0 }}>Printer Setup</h1>
          <p style={{ color: theme.textLight, fontSize: 13, marginTop: 2 }}>Configure KOT and bill printer</p>
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid ' + theme.border, padding: '24px' }}>

        {field('Printer IP Address', 'Local network IP of your thermal printer (e.g. 192.168.1.100)',
          <input value={printerIp} onChange={e => setPrinterIp(e.target.value)} placeholder="192.168.1.100"
            style={{ width: '100%', border: '1.5px solid ' + theme.border, borderRadius: 9, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
        )}

        {field('Paper Size', 'Select your printer paper width',
          <div style={{ display: 'flex', gap: 10 }}>
            {['58', '80'].map(size => (
              <div key={size} onClick={() => setPaperSize(size)}
                style={{ flex: 1, padding: '10px', borderRadius: 9, border: '2px solid ' + (paperSize === size ? '#092b33' : theme.border), background: paperSize === size ? '#092b33' : '#fff', color: paperSize === size ? '#fff' : theme.textDark, textAlign: 'center', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                {size}mm
              </div>
            ))}
          </div>
        )}

        <div style={{ height: 1, background: theme.bgWarm, margin: '4px 0 20px' }} />

        {field('Auto-print KOT', 'Automatically print KOT when an order is fired',
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: theme.textMid }}>{autoKot ? 'Enabled' : 'Disabled'}</span>
            {toggle(autoKot, setAutoKot)}
          </div>
        )}

        {field('Auto-print Bill', 'Automatically print bill when payment is confirmed',
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: theme.textMid }}>{autoBill ? 'Enabled' : 'Disabled'}</span>
            {toggle(autoBill, setAutoBill)}
          </div>
        )}

        <div style={{ marginTop: 8 }}>
          <button onClick={saveSettings} disabled={saving}
            style={{ background: '#092b33', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer', width: '100%' }}>
            {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Settings'}
          </button>
        </div>
      </div>

      <div style={{ marginTop: 14, background: '#FEF3C7', borderRadius: 12, border: '1px solid #FCD34D', padding: '14px 18px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#92400E', marginBottom: 4 }}>Note</div>
        <div style={{ fontSize: 12, color: '#92400E' }}>Thermal printer integration (actual printing) will be activated in a future update. These settings will be used when printing is enabled.</div>
      </div>
    </div>
  )
}