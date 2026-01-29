import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { getThreadsByTeam, getMensagensByThread } from '../services/api';
import { ArrowLeft, Building2, Users, Clock, MessageSquare, Mail, AlertTriangle, CheckCircle, ChevronRight, X, TrendingUp, LogIn, FileImage, Download, Sparkles, Pencil, User, ChevronDown, RefreshCw, Activity, Bot, HelpCircle, Bug, Wrench, FileText, MoreHorizontal, Briefcase, Phone, Star } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { useHealthScore } from '../hooks/useHealthScore';
import { getHealthColor, getHealthLabel, getComponenteLabel } from '../utils/healthScore';
import { useClassificarThread } from '../hooks/useClassificarThread';
import { THREAD_CATEGORIAS, THREAD_SENTIMENTOS, getCategoriaInfo, getSentimentoInfo, isOpenAIConfigured } from '../services/openai';
import PlaybooksSection from '../components/Cliente/PlaybooksSection';
import ThreadsTimeline from '../components/Cliente/ThreadsTimeline';
import HeavyUsersCard from '../components/Cliente/HeavyUsersCard';
import { useUserActivityStatus } from '../hooks/useUserActivityStatus';
import { UserActivityDot } from '../components/UserActivityBadge';

// Extrair iniciais do nome (ex: "Marina Barros" → "MB")
const getInitials = (name) => {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

// Decodificar HTML entities e limpar conteúdo de mensagem
const cleanMessageContent = (text) => {
  if (!text) return 'Sem conteúdo';

  // Decodificar HTML entities
  let cleaned = text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");

  // 1. Remover blocos do Microsoft Teams (reuniões)
  const teamsPatterns = [
    /_{3,}[\s\S]*?Reunião do Microsoft Teams[\s\S]*/i,
    /_{3,}[\s\S]*?Microsoft Teams meeting[\s\S]*/i,
    /Reunião do Microsoft Teams[\s\S]*?(Saiba mais|Learn more)[\s\S]*/i,
    /Microsoft Teams meeting[\s\S]*?(Saiba mais|Learn more)[\s\S]*/i,
    /Participe pelo computador[\s\S]*$/i,
    /Join on your computer[\s\S]*$/i,
    /https:\/\/teams\.microsoft\.com\/l\/meetup-join[\s\S]*/i,
    /ID da reunião:[\s\S]*$/i,
    /Meeting ID:[\s\S]*$/i,
  ];

  for (const pattern of teamsPatterns) {
    cleaned = cleaned.replace(pattern, '').trim();
  }

  // 2. Remover citações de mensagens anteriores (quoted replies)
  const quotedPatterns = [
    /On .+wrote:[\s\S]*$/i,                     // "On [date] [person] wrote:"
    /Em .+escreveu:[\s\S]*$/i,                  // "Em [data] [pessoa] escreveu:"
    /^>+.*$/gm,                                 // Linhas começando com >
    /De:.*\nEnviado:.*\nPara:.*\nAssunto:[\s\S]*/i, // Cabeçalho de email citado PT
    /From:.*\nSent:.*\nTo:.*\nSubject:[\s\S]*/i,   // Cabeçalho de email citado EN
    /-----\s*Original Message\s*-----[\s\S]*/i,
    /-----\s*Mensagem Original\s*-----[\s\S]*/i,
    /---------- Forwarded message ---------[\s\S]*/i,
    /---------- Mensagem encaminhada ---------[\s\S]*/i,
  ];

  for (const pattern of quotedPatterns) {
    cleaned = cleaned.replace(pattern, '').trim();
  }

  // 3. Remover separadores visuais no final
  const separatorPatterns = [
    /_{10,}[\s\S]*$/,                           // Linha de underscores
    /-{10,}[\s\S]*$/,                           // Linha de hífens
    /={10,}[\s\S]*$/,                           // Linha de iguais
    /\*{10,}[\s\S]*$/,                          // Linha de asteriscos
  ];

  for (const pattern of separatorPatterns) {
    cleaned = cleaned.replace(pattern, '').trim();
  }

  // 4. Remover padrões de assinatura comuns
  const signaturePatterns = [
    /--\s*\n[\s\S]*$/,                          // -- seguido de qualquer coisa
    /Enviado do meu (iPhone|Android|iPad)[\s\S]*/i,
    /Sent from my (iPhone|Android|iPad)[\s\S]*/i,
    /Enviado pelo Outlook[\s\S]*/i,
    /Sent from Outlook[\s\S]*/i,
    /Get Outlook for [\s\S]*/i,
    /Obter o Outlook para [\s\S]*/i,
    /Atenciosamente,[\s\S]*$/i,
    /Att,[\s\S]*$/i,
    /Abraços?,[\s\S]*$/i,
    /Best regards,[\s\S]*$/i,
    /Kind regards,[\s\S]*$/i,
    /Regards,[\s\S]*$/i,
    /Cordialmente,[\s\S]*$/i,
    /Canal de Ética[\s\S]*$/i,
    /Av\.Industrial[\s\S]*$/i,
    /CEP \d{5}-?\d{3}[\s\S]*$/i,
    /\+55\s*\(?\d{2}\)?\s*\d{4,5}-?\d{4}[\s\S]*$/i, // Telefone BR no final
  ];

  for (const pattern of signaturePatterns) {
    cleaned = cleaned.replace(pattern, '').trim();
  }

  // 5. Limpar espaços extras e linhas em branco múltiplas
  cleaned = cleaned
    .replace(/\n{3,}/g, '\n\n')                // Máximo 2 linhas em branco
    .replace(/[ \t]+$/gm, '')                  // Espaços no final das linhas
    .trim();

  return cleaned || 'Sem conteúdo';
};

export default function ClienteDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cliente, setCliente] = useState(null);
  const [threads, setThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [mensagens, setMensagens] = useState([]);
  const [healthHistory, setHealthHistory] = useState([]);
  const [usageData, setUsageData] = useState({ logins: 0, pecas_criadas: 0, downloads: 0, ai_total: 0 });
  const [usuarios, setUsuarios] = useState([]);
  const [showAllUsuarios, setShowAllUsuarios] = useState(false);
  const [loading, setLoading] = useState(true);
  const [teamIds, setTeamIds] = useState([]);

  // Tab state
  const [activeTab, setActiveTab] = useState('resumo');

  // Health Score hook
  const { healthData, calculating, calcularESalvar } = useHealthScore(id);

  // User Activity Status hook
  const { getStatus: getUserActivityStatus } = useUserActivityStatus(teamIds, usuarios);

  // Classificação de threads
  const { classificar, classificarManual, classificando, erro: erroClassificacao } = useClassificarThread();
  const [showManualClassification, setShowManualClassification] = useState(false);
  const [manualCategoria, setManualCategoria] = useState('');
  const [manualSentimento, setManualSentimento] = useState('');
  const [manualResumo, setManualResumo] = useState('');

  useEffect(() => {
    const fetchCliente = async () => {
      try {
        const docRef = doc(db, 'clientes', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const clienteData = { id: docSnap.id, ...docSnap.data() };
          setCliente(clienteData);

          // Determinar teamIds
          let computedTeamIds = clienteData.times || [];
          if (computedTeamIds.length === 0 && clienteData.team_id) {
            computedTeamIds = [clienteData.team_id];
          }
          if (computedTeamIds.length === 0 && clienteData.id) {
            computedTeamIds = [clienteData.id];
          }

          // Salvar teamIds no state para uso pelo hook de atividade
          setTeamIds(computedTeamIds);

          // Data limite para queries
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

          // OTIMIZAÇÃO: Executar TODAS as queries em PARALELO
          const [threadsResult, healthResult, metricasResult, usuariosResult] = await Promise.all([
            // 1. Threads
            computedTeamIds.length > 0 ? getThreadsByTeam(computedTeamIds).catch(() => []) : Promise.resolve([]),

            // 2. Health History
            getDocs(query(
              collection(db, 'clientes', id, 'health_history'),
              orderBy('hist_date', 'desc'),
              limit(30)
            )).catch(() => ({ docs: [] })),

            // 3. Métricas de uso (com chunks para computedTeamIds > 10)
            computedTeamIds.length > 0 ? (async () => {
              const metricasRef = collection(db, 'metricas_diarias');
              const chunkSize = 10;
              const promises = [];
              for (let i = 0; i < computedTeamIds.length; i += chunkSize) {
                const chunk = computedTeamIds.slice(i, i + chunkSize);
                promises.push(
                  getDocs(query(metricasRef, where('team_id', 'in', chunk), where('data', '>=', thirtyDaysAgo)))
                );
              }
              const results = await Promise.all(promises);
              return results.flatMap(snap => snap.docs.map(doc => doc.data()));
            })().catch(() => []) : Promise.resolve([]),

            // 4. Usuários (com chunks para computedTeamIds > 10)
            computedTeamIds.length > 0 ? (async () => {
              const usuariosRef = collection(db, 'usuarios_lookup');
              const chunkSize = 10;
              const promises = [];
              for (let i = 0; i < computedTeamIds.length; i += chunkSize) {
                const chunk = computedTeamIds.slice(i, i + chunkSize);
                promises.push(
                  getDocs(query(usuariosRef, where('team_id', 'in', chunk)))
                );
              }
              const results = await Promise.all(promises);
              return results.flatMap(snap => snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            })().catch(() => []) : Promise.resolve([])
          ]);

          // Processar threads
          const sortedThreads = threadsResult.sort((a, b) => {
            const dateA = a.updated_at?.toDate?.() || (a.updated_at ? new Date(a.updated_at) : new Date(0));
            const dateB = b.updated_at?.toDate?.() || (b.updated_at ? new Date(b.updated_at) : new Date(0));
            return dateB - dateA;
          });
          setThreads(sortedThreads);

          // Processar health history
          const healthData = healthResult.docs.map(doc => {
            const data = doc.data();
            const date = data.hist_date?.toDate?.() || new Date(data.hist_date);
            return {
              id: doc.id,
              date: date,
              dateFormatted: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
              score: data.hist_score || 0,
              status: data.hist_status,
              componentes: data.hist_componentes
            };
          });
          setHealthHistory(healthData.sort((a, b) => a.date - b.date));

          // Processar métricas de uso
          const aggregated = metricasResult.reduce((acc, d) => ({
            logins: acc.logins + (d.logins || 0),
            pecas_criadas: acc.pecas_criadas + (d.pecas_criadas || 0),
            downloads: acc.downloads + (d.downloads || 0),
            ai_total: acc.ai_total + (d.uso_ai_total || 0)
          }), { logins: 0, pecas_criadas: 0, downloads: 0, ai_total: 0 });
          setUsageData(aggregated);

          // Processar usuários
          const sortedUsers = usuariosResult.sort((a, b) => {
            const nameA = (a.nome || a.name || '').toLowerCase();
            const nameB = (b.nome || b.name || '').toLowerCase();
            return nameA.localeCompare(nameB);
          });
          setUsuarios(sortedUsers);
        }
      } catch (error) {
        console.error('Erro ao buscar cliente:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchCliente();
  }, [id]);

  const fetchMensagens = async (thread) => {
    try {
      // Usar nova função que busca da collection raiz 'mensagens'
      const threadId = thread.thread_id || thread.id;
      const mensagensData = await getMensagensByThread(threadId);
      setMensagens(mensagensData.sort((a, b) => {
        const dateA = a.data?.toDate?.() || (a.data ? new Date(a.data) : new Date(0));
        const dateB = b.data?.toDate?.() || (b.data ? new Date(b.data) : new Date(0));
        return dateA - dateB;
      }));
    } catch (error) {
      console.error('Erro ao buscar mensagens:', error);
      setMensagens([]);
    }
  };

  const handleThreadClick = (thread) => {
    setSelectedThread(thread);
    fetchMensagens(thread);
  };

  const getSentimentColor = (sentiment) => {
    return getSentimentoInfo(sentiment).color;
  };

  const getCategoryLabel = (cat) => {
    return getCategoriaInfo(cat).label;
  };

  const getCategoryColor = (cat) => {
    return getCategoriaInfo(cat).color;
  };

  // Função para classificar thread com IA
  const handleClassificarThread = async () => {
    if (!selectedThread) return;

    // Formatar conversa para enviar à IA
    let conversaTexto = '';

    if (mensagens.length > 0) {
      conversaTexto = mensagens.map(msg =>
        `[${msg.tipo_remetente === 'equipe' ? 'Equipe' : 'Cliente'} - ${msg.remetente_nome || 'Anônimo'}]: ${msg.snippet || ''}`
      ).join('\n');
    } else {
      // Se não houver mensagens, usar o assunto/snippet da thread
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

    // Usar thread_id (do n8n) ou id (fallback) para a nova arquitetura
    const threadId = selectedThread.thread_id || selectedThread.id;
    const teamId = selectedThread.team_id || selectedThread._teamId;

    const result = await classificar(
      teamId,
      threadId,
      conversaTexto,
      threadData
    );

    if (result.success) {
      // Atualizar a thread selecionada com os novos dados
      setSelectedThread(prev => ({
        ...prev,
        categoria: result.resultado.categoria,
        sentimento: result.resultado.sentimento,
        resumo_ia: result.resultado.resumo,
        classificado_por: 'ia'
      }));

      // Atualizar na lista de threads (comparar por thread_id ou id)
      const currentThreadId = selectedThread.thread_id || selectedThread.id;
      setThreads(prev => prev.map(t =>
        (t.thread_id || t.id) === currentThreadId
          ? { ...t, categoria: result.resultado.categoria, sentimento: result.resultado.sentimento, resumo_ia: result.resultado.resumo, classificado_por: 'ia' }
          : t
      ));
    }
  };

  // Função para classificar manualmente
  const handleClassificarManual = async () => {
    if (!selectedThread || !manualCategoria || !manualSentimento) return;

    // Usar thread_id (do n8n) ou id (fallback) para a nova arquitetura
    const threadId = selectedThread.thread_id || selectedThread.id;
    const teamId = selectedThread.team_id || selectedThread._teamId;

    const result = await classificarManual(
      teamId,
      threadId,
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

      // Atualizar na lista de threads (comparar por thread_id ou id)
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

  const formatSimpleDate = (timestamp) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : (timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp));
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getUserStatusColor = (user) => {
    if (user.deleted_at) return '#ef4444';
    if (user.status === 'ativo' || user.status === 'active') return '#10b981';
    if (user.status === 'inativo' || user.status === 'inactive') return '#64748b';
    return '#10b981'; // Default to active
  };

  const getUserStatusLabel = (user) => {
    if (user.deleted_at) return 'Excluído';
    if (user.status === 'ativo' || user.status === 'active') return 'Ativo';
    if (user.status === 'inativo' || user.status === 'inactive') return 'Inativo';
    return 'Ativo';
  };

  const getTeamNameById = (teamId) => {
    // Try to find from cliente.times_info if available, otherwise show teamId
    const timesInfo = cliente?.times_info || {};
    return timesInfo[teamId] || teamId;
  };

  const displayedUsuarios = showAllUsuarios ? usuarios : usuarios.slice(0, 20);

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
            {cliente.status !== 'inativo' ? (
              <span style={{ padding: '8px 16px', background: `${getHealthColor(cliente.health_status)}20`, color: getHealthColor(cliente.health_status), borderRadius: '12px', fontSize: '14px', fontWeight: '600', border: `1px solid ${getHealthColor(cliente.health_status)}40` }}>
                {getHealthLabel(cliente.health_status)}
              </span>
            ) : (
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
        border: '1px solid rgba(139, 92, 246, 0.15)'
      }}>
        {[
          { id: 'resumo', label: 'Resumo', icon: Activity },
          { id: 'conversas', label: 'Conversas', icon: MessageSquare, count: threads.length },
          { id: 'playbook', label: 'Playbooks', icon: FileText },
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
                gap: '8px',
                padding: '12px 20px',
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

      {/* Tab Content: Resumo */}
      {activeTab === 'resumo' && (
        <>
      {/* Aviso de Cliente Inativo */}
      {cliente.status === 'inativo' && (
        <div style={{
          background: 'rgba(107, 114, 128, 0.15)',
          border: '1px solid rgba(107, 114, 128, 0.3)',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '32px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            background: 'rgba(107, 114, 128, 0.2)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <AlertTriangle style={{ width: '24px', height: '24px', color: '#9ca3af' }} />
          </div>
          <div>
            <h3 style={{ color: '#9ca3af', fontSize: '16px', fontWeight: '600', margin: '0 0 4px 0' }}>Cliente Inativo</h3>
            <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>
              As métricas e o Health Score estão pausados enquanto o cliente permanece inativo. Os dados históricos foram preservados.
            </p>
          </div>
        </div>
      )}

      {/* Health Score Section - Somente para clientes ativos */}
      {cliente.status !== 'inativo' && (
      <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '20px', padding: '24px', marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Activity style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
            <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>Health Score</h2>
          </div>
          <button
            onClick={calcularESalvar}
            disabled={calculating}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              background: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '10px',
              color: '#a78bfa',
              fontSize: '13px',
              fontWeight: '500',
              cursor: calculating ? 'wait' : 'pointer',
              opacity: calculating ? 0.7 : 1
            }}
          >
            <RefreshCw style={{ width: '14px', height: '14px', animation: calculating ? 'spin 1s linear infinite' : 'none' }} />
            {calculating ? 'Calculando...' : 'Recalcular'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
          {/* Score Principal */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', background: `linear-gradient(135deg, ${getHealthColor(cliente.health_status)}15 0%, rgba(30, 27, 75, 0.6) 100%)`, border: `1px solid ${getHealthColor(cliente.health_status)}30`, borderRadius: '16px' }}>
            <span style={{ color: getHealthColor(cliente.health_status), fontSize: '56px', fontWeight: '700', lineHeight: 1 }}>{cliente.health_score || 0}</span>
            <span style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>de 100</span>
            <span style={{ padding: '6px 16px', background: `${getHealthColor(cliente.health_status)}20`, color: getHealthColor(cliente.health_status), borderRadius: '20px', fontSize: '13px', fontWeight: '600', marginTop: '12px' }}>
              {getHealthLabel(cliente.health_status)}
            </span>
          </div>

          {/* Componentes do Score */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {healthData?.componentes ? (
              <>
                {Object.entries(healthData.componentes).filter(([key, value]) => value !== null).map(([key, value]) => (
                  <div key={key} style={{ padding: '16px', background: 'rgba(15, 10, 31, 0.6)', border: '1px solid rgba(139, 92, 246, 0.1)', borderRadius: '12px' }}>
                    <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0 0 8px 0' }}>{getComponenteLabel(key)}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${value}%`, height: '100%', background: value >= 70 ? '#10b981' : value >= 40 ? '#f59e0b' : '#ef4444', borderRadius: '3px', transition: 'width 0.3s ease' }}></div>
                      </div>
                      <span style={{ color: 'white', fontSize: '14px', fontWeight: '600', minWidth: '36px' }}>{value}%</span>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div style={{ gridColumn: '1 / -1', padding: '32px', textAlign: 'center' }}>
                <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Clique em "Recalcular" para ver os componentes do score</p>
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Stats Cards - Somente para clientes ativos */}
      {cliente.status !== 'inativo' && (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
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
      )}

      {/* Métricas de Uso da Plataforma - Somente para clientes ativos */}
      {cliente.status !== 'inativo' && (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '32px' }}>
        <div style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LogIn style={{ width: '22px', height: '22px', color: 'white' }} />
            </div>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Logins (30d)</p>
              <p style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{usageData.logins.toLocaleString('pt-BR')}</p>
            </div>
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)', border: '1px solid rgba(6, 182, 212, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileImage style={{ width: '22px', height: '22px', color: 'white' }} />
            </div>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Peças Criadas (30d)</p>
              <p style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{usageData.pecas_criadas.toLocaleString('pt-BR')}</p>
            </div>
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Download style={{ width: '22px', height: '22px', color: 'white' }} />
            </div>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Downloads (30d)</p>
              <p style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{usageData.downloads.toLocaleString('pt-BR')}</p>
            </div>
          </div>
        </div>

        <div style={{ background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)', border: '1px solid rgba(249, 115, 22, 0.2)', borderRadius: '16px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '44px', height: '44px', background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles style={{ width: '22px', height: '22px', color: 'white' }} />
            </div>
            <div>
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Uso AI (30d)</p>
              <p style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>{usageData.ai_total.toLocaleString('pt-BR')}</p>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Heavy Users */}
      {cliente.status !== 'inativo' && (
      <div style={{ marginBottom: '32px' }}>
        <HeavyUsersCard
          teamIds={cliente.times || (cliente.team_id ? [cliente.team_id] : [cliente.id])}
          days={30}
          topN={5}
        />
      </div>
      )}
        </>
      )}

      {/* Tab Content: Playbooks */}
      {activeTab === 'playbook' && (
        <PlaybooksSection clienteId={id} />
      )}

      {/* Tab Content: Pessoas */}
      {activeTab === 'pessoas' && (
      <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '20px', padding: '24px', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <User style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
            <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>Usuários</h2>
            <span style={{ padding: '4px 12px', background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa', borderRadius: '20px', fontSize: '13px', fontWeight: '500' }}>
              {usuarios.length} {usuarios.length === 1 ? 'usuário' : 'usuários'}
            </span>
          </div>
        </div>

        {usuarios.length > 0 ? (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '12px 16px', color: '#64748b', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>Nome</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', color: '#64748b', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>Email</th>
                    <th style={{ textAlign: 'left', padding: '12px 16px', color: '#64748b', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>Time</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', color: '#64748b', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>Status</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', color: '#64748b', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>Criado em</th>
                    <th style={{ textAlign: 'center', padding: '12px 16px', color: '#64748b', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>Excluído em</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedUsuarios.map((user, index) => (
                    <tr key={user.id || index} style={{ borderBottom: '1px solid rgba(139, 92, 246, 0.05)' }}>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            background: user.deleted_at ? 'rgba(100, 116, 139, 0.3)' : 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '11px',
                            fontWeight: '600'
                          }}>
                            {getInitials(user.nome || user.name)}
                          </div>
                          <span style={{ display: 'flex', alignItems: 'center', color: user.deleted_at ? '#64748b' : 'white', fontSize: '14px', fontWeight: '500' }}>
                            {user.nome || user.name || '-'}
                            {!user.deleted_at && <UserActivityDot status={getUserActivityStatus(user.email)} />}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', color: user.deleted_at ? '#64748b' : '#94a3b8', fontSize: '13px' }}>
                        {user.email || '-'}
                      </td>
                      <td style={{ padding: '14px 16px', color: '#94a3b8', fontSize: '13px' }}>
                        {user.team_name || getTeamNameById(user.team_id)}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <span style={{
                          padding: '4px 10px',
                          background: `${getUserStatusColor(user)}20`,
                          color: getUserStatusColor(user),
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '500'
                        }}>
                          {getUserStatusLabel(user)}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '13px', textAlign: 'center' }}>
                        {formatSimpleDate(user.created_at)}
                      </td>
                      <td style={{ padding: '14px 16px', color: user.deleted_at ? '#ef4444' : '#64748b', fontSize: '13px', textAlign: 'center' }}>
                        {user.deleted_at ? formatSimpleDate(user.deleted_at) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {usuarios.length > 20 && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
                <button
                  onClick={() => setShowAllUsuarios(!showAllUsuarios)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                    background: 'rgba(139, 92, 246, 0.1)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '12px',
                    color: '#a78bfa',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  {showAllUsuarios ? 'Mostrar menos' : `Ver todos (${usuarios.length})`}
                  <ChevronDown style={{
                    width: '16px',
                    height: '16px',
                    transform: showAllUsuarios ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease'
                  }} />
                </button>
              </div>
            )}
          </>
        ) : (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <User style={{ width: '48px', height: '48px', color: '#64748b', margin: '0 auto 16px' }} />
            <p style={{ color: '#94a3b8', fontSize: '16px', margin: '0 0 8px 0' }}>Nenhum usuário encontrado</p>
            <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Os usuários dos times vinculados aparecerão aqui</p>
          </div>
        )}
      </div>
      )}

      {/* Stakeholders Section - dentro da aba Pessoas */}
      {activeTab === 'pessoas' && cliente?.stakeholders && cliente.stakeholders.length > 0 && (
      <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(249, 115, 22, 0.2)', borderRadius: '20px', padding: '24px', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Star style={{ width: '20px', height: '20px', color: '#f97316' }} />
            <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>Stakeholders</h2>
            <span style={{ padding: '4px 12px', background: 'rgba(249, 115, 22, 0.2)', color: '#fb923c', borderRadius: '20px', fontSize: '13px', fontWeight: '500' }}>
              {cliente.stakeholders.length} {cliente.stakeholders.length === 1 ? 'pessoa' : 'pessoas'}
            </span>
          </div>
          <span style={{ padding: '4px 10px', background: 'rgba(249, 115, 22, 0.1)', color: '#f97316', borderRadius: '8px', fontSize: '11px' }}>
            Contatos de vendas/contratos
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
          {cliente.stakeholders.map((stakeholder, index) => (
            <div
              key={stakeholder.id || index}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '16px',
                background: 'rgba(15, 10, 31, 0.6)',
                border: '1px solid rgba(249, 115, 22, 0.15)',
                borderRadius: '12px'
              }}
            >
              <div style={{
                width: '40px',
                height: '40px',
                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '14px',
                fontWeight: '600',
                flexShrink: 0
              }}>
                {getInitials(stakeholder.nome)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: '0 0 2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {stakeholder.nome}
                </p>
                {stakeholder.cargo && (
                  <p style={{ color: '#f97316', fontSize: '12px', margin: '0 0 4px 0' }}>
                    {stakeholder.cargo}
                  </p>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <a
                    href={`mailto:${stakeholder.email}`}
                    style={{ color: '#94a3b8', fontSize: '12px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Mail style={{ width: '12px', height: '12px' }} />
                    {stakeholder.email}
                  </a>
                  {stakeholder.telefone && (
                    <a
                      href={`tel:${stakeholder.telefone}`}
                      style={{ color: '#94a3b8', fontSize: '12px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Phone style={{ width: '12px', height: '12px' }} />
                      {stakeholder.telefone}
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* Tab Content: Resumo - Evolução do Health Score - Somente para clientes ativos */}
      {activeTab === 'resumo' && cliente.status !== 'inativo' && (
      <>
      {/* Evolução do Health Score */}
      <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '20px', padding: '24px', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <TrendingUp style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
          <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>Evolução do Health Score</h2>
          <span style={{ color: '#64748b', fontSize: '13px', marginLeft: 'auto' }}>Últimos 30 dias</span>
        </div>
        {healthHistory.length > 0 ? (
          <div style={{ height: '280px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={healthHistory} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#8b5cf6"/>
                    <stop offset="100%" stopColor="#06b6d4"/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(139, 92, 246, 0.1)" vertical={false} />
                <XAxis
                  dataKey="dateFormatted"
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(139, 92, 246, 0.2)' }}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={12}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(139, 92, 246, 0.2)' }}
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(15, 10, 31, 0.95)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '12px',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
                  }}
                  labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                  formatter={(value, name) => [`${value}%`, 'Health Score']}
                  labelFormatter={(label) => `Data: ${label}`}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="url(#lineGradient)"
                  strokeWidth={3}
                  fill="url(#scoreGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <TrendingUp style={{ width: '48px', height: '48px', color: '#64748b', margin: '0 auto 16px' }} />
            <p style={{ color: '#94a3b8', fontSize: '16px', margin: '0 0 8px 0' }}>Nenhum histórico disponível</p>
            <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>O histórico de Health Score será exibido aqui quando houver dados</p>
          </div>
        )}
      </div>
      </>
      )}

      {/* Tab Content: Conversas */}
      {activeTab === 'conversas' && (
      <ThreadsTimeline
        threads={threads}
        onThreadClick={handleThreadClick}
        cliente={cliente}
      />
      )}

      {selectedThread && (
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

            {/* Classificação por IA */}
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
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      background: classificando ? 'rgba(139, 92, 246, 0.3)' : 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                      border: 'none',
                      borderRadius: '8px',
                      color: 'white',
                      fontSize: '12px',
                      fontWeight: '500',
                      cursor: classificando ? 'not-allowed' : 'pointer',
                      opacity: 1
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
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    background: 'rgba(100, 116, 139, 0.2)',
                    border: '1px solid rgba(100, 116, 139, 0.3)',
                    borderRadius: '8px',
                    color: '#94a3b8',
                    fontSize: '12px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  <Pencil style={{ width: '14px', height: '14px' }} />
                  {showManualClassification ? 'Cancelar' : 'Classificar Manualmente'}
                </button>
              </div>

              {erroClassificacao && (
                <p style={{ color: '#ef4444', fontSize: '12px', margin: '8px 0 0 0' }}>Erro: {erroClassificacao}</p>
              )}

              {!isOpenAIConfigured() && (
                <p style={{ color: '#f59e0b', fontSize: '12px', margin: '8px 0 0 0' }}>
                  Configure VITE_OPENAI_API_KEY no .env para usar classificação por IA
                </p>
              )}

              {/* Formulário de classificação manual */}
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
                      border: 'none',
                      borderRadius: '8px',
                      color: 'white',
                      fontSize: '13px',
                      fontWeight: '500',
                      cursor: (!manualCategoria || !manualSentimento) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Salvar Classificação
                  </button>
                </div>
              )}
            </div>

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
