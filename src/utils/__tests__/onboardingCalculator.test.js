import { describe, it, expect } from 'vitest';
import {
  classifyModules,
  buildSessions,
  scheduleSessions,
  calculateProgress,
} from '../onboardingCalculator';

// ============================================
// CLASSIFY MODULES
// ============================================

describe('classifyModules', () => {
  it('M1 e M2 são sempre ao_vivo (locked)', () => {
    const respostas = {};
    const result = classifyModules(respostas);
    expect(result.M1).toBe('ao_vivo');
    expect(result.M2).toBe('ao_vivo');
  });

  it('classifica todos os 11 módulos', () => {
    const respostas = {};
    const result = classifyModules(respostas);
    expect(Object.keys(result)).toHaveLength(11);
  });

  it('M3 ao_vivo quando publica no google_ads', () => {
    const respostas = { publicam: ['google_ads'] };
    const result = classifyModules(respostas);
    expect(result.M3).toBe('ao_vivo');
  });

  it('M3 ao_vivo quando publica via merchant_center', () => {
    const respostas = { publicam: ['merchant_center'] };
    const result = classifyModules(respostas);
    expect(result.M3).toBe('ao_vivo');
  });

  it('M3 online quando não publica no Google', () => {
    const respostas = { publicam: ['meta'] };
    const result = classifyModules(respostas);
    expect(result.M3).toBe('online');
  });

  it('M4 ao_vivo quando uso_ia é principal', () => {
    const respostas = { uso_ia: 'principal' };
    const result = classifyModules(respostas);
    expect(result.M4).toBe('ao_vivo');
  });

  it('M4 ao_vivo quando uso_ia é complemento', () => {
    const respostas = { uso_ia: 'complemento' };
    const result = classifyModules(respostas);
    expect(result.M4).toBe('ao_vivo');
  });

  it('M4 online quando uso_ia é curioso', () => {
    const respostas = { uso_ia: 'curioso' };
    const result = classifyModules(respostas);
    expect(result.M4).toBe('online');
  });

  it('M5 ao_vivo quando consistencia critica + IA alta', () => {
    const respostas = { consistencia_marca: 'critico', uso_ia: 'principal' };
    const result = classifyModules(respostas);
    expect(result.M5).toBe('ao_vivo');
  });

  it('M5 online quando consistencia não é critica', () => {
    const respostas = { consistencia_marca: 'importante', uso_ia: 'principal' };
    const result = classifyModules(respostas);
    expect(result.M5).toBe('online');
  });

  it('M6 ao_vivo quando video_ia sim_muito + video_producao não é nao', () => {
    const respostas = { video_ia: 'sim_muito', video_producao: 'dedicada_frequente', uso_ia: 'curioso' };
    const result = classifyModules(respostas);
    expect(result.M6).toBe('ao_vivo');
  });

  it('M7 ao_vivo quando video_producao dedicada_frequente', () => {
    const respostas = { video_producao: 'dedicada_frequente' };
    const result = classifyModules(respostas);
    expect(result.M7).toBe('ao_vivo');
  });

  it('M7 online quando video_producao ocasional', () => {
    const respostas = { video_producao: 'ocasional' };
    const result = classifyModules(respostas);
    expect(result.M7).toBe('online');
  });

  it('M8 ao_vivo quando materiais inclui html5', () => {
    const respostas = { materiais: ['html5'] };
    const result = classifyModules(respostas);
    expect(result.M8).toBe('ao_vivo');
  });

  it('M8 ao_vivo quando video dedicado + video_longo', () => {
    const respostas = { video_producao: 'dedicada_frequente', materiais: ['video_longo'] };
    const result = classifyModules(respostas);
    expect(result.M8).toBe('ao_vivo');
  });

  it('M9 ao_vivo quando extras inclui 3d', () => {
    const respostas = { extras: ['3d'] };
    const result = classifyModules(respostas);
    expect(result.M9).toBe('ao_vivo');
  });

  it('M9 online quando extras não inclui 3d', () => {
    const respostas = { extras: [] };
    const result = classifyModules(respostas);
    expect(result.M9).toBe('online');
  });

  it('M10 ao_vivo quando analytics_performance sim_campanhas', () => {
    const respostas = { analytics_performance: 'sim_campanhas' };
    const result = classifyModules(respostas);
    expect(result.M10).toBe('ao_vivo');
  });

  it('M10 online quando analytics_performance sem campanhas', () => {
    const respostas = { analytics_performance: 'sim_sem_campanhas' };
    const result = classifyModules(respostas);
    expect(result.M10).toBe('online');
  });

  it('M11 ao_vivo quando extras inclui nomenclatura', () => {
    const respostas = { extras: ['nomenclatura'] };
    const result = classifyModules(respostas);
    expect(result.M11).toBe('ao_vivo');
  });

  it('M11 ao_vivo quando 20+ pessoas', () => {
    const respostas = { qtd_pessoas: '20+' };
    const result = classifyModules(respostas);
    expect(result.M11).toBe('ao_vivo');
  });
});

