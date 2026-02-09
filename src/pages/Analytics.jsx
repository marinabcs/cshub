// Analytics - Dashboard Gerencial Completo com Abas
import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import { cachedGetDocs } from '../services/cache';
import ExcelJS from 'exceljs';
import {
  Users, TrendingUp, AlertTriangle, MessageSquare,
  Filter, X, ChevronDown, Activity, Clock,
  ExternalLink, FileSpreadsheet, RefreshCw, UserCheck,
  DollarSign, ShieldAlert, Star, Zap, Award, Target, ArrowUpRight,
  ArrowDownRight, Phone, Calendar, Building2, Bug, Tag
} from 'lucide-react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  Area, AreaChart
} from 'recharts';
import { SEGMENTOS_CS, getClienteSegmento, getSegmentoColor, getSegmentoLabel, getSazonalidadeMesAtual, MESES_KEYS } from '../utils/segmentoCS';
import { AREAS_ATUACAO, getAreaLabel } from '../utils/areasAtuacao';
import { SegmentoBadge } from '../components/UI/SegmentoBadge';

const CATEGORIA_COLORS = {
  'erro_bug': '#EF4444',
  'problema_tecnico': '#f97316',
  'feedback': '#10B981',
  'duvida': '#3B82F6',
  'solicitacao': '#8b5cf6',
  'outro': '#64748b'
};

const SENTIMENTO_COLORS = {
  positivo: '#10B981',
  neutro: '#64748b',
  negativo: '#EF4444',
  urgente: '#f97316'
};

const STATUS_CLIENTE_COLORS = {
  ativo: '#10B981',
  aviso_previo: '#f59e0b',
  inativo: '#64748b',
  cancelado: '#EF4444'
};

// Extrair iniciais do nome (ex: "Marina Barros" → "MB")
const getInitials = (name) => {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

// Definição das abas (otimizado - removido Vendas, mesclado Uso+Conversas)
const TABS = [
  { id: 'engajamento', label: 'Engajamento', icon: Activity },
  { id: 'usuarios', label: 'Usuários', icon: Users },
  { id: 'churn', label: 'Prevenção de Churn', icon: ShieldAlert },
  { id: 'inativos', label: 'Inativos', icon: Clock },
  { id: 'sazonalidade', label: 'Sazonalidade', icon: Calendar },
  { id: 'problemas', label: 'Problemas', icon: Bug }
];

export default function Analytics() {
  const navigate = useNavigate();
  const contentRef = useRef(null);
  const [clientes, setClientes] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [threads, setThreads] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [metricasDiarias, setMetricasDiarias] = useState([]);
  const [loading, setLoading] = useState(true);

  // Aba ativa
  const [activeTab, setActiveTab] = useState('engajamento');

  // Filtros globais
  const [periodo, setPeriodo] = useState('30');
  const [periodoCustom, setPeriodoCustom] = useState({ inicio: '', fim: '' });
  const [responsaveis, setResponsaveisFilter] = useState([]); // multiselect
  const [teamTypes, setTeamTypesFilter] = useState([]); // multiselect
  const [filterArea, setFilterArea] = useState([]); // multiselect áreas de atuação
  const [filterSaude, setFilterSaude] = useState([]); // multiselect saúde
  const [filterStatus, setFilterStatus] = useState([]); // multiselect status (default: ativo + aviso_previo)
  const [showFilters, setShowFilters] = useState(null); // 'resp' | 'type' | 'area' | 'saude' | 'status' | null

  // Dados de tendência
  const [tendenciaData, setTendenciaData] = useState([]);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      // Data limite para queries (últimos 90 dias por padrão)
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - 90);

      // OTIMIZAÇÃO: Executar queries principais em PARALELO (com cache)
      const [
        clientesDocs,
        alertasSnapshot,
        threadsSnapshot,
        usuariosDocs,
        metricasDocs
      ] = await Promise.all([
        cachedGetDocs('clientes', collection(db, 'clientes'), 300000),
        getDocs(query(collection(db, 'alertas'), limit(1000))),
        // Usar collection raiz 'threads' ao invés de subcollections (muito mais rápido!)
        getDocs(query(collection(db, 'threads'), orderBy('updated_at', 'desc'), limit(1000))),
        cachedGetDocs('usuarios_sistema', collection(db, 'usuarios_sistema'), 600000),
        // Limitar metricas aos últimos 90 dias
        cachedGetDocs('metricas_diarias', query(collection(db, 'metricas_diarias'), where('data', '>=', dataLimite)), 300000)
      ]);

      // Processar clientes
      const clientesData = clientesDocs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      setClientes(clientesData);

      // Processar alertas
      const alertasData = alertasSnapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      setAlertas(alertasData);

      // Processar threads (da collection raiz)
      // Criar mapa de clientes por team_id para lookup rápido
      const clientesPorTeam = {};
      clientesData.forEach(c => {
        (c.times || [c.id]).forEach(teamId => {
          clientesPorTeam[teamId] = c;
        });
      });

      const allThreads = threadsSnapshot.docs.map(doc => {
        const data = doc.data();
        const cliente = clientesPorTeam[data.team_id];
        return {
          id: doc.id,
          clienteId: cliente?.id,
          clienteNome: cliente?.nome || cliente?.team_name,
          responsavel: cliente?.responsaveis?.[0]?.nome || cliente?.responsavel_nome,
          _teamId: data.team_id,
          ...data
        };
      });
      setThreads(allThreads);

      // Processar usuarios
      const usuariosData = usuariosDocs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      setUsuarios(usuariosData);

      // Processar metricas
      const metricasData = metricasDocs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      setMetricasDiarias(metricasData);

      // Gerar dados de tendência
      generateTendenciaData(clientesData, allThreads, alertasData);

    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  // Gerar dados de tendência dos últimos 30 dias
  const generateTendenciaData = (clientesData, threadsData, alertasData) => {
    const hoje = new Date();
    const data = [];

    for (let i = 29; i >= 0; i--) {
      const date = new Date(hoje);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      // Threads do dia
      const threadsDoDia = threadsData.filter(t => {
        const threadDate = t.created_at?.toDate ? t.created_at.toDate() : new Date(t.created_at);
        return threadDate.toISOString().split('T')[0] === dateStr;
      });

      // Alertas criados e resolvidos
      const alertasCriados = alertasData.filter(a => {
        const alertaDate = a.created_at?.toDate ? a.created_at.toDate() : new Date(a.created_at);
        return alertaDate.toISOString().split('T')[0] === dateStr;
      });

      const alertasResolvidos = alertasData.filter(a => {
        if (a.status !== 'resolvido' || !a.resolved_at) return false;
        const resolvedDate = a.resolved_at?.toDate ? a.resolved_at.toDate() : new Date(a.resolved_at);
        return resolvedDate.toISOString().split('T')[0] === dateStr;
      });

      data.push({
        data: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        threads: threadsDoDia.length,
        alertasCriados: alertasCriados.length,
        alertasResolvidos: alertasResolvidos.length
      });
    }

    setTendenciaData(data);
  };

  // Filtrar dados por período (suporta período customizado)
  const getDataDoPeriodo = () => {
    if (periodo === 'custom' && periodoCustom.inicio) {
      return new Date(periodoCustom.inicio);
    }
    const hoje = new Date();
    const diasAtras = new Date(hoje);
    diasAtras.setDate(diasAtras.getDate() - parseInt(periodo, 10));
    return diasAtras;
  };

  const getDataFimPeriodo = () => {
    if (periodo === 'custom' && periodoCustom.fim) {
      return new Date(periodoCustom.fim);
    }
    return new Date();
  };

  // Dados do período anterior (para comparativo)
  const getDataPeriodoAnterior = () => {
    const diasPeriodo = periodo === 'custom'
      ? Math.ceil((getDataFimPeriodo() - getDataDoPeriodo()) / (1000 * 60 * 60 * 24))
      : parseInt(periodo, 10);
    const inicio = new Date(getDataDoPeriodo());
    inicio.setDate(inicio.getDate() - diasPeriodo);
    return inicio;
  };

  // Função auxiliar para verificar se cliente tem algum dos tipos selecionados
  const clienteMatchesTipos = (clienteTeamType, tiposSelecionados) => {
    if (tiposSelecionados.length === 0) return true;
    if (!clienteTeamType) return false;
    // Separar tipos do cliente por vírgula
    const tiposCliente = clienteTeamType.split(',').map(t => t.trim());
    // Verificar se algum tipo do cliente está nos selecionados
    return tiposCliente.some(tipo => tiposSelecionados.includes(tipo));
  };

  // Clientes filtrados (por padrão exclui inativos/cancelados, mas status filter sobrescreve)
  const clientesFiltrados = useMemo(() => {
    return clientes.filter(c => {
      // Status: se filtro vazio, exclui inativos/cancelados (comportamento padrão)
      if (filterStatus.length === 0) {
        if (c.status === 'inativo' || c.status === 'cancelado') return false;
      } else {
        const statusCliente = c.status || 'ativo';
        if (!filterStatus.includes(statusCliente)) return false;
      }
      const matchesResponsavel = responsaveis.length === 0 || responsaveis.includes(c.responsavel_nome);
      const matchesType = clienteMatchesTipos(c.team_type, teamTypes);
      const matchesArea = filterArea.length === 0 || filterArea.includes(c.area_atuacao);
      const matchesSaude = filterSaude.length === 0 || filterSaude.includes(getClienteSegmento(c));
      return matchesResponsavel && matchesType && matchesArea && matchesSaude;
    });
  }, [clientes, responsaveis, teamTypes, filterArea, filterSaude, filterStatus]);

  // Clientes inativos/cancelados COM atividade (para aba Inativos)
  const clientesInativos = useMemo(() => {
    const dataLimite = getDataDoPeriodo();
    const clientesInativosCancelados = clientes.filter(c =>
      c.status === 'inativo' || c.status === 'cancelado'
    );

    // Verificar quais têm atividade no período
    return clientesInativosCancelados.map(c => {
      const teamIds = c.times || [c.id];
      const threadsCliente = threads.filter(t => teamIds.includes(t._teamId));
      const threadsNoPeriodo = threadsCliente.filter(t => {
        const threadDate = t.created_at?.toDate ? t.created_at.toDate() : new Date(t.created_at);
        return threadDate >= dataLimite;
      });
      const metricasCliente = metricasDiarias.filter(m => teamIds.includes(m.team_id));
      const metricasNoPeriodo = metricasCliente.filter(m => {
        const data = m.data?.toDate ? m.data.toDate() : new Date(m.data);
        return data >= dataLimite;
      });
      const totalUso = metricasNoPeriodo.reduce((sum, m) =>
        sum + (m.logins || 0) + (m.pecas_criadas || 0) + (m.downloads || 0), 0);

      return {
        ...c,
        threadsNoPeriodo: threadsNoPeriodo.length,
        usoNoPeriodo: totalUso,
        temAtividade: threadsNoPeriodo.length > 0 || totalUso > 0
      };
    }).filter(c => c.temAtividade)
      .sort((a, b) => b.usoNoPeriodo - a.usoNoPeriodo); // Ordenar por uso decrescente
  }, [clientes, threads, metricasDiarias, periodo, periodoCustom]);

  // Threads filtradas por período (respeita filtros globais)
  const threadsFiltradas = useMemo(() => {
    const dataLimite = getDataDoPeriodo();
    const dataFim = getDataFimPeriodo();
    return threads.filter(t => {
      const threadDate = t.created_at?.toDate ? t.created_at.toDate() : new Date(t.created_at);
      const matchesPeriodo = threadDate >= dataLimite && threadDate <= dataFim;
      const cliente = clientes.find(c => c.id === t.clienteId);
      if (filterStatus.length === 0) {
        if (cliente?.status === 'inativo' || cliente?.status === 'cancelado') return false;
      } else {
        if (!filterStatus.includes(cliente?.status || 'ativo')) return false;
      }
      const matchesResponsavel = responsaveis.length === 0 || responsaveis.includes(cliente?.responsavel_nome);
      const matchesType = clienteMatchesTipos(cliente?.team_type, teamTypes);
      const matchesArea = filterArea.length === 0 || filterArea.includes(cliente?.area_atuacao);
      const matchesSaude = filterSaude.length === 0 || filterSaude.includes(getClienteSegmento(cliente));
      return matchesPeriodo && matchesResponsavel && matchesType && matchesArea && matchesSaude;
    });
  }, [threads, clientes, periodo, periodoCustom, responsaveis, teamTypes, filterArea, filterSaude, filterStatus]);

  // Threads do período anterior (para comparativo)
  const threadsPeriodoAnterior = useMemo(() => {
    const dataLimiteAnterior = getDataPeriodoAnterior();
    const dataLimite = getDataDoPeriodo();
    return threads.filter(t => {
      const threadDate = t.created_at?.toDate ? t.created_at.toDate() : new Date(t.created_at);
      const cliente = clientes.find(c => c.id === t.clienteId);
      if (cliente?.status === 'inativo' || cliente?.status === 'cancelado') return false;
      return threadDate >= dataLimiteAnterior && threadDate < dataLimite;
    });
  }, [threads, clientes, periodo, periodoCustom]);

  // Alertas filtrados (respeita filtros globais)
  const alertasFiltrados = useMemo(() => {
    const dataLimite = getDataDoPeriodo();
    const dataFim = getDataFimPeriodo();
    return alertas.filter(a => {
      const alertaDate = a.created_at?.toDate ? a.created_at.toDate() : new Date(a.created_at);
      const matchesPeriodo = alertaDate >= dataLimite && alertaDate <= dataFim;
      const cliente = clientes.find(c => c.id === a.cliente_id);
      if (filterStatus.length === 0) {
        if (cliente?.status === 'inativo' || cliente?.status === 'cancelado') return false;
      } else {
        if (!filterStatus.includes(cliente?.status || 'ativo')) return false;
      }
      const matchesResponsavel = responsaveis.length === 0 || responsaveis.includes(cliente?.responsavel_nome);
      const matchesType = clienteMatchesTipos(cliente?.team_type, teamTypes);
      const matchesArea = filterArea.length === 0 || filterArea.includes(cliente?.area_atuacao);
      const matchesSaude = filterSaude.length === 0 || filterSaude.includes(getClienteSegmento(cliente));
      return matchesPeriodo && matchesResponsavel && matchesType && matchesArea && matchesSaude;
    });
  }, [alertas, clientes, periodo, periodoCustom, responsaveis, teamTypes, filterArea, filterSaude, filterStatus]);

  // Lista de responsáveis disponíveis
  const responsaveisDisponiveis = useMemo(() => {
    return [...new Set(clientes.filter(c => c.status !== 'inativo' && c.status !== 'cancelado').map(c => c.responsavel_nome).filter(Boolean))];
  }, [clientes]);

  // Lista de tipos disponíveis (separando tipos compostos)
  const teamTypesDisponiveis = useMemo(() => {
    const allTypes = new Set();
    clientes
      .filter(c => c.status !== 'inativo' && c.status !== 'cancelado')
      .forEach(c => {
        if (c.team_type) {
          // Separar tipos compostos por vírgula
          c.team_type.split(',').forEach(type => {
            const trimmed = type.trim();
            if (trimmed) allTypes.add(trimmed);
          });
        }
      });
    return [...allTypes].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [clientes]);

  // Lista de áreas de atuação disponíveis (apenas áreas que têm clientes)
  const areasDisponiveis = useMemo(() => {
    const areas = new Set();
    clientes
      .filter(c => c.status !== 'inativo' && c.status !== 'cancelado')
      .forEach(c => { if (c.area_atuacao) areas.add(c.area_atuacao); });
    return AREAS_ATUACAO.filter(a => areas.has(a.value));
  }, [clientes]);

  // ========== SEÇÃO 1: VISÃO GERAL (com comparativos) ==========
  const visaoGeral = useMemo(() => {
    const clientesAtivos = clientesFiltrados.filter(c => c.status === 'ativo' || !c.status).length;
    const totalTimes = clientesFiltrados.length;
    const totalThreads = threadsFiltradas.length;
    const totalThreadsAnterior = threadsPeriodoAnterior.length;
    const alertasPendentes = alertasFiltrados.filter(a => a.status === 'pendente').length;

    // Distribuição por segmento CS
    const segmentoCounts = {
      CRESCIMENTO: clientesFiltrados.filter(c => getClienteSegmento(c) === 'CRESCIMENTO').length,
      ESTAVEL: clientesFiltrados.filter(c => getClienteSegmento(c) === 'ESTAVEL').length,
      ALERTA: clientesFiltrados.filter(c => getClienteSegmento(c) === 'ALERTA').length,
      RESGATE: clientesFiltrados.filter(c => getClienteSegmento(c) === 'RESGATE').length
    };

    // Calcular variação percentual de threads
    const variacaoThreads = totalThreadsAnterior > 0
      ? Math.round(((totalThreads - totalThreadsAnterior) / totalThreadsAnterior) * 100)
      : 0;

    // Métricas de uso: período atual vs anterior
    const dataLimite = getDataDoPeriodo();
    const dataAnteriorInicio = getDataPeriodoAnterior();
    const metricasPeriodoAtual = metricasDiarias.filter(m => {
      const d = m.data?.toDate ? m.data.toDate() : new Date(m.data);
      return d >= dataLimite;
    });
    const metricasPeriodoAnterior = metricasDiarias.filter(m => {
      const d = m.data?.toDate ? m.data.toDate() : new Date(m.data);
      return d >= dataAnteriorInicio && d < dataLimite;
    });
    const loginsAtual = metricasPeriodoAtual.reduce((s, m) => s + (m.logins || 0), 0);
    const loginsAnterior = metricasPeriodoAnterior.reduce((s, m) => s + (m.logins || 0), 0);
    const pecasAtual = metricasPeriodoAtual.reduce((s, m) => s + (m.pecas_criadas || 0), 0);
    const pecasAnterior = metricasPeriodoAnterior.reduce((s, m) => s + (m.pecas_criadas || 0), 0);
    const aiAtual = metricasPeriodoAtual.reduce((s, m) => s + (m.uso_ai_total || 0), 0);
    const aiAnterior = metricasPeriodoAnterior.reduce((s, m) => s + (m.uso_ai_total || 0), 0);

    const calcVar = (atual, anterior) => anterior > 0 ? Math.round(((atual - anterior) / anterior) * 100) : 0;
    const variacaoLogins = calcVar(loginsAtual, loginsAnterior);
    const variacaoPecas = calcVar(pecasAtual, pecasAnterior);
    const variacaoAI = calcVar(aiAtual, aiAnterior);

    return { clientesAtivos, totalTimes, totalThreads, alertasPendentes, segmentoCounts, variacaoThreads, variacaoLogins, variacaoPecas, variacaoAI };
  }, [clientesFiltrados, threadsFiltradas, threadsPeriodoAnterior, alertasFiltrados, metricasDiarias, periodo, periodoCustom]);

  // ========== TOP 5 CLIENTES MAIS ENGAJADOS ==========
  const topClientesEngajados = useMemo(() => {
    const dataLimite = getDataDoPeriodo();
    return clientesFiltrados
      .map(c => {
        const teamIds = c.times || [c.id];
        const threadsCliente = threads.filter(t => teamIds.includes(t._teamId));
        const threadsNoPeriodo = threadsCliente.filter(t => {
          const threadDate = t.created_at?.toDate ? t.created_at.toDate() : new Date(t.created_at);
          return threadDate >= dataLimite;
        });
        const metricasCliente = metricasDiarias.filter(m => teamIds.includes(m.team_id));
        const metricasNoPeriodo = metricasCliente.filter(m => {
          const data = m.data?.toDate ? m.data.toDate() : new Date(m.data);
          return data >= dataLimite;
        });
        const totalLogins = metricasNoPeriodo.reduce((sum, m) => sum + (m.logins || 0), 0);
        const totalPecas = metricasNoPeriodo.reduce((sum, m) => sum + (m.pecas_criadas || 0), 0);
        const scoreEngajamento = totalLogins + (totalPecas * 2) + (threadsNoPeriodo.length * 3);

        return {
          ...c,
          threadsNoPeriodo: threadsNoPeriodo.length,
          totalLogins,
          totalPecas,
          scoreEngajamento
        };
      })
      .filter(c => c.scoreEngajamento > 0)
      .sort((a, b) => b.scoreEngajamento - a.scoreEngajamento)
      .slice(0, 5);
  }, [clientesFiltrados, threads, metricasDiarias, periodo, periodoCustom]);

  // ========== SEÇÃO 2: DISTRIBUIÇÃO POR STATUS DO CLIENTE ==========
  const statusClienteData = useMemo(() => {
    const counts = {
      ativo: clientesFiltrados.filter(c => c.status === 'ativo' || !c.status || c.status === 'onboarding').length,
      aviso_previo: clientesFiltrados.filter(c => c.status === 'aviso_previo').length,
      inativo: clientesFiltrados.filter(c => c.status === 'inativo').length,
      cancelado: clientesFiltrados.filter(c => c.status === 'cancelado').length
    };

    return [
      { name: 'Ativos', value: counts.ativo, color: STATUS_CLIENTE_COLORS.ativo },
      { name: 'Aviso Prévio', value: counts.aviso_previo, color: STATUS_CLIENTE_COLORS.aviso_previo },
      { name: 'Inativos', value: counts.inativo, color: STATUS_CLIENTE_COLORS.inativo },
      { name: 'Cancelados', value: counts.cancelado, color: STATUS_CLIENTE_COLORS.cancelado }
    ].filter(d => d.value > 0);
  }, [clientesFiltrados]);

  // ========== SEÇÃO 3: DISTRIBUIÇÃO POR SEGMENTO CS ==========
  const segmentoDistribuicaoData = useMemo(() => {
    const counts = {
      CRESCIMENTO: clientesFiltrados.filter(c => getClienteSegmento(c) === 'CRESCIMENTO').length,
      ESTAVEL: clientesFiltrados.filter(c => getClienteSegmento(c) === 'ESTAVEL').length,
      ALERTA: clientesFiltrados.filter(c => getClienteSegmento(c) === 'ALERTA').length,
      RESGATE: clientesFiltrados.filter(c => getClienteSegmento(c) === 'RESGATE').length
    };

    return [
      { name: SEGMENTOS_CS.CRESCIMENTO.label, value: counts.CRESCIMENTO, color: SEGMENTOS_CS.CRESCIMENTO.color },
      { name: SEGMENTOS_CS.ESTAVEL.label, value: counts.ESTAVEL, color: SEGMENTOS_CS.ESTAVEL.color },
      { name: SEGMENTOS_CS.ALERTA.label, value: counts.ALERTA, color: SEGMENTOS_CS.ALERTA.color },
      { name: SEGMENTOS_CS.RESGATE.label, value: counts.RESGATE, color: SEGMENTOS_CS.RESGATE.color }
    ].filter(d => d.value > 0);
  }, [clientesFiltrados]);

  // ========== SEÇÃO 4: TIMES EM RISCO ==========
  const timesEmRisco = useMemo(() => {
    return clientesFiltrados
      .filter(c => ['ALERTA', 'RESGATE'].includes(getClienteSegmento(c)))
      .sort((a, b) => {
        const segA = getClienteSegmento(a);
        const segB = getClienteSegmento(b);
        const prioA = SEGMENTOS_CS[segA]?.priority || 99;
        const prioB = SEGMENTOS_CS[segB]?.priority || 99;
        return prioB - prioA; // RESGATE first (priority 4), then ALERTA (priority 3)
      })
      .slice(0, 10);
  }, [clientesFiltrados]);

  // ========== SEÇÃO 5: PERFORMANCE POR RESPONSÁVEL ==========
  const performancePorResponsavel = useMemo(() => {
    const responsaveisMap = {};

    clientesFiltrados.forEach(cliente => {
      const resp = cliente.responsavel_nome || 'Não atribuído';
      if (!responsaveisMap[resp]) {
        responsaveisMap[resp] = {
          nome: resp,
          qtdClientes: 0,
          segmentos: { CRESCIMENTO: 0, ESTAVEL: 0, ALERTA: 0, RESGATE: 0 },
          alertasPendentes: 0,
          threadsAguardando: 0
        };
      }
      responsaveisMap[resp].qtdClientes++;
      const seg = getClienteSegmento(cliente);
      if (responsaveisMap[resp].segmentos[seg] !== undefined) {
        responsaveisMap[resp].segmentos[seg]++;
      }
    });

    // Contar alertas pendentes por responsável
    alertasFiltrados.filter(a => a.status === 'pendente').forEach(alerta => {
      const cliente = clientes.find(c => c.id === alerta.cliente_id);
      const resp = cliente?.responsavel_nome || 'Não atribuído';
      if (responsaveisMap[resp]) {
        responsaveisMap[resp].alertasPendentes++;
      }
    });

    // Contar threads aguardando por responsável
    threadsFiltradas.filter(t => t.status === 'aguardando_equipe').forEach(thread => {
      const cliente = clientes.find(c => c.id === thread.clienteId);
      const resp = cliente?.responsavel_nome || 'Não atribuído';
      if (responsaveisMap[resp]) {
        responsaveisMap[resp].threadsAguardando++;
      }
    });

    return Object.values(responsaveisMap).sort((a, b) => b.qtdClientes - a.qtdClientes);
  }, [clientesFiltrados, alertasFiltrados, threadsFiltradas, clientes]);

  // ========== SEÇÃO 7: THREADS POR CATEGORIA ==========
  const threadsPorCategoria = useMemo(() => {
    const categorias = {
      'erro_bug': 0,
      'problema_tecnico': 0,
      'feedback': 0,
      'duvida': 0,
      'solicitacao': 0,
      'outro': 0
    };

    threadsFiltradas.forEach(t => {
      const cat = t.categoria || 'outro';
      if (categorias.hasOwnProperty(cat)) {
        categorias[cat]++;
      } else {
        categorias['outro']++;
      }
    });

    const labels = {
      'erro_bug': 'Erro/Bug',
      'problema_tecnico': 'Problema Técnico',
      'feedback': 'Feedback',
      'duvida': 'Dúvida',
      'solicitacao': 'Solicitação',
      'outro': 'Outro'
    };

    return Object.entries(categorias)
      .map(([key, value]) => ({
        name: labels[key],
        value,
        color: CATEGORIA_COLORS[key]
      }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [threadsFiltradas]);

  // ========== SEÇÃO 8: SENTIMENTO DAS CONVERSAS ==========
  const sentimentoData = useMemo(() => {
    const sentimentos = {
      positivo: 0,
      neutro: 0,
      negativo: 0,
      urgente: 0
    };

    threadsFiltradas.forEach(t => {
      const sent = t.sentimento || 'neutro';
      if (sentimentos.hasOwnProperty(sent)) {
        sentimentos[sent]++;
      }
    });

    return [
      { name: 'Positivo', value: sentimentos.positivo, color: SENTIMENTO_COLORS.positivo },
      { name: 'Neutro', value: sentimentos.neutro, color: SENTIMENTO_COLORS.neutro },
      { name: 'Negativo', value: sentimentos.negativo, color: SENTIMENTO_COLORS.negativo },
      { name: 'Urgente', value: sentimentos.urgente, color: SENTIMENTO_COLORS.urgente }
    ].filter(d => d.value > 0);
  }, [threadsFiltradas]);

  // ========== ABA USO PLATAFORMA: Métricas de Uso ==========
  const metricasUsoPlataforma = useMemo(() => {
    const dataLimite = getDataDoPeriodo();
    const metricasPeriodo = metricasDiarias.filter(m => {
      const data = m.data?.toDate ? m.data.toDate() : new Date(m.data);
      return data >= dataLimite;
    });

    // Totais
    const totalLogins = metricasPeriodo.reduce((sum, m) => sum + (m.logins || 0), 0);
    const totalPecasCriadas = metricasPeriodo.reduce((sum, m) => sum + (m.pecas_criadas || 0), 0);
    const totalDownloads = metricasPeriodo.reduce((sum, m) => sum + (m.downloads || 0), 0);
    const totalUsoAI = metricasPeriodo.reduce((sum, m) => sum + (m.uso_ai_total || 0), 0);

    // Média por dia
    const diasUnicos = new Set(metricasPeriodo.map(m => {
      const data = m.data?.toDate ? m.data.toDate() : new Date(m.data);
      return data.toISOString().split('T')[0];
    })).size || 1;

    // Uso por time
    const usoPorTime = {};
    metricasPeriodo.forEach(m => {
      const teamId = m.team_id;
      if (!usoPorTime[teamId]) {
        usoPorTime[teamId] = { logins: 0, pecas: 0, downloads: 0, ai: 0 };
      }
      usoPorTime[teamId].logins += m.logins || 0;
      usoPorTime[teamId].pecas += m.pecas_criadas || 0;
      usoPorTime[teamId].downloads += m.downloads || 0;
      usoPorTime[teamId].ai += m.uso_ai_total || 0;
    });

    // Top 10 times por uso
    const topTimesPorUso = Object.entries(usoPorTime)
      .map(([teamId, uso]) => {
        const cliente = clientes.find(c => (c.times || []).includes(teamId) || c.id === teamId);
        return {
          teamId,
          nome: cliente?.nome || cliente?.team_name || teamId,
          ...uso,
          total: uso.logins + uso.pecas * 2 + uso.downloads + uso.ai * 1.5
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    return {
      totalLogins,
      totalPecasCriadas,
      totalDownloads,
      totalUsoAI,
      mediaLoginsDia: Math.round(totalLogins / diasUnicos),
      mediaPecasDia: Math.round(totalPecasCriadas / diasUnicos),
      topTimesPorUso
    };
  }, [metricasDiarias, clientes, periodo]);

  // ========== ABA USUÁRIOS: Heavy Users ==========
  const heavyUsersData = useMemo(() => {
    const dataLimite = getDataDoPeriodo();
    const metricasPeriodo = metricasDiarias.filter(m => {
      const data = m.data?.toDate ? m.data.toDate() : new Date(m.data);
      return data >= dataLimite;
    });

    // Agregar por usuário
    const userMap = {};
    metricasPeriodo.forEach(m => {
      if (!m.user_id) return;
      const key = m.user_id;
      if (!userMap[key]) {
        userMap[key] = {
          user_id: m.user_id,
          user_email: m.user_email,
          user_nome: m.user_nome,
          team_id: m.team_id,
          logins: 0,
          pecas_criadas: 0,
          downloads: 0,
          uso_ai_total: 0,
          dias_ativos: 0
        };
      }
      userMap[key].logins += m.logins || 0;
      userMap[key].pecas_criadas += m.pecas_criadas || 0;
      userMap[key].downloads += m.downloads || 0;
      userMap[key].uso_ai_total += m.uso_ai_total || 0;
      userMap[key].dias_ativos += 1;
    });

    // Calcular score de atividade (excluindo usuários de clientes inativos/cancelados)
    const users = Object.values(userMap)
      .map(u => {
        const cliente = clientes.find(c => (c.times || []).includes(u.team_id) || c.id === u.team_id);
        return {
          ...u,
          clienteNome: cliente?.nome || cliente?.team_name || '-',
          clienteStatus: cliente?.status,
          activity_score: u.logins + (u.pecas_criadas * 2) + u.downloads + (u.uso_ai_total * 1.5)
        };
      })
      .filter(u => u.clienteStatus !== 'inativo' && u.clienteStatus !== 'cancelado');

    // Top heavy users
    const heavyUsers = [...users].sort((a, b) => b.activity_score - a.activity_score).slice(0, 15);

    // Usuários inativos (sem login no período)
    const usuariosAtivos = new Set(Object.keys(userMap));

    // Distribuição por faixa de atividade
    const faixas = {
      'Power User (50+)': users.filter(u => u.activity_score >= 50).length,
      'Ativo (20-49)': users.filter(u => u.activity_score >= 20 && u.activity_score < 50).length,
      'Moderado (10-19)': users.filter(u => u.activity_score >= 10 && u.activity_score < 20).length,
      'Baixo (1-9)': users.filter(u => u.activity_score >= 1 && u.activity_score < 10).length
    };

    return { heavyUsers, faixas, totalUsuariosAtivos: users.length };
  }, [metricasDiarias, clientes, periodo]);

  // ========== ABA VENDAS: Oportunidades de Upsell ==========
  const vendasData = useMemo(() => {
    // Clientes engajados (segmento CRESCIMENTO + uso alto) = oportunidades de upsell
    const clientesComUso = clientesFiltrados.map(c => {
      const teamIds = c.times || [c.id];
      const metricasCliente = metricasDiarias.filter(m => teamIds.includes(m.team_id));
      const totalUso = metricasCliente.reduce((sum, m) =>
        sum + (m.logins || 0) + (m.pecas_criadas || 0) * 2 + (m.downloads || 0) + (m.uso_ai_total || 0) * 1.5, 0);

      return {
        ...c,
        totalUso,
        segmento: getClienteSegmento(c),
        potencialUpsell: getClienteSegmento(c) === 'CRESCIMENTO'
      };
    });

    // Oportunidades de upsell (segmento CRESCIMENTO)
    const oportunidadesUpsell = clientesComUso
      .filter(c => c.potencialUpsell)
      .sort((a, b) => b.totalUso - a.totalUso)
      .slice(0, 10);

    // Clientes com crescimento de uso (CRESCIMENTO ou ESTAVEL com bom uso)
    const clientesEmCrescimento = clientesComUso
      .filter(c => ['CRESCIMENTO', 'ESTAVEL'].includes(c.segmento) && c.totalUso > 30)
      .sort((a, b) => b.totalUso - a.totalUso)
      .slice(0, 10);

    // Valor potencial por tier (segmento CRESCIMENTO)
    const porTier = {
      'Enterprise': clientesFiltrados.filter(c => c.team_type === 'enterprise' && getClienteSegmento(c) === 'CRESCIMENTO').length,
      'Business': clientesFiltrados.filter(c => c.team_type === 'business' && getClienteSegmento(c) === 'CRESCIMENTO').length,
      'Starter': clientesFiltrados.filter(c => c.team_type === 'starter' && getClienteSegmento(c) === 'CRESCIMENTO').length
    };

    return { oportunidadesUpsell, clientesEmCrescimento, porTier, totalOportunidades: oportunidadesUpsell.length };
  }, [clientesFiltrados, metricasDiarias]);

  // ========== ABA CHURN: Prevenção de Churn ==========
  const churnData = useMemo(() => {
    const hoje = new Date();

    // Clientes em risco de churn (segmentos ALERTA e RESGATE)
    const clientesEmRisco = clientesFiltrados
      .filter(c => ['ALERTA', 'RESGATE'].includes(getClienteSegmento(c)))
      .sort((a, b) => {
        const segA = getClienteSegmento(a);
        const segB = getClienteSegmento(b);
        const prioA = SEGMENTOS_CS[segA]?.priority || 99;
        const prioB = SEGMENTOS_CS[segB]?.priority || 99;
        return prioB - prioA; // RESGATE first
      });

    // Clientes em estado critico (RESGATE)
    const clientesCriticos = clientesFiltrados.filter(c =>
      getClienteSegmento(c) === 'RESGATE'
    );

    // Clientes sem contato recente (mais de 30 dias)
    const clientesSemContato = clientesFiltrados.filter(c => {
      if (!c.ultimo_contato) return true;
      const ultimoContato = c.ultimo_contato?.toDate ? c.ultimo_contato.toDate() : new Date(c.ultimo_contato);
      const diasSemContato = Math.floor((hoje - ultimoContato) / (1000 * 60 * 60 * 24));
      return diasSemContato > 30;
    });

    // Alertas de churn por tipo
    const alertasChurn = alertasFiltrados.filter(a =>
      a.tipo === 'churn_risk' || a.tipo === 'inatividade' || a.tipo === 'sentimento_negativo'
    );

    // Distribuição por segmento CS
    const distribuicaoRisco = {
      [SEGMENTOS_CS.RESGATE.label]: clientesFiltrados.filter(c => getClienteSegmento(c) === 'RESGATE').length,
      [SEGMENTOS_CS.ALERTA.label]: clientesFiltrados.filter(c => getClienteSegmento(c) === 'ALERTA').length,
      [SEGMENTOS_CS.ESTAVEL.label]: clientesFiltrados.filter(c => getClienteSegmento(c) === 'ESTAVEL').length,
      [SEGMENTOS_CS.CRESCIMENTO.label]: clientesFiltrados.filter(c => getClienteSegmento(c) === 'CRESCIMENTO').length
    };

    // Sinais de alerta - threads negativas/urgentes
    const threadsNegativas = threadsFiltradas.filter(t =>
      t.sentimento === 'negativo' || t.sentimento === 'urgente'
    ).length;

    return {
      clientesEmRisco: clientesEmRisco.slice(0, 10),
      clientesCriticos: clientesCriticos.slice(0, 10),
      clientesSemContato: clientesSemContato.slice(0, 10),
      totalEmRisco: clientesEmRisco.length,
      totalSemContato: clientesSemContato.length,
      alertasChurn,
      distribuicaoRisco,
      threadsNegativas
    };
  }, [clientesFiltrados, alertasFiltrados, threadsFiltradas]);

  // ========== EXPORTAÇÃO EXCEL ==========
  const exportToExcel = async (sectionName, data) => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(sectionName);
    if (data.length > 0) {
      ws.columns = Object.keys(data[0]).map(key => ({ header: key, key, width: 20 }));
      data.forEach(row => ws.addRow(row));
    }
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sectionName}_${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCompleteReport = async () => {
    const wb = new ExcelJS.Workbook();

    const addSheet = (name, data) => {
      const ws = wb.addWorksheet(name);
      if (data.length > 0) {
        ws.columns = Object.keys(data[0]).map(key => ({ header: key, key, width: 20 }));
        data.forEach(row => ws.addRow(row));
      }
    };

    // Aba Resumo
    const resumoData = [{
      'Total Clientes': visaoGeral.clientesAtivos,
      'Total Times': visaoGeral.totalTimes,
      'Threads (período)': visaoGeral.totalThreads,
      'Alertas Pendentes': visaoGeral.alertasPendentes,
      'Saúde Crescimento': visaoGeral.segmentoCounts.CRESCIMENTO,
      'Saúde Estável': visaoGeral.segmentoCounts.ESTAVEL,
      'Saúde Alerta': visaoGeral.segmentoCounts.ALERTA,
      'Saúde Resgate': visaoGeral.segmentoCounts.RESGATE
    }];
    addSheet('Resumo', resumoData);

    // Aba Clientes
    const clientesExport = clientesFiltrados.map(c => ({
      'Nome': c.nome || c.team_name,
      'Tipo': c.team_type || '-',
      'Status': c.status || 'ativo',
      'Responsável': c.responsaveis?.[0]?.nome || c.responsavel_nome || '-',
      'Saúde': getSegmentoLabel(getClienteSegmento(c))
    }));
    addSheet('Clientes', clientesExport);

    // Aba Times em Risco
    const riscoExport = timesEmRisco.map(c => ({
      'Nome': c.nome || c.team_name,
      'Saúde': getSegmentoLabel(getClienteSegmento(c)),
      'Responsável': c.responsaveis?.[0]?.nome || c.responsavel_nome || '-'
    }));
    addSheet('Times em Risco', riscoExport);

    // Aba Threads
    const threadsExport = threadsFiltradas.map(t => ({
      'Cliente': t.clienteNome,
      'Assunto': t.subject || '-',
      'Categoria': t.categoria || '-',
      'Sentimento': t.sentimento || '-',
      'Status': t.status || '-',
      'Data': t.created_at?.toDate ? t.created_at.toDate().toLocaleDateString('pt-BR') : '-'
    }));
    addSheet('Threads', threadsExport);

    // Aba Alertas
    const alertasExport = alertasFiltrados.map(a => ({
      'Tipo': a.tipo || '-',
      'Descrição': a.descricao || '-',
      'Status': a.status || '-',
      'Prioridade': a.prioridade || '-',
      'Data': a.created_at?.toDate ? a.created_at.toDate().toLocaleDateString('pt-BR') : '-'
    }));
    addSheet('Alertas', alertasExport);

    // Aba Performance por Responsável
    const perfExport = performancePorResponsavel.map(p => ({
      'Responsável': p.nome,
      'Qtd Clientes': p.qtdClientes,
      'Saúde Crescimento': p.segmentos.CRESCIMENTO,
      'Saúde Estável': p.segmentos.ESTAVEL,
      'Saúde Alerta': p.segmentos.ALERTA,
      'Saúde Resgate': p.segmentos.RESGATE,
      'Alertas Pendentes': p.alertasPendentes,
      'Threads Aguardando': p.threadsAguardando
    }));
    addSheet('Performance', perfExport);

    // Aba Bugs
    const bugsExport = clientesFiltrados.flatMap(c =>
      (c.bugs_reportados || []).map(b => ({
        'Cliente': c.nome || c.team_name || '-',
        'Título': b.titulo || '-',
        'Descrição': b.descricao || '-',
        'Prioridade': b.prioridade || '-',
        'Status': b.status || '-',
        'Data': b.data?.toDate ? b.data.toDate().toLocaleDateString('pt-BR') : '-',
        'Resolvido Em': b.resolvido_em?.toDate ? b.resolvido_em.toDate().toLocaleDateString('pt-BR') : '-',
        'Link ClickUp': b.link_clickup || '-'
      }))
    );
    if (bugsExport.length > 0) {
      addSheet('Bugs', bugsExport);
    }

    // Aba Tags Problema
    const tagCounts = {};
    clientesFiltrados.forEach(c => {
      (c.tags_problema || []).forEach(t => {
        if (!tagCounts[t.tag]) tagCounts[t.tag] = { count: 0, cs: 0, ia: 0 };
        tagCounts[t.tag].count++;
        if (t.origem === 'cs') tagCounts[t.tag].cs++;
        else tagCounts[t.tag].ia++;
      });
    });
    const tagsExport = Object.entries(tagCounts)
      .sort(([,a], [,b]) => b.count - a.count)
      .map(([tag, data]) => ({
        'Tag': tag,
        'Total': data.count,
        'CS Manual': data.cs,
        'IA Automático': data.ia,
        '% IA': data.count > 0 ? Math.round((data.ia / data.count) * 100) + '%' : '0%'
      }));
    if (tagsExport.length > 0) {
      addSheet('Tags Problema', tagsExport);
    }

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_completo_${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setPeriodo('30');
    setPeriodoCustom({ inicio: '', fim: '' });
    setResponsaveisFilter([]);
    setTeamTypesFilter([]);
    setFilterArea([]);
    setFilterSaude([]);
    setFilterStatus([]);
    setShowFilters(null);
  };

  const hasFilters = periodo !== '30' || responsaveis.length > 0 || teamTypes.length > 0 || filterArea.length > 0 || filterSaude.length > 0 || filterStatus.length > 0;

  // Fechar dropdown ao clicar fora
  const handleClickOutside = () => {
    if (showFilters) setShowFilters(null);
  };

  // Toggle para multiselect
  const toggleResponsavel = (resp) => {
    setResponsaveisFilter(prev =>
      prev.includes(resp) ? prev.filter(r => r !== resp) : [...prev, resp]
    );
  };

  const toggleTeamType = (type) => {
    setTeamTypesFilter(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const toggleArea = (area) => {
    setFilterArea(prev =>
      prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]
    );
  };

  const toggleSaude = (saude) => {
    setFilterSaude(prev =>
      prev.includes(saude) ? prev.filter(s => s !== saude) : [...prev, saude]
    );
  };

  const toggleStatus = (status) => {
    setFilterStatus(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f0a1f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '48px', height: '48px', border: '3px solid rgba(139, 92, 246, 0.2)', borderTopColor: '#8b5cf6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      </div>
    );
  }

  // ========== RENDERIZAÇÃO DAS ABAS ==========

  // ========== ABA ENGAJAMENTO (MESCLADO USO + CONVERSAS) ==========
  const renderTabEngajamento = () => (
    <>
      {/* Cards principais com comparativo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MessageSquare style={{ width: '22px', height: '22px', color: 'white' }} />
            </div>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Threads ({periodo === 'custom' ? 'período' : periodo + 'd'})</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <p style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{threadsFiltradas.length}</p>
                {visaoGeral.variacaoThreads !== 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '2px 6px', background: visaoGeral.variacaoThreads > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: visaoGeral.variacaoThreads > 0 ? '#10b981' : '#ef4444', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                    {visaoGeral.variacaoThreads > 0 ? <ArrowUpRight style={{ width: '12px', height: '12px' }} /> : <ArrowDownRight style={{ width: '12px', height: '12px' }} />}
                    {Math.abs(visaoGeral.variacaoThreads)}%
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)', border: '1px solid rgba(6, 182, 212, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users style={{ width: '22px', height: '22px', color: 'white' }} />
            </div>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Total Logins</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <p style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{metricasUsoPlataforma.totalLogins}</p>
                {visaoGeral.variacaoLogins !== 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '2px 6px', background: visaoGeral.variacaoLogins > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: visaoGeral.variacaoLogins > 0 ? '#10b981' : '#ef4444', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                    {visaoGeral.variacaoLogins > 0 ? <ArrowUpRight style={{ width: '12px', height: '12px' }} /> : <ArrowDownRight style={{ width: '12px', height: '12px' }} />}
                    {Math.abs(visaoGeral.variacaoLogins)}%
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileSpreadsheet style={{ width: '22px', height: '22px', color: 'white' }} />
            </div>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Peças Criadas</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <p style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{metricasUsoPlataforma.totalPecasCriadas}</p>
                {visaoGeral.variacaoPecas !== 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '2px 6px', background: visaoGeral.variacaoPecas > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: visaoGeral.variacaoPecas > 0 ? '#10b981' : '#ef4444', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                    {visaoGeral.variacaoPecas > 0 ? <ArrowUpRight style={{ width: '12px', height: '12px' }} /> : <ArrowDownRight style={{ width: '12px', height: '12px' }} />}
                    {Math.abs(visaoGeral.variacaoPecas)}%
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap style={{ width: '22px', height: '22px', color: 'white' }} />
            </div>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Uso de AI</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <p style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{metricasUsoPlataforma.totalUsoAI}</p>
                {visaoGeral.variacaoAI !== 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '2px 6px', background: visaoGeral.variacaoAI > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: visaoGeral.variacaoAI > 0 ? '#10b981' : '#ef4444', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                    {visaoGeral.variacaoAI > 0 ? <ArrowUpRight style={{ width: '12px', height: '12px' }} /> : <ArrowDownRight style={{ width: '12px', height: '12px' }} />}
                    {Math.abs(visaoGeral.variacaoAI)}%
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle style={{ width: '22px', height: '22px', color: 'white' }} />
            </div>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Negativas/Urgentes</p>
              <p style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{(sentimentoData.find(s => s.name === 'Negativo')?.value || 0) + (sentimentoData.find(s => s.name === 'Urgente')?.value || 0)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Top 5 Engajados + Gráficos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* Top 5 Clientes Mais Engajados */}
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <Award style={{ width: '20px', height: '20px', color: '#f59e0b' }} />
            <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: 0 }}>Top 5 Mais Engajados</h3>
          </div>
          <p style={{ color: '#64748b', fontSize: '11px', margin: '0 0 12px 0' }}>Score = logins + (peças × 2) + (threads × 3)</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {topClientesEngajados.map((cliente, index) => (
              <div key={cliente.id} onClick={() => navigate(`/clientes/${cliente.id}`)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '10px', cursor: 'pointer', border: '1px solid rgba(139, 92, 246, 0.1)' }}>
                <span style={{ width: '28px', height: '28px', background: index < 3 ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'rgba(139, 92, 246, 0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '12px', fontWeight: '700' }}>
                  {index + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: 'white', fontSize: '13px', fontWeight: '500', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cliente.nome || cliente.team_name}</p>
                  <p style={{ color: '#64748b', fontSize: '11px', margin: 0 }}>{cliente.totalLogins} logins • {cliente.totalPecas} peças</p>
                </div>
                <span style={{ padding: '4px 8px', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>
                  {cliente.scoreEngajamento}
                </span>
              </div>
            ))}
            {topClientesEngajados.length === 0 && (
              <p style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>Sem dados de engajamento</p>
            )}
          </div>
        </div>

        {/* Threads por Categoria */}
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '20px' }}>
          <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: '0 0 16px 0' }}>Threads por Categoria</h3>
          {threadsPorCategoria.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={threadsPorCategoria} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(139, 92, 246, 0.1)" horizontal={true} vertical={false} />
                <XAxis type="number" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} width={90} />
                <Tooltip contentStyle={{ background: 'rgba(15, 10, 31, 0.95)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '8px' }} itemStyle={{ color: 'white' }} />
                <Bar dataKey="value" name="Threads" radius={[0, 4, 4, 0]}>
                  {threadsPorCategoria.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>Sem dados</div>
          )}
        </div>

        {/* Sentimento das Conversas */}
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '20px' }}>
          <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: '0 0 16px 0' }}>Sentimento</h3>
          {sentimentoData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={sentimentoData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value">
                  {sentimentoData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: 'rgba(15, 10, 31, 0.95)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '8px' }} itemStyle={{ color: 'white' }} />
                <Legend verticalAlign="bottom" height={36} formatter={(value) => <span style={{ color: '#94a3b8', fontSize: '11px' }}>{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>Sem dados</div>
          )}
        </div>
      </div>

      {/* Gráfico de tendência (full width) */}
      <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <TrendingUp style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
            <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: 0 }}>Tendência (últimos 30 dias)</h3>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={tendenciaData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorThreads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorAlertasCriados" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(139, 92, 246, 0.1)" />
              <XAxis dataKey="data" stroke="#64748b" fontSize={10} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
              <Tooltip contentStyle={{ background: 'rgba(15, 10, 31, 0.95)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '8px' }} labelStyle={{ color: '#94a3b8' }} itemStyle={{ color: 'white' }} />
              <Legend verticalAlign="top" height={36} formatter={(value) => <span style={{ color: '#94a3b8', fontSize: '11px' }}>{value}</span>} />
              <Area type="monotone" dataKey="threads" name="Threads" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorThreads)" />
              <Area type="monotone" dataKey="alertasCriados" name="Alertas" stroke="#f97316" fillOpacity={1} fill="url(#colorAlertasCriados)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
    </>
  );

  // ========== ABA INATIVOS (clientes inativos/cancelados com atividade) ==========
  const renderTabInativos = () => (
    <>
      <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <Clock style={{ width: '24px', height: '24px', color: '#f59e0b' }} />
          <div>
            <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>Clientes Inativos/Cancelados com Atividade</h2>
            <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0 0' }}>
              Clientes que ainda utilizam a plataforma apesar do status. Podem ser oportunidades de reativação.
            </p>
          </div>
          <span style={{ marginLeft: 'auto', padding: '6px 14px', background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', borderRadius: '8px', fontSize: '14px', fontWeight: '600' }}>
            {clientesInativos.length} clientes
          </span>
        </div>
      </div>

      {clientesInativos.length > 0 ? (
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(15, 10, 31, 0.6)' }}>
                <th style={{ padding: '14px 16px', textAlign: 'left', color: '#94a3b8', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>Cliente</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>Threads (período)</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>Uso (período)</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>Responsável</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>Ação</th>
              </tr>
            </thead>
            <tbody>
              {clientesInativos.map((cliente, index) => (
                <tr key={cliente.id} style={{ background: index % 2 === 0 ? 'transparent' : 'rgba(15, 10, 31, 0.3)' }}>
                  <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(139, 92, 246, 0.05)' }}>
                    <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: 0 }}>{cliente.nome || cliente.team_name}</p>
                    <p style={{ color: '#64748b', fontSize: '12px', margin: '2px 0 0 0' }}>{cliente.team_type || '-'}</p>
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center', borderBottom: '1px solid rgba(139, 92, 246, 0.05)' }}>
                    <span style={{
                      padding: '4px 10px',
                      background: cliente.status === 'cancelado' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(100, 116, 139, 0.2)',
                      color: cliente.status === 'cancelado' ? '#ef4444' : '#94a3b8',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '500',
                      textTransform: 'capitalize'
                    }}>
                      {cliente.status}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center', color: cliente.threadsNoPeriodo > 0 ? '#8b5cf6' : '#64748b', fontSize: '14px', fontWeight: '600', borderBottom: '1px solid rgba(139, 92, 246, 0.05)' }}>
                    {cliente.threadsNoPeriodo}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center', color: cliente.usoNoPeriodo > 0 ? '#06b6d4' : '#64748b', fontSize: '14px', fontWeight: '600', borderBottom: '1px solid rgba(139, 92, 246, 0.05)' }}>
                    {cliente.usoNoPeriodo}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '13px', borderBottom: '1px solid rgba(139, 92, 246, 0.05)' }}>
                    {cliente.responsavel_nome || '-'}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center', borderBottom: '1px solid rgba(139, 92, 246, 0.05)' }}>
                    <button
                      onClick={() => navigate(`/clientes/${cliente.id}`)}
                      style={{
                        padding: '6px 12px',
                        background: 'rgba(139, 92, 246, 0.2)',
                        border: '1px solid rgba(139, 92, 246, 0.3)',
                        borderRadius: '6px',
                        color: '#a78bfa',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      Ver Cliente
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '48px', textAlign: 'center' }}>
          <UserCheck style={{ width: '48px', height: '48px', color: '#10b981', margin: '0 auto 16px' }} />
          <p style={{ color: 'white', fontSize: '16px', fontWeight: '500', margin: '0 0 8px 0' }}>Nenhum cliente inativo com atividade</p>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Todos os clientes inativos/cancelados estão sem uso no período selecionado</p>
        </div>
      )}
    </>
  );

  const renderTabUsoPlatforma = () => (
    <>
      {/* Cards de métricas de uso */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users style={{ width: '22px', height: '22px', color: 'white' }} />
            </div>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Total Logins ({periodo}d)</p>
              <p style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{metricasUsoPlataforma.totalLogins}</p>
            </div>
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)', border: '1px solid rgba(6, 182, 212, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileSpreadsheet style={{ width: '22px', height: '22px', color: 'white' }} />
            </div>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Peças Criadas</p>
              <p style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{metricasUsoPlataforma.totalPecasCriadas}</p>
            </div>
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Download style={{ width: '22px', height: '22px', color: 'white' }} />
            </div>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Downloads</p>
              <p style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{metricasUsoPlataforma.totalDownloads}</p>
            </div>
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)', border: '1px solid rgba(249, 115, 22, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap style={{ width: '22px', height: '22px', color: 'white' }} />
            </div>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Uso de AI</p>
              <p style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{metricasUsoPlataforma.totalUsoAI}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Médias diárias */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '20px' }}>
          <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: '0 0 16px 0' }}>Média Diária</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ background: 'rgba(15, 10, 31, 0.6)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0 0 4px 0' }}>Logins/dia</p>
              <p style={{ color: 'white', fontSize: '28px', fontWeight: 'bold', margin: 0 }}>{metricasUsoPlataforma.mediaLoginsDia}</p>
            </div>
            <div style={{ background: 'rgba(15, 10, 31, 0.6)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0 0 4px 0' }}>Peças/dia</p>
              <p style={{ color: 'white', fontSize: '28px', fontWeight: 'bold', margin: 0 }}>{metricasUsoPlataforma.mediaPecasDia}</p>
            </div>
          </div>
        </div>

        {/* Top Times por Uso */}
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '20px' }}>
          <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: '0 0 16px 0' }}>Top 10 Times por Uso</h3>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {metricasUsoPlataforma.topTimesPorUso.map((time, index) => (
              <div key={time.teamId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: index < 9 ? '1px solid rgba(139, 92, 246, 0.1)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '24px', height: '24px', background: index < 3 ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'rgba(139, 92, 246, 0.2)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '11px', fontWeight: '600' }}>
                    {index + 1}
                  </span>
                  <span style={{ color: 'white', fontSize: '13px' }}>{time.nome}</span>
                </div>
                <span style={{ color: '#8b5cf6', fontSize: '13px', fontWeight: '600' }}>{Math.round(time.total)}</span>
              </div>
            ))}
            {metricasUsoPlataforma.topTimesPorUso.length === 0 && (
              <p style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>Sem dados no período</p>
            )}
          </div>
        </div>
      </div>

      {/* Gráfico de tendência de uso */}
      <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <TrendingUp style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
            <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: 0 }}>Tendências de Uso (últimos 30 dias)</h3>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={tendenciaData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorThreads" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(139, 92, 246, 0.1)" />
            <XAxis dataKey="data" stroke="#64748b" fontSize={11} tickLine={false} />
            <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
            <Tooltip contentStyle={{ background: 'rgba(15, 10, 31, 0.95)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '8px' }} />
            <Area type="monotone" dataKey="threads" name="Atividade" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorThreads)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </>
  );

  const renderTabConversas = () => (
    <>
      {/* Cards de visão geral */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MessageSquare style={{ width: '22px', height: '22px', color: 'white' }} />
            </div>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Total Threads ({periodo}d)</p>
              <p style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{threadsFiltradas.length}</p>
            </div>
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Star style={{ width: '22px', height: '22px', color: 'white' }} />
            </div>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Positivas</p>
              <p style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{sentimentoData.find(s => s.name === 'Positivo')?.value || 0}</p>
            </div>
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle style={{ width: '22px', height: '22px', color: 'white' }} />
            </div>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Negativas/Urgentes</p>
              <p style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{(sentimentoData.find(s => s.name === 'Negativo')?.value || 0) + (sentimentoData.find(s => s.name === 'Urgente')?.value || 0)}</p>
            </div>
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)', border: '1px solid rgba(249, 115, 22, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock style={{ width: '22px', height: '22px', color: 'white' }} />
            </div>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Aguardando Resposta</p>
              <p style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{threadsFiltradas.filter(t => t.status === 'aguardando_equipe').length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* Threads por Categoria */}
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '20px' }}>
          <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: '0 0 16px 0' }}>Threads por Categoria</h3>
          {threadsPorCategoria.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={threadsPorCategoria} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(139, 92, 246, 0.1)" horizontal={true} vertical={false} />
                <XAxis type="number" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} width={100} />
                <Tooltip contentStyle={{ background: 'rgba(15, 10, 31, 0.95)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '8px' }} itemStyle={{ color: 'white' }} />
                <Bar dataKey="value" name="Threads" radius={[0, 4, 4, 0]}>
                  {threadsPorCategoria.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>Sem dados no período</div>
          )}
        </div>

        {/* Sentimento das Conversas */}
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '20px' }}>
          <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: '0 0 16px 0' }}>Sentimento das Conversas</h3>
          {sentimentoData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={sentimentoData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value">
                  {sentimentoData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: 'rgba(15, 10, 31, 0.95)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '8px' }} itemStyle={{ color: 'white' }} />
                <Legend verticalAlign="bottom" height={36} formatter={(value) => <span style={{ color: '#94a3b8', fontSize: '12px' }}>{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>Sem dados de sentimento</div>
          )}
        </div>
      </div>

      {/* Tendência de conversas */}
      <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '20px' }}>
        <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: '0 0 16px 0' }}>Tendência de Conversas (últimos 30 dias)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={tendenciaData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorAlertasCriados" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorAlertasResolvidos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(139, 92, 246, 0.1)" />
            <XAxis dataKey="data" stroke="#64748b" fontSize={11} tickLine={false} />
            <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
            <Tooltip contentStyle={{ background: 'rgba(15, 10, 31, 0.95)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '8px' }} labelStyle={{ color: '#94a3b8' }} itemStyle={{ color: 'white' }} />
            <Legend verticalAlign="top" height={36} formatter={(value) => <span style={{ color: '#94a3b8', fontSize: '12px' }}>{value}</span>} />
            <Area type="monotone" dataKey="threads" name="Threads" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorThreads)" />
            <Area type="monotone" dataKey="alertasCriados" name="Alertas Criados" stroke="#f97316" fillOpacity={1} fill="url(#colorAlertasCriados)" />
            <Area type="monotone" dataKey="alertasResolvidos" name="Alertas Resolvidos" stroke="#10b981" fillOpacity={1} fill="url(#colorAlertasResolvidos)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </>
  );

  const renderTabUsuarios = () => (
    <>
      {/* Cards de métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users style={{ width: '22px', height: '22px', color: 'white' }} />
            </div>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Usuários Ativos ({periodo}d)</p>
              <p style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{heavyUsersData.totalUsuariosAtivos}</p>
            </div>
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Award style={{ width: '22px', height: '22px', color: 'white' }} />
            </div>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Power Users (50+)</p>
              <p style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{heavyUsersData.faixas['Power User (50+)']}</p>
            </div>
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity style={{ width: '22px', height: '22px', color: 'white' }} />
            </div>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Usuários Ativos</p>
              <p style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{heavyUsersData.faixas['Ativo (20-49)']}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Distribuição e Heavy Users */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', marginBottom: '24px' }}>
        {/* Distribuição por faixa */}
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '20px' }}>
          <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: '0 0 16px 0' }}>Distribuição por Atividade</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={Object.entries(heavyUsersData.faixas).map(([name, value]) => ({ name, value }))} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(139, 92, 246, 0.1)" horizontal={true} vertical={false} />
              <XAxis type="number" stroke="#64748b" fontSize={11} tickLine={false} />
              <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} width={120} />
              <Tooltip contentStyle={{ background: 'rgba(15, 10, 31, 0.95)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '8px' }} itemStyle={{ color: 'white' }} />
              <Bar dataKey="value" name="Usuários" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Heavy Users Table */}
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>
            <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: 0 }}>Top 15 Heavy Users</h3>
          </div>
          <div style={{ overflowX: 'auto', maxHeight: '350px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(15, 10, 31, 0.6)', position: 'sticky', top: 0 }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#94a3b8', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>#</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#94a3b8', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>Usuário</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', color: '#94a3b8', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>Cliente</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>Logins</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>Peças</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>Score</th>
                </tr>
              </thead>
              <tbody>
                {heavyUsersData.heavyUsers.map((user, index) => (
                  <tr key={user.user_id} style={{ background: index % 2 === 0 ? 'transparent' : 'rgba(15, 10, 31, 0.3)' }}>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid rgba(139, 92, 246, 0.05)' }}>
                      <span style={{ width: '24px', height: '24px', background: index < 3 ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'rgba(139, 92, 246, 0.2)', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '11px', fontWeight: '600' }}>
                        {index + 1}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid rgba(139, 92, 246, 0.05)' }}>
                      <p style={{ color: 'white', fontSize: '13px', margin: 0 }}>{user.user_nome || user.user_email}</p>
                      <p style={{ color: '#64748b', fontSize: '11px', margin: 0 }}>{user.user_email}</p>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '12px', borderBottom: '1px solid rgba(139, 92, 246, 0.05)' }}>{user.clienteNome}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', color: 'white', fontSize: '13px', borderBottom: '1px solid rgba(139, 92, 246, 0.05)' }}>{user.logins}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', color: 'white', fontSize: '13px', borderBottom: '1px solid rgba(139, 92, 246, 0.05)' }}>{user.pecas_criadas}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', borderBottom: '1px solid rgba(139, 92, 246, 0.05)' }}>
                      <span style={{ padding: '4px 10px', background: user.activity_score >= 50 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(139, 92, 246, 0.2)', color: user.activity_score >= 50 ? '#f59e0b' : '#8b5cf6', borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>
                        {Math.round(user.activity_score)}
                      </span>
                    </td>
                  </tr>
                ))}
                {heavyUsersData.heavyUsers.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>Nenhum usuário encontrado no período</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Seção removida - Performance por CS movida para relatórios específicos */}
    </>
  );

  // Função renderTabVendas removida (aba Vendas foi excluída)
  const renderTabVendas = () => (
    <>
      {/* Cards de oportunidades */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Target style={{ width: '22px', height: '22px', color: 'white' }} />
            </div>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Oportunidades de Upsell</p>
              <p style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{vendasData.totalOportunidades}</p>
            </div>
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowUpRight style={{ width: '22px', height: '22px', color: 'white' }} />
            </div>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Clientes em Crescimento</p>
              <p style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{vendasData.clientesEmCrescimento.length}</p>
            </div>
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)', border: '1px solid rgba(6, 182, 212, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign style={{ width: '22px', height: '22px', color: 'white' }} />
            </div>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Seg. Crescimento</p>
              <p style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{clientesFiltrados.filter(c => getClienteSegmento(c) === 'CRESCIMENTO').length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Oportunidades de Upsell */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <Target style={{ width: '20px', height: '20px', color: '#10b981' }} />
            <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: 0 }}>Oportunidades de Upsell</h3>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0 0 16px 0' }}>Clientes na saúde Crescimento (prontos para expansão)</p>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {vendasData.oportunidadesUpsell.map((cliente, index) => (
              <div key={cliente.id} onClick={() => navigate(`/clientes/${cliente.id}`)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '10px', marginBottom: '8px', cursor: 'pointer', transition: 'all 0.2s ease' }}>
                <div>
                  <p style={{ color: 'white', fontSize: '13px', fontWeight: '500', margin: 0 }}>{cliente.nome || cliente.team_name}</p>
                  <p style={{ color: '#64748b', fontSize: '11px', margin: 0 }}>{cliente.team_type || 'Standard'}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <SegmentoBadge segmento={getClienteSegmento(cliente)} size="sm" />
                    <p style={{ color: '#8b5cf6', fontSize: '11px', margin: '4px 0 0 0' }}>Uso: {Math.round(cliente.totalUso)}</p>
                  </div>
                  <ExternalLink style={{ width: '14px', height: '14px', color: '#64748b' }} />
                </div>
              </div>
            ))}
            {vendasData.oportunidadesUpsell.length === 0 && (
              <p style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>Nenhuma oportunidade identificada</p>
            )}
          </div>
        </div>

        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <TrendingUp style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
            <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: 0 }}>Clientes em Crescimento</h3>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0 0 16px 0' }}>Clientes com saúde Crescimento ou Estável com uso crescente</p>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {vendasData.clientesEmCrescimento.map((cliente, index) => (
              <div key={cliente.id} onClick={() => navigate(`/clientes/${cliente.id}`)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '10px', marginBottom: '8px', cursor: 'pointer', transition: 'all 0.2s ease' }}>
                <div>
                  <p style={{ color: 'white', fontSize: '13px', fontWeight: '500', margin: 0 }}>{cliente.nome || cliente.team_name}</p>
                  <p style={{ color: '#64748b', fontSize: '11px', margin: 0 }}>{cliente.responsavel_nome || '-'}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ padding: '4px 8px', background: 'rgba(139, 92, 246, 0.2)', color: '#8b5cf6', borderRadius: '6px', fontSize: '11px', fontWeight: '500' }}>
                    {Math.round(cliente.totalUso)} pts
                  </span>
                  <ExternalLink style={{ width: '14px', height: '14px', color: '#64748b' }} />
                </div>
              </div>
            ))}
            {vendasData.clientesEmCrescimento.length === 0 && (
              <p style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>Nenhum cliente em crescimento</p>
            )}
          </div>
        </div>
      </div>

      {/* Distribuição por Segmento CS e Status */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '20px' }}>
          <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: '0 0 16px 0' }}>Distribuição por Saúde CS</h3>
          {segmentoDistribuicaoData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={segmentoDistribuicaoData} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(139, 92, 246, 0.1)" horizontal={true} vertical={false} />
                <XAxis type="number" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} width={100} />
                <Tooltip contentStyle={{ background: 'rgba(15, 10, 31, 0.95)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '8px' }} itemStyle={{ color: 'white' }} />
                <Bar dataKey="value" name="Clientes" radius={[0, 4, 4, 0]}>
                  {segmentoDistribuicaoData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>Sem dados</div>
          )}
        </div>

        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '20px' }}>
          <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: '0 0 16px 0' }}>Distribuição por Status</h3>
          {statusClienteData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusClienteData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                  {statusClienteData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: 'rgba(15, 10, 31, 0.95)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '8px' }} itemStyle={{ color: 'white' }} />
                <Legend verticalAlign="bottom" height={36} formatter={(value) => <span style={{ color: '#94a3b8', fontSize: '12px' }}>{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>Sem dados</div>
          )}
        </div>
      </div>
    </>
  );

  const renderTabChurn = () => (
    <>
      {/* Cards de risco */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldAlert style={{ width: '22px', height: '22px', color: 'white' }} />
            </div>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Clientes em Risco</p>
              <p style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{churnData.totalEmRisco}</p>
            </div>
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)', border: '1px solid rgba(249, 115, 22, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock style={{ width: '22px', height: '22px', color: 'white' }} />
            </div>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Sem Contato (30d+)</p>
              <p style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{churnData.totalSemContato}</p>
            </div>
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle style={{ width: '22px', height: '22px', color: 'white' }} />
            </div>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Alertas de Churn</p>
              <p style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{churnData.alertasChurn.length}</p>
            </div>
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)', border: '1px solid rgba(220, 38, 38, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MessageSquare style={{ width: '22px', height: '22px', color: 'white' }} />
            </div>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Conversas Negativas</p>
              <p style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{churnData.threadsNegativas}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Distribuição por segmento */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', marginBottom: '24px' }}>
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '20px' }}>
          <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: '0 0 16px 0' }}>Distribuição por Saúde</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={Object.entries(churnData.distribuicaoRisco).map(([name, value]) => {
                  const segKey = Object.keys(SEGMENTOS_CS).find(k => SEGMENTOS_CS[k].label === name);
                  return {
                    name,
                    value,
                    color: segKey ? SEGMENTOS_CS[segKey].color : '#6b7280'
                  };
                })}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
              >
                {Object.entries(churnData.distribuicaoRisco).map(([name], index) => {
                  const segKey = Object.keys(SEGMENTOS_CS).find(k => SEGMENTOS_CS[k].label === name);
                  return <Cell key={`cell-${index}`} fill={segKey ? SEGMENTOS_CS[segKey].color : '#6b7280'} />;
                })}
              </Pie>
              <Tooltip contentStyle={{ background: 'rgba(15, 10, 31, 0.95)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '8px' }} itemStyle={{ color: 'white' }} />
              <Legend verticalAlign="bottom" height={36} formatter={(value) => <span style={{ color: '#94a3b8', fontSize: '11px' }}>{value}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Clientes em Risco */}
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <ShieldAlert style={{ width: '20px', height: '20px', color: '#ef4444' }} />
            <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: 0 }}>Top 10 Clientes em Risco</h3>
          </div>
          <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
            {churnData.clientesEmRisco.map((cliente) => {
              const seg = getClienteSegmento(cliente);
              const segColor = getSegmentoColor(seg);
              return (
              <div key={cliente.id} onClick={() => navigate(`/clientes/${cliente.id}`)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '10px', marginBottom: '8px', cursor: 'pointer', border: `1px solid ${segColor}33` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <SegmentoBadge segmento={seg} size="sm" showLabel={false} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ color: 'white', fontSize: '13px', fontWeight: '500', margin: 0 }}>{cliente.nome || cliente.team_name}</p>
                    <p style={{ color: '#64748b', fontSize: '11px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {cliente.responsaveis?.length > 0
                        ? cliente.responsaveis.join(', ')
                        : (cliente.responsavel_nome || 'Sem responsavel')}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <SegmentoBadge segmento={seg} size="sm" showIcon={false} />
                  <ExternalLink style={{ width: '14px', height: '14px', color: '#64748b' }} />
                </div>
              </div>
              );
            })}
            {churnData.clientesEmRisco.length === 0 && (
              <div style={{ padding: '32px', textAlign: 'center', color: '#10b981' }}>
                <TrendingUp style={{ width: '32px', height: '32px', margin: '0 auto 8px' }} />
                <p>Nenhum cliente em risco de churn</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Clientes sem contato */}
      <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <Clock style={{ width: '20px', height: '20px', color: '#f97316' }} />
          <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: 0 }}>Clientes sem Contato Recente (30+ dias)</h3>
          <span style={{ padding: '4px 10px', background: 'rgba(249, 115, 22, 0.2)', color: '#f97316', borderRadius: '6px', fontSize: '12px', fontWeight: '500' }}>
            {churnData.totalSemContato}
          </span>
        </div>
        <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0 0 16px 0' }}>Clientes que precisam de follow-up urgente</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
          {churnData.clientesSemContato.slice(0, 10).map(cliente => (
            <div key={cliente.id} onClick={() => navigate(`/clientes/${cliente.id}`)} style={{ background: 'rgba(15, 10, 31, 0.6)', border: '1px solid rgba(249, 115, 22, 0.2)', borderRadius: '12px', padding: '16px', cursor: 'pointer', transition: 'all 0.2s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ width: '32px', height: '32px', background: 'rgba(249, 115, 22, 0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Phone style={{ width: '16px', height: '16px', color: '#f97316' }} />
                </span>
                <ExternalLink style={{ width: '14px', height: '14px', color: '#64748b' }} />
              </div>
              <p style={{ color: 'white', fontSize: '13px', fontWeight: '500', margin: '0 0 4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {cliente.nome || cliente.team_name}
              </p>
              <p style={{ color: '#64748b', fontSize: '11px', margin: 0 }}>
                {cliente.ultimo_contato ? (() => {
                  const data = cliente.ultimo_contato?.toDate ? cliente.ultimo_contato.toDate() : new Date(cliente.ultimo_contato);
                  const dias = Math.floor((new Date() - data) / (1000 * 60 * 60 * 24));
                  return `${dias} dias atrás`;
                })() : 'Nunca contatado'}
              </p>
            </div>
          ))}
          {churnData.clientesSemContato.length === 0 && (
            <div style={{ gridColumn: '1 / -1', padding: '32px', textAlign: 'center', color: '#10b981' }}>
              <UserCheck style={{ width: '32px', height: '32px', margin: '0 auto 8px' }} />
              <p>Todos os clientes têm contato recente</p>
            </div>
          )}
        </div>
      </div>
    </>
  );

  // ========== ABA SAZONALIDADE ==========
  const renderTabSazonalidade = () => {
    const MESES_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const mesAtualIdx = new Date().getMonth();
    const mesAtualKey = MESES_KEYS[mesAtualIdx];

    // Seção A - Visão Geral do Mês Atual
    const contagens = { alta: 0, normal: 0, baixa: 0 };
    clientesFiltrados.forEach(c => {
      const saz = getSazonalidadeMesAtual(c);
      contagens[saz] = (contagens[saz] || 0) + 1;
    });

    // Seção B - Mapa de Calor: Áreas × Meses
    // Agrupar clientes por área
    const clientesPorArea = {};
    clientesFiltrados.forEach(c => {
      const area = c.area_atuacao || 'outro';
      if (!clientesPorArea[area]) clientesPorArea[area] = [];
      clientesPorArea[area].push(c);
    });

    const areasComClientes = Object.keys(clientesPorArea).sort((a, b) =>
      getAreaLabel(a).localeCompare(getAreaLabel(b), 'pt-BR')
    );

    // Para cada área e mês, contar clientes em 'alta'
    const heatmapData = areasComClientes.map(area => {
      const row = { area, label: getAreaLabel(area) };
      MESES_KEYS.forEach((mes, i) => {
        row[mes] = clientesPorArea[area].filter(c =>
          c.calendario_campanhas && c.calendario_campanhas[mes] === 'alta'
        ).length;
      });
      return row;
    });

    // Encontrar o maior valor para intensidade
    const maxHeatVal = Math.max(1, ...heatmapData.flatMap(r => MESES_KEYS.map(m => r[m])));

    // Seção C - Janela de Abordagem Ideal
    const janelaAbordagem = areasComClientes.map(area => {
      let maxCount = 0;
      let mesPico = 0;
      MESES_KEYS.forEach((mes, i) => {
        const count = clientesPorArea[area].filter(c =>
          c.calendario_campanhas && c.calendario_campanhas[mes] === 'alta'
        ).length;
        if (count > maxCount) { maxCount = count; mesPico = i; }
      });
      // Mês de abordagem ideal: 1 mês antes do pico
      const mesAbordagem = mesPico === 0 ? 11 : mesPico - 1;
      // Distância do mês atual até o pico
      const distancia = mesPico >= mesAtualIdx ? mesPico - mesAtualIdx : 12 - mesAtualIdx + mesPico;
      return {
        area,
        label: getAreaLabel(area),
        mesPico,
        mesPicoLabel: MESES_LABELS[mesPico],
        mesAbordagem,
        mesAbordagemLabel: MESES_LABELS[mesAbordagem],
        clientesPico: maxCount,
        distancia
      };
    }).filter(j => j.clientesPico > 0).sort((a, b) => a.distancia - b.distancia);

    // Seção D - Uso Real vs Esperado (mês atual)
    const clientesEmAlta = clientesFiltrados.filter(c => getSazonalidadeMesAtual(c) === 'alta');
    const ativosEmAlta = clientesEmAlta.filter(c => c.status === 'ativo' || c.status === 'onboarding' || !c.status);
    const inativosEmAlta = clientesEmAlta.filter(c => c.status !== 'ativo' && c.status !== 'onboarding' && c.status);

    // Seção E - Alertas de Sazonalidade
    const alertasSazonalidade = alertas.filter(a =>
      a.tipo === 'sazonalidade_alta_inativo' && a.status === 'pendente'
    );

    return (
      <>
        {/* Seção A - Visão Geral do Mês Atual */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar style={{ width: '18px', height: '18px', color: '#8b5cf6' }} />
            Sazonalidade — {MESES_LABELS[mesAtualIdx]} {new Date().getFullYear()}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            {[
              { label: 'Clientes em Alta', count: contagens.alta, color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
              { label: 'Clientes em Normal', count: contagens.normal, color: '#64748b', bg: 'rgba(100, 116, 139, 0.15)' },
              { label: 'Clientes em Baixa', count: contagens.baixa, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' }
            ].map(item => (
              <div key={item.label} style={{
                background: 'rgba(30, 27, 75, 0.4)',
                border: '1px solid rgba(139, 92, 246, 0.15)',
                borderRadius: '16px',
                padding: '20px',
                textAlign: 'center'
              }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '12px',
                  background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 12px'
                }}>
                  <span style={{ fontSize: '20px', fontWeight: '700', color: item.color }}>{item.count}</span>
                </div>
                <div style={{ color: '#94a3b8', fontSize: '13px' }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Seção B - Mapa de Calor: Áreas × Meses */}
        <div style={{
          background: 'rgba(30, 27, 75, 0.4)',
          border: '1px solid rgba(139, 92, 246, 0.15)',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '24px',
          overflowX: 'auto'
        }}>
          <h4 style={{ color: 'white', fontSize: '14px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 style={{ width: '16px', height: '16px', color: '#06b6d4' }} />
            Mapa de Calor — Clientes em Alta por Área e Mês
          </h4>
          {areasComClientes.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '24px' }}>Nenhum cliente com área de atuação definida</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: '#94a3b8', fontWeight: '500', borderBottom: '1px solid rgba(139, 92, 246, 0.15)' }}>Área</th>
                  {MESES_LABELS.map((m, i) => (
                    <th key={m} style={{
                      textAlign: 'center', padding: '8px 6px', fontWeight: '500',
                      color: i === mesAtualIdx ? '#8b5cf6' : '#94a3b8',
                      borderBottom: '1px solid rgba(139, 92, 246, 0.15)',
                      background: i === mesAtualIdx ? 'rgba(139, 92, 246, 0.08)' : 'transparent'
                    }}>{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmapData.map(row => (
                  <tr key={row.area}>
                    <td style={{ padding: '8px 12px', color: 'white', fontWeight: '500', borderBottom: '1px solid rgba(139, 92, 246, 0.08)', whiteSpace: 'nowrap' }}>
                      {row.label}
                      <span style={{ color: '#64748b', fontSize: '11px', marginLeft: '6px' }}>({clientesPorArea[row.area].length})</span>
                    </td>
                    {MESES_KEYS.map((mes, i) => {
                      const val = row[mes];
                      const intensity = val / maxHeatVal;
                      return (
                        <td key={mes} style={{
                          textAlign: 'center', padding: '8px 6px',
                          borderBottom: '1px solid rgba(139, 92, 246, 0.08)',
                          background: i === mesAtualIdx
                            ? `rgba(139, 92, 246, ${0.08 + intensity * 0.15})`
                            : val > 0 ? `rgba(16, 185, 129, ${0.1 + intensity * 0.5})` : 'transparent'
                        }}>
                          <span style={{
                            color: val > 0 ? 'white' : '#3730a3',
                            fontWeight: val > 0 ? '600' : '400',
                            fontSize: '12px'
                          }}>
                            {val}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Seção C - Janela de Abordagem Ideal */}
        <div style={{
          background: 'rgba(30, 27, 75, 0.4)',
          border: '1px solid rgba(139, 92, 246, 0.15)',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '24px'
        }}>
          <h4 style={{ color: 'white', fontSize: '14px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Target style={{ width: '16px', height: '16px', color: '#f59e0b' }} />
            Janela de Abordagem Ideal
          </h4>
          {janelaAbordagem.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '24px' }}>Nenhuma área com pico identificado</div>
          ) : (
            <div style={{ display: 'grid', gap: '8px' }}>
              {janelaAbordagem.map(j => (
                <div key={j.area} style={{
                  display: 'flex', alignItems: 'center', gap: '16px',
                  padding: '12px 16px', borderRadius: '10px',
                  background: j.distancia <= 1 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(15, 10, 31, 0.5)',
                  border: j.distancia <= 1 ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(139, 92, 246, 0.08)'
                }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ color: 'white', fontWeight: '500', fontSize: '13px' }}>{j.label}</span>
                  </div>
                  <div style={{ textAlign: 'center', minWidth: '70px' }}>
                    <div style={{ color: '#10b981', fontSize: '13px', fontWeight: '600' }}>{j.mesPicoLabel}</div>
                    <div style={{ color: '#64748b', fontSize: '10px' }}>Pico</div>
                  </div>
                  <div style={{ textAlign: 'center', minWidth: '70px' }}>
                    <div style={{ color: '#f59e0b', fontSize: '13px', fontWeight: '600' }}>{j.mesAbordagemLabel}</div>
                    <div style={{ color: '#64748b', fontSize: '10px' }}>Abordar</div>
                  </div>
                  <div style={{ textAlign: 'center', minWidth: '50px' }}>
                    <div style={{ color: '#8b5cf6', fontSize: '13px', fontWeight: '600' }}>{j.clientesPico}</div>
                    <div style={{ color: '#64748b', fontSize: '10px' }}>Clientes</div>
                  </div>
                  {j.distancia <= 1 && (
                    <span style={{
                      padding: '3px 8px', borderRadius: '8px', fontSize: '10px', fontWeight: '600',
                      background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b'
                    }}>
                      {j.distancia === 0 ? 'AGORA' : 'PRÓXIMO'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Seção D - Uso Real vs Esperado */}
        <div style={{
          background: 'rgba(30, 27, 75, 0.4)',
          border: '1px solid rgba(139, 92, 246, 0.15)',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '24px'
        }}>
          <h4 style={{ color: 'white', fontSize: '14px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity style={{ width: '16px', height: '16px', color: '#06b6d4' }} />
            Uso Real vs Esperado — Clientes em Alta ({MESES_LABELS[mesAtualIdx]})
          </h4>
          {clientesEmAlta.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '24px' }}>Nenhum cliente em temporada alta neste mês</div>
          ) : (
            <>
              {/* Barra empilhada */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#94a3b8', fontSize: '12px' }}>
                    {ativosEmAlta.length} ativos de {clientesEmAlta.length} em alta
                  </span>
                  <span style={{ color: '#94a3b8', fontSize: '12px' }}>
                    {clientesEmAlta.length > 0 ? Math.round((ativosEmAlta.length / clientesEmAlta.length) * 100) : 0}%
                  </span>
                </div>
                <div style={{ height: '24px', borderRadius: '12px', overflow: 'hidden', display: 'flex', background: 'rgba(15, 10, 31, 0.5)' }}>
                  {ativosEmAlta.length > 0 && (
                    <div style={{
                      width: `${(ativosEmAlta.length / clientesEmAlta.length) * 100}%`,
                      background: 'linear-gradient(90deg, #10b981, #06b6d4)',
                      transition: 'width 0.3s'
                    }} />
                  )}
                  {inativosEmAlta.length > 0 && (
                    <div style={{
                      width: `${(inativosEmAlta.length / clientesEmAlta.length) * 100}%`,
                      background: '#ef4444',
                      transition: 'width 0.3s'
                    }} />
                  )}
                </div>
                <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#94a3b8' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} /> Ativos ({ativosEmAlta.length})
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#94a3b8' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} /> Inativos ({inativosEmAlta.length})
                  </span>
                </div>
              </div>

              {/* Lista de inativos em alta temporada */}
              {inativosEmAlta.length > 0 && (
                <div>
                  <div style={{ color: '#ef4444', fontSize: '12px', fontWeight: '600', marginBottom: '8px' }}>
                    Inativos em temporada alta ({inativosEmAlta.length})
                  </div>
                  <div style={{ display: 'grid', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                    {inativosEmAlta.map(c => (
                      <div
                        key={c.id}
                        onClick={() => navigate(`/clientes/${c.id}`)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '8px 12px', borderRadius: '8px', cursor: 'pointer',
                          background: 'rgba(239, 68, 68, 0.08)',
                          border: '1px solid rgba(239, 68, 68, 0.15)'
                        }}
                      >
                        <span style={{ color: 'white', fontSize: '13px' }}>{c.nome}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: '#64748b', fontSize: '11px' }}>{getAreaLabel(c.area_atuacao)}</span>
                          <span style={{
                            padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '600',
                            background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', textTransform: 'capitalize'
                          }}>{c.status}</span>
                          <ExternalLink style={{ width: '12px', height: '12px', color: '#64748b' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Seção E - Alertas de Sazonalidade */}
        <div style={{
          background: 'rgba(30, 27, 75, 0.4)',
          border: '1px solid rgba(139, 92, 246, 0.15)',
          borderRadius: '16px',
          padding: '20px'
        }}>
          <h4 style={{ color: 'white', fontSize: '14px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle style={{ width: '16px', height: '16px', color: '#f97316' }} />
            Alertas de Sazonalidade Pendentes
            {alertasSazonalidade.length > 0 && (
              <span style={{
                padding: '2px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: '600',
                background: 'rgba(249, 115, 22, 0.2)', color: '#f97316'
              }}>{alertasSazonalidade.length}</span>
            )}
          </h4>
          {alertasSazonalidade.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '24px' }}>
              Nenhum alerta de sazonalidade pendente
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '6px', maxHeight: '250px', overflowY: 'auto' }}>
              {alertasSazonalidade.map(a => {
                const cliente = clientes.find(c => c.id === a.cliente_id);
                return (
                  <div
                    key={a.id}
                    onClick={() => cliente && navigate(`/clientes/${cliente.id}`)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderRadius: '10px', cursor: 'pointer',
                      background: 'rgba(249, 115, 22, 0.06)',
                      border: '1px solid rgba(249, 115, 22, 0.15)'
                    }}
                  >
                    <div>
                      <div style={{ color: 'white', fontSize: '13px', fontWeight: '500' }}>{cliente?.nome || 'Cliente'}</div>
                      <div style={{ color: '#64748b', fontSize: '11px', marginTop: '2px' }}>{a.mensagem || 'Em alta temporada mas inativo'}</div>
                    </div>
                    <ExternalLink style={{ width: '14px', height: '14px', color: '#64748b', flexShrink: 0 }} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </>
    );
  };

  // ========== ABA PROBLEMAS (BUGS + TAGS) ==========
  const renderTabProblemas = () => {
    const PRIORIDADE_COLORS = { baixa: '#64748b', media: '#f59e0b', alta: '#f97316', critica: '#ef4444' };
    const STATUS_BUG_COLORS = { aberto: '#ef4444', em_andamento: '#f59e0b', resolvido: '#10b981' };
    const STATUS_BUG_LABELS = { aberto: 'Aberto', em_andamento: 'Em andamento', resolvido: 'Resolvido' };

    // Agregar bugs de todos os clientes filtrados
    const todosBugs = clientesFiltrados.flatMap(c =>
      (c.bugs_reportados || []).map(b => ({ ...b, clienteId: c.id, clienteNome: c.nome || c.team_name }))
    );
    const bugsAbertos = todosBugs.filter(b => b.status !== 'resolvido');
    const bugsCriticos = bugsAbertos.filter(b => b.prioridade === 'critica' || b.prioridade === 'alta');

    // Agregar tags
    const todasTags = clientesFiltrados.flatMap(c =>
      (c.tags_problema || []).map(t => ({ ...t, clienteId: c.id, clienteNome: c.nome || c.team_name }))
    );
    const clientesComProblemas = clientesFiltrados.filter(c =>
      (c.bugs_reportados || []).some(b => b.status !== 'resolvido') || (c.tags_problema || []).length > 0
    ).length;

    // Bugs por prioridade (PieChart)
    const bugsPorPrioridade = ['baixa', 'media', 'alta', 'critica'].map(p => ({
      name: p.charAt(0).toUpperCase() + p.slice(1),
      value: todosBugs.filter(b => b.prioridade === p).length,
      color: PRIORIDADE_COLORS[p]
    })).filter(d => d.value > 0);

    // Bugs por status (para BarChart empilhado)
    const bugsPorPrioridadeStatus = ['baixa', 'media', 'alta', 'critica'].map(p => ({
      name: p.charAt(0).toUpperCase() + p.slice(1),
      aberto: todosBugs.filter(b => b.prioridade === p && b.status === 'aberto').length,
      em_andamento: todosBugs.filter(b => b.prioridade === p && b.status === 'em_andamento').length,
      resolvido: todosBugs.filter(b => b.prioridade === p && b.status === 'resolvido').length
    })).filter(d => d.aberto + d.em_andamento + d.resolvido > 0);

    // Tempo médio de resolução
    const bugsResolvidos = todosBugs.filter(b => b.status === 'resolvido' && b.resolvido_em && b.data);
    let tempoMedioResolucao = 0;
    if (bugsResolvidos.length > 0) {
      const totalDias = bugsResolvidos.reduce((sum, b) => {
        const inicio = b.data?.toDate ? b.data.toDate() : new Date(b.data);
        const fim = b.resolvido_em?.toDate ? b.resolvido_em.toDate() : new Date(b.resolvido_em);
        return sum + Math.max(0, Math.ceil((fim - inicio) / (1000 * 60 * 60 * 24)));
      }, 0);
      tempoMedioResolucao = Math.round(totalDias / bugsResolvidos.length);
    }

    // Top 10 tags mais frequentes
    const tagCounts = {};
    todasTags.forEach(t => {
      if (!tagCounts[t.tag]) tagCounts[t.tag] = { tag: t.tag, count: 0, cs: 0, ia: 0 };
      tagCounts[t.tag].count++;
      if (t.origem === 'cs') tagCounts[t.tag].cs++;
      else tagCounts[t.tag].ia++;
    });
    const topTags = Object.values(tagCounts).sort((a, b) => b.count - a.count).slice(0, 10);
    const totalTagsCS = todasTags.filter(t => t.origem === 'cs').length;
    const totalTagsIA = todasTags.filter(t => t.origem === 'ia').length;

    // Top 10 clientes mais afetados
    const clientesAfetados = clientesFiltrados
      .map(c => ({
        ...c,
        bugsAbertos: (c.bugs_reportados || []).filter(b => b.status !== 'resolvido').length,
        totalTags: (c.tags_problema || []).length,
        prioridadeMax: (c.bugs_reportados || []).filter(b => b.status !== 'resolvido')
          .reduce((max, b) => {
            const ordem = { critica: 4, alta: 3, media: 2, baixa: 1 };
            return (ordem[b.prioridade] || 0) > (ordem[max] || 0) ? b.prioridade : max;
          }, '')
      }))
      .filter(c => c.bugsAbertos > 0 || c.totalTags > 0)
      .sort((a, b) => (b.bugsAbertos + b.totalTags) - (a.bugsAbertos + a.totalTags))
      .slice(0, 10);

    // Bugs recentes (15 mais recentes)
    const bugsRecentes = todosBugs
      .filter(b => b.data)
      .sort((a, b) => {
        const dA = a.data?.toDate ? a.data.toDate() : new Date(a.data);
        const dB = b.data?.toDate ? b.data.toDate() : new Date(b.data);
        return dB - dA;
      })
      .slice(0, 15);

    const formatRelativeDate = (d) => {
      const date = d?.toDate ? d.toDate() : new Date(d);
      const dias = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
      if (dias === 0) return 'Hoje';
      if (dias === 1) return 'Ontem';
      if (dias < 7) return `${dias}d atrás`;
      if (dias < 30) return `${Math.floor(dias / 7)}sem atrás`;
      return date.toLocaleDateString('pt-BR');
    };

    return (
      <>
        {/* Seção A - Cards Resumo */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: 'Bugs Abertos', count: bugsAbertos.length, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', icon: Bug },
            { label: 'Críticos/Alta', count: bugsCriticos.length, color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)', icon: AlertTriangle },
            { label: 'Tags Problema', count: todasTags.length, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', icon: Tag },
            { label: 'Clientes Afetados', count: clientesComProblemas, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)', icon: Users }
          ].map(item => {
            const Icon = item.icon;
            return (
              <div key={item.label} style={{
                background: 'rgba(30, 27, 75, 0.4)',
                border: '1px solid rgba(139, 92, 246, 0.15)',
                borderRadius: '16px',
                padding: '20px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon style={{ width: '22px', height: '22px', color: item.color }} />
                  </div>
                  <div>
                    <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>{item.label}</p>
                    <p style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{item.count}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Seção B - Bugs por Prioridade e Status */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 300px', gap: '24px', marginBottom: '24px' }}>
          {/* PieChart Prioridade */}
          <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '20px' }}>
            <h4 style={{ color: 'white', fontSize: '14px', fontWeight: '600', marginBottom: '16px', margin: '0 0 16px 0' }}>Bugs por Prioridade</h4>
            {bugsPorPrioridade.length === 0 ? (
              <div style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '40px' }}>Nenhum bug registrado</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={bugsPorPrioridade} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={3}>
                    {bugsPorPrioridade.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1e1b4b', border: '1px solid #3730a3', borderRadius: '8px', color: 'white' }} />
                  <Legend wrapperStyle={{ color: '#94a3b8', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* BarChart Status por Prioridade */}
          <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '20px' }}>
            <h4 style={{ color: 'white', fontSize: '14px', fontWeight: '600', marginBottom: '16px', margin: '0 0 16px 0' }}>Status por Prioridade</h4>
            {bugsPorPrioridadeStatus.length === 0 ? (
              <div style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '40px' }}>Nenhum bug registrado</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={bugsPorPrioridadeStatus}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(139, 92, 246, 0.1)" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#1e1b4b', border: '1px solid #3730a3', borderRadius: '8px', color: 'white' }} />
                  <Bar dataKey="aberto" stackId="a" fill="#ef4444" name="Aberto" />
                  <Bar dataKey="em_andamento" stackId="a" fill="#f59e0b" name="Em andamento" />
                  <Bar dataKey="resolvido" stackId="a" fill="#10b981" name="Resolvido" radius={[4, 4, 0, 0]} />
                  <Legend wrapperStyle={{ color: '#94a3b8', fontSize: '11px' }} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Tempo médio de resolução */}
          <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Clock style={{ width: '32px', height: '32px', color: '#06b6d4', marginBottom: '12px' }} />
            <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0 0 8px 0' }}>Tempo Médio de Resolução</p>
            <p style={{ color: 'white', fontSize: '36px', fontWeight: '700', margin: 0 }}>
              {bugsResolvidos.length > 0 ? tempoMedioResolucao : '—'}
            </p>
            <p style={{ color: '#64748b', fontSize: '12px', margin: '4px 0 0 0' }}>
              {bugsResolvidos.length > 0 ? `dias (${bugsResolvidos.length} resolvidos)` : 'Sem dados'}
            </p>
          </div>
        </div>

        {/* Seção C - Tags de Problema */}
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h4 style={{ color: 'white', fontSize: '14px', fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Tag style={{ width: '16px', height: '16px', color: '#f59e0b' }} />
              Tags de Problema — Top 10
            </h4>
            {todasTags.length > 0 && (
              <div style={{ display: 'flex', gap: '12px' }}>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                  CS: <span style={{ color: '#8b5cf6', fontWeight: '600' }}>{totalTagsCS}</span>
                  {' '}({todasTags.length > 0 ? Math.round((totalTagsCS / todasTags.length) * 100) : 0}%)
                </span>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                  IA: <span style={{ color: '#06b6d4', fontWeight: '600' }}>{totalTagsIA}</span>
                  {' '}({todasTags.length > 0 ? Math.round((totalTagsIA / todasTags.length) * 100) : 0}%)
                </span>
              </div>
            )}
          </div>
          {topTags.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '24px' }}>Nenhuma tag de problema registrada</div>
          ) : (
            <div style={{ display: 'grid', gap: '8px' }}>
              {topTags.map(t => {
                const maxCount = topTags[0]?.count || 1;
                return (
                  <div key={t.tag} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ color: 'white', fontSize: '13px', fontWeight: '500', minWidth: '150px', textAlign: 'right' }}>{t.tag}</span>
                    <div style={{ flex: 1, height: '24px', background: 'rgba(15, 10, 31, 0.5)', borderRadius: '6px', overflow: 'hidden', position: 'relative' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(t.cs / maxCount) * 100}%`, background: '#8b5cf6', transition: 'width 0.3s' }} />
                      <div style={{ position: 'absolute', left: `${(t.cs / maxCount) * 100}%`, top: 0, bottom: 0, width: `${(t.ia / maxCount) * 100}%`, background: '#06b6d4', transition: 'width 0.3s' }} />
                    </div>
                    <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '600', minWidth: '30px' }}>{t.count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Seção D - Clientes Mais Afetados */}
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
          <h4 style={{ color: 'white', fontSize: '14px', fontWeight: '600', marginBottom: '16px', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users style={{ width: '16px', height: '16px', color: '#ef4444' }} />
            Top 10 Clientes Mais Afetados
          </h4>
          {clientesAfetados.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '24px' }}>Nenhum cliente com problemas</div>
          ) : (
            <div style={{ display: 'grid', gap: '6px' }}>
              {clientesAfetados.map(c => (
                <div
                  key={c.id}
                  onClick={() => navigate(`/clientes/${c.id}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '16px',
                    padding: '10px 14px', borderRadius: '10px', cursor: 'pointer',
                    background: 'rgba(15, 10, 31, 0.5)',
                    border: '1px solid rgba(139, 92, 246, 0.08)'
                  }}
                >
                  <span style={{ color: 'white', fontSize: '13px', fontWeight: '500', flex: 1 }}>{c.nome || c.team_name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {c.bugsAbertos > 0 && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#ef4444' }}>
                        <Bug style={{ width: '12px', height: '12px' }} /> {c.bugsAbertos}
                      </span>
                    )}
                    {c.totalTags > 0 && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#f59e0b' }}>
                        <Tag style={{ width: '12px', height: '12px' }} /> {c.totalTags}
                      </span>
                    )}
                    {c.prioridadeMax && (
                      <span style={{
                        padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '600',
                        background: `${PRIORIDADE_COLORS[c.prioridadeMax]}22`,
                        color: PRIORIDADE_COLORS[c.prioridadeMax],
                        textTransform: 'capitalize'
                      }}>{c.prioridadeMax}</span>
                    )}
                    <ExternalLink style={{ width: '12px', height: '12px', color: '#64748b' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Seção E - Bugs Recentes */}
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '20px' }}>
          <h4 style={{ color: 'white', fontSize: '14px', fontWeight: '600', marginBottom: '16px', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bug style={{ width: '16px', height: '16px', color: '#ef4444' }} />
            Bugs Recentes
          </h4>
          {bugsRecentes.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '24px' }}>Nenhum bug registrado</div>
          ) : (
            <div style={{ display: 'grid', gap: '6px', maxHeight: '350px', overflowY: 'auto' }}>
              {bugsRecentes.map((b, i) => (
                <div
                  key={b.id || i}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 14px', borderRadius: '10px',
                    background: 'rgba(15, 10, 31, 0.5)',
                    border: '1px solid rgba(139, 92, 246, 0.08)'
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: 'white', fontSize: '13px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.titulo}</span>
                    </div>
                    <span style={{ color: '#64748b', fontSize: '11px' }}>{b.clienteNome}</span>
                  </div>
                  <span style={{
                    padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '600',
                    background: `${PRIORIDADE_COLORS[b.prioridade]}22`,
                    color: PRIORIDADE_COLORS[b.prioridade],
                    textTransform: 'capitalize', whiteSpace: 'nowrap'
                  }}>{b.prioridade}</span>
                  <span style={{
                    padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: '600',
                    background: `${STATUS_BUG_COLORS[b.status]}22`,
                    color: STATUS_BUG_COLORS[b.status],
                    whiteSpace: 'nowrap'
                  }}>{STATUS_BUG_LABELS[b.status] || b.status}</span>
                  <span style={{ color: '#64748b', fontSize: '11px', whiteSpace: 'nowrap' }}>{formatRelativeDate(b.data)}</span>
                  {b.link_clickup && (
                    <a href={b.link_clickup} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: '#8b5cf6' }}>
                      <ExternalLink style={{ width: '12px', height: '12px' }} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </>
    );
  };

  return (
    <div style={{ padding: '32px', background: '#0f0a1f', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: 'white', margin: '0 0 8px 0' }}>Analytics</h1>
          <p style={{ color: '#94a3b8', margin: 0 }}>Dashboard gerencial completo</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => fetchAllData()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              background: 'rgba(30, 27, 75, 0.4)',
              border: '1px solid rgba(139, 92, 246, 0.15)',
              borderRadius: '12px',
              color: '#94a3b8',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            <RefreshCw style={{ width: '16px', height: '16px' }} />
            Atualizar
          </button>
          <button
            onClick={exportCompleteReport}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            <FileSpreadsheet style={{ width: '18px', height: '18px' }} />
            Excel
          </button>
        </div>
      </div>

      {/* Navegação por Abas */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '8px' }}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 20px',
                background: isActive ? 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)' : 'transparent',
                border: 'none',
                borderRadius: '10px',
                color: isActive ? 'white' : '#94a3b8',
                fontSize: '14px',
                fontWeight: isActive ? '600' : '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                flex: 1
              }}
            >
              <Icon style={{ width: '18px', height: '18px' }} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Filtros Globais */}
      <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter style={{ width: '18px', height: '18px', color: '#8b5cf6' }} />
            <span style={{ color: 'white', fontSize: '14px', fontWeight: '600' }}>Filtros Globais</span>
          </div>
          {hasFilters && (
            <button onClick={clearFilters} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#ef4444', fontSize: '13px', cursor: 'pointer', padding: 0 }}>
              <X style={{ width: '14px', height: '14px' }} />
              Limpar filtros
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: periodo === 'custom' ? '160px 130px 130px 1fr 1fr 1fr 1fr 1fr' : '160px 1fr 1fr 1fr 1fr 1fr', gap: '12px', alignItems: 'end' }}>
          {/* Período */}
          <div>
            <label style={{ display: 'block', color: '#64748b', fontSize: '12px', marginBottom: '8px' }}>Período</label>
            <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} style={{ width: '100%', padding: '10px 14px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: 'white', fontSize: '13px', outline: 'none', cursor: 'pointer' }}>
              <option value="7" style={{ background: '#1e1b4b' }}>Últimos 7 dias</option>
              <option value="15" style={{ background: '#1e1b4b' }}>Últimos 15 dias</option>
              <option value="30" style={{ background: '#1e1b4b' }}>Últimos 30 dias</option>
              <option value="60" style={{ background: '#1e1b4b' }}>Últimos 60 dias</option>
              <option value="90" style={{ background: '#1e1b4b' }}>Últimos 90 dias</option>
              <option value="custom" style={{ background: '#1e1b4b' }}>Personalizado</option>
            </select>
          </div>

          {/* Datas customizadas */}
          {periodo === 'custom' && (
            <>
              <div>
                <label style={{ display: 'block', color: '#64748b', fontSize: '12px', marginBottom: '8px' }}>Início</label>
                <input
                  type="date"
                  value={periodoCustom.inicio}
                  onChange={(e) => setPeriodoCustom(prev => ({ ...prev, inicio: e.target.value }))}
                  style={{ width: '100%', padding: '10px 14px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: 'white', fontSize: '13px', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', color: '#64748b', fontSize: '12px', marginBottom: '8px' }}>Fim</label>
                <input
                  type="date"
                  value={periodoCustom.fim}
                  onChange={(e) => setPeriodoCustom(prev => ({ ...prev, fim: e.target.value }))}
                  style={{ width: '100%', padding: '10px 14px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: 'white', fontSize: '13px', outline: 'none' }}
                />
              </div>
            </>
          )}

          {/* Responsáveis - Dropdown Multiselect */}
          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', color: '#64748b', fontSize: '12px', marginBottom: '8px' }}>
              Responsáveis {responsaveis.length > 0 && <span style={{ color: '#8b5cf6' }}>({responsaveis.length})</span>}
            </label>
            <div
              onClick={() => setShowFilters(showFilters === 'resp' ? false : 'resp')}
              style={{
                padding: '10px 14px',
                background: '#0f0a1f',
                border: '1px solid #3730a3',
                borderRadius: '10px',
                color: responsaveis.length > 0 ? 'white' : '#64748b',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {responsaveis.length === 0 ? 'Todos' : responsaveis.length === 1 ? responsaveis[0] : `${responsaveis.length} selecionados`}
              </span>
              <ChevronDown style={{ width: '16px', height: '16px', color: '#64748b', flexShrink: 0 }} />
            </div>
            {showFilters === 'resp' && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: '#1e1b4b', border: '1px solid #3730a3', borderRadius: '10px', zIndex: 50, maxHeight: '200px', overflowY: 'auto' }}>
                {responsaveisDisponiveis.map(r => (
                  <div
                    key={r}
                    onClick={(e) => { e.stopPropagation(); toggleResponsavel(r); }}
                    style={{
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      cursor: 'pointer',
                      background: responsaveis.includes(r) ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                      borderBottom: '1px solid rgba(139, 92, 246, 0.1)'
                    }}
                  >
                    <div style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '4px',
                      border: responsaveis.includes(r) ? '2px solid #8b5cf6' : '2px solid #64748b',
                      background: responsaveis.includes(r) ? '#8b5cf6' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {responsaveis.includes(r) && <span style={{ color: 'white', fontSize: '10px', fontWeight: 'bold' }}>✓</span>}
                    </div>
                    <span style={{ color: 'white', fontSize: '13px' }}>{r}</span>
                  </div>
                ))}
                {responsaveisDisponiveis.length === 0 && (
                  <div style={{ padding: '10px 14px', color: '#64748b', fontSize: '13px' }}>Nenhum responsável</div>
                )}
              </div>
            )}
          </div>

          {/* Tipos de Time - Dropdown Multiselect */}
          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', color: '#64748b', fontSize: '12px', marginBottom: '8px' }}>
              Tipo de Time {teamTypes.length > 0 && <span style={{ color: '#06b6d4' }}>({teamTypes.length})</span>}
            </label>
            <div
              onClick={() => setShowFilters(showFilters === 'type' ? false : 'type')}
              style={{
                padding: '10px 14px',
                background: '#0f0a1f',
                border: '1px solid #3730a3',
                borderRadius: '10px',
                color: teamTypes.length > 0 ? 'white' : '#64748b',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
                {teamTypes.length === 0 ? 'Todos' : teamTypes.length === 1 ? teamTypes[0] : `${teamTypes.length} selecionados`}
              </span>
              <ChevronDown style={{ width: '16px', height: '16px', color: '#64748b', flexShrink: 0 }} />
            </div>
            {showFilters === 'type' && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: '#1e1b4b', border: '1px solid #3730a3', borderRadius: '10px', zIndex: 50, maxHeight: '200px', overflowY: 'auto' }}>
                {teamTypesDisponiveis.map(t => (
                  <div
                    key={t}
                    onClick={(e) => { e.stopPropagation(); toggleTeamType(t); }}
                    style={{
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      cursor: 'pointer',
                      background: teamTypes.includes(t) ? 'rgba(6, 182, 212, 0.2)' : 'transparent',
                      borderBottom: '1px solid rgba(139, 92, 246, 0.1)'
                    }}
                  >
                    <div style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '4px',
                      border: teamTypes.includes(t) ? '2px solid #06b6d4' : '2px solid #64748b',
                      background: teamTypes.includes(t) ? '#06b6d4' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {teamTypes.includes(t) && <span style={{ color: 'white', fontSize: '10px', fontWeight: 'bold' }}>✓</span>}
                    </div>
                    <span style={{ color: 'white', fontSize: '13px', textTransform: 'capitalize' }}>{t}</span>
                  </div>
                ))}
                {teamTypesDisponiveis.length === 0 && (
                  <div style={{ padding: '10px 14px', color: '#64748b', fontSize: '13px' }}>Nenhum tipo</div>
                )}
              </div>
            )}
          </div>

          {/* Área de Atuação - Dropdown Multiselect */}
          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', color: '#64748b', fontSize: '12px', marginBottom: '8px' }}>
              Área {filterArea.length > 0 && <span style={{ color: '#10b981' }}>({filterArea.length})</span>}
            </label>
            <div
              onClick={() => setShowFilters(showFilters === 'area' ? false : 'area')}
              style={{
                padding: '10px 14px',
                background: '#0f0a1f',
                border: '1px solid #3730a3',
                borderRadius: '10px',
                color: filterArea.length > 0 ? 'white' : '#64748b',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {filterArea.length === 0 ? 'Todas' : filterArea.length === 1 ? getAreaLabel(filterArea[0]) : `${filterArea.length} selecionadas`}
              </span>
              <ChevronDown style={{ width: '16px', height: '16px', color: '#64748b', flexShrink: 0 }} />
            </div>
            {showFilters === 'area' && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: '#1e1b4b', border: '1px solid #3730a3', borderRadius: '10px', zIndex: 50, maxHeight: '200px', overflowY: 'auto' }}>
                {areasDisponiveis.map(a => (
                  <div
                    key={a.value}
                    onClick={(e) => { e.stopPropagation(); toggleArea(a.value); }}
                    style={{
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      cursor: 'pointer',
                      background: filterArea.includes(a.value) ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                      borderBottom: '1px solid rgba(139, 92, 246, 0.1)'
                    }}
                  >
                    <div style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '4px',
                      border: filterArea.includes(a.value) ? '2px solid #10b981' : '2px solid #64748b',
                      background: filterArea.includes(a.value) ? '#10b981' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {filterArea.includes(a.value) && <span style={{ color: 'white', fontSize: '10px', fontWeight: 'bold' }}>✓</span>}
                    </div>
                    <span style={{ color: 'white', fontSize: '13px' }}>{a.label}</span>
                  </div>
                ))}
                {areasDisponiveis.length === 0 && (
                  <div style={{ padding: '10px 14px', color: '#64748b', fontSize: '13px' }}>Nenhuma área</div>
                )}
              </div>
            )}
          </div>

          {/* Saúde - Dropdown Multiselect */}
          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', color: '#64748b', fontSize: '12px', marginBottom: '8px' }}>
              Saúde {filterSaude.length > 0 && <span style={{ color: '#10b981' }}>({filterSaude.length})</span>}
            </label>
            <div
              onClick={() => setShowFilters(showFilters === 'saude' ? false : 'saude')}
              style={{
                padding: '10px 14px',
                background: '#0f0a1f',
                border: '1px solid #3730a3',
                borderRadius: '10px',
                color: filterSaude.length > 0 ? 'white' : '#64748b',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {filterSaude.length === 0 ? 'Todas' : filterSaude.length === 1 ? getSegmentoLabel(filterSaude[0]) : `${filterSaude.length} selecionadas`}
              </span>
              <ChevronDown style={{ width: '16px', height: '16px', color: '#64748b', flexShrink: 0 }} />
            </div>
            {showFilters === 'saude' && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: '#1e1b4b', border: '1px solid #3730a3', borderRadius: '10px', zIndex: 50, maxHeight: '200px', overflowY: 'auto' }}>
                {['CRESCIMENTO', 'ESTAVEL', 'ALERTA', 'RESGATE'].map(s => (
                  <div
                    key={s}
                    onClick={(e) => { e.stopPropagation(); toggleSaude(s); }}
                    style={{
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      cursor: 'pointer',
                      background: filterSaude.includes(s) ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                      borderBottom: '1px solid rgba(139, 92, 246, 0.1)'
                    }}
                  >
                    <div style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '4px',
                      border: filterSaude.includes(s) ? `2px solid ${getSegmentoColor(s)}` : '2px solid #64748b',
                      background: filterSaude.includes(s) ? getSegmentoColor(s) : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {filterSaude.includes(s) && <span style={{ color: 'white', fontSize: '10px', fontWeight: 'bold' }}>✓</span>}
                    </div>
                    <span style={{ color: 'white', fontSize: '13px' }}>{getSegmentoLabel(s)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status - Dropdown Multiselect */}
          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', color: '#64748b', fontSize: '12px', marginBottom: '8px' }}>
              Status {filterStatus.length > 0 && <span style={{ color: '#f59e0b' }}>({filterStatus.length})</span>}
            </label>
            <div
              onClick={() => setShowFilters(showFilters === 'status' ? false : 'status')}
              style={{
                padding: '10px 14px',
                background: '#0f0a1f',
                border: '1px solid #3730a3',
                borderRadius: '10px',
                color: filterStatus.length > 0 ? 'white' : '#64748b',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {filterStatus.length === 0 ? 'Ativo + Aviso' : filterStatus.length === 1 ? filterStatus[0].replace('_', ' ') : `${filterStatus.length} selecionados`}
              </span>
              <ChevronDown style={{ width: '16px', height: '16px', color: '#64748b', flexShrink: 0 }} />
            </div>
            {showFilters === 'status' && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: '#1e1b4b', border: '1px solid #3730a3', borderRadius: '10px', zIndex: 50, maxHeight: '200px', overflowY: 'auto' }}>
                {[
                  { value: 'ativo', label: 'Ativo', color: '#10b981' },
                  { value: 'aviso_previo', label: 'Aviso Prévio', color: '#f59e0b' },
                  { value: 'inativo', label: 'Inativo', color: '#64748b' },
                  { value: 'cancelado', label: 'Cancelado', color: '#ef4444' }
                ].map(s => (
                  <div
                    key={s.value}
                    onClick={(e) => { e.stopPropagation(); toggleStatus(s.value); }}
                    style={{
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      cursor: 'pointer',
                      background: filterStatus.includes(s.value) ? `${s.color}33` : 'transparent',
                      borderBottom: '1px solid rgba(139, 92, 246, 0.1)'
                    }}
                  >
                    <div style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '4px',
                      border: filterStatus.includes(s.value) ? `2px solid ${s.color}` : '2px solid #64748b',
                      background: filterStatus.includes(s.value) ? s.color : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {filterStatus.includes(s.value) && <span style={{ color: 'white', fontSize: '10px', fontWeight: 'bold' }}>✓</span>}
                    </div>
                    <span style={{ color: 'white', fontSize: '13px' }}>{s.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Conteúdo da Aba Ativa */}
      <div ref={contentRef}>
        {activeTab === 'engajamento' && renderTabEngajamento()}
        {activeTab === 'usuarios' && renderTabUsuarios()}
        {activeTab === 'churn' && renderTabChurn()}
        {activeTab === 'inativos' && renderTabInativos()}
        {activeTab === 'sazonalidade' && renderTabSazonalidade()}
        {activeTab === 'problemas' && renderTabProblemas()}
      </div>
    </div>
  );
}
