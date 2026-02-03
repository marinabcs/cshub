// Analytics - Dashboard Gerencial Completo com Abas
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import * as XLSX from 'xlsx';
import {
  BarChart3, Users, TrendingUp, AlertTriangle, MessageSquare,
  Download, Filter, X, ChevronDown, Activity, Clock,
  ExternalLink, FileSpreadsheet, RefreshCw, Monitor, UserCheck,
  DollarSign, ShieldAlert, Star, Zap, Award, Target, ArrowUpRight,
  ArrowDownRight, Mail, Phone
} from 'lucide-react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, Area, AreaChart
} from 'recharts';
import { SEGMENTOS_CS, getClienteSegmento, getSegmentoColor, getSegmentoLabel } from '../utils/segmentoCS';
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
  onboarding: '#3B82F6',
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
  { id: 'inativos', label: 'Inativos', icon: Clock }
];

export default function Analytics() {
  const navigate = useNavigate();
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
  const [showFilters, setShowFilters] = useState(null); // 'resp' | 'type' | null

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

      // OTIMIZAÇÃO: Executar queries principais em PARALELO
      const [
        clientesSnapshot,
        alertasSnapshot,
        threadsSnapshot,
        usuariosSnapshot,
        metricasSnapshot
      ] = await Promise.all([
        getDocs(collection(db, 'clientes')),
        getDocs(collection(db, 'alertas')),
        // Usar collection raiz 'threads' ao invés de subcollections (muito mais rápido!)
        getDocs(query(collection(db, 'threads'), orderBy('updated_at', 'desc'))),
        getDocs(collection(db, 'usuarios_sistema')),
        // Limitar metricas aos últimos 90 dias
        getDocs(query(collection(db, 'metricas_diarias'), where('data', '>=', dataLimite)))
      ]);

      // Processar clientes
      const clientesData = clientesSnapshot.docs.map(d => ({
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
          clienteNome: cliente?.team_name,
          responsavel: cliente?.responsavel_nome,
          _teamId: data.team_id,
          ...data
        };
      });
      setThreads(allThreads);

      // Processar usuarios
      const usuariosData = usuariosSnapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      setUsuarios(usuariosData);

      // Processar metricas
      const metricasData = metricasSnapshot.docs.map(d => ({
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
    diasAtras.setDate(diasAtras.getDate() - parseInt(periodo));
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
      : parseInt(periodo);
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

  // Clientes ativos filtrados (exclui inativos/cancelados das métricas principais)
  const clientesFiltrados = useMemo(() => {
    return clientes.filter(c => {
      // Excluir inativos/cancelados das métricas principais
      if (c.status === 'inativo' || c.status === 'cancelado') return false;
      const matchesResponsavel = responsaveis.length === 0 || responsaveis.includes(c.responsavel_nome);
      const matchesType = clienteMatchesTipos(c.team_type, teamTypes);
      return matchesResponsavel && matchesType;
    });
  }, [clientes, responsaveis, teamTypes]);

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

  // Threads filtradas por período (exclui inativos/cancelados)
  const threadsFiltradas = useMemo(() => {
    const dataLimite = getDataDoPeriodo();
    const dataFim = getDataFimPeriodo();
    return threads.filter(t => {
      const threadDate = t.created_at?.toDate ? t.created_at.toDate() : new Date(t.created_at);
      const matchesPeriodo = threadDate >= dataLimite && threadDate <= dataFim;
      const cliente = clientes.find(c => c.id === t.clienteId);
      // Excluir threads de clientes inativos/cancelados
      if (cliente?.status === 'inativo' || cliente?.status === 'cancelado') return false;
      const matchesResponsavel = responsaveis.length === 0 || responsaveis.includes(cliente?.responsavel_nome);
      const matchesType = clienteMatchesTipos(cliente?.team_type, teamTypes);
      return matchesPeriodo && matchesResponsavel && matchesType;
    });
  }, [threads, clientes, periodo, periodoCustom, responsaveis, teamTypes]);

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

  // Alertas filtrados (exclui inativos/cancelados)
  const alertasFiltrados = useMemo(() => {
    const dataLimite = getDataDoPeriodo();
    const dataFim = getDataFimPeriodo();
    return alertas.filter(a => {
      const alertaDate = a.created_at?.toDate ? a.created_at.toDate() : new Date(a.created_at);
      const matchesPeriodo = alertaDate >= dataLimite && alertaDate <= dataFim;
      const cliente = clientes.find(c => c.id === a.cliente_id);
      // Excluir alertas de clientes inativos/cancelados
      if (cliente?.status === 'inativo' || cliente?.status === 'cancelado') return false;
      const matchesResponsavel = responsaveis.length === 0 || responsaveis.includes(cliente?.responsavel_nome);
      const matchesType = clienteMatchesTipos(cliente?.team_type, teamTypes);
      return matchesPeriodo && matchesResponsavel && matchesType;
    });
  }, [alertas, clientes, periodo, periodoCustom, responsaveis, teamTypes]);

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

    // Calcular variação percentual
    const variacaoThreads = totalThreadsAnterior > 0
      ? Math.round(((totalThreads - totalThreadsAnterior) / totalThreadsAnterior) * 100)
      : 0;

    return { clientesAtivos, totalTimes, totalThreads, alertasPendentes, segmentoCounts, variacaoThreads };
  }, [clientesFiltrados, threadsFiltradas, threadsPeriodoAnterior, alertasFiltrados]);

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
      ativo: clientesFiltrados.filter(c => c.status === 'ativo' || !c.status).length,
      onboarding: clientesFiltrados.filter(c => c.status === 'onboarding').length,
      aviso_previo: clientesFiltrados.filter(c => c.status === 'aviso_previo').length,
      inativo: clientesFiltrados.filter(c => c.status === 'inativo').length,
      cancelado: clientesFiltrados.filter(c => c.status === 'cancelado').length
    };

    return [
      { name: 'Ativos', value: counts.ativo, color: STATUS_CLIENTE_COLORS.ativo },
      { name: 'Em Onboarding', value: counts.onboarding, color: STATUS_CLIENTE_COLORS.onboarding },
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
          nome: cliente?.team_name || teamId,
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
          clienteNome: cliente?.team_name || '-',
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
  const exportToExcel = (sectionName, data) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sectionName);
    XLSX.writeFile(wb, `${sectionName}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportCompleteReport = () => {
    const wb = XLSX.utils.book_new();

    // Aba Resumo
    const resumoData = [{
      'Total Clientes': visaoGeral.clientesAtivos,
      'Total Times': visaoGeral.totalTimes,
      'Threads (período)': visaoGeral.totalThreads,
      'Alertas Pendentes': visaoGeral.alertasPendentes,
      'Seg. Crescimento': visaoGeral.segmentoCounts.CRESCIMENTO,
      'Seg. Estável': visaoGeral.segmentoCounts.ESTAVEL,
      'Seg. Alerta': visaoGeral.segmentoCounts.ALERTA,
      'Seg. Resgate': visaoGeral.segmentoCounts.RESGATE
    }];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumoData), 'Resumo');

    // Aba Clientes
    const clientesExport = clientesFiltrados.map(c => ({
      'Nome': c.team_name,
      'Tipo': c.team_type || '-',
      'Status': c.status || 'ativo',
      'Responsável': c.responsavel_nome || '-',
      'Segmento': getSegmentoLabel(getClienteSegmento(c))
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clientesExport), 'Clientes');

    // Aba Times em Risco
    const riscoExport = timesEmRisco.map(c => ({
      'Nome': c.team_name,
      'Segmento': getSegmentoLabel(getClienteSegmento(c)),
      'Responsável': c.responsavel_nome || '-'
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(riscoExport), 'Times em Risco');

    // Aba Threads
    const threadsExport = threadsFiltradas.map(t => ({
      'Cliente': t.clienteNome,
      'Assunto': t.subject || '-',
      'Categoria': t.categoria || '-',
      'Sentimento': t.sentimento || '-',
      'Status': t.status || '-',
      'Data': t.created_at?.toDate ? t.created_at.toDate().toLocaleDateString('pt-BR') : '-'
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(threadsExport), 'Threads');

    // Aba Alertas
    const alertasExport = alertasFiltrados.map(a => ({
      'Tipo': a.tipo || '-',
      'Descrição': a.descricao || '-',
      'Status': a.status || '-',
      'Prioridade': a.prioridade || '-',
      'Data': a.created_at?.toDate ? a.created_at.toDate().toLocaleDateString('pt-BR') : '-'
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(alertasExport), 'Alertas');

    // Aba Performance por Responsável
    const perfExport = performancePorResponsavel.map(p => ({
      'Responsável': p.nome,
      'Qtd Clientes': p.qtdClientes,
      'Seg. Crescimento': p.segmentos.CRESCIMENTO,
      'Seg. Estável': p.segmentos.ESTAVEL,
      'Seg. Alerta': p.segmentos.ALERTA,
      'Seg. Resgate': p.segmentos.RESGATE,
      'Alertas Pendentes': p.alertasPendentes,
      'Threads Aguardando': p.threadsAguardando
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(perfExport), 'Performance');

    XLSX.writeFile(wb, `relatorio_completo_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const clearFilters = () => {
    setPeriodo('30');
    setPeriodoCustom({ inicio: '', fim: '' });
    setResponsaveisFilter([]);
    setTeamTypesFilter([]);
    setShowFilters(null);
  };

  const hasFilters = periodo !== '30' || responsaveis.length > 0 || teamTypes.length > 0;

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
              <p style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{metricasUsoPlataforma.totalLogins}</p>
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
              <p style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{metricasUsoPlataforma.totalPecasCriadas}</p>
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
              <p style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{metricasUsoPlataforma.totalUsoAI}</p>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {topClientesEngajados.map((cliente, index) => (
              <div key={cliente.id} onClick={() => navigate(`/clientes/${cliente.id}`)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '10px', cursor: 'pointer', border: '1px solid rgba(139, 92, 246, 0.1)' }}>
                <span style={{ width: '28px', height: '28px', background: index < 3 ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'rgba(139, 92, 246, 0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '12px', fontWeight: '700' }}>
                  {index + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: 'white', fontSize: '13px', fontWeight: '500', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cliente.team_name}</p>
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
                    <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: 0 }}>{cliente.team_name}</p>
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
          <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0 0 16px 0' }}>Clientes no segmento Crescimento (prontos para expansao)</p>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {vendasData.oportunidadesUpsell.map((cliente, index) => (
              <div key={cliente.id} onClick={() => navigate(`/clientes/${cliente.id}`)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '10px', marginBottom: '8px', cursor: 'pointer', transition: 'all 0.2s ease' }}>
                <div>
                  <p style={{ color: 'white', fontSize: '13px', fontWeight: '500', margin: 0 }}>{cliente.team_name}</p>
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
          <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0 0 16px 0' }}>Clientes nos segmentos Crescimento ou Estavel com uso crescente</p>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {vendasData.clientesEmCrescimento.map((cliente, index) => (
              <div key={cliente.id} onClick={() => navigate(`/clientes/${cliente.id}`)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '10px', marginBottom: '8px', cursor: 'pointer', transition: 'all 0.2s ease' }}>
                <div>
                  <p style={{ color: 'white', fontSize: '13px', fontWeight: '500', margin: 0 }}>{cliente.team_name}</p>
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
          <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: '0 0 16px 0' }}>Distribuicao por Segmento CS</h3>
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
          <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: '0 0 16px 0' }}>Distribuicao por Segmento</h3>
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
                    <p style={{ color: 'white', fontSize: '13px', fontWeight: '500', margin: 0 }}>{cliente.team_name}</p>
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
                {cliente.team_name}
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
            Exportar Relatório
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

        <div style={{ display: 'grid', gridTemplateColumns: periodo === 'custom' ? '180px 150px 150px 1fr 1fr' : '180px 1fr 1fr', gap: '16px', alignItems: 'end' }}>
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
        </div>
      </div>

      {/* Conteúdo da Aba Ativa */}
      {activeTab === 'engajamento' && renderTabEngajamento()}
      {activeTab === 'usuarios' && renderTabUsuarios()}
      {activeTab === 'churn' && renderTabChurn()}
      {activeTab === 'inativos' && renderTabInativos()}
    </div>
  );
}
