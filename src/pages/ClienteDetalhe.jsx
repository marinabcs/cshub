import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ArrowLeft, Building2, Users, Clock, MessageSquare, Mail, AlertTriangle, CheckCircle, ChevronRight, X } from 'lucide-react';

export default function ClienteDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cliente, setCliente] = useState(null);
  const [threads, setThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [mensagens, setMensagens] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCliente = async () => {
      try {
        const docRef = doc(db, 'clientes', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setCliente({ id: docSnap.id, ...docSnap.data() });
          const threadsRef = collection(db, 'clientes', id, 'threads');
          const threadsSnap = await getDocs(threadsRef);
          const threadsData = threadsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setThreads(threadsData.sort((a, b) => {
            const dateA = a.updated_at?.toDate?.() || new Date(0);
            const dateB = b.updated_at?.toDate?.() || new Date(0);
            return dateB - dateA;
          }));
        }
      } catch (error) {
        console.error('Erro ao buscar cliente:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchCliente();
  }, [id]);

  const fetchMensagens = async (threadId) => {
    try {
      const mensagensRef = collection(db, 'clientes', id, 'threads', threadId, 'mensagens');
      const mensagensSnap = await getDocs(mensagensRef);
      const mensagensData = mensagensSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMensagens(mensagensData.sort((a, b) => {
        const dateA = a.data?.toDate?.() || new Date(0);
        const dateB = b.data?.toDate?.() || new Date(0);
        return dateA - dateB;
      }));
    } catch (error) {
      console.error('Erro ao buscar mensagens:', error);
    }
  };

  const handleThreadClick = (thread) => {
    setSelectedThread(thread);
    fetchMensagens(thread.id);
  };

  const getHealthColor = (status) => {
    const colors = { saudavel: '#10b981', atencao: '#f59e0b', risco: '#f97316', critico: '#ef4444' };
    return colors[status] || '#64748b';
  };

  const getHealthLabel = (status) => {
    const labels = { saudavel: 'Saudável', atencao: 'Atenção', risco: 'Risco', critico: 'Crítico' };
    return labels[status] || status;
  };

  const getSentimentColor = (sentiment) => {
    const colors = { positivo: '#10b981', neutro: '#64748b', negativo: '#f97316', urgente: '#ef4444' };
    return colors[sentiment] || '#64748b';
  };

  const getCategoryLabel = (cat) => {
    const labels = { erro_bug: 'Erro/Bug', problema_tecnico: 'Problema Técnico', feedback: 'Feedback', duvida_pergunta: 'Dúvida', solicitacao: 'Solicitação', outro: 'Outro' };
    return labels[cat] || cat;
  };

  const getStatusColor = (status) => {
    const colors = { ativo: '#8b5cf6', aguardando_cliente: '#f59e0b', aguardando_equipe: '#06b6d4', resolvido: '#10b981', inativo: '#64748b' };
    return colors[status] || '#64748b';
  };

  const getStatusLabel = (status) => {
    const labels = { ativo: 'Ativo', aguardando_cliente: 'Aguardando Cliente', aguardando_equipe: 'Aguardando Equipe', resolvido: 'Resolvido', inativo: 'Inativo' };
    return labels[status] || status;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Sem data';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatRelativeDate = (timestamp) => {
    if (!timestamp) return 'Sem registro';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Hoje';
    if (diff === 1) return 'Ontem';
    return `há ${diff} dias`;
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f0a1f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '48px', height: '48px', border: '3px solid rgba(139, 92, 246, 0.2)', borderTopColor: '#8b5cf6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      </div>
    );
  }

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
    <div style={{ padding: '32px', background: '#0f0a1f', minHeight: '100vh' }}>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users style={{ width: '16px', height: '16px', color: '#64748b' }} />
                  <span style={{ color: '#94a3b8', fontSize: '14px' }}>{cliente.responsavel_nome || 'Sem responsável'}</span>
                </div>
              </div>
            </div>
          </div>
          <span style={{ padding: '8px 16px', background: `${getHealthColor(cliente.health_status)}20`, color: getHealthColor(cliente.health_status), borderRadius: '12px', fontSize: '14px', fontWeight: '600', border: `1px solid ${getHealthColor(cliente.health_status)}40` }}>
            {getHealthLabel(cliente.health_status)}
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '20px' }}>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 8px 0' }}>Health Score</p>
          <span style={{ color: getHealthColor(cliente.health_status), fontSize: '32px', fontWeight: '700' }}>{cliente.health_score || 0}%</span>
          <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', marginTop: '12px', overflow: 'hidden' }}>
            <div style={{ width: `${cliente.health_score || 0}%`, height: '100%', background: getHealthColor(cliente.health_status), borderRadius: '3px' }}></div>
          </div>
        </div>
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '20px' }}>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 8px 0' }}>Total de Conversas</p>
          <span style={{ color: 'white', fontSize: '32px', fontWeight: '700' }}>{threads.length}</span>
        </div>
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '20px' }}>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 8px 0' }}>Conversas Ativas</p>
          <span style={{ color: '#8b5cf6', fontSize: '32px', fontWeight: '700' }}>{threads.filter(t => t.status === 'ativo' || t.status === 'aguardando_cliente' || t.status === 'aguardando_equipe').length}</span>
        </div>
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '20px' }}>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 8px 0' }}>Última Interação</p>
          <span style={{ color: 'white', fontSize: '20px', fontWeight: '600' }}>{formatRelativeDate(cliente.ultima_interacao)}</span>
        </div>
      </div>

      <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '20px', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <MessageSquare style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
          <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>Timeline de Conversas</h2>
        </div>
        {threads.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {threads.map((thread) => (
              <div key={thread.id} onClick={() => handleThreadClick(thread)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'rgba(15, 10, 31, 0.6)', border: '1px solid rgba(139, 92, 246, 0.1)', borderRadius: '12px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1 }}>
                  <div style={{ width: '40px', height: '40px', background: `${getSentimentColor(thread.sentimento)}20`, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Mail style={{ width: '20px', height: '20px', color: getSentimentColor(thread.sentimento) }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <span style={{ color: 'white', fontWeight: '500', fontSize: '14px' }}>{thread.assunto || 'Sem assunto'}</span>
                      <span style={{ padding: '2px 8px', background: `${getStatusColor(thread.status)}20`, color: getStatusColor(thread.status), borderRadius: '6px', fontSize: '11px', fontWeight: '500' }}>{getStatusLabel(thread.status)}</span>
                    </div>
                    <p style={{ color: '#64748b', fontSize: '13px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{thread.resumo_chat || 'Sem resumo'}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: '16px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0 0 4px 0' }}>{thread.total_mensagens || 0} msgs</p>
                    <p style={{ color: '#64748b', fontSize: '11px', margin: 0 }}>{formatRelativeDate(thread.updated_at)}</p>
                  </div>
                  <ChevronRight style={{ width: '18px', height: '18px', color: '#64748b' }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <MessageSquare style={{ width: '48px', height: '48px', color: '#64748b', margin: '0 auto 16px' }} />
            <p style={{ color: '#94a3b8', fontSize: '16px', margin: 0 }}>Nenhuma conversa encontrada</p>
          </div>
        )}
      </div>

      {selectedThread && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '32px' }}>
          <div style={{ background: '#1a1033', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '20px', width: '100%', maxWidth: '700px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: '0 0 8px 0' }}>{selectedThread.assunto || 'Sem assunto'}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ padding: '4px 10px', background: `${getStatusColor(selectedThread.status)}20`, color: getStatusColor(selectedThread.status), borderRadius: '6px', fontSize: '12px', fontWeight: '500' }}>{getStatusLabel(selectedThread.status)}</span>
                  <span style={{ padding: '4px 10px', background: `${getSentimentColor(selectedThread.sentimento)}20`, color: getSentimentColor(selectedThread.sentimento), borderRadius: '6px', fontSize: '12px' }}>{selectedThread.sentimento}</span>
                </div>
              </div>
              <button onClick={() => setSelectedThread(null)} style={{ width: '36px', height: '36px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X style={{ width: '18px', height: '18px', color: '#ef4444' }} />
              </button>
            </div>
            {selectedThread.resumo_chat && (
              <div style={{ padding: '16px 24px', background: 'rgba(139, 92, 246, 0.1)', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>
                <p style={{ color: '#a5b4fc', fontSize: '13px', margin: 0, fontStyle: 'italic' }}>{selectedThread.resumo_chat}</p>
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
                      <p style={{ color: '#e2e8f0', fontSize: '14px', margin: 0, lineHeight: 1.6 }}>{msg.snippet || 'Sem conteúdo'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '32px', textAlign: 'center' }}>
                  <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Carregando mensagens...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
