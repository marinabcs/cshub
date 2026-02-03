import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { DEFAULT_EMAIL_FILTERS } from '../utils/emailFilters';

/**
 * Hook para carregar e salvar configuração de filtros de email
 * Armazena em Firestore: config/email_filters
 */
export function useEmailFilters() {
  const [filterConfig, setFilterConfig] = useState(DEFAULT_EMAIL_FILTERS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const configRef = doc(db, 'config', 'email_filters');
        const snap = await getDoc(configRef);
        if (snap.exists()) {
          setFilterConfig((prev) => ({ ...prev, ...snap.data() }));
        }
      } catch (error) {
        // Em caso de erro, mantém config padrão
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const saveFilterConfig = useCallback(async (newConfig) => {
    const configRef = doc(db, 'config', 'email_filters');
    const dataToSave = {
      ...newConfig,
      updated_at: Timestamp.now(),
    };
    await setDoc(configRef, dataToSave);
    setFilterConfig(newConfig);
  }, []);

  return { filterConfig, loading, saveFilterConfig };
}
