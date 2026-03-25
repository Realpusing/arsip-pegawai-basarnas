import React, { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import {
  compressPDF, uploadToGoogleDrive, downloadFromGoogleDrive,
  decompressZip, deleteFromGoogleDrive, extractFileId, formatSize,
  loginGoogle, isGoogleLoggedIn
} from '../../lib/googleDrive'
import toast from 'react-hot-toast'

function AdminPegawaiPage() {
  const [pegawai, setPegawai] = useState([])
  const [folders, setFolders] = useState([])
  const [berkas, setBerkas] = useState([])
  const [selectedPegawai, setSelectedPegawai] = useState(null)
  const [searchPegawai, setSearchPegawai] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')
  const [viewingPDF, setViewingPDF] = useState(false)
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null)
  const [loadingPDF, setLoadingPDF] = useState(false)
  const [gLoggedIn, setGLoggedIn] = useState(isGoogleLoggedIn())
  const [modal, setModal] = useState(null)
  const [modalData, setModalData] = useState(null)
  const fileInputRef = useRef(null)

  // Pimpinan form
  const [formPimpinanLangsung, setFormPimpinanLangsung] = useState({ nama: '', nip: '', jabatan: '' })
  const [formPimpinan, setFormPimpinan] = useState({ nama: '', nip: '', jabatan: '' })

  useEffect(() => { loadPegawai(); loadFolders() }, [])

  useEffect(() => {
    if (modal === 'addPegawai') {
      setFormPimpinanLangsung({ nama: '', nip: '', jabatan: '' })
      setFormPimpinan({ nama: '', nip: '', jabatan: '' })
    } else if (modal === 'editPegawai' && modalData) {
      setFormPimpinanLangsung({
        nama: modalData.nama_pimpinan_langsung || '',
        nip: modalData.nip_pimpinan_langsung || '',
        jabatan: modalData.jabatan_pimpinan_langsung || ''
      })
      setFormPimpinan({
        nama: modalData.nama_pimpinan || '',
        nip: modalData.nip_pimpinan || '',
        jabatan: modalData.jabatan_pimpinan || ''
      })
    }
  }, [modal, modalData])

  const loadPegawai = async () => {
    const { data } = await supabase.from('profile').select('*, tingkat:tingkat_id(nama)').order('nama')
    if (data) setPegawai(data)
    setLoading(false)
  }

  const loadFolders = async () => {
    const { data } = await supabase.from('folder').select('*').order('created_at')
    if (data) setFolders(data)
  }

  const loadBerkas = useCallback(async (pid) => {
    const { data } = await supabase.from('berkas').select('*').eq('profile_id', pid).order('created_at')
    if (data) setBerkas(data)
  }, [])

  const selectPegawai = (p) => { setSelectedPegawai(p); loadBerkas(p.id) }

  const handleGoogleLogin = async () => {
    try { await loginGoogle(); setGLoggedIn(true); toast.success('Google Drive terhubung!') }
    catch (err) { toast.error('Gagal: ' + err.message) }
  }

  const handleSavePegawai = async (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    const d = {
      nama: fd.get('nama'), nip: fd.get('nip'), nik: fd.get('nik') || null,
      tanggal_lahir: fd.get('tanggal_lahir'),
      pangkat_gol_ruang: fd.get('pangkat_gol_ruang') || null,
      jabatan: fd.get('jabatan'),
      jenjang_jabatan: fd.get('jenjang_jabatan') || null,
      kelompok_jabatan: fd.get('kelompok_jabatan') || null,
      kelas_jabatan: fd.get('kelas_jabatan') || null,
      tmt_cpns: fd.get('tmt_cpns') || null,
      nama_pimpinan_langsung: formPimpinanLangsung.nama || null,
      nip_pimpinan_langsung: formPimpinanLangsung.nip || null,
      jabatan_pimpinan_langsung: formPimpinanLangsung.jabatan || null,
      nama_pimpinan: formPimpinan.nama || null,
      nip_pimpinan: formPimpinan.nip || null,
      jabatan_pimpinan: formPimpinan.jabatan || null,
      tingkat_id: fd.get('tingkat_id') ? parseInt(fd.get('tingkat_id')) : null
    }
    try {
      if (modal === 'editPegawai') {
        const { error } = await supabase.from('profile').update(d).eq('id', modalData.id)
        if (error) throw error
        toast.success('Diupdate!')
        if (selectedPegawai?.id === modalData.id) {
          const { data: u } = await supabase.from('profile').select('*, tingkat:tingkat_id(nama)').eq('id', modalData.id).single()
          if (u) setSelectedPegawai(u)
        }
      } else {
        const { error } = await supabase.from('profile').insert(d)
        if (error) throw error
        toast.success('Ditambahkan!')
      }
      setModal(null); setModalData(null); loadPegawai()
    } catch (err) {
      console.error('Save error:', err)
      toast.error('Gagal: ' + (err.message || 'Unknown error'))
    }
  }

  const deletePegawai = async (p) => {
    if (!window.confirm(`Hapus "${p.nama}"?`)) return
    try {
      const { data: bd } = await supabase.from('berkas').select('lokasi_berkas').eq('profile_id', p.id)
      for (const b of (bd || [])) { const fid = extractFileId(b.lokasi_berkas); if (fid) try { await deleteFromGoogleDrive(fid) } catch (e) {} }
      await supabase.from('profile').delete().eq('id', p.id)
      toast.success('Dihapus!')
      if (selectedPegawai?.id === p.id) { setSelectedPegawai(null); setBerkas([]) }
      loadPegawai()
    } catch (err) { toast.error(err.message) }
  }

  const handleSaveFolder = async (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    const d = { nama_folder: fd.get('nama_folder'), level_folder: fd.get('level_folder') }
    try {
      if (modal === 'editFolder') {
        const { error } = await supabase.from('folder').update(d).eq('id', modalData.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('folder').insert(d)
        if (error) throw error
      }
      toast.success('Folder disimpan!'); setModal(null); setModalData(null); loadFolders()
    } catch (err) { toast.error(err.message) }
  }

  const deleteFolder = async (f) => {
    if (!window.confirm(`Hapus folder "${f.nama_folder}"?`)) return
    try {
      const { data: bd } = await supabase.from('berkas').select('lokasi_berkas').eq('folder_id', f.id)
      for (const b of (bd || [])) { const fid = extractFileId(b.lokasi_berkas); if (fid) try { await deleteFromGoogleDrive(fid) } catch (e) {} }
      await supabase.from('berkas').delete().eq('folder_id', f.id)
      await supabase.from('folder').delete().eq('id', f.id)
      toast.success('Dihapus!'); loadFolders(); if (selectedPegawai) loadBerkas(selectedPegawai.id)
    } catch (err) { toast.error(err.message) }
  }

  const handleUploadBerkas = async (e) => {
    e.preventDefault()
    if (!isGoogleLoggedIn()) { try { await loginGoogle(); setGLoggedIn(true) } catch { toast.error('Login Google Drive dulu!'); return } }
    const fd = new FormData(e.target)
    const file = fd.get('file_pdf'), namaBerkas = fd.get('nama_berkas')
    const folderId = parseInt(modalData.folderId)
    const folder = folders.find(f => f.id === folderId)
    if (!file?.size) { toast.error('Pilih file PDF!'); return }
    if (file.type !== 'application/pdf') { toast.error('Hanya PDF!'); return }
    if (file.size > 500 * 1024) { toast.error('Maks 500KB!'); return }
    setUploading(true)
    try {
      const c = await compressPDF(file, setUploadStatus)
      const r = await uploadToGoogleDrive(c.zipBlob, c.zipName, folder?.nama_folder || 'Unknown', selectedPegawai.nama, setUploadStatus)
      setUploadStatus('💾 Menyimpan...')
      const { error } = await supabase.from('berkas').insert({ folder_id: folderId, profile_id: selectedPegawai.id, nama_berkas: namaBerkas, lokasi_berkas: r.url })
      if (error) throw error
      toast.success(`Upload berhasil! ${formatSize(c.originalSize)} → ${formatSize(c.compressedSize)} (hemat ${c.savedPercent}%)`, { duration: 5000 })
      setModal(null); setModalData(null); loadBerkas(selectedPegawai.id)
    } catch (err) { toast.error('Gagal: ' + err.message) }
    finally { setUploading(false); setUploadStatus('') }
  }

  const viewBerkas = async (b) => {
    const fid = extractFileId(b.lokasi_berkas)
    if (!fid) { window.open(b.lokasi_berkas, '_blank'); return }
    setViewingPDF(true); setLoadingPDF(true); setPdfBlobUrl(null)
    try { const zip = await downloadFromGoogleDrive(fid); const { pdfBlob } = await decompressZip(zip); setPdfBlobUrl(URL.createObjectURL(pdfBlob)) }
    catch (err) { toast.error(err.message); window.open(b.lokasi_berkas, '_blank'); setViewingPDF(false) }
    finally { setLoadingPDF(false) }
  }

  const closePDF = () => { if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl); setPdfBlobUrl(null); setViewingPDF(false) }

  const downloadBerkas = async (b) => {
    const fid = extractFileId(b.lokasi_berkas)
    if (!fid) { window.open(b.lokasi_berkas, '_blank'); return }
    try {
      toast('⬇️ Mendownload...')
      const zip = await downloadFromGoogleDrive(fid)
      const { pdfBlob, pdfName } = await decompressZip(zip)
      const u = URL.createObjectURL(pdfBlob); const a = document.createElement('a')
      a.href = u; a.download = pdfName || b.nama_berkas + '.pdf'; a.click(); URL.revokeObjectURL(u)
      toast.success('Selesai!')
    } catch (err) { toast.error(err.message) }
  }

  const deleteBerkas = async (b) => {
    if (!window.confirm(`Hapus "${b.nama_berkas}"?`)) return
    try {
      const fid = extractFileId(b.lokasi_berkas)
      if (fid) try { await deleteFromGoogleDrive(fid) } catch (e) {}
      const { error } = await supabase.from('berkas').delete().eq('id', b.id)
      if (error) throw error
      toast.success('Dihapus!'); loadBerkas(selectedPegawai.id)
    } catch (err) { toast.error(err.message) }
  }

  const filtered = pegawai.filter(p => {
    const search = searchPegawai.toLowerCase().trim()
    if (!search) return true
    const words = search.split(/\s+/)
    const nama = (p.nama || '').toLowerCase()
    return words.every(w => nama.includes(w)) || p.nip.includes(search.replace(/\s+/g, ''))
  })

  // ========================================
  // PIMPINAN SEARCH (dengan debounce)
  // ========================================
  const PimpinanSearchField = ({ label, value, setValue }) => {
    const [inputValue, setInputValue] = useState('')
    const [showDropdown, setShowDropdown] = useState(false)
    const [searchResults, setSearchResults] = useState([])
    const debounceRef = useRef(null)

    // Reset input saat modal berubah
    useEffect(() => {
      setInputValue('')
      setShowDropdown(false)
      setSearchResults([])
    }, [modal])

    // Debounce search: tunggu 300ms setelah user selesai ketik
    const handleInputChange = (e) => {
      const val = e.target.value
      setInputValue(val)

      // Clear timer sebelumnya
      if (debounceRef.current) clearTimeout(debounceRef.current)

      // Set timer baru
      if (val.trim().length >= 2) {
        debounceRef.current = setTimeout(() => {
          const search = val.toLowerCase().trim()
          const words = search.split(/\s+/)
          const results = pegawai.filter(p => {
            const nama = (p.nama || '').toLowerCase()
            const nip = (p.nip || '')
            const matchNama = words.every(word => nama.includes(word))
            const matchNip = nip.includes(search.replace(/\s+/g, ''))
            return matchNama || matchNip
          }).slice(0, 8)
          setSearchResults(results)
          setShowDropdown(true)
        }, 300)
      } else {
        setSearchResults([])
        setShowDropdown(false)
      }
    }

    const handleSelect = (p) => {
      setValue({ nama: p.nama, nip: p.nip, jabatan: p.jabatan || '' })
      setInputValue('')
      setShowDropdown(false)
      setSearchResults([])
    }

    const handleManualUse = () => {
      setValue({ nama: inputValue, nip: '', jabatan: '' })
      setInputValue('')
      setShowDropdown(false)
      setSearchResults([])
    }

    const handleClear = () => {
      setValue({ nama: '', nip: '', jabatan: '' })
      setInputValue('')
      setShowDropdown(false)
      setSearchResults([])
    }

    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500">{label}</p>

        {/* SUDAH DIPILIH */}
        {value.nama ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-medium text-green-800">{value.nama}</p>
                <p className="text-[10px] text-green-600">NIP: {value.nip || '-'} • {value.jabatan || '-'}</p>
              </div>
              <button type="button" onClick={handleClear}
                className="text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-full w-6 h-6 flex items-center justify-center text-xs">
                ✕
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-green-200">
              <div>
                <p className="text-[10px] text-gray-400 mb-0.5">Nama</p>
                <input type="text" value={value.nama} onChange={(e) => setValue({ ...value, nama: e.target.value })}
                  className="w-full px-2 py-1 border rounded text-xs outline-none focus:ring-1 focus:ring-orange-400" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-0.5">NIP</p>
                <input type="text" value={value.nip} onChange={(e) => setValue({ ...value, nip: e.target.value })}
                  className="w-full px-2 py-1 border rounded text-xs outline-none focus:ring-1 focus:ring-orange-400" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 mb-0.5">Jabatan</p>
                <input type="text" value={value.jabatan} onChange={(e) => setValue({ ...value, jabatan: e.target.value })}
                  className="w-full px-2 py-1 border rounded text-xs outline-none focus:ring-1 focus:ring-orange-400" />
              </div>
            </div>
          </div>
        ) : (
          /* BELUM DIPILIH - INPUT BEBAS */
          <div className="relative">
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onFocus={() => { if (searchResults.length > 0) setShowDropdown(true) }}
              onBlur={() => setTimeout(() => setShowDropdown(false), 300)}
              placeholder="🔍 Ketik minimal 2 huruf untuk mencari..."
              className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
              autoComplete="off"
            />

            {inputValue.trim().length >= 2 && inputValue.trim().length < 2 && (
              <p className="text-[10px] text-gray-400 mt-1">Ketik minimal 2 huruf...</p>
            )}

            {/* DROPDOWN */}
            {showDropdown && (
              <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-2xl max-h-64 overflow-y-auto">
                {searchResults.length === 0 ? (
                  <div className="p-4 text-center">
                    <p className="text-gray-400 text-xs mb-2">Tidak ditemukan pegawai "{inputValue}"</p>
                    <button type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={handleManualUse}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                      ✏️ Gunakan "{inputValue}" sebagai nama (isi manual)
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="px-3 py-1.5 text-[10px] text-gray-400 bg-gray-50 border-b sticky top-0">
                      {searchResults.length} hasil — klik untuk memilih
                    </p>
                    {searchResults.map(p => (
                      <button key={p.id} type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleSelect(p)}
                        className="w-full text-left px-3 py-2.5 hover:bg-orange-50 border-b last:border-0 transition flex items-center gap-3">
                        <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 text-xs font-bold shrink-0">
                          {p.nama?.[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-800 truncate">{p.nama}</p>
                          <p className="text-[10px] text-gray-500">NIP: {p.nip} • {p.jabatan || '-'}</p>
                        </div>
                        <span className="text-orange-400 text-xs shrink-0">Pilih →</span>
                      </button>
                    ))}
                    <div className="border-t bg-gray-50 p-2 sticky bottom-0">
                      <button type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={handleManualUse}
                        className="w-full text-left px-3 py-2 text-xs text-blue-600 hover:bg-blue-50 rounded transition">
                        ✏️ Isi manual: "{inputValue}"
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  if (loading) return <div className="flex justify-center py-20"><div className="animate-spin h-10 w-10 border-t-4 border-orange-500 rounded-full"></div></div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">⚙️ Admin - Kelola Pegawai</h1>
          <p className="text-gray-500 text-sm">Full akses: CRUD pegawai, folder, berkas</p>
        </div>
        <div>
          {gLoggedIn ? (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 flex items-center gap-2">
              <span>✅</span><span className="text-sm text-green-700">Google Drive Terhubung</span>
            </div>
          ) : (
            <button onClick={handleGoogleLogin} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">🔗 Hubungkan Google Drive</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border flex flex-col" style={{ maxHeight: '85vh' }}>
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm">👥 Pegawai ({pegawai.length})</h2>
              <button onClick={() => { setModal('addPegawai'); setModalData(null) }}
                className="bg-orange-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-orange-600">+ Tambah</button>
            </div>
            <input type="text" value={searchPegawai} onChange={e => setSearchPegawai(e.target.value)}
              placeholder="🔍 Cari nama / NIP..." className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <p className="p-4 text-gray-400 text-center text-sm">Tidak ditemukan</p>
            ) : filtered.map(p => (
              <div key={p.id} onClick={() => selectPegawai(p)}
                className={`p-3 border-b cursor-pointer hover:bg-gray-50 ${selectedPegawai?.id === p.id ? 'bg-orange-50 border-l-4 border-l-orange-500' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{p.nama}</p>
                    <p className="text-xs text-gray-500">NIP: {p.nip}</p>
                    <p className="text-xs text-gray-400">{p.jabatan}</p>
                  </div>
                  <div className="flex gap-1 ml-2 shrink-0">
                    <button onClick={e => { e.stopPropagation(); setModal('editPegawai'); setModalData(p) }} className="hover:bg-blue-100 p-1 rounded">✏️</button>
                    <button onClick={e => { e.stopPropagation(); deletePegawai(p) }} className="hover:bg-red-100 p-1 rounded">🗑️</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3 space-y-4">
          {selectedPegawai ? (<>
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-white text-lg font-bold">{selectedPegawai.nama?.[0]}</div>
                <div><h2 className="text-lg font-bold">{selectedPegawai.nama}</h2><p className="text-sm text-gray-500">NIP: {selectedPegawai.nip}</p></div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { l: 'NIK', v: selectedPegawai.nik }, { l: 'Tgl Lahir', v: selectedPegawai.tanggal_lahir ? new Date(selectedPegawai.tanggal_lahir).toLocaleDateString('id-ID') : '-' },
                  { l: 'Usia', v: selectedPegawai.usia ? `${selectedPegawai.usia} th` : '-' }, { l: 'Pangkat/Gol', v: selectedPegawai.pangkat_gol_ruang },
                  { l: 'Jabatan', v: selectedPegawai.jabatan }, { l: 'Jenjang', v: selectedPegawai.jenjang_jabatan },
                  { l: 'Kelompok', v: selectedPegawai.kelompok_jabatan }, { l: 'Kelas', v: selectedPegawai.kelas_jabatan },
                  { l: 'TMT CPNS', v: selectedPegawai.tmt_cpns ? new Date(selectedPegawai.tmt_cpns).toLocaleDateString('id-ID') : '-' },
                  { l: 'Masa Kerja', v: `${selectedPegawai.masa_kerja_tahun || 0}th ${selectedPegawai.masa_kerja_bulan || 0}bl ${selectedPegawai.masa_kerja_hari || 0}hr` },
                  { l: 'Pimpinan Lsg', v: selectedPegawai.nama_pimpinan_langsung }, { l: 'Pimpinan', v: selectedPegawai.nama_pimpinan }
                ].map((x, i) => (
                  <div key={i} className="bg-gray-50 rounded p-2"><p className="text-xs text-gray-400">{x.l}</p><p className="text-xs font-medium truncate">{x.v || '-'}</p></div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border">
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-semibold text-sm">📁 Folder & Berkas</h3>
                <button onClick={() => { setModal('addFolder'); setModalData(null) }} className="bg-orange-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-orange-600">+ Folder</button>
              </div>
              <div className="p-4 space-y-3 overflow-y-auto" style={{ maxHeight: '55vh' }}>
                {folders.map(folder => {
                  const fb = berkas.filter(b => b.folder_id === folder.id)
                  return (
                    <div key={folder.id} className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-3 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span>📁</span><span className="font-medium text-sm truncate">{folder.nama_folder}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${folder.level_folder === 'Sangat Penting' ? 'bg-red-100 text-red-600' : folder.level_folder === 'Penting' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>{folder.level_folder}</span>
                          <span className="text-xs text-gray-400">({fb.length})</span>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => { setModal('uploadBerkas'); setModalData({ folderId: folder.id }) }} className="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600">📤</button>
                          <button onClick={() => { setModal('editFolder'); setModalData(folder) }} className="hover:bg-blue-100 p-1 rounded text-xs">✏️</button>
                          <button onClick={() => deleteFolder(folder)} className="hover:bg-red-100 p-1 rounded text-xs">🗑️</button>
                        </div>
                      </div>
                      <div className="p-2">
                        {fb.length === 0 ? <p className="text-xs text-gray-400 text-center py-2">Kosong</p> : fb.map(b => (
                          <div key={b.id} className="flex items-center justify-between bg-gray-50 p-2 rounded hover:bg-gray-100 mb-1">
                            <div className="flex items-center gap-2 min-w-0 flex-1"><span>📄</span><p className="text-sm font-medium truncate">{b.nama_berkas}</p></div>
                            <div className="flex gap-1 shrink-0 ml-2">
                              <button onClick={() => viewBerkas(b)} className="bg-green-100 text-green-600 px-2 py-1 rounded text-xs hover:bg-green-200">👁️</button>
                              <button onClick={() => downloadBerkas(b)} className="bg-blue-100 text-blue-600 px-2 py-1 rounded text-xs hover:bg-blue-200">⬇️</button>
                              <button onClick={() => deleteBerkas(b)} className="bg-red-100 text-red-600 px-2 py-1 rounded text-xs hover:bg-red-200">🗑️</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>) : (
            <div className="bg-white rounded-xl shadow-sm border flex flex-col items-center justify-center h-96 text-gray-400">
              <span className="text-5xl mb-4">👈</span><p className="text-sm">Pilih pegawai</p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL: PEGAWAI */}
      {(modal === 'addPegawai' || modal === 'editPegawai') && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">{modal === 'editPegawai' ? '✏️ Edit' : '👤 Tambah'} Pegawai</h3>
            <form onSubmit={handleSavePegawai} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { n: 'nama', l: 'Nama *', r: true }, { n: 'nip', l: 'NIP *', r: true }, { n: 'nik', l: 'NIK' },
                  { n: 'tanggal_lahir', l: 'Tgl Lahir *', t: 'date', r: true }, { n: 'pangkat_gol_ruang', l: 'Pangkat/Gol' },
                  { n: 'jabatan', l: 'Jabatan *', r: true }, { n: 'jenjang_jabatan', l: 'Jenjang' }, { n: 'kelompok_jabatan', l: 'Kelompok' },
                  { n: 'kelas_jabatan', l: 'Kelas' }, { n: 'tmt_cpns', l: 'TMT CPNS', t: 'date' }
                ].map(f => (
                  <div key={f.n}>
                    <label className="block text-xs font-medium mb-1">{f.l}</label>
                    <input name={f.n} type={f.t || 'text'} required={f.r} defaultValue={modalData?.[f.n] || ''}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium mb-1">Tingkat</label>
                  <select name="tingkat_id" defaultValue={modalData?.tingkat_id || ''} className="w-full px-3 py-2 border rounded-lg text-sm outline-none">
                    <option value="">Pilih</option><option value="1">Kantor Pusat</option><option value="2">Kantor SAR</option><option value="3">Pos SAR</option>
                  </select>
                </div>
              </div>
              <hr className="my-4" />
              <PimpinanSearchField label="👤 Pimpinan Langsung" value={formPimpinanLangsung} setValue={setFormPimpinanLangsung} />
              <hr className="my-4" />
              <PimpinanSearchField label="👑 Pimpinan" value={formPimpinan} setValue={setFormPimpinan} />
              <div className="flex gap-3 pt-3">
                <button type="submit" className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-lg font-medium text-sm">Simpan</button>
                <button type="button" onClick={() => { setModal(null); setModalData(null) }} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-2.5 rounded-lg font-medium text-sm">Batal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: FOLDER */}
      {(modal === 'addFolder' || modal === 'editFolder') && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4">{modal === 'editFolder' ? '✏️ Edit' : '📁 Tambah'} Folder</h3>
            <div className="bg-blue-50 rounded-lg p-3 mb-4 text-xs text-blue-600">ℹ️ Folder muncul di <b>SEMUA pegawai</b></div>
            <form onSubmit={handleSaveFolder} className="space-y-4">
              <input name="nama_folder" required defaultValue={modalData?.nama_folder || ''} placeholder="Nama Folder" className="w-full px-3 py-2 border rounded-lg outline-none" />
              <select name="level_folder" required defaultValue={modalData?.level_folder || 'Biasa'} className="w-full px-3 py-2 border rounded-lg outline-none">
                <option value="Sangat Penting">🔴 Sangat Penting</option><option value="Penting">🟡 Penting</option><option value="Biasa">⚪ Biasa</option>
              </select>
              <div className="flex gap-3">
                <button type="submit" className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg font-medium">Simpan</button>
                <button type="button" onClick={() => setModal(null)} className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-medium">Batal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: UPLOAD */}
      {modal === 'uploadBerkas' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4">📤 Upload PDF</h3>
            <form onSubmit={handleUploadBerkas} className="space-y-4">
              <div><label className="block text-sm font-medium mb-1">Nama Berkas</label>
                <input name="nama_berkas" required className="w-full px-3 py-2 border rounded-lg outline-none" placeholder="SK Pengangkatan" /></div>
              <div><label className="block text-sm font-medium mb-1">File PDF (maks 500KB)</label>
                <input ref={fileInputRef} name="file_pdf" type="file" accept=".pdf" required
                  className="w-full px-3 py-2 border rounded-lg text-sm file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-orange-100 file:text-orange-600 file:font-medium" /></div>
              {uploading && <div className="bg-orange-50 rounded-lg p-3 border border-orange-200"><div className="flex items-center gap-2">
                <div className="animate-spin h-4 w-4 border-2 border-orange-500 border-t-transparent rounded-full"></div><p className="text-sm text-orange-700">{uploadStatus}</p></div></div>}
              <div className="flex gap-3">
                <button type="submit" disabled={uploading} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 rounded-lg font-medium disabled:opacity-50">{uploading ? '⏳...' : '📤 Upload'}</button>
                <button type="button" onClick={() => setModal(null)} disabled={uploading} className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-medium disabled:opacity-50">Batal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PDF */}
      {viewingPDF && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-5xl h-[90vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold">📄 PDF Viewer</h3>
              <button onClick={closePDF} className="bg-red-500 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-red-600">✕ Tutup</button>
            </div>
            <div className="flex-1">
              {loadingPDF ? <div className="flex flex-col items-center justify-center h-full"><div className="animate-spin h-10 w-10 border-4 border-orange-500 border-t-transparent rounded-full mb-4"></div><p className="text-gray-500">Loading...</p></div>
                : pdfBlobUrl ? <iframe src={pdfBlobUrl} className="w-full h-full" title="PDF" />
                : <div className="flex items-center justify-center h-full text-red-500">Gagal</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminPegawaiPage