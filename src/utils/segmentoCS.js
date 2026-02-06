/**
 * Segmento CS - Segmentacao de Clientes para CS Hub
 *
 * Classifica clientes em 4 segmentos baseado em dados diretos:
 * - CRESCIMENTO: Melhores clientes com potencial de expansao
 * - ESTAVEL: Clientes estaveis para manter
 * - ALERTA: Clientes com sinais de alerta
 * - RESGATE: Clientes criticos em risco de churn
 *
 * ============================================
 * HIERARQUIA DE CLASSIFICACAO (ordem de prioridade)
 * ============================================
 *
 * A classificacao segue uma ordem estrita de prioridade:
 *
 * 1. RECLAMACOES EM ABERTO (veto absoluto)
 *    - Se houver reclamacao em aberto: ALERTA ou RESGATE
 *    - Ignora os outros pilares
 *    - 3+ reclamacoes em aberto = RESGATE direto
 *
 * 2. DIAS ATIVOS (base da classificacao)
 *    - Se nao houver reclamacao e >= X dias ativos: ESTAVEL
 *    - Independente do engajamento
 *
 * 3. ENGAJAMENTO (elevacao)
 *    - Se nao houver reclamacao + >= Y dias ativos + score >= Z: CRESCIMENTO
 *    - Unico caminho para CRESCIMENTO
 *
 * Os valores X, Y, Z sao configuraveis em Configuracoes > Saude CS
 *
 * ============================================
 * AJUSTE POR SAZONALIDADE
 * ============================================
 *
 * O software considera que clientes tem campanhas sazonais.
 * - Mes de ALTA: thresholds normais
 * - Mes de BAIXA: thresholds divididos por 2 (mais leniente)
 * - Mes NORMAL: thresholds normais
 *
 * Configurado no calendario_campanhas do cliente.
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
      'Uso frequente',
      'Alto engajamento',
      'Sem reclamacoes em aberto'
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
      'Sem reclamacoes em aberto',
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
      'Reclamacoes em aberto',
      'Poucos dias ativos',
      'Uso irregular'
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
      '3+ reclamacoes em aberto',
      'Sem dias ativos no mes',
      'Em aviso previo'
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
 * Acoes padrao por segmento (usado como fallback se config/ongoing nao existir)
 */
export const DEFAULT_ONGOING_ACOES = {
  CRESCIMENTO: SEGMENTOS_CS.CRESCIMENTO.acoes,
  ESTAVEL: SEGMENTOS_CS.ESTAVEL.acoes,
  ALERTA: SEGMENTOS_CS.ALERTA.acoes,
  RESGATE: SEGMENTOS_CS.RESGATE.acoes,
};

/**
 * Obter acoes recomendadas (aceita config do Firestore como override)
 */
export function getSegmentoAcoes(segmento, ongoingConfig) {
  const normalized = normalizarSegmento(segmento);
  if (ongoingConfig?.[normalized]) return ongoingConfig[normalized];
  return SEGMENTOS_CS[normalized]?.acoes || [];
}

// ============================================
// FUNCOES AUXILIARES
// ============================================

// Mapa mes JS (0-11) -> chave do calendario de campanhas
export const MESES_KEYS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function getSazonalidadeMesAtual(cliente) {
  const calendario = cliente?.calendario_campanhas;
  if (!calendario) return 'normal';
  const mesKey = MESES_KEYS[new Date().getMonth()];
  return calendario[mesKey] || 'normal';
}

/**
 * Verificar reclamacoes em aberto (nao resolvidas)
 * Considera threads com sentimento negativo/urgente ou categoria reclamacao/erro
 * que ainda nao foram marcadas como resolvidas
 */
function temReclamacoesEmAberto(threads) {
  if (!threads || threads.length === 0) return false;

  return threads.some(t => {
    const isNegative = t.sentimento === 'negativo' || t.sentimento === 'urgente';
    const isComplaint = t.categoria === 'reclamacao' || t.categoria === 'erro_bug';
    const isOpen = !t.resolvido && t.status !== 'resolvido' && t.status !== 'fechado' && t.status !== 'closed';

    return (isNegative || isComplaint) && isOpen;
  });
}

/**
 * Contar reclamacoes em aberto
 */
function contarReclamacoesEmAberto(threads) {
  if (!threads || threads.length === 0) return 0;

  return threads.filter(t => {
    const isNegative = t.sentimento === 'negativo' || t.sentimento === 'urgente';
    const isComplaint = t.categoria === 'reclamacao' || t.categoria === 'erro_bug';
    const isOpen = !t.resolvido && t.status !== 'resolvido' && t.status !== 'fechado' && t.status !== 'closed';

    return (isNegative || isComplaint) && isOpen;
  }).length;
}

/**
 * Calcular score de engajamento
 * Score = (pecas x peso_pecas) + (IA x peso_ia) + (downloads x peso_downloads)
 * Os pesos sao configuraveis
 */
