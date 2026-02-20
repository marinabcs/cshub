import { describe, it, expect } from 'vitest';
import {
  isThreadFiltered,
  applyFiltersToThreads,
  getFilterStats,
  DEFAULT_EMAIL_FILTERS,
} from '../emailFilters';

// ============================================
// DEFAULT CONFIG
// ============================================

describe('DEFAULT_EMAIL_FILTERS', () => {
  it('tem filtros ativados por padrão', () => {
    expect(DEFAULT_EMAIL_FILTERS.filtro_ativo).toBe(true);
  });

  it('tem lista de domínios bloqueados', () => {
    expect(DEFAULT_EMAIL_FILTERS.dominios_bloqueados.length).toBeGreaterThan(0);
    expect(DEFAULT_EMAIL_FILTERS.dominios_bloqueados).toContain('noreply');
  });

  it('tem lista de domínios completos bloqueados', () => {
    expect(DEFAULT_EMAIL_FILTERS.dominios_completos_bloqueados).toContain('mailchimp.com');
  });

  it('tem palavras-chave de assunto', () => {
    expect(DEFAULT_EMAIL_FILTERS.palavras_chave_assunto).toContain('newsletter');
  });

  it('tem lista de domínios permitidos com trakto.io', () => {
    expect(DEFAULT_EMAIL_FILTERS.dominios_remetente_permitidos).toContain('trakto.io');
  });
});

// ============================================
// IS THREAD FILTERED
// ============================================

describe('isThreadFiltered', () => {
  const config = DEFAULT_EMAIL_FILTERS;

  it('retorna not filtered para thread null', () => {
    const result = isThreadFiltered(null, config);
    expect(result.filtered).toBe(false);
  });

  it('filtra thread marcada manualmente', () => {
    const thread = { filtrado_manual: true };
    const result = isThreadFiltered(thread, config);
    expect(result.filtered).toBe(true);
    expect(result.reason).toBe('manual');
  });

  it('não filtra se config desativada', () => {
    const thread = { remetente_email: 'noreply@company.com' };
    const result = isThreadFiltered(thread, { filtro_ativo: false });
    expect(result.filtered).toBe(false);
  });

  it('não filtra se config é null', () => {
    const thread = { remetente_email: 'noreply@company.com' };
    const result = isThreadFiltered(thread, null);
    expect(result.filtered).toBe(false);
  });

  // Prefixos de email bloqueados
  it('filtra emails noreply@', () => {
    const thread = { remetente_email: 'noreply@company.com' };
    const result = isThreadFiltered(thread, config);
    expect(result.filtered).toBe(true);
    expect(result.reason).toContain('noreply');
  });

  it('filtra emails newsletter@', () => {
    const thread = { remetente_email: 'newsletter@example.com' };
    const result = isThreadFiltered(thread, config);
    expect(result.filtered).toBe(true);
  });

  it('filtra emails marketing@', () => {
    const thread = { sender_email: 'marketing@example.com' };
    const result = isThreadFiltered(thread, config);
    expect(result.filtered).toBe(true);
  });

  // Domínios completos bloqueados
  it('filtra domínio mailchimp.com', () => {
    const thread = { remetente_email: 'user@mailchimp.com' };
    const result = isThreadFiltered(thread, config);
    expect(result.filtered).toBe(true);
    expect(result.reason).toContain('mailchimp.com');
  });

  it('filtra subdomínio de domínio bloqueado', () => {
    const thread = { remetente_email: 'user@sub.sendgrid.net' };
    const result = isThreadFiltered(thread, config);
    expect(result.filtered).toBe(true);
  });

  // Palavras-chave no assunto
  it('filtra assunto com "newsletter"', () => {
    const thread = { remetente_email: 'normal@example.com', assunto: 'Our Weekly Newsletter' };
    const result = isThreadFiltered(thread, config);
    expect(result.filtered).toBe(true);
    expect(result.reason).toContain('newsletter');
  });

  it('filtra assunto com "unsubscribe"', () => {
    const thread = { assunto: 'Click to unsubscribe from this list' };
    const result = isThreadFiltered(thread, config);
    expect(result.filtered).toBe(true);
  });

  it('filtra assunto com "out of office" (case insensitive)', () => {
    const thread = { assunto: 'Out of Office: I am on vacation' };
    const result = isThreadFiltered(thread, config);
    expect(result.filtered).toBe(true);
  });

  // Auto-reply detection
  it('detecta auto-reply no assunto', () => {
    // Usar assunto que bate nos regex mas NÃO nas keywords
    const thread = { assunto: 'Auto: Estou ausente' };
    const result = isThreadFiltered(thread, config);
    expect(result.filtered).toBe(true);
    expect(result.reason).toBe('auto-reply detectado');
  });

  it('detecta auto-reply em português', () => {
    const thread = { assunto: 'Resposta automática: Estou de férias' };
    const result = isThreadFiltered(thread, config);
    expect(result.filtered).toBe(true);
  });

  it('detecta [auto-reply] tag', () => {
    const thread = { assunto: '[Auto-Reply] Estou fora' };
    const result = isThreadFiltered(thread, config);
    expect(result.filtered).toBe(true);
  });

  // Bulk email detection
  it('detecta email em massa (1 msg + noreply)', () => {
    const thread = { remetente_email: 'noreply@company.com', total_mensagens: 1 };
    const result = isThreadFiltered(thread, config);
    expect(result.filtered).toBe(true);
  });

  it('NÃO detecta bulk se tem múltiplas mensagens e remetente normal', () => {
    // Com múltiplas mensagens e remetente que não bate em nenhum filtro
    const thread = { remetente_email: 'joao@empresa.com', assunto: 'Projeto', total_mensagens: 5 };
    const result = isThreadFiltered(thread, config);
    expect(result.filtered).toBe(false);
  });

  // Emails normais NÃO devem ser filtrados
  it('NÃO filtra email normal', () => {
    const thread = {
      remetente_email: 'joao@empresa.com',
      assunto: 'Sobre nosso projeto',
      total_mensagens: 3,
    };
    const result = isThreadFiltered(thread, config);
    expect(result.filtered).toBe(false);
  });

  // Campos alternativos de email
  it('funciona com campo from', () => {
    const thread = { from: 'noreply@company.com' };
    const result = isThreadFiltered(thread, config);
    expect(result.filtered).toBe(true);
  });

  it('funciona com campo email_remetente', () => {
    const thread = { email_remetente: 'newsletter@company.com' };
    const result = isThreadFiltered(thread, config);
    expect(result.filtered).toBe(true);
  });
});

