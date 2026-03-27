import React, { useState } from 'react'
import { useAuth } from '../../context/AuthContext'

function Sidebar({ activePage, onNavigate }) {
  const { user, isAdmin, isUser, isPimpinan, isPejabat, canAbsen, logout, levelName } = useAuth()
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showHakAkses, setShowHakAkses] = useState(false)

  const menuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      show: !isUser,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
        </svg>
      ),
    },
    {
      id: 'pegawai',
      label: isUser ? 'Data Saya' : isAdmin ? 'Kelola Pegawai' : isPejabat ? 'Data Anak Buah' : 'Data Pegawai',
      show: true,
      icon: isUser ? (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      ),
    },
    {
      id: 'absen',
      label: 'Absensi',
      show: canAbsen,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
        </svg>
      ),
    },
    {
      id: 'settings',
      label: 'Pengaturan',
      show: true,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ]

  const levelConfig = {
    Admin: {
      gradient: 'from-red-500 to-rose-600',
      badge: 'bg-white/20 text-white ring-1 ring-white/30',
      hakAkses: ['Full akses kelola data', 'Upload berkas ke Drive', 'Input absen pegawai', 'Kelola semua akun'],
    },
    Pimpinan: {
      gradient: 'from-blue-500 to-indigo-600',
      badge: 'bg-white/20 text-white ring-1 ring-white/30',
      hakAkses: ['Lihat semua pegawai', 'Download berkas', 'Lihat statistik', 'Tidak bisa edit/upload'],
    },
    Pejabat: {
      gradient: 'from-emerald-500 to-teal-600',
      badge: 'bg-white/20 text-white ring-1 ring-white/30',
      hakAkses: ['Lihat anak buah langsung', 'Download berkas', 'Tidak bisa edit/upload'],
    },
    User: {
      gradient: 'from-gray-400 to-gray-500',
      badge: 'bg-white/20 text-white ring-1 ring-white/30',
      hakAkses: ['Lihat data sendiri', 'Download berkas sendiri', 'Tidak bisa edit/upload'],
    },
  }

  const config = levelConfig[levelName] || levelConfig.User

  return (
    <>
      <div className="w-64 bg-gradient-to-b from-orange-600 via-orange-700 to-red-800 text-white flex flex-col fixed h-full z-20 shadow-2xl">

        {/* ===== LOGO ===== */}
        <div className="p-5 border-b border-white/15">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center shadow-lg">
                <img
                  src="/logos/LOGO_BASARNAS.png"
                  alt="BASARNAS"
                  className="w-8 h-8 object-contain"
                  onError={(e) => {
                    e.target.style.display = 'none'
                    e.target.nextSibling.style.display = 'flex'
                  }}
                />
                <div className="hidden items-center justify-center w-8 h-8">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
                  </svg>
                </div>
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-orange-600 animate-pulse" />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-wide">SIMPEG</h1>
              <p className="text-orange-200/70 text-[11px] tracking-widest">BASARNAS TARAKAN</p>
            </div>
          </div>
        </div>

        {/* ===== USER PROFILE ===== */}
        <div className="p-4 border-b border-white/15">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className={`w-10 h-10 bg-gradient-to-br ${config.gradient} rounded-full flex items-center justify-center text-sm font-bold ring-2 ring-white/30 shadow-lg`}>
                  {user?.nickname?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-orange-700" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{user?.nickname || 'Unknown'}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${config.badge}`}>
                    {levelName || 'User'}
                  </span>
                  <span className="text-[10px] text-green-300 flex items-center gap-0.5">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                    Online
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ===== MENU LABEL ===== */}
        <div className="px-5 pt-5 pb-2">
          <p className="text-[10px] font-bold text-orange-300/50 uppercase tracking-[0.2em]">
            Menu Utama
          </p>
        </div>

        {/* ===== NAVIGATION ===== */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto sidebar-scroll">
          {menuItems
            .filter(item => item.show)
            .map(item => {
              const isActive = activePage === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`w-full group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 relative ${
                    isActive
                      ? 'bg-white text-orange-700 font-semibold shadow-lg'
                      : 'text-orange-100/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1.5 w-1 h-5 bg-white rounded-full shadow-lg shadow-white/30" />
                  )}

                  <span className={`transition-transform duration-200 ${isActive ? '' : 'group-hover:scale-110'}`}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>

                  {isActive && (
                    <svg className="w-4 h-4 ml-auto text-orange-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  )}
                </button>
              )
            })}
        </nav>

        {/* ===== HAK AKSES COLLAPSIBLE ===== */}
        <div className="px-3 pb-2">
          <button
            onClick={() => setShowHakAkses(!showHakAkses)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs text-orange-200/60 hover:text-orange-100 transition rounded-lg hover:bg-white/5"
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
              Hak Akses
            </span>
            <svg
              className={`w-3.5 h-3.5 transition-transform duration-300 ${showHakAkses ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              showHakAkses ? 'max-h-40 opacity-100 mt-1' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="bg-white/10 rounded-xl p-3 space-y-1.5">
              {(config.hakAkses || []).map((h, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px]">
                  <svg className="w-3.5 h-3.5 text-yellow-300 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                  </svg>
                  <span className="text-orange-100/70">{h}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ===== LOGOUT ===== */}
        <div className="p-3 border-t border-white/15">
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-orange-200/70 hover:text-white hover:bg-red-600/30 transition-all duration-200"
          >
            <svg className="w-5 h-5 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
            <span>Keluar</span>
          </button>
        </div>

        {/* ===== VERSION ===== */}
        <div className="px-5 pb-4">
          <div className="flex items-center justify-between text-[10px] text-orange-300/30">
            <span>SIMPEG v2.0</span>
            <span>© {new Date().getFullYear()}</span>
          </div>
        </div>
      </div>

      {/* ===== LOGOUT CONFIRMATION MODAL ===== */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowLogoutConfirm(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-modal">
            <div className="h-1.5 bg-gradient-to-r from-orange-500 to-red-600" />
            <div className="p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-1">Konfirmasi Logout</h3>
              <p className="text-sm text-gray-500 mb-6">Anda yakin ingin keluar dari sistem?</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  onClick={() => { setShowLogoutConfirm(false); logout() }}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-medium text-sm rounded-xl transition shadow-lg shadow-red-500/25"
                >
                  Ya, Keluar
                </button>
              </div>
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
        .sidebar-scroll::-webkit-scrollbar { width: 3px; }
        .sidebar-scroll::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.15);
          border-radius: 10px;
        }
      `}</style>
    </>
  )
}

export default Sidebar