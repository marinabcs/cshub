import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ListTodo, RefreshCw, ListChecks, Bell, Clock, AlertTriangle, Search, X, Check, Play, Ban, Loader2, ChevronDown, Zap, LayoutList, Columns3, Calendar, Plus, StickyNote } from 'lucide-react'
import useMinhasTarefas from '../hooks/useMinhasTarefas'
import { atualizarStatusTarefa, atualizarDataTarefa } from '../services/tarefasWriteBack'
import { fetchUsuariosSistema, fetchAllClientes, createTarefaManual } from '../services/dataAccess'
import { updateAlerta } from '../services/dataAccess'
import { atribuirCiclo } from '../services/ongoing'
import { getSegmentoAcoes } from '../utils/segmentoCS'
import { filterActiveCSUsers } from '../utils/roles'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { Pagination } from '../components/UI/Pagination'

const PAGE_SIZE = 20

// ── Cores por segmento ──────────────────────────────────────────────────────
const SEGMENTO_CORES = {
  CRESCIMENTO: '#10b981',
  ESTAVEL: '#06b6d4',
  ALERTA: '#f59e0b',
  RESGATE: '#ef4444',
}

// ── Icone por fonte ─────────────────────────────────────────────────────────
const FONTE_ICON = {
  ongoing: RefreshCw,
  playbook: ListChecks,
  alerta: Bell,
  manual: StickyNote,
}

const FONTE_LABEL = {
  ongoing: 'Ongoing',
  playbook: 'Playbook',
  alerta: 'Alerta',
  manual: 'Manual',
}

const SAUDE_OPTIONS = ['CRESCIMENTO', 'ESTAVEL', 'ALERTA', 'RESGATE']
const TIPO_OPTIONS = ['ongoing', 'playbook', 'alerta', 'manual']
const STATUS_OPTIONS = ['pendente', 'em_andamento', 'bloqueada']
const STATUS_LABELS = {
  pendente: 'Pendente',
  em_andamento: 'Em Andamento',
  bloqueada: 'Bloqueada',
}

