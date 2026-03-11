import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function DashboardPage() {
  const [stats, setStats] = useState({ total_pegawai: 0, total_folder: 0, total_berkas: 0, absen_hari_ini: 0 })

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('v_statistik').select('*').single()
      if (data) setStats(data)
    }
    load()
  }, [])

  const cards = [
    { label: 'Total Pegawai', value: stats.total_pegawai, icon: '👥', color: 'bg-blue-50 text-blue-600' },
    { label: 'Total Folder', value: stats.total_folder, icon: '📁', color: 'bg-green-50 text-green-600' },
    { label: 'Total Berkas', value: stats.total_berkas, icon: '📄', color: 'bg-purple-50 text-purple-600' },
    { label: 'Absen Hari Ini', value: stats.absen_hari_ini, icon: '📋', color: 'bg-orange-50 text-orange-600' }
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-500">Selamat datang di Sistem Arsip Pegawai BASARNAS</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((c, i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">{c.label}</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{c.value}</p>
              </div>
              <div className={`w-12 h-12 ${c.color} rounded-xl flex items-center justify-center text-xl`}>
                {c.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-xl shadow-lg p-8 text-white">
        <h2 className="text-xl font-bold mb-2">Sistem Arsip Pegawai BASARNAS</h2>
        <p className="text-orange-100 text-sm">Kelola data pegawai, folder, dan berkas dokumen dengan mudah.</p>
      </div>
    </div>
  )
}

export default DashboardPage