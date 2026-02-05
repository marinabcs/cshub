import { describe, it, expect } from 'vitest';
import {
  calculateChanges,
  getActionLabel,
  getEntityLabel,
  getActionColor,
  formatValue,
} from '../audit';

// ============================================
// CALCULATE CHANGES
// ============================================

describe('calculateChanges', () => {
  it('detecta campo alterado', () => {
    const old = { nome: 'Antigo' };
    const newObj = { nome: 'Novo' };
    const changes = calculateChanges(old, newObj);
    expect(changes.nome).toEqual({ old: 'Antigo', new: 'Novo' });
  });

  it('não inclui campos iguais', () => {
    const old = { nome: 'Mesmo', email: 'a@b.com' };
    const newObj = { nome: 'Mesmo', email: 'a@b.com' };
    const changes = calculateChanges(old, newObj);
    expect(Object.keys(changes)).toHaveLength(0);
  });

  it('pula campos internos (_prefixo)', () => {
    const old = { _id: '1', nome: 'A' };
    const newObj = { _id: '2', nome: 'A' };
    const changes = calculateChanges(old, newObj);
    expect(changes).not.toHaveProperty('_id');
  });

  it('pula updated_at e created_at', () => {
    const old = { updated_at: 'old', created_at: 'old' };
    const newObj = { updated_at: 'new', created_at: 'new' };
    const changes = calculateChanges(old, newObj);
    expect(Object.keys(changes)).toHaveLength(0);
  });

  it('detecta campo novo', () => {
    const changes = calculateChanges({}, { nome: 'Novo' });
    expect(changes.nome).toEqual({ old: null, new: 'Novo' });
  });

  it('detecta campo removido', () => {
    const changes = calculateChanges({ nome: 'Antigo' }, {});
    expect(changes.nome).toEqual({ old: 'Antigo', new: null });
  });

  it('compara arrays corretamente', () => {
    const old = { tags: ['a', 'b'] };
    const newObj = { tags: ['a', 'c'] };
    const changes = calculateChanges(old, newObj);
    expect(changes.tags).toBeDefined();
  });

  it('filtra por fieldsToTrack', () => {
    const old = { nome: 'A', email: 'a@b.com' };
    const newObj = { nome: 'B', email: 'c@d.com' };
    const changes = calculateChanges(old, newObj, ['nome']);
    expect(changes).toHaveProperty('nome');
    expect(changes).not.toHaveProperty('email');
  });

  it('funciona com objetos vazios', () => {
    const changes = calculateChanges({}, {});
    expect(Object.keys(changes)).toHaveLength(0);
  });

  it('funciona com null/undefined defaults', () => {
    const changes = calculateChanges(undefined, undefined);
    expect(Object.keys(changes)).toHaveLength(0);
  });
});

// ============================================
// LABELS E CORES
// ============================================

describe('getActionLabel', () => {
  it('retorna labels corretos', () => {
    expect(getActionLabel('create')).toBe('Criou');
    expect(getActionLabel('update')).toBe('Atualizou');
    expect(getActionLabel('delete')).toBe('Excluiu');
  });

  it('retorna o próprio valor para desconhecido', () => {
    expect(getActionLabel('xyz')).toBe('xyz');
  });
});

describe('getEntityLabel', () => {
  it('retorna labels corretos', () => {
    expect(getEntityLabel('cliente')).toBe('Cliente');
    expect(getEntityLabel('thread')).toBe('Conversa');
    expect(getEntityLabel('usuario_sistema')).toBe('Usuário do Sistema');
    expect(getEntityLabel('config')).toBe('Configuração');
    expect(getEntityLabel('stakeholder')).toBe('Stakeholder');
    expect(getEntityLabel('reuniao')).toBe('Reunião');
  });

  it('retorna o próprio valor para desconhecido', () => {
    expect(getEntityLabel('xyz')).toBe('xyz');
  });
});

describe('getActionColor', () => {
  it('retorna cores corretas', () => {
    expect(getActionColor('create')).toBe('#10b981');
    expect(getActionColor('update')).toBe('#8b5cf6');
    expect(getActionColor('delete')).toBe('#ef4444');
  });

  it('retorna cinza para desconhecido', () => {
    expect(getActionColor('xyz')).toBe('#64748b');
  });
});

// ============================================
// FORMAT VALUE
// ============================================

describe('formatValue', () => {
  it('null/undefined retorna "-"', () => {
    expect(formatValue(null)).toBe('-');
    expect(formatValue(undefined)).toBe('-');
  });

  it('array vazio retorna "(vazio)"', () => {
    expect(formatValue([])).toBe('(vazio)');
  });

  it('array de strings retorna join com vírgula', () => {
    expect(formatValue(['a', 'b', 'c'])).toBe('a, b, c');
  });

  it('array de objetos retorna JSON', () => {
    const result = formatValue([{ a: 1 }]);
    expect(result).toContain('"a":1');
  });

  it('objeto retorna JSON', () => {
    const result = formatValue({ key: 'val' });
    expect(result).toContain('"key"');
  });

  it('boolean true retorna "Sim"', () => {
    expect(formatValue(true)).toBe('Sim');
  });

  it('boolean false retorna "Não"', () => {
    expect(formatValue(false)).toBe('Não');
  });

  it('número retorna string', () => {
    expect(formatValue(42)).toBe('42');
  });

  it('string retorna string', () => {
    expect(formatValue('hello')).toBe('hello');
  });
});