// ============================================================================
// MultiSelectDropdown (reusable)
// ============================================================================
function MultiSelectDropdown({ label, options, selected, onChange, getLabel, getColor }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const toggle = (value) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  const displayText = selected.length === 0
    ? 'Todos'
    : selected.length === options.length
      ? 'Todos'
      : `${selected.length} selecionado${selected.length > 1 ? 's' : ''}`

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} ref={ref}>
      <span style={{ color: '#64748b', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{label}:</span>
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setOpen(!open)}
          style={{
            padding: '6px 28px 6px 10px',
            background: 'rgba(15, 10, 31, 0.6)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '8px',
            color: 'white',
            fontSize: '12px',
            fontWeight: '500',
            cursor: 'pointer',
            minWidth: '120px',
            textAlign: 'left',
          }}
        >
          {displayText}
        </button>
        <ChevronDown style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', width: '12px', height: '12px', color: '#8b5cf6', pointerEvents: 'none' }} />
        {open && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, marginTop: '4px',
            background: '#1e1b4b', border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '10px', padding: '8px', zIndex: 50, minWidth: '180px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}>
            {options.map(opt => {
              const checked = selected.includes(opt)
              const color = getColor ? getColor(opt) : '#8b5cf6'
              return (
                <label key={opt} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 10px', borderRadius: '8px', cursor: 'pointer',
                  background: checked ? `${color}15` : 'transparent',
                }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(opt)}
                    style={{ accentColor: color }}
                  />
                  {getColor && (
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                  )}
                  <span style={{ color: checked ? color : '#94a3b8', fontSize: '13px', fontWeight: checked ? '600' : '400' }}>
                    {getLabel ? getLabel(opt) : opt}
                  </span>
                </label>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// StatsBar
// ============================================================================
function StatsBar({ stats }) {
  const items = [
    { label: 'Pendentes', value: stats.pendentes, color: '#f59e0b' },
    { label: 'Em Andamento', value: stats.emAndamento, color: '#3b82f6' },
    { label: 'Vencidas', value: stats.vencidas, color: '#ef4444' },
    { label: 'Total', value: stats.total, color: '#8b5cf6' },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
      {items.map(item => (
        <div key={item.label} style={{
          background: 'rgba(30, 27, 75, 0.4)',
          border: '1px solid rgba(139, 92, 246, 0.15)',
          borderRadius: '12px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}>
          <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '500' }}>{item.label}</span>
          <span style={{ color: item.color, fontSize: '24px', fontWeight: '700' }}>{item.value}</span>
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// FilterBar (compact dropdowns, single line)
// ============================================================================
function FilterBar({ filtros, setFiltros, responsaveis, selectedResponsavel, onResponsavelChange, userEmail }) {
  const { busca } = filtros

  const hasFilters = filtros.tipos.length > 0 || filtros.status.length > 0 || filtros.saude.length > 0 || busca.length > 0 || (selectedResponsavel && selectedResponsavel !== userEmail)

  return (
    <div style={{
      background: 'rgba(30, 27, 75, 0.4)',
      border: '1px solid rgba(139, 92, 246, 0.15)',
      borderRadius: '12px',
      padding: '12px 16px',
      marginBottom: '20px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      flexWrap: 'wrap',
    }}>
      {/* Responsavel */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ color: '#64748b', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Responsavel:</span>
        <div style={{ position: 'relative' }}>
          <select
            value={selectedResponsavel || ''}
            onChange={(e) => onResponsavelChange(e.target.value)}
            style={{
              appearance: 'none',
              padding: '6px 28px 6px 10px',
              background: 'rgba(15, 10, 31, 0.6)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '8px',
              color: 'white',
              fontSize: '12px',
              fontWeight: '500',
              cursor: 'pointer',
              outline: 'none',
              minWidth: '150px',
            }}
          >
            <option value="todos" style={{ background: '#1e1b4b' }}>Todos</option>
            {responsaveis.map((resp) => (
              <option key={resp.id} value={resp.email} style={{ background: '#1e1b4b' }}>
                {resp.email === userEmail ? `${resp.nome} (Voce)` : resp.nome}
              </option>
            ))}
          </select>
          <ChevronDown style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', width: '12px', height: '12px', color: '#8b5cf6', pointerEvents: 'none' }} />
        </div>
      </div>

      {/* Tipo */}
      <MultiSelectDropdown
        label="Tipo"
        options={TIPO_OPTIONS}
        selected={filtros.tipos}
        onChange={(val) => setFiltros(prev => ({ ...prev, tipos: val }))}
        getLabel={(opt) => FONTE_LABEL[opt]}
      />

      {/* Status */}
      <MultiSelectDropdown
        label="Status"
        options={STATUS_OPTIONS}
        selected={filtros.status}
        onChange={(val) => setFiltros(prev => ({ ...prev, status: val }))}
        getLabel={(opt) => STATUS_LABELS[opt]}
      />

      {/* Saude */}
      <MultiSelectDropdown
        label="Saude"
        options={SAUDE_OPTIONS}
        selected={filtros.saude}
        onChange={(val) => setFiltros(prev => ({ ...prev, saude: val }))}
        getLabel={(opt) => opt.charAt(0) + opt.slice(1).toLowerCase()}
        getColor={(opt) => SEGMENTO_CORES[opt] || '#8b5cf6'}
      />

      {/* Busca */}
      <div style={{ flex: 1, position: 'relative', minWidth: '180px' }}>
        <Search style={{ width: '14px', height: '14px', color: '#64748b', position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
        <input
          type="text"
          placeholder="Buscar..."
          value={busca}
          onChange={(e) => setFiltros(prev => ({ ...prev, busca: e.target.value }))}
          style={{
            width: '100%',
            padding: '6px 10px 6px 30px',
            background: 'rgba(15, 10, 31, 0.6)',
            border: '1px solid rgba(139, 92, 246, 0.15)',
            borderRadius: '8px',
            color: 'white',
            fontSize: '12px',
            outline: 'none',
          }}
        />
      </div>

      {hasFilters && (
        <button
          onClick={() => { setFiltros({ tipos: [], status: [], saude: [], busca: '' }); onResponsavelChange(userEmail); }}
          style={{
            padding: '6px 10px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '8px',
            color: '#ef4444',
            fontSize: '11px',
            fontWeight: '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            whiteSpace: 'nowrap',
          }}
        >
          <X style={{ width: '12px', height: '12px' }} />
          Limpar
        </button>
      )}
    </div>
  )
}

// ============================================================================
// TaskCard (clickable, icon-only secondary buttons, inline date edit)
// ============================================================================
function TaskCard({ tarefa, onAction, onPrimaryAction, updating, navigate, onDateChange, compact }) {
  const IconeFonte = FONTE_ICON[tarefa.fonte] || RefreshCw
  const [editingDate, setEditingDate] = useState(false)
  const [dateValue, setDateValue] = useState('')
  const [savingDate, setSavingDate] = useState(false)

  // Border color: overdue > near deadline > segment
  let borderColor = SEGMENTO_CORES[tarefa.segmento] || '#8b5cf6'
  if (tarefa.vencida) {
    borderColor = '#ef4444'
  } else if (tarefa.diasAtraso >= -3 && tarefa.dataVencimento) {
    borderColor = '#f59e0b'
  }

  const formatDate = (d) => {
    if (!d) return null
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }

  const handleCardClick = () => {
    if (tarefa.clienteId) {
      navigate(`/clientes/${tarefa.clienteId}`)
    }
  }

  const openDateEditor = () => {
    setDateValue(tarefa.dataVencimento ? tarefa.dataVencimento.toISOString().split('T')[0] : '')
    setEditingDate(true)
  }

  const saveDate = async () => {
    if (!dateValue) return
    setSavingDate(true)
    try {
      await onDateChange(tarefa, dateValue)
    } finally {
      setSavingDate(false)
      setEditingDate(false)
    }
  }

  const canEditDate = tarefa.fonte !== 'alerta'

  return (
    <div
      onClick={handleCardClick}
      style={{
        background: 'rgba(30, 27, 75, 0.4)',
        border: '1px solid rgba(139, 92, 246, 0.15)',
        borderLeft: `4px solid ${borderColor}`,
        borderRadius: '12px',
        padding: compact ? '10px 14px' : '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: compact ? '10px' : '16px',
        cursor: tarefa.clienteId ? 'pointer' : 'default',
      }}
    >
      {/* Icon */}
      {!compact && (
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          background: `${borderColor}15`,
          border: `1px solid ${borderColor}30`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <IconeFonte style={{ width: '20px', height: '20px', color: borderColor }} />
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: compact ? '2px' : '4px', flexWrap: 'wrap' }}>
          <span style={{ color: 'white', fontSize: compact ? '12px' : '14px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: compact ? '200px' : '300px' }}>
            {tarefa.titulo}
          </span>
          <span style={{
            padding: '2px 8px',
            background: `${borderColor}20`,
            border: `1px solid ${borderColor}40`,
            borderRadius: '6px',
            color: borderColor,
            fontSize: '10px',
            fontWeight: '600',
            textTransform: 'uppercase',
          }}>
            {FONTE_LABEL[tarefa.fonte]}
          </span>
          {tarefa.statusUnificado === 'em_andamento' && (
            <span style={{
              padding: '2px 8px',
              background: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '6px',
              color: '#3b82f6',
              fontSize: '10px',
              fontWeight: '600',
            }}>
              EM ANDAMENTO
            </span>
          )}
          {tarefa.statusUnificado === 'bloqueada' && (
            <span style={{
              padding: '2px 8px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '6px',
              color: '#ef4444',
              fontSize: '10px',
              fontWeight: '600',
            }}>
              BLOQUEADA
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {tarefa.clienteNome && (
            <span style={{ color: '#94a3b8', fontSize: compact ? '11px' : '12px' }}>
              {tarefa.clienteNome}
            </span>
          )}
          {tarefa.segmento && (
            <span style={{
              padding: '1px 6px',
              background: `${SEGMENTO_CORES[tarefa.segmento] || '#8b5cf6'}15`,
              borderRadius: '4px',
              color: SEGMENTO_CORES[tarefa.segmento] || '#8b5cf6',
              fontSize: '10px',
              fontWeight: '600',
            }}>
              {tarefa.segmento}
            </span>
          )}
          {tarefa.dataVencimento && !editingDate && (
            <span
              style={{ display: 'flex', alignItems: 'center', gap: '4px', color: tarefa.vencida ? '#ef4444' : '#64748b', fontSize: '11px' }}
              onClick={(e) => e.stopPropagation()}
            >
              <Clock style={{ width: '11px', height: '11px' }} />
              {tarefa.vencida
                ? `Atrasada ${tarefa.diasAtraso}d`
                : `Prazo: ${formatDate(tarefa.dataVencimento)}`}
              {canEditDate && (
                <button
                  onClick={(e) => { e.stopPropagation(); openDateEditor() }}
                  title="Alterar data"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
                    color: '#64748b', display: 'flex', alignItems: 'center',
                  }}
                >
                  <Calendar style={{ width: '11px', height: '11px' }} />
                </button>
              )}
            </span>
          )}
          {editingDate && (
            <span onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                type="date"
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
                disabled={savingDate}
                autoFocus
                style={{
                  padding: '2px 6px',
                  background: '#0f0a1f',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  borderRadius: '6px',
                  color: 'white',
                  fontSize: '11px',
                  outline: 'none',
                }}
              />
              <button
                onClick={saveDate}
                disabled={!dateValue || savingDate}
                title="Salvar"
                style={{
                  background: 'none', border: 'none', cursor: dateValue && !savingDate ? 'pointer' : 'not-allowed',
                  padding: '2px', color: '#10b981', display: 'flex', alignItems: 'center',
                  opacity: dateValue && !savingDate ? 1 : 0.4,
                }}
              >
                {savingDate
                  ? <Loader2 style={{ width: '12px', height: '12px', animation: 'spin 1s linear infinite' }} />
                  : <Check style={{ width: '12px', height: '12px' }} />}
              </button>
              <button
                onClick={() => setEditingDate(false)}
                disabled={savingDate}
                title="Cancelar"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '2px', color: '#ef4444', display: 'flex', alignItems: 'center',
                }}
              >
                <X style={{ width: '12px', height: '12px' }} />
              </button>
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
        {tarefa.acaoSugerida && (
          <button
            onClick={() => onPrimaryAction(tarefa)}
            disabled={updating}
            style={{
              padding: compact ? '6px 10px' : '8px 14px',
              background: tarefa.acaoSugerida.tipo === 'iniciar_ciclo'
                ? 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)'
                : 'rgba(6, 182, 212, 0.15)',
              border: tarefa.acaoSugerida.tipo === 'iniciar_ciclo'
                ? 'none'
                : '1px solid rgba(6, 182, 212, 0.3)',
              borderRadius: '8px',
              color: 'white',
              fontSize: '11px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Zap style={{ width: '14px', height: '14px' }} />
            {!compact && tarefa.acaoSugerida.label}
          </button>
        )}
        <button
          onClick={() => onAction(tarefa, 'concluida')}
          disabled={updating}
          title="Concluir"
          style={{
            padding: '6px 8px',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '8px',
            color: '#10b981',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Check style={{ width: '14px', height: '14px' }} />
        </button>

        {tarefa.statusUnificado === 'pendente' && (
          <button
            onClick={() => onAction(tarefa, 'em_andamento')}
            disabled={updating}
            title="Iniciar"
            style={{
              padding: '6px 8px',
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '8px',
              color: '#3b82f6',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Play style={{ width: '14px', height: '14px' }} />
          </button>
        )}

        <button
          onClick={() => onAction(tarefa, 'bloqueada')}
          disabled={updating || tarefa.statusUnificado === 'bloqueada'}
          title="Bloquear"
          style={{
            padding: '6px 8px',
            background: 'rgba(249, 115, 22, 0.1)',
            border: '1px solid rgba(249, 115, 22, 0.3)',
            borderRadius: '8px',
            color: '#f97316',
            cursor: tarefa.statusUnificado === 'bloqueada' ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            opacity: tarefa.statusUnificado === 'bloqueada' ? 0.4 : 1,
          }}
        >
          <AlertTriangle style={{ width: '14px', height: '14px' }} />
        </button>

        <button
          onClick={() => onAction(tarefa, 'ignorada')}
          disabled={updating}
          title="Ignorar"
          style={{
            padding: '6px 8px',
            background: 'rgba(100, 116, 139, 0.1)',
            border: '1px solid rgba(100, 116, 139, 0.3)',
            borderRadius: '8px',
            color: '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Ban style={{ width: '14px', height: '14px' }} />
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// KanbanColumn
// ============================================================================
function KanbanColumn({ title, count, color, tarefas, onAction, onPrimaryAction, updating, navigate, onDateChange }) {
  return (
    <div style={{
      flex: 1,
      background: 'rgba(30, 27, 75, 0.3)',
      border: '1px solid rgba(139, 92, 246, 0.15)',
      borderRadius: '12px',
      display: 'flex',
      flexDirection: 'column',
      minWidth: 0,
    }}>
      {/* Column header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid rgba(139, 92, 246, 0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ color: color, fontSize: '13px', fontWeight: '600' }}>{title}</span>
        <span style={{
          padding: '2px 8px',
          background: `${color}20`,
          borderRadius: '10px',
          color: color,
          fontSize: '11px',
          fontWeight: '700',
        }}>
          {count}
        </span>
      </div>

      {/* Cards */}
      <div style={{
        padding: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        overflowY: 'auto',
        flex: 1,
        maxHeight: 'calc(100vh - 340px)',
      }}>
        {tarefas.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px', color: '#64748b', fontSize: '12px' }}>
            Nenhuma tarefa
          </div>
        )}
        {tarefas.map(tarefa => (
          <TaskCard
            key={tarefa.id}
            tarefa={tarefa}
            onAction={onAction}
            onPrimaryAction={onPrimaryAction}
            updating={updating}
            navigate={navigate}
            onDateChange={onDateChange}
            compact
          />
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// ConfirmModal (with optional observation)
// ============================================================================
function ConfirmModal({ tarefa, status, onConfirm, onCancel, loading }) {
  const [observacao, setObservacao] = useState('')
  const labels = {
    concluida: { title: 'Concluir Tarefa', desc: 'Deseja marcar esta tarefa como concluida?', color: '#10b981' },
    em_andamento: { title: 'Iniciar Tarefa', desc: 'Deseja marcar esta tarefa como em andamento?', color: '#3b82f6' },
    bloqueada: { title: 'Bloquear Tarefa', desc: 'Deseja marcar esta tarefa como bloqueada?', color: '#f97316' },
  }
  const info = labels[status] || { title: 'Confirmar', desc: 'Confirmar acao?', color: '#8b5cf6' }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={onCancel}>
      <div style={{
        background: '#1a1033', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '16px',
        padding: '24px', width: '440px', maxWidth: '90vw',
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: '0 0 8px 0' }}>{info.title}</h3>
        <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 8px 0' }}>{info.desc}</p>
        <p style={{ color: '#c4b5fd', fontSize: '13px', margin: '0 0 16px 0' }}>
          {tarefa.titulo} — {tarefa.clienteNome}
        </p>

        <textarea
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="Observacao (opcional)..."
          rows={2}
          style={{
            width: '100%',
            padding: '10px 14px',
            background: '#0f0a1f',
            border: '1px solid rgba(139, 92, 246, 0.15)',
            borderRadius: '12px',
            color: 'white',
            fontSize: '13px',
            outline: 'none',
            resize: 'vertical',
            marginBottom: '16px',
            boxSizing: 'border-box',
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button onClick={onCancel} style={{
            padding: '10px 20px', background: 'rgba(100, 116, 139, 0.1)', border: '1px solid rgba(100, 116, 139, 0.3)',
            borderRadius: '10px', color: '#94a3b8', fontSize: '14px', fontWeight: '500', cursor: 'pointer',
          }}>
            Cancelar
          </button>
          <button onClick={() => onConfirm(observacao)} disabled={loading} style={{
            padding: '10px 20px', background: `${info.color}20`, border: `1px solid ${info.color}50`,
            borderRadius: '10px', color: info.color, fontSize: '14px', fontWeight: '600', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            {loading ? <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} /> : null}
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// IgnorarModal
// ============================================================================
function IgnorarModal({ tarefa, onConfirm, onCancel, loading }) {
  const [justificativa, setJustificativa] = useState('')
  const valid = justificativa.trim().length >= 10

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={onCancel}>
      <div style={{
        background: '#1a1033', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '16px',
        padding: '24px', width: '480px', maxWidth: '90vw',
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: '0 0 8px 0' }}>Ignorar Tarefa</h3>
        <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 4px 0' }}>
          Informe o motivo para ignorar esta tarefa.
        </p>
        <p style={{ color: '#c4b5fd', fontSize: '13px', margin: '0 0 16px 0' }}>
          {tarefa.titulo} — {tarefa.clienteNome}
        </p>

        <textarea
          value={justificativa}
          onChange={(e) => setJustificativa(e.target.value)}
          placeholder="Justificativa (minimo 10 caracteres)..."
          rows={3}
          style={{
            width: '100%',
            padding: '12px 16px',
            background: '#0f0a1f',
            border: `1px solid ${valid || justificativa.length === 0 ? 'rgba(139, 92, 246, 0.15)' : 'rgba(239, 68, 68, 0.5)'}`,
            borderRadius: '12px',
            color: 'white',
            fontSize: '14px',
            outline: 'none',
            resize: 'vertical',
            marginBottom: '4px',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <span style={{ color: justificativa.length > 0 && !valid ? '#ef4444' : '#64748b', fontSize: '11px' }}>
            {justificativa.trim().length}/10 caracteres
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button onClick={onCancel} style={{
            padding: '10px 20px', background: 'rgba(100, 116, 139, 0.1)', border: '1px solid rgba(100, 116, 139, 0.3)',
            borderRadius: '10px', color: '#94a3b8', fontSize: '14px', fontWeight: '500', cursor: 'pointer',
          }}>
            Cancelar
          </button>
          <button onClick={() => onConfirm(justificativa)} disabled={!valid || loading} style={{
            padding: '10px 20px', background: valid ? 'rgba(100, 116, 139, 0.2)' : 'rgba(100, 116, 139, 0.05)',
            border: '1px solid rgba(100, 116, 139, 0.3)', borderRadius: '10px',
            color: valid ? '#94a3b8' : '#475569', fontSize: '14px', fontWeight: '600',
            cursor: valid && !loading ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            {loading ? <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} /> : null}
            Ignorar
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// IniciarCicloModal
// ============================================================================
function IniciarCicloModal({ tarefa, onConfirm, onCancel, loading }) {
  const [cadencia, setCadencia] = useState('mensal')
  const segmento = tarefa.acaoSugerida?.segmento || 'ALERTA'
  const acoes = getSegmentoAcoes(segmento)

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={onCancel}>
      <div style={{
        background: '#1a1033', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '16px',
        padding: '24px', width: '520px', maxWidth: '90vw', maxHeight: '80vh', overflowY: 'auto',
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: '0 0 8px 0' }}>
          Iniciar Ciclo {segmento}
        </h3>
        <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 20px 0' }}>
          {tarefa.clienteNome}
        </p>

        {/* Acoes do segmento */}
        <div style={{ marginBottom: '16px' }}>
          <span style={{ color: '#64748b', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
            Acoes padrao ({acoes.length})
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {acoes.map((acao, i) => (
              <div key={i} style={{
                padding: '8px 12px',
                background: 'rgba(15, 10, 31, 0.6)',
                border: '1px solid rgba(139, 92, 246, 0.1)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <span style={{ color: '#c4b5fd', fontSize: '13px' }}>{acao.nome}</span>
                <span style={{ color: '#64748b', fontSize: '11px' }}>D+{acao.dias}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cadencia */}
        <div style={{ marginBottom: '20px' }}>
          <span style={{ color: '#64748b', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
            Cadencia
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['mensal', 'bimestral'].map(opt => (
              <button
                key={opt}
                onClick={() => setCadencia(opt)}
                style={{
                  padding: '8px 16px',
                  background: cadencia === opt ? 'rgba(139, 92, 246, 0.25)' : 'rgba(15, 10, 31, 0.6)',
                  border: cadencia === opt ? '1px solid rgba(139, 92, 246, 0.5)' : '1px solid rgba(139, 92, 246, 0.15)',
                  borderRadius: '8px',
                  color: cadencia === opt ? '#c4b5fd' : '#94a3b8',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                }}
              >
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button onClick={onCancel} style={{
            padding: '10px 20px', background: 'rgba(100, 116, 139, 0.1)', border: '1px solid rgba(100, 116, 139, 0.3)',
            borderRadius: '10px', color: '#94a3b8', fontSize: '14px', fontWeight: '500', cursor: 'pointer',
          }}>
            Cancelar
          </button>
          <button
            onClick={() => onConfirm({ segmento, cadencia, acoes })}
            disabled={loading}
            style={{
              padding: '10px 20px',
              background: loading ? 'rgba(139, 92, 246, 0.3)' : 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
              border: 'none',
              borderRadius: '10px', color: 'white', fontSize: '14px', fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            {loading ? <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} /> : <Zap style={{ width: '16px', height: '16px' }} />}
            Iniciar Ciclo
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// NovaTarefaModal
// ============================================================================
function NovaTarefaModal({ onConfirm, onCancel, loading, responsaveis, userEmail }) {
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [clienteNome, setClienteNome] = useState('')
  const [dataVencimento, setDataVencimento] = useState('')
  const [prioridade, setPrioridade] = useState('media')
  const [responsavelEmail, setResponsavelEmail] = useState(userEmail || '')
  const [clientes, setClientes] = useState([])
  const [buscaCliente, setBuscaCliente] = useState('')
  const [showClientes, setShowClientes] = useState(false)
  const clienteRef = useRef(null)

  useEffect(() => {
    fetchAllClientes().then(all => {
      setClientes(all.filter(c => c.status === 'ativo' || c.status === 'aviso_previo' || c.status === 'onboarding'))
    })
  }, [])

  useEffect(() => {
    if (!showClientes) return
    const handle = (e) => {
      if (clienteRef.current && !clienteRef.current.contains(e.target)) setShowClientes(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [showClientes])

  const clientesFiltrados = buscaCliente.trim()
    ? clientes.filter(c => (c.team_name || '').toLowerCase().includes(buscaCliente.toLowerCase()))
    : clientes

  const selectCliente = (c) => {
    setClienteId(c.id)
    setClienteNome(c.team_name || '')
    setBuscaCliente(c.team_name || '')
    setShowClientes(false)
  }

  const clearCliente = () => {
    setClienteId('')
    setClienteNome('')
    setBuscaCliente('')
  }

  const valid = titulo.trim().length >= 3

  const handleSubmit = () => {
    if (!valid) return
    onConfirm({
      titulo: titulo.trim(),
      descricao: descricao.trim(),
      cliente_id: clienteId || null,
      cliente_nome: clienteNome || null,
      data_vencimento: dataVencimento ? new Date(dataVencimento + 'T12:00:00') : null,
      prioridade,
      responsavel_email: responsavelEmail,
    })
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={onCancel}>
      <div style={{
        background: '#1a1033', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '16px',
        padding: '24px', width: '520px', maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto',
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
          Nova Tarefa
        </h3>

        {/* Titulo */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
            Titulo *
          </label>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex: Agendar call de alinhamento..."
            autoFocus
            style={{
              width: '100%', padding: '10px 14px', background: '#0f0a1f',
              border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '12px',
              color: 'white', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Descricao */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
            Descricao
          </label>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Detalhes da tarefa (opcional)..."
            rows={2}
            style={{
              width: '100%', padding: '10px 14px', background: '#0f0a1f',
              border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '12px',
              color: 'white', fontSize: '13px', outline: 'none', resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Cliente (searchable) */}
        <div style={{ marginBottom: '14px' }} ref={clienteRef}>
          <label style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
            Cliente
          </label>
          <div style={{ position: 'relative' }}>
            <input
              value={buscaCliente}
              onChange={(e) => { setBuscaCliente(e.target.value); setShowClientes(true); if (!e.target.value) clearCliente() }}
              onFocus={() => setShowClientes(true)}
              placeholder="Buscar cliente (opcional)..."
              style={{
                width: '100%', padding: '10px 14px', background: '#0f0a1f',
                border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '12px',
                color: 'white', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
              }}
            />
            {clienteId && (
              <button onClick={clearCliente} style={{
                position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: '#64748b',
                display: 'flex', alignItems: 'center',
              }}>
                <X style={{ width: '14px', height: '14px' }} />
              </button>
            )}
            {showClientes && clientesFiltrados.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px',
                background: '#1e1b4b', border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '10px', maxHeight: '160px', overflowY: 'auto', zIndex: 60,
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              }}>
                {clientesFiltrados.slice(0, 20).map(c => (
                  <div
                    key={c.id}
                    onClick={() => selectCliente(c)}
                    style={{
                      padding: '8px 14px', cursor: 'pointer', color: '#e2e8f0', fontSize: '13px',
                      borderBottom: '1px solid rgba(139, 92, 246, 0.08)',
                      background: clienteId === c.id ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                    }}
                  >
                    {c.team_name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Row: Data + Prioridade */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
              Prazo
            </label>
            <input
              type="date"
              value={dataVencimento}
              onChange={(e) => setDataVencimento(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', background: '#0f0a1f',
                border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '12px',
                color: 'white', fontSize: '13px', outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
              Prioridade
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[
                { value: 'baixa', label: 'Baixa', color: '#10b981' },
                { value: 'media', label: 'Media', color: '#f59e0b' },
                { value: 'alta', label: 'Alta', color: '#f97316' },
                { value: 'urgente', label: 'Urgente', color: '#ef4444' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setPrioridade(opt.value)}
                  style={{
                    flex: 1, padding: '8px 4px',
                    background: prioridade === opt.value ? `${opt.color}20` : 'rgba(15, 10, 31, 0.6)',
                    border: prioridade === opt.value ? `1px solid ${opt.color}50` : '1px solid rgba(139, 92, 246, 0.15)',
                    borderRadius: '8px',
                    color: prioridade === opt.value ? opt.color : '#64748b',
                    fontSize: '11px', fontWeight: '600', cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Responsavel */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
            Responsavel
          </label>
          <div style={{ position: 'relative' }}>
            <select
              value={responsavelEmail}
              onChange={(e) => setResponsavelEmail(e.target.value)}
              style={{
                width: '100%', appearance: 'none', padding: '10px 28px 10px 14px', background: '#0f0a1f',
                border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '12px',
                color: 'white', fontSize: '13px', outline: 'none', cursor: 'pointer',
              }}
            >
              {responsaveis.map(r => (
                <option key={r.id} value={r.email} style={{ background: '#1e1b4b' }}>
                  {r.email === userEmail ? `${r.nome} (Voce)` : r.nome}
                </option>
              ))}
            </select>
            <ChevronDown style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: '#8b5cf6', pointerEvents: 'none' }} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button onClick={onCancel} style={{
            padding: '10px 20px', background: 'rgba(100, 116, 139, 0.1)', border: '1px solid rgba(100, 116, 139, 0.3)',
            borderRadius: '10px', color: '#94a3b8', fontSize: '14px', fontWeight: '500', cursor: 'pointer',
          }}>
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={!valid || loading} style={{
            padding: '10px 20px',
            background: valid && !loading ? 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)' : 'rgba(139, 92, 246, 0.2)',
            border: 'none', borderRadius: '10px', color: 'white', fontSize: '14px', fontWeight: '600',
            cursor: valid && !loading ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            {loading ? <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} /> : <Plus style={{ width: '16px', height: '16px' }} />}
            Criar Tarefa
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// MinhasTarefas (Main Page)
// ============================================================================
export default function MinhasTarefas() {
  const toast = useToast()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [responsaveis, setResponsaveis] = useState([])
  const [selectedResponsavel, setSelectedResponsavel] = useState(null)

  // View mode
  const [viewMode, setViewMode] = useState('lista')

  // Fetch CS users for dropdown
  useEffect(() => {
    const load = async () => {
      try {
        const usuarios = await fetchUsuariosSistema()
        setResponsaveis(filterActiveCSUsers(usuarios))
        if (user?.email) setSelectedResponsavel(user.email)
      } catch (err) {
        console.error('Erro ao buscar responsaveis:', err)
        if (user?.email) setSelectedResponsavel(user.email)
      }
    }
    load()
  }, [user?.email])

  const { tarefas, loading, error, refetch, stats } = useMinhasTarefas(selectedResponsavel)

  // Filters
  const [filtros, setFiltros] = useState({ tipos: [], status: [], saude: [], busca: '' })

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)

  // Modal state
  const [confirmModal, setConfirmModal] = useState(null) // { tarefa, status }
  const [ignorarModal, setIgnorarModal] = useState(null) // tarefa
  const [cicloModal, setCicloModal] = useState(null) // tarefa (for IniciarCicloModal)
  const [novaTarefaModal, setNovaTarefaModal] = useState(false)
  const [updating, setUpdating] = useState(false)

  // Apply filters
  const tarefasFiltradas = useMemo(() => {
    let result = tarefas

    if (filtros.tipos.length > 0) {
      result = result.filter(t => filtros.tipos.includes(t.fonte))
    }

    if (filtros.status.length > 0) {
      result = result.filter(t => filtros.status.includes(t.statusUnificado))
    }

    if (filtros.saude.length > 0) {
      result = result.filter(t => t.segmento && filtros.saude.includes(t.segmento))
    }

    if (filtros.busca.trim()) {
      const search = filtros.busca.toLowerCase()
      result = result.filter(t =>
        (t.titulo || '').toLowerCase().includes(search) ||
        (t.clienteNome || '').toLowerCase().includes(search) ||
        (t.descricao || '').toLowerCase().includes(search)
      )
    }

    return result
  }, [tarefas, filtros])

  // Reset page when filters change
  const totalPages = Math.ceil(tarefasFiltradas.length / PAGE_SIZE)
  const paginatedTarefas = tarefasFiltradas.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  // Kanban columns
  const kanbanColumns = useMemo(() => ({
    pendente: tarefasFiltradas.filter(t => t.statusUnificado === 'pendente'),
    em_andamento: tarefasFiltradas.filter(t => t.statusUnificado === 'em_andamento'),
    bloqueada: tarefasFiltradas.filter(t => t.statusUnificado === 'bloqueada'),
  }), [tarefasFiltradas])

  // Reset to page 1 when filters change
  const handleSetFiltros = (newFiltros) => {
    if (typeof newFiltros === 'function') {
      setFiltros(prev => {
        const next = newFiltros(prev)
        setCurrentPage(1)
        return next
      })
    } else {
      setFiltros(newFiltros)
      setCurrentPage(1)
    }
  }

  // Handle action button clicks
  const handleAction = (tarefa, status) => {
    if (status === 'ignorada') {
      setIgnorarModal(tarefa)
    } else {
      setConfirmModal({ tarefa, status })
    }
  }

  // Execute status update
  const executeUpdate = async (tarefa, status, justificativa = '') => {
    setUpdating(true)
    try {
      await atualizarStatusTarefa(tarefa, status, user.email, justificativa)

      const labels = {
        concluida: 'concluida',
        em_andamento: 'iniciada',
        bloqueada: 'bloqueada',
        ignorada: 'ignorada',
      }
      toast.success(`Tarefa ${labels[status] || 'atualizada'} com sucesso!`)
      setConfirmModal(null)
      setIgnorarModal(null)
      refetch()
    } catch (err) {
      console.error('Erro ao atualizar tarefa:', err)
      toast.error(err.message || 'Erro ao atualizar tarefa')
    } finally {
      setUpdating(false)
    }
  }

  // Handle primary action button on alert tasks
  const handlePrimaryAction = (tarefa) => {
    if (!tarefa.acaoSugerida) return

    if (tarefa.acaoSugerida.tipo === 'iniciar_ciclo') {
      setCicloModal(tarefa)
    } else if (tarefa.acaoSugerida.tipo === 'ver_cliente') {
      if (tarefa.clienteId) {
        navigate(`/clientes/${tarefa.clienteId}`)
      }
    }
  }

  // Handle date change
  const handleDateChange = useCallback(async (tarefa, novaData) => {
    try {
      await atualizarDataTarefa(tarefa, novaData)
      toast.success('Data atualizada com sucesso!')
      refetch()
    } catch (err) {
      console.error('Erro ao atualizar data:', err)
      toast.error(err.message || 'Erro ao atualizar data')
    }
  }, [refetch, toast])

  // Execute ciclo creation from IniciarCicloModal
  const executeCiclo = async ({ segmento, cadencia, acoes }) => {
    if (!cicloModal) return
    setUpdating(true)
    try {
      await atribuirCiclo(cicloModal.clienteId, {
        segmento,
        cadencia,
        dataInicio: new Date(),
        acoes,
      })

      // Mark the alerta as resolved
      const alertaDocId = cicloModal.origemRef?.docId
      if (alertaDocId) {
        await updateAlerta(alertaDocId, {
          status: 'resolvido',
          resolved_at: new Date(),
          motivo_fechamento: `Ciclo ${segmento} iniciado via Minhas Tarefas`,
        })
      }

      toast.success(`Ciclo ${segmento} iniciado para ${cicloModal.clienteNome}!`)
      setCicloModal(null)
      refetch()
    } catch (err) {
      console.error('Erro ao iniciar ciclo:', err)
      toast.error(err.message || 'Erro ao iniciar ciclo')
    } finally {
      setUpdating(false)
    }
  }

  // Create a new manual task
  const handleCriarTarefa = async (data) => {
    setUpdating(true)
    try {
      await createTarefaManual({
        ...data,
        criado_por: user.email,
      })
      toast.success('Tarefa criada com sucesso!')
      setNovaTarefaModal(false)
      refetch()
    } catch (err) {
      console.error('Erro ao criar tarefa:', err)
      toast.error(err.message || 'Erro ao criar tarefa')
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f0a1f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '48px', height: '48px', border: '3px solid rgba(139, 92, 246, 0.2)', borderTopColor: '#8b5cf6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    )
  }

  return (
    <div style={{ padding: '32px', background: '#0f0a1f', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
            <ListTodo style={{ width: '28px', height: '28px', color: '#8b5cf6' }} />
            <h1 style={{ color: 'white', fontSize: '24px', fontWeight: '700', margin: 0 }}>
              {selectedResponsavel === 'todos' ? 'Todas as Tarefas' : selectedResponsavel === user?.email ? 'Minhas Tarefas' : 'Tarefas'}
            </h1>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>
            {stats.total} tarefa{stats.total !== 1 ? 's' : ''} pendente{stats.total !== 1 ? 's' : ''}
            {stats.vencidas > 0 && (
              <span style={{ color: '#ef4444', fontWeight: '600' }}> ({stats.vencidas} atrasada{stats.vencidas !== 1 ? 's' : ''})</span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* View toggle */}
          <div style={{
            display: 'flex',
            background: 'rgba(30, 27, 75, 0.6)',
            border: '1px solid rgba(139, 92, 246, 0.2)',
            borderRadius: '10px',
            overflow: 'hidden',
          }}>
            <button
              onClick={() => setViewMode('lista')}
              title="Lista"
              style={{
                padding: '8px 12px',
                background: viewMode === 'lista' ? 'rgba(139, 92, 246, 0.25)' : 'transparent',
                border: 'none',
                color: viewMode === 'lista' ? '#c4b5fd' : '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <LayoutList style={{ width: '18px', height: '18px' }} />
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              title="Kanban"
              style={{
                padding: '8px 12px',
                background: viewMode === 'kanban' ? 'rgba(139, 92, 246, 0.25)' : 'transparent',
                border: 'none',
                color: viewMode === 'kanban' ? '#c4b5fd' : '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Columns3 style={{ width: '18px', height: '18px' }} />
            </button>
          </div>

          <button
            onClick={() => setNovaTarefaModal(true)}
            style={{
              padding: '10px 16px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
              border: 'none',
              borderRadius: '10px',
              color: 'white',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 16px rgba(139, 92, 246, 0.3)',
            }}
          >
            <Plus style={{ width: '14px', height: '14px' }} />
            Nova Tarefa
          </button>

          <button
            onClick={refetch}
            style={{
              padding: '10px 16px',
              background: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '10px',
              color: '#a78bfa',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <RefreshCw style={{ width: '14px', height: '14px' }} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Filters FIRST */}
      <FilterBar
        filtros={filtros}
        setFiltros={handleSetFiltros}
        responsaveis={responsaveis}
        selectedResponsavel={selectedResponsavel}
        onResponsavelChange={setSelectedResponsavel}
        userEmail={user?.email}
      />

      {/* Stats SECOND */}
      <StatsBar stats={stats} />

      {/* Error */}
      {error && (
        <div style={{
          padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '12px', marginBottom: '16px', color: '#ef4444', fontSize: '13px',
        }}>
          Erro ao carregar tarefas: {error}
        </div>
      )}

      {/* Task List / Kanban */}
      {tarefasFiltradas.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px',
        }}>
          <ListTodo style={{ width: '48px', height: '48px', color: '#3730a3', margin: '0 auto 16px' }} />
          <h3 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: '0 0 8px 0' }}>
            {tarefas.length === 0 ? 'Nenhuma tarefa pendente' : 'Nenhuma tarefa encontrada'}
          </h3>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
            {tarefas.length === 0
              ? 'Todas as suas tarefas estao em dia!'
              : 'Tente ajustar os filtros para encontrar a tarefa desejada.'}
          </p>
        </div>
      ) : viewMode === 'kanban' ? (
        /* Kanban View */
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          <KanbanColumn
            title="Pendente"
            count={kanbanColumns.pendente.length}
            color="#f59e0b"
            tarefas={kanbanColumns.pendente}
            onAction={handleAction}
            onPrimaryAction={handlePrimaryAction}
            updating={updating}
            navigate={navigate}
            onDateChange={handleDateChange}
          />
          <KanbanColumn
            title="Em Andamento"
            count={kanbanColumns.em_andamento.length}
            color="#3b82f6"
            tarefas={kanbanColumns.em_andamento}
            onAction={handleAction}
            onPrimaryAction={handlePrimaryAction}
            updating={updating}
            navigate={navigate}
            onDateChange={handleDateChange}
          />
          <KanbanColumn
            title="Bloqueada"
            count={kanbanColumns.bloqueada.length}
            color="#ef4444"
            tarefas={kanbanColumns.bloqueada}
            onAction={handleAction}
            onPrimaryAction={handlePrimaryAction}
            updating={updating}
            navigate={navigate}
            onDateChange={handleDateChange}
          />
        </div>
      ) : (
        /* List View */
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
            {paginatedTarefas.map(tarefa => (
              <TaskCard
                key={tarefa.id}
                tarefa={tarefa}
                onAction={handleAction}
                onPrimaryAction={handlePrimaryAction}
                updating={updating}
                navigate={navigate}
                onDateChange={handleDateChange}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={tarefasFiltradas.length}
              pageSize={PAGE_SIZE}
            />
          )}
        </>
      )}

      {/* Confirm Modal */}
      {confirmModal && (
        <ConfirmModal
          tarefa={confirmModal.tarefa}
          status={confirmModal.status}
          onConfirm={(obs) => executeUpdate(confirmModal.tarefa, confirmModal.status, obs)}
          onCancel={() => setConfirmModal(null)}
          loading={updating}
        />
      )}

      {/* Ignorar Modal */}
      {ignorarModal && (
        <IgnorarModal
          tarefa={ignorarModal}
          onConfirm={(justificativa) => executeUpdate(ignorarModal, 'ignorada', justificativa)}
          onCancel={() => setIgnorarModal(null)}
          loading={updating}
        />
      )}

      {/* Iniciar Ciclo Modal */}
      {cicloModal && (
        <IniciarCicloModal
          tarefa={cicloModal}
          onConfirm={executeCiclo}
          onCancel={() => setCicloModal(null)}
          loading={updating}
        />
      )}

      {/* Nova Tarefa Modal */}
      {novaTarefaModal && (
        <NovaTarefaModal
          onConfirm={handleCriarTarefa}
          onCancel={() => setNovaTarefaModal(false)}
          loading={updating}
          responsaveis={responsaveis}
          userEmail={user?.email}
        />
      )}
    </div>
  )
}