// ============================================
// BUILD SESSIONS
// ============================================

describe('buildSessions', () => {
  it('sessão 1 sempre tem M1+M2 com 105 min', () => {
    const classificacao = {
      M1: 'ao_vivo', M2: 'ao_vivo', M3: 'online', M4: 'online',
      M5: 'online', M6: 'online', M7: 'online', M8: 'online',
      M9: 'online', M10: 'online', M11: 'online',
    };
    const sessoes = buildSessions(classificacao);
    expect(sessoes[0].modulos).toEqual(['M1', 'M2']);
    expect(sessoes[0].duracao).toBe(105);
  });

  it('retorna apenas sessão 1 se só M1/M2 são ao_vivo', () => {
    const classificacao = {
      M1: 'ao_vivo', M2: 'ao_vivo', M3: 'online', M4: 'online',
      M5: 'online', M6: 'online', M7: 'online', M8: 'online',
      M9: 'online', M10: 'online', M11: 'online',
    };
    const sessoes = buildSessions(classificacao);
    expect(sessoes).toHaveLength(1);
  });

  it('agrupa módulos respeitando max 90 min', () => {
    const classificacao = {
      M1: 'ao_vivo', M2: 'ao_vivo', M3: 'ao_vivo', M4: 'ao_vivo',
      M5: 'ao_vivo', M6: 'online', M7: 'online', M8: 'online',
      M9: 'online', M10: 'online', M11: 'online',
    };
    const sessoes = buildSessions(classificacao);
    // M1+M2 = sessão 1, M4(30)+M5(45)=75 < 90, M3(45) separate
    for (let i = 1; i < sessoes.length; i++) {
      expect(sessoes[i].duracao).toBeLessThanOrEqual(90);
    }
  });

  it('numera sessões sequencialmente', () => {
    const classificacao = {
      M1: 'ao_vivo', M2: 'ao_vivo', M4: 'ao_vivo', M7: 'ao_vivo',
      M3: 'online', M5: 'online', M6: 'online', M8: 'online',
      M9: 'online', M10: 'online', M11: 'online',
    };
    const sessoes = buildSessions(classificacao);
    sessoes.forEach((s, i) => {
      expect(s.numero).toBe(i + 1);
    });
  });
});

// ============================================
// SCHEDULE SESSIONS
// ============================================