function calcularEngajamentoScore(metricas, config = {}) {
  if (!metricas) return 0;
  const pesoPecas = config.peso_pecas ?? 2;
  const pesoIA = config.peso_ia ?? 1.5;
  const pesoDownloads = config.peso_downloads ?? 1;
  const { pecas_criadas = 0, uso_ai_total = 0, downloads = 0 } = metricas;
  return (pecas_criadas * pesoPecas) + (uso_ai_total * pesoIA) + (downloads * pesoDownloads);
}

/**
 * Configuracao padrao para os thresholds de Saude CS
 * Estes valores podem ser sobrescritos pela config do Firestore
 */
export const DEFAULT_SAUDE_CONFIG = {
  // Dias ativos no mes (por nivel)
  dias_ativos_crescimento: 20,
  dias_ativos_estavel: 8,
  dias_ativos_alerta: 3,
  dias_ativos_resgate: 0,
  // Score de engajamento (por nivel)
  engajamento_crescimento: 50,
  engajamento_estavel: 15,
  engajamento_alerta: 1,
  engajamento_resgate: 0,
  // Reclamacoes em aberto - se TRUE, esse nivel considera reclamacoes
  reclamacoes_crescimento: false,  // CRESCIMENTO nao pode ter reclamacoes
  reclamacoes_estavel: false,      // ESTAVEL nao pode ter reclamacoes
  reclamacoes_alerta: true,        // ALERTA pode ter reclamacoes
  reclamacoes_resgate: true,       // RESGATE pode ter reclamacoes
  // Thresholds adicionais
  reclamacoes_max_resgate: 3,      // Qtd de reclamacoes que manda direto para RESGATE
  bugs_max_alerta: 3,              // Qtd de bugs abertos que dispara ALERTA
  // Toggles de regras especiais
  aviso_previo_resgate: true,      // Aviso previo = RESGATE automatico
  champion_saiu_alerta: true,      // Champion saiu = ALERTA
  tags_problema_alerta: true,      // Tags de problema = ALERTA
  zero_producao_alerta: true,      // Zero producao = ALERTA
  // Pesos do score de engajamento
  peso_pecas: 2,                   // Peso para pecas criadas
  peso_ia: 1.5,                    // Peso para uso de IA
  peso_downloads: 1,               // Peso para downloads
};

/**
 * FUNCAO PRINCIPAL: Calcular segmento do cliente
 *
 * HIERARQUIA DE PRIORIDADE:
 * 1. Reclamacoes em aberto (veto) -> ALERTA/RESGATE
 * 2. Dias ativos (base) -> Define nivel base
 * 3. Engajamento (elevacao) -> Pode subir para CRESCIMENTO
 *
 * @param {Object} cliente - Documento do cliente
 * @param {Array} threads - Threads do cliente
 * @param {Object} metricas - Metricas agregadas (ultimos 30 dias)
 * @param {number} totalUsers - Total de usuarios
 * @param {Object} config - Configuracao de thresholds (opcional)
 * @returns {Object} { segmento, motivo, fatores }
 */
