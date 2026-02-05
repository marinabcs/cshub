import { describe, it, expect } from 'vitest';
import {
  CLIENTE_STATUS,
  STATUS_OPTIONS,
  DEFAULT_STATUS,
  DEFAULT_VISIBLE_STATUS,
  getStatusColor,
  getStatusLabel,
  getStatusDescription,
} from '../clienteStatus';

describe('Constantes de clienteStatus', () => {
  it('CLIENTE_STATUS tem 4 status', () => {
    expect(Object.keys(CLIENTE_STATUS)).toHaveLength(4);
    expect(CLIENTE_STATUS).toHaveProperty('ativo');
    expect(CLIENTE_STATUS).toHaveProperty('aviso_previo');
    expect(CLIENTE_STATUS).toHaveProperty('inativo');
    expect(CLIENTE_STATUS).toHaveProperty('cancelado');
  });

  it('STATUS_OPTIONS tem 4 opções ordenadas', () => {
    expect(STATUS_OPTIONS).toHaveLength(4);
    expect(STATUS_OPTIONS[0].value).toBe('ativo');
    expect(STATUS_OPTIONS[3].value).toBe('cancelado');
  });

  it('DEFAULT_STATUS é ativo', () => {
    expect(DEFAULT_STATUS).toBe('ativo');
  });

  it('DEFAULT_VISIBLE_STATUS exclui inativos e cancelados', () => {
    expect(DEFAULT_VISIBLE_STATUS).toEqual(['ativo', 'aviso_previo']);
  });
});

describe('getStatusColor', () => {
  it('retorna cor correta para cada status', () => {
    expect(getStatusColor('ativo')).toBe('#10b981');
    expect(getStatusColor('aviso_previo')).toBe('#f97316');
    expect(getStatusColor('inativo')).toBe('#6b7280');
    expect(getStatusColor('cancelado')).toBe('#ef4444');
  });

  it('retorna fallback cinza para status inválido', () => {
    expect(getStatusColor('xyz')).toBe('#6b7280');
  });
});

describe('getStatusLabel', () => {
  it('retorna label correto', () => {
    expect(getStatusLabel('ativo')).toBe('Ativo');
    expect(getStatusLabel('aviso_previo')).toBe('Em Aviso Prévio');
  });

  it('retorna Desconhecido para inválido', () => {
    expect(getStatusLabel('xyz')).toBe('Desconhecido');
  });
});

describe('getStatusDescription', () => {
  it('retorna descrição correta', () => {
    expect(getStatusDescription('ativo')).toBe('Cliente em operação normal');
    expect(getStatusDescription('cancelado')).toBe('Cliente cancelou contrato');
  });

  it('retorna string vazia para inválido', () => {
    expect(getStatusDescription('xyz')).toBe('');
  });
});
