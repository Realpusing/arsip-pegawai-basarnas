import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { downloadFromGoogleDrive, decompressZip, extractFileId } from '../../lib/googleDrive'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

function PimpinanPegawaiPage() {
  const { user, isPimpinan, isPejabat } = useAuth()

  // ─── Tab aktif ───
  const [activeTab, setActiveTab] = useState('self') // 'self' | 'staff'

  // ─── Data Diri ───
  const [selfProfile, setSelfProfile] = useState(null)
  const [selfBerkas, setSelfBerkas] = useState([])
  const [selfFolders, setSelfFolders] = useState([])
  const [selfFolderSearch, setSelfFolderSearch] = useState('')
  const [loadingSelf, setLoadingSelf] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadFolderId, setUploadFolderId] = useState(null)
  const [uploadNamaBerkas, setUploadNamaBerkas] = useState('')
  const [uploadFile, setUploadFile] = useState(null)
  const fileInputRef = useRef(null)

  // ─── Data Anak Buah ───
  const [pegawai, setPegawai] = useState([])
  const [folders, setFolders] = useState([])
  const [berkas, setBerkas] = useState([])
  const [selectedPegawai, setSelectedPegawai] = useState(null)
  const [search, setSearch] = useState('')
  const [folderSearch, setFolderSearch] = useState('')
  const [loadingStaff, setLoadingStaff] = useState(true)

  // ─── PDF Viewer ───
  const [viewingPDF, setViewingPDF] = useState(false)
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null)
  const [loadingPDF, setLoadingPDF] = useState(false)

  // ─── Load semua data saat mount ───
  useEffect(() => {
    loadSelfData()
    loadStaffData()
  }, [])

  // ═══════════════════════════════════════════
  // DATA DIRI
  // ═══════════════════════════════════════════
  const loadSelfData = async () => {
    setLoadingSelf(true)
    try {
      const profileId = user?.profile?.id
      if (!profileId) { setLoadingSelf(false); return }

      // Profil sendiri
      const { data: pData } = await supabase
        .from('profile')
        .select('*, tingkat:tingkat_id(nama)')
        .eq('id', profileId)
        .single()
      if (pData) setSelfProfile(pData)

      // Folder
      const { data: fData } = await supabase
        .from('folder')
        .select('*')
        .order('created_at')
      if (fData) setSelfFolders(fData)

      // Berkas sendiri
      const { data: bData } = await supabase
        .from('berkas')
        .select('*')
        .eq('profile_id', profileId)
        .order('created_at')
      if (bData) setSelfBerkas(bData)
    } catch {
      toast.error('Gagal memuat data diri')
    } finally {
      setLoadingSelf(false)
    }
  }

  // ═══════════════════════════════════════════
  // DATA ANAK BUAH / SEMUA PEGAWAI
  // ═══════════════════════════════════════════
  const loadStaffData = async () => {
    setLoadingStaff(true)
    try {
      const { data: fData } = await supabase
        .from('folder')
        .select('*')
        .order('created_at')
      if (fData) setFolders(fData)

      if (isPimpinan) {
        const { data } = await supabase
          .from('profile')
          .select('*, tingkat:tingkat_id(nama)')
          .order('nama')
        if (data) setPegawai(data)
      } else if (isPejabat) {
        const nip = user?.profile?.nip
        if (nip) {
          const { data } = await supabase
            .from('profile')
            .select('*, tingkat:tingkat_id(nama)')
            .eq('nip_pimpinan_langsung', nip)
            .order('nama')
          if (data) setPegawai(data)
        } else {
          setPegawai([])
        }
      }
    } catch {
      toast.error('Gagal memuat data pegawai')
    } finally {
      setLoadingStaff(false)
    }
  }

  const loadBerkas = useCallback(async (pid) => {
    const { data } = await supabase
      .from('berkas')
      .select('*')
      .eq('profile_id', pid)
      .order('created_at')
    if (data) setBerkas(data)
  }, [])

  const selectPegawai = (p) => {
    setSelectedPegawai(p)
    setFolderSearch('')
    loadBerkas(p.id)
  }

  // ═══════════════════════════════════════════
  // UPLOAD BERKAS (Data Diri)
  // ═══════════════════════════════════════════
  const openUploadModal = (folderId) => {
    setUploadFolderId(folderId)
    setUploadNamaBerkas('')
    setUploadFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const closeUploadModal = () => {
    setUploadFolderId(null)
    setUploadNamaBerkas('')
    setUploadFile(null)
  }

  const handleUpload = async () => {
    if (!uploadNamaBerkas.trim()) return toast.error('Nama berkas wajib diisi')
    if (!uploadFile) return toast.error('Pilih file terlebih dahulu')
    if (!user?.profile?.id) return toast.error('Profil tidak ditemukan')

    setUploading(true)
    try {
      const ext = uploadFile.name.split('.').pop()
      const path = `berkas/${user.profile.id}/${Date.now()}.${ext}`

      // Upload ke Supabase Storage
      const { error: upErr } = await supabase.storage
        .from('berkas')
        .upload(path, uploadFile)
      if (upErr) throw upErr

      const { data: urlData } = supabase.storage
        .from('berkas')
        .getPublicUrl(path)

      // Simpan ke tabel berkas
      const { error: dbErr } = await supabase
        .from('berkas')
        .insert({
          profile_id: user.profile.id,
          folder_id: uploadFolderId,
          nama_berkas: uploadNamaBerkas.trim(),
          lokasi_berkas: urlData.publicUrl,
        })
      if (dbErr) throw dbErr

      toast.success('Berkas berhasil diupload!')
      closeUploadModal()
      loadSelfData() // Refresh data diri
    } catch (err) {
      toast.error(err.message || 'Gagal upload')
    } finally {
      setUploading(false)
    }
  }

  const deleteSelfBerkas = async (b) => {
    if (!window.confirm(`Hapus berkas "${b.nama_berkas}"?`)) return
    try {
      await supabase.from('berkas').delete().eq('id', b.id)
      toast.success('Berkas dihapus')
      loadSelfData()
    } catch {
      toast.error('Gagal menghapus')
    }
  }

  // ═══════════════════════════════════════════
  // VIEW & DOWNLOAD BERKAS
  // ═══════════════════════════════════════════
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
      toast.success('Selesai!')
    } catch (err) {
      toast.error(err.message)
    }
  }

  const closePDF = () => {
    if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl)
    setPdfBlobUrl(null)
    setViewingPDF(false)
  }

  // ═══════════════════════════════════════════
  // COMPUTED VALUES
  // ═══════════════════════════════════════════
  const filtered = pegawai.filter(p =>
    p.nama?.toLowerCase().includes(search.toLowerCase()) ||
    p.nip?.includes(search)
  )

  const filterFolderList = (fList, bList, q) =>
    fList.filter((folder) => {
      if (!q.trim()) return true
      const s = q.toLowerCase()
      if (folder.nama_folder?.toLowerCase().includes(s)) return true
      if (folder.level_folder?.toLowerCase().includes(s)) return true
      if (bList.filter(b => b.folder_id === folder.id).some(b => b.nama_berkas?.toLowerCase().includes(s))) return true
      return false
    })

  const filteredSelfFolders = filterFolderList(selfFolders, selfBerkas, selfFolderSearch)
  const filteredStaffFolders = filterFolderList(folders, berkas, folderSearch)

  // Kelengkapan berkas diri
  const selfFoldersFilled = selfFolders.filter(f => selfBerkas.some(b => b.folder_id === f.id)).length
  const selfCompleteness = selfFolders.length > 0
    ? Math.round((selfFoldersFilled / selfFolders.length) * 100)
    : 0

  // ═══════════════════════════════════════════
  // REUSABLE: Render Profil Info
  // ═══════════════════════════════════════════
  const renderProfileCard = (profile) => (
    <div className="bg-white rounded-xl shadow-sm border p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold ${
          isPimpinan ? 'bg-blue-500' : 'bg-purple-500'
        }`}>
          {profile.nama?.[0]}
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-800">{profile.nama}</h2>
          <p className="text-sm text-gray-500">NIP: {profile.nip}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { l: 'NIK', v: profile.nik },
          { l: 'Tgl Lahir', v: profile.tanggal_lahir ? new Date(profile.tanggal_lahir).toLocaleDateString('id-ID') : '-' },
          { l: 'Usia', v: profile.usia ? `${profile.usia} th` : '-' },
          { l: 'Pangkat/Gol', v: profile.pangkat_gol_ruang },
          { l: 'Jabatan', v: profile.jabatan },
          { l: 'Jenjang', v: profile.jenjang_jabatan },
          { l: 'Kelompok', v: profile.kelompok_jabatan },
          { l: 'Kelas', v: profile.kelas_jabatan },
          { l: 'TMT CPNS', v: profile.tmt_cpns ? new Date(profile.tmt_cpns).toLocaleDateString('id-ID') : '-' },
          { l: 'Masa Kerja', v: `${profile.masa_kerja_tahun || 0}th ${profile.masa_kerja_bulan || 0}bl ${profile.masa_kerja_hari || 0}hr` },
          { l: 'Pimpinan Lsg', v: profile.nama_pimpinan_langsung },
          { l: 'NIP Pimpinan Lsg', v: profile.nip_pimpinan_langsung },
        ].map((x, i) => (
          <div key={i} className="bg-gray-50 rounded p-2">
            <p className="text-xs text-gray-400">{x.l}</p>
            <p className="text-xs font-medium text-gray-700 truncate">{x.v || '-'}</p>
          </div>
        ))}
      </div>
    </div>
  )

  // ═══════════════════════════════════════════
  // REUSABLE: Render Folder & Berkas
  // ═══════════════════════════════════════════
  const renderFolderBerkas = ({
    folderList,
    berkasList,
    searchVal,
    setSearchVal,
    editable = false,
  }) => {
    const filteredList = filterFolderList(folderList, berkasList, searchVal)
    const totalMatched = filteredList.reduce((acc, f) =>
      acc + berkasList.filter(b => b.folder_id === f.id).length, 0
    )

    return (
      <div className="bg-white rounded-xl shadow-sm border">
        {/* Header */}
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">📁 Folder & Berkas</h3>
            <span className="text-xs text-gray-400">
              {searchVal.trim()
                ? `${filteredList.length} folder · ${totalMatched} berkas`
                : `${folderList.length} folder · ${berkasList.length} berkas`
              }
            </span>
          </div>

          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              placeholder="🔍 Cari folder / berkas / level..."
              className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500 pr-8"
            />
            {searchVal && (
              <button
                onClick={() => setSearchVal('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg"
              >✕</button>
            )}
          </div>

          {/* Quick filter chips */}
          <div className="flex flex-wrap gap-1.5">
            {['Sangat Penting', 'Penting', 'Biasa'].map((level) => {
              const count = folderList.filter(f => f.level_folder === level).length
              if (count === 0) return null
              const isActive = searchVal === level
              return (
                <button
                  key={level}
                  onClick={() => setSearchVal(isActive ? '' : level)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition ${
                    isActive
                      ? level === 'Sangat Penting' ? 'bg-red-500 text-white border-red-500'
                        : level === 'Penting' ? 'bg-yellow-500 text-white border-yellow-500'
                        : 'bg-gray-500 text-white border-gray-500'
                      : level === 'Sangat Penting' ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                        : level === 'Penting' ? 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  {level} ({count})
                </button>
              )
            })}
          </div>
        </div>

        {/* Folder list */}
        <div className="p-4 space-y-3 overflow-y-auto" style={{ maxHeight: '55vh' }}>
          {filteredList.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <span className="text-4xl block mb-2">🔍</span>
              <p className="text-sm">Tidak ada folder yang cocok dengan "<b>{searchVal}</b>"</p>
              <button onClick={() => setSearchVal('')} className="mt-2 text-xs text-orange-500 hover:underline">
                Hapus pencarian
              </button>
            </div>
          ) : (
            filteredList.map((folder) => {
              const fb = berkasList.filter(b => b.folder_id === folder.id)
              const isEmpty = fb.length === 0
              return (
                <div key={folder.id} className={`border rounded-lg overflow-hidden ${
                  editable && isEmpty ? 'border-red-200' : ''
                }`}>
                  <div className="bg-gray-50 px-3 py-2 flex items-center gap-2 flex-wrap">
                    <span>📁</span>
                    <span className="font-medium text-sm">{folder.nama_folder}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      folder.level_folder === 'Sangat Penting' ? 'bg-red-100 text-red-600' :
                      folder.level_folder === 'Penting' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{folder.level_folder}</span>
                    <span className="text-xs text-gray-400">({fb.length})</span>

                    {editable && isEmpty && (
                      <span className="text-xs text-red-500 ml-auto">⚠️ Belum diisi</span>
                    )}

                    {/* Tombol upload (hanya di mode editable / Data Saya) */}
                    {editable && (
                      <button
                        onClick={() => openUploadModal(folder.id)}
                        className="ml-auto bg-orange-500 text-white text-xs px-2.5 py-1 rounded-lg hover:bg-orange-600 transition"
                      >
                        ➕ Upload
                      </button>
                    )}
                  </div>
                  <div className="p-2">
                    {isEmpty ? (
                      <p className="text-xs text-gray-400 text-center py-2">
                        {editable ? 'Belum ada berkas. Klik Upload untuk menambahkan.' : 'Kosong'}
                      </p>
                    ) : (
                      fb.map((b) => {
                        const isHighlighted = searchVal.trim() &&
                          b.nama_berkas?.toLowerCase().includes(searchVal.toLowerCase())
                        return (
                          <div
                            key={b.id}
                            className={`flex items-center justify-between p-2 rounded hover:bg-gray-100 mb-1 ${
                              isHighlighted ? 'bg-orange-50 border border-orange-200' : 'bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span>📄</span>
                              <p className={`text-sm font-medium truncate ${isHighlighted ? 'text-orange-700' : ''}`}>
                                {b.nama_berkas}
                                {isHighlighted && <span className="ml-1 text-xs text-orange-400">✦</span>}
                              </p>
                            </div>
                            <div className="flex gap-1 shrink-0 ml-2">
                              <button onClick={() => viewBerkas(b)}
                                className="bg-green-100 text-green-600 px-2 py-1 rounded text-xs hover:bg-green-200">
                                👁️ Lihat
                              </button>
                              <button onClick={() => downloadBerkas(b)}
                                className="bg-blue-100 text-blue-600 px-2 py-1 rounded text-xs hover:bg-blue-200">
                                ⬇️
                              </button>
                              {editable && (
                                <button onClick={() => deleteSelfBerkas(b)}
                                  className="bg-red-100 text-red-600 px-2 py-1 rounded text-xs hover:bg-red-200">
                                  🗑️
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════
  // LOADING
  // ═══════════════════════════════════════════
  if (loadingSelf && loadingStaff) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin h-10 w-10 border-t-4 border-orange-500 rounded-full"></div>
      </div>
    )
  }

  // ═══════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════
  return (
    <div>
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          {isPimpinan ? '👑 Dashboard Pimpinan' : '👔 Dashboard Pejabat'}
        </h1>
        <p className="text-gray-500 text-sm">
          Kelola berkas diri Anda dan {isPimpinan ? 'lihat data semua pegawai' : 'cek data anak buah langsung'}
        </p>
      </div>

      {/* ═══ TAB NAVIGATION ═══ */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('self')}
          className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            activeTab === 'self'
              ? 'bg-white shadow-sm text-orange-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          🧑‍💼 Data Saya
          {selfCompleteness < 100 && (
            <span className="bg-red-100 text-red-600 text-xs px-1.5 py-0.5 rounded-full font-bold">
              {selfCompleteness}%
            </span>
          )}
          {selfCompleteness === 100 && (
            <span className="bg-green-100 text-green-600 text-xs px-1.5 py-0.5 rounded-full font-bold">
              ✓
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('staff')}
          className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
            activeTab === 'staff'
              ? 'bg-white shadow-sm text-orange-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          👥 {isPimpinan ? 'Semua Pegawai' : 'Anak Buah'}
          <span className="bg-gray-200 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">
            {pegawai.length}
          </span>
        </button>
      </div>

      {/* ═══════════════════════════════════════ */}
      {/* TAB 1: DATA SAYA                       */}
      {/* ═══════════════════════════════════════ */}
      {activeTab === 'self' && (
        <div className="space-y-4">

          {/* Progress Bar Kelengkapan */}
          <div className={`rounded-xl p-4 border ${
            selfCompleteness === 100
              ? 'bg-green-50 border-green-200'
              : selfCompleteness >= 50
                ? 'bg-yellow-50 border-yellow-200'
                : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">
                  {selfCompleteness === 100 ? '✅' : selfCompleteness >= 50 ? '⚠️' : '❌'}
                </span>
                <div>
                  <p className={`font-semibold text-sm ${
                    selfCompleteness === 100 ? 'text-green-700'
                      : selfCompleteness >= 50 ? 'text-yellow-700'
                      : 'text-red-700'
                  }`}>
                    Kelengkapan Berkas: {selfCompleteness}%
                  </p>
                  <p className="text-xs text-gray-500">
                    {selfFoldersFilled} dari {selfFolders.length} folder sudah terisi
                  </p>
                </div>
              </div>
              {selfCompleteness < 100 && (
                <span className="text-xs text-gray-400 hidden sm:block">
                  💡 Lengkapi semua folder di bawah
                </span>
              )}
            </div>
            <div className="w-full bg-white/60 rounded-full h-3 overflow-hidden">
              <div
                className={`h-3 rounded-full transition-all duration-500 ${
                  selfCompleteness === 100 ? 'bg-green-500'
                    : selfCompleteness >= 50 ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${selfCompleteness}%` }}
              />
            </div>
          </div>

          {loadingSelf ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin h-8 w-8 border-t-4 border-orange-500 rounded-full"></div>
            </div>
          ) : selfProfile ? (
            <>
              {renderProfileCard(selfProfile)}
              {renderFolderBerkas({
                folderList: selfFolders,
                berkasList: selfBerkas,
                searchVal: selfFolderSearch,
                setSearchVal: setSelfFolderSearch,
                editable: true,
              })}
            </>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
              <span className="text-5xl">🧑‍💼</span>
              <h2 className="text-lg font-bold text-yellow-800 mt-4">Profil Belum Ditemukan</h2>
              <p className="text-yellow-600 mt-2 text-sm">
                Data profil Anda belum tersedia. Hubungi Admin untuk dibuatkan.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* TAB 2: ANAK BUAH / SEMUA PEGAWAI       */}
      {/* ═══════════════════════════════════════ */}
      {activeTab === 'staff' && (
        <div>
          {/* Info Banner */}
          <div className={`rounded-lg p-3 mb-6 flex items-start gap-2 ${
            isPimpinan ? 'bg-blue-50 border border-blue-200' : 'bg-purple-50 border border-purple-200'
          }`}>
            <span className="mt-0.5">ℹ️</span>
            <div>
              {isPimpinan ? (
                <p className="text-sm text-blue-700">
                  Mode <b>READ ONLY</b> — Anda bisa melihat data <b>semua pegawai</b>.
                </p>
              ) : (
                <>
                  <p className="text-sm text-purple-700">
                    Mode <b>READ ONLY</b> — Anda hanya bisa melihat data <b>anak buah langsung</b>.
                  </p>
                  <p className="text-xs text-purple-500 mt-1">
                    Filter: NIP Pimpinan Langsung = <b>{user?.profile?.nip || '-'}</b>
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Tidak ada anak buah */}
          {isPejabat && pegawai.length === 0 && !loadingStaff && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
              <span className="text-5xl">👥</span>
              <h2 className="text-lg font-bold text-yellow-800 mt-4">Belum Ada Anak Buah</h2>
              <p className="text-yellow-600 mt-2 text-sm">
                Tidak ada pegawai dengan NIP Pimpinan Langsung = <b>{user?.profile?.nip}</b>
              </p>
              <p className="text-yellow-500 text-xs mt-1">
                Hubungi Admin untuk mengisi field "NIP Pimpinan Langsung" pada data pegawai.
              </p>
            </div>
          )}

          {loadingStaff ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin h-8 w-8 border-t-4 border-orange-500 rounded-full"></div>
            </div>
          ) : pegawai.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* LEFT: LIST PEGAWAI */}
              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border flex flex-col" style={{ maxHeight: '85vh' }}>
                <div className="p-4 border-b">
                  <h2 className="font-semibold text-sm mb-3">
                    👥 {isPejabat ? 'Anak Buah' : 'Pegawai'} ({pegawai.length})
                  </h2>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="🔍 Cari nama / NIP..."
                    className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div className="overflow-y-auto flex-1">
                  {filtered.length === 0 ? (
                    <p className="p-4 text-gray-400 text-center text-sm">Tidak ditemukan</p>
                  ) : (
                    filtered.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => selectPegawai(p)}
                        className={`p-3 border-b cursor-pointer hover:bg-gray-50 transition ${
                          selectedPegawai?.id === p.id
                            ? isPimpinan
                              ? 'bg-blue-50 border-l-4 border-l-blue-500'
                              : 'bg-purple-50 border-l-4 border-l-purple-500'
                            : ''
                        }`}
                      >
                        <p className="font-medium text-sm truncate">{p.nama}</p>
                        <p className="text-xs text-gray-500">NIP: {p.nip}</p>
                        <p className="text-xs text-gray-400">{p.jabatan}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* RIGHT: DETAIL PEGAWAI */}
              <div className="lg:col-span-3 space-y-4">
                {selectedPegawai ? (
                  <>
                    {renderProfileCard(selectedPegawai)}
                    {renderFolderBerkas({
                      folderList: folders,
                      berkasList: berkas,
                      searchVal: folderSearch,
                      setSearchVal: setFolderSearch,
                      editable: false,
                    })}
                  </>
                ) : (
                  <div className="bg-white rounded-xl shadow-sm border flex flex-col items-center justify-center h-96 text-gray-400">
                    <span className="text-5xl mb-4">👈</span>
                    <p className="text-sm">Pilih {isPejabat ? 'anak buah' : 'pegawai'} dari daftar</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* MODAL UPLOAD BERKAS                     */}
      {/* ═══════════════════════════════════════ */}
      {uploadFolderId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold text-gray-800">
                ➕ Upload Berkas
              </h3>
              <button onClick={closeUploadModal} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-4 space-y-4">
              {/* Nama folder yang dipilih */}
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-xs text-orange-500">Folder tujuan:</p>
                <p className="font-medium text-sm text-orange-700">
                  📁 {selfFolders.find(f => f.id === uploadFolderId)?.nama_folder || '-'}
                </p>
              </div>

              {/* Nama berkas */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Berkas *</label>
                <input
                  type="text"
                  value={uploadNamaBerkas}
                  onChange={(e) => setUploadNamaBerkas(e.target.value)}
                  placeholder="Contoh: SK Kenaikan Pangkat 2024"
                  className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* File input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">File *</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.zip,.jpg,.jpeg,.png"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 border rounded-lg text-sm file:mr-3 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:bg-orange-100 file:text-orange-600 hover:file:bg-orange-200"
                />
                <p className="text-xs text-gray-400 mt-1">Format: PDF, ZIP, JPG, PNG</p>
              </div>
            </div>
            <div className="p-4 border-t flex gap-2 justify-end">
              <button
                onClick={closeUploadModal}
                className="px-4 py-2 rounded-lg border text-sm text-gray-600 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="px-4 py-2 rounded-lg bg-orange-500 text-white text-sm hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2"
              >
                {uploading ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Mengupload...
                  </>
                ) : (
                  '📤 Upload'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* PDF VIEWER                              */}
      {/* ═══════════════════════════════════════ */}
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
                  <p className="text-gray-500">Loading...</p>
                </div>
              ) : pdfBlobUrl ? (
                <iframe src={pdfBlobUrl} className="w-full h-full" title="PDF" />
              ) : (
                <div className="flex items-center justify-center h-full text-red-500">Gagal memuat</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PimpinanPegawaiPage