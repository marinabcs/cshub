/**
 * Audit Service
 * Sistema de auditoria e histórico para o CS Hub
 * Logs são append-only e nunca devem ser deletados
 */

import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit as fbLimit,
  getDocs,
  Timestamp,
} from 'firebase/firestore';

// Tipos de ações auditáveis
export const ACOES = {
  CLASSIFICACAO_THREAD: 'classificacao_thread',
  MUDANCA_STATUS: 'mudanca_status',
  ATRIBUICAO_RESPONSAVEL: 'atribuicao_responsavel',
  CRIACAO_ALERTA: 'criacao_alerta',
  RESOLUCAO_ALERTA: 'resolucao_alerta',
  EDICAO_CLIENTE: 'edicao_cliente',
  CRIACAO_NOTA: 'criacao_nota',
  ARQUIVAMENTO_THREAD: 'arquivamento_thread',
};

// Tipos de entidades
export const ENTIDADES = {
  THREAD: 'thread',
  CLIENTE: 'cliente',
  ALERTA: 'alerta',
};

// Nome da collection no Firestore
const COLLECTION_NAME = 'audit_logs';

/**
 * Obtém informações do usuário atual
 * @param {Object} auth - Instância do Firebase Auth
 * @returns {Object} - { email, nome }
 */
function getUsuarioAtual(auth) {
  const user = auth?.currentUser;

  if (!user) {
    return {
      email: 'sistema@cshub.local',
      nome: 'Sistema',
    };
  }

  return {
    email: user.email || 'desconhecido',
    nome: user.displayName || user.email?.split('@')[0] || 'Usuário',
  };
}

/**
 * Retorna null — IP do cliente não é coletado no frontend.
 * Caso necessário, obter server-side via Cloud Functions (req.ip).
 * @returns {Promise<null>}
 */
async function getClientIP() {
  return null;
}

/**
 * Registra uma ação de auditoria
 *
 * @param {Object} firestore - Instância do Firestore
 * @param {Object} auth - Instância do Firebase Auth
 * @param {Object} params - Parâmetros da ação
 * @param {string} params.acao - Tipo da ação (usar constantes ACOES)
 * @param {string} params.entidadeTipo - Tipo da entidade (usar constantes ENTIDADES)
 * @param {string} params.entidadeId - ID da entidade afetada
 * @param {Object} [params.dadosAnteriores] - Estado antes da mudança
 * @param {Object} [params.dadosNovos] - Estado após a mudança
 * @param {Object} [params.metadata] - Metadados adicionais
 * @returns {Promise<Object>} - { success: boolean, id?: string, error?: string }
 */
export async function registrarAcao(firestore, auth, params) {
  const {
    acao,
    entidadeTipo,
    entidadeId,
    dadosAnteriores = null,
    dadosNovos = null,
    metadata = {},
  } = params;

  // Validações básicas
  if (!acao || !entidadeTipo || !entidadeId) {
    console.warn('[Auditoria] Parâmetros obrigatórios ausentes:', { acao, entidadeTipo, entidadeId });
    return { success: false, error: 'Parâmetros obrigatórios ausentes' };
  }

  try {
    const usuario = getUsuarioAtual(auth);

    // Tentar obter IP em background (não bloqueia)
    const ipPromise = getClientIP();

    const logEntry = {
      acao,
      entidade_tipo: entidadeTipo,
      entidade_id: entidadeId,
      usuario_email: usuario.email,
      usuario_nome: usuario.nome,
      dados_anteriores: dadosAnteriores ? sanitizarDados(dadosAnteriores) : null,
      dados_novos: dadosNovos ? sanitizarDados(dadosNovos) : null,
      metadata: sanitizarDados(metadata),
      created_at: Timestamp.now(),
    };

    // Adicionar IP se disponível (com timeout curto)
    const ip = await Promise.race([
      ipPromise,
      new Promise((resolve) => setTimeout(() => resolve(null), 1000)),
    ]);

    if (ip) {
      logEntry.ip = ip;
    }

    const docRef = await addDoc(collection(firestore, COLLECTION_NAME), logEntry);

    return { success: true, id: docRef.id };
  } catch (error) {
    // Log de auditoria não deve quebrar o fluxo principal
    console.error('[Auditoria] Erro ao registrar ação:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Busca histórico de ações para uma entidade específica
 *
 * @param {Object} firestore - Instância do Firestore
 * @param {string} entidadeTipo - Tipo da entidade
 * @param {string} entidadeId - ID da entidade
 * @param {number} [limite=50] - Número máximo de registros
 * @returns {Promise<Object[]>} - Array de logs de auditoria
 */
export async function buscarHistorico(firestore, entidadeTipo, entidadeId, limite = 50) {
  try {
    const q = query(
      collection(firestore, COLLECTION_NAME),
      where('entidade_tipo', '==', entidadeTipo),
      where('entidade_id', '==', entidadeId),
      orderBy('created_at', 'desc'),
      fbLimit(limite)
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      created_at: doc.data().created_at?.toDate?.() || doc.data().created_at,
    }));
  } catch (error) {
    console.error('[Auditoria] Erro ao buscar histórico:', error.message);
    return [];
  }
}

/**
 * Busca ações realizadas por um usuário específico
 *
 * @param {Object} firestore - Instância do Firestore
 * @param {string} usuarioEmail - Email do usuário
 * @param {number} [limite=50] - Número máximo de registros
 * @returns {Promise<Object[]>} - Array de logs de auditoria
 */
export async function buscarAcoesPorUsuario(firestore, usuarioEmail, limite = 50) {
  try {
    const q = query(
      collection(firestore, COLLECTION_NAME),
      where('usuario_email', '==', usuarioEmail),
      orderBy('created_at', 'desc'),
      fbLimit(limite)
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      created_at: doc.data().created_at?.toDate?.() || doc.data().created_at,
    }));
  } catch (error) {
    console.error('[Auditoria] Erro ao buscar ações do usuário:', error.message);
    return [];
  }
}

