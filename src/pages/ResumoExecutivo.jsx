import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, Users, Award, Star, Check, Search,
  ChevronDown, ChevronUp, ExternalLink, Filter
} from 'lucide-react';

// Níveis de tempo em crescimento
const NIVEIS_CRESCIMENTO = [
  { min: 60, label: '60+ dias', color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.15)' },
  { min: 30, label: '30+ dias', color: '#8b5cf6', bgColor: 'rgba(139, 92, 246, 0.15)' },
  { min: 0, label: 'Recente', color: '#06b6d4', bgColor: 'rgba(6, 182, 212, 0.15)' },
];

const getNivelCrescimento = (dias) => {
  for (const nivel of NIVEIS_CRESCIMENTO) {
    if (dias >= nivel.min) return nivel;
  }
  return NIVEIS_CRESCIMENTO[NIVEIS_CRESCIMENTO.length - 1];
};

export default function ResumoExecutivo() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [clientes, setClientes] = useState([]);
  const [transicoes, setTransicoes] = useState({});
  const [usuariosCount, setUsuariosCount] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('dias'); // dias, usuarios, vezes, nome
  const [sortOrder, setSortOrder] = useState('desc');
  const [filtroNivel, setFiltroNivel] = useState('todos'); // todos, 60, 30, recente
  const [filtroCase, setFiltroCase] = useState('todos'); // todos, obtido, pendente
  const [updatingCase, setUpdatingCase] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Buscar clientes em CRESCIMENTO
        const [clientesSnap, transicoesSnap, usuariosSnap] = await Promise.all([
          getDocs(query(collection(db, 'clientes'), where('segmento_cs', '==', 'CRESCIMENTO'))),
          getDocs(query(collection(db, 'interacoes'), where('tipo', '==', 'transicao_nivel'))),
          getDocs(collection(db, 'usuarios_lookup'))
        ]);

        const clientesData = clientesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setClientes(clientesData);

        // Agrupar transições por cliente
        const transicoesMap = {};
        transicoesSnap.docs.forEach(d => {
          const data = d.data();
          const clienteId = data.cliente_id;
          if (!transicoesMap[clienteId]) {
            transicoesMap[clienteId] = [];
          }
          transicoesMap[clienteId].push({
            id: d.id,
            ...data,
            data: data.data?.toDate?.() || new Date(data.data)
          });
        });
        // Ordenar transições por data (mais recente primeiro)
        Object.keys(transicoesMap).forEach(clienteId => {
          transicoesMap[clienteId].sort((a, b) => b.data - a.data);
        });
        setTransicoes(transicoesMap);

        // Contar usuários por time
        const usuariosMap = {};
        usuariosSnap.docs.forEach(d => {
          const data = d.data();
          const teamId = data.team_id;
          if (teamId) {
            usuariosMap[teamId] = (usuariosMap[teamId] || 0) + 1;
          }
        });
        setUsuariosCount(usuariosMap);

      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Calcular dias em crescimento (desde última transição para CRESCIMENTO)
  const calcularDiasEmCrescimento = (clienteId) => {
    const clienteTransicoes = transicoes[clienteId] || [];
    // Encontrar última transição para CRESCIMENTO
    const ultimaParaCrescimento = clienteTransicoes.find(t => t.segmento_novo === 'CRESCIMENTO');
    if (!ultimaParaCrescimento) return 0;

    const hoje = new Date();
    const dataTransicao = ultimaParaCrescimento.data;
    const diffTime = Math.abs(hoje - dataTransicao);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Contar vezes que atingiu CRESCIMENTO
  const contarVezesEmCrescimento = (clienteId) => {
    const clienteTransicoes = transicoes[clienteId] || [];
    return clienteTransicoes.filter(t => t.segmento_novo === 'CRESCIMENTO').length;
  };

  // Contar usuários do cliente
  const contarUsuarios = (cliente) => {
    const timeIds = cliente.times || [cliente.team_id || cliente.id];
    let total = 0;
    timeIds.forEach(tid => {
      total += usuariosCount[tid] || 0;
    });
    return total;
  };

  // Toggle case obtido
  const toggleCase = async (clienteId, currentValue) => {
    setUpdatingCase(clienteId);
    try {
      await updateDoc(doc(db, 'clientes', clienteId), {
        case_obtido: !currentValue
      });
      setClientes(prev => prev.map(c =>
        c.id === clienteId ? { ...c, case_obtido: !currentValue } : c
      ));
    } catch (error) {
      console.error('Erro ao atualizar case:', error);
    } finally {
      setUpdatingCase(null);
    }
  };

  // Preparar dados para exibição
  const clientesComDados = clientes.map(cliente => ({
    ...cliente,
    diasEmCrescimento: calcularDiasEmCrescimento(cliente.id),
    vezesEmCrescimento: contarVezesEmCrescimento(cliente.id),
    totalUsuarios: contarUsuarios(cliente),
    stakeholders: cliente.stakeholders || []
  }));

  // Filtrar
  const clientesFiltrados = clientesComDados.filter(c => {
    // Busca por nome
    if (searchTerm) {
      const nome = (c.nome || c.team_name || '').toLowerCase();
      if (!nome.includes(searchTerm.toLowerCase())) return false;
    }
    // Filtro por nível de crescimento
    if (filtroNivel !== 'todos') {
      const dias = c.diasEmCrescimento;
      if (filtroNivel === '60' && dias < 60) return false;
      if (filtroNivel === '30' && (dias < 30 || dias >= 60)) return false;
      if (filtroNivel === 'recente' && dias >= 30) return false;
    }
    // Filtro por case
    if (filtroCase === 'obtido' && !c.case_obtido) return false;
    if (filtroCase === 'pendente' && c.case_obtido) return false;
    return true;
  });

  // Ordenar
  const clientesOrdenados = [...clientesFiltrados].sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'dias':
        comparison = a.diasEmCrescimento - b.diasEmCrescimento;
        break;
      case 'usuarios':
        comparison = a.totalUsuarios - b.totalUsuarios;
        break;
      case 'vezes':
        comparison = a.vezesEmCrescimento - b.vezesEmCrescimento;
        break;
      case 'nome':
        comparison = (a.nome || a.team_name || '').localeCompare(b.nome || b.team_name || '');
        break;
      default:
        comparison = 0;
    }
    return sortOrder === 'desc' ? -comparison : comparison;
  });

  // Estatísticas
  const stats = {
    total: clientesComDados.length,
    com60Dias: clientesComDados.filter(c => c.diasEmCrescimento >= 60).length,
    com30Dias: clientesComDados.filter(c => c.diasEmCrescimento >= 30 && c.diasEmCrescimento < 60).length,
    caseObtido: clientesComDados.filter(c => c.case_obtido).length,
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f0a1f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '48px', height: '48px', border: '3px solid rgba(139, 92, 246, 0.2)', borderTopColor: '#8b5cf6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ padding: '32px', background: '#0f0a1f', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            background: 'linear-gradient(135deg, #10b981 0%, #8b5cf6 100%)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3)'
          }}>
            <TrendingUp style={{ width: '28px', height: '28px', color: 'white' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: 'white', margin: 0 }}>
              Oportunidades de Vendas
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: '4px 0 0 0' }}>
              Clientes em crescimento prontos para expansão
            </p>
          </div>
        </div>
      </div>

      {/* Cards de estatísticas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{
          background: 'rgba(30, 27, 75, 0.4)',
          border: '1px solid rgba(139, 92, 246, 0.15)',
          borderRadius: '16px',
          padding: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <TrendingUp style={{ width: '20px', height: '20px', color: '#10b981' }} />
            <span style={{ color: '#94a3b8', fontSize: '13px' }}>Em Crescimento</span>
          </div>
          <p style={{ color: 'white', fontSize: '32px', fontWeight: '700', margin: 0 }}>{stats.total}</p>
        </div>

        <div style={{
          background: 'rgba(30, 27, 75, 0.4)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '16px',
          padding: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <Award style={{ width: '20px', height: '20px', color: '#10b981' }} />
            <span style={{ color: '#94a3b8', fontSize: '13px' }}>60+ dias</span>
          </div>
          <p style={{ color: '#10b981', fontSize: '32px', fontWeight: '700', margin: 0 }}>{stats.com60Dias}</p>
        </div>

        <div style={{
          background: 'rgba(30, 27, 75, 0.4)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          borderRadius: '16px',
          padding: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <Star style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
            <span style={{ color: '#94a3b8', fontSize: '13px' }}>30+ dias</span>
          </div>
          <p style={{ color: '#8b5cf6', fontSize: '32px', fontWeight: '700', margin: 0 }}>{stats.com30Dias}</p>
        </div>

        <div style={{
          background: 'rgba(30, 27, 75, 0.4)',
          border: '1px solid rgba(6, 182, 212, 0.3)',
          borderRadius: '16px',
          padding: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <Check style={{ width: '20px', height: '20px', color: '#06b6d4' }} />
            <span style={{ color: '#94a3b8', fontSize: '13px' }}>Case Obtido</span>
          </div>
          <p style={{ color: '#06b6d4', fontSize: '32px', fontWeight: '700', margin: 0 }}>{stats.caseObtido}</p>
        </div>
      </div>

      {/* Filtros */}
      <div style={{
        background: 'rgba(30, 27, 75, 0.4)',
        border: '1px solid rgba(139, 92, 246, 0.15)',
        borderRadius: '16px',
        padding: '16px 20px',
        marginBottom: '20px',
        display: 'flex',
        gap: '16px',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        {/* Busca */}
        <div style={{ position: 'relative', flex: 1, minWidth: '200px', maxWidth: '300px' }}>
          <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#64748b' }} />
          <input
            type="text"
            placeholder="Buscar cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 38px',
              background: '#0f0a1f',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '10px',
              color: 'white',
              fontSize: '13px',
              outline: 'none'
            }}
          />
        </div>

        {/* Filtro por nível */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter style={{ width: '16px', height: '16px', color: '#64748b' }} />
          <select
            value={filtroNivel}
            onChange={(e) => setFiltroNivel(e.target.value)}
            style={{
              padding: '10px 14px',
              background: '#0f0a1f',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '10px',
              color: 'white',
              fontSize: '13px',
              outline: 'none'
            }}
          >
            <option value="todos">Todos os níveis</option>
            <option value="60">60+ dias</option>
            <option value="30">30-59 dias</option>
            <option value="recente">Menos de 30 dias</option>
          </select>
        </div>

        {/* Filtro por case */}
        <select
          value={filtroCase}
          onChange={(e) => setFiltroCase(e.target.value)}
          style={{
            padding: '10px 14px',
            background: '#0f0a1f',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '10px',
            color: 'white',
            fontSize: '13px',
            outline: 'none'
          }}
        >
          <option value="todos">Case: Todos</option>
          <option value="obtido">Case obtido</option>
          <option value="pendente">Case pendente</option>
        </select>

        {/* Contador */}
        <span style={{ color: '#64748b', fontSize: '13px', marginLeft: 'auto' }}>
          {clientesOrdenados.length} cliente{clientesOrdenados.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Tabela */}
      <div style={{
        background: 'rgba(30, 27, 75, 0.4)',
        border: '1px solid rgba(139, 92, 246, 0.15)',
        borderRadius: '16px',
        overflow: 'hidden'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(139, 92, 246, 0.08)' }}>
              <th
                onClick={() => handleSort('nome')}
                style={{
                  padding: '14px 20px', textAlign: 'left', color: '#94a3b8', fontSize: '12px',
                  fontWeight: '600', textTransform: 'uppercase', cursor: 'pointer',
                  borderBottom: '1px solid rgba(139, 92, 246, 0.15)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  Cliente
                  {sortBy === 'nome' && (sortOrder === 'desc' ? <ChevronDown style={{ width: '14px', height: '14px' }} /> : <ChevronUp style={{ width: '14px', height: '14px' }} />)}
                </div>
              </th>
              <th
                onClick={() => handleSort('usuarios')}
                style={{
                  padding: '14px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '12px',
                  fontWeight: '600', textTransform: 'uppercase', cursor: 'pointer', width: '100px',
                  borderBottom: '1px solid rgba(139, 92, 246, 0.15)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  Usuários
                  {sortBy === 'usuarios' && (sortOrder === 'desc' ? <ChevronDown style={{ width: '14px', height: '14px' }} /> : <ChevronUp style={{ width: '14px', height: '14px' }} />)}
                </div>
              </th>
              <th
                onClick={() => handleSort('dias')}
                style={{
                  padding: '14px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '12px',
                  fontWeight: '600', textTransform: 'uppercase', cursor: 'pointer', width: '140px',
                  borderBottom: '1px solid rgba(139, 92, 246, 0.15)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  Dias Cresc.
                  {sortBy === 'dias' && (sortOrder === 'desc' ? <ChevronDown style={{ width: '14px', height: '14px' }} /> : <ChevronUp style={{ width: '14px', height: '14px' }} />)}
                </div>
              </th>
              <th
                onClick={() => handleSort('vezes')}
                style={{
                  padding: '14px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '12px',
                  fontWeight: '600', textTransform: 'uppercase', cursor: 'pointer', width: '100px',
                  borderBottom: '1px solid rgba(139, 92, 246, 0.15)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  Vezes
                  {sortBy === 'vezes' && (sortOrder === 'desc' ? <ChevronDown style={{ width: '14px', height: '14px' }} /> : <ChevronUp style={{ width: '14px', height: '14px' }} />)}
                </div>
              </th>
              <th style={{
                padding: '14px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '12px',
                fontWeight: '600', textTransform: 'uppercase', width: '120px',
                borderBottom: '1px solid rgba(139, 92, 246, 0.15)'
              }}>
                Stakeholders
              </th>
              <th style={{
                padding: '14px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '12px',
                fontWeight: '600', textTransform: 'uppercase', width: '80px',
                borderBottom: '1px solid rgba(139, 92, 246, 0.15)'
              }}>
                Case
              </th>
            </tr>
          </thead>
          <tbody>
            {clientesOrdenados.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                  Nenhum cliente encontrado com os filtros selecionados
                </td>
              </tr>
            ) : (
              clientesOrdenados.map((cliente, idx) => {
                const nivel = getNivelCrescimento(cliente.diasEmCrescimento);
                return (
                  <tr
                    key={cliente.id}
                    style={{
                      background: idx % 2 === 0 ? 'transparent' : 'rgba(15, 10, 31, 0.3)',
                      borderBottom: '1px solid rgba(139, 92, 246, 0.05)'
                    }}
                  >
                    {/* Nome */}
                    <td style={{ padding: '14px 20px' }}>
                      <button
                        onClick={() => navigate(`/clientes/${cliente.id}`)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'white',
                          fontSize: '14px',
                          fontWeight: '500',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: 0
                        }}
                      >
                        {cliente.nome || cliente.team_name}
                        <ExternalLink style={{ width: '14px', height: '14px', color: '#64748b' }} />
                      </button>
                    </td>

                    {/* Usuários */}
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <Users style={{ width: '14px', height: '14px', color: '#64748b' }} />
                        <span style={{ color: '#e2e8f0', fontSize: '14px', fontWeight: '600' }}>
                          {cliente.totalUsuarios}
                        </span>
                      </div>
                    </td>

                    {/* Dias em Crescimento */}
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <span style={{
                        padding: '4px 12px',
                        background: nivel.bgColor,
                        color: nivel.color,
                        borderRadius: '20px',
                        fontSize: '13px',
                        fontWeight: '600'
                      }}>
                        {cliente.diasEmCrescimento} dias
                      </span>
                    </td>

                    {/* Vezes em Crescimento */}
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <span style={{ color: '#94a3b8', fontSize: '14px' }}>
                        {cliente.vezesEmCrescimento}x
                      </span>
                    </td>

                    {/* Stakeholders */}
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <span style={{
                        color: cliente.stakeholders.length > 0 ? '#e2e8f0' : '#64748b',
                        fontSize: '14px'
                      }}>
                        {cliente.stakeholders.length} contato{cliente.stakeholders.length !== 1 ? 's' : ''}
                      </span>
                    </td>

                    {/* Case */}
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <button
                        onClick={() => toggleCase(cliente.id, cliente.case_obtido)}
                        disabled={updatingCase === cliente.id}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          border: `2px solid ${cliente.case_obtido ? '#10b981' : '#3730a3'}`,
                          background: cliente.case_obtido ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        {updatingCase === cliente.id ? (
                          <div style={{ width: '14px', height: '14px', border: '2px solid #8b5cf6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                        ) : cliente.case_obtido ? (
                          <Check style={{ width: '18px', height: '18px', color: '#10b981' }} />
                        ) : null}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Legenda */}
      <div style={{
        marginTop: '20px',
        padding: '16px 20px',
        background: 'rgba(30, 27, 75, 0.3)',
        borderRadius: '12px',
        display: 'flex',
        gap: '24px',
        alignItems: 'center'
      }}>
        <span style={{ color: '#64748b', fontSize: '12px', fontWeight: '600' }}>LEGENDA:</span>
        {NIVEIS_CRESCIMENTO.map(nivel => (
          <div key={nivel.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '4px', background: nivel.color }} />
            <span style={{ color: '#94a3b8', fontSize: '12px' }}>{nivel.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
