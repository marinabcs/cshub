/**
 * Serviço para cálculo de Health Scores em batch
 *
 * Pode ser chamado:
 * 1. Via botão na interface (página de configurações)
 * 2. Via n8n webhook após sincronização
 */

import {
  collection,
  getDocs,
  doc,
  updateDoc,
  setDoc,
  query,
  where,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { calcularHealthScore, formatHealthHistoryDate } from '../utils/healthScore';

/**
 * Calcula o Health Score de todos os clientes ativos
 * @param {function} onProgress - Callback para progresso (opcional)
 * @returns {Promise<Object>} Resultado com estatísticas
 */
export async function calcularTodosHealthScores(onProgress = null) {
  const results = {
    total: 0,
    calculados: 0,
    pulados: 0,
    erros: 0,
    detalhes: [],
    iniciadoEm: new Date().toISOString(),
    finalizadoEm: null
  };

  try {
    // 1. Buscar todos os clientes
    const clientesSnap = await getDocs(collection(db, 'clientes'));
    results.total = clientesSnap.size;

    let processados = 0;

    for (const clienteDoc of clientesSnap.docs) {
      const clienteData = clienteDoc.data();
      const clienteId = clienteDoc.id;
      const clienteNome = clienteData.team_name || clienteData.nome || clienteId;

      // Pular clientes inativos ou cancelados
      if (clienteData.status === 'inativo' || clienteData.status === 'cancelado') {
        results.pulados++;
        results.detalhes.push({
          id: clienteId,
          nome: clienteNome,
          status: clienteData.status,
          pulado: true
        });
        processados++;
        if (onProgress) onProgress(processados, results.total, clienteNome, 'pulado');
        continue;
      }

      try {
        // Determinar teamIds
        let teamIds = clienteData.times || [];
        if (teamIds.length === 0 && clienteData.team_id) {
          teamIds = [clienteData.team_id];
        }
        if (teamIds.length === 0) {
          teamIds = [clienteId];
        }

        // 2. Buscar threads (nova estrutura: collection raiz)
        const allThreads = [];
        const threadsRef = collection(db, 'threads');
        const chunkSize = 10;

        for (let i = 0; i < teamIds.length; i += chunkSize) {
          const chunk = teamIds.slice(i, i + chunkSize);
          const threadsQuery = query(threadsRef, where('team_id', 'in', chunk));
          const threadsSnap = await getDocs(threadsQuery);
          allThreads.push(...threadsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        }

        // 3. Buscar métricas de uso (últimos 30 dias)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const metricasRef = collection(db, 'metricas_diarias');
        let allMetricas = [];

        for (let i = 0; i < teamIds.length; i += chunkSize) {
          const chunk = teamIds.slice(i, i + chunkSize);
          const metricasQuery = query(
            metricasRef,
            where('team_id', 'in', chunk),
            where('data', '>=', thirtyDaysAgo)
          );
          const metricasSnap = await getDocs(metricasQuery);
          allMetricas.push(...metricasSnap.docs.map(d => d.data()));
        }

        // 4. Contar usuários
        const usuariosRef = collection(db, 'usuarios_lookup');
        let totalUsers = 0;

        for (let i = 0; i < teamIds.length; i += chunkSize) {
          const chunk = teamIds.slice(i, i + chunkSize);
          const usersQuery = query(usuariosRef, where('team_id', 'in', chunk));
          const usersSnap = await getDocs(usersQuery);
          totalUsers += usersSnap.size;
        }

        // 5. Agregar métricas
        const usageData = allMetricas.reduce((acc, d) => ({
          logins: acc.logins + (d.logins || 0),
          pecas_criadas: acc.pecas_criadas + (d.pecas_criadas || 0),
          downloads: acc.downloads + (d.downloads || 0),
          uso_ai_total: acc.uso_ai_total + (d.uso_ai_total || 0)
        }), { logins: 0, pecas_criadas: 0, downloads: 0, uso_ai_total: 0 });

        // 6. Calcular health score
        const result = calcularHealthScore(allThreads, usageData, totalUsers);

        // 7. Salvar no cliente
        await updateDoc(doc(db, 'clientes', clienteId), {
          health_score: result.score,
          health_status: result.status,
          health_updated_at: Timestamp.now()
        });

        // 8. Salvar no histórico
        const today = formatHealthHistoryDate();
        await setDoc(doc(db, 'clientes', clienteId, 'health_history', today), {
          hist_date: today,
          hist_score: result.score,
          hist_status: result.status,
          hist_componentes: result.componentes,
          created_at: Timestamp.now()
        });

        results.calculados++;
        results.detalhes.push({
          id: clienteId,
          nome: clienteNome,
          score: result.score,
          status: result.status,
          componentes: result.componentes,
          sucesso: true
        });

        processados++;
        if (onProgress) onProgress(processados, results.total, clienteNome, result.status);

      } catch (err) {
        console.error(`Erro ao calcular health score para ${clienteNome}:`, err);
        results.erros++;
        results.detalhes.push({
          id: clienteId,
          nome: clienteNome,
          erro: err.message,
          sucesso: false
        });
        processados++;
        if (onProgress) onProgress(processados, results.total, clienteNome, 'erro');
      }
    }

  } catch (err) {
    console.error('Erro fatal no cálculo de health scores:', err);
    throw err;
  }

  results.finalizadoEm = new Date().toISOString();
  return results;
}

/**
 * Calcula o Health Score de um único cliente
 * @param {string} clienteId - ID do cliente
 * @returns {Promise<Object>} Resultado do cálculo
 */
export async function calcularHealthScoreCliente(clienteId) {
  const clienteRef = doc(db, 'clientes', clienteId);
  const clienteSnap = await getDocs(query(collection(db, 'clientes'), where('__name__', '==', clienteId)));

  if (clienteSnap.empty) {
    throw new Error('Cliente não encontrado');
  }

  const clienteData = clienteSnap.docs[0].data();

  // Determinar teamIds
  let teamIds = clienteData.times || [];
  if (teamIds.length === 0 && clienteData.team_id) {
    teamIds = [clienteData.team_id];
  }
  if (teamIds.length === 0) {
    teamIds = [clienteId];
  }

  // Buscar threads
  const allThreads = [];
  const threadsRef = collection(db, 'threads');
  const chunkSize = 10;

  for (let i = 0; i < teamIds.length; i += chunkSize) {
    const chunk = teamIds.slice(i, i + chunkSize);
    const threadsQuery = query(threadsRef, where('team_id', 'in', chunk));
    const threadsSnap = await getDocs(threadsQuery);
    allThreads.push(...threadsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  // Buscar métricas
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const metricasRef = collection(db, 'metricas_diarias');
  let allMetricas = [];

  for (let i = 0; i < teamIds.length; i += chunkSize) {
    const chunk = teamIds.slice(i, i + chunkSize);
    const metricasQuery = query(
      metricasRef,
      where('team_id', 'in', chunk),
      where('data', '>=', thirtyDaysAgo)
    );
    const metricasSnap = await getDocs(metricasQuery);
    allMetricas.push(...metricasSnap.docs.map(d => d.data()));
  }

  // Contar usuários
  const usuariosRef = collection(db, 'usuarios_lookup');
  let totalUsers = 0;

  for (let i = 0; i < teamIds.length; i += chunkSize) {
    const chunk = teamIds.slice(i, i + chunkSize);
    const usersQuery = query(usuariosRef, where('team_id', 'in', chunk));
    const usersSnap = await getDocs(usersQuery);
    totalUsers += usersSnap.size;
  }

  // Agregar métricas
  const usageData = allMetricas.reduce((acc, d) => ({
    logins: acc.logins + (d.logins || 0),
    pecas_criadas: acc.pecas_criadas + (d.pecas_criadas || 0),
    downloads: acc.downloads + (d.downloads || 0),
    uso_ai_total: acc.uso_ai_total + (d.uso_ai_total || 0)
  }), { logins: 0, pecas_criadas: 0, downloads: 0, uso_ai_total: 0 });

  // Calcular
  const result = calcularHealthScore(allThreads, usageData, totalUsers);

  // Salvar
  await updateDoc(doc(db, 'clientes', clienteId), {
    health_score: result.score,
    health_status: result.status,
    health_updated_at: Timestamp.now()
  });

  // Salvar histórico
  const today = formatHealthHistoryDate();
  await setDoc(doc(db, 'clientes', clienteId, 'health_history', today), {
    hist_date: today,
    hist_score: result.score,
    hist_status: result.status,
    hist_componentes: result.componentes,
    created_at: Timestamp.now()
  });

  return result;
}
