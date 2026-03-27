import React, { createContext, useContext, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user')
    return saved ? JSON.parse(saved) : null
  })

  const login = async (email, password) => {
    // 1. Cari user
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*, level:level_id(id, nama)')
      .eq('email', email)
      .single()

    if (userError || !userData) throw new Error('Email tidak ditemukan')
    if (userData.password !== password) throw new Error('Password salah')

    // 2. Cari profile user ini
    const { data: profileData } = await supabase
      .from('profile')
      .select('*')
      .eq('user_id', userData.id)
      .single()

    // 3. Gabung data user + profile
    const fullUser = {
      ...userData,
      profile: profileData || null,
      profile_id: profileData?.id || null
    }

    localStorage.setItem('user', JSON.stringify(fullUser))
    setUser(fullUser)
    return fullUser
  }

  const logout = () => {
    localStorage.removeItem('user')
    setUser(null)
  }

  // ✅ TAMBAHAN: Update user langsung tanpa reload
  const updateUser = (newData) => {
    setUser(prev => {
      const updated = { ...prev, ...newData }
      localStorage.setItem('user', JSON.stringify(updated))
      return updated
    })
  }

  // ✅ TAMBAHAN: Refresh user lengkap dari database
  const refreshUser = async () => {
    if (!user?.id) return null
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*, level:level_id(id, nama)')
        .eq('id', user.id)
        .single()

      if (userError || !userData) return null

      const { data: profileData } = await supabase
        .from('profile')
        .select('*')
        .eq('user_id', userData.id)
        .single()

      const fullUser = {
        ...userData,
        profile: profileData || null,
        profile_id: profileData?.id || null
      }

      localStorage.setItem('user', JSON.stringify(fullUser))
      setUser(fullUser)
      return fullUser
    } catch (err) {
      console.error('refreshUser error:', err)
      return null
    }
  }

  // Role checks
  const levelName = user?.level?.nama || ''
  const isAdmin = levelName === 'Admin'
  const isPimpinan = levelName === 'Pimpinan'
  const isPejabat = levelName === 'Pejabat'
  const isUser = levelName === 'User'

  // Bisa lihat semua pegawai?
  const canViewAll = isAdmin || isPimpinan || isPejabat
  // Bisa edit data?
  const canEdit = isAdmin
  // Bisa upload berkas?
  const canUpload = isAdmin
  // Bisa input absen?
  const canAbsen = isAdmin
  // Bisa kelola folder?
  const canManageFolder = isAdmin

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      updateUser,    // ✅ BARU
      refreshUser,   // ✅ BARU
      isAdmin,
      isPimpinan,
      isPejabat,
      isUser,
      canViewAll,
      canEdit,
      canUpload,
      canAbsen,
      canManageFolder,
      levelName
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)