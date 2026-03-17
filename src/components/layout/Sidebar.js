import React from 'react'
import { useAuth } from '../../context/AuthContext'

function Sidebar({ activePage, onNavigate }) {
  const { user, isAdmin, isUser, isPimpinan, isPejabat, canAbsen, logout, levelName } = useAuth()

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', show: !isUser },
    {
      id: 'pegawai',
      label: isUser ? 'Data Saya' : isAdmin ? 'Kelola Pegawai' : isPejabat ? 'Data Anak Buah' : 'Data Pegawai',
      icon: isUser ? '👤' : '👥',
      show: true
    },
    { id: 'absen', label: 'Absensi', icon: '📋', show: canAbsen },
    // TAMBAHKAN INI:
    { id: 'settings', label: 'Pengaturan', icon: '⚙️', show: true }
  ]

  const levelColor = {
    'Admin': 'bg-red-500',
    'Pimpinan': 'bg-blue-500',
    'Pejabat': 'bg-green-500',
    'User': 'bg-gray-500'
  }

  const hakAkses = {
    'Admin': [
      '✅ Full akses (kelola semua data)',
      '✅ Upload berkas ke Google Drive',
      '✅ Input absen pegawai'
    ],
    'Pimpinan': [
      '👁️ Lihat semua pegawai',
      '⬇️ Download berkas',
      '❌ Tidak bisa edit/upload'
    ],
    'Pejabat': [
      '👁️ Lihat anak buah langsung',
      '⬇️ Download berkas',
      '❌ Tidak bisa edit/upload'
    ],
    'User': [
      '👤 Lihat data sendiri',
      '⬇️ Download berkas sendiri',
      '❌ Tidak bisa edit/upload'
    ]
  }

  return (
    <div className="w-64 bg-gradient-to-b from-orange-600 to-orange-800 text-white flex flex-col fixed h-full z-20">
      {/* Logo */}
      <div className="p-5 border-b border-orange-500/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-orange-600 font-bold text-lg shadow">
            B
          </div>
          <div>
            <h1 className="font-bold text-sm">ARSIP PEGAWAI</h1>
            <p className="text-orange-200 text-xs">BASARNAS</p>
          </div>
        </div>
      </div>

      {/* User Info */}
      <div className="p-4 border-b border-orange-500/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-orange-500 rounded-full flex items-center justify-center text-sm font-bold">
            {user?.nickname?.[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <p className="font-medium text-sm">{user?.nickname || 'Unknown'}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full ${levelColor[levelName] || 'bg-gray-500'}`}>
              {levelName || 'Unknown'}
            </span>
          </div>
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 p-3 space-y-1">
        {menuItems
          .filter(item => item.show)
          .map(item => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-all ${
                activePage === item.id
                  ? 'bg-white text-orange-600 font-semibold shadow-lg'
                  : 'text-orange-100 hover:bg-white/10'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
      </nav>

      {/* Level Info */}
      <div className="px-4 py-2 border-t border-orange-500/50">
        <div className="bg-orange-900/30 rounded-lg p-3 text-xs text-orange-200">
          <p className="font-medium mb-1">Hak Akses:</p>
          {(hakAkses[levelName] || []).map((h, i) => (
            <p key={i}>{h}</p>
          ))}
        </div>
      </div>

      {/* Logout */}
      <div className="p-3 border-t border-orange-500/50">
        <button
          onClick={() => {
            if (window.confirm('Yakin ingin logout?')) logout()
          }}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-orange-100 hover:bg-white/10 transition"
        >
          <span className="text-lg">🚪</span>
          <span>Logout</span>
        </button>
      </div>
    </div>
  )
}

export default Sidebar