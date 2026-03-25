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
// URUTAN GRUP
// ========================================
const BAGIAN_ORDER = ['Pimpinan', 'Umum', 'Sumber Daya', 'Operasi']

const BAGIAN_COLORS = {
  'Pimpinan': { gradient: 'from-red-600 to-red-800', icon: '👑' },
  'Umum': { gradient: 'from-blue-500 to-blue-700', icon: '🏢' },
  'Sumber Daya': { gradient: 'from-purple-500 to-purple-700', icon: '👥' },
  'Operasi': { gradient: 'from-green-500 to-green-700', icon: '🚁' },
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

  const [editMode, setEditMode] = useState(false)
  const [customOrder, setCustomOrder] = useState({})

  // ========================================
  // EFFECTS
  // ========================================
  useEffect(() => {
    loadSavedOrder()
    loadPegawai()
  }, [])

  useEffect(() => {
    if (pegawai.length > 0) loadAbsen(tanggal)
  }, [tanggal, pegawai])

  useEffect(() => {
    if (activeTab === 'monitor' && pegawai.length > 0) loadMonitor()
  }, [activeTab, monitorMonth])

  // ========================================
  // CUSTOM ORDER: LOAD / SAVE / RESET
  // ========================================
  const loadSavedOrder = () => {
    try {
      const saved = localStorage.getItem('absen_custom_order')
      if (saved) setCustomOrder(JSON.parse(saved))
    } catch (e) { console.error(e) }
  }

  const saveCustomOrder = (newOrder) => {
    try {
      localStorage.setItem('absen_custom_order', JSON.stringify(newOrder))
      setCustomOrder(newOrder)
      toast.success('Urutan & pengelompokan berhasil disimpan!')
    } catch (e) { toast.error('Gagal menyimpan') }
  }

  const resetOrder = (groupName) => {
    const newOrder = { ...customOrder }
    delete newOrder[groupName]
    localStorage.setItem('absen_custom_order', JSON.stringify(newOrder))

    const groupMapping = JSON.parse(localStorage.getItem('absen_group_mapping') || '{}')
    const newMapping = {}
    Object.entries(groupMapping).forEach(([id, grp]) => {
      if (grp !== groupName) newMapping[id] = grp
    })
    localStorage.setItem('absen_group_mapping', JSON.stringify(newMapping))

    setCustomOrder(newOrder)
    groupPegawai(pegawai, newOrder)
    toast.success(`Urutan ${groupName} direset!`)
  }

  const resetAllOrder = () => {
    if (!window.confirm('Reset semua urutan dan pengelompokan ke default?')) return
    localStorage.removeItem('absen_custom_order')
    localStorage.removeItem('absen_group_mapping')
    setCustomOrder({})
    groupPegawai(pegawai, {})
    toast.success('Semua direset!')
  }

  // ========================================
  // MOVE PEGAWAI (atas/bawah/pindah grup)
  // ========================================
  const movePegawai = (groupName, fromIndex, direction) => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1
    const group = groupedPegawai[groupName]
    if (!group) return

    const members = [...group.pegawai]
    if (toIndex < 0 || toIndex >= members.length) return

    const temp = members[fromIndex]
    members[fromIndex] = members[toIndex]
    members[toIndex] = temp

    const newGrouped = { ...groupedPegawai, [groupName]: { ...group, pegawai: members } }
    setGroupedPegawai(newGrouped)

    const newOrder = { ...customOrder, [groupName]: members.map(p => p.id) }
    setCustomOrder(newOrder)
  }

  const moveToTop = (groupName, fromIndex) => {
    const group = groupedPegawai[groupName]
    if (!group || fromIndex === 0) return

    const members = [...group.pegawai]
    const item = members.splice(fromIndex, 1)[0]
    members.unshift(item)

    setGroupedPegawai({ ...groupedPegawai, [groupName]: { ...group, pegawai: members } })
    setCustomOrder({ ...customOrder, [groupName]: members.map(p => p.id) })
  }

  const moveToBottom = (groupName, fromIndex) => {
    const group = groupedPegawai[groupName]
    if (!group || fromIndex === group.pegawai.length - 1) return

    const members = [...group.pegawai]
    const item = members.splice(fromIndex, 1)[0]
    members.push(item)

    setGroupedPegawai({ ...groupedPegawai, [groupName]: { ...group, pegawai: members } })
    setCustomOrder({ ...customOrder, [groupName]: members.map(p => p.id) })
  }

  const movePegawaiToGroup = (fromGroup, fromIndex, toGroup) => {
    const from = groupedPegawai[fromGroup]
    let to = groupedPegawai[toGroup]

    if (!from) return

    // Kalau grup tujuan belum ada, buat baru
    if (!to) {
      to = { nama: toGroup, namaPimpinan: null, nipPimpinan: null, pegawai: [] }
    }

    const fromMembers = [...from.pegawai]
    const toMembers = [...to.pegawai]

    const [movedPegawai] = fromMembers.splice(fromIndex, 1)
    toMembers.push(movedPegawai)

    const newGrouped = {
      ...groupedPegawai,
      [fromGroup]: { ...from, pegawai: fromMembers },
      [toGroup]: { ...to, pegawai: toMembers }
    }

    if (fromMembers.length === 0) delete newGrouped[fromGroup]

    setGroupedPegawai(newGrouped)

    const newOrder = { ...customOrder }
    newOrder[fromGroup] = fromMembers.map(p => p.id)
    newOrder[toGroup] = toMembers.map(p => p.id)
    setCustomOrder(newOrder)

    // Simpan mapping
    const groupMapping = JSON.parse(localStorage.getItem('absen_group_mapping') || '{}')
    groupMapping[movedPegawai.id] = toGroup
    localStorage.setItem('absen_group_mapping', JSON.stringify(groupMapping))

    toast.success(`${movedPegawai.nama} dipindah ke ${toGroup}`)
  }

  // ========================================
  // LOAD PEGAWAI
  // ========================================
  const loadPegawai = async () => {
    try {
      const { data: adminUsers } = await supabase.from('users').select('id').eq('level_id', 1)
      const adminIds = new Set((adminUsers || []).map(u => u.id))

      const { data } = await supabase.from('profile').select('*').order('nama')

      if (data) {
        const filtered = data.filter(p => !adminIds.has(p.user_id))
        setPegawai(filtered)

        const savedOrder = localStorage.getItem('absen_custom_order')
        const parsed = savedOrder ? JSON.parse(savedOrder) : {}
        groupPegawai(filtered, parsed)
      }
    } catch (err) { toast.error('Gagal memuat data') }
    finally { setLoading(false) }
  }

  // ========================================
  // GROUP PEGAWAI
  // ========================================
  const groupPegawai = (allPegawai, savedOrder = customOrder) => {
    const groups = {
      'Pimpinan': { nama: 'Pimpinan', namaPimpinan: null, nipPimpinan: null, pegawai: [] },
      'Umum': { nama: 'Umum', namaPimpinan: null, nipPimpinan: null, pegawai: [] },
      'Sumber Daya': { nama: 'Sumber Daya', namaPimpinan: null, nipPimpinan: null, pegawai: [] },
      'Operasi': { nama: 'Operasi', namaPimpinan: null, nipPimpinan: null, pegawai: [] },
    }

    // 1. Pimpinan
    const nipPimpinanDipakai = new Set(allPegawai.map(p => p.nip_pimpinan_langsung).filter(Boolean))
    const pimpinanList = allPegawai.filter(p => nipPimpinanDipakai.has(p.nip))
    groups['Pimpinan'].pegawai = [...pimpinanList]

    // 2. Bawahan
    const pimpinanIds = new Set(pimpinanList.map(p => p.id))
    const bawahan = allPegawai.filter(p => !pimpinanIds.has(p.id))

    bawahan.forEach((p) => {
      const namaPimpinan = (p.nama_pimpinan_langsung || '').toLowerCase()
      const jabatanPimpinan = (p.jabatan_pimpinan_langsung || '').toLowerCase()
      const jabatan = (p.jabatan || '').toLowerCase()

      let targetGroup = null

      if (namaPimpinan.includes('umum') || jabatanPimpinan.includes('umum') || jabatanPimpinan.includes('tata usaha') || jabatanPimpinan.includes('keuangan')) {
        targetGroup = 'Umum'
      } else if (namaPimpinan.includes('sumber daya') || jabatanPimpinan.includes('sumber daya') || jabatanPimpinan.includes('sdm') || jabatanPimpinan.includes('kepegawaian') || jabatanPimpinan.includes('diklat')) {
        targetGroup = 'Sumber Daya'
      } else if (namaPimpinan.includes('operasi') || jabatanPimpinan.includes('operasi') || jabatanPimpinan.includes('ops') || jabatanPimpinan.includes('sar')) {
        targetGroup = 'Operasi'
      }

      if (!targetGroup) {
        if (jabatan.includes('umum') || jabatan.includes('tata usaha') || jabatan.includes('keuangan') || jabatan.includes('administrasi')) {
          targetGroup = 'Umum'
        } else if (jabatan.includes('sumber daya') || jabatan.includes('sdm') || jabatan.includes('kepegawaian') || jabatan.includes('diklat')) {
          targetGroup = 'Sumber Daya'
        } else if (jabatan.includes('operasi') || jabatan.includes('ops') || jabatan.includes('sar') || jabatan.includes('rescue')) {
          targetGroup = 'Operasi'
        }
      }

      if (targetGroup) {
        groups[targetGroup].pegawai.push(p)
        if (!groups[targetGroup].namaPimpinan && p.nama_pimpinan_langsung) {
          groups[targetGroup].namaPimpinan = p.nama_pimpinan_langsung
          groups[targetGroup].nipPimpinan = p.nip_pimpinan_langsung
        }
      }
    })

    // 2.5 Apply saved group mapping
    const groupMapping = JSON.parse(localStorage.getItem('absen_group_mapping') || '{}')
    Object.entries(groupMapping).forEach(([pegawaiId, targetGroup]) => {
      const id = parseInt(pegawaiId)
      let found = null
      let foundInGroup = null

      Object.keys(groups).forEach(groupName => {
        const idx = groups[groupName].pegawai.findIndex(p => p.id === id)
        if (idx !== -1) {
          found = groups[groupName].pegawai[idx]
          foundInGroup = groupName
        }
      })

      if (found && foundInGroup && foundInGroup !== targetGroup && groups[targetGroup]) {
        groups[foundInGroup].pegawai = groups[foundInGroup].pegawai.filter(p => p.id !== id)
        groups[targetGroup].pegawai.push(found)
      }
    })

    // 3. Apply custom order
    Object.keys(groups).forEach(key => {
      if (savedOrder && savedOrder[key]) {
        const orderIds = savedOrder[key]
        const ordered = []
        const remaining = [...groups[key].pegawai]

        orderIds.forEach(id => {
          const idx = remaining.findIndex(p => p.id === id)
          if (idx !== -1) ordered.push(remaining.splice(idx, 1)[0])
        })
        ordered.push(...remaining)
        groups[key].pegawai = ordered
      }
    })

    // 4. Hapus kosong
    const finalGroups = {}
    BAGIAN_ORDER.forEach(key => {
      if (groups[key] && groups[key].pegawai.length > 0) {
        finalGroups[key] = groups[key]
      }
    })

    setGroupedPegawai(finalGroups)
  }

  // ========================================
  // LOAD ABSEN & MONITORING
  // ========================================
  const loadAbsen = async (tgl) => {
    try {
      const { data } = await supabase.from('absen').select('*').eq('tanggal', tgl)
      const map = {}
      if (data) data.forEach(a => { map[a.profile_id] = a.status_absen })
      setAbsenData(map)
    } catch (err) { toast.error('Gagal memuat absen') }
  }

  const loadMonitor = async () => {
    setMonitorLoading(true)
    try {
      const { data } = await supabase.from('absen').select('*')
        .gte('tanggal', `${monitorMonth}-01`).lte('tanggal', `${monitorMonth}-31`)
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

  const handleSetAllHadir = async (members) => {
    if (!window.confirm(`Set ${members.length} pegawai menjadi HADIR?`)) return
    setSaving(true)
    const lt = toast.loading('Menyimpan...')
    try {
      let c = 0
      for (const p of members) {
        if (!absenData[p.id]) { await supabase.from('absen').insert({ profile_id: p.id, tanggal, status_absen: 'Hadir' }); c++ }
      }
      await loadAbsen(tanggal); toast.dismiss(lt); toast.success(`${c} pegawai diset Hadir!`)
    } catch (err) { toast.dismiss(lt); toast.error(err.message) }
    finally { setSaving(false) }
  }

  const handleResetBagian = async (members) => {
    if (!window.confirm(`Reset absen ${members.length} pegawai?`)) return
    setSaving(true)
    const lt = toast.loading('Mereset...')
    try {
      for (const p of members) {
        if (absenData[p.id]) await supabase.from('absen').delete().eq('profile_id', p.id).eq('tanggal', tanggal)
      }
      await loadAbsen(tanggal); toast.dismiss(lt); toast.success('Direset!')
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
  // HELPERS
  // ========================================
  const filterMembers = (m) => {
    if (!searchPegawai) return m
    return m.filter(p => p.nama.toLowerCase().includes(searchPegawai.toLowerCase()) || p.nip.includes(searchPegawai))
  }

  const getOrderedGroups = () => {
    const o = []
    BAGIAN_ORDER.forEach(n => { if (groupedPegawai[n]) o.push(groupedPegawai[n]) })
    return o
  }

  const toggleCollapse = (n) => setCollapsedBagian(prev => ({ ...prev, [n]: !prev[n] }))
  const goToPrevDay = () => { const d = new Date(tanggal); d.setDate(d.getDate() - 1); setTanggal(d.toISOString().split('T')[0]) }
  const goToNextDay = () => { const d = new Date(tanggal); d.setDate(d.getDate() + 1); setTanggal(d.toISOString().split('T')[0]) }
  const goToToday = () => setTanggal(new Date().toISOString().split('T')[0])

  // ========================================
  // RENDER TABLE
  // ========================================
  const renderBagianTable = (group) => {
    const members = editMode ? group.pegawai : filterMembers(group.pegawai)
    if (members.length === 0) return null

    const style = BAGIAN_COLORS[group.nama] || { gradient: 'from-gray-500 to-gray-700', icon: '📋' }
    const isCollapsed = collapsedBagian[group.nama]
    const isInput = activeTab === 'input'
    const hasCustomOrder = customOrder[group.nama] && customOrder[group.nama].length > 0

    const summary = {}
    STATUS_LIST.forEach(s => { summary[s.id] = 0 })
    if (isInput && !editMode) {
      members.forEach(p => { const st = absenData[p.id]; if (st && summary[st] !== undefined) summary[st]++ })
    } else if (!isInput) {
      members.forEach(p => { const stats = getMonitorStats(p.id); STATUS_LIST.forEach(s => { summary[s.id] += stats[s.id] }) })
    }
    const belumAbsen = isInput && !editMode ? members.filter(p => !absenData[p.id]).length : 0

    return (
      <div key={group.nama} className="bg-white rounded-xl shadow-sm border mb-6 overflow-hidden">
        {/* HEADER */}
        <div className={`bg-gradient-to-r ${style.gradient} px-4 py-3 cursor-pointer`} onClick={() => toggleCollapse(group.nama)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl">{style.icon}</span>
              <div>
                <h3 className="text-white font-bold text-sm flex items-center gap-2">
                  {group.nama}
                  {hasCustomOrder && <span className="bg-white/20 text-[10px] px-1.5 py-0.5 rounded">Custom</span>}
                </h3>
                {group.namaPimpinan && <p className="text-white/70 text-xs">Pimpinan: {group.namaPimpinan}</p>}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!editMode && (
                <div className="hidden md:flex items-center gap-1">
                  {STATUS_LIST.map(s => {
                    if (summary[s.id] === 0) return null
                    return <div key={s.id} className={`${s.color} text-white text-[10px] px-1.5 py-0.5 rounded font-bold`}>{s.short}:{summary[s.id]}</div>
                  })}
                  {isInput && belumAbsen > 0 && <div className="bg-white/20 text-white text-[10px] px-1.5 py-0.5 rounded">Belum:{belumAbsen}</div>}
                </div>
              )}
              <div className="bg-white/20 text-white text-xs px-2 py-1 rounded-lg">{members.length} orang</div>
              <span className="text-white text-sm">{isCollapsed ? '▶' : '▼'}</span>
            </div>
          </div>
        </div>

        {!isCollapsed && (
          <>
            {/* ACTIONS */}
            {isInput && !editMode && (
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

            {/* EDIT MODE: Info & Reset */}
            {editMode && (
              <div className="px-4 py-2 bg-yellow-50 border-b flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs text-yellow-700">🔀 Geser ▲▼ atau pindah ke grup lain</p>
                {hasCustomOrder && (
                  <button onClick={() => resetOrder(group.nama)}
                    className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded-lg text-xs font-medium">
                    🔄 Reset Grup Ini
                  </button>
                )}
              </div>
            )}

            {/* TABLE */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    {editMode && <th className="w-28 px-2 py-2.5 text-xs font-semibold text-gray-500 text-center">Atur</th>}
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 w-8">No</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 min-w-[160px]">Nama / NIP</th>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 min-w-[140px]">Jabatan</th>
                    <th className="text-center px-2 py-2.5 text-xs font-semibold text-gray-500 w-14">Kelas</th>
                    <th className="text-center px-2 py-2.5 text-xs font-semibold text-gray-500 w-16">Gol</th>
                    {!editMode && STATUS_LIST.map(s => (
                      <th key={s.id} className="text-center px-1 py-2.5 w-9">
                        <div className={`w-7 h-7 ${s.color} rounded text-white text-[10px] flex items-center justify-center font-bold mx-auto`} title={s.label}>{s.short}</div>
                      </th>
                    ))}
                    {!editMode && !isInput && <th className="text-center px-2 py-2.5 text-xs font-semibold text-gray-500 w-12">Total</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {members.map((p, idx) => {
                    const stats = !isInput && !editMode ? getMonitorStats(p.id) : null
                    const total = stats ? Object.values(stats).reduce((a, b) => a + b, 0) : 0
                    const hasIssue = stats ? (stats['Alpa'] > 0 || stats['Sakit'] > 2 || stats['Izin'] > 3) : false
                    const belum = isInput && !editMode && !absenData[p.id]

                    return (
                      <tr key={p.id} className={`hover:bg-gray-50 transition ${editMode ? 'bg-blue-50/30' : hasIssue ? 'bg-red-50' : belum ? 'bg-yellow-50/50' : ''}`}>
                        {/* EDIT MODE CONTROLS */}
                        {editMode && (
                          <td className="px-2 py-1">
                            <div className="flex flex-col items-center gap-1">
                              <div className="flex items-center gap-0.5">
                                <button onClick={() => moveToTop(group.nama, idx)} disabled={idx === 0}
                                  className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 text-gray-600 text-[10px] disabled:opacity-30" title="Ke atas">⏫</button>
                                <button onClick={() => movePegawai(group.nama, idx, 'up')} disabled={idx === 0}
                                  className="w-6 h-6 rounded bg-blue-100 hover:bg-blue-200 text-blue-600 text-xs disabled:opacity-30" title="Naik">▲</button>
                                <button onClick={() => movePegawai(group.nama, idx, 'down')} disabled={idx === members.length - 1}
                                  className="w-6 h-6 rounded bg-blue-100 hover:bg-blue-200 text-blue-600 text-xs disabled:opacity-30" title="Turun">▼</button>
                                <button onClick={() => moveToBottom(group.nama, idx)} disabled={idx === members.length - 1}
                                  className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 text-gray-600 text-[10px] disabled:opacity-30" title="Ke bawah">⏬</button>
                              </div>
                              <select value="" onChange={(e) => { if (e.target.value) { movePegawaiToGroup(group.nama, idx, e.target.value); e.target.value = '' } }}
                                className="w-full text-[10px] px-1 py-0.5 border rounded bg-white text-gray-600">
                                <option value="">Pindah ke...</option>
                                {BAGIAN_ORDER.filter(b => b !== group.nama).map(b => (
                                  <option key={b} value={b}>→ {b}</option>
                                ))}
                              </select>
                            </div>
                          </td>
                        )}

                        <td className="px-3 py-2 text-xs text-gray-400">{idx + 1}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            {!editMode && hasIssue && <span className="text-red-500 shrink-0">⚠️</span>}
                            {!editMode && belum && <span className="text-yellow-500 shrink-0">⏳</span>}
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate max-w-[150px]">{p.nama}</p>
                              <p className="text-[10px] text-gray-400 font-mono">{p.nip}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2"><p className="text-xs text-gray-500 truncate max-w-[140px]" title={p.jabatan}>{p.jabatan || '-'}</p></td>
                        <td className="text-center px-2 py-2">
                          {p.kelas_jabatan ? <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">{p.kelas_jabatan}</span> : <span className="text-xs text-gray-300">-</span>}
                        </td>
                        <td className="text-center px-2 py-2"><span className="text-[10px] text-gray-500">{p.pangkat_gol_ruang || '-'}</span></td>

                        {!editMode && STATUS_LIST.map(s => (
                          <td key={s.id} className="text-center px-1 py-2">
                            {isInput ? (
                              <button onClick={() => handleAbsen(p.id, s.id)}
                                className={`w-7 h-7 rounded-md border-2 transition-all ${absenData[p.id] === s.id ? `${s.color} border-transparent text-white shadow-md scale-110` : 'border-gray-200 hover:border-gray-400 bg-white hover:scale-105'}`}
                                title={`${p.nama}: ${s.label}`}>
                                {absenData[p.id] === s.id && <span className="text-[10px] font-bold">✓</span>}
                              </button>
                            ) : (
                              <span className={`inline-flex items-center justify-center w-7 h-7 rounded text-[10px] font-bold ${stats[s.id] > 0 ? `${s.color} text-white` : 'text-gray-300'}`}>{stats[s.id] || '-'}</span>
                            )}
                          </td>
                        ))}

                        {!editMode && !isInput && (
                          <td className="text-center px-2 py-2">
                            <span className="inline-flex items-center justify-center w-8 h-7 rounded bg-gray-100 text-xs font-bold text-gray-700">{total}</span>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>

                {!editMode && (
                  <tfoot>
                    <tr className="bg-gray-50 border-t-2">
                      <td colSpan={5} className="px-3 py-2 text-xs font-semibold text-gray-600 text-right">Total:</td>
                      {STATUS_LIST.map(s => (
                        <td key={s.id} className="text-center px-1 py-2">
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded text-[10px] font-bold ${summary[s.id] > 0 ? `${s.color} text-white` : 'text-gray-300 bg-gray-100'}`}>{summary[s.id] || '-'}</span>
                        </td>
                      ))}
                      {!isInput && (
                        <td className="text-center px-2 py-2">
                          <span className="inline-flex items-center justify-center w-8 h-7 rounded bg-gray-200 text-xs font-bold text-gray-700">{Object.values(summary).reduce((a, b) => a + b, 0)}</span>
                        </td>
                      )}
                    </tr>
                  </tfoot>
                )}
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
        <p className="text-gray-500 text-sm">Memuat data pegawai...</p>
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
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setEditMode(false) }}
            className={`flex-1 px-4 py-3 rounded-lg text-sm font-medium transition ${activeTab === tab.id ? 'bg-orange-500 text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'}`}>
            <span className="block">{tab.label}</span>
            <span className={`text-[10px] block mt-0.5 ${activeTab === tab.id ? 'text-orange-100' : 'text-gray-400'}`}>{tab.desc}</span>
          </button>
        ))}
      </div>

      {/* EDIT MODE BANNER */}
      {editMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔀</span>
              <div>
                <h3 className="font-bold text-blue-800 text-sm">Mode Edit Urutan & Pengelompokan</h3>
                <p className="text-blue-600 text-xs">Geser ▲▼ untuk ubah urutan. Pilih "Pindah ke..." untuk pindah grup.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={resetAllOrder} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg text-xs font-medium">🔄 Reset Semua</button>
              <button onClick={() => { saveCustomOrder(customOrder); setEditMode(false) }}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-medium">💾 Simpan</button>
              <button onClick={() => { setEditMode(false); loadPegawai() }}
                className="bg-red-100 hover:bg-red-200 text-red-600 px-4 py-2 rounded-lg text-xs font-medium">✕ Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* INPUT ABSEN */}
      {activeTab === 'input' && (
        <div>
          <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <button onClick={goToPrevDay} className="px-2 py-1.5 hover:bg-white rounded text-sm transition">◀</button>
                <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)}
                  className="px-3 py-1.5 bg-white border rounded text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
                <button onClick={goToNextDay} className="px-2 py-1.5 hover:bg-white rounded text-sm transition">▶</button>
              </div>
              <button onClick={goToToday} className="bg-orange-100 text-orange-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-orange-200">📅 Hari Ini</button>
              {!editMode && (
                <div className="flex-1 min-w-[200px]">
                  <input type="text" value={searchPegawai} onChange={e => setSearchPegawai(e.target.value)}
                    placeholder="🔍 Cari pegawai..." className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
                </div>
              )}
              {!editMode && (
                <button onClick={() => setEditMode(true)}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-1">
                  🔀 Atur Urutan
                </button>
              )}
            </div>

            {!editMode && (
              <>
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
              </>
            )}
          </div>

          {!editMode && (
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
          )}

          {orderedGroups.map(group => renderBagianTable(group))}
        </div>
      )}

      {/* MONITORING */}
      {activeTab === 'monitor' && (
        <div>
          <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">📅 Bulan:</label>
                <input type="month" value={monitorMonth} onChange={e => setMonitorMonth(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">🏢 Group:</label>
                <select value={filterBagian} onChange={e => setFilterBagian(e.target.value)} className="px-3 py-2 border rounded-lg text-sm outline-none">
                  <option value="semua">Semua Group</option>
                  {orderedGroups.map(g => <option key={g.nama} value={g.nama}>{g.nama}</option>)}
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

          {monitorLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="animate-spin h-10 w-10 border-t-4 border-orange-500 rounded-full mb-4"></div>
              <p className="text-gray-500 text-sm">Memuat monitoring...</p>
            </div>
          ) : (
            orderedGroups
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
              })
          )}
        </div>
      )}
    </div>
  )
}

export default AdminAbsenPage