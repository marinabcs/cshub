/**
 * Onboarding Service - CRUD para planos de onboarding
 *
 * Collection: clientes/{clienteId}/onboarding_planos
 */
import { db } from './firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { MODULOS, MODULOS_ORDEM } from '../constants/onboarding';
import { classifyModules, buildSessions, scheduleSessions, calculateProgress } from '../utils/onboardingCalculator';
import logger from '../utils/logger';

/**
 * Cria um novo plano de onboarding para um cliente.
 */
export async function criarPlanoOnboarding(clienteId, respostas, dataInicio, user) {
  try {
    const classificacao = classifyModules(respostas);
    const sessoesBruto = buildSessions(classificacao);
    const sessoes = scheduleSessions(sessoesBruto, dataInicio, respostas.urgencia);

    // Converter datas para Timestamp do Firestore
    const sessoesFirestore = sessoes.map(s => ({
      ...s,
      data_sugerida: Timestamp.fromDate(s.data_sugerida),
      data_realizada: null,
      status: 'agendada',
      observacoes: ''
    }));

    // Modulos online (com tracking de tutorial)
    const modulosOnline = MODULOS_ORDEM
      .filter(id => classificacao[id] === 'online')
      .map(id => ({
        modulo: id,
        tutorial_enviado: false,
        tutorial_url: ''
      }));

    // First values para todos os modulos
    const firstValues = {};
    for (const id of MODULOS_ORDEM) {
      firstValues[id] = { atingido: false, data: null };
    }

    // Calcular data de previsao de fim (ultima sessao)
    const ultimaSessao = sessoesFirestore[sessoesFirestore.length - 1];

    const plano = {
      respostas,
      classificacao,
      ajustes: [],
      sessoes: sessoesFirestore,
      modulos_online: modulosOnline,
      first_values: firstValues,
      status: 'em_andamento',
      progresso: 0,
      handoff_elegivel: false,
      urgencia: respostas.urgencia,
      data_inicio: Timestamp.fromDate(new Date(dataInicio)),
      data_previsao_fim: ultimaSessao?.data_sugerida || Timestamp.fromDate(new Date(dataInicio)),
      participantes: respostas.participantes || '',
      kv_disponivel: respostas.kv_disponivel || '',
      created_by: user?.email || 'sistema',
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    };

    const ref = collection(db, 'clientes', clienteId, 'onboarding_planos');
    const docRef = await addDoc(ref, plano);

    logger.info(`Plano de onboarding criado para cliente ${clienteId}: ${docRef.id}`);

    return { id: docRef.id, ...plano };
  } catch (error) {
    logger.error('Erro ao criar plano de onboarding:', error.message);
    throw error;
  }
}

/**
 * Busca o plano de onboarding ativo de um cliente.
 * Retorna null se nao houver plano ativo.
 */
export async function buscarPlanoAtivo(clienteId) {
  try {
    const ref = collection(db, 'clientes', clienteId, 'onboarding_planos');
    const q = query(ref, where('status', '==', 'em_andamento'), orderBy('created_at', 'desc'), limit(1));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    logger.error('Erro ao buscar plano ativo:', error.message);
    return null;
  }
}

/**
 * Busca todos os planos de onboarding de um cliente (historico).
 */
