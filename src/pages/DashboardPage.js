import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState({
    total_pegawai: 0,
    total_folder: 0,
    total_berkas: 0,
    absen_hari_ini: 0
  })
  const [recentBerkas, setRecentBerkas] = useState([])
  const [recentPegawai, setRecentPegawai] = useState([])
  const [jam, setJam] = useState(new Date())
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setJam(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        // Statistik
        const { data: statData, error: statError } = await supabase
          .from('v_statistik')
          .select('*')
          .single()

        if (!statError && statData) {
          setStats(statData)
        }

        // Berkas terbaru
        const { data: berkasData, error: berkasError } = await supabase
          .from('berkas')
          .select(`
            id,
            nama_berkas,
            created_at,
            folder:folder_id(nama_folder),
            profile:profile_id(nama)
          `)
          .order('created_at', { ascending: false })
          .limit(5)

        if (!berkasError && berkasData) {
          setRecentBerkas(berkasData)
        }

        // Pegawai terbaru
        const { data: pegawaiData, error: pegawaiError } = await supabase
          .from('profile')
          .select('id, nama, nip, jabatan, created_at')
          .order('created_at', { ascending: false })
          .limit(5)

        if (!pegawaiError && pegawaiData) {
          setRecentPegawai(pegawaiData)
        }
      } catch (err) {
        console.error('Dashboard load error:', err)
      } finally {
        setLoaded(true)
      }
    }

    load()
  }, [])

  const tanggal = jam.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const waktu = jam.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  const getGreeting = () => {
    const h = jam.getHours()
    if (h < 10) return 'Selamat Pagi'
    if (h < 15) return 'Selamat Siang'
    if (h < 18) return 'Selamat Sore'
    return 'Selamat Malam'
  }

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return '-'

    const now = new Date()
    const date = new Date(dateStr)
    const diff = Math.floor((now - date) / 1000)

    if (diff < 60) return 'Baru saja'
    if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`
    if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`
    if (diff < 604800) return `${Math.floor(diff / 86400)} hari lalu`

    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  const cards = [
    {
      label: 'Total Pegawai',
      value: stats.total_pegawai,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      ),
      bg: 'from-blue-500 to-blue-600',
      lightBg: 'bg-blue-50',
      textColor: 'text-blue-600',
      ringColor: 'ring-blue-500/20',
      desc: 'Pegawai terdaftar',
    },
    {
      label: 'Total Folder',
      value: stats.total_folder,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
        </svg>
      ),
      bg: 'from-emerald-500 to-emerald-600',
      lightBg: 'bg-emerald-50',
      textColor: 'text-emerald-600',
      ringColor: 'ring-emerald-500/20',
      desc: 'Folder arsip aktif',
    },
    {
      label: 'Total Berkas',
      value: stats.total_berkas,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      ),
      bg: 'from-violet-500 to-violet-600',
      lightBg: 'bg-violet-50',
      textColor: 'text-violet-600',
      ringColor: 'ring-violet-500/20',
      desc: 'Dokumen terunggah',
    },
    {
      label: 'Absen Hari Ini',
      value: stats.absen_hari_ini,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      bg: 'from-orange-500 to-red-500',
      lightBg: 'bg-orange-50',
      textColor: 'text-orange-600',
      ringColor: 'ring-orange-500/20',
      desc: 'Kehadiran tercatat',
    },
  ]

  const persenAbsen = stats.total_pegawai > 0
    ? Math.round((stats.absen_hari_ini / stats.total_pegawai) * 100)
    : 0

  return (
    <div className="space-y-6 pb-8">

      {/* ===== WELCOME BANNER ===== */}
      <div className="relative overflow-hidden bg-gradient-to-r from-orange-500 via-red-500 to-orange-600 rounded-2xl shadow-lg">
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100" height="100" fill="url(#grid)" />
          </svg>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl" />

        <div className="relative px-6 py-8 sm:px-8 sm:py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center ring-2 ring-white/30 flex-shrink-0">
              <svg className="w-8 h-8 sm:w-10 sm:h-10 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <div>
              <p className="text-white/80 text-sm font-medium">{getGreeting()} 👋</p>
              <h1 className="text-white text-2xl sm:text-3xl font-bold mt-0.5">
                {user?.nickname?.split('@')[0] || 'Administrator'}
              </h1>
              <p className="text-white/70 text-sm mt-1">
                Kantor SAR Tarakan — Badan SAR Nasional
              </p>
            </div>
          </div>

          <div className="bg-white/15 backdrop-blur-sm rounded-xl px-5 py-3 text-right ring-1 ring-white/20 self-end sm:self-auto">
            <p className="text-white text-2xl sm:text-3xl font-bold font-mono tracking-wider">{waktu}</p>
            <p className="text-white/70 text-xs sm:text-sm mt-0.5">{tanggal}</p>
          </div>
        </div>
      </div>

      {/* ===== STAT CARDS ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c, i) => (
          <div
            key={i}
            className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-all duration-300 hover:-translate-y-1 ring-1 ${c.ringColor} ${
              loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
            style={{ transitionDelay: `${i * 100}ms` }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${c.bg} flex items-center justify-center text-white shadow-lg`}>
                {c.icon}
              </div>
              <div className="flex items-end gap-0.5 h-8">
                {[40, 65, 45, 80, 55, 70, 90].map((h, j) => (
                  <div key={j} className={`w-1 rounded-full ${c.lightBg}`} style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
            <p className="text-3xl sm:text-4xl font-extrabold text-gray-800">{c.value}</p>
            <p className="text-sm font-semibold text-gray-700 mt-1">{c.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{c.desc}</p>
          </div>
        ))}
      </div>

      {/* ===== ROW: KEHADIRAN + BERKAS TERBARU ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
              </svg>
              Kehadiran Hari Ini
            </h3>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              persenAbsen >= 80 ? 'bg-green-100 text-green-700' :
              persenAbsen >= 50 ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              {persenAbsen}%
            </span>
          </div>

          <div className="flex items-center justify-center mb-6">
            <div className="relative w-40 h-40">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="#f3f4f6" strokeWidth="10" />
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke="url(#gradient)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${persenAbsen * 3.14} 314`}
                  className="transition-all duration-1000 ease-out"
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f97316" />
                    <stop offset="100%" stopColor="#ef4444" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-extrabold text-gray-800">{stats.absen_hari_ini}</span>
                <span className="text-xs text-gray-400">dari {stats.total_pegawai}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-green-600">{stats.absen_hari_ini}</p>
              <p className="text-xs text-green-500 mt-0.5">Hadir</p>
            </div>
            <div className="bg-red-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-red-600">{stats.total_pegawai - stats.absen_hari_ini}</p>
              <p className="text-xs text-red-500 mt-0.5">Belum Absen</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <svg className="w-5 h-5 text-violet-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              Berkas Terbaru
            </h3>
            <span className="text-xs text-gray-400">5 terakhir</span>
          </div>

          {recentBerkas.length > 0 ? (
            <div className="space-y-3">
              {recentBerkas.map((b, i) => (
                <div
                  key={b.id}
                  className={`flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition group ${
                    loaded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
                  }`}
                  style={{ transitionDelay: `${(i + 4) * 100}ms`, transitionDuration: '500ms' }}
                >
                  <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-200 transition">
                    <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9.75m3 0H9.75m0 0v-3.75m12-3a9 9 0 10-18 0 9 9 0 0018 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{b.nama_berkas}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {b.profile?.nama || '-'} · {b.folder?.nama_folder || '-'}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0 hidden sm:block">
                    {formatTimeAgo(b.created_at)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-300">
              <svg className="w-16 h-16 mb-3" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9.75m3 0H9.75m0 0v-3.75m12-3a9 9 0 10-18 0 9 9 0 0018 0z" />
              </svg>
              <p className="text-sm">Belum ada berkas</p>
            </div>
          )}
        </div>
      </div>

      {/* ===== ROW: PEGAWAI TERBARU + INFO ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
              </svg>
              Pegawai Terbaru
            </h3>
            <span className="text-xs text-gray-400">5 terakhir</span>
          </div>

          {recentPegawai.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nama</th>
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">NIP</th>
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Jabatan</th>
                    <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Waktu</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPegawai.map((p, i) => (
                    <tr
                      key={p.id}
                      className={`border-b border-gray-50 hover:bg-blue-50/50 transition ${
                        loaded ? 'opacity-100' : 'opacity-0'
                      }`}
                      style={{ transitionDelay: `${(i + 6) * 100}ms`, transitionDuration: '500ms' }}
                    >
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {p.nama?.charAt(0)?.toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-800 truncate max-w-[150px]">{p.nama}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-gray-500 font-mono text-xs hidden sm:table-cell">{p.nip || '-'}</td>
                      <td className="py-3 px-3 hidden md:table-cell">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md">{p.jabatan || '-'}</span>
                      </td>
                      <td className="py-3 px-3 text-right text-xs text-gray-400">{formatTimeAgo(p.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-300">
              <svg className="w-16 h-16 mb-3" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
              <p className="text-sm">Belum ada pegawai</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
              Ringkasan
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Pegawai', val: stats.total_pegawai, max: 100, color: 'bg-blue-500' },
                { label: 'Folder', val: stats.total_folder, max: stats.total_folder + 20, color: 'bg-emerald-500' },
                { label: 'Berkas', val: stats.total_berkas, max: stats.total_berkas + 50, color: 'bg-violet-500' },
              ].map((item, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-gray-600">{item.label}</span>
                    <span className="text-gray-400">{item.val}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.color} rounded-full transition-all duration-1000 ease-out`}
                      style={{ width: loaded ? `${Math.min((item.val / item.max) * 100, 100)}%` : '0%' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl shadow-lg p-6 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-16 h-16 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />

            <div className="relative">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
                </svg>
              </div>
              <h3 className="font-bold text-lg">Kantor SAR Tarakan</h3>
              <p className="text-white/80 text-sm mt-1">Badan SAR Nasional</p>
              <div className="mt-4 space-y-2 text-sm text-white/70">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                  </svg>
                  <span>0551 5680080</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                  <span>basarnastrk@gmail.com</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div> 
    </div>
  )
}

export default DashboardPage