import { describe, it, expect } from 'vitest';

// sanitizeError usa import.meta.env.DEV que é controlado pelo Vitest
// Em test environment, DEV será true por padrão

describe('sanitizeError', () => {
  it('em dev retorna o erro completo', async () => {
    // Vitest roda como DEV por padrão
    const { sanitizeError } = await import('../sanitizeError');
    const error = { message: 'Detalhe sensível', code: 'INTERNAL', stack: 'stack trace' };
    const result = sanitizeError(error);
    // Em modo dev, retorna o erro original
    expect(result).toBe(error);
  });
});
