import { applyFiltersToThreads } from './emailFilters';

// Tipos de alertas
// ATIVOS: sentimento_negativo, problema_reclamacao, entrou_resgate
// sem_uso_plataforma já é tratado pela Saúde CS (14d→ALERTA, 30d→RESGATE)
export const ALERTA_TIPOS = {
  sentimento_negativo: {
    value: 'sentimento_negativo',
    label: 'Sentimento Negativo',
    description: 'Conversa detectada com sentimento negativo ou urgente',
    icon: 'Frown',
    color: '#dc2626', // vermelho escuro
  },
  problema_reclamacao: {
    value: 'problema_reclamacao',
    label: 'Problema/Reclamação',
    description: 'Cliente reportou problema ou fez reclamação',
    icon: 'AlertTriangle',
    color: '#ef4444', // vermelho
  },
  entrou_resgate: {
    value: 'entrou_resgate',
    label: 'Cliente em Resgate',
    description: 'Cliente entrou no segmento RESGATE - ação urgente necessária',
    icon: 'AlertOctagon',
    color: '#dc2626', // vermelho escuro
  },
  // DESATIVADOS (mantidos para alertas históricos):
  sem_uso_plataforma: {
    value: 'sem_uso_plataforma',
    label: 'Sem Uso da Plataforma',
    description: 'Cliente sem usar a plataforma há 15 dias ou mais',
    icon: 'Clock',
    color: '#f59e0b', // amarelo
  },
  sazonalidade_alta_inativo: {
    value: 'sazonalidade_alta_inativo',
    label: 'Inativo em Alta Temporada',
    description: 'Cliente deveria estar ativo (mês de alta temporada) mas não está usando a plataforma',
    icon: 'Calendar',
    color: '#f97316', // laranja
  },
};

// Prioridades
export const ALERTA_PRIORIDADES = {
  baixa: {
    value: 'baixa',
    label: 'Baixa',
    color: '#6b7280', // cinza
    order: 4,
  },
  media: {
    value: 'media',
    label: 'Média',
    color: '#f59e0b', // amarelo
    order: 3,
  },
  alta: {
    value: 'alta',
    label: 'Alta',
    color: '#f97316', // laranja
    order: 2,
  },
  urgente: {
    value: 'urgente',
    label: 'Urgente',
    color: '#ef4444', // vermelho
    order: 1,
  },
};

// Status
export const ALERTA_STATUS = {
  pendente: {
    value: 'pendente',
    label: 'Pendente',
    color: '#f59e0b',
  },
  em_andamento: {
    value: 'em_andamento',
    label: 'Em Andamento',
    color: '#3b82f6',
  },
  bloqueado: {
    value: 'bloqueado',
    label: 'Bloqueado',
    color: '#ef4444',
  },
  resolvido: {
    value: 'resolvido',
    label: 'Resolvido',
    color: '#10b981',
  },
  ignorado: {
    value: 'ignorado',
    label: 'Ignorado',
    color: '#6b7280',
  },
};

// Funções utilitárias
export function getTipoInfo(tipo) {
  return ALERTA_TIPOS[tipo] || { value: tipo, label: tipo, color: '#6b7280', icon: 'Bell' };
}

export function getPrioridadeInfo(prioridade) {
  return ALERTA_PRIORIDADES[prioridade] || ALERTA_PRIORIDADES.media;
}

export function getStatusInfo(status) {
  return ALERTA_STATUS[status] || ALERTA_STATUS.pendente;
}

// Calcular dias desde última interação
export function calcularDiasSemContato(ultimaInteracao) {
  if (!ultimaInteracao) return 999;
  const date = ultimaInteracao.toDate ? ultimaInteracao.toDate() : new Date(ultimaInteracao);
  const now = new Date();
  return Math.floor((now - date) / (1000 * 60 * 60 * 24));
}

// Formatar tempo relativo
export function formatarTempoRelativo(timestamp) {
  if (!timestamp) return 'Data desconhecida';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) return `há ${diffMins} min`;
  if (diffHours < 24) return `há ${diffHours}h`;
  if (diffDays === 1) return 'há 1 dia';
  return `há ${diffDays} dias`;
}

