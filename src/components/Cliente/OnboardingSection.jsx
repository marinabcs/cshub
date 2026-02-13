import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MODULOS, MODULOS_ORDEM, PLANO_STATUS, SESSAO_STATUS } from '../../constants/onboarding';
import { REUNIOES_V1, REUNIAO_STATUS, PLANO_STATUS_V1 } from '../../constants/onboardingV1';
import { useAuth } from '../../contexts/AuthContext';
import { buscarPlanoAtivo, buscarPlanosCliente, atualizarSessao, marcarFirstValue, marcarTutorialEnviado, concluirOnboarding, excluirPlano, adicionarComentarioFirstValue, atualizarReuniaoV1 } from '../../services/onboarding';
import { calculateProgress } from '../../utils/onboardingCalculator';
import { Timestamp, collection, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import {
  GraduationCap, CheckCircle, Circle, Clock, Send, Calendar,
  Monitor, Users, Award, ChevronDown, ChevronUp, PlayCircle, Pencil, Trash2,
  MessageSquare, Plus, History, Play, Zap, Sparkles, Video
} from 'lucide-react';

// Ícones para reuniões v1
const REUNIAO_ICONS = {
  kickoff: Play,
  escala: Zap,
  ai: Sparkles,
  motion: Video
};

export default function OnboardingSection({ clienteId }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [plano, setPlano] = useState(null);
  const [loading, setLoading] = useState(true);
  const [atualizando, setAtualizando] = useState(null);
  const [expandedSessao, setExpandedSessao] = useState(null);
  const [confirmExcluir, setConfirmExcluir] = useState(false);
  const [editandoData, setEditandoData] = useState(null);
  const [expandedFV, setExpandedFV] = useState(null);
  const [novoComentario, setNovoComentario] = useState('');
  const [showHandoffModal, setShowHandoffModal] = useState(false);
  const [usuariosSistema, setUsuariosSistema] = useState([]);
  const [handoffResponsaveis, setHandoffResponsaveis] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [showHistorico, setShowHistorico] = useState(false);

  async function loadPlano() {
    setLoading(true);
    const [p, todos] = await Promise.all([
      buscarPlanoAtivo(clienteId),
      buscarPlanosCliente(clienteId)
    ]);
    setPlano(p);
    setHistorico(todos.filter(pl => pl.status !== 'em_andamento'));
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPlano();
  }, [clienteId]);

  // ============================================
  // V2 Handlers (mantidos)
  // ============================================
  async function handleConcluirSessao(sessaoNum) {
    setAtualizando(sessaoNum);
    try {
      await atualizarSessao(clienteId, plano.id, sessaoNum, { status: 'concluida' });
      await loadPlano();
    } catch {
      // erro logado no service
    }
    setAtualizando(null);
  }

  async function handleMarcarFirstValue(moduloId) {
    setAtualizando(moduloId);
    try {
      await marcarFirstValue(clienteId, plano.id, moduloId);
      await loadPlano();
    } catch {
      // erro logado
    }
    setAtualizando(null);
  }

  async function handleMarcarTutorial(moduloId) {
    setAtualizando(moduloId);
    try {
      await marcarTutorialEnviado(clienteId, plano.id, moduloId);
      await loadPlano();
    } catch {
      // erro logado
    }
    setAtualizando(null);
  }

  async function handleAbrirHandoff() {
    try {
      const snap = await getDocs(collection(db, 'usuarios_sistema'));
      const users = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.ativo !== false)
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
      setUsuariosSistema(users);
    } catch {
      // silenciar
    }
    setHandoffResponsaveis([]);
    setShowHandoffModal(true);
  }

  function handleToggleResponsavel(u) {
    setHandoffResponsaveis(prev => {
      const exists = prev.find(r => r.email === u.email);
      if (exists) return prev.filter(r => r.email !== u.email);
      return [...prev, { email: u.email, nome: u.nome }];
    });
  }

  async function handleConfirmarHandoff() {
    setAtualizando('handoff');
    try {
      await concluirOnboarding(clienteId, plano.id, handoffResponsaveis);
      setShowHandoffModal(false);
      await loadPlano();
    } catch {
      // erro logado
    }
    setAtualizando(null);
  }

  async function handleEditar() {
    setAtualizando('editar');
    try {
      await excluirPlano(clienteId, plano.id);
      navigate(`/onboarding/${clienteId}`);
    } catch {
      // erro logado
    }
    setAtualizando(null);
  }

  async function handleSalvarData(sessaoNum, novaData) {
    setAtualizando(`data-${sessaoNum}`);
    try {
      await atualizarSessao(clienteId, plano.id, sessaoNum, {
        data_sugerida: Timestamp.fromDate(new Date(novaData + 'T12:00:00'))
      });
      await loadPlano();
      setEditandoData(null);
    } catch {
      // erro logado
    }
    setAtualizando(null);
  }

  async function handleAdicionarComentario(moduloId) {
    if (!novoComentario.trim()) return;
    setAtualizando(`comment-${moduloId}`);
    try {
      await adicionarComentarioFirstValue(clienteId, plano.id, moduloId, novoComentario.trim(), user);
      setNovoComentario('');
      await loadPlano();
    } catch {
      // erro logado
    }
    setAtualizando(null);
  }

  async function handleExcluir() {
    setAtualizando('excluir');
    try {
      await excluirPlano(clienteId, plano.id);
      setConfirmExcluir(false);
      await loadPlano();
    } catch {
      // erro logado
    }
    setAtualizando(null);
  }

  // ============================================
  // V1 Handlers
  // ============================================
  async function handleConcluirReuniaoV1(reuniaoId) {
    setAtualizando(reuniaoId);
    try {
      await atualizarReuniaoV1(clienteId, plano.id, reuniaoId, { status: 'concluida' });
      await loadPlano();
    } catch {
      // erro logado
    }
    setAtualizando(null);
  }

  async function handlePularReuniaoV1(reuniaoId) {
    setAtualizando(`pular-${reuniaoId}`);
    try {
      await atualizarReuniaoV1(clienteId, plano.id, reuniaoId, { status: 'nao_aplicada' });
      await loadPlano();
    } catch {
      // erro logado
    }
    setAtualizando(null);
  }

  async function handleReabrirReuniaoV1(reuniaoId) {
    setAtualizando(`reabrir-${reuniaoId}`);
    try {
      await atualizarReuniaoV1(clienteId, plano.id, reuniaoId, { status: 'pendente' });
      await loadPlano();
    } catch {
      // erro logado
    }
    setAtualizando(null);
  }

  async function handleSalvarDataV1(reuniaoId, novaData) {
    setAtualizando(`data-${reuniaoId}`);
    try {
      await atualizarReuniaoV1(clienteId, plano.id, reuniaoId, { data_sugerida: novaData });
      await loadPlano();
      setEditandoData(null);
    } catch {
      // erro logado
    }
    setAtualizando(null);
  }

  // ============================================
  // Helpers
  // ============================================
  function parseLocalDate(dateStr) {
    if (!dateStr) return null;
    if (dateStr.toDate) return dateStr.toDate();
    if (typeof dateStr === 'string' && dateStr.includes('-')) {
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    return new Date(dateStr);
  }

  function formatDateForInput(date) {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : date;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // ============================================
  // Loading / Empty states
  // ============================================
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>
        Carregando plano de onboarding...
      </div>
    );
  }

  if (!plano) {
    return (
      <div style={{
        background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)',
        borderRadius: '16px', padding: '48px', textAlign: 'center'
      }}>
        <GraduationCap size={48} color="#64748b" style={{ marginBottom: '16px' }} />
        <h3 style={{ color: 'white', marginBottom: '8px' }}>Nenhum plano de onboarding</h3>
        <p style={{ color: '#94a3b8', marginBottom: '24px' }}>
          Crie um plano de onboarding para este cliente.
        </p>
        <button
          onClick={() => navigate(`/onboarding/${clienteId}`)}
          style={{
            padding: '12px 24px',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
            border: 'none', borderRadius: '12px', color: 'white',
            fontWeight: '600', cursor: 'pointer'
          }}
        >
          Criar Plano de Onboarding
        </button>
      </div>
    );
  }

  // Detectar versão do plano
  const isV1 = plano.versao === 'v1';

  // ============================================
  // RENDER V1
  // ============================================
  if (isV1) {
    const reunioes = plano.reunioes || [];
    const reunioesConcluidas = reunioes.filter(r => r.status === 'concluida').length;
    const reunioesNaoAplicadas = reunioes.filter(r => r.status === 'nao_aplicada').length;
    const reunioesFinalizadas = reunioesConcluidas + reunioesNaoAplicadas; // Concluídas + Não aplicadas
    const totalReunioes = reunioes.length;
    const progressoV1 = totalReunioes > 0 ? Math.round((reunioesFinalizadas / totalReunioes) * 100) : 0;
    const statusInfo = PLANO_STATUS_V1[plano.status] || PLANO_STATUS_V1.em_andamento;
    const todasFinalizadas = reunioesFinalizadas === totalReunioes && totalReunioes > 0;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Header com progresso */}
        <div style={{
          background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)',
          borderRadius: '16px', padding: '24px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <GraduationCap size={20} color="#8b5cf6" />
              <h3 style={{ color: 'white', margin: 0, fontSize: '16px' }}>Onboarding v1.0</h3>
              <span style={{
                padding: '2px 10px', borderRadius: '8px', fontSize: '12px',
                background: `${statusInfo.color}20`, color: statusInfo.color
              }}>{statusInfo.label}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {plano.status === 'em_andamento' && (
                <>
                  <button
                    onClick={handleEditar}
                    disabled={atualizando === 'editar'}
                    style={{
                      padding: '6px 12px', background: 'rgba(139, 92, 246, 0.1)',
                      border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '10px',
                      color: '#a78bfa', cursor: 'pointer', fontSize: '13px',
                      display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                  >
                    <Pencil size={13} /> {atualizando === 'editar' ? '...' : 'Editar'}
                  </button>
                  <button
                    onClick={() => setConfirmExcluir(true)}
                    style={{
                      padding: '6px 12px', background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px',
                      color: '#ef4444', cursor: 'pointer', fontSize: '13px',
                      display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                  >
                    <Trash2 size={13} /> Excluir
                  </button>
                </>
              )}
              {todasFinalizadas && plano.status === 'em_andamento' && (
                <button
                  onClick={handleAbrirHandoff}
                  disabled={atualizando === 'handoff'}
                  style={{
                    padding: '6px 12px', background: '#10b981', border: 'none',
                    borderRadius: '10px', color: 'white', fontWeight: '600',
                    cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <Award size={14} /> {atualizando === 'handoff' ? 'Concluindo...' : 'Realizar Handoff'}
                </button>
              )}
            </div>
          </div>

          {/* Barra de progresso */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ color: '#94a3b8', fontSize: '13px' }}>Progresso</span>
              <span style={{ color: 'white', fontWeight: '600', fontSize: '13px' }}>{progressoV1}%</span>
            </div>
            <div style={{ height: '8px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '4px' }}>
              <div style={{
                height: '100%', borderRadius: '4px',
                width: `${progressoV1}%`,
                background: progressoV1 === 100 ? '#10b981' : 'linear-gradient(90deg, #8b5cf6, #06b6d4)',
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>

          {/* Métricas */}
          <div style={{ display: 'flex', gap: '24px', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#10b981', fontWeight: '600', fontSize: '20px' }}>{reunioesConcluidas}</div>
              <div style={{ color: '#64748b', fontSize: '12px' }}>Concluídas</div>
            </div>
            {reunioesNaoAplicadas > 0 && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#f59e0b', fontWeight: '600', fontSize: '20px' }}>{reunioesNaoAplicadas}</div>
                <div style={{ color: '#64748b', fontSize: '12px' }}>Não Aplicadas</div>
              </div>
            )}
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#64748b', fontWeight: '600', fontSize: '20px' }}>{totalReunioes - reunioesFinalizadas}</div>
              <div style={{ color: '#64748b', fontSize: '12px' }}>Pendentes</div>
            </div>
          </div>
        </div>

        {/* Reuniões */}
        <div style={{
          background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)',
          borderRadius: '16px', padding: '24px'
        }}>
          <h3 style={{ color: 'white', fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} color="#8b5cf6" /> Reuniões
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {reunioes.map((reuniao, idx) => {
              const reuniaoInfo = REUNIOES_V1[reuniao.id] || {};
              const Icon = REUNIAO_ICONS[reuniao.id] || Calendar;
              const rStatus = REUNIAO_STATUS[reuniao.status] || REUNIAO_STATUS.pendente;
              const expanded = expandedSessao === reuniao.id;
              const dataSugerida = parseLocalDate(reuniao.data_sugerida);

              const cores = [
                { bg: 'rgba(139, 92, 246, 0.15)', border: 'rgba(139, 92, 246, 0.3)', text: '#8b5cf6' },
                { bg: 'rgba(6, 182, 212, 0.15)', border: 'rgba(6, 182, 212, 0.3)', text: '#06b6d4' },
                { bg: 'rgba(249, 115, 22, 0.15)', border: 'rgba(249, 115, 22, 0.3)', text: '#f97316' },
                { bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.3)', text: '#10b981' }
              ];
              const cor = cores[idx % cores.length];

              return (
                <div key={reuniao.id} style={{
                  background: '#0f0a1f', border: `1px solid ${cor.border}`,
                  borderRadius: '12px', overflow: 'hidden'
                }}>
                  <div
                    style={{
                      padding: '16px', display: 'flex', alignItems: 'center', gap: '12px',
                      cursor: 'pointer'
                    }}
                    onClick={() => setExpandedSessao(expanded ? null : reuniao.id)}
                  >
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '12px',
                      background: reuniao.status === 'concluida' ? 'rgba(16, 185, 129, 0.2)' : cor.bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {reuniao.status === 'concluida'
                        ? <CheckCircle size={20} color="#10b981" />
                        : <Icon size={20} color={cor.text} />
                      }
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{
                          background: cor.bg, border: `1px solid ${cor.border}`,
                          padding: '2px 8px', borderRadius: '6px',
                          color: cor.text, fontSize: '11px', fontWeight: '600'
                        }}>
                          {reuniao.numero || idx + 1}
                        </span>
                        <span style={{ color: 'white', fontWeight: '600', fontSize: '14px' }}>
                          {reuniao.nome || reuniaoInfo.nome}
                        </span>
                      </div>
                      <div style={{ color: '#64748b', fontSize: '12px' }}>
                        {reuniao.duracao || reuniaoInfo.duracao || 60} min
                        {dataSugerida && ` • ${dataSugerida.toLocaleDateString('pt-BR')}`}
                      </div>
                    </div>
                    <span style={{
                      padding: '2px 8px', borderRadius: '6px', fontSize: '11px',
                      background: `${rStatus.color}20`, color: rStatus.color
                    }}>{rStatus.label}</span>
                    {expanded ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
                  </div>

                  {expanded && (
                    <div style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(139, 92, 246, 0.1)' }}>
                      {/* Descrição e tópicos */}
                      <div style={{ paddingTop: '12px' }}>
                        <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 12px' }}>
                          {reuniao.descricao || reuniaoInfo.descricao}
                        </p>

                        {(reuniao.topicos || reuniaoInfo.topicos)?.length > 0 && (
                          <div style={{ marginBottom: '12px' }}>
                            <div style={{ color: '#64748b', fontSize: '12px', marginBottom: '8px' }}>Tópicos:</div>
                            <ul style={{ margin: 0, paddingLeft: '20px' }}>
                              {(reuniao.topicos || reuniaoInfo.topicos).map((t, i) => (
                                <li key={i} style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>{t}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {(reuniao.entregavel || reuniaoInfo.entregavel) && (
                          <div style={{
                            padding: '10px 12px', background: 'rgba(16, 185, 129, 0.1)',
                            borderRadius: '8px', borderLeft: '3px solid #10b981'
                          }}>
                            <div style={{ color: '#64748b', fontSize: '11px', marginBottom: '2px' }}>Entregável:</div>
                            <div style={{ color: '#10b981', fontSize: '12px' }}>
                              {reuniao.entregavel || reuniaoInfo.entregavel}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Editar data */}
                      {plano.status === 'em_andamento' && (
                        <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Calendar size={14} color="#64748b" />
                          <span style={{ color: '#94a3b8', fontSize: '13px' }}>Data:</span>
                          {editandoData === reuniao.id ? (
                            <input
                              type="date"
                              defaultValue={dataSugerida ? formatDateForInput(dataSugerida) : ''}
                              autoFocus
                              onBlur={e => {
                                if (e.target.value) handleSalvarDataV1(reuniao.id, e.target.value);
                                else setEditandoData(null);
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Enter' && e.target.value) handleSalvarDataV1(reuniao.id, e.target.value);
                                if (e.key === 'Escape') setEditandoData(null);
                              }}
                              style={{
                                padding: '4px 8px', background: '#0f0a1f', border: '1px solid #3730a3',
                                borderRadius: '8px', color: 'white', outline: 'none', fontSize: '13px'
                              }}
                            />
                          ) : (
                            <button
                              onClick={e => { e.stopPropagation(); setEditandoData(reuniao.id); }}
                              disabled={atualizando === `data-${reuniao.id}`}
                              style={{
                                padding: '4px 10px', background: 'rgba(139, 92, 246, 0.1)',
                                border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '8px',
                                color: '#a78bfa', cursor: 'pointer', fontSize: '13px',
                                display: 'flex', alignItems: 'center', gap: '4px'
                              }}
                            >
                              {atualizando === `data-${reuniao.id}` ? '...' : (dataSugerida ? dataSugerida.toLocaleDateString('pt-BR') : 'Definir data')}
                              <Pencil size={11} />
                            </button>
                          )}
                        </div>
                      )}

                      {/* Botões de ação */}
                      {plano.status === 'em_andamento' && (
                        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {/* Reunião pendente: mostrar Concluir e Não Aplicada */}
                          {reuniao.status === 'pendente' && (
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                onClick={() => handleConcluirReuniaoV1(reuniao.id)}
                                disabled={atualizando === reuniao.id}
                                style={{
                                  flex: 1, padding: '8px 16px',
                                  background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)',
                                  borderRadius: '10px', color: '#10b981', cursor: 'pointer',
                                  fontSize: '13px', fontWeight: '500'
                                }}
                              >
                                {atualizando === reuniao.id ? '...' : 'Concluída'}
                              </button>
                              <button
                                onClick={() => handlePularReuniaoV1(reuniao.id)}
                                disabled={atualizando === `pular-${reuniao.id}`}
                                style={{
                                  flex: 1, padding: '8px 16px',
                                  background: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.3)',
                                  borderRadius: '10px', color: '#f59e0b', cursor: 'pointer',
                                  fontSize: '13px', fontWeight: '500'
                                }}
                              >
                                {atualizando === `pular-${reuniao.id}` ? '...' : 'Não Aplicada'}
                              </button>
                            </div>
                          )}

                          {/* Reunião concluída ou não aplicada: mostrar Reabrir */}
                          {(reuniao.status === 'concluida' || reuniao.status === 'nao_aplicada') && (
                            <button
                              onClick={() => handleReabrirReuniaoV1(reuniao.id)}
                              disabled={atualizando === `reabrir-${reuniao.id}`}
                              style={{
                                padding: '6px 12px',
                                background: 'rgba(100, 116, 139, 0.1)', border: '1px solid rgba(100, 116, 139, 0.3)',
                                borderRadius: '8px', color: '#94a3b8', cursor: 'pointer',
                                fontSize: '12px'
                              }}
                            >
                              {atualizando === `reabrir-${reuniao.id}` ? '...' : 'Reabrir reunião'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Elegível para Handoff */}
        {todasFinalizadas && plano.status === 'em_andamento' && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '16px', padding: '24px', textAlign: 'center'
          }}>
            <Award size={32} color="#10b981" style={{ marginBottom: '8px' }} />
            <h3 style={{ color: '#10b981', margin: '0 0 8px' }}>Elegível para Handoff!</h3>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 16px' }}>
              {reunioesConcluidas === totalReunioes
                ? 'Todas as reuniões foram concluídas.'
                : `${reunioesConcluidas} reunião(ões) concluída(s), ${reunioesNaoAplicadas} não aplicada(s).`
              }
            </p>
            <button
              onClick={handleAbrirHandoff}
              disabled={atualizando === 'handoff'}
              style={{
                padding: '12px 24px', background: '#10b981', border: 'none',
                borderRadius: '12px', color: 'white', fontWeight: '600', cursor: 'pointer'
              }}
            >
              {atualizando === 'handoff' ? 'Concluindo...' : 'Concluir Onboarding'}
            </button>
          </div>
        )}

        {/* Pendências */}
        {!todasFinalizadas && plano.status === 'em_andamento' && (
          <div style={{
            background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(249, 115, 22, 0.2)',
            borderRadius: '16px', padding: '20px'
          }}>
            <h4 style={{ color: '#f97316', fontSize: '14px', marginBottom: '12px' }}>Pendências para Handoff</h4>
            <div style={{ color: '#94a3b8', fontSize: '13px' }}>
              • {totalReunioes - reunioesFinalizadas} reunião(ões) pendente(s)
            </div>
            <p style={{ color: '#64748b', fontSize: '12px', marginTop: '8px', marginBottom: 0 }}>
              Marque cada reunião como "Concluída" ou "Não Aplicada"
            </p>
          </div>
        )}

        {/* Modal confirmação exclusão e handoff (compartilhados) */}
        {renderModals()}

        {/* Histórico */}
        {renderHistorico()}
      </div>
    );
  }

  // ============================================
  // RENDER V2 (código original)
  // ============================================
  const progress = calculateProgress(plano);
  const classificacao = plano.classificacao || {};
  const sessoes = plano.sessoes || [];
  const firstValues = plano.first_values || {};
  const modulosOnline = plano.modulos_online || [];
  const statusInfo = PLANO_STATUS[plano.status] || PLANO_STATUS.em_andamento;

  const modulosAoVivo = MODULOS_ORDEM.filter(id => {
    const v = classificacao[id];
    return (typeof v === 'object' ? v.modo || v : v) === 'ao_vivo';
  });

  function renderModals() {
    return (
      <>
        {/* Modal de confirmação de exclusão */}
        {confirmExcluir && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
          }} onClick={() => setConfirmExcluir(false)}>
            <div style={{
              background: '#1e1b4b', border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '16px', padding: '24px', width: '400px', maxWidth: '90vw'
            }} onClick={e => e.stopPropagation()}>
              <h3 style={{ color: 'white', margin: '0 0 12px', fontSize: '16px' }}>Excluir Plano de Onboarding?</h3>
              <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 24px' }}>
                O plano será cancelado e não poderá ser reativado. Você poderá criar um novo plano depois.
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setConfirmExcluir(false)}
                  style={{
                    padding: '10px 20px', background: 'rgba(30, 27, 75, 0.4)',
                    border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '12px',
                    color: 'white', cursor: 'pointer', fontSize: '14px'
                  }}
                >Cancelar</button>
                <button
                  onClick={handleExcluir}
                  disabled={atualizando === 'excluir'}
                  style={{
                    padding: '10px 20px', background: '#ef4444', border: 'none',
                    borderRadius: '12px', color: 'white', fontWeight: '600',
                    cursor: 'pointer', fontSize: '14px'
                  }}
                >{atualizando === 'excluir' ? 'Excluindo...' : 'Excluir'}</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Handoff */}
        {showHandoffModal && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
          }} onClick={() => setShowHandoffModal(false)}>
            <div style={{
              background: '#1e1b4b', border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '16px', padding: '24px', width: '480px', maxWidth: '90vw',
              maxHeight: '80vh', overflowY: 'auto'
            }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <Award size={22} color="#10b981" />
                <h3 style={{ color: 'white', margin: 0, fontSize: '18px' }}>Realizar Handoff</h3>
              </div>

              <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 20px' }}>
                Selecione os responsáveis pelo cliente após o onboarding:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px', maxHeight: '240px', overflowY: 'auto' }}>
                {usuariosSistema.map(u => {
                  const selected = handoffResponsaveis.some(r => r.email === u.email);
                  return (
                    <button
                      key={u.id}
                      onClick={() => handleToggleResponsavel(u)}
                      style={{
                        padding: '10px 14px', background: selected ? 'rgba(16, 185, 129, 0.15)' : '#0f0a1f',
                        border: `1px solid ${selected ? 'rgba(16, 185, 129, 0.4)' : 'rgba(139, 92, 246, 0.15)'}`,
                        borderRadius: '10px', cursor: 'pointer', textAlign: 'left',
                        display: 'flex', alignItems: 'center', gap: '10px'
                      }}
                    >
                      <div style={{
                        width: '20px', height: '20px', borderRadius: '6px',
                        border: selected ? 'none' : '2px solid #64748b',
                        background: selected ? '#10b981' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}>
                        {selected && <CheckCircle size={14} color="white" />}
                      </div>
                      <div>
                        <div style={{ color: 'white', fontSize: '14px' }}>{u.nome}</div>
                        <div style={{ color: '#64748b', fontSize: '12px' }}>{u.email}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {handoffResponsaveis.length > 0 && (
                <div style={{
                  padding: '10px 14px', background: 'rgba(16, 185, 129, 0.1)',
                  borderRadius: '10px', marginBottom: '20px'
                }}>
                  <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>Selecionados:</div>
                  <div style={{ color: '#10b981', fontSize: '13px', fontWeight: '500' }}>
                    {handoffResponsaveis.map(r => r.nome).join(', ')}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowHandoffModal(false)}
                  style={{
                    padding: '10px 20px', background: 'rgba(30, 27, 75, 0.4)',
                    border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '12px',
                    color: 'white', cursor: 'pointer', fontSize: '14px'
                  }}
                >Cancelar</button>
                <button
                  onClick={handleConfirmarHandoff}
                  disabled={handoffResponsaveis.length === 0 || atualizando === 'handoff'}
                  style={{
                    padding: '10px 20px', background: handoffResponsaveis.length > 0 ? '#10b981' : '#3730a3',
                    border: 'none', borderRadius: '12px', color: 'white', fontWeight: '600',
                    cursor: handoffResponsaveis.length > 0 ? 'pointer' : 'default', fontSize: '14px',
                    opacity: handoffResponsaveis.length > 0 ? 1 : 0.5
                  }}
                >{atualizando === 'handoff' ? 'Concluindo...' : 'Confirmar Handoff'}</button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  function renderHistorico() {
    if (historico.length === 0) return null;

    return (
      <div style={{
        background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)',
        borderRadius: '16px', padding: '24px'
      }}>
        <button
          onClick={() => setShowHistorico(!showHistorico)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={18} color="#64748b" />
            <h3 style={{ color: '#94a3b8', fontSize: '15px', margin: 0, fontWeight: '500' }}>
              Histórico ({historico.length} {historico.length === 1 ? 'plano anterior' : 'planos anteriores'})
            </h3>
          </div>
          {showHistorico ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
        </button>

        {showHistorico && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
            {historico.map(h => {
              const isHistV1 = h.versao === 'v1';
              const hStatus = isHistV1
                ? (PLANO_STATUS_V1[h.status] || PLANO_STATUS_V1.cancelado)
                : (PLANO_STATUS[h.status] || PLANO_STATUS.cancelado);
              const criado = h.created_at?.toDate ? h.created_at.toDate() : h.created_at ? new Date(h.created_at) : null;
              const atualizado = h.updated_at?.toDate ? h.updated_at.toDate() : h.updated_at ? new Date(h.updated_at) : null;

              if (isHistV1) {
                const hReunioes = h.reunioes || [];
                const hConcluidas = hReunioes.filter(r => r.status === 'concluida').length;
                const hNaoAplicadas = hReunioes.filter(r => r.status === 'nao_aplicada').length;
                const hFinalizadas = hConcluidas + hNaoAplicadas;
                const hTotal = hReunioes.length;
                const hPct = hTotal > 0 ? Math.round((hFinalizadas / hTotal) * 100) : 0;

                return (
                  <div key={h.id} style={{
                    padding: '14px', background: '#0f0a1f', borderRadius: '12px',
                    border: '1px solid rgba(139, 92, 246, 0.1)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#64748b', fontSize: '11px' }}>v1.0</span>
                        <span style={{
                          padding: '2px 8px', borderRadius: '6px', fontSize: '11px',
                          background: `${hStatus.color}20`, color: hStatus.color
                        }}>{hStatus.label}</span>
                        <span style={{ color: '#64748b', fontSize: '12px' }}>
                          {criado && criado.toLocaleDateString('pt-BR')}
                          {atualizado && ` — ${atualizado.toLocaleDateString('pt-BR')}`}
                        </span>
                      </div>
                      <span style={{ color: '#94a3b8', fontSize: '13px', fontWeight: '600' }}>{hPct}%</span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', color: '#64748b', fontSize: '12px' }}>
                      <span>{hConcluidas} concluída(s)</span>
                      {hNaoAplicadas > 0 && <span>{hNaoAplicadas} não aplicada(s)</span>}
                    </div>
                    {h.created_by && (
                      <div style={{ color: '#64748b', fontSize: '11px', marginTop: '6px' }}>
                        Criado por {h.created_by}
                      </div>
                    )}
                  </div>
                );
              }

              // V2 histórico
              const hProgress = calculateProgress(h);
              const hSessoes = h.sessoes || [];
              const sessoesTotal = hSessoes.length;
              const sessoesConcluidas = hSessoes.filter(s => s.status === 'concluida').length;

              return (
                <div key={h.id} style={{
                  padding: '14px', background: '#0f0a1f', borderRadius: '12px',
                  border: '1px solid rgba(139, 92, 246, 0.1)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#64748b', fontSize: '11px' }}>v2.0</span>
                      <span style={{
                        padding: '2px 8px', borderRadius: '6px', fontSize: '11px',
                        background: `${hStatus.color}20`, color: hStatus.color
                      }}>{hStatus.label}</span>
                      <span style={{ color: '#64748b', fontSize: '12px' }}>
                        {criado && criado.toLocaleDateString('pt-BR')}
                        {atualizado && ` — ${atualizado.toLocaleDateString('pt-BR')}`}
                      </span>
                    </div>
                    <span style={{ color: '#94a3b8', fontSize: '13px', fontWeight: '600' }}>{hProgress.percentual}%</span>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', color: '#64748b', fontSize: '12px' }}>
                    <span>{sessoesConcluidas}/{sessoesTotal} sessões</span>
                    <span>{hProgress.firstValuesAtingidos}/{hProgress.totalFirstValues} first values</span>
                    <span>{hProgress.tutoriaisEnviados}/{hProgress.totalTutoriais} tutoriais</span>
                  </div>
                  {h.created_by && (
                    <div style={{ color: '#64748b', fontSize: '11px', marginTop: '6px' }}>
                      Criado por {h.created_by}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header com progresso */}
      <div style={{
        background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)',
        borderRadius: '16px', padding: '24px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <GraduationCap size={20} color="#8b5cf6" />
            <h3 style={{ color: 'white', margin: 0, fontSize: '16px' }}>Onboarding v2.0</h3>
            <span style={{
              padding: '2px 10px', borderRadius: '8px', fontSize: '12px',
              background: `${statusInfo.color}20`, color: statusInfo.color
            }}>{statusInfo.label}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {plano.status === 'em_andamento' && (
              <>
                <button
                  onClick={handleEditar}
                  disabled={atualizando === 'editar'}
                  style={{
                    padding: '6px 12px', background: 'rgba(139, 92, 246, 0.1)',
                    border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '10px',
                    color: '#a78bfa', cursor: 'pointer', fontSize: '13px',
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <Pencil size={13} /> {atualizando === 'editar' ? '...' : 'Editar'}
                </button>
                <button
                  onClick={() => setConfirmExcluir(true)}
                  style={{
                    padding: '6px 12px', background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px',
                    color: '#ef4444', cursor: 'pointer', fontSize: '13px',
                    display: 'flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <Trash2 size={13} /> Excluir
                </button>
              </>
            )}
            {progress.handoffElegivel && plano.status === 'em_andamento' && (
              <button
                onClick={handleAbrirHandoff}
                disabled={atualizando === 'handoff'}
                style={{
                  padding: '6px 12px', background: '#10b981', border: 'none',
                  borderRadius: '10px', color: 'white', fontWeight: '600',
                  cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <Award size={14} /> {atualizando === 'handoff' ? 'Concluindo...' : 'Realizar Handoff'}
              </button>
            )}
          </div>
        </div>

        {/* Barra de progresso */}
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ color: '#94a3b8', fontSize: '13px' }}>Progresso</span>
            <span style={{ color: 'white', fontWeight: '600', fontSize: '13px' }}>{progress.percentual}%</span>
          </div>
          <div style={{ height: '8px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '4px' }}>
            <div style={{
              height: '100%', borderRadius: '4px',
              width: `${progress.percentual}%`,
              background: progress.percentual === 100 ? '#10b981' : 'linear-gradient(90deg, #8b5cf6, #06b6d4)',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>

        {/* Métricas resumidas */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: 'white', fontWeight: '600' }}>{progress.sessoesFeitas}/{progress.totalSessoes}</div>
            <div style={{ color: '#64748b', fontSize: '12px' }}>Sessões</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: 'white', fontWeight: '600' }}>{progress.firstValuesAtingidos}/{progress.totalFirstValues}</div>
            <div style={{ color: '#64748b', fontSize: '12px' }}>First Values</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: 'white', fontWeight: '600' }}>{progress.tutoriaisEnviados}/{progress.totalTutoriais}</div>
            <div style={{ color: '#64748b', fontSize: '12px' }}>Tutoriais</div>
          </div>
        </div>
      </div>

      {/* Sessões */}
      <div style={{
        background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)',
        borderRadius: '16px', padding: '24px'
      }}>
        <h3 style={{ color: 'white', fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <PlayCircle size={18} color="#8b5cf6" /> Sessões Ao Vivo
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {sessoes.map(s => {
            const sStatus = SESSAO_STATUS[s.status] || SESSAO_STATUS.agendada;
            const expanded = expandedSessao === s.numero;
            const dataSugerida = s.data_sugerida?.toDate ? s.data_sugerida.toDate() : s.data_sugerida ? new Date(s.data_sugerida) : null;

            return (
              <div key={s.numero} style={{
                background: '#0f0a1f', border: '1px solid rgba(139, 92, 246, 0.1)',
                borderRadius: '12px', overflow: 'hidden'
              }}>
                <div
                  style={{
                    padding: '16px', display: 'flex', alignItems: 'center', gap: '12px',
                    cursor: 'pointer'
                  }}
                  onClick={() => setExpandedSessao(expanded ? null : s.numero)}
                >
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '8px',
                    background: s.status === 'concluida' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(139, 92, 246, 0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {s.status === 'concluida'
                      ? <CheckCircle size={16} color="#10b981" />
                      : <span style={{ color: '#8b5cf6', fontWeight: '700', fontSize: '14px' }}>{s.numero}</span>
                    }
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: 'white', fontSize: '14px', fontWeight: '500' }}>
                      {s.modulos.map(m => MODULOS[m]?.nome || m).join(' + ')}
                    </div>
                    <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>
                      {s.duracao} min
                      {dataSugerida && ` • ${dataSugerida.toLocaleDateString('pt-BR')}`}
                    </div>
                  </div>
                  <span style={{
                    padding: '2px 8px', borderRadius: '6px', fontSize: '11px',
                    background: `${sStatus.color}20`, color: sStatus.color
                  }}>{sStatus.label}</span>
                  {expanded ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
                </div>

                {expanded && (
                  <div style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(139, 92, 246, 0.1)' }}>
                    <div style={{ paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {s.modulos.map(mId => (
                        <div key={mId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span style={{ color: '#64748b', fontSize: '12px' }}>{mId} • </span>
                            <span style={{ color: '#94a3b8', fontSize: '13px' }}>{MODULOS[mId]?.nome}</span>
                          </div>
                          <span style={{ color: '#64748b', fontSize: '12px' }}>{MODULOS[mId]?.tempoAoVivo} min</span>
                        </div>
                      ))}
                    </div>

                    {/* Editar data */}
                    {plano.status === 'em_andamento' && (
                      <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Calendar size={14} color="#64748b" />
                        <span style={{ color: '#94a3b8', fontSize: '13px' }}>Data:</span>
                        {editandoData === s.numero ? (
                          <input
                            type="date"
                            defaultValue={dataSugerida ? dataSugerida.toISOString().split('T')[0] : ''}
                            autoFocus
                            onBlur={e => {
                              if (e.target.value) handleSalvarData(s.numero, e.target.value);
                              else setEditandoData(null);
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && e.target.value) handleSalvarData(s.numero, e.target.value);
                              if (e.key === 'Escape') setEditandoData(null);
                            }}
                            style={{
                              padding: '4px 8px', background: '#0f0a1f', border: '1px solid #3730a3',
                              borderRadius: '8px', color: 'white', outline: 'none', fontSize: '13px'
                            }}
                          />
                        ) : (
                          <button
                            onClick={e => { e.stopPropagation(); setEditandoData(s.numero); }}
                            disabled={atualizando === `data-${s.numero}`}
                            style={{
                              padding: '4px 10px', background: 'rgba(139, 92, 246, 0.1)',
                              border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '8px',
                              color: '#a78bfa', cursor: 'pointer', fontSize: '13px',
                              display: 'flex', alignItems: 'center', gap: '4px'
                            }}
                          >
                            {atualizando === `data-${s.numero}` ? '...' : (dataSugerida ? dataSugerida.toLocaleDateString('pt-BR') : 'Definir data')}
                            <Pencil size={11} />
                          </button>
                        )}
                      </div>
                    )}

                    {s.status !== 'concluida' && plano.status === 'em_andamento' && (
                      <button
                        onClick={() => handleConcluirSessao(s.numero)}
                        disabled={atualizando === s.numero}
                        style={{
                          marginTop: '12px', padding: '8px 16px',
                          background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)',
                          borderRadius: '10px', color: '#10b981', cursor: 'pointer',
                          fontSize: '13px', fontWeight: '500', width: '100%'
                        }}
                      >
                        {atualizando === s.numero ? 'Concluindo...' : 'Marcar como Concluída'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* First Values (módulos ao vivo) */}
      <div style={{
        background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)',
        borderRadius: '16px', padding: '24px'
      }}>
        <h3 style={{ color: 'white', fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Award size={18} color="#f59e0b" /> First Values (Ao Vivo)
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {modulosAoVivo.map(id => {
            const fv = firstValues[id];
            const atingido = fv?.atingido;
            const comentarios = fv?.comentarios || [];
            const isExpanded = expandedFV === id;

            return (
              <div key={id} style={{
                background: '#0f0a1f', borderRadius: '10px',
                border: `1px solid ${atingido ? 'rgba(16, 185, 129, 0.2)' : 'rgba(139, 92, 246, 0.1)'}`,
                overflow: 'hidden'
              }}>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px', cursor: 'pointer'
                  }}
                  onClick={() => setExpandedFV(isExpanded ? null : id)}
                >
                  {atingido
                    ? <CheckCircle size={18} color="#10b981" />
                    : <Circle size={18} color="#64748b" />
                  }
                  <div style={{ flex: 1 }}>
                    <div style={{ color: atingido ? '#10b981' : 'white', fontSize: '13px', fontWeight: '500' }}>
                      {id} - {MODULOS[id]?.nome}
                    </div>
                    <div style={{ color: '#64748b', fontSize: '12px' }}>{MODULOS[id]?.firstValue}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {comentarios.length > 0 && (
                      <span style={{
                        padding: '2px 6px', borderRadius: '6px', fontSize: '11px',
                        background: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa',
                        display: 'flex', alignItems: 'center', gap: '3px'
                      }}>
                        <MessageSquare size={10} /> {comentarios.length}
                      </span>
                    )}
                    {!atingido && plano.status === 'em_andamento' && (
                      <button
                        onClick={e => { e.stopPropagation(); handleMarcarFirstValue(id); }}
                        disabled={atualizando === id}
                        style={{
                          padding: '4px 12px', background: 'rgba(16, 185, 129, 0.1)',
                          border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px',
                          color: '#10b981', cursor: 'pointer', fontSize: '12px'
                        }}
                      >
                        {atualizando === id ? '...' : 'Atingido'}
                      </button>
                    )}
                    {isExpanded ? <ChevronUp size={14} color="#64748b" /> : <ChevronDown size={14} color="#64748b" />}
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ padding: '0 12px 12px', borderTop: '1px solid rgba(139, 92, 246, 0.1)' }}>
                    {/* Comentários existentes */}
                    {comentarios.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '10px' }}>
                        {comentarios.map((c, i) => {
                          const dataComent = c.data?.toDate ? c.data.toDate() : c.data ? new Date(c.data) : null;
                          return (
                            <div key={i} style={{
                              padding: '8px 10px', background: 'rgba(30, 27, 75, 0.4)',
                              borderRadius: '8px', borderLeft: '3px solid rgba(139, 92, 246, 0.4)'
                            }}>
                              <div style={{ color: '#e2e8f0', fontSize: '13px' }}>{c.texto}</div>
                              <div style={{ color: '#64748b', fontSize: '11px', marginTop: '4px' }}>
                                {c.autor}{dataComent ? ` • ${dataComent.toLocaleDateString('pt-BR')}` : ''}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Adicionar comentário */}
                    {plano.status === 'em_andamento' && (
                      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                        <input
                          type="text"
                          placeholder="Adicionar acompanhamento..."
                          value={expandedFV === id ? novoComentario : ''}
                          onChange={e => setNovoComentario(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleAdicionarComentario(id); }}
                          style={{
                            flex: 1, padding: '8px 12px', background: 'rgba(30, 27, 75, 0.4)',
                            border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '8px',
                            color: 'white', outline: 'none', fontSize: '13px'
                          }}
                        />
                        <button
                          onClick={() => handleAdicionarComentario(id)}
                          disabled={!novoComentario.trim() || atualizando === `comment-${id}`}
                          style={{
                            padding: '8px 12px', background: 'rgba(139, 92, 246, 0.15)',
                            border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '8px',
                            color: '#a78bfa', cursor: novoComentario.trim() ? 'pointer' : 'default',
                            display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px',
                            opacity: novoComentario.trim() ? 1 : 0.5
                          }}
                        >
                          {atualizando === `comment-${id}` ? '...' : <><Plus size={13} /> Adicionar</>}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Módulos Online */}
      {modulosOnline.length > 0 && (
        <div style={{
          background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)',
          borderRadius: '16px', padding: '24px'
        }}>
          <h3 style={{ color: 'white', fontSize: '16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Monitor size={18} color="#06b6d4" /> Módulos Online
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {modulosOnline.map(item => {
              const modulo = MODULOS[item.modulo];
              if (!modulo) return null;

              return (
                <div key={item.modulo} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px', background: '#0f0a1f', borderRadius: '10px',
                  border: `1px solid ${item.tutorial_enviado ? 'rgba(6, 182, 212, 0.2)' : 'rgba(139, 92, 246, 0.1)'}`
                }}>
                  {item.tutorial_enviado
                    ? <Send size={16} color="#06b6d4" />
                    : <Circle size={16} color="#64748b" />
                  }
                  <div style={{ flex: 1 }}>
                    <div style={{ color: item.tutorial_enviado ? '#06b6d4' : 'white', fontSize: '13px', fontWeight: '500' }}>
                      {item.modulo} - {modulo.nome}
                    </div>
                    <div style={{ color: '#64748b', fontSize: '12px' }}>{modulo.tempoOnline} min online</div>
                  </div>
                  {!item.tutorial_enviado && plano.status === 'em_andamento' && (
                    <button
                      onClick={() => handleMarcarTutorial(item.modulo)}
                      disabled={atualizando === item.modulo}
                      style={{
                        padding: '4px 12px', background: 'rgba(6, 182, 212, 0.1)',
                        border: '1px solid rgba(6, 182, 212, 0.3)', borderRadius: '8px',
                        color: '#06b6d4', cursor: 'pointer', fontSize: '12px'
                      }}
                    >
                      {atualizando === item.modulo ? '...' : 'Tutorial Enviado'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Handoff Status */}
      {progress.handoffElegivel && plano.status === 'em_andamento' && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '16px', padding: '24px', textAlign: 'center'
        }}>
          <Award size={32} color="#10b981" style={{ marginBottom: '8px' }} />
          <h3 style={{ color: '#10b981', margin: '0 0 8px' }}>Elegível para Handoff!</h3>
          <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 16px' }}>
            Todas as sessões concluídas, first values atingidos e tutoriais enviados.
          </p>
          <button
            onClick={handleAbrirHandoff}
            disabled={atualizando === 'handoff'}
            style={{
              padding: '12px 24px', background: '#10b981', border: 'none',
              borderRadius: '12px', color: 'white', fontWeight: '600', cursor: 'pointer'
            }}
          >
            {atualizando === 'handoff' ? 'Concluindo...' : 'Concluir Onboarding'}
          </button>
        </div>
      )}

      {/* Pendências para handoff */}
      {!progress.handoffElegivel && plano.status === 'em_andamento' && (
        <div style={{
          background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(249, 115, 22, 0.2)',
          borderRadius: '16px', padding: '20px'
        }}>
          <h4 style={{ color: '#f97316', fontSize: '14px', marginBottom: '12px' }}>Pendências para Handoff</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {progress.sessoesFeitas < progress.totalSessoes && (
              <div style={{ color: '#94a3b8', fontSize: '13px' }}>
                • {progress.totalSessoes - progress.sessoesFeitas} sessão(ões) pendente(s)
              </div>
            )}
            {progress.firstValuesAtingidos < progress.totalFirstValues && (
              <div style={{ color: '#94a3b8', fontSize: '13px' }}>
                • {progress.totalFirstValues - progress.firstValuesAtingidos} first value(s) pendente(s)
              </div>
            )}
            {progress.tutoriaisEnviados < progress.totalTutoriais && (
              <div style={{ color: '#94a3b8', fontSize: '13px' }}>
                • {progress.totalTutoriais - progress.tutoriaisEnviados} tutorial(is) não enviado(s)
              </div>
            )}
          </div>
        </div>
      )}

      {renderModals()}
      {renderHistorico()}
    </div>
  );
}
