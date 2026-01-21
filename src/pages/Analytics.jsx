// Atualizado em 21/01/2026
import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { BarChart3, Users, TrendingUp, AlertTriangle, Search, Filter, Download, X, ChevronDown, LogIn, FileImage, Sparkles, Calendar } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// Função para normalizar texto (remove acentos)
const normalizeText = (text) => {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

const STATUS_COLORS = {
  saudavel: '#10B981',
  atencao: '#F59E0B',
  risco: '#EF4444',
  critico: '#7C3AED'
};

export default function Analytics() {
  const [clientes, setClientes] = useState([]);
  const [usageData, setUsageData] = useState({});
  const [loading, setLoading] = useState(true);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectedType, setSelectedType] = useState('todos');
  const [scoreMin, setScoreMin] = useState('');
  const [scoreMax, setScoreMax] = useState('');
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [periodDays, setPeriodDays] = useState(30);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch clientes
        const clientesSnapshot = await getDocs(collection(db, 'clientes'));
        const clientesData = clientesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setClientes(clientesData);

        // Fetch uso_plataforma for each cliente's linked teams
        // Each cliente has a "times" array with team IDs
        // Usage data is stored in clientes/{team_id}/uso_plataforma
        const usagePromises = clientesData.map(async (cliente) => {
          try {
            const teamIds = cliente.times || [];
            if (teamIds.length === 0) {
              return { clienteId: cliente.id, usage: [] };
            }

            // Fetch usage data from all linked teams
            const teamUsagePromises = teamIds.map(async (teamId) => {
              try {
                const usageSnapshot = await getDocs(collection(db, 'clientes', teamId, 'uso_plataforma'));
                return usageSnapshot.docs.map(doc => ({ id: doc.id, teamId, ...doc.data() }));
              } catch {
                return [];
              }
            });

            const teamUsageResults = await Promise.all(teamUsagePromises);
            // Flatten all team usage data into single array
            const combinedUsage = teamUsageResults.flat();
            return { clienteId: cliente.id, usage: combinedUsage };
          } catch {
            return { clienteId: cliente.id, usage: [] };
          }
        });

        const usageResults = await Promise.all(usagePromises);
        const usageMap = {};
        usageResults.forEach(({ clienteId, usage }) => {
          usageMap[clienteId] = usage;
        });
        setUsageData(usageMap);
      } catch (error) {
        console.error('Erro ao buscar dados:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Calculate usage metrics for a client within period
  const getClientUsage = (clienteId) => {
    const usage = usageData[clienteId] || [];
    const now = new Date();
    const cutoff = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

    const filteredUsage = usage.filter(u => {
      const date = u.data?.toDate?.() || new Date(u.data);
      return date >= cutoff;
    });

    return filteredUsage.reduce((acc, u) => {
      const escala = u.escala || {};
      const ai = u.ai || {};
      return {
        logins: acc.logins + (escala.logins || 0),
        pecas_criadas: acc.pecas_criadas + (escala.pecas_criadas || 0),
        downloads: acc.downloads + (escala.downloads || 0),
        usuarios_ativos: Math.max(acc.usuarios_ativos, escala.usuarios_ativos || 0),
        ai_total: acc.ai_total + (ai.total || 0),
        ai_remover_fundo: acc.ai_remover_fundo + (ai.remover_fundo || 0),
        ai_gerar_imagem: acc.ai_gerar_imagem + (ai.gerar_imagem || 0),
        ai_escrever_texto: acc.ai_escrever_texto + (ai.escrever_texto || 0)
      };
    }, { logins: 0, pecas_criadas: 0, downloads: 0, usuarios_ativos: 0, ai_total: 0, ai_remover_fundo: 0, ai_gerar_imagem: 0, ai_escrever_texto: 0 });
  };

  const teamTypes = useMemo(() => [...new Set(clientes.map(c => c.team_type).filter(Boolean))], [clientes]);

  const filteredClientes = useMemo(() => {
    return clientes.filter(cliente => {
      const searchNormalized = normalizeText(searchTerm);
      const nameNormalized = normalizeText(cliente.team_name || '');
      const responsavelNormalized = normalizeText(cliente.responsavel_nome || '');
      const matchesSearch = !searchTerm || nameNormalized.includes(searchNormalized) || responsavelNormalized.includes(searchNormalized);

      const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(cliente.health_status);
      const matchesType = selectedType === 'todos' || cliente.team_type === selectedType;

      const score = cliente.health_score || 0;
      const matchesScoreMin = scoreMin === '' || score >= Number(scoreMin);
      const matchesScoreMax = scoreMax === '' || score <= Number(scoreMax);

      return matchesSearch && matchesStatus && matchesType && matchesScoreMin && matchesScoreMax;
    });
  }, [clientes, searchTerm, selectedStatuses, selectedType, scoreMin, scoreMax]);

  // Aggregated metrics
  const aggregatedMetrics = useMemo(() => {
    return filteredClientes.reduce((acc, cliente) => {
      const usage = getClientUsage(cliente.id);
      return {
        totalLogins: acc.totalLogins + usage.logins,
        totalPecas: acc.totalPecas + usage.pecas_criadas,
        totalDownloads: acc.totalDownloads + usage.downloads,
        totalAI: acc.totalAI + usage.ai_total,
        aiRemoverFundo: acc.aiRemoverFundo + usage.ai_remover_fundo,
        aiGerarImagem: acc.aiGerarImagem + usage.ai_gerar_imagem,
        aiEscreverTexto: acc.aiEscreverTexto + usage.ai_escrever_texto
      };
    }, { totalLogins: 0, totalPecas: 0, totalDownloads: 0, totalAI: 0, aiRemoverFundo: 0, aiGerarImagem: 0, aiEscreverTexto: 0 });
  }, [filteredClientes, usageData, periodDays]);

  // Stats for cards
  const stats = useMemo(() => {
    const total = filteredClientes.length;
    const avgScore = total > 0 ? Math.round(filteredClientes.reduce((sum, c) => sum + (c.health_score || 0), 0) / total) : 0;
    const saudaveis = filteredClientes.filter(c => c.health_status === 'saudavel').length;
    const atencao = filteredClientes.filter(c => c.health_status === 'atencao').length;
    const risco = filteredClientes.filter(c => c.health_status === 'risco').length;
    const critico = filteredClientes.filter(c => c.health_status === 'critico').length;
    return { total, avgScore, saudaveis, atencao, risco, critico };
  }, [filteredClientes]);

  // Pie chart data
  const pieData = useMemo(() => [
    { name: 'Saudável', value: stats.saudaveis, color: STATUS_COLORS.saudavel },
    { name: 'Atenção', value: stats.atencao, color: STATUS_COLORS.atencao },
    { name: 'Risco', value: stats.risco, color: STATUS_COLORS.risco },
    { name: 'Crítico', value: stats.critico, color: STATUS_COLORS.critico }
  ].filter(d => d.value > 0), [stats]);

  // Top 10 clients by usage
  const top10Clientes = useMemo(() => {
    return [...filteredClientes]
      .map(c => ({ ...c, usage: getClientUsage(c.id) }))
      .sort((a, b) => b.usage.logins - a.usage.logins)
      .slice(0, 10)
      .map(c => ({ name: c.team_name?.substring(0, 15) || 'N/A', logins: c.usage.logins, pecas: c.usage.pecas_criadas }));
  }, [filteredClientes, usageData, periodDays]);

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedStatuses([]);
    setSelectedType('todos');
    setScoreMin('');
    setScoreMax('');
  };

  const hasFilters = searchTerm || selectedStatuses.length > 0 || selectedType !== 'todos' || scoreMin || scoreMax;

  const toggleStatus = (status) => {
    setSelectedStatuses(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const getHealthColor = (status) => STATUS_COLORS[status] || '#64748b';

  const getHealthLabel = (status) => {
    const labels = { saudavel: 'Saudável', atencao: 'Atenção', risco: 'Risco', critico: 'Crítico' };
    return labels[status] || status;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString('pt-BR');
  };

  const exportToCSV = () => {
    const headers = ['Cliente', 'Tipo', 'Responsável', 'Usuários Ativos', 'Logins', 'Peças Criadas', 'Downloads', 'Uso AI', 'Health Score', 'Status'];
    const rows = filteredClientes.map(c => {
      const usage = getClientUsage(c.id);
      return [
        c.team_name || '',
        c.team_type || '',
        c.responsavel_nome || '',
        usage.usuarios_ativos,
        usage.logins,
        usage.pecas_criadas,
        usage.downloads,
        usage.ai_total,
        c.health_score || 0,
        getHealthLabel(c.health_status)
      ];
    });

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.join(';'))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `analytics_clientes_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

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
          <p style={{ color: '#94a3b8', margin: 0 }}>Análise detalhada de uso da plataforma</p>
        </div>
        <button
          onClick={exportToCSV}
          disabled={filteredClientes.length === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 20px',
            background: filteredClientes.length > 0 ? 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)' : 'rgba(100, 116, 139, 0.3)',
            border: 'none',
            borderRadius: '12px',
            color: 'white',
            fontSize: '14px',
            fontWeight: '600',
            cursor: filteredClientes.length > 0 ? 'pointer' : 'not-allowed'
          }}
        >
          <Download style={{ width: '18px', height: '18px' }} />
          Exportar CSV
        </button>
      </div>

      {/* Filtros */}
      <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter style={{ width: '18px', height: '18px', color: '#8b5cf6' }} />
            <span style={{ color: 'white', fontSize: '14px', fontWeight: '600' }}>Filtros</span>
          </div>
          {hasFilters && (
            <button onClick={clearFilters} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#ef4444', fontSize: '13px', cursor: 'pointer', padding: 0 }}>
              <X style={{ width: '14px', height: '14px' }} />
              Limpar filtros
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: '12px' }}>
          {/* Busca */}
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: '#64748b' }} />
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '10px 14px 10px 42px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: 'white', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* Status Multi-select */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
              style={{ width: '100%', padding: '10px 14px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: selectedStatuses.length > 0 ? 'white' : '#64748b', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxSizing: 'border-box' }}
            >
              <span>{selectedStatuses.length > 0 ? `${selectedStatuses.length} status` : 'Status'}</span>
              <ChevronDown style={{ width: '16px', height: '16px' }} />
            </button>
            {statusDropdownOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: '#1a1033', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '10px', padding: '8px', zIndex: 10 }}>
                {['saudavel', 'atencao', 'risco', 'critico'].map(status => (
                  <label key={status} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', cursor: 'pointer', borderRadius: '6px', background: selectedStatuses.includes(status) ? 'rgba(139, 92, 246, 0.2)' : 'transparent' }}>
                    <input type="checkbox" checked={selectedStatuses.includes(status)} onChange={() => toggleStatus(status)} style={{ accentColor: '#8b5cf6' }} />
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '8px', height: '8px', background: getHealthColor(status), borderRadius: '50%' }}></span>
                      <span style={{ color: 'white', fontSize: '13px' }}>{getHealthLabel(status)}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Tipo */}
          <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} style={{ padding: '10px 14px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: selectedType !== 'todos' ? 'white' : '#64748b', fontSize: '13px', outline: 'none', cursor: 'pointer' }}>
            <option value="todos" style={{ background: '#1e1b4b' }}>Todos tipos</option>
            {teamTypes.map(type => (<option key={type} value={type} style={{ background: '#1e1b4b' }}>{type}</option>))}
          </select>

          {/* Score Range */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input type="number" placeholder="Min" min="0" max="100" value={scoreMin} onChange={(e) => setScoreMin(e.target.value)} style={{ width: '100%', padding: '10px 8px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: 'white', fontSize: '13px', outline: 'none', textAlign: 'center' }} />
            <span style={{ color: '#64748b' }}>-</span>
            <input type="number" placeholder="Max" min="0" max="100" value={scoreMax} onChange={(e) => setScoreMax(e.target.value)} style={{ width: '100%', padding: '10px 8px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: 'white', fontSize: '13px', outline: 'none', textAlign: 'center' }} />
          </div>

          {/* Período */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar style={{ width: '16px', height: '16px', color: '#64748b' }} />
            <select value={periodDays} onChange={(e) => setPeriodDays(Number(e.target.value))} style={{ flex: 1, padding: '10px 12px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: 'white', fontSize: '13px', outline: 'none', cursor: 'pointer' }}>
              <option value={7} style={{ background: '#1e1b4b' }}>7 dias</option>
              <option value={15} style={{ background: '#1e1b4b' }}>15 dias</option>
              <option value={30} style={{ background: '#1e1b4b' }}>30 dias</option>
            </select>
          </div>
        </div>
      </div>

      {/* Cards de Métricas Agregadas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LogIn style={{ width: '22px', height: '22px', color: 'white' }} />
            </div>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Total Logins ({periodDays}d)</p>
              <p style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{formatNumber(aggregatedMetrics.totalLogins)}</p>
            </div>
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)', border: '1px solid rgba(6, 182, 212, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileImage style={{ width: '22px', height: '22px', color: 'white' }} />
            </div>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Peças Criadas ({periodDays}d)</p>
              <p style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{formatNumber(aggregatedMetrics.totalPecas)}</p>
            </div>
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Download style={{ width: '22px', height: '22px', color: 'white' }} />
            </div>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Downloads ({periodDays}d)</p>
              <p style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{formatNumber(aggregatedMetrics.totalDownloads)}</p>
            </div>
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)', border: '1px solid rgba(249, 115, 22, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles style={{ width: '22px', height: '22px', color: 'white' }} />
            </div>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Uso AI ({periodDays}d)</p>
              <p style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{formatNumber(aggregatedMetrics.totalAI)}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
            <span style={{ padding: '2px 8px', background: 'rgba(249, 115, 22, 0.2)', borderRadius: '6px', fontSize: '10px', color: '#fb923c' }}>Fundo: {formatNumber(aggregatedMetrics.aiRemoverFundo)}</span>
            <span style={{ padding: '2px 8px', background: 'rgba(249, 115, 22, 0.2)', borderRadius: '6px', fontSize: '10px', color: '#fb923c' }}>Imagem: {formatNumber(aggregatedMetrics.aiGerarImagem)}</span>
            <span style={{ padding: '2px 8px', background: 'rgba(249, 115, 22, 0.2)', borderRadius: '6px', fontSize: '10px', color: '#fb923c' }}>Texto: {formatNumber(aggregatedMetrics.aiEscreverTexto)}</span>
          </div>
        </div>
      </div>

      {/* Cards de Status */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', background: 'rgba(139, 92, 246, 0.2)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users style={{ width: '20px', height: '20px', color: '#a78bfa' }} />
          </div>
          <div>
            <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Total Clientes</p>
            <p style={{ color: 'white', fontSize: '20px', fontWeight: 'bold', margin: 0 }}>{stats.total}</p>
          </div>
        </div>

        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', background: 'rgba(6, 182, 212, 0.2)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart3 style={{ width: '20px', height: '20px', color: '#22d3ee' }} />
          </div>
          <div>
            <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Score Médio</p>
            <p style={{ color: 'white', fontSize: '20px', fontWeight: 'bold', margin: 0 }}>{stats.avgScore}%</p>
          </div>
        </div>

        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', background: 'rgba(16, 185, 129, 0.2)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp style={{ width: '20px', height: '20px', color: '#34d399' }} />
          </div>
          <div>
            <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Saudáveis</p>
            <p style={{ color: '#10b981', fontSize: '20px', fontWeight: 'bold', margin: 0 }}>{stats.saudaveis}</p>
          </div>
        </div>

        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', background: 'rgba(239, 68, 68, 0.2)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle style={{ width: '20px', height: '20px', color: '#f87171' }} />
          </div>
          <div>
            <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Em Risco</p>
            <p style={{ color: '#ef4444', fontSize: '20px', fontWeight: 'bold', margin: 0 }}>{stats.risco + stats.critico}</p>
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', marginBottom: '24px' }}>
        {/* Pie Chart - Distribuição por Status */}
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '20px' }}>
          <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: '0 0 16px 0' }}>Distribuição por Status</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
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

        {/* Bar Chart - Top 10 Clientes */}
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '20px' }}>
          <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: '0 0 16px 0' }}>Top 10 Clientes por Uso</h3>
          {top10Clientes.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={top10Clientes} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(139, 92, 246, 0.1)" horizontal={true} vertical={false} />
                <XAxis type="number" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} width={80} />
                <Tooltip
                  contentStyle={{ background: 'rgba(15, 10, 31, 0.95)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '8px' }}
                  itemStyle={{ color: 'white' }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Bar dataKey="logins" name="Logins" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                <Bar dataKey="pecas" name="Peças" fill="#06b6d4" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>Sem dados</div>
          )}
        </div>
      </div>

      {/* Tabela Expandida */}
      <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>
          <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: 0 }}>Uso por Cliente</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px' }}>
            <thead>
              <tr style={{ background: 'rgba(15, 10, 31, 0.6)' }}>
                <th style={{ padding: '14px 16px', textAlign: 'left', color: '#94a3b8', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cliente</th>
                <th style={{ padding: '14px 16px', textAlign: 'left', color: '#94a3b8', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tipo</th>
                <th style={{ padding: '14px 12px', textAlign: 'center', color: '#94a3b8', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Usuários</th>
                <th style={{ padding: '14px 12px', textAlign: 'center', color: '#94a3b8', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Logins</th>
                <th style={{ padding: '14px 12px', textAlign: 'center', color: '#94a3b8', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Peças</th>
                <th style={{ padding: '14px 12px', textAlign: 'center', color: '#94a3b8', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Downloads</th>
                <th style={{ padding: '14px 12px', textAlign: 'center', color: '#94a3b8', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Uso AI</th>
                <th style={{ padding: '14px 12px', textAlign: 'center', color: '#94a3b8', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Score</th>
                <th style={{ padding: '14px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredClientes.length > 0 ? filteredClientes.map((cliente, index) => {
                const usage = getClientUsage(cliente.id);
                return (
                  <tr key={cliente.id} style={{ background: index % 2 === 0 ? 'transparent' : 'rgba(15, 10, 31, 0.3)' }}>
                    <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(139, 92, 246, 0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '600', fontSize: '13px' }}>
                          {cliente.team_name?.charAt(0) || 'C'}
                        </div>
                        <span style={{ color: 'white', fontSize: '13px', fontWeight: '500' }}>{cliente.team_name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', color: '#94a3b8', fontSize: '12px', borderBottom: '1px solid rgba(139, 92, 246, 0.05)' }}>{cliente.team_type || '-'}</td>
                    <td style={{ padding: '14px 12px', textAlign: 'center', color: 'white', fontSize: '13px', fontWeight: '500', borderBottom: '1px solid rgba(139, 92, 246, 0.05)' }}>{usage.usuarios_ativos}</td>
                    <td style={{ padding: '14px 12px', textAlign: 'center', color: 'white', fontSize: '13px', fontWeight: '500', borderBottom: '1px solid rgba(139, 92, 246, 0.05)' }}>{formatNumber(usage.logins)}</td>
                    <td style={{ padding: '14px 12px', textAlign: 'center', color: 'white', fontSize: '13px', fontWeight: '500', borderBottom: '1px solid rgba(139, 92, 246, 0.05)' }}>{formatNumber(usage.pecas_criadas)}</td>
                    <td style={{ padding: '14px 12px', textAlign: 'center', color: 'white', fontSize: '13px', fontWeight: '500', borderBottom: '1px solid rgba(139, 92, 246, 0.05)' }}>{formatNumber(usage.downloads)}</td>
                    <td style={{ padding: '14px 12px', textAlign: 'center', color: 'white', fontSize: '13px', fontWeight: '500', borderBottom: '1px solid rgba(139, 92, 246, 0.05)' }}>{formatNumber(usage.ai_total)}</td>
                    <td style={{ padding: '14px 12px', textAlign: 'center', borderBottom: '1px solid rgba(139, 92, 246, 0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <div style={{ width: '50px', height: '5px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${cliente.health_score || 0}%`, height: '100%', background: getHealthColor(cliente.health_status), borderRadius: '3px' }}></div>
                        </div>
                        <span style={{ color: getHealthColor(cliente.health_status), fontSize: '12px', fontWeight: '600', minWidth: '32px' }}>{cliente.health_score || 0}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'center', borderBottom: '1px solid rgba(139, 92, 246, 0.05)' }}>
                      <span style={{ padding: '4px 10px', background: `${getHealthColor(cliente.health_status)}20`, color: getHealthColor(cliente.health_status), borderRadius: '6px', fontSize: '11px', fontWeight: '500' }}>
                        {getHealthLabel(cliente.health_status)}
                      </span>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan="9" style={{ padding: '48px', textAlign: 'center' }}>
                    <Users style={{ width: '40px', height: '40px', color: '#64748b', margin: '0 auto 12px' }} />
                    <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Nenhum cliente encontrado</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
