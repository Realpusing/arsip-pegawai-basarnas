import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { downloadFromGoogleDrive, decompressZip, extractFileId } from '../../lib/googleDrive'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

function PimpinanPegawaiPage() {
  const { user, levelName, isPimpinan, isPejabat } = useAuth()

  const [pegawai, setPegawai] = useState([])
  const [folders, setFolders] = useState([])
  const [berkas, setBerkas] = useState([])
  const [selectedPegawai, setSelectedPegawai] = useState(null)
  const [search, setSearch] = useState('')
  const [folderSearch, setFolderSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [viewingPDF, setViewingPDF] = useState(false)
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null)
  const [loadingPDF, setLoadingPDF] = useState(false)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const { data: folderData } = await supabase
        .from('folder')
        .select('*')
        .order('created_at')
      if (folderData) setFolders(folderData)

      if (isPimpinan) {
        const { data } = await supabase
          .from('profile')
          .select('*, tingkat:tingkat_id(nama)')
          .order('nama')
        if (data) setPegawai(data)

      } else if (isPejabat) {
        const pejabatProfile = user?.profile

        if (pejabatProfile?.nip) {
          const { data } = await supabase
            .from('profile')
            .select('*, tingkat:tingkat_id(nama)')
            .eq('nip_pimpinan_langsung', pejabatProfile.nip)
            .order('nama')
          if (data) setPegawai(data)
        } else {
          setPegawai([])
        }
      }
    } catch (error) {
      toast.error('Gagal memuat data')
    } finally {
      setLoading(false)
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

  const filtered = pegawai.filter(p =>
    p.nama.toLowerCase().includes(search.toLowerCase()) ||
    p.nip.includes(search)
  )

  // ✅ Filter folders berdasarkan pencarian (nama folder, level, atau nama berkas di dalamnya)
  const filteredFolders = folders.filter((folder) => {
    if (!folderSearch.trim()) return true
    const q = folderSearch.toLowerCase()
    // Cocokkan nama folder
    if (folder.nama_folder?.toLowerCase().includes(q)) return true
    // Cocokkan level folder
    if (folder.level_folder?.toLowerCase().includes(q)) return true
    // Cocokkan nama berkas di dalam folder
    const fb = berkas.filter((b) => b.folder_id === folder.id)
    if (fb.some((b) => b.nama_berkas?.toLowerCase().includes(q))) return true
    return false
  })

  // ✅ Hitung total berkas yang cocok
  const totalMatchedBerkas = filteredFolders.reduce((acc, folder) => {
    return acc + berkas.filter((b) => b.folder_id === folder.id).length
  }, 0)

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin h-10 w-10 border-t-4 border-orange-500 rounded-full"></div>
      </div>
    )
  }

  return (
    <div>
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          {isPimpinan ? '👑 Pimpinan - Lihat Semua Pegawai' : '👔 Pejabat - Data Anak Buah'}
        </h1>
        <p className="text-gray-500 text-sm">
          {isPimpinan
            ? 'Lihat dan download berkas semua pegawai (read only)'
            : 'Lihat dan download berkas anak buah langsung Anda (read only)'}
        </p>
      </div>

      {/* INFO BANNER */}
      <div className={`rounded-lg p-3 mb-6 flex items-start gap-2 ${
        isPimpinan
          ? 'bg-blue-50 border border-blue-200'
          : 'bg-purple-50 border border-purple-200'
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
                Filter: pegawai yang NIP Pimpinan Langsung = <b>{user?.profile?.nip || '-'}</b>
              </p>
            </>
          )}
        </div>
      </div>

      {/* PEJABAT: Tidak ada anak buah */}
      {isPejabat && pegawai.length === 0 && !loading && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
          <span className="text-5xl">👥</span>
          <h2 className="text-lg font-bold text-yellow-800 mt-4">Belum Ada Anak Buah</h2>
          <p className="text-yellow-600 mt-2 text-sm">
            Tidak ada pegawai yang NIP Pimpinan Langsungnya = <b>{user?.profile?.nip}</b>
          </p>
          <p className="text-yellow-500 text-xs mt-1">
            Hubungi Admin untuk mengisi field "NIP Pimpinan Langsung" di data pegawai.
          </p>
        </div>
      )}

      {/* MAIN CONTENT */}
      {pegawai.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* LEFT: LIST */}
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

          {/* RIGHT: DETAIL */}
          <div className="lg:col-span-3 space-y-4">
            {selectedPegawai ? (
              <>
                {/* Info */}
                <div className="bg-white rounded-xl shadow-sm border p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold ${
                      isPimpinan ? 'bg-blue-500' : 'bg-purple-500'
                    }`}>
                      {selectedPegawai.nama?.[0]}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-800">{selectedPegawai.nama}</h2>
                      <p className="text-sm text-gray-500">NIP: {selectedPegawai.nip}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { l: 'NIK', v: selectedPegawai.nik },
                      { l: 'Tgl Lahir', v: selectedPegawai.tanggal_lahir ? new Date(selectedPegawai.tanggal_lahir).toLocaleDateString('id-ID') : '-' },
                      { l: 'Usia', v: selectedPegawai.usia ? `${selectedPegawai.usia} th` : '-' },
                      { l: 'Pangkat/Gol', v: selectedPegawai.pangkat_gol_ruang },
                      { l: 'Jabatan', v: selectedPegawai.jabatan },
                      { l: 'Jenjang', v: selectedPegawai.jenjang_jabatan },
                      { l: 'Kelompok', v: selectedPegawai.kelompok_jabatan },
                      { l: 'Kelas', v: selectedPegawai.kelas_jabatan },
                      { l: 'TMT CPNS', v: selectedPegawai.tmt_cpns ? new Date(selectedPegawai.tmt_cpns).toLocaleDateString('id-ID') : '-' },
                      { l: 'Masa Kerja', v: `${selectedPegawai.masa_kerja_tahun || 0}th ${selectedPegawai.masa_kerja_bulan || 0}bl ${selectedPegawai.masa_kerja_hari || 0}hr` },
                      { l: 'Pimpinan Lsg', v: selectedPegawai.nama_pimpinan_langsung },
                      { l: 'NIP Pimpinan Lsg', v: selectedPegawai.nip_pimpinan_langsung },
                    ].map((x, i) => (
                      <div key={i} className="bg-gray-50 rounded p-2">
                        <p className="text-xs text-gray-400">{x.l}</p>
                        <p className="text-xs font-medium text-gray-700 truncate">{x.v || '-'}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ✅ Folders & Berkas dengan SEARCH */}
                <div className="bg-white rounded-xl shadow-sm border">
                  <div className="p-4 border-b space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm">📁 Folder & Berkas</h3>
                      <span className="text-xs text-gray-400">
                        {folderSearch.trim()
                          ? `${filteredFolders.length} folder ditemukan · ${totalMatchedBerkas} berkas`
                          : `${folders.length} folder · ${berkas.length} berkas`
                        }
                      </span>
                    </div>

                    {/* 🔍 SEARCH FOLDER */}
                    <div className="relative">
                      <input
                        type="text"
                        value={folderSearch}
                        onChange={(e) => setFolderSearch(e.target.value)}
                        placeholder="🔍 Cari folder / berkas / level..."
                        className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500 pr-8"
                      />
                      {folderSearch && (
                        <button
                          onClick={() => setFolderSearch('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg"
                          title="Hapus pencarian"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* ✅ Quick filter chips */}
                    <div className="flex flex-wrap gap-1.5">
                      {['Sangat Penting', 'Penting', 'Biasa'].map((level) => {
                        const count = folders.filter(f => f.level_folder === level).length
                        if (count === 0) return null
                        const isActive = folderSearch === level
                        return (
                          <button
                            key={level}
                            onClick={() => setFolderSearch(isActive ? '' : level)}
                            className={`text-xs px-2.5 py-1 rounded-full border transition ${
                              isActive
                                ? level === 'Sangat Penting'
                                  ? 'bg-red-500 text-white border-red-500'
                                  : level === 'Penting'
                                    ? 'bg-yellow-500 text-white border-yellow-500'
                                    : 'bg-gray-500 text-white border-gray-500'
                                : level === 'Sangat Penting'
                                  ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                                  : level === 'Penting'
                                    ? 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100'
                                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            {level} ({count})
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="p-4 space-y-3 overflow-y-auto" style={{ maxHeight: '55vh' }}>
                    {filteredFolders.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <span className="text-4xl block mb-2">🔍</span>
                        <p className="text-sm">Tidak ada folder yang cocok dengan "<b>{folderSearch}</b>"</p>
                        <button
                          onClick={() => setFolderSearch('')}
                          className="mt-2 text-xs text-orange-500 hover:underline"
                        >
                          Hapus pencarian
                        </button>
                      </div>
                    ) : (
                      filteredFolders.map((folder) => {
                        const fb = berkas.filter((b) => b.folder_id === folder.id)
                        return (
                          <div key={folder.id} className="border rounded-lg overflow-hidden">
                            <div className="bg-gray-50 px-3 py-2 flex items-center gap-2">
                              <span>📁</span>
                              <span className="font-medium text-sm">{folder.nama_folder}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                folder.level_folder === 'Sangat Penting' ? 'bg-red-100 text-red-600' :
                                folder.level_folder === 'Penting' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>{folder.level_folder}</span>
                              <span className="text-xs text-gray-400">({fb.length})</span>
                            </div>
                            <div className="p-2">
                              {fb.length === 0 ? (
                                <p className="text-xs text-gray-400 text-center py-2">Kosong</p>
                              ) : (
                                fb.map((b) => {
                                  // ✅ Highlight berkas yang cocok dengan pencarian
                                  const isHighlighted = folderSearch.trim() &&
                                    b.nama_berkas?.toLowerCase().includes(folderSearch.toLowerCase())

                                  return (
                                    <div
                                      key={b.id}
                                      className={`flex items-center justify-between p-2 rounded hover:bg-gray-100 mb-1 ${
                                        isHighlighted
                                          ? 'bg-orange-50 border border-orange-200'
                                          : 'bg-gray-50'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <span>📄</span>
                                        <p className={`text-sm font-medium truncate ${
                                          isHighlighted ? 'text-orange-700' : ''
                                        }`}>
                                          {b.nama_berkas}
                                          {isHighlighted && (
                                            <span className="ml-1 text-xs text-orange-400">✦</span>
                                          )}
                                        </p>
                                      </div>
                                      <div className="flex gap-1 shrink-0 ml-2">
                                        <button
                                          onClick={() => viewBerkas(b)}
                                          className="bg-green-100 text-green-600 px-2 py-1 rounded text-xs hover:bg-green-200"
                                        >
                                          👁️ Lihat
                                        </button>
                                        <button
                                          onClick={() => downloadBerkas(b)}
                                          className="bg-blue-100 text-blue-600 px-2 py-1 rounded text-xs hover:bg-blue-200"
                                        >
                                          ⬇️
                                        </button>
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

      {/* PDF Viewer */}
      {viewingPDF && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-5xl h-[90vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold">📄 PDF Viewer</h3>
              <button
                onClick={closePDF}
                className="bg-red-500 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-red-600"
              >
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