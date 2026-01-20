import { Menu, Bell, Search } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

export default function Header({ title, onMenuClick }) {
  const { user } = useAuth()

  return (
    <header className="h-16 bg-dark-900 border-b border-dark-700 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 text-dark-400 hover:text-white rounded-lg hover:bg-dark-800 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-white">{title}</h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Search - futuro */}
        <button className="hidden md:flex items-center gap-2 px-4 py-2 text-dark-400 bg-dark-800 rounded-lg hover:bg-dark-700 transition-colors">
          <Search className="w-4 h-4" />
          <span className="text-sm">Buscar...</span>
          <kbd className="hidden lg:inline-flex items-center px-2 py-0.5 text-xs bg-dark-700 rounded ml-2">
            ⌘K
          </kbd>
        </button>

        {/* Notificações */}
        <button className="relative p-2.5 text-dark-400 hover:text-white rounded-lg hover:bg-dark-800 transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-dark-900" />
        </button>

        {/* Avatar do usuário */}
        <div className="hidden sm:flex items-center gap-3 pl-3 ml-2 border-l border-dark-700">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
            <span className="text-white font-semibold text-sm">
              {user?.email?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="hidden lg:block">
            <p className="text-sm font-medium text-white">
              {user?.email?.split('@')[0]}
            </p>
            <p className="text-xs text-dark-400">
              CS Team
            </p>
          </div>
        </div>
      </div>
    </header>
  )
}
