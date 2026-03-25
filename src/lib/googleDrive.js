import JSZip from 'jszip'

// Backend API URL
const API_URL = 'http://localhost:3001'

// Maksimal ukuran file: 500 KB
const MAX_FILE_SIZE = 500 * 1024 // 500 KB

// ========== COMPRESS PDF → ZIP ==========
export async function compressPDF(file, onProgress) {
  if (!file) throw new Error('File tidak ditemukan')

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('Ukuran file melebihi batas maksimal 500 KB')
  }

  onProgress?.('📖 Membaca file...')
  const arrayBuffer = await file.arrayBuffer()
  const originalSize = file.size

  onProgress?.('🗜️ Mengkompress...')
  const zip = new JSZip()
  zip.file(file.name, arrayBuffer, {
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  })

  const zipBlob = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 }
    },
    (meta) => onProgress?.(`🗜️ Mengkompress... ${meta.percent.toFixed(0)}%`)
  )

  return {
    zipBlob,
    zipName: file.name.replace(/\.pdf$/i, '') + '.zip',
    originalSize,
    compressedSize: zipBlob.size,
    savedPercent: ((1 - zipBlob.size / originalSize) * 100).toFixed(1)
  }
}

// ========== UPLOAD TO GOOGLE DRIVE ==========
export async function uploadToGoogleDrive(zipBlob, zipName, folderName, pegawaiName, onProgress) {
  onProgress?.('🔐 Mengecek token Google...')
  await ensureGoogleToken()

  onProgress?.('📤 Mengupload ke Google Drive...')

  const formData = new FormData()
  formData.append('folderName', folderName)
  formData.append('pegawaiName', pegawaiName)
  formData.append('fileName', zipName)
  formData.append('file', zipBlob, zipName)

  const res = await fetch(`${API_URL}/api/upload`, {
    method: 'POST',
    body: formData
  })

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.error || 'Upload gagal')
  }

  const data = await res.json()
  if (!data.success) throw new Error(data.error || 'Upload gagal')

  return {
    fileId: data.fileId,
    url: data.url,
    size: parseInt(data.size || 0)
  }
}

// ========== DOWNLOAD FROM GOOGLE DRIVE ==========
export async function downloadFromGoogleDrive(fileId) {
  await ensureGoogleToken()

  const res = await fetch(`${API_URL}/api/download?fileId=${fileId}`)

  if (!res.ok) {
    throw new Error('Gagal download file dari Google Drive')
  }

  return await res.blob()
}

// ========== DECOMPRESS ZIP → PDF ==========
export async function decompressZip(zipBlob) {
  const zip = await JSZip.loadAsync(zipBlob)
  const pdfName = Object.keys(zip.files).find((n) =>
    n.toLowerCase().endsWith('.pdf')
  )

  if (!pdfName) throw new Error('PDF tidak ditemukan dalam ZIP')

  const pdfBlob = await zip.files[pdfName].async('blob')
  return {
    pdfBlob: new Blob([pdfBlob], { type: 'application/pdf' }),
    pdfName
  }
}

// ========== DELETE FROM GOOGLE DRIVE ==========
export async function deleteFromGoogleDrive(fileId) {
  try {
    await ensureGoogleToken()

    await fetch(`${API_URL}/api/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId })
    })
  } catch (e) {
    console.error('Delete error:', e)
  }
}

// ========== HELPERS ==========
export function extractFileId(url) {
  if (!url) return null
  const m1 = url.match(/\/d\/([^/]+)/)
  if (m1) return m1[1]
  const m2 = url.match(/id=([^&]+)/)
  if (m2) return m2[1]
  return null
}

export function formatSize(bytes) {
  if (!bytes) return '0 B'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

// ========== GOOGLE AUTH (AUTO REFRESH TOKEN) ==========
const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID

let accessToken = null
let tokenClient = null

function initTokenClient() {
  if (tokenClient) return tokenClient
  if (!window.google?.accounts?.oauth2) return null

  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/drive.file',
    callback: () => {}
  })

  return tokenClient
}

export function loginGoogle() {
  return new Promise((resolve, reject) => {
    const client = initTokenClient()
    if (!client) {
      reject(new Error('Google API belum dimuat. Refresh halaman.'))
      return
    }

    client.callback = (response) => {
      if (response.error) {
        reject(new Error(response.error))
      } else {
        accessToken = response.access_token
        localStorage.setItem('gdrive_token', response.access_token)
        localStorage.setItem('gdrive_token_time', Date.now().toString())
        resolve(response.access_token)
      }
    }

    client.requestAccessToken()
  })
}

function isTokenValid() {
  const savedToken = localStorage.getItem('gdrive_token')
  const tokenTime = localStorage.getItem('gdrive_token_time')

  if (!savedToken || !tokenTime) return false

  const elapsed = Date.now() - parseInt(tokenTime)
  return elapsed < 50 * 60 * 1000 // valid 50 menit
}

export function isGoogleLoggedIn() {
  if (accessToken && isTokenValid()) return true

  const saved = localStorage.getItem('gdrive_token')
  if (saved && isTokenValid()) {
    accessToken = saved
    return true
  }

  return false
}

export function logoutGoogle() {
  accessToken = null
  tokenClient = null
  localStorage.removeItem('gdrive_token')
  localStorage.removeItem('gdrive_token_time')
}

// Auto refresh token kalau expired
export async function ensureGoogleToken() {
  if (accessToken && isTokenValid()) return accessToken

  const saved = localStorage.getItem('gdrive_token')
  if (saved && isTokenValid()) {
    accessToken = saved
    return saved
  }

  try {
    return await new Promise((resolve, reject) => {
      const client = initTokenClient()
      if (!client) {
        reject(new Error('Google API not ready'))
        return
      }

      client.callback = (response) => {
        if (response.error) {
          reject(new Error(response.error))
        } else {
          accessToken = response.access_token
          localStorage.setItem('gdrive_token', response.access_token)
          localStorage.setItem('gdrive_token_time', Date.now().toString())
          resolve(response.access_token)
        }
      }

      client.requestAccessToken({ prompt: '' })
    })
  } catch (e) {
    return await loginGoogle()
  }
}