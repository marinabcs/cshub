import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calcularSegmentoCS,
  getSegmentoInfo,
  getSegmentoColor,
  getSegmentoBgColor,
  getSegmentoLabel,
  getSegmentoAcoes,
  getSazonalidadeMesAtual,
  getClienteSegmento,
  isSegmentoOverride,
  SEGMENTOS_CS,
  SEGMENTO_OPTIONS,
  DEFAULT_SEGMENTO,
  DEFAULT_ONGOING_ACOES,
  MESES_KEYS,
} from '../segmentoCS';

// Helper: criar cliente base
function makeCliente(overrides = {}) {
  return {
    id: 'c1',
    status: 'ativo',
    tipo_conta: 'pagante',
    tags_problema: [],
    bugs_reportados: [],
    times: ['t1'],
    team_name: 'Acme',
    ...overrides,
  };
}

// Helper: criar metricas (ultimos 30 dias)
function makeMetricas(overrides = {}) {
  return {
    logins: 30,
    dias_ativos: 20,
    pecas_criadas: 50,
    uso_ai_total: 20,
    downloads: 10,
    ultima_atividade: new Date(), // hoje
    ...overrides,
  };
}

// Helper: criar thread
function makeThread(overrides = {}) {
  return {
    id: 'th1',
    updated_at: new Date(),
    sentimento: 'neutro',
    categoria: 'duvida_pergunta',
    ...overrides,
  };
}

// ============================================
// CONSTANTES E EXPORTS
// ============================================

describe('Constantes e exports', () => {
  it('SEGMENTOS_CS tem 4 segmentos', () => {
    expect(Object.keys(SEGMENTOS_CS)).toHaveLength(4);
    expect(SEGMENTOS_CS).toHaveProperty('CRESCIMENTO');
    expect(SEGMENTOS_CS).toHaveProperty('ESTAVEL');
    expect(SEGMENTOS_CS).toHaveProperty('ALERTA');
    expect(SEGMENTOS_CS).toHaveProperty('RESGATE');
  });

  it('cada segmento tem campos obrigatórios', () => {
    for (const seg of Object.values(SEGMENTOS_CS)) {
      expect(seg).toHaveProperty('value');
      expect(seg).toHaveProperty('label');
      expect(seg).toHaveProperty('color');
      expect(seg).toHaveProperty('bgColor');
      expect(seg).toHaveProperty('priority');
      expect(seg).toHaveProperty('acoes');
      expect(Array.isArray(seg.acoes)).toBe(true);
    }
  });

  it('SEGMENTO_OPTIONS tem 4 itens ordenados', () => {
    expect(SEGMENTO_OPTIONS).toHaveLength(4);
    expect(SEGMENTO_OPTIONS[0].value).toBe('CRESCIMENTO');
    expect(SEGMENTO_OPTIONS[3].value).toBe('RESGATE');
  });

  it('DEFAULT_SEGMENTO é ESTAVEL', () => {
    expect(DEFAULT_SEGMENTO).toBe('ESTAVEL');
  });

  it('MESES_KEYS tem 12 meses', () => {
    expect(MESES_KEYS).toHaveLength(12);
    expect(MESES_KEYS[0]).toBe('jan');
    expect(MESES_KEYS[11]).toBe('dez');
  });
});

// ============================================
// LEGACY SEGMENT MAP
// ============================================

