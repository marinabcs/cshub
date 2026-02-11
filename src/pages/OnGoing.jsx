import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { ClipboardList, Plus, X, Save, CheckCircle, RotateCcw, Users, Search, Calendar, Play, BookOpen, FileText, Mail, MessageSquare, Edit3, Trash2, Copy, ChevronDown, ChevronRight, Crown, Circle, Star } from 'lucide-react';
import { SEGMENTOS_CS, DEFAULT_ONGOING_ACOES, getClienteSegmento } from '../utils/segmentoCS';
import { atribuirCiclo, buscarCicloAtivo, ONGOING_STATUS, ACAO_STATUS } from '../services/ongoing';
import { TEMPLATES_ONGOING } from '../scripts/seedTemplates';
import { useUserActivityStatus, USER_ACTIVITY_CONFIG } from '../hooks/useUserActivityStatus';

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
  const [modalDataInicio, setModalDataInicio] = useState(new Date().toISOString().split('T')[0]);
  const [modalAcoes, setModalAcoes] = useState([]);
  const [modalNovaAcao, setModalNovaAcao] = useState('');
  const [atribuindo, setAtribuindo] = useState(false);

  // Templates state
  const [templates, setTemplates] = useState([]);
  const [templateSearch, setTemplateSearch] = useState('');
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [templateForm, setTemplateForm] = useState({
    titulo: '',
    tipo: 'email',
    categoria: 'estavel',
    assunto: '',
    conteudo: '',
    tags: []
  });
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [importingTemplates, setImportingTemplates] = useState(false);
  const [expandedSections, setExpandedSections] = useState({ resgate: false, alerta: false, estavel: false, crescimento: false });
  const [expandedTemplates, setExpandedTemplates] = useState({});
  const [copiedTemplateId, setCopiedTemplateId] = useState(null);

  // Seleção de destinatários
  const [showDestinatariosModal, setShowDestinatariosModal] = useState(false);
  const [clienteSearchDestinatarios, setClienteSearchDestinatarios] = useState('');
  const [clienteSelecionado, setClienteSelecionado] = useState(null);
  const [emailsSelecionados, setEmailsSelecionados] = useState([]);
  const [usuariosCliente, setUsuariosCliente] = useState([]);
  const [timesCliente, setTimesCliente] = useState({});
  const [loadingUsuarios, setLoadingUsuarios] = useState(false);

  // Hook para status de atividade dos usuários
  const teamIdsParaAtividade = clienteSelecionado?.times || (clienteSelecionado?.id ? [clienteSelecionado.id] : []);
  const { getStatus: getUserActivityStatus, loading: loadingActivityStatus } = useUserActivityStatus(teamIdsParaAtividade, usuariosCliente);

  // Buscar usuários do cliente selecionado
  const fetchUsuariosCliente = async (cliente) => {
    setLoadingUsuarios(true);
    try {
      // Pegar todos os IDs de times do cliente
      const timeIds = [...(cliente.times || [])];
      if (cliente.id && !timeIds.includes(cliente.id)) timeIds.push(cliente.id);

      if (timeIds.length === 0) {
        setUsuariosCliente([]);
        setTimesCliente({});
        return;
      }

      // Buscar nomes dos times
      const timesSnap = await getDocs(collection(db, 'times'));
      const timesMap = {};
      timesSnap.docs.forEach(d => {
        const data = d.data();
        timesMap[d.id] = data.name || data.nome || d.id;
      });
      setTimesCliente(timesMap);

      const usuariosSnap = await getDocs(collection(db, 'usuarios_lookup'));
      const usuarios = usuariosSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => {
          // Verificar se o usuário pertence a algum dos times do cliente
          if (u.team_id && timeIds.includes(u.team_id)) return true;
          if (Array.isArray(u.team_ids) && u.team_ids.some(tid => timeIds.includes(tid))) return true;
          return false;
        });
      setUsuariosCliente(usuarios);
    } catch (err) {
      console.error('Erro ao buscar usuários:', err);
      setUsuariosCliente([]);
      setTimesCliente({});
    } finally {
      setLoadingUsuarios(false);
    }
  };

  // Categorias de templates ordenadas por saúde (pior → melhor)
  const TEMPLATE_SAUDE_SECTIONS = [
    { key: 'resgate', label: 'Resgate', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.3)' },
    { key: 'alerta', label: 'Alerta', color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.3)' },
    { key: 'estavel', label: 'Estável', color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.15)', borderColor: 'rgba(59, 130, 246, 0.3)' },
    { key: 'crescimento', label: 'Crescimento', color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.3)' },
  ];

  const toggleSection = (key) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Função para importar templates padrão (exclui existentes primeiro)
  const handleImportTemplates = async () => {
    const confirmMsg = templates.length > 0
      ? `Isso vai EXCLUIR os ${templates.length} templates existentes e importar os padrões. Continuar?`
      : 'Importar todos os templates padrão do Playbook de Ongoing?';
    if (!window.confirm(confirmMsg)) return;
    setImportingTemplates(true);
    try {
      // Excluir templates existentes
      const { deleteDoc } = await import('firebase/firestore');
      for (const t of templates) {
        await deleteDoc(doc(db, 'templates_comunicacao', t.id));
      }

      // Importar novos
      const now = new Date();
      let count = 0;
      for (const template of TEMPLATES_ONGOING) {
        await setDoc(doc(db, 'templates_comunicacao', template.id), {
          titulo: template.titulo,
          tipo: template.tipo,
          categoria: template.categoria,
          assunto: template.assunto,
          conteudo: template.conteudo,
          tags: template.tags,
          created_at: now,
          created_by: user?.email || 'sistema',
          updated_at: now,
          updated_by: user?.email || 'sistema'
        });
        count++;
      }
      // Recarregar templates
      const templatesSnap = await getDocs(collection(db, 'templates_comunicacao'));
      setTemplates(templatesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      alert(`${count} templates importados com sucesso!`);
    } catch (err) {
      console.error('Erro ao importar templates:', err);
      alert('Erro ao importar templates');
    } finally {
      setImportingTemplates(false);
    }
  };

  // Constantes de templates
  const TEMPLATE_TIPOS = [
    { value: 'email', label: 'E-mail', icon: Mail },
    { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
    { value: 'documento', label: 'Documento', icon: FileText }
  ];

  const TEMPLATE_CATEGORIAS = [
    { value: 'resgate', label: 'Resgate' },
    { value: 'alerta', label: 'Alerta' },
    { value: 'estavel', label: 'Estável' },
    { value: 'crescimento', label: 'Crescimento' }
  ];


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
        // Buscar config e clientes (essenciais)
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

        // Templates (separado para não bloquear clientes se a coleção não existir)
        try {
          const templatesSnap = await getDocs(collection(db, 'templates_comunicacao'));
          const templatesData = templatesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          setTemplates(templatesData);
        } catch (templatesErr) {
          console.log('Coleção templates_comunicacao não encontrada ou sem permissão');
          setTemplates([]);
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

  // ============ TEMPLATES HANDLERS ============
  const handleSaveTemplate = async () => {
    if (!templateForm.titulo.trim() || !templateForm.conteudo.trim()) return;
    setSavingTemplate(true);
    try {
      const templateData = {
        ...templateForm,
        titulo: templateForm.titulo.trim(),
        conteudo: templateForm.conteudo.trim(),
        assunto: templateForm.assunto?.trim() || '',
        updated_at: new Date(),
        updated_by: user?.email || ''
      };

      if (editingTemplate) {
        // Update
        await setDoc(doc(db, 'templates_comunicacao', editingTemplate.id), templateData, { merge: true });
        setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? { ...t, ...templateData } : t));
      } else {
        // Create
        const newId = `template_${Date.now()}`;
        templateData.created_at = new Date();
        templateData.created_by = user?.email || '';
        await setDoc(doc(db, 'templates_comunicacao', newId), templateData);
        setTemplates(prev => [...prev, { id: newId, ...templateData }]);
      }

      setShowTemplateForm(false);
      setEditingTemplate(null);
      setTemplateForm({ titulo: '', tipo: 'email', categoria: 'estavel', assunto: '', conteudo: '', tags: [] });
    } catch (err) {
      console.error('Erro ao salvar template:', err);
      alert('Erro ao salvar template');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleEditTemplate = (template) => {
    setEditingTemplate(template);
    setTemplateForm({
      titulo: template.titulo || '',
      tipo: template.tipo || 'email',
      categoria: template.categoria || 'ongoing',
      assunto: template.assunto || '',
      conteudo: template.conteudo || '',
      tags: template.tags || []
    });
    setShowTemplateForm(true);
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!window.confirm('Tem certeza que deseja excluir este template?')) return;
    try {
      const { deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'templates_comunicacao', templateId));
      setTemplates(prev => prev.filter(t => t.id !== templateId));
    } catch (err) {
      console.error('Erro ao excluir template:', err);
    }
  };

  const handleCopyTemplate = (template, onlyBody = false) => {
    const texto = onlyBody
      ? template.conteudo
      : template.tipo === 'email'
        ? `Assunto: ${template.assunto}\n\n${template.conteudo}`
        : template.conteudo;
    navigator.clipboard.writeText(texto);
    setCopiedTemplateId(template.id);
    setTimeout(() => setCopiedTemplateId(null), 2000);
  };

  const toggleTemplateExpanded = (templateId) => {
    setExpandedTemplates(prev => ({ ...prev, [templateId]: !prev[templateId] }));
  };

  // Contexto/momento para cada categoria
  const TEMPLATE_CONTEXTO = {
    resgate: { objetivo: 'Reverter situação crítica', momento: 'Cliente com risco iminente de churn', tom: 'Urgente mas acolhedor' },
    alerta: { objetivo: 'Prevenir queda para resgate', momento: 'Sinais de desengajamento', tom: 'Proativo e atencioso' },
    estavel: { objetivo: 'Manter relacionamento saudável', momento: 'Check-ins mensais', tom: 'Amigável e consultivo' },
    crescimento: { objetivo: 'Expandir uso e valor', momento: 'Cliente engajado e satisfeito', tom: 'Entusiasmado e estratégico' }
  };

  const templatesFiltrados = templates
    .filter(t => {
      if (templateSearch) {
        const search = templateSearch.toLowerCase();
        return (t.titulo || '').toLowerCase().includes(search) ||
               (t.assunto || '').toLowerCase().includes(search) ||
               (t.conteudo || '').toLowerCase().includes(search);
      }
      return true;
    })
    .sort((a, b) => (a.titulo || '').localeCompare(b.titulo || ''));

  // Agrupar templates por seção de saúde
  const getTemplatesBySection = (sectionKey) => {
    return templatesFiltrados.filter(t => t.categoria === sectionKey);
  };

  // ============ MODAL HANDLERS ============
  const abrirModal = (cliente) => {
    const seg = getClienteSegmento(cliente) || 'ESTAVEL';
    setModalCliente(cliente);
    setModalSegmento(seg);
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
    { id: 'templates', label: 'Templates', icon: FileText },
    { id: 'playbook', label: 'Playbook', icon: BookOpen },
    { id: 'config', label: 'Ações Padrão', icon: ClipboardList },
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
                                width: '50px', padding: '4px 6px', background: '#0f0a1f',
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
                            width: '50px', padding: '8px 6px', background: '#0f0a1f',
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

      {/* ====== ABA TEMPLATES ====== */}
      {activeTab === 'templates' && (
        <div>
          {/* Header + Filtros */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: 1 }}>
              <div style={{ position: 'relative', minWidth: '280px', flex: 1, maxWidth: '400px' }}>
                <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#64748b' }} />
                <input
                  type="text"
                  placeholder="Buscar template..."
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px 10px 38px', background: 'rgba(15, 10, 31, 0.6)',
                    border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '10px',
                    color: 'white', fontSize: '14px', outline: 'none'
                  }}
                />
              </div>
              {/* Botão Copiar Destinatários */}
              <button
                onClick={() => setShowDestinatariosModal(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 16px',
                  background: 'rgba(6, 182, 212, 0.15)',
                  border: '1px solid rgba(6, 182, 212, 0.3)',
                  borderRadius: '10px', cursor: 'pointer'
                }}
              >
                <Users style={{ width: '16px', height: '16px', color: '#06b6d4' }} />
                <span style={{ color: '#06b6d4', fontSize: '13px', fontWeight: '600' }}>Destinatários</span>
              </button>
            </div>
            {isAdmin && (
              <button
                onClick={() => {
                  setEditingTemplate(null);
                  setTemplateForm({ titulo: '', tipo: 'email', categoria: 'estavel', assunto: '', conteudo: '', tags: [] });
                  setShowTemplateForm(true);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 20px', background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                  border: 'none', borderRadius: '12px', color: 'white',
                  fontSize: '14px', fontWeight: '600', cursor: 'pointer'
                }}
              >
                <Plus style={{ width: '16px', height: '16px' }} />
                Novo Template
              </button>
            )}
          </div>

          {/* Templates por Seção com Cards Expansíveis */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {TEMPLATE_SAUDE_SECTIONS.map(section => {
              const sectionTemplates = getTemplatesBySection(section.key);
              const isExpanded = expandedSections[section.key];
              const contexto = TEMPLATE_CONTEXTO[section.key];

              if (sectionTemplates.length === 0 && templateSearch) return null;

              return (
                <div key={section.key}>
                  {/* Header da seção */}
                  <button
                    onClick={() => toggleSection(section.key)}
                    style={{
                      width: '100%', padding: '16px 20px',
                      background: `linear-gradient(135deg, ${section.bgColor} 0%, rgba(15, 10, 31, 0.8) 100%)`,
                      border: `1px solid ${section.borderColor}`,
                      borderRadius: isExpanded ? '16px 16px 0 0' : '16px',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '16px'
                    }}
                  >
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '12px',
                      background: `${section.color}20`, border: `1px solid ${section.color}40`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {isExpanded ? (
                        <ChevronDown style={{ width: '20px', height: '20px', color: section.color }} />
                      ) : (
                        <ChevronRight style={{ width: '20px', height: '20px', color: section.color }} />
                      )}
                    </div>
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <h3 style={{ color: section.color, fontSize: '16px', fontWeight: '700', margin: 0 }}>
                        {section.label}
                      </h3>
                      <p style={{ color: '#94a3b8', fontSize: '12px', margin: '4px 0 0 0' }}>
                        {contexto?.objetivo}
                      </p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{
                        padding: '6px 14px', background: `${section.color}25`,
                        borderRadius: '20px', fontSize: '13px', color: section.color, fontWeight: '600'
                      }}>
                        {sectionTemplates.length} {sectionTemplates.length === 1 ? 'template' : 'templates'}
                      </span>
                    </div>
                  </button>

                  {/* Lista de templates expandida */}
                  {isExpanded && (
                    <div style={{
                      background: 'rgba(15, 10, 31, 0.4)',
                      border: `1px solid ${section.borderColor}`,
                      borderTop: 'none',
                      borderRadius: '0 0 16px 16px',
                      padding: '16px'
                    }}>
                      {/* Contexto da categoria */}
                      <div style={{
                        display: 'flex', gap: '16px', marginBottom: '16px', padding: '12px 16px',
                        background: 'rgba(30, 27, 75, 0.5)', borderRadius: '10px',
                        border: '1px solid rgba(139, 92, 246, 0.1)'
                      }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ color: '#64748b', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>Momento</span>
                          <p style={{ color: '#e2e8f0', fontSize: '13px', margin: '4px 0 0 0' }}>{contexto?.momento}</p>
                        </div>
                        <div style={{ width: '1px', background: 'rgba(139, 92, 246, 0.2)' }} />
                        <div style={{ flex: 1 }}>
                          <span style={{ color: '#64748b', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>Tom</span>
                          <p style={{ color: '#e2e8f0', fontSize: '13px', margin: '4px 0 0 0' }}>{contexto?.tom}</p>
                        </div>
                      </div>

                      {sectionTemplates.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {sectionTemplates.map((template) => {
                            const TipoIcon = TEMPLATE_TIPOS.find(t => t.value === template.tipo)?.icon || FileText;
                            const isTemplateExpanded = expandedTemplates[template.id];
                            const isCopied = copiedTemplateId === template.id;

                            return (
                              <div key={template.id} style={{
                                background: 'rgba(30, 27, 75, 0.6)',
                                border: `1px solid ${isTemplateExpanded ? section.borderColor : 'rgba(139, 92, 246, 0.1)'}`,
                                borderRadius: '12px',
                                overflow: 'hidden',
                                transition: 'border-color 0.2s'
                              }}>
                                {/* Header do template */}
                                <button
                                  onClick={() => toggleTemplateExpanded(template.id)}
                                  style={{
                                    width: '100%', padding: '14px 16px',
                                    background: isTemplateExpanded ? 'rgba(139, 92, 246, 0.08)' : 'transparent',
                                    border: 'none', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '12px'
                                  }}
                                >
                                  {/* Ícone tipo */}
                                  <div style={{
                                    width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                                    background: template.tipo === 'email' ? 'rgba(59, 130, 246, 0.15)' : template.tipo === 'whatsapp' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(139, 92, 246, 0.15)',
                                    border: `1px solid ${template.tipo === 'email' ? 'rgba(59, 130, 246, 0.3)' : template.tipo === 'whatsapp' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(139, 92, 246, 0.3)'}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                  }}>
                                    <TipoIcon style={{ width: '18px', height: '18px', color: template.tipo === 'email' ? '#3b82f6' : template.tipo === 'whatsapp' ? '#10b981' : '#8b5cf6' }} />
                                  </div>

                                  {/* Info */}
                                  <div style={{ flex: 1, textAlign: 'left' }}>
                                    <p style={{ color: 'white', fontSize: '14px', fontWeight: '600', margin: 0 }}>
                                      {template.titulo}
                                    </p>
                                    {template.assunto && (
                                      <p style={{ color: '#64748b', fontSize: '12px', margin: '4px 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {template.assunto}
                                      </p>
                                    )}
                                  </div>

                                  {/* Tipo badge */}
                                  <span style={{
                                    padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600',
                                    background: template.tipo === 'email' ? 'rgba(59, 130, 246, 0.2)' : template.tipo === 'whatsapp' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(139, 92, 246, 0.2)',
                                    color: template.tipo === 'email' ? '#3b82f6' : template.tipo === 'whatsapp' ? '#10b981' : '#8b5cf6'
                                  }}>
                                    {template.tipo === 'email' ? 'E-mail' : template.tipo === 'whatsapp' ? 'WhatsApp' : 'Doc'}
                                  </span>

                                  {/* Chevron */}
                                  {isTemplateExpanded ? (
                                    <ChevronDown style={{ width: '18px', height: '18px', color: '#64748b' }} />
                                  ) : (
                                    <ChevronRight style={{ width: '18px', height: '18px', color: '#64748b' }} />
                                  )}
                                </button>

                                {/* Conteúdo expandido */}
                                {isTemplateExpanded && (
                                  <div style={{ padding: '0 16px 16px 16px' }}>
                                    {/* Preview do email */}
                                    <div style={{
                                      background: '#0f0a1f',
                                      border: '1px solid rgba(139, 92, 246, 0.2)',
                                      borderRadius: '10px',
                                      overflow: 'hidden',
                                      marginBottom: '12px'
                                    }}>
                                      {/* Header do preview */}
                                      {template.tipo === 'email' && template.assunto && (
                                        <div style={{
                                          padding: '12px 16px',
                                          background: 'rgba(139, 92, 246, 0.08)',
                                          borderBottom: '1px solid rgba(139, 92, 246, 0.15)'
                                        }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                            <span style={{ color: '#64748b', fontSize: '11px', fontWeight: '600' }}>ASSUNTO:</span>
                                          </div>
                                          <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: 0 }}>
                                            {template.assunto}
                                          </p>
                                        </div>
                                      )}
                                      {/* Corpo */}
                                      <div style={{ padding: '16px' }}>
                                        <pre style={{
                                          color: '#e2e8f0', fontSize: '13px', lineHeight: '1.6',
                                          margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                          fontFamily: 'inherit', maxHeight: '300px', overflowY: 'auto'
                                        }}>
                                          {template.conteudo}
                                        </pre>
                                      </div>
                                    </div>

                                    {/* Ações */}
                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                      {isAdmin && (
                                        <>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(template.id); }}
                                            style={{
                                              display: 'flex', alignItems: 'center', gap: '6px',
                                              padding: '8px 14px', background: 'rgba(239, 68, 68, 0.15)',
                                              border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px',
                                              color: '#ef4444', fontSize: '12px', fontWeight: '600', cursor: 'pointer'
                                            }}
                                          >
                                            <Trash2 style={{ width: '14px', height: '14px' }} />
                                            Excluir
                                          </button>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); handleEditTemplate(template); }}
                                            style={{
                                              display: 'flex', alignItems: 'center', gap: '6px',
                                              padding: '8px 14px', background: 'rgba(139, 92, 246, 0.15)',
                                              border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '8px',
                                              color: '#8b5cf6', fontSize: '12px', fontWeight: '600', cursor: 'pointer'
                                            }}
                                          >
                                            <Edit3 style={{ width: '14px', height: '14px' }} />
                                            Editar
                                          </button>
                                        </>
                                      )}
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleCopyTemplate(template); }}
                                        style={{
                                          display: 'flex', alignItems: 'center', gap: '6px',
                                          padding: '8px 16px',
                                          background: isCopied ? 'rgba(16, 185, 129, 0.2)' : 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                                          border: isCopied ? '1px solid rgba(16, 185, 129, 0.4)' : 'none',
                                          borderRadius: '8px',
                                          color: 'white', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                                          transition: 'all 0.2s'
                                        }}
                                      >
                                        {isCopied ? (
                                          <>
                                            <CheckCircle style={{ width: '14px', height: '14px' }} />
                                            Copiado!
                                          </>
                                        ) : (
                                          <>
                                            <Copy style={{ width: '14px', height: '14px' }} />
                                            Copiar Template
                                          </>
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '30px' }}>
                          <FileText style={{ width: '32px', height: '32px', color: '#475569', marginBottom: '12px' }} />
                          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
                            Nenhum template nesta categoria
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Tabela de referência rápida */}
          {templatesFiltrados.length > 0 && !templateSearch && (
            <div style={{ marginTop: '32px' }}>
              <h3 style={{ color: '#94a3b8', fontSize: '13px', fontWeight: '600', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Referência Rápida
              </h3>
              <div style={{
                background: 'rgba(30, 27, 75, 0.4)',
                border: '1px solid rgba(139, 92, 246, 0.15)',
                borderRadius: '12px',
                overflow: 'hidden'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'rgba(139, 92, 246, 0.08)' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', color: '#94a3b8', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', borderBottom: '1px solid rgba(139, 92, 246, 0.15)' }}>Template</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', color: '#94a3b8', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', borderBottom: '1px solid rgba(139, 92, 246, 0.15)', width: '100px' }}>Tipo</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', color: '#94a3b8', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', borderBottom: '1px solid rgba(139, 92, 246, 0.15)', width: '120px' }}>Categoria</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', borderBottom: '1px solid rgba(139, 92, 246, 0.15)', width: '80px' }}>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templatesFiltrados.slice(0, 10).map((template, idx) => {
                      const section = TEMPLATE_SAUDE_SECTIONS.find(s => s.key === template.categoria);
                      return (
                        <tr key={template.id} style={{ background: idx % 2 === 0 ? 'transparent' : 'rgba(15, 10, 31, 0.3)' }}>
                          <td style={{ padding: '10px 16px', color: '#e2e8f0', fontSize: '13px', borderBottom: '1px solid rgba(139, 92, 246, 0.05)' }}>
                            {template.titulo}
                          </td>
                          <td style={{ padding: '10px 16px', borderBottom: '1px solid rgba(139, 92, 246, 0.05)' }}>
                            <span style={{
                              padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '500',
                              background: template.tipo === 'email' ? 'rgba(59, 130, 246, 0.15)' : template.tipo === 'whatsapp' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(139, 92, 246, 0.15)',
                              color: template.tipo === 'email' ? '#3b82f6' : template.tipo === 'whatsapp' ? '#10b981' : '#8b5cf6'
                            }}>
                              {template.tipo === 'email' ? 'E-mail' : template.tipo === 'whatsapp' ? 'WhatsApp' : 'Doc'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 16px', borderBottom: '1px solid rgba(139, 92, 246, 0.05)' }}>
                            <span style={{
                              padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '500',
                              background: section?.bgColor || 'rgba(139, 92, 246, 0.15)',
                              color: section?.color || '#8b5cf6'
                            }}>
                              {section?.label || template.categoria}
                            </span>
                          </td>
                          <td style={{ padding: '10px 16px', textAlign: 'center', borderBottom: '1px solid rgba(139, 92, 246, 0.05)' }}>
                            <button
                              onClick={() => handleCopyTemplate(template)}
                              style={{
                                padding: '6px 10px',
                                background: copiedTemplateId === template.id ? 'rgba(16, 185, 129, 0.2)' : 'rgba(139, 92, 246, 0.15)',
                                border: 'none', borderRadius: '6px', cursor: 'pointer',
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                transition: 'all 0.2s'
                              }}
                            >
                              {copiedTemplateId === template.id ? (
                                <CheckCircle style={{ width: '12px', height: '12px', color: '#10b981' }} />
                              ) : (
                                <Copy style={{ width: '12px', height: '12px', color: '#8b5cf6' }} />
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ====== MODAL DESTINATÁRIOS ====== */}
      {showDestinatariosModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => {
          setShowDestinatariosModal(false);
          setClienteSelecionado(null);
          setClienteSearchDestinatarios('');
          setEmailsSelecionados([]);
          setUsuariosCliente([]);
          setTimesCliente({});
        }}>
          <div style={{
            background: '#1e1b4b', border: '1px solid rgba(6, 182, 212, 0.3)',
            borderRadius: '20px', padding: '24px', width: '500px', maxHeight: '80vh',
            overflowY: 'auto'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Mail style={{ width: '20px', height: '20px', color: '#06b6d4' }} />
                Copiar Destinatários
              </h2>
              <button
                onClick={() => {
                  setShowDestinatariosModal(false);
                  setClienteSelecionado(null);
                  setClienteSearchDestinatarios('');
                  setEmailsSelecionados([]);
                  setUsuariosCliente([]);
                  setTimesCliente({});
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
              >
                <X style={{ width: '20px', height: '20px', color: '#64748b' }} />
              </button>
            </div>

            {/* Busca de cliente */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
                Selecione o cliente
              </label>
              <div style={{ position: 'relative' }}>
                <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#64748b' }} />
                <input
                  type="text"
                  placeholder="Buscar cliente..."
                  value={clienteSearchDestinatarios}
                  onChange={(e) => {
                    setClienteSearchDestinatarios(e.target.value);
                    if (!e.target.value) {
                      setClienteSelecionado(null);
                      setEmailsSelecionados([]);
                      setUsuariosCliente([]);
                      setTimesCliente({});
                    }
                  }}
                  style={{
                    width: '100%', padding: '10px 12px 10px 38px', background: '#0f0a1f',
                    border: '1px solid rgba(6, 182, 212, 0.3)', borderRadius: '10px',
                    color: 'white', fontSize: '14px', outline: 'none'
                  }}
                />
              </div>

              {/* Lista de clientes filtrados */}
              {clienteSearchDestinatarios && !clienteSelecionado && (
                <div style={{
                  marginTop: '4px', background: '#0f0a1f', border: '1px solid rgba(6, 182, 212, 0.2)',
                  borderRadius: '10px', maxHeight: '180px', overflowY: 'auto'
                }}>
                  {clientes
                    .filter(c => {
                      const nome = (c.nome || c.name || '').toLowerCase();
                      return nome.includes(clienteSearchDestinatarios.toLowerCase());
                    })
                    .slice(0, 10)
                    .map(c => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setClienteSelecionado(c);
                          setClienteSearchDestinatarios(c.nome || c.name);
                          setEmailsSelecionados([]);
                          fetchUsuariosCliente(c);
                        }}
                        style={{
                          width: '100%', padding: '10px 14px', background: 'transparent',
                          border: 'none', borderBottom: '1px solid rgba(6, 182, 212, 0.1)',
                          color: '#e2e8f0', fontSize: '14px', textAlign: 'left', cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => e.target.style.background = 'rgba(6, 182, 212, 0.1)'}
                        onMouseLeave={(e) => e.target.style.background = 'transparent'}
                      >
                        {c.nome || c.name}
                      </button>
                    ))
                  }
                  {clientes.filter(c => (c.nome || c.name || '').toLowerCase().includes(clienteSearchDestinatarios.toLowerCase())).length === 0 && (
                    <p style={{ padding: '12px 14px', color: '#64748b', fontSize: '13px', margin: 0 }}>
                      Nenhum cliente encontrado
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Lista de contatos do cliente selecionado */}
            {clienteSelecionado && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '600' }}>
                    Contatos de {clienteSelecionado.nome || clienteSelecionado.name}
                  </span>
                  {emailsSelecionados.length > 0 && (
                    <span style={{ color: '#06b6d4', fontSize: '12px', fontWeight: '600' }}>
                      {emailsSelecionados.length} selecionado{emailsSelecionados.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {/* Selecionar Todos */}
                {((clienteSelecionado.stakeholders || []).length > 0 || usuariosCliente.length > 0) && !loadingUsuarios && (
                  <button
                    onClick={() => {
                      const todosEmails = [
                        ...(clienteSelecionado.stakeholders || []).map(s => s.email).filter(Boolean),
                        ...usuariosCliente.map(u => u.email).filter(Boolean)
                      ];
                      const todosJaSelecionados = todosEmails.every(e => emailsSelecionados.includes(e));
                      if (todosJaSelecionados) {
                        setEmailsSelecionados([]);
                      } else {
                        setEmailsSelecionados([...new Set(todosEmails)]);
                      }
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '8px 12px', marginBottom: '10px',
                      background: 'rgba(139, 92, 246, 0.15)',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                      borderRadius: '8px', cursor: 'pointer', width: '100%'
                    }}
                  >
                    <div style={{
                      width: '16px', height: '16px', borderRadius: '4px',
                      border: `2px solid #8b5cf6`,
                      background: (() => {
                        const todosEmails = [
                          ...(clienteSelecionado.stakeholders || []).map(s => s.email).filter(Boolean),
                          ...usuariosCliente.map(u => u.email).filter(Boolean)
                        ];
                        return todosEmails.length > 0 && todosEmails.every(e => emailsSelecionados.includes(e)) ? '#8b5cf6' : 'transparent';
                      })(),
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {(() => {
                        const todosEmails = [
                          ...(clienteSelecionado.stakeholders || []).map(s => s.email).filter(Boolean),
                          ...usuariosCliente.map(u => u.email).filter(Boolean)
                        ];
                        return todosEmails.length > 0 && todosEmails.every(e => emailsSelecionados.includes(e)) && (
                          <CheckCircle style={{ width: '10px', height: '10px', color: 'white' }} />
                        );
                      })()}
                    </div>
                    <span style={{ color: '#8b5cf6', fontSize: '13px', fontWeight: '600' }}>
                      Selecionar todos
                    </span>
                  </button>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px', maxHeight: '300px', overflowY: 'auto' }}>
                  {/* Stakeholders (com coroa) */}
                  {(clienteSelecionado.stakeholders || []).map((s, idx) => {
                    const isSelected = emailsSelecionados.includes(s.email);
                    return (
                      <button
                        key={`stake-${idx}`}
                        onClick={() => {
                          if (isSelected) {
                            setEmailsSelecionados(prev => prev.filter(e => e !== s.email));
                          } else {
                            setEmailsSelecionados(prev => [...prev, s.email]);
                          }
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '10px 12px',
                          background: isSelected ? 'rgba(6, 182, 212, 0.15)' : 'rgba(15, 10, 31, 0.6)',
                          border: `1px solid ${isSelected ? '#06b6d4' : 'rgba(100, 116, 139, 0.2)'}`,
                          borderRadius: '8px', cursor: 'pointer', textAlign: 'left'
                        }}
                      >
                        <Star style={{ width: '14px', height: '14px', color: '#f59e0b', fill: '#f59e0b', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ color: isSelected ? 'white' : '#e2e8f0', fontSize: '13px', fontWeight: '500', margin: 0 }}>
                            {s.nome}
                          </p>
                          <p style={{ color: '#64748b', fontSize: '11px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {s.email}
                          </p>
                        </div>
                        <span style={{ color: '#8b5cf6', fontSize: '10px', fontWeight: '600', padding: '2px 6px', background: 'rgba(139, 92, 246, 0.2)', borderRadius: '4px', flexShrink: 0 }}>
                          Stakeholder
                        </span>
                        <div style={{
                          width: '18px', height: '18px', borderRadius: '4px',
                          border: `2px solid ${isSelected ? '#06b6d4' : '#475569'}`,
                          background: isSelected ? '#06b6d4' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          {isSelected && <CheckCircle style={{ width: '12px', height: '12px', color: 'white' }} />}
                        </div>
                      </button>
                    );
                  })}

                  {/* Usuários (com bolinha verde/cinza) */}
                  {loadingUsuarios || loadingActivityStatus ? (
                    <p style={{ color: '#64748b', fontSize: '12px', padding: '10px', textAlign: 'center' }}>
                      Carregando usuários...
                    </p>
                  ) : (
                    usuariosCliente.map((u, idx) => {
                      const isSelected = emailsSelecionados.includes(u.email);
                      const activityStatus = getUserActivityStatus(u.email);
                      const isHeavyUser = activityStatus === 'heavy_user';
                      const isActive = activityStatus === 'active' || isHeavyUser;
                      // Priorizar team_name do usuário, depois buscar no mapa de times
                      const rawTeamName = u.team_name || timesCliente[u.team_id] || '';
                      // Só mostrar se for um nome real (não um ID)
                      const teamName = rawTeamName && !rawTeamName.match(/^[a-f0-9]{20,}$/i) ? rawTeamName : '';
                      return (
                        <button
                          key={`user-${idx}`}
                          onClick={() => {
                            if (isSelected) {
                              setEmailsSelecionados(prev => prev.filter(e => e !== u.email));
                            } else {
                              setEmailsSelecionados(prev => [...prev, u.email]);
                            }
                          }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '10px 12px',
                            background: isSelected ? 'rgba(6, 182, 212, 0.15)' : 'rgba(15, 10, 31, 0.6)',
                            border: `1px solid ${isSelected ? '#06b6d4' : 'rgba(100, 116, 139, 0.2)'}`,
                            borderRadius: '8px', cursor: 'pointer', textAlign: 'left'
                          }}
                        >
                          {isHeavyUser ? (
                            <Crown style={{ width: '14px', height: '14px', flexShrink: 0, color: '#8b5cf6' }} />
                          ) : (
                            <Circle style={{
                              width: '14px', height: '14px', flexShrink: 0,
                              color: isActive ? '#10b981' : '#64748b',
                              fill: isActive ? '#10b981' : '#64748b'
                            }} />
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ color: isSelected ? 'white' : '#e2e8f0', fontSize: '13px', fontWeight: '500', margin: 0 }}>
                              {u.name || u.email?.split('@')[0]}
                            </p>
                            <p style={{ color: '#64748b', fontSize: '11px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {u.email}
                            </p>
                          </div>
                          {teamName && (
                            <span style={{ color: '#64748b', fontSize: '10px', fontWeight: '500', padding: '2px 6px', background: 'rgba(100, 116, 139, 0.2)', borderRadius: '4px', flexShrink: 0, maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {teamName}
                            </span>
                          )}
                          <div style={{
                            width: '18px', height: '18px', borderRadius: '4px',
                            border: `2px solid ${isSelected ? '#06b6d4' : '#475569'}`,
                            background: isSelected ? '#06b6d4' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                            {isSelected && <CheckCircle style={{ width: '12px', height: '12px', color: 'white' }} />}
                          </div>
                        </button>
                      );
                    })
                  )}

                  {/* Mensagem se não houver contatos */}
                  {(clienteSelecionado.stakeholders || []).length === 0 && usuariosCliente.length === 0 && !loadingUsuarios && (
                    <p style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
                      Nenhum contato encontrado para este cliente
                    </p>
                  )}
                </div>

                {/* Legenda */}
                <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', padding: '10px', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '8px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Star style={{ width: '12px', height: '12px', color: '#f59e0b', fill: '#f59e0b' }} />
                    <span style={{ color: '#94a3b8', fontSize: '11px' }}>Stakeholder</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Crown style={{ width: '12px', height: '12px', color: '#8b5cf6' }} />
                    <span style={{ color: '#94a3b8', fontSize: '11px' }}>Heavy User</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Circle style={{ width: '12px', height: '12px', color: '#10b981', fill: '#10b981' }} />
                    <span style={{ color: '#94a3b8', fontSize: '11px' }}>Ativo</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Circle style={{ width: '12px', height: '12px', color: '#64748b', fill: '#64748b' }} />
                    <span style={{ color: '#94a3b8', fontSize: '11px' }}>Inativo</span>
                  </div>
                </div>

                {/* Botão Copiar */}
                <button
                  onClick={() => {
                    if (emailsSelecionados.length === 0) {
                      alert('Selecione pelo menos um destinatário');
                      return;
                    }
                    navigator.clipboard.writeText(emailsSelecionados.join(', '));
                    alert(`${emailsSelecionados.length} e-mail(s) copiado(s)!`);
                    setShowDestinatariosModal(false);
                    setClienteSelecionado(null);
                    setClienteSearchDestinatarios('');
                    setEmailsSelecionados([]);
                    setUsuariosCliente([]);
                    setTimesCliente({});
                  }}
                  disabled={emailsSelecionados.length === 0}
                  style={{
                    width: '100%', padding: '12px',
                    background: emailsSelecionados.length > 0 ? 'linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%)' : 'rgba(100, 116, 139, 0.3)',
                    border: 'none', borderRadius: '10px',
                    color: 'white', fontSize: '14px', fontWeight: '600',
                    cursor: emailsSelecionados.length > 0 ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                  }}
                >
                  <Copy style={{ width: '16px', height: '16px' }} />
                  Copiar {emailsSelecionados.length > 0 ? `${emailsSelecionados.length} e-mail(s)` : 'e-mails'}
                </button>
              </div>
            )}

            {/* Mensagem inicial */}
            {!clienteSelecionado && !clienteSearchDestinatarios && (
              <p style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '20px' }}>
                Busque um cliente para ver seus contatos
              </p>
            )}
          </div>
        </div>
      )}

      {/* ====== MODAL TEMPLATE ====== */}
      {showTemplateForm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setShowTemplateForm(false)}>
          <div style={{
            background: '#1e1b4b', border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '20px', padding: '32px', width: '640px', maxHeight: '85vh',
            overflowY: 'auto'
          }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ color: 'white', fontSize: '20px', fontWeight: '700', margin: '0 0 24px 0' }}>
              {editingTemplate ? 'Editar Template' : 'Novo Template'}
            </h2>

            {/* Título */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ color: '#94a3b8', fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Título</label>
              <input
                type="text"
                value={templateForm.titulo}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, titulo: e.target.value }))}
                placeholder="Nome do template..."
                style={{
                  width: '100%', padding: '10px 14px', background: '#0f0a1f',
                  border: '1px solid #3730a3', borderRadius: '10px', color: 'white',
                  fontSize: '14px', outline: 'none'
                }}
              />
            </div>

            {/* Tipo e Categoria */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Tipo</label>
                <select
                  value={templateForm.tipo}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, tipo: e.target.value }))}
                  style={{
                    width: '100%', padding: '10px 14px', background: '#0f0a1f',
                    border: '1px solid #3730a3', borderRadius: '10px', color: 'white',
                    fontSize: '14px', outline: 'none'
                  }}
                >
                  {TEMPLATE_TIPOS.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Categoria</label>
                <select
                  value={templateForm.categoria}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, categoria: e.target.value }))}
                  style={{
                    width: '100%', padding: '10px 14px', background: '#0f0a1f',
                    border: '1px solid #3730a3', borderRadius: '10px', color: 'white',
                    fontSize: '14px', outline: 'none'
                  }}
                >
                  {TEMPLATE_CATEGORIAS.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Assunto (só para email) */}
            {templateForm.tipo === 'email' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ color: '#94a3b8', fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Assunto</label>
                <input
                  type="text"
                  value={templateForm.assunto}
                  onChange={(e) => setTemplateForm(prev => ({ ...prev, assunto: e.target.value }))}
                  placeholder="Assunto do e-mail..."
                  style={{
                    width: '100%', padding: '10px 14px', background: '#0f0a1f',
                    border: '1px solid #3730a3', borderRadius: '10px', color: 'white',
                    fontSize: '14px', outline: 'none'
                  }}
                />
              </div>
            )}

            {/* Conteúdo */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ color: '#94a3b8', fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
                Conteúdo
                <span style={{ color: '#64748b', fontWeight: '400', marginLeft: '8px' }}>
                  (use {'{{nome_cliente}}'}, {'{{nome_cs}}'} para variáveis)
                </span>
              </label>
              <textarea
                value={templateForm.conteudo}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, conteudo: e.target.value }))}
                placeholder="Digite o conteúdo do template..."
                rows={10}
                style={{
                  width: '100%', padding: '12px 14px', background: '#0f0a1f',
                  border: '1px solid #3730a3', borderRadius: '10px', color: 'white',
                  fontSize: '14px', outline: 'none', resize: 'vertical', lineHeight: '1.5'
                }}
              />
            </div>

            {/* Botões */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowTemplateForm(false)}
                style={{
                  padding: '10px 20px', background: 'rgba(100, 116, 139, 0.2)',
                  border: '1px solid rgba(100, 116, 139, 0.3)', borderRadius: '12px',
                  color: '#94a3b8', fontSize: '14px', fontWeight: '500', cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={savingTemplate || !templateForm.titulo.trim() || !templateForm.conteudo.trim()}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 24px',
                  background: (!templateForm.titulo.trim() || !templateForm.conteudo.trim()) ? 'rgba(100,116,139,0.3)' : 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                  border: 'none', borderRadius: '12px', color: 'white',
                  fontSize: '14px', fontWeight: '600',
                  cursor: savingTemplate || !templateForm.titulo.trim() || !templateForm.conteudo.trim() ? 'not-allowed' : 'pointer'
                }}
              >
                <Save style={{ width: '16px', height: '16px' }} />
                {savingTemplate ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
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
                            width: '50px', padding: '4px 6px', background: '#0f0a1f',
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
