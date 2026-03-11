import React, { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useUpload } from '../context/UploadContext'
import toast from 'react-hot-toast'

function PegawaiPage() {
  const { isAdmin } = useAuth()
  const { addUpload } = useUpload()

  // ========== STATE ==========
  const [pegawai, setPegawai] = useState([])
  const [folders, setFolders] = useState([])
  const [berkas, setBerkas] = useState([])
  const [selectedPegawai, setSelectedPegawai] = useState(null)
  const [searchPegawai, setSearchPegawai] = useState('')
  const [loading, setLoading] = useState(true)

  // Modals
  const [modal, setModal] = useState(null) // 'addPegawai','editPegawai','addFolder','editFolder','uploadBerkas','viewPDF'
  const [modalData, setModalData] = useState(null)

  const fileInputRef = useRef(null)

  // ========== LOAD ==========
  useEffect(() => { loadPegawai(); loadFolders() }, [])

  const loadPegawai = async () => {
    const { data } = await supabase.from('profile').select('*, tingkat:tingkat_id(nama)').order('nama')
    if (data) setPegawai(data)
    setLoading(false)
  }

  const loadFolders = async () => {
    const { data } = await supabase.from('folder').select('*').order('created_at')
    if (data) setFolders(data)
  }

  const loadBerkas = useCallback(async (profileId) => {
    const { data } = await supabase.from('berkas').select('*, folder:folder_id(nama_folder, level_folder)').eq('profile_id', profileId).order('created_at')
    if (data) setBerkas(data)
  }, [])

  const selectPegawai = (p) => { setSelectedPegawai(p); loadBerkas(p.id) }

  const refreshAll = () => { loadPegawai(); loadFolders(); if (selectedPegawai) loadBerkas(selectedPegawai.id) }

  // ========== PEGAWAI CRUD ==========
  const handleSavePegawai = async (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    const data = {
      nama: fd.get('nama'), nip: fd.get('nip'), nik: fd.get('nik'),
      tanggal_lahir: fd.get('tanggal_lahir'), pangkat_gol_ruang: fd.get('pangkat_gol_ruang'),
      jabatan: fd.get('jabatan'), jenjang_jabatan: fd.get('jenjang_jabatan'),
      kelompok_jabatan: fd.get('kelompok_jabatan'), kelas_jabatan: fd.get('kelas_jabatan'),
      tmt_cpns: fd.get('tmt_cpns') || null,
      nama_pimpinan_langsung: fd.get('nama_pimpinan_langsung'),
      nip_pimpinan_langsung: fd.get('nip_pimpinan_langsung'),
      jabatan_pimpinan_langsung: fd.get('jabatan_pimpinan_langsung'),
      nama_pimpinan: fd.get('nama_pimpinan'), nip_pimpinan: fd.get('nip_pimpinan'),
      jabatan_pimpinan: fd.get('jabatan_pimpinan'),
      tingkat_id: fd.get('tingkat_id') ? parseInt(fd.get('tingkat_id')) : null
    }
    try {
      if (modal === 'editPegawai') {
        const { error } = await supabase.from('profile').update(data).eq('id', modalData.id)
        if (error) throw error
        toast.success('Pegawai diupdate!')
        if (selectedPegawai?.id === modalData.id) {
          const { data: updated } = await supabase.from('profile').select('*, tingkat:tingkat_id(nama)').eq('id', modalData.id).single()
          if (updated) setSelectedPegawai(updated)
        }
      } else {
        const { error } = await supabase.from('profile').insert(data)
        if (error) throw error
        toast.success('Pegawai ditambahkan!')
      }
      setModal(null); setModalData(null); loadPegawai()
    } catch (err) { toast.error('Gagal: ' + err.message) }
  }

  const deletePegawai = async (p) => {
    if (!window.confirm(`Hapus "${p.nama}"? Semua berkas ikut terhapus!`)) return
    try {
      const { data: bd } = await supabase.from('berkas').select('lokasi_berkas').eq('profile_id', p.id)
      if (bd?.length > 0) {
        const paths = bd.map(b => { const s = b.lokasi_berkas.split('/berkas-pegawai/'); return s[1] ? decodeURIComponent(s[1]) : null }).filter(Boolean)
        if (paths.length > 0) await supabase.storage.from('berkas-pegawai').remove(paths)
      }
      await supabase.from('profile').delete().eq('id', p.id)
      toast.success('Pegawai dihapus!')
      if (selectedPegawai?.id === p.id) { setSelectedPegawai(null); setBerkas([]) }
      loadPegawai()
    } catch (err) { toast.error('Gagal: ' + err.message) }
  }

  // ========== FOLDER CRUD (GLOBAL) ==========
  const handleSaveFolder = async (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    const data = { nama_folder: fd.get('nama_folder'), level_folder: fd.get('level_folder') }
    try {
      if (modal === 'editFolder') {
        const { error } = await supabase.from('folder').update(data).eq('id', modalData.id)
        if (error) throw error
        toast.success('Folder diupdate!')
      } else {
        const { error } = await supabase.from('folder').insert(data)
        if (error) throw error
        toast.success('Folder dibuat!')
      }
      setModal(null); setModalData(null); loadFolders()
    } catch (err) { toast.error('Gagal: ' + err.message) }
  }

  const deleteFolder = async (folder) => {
    if (!window.confirm(`Hapus folder "${folder.nama_folder}"? Semua berkas di dalam folder ini akan terhapus!`)) return
    try {
      const { data: bd } = await supabase.from('berkas').select('lokasi_berkas').eq('folder_id', folder.id)
      if (bd?.length > 0) {
        const paths = bd.map(b => { const s = b.lokasi_berkas.split('/berkas-pegawai/'); return s[1] ? decodeURIComponent(s[1]) : null }).filter(Boolean)
        if (paths.length > 0) await supabase.storage.from('berkas-pegawai').remove(paths)
      }
      await supabase.from('folder').delete().eq('id', folder.id)
      toast.success('Folder dihapus!')
      loadFolders(); if (selectedPegawai) loadBerkas(selectedPegawai.id)
    } catch (err) { toast.error('Gagal: ' + err.message) }
  }

  // ========== BERKAS UPLOAD (BACKGROUND) ==========
  const handleUploadBerkas = async (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    const file = fd.get('file_pdf')
    const namaBerkas = fd.get('nama_berkas')
    const folderId = parseInt(modalData.folderId)
    const folder = folders.find(f => f.id === folderId)

    if (!file || file.size === 0) { toast.error('Pilih file PDF!'); return }
    if (file.type !== 'application/pdf') { toast.error('Hanya file PDF!'); return }
    if (file.size > 50 * 1024 * 1024) { toast.error('Maksimal 50MB!'); return }

    // TUTUP MODAL - upload jalan di background
    setModal(null)
    setModalData(null)
    toast('Upload dimulai di background...', { icon: '📤' })

    // Upload via context (background)
    const success = await addUpload({
      file,
      namaBerkas,
      folderId,
      profileId: selectedPegawai.id,
      folderName: folder?.nama_folder || 'Unknown',
      pegawaiName: selectedPegawai.nama
    })

    // Refresh data setelah upload selesai
    if (success) loadBerkas(selectedPegawai.id)
  }

  const deleteBerkas = async (b) => {
    if (!window.confirm(`Hapus "${b.nama_berkas}"?`)) return
    try {
      const s = b.lokasi_berkas.split('/berkas-pegawai/')
      if (s[1]) await supabase.storage.from('berkas-pegawai').remove([decodeURIComponent(s[1])])
      await supabase.from('berkas').delete().eq('id', b.id)
      toast.success('Berkas dihapus!')
      loadBerkas(selectedPegawai.id)
    } catch (err) { toast.error('Gagal: ' + err.message) }
  }

  // ========== FILTER ==========
  const filtered = pegawai.filter(p =>
    p.nama.toLowerCase().includes(searchPegawai.toLowerCase()) || p.nip.includes(searchPegawai)
  )

  // ========== RENDER ==========
  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin h-10 w-10 border-t-4 border-orange-500 rounded-full"></div></div>

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Data Pegawai</h1>
        <p className="text-gray-500 text-sm">Kelola data pegawai, folder, dan berkas dokumen</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ===== LEFT: DAFTAR PEGAWAI ===== */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border flex flex-col" style={{ maxHeight: '85vh' }}>
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-800 text-sm">👥 Pegawai ({pegawai.length})</h2>
              {isAdmin && (
                <button onClick={() => { setModal('addPegawai'); setModalData(null) }}
                  className="bg-orange-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-orange-600">
                  + Tambah
                </button>
              )}
            </div>
            <input type="text" value={searchPegawai} onChange={e => setSearchPegawai(e.target.value)}
              placeholder="🔍 Cari nama atau NIP..." className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
          </div>

          <div className="overflow-y-auto flex-1">
            {filtered.map(p => (
              <div key={p.id} onClick={() => selectPegawai(p)}
                className={`p-3 border-b cursor-pointer hover:bg-gray-50 transition ${selectedPegawai?.id === p.id ? 'bg-orange-50 border-l-4 border-l-orange-500' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-800 text-sm truncate">{p.nama}</p>
                    <p className="text-xs text-gray-500">NIP: {p.nip}</p>
                    <p className="text-xs text-gray-400">{p.jabatan}</p>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1 ml-2 shrink-0">
                      <button onClick={e => { e.stopPropagation(); setModal('editPegawai'); setModalData(p) }} className="hover:bg-blue-100 p-1 rounded" title="Edit">✏️</button>
                      <button onClick={e => { e.stopPropagation(); deletePegawai(p) }} className="hover:bg-red-100 p-1 rounded" title="Hapus">🗑️</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ===== RIGHT: DETAIL + FOLDER + BERKAS ===== */}
        <div className="lg:col-span-3 space-y-4">
          {selectedPegawai ? (
            <>
              {/* Info Pegawai */}
              <div className="bg-white rounded-xl shadow-sm border p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-white text-lg font-bold">{selectedPegawai.nama?.[0]}</div>
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
                    { l: 'Pimpinan', v: selectedPegawai.nama_pimpinan },
                  ].map((item, i) => (
                    <div key={i} className="bg-gray-50 rounded p-2">
                      <p className="text-xs text-gray-400">{item.l}</p>
                      <p className="text-xs font-medium text-gray-700 truncate">{item.v || '-'}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Folder & Berkas */}
              <div className="bg-white rounded-xl shadow-sm border">
                <div className="p-4 border-b flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800 text-sm">📁 Folder & Berkas</h3>
                  {isAdmin && (
                    <button onClick={() => { setModal('addFolder'); setModalData(null) }}
                      className="bg-orange-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-orange-600">
                      + Folder Baru (Global)
                    </button>
                  )}
                </div>

                <div className="p-4 space-y-3 overflow-y-auto" style={{ maxHeight: '55vh' }}>
                  {folders.length === 0 ? (
                    <p className="text-center text-gray-400 py-8 text-sm">Belum ada folder</p>
                  ) : (
                    folders.map(folder => {
                      const fb = berkas.filter(b => b.folder_id === folder.id)
                      return (
                        <div key={folder.id} className="border rounded-lg overflow-hidden">
                          {/* Folder Header */}
                          <div className="bg-gray-50 px-3 py-2 flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span>📁</span>
                              <span className="font-medium text-sm truncate">{folder.nama_folder}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                                folder.level_folder === 'Sangat Penting' ? 'bg-red-100 text-red-600' :
                                folder.level_folder === 'Penting' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>{folder.level_folder}</span>
                              <span className="text-xs text-gray-400">({fb.length})</span>
                            </div>
                            {isAdmin && (
                              <div className="flex gap-1 shrink-0">
                                <button onClick={() => { setModal('uploadBerkas'); setModalData({ folderId: folder.id }) }}
                                  className="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600">📤 Upload</button>
                                <button onClick={() => { setModal('editFolder'); setModalData(folder) }}
                                  className="hover:bg-blue-100 p-1 rounded text-xs">✏️</button>
                                <button onClick={() => deleteFolder(folder)}
                                  className="hover:bg-red-100 p-1 rounded text-xs">🗑️</button>
                              </div>
                            )}
                          </div>

                          {/* Berkas List */}
                          <div className="p-2">
                            {fb.length === 0 ? (
                              <p className="text-xs text-gray-400 text-center py-2">Belum ada berkas untuk pegawai ini</p>
                            ) : (
                              <div className="space-y-1">
                                {fb.map(b => (
                                  <div key={b.id} className="flex items-center justify-between bg-gray-50 p-2 rounded hover:bg-gray-100">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      <span>📄</span>
                                      <p className="text-sm font-medium text-gray-800 truncate">{b.nama_berkas}</p>
                                    </div>
                                    <div className="flex gap-1 shrink-0 ml-2">
                                      <button onClick={() => { setModal('viewPDF'); setModalData(b.lokasi_berkas) }}
                                        className="bg-green-100 text-green-600 px-2 py-1 rounded text-xs hover:bg-green-200">👁️</button>
                                      <a href={b.lokasi_berkas} target="_blank" rel="noopener noreferrer"
                                        className="bg-blue-100 text-blue-600 px-2 py-1 rounded text-xs hover:bg-blue-200">⬇️</a>
                                      {isAdmin && (
                                        <button onClick={() => deleteBerkas(b)}
                                          className="bg-red-100 text-red-600 px-2 py-1 rounded text-xs hover:bg-red-200">🗑️</button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
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
              <p className="text-sm">Pilih pegawai dari daftar</p>
            </div>
          )}
        </div>
      </div>

      {/* ==================== MODALS ==================== */}

      {/* Modal: Add/Edit Pegawai */}
      {(modal === 'addPegawai' || modal === 'editPegawai') && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">{modal === 'editPegawai' ? '✏️ Edit Pegawai' : '👤 Tambah Pegawai'}</h3>
            <form onSubmit={handleSavePegawai} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { n: 'nama', l: 'Nama *', r: true },
                  { n: 'nip', l: 'NIP *', r: true },
                  { n: 'nik', l: 'NIK' },
                  { n: 'tanggal_lahir', l: 'Tgl Lahir *', t: 'date', r: true },
                  { n: 'pangkat_gol_ruang', l: 'Pangkat/Gol Ruang' },
                  { n: 'jabatan', l: 'Jabatan *', r: true },
                  { n: 'jenjang_jabatan', l: 'Jenjang Jabatan' },
                  { n: 'kelompok_jabatan', l: 'Kelompok Jabatan' },
                  { n: 'kelas_jabatan', l: 'Kelas Jabatan' },
                  { n: 'tmt_cpns', l: 'TMT CPNS', t: 'date' }
                ].map(f => (
                  <div key={f.n}>
                    <label className="block text-xs font-medium mb-1">{f.l}</label>
                    <input name={f.n} type={f.t || 'text'} required={f.r} defaultValue={modalData?.[f.n] || ''}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium mb-1">Tingkat</label>
                  <select name="tingkat_id" defaultValue={modalData?.tingkat_id || ''} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none">
                    <option value="">Pilih</option><option value="1">Kantor Pusat</option><option value="2">Kantor SAR</option><option value="3">Pos SAR</option>
                  </select>
                </div>
              </div>
              <hr />
              <p className="text-xs font-semibold text-gray-500">Pimpinan Langsung</p>
              <div className="grid grid-cols-3 gap-3">
                <input name="nama_pimpinan_langsung" placeholder="Nama" defaultValue={modalData?.nama_pimpinan_langsung || ''} className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
                <input name="nip_pimpinan_langsung" placeholder="NIP" defaultValue={modalData?.nip_pimpinan_langsung || ''} className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
                <input name="jabatan_pimpinan_langsung" placeholder="Jabatan" defaultValue={modalData?.jabatan_pimpinan_langsung || ''} className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
              </div>
              <p className="text-xs font-semibold text-gray-500">Pimpinan</p>
              <div className="grid grid-cols-3 gap-3">
                <input name="nama_pimpinan" placeholder="Nama" defaultValue={modalData?.nama_pimpinan || ''} className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
                <input name="nip_pimpinan" placeholder="NIP" defaultValue={modalData?.nip_pimpinan || ''} className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
                <input name="jabatan_pimpinan" placeholder="Jabatan" defaultValue={modalData?.jabatan_pimpinan || ''} className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
              </div>
              <div className="flex gap-3 pt-3">
                <button type="submit" className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg font-medium text-sm">Simpan</button>
                <button type="button" onClick={() => setModal(null)} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-lg font-medium text-sm">Batal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add/Edit Folder (GLOBAL) */}
      {(modal === 'addFolder' || modal === 'editFolder') && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4">{modal === 'editFolder' ? '✏️ Edit Folder' : '📁 Tambah Folder Global'}</h3>
            <div className="bg-blue-50 rounded-lg p-3 mb-4 text-xs text-blue-600">
              ℹ️ Folder ini akan muncul di <b>SEMUA pegawai</b>
            </div>
            <form onSubmit={handleSaveFolder} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nama Folder</label>
                <input name="nama_folder" required defaultValue={modalData?.nama_folder || ''}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" placeholder="Sertifikat Tenaga SAR 2026" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Level Folder</label>
                <select name="level_folder" required defaultValue={modalData?.level_folder || 'Biasa'}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none">
                  <option value="Sangat Penting">🔴 Sangat Penting</option>
                  <option value="Penting">🟡 Penting</option>
                  <option value="Biasa">⚪ Biasa</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button type="submit" className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg font-medium">Simpan</button>
                <button type="button" onClick={() => setModal(null)} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-lg font-medium">Batal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Upload Berkas PDF */}
      {modal === 'uploadBerkas' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4">📤 Upload PDF</h3>
            <form onSubmit={handleUploadBerkas} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nama Berkas</label>
                <input name="nama_berkas" required className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" placeholder="SK Pengangkatan" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">File PDF (maks 50MB)</label>
                <input ref={fileInputRef} name="file_pdf" type="file" accept=".pdf" required
                  className="w-full px-3 py-2 border rounded-lg text-sm file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-orange-100 file:text-orange-600 file:font-medium file:cursor-pointer" />
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-600">
                <p className="font-medium">📂 Path penyimpanan:</p>
                <p className="font-mono mt-1">BERKAS PEGAWAI / {folders.find(f => f.id === modalData?.folderId)?.nama_folder} / {selectedPegawai?.nama} / [file].pdf</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-xs text-green-600">
                💡 Upload akan berjalan di <b>background</b>. Anda bisa menutup dialog ini dan melanjutkan pekerjaan.
              </div>
              <div className="flex gap-3">
                <button type="submit" className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg font-medium">📤 Upload</button>
                <button type="button" onClick={() => setModal(null)} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2 rounded-lg font-medium">Batal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View PDF */}
      {modal === 'viewPDF' && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-5xl h-[90vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between shrink-0">
              <h3 className="font-bold text-gray-800">📄 PDF Viewer</h3>
              <div className="flex gap-2">
                <a href={modalData} target="_blank" rel="noopener noreferrer"
                  className="bg-blue-500 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-600">⬇️ Download</a>
                <button onClick={() => setModal(null)}
                  className="bg-red-500 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-red-600">✕ Tutup</button>
              </div>
            </div>
            <div className="flex-1">
              <iframe src={modalData} className="w-full h-full" title="PDF" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PegawaiPage