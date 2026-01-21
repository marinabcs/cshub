import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useNavigate } from 'react-router-dom';
import { Users, Search, Filter, ChevronRight, Clock, Building2, Plus, Pencil } from 'lucide-react';

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [filterType, setFilterType] = useState('todos');
  const navigate = useNavigate();

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

  const getHealthColor = (status) => {
    const colors = { saudavel: '#10b981', atencao: '#f59e0b', risco: '#f97316', critico: '#ef4444' };
    return colors[status] || '#64748b';
  };

  const getHealthLabel = (status) => {
    const labels = { saudavel: 'Saudável', atencao: 'Atenção', risco: 'Risco', critico: 'Crítico' };
    return labels[status] || status;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Sem registro';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Hoje';
    if (diff === 1) return 'Ontem';
    return `há ${diff} dias`;
  };

  const filteredClientes = clientes.filter(cliente => {
    const matchesSearch = cliente.team_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         cliente.responsavel_nome?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'todos' || cliente.health_status === filterStatus;
    const matchesType = filterType === 'todos' || cliente.team_type === filterType;
    return matchesSearch && matchesStatus && matchesType;
  });

  const teamTypes = [...new Set(clientes.map(c => c.team_type).filter(Boolean))];

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f0a1f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '48px', height: '48px', border: '3px solid rgba(139, 92, 246, 0.2)', borderTopColor: '#8b5cf6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px', background: '#0f0a1f', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: 'white', margin: '0 0 8px 0' }}>Clientes</h1>
          <p style={{ color: '#94a3b8', margin: 0 }}>{clientes.length} clientes cadastrados</p>
        </div>
        <button
          onClick={() => navigate('/clientes/novo')}
          style={{
            padding: '12px 20px',
            background: 'linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)',
            border: 'none',
            borderRadius: '12px',
            color: 'white',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Plus style={{ width: '18px', height: '18px' }} />
          Novo Cliente
        </button>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '250px' }}>
          <Search style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', width: '20px', height: '20px', color: '#64748b' }} />
          <input type="text" placeholder="Buscar por nome ou responsável..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '12px 16px 12px 48px', background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '12px', color: 'white', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          style={{ padding: '12px 16px', background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '12px', color: 'white', fontSize: '14px', outline: 'none', cursor: 'pointer', minWidth: '150px' }}>
          <option value="todos" style={{ background: '#1e1b4b' }}>Todos os status</option>
          <option value="saudavel" style={{ background: '#1e1b4b' }}>Saudável</option>
          <option value="atencao" style={{ background: '#1e1b4b' }}>Atenção</option>
          <option value="risco" style={{ background: '#1e1b4b' }}>Risco</option>
          <option value="critico" style={{ background: '#1e1b4b' }}>Crítico</option>
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          style={{ padding: '12px 16px', background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '12px', color: 'white', fontSize: '14px', outline: 'none', cursor: 'pointer', minWidth: '150px' }}>
          <option value="todos" style={{ background: '#1e1b4b' }}>Todos os tipos</option>
          {teamTypes.map(type => (<option key={type} value={type} style={{ background: '#1e1b4b' }}>{type}</option>))}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '16px' }}>
        {filteredClientes.length > 0 ? filteredClientes.map((cliente) => (
          <div key={cliente.id} onClick={() => navigate(`/clientes/${cliente.id}`)}
            style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '20px', cursor: 'pointer', transition: 'all 0.2s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '48px', height: '48px', background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '600', fontSize: '18px' }}>
                  {cliente.team_name?.charAt(0) || 'C'}
                </div>
                <div>
                  <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: '0 0 4px 0' }}>{cliente.team_name}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Building2 style={{ width: '14px', height: '14px', color: '#64748b' }} />
                    <span style={{ color: '#64748b', fontSize: '13px' }}>{cliente.team_type || 'Sem tipo'}</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ padding: '4px 10px', background: `${getHealthColor(cliente.health_status)}20`, color: getHealthColor(cliente.health_status), borderRadius: '8px', fontSize: '12px', fontWeight: '600' }}>
                  {getHealthLabel(cliente.health_status)}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/clientes/${cliente.id}/editar`); }}
                  style={{
                    width: '32px',
                    height: '32px',
                    background: 'rgba(139, 92, 246, 0.2)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                  title="Editar cliente"
                >
                  <Pencil style={{ width: '14px', height: '14px', color: '#a78bfa' }} />
                </button>
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ color: '#94a3b8', fontSize: '13px' }}>Health Score</span>
                <span style={{ color: getHealthColor(cliente.health_status), fontSize: '16px', fontWeight: '700' }}>{cliente.health_score || 0}%</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${cliente.health_score || 0}%`, height: '100%', background: getHealthColor(cliente.health_status), borderRadius: '4px', transition: 'width 0.3s ease' }}></div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid rgba(139, 92, 246, 0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '28px', height: '28px', background: 'rgba(139, 92, 246, 0.2)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users style={{ width: '14px', height: '14px', color: '#a5b4fc' }} />
                </div>
                <span style={{ color: '#94a3b8', fontSize: '13px' }}>{cliente.responsavel_nome || 'Sem responsável'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '12px' }}>
                <Clock style={{ width: '14px', height: '14px' }} />
                {formatDate(cliente.ultima_interacao)}
                <ChevronRight style={{ width: '16px', height: '16px', color: '#8b5cf6' }} />
              </div>
            </div>
          </div>
        )) : (
          <div style={{ gridColumn: '1 / -1', padding: '48px', textAlign: 'center', background: 'rgba(30, 27, 75, 0.4)', borderRadius: '16px', border: '1px solid rgba(139, 92, 246, 0.15)' }}>
            <Users style={{ width: '48px', height: '48px', color: '#64748b', margin: '0 auto 16px' }} />
            <p style={{ color: '#94a3b8', fontSize: '16px', margin: 0 }}>Nenhum cliente encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
}
