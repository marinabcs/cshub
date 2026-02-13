// ClickUp API Integration (via Cloud Function)
import { httpsCallable } from 'firebase/functions';
import { logger } from '../utils/logger';
import { sanitizeError } from '../utils/sanitizeError';
import { functions } from './firebase';

const clickupProxyFn = httpsCallable(functions, 'clickupProxy');

const CLICKUP_LIST_ID = import.meta.env.VITE_CLICKUP_LIST_ID || '';
const CLICKUP_TEAM_ID = import.meta.env.VITE_CLICKUP_TEAM_ID || '';

// Verificar se ClickUp está configurado (LIST_ID é config, não secret)
export function isClickUpConfigured() {
  return !!CLICKUP_LIST_ID;
}

// Mapear prioridade CS Hub → ClickUp (1=urgente, 2=alta, 3=normal, 4=baixa)
const PRIORIDADE_MAP = {
  'urgente': 1,
  'alta': 2,
  'media': 3,
  'baixa': 4
};

// Labels de prioridade
export const PRIORIDADES_CLICKUP = [
  { value: 1, label: 'Urgente', color: '#f50000' },
  { value: 2, label: 'Alta', color: '#ffcc00' },
  { value: 3, label: 'Normal', color: '#6fddff' },
  { value: 4, label: 'Baixa', color: '#d8d8d8' }
];

/**
 * Criar tarefa no ClickUp a partir de um alerta
 */
export async function criarTarefaClickUp(alerta, opcoes = {}) {
  if (!isClickUpConfigured()) {
    throw new Error('ClickUp não está configurado. Verifique as variáveis de ambiente.');
  }

  // Nome do cliente para incluir no título
  const clienteNome = alerta.cliente_nome || alerta.time_name || '';
  const tituloComCliente = clienteNome
    ? `[CS Hub] ${clienteNome} - ${alerta.titulo}`
    : `[CS Hub] ${alerta.titulo}`;

  const {
    nome = tituloComCliente,
    descricao = montarDescricao(alerta),
    prioridade = PRIORIDADE_MAP[alerta.prioridade] || 3,
    responsavelId = null,
    responsaveisIds = [],
    dataVencimento = null,
    listId = null
  } = opcoes;

  const body = {
    name: nome,
    description: descricao,
    priority: prioridade
  };

  // Adicionar responsáveis (múltiplos ou único)
  if (responsaveisIds && responsaveisIds.length > 0) {
    body.assignees = responsaveisIds.map(id => parseInt(id, 10));
  } else if (responsavelId) {
    body.assignees = [parseInt(responsavelId, 10)];
  }

  // Adicionar data de vencimento se fornecida (ClickUp espera timestamp em ms)
  if (dataVencimento) {
    const dueDate = dataVencimento instanceof Date
      ? dataVencimento
      : dataVencimento.toDate
        ? dataVencimento.toDate()
        : new Date(dataVencimento);
    body.due_date = dueDate.getTime();
  }

  const targetListId = listId || CLICKUP_LIST_ID;

  try {
    const result = await clickupProxyFn({
      action: 'createTask',
      payload: { listId: targetListId, body }
    });
    return result.data;
  } catch (error) {
    logger.error('Erro ao criar tarefa ClickUp', sanitizeError(error));
    throw new Error('Erro ao criar tarefa no ClickUp');
  }
}

// Cache de membros do ClickUp para evitar múltiplas requisições
let membrosCache = null;
let membrosCacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

/**
 * Buscar ID do usuário no ClickUp pelo email
 */
// eslint-disable-next-line no-unused-vars
async function buscarUsuarioClickUpPorEmail(email) {
  if (!email) return null;

  // Verificar cache
  const agora = Date.now();
  if (!membrosCache || agora - membrosCacheTime > CACHE_DURATION) {
    membrosCache = await buscarMembrosClickUp();
    membrosCacheTime = agora;
  }

  const membro = membrosCache.find(m =>
    m.email?.toLowerCase() === email.toLowerCase()
  );

  return membro?.id || null;
}

/**
 * Buscar IDs de múltiplos usuários no ClickUp pelos emails
 * @param {Array} emails - Array de emails
 * @returns {Array} Array de IDs do ClickUp
 */
