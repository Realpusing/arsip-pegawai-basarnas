const { google } = require('googleapis')
const { Readable } = require('stream')

// Service Account credentials dari environment variable
const CREDENTIALS = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID

const auth = new google.auth.GoogleAuth({
  credentials: CREDENTIALS,
  scopes: ['https://www.googleapis.com/auth/drive.file']
})

const drive = google.drive({ version: 'v3', auth })

// Helper: cari atau buat folder
async function findOrCreateFolder(name, parentId) {
  const q = `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
  const res = await drive.files.list({ q, fields: 'files(id)' })

  if (res.data.files.length > 0) return res.data.files[0].id

  const folder = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId]
    },
    fields: 'id'
  })

  return folder.data.id
}

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const { action } = req.query

    // ========== UPLOAD ==========
    if (action === 'upload') {
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      const buffer = Buffer.concat(chunks)

      // Parse multipart (simple)
      const boundary = req.headers['content-type'].split('boundary=')[1]
      const parts = parseMultipart(buffer, boundary)

      const folderName = parts.folderName || 'Unknown'
      const pegawaiName = parts.pegawaiName || 'Unknown'
      const fileName = parts.fileName || 'file.zip'
      const fileData = parts.fileData

      // Buat folder structure
      const catFolderId = await findOrCreateFolder(folderName, FOLDER_ID)
      const pegawaiFolderId = await findOrCreateFolder(pegawaiName, catFolderId)

      // Upload file
      const stream = new Readable()
      stream.push(fileData)
      stream.push(null)

      const uploaded = await drive.files.create({
        requestBody: {
          name: fileName,
          parents: [pegawaiFolderId]
        },
        media: {
          mimeType: 'application/zip',
          body: stream
        },
        fields: 'id, name, size'
      })

      // Set public
      await drive.permissions.create({
        fileId: uploaded.data.id,
        requestBody: { role: 'reader', type: 'anyone' }
      })

      return res.status(200).json({
        success: true,
        fileId: uploaded.data.id,
        url: `https://drive.google.com/file/d/${uploaded.data.id}/view`,
        size: uploaded.data.size
      })
    }

    // ========== DELETE ==========
    if (action === 'delete') {
      const { fileId } = req.body || JSON.parse(await getBody(req))
      await drive.files.delete({ fileId })
      return res.status(200).json({ success: true })
    }

    return res.status(400).json({ error: 'Invalid action' })

  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: error.message })
  }
}

// Helper: get request body
function getBody(req) {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', () => resolve(body))
  })
}

// Helper: parse multipart form data (simple version)
function parseMultipart(buffer, boundary) {
  const result = {}
  const parts = buffer.toString('binary').split('--' + boundary)

  for (const part of parts) {
    if (part.includes('Content-Disposition')) {
      const nameMatch = part.match(/name="([^"]+)"/)
      if (!nameMatch) continue
      const name = nameMatch[0].match(/name="([^"]+)"/)[1]

      if (part.includes('filename=')) {
        // File data
        const dataStart = part.indexOf('\r\n\r\n') + 4
        const dataEnd = part.lastIndexOf('\r\n')
        result.fileData = Buffer.from(part.substring(dataStart, dataEnd), 'binary')
        const fnMatch = part.match(/filename="([^"]+)"/)
        if (fnMatch) result.fileName = fnMatch[1]
      } else {
        // Text field
        const value = part.split('\r\n\r\n')[1]?.trim()?.replace(/\r\n--$/, '')
        result[name] = value
      }
    }
  }

  return result
}