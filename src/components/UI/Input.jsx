import { forwardRef } from 'react'

export const Input = forwardRef(function Input(
  { label, error, className = '', ...props },
  ref
) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          {label}
        </label>
      )}
      <input
        ref={ref}
        className={`
          w-full px-4 py-2.5 bg-dark-700 border rounded-xl
          text-slate-100 placeholder-slate-500
          focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500
          disabled:bg-dark-800 disabled:cursor-not-allowed disabled:text-slate-500
          ${error ? 'border-red-500' : 'border-dark-600'}
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="mt-1.5 text-sm text-red-400">{error}</p>
      )}
    </div>
  )
})

export function Select({ label, error, children, className = '', ...props }) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-slate-300 mb-1.5">
          {label}
        </label>
      )}
      <select
        className={`
          w-full px-4 py-2.5 bg-dark-700 border rounded-xl
          text-slate-100
          focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500
          disabled:bg-dark-800 disabled:cursor-not-allowed disabled:text-slate-500
          ${error ? 'border-red-500' : 'border-dark-600'}
          ${className}
        `}
        {...props}
      >
        {children}
      </select>
      {error && (
        <p className="mt-1.5 text-sm text-red-400">{error}</p>
      )}
    </div>
  )
}

export function SearchInput({ placeholder = 'Buscar...', value, onChange, className = '' }) {
  return (
    <div className={`relative ${className}`}>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-11 pr-4 py-2.5 bg-dark-700 border border-dark-600 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
      />
      <svg
        className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
    </div>
  )
}
