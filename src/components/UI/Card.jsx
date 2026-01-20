export function Card({ children, className = '', ...props }) {
  return (
    <div
      className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '' }) {
  return (
    <div className={`px-6 py-4 border-b border-gray-200 ${className}`}>
      {children}
    </div>
  )
}

export function CardContent({ children, className = '' }) {
  return (
    <div className={`px-6 py-4 ${className}`}>
      {children}
    </div>
  )
}

export function CardFooter({ children, className = '' }) {
  return (
    <div className={`px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl ${className}`}>
      {children}
    </div>
  )
}

export function StatsCard({ title, value, icon: Icon, trend, trendUp, className = '' }) {
  return (
    <Card className={className}>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
            {trend && (
              <p className={`mt-1 text-sm ${trendUp ? 'text-emerald-600' : 'text-red-600'}`}>
                {trendUp ? '↑' : '↓'} {trend}
              </p>
            )}
          </div>
          {Icon && (
            <div className="p-3 bg-primary-100 rounded-xl">
              <Icon className="w-6 h-6 text-primary-600" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
