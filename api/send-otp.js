export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  let phone, otp
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    phone = body.phone
    otp = body.otp
  } catch (e) { return res.status(400).json({ error: 'Invalid request body' }) }

  if (!phone || !otp) return res.status(400).json({ error: 'phone and otp are required' })

  try {
    const response = await fetch(
      `https://live-mt-server.wati.io/10112850/api/v1/sendTemplateMessage?whatsappNumber=91${phone}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json-patch+json',
          'Authorization': `Bearer ${process.env.WATI_TOKEN}`,
        },
        body: JSON.stringify({
          template_name: 'bambinicafeapp',
          broadcast_name: 'bambinicafeapp',
          parameters: [{ name: '1', value: String(otp) }],
        }),
      }
    )
    const text = await response.text()
    console.log('WATI status:', response.status, '| body:', text || '(empty)')
    if (response.status >= 200 && response.status < 300) {
      return res.status(200).json({ success: true })
    }
    return res.status(400).json({ error: text })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
