/**
 * Utilitário de logging com níveis
 * Em produção, apenas erros são logados
 * Em desenvolvimento, todos os níveis são habilitados
 */

const isDev = import.meta.env.DEV;

export const logger = {
  // Debug - apenas em dev, para informações detalhadas
  debug: (...args) => {
    if (isDev) {
      console.log('[DEBUG]', ...args);
    }
  },

  // Info - apenas em dev, para informações gerais
  info: (...args) => {
    if (isDev) {
      console.info('[INFO]', ...args);
    }
  },

  // Warn - sempre logado, para avisos importantes
  warn: (...args) => {
    console.warn('[WARN]', ...args);
  },

  // Error - sempre logado, para erros
  error: (...args) => {
    console.error('[ERROR]', ...args);
  },

  // Table - apenas em dev, para visualização de dados
  table: (data) => {
    if (isDev && console.table) {
      console.table(data);
    }
  },

  // Group - apenas em dev, para agrupar logs relacionados
  group: (label) => {
    if (isDev && console.group) {
      console.group(label);
    }
  },

  groupEnd: () => {
    if (isDev && console.groupEnd) {
      console.groupEnd();
    }
  }
};

export default logger;
