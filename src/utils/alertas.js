// Tipos de alertas
export const ALERTA_TIPOS = {
  sem_uso_plataforma: {
    value: 'sem_uso_plataforma',
    label: 'Sem Uso da Plataforma',
    description: 'Cliente sem usar a plataforma há 15 dias ou mais',
    icon: 'Clock',
    color: '#f59e0b', // amarelo
  },
  sentimento_negativo: {
    value: 'sentimento_negativo',
    label: 'Sentimento Negativo',
    description: 'Conversa com sentimento negativo detectado',
    icon: 'Frown',
    color: '#f97316', // laranja
  },
  resposta_pendente: {
    value: 'resposta_pendente',
    label: 'Resposta Pendente',
    description: 'Aguardando resposta do lado da Trakto',
    icon: 'MessageCircle',
    color: '#3b82f6', // azul
  },
  problema_reclamacao: {
    value: 'problema_reclamacao',
    label: 'Problema/Reclamação',
    description: 'Cliente reportou problema ou fez reclamação',
    icon: 'AlertTriangle',
    color: '#ef4444', // vermelho
  },
  creditos_baixos: {
    value: 'creditos_baixos',
    label: 'Créditos AI Baixos',
    description: 'Poucos créditos de AI restantes',
    icon: 'Zap',
    color: '#8b5cf6', // roxo
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
  return ALERTA_TIPOS[tipo] || ALERTA_TIPOS.sem_contato;
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
export function gerarAlertasSemUso(clientes, metricas, alertasExistentes) {
  const alertas = [];
  const DIAS_LIMITE = 15;

  for (const cliente of clientes) {
    // Pular inativos/cancelados
    if (cliente.status === 'inativo' || cliente.status === 'cancelado') continue;

    // Verificar se já existe alerta pendente
    const alertaExistente = alertasExistentes.find(
      a => a.tipo === 'sem_uso_plataforma' &&
           a.cliente_id === cliente.id &&
           (a.status === 'pendente' || a.status === 'em_andamento')
    );
    if (alertaExistente) continue;

    // Verificar último uso (baseado em métricas ou última interação)
    const ultimaInteracao = cliente.ultima_interacao;
    const dias = calcularDiasSemContato(ultimaInteracao);

    if (dias >= DIAS_LIMITE) {
      alertas.push({
        tipo: 'sem_uso_plataforma',
        titulo: `${dias} dias sem uso da plataforma`,
        mensagem: `O cliente ${cliente.team_name || cliente.nome} não usa a plataforma há ${dias} dias.`,
        prioridade: dias >= 30 ? 'alta' : 'media',
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
  }

  return alertas;
}

// Gerar alertas de sentimento negativo
export function gerarAlertasSentimentoNegativo(threads, alertasExistentes) {
  const alertas = [];

  for (const thread of threads) {
    if (thread.sentimento !== 'negativo' && thread.sentimento !== 'urgente') continue;

    // Verificar se já existe alerta pendente para esta thread
    const alertaExistente = alertasExistentes.find(
      a => a.tipo === 'sentimento_negativo' &&
           a.thread_id === thread.id &&
           (a.status === 'pendente' || a.status === 'em_andamento')
    );
    if (alertaExistente) continue;

    alertas.push({
      tipo: 'sentimento_negativo',
      titulo: `Conversa com sentimento ${thread.sentimento}`,
      mensagem: `A conversa "${thread.assunto || 'Sem assunto'}" foi classificada como ${thread.sentimento}.`,
      prioridade: thread.sentimento === 'urgente' ? 'urgente' : 'alta',
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
export function gerarAlertasProblemaReclamacao(threads, alertasExistentes) {
  const alertas = [];
  const CATEGORIAS_PROBLEMA = ['erro_bug', 'reclamacao', 'problema', 'bug', 'erro'];

  for (const thread of threads) {
    // Verificar se a categoria indica problema
    const categoria = (thread.categoria || '').toLowerCase();
    const isProblem = CATEGORIAS_PROBLEMA.some(cat => categoria.includes(cat));

    if (!isProblem) continue;

    // Verificar se já existe alerta pendente para esta thread
    const alertaExistente = alertasExistentes.find(
      a => a.tipo === 'problema_reclamacao' &&
           a.thread_id === thread.id &&
           (a.status === 'pendente' || a.status === 'em_andamento')
    );
    if (alertaExistente) continue;

    alertas.push({
      tipo: 'problema_reclamacao',
      titulo: `Problema reportado: ${thread.assunto || 'Sem assunto'}`,
      mensagem: `Cliente reportou um problema/reclamação que precisa de atenção.`,
      prioridade: 'alta',
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

// Executar todas as verificações
export function verificarTodosAlertas(clientes, threads, alertasExistentes, metricas = []) {
  const novosAlertas = [
    ...gerarAlertasSemUso(clientes, metricas, alertasExistentes),
    ...gerarAlertasSentimentoNegativo(threads, alertasExistentes),
    ...gerarAlertasRespostaPendente(threads, alertasExistentes),
    ...gerarAlertasProblemaReclamacao(threads, alertasExistentes),
    ...gerarAlertasCreditosBaixos(clientes, alertasExistentes),
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
