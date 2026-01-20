import { Menu, UserPlus } from 'lucide-react'
import { useLocation, Link } from 'react-router-dom'

export default function Header({ title, subtitle, onMenuClick }) {
  const location = useLocation()
  const showActionButton = location.pathname === '/clientes'

  return (
    <header className="h-20 bg-dark-950 flex items-center justify-between px-6 border-b border-dark-800">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 text-dark-400 hover:text-white rounded-lg hover:bg-dark-800 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          {subtitle && (
            <p className="text-sm text-dark-400 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {showActionButton && (
          <button
            disabled
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <UserPlus className="w-5 h-5" />
            Novo Cliente
          </button>
        )}

        {location.pathname === '/' && (
          <Link
            to="/clientes"
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-medium transition-colors"
          >
            <UserPlus className="w-5 h-5" />
            Ver Clientes
          </Link>
        )}
      </div>
    </header>
  )
}
