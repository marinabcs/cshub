/**
 * Segmento CS - Segmentacao de Clientes para CS Hub
 *
 * Classifica clientes em 4 segmentos baseado em dados diretos:
 * - CRESCIMENTO: Melhores clientes com potencial de expansao
 * - ESTAVEL: Clientes estaveis para manter
 * - ALERTA: Clientes com sinais de alerta
 * - RESGATE: Clientes criticos em risco de churn
 */

// Mapa de compatibilidade para valores antigos (ingles -> portugues)
const LEGACY_SEGMENT_MAP = {
  'GROW': 'CRESCIMENTO',
  'NURTURE': 'ESTAVEL',
  'WATCH': 'ALERTA',
  'RESCUE': 'RESGATE'
};

/**
 * Normaliza valor de segmento (converte legado EN para PT)
 */
function normalizarSegmento(segmento) {
  return LEGACY_SEGMENT_MAP[segmento] || segmento;
}

// Constantes dos segmentos
export const SEGMENTOS_CS = {
  CRESCIMENTO: {
    value: 'CRESCIMENTO',
    label: 'Crescimento',
    description: 'Melhores clientes - alto potencial de expansao',
    color: '#10b981',
    bgColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
    icon: 'TrendingUp',
    priority: 1,
    criterios: [
      'Uso frequente (semanal+)',
      'Responde rapido',
      'Engajado com features',
      'Sem reclamacoes'
    ],
    acoes: [
      'Propor upsell de licencas',
      'Oferecer recursos premium',
      'Agendar QBR estrategico',
      'Solicitar case de sucesso'
    ]
  },
  ESTAVEL: {
    value: 'ESTAVEL',
    label: 'Estavel',
    description: 'Clientes estaveis - manter engajamento',
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
    icon: 'Heart',
    priority: 2,
    criterios: [
      'Uso regular',
      'Sem reclamacoes',
      'Time estavel',
      'Relacionamento saudavel'
    ],
    acoes: [
      'Check-in mensal',
      'Compartilhar novidades',
      'Oferecer treinamentos',
      'Monitorar renovacao'
    ]
  },
  ALERTA: {
    value: 'ALERTA',
    label: 'Alerta',
    description: 'Atencao necessaria - sinais de risco',
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.3)',
    icon: 'Eye',
    priority: 3,
    criterios: [
      'Uso caindo ou irregular',
      'Demora a responder',
      'Reclamacoes recentes',
      '14+ dias sem atividade'
    ],
    acoes: [
      'Agendar call de discovery',
      'Identificar pain points',
      'Verificar se champion saiu',
      'Propor plano de acao'
    ]
  },
  RESGATE: {
    value: 'RESGATE',
    label: 'Resgate',
    description: 'Critico - risco iminente de churn',
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    icon: 'AlertTriangle',
    priority: 4,
    criterios: [
      'Sem uso 30+ dias',
      'Nao responde',
      'Mencionou cancelar',
      'Reclamacao grave'
    ],
    acoes: [
      'Ligar urgente para stakeholder',
      'Escalar para lideranca',
      'Oferecer condicoes especiais',
      'Entender motivo',
      'Aplicar playbook de resgate'
    ]
  }
};

// Lista ordenada para selects
export const SEGMENTO_OPTIONS = [
  SEGMENTOS_CS.CRESCIMENTO,
  SEGMENTOS_CS.ESTAVEL,
  SEGMENTOS_CS.ALERTA,
  SEGMENTOS_CS.RESGATE
];

// Segmento default
export const DEFAULT_SEGMENTO = 'ESTAVEL';

/**
 * Obter info do segmento (com compatibilidade para valores legados)
 */
export function getSegmentoInfo(segmento) {
  const normalized = normalizarSegmento(segmento);
  return SEGMENTOS_CS[normalized] || null;
}

/**
 * Obter cor do segmento
 */
export function getSegmentoColor(segmento) {
  const normalized = normalizarSegmento(segmento);
  return SEGMENTOS_CS[normalized]?.color || '#6b7280';
}

/**
 * Obter cor de fundo do segmento
 */
export function getSegmentoBgColor(segmento) {
  const normalized = normalizarSegmento(segmento);
  return SEGMENTOS_CS[normalized]?.bgColor || 'rgba(107, 114, 128, 0.15)';
}

/**
 * Obter label do segmento
 */
