// server.js
const express = require('express')
const cors = require('cors')
const multer = require('multer')
const { google } = require('googleapis')
const { Readable } = require('stream')
const fs = require('fs')
const path = require('path')
require('dotenv').config()

const app = express()
app.use(cors())
app.use(express.json())

const upload = multer({ storage: multer.memoryStorage() })

// ========== CONFIG ==========
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const REDIRECT_URI = 'http://localhost:3001/auth/callback'
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '1BtbG3ai8B8mbdsoUeJwQ5fxnStN2_Nws'
const TOKEN_PATH = path.join(__dirname, 'token.json')

// ========== OAUTH2 ==========
const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI)

// ========== HELPER: Format Waktu ==========
function formatDuration(ms) {
  if (ms <= 0) return 'SUDAH EXPIRED'
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days} hari ${hours % 24} jam ${minutes % 60} menit`
  if (hours > 0) return `${hours} jam ${minutes % 60} menit ${seconds % 60} detik`
  if (minutes > 0) return `${minutes} menit ${seconds % 60} detik`
  return `${seconds} detik`
}

function getTokenExpiryInfo() {
  try {
    if (!fs.existsSync(TOKEN_PATH)) return null

    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'))
    const now = Date.now()

    const info = {
      hasAccessToken: !!token.access_token,
      hasRefreshToken: !!token.refresh_token,
      tokenType: token.token_type || 'unknown',
    }

    // Access Token expiry
    if (token.expiry_date) {
      const expiryDate = new Date(token.expiry_date)
      const remaining = token.expiry_date - now

      info.accessToken = {
        expiryDate: expiryDate.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
        expiryTimestamp: token.expiry_date,
        remainingMs: remaining,
        remainingFormatted: formatDuration(remaining),
        isExpired: remaining <= 0,
        willAutoRefresh: !!token.refresh_token && remaining <= 0
      }
    }

    // Refresh Token info
    info.refreshToken = {
      exists: !!token.refresh_token,
      // Refresh token tidak punya expiry_date yg eksplisit
      // Tapi di Testing mode, expired 7 hari sejak dibuat
      note: token.refresh_token
        ? 'Refresh token ada. Auto-refresh access token aktif.'
        : '⚠️ TIDAK ADA refresh token! Login ulang dengan prompt:consent'
    }

    // Token creation time (perkiraan)
    if (token.expiry_date) {
      // Access token biasanya 1 jam, jadi created = expiry - 3600000
      const createdApprox = token.expiry_date - 3600000
      info.tokenCreatedApprox = new Date(createdApprox).toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta'
      })
    }

    return info
  } catch (err) {
    return { error: err.message }
  }
}

// ========== TOKEN MANAGEMENT ==========
function loadToken() {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'))
      oauth2Client.setCredentials(token)
      console.log('✅ Token loaded from file')
      return true
    }
  } catch (err) {
    console.error('❌ Token load error:', err.message)
  }
  return false
}

function saveToken(token) {
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2))
  console.log('✅ Token saved to file')
}

// Auto-refresh: simpan token baru saat Google refresh otomatis
oauth2Client.on('tokens', (tokens) => {
  console.log('🔄 Token auto-refreshed by Google')
  console.log(`   New expiry: ${tokens.expiry_date
    ? new Date(tokens.expiry_date).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
    : 'unknown'}`)

  try {
    let current = {}
    if (fs.existsSync(TOKEN_PATH)) {
      current = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'))
    }
    saveToken({ ...current, ...tokens })
  } catch (err) {
    saveToken(tokens)
  }
})

const tokenLoaded = loadToken()
const drive = google.drive({ version: 'v3', auth: oauth2Client })

// ========== HELPER: Test Token Masih Valid ==========
async function testToken() {
  try {
    const about = await drive.about.get({ fields: 'user' })
    return {
      valid: true,
      user: about.data.user?.displayName || about.data.user?.emailAddress || 'unknown'
    }
  } catch (err) {
    const msg = err.message || ''
    if (msg.includes('invalid_grant') ||
        msg.includes('Token has been expired') ||
        msg.includes('Token has been revoked') ||
        msg.includes('Invalid Credentials') ||
        err.code === 401) {
      return { valid: false, reason: 'expired_or_revoked' }
    }
    return { valid: false, reason: msg }
  }
}

// ========== AUTH ROUTES ==========

// Login - buka di browser
app.get('/auth/login', (req, res) => {
  // Hapus token lama supaya dapat refresh_token baru
  if (fs.existsSync(TOKEN_PATH)) {
    fs.unlinkSync(TOKEN_PATH)
    console.log('🗑️ Token lama dihapus')
  }

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',  // PAKSA minta refresh_token baru
    scope: ['https://www.googleapis.com/auth/drive']
  })
  console.log('🔐 Redirecting to Google login...')
  res.redirect(url)
})

// Callback dari Google
app.get('/auth/callback', async (req, res) => {
  try {
    const { code } = req.query
    if (!code) return res.status(400).send('No code provided')

    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)
    saveToken(tokens)

    const expiryInfo = tokens.expiry_date
      ? new Date(tokens.expiry_date).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
      : 'unknown'

    console.log('✅ Login berhasil!')
    console.log('   Access Token:', tokens.access_token?.substring(0, 20) + '...')
    console.log('   Refresh Token:', tokens.refresh_token ? 'YES ✅' : 'NO ❌')
    console.log('   Access Token Expiry:', expiryInfo)

    res.send(`
      <html>
        <body style="font-family:Arial; text-align:center; padding:50px; background:#f0fdf4;">
          <h1 style="color:#16a34a">✅ Login Berhasil!</h1>
          <p>Google Drive sudah terhubung.</p>
          <table style="margin:20px auto; text-align:left; border-collapse:collapse;">
            <tr>
              <td style="padding:8px; font-weight:bold;">Refresh Token:</td>
              <td style="padding:8px; color:${tokens.refresh_token ? 'green' : 'red'}">
                ${tokens.refresh_token ? '✅ Didapat' : '❌ Tidak ada'}
              </td>
            </tr>
            <tr>
              <td style="padding:8px; font-weight:bold;">Access Token Expired:</td>
              <td style="padding:8px;">${expiryInfo}</td>
            </tr>
            <tr>
              <td style="padding:8px; font-weight:bold;">Auto Refresh:</td>
              <td style="padding:8px; color:${tokens.refresh_token ? 'green' : 'red'}">
                ${tokens.refresh_token ? '✅ Aktif (otomatis perpanjang)' : '❌ Tidak aktif'}
              </td>
            </tr>
          </table>
          <p style="color:#666; margin-top:20px;">Tab ini bisa ditutup. Kembali ke aplikasi.</p>
        </body>
      </html>
    `)
  } catch (err) {
    console.error('❌ Auth error:', err.message)
    res.status(500).send(`
      <html>
        <body style="font-family:Arial; text-align:center; padding:50px; background:#fef2f2;">
          <h1 style="color:#dc2626">❌ Login Gagal</h1>
          <p>${err.message}</p>
          <a href="/auth/login">Coba lagi</a>
        </body>
      </html>
    `)
  }
})

// ========== API: AUTH STATUS + EXPIRY INFO ==========
app.get('/auth/status', async (req, res) => {
  const hasToken = fs.existsSync(TOKEN_PATH)

  if (!hasToken) {
    return res.json({
      authenticated: false,
      message: 'Belum login. Buka /auth/login dulu.',
      loginUrl: 'http://localhost:3001/auth/login'
    })
  }

  // Get token expiry info
  const expiryInfo = getTokenExpiryInfo()

  // Test apakah token masih bisa dipakai
  const result = await testToken()

  if (!result.valid) {
    console.log('⚠️ Token invalid:', result.reason)
    return res.json({
      authenticated: false,
      tokenExists: true,
      expired: true,
      reason: result.reason,
      expiry: expiryInfo,
      message: 'Token expired! Buka /auth/login untuk login ulang.',
      loginUrl: 'http://localhost:3001/auth/login'
    })
  }

  res.json({
    authenticated: true,
    user: result.user,
    message: 'Ready! Token valid.',
    expiry: expiryInfo,
    explanation: {
      accessToken: 'Expired setiap 1 jam, tapi auto-refresh pakai refresh token',
      refreshToken: 'Tidak expired (Production mode). Expired 7 hari jika Testing mode.',
      autoRefresh: expiryInfo?.hasRefreshToken
        ? 'AKTIF - access token akan otomatis diperpanjang'
        : 'TIDAK AKTIF - harus login ulang setiap 1 jam'
    }
  })
})

// ========== API: TOKEN EXPIRY DETAIL ==========
app.get('/auth/expiry', async (req, res) => {
  const expiryInfo = getTokenExpiryInfo()

  if (!expiryInfo) {
    return res.json({
      error: 'Belum login. Tidak ada token.',
      loginUrl: 'http://localhost:3001/auth/login'
    })
  }

  // Test real validity
  const testResult = await testToken()

  res.json({
    tokenInfo: expiryInfo,
    realTest: testResult,
    penjelasan: {
      accessToken: {
        durasi: '1 jam (3600 detik)',
        behaviour: 'Setelah expired, akan otomatis di-refresh pakai refresh token',
        note: 'Kamu TIDAK perlu login ulang selama refresh token masih valid'
      },
      refreshToken: {
        durasi_production: 'Tidak pernah expired (sampai user revoke)',
        durasi_testing: '7 hari (jika Google Cloud project masih Testing)',
        cara_cek: 'Buka console.cloud.google.com → OAuth consent screen → Publishing status',
        cara_fix: 'Ubah Publishing status dari Testing ke Production'
      },
      timeline: {
        '0-60_menit': 'Access token valid, langsung dipakai',
        '60_menit': 'Access token expired, auto-refresh pakai refresh token → dapat access token baru 1 jam',
        '7_hari_testing': 'Refresh token expired (Testing mode) → harus login ulang',
        'production': 'Refresh token TIDAK expired → auto-refresh selamanya'
      }
    }
  })
})

// ========== MIDDLEWARE: Cek Auth + Token Valid ==========
async function requireAuth(req, res, next) {
  if (!fs.existsSync(TOKEN_PATH)) {
    return res.status(401).json({
      success: false,
      error: 'Belum login! Buka http://localhost:3001/auth/login dulu',
      loginUrl: 'http://localhost:3001/auth/login'
    })
  }

  // Test token sebelum proses
  const result = await testToken()
  if (!result.valid) {
    console.error('❌ Token invalid:', result.reason)

    // Coba reload token dan test lagi (mungkin sudah di-refresh di file)
    loadToken()
    const retry = await testToken()
    if (!retry.valid) {
      return res.status(401).json({
        success: false,
        error: `Token expired! Login ulang di http://localhost:3001/auth/login (${result.reason})`,
        loginUrl: 'http://localhost:3001/auth/login',
        expiry: getTokenExpiryInfo()
      })
    }
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
    console.error('Folder error:', err.message)
    throw err
  }
}

