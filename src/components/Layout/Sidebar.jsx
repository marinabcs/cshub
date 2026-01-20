import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  LogOut,
  X,
  Sparkles
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Users, label: 'Clientes', path: '/clientes' },
]

export default function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth()

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
          fixed top-0 left-0 z-50 h-screen w-64 bg-dark-950 border-r border-dark-700
          transform transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-20 px-6 border-b border-dark-700">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/20">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-xl font-bold text-white">CS Hub</span>
                <p className="text-xs text-dark-400">Customer Success</p>
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
          <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
            <p className="px-4 mb-3 text-xs font-semibold text-dark-500 uppercase tracking-wider">
              Menu
            </p>
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) => `
                  flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
                  transition-all duration-200
                  ${isActive
                    ? 'bg-primary-600/20 text-primary-400 border border-primary-500/30'
                    : 'text-dark-300 hover:bg-dark-800 hover:text-white'
                  }
                `}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* User */}
          <div className="p-4 border-t border-dark-700">
            <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-dark-800/50">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
                <span className="text-white font-semibold text-sm">
                  {user?.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user?.email?.split('@')[0]}
                </p>
                <p className="text-xs text-dark-400 truncate">
                  {user?.email}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-3 w-full px-4 py-3 mt-3 text-sm font-medium text-dark-400 hover:bg-dark-800 hover:text-red-400 rounded-xl transition-all duration-200"
            >
              <LogOut className="w-5 h-5" />
              Sair
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
