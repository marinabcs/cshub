// Analytics - Dashboard Gerencial Completo
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';
import * as XLSX from 'xlsx';
import {
  BarChart3, Users, TrendingUp, AlertTriangle, MessageSquare,
  Download, Filter, X, ChevronDown, Activity, Clock,
  ExternalLink, FileSpreadsheet, RefreshCw
} from 'lucide-react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, Area, AreaChart
} from 'recharts';

const STATUS_COLORS = {
  saudavel: '#10B981',
  atencao: '#F59E0B',
  risco: '#f97316',
  critico: '#EF4444'
};

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

export default function Analytics() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [threads, setThreads] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros globais
  const [periodo, setPeriodo] = useState('30');
  const [responsavel, setResponsavel] = useState('todos');
  const [teamType, setTeamType] = useState('todos');
  const [showFilters, setShowFilters] = useState(false);

  // Dados de tendência
  const [tendenciaData, setTendenciaData] = useState([]);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      // Fetch clientes
      const clientesSnapshot = await getDocs(collection(db, 'clientes'));
      const clientesData = clientesSnapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      setClientes(clientesData);

      // Fetch alertas
      const alertasSnapshot = await getDocs(collection(db, 'alertas'));
      const alertasData = alertasSnapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      setAlertas(alertasData);

      // Fetch threads from all clientes (usando times/{teamId}/threads)
      const allThreads = [];
      for (const cliente of clientesData) {
        const teamIds = cliente.times || [];
        for (const teamId of teamIds) {
          try {
            const threadsRef = collection(db, 'times', teamId, 'threads');
            const threadsSnapshot = await getDocs(threadsRef);
            threadsSnapshot.docs.forEach(doc => {
              allThreads.push({
                id: doc.id,
                clienteId: cliente.id,
                clienteNome: cliente.team_name,
                responsavel: cliente.responsavel_nome,
                _teamId: teamId,
                ...doc.data()
              });
            });
          } catch (e) {
            // Ignore errors for individual teams
          }
        }
      }
      setThreads(allThreads);

      // Fetch usuarios
      const usuariosSnapshot = await getDocs(collection(db, 'usuarios_sistema'));
      const usuariosData = usuariosSnapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      setUsuarios(usuariosData);

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

  // Filtrar dados por período
  const getDataDoPeriodo = () => {
    const hoje = new Date();
    const diasAtras = new Date(hoje);
    diasAtras.setDate(diasAtras.getDate() - parseInt(periodo));
    return diasAtras;
  };

  // Clientes filtrados
  const clientesFiltrados = useMemo(() => {
    return clientes.filter(c => {
      const matchesResponsavel = responsavel === 'todos' || c.responsavel_nome === responsavel;
      const matchesType = teamType === 'todos' || c.team_type === teamType;
      return matchesResponsavel && matchesType;
    });
  }, [clientes, responsavel, teamType]);

  // Threads filtradas por período
  const threadsFiltradas = useMemo(() => {
    const dataLimite = getDataDoPeriodo();
    return threads.filter(t => {
      const threadDate = t.created_at?.toDate ? t.created_at.toDate() : new Date(t.created_at);
      const matchesPeriodo = threadDate >= dataLimite;
      const cliente = clientes.find(c => c.id === t.clienteId);
      const matchesResponsavel = responsavel === 'todos' || cliente?.responsavel_nome === responsavel;
      const matchesType = teamType === 'todos' || cliente?.team_type === teamType;
      return matchesPeriodo && matchesResponsavel && matchesType;
    });
  }, [threads, clientes, periodo, responsavel, teamType]);

  // Alertas filtrados
  const alertasFiltrados = useMemo(() => {
    const dataLimite = getDataDoPeriodo();
    return alertas.filter(a => {
      const alertaDate = a.created_at?.toDate ? a.created_at.toDate() : new Date(a.created_at);
      const matchesPeriodo = alertaDate >= dataLimite;
      const cliente = clientes.find(c => c.id === a.cliente_id);
      const matchesResponsavel = responsavel === 'todos' || cliente?.responsavel_nome === responsavel;
      const matchesType = teamType === 'todos' || cliente?.team_type === teamType;
      return matchesPeriodo && matchesResponsavel && matchesType;
    });
  }, [alertas, clientes, periodo, responsavel, teamType]);

  // Lista de responsáveis
  const responsaveis = useMemo(() => {
    return [...new Set(clientes.map(c => c.responsavel_nome).filter(Boolean))];
  }, [clientes]);

  // Lista de tipos
  const teamTypes = useMemo(() => {
    return [...new Set(clientes.map(c => c.team_type).filter(Boolean))];
  }, [clientes]);

  // ========== SEÇÃO 1: VISÃO GERAL ==========
  const visaoGeral = useMemo(() => {
    const clientesAtivos = clientesFiltrados.filter(c => c.status === 'ativo' || !c.status).length;
    const totalTimes = clientesFiltrados.length;
    const totalThreads = threadsFiltradas.length;
    const alertasPendentes = alertasFiltrados.filter(a => a.status === 'pendente').length;
    const healthScoreTotal = clientesFiltrados.reduce((sum, c) => sum + (c.health_score || 0), 0);
    const healthScoreMedio = clientesFiltrados.length > 0 ? Math.round(healthScoreTotal / clientesFiltrados.length) : 0;

    return { clientesAtivos, totalTimes, totalThreads, alertasPendentes, healthScoreMedio };
  }, [clientesFiltrados, threadsFiltradas, alertasFiltrados]);

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

  // ========== SEÇÃO 3: DISTRIBUIÇÃO POR HEALTH SCORE ==========
  const healthScoreData = useMemo(() => {
    const faixas = {
      saudavel: clientesFiltrados.filter(c => (c.health_score || 0) >= 80).length,
      atencao: clientesFiltrados.filter(c => (c.health_score || 0) >= 60 && (c.health_score || 0) < 80).length,
      risco: clientesFiltrados.filter(c => (c.health_score || 0) >= 40 && (c.health_score || 0) < 60).length,
      critico: clientesFiltrados.filter(c => (c.health_score || 0) < 40).length
    };

    return [
      { name: 'Saudável (80-100)', value: faixas.saudavel, color: STATUS_COLORS.saudavel },
      { name: 'Atenção (60-79)', value: faixas.atencao, color: STATUS_COLORS.atencao },
      { name: 'Risco (40-59)', value: faixas.risco, color: STATUS_COLORS.risco },
      { name: 'Crítico (0-39)', value: faixas.critico, color: STATUS_COLORS.critico }
    ].filter(d => d.value > 0);
  }, [clientesFiltrados]);

  // ========== SEÇÃO 4: TIMES EM RISCO ==========
  const timesEmRisco = useMemo(() => {
    return clientesFiltrados
      .filter(c => c.health_status === 'risco' || c.health_status === 'critico')
      .sort((a, b) => (a.health_score || 0) - (b.health_score || 0))
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
          healthScoreTotal: 0,
          alertasPendentes: 0,
          threadsAguardando: 0
        };
      }
      responsaveisMap[resp].qtdClientes++;
      responsaveisMap[resp].healthScoreTotal += cliente.health_score || 0;
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

    return Object.values(responsaveisMap).map(r => ({
      ...r,
      healthScoreMedio: r.qtdClientes > 0 ? Math.round(r.healthScoreTotal / r.qtdClientes) : 0
    })).sort((a, b) => b.qtdClientes - a.qtdClientes);
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
      'Health Score Médio': visaoGeral.healthScoreMedio
    }];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumoData), 'Resumo');

    // Aba Clientes
    const clientesExport = clientesFiltrados.map(c => ({
      'Nome': c.team_name,
      'Tipo': c.team_type || '-',
      'Status': c.status || 'ativo',
      'Responsável': c.responsavel_nome || '-',
      'Health Score': c.health_score || 0,
      'Health Status': c.health_status || '-'
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clientesExport), 'Clientes');

    // Aba Times em Risco
    const riscoExport = timesEmRisco.map(c => ({
      'Nome': c.team_name,
      'Health Score': c.health_score || 0,
      'Health Status': c.health_status,
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
      'Health Score Médio': p.healthScoreMedio,
      'Alertas Pendentes': p.alertasPendentes,
      'Threads Aguardando': p.threadsAguardando
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(perfExport), 'Performance');

    XLSX.writeFile(wb, `relatorio_completo_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const getHealthColor = (status) => STATUS_COLORS[status] || '#64748b';
  const getHealthLabel = (status) => {
    const labels = { saudavel: 'Saudável', atencao: 'Atenção', risco: 'Risco', critico: 'Crítico' };
    return labels[status] || status;
  };

  const clearFilters = () => {
    setPeriodo('30');
    setResponsavel('todos');
    setTeamType('todos');
  };

  const hasFilters = periodo !== '30' || responsavel !== 'todos' || teamType !== 'todos';

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f0a1f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '48px', height: '48px', border: '3px solid rgba(139, 92, 246, 0.2)', borderTopColor: '#8b5cf6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      </div>
    );
  }

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
            Exportar Relatório Completo
          </button>
        </div>
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {/* Período */}
          <div>
            <label style={{ display: 'block', color: '#64748b', fontSize: '12px', marginBottom: '8px' }}>Período</label>
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: 'white', fontSize: '13px', outline: 'none', cursor: 'pointer' }}
            >
              <option value="7" style={{ background: '#1e1b4b' }}>Últimos 7 dias</option>
              <option value="30" style={{ background: '#1e1b4b' }}>Últimos 30 dias</option>
              <option value="90" style={{ background: '#1e1b4b' }}>Últimos 90 dias</option>
              <option value="365" style={{ background: '#1e1b4b' }}>Último ano</option>
            </select>
          </div>

          {/* Responsável */}
          <div>
            <label style={{ display: 'block', color: '#64748b', fontSize: '12px', marginBottom: '8px' }}>Responsável</label>
            <select
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: 'white', fontSize: '13px', outline: 'none', cursor: 'pointer' }}
            >
              <option value="todos" style={{ background: '#1e1b4b' }}>Todos</option>
              {responsaveis.map(r => (
                <option key={r} value={r} style={{ background: '#1e1b4b' }}>{r}</option>
              ))}
            </select>
          </div>

          {/* Team Type */}
          <div>
            <label style={{ display: 'block', color: '#64748b', fontSize: '12px', marginBottom: '8px' }}>Tipo de Time</label>
            <select
              value={teamType}
              onChange={(e) => setTeamType(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: 'white', fontSize: '13px', outline: 'none', cursor: 'pointer' }}
            >
              <option value="todos" style={{ background: '#1e1b4b' }}>Todos</option>
              {teamTypes.map(t => (
                <option key={t} value={t} style={{ background: '#1e1b4b' }}>{t}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* SEÇÃO 1: Visão Geral - Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users style={{ width: '22px', height: '22px', color: 'white' }} />
            </div>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Clientes Ativos</p>
              <p style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{visaoGeral.clientesAtivos}</p>
            </div>
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)', border: '1px solid rgba(6, 182, 212, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users style={{ width: '22px', height: '22px', color: 'white' }} />
            </div>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Total Times</p>
              <p style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{visaoGeral.totalTimes}</p>
            </div>
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MessageSquare style={{ width: '22px', height: '22px', color: 'white' }} />
            </div>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Threads ({periodo}d)</p>
              <p style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{visaoGeral.totalThreads}</p>
            </div>
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)', border: '1px solid rgba(249, 115, 22, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertTriangle style={{ width: '22px', height: '22px', color: 'white' }} />
            </div>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Alertas Pendentes</p>
              <p style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{visaoGeral.alertasPendentes}</p>
            </div>
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #3B82F6 0%, #2563eb 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity style={{ width: '22px', height: '22px', color: 'white' }} />
            </div>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Health Score Médio</p>
              <p style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{visaoGeral.healthScoreMedio}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* SEÇÃO 2 e 3: Distribuições */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* Distribuição por Status do Cliente */}
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: 0 }}>Distribuição por Status</h3>
            <button
              onClick={() => exportToExcel('Status_Cliente', statusClienteData)}
              style={{ background: 'none', border: 'none', color: '#8b5cf6', cursor: 'pointer', padding: '4px' }}
              title="Exportar Excel"
            >
              <Download style={{ width: '16px', height: '16px' }} />
            </button>
          </div>
          {statusClienteData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={statusClienteData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {statusClienteData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'rgba(15, 10, 31, 0.95)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '8px' }}
                  itemStyle={{ color: 'white' }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value) => <span style={{ color: '#94a3b8', fontSize: '12px' }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>Sem dados</div>
          )}
        </div>

        {/* Distribuição por Health Score */}
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: 0 }}>Distribuição por Health Score</h3>
            <button
              onClick={() => exportToExcel('Health_Score', healthScoreData)}
              style={{ background: 'none', border: 'none', color: '#8b5cf6', cursor: 'pointer', padding: '4px' }}
              title="Exportar Excel"
            >
              <Download style={{ width: '16px', height: '16px' }} />
            </button>
          </div>
          {healthScoreData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={healthScoreData} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(139, 92, 246, 0.1)" horizontal={true} vertical={false} />
                <XAxis type="number" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} width={100} />
                <Tooltip
                  contentStyle={{ background: 'rgba(15, 10, 31, 0.95)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '8px' }}
                  itemStyle={{ color: 'white' }}
                />
                <Bar dataKey="value" name="Clientes" radius={[0, 4, 4, 0]}>
                  {healthScoreData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>Sem dados</div>
          )}
        </div>
      </div>

      {/* SEÇÃO 4: Times em Risco */}
      <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertTriangle style={{ width: '20px', height: '20px', color: '#ef4444' }} />
            <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: 0 }}>Times em Risco</h3>
            <span style={{ padding: '4px 10px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', borderRadius: '6px', fontSize: '12px', fontWeight: '500' }}>
              {timesEmRisco.length}
            </span>
          </div>
          <button
            onClick={() => exportToExcel('Times_Risco', timesEmRisco.map(t => ({
              Nome: t.team_name,
              'Health Score': t.health_score,
              Status: t.health_status,
              Responsável: t.responsavel_nome
            })))}
            style={{ background: 'none', border: 'none', color: '#8b5cf6', cursor: 'pointer', padding: '4px' }}
            title="Exportar Excel"
          >
            <Download style={{ width: '16px', height: '16px' }} />
          </button>
        </div>

        {timesEmRisco.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
            {timesEmRisco.map(time => (
              <div
                key={time.id}
                onClick={() => navigate(`/clientes/${time.id}`)}
                style={{
                  background: 'rgba(15, 10, 31, 0.6)',
                  border: `1px solid ${getHealthColor(time.health_status)}30`,
                  borderRadius: '12px',
                  padding: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{
                    width: '32px',
                    height: '32px',
                    background: `${getHealthColor(time.health_status)}20`,
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: getHealthColor(time.health_status),
                    fontSize: '14px',
                    fontWeight: '600'
                  }}>
                    {time.health_score || 0}
                  </span>
                  <ExternalLink style={{ width: '14px', height: '14px', color: '#64748b' }} />
                </div>
                <p style={{ color: 'white', fontSize: '13px', fontWeight: '500', margin: '0 0 4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {time.team_name}
                </p>
                <span style={{
                  padding: '2px 8px',
                  background: `${getHealthColor(time.health_status)}20`,
                  color: getHealthColor(time.health_status),
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: '500'
                }}>
                  {getHealthLabel(time.health_status)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
            <TrendingUp style={{ width: '32px', height: '32px', margin: '0 auto 8px', color: '#10b981' }} />
            <p>Nenhum time em situação de risco</p>
          </div>
        )}
      </div>

      {/* SEÇÃO 5: Performance por Responsável */}
      <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', overflow: 'hidden', marginBottom: '24px' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(139, 92, 246, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: 0 }}>Performance por Responsável</h3>
          <button
            onClick={() => exportToExcel('Performance_Responsavel', performancePorResponsavel.map(p => ({
              Responsável: p.nome,
              'Qtd Clientes': p.qtdClientes,
              'Health Score Médio': p.healthScoreMedio,
              'Alertas Pendentes': p.alertasPendentes,
              'Threads Aguardando': p.threadsAguardando
            })))}
            style={{ background: 'none', border: 'none', color: '#8b5cf6', cursor: 'pointer', padding: '4px' }}
            title="Exportar Excel"
          >
            <Download style={{ width: '16px', height: '16px' }} />
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(15, 10, 31, 0.6)' }}>
                <th style={{ padding: '14px 16px', textAlign: 'left', color: '#94a3b8', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Responsável</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Clientes</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Health Score Médio</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Alertas Pendentes</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Threads Aguardando</th>
              </tr>
            </thead>
            <tbody>
              {performancePorResponsavel.map((resp, index) => (
                <tr key={resp.nome} style={{ background: index % 2 === 0 ? 'transparent' : 'rgba(15, 10, 31, 0.3)' }}>
                  <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(139, 92, 246, 0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '600', fontSize: '12px' }}>
                        {getInitials(resp.nome)}
                      </div>
                      <span style={{ color: 'white', fontSize: '13px', fontWeight: '500' }}>{resp.nome}</span>
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center', color: 'white', fontSize: '14px', fontWeight: '500', borderBottom: '1px solid rgba(139, 92, 246, 0.05)' }}>
                    {resp.qtdClientes}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center', borderBottom: '1px solid rgba(139, 92, 246, 0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <div style={{ width: '50px', height: '5px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${resp.healthScoreMedio}%`,
                          height: '100%',
                          background: resp.healthScoreMedio >= 80 ? STATUS_COLORS.saudavel :
                            resp.healthScoreMedio >= 60 ? STATUS_COLORS.atencao :
                            resp.healthScoreMedio >= 40 ? STATUS_COLORS.risco : STATUS_COLORS.critico,
                          borderRadius: '3px'
                        }}></div>
                      </div>
                      <span style={{
                        color: resp.healthScoreMedio >= 80 ? STATUS_COLORS.saudavel :
                          resp.healthScoreMedio >= 60 ? STATUS_COLORS.atencao :
                          resp.healthScoreMedio >= 40 ? STATUS_COLORS.risco : STATUS_COLORS.critico,
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>{resp.healthScoreMedio}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center', borderBottom: '1px solid rgba(139, 92, 246, 0.05)' }}>
                    {resp.alertasPendentes > 0 ? (
                      <span style={{ padding: '4px 10px', background: 'rgba(249, 115, 22, 0.2)', color: '#f97316', borderRadius: '6px', fontSize: '12px', fontWeight: '500' }}>
                        {resp.alertasPendentes}
                      </span>
                    ) : (
                      <span style={{ color: '#64748b', fontSize: '12px' }}>0</span>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center', borderBottom: '1px solid rgba(139, 92, 246, 0.05)' }}>
                    {resp.threadsAguardando > 0 ? (
                      <span style={{ padding: '4px 10px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', borderRadius: '6px', fontSize: '12px', fontWeight: '500' }}>
                        {resp.threadsAguardando}
                      </span>
                    ) : (
                      <span style={{ color: '#64748b', fontSize: '12px' }}>0</span>
                    )}
                  </td>
                </tr>
              ))}
              {performancePorResponsavel.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                    Nenhum responsável encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SEÇÃO 6: Tendências */}
      <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <TrendingUp style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
            <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: 0 }}>Tendências (últimos 30 dias)</h3>
          </div>
          <button
            onClick={() => exportToExcel('Tendencias', tendenciaData)}
            style={{ background: 'none', border: 'none', color: '#8b5cf6', cursor: 'pointer', padding: '4px' }}
            title="Exportar Excel"
          >
            <Download style={{ width: '16px', height: '16px' }} />
          </button>
        </div>

        <ResponsiveContainer width="100%" height={300}>
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
              <linearGradient id="colorAlertasResolvidos" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(139, 92, 246, 0.1)" />
            <XAxis dataKey="data" stroke="#64748b" fontSize={11} tickLine={false} />
            <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
            <Tooltip
              contentStyle={{ background: 'rgba(15, 10, 31, 0.95)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '8px' }}
              labelStyle={{ color: '#94a3b8' }}
              itemStyle={{ color: 'white' }}
            />
            <Legend
              verticalAlign="top"
              height={36}
              formatter={(value) => <span style={{ color: '#94a3b8', fontSize: '12px' }}>{value}</span>}
            />
            <Area type="monotone" dataKey="threads" name="Threads" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorThreads)" />
            <Area type="monotone" dataKey="alertasCriados" name="Alertas Criados" stroke="#f97316" fillOpacity={1} fill="url(#colorAlertasCriados)" />
            <Area type="monotone" dataKey="alertasResolvidos" name="Alertas Resolvidos" stroke="#10b981" fillOpacity={1} fill="url(#colorAlertasResolvidos)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* SEÇÃO 7 e 8: Threads por Categoria e Sentimento */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Threads por Categoria */}
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: 0 }}>Threads por Categoria</h3>
            <button
              onClick={() => exportToExcel('Threads_Categoria', threadsPorCategoria)}
              style={{ background: 'none', border: 'none', color: '#8b5cf6', cursor: 'pointer', padding: '4px' }}
              title="Exportar Excel"
            >
              <Download style={{ width: '16px', height: '16px' }} />
            </button>
          </div>
          {threadsPorCategoria.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={threadsPorCategoria} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(139, 92, 246, 0.1)" horizontal={true} vertical={false} />
                <XAxis type="number" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} width={100} />
                <Tooltip
                  contentStyle={{ background: 'rgba(15, 10, 31, 0.95)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '8px' }}
                  itemStyle={{ color: 'white' }}
                />
                <Bar dataKey="value" name="Threads" radius={[0, 4, 4, 0]}>
                  {threadsPorCategoria.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
              <div style={{ textAlign: 'center' }}>
                <MessageSquare style={{ width: '32px', height: '32px', margin: '0 auto 8px' }} />
                <p>Sem threads no período</p>
              </div>
            </div>
          )}
        </div>

        {/* Sentimento das Conversas */}
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: 0 }}>Sentimento das Conversas</h3>
            <button
              onClick={() => exportToExcel('Sentimento', sentimentoData)}
              style={{ background: 'none', border: 'none', color: '#8b5cf6', cursor: 'pointer', padding: '4px' }}
              title="Exportar Excel"
            >
              <Download style={{ width: '16px', height: '16px' }} />
            </button>
          </div>
          {sentimentoData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={sentimentoData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {sentimentoData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'rgba(15, 10, 31, 0.95)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '8px' }}
                  itemStyle={{ color: 'white' }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value) => <span style={{ color: '#94a3b8', fontSize: '12px' }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
              <div style={{ textAlign: 'center' }}>
                <MessageSquare style={{ width: '32px', height: '32px', margin: '0 auto 8px' }} />
                <p>Sem dados de sentimento</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
