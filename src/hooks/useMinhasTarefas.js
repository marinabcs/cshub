/**
 * useMinhasTarefas.js - Hook de agregação para "Minhas Tarefas"
 *
 * Fetches tasks from Ongoing, Playbooks, and Alertas for the logged-in user,
 * normalizes them to a unified format, and sorts by urgency.
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  fetchAllClientes,
  fetchOngoingCiclosBatch,
  fetchPlaybooksAtivosBatch,
  fetchAlertasAtivosDoResponsavel,
  fetchAlertasAtivosByClienteIds,
  fetchTarefasManuaisDoResponsavel,
  fetchTarefasManuaisAtivas,
} from '../services/dataAccess'

// Mapeamento segmento → prioridade derivada
const SEGMENTO_PRIORIDADE = {
  RESGATE: 'urgente',
  ALERTA: 'alta',
  ESTAVEL: 'media',
  CRESCIMENTO: 'baixa',
}

// Legacy segment map
const LEGACY_SEGMENT_MAP = {
  RESCUE: 'RESGATE',
  WATCH: 'ALERTA',
  NURTURE: 'ESTAVEL',
  GROW: 'CRESCIMENTO',
}

function normalizeSegmento(seg) {
  if (!seg) return 'ESTAVEL'
  const upper = seg.toUpperCase()
  return LEGACY_SEGMENT_MAP[upper] || upper
}

// Ordem de prioridade para sort
const PRIORIDADE_ORDEM = { urgente: 0, alta: 1, media: 2, baixa: 3 }

/**
 * Parse a date that may be a Firestore Timestamp, JS Date, or string.
 */
function parseDate(val) {
  if (!val) return null
  if (val.toDate) return val.toDate()
  if (val instanceof Date) return val
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d
}

/**
 * Calculate days overdue (positive = overdue, negative = days remaining).
 */
function calcDiasAtraso(dataVencimento) {
  if (!dataVencimento) return { vencida: false, diasAtraso: 0 }
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const venc = new Date(dataVencimento)
  venc.setHours(0, 0, 0, 0)
  const diff = Math.floor((now - venc) / (1000 * 60 * 60 * 24))
  return { vencida: diff > 0, diasAtraso: diff }
}

/**
 * Normalize an Ongoing action to the unified task format.
 */
function normalizeOngoing(acao, index, ciclo, cliente) {
  const segmento = normalizeSegmento(cliente.segmento_cs)
  const dataVenc = parseDate(acao.data_vencimento)
  const { vencida, diasAtraso } = calcDiasAtraso(dataVenc)

  // Map ongoing statuses to unified
  let statusUnificado = 'pendente'
  if (acao.status === 'concluida') statusUnificado = 'concluida'
  else if (acao.status === 'pulada') statusUnificado = 'ignorada'
  else if (acao.status === 'em_andamento') statusUnificado = 'em_andamento'
  else if (acao.status === 'bloqueada') statusUnificado = 'bloqueada'

  return {
    id: `ongoing:${cliente.id}:${ciclo.id}:${index}`,
    fonte: 'ongoing',
    clienteId: cliente.id,
    clienteNome: cliente.team_name || cliente.nome || '',
    segmento,
    titulo: acao.nome || 'Ação sem nome',
    descricao: acao.descricao || '',
    dataVencimento: dataVenc,
    vencida,
    diasAtraso,
    statusUnificado,
    statusOriginal: acao.status,
    prioridade: SEGMENTO_PRIORIDADE[segmento] || 'media',
    origemRef: {
      clienteId: cliente.id,
      cicloId: ciclo.id,
      index,
    },
    observacoes: acao.observacoes || '',
    concluidaEm: parseDate(acao.concluida_em),
    concluidaPor: acao.concluida_por || null,
  }
}

/**
 * Normalize a Playbook etapa to the unified task format.
 */
