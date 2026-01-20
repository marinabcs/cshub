import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  LogOut,
  X,
  Settings,
  HelpCircle
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Users, label: 'Clientes', path: '/clientes' },
]

const configItems = [
  { icon: Settings, label: 'Configurações', path: '/config', disabled: true },
  { icon: HelpCircle, label: 'Ajuda', path: '/ajuda', disabled: true },
]

export default function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth()

  const userName = user?.email?.split('@')[0] || 'Usuário'
  const userInitial = userName.charAt(0).toUpperCase()

  return (
    <>
      {/* Overlay mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-screen w-[260px] bg-dark-900 border-r border-dark-700
          transform transition-transform duration-300 ease-in-out flex flex-col
          lg:translate-x-0 lg:static lg:z-auto
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-20 px-5 border-b border-dark-700">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/25">
              <span className="text-white font-bold text-lg">CS</span>
            </div>
            <div>
              <span className="text-lg font-bold text-white">CS Hub</span>
              <p className="text-[11px] text-dark-400 -mt-0.5">v1.0</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-2 text-dark-400 hover:text-white rounded-lg hover:bg-dark-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-5 overflow-y-auto">
          {/* Menu Section */}
          <p className="px-4 mb-3 text-[11px] font-semibold text-dark-500 uppercase tracking-wider">
            Menu
          </p>
          <div className="space-y-1 mb-6">
            {menuItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) => `
                  flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium
                  transition-all duration-200
                  ${isActive
                    ? 'bg-primary-600/20 text-primary-400'
                    : 'text-dark-300 hover:bg-dark-800 hover:text-white'
                  }
                `}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </NavLink>
            ))}
          </div>

          {/* Configurações Section */}
          <p className="px-4 mb-3 text-[11px] font-semibold text-dark-500 uppercase tracking-wider">
            Configurações
          </p>
          <div className="space-y-1">
            {configItems.map((item) => (
              <button
                key={item.path}
                disabled={item.disabled}
                className={`
                  flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium w-full
                  transition-all duration-200 text-left
                  ${item.disabled
                    ? 'text-dark-500 cursor-not-allowed opacity-50'
                    : 'text-dark-300 hover:bg-dark-800 hover:text-white'
                  }
                `}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </button>
            ))}
          </div>
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-dark-700">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-primary-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-semibold text-sm">
                {userInitial}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {userName}
              </p>
              <p className="text-xs text-dark-400">
                Administrador
              </p>
            </div>
            <button
              onClick={logout}
              className="p-2 text-dark-400 hover:text-red-400 hover:bg-dark-800 rounded-lg transition-colors"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