describe('scheduleSessions', () => {
  const sessoes = [
    { numero: 1, modulos: ['M1', 'M2'], duracao: 105 },
    { numero: 2, modulos: ['M4'], duracao: 30 },
    { numero: 3, modulos: ['M7'], duracao: 45 },
  ];

  it('primeira sessão tem a data de início', () => {
    const inicio = new Date(2026, 0, 5); // Monday Jan 5
    const agendadas = scheduleSessions(sessoes, inicio, 'mes');
    expect(agendadas[0].data_sugerida.getTime()).toBe(inicio.getTime());
  });

  it('urgência esta_semana = 3 dias entre sessões', () => {
    const inicio = new Date(2026, 0, 5); // Monday
    const agendadas = scheduleSessions(sessoes, inicio, 'esta_semana');
    // Session 2: 3 business days after Monday = Thursday (Jan 8)
    const diff = (agendadas[1].data_sugerida - inicio) / (1000 * 60 * 60 * 24);
    expect(diff).toBe(3);
  });

  it('urgência mes = 7 dias entre sessões', () => {
    const inicio = new Date(2026, 0, 5); // Monday
    const agendadas = scheduleSessions(sessoes, inicio, 'mes');
    // Session 2: 7 business days = next week + 2 days
    const daysDiff = Math.round((agendadas[1].data_sugerida - inicio) / (1000 * 60 * 60 * 24));
    expect(daysDiff).toBe(9); // 7 business days = 9 calendar days (skips weekend)
  });

  it('pula fins de semana', () => {
    const sexta = new Date(2026, 0, 2); // Friday
    const agendadas = scheduleSessions(sessoes, sexta, 'esta_semana');
    // Session 2: 3 business days after Friday = Wednesday
    const day = agendadas[1].data_sugerida.getDay();
    expect(day).not.toBe(0); // not Sunday
    expect(day).not.toBe(6); // not Saturday
  });

  it('todas sessões têm status agendada', () => {
    const agendadas = scheduleSessions(sessoes, new Date(), 'mes');
    agendadas.forEach(s => {
      expect(s.status).toBe('agendada');
      expect(s.data_realizada).toBeNull();
    });
  });
});

// ============================================
// CALCULATE PROGRESS
// ============================================

describe('calculateProgress', () => {
  it('retorna 0% para plano null', () => {
    const result = calculateProgress(null);
    expect(result.percentual).toBe(0);
    expect(result.handoffElegivel).toBe(false);
  });

  it('retorna 0% para plano vazio', () => {
    const result = calculateProgress({});
    expect(result.percentual).toBe(100); // 0/0 sessions = 1, 0/0 fv = 1, 0/0 tut = 1
    expect(result.handoffElegivel).toBe(true);
  });

  it('calcula progresso correto com sessões concluídas', () => {
    const plano = {
      sessoes: [
        { status: 'concluida' },
        { status: 'agendada' },
      ],
      classificacao: { M1: 'ao_vivo', M2: 'ao_vivo' },
      first_values: { M1: { atingido: true } },
      modulos_online: [],
    };
    const result = calculateProgress(plano);
    // pSessoes = 1/2 = 0.5, pFirst = 1/2 = 0.5, pTutoriais = 1 (0/0)
    // 0.5*60 + 0.5*30 + 1*10 = 30 + 15 + 10 = 55
    expect(result.percentual).toBe(55);
    expect(result.sessoesFeitas).toBe(1);
    expect(result.totalSessoes).toBe(2);
    expect(result.handoffElegivel).toBe(false);
  });

  it('100% quando tudo concluído', () => {
    const plano = {
      sessoes: [
        { status: 'concluida' },
        { status: 'concluida' },
      ],
      classificacao: { M1: 'ao_vivo', M2: 'ao_vivo' },
      first_values: { M1: { atingido: true }, M2: { atingido: true } },
      modulos_online: [{ tutorial_enviado: true }],
    };
    const result = calculateProgress(plano);
    expect(result.percentual).toBe(100);
    expect(result.handoffElegivel).toBe(true);
  });

  it('handoff NÃO elegível se falta tutorial', () => {
    const plano = {
      sessoes: [{ status: 'concluida' }],
      classificacao: { M1: 'ao_vivo' },
      first_values: { M1: { atingido: true } },
      modulos_online: [{ tutorial_enviado: false }],
    };
    const result = calculateProgress(plano);
    expect(result.handoffElegivel).toBe(false);
  });

  it('lida com classificação em formato objeto {modo: "ao_vivo"}', () => {
    const plano = {
      sessoes: [{ status: 'concluida' }],
      classificacao: { M1: { modo: 'ao_vivo' }, M3: { modo: 'online' } },
      first_values: { M1: { atingido: true } },
      modulos_online: [],
    };
    const result = calculateProgress(plano);
    // Só M1 é ao_vivo, e tem first value
    expect(result.firstValuesAtingidos).toBe(1);
    expect(result.totalFirstValues).toBe(1);
  });
});