// Gerar alertas de sem uso da plataforma (15 dias)
export function gerarAlertasSemUso(clientes, metricas, alertasExistentes, threadsMap = {}) {
  const alertas = [];
  const DIAS_LIMITE = 15;

  // Debug: contar clientes por motivo de skip
  let skipInativo = 0, skipSemData = 0, skipAlertaExiste = 0, skipDiasInsuficientes = 0;

  // Criar mapa de métricas por team_id (pegar a mais recente de cada cliente)
  const metricasMap = {};
  for (const metrica of metricas) {
    const teamId = metrica.team_id;
    if (!teamId) continue;

    const dataMetrica = metrica.data?.toDate?.() || new Date(metrica.data);
    if (!metricasMap[teamId] || dataMetrica > metricasMap[teamId]) {
      metricasMap[teamId] = dataMetrica;
    }
  }
  console.log(`[Alertas Sem Uso] Métricas diárias: ${metricas.length} registros, ${Object.keys(metricasMap).length} clientes únicos`);

  for (const cliente of clientes) {
    // Pular inativos/cancelados
    if (cliente.status === 'inativo' || cliente.status === 'cancelado') {
      skipInativo++;
      continue;
    }

    // Tentar múltiplos campos possíveis para última interação
    // 1. Campos diretos do cliente
    // 2. Última thread do cliente
    let ultimaInteracao = cliente.ultima_interacao || cliente.last_activity_at || cliente.ultimo_acesso;

    // Se não tem no cliente, buscar nas threads
    // Tentar múltiplos IDs: cliente.id, cliente.team_id, e todos os IDs em cliente.times
    const possiveisIds = [cliente.id, cliente.team_id, ...(cliente.times || [])].filter(Boolean);

    if (!ultimaInteracao) {
      let threadsCliente = [];
      for (const possId of possiveisIds) {
        if (threadsMap[possId]) {
          threadsCliente = threadsCliente.concat(threadsMap[possId]);
        }
      }
      if (threadsCliente.length > 0) {
        // Pegar a thread mais recente
        const ultimaThread = threadsCliente.sort((a, b) => {
          const dateA = a.updated_at?.toDate?.() || new Date(a.updated_at) || new Date(0);
          const dateB = b.updated_at?.toDate?.() || new Date(b.updated_at) || new Date(0);
          return dateB - dateA;
        })[0];
        ultimaInteracao = ultimaThread.updated_at;
      }
    }

    // Se ainda não tem, buscar nas métricas diárias
    if (!ultimaInteracao) {
      for (const possId of possiveisIds) {
        if (metricasMap[possId]) {
          const dataMetrica = metricasMap[possId];
          if (!ultimaInteracao || dataMetrica > ultimaInteracao) {
            ultimaInteracao = dataMetrica;
          }
        }
      }
    }

    // Se ainda não tem data, usar created_at do cliente (se existir)
    if (!ultimaInteracao && cliente.created_at) {
      ultimaInteracao = cliente.created_at;
    }

    if (!ultimaInteracao) {
      skipSemData++;
      continue;
    }

    // Verificar se já existe alerta pendente
    const alertaExistente = alertasExistentes.find(
      a => a.tipo === 'sem_uso_plataforma' &&
           a.cliente_id === cliente.id &&
           (a.status === 'pendente' || a.status === 'em_andamento')
    );
    if (alertaExistente) {
      skipAlertaExiste++;
      continue;
    }

    // Verificar último uso
    const dias = calcularDiasSemContato(ultimaInteracao);

    // Só gerar alerta se temos dados válidos (menos de 365 dias indica dado real)
    if (dias >= DIAS_LIMITE && dias < 365) {
      // Pegar todos os responsáveis (array com itens OU fallback para single)
      const responsaveis = (cliente?.responsaveis && cliente.responsaveis.length > 0)
        ? cliente.responsaveis
        : (cliente?.responsavel_email ? [{ email: cliente.responsavel_email, nome: cliente.responsavel_nome }] : []);

      alertas.push({
        tipo: 'sem_uso_plataforma',
        titulo: `${dias} dias sem uso da plataforma`,
        mensagem: `O cliente ${cliente.team_name || cliente.nome} não usa a plataforma há ${dias} dias.`,
        prioridade: dias >= 30 ? 'alta' : 'media',
        status: 'pendente',
        time_id: cliente.times?.[0] || null,
        time_name: cliente.team_name || cliente.nome,
        cliente_id: cliente.id,
        cliente_nome: cliente.team_name || cliente.nome,
        thread_id: null,
        responsaveis: responsaveis,
        responsavel_email: responsaveis[0]?.email || null,
        responsavel_nome: responsaveis.map(r => r.nome).join(', ') || null,
      });
    } else {
      skipDiasInsuficientes++;
    }
  }

  // Log de debug
  console.log(`[Alertas Sem Uso] Total clientes: ${clientes.length}`);
  console.log(`[Alertas Sem Uso] Skip - Inativos/Cancelados: ${skipInativo}`);
  console.log(`[Alertas Sem Uso] Skip - Sem data última interação: ${skipSemData}`);
  console.log(`[Alertas Sem Uso] Skip - Já tem alerta: ${skipAlertaExiste}`);
  console.log(`[Alertas Sem Uso] Skip - Menos de 15 dias ou mais de 365: ${skipDiasInsuficientes}`);
  console.log(`[Alertas Sem Uso] Alertas gerados: ${alertas.length}`);
  console.log(`[Alertas Sem Uso] Total threads no mapa: ${Object.keys(threadsMap).length} clientes com threads`);

  // Mostrar alguns clientes ativos sem data para debug
  const clientesSemData = clientes.filter(c =>
    c.status !== 'inativo' && c.status !== 'cancelado' &&
    !c.ultima_interacao && !c.last_activity_at && !c.ultimo_acesso &&
    !threadsMap[c.id]
  ).slice(0, 5);
  if (clientesSemData.length > 0) {
    console.log(`[Alertas Sem Uso] Exemplo de clientes sem data:`, clientesSemData.map(c => ({ id: c.id, nome: c.team_name, status: c.status })));
  }

  return alertas;
}

