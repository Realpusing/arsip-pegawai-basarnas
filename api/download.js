const { google } = require('googleapis')

const CREDENTIALS = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)

const auth = new google.auth.GoogleAuth({
  credentials: CREDENTIALS,
  scopes: ['https://www.googleapis.com/auth/drive.readonly']
})

const drive = google.drive({ version: 'v3', auth })

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const { fileId } = req.query

  if (!fileId) return res.status(400).json({ error: 'fileId required' })

  try {
    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    )

    res.setHeader('Content-Type', 'application/zip')
    res.status(200).send(Buffer.from(response.data))
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: error.message })
  }
}