export async function buscarPlanosCliente(clienteId) {
  try {
    const ref = collection(db, 'clientes', clienteId, 'onboarding_planos');
    const q = query(ref, orderBy('created_at', 'desc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    logger.error('Erro ao buscar planos do cliente:', error.message);
    return [];
  }
}

/**
 * Atualiza uma sessao (marcar concluida, remarcar, adicionar observacao).
 */
export async function atualizarSessao(clienteId, planoId, sessaoNumero, updates) {
  try {
    const docRef = doc(db, 'clientes', clienteId, 'onboarding_planos', planoId);
    const planoSnap = await getDoc(docRef);
    if (!planoSnap.exists()) throw new Error('Plano nao encontrado');

    const plano = planoSnap.data();
    const sessoes = [...plano.sessoes];
    const idx = sessoes.findIndex(s => s.numero === sessaoNumero);
    if (idx === -1) throw new Error('Sessao nao encontrada');

    sessoes[idx] = { ...sessoes[idx], ...updates };

    // Se marcando como concluida, setar data_realizada
    if (updates.status === 'concluida' && !sessoes[idx].data_realizada) {
      sessoes[idx].data_realizada = Timestamp.now();
    }

    const progresso = calculateProgress({ ...plano, sessoes });

    await updateDoc(docRef, {
      sessoes,
      progresso: progresso.percentual,
      handoff_elegivel: progresso.handoffElegivel,
      updated_at: serverTimestamp()
    });

    logger.info(`Sessao ${sessaoNumero} atualizada no plano ${planoId}`);
  } catch (error) {
    logger.error('Erro ao atualizar sessao:', error.message);
    throw error;
  }
}

/**
 * Ajusta modo de um modulo (ao_vivo <-> online) com justificativa.
 */
export async function ajustarModulo(clienteId, planoId, moduloId, novoModo, justificativa, user) {
  try {
    if (MODULOS[moduloId]?.locked) {
      throw new Error('M1 e M2 nao podem ser alterados');
    }

    const docRef = doc(db, 'clientes', clienteId, 'onboarding_planos', planoId);
    const planoSnap = await getDoc(docRef);
    if (!planoSnap.exists()) throw new Error('Plano nao encontrado');

    const plano = planoSnap.data();
    const classificacao = { ...plano.classificacao };
    const modoAnterior = classificacao[moduloId];
    classificacao[moduloId] = novoModo;

    // Registrar ajuste
    const ajustes = [...(plano.ajustes || []), {
      modulo: moduloId,
      de: modoAnterior,
      para: novoModo,
      justificativa,
      csm: user?.email || 'sistema',
      data: Timestamp.now()
    }];

    // Recalcular sessoes (preservar sessoes concluidas)
    const sessoesOriginais = plano.sessoes || [];
    const sessoesConcluidas = sessoesOriginais.filter(s => s.status === 'concluida');
    const modulosConcluidos = new Set(sessoesConcluidas.flatMap(s => s.modulos));

    const novasSessoesBruto = buildSessions(classificacao);
    const novasSessoes = scheduleSessions(
      novasSessoesBruto,
      plano.data_inicio.toDate(),
      plano.urgencia
    );

    // Mesclar: manter sessoes concluidas, recalcular o resto
    const sessoesFinal = novasSessoes.map(s => {
      // Se todos os modulos desta sessao ja foram concluidos, marcar como concluida
      const todosConcluidosNestaSessao = s.modulos.every(m => modulosConcluidos.has(m));
      if (todosConcluidosNestaSessao) {
        const original = sessoesOriginais.find(o =>
          o.modulos.length === s.modulos.length && o.modulos.every(m => s.modulos.includes(m))
        );
        if (original) return original;
      }
      return {
        ...s,
        data_sugerida: Timestamp.fromDate(s.data_sugerida),
        data_realizada: null,
        status: 'agendada',
        observacoes: ''
      };
    });

    // Recalcular modulos online
    const modulosOnline = MODULOS_ORDEM
      .filter(id => classificacao[id] === 'online')
      .map(id => {
        const existente = (plano.modulos_online || []).find(m => m.modulo === id);
        return existente || { modulo: id, tutorial_enviado: false, tutorial_url: '' };
      });

    const progressoNovo = calculateProgress({ ...plano, classificacao, sessoes: sessoesFinal, modulos_online: modulosOnline });

    await updateDoc(docRef, {
      classificacao,
      ajustes,
      sessoes: sessoesFinal,
      modulos_online: modulosOnline,
      progresso: progressoNovo.percentual,
      handoff_elegivel: progressoNovo.handoffElegivel,
      updated_at: serverTimestamp()
    });

    logger.info(`Modulo ${moduloId} ajustado de ${modoAnterior} para ${novoModo} no plano ${planoId}`);
  } catch (error) {
    logger.error('Erro ao ajustar modulo:', error.message);
    throw error;
  }
}

/**
 * Marca first value como atingido para um modulo.
 */
export async function marcarFirstValue(clienteId, planoId, moduloId) {
  try {
    const docRef = doc(db, 'clientes', clienteId, 'onboarding_planos', planoId);
    const planoSnap = await getDoc(docRef);
    if (!planoSnap.exists()) throw new Error('Plano nao encontrado');

    const plano = planoSnap.data();
    const firstValues = { ...plano.first_values };
    const existing = firstValues[moduloId] || {};
    firstValues[moduloId] = { ...existing, atingido: true, data: Timestamp.now() };

    const progresso = calculateProgress({ ...plano, first_values: firstValues });

    await updateDoc(docRef, {
      first_values: firstValues,
      progresso: progresso.percentual,
      handoff_elegivel: progresso.handoffElegivel,
      updated_at: serverTimestamp()
    });

    logger.info(`First value atingido: ${moduloId} no plano ${planoId}`);
  } catch (error) {
    logger.error('Erro ao marcar first value:', error.message);
    throw error;
  }
}

/**
 * Adiciona um comentario de acompanhamento a um first value.
 */
export async function adicionarComentarioFirstValue(clienteId, planoId, moduloId, texto, user) {
  try {
    const docRef = doc(db, 'clientes', clienteId, 'onboarding_planos', planoId);
    const planoSnap = await getDoc(docRef);
    if (!planoSnap.exists()) throw new Error('Plano nao encontrado');

    const plano = planoSnap.data();
    const firstValues = { ...plano.first_values };
    const existing = firstValues[moduloId] || { atingido: false, data: null };
    const comentarios = [...(existing.comentarios || []), {
      texto,
      autor: user?.email || 'sistema',
      data: Timestamp.now()
    }];
    firstValues[moduloId] = { ...existing, comentarios };

    await updateDoc(docRef, {
      first_values: firstValues,
      updated_at: serverTimestamp()
    });

    logger.info(`Comentario adicionado ao first value ${moduloId} no plano ${planoId}`);
  } catch (error) {
    logger.error('Erro ao adicionar comentario first value:', error.message);
    throw error;
  }
}

/**
 * Marca tutorial como enviado para um modulo online.
 */
export async function marcarTutorialEnviado(clienteId, planoId, moduloId) {
  try {
    const docRef = doc(db, 'clientes', clienteId, 'onboarding_planos', planoId);
    const planoSnap = await getDoc(docRef);
    if (!planoSnap.exists()) throw new Error('Plano nao encontrado');

    const plano = planoSnap.data();
    const modulosOnline = [...(plano.modulos_online || [])];
    const idx = modulosOnline.findIndex(m => m.modulo === moduloId);
    if (idx !== -1) {
      modulosOnline[idx] = { ...modulosOnline[idx], tutorial_enviado: true };
    }

    const progresso = calculateProgress({ ...plano, modulos_online: modulosOnline });

    await updateDoc(docRef, {
      modulos_online: modulosOnline,
      progresso: progresso.percentual,
      handoff_elegivel: progresso.handoffElegivel,
      updated_at: serverTimestamp()
    });

    logger.info(`Tutorial enviado: ${moduloId} no plano ${planoId}`);
  } catch (error) {
    logger.error('Erro ao marcar tutorial enviado:', error.message);
    throw error;
  }
}

/**
 * Exclui (cancela) um plano de onboarding.
 */
export async function excluirPlano(clienteId, planoId) {
  try {
    const docRef = doc(db, 'clientes', clienteId, 'onboarding_planos', planoId);
    await updateDoc(docRef, {
      status: 'cancelado',
      updated_at: serverTimestamp()
    });

    logger.info(`Plano de onboarding ${planoId} cancelado para cliente ${clienteId}`);
  } catch (error) {
    logger.error('Erro ao excluir plano de onboarding:', error.message);
    throw error;
  }
}

/**
 * Conclui o onboarding (handoff).
 * @param {string} clienteId
 * @param {string} planoId
 * @param {Array<{email: string, nome: string}>} novosResponsaveis - responsáveis pós-onboarding
 */
export async function concluirOnboarding(clienteId, planoId, novosResponsaveis) {
  try {
    const docRef = doc(db, 'clientes', clienteId, 'onboarding_planos', planoId);
    await updateDoc(docRef, {
      status: 'concluido',
      progresso: 100,
      updated_at: serverTimestamp()
    });

    // Atualizar responsáveis do cliente se informados
    if (novosResponsaveis && novosResponsaveis.length > 0) {
      const clienteRef = doc(db, 'clientes', clienteId);
      await updateDoc(clienteRef, {
        responsaveis: novosResponsaveis,
        responsavel_nome: novosResponsaveis[0].nome,
        responsavel_email: novosResponsaveis[0].email,
        updated_at: serverTimestamp()
      });
    }

    logger.info(`Onboarding concluido para cliente ${clienteId}`);
  } catch (error) {
    logger.error('Erro ao concluir onboarding:', error.message);
    throw error;
  }
}