// Gerar alertas de sentimento negativo
export function gerarAlertasSentimentoNegativo(threads, alertasExistentes, clientesMap = {}) {
  const alertas = [];

  for (const thread of threads) {
    if (thread.sentimento !== 'negativo' && thread.sentimento !== 'urgente') continue;

    // Buscar dados do cliente
    const clienteId = thread.cliente_id || thread.team_id;
    const cliente = clienteId ? clientesMap[clienteId] : null;

    // Debug: mostrar status do cliente
    console.log(`[Alerta Sentimento] Thread: clienteId=${clienteId}, cliente encontrado=${!!cliente}, status=${cliente?.status}, nome=${cliente?.team_name}`);

    // Pular se cliente não foi encontrado (pode ser de cliente excluído)
    if (!cliente) {
      console.log(`[Alerta Sentimento] Cliente não encontrado, pulando`);
      continue;
    }

    // Pular clientes inativos/cancelados
    if (cliente.status === 'inativo' || cliente.status === 'cancelado') {
      console.log(`[Alerta Sentimento] Pulando cliente inativo: ${cliente.team_name}`);
      continue;
    }

    // Verificar se já existe alerta pendente para esta thread
    const alertaExistente = alertasExistentes.find(
      a => a.tipo === 'sentimento_negativo' &&
           a.thread_id === thread.id &&
           (a.status === 'pendente' || a.status === 'em_andamento')
    );
    if (alertaExistente) continue;

    const clienteNome = cliente?.team_name || cliente?.nome || thread.team_name || null;

    // Pegar todos os responsáveis (array com itens OU fallback para single)
    const responsaveis = (cliente?.responsaveis && cliente.responsaveis.length > 0)
      ? cliente.responsaveis
      : (cliente?.responsavel_email ? [{ email: cliente.responsavel_email, nome: cliente.responsavel_nome }] : []);

    console.log(`[Alerta Sentimento] Cliente: ${clienteNome}, ID: ${clienteId}, resp_email: ${cliente?.responsavel_email}, Responsáveis:`, responsaveis);

    alertas.push({
      tipo: 'sentimento_negativo',
      titulo: `Conversa com sentimento ${thread.sentimento}`,
      mensagem: `A conversa "${thread.assunto || 'Sem assunto'}" foi classificada como ${thread.sentimento}.`,
      prioridade: thread.sentimento === 'urgente' ? 'urgente' : 'alta',
      status: 'pendente',
      time_id: thread.team_id || null,
      time_name: clienteNome,
      cliente_id: clienteId || null,
      cliente_nome: clienteNome,
      thread_id: thread.id,
      responsaveis: responsaveis,
      responsavel_email: responsaveis[0]?.email || null,
      responsavel_nome: responsaveis.map(r => r.nome).join(', ') || null,
    });
  }

  return alertas;
}

