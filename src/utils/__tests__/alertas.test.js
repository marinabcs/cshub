import { describe, it, expect, vi } from 'vitest';
import {
  getTipoInfo,
  getPrioridadeInfo,
  getStatusInfo,
  calcularDiasSemContato,
  formatarTempoRelativo,
  gerarAlertasSemUso,
  gerarAlertasSentimentoNegativo,
  gerarAlertasProblemaReclamacao,
  gerarAlertasSazonalidade,
  verificarTodosAlertas,
  ordenarAlertas,
  ALERTA_TIPOS,
  ALERTA_PRIORIDADES,
  ALERTA_STATUS,
} from '../alertas';

// ============================================
// CONSTANTES
// ============================================

describe('Constantes de alertas', () => {
  it('ALERTA_TIPOS tem 7 tipos (5 ativos + 2 desativados)', () => {
    expect(Object.keys(ALERTA_TIPOS)).toHaveLength(7);
    // Ativos
    expect(ALERTA_TIPOS).toHaveProperty('sentimento_negativo');
    expect(ALERTA_TIPOS).toHaveProperty('problema_reclamacao');
    expect(ALERTA_TIPOS).toHaveProperty('entrou_resgate');
    // Carência de 7 dias (V1)
    expect(ALERTA_TIPOS).toHaveProperty('carencia_comunicacao');
    expect(ALERTA_TIPOS).toHaveProperty('carencia_playbook');
    // Desativados (mantidos para histórico)
    expect(ALERTA_TIPOS).toHaveProperty('sem_uso_plataforma');
    expect(ALERTA_TIPOS).toHaveProperty('sazonalidade_alta_inativo');
  });

  it('ALERTA_PRIORIDADES tem 4 niveis com order', () => {
    expect(Object.keys(ALERTA_PRIORIDADES)).toHaveLength(4);
    expect(ALERTA_PRIORIDADES.urgente.order).toBe(1);
    expect(ALERTA_PRIORIDADES.baixa.order).toBe(4);
  });

  it('ALERTA_STATUS tem 5 status', () => {
    expect(Object.keys(ALERTA_STATUS)).toHaveLength(5);
  });
});

// ============================================
// FUNCOES UTILITARIAS
// ============================================

describe('getTipoInfo', () => {
  it('retorna info correta para tipo válido', () => {
    const info = getTipoInfo('sem_uso_plataforma');
    expect(info.label).toBe('Sem Uso da Plataforma');
    expect(info.color).toBe('#f59e0b');
  });

  it('retorna fallback para tipo inválido', () => {
    const info = getTipoInfo('invalido');
    expect(info.value).toBe('invalido');
    expect(info.color).toBe('#6b7280');
  });
});

describe('getPrioridadeInfo', () => {
  it('retorna info correta', () => {
    expect(getPrioridadeInfo('urgente').label).toBe('Urgente');
  });

  it('retorna media como fallback', () => {
    expect(getPrioridadeInfo('xyz')).toEqual(ALERTA_PRIORIDADES.media);
  });
});

describe('getStatusInfo', () => {
  it('retorna info correta', () => {
    expect(getStatusInfo('resolvido').label).toBe('Resolvido');
  });

  it('retorna pendente como fallback', () => {
    expect(getStatusInfo('xyz')).toEqual(ALERTA_STATUS.pendente);
  });
});

describe('calcularDiasSemContato', () => {
  it('retorna 999 para null', () => {
    expect(calcularDiasSemContato(null)).toBe(999);
    expect(calcularDiasSemContato(undefined)).toBe(999);
  });

  it('retorna 0 para hoje', () => {
    const dias = calcularDiasSemContato(new Date());
    expect(dias).toBeLessThanOrEqual(1);
  });

  it('calcula dias corretamente', () => {
    const dezDiasAtras = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    expect(calcularDiasSemContato(dezDiasAtras)).toBe(10);
  });

  it('funciona com Firestore timestamp (toDate)', () => {
    const fake = { toDate: () => new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) };
    expect(calcularDiasSemContato(fake)).toBe(5);
  });
});

