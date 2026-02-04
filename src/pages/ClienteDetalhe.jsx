import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, query, orderBy, limit, where, addDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { getThreadsByTeam, getMensagensByThread } from '../services/api';
import { ArrowLeft, Building2, Users, Clock, MessageSquare, Mail, AlertTriangle, CheckCircle, ChevronRight, X, LogIn, FileImage, Download, Sparkles, Pencil, User, ChevronDown, Activity, Bot, HelpCircle, Bug, Wrench, FileText, MoreHorizontal, Briefcase, Phone, Star, Eye, EyeOff, Key, FolderOpen, Plus, ExternalLink, Trash2, Link2, ClipboardList, CheckCircle2, RotateCcw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { SEGMENTOS_CS, getSegmentoInfo, getClienteSegmento, calcularSegmentoCS } from '../utils/segmentoCS';
import { SegmentoBadge, SegmentoCard } from '../components/UI/SegmentoBadge';
import { useClassificarThread } from '../hooks/useClassificarThread';
import { THREAD_CATEGORIAS, THREAD_SENTIMENTOS, getCategoriaInfo, getSentimentoInfo, isOpenAIConfigured } from '../services/openai';
import PlaybooksSection from '../components/Cliente/PlaybooksSection';
import ThreadsTimeline from '../components/Cliente/ThreadsTimeline';
import HeavyUsersCard from '../components/Cliente/HeavyUsersCard';
import { useEmailFilters } from '../hooks/useEmailFilters';
import { validateForm } from '../validation';
import { documentoSchema, observacaoSchema } from '../validation/documento';
import { ErrorMessage } from '../components/UI/ErrorMessage';
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
  const [usageData, setUsageData] = useState({ logins: 0, pecas_criadas: 0, downloads: 0, ai_total: 0, dias_ativos: 0, ultima_atividade: null });
  const [usuarios, setUsuarios] = useState([]);
  const [showAllUsuarios, setShowAllUsuarios] = useState(false);
  const [loading, setLoading] = useState(true);
  const [teamIds, setTeamIds] = useState([]);
  const [segmentoCalculado, setSegmentoCalculado] = useState(null);

  // Tab state
  const [activeTab, setActiveTab] = useState('resumo');

  // User Activity Status hook
  const { getStatus: getUserActivityStatus } = useUserActivityStatus(teamIds, usuarios);

  // Classificação de threads
  const { classificar, classificarManual, classificando, erro: erroClassificacao } = useClassificarThread();
  const { filterConfig } = useEmailFilters();
  const [showManualClassification, setShowManualClassification] = useState(false);
  const [showSenhaPadrao, setShowSenhaPadrao] = useState(false);
  const [manualCategoria, setManualCategoria] = useState('');
  const [manualSentimento, setManualSentimento] = useState('');
  const [manualResumo, setManualResumo] = useState('');

  // Documentos do cliente
  const [documentos, setDocumentos] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [showDocForm, setShowDocForm] = useState(false);
  const [docForm, setDocForm] = useState({ titulo: '', descricao: '', url: '' });
  const [savingDoc, setSavingDoc] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  // Observações do CS
  const [observacoes, setObservacoes] = useState([]);
  const [loadingObs, setLoadingObs] = useState(false);
  const [showObsForm, setShowObsForm] = useState(false);
  const [obsTexto, setObsTexto] = useState('');
  const [savingObs, setSavingObs] = useState(false);
  const [mostrarResolvidas, setMostrarResolvidas] = useState(false);

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
          const [threadsResult, metricasResult, usuariosResult] = await Promise.all([
            // 1. Threads
            computedTeamIds.length > 0 ? getThreadsByTeam(computedTeamIds).catch(() => []) : Promise.resolve([]),

            // 2. Métricas de uso (com chunks para computedTeamIds > 10)
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

          // Processar métricas de uso
          const aggregated = metricasResult.reduce((acc, d) => {
            const dataDate = d.data?.toDate?.() || (d.data ? new Date(d.data) : null);
            const temAtividade = (d.logins || 0) > 0 || (d.pecas_criadas || 0) > 0 || (d.downloads || 0) > 0 || (d.uso_ai_total || 0) > 0;
            return {
              logins: acc.logins + (d.logins || 0),
              pecas_criadas: acc.pecas_criadas + (d.pecas_criadas || 0),
              downloads: acc.downloads + (d.downloads || 0),
              ai_total: acc.ai_total + (d.uso_ai_total || 0),
              dias_ativos: acc.dias_ativos + (temAtividade ? 1 : 0),
              ultima_atividade: dataDate && (!acc.ultima_atividade || dataDate > acc.ultima_atividade) ? dataDate : acc.ultima_atividade
            };
          }, { logins: 0, pecas_criadas: 0, downloads: 0, ai_total: 0, dias_ativos: 0, ultima_atividade: null });
          setUsageData(aggregated);

          // Processar usuários
          const sortedUsers = usuariosResult.sort((a, b) => {
            const nameA = (a.nome || a.name || '').toLowerCase();
            const nameB = (b.nome || b.name || '').toLowerCase();
            return nameA.localeCompare(nameB);
          });
          setUsuarios(sortedUsers);

          // Recalcular segmento CS automaticamente
          if (clienteData.status !== 'inativo' && !clienteData.segmento_override) {
            const metricasParaCalculo = {
              logins: aggregated.logins,
              pecas_criadas: aggregated.pecas_criadas,
              downloads: aggregated.downloads,
              uso_ai_total: aggregated.ai_total,
              dias_ativos: aggregated.dias_ativos,
              ultima_atividade: aggregated.ultima_atividade
            };

            const resultado = calcularSegmentoCS(clienteData, sortedThreads, metricasParaCalculo, sortedUsers.length || 1);
            const segmentoAtual = getClienteSegmento(clienteData);
            const mudou = resultado.segmento !== segmentoAtual;
            const now = new Date();

            setSegmentoCalculado({ ...resultado, changed: mudou, recalculadoEm: now });

            // Salvar no Firestore
            const clienteRef = doc(db, 'clientes', id);
            if (mudou) {
              await updateDoc(clienteRef, {
                segmento_cs: resultado.segmento,
                segmento_motivo: resultado.motivo,
                segmento_recalculado_em: Timestamp.fromDate(now),
                segmento_anterior: segmentoAtual
              });
              setCliente(prev => ({
                ...prev,
                segmento_cs: resultado.segmento,
                segmento_motivo: resultado.motivo,
                segmento_recalculado_em: Timestamp.fromDate(now),
                segmento_anterior: segmentoAtual
              }));
            } else {
              await updateDoc(clienteRef, { segmento_recalculado_em: Timestamp.fromDate(now) });
            }
          }
        }
      } catch (error) {
        console.error('Erro ao buscar cliente:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchCliente();
  }, [id]);

  // Recalcular segmento manualmente
  const handleRecalcularSegmento = async () => {
    if (!cliente || cliente.status === 'inativo') return;

    const metricasParaCalculo = {
      logins: usageData.logins,
      pecas_criadas: usageData.pecas_criadas,
      downloads: usageData.downloads,
      uso_ai_total: usageData.ai_total,
      dias_ativos: usageData.dias_ativos || 0,
      ultima_atividade: usageData.ultima_atividade || null
    };

    const resultado = calcularSegmentoCS(cliente, threads, metricasParaCalculo, usuarios.length || 1);
    const segmentoAtual = getClienteSegmento(cliente);
    const now = new Date();

    setSegmentoCalculado({ ...resultado, changed: resultado.segmento !== segmentoAtual, recalculadoEm: now });

    const clienteRef = doc(db, 'clientes', id);
    const updateData = {
      segmento_cs: resultado.segmento,
      segmento_motivo: resultado.motivo,
      segmento_recalculado_em: Timestamp.fromDate(now),
      segmento_override: false
    };
    if (resultado.segmento !== segmentoAtual) {
      updateData.segmento_anterior = segmentoAtual;
    }
    await updateDoc(clienteRef, updateData);
    setCliente(prev => ({ ...prev, ...updateData }));
  };

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
    } catch (error) {
      // Silently handle error
    }
  };

  // Fetch documentos do cliente
  const fetchDocumentos = async () => {
    setLoadingDocs(true);
    try {
      const docsSnap = await getDocs(query(
        collection(db, 'documentos'),
        where('cliente_id', '==', id)
      ));
      const docsData = docsSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => {
          const dateA = a.created_at?.toDate?.() || new Date(0);
          const dateB = b.created_at?.toDate?.() || new Date(0);
          return dateB - dateA;
        });
      setDocumentos(docsData);
    } catch (error) {
      console.error('Erro ao buscar documentos:', error);
    } finally {
      setLoadingDocs(false);
    }
  };

  // Salvar documento
  const handleSaveDoc = async () => {
    setFormErrors({});
    const validationErrors = validateForm(documentoSchema, docForm);
    if (validationErrors) {
      setFormErrors(validationErrors);
      return;
    }
    setSavingDoc(true);
    try {
      if (editingDoc) {
        await updateDoc(doc(db, 'documentos', editingDoc.id), {
          titulo: docForm.titulo,
          descricao: docForm.descricao,
          url: docForm.url,
          updated_at: Timestamp.now()
        });
      } else {
        await addDoc(collection(db, 'documentos'), {
          titulo: docForm.titulo,
          descricao: docForm.descricao,
          url: docForm.url,
          cliente_id: id,
          created_at: Timestamp.now(),
          updated_at: Timestamp.now()
        });
      }
      setDocForm({ titulo: '', descricao: '', url: '' });
      setShowDocForm(false);
      setEditingDoc(null);
      fetchDocumentos();
    } catch (error) {
      console.error('Erro ao salvar documento:', error);
      alert('Erro ao salvar documento');
    } finally {
      setSavingDoc(false);
    }
  };

  // Excluir documento
  const handleDeleteDoc = async (docItem) => {
    if (!confirm(`Excluir "${docItem.titulo}"?`)) return;
    try {
      await deleteDoc(doc(db, 'documentos', docItem.id));
      fetchDocumentos();
    } catch (error) {
      console.error('Erro ao excluir documento:', error);
    }
  };

  // Fetch observações do CS
  const fetchObservacoes = async () => {
    setLoadingObs(true);
    try {
      const obsSnap = await getDocs(query(
        collection(db, 'observacoes_cs'),
        where('cliente_id', '==', id)
      ));
      const obsData = obsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const dateA = a.criado_em?.toDate?.() || new Date(0);
          const dateB = b.criado_em?.toDate?.() || new Date(0);
          return dateB - dateA;
        });
      setObservacoes(obsData);
    } catch (error) {
      console.error('Erro ao buscar observações:', error);
    } finally {
      setLoadingObs(false);
    }
  };

  // Salvar nova observação
  const handleSaveObs = async () => {
    setFormErrors({});
    const validationErrors = validateForm(observacaoSchema, { texto: obsTexto.trim() });
    if (validationErrors) {
      setFormErrors(validationErrors);
      return;
    }
    setSavingObs(true);
    try {
      await addDoc(collection(db, 'observacoes_cs'), {
        cliente_id: id,
        texto: obsTexto.trim(),
        status: 'ativa',
        criado_por: 'CS',
        criado_em: Timestamp.now(),
        resolvido_em: null,
        updated_at: Timestamp.now()
      });
      setObsTexto('');
      setShowObsForm(false);
      fetchObservacoes();
    } catch (error) {
      console.error('Erro ao salvar observação:', error);
      alert('Erro ao salvar observação');
    } finally {
      setSavingObs(false);
    }
  };

  // Toggle status da observação (ativa ↔ resolvida)
  const handleToggleObsStatus = async (obs) => {
    const novoStatus = obs.status === 'ativa' ? 'resolvida' : 'ativa';
    try {
      await updateDoc(doc(db, 'observacoes_cs', obs.id), {
        status: novoStatus,
        resolvido_em: novoStatus === 'resolvida' ? Timestamp.now() : null,
        updated_at: Timestamp.now()
      });
      setObservacoes(prev => prev.map(o =>
        o.id === obs.id ? { ...o, status: novoStatus } : o
      ));
    } catch (error) {
      console.error('Erro ao atualizar observação:', error);
    }
  };

  // Excluir observação
  const handleDeleteObs = async (obs) => {
    if (!confirm('Excluir esta observação?')) return;
    try {
      await deleteDoc(doc(db, 'observacoes_cs', obs.id));
      setObservacoes(prev => prev.filter(o => o.id !== obs.id));
    } catch (error) {
      console.error('Erro ao excluir observação:', error);
    }
  };

  // Carregar documentos quando a aba for selecionada
  useEffect(() => {
    if (activeTab === 'documentos' && documentos.length === 0) {
      fetchDocumentos();
    }
  }, [activeTab]);

  // Carregar observações quando a aba for selecionada ou conversas (para card no painel)
  useEffect(() => {
    if ((activeTab === 'observacoes' || activeTab === 'conversas') && observacoes.length === 0) {
      fetchObservacoes();
    }
  }, [activeTab]);

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

    // Filtrar observações ativas para enviar à IA
    const obsAtivas = observacoes.filter(o => o.status === 'ativa');

    const result = await classificar(
      teamId,
      threadId,
      conversaTexto,
      threadData,
      obsAtivas
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
        border: '1px solid rgba(139, 92, 246, 0.15)'
      }}>
        {[
          { id: 'resumo', label: 'Resumo', icon: Activity },
          { id: 'conversas', label: 'Conversas', icon: MessageSquare, count: threads.length },
          { id: 'playbook', label: 'Playbooks', icon: FileText },
          { id: 'documentos', label: 'Documentos', icon: FolderOpen },
          { id: 'observacoes', label: 'Observações', icon: ClipboardList },
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
              As métricas estão pausadas enquanto o cliente permanece inativo. Os dados históricos foram preservados.
            </p>
          </div>
        </div>
      )}

      {/* Segmento CS Card */}
      {cliente.status !== 'inativo' && (
      <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: '0 0 4px 0' }}>Segmento CS</h3>
            {(cliente.segmento_recalculado_em || segmentoCalculado?.recalculadoEm) && (
              <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>
                Recalculado em {(cliente.segmento_recalculado_em?.toDate?.() || segmentoCalculado?.recalculadoEm)?.toLocaleString('pt-BR')}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleRecalcularSegmento}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 12px',
                background: 'rgba(139, 92, 246, 0.1)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '12px',
                color: '#a78bfa', fontSize: '13px', fontWeight: '500', cursor: 'pointer'
              }}
            >
              <RotateCcw style={{ width: '14px', height: '14px' }} />
              Recalcular
            </button>
            <SegmentoBadge segmento={getClienteSegmento(cliente)} size="lg" />
          </div>
        </div>

        {/* Motivo da classificacao */}
        {segmentoCalculado?.motivo && (
          <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', marginBottom: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <p style={{ color: '#64748b', fontSize: '11px', fontWeight: '600', marginBottom: '6px', textTransform: 'uppercase' }}>Motivo</p>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>{segmentoCalculado.motivo}</p>
          </div>
        )}

        {/* Fatores do calculo */}
        {segmentoCalculado?.fatores && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
            <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
              <p style={{ color: '#64748b', fontSize: '11px', margin: '0 0 2px 0' }}>Dias sem uso</p>
              <p style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: 0 }}>{segmentoCalculado.fatores.dias_sem_uso}</p>
            </div>
            <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
              <p style={{ color: '#64748b', fontSize: '11px', margin: '0 0 2px 0' }}>Frequencia</p>
              <p style={{ color: 'white', fontSize: '14px', fontWeight: '600', margin: 0 }}>{segmentoCalculado.fatores.frequencia_uso}</p>
            </div>
            <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
              <p style={{ color: '#64748b', fontSize: '11px', margin: '0 0 2px 0' }}>Engajamento</p>
              <p style={{ color: 'white', fontSize: '14px', fontWeight: '600', margin: 0 }}>{segmentoCalculado.fatores.engajamento}</p>
            </div>
          </div>
        )}

        {/* Indicador de mudanca */}
        {segmentoCalculado?.changed && cliente.segmento_anterior && (
          <div style={{ padding: '10px 16px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '12px', marginBottom: '16px' }}>
            <p style={{ color: '#f59e0b', fontSize: '13px', margin: 0 }}>
              Segmento atualizado de {cliente.segmento_anterior} para {getClienteSegmento(cliente)}
            </p>
          </div>
        )}

        {(() => {
          const segmentoInfo = getSegmentoInfo(getClienteSegmento(cliente));
          if (!segmentoInfo) return null;
          return (
            <>
              {/* Criterios */}
              <div style={{ marginBottom: '20px' }}>
                <p style={{ color: '#64748b', fontSize: '11px', fontWeight: '600', marginBottom: '10px', textTransform: 'uppercase' }}>Criterios deste segmento</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {segmentoInfo.criterios.map((criterio, i) => (
                    <span key={i} style={{ padding: '6px 12px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', color: '#94a3b8', fontSize: '13px' }}>
                      {criterio}
                    </span>
                  ))}
                </div>
              </div>

              {/* Acoes Recomendadas */}
              <div>
                <p style={{ color: '#64748b', fontSize: '11px', fontWeight: '600', marginBottom: '10px', textTransform: 'uppercase' }}>Acoes Recomendadas</p>
                <ul style={{ margin: 0, paddingLeft: '20px' }}>
                  {segmentoInfo.acoes.map((acao, i) => (
                    <li key={i} style={{ color: segmentoInfo.color, fontSize: '14px', marginBottom: '8px' }}>
                      {acao}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          );
        })()}
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
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 8px 0' }}>Ultima Interacao</p>
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

      {/* Senha Padrão @trakto */}
      {cliente.senha_padrao && (
        <div style={{
          background: 'rgba(30, 27, 75, 0.4)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '32px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                background: 'rgba(245, 158, 11, 0.15)',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Key style={{ width: '20px', height: '20px', color: '#f59e0b' }} />
              </div>
              <div>
                <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0 0 4px 0' }}>Senha Padrão (@trakto)</p>
                <p style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: 0, fontFamily: 'monospace', letterSpacing: '1px' }}>
                  {showSenhaPadrao ? cliente.senha_padrao : '••••••••••'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowSenhaPadrao(!showSenhaPadrao)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                borderRadius: '10px',
                color: '#f59e0b',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              {showSenhaPadrao ? (
                <>
                  <EyeOff style={{ width: '16px', height: '16px' }} />
                  Ocultar
                </>
              ) : (
                <>
                  <Eye style={{ width: '16px', height: '16px' }} />
                  Mostrar
                </>
              )}
            </button>
          </div>
        </div>
      )}
        </>
      )}

      {/* Tab Content: Playbooks */}
      {activeTab === 'playbook' && (
        <PlaybooksSection clienteId={id} />
      )}

      {/* Tab Content: Documentos */}
      {activeTab === 'documentos' && (
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '20px', padding: '24px', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <FolderOpen style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
              <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>Documentos do Cliente</h2>
              <span style={{ padding: '4px 12px', background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa', borderRadius: '20px', fontSize: '13px', fontWeight: '500' }}>
                {documentos.length} {documentos.length === 1 ? 'documento' : 'documentos'}
              </span>
            </div>
            <button
              onClick={() => { setShowDocForm(true); setEditingDoc(null); setDocForm({ titulo: '', descricao: '', url: '' }); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                border: 'none',
                borderRadius: '10px',
                color: 'white',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              <Plus style={{ width: '16px', height: '16px' }} />
              Novo Documento
            </button>
          </div>

          <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px' }}>
            Planilhas, contratos e outros arquivos específicos deste cliente
          </p>

          {/* Formulário de adicionar/editar documento */}
          {showDocForm && (
            <div style={{ padding: '20px', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.2)', marginBottom: '20px' }}>
              <h3 style={{ color: 'white', fontSize: '15px', fontWeight: '600', margin: '0 0 16px 0' }}>
                {editingDoc ? 'Editar Documento' : 'Novo Documento'}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: '12px', marginBottom: '6px' }}>Título *</label>
                  <input
                    type="text"
                    value={docForm.titulo}
                    onChange={(e) => setDocForm(prev => ({ ...prev, titulo: e.target.value }))}
                    placeholder="Ex: Planilha de Onboarding"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: '#0f0a1f',
                      border: formErrors.titulo ? '1px solid #ef4444' : '1px solid rgba(139, 92, 246, 0.3)',
                      borderRadius: '8px',
                      color: 'white',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  <ErrorMessage error={formErrors.titulo} />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: '12px', marginBottom: '6px' }}>URL *</label>
                  <input
                    type="url"
                    value={docForm.url}
                    onChange={(e) => setDocForm(prev => ({ ...prev, url: e.target.value }))}
                    placeholder="https://docs.google.com/..."
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: '#0f0a1f',
                      border: formErrors.url ? '1px solid #ef4444' : '1px solid rgba(139, 92, 246, 0.3)',
                      borderRadius: '8px',
                      color: 'white',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  <ErrorMessage error={formErrors.url} />
                </div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '12px', marginBottom: '6px' }}>Descrição (opcional)</label>
                <input
                  type="text"
                  value={docForm.descricao}
                  onChange={(e) => setDocForm(prev => ({ ...prev, descricao: e.target.value }))}
                  placeholder="Breve descrição do documento"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: '#0f0a1f',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={handleSaveDoc}
                  disabled={!docForm.titulo || !docForm.url || savingDoc}
                  style={{
                    padding: '10px 20px',
                    background: (!docForm.titulo || !docForm.url) ? 'rgba(139, 92, 246, 0.3)' : 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: (!docForm.titulo || !docForm.url) ? 'not-allowed' : 'pointer'
                  }}
                >
                  {savingDoc ? 'Salvando...' : editingDoc ? 'Atualizar' : 'Adicionar'}
                </button>
                <button
                  onClick={() => { setShowDocForm(false); setEditingDoc(null); setDocForm({ titulo: '', descricao: '', url: '' }); }}
                  style={{
                    padding: '10px 20px',
                    background: 'rgba(100, 116, 139, 0.2)',
                    border: '1px solid rgba(100, 116, 139, 0.3)',
                    borderRadius: '8px',
                    color: '#94a3b8',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Lista de documentos */}
          {loadingDocs ? (
            <div style={{ padding: '48px', textAlign: 'center' }}>
              <div style={{ width: '32px', height: '32px', border: '3px solid rgba(139, 92, 246, 0.2)', borderTopColor: '#8b5cf6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }}></div>
            </div>
          ) : documentos.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {documentos.map(docItem => (
                <div
                  key={docItem.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '14px 16px',
                    background: 'rgba(15, 10, 31, 0.6)',
                    border: '1px solid rgba(139, 92, 246, 0.1)',
                    borderRadius: '12px'
                  }}
                >
                  <div style={{
                    width: '40px',
                    height: '40px',
                    background: 'rgba(139, 92, 246, 0.15)',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Link2 style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: '0 0 2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {docItem.titulo}
                    </p>
                    {docItem.descricao && (
                      <p style={{ color: '#64748b', fontSize: '12px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {docItem.descricao}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <a
                      href={docItem.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '8px 12px',
                        background: 'rgba(6, 182, 212, 0.1)',
                        border: '1px solid rgba(6, 182, 212, 0.3)',
                        borderRadius: '8px',
                        color: '#06b6d4',
                        fontSize: '12px',
                        fontWeight: '500',
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <ExternalLink style={{ width: '14px', height: '14px' }} />
                      Abrir
                    </a>
                    <button
                      onClick={() => { setEditingDoc(docItem); setDocForm({ titulo: docItem.titulo, descricao: docItem.descricao || '', url: docItem.url }); setShowDocForm(true); }}
                      style={{
                        padding: '8px',
                        background: 'transparent',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer'
                      }}
                    >
                      <Pencil style={{ width: '16px', height: '16px' }} />
                    </button>
                    <button
                      onClick={() => handleDeleteDoc(docItem)}
                      style={{
                        padding: '8px',
                        background: 'transparent',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer'
                      }}
                    >
                      <Trash2 style={{ width: '16px', height: '16px' }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '48px', textAlign: 'center' }}>
              <FolderOpen style={{ width: '48px', height: '48px', color: '#64748b', margin: '0 auto 16px' }} />
              <p style={{ color: '#94a3b8', fontSize: '16px', margin: '0 0 8px 0' }}>Nenhum documento</p>
              <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Adicione planilhas, contratos ou outros arquivos específicos deste cliente</p>
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Observações */}
      {activeTab === 'observacoes' && (
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '20px', padding: '24px', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <ClipboardList style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
              <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>Observações do CS</h2>
              <span style={{ padding: '4px 12px', background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa', borderRadius: '20px', fontSize: '13px', fontWeight: '500' }}>
                {observacoes.filter(o => o.status === 'ativa').length} {observacoes.filter(o => o.status === 'ativa').length === 1 ? 'ativa' : 'ativas'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => setMostrarResolvidas(!mostrarResolvidas)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  background: mostrarResolvidas ? 'rgba(100, 116, 139, 0.3)' : 'rgba(100, 116, 139, 0.1)',
                  border: '1px solid rgba(100, 116, 139, 0.3)',
                  borderRadius: '10px',
                  color: '#94a3b8',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                {mostrarResolvidas ? <EyeOff style={{ width: '14px', height: '14px' }} /> : <Eye style={{ width: '14px', height: '14px' }} />}
                {mostrarResolvidas ? 'Ocultar resolvidas' : 'Mostrar resolvidas'}
              </button>
              <button
                onClick={() => { setShowObsForm(true); setObsTexto(''); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                  border: 'none',
                  borderRadius: '10px',
                  color: 'white',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                <Plus style={{ width: '16px', height: '16px' }} />
                Nova Observação
              </button>
            </div>
          </div>

          <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px' }}>
            Notas e contexto qualitativo do CS. Observações ativas são incluídas na classificação da IA.
          </p>

          {/* Formulário de nova observação */}
          {showObsForm && (
            <div style={{ padding: '20px', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.2)', marginBottom: '20px' }}>
              <h3 style={{ color: 'white', fontSize: '15px', fontWeight: '600', margin: '0 0 12px 0' }}>Nova Observação</h3>
              <textarea
                value={obsTexto}
                onChange={(e) => setObsTexto(e.target.value)}
                placeholder="Ex: Cliente mencionou na call que está avaliando concorrentes. Insatisfeito com o tempo de resposta do suporte."
                rows={3}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: '#0f0a1f',
                  border: formErrors.texto ? '1px solid #ef4444' : '1px solid rgba(139, 92, 246, 0.3)',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  lineHeight: 1.5,
                  marginBottom: '4px'
                }}
              />
              <ErrorMessage error={formErrors.texto} />
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  onClick={handleSaveObs}
                  disabled={!obsTexto.trim() || savingObs}
                  style={{
                    padding: '10px 20px',
                    background: !obsTexto.trim() ? 'rgba(139, 92, 246, 0.3)' : 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: !obsTexto.trim() ? 'not-allowed' : 'pointer'
                  }}
                >
                  {savingObs ? 'Salvando...' : 'Adicionar'}
                </button>
                <button
                  onClick={() => { setShowObsForm(false); setObsTexto(''); }}
                  style={{
                    padding: '10px 20px',
                    background: 'rgba(100, 116, 139, 0.2)',
                    border: '1px solid rgba(100, 116, 139, 0.3)',
                    borderRadius: '8px',
                    color: '#94a3b8',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Lista de observações */}
          {loadingObs ? (
            <div style={{ padding: '48px', textAlign: 'center' }}>
              <div style={{ width: '32px', height: '32px', border: '3px solid rgba(139, 92, 246, 0.2)', borderTopColor: '#8b5cf6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }}></div>
            </div>
          ) : observacoes.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {observacoes
                .filter(obs => mostrarResolvidas || obs.status === 'ativa')
                .map(obs => (
                  <div
                    key={obs.id}
                    style={{
                      padding: '16px',
                      background: 'rgba(15, 10, 31, 0.6)',
                      border: `1px solid ${obs.status === 'ativa' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(100, 116, 139, 0.15)'}`,
                      borderRadius: '12px',
                      opacity: obs.status === 'resolvida' ? 0.5 : 1
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <span style={{
                            padding: '3px 10px',
                            background: obs.status === 'ativa' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.2)',
                            color: obs.status === 'ativa' ? '#10b981' : '#64748b',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '600'
                          }}>
                            {obs.status === 'ativa' ? 'Ativa' : 'Resolvida'}
                          </span>
                          <span style={{ color: '#64748b', fontSize: '12px' }}>
                            {obs.criado_em?.toDate ? obs.criado_em.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                          </span>
                          <span style={{ color: '#4a4568', fontSize: '11px' }}>por {obs.criado_por || 'CS'}</span>
                        </div>
                        <p style={{ color: '#e2e8f0', fontSize: '14px', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                          {obs.texto}
                        </p>
                        {obs.status === 'resolvida' && obs.resolvido_em && (
                          <p style={{ color: '#64748b', fontSize: '11px', margin: '8px 0 0 0' }}>
                            Resolvida em {obs.resolvido_em?.toDate ? obs.resolvido_em.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                          </p>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        <button
                          onClick={() => handleToggleObsStatus(obs)}
                          title={obs.status === 'ativa' ? 'Marcar como resolvida' : 'Reativar'}
                          style={{
                            padding: '8px',
                            background: obs.status === 'ativa' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(139, 92, 246, 0.1)',
                            border: `1px solid ${obs.status === 'ativa' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(139, 92, 246, 0.3)'}`,
                            borderRadius: '8px',
                            color: obs.status === 'ativa' ? '#10b981' : '#8b5cf6',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          {obs.status === 'ativa'
                            ? <CheckCircle2 style={{ width: '16px', height: '16px' }} />
                            : <RotateCcw style={{ width: '16px', height: '16px' }} />
                          }
                        </button>
                        <button
                          onClick={() => handleDeleteObs(obs)}
                          style={{
                            padding: '8px',
                            background: 'transparent',
                            border: 'none',
                            color: '#64748b',
                            cursor: 'pointer'
                          }}
                        >
                          <Trash2 style={{ width: '16px', height: '16px' }} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div style={{ padding: '48px', textAlign: 'center' }}>
              <ClipboardList style={{ width: '48px', height: '48px', color: '#64748b', margin: '0 auto 16px' }} />
              <p style={{ color: '#94a3b8', fontSize: '16px', margin: '0 0 8px 0' }}>Nenhuma observação</p>
              <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Adicione notas e contexto após calls ou reuniões com o cliente</p>
            </div>
          )}
        </div>
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

      {/* Tab Content: Conversas */}
      {activeTab === 'conversas' && (
      <ThreadsTimeline
        threads={threads}
        onThreadClick={handleThreadClick}
        onMarcarIrrelevante={handleMarcarIrrelevante}
        filterConfig={filterConfig}
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

            {/* Card de Observações ativas do CS */}
            {observacoes.filter(o => o.status === 'ativa').length > 0 && (
              <div style={{ padding: '12px 24px', background: 'rgba(16, 185, 129, 0.05)', borderBottom: '1px solid rgba(16, 185, 129, 0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ClipboardList style={{ width: '14px', height: '14px', color: '#10b981' }} />
                    <span style={{ color: '#10b981', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Observações do CS</span>
                  </div>
                  <button
                    onClick={() => { setSelectedThread(null); setShowManualClassification(false); setActiveTab('observacoes'); }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#10b981',
                      fontSize: '11px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    Ver todas →
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {observacoes.filter(o => o.status === 'ativa').slice(0, 3).map(obs => (
                    <div key={obs.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{ color: '#64748b', fontSize: '11px', flexShrink: 0, marginTop: '2px' }}>
                        {obs.criado_em?.toDate ? obs.criado_em.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '-'}
                      </span>
                      <p style={{
                        color: '#cbd5e1',
                        fontSize: '12px',
                        margin: 0,
                        lineHeight: 1.4,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '600px'
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
