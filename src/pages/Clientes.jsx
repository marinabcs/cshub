import { useState, useMemo } from 'react'
import { useClientes } from '../hooks/useClientes'
import { ClienteFilters, ClientesList } from '../components/Clientes'

export default function Clientes() {
  const { clientes, loading } = useClientes()

  const [search, setSearch] = useState('')
  const [teamType, setTeamType] = useState('')
  const [healthStatus, setHealthStatus] = useState('')
  const [responsavel, setResponsavel] = useState('')

  const responsaveis = useMemo(() => {
    const names = clientes.map(c => c.responsavel_nome).filter(Boolean)
    return [...new Set(names)].sort()
  }, [clientes])

  const filteredClientes = useMemo(() => {
    return clientes.filter(cliente => {
      const matchesSearch = !search ||
        cliente.team_name?.toLowerCase().includes(search.toLowerCase())

      const matchesType = !teamType || cliente.team_type === teamType

      const matchesStatus = !healthStatus || cliente.health_status === healthStatus

      const matchesResponsavel = !responsavel ||
        cliente.responsavel_nome === responsavel

      return matchesSearch && matchesType && matchesStatus && matchesResponsavel
    })
  }, [clientes, search, teamType, healthStatus, responsavel])

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Clientes</h2>
        <p className="text-gray-500">
          {loading ? 'Carregando...' : `${filteredClientes.length} clientes encontrados`}
        </p>
      </div>

      <ClienteFilters
        search={search}
        onSearchChange={setSearch}
        teamType={teamType}
        onTeamTypeChange={setTeamType}
        healthStatus={healthStatus}
        onHealthStatusChange={setHealthStatus}
        responsaveis={responsaveis}
        responsavel={responsavel}
        onResponsavelChange={setResponsavel}
      />

      <ClientesList clientes={filteredClientes} loading={loading} />
    </div>
  )
}
