/**
 * useRetention Hook
 * React hook for retention operations in the UI
 */

import { useState, useCallback } from 'react';
import {
  arquivarThread,
  desarquivarThread,
  softDeleteAlerta,
  restaurarAlerta,
  gerarRelatorioRetencao,
  executarRetencaoCompleta,
  ARCHIVE_REASONS,
  RETENTION_CONFIG,
} from '../services/retentionService';

/**
 * Hook for archiving/unarchiving threads
 * @param {Object} firestore - Firestore instance
 * @param {Object} auth - Firebase Auth instance
 * @returns {Object} - Hook state and methods
 */
export function useArquivarThread(firestore, auth) {
  const [isArchiving, setIsArchiving] = useState(false);
  const [error, setError] = useState(null);

  const arquivar = useCallback(
    async (clienteId, threadId, reason = ARCHIVE_REASONS.MANUAL) => {
      setIsArchiving(true);
      setError(null);

      try {
        const result = await arquivarThread(firestore, auth, clienteId, threadId, reason);

        if (!result.success) {
          setError(result.error);
        }

        return result;
      } catch (err) {
        setError(err.message);
        return { success: false, error: err.message };
      } finally {
        setIsArchiving(false);
      }
    },
    [firestore, auth]
  );

  const desarquivar = useCallback(
    async (clienteId, threadId) => {
      setIsArchiving(true);
      setError(null);

      try {
        const result = await desarquivarThread(firestore, auth, clienteId, threadId);

        if (!result.success) {
          setError(result.error);
        }

        return result;
      } catch (err) {
        setError(err.message);
        return { success: false, error: err.message };
      } finally {
        setIsArchiving(false);
      }
    },
    [firestore, auth]
  );

  return {
    isArchiving,
    error,
    arquivar,
    desarquivar,
    clearError: () => setError(null),
  };
}

/**
 * Hook for soft deleting/restoring alerts
 * @param {Object} firestore - Firestore instance
 * @param {Object} auth - Firebase Auth instance
 * @returns {Object} - Hook state and methods
 */
export function useSoftDeleteAlerta(firestore, auth) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);

  const deletar = useCallback(
    async (alertaId) => {
      setIsDeleting(true);
      setError(null);

      try {
        const result = await softDeleteAlerta(firestore, auth, alertaId);

        if (!result.success) {
          setError(result.error);
        }

        return result;
      } catch (err) {
        setError(err.message);
        return { success: false, error: err.message };
      } finally {
        setIsDeleting(false);
      }
    },
    [firestore, auth]
  );

  const restaurar = useCallback(
    async (alertaId) => {
      setIsDeleting(true);
      setError(null);

      try {
        const result = await restaurarAlerta(firestore, auth, alertaId);

        if (!result.success) {
          setError(result.error);
        }

        return result;
      } catch (err) {
        setError(err.message);
        return { success: false, error: err.message };
      } finally {
        setIsDeleting(false);
      }
    },
    [firestore, auth]
  );

  return {
    isDeleting,
    error,
    deletar,
    restaurar,
    clearError: () => setError(null),
  };
}

/**
 * Hook for retention report and execution (admin only)
 * @param {Object} firestore - Firestore instance
 * @param {Object} auth - Firebase Auth instance
 * @returns {Object} - Hook state and methods
 */
export function useRetentionAdmin(firestore, auth) {
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [report, setReport] = useState(null);
  const [executionResult, setExecutionResult] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState([]);

  const gerarRelatorio = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await gerarRelatorioRetencao(firestore);
      setReport(result);
      return result;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [firestore]);

  const executarRetencao = useCallback(
    async (dryRun = false) => {
      setIsExecuting(true);
      setError(null);
      setProgress([]);

      try {
        const result = await executarRetencaoCompleta(firestore, auth, {
          dryRun,
          onProgress: (msg) => {
            setProgress((prev) => [...prev, { timestamp: new Date(), message: msg }]);
          },
        });

        setExecutionResult(result);
        return result;
      } catch (err) {
        setError(err.message);
        return null;
      } finally {
        setIsExecuting(false);
      }
    },
    [firestore, auth]
  );

  return {
    // State
    isLoading,
    isExecuting,
    report,
    executionResult,
    error,
    progress,

    // Methods
    gerarRelatorio,
    executarRetencao,
    executarDryRun: () => executarRetencao(true),
    clearError: () => setError(null),
    clearReport: () => setReport(null),
    clearResult: () => setExecutionResult(null),

    // Config (for display)
    config: RETENTION_CONFIG,
    archiveReasons: ARCHIVE_REASONS,
  };
}

/**
 * Hook to filter out archived/deleted items from queries
 * Utility for list components
 */
export function useFilterRetained() {
  const filterThreads = useCallback((threads) => {
    if (!Array.isArray(threads)) return [];
    return threads.filter((t) => !t.archived);
  }, []);

  const filterAlertas = useCallback((alertas) => {
    if (!Array.isArray(alertas)) return [];
    return alertas.filter((a) => !a.deleted_at);
  }, []);

  const filterMensagens = useCallback((mensagens) => {
    if (!Array.isArray(mensagens)) return [];
    return mensagens.filter((m) => !m.archived);
  }, []);

  return {
    filterThreads,
    filterAlertas,
    filterMensagens,
  };
}

/**
 * Hook state for "Show archived" toggle
 */
export function useShowArchived(defaultValue = false) {
  const [showArchived, setShowArchived] = useState(defaultValue);

  const toggle = useCallback(() => {
    setShowArchived((prev) => !prev);
  }, []);

  const filterItems = useCallback(
    (items, archivedField = 'archived') => {
      if (!Array.isArray(items)) return [];
      if (showArchived) return items;
      return items.filter((item) => !item[archivedField]);
    },
    [showArchived]
  );

  return {
    showArchived,
    setShowArchived,
    toggle,
    filterItems,
  };
}

export default {
  useArquivarThread,
  useSoftDeleteAlerta,
  useRetentionAdmin,
  useFilterRetained,
  useShowArchived,
};
