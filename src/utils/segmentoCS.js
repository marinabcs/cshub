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
 *
 * ESCALA: logins, projetos_criados, pecas_criadas, downloads
 * AI: creditos_consumidos (ou uso_ai_total para retrocompatibilidade)
 *
 * Os pesos sao configuraveis em Configuracoes > Saude CS
 */
function calcularEngajamentoScore(metricas, config = {}) {
  if (!metricas) return 0;

  // Pesos configuraveis
  const pesoLogins = config.peso_logins ?? 0.5;
  const pesoProjetos = config.peso_projetos ?? 3;
  const pesoPecas = config.peso_pecas ?? 2;
  const pesoDownloads = config.peso_downloads ?? 1;
  const pesoCreditos = config.peso_creditos ?? 1.5;

  // Extrair metricas (com fallbacks para retrocompatibilidade)
  const {
    logins = 0,
    projetos_criados = 0,
    pecas_criadas = 0,
    downloads = 0,
    creditos_consumidos = 0,
    uso_ai_total = 0  // fallback legado
  } = metricas;

  // Usar creditos_consumidos se disponivel, senao uso_ai_total
  const creditosIA = creditos_consumidos || uso_ai_total;

  return (logins * pesoLogins) +
         (projetos_criados * pesoProjetos) +
         (pecas_criadas * pesoPecas) +
         (downloads * pesoDownloads) +
         (creditosIA * pesoCreditos);
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
  // Reclamacoes em aberto (max permitido por nivel - 0 = nao aceita)
  // Bugs/erros reportados contam como reclamacao
  reclamacoes_crescimento: 0,      // CRESCIMENTO nao pode ter reclamacoes
  reclamacoes_estavel: 0,          // ESTAVEL nao pode ter reclamacoes
  reclamacoes_alerta: 2,           // ALERTA aceita ate 2 reclamacoes
  reclamacoes_resgate: 99,         // RESGATE aceita qualquer quantidade
  // Pesos do score de engajamento (ESCALA) - INTEIROS
  peso_logins: 1,                  // Peso para logins
  peso_projetos: 3,                // Peso para projetos criados
  peso_pecas: 2,                   // Peso para pecas/designs criados
  peso_downloads: 1,               // Peso para downloads
  // Pesos do score de engajamento (AI) - INTEIROS
  peso_creditos: 2,                // Peso para creditos de IA consumidos
  peso_ia: 2,                      // Legado: alias para peso_creditos
  // Critérios de Saída do Resgate (V1)
  saida_resgate_dias_ativos: 5,    // Dias ativos mínimos para sair do RESGATE
  saida_resgate_engajamento: 15,   // Score engajamento mínimo
  saida_resgate_bugs_zero: true,   // Exige 0 bugs para sair
};

/**
 * FUNCAO PRINCIPAL: Calcular segmento do cliente
 *
 * HIERARQUIA DE PRIORIDADE (NOVA REGRA V1):
 * 1. Bugs/Reclamacoes em aberto (OVERRIDE ABSOLUTO):
 *    - 2+ bugs → RESGATE (ignora tudo)
 *    - 1 bug → ALERTA (ignora tudo)
 *    - 0 bugs → segue para proximas regras
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


  // Montar objeto de fatores para debug/exibicao
  const fatores = {
    dias_ativos: diasAtivos,
    engajamento_score: engajamentoScore,
    reclamacoes_em_aberto: reclamacoesEmAberto,
    qtd_reclamacoes: qtdReclamacoes,
    sazonalidade: sazonalidade,
    tipo_conta: tipoConta,
    thresholds: {
      dias_ativos: { crescimento: thDiasAtivosCrescimento, estavel: thDiasAtivosEstavel, alerta: thDiasAtivosAlerta },
      engajamento: { crescimento: thEngajamentoCrescimento, estavel: thEngajamentoEstavel }
    }
  };

  // ============================================
  // 1. PRIORIDADE MAXIMA: REGRA DE BUGS (OVERRIDE ABSOLUTO)
  // ============================================
  // Nova regra V1: Bugs sobrepõem TODAS as outras métricas
  // - 2+ bugs/reclamações → RESGATE (mesmo com 25 dias ativos e score 150)
  // - 1 bug/reclamação → ALERTA (mesmo com métricas excelentes)
  // - 0 bugs → classificar por métricas normalmente

  if (qtdReclamacoes >= 2) {
    return {
      segmento: 'RESGATE',
      motivo: `${qtdReclamacoes} bugs/reclamações em aberto (regra: 2+ = Resgate)`,
      fatores
    };
  }

  if (qtdReclamacoes === 1) {
    return {
      segmento: 'ALERTA',
      motivo: `1 bug/reclamação em aberto (regra: 1 = Alerta)`,
      fatores
    };
  }

  // ============================================
  // 2. SEM BUGS: VERIFICAR CONDICOES DE RESGATE POR METRICAS
  // ============================================

  // Zero dias ativos = RESGATE
  if (diasAtivos === 0) {
    return { segmento: 'RESGATE', motivo: 'Sem atividade no mes', fatores };
  }

  // ============================================
  // 3. VERIFICAR DIAS ATIVOS MINIMOS
  // ============================================

  // Poucos dias ativos
  if (diasAtivos < thDiasAtivosAlerta) {
    return { segmento: 'ALERTA', motivo: `Apenas ${diasAtivos} dias ativos (minimo: ${thDiasAtivosAlerta})`, fatores };
  }

  // ============================================
  // 4. CLASSIFICACAO POSITIVA: ESTAVEL ou CRESCIMENTO
  // (Só chega aqui se não tem bugs)
  // ============================================

  // Verificar se atende criterios de CRESCIMENTO:
  // - Dias ativos >= threshold de crescimento
  // - Engajamento >= threshold de crescimento
  if (diasAtivos >= thDiasAtivosCrescimento && engajamentoScore >= thEngajamentoCrescimento) {
    return { segmento: 'CRESCIMENTO', motivo: `${diasAtivos} dias ativos + engajamento ${Math.round(engajamentoScore)}`, fatores };
  }

  // Verificar se atende criterios de ESTAVEL:
  // - Dias ativos >= threshold de estavel
  if (diasAtivos >= thDiasAtivosEstavel) {
    return { segmento: 'ESTAVEL', motivo: `${diasAtivos} dias ativos no mes`, fatores };
  }

  // ============================================
  // 5. ALERTA (fallback quando não atinge CRESCIMENTO/ESTÁVEL)
  // ============================================

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
