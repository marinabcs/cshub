import { useState, useMemo } from 'react'
import { ListTodo, RefreshCw, ListChecks, Bell, Clock, AlertTriangle, Search, X, Check, Play, Ban, Loader2 } from 'lucide-react'
import useMinhasTarefas from '../hooks/useMinhasTarefas'
import { atualizarStatusTarefa } from '../services/tarefasWriteBack'
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

// ── Ícone por fonte ─────────────────────────────────────────────────────────
const FONTE_ICON = {
  ongoing: RefreshCw,
  playbook: ListChecks,
  alerta: Bell,
}

const FONTE_LABEL = {
  ongoing: 'Ongoing',
  playbook: 'Playbook',
  alerta: 'Alerta',
}

const SAUDE_OPTIONS = ['CRESCIMENTO', 'ESTAVEL', 'ALERTA', 'RESGATE']
const TIPO_OPTIONS = ['ongoing', 'playbook', 'alerta']
const STATUS_OPTIONS = ['pendente', 'em_andamento', 'bloqueada']
const STATUS_LABELS = {
  pendente: 'Pendente',
  em_andamento: 'Em Andamento',
  bloqueada: 'Bloqueada',
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
// FilterBar
// ============================================================================
function FilterBar({ filtros, setFiltros }) {
  const { tipos, status, saude, busca } = filtros

  const toggleFilter = (key, value) => {
    setFiltros(prev => {
      const current = prev[key]
      const next = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value]
      return { ...prev, [key]: next }
    })
  }

  const hasFilters = tipos.length > 0 || status.length > 0 || saude.length > 0 || busca.length > 0

  const chipStyle = (active) => ({
    padding: '6px 12px',
    background: active ? 'rgba(139, 92, 246, 0.25)' : 'rgba(15, 10, 31, 0.6)',
    border: active ? '1px solid rgba(139, 92, 246, 0.5)' : '1px solid rgba(139, 92, 246, 0.15)',
    borderRadius: '8px',
    color: active ? '#c4b5fd' : '#94a3b8',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
  })

  return (
    <div style={{
      background: 'rgba(30, 27, 75, 0.4)',
      border: '1px solid rgba(139, 92, 246, 0.15)',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        {/* Tipo */}
        <span style={{ color: '#64748b', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>Tipo:</span>
        {TIPO_OPTIONS.map(t => (
          <button key={t} onClick={() => toggleFilter('tipos', t)} style={chipStyle(tipos.includes(t))}>
            {FONTE_LABEL[t]}
          </button>
        ))}

        <div style={{ width: '1px', height: '24px', background: 'rgba(139, 92, 246, 0.15)' }} />

        {/* Status */}
        <span style={{ color: '#64748b', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>Status:</span>
        {STATUS_OPTIONS.map(s => (
          <button key={s} onClick={() => toggleFilter('status', s)} style={chipStyle(status.includes(s))}>
            {STATUS_LABELS[s]}
          </button>
        ))}

        <div style={{ width: '1px', height: '24px', background: 'rgba(139, 92, 246, 0.15)' }} />

        {/* Saúde */}
        <span style={{ color: '#64748b', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>Saúde:</span>
        {SAUDE_OPTIONS.map(s => (
          <button key={s} onClick={() => toggleFilter('saude', s)} style={{
            ...chipStyle(saude.includes(s)),
            borderColor: saude.includes(s) ? SEGMENTO_CORES[s] : 'rgba(139, 92, 246, 0.15)',
            color: saude.includes(s) ? SEGMENTO_CORES[s] : '#94a3b8',
          }}>
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Busca */}
        <div style={{ flex: 1, position: 'relative' }}>
          <Search style={{ width: '16px', height: '16px', color: '#64748b', position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Buscar cliente ou tarefa..."
            value={busca}
            onChange={(e) => setFiltros(prev => ({ ...prev, busca: e.target.value }))}
            style={{
              width: '100%',
              padding: '10px 12px 10px 36px',
              background: '#0f0a1f',
              border: '1px solid rgba(139, 92, 246, 0.15)',
              borderRadius: '8px',
              color: 'white',
              fontSize: '13px',
              outline: 'none',
            }}
          />
        </div>

        {hasFilters && (
          <button
            onClick={() => setFiltros({ tipos: [], status: [], saude: [], busca: '' })}
            style={{
              padding: '8px 14px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '8px',
              color: '#ef4444',
              fontSize: '12px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <X style={{ width: '12px', height: '12px' }} />
            Limpar
          </button>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// TaskCard
// ============================================================================
function TaskCard({ tarefa, onAction, updating }) {
  const IconeFonte = FONTE_ICON[tarefa.fonte] || RefreshCw

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

  return (
    <div style={{
      background: 'rgba(30, 27, 75, 0.4)',
      border: '1px solid rgba(139, 92, 246, 0.15)',
      borderLeft: `4px solid ${borderColor}`,
      borderRadius: '12px',
      padding: '16px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
    }}>
      {/* Icon */}
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

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
          <span style={{ color: 'white', fontSize: '14px', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }}>
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
            <span style={{ color: '#94a3b8', fontSize: '12px' }}>
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
          {tarefa.dataVencimento && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: tarefa.vencida ? '#ef4444' : '#64748b', fontSize: '11px' }}>
              <Clock style={{ width: '11px', height: '11px' }} />
              {tarefa.vencida
                ? `Atrasada ${tarefa.diasAtraso}d`
                : `Prazo: ${formatDate(tarefa.dataVencimento)}`}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
        <button
          onClick={() => onAction(tarefa, 'concluida')}
          disabled={updating}
          title="Concluir"
          style={{
            padding: '8px 12px',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '8px',
            color: '#10b981',
            fontSize: '11px',
            fontWeight: '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <Check style={{ width: '14px', height: '14px' }} />
          Concluir
        </button>

        {tarefa.statusUnificado === 'pendente' && (
          <button
            onClick={() => onAction(tarefa, 'em_andamento')}
            disabled={updating}
            title="Em Andamento"
            style={{
              padding: '8px 12px',
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '8px',
              color: '#3b82f6',
              fontSize: '11px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Play style={{ width: '14px', height: '14px' }} />
            Iniciar
          </button>
        )}

        <button
          onClick={() => onAction(tarefa, 'bloqueada')}
          disabled={updating || tarefa.statusUnificado === 'bloqueada'}
          title="Bloquear"
          style={{
            padding: '8px 12px',
            background: 'rgba(249, 115, 22, 0.1)',
            border: '1px solid rgba(249, 115, 22, 0.3)',
            borderRadius: '8px',
            color: '#f97316',
            fontSize: '11px',
            fontWeight: '500',
            cursor: tarefa.statusUnificado === 'bloqueada' ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            opacity: tarefa.statusUnificado === 'bloqueada' ? 0.4 : 1,
          }}
        >
          <AlertTriangle style={{ width: '14px', height: '14px' }} />
          Bloquear
        </button>

        <button
          onClick={() => onAction(tarefa, 'ignorada')}
          disabled={updating}
          title="Ignorar"
          style={{
            padding: '8px 12px',
            background: 'rgba(100, 116, 139, 0.1)',
            border: '1px solid rgba(100, 116, 139, 0.3)',
            borderRadius: '8px',
            color: '#64748b',
            fontSize: '11px',
            fontWeight: '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <Ban style={{ width: '14px', height: '14px' }} />
          Ignorar
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// ConfirmModal
// ============================================================================
function ConfirmModal({ tarefa, status, onConfirm, onCancel, loading }) {
  const labels = {
    concluida: { title: 'Concluir Tarefa', desc: 'Deseja marcar esta tarefa como concluída?', color: '#10b981' },
    em_andamento: { title: 'Iniciar Tarefa', desc: 'Deseja marcar esta tarefa como em andamento?', color: '#3b82f6' },
    bloqueada: { title: 'Bloquear Tarefa', desc: 'Deseja marcar esta tarefa como bloqueada?', color: '#f97316' },
  }
  const info = labels[status] || { title: 'Confirmar', desc: 'Confirmar ação?', color: '#8b5cf6' }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={onCancel}>
      <div style={{
        background: '#1a1033', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '16px',
        padding: '24px', width: '400px', maxWidth: '90vw',
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: '0 0 8px 0' }}>{info.title}</h3>
        <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 8px 0' }}>{info.desc}</p>
        <p style={{ color: '#c4b5fd', fontSize: '13px', margin: '0 0 20px 0' }}>
          {tarefa.titulo} — {tarefa.clienteNome}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button onClick={onCancel} style={{
            padding: '10px 20px', background: 'rgba(100, 116, 139, 0.1)', border: '1px solid rgba(100, 116, 139, 0.3)',
            borderRadius: '10px', color: '#94a3b8', fontSize: '14px', fontWeight: '500', cursor: 'pointer',
          }}>
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={loading} style={{
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
          placeholder="Justificativa (mínimo 10 caracteres)..."
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
// MinhasTarefas (Main Page)
// ============================================================================
export default function MinhasTarefas() {
  const toast = useToast()
  const { user } = useAuth()
  const { tarefas, loading, error, refetch, stats } = useMinhasTarefas()

  // Filters
  const [filtros, setFiltros] = useState({ tipos: [], status: [], saude: [], busca: '' })

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)

  // Modal state
  const [confirmModal, setConfirmModal] = useState(null) // { tarefa, status }
  const [ignorarModal, setIgnorarModal] = useState(null) // tarefa
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

  // Reset to page 1 when filters change
  const handleSetFiltros = (newFiltros) => {
    setFiltros(newFiltros)
    setCurrentPage(1)
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
        concluida: 'concluída',
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
            <h1 style={{ color: 'white', fontSize: '24px', fontWeight: '700', margin: 0 }}>Minhas Tarefas</h1>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>
            {stats.total} tarefa{stats.total !== 1 ? 's' : ''} pendente{stats.total !== 1 ? 's' : ''}
            {stats.vencidas > 0 && (
              <span style={{ color: '#ef4444', fontWeight: '600' }}> ({stats.vencidas} atrasada{stats.vencidas !== 1 ? 's' : ''})</span>
            )}
          </p>
        </div>
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

      {/* Stats */}
      <StatsBar stats={stats} />

      {/* Filters */}
      <FilterBar filtros={filtros} setFiltros={handleSetFiltros} />

      {/* Error */}
      {error && (
        <div style={{
          padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '12px', marginBottom: '16px', color: '#ef4444', fontSize: '13px',
        }}>
          Erro ao carregar tarefas: {error}
        </div>
      )}

      {/* Task List */}
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
              ? 'Todas as suas tarefas estão em dia!'
              : 'Tente ajustar os filtros para encontrar a tarefa desejada.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
          {paginatedTarefas.map(tarefa => (
            <TaskCard key={tarefa.id} tarefa={tarefa} onAction={handleAction} updating={updating} />
          ))}
        </div>
      )}

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

      {/* Confirm Modal */}
      {confirmModal && (
        <ConfirmModal
          tarefa={confirmModal.tarefa}
          status={confirmModal.status}
          onConfirm={() => executeUpdate(confirmModal.tarefa, confirmModal.status)}
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
    </div>
  )
}
