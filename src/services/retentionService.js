/**
 * Retention Service
 * Gerencia política de retenção de dados do CS Hub
 *
 * Regras de Retenção:
 * - Threads resolvidas: 12 meses -> Arquivar
 * - Threads inativas: 6 meses sem atividade -> Arquivar
 * - Mensagens: Segue a thread -> Arquivar junto
 * - Alertas resolvidos: 6 meses -> Soft delete
 * - Audit logs: Permanente -> Nunca deletar
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as fbLimit,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';

import { registrarAcao, ACOES, ENTIDADES } from './auditService.js';

// Configurações de retenção (em meses)
export const RETENTION_CONFIG = {
  THREADS_RESOLVIDAS_MESES: 12,
  THREADS_INATIVAS_MESES: 6,
  ALERTAS_RESOLVIDOS_MESES: 6,
  AUDIT_LOGS_MESES: null, // Permanente, nunca deletar
};

// Razões de arquivamento
export const ARCHIVE_REASONS = {
  RESOLVED_EXPIRED: 'resolved_retention_expired',
  INACTIVE_EXPIRED: 'inactive_retention_expired',
  MANUAL: 'manual_archive',
};

/**
 * Calcula a data limite baseada em meses atrás
 * @param {number} meses - Número de meses para subtrair
 * @returns {Date} - Data limite
 */
function calcularDataLimite(meses) {
  const data = new Date();
  data.setMonth(data.getMonth() - meses);
  return data;
}

/**
 * Converte Firestore Timestamp para Date
 * @param {any} timestamp - Timestamp do Firestore ou Date
 * @returns {Date|null}
 */
function toDate(timestamp) {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  if (timestamp.toDate) return timestamp.toDate();
  if (typeof timestamp === 'string') return new Date(timestamp);
  return null;
}

/**
 * Arquiva uma thread específica
 * Move para subcollection archived_threads e remove da collection principal
 *
 * @param {Object} firestore - Instância do Firestore
 * @param {Object} auth - Instância do Firebase Auth
 * @param {string} clienteId - ID do cliente
 * @param {string} threadId - ID da thread
 * @param {string} reason - Razão do arquivamento
 * @returns {Promise<Object>} - Resultado da operação
 */
