export function Card({ children, className = '', ...props }) {
  return (
    <div
      className={`bg-dark-800 rounded-2xl border border-dark-700 shadow-lg shadow-black/10 ${className}`}
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

export function StatsCard({ title, value, icon: Icon, trend, trendUp, color = 'primary', className = '' }) {
  const colors = {
    primary: {
      bg: 'bg-primary-500/20',
      icon: 'text-primary-400',
      glow: 'shadow-primary-500/20'
    },
    success: {
      bg: 'bg-emerald-500/20',
      icon: 'text-emerald-400',
      glow: 'shadow-emerald-500/20'
    },
    warning: {
      bg: 'bg-amber-500/20',
      icon: 'text-amber-400',
      glow: 'shadow-amber-500/20'
    },
    danger: {
      bg: 'bg-red-500/20',
      icon: 'text-red-400',
      glow: 'shadow-red-500/20'
    }
  }

  const colorConfig = colors[color] || colors.primary

  return (
    <Card className={`hover:border-dark-600 transition-all duration-300 ${className}`}>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-dark-400">{title}</p>
            <p className="mt-2 text-3xl font-bold text-white">{value}</p>
            {trend && (
              <p className={`mt-2 text-sm font-medium ${trendUp ? 'text-emerald-400' : 'text-red-400'}`}>
                {trendUp ? '↑' : '↓'} {trend}
              </p>
            )}
          </div>
          {Icon && (
            <div className={`p-4 ${colorConfig.bg} rounded-2xl shadow-lg ${colorConfig.glow}`}>
              <Icon className={`w-7 h-7 ${colorConfig.icon}`} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
