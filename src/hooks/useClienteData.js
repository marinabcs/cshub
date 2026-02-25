import { useState, useEffect } from 'react';
import { doc, getDoc, collection, getDocs, query, where, orderBy, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { getThreadsByTeam, getMensagensByThread } from '../services/api';
import { calcularSegmentoCS, getClienteSegmento } from '../utils/segmentoCS';

/**
 * Custom hook that encapsulates all data-fetching logic for ClienteDetalhe.
 * Loads cliente, threads, metricas, usuarios, alertas in parallel.
 * Also recalculates saude CS automatically.
 *
 * @param {string} id - The cliente Firestore document ID (from useParams)
 * @returns {object} All data and setters needed by ClienteDetalhe tabs
 */
export function useClienteData(id) {
  const [cliente, setCliente] = useState(null);
  const [threads, setThreads] = useState([]);
  const [usageData, setUsageData] = useState({
    logins: 0, projetos_criados: 0, pecas_criadas: 0, downloads: 0,
    creditos_consumidos: 0, features_usadas: 0, dias_ativos: 0, ultima_atividade: null
  });
  const [chartData, setChartData] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [teamIds, setTeamIds] = useState([]);
  const [segmentoCalculado, setSegmentoCalculado] = useState(null);
  const [alertasCliente, setAlertasCliente] = useState([]);

  // Documentos
  const [documentos, setDocumentos] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  // Observacoes
  const [observacoes, setObservacoes] = useState([]);

  // Interacoes
  const [interacoes, setInteracoes] = useState([]);

  // Mensagens (for thread detail modal)
  const [mensagens, setMensagens] = useState([]);
  const [loadingMensagens, setLoadingMensagens] = useState(false);

  // Suggested contacts
  const [suggestedContacts, setSuggestedContacts] = useState([]);

  // Main data fetch
  useEffect(() => {
    const fetchCliente = async () => {
      try {
        const docRef = doc(db, 'clientes', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const clienteData = { id: docSnap.id, ...docSnap.data() };
          setCliente(clienteData);

          // Determinar teamIds
          let computedTeamIds = clienteData.times || [];
          if (computedTeamIds.length === 0 && clienteData.team_id) {
            computedTeamIds = [clienteData.team_id];
          }
          if (computedTeamIds.length === 0 && clienteData.id) {
            computedTeamIds = [clienteData.id];
          }

          setTeamIds(computedTeamIds);

          const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

          // OTIMIZACAO: Executar TODAS as queries em PARALELO
          const [threadsResult, metricasResult, usuariosResult, alertasResult, saudeConfigResult] = await Promise.all([
            // 1. Threads
            computedTeamIds.length > 0 ? getThreadsByTeam(computedTeamIds).catch(() => []) : Promise.resolve([]),

            // 2. Metricas de uso (com chunks para computedTeamIds > 10)
            computedTeamIds.length > 0 ? (async () => {
              const metricasRef = collection(db, 'metricas_diarias');
              const chunkSize = 10;
              const promises = [];
              for (let i = 0; i < computedTeamIds.length; i += chunkSize) {
                const chunk = computedTeamIds.slice(i, i + chunkSize);
                promises.push(
                  getDocs(query(metricasRef, where('team_id', 'in', chunk), where('data', '>=', sixtyDaysAgo)))
                );
              }
              const results = await Promise.all(promises);
              return results.flatMap(snap => snap.docs.map(d => d.data()));
            })().catch(() => []) : Promise.resolve([]),

            // 3. Usuarios (com chunks para computedTeamIds > 10)
            computedTeamIds.length > 0 ? (async () => {
              const usuariosRef = collection(db, 'usuarios_lookup');
              const chunkSize = 10;
              const promises = [];
              for (let i = 0; i < computedTeamIds.length; i += chunkSize) {
                const chunk = computedTeamIds.slice(i, i + chunkSize);
                promises.push(
                  getDocs(query(usuariosRef, where('team_id', 'in', chunk)))
                );
              }
              const results = await Promise.all(promises);
              return results.flatMap(snap => snap.docs.map(d => ({ id: d.id, ...d.data() })));
            })().catch(() => []) : Promise.resolve([]),

            // 4. Alertas do cliente
            (async () => {
              const alertasRef = collection(db, 'alertas');
              const alertasSnap = await getDocs(query(alertasRef, where('cliente_id', '==', id), orderBy('created_at', 'desc')));
              return alertasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            })().catch(() => []),

            // 5. Config de Saude CS
            getDoc(doc(db, 'config', 'geral')).then(snap => snap.exists() ? (snap.data().segmentoConfig || {}) : {}).catch(() => ({}))
          ]);

          // Processar threads
          const sortedThreads = threadsResult.sort((a, b) => {
            const dateA = a.updated_at?.toDate?.() || (a.updated_at ? new Date(a.updated_at) : new Date(0));
            const dateB = b.updated_at?.toDate?.() || (b.updated_at ? new Date(b.updated_at) : new Date(0));
            return dateB - dateA;
          });
          setThreads(sortedThreads);

          // Processar metricas de uso (apenas ultimos 30 dias para agregacao)
          const metricasUltimos30Dias = metricasResult.filter(d => {
            const dataDate = d.data?.toDate?.() || (d.data ? new Date(d.data) : null);
            return dataDate && dataDate >= thirtyDaysAgo;
          });
          const featuresUnicasSet = new Set();
          metricasUltimos30Dias.forEach(d => {
            if (d.features_usadas && typeof d.features_usadas === 'object') {
              Object.keys(d.features_usadas).forEach(feature => {
                if (d.features_usadas[feature] > 0) featuresUnicasSet.add(feature);
              });
            }
          });

          const aggregated = metricasUltimos30Dias.reduce((acc, d) => {
            const dataDate = d.data?.toDate?.() || (d.data ? new Date(d.data) : null);
            const temAtividade = (d.logins || 0) > 0 || (d.projetos_criados || 0) > 0 || (d.pecas_criadas || 0) > 0 || (d.downloads || 0) > 0 || (d.creditos_consumidos || d.uso_ai_total || 0) > 0;
            return {
              logins: acc.logins + (d.logins || 0),
              projetos_criados: acc.projetos_criados + (d.projetos_criados || 0),
              pecas_criadas: acc.pecas_criadas + (d.pecas_criadas || 0),
              downloads: acc.downloads + (d.downloads || 0),
              creditos_consumidos: acc.creditos_consumidos + (d.creditos_consumidos || d.uso_ai_total || 0),
              features_usadas: featuresUnicasSet.size,
              dias_ativos: acc.dias_ativos + (temAtividade ? 1 : 0),
              ultima_atividade: dataDate && (!acc.ultima_atividade || dataDate > acc.ultima_atividade) ? dataDate : acc.ultima_atividade
            };
          }, { logins: 0, projetos_criados: 0, pecas_criadas: 0, downloads: 0, creditos_consumidos: 0, features_usadas: 0, dias_ativos: 0, ultima_atividade: null });
          setUsageData(aggregated);

          // Processar dados para graficos (60 dias completos, com zeros para dias sem dados)
          const dailyMap = {};
          const dailyFeaturesSet = {};

          for (let i = 59; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateKey = date.toISOString().split('T')[0];
            dailyMap[dateKey] = { date: dateKey, logins: 0, projetos: 0, assets: 0, creditos_ia: 0, features_ia: 0 };
            dailyFeaturesSet[dateKey] = new Set();
          }

          metricasResult.forEach(d => {
            const dataDate = d.data?.toDate?.() || (d.data ? new Date(d.data) : null);
            if (!dataDate) return;
            const dateKey = dataDate.toISOString().split('T')[0];
            if (!dailyMap[dateKey]) return;
            dailyMap[dateKey].logins += d.logins || 0;
            dailyMap[dateKey].projetos += d.projetos_criados || 0;
            dailyMap[dateKey].assets += d.pecas_criadas || 0;
            dailyMap[dateKey].creditos_ia += d.creditos_consumidos || d.uso_ai_total || 0;
            if (d.features_usadas && typeof d.features_usadas === 'object') {
              Object.keys(d.features_usadas).forEach(feature => {
                if (d.features_usadas[feature] > 0) dailyFeaturesSet[dateKey].add(feature);
              });
            }
          });
          Object.keys(dailyMap).forEach(dateKey => {
            dailyMap[dateKey].features_ia = dailyFeaturesSet[dateKey]?.size || 0;
          });
          const chartDataSorted = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
          setChartData(chartDataSorted);

          // Processar usuarios
          const sortedUsers = usuariosResult.sort((a, b) => {
            const nameA = (a.nome || a.name || '').toLowerCase();
            const nameB = (b.nome || b.name || '').toLowerCase();
            return nameA.localeCompare(nameB);
          });
          setUsuarios(sortedUsers);

          // Processar alertas
          setAlertasCliente(alertasResult);

          // Recalcular segmento CS automaticamente
          if (clienteData.status !== 'inativo' && !clienteData.segmento_override) {
            const metricasParaCalculo = {
              logins: aggregated.logins,
              projetos_criados: aggregated.projetos_criados,
              pecas_criadas: aggregated.pecas_criadas,
              downloads: aggregated.downloads,
              creditos_consumidos: aggregated.creditos_consumidos,
              dias_ativos: aggregated.dias_ativos,
              ultima_atividade: aggregated.ultima_atividade
            };

            const resultado = calcularSegmentoCS(clienteData, sortedThreads, metricasParaCalculo, sortedUsers.length || 1, saudeConfigResult);
            const segmentoAtual = getClienteSegmento(clienteData);
            const mudou = resultado.segmento !== segmentoAtual;
            const now = new Date();

            setSegmentoCalculado({ ...resultado, changed: mudou, recalculadoEm: now, saudeConfig: saudeConfigResult });

            // Salvar no Firestore
            const clienteRef = doc(db, 'clientes', id);
            if (mudou) {
              await updateDoc(clienteRef, {
                segmento_cs: resultado.segmento,
                segmento_motivo: resultado.motivo,
                segmento_recalculado_em: Timestamp.fromDate(now),
                segmento_anterior: segmentoAtual
              });
              setCliente(prev => ({
                ...prev,
                segmento_cs: resultado.segmento,
                segmento_motivo: resultado.motivo,
                segmento_recalculado_em: Timestamp.fromDate(now),
                segmento_anterior: segmentoAtual
              }));
            } else {
              await updateDoc(clienteRef, { segmento_recalculado_em: Timestamp.fromDate(now) });
            }
          }
        }
      } catch (error) {
        console.error('Erro ao buscar cliente:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchCliente();
  }, [id]);

  // Recalcular segmento manualmente
  const handleRecalcularSegmento = async () => {
    if (!cliente || cliente.status === 'inativo') return;

    const configSnap = await getDoc(doc(db, 'config', 'geral'));
    const saudeConfig = configSnap.exists() ? (configSnap.data().segmentoConfig || {}) : {};

    const metricasParaCalculo = {
      logins: usageData.logins,
      pecas_criadas: usageData.pecas_criadas,
      downloads: usageData.downloads,
      uso_ai_total: usageData.ai_total,
      dias_ativos: usageData.dias_ativos || 0,
      ultima_atividade: usageData.ultima_atividade || null
    };

    const resultado = calcularSegmentoCS(cliente, threads, metricasParaCalculo, usuarios.length || 1, saudeConfig);
    const segmentoAtual = getClienteSegmento(cliente);
    const now = new Date();

    setSegmentoCalculado({ ...resultado, changed: resultado.segmento !== segmentoAtual, recalculadoEm: now, saudeConfig });

    const clienteRef = doc(db, 'clientes', id);
    const updateData = {
      segmento_cs: resultado.segmento,
      segmento_motivo: resultado.motivo,
      segmento_recalculado_em: Timestamp.fromDate(now),
      segmento_override: false
    };
    if (resultado.segmento !== segmentoAtual) {
      updateData.segmento_anterior = segmentoAtual;
    }
    await updateDoc(clienteRef, updateData);
    setCliente(prev => ({ ...prev, ...updateData }));
  };

  // Fetch mensagens for a thread
  const fetchMensagens = async (thread) => {
    setLoadingMensagens(true);
    setMensagens([]);
    try {
      const threadId = thread.thread_id || thread.id;
      console.log('[fetchMensagens] Buscando mensagens para thread_id:', threadId);
      const mensagensData = await getMensagensByThread(threadId);
      console.log('[fetchMensagens] Mensagens encontradas:', mensagensData.length);
      setMensagens(mensagensData.sort((a, b) => {
        const dateA = a.data?.toDate?.() || (a.data ? new Date(a.data) : new Date(0));
        const dateB = b.data?.toDate?.() || (b.data ? new Date(b.data) : new Date(0));
        return dateA - dateB;
      }));
    } catch (error) {
      console.error('Erro ao buscar mensagens:', error);
      setMensagens([]);
    } finally {
      setLoadingMensagens(false);
    }
  };

  // Fetch documentos
  const fetchDocumentos = async () => {
    setLoadingDocs(true);
    try {
      const docsSnap = await getDocs(query(
        collection(db, 'documentos'),
        where('cliente_id', '==', id)
      ));
      const docsData = docsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const dateA = a.created_at?.toDate?.() || new Date(0);
          const dateB = b.created_at?.toDate?.() || new Date(0);
          return dateB - dateA;
        });
      setDocumentos(docsData);
    } catch (error) {
      console.error('Erro ao buscar documentos:', error);
    } finally {
      setLoadingDocs(false);
    }
  };

  // Fetch observacoes
  const fetchObservacoes = async () => {
    try {
      const obsSnap = await getDocs(query(
        collection(db, 'observacoes_cs'),
        where('cliente_id', '==', id)
      ));
      const obsData = obsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const dateA = a.criado_em?.toDate?.() || new Date(0);
          const dateB = b.criado_em?.toDate?.() || new Date(0);
          return dateB - dateA;
        });
      setObservacoes(obsData);
    } catch (error) {
      console.error('Erro ao buscar observações:', error);
    }
  };

  // Fetch interacoes
  const fetchInteracoes = async () => {
    try {
      const snap = await getDocs(query(
        collection(db, 'interacoes'),
        where('cliente_id', '==', id)
      ));
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const dateA = a.data_interacao?.toDate?.() || new Date(a.data_interacao || 0);
          const dateB = b.data_interacao?.toDate?.() || new Date(b.data_interacao || 0);
          return dateB - dateA;
        });
      setInteracoes(data);
    } catch (error) {
      console.error('Erro ao buscar interações:', error);
    }
  };

  return {
    // Data
    cliente, setCliente,
    threads, setThreads,
    usageData,
    chartData,
    usuarios,
    loading,
    teamIds,
    segmentoCalculado,
    alertasCliente,
    documentos, setDocumentos,
    loadingDocs,
    observacoes, setObservacoes,
    interacoes, setInteracoes,
    mensagens, setMensagens,
    loadingMensagens,
    suggestedContacts, setSuggestedContacts,

    // Actions
    handleRecalcularSegmento,
    fetchMensagens,
    fetchDocumentos,
    fetchObservacoes,
    fetchInteracoes,
  };
}
