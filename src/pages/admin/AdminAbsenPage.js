import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

// ========================================
// STATUS ABSEN
// ========================================
const STATUS_LIST = [
  { id: 'Hadir', label: 'Hadir', short: 'H', color: 'bg-green-500' },
  { id: 'Dinas Luar', label: 'Dinas Luar', short: 'DL', color: 'bg-blue-500' },
  { id: 'Dinas Malam', label: 'Dinas Malam', short: 'DM', color: 'bg-indigo-500' },
  { id: 'Cuti', label: 'Cuti', short: 'C', color: 'bg-purple-500' },
  { id: 'Sakit', label: 'Sakit', short: 'S', color: 'bg-yellow-500' },
  { id: 'Alpa', label: 'Alpa', short: 'A', color: 'bg-red-500' },
  { id: 'Izin', label: 'Izin', short: 'I', color: 'bg-orange-500' },
  { id: 'Lepas Piket', label: 'Lepas Piket', short: 'LP', color: 'bg-teal-500' },
]

// ========================================
// BAGIAN
// ========================================
const BAGIAN_ORDER = ['Pejabat', 'Umum', 'Operasi', 'Sumber Daya', 'Lainnya']

const BAGIAN_COLORS = {
  'Pejabat': { gradient: 'from-red-600 to-red-800', icon: '👑' },
  'Umum': { gradient: 'from-blue-500 to-blue-700', icon: '🏢' },
  'Operasi': { gradient: 'from-green-500 to-green-700', icon: '🚁' },
  'Sumber Daya': { gradient: 'from-purple-500 to-purple-700', icon: '👥' },
  'Lainnya': { gradient: 'from-gray-500 to-gray-700', icon: '📋' },
}

// ========================================
// HELPERS
// ========================================
function getKelasJabatanNumber(kelas) {
  if (!kelas) return 0
  const m = kelas.match(/\d+/)
  return m ? parseInt(m[0]) : 0
}

function getGolonganNumber(pangkat) {
  if (!pangkat) return 0
  const roman = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4 }
  const m = pangkat.match(/(IV|III|II|I)\/([a-e])/)
  if (!m) return 0
  return (roman[m[1]] || 0) * 10 + (m[2] ? m[2].charCodeAt(0) - 96 : 0)
}

function sortByJabatan(a, b) {
  const ka = getKelasJabatanNumber(a.kelas_jabatan)
  const kb = getKelasJabatanNumber(b.kelas_jabatan)
  if (kb !== ka) return kb - ka
  const ga = getGolonganNumber(a.pangkat_gol_ruang)
  const gb = getGolonganNumber(b.pangkat_gol_ruang)
  if (gb !== ga) return gb - ga
  return a.nama.localeCompare(b.nama)
}

