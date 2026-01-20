import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { BarChart3, Users, TrendingUp, AlertTriangle, Search, Filter, Download, X, ChevronDown } from 'lucide-react';

export default function Analytics() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectedType, setSelectedType] = useState('todos');
  const [scoreMin, setScoreMin] = useState('');
  const [scoreMax, setScoreMax] = useState('');
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);

  useEffect(() => {
    const fetchClientes = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'clientes'));
        const clientesData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setClientes(clientesData);
      } catch (error) {
        console.error('Erro ao buscar clientes:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchClientes();
  }, []);

  const teamTypes = useMemo(() => [...new Set(clientes.map(c => c.team_type).filter(Boolean))], [clientes]);

  const filteredClientes = useMemo(() => {
    return clientes.filter(cliente => {
      const matchesSearch = !searchTerm ||
        cliente.team_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cliente.responsavel_nome?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(cliente.health_status);

      const matchesType = selectedType === 'todos' || cliente.team_type === selectedType;

      const score = cliente.health_score || 0;
      const matchesScoreMin = scoreMin === '' || score >= Number(scoreMin);
      const matchesScoreMax = scoreMax === '' || score <= Number(scoreMax);

      return matchesSearch && matchesStatus && matchesType && matchesScoreMin && matchesScoreMax;
    });
  }, [clientes, searchTerm, selectedStatuses, selectedType, scoreMin, scoreMax]);

  const stats = useMemo(() => {
    const total = filteredClientes.length;
    const avgScore = total > 0 ? Math.round(filteredClientes.reduce((sum, c) => sum + (c.health_score || 0), 0) / total) : 0;
    const saudaveis = filteredClientes.filter(c => c.health_status === 'saudavel').length;
    const emRisco = filteredClientes.filter(c => c.health_status === 'risco' || c.health_status === 'critico').length;
    return { total, avgScore, saudaveis, emRisco };
  }, [filteredClientes]);

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

  const getHealthColor = (status) => {
    const colors = { saudavel: '#10b981', atencao: '#f59e0b', risco: '#f97316', critico: '#ef4444' };
    return colors[status] || '#64748b';
  };

  const getHealthLabel = (status) => {
    const labels = { saudavel: 'Saudável', atencao: 'Atenção', risco: 'Risco', critico: 'Crítico' };
    return labels[status] || status;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const exportToCSV = () => {
    const headers = ['Cliente', 'Tipo', 'Responsável', 'Health Score', 'Status', 'Última Interação'];
    const rows = filteredClientes.map(c => [
      c.team_name || '',
      c.team_type || '',
      c.responsavel_nome || '',
      c.health_score || 0,
      getHealthLabel(c.health_status),
      formatDate(c.ultima_interacao)
    ]);

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: 'white', margin: '0 0 8px 0' }}>Analytics</h1>
          <p style={{ color: '#94a3b8', margin: 0 }}>Análise detalhada dos clientes</p>
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
            cursor: filteredClientes.length > 0 ? 'pointer' : 'not-allowed',
            boxShadow: filteredClientes.length > 0 ? '0 4px 20px rgba(139, 92, 246, 0.3)' : 'none'
          }}
        >
          <Download style={{ width: '18px', height: '18px' }} />
          Exportar CSV
        </button>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users style={{ width: '24px', height: '24px', color: 'white' }} />
          </div>
          <div>
            <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 4px 0' }}>Total de Resultados</p>
            <p style={{ color: 'white', fontSize: '28px', fontWeight: 'bold', margin: 0 }}>{stats.total}</p>
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)', border: '1px solid rgba(6, 182, 212, 0.2)', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart3 style={{ width: '24px', height: '24px', color: 'white' }} />
          </div>
          <div>
            <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 4px 0' }}>Score Médio</p>
            <p style={{ color: 'white', fontSize: '28px', fontWeight: 'bold', margin: 0 }}>{stats.avgScore}%</p>
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp style={{ width: '24px', height: '24px', color: 'white' }} />
          </div>
          <div>
            <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 4px 0' }}>Saudáveis</p>
            <p style={{ color: 'white', fontSize: '28px', fontWeight: 'bold', margin: 0 }}>{stats.saudaveis}</p>
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AlertTriangle style={{ width: '24px', height: '24px', color: 'white' }} />
          </div>
          <div>
            <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 4px 0' }}>Em Risco</p>
            <p style={{ color: 'white', fontSize: '28px', fontWeight: 'bold', margin: 0 }}>{stats.emRisco}</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter style={{ width: '18px', height: '18px', color: '#8b5cf6' }} />
            <span style={{ color: 'white', fontSize: '14px', fontWeight: '600' }}>Filtros</span>
          </div>
          {hasFilters && (
            <button
              onClick={clearFilters}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#ef4444', fontSize: '13px', cursor: 'pointer', padding: 0 }}
            >
              <X style={{ width: '14px', height: '14px' }} />
              Limpar filtros
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '16px' }}>
          {/* Busca */}
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: '#64748b' }} />
            <input
              type="text"
              placeholder="Buscar por nome ou responsável..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '10px 14px 10px 42px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: 'white', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          {/* Multi-select Status */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
              style={{ width: '100%', padding: '10px 14px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: selectedStatuses.length > 0 ? 'white' : '#64748b', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxSizing: 'border-box' }}
            >
              <span>{selectedStatuses.length > 0 ? `${selectedStatuses.length} selecionado(s)` : 'Status'}</span>
              <ChevronDown style={{ width: '16px', height: '16px' }} />
            </button>
            {statusDropdownOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: '#1a1033', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '10px', padding: '8px', zIndex: 10 }}>
                {['saudavel', 'atencao', 'risco', 'critico'].map(status => (
                  <label key={status} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', cursor: 'pointer', borderRadius: '6px', background: selectedStatuses.includes(status) ? 'rgba(139, 92, 246, 0.2)' : 'transparent' }}>
                    <input
                      type="checkbox"
                      checked={selectedStatuses.includes(status)}
                      onChange={() => toggleStatus(status)}
                      style={{ accentColor: '#8b5cf6' }}
                    />
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
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            style={{ padding: '10px 14px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: selectedType !== 'todos' ? 'white' : '#64748b', fontSize: '13px', outline: 'none', cursor: 'pointer' }}
          >
            <option value="todos" style={{ background: '#1e1b4b' }}>Todos os tipos</option>
            {teamTypes.map(type => (
              <option key={type} value={type} style={{ background: '#1e1b4b' }}>{type}</option>
            ))}
          </select>

          {/* Score Range */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="number"
              placeholder="Min"
              min="0"
              max="100"
              value={scoreMin}
              onChange={(e) => setScoreMin(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: 'white', fontSize: '13px', outline: 'none', textAlign: 'center' }}
            />
            <span style={{ color: '#64748b', fontSize: '13px' }}>-</span>
            <input
              type="number"
              placeholder="Max"
              min="0"
              max="100"
              value={scoreMax}
              onChange={(e) => setScoreMax(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: 'white', fontSize: '13px', outline: 'none', textAlign: 'center' }}
            />
          </div>
        </div>
      </div>

      {/* Tabela */}
      <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(15, 10, 31, 0.6)' }}>
              <th style={{ padding: '16px 20px', textAlign: 'left', color: '#94a3b8', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>Cliente</th>
              <th style={{ padding: '16px 20px', textAlign: 'left', color: '#94a3b8', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>Tipo</th>
              <th style={{ padding: '16px 20px', textAlign: 'left', color: '#94a3b8', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>Responsável</th>
              <th style={{ padding: '16px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>Health Score</th>
              <th style={{ padding: '16px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>Status</th>
              <th style={{ padding: '16px 20px', textAlign: 'right', color: '#94a3b8', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>Última Interação</th>
            </tr>
          </thead>
          <tbody>
            {filteredClientes.length > 0 ? filteredClientes.map((cliente, index) => (
              <tr key={cliente.id} style={{ background: index % 2 === 0 ? 'transparent' : 'rgba(15, 10, 31, 0.3)' }}>
                <td style={{ padding: '16px 20px', borderBottom: '1px solid rgba(139, 92, 246, 0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '600', fontSize: '14px' }}>
                      {cliente.team_name?.charAt(0) || 'C'}
                    </div>
                    <span style={{ color: 'white', fontSize: '14px', fontWeight: '500' }}>{cliente.team_name}</span>
                  </div>
                </td>
                <td style={{ padding: '16px 20px', color: '#94a3b8', fontSize: '13px', borderBottom: '1px solid rgba(139, 92, 246, 0.05)' }}>{cliente.team_type || '-'}</td>
                <td style={{ padding: '16px 20px', color: '#94a3b8', fontSize: '13px', borderBottom: '1px solid rgba(139, 92, 246, 0.05)' }}>{cliente.responsavel_nome || '-'}</td>
                <td style={{ padding: '16px 20px', textAlign: 'center', borderBottom: '1px solid rgba(139, 92, 246, 0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <div style={{ width: '60px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${cliente.health_score || 0}%`, height: '100%', background: getHealthColor(cliente.health_status), borderRadius: '3px' }}></div>
                    </div>
                    <span style={{ color: getHealthColor(cliente.health_status), fontSize: '13px', fontWeight: '600', minWidth: '36px' }}>{cliente.health_score || 0}%</span>
                  </div>
                </td>
                <td style={{ padding: '16px 20px', textAlign: 'center', borderBottom: '1px solid rgba(139, 92, 246, 0.05)' }}>
                  <span style={{ padding: '4px 10px', background: `${getHealthColor(cliente.health_status)}20`, color: getHealthColor(cliente.health_status), borderRadius: '6px', fontSize: '12px', fontWeight: '500' }}>
                    {getHealthLabel(cliente.health_status)}
                  </span>
                </td>
                <td style={{ padding: '16px 20px', textAlign: 'right', color: '#64748b', fontSize: '13px', borderBottom: '1px solid rgba(139, 92, 246, 0.05)' }}>{formatDate(cliente.ultima_interacao)}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan="6" style={{ padding: '48px', textAlign: 'center' }}>
                  <Users style={{ width: '40px', height: '40px', color: '#64748b', margin: '0 auto 12px' }} />
                  <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Nenhum cliente encontrado com os filtros aplicados</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
