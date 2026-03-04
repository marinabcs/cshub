/**
 * tarefasWriteBack.js - Write-back service for "Minhas Tarefas"
 *
 * Maps unified task status back to the original source (Ongoing, Playbook, Alerta)
 * and calls the appropriate update function.
 */

import { atualizarAcao } from './ongoing'
import { atualizarEtapa } from './playbooks'
import { updateAlerta } from './dataAccess'
import { Timestamp } from 'firebase/firestore'

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

    default:
      throw new Error(`Fonte desconhecida: ${fonte}`)
  }
}
