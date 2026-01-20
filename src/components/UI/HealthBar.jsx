export function HealthBar({ score, showLabel = true, size = 'md' }) {
  const getColor = (score) => {
    if (score >= 80) return 'bg-emerald-500'
    if (score >= 60) return 'bg-amber-500'
    if (score >= 40) return 'bg-orange-500'
    return 'bg-red-500'
  }

  const getTextColor = (score) => {
    if (score >= 80) return 'text-emerald-700'
    if (score >= 60) return 'text-amber-700'
    if (score >= 40) return 'text-orange-700'
    return 'text-red-700'
  }

  const sizes = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3'
  }

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs font-medium text-gray-500">Health Score</span>
          <span className={`text-sm font-bold ${getTextColor(score)}`}>{score}%</span>
        </div>
      )}
      <div className={`w-full bg-gray-200 rounded-full ${sizes[size]} overflow-hidden`}>
        <div
          className={`${getColor(score)} ${sizes[size]} rounded-full transition-all duration-500`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  )
}

export function HealthScoreCircle({ score, size = 'md' }) {
  const getColor = (score) => {
    if (score >= 80) return { stroke: '#10b981', bg: '#d1fae5' }
    if (score >= 60) return { stroke: '#f59e0b', bg: '#fef3c7' }
    if (score >= 40) return { stroke: '#f97316', bg: '#ffedd5' }
    return { stroke: '#ef4444', bg: '#fee2e2' }
  }

  const sizes = {
    sm: { width: 48, strokeWidth: 4 },
    md: { width: 64, strokeWidth: 5 },
    lg: { width: 96, strokeWidth: 6 }
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
        />
      </svg>
      <span
        className="absolute text-sm font-bold"
        style={{ color: stroke }}
      >
        {score}
      </span>
    </div>
  )
}