function normalizePlaybook(etapa, playbook, cliente) {
  const segmento = normalizeSegmento(cliente.segmento_cs)
  const dataVenc = parseDate(etapa.prazo_data)
  const { vencida, diasAtraso } = calcDiasAtraso(dataVenc)

  let statusUnificado = 'pendente'
  if (etapa.status === 'concluida') statusUnificado = 'concluida'
  else if (etapa.status === 'pulada') statusUnificado = 'ignorada'
  else if (etapa.status === 'em_andamento') statusUnificado = 'em_andamento'
  else if (etapa.status === 'bloqueada') statusUnificado = 'bloqueada'

  return {
    id: `playbook:${cliente.id}:${playbook.id}:${etapa.ordem}`,
    fonte: 'playbook',
    clienteId: cliente.id,
    clienteNome: cliente.team_name || cliente.nome || '',
    segmento,
    titulo: etapa.nome || `Etapa ${etapa.ordem}`,
    descricao: etapa.descricao || playbook.playbook_nome || '',
    dataVencimento: dataVenc,
    vencida,
    diasAtraso,
    statusUnificado,
    statusOriginal: etapa.status,
    prioridade: SEGMENTO_PRIORIDADE[segmento] || 'media',
    origemRef: {
      clienteId: cliente.id,
      playbookId: playbook.id,
      ordem: etapa.ordem,
    },
    observacoes: etapa.observacoes || '',
    concluidaEm: parseDate(etapa.concluida_em),
    concluidaPor: etapa.concluida_por || null,
  }
}

/**
 * Build action-oriented title and acaoSugerida for an alerta based on its type.
 */
function buildAlertaTituloEAcao(alerta) {
  const clienteNome = alerta.cliente_nome || alerta.time_name || 'Cliente'
  const assunto = alerta.assunto || alerta.titulo || ''
  const tipo = alerta.tipo

  switch (tipo) {
    case 'entrou_resgate':
      return {
        titulo: `${clienteNome} entrou em RESGATE — Iniciar ciclo de recuperação`,
        acaoSugerida: { tipo: 'iniciar_ciclo', label: 'Iniciar Ciclo Resgate', segmento: 'RESGATE' },
      }
    case 'carencia_playbook':
      return {
        titulo: `${clienteNome} não recuperou após 7 dias — Iniciar playbook ${alerta.segmento_sugerido || ''}`.trim(),
        acaoSugerida: { tipo: 'iniciar_ciclo', label: 'Iniciar Playbook', segmento: alerta.segmento_sugerido || 'ALERTA' },
      }
    case 'carencia_comunicacao':
      return {
        titulo: `${clienteNome} caiu de nível — Comunicar durante carência`,
        acaoSugerida: { tipo: 'ver_cliente', label: 'Ver Cliente' },
      }
    case 'sentimento_negativo':
      return {
        titulo: `Thread negativa — ${clienteNome}: ${assunto}`,
        acaoSugerida: { tipo: 'ver_cliente', label: 'Ver Thread' },
      }
    case 'problema_reclamacao':
      return {
        titulo: `Reclamação reportada — ${clienteNome}: ${assunto}`,
        acaoSugerida: { tipo: 'ver_cliente', label: 'Ver Reclamação' },
      }
    default:
      return {
        titulo: alerta.titulo || 'Alerta',
        acaoSugerida: null,
      }
  }
}

/**
 * Normalize an Alerta to the unified task format.
 */
