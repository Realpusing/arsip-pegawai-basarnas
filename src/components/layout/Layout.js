import React from 'react'
import Sidebar from './Sidebar'

function Layout({ activePage, onNavigate, children }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar activePage={activePage} onNavigate={onNavigate} />
      <div className="flex-1 ml-64">
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  )
}

export default Layout