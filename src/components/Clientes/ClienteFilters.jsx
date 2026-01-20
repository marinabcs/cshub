import { SearchInput, Select } from '../UI/Input'

const teamTypes = [
  { value: '', label: 'Todos os tipos' },
  { value: 'Vendas B2B', label: 'Vendas B2B' },
  { value: 'BR LCS', label: 'BR LCS' },
  { value: 'BR MMS', label: 'BR MMS' },
  { value: 'SPLA LCS', label: 'SPLA LCS' },
  { value: 'SPLA MMS', label: 'SPLA MMS' },
  { value: 'CA LCS', label: 'CA LCS' }
]

const healthStatuses = [
  { value: '', label: 'Todos os status' },
  { value: 'saudavel', label: 'Saudável' },
  { value: 'atencao', label: 'Atenção' },
  { value: 'risco', label: 'Risco' },
  { value: 'critico', label: 'Crítico' }
]

export default function ClienteFilters({
  search,
  onSearchChange,
  teamType,
  onTeamTypeChange,
  healthStatus,
  onHealthStatusChange,
  responsaveis = [],
  responsavel,
  onResponsavelChange
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SearchInput
          placeholder="Buscar cliente..."
          value={search}
          onChange={onSearchChange}
        />

        <Select
          value={teamType}
          onChange={(e) => onTeamTypeChange(e.target.value)}
        >
          {teamTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </Select>

        <Select
          value={healthStatus}
          onChange={(e) => onHealthStatusChange(e.target.value)}
        >
          {healthStatuses.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </Select>

        <Select
          value={responsavel}
          onChange={(e) => onResponsavelChange(e.target.value)}
        >
          <option value="">Todos os responsáveis</option>
          {responsaveis.map((resp) => (
            <option key={resp} value={resp}>
              {resp}
            </option>
          ))}
        </Select>
      </div>
    </div>
  )
}