describe('formatarTempoRelativo', () => {
  it('retorna "Data desconhecida" para null', () => {
    expect(formatarTempoRelativo(null)).toBe('Data desconhecida');
  });

  it('formata minutos', () => {
    const cincoMinAtras = new Date(Date.now() - 5 * 60 * 1000);
    expect(formatarTempoRelativo(cincoMinAtras)).toContain('min');
  });

  it('formata horas', () => {
    const duasHorasAtras = new Date(Date.now() - 2 * 60 * 60 * 1000);
    expect(formatarTempoRelativo(duasHorasAtras)).toContain('h');
  });

  it('formata 1 dia', () => {
    const umDiaAtras = new Date(Date.now() - 25 * 60 * 60 * 1000);
    expect(formatarTempoRelativo(umDiaAtras)).toBe('há 1 dia');
  });

  it('formata múltiplos dias', () => {
    const cincoDias = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    expect(formatarTempoRelativo(cincoDias)).toBe('há 5 dias');
  });
});

// ============================================
// GERACAO DE ALERTAS - SEM USO
// ============================================

describe('gerarAlertasSemUso', () => {
  const makeCliente = (overrides = {}) => ({
    id: 'c1',
    status: 'ativo',
    team_name: 'Acme',
    times: ['t1'],
    responsaveis: [{ email: 'cs@trakto.io', nome: 'CS' }],
    ...overrides,
  });

  it('gera alerta quando cliente tem 20 dias sem uso', () => {
    const vinteDias = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
    const clientes = [makeCliente({ ultima_interacao: vinteDias })];
    const alertas = gerarAlertasSemUso(clientes, [], [], {});
    expect(alertas).toHaveLength(1);
    expect(alertas[0].tipo).toBe('sem_uso_plataforma');
    expect(alertas[0].prioridade).toBe('media');
  });

  it('gera alerta alta prioridade para 30+ dias', () => {
    const trintaDias = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
    const clientes = [makeCliente({ ultima_interacao: trintaDias })];
    const alertas = gerarAlertasSemUso(clientes, [], [], {});
    expect(alertas[0].prioridade).toBe('alta');
  });

  it('NÃO gera alerta para cliente com menos de 15 dias', () => {
    const dezDias = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const clientes = [makeCliente({ ultima_interacao: dezDias })];
    const alertas = gerarAlertasSemUso(clientes, [], [], {});
    expect(alertas).toHaveLength(0);
  });

  it('NÃO gera alerta para clientes inativos', () => {
    const vinteDias = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
    const clientes = [makeCliente({ status: 'inativo', ultima_interacao: vinteDias })];
    const alertas = gerarAlertasSemUso(clientes, [], [], {});
    expect(alertas).toHaveLength(0);
  });

  it('NÃO gera alerta para clientes cancelados', () => {
    const vinteDias = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
    const clientes = [makeCliente({ status: 'cancelado', ultima_interacao: vinteDias })];
    const alertas = gerarAlertasSemUso(clientes, [], [], {});
    expect(alertas).toHaveLength(0);
  });

  it('NÃO duplica alerta se já existe pendente', () => {
    const vinteDias = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
    const clientes = [makeCliente({ ultima_interacao: vinteDias })];
    const alertasExistentes = [
      { tipo: 'sem_uso_plataforma', cliente_id: 'c1', status: 'pendente' },
    ];
    const alertas = gerarAlertasSemUso(clientes, [], alertasExistentes, {});
    expect(alertas).toHaveLength(0);
  });

  it('NÃO duplica alerta se já existe em_andamento', () => {
    const vinteDias = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
    const clientes = [makeCliente({ ultima_interacao: vinteDias })];
    const alertasExistentes = [
      { tipo: 'sem_uso_plataforma', cliente_id: 'c1', status: 'em_andamento' },
    ];
    const alertas = gerarAlertasSemUso(clientes, [], alertasExistentes, {});
    expect(alertas).toHaveLength(0);
  });

  it('GERA alerta se existente foi resolvido', () => {
    const vinteDias = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
    const clientes = [makeCliente({ ultima_interacao: vinteDias })];
    const alertasExistentes = [
      { tipo: 'sem_uso_plataforma', cliente_id: 'c1', status: 'resolvido' },
    ];
    const alertas = gerarAlertasSemUso(clientes, [], alertasExistentes, {});
    expect(alertas).toHaveLength(1);
  });

  it('NÃO gera para mais de 365 dias (dado inválido)', () => {
    const anoAtras = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
    const clientes = [makeCliente({ ultima_interacao: anoAtras })];
    const alertas = gerarAlertasSemUso(clientes, [], [], {});
    expect(alertas).toHaveLength(0);
  });

  it('busca data nas threads se cliente não tem', () => {
    const vinteDias = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
    const clientes = [makeCliente()]; // sem ultima_interacao
    const threadsMap = {
      c1: [{ updated_at: vinteDias }],
    };
    const alertas = gerarAlertasSemUso(clientes, [], [], threadsMap);
    expect(alertas).toHaveLength(1);
  });
});

