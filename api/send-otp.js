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
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.REACT_APP_WATI_TOKEN}`,
        },
        body: JSON.stringify({
          template_name: 'bambini_otp',
          broadcast_name: 'bambini_otp',
          parameters: [
            { name: '1', value: otp },
            { name: '2', value: '5' },
          ],
        }),
      }
    )
    const data = await response.json()
    res.status(response.ok ? 200 : 400).json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}