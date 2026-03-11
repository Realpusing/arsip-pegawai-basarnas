import React, { useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import { UploadProvider } from './context/UploadContext'
import Layout from './components/layout/Layout'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import PegawaiPage from './pages/PegawaiPage'
import AbsenPage from './pages/AbsenPage'

function AppContent() {
  const { user } = useAuth()
  const [page, setPage] = useState('pegawai')

  if (!user) return <LoginPage />

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <DashboardPage />
      case 'pegawai': return <PegawaiPage />
      case 'absen': return <AbsenPage />
      default: return <DashboardPage />
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
      <UploadProvider>
        <Toaster position="top-right" />
        <AppContent />
      </UploadProvider>
    </AuthProvider>
  )
}

export default App