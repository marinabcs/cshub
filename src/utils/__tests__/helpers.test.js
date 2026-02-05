import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatRelativeTime,
  getHealthColor,
  getHealthStatus,
  getStatusLabel,
  getTeamTypeLabel,
  getCategoriaLabel,
  getThreadStatusLabel,
  getSentimentEmoji,
  truncateText,
  getInitials,
} from '../helpers';

// ============================================
// FORMAT DATE
// ============================================

describe('formatDate', () => {
  it('formata data corretamente (dd/MM/yyyy)', () => {
    const date = new Date(2026, 0, 15); // 15 Jan 2026
    expect(formatDate(date)).toBe('15/01/2026');
  });

  it('retorna "-" para null/undefined', () => {
    expect(formatDate(null)).toBe('-');
    expect(formatDate(undefined)).toBe('-');
  });

  it('retorna "-" para data inválida', () => {
    expect(formatDate('invalido')).toBe('-');
  });

  it('aceita string ISO com hora (evita shift de timezone)', () => {
    expect(formatDate('2026-06-20T12:00:00')).toBe('20/06/2026');
  });
});

// ============================================
// FORMAT DATE TIME
// ============================================

describe('formatDateTime', () => {
  it('formata com hora', () => {
    const date = new Date(2026, 0, 15, 14, 30);
    expect(formatDateTime(date)).toContain('15/01/2026');
    expect(formatDateTime(date)).toContain('14:30');
  });

  it('retorna "-" para null', () => {
    expect(formatDateTime(null)).toBe('-');
  });
});

// ============================================
// FORMAT RELATIVE TIME
// ============================================

describe('formatRelativeTime', () => {
  it('retorna "-" para null', () => {
    expect(formatRelativeTime(null)).toBe('-');
  });

  it('retorna string com "há"', () => {
    const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = formatRelativeTime(ontem);
    expect(result).toContain('há');
  });
});

// ============================================
// HEALTH COLOR / STATUS
// ============================================

describe('getHealthColor', () => {
  it('score >= 80 = green', () => {
    expect(getHealthColor(80)).toBe('green');
    expect(getHealthColor(100)).toBe('green');
  });

  it('score 60-79 = yellow', () => {
    expect(getHealthColor(60)).toBe('yellow');
    expect(getHealthColor(79)).toBe('yellow');
  });

  it('score 40-59 = orange', () => {
    expect(getHealthColor(40)).toBe('orange');
    expect(getHealthColor(59)).toBe('orange');
  });

  it('score < 40 = red', () => {
    expect(getHealthColor(39)).toBe('red');
    expect(getHealthColor(0)).toBe('red');
  });
});

describe('getHealthStatus', () => {
  it('score >= 80 = saudavel', () => {
    expect(getHealthStatus(80)).toBe('saudavel');
  });

  it('score 60-79 = atencao', () => {
    expect(getHealthStatus(65)).toBe('atencao');
  });

  it('score 40-59 = risco', () => {
    expect(getHealthStatus(45)).toBe('risco');
  });

  it('score < 40 = critico', () => {
    expect(getHealthStatus(20)).toBe('critico');
  });
});

// ============================================
// LABEL FUNCTIONS
// ============================================

describe('getStatusLabel', () => {
  it('retorna label correto', () => {
    expect(getStatusLabel('saudavel')).toBe('Saudável');
    expect(getStatusLabel('critico')).toBe('Crítico');
  });

  it('retorna o próprio valor para desconhecido', () => {
    expect(getStatusLabel('xyz')).toBe('xyz');
  });
});

describe('getTeamTypeLabel', () => {
  it('retorna label correto', () => {
    expect(getTeamTypeLabel('Vendas B2B')).toBe('Vendas B2B');
    expect(getTeamTypeLabel('BR LCS')).toBe('BR LCS');
  });

  it('retorna o próprio valor para desconhecido', () => {
    expect(getTeamTypeLabel('custom')).toBe('custom');
  });
});

describe('getCategoriaLabel', () => {
  it('retorna label correto', () => {
    expect(getCategoriaLabel('erro_bug')).toBe('Erro/Bug');
    expect(getCategoriaLabel('feedback')).toBe('Feedback');
    expect(getCategoriaLabel('duvida_pergunta')).toBe('Dúvida');
  });

  it('retorna o próprio valor para desconhecido', () => {
    expect(getCategoriaLabel('custom')).toBe('custom');
  });
});

describe('getThreadStatusLabel', () => {
  it('retorna label correto', () => {
    expect(getThreadStatusLabel('ativo')).toBe('Ativo');
    expect(getThreadStatusLabel('resolvido')).toBe('Resolvido');
    expect(getThreadStatusLabel('aguardando_cliente')).toBe('Aguardando Cliente');
  });
});

describe('getSentimentEmoji', () => {
  it('retorna emoji correto', () => {
    expect(getSentimentEmoji('positivo')).toBe('😊');
    expect(getSentimentEmoji('neutro')).toBe('😐');
    expect(getSentimentEmoji('negativo')).toBe('😟');
    expect(getSentimentEmoji('urgente')).toBe('🚨');
  });

  it('retorna neutro como fallback', () => {
    expect(getSentimentEmoji('xyz')).toBe('😐');
  });
});

// ============================================
// TRUNCATE TEXT
// ============================================

describe('truncateText', () => {
  it('retorna texto inteiro se menor que maxLength', () => {
    expect(truncateText('hello', 100)).toBe('hello');
  });

  it('trunca com ... se maior que maxLength', () => {
    expect(truncateText('hello world', 5)).toBe('hello...');
  });

  it('retorna "" para null/undefined', () => {
    expect(truncateText(null)).toBe('');
    expect(truncateText(undefined)).toBe('');
  });

  it('usa maxLength default de 100', () => {
    const longText = 'a'.repeat(150);
    const result = truncateText(longText);
    expect(result).toHaveLength(103); // 100 + '...'
  });
});

// ============================================
// GET INITIALS
// ============================================

describe('getInitials', () => {
  it('retorna 2 iniciais para nome completo', () => {
    expect(getInitials('Marina Silva')).toBe('MS');
  });

  it('retorna 1 inicial para nome simples', () => {
    expect(getInitials('Marina')).toBe('M');
  });

  it('limita a 2 caracteres', () => {
    expect(getInitials('Ana Maria Silva')).toBe('AM');
  });

  it('converte para uppercase', () => {
    expect(getInitials('marina silva')).toBe('MS');
  });

  it('retorna "?" para null/undefined', () => {
    expect(getInitials(null)).toBe('?');
    expect(getInitials(undefined)).toBe('?');
  });
});