// Gerar alertas de resposta pendente (aguardando Trakto)
export function gerarAlertasRespostaPendente(threads, alertasExistentes) {
  const alertas = [];

  for (const thread of threads) {
    if (thread.status !== 'aguardando_equipe') continue;

    // Verificar se já existe alerta pendente para esta thread
    const alertaExistente = alertasExistentes.find(
      a => a.tipo === 'resposta_pendente' &&
           a.thread_id === thread.id &&
           (a.status === 'pendente' || a.status === 'em_andamento')
    );
    if (alertaExistente) continue;

    // Calcular há quantos dias está pendente
    const dias = calcularDiasSemContato(thread.updated_at);

    alertas.push({
      tipo: 'resposta_pendente',
      titulo: `Resposta pendente há ${dias} ${dias === 1 ? 'dia' : 'dias'}`,
      mensagem: `A conversa "${thread.assunto || 'Sem assunto'}" está aguardando resposta da equipe.`,
      prioridade: dias >= 3 ? 'alta' : dias >= 1 ? 'media' : 'baixa',
      status: 'pendente',
      time_id: thread.team_id || null,
      time_name: null,
      cliente_id: thread.cliente_id || null,
      cliente_nome: null,
      thread_id: thread.id,
      responsavel_email: null,
      responsavel_nome: null,
    });
  }

  return alertas;
}

// Gerar alertas de problema/reclamação
export function gerarAlertasProblemaReclamacao(threads, alertasExistentes, clientesMap = {}) {
  const alertas = [];
  const CATEGORIAS_PROBLEMA = ['erro_bug', 'reclamacao', 'problema', 'bug', 'erro'];

  for (const thread of threads) {
    // Verificar se a categoria indica problema
    const categoria = (thread.categoria || '').toLowerCase();
    const isProblem = CATEGORIAS_PROBLEMA.some(cat => categoria.includes(cat));

    if (!isProblem) continue;

    // Buscar dados do cliente
    const clienteId = thread.cliente_id || thread.team_id;
    const cliente = clienteId ? clientesMap[clienteId] : null;

    // Pular se cliente não foi encontrado
    if (!cliente) continue;

    // Pular clientes inativos/cancelados
    if (cliente.status === 'inativo' || cliente.status === 'cancelado') continue;

    // Verificar se já existe alerta pendente para esta thread
    const alertaExistente = alertasExistentes.find(
      a => a.tipo === 'problema_reclamacao' &&
           a.thread_id === thread.id &&
           (a.status === 'pendente' || a.status === 'em_andamento')
    );
    if (alertaExistente) continue;

    const clienteNome = cliente?.team_name || cliente?.nome || thread.team_name || null;

    // Pegar todos os responsáveis (array com itens OU fallback para single)
    const responsaveis = (cliente?.responsaveis && cliente.responsaveis.length > 0)
      ? cliente.responsaveis
      : (cliente?.responsavel_email ? [{ email: cliente.responsavel_email, nome: cliente.responsavel_nome }] : []);

    alertas.push({
      tipo: 'problema_reclamacao',
      titulo: `Problema reportado: ${thread.assunto || 'Sem assunto'}`,
      mensagem: `Cliente reportou um problema/reclamação que precisa de atenção.`,
      prioridade: 'alta',
      status: 'pendente',
      time_id: thread.team_id || null,
      time_name: clienteNome,
      cliente_id: clienteId || null,
      cliente_nome: clienteNome,
      thread_id: thread.id,
      responsaveis: responsaveis,
      responsavel_email: responsaveis[0]?.email || null,
      responsavel_nome: responsaveis.map(r => r.nome).join(', ') || null,
    });
  }

  return alertas;
}