export async function buscarUsuariosClickUpPorEmails(emails) {
  if (!emails || emails.length === 0) return [];

  // Verificar cache
  const agora = Date.now();
  if (!membrosCache || agora - membrosCacheTime > CACHE_DURATION) {
    membrosCache = await buscarMembrosClickUp();
    membrosCacheTime = agora;
  }

  const ids = [];
  for (const email of emails) {
    const membro = membrosCache.find(m =>
      m.email?.toLowerCase() === email.toLowerCase()
    );
    if (membro?.id) {
      ids.push(membro.id);
    }
  }

  return ids;
}

/**
 * Criar tarefa no ClickUp para etapa de playbook
 */
export async function criarTarefaPlaybook(etapa, playbook, cliente, opcoes = {}) {
  if (!isClickUpConfigured()) {
    logger.warn('ClickUp não configurado - pulando criação de tarefa');
    return null;
  }

  // Pegar o nome da etapa (pode ser 'titulo', 'nome' ou 'name')
  const nomeEtapa = etapa.titulo || etapa.nome || etapa.name || `Etapa ${etapa.ordem}`;

  // Pegar nome do cliente
  const clienteNome = cliente.team_name || cliente.nome || 'N/A';

  // Título inclui: [Playbook] Cliente - Etapa
  const nome = `[${playbook.nome}] ${clienteNome} - ${nomeEtapa}`;

  // Pegar todos os responsáveis do cliente (array ou fallback para single)
  const responsaveisEmails = cliente.responsaveis?.map(r => r.email) ||
                             (cliente.responsavel_email ? [cliente.responsavel_email] : []);
  const responsaveisNomes = cliente.responsaveis?.map(r => r.nome).join(', ') ||
                            cliente.responsavel_nome || 'N/A';

  const descricao = `
**Playbook:** ${playbook.nome}
**Cliente:** ${clienteNome}
**Responsáveis:** ${responsaveisNomes}
**Etapa:** ${etapa.ordem}/${playbook.etapas?.length || '?'}

**Descrição da Etapa:**
${etapa.descricao || 'Sem descrição'}

${etapa.obrigatoria ? '⚠️ **Etapa obrigatória**' : ''}

---
_Criado automaticamente pelo CS Hub - Playbooks_
  `.trim();

  try {
    // Buscar IDs de TODOS os responsáveis no ClickUp pelos emails
    let responsaveisIds = [];
    if (responsaveisEmails.length > 0) {
      responsaveisIds = await buscarUsuariosClickUpPorEmails(responsaveisEmails);
    }

    const result = await criarTarefaClickUp({}, {
      nome,
      descricao,
      prioridade: etapa.obrigatoria ? 2 : 3,
      dataVencimento: etapa.prazo_data,
      responsaveisIds,
      ...opcoes
    });

    return result;
  } catch (error) {
    logger.error('Erro ao criar tarefa ClickUp para playbook', sanitizeError(error));
    return null;
  }
}

/**
 * Criar tarefa no ClickUp para ação de Ongoing
 */
export async function criarTarefaOngoing(acao, ciclo, cliente, opcoes = {}) {
  if (!isClickUpConfigured()) {
    logger.warn('ClickUp não configurado - pulando criação de tarefa');
    return null;
  }

  // Nome da ação
  const nomeAcao = acao.nome || 'Ação Ongoing';

  // Nome do cliente
  const clienteNome = cliente.team_name || cliente.nome || 'N/A';

  // Segmento/Saúde do ciclo
  const segmento = ciclo.segmento || 'N/A';

  // Título: [Ongoing - Segmento] Cliente - Ação
  const nome = `[Ongoing ${segmento}] ${clienteNome} - ${nomeAcao}`;

  // Responsáveis do cliente
  const responsaveisEmails = cliente.responsaveis?.map(r => r.email) ||
                             (cliente.responsavel_email ? [cliente.responsavel_email] : []);
  const responsaveisNomes = cliente.responsaveis?.map(r => r.nome).join(', ') ||
                            cliente.responsavel_nome || 'N/A';

  const descricao = `
**Ação de Ongoing - CS Hub**

**Cliente:** ${clienteNome}
**Responsáveis CS:** ${responsaveisNomes}
**Saúde do Cliente:** ${segmento}
**Cadência:** ${ciclo.cadencia || 'mensal'}

**Ação:** ${nomeAcao}
**Prazo:** D+${acao.dias || 7}

---
_Criado automaticamente pelo CS Hub - Ongoing_
  `.trim();

  try {
    // Buscar IDs dos responsáveis no ClickUp
    let responsaveisIds = [];
    if (responsaveisEmails.length > 0) {
      responsaveisIds = await buscarUsuariosClickUpPorEmails(responsaveisEmails);
    }

    const result = await criarTarefaClickUp({}, {
      nome,
      descricao,
      prioridade: 3, // Normal
      dataVencimento: acao.data_vencimento,
      responsaveisIds,
      ...opcoes
    });

    return result;
  } catch (error) {
    logger.error('Erro ao criar tarefa ClickUp para Ongoing', sanitizeError(error));
    return null;
  }
}