export function getSegmentoLabel(segmento) {
  const normalized = normalizarSegmento(segmento);
  return SEGMENTOS_CS[normalized]?.label || segmento;
}

/**
 * Obter acoes recomendadas
 */
export function getSegmentoAcoes(segmento) {
  const normalized = normalizarSegmento(segmento);
  return SEGMENTOS_CS[normalized]?.acoes || [];
}

// ============================================
// CALCULO SIMPLIFICADO - BASEADO EM METRICAS DIRETAS
// ============================================

/**
 * Calcular dias desde ultima atividade
 */
function calcularDiasSemUso(cliente, metricas) {
  const now = new Date();
  let ultimaAtividade = null;

  // Tentar pegar de metricas
  if (metricas?.ultima_atividade) {
    ultimaAtividade = metricas.ultima_atividade?.toDate?.()
      || new Date(metricas.ultima_atividade);
  }

  // Fallback para campos do cliente
  if (!ultimaAtividade && cliente?.ultima_interacao) {
    ultimaAtividade = cliente.ultima_interacao?.toDate?.()
      || new Date(cliente.ultima_interacao);
  }

  if (!ultimaAtividade && cliente?.updated_at) {
    ultimaAtividade = cliente.updated_at?.toDate?.()
      || new Date(cliente.updated_at);
  }

  if (!ultimaAtividade) return 999;

  const diff = Math.floor((now - ultimaAtividade) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

/**
 * Verificar frequencia de uso
 * Retorna: 'frequente' | 'regular' | 'irregular' | 'raro' | 'sem_uso'
 */
function calcularFrequenciaUso(metricas, totalUsers = 1) {
  if (!metricas) return 'sem_uso';

  const { logins = 0, dias_ativos = 0 } = metricas;
  const loginsPerUser = logins / Math.max(totalUsers, 1);

  // Frequente: uso semanal (20+ dias ativos ou 15+ logins/user)
  if (dias_ativos >= 20 || loginsPerUser >= 15) return 'frequente';
  // Regular: uso quinzenal/mensal consistente
  if (dias_ativos >= 8 || loginsPerUser >= 6) return 'regular';
  // Irregular: algum uso mas inconsistente
  if (dias_ativos >= 3 || loginsPerUser >= 2) return 'irregular';
  // Raro: muito pouco uso
  if (dias_ativos >= 1 || logins > 0) return 'raro';

  return 'sem_uso';
}

/**
 * Verificar reclamacoes recentes (ultimos 30 dias)
 */
function temReclamacoesRecentes(threads) {
  if (!threads || threads.length === 0) return false;

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  return threads.some(t => {
    const date = t.updated_at?.toDate?.()
      || (t.updated_at?.seconds ? new Date(t.updated_at.seconds * 1000) : null)
      || new Date(t.updated_at);

    const isRecent = date && date >= thirtyDaysAgo;
    const isNegative = t.sentimento === 'negativo' || t.sentimento === 'urgente';
    const isComplaint = t.categoria === 'reclamacao' || t.categoria === 'erro_bug';

    return isRecent && (isNegative || isComplaint);
  });
}

/**
 * Verificar reclamacao grave (urgente nos ultimos 7 dias)
 */
function temReclamacaoGrave(threads) {
  if (!threads || threads.length === 0) return false;

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  return threads.some(t => {
    const date = t.updated_at?.toDate?.()
      || (t.updated_at?.seconds ? new Date(t.updated_at.seconds * 1000) : null)
      || new Date(t.updated_at);

    const isRecent = date && date >= sevenDaysAgo;
    return isRecent && t.sentimento === 'urgente';
  });
}

/**
 * Verificar engajamento com features
 */
function calcularEngajamento(metricas) {
  if (!metricas) return 'baixo';

  const { pecas_criadas = 0, uso_ai_total = 0, downloads = 0 } = metricas;
  const score = (pecas_criadas * 2) + (uso_ai_total * 1.5) + downloads;

  if (score >= 50) return 'alto';
  if (score >= 15) return 'medio';
  return 'baixo';
}

/**
 * FUNCAO PRINCIPAL: Calcular segmento do cliente
 *
 * Usa dados diretos de metricas
 *
 * @param {Object} cliente - Documento do cliente
 * @param {Array} threads - Threads recentes
 * @param {Object} metricas - Metricas agregadas (ultimos 30 dias)
 * @param {number} totalUsers - Total de usuarios
 * @returns {Object} { segmento, motivo, fatores }
 */
export function calcularSegmentoCS(cliente, threads = [], metricas = {}, totalUsers = 1) {
  // Calcular fatores
  const diasSemUso = calcularDiasSemUso(cliente, metricas);
  const frequenciaUso = calcularFrequenciaUso(metricas, totalUsers);
  const reclamacoesRecentes = temReclamacoesRecentes(threads);
  const reclamacaoGrave = temReclamacaoGrave(threads);
  const engajamento = calcularEngajamento(metricas);

  // Flags especiais
  const emAvisoPrevio = cliente?.status === 'aviso_previo';
  const championSaiu = cliente?.champion_saiu === true;

  // Montar objeto de fatores
  const fatores = {
    dias_sem_uso: diasSemUso,
    frequencia_uso: frequenciaUso,
    reclamacoes_recentes: reclamacoesRecentes,
    reclamacao_grave: reclamacaoGrave,
    engajamento: engajamento,
    em_aviso_previo: emAvisoPrevio,
    champion_saiu: championSaiu
  };

  // ============================================
  // LOGICA DE CLASSIFICACAO (ordem de prioridade)
  // ============================================

  // 1. RESGATE - Critico (verificar primeiro)
  if (emAvisoPrevio) {
    return { segmento: 'RESGATE', motivo: 'Em aviso previo', fatores };
  }
  if (diasSemUso >= 30) {
    return { segmento: 'RESGATE', motivo: `${diasSemUso} dias sem uso`, fatores };
  }
  if (reclamacaoGrave) {
    return { segmento: 'RESGATE', motivo: 'Reclamacao grave recente', fatores };
  }
  if (frequenciaUso === 'sem_uso' && reclamacoesRecentes) {
    return { segmento: 'RESGATE', motivo: 'Sem uso + reclamacoes', fatores };
  }

  // 2. ALERTA - Atencao
  if (diasSemUso >= 14) {
    return { segmento: 'ALERTA', motivo: `${diasSemUso} dias sem uso`, fatores };
  }
  if (reclamacoesRecentes) {
    return { segmento: 'ALERTA', motivo: 'Reclamacoes recentes', fatores };
  }
  if (championSaiu) {
    return { segmento: 'ALERTA', motivo: 'Champion saiu', fatores };
  }
  if (frequenciaUso === 'raro' || frequenciaUso === 'sem_uso') {
    return { segmento: 'ALERTA', motivo: 'Uso raro ou inexistente', fatores };
  }
  if (frequenciaUso === 'irregular') {
    return { segmento: 'ALERTA', motivo: 'Uso irregular', fatores };
  }

  // 2.5 GUARDA: Zero producao real nao pode ser ESTAVEL ou CRESCIMENTO
  // Cliente pode ter logins mas nao produz nada na plataforma
  if ((metricas?.pecas_criadas || 0) === 0 && (metricas?.downloads || 0) === 0 && (metricas?.uso_ai_total || 0) === 0) {
    if (diasSemUso >= 7) {
      return { segmento: 'RESGATE', motivo: 'Sem producao e sem uso recente', fatores };
    }
    return { segmento: 'ALERTA', motivo: 'Login sem producao (0 pecas, 0 downloads, 0 AI)', fatores };
  }

  // 3. CRESCIMENTO - Potencial de expansao
  if (frequenciaUso === 'frequente' && engajamento === 'alto' && !reclamacoesRecentes) {
    return { segmento: 'CRESCIMENTO', motivo: 'Uso frequente + alto engajamento', fatores };
  }
  if (frequenciaUso === 'frequente' && engajamento === 'medio' && !reclamacoesRecentes) {
    return { segmento: 'CRESCIMENTO', motivo: 'Uso frequente + bom engajamento', fatores };
  }

  // 4. ESTAVEL - Default (clientes estaveis)
  return { segmento: 'ESTAVEL', motivo: 'Cliente estavel', fatores };
}

/**
 * Obter segmento do cliente (valor salvo, com normalizacao de legado)
 */
export function getClienteSegmento(cliente) {
  const raw = cliente?.segmento_cs || DEFAULT_SEGMENTO;
  return normalizarSegmento(raw);
}

/**
 * Verificar se segmento foi definido manualmente
 */
export function isSegmentoOverride(cliente) {
  return cliente?.segmento_override === true;
}
