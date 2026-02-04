import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, getDoc, addDoc, updateDoc, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { cachedGetDocs } from '../services/cache';
import { verificarTodosAlertas, ordenarAlertas } from '../utils/alertas';
import { isClickUpConfigured, criarTarefaClickUp, buscarTarefaClickUp, buscarUsuariosClickUpPorEmails } from '../services/clickup';

// Constantes de performance
const MAX_ALERTAS_LISTAGEM = 500; // Limite para listagens gerais

// Hook para buscar e gerenciar alertas
export function useAlertas(filtros = {}) {
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAlertas = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Buscar alertas e clientes em paralelo (clientes com cache)
      const [alertasSnap, clientesDocs] = await Promise.all([
        getDocs(collection(db, 'alertas')),
        cachedGetDocs('clientes', collection(db, 'clientes'), 300000)
      ]);

      // Criar mapas de clientes
      const clientesInativos = new Set();
      const clientesMap = new Map();
      clientesDocs.forEach(doc => {
        const data = doc.data();
        clientesMap.set(doc.id, data);
        if (data.status === 'inativo' || data.status === 'cancelado') {
          clientesInativos.add(doc.id);
        }
      });

      let alertasData = alertasSnap.docs.map(doc => {
        const data = doc.data();
        const cliente = data.cliente_id ? clientesMap.get(data.cliente_id) : null;
        return {
          id: doc.id,
          ...data,
          // Enriquecer com dados do cliente
          team_type: data.team_type || cliente?.team_type || null,
          cliente_nome: data.cliente_nome || cliente?.team_name || null,
          responsavel_nome: data.responsavel_nome || cliente?.responsavel_nome || null
        };
      });

      // Excluir alertas de clientes inativos/cancelados
      alertasData = alertasData.filter(a => !a.cliente_id || !clientesInativos.has(a.cliente_id));

      // Aplicar filtros
      if (filtros.tipos && filtros.tipos.length > 0) {
        alertasData = alertasData.filter(a => filtros.tipos.includes(a.tipo));
      }
      if (filtros.prioridades && filtros.prioridades.length > 0) {
        alertasData = alertasData.filter(a => filtros.prioridades.includes(a.prioridade));
      }
      if (filtros.status && filtros.status.length > 0) {
        alertasData = alertasData.filter(a => filtros.status.includes(a.status));
      }
      if (filtros.responsavel) {
        alertasData = alertasData.filter(a => a.responsavel_email === filtros.responsavel);
      }

      // Ordenar
      alertasData = ordenarAlertas(alertasData);

      setAlertas(alertasData);
    } catch (e) {
      console.error('Erro ao buscar alertas:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filtros.tipos, filtros.prioridades, filtros.status, filtros.responsavel]);

  useEffect(() => {
    fetchAlertas();
  }, [fetchAlertas]);

  return { alertas, loading, error, refetch: fetchAlertas };
}

// Hook para contar alertas pendentes (para o sidebar)
// Otimizado: usa queries filtradas ao invés de carregar tudo
export function useAlertasCount() {
  const [counts, setCounts] = useState({
    pendentes: 0,
    urgentes: 0,
    emAndamento: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        // Buscar apenas alertas ativos (pendentes ou em_andamento) + clientes em paralelo
        const alertasRef = collection(db, 'alertas');
        const [pendentesSnap, emAndamentoSnap, clientesDocs] = await Promise.all([
          getDocs(query(alertasRef, where('status', '==', 'pendente'))),
          getDocs(query(alertasRef, where('status', '==', 'em_andamento'))),
          cachedGetDocs('clientes', collection(db, 'clientes'), 300000)
        ]);

        // Criar mapa de clientes inativos/cancelados
        const clientesInativos = new Set();
        clientesDocs.forEach(d => {
          const data = d.data();
          if (data.status === 'inativo' || data.status === 'cancelado') {
            clientesInativos.add(d.id);
          }
        });

        // Processar alertas pendentes
        const alertasPendentes = pendentesSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(a => !a.cliente_id || !clientesInativos.has(a.cliente_id));

        // Processar alertas em andamento
        const alertasEmAndamento = emAndamentoSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(a => !a.cliente_id || !clientesInativos.has(a.cliente_id));

        setCounts({
          pendentes: alertasPendentes.length,
          urgentes: alertasPendentes.filter(a => a.prioridade === 'urgente').length,
          emAndamento: alertasEmAndamento.length
        });
      } catch (e) {
        console.error('Erro ao contar alertas:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchCounts();
  }, []);

  return { counts, loading };
}

// Hook para criar alerta
export function useCriarAlerta() {
  const [creating, setCreating] = useState(false);

  const criarAlerta = async (alertaData) => {
    setCreating(true);
    try {
      const docRef = await addDoc(collection(db, 'alertas'), {
        ...alertaData,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
        resolved_at: null
      });
      return { success: true, id: docRef.id };
    } catch (e) {
      console.error('Erro ao criar alerta:', e);
      return { success: false, error: e.message };
    } finally {
      setCreating(false);
    }
  };

  return { criarAlerta, creating };
}

// Hook para atualizar status do alerta
export function useAtualizarAlerta() {
  const [updating, setUpdating] = useState(false);

  const atualizarStatus = async (alertaId, novoStatus) => {
    setUpdating(true);
    try {
      const updateData = {
        status: novoStatus,
        updated_at: Timestamp.now()
      };

      if (novoStatus === 'resolvido' || novoStatus === 'ignorado') {
        updateData.resolved_at = Timestamp.now();
      }

      await updateDoc(doc(db, 'alertas', alertaId), updateData);
      return { success: true };
    } catch (e) {
      console.error('Erro ao atualizar alerta:', e);
      return { success: false, error: e.message };
    } finally {
      setUpdating(false);
    }
  };

  return { atualizarStatus, updating };
}

// Tipos válidos de alertas (ativos)
const TIPOS_VALIDOS = ['sem_uso_plataforma', 'problema_reclamacao', 'sentimento_negativo'];

// Hook para verificar e gerar novos alertas
export function useVerificarAlertas() {
  const [verificando, setVerificando] = useState(false);
  const [resultados, setResultados] = useState(null);

  const verificarEGerarAlertas = async () => {
    setVerificando(true);
    setResultados(null);

    try {
      // Buscar dados necessários (incluindo métricas diárias e config de filtros)
      const [threadsSnap, clientesSnap, alertasSnap, metricasSnap, filterConfigSnap] = await Promise.all([
        getDocs(collection(db, 'threads')),
        getDocs(collection(db, 'clientes')),
        getDocs(collection(db, 'alertas')),
        getDocs(collection(db, 'metricas_diarias')),
        getDoc(doc(db, 'config', 'email_filters'))
      ]);

      const threads = threadsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const clientes = clientesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const alertasExistentes = alertasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const metricas = metricasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const filterConfig = filterConfigSnap.exists() ? filterConfigSnap.data() : null;

      // Gerar novos alertas (com filtro de email aplicado)
      const novosAlertas = verificarTodosAlertas(clientes, threads, alertasExistentes, metricas, filterConfig);

      // Salvar novos alertas e criar tarefas no ClickUp
      let criados = 0;
      let clickupCriados = 0;
      const erros = [];
      const clickUpEnabled = isClickUpConfigured();

      for (const alerta of novosAlertas) {
        try {
          // 1. Criar alerta no Firebase
          const docRef = await addDoc(collection(db, 'alertas'), {
            ...alerta,
            created_at: Timestamp.now(),
            updated_at: Timestamp.now(),
            resolved_at: null,
            clickup_task_id: null,
            clickup_task_url: null
          });
          criados++;

          // 2. Criar tarefa no ClickUp (se configurado)
          if (clickUpEnabled) {
            try {
              const clienteNomeAlerta = alerta.cliente_nome || alerta.time_name || '';

              // Calcular data de vencimento (3 dias a partir de agora)
              const dataVencimento = new Date();
              dataVencimento.setDate(dataVencimento.getDate() + 3);

              // Buscar IDs de todos os responsáveis
              let responsaveisIds = [];
              const responsaveisEmails = alerta.responsaveis?.map(r => r.email) ||
                (alerta.responsavel_email ? [alerta.responsavel_email] : []);

              console.log(`[ClickUp] Alerta: ${alerta.titulo}`);
              console.log(`[ClickUp] Responsáveis no alerta:`, alerta.responsaveis);
              console.log(`[ClickUp] Emails a buscar:`, responsaveisEmails);

              if (responsaveisEmails.length > 0) {
                responsaveisIds = await buscarUsuariosClickUpPorEmails(responsaveisEmails);
                console.log(`[ClickUp] IDs encontrados:`, responsaveisIds);
              }

              // Nomes dos responsáveis para a descrição
              const responsaveisNomes = alerta.responsaveis?.map(r => r.nome).join(', ') ||
                alerta.responsavel_nome || 'N/A';

              const clickupResult = await criarTarefaClickUp(
                {
                  titulo: alerta.titulo,
                  tipo: alerta.tipo,
                  prioridade: alerta.prioridade,
                  mensagem: alerta.mensagem,
                  cliente_nome: clienteNomeAlerta,
                  time_name: clienteNomeAlerta
                },
                {
                  descricao: `**Cliente:** ${clienteNomeAlerta || 'N/A'}\n\n**Responsáveis:** ${responsaveisNomes}\n\n**Tipo:** ${alerta.tipo}\n\n**Mensagem:**\n${alerta.mensagem}\n\n---\n_Alerta criado automaticamente pelo CS Hub_`,
                  responsaveisIds,
                  dataVencimento
                }
              );

              if (clickupResult && clickupResult.id) {
                // Atualizar alerta com dados do ClickUp
                await updateDoc(doc(db, 'alertas', docRef.id), {
                  clickup_task_id: clickupResult.id,
                  clickup_task_url: clickupResult.url
                });
                clickupCriados++;
              }
            } catch (clickupError) {
              console.error('Erro ao criar tarefa no ClickUp:', clickupError);
              // Não falha o alerta se ClickUp der erro
            }
          }
        } catch (e) {
          erros.push({ alerta: alerta.titulo, error: e.message });
        }
      }

      setResultados({
        verificados: {
          threads: threads.length,
          clientes: clientes.length
        },
        alertasExistentes: alertasExistentes.filter(a => a.status === 'pendente' || a.status === 'em_andamento').length,
        novosCriados: criados,
        clickupCriados: clickupCriados,
        erros: erros.length > 0 ? erros : null
      });

      return { success: true, criados, clickupCriados };
    } catch (e) {
      console.error('Erro ao verificar alertas:', e);
      setResultados({ error: e.message });
      return { success: false, error: e.message };
    } finally {
      setVerificando(false);
    }
  };

  return { verificarEGerarAlertas, verificando, resultados };
}

// Hook para limpar alertas com tipos antigos/inválidos
export function useLimparAlertasAntigos() {
  const [limpando, setLimpando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const limparAlertasAntigos = async () => {
    setLimpando(true);
    setResultado(null);

    try {
      const alertasSnap = await getDocs(collection(db, 'alertas'));
      const alertasInvalidos = alertasSnap.docs.filter(doc => {
        const data = doc.data();
        // Alerta com tipo que não existe mais
        return !TIPOS_VALIDOS.includes(data.tipo);
      });

      let removidos = 0;
      for (const doc of alertasInvalidos) {
        // Marcar como ignorado em vez de deletar (manter histórico)
        await updateDoc(doc.ref, {
          status: 'ignorado',
          updated_at: Timestamp.now(),
          resolved_at: Timestamp.now(),
          motivo_fechamento: 'Tipo de alerta descontinuado'
        });
        removidos++;
      }

      setResultado({ success: true, removidos });
      return { success: true, removidos };
    } catch (e) {
      console.error('Erro ao limpar alertas:', e);
      setResultado({ success: false, error: e.message });
      return { success: false, error: e.message };
    } finally {
      setLimpando(false);
    }
  };

  return { limparAlertasAntigos, limpando, resultado };
}

// Hook para limpar alertas inválidos (999 dias, dados incorretos)
export function useLimparAlertasInvalidos() {
  const [limpando, setLimpando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const limparAlertasInvalidos = async () => {
    setLimpando(true);
    setResultado(null);

    try {
      const alertasSnap = await getDocs(collection(db, 'alertas'));

      // Encontrar alertas de "sem_uso_plataforma" com 999 dias ou valores absurdos
      const alertasInvalidos = alertasSnap.docs.filter(doc => {
        const data = doc.data();
        // Alertas pendentes de sem_uso com valores suspeitos
        if (data.tipo === 'sem_uso_plataforma' &&
            (data.status === 'pendente' || data.status === 'em_andamento')) {
          // Verificar se o título contém números de dias
          const match = data.titulo?.match(/(\d+)\s*dias/);
          if (match) {
            const dias = parseInt(match[1], 10);
            // Considerar inválido se >= 100 dias (provavelmente sem dados reais)
            return dias >= 100;
          }
          // Também capturar se a mensagem contém "999"
          if (data.titulo?.includes('999') || data.mensagem?.includes('999')) {
            return true;
          }
        }
        return false;
      });

      let fechados = 0;
      for (const alertaDoc of alertasInvalidos) {
        await updateDoc(alertaDoc.ref, {
          status: 'ignorado',
          updated_at: Timestamp.now(),
          resolved_at: Timestamp.now(),
          motivo_fechamento: 'Dados de última interação inválidos ou ausentes'
        });
        fechados++;
      }

      setResultado({ success: true, fechados });
      return { success: true, fechados };
    } catch (e) {
      console.error('Erro ao limpar alertas inválidos:', e);
      setResultado({ success: false, error: e.message });
      return { success: false, error: e.message };
    } finally {
      setLimpando(false);
    }
  };

  return { limparAlertasInvalidos, limpando, resultado };
}

// Hook para fechar alertas de clientes inativos/cancelados automaticamente
export function useLimparAlertasClientesInativos() {
  const [limpando, setLimpando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const limparAlertasClientesInativos = async () => {
    setLimpando(true);
    setResultado(null);

    try {
      // Buscar alertas e clientes em paralelo
      const [alertasSnap, clientesSnap] = await Promise.all([
        getDocs(collection(db, 'alertas')),
        getDocs(collection(db, 'clientes'))
      ]);

      // Identificar clientes inativos/cancelados
      const clientesInativos = new Set();
      clientesSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.status === 'inativo' || data.status === 'cancelado') {
          clientesInativos.add(doc.id);
        }
      });

      // Encontrar alertas pendentes de clientes inativos
      const alertasParaFechar = alertasSnap.docs.filter(doc => {
        const data = doc.data();
        return data.cliente_id &&
               clientesInativos.has(data.cliente_id) &&
               (data.status === 'pendente' || data.status === 'em_andamento');
      });

      let fechados = 0;
      for (const alertaDoc of alertasParaFechar) {
        await updateDoc(alertaDoc.ref, {
          status: 'ignorado',
          updated_at: Timestamp.now(),
          resolved_at: Timestamp.now(),
          motivo_fechamento: 'Cliente inativo/cancelado'
        });
        fechados++;
      }

      setResultado({ success: true, fechados, clientesInativos: clientesInativos.size });
      return { success: true, fechados };
    } catch (e) {
      console.error('Erro ao limpar alertas de clientes inativos:', e);
      setResultado({ success: false, error: e.message });
      return { success: false, error: e.message };
    } finally {
      setLimpando(false);
    }
  };

  return { limparAlertasClientesInativos, limpando, resultado };
}

// Hook para buscar alertas de um time específico
export function useAlertasDoTime(timeId) {
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!timeId) {
      setAlertas([]);
      setLoading(false);
      return;
    }

    const fetchAlertas = async () => {
      try {
        const alertasSnap = await getDocs(collection(db, 'alertas'));
        const alertasData = alertasSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(a => a.time_id === timeId && (a.status === 'pendente' || a.status === 'em_andamento'));

        setAlertas(ordenarAlertas(alertasData));
      } catch (e) {
        console.error('Erro ao buscar alertas do time:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchAlertas();
  }, [timeId]);

  return { alertas, loading };
}

// Hook para buscar alertas de um cliente específico
export function useAlertasDoCliente(clienteId) {
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clienteId) {
      setAlertas([]);
      setLoading(false);
      return;
    }

    const fetchAlertas = async () => {
      try {
        const alertasSnap = await getDocs(collection(db, 'alertas'));
        const alertasData = alertasSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(a => a.cliente_id === clienteId && (a.status === 'pendente' || a.status === 'em_andamento'));

        setAlertas(ordenarAlertas(alertasData));
      } catch (e) {
        console.error('Erro ao buscar alertas do cliente:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchAlertas();
  }, [clienteId]);

  return { alertas, loading };
}

// Mapeamento de status do ClickUp para CS Hub
// Status configurados no ClickUp: PENDENTE, BLOQUEADO, EM ANDAMENTO, IGNORADO, RESOLVIDO
const CLICKUP_STATUS_MAP = {
  // PENDENTE (Not started)
  'pendente': 'pendente',

  // EM ANDAMENTO (Active)
  'em andamento': 'em_andamento',

  // BLOQUEADO (Active)
  'bloqueado': 'bloqueado',

  // RESOLVIDO (Done)
  'resolvido': 'resolvido',

  // IGNORADO (Done)
  'ignorado': 'ignorado'
};

// Hook para sincronizar status dos alertas com ClickUp
export function useSincronizarClickUp() {
  const [sincronizando, setSincronizando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const sincronizarComClickUp = async () => {
    if (!isClickUpConfigured()) {
      setResultado({ success: false, error: 'ClickUp não está configurado' });
      return { success: false, error: 'ClickUp não está configurado' };
    }

    setSincronizando(true);
    setResultado(null);

    try {
      // Buscar todos os alertas que têm clickup_task_id
      const alertasSnap = await getDocs(collection(db, 'alertas'));
      const alertasComClickUp = alertasSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(a => a.clickup_task_id && (a.status === 'pendente' || a.status === 'em_andamento' || a.status === 'bloqueado'));

      let atualizados = 0;
      let erros = 0;
      const detalhes = [];

      for (const alerta of alertasComClickUp) {
        try {
          // Buscar status atual no ClickUp
          const tarefaClickUp = await buscarTarefaClickUp(alerta.clickup_task_id);
          const statusClickUp = tarefaClickUp.status?.status?.toLowerCase() || '';
          const novoStatusCSHub = CLICKUP_STATUS_MAP[statusClickUp];

          if (novoStatusCSHub && novoStatusCSHub !== alerta.status) {
            // Atualizar status no CS Hub
            const updateData = {
              status: novoStatusCSHub,
              updated_at: Timestamp.now(),
              clickup_sync_at: Timestamp.now()
            };

            if (novoStatusCSHub === 'resolvido' || novoStatusCSHub === 'ignorado') {
              updateData.resolved_at = Timestamp.now();
              updateData.motivo_fechamento = `Sincronizado do ClickUp (${tarefaClickUp.status?.status})`;
            }

            await updateDoc(doc(db, 'alertas', alerta.id), updateData);
            atualizados++;
            detalhes.push({
              titulo: alerta.titulo,
              de: alerta.status,
              para: novoStatusCSHub
            });
          }

          // Pequeno delay para evitar rate limit do ClickUp
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (e) {
          console.error(`Erro ao sincronizar alerta ${alerta.id}:`, e);
          erros++;
        }
      }

      const res = {
        success: true,
        total: alertasComClickUp.length,
        atualizados,
        erros,
        detalhes
      };
      setResultado(res);
      return res;
    } catch (e) {
      console.error('Erro ao sincronizar com ClickUp:', e);
      const res = { success: false, error: e.message };
      setResultado(res);
      return res;
    } finally {
      setSincronizando(false);
    }
  };

  return { sincronizarComClickUp, sincronizando, resultado };
}
