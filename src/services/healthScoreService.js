/**
 * Health Score Service
 * Calcula automaticamente o Health Score dos clientes do CS Hub
 *
 * Componentes do Score (total = 100):
 * - Engajamento: 25% - Qtd threads nos últimos 30 dias
 * - Sentimento: 25% - % threads positivas/neutras vs negativas
 * - Tickets Abertos: 20% - Threads não resolvidas
 * - Tempo sem Contato: 15% - Dias desde última interação
 * - Uso Plataforma: 15% - Dados de métricas diárias
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit as fbLimit,
  Timestamp,
} from 'firebase/firestore';

// Pesos dos componentes (devem somar 100)
export const PESOS = {
  ENGAJAMENTO: 25,
  SENTIMENTO: 25,
  TICKETS_ABERTOS: 20,
  TEMPO_SEM_CONTATO: 15,
  USO_PLATAFORMA: 15,
};

// Status baseados no score
export const STATUS_THRESHOLDS = {
  SAUDAVEL: { min: 80, max: 100, label: 'saudavel', color: 'green' },
  ATENCAO: { min: 60, max: 79, label: 'atencao', color: 'yellow' },
  RISCO: { min: 40, max: 59, label: 'risco', color: 'orange' },
  CRITICO: { min: 0, max: 39, label: 'critico', color: 'red' },
};

// Valores de sentimento
const SENTIMENTO_PONTOS = {
  positivo: 100,
  neutro: 75,
  negativo: 25,
  urgente: 0,
};

/**
 * Calcula a data X dias atrás
 * @param {number} dias - Número de dias
 * @returns {Date}
 */
function diasAtras(dias) {
  const data = new Date();
  data.setDate(data.getDate() - dias);
  data.setHours(0, 0, 0, 0);
  return data;
}

/**
 * Calcula pontuação de engajamento baseado em threads
 * @param {Object} firestore - Instância do Firestore
 * @param {string} clienteId - ID do cliente
 * @returns {Promise<Object>} - { pontos, detalhes }
 */
export async function calcularEngajamento(firestore, clienteId) {
  try {
    const dataLimite = diasAtras(30);

    const threadsQuery = query(
      collection(firestore, 'threads'),
      where('cliente_id', '==', clienteId),
      where('created_at', '>=', Timestamp.fromDate(dataLimite))
    );

    const snapshot = await getDocs(threadsQuery);
    const qtdThreads = snapshot.size;

    let pontos;
    if (qtdThreads === 0) {
      pontos = 0;
    } else if (qtdThreads <= 2) {
      pontos = 50;
    } else if (qtdThreads <= 5) {
      pontos = 75;
    } else {
      pontos = 100;
    }

    return {
      pontos,
      detalhes: {
        threads_30_dias: qtdThreads,
        periodo: '30 dias',
      },
    };
  } catch (error) {
    console.error('[HealthScore] Erro ao calcular engajamento:', error);
    return { pontos: 0, detalhes: { erro: error.message } };
  }
}

/**
 * Calcula pontuação de sentimento baseado em classificação das threads
 * @param {Object} firestore - Instância do Firestore
 * @param {string} clienteId - ID do cliente
 * @returns {Promise<Object>} - { pontos, detalhes }
 */
export async function calcularSentimento(firestore, clienteId) {
  try {
    const dataLimite = diasAtras(30);

    const threadsQuery = query(
      collection(firestore, 'threads'),
      where('cliente_id', '==', clienteId),
      where('created_at', '>=', Timestamp.fromDate(dataLimite))
    );

    const snapshot = await getDocs(threadsQuery);

    if (snapshot.empty) {
      // Sem threads = neutro (benefício da dúvida)
      return {
        pontos: 75,
        detalhes: {
          sem_threads: true,
          periodo: '30 dias',
        },
      };
    }

    const contagem = {
      positivo: 0,
      neutro: 0,
      negativo: 0,
      urgente: 0,
      total: 0,
    };

    snapshot.forEach((doc) => {
      const data = doc.data();
      const sentimento = data.sentimento || data.sentiment || 'neutro';
      contagem.total++;

      if (sentimento in contagem) {
        contagem[sentimento]++;
      } else {
        contagem.neutro++; // Default para neutro
      }
    });

    // Calcular média ponderada
    let somaPontos = 0;
    somaPontos += contagem.positivo * SENTIMENTO_PONTOS.positivo;
    somaPontos += contagem.neutro * SENTIMENTO_PONTOS.neutro;
    somaPontos += contagem.negativo * SENTIMENTO_PONTOS.negativo;
    somaPontos += contagem.urgente * SENTIMENTO_PONTOS.urgente;

    const pontos = contagem.total > 0 ? Math.round(somaPontos / contagem.total) : 75;

    return {
      pontos,
      detalhes: {
        ...contagem,
        periodo: '30 dias',
      },
    };
  } catch (error) {
    console.error('[HealthScore] Erro ao calcular sentimento:', error);
    return { pontos: 75, detalhes: { erro: error.message } };
  }
}

