import { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Building2, Users, Clock, Pencil, AlertTriangle, Activity, MessageSquare, GraduationCap, ClipboardList, FolderOpen, X, ExternalLink } from 'lucide-react';
import { getClienteSegmento } from '../utils/segmentoCS';
import { SegmentoBadge } from '../components/UI/SegmentoBadge';
import { useUserActivityStatus } from '../hooks/useUserActivityStatus';
import { useClienteData } from '../hooks/useClienteData';
import OnboardingSection from '../components/Cliente/OnboardingSection';
import OngoingSection from '../components/Cliente/OngoingSection';
import TabResumo from '../components/ClienteDetalhe/TabResumo';
import TabInteracoes from '../components/ClienteDetalhe/TabInteracoes';
import TabDocumentos from '../components/ClienteDetalhe/TabDocumentos';
import TabPessoas from '../components/ClienteDetalhe/TabPessoas';
import ThreadDetailModal from '../components/ClienteDetalhe/ThreadDetailModal';

export default function ClienteDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Tab state - read from URL if present
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabFromUrl || 'resumo');

  // All data from hook
  const {
    cliente, setCliente,
    threads, setThreads,
    usageData,
    chartData,
    usuarios,
    loading,
    teamIds,
    segmentoCalculado,
    alertasCliente,
    documentos, setDocumentos,
    loadingDocs,
    observacoes, setObservacoes,
    interacoes, setInteracoes,
    mensagens,
    loadingMensagens,
    suggestedContacts, setSuggestedContacts,
    handleRecalcularSegmento,
    fetchMensagens,
    fetchDocumentos,
    fetchObservacoes,
    fetchInteracoes,
  } = useClienteData(id);

  // User activity status
  const { getStatus: getUserActivityStatus } = useUserActivityStatus(teamIds, usuarios);

  // Modal state
  const [selectedThread, setSelectedThread] = useState(null);
  const [alertaDetalhe, setAlertaDetalhe] = useState(null);

  // Handle thread click from timeline
  const handleThreadClick = (thread) => {
    setSelectedThread(thread);
    fetchMensagens(thread);
  };

  // Handle alerta click from timeline
  const handleAlertaClick = (alerta) => {
    setAlertaDetalhe(alerta);
  };

  // Loading state
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f0a1f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '48px', height: '48px', border: '3px solid rgba(139, 92, 246, 0.2)', borderTopColor: '#8b5cf6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      </div>
    );
  }

  // Not found
  if (!cliente) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f0a1f', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
        <AlertTriangle style={{ width: '48px', height: '48px', color: '#f59e0b' }} />
        <p style={{ color: '#94a3b8', fontSize: '16px' }}>Cliente não encontrado</p>
        <button onClick={() => navigate('/clientes')} style={{ padding: '12px 24px', background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)', border: 'none', borderRadius: '12px', color: 'white', cursor: 'pointer' }}>Voltar para Clientes</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px', background: '#0f0a1f', minHeight: '100vh', maxWidth: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <button onClick={() => navigate('/clientes')} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: '#94a3b8', fontSize: '14px', cursor: 'pointer', marginBottom: '16px', padding: 0 }}>
          <ArrowLeft style={{ width: '18px', height: '18px' }} />
          Voltar para Clientes
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: '64px', height: '64px', background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '24px', boxShadow: '0 8px 24px rgba(139, 92, 246, 0.3)' }}>
              {cliente.team_name?.charAt(0) || 'C'}
            </div>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: 'white', margin: '0 0 8px 0' }}>{cliente.team_name}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Building2 style={{ width: '16px', height: '16px', color: '#64748b' }} />
                  <span style={{ color: '#94a3b8', fontSize: '14px' }}>{cliente.team_type || 'Sem tipo'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <Users style={{ width: '16px', height: '16px', color: '#64748b' }} />
                  {cliente.responsaveis && cliente.responsaveis.length > 0
                    ? cliente.responsaveis.map((r, i) => (
                        <span key={r.email} style={{ color: '#94a3b8', fontSize: '14px' }}>
                          {r.nome}{i < cliente.responsaveis.length - 1 ? ',' : ''}
                        </span>
                      ))
                    : <span style={{ color: '#94a3b8', fontSize: '14px' }}>{cliente.responsavel_nome || 'Sem responsável'}</span>
                  }
                </div>
                {cliente.created_at && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock style={{ width: '16px', height: '16px', color: '#64748b' }} />
                    <span style={{ color: '#94a3b8', fontSize: '14px' }}>
                      Criado em {(cliente.created_at.toDate ? cliente.created_at.toDate() : new Date(cliente.created_at)).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <SegmentoBadge segmento={getClienteSegmento(cliente)} size="md" />
            {cliente.status === 'inativo' && (
              <span style={{ padding: '8px 16px', background: 'rgba(107, 114, 128, 0.2)', color: '#9ca3af', borderRadius: '12px', fontSize: '14px', fontWeight: '600', border: '1px solid rgba(107, 114, 128, 0.3)' }}>
                Inativo
              </span>
            )}
            <button
              onClick={() => navigate(`/clientes/${id}/editar`)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                background: 'rgba(139, 92, 246, 0.1)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '12px',
                color: '#a78bfa',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              <Pencil style={{ width: '16px', height: '16px' }} />
              Editar
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div style={{
        display: 'flex',
        gap: '4px',
        marginBottom: '24px',
        background: 'rgba(30, 27, 75, 0.4)',
        padding: '6px',
        borderRadius: '16px',
        border: '1px solid rgba(139, 92, 246, 0.15)',
        overflowX: 'auto',
        overflowY: 'hidden'
      }}>
        {[
          { id: 'resumo', label: 'Resumo', icon: Activity },
          { id: 'interacoes', label: 'Interações', icon: MessageSquare, count: threads.length + interacoes.length + observacoes.length + alertasCliente.length },
          { id: 'onboarding', label: 'Onboarding', icon: GraduationCap },
          { id: 'ongoing', label: 'Ongoing', icon: ClipboardList },
          { id: 'documentos', label: 'Documentos', icon: FolderOpen },
          { id: 'pessoas', label: 'Pessoas', icon: Users, count: usuarios.length }
        ].map(tab => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '10px 14px',
                whiteSpace: 'nowrap',
                background: isActive
                  ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(6, 182, 212, 0.15) 100%)'
                  : 'transparent',
                border: isActive
                  ? '1px solid rgba(139, 92, 246, 0.3)'
                  : '1px solid transparent',
                borderRadius: '12px',
                color: isActive ? 'white' : '#94a3b8',
                fontSize: '14px',
                fontWeight: isActive ? '600' : '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <TabIcon style={{ width: '18px', height: '18px' }} />
              {tab.label}
              {tab.count !== undefined && (
                <span style={{
                  padding: '2px 8px',
                  background: isActive ? 'rgba(139, 92, 246, 0.3)' : 'rgba(100, 116, 139, 0.3)',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: '600',
                  color: isActive ? '#a78bfa' : '#64748b'
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'resumo' && (
        <TabResumo
          cliente={cliente}
          setCliente={setCliente}
          clienteId={id}
          usageData={usageData}
          chartData={chartData}
          segmentoCalculado={segmentoCalculado}
          onRecalcularSegmento={handleRecalcularSegmento}
        />
      )}

      {activeTab === 'interacoes' && (
        <TabInteracoes
          clienteId={id}
          cliente={cliente}
          threads={threads}
          interacoes={interacoes}
          setInteracoes={setInteracoes}
          observacoes={observacoes}
          setObservacoes={setObservacoes}
          alertasCliente={alertasCliente}
          onThreadClick={handleThreadClick}
          onAlertaClick={handleAlertaClick}
          fetchObservacoes={fetchObservacoes}
          fetchInteracoes={fetchInteracoes}
          setCliente={setCliente}
        />
      )}

      {activeTab === 'onboarding' && (
        <OnboardingSection clienteId={id} />
      )}

      {activeTab === 'ongoing' && (
        <OngoingSection clienteId={id} segmentoAtual={getClienteSegmento(cliente)} cliente={cliente} />
      )}

      {activeTab === 'documentos' && (
        <TabDocumentos
          clienteId={id}
          documentos={documentos}
          setDocumentos={setDocumentos}
          loadingDocs={loadingDocs}
          fetchDocumentos={fetchDocumentos}
        />
      )}

      {activeTab === 'pessoas' && (
        <TabPessoas
          clienteId={id}
          cliente={cliente}
          setCliente={setCliente}
          usuarios={usuarios}
          threads={threads}
          getUserActivityStatus={getUserActivityStatus}
          suggestedContacts={suggestedContacts}
          setSuggestedContacts={setSuggestedContacts}
        />
      )}

      {/* Thread Detail Modal */}
      {selectedThread && (
        <ThreadDetailModal
          selectedThread={selectedThread}
          setSelectedThread={setSelectedThread}
          mensagens={mensagens}
          loadingMensagens={loadingMensagens}
          cliente={cliente}
          observacoes={observacoes}
          threads={threads}
          setThreads={setThreads}
          setActiveTab={setActiveTab}
          fetchMensagens={fetchMensagens}
        />
      )}

      {/* Modal de Detalhes do Alerta */}
      {alertaDetalhe && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '32px' }}>
          <div style={{ background: '#1a1033', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '20px', width: '100%', maxWidth: '600px', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <AlertTriangle style={{ width: '20px', height: '20px', color: '#ef4444' }} />
                  <h3 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>Detalhes do Alerta</h3>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {(() => {
                    const statusColors = {
                      pendente: { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', label: 'Pendente' },
                      em_andamento: { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', label: 'Em Andamento' },
                      bloqueado: { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', label: 'Bloqueado' },
                      resolvido: { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', label: 'Resolvido' },
                      ignorado: { bg: 'rgba(100, 116, 139, 0.15)', color: '#64748b', label: 'Ignorado' }
                    };
                    const statusInfo = statusColors[alertaDetalhe.status] || statusColors.pendente;
                    return (
                      <span style={{ padding: '4px 10px', background: statusInfo.bg, color: statusInfo.color, borderRadius: '6px', fontSize: '12px', fontWeight: '500' }}>
                        {statusInfo.label}
                      </span>
                    );
                  })()}
                  {alertaDetalhe.prioridade && (
                    <span style={{ padding: '4px 10px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', borderRadius: '6px', fontSize: '11px', fontWeight: '500', textTransform: 'capitalize' }}>
                      {alertaDetalhe.prioridade}
                    </span>
                  )}
                  {alertaDetalhe.clickup_task_id && (
                    <a
                      href={alertaDetalhe.clickup_task_url || `https://app.clickup.com/t/${alertaDetalhe.clickup_task_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ padding: '4px 10px', background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4', borderRadius: '6px', fontSize: '11px', fontWeight: '500', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <ExternalLink style={{ width: '12px', height: '12px' }} />
                      ClickUp
                    </a>
                  )}
                </div>
              </div>
              <button onClick={() => setAlertaDetalhe(null)} style={{ width: '36px', height: '36px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X style={{ width: '18px', height: '18px', color: '#ef4444' }} />
              </button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
              {/* Tipo e Data */}
              <div style={{ marginBottom: '16px' }}>
                <p style={{ color: '#64748b', fontSize: '12px', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tipo</p>
                <p style={{ color: '#e2e8f0', fontSize: '14px', margin: 0 }}>
                  {alertaDetalhe.tipo === 'sentimento_negativo' ? 'Sentimento Negativo' :
                   alertaDetalhe.tipo === 'problema_reclamacao' ? 'Problema/Reclamação' :
                   alertaDetalhe.tipo === 'entrou_resgate' ? 'Entrou em Resgate' : alertaDetalhe.tipo}
                </p>
              </div>

              {/* Titulo */}
              <div style={{ marginBottom: '16px' }}>
                <p style={{ color: '#64748b', fontSize: '12px', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Título</p>
                <p style={{ color: 'white', fontSize: '15px', fontWeight: '500', margin: 0 }}>{alertaDetalhe.titulo}</p>
              </div>

              {/* Mensagem */}
              {alertaDetalhe.mensagem && (
                <div style={{ marginBottom: '16px' }}>
                  <p style={{ color: '#64748b', fontSize: '12px', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Descrição</p>
                  <p style={{ color: '#e2e8f0', fontSize: '14px', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{alertaDetalhe.mensagem}</p>
                </div>
              )}

              {/* Datas */}
              <div style={{ display: 'flex', gap: '24px', marginBottom: '16px' }}>
                <div>
                  <p style={{ color: '#64748b', fontSize: '12px', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Criado em</p>
                  <p style={{ color: '#e2e8f0', fontSize: '13px', margin: 0 }}>
                    {alertaDetalhe.created_at?.toDate ? alertaDetalhe.created_at.toDate().toLocaleString('pt-BR') : 'N/A'}
                  </p>
                </div>
                {alertaDetalhe.resolved_at && (
                  <div>
                    <p style={{ color: '#64748b', fontSize: '12px', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Resolvido em</p>
                    <p style={{ color: '#10b981', fontSize: '13px', margin: 0 }}>
                      {alertaDetalhe.resolved_at?.toDate ? alertaDetalhe.resolved_at.toDate().toLocaleString('pt-BR') : 'N/A'}
                    </p>
                  </div>
                )}
              </div>

              {/* Notas internas */}
              {alertaDetalhe.notas && (
                <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '8px' }}>
                  <p style={{ color: '#64748b', fontSize: '12px', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Notas Internas</p>
                  <p style={{ color: '#e2e8f0', fontSize: '13px', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{alertaDetalhe.notas}</p>
                </div>
              )}

              {/* Comentarios do ClickUp */}
              {alertaDetalhe.clickup_comments && alertaDetalhe.clickup_comments.length > 0 && (
                <div style={{ marginTop: '20px', borderTop: '1px solid rgba(139, 92, 246, 0.1)', paddingTop: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <MessageSquare style={{ width: '16px', height: '16px', color: '#06b6d4' }} />
                    <p style={{ color: '#06b6d4', fontSize: '14px', fontWeight: '600', margin: 0 }}>
                      Comentários do ClickUp ({alertaDetalhe.clickup_comments.length})
                    </p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {alertaDetalhe.clickup_comments.map((comment, idx) => (
                      <div key={idx} style={{ padding: '12px', background: 'rgba(6, 182, 212, 0.08)', border: '1px solid rgba(6, 182, 212, 0.15)', borderRadius: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ color: 'white', fontSize: '13px', fontWeight: '500' }}>
                            {comment.user?.username || comment.user?.email || 'Usuário'}
                          </span>
                          <span style={{ color: '#64748b', fontSize: '11px' }}>
                            {comment.date ? new Date(parseInt(comment.date)).toLocaleString('pt-BR') : ''}
                          </span>
                        </div>
                        <p style={{ color: '#e2e8f0', fontSize: '13px', margin: 0, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                          {comment.comment_text || comment.text_content || ''}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(139, 92, 246, 0.1)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setAlertaDetalhe(null)}
                style={{ padding: '10px 20px', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '10px', color: '#a78bfa', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
