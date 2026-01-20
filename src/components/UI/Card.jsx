export function Card({ children, className = '', ...props }) {
  return (
    <div
      className={`bg-dark-800 rounded-2xl border border-dark-700 shadow-lg shadow-black/20 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '' }) {
  return (
    <div className={`px-6 py-5 border-b border-dark-700 ${className}`}>
      {children}
    </div>
  )
}

export function CardContent({ children, className = '' }) {
  return (
    <div className={`px-6 py-5 ${className}`}>
      {children}
    </div>
  )
}

export function CardFooter({ children, className = '' }) {
  return (
    <div className={`px-6 py-4 border-t border-dark-700 bg-dark-800/50 rounded-b-2xl ${className}`}>
      {children}
    </div>
  )
}

export function StatsCard({ title, value, subtitle, icon: Icon, color = 'primary', className = '' }) {
  const colors = {
    primary: {
      bg: 'bg-gradient-to-br from-primary-500/20 to-primary-600/10',
      border: 'border-primary-500/30',
      icon: 'text-primary-400',
      iconBg: 'bg-primary-500/20',
      glow: 'shadow-primary-500/10'
    },
    success: {
      bg: 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/10',
      border: 'border-emerald-500/30',
      icon: 'text-emerald-400',
      iconBg: 'bg-emerald-500/20',
      glow: 'shadow-emerald-500/10'
    },
    warning: {
      bg: 'bg-gradient-to-br from-amber-500/20 to-amber-600/10',
      border: 'border-amber-500/30',
      icon: 'text-amber-400',
      iconBg: 'bg-amber-500/20',
      glow: 'shadow-amber-500/10'
    },
    danger: {
      bg: 'bg-gradient-to-br from-red-500/20 to-red-600/10',
      border: 'border-red-500/30',
      icon: 'text-red-400',
      iconBg: 'bg-red-500/20',
      glow: 'shadow-red-500/10'
    }
  }

  const colorConfig = colors[color] || colors.primary

  return (
    <div className={`${colorConfig.bg} rounded-2xl border ${colorConfig.border} p-6 shadow-lg ${colorConfig.glow} hover:scale-[1.02] transition-transform duration-200 ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-400 mb-1">{title}</p>
          <p className="text-4xl font-bold text-white tracking-tight">{value}</p>
          {subtitle && (
            <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className={`p-3 ${colorConfig.iconBg} rounded-xl border ${colorConfig.border}`}>
            <Icon className={`w-6 h-6 ${colorConfig.icon}`} />
          </div>
        )}
      </div>
    </div>
  )
}