// Gerar alertas de créditos AI baixos
export function gerarAlertasCreditosBaixos(clientes, alertasExistentes, limiteCreditos = 100) {
  const alertas = [];

  for (const cliente of clientes) {
    // Pular inativos/cancelados
    if (cliente.status === 'inativo' || cliente.status === 'cancelado') continue;

    const creditosRestantes = cliente.creditos_ai || cliente.ai_credits || 0;

    if (creditosRestantes > limiteCreditos) continue;

    // Verificar se já existe alerta pendente
    const alertaExistente = alertasExistentes.find(
      a => a.tipo === 'creditos_baixos' &&
           a.cliente_id === cliente.id &&
           (a.status === 'pendente' || a.status === 'em_andamento')
    );
    if (alertaExistente) continue;

    alertas.push({
      tipo: 'creditos_baixos',
      titulo: `Créditos AI baixos: ${creditosRestantes} restantes`,
      mensagem: `O cliente ${cliente.team_name || cliente.nome} está com poucos créditos de AI (${creditosRestantes}).`,
      prioridade: creditosRestantes <= 20 ? 'alta' : 'media',
      status: 'pendente',
      time_id: cliente.times?.[0] || null,
      time_name: null,
      cliente_id: cliente.id,
      cliente_nome: cliente.team_name || cliente.nome,
      thread_id: null,
      responsavel_email: cliente.responsavel_email || null,
      responsavel_nome: cliente.responsavel_nome || null,
    });
  }

  return alertas;
}

// Gerar alertas de sazonalidade (mês de alta temporada mas cliente inativo)
export function gerarAlertasSazonalidade(clientes, metricas, alertasExistentes) {
  const alertas = [];
  const mesKey = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][new Date().getMonth()];
  const MESES_LABELS = { jan: 'Janeiro', fev: 'Fevereiro', mar: 'Março', abr: 'Abril', mai: 'Maio', jun: 'Junho', jul: 'Julho', ago: 'Agosto', set: 'Setembro', out: 'Outubro', nov: 'Novembro', dez: 'Dezembro' };

  // Criar mapa de métricas recentes por team_id
  const metricasMap = {};
  const trintaDiasAtras = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  for (const m of metricas) {
    const d = m.data?.toDate?.() || new Date(m.data);
    if (d >= trintaDiasAtras && m.team_id) {
      if (!metricasMap[m.team_id]) metricasMap[m.team_id] = 0;
      metricasMap[m.team_id] += (m.logins || 0);
    }
  }

  for (const cliente of clientes) {
    if (cliente.status === 'inativo' || cliente.status === 'cancelado') continue;

    const calendario = cliente.calendario_campanhas;
    if (!calendario || calendario[mesKey] !== 'alta') continue;

    // Verificar se cliente está inativo (sem logins nos últimos 30d)
    const possiveisIds = [cliente.id, cliente.team_id, ...(cliente.times || [])].filter(Boolean);
    const temAtividade = possiveisIds.some(tid => (metricasMap[tid] || 0) > 0);
    if (temAtividade) continue;

    // Verificar se já existe alerta
    const jaExiste = alertasExistentes.some(a =>
      a.tipo === 'sazonalidade_alta_inativo' &&
      a.cliente_id === cliente.id &&
      a.status === 'pendente'
    );
    if (jaExiste) continue;

    alertas.push({
      tipo: 'sazonalidade_alta_inativo',
      titulo: `${cliente.team_name || cliente.nome}: inativo em mês de alta (${MESES_LABELS[mesKey]})`,
      mensagem: `Este cliente marcou ${MESES_LABELS[mesKey]} como mês de alta temporada, mas não tem atividade nos últimos 30 dias.`,
      prioridade: 'alta',
      status: 'pendente',
      time_id: cliente.team_id || cliente.times?.[0] || null,
      time_name: cliente.team_name || null,
      cliente_id: cliente.id,
      cliente_nome: cliente.team_name || cliente.nome,
      thread_id: null,
      responsavel_email: cliente.responsavel_email || (cliente.responsaveis?.[0]?.email) || null,
      responsavel_nome: cliente.responsavel_nome || (cliente.responsaveis?.[0]?.nome) || null,
    });
  }

  return alertas;
}

