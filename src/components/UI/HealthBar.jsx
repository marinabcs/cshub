export function HealthBar({ score, showLabel = true, size = 'md' }) {
  const getColor = (score) => {
    if (score >= 80) return 'bg-emerald-500'
    if (score >= 60) return 'bg-amber-500'
    if (score >= 40) return 'bg-orange-500'
    return 'bg-red-500'
  }

  const getGlow = (score) => {
    if (score >= 80) return 'shadow-emerald-500/50'
    if (score >= 60) return 'shadow-amber-500/50'
    if (score >= 40) return 'shadow-orange-500/50'
    return 'shadow-red-500/50'
  }

  const getTextColor = (score) => {
    if (score >= 80) return 'text-emerald-400'
    if (score >= 60) return 'text-amber-400'
    if (score >= 40) return 'text-orange-400'
    return 'text-red-400'
  }

  const sizes = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4'
  }

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-medium text-dark-400">Health Score</span>
          <span className={`text-sm font-bold ${getTextColor(score)}`}>{score}%</span>
        </div>
      )}
      <div className={`w-full bg-dark-700 rounded-full ${sizes[size]} overflow-hidden`}>
        <div
          className={`${getColor(score)} ${sizes[size]} rounded-full transition-all duration-500 shadow-lg ${getGlow(score)}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  )
}

export function HealthScoreCircle({ score, size = 'md' }) {
  const getColor = (score) => {
    if (score >= 80) return { stroke: '#10b981', bg: '#064e3b' }
    if (score >= 60) return { stroke: '#f59e0b', bg: '#78350f' }
    if (score >= 40) return { stroke: '#f97316', bg: '#7c2d12' }
    return { stroke: '#ef4444', bg: '#7f1d1d' }
  }

  const sizes = {
    sm: { width: 56, strokeWidth: 5 },
    md: { width: 72, strokeWidth: 6 },
    lg: { width: 100, strokeWidth: 8 }
  }

  const { width, strokeWidth } = sizes[size]
  const radius = (width - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (score / 100) * circumference
  const { stroke, bg } = getColor(score)

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={width} height={width} className="-rotate-90">
        <circle
          cx={width / 2}
          cy={width / 2}
          r={radius}
          fill="none"
          stroke={bg}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={width / 2}
          cy={width / 2}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500"
          style={{ filter: `drop-shadow(0 0 6px ${stroke}40)` }}
        />
      </svg>
      <span
        className="absolute font-bold"
        style={{ color: stroke, fontSize: size === 'lg' ? '1.25rem' : size === 'md' ? '1rem' : '0.875rem' }}
      >
        {score}
      </span>
    </div>
  )
}
