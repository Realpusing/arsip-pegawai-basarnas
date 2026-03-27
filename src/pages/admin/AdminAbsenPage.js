import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'

// ========================================
// CONSTANTS
// ========================================
const STATUS_LIST = [
  { id: 'Hadir', label: 'Hadir', short: 'H', color: 'bg-green-500', ring: 'ring-green-300' },
  { id: 'Dinas Luar', label: 'Dinas Luar', short: 'DL', color: 'bg-blue-500', ring: 'ring-blue-300' },
  { id: 'Dinas Dalam', label: 'Dinas Dalam', short: 'DD', color: 'bg-indigo-500', ring: 'ring-indigo-300' },
  { id: 'Cuti', label: 'Cuti', short: 'C', color: 'bg-purple-500', ring: 'ring-purple-300' },
  { id: 'Sakit', label: 'Sakit', short: 'S', color: 'bg-yellow-500', ring: 'ring-yellow-300' },
  { id: 'Alpa', label: 'Alpa', short: 'A', color: 'bg-red-500', ring: 'ring-red-300' },
  { id: 'Izin', label: 'Izin', short: 'I', color: 'bg-orange-500', ring: 'ring-orange-300' },
  { id: 'Lepas Piket', label: 'Lepas Piket', short: 'LP', color: 'bg-teal-500', ring: 'ring-teal-300' },
]

const BAGIAN_ORDER = ['Pimpinan', 'Umum', 'Sumber Daya', 'Operasi']

const BAGIAN_COLORS = {
  Pimpinan: { gradient: 'from-red-600 to-red-800' },
  Umum: { gradient: 'from-blue-500 to-blue-700' },
  'Sumber Daya': { gradient: 'from-purple-500 to-purple-700' },
  Operasi: { gradient: 'from-green-500 to-green-700' },
}

// ========================================
// HELPER FUNCTIONS
// ========================================
const toLocalDate = (d = new Date()) => {
  const offset = d.getTimezoneOffset()
  return new Date(d.getTime() - offset * 60000).toISOString().split('T')[0]
}

const toMonthInput = (d = new Date()) => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const fetchLogoBuffer = async () => {
  try {
    const res = await fetch('/logos/LOGO_BASARNAS.png')
    if (!res.ok) throw new Error('Logo not found')
    return await res.arrayBuffer()
  } catch {
    return null
  }
}