function normalizeAlerta(alerta) {
  const dataVenc = parseDate(alerta.created_at)
  // Alertas don't have explicit due dates, use creation + 3 days as reference
  let dataVencimento = null
  if (dataVenc) {
    dataVencimento = new Date(dataVenc)
    dataVencimento.setDate(dataVencimento.getDate() + 3)
  }
  const { vencida, diasAtraso } = calcDiasAtraso(dataVencimento)

  let statusUnificado = 'pendente'
  if (alerta.status === 'em_andamento') statusUnificado = 'em_andamento'
  else if (alerta.status === 'bloqueado') statusUnificado = 'bloqueada'
  else if (alerta.status === 'resolvido') statusUnificado = 'concluida'
  else if (alerta.status === 'ignorado') statusUnificado = 'ignorada'

  const { titulo, acaoSugerida } = buildAlertaTituloEAcao(alerta)

  return {
    id: `alerta:${alerta.id}`,
    fonte: 'alerta',
    clienteId: alerta.cliente_id || null,
    clienteNome: alerta.cliente_nome || alerta.time_name || '',
    segmento: null,
    titulo,
    descricao: alerta.mensagem || '',
    dataVencimento,
    vencida,
    diasAtraso,
    statusUnificado,
    statusOriginal: alerta.status,
    prioridade: alerta.prioridade || 'media',
    origemRef: {
      docId: alerta.id,
    },
    observacoes: alerta.notas || '',
    concluidaEm: parseDate(alerta.resolved_at),
    concluidaPor: null,
    acaoSugerida,
    alertaTipo: alerta.tipo || null,
    thread_id: alerta.thread_id || null,
  }
}

/**
 * Normalize a manual task to the unified task format.
 */
function normalizeManual(tarefa) {
  const dataVenc = parseDate(tarefa.data_vencimento)
  const { vencida, diasAtraso } = calcDiasAtraso(dataVenc)

  let statusUnificado = 'pendente'
  if (tarefa.status === 'em_andamento') statusUnificado = 'em_andamento'
  else if (tarefa.status === 'bloqueada') statusUnificado = 'bloqueada'
  else if (tarefa.status === 'concluida') statusUnificado = 'concluida'
  else if (tarefa.status === 'ignorada') statusUnificado = 'ignorada'

  return {
    id: `manual:${tarefa.id}`,
    fonte: 'manual',
    clienteId: tarefa.cliente_id || null,
    clienteNome: tarefa.cliente_nome || '',
    segmento: null,
    titulo: tarefa.titulo || 'Tarefa sem titulo',
    descricao: tarefa.descricao || '',
    dataVencimento: dataVenc,
    vencida,
    diasAtraso,
    statusUnificado,
    statusOriginal: tarefa.status,
    prioridade: tarefa.prioridade || 'media',
    origemRef: { docId: tarefa.id },
    observacoes: tarefa.observacoes || '',
    concluidaEm: parseDate(tarefa.concluida_em),
    concluidaPor: tarefa.concluida_por || null,
  }
}

/**
 * Sort tasks: overdue first (most overdue on top), then by nearest deadline, then by priority.
 */
function sortTarefas(a, b) {
  // Overdue first
  if (a.vencida && !b.vencida) return -1
  if (!a.vencida && b.vencida) return 1

  // Both overdue: most overdue first
  if (a.vencida && b.vencida) {
    if (a.diasAtraso !== b.diasAtraso) return b.diasAtraso - a.diasAtraso
  }

  // Neither overdue: nearest deadline first
  if (!a.vencida && !b.vencida) {
    if (a.dataVencimento && b.dataVencimento) {
      const diff = a.dataVencimento.getTime() - b.dataVencimento.getTime()
      if (diff !== 0) return diff
    }
    if (a.dataVencimento && !b.dataVencimento) return -1
    if (!a.dataVencimento && b.dataVencimento) return 1
  }

  // Same deadline bucket: sort by priority
  const prioA = PRIORIDADE_ORDEM[a.prioridade] ?? 2
  const prioB = PRIORIDADE_ORDEM[b.prioridade] ?? 2
  return prioA - prioB
}

