import React, { createContext, useContext, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user')
    return saved ? JSON.parse(saved) : null
  })

  const login = async (email, password) => {
    const { data, error } = await supabase
      .from('users')
      .select('*, level:level_id(nama)')
      .eq('email', email)
      .single()

    if (error || !data) throw new Error('Email tidak ditemukan')
    if (data.password !== password) throw new Error('Password salah')

    localStorage.setItem('user', JSON.stringify(data))
    setUser(data)
    return data
  }

  const logout = () => {
    localStorage.removeItem('user')
    setUser(null)
  }

  const isAdmin = user?.level?.nama === 'Admin'
  const isPimpinan = user?.level?.nama === 'Pimpinan'
  const isPejabat = user?.level?.nama === 'Pejabat'

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin, isPimpinan, isPejabat }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)