/**
 * Busca logs de auditoria por tipo de ação
 *
 * @param {Object} firestore - Instância do Firestore
 * @param {string} acao - Tipo da ação
 * @param {number} [limite=50] - Número máximo de registros
 * @returns {Promise<Object[]>} - Array de logs de auditoria
 */
export async function buscarPorTipoAcao(firestore, acao, limite = 50) {
  try {
    const q = query(
      collection(firestore, COLLECTION_NAME),
      where('acao', '==', acao),
      orderBy('created_at', 'desc'),
      fbLimit(limite)
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      created_at: doc.data().created_at?.toDate?.() || doc.data().created_at,
    }));
  } catch (error) {
    console.error('[Auditoria] Erro ao buscar por tipo de ação:', error.message);
    return [];
  }
}

/**
 * Sanitiza dados para armazenamento (remove funções, undefined, etc)
 * @param {Object} dados - Dados a sanitizar
 * @returns {Object} - Dados sanitizados
 */
function sanitizarDados(dados) {
  if (!dados || typeof dados !== 'object') {
    return dados;
  }

  const sanitizado = {};

  for (const [key, value] of Object.entries(dados)) {
    // Ignora funções e undefined
    if (typeof value === 'function' || value === undefined) {
      continue;
    }

    // Converte Date para ISO string
    if (value instanceof Date) {
      sanitizado[key] = value.toISOString();
      continue;
    }

    // Recursivamente sanitiza objetos aninhados
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitizado[key] = sanitizarDados(value);
      continue;
    }

    // Arrays são mantidos (mas elementos são sanitizados)
    if (Array.isArray(value)) {
      sanitizado[key] = value.map((item) =>
        typeof item === 'object' ? sanitizarDados(item) : item
      );
      continue;
    }

    sanitizado[key] = value;
  }

  return sanitizado;
}

/**
 * Formata a descrição de uma ação para exibição
 * @param {Object} log - Log de auditoria
 * @returns {string} - Descrição formatada
 */
export function formatarDescricaoAcao(log) {
  const { acao, dados_anteriores, dados_novos } = log;

  switch (acao) {
    case ACOES.CLASSIFICACAO_THREAD:
      if (dados_anteriores?.categoria) {
        return `Reclassificou de "${dados_anteriores.categoria}" para "${dados_novos?.categoria}"`;
      }
      return `Classificou como "${dados_novos?.categoria}"`;

    case ACOES.MUDANCA_STATUS:
      return `Alterou status de "${dados_anteriores?.status || 'N/A'}" para "${dados_novos?.status}"`;

    case ACOES.ATRIBUICAO_RESPONSAVEL:
      if (dados_anteriores?.responsavel) {
        return `Transferiu responsável de "${dados_anteriores.responsavel}" para "${dados_novos?.responsavel}"`;
      }
      return `Atribuiu responsável: "${dados_novos?.responsavel}"`;

    case ACOES.CRIACAO_ALERTA:
      return `Criou alerta: "${dados_novos?.tipo || dados_novos?.titulo}"`;

    case ACOES.RESOLUCAO_ALERTA:
      return `Resolveu alerta: "${dados_anteriores?.tipo || dados_anteriores?.titulo}"`;

    case ACOES.EDICAO_CLIENTE:
      return 'Editou informações do cliente';

    case ACOES.CRIACAO_NOTA:
      return 'Adicionou nota';

    case ACOES.ARQUIVAMENTO_THREAD:
      return dados_novos?.arquivado ? 'Arquivou a thread' : 'Desarquivou a thread';

    default:
      return acao.replace(/_/g, ' ');
  }
}

