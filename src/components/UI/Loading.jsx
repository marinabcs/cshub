import { Loader2 } from 'lucide-react'

export function Loading({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  }

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <Loader2 className={`${sizes[size]} text-primary-500 animate-spin`} />
    </div>
  )
}

export function LoadingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-900">
      <div className="text-center">
        <Loading size="lg" />
        <p className="mt-4 text-slate-400">Carregando...</p>
      </div>
    </div>
  )
}

export function LoadingCard() {
  return (
    <div className="bg-dark-800 rounded-2xl border border-dark-700 p-6">
      <div className="animate-pulse">
        <div className="h-4 bg-dark-700 rounded w-3/4 mb-4"></div>
        <div className="h-8 bg-dark-700 rounded w-1/3 mb-4"></div>
        <div className="h-3 bg-dark-700 rounded w-1/2"></div>
      </div>
    </div>
  )
}

export function LoadingTable({ rows = 5 }) {
  return (
    <div className="animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center space-x-4 py-4 border-b border-dark-700">
          <div className="h-10 w-10 bg-dark-700 rounded-full"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-dark-700 rounded w-1/4"></div>
            <div className="h-3 bg-dark-700 rounded w-1/2"></div>
          </div>
          <div className="h-6 w-20 bg-dark-700 rounded-full"></div>
        </div>
      ))}
    </div>
  )
}