export function calcularSegmentoCS(cliente, threads = [], metricas = {}, totalUsers = 1, config = {}) {
  // Mesclar config com defaults
  const cfg = { ...DEFAULT_SAUDE_CONFIG, ...config };

  // ============================================
  // CALCULAR FATORES
  // ============================================

  const diasAtivos = metricas?.dias_ativos || 0;
  const engajamentoScore = calcularEngajamentoScore(metricas, cfg);
  const reclamacoesEmAberto = temReclamacoesEmAberto(threads);
  const qtdReclamacoes = contarReclamacoesEmAberto(threads);

  // Sazonalidade: mes de baixa divide thresholds por 2 (mais leniente)
  const sazonalidade = getSazonalidadeMesAtual(cliente);
  const divisorSazonalidade = sazonalidade === 'baixa' ? 2 : 1;

  // Tipo de conta: google_gratuito divide thresholds por 2
  const tipoConta = cliente?.tipo_conta || 'pagante';
  const divisorConta = tipoConta === 'google_gratuito' ? 2 : 1;

  // Divisor total
  const divisor = divisorSazonalidade * divisorConta;

  // Thresholds ajustados
  const thDiasAtivosCrescimento = Math.ceil(cfg.dias_ativos_crescimento / divisor);
  const thDiasAtivosEstavel = Math.ceil(cfg.dias_ativos_estavel / divisor);
  const thDiasAtivosAlerta = Math.ceil(cfg.dias_ativos_alerta / divisor);

  const thEngajamentoCrescimento = Math.ceil(cfg.engajamento_crescimento / divisor);
  const thEngajamentoEstavel = Math.ceil(cfg.engajamento_estavel / divisor);

  // Flags especiais
  const emAvisoPrevio = cliente?.status === 'aviso_previo';
  const championSaiu = cliente?.champion_saiu === true;
  const temTagsProblema = (cliente?.tags_problema || []).length > 0;
  const bugsAbertos = (cliente?.bugs_reportados || []).filter(b => b.status !== 'resolvido').length;

  // Zero producao
  const zeroProd = (metricas?.pecas_criadas || 0) === 0 &&
                   (metricas?.downloads || 0) === 0 &&
                   (metricas?.uso_ai_total || 0) === 0;

  // Montar objeto de fatores para debug/exibicao
  const fatores = {
    dias_ativos: diasAtivos,
    engajamento_score: engajamentoScore,
    reclamacoes_em_aberto: reclamacoesEmAberto,
    qtd_reclamacoes: qtdReclamacoes,
    sazonalidade: sazonalidade,
    tipo_conta: tipoConta,
    em_aviso_previo: emAvisoPrevio,
    champion_saiu: championSaiu,
    zero_producao: zeroProd,
    thresholds: {
      dias_ativos: { crescimento: thDiasAtivosCrescimento, estavel: thDiasAtivosEstavel, alerta: thDiasAtivosAlerta },
      engajamento: { crescimento: thEngajamentoCrescimento, estavel: thEngajamentoEstavel }
    }
  };

  // ============================================
  // 1. PRIORIDADE MAXIMA: CONDICOES DE RESGATE
  // ============================================

  // Aviso previo = RESGATE automatico (se toggle ativo)
  if (cfg.aviso_previo_resgate && emAvisoPrevio) {
    return { segmento: 'RESGATE', motivo: 'Em aviso previo', fatores };
  }

  // X+ reclamacoes em aberto = RESGATE (threshold configuravel)
  const thReclamacoesResgate = cfg.reclamacoes_max_resgate ?? 3;
  if (qtdReclamacoes >= thReclamacoesResgate) {
    return { segmento: 'RESGATE', motivo: `${qtdReclamacoes} reclamacoes em aberto (limite: ${thReclamacoesResgate})`, fatores };
  }

  // Zero dias ativos + zero producao = RESGATE
  if (diasAtivos === 0 && zeroProd) {
    return { segmento: 'RESGATE', motivo: 'Sem atividade e sem producao no mes', fatores };
  }

  // ============================================
  // 2. PRIORIDADE MEDIA: OUTRAS CONDICOES DE ALERTA
  // ============================================

  // Champion saiu (se toggle ativo)
  if (cfg.champion_saiu_alerta && championSaiu) {
    return { segmento: 'ALERTA', motivo: 'Champion saiu', fatores };
  }

  // Tags de problema ativas (se toggle ativo)
  if (cfg.tags_problema_alerta && temTagsProblema) {
    return { segmento: 'ALERTA', motivo: 'Tags de problema ativas', fatores };
  }

  // Muitos bugs abertos (threshold configuravel)
  const thBugsAlerta = cfg.bugs_max_alerta ?? 3;
  if (bugsAbertos >= thBugsAlerta) {
    return { segmento: 'ALERTA', motivo: `${bugsAbertos} bugs abertos (limite: ${thBugsAlerta})`, fatores };
  }

  // Zero producao (se toggle ativo - logou sem produzir)
  if (cfg.zero_producao_alerta && zeroProd) {
    return { segmento: 'ALERTA', motivo: 'Login sem producao (0 pecas, 0 downloads, 0 AI)', fatores };
  }

  // Poucos dias ativos
  if (diasAtivos < thDiasAtivosAlerta) {
    return { segmento: 'ALERTA', motivo: `Apenas ${diasAtivos} dias ativos (minimo: ${thDiasAtivosAlerta})`, fatores };
  }

  // ============================================
  // 3. CLASSIFICACAO POSITIVA: ESTAVEL ou CRESCIMENTO
  // Reclamacoes sao verificadas conforme config (toggles)
  // ============================================

  // Verificar se atende criterios de CRESCIMENTO:
  // - Dias ativos >= threshold de crescimento
  // - Engajamento >= threshold de crescimento
  // - Se reclamacoes_crescimento = false (Não), ter reclamação impede CRESCIMENTO
  const podeSerCrescimento = !reclamacoesEmAberto || cfg.reclamacoes_crescimento;

  if (podeSerCrescimento && diasAtivos >= thDiasAtivosCrescimento && engajamentoScore >= thEngajamentoCrescimento) {
    return { segmento: 'CRESCIMENTO', motivo: `${diasAtivos} dias ativos + engajamento ${engajamentoScore}`, fatores };
  }

  // Verificar se atende criterios de ESTAVEL:
  // - Dias ativos >= threshold de estavel
  // - Se reclamacoes_estavel = false (Não), ter reclamação impede ESTÁVEL
  const podeSerEstavel = !reclamacoesEmAberto || cfg.reclamacoes_estavel;

  if (podeSerEstavel && diasAtivos >= thDiasAtivosEstavel) {
    return { segmento: 'ESTAVEL', motivo: `${diasAtivos} dias ativos no mes`, fatores };
  }

  // ============================================
  // 4. ALERTA (fallback quando não atinge CRESCIMENTO/ESTÁVEL)
  // ============================================

  // Se tem reclamação e não pode ser ESTÁVEL, vai para ALERTA
  if (reclamacoesEmAberto) {
    return { segmento: 'ALERTA', motivo: `${qtdReclamacoes} reclamacao(es) em aberto`, fatores };
  }

  // Fallback para ALERTA (dias ativos entre alerta e estavel)
  return { segmento: 'ALERTA', motivo: `${diasAtivos} dias ativos (abaixo do ideal: ${thDiasAtivosEstavel})`, fatores };
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
