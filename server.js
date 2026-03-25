const express = require('express')
const cors = require('cors')
const multer = require('multer')
const { google } = require('googleapis')
const { Readable } = require('stream')
const fs = require('fs')
const path = require('path')

const app = express()
app.use(cors())
app.use(express.json())

const upload = multer({ storage: multer.memoryStorage() })

// ========== OAUTH2 CONFIG ==========
// ✅ Ganti dengan Client ID dan Client Secret dari Step 1
// Gantilah string rahasia yang tadinya ada di sini dengan ini:
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3001/auth/callback'

// ✅ Ganti dengan Folder ID kamu
const FOLDER_ID = '1BtbG3ai8B8mbdsoUeJwQ5fxnStN2_Nws'

// File untuk menyimpan refresh token
const TOKEN_PATH = path.join(__dirname, 'token.json')

// Setup OAuth2 Client
const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)

// Load token jika sudah ada
function loadToken() {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'))
      oauth2Client.setCredentials(token)
      console.log('✅ Token loaded from file')
      return true
    }
  } catch (err) {
    console.error('Token load error:', err.message)
  }
  return false
}

// Save token ke file
function saveToken(token) {
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2))
  console.log('✅ Token saved to file')
}

// Auto-refresh token
// ✅ YANG BARU (FIXED)
oauth2Client.on('tokens', (tokens) => {
    console.log('🔄 Token refreshed')
    try {
      let currentToken = {}
      if (fs.existsSync(TOKEN_PATH)) {
        currentToken = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'))
      }
      const updated = { ...currentToken, ...tokens }
      saveToken(updated)
    } catch (err) {
      // File belum ada, simpan token baru langsung
      saveToken(tokens)
    }
  })

// Load token saat startup
const tokenLoaded = loadToken()

// Google Drive instance
const drive = google.drive({ version: 'v3', auth: oauth2Client })

// ========== AUTH ROUTES ==========

// Step 1: Buka URL ini di browser untuk login
app.get('/auth/login', (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/drive']
  })
  console.log('🔐 Auth URL generated')
  res.redirect(url)
})

// Step 2: Google redirect ke sini setelah login
app.get('/auth/callback', async (req, res) => {
  try {
    const { code } = req.query
    if (!code) {
      return res.status(400).send('No code provided')
    }

    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)
    saveToken(tokens)

    console.log('✅ Authentication successful!')
    res.send(`
      <html>
        <body style="font-family:Arial; text-align:center; padding:50px;">
          <h1>✅ Login Berhasil!</h1>
          <p>Google Drive sudah terhubung.</p>
          <p>Kamu bisa menutup tab ini dan kembali ke aplikasi.</p>
          <p style="color:green; font-size:20px;">Server siap digunakan!</p>
        </body>
      </html>
    `)
  } catch (err) {
    console.error('❌ Auth error:', err.message)
    res.status(500).send('Authentication failed: ' + err.message)
  }
})

// Check auth status
app.get('/auth/status', (req, res) => {
  const hasToken = fs.existsSync(TOKEN_PATH)
  res.json({
    authenticated: hasToken,
    message: hasToken ? 'Ready!' : 'Belum login. Buka /auth/login dulu.'
  })
})

// ========== MIDDLEWARE: Cek Auth ==========
function requireAuth(req, res, next) {
  if (!fs.existsSync(TOKEN_PATH)) {
    return res.status(401).json({
      success: false,
      error: 'Belum login! Buka http://localhost:3001/auth/login dulu'
    })
  }
  next()
}

// ========== HELPER: Cari atau Buat Folder ==========
async function findOrCreateFolder(name, parentId) {
  try {
    const q = `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
    const res = await drive.files.list({ q, fields: 'files(id, name)' })

    if (res.data.files && res.data.files.length > 0) {
      console.log(`📁 Folder "${name}" found: ${res.data.files[0].id}`)
      return res.data.files[0].id
    }

    const folder = await drive.files.create({
      requestBody: {
        name: name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId]
      },
      fields: 'id'
    })

    console.log(`📁 Folder "${name}" created: ${folder.data.id}`)
    return folder.data.id
  } catch (err) {
    console.error('Error findOrCreateFolder:', err.message)
    throw err
  }
}

// ========== API: TEST ==========
app.get('/api/test', requireAuth, async (req, res) => {
  try {
    console.log('🧪 Testing Google Drive connection...')
    const result = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and trashed=false`,
      fields: 'files(id, name)',
      pageSize: 10
    })
    res.json({
      success: true,
      message: 'Google Drive connection OK!',
      filesInFolder: result.data.files
    })
  } catch (err) {
    console.error('❌ Test error:', err.message)
    res.status(500).json({ success: false, error: err.message })
  }
})

// ========== API: UPLOAD ==========
app.post('/api/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const { folderName, pegawaiName, fileName } = req.body

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file' })
    }

    const fileBuffer = req.file.buffer
    console.log(`📤 Upload: ${fileName} → ${folderName}/${pegawaiName}`)

    const catFolderId = await findOrCreateFolder(folderName, FOLDER_ID)
    const pegawaiFolderId = await findOrCreateFolder(pegawaiName, catFolderId)

    const stream = new Readable()
    stream.push(fileBuffer)
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

    console.log(`✅ Uploaded: ${uploaded.data.id}`)

    await drive.permissions.create({
      fileId: uploaded.data.id,
      requestBody: { role: 'reader', type: 'anyone' }
    })

    res.json({
      success: true,
      fileId: uploaded.data.id,
      url: `https://drive.google.com/file/d/${uploaded.data.id}/view`,
      size: uploaded.data.size
    })
  } catch (err) {
    console.error('❌ Upload error:', err.message)
    res.status(500).json({ success: false, error: err.message })
  }
})

// ========== API: DOWNLOAD ==========
app.get('/api/download', requireAuth, async (req, res) => {
  try {
    const { fileId } = req.query
    if (!fileId) return res.status(400).json({ error: 'fileId required' })

    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    )
    res.setHeader('Content-Type', 'application/zip')
    res.send(Buffer.from(response.data))
  } catch (err) {
    console.error('❌ Download error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ========== API: DELETE ==========
app.post('/api/delete', requireAuth, async (req, res) => {
  try {
    const { fileId } = req.body
    if (!fileId) return res.status(400).json({ error: 'fileId required' })

    await drive.files.delete({ fileId })
    res.json({ success: true })
  } catch (err) {
    console.error('❌ Delete error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ========== START ==========
const PORT = 3001
app.listen(PORT, () => {
  console.log('')
  console.log('🚀 ================================')
  console.log(`🚀 Backend running on port ${PORT}`)
  console.log('🚀 ================================')
  console.log('')

  if (tokenLoaded) {
    console.log('✅ Sudah login! Server siap digunakan.')
  } else {
    console.log('⚠️  BELUM LOGIN!')
    console.log(`👉 Buka browser: http://localhost:${PORT}/auth/login`)
  }

  console.log('')
  console.log(`🧪 Test:   http://localhost:${PORT}/api/test`)
  console.log(`🔐 Login:  http://localhost:${PORT}/auth/login`)
  console.log(`📊 Status: http://localhost:${PORT}/auth/status`)
  console.log('')
})