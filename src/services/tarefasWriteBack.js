/**
 * tarefasWriteBack.js - Write-back service for "Minhas Tarefas"
 *
 * Maps unified task status back to the original source (Ongoing, Playbook, Alerta)
 * and calls the appropriate update function.
 */

import { atualizarAcao } from './ongoing'
import { atualizarEtapa } from './playbooks'
import { updateAlerta, updateTarefaManual } from './dataAccess'
import { Timestamp } from 'firebase/firestore'
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from './firebase'

// Status unificado → status por fonte
const STATUS_MAP = {
  ongoing: {
    pendente: 'pendente',
    em_andamento: 'em_andamento',
    concluida: 'concluida',
    bloqueada: 'bloqueada',
    ignorada: 'pulada',
  },
  playbook: {
    pendente: 'pendente',
    em_andamento: 'em_andamento',
    concluida: 'concluida',
    bloqueada: 'bloqueada',
    ignorada: 'pulada',
  },
  alerta: {
    pendente: 'pendente',
    em_andamento: 'em_andamento',
    concluida: 'resolvido',
    bloqueada: 'bloqueado',
    ignorada: 'ignorado',
  },
  manual: {
    pendente: 'pendente',
    em_andamento: 'em_andamento',
    concluida: 'concluida',
    bloqueada: 'bloqueada',
    ignorada: 'ignorada',
  },
}

/**
 * Update a task's status, routing to the correct source service.
 *
 * @param {Object} tarefa - unified task object from useMinhasTarefas
 * @param {string} novoStatus - one of: pendente, em_andamento, concluida, bloqueada, ignorada
 * @param {string} userEmail - email of the user performing the action
 * @param {string} [justificativa] - required when novoStatus is 'ignorada'
 * @returns {Promise<Object>} - result from the source update
 */
export async function atualizarStatusTarefa(tarefa, novoStatus, userEmail, justificativa = '') {
  if (novoStatus === 'ignorada' && (!justificativa || justificativa.trim().length < 10)) {
    throw new Error('Justificativa obrigatória (mínimo 10 caracteres) para ignorar tarefa')
  }

  const { fonte, origemRef } = tarefa
  const statusFonte = STATUS_MAP[fonte]?.[novoStatus]

  if (!statusFonte) {
    throw new Error(`Status "${novoStatus}" não mapeado para fonte "${fonte}"`)
  }

  const obs = justificativa || ''

  switch (fonte) {
    case 'ongoing': {
      const { clienteId, cicloId, index } = origemRef
      return atualizarAcao(clienteId, cicloId, index, statusFonte, obs, userEmail)
    }

    case 'playbook': {
      const { clienteId, playbookId, ordem } = origemRef
      return atualizarEtapa(clienteId, playbookId, ordem, statusFonte, obs, userEmail)
    }

    case 'alerta': {
      const { docId } = origemRef
      const updateData = {
        status: statusFonte,
      }
      if (statusFonte === 'resolvido' || statusFonte === 'ignorado') {
        updateData.resolved_at = Timestamp.now()
        updateData.motivo_fechamento = obs || `Marcado como ${novoStatus} via Minhas Tarefas`
      }
      await updateAlerta(docId, updateData)
      return { success: true }
    }

    case 'manual': {
      const { docId } = origemRef
      const updateData = { status: statusFonte }
      if (statusFonte === 'concluida' || statusFonte === 'ignorada') {
        updateData.concluida_em = Timestamp.now()
        updateData.concluida_por = userEmail
      }
      if (obs) updateData.observacoes = obs
      await updateTarefaManual(docId, updateData)
      return { success: true }
    }

    default:
      throw new Error(`Fonte desconhecida: ${fonte}`)
  }
}

/**
 * Update a task's due date, routing to the correct source service.
 *
 * @param {Object} tarefa - unified task object from useMinhasTarefas
 * @param {string} novaData - ISO date string (yyyy-mm-dd)
 * @returns {Promise<void>}
 */
export async function atualizarDataTarefa(tarefa, novaData) {
  const { fonte, origemRef } = tarefa
  const timestamp = Timestamp.fromDate(new Date(novaData + 'T12:00:00'))

  switch (fonte) {
    case 'ongoing': {
      const { clienteId, cicloId, index } = origemRef
      const docRef = doc(db, 'clientes', clienteId, 'ongoing_ciclos', cicloId)
      const snap = await getDoc(docRef)
      if (!snap.exists()) throw new Error('Ciclo não encontrado')

      const ciclo = snap.data()
      const acoes = [...ciclo.acoes]
      acoes[index] = { ...acoes[index], data_vencimento: timestamp }

      await updateDoc(docRef, { acoes, updated_at: serverTimestamp() })
      return
    }

    case 'playbook': {
      const { clienteId, playbookId, ordem } = origemRef
      const docRef = doc(db, 'clientes', clienteId, 'playbooks_ativos', playbookId)
      const snap = await getDoc(docRef)
      if (!snap.exists()) throw new Error('Playbook não encontrado')

      const playbook = snap.data()
      const etapas = [...playbook.etapas]
      const idx = etapas.findIndex(e => e.ordem === ordem)
      if (idx === -1) throw new Error('Etapa não encontrada')
      etapas[idx] = { ...etapas[idx], prazo_data: timestamp }

      await updateDoc(docRef, { etapas, updated_at: serverTimestamp() })
      return
    }

    case 'alerta':
      throw new Error('Alertas não suportam ajuste de data')

    case 'manual': {
      const { docId } = origemRef
      await updateTarefaManual(docId, { data_vencimento: timestamp })
      return
    }

    default:
      throw new Error(`Fonte desconhecida: ${fonte}`)
  }
}