/**
 * Retorna o ícone apropriado para uma ação
 * @param {string} acao - Tipo da ação
 * @returns {string} - Nome do ícone
 */
export function getIconeAcao(acao) {
  switch (acao) {
    case ACOES.CLASSIFICACAO_THREAD:
      return 'tag';
    case ACOES.MUDANCA_STATUS:
      return 'refresh-cw';
    case ACOES.ATRIBUICAO_RESPONSAVEL:
      return 'user-plus';
    case ACOES.CRIACAO_ALERTA:
      return 'alert-triangle';
    case ACOES.RESOLUCAO_ALERTA:
      return 'check-circle';
    case ACOES.EDICAO_CLIENTE:
      return 'edit';
    case ACOES.CRIACAO_NOTA:
      return 'file-text';
    case ACOES.ARQUIVAMENTO_THREAD:
      return 'archive';
    default:
      return 'activity';
  }
}

/**
 * Retorna a cor apropriada para uma ação
 * @param {string} acao - Tipo da ação
 * @returns {string} - Classe de cor CSS
 */
export function getCorAcao(acao) {
  switch (acao) {
    case ACOES.CLASSIFICACAO_THREAD:
      return 'blue';
    case ACOES.MUDANCA_STATUS:
      return 'purple';
    case ACOES.ATRIBUICAO_RESPONSAVEL:
      return 'green';
    case ACOES.CRIACAO_ALERTA:
      return 'orange';
    case ACOES.RESOLUCAO_ALERTA:
      return 'green';
    case ACOES.ARQUIVAMENTO_THREAD:
      return 'gray';
    default:
      return 'gray';
  }
}

// Helpers para integração fácil nos componentes

/**
 * Helper para registrar classificação de thread
 */
export async function registrarClassificacao(firestore, auth, threadId, categoriaAnterior, categoriaNova) {
  return registrarAcao(firestore, auth, {
    acao: ACOES.CLASSIFICACAO_THREAD,
    entidadeTipo: ENTIDADES.THREAD,
    entidadeId: threadId,
    dadosAnteriores: categoriaAnterior ? { categoria: categoriaAnterior } : null,
    dadosNovos: { categoria: categoriaNova },
  });
}

/**
 * Helper para registrar mudança de status
 */
export async function registrarMudancaStatus(firestore, auth, entidadeTipo, entidadeId, statusAnterior, statusNovo) {
  return registrarAcao(firestore, auth, {
    acao: ACOES.MUDANCA_STATUS,
    entidadeTipo,
    entidadeId,
    dadosAnteriores: { status: statusAnterior },
    dadosNovos: { status: statusNovo },
  });
}

/**
 * Helper para registrar atribuição de responsável
 */
export async function registrarAtribuicaoResponsavel(firestore, auth, entidadeTipo, entidadeId, responsavelAnterior, responsavelNovo) {
  return registrarAcao(firestore, auth, {
    acao: ACOES.ATRIBUICAO_RESPONSAVEL,
    entidadeTipo,
    entidadeId,
    dadosAnteriores: responsavelAnterior ? { responsavel: responsavelAnterior } : null,
    dadosNovos: { responsavel: responsavelNovo },
  });
}

/**
 * Helper para registrar criação de alerta
 */
export async function registrarCriacaoAlerta(firestore, auth, alertaId, dadosAlerta) {
  return registrarAcao(firestore, auth, {
    acao: ACOES.CRIACAO_ALERTA,
    entidadeTipo: ENTIDADES.ALERTA,
    entidadeId: alertaId,
    dadosAnteriores: null,
    dadosNovos: dadosAlerta,
  });
}

/**
 * Helper para registrar resolução de alerta
 */
export async function registrarResolucaoAlerta(firestore, auth, alertaId, dadosAlerta) {
  return registrarAcao(firestore, auth, {
    acao: ACOES.RESOLUCAO_ALERTA,
    entidadeTipo: ENTIDADES.ALERTA,
    entidadeId: alertaId,
    dadosAnteriores: dadosAlerta,
    dadosNovos: { resolvido: true, resolvidoEm: new Date() },
  });
}

export default {
  // Constantes
  ACOES,
  ENTIDADES,
  // Funções principais
  registrarAcao,
  buscarHistorico,
  buscarAcoesPorUsuario,
  buscarPorTipoAcao,
  // Helpers
  registrarClassificacao,
  registrarMudancaStatus,
  registrarAtribuicaoResponsavel,
  registrarCriacaoAlerta,
  registrarResolucaoAlerta,
  // Formatação
  formatarDescricaoAcao,
  getIconeAcao,
  getCorAcao,
};
