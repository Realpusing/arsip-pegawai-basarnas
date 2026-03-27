import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { downloadFromGoogleDrive, decompressZip, extractFileId } from '../../lib/googleDrive'
import { useAuth } from '../../context/AuthContext'
import toast, { Toaster } from 'react-hot-toast'

function PimpinanPegawaiPage() {
  const { user, isPimpinan, isPejabat } = useAuth()

  const [pegawai, setPegawai] = useState([])
  const [folders, setFolders] = useState([])
  const [berkas, setBerkas] = useState([])
  const [allBerkas, setAllBerkas] = useState([])
  const [selectedPegawai, setSelectedPegawai] = useState(null)
  const [searchPegawai, setSearchPegawai] = useState('')
  const [searchBerkas, setSearchBerkas] = useState('')
  const [loading, setLoading] = useState(true)
  const [collapsedFolders, setCollapsedFolders] = useState({})

  // PDF Viewer
  const [viewingPDF, setViewingPDF] = useState(false)
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null)
  const [loadingPDF, setLoadingPDF] = useState(false)
  const [pdfTitle, setPdfTitle] = useState('')

  // Global Quick Search
  const [globalSearch, setGlobalSearch] = useState('')
  const [showQuickResults, setShowQuickResults] = useState(false)
  const quickSearchRef = useRef(null)

  // Panel berkas baru
  const [showNewBerkasPanel, setShowNewBerkasPanel] = useState(false)

  // Header height
  const headerRef = useRef(null)
  const [headerHeight, setHeaderHeight] = useState(0)

  // ========== LOAD DATA ==========
  useEffect(() => { loadData() }, [])

  useEffect(() => {
    const measure = () => {
      if (headerRef.current) setHeaderHeight(headerRef.current.offsetHeight)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [loading])

  useEffect(() => {
    const handler = (e) => {
      if (quickSearchRef.current && !quickSearchRef.current.contains(e.target)) {
        setShowQuickResults(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const loadData = async () => {
    try {
      const { data: folderData } = await supabase
        .from('folder').select('*').order('created_at')
      if (folderData) setFolders(folderData)

      let pegawaiData = []
      if (isPimpinan) {
        const { data } = await supabase
          .from('profile').select('*, tingkat:tingkat_id(nama)').order('nama')
        if (data) pegawaiData = data
      } else if (isPejabat) {
        const nip = user?.profile?.nip
        if (nip) {
          const { data } = await supabase
            .from('profile').select('*, tingkat:tingkat_id(nama)')
            .eq('nip_pimpinan_langsung', nip).order('nama')
          if (data) pegawaiData = data
        }
      }
      setPegawai(pegawaiData)

      if (pegawaiData.length > 0) {
        const ids = pegawaiData.map(p => p.id)
        let allB = []
        const chunk = 50
        for (let i = 0; i < ids.length; i += chunk) {
          const c = ids.slice(i, i + chunk)
          const { data } = await supabase
            .from('berkas').select('*').in('profile_id', c).order('created_at', { ascending: false })
          if (data) allB = [...allB, ...data]
        }
        setAllBerkas(allB)
      }
    } catch { toast.error('Gagal memuat data') }
    finally { setLoading(false) }
  }

  const loadBerkas = useCallback(async (pid) => {
    const { data } = await supabase
      .from('berkas').select('*').eq('profile_id', pid).order('created_at')
    if (data) setBerkas(data)
  }, [])

  const selectPegawai = (p) => {
    setSelectedPegawai(p)
    loadBerkas(p.id)
    setSearchBerkas('')
    setShowQuickResults(false)
    setGlobalSearch('')
    setShowNewBerkasPanel(false)
    const expanded = {}
    folders.forEach(f => expanded[f.id] = false)
    setCollapsedFolders(expanded)
  }

  const toggleFolder = (folderId) => {
    setCollapsedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }))
  }

  // ========== FILTERED BERKAS ==========
  const filteredFoldersAndBerkas = useMemo(() => {
    const search = searchBerkas.toLowerCase().trim()
    if (!search) {
      return folders.map(folder => ({
        ...folder,
        filteredBerkas: berkas.filter(b => b.folder_id === folder.id),
        matchFolder: true,
        matchCount: berkas.filter(b => b.folder_id === folder.id).length,
      }))
    }
    return folders.map(folder => {
      const folderMatch = folder.nama_folder.toLowerCase().includes(search)
      const fb = berkas.filter(b => b.folder_id === folder.id)
      const matched = fb.filter(b =>
        b.nama_berkas.toLowerCase().includes(search) ||
        (b.nomor_berkas && b.nomor_berkas.toLowerCase().includes(search))
      )
      return {
        ...folder,
        filteredBerkas: folderMatch ? fb : matched,
        matchFolder: folderMatch,
        matchCount: folderMatch ? fb.length : matched.length,
      }
    }).filter(f => f.matchFolder || f.matchCount > 0)
  }, [folders, berkas, searchBerkas])

  const totalMatchBerkas = useMemo(() => {
    return filteredFoldersAndBerkas.reduce((sum, f) => sum + f.filteredBerkas.length, 0)
  }, [filteredFoldersAndBerkas])

  // ========== BERKAS BARU (7 hari terakhir) ==========
  const recentBerkas = useMemo(() => {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    return allBerkas
      .filter(b => new Date(b.created_at) >= sevenDaysAgo)
      .map(b => {
        const owner = pegawai.find(p => p.id === b.profile_id)
        const folder = folders.find(f => f.id === b.folder_id)
        return {
          ...b,
          ownerName: owner?.nama || '-',
          ownerNip: owner?.nip || '-',
          folderName: folder?.nama_folder || '-',
          owner
        }
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }, [allBerkas, pegawai, folders])

  // Berkas count per pegawai
  const berkasCountMap = useMemo(() => {
    const map = {}
    allBerkas.forEach(b => {
      map[b.profile_id] = (map[b.profile_id] || 0) + 1
    })
    return map
  }, [allBerkas])

  // Recent count per pegawai
  const recentCountMap = useMemo(() => {
    const map = {}
    recentBerkas.forEach(b => {
      map[b.profile_id] = (map[b.profile_id] || 0) + 1
    })
    return map
  }, [recentBerkas])

  // ========== GLOBAL SEARCH ==========
  const globalSearchResults = useMemo(() => {
    if (!globalSearch.trim() || globalSearch.length < 2) return { pegawaiR: [], berkasR: [], folderR: [] }
    const q = globalSearch.toLowerCase().trim()
    const words = q.split(/\s+/)

    const pegawaiR = pegawai.filter(p => {
      const nama = (p.nama || '').toLowerCase()
      return words.every(w => nama.includes(w)) ||
        p.nip?.includes(q.replace(/\s+/g, '')) ||
        p.jabatan?.toLowerCase().includes(q)
    }).slice(0, 5)

    const berkasR = allBerkas.filter(b =>
      b.nama_berkas?.toLowerCase().includes(q) ||
      b.nomor_berkas?.toLowerCase().includes(q) ||
      b.keterangan?.toLowerCase().includes(q)
    ).map(b => {
      const owner = pegawai.find(p => p.id === b.profile_id)
      const folder = folders.find(f => f.id === b.folder_id)
      return { ...b, ownerName: owner?.nama || '-', folderName: folder?.nama_folder || '-', owner }
    }).slice(0, 8)

    const folderR = folders.filter(f => f.nama_folder?.toLowerCase().includes(q))
      .map(f => ({ ...f, count: allBerkas.filter(b => b.folder_id === f.id).length }))
      .slice(0, 5)

    return { pegawaiR, berkasR, folderR }
  }, [globalSearch, pegawai, allBerkas, folders])

  const hasResults = globalSearchResults.pegawaiR.length > 0 ||
    globalSearchResults.berkasR.length > 0 ||
    globalSearchResults.folderR.length > 0

  // ========== PEGAWAI FILTER ==========
  const filtered = pegawai.filter(p => {
    const search = searchPegawai.toLowerCase().trim()
    if (!search) return true
    const words = search.split(/\s+/)
    const nama = (p.nama || '').toLowerCase()
    return words.every(w => nama.includes(w)) || p.nip?.includes(search.replace(/\s+/g, ''))
  })

  // ========== HIGHLIGHT ==========
  const HighlightText = ({ text, search }) => {
    if (!search?.trim() || !text) return <>{text}</>
    const regex = new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = text.split(regex)
    return <>{parts.map((part, i) => regex.test(part)
      ? <span key={i} className="bg-yellow-200 text-yellow-900 rounded px-0.5 font-semibold">{part}</span>
      : <span key={i}>{part}</span>)}</>
  }

  // ========== VIEW / DOWNLOAD ==========
  const viewBerkas = async (b) => {
    const fid = extractFileId(b.lokasi_berkas)
    if (!fid) { window.open(b.lokasi_berkas, '_blank'); return }
    setViewingPDF(true); setLoadingPDF(true); setPdfBlobUrl(null)
    setPdfTitle(b.nama_berkas)
    try {
      const zip = await downloadFromGoogleDrive(fid)
      const { pdfBlob } = await decompressZip(zip)
      setPdfBlobUrl(URL.createObjectURL(pdfBlob))
    } catch (err) {
      toast.error(err.message); window.open(b.lokasi_berkas, '_blank'); setViewingPDF(false)
    } finally { setLoadingPDF(false) }
  }

  const downloadBerkas = async (b) => {
    const fid = extractFileId(b.lokasi_berkas)
    if (!fid) { window.open(b.lokasi_berkas, '_blank'); return }
    try {
      toast('⬇️ Mendownload...', { duration: 1500, position: 'bottom-right' })
      const zip = await downloadFromGoogleDrive(fid)
      const { pdfBlob, pdfName } = await decompressZip(zip)
      const u = URL.createObjectURL(pdfBlob)
      const a = document.createElement('a')
      a.href = u; a.download = pdfName || b.nama_berkas + '.pdf'; a.click()
      URL.revokeObjectURL(u)
      toast.success('Selesai!', { duration: 1500, position: 'bottom-right' })
    } catch (err) { toast.error(err.message) }
  }

  const closePDF = () => {
    if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl)
    setPdfBlobUrl(null); setViewingPDF(false); setPdfTitle('')
  }

  const jumpToBerkas = (result) => {
    if (result.owner) {
      selectPegawai(result.owner)
      if (result.folder_id) {
        setCollapsedFolders(prev => ({ ...prev, [result.folder_id]: false }))
      }
    }
  }

  const formatTimeAgo = (dateStr) => {
    const now = new Date()
    const d = new Date(dateStr)
    const diff = Math.floor((now - d) / 1000)
    if (diff < 60) return 'Baru saja'
    if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`
    if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`
    if (diff < 604800) return `${Math.floor(diff / 86400)} hari lalu`
    return d.toLocaleDateString('id-ID')
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="animate-spin h-10 w-10 border-t-4 border-orange-500 rounded-full" />
      <p className="text-gray-400 mt-4 text-sm">Memuat data...</p>
    </div>
  )

  const gridHeight = headerHeight > 0 ? `calc(100vh - ${headerHeight}px - 16px)` : 'calc(100vh - 140px)'

  return (
    <div className="overflow-hidden">
      <Toaster position="bottom-right" toastOptions={{
        style: { fontSize: '13px', borderRadius: '12px', padding: '12px 16px' },
        success: { duration: 2000 }, error: { duration: 3000 },
      }} />

      {/* ===== HEADER ===== */}
      <div ref={headerRef} className="mb-4">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              {isPimpinan ? (
                <svg className="w-7 h-7 text-orange-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                </svg>
              ) : (
                <svg className="w-7 h-7 text-purple-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
              )}
              {isPimpinan ? 'Pimpinan - Data Pegawai' : 'Pejabat - Data Anak Buah'}
            </h1>
            <p className="text-gray-500 text-sm">
              {isPimpinan ? 'Lihat & cari berkas semua pegawai (read only)' : 'Lihat & cari berkas anak buah langsung (read only)'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Tombol Berkas Baru */}
            <button
              onClick={() => { setShowNewBerkasPanel(!showNewBerkasPanel); setSelectedPegawai(null); setBerkas([]) }}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                showNewBerkasPanel
                  ? 'bg-green-500 text-white shadow-lg shadow-green-200'
                  : 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
              Berkas Baru
              {recentBerkas.length > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  showNewBerkasPanel ? 'bg-white/20 text-white' : 'bg-green-500 text-white'
                }`}>{recentBerkas.length}</span>
              )}
            </button>

            {/* Info Badge */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
              <span className="text-xs font-semibold text-gray-600">{pegawai.length}</span>
              <span className="text-gray-300">|</span>
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <span className="text-xs font-semibold text-gray-600">{allBerkas.length}</span>
            </div>
          </div>
        </div>

        {/* GLOBAL QUICK SEARCH */}
        <div className="relative" ref={quickSearchRef}>
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={globalSearch}
              onChange={(e) => { setGlobalSearch(e.target.value); setShowQuickResults(e.target.value.length >= 2) }}
              onFocus={() => { if (globalSearch.length >= 2) setShowQuickResults(true) }}
              placeholder="⚡ Pencarian cepat — cari pegawai, berkas, sertifikat, folder..."
              className="w-full pl-12 pr-10 py-2.5 bg-white border-2 border-gray-200 rounded-xl text-sm outline-none 
                focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all placeholder:text-gray-400"
            />
            {globalSearch && (
              <button onClick={() => { setGlobalSearch(''); setShowQuickResults(false) }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Quick Results */}
          {showQuickResults && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl border z-50 max-h-[60vh] overflow-y-auto">
              {!hasResults ? (
                <div className="p-6 text-center">
                  <svg className="w-10 h-10 text-gray-200 mx-auto mb-2" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                  <p className="text-sm text-gray-400">Tidak ditemukan "<b>{globalSearch}</b>"</p>
                </div>
              ) : (
                <div className="p-2 space-y-0.5">
                  {/* Pegawai */}
                  {globalSearchResults.pegawaiR.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 py-1.5 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
                        Pegawai ({globalSearchResults.pegawaiR.length})
                      </p>
                      {globalSearchResults.pegawaiR.map(p => (
                        <button key={p.id} onClick={() => { selectPegawai(p); setGlobalSearch('') }}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-orange-50 transition text-left group">
                          <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold text-xs shrink-0">{p.nama?.[0]}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate group-hover:text-orange-600">
                              <HighlightText text={p.nama} search={globalSearch} />
                            </p>
                            <p className="text-xs text-gray-400">NIP: {p.nip} • {p.jabatan || '-'}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {berkasCountMap[p.id] > 0 && (
                              <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-semibold">{berkasCountMap[p.id]} berkas</span>
                            )}
                            <svg className="w-4 h-4 text-gray-300 group-hover:text-orange-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                            </svg>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Berkas */}
                  {globalSearchResults.berkasR.length > 0 && (
                    <div>
                      <div className="h-px bg-gray-100 mx-3 my-1" />
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 py-1.5 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                        Berkas / Sertifikat ({globalSearchResults.berkasR.length})
                      </p>
                      {globalSearchResults.berkasR.map(b => (
                        <button key={b.id} onClick={() => jumpToBerkas(b)}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-blue-50 transition text-left group">
                          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                            <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M3 3.5A1.5 1.5 0 014.5 2h6.879a1.5 1.5 0 011.06.44l4.122 4.12A1.5 1.5 0 0117 7.622V16.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 16.5v-13z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate group-hover:text-blue-600">
                              <HighlightText text={b.nama_berkas} search={globalSearch} />
                            </p>
                            <p className="text-xs text-gray-400">👤 {b.ownerName} • 📁 {b.folderName}</p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <span onClick={(e) => { e.stopPropagation(); viewBerkas(b) }}
                              className="w-7 h-7 bg-green-100 rounded-lg flex items-center justify-center hover:bg-green-200 transition">
                              <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                            </span>
                            <span onClick={(e) => { e.stopPropagation(); downloadBerkas(b) }}
                              className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center hover:bg-blue-200 transition">
                              <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                              </svg>
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Folder */}
                  {globalSearchResults.folderR.length > 0 && (
                    <div>
                      <div className="h-px bg-gray-100 mx-3 my-1" />
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 py-1.5 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M3.75 3A1.75 1.75 0 002 4.75v3.26a3.235 3.235 0 011.75-.51h12.5c.644 0 1.245.188 1.75.51V6.75A1.75 1.75 0 0016.25 5h-4.836a.25.25 0 01-.177-.073L9.823 3.513A1.75 1.75 0 008.586 3H3.75z" /><path d="M3.75 9A1.75 1.75 0 002 10.75v4.5c0 .966.784 1.75 1.75 1.75h12.5A1.75 1.75 0 0018 15.25v-4.5A1.75 1.75 0 0016.25 9H3.75z" /></svg>
                        Folder ({globalSearchResults.folderR.length})
                      </p>
                      {globalSearchResults.folderR.map(f => (
                        <div key={f.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-amber-50 transition">
                          <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                            <svg className="w-4 h-4 text-amber-600" fill="currentColor" viewBox="0 0 20 20"><path d="M3.75 3A1.75 1.75 0 002 4.75v3.26a3.235 3.235 0 011.75-.51h12.5c.644 0 1.245.188 1.75.51V6.75A1.75 1.75 0 0016.25 5h-4.836a.25.25 0 01-.177-.073L9.823 3.513A1.75 1.75 0 008.586 3H3.75z" /><path d="M3.75 9A1.75 1.75 0 002 10.75v4.5c0 .966.784 1.75 1.75 1.75h12.5A1.75 1.75 0 0018 15.25v-4.5A1.75 1.75 0 0016.25 9H3.75z" /></svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate"><HighlightText text={f.nama_folder} search={globalSearch} /></p>
                            <p className="text-xs text-gray-400">{f.count} berkas total</p>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                            f.level_folder === 'Sangat Penting' ? 'bg-red-100 text-red-600' :
                            f.level_folder === 'Penting' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-500'
                          }`}>{f.level_folder}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-[10px] text-gray-300 text-center py-2">
                    💡 Cari nama pegawai, NIP, nama berkas, nomor sertifikat, atau folder
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ===== EMPTY STATE ===== */}
      {isPejabat && pegawai.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
          <span className="text-5xl">👥</span>
          <h2 className="text-lg font-bold text-yellow-800 mt-4">Belum Ada Anak Buah</h2>
          <p className="text-yellow-600 mt-2 text-sm">
            Tidak ada pegawai yang NIP Pimpinan Langsungnya = <b>{user?.profile?.nip}</b>
          </p>
        </div>
      )}

      {/* ===== MAIN GRID ===== */}
      {pegawai.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5" style={{ height: gridHeight }}>

          {/* ===== LEFT: PEGAWAI LIST ===== */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border flex flex-col min-h-0 overflow-hidden">
            <div className="shrink-0 p-4 border-b">
              <h2 className="font-semibold text-sm flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                </svg>
                {isPejabat ? 'Anak Buah' : 'Pegawai'} ({pegawai.length})
              </h2>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input type="text" value={searchPegawai} onChange={e => setSearchPegawai(e.target.value)}
                  placeholder="Cari nama / NIP..."
                  className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
                {searchPegawai && (
                  <button onClick={() => setSearchPegawai('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              {searchPegawai && (
                <p className="text-[11px] text-gray-400 mt-1.5">{filtered.length} dari {pegawai.length}</p>
              )}
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-300">
                  <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 16.318A4.486 4.486 0 0012.016 15a4.486 4.486 0 00-3.198 1.318M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
                  </svg>
                  <p className="text-sm">Tidak ditemukan</p>
                </div>
              ) : filtered.map(p => {
                const bCount = berkasCountMap[p.id] || 0
                const rCount = recentCountMap[p.id] || 0
                return (
                  <div key={p.id} onClick={() => selectPegawai(p)}
                    className={`p-3 border-b cursor-pointer transition-all hover:bg-gray-50 ${
                      selectedPegawai?.id === p.id
                        ? isPimpinan ? 'bg-orange-50 border-l-4 border-l-orange-500' : 'bg-purple-50 border-l-4 border-l-purple-500'
                        : ''
                    }`}>
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${
                        isPimpinan ? 'bg-gradient-to-br from-orange-500 to-red-500' : 'bg-gradient-to-br from-purple-500 to-violet-500'
                      }`}>
                        {p.nama?.[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">
                          <HighlightText text={p.nama} search={searchPegawai} />
                        </p>
                        <p className="text-xs text-gray-500">NIP: {p.nip}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <p className="text-xs text-gray-400 truncate">{p.jabatan || '-'}</p>
                          {bCount > 0 && (
                            <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-medium shrink-0">{bCount} berkas</span>
                          )}
                          {rCount > 0 && (
                            <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded-full font-medium shrink-0 flex items-center gap-0.5">
                              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                              {rCount} baru
                            </span>
                          )}
                        </div>
                      </div>
                      <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ===== RIGHT: DETAIL ===== */}
          <div className="lg:col-span-3 flex flex-col min-h-0 overflow-hidden gap-4">

            {/* ===== PANEL BERKAS BARU ===== */}
            {showNewBerkasPanel ? (
              <div className="flex-1 min-h-0 bg-white rounded-xl shadow-sm border flex flex-col overflow-hidden">
                <div className="shrink-0 p-4 border-b flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-gray-800">Berkas Baru dari {isPejabat ? 'Anak Buah' : 'Pegawai'}</h3>
                      <p className="text-xs text-gray-400">7 hari terakhir • {recentBerkas.length} berkas baru</p>
                    </div>
                  </div>
                  <button onClick={() => setShowNewBerkasPanel(false)}
                    className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-2">
                  {recentBerkas.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-300">
                      <svg className="w-16 h-16 mb-3" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-sm font-medium">Tidak ada berkas baru</p>
                      <p className="text-xs mt-1">Belum ada upload berkas dalam 7 hari terakhir</p>
                    </div>
                  ) : (
                    recentBerkas.map((b, idx) => (
                      <div key={b.id} className="flex items-center gap-3 bg-gray-50 hover:bg-gray-100 rounded-xl p-3 transition group">
                        <div className="relative shrink-0">
                          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                            <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M3 3.5A1.5 1.5 0 014.5 2h6.879a1.5 1.5 0 011.06.44l4.122 4.12A1.5 1.5 0 0117 7.622V16.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 16.5v-13z" />
                            </svg>
                          </div>
                          {idx < 3 && (
                            <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white animate-pulse" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-700 truncate">{b.nama_berkas}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
                              {b.ownerName}
                            </span>
                            <span className="text-gray-300">•</span>
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M3.75 3A1.75 1.75 0 002 4.75v3.26a3.235 3.235 0 011.75-.51h12.5c.644 0 1.245.188 1.75.51V6.75A1.75 1.75 0 0016.25 5h-4.836a.25.25 0 01-.177-.073L9.823 3.513A1.75 1.75 0 008.586 3H3.75z" /><path d="M3.75 9A1.75 1.75 0 002 10.75v4.5c0 .966.784 1.75 1.75 1.75h12.5A1.75 1.75 0 0018 15.25v-4.5A1.75 1.75 0 0016.25 9H3.75z" /></svg>
                              {b.folderName}
                            </span>
                            <span className="text-gray-300">•</span>
                            <span className="text-[11px] text-green-600 font-medium">{formatTimeAgo(b.created_at)}</span>
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => { if (b.owner) selectPegawai(b.owner); setShowNewBerkasPanel(false) }}
                            className="w-7 h-7 bg-orange-100 rounded-lg flex items-center justify-center hover:bg-orange-200 transition" title="Lihat Pegawai">
                            <svg className="w-3.5 h-3.5 text-orange-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
                            </svg>
                          </button>
                          <button onClick={() => viewBerkas(b)}
                            className="w-7 h-7 bg-green-100 rounded-lg flex items-center justify-center hover:bg-green-200 transition" title="Lihat">
                            <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </button>
                          <button onClick={() => downloadBerkas(b)}
                            className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center hover:bg-blue-200 transition" title="Download">
                            <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : selectedPegawai ? (
              <>
                {/* PROFILE CARD */}
                <div className="shrink-0 bg-white rounded-xl shadow-sm border p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-lg ${
                      isPimpinan ? 'bg-gradient-to-br from-orange-500 to-red-600 shadow-orange-500/20' : 'bg-gradient-to-br from-purple-500 to-violet-600 shadow-purple-500/20'
                    }`}>{selectedPegawai.nama?.[0]}</div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg font-bold truncate">{selectedPegawai.nama}</h2>
                      <p className="text-sm text-gray-500">NIP: {selectedPegawai.nip}</p>
                    </div>
                    {recentCountMap[selectedPegawai.id] > 0 && (
                      <span className="bg-green-50 text-green-600 border border-green-200 px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        {recentCountMap[selectedPegawai.id]} berkas baru
                      </span>
                    )}
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
                      <div key={i} className="bg-gray-50 rounded-lg p-2">
                        <p className="text-xs text-gray-400">{x.l}</p>
                        <p className="text-xs font-medium truncate">{x.v || '-'}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* FOLDER & BERKAS */}
                <div className="flex-1 min-h-0 bg-white rounded-xl shadow-sm border flex flex-col overflow-hidden">
                  <div className="shrink-0 p-4 border-b">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-sm flex items-center gap-2">
                        <svg className="w-4 h-4 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M3.75 3A1.75 1.75 0 002 4.75v3.26a3.235 3.235 0 011.75-.51h12.5c.644 0 1.245.188 1.75.51V6.75A1.75 1.75 0 0016.25 5h-4.836a.25.25 0 01-.177-.073L9.823 3.513A1.75 1.75 0 008.586 3H3.75z" />
                          <path d="M3.75 9A1.75 1.75 0 002 10.75v4.5c0 .966.784 1.75 1.75 1.75h12.5A1.75 1.75 0 0018 15.25v-4.5A1.75 1.75 0 0016.25 9H3.75z" />
                        </svg>
                        Folder & Berkas ({berkas.length})
                      </h3>
                    </div>
                    <div className="relative">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                      </svg>
                      <input type="text" value={searchBerkas} onChange={e => setSearchBerkas(e.target.value)}
                        placeholder="Cari folder atau berkas..."
                        className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
                      {searchBerkas && (
                        <button onClick={() => setSearchBerkas('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                    {searchBerkas && (
                      <p className="text-[11px] text-gray-400 mt-1.5">Ditemukan {totalMatchBerkas} berkas di {filteredFoldersAndBerkas.length} folder</p>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-3">
                    {filteredFoldersAndBerkas.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-gray-300">
                        <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                        </svg>
                        <p className="text-sm">Tidak ditemukan "{searchBerkas}"</p>
                      </div>
                    ) : filteredFoldersAndBerkas.map(folder => {
                      const isCollapsed = collapsedFolders[folder.id] && !searchBerkas
                      return (
                        <div key={folder.id} className="border rounded-xl overflow-hidden">
                          <button onClick={() => toggleFolder(folder.id)}
                            className="w-full bg-gray-50 hover:bg-gray-100 px-3 py-2.5 flex items-center gap-2 transition text-left">
                            <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 shrink-0 ${isCollapsed ? '' : 'rotate-90'}`}
                              fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                            </svg>
                            <svg className="w-5 h-5 text-orange-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M3.75 3A1.75 1.75 0 002 4.75v3.26a3.235 3.235 0 011.75-.51h12.5c.644 0 1.245.188 1.75.51V6.75A1.75 1.75 0 0016.25 5h-4.836a.25.25 0 01-.177-.073L9.823 3.513A1.75 1.75 0 008.586 3H3.75z" />
                              <path d="M3.75 9A1.75 1.75 0 002 10.75v4.5c0 .966.784 1.75 1.75 1.75h12.5A1.75 1.75 0 0018 15.25v-4.5A1.75 1.75 0 0016.25 9H3.75z" />
                            </svg>
                            <span className="font-medium text-sm truncate flex-1">
                              <HighlightText text={folder.nama_folder} search={searchBerkas} />
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                              folder.level_folder === 'Sangat Penting' ? 'bg-red-100 text-red-600' :
                              folder.level_folder === 'Penting' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>{folder.level_folder}</span>
                            <span className="text-xs text-gray-400 shrink-0">({folder.filteredBerkas.length})</span>
                          </button>

                          {!isCollapsed && (
                            <div className="p-2">
                              {folder.filteredBerkas.length === 0 ? (
                                <p className="text-xs text-gray-400 text-center py-3">Kosong</p>
                              ) : folder.filteredBerkas.map(b => {
                                const isRecent = new Date(b.created_at) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                                return (
                                  <div key={b.id} className="flex items-center justify-between bg-gray-50 p-2.5 rounded-lg hover:bg-gray-100 mb-1 transition group">
                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                      <div className="relative shrink-0">
                                        <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                                          <path d="M3 3.5A1.5 1.5 0 014.5 2h6.879a1.5 1.5 0 011.06.44l4.122 4.12A1.5 1.5 0 0117 7.622V16.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 16.5v-13z" />
                                        </svg>
                                        {isRecent && (
                                          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full" />
                                        )}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-sm font-medium truncate">
                                          <HighlightText text={b.nama_berkas} search={searchBerkas} />
                                        </p>
                                        {isRecent && (
                                          <span className="text-[10px] text-green-600 font-medium">{formatTimeAgo(b.created_at)}</span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex gap-1 shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button onClick={() => viewBerkas(b)}
                                        className="bg-green-100 text-green-600 p-1.5 rounded-lg hover:bg-green-200 transition" title="Lihat">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                      </button>
                                      <button onClick={() => downloadBerkas(b)}
                                        className="bg-blue-100 text-blue-600 p-1.5 rounded-lg hover:bg-blue-200 transition" title="Download">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            ) : (
              /* EMPTY STATE */
              <div className="bg-white rounded-xl shadow-sm border flex flex-col items-center justify-center flex-1 text-gray-300">
                <svg className="w-16 h-16 mb-3" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.5a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                </svg>
                <p className="text-sm font-medium">Pilih {isPejabat ? 'anak buah' : 'pegawai'} dari daftar</p>
                <p className="text-xs mt-1 text-gray-300">atau gunakan pencarian cepat di atas</p>
                {recentBerkas.length > 0 && (
                  <button onClick={() => setShowNewBerkasPanel(true)}
                    className="mt-4 bg-green-50 text-green-700 border border-green-200 px-4 py-2 rounded-xl text-sm font-medium hover:bg-green-100 transition flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                    </svg>
                    Lihat {recentBerkas.length} Berkas Baru
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== PDF VIEWER ===== */}
      {viewingPDF && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl animate-modal">
            <div className="p-4 border-b flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M3 3.5A1.5 1.5 0 014.5 2h6.879a1.5 1.5 0 011.06.44l4.122 4.12A1.5 1.5 0 0117 7.622V16.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 16.5v-13z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm truncate">{pdfTitle || 'PDF Viewer'}</h3>
                  <p className="text-[11px] text-gray-400">Preview dokumen</p>
                </div>
              </div>
              <button onClick={closePDF}
                className="bg-red-500 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-red-600 transition flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Tutup
              </button>
            </div>
            <div className="flex-1 min-h-0">
              {loadingPDF ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <div className="animate-spin h-10 w-10 border-4 border-orange-500 border-t-transparent rounded-full mb-4" />
                  <p className="text-gray-500">Memuat PDF...</p>
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

      <style>{`
        @keyframes modal {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-modal { animation: modal 0.2s ease-out; }
      `}</style>
    </div>
  )
}

export default PimpinanPegawaiPage