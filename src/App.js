import React, { useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/layout/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import AdminPegawaiPage from './pages/admin/AdminPegawaiPage'
import AdminAbsenPage from './pages/admin/AdminAbsenPage'
import PimpinanPegawaiPage from './pages/pimpinan/PimpinanPegawaiPage'
import UserProfilePage from './pages/user/UserProfilePage'
import SettingsPage from './pages/SettingsPage'

function AppContent() {
  const { user, isAdmin, isPimpinan, isPejabat, isUser } = useAuth()
  const [page, setPage] = useState(isUser ? 'pegawai' : 'dashboard')

  if (!user) return <LoginPage />

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        if (isUser) return <UserProfilePage />
        return <DashboardPage />
      case 'pegawai':
        if (isAdmin) return <AdminPegawaiPage />
        if (isPimpinan || isPejabat) return <PimpinanPegawaiPage />
        if (isUser) return <UserProfilePage />
        return <DashboardPage />
      case 'absen':
        if (isAdmin) return <AdminAbsenPage />
        if (isUser) return <UserProfilePage />
        return <DashboardPage />
      case 'settings':
        return <SettingsPage />
      default:
        if (isUser) return <UserProfilePage />
        return <DashboardPage />
    }
  }

  return (
    <Layout activePage={page} onNavigate={setPage}>
      {renderPage()}
    </Layout>
  )
}

function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" />
      <AppContent />
    </AuthProvider>
  )
}

export default App