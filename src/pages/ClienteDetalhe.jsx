import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, query, orderBy, limit, where, addDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { getThreadsByTeam, getMensagensByThread } from '../services/api';
import { ArrowLeft, Building2, Users, Clock, MessageSquare, Mail, AlertTriangle, CheckCircle, ChevronRight, X, LogIn, FileImage, Download, Sparkles, Pencil, User, ChevronDown, Activity, Bot, HelpCircle, Bug, Wrench, FileText, MoreHorizontal, Briefcase, Phone, Star, Eye, EyeOff, Key, FolderOpen, Plus, ExternalLink, Trash2, Link2, ClipboardList, CheckCircle2, RotateCcw, Video, Calendar, Linkedin, GraduationCap, Search, Loader2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { SEGMENTOS_CS, getSegmentoInfo, getClienteSegmento, calcularSegmentoCS } from '../utils/segmentoCS';
import { SegmentoBadge, SegmentoCard } from '../components/UI/SegmentoBadge';
import { useClassificarThread } from '../hooks/useClassificarThread';
import { THREAD_CATEGORIAS, THREAD_SENTIMENTOS, getCategoriaInfo, getSentimentoInfo, isOpenAIConfigured } from '../services/openai';
import OnboardingSection from '../components/Cliente/OnboardingSection';
import OngoingSection from '../components/Cliente/OngoingSection';
import ThreadsTimeline from '../components/Cliente/ThreadsTimeline';
import HeavyUsersCard from '../components/Cliente/HeavyUsersCard';
import { useEmailFilters } from '../hooks/useEmailFilters';
import { validateForm } from '../validation';
import { documentoSchema, observacaoSchema, interacaoSchema } from '../validation/documento';
import { ErrorMessage } from '../components/UI/ErrorMessage';
import { useUserActivityStatus } from '../hooks/useUserActivityStatus';
import { UserActivityDot } from '../components/UserActivityBadge';
import { summarizeTranscription, validateTranscriptionText, parseResumoIA, getSentimentoColor, getSentimentoLabel, TRANSCRIPTION_STATUS } from '../services/transcription';

// Extrair iniciais do nome (ex: "Marina Barros" → "MB")
const getInitials = (name) => {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const TIPOS_CONTATO = [
  { value: 'decisor', label: 'Decisor', color: '#8b5cf6' },
  { value: 'operacional', label: 'Operacional', color: '#06b6d4' },
  { value: 'financeiro', label: 'Financeiro', color: '#10b981' },
  { value: 'tecnico', label: 'Técnico', color: '#f59e0b' },
  { value: 'time_google', label: 'Time Google', color: '#3b82f6' },
  { value: 'outro', label: 'Outro', color: '#64748b' }
];

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
  const [searchParams] = useSearchParams();
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

  // Tab state - lê da URL se existir
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabFromUrl || 'resumo');

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

  // Contatos sugeridos (extraídos das threads)
  const [suggestedContacts, setSuggestedContacts] = useState([]);
  const [dismissedSuggestions, setDismissedSuggestions] = useState([]);

  // Tags de Problema
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [customTag, setCustomTag] = useState('');

  // Bugs/Problemas
  const [showBugForm, setShowBugForm] = useState(false);
  const [bugForm, setBugForm] = useState({ titulo: '', descricao: '', prioridade: 'media', link_clickup: '' });
  const [savingBug, setSavingBug] = useState(false);
  const [editingBugId, setEditingBugId] = useState(null);
  const [mostrarResolvidos, setMostrarResolvidos] = useState(false);

  // Alertas do cliente
  const [alertasCliente, setAlertasCliente] = useState([]);
  const [alertaDetalhe, setAlertaDetalhe] = useState(null);

  // Interações
  const [interacoes, setInteracoes] = useState([]);
  const [loadingInteracoes, setLoadingInteracoes] = useState(false);
  const [showInteracaoForm, setShowInteracaoForm] = useState(false);
  const [interacaoForm, setInteracaoForm] = useState({ tipo: 'feedback', data: '', participantes: '', notas: '', duracao: '', link_gravacao: '' });
  const [savingInteracao, setSavingInteracao] = useState(false);
  const [editingInteracaoId, setEditingInteracaoId] = useState(null);
  const [filterInteracaoTexto, setFilterInteracaoTexto] = useState('');
  const [filterInteracaoTipo, setFilterInteracaoTipo] = useState('');
  const [hideInformativos, setHideInformativos] = useState(true); // Esconder informativos por padrão

  // Transcrição de reunião
  const [transcricaoTexto, setTranscricaoTexto] = useState('');
  const [linkTranscricao, setLinkTranscricao] = useState('');
  const [transcribing, setTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState('');
  const [expandedTranscricao, setExpandedTranscricao] = useState({});

  // Stakeholders
  const [showStakeholderForm, setShowStakeholderForm] = useState(false);
  const [stakeholderForm, setStakeholderForm] = useState({ nome: '', email: '', cargo: '', telefone: '', linkedin_url: '', tipo_contato: 'outro' });
  const [savingStakeholder, setSavingStakeholder] = useState(false);

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
          const [threadsResult, metricasResult, usuariosResult, alertasResult, saudeConfigResult] = await Promise.all([
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

            // 3. Usuários (com chunks para computedTeamIds > 10)
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
            })().catch(() => []) : Promise.resolve([]),

            // 4. Alertas do cliente
            (async () => {
              const alertasRef = collection(db, 'alertas');
              const alertasSnap = await getDocs(query(alertasRef, where('cliente_id', '==', id), orderBy('created_at', 'desc')));
              return alertasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            })().catch(() => []),

            // 5. Config de Saúde CS (salvo em config/geral.segmentoConfig)
            getDoc(doc(db, 'config', 'geral')).then(snap => snap.exists() ? (snap.data().segmentoConfig || {}) : {}).catch(() => ({}))
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

          // Processar alertas
          setAlertasCliente(alertasResult);

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

            const resultado = calcularSegmentoCS(clienteData, sortedThreads, metricasParaCalculo, sortedUsers.length || 1, saudeConfigResult);
            const segmentoAtual = getClienteSegmento(clienteData);
            const mudou = resultado.segmento !== segmentoAtual;
            const now = new Date();

            setSegmentoCalculado({ ...resultado, changed: mudou, recalculadoEm: now, saudeConfig: saudeConfigResult });

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
  // Extrair contatos únicos das threads para sugestão
  const extractContactsFromThreads = () => {
    if (!threads || threads.length === 0 || !cliente) return;

    const existingEmails = new Set(
      (cliente.stakeholders || []).map(s => s.email.toLowerCase())
    );

    const senderMap = new Map();
    for (const thread of threads) {
      const email = thread.remetente_email || thread.sender_email || thread.from || '';
      const nome = thread.remetente_nome || thread.sender_name || '';
      if (!email || existingEmails.has(email.toLowerCase())) continue;
      if (email.toLowerCase().includes('@trakto.io')) continue;
      if (/noreply|no-reply|no_reply|mailer|bounce/i.test(email)) continue;

      if (!senderMap.has(email.toLowerCase())) {
        senderMap.set(email.toLowerCase(), { email, nome, threadCount: 1 });
      } else {
        const existing = senderMap.get(email.toLowerCase());
        existing.threadCount++;
        if (!existing.nome && nome) existing.nome = nome;
      }
    }

    const suggestions = Array.from(senderMap.values())
      .filter(s => !dismissedSuggestions.includes(s.email.toLowerCase()))
      .sort((a, b) => b.threadCount - a.threadCount);
    setSuggestedContacts(suggestions);
  };

  useEffect(() => {
    if (activeTab === 'pessoas' && threads.length > 0 && cliente) {
      extractContactsFromThreads();
    }
  }, [activeTab, threads, cliente?.stakeholders]);

  const handleAddSuggestedContact = async (contact) => {
    const newStakeholder = {
      id: Date.now(),
      nome: contact.nome || contact.email.split('@')[0],
      email: contact.email,
      cargo: '', telefone: '', linkedin_url: '', tipo_contato: 'outro'
    };
    const updatedStakeholders = [...(cliente.stakeholders || []), newStakeholder];
    try {
      await updateDoc(doc(db, 'clientes', id), { stakeholders: updatedStakeholders });
      setCliente(prev => ({ ...prev, stakeholders: updatedStakeholders }));
      setSuggestedContacts(prev => prev.filter(c => c.email.toLowerCase() !== contact.email.toLowerCase()));
    } catch (error) {
      console.error('Erro ao adicionar contato:', error);
    }
  };

  const handleDismissSuggestion = (email) => {
    setDismissedSuggestions(prev => [...prev, email.toLowerCase()]);
    setSuggestedContacts(prev => prev.filter(c => c.email.toLowerCase() !== email.toLowerCase()));
  };

  const handleRecalcularSegmento = async () => {
    if (!cliente || cliente.status === 'inativo') return;

    // Buscar config atualizado do Firestore (config/geral.segmentoConfig)
    const configSnap = await getDoc(doc(db, 'config', 'geral'));
    const saudeConfig = configSnap.exists() ? (configSnap.data().segmentoConfig || {}) : {};

    const metricasParaCalculo = {
      logins: usageData.logins,
      pecas_criadas: usageData.pecas_criadas,
      downloads: usageData.downloads,
      uso_ai_total: usageData.ai_total,
      dias_ativos: usageData.dias_ativos || 0,
      ultima_atividade: usageData.ultima_atividade || null
    };

    const resultado = calcularSegmentoCS(cliente, threads, metricasParaCalculo, usuarios.length || 1, saudeConfig);
    const segmentoAtual = getClienteSegmento(cliente);
    const now = new Date();

    setSegmentoCalculado({ ...resultado, changed: resultado.segmento !== segmentoAtual, recalculadoEm: now, saudeConfig });

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
      const normalizedUrl = docForm.url.match(/^https?:\/\//) ? docForm.url : `https://${docForm.url}`;
      if (editingDoc) {
        await updateDoc(doc(db, 'documentos', editingDoc.id), {
          titulo: docForm.titulo,
          descricao: docForm.descricao,
          url: normalizedUrl,
          updated_at: Timestamp.now()
        });
      } else {
        await addDoc(collection(db, 'documentos'), {
          titulo: docForm.titulo,
          descricao: docForm.descricao,
          url: normalizedUrl,
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

  // Tags de Problema - Handlers
  const TAGS_PREDEFINIDAS = ['Problema Ativo', 'Bug Reportado', 'Insatisfeito', 'Risco de Churn', 'Aguardando Resolução'];

  const handleAddTag = async (tagName, origem = 'cs', threadId = '') => {
    const tagsAtuais = cliente.tags_problema || [];
    if (tagsAtuais.some(t => t.tag === tagName)) return;
    const novaTag = { tag: tagName, origem, data: Timestamp.now(), thread_id: threadId };
    const novoArray = [...tagsAtuais, novaTag];
    try {
      await updateDoc(doc(db, 'clientes', id), { tags_problema: novoArray });
      setCliente(prev => ({ ...prev, tags_problema: novoArray }));
      setShowTagDropdown(false);
      setCustomTag('');
    } catch (error) {
      console.error('Erro ao adicionar tag:', error);
    }
  };

  const handleRemoveTag = async (tagName) => {
    const novoArray = (cliente.tags_problema || []).filter(t => t.tag !== tagName);
    try {
      await updateDoc(doc(db, 'clientes', id), { tags_problema: novoArray });
      setCliente(prev => ({ ...prev, tags_problema: novoArray }));
    } catch (error) {
      console.error('Erro ao remover tag:', error);
    }
  };

  // Bugs/Problemas - Handlers
  const PRIORIDADES_BUG = [
    { value: 'baixa', label: 'Baixa', color: '#64748b' },
    { value: 'media', label: 'Média', color: '#f59e0b' },
    { value: 'alta', label: 'Alta', color: '#f97316' },
    { value: 'critica', label: 'Crítica', color: '#ef4444' }
  ];

  const STATUS_BUG = [
    { value: 'aberto', label: 'Aberto', color: '#ef4444' },
    { value: 'em_andamento', label: 'Em andamento', color: '#f59e0b' },
    { value: 'resolvido', label: 'Resolvido', color: '#10b981' }
  ];

  const handleSaveBug = async () => {
    if (!bugForm.titulo.trim()) return;
    setSavingBug(true);
    try {
      const bugsAtuais = cliente.bugs_reportados || [];
      let novoArray;
      if (editingBugId) {
        novoArray = bugsAtuais.map(b => b.id === editingBugId ? {
          ...b,
          titulo: bugForm.titulo.trim(),
          descricao: bugForm.descricao.trim(),
          prioridade: bugForm.prioridade,
          link_clickup: bugForm.link_clickup.trim()
        } : b);
      } else {
        const novoBug = {
          id: Date.now().toString(),
          titulo: bugForm.titulo.trim(),
          descricao: bugForm.descricao.trim(),
          prioridade: bugForm.prioridade,
          status: 'aberto',
          link_clickup: bugForm.link_clickup.trim(),
          data: Timestamp.now(),
          resolvido_em: null
        };
        novoArray = [...bugsAtuais, novoBug];
      }
      await updateDoc(doc(db, 'clientes', id), { bugs_reportados: novoArray });
      setCliente(prev => ({ ...prev, bugs_reportados: novoArray }));
      setBugForm({ titulo: '', descricao: '', prioridade: 'media', link_clickup: '' });
      setShowBugForm(false);
      setEditingBugId(null);
    } catch (error) {
      console.error('Erro ao salvar bug:', error);
    } finally {
      setSavingBug(false);
    }
  };

  const handleToggleBugStatus = async (bugId, novoStatus) => {
    const bugsAtuais = cliente.bugs_reportados || [];
    const novoArray = bugsAtuais.map(b => b.id === bugId ? {
      ...b,
      status: novoStatus,
      resolvido_em: novoStatus === 'resolvido' ? Timestamp.now() : null
    } : b);
    try {
      await updateDoc(doc(db, 'clientes', id), { bugs_reportados: novoArray });
      setCliente(prev => ({ ...prev, bugs_reportados: novoArray }));
    } catch (error) {
      console.error('Erro ao atualizar status do bug:', error);
    }
  };

  const handleDeleteBug = async (bugId) => {
    if (!confirm('Excluir este bug?')) return;
    const novoArray = (cliente.bugs_reportados || []).filter(b => b.id !== bugId);
    try {
      await updateDoc(doc(db, 'clientes', id), { bugs_reportados: novoArray });
      setCliente(prev => ({ ...prev, bugs_reportados: novoArray }));
    } catch (error) {
      console.error('Erro ao excluir bug:', error);
    }
  };

  const handleEditBug = (bug) => {
    setBugForm({ titulo: bug.titulo, descricao: bug.descricao || '', prioridade: bug.prioridade, link_clickup: bug.link_clickup || '' });
    setEditingBugId(bug.id);
    setShowBugForm(true);
  };

  // Interações - Handlers
  const TIPOS_INTERACAO = [
    { value: 'email', label: 'Email', color: '#06b6d4' },
    { value: 'reuniao', label: 'Reunião', color: '#a855f7' },
    { value: 'observacao', label: 'Observação', color: '#10b981' },
    { value: 'alerta', label: 'Alerta', color: '#ef4444' },
    { value: 'onboarding', label: 'Onboarding', color: '#8b5cf6' },
    { value: 'feedback', label: 'Feedback', color: '#3b82f6' },
    { value: 'suporte', label: 'Suporte', color: '#f59e0b' },
    { value: 'treinamento', label: 'Treinamento', color: '#10b981' },
    { value: 'qbr', label: 'QBR', color: '#f97316' },
    { value: 'outro', label: 'Outro', color: '#64748b' }
  ];

  // Stakeholders - Handlers
  const handleSaveStakeholder = async () => {
    if (!stakeholderForm.nome.trim() || !stakeholderForm.email.trim()) {
      alert('Nome e email são obrigatórios');
      return;
    }
    setSavingStakeholder(true);
    try {
      const newStakeholder = {
        id: Date.now().toString(),
        nome: stakeholderForm.nome.trim(),
        email: stakeholderForm.email.trim().toLowerCase(),
        cargo: stakeholderForm.cargo.trim(),
        telefone: stakeholderForm.telefone.trim(),
        linkedin_url: stakeholderForm.linkedin_url.trim(),
        tipo_contato: stakeholderForm.tipo_contato
      };
      const updatedStakeholders = [...(cliente.stakeholders || []), newStakeholder];
      await updateDoc(doc(db, 'clientes', id), { stakeholders: updatedStakeholders });
      setCliente(prev => ({ ...prev, stakeholders: updatedStakeholders }));
      setStakeholderForm({ nome: '', email: '', cargo: '', telefone: '', linkedin_url: '', tipo_contato: 'outro' });
      setShowStakeholderForm(false);
    } catch (error) {
      alert('Erro ao salvar stakeholder');
    } finally {
      setSavingStakeholder(false);
    }
  };

  const handleDeleteStakeholder = async (stakeholderId, index) => {
    if (!confirm('Remover este stakeholder?')) return;
    try {
      const current = cliente.stakeholders || [];
      const updatedStakeholders = current.filter((s, i) => s.id ? s.id !== stakeholderId : i !== index);
      await updateDoc(doc(db, 'clientes', id), { stakeholders: updatedStakeholders });
      setCliente(prev => ({ ...prev, stakeholders: updatedStakeholders }));
    } catch (error) {
      alert('Erro ao remover stakeholder');
    }
  };

  const fetchInteracoes = async () => {
    setLoadingInteracoes(true);
    try {
      const snap = await getDocs(query(
        collection(db, 'interacoes'),
        where('cliente_id', '==', id)
      ));
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const dateA = a.data_interacao?.toDate?.() || new Date(a.data_interacao || 0);
          const dateB = b.data_interacao?.toDate?.() || new Date(b.data_interacao || 0);
          return dateB - dateA;
        });
      setInteracoes(data);
    } catch (error) {
      console.error('Erro ao buscar interações:', error);
    } finally {
      setLoadingInteracoes(false);
    }
  };

  const handleSaveInteracao = async () => {
    if (!interacaoForm.tipo || !interacaoForm.data) return;
    setSavingInteracao(true);
    setTranscriptionError('');

    // Validar transcrição se preenchida
    if (transcricaoTexto.trim()) {
      const validationError = validateTranscriptionText(transcricaoTexto);
      if (validationError) {
        setTranscriptionError(validationError);
        setSavingInteracao(false);
        return;
      }
    }

    try {
      const docData = {
        cliente_id: id,
        tipo: interacaoForm.tipo,
        data_interacao: Timestamp.fromDate(new Date(interacaoForm.data + 'T12:00:00')),
        participantes: interacaoForm.participantes.trim(),
        notas: interacaoForm.notas.trim(),
        duracao: parseInt(interacaoForm.duracao, 10) || 0,
        link_gravacao: interacaoForm.link_gravacao.trim(),
        updated_at: Timestamp.now()
      };

      // Se tem transcrição, adicionar status pendente
      if (transcricaoTexto.trim() && interacaoForm.tipo === 'reuniao') {
        docData.transcricao_status = TRANSCRIPTION_STATUS.PENDING;
        docData.link_transcricao = linkTranscricao.trim() || null;
      }

      let interacaoDocId = editingInteracaoId;

      if (editingInteracaoId) {
        await updateDoc(doc(db, 'interacoes', editingInteracaoId), docData);
      } else {
        docData.created_at = Timestamp.now();
        docData.created_by = 'CS';
        const newDoc = await addDoc(collection(db, 'interacoes'), docData);
        interacaoDocId = newDoc.id;
      }

      // Atualizar ultima_interacao no cliente para exibir na listagem
      await updateDoc(doc(db, 'clientes', id), {
        ultima_interacao_data: docData.data_interacao,
        ultima_interacao_tipo: docData.tipo
      });
      setCliente(prev => ({ ...prev, ultima_interacao_data: docData.data_interacao, ultima_interacao_tipo: docData.tipo }));

      // Se tem transcrição, gerar resumo em background
      if (transcricaoTexto.trim() && interacaoDocId && interacaoForm.tipo === 'reuniao') {
        setTranscribing(true);
        setShowInteracaoForm(false);

        // Atualizar lista imediatamente para mostrar status "processando"
        fetchInteracoes();

        // Chamar geração de resumo em background
        const result = await summarizeTranscription(transcricaoTexto.trim(), linkTranscricao.trim(), interacaoDocId, id);

        if (!result.success) {
          setTranscriptionError(result.error || 'Erro ao gerar resumo');
        }

        setTranscribing(false);
        setTranscricaoTexto('');
        setLinkTranscricao('');
        // Atualizar lista novamente com resumo completo
        fetchInteracoes();
      } else {
        setShowInteracaoForm(false);
        fetchInteracoes();
      }

      setInteracaoForm({ tipo: 'feedback', data: '', participantes: '', notas: '', duracao: '', link_gravacao: '' });
      setEditingInteracaoId(null);
      setTranscricaoTexto('');
      setLinkTranscricao('');
    } catch (error) {
      console.error('Erro ao salvar interação:', error);
    } finally {
      setSavingInteracao(false);
    }
  };

  const handleEditInteracao = (inter) => {
    const dataStr = inter.data_interacao?.toDate
      ? inter.data_interacao.toDate().toISOString().split('T')[0]
      : '';
    setInteracaoForm({
      tipo: inter.tipo,
      data: dataStr,
      participantes: inter.participantes || '',
      notas: inter.notas || '',
      duracao: inter.duracao ? String(inter.duracao) : '',
      link_gravacao: inter.link_gravacao || ''
    });
    setEditingInteracaoId(inter.id);
    setShowInteracaoForm(true);
  };

  const handleDeleteInteracao = async (interId) => {
    if (!confirm('Excluir esta interação?')) return;
    try {
      await deleteDoc(doc(db, 'interacoes', interId));
      setInteracoes(prev => prev.filter(i => i.id !== interId));
    } catch (error) {
      console.error('Erro ao excluir interação:', error);
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
    if (activeTab === 'interacoes' && observacoes.length === 0) {
      fetchObservacoes();
    }
  }, [activeTab]);

  // Carregar interações quando a aba for selecionada
  useEffect(() => {
    if (activeTab === 'interacoes' && interacoes.length === 0) {
      fetchInteracoes();
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
    <div style={{ padding: '32px', background: '#0f0a1f', minHeight: '100vh', maxWidth: '100%', overflow: 'hidden' }}>
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

      {/* Tab Content: Resumo */}
      {activeTab === 'resumo' && (
        <>
      {/* Aviso de Cliente Inativo */}
      {cliente.status === 'inativo' && (
        <div style={{ background: 'rgba(107, 114, 128, 0.15)', border: '1px solid rgba(107, 114, 128, 0.3)', borderRadius: '16px', padding: '20px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <AlertTriangle style={{ width: '20px', height: '20px', color: '#9ca3af', flexShrink: 0 }} />
          <p style={{ color: '#9ca3af', fontSize: '14px', margin: 0 }}>
            <strong>Cliente Inativo</strong> — métricas pausadas, dados históricos preservados.
          </p>
        </div>
      )}

      {/* Saúde CS - Compacto */}
      {cliente.status !== 'inativo' && (
      <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '20px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: segmentoCalculado?.motivo || segmentoCalculado?.fatores ? '14px' : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <SegmentoBadge segmento={getClienteSegmento(cliente)} size="lg" />
            {segmentoCalculado?.changed && cliente.segmento_anterior && (
              <span style={{ color: '#f59e0b', fontSize: '12px' }}>
                (era {cliente.segmento_anterior})
              </span>
            )}
          </div>
          <button
            onClick={handleRecalcularSegmento}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '12px', color: '#a78bfa', fontSize: '13px', fontWeight: '500', cursor: 'pointer' }}
          >
            <RotateCcw style={{ width: '14px', height: '14px' }} />
            Recalcular
          </button>
        </div>
        {segmentoCalculado?.motivo && (
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 10px 0' }}>{segmentoCalculado.motivo}</p>
        )}
        {segmentoCalculado?.fatores && (
          <div style={{ display: 'flex', gap: '16px' }}>
            <span style={{ color: '#64748b', fontSize: '12px' }}>Dias sem uso: <strong style={{ color: 'white' }}>{segmentoCalculado.fatores.dias_sem_uso}</strong></span>
            <span style={{ color: '#64748b', fontSize: '12px' }}>Frequência: <strong style={{ color: 'white' }}>{segmentoCalculado.fatores.frequencia_uso}</strong></span>
            <span style={{ color: '#64748b', fontSize: '12px' }}>Engajamento: <strong style={{ color: 'white' }}>{segmentoCalculado.fatores.engajamento}</strong></span>
          </div>
        )}
      </div>
      )}

      {/* Métricas de Uso - 4 em uma linha */}
      {cliente.status !== 'inativo' && (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '12px', padding: '16px' }}>
          <p style={{ color: '#94a3b8', fontSize: '11px', margin: '0 0 4px 0' }}>Logins (30d)</p>
          <p style={{ color: 'white', fontSize: '22px', fontWeight: '700', margin: 0 }}>{usageData.logins.toLocaleString('pt-BR')}</p>
        </div>
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(6, 182, 212, 0.2)', borderRadius: '12px', padding: '16px' }}>
          <p style={{ color: '#94a3b8', fontSize: '11px', margin: '0 0 4px 0' }}>Peças (30d)</p>
          <p style={{ color: 'white', fontSize: '22px', fontWeight: '700', margin: 0 }}>{usageData.pecas_criadas.toLocaleString('pt-BR')}</p>
        </div>
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '12px', padding: '16px' }}>
          <p style={{ color: '#94a3b8', fontSize: '11px', margin: '0 0 4px 0' }}>Downloads (30d)</p>
          <p style={{ color: 'white', fontSize: '22px', fontWeight: '700', margin: 0 }}>{usageData.downloads.toLocaleString('pt-BR')}</p>
        </div>
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(249, 115, 22, 0.2)', borderRadius: '12px', padding: '16px' }}>
          <p style={{ color: '#94a3b8', fontSize: '11px', margin: '0 0 4px 0' }}>Uso AI (30d)</p>
          <p style={{ color: 'white', fontSize: '22px', fontWeight: '700', margin: 0 }}>{usageData.ai_total.toLocaleString('pt-BR')}</p>
        </div>
      </div>
      )}

      {/* Tags de Problema */}
      {cliente.status !== 'inativo' && (
      <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '16px', padding: '20px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle style={{ width: '14px', height: '14px', color: '#ef4444' }} />
            <p style={{ color: '#64748b', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', margin: 0 }}>Tags de Problema</p>
            {(cliente.tags_problema || []).length > 0 && (
              <span style={{ padding: '2px 8px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', borderRadius: '10px', fontSize: '11px', fontWeight: '500' }}>
                {(cliente.tags_problema || []).length}
              </span>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowTagDropdown(!showTagDropdown)}
              style={{ width: '28px', height: '28px', background: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '8px', color: '#8b5cf6', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}
            >
              <Plus style={{ width: '14px', height: '14px' }} />
            </button>
            {showTagDropdown && (
              <div style={{ position: 'absolute', top: '36px', right: 0, background: '#1e1b4b', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '12px', padding: '8px', zIndex: 50, minWidth: '220px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
                {TAGS_PREDEFINIDAS.filter(t => !(cliente.tags_problema || []).some(tp => tp.tag === t)).map(tag => (
                  <button
                    key={tag}
                    onClick={() => handleAddTag(tag)}
                    style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '13px', textAlign: 'left', cursor: 'pointer', borderRadius: '8px' }}
                    onMouseEnter={e => { e.target.style.background = 'rgba(139, 92, 246, 0.15)'; e.target.style.color = 'white'; }}
                    onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = '#94a3b8'; }}
                  >
                    {tag}
                  </button>
                ))}
                <div style={{ borderTop: '1px solid rgba(139, 92, 246, 0.15)', marginTop: '4px', paddingTop: '8px', display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    value={customTag}
                    onChange={e => setCustomTag(e.target.value)}
                    placeholder="Tag customizada..."
                    style={{ flex: 1, padding: '6px 10px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '8px', color: 'white', fontSize: '12px', outline: 'none' }}
                    onKeyDown={e => { if (e.key === 'Enter' && customTag.trim()) handleAddTag(customTag.trim()); }}
                  />
                  <button
                    onClick={() => { if (customTag.trim()) handleAddTag(customTag.trim()); }}
                    style={{ padding: '6px 10px', background: 'rgba(139, 92, 246, 0.3)', border: 'none', borderRadius: '8px', color: '#a78bfa', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    Adicionar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        {(cliente.tags_problema || []).length === 0 ? (
          <p style={{ color: '#475569', fontSize: '13px', margin: 0 }}>Nenhuma tag de problema</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {(cliente.tags_problema || []).map((t, idx) => {
              const isIA = t.origem === 'ia';
              const cor = isIA ? '#06b6d4' : '#8b5cf6';
              return (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: isIA ? 'rgba(6, 182, 212, 0.15)' : 'rgba(139, 92, 246, 0.15)', border: `1px solid ${isIA ? 'rgba(6, 182, 212, 0.3)' : 'rgba(139, 92, 246, 0.3)'}`, borderRadius: '8px' }}>
                  <span style={{ color: cor, fontSize: '12px', fontWeight: '500' }}>{t.tag}</span>
                  <span style={{ color: '#475569', fontSize: '10px' }}>{isIA ? 'IA' : 'CS'}</span>
                  <button
                    onClick={() => handleRemoveTag(t.tag)}
                    style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: '0', display: 'flex', alignItems: 'center' }}
                    onMouseEnter={e => { e.target.style.color = '#ef4444'; }}
                    onMouseLeave={e => { e.target.style.color = '#475569'; }}
                  >
                    <X style={{ width: '12px', height: '12px' }} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* Heavy Users */}
      {cliente.status !== 'inativo' && (
      <div style={{ marginBottom: '16px' }}>
        <HeavyUsersCard
          teamIds={cliente.times || (cliente.team_id ? [cliente.team_id] : [cliente.id])}
          days={30}
          topN={5}
        />
      </div>
      )}

      {/* Senha Padrão @trakto */}
      {cliente.senha_padrao && (
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Key style={{ width: '16px', height: '16px', color: '#f59e0b' }} />
              <span style={{ color: '#94a3b8', fontSize: '13px' }}>Senha Padrão:</span>
              <span style={{ color: 'white', fontSize: '14px', fontWeight: '600', fontFamily: 'monospace' }}>
                {showSenhaPadrao ? cliente.senha_padrao : '••••••••'}
              </span>
            </div>
            <button
              onClick={() => setShowSenhaPadrao(!showSenhaPadrao)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
            >
              {showSenhaPadrao
                ? <EyeOff style={{ width: '16px', height: '16px', color: '#f59e0b' }} />
                : <Eye style={{ width: '16px', height: '16px', color: '#f59e0b' }} />
              }
            </button>
          </div>
        </div>
      )}
        </>
      )}

      {/* Tab Content: Onboarding */}
      {activeTab === 'onboarding' && (
        <OnboardingSection clienteId={id} />
      )}

      {/* Tab Content: Ongoing */}
      {activeTab === 'ongoing' && (
        <OngoingSection clienteId={id} segmentoAtual={getClienteSegmento(cliente)} cliente={cliente} />
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
      {/* Tab Content: Interações (Timeline Unificada) */}
      {/* Tab Content: Interações (Timeline Unificada) */}
      {activeTab === 'interacoes' && (() => {
        // Montar timeline unificada: threads (email) + interações manuais + observações + alertas
        const timelineItems = [
          ...threads.map(t => {
            const d = t.updated_at?.toDate ? t.updated_at.toDate() : (t.updated_at ? new Date(t.updated_at) : new Date(0));
            return { _source: 'thread', _date: d, _tipo: 'email', ...t };
          }),
          ...interacoes.map(i => {
            const d = i.data_interacao?.toDate ? i.data_interacao.toDate() : new Date(i.data_interacao || 0);
            return { _source: 'interacao', _date: d, _tipo: i.tipo || 'outro', ...i };
          }),
          ...observacoes.map(o => {
            const d = o.criado_em?.toDate ? o.criado_em.toDate() : new Date(o.criado_em || 0);
            return { _source: 'observacao', _date: d, _tipo: 'observacao', ...o };
          }),
          ...alertasCliente.map(a => {
            const d = a.created_at?.toDate ? a.created_at.toDate() : (a.created_at ? new Date(a.created_at) : new Date(0));
            return { _source: 'alerta', _date: d, _tipo: 'alerta', ...a };
          })
        ];
        // Filtrar informativos (threads com requer_acao: false)
        const filteredByInformativo = hideInformativos
          ? timelineItems.filter(item => item._source !== 'thread' || item.requer_acao !== false)
          : timelineItems;
        // Filtrar por tipo
        const filteredByTipo = filterInteracaoTipo
          ? filteredByInformativo.filter(item => item._tipo === filterInteracaoTipo)
          : filteredByInformativo;
        // Filtrar por texto
        const searchLower = filterInteracaoTexto.toLowerCase();
        const filteredItems = searchLower
          ? filteredByTipo.filter(item => {
              if (item._source === 'thread') {
                return (item.assunto || item.subject || '').toLowerCase().includes(searchLower) ||
                  (item.snippet || '').toLowerCase().includes(searchLower) ||
                  (item.remetente_nome || item.sender_name || '').toLowerCase().includes(searchLower);
              }
              if (item._source === 'observacao') {
                return (item.texto || '').toLowerCase().includes(searchLower);
              }
              if (item._source === 'alerta') {
                return (item.titulo || '').toLowerCase().includes(searchLower) ||
                  (item.mensagem || '').toLowerCase().includes(searchLower);
              }
              return (item.notas || '').toLowerCase().includes(searchLower) ||
                (item.participantes || '').toLowerCase().includes(searchLower);
            })
          : filteredByTipo;
        // Ordenar por data desc
        const sortedItems = [...filteredItems].sort((a, b) => b._date - a._date);
        const totalCount = threads.length + interacoes.length + observacoes.length + alertasCliente.length;

        return (
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '20px', padding: '24px', marginBottom: '32px' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <MessageSquare style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
              <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>Timeline</h2>
              <span style={{ padding: '4px 12px', background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa', borderRadius: '20px', fontSize: '13px', fontWeight: '500' }}>
                {sortedItems.length}{sortedItems.length !== totalCount ? ` / ${totalCount}` : ''}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => { setShowObsForm(true); setObsTexto(''); }}
                style={{ padding: '8px 14px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px', color: '#10b981', fontSize: '13px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus style={{ width: '16px', height: '16px' }} />
                Observação
              </button>
              <button
                onClick={() => { setShowInteracaoForm(!showInteracaoForm); setEditingInteracaoId(null); setInteracaoForm({ tipo: 'feedback', data: '', participantes: '', notas: '', duracao: '', link_gravacao: '' }); }}
                style={{ padding: '8px 14px', background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)', border: 'none', borderRadius: '10px', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus style={{ width: '16px', height: '16px' }} />
                Interação
              </button>
            </div>
          </div>

          {/* Filtros */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#64748b' }} />
              <input
                type="text"
                value={filterInteracaoTexto}
                onChange={e => setFilterInteracaoTexto(e.target.value)}
                placeholder="Buscar na timeline..."
                style={{ width: '100%', padding: '10px 12px 10px 36px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: 'white', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <select
              value={filterInteracaoTipo}
              onChange={e => setFilterInteracaoTipo(e.target.value)}
              style={{ padding: '10px 14px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: filterInteracaoTipo ? 'white' : '#64748b', fontSize: '13px', outline: 'none', cursor: 'pointer', minWidth: '150px' }}
            >
              <option value="">Todos os tipos</option>
              {TIPOS_INTERACAO.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: hideInformativos ? 'rgba(139, 92, 246, 0.15)' : 'rgba(15, 10, 31, 0.6)', border: '1px solid', borderColor: hideInformativos ? 'rgba(139, 92, 246, 0.3)' : '#3730a3', borderRadius: '10px', cursor: 'pointer', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={hideInformativos}
                onChange={e => setHideInformativos(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#8b5cf6', cursor: 'pointer' }}
              />
              <span style={{ color: hideInformativos ? '#a78bfa' : '#64748b', fontSize: '13px', whiteSpace: 'nowrap' }}>Esconder informativos</span>
            </label>
          </div>

          {/* Banner de resumo em andamento */}
          {transcribing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.25)', borderRadius: '12px', marginBottom: '16px' }}>
              <Loader2 style={{ width: '20px', height: '20px', color: '#8b5cf6', animation: 'spin 1s linear infinite' }} />
              <div>
                <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: 0 }}>Gerando resumo com IA...</p>
                <p style={{ color: '#94a3b8', fontSize: '12px', margin: '2px 0 0 0' }}>Isso pode levar alguns segundos. A página será atualizada automaticamente.</p>
              </div>
            </div>
          )}

          {/* Erro de transcrição */}
          {transcriptionError && !transcribing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '12px', marginBottom: '16px' }}>
              <AlertTriangle style={{ width: '20px', height: '20px', color: '#ef4444', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <p style={{ color: '#ef4444', fontSize: '14px', fontWeight: '500', margin: 0 }}>Erro no resumo</p>
                <p style={{ color: '#94a3b8', fontSize: '12px', margin: '2px 0 0 0' }}>{transcriptionError}</p>
              </div>
              <button
                onClick={() => setTranscriptionError('')}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
              >
                <X style={{ width: '16px', height: '16px' }} />
              </button>
            </div>
          )}

          {/* Formulário de Nova Observação */}
          {showObsForm && (
            <div style={{ background: 'rgba(15, 10, 31, 0.6)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <span style={{ padding: '2px 8px', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', borderRadius: '6px', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>Observação</span>
                <span style={{ color: '#64748b', fontSize: '12px' }}>Nota qualitativa do CS</span>
              </div>
              <textarea
                value={obsTexto}
                onChange={(e) => setObsTexto(e.target.value)}
                placeholder="Ex: Cliente mencionou na call que está avaliando concorrentes..."
                rows={3}
                style={{ width: '100%', padding: '10px 14px', background: '#0f0a1f', border: formErrors.texto ? '1px solid #ef4444' : '1px solid #3730a3', borderRadius: '10px', color: 'white', fontSize: '14px', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
              <ErrorMessage error={formErrors.texto} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button onClick={() => { setShowObsForm(false); setObsTexto(''); }} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '10px', color: '#94a3b8', fontSize: '13px', cursor: 'pointer' }}>Cancelar</button>
                <button onClick={handleSaveObs} disabled={!obsTexto.trim() || savingObs} style={{ padding: '8px 16px', background: !obsTexto.trim() ? 'rgba(16, 185, 129, 0.3)' : 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)', border: 'none', borderRadius: '10px', color: 'white', fontSize: '13px', fontWeight: '600', cursor: !obsTexto.trim() ? 'not-allowed' : 'pointer' }}>
                  {savingObs ? 'Salvando...' : 'Adicionar'}
                </button>
              </div>
            </div>
          )}

          {/* Formulário de Nova Interação */}
          {showInteracaoForm && (
            <div style={{ background: 'rgba(15, 10, 31, 0.6)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '500', display: 'block', marginBottom: '4px' }}>Tipo *</label>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {TIPOS_INTERACAO.filter(t => t.value !== 'email').map(t => (
                        <button
                          key={t.value}
                          onClick={() => setInteracaoForm(prev => ({ ...prev, tipo: t.value }))}
                          style={{
                            padding: '6px 10px',
                            border: `1px solid ${interacaoForm.tipo === t.value ? t.color : 'rgba(139, 92, 246, 0.2)'}`,
                            background: interacaoForm.tipo === t.value ? `${t.color}20` : 'transparent',
                            borderRadius: '8px',
                            color: interacaoForm.tipo === t.value ? t.color : '#64748b',
                            fontSize: '12px', fontWeight: '500', cursor: 'pointer'
                          }}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '500', display: 'block', marginBottom: '4px' }}>Data *</label>
                    <input
                      type="date"
                      value={interacaoForm.data}
                      onChange={e => setInteracaoForm(prev => ({ ...prev, data: e.target.value }))}
                      style={{ width: '100%', padding: '10px 14px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: 'white', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '500', display: 'block', marginBottom: '4px' }}>Participantes</label>
                    <input
                      type="text"
                      value={interacaoForm.participantes}
                      onChange={e => setInteracaoForm(prev => ({ ...prev, participantes: e.target.value }))}
                      placeholder="Nomes separados por vírgula..."
                      style={{ width: '100%', padding: '10px 14px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: 'white', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '500', display: 'block', marginBottom: '4px' }}>Duração (min)</label>
                      <input
                        type="number"
                        value={interacaoForm.duracao}
                        onChange={e => setInteracaoForm(prev => ({ ...prev, duracao: e.target.value }))}
                        placeholder="30"
                        min="0"
                        style={{ width: '100%', padding: '10px 14px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: 'white', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '500', display: 'block', marginBottom: '4px' }}>Link gravação</label>
                      <input
                        type="text"
                        value={interacaoForm.link_gravacao}
                        onChange={e => setInteracaoForm(prev => ({ ...prev, link_gravacao: e.target.value }))}
                        placeholder="URL..."
                        style={{ width: '100%', padding: '10px 14px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: 'white', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '500', display: 'block', marginBottom: '4px' }}>Notas</label>
                  <textarea
                    value={interacaoForm.notas}
                    onChange={e => setInteracaoForm(prev => ({ ...prev, notas: e.target.value }))}
                    placeholder="Resumo da interação..."
                    rows={3}
                    style={{ width: '100%', padding: '10px 14px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: 'white', fontSize: '14px', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  />
                </div>

                {/* Transcrição da reunião - apenas para reuniões */}
                {interacaoForm.tipo === 'reuniao' && (
                  <div style={{ padding: '16px', background: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <Sparkles style={{ width: '16px', height: '16px', color: '#a78bfa' }} />
                      <span style={{ color: '#a78bfa', fontSize: '13px', fontWeight: '600' }}>Transcrição + Resumo IA</span>
                      <span style={{ color: '#64748b', fontSize: '11px' }}>(opcional)</span>
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '500', display: 'block', marginBottom: '4px' }}>
                        Cole a transcrição da reunião
                      </label>
                      <textarea
                        value={transcricaoTexto}
                        onChange={e => setTranscricaoTexto(e.target.value)}
                        placeholder="Cole aqui o texto da transcrição (copie do Google Docs, Otter.ai, etc.)..."
                        rows={5}
                        style={{ width: '100%', padding: '10px 14px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: 'white', fontSize: '13px', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                      />
                      {transcricaoTexto && (
                        <p style={{ color: '#64748b', fontSize: '11px', marginTop: '4px' }}>
                          {transcricaoTexto.length.toLocaleString()} caracteres
                        </p>
                      )}
                    </div>

                    <div>
                      <label style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '500', display: 'block', marginBottom: '4px' }}>
                        Link do documento (Google Docs, etc.)
                      </label>
                      <input
                        type="url"
                        value={linkTranscricao}
                        onChange={e => setLinkTranscricao(e.target.value)}
                        placeholder="https://docs.google.com/document/d/..."
                        style={{ width: '100%', padding: '10px 14px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: 'white', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>

                    {transcriptionError && (
                      <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '8px' }}>
                        {transcriptionError}
                      </p>
                    )}

                    {transcricaoTexto.trim() && (
                      <p style={{ color: '#10b981', fontSize: '11px', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Sparkles style={{ width: '12px', height: '12px' }} />
                        A IA irá gerar um resumo automático com pontos-chave e ações combinadas.
                      </p>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    onClick={() => { setShowInteracaoForm(false); setEditingInteracaoId(null); setTranscricaoTexto(''); setLinkTranscricao(''); setTranscriptionError(''); }}
                    style={{ padding: '8px 16px', background: 'transparent', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '10px', color: '#94a3b8', fontSize: '13px', cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveInteracao}
                    disabled={savingInteracao || !interacaoForm.data}
                    style={{ padding: '8px 16px', background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)', border: 'none', borderRadius: '10px', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer', opacity: savingInteracao || !interacaoForm.data ? 0.5 : 1 }}
                  >
                    {savingInteracao ? 'Salvando...' : editingInteracaoId ? 'Atualizar' : 'Registrar'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Timeline Unificada */}
          {sortedItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <MessageSquare style={{ width: '40px', height: '40px', color: '#3730a3', margin: '0 auto 12px' }} />
              <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
                {totalCount === 0 ? 'Nenhuma interação registrada' : 'Nenhum resultado para os filtros aplicados'}
              </p>
            </div>
          ) : (
            <div style={{ position: 'relative', paddingLeft: '24px' }}>
              {/* Linha vertical da timeline */}
              <div style={{ position: 'absolute', left: '8px', top: '8px', bottom: '8px', width: '2px', background: 'rgba(139, 92, 246, 0.15)' }} />

              {sortedItems.map((item, idx) => {
                const tipoInfo = TIPOS_INTERACAO.find(t => t.value === item._tipo) || TIPOS_INTERACAO[TIPOS_INTERACAO.length - 1];

                if (item._source === 'thread') {
                  // Renderizar thread de email
                  const assunto = item.assunto || item.subject || 'Sem assunto';
                  const remetente = item.remetente_nome || item.sender_name || item.remetente_email || '';
                  const snippet = item.snippet || '';
                  const categoriaInfo = item.categoria ? getCategoriaInfo(item.categoria) : null;
                  const sentimentoInfo = item.sentimento ? getSentimentoInfo(item.sentimento) : null;

                  return (
                    <div key={`t-${item.id}`} style={{ position: 'relative', marginBottom: idx < sortedItems.length - 1 ? '12px' : 0 }}>
                      <div style={{ position: 'absolute', left: '-20px', top: '14px', width: '12px', height: '12px', borderRadius: '50%', background: tipoInfo.color, border: '2px solid #0f0a1f' }} />
                      <div
                        onClick={() => handleThreadClick(item)}
                        style={{ background: 'rgba(15, 10, 31, 0.4)', border: '1px solid rgba(6, 182, 212, 0.12)', borderRadius: '12px', padding: '14px 16px', cursor: 'pointer', transition: 'border-color 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.35)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.12)'}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                          <span style={{ padding: '2px 8px', background: `${tipoInfo.color}20`, color: tipoInfo.color, borderRadius: '6px', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>
                            Email
                          </span>
                          <span style={{ color: '#94a3b8', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar style={{ width: '11px', height: '11px' }} />
                            {item._date.toLocaleDateString('pt-BR')}
                          </span>
                          {remetente && (
                            <span style={{ color: '#64748b', fontSize: '12px' }}>{remetente}</span>
                          )}
                          {categoriaInfo && (
                            <span style={{ padding: '1px 6px', background: `${categoriaInfo.color}15`, color: categoriaInfo.color, borderRadius: '4px', fontSize: '10px', fontWeight: '500' }}>
                              {categoriaInfo.label}
                            </span>
                          )}
                          {sentimentoInfo && (
                            <span style={{ fontSize: '12px' }}>{sentimentoInfo.emoji}</span>
                          )}
                        </div>
                        <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: '0 0 4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {assunto}
                        </p>
                        {snippet && (
                          <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {snippet.substring(0, 150)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                }

                // Renderizar observação
                if (item._source === 'observacao') {
                  return (
                    <div key={`o-${item.id}`} style={{ position: 'relative', marginBottom: idx < sortedItems.length - 1 ? '12px' : 0 }}>
                      <div style={{ position: 'absolute', left: '-20px', top: '14px', width: '12px', height: '12px', borderRadius: '50%', background: tipoInfo.color, border: '2px solid #0f0a1f' }} />
                      <div style={{ background: 'rgba(15, 10, 31, 0.4)', border: `1px solid ${item.status === 'ativa' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.1)'}`, borderRadius: '12px', padding: '14px 16px', opacity: item.status === 'resolvida' ? 0.6 : 1 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                              <span style={{ padding: '2px 8px', background: `${tipoInfo.color}20`, color: tipoInfo.color, borderRadius: '6px', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>
                                Observação
                              </span>
                              <span style={{ padding: '2px 8px', background: item.status === 'ativa' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.2)', color: item.status === 'ativa' ? '#10b981' : '#64748b', borderRadius: '6px', fontSize: '10px', fontWeight: '600' }}>
                                {item.status === 'ativa' ? 'Ativa' : 'Resolvida'}
                              </span>
                              <span style={{ color: '#94a3b8', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Calendar style={{ width: '11px', height: '11px' }} />
                                {item._date.toLocaleDateString('pt-BR')}
                              </span>
                              <span style={{ color: '#4a4568', fontSize: '11px' }}>por {item.criado_por || 'CS'}</span>
                            </div>
                            <p style={{ color: '#e2e8f0', fontSize: '13px', margin: 0, lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                              {item.texto}
                            </p>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                            <button
                              onClick={() => handleToggleObsStatus(item)}
                              title={item.status === 'ativa' ? 'Marcar resolvida' : 'Reativar'}
                              style={{ width: '30px', height: '30px', background: item.status === 'ativa' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(139, 92, 246, 0.1)', border: `1px solid ${item.status === 'ativa' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(139, 92, 246, 0.2)'}`, borderRadius: '8px', color: item.status === 'ativa' ? '#10b981' : '#8b5cf6', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              {item.status === 'ativa' ? <CheckCircle2 style={{ width: '14px', height: '14px' }} /> : <RotateCcw style={{ width: '14px', height: '14px' }} />}
                            </button>
                            <button
                              onClick={() => handleDeleteObs(item)}
                              title="Excluir"
                              style={{ width: '30px', height: '30px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <Trash2 style={{ width: '14px', height: '14px' }} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                // Renderizar alerta
                if (item._source === 'alerta') {
                  const statusColors = {
                    pendente: { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', label: 'Pendente' },
                    em_andamento: { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', label: 'Em Andamento' },
                    bloqueado: { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', label: 'Bloqueado' },
                    resolvido: { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', label: 'Resolvido' },
                    ignorado: { bg: 'rgba(100, 116, 139, 0.15)', color: '#64748b', label: 'Ignorado' }
                  };
                  const statusInfo = statusColors[item.status] || statusColors.pendente;
                  const tipoLabels = {
                    sentimento_negativo: 'Sentimento Negativo',
                    problema_reclamacao: 'Problema/Reclamação',
                    entrou_resgate: 'Entrou em Resgate'
                  };

                  return (
                    <div key={`a-${item.id}`} style={{ position: 'relative', marginBottom: idx < sortedItems.length - 1 ? '12px' : 0 }}>
                      <div style={{ position: 'absolute', left: '-20px', top: '14px', width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444', border: '2px solid #0f0a1f' }} />
                      <div
                        onClick={() => setAlertaDetalhe(item)}
                        style={{ background: 'rgba(15, 10, 31, 0.4)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '12px', padding: '14px 16px', cursor: 'pointer', transition: 'border-color 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.35)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.15)'}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                          <span style={{ padding: '2px 8px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', borderRadius: '6px', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>
                            Alerta
                          </span>
                          <span style={{ padding: '2px 8px', background: statusInfo.bg, color: statusInfo.color, borderRadius: '6px', fontSize: '10px', fontWeight: '600' }}>
                            {statusInfo.label}
                          </span>
                          <span style={{ color: '#94a3b8', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar style={{ width: '11px', height: '11px' }} />
                            {item._date.toLocaleDateString('pt-BR')}
                          </span>
                          <span style={{ color: '#64748b', fontSize: '11px' }}>
                            {tipoLabels[item.tipo] || item.tipo}
                          </span>
                        </div>
                        <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: '0 0 4px 0' }}>
                          {item.titulo}
                        </p>
                        {item.mensagem && (
                          <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.mensagem.substring(0, 150)}
                          </p>
                        )}
                        {item.clickup_comments && item.clickup_comments.length > 0 && (
                          <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <MessageSquare style={{ width: '12px', height: '12px', color: '#06b6d4' }} />
                            <span style={{ color: '#06b6d4', fontSize: '11px' }}>{item.clickup_comments.length} comentário{item.clickup_comments.length > 1 ? 's' : ''} do ClickUp</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                // Renderizar interação manual
                const resumoData = item.resumo_ia ? parseResumoIA(item.resumo_ia) : null;
                const isTranscricaoExpanded = expandedTranscricao[item.id];

                return (
                  <div key={`i-${item.id}`} style={{ position: 'relative', marginBottom: idx < sortedItems.length - 1 ? '12px' : 0 }}>
                    <div style={{ position: 'absolute', left: '-20px', top: '14px', width: '12px', height: '12px', borderRadius: '50%', background: tipoInfo.color, border: '2px solid #0f0a1f' }} />
                    <div style={{ background: 'rgba(15, 10, 31, 0.4)', border: '1px solid rgba(139, 92, 246, 0.1)', borderRadius: '12px', padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                            <span style={{ padding: '2px 8px', background: `${tipoInfo.color}20`, color: tipoInfo.color, borderRadius: '6px', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>
                              {tipoInfo.label}
                            </span>
                            <span style={{ color: '#94a3b8', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Calendar style={{ width: '11px', height: '11px' }} />
                              {item._date.toLocaleDateString('pt-BR')}
                            </span>
                            {item.duracao > 0 && (
                              <span style={{ color: '#64748b', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Clock style={{ width: '11px', height: '11px' }} />
                                {item.duracao}min
                              </span>
                            )}
                            {/* Status da transcrição */}
                            {item.transcricao_status === 'processing' && (
                              <span style={{ padding: '2px 8px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', borderRadius: '6px', fontSize: '10px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Loader2 style={{ width: '10px', height: '10px', animation: 'spin 1s linear infinite' }} />
                                Gerando resumo...
                              </span>
                            )}
                            {item.transcricao_status === 'completed' && (
                              <span style={{ padding: '2px 8px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', borderRadius: '6px', fontSize: '10px', fontWeight: '600' }}>
                                Com resumo IA
                              </span>
                            )}
                            {item.transcricao_status === 'error' && (
                              <span style={{ padding: '2px 8px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', borderRadius: '6px', fontSize: '10px', fontWeight: '600' }}>
                                Erro no resumo
                              </span>
                            )}
                          </div>
                          {item.participantes && (
                            <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Users style={{ width: '11px', height: '11px', flexShrink: 0 }} />
                              {item.participantes}
                            </p>
                          )}
                          {item.notas && (
                            <p style={{ color: '#e2e8f0', fontSize: '13px', margin: '0 0 6px 0', lineHeight: '1.4' }}>
                              {item.notas}
                            </p>
                          )}

                          {/* Resumo IA da transcrição */}
                          {resumoData && (
                            <div style={{ marginTop: '10px', padding: '12px', background: 'rgba(139, 92, 246, 0.08)', borderRadius: '10px', border: '1px solid rgba(139, 92, 246, 0.15)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                <Sparkles style={{ width: '14px', height: '14px', color: '#a78bfa' }} />
                                <span style={{ color: '#a78bfa', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>Resumo IA</span>
                                {resumoData.sentimento_geral && (
                                  <span style={{ padding: '2px 8px', background: `${getSentimentoColor(resumoData.sentimento_geral)}20`, color: getSentimentoColor(resumoData.sentimento_geral), borderRadius: '6px', fontSize: '10px', fontWeight: '500' }}>
                                    {getSentimentoLabel(resumoData.sentimento_geral)}
                                  </span>
                                )}
                              </div>
                              {resumoData.resumo && (
                                <p style={{ color: '#e2e8f0', fontSize: '13px', margin: '0 0 8px 0', lineHeight: '1.5' }}>
                                  {resumoData.resumo}
                                </p>
                              )}
                              {resumoData.pontos_chave && resumoData.pontos_chave.length > 0 && (
                                <div style={{ marginBottom: '8px' }}>
                                  <span style={{ color: '#64748b', fontSize: '11px', fontWeight: '600' }}>Pontos-chave:</span>
                                  <ul style={{ margin: '4px 0 0 0', paddingLeft: '16px' }}>
                                    {resumoData.pontos_chave.map((ponto, i) => (
                                      <li key={i} style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '2px' }}>{ponto}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {resumoData.acoes_combinadas && resumoData.acoes_combinadas.length > 0 && (
                                <div>
                                  <span style={{ color: '#64748b', fontSize: '11px', fontWeight: '600' }}>Ações combinadas:</span>
                                  <ul style={{ margin: '4px 0 0 0', paddingLeft: '16px' }}>
                                    {resumoData.acoes_combinadas.map((acao, i) => (
                                      <li key={i} style={{ color: '#10b981', fontSize: '12px', marginBottom: '2px' }}>{acao}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Transcrição completa (collapsible) */}
                          {item.transcricao && (
                            <div style={{ marginTop: '8px' }}>
                              <button
                                onClick={() => setExpandedTranscricao(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                                style={{ background: 'none', border: 'none', color: '#06b6d4', fontSize: '12px', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '4px' }}
                              >
                                <FileText style={{ width: '12px', height: '12px' }} />
                                {isTranscricaoExpanded ? 'Ocultar transcrição' : 'Ver transcrição completa'}
                                <ChevronDown style={{ width: '12px', height: '12px', transform: isTranscricaoExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                              </button>
                              {isTranscricaoExpanded && (
                                <div style={{ marginTop: '8px', padding: '12px', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '8px', border: '1px solid rgba(100, 116, 139, 0.2)', maxHeight: '300px', overflowY: 'auto' }}>
                                  <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0, lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                                    {item.transcricao}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                          {item.link_gravacao && (
                            <a href={item.link_gravacao} target="_blank" rel="noopener noreferrer" style={{ color: '#06b6d4', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', marginTop: '6px' }}>
                              <Video style={{ width: '12px', height: '12px' }} />
                              Ver gravação
                            </a>
                          )}

                          {item.link_transcricao && (
                            <a href={item.link_transcricao} target="_blank" rel="noopener noreferrer" style={{ color: '#a78bfa', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', marginTop: '6px' }}>
                              <FileText style={{ width: '12px', height: '12px' }} />
                              Ver transcrição completa
                            </a>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                          <button
                            onClick={() => handleEditInteracao(item)}
                            title="Editar"
                            style={{ width: '30px', height: '30px', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '8px', color: '#8b5cf6', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Pencil style={{ width: '14px', height: '14px' }} />
                          </button>
                          <button
                            onClick={() => handleDeleteInteracao(item.id)}
                            title="Excluir"
                            style={{ width: '30px', height: '30px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Trash2 style={{ width: '14px', height: '14px' }} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        );
      })()}

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
      {activeTab === 'pessoas' && (
      <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(249, 115, 22, 0.2)', borderRadius: '20px', padding: '24px', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Star style={{ width: '20px', height: '20px', color: '#f97316' }} />
            <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>Stakeholders</h2>
            <span style={{ padding: '4px 12px', background: 'rgba(249, 115, 22, 0.2)', color: '#fb923c', borderRadius: '20px', fontSize: '13px', fontWeight: '500' }}>
              {(cliente?.stakeholders || []).length} {(cliente?.stakeholders || []).length === 1 ? 'pessoa' : 'pessoas'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ padding: '4px 10px', background: 'rgba(249, 115, 22, 0.1)', color: '#f97316', borderRadius: '8px', fontSize: '11px' }}>
              Contatos de vendas/contratos
            </span>
            <button
              onClick={() => setShowStakeholderForm(!showStakeholderForm)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 14px', background: 'rgba(249, 115, 22, 0.15)',
                border: '1px solid rgba(249, 115, 22, 0.3)', borderRadius: '10px',
                color: '#fb923c', fontSize: '13px', fontWeight: '500', cursor: 'pointer'
              }}
            >
              <Plus style={{ width: '14px', height: '14px' }} />
              Adicionar
            </button>
          </div>
        </div>

        {/* Formulário inline para novo stakeholder */}
        {showStakeholderForm && (
          <div style={{ background: 'rgba(15, 10, 31, 0.6)', border: '1px solid rgba(249, 115, 22, 0.2)', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
              <input
                placeholder="Nome *"
                value={stakeholderForm.nome}
                onChange={e => setStakeholderForm(f => ({ ...f, nome: e.target.value }))}
                style={{ padding: '10px 14px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: 'white', fontSize: '13px', outline: 'none' }}
              />
              <input
                placeholder="Email *"
                value={stakeholderForm.email}
                onChange={e => setStakeholderForm(f => ({ ...f, email: e.target.value }))}
                style={{ padding: '10px 14px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: 'white', fontSize: '13px', outline: 'none' }}
              />
              <input
                placeholder="Cargo"
                value={stakeholderForm.cargo}
                onChange={e => setStakeholderForm(f => ({ ...f, cargo: e.target.value }))}
                style={{ padding: '10px 14px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: 'white', fontSize: '13px', outline: 'none' }}
              />
              <input
                placeholder="Telefone"
                value={stakeholderForm.telefone}
                onChange={e => setStakeholderForm(f => ({ ...f, telefone: e.target.value }))}
                style={{ padding: '10px 14px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: 'white', fontSize: '13px', outline: 'none' }}
              />
              <input
                placeholder="LinkedIn URL"
                value={stakeholderForm.linkedin_url}
                onChange={e => setStakeholderForm(f => ({ ...f, linkedin_url: e.target.value }))}
                style={{ padding: '10px 14px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: 'white', fontSize: '13px', outline: 'none' }}
              />
              <select
                value={stakeholderForm.tipo_contato}
                onChange={e => setStakeholderForm(f => ({ ...f, tipo_contato: e.target.value }))}
                style={{ padding: '10px 14px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: 'white', fontSize: '13px', outline: 'none' }}
              >
                {TIPOS_CONTATO.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowStakeholderForm(false); setStakeholderForm({ nome: '', email: '', cargo: '', telefone: '', linkedin_url: '', tipo_contato: 'outro' }); }}
                style={{ padding: '8px 16px', background: 'none', border: '1px solid rgba(100, 116, 139, 0.3)', borderRadius: '10px', color: '#94a3b8', fontSize: '13px', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveStakeholder}
                disabled={savingStakeholder}
                style={{ padding: '8px 16px', background: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)', border: 'none', borderRadius: '10px', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer', opacity: savingStakeholder ? 0.6 : 1 }}
              >
                {savingStakeholder ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        )}

        {cliente?.stakeholders && cliente.stakeholders.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
          {cliente.stakeholders.map((stakeholder, index) => {
            const tipoInfo = TIPOS_CONTATO.find(t => t.value === stakeholder.tipo_contato) || TIPOS_CONTATO[TIPOS_CONTATO.length - 1];
            return (
            <div
              key={stakeholder.id || index}
              style={{
                padding: '16px',
                background: 'rgba(15, 10, 31, 0.6)',
                border: '1px solid rgba(249, 115, 22, 0.15)',
                borderRadius: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{
                  width: '44px', height: '44px',
                  background: `linear-gradient(135deg, ${tipoInfo.color} 0%, ${tipoInfo.color}99 100%)`,
                  borderRadius: '10px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: '15px', fontWeight: '600', flexShrink: 0
                }}>
                  {getInitials(stakeholder.nome)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <p style={{ color: 'white', fontSize: '14px', fontWeight: '600', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {stakeholder.nome}
                    </p>
                    {stakeholder.tipo_contato && stakeholder.tipo_contato !== 'outro' && (
                      <span style={{
                        padding: '2px 8px',
                        background: `${tipoInfo.color}20`,
                        color: tipoInfo.color,
                        borderRadius: '8px', fontSize: '10px', fontWeight: '600', flexShrink: 0
                      }}>
                        {tipoInfo.label}
                      </span>
                    )}
                    <button
                      onClick={() => handleDeleteStakeholder(stakeholder.id, index)}
                      title="Remover stakeholder"
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
                        color: '#64748b', flexShrink: 0, display: 'flex', alignItems: 'center'
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                      onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
                    >
                      <Trash2 style={{ width: '14px', height: '14px' }} />
                    </button>
                  </div>
                  {stakeholder.cargo && (
                    <p style={{ color: '#f97316', fontSize: '12px', margin: '0 0 6px 0' }}>{stakeholder.cargo}</p>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <a href={`mailto:${stakeholder.email}`} style={{ color: '#94a3b8', fontSize: '12px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Mail style={{ width: '12px', height: '12px' }} />{stakeholder.email}
                    </a>
                    {stakeholder.telefone && (
                      <a href={`tel:${stakeholder.telefone}`} style={{ color: '#94a3b8', fontSize: '12px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Phone style={{ width: '12px', height: '12px' }} />{stakeholder.telefone}
                      </a>
                    )}
                    {stakeholder.linkedin_url && (
                      <a href={stakeholder.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ color: '#06b6d4', fontSize: '12px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Linkedin style={{ width: '12px', height: '12px' }} />LinkedIn
                        <ExternalLink style={{ width: '10px', height: '10px' }} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
            );
          })}
        </div>
        ) : (
          <div style={{ padding: '32px', textAlign: 'center' }}>
            <Star style={{ width: '32px', height: '32px', color: '#64748b', margin: '0 auto 8px' }} />
            <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>Nenhum stakeholder cadastrado.</p>
            <button
              onClick={() => setShowStakeholderForm(true)}
              style={{
                marginTop: '12px', padding: '8px 16px',
                background: 'rgba(249, 115, 22, 0.15)', border: '1px solid rgba(249, 115, 22, 0.3)',
                borderRadius: '10px', color: '#fb923c', fontSize: '13px', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: '6px'
              }}
            >
              <Plus style={{ width: '14px', height: '14px' }} />Adicionar primeiro stakeholder
            </button>
          </div>
        )}
      </div>
      )}

      {/* Contatos Sugeridos (extraídos das threads) */}
      {activeTab === 'pessoas' && suggestedContacts.length > 0 && (
      <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(6, 182, 212, 0.2)', borderRadius: '20px', padding: '24px', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Sparkles style={{ width: '20px', height: '20px', color: '#06b6d4' }} />
            <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>Contatos Sugeridos</h2>
            <span style={{ padding: '4px 12px', background: 'rgba(6, 182, 212, 0.2)', color: '#06b6d4', borderRadius: '20px', fontSize: '13px', fontWeight: '500' }}>
              {suggestedContacts.length}
            </span>
          </div>
          <span style={{ padding: '4px 10px', background: 'rgba(6, 182, 212, 0.1)', color: '#06b6d4', borderRadius: '8px', fontSize: '11px' }}>
            Extraído das conversas
          </span>
        </div>
        <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '12px', marginTop: 0 }}>
          Estas pessoas apareceram nas conversas deste cliente. Deseja adicioná-las como stakeholders?
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {suggestedContacts.slice(0, 10).map((contact) => (
            <div key={contact.email} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 16px', background: 'rgba(15, 10, 31, 0.6)',
              border: '1px solid rgba(6, 182, 212, 0.1)', borderRadius: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '36px', height: '36px', background: 'rgba(6, 182, 212, 0.2)',
                  borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#06b6d4', fontSize: '13px', fontWeight: '600'
                }}>
                  {getInitials(contact.nome || contact.email.split('@')[0])}
                </div>
                <div>
                  <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: '0 0 2px 0' }}>
                    {contact.nome || contact.email.split('@')[0]}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '12px' }}>{contact.email}</span>
                    <span style={{ color: '#64748b', fontSize: '11px' }}>
                      {contact.threadCount} {contact.threadCount === 1 ? 'conversa' : 'conversas'}
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleAddSuggestedContact(contact)}
                  style={{
                    padding: '6px 12px', background: 'rgba(16, 185, 129, 0.2)',
                    border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px',
                    color: '#10b981', fontSize: '12px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '4px'
                  }}
                >
                  <Plus style={{ width: '14px', height: '14px' }} />Adicionar
                </button>
                <button
                  onClick={() => handleDismissSuggestion(contact.email)}
                  style={{
                    padding: '6px 8px', background: 'none',
                    border: '1px solid rgba(100, 116, 139, 0.3)', borderRadius: '8px',
                    color: '#64748b', fontSize: '12px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center'
                  }}
                >
                  <X style={{ width: '14px', height: '14px' }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
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
                  Classificação por IA indisponível no momento.
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
                    onClick={() => { setSelectedThread(null); setShowManualClassification(false); setActiveTab('interacoes'); }}
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

              {/* Título */}
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

              {/* Comentários do ClickUp */}
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