// ============================================
// APPLY FILTERS TO THREADS
// ============================================

describe('applyFiltersToThreads', () => {
  it('anota threads com _isFiltered e _filterReason', () => {
    const threads = [
      { id: 't1', remetente_email: 'noreply@company.com' },
      { id: 't2', remetente_email: 'joao@empresa.com', assunto: 'Normal' },
    ];
    const result = applyFiltersToThreads(threads, DEFAULT_EMAIL_FILTERS);
    expect(result).toHaveLength(2);
    expect(result[0]._isFiltered).toBe(true);
    expect(result[1]._isFiltered).toBe(false);
  });

  it('retorna array vazio para null', () => {
    expect(applyFiltersToThreads(null, DEFAULT_EMAIL_FILTERS)).toEqual([]);
  });

  it('retorna array vazio para não-array', () => {
    expect(applyFiltersToThreads('string', DEFAULT_EMAIL_FILTERS)).toEqual([]);
  });
});

// ============================================
// GET FILTER STATS
// ============================================

describe('getFilterStats', () => {
  it('calcula estatísticas corretas', () => {
    const threads = [
      { id: 't1', remetente_email: 'noreply@company.com' },
      { id: 't2', remetente_email: 'joao@empresa.com', assunto: 'Normal', total_mensagens: 3 },
      { id: 't3', remetente_email: 'news@mail.com' },
    ];
    const stats = getFilterStats(threads, DEFAULT_EMAIL_FILTERS);
    expect(stats.total).toBe(3);
    expect(stats.filtered).toBe(2); // noreply + news
    expect(stats.visible).toBe(1);
  });

  it('usa anotações existentes se disponíveis', () => {
    const threads = [
      { _isFiltered: true },
      { _isFiltered: false },
      { _isFiltered: true },
    ];
    const stats = getFilterStats(threads, DEFAULT_EMAIL_FILTERS);
    expect(stats.filtered).toBe(2);
    expect(stats.visible).toBe(1);
  });

  it('retorna zeros para null', () => {
    expect(getFilterStats(null, DEFAULT_EMAIL_FILTERS)).toEqual({ total: 0, filtered: 0, visible: 0 });
  });
});
