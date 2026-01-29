import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { getThreadsByTeam } from '../services/api';
import {
  Briefcase, Users, MessageSquare, AlertTriangle, ChevronRight,
  Clock, TrendingUp, TrendingDown, Activity, Bell, CheckCircle,
  XCircle, Calendar, ArrowUpRight, ChevronDown, Lock
} from 'lucide-react';
import { getHealthColor, getHealthLabel } from '../utils/healthScore';
import { STATUS_OPTIONS, getStatusColor, getStatusLabel } from '../utils/clienteStatus';

export default function MinhaCarteira() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [clientes, setClientes] = useState([]);
  const [threads, setThreads] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responsaveis, setResponsaveis] = useState([]);
  const [selectedResponsavel, setSelectedResponsavel] = useState(null);
  const [filterStatus, setFilterStatus] = useState(['ativo', 'onboarding', 'aviso_previo']); // Status do cadastro (default: todos menos inativo/cancelado)
  const [allClientes, setAllClientes] = useState([]); // Todos os clientes sem filtro de status
  const [stats, setStats] = useState({
    total: 0,
    saudaveis: 0,
    atencao: 0,
    risco: 0,
    critico: 0,
    threadsPendentes: 0,
    alertasPendentes: 0
  });

  // Buscar lista de responsáveis (usuários CS) ao carregar
  useEffect(() => {
    const fetchResponsaveis = async () => {
      try {
        const usuariosRef = collection(db, 'usuarios_sistema');
        const snapshot = await getDocs(usuariosRef);
        const usuarios = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(u => u.ativo !== false && (u.role === 'cs' || u.role === 'gestor' || u.role === 'admin' || u.role === 'super_admin'))
          .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        setResponsaveis(usuarios);

        // Default: usuário logado
        if (user?.email) {
          setSelectedResponsavel(user.email);
        }
      } catch (error) {
        console.error('Erro ao buscar responsáveis:', error);
      }
    };
    fetchResponsaveis();
  }, [user?.email]);

  useEffect(() => {
    if (!selectedResponsavel) return;
    fetchData(selectedResponsavel);
  }, [selectedResponsavel]);

  // Filtrar clientes por status do cadastro (client-side)
  useEffect(() => {
    let filtered = allClientes;

    // Filtrar por status do cadastro
    if (filterStatus.length > 0 && filterStatus.length < STATUS_OPTIONS.length) {
      filtered = filtered.filter(c => filterStatus.includes(c.status || 'ativo'));
    }

    setClientes(filtered);
  }, [filterStatus, allClientes]);

  const fetchData = async (responsavelEmail) => {
    try {
      setLoading(true);
      const clientesRef = collection(db, 'clientes');
      let clientesData = [];

      if (responsavelEmail === 'todos') {
        // Buscar todos os clientes
        const allClientesSnap = await getDocs(clientesRef);
        clientesData = allClientesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } else {
        // Buscar clientes onde o usuário é responsável
        const [queryLegado, queryArray] = await Promise.all([
          getDocs(query(clientesRef, where('responsavel_email', '==', responsavelEmail))),
          getDocs(query(clientesRef, where('responsaveis', 'array-contains', { email: responsavelEmail, nome: '' })))
        ]);

        // Combinar resultados únicos
        const clientesMap = new Map();

        queryLegado.docs.forEach(doc => {
          clientesMap.set(doc.id, { id: doc.id, ...doc.data() });
        });

        queryArray.docs.forEach(doc => {
          if (!clientesMap.has(doc.id)) {
            clientesMap.set(doc.id, { id: doc.id, ...doc.data() });
          }
        });

        // Também buscar por email no array de responsaveis (match parcial)
        const allClientesSnap = await getDocs(clientesRef);
        allClientesSnap.docs.forEach(doc => {
          const data = doc.data();
          if (data.responsaveis && Array.isArray(data.responsaveis)) {
            const isResponsavel = data.responsaveis.some(r => r.email === responsavelEmail);
            if (isResponsavel && !clientesMap.has(doc.id)) {
              clientesMap.set(doc.id, { id: doc.id, ...data });
            }
          }
        });

        clientesData = Array.from(clientesMap.values());
      }

      // Ordenar por health_score (menor primeiro = mais crítico)
      clientesData.sort((a, b) => (a.health_score || 0) - (b.health_score || 0));
      setAllClientes(clientesData);

      // Aplicar filtro de status inicial
      let filtered = clientesData;
      if (filterStatus.length > 0 && filterStatus.length < STATUS_OPTIONS.length) {
        filtered = filtered.filter(c => filterStatus.includes(c.status || 'ativo'));
      }
      setClientes(filtered);

      // Calcular stats
      const statsCalc = {
        total: clientesData.length,
        saudaveis: clientesData.filter(c => c.health_status === 'saudavel').length,
        atencao: clientesData.filter(c => c.health_status === 'atencao').length,
        risco: clientesData.filter(c => c.health_status === 'risco').length,
        critico: clientesData.filter(c => c.health_status === 'critico').length,
        threadsPendentes: 0,
        alertasPendentes: 0
      };

      // 2. Buscar threads pendentes dos clientes
      if (clientesData.length > 0) {
        const allTeamIds = clientesData.flatMap(c => c.times || [c.team_id || c.id]).filter(Boolean);

        if (allTeamIds.length > 0) {
          const threadsData = await getThreadsByTeam(allTeamIds);
          const pendentes = threadsData.filter(t =>
            t.status === 'aguardando_equipe' || t.status === 'ativo'
          );

          // Ordenar por data mais recente
          pendentes.sort((a, b) => {
            const dateA = a.updated_at?.toDate?.() || new Date(a.updated_at || 0);
            const dateB = b.updated_at?.toDate?.() || new Date(b.updated_at || 0);
            return dateB - dateA;
          });

          setThreads(pendentes.slice(0, 10)); // Top 10
          statsCalc.threadsPendentes = pendentes.length;
        }
      }

      // 3. Buscar alertas pendentes
      const alertasRef = collection(db, 'alertas');
      const alertasQuery = query(
        alertasRef,
        where('responsavel_email', '==', responsavelEmail),
        where('status', '==', 'pendente'),
        orderBy('created_at', 'desc'),
        limit(10)
      );

      try {
        const alertasSnap = await getDocs(alertasQuery);
        const alertasData = alertasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAlertas(alertasData);
        statsCalc.alertasPendentes = alertasData.length;
      } catch (e) {
        // Pode falhar se não tiver índice, ignorar silenciosamente
        console.log('Alertas query failed, skipping');
      }

      setStats(statsCalc);
    } catch (error) {
      console.error('Erro ao buscar dados da carteira:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatRelativeDate = (timestamp) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}min atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays === 1) return 'Ontem';
    if (diffDays < 7) return `${diffDays} dias atrás`;
    return date.toLocaleDateString('pt-BR');
  };

  const getStatusColor = (status) => {
    const colors = {
      aguardando_equipe: '#f59e0b',
      aguardando_cliente: '#06b6d4',
      ativo: '#8b5cf6',
      resolvido: '#10b981'
    };
    return colors[status] || '#64748b';
  };

  const getStatusLabel = (status) => {
    const labels = {
      aguardando_equipe: 'Aguardando Você',
      aguardando_cliente: 'Aguardando Cliente',
      ativo: 'Ativo',
      resolvido: 'Resolvido'
    };
    return labels[status] || status;
  };

  const getClienteNameByTeamId = (teamId) => {
    const cliente = clientes.find(c =>
      c.times?.includes(teamId) || c.team_id === teamId || c.id === teamId
    );
    return cliente?.team_name || 'Cliente';
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
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '56px',
              height: '56px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(139, 92, 246, 0.3)'
            }}>
              <Briefcase style={{ width: '28px', height: '28px', color: 'white' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: 'white', margin: 0 }}>
                {selectedResponsavel === user?.email ? 'Minha Carteira' : selectedResponsavel === 'todos' ? 'Todos os Clientes' : 'Carteira'}
              </h1>
              <p style={{ color: '#94a3b8', fontSize: '14px', margin: '4px 0 0 0' }}>
                {clientes.length} cliente{clientes.length !== 1 ? 's' : ''} {selectedResponsavel === 'todos' ? '' : 'sob responsabilidade'}
              </p>
            </div>
          </div>

          {/* Filtros */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Filtro por Responsável */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#64748b', fontSize: '13px' }}>Responsável:</span>
              <div style={{ position: 'relative' }}>
                <select
                  value={selectedResponsavel || ''}
                  onChange={(e) => setSelectedResponsavel(e.target.value)}
                  style={{
                    appearance: 'none',
                    padding: '10px 36px 10px 14px',
                    background: 'rgba(30, 27, 75, 0.6)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '10px',
                    color: 'white',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    outline: 'none',
                    minWidth: '180px'
                  }}
                >
                  <option value="todos" style={{ background: '#1e1b4b' }}>Todos</option>
                  {responsaveis.map((resp) => (
                    <option key={resp.id} value={resp.email} style={{ background: '#1e1b4b' }}>
                      {resp.email === user?.email ? `${resp.nome} (Você)` : resp.nome}
                    </option>
                  ))}
                </select>
                <ChevronDown style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '16px',
                  height: '16px',
                  color: '#8b5cf6',
                  pointerEvents: 'none'
                }} />
              </div>
            </div>

            {/* Filtro por Status do Cadastro */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#64748b', fontSize: '13px' }}>Status:</span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {STATUS_OPTIONS.map((statusOpt) => {
                  const isSelected = filterStatus.includes(statusOpt.value);
                  return (
                    <button
                      key={statusOpt.value}
                      onClick={() => {
                        if (isSelected) {
                          setFilterStatus(filterStatus.filter(s => s !== statusOpt.value));
                        } else {
                          setFilterStatus([...filterStatus, statusOpt.value]);
                        }
                      }}
                      style={{
                        padding: '6px 12px',
                        background: isSelected ? `${statusOpt.color}20` : 'rgba(30, 27, 75, 0.6)',
                        border: `1px solid ${isSelected ? statusOpt.color : 'rgba(139, 92, 246, 0.2)'}`,
                        borderRadius: '8px',
                        color: isSelected ? statusOpt.color : '#64748b',
                        fontSize: '12px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {statusOpt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '32px' }}>
        <div style={{
          background: 'rgba(30, 27, 75, 0.4)',
          border: '1px solid rgba(139, 92, 246, 0.15)',
          borderRadius: '16px',
          padding: '20px',
          textAlign: 'center'
        }}>
          <Users style={{ width: '24px', height: '24px', color: '#8b5cf6', margin: '0 auto 8px' }} />
          <p style={{ color: 'white', fontSize: '28px', fontWeight: '700', margin: '0 0 4px 0' }}>{stats.total}</p>
          <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>Total</p>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(30, 27, 75, 0.4) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          borderRadius: '16px',
          padding: '20px',
          textAlign: 'center'
        }}>
          <CheckCircle style={{ width: '24px', height: '24px', color: '#10b981', margin: '0 auto 8px' }} />
          <p style={{ color: '#10b981', fontSize: '28px', fontWeight: '700', margin: '0 0 4px 0' }}>{stats.saudaveis}</p>
          <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>Saudáveis</p>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(30, 27, 75, 0.4) 100%)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          borderRadius: '16px',
          padding: '20px',
          textAlign: 'center'
        }}>
          <AlertTriangle style={{ width: '24px', height: '24px', color: '#f59e0b', margin: '0 auto 8px' }} />
          <p style={{ color: '#f59e0b', fontSize: '28px', fontWeight: '700', margin: '0 0 4px 0' }}>{stats.atencao}</p>
          <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>Atenção</p>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.1) 0%, rgba(30, 27, 75, 0.4) 100%)',
          border: '1px solid rgba(249, 115, 22, 0.2)',
          borderRadius: '16px',
          padding: '20px',
          textAlign: 'center'
        }}>
          <TrendingDown style={{ width: '24px', height: '24px', color: '#f97316', margin: '0 auto 8px' }} />
          <p style={{ color: '#f97316', fontSize: '28px', fontWeight: '700', margin: '0 0 4px 0' }}>{stats.risco}</p>
          <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>Risco</p>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(30, 27, 75, 0.4) 100%)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: '16px',
          padding: '20px',
          textAlign: 'center'
        }}>
          <XCircle style={{ width: '24px', height: '24px', color: '#ef4444', margin: '0 auto 8px' }} />
          <p style={{ color: '#ef4444', fontSize: '28px', fontWeight: '700', margin: '0 0 4px 0' }}>{stats.critico}</p>
          <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>Crítico</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        {/* Lista de Clientes */}
        <div style={{
          background: 'rgba(30, 27, 75, 0.4)',
          border: '1px solid rgba(139, 92, 246, 0.15)',
          borderRadius: '20px',
          padding: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Activity style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
              <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>Meus Clientes</h2>
            </div>
            <span style={{ color: '#64748b', fontSize: '13px' }}>Ordenado por prioridade</span>
          </div>

          {clientes.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {clientes.map((cliente) => (
                <div
                  key={cliente.id}
                  onClick={() => navigate(`/clientes/${cliente.id}`)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    padding: '16px',
                    background: 'rgba(15, 10, 31, 0.6)',
                    border: `1px solid ${getHealthColor(cliente.health_status)}30`,
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {/* Health Score Circle */}
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: `${getHealthColor(cliente.health_status)}20`,
                    border: `2px solid ${getHealthColor(cliente.health_status)}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <span style={{ color: getHealthColor(cliente.health_status), fontSize: '14px', fontWeight: '700' }}>
                      {cliente.health_score || 0}
                    </span>
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: 'white', fontSize: '15px', fontWeight: '600', margin: '0 0 4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {cliente.team_name}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{
                        padding: '2px 8px',
                        background: `${getHealthColor(cliente.health_status)}20`,
                        color: getHealthColor(cliente.health_status),
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '500'
                      }}>
                        {getHealthLabel(cliente.health_status)}
                      </span>
                      {cliente.ultima_interacao && (
                        <span style={{ color: '#64748b', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock style={{ width: '12px', height: '12px' }} />
                          {formatRelativeDate(cliente.ultima_interacao)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Arrow */}
                  <ChevronRight style={{ width: '20px', height: '20px', color: '#64748b', flexShrink: 0 }} />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '48px', textAlign: 'center' }}>
              <Briefcase style={{ width: '48px', height: '48px', color: '#64748b', margin: '0 auto 16px' }} />
              <p style={{ color: '#94a3b8', fontSize: '16px', margin: '0 0 8px 0' }}>Nenhum cliente atribuído</p>
              <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
                Peça a um gestor para atribuir clientes à sua carteira
              </p>
            </div>
          )}
        </div>

        {/* Painel Lateral - Threads e Alertas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Threads Pendentes */}
          <div style={{
            background: 'rgba(30, 27, 75, 0.4)',
            border: '1px solid rgba(245, 158, 11, 0.2)',
            borderRadius: '20px',
            padding: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <MessageSquare style={{ width: '18px', height: '18px', color: '#f59e0b' }} />
                <h3 style={{ color: 'white', fontSize: '15px', fontWeight: '600', margin: 0 }}>Aguardando Resposta</h3>
              </div>
              {stats.threadsPendentes > 0 && (
                <span style={{
                  padding: '2px 8px',
                  background: 'rgba(245, 158, 11, 0.2)',
                  color: '#f59e0b',
                  borderRadius: '10px',
                  fontSize: '12px',
                  fontWeight: '600'
                }}>
                  {stats.threadsPendentes}
                </span>
              )}
            </div>

            {threads.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {threads.slice(0, 5).map((thread) => (
                  <div
                    key={thread.id}
                    onClick={() => {
                      const cliente = clientes.find(c =>
                        c.times?.includes(thread.team_id) || c.team_id === thread.team_id || c.id === thread.team_id
                      );
                      if (cliente) navigate(`/clientes/${cliente.id}`);
                    }}
                    style={{
                      padding: '12px',
                      background: 'rgba(15, 10, 31, 0.6)',
                      border: '1px solid rgba(139, 92, 246, 0.1)',
                      borderRadius: '10px',
                      cursor: 'pointer'
                    }}
                  >
                    <p style={{ color: 'white', fontSize: '13px', fontWeight: '500', margin: '0 0 4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {thread.assunto || thread.subject || 'Sem assunto'}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8', fontSize: '11px' }}>
                        {getClienteNameByTeamId(thread.team_id)}
                      </span>
                      <span style={{ color: '#64748b', fontSize: '11px' }}>
                        {formatRelativeDate(thread.updated_at)}
                      </span>
                    </div>
                  </div>
                ))}
                {threads.length > 5 && (
                  <button
                    onClick={() => navigate('/alertas')}
                    style={{
                      padding: '10px',
                      background: 'transparent',
                      border: '1px dashed rgba(245, 158, 11, 0.3)',
                      borderRadius: '10px',
                      color: '#f59e0b',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    Ver mais {threads.length - 5} conversas
                    <ArrowUpRight style={{ width: '14px', height: '14px' }} />
                  </button>
                )}
              </div>
            ) : (
              <p style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '16px 0', margin: 0 }}>
                Nenhuma conversa pendente
              </p>
            )}
          </div>

          {/* Alertas */}
          <div style={{
            background: 'rgba(30, 27, 75, 0.4)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '20px',
            padding: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Bell style={{ width: '18px', height: '18px', color: '#ef4444' }} />
                <h3 style={{ color: 'white', fontSize: '15px', fontWeight: '600', margin: 0 }}>Alertas</h3>
              </div>
              {stats.alertasPendentes > 0 && (
                <span style={{
                  padding: '2px 8px',
                  background: 'rgba(239, 68, 68, 0.2)',
                  color: '#ef4444',
                  borderRadius: '10px',
                  fontSize: '12px',
                  fontWeight: '600'
                }}>
                  {stats.alertasPendentes}
                </span>
              )}
            </div>

            {alertas.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {alertas.slice(0, 5).map((alerta) => (
                  <div
                    key={alerta.id}
                    onClick={() => navigate('/alertas')}
                    style={{
                      padding: '12px',
                      background: 'rgba(15, 10, 31, 0.6)',
                      border: `1px solid ${alerta.prioridade === 'urgente' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(139, 92, 246, 0.1)'}`,
                      borderRadius: '10px',
                      cursor: 'pointer'
                    }}
                  >
                    <p style={{ color: 'white', fontSize: '13px', fontWeight: '500', margin: '0 0 4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {alerta.titulo}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{
                        padding: '2px 6px',
                        background: alerta.prioridade === 'urgente' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                        color: alerta.prioridade === 'urgente' ? '#ef4444' : '#f59e0b',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: '500'
                      }}>
                        {alerta.prioridade?.toUpperCase() || 'NORMAL'}
                      </span>
                      <span style={{ color: '#64748b', fontSize: '11px' }}>
                        {formatRelativeDate(alerta.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '16px 0', margin: 0 }}>
                Nenhum alerta pendente
              </p>
            )}

            <button
              onClick={() => navigate('/alertas')}
              style={{
                width: '100%',
                marginTop: '12px',
                padding: '10px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '10px',
                color: '#ef4444',
                fontSize: '12px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              Ver todos os alertas
              <ArrowUpRight style={{ width: '14px', height: '14px' }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
