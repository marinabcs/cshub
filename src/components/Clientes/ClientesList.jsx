import ClienteCard from './ClienteCard'
import { LoadingCard } from '../UI/Loading'

export default function ClientesList({ clientes, loading }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <LoadingCard key={i} />
        ))}
      </div>
    )
  }

  if (clientes.length === 0) {
    return (
      <div className="text-center py-12 bg-dark-800 rounded-2xl border border-dark-700">
        <p className="text-slate-400">Nenhum cliente encontrado.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {clientes.map((cliente) => (
        <ClienteCard key={cliente.id} cliente={cliente} />
      ))}
    </div>
  )
}
