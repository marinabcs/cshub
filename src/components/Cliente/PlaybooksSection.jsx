import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Check, Clock, ChevronDown, ChevronUp, Play, X, MessageSquare, Loader2, AlertTriangle } from 'lucide-react';
import { buscarPlaybooksCliente, atualizarEtapa, cancelarPlaybook, formatarPrazo, PLAYBOOK_STATUS, ETAPA_STATUS } from '../../services/playbooks';
import { useAuth } from '../../contexts/AuthContext';

export default function PlaybooksSection({ clienteId }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [playbooks, setPlaybooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedPlaybook, setExpandedPlaybook] = useState(null);
  const [atualizandoEtapa, setAtualizandoEtapa] = useState(null);
  const [observacoesTemp, setObservacoesTemp] = useState({});

  useEffect(() => {
    const fetchPlaybooks = async () => {
      try {
        const data = await buscarPlaybooksCliente(clienteId);
        setPlaybooks(data);
        // Expandir automaticamente se houver apenas um playbook ativo
        const ativos = data.filter(p => p.status === 'em_andamento');
        if (ativos.length === 1) {
          setExpandedPlaybook(ativos[0].id);
        }
      } catch (error) {
        console.error('Erro ao buscar playbooks:', error);
      } finally {
        setLoading(false);
      }
    };

    if (clienteId) {
      fetchPlaybooks();
    }
  }, [clienteId]);

  const togglePlaybook = (playbookId) => {
    setExpandedPlaybook(prev => prev === playbookId ? null : playbookId);
  };

  const handleAtualizarEtapa = async (playbookId, ordemEtapa, novoStatus) => {
    const key = `${playbookId}-${ordemEtapa}`;
    setAtualizandoEtapa(key);

    try {
      const obs = observacoesTemp[key] || '';
      const result = await atualizarEtapa(clienteId, playbookId, ordemEtapa, novoStatus, obs, user?.email);

      // Atualizar estado local
      setPlaybooks(prev => prev.map(p => {
        if (p.id !== playbookId) return p;

        const novasEtapas = p.etapas.map(e => {
          if (e.ordem !== ordemEtapa) return e;
          return {
            ...e,
            status: novoStatus,
            concluida_em: novoStatus === 'concluida' ? new Date() : null,
            concluida_por: novoStatus === 'concluida' ? user?.email : null,
            observacoes: obs || e.observacoes
          };
        });

        return {
          ...p,
          etapas: novasEtapas,
          progresso: result.progresso,
          status: result.status
        };
      }));

      // Limpar observações temporárias
      setObservacoesTemp(prev => {
        const novo = { ...prev };
        delete novo[key];
        return novo;
      });
    } catch (error) {
      console.error('Erro ao atualizar etapa:', error);
      alert(`Erro ao atualizar etapa: ${error.message}`);
    } finally {
      setAtualizandoEtapa(null);
    }
  };

  const handleCancelarPlaybook = async (playbookId) => {
    if (!confirm('Tem certeza que deseja cancelar este playbook?')) return;

    try {
      await cancelarPlaybook(clienteId, playbookId);
      setPlaybooks(prev => prev.map(p =>
        p.id === playbookId ? { ...p, status: 'cancelado' } : p
      ));
    } catch (error) {
      console.error('Erro ao cancelar playbook:', error);
      alert(`Erro ao cancelar: ${error.message}`);
    }
  };

  const formatarData = (timestamp) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  if (loading) {
    return (
      <div style={{
        background: 'rgba(30, 27, 75, 0.4)',
        border: '1px solid rgba(139, 92, 246, 0.15)',
        borderRadius: '20px',
        padding: '48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Loader2 style={{ width: '24px', height: '24px', color: '#8b5cf6', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{
      background: 'rgba(30, 27, 75, 0.4)',
      border: '1px solid rgba(139, 92, 246, 0.15)',
      borderRadius: '20px',
      padding: '24px',
      marginBottom: '32px'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ClipboardList style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
          <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>Playbooks</h2>
          {playbooks.length > 0 && (
            <span style={{
              padding: '4px 12px',
              background: 'rgba(139, 92, 246, 0.2)',
              color: '#a78bfa',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: '500'
            }}>
              {playbooks.filter(p => p.status === 'em_andamento').length} ativo{playbooks.filter(p => p.status === 'em_andamento').length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button
          onClick={() => navigate('/playbooks')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            background: 'rgba(139, 92, 246, 0.1)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '10px',
            color: '#a78bfa',
            fontSize: '13px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          <Play style={{ width: '14px', height: '14px' }} />
          Aplicar Novo
        </button>
      </div>

      {/* Lista de Playbooks */}
      {playbooks.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {playbooks.map(playbook => {
            const isExpanded = expandedPlaybook === playbook.id;
            const statusInfo = PLAYBOOK_STATUS[playbook.status];

            return (
              <div
                key={playbook.id}
                style={{
                  background: 'rgba(15, 10, 31, 0.6)',
                  border: `1px solid ${playbook.status === 'em_andamento' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(100, 116, 139, 0.2)'}`,
                  borderRadius: '16px',
                  overflow: 'hidden'
                }}
              >
                {/* Header do Playbook */}
                <div
                  onClick={() => togglePlaybook(playbook.id)}
                  style={{
                    padding: '20px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      background: `${statusInfo.color}15`,
                      border: `1px solid ${statusInfo.color}30`,
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <ClipboardList style={{ width: '24px', height: '24px', color: statusInfo.color }} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                        <h4 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: 0 }}>
                          {playbook.playbook_nome}
                        </h4>
                        <span style={{
                          padding: '3px 10px',
                          background: `${statusInfo.color}20`,
                          color: statusInfo.color,
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}>
                          {statusInfo.label}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <span style={{ color: '#64748b', fontSize: '13px' }}>
                          Iniciado em {formatarData(playbook.data_inicio)}
                        </span>
                        <span style={{ color: '#64748b', fontSize: '13px' }}>
                          Previsão: {formatarData(playbook.data_previsao_fim)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    {/* Barra de Progresso */}
                    <div style={{ width: '160px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>Progresso</span>
                        <span style={{ color: 'white', fontSize: '12px', fontWeight: '600' }}>{playbook.progresso || 0}%</span>
                      </div>
                      <div style={{
                        height: '6px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '3px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${playbook.progresso || 0}%`,
                          height: '100%',
                          background: playbook.progresso >= 100 ? '#10b981' : 'linear-gradient(90deg, #8b5cf6 0%, #06b6d4 100%)',
                          borderRadius: '3px',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                    </div>

                    {isExpanded ? (
                      <ChevronUp style={{ width: '20px', height: '20px', color: '#64748b' }} />
                    ) : (
                      <ChevronDown style={{ width: '20px', height: '20px', color: '#64748b' }} />
                    )}
                  </div>
                </div>

                {/* Etapas (expandido) */}
                {isExpanded && (
                  <div style={{
                    padding: '0 20px 20px',
                    borderTop: '1px solid rgba(139, 92, 246, 0.1)'
                  }}>
                    <div style={{ paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {playbook.etapas?.map((etapa, index) => {
                        const etapaStatus = ETAPA_STATUS[etapa.status];
                        const prazoInfo = formatarPrazo(etapa.prazo_data, etapa.status);
                        const key = `${playbook.id}-${etapa.ordem}`;
                        const isAtualizando = atualizandoEtapa === key;

                        return (
                          <div
                            key={etapa.ordem}
                            style={{
                              padding: '16px',
                              background: etapa.status === 'concluida' ? 'rgba(16, 185, 129, 0.05)' : 'rgba(0, 0, 0, 0.2)',
                              border: `1px solid ${etapa.status === 'concluida' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(139, 92, 246, 0.1)'}`,
                              borderRadius: '12px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                              {/* Checkbox / Status */}
                              {playbook.status === 'em_andamento' && etapa.status === 'pendente' ? (
                                <button
                                  onClick={() => handleAtualizarEtapa(playbook.id, etapa.ordem, 'concluida')}
                                  disabled={isAtualizando}
                                  style={{
                                    width: '28px',
                                    height: '28px',
                                    background: 'transparent',
                                    border: '2px solid rgba(139, 92, 246, 0.4)',
                                    borderRadius: '8px',
                                    cursor: isAtualizando ? 'wait' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    marginTop: '2px'
                                  }}
                                >
                                  {isAtualizando && (
                                    <Loader2 style={{ width: '14px', height: '14px', color: '#8b5cf6', animation: 'spin 1s linear infinite' }} />
                                  )}
                                </button>
                              ) : (
                                <div style={{
                                  width: '28px',
                                  height: '28px',
                                  background: `${etapaStatus.color}20`,
                                  borderRadius: '8px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                  marginTop: '2px',
                                  fontSize: '14px'
                                }}>
                                  {etapaStatus.icon}
                                </div>
                              )}

                              {/* Conteúdo */}
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                                  <span style={{
                                    color: etapa.status === 'concluida' ? '#10b981' : 'white',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    textDecoration: etapa.status === 'pulada' ? 'line-through' : 'none'
                                  }}>
                                    {etapa.nome}
                                  </span>
                                  {!etapa.obrigatoria && (
                                    <span style={{
                                      padding: '2px 6px',
                                      background: 'rgba(100, 116, 139, 0.2)',
                                      color: '#94a3b8',
                                      borderRadius: '4px',
                                      fontSize: '10px'
                                    }}>
                                      Opcional
                                    </span>
                                  )}
                                </div>
                                <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 8px 0' }}>
                                  {etapa.descricao}
                                </p>

                                {/* Info de conclusão ou prazo */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                                  <span style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    color: prazoInfo.cor,
                                    fontSize: '12px'
                                  }}>
                                    <Clock style={{ width: '12px', height: '12px' }} />
                                    {prazoInfo.texto}
                                  </span>

                                  {etapa.concluida_por && (
                                    <span style={{ color: '#64748b', fontSize: '12px' }}>
                                      por {etapa.concluida_por}
                                    </span>
                                  )}

                                  {etapa.observacoes && (
                                    <span style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      color: '#94a3b8',
                                      fontSize: '12px'
                                    }}>
                                      <MessageSquare style={{ width: '12px', height: '12px' }} />
                                      {etapa.observacoes}
                                    </span>
                                  )}
                                </div>

                                {/* Campo de observações para etapas pendentes */}
                                {playbook.status === 'em_andamento' && etapa.status === 'pendente' && (
                                  <div style={{ marginTop: '12px' }}>
                                    <input
                                      type="text"
                                      placeholder="Adicionar observação (opcional)..."
                                      value={observacoesTemp[key] || ''}
                                      onChange={(e) => setObservacoesTemp(prev => ({ ...prev, [key]: e.target.value }))}
                                      style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        background: 'rgba(15, 10, 31, 0.6)',
                                        border: '1px solid rgba(139, 92, 246, 0.2)',
                                        borderRadius: '8px',
                                        color: 'white',
                                        fontSize: '13px',
                                        outline: 'none',
                                        boxSizing: 'border-box'
                                      }}
                                    />
                                  </div>
                                )}
                              </div>

                              {/* Ações */}
                              {playbook.status === 'em_andamento' && etapa.status === 'pendente' && (
                                <button
                                  onClick={() => handleAtualizarEtapa(playbook.id, etapa.ordem, 'pulada')}
                                  disabled={isAtualizando}
                                  style={{
                                    padding: '6px 10px',
                                    background: 'transparent',
                                    border: '1px solid rgba(100, 116, 139, 0.3)',
                                    borderRadius: '8px',
                                    color: '#64748b',
                                    fontSize: '11px',
                                    cursor: 'pointer'
                                  }}
                                  title="Pular etapa"
                                >
                                  Pular
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Botão de cancelar playbook */}
                    {playbook.status === 'em_andamento' && (
                      <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleCancelarPlaybook(playbook.id)}
                          style={{
                            padding: '8px 14px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            borderRadius: '8px',
                            color: '#ef4444',
                            fontSize: '12px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <X style={{ width: '14px', height: '14px' }} />
                          Cancelar Playbook
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ padding: '48px', textAlign: 'center' }}>
          <ClipboardList style={{ width: '48px', height: '48px', color: '#64748b', margin: '0 auto 16px' }} />
          <p style={{ color: '#94a3b8', fontSize: '16px', margin: '0 0 8px 0' }}>Nenhum playbook aplicado</p>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 16px 0' }}>
            Aplique um playbook para acompanhar o progresso deste cliente
          </p>
          <button
            onClick={() => navigate('/playbooks')}
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Play style={{ width: '16px', height: '16px' }} />
            Ver Playbooks
          </button>
        </div>
      )}
    </div>
  );
}
