import { describe, it, expect } from 'vitest';
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
// calcularSegmentoCS - REGRAS DE CLASSIFICACAO (V1)
// ============================================

describe('calcularSegmentoCS', () => {
  // ============================================
  // REGRA DE BUGS - OVERRIDE ABSOLUTO (V1)
  // ============================================

  describe('REGRA DE BUGS (override absoluto)', () => {
    it('2+ bugs/reclamações => RESGATE (mesmo com métricas excelentes)', () => {
      const cliente = makeCliente();
      const threads = [
        makeThread({ sentimento: 'negativo', status: 'aberto' }),
        makeThread({ categoria: 'reclamacao', status: 'aberto' }),
      ];
      // Métricas excelentes que normalmente seriam CRESCIMENTO
      const metricas = makeMetricas({ dias_ativos: 25, pecas_criadas: 100, uso_ai_total: 50, downloads: 30 });
      const result = calcularSegmentoCS(cliente, threads, metricas, 1);
      expect(result.segmento).toBe('RESGATE');
      expect(result.motivo).toContain('2+ = Resgate');
    });

    it('3 bugs => RESGATE', () => {
      const cliente = makeCliente();
      const threads = [
        makeThread({ sentimento: 'negativo', status: 'aberto' }),
        makeThread({ sentimento: 'urgente', status: 'aberto' }),
        makeThread({ categoria: 'erro_bug', status: 'aberto' }),
      ];
      const result = calcularSegmentoCS(cliente, threads, makeMetricas(), 1);
      expect(result.segmento).toBe('RESGATE');
    });

    it('1 bug/reclamação => ALERTA (mesmo com métricas excelentes)', () => {
      const cliente = makeCliente();
      const thread = makeThread({ sentimento: 'negativo', status: 'aberto' });
      // Métricas excelentes que normalmente seriam CRESCIMENTO
      const metricas = makeMetricas({ dias_ativos: 25, pecas_criadas: 100, uso_ai_total: 50, downloads: 30 });
      const result = calcularSegmentoCS(cliente, [thread], metricas, 1);
      expect(result.segmento).toBe('ALERTA');
      expect(result.motivo).toContain('1 = Alerta');
    });

    it('0 bugs => classificar por métricas normalmente', () => {
      const cliente = makeCliente();
      const metricas = makeMetricas({ dias_ativos: 25, pecas_criadas: 100, uso_ai_total: 50, downloads: 30 });
      const result = calcularSegmentoCS(cliente, [], metricas, 1);
      expect(result.segmento).toBe('CRESCIMENTO');
    });

    it('bug resolvido não conta (thread com resolvido: true)', () => {
      const cliente = makeCliente();
      const thread = makeThread({ sentimento: 'negativo', resolvido: true });
      const metricas = makeMetricas({ dias_ativos: 25, pecas_criadas: 100, uso_ai_total: 50, downloads: 30 });
      const result = calcularSegmentoCS(cliente, [thread], metricas, 1);
      // Não deve ser ALERTA pois bug está resolvido
      expect(result.segmento).toBe('CRESCIMENTO');
    });

    it('bug resolvido não conta (thread com status: fechado)', () => {
      const cliente = makeCliente();
      const thread = makeThread({ sentimento: 'negativo', status: 'fechado' });
      const metricas = makeMetricas({ dias_ativos: 25, pecas_criadas: 100, uso_ai_total: 50, downloads: 30 });
      const result = calcularSegmentoCS(cliente, [thread], metricas, 1);
      expect(result.segmento).toBe('CRESCIMENTO');
    });
  });

  // ============================================
  // RESGATE - Condições de métricas (quando 0 bugs)
  // ============================================

  describe('RESGATE (métricas)', () => {
    it('zero dias ativos => RESGATE', () => {
      const cliente = makeCliente();
      const metricas = { dias_ativos: 0, pecas_criadas: 0, downloads: 0, uso_ai_total: 0 };
      const result = calcularSegmentoCS(cliente, [], metricas, 1);
      expect(result.segmento).toBe('RESGATE');
      expect(result.motivo).toContain('Sem atividade');
    });
  });

  // ============================================
  // ALERTA - Sinais de atenção (quando 0 bugs)
  // ============================================

  describe('ALERTA (métricas)', () => {
    it('poucos dias ativos => ALERTA', () => {
      const cliente = makeCliente();
      const metricas = {
        dias_ativos: 2, // abaixo do threshold de alerta (3)
        pecas_criadas: 5,
        downloads: 2,
        uso_ai_total: 1,
      };
      const result = calcularSegmentoCS(cliente, [], metricas, 1);
      expect(result.segmento).toBe('ALERTA');
      expect(result.motivo).toContain('dias ativos');
    });

    it('dias ativos entre alerta e estável => ALERTA', () => {
      const cliente = makeCliente();
      const metricas = {
        dias_ativos: 5, // >= 3 (alerta) mas < 8 (estavel)
        pecas_criadas: 5,
        downloads: 2,
        uso_ai_total: 1,
      };
      const result = calcularSegmentoCS(cliente, [], metricas, 1);
      expect(result.segmento).toBe('ALERTA');
    });
  });

  // ============================================
  // ESTÁVEL - Cliente saudável (quando 0 bugs)
  // ============================================

  describe('ESTAVEL', () => {
    it('dias ativos >= 8 sem problemas => ESTAVEL', () => {
      const cliente = makeCliente();
      const metricas = {
        dias_ativos: 10,
        pecas_criadas: 8,
        uso_ai_total: 2,
        downloads: 3,
      };
      const result = calcularSegmentoCS(cliente, [], metricas, 1);
      expect(result.segmento).toBe('ESTAVEL');
      expect(result.motivo).toContain('dias ativos');
    });

    it('dias ativos >= 8 mas engajamento baixo => ESTAVEL (não CRESCIMENTO)', () => {
      const cliente = makeCliente();
      const metricas = {
        dias_ativos: 22, // >= 20 threshold crescimento
        pecas_criadas: 5, // engajamento baixo
        uso_ai_total: 2,
        downloads: 1,
        // Score = (5*2) + (2*1.5) + (1*1) = 10 + 3 + 1 = 14 (< 50)
      };
      const result = calcularSegmentoCS(cliente, [], metricas, 1);
      expect(result.segmento).toBe('ESTAVEL');
    });
  });

  // ============================================
  // CRESCIMENTO - Melhor classificação (quando 0 bugs)
  // ============================================

  describe('CRESCIMENTO', () => {
    it('dias ativos >= 20 + engajamento alto => CRESCIMENTO', () => {
      const cliente = makeCliente();
      const metricas = {
        dias_ativos: 25,
        pecas_criadas: 50,  // 50*2 = 100
        uso_ai_total: 20,   // 20*1.5 = 30
        downloads: 10,      // 10*1 = 10
        // Score = 140 >= 50
      };
      const result = calcularSegmentoCS(cliente, [], metricas, 1);
      expect(result.segmento).toBe('CRESCIMENTO');
      expect(result.motivo).toContain('dias ativos');
      expect(result.motivo).toContain('engajamento');
    });
  });

  // ============================================
  // SAZONALIDADE - Divisores aplicados
  // ============================================

  describe('SAZONALIDADE', () => {
    it('mês de baixa divide thresholds por 2', () => {
      const mesAtual = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][new Date().getMonth()];
      const cliente = makeCliente({
        calendario_campanhas: { [mesAtual]: 'baixa' },
      });
      // Com divisor 2: threshold estável = 8/2 = 4
      const metricas = {
        dias_ativos: 5, // >= 4 = ESTÁVEL
        pecas_criadas: 10,
        uso_ai_total: 5,
        downloads: 3,
      };
      const result = calcularSegmentoCS(cliente, [], metricas, 1);
      expect(result.segmento).toBe('ESTAVEL');
    });

    it('google_gratuito divide thresholds por 2', () => {
      const cliente = makeCliente({ tipo_conta: 'google_gratuito' });
      // Com divisor 2: threshold estável = 8/2 = 4
      const metricas = {
        dias_ativos: 5, // >= 4 = ESTÁVEL
        pecas_criadas: 10,
        uso_ai_total: 5,
        downloads: 3,
      };
      const result = calcularSegmentoCS(cliente, [], metricas, 1);
      expect(result.segmento).toBe('ESTAVEL');
    });
  });

  // ============================================
  // CONFIG CUSTOMIZADA
  // ============================================

  describe('config customizada', () => {
    it('usa thresholds customizados', () => {
      const cliente = makeCliente();
      const metricas = { dias_ativos: 5, pecas_criadas: 10, uso_ai_total: 5, downloads: 3 };

      // Com config padrão (dias_ativos_estavel = 8), seria ALERTA
      const resultDefault = calcularSegmentoCS(cliente, [], metricas, 1);
      expect(resultDefault.segmento).toBe('ALERTA');

      // Com config customizada (dias_ativos_estavel = 4), seria ESTÁVEL
      const config = { dias_ativos_estavel: 4 };
      const resultCustom = calcularSegmentoCS(cliente, [], metricas, 1, config);
      expect(resultCustom.segmento).toBe('ESTAVEL');
    });

    it('usa pesos de engajamento customizados', () => {
      const cliente = makeCliente();
      const metricas = { dias_ativos: 22, pecas_criadas: 10, uso_ai_total: 10, downloads: 5 };

      // Score padrão = (10*2) + (10*1.5) + (5*1) = 20 + 15 + 5 = 40 (< 50 = não CRESCIMENTO)
      const resultDefault = calcularSegmentoCS(cliente, [], metricas, 1);
      expect(resultDefault.segmento).toBe('ESTAVEL');

      // Com pesos maiores: (10*3) + (10*2) + (5*2) = 30 + 20 + 10 = 60 (>= 50 = CRESCIMENTO)
      const config = { peso_pecas: 3, peso_ia: 2, peso_downloads: 2 };
      const resultCustom = calcularSegmentoCS(cliente, [], metricas, 1, config);
      expect(resultCustom.segmento).toBe('CRESCIMENTO');
    });
  });

  // ============================================
  // FATORES RETORNADOS
  // ============================================

  describe('fatores retornados', () => {
    it('retorna todos os fatores esperados', () => {
      const cliente = makeCliente();
      const result = calcularSegmentoCS(cliente, [], makeMetricas(), 1);
      expect(result.fatores).toHaveProperty('dias_ativos');
      expect(result.fatores).toHaveProperty('engajamento_score');
      expect(result.fatores).toHaveProperty('reclamacoes_em_aberto');
      expect(result.fatores).toHaveProperty('qtd_reclamacoes');
      expect(result.fatores).toHaveProperty('tipo_conta');
      expect(result.fatores).toHaveProperty('sazonalidade');
      expect(result.fatores).toHaveProperty('thresholds');
    });
  });

  // ============================================
  // EDGE CASES
  // ============================================

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

    it('thread resolvida não conta como reclamação em aberto', () => {
      const cliente = makeCliente();
      const thread = makeThread({
        sentimento: 'negativo',
        resolvido: true,
      });
      const metricas = makeMetricas();
      const result = calcularSegmentoCS(cliente, [thread], metricas, 1);
      // Thread resolvida não deve contar como reclamação em aberto
      expect(result.fatores.reclamacoes_em_aberto).toBe(false);
      expect(result.fatores.qtd_reclamacoes).toBe(0);
    });

    it('thread com status fechado não conta como reclamação em aberto', () => {
      const cliente = makeCliente();
      const thread = makeThread({
        sentimento: 'urgente',
        status: 'fechado',
      });
      const metricas = makeMetricas();
      const result = calcularSegmentoCS(cliente, [thread], metricas, 1);
      expect(result.fatores.reclamacoes_em_aberto).toBe(false);
    });

    it('threads neutras não contam como bugs', () => {
      const cliente = makeCliente();
      const threads = [
        makeThread({ sentimento: 'neutro', categoria: 'duvida_pergunta' }),
        makeThread({ sentimento: 'positivo', categoria: 'feedback' }),
      ];
      const metricas = makeMetricas();
      const result = calcularSegmentoCS(cliente, threads, metricas, 1);
      expect(result.fatores.qtd_reclamacoes).toBe(0);
    });
  });
});
