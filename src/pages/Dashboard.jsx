import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useNavigate } from 'react-router-dom';
import { Users, CheckCircle, AlertTriangle, XCircle, TrendingUp, Clock, MessageSquare, Calendar, ChevronRight, Filter, Search } from 'lucide-react';

// Função para normalizar texto (remove acentos)
const normalizeText = (text) => {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

export default function Dashboard() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterTeamType, setFilterTeamType] = useState('todos');
  const [filterResponsavel, setFilterResponsavel] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');
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

  // Get unique team types and responsáveis
  const teamTypes = [...new Set(clientes.map(c => c.team_type).filter(Boolean))].sort();
  const responsaveis = [...new Set(clientes.map(c => c.responsavel_nome).filter(Boolean))].sort();

  // Filter clients
  const filteredClientes = clientes.filter(cliente => {
    const matchesTeamType = filterTeamType === 'todos' || cliente.team_type === filterTeamType;
    const matchesResponsavel = filterResponsavel === 'todos' || cliente.responsavel_nome === filterResponsavel;
    const searchNormalized = normalizeText(searchTerm);
    const nameNormalized = normalizeText(cliente.team_name || '');
    const responsavelNormalized = normalizeText(cliente.responsavel_nome || '');
    const matchesSearch = !searchTerm || nameNormalized.includes(searchNormalized) || responsavelNormalized.includes(searchNormalized);
    return matchesTeamType && matchesResponsavel && matchesSearch;
  });

  // Stats based on filtered clients
  const stats = {
    total: filteredClientes.length,
    saudaveis: filteredClientes.filter(c => c.health_status === 'saudavel').length,
    atencao: filteredClientes.filter(c => c.health_status === 'atencao').length,
    risco: filteredClientes.filter(c => c.health_status === 'risco').length,
    critico: filteredClientes.filter(c => c.health_status === 'critico').length
  };

  const clientesAtencao = filteredClientes
    .filter(c => c.health_status !== 'saudavel')
    .sort((a, b) => (a.health_score || 0) - (b.health_score || 0))
    .slice(0, 5);

  const getHealthColor = (status) => {
    const colors = {
      saudavel: '#10b981',
      atencao: '#f59e0b',
      risco: '#f97316',
      critico: '#ef4444'
    };
    return colors[status] || '#64748b';
  };

  const getHealthLabel = (status) => {
    const labels = {
      saudavel: 'Saudável',
      atencao: 'Atenção',
      risco: 'Risco',
      critico: 'Crítico'
    };
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

  const clearFilters = () => {
    setFilterTeamType('todos');
    setFilterResponsavel('todos');
    setSearchTerm('');
  };

  const hasActiveFilters = filterTeamType !== 'todos' || filterResponsavel !== 'todos' || searchTerm !== '';

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0f0a1f',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '3px solid rgba(139, 92, 246, 0.2)',
          borderTopColor: '#8b5cf6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px', background: '#0f0a1f', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '24px'
      }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: 'white', margin: '0 0 8px 0' }}>
            Dashboard
          </h1>
          <p style={{ color: '#94a3b8', margin: 0 }}>Visão geral dos clientes</p>
        </div>
        <button
          onClick={() => navigate('/clientes')}
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
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(139, 92, 246, 0.3)'
          }}
        >
          <Users style={{ width: '18px', height: '18px' }} />
          Ver Clientes
        </button>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '24px',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <div style={{ position: 'relative', minWidth: '220px' }}>
          <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#64748b' }} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar cliente..."
            style={{
              width: '100%',
              padding: '10px 12px 10px 36px',
              background: 'rgba(30, 27, 75, 0.4)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              borderRadius: '10px',
              color: 'white',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>
        <select
          value={filterTeamType}
          onChange={(e) => setFilterTeamType(e.target.value)}
          style={{
            padding: '10px 14px',
            background: 'rgba(30, 27, 75, 0.4)',
            border: '1px solid rgba(139, 92, 246, 0.2)',
            borderRadius: '10px',
            color: 'white',
            fontSize: '13px',
            outline: 'none',
            cursor: 'pointer',
            minWidth: '160px'
          }}
        >
          <option value="todos" style={{ background: '#1e1b4b' }}>Todos os tipos</option>
          {teamTypes.map(type => (
            <option key={type} value={type} style={{ background: '#1e1b4b' }}>{type}</option>
          ))}
        </select>
        <select
          value={filterResponsavel}
          onChange={(e) => setFilterResponsavel(e.target.value)}
          style={{
            padding: '10px 14px',
            background: 'rgba(30, 27, 75, 0.4)',
            border: '1px solid rgba(139, 92, 246, 0.2)',
            borderRadius: '10px',
            color: 'white',
            fontSize: '13px',
            outline: 'none',
            cursor: 'pointer',
            minWidth: '160px'
          }}
        >
          <option value="todos" style={{ background: '#1e1b4b' }}>Todos responsáveis</option>
          {responsaveis.map(resp => (
            <option key={resp} value={resp} style={{ background: '#1e1b4b' }}>{resp}</option>
          ))}
        </select>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            style={{
              padding: '10px 14px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '10px',
              color: '#ef4444',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <XCircle style={{ width: '14px', height: '14px' }} />
            Limpar filtros
          </button>
        )}
        {hasActiveFilters && (
          <span style={{ color: '#64748b', fontSize: '13px' }}>
            {filteredClientes.length} de {clientes.length} clientes
          </span>
        )}
      </div>

      {/* Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '20px',
        marginBottom: '32px'
      }}>
        {/* Total de Clientes */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)',
          border: '1px solid rgba(139, 92, 246, 0.2)',
          borderRadius: '20px',
          padding: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(139, 92, 246, 0.3)'
          }}>
            <Users style={{ width: '28px', height: '28px', color: 'white' }} />
          </div>
          <div>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 4px 0' }}>Total de Clientes</p>
            <p style={{ color: 'white', fontSize: '32px', fontWeight: 'bold', margin: 0 }}>{stats.total}</p>
          </div>
        </div>

        {/* Saudáveis */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          borderRadius: '20px',
          padding: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3)'
          }}>
            <CheckCircle style={{ width: '28px', height: '28px', color: 'white' }} />
          </div>
          <div>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 4px 0' }}>Saudáveis</p>
            <p style={{ color: 'white', fontSize: '32px', fontWeight: 'bold', margin: 0 }}>{stats.saudaveis}</p>
          </div>
        </div>

        {/* Precisam Atenção */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          borderRadius: '20px',
          padding: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(245, 158, 11, 0.3)'
          }}>
            <AlertTriangle style={{ width: '28px', height: '28px', color: 'white' }} />
          </div>
          <div>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 4px 0' }}>Precisam Atenção</p>
            <p style={{ color: 'white', fontSize: '32px', fontWeight: 'bold', margin: 0 }}>{stats.atencao + stats.risco}</p>
          </div>
        </div>

        {/* Críticos */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: '20px',
          padding: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(239, 68, 68, 0.3)'
          }}>
            <XCircle style={{ width: '28px', height: '28px', color: 'white' }} />
          </div>
          <div>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 4px 0' }}>Em Estado Crítico</p>
            <p style={{ color: 'white', fontSize: '32px', fontWeight: 'bold', margin: 0 }}>{stats.critico}</p>
          </div>
        </div>
      </div>

      {/* Grid de Seções */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '24px'
      }}>
        {/* Clientes que precisam de atenção */}
        <div style={{
          background: 'rgba(30, 27, 75, 0.4)',
          border: '1px solid rgba(139, 92, 246, 0.15)',
          borderRadius: '20px',
          padding: '24px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <AlertTriangle style={{ width: '20px', height: '20px', color: '#f59e0b' }} />
              <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>
                Clientes em Atenção
              </h2>
            </div>
            <button
              onClick={() => navigate('/clientes')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: 'none',
                border: 'none',
                color: '#8b5cf6',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Ver todos
              <ChevronRight style={{ width: '16px', height: '16px' }} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {clientesAtencao.length > 0 ? clientesAtencao.map((cliente) => (
              <div
                key={cliente.id}
                onClick={() => navigate(`/clientes/${cliente.id}`)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px',
                  background: 'rgba(15, 10, 31, 0.6)',
                  border: '1px solid rgba(139, 92, 246, 0.1)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: '600',
                    fontSize: '16px'
                  }}>
                    {cliente.team_name?.charAt(0) || 'C'}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: 'white', fontWeight: '500' }}>{cliente.team_name}</span>
                      <span style={{
                        padding: '2px 8px',
                        background: `${getHealthColor(cliente.health_status)}20`,
                        color: getHealthColor(cliente.health_status),
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}>
                        {getHealthLabel(cliente.health_status)}
                      </span>
                    </div>
                    <span style={{ color: '#64748b', fontSize: '13px' }}>{cliente.responsavel_nome || 'Sem responsável'}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '4px'
                  }}>
                    <div style={{
                      width: '80px',
                      height: '6px',
                      background: 'rgba(255,255,255,0.1)',
                      borderRadius: '3px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${cliente.health_score || 0}%`,
                        height: '100%',
                        background: getHealthColor(cliente.health_status),
                        borderRadius: '3px'
                      }}></div>
                    </div>
                    <span style={{ color: getHealthColor(cliente.health_status), fontSize: '14px', fontWeight: '600' }}>
                      {cliente.health_score || 0}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b', fontSize: '12px' }}>
                    <Clock style={{ width: '12px', height: '12px' }} />
                    {formatDate(cliente.ultima_interacao)}
                  </div>
                </div>
              </div>
            )) : (
              <div style={{
                padding: '32px',
                textAlign: 'center',
                color: '#64748b'
              }}>
                {hasActiveFilters ? 'Nenhum cliente encontrado com os filtros aplicados' : 'Todos os clientes estão saudáveis! 🎉'}
              </div>
            )}
          </div>
        </div>

        {/* Distribuição por Status */}
        <div style={{
          background: 'rgba(30, 27, 75, 0.4)',
          border: '1px solid rgba(139, 92, 246, 0.15)',
          borderRadius: '20px',
          padding: '24px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '24px'
          }}>
            <TrendingUp style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
            <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>
              Distribuição por Status
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[
              { label: 'Saudáveis', value: stats.saudaveis, color: '#10b981' },
              { label: 'Atenção', value: stats.atencao, color: '#f59e0b' },
              { label: 'Risco', value: stats.risco, color: '#f97316' },
              { label: 'Crítico', value: stats.critico, color: '#ef4444' }
            ].map((item, index) => (
              <div key={index}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '8px'
                }}>
                  <span style={{ color: '#e2e8f0', fontSize: '14px' }}>{item.label}</span>
                  <span style={{ color: 'white', fontWeight: '600' }}>
                    {item.value} <span style={{ color: '#64748b', fontWeight: '400' }}>
                      ({stats.total > 0 ? Math.round((item.value / stats.total) * 100) : 0}%)
                    </span>
                  </span>
                </div>
                <div style={{
                  width: '100%',
                  height: '8px',
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: stats.total > 0 ? `${(item.value / stats.total) * 100}%` : '0%',
                    height: '100%',
                    background: item.color,
                    borderRadius: '4px',
                    transition: 'width 0.5s ease'
                  }}></div>
                </div>
              </div>
            ))}
          </div>

          {/* Resumo */}
          <div style={{
            marginTop: '24px',
            padding: '16px',
            background: 'rgba(139, 92, 246, 0.1)',
            border: '1px solid rgba(139, 92, 246, 0.2)',
            borderRadius: '12px'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ color: '#94a3b8', fontSize: '14px' }}>Taxa de clientes saudáveis</span>
              <span style={{ color: '#10b981', fontSize: '20px', fontWeight: 'bold' }}>
                {stats.total > 0 ? Math.round((stats.saudaveis / stats.total) * 100) : 0}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
