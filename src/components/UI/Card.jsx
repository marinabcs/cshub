export function Card({ children, className = '', ...props }) {
  return (
    <div
      className={`bg-dark-800 rounded-2xl border border-dark-700 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '' }) {
  return (
    <div className={`px-5 py-4 border-b border-dark-700 ${className}`}>
      {children}
    </div>
  )
}

export function CardContent({ children, className = '' }) {
  return (
    <div className={`px-5 py-4 ${className}`}>
      {children}
    </div>
  )
}

export function CardFooter({ children, className = '' }) {
  return (
    <div className={`px-5 py-4 border-t border-dark-700 ${className}`}>
      {children}
    </div>
  )
}

// Stats Card estilo Trakteiros - Ícone à esquerda, texto à direita
export function StatsCard({ title, value, icon: Icon, color = 'cyan', className = '' }) {
  const colors = {
    cyan: {
      bg: 'bg-cyan-500/20',
      icon: 'text-cyan-400',
    },
    green: {
      bg: 'bg-emerald-500/20',
      icon: 'text-emerald-400',
    },
    orange: {
      bg: 'bg-orange-500/20',
      icon: 'text-orange-400',
    },
    red: {
      bg: 'bg-red-500/20',
      icon: 'text-red-400',
    },
    purple: {
      bg: 'bg-primary-500/20',
      icon: 'text-primary-400',
    },
    amber: {
      bg: 'bg-amber-500/20',
      icon: 'text-amber-400',
    }
  }

  const colorConfig = colors[color] || colors.cyan

  return (
    <div className={`bg-dark-800 rounded-2xl border border-dark-700 p-5 ${className}`}>
      <div className="flex items-center gap-4">
        {Icon && (
          <div className={`w-12 h-12 ${colorConfig.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
            <Icon className={`w-6 h-6 ${colorConfig.icon}`} />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm text-dark-400 truncate">{title}</p>
          <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
        </div>
      </div>
    </div>
  )
}