export async function arquivarThread(firestore, auth, clienteId, threadId, reason = ARCHIVE_REASONS.MANUAL) {
  try {
    // 1. Verificar se a thread existe
    const threadRef = doc(firestore, 'threads', threadId);
    const threadSnap = await getDoc(threadRef);

    if (!threadSnap.exists()) {
      return { success: false, error: 'Thread não encontrada' };
    }

    const threadData = threadSnap.data();

    // 2. Verificar se há alertas pendentes associados à thread
    const alertasQuery = query(
      collection(firestore, 'alertas'),
      where('thread_id', '==', threadId),
      where('resolvido', '==', false)
    );
    const alertasSnap = await getDocs(alertasQuery);

    if (!alertasSnap.empty) {
      return {
        success: false,
        error: 'Thread possui alertas pendentes',
        alertasPendentes: alertasSnap.size,
      };
    }

    // 3. Buscar mensagens da thread
    const mensagensQuery = query(
      collection(firestore, 'mensagens'),
      where('thread_id', '==', threadId)
    );
    const mensagensSnap = await getDocs(mensagensQuery);
    const mensagens = mensagensSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // 4. Preparar dados de arquivamento
    const archivedData = {
      ...threadData,
      original_id: threadId,
      archived_at: Timestamp.now(),
      archived_reason: reason,
      mensagens_count: mensagens.length,
      mensagens: mensagens, // Incluir mensagens no documento arquivado
    };

    // 5. Usar batch para operações atômicas
    const batch = writeBatch(firestore);

    // 5a. Criar documento na collection arquivada
    const archivedRef = doc(firestore, `clientes/${clienteId}/archived_threads`, threadId);
    batch.set(archivedRef, archivedData);

    // 5b. Marcar thread original como arquivada (soft delete)
    batch.update(threadRef, {
      archived: true,
      archived_at: Timestamp.now(),
      archived_reason: reason,
    });

    // 5c. Marcar mensagens como arquivadas
    for (const msg of mensagens) {
      const msgRef = doc(firestore, 'mensagens', msg.id);
      batch.update(msgRef, {
        archived: true,
        archived_at: Timestamp.now(),
      });
    }

    // 6. Executar batch
    await batch.commit();

    // 7. Registrar no audit log
    await registrarAcao(firestore, auth, {
      acao: ACOES.ARQUIVAMENTO_THREAD,
      entidadeTipo: ENTIDADES.THREAD,
      entidadeId: threadId,
      dadosAnteriores: { archived: false },
      dadosNovos: {
        archived: true,
        archived_reason: reason,
        mensagens_arquivadas: mensagens.length,
      },
      metadata: { clienteId },
    });

    return {
      success: true,
      threadId,
      mensagensArquivadas: mensagens.length,
      reason,
    };
  } catch (error) {
    console.error('[Retention] Erro ao arquivar thread:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Desarquiva uma thread
 * @param {Object} firestore - Instância do Firestore
 * @param {Object} auth - Instância do Firebase Auth
 * @param {string} clienteId - ID do cliente
 * @param {string} threadId - ID da thread
 * @returns {Promise<Object>} - Resultado da operação
 */
export async function desarquivarThread(firestore, auth, clienteId, threadId) {
  try {
    const threadRef = doc(firestore, 'threads', threadId);
    const threadSnap = await getDoc(threadRef);

    if (!threadSnap.exists()) {
      return { success: false, error: 'Thread não encontrada' };
    }

    const batch = writeBatch(firestore);

    // Atualizar thread
    batch.update(threadRef, {
      archived: false,
      archived_at: null,
      archived_reason: null,
      unarchived_at: Timestamp.now(),
    });

    // Atualizar mensagens
    const mensagensQuery = query(
      collection(firestore, 'mensagens'),
      where('thread_id', '==', threadId),
      where('archived', '==', true)
    );
    const mensagensSnap = await getDocs(mensagensQuery);

    for (const msgDoc of mensagensSnap.docs) {
      batch.update(msgDoc.ref, {
        archived: false,
        archived_at: null,
      });
    }

    await batch.commit();

    // Remover da collection arquivada
    const archivedRef = doc(firestore, `clientes/${clienteId}/archived_threads`, threadId);
    await deleteDoc(archivedRef);

    // Registrar no audit log
    await registrarAcao(firestore, auth, {
      acao: ACOES.ARQUIVAMENTO_THREAD,
      entidadeTipo: ENTIDADES.THREAD,
      entidadeId: threadId,
      dadosAnteriores: { archived: true },
      dadosNovos: { archived: false },
      metadata: { clienteId },
    });

    return { success: true, threadId };
  } catch (error) {
    console.error('[Retention] Erro ao desarquivar thread:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Soft delete de um alerta
 * Marca deleted_at mas não remove do banco
 *
 * @param {Object} firestore - Instância do Firestore
 * @param {Object} auth - Instância do Firebase Auth
 * @param {string} alertaId - ID do alerta
 * @returns {Promise<Object>} - Resultado da operação
 */
export async function softDeleteAlerta(firestore, auth, alertaId) {
  try {
    const alertaRef = doc(firestore, 'alertas', alertaId);
    const alertaSnap = await getDoc(alertaRef);

    if (!alertaSnap.exists()) {
      return { success: false, error: 'Alerta não encontrado' };
    }

    const alertaData = alertaSnap.data();

    // Verificar se já foi deletado
    if (alertaData.deleted_at) {
      return { success: false, error: 'Alerta já foi deletado' };
    }

    // Soft delete
    await updateDoc(alertaRef, {
      deleted_at: Timestamp.now(),
      deleted_reason: 'retention_policy',
    });

    // Registrar no audit log
    await registrarAcao(firestore, auth, {
      acao: ACOES.RESOLUCAO_ALERTA,
      entidadeTipo: ENTIDADES.ALERTA,
      entidadeId: alertaId,
      dadosAnteriores: { deleted: false, tipo: alertaData.tipo },
      dadosNovos: { deleted: true, deleted_reason: 'retention_policy' },
    });

    return { success: true, alertaId };
  } catch (error) {
    console.error('[Retention] Erro ao soft delete alerta:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Restaura um alerta soft-deleted
 * @param {Object} firestore - Instância do Firestore
 * @param {Object} auth - Instância do Firebase Auth
 * @param {string} alertaId - ID do alerta
 * @returns {Promise<Object>} - Resultado da operação
 */
export async function restaurarAlerta(firestore, auth, alertaId) {
  try {
    const alertaRef = doc(firestore, 'alertas', alertaId);
    const alertaSnap = await getDoc(alertaRef);

    if (!alertaSnap.exists()) {
      return { success: false, error: 'Alerta não encontrado' };
    }

    await updateDoc(alertaRef, {
      deleted_at: null,
      deleted_reason: null,
      restored_at: Timestamp.now(),
    });

    return { success: true, alertaId };
  } catch (error) {
    console.error('[Retention] Erro ao restaurar alerta:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Busca threads elegíveis para arquivamento
 * @param {Object} firestore - Instância do Firestore
 * @returns {Promise<Object>} - { resolvidas: [], inativas: [] }
 */
export async function buscarThreadsParaArquivar(firestore) {
  const dataResolvidasLimite = calcularDataLimite(RETENTION_CONFIG.THREADS_RESOLVIDAS_MESES);
  const dataInativasLimite = calcularDataLimite(RETENTION_CONFIG.THREADS_INATIVAS_MESES);

  const resultado = {
    resolvidas: [],
    inativas: [],
  };

  try {
    // 1. Threads resolvidas há mais de 12 meses
    const resolvidasQuery = query(
      collection(firestore, 'threads'),
      where('status', '==', 'resolvido'),
      where('resolved_at', '<', Timestamp.fromDate(dataResolvidasLimite)),
      where('archived', '!=', true)
    );

    const resolvidasSnap = await getDocs(resolvidasQuery);
    resultado.resolvidas = resolvidasSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      elegivel_por: 'resolved_expired',
    }));
  } catch (error) {
    // Query pode falhar se index não existir, tentar alternativa
    console.warn('[Retention] Query de threads resolvidas falhou, tentando alternativa:', error.message);
  }

  try {
    // 2. Threads inativas há mais de 6 meses
    const inativasQuery = query(
      collection(firestore, 'threads'),
      where('last_activity_at', '<', Timestamp.fromDate(dataInativasLimite)),
      where('archived', '!=', true)
    );

    const inativasSnap = await getDocs(inativasQuery);
    resultado.inativas = inativasSnap.docs
      .filter((d) => d.data().status !== 'resolvido') // Evitar duplicatas
      .map((d) => ({
        id: d.id,
        ...d.data(),
        elegivel_por: 'inactive_expired',
      }));
  } catch (error) {
    console.warn('[Retention] Query de threads inativas falhou:', error.message);
  }

  return resultado;
}

/**
 * Busca alertas elegíveis para soft delete
 * @param {Object} firestore - Instância do Firestore
 * @returns {Promise<Object[]>} - Array de alertas
 */
export async function buscarAlertasParaSoftDelete(firestore) {
  const dataLimite = calcularDataLimite(RETENTION_CONFIG.ALERTAS_RESOLVIDOS_MESES);

  try {
    const alertasQuery = query(
      collection(firestore, 'alertas'),
      where('resolvido', '==', true),
      where('resolved_at', '<', Timestamp.fromDate(dataLimite)),
      where('deleted_at', '==', null)
    );

    const snapshot = await getDocs(alertasQuery);

    return snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
  } catch (error) {
    console.warn('[Retention] Query de alertas falhou:', error.message);
    return [];
  }
}

/**
 * Executa política de retenção completa
 * Processa todas as regras de retenção
 *
 * @param {Object} firestore - Instância do Firestore
 * @param {Object} auth - Instância do Firebase Auth
 * @param {Object} options - Opções de execução
 * @param {boolean} options.dryRun - Se true, apenas simula sem executar
 * @param {Function} options.onProgress - Callback de progresso
 * @returns {Promise<Object>} - Relatório de execução
 */
export async function executarRetencaoCompleta(firestore, auth, options = {}) {
  const { dryRun = false, onProgress = null } = options;

  const relatorio = {
    iniciadoEm: new Date().toISOString(),
    dryRun,
    threads: {
      resolvidas: { encontradas: 0, arquivadas: 0, erros: 0 },
      inativas: { encontradas: 0, arquivadas: 0, erros: 0 },
    },
    alertas: {
      encontrados: 0,
      deletados: 0,
      erros: 0,
    },
    erros: [],
    finalizadoEm: null,
  };

  const log = (msg) => {
    console.log(`[Retention] ${msg}`);
    if (onProgress) onProgress(msg);
  };

  try {
    // 1. Processar threads
    log('Buscando threads para arquivar...');
    const threads = await buscarThreadsParaArquivar(firestore);

    relatorio.threads.resolvidas.encontradas = threads.resolvidas.length;
    relatorio.threads.inativas.encontradas = threads.inativas.length;

    log(`Encontradas ${threads.resolvidas.length} threads resolvidas e ${threads.inativas.length} inativas`);

    // Arquivar threads resolvidas
    for (const thread of threads.resolvidas) {
      if (dryRun) {
        relatorio.threads.resolvidas.arquivadas++;
        continue;
      }

      const clienteId = thread.cliente_id || thread.clienteId;
      if (!clienteId) {
        relatorio.erros.push({ tipo: 'thread', id: thread.id, erro: 'cliente_id não encontrado' });
        relatorio.threads.resolvidas.erros++;
        continue;
      }

      const resultado = await arquivarThread(
        firestore,
        auth,
        clienteId,
        thread.id,
        ARCHIVE_REASONS.RESOLVED_EXPIRED
      );

      if (resultado.success) {
        relatorio.threads.resolvidas.arquivadas++;
      } else {
        relatorio.threads.resolvidas.erros++;
        relatorio.erros.push({ tipo: 'thread', id: thread.id, erro: resultado.error });
      }
    }

    // Arquivar threads inativas
    for (const thread of threads.inativas) {
      if (dryRun) {
        relatorio.threads.inativas.arquivadas++;
        continue;
      }

      const clienteId = thread.cliente_id || thread.clienteId;
      if (!clienteId) {
        relatorio.erros.push({ tipo: 'thread', id: thread.id, erro: 'cliente_id não encontrado' });
        relatorio.threads.inativas.erros++;
        continue;
      }

      const resultado = await arquivarThread(
        firestore,
        auth,
        clienteId,
        thread.id,
        ARCHIVE_REASONS.INACTIVE_EXPIRED
      );

      if (resultado.success) {
        relatorio.threads.inativas.arquivadas++;
      } else {
        relatorio.threads.inativas.erros++;
        relatorio.erros.push({ tipo: 'thread', id: thread.id, erro: resultado.error });
      }
    }

    // 2. Processar alertas
    log('Buscando alertas para soft delete...');
    const alertas = await buscarAlertasParaSoftDelete(firestore);

    relatorio.alertas.encontrados = alertas.length;
    log(`Encontrados ${alertas.length} alertas para soft delete`);

    for (const alerta of alertas) {
      if (dryRun) {
        relatorio.alertas.deletados++;
        continue;
      }

      const resultado = await softDeleteAlerta(firestore, auth, alerta.id);

      if (resultado.success) {
        relatorio.alertas.deletados++;
      } else {
        relatorio.alertas.erros++;
        relatorio.erros.push({ tipo: 'alerta', id: alerta.id, erro: resultado.error });
      }
    }

    relatorio.finalizadoEm = new Date().toISOString();

    log('Retenção completa finalizada!');
    log(`Resumo: ${relatorio.threads.resolvidas.arquivadas + relatorio.threads.inativas.arquivadas} threads arquivadas, ${relatorio.alertas.deletados} alertas deletados`);

    return relatorio;
  } catch (error) {
    relatorio.erros.push({ tipo: 'geral', erro: error.message });
    relatorio.finalizadoEm = new Date().toISOString();
    console.error('[Retention] Erro geral na execução:', error);
    return relatorio;
  }
}

/**
 * Gera relatório de itens pendentes de retenção (preview)
 * @param {Object} firestore - Instância do Firestore
 * @returns {Promise<Object>} - Relatório de preview
 */
export async function gerarRelatorioRetencao(firestore) {
  const threads = await buscarThreadsParaArquivar(firestore);
  const alertas = await buscarAlertasParaSoftDelete(firestore);

  return {
    geradoEm: new Date().toISOString(),
    threads: {
      resolvidas: {
        total: threads.resolvidas.length,
        itens: threads.resolvidas.slice(0, 10), // Preview dos primeiros 10
      },
      inativas: {
        total: threads.inativas.length,
        itens: threads.inativas.slice(0, 10),
      },
    },
    alertas: {
      total: alertas.length,
      itens: alertas.slice(0, 10),
    },
    config: RETENTION_CONFIG,
  };
}

export default {
  // Configurações
  RETENTION_CONFIG,
  ARCHIVE_REASONS,
  // Operações de thread
  arquivarThread,
  desarquivarThread,
  // Operações de alerta
  softDeleteAlerta,
  restaurarAlerta,
  // Busca
  buscarThreadsParaArquivar,
  buscarAlertasParaSoftDelete,
  // Execução
  executarRetencaoCompleta,
  gerarRelatorioRetencao,
};