// Gerar alertas quando cliente entra em RESGATE
export function gerarAlertasEntrouResgate(clientes, alertasExistentes) {
  const alertas = [];

  for (const cliente of clientes) {
    // Pular clientes que não estão em RESGATE
    if (cliente.segmento_cs !== 'RESGATE') continue;

    // Pular clientes inativos/cancelados
    if (cliente.status === 'inativo' || cliente.status === 'cancelado') continue;

    // Verificar se já existe alerta pendente para este cliente
    const alertaExistente = alertasExistentes.find(
      a => a.tipo === 'entrou_resgate' &&
           a.cliente_id === cliente.id &&
           (a.status === 'pendente' || a.status === 'em_andamento')
    );
    if (alertaExistente) continue;

    const clienteNome = cliente.team_name || cliente.nome;

    // Pegar todos os responsáveis
    const responsaveis = (cliente.responsaveis && cliente.responsaveis.length > 0)
      ? cliente.responsaveis
      : (cliente.responsavel_email ? [{ email: cliente.responsavel_email, nome: cliente.responsavel_nome }] : []);

    // Pegar motivo do RESGATE se disponível
    const motivo = cliente.segmento_motivo || 'Critérios de risco atingidos';

    alertas.push({
      tipo: 'entrou_resgate',
      titulo: `🚨 ${clienteNome} entrou em RESGATE`,
      mensagem: `Cliente entrou no segmento crítico RESGATE. Motivo: ${motivo}. Ação urgente necessária.`,
      prioridade: 'urgente',
      status: 'pendente',
      time_id: cliente.team_id || cliente.times?.[0] || null,
      time_name: clienteNome,
      cliente_id: cliente.id,
      cliente_nome: clienteNome,
      thread_id: null,
      responsaveis: responsaveis,
      responsavel_email: responsaveis[0]?.email || null,
      responsavel_nome: responsaveis.map(r => r.nome).join(', ') || null,
    });
  }

  return alertas;
}