// ========================================
// COMPONENT
// ========================================
function AdminAbsenPage() {
  // ── State ──
  const [pegawai, setPegawai] = useState([])
  const [absenData, setAbsenData] = useState({})
  const [tanggal, setTanggal] = useState(toLocalDate())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('input')
  const [searchPegawai, setSearchPegawai] = useState('')
  const [monitorMonth, setMonitorMonth] = useState(toMonthInput())
  const [monitorData, setMonitorData] = useState([])
  const [monitorLoading, setMonitorLoading] = useState(false)
  const [filterBagian, setFilterBagian] = useState('semua')
  const [filterStatus, setFilterStatus] = useState('semua')
  const [groupedPegawai, setGroupedPegawai] = useState({})
  const [collapsedBagian, setCollapsedBagian] = useState({})
  const [editMode, setEditMode] = useState(false)
  const [customOrder, setCustomOrder] = useState({})
  const [showExport, setShowExport] = useState(false)
  const [exportFrom, setExportFrom] = useState('')
  const [exportTo, setExportTo] = useState('')
  const [exportBagian, setExportBagian] = useState('semua')
  const [exportFormat, setExportFormat] = useState('excel')
  const [exporting, setExporting] = useState(false)
  const [penandatangan, setPenandatangan] = useState({
    nama: '',
    jabatan: 'Kepala Urusan Umum',
    pangkat: '',
    nip: '',
  })

  // ── Effects ──
  useEffect(() => {
    loadSavedOrder()
    loadPenandatangan()
    loadPegawai()
  }, [])

  useEffect(() => {
    if (pegawai.length > 0) loadAbsen(tanggal)
  }, [tanggal, pegawai])

  useEffect(() => {
    if (activeTab === 'monitor' && pegawai.length > 0) loadMonitor()
  }, [activeTab, monitorMonth])

  useEffect(() => {
    if (showExport && !exportFrom) {
      const now = new Date()
      setExportFrom(toLocalDate(new Date(now.getFullYear(), now.getMonth(), 1)))
      setExportTo(toLocalDate(now))
    }
  }, [showExport])

  // ── LocalStorage helpers ──
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
      toast.success('Urutan disimpan!')
    } catch { toast.error('Gagal menyimpan') }
  }

  const loadPenandatangan = () => {
    try {
      const saved = localStorage.getItem('absen_penandatangan')
      if (saved) setPenandatangan(JSON.parse(saved))
    } catch (e) { console.error(e) }
  }

  const savePenandatangan = (data) => {
    try {
      localStorage.setItem('absen_penandatangan', JSON.stringify(data))
      setPenandatangan(data)
    } catch (e) { console.error(e) }
  }

  const resetOrder = (groupName) => {
    const newOrder = { ...customOrder }
    delete newOrder[groupName]
    localStorage.setItem('absen_custom_order', JSON.stringify(newOrder))
    const mapping = JSON.parse(localStorage.getItem('absen_group_mapping') || '{}')
    const cleaned = {}
    Object.entries(mapping).forEach(([id, grp]) => { if (grp !== groupName) cleaned[id] = grp })
    localStorage.setItem('absen_group_mapping', JSON.stringify(cleaned))
    setCustomOrder(newOrder)
    groupPegawai(pegawai, newOrder)
    toast.success(`Urutan ${groupName} direset!`)
  }

  const resetAllOrder = () => {
    localStorage.removeItem('absen_custom_order')
    localStorage.removeItem('absen_group_mapping')
    setCustomOrder({})
    groupPegawai(pegawai, {})
    toast.success('Semua direset!')
  }

  // ── Move Pegawai ──
  const movePegawai = (gn, fi, dir) => {
    const ti = dir === 'up' ? fi - 1 : fi + 1
    const g = groupedPegawai[gn]
    if (!g) return
    const m = [...g.pegawai]
    if (ti < 0 || ti >= m.length) return
    ;[m[fi], m[ti]] = [m[ti], m[fi]]
    setGroupedPegawai({ ...groupedPegawai, [gn]: { ...g, pegawai: m } })
    setCustomOrder({ ...customOrder, [gn]: m.map(p => p.id) })
  }

  const moveToTop = (gn, fi) => {
    const g = groupedPegawai[gn]
    if (!g || fi === 0) return
    const m = [...g.pegawai]
    const item = m.splice(fi, 1)[0]
    m.unshift(item)
    setGroupedPegawai({ ...groupedPegawai, [gn]: { ...g, pegawai: m } })
    setCustomOrder({ ...customOrder, [gn]: m.map(p => p.id) })
  }

  const moveToBottom = (gn, fi) => {
    const g = groupedPegawai[gn]
    if (!g || fi === g.pegawai.length - 1) return
    const m = [...g.pegawai]
    const item = m.splice(fi, 1)[0]
    m.push(item)
    setGroupedPegawai({ ...groupedPegawai, [gn]: { ...g, pegawai: m } })
    setCustomOrder({ ...customOrder, [gn]: m.map(p => p.id) })
  }

  const movePegawaiToGroup = (fg, fi, tg) => {
    const from = groupedPegawai[fg]
    let to = groupedPegawai[tg]
    if (!from) return
    if (!to) to = { nama: tg, namaPimpinan: null, nipPimpinan: null, pegawai: [] }
    const fm = [...from.pegawai], tm = [...to.pegawai]
    const [moved] = fm.splice(fi, 1)
    tm.push(moved)
    const ng = { ...groupedPegawai, [fg]: { ...from, pegawai: fm }, [tg]: { ...to, pegawai: tm } }
    if (fm.length === 0) delete ng[fg]
    setGroupedPegawai(ng)
    const no = { ...customOrder, [fg]: fm.map(p => p.id), [tg]: tm.map(p => p.id) }
    setCustomOrder(no)
    const gm = JSON.parse(localStorage.getItem('absen_group_mapping') || '{}')
    gm[moved.id] = tg
    localStorage.setItem('absen_group_mapping', JSON.stringify(gm))
    toast.success(`${moved.nama} → ${tg}`)
  }

  // ── Load Data ──
  const loadPegawai = async () => {
    try {
      const { data: adminUsers } = await supabase.from('users').select('id').eq('level_id', 1)
      const adminIds = new Set((adminUsers || []).map(u => u.id))
      const { data } = await supabase.from('profile').select('*').order('nama')
      if (data) {
        const filtered = data.filter(p => !adminIds.has(p.user_id))
        setPegawai(filtered)
        const saved = localStorage.getItem('absen_custom_order')
        groupPegawai(filtered, saved ? JSON.parse(saved) : {})
      }
    } catch { toast.error('Gagal memuat data') }
    finally { setLoading(false) }
  }

  const groupPegawai = (all, savedOrder = customOrder) => {
    const groups = {
      Pimpinan: { nama: 'Pimpinan', namaPimpinan: null, nipPimpinan: null, pegawai: [] },
      Umum: { nama: 'Umum', namaPimpinan: null, nipPimpinan: null, pegawai: [] },
      'Sumber Daya': { nama: 'Sumber Daya', namaPimpinan: null, nipPimpinan: null, pegawai: [] },
      Operasi: { nama: 'Operasi', namaPimpinan: null, nipPimpinan: null, pegawai: [] },
    }
    const nipUsed = new Set(all.map(p => p.nip_pimpinan_langsung).filter(Boolean))
    const pimList = all.filter(p => nipUsed.has(p.nip))
    groups.Pimpinan.pegawai = [...pimList]
    const pimIds = new Set(pimList.map(p => p.id))
    const bawahan = all.filter(p => !pimIds.has(p.id))

    bawahan.forEach(p => {
      const np = (p.nama_pimpinan_langsung || '').toLowerCase()
      const jp = (p.jabatan_pimpinan_langsung || '').toLowerCase()
      const jb = (p.jabatan || '').toLowerCase()
      let tg = null
      if (np.includes('umum') || jp.includes('umum') || jp.includes('tata usaha') || jp.includes('keuangan')) tg = 'Umum'
      else if (np.includes('sumber daya') || jp.includes('sumber daya') || jp.includes('sdm') || jp.includes('kepegawaian') || jp.includes('diklat')) tg = 'Sumber Daya'
      else if (np.includes('operasi') || jp.includes('operasi') || jp.includes('ops') || jp.includes('sar')) tg = 'Operasi'
      if (!tg) {
        if (jb.includes('umum') || jb.includes('tata usaha') || jb.includes('keuangan') || jb.includes('administrasi')) tg = 'Umum'
        else if (jb.includes('sumber daya') || jb.includes('sdm') || jb.includes('kepegawaian') || jb.includes('diklat')) tg = 'Sumber Daya'
        else if (jb.includes('operasi') || jb.includes('ops') || jb.includes('sar') || jb.includes('rescue')) tg = 'Operasi'
      }
      if (tg) {
        groups[tg].pegawai.push(p)
        if (!groups[tg].namaPimpinan && p.nama_pimpinan_langsung) {
          groups[tg].namaPimpinan = p.nama_pimpinan_langsung
          groups[tg].nipPimpinan = p.nip_pimpinan_langsung
        }
      }
    })

    const gm = JSON.parse(localStorage.getItem('absen_group_mapping') || '{}')
    Object.entries(gm).forEach(([pid, tg]) => {
      const id = parseInt(pid)
      let found = null, fg = null
      Object.keys(groups).forEach(gn => {
        const idx = groups[gn].pegawai.findIndex(p => p.id === id)
        if (idx !== -1) { found = groups[gn].pegawai[idx]; fg = gn }
      })
      if (found && fg && fg !== tg && groups[tg]) {
        groups[fg].pegawai = groups[fg].pegawai.filter(p => p.id !== id)
        groups[tg].pegawai.push(found)
      }
    })

    Object.keys(groups).forEach(key => {
      if (savedOrder?.[key]) {
        const ids = savedOrder[key]
        const ordered = [], rem = [...groups[key].pegawai]
        ids.forEach(id => { const i = rem.findIndex(p => p.id === id); if (i !== -1) ordered.push(rem.splice(i, 1)[0]) })
        ordered.push(...rem)
        groups[key].pegawai = ordered
      }
    })

    const final = {}
    BAGIAN_ORDER.forEach(k => { if (groups[k]?.pegawai.length > 0) final[k] = groups[k] })
    setGroupedPegawai(final)
  }

  const loadAbsen = async (tgl) => {
    try {
      const { data } = await supabase.from('absen').select('*').eq('tanggal', tgl)
      const map = {}
      if (data) data.forEach(a => { map[a.profile_id] = a.status_absen })
      setAbsenData(map)
    } catch { toast.error('Gagal memuat absen') }
  }

  const loadMonitor = async () => {
    setMonitorLoading(true)
    try {
      const { data } = await supabase.from('absen').select('*')
        .gte('tanggal', `${monitorMonth}-01`).lte('tanggal', `${monitorMonth}-31`)
      setMonitorData(data || [])
    } catch { toast.error('Gagal memuat monitoring') }
    finally { setMonitorLoading(false) }
  }

  // ── Handle Absen ──
  const handleAbsen = async (pid, status) => {
    const cur = absenData[pid]
    if (cur === status) {
      setAbsenData(p => { const u = { ...p }; delete u[pid]; return u })
      await supabase.from('absen').delete().eq('profile_id', pid).eq('tanggal', tanggal)
      return
    }
    setAbsenData(p => ({ ...p, [pid]: status }))
    try {
      if (cur) await supabase.from('absen').update({ status_absen: status }).eq('profile_id', pid).eq('tanggal', tanggal)
      else await supabase.from('absen').insert({ profile_id: pid, tanggal, status_absen: status })
    } catch {
      if (cur) setAbsenData(p => ({ ...p, [pid]: cur }))
      else setAbsenData(p => { const u = { ...p }; delete u[pid]; return u })
      toast.error('Gagal menyimpan')
    }
  }

  const handleSetAllHadir = async (members) => {
    setSaving(true)
    try {
      const belum = members.filter(p => !absenData[p.id])
      if (!belum.length) { toast('Semua sudah diabsen', { icon: 'ℹ️' }); return }
      const nd = { ...absenData }; belum.forEach(p => { nd[p.id] = 'Hadir' }); setAbsenData(nd)
      const { error } = await supabase.from('absen').insert(belum.map(p => ({ profile_id: p.id, tanggal, status_absen: 'Hadir' })))
      if (error) throw error
      toast.success(`${belum.length} pegawai diset Hadir`)
    } catch (e) { await loadAbsen(tanggal); toast.error('Gagal: ' + e.message) }
    finally { setSaving(false) }
  }

  const handleResetBagian = async (members) => {
    setSaving(true)
    try {
      const sudah = members.filter(p => absenData[p.id])
      if (!sudah.length) { toast('Tidak ada yang perlu direset', { icon: 'ℹ️' }); return }
      const nd = { ...absenData }; sudah.forEach(p => { delete nd[p.id] }); setAbsenData(nd)
      const { error } = await supabase.from('absen').delete().in('profile_id', sudah.map(p => p.id)).eq('tanggal', tanggal)
      if (error) throw error
      toast.success(`${sudah.length} absen direset`)
    } catch (e) { await loadAbsen(tanggal); toast.error('Gagal: ' + e.message) }
    finally { setSaving(false) }
  }

  // ══════════════════════════════════════════════════════
  // EXPORT HANDLER
  // ══════════════════════════════════════════════════════
  const handleExport = async () => {
    if (!exportFrom || !exportTo) return toast.error('Pilih rentang tanggal!')
    if (new Date(exportFrom) > new Date(exportTo)) return toast.error('Tanggal awal harus sebelum akhir!')

    setExporting(true)
    const tid = toast.loading('Menyiapkan ekspor...')

    try {
      const { data: absenExport, error } = await supabase.from('absen').select('*')
        .gte('tanggal', exportFrom).lte('tanggal', exportTo).order('tanggal')
      if (error) throw error

      const absenMap = {}
      ;(absenExport || []).forEach(a => {
        if (!absenMap[a.profile_id]) absenMap[a.profile_id] = {}
        absenMap[a.profile_id][a.tanggal] = a.status_absen
      })

      const dates = []
      const d = new Date(`${exportFrom}T00:00:00`)
      const end = new Date(`${exportTo}T00:00:00`)
      while (d <= end) { dates.push(toLocalDate(d)); d.setDate(d.getDate() + 1) }

      const workingDays = dates.filter(dt => {
        const day = new Date(`${dt}T00:00:00`).getDay()
        return day !== 0 && day !== 6
      }).length

      let ep = []
      if (exportBagian === 'semua') {
        BAGIAN_ORDER.forEach(n => {
          if (groupedPegawai[n]) groupedPegawai[n].pegawai.forEach(p => ep.push({ ...p, bagian: n }))
        })
      } else if (groupedPegawai[exportBagian]) {
        groupedPegawai[exportBagian].pegawai.forEach(p => ep.push({ ...p, bagian: exportBagian }))
      }

      if (!ep.length) { toast.error('Tidak ada pegawai', { id: tid }); setExporting(false); return }

      if (exportFormat === 'excel') await buildExcelFile(ep, absenMap, dates, workingDays)
      else buildCSVFile(ep, absenMap, dates)

      toast.success(`Berhasil ekspor ${ep.length} pegawai`, { id: tid })
      setShowExport(false)
    } catch (e) { toast.error('Gagal: ' + e.message, { id: tid }) }
    finally { setExporting(false) }
  }

  // ══════════════════════════════════════════════════════
  // BUILD EXCEL (.xlsx) — ExcelJS — FILE ASLI
  // ══════════════════════════════════════════════════════
  const buildExcelFile = async (pegawaiList, absenMap, dates, workingDays) => {
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Sistem Absensi'
    wb.created = new Date()

    const ws = wb.addWorksheet('Rekap Absensi', {
      pageSetup: {
        paperSize: 9,
        orientation: 'portrait',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
      },
      views: [{ showGridLines: false }],
    })

    // ── Column widths ──
    ws.columns = [
      { width: 5 },  { width: 5 },  { width: 34 }, { width: 22 },
      { width: 8 },  { width: 12 }, { width: 12 }, { width: 7 },
      { width: 7 },  { width: 7 },  { width: 7 },  { width: 12 },
      { width: 18 },
    ]

    const border = {
      top: { style: 'thin' }, left: { style: 'thin' },
      bottom: { style: 'thin' }, right: { style: 'thin' },
    }

    const yellowFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD700' } }
    const lightYellowFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }
    const titleFont = { name: 'Arial', bold: true }
    const dataFont = { name: 'Arial', size: 10 }
    const centerAlign = { horizontal: 'center', vertical: 'middle', wrapText: true }
    const leftAlign = { horizontal: 'left', vertical: 'middle' }

    const fromDate = new Date(`${exportFrom}T00:00:00`)
    const bulanNama = fromDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }).toUpperCase()

    // ✅ LOGO POSISI FIXED
    const logoBuffer = await fetchLogoBuffer()
    if (logoBuffer) {
      const imgId = wb.addImage({ buffer: logoBuffer, extension: 'png' })
      ws.addImage(imgId, {
        tl: { col: 5.9, row: 0.1 },
        ext: { width: 45, height: 45 },
      })
    }

    // ── Row 1-4: Title ──
    ws.mergeCells('A1:M1')
    ws.mergeCells('A2:M2')
    ws.mergeCells('A3:M3')
    ws.mergeCells('A4:M4')

    ws.getRow(1).height = 50 // row khusus logo saja

    const r2 = ws.getCell('A2'); r2.value = 'REKAP ABSEN APEL'
    r2.font = { ...titleFont, size: 14 }; r2.alignment = centerAlign

    const r3 = ws.getCell('A3'); r3.value = 'KANTOR PENCARIAN DAN PERTOLONGAN TARAKAN'
    r3.font = { ...titleFont, size: 11 }; r3.alignment = centerAlign

    const r4 = ws.getCell('A4'); r4.value = `BULAN ${bulanNama}`
    r4.font = { ...titleFont, size: 11 }; r4.alignment = centerAlign

    ws.getRow(2).height = 22
    ws.getRow(3).height = 18
    ws.getRow(4).height = 18
    ws.getRow(5).height = 8 // spacer

    // ── Row 6: Hari Kerja ──
    ws.mergeCells('A6:M6')
    const r6 = ws.getCell('A6')
    r6.value = `HARI KERJA : ${workingDays} HARI`
    r6.font = { ...titleFont, size: 10 }
    r6.fill = yellowFill
    r6.alignment = leftAlign
    r6.border = border
    ws.getRow(6).height = 20

    // ── Data per Bagian ──
    let row = 7
    let globalNo = 0
    const bagianList = exportBagian === 'semua' ? BAGIAN_ORDER : [exportBagian]
    const HEADERS = ['NO', 'NO', 'NAMA', 'NIP', 'HADIR', 'DINAS LUAR', 'DINAS\nDALAM', 'CUTI', 'SAKIT', 'ALPA', 'IZIN', 'LEPAS\nPIKET', 'TOTAL\nKEHADIRAN']

    bagianList.forEach(bagianName => {
      const members = pegawaiList.filter(p => p.bagian === bagianName)
      if (!members.length) return

      // Header row
      const hr = ws.getRow(row)
      HEADERS.forEach((h, i) => {
        const cell = hr.getCell(i + 1)
        cell.value = h
        cell.fill = yellowFill
        cell.font = { name: 'Arial', bold: true, size: 9 }
        cell.alignment = centerAlign
        cell.border = border
      })
      hr.height = 28
      row++

      // Data rows
      members.forEach((p, idx) => {
        globalNo++
        const sc = {}
        STATUS_LIST.forEach(s => { sc[s.id] = 0 })
        dates.forEach(dt => {
          const st = absenMap[p.id]?.[dt]
          if (st && sc[st] !== undefined) sc[st]++
        })
        const totalK = sc['Hadir'] + sc['Dinas Luar'] + sc['Dinas Dalam']

        const dr = ws.getRow(row)
        const vals = [
          globalNo, idx + 1, p.nama || '-', String(p.nip || ''),
          sc['Hadir'] || null, sc['Dinas Luar'] || null, sc['Dinas Dalam'] || null,
          sc['Cuti'] || null, sc['Sakit'] || null, sc['Alpa'] || null,
          sc['Izin'] || null, sc['Lepas Piket'] || null, totalK || null,
        ]

        vals.forEach((v, i) => {
          const cell = dr.getCell(i + 1)
          cell.value = v === null ? '' : v
          cell.font = dataFont
          cell.border = border
          cell.alignment = i === 2 ? leftAlign : centerAlign

          // NIP → force text format
          if (i === 3) cell.numFmt = '@'

          // Total column → light yellow
          if (i === 12 && v) {
            cell.fill = lightYellowFill
            cell.font = { ...dataFont, bold: true }
          }
        })

        dr.height = 18
        row++
      })
    })

    // ── Tanda Tangan ──
    row += 2
    ws.mergeCells(`I${row}:M${row}`)
    const s1 = ws.getCell(`I${row}`)
    s1.value = 'Mengetahui,'
    s1.alignment = centerAlign; s1.font = dataFont

    row++
    ws.mergeCells(`I${row}:M${row}`)
    const s2 = ws.getCell(`I${row}`)
    s2.value = penandatangan.jabatan || 'Kepala Urusan Umum'
    s2.alignment = centerAlign; s2.font = dataFont

    row += 4
    ws.mergeCells(`I${row}:M${row}`)
    const s3 = ws.getCell(`I${row}`)
    s3.value = penandatangan.nama || '.............................'
    s3.alignment = centerAlign
    s3.font = { ...dataFont, bold: true, underline: true }

    row++
    ws.mergeCells(`I${row}:M${row}`)
    const s4 = ws.getCell(`I${row}`)
    s4.value = penandatangan.pangkat || 'Penata Muda Tk.I (III/b)'
    s4.alignment = centerAlign
    s4.font = { name: 'Arial', size: 9 }

    if (penandatangan.nip) {
      row++
      ws.mergeCells(`I${row}:M${row}`)
      const s5 = ws.getCell(`I${row}`)
      s5.value = `NIP. ${penandatangan.nip}`
      s5.alignment = centerAlign
      s5.font = { name: 'Arial', size: 9 }
    }

    // ══════════════════════════════════
    // WRITE .xlsx ASLI
    // ══════════════════════════════════
    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    saveAs(blob, `Rekap_Absensi_${bulanNama.replace(/\s/g, '_')}.xlsx`)
  }

  // ══════════════════════════════════════════════════════
  // BUILD CSV
  // ══════════════════════════════════════════════════════
  const buildCSVFile = (pegawaiList, absenMap, dates) => {
    const sm = {}; STATUS_LIST.forEach(s => { sm[s.id] = s.short })
    const hdrs = ['No', 'Bagian', 'Nama', 'NIP', 'Jabatan', 'Gol']
    dates.forEach(dt => { const d = new Date(`${dt}T00:00:00`); hdrs.push(`${d.getDate()}/${d.getMonth() + 1}`) })
    STATUS_LIST.forEach(s => hdrs.push(`Total ${s.short}`))
    hdrs.push('Total')

    const rows = [hdrs]
    pegawaiList.forEach((p, idx) => {
      const r = [idx + 1, p.bagian, p.nama, p.nip, p.jabatan || '-', p.pangkat_gol_ruang || '-']
      const sc = {}; STATUS_LIST.forEach(s => { sc[s.id] = 0 })
      dates.forEach(dt => {
        const st = absenMap[p.id]?.[dt] || ''
        r.push(st ? (sm[st] || st) : '-')
        if (st && sc[st] !== undefined) sc[st]++
      })
      STATUS_LIST.forEach(s => r.push(sc[s.id]))
      r.push(Object.values(sc).reduce((a, b) => a + b, 0))
      rows.push(r)
    })

    const csv = rows.map(r => r.map(c => {
      const s = String(c)
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
    }).join(',')).join('\n')

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    saveAs(blob, `Rekap_Absensi_${exportFrom}_sd_${exportTo}.csv`)
  }

  // ── Monitor helpers ──
  const monitorMap = useMemo(() => {
    const m = {}
    monitorData.forEach(a => {
      if (!m[a.profile_id]) m[a.profile_id] = {}
      m[a.profile_id][a.status_absen] = (m[a.profile_id][a.status_absen] || 0) + 1
    })
    return m
  }, [monitorData])

  const getMonitorStats = useCallback(pid => {
    const s = {}; STATUS_LIST.forEach(st => { s[st.id] = 0 })
    if (monitorMap[pid]) Object.entries(monitorMap[pid]).forEach(([k, v]) => { if (s[k] !== undefined) s[k] = v })
    return s
  }, [monitorMap])

  const totalStats = useMemo(() => {
    const s = {}; STATUS_LIST.forEach(st => { s[st.id] = 0 })
    monitorData.forEach(a => { if (s[a.status_absen] !== undefined) s[a.status_absen]++ })
    return s
  }, [monitorData])

  const problematicCount = useMemo(() => {
    let c = 0
    pegawai.forEach(p => { const s = getMonitorStats(p.id); if (s.Alpa > 0 || s.Sakit > 2 || s.Izin > 3) c++ })
    return c
  }, [pegawai, getMonitorStats])

  // ── UI Helpers ──
  const filterMembers = m => {
    if (!searchPegawai) return m
    const q = searchPegawai.toLowerCase()
    return m.filter(p => (p.nama || '').toLowerCase().includes(q) || String(p.nip || '').includes(searchPegawai))
  }

  const orderedGroups = useMemo(() => BAGIAN_ORDER.filter(n => groupedPegawai[n]).map(n => groupedPegawai[n]), [groupedPegawai])
  const toggleCollapse = n => setCollapsedBagian(p => ({ ...p, [n]: !p[n] }))
  const goToPrevDay = () => { const d = new Date(`${tanggal}T00:00:00`); d.setDate(d.getDate() - 1); setTanggal(toLocalDate(d)) }
  const goToNextDay = () => { const d = new Date(`${tanggal}T00:00:00`); d.setDate(d.getDate() + 1); setTanggal(toLocalDate(d)) }
  const goToToday = () => setTanggal(toLocalDate())

  const totalPegawai = pegawai.length
  const totalSudahAbsen = Object.keys(absenData).length
  const totalBelumAbsen = totalPegawai - totalSudahAbsen

  const inputSummary = useMemo(() => {
    const s = {}; STATUS_LIST.forEach(st => { s[st.id] = 0 })
    Object.values(absenData).forEach(v => { if (s[v] !== undefined) s[v]++ })
    return s
  }, [absenData])

  const setExportPreset = preset => {
    const now = new Date()
    switch (preset) {
      case 'thisMonth': { const f = new Date(now.getFullYear(), now.getMonth(), 1); const l = new Date(now.getFullYear(), now.getMonth() + 1, 0); setExportFrom(toLocalDate(f)); setExportTo(toLocalDate(l)); break }
      case 'lastMonth': { const f = new Date(now.getFullYear(), now.getMonth() - 1, 1); const l = new Date(now.getFullYear(), now.getMonth(), 0); setExportFrom(toLocalDate(f)); setExportTo(toLocalDate(l)); break }
      case 'thisWeek': { const day = now.getDay(); const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1)); setExportFrom(toLocalDate(mon)); setExportTo(toLocalDate(now)); break }
      case 'last7': { const f = new Date(now); f.setDate(now.getDate() - 6); setExportFrom(toLocalDate(f)); setExportTo(toLocalDate(now)); break }
      case 'last30': { const f = new Date(now); f.setDate(now.getDate() - 29); setExportFrom(toLocalDate(f)); setExportTo(toLocalDate(now)); break }
      default: break
    }
  }

  // ══════════════════════════════════════════════════════
  // RENDER BAGIAN TABLE
  // ══════════════════════════════════════════════════════
  const renderBagianTable = group => {
    const members = editMode ? group.pegawai : filterMembers(group.pegawai)
    if (!members.length) return null
    const style = BAGIAN_COLORS[group.nama] || { gradient: 'from-gray-500 to-gray-700' }
    const isCollapsed = collapsedBagian[group.nama]
    const isInput = activeTab === 'input'
    const hasCustom = customOrder[group.nama]?.length > 0

    const summary = {}; STATUS_LIST.forEach(s => { summary[s.id] = 0 })
    if (!editMode) {
      if (isInput) members.forEach(p => { const st = absenData[p.id]; if (st && summary[st] !== undefined) summary[st]++ })
      else members.forEach(p => { const st = getMonitorStats(p.id); STATUS_LIST.forEach(s => { summary[s.id] += st[s.id] }) })
    }
    const belumAbsen = isInput && !editMode ? members.filter(p => !absenData[p.id]).length : 0
    const sudahAbsen = members.length - belumAbsen

    return (
      <div key={group.nama} className="bg-white rounded-xl shadow-sm border mb-4 overflow-hidden">
        <div className={`bg-gradient-to-r ${style.gradient} px-4 py-3 cursor-pointer select-none`} onClick={() => toggleCollapse(group.nama)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">{group.nama[0]}</span>
              </div>
              <div>
                <h3 className="text-white font-bold text-sm flex items-center gap-2">{group.nama}{hasCustom && <span className="bg-white/20 text-[10px] px-1.5 py-0.5 rounded font-normal">Custom</span>}</h3>
                {group.namaPimpinan && <p className="text-white/60 text-[11px]">{group.namaPimpinan}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!editMode && <div className="hidden md:flex items-center gap-1">
                {STATUS_LIST.map(s => summary[s.id] === 0 ? null : <span key={s.id} className="bg-white/20 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">{s.short}:{summary[s.id]}</span>)}
                {isInput && belumAbsen > 0 && <span className="bg-yellow-400/30 text-yellow-100 text-[10px] px-1.5 py-0.5 rounded font-medium">?:{belumAbsen}</span>}
              </div>}
              <span className="bg-white/20 text-white text-xs px-2.5 py-1 rounded-lg font-medium">{members.length}</span>
              <svg className={`w-4 h-4 text-white/70 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
            </div>
          </div>
        </div>

        {!isCollapsed && <>
          {isInput && !editMode && (
            <div className="px-4 py-2 bg-gray-50 border-b flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <button onClick={() => handleSetAllHadir(members)} disabled={saving || belumAbsen === 0} className="bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1">
                  {saving ? <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>}
                  Set Semua Hadir
                </button>
                <button onClick={() => handleResetBagian(members)} disabled={saving || sudahAbsen === 0} className="bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-600 disabled:text-gray-400 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">Reset</button>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full transition-all duration-500" style={{ width: `${members.length > 0 ? (sudahAbsen / members.length) * 100 : 0}%` }} /></div>
                <span className="text-gray-500 font-medium">{sudahAbsen}/{members.length}</span>
              </div>
            </div>
          )}

          {editMode && (
            <div className="px-4 py-2 bg-blue-50 border-b flex items-center justify-between">
              <p className="text-xs text-blue-600">Geser ▲▼ atau pindah grup</p>
              {hasCustom && <button onClick={() => resetOrder(group.nama)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Reset Grup</button>}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80 border-b">
                  {editMode && <th className="w-28 px-2 py-2 text-[11px] font-semibold text-gray-400 text-center">ATUR</th>}
                  <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-400 w-8">#</th>
                  <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-400 min-w-[150px]">PEGAWAI</th>
                  <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-400 min-w-[120px]">JABATAN</th>
                  <th className="text-center px-2 py-2 text-[11px] font-semibold text-gray-400 w-12">KLS</th>
                  <th className="text-center px-2 py-2 text-[11px] font-semibold text-gray-400 w-14">GOL</th>
                  {!editMode && STATUS_LIST.map(s => <th key={s.id} className="text-center px-0.5 py-2 w-8"><div className={`w-6 h-6 ${s.color} rounded text-white text-[9px] flex items-center justify-center font-bold mx-auto`} title={s.label}>{s.short}</div></th>)}
                  {!editMode && !isInput && <th className="text-center px-2 py-2 text-[11px] font-semibold text-gray-400 w-10">Σ</th>}
                </tr>
              </thead>
              <tbody>
                {members.map((p, idx) => {
                  const stats = !isInput && !editMode ? getMonitorStats(p.id) : null
                  const total = stats ? Object.values(stats).reduce((a, b) => a + b, 0) : 0
                  const hasIssue = stats ? (stats.Alpa > 0 || stats.Sakit > 2 || stats.Izin > 3) : false
                  const belum = isInput && !editMode && !absenData[p.id]
                  const curSt = absenData[p.id]

                  return (
                    <tr key={p.id} className={`border-b border-gray-50 transition-colors ${editMode ? 'hover:bg-blue-50/50' : hasIssue ? 'bg-red-50/50 hover:bg-red-50' : belum ? 'hover:bg-yellow-50/50' : 'hover:bg-gray-50/50'}`}>
                      {editMode && <td className="px-2 py-1.5">
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-0.5">
                            <button onClick={() => moveToTop(group.nama, idx)} disabled={idx === 0} className="w-5 h-5 rounded bg-gray-100 hover:bg-gray-200 text-gray-500 text-[9px] disabled:opacity-20" title="Ke atas">⏫</button>
                            <button onClick={() => movePegawai(group.nama, idx, 'up')} disabled={idx === 0} className="w-5 h-5 rounded bg-blue-50 hover:bg-blue-100 text-blue-500 text-[10px] disabled:opacity-20">▲</button>
                            <button onClick={() => movePegawai(group.nama, idx, 'down')} disabled={idx === members.length - 1} className="w-5 h-5 rounded bg-blue-50 hover:bg-blue-100 text-blue-500 text-[10px] disabled:opacity-20">▼</button>
                            <button onClick={() => moveToBottom(group.nama, idx)} disabled={idx === members.length - 1} className="w-5 h-5 rounded bg-gray-100 hover:bg-gray-200 text-gray-500 text-[9px] disabled:opacity-20" title="Ke bawah">⏬</button>
                          </div>
                          <select value="" onChange={e => { if (e.target.value) movePegawaiToGroup(group.nama, idx, e.target.value) }} className="w-full text-[9px] px-1 py-0.5 border rounded bg-white text-gray-500">
                            <option value="">Pindah...</option>
                            {BAGIAN_ORDER.filter(b => b !== group.nama).map(b => <option key={b} value={b}>→ {b}</option>)}
                          </select>
                        </div>
                      </td>}
                      <td className="px-3 py-2 text-xs text-gray-300 font-medium">{idx + 1}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          {!editMode && hasIssue && <span className="text-red-400 text-xs shrink-0">⚠</span>}
                          <div className="min-w-0">
                            <p className={`text-sm font-medium truncate max-w-[150px] ${belum ? 'text-gray-400' : 'text-gray-800'}`}>{p.nama}</p>
                            <p className="text-[10px] text-gray-300 font-mono">{p.nip}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2"><p className="text-xs text-gray-400 truncate max-w-[120px]" title={p.jabatan}>{p.jabatan || '-'}</p></td>
                      <td className="text-center px-2 py-2">{p.kelas_jabatan ? <span className="text-[11px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">{p.kelas_jabatan}</span> : <span className="text-gray-200">-</span>}</td>
                      <td className="text-center px-2 py-2"><span className="text-[10px] text-gray-400">{p.pangkat_gol_ruang || '-'}</span></td>
                      {!editMode && STATUS_LIST.map(s => <td key={s.id} className="text-center px-0.5 py-1.5">
                        {isInput ? (
                          <button onClick={() => handleAbsen(p.id, s.id)} className={`w-6 h-6 rounded transition-all duration-150 ${curSt === s.id ? `${s.color} text-white shadow-sm ring-2 ${s.ring} scale-110` : 'bg-gray-100 hover:bg-gray-200 text-transparent hover:scale-105'}`} title={`${p.nama}: ${s.label}`}>
                            <span className="text-[9px] font-bold">{curSt === s.id ? '✓' : ''}</span>
                          </button>
                        ) : (
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold ${stats[s.id] > 0 ? `${s.color} text-white` : 'text-gray-200'}`}>{stats[s.id] || '-'}</span>
                        )}
                      </td>)}
                      {!editMode && !isInput && <td className="text-center px-2 py-2"><span className="inline-flex items-center justify-center w-7 h-6 rounded bg-gray-100 text-[10px] font-bold text-gray-600">{total}</span></td>}
                    </tr>
                  )
                })}
              </tbody>
              {!editMode && <tfoot>
                <tr className="bg-gray-50 border-t">
                  <td colSpan={6} className="px-3 py-2 text-[11px] font-semibold text-gray-400 text-right">TOTAL</td>
                  {STATUS_LIST.map(s => <td key={s.id} className="text-center px-0.5 py-2"><span className={`inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold ${summary[s.id] > 0 ? `${s.color} text-white` : 'text-gray-200 bg-gray-100'}`}>{summary[s.id] || '-'}</span></td>)}
                  {!isInput && <td className="text-center px-2 py-2"><span className="inline-flex items-center justify-center w-7 h-6 rounded bg-gray-200 text-[10px] font-bold text-gray-600">{Object.values(summary).reduce((a, b) => a + b, 0)}</span></td>}
                </tr>
              </tfoot>}
            </table>
          </div>
        </>}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════
  // LOADING STATE
  // ══════════════════════════════════════════════════════
  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="animate-spin h-10 w-10 border-t-4 border-orange-500 rounded-full mb-4" />
      <p className="text-gray-400 text-sm">Memuat data...</p>
    </div>
  )

  // ══════════════════════════════════════════════════════
  // MAIN RENDER
  // ══════════════════════════════════════════════════════
  return (
    <div>
      {/* HEADER */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <svg className="w-7 h-7 text-orange-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" /></svg>
            Absensi Pegawai
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">Kelola absensi harian & monitoring bulanan</p>
        </div>
        <button onClick={() => setShowExport(true)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
          Ekspor Rekap
        </button>
      </div>

      {/* TABS */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6">
        {[{ id: 'input', label: 'Input Absen', icon: '✏️' }, { id: 'monitor', label: 'Monitoring', icon: '📊' }].map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setEditMode(false) }} className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
            <span className="flex items-center justify-center gap-1.5"><span>{tab.icon}</span><span>{tab.label}</span></span>
          </button>
        ))}
      </div>

      {/* EDIT MODE BANNER */}
      {editMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-bold text-blue-800 text-sm">Mode Edit Urutan</h3>
              <p className="text-blue-500 text-xs mt-0.5">Geser ▲▼ atau pilih "Pindah..." untuk pindah grup</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={resetAllOrder} className="bg-white hover:bg-gray-50 text-gray-600 border px-3 py-1.5 rounded-lg text-xs font-medium">Reset Semua</button>
              <button onClick={() => { saveCustomOrder(customOrder); setEditMode(false) }} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-1.5 rounded-lg text-xs font-medium">Simpan</button>
              <button onClick={() => { setEditMode(false); loadPegawai() }} className="bg-white hover:bg-red-50 text-red-500 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-medium">Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* INPUT TAB */}
      {activeTab === 'input' && (
        <div>
          <div className="bg-white rounded-xl shadow-sm border p-4 mb-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center bg-gray-50 rounded-lg border">
                <button onClick={goToPrevDay} className="px-2.5 py-2 hover:bg-gray-100 rounded-l-lg text-gray-500 text-sm"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg></button>
                <input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className="px-3 py-2 bg-transparent text-sm focus:outline-none font-medium text-gray-700 w-[140px]" />
                <button onClick={goToNextDay} className="px-2.5 py-2 hover:bg-gray-100 rounded-r-lg text-gray-500 text-sm"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg></button>
              </div>
              <button onClick={goToToday} className="bg-orange-50 text-orange-600 border border-orange-200 px-3 py-2 rounded-lg text-xs font-medium hover:bg-orange-100">Hari Ini</button>
              {!editMode && <>
                <div className="flex-1 min-w-[180px] relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
                  <input type="text" value={searchPegawai} onChange={e => setSearchPegawai(e.target.value)} placeholder="Cari pegawai..." className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
                  {searchPegawai && <button onClick={() => setSearchPegawai('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>}
                </div>
                <button onClick={() => setEditMode(true)} className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
                  Atur Urutan
                </button>
              </>}
            </div>
            {!editMode && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t">
                <p className="text-sm text-gray-600">{new Date(`${tanggal}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                <div className="flex items-center gap-3 text-xs font-medium">
                  <span className="text-green-600">{totalSudahAbsen} sudah</span><span className="text-gray-300">•</span>
                  <span className="text-yellow-600">{totalBelumAbsen} belum</span><span className="text-gray-300">•</span>
                  <span className="text-gray-400">{totalPegawai} total</span>
                </div>
              </div>
            )}
          </div>

          {!editMode && (
            <div className="grid grid-cols-4 md:grid-cols-8 gap-2 mb-5">
              {STATUS_LIST.map(s => (
                <div key={s.id} className="bg-white rounded-lg shadow-sm border p-2.5 text-center">
                  <div className={`w-6 h-6 ${s.color} rounded text-white text-[9px] flex items-center justify-center font-bold mx-auto mb-1.5`}>{s.short}</div>
                  <p className="text-lg font-bold text-gray-800 leading-none">{inputSummary[s.id]}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5 truncate">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {orderedGroups.map(g => renderBagianTable(g))}
        </div>
      )}

      {/* MONITOR TAB */}
      {activeTab === 'monitor' && (
        <div>
          <div className="bg-white rounded-xl shadow-sm border p-4 mb-5">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-500">Bulan</label>
                <input type="month" value={monitorMonth} onChange={e => setMonitorMonth(e.target.value)} className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-500">Grup</label>
                <select value={filterBagian} onChange={e => setFilterBagian(e.target.value)} className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500">
                  <option value="semua">Semua</option>
                  {orderedGroups.map(g => <option key={g.nama} value={g.nama}>{g.nama}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-500">Filter</label>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500">
                  <option value="semua">Semua</option>
                  <option value="bermasalah">⚠️ Bermasalah</option>
                  {STATUS_LIST.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-4 mt-3 pt-3 border-t text-xs text-gray-400 font-medium">
              <span>{new Date(`${monitorMonth}-01T00:00:00`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</span>
              <span>{pegawai.length} pegawai</span><span>{monitorData.length} data</span>
              {problematicCount > 0 && <span className="text-red-500">⚠ {problematicCount} bermasalah</span>}
            </div>
          </div>

          <div className="grid grid-cols-4 md:grid-cols-8 gap-2 mb-5">
            {STATUS_LIST.map(s => (
              <div key={s.id} className="bg-white rounded-lg shadow-sm border p-2.5 text-center">
                <div className={`w-6 h-6 ${s.color} rounded text-white text-[9px] flex items-center justify-center font-bold mx-auto mb-1.5`}>{s.short}</div>
                <p className="text-lg font-bold text-gray-800 leading-none">{totalStats[s.id]}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 truncate">{s.label}</p>
              </div>
            ))}
          </div>

          {monitorLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="animate-spin h-10 w-10 border-t-4 border-orange-500 rounded-full mb-4" />
              <p className="text-gray-400 text-sm">Memuat monitoring...</p>
            </div>
          ) : orderedGroups.filter(g => filterBagian === 'semua' || g.nama === filterBagian).map(group => {
            let fg = group
            if (filterStatus !== 'semua') {
              const fm = group.pegawai.filter(p => {
                const s = getMonitorStats(p.id)
                if (filterStatus === 'bermasalah') return s.Alpa > 0 || s.Sakit > 2 || s.Izin > 3
                return s[filterStatus] > 0
              })
              if (!fm.length) return null
              fg = { ...group, pegawai: fm }
            }
            return renderBagianTable(fg)
          })}
        </div>
      )}

      {/* EXPORT MODAL */}
      {showExport && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl animate-modal overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Ekspor Rekap Absensi</h3>
                    <p className="text-emerald-100 text-xs">File .xlsx asli Microsoft Excel</p>
                  </div>
                </div>
                <button onClick={() => setShowExport(false)} className="text-white/70 hover:text-white"><svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {/* Presets */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Preset Cepat</label>
                <div className="flex flex-wrap gap-1.5">
                  {[{ id: 'thisMonth', label: 'Bulan Ini' }, { id: 'lastMonth', label: 'Bulan Lalu' }, { id: 'thisWeek', label: 'Minggu Ini' }, { id: 'last7', label: '7 Hari' }, { id: 'last30', label: '30 Hari' }].map(p => (
                    <button key={p.id} onClick={() => setExportPreset(p.id)} className="px-3 py-1.5 bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 text-gray-600 rounded-lg text-xs font-medium border hover:border-emerald-200">{p.label}</button>
                  ))}
                </div>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Dari Tanggal</label>
                  <input type="date" value={exportFrom} onChange={e => setExportFrom(e.target.value)} className="w-full px-3 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Sampai Tanggal</label>
                  <input type="date" value={exportTo} onChange={e => setExportTo(e.target.value)} className="w-full px-3 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
              </div>

              {exportFrom && exportTo && new Date(exportFrom) <= new Date(exportTo) && (
                <div className="bg-emerald-50 rounded-xl px-4 py-2.5 flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
                  <span className="text-xs text-emerald-700 font-medium">
                    {Math.ceil((new Date(exportTo) - new Date(exportFrom)) / 86400000) + 1} hari
                  </span>
                </div>
              )}

              {/* Bagian */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Grup / Bagian</label>
                <select value={exportBagian} onChange={e => setExportBagian(e.target.value)} className="w-full px-3 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="semua">Semua Bagian</option>
                  {orderedGroups.map(g => <option key={g.nama} value={g.nama}>{g.nama} ({g.pegawai.length})</option>)}
                </select>
              </div>

              {/* Format */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Format File</label>
                <div className="grid grid-cols-2 gap-2">
                  {[{ id: 'excel', ext: '.xlsx', label: 'Excel', desc: 'Microsoft Excel asli' }, { id: 'csv', ext: '.csv', label: 'CSV', desc: 'Universal, ringan' }].map(f => (
                    <button key={f.id} onClick={() => setExportFormat(f.id)} className={`p-3 rounded-xl border-2 text-left transition-all ${exportFormat === f.id ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${exportFormat === f.id ? 'bg-emerald-500' : 'bg-gray-200'}`}><span className="text-white text-xs font-bold">{f.ext}</span></div>
                        <div>
                          <p className={`text-sm font-semibold ${exportFormat === f.id ? 'text-emerald-700' : 'text-gray-600'}`}>{f.label}</p>
                          <p className="text-[10px] text-gray-400">{f.desc}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Penandatangan */}
              {exportFormat === 'excel' && (
                <div className="border rounded-xl p-4 bg-gray-50">
                  <label className="block text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">✍️ Penandatangan Dokumen</label>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] text-gray-400 mb-1">Nama</label>
                      <input type="text" value={penandatangan.nama} onChange={e => savePenandatangan({ ...penandatangan, nama: e.target.value })} placeholder="Contoh: Mukhtar, S.Sos." className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-gray-400 mb-1">Jabatan</label>
                        <input type="text" value={penandatangan.jabatan} onChange={e => savePenandatangan({ ...penandatangan, jabatan: e.target.value })} placeholder="Kepala Urusan Umum" className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                      </div>
                      <div>
                        <label className="block text-[11px] text-gray-400 mb-1">Pangkat/Gol</label>
                        <input type="text" value={penandatangan.pangkat} onChange={e => savePenandatangan({ ...penandatangan, pangkat: e.target.value })} placeholder="Penata Muda Tk.I (III/b)" className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-400 mb-1">NIP (opsional)</label>
                      <input type="text" value={penandatangan.nip} onChange={e => savePenandatangan({ ...penandatangan, nip: e.target.value })} placeholder="19xxxxxxxxxx" className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button onClick={handleExport} disabled={exporting || !exportFrom || !exportTo} className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:from-gray-300 disabled:to-gray-400 text-white py-3 rounded-xl font-medium text-sm shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2">
                  {exporting ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Mengekspor...</> : <><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>Download {exportFormat === 'excel' ? 'Excel' : 'CSV'}</>}
                </button>
                <button onClick={() => setShowExport(false)} className="px-6 bg-gray-100 hover:bg-gray-200 text-gray-600 py-3 rounded-xl font-medium text-sm">Batal</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes modal { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .animate-modal { animation: modal 0.2s ease-out; }
      `}</style>
    </div>
  )
}

export default AdminAbsenPage