describe('Legacy segment mapping', () => {
  it('converte GROW para CRESCIMENTO', () => {
    expect(getClienteSegmento({ segmento_cs: 'GROW' })).toBe('CRESCIMENTO');
  });

  it('converte NURTURE para ESTAVEL', () => {
    expect(getClienteSegmento({ segmento_cs: 'NURTURE' })).toBe('ESTAVEL');
  });

  it('converte WATCH para ALERTA', () => {
    expect(getClienteSegmento({ segmento_cs: 'WATCH' })).toBe('ALERTA');
  });

  it('converte RESCUE para RESGATE', () => {
    expect(getClienteSegmento({ segmento_cs: 'RESCUE' })).toBe('RESGATE');
  });

  it('mantem valores novos inalterados', () => {
    expect(getClienteSegmento({ segmento_cs: 'CRESCIMENTO' })).toBe('CRESCIMENTO');
    expect(getClienteSegmento({ segmento_cs: 'ESTAVEL' })).toBe('ESTAVEL');
  });

  it('retorna DEFAULT_SEGMENTO quando sem segmento_cs', () => {
    expect(getClienteSegmento({})).toBe('ESTAVEL');
    expect(getClienteSegmento(null)).toBe('ESTAVEL');
  });
});

// ============================================
// getSegmentoInfo / Color / BgColor / Label / Acoes
// ============================================

describe('getSegmentoInfo', () => {
  it('retorna info correta para segmento válido', () => {
    const info = getSegmentoInfo('CRESCIMENTO');
    expect(info).not.toBeNull();
    expect(info.value).toBe('CRESCIMENTO');
    expect(info.label).toBe('Crescimento');
  });

  it('retorna info para segmento legado', () => {
    const info = getSegmentoInfo('GROW');
    expect(info).not.toBeNull();
    expect(info.value).toBe('CRESCIMENTO');
  });

  it('retorna null para segmento inválido', () => {
    expect(getSegmentoInfo('INVALIDO')).toBeNull();
  });
});

describe('getSegmentoColor', () => {
  it('retorna cor correta para cada segmento', () => {
    expect(getSegmentoColor('CRESCIMENTO')).toBe('#10b981');
    expect(getSegmentoColor('ESTAVEL')).toBe('#3b82f6');
    expect(getSegmentoColor('ALERTA')).toBe('#f59e0b');
    expect(getSegmentoColor('RESGATE')).toBe('#ef4444');
  });

  it('retorna cor fallback para segmento inválido', () => {
    expect(getSegmentoColor('INVALIDO')).toBe('#6b7280');
  });

  it('funciona com segmentos legados', () => {
    expect(getSegmentoColor('GROW')).toBe('#10b981');
  });
});

describe('getSegmentoBgColor', () => {
  it('retorna bgColor correto', () => {
    expect(getSegmentoBgColor('RESGATE')).toBe('rgba(239, 68, 68, 0.15)');
  });

  it('retorna fallback para inválido', () => {
    expect(getSegmentoBgColor('XYZ')).toBe('rgba(107, 114, 128, 0.15)');
  });
});

describe('getSegmentoLabel', () => {
  it('retorna label correto', () => {
    expect(getSegmentoLabel('CRESCIMENTO')).toBe('Crescimento');
    expect(getSegmentoLabel('RESGATE')).toBe('Resgate');
  });

  it('retorna o próprio valor para inválido', () => {
    expect(getSegmentoLabel('DESCONHECIDO')).toBe('DESCONHECIDO');
  });
});

describe('getSegmentoAcoes', () => {
  it('retorna array de ações', () => {
    const acoes = getSegmentoAcoes('CRESCIMENTO');
    expect(Array.isArray(acoes)).toBe(true);
    expect(acoes.length).toBeGreaterThan(0);
  });

  it('retorna array vazio para inválido', () => {
    expect(getSegmentoAcoes('XYZ')).toEqual([]);
  });

  it('usa ongoingConfig quando fornecido', () => {
    const config = { CRESCIMENTO: ['Ação custom 1', 'Ação custom 2'] };
    const acoes = getSegmentoAcoes('CRESCIMENTO', config);
    expect(acoes).toEqual(['Ação custom 1', 'Ação custom 2']);
  });

  it('fallback para padrão se segmento não existe no config', () => {
    const config = { CRESCIMENTO: ['Ação custom'] };
    const acoes = getSegmentoAcoes('ALERTA', config);
    expect(acoes).toEqual(SEGMENTOS_CS.ALERTA.acoes);
  });

  it('converte segmento legado com ongoingConfig', () => {
    const config = { CRESCIMENTO: ['Custom'] };
    const acoes = getSegmentoAcoes('GROW', config);
    expect(acoes).toEqual(['Custom']);
  });
});

// ============================================
// DEFAULT_ONGOING_ACOES
// ============================================

describe('DEFAULT_ONGOING_ACOES', () => {
  it('tem todos os 4 segmentos', () => {
    expect(DEFAULT_ONGOING_ACOES).toHaveProperty('CRESCIMENTO');
    expect(DEFAULT_ONGOING_ACOES).toHaveProperty('ESTAVEL');
    expect(DEFAULT_ONGOING_ACOES).toHaveProperty('ALERTA');
    expect(DEFAULT_ONGOING_ACOES).toHaveProperty('RESGATE');
  });

  it('cada segmento tem ações como arrays não vazios', () => {
    for (const seg of ['CRESCIMENTO', 'ESTAVEL', 'ALERTA', 'RESGATE']) {
      expect(Array.isArray(DEFAULT_ONGOING_ACOES[seg])).toBe(true);
      expect(DEFAULT_ONGOING_ACOES[seg].length).toBeGreaterThan(0);
    }
  });

  it('corresponde às ações de SEGMENTOS_CS', () => {
    expect(DEFAULT_ONGOING_ACOES.CRESCIMENTO).toEqual(SEGMENTOS_CS.CRESCIMENTO.acoes);
    expect(DEFAULT_ONGOING_ACOES.ESTAVEL).toEqual(SEGMENTOS_CS.ESTAVEL.acoes);
    expect(DEFAULT_ONGOING_ACOES.ALERTA).toEqual(SEGMENTOS_CS.ALERTA.acoes);
    expect(DEFAULT_ONGOING_ACOES.RESGATE).toEqual(SEGMENTOS_CS.RESGATE.acoes);
  });
});

// ============================================
// getSazonalidadeMesAtual
// ============================================

describe('getSazonalidadeMesAtual', () => {
  it('retorna normal se sem calendário', () => {
    expect(getSazonalidadeMesAtual({})).toBe('normal');
    expect(getSazonalidadeMesAtual(null)).toBe('normal');
  });

  it('retorna o valor do mês atual no calendário', () => {
    const mesAtual = MESES_KEYS[new Date().getMonth()];
    const cliente = {
      calendario_campanhas: { [mesAtual]: 'alta' },
    };
    expect(getSazonalidadeMesAtual(cliente)).toBe('alta');
  });

  it('retorna normal se mês não está definido no calendário', () => {
    const cliente = { calendario_campanhas: {} };
    expect(getSazonalidadeMesAtual(cliente)).toBe('normal');
  });
});

// ============================================
// isSegmentoOverride
// ============================================

describe('isSegmentoOverride', () => {
  it('retorna true quando override é true', () => {
    expect(isSegmentoOverride({ segmento_override: true })).toBe(true);
  });

  it('retorna false quando override é false', () => {
    expect(isSegmentoOverride({ segmento_override: false })).toBe(false);
  });

  it('retorna false quando não tem override', () => {
    expect(isSegmentoOverride({})).toBe(false);
  });
});

// ============================================
// calcularSegmentoCS - REGRAS DE CLASSIFICACAO
// ============================================

describe('calcularSegmentoCS', () => {
  // RESGATE

  describe('RESGATE', () => {
    it('cliente em aviso_previo => RESGATE', () => {
      const cliente = makeCliente({ status: 'aviso_previo' });
      const result = calcularSegmentoCS(cliente, [], makeMetricas(), 1);
      expect(result.segmento).toBe('RESGATE');
      expect(result.motivo).toContain('aviso previo');
    });

    it('30+ dias sem uso (pagante) => RESGATE', () => {
      const trintaDiasAtras = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      const cliente = makeCliente({ updated_at: trintaDiasAtras });
      const metricas = { ultima_atividade: trintaDiasAtras };
      const result = calcularSegmentoCS(cliente, [], metricas, 1);
      expect(result.segmento).toBe('RESGATE');
      expect(result.motivo).toContain('dias sem uso');
    });

    it('reclamação grave (urgente nos últimos 7 dias) => RESGATE', () => {
      const cliente = makeCliente();
      const thread = makeThread({
        sentimento: 'urgente',
        updated_at: new Date(), // hoje
      });
      const metricas = makeMetricas();
      const result = calcularSegmentoCS(cliente, [thread], metricas, 1);
      expect(result.segmento).toBe('RESGATE');
      expect(result.motivo).toContain('Reclamacao grave');
    });

    it('sem uso + reclamações recentes => RESGATE', () => {
      const cliente = makeCliente();
      const thread = makeThread({
        sentimento: 'negativo',
        updated_at: new Date(),
      });
      const metricas = { logins: 0, dias_ativos: 0 }; // sem_uso
      const result = calcularSegmentoCS(cliente, [thread], metricas, 1);
      expect(result.segmento).toBe('RESGATE');
    });

    it('sem produção e sem uso recente => RESGATE', () => {
      const oitoDiasAtras = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      const cliente = makeCliente({ updated_at: oitoDiasAtras });
      const metricas = {
        ultima_atividade: oitoDiasAtras,
        logins: 15,
        dias_ativos: 10,
        pecas_criadas: 0,
        downloads: 0,
        uso_ai_total: 0,
      };
      // frequencia = 'regular' (dias_ativos >= 8), mas sem produção + 8 dias sem uso
      const result = calcularSegmentoCS(cliente, [], metricas, 1);
      expect(result.segmento).toBe('RESGATE');
      expect(result.motivo).toContain('Sem producao');
    });
  });

  // ALERTA

  describe('ALERTA', () => {
    it('14+ dias sem uso (pagante) => ALERTA', () => {
      const quinzeDiasAtras = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
      const cliente = makeCliente();
      const metricas = {
        ultima_atividade: quinzeDiasAtras,
        logins: 10,
        dias_ativos: 10,
        pecas_criadas: 5,
        downloads: 2,
        uso_ai_total: 1,
      };
      const result = calcularSegmentoCS(cliente, [], metricas, 1);
      expect(result.segmento).toBe('ALERTA');
      expect(result.motivo).toContain('dias sem uso');
    });

    it('reclamações recentes (sem ser urgente) => ALERTA', () => {
      const cliente = makeCliente();
      const thread = makeThread({
        sentimento: 'negativo',
        categoria: 'reclamacao',
        updated_at: new Date(),
      });
      const metricas = makeMetricas();
      const result = calcularSegmentoCS(cliente, [thread], metricas, 1);
      expect(result.segmento).toBe('ALERTA');
      expect(result.motivo).toContain('Reclamacoes recentes');
    });

    it('champion saiu => ALERTA', () => {
      const cliente = makeCliente({ champion_saiu: true });
      const metricas = makeMetricas();
      const result = calcularSegmentoCS(cliente, [], metricas, 1);
      expect(result.segmento).toBe('ALERTA');
      expect(result.motivo).toContain('Champion saiu');
    });

    it('uso raro => ALERTA', () => {
      const cliente = makeCliente();
      const metricas = {
        ...makeMetricas(),
        logins: 1,
        dias_ativos: 1,
        pecas_criadas: 1,
      };
      const result = calcularSegmentoCS(cliente, [], metricas, 1);
      expect(result.segmento).toBe('ALERTA');
      expect(result.motivo).toContain('Uso raro');
    });

    it('uso irregular => ALERTA', () => {
      const cliente = makeCliente();
      const metricas = {
        ...makeMetricas(),
        logins: 3,
        dias_ativos: 4,
        pecas_criadas: 5,
      };
      const result = calcularSegmentoCS(cliente, [], metricas, 1);
      expect(result.segmento).toBe('ALERTA');
      expect(result.motivo).toContain('irregular');
    });

    it('tag Risco de Churn => ALERTA', () => {
      const cliente = makeCliente({
        tags_problema: [{ tag: 'Risco de Churn' }],
      });
      const metricas = makeMetricas();
      const result = calcularSegmentoCS(cliente, [], metricas, 1);
      expect(result.segmento).toBe('ALERTA');
      expect(result.motivo).toContain('Risco de Churn');
    });

    it('3+ bugs abertos => ALERTA', () => {
      const cliente = makeCliente({
        bugs_reportados: [
          { id: '1', status: 'aberto' },
          { id: '2', status: 'em_andamento' },
          { id: '3', status: 'aberto' },
        ],
      });
      const metricas = makeMetricas();
      const result = calcularSegmentoCS(cliente, [], metricas, 1);
      expect(result.segmento).toBe('ALERTA');
      expect(result.motivo).toContain('bugs abertos');
    });

    it('login sem produção => ALERTA', () => {
      const cliente = makeCliente();
      const metricas = {
        ultima_atividade: new Date(),
        logins: 10,
        dias_ativos: 10,
        pecas_criadas: 0,
        downloads: 0,
        uso_ai_total: 0,
      };
      const result = calcularSegmentoCS(cliente, [], metricas, 1);
      expect(result.segmento).toBe('ALERTA');
      expect(result.motivo).toContain('Login sem producao');
    });
  });

  // TIPO DE CONTA E SAZONALIDADE

  describe('google_gratuito - thresholds lenientes', () => {
    it('60+ dias sem uso para RESGATE (ao invés de 30)', () => {
      const quarentaDiasAtras = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
      const cliente = makeCliente({ tipo_conta: 'google_gratuito' });
      const metricas = {
        ultima_atividade: quarentaDiasAtras,
        logins: 10,
        dias_ativos: 10,
        pecas_criadas: 5,
        downloads: 2,
        uso_ai_total: 1,
      };
      // 40 dias sem uso: pagante seria RESGATE, gratuito é ALERTA
      const result = calcularSegmentoCS(cliente, [], metricas, 1);
      expect(result.segmento).toBe('ALERTA');
    });
  });

  describe('sazonalidade', () => {
    it('mês de baixa dobra thresholds', () => {
      const mesAtual = MESES_KEYS[new Date().getMonth()];
      const vinteDiasAtras = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
      const cliente = makeCliente({
        calendario_campanhas: { [mesAtual]: 'baixa' },
      });
      const metricas = {
        ultima_atividade: vinteDiasAtras,
        logins: 10,
        dias_ativos: 10,
        pecas_criadas: 5,
        downloads: 2,
        uso_ai_total: 1,
      };
      // 20 dias: threshold normal ALERTA = 14, mas com baixa = 28, então não é alerta
      const result = calcularSegmentoCS(cliente, [], metricas, 1);
      expect(result.segmento).not.toBe('RESGATE');
    });
  });

  // CRESCIMENTO

  describe('CRESCIMENTO', () => {
    it('uso frequente + alto engajamento => CRESCIMENTO', () => {
      const cliente = makeCliente({ ultima_interacao_data: new Date() });
      const metricas = makeMetricas({
        logins: 50,
        dias_ativos: 25,
        pecas_criadas: 100,
        uso_ai_total: 50,
        downloads: 30,
      });
      const result = calcularSegmentoCS(cliente, [], metricas, 1);
      expect(result.segmento).toBe('CRESCIMENTO');
      expect(result.motivo).toContain('frequente');
    });

    it('uso frequente + engajamento medio sem problemas => CRESCIMENTO', () => {
      const cliente = makeCliente({ ultima_interacao_data: new Date() });
      const metricas = makeMetricas({
        logins: 30,
        dias_ativos: 22,
        pecas_criadas: 10,
        uso_ai_total: 5,
        downloads: 3,
      });
      const result = calcularSegmentoCS(cliente, [], metricas, 1);
      expect(result.segmento).toBe('CRESCIMENTO');
    });

    it('NÃO crescimento se tem tags de problema', () => {
      const cliente = makeCliente({
        tags_problema: [{ tag: 'Problema X' }],
        ultima_interacao_data: new Date(),
      });
      const metricas = makeMetricas({
        logins: 50,
        dias_ativos: 25,
        pecas_criadas: 100,
        uso_ai_total: 50,
        downloads: 30,
      });
      const result = calcularSegmentoCS(cliente, [], metricas, 1);
      expect(result.segmento).not.toBe('CRESCIMENTO');
    });

    it('NÃO crescimento se sem contato recente (60+ dias)', () => {
      const sessenta = new Date(Date.now() - 61 * 24 * 60 * 60 * 1000);
      const cliente = makeCliente({ ultima_interacao_data: sessenta });
      const metricas = makeMetricas({
        logins: 50,
        dias_ativos: 25,
        pecas_criadas: 100,
        uso_ai_total: 50,
        downloads: 30,
      });
      const result = calcularSegmentoCS(cliente, [], metricas, 1);
      expect(result.segmento).not.toBe('CRESCIMENTO');
    });
  });

  // ESTAVEL (default)

  describe('ESTAVEL', () => {
    it('cliente regular sem problemas => ESTAVEL', () => {
      const cliente = makeCliente();
      const metricas = makeMetricas({
        logins: 12,
        dias_ativos: 10,
        pecas_criadas: 8,
        uso_ai_total: 2,
        downloads: 3,
      });
      const result = calcularSegmentoCS(cliente, [], metricas, 1);
      expect(result.segmento).toBe('ESTAVEL');
      expect(result.motivo).toContain('estavel');
    });
  });

  // FATORES

  describe('fatores retornados', () => {
    it('retorna todos os fatores esperados', () => {
      const cliente = makeCliente();
      const result = calcularSegmentoCS(cliente, [], makeMetricas(), 1);
      expect(result.fatores).toHaveProperty('dias_sem_uso');
      expect(result.fatores).toHaveProperty('frequencia_uso');
      expect(result.fatores).toHaveProperty('reclamacoes_recentes');
      expect(result.fatores).toHaveProperty('reclamacao_grave');
      expect(result.fatores).toHaveProperty('engajamento');
      expect(result.fatores).toHaveProperty('em_aviso_previo');
      expect(result.fatores).toHaveProperty('champion_saiu');
      expect(result.fatores).toHaveProperty('tipo_conta');
      expect(result.fatores).toHaveProperty('sazonalidade_mes_atual');
    });
  });

  // EDGE CASES

  describe('edge cases', () => {
    it('funciona com threads e metricas vazias', () => {
      const cliente = makeCliente();
      const result = calcularSegmentoCS(cliente, [], {}, 1);
      expect(result).toHaveProperty('segmento');
      expect(result).toHaveProperty('motivo');
      expect(result).toHaveProperty('fatores');
    });

    it('funciona com totalUsers = 0 (evita divisão por zero)', () => {
      const cliente = makeCliente();
      const result = calcularSegmentoCS(cliente, [], makeMetricas(), 0);
      expect(result).toHaveProperty('segmento');
    });

    it('reclamação antiga (31+ dias) não conta como recente', () => {
      const cliente = makeCliente();
      const thread = makeThread({
        sentimento: 'negativo',
        updated_at: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000),
      });
      const metricas = makeMetricas();
      const result = calcularSegmentoCS(cliente, [thread], metricas, 1);
      // Não deve contar como reclamação recente
      expect(result.fatores.reclamacoes_recentes).toBe(false);
    });

    it('thread urgente antiga (8+ dias) não conta como grave', () => {
      const cliente = makeCliente();
      const thread = makeThread({
        sentimento: 'urgente',
        updated_at: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
      });
      const metricas = makeMetricas();
      const result = calcularSegmentoCS(cliente, [thread], metricas, 1);
      expect(result.fatores.reclamacao_grave).toBe(false);
    });
  });
});
