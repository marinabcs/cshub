import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, addDoc, updateDoc, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { verificarTodosAlertas, ordenarAlertas } from '../utils/alertas';

// Hook para buscar e gerenciar alertas
export function useAlertas(filtros = {}) {
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAlertas = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Buscar alertas e clientes em paralelo
      const [alertasSnap, clientesSnap] = await Promise.all([
        getDocs(collection(db, 'alertas')),
        getDocs(collection(db, 'clientes'))
      ]);

      // Criar mapas de clientes
      const clientesInativos = new Set();
      const clientesMap = new Map();
      clientesSnap.docs.forEach(doc => {
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
        // Buscar alertas e clientes em paralelo
        const [alertasSnap, clientesSnap] = await Promise.all([
          getDocs(collection(db, 'alertas')),
          getDocs(collection(db, 'clientes'))
        ]);

        // Criar mapa de clientes inativos/cancelados
        const clientesInativos = new Set();
        clientesSnap.docs.forEach(doc => {
          const data = doc.data();
          if (data.status === 'inativo' || data.status === 'cancelado') {
            clientesInativos.add(doc.id);
          }
        });

        // Filtrar alertas excluindo clientes inativos/cancelados
        const alertas = alertasSnap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(a => !a.cliente_id || !clientesInativos.has(a.cliente_id));

        setCounts({
          pendentes: alertas.filter(a => a.status === 'pendente').length,
          urgentes: alertas.filter(a => a.status === 'pendente' && a.prioridade === 'urgente').length,
          emAndamento: alertas.filter(a => a.status === 'em_andamento').length
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

// Tipos válidos de alertas (novos)
const TIPOS_VALIDOS = ['sem_uso_plataforma', 'sentimento_negativo', 'resposta_pendente', 'problema_reclamacao', 'creditos_baixos'];

// Hook para verificar e gerar novos alertas
export function useVerificarAlertas() {
  const [verificando, setVerificando] = useState(false);
  const [resultados, setResultados] = useState(null);

  const verificarEGerarAlertas = async () => {
    setVerificando(true);
    setResultados(null);

    try {
      // Buscar dados necessários
      const [threadsSnap, clientesSnap, alertasSnap] = await Promise.all([
        getDocs(collection(db, 'threads')),
        getDocs(collection(db, 'clientes')),
        getDocs(collection(db, 'alertas'))
      ]);

      const threads = threadsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const clientes = clientesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const alertasExistentes = alertasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Gerar novos alertas
      const novosAlertas = verificarTodosAlertas(clientes, threads, alertasExistentes);

      // Salvar novos alertas
      let criados = 0;
      const erros = [];

      for (const alerta of novosAlertas) {
        try {
          await addDoc(collection(db, 'alertas'), {
            ...alerta,
            created_at: Timestamp.now(),
            updated_at: Timestamp.now(),
            resolved_at: null
          });
          criados++;
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
        erros: erros.length > 0 ? erros : null
      });

      return { success: true, criados };
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