// ============================================
// GERACAO DE ALERTAS - SENTIMENTO NEGATIVO
// ============================================

describe('gerarAlertasSentimentoNegativo', () => {
  it('gera alerta para thread com sentimento negativo', () => {
    const threads = [
      { id: 'th1', sentimento: 'negativo', team_id: 'c1', assunto: 'Problema' },
    ];
    const clientesMap = {
      c1: { id: 'c1', status: 'ativo', team_name: 'Acme', responsaveis: [{ email: 'cs@trakto.io', nome: 'CS' }] },
    };
    const alertas = gerarAlertasSentimentoNegativo(threads, [], clientesMap);
    expect(alertas).toHaveLength(1);
    expect(alertas[0].tipo).toBe('sentimento_negativo');
    expect(alertas[0].prioridade).toBe('alta');
  });

  it('gera alerta urgente para thread urgente', () => {
    const threads = [
      { id: 'th1', sentimento: 'urgente', team_id: 'c1', assunto: 'Urgente' },
    ];
    const clientesMap = {
      c1: { id: 'c1', status: 'ativo', team_name: 'Acme', responsaveis: [] },
    };
    const alertas = gerarAlertasSentimentoNegativo(threads, [], clientesMap);
    expect(alertas[0].prioridade).toBe('urgente');
  });

  it('NÃO gera para sentimento positivo/neutro', () => {
    const threads = [
      { id: 'th1', sentimento: 'positivo', team_id: 'c1' },
      { id: 'th2', sentimento: 'neutro', team_id: 'c1' },
    ];
    const clientesMap = {
      c1: { id: 'c1', status: 'ativo', team_name: 'Acme' },
    };
    const alertas = gerarAlertasSentimentoNegativo(threads, [], clientesMap);
    expect(alertas).toHaveLength(0);
  });

  it('NÃO gera se cliente não encontrado', () => {
    const threads = [
      { id: 'th1', sentimento: 'negativo', team_id: 'desconhecido' },
    ];
    const alertas = gerarAlertasSentimentoNegativo(threads, [], {});
    expect(alertas).toHaveLength(0);
  });

  it('NÃO gera para cliente inativo', () => {
    const threads = [
      { id: 'th1', sentimento: 'negativo', team_id: 'c1' },
    ];
    const clientesMap = {
      c1: { id: 'c1', status: 'inativo', team_name: 'Acme' },
    };
    const alertas = gerarAlertasSentimentoNegativo(threads, [], clientesMap);
    expect(alertas).toHaveLength(0);
  });

  it('NÃO duplica se já existe alerta pendente', () => {
    const threads = [
      { id: 'th1', sentimento: 'negativo', team_id: 'c1' },
    ];
    const clientesMap = {
      c1: { id: 'c1', status: 'ativo', team_name: 'Acme', responsaveis: [] },
    };
    const alertasExistentes = [
      { tipo: 'sentimento_negativo', thread_id: 'th1', status: 'pendente' },
    ];
    const alertas = gerarAlertasSentimentoNegativo(threads, alertasExistentes, clientesMap);
    expect(alertas).toHaveLength(0);
  });
});

