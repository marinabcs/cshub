import { SearchInput, Select } from '../UI/Input'
import { SEGMENTO_OPTIONS } from '../../utils/segmentoCS'

const teamTypes = [
  { value: '', label: 'Todos os tipos' },
  { value: 'Vendas B2B', label: 'Vendas B2B' },
  { value: 'BR LCS', label: 'BR LCS' },
  { value: 'BR MMS', label: 'BR MMS' },
  { value: 'SPLA LCS', label: 'SPLA LCS' },
  { value: 'SPLA MMS', label: 'SPLA MMS' },
  { value: 'CA LCS', label: 'CA LCS' }
]

export default function ClienteFilters({
  search,
  onSearchChange,
  teamType,
  onTeamTypeChange,
  segmento,
  onSegmentoChange,
  responsaveis = [],
  responsavel,
  onResponsavelChange
}) {
  return (
    <div className="bg-dark-800/60 backdrop-blur-sm rounded-2xl border border-primary-900/30 p-4 mb-6">
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
          value={segmento || ''}
          onChange={(e) => onSegmentoChange(e.target.value)}
        >
          <option value="">Todas as saúdes</option>
          {SEGMENTO_OPTIONS.map((seg) => (
            <option key={seg.value} value={seg.value}>
              {seg.label}
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
