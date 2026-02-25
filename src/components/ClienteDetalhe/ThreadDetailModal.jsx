import { useState } from 'react';
import { X, AlertTriangle, Mail, Pencil, Bot, Eye, EyeOff, ArrowLeft, Search, ExternalLink, MessageSquare, ClipboardList, Loader2 } from 'lucide-react';
import { doc, collection, getDocs, query, where, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useClassificarThread } from '../../hooks/useClassificarThread';
import { THREAD_CATEGORIAS, THREAD_SENTIMENTOS, getCategoriaInfo, getSentimentoInfo, isOpenAIConfigured } from '../../services/openai';
import { cleanMessageContent, formatDate, getStatusColor, getStatusLabel } from './constants';

/**
 * ThreadDetailModal - Modal for viewing thread messages, classifying, moving threads.
 * Also includes the AlertaDetalhe modal and MoveThread modal.
 */
export default function ThreadDetailModal({
  selectedThread,
  setSelectedThread,
  mensagens,
  loadingMensagens,
  cliente,
  observacoes,
  threads: _threads,
  setThreads,
  setActiveTab,
  fetchMensagens: _fetchMensagens
}) {
  const { classificar, classificarManual, classificando, erro: erroClassificacao } = useClassificarThread();
  const [showManualClassification, setShowManualClassification] = useState(false);
  const [manualCategoria, setManualCategoria] = useState('');
  const [manualSentimento, setManualSentimento] = useState('');
  const [manualResumo, setManualResumo] = useState('');

  // Move thread
  const [showMoveThread, setShowMoveThread] = useState(false);
  const [allTeams, setAllTeams] = useState([]);
  const [selectedNewTeam, setSelectedNewTeam] = useState('');
  const [movingThread, setMovingThread] = useState(false);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [searchTeam, setSearchTeam] = useState('');

  const getSentimentColor = (sentiment) => getSentimentoInfo(sentiment).color;
  const getCategoryLabel = (cat) => getCategoriaInfo(cat).label;
  const getCategoryColor = (cat) => getCategoriaInfo(cat).color;

  // Marcar/desmarcar thread como irrelevante
  const handleMarcarIrrelevante = async (thread) => {
    try {
      const threadRef = doc(db, 'threads', thread.id);
      const novoValor = !thread.filtrado_manual;
      await updateDoc(threadRef, {
        filtrado_manual: novoValor,
        filtrado_manual_em: novoValor ? Timestamp.now() : null,
        filtrado_manual_por: novoValor ? 'manual' : null
      });
      setThreads(prev => prev.map(t =>
        t.id === thread.id
          ? { ...t, filtrado_manual: novoValor }
          : t
      ));
    } catch {
      // Silently handle error
    }
  };

  // Classificar thread com IA
  const handleClassificarThread = async () => {
    if (!selectedThread) return;

    let conversaTexto = '';
    if (mensagens.length > 0) {
      conversaTexto = mensagens.map(msg =>
        `[${msg.tipo_remetente === 'equipe' ? 'Equipe' : 'Cliente'} - ${msg.remetente_nome || 'Anônimo'}]: ${msg.snippet || ''}`
      ).join('\n');
    } else {
      conversaTexto = `Assunto: ${selectedThread.assunto || selectedThread.subject || 'Sem assunto'}\n${selectedThread.snippet || ''}`;
    }

    if (!conversaTexto.trim()) {
      alert('Não há conteúdo para classificar');
      return;
    }

    const threadData = {
      team_name: cliente?.team_name,
      cliente_id: cliente?.id,
      cliente_nome: cliente?.team_name,
      responsavel_email: cliente?.responsavel_email,
      responsavel_nome: cliente?.responsavel_nome
    };

    const threadId = selectedThread.thread_id || selectedThread.id;
    const teamId = selectedThread.team_id || selectedThread._teamId;

    const obsAtivas = observacoes.filter(o => o.status === 'ativa');

    const result = await classificar(teamId, threadId, conversaTexto, threadData, obsAtivas);

    if (result.success) {
      setSelectedThread(prev => ({
        ...prev,
        categoria: result.resultado.categoria,
        sentimento: result.resultado.sentimento,
        status: result.resultado.status,
        resumo_ia: result.resultado.resumo,
        classificado_por: 'ia'
      }));

      const currentThreadId = selectedThread.thread_id || selectedThread.id;
      setThreads(prev => prev.map(t =>
        (t.thread_id || t.id) === currentThreadId
          ? { ...t, categoria: result.resultado.categoria, sentimento: result.resultado.sentimento, status: result.resultado.status, resumo_ia: result.resultado.resumo, classificado_por: 'ia' }
          : t
      ));
    }
  };

  // Classificar manualmente
  const handleClassificarManual = async () => {
    if (!selectedThread || !manualCategoria || !manualSentimento) return;

    const threadId = selectedThread.thread_id || selectedThread.id;
    const teamId = selectedThread.team_id || selectedThread._teamId;

    const result = await classificarManual(
      teamId, threadId,
      { categoria: manualCategoria, sentimento: manualSentimento, resumo: manualResumo }
    );

    if (result.success) {
      setSelectedThread(prev => ({
        ...prev,
        categoria: manualCategoria,
        sentimento: manualSentimento,
        resumo_ia: manualResumo || null,
        classificado_por: 'manual'
      }));

      const currentThreadId = selectedThread.thread_id || selectedThread.id;
      setThreads(prev => prev.map(t =>
        (t.thread_id || t.id) === currentThreadId
          ? { ...t, categoria: manualCategoria, sentimento: manualSentimento, resumo_ia: manualResumo || null, classificado_por: 'manual' }
          : t
      ));

      setShowManualClassification(false);
      setManualCategoria('');
      setManualSentimento('');
      setManualResumo('');
    }
  };

  // Fetch all teams for move
  const fetchAllTeams = async () => {
    if (allTeams.length > 0) return;
    setLoadingTeams(true);
    try {
      const teamsRef = collection(db, 'clientes');
      const q = query(teamsRef, where('status', 'in', ['ativo', 'aviso_previo']));
      const snap = await getDocs(q);
      const teams = snap.docs.map(d => ({
        id: d.id,
        team_name: d.data().team_name || d.data().nome || 'Sem nome',
        team_type: d.data().team_type || '',
        times: d.data().times || [d.id]
      })).sort((a, b) => a.team_name.localeCompare(b.team_name));
      setAllTeams(teams);
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
    }
    setLoadingTeams(false);
  };

  // Move thread
  const handleMoveThread = async () => {
    if (!selectedThread || !selectedNewTeam) return;

    const newTeam = allTeams.find(t => t.id === selectedNewTeam);
    if (!newTeam) return;

    setMovingThread(true);
    try {
      const threadId = selectedThread.thread_id || selectedThread.id;
      const threadDocId = selectedThread.id;
      const newTeamId = newTeam.times?.[0] || newTeam.id;

      const threadRef = doc(db, 'threads', threadDocId);
      await updateDoc(threadRef, {
        team_id: newTeamId,
        cliente_id: newTeam.id,
        team_name: newTeam.team_name,
        team_type: newTeam.team_type,
        updated_at: Timestamp.now()
      });

      const mensagensRef = collection(db, 'mensagens');
      const mensagensQuery = query(mensagensRef, where('thread_id', '==', threadId));
      const mensagensSnap = await getDocs(mensagensQuery);

      const updatePromises = mensagensSnap.docs.map(msgDoc =>
        updateDoc(doc(db, 'mensagens', msgDoc.id), {
          team_id: newTeamId,
          updated_at: Timestamp.now()
        })
      );
      await Promise.all(updatePromises);

      setThreads(prev => prev.filter(t => t.id !== threadDocId));
      setShowMoveThread(false);
      setSelectedThread(null);
      setSelectedNewTeam('');

      alert(`Thread movida para "${newTeam.team_name}" com sucesso!`);
    } catch (error) {
      console.error('Erro ao mover thread:', error);
      alert('Erro ao mover thread. Tente novamente.');
    }
    setMovingThread(false);
  };

  if (!selectedThread) return null;

  return (
    <>
      {/* Thread Detail Modal */}
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '32px' }}>
        <div style={{ background: '#1a1033', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '20px', width: '100%', maxWidth: '800px', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: '0 0 8px 0' }}>{selectedThread.assunto || 'Sem assunto'}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ padding: '4px 10px', background: `${getStatusColor(selectedThread.status)}20`, color: getStatusColor(selectedThread.status), borderRadius: '6px', fontSize: '12px', fontWeight: '500' }}>{getStatusLabel(selectedThread.status)}</span>
                {selectedThread.categoria && (
                  <span style={{ padding: '4px 10px', background: `${getCategoryColor(selectedThread.categoria)}20`, color: getCategoryColor(selectedThread.categoria), borderRadius: '6px', fontSize: '11px', fontWeight: '500' }}>{getCategoryLabel(selectedThread.categoria)}</span>
                )}
                {selectedThread.sentimento && (
                  <span style={{ padding: '4px 10px', background: `${getSentimentColor(selectedThread.sentimento)}20`, color: getSentimentColor(selectedThread.sentimento), borderRadius: '6px', fontSize: '11px' }}>{getSentimentoInfo(selectedThread.sentimento).emoji} {getSentimentoInfo(selectedThread.sentimento).label}</span>
                )}
                {selectedThread.classificado_por && (
                  <span style={{ padding: '4px 8px', background: 'rgba(100, 116, 139, 0.2)', color: '#94a3b8', borderRadius: '6px', fontSize: '10px' }}>
                    Classificado por {selectedThread.classificado_por === 'ia' ? 'IA' : 'manual'}
                  </span>
                )}
              </div>
            </div>
            <button onClick={() => { setSelectedThread(null); setShowManualClassification(false); }} style={{ width: '36px', height: '36px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X style={{ width: '18px', height: '18px', color: '#ef4444' }} />
            </button>
          </div>

          {/* Classificacao por IA */}
          <div style={{ padding: '16px 24px', background: 'rgba(139, 92, 246, 0.05)', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>
            {selectedThread.resumo_ia && (
              <div style={{ marginBottom: '12px', padding: '12px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '8px' }}>
                <p style={{ color: '#94a3b8', fontSize: '11px', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Resumo da IA</p>
                <p style={{ color: '#e2e8f0', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>{selectedThread.resumo_ia}</p>
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {isOpenAIConfigured() && (
                <button
                  onClick={handleClassificarThread}
                  disabled={classificando}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
                    background: classificando ? 'rgba(139, 92, 246, 0.3)' : 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                    border: 'none', borderRadius: '8px', color: 'white', fontSize: '12px', fontWeight: '500',
                    cursor: classificando ? 'not-allowed' : 'pointer', opacity: 1
                  }}
                >
                  <Bot style={{ width: '14px', height: '14px', animation: classificando ? 'spin 1s linear infinite' : 'none' }} />
                  {classificando ? 'Classificando...' : selectedThread.categoria ? 'Reclassificar com IA' : 'Classificar com IA'}
                </button>
              )}
              <button
                onClick={() => {
                  setShowManualClassification(!showManualClassification);
                  if (selectedThread.categoria) {
                    setManualCategoria(selectedThread.categoria);
                    setManualSentimento(selectedThread.sentimento);
                    setManualResumo(selectedThread.resumo_ia || '');
                  }
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'rgba(100, 116, 139, 0.2)', border: '1px solid rgba(100, 116, 139, 0.3)', borderRadius: '8px', color: '#94a3b8', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}
              >
                <Pencil style={{ width: '14px', height: '14px' }} />
                {showManualClassification ? 'Cancelar' : 'Classificar Manualmente'}
              </button>
              <button
                onClick={() => { setShowMoveThread(true); fetchAllTeams(); }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.3)', borderRadius: '8px', color: '#f97316', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}
              >
                <ArrowLeft style={{ width: '14px', height: '14px', transform: 'rotate(180deg)' }} />
                Mover Cliente
              </button>
              <button
                onClick={() => {
                  handleMarcarIrrelevante(selectedThread);
                  setSelectedThread(prev => prev ? { ...prev, filtrado_manual: !prev.filtrado_manual } : null);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
                  background: selectedThread?.filtrado_manual ? 'rgba(16, 185, 129, 0.1)' : 'rgba(100, 116, 139, 0.1)',
                  border: `1px solid ${selectedThread?.filtrado_manual ? 'rgba(16, 185, 129, 0.3)' : 'rgba(100, 116, 139, 0.3)'}`,
                  borderRadius: '8px',
                  color: selectedThread?.filtrado_manual ? '#10b981' : '#94a3b8',
                  fontSize: '12px', fontWeight: '500', cursor: 'pointer'
                }}
              >
                {selectedThread?.filtrado_manual ? (
                  <><Eye style={{ width: '14px', height: '14px' }} /> Marcar Relevante</>
                ) : (
                  <><EyeOff style={{ width: '14px', height: '14px' }} /> Irrelevante</>
                )}
              </button>
            </div>

            {erroClassificacao && (
              <p style={{ color: '#ef4444', fontSize: '12px', margin: '8px 0 0 0' }}>Erro: {erroClassificacao}</p>
            )}

            {!isOpenAIConfigured() && (
              <p style={{ color: '#f59e0b', fontSize: '12px', margin: '8px 0 0 0' }}>
                Classificação por IA indisponível no momento.
              </p>
            )}

            {/* Formulario de classificacao manual */}
            {showManualClassification && (
              <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.1)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '11px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Categoria</label>
                    <select
                      value={manualCategoria}
                      onChange={(e) => setManualCategoria(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', background: '#0f0a1f', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '8px', color: 'white', fontSize: '13px', outline: 'none' }}
                    >
                      <option value="">Selecione...</option>
                      {Object.values(THREAD_CATEGORIAS).map(cat => (
                        <option key={cat.value} value={cat.value} style={{ background: '#1e1b4b' }}>{cat.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '11px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sentimento</label>
                    <select
                      value={manualSentimento}
                      onChange={(e) => setManualSentimento(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', background: '#0f0a1f', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '8px', color: 'white', fontSize: '13px', outline: 'none' }}
                    >
                      <option value="">Selecione...</option>
                      {Object.values(THREAD_SENTIMENTOS).map(sent => (
                        <option key={sent.value} value={sent.value} style={{ background: '#1e1b4b' }}>{sent.emoji} {sent.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: '11px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Resumo (opcional)</label>
                  <textarea
                    value={manualResumo}
                    onChange={(e) => setManualResumo(e.target.value)}
                    placeholder="Descreva brevemente a conversa..."
                    rows={2}
                    style={{ width: '100%', padding: '10px 12px', background: '#0f0a1f', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '8px', color: 'white', fontSize: '13px', outline: 'none', resize: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <button
                  onClick={handleClassificarManual}
                  disabled={!manualCategoria || !manualSentimento || classificando}
                  style={{
                    padding: '10px 20px',
                    background: (!manualCategoria || !manualSentimento) ? 'rgba(139, 92, 246, 0.3)' : 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                    border: 'none', borderRadius: '8px', color: 'white', fontSize: '13px', fontWeight: '500',
                    cursor: (!manualCategoria || !manualSentimento) ? 'not-allowed' : 'pointer'
                  }}
                >
                  Salvar Classificação
                </button>
              </div>
            )}
          </div>

          {/* Card de Observacoes ativas do CS */}
          {observacoes.filter(o => o.status === 'ativa').length > 0 && (
            <div style={{ padding: '12px 24px', background: 'rgba(16, 185, 129, 0.05)', borderBottom: '1px solid rgba(16, 185, 129, 0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ClipboardList style={{ width: '14px', height: '14px', color: '#10b981' }} />
                  <span style={{ color: '#10b981', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Observações do CS</span>
                </div>
                <button
                  onClick={() => { setSelectedThread(null); setShowManualClassification(false); setActiveTab('interacoes'); }}
                  style={{ background: 'none', border: 'none', color: '#10b981', fontSize: '11px', fontWeight: '500', cursor: 'pointer', padding: 0 }}
                >
                  Ver todas {'\u2192'}
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {observacoes.filter(o => o.status === 'ativa').slice(0, 3).map(obs => (
                  <div key={obs.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ color: '#64748b', fontSize: '11px', flexShrink: 0, marginTop: '2px' }}>
                      {obs.criado_em?.toDate ? obs.criado_em.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '-'}
                    </span>
                    <p style={{
                      color: '#cbd5e1', fontSize: '12px', margin: 0, lineHeight: 1.4,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '600px'
                    }}>
                      {obs.texto}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
            {mensagens.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {mensagens.map((msg) => (
                  <div key={msg.id} style={{ padding: '16px', background: msg.tipo_remetente === 'equipe' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(15, 10, 31, 0.6)', border: `1px solid ${msg.tipo_remetente === 'equipe' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(100, 116, 139, 0.2)'}`, borderRadius: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '28px', height: '28px', background: msg.tipo_remetente === 'equipe' ? 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)' : 'linear-gradient(135deg, #64748b 0%, #475569 100%)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '12px', fontWeight: '600' }}>{msg.remetente_nome?.charAt(0) || 'U'}</div>
                        <span style={{ color: 'white', fontSize: '14px', fontWeight: '500' }}>{msg.remetente_nome || msg.remetente_email}</span>
                        <span style={{ padding: '2px 6px', background: msg.tipo_remetente === 'equipe' ? 'rgba(139, 92, 246, 0.3)' : 'rgba(100, 116, 139, 0.3)', color: msg.tipo_remetente === 'equipe' ? '#a5b4fc' : '#94a3b8', borderRadius: '4px', fontSize: '10px' }}>{msg.tipo_remetente === 'equipe' ? 'Equipe' : 'Cliente'}</span>
                      </div>
                      <span style={{ color: '#64748b', fontSize: '12px' }}>{formatDate(msg.data)}</span>
                    </div>
                    <p style={{ color: '#e2e8f0', fontSize: '14px', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{cleanMessageContent(msg.body || msg.corpo_limpo || msg.corpo || msg.content || msg.snippet)}</p>
                  </div>
                ))}
              </div>
            ) : loadingMensagens ? (
              <div style={{ padding: '32px', textAlign: 'center' }}>
                <Loader2 style={{ width: '24px', height: '24px', color: '#8b5cf6', margin: '0 auto 12px', animation: 'spin 1s linear infinite' }} />
                <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Carregando mensagens...</p>
              </div>
            ) : (selectedThread?.conversa_para_resumo || selectedThread?.snippet) ? (
              <div style={{ padding: '16px' }}>
                <p style={{ color: '#f59e0b', fontSize: '12px', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle style={{ width: '14px', height: '14px' }} />
                  Mensagens detalhadas não disponíveis - exibindo resumo da conversa
                </p>
                <div style={{ background: 'rgba(15, 10, 31, 0.6)', border: '1px solid rgba(139, 92, 246, 0.1)', borderRadius: '12px', padding: '16px' }}>
                  <p style={{ color: '#e2e8f0', fontSize: '14px', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {selectedThread.conversa_para_resumo || selectedThread.snippet}
                  </p>
                </div>
              </div>
            ) : (
              <div style={{ padding: '32px', textAlign: 'center' }}>
                <Mail style={{ width: '32px', height: '32px', color: '#64748b', margin: '0 auto 12px' }} />
                <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 8px 0' }}>Nenhuma mensagem encontrada</p>
                <p style={{ color: '#475569', fontSize: '12px', margin: 0 }}>
                  thread_id: {selectedThread?.thread_id || selectedThread?.id || 'N/A'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Mover Thread para outro Cliente */}
      {showMoveThread && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '32px' }}>
          <div style={{ background: '#1a1033', border: '1px solid rgba(249, 115, 22, 0.3)', borderRadius: '16px', width: '100%', maxWidth: '480px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', background: 'rgba(249, 115, 22, 0.15)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ArrowLeft style={{ width: '18px', height: '18px', color: '#f97316', transform: 'rotate(180deg)' }} />
                </div>
                <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: 0 }}>Mover para outro Cliente</h3>
              </div>
              <button onClick={() => { setShowMoveThread(false); setSelectedNewTeam(''); setSearchTeam(''); }} style={{ width: '32px', height: '32px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X style={{ width: '16px', height: '16px', color: '#ef4444' }} />
              </button>
            </div>

            <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '16px' }}>
              Thread: <strong style={{ color: 'white' }}>{selectedThread?.assunto || 'Sem assunto'}</strong>
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '12px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Buscar cliente</label>
              {loadingTeams ? (
                <div style={{ padding: '12px', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '10px', textAlign: 'center' }}>
                  <Loader2 style={{ width: '20px', height: '20px', color: '#8b5cf6', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
                  <p style={{ color: '#64748b', fontSize: '12px', margin: '8px 0 0 0' }}>Carregando clientes...</p>
                </div>
              ) : (
                <>
                  <div style={{ position: 'relative', marginBottom: '12px' }}>
                    <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#64748b' }} />
                    <input
                      type="text"
                      value={searchTeam}
                      onChange={(e) => setSearchTeam(e.target.value)}
                      placeholder="Digite o nome do cliente..."
                      style={{ width: '100%', padding: '12px 14px 12px 40px', background: '#0f0a1f', border: '1px solid rgba(249, 115, 22, 0.3)', borderRadius: '10px', color: 'white', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ maxHeight: '200px', overflowY: 'auto', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '10px', border: '1px solid rgba(139, 92, 246, 0.15)' }}>
                    {allTeams
                      .filter(t => t.id !== cliente?.id)
                      .filter(t => !searchTeam || t.team_name.toLowerCase().includes(searchTeam.toLowerCase()))
                      .map(team => (
                        <div
                          key={team.id}
                          onClick={() => setSelectedNewTeam(team.id)}
                          style={{
                            padding: '12px 14px', cursor: 'pointer',
                            borderBottom: '1px solid rgba(139, 92, 246, 0.1)',
                            background: selectedNewTeam === team.id ? 'rgba(249, 115, 22, 0.15)' : 'transparent',
                            transition: 'background 0.15s ease'
                          }}
                        >
                          <p style={{ color: selectedNewTeam === team.id ? '#f97316' : 'white', fontSize: '14px', fontWeight: '500', margin: 0 }}>
                            {team.team_name}
                          </p>
                          {team.team_type && (
                            <p style={{ color: '#64748b', fontSize: '11px', margin: '2px 0 0 0' }}>{team.team_type}</p>
                          )}
                        </div>
                      ))
                    }
                    {allTeams.filter(t => t.id !== cliente?.id).filter(t => !searchTeam || t.team_name.toLowerCase().includes(searchTeam.toLowerCase())).length === 0 && (
                      <p style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
                        {searchTeam ? 'Nenhum cliente encontrado' : 'Nenhum cliente disponível'}
                      </p>
                    )}
                  </div>
                  {selectedNewTeam && (
                    <p style={{ color: '#10b981', fontSize: '12px', marginTop: '8px' }}>
                      Selecionado: <strong>{allTeams.find(t => t.id === selectedNewTeam)?.team_name}</strong>
                    </p>
                  )}
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowMoveThread(false); setSelectedNewTeam(''); setSearchTeam(''); }}
                style={{ padding: '10px 18px', background: 'transparent', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '10px', color: '#94a3b8', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleMoveThread}
                disabled={!selectedNewTeam || movingThread}
                style={{
                  padding: '10px 18px',
                  background: !selectedNewTeam ? 'rgba(249, 115, 22, 0.3)' : 'linear-gradient(135deg, #f97316 0%, #f59e0b 100%)',
                  border: 'none', borderRadius: '10px', color: 'white', fontSize: '13px', fontWeight: '600',
                  cursor: !selectedNewTeam ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                {movingThread ? (
                  <><Loader2 style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} />Movendo...</>
                ) : (
                  'Mover Thread'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
