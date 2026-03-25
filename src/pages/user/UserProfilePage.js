import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import {
  compressPDF, uploadToGoogleDrive, downloadFromGoogleDrive,
  decompressZip, deleteFromGoogleDrive, extractFileId, formatSize,
  loginGoogle, isGoogleLoggedIn
} from '../../lib/googleDrive'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import { hitungMasaKerja, hitungUsia } from '../../lib/helpers'

function UserProfilePage() {
  const { user } = useAuth()

  const [profile, setProfile] = useState(null)
  const [folders, setFolders] = useState([])
  const [berkas, setBerkas] = useState([])
  const [loading, setLoading] = useState(true)

  // Search
  const [searchBerkas, setSearchBerkas] = useState('')

  // Upload
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')
  const [gLoggedIn, setGLoggedIn] = useState(isGoogleLoggedIn())

  // Modal
  const [modal, setModal] = useState(null)
  const [modalData, setModalData] = useState(null)

  // PDF Viewer
  const [viewingPDF, setViewingPDF] = useState(false)
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null)
  const [loadingPDF, setLoadingPDF] = useState(false)

  const fileInputRef = useRef(null)

  // ========== LOAD ==========
  useEffect(() => { loadProfile() }, [])

  const loadProfile = async () => {
    try {
      if (!user?.profile_id) { setLoading(false); return }

      const [p, f, b] = await Promise.all([
        supabase.from('profile').select('*, tingkat:tingkat_id(nama)').eq('id', user.profile_id).single(),
        supabase.from('folder').select('*').order('created_at'),
        supabase.from('berkas').select('*').eq('profile_id', user.profile_id).order('created_at')
      ])

      if (p.data) setProfile(p.data)
      if (f.data) setFolders(f.data)
      if (b.data) setBerkas(b.data)
    } catch (err) {
      toast.error('Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }

  const loadBerkas = async () => {
    const { data } = await supabase
      .from('berkas')
      .select('*')
      .eq('profile_id', user.profile_id)
      .order('created_at')
    if (data) setBerkas(data)
  }

  // ========== GOOGLE LOGIN ==========
  const handleGoogleLogin = async () => {
    try {
      await loginGoogle()
      setGLoggedIn(true)
      toast.success('Google Drive terhubung!')
    } catch (err) {
      toast.error('Gagal: ' + err.message)
    }
  }

  // ========== UPLOAD BERKAS ==========
  const handleUploadBerkas = async (e) => {
    e.preventDefault()

    if (!isGoogleLoggedIn()) {
      try {
        await loginGoogle()
        setGLoggedIn(true)
      } catch (err) {
        toast.error('Hubungkan Google Drive dulu!')
        return
      }
    }

    const fd = new FormData(e.target)
    const file = fd.get('file_pdf')
    const namaBerkas = fd.get('nama_berkas')
    const folderId = parseInt(modalData.folderId)
    const folder = folders.find(f => f.id === folderId)

    if (!file || !file.size) { toast.error('Pilih file PDF!'); return }
    if (file.type !== 'application/pdf') { toast.error('Hanya file PDF!'); return }
    if (file.size > 50 * 1024 * 1024) { toast.error('Maks 50MB!'); return }

    setUploading(true)
    const loadingToast = toast.loading('📤 Memproses upload...')

    try {
      const compressed = await compressPDF(file, setUploadStatus)

      const result = await uploadToGoogleDrive(
        compressed.zipBlob,
        compressed.zipName,
        folder?.nama_folder || 'Unknown',
        profile.nama,
        setUploadStatus
      )

      setUploadStatus('💾 Menyimpan...')
      const { error } = await supabase.from('berkas').insert({
        folder_id: folderId,
        profile_id: profile.id,
        nama_berkas: namaBerkas,
        lokasi_berkas: result.url
      })
      if (error) throw error

      toast.dismiss(loadingToast)
      toast.success(
        `Upload berhasil! 📄\n${formatSize(compressed.originalSize)} → ${formatSize(compressed.compressedSize)} (hemat ${compressed.savedPercent}%)`,
        { duration: 5000 }
      )

      setModal(null)
      setModalData(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      loadBerkas()
    } catch (err) {
      toast.dismiss(loadingToast)
      toast.error('Gagal upload: ' + err.message)
    } finally {
      setUploading(false)
      setUploadStatus('')
    }
  }

  // ========== VIEW PDF ==========
  const viewBerkas = async (b) => {
    const fid = extractFileId(b.lokasi_berkas)
    if (!fid) { window.open(b.lokasi_berkas, '_blank'); return }
    setViewingPDF(true)
    setLoadingPDF(true)
    setPdfBlobUrl(null)
    try {
      const zip = await downloadFromGoogleDrive(fid)
      const { pdfBlob } = await decompressZip(zip)
      setPdfBlobUrl(URL.createObjectURL(pdfBlob))
    } catch (err) {
      toast.error(err.message)
      window.open(b.lokasi_berkas, '_blank')
      setViewingPDF(false)
    } finally {
      setLoadingPDF(false)
    }
  }

  // ========== DOWNLOAD ==========
  const downloadBerkas = async (b) => {
    const fid = extractFileId(b.lokasi_berkas)
    if (!fid) { window.open(b.lokasi_berkas, '_blank'); return }
    try {
      toast('⬇️ Mendownload...')
      const zip = await downloadFromGoogleDrive(fid)
      const { pdfBlob, pdfName } = await decompressZip(zip)
      const u = URL.createObjectURL(pdfBlob)
      const a = document.createElement('a')
      a.href = u
      a.download = pdfName || b.nama_berkas + '.pdf'
      a.click()
      URL.revokeObjectURL(u)
      toast.success('Download selesai!')
    } catch (err) {
      toast.error(err.message)
    }
  }

  // ========== CLOSE PDF ==========
  const closePDF = () => {
    if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl)
    setPdfBlobUrl(null)
    setViewingPDF(false)
  }

  // ========== DELETE BERKAS ==========
  const deleteBerkas = async (b) => {
    if (!window.confirm(`Hapus berkas "${b.nama_berkas}"?\n\nFile di Google Drive juga akan dihapus.`)) return

    const loadingToast = toast.loading('🗑️ Menghapus...')

    try {
      // Hapus dari Google Drive
      const fid = extractFileId(b.lokasi_berkas)
      if (fid) {
        try { await deleteFromGoogleDrive(fid) } catch (e) { /* ignore */ }
      }

      // Hapus dari database (hanya milik sendiri)
      const { error } = await supabase
        .from('berkas')
        .delete()
        .eq('id', b.id)
        .eq('profile_id', profile.id)

      if (error) throw error

      toast.dismiss(loadingToast)
      toast.success('Berkas berhasil dihapus!')
      loadBerkas()
    } catch (err) {
      toast.dismiss(loadingToast)
      toast.error('Gagal menghapus: ' + err.message)
    }
  }

  // ========== SEARCH FILTER ==========
  const filteredBerkas = berkas.filter(b =>
    b.nama_berkas.toLowerCase().includes(searchBerkas.toLowerCase())
  )

  // ========== LOADING ==========
  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin h-10 w-10 border-t-4 border-orange-500 rounded-full"></div>
      </div>
    )
  }

  // ========== PROFIL BELUM TERHUBUNG ==========
  if (!profile) {
    return (
      <div className="max-w-lg mx-auto mt-20">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
          <span className="text-5xl">⚠️</span>
          <h2 className="text-xl font-bold text-yellow-800 mt-4">Profil Belum Terhubung</h2>
          <p className="text-yellow-600 mt-2">Akun Anda belum dihubungkan dengan data profil pegawai.</p>
          <p className="text-yellow-600 text-sm mt-1">Hubungi <b>Admin</b> untuk menghubungkan akun.</p>
          <div className="mt-4 bg-white rounded-lg p-3 text-sm text-gray-600">
            <p>Login: <b>{user?.nickname}</b></p>
            <p>Email: <b>{user?.email}</b></p>
          </div>
        </div>
      </div>
    )
  }

  // ========== RENDER ==========
  return (
    <div>
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">👤 Data Saya</h1>
          <p className="text-gray-500 text-sm">Lihat data profil dan kelola berkas dokumen Anda</p>
        </div>
        <div>
          {gLoggedIn ? (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 flex items-center gap-2">
              <span>✅</span>
              <span className="text-sm text-green-700">Google Drive Terhubung</span>
            </div>
          ) : (
            <button
              onClick={handleGoogleLogin}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
            >
              🔗 Hubungkan Google Drive
            </button>
          )}
        </div>
      </div>

      {/* INFO */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-6 flex items-start gap-2">
        <span className="mt-0.5">ℹ️</span>
        <div>
          <p className="text-sm text-green-700">Ini adalah data <b>milik Anda</b>.</p>
          <p className="text-xs text-green-600 mt-1">Anda bisa upload & hapus berkas di folder yang tersedia. Hubungi Admin jika ada data profil yang perlu diperbarui.</p>
        </div>
      </div>

      {/* PROFILE CARD */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
            {profile.nama?.[0]}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">{profile.nama}</h2>
            <p className="text-gray-500">NIP: {profile.nip}</p>
            <p className="text-gray-400 text-sm">{profile.jabatan}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {[
            { l: 'NIK', v: profile.nik },
            { l: 'Tanggal Lahir', v: profile.tanggal_lahir ? new Date(profile.tanggal_lahir).toLocaleDateString('id-ID') : '-' },
            { l: 'Usia', v: hitungUsia(profile.tanggal_lahir) ? `${hitungUsia(profile.tanggal_lahir)} tahun` : '-' },
            { l: 'Pangkat/Gol Ruang', v: profile.pangkat_gol_ruang },
            { l: 'Jabatan', v: profile.jabatan },
            { l: 'Jenjang Jabatan', v: profile.jenjang_jabatan },
            { l: 'Kelompok Jabatan', v: profile.kelompok_jabatan },
            { l: 'Kelas Jabatan', v: profile.kelas_jabatan },
            { l: 'Tingkat', v: profile.tingkat?.nama },
            { l: 'TMT CPNS', v: profile.tmt_cpns ? new Date(profile.tmt_cpns).toLocaleDateString('id-ID') : '-' },
            { l: 'Masa Kerja', v: hitungMasaKerja(profile.tmt_cpns).text },
            { l: 'Pimpinan Langsung', v: profile.nama_pimpinan_langsung },
          ].map((x, i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-1">{x.l}</p>
              <p className="text-sm font-medium text-gray-700">{x.v || '-'}</p>
            </div>
          ))}
        </div>
      </div>

      {/* SEARCH BERKAS */}
      <div className="bg-white rounded-xl shadow-sm border p-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input
              type="text"
              value={searchBerkas}
              onChange={(e) => setSearchBerkas(e.target.value)}
              placeholder="Cari nama berkas..."
              className="w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
            />
          </div>
          {searchBerkas && (
            <button onClick={() => setSearchBerkas('')} className="text-gray-400 hover:text-gray-600 px-2">✕</button>
          )}
          <div className="text-sm text-gray-400">
            {filteredBerkas.length} / {berkas.length} berkas
          </div>
        </div>
        {searchBerkas && (
          <div className="mt-3 pt-3 border-t">
            {filteredBerkas.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-2">
                Tidak ditemukan berkas dengan nama "<b>{searchBerkas}</b>"
              </p>
            ) : (
              <p className="text-xs text-gray-500">
                Menampilkan {filteredBerkas.length} berkas yang cocok dengan "<b>{searchBerkas}</b>"
              </p>
            )}
          </div>
        )}
      </div>

      {/* FOLDER & BERKAS */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="p-4 border-b">
          <h3 className="font-semibold">📁 Berkas Dokumen Saya</h3>
          <p className="text-xs text-gray-500 mt-1">Upload, lihat, download, atau hapus berkas PDF</p>
        </div>
        <div className="p-4 space-y-3">
          {folders.map(folder => {
            const folderBerkas = filteredBerkas.filter(b => b.folder_id === folder.id)
            if (searchBerkas && folderBerkas.length === 0) return null

            return (
              <div key={folder.id} className="border rounded-lg overflow-hidden">
                {/* Folder Header */}
                <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-lg">📁</span>
                    <span className="font-medium text-sm">{folder.nama_folder}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      folder.level_folder === 'Sangat Penting' ? 'bg-red-100 text-red-600' :
                      folder.level_folder === 'Penting' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{folder.level_folder}</span>
                    <span className="text-xs text-gray-400">({folderBerkas.length})</span>
                  </div>
                  <button
                    onClick={() => { setModal('uploadBerkas'); setModalData({ folderId: folder.id }) }}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1"
                  >
                    📤 Upload PDF
                  </button>
                </div>

                {/* Berkas List */}
                <div className="p-3 space-y-2">
                  {folderBerkas.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-3">
                      {searchBerkas ? 'Tidak ada berkas yang cocok' : 'Belum ada berkas. Klik "Upload PDF" untuk menambahkan.'}
                    </p>
                  ) : (
                    folderBerkas.map(b => (
                      <div key={b.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg hover:bg-gray-100 transition">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className="text-lg shrink-0">📄</span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">
                              {searchBerkas ? highlightText(b.nama_berkas, searchBerkas) : b.nama_berkas}
                            </p>
                            <p className="text-xs text-gray-400">
                              {new Date(b.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0 ml-2">
                          <button onClick={() => viewBerkas(b)}
                            className="bg-green-100 text-green-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-200 transition">
                            👁️ Lihat
                          </button>
                          <button onClick={() => downloadBerkas(b)}
                            className="bg-blue-100 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-200 transition">
                            ⬇️ Download
                          </button>
                          <button onClick={() => deleteBerkas(b)}
                            className="bg-red-100 text-red-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-200 transition">
                            🗑️ Hapus
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}

          {berkas.length === 0 && !searchBerkas && (
            <div className="text-center py-12 text-gray-400">
              <span className="text-4xl">📭</span>
              <p className="mt-2">Belum ada berkas dokumen</p>
              <p className="text-sm mt-1">Klik "📤 Upload PDF" di folder untuk menambahkan</p>
            </div>
          )}
        </div>
      </div>

      {/* ========== MODAL: UPLOAD PDF ========== */}
      {modal === 'uploadBerkas' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4">📤 Upload PDF</h3>
            <div className="bg-blue-50 rounded-lg p-3 mb-4 text-xs text-blue-700 space-y-1">
              <p className="font-semibold">📋 Cara upload:</p>
              <p>1. Masukkan nama berkas</p>
              <p>2. Pilih file PDF dari komputer</p>
              <p>3. File akan di-compress & disimpan ke Google Drive</p>
            </div>
            <form onSubmit={handleUploadBerkas} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nama Berkas</label>
                <input name="nama_berkas" required
                  className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                  placeholder="Contoh: SK Pengangkatan CPNS" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">File PDF (maks 50MB)</label>
                <input ref={fileInputRef} name="file_pdf" type="file" accept=".pdf" required
                  className="w-full px-3 py-2 border rounded-lg text-sm file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-orange-100 file:text-orange-600 file:font-medium file:cursor-pointer" />
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
                <p className="font-medium">📂 Upload ke folder:</p>
                <p className="mt-1 font-mono text-orange-600">
                  {folders.find(f => f.id === modalData?.folderId)?.nama_folder || '...'}
                </p>
              </div>
              {uploading && (
                <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="animate-spin h-5 w-5 border-2 border-orange-500 border-t-transparent rounded-full"></div>
                    <p className="text-sm text-orange-700 font-medium">{uploadStatus}</p>
                  </div>
                  <div className="w-full bg-orange-200 rounded-full h-2">
                    <div className="bg-orange-500 rounded-full h-2 transition-all animate-pulse" style={{ width: '60%' }}></div>
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <button type="submit" disabled={uploading}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-lg font-medium disabled:opacity-50 transition">
                  {uploading ? '⏳ Proses...' : '📤 Compress & Upload'}
                </button>
                <button type="button" onClick={() => { setModal(null); setModalData(null) }} disabled={uploading}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2.5 rounded-lg font-medium disabled:opacity-50 transition">
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========== MODAL: PDF VIEWER ========== */}
      {viewingPDF && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-5xl h-[90vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold">📄 PDF Viewer</h3>
              <button onClick={closePDF}
                className="bg-red-500 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-red-600">
                ✕ Tutup
              </button>
            </div>
            <div className="flex-1">
              {loadingPDF ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <div className="animate-spin h-10 w-10 border-4 border-orange-500 border-t-transparent rounded-full mb-4"></div>
                  <p className="text-gray-500">🗜️ Download & decompress...</p>
                </div>
              ) : pdfBlobUrl ? (
                <iframe src={pdfBlobUrl} className="w-full h-full" title="PDF" />
              ) : (
                <div className="flex items-center justify-center h-full text-red-500">Gagal memuat PDF</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ========== HELPER: Highlight search text ==========
function highlightText(text, search) {
  if (!search) return text
  const regex = new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  const parts = text.split(regex)
  return parts.map((part, i) =>
    regex.test(part) ? (
      <span key={i} className="bg-yellow-200 text-yellow-900 font-semibold rounded px-0.5">{part}</span>
    ) : part
  )
}

export default UserProfilePage