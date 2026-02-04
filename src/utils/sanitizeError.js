const isDev = import.meta.env.DEV;

/**
 * Sanitiza erro para não expor detalhes internos de APIs em produção.
 * Em dev: retorna o erro completo para debugging.
 * Em produção: retorna apenas mensagem genérica e código.
 */
export function sanitizeError(error) {
  if (isDev) return error;
  return {
    message: error?.message || 'Erro interno',
    code: error?.status || error?.code || 'UNKNOWN'
  };
}