// Executar todas as verificações
export function verificarTodosAlertas(clientes, threads, alertasExistentes, metricas = [], filterConfig = null) {
  console.log(`[Alertas] ========== INICIO VERIFICACAO ==========`);
  console.log(`[Alertas] Total clientes recebidos: ${clientes.length}`);
  console.log(`[Alertas] Total threads recebidas: ${threads.length}`);

  // Mostrar campos de um cliente para debug
  if (clientes.length > 0) {
    const exemploCliente = clientes[0];
    console.log(`[Alertas] CLIENTE EXEMPLO - todos os campos:`, JSON.stringify(exemploCliente, null, 2));
  }

  // Mostrar campos de uma thread para debug
  if (threads.length > 0) {
    const exemploThread = threads[0];
    console.log(`[Alertas] THREAD EXEMPLO - campos relevantes:`, {
      id: exemploThread.id,
      team_id: exemploThread.team_id,
      cliente_id: exemploThread.cliente_id,
      assunto: exemploThread.assunto,
      sentimento: exemploThread.sentimento
    });
  }

  // Criar mapa de clientes para lookup rápido
  // Mapear por TODOS os campos que podem ser IDs
  // IMPORTANTE: detectar conflitos (times compartilhados entre clientes)
  const clientesMap = {};
  const timesCompartilhados = new Set();

  for (const cliente of clientes) {
    const idsDoCliente = [
      cliente.id,
      cliente.team_id,
      ...(cliente.times || []),
      cliente._id,
      cliente.teamId,
      cliente.mongo_id
    ].filter(Boolean);

    for (const idKey of idsDoCliente) {
      if (clientesMap[idKey] && clientesMap[idKey].id !== cliente.id) {
        // Conflito: este ID já pertence a outro cliente
        timesCompartilhados.add(idKey);
        console.warn(`[Alertas] CONFLITO: time ${idKey} compartilhado entre "${clientesMap[idKey].nome || clientesMap[idKey].team_name}" e "${cliente.nome || cliente.team_name}"`);
      } else {
        clientesMap[idKey] = cliente;
      }
    }
  }

  // Remover IDs conflitantes do mapa para evitar associação errada
  for (const conflictId of timesCompartilhados) {
    delete clientesMap[conflictId];
  }

  if (timesCompartilhados.size > 0) {
    console.warn(`[Alertas] ${timesCompartilhados.size} time(s) compartilhado(s) removidos do mapa para evitar alertas errados:`, [...timesCompartilhados]);
  }

  console.log(`[Alertas] ClientesMap tem ${Object.keys(clientesMap).length} entradas (${clientes.length} clientes)`);

  // Contar clientes com array times
  const clientesComTimes = clientes.filter(c => c.times && c.times.length > 0).length;
  console.log(`[Alertas] Clientes com array 'times': ${clientesComTimes}`);

  // Mostrar IDs das threads para comparação
  const threadIds = threads.slice(0, 10).map(t => t.cliente_id || t.team_id);
  console.log(`[Alertas] Primeiros 10 IDs nas threads:`, threadIds);

  // Verificar se algum ID de thread existe no mapa
  const matchCount = threadIds.filter(id => clientesMap[id]).length;
  console.log(`[Alertas] Matches encontrados nos primeiros 10: ${matchCount}/${threadIds.length}`);

  // Criar mapa de threads por cliente
  const threadsMap = {};
  for (const thread of threads) {
    const clienteId = thread.cliente_id || thread.team_id;
    if (clienteId) {
      if (!threadsMap[clienteId]) {
        threadsMap[clienteId] = [];
      }
      threadsMap[clienteId].push(thread);
    }
  }

  // Filtrar threads irrelevantes antes de gerar alertas
  let threadsRelevantes = threads;
  if (filterConfig && filterConfig.filtro_ativo !== false) {
    threadsRelevantes = applyFiltersToThreads(threads, filterConfig).filter(t => !t._isFiltered);
  }
  // Excluir threads marcadas manualmente como irrelevantes
  threadsRelevantes = threadsRelevantes.filter(t => !t.filtrado_manual);

  // ALERTAS ATIVOS:
  // 1. sentimento_negativo - Conversas com sentimento negativo/urgente (todos os clientes)
  // 2. problema_reclamacao - Threads categorizadas como problema/reclamação (todos os clientes)
  // 3. entrou_resgate - Cliente entrou no segmento RESGATE (alerta específico urgente)
  // NOTA: sem_uso_plataforma já é tratado pela Saúde CS (14d→ALERTA, 30d→RESGATE)
  const novosAlertas = [
    ...gerarAlertasSentimentoNegativo(threadsRelevantes, alertasExistentes, clientesMap),
    ...gerarAlertasProblemaReclamacao(threadsRelevantes, alertasExistentes, clientesMap),
    ...gerarAlertasEntrouResgate(clientes, alertasExistentes),
    // DESATIVADOS:
    // ...gerarAlertasSemUso(clientes, metricas, alertasExistentes, threadsMap),
    // ...gerarAlertasSazonalidade(clientes, metricas, alertasExistentes),
    // ...gerarAlertasRespostaPendente(threads, alertasExistentes),
    // ...gerarAlertasCreditosBaixos(clientes, alertasExistentes),
  ];

  return novosAlertas;
}

// Ordenar alertas por prioridade e data
export function ordenarAlertas(alertas) {
  return [...alertas].sort((a, b) => {
    // Primeiro por prioridade
    const prioridadeA = ALERTA_PRIORIDADES[a.prioridade]?.order || 99;
    const prioridadeB = ALERTA_PRIORIDADES[b.prioridade]?.order || 99;
    if (prioridadeA !== prioridadeB) return prioridadeA - prioridadeB;

    // Depois por data (mais recente primeiro)
    const dateA = a.created_at?.toDate?.() || new Date(a.created_at) || new Date(0);
    const dateB = b.created_at?.toDate?.() || new Date(b.created_at) || new Date(0);
    return dateB - dateA;
  });
}