// ========== API: TEST CONNECTION ==========
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
      filesInFolder: result.data.files,
      tokenExpiry: getTokenExpiryInfo()
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
    if (!req.file) return res.status(400).json({ success: false, error: 'No file' })

    console.log(`📤 Upload: ${fileName} → ${folderName}/${pegawaiName}`)

    const catFolderId = await findOrCreateFolder(folderName, FOLDER_ID)
    const pegawaiFolderId = await findOrCreateFolder(pegawaiName, catFolderId)

    const stream = new Readable()
    stream.push(req.file.buffer)
    stream.push(null)

    const uploaded = await drive.files.create({
      requestBody: { name: fileName, parents: [pegawaiFolderId] },
      media: { mimeType: 'application/zip', body: stream },
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
app.listen(PORT, async () => {
  console.log('')
  console.log('🚀 ========================================')
  console.log(`🚀 Backend: http://localhost:${PORT}`)
  console.log('🚀 ========================================')
  console.log('')

  if (tokenLoaded) {
    const result = await testToken()
    const expiryInfo = getTokenExpiryInfo()

    if (result.valid) {
      console.log(`✅ Token VALID! Logged in as: ${result.user}`)
      if (expiryInfo?.accessToken) {
        console.log(`⏰ Access Token expired: ${expiryInfo.accessToken.expiryDate}`)
        console.log(`⏰ Sisa waktu: ${expiryInfo.accessToken.remainingFormatted}`)
        console.log(`🔄 Auto-refresh: ${expiryInfo.hasRefreshToken ? 'AKTIF ✅' : 'TIDAK AKTIF ❌'}`)
      }
      console.log('✅ Server siap digunakan!')
    } else {
      console.log('❌ Token EXPIRED!')
      console.log(`   Reason: ${result.reason}`)
      console.log(`👉 Buka: http://localhost:${PORT}/auth/login`)
    }
  } else {
    console.log('⚠️  BELUM LOGIN!')
    console.log(`👉 Buka: http://localhost:${PORT}/auth/login`)
  }

  console.log('')
  console.log('📋 Available Endpoints:')
  console.log(`   🔐 Login:   http://localhost:${PORT}/auth/login`)
  console.log(`   📊 Status:  http://localhost:${PORT}/auth/status`)
  console.log(`   ⏰ Expiry:  http://localhost:${PORT}/auth/expiry`)
  console.log(`   🧪 Test:    http://localhost:${PORT}/api/test`)
  console.log(`   📤 Upload:  POST http://localhost:${PORT}/api/upload`)
  console.log(`   📥 Download: GET http://localhost:${PORT}/api/download?fileId=xxx`)
  console.log(`   🗑️  Delete:  POST http://localhost:${PORT}/api/delete`)
  console.log('')
})