import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'

const pageConfig = {
  '/': {
    title: 'Dashboard',
    subtitle: 'Visão geral dos clientes'
  },
  '/clientes': {
    title: 'Clientes',
    subtitle: 'Gerencie seus clientes'
  }
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  const getConfig = () => {
    if (location.pathname.startsWith('/clientes/')) {
      return {
        title: 'Detalhe do Cliente',
        subtitle: 'Informações e timeline'
      }
    }
    return pageConfig[location.pathname] || { title: 'CS Hub', subtitle: '' }
  }

  const config = getConfig()

  return (
    <div className="min-h-screen bg-dark-950 flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          title={config.title}
          subtitle={config.subtitle}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
