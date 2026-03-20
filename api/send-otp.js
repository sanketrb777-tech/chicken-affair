export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { phone, otp } = req.body
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
    const data = await response.json()
    console.log('WATI response:', JSON.stringify(data))
    res.status(response.ok ? 200 : 400).json(data)
  } catch (err) {
    console.error('WATI error:', err.message)
    res.status(500).json({ error: err.message })
  }
}