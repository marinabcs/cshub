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

  const {
    nome = `[CS Hub] ${alerta.titulo}`,
    descricao = montarDescricao(alerta),
    prioridade = PRIORIDADE_MAP[alerta.prioridade] || 3,
    responsavelId = null
  } = opcoes;

  const body = {
    name: nome,
    description: descricao,
    priority: prioridade
  };

  // Adicionar responsável se fornecido
  if (responsavelId) {
    body.assignees = [parseInt(responsavelId)];
  }

  const response = await fetch(`${BASE_URL}/list/${CLICKUP_LIST_ID}/task`, {
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
  if (!CLICKUP_API_KEY || !CLICKUP_TEAM_ID) {
    throw new Error('ClickUp não está configurado.');
  }

  const response = await fetch(`${BASE_URL}/team/${CLICKUP_TEAM_ID}`, {
    headers: {
      'Authorization': CLICKUP_API_KEY
    }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.err || 'Erro ao buscar membros do ClickUp');
  }

  const data = await response.json();

  // Retornar membros do team
  return (data.team?.members || []).map(m => ({
    id: m.user.id,
    nome: m.user.username || m.user.email,
    email: m.user.email,
    avatar: m.user.profilePicture
  }));
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