// ========================================
// COMPONENT
// ========================================
function AdminAbsenPage() {
  const [pegawai, setPegawai] = useState([])
  const [absenData, setAbsenData] = useState({})
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('input')
  const [searchPegawai, setSearchPegawai] = useState('')
  const [monitorMonth, setMonitorMonth] = useState(new Date().toISOString().slice(0, 7))
  const [monitorData, setMonitorData] = useState([])
  const [monitorLoading, setMonitorLoading] = useState(false)
  const [filterBagian, setFilterBagian] = useState('semua')
  const [filterStatus, setFilterStatus] = useState('semua')
  const [groupedPegawai, setGroupedPegawai] = useState({})
  const [collapsedBagian, setCollapsedBagian] = useState({})

  // ========== EFFECTS ==========
  useEffect(() => { loadPegawai() }, [])
  useEffect(() => { if (pegawai.length > 0) loadAbsen(tanggal) }, [tanggal, pegawai])
  useEffect(() => { if (activeTab === 'monitor' && pegawai.length > 0) loadMonitor() }, [activeTab, monitorMonth])

  // ========================================
  // LOAD PEGAWAI (exclude Admin)
  // ========================================
  const loadPegawai = async () => {
    try {
      const { data: adminUsers } = await supabase
        .from('users')
        .select('id')
        .eq('level_id', 1)
      const adminIds = new Set((adminUsers || []).map(u => u.id))

      const { data } = await supabase
        .from('profile')
        .select('*')
        .order('nama')

      if (data) {
        const filtered = data.filter(p => !adminIds.has(p.user_id))
        setPegawai(filtered)
        groupPegawai(filtered)
      }
    } catch (err) {
      toast.error('Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }

  // ========================================
  // KELOMPOKKAN PEGAWAI
  // Pejabat = Kepala Kantor + Kepala Bagian
  // Bagian = Staf saja (tanpa Kepala Bagian)
  // ========================================
  const groupPegawai = (allPegawai) => {
    const groups = {}

    // 1. Cari Kepala Kantor
    const kepalaKantor = allPegawai.find(p =>
      !p.nip_pimpinan_langsung &&
      (p.jabatan || '').toLowerCase().includes('kepala')
    )
    const nipKepalaKantor = kepalaKantor?.nip || null

    // 2. PEJABAT = Kepala Kantor + anak buah langsung Kepala Kantor (Kepala Bagian)
    const pejabatGroup = allPegawai.filter(p => {
      // Kepala Kantor (tidak punya pimpinan langsung)
      if (!p.nip_pimpinan_langsung) {
        const jab = (p.jabatan || '').toLowerCase()
        return jab.includes('kepala') || jab.includes('wakil')
      }
      // Anak buah langsung Kepala Kantor = Kepala Bagian
      if (nipKepalaKantor && p.nip_pimpinan_langsung === nipKepalaKantor) return true
      return false
    })

    // Sort Pejabat: Kepala Kantor → Kepala Umum → Kepala Operasi → Kepala SDM
    const sortPejabat = (a, b) => {
      const jabA = (a.jabatan || '').toLowerCase()
      const jabB = (b.jabatan || '').toLowerCase()

      // Kepala Kantor paling atas
      if (!a.nip_pimpinan_langsung && b.nip_pimpinan_langsung) return -1
      if (a.nip_pimpinan_langsung && !b.nip_pimpinan_langsung) return 1

      // Kedua-duanya Kepala Kantor (Kepala + Wakil)
      if (!a.nip_pimpinan_langsung && !b.nip_pimpinan_langsung) {
        if (jabA.includes('wakil') && !jabB.includes('wakil')) return 1
        if (!jabA.includes('wakil') && jabB.includes('wakil')) return -1
        return sortByJabatan(a, b)
      }

      // Urutan Kepala Bagian: Umum → Operasi → SDM → Lainnya
      const getOrder = (jab) => {
        if (jab.includes('umum') || jab.includes('tata usaha')) return 1
        if (jab.includes('operasi') || jab.includes('ops') || jab.includes('sar')) return 2
        if (jab.includes('sumber daya') || jab.includes('sdm') || jab.includes('kepegawaian')) return 3
        return 4
      }
      return getOrder(jabA) - getOrder(jabB)
    }

    groups['Pejabat'] = {
      nama: 'Pejabat',
      namaPimpinan: null,
      nipPimpinan: null,
      pegawai: pejabatGroup.sort(sortPejabat)
    }

    // 3. Mapping NIP Kepala Bagian → Nama Bagian
    const kepalaBagianMap = {}
    pejabatGroup.forEach(p => {
      if (!p.nip_pimpinan_langsung) return // Skip Kepala Kantor

      const jab = (p.jabatan || '').toLowerCase()
      if (jab.includes('umum') || jab.includes('tata usaha') || jab.includes('keuangan') || jab.includes('administrasi')) {
        kepalaBagianMap[p.nip] = { nama: 'Umum', namaPimpinan: p.nama, nipPimpinan: p.nip }
      } else if (jab.includes('operasi') || jab.includes('ops') || jab.includes('sar') || jab.includes('rescue')) {
        kepalaBagianMap[p.nip] = { nama: 'Operasi', namaPimpinan: p.nama, nipPimpinan: p.nip }
      } else if (jab.includes('sumber daya') || jab.includes('sdm') || jab.includes('kepegawaian') || jab.includes('diklat')) {
        kepalaBagianMap[p.nip] = { nama: 'Sumber Daya', namaPimpinan: p.nama, nipPimpinan: p.nip }
      }
    })

    // 4. Kelompokkan STAF ke bagian
    const pejabatIds = new Set(pejabatGroup.map(p => p.id))
    const stafPegawai = allPegawai.filter(p => !pejabatIds.has(p.id))

    stafPegawai.forEach(p => {
      const nipPimpinan = p.nip_pimpinan_langsung
      let bagianName = 'Lainnya'
      let bagianInfo = { nama: 'Lainnya', namaPimpinan: p.nama_pimpinan_langsung || '-', nipPimpinan: nipPimpinan }

      // Cek pimpinan langsungnya = Kepala Bagian?
      if (kepalaBagianMap[nipPimpinan]) {
        bagianName = kepalaBagianMap[nipPimpinan].nama
        bagianInfo = kepalaBagianMap[nipPimpinan]
      } else {
        // Fallback: cek jabatan pimpinan langsung
        const jabPim = (p.jabatan_pimpinan_langsung || '').toLowerCase()
        if (jabPim.includes('umum') || jabPim.includes('tata usaha') || jabPim.includes('keuangan')) {
          bagianName = 'Umum'; bagianInfo.nama = 'Umum'
        } else if (jabPim.includes('operasi') || jabPim.includes('ops') || jabPim.includes('sar')) {
          bagianName = 'Operasi'; bagianInfo.nama = 'Operasi'
        } else if (jabPim.includes('sumber daya') || jabPim.includes('sdm') || jabPim.includes('kepegawaian')) {
          bagianName = 'Sumber Daya'; bagianInfo.nama = 'Sumber Daya'
        }
      }

      if (!groups[bagianName]) {
        groups[bagianName] = { nama: bagianName, namaPimpinan: bagianInfo.namaPimpinan, nipPimpinan: bagianInfo.nipPimpinan, pegawai: [] }
      }
      groups[bagianName].pegawai.push(p)
    })

    // Sort staf per bagian
    Object.keys(groups).forEach(key => {
      if (key !== 'Pejabat') groups[key].pegawai.sort(sortByJabatan)
    })

    setGroupedPegawai(groups)
  }

  // ========================================
  // LOAD ABSEN
  // ========================================
  const loadAbsen = async (tgl) => {
    try {
      const { data } = await supabase.from('absen').select('*').eq('tanggal', tgl)
      const map = {}
      if (data) data.forEach(a => { map[a.profile_id] = a.status_absen })
      setAbsenData(map)
    } catch (err) { toast.error('Gagal memuat absen') }
  }

  // ========================================
  // LOAD MONITORING
  // ========================================
  const loadMonitor = async () => {
    setMonitorLoading(true)
    try {
      const { data } = await supabase.from('absen').select('*')
        .gte('tanggal', `${monitorMonth}-01`)
        .lte('tanggal', `${monitorMonth}-31`)
      if (data) setMonitorData(data)
    } catch (err) { toast.error('Gagal memuat monitoring') }
    finally { setMonitorLoading(false) }
  }

  // ========================================
  // HANDLE ABSEN
  // ========================================
  const handleAbsen = async (profileId, status) => {
    const current = absenData[profileId]
    if (current === status) {
      await supabase.from('absen').delete().eq('profile_id', profileId).eq('tanggal', tanggal)
      setAbsenData(prev => { const u = { ...prev }; delete u[profileId]; return u })
      return
    }
    try {
      if (current) {
        await supabase.from('absen').update({ status_absen: status }).eq('profile_id', profileId).eq('tanggal', tanggal)
      } else {
        await supabase.from('absen').insert({ profile_id: profileId, tanggal, status_absen: status })
      }
      setAbsenData(prev => ({ ...prev, [profileId]: status }))
    } catch (err) { toast.error('Gagal') }
  }

  // ========================================
  // SET SEMUA HADIR
  // ========================================
  const handleSetAllHadir = async (members) => {
    if (!window.confirm(`Set ${members.length} pegawai menjadi HADIR?`)) return
    setSaving(true)
    const lt = toast.loading('Menyimpan...')
    try {
      let c = 0
      for (const p of members) {
        if (!absenData[p.id]) {
          await supabase.from('absen').insert({ profile_id: p.id, tanggal, status_absen: 'Hadir' })
          c++
        }
      }
      await loadAbsen(tanggal)
      toast.dismiss(lt); toast.success(`${c} pegawai diset Hadir!`)
    } catch (err) { toast.dismiss(lt); toast.error(err.message) }
    finally { setSaving(false) }
  }

  // ========================================
  // RESET BAGIAN
  // ========================================
  const handleResetBagian = async (members) => {
    if (!window.confirm(`Reset absen ${members.length} pegawai?`)) return
    setSaving(true)
    const lt = toast.loading('Mereset...')
    try {
      for (const p of members) {
        if (absenData[p.id]) await supabase.from('absen').delete().eq('profile_id', p.id).eq('tanggal', tanggal)
      }
      await loadAbsen(tanggal)
      toast.dismiss(lt); toast.success('Direset!')
    } catch (err) { toast.dismiss(lt); toast.error(err.message) }
    finally { setSaving(false) }
  }

  // ========================================
  // MONITORING HELPERS
  // ========================================
  const getMonitorStats = (pid) => {
    const s = {}
    STATUS_LIST.forEach(st => { s[st.id] = 0 })
    monitorData.filter(a => a.profile_id === pid).forEach(a => { if (s[a.status_absen] !== undefined) s[a.status_absen]++ })
    return s
  }

  const getTotalStats = () => {
    const s = {}
    STATUS_LIST.forEach(st => { s[st.id] = 0 })
    monitorData.forEach(a => { if (s[a.status_absen] !== undefined) s[a.status_absen]++ })
    return s
  }

  const getProblematicCount = () => {
    let c = 0
    pegawai.forEach(p => { const s = getMonitorStats(p.id); if (s['Alpa'] > 0 || s['Sakit'] > 2 || s['Izin'] > 3) c++ })
    return c
  }

  // ========================================
  // FILTER & NAVIGATION
  // ========================================
  const filterMembers = (m) => {
    if (!searchPegawai) return m
    return m.filter(p => p.nama.toLowerCase().includes(searchPegawai.toLowerCase()) || p.nip.includes(searchPegawai))
  }

  const getOrderedGroups = () => {
    const o = []
    BAGIAN_ORDER.forEach(n => { if (groupedPegawai[n]) o.push(groupedPegawai[n]) })
    Object.entries(groupedPegawai).forEach(([n, g]) => { if (!BAGIAN_ORDER.includes(n)) o.push(g) })
    return o
  }

  const toggleCollapse = (n) => setCollapsedBagian(prev => ({ ...prev, [n]: !prev[n] }))

  const goToPrevDay = () => { const d = new Date(tanggal); d.setDate(d.getDate() - 1); setTanggal(d.toISOString().split('T')[0]) }
  const goToNextDay = () => { const d = new Date(tanggal); d.setDate(d.getDate() + 1); setTanggal(d.toISOString().split('T')[0]) }
  const goToToday = () => setTanggal(new Date().toISOString().split('T')[0])

  // ========================================
  // RENDER TABLE PER BAGIAN
  // ========================================
  const renderBagianTable = (group) => {
    const members = filterMembers(group.pegawai)
    if (members.length === 0) return null

    const style = BAGIAN_COLORS[group.nama] || BAGIAN_COLORS['Lainnya']
    const isCollapsed = collapsedBagian[group.nama]
    const isInput = activeTab === 'input'

    // Summary
    const summary = {}
    STATUS_LIST.forEach(s => { summary[s.id] = 0 })
    if (isInput) {
      members.forEach(p => { const st = absenData[p.id]; if (st && summary[st] !== undefined) summary[st]++ })
    } else {
      members.forEach(p => { const stats = getMonitorStats(p.id); STATUS_LIST.forEach(s => { summary[s.id] += stats[s.id] }) })
    }
    const belumAbsen = isInput ? members.filter(p => !absenData[p.id]).length : 0

    return (
      <div key={group.nama} className="bg-white rounded-xl shadow-sm border mb-6 overflow-hidden">
        {/* HEADER */}
        <div className={`bg-gradient-to-r ${style.gradient} px-4 py-3 cursor-pointer`} onClick={() => toggleCollapse(group.nama)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl">{style.icon}</span>
              <div>
                <h3 className="text-white font-bold text-sm">{group.nama}</h3>
                {group.namaPimpinan && <p className="text-white/70 text-xs">Pimpinan: {group.namaPimpinan}</p>}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-1">
                {STATUS_LIST.map(s => {
                  if (summary[s.id] === 0) return null
                  return <div key={s.id} className={`${s.color} text-white text-[10px] px-1.5 py-0.5 rounded font-bold`}>{s.short}:{summary[s.id]}</div>
                })}
                {isInput && belumAbsen > 0 && <div className="bg-white/20 text-white text-[10px] px-1.5 py-0.5 rounded">Belum:{belumAbsen}</div>}
              </div>
              <div className="bg-white/20 text-white text-xs px-2 py-1 rounded-lg">{members.length} orang</div>
              <span className="text-white text-sm">{isCollapsed ? '▶' : '▼'}</span>
            </div>
          </div>
        </div>

        {/* CONTENT */}
        {!isCollapsed && (
          <>
            {/* Actions (input only) */}
            {isInput && (
              <div className="px-4 py-2 bg-gray-50 border-b flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <button onClick={() => handleSetAllHadir(members)} disabled={saving}
                    className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-lg text-xs font-medium disabled:opacity-50">✅ Set Semua Hadir</button>
                  <button onClick={() => handleResetBagian(members)} disabled={saving}
                    className="bg-gray-400 hover:bg-gray-500 text-white px-3 py-1 rounded-lg text-xs font-medium disabled:opacity-50">🔄 Reset</button>
                </div>
                <p className="text-xs text-gray-500">{members.length - belumAbsen}/{members.length} sudah absen</p>
              </div>
            )}

            {/* TABLE */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 w-8">No</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 min-w-[160px]">Nama / NIP</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 min-w-[120px]">Jabatan</th>
                    <th className="text-center px-2 py-2.5 text-xs font-semibold text-gray-500 w-14">Kelas</th>
                    <th className="text-center px-2 py-2.5 text-xs font-semibold text-gray-500 w-16">Gol</th>
                    {STATUS_LIST.map(s => (
                      <th key={s.id} className="text-center px-1 py-2.5 w-9">
                        <div className={`w-7 h-7 ${s.color} rounded text-white text-[10px] flex items-center justify-center font-bold mx-auto`} title={s.label}>{s.short}</div>
                      </th>
                    ))}
                    {!isInput && <th className="text-center px-2 py-2.5 text-xs font-semibold text-gray-500 w-12">Total</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {members.map((p, idx) => {
                    const stats = !isInput ? getMonitorStats(p.id) : null
                    const total = stats ? Object.values(stats).reduce((a, b) => a + b, 0) : 0
                    const hasIssue = stats ? (stats['Alpa'] > 0 || stats['Sakit'] > 2 || stats['Izin'] > 3) : false
                    const belum = isInput && !absenData[p.id]

                    return (
                      <tr key={p.id} className={`hover:bg-gray-50 transition ${hasIssue ? 'bg-red-50' : belum ? 'bg-yellow-50/50' : ''}`}>
                        <td className="px-3 py-2 text-xs text-gray-400">{idx + 1}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            {hasIssue && <span className="text-red-500 shrink-0">⚠️</span>}
                            {belum && <span className="text-yellow-500 shrink-0">⏳</span>}
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate max-w-[140px]">{p.nama}</p>
                              <p className="text-[10px] text-gray-400 font-mono">{p.nip}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2"><p className="text-xs text-gray-500 truncate max-w-[120px]" title={p.jabatan}>{p.jabatan || '-'}</p></td>
                        <td className="text-center px-2 py-2">
                          {p.kelas_jabatan
                            ? <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">{p.kelas_jabatan}</span>
                            : <span className="text-xs text-gray-300">-</span>}
                        </td>
                        <td className="text-center px-2 py-2"><span className="text-[10px] text-gray-500">{p.pangkat_gol_ruang || '-'}</span></td>
                        {STATUS_LIST.map(s => (
                          <td key={s.id} className="text-center px-1 py-2">
                            {isInput ? (
                              <button
                                onClick={() => handleAbsen(p.id, s.id)}
                                className={`w-7 h-7 rounded-md border-2 transition-all ${
                                  absenData[p.id] === s.id
                                    ? `${s.color} border-transparent text-white shadow-md scale-110`
                                    : 'border-gray-200 hover:border-gray-400 bg-white hover:scale-105'
                                }`}
                                title={`${p.nama}: ${s.label}`}
                              >
                                {absenData[p.id] === s.id && <span className="text-[10px] font-bold">✓</span>}
                              </button>
                            ) : (
                              <span className={`inline-flex items-center justify-center w-7 h-7 rounded text-[10px] font-bold ${
                                stats[s.id] > 0 ? `${s.color} text-white` : 'text-gray-300'
                              }`}>{stats[s.id] || '-'}</span>
                            )}
                          </td>
                        ))}
                        {!isInput && (
                          <td className="text-center px-2 py-2">
                            <span className="inline-flex items-center justify-center w-8 h-7 rounded bg-gray-100 text-xs font-bold text-gray-700">{total}</span>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t-2">
                    <td colSpan={5} className="px-3 py-2 text-xs font-semibold text-gray-600 text-right">Total:</td>
                    {STATUS_LIST.map(s => (
                      <td key={s.id} className="text-center px-1 py-2">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded text-[10px] font-bold ${
                          summary[s.id] > 0 ? `${s.color} text-white` : 'text-gray-300 bg-gray-100'
                        }`}>{summary[s.id] || '-'}</span>
                      </td>
                    ))}
                    {!isInput && (
                      <td className="text-center px-2 py-2">
                        <span className="inline-flex items-center justify-center w-8 h-7 rounded bg-gray-200 text-xs font-bold text-gray-700">
                          {Object.values(summary).reduce((a, b) => a + b, 0)}
                        </span>
                      </td>
                    )}
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>
    )
  }

  // ========================================
  // LOADING
  // ========================================
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="animate-spin h-10 w-10 border-t-4 border-orange-500 rounded-full mb-4"></div>
        <p className="text-gray-500 text-sm">Memuat data...</p>
      </div>
    )
  }

  const orderedGroups = getOrderedGroups()
  const totalPegawai = pegawai.length
  const totalSudahAbsen = Object.keys(absenData).length
  const totalBelumAbsen = totalPegawai - totalSudahAbsen

  // ========================================
  // RENDER
  // ========================================
  return (
    <div>
      {/* HEADER */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">📋 Absensi Pegawai</h1>
        <p className="text-gray-500 text-sm">Kelola absensi harian & monitoring bulanan</p>
      </div>

      {/* TABS */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6">
        {[
          { id: 'input', label: '✏️ Input Absen', desc: 'Isi absen harian' },
          { id: 'monitor', label: '📊 Monitoring', desc: 'Rekap bulanan' }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition ${
              activeTab === tab.id ? 'bg-orange-500 text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'
            }`}>
            <span className="block">{tab.label}</span>
            <span className={`text-[10px] block mt-0.5 ${activeTab === tab.id ? 'text-orange-100' : 'text-gray-400'}`}>{tab.desc}</span>
          </button>
        ))}
      </div>

      {/* ==================== INPUT ABSEN ==================== */}
      {activeTab === 'input' && (
        <div>
          {/* Controls */}
          <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <button onClick={goToPrevDay} className="px-2 py-1.5 hover:bg-white rounded text-sm transition">◀</button>
                <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)}
                  className="px-3 py-1.5 bg-white border rounded text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
                <button onClick={goToNextDay} className="px-2 py-1.5 hover:bg-white rounded text-sm transition">▶</button>
              </div>
              <button onClick={goToToday} className="bg-orange-100 text-orange-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-orange-200">📅 Hari Ini</button>
              <div className="flex-1 min-w-[200px]">
                <input type="text" value={searchPegawai} onChange={e => setSearchPegawai(e.target.value)}
                  placeholder="🔍 Cari pegawai..." className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">
                📅 {new Date(tanggal).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-green-600">✅ {totalSudahAbsen} sudah</span>
                <span className="text-gray-400">|</span>
                <span className="text-yellow-600">⏳ {totalBelumAbsen} belum</span>
                <span className="text-gray-400">|</span>
                <span className="text-gray-500">👥 {totalPegawai} total</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
              {STATUS_LIST.map(s => (
                <div key={s.id} className="flex items-center gap-1">
                  <div className={`w-5 h-5 ${s.color} rounded text-white text-[9px] flex items-center justify-center font-bold`}>{s.short}</div>
                  <span className="text-[10px] text-gray-500">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-4 md:grid-cols-8 gap-2 mb-6">
            {STATUS_LIST.map(s => {
              const count = Object.values(absenData).filter(v => v === s.id).length
              return (
                <div key={s.id} className="bg-white rounded-lg shadow-sm border p-2 text-center">
                  <div className={`w-7 h-7 ${s.color} rounded text-white text-[10px] flex items-center justify-center font-bold mx-auto mb-1`}>{s.short}</div>
                  <p className="text-lg font-bold text-gray-800">{count}</p>
                  <p className="text-[10px] text-gray-400 truncate">{s.label}</p>
                </div>
              )
            })}
          </div>

          {/* Tables */}
          {orderedGroups.map(g => renderBagianTable(g))}
          {orderedGroups.length === 0 && (
            <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
              <span className="text-5xl">📭</span>
              <p className="text-gray-400 mt-4">Belum ada data pegawai</p>
            </div>
          )}
        </div>
      )}

      {/* ==================== MONITORING ==================== */}
      {activeTab === 'monitor' && (
        <div>
          {/* Filter */}
          <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">📅 Bulan:</label>
                <input type="month" value={monitorMonth} onChange={e => setMonitorMonth(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">🏢 Bagian:</label>
                <select value={filterBagian} onChange={e => setFilterBagian(e.target.value)} className="px-3 py-2 border rounded-lg text-sm outline-none">
                  <option value="semua">Semua Bagian</option>
                  {orderedGroups.map(g => <option key={g.nama} value={g.nama}>{BAGIAN_COLORS[g.nama]?.icon || '📋'} {g.nama}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">🔍 Filter:</label>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 border rounded-lg text-sm outline-none">
                  <option value="semua">Semua Status</option>
                  <option value="bermasalah">⚠️ Bermasalah</option>
                  {STATUS_LIST.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-4 mt-3 pt-3 border-t text-xs text-gray-500">
              <span>📊 {new Date(monitorMonth + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</span>
              <span>👥 {pegawai.length} pegawai</span>
              <span>📝 {monitorData.length} data</span>
              {getProblematicCount() > 0 && <span className="text-red-500 font-medium">⚠️ {getProblematicCount()} bermasalah</span>}
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-4 md:grid-cols-8 gap-2 mb-6">
            {STATUS_LIST.map(s => {
              const total = getTotalStats()
              return (
                <div key={s.id} className="bg-white rounded-lg shadow-sm border p-2 text-center">
                  <div className={`w-7 h-7 ${s.color} rounded text-white text-[10px] flex items-center justify-center font-bold mx-auto mb-1`}>{s.short}</div>
                  <p className="text-lg font-bold text-gray-800">{total[s.id]}</p>
                  <p className="text-[10px] text-gray-400 truncate">{s.label}</p>
                </div>
              )
            })}
          </div>

          {/* Tables */}
          {monitorLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="animate-spin h-10 w-10 border-t-4 border-orange-500 rounded-full mb-4"></div>
              <p className="text-gray-500 text-sm">Memuat monitoring...</p>
            </div>
          ) : (
            <>
              {orderedGroups
                .filter(g => filterBagian === 'semua' || g.nama === filterBagian)
                .map(group => {
                  let fg = group
                  if (filterStatus !== 'semua') {
                    const fm = group.pegawai.filter(p => {
                      const s = getMonitorStats(p.id)
                      if (filterStatus === 'bermasalah') return s['Alpa'] > 0 || s['Sakit'] > 2 || s['Izin'] > 3
                      return s[filterStatus] > 0
                    })
                    if (fm.length === 0) return null
                    fg = { ...group, pegawai: fm }
                  }
                  return renderBagianTable(fg)
                })}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default AdminAbsenPage