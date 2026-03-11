import React from 'react'
import { useAuth } from '../../context/AuthContext'

function Sidebar({ activePage, onNavigate }) {
  const { user, isAdmin, logout } = useAuth()

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'pegawai', label: 'Data Pegawai', icon: '👥' },
    ...(isAdmin ? [{ id: 'absen', label: 'Absensi', icon: '📋' }] : [])
  ]

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
            {user?.nickname?.[0]?.toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-sm">{user?.nickname}</p>
            <p className="text-orange-200 text-xs">{user?.level?.nama}</p>
          </div>
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 p-3 space-y-1">
        {menuItems.map(item => (
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

      {/* Logout */}
      <div className="p-3 border-t border-orange-500/50">
        <button
          onClick={() => { if (window.confirm('Yakin ingin logout?')) logout() }}
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