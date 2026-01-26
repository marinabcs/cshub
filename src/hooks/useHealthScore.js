import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, Timestamp, query, where, collectionGroup } from 'firebase/firestore';
import { db } from '../services/firebase';
import { calcularHealthScore, formatHealthHistoryDate } from '../utils/healthScore';

/**
 * Hook to manage health score for a team/client
 * Fetches threads, calculates score, and saves to Firestore
 */
export function useHealthScore(clienteId) {
  const [healthData, setHealthData] = useState(null);
  const [healthHistory, setHealthHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Fetch threads from all linked teams
   */
  const fetchThreads = useCallback(async (teamIds) => {
    const allThreads = [];

    for (const teamId of teamIds) {
      try {
        const threadsRef = collection(db, 'times', teamId, 'threads');
        const snapshot = await getDocs(threadsRef);
        const threads = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          _teamId: teamId
        }));
        allThreads.push(...threads);
      } catch (err) {
        console.error(`Error fetching threads for team ${teamId}:`, err);
      }
    }

    return allThreads;
  }, []);

  /**
   * Fetch health history for display in charts
   */
  const fetchHealthHistory = useCallback(async () => {
    if (!clienteId) return [];

    try {
      const historyRef = collection(db, 'clientes', clienteId, 'health_history');
      const snapshot = await getDocs(historyRef);
      const history = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          date: data.hist_date,
          score: data.hist_score,
          status: data.hist_status,
          componentes: data.hist_componentes
        };
      });

      // Sort by date ascending
      history.sort((a, b) => a.date.localeCompare(b.date));

      return history;
    } catch (err) {
      console.error('Error fetching health history:', err);
      return [];
    }
  }, [clienteId]);

  /**
   * Fetch usage data from times/{teamId}/usuarios/{userId}/historico
   * Returns aggregated usage for last 30 days and total user count
   * Usa collectionGroup para buscar todos os historico e filtra pelo path do team
   */
  const fetchUsageData = useCallback(async (teamIds) => {
    if (!teamIds || teamIds.length === 0) {
      return { usageData: null, totalUsers: 0 };
    }

    try {
      // Calculate date 30 days ago (format: YYYY-MM-DD)
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      const formatDate = (d) => d.toISOString().split('T')[0];
      const minDate = formatDate(thirtyDaysAgo);

      // DEBUG: Log hook fetch start
      console.log('[useHealthScore] === fetchUsageData (collectionGroup) ===');
      console.log('[useHealthScore] Cliente ID:', clienteId);
      console.log('[useHealthScore] Team IDs:', teamIds);
      console.log('[useHealthScore] Data mínima:', minDate);

      // Usar collectionGroup para buscar TODOS os documentos historico
      const historicoGroupRef = collectionGroup(db, 'historico');
      const historicoSnap = await getDocs(historicoGroupRef);

      console.log(`[useHealthScore] Total de documentos historico encontrados: ${historicoSnap.docs.length}`);

      // Filtrar apenas os documentos que pertencem aos times do cliente
      const allHistorico = [];
      const userIds = new Set();

      historicoSnap.docs.forEach(docSnap => {
        const pathParts = docSnap.ref.path.split('/');
        // Path: times/teamId/usuarios/userId/historico/date
        if (pathParts[0] === 'times' && teamIds.includes(pathParts[1])) {
          const userId = pathParts[3];
          const dateId = docSnap.id;

          userIds.add(userId);

          // Filtrar por data (últimos 30 dias)
          if (dateId >= minDate) {
            allHistorico.push({ id: dateId, ...docSnap.data() });
          }
        }
      });

      const totalUsers = userIds.size;

      // Aggregate usage data from all daily records
      const usageData = allHistorico.reduce((acc, h) => {
        return {
          logins: acc.logins + (h.logins || 0),
          pecas_criadas: acc.pecas_criadas + (h.pecas_criadas || 0),
          downloads: acc.downloads + (h.downloads || 0),
          uso_ai_total: acc.uso_ai_total + (h.uso_ai_total || 0)
        };
      }, { logins: 0, pecas_criadas: 0, downloads: 0, uso_ai_total: 0 });

      // DEBUG: Log aggregated results
      console.log('[useHealthScore] Total usuários únicos:', totalUsers);
      console.log('[useHealthScore] Total registros filtrados:', allHistorico.length);
      console.log('[useHealthScore] Agregado:', usageData);
      console.log('[useHealthScore] ========================');

      return { usageData, totalUsers };
    } catch (err) {
      console.error('Error fetching usage data:', err);
      return { usageData: null, totalUsers: 0 };
    }
  }, [clienteId]);

  /**
   * Calculate and save health score
   */
  const calcularESalvar = useCallback(async () => {
    if (!clienteId) return null;

    setCalculating(true);
    setError(null);

    try {
      // Fetch client document to get linked teams
      const clienteRef = doc(db, 'clientes', clienteId);
      const clienteSnap = await getDoc(clienteRef);

      if (!clienteSnap.exists()) {
        throw new Error('Cliente não encontrado');
      }

      const clienteData = clienteSnap.data();

      // Skip calculation for inactive clients
      if (clienteData.status === 'inativo') {
        setCalculating(false);
        return {
          score: null,
          status: 'inativo',
          skipped: true,
          message: 'Cliente inativo - cálculo não realizado'
        };
      }

      const teamIds = clienteData.times || [];

      // Fetch threads from all linked teams
      const threads = await fetchThreads(teamIds);

      // Fetch usage data from times/{teamId}/usuarios/{userId}/historico
      const { usageData, totalUsers } = await fetchUsageData(teamIds);

      // Calculate health score (now includes usage data)
      const result = calcularHealthScore(threads, usageData, totalUsers);

      // Save to client document
      await updateDoc(clienteRef, {
        health_score: result.score,
        health_status: result.status,
        health_updated_at: Timestamp.now()
      });

      // Save to health history (one entry per day)
      const today = formatHealthHistoryDate();
      const historyRef = doc(db, 'clientes', clienteId, 'health_history', today);
      await setDoc(historyRef, {
        hist_date: today,
        hist_score: result.score,
        hist_status: result.status,
        hist_componentes: result.componentes,
        created_at: Timestamp.now()
      });

      // Update local state
      setHealthData({
        score: result.score,
        status: result.status,
        componentes: result.componentes,
        updatedAt: new Date()
      });

      // Refresh history
      const updatedHistory = await fetchHealthHistory();
      setHealthHistory(updatedHistory);

      return result;
    } catch (err) {
      console.error('Error calculating health score:', err);
      setError(err.message);
      return null;
    } finally {
      setCalculating(false);
    }
  }, [clienteId, fetchThreads, fetchHealthHistory, fetchUsageData]);

  /**
   * Load existing health data on mount
   */
  useEffect(() => {
    const loadHealthData = async () => {
      if (!clienteId) {
        setLoading(false);
        return;
      }

      try {
        // Fetch client document for current health score
        const clienteRef = doc(db, 'clientes', clienteId);
        const clienteSnap = await getDoc(clienteRef);

        if (clienteSnap.exists()) {
          const data = clienteSnap.data();
          setHealthData({
            score: data.health_score || 0,
            status: data.health_status || 'atencao',
            componentes: null, // Will be filled on recalculation
            updatedAt: data.health_updated_at?.toDate?.() || null
          });
        }

        // Fetch history
        const history = await fetchHealthHistory();
        setHealthHistory(history);
      } catch (err) {
        console.error('Error loading health data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadHealthData();
  }, [clienteId, fetchHealthHistory]);

  return {
    healthData,
    healthHistory,
    loading,
    calculating,
    error,
    calcularESalvar,
    refetch: () => {
      setLoading(true);
      calcularESalvar().finally(() => setLoading(false));
    }
  };
}

/**
 * Hook to calculate health scores for all clients
 * Useful for batch operations
 */
export function useCalcularTodosHealthScores() {
  const [calculating, setCalculating] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);

  const calcularTodos = useCallback(async () => {
    setCalculating(true);
    setError(null);
    const calculationResults = [];

    try {
      // Fetch all clients
      const clientesRef = collection(db, 'clientes');
      const clientesSnap = await getDocs(clientesRef);

      for (const clienteDoc of clientesSnap.docs) {
        const clienteData = clienteDoc.data();
        const clienteId = clienteDoc.id;
        const teamIds = clienteData.times || [];

        // Skip inactive clients - don't calculate metrics for them
        if (clienteData.status === 'inativo') {
          calculationResults.push({
            clienteId,
            nome: clienteData.team_name || clienteData.nome,
            score: null,
            status: 'inativo',
            success: true,
            skipped: true,
            message: 'Cliente inativo - cálculo pulado'
          });
          continue;
        }

        try {
          // Fetch threads for all teams
          const allThreads = [];
          for (const teamId of teamIds) {
            const threadsRef = collection(db, 'times', teamId, 'threads');
            const threadsSnap = await getDocs(threadsRef);
            allThreads.push(...threadsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
          }

          // Fetch usage data using collectionGroup para buscar todos os historico
          const currentDate = new Date();
          const thirtyDaysAgo = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000);
          const minDate = thirtyDaysAgo.toISOString().split('T')[0];

          // Usar collectionGroup para buscar TODOS os documentos historico
          const historicoGroupRef = collectionGroup(db, 'historico');
          const historicoSnap = await getDocs(historicoGroupRef);

          // Filtrar apenas os documentos que pertencem aos times do cliente
          const allHistorico = [];
          const userIds = new Set();

          historicoSnap.docs.forEach(docSnap => {
            const pathParts = docSnap.ref.path.split('/');
            // Path: times/teamId/usuarios/userId/historico/date
            if (pathParts[0] === 'times' && teamIds.includes(pathParts[1])) {
              const userId = pathParts[3];
              const dateId = docSnap.id;

              userIds.add(userId);

              if (dateId >= minDate) {
                allHistorico.push({ id: dateId, ...docSnap.data() });
              }
            }
          });

          const totalUsers = userIds.size;

          const usageData = allHistorico.reduce((acc, h) => ({
            logins: acc.logins + (h.logins || 0),
            pecas_criadas: acc.pecas_criadas + (h.pecas_criadas || 0),
            downloads: acc.downloads + (h.downloads || 0),
            uso_ai_total: acc.uso_ai_total + (h.uso_ai_total || 0)
          }), { logins: 0, pecas_criadas: 0, downloads: 0, uso_ai_total: 0 });

          // Calculate score with usage data
          const result = calcularHealthScore(allThreads, usageData, totalUsers);

          // Save to client
          await updateDoc(doc(db, 'clientes', clienteId), {
            health_score: result.score,
            health_status: result.status,
            health_updated_at: Timestamp.now()
          });

          // Save history
          const today = formatHealthHistoryDate();
          await setDoc(doc(db, 'clientes', clienteId, 'health_history', today), {
            hist_date: today,
            hist_score: result.score,
            hist_status: result.status,
            hist_componentes: result.componentes,
            created_at: Timestamp.now()
          });

          calculationResults.push({
            clienteId,
            nome: clienteData.team_name || clienteData.nome,
            score: result.score,
            status: result.status,
            success: true
          });
        } catch (err) {
          calculationResults.push({
            clienteId,
            nome: clienteData.team_name || clienteData.nome,
            error: err.message,
            success: false
          });
        }
      }

      setResults(calculationResults);
      return calculationResults;
    } catch (err) {
      console.error('Error calculating all health scores:', err);
      setError(err.message);
      return [];
    } finally {
      setCalculating(false);
    }
  }, []);

  return {
    calculating,
    results,
    error,
    calcularTodos
  };
}

export default useHealthScore;