/**
 * Calcula pontuação baseada em tickets abertos
 * @param {Object} firestore - Instância do Firestore
 * @param {string} clienteId - ID do cliente
 * @returns {Promise<Object>} - { pontos, detalhes }
 */
export async function calcularTicketsAbertos(firestore, clienteId) {
  try {
    // Buscar threads não resolvidas e não inativas
    const threadsQuery = query(
      collection(firestore, 'threads'),
      where('cliente_id', '==', clienteId),
      where('archived', '!=', true)
    );

    const snapshot = await getDocs(threadsQuery);

    // Filtrar manualmente por status (Firestore não suporta múltiplos != na query)
    const ticketsAbertos = snapshot.docs.filter((doc) => {
      const data = doc.data();
      const status = data.status?.toLowerCase();
      return status !== 'resolvido' && status !== 'inativo' && status !== 'fechado';
    });

    const qtdTickets = ticketsAbertos.length;

    let pontos;
    if (qtdTickets === 0) {
      pontos = 100;
    } else if (qtdTickets <= 2) {
      pontos = 75;
    } else if (qtdTickets <= 5) {
      pontos = 50;
    } else {
      pontos = 25;
    }

    return {
      pontos,
      detalhes: {
        tickets_abertos: qtdTickets,
        tickets_por_status: ticketsAbertos.reduce((acc, doc) => {
          const status = doc.data().status || 'sem_status';
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {}),
      },
    };
  } catch (error) {
    console.error('[HealthScore] Erro ao calcular tickets abertos:', error);
    return { pontos: 75, detalhes: { erro: error.message } };
  }
}

/**
 * Calcula pontuação baseada no tempo sem contato
 * @param {Object} firestore - Instância do Firestore
 * @param {string} clienteId - ID do cliente
 * @returns {Promise<Object>} - { pontos, detalhes }
 */
export async function calcularTempoSemContato(firestore, clienteId) {
  try {
    // Buscar dados do cliente
    const clienteRef = doc(firestore, 'clientes', clienteId);
    const clienteSnap = await getDoc(clienteRef);

    if (!clienteSnap.exists()) {
      return { pontos: 0, detalhes: { erro: 'Cliente não encontrado' } };
    }

    const clienteData = clienteSnap.data();

    // Tentar diferentes campos para última interação
    let ultimaInteracao = clienteData.ultima_interacao ||
      clienteData.last_interaction ||
      clienteData.updated_at ||
      clienteData.created_at;

    if (!ultimaInteracao) {
      // Buscar thread mais recente como fallback
      const threadsQuery = query(
        collection(firestore, 'threads'),
        where('cliente_id', '==', clienteId),
        orderBy('created_at', 'desc'),
        fbLimit(1)
      );

      const threadsSnap = await getDocs(threadsQuery);

      if (!threadsSnap.empty) {
        ultimaInteracao = threadsSnap.docs[0].data().created_at;
      }
    }

    if (!ultimaInteracao) {
      return {
        pontos: 0,
        detalhes: {
          dias_sem_contato: 'desconhecido',
          ultima_interacao: null,
        },
      };
    }

    // Converter para Date
    const dataInteracao = ultimaInteracao.toDate
      ? ultimaInteracao.toDate()
      : new Date(ultimaInteracao);

    const agora = new Date();
    const diffMs = agora - dataInteracao;
    const diasSemContato = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    let pontos;
    if (diasSemContato <= 3) {
      pontos = 100;
    } else if (diasSemContato <= 7) {
      pontos = 75;
    } else if (diasSemContato <= 14) {
      pontos = 50;
    } else if (diasSemContato <= 30) {
      pontos = 25;
    } else {
      pontos = 0;
    }

    return {
      pontos,
      detalhes: {
        dias_sem_contato: diasSemContato,
        ultima_interacao: dataInteracao.toISOString(),
      },
    };
  } catch (error) {
    console.error('[HealthScore] Erro ao calcular tempo sem contato:', error);
    return { pontos: 50, detalhes: { erro: error.message } };
  }
}

/**
 * Calcula pontuação baseada no uso da plataforma
 * @param {Object} firestore - Instância do Firestore
 * @param {string} clienteId - ID do cliente
 * @returns {Promise<Object>} - { pontos, detalhes } - pontos pode ser null se não houver dados
 */
export async function calcularUsoPlataforma(firestore, clienteId) {
  try {
    const dataLimite = diasAtras(7);

    // Buscar métricas diárias dos últimos 7 dias
    const metricasQuery = query(
      collection(firestore, `clientes/${clienteId}/metricas_diarias`),
      where('data', '>=', Timestamp.fromDate(dataLimite)),
      orderBy('data', 'desc')
    );

    const snapshot = await getDocs(metricasQuery);

    if (snapshot.empty) {
      // Sem dados de uso = null (não conta no peso)
      return {
        pontos: null,
        detalhes: {
          sem_dados: true,
          periodo: '7 dias',
          motivo: 'Métricas de uso não disponíveis',
        },
      };
    }

    // Agregar métricas
    let totalLogins = 0;
    let totalPecasCriadas = 0;
    let diasComAtividade = 0;

    snapshot.forEach((doc) => {
      const data = doc.data();
      totalLogins += data.logins || 0;
      totalPecasCriadas += data.pecas_criadas || data.pieces_created || 0;
      if ((data.logins || 0) > 0 || (data.pecas_criadas || 0) > 0) {
        diasComAtividade++;
      }
    });

    // Calcular score baseado em atividade
    // Alta atividade: 5+ logins E 10+ peças = 100
    // Média atividade: 3+ logins OU 5+ peças = 75
    // Baixa atividade: algum login ou peça = 50
    // Nenhuma atividade = 25

    let pontos;
    if (totalLogins >= 5 && totalPecasCriadas >= 10) {
      pontos = 100;
    } else if (totalLogins >= 3 || totalPecasCriadas >= 5) {
      pontos = 75;
    } else if (totalLogins > 0 || totalPecasCriadas > 0) {
      pontos = 50;
    } else {
      pontos = 25;
    }

    return {
      pontos,
      detalhes: {
        total_logins: totalLogins,
        total_pecas_criadas: totalPecasCriadas,
        dias_com_atividade: diasComAtividade,
        dias_analisados: snapshot.size,
        periodo: '7 dias',
      },
    };
  } catch (error) {
    console.error('[HealthScore] Erro ao calcular uso plataforma:', error);
    // Em caso de erro, retornar null para não penalizar
    return { pontos: null, detalhes: { erro: error.message } };
  }
}

/**
 * Determina o status baseado no score
 * @param {number} score - Score de 0 a 100
 * @returns {Object} - { status, label, color }
 */
export function determinarStatus(score) {
  if (score >= STATUS_THRESHOLDS.SAUDAVEL.min) {
    return STATUS_THRESHOLDS.SAUDAVEL;
  } else if (score >= STATUS_THRESHOLDS.ATENCAO.min) {
    return STATUS_THRESHOLDS.ATENCAO;
  } else if (score >= STATUS_THRESHOLDS.RISCO.min) {
    return STATUS_THRESHOLDS.RISCO;
  } else {
    return STATUS_THRESHOLDS.CRITICO;
  }
}

/**
 * Calcula o Health Score completo de um cliente
 * @param {Object} firestore - Instância do Firestore
 * @param {string} clienteId - ID do cliente
 * @returns {Promise<Object>} - { score, status, componentes, detalhes }
 */
export async function calcularHealthScoreCompleto(firestore, clienteId) {
  try {
    // Calcular todos os componentes em paralelo
    const [
      engajamento,
      sentimento,
      ticketsAbertos,
      tempoSemContato,
      usoPlataforma,
    ] = await Promise.all([
      calcularEngajamento(firestore, clienteId),
      calcularSentimento(firestore, clienteId),
      calcularTicketsAbertos(firestore, clienteId),
      calcularTempoSemContato(firestore, clienteId),
      calcularUsoPlataforma(firestore, clienteId),
    ]);

    // Montar componentes
    const componentes = {
      engajamento: engajamento.pontos,
      sentimento: sentimento.pontos,
      tickets_abertos: ticketsAbertos.pontos,
      tempo_sem_contato: tempoSemContato.pontos,
      uso_plataforma: usoPlataforma.pontos, // Pode ser null
    };

    // Calcular pesos ajustados se uso_plataforma for null
    let pesosAjustados = { ...PESOS };
    let pesoTotal = 100;

    if (usoPlataforma.pontos === null) {
      // Redistribuir peso de uso_plataforma entre os outros componentes
      const pesoUso = PESOS.USO_PLATAFORMA;
      const outrosPesos = 100 - pesoUso;

      pesosAjustados = {
        ENGAJAMENTO: Math.round((PESOS.ENGAJAMENTO / outrosPesos) * 100),
        SENTIMENTO: Math.round((PESOS.SENTIMENTO / outrosPesos) * 100),
        TICKETS_ABERTOS: Math.round((PESOS.TICKETS_ABERTOS / outrosPesos) * 100),
        TEMPO_SEM_CONTATO: Math.round((PESOS.TEMPO_SEM_CONTATO / outrosPesos) * 100),
        USO_PLATAFORMA: 0,
      };

      // Ajustar para garantir que soma 100
      const somaAjustada = pesosAjustados.ENGAJAMENTO + pesosAjustados.SENTIMENTO +
        pesosAjustados.TICKETS_ABERTOS + pesosAjustados.TEMPO_SEM_CONTATO;
      if (somaAjustada !== 100) {
        pesosAjustados.ENGAJAMENTO += (100 - somaAjustada);
      }
    }

    // Calcular score final
    let scoreTotal = 0;

    scoreTotal += (componentes.engajamento * pesosAjustados.ENGAJAMENTO) / 100;
    scoreTotal += (componentes.sentimento * pesosAjustados.SENTIMENTO) / 100;
    scoreTotal += (componentes.tickets_abertos * pesosAjustados.TICKETS_ABERTOS) / 100;
    scoreTotal += (componentes.tempo_sem_contato * pesosAjustados.TEMPO_SEM_CONTATO) / 100;

    if (componentes.uso_plataforma !== null) {
      scoreTotal += (componentes.uso_plataforma * pesosAjustados.USO_PLATAFORMA) / 100;
    }

    const score = Math.round(scoreTotal);
    const status = determinarStatus(score);

    return {
      score,
      status: status.label,
      status_color: status.color,
      componentes,
      pesos_utilizados: pesosAjustados,
      detalhes: {
        engajamento: engajamento.detalhes,
        sentimento: sentimento.detalhes,
        tickets_abertos: ticketsAbertos.detalhes,
        tempo_sem_contato: tempoSemContato.detalhes,
        uso_plataforma: usoPlataforma.detalhes,
      },
      calculado_em: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[HealthScore] Erro ao calcular score completo:', error);
    return {
      score: null,
      status: 'erro',
      erro: error.message,
      calculado_em: new Date().toISOString(),
    };
  }
}

/**
 * Salva o health score calculado no cliente e no histórico
 * @param {Object} firestore - Instância do Firestore
 * @param {string} clienteId - ID do cliente
 * @param {Object} healthScore - Resultado de calcularHealthScoreCompleto
 * @returns {Promise<Object>} - Resultado da operação
 */
export async function salvarHealthScore(firestore, clienteId, healthScore) {
  try {
    const agora = new Date();
    const dataHoje = agora.toISOString().split('T')[0]; // YYYY-MM-DD

    // 1. Atualizar documento do cliente
    const clienteRef = doc(firestore, 'clientes', clienteId);
    await updateDoc(clienteRef, {
      health_score: healthScore.score,
      health_status: healthScore.status,
      health_componentes: healthScore.componentes,
      health_updated_at: Timestamp.now(),
    });

    // 2. Salvar no histórico
    const historyRef = doc(
      firestore,
      `clientes/${clienteId}/health_history`,
      dataHoje
    );

    await setDoc(historyRef, {
      hist_date: dataHoje,
      hist_score: healthScore.score,
      hist_status: healthScore.status,
      hist_componentes: healthScore.componentes,
      hist_detalhes: healthScore.detalhes,
      created_at: Timestamp.now(),
    });

    return { success: true, clienteId, date: dataHoje };
  } catch (error) {
    console.error('[HealthScore] Erro ao salvar health score:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Busca o histórico de health score de um cliente
 * @param {Object} firestore - Instância do Firestore
 * @param {string} clienteId - ID do cliente
 * @param {number} limite - Número de dias a buscar
 * @returns {Promise<Object[]>} - Array de registros de histórico
 */
export async function buscarHistoricoHealthScore(firestore, clienteId, limite = 30) {
  try {
    const historyQuery = query(
      collection(firestore, `clientes/${clienteId}/health_history`),
      orderBy('hist_date', 'desc'),
      fbLimit(limite)
    );

    const snapshot = await getDocs(historyQuery);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('[HealthScore] Erro ao buscar histórico:', error);
    return [];
  }
}

/**
 * Detecta mudanças de status que requerem alerta
 * @param {string} statusAnterior - Status anterior
 * @param {string} statusAtual - Status atual
 * @returns {Object|null} - Configuração do alerta ou null
 */
export function detectarMudancaStatus(statusAnterior, statusAtual) {
  const statusPrioridade = {
    saudavel: 4,
    atencao: 3,
    risco: 2,
    critico: 1,
  };

  const prioridadeAnterior = statusPrioridade[statusAnterior] || 4;
  const prioridadeAtual = statusPrioridade[statusAtual] || 4;

  // Alertar se piorou para risco ou crítico
  if (prioridadeAtual < prioridadeAnterior && prioridadeAtual <= 2) {
    return {
      tipo: statusAtual === 'critico' ? 'health_critico' : 'health_risco',
      severidade: statusAtual === 'critico' ? 'alta' : 'media',
      mensagem: `Health Score mudou de "${statusAnterior}" para "${statusAtual}"`,
    };
  }

  return null;
}

/**
 * Calcula tendência baseada no histórico
 * @param {Object[]} historico - Array de registros de histórico ordenados por data desc
 * @returns {Object} - { tendencia, variacao, periodo }
 */
export function calcularTendencia(historico) {
  if (!historico || historico.length < 2) {
    return { tendencia: 'estavel', variacao: 0, periodo: 'insuficiente' };
  }

  // Pegar últimos 7 registros
  const ultimos = historico.slice(0, 7);

  if (ultimos.length < 2) {
    return { tendencia: 'estavel', variacao: 0, periodo: 'insuficiente' };
  }

  const scoreAtual = ultimos[0].hist_score;
  const scoreAnterior = ultimos[ultimos.length - 1].hist_score;
  const variacao = scoreAtual - scoreAnterior;

  let tendencia;
  if (variacao > 10) {
    tendencia = 'subindo';
  } else if (variacao < -10) {
    tendencia = 'caindo';
  } else {
    tendencia = 'estavel';
  }

  return {
    tendencia,
    variacao,
    periodo: `${ultimos.length} dias`,
    score_inicial: scoreAnterior,
    score_final: scoreAtual,
  };
}

export default {
  // Constantes
  PESOS,
  STATUS_THRESHOLDS,

  // Cálculos individuais
  calcularEngajamento,
  calcularSentimento,
  calcularTicketsAbertos,
  calcularTempoSemContato,
  calcularUsoPlataforma,

  // Cálculo completo
  calcularHealthScoreCompleto,
  determinarStatus,

  // Persistência
  salvarHealthScore,
  buscarHistoricoHealthScore,

  // Análise
  detectarMudancaStatus,
  calcularTendencia,
};