// ============================================
// GERACAO DE ALERTAS - PROBLEMA/RECLAMACAO
// ============================================

describe('gerarAlertasProblemaReclamacao', () => {
  it('gera alerta para categoria erro_bug', () => {
    const threads = [
      { id: 'th1', categoria: 'erro_bug', team_id: 'c1', assunto: 'Bug' },
    ];
    const clientesMap = {
      c1: { id: 'c1', status: 'ativo', team_name: 'Acme', responsaveis: [] },
    };
    const alertas = gerarAlertasProblemaReclamacao(threads, [], clientesMap);
    expect(alertas).toHaveLength(1);
    expect(alertas[0].tipo).toBe('problema_reclamacao');
  });

  it('gera alerta para categoria reclamacao', () => {
    const threads = [
      { id: 'th1', categoria: 'reclamacao', team_id: 'c1' },
    ];
    const clientesMap = {
      c1: { id: 'c1', status: 'ativo', team_name: 'Acme', responsaveis: [] },
    };
    const alertas = gerarAlertasProblemaReclamacao(threads, [], clientesMap);
    expect(alertas).toHaveLength(1);
  });

  it('NÃO gera para categorias normais', () => {
    const threads = [
      { id: 'th1', categoria: 'feedback', team_id: 'c1' },
      { id: 'th2', categoria: 'duvida_pergunta', team_id: 'c1' },
    ];
    const clientesMap = {
      c1: { id: 'c1', status: 'ativo', team_name: 'Acme' },
    };
    const alertas = gerarAlertasProblemaReclamacao(threads, [], clientesMap);
    expect(alertas).toHaveLength(0);
  });

  it('NÃO gera se já existe alerta', () => {
    const threads = [
      { id: 'th1', categoria: 'erro_bug', team_id: 'c1' },
    ];
    const clientesMap = {
      c1: { id: 'c1', status: 'ativo', team_name: 'Acme', responsaveis: [] },
    };
    const alertasExistentes = [
      { tipo: 'problema_reclamacao', thread_id: 'th1', status: 'pendente' },
    ];
    const alertas = gerarAlertasProblemaReclamacao(threads, alertasExistentes, clientesMap);
    expect(alertas).toHaveLength(0);
  });
});

// ============================================
// GERACAO DE ALERTAS - SAZONALIDADE
// ============================================

describe('gerarAlertasSazonalidade', () => {
  it('gera alerta para cliente inativo em mês de alta', () => {
    const mesKey = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][new Date().getMonth()];
    const clientes = [{
      id: 'c1',
      status: 'ativo',
      team_name: 'Acme',
      times: ['t1'],
      calendario_campanhas: { [mesKey]: 'alta' },
    }];
    // Sem métricas recentes
    const alertas = gerarAlertasSazonalidade(clientes, [], []);
    expect(alertas).toHaveLength(1);
    expect(alertas[0].tipo).toBe('sazonalidade_alta_inativo');
    expect(alertas[0].prioridade).toBe('alta');
  });

  it('NÃO gera se mês não é alta', () => {
    const mesKey = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][new Date().getMonth()];
    const clientes = [{
      id: 'c1',
      status: 'ativo',
      times: ['t1'],
      calendario_campanhas: { [mesKey]: 'normal' },
    }];
    const alertas = gerarAlertasSazonalidade(clientes, [], []);
    expect(alertas).toHaveLength(0);
  });

  it('NÃO gera se cliente tem atividade recente', () => {
    const mesKey = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][new Date().getMonth()];
    const clientes = [{
      id: 'c1',
      status: 'ativo',
      times: ['t1'],
      calendario_campanhas: { [mesKey]: 'alta' },
    }];
    const metricas = [{
      team_id: 't1',
      data: new Date(), // recente
      logins: 5,
    }];
    const alertas = gerarAlertasSazonalidade(clientes, metricas, []);
    expect(alertas).toHaveLength(0);
  });
});

