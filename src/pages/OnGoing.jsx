import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { ClipboardList, Plus, X, Save, CheckCircle, RotateCcw, Users, Search, Calendar, Play, BookOpen } from 'lucide-react';
import { SEGMENTOS_CS, DEFAULT_ONGOING_ACOES, getClienteSegmento } from '../utils/segmentoCS';
import { atribuirCiclo, buscarCicloAtivo, CADENCIA_OPTIONS, ONGOING_STATUS, ACAO_STATUS } from '../services/ongoing';

export default function OnGoing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState('clientes');

  // Config state
  const [ongoingConfig, setOngoingConfig] = useState(DEFAULT_ONGOING_ACOES);
  const [novaAcao, setNovaAcao] = useState({ CRESCIMENTO: { nome: '', dias: 7 }, ESTAVEL: { nome: '', dias: 7 }, ALERTA: { nome: '', dias: 7 }, RESGATE: { nome: '', dias: 7 } });

  // Helper: normalizar ação (string -> objeto)
  const normalizarAcao = (acao) => {
    if (typeof acao === 'string') return { nome: acao, dias: 7 };
    return { nome: acao.nome || '', dias: acao.dias || 7 };
  };

  // Helper: obter ações normalizadas de um segmento
  const getAcoesNormalizadas = (segmento) => {
    return (ongoingConfig[segmento] || []).map(normalizarAcao);
  };

  // Clientes state
  const [clientes, setClientes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroSegmento, setFiltroSegmento] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('todos');

  // Modal de atribuição
  const [showModal, setShowModal] = useState(false);
  const [modalCliente, setModalCliente] = useState(null);
  const [modalSegmento, setModalSegmento] = useState('');
  const [modalCadencia, setModalCadencia] = useState('mensal');
  const [modalDataInicio, setModalDataInicio] = useState(new Date().toISOString().split('T')[0]);
  const [modalAcoes, setModalAcoes] = useState([]);
  const [modalNovaAcao, setModalNovaAcao] = useState('');
  const [atribuindo, setAtribuindo] = useState(false);


  // Verificar role do usuário
  useEffect(() => {
    const checkRole = async () => {
      if (!user?.uid) return;
      try {
        const snap = await getDoc(doc(db, 'usuarios_sistema', user.uid));
        if (snap.exists()) {
          const role = snap.data().role;
          setIsAdmin(role === 'admin' || role === 'super_admin' || role === 'gestor' || role === 'cs');
        }
      } catch (err) {
        console.error('Erro ao verificar role:', err);
      }
    };
    checkRole();
  }, [user?.uid]);

  // Carregar dados
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [configSnap, clientesSnap] = await Promise.all([
          getDoc(doc(db, 'config', 'ongoing')),
          getDocs(collection(db, 'clientes')),
        ]);

        // Config
        if (configSnap.exists()) {
          const data = configSnap.data();
          setOngoingConfig({
            CRESCIMENTO: data.CRESCIMENTO || DEFAULT_ONGOING_ACOES.CRESCIMENTO,
            ESTAVEL: data.ESTAVEL || DEFAULT_ONGOING_ACOES.ESTAVEL,
            ALERTA: data.ALERTA || DEFAULT_ONGOING_ACOES.ALERTA,
            RESGATE: data.RESGATE || DEFAULT_ONGOING_ACOES.RESGATE,
          });
        }

        // Clientes + ciclo ativo de cada
        const clientesData = clientesSnap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(c => c.status !== 'inativo');

        const clientesComCiclo = await Promise.all(
          clientesData.map(async (cliente) => {
            try {
              const ciclo = await buscarCicloAtivo(cliente.id);
              return { ...cliente, cicloAtivo: ciclo };
            } catch {
              return { ...cliente, cicloAtivo: null };
            }
          })
        );

        setClientes(clientesComCiclo);
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // ============ CONFIG HANDLERS ============
  const handleSaveConfig = async () => {
    if (!isAdmin) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      await setDoc(doc(db, 'config', 'ongoing'), { ...ongoingConfig, updated_at: new Date() });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Erro ao salvar:', err);
      alert('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const adicionarAcaoConfig = (segmento) => {
    const { nome, dias } = novaAcao[segmento] || {};
    if (!nome?.trim()) return;
    const acaoObj = { nome: nome.trim(), dias: dias || 7 };
    const acoesAtuais = getAcoesNormalizadas(segmento);
    if (acoesAtuais.some(a => a.nome === acaoObj.nome)) return;
    setOngoingConfig(prev => ({ ...prev, [segmento]: [...acoesAtuais, acaoObj] }));
    setNovaAcao(prev => ({ ...prev, [segmento]: { nome: '', dias: 7 } }));
  };

  const atualizarDiasAcao = (segmento, index, dias) => {
    const acoes = getAcoesNormalizadas(segmento);
    acoes[index] = { ...acoes[index], dias: parseInt(dias, 10) || 7 };
    setOngoingConfig(prev => ({ ...prev, [segmento]: acoes }));
  };

  const removerAcaoConfig = (segmento, index) => {
    const acoes = getAcoesNormalizadas(segmento);
    setOngoingConfig(prev => ({ ...prev, [segmento]: acoes.filter((_, i) => i !== index) }));
  };

  // ============ MODAL HANDLERS ============
  const abrirModal = (cliente) => {
    const seg = getClienteSegmento(cliente) || 'ESTAVEL';
    setModalCliente(cliente);
    setModalSegmento(seg);
    setModalCadencia('mensal');
    setModalDataInicio(new Date().toISOString().split('T')[0]);
    setModalAcoes(getAcoesNormalizadas(seg));
    setModalNovaAcao('');
    setShowModal(true);
  };

  const handleAtribuir = async () => {
    if (!modalCliente || modalAcoes.length === 0) return;
    setAtribuindo(true);
    try {
      const ciclo = await atribuirCiclo(modalCliente.id, {
        segmento: modalSegmento,
        cadencia: modalCadencia,
        dataInicio: new Date(modalDataInicio),
        acoes: modalAcoes,
      });
      // Atualizar lista local
      setClientes(prev => prev.map(c =>
        c.id === modalCliente.id ? { ...c, cicloAtivo: ciclo } : c
      ));
      setShowModal(false);
    } catch (err) {
      console.error('Erro ao atribuir ciclo:', err);
      alert('Erro ao atribuir ciclo');
    } finally {
      setAtribuindo(false);
    }
  };

  // ============ FILTERS ============
  const normalize = (str) => (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const clientesFiltrados = clientes
    .filter(c => {
      if (searchTerm && !normalize(c.nome || c.name).includes(normalize(searchTerm))) return false;
      if (filtroSegmento !== 'todos' && getClienteSegmento(c) !== filtroSegmento) return false;
      if (filtroStatus === 'ativo' && !c.cicloAtivo) return false;
      if (filtroStatus === 'sem_ciclo' && c.cicloAtivo) return false;
      if (filtroStatus === 'concluido' && c.cicloAtivo?.status !== 'concluido') return false;
      return true;
    })
    .sort((a, b) => normalize(a.nome || a.name).localeCompare(normalize(b.nome || b.name)));

  // ============ HELPERS ============
  const formatDate = (ts) => {
    if (!ts) return '-';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('pt-BR');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid rgba(139, 92, 246, 0.3)', borderTopColor: '#8b5cf6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  const segmentos = ['CRESCIMENTO', 'ESTAVEL', 'ALERTA', 'RESGATE'];
  const tabs = [
    { id: 'clientes', label: 'Clientes', icon: Users },
    { id: 'config', label: 'Ações Padrão', icon: ClipboardList },
    { id: 'playbook', label: 'Playbook', icon: BookOpen },
  ];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', paddingTop: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px', height: '48px',
            background: 'linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%)',
            borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <ClipboardList style={{ width: '24px', height: '24px', color: 'white' }} />
          </div>
          <div>
            <h1 style={{ color: 'white', fontSize: '24px', fontWeight: '700', margin: 0 }}>Ongoing</h1>
            <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0 0' }}>
              Ações recorrentes por saúde do cliente
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '12px', padding: '4px' }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === 'playbook') {
                  navigate('/ongoing/playbook');
                } else {
                  setActiveTab(tab.id);
                }
              }}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '12px 20px', borderRadius: '10px', border: 'none',
                background: isActive ? 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)' : 'transparent',
                color: isActive ? 'white' : '#64748b',
                fontSize: '14px', fontWeight: '600', cursor: 'pointer'
              }}
            >
              <Icon style={{ width: '16px', height: '16px' }} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ====== ABA CLIENTES ====== */}
      {activeTab === 'clientes' && (
        <div>
          {/* Filtros */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
              <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#64748b' }} />
              <input
                type="text"
                placeholder="Buscar cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px 10px 40px',
                  background: 'rgba(15, 10, 31, 0.6)', border: '1px solid rgba(139, 92, 246, 0.2)',
                  borderRadius: '10px', color: 'white', fontSize: '14px', outline: 'none'
                }}
              />
            </div>
            <select
              value={filtroSegmento}
              onChange={(e) => setFiltroSegmento(e.target.value)}
              style={{
                padding: '10px 14px', background: 'rgba(15, 10, 31, 0.6)',
                border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '10px',
                color: 'white', fontSize: '14px', outline: 'none'
              }}
            >
              <option value="todos">Todas as saúdes</option>
              {segmentos.map(s => (
                <option key={s} value={s}>{SEGMENTOS_CS[s].label}</option>
              ))}
            </select>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              style={{
                padding: '10px 14px', background: 'rgba(15, 10, 31, 0.6)',
                border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '10px',
                color: 'white', fontSize: '14px', outline: 'none'
              }}
            >
              <option value="todos">Todos os status</option>
              <option value="ativo">Com ciclo ativo</option>
              <option value="sem_ciclo">Sem ciclo</option>
            </select>
          </div>

          {/* Grid de cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {clientesFiltrados.map(cliente => {
              const seg = getClienteSegmento(cliente);
              const segInfo = SEGMENTOS_CS[seg] || SEGMENTOS_CS.ESTAVEL;
              const ciclo = cliente.cicloAtivo;

              return (
                <div key={cliente.id} style={{
                  background: 'rgba(30, 27, 75, 0.4)',
                  border: `1px solid ${ciclo ? segInfo.borderColor : 'rgba(139, 92, 246, 0.1)'}`,
                  borderRadius: '12px', padding: '14px',
                  display: 'flex', flexDirection: 'column', gap: '10px'
                }}>
                  {/* Header: Nome + Saúde */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                    <span
                      onClick={() => navigate(`/clientes/${cliente.id}?tab=ongoing`)}
                      style={{
                        color: 'white', fontSize: '14px', fontWeight: '600', flex: 1,
                        cursor: 'pointer', transition: 'color 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.color = '#8b5cf6'}
                      onMouseLeave={(e) => e.target.style.color = 'white'}
                    >
                      {cliente.nome || cliente.name}
                    </span>
                    <span style={{
                      padding: '2px 8px', background: segInfo.bgColor,
                      borderRadius: '4px', fontSize: '10px', color: segInfo.color, fontWeight: '600',
                      whiteSpace: 'nowrap'
                    }}>
                      {segInfo.label}
                    </span>
                  </div>

                  {/* Ciclo info ou botão atribuir */}
                  {ciclo ? (
                    <>
                      {/* Período */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar style={{ width: '12px', height: '12px', color: '#64748b' }} />
                        <span style={{ color: '#94a3b8', fontSize: '11px' }}>
                          {formatDate(ciclo.data_inicio)} → {formatDate(ciclo.data_fim)}
                        </span>
                        <span style={{
                          marginLeft: 'auto', padding: '2px 6px',
                          background: ONGOING_STATUS[ciclo.status]?.color ? `${ONGOING_STATUS[ciclo.status].color}20` : 'rgba(139,92,246,0.2)',
                          color: ONGOING_STATUS[ciclo.status]?.color || '#8b5cf6',
                          borderRadius: '4px', fontSize: '10px', fontWeight: '600'
                        }}>
                          {ONGOING_STATUS[ciclo.status]?.label || ciclo.status}
                        </span>
                      </div>

                      {/* Progresso */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, height: '4px', background: 'rgba(139, 92, 246, 0.15)', borderRadius: '2px' }}>
                          <div style={{
                            width: `${ciclo.progresso || 0}%`, height: '100%',
                            background: ciclo.progresso === 100 ? '#10b981' : segInfo.color,
                            borderRadius: '2px'
                          }} />
                        </div>
                        <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '600' }}>
                          {ciclo.progresso || 0}%
                        </span>
                      </div>

                      {/* Ações resumidas */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {ciclo.acoes?.slice(0, 4).map((acao, idx) => {
                          const statusInfo = ACAO_STATUS[acao.status] || ACAO_STATUS.pendente;
                          return (
                            <div key={idx} style={{
                              width: '8px', height: '8px', borderRadius: '50%',
                              background: statusInfo.color,
                              title: acao.nome
                            }} />
                          );
                        })}
                        {ciclo.acoes?.length > 4 && (
                          <span style={{ color: '#64748b', fontSize: '10px' }}>+{ciclo.acoes.length - 4}</span>
                        )}
                      </div>

                      {/* Botão novo ciclo se concluído */}
                      {ciclo.status === 'concluido' && (
                        <button
                          onClick={() => abrirModal(cliente)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                            padding: '6px', background: 'rgba(139, 92, 246, 0.2)',
                            border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '6px',
                            color: '#8b5cf6', fontSize: '11px', fontWeight: '600', cursor: 'pointer'
                          }}
                        >
                          <Play style={{ width: '10px', height: '10px' }} />
                          Novo Ciclo
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      onClick={() => abrirModal(cliente)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                        padding: '4px 8px', background: 'transparent',
                        border: '1px dashed rgba(139, 92, 246, 0.4)', borderRadius: '6px',
                        color: '#8b5cf6', fontSize: '11px', fontWeight: '500', cursor: 'pointer',
                        marginTop: 'auto', opacity: 0.7, transition: 'opacity 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.opacity = '1'}
                      onMouseLeave={(e) => e.target.style.opacity = '0.7'}
                    >
                      <Plus style={{ width: '10px', height: '10px' }} />
                      Atribuir
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {clientesFiltrados.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
              <p style={{ fontSize: '14px', margin: 0 }}>Nenhum cliente encontrado</p>
            </div>
          )}
        </div>
      )}

      {/* ====== ABA AÇÕES PADRÃO ====== */}
      {activeTab === 'config' && (
        <div>
          {/* Botões de ação */}
          {isAdmin && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginBottom: '20px' }}>
              <button
                onClick={() => setOngoingConfig(DEFAULT_ONGOING_ACOES)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 20px', background: 'rgba(100, 116, 139, 0.2)',
                  border: '1px solid rgba(100, 116, 139, 0.3)', borderRadius: '12px',
                  color: '#94a3b8', fontSize: '14px', fontWeight: '500', cursor: 'pointer'
                }}
              >
                <RotateCcw style={{ width: '16px', height: '16px' }} />
                Restaurar Padrões
              </button>
              <button
                onClick={handleSaveConfig}
                disabled={saving}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 24px',
                  background: saveSuccess ? 'rgba(16, 185, 129, 0.3)' : 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                  border: 'none', borderRadius: '12px', color: 'white',
                  fontSize: '14px', fontWeight: '600', cursor: saving ? 'not-allowed' : 'pointer'
                }}
              >
                {saveSuccess ? <><CheckCircle style={{ width: '16px', height: '16px' }} /> Salvo!</> : <><Save style={{ width: '16px', height: '16px' }} /> {saving ? 'Salvando...' : 'Salvar'}</>}
              </button>
            </div>
          )}

          {/* Grid de segmentos */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {segmentos.map(seg => {
              const info = SEGMENTOS_CS[seg];
              const acoes = getAcoesNormalizadas(seg);
              return (
                <div key={seg} style={{
                  background: 'rgba(30, 27, 75, 0.4)', border: `1px solid ${info.borderColor}`,
                  borderRadius: '20px', padding: '24px', display: 'flex', flexDirection: 'column'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: info.color }} />
                    <h2 style={{ color: info.color, fontSize: '18px', fontWeight: '700', margin: 0 }}>{info.label}</h2>
                    <span style={{ padding: '2px 10px', background: info.bgColor, borderRadius: '20px', fontSize: '12px', color: info.color, fontWeight: '600' }}>
                      {acoes.length} {acoes.length === 1 ? 'ação' : 'ações'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                    {acoes.map((acao, idx) => (
                      <div key={idx} style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '8px 12px', background: 'rgba(15, 10, 31, 0.6)',
                        borderRadius: '10px', border: `1px solid ${info.borderColor}`
                      }}>
                        <span style={{ flex: 1, color: '#e2e8f0', fontSize: '13px' }}>{acao.nome}</span>
                        {isAdmin ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ color: '#64748b', fontSize: '11px' }}>D+</span>
                            <input
                              type="number"
                              value={acao.dias}
                              onChange={(e) => atualizarDiasAcao(seg, idx, e.target.value)}
                              style={{
                                width: '40px', padding: '4px 6px', background: '#0f0a1f',
                                border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '4px',
                                color: '#8b5cf6', fontSize: '12px', fontWeight: '600', textAlign: 'center', outline: 'none'
                              }}
                              min="1" max="90"
                            />
                            <button onClick={() => removerAcaoConfig(seg, idx)} style={{
                              background: 'rgba(239, 68, 68, 0.1)', border: 'none', borderRadius: '4px',
                              padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', marginLeft: '4px'
                            }}>
                              <X style={{ width: '12px', height: '12px', color: '#ef4444' }} />
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: '#8b5cf6', fontSize: '11px', fontWeight: '600' }}>D+{acao.dias}</span>
                        )}
                      </div>
                    ))}
                    {acoes.length === 0 && (
                      <p style={{ color: '#475569', fontSize: '13px', fontStyle: 'italic', margin: 0, padding: '20px', textAlign: 'center' }}>
                        Nenhuma ação configurada
                      </p>
                    )}
                  </div>

                  {isAdmin && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px', alignItems: 'center' }}>
                      <input
                        type="text" placeholder="Nova ação..."
                        value={novaAcao[seg]?.nome || ''}
                        onChange={(e) => setNovaAcao(prev => ({ ...prev, [seg]: { ...prev[seg], nome: e.target.value } }))}
                        onKeyDown={(e) => e.key === 'Enter' && adicionarAcaoConfig(seg)}
                        style={{
                          flex: 1, padding: '8px 12px', background: '#0f0a1f',
                          border: `1px solid ${info.borderColor}`, borderRadius: '8px',
                          color: 'white', fontSize: '13px', outline: 'none'
                        }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ color: '#64748b', fontSize: '11px' }}>D+</span>
                        <input
                          type="number"
                          value={novaAcao[seg]?.dias || 7}
                          onChange={(e) => setNovaAcao(prev => ({ ...prev, [seg]: { ...prev[seg], dias: parseInt(e.target.value, 10) || 7 } }))}
                          style={{
                            width: '40px', padding: '8px 6px', background: '#0f0a1f',
                            border: `1px solid ${info.borderColor}`, borderRadius: '8px',
                            color: 'white', fontSize: '13px', textAlign: 'center', outline: 'none'
                          }}
                          min="1" max="90"
                        />
                      </div>
                      <button onClick={() => adicionarAcaoConfig(seg)} style={{
                        padding: '8px 12px', background: info.bgColor,
                        border: `1px solid ${info.borderColor}`, borderRadius: '8px',
                        color: info.color, fontSize: '14px', fontWeight: '600', cursor: 'pointer',
                        display: 'flex', alignItems: 'center'
                      }}>
                        <Plus style={{ width: '14px', height: '14px' }} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ====== MODAL ATRIBUIR CICLO ====== */}
      {showModal && modalCliente && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setShowModal(false)}>
          <div style={{
            background: '#1e1b4b', border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '20px', padding: '32px', width: '560px', maxHeight: '80vh',
            overflowY: 'auto'
          }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ color: 'white', fontSize: '20px', fontWeight: '700', margin: '0 0 4px 0' }}>
              Atribuir Ciclo Ongoing
            </h2>
            <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 24px 0' }}>
              {modalCliente.nome || modalCliente.name}
            </p>

            {/* Segmento */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ color: '#94a3b8', fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Saúde</label>
              <select
                value={modalSegmento}
                onChange={(e) => {
                  setModalSegmento(e.target.value);
                  const acoes = (ongoingConfig[e.target.value] || []).map(a => typeof a === 'string' ? { nome: a, dias: 7 } : a);
                  setModalAcoes(acoes);
                }}
                style={{
                  width: '100%', padding: '10px 14px', background: '#0f0a1f',
                  border: '1px solid #3730a3', borderRadius: '10px', color: 'white',
                  fontSize: '14px', outline: 'none'
                }}
              >
                {segmentos.map(s => (
                  <option key={s} value={s}>{SEGMENTOS_CS[s].label}</option>
                ))}
              </select>
            </div>

            {/* Cadência */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ color: '#94a3b8', fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Cadência</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {CADENCIA_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setModalCadencia(opt.value)}
                    style={{
                      flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
                      background: modalCadencia === opt.value ? 'rgba(139, 92, 246, 0.3)' : 'rgba(15, 10, 31, 0.6)',
                      color: modalCadencia === opt.value ? '#8b5cf6' : '#64748b',
                      fontSize: '14px', fontWeight: '600', cursor: 'pointer',
                      outline: modalCadencia === opt.value ? '2px solid #8b5cf6' : 'none'
                    }}
                  >
                    {opt.label} ({opt.dias} dias)
                  </button>
                ))}
              </div>
            </div>

            {/* Data de início */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ color: '#94a3b8', fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Data de Início</label>
              <input
                type="date"
                value={modalDataInicio}
                onChange={(e) => setModalDataInicio(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', background: '#0f0a1f',
                  border: '1px solid #3730a3', borderRadius: '10px', color: 'white',
                  fontSize: '14px', outline: 'none'
                }}
              />
            </div>

            {/* Ações */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ color: '#94a3b8', fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '8px' }}>
                Ações do Ciclo ({modalAcoes.length})
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                {modalAcoes.map((acao, idx) => {
                  const acaoObj = normalizarAcao(acao);
                  const dataVencimento = new Date(modalDataInicio);
                  dataVencimento.setDate(dataVencimento.getDate() + acaoObj.dias);
                  return (
                    <div key={idx} style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '8px 12px', background: 'rgba(15, 10, 31, 0.6)',
                      borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.15)'
                    }}>
                      <span style={{ flex: 1, color: '#e2e8f0', fontSize: '13px' }}>{acaoObj.nome}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ color: '#64748b', fontSize: '11px' }}>D+</span>
                        <input
                          type="number"
                          value={acaoObj.dias}
                          onChange={(e) => {
                            const novosDias = parseInt(e.target.value, 10) || 7;
                            setModalAcoes(prev => prev.map((a, i) => i === idx ? { ...normalizarAcao(a), dias: novosDias } : a));
                          }}
                          style={{
                            width: '36px', padding: '3px 4px', background: '#0f0a1f',
                            border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '4px',
                            color: '#8b5cf6', fontSize: '11px', fontWeight: '600', textAlign: 'center', outline: 'none'
                          }}
                          min="1" max="90"
                        />
                        <span style={{ color: '#64748b', fontSize: '10px', minWidth: '55px' }}>
                          ({dataVencimento.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })})
                        </span>
                      </div>
                      <button onClick={() => setModalAcoes(prev => prev.filter((_, i) => i !== idx))} style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
                        display: 'flex', alignItems: 'center'
                      }}>
                        <X style={{ width: '14px', height: '14px', color: '#64748b' }} />
                      </button>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text" placeholder="Adicionar ação..."
                  value={modalNovaAcao}
                  onChange={(e) => setModalNovaAcao(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && modalNovaAcao.trim()) {
                      setModalAcoes(prev => [...prev, { nome: modalNovaAcao.trim(), dias: 7 }]);
                      setModalNovaAcao('');
                    }
                  }}
                  style={{
                    flex: 1, padding: '8px 12px', background: '#0f0a1f',
                    border: '1px solid #3730a3', borderRadius: '8px',
                    color: 'white', fontSize: '13px', outline: 'none'
                  }}
                />
                <button
                  onClick={() => {
                    if (modalNovaAcao.trim()) {
                      setModalAcoes(prev => [...prev, { nome: modalNovaAcao.trim(), dias: 7 }]);
                      setModalNovaAcao('');
                    }
                  }}
                  style={{
                    padding: '8px 12px', background: 'rgba(139, 92, 246, 0.2)',
                    border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '8px',
                    color: '#8b5cf6', cursor: 'pointer', display: 'flex', alignItems: 'center'
                  }}
                >
                  <Plus style={{ width: '14px', height: '14px' }} />
                </button>
              </div>
            </div>

            {/* Botões */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: '10px 20px', background: 'rgba(100, 116, 139, 0.2)',
                  border: '1px solid rgba(100, 116, 139, 0.3)', borderRadius: '12px',
                  color: '#94a3b8', fontSize: '14px', fontWeight: '500', cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleAtribuir}
                disabled={atribuindo || modalAcoes.length === 0}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 24px',
                  background: modalAcoes.length === 0 ? 'rgba(100,116,139,0.3)' : 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                  border: 'none', borderRadius: '12px', color: 'white',
                  fontSize: '14px', fontWeight: '600',
                  cursor: atribuindo || modalAcoes.length === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                <Calendar style={{ width: '16px', height: '16px' }} />
                {atribuindo ? 'Atribuindo...' : 'Atribuir Ciclo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
