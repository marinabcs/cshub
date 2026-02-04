import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MODULOS, MODULOS_ORDEM, PLANO_STATUS, SESSAO_STATUS } from '../../constants/onboarding';
import { buscarPlanoAtivo, atualizarSessao, marcarFirstValue, marcarTutorialEnviado, concluirOnboarding } from '../../services/onboarding';
import { calculateProgress } from '../../utils/onboardingCalculator';
import {
  GraduationCap, CheckCircle, Circle, Clock, Send, Calendar,
  Monitor, Users, Award, ChevronDown, ChevronUp, PlayCircle
} from 'lucide-react';

export default function OnboardingSection({ clienteId }) {
  const navigate = useNavigate();
  const [plano, setPlano] = useState(null);
  const [loading, setLoading] = useState(true);
  const [atualizando, setAtualizando] = useState(null);
  const [expandedSessao, setExpandedSessao] = useState(null);

  useEffect(() => {
    loadPlano();
  }, [clienteId]);

  async function loadPlano() {
    setLoading(true);
    const p = await buscarPlanoAtivo(clienteId);
    setPlano(p);
    setLoading(false);
  }

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

  async function handleHandoff() {
    setAtualizando('handoff');
    try {
      await concluirOnboarding(clienteId, plano.id);
      await loadPlano();
    } catch {
      // erro logado
    }
    setAtualizando(null);
  }

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
          Use a Calculadora de Onboarding para criar um plano personalizado.
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
            <h3 style={{ color: 'white', margin: 0, fontSize: '16px' }}>Plano de Onboarding</h3>
            <span style={{
              padding: '2px 10px', borderRadius: '8px', fontSize: '12px',
              background: `${statusInfo.color}20`, color: statusInfo.color
            }}>{statusInfo.label}</span>
          </div>
          {progress.handoffElegivel && plano.status === 'em_andamento' && (
            <button
              onClick={handleHandoff}
              disabled={atualizando === 'handoff'}
              style={{
                padding: '8px 16px', background: '#10b981', border: 'none',
                borderRadius: '10px', color: 'white', fontWeight: '600',
                cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <Award size={14} /> {atualizando === 'handoff' ? 'Concluindo...' : 'Realizar Handoff'}
            </button>
          )}
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

            return (
              <div key={id} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px', background: '#0f0a1f', borderRadius: '10px',
                border: `1px solid ${atingido ? 'rgba(16, 185, 129, 0.2)' : 'rgba(139, 92, 246, 0.1)'}`
              }}>
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
                {!atingido && plano.status === 'em_andamento' && (
                  <button
                    onClick={() => handleMarcarFirstValue(id)}
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
            onClick={handleHandoff}
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
    </div>
  );
}
