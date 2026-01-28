// Tipos de alertas
export const ALERTA_TIPOS = {
  sem_contato: {
    value: 'sem_contato',
    label: 'Sem Contato',
    description: 'Time sem interações há mais de 7 dias',
    icon: 'Clock',
    color: '#f59e0b', // amarelo
  },
  sentimento_negativo: {
    value: 'sentimento_negativo',
    label: 'Sentimento Negativo',
    description: 'Threads com sentimento predominantemente negativo',
    icon: 'Frown',
    color: '#f97316', // laranja
  },
  health_critico: {
    value: 'health_critico',
    label: 'Health Crítico',
    description: 'Time com health score em estado crítico ou risco',
    icon: 'AlertTriangle',
    color: '#ef4444', // vermelho
  },
  erro_bug: {
    value: 'erro_bug',
    label: 'Erro/Bug',
    description: 'Problema técnico reportado pelo cliente',
    icon: 'Bug',
    color: '#8b5cf6', // roxo
  },
  time_orfao: {
    value: 'time_orfao',
    label: 'Time Órfão',
    description: 'Time não vinculado a nenhum cliente',
    icon: 'UserX',
    color: '#6b7280', // cinza
  },
  aviso_previo: {
    value: 'aviso_previo',
    label: 'Aviso Prévio',
    description: 'Cliente sinalizou intenção de cancelar',
    icon: 'AlertOctagon',
    color: '#dc2626', // vermelho escuro
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

// Gerar alertas de times sem contato
export function gerarAlertasSemContato(times, alertasExistentes) {
  const alertas = [];
  const DIAS_LIMITE = 7;

  for (const time of times) {
    // Verificar se já existe alerta pendente para este time
    const alertaExistente = alertasExistentes.find(
      a => a.tipo === 'sem_contato' &&
           a.time_id === time.id &&
           (a.status === 'pendente' || a.status === 'em_andamento')
    );
    if (alertaExistente) continue;

    // Calcular dias sem contato
    const dias = calcularDiasSemContato(time.ultima_interacao);

    if (dias >= DIAS_LIMITE) {
      alertas.push({
        tipo: 'sem_contato',
        titulo: `Time sem contato há ${dias} dias`,
        mensagem: `O time ${time.team_name} não tem interações há ${dias} dias.`,
        prioridade: dias >= 14 ? 'alta' : 'media',
        status: 'pendente',
        time_id: time.id,
        time_name: time.team_name,
        cliente_id: time.cliente_id || null,
        cliente_nome: null, // será preenchido pelo hook
        thread_id: null,
        responsavel_email: time.responsavel_email || null,
        responsavel_nome: time.responsavel_nome || null,
      });
    }
  }

  return alertas;
}

// Gerar alertas de health crítico
export function gerarAlertasHealthCritico(clientes, alertasExistentes) {
  const alertas = [];

  for (const cliente of clientes) {
    // Verificar se já existe alerta pendente
    const alertaExistente = alertasExistentes.find(
      a => a.tipo === 'health_critico' &&
           a.cliente_id === cliente.id &&
           (a.status === 'pendente' || a.status === 'em_andamento')
    );
    if (alertaExistente) continue;

    if (cliente.health_status === 'critico' || cliente.health_status === 'risco') {
      const isCritico = cliente.health_status === 'critico';
      alertas.push({
        tipo: 'health_critico',
        titulo: `Health ${isCritico ? 'crítico' : 'em risco'}: ${cliente.team_name || cliente.nome}`,
        mensagem: `O cliente ${cliente.team_name || cliente.nome} está com health score de ${cliente.health_score || 0}%.`,
        prioridade: isCritico ? 'urgente' : 'alta',
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

// Gerar alertas de times órfãos
export function gerarAlertasTimesOrfaos(times, clientes, alertasExistentes) {
  const alertas = [];

  // Obter todos os times vinculados a clientes
  const timesVinculados = new Set();
  clientes.forEach(c => {
    (c.times || []).forEach(t => timesVinculados.add(t));
  });

  for (const time of times) {
    if (timesVinculados.has(time.id)) continue;

    // Verificar se já existe alerta pendente
    const alertaExistente = alertasExistentes.find(
      a => a.tipo === 'time_orfao' &&
           a.time_id === time.id &&
           (a.status === 'pendente' || a.status === 'em_andamento')
    );
    if (alertaExistente) continue;

    alertas.push({
      tipo: 'time_orfao',
      titulo: `Time órfão: ${time.team_name}`,
      mensagem: `O time ${time.team_name} não está vinculado a nenhum cliente.`,
      prioridade: 'baixa',
      status: 'pendente',
      time_id: time.id,
      time_name: time.team_name,
      cliente_id: null,
      cliente_nome: null,
      thread_id: null,
      responsavel_email: null,
      responsavel_nome: null,
    });
  }

  return alertas;
}

// Gerar alertas de aviso prévio
export function gerarAlertasAvisoPrevio(clientes, alertasExistentes) {
  const alertas = [];

  for (const cliente of clientes) {
    if (cliente.status !== 'aviso_previo') continue;

    // Verificar se já existe alerta pendente
    const alertaExistente = alertasExistentes.find(
      a => a.tipo === 'aviso_previo' &&
           a.cliente_id === cliente.id &&
           (a.status === 'pendente' || a.status === 'em_andamento')
    );
    if (alertaExistente) continue;

    alertas.push({
      tipo: 'aviso_previo',
      titulo: `Aviso prévio: ${cliente.team_name || cliente.nome}`,
      mensagem: `O cliente ${cliente.team_name || cliente.nome} sinalizou intenção de cancelar.`,
      prioridade: 'urgente',
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
export function verificarTodosAlertas(times, clientes, alertasExistentes) {
  const novosAlertas = [
    ...gerarAlertasSemContato(times, alertasExistentes),
    ...gerarAlertasHealthCritico(clientes, alertasExistentes),
    ...gerarAlertasTimesOrfaos(times, clientes, alertasExistentes),
    ...gerarAlertasAvisoPrevio(clientes, alertasExistentes),
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