export default function useMinhasTarefas(responsavelEmail) {
  const { user } = useAuth()
  const [tarefas, setTarefas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Use the override email if provided, otherwise default to logged-in user
  const targetEmail = responsavelEmail || user?.email

  const fetchTarefas = useCallback(async () => {
    if (!targetEmail) {
      setTarefas([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // 1. Fetch all clientes and filter by responsibility
      const allClientes = await fetchAllClientes()
      const isTodos = targetEmail === 'todos'
      const meusClientes = isTodos
        ? allClientes.filter(c => c.status === 'ativo' || c.status === 'aviso_previo' || c.status === 'onboarding')
        : allClientes.filter(c => {
          if (c.responsaveis && Array.isArray(c.responsaveis)) {
            return c.responsaveis.some(r => r.email === targetEmail)
          }
          return c.responsavel_email === targetEmail
        })

      const clienteIds = meusClientes.map(c => c.id)
      const clienteMap = {}
      for (const c of meusClientes) {
        clienteMap[c.id] = c
      }

      // 2. Fetch from all 3 sources in parallel
      // Fetch alertas from both responsavel_email AND cliente_id to support
      // clients with multiple responsaveis (alertas only store first responsavel_email)
      const alertasByEmailFetch = isTodos
        ? Promise.resolve([])
        : fetchAlertasAtivosDoResponsavel(targetEmail)
      const alertasByClienteFetch = clienteIds.length > 0
        ? fetchAlertasAtivosByClienteIds(clienteIds)
        : Promise.resolve([])
      const manuaisFetch = isTodos
        ? fetchTarefasManuaisAtivas()
        : fetchTarefasManuaisDoResponsavel(targetEmail)

      const [ongoingResults, playbookResults, alertasByEmail, alertasByCliente, manuais] = await Promise.all([
        fetchOngoingCiclosBatch(clienteIds),
        fetchPlaybooksAtivosBatch(clienteIds),
        alertasByEmailFetch,
        alertasByClienteFetch,
        manuaisFetch,
      ])

      // Merge and deduplicate alertas
      const alertasMap = new Map()
      for (const a of alertasByEmail) alertasMap.set(a.id, a)
      for (const a of alertasByCliente) {
        if (!alertasMap.has(a.id)) alertasMap.set(a.id, a)
      }
      const alertas = Array.from(alertasMap.values())

      const unified = []

      // 3. Normalize Ongoing
      for (const { clienteId, ciclos } of ongoingResults) {
        const cliente = clienteMap[clienteId]
        if (!cliente) continue
        for (const ciclo of ciclos) {
          if (!ciclo.acoes) continue
          ciclo.acoes.forEach((acao, index) => {
            unified.push(normalizeOngoing(acao, index, ciclo, cliente))
          })
        }
      }

      // 4. Normalize Playbooks
      for (const { clienteId, playbooks } of playbookResults) {
        const cliente = clienteMap[clienteId]
        if (!cliente) continue
        for (const playbook of playbooks) {
          if (!playbook.etapas) continue
          for (const etapa of playbook.etapas) {
            unified.push(normalizePlaybook(etapa, playbook, cliente))
          }
        }
      }

      // 5. Normalize Alertas
      for (const alerta of alertas) {
        unified.push(normalizeAlerta(alerta))
      }

      // 6. Normalize Manual tasks
      for (const tarefa of manuais) {
        unified.push(normalizeManual(tarefa))
      }

      // 7. Filter: only pending/in-progress/blocked (not completed/ignored)
      const active = unified.filter(t =>
        t.statusUnificado === 'pendente' ||
        t.statusUnificado === 'em_andamento' ||
        t.statusUnificado === 'bloqueada'
      )

      // 8. Sort
      active.sort(sortTarefas)

      setTarefas(active)
    } catch (err) {
      console.error('Erro ao carregar tarefas:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [targetEmail])

  useEffect(() => {
    fetchTarefas()
  }, [fetchTarefas])

  // Compute stats
  const stats = {
    pendentes: tarefas.filter(t => t.statusUnificado === 'pendente').length,
    emAndamento: tarefas.filter(t => t.statusUnificado === 'em_andamento').length,
    vencidas: tarefas.filter(t => t.vencida).length,
    total: tarefas.length,
  }

  return { tarefas, loading, error, refetch: fetchTarefas, stats }
}