/**
 * Montar descrição da tarefa baseada no alerta
 */
function montarDescricao(alerta) {
  const tipoLabel = {
    'thread_urgente': 'Thread Urgente',
    'thread_negativa': 'Thread com Sentimento Negativo',
    'thread_erro': 'Thread com Erro/Bug',
    'cliente_inativo': 'Cliente Inativo',
    'manual': 'Alerta Manual'
  };

  const prioridadeLabel = {
    'urgente': 'Urgente',
    'alta': 'Alta',
    'media': 'Média',
    'baixa': 'Baixa'
  };

  return `
**Alerta do CS Hub**

**Tipo:** ${tipoLabel[alerta.tipo] || alerta.tipo}
**Prioridade:** ${prioridadeLabel[alerta.prioridade] || alerta.prioridade}
**Cliente/Time:** ${alerta.time_name || alerta.cliente_nome || 'N/A'}

**Detalhes:**
${alerta.mensagem || 'Sem detalhes adicionais'}

${alerta.thread_id ? `**Thread ID:** ${alerta.thread_id}` : ''}
${alerta.cliente_id ? `**Cliente ID:** ${alerta.cliente_id}` : ''}

---
_Criado automaticamente pelo CS Hub_
  `.trim();
}

/**
 * Buscar membros do workspace do ClickUp
 */
export async function buscarMembrosClickUp() {
  if (!CLICKUP_TEAM_ID) {
    logger.warn('ClickUp TEAM_ID não configurado. Lista de membros indisponível.');
    return [];
  }

  try {
    const result = await clickupProxyFn({
      action: 'getTeamMembers',
      payload: { teamId: CLICKUP_TEAM_ID }
    });
    return result.data;
  } catch (error) {
    logger.error('Erro ao buscar membros ClickUp', sanitizeError(error));
    return [];
  }
}

/**
 * Buscar detalhes de uma tarefa
 */
export async function buscarTarefaClickUp(taskId) {
  try {
    const result = await clickupProxyFn({
      action: 'getTask',
      payload: { taskId }
    });
    return result.data;
  } catch (error) {
    logger.error('Erro ao buscar tarefa ClickUp', sanitizeError(error));
    throw new Error('Erro ao buscar tarefa no ClickUp');
  }
}

/**
 * Atualizar status de uma tarefa no ClickUp
 * @param {string} taskId - ID da tarefa
 * @param {string} status - Nome do status (PENDENTE, EM ANDAMENTO, RESOLVIDO, IGNORADO, BLOQUEADO)
 */
export async function atualizarStatusTarefaClickUp(taskId, status) {
  try {
    const result = await clickupProxyFn({
      action: 'updateTaskStatus',
      payload: { taskId, status }
    });
    return result.data;
  } catch (error) {
    logger.error('Erro ao atualizar tarefa ClickUp', sanitizeError(error));
    throw new Error('Erro ao atualizar tarefa no ClickUp');
  }
}

// Mapeamento de status CS Hub → ClickUp
export const STATUS_CSHUB_TO_CLICKUP = {
  'pendente': 'pendente',
  'em_andamento': 'em andamento',
  'concluida': 'resolvido',
  'pulada': 'ignorado',
  'bloqueado': 'bloqueado',
  'resolvido': 'resolvido',
  'ignorado': 'ignorado',
  'cancelado': 'ignorado'
};

// Mapeamento de status ClickUp → CS Hub (etapas)
export const STATUS_CLICKUP_TO_ETAPA = {
  'pendente': 'pendente',
  'em andamento': 'pendente', // etapa não tem "em andamento", fica pendente
  'bloqueado': 'pendente',    // etapa não tem "bloqueado", fica pendente
  'resolvido': 'concluida',
  'ignorado': 'pulada'
};
