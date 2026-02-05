import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { cachedGetDocs } from '../services/cache';
import { useAuth } from '../contexts/AuthContext';
import { getThreadsByTeam } from '../services/api';
import {
  Briefcase, Users, MessageSquare, AlertTriangle, ChevronRight,
  Clock, TrendingUp, TrendingDown, Activity, Bell, CheckCircle,
  XCircle, Calendar, ArrowUpRight, ChevronDown, Lock, ClipboardList
} from 'lucide-react';
import { STATUS_OPTIONS, getStatusColor, getStatusLabel } from '../utils/clienteStatus';
import { SEGMENTOS_CS, getClienteSegmento, getSegmentoColor, getSegmentoLabel } from '../utils/segmentoCS';

export default function MinhaCarteira() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [clientes, setClientes] = useState([]);
  const [threads, setThreads] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responsaveis, setResponsaveis] = useState([]);
  const [selectedResponsavel, setSelectedResponsavel] = useState(null);
  const [filterStatus, setFilterStatus] = useState(['ativo', 'aviso_previo']);
  const [filterSegmento, setFilterSegmento] = useState(['CRESCIMENTO', 'ESTAVEL', 'ALERTA', 'RESGATE']);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showSegmentoDropdown, setShowSegmentoDropdown] = useState(false);
  const [allClientes, setAllClientes] = useState([]); // Todos os clientes sem filtro de status
  const [clientesSemPlaybook, setClientesSemPlaybook] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    crescimento: 0,
    estavel: 0,
    alerta: 0,
    resgate: 0,
    threadsPendentes: 0,
    alertasPendentes: 0
  });

  // Buscar lista de responsáveis (usuários CS) ao carregar
  useEffect(() => {
    const fetchResponsaveis = async () => {
      try {
        const usuariosRef = collection(db, 'usuarios_sistema');
        const docs = await cachedGetDocs('usuarios_sistema', usuariosRef, 600000);
        const usuarios = docs
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

  // Filtrar clientes por status e segmento (client-side) e recalcular stats
  useEffect(() => {
    let filtered = allClientes;

    // Tratar 'onboarding' como 'ativo'
    if (filterStatus.length > 0) {
      filtered = filtered.filter(c => {
        const st = (c.status === 'onboarding') ? 'ativo' : (c.status || 'ativo');
        return filterStatus.includes(st);
      });
    }

    // Filtrar por segmento
    if (filterSegmento.length > 0 && filterSegmento.length < 4) {
      filtered = filtered.filter(c => filterSegmento.includes(getClienteSegmento(c)));
    }

    setClientes(filtered);

    setStats(prev => ({
      ...prev,
      total: filtered.length,
      crescimento: filtered.filter(c => getClienteSegmento(c) === 'CRESCIMENTO').length,
      estavel: filtered.filter(c => getClienteSegmento(c) === 'ESTAVEL').length,
      alerta: filtered.filter(c => getClienteSegmento(c) === 'ALERTA').length,
      resgate: filtered.filter(c => getClienteSegmento(c) === 'RESGATE').length
    }));
  }, [filterStatus, filterSegmento, allClientes]);

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

      // Ordenar por prioridade do segmento (mais críticos primeiro)
      const segmentoOrder = { RESGATE: 1, ALERTA: 2, ESTAVEL: 3, CRESCIMENTO: 4 };
      clientesData.sort((a, b) => (segmentoOrder[getClienteSegmento(a)] || 5) - (segmentoOrder[getClienteSegmento(b)] || 5));
      setAllClientes(clientesData);

      // Aplicar filtros iniciais
      let filtered = clientesData;
      if (filterStatus.length > 0) {
        filtered = filtered.filter(c => {
          const st = (c.status === 'onboarding') ? 'ativo' : (c.status || 'ativo');
          return filterStatus.includes(st);
        });
      }
      if (filterSegmento.length > 0 && filterSegmento.length < 4) {
        filtered = filtered.filter(c => filterSegmento.includes(getClienteSegmento(c)));
      }
      setClientes(filtered);

      // Calcular stats baseado nos clientes FILTRADOS por segmento
      const statsCalc = {
        total: filtered.length,
        crescimento: filtered.filter(c => getClienteSegmento(c) === 'CRESCIMENTO').length,
        estavel: filtered.filter(c => getClienteSegmento(c) === 'ESTAVEL').length,
        alerta: filtered.filter(c => getClienteSegmento(c) === 'ALERTA').length,
        resgate: filtered.filter(c => getClienteSegmento(c) === 'RESGATE').length,
        threadsPendentes: 0,
        alertasPendentes: 0
      };

      // 2. Verificar quais clientes NÃO têm onboarding, ongoing ou playbook ativo
      if (clientesData.length > 0) {
        const ativos = clientesData.filter(c => c.status !== 'inativo' && c.status !== 'cancelado');
        const checks = await Promise.all(ativos.map(async (cliente) => {
          let temOnboarding = false;
          let temOngoing = false;

          try {
            const snap = await getDocs(query(collection(db, 'clientes', cliente.id, 'onboarding_planos'), where('status', '==', 'em_andamento'), limit(1)));
            temOnboarding = !snap.empty;
          } catch {}

          try {
            const snap = await getDocs(query(collection(db, 'clientes', cliente.id, 'ongoing_ciclos'), where('status', '==', 'em_andamento'), limit(1)));
            temOngoing = !snap.empty;
          } catch {}

          return (temOnboarding || temOngoing) ? null : cliente;
        }));
        setClientesSemPlaybook(checks.filter(Boolean));
      }

      // 3. Buscar threads pendentes dos clientes
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

      // 4. Buscar alertas pendentes
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Filtro por Responsável */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: '#64748b', fontSize: '13px' }}>Responsável:</span>
              <div style={{ position: 'relative' }}>
                <select
                  value={selectedResponsavel || ''}
                  onChange={(e) => setSelectedResponsavel(e.target.value)}
                  style={{
                    appearance: 'none',
                    padding: '8px 32px 8px 12px',
                    background: 'rgba(30, 27, 75, 0.6)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '10px',
                    color: 'white',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    outline: 'none',
                    minWidth: '160px'
                  }}
                >
                  <option value="todos" style={{ background: '#1e1b4b' }}>Todos</option>
                  {responsaveis.map((resp) => (
                    <option key={resp.id} value={resp.email} style={{ background: '#1e1b4b' }}>
                      {resp.email === user?.email ? `${resp.nome} (Você)` : resp.nome}
                    </option>
                  ))}
                </select>
                <ChevronDown style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: '#8b5cf6', pointerEvents: 'none' }} />
              </div>
            </div>

            {/* Filtro por Status - Dropdown multiselect */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: '#64748b', fontSize: '13px' }}>Status:</span>
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => { setShowStatusDropdown(!showStatusDropdown); setShowSegmentoDropdown(false); }}
                  style={{
                    padding: '8px 32px 8px 12px',
                    background: 'rgba(30, 27, 75, 0.6)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '10px',
                    color: 'white',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    minWidth: '140px',
                    textAlign: 'left'
                  }}
                >
                  {filterStatus.length === STATUS_OPTIONS.length ? 'Todos' : filterStatus.length === 0 ? 'Nenhum' : `${filterStatus.length} selecionado${filterStatus.length > 1 ? 's' : ''}`}
                </button>
                <ChevronDown style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: '#8b5cf6', pointerEvents: 'none' }} />
                {showStatusDropdown && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, marginTop: '4px',
                    background: '#1e1b4b', border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '10px', padding: '8px', zIndex: 50, minWidth: '180px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
                  }}>
                    {STATUS_OPTIONS.map(opt => {
                      const checked = filterStatus.includes(opt.value);
                      return (
                        <label key={opt.value} style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '8px 10px', borderRadius: '8px', cursor: 'pointer',
                          background: checked ? `${opt.color}15` : 'transparent'
                        }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              if (checked) setFilterStatus(filterStatus.filter(s => s !== opt.value));
                              else setFilterStatus([...filterStatus, opt.value]);
                            }}
                            style={{ accentColor: opt.color }}
                          />
                          <span style={{ color: checked ? opt.color : '#94a3b8', fontSize: '13px', fontWeight: checked ? '600' : '400' }}>
                            {opt.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Filtro por Saúde - Dropdown multiselect */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: '#64748b', fontSize: '13px' }}>Saúde:</span>
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => { setShowSegmentoDropdown(!showSegmentoDropdown); setShowStatusDropdown(false); }}
                  style={{
                    padding: '8px 32px 8px 12px',
                    background: 'rgba(30, 27, 75, 0.6)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '10px',
                    color: 'white',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    minWidth: '140px',
                    textAlign: 'left'
                  }}
                >
                  {filterSegmento.length === 4 ? 'Todos' : filterSegmento.length === 0 ? 'Nenhum' : `${filterSegmento.length} selecionado${filterSegmento.length > 1 ? 's' : ''}`}
                </button>
                <ChevronDown style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: '#8b5cf6', pointerEvents: 'none' }} />
                {showSegmentoDropdown && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, marginTop: '4px',
                    background: '#1e1b4b', border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '10px', padding: '8px', zIndex: 50, minWidth: '180px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
                  }}>
                    {[
                      { value: 'CRESCIMENTO', label: 'Crescimento', color: SEGMENTOS_CS.CRESCIMENTO.color },
                      { value: 'ESTAVEL', label: 'Estavel', color: SEGMENTOS_CS.ESTAVEL.color },
                      { value: 'ALERTA', label: 'Alerta', color: SEGMENTOS_CS.ALERTA.color },
                      { value: 'RESGATE', label: 'Resgate', color: SEGMENTOS_CS.RESGATE.color },
                    ].map(opt => {
                      const checked = filterSegmento.includes(opt.value);
                      return (
                        <label key={opt.value} style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '8px 10px', borderRadius: '8px', cursor: 'pointer',
                          background: checked ? `${opt.color}15` : 'transparent'
                        }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              if (checked) setFilterSegmento(filterSegmento.filter(s => s !== opt.value));
                              else setFilterSegmento([...filterSegmento, opt.value]);
                            }}
                            style={{ accentColor: opt.color }}
                          />
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: opt.color }} />
                            <span style={{ color: checked ? opt.color : '#94a3b8', fontSize: '13px', fontWeight: checked ? '600' : '400' }}>
                              {opt.label}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
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
          background: `linear-gradient(135deg, ${SEGMENTOS_CS.CRESCIMENTO.bgColor} 0%, rgba(30, 27, 75, 0.4) 100%)`,
          border: `1px solid ${SEGMENTOS_CS.CRESCIMENTO.borderColor}`,
          borderRadius: '16px',
          padding: '20px',
          textAlign: 'center'
        }}>
          <TrendingUp style={{ width: '24px', height: '24px', color: SEGMENTOS_CS.CRESCIMENTO.color, margin: '0 auto 8px' }} />
          <p style={{ color: SEGMENTOS_CS.CRESCIMENTO.color, fontSize: '28px', fontWeight: '700', margin: '0 0 4px 0' }}>{stats.crescimento}</p>
          <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>Crescimento</p>
        </div>

        <div style={{
          background: `linear-gradient(135deg, ${SEGMENTOS_CS.ESTAVEL.bgColor} 0%, rgba(30, 27, 75, 0.4) 100%)`,
          border: `1px solid ${SEGMENTOS_CS.ESTAVEL.borderColor}`,
          borderRadius: '16px',
          padding: '20px',
          textAlign: 'center'
        }}>
          <CheckCircle style={{ width: '24px', height: '24px', color: SEGMENTOS_CS.ESTAVEL.color, margin: '0 auto 8px' }} />
          <p style={{ color: SEGMENTOS_CS.ESTAVEL.color, fontSize: '28px', fontWeight: '700', margin: '0 0 4px 0' }}>{stats.estavel}</p>
          <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>Estavel</p>
        </div>

        <div style={{
          background: `linear-gradient(135deg, ${SEGMENTOS_CS.ALERTA.bgColor} 0%, rgba(30, 27, 75, 0.4) 100%)`,
          border: `1px solid ${SEGMENTOS_CS.ALERTA.borderColor}`,
          borderRadius: '16px',
          padding: '20px',
          textAlign: 'center'
        }}>
          <AlertTriangle style={{ width: '24px', height: '24px', color: SEGMENTOS_CS.ALERTA.color, margin: '0 auto 8px' }} />
          <p style={{ color: SEGMENTOS_CS.ALERTA.color, fontSize: '28px', fontWeight: '700', margin: '0 0 4px 0' }}>{stats.alerta}</p>
          <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>Alerta</p>
        </div>

        <div style={{
          background: `linear-gradient(135deg, ${SEGMENTOS_CS.RESGATE.bgColor} 0%, rgba(30, 27, 75, 0.4) 100%)`,
          border: `1px solid ${SEGMENTOS_CS.RESGATE.borderColor}`,
          borderRadius: '16px',
          padding: '20px',
          textAlign: 'center'
        }}>
          <XCircle style={{ width: '24px', height: '24px', color: SEGMENTOS_CS.RESGATE.color, margin: '0 auto 8px' }} />
          <p style={{ color: SEGMENTOS_CS.RESGATE.color, fontSize: '28px', fontWeight: '700', margin: '0 0 4px 0' }}>{stats.resgate}</p>
          <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>Resgate</p>
        </div>
      </div>

      {/* Grid 3 colunas: Aguardando Resposta | Alertas | Sem Playbook */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        {/* Threads Pendentes */}
        <div style={{
          background: 'rgba(30, 27, 75, 0.4)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          borderRadius: '20px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <MessageSquare style={{ width: '18px', height: '18px', color: '#f59e0b', flexShrink: 0 }} />
              <h3 style={{ color: 'white', fontSize: '15px', fontWeight: '600', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Aguardando Resposta</h3>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto', flex: 1 }}>
              {threads.map((thread) => (
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
                    cursor: 'pointer',
                    minWidth: 0
                  }}
                >
                  <p style={{ color: 'white', fontSize: '13px', fontWeight: '500', margin: '0 0 4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {thread.assunto || thread.subject || 'Sem assunto'}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {getClienteNameByTeamId(thread.team_id)}
                    </span>
                    <span style={{ color: '#64748b', fontSize: '11px', flexShrink: 0 }}>
                      {formatRelativeDate(thread.updated_at)}
                    </span>
                  </div>
                </div>
              ))}
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
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto', flex: 1 }}>
              {alertas.map((alerta) => (
                <div
                  key={alerta.id}
                  onClick={() => navigate('/alertas')}
                  style={{
                    padding: '12px',
                    background: 'rgba(15, 10, 31, 0.6)',
                    border: `1px solid ${alerta.prioridade === 'urgente' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(139, 92, 246, 0.1)'}`,
                    borderRadius: '10px',
                    cursor: 'pointer',
                    minWidth: 0
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

        {/* Sem Onboarding/Ongoing */}
        <div style={{
          background: 'rgba(30, 27, 75, 0.4)',
          border: '1px solid rgba(139, 92, 246, 0.2)',
          borderRadius: '20px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ClipboardList style={{ width: '18px', height: '18px', color: '#8b5cf6' }} />
              <h3 style={{ color: 'white', fontSize: '15px', fontWeight: '600', margin: 0 }}>Sem Playbook</h3>
            </div>
            {clientesSemPlaybook.length > 0 && (
              <span style={{
                padding: '2px 8px',
                background: 'rgba(139, 92, 246, 0.2)',
                color: '#a78bfa',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: '600'
              }}>
                {clientesSemPlaybook.length}
              </span>
            )}
          </div>

          {clientesSemPlaybook.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto', flex: 1 }}>
              {clientesSemPlaybook.map(cliente => {
                const seg = getClienteSegmento(cliente);
                const segColor = getSegmentoColor(seg);
                return (
                  <div
                    key={cliente.id}
                    onClick={() => navigate(`/clientes/${cliente.id}`)}
                    style={{
                      padding: '12px',
                      background: 'rgba(15, 10, 31, 0.6)',
                      border: `1px solid ${segColor}30`,
                      borderRadius: '10px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}
                  >
                    <div style={{
                      width: '8px', height: '8px',
                      borderRadius: '50%',
                      background: segColor,
                      flexShrink: 0
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: 'white', fontSize: '13px', fontWeight: '500', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cliente.team_name}
                      </p>
                      <span style={{ color: segColor, fontSize: '11px' }}>{getSegmentoLabel(seg)}</span>
                    </div>
                    <ChevronRight style={{ width: '14px', height: '14px', color: '#64748b', flexShrink: 0 }} />
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '16px 0', margin: 0 }}>
              Todos os clientes possuem onboarding ou ongoing ativo
            </p>
          )}
        </div>
      </div>

      {/* Lista de Clientes - Full width abaixo */}
      <div style={{
        background: 'rgba(30, 27, 75, 0.4)',
        border: '1px solid rgba(139, 92, 246, 0.15)',
        borderRadius: '20px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '500px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Activity style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
            <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>Meus Clientes</h2>
          </div>
          <span style={{ color: '#64748b', fontSize: '13px' }}>Ordenado por prioridade</span>
        </div>

        {clientes.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', flex: 1 }}>
            {clientes.map((cliente) => {
              const segmento = getClienteSegmento(cliente);
              const segmentoColor = getSegmentoColor(segmento);
              return (
              <div
                key={cliente.id}
                onClick={() => navigate(`/clientes/${cliente.id}`)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '14px 16px',
                  background: 'rgba(15, 10, 31, 0.6)',
                  border: `1px solid ${segmentoColor}30`,
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  flexShrink: 0
                }}
              >
                {/* Segmento Badge */}
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: `${segmentoColor}20`,
                  border: `2px solid ${segmentoColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <span style={{ color: segmentoColor, fontSize: '10px', fontWeight: '700' }}>
                    {segmento}
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
                      background: `${segmentoColor}20`,
                      color: segmentoColor,
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: '500'
                    }}>
                      {getSegmentoLabel(segmento)}
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
            );})}
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
    </div>
  );
}
