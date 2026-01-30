// ClickUp API Integration
const CLICKUP_API_KEY = import.meta.env.VITE_CLICKUP_API_KEY || '';
const CLICKUP_LIST_ID = import.meta.env.VITE_CLICKUP_LIST_ID || '';
const CLICKUP_TEAM_ID = import.meta.env.VITE_CLICKUP_TEAM_ID || '';

const BASE_URL = 'https://api.clickup.com/api/v2';

// Verificar se ClickUp está configurado
export function isClickUpConfigured() {
  return !!(CLICKUP_API_KEY && CLICKUP_LIST_ID);
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
    responsaveisIds = [], // Array de IDs para múltiplos responsáveis
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
    body.assignees = responsaveisIds.map(id => parseInt(id));
  } else if (responsavelId) {
    body.assignees = [parseInt(responsavelId)];
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

  // Usar list ID customizado ou padrão
  const targetListId = listId || CLICKUP_LIST_ID;

  const response = await fetch(`${BASE_URL}/list/${targetListId}/task`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': CLICKUP_API_KEY
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Erro ClickUp:', error);
    throw new Error(error.err || 'Erro ao criar tarefa no ClickUp');
  }

  const tarefa = await response.json();

  return {
    id: tarefa.id,
    url: tarefa.url,
    nome: tarefa.name,
    status: tarefa.status?.status
  };
}

// Cache de membros do ClickUp para evitar múltiplas requisições
let membrosCache = null;
let membrosCacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

/**
 * Buscar ID do usuário no ClickUp pelo email
 */
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
    console.warn('ClickUp não configurado - pulando criação de tarefa');
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
      prioridade: etapa.obrigatoria ? 2 : 3, // Alta para obrigatórias, Normal para opcionais
      dataVencimento: etapa.prazo_data,
      responsaveisIds,
      ...opcoes
    });

    return result;
  } catch (error) {
    console.error(`Erro ao criar tarefa ClickUp para etapa ${etapa.ordem}:`, error);
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
  // Se TEAM_ID não estiver configurado, retornar lista vazia
  if (!CLICKUP_API_KEY || !CLICKUP_TEAM_ID) {
    console.warn('ClickUp TEAM_ID não configurado. Lista de membros indisponível.');
    return [];
  }

  try {
    const response = await fetch(`${BASE_URL}/team/${CLICKUP_TEAM_ID}`, {
      headers: {
        'Authorization': CLICKUP_API_KEY
      }
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Erro ao buscar membros:', error);
      return [];
    }

    const data = await response.json();

    // Retornar membros do team
    return (data.team?.members || []).map(m => ({
      id: m.user.id,
      nome: m.user.username || m.user.email,
      email: m.user.email,
      avatar: m.user.profilePicture
    }));
  } catch (error) {
    console.error('Erro ao buscar membros do ClickUp:', error);
    return [];
  }
}

/**
 * Buscar detalhes de uma tarefa
 */
export async function buscarTarefaClickUp(taskId) {
  if (!CLICKUP_API_KEY) {
    throw new Error('ClickUp não está configurado.');
  }

  const response = await fetch(`${BASE_URL}/task/${taskId}`, {
    headers: {
      'Authorization': CLICKUP_API_KEY
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.err || 'Erro ao buscar tarefa no ClickUp');
  }

  return await response.json();
}

/**
 * Atualizar status de uma tarefa no ClickUp
 * @param {string} taskId - ID da tarefa
 * @param {string} status - Nome do status (PENDENTE, EM ANDAMENTO, RESOLVIDO, IGNORADO, BLOQUEADO)
 */
export async function atualizarStatusTarefaClickUp(taskId, status) {
  if (!CLICKUP_API_KEY) {
    throw new Error('ClickUp não está configurado.');
  }

  const response = await fetch(`${BASE_URL}/task/${taskId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': CLICKUP_API_KEY
    },
    body: JSON.stringify({
      status: status.toLowerCase()
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.err || 'Erro ao atualizar tarefa no ClickUp');
  }

  return await response.json();
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