// ============================================
// ORDENAR ALERTAS
// ============================================

describe('ordenarAlertas', () => {
  it('ordena por prioridade (urgente primeiro)', () => {
    const alertas = [
      { prioridade: 'baixa', created_at: new Date() },
      { prioridade: 'urgente', created_at: new Date() },
      { prioridade: 'media', created_at: new Date() },
      { prioridade: 'alta', created_at: new Date() },
    ];
    const sorted = ordenarAlertas(alertas);
    expect(sorted[0].prioridade).toBe('urgente');
    expect(sorted[1].prioridade).toBe('alta');
    expect(sorted[2].prioridade).toBe('media');
    expect(sorted[3].prioridade).toBe('baixa');
  });

  it('mesma prioridade: ordena por data (mais recente primeiro)', () => {
    const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const hoje = new Date();
    const alertas = [
      { prioridade: 'alta', created_at: ontem },
      { prioridade: 'alta', created_at: hoje },
    ];
    const sorted = ordenarAlertas(alertas);
    expect(sorted[0].created_at).toEqual(hoje);
  });

  it('não modifica array original', () => {
    const alertas = [
      { prioridade: 'baixa', created_at: new Date() },
      { prioridade: 'urgente', created_at: new Date() },
    ];
    const sorted = ordenarAlertas(alertas);
    expect(sorted).not.toBe(alertas);
    expect(alertas[0].prioridade).toBe('baixa');
  });
});

// ============================================
// VERIFICAR TODOS ALERTAS
// ============================================

describe('verificarTodosAlertas', () => {
  it('retorna array de alertas combinados', () => {
    const vinteDias = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
    // Cliente em RESGATE deve gerar alerta
    const clientes = [{
      id: 'c1',
      status: 'ativo',
      team_name: 'Acme',
      times: ['t1'],
      segmento_cs: 'RESGATE',
      segmento_motivo: 'Sem atividade',
      responsaveis: [],
    }];
    const result = verificarTodosAlertas(clientes, [], [], []);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    // Deve ter alerta de entrou_resgate
    expect(result.some(a => a.tipo === 'entrou_resgate')).toBe(true);
  });

  it('filtra threads irrelevantes quando filterConfig ativo', () => {
    const clientes = [{ id: 'c1', status: 'ativo', times: ['t1'] }];
    const threads = [
      { id: 'th1', sentimento: 'negativo', team_id: 'c1', remetente_email: 'noreply@example.com' },
    ];
    const filterConfig = {
      filtro_ativo: true,
      dominios_bloqueados: ['noreply@'],
      dominios_completos_bloqueados: [],
      palavras_chave_assunto: [],
      detectar_auto_reply: false,
      detectar_bulk_email: false,
    };
    const result = verificarTodosAlertas(clientes, threads, [], [], filterConfig);
    // A thread deve ter sido filtrada antes de gerar alerta de sentimento
    const sentimentoAlertas = result.filter(a => a.tipo === 'sentimento_negativo');
    expect(sentimentoAlertas).toHaveLength(0);
  });

  it('detecta conflitos de times compartilhados', () => {
    const clientes = [
      { id: 'c1', status: 'ativo', times: ['shared-id'], team_name: 'Cliente A' },
      { id: 'c2', status: 'ativo', times: ['shared-id'], team_name: 'Cliente B' },
    ];
    // Should not throw
    const result = verificarTodosAlertas(clientes, [], [], []);
    expect(Array.isArray(result)).toBe(true);
  });
});
