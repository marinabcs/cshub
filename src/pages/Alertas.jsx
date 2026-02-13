import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Clock, AlertTriangle, AlertOctagon, Frown, RefreshCw, Check, ChevronRight, ChevronDown, Filter, X, Play, CheckCircle, XCircle, ExternalLink, ListTodo, Loader2, Pencil, Save, FileText, Eye, Timer, ClipboardList } from 'lucide-react';
import { useAlertas, useAlertasCount, useAtualizarAlerta, useVerificarAlertas } from '../hooks/useAlertas';
import {
  ALERTA_TIPOS,
  ALERTA_PRIORIDADES,
  ALERTA_STATUS,
  getTipoInfo,
  getPrioridadeInfo,
  getStatusInfo,
  formatarTempoRelativo
} from '../utils/alertas';
import { isClickUpConfigured, criarTarefaClickUp, buscarMembrosClickUp, PRIORIDADES_CLICKUP } from '../services/clickup';
import { doc, updateDoc, Timestamp, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Pagination } from '../components/UI/Pagination';

// Mapeamento de ícones por tipo
const TIPO_ICONS = {
  sentimento_negativo: Frown,
  problema_reclamacao: AlertTriangle,
  entrou_resgate: AlertOctagon,
  sem_uso_plataforma: Clock,
  carencia_comunicacao: Timer,
  carencia_playbook: ClipboardList,
};

export default function Alertas() {
  const navigate = useNavigate();

  // Filtros
  const [filtroTipos, setFiltroTipos] = useState([]);
  const [filtroPrioridades, setFiltroPrioridades] = useState([]);
  const [filtroStatus, setFiltroStatus] = useState(['pendente', 'em_andamento', 'bloqueado']);
  const [filtroResponsavel, setFiltroResponsavel] = useState([]);
  const [filtroTeamType, setFiltroTeamType] = useState([]);

  // Dropdowns
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showTeamTypeDropdown, setShowTeamTypeDropdown] = useState(false);
  const [showResponsavelDropdown, setShowResponsavelDropdown] = useState(false);
  const [showTipoDropdown, setShowTipoDropdown] = useState(false);
  const [showPrioridadeDropdown, setShowPrioridadeDropdown] = useState(false);

  // Detail/Edit Modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailAlerta, setDetailAlerta] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

  // ClickUp Modal
  const [showClickUpModal, setShowClickUpModal] = useState(false);
  const [selectedAlerta, setSelectedAlerta] = useState(null);
  const [clickUpNome, setClickUpNome] = useState('');
  const [clickUpDescricao, setClickUpDescricao] = useState('');
  const [clickUpPrioridade, setClickUpPrioridade] = useState(3);
  const [clickUpResponsavel, setClickUpResponsavel] = useState('');
  const [clickUpMembros, setClickUpMembros] = useState([]);
  const [criandoTarefa, setCriandoTarefa] = useState(false);
  const [loadingMembros, setLoadingMembros] = useState(false);

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 30;

  // Estado para seleção múltipla
  const [selectedAlertas, setSelectedAlertas] = useState(new Set());
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchStatus, setBatchStatus] = useState('');
  const [atualizandoBatch, setAtualizandoBatch] = useState(false);

  // Funções para seleção múltipla
  const toggleSelectAlerta = (alertaId) => {
    const newSelected = new Set(selectedAlertas);
    if (newSelected.has(alertaId)) {
      newSelected.delete(alertaId);
    } else {
      newSelected.add(alertaId);
    }
    setSelectedAlertas(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedAlertas.size === alertasFiltrados.length) {
      setSelectedAlertas(new Set());
    } else {
      setSelectedAlertas(new Set(alertasFiltrados.map(a => a.id)));
    }
  };

  const handleBatchStatusChange = async () => {
    if (!batchStatus || selectedAlertas.size === 0) return;

    setAtualizandoBatch(true);
    try {
      const promises = Array.from(selectedAlertas).map(alertaId =>
        updateDoc(doc(db, 'alertas', alertaId), {
          status: batchStatus,
          updated_at: Timestamp.now(),
          ...(batchStatus === 'resolvido' || batchStatus === 'ignorado' ? { resolved_at: Timestamp.now() } : {})
        })
      );

      await Promise.all(promises);
      setSelectedAlertas(new Set());
      setShowBatchModal(false);
      setBatchStatus('');
      refetch();
    } catch (error) {
      console.error('Erro ao atualizar alertas:', error);
      alert(`Erro: ${error.message}`);
    } finally {
      setAtualizandoBatch(false);
    }
  };

  // Hooks
  const { alertas, loading, refetch } = useAlertas({
    tipos: filtroTipos.length > 0 ? filtroTipos : undefined,
    prioridades: filtroPrioridades.length > 0 ? filtroPrioridades : undefined,
    status: filtroStatus.length > 0 ? filtroStatus : undefined,
  });
  const { counts } = useAlertasCount();
  const { atualizarStatus, updating } = useAtualizarAlerta();
  const { resultados } = useVerificarAlertas();

  // Responsáveis únicos e tipos de time (separa nomes concatenados por vírgula)
  const responsaveis = [...new Set(
    alertas
      .map(a => a.responsavel_nome)
      .filter(Boolean)
      .flatMap(nome => nome.split(', ').map(n => n.trim()))
      .filter(Boolean)
  )].sort();
  const teamTypes = [...new Set(alertas.map(a => a.team_type).filter(Boolean))].sort();

  // Filtrar alertas por responsável e team_type (localmente)
  const alertasFiltrados = alertas.filter(a => {
    // Verifica se algum dos responsáveis selecionados está no campo responsavel_nome
    const matchResponsavel = filtroResponsavel.length === 0 ||
      filtroResponsavel.some(resp => a.responsavel_nome && a.responsavel_nome.includes(resp));
    const matchTeamType = filtroTeamType.length === 0 || filtroTeamType.includes(a.team_type);
    return matchResponsavel && matchTeamType;
  });

  // Paginação de exibição
  const totalPages = Math.ceil(alertasFiltrados.length / PAGE_SIZE);
  const alertasPaginados = alertasFiltrados.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Resetar página ao mudar filtros
  useEffect(() => { setCurrentPage(1); }, [filtroTipos, filtroPrioridades, filtroStatus, filtroResponsavel, filtroTeamType]);

  // Contagens filtradas
  const countPendentes = alertasFiltrados.filter(a => a.status === 'pendente').length;
  const countEmAndamento = alertasFiltrados.filter(a => a.status === 'em_andamento').length;
  const countResolvidosHoje = alertasFiltrados.filter(a => {
    if (a.status !== 'resolvido' || !a.resolved_at) return false;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const resolved = a.resolved_at.toDate ? a.resolved_at.toDate() : new Date(a.resolved_at);
    return resolved >= hoje;
  }).length;

  // Handler para atualizar status
  const handleAtualizarStatus = async (alertaId, novoStatus) => {
    const result = await atualizarStatus(alertaId, novoStatus);
    if (result.success) {
      refetch();
    }
  };

  // Limpar todos os alertas
  const [limpando, setLimpando] = useState(false);
  const [showConfirmLimpar, setShowConfirmLimpar] = useState(false);

  const handleLimparTodos = async () => {
    setLimpando(true);
    try {
      const snap = await getDocs(collection(db, 'alertas'));
      const batch = [];
      snap.docs.forEach(d => {
        batch.push(deleteDoc(doc(db, 'alertas', d.id)));
      });
      await Promise.all(batch);
      setShowConfirmLimpar(false);
      setSelectedAlertas(new Set());
      refetch();
    } catch (error) {
      console.error('Erro ao limpar alertas:', error);
    } finally {
      setLimpando(false);
    }
  };

  // Toggle de filtros
  const toggleFiltroTipo = (tipo) => {
    setFiltroTipos(prev =>
      prev.includes(tipo) ? prev.filter(t => t !== tipo) : [...prev, tipo]
    );
  };

  const toggleFiltroPrioridade = (prioridade) => {
    setFiltroPrioridades(prev =>
      prev.includes(prioridade) ? prev.filter(p => p !== prioridade) : [...prev, prioridade]
    );
  };

  const toggleFiltroStatus = (status) => {
    setFiltroStatus(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const limparFiltros = () => {
    setFiltroTipos([]);
    setFiltroPrioridades([]);
    setFiltroStatus(['pendente', 'em_andamento', 'bloqueado']);
    setFiltroResponsavel([]);
    setFiltroTeamType([]);
  };

  const toggleFiltroTeamType = (type) => {
    setFiltroTeamType(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const toggleFiltroResponsavel = (resp) => {
    setFiltroResponsavel(prev =>
      prev.includes(resp) ? prev.filter(r => r !== resp) : [...prev, resp]
    );
  };

  const closeAllDropdowns = () => {
    setShowStatusDropdown(false);
    setShowTeamTypeDropdown(false);
    setShowResponsavelDropdown(false);
    setShowTipoDropdown(false);
    setShowPrioridadeDropdown(false);
  };

  // Detail/Edit functions
  const abrirDetalhes = (alerta) => {
    setDetailAlerta(alerta);
    setEditData({
      titulo: alerta.titulo || '',
      mensagem: alerta.mensagem || '',
      prioridade: alerta.prioridade || 'media',
      status: alerta.status || 'pendente',
      notas: alerta.notas || ''
    });
    setEditMode(false);
    setShowDetailModal(true);
  };

  const fecharDetalhes = () => {
    setShowDetailModal(false);
    setDetailAlerta(null);
    setEditMode(false);
  };

  const handleSaveEdit = async () => {
    if (!detailAlerta) return;

    setSavingEdit(true);
    try {
      const alertaRef = doc(db, 'alertas', detailAlerta.id);
      const updateData = {
        titulo: editData.titulo,
        mensagem: editData.mensagem,
        prioridade: editData.prioridade,
        notas: editData.notas,
        updated_at: new Date()
      };

      // If status changed to resolvido, add resolved_at
      if (editData.status !== detailAlerta.status) {
        updateData.status = editData.status;
        if (editData.status === 'resolvido') {
          updateData.resolved_at = new Date();
        }
      }

      await updateDoc(alertaRef, updateData);
      setEditMode(false);
      refetch();
      // Update local detail
      setDetailAlerta({ ...detailAlerta, ...updateData });
    } catch (error) {
      console.error('Erro ao salvar alerta:', error);
      alert('Erro ao salvar alterações');
    } finally {
      setSavingEdit(false);
    }
  };

  // ClickUp functions
  const abrirModalClickUp = async (alerta) => {
    setSelectedAlerta(alerta);
    setClickUpNome(`[CS Hub] ${alerta.titulo}`);
    setClickUpDescricao(`**Alerta do CS Hub**\n\n**Tipo:** ${getTipoInfo(alerta.tipo).label}\n**Prioridade:** ${getPrioridadeInfo(alerta.prioridade).label}\n**Cliente/Time:** ${alerta.time_name || alerta.cliente_nome || 'N/A'}\n\n**Detalhes:**\n${alerta.mensagem}`);

    // Mapear prioridade
    const prioMap = { 'urgente': 1, 'alta': 2, 'media': 3, 'baixa': 4 };
    setClickUpPrioridade(prioMap[alerta.prioridade] || 3);
    setClickUpResponsavel('');
    setShowClickUpModal(true);

    // Buscar membros
    if (clickUpMembros.length === 0) {
      setLoadingMembros(true);
      try {
        const membros = await buscarMembrosClickUp();
        setClickUpMembros(membros);
      } catch (error) {
        console.error('Erro ao buscar membros:', error);
      } finally {
        setLoadingMembros(false);
      }
    }
  };

  const fecharModalClickUp = () => {
    setShowClickUpModal(false);
    setSelectedAlerta(null);
  };

  const handleCriarTarefaClickUp = async () => {
    if (!selectedAlerta) return;

    setCriandoTarefa(true);
    try {
      const result = await criarTarefaClickUp(selectedAlerta, {
        nome: clickUpNome,
        descricao: clickUpDescricao,
        prioridade: clickUpPrioridade,
        responsavelId: clickUpResponsavel || null
      });

      // Salvar no Firebase
      const alertaRef = doc(db, 'alertas', selectedAlerta.id);
      await updateDoc(alertaRef, {
        clickup_task_id: result.id,
        clickup_task_url: result.url,
        status: 'em_andamento'
      });

      alert('Tarefa criada com sucesso no ClickUp!');
      fecharModalClickUp();
      refetch();
    } catch (error) {
      console.error('Erro ao criar tarefa:', error);
      alert(`Erro ao criar tarefa: ${error.message}`);
    } finally {
      setCriandoTarefa(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f0a1f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '48px', height: '48px', border: '3px solid rgba(139, 92, 246, 0.2)', borderTopColor: '#8b5cf6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px', background: '#0f0a1f', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: 'white', margin: 0 }}>Alertas</h1>
            {counts.urgentes > 0 && (
              <span style={{
                padding: '4px 12px',
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '20px',
                color: '#ef4444',
                fontSize: '12px',
                fontWeight: '600'
              }}>
                {counts.urgentes} urgente{counts.urgentes > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p style={{ color: '#94a3b8', margin: 0 }}>
            {countPendentes} pendente{countPendentes !== 1 ? 's' : ''} • {countEmAndamento} em andamento • {countResolvidosHoje} resolvido{countResolvidosHoje !== 1 ? 's' : ''} hoje
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {/* Botão "Verificar Novos Alertas" oculto — criação automática desativada temporariamente (13/02/2026) */}
          <button
            onClick={() => setShowConfirmLimpar(true)}
            disabled={limpando || alertas.length === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '12px',
              color: '#ef4444',
              fontSize: '14px',
              fontWeight: '600',
              cursor: limpando || alertas.length === 0 ? 'not-allowed' : 'pointer',
              opacity: alertas.length === 0 ? 0.5 : 1
            }}
          >
            <XCircle style={{ width: '18px', height: '18px' }} />
            Limpar Todos
          </button>
        </div>
      </div>

      {/* Modal confirmação limpar */}
      {showConfirmLimpar && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: '#1e1b4b', border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '16px', padding: '32px', maxWidth: '420px', width: '90%'
          }}>
            <h3 style={{ color: '#ef4444', margin: '0 0 12px', fontSize: '18px' }}>
              Limpar todos os alertas?
            </h3>
            <p style={{ color: '#94a3b8', margin: '0 0 24px', fontSize: '14px', lineHeight: '1.5' }}>
              Isso vai deletar permanentemente <strong style={{ color: 'white' }}>{alertas.length} alerta{alertas.length !== 1 ? 's' : ''}</strong>. Essa acao nao pode ser desfeita.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowConfirmLimpar(false)}
                disabled={limpando}
                style={{
                  padding: '10px 20px', background: 'rgba(100, 116, 139, 0.2)',
                  border: '1px solid rgba(100, 116, 139, 0.3)', borderRadius: '12px',
                  color: '#94a3b8', fontSize: '14px', fontWeight: '500', cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleLimparTodos}
                disabled={limpando}
                style={{
                  padding: '10px 20px', background: limpando ? 'rgba(239, 68, 68, 0.5)' : '#ef4444',
                  border: 'none', borderRadius: '12px', color: 'white',
                  fontSize: '14px', fontWeight: '600',
                  cursor: limpando ? 'not-allowed' : 'pointer'
                }}
              >
                {limpando ? 'Deletando...' : 'Deletar Todos'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resultado da verificação */}
      {resultados && !resultados.error && (
        <div style={{
          padding: '16px 20px',
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '12px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Check style={{ width: '20px', height: '20px', color: '#10b981' }} />
            <span style={{ color: '#10b981', fontWeight: '500' }}>
              Verificação concluída! {resultados.novosCriados} novo{resultados.novosCriados !== 1 ? 's' : ''} alerta{resultados.novosCriados !== 1 ? 's' : ''} criado{resultados.novosCriados !== 1 ? 's' : ''}.
            </span>
          </div>
          <span style={{ color: '#64748b', fontSize: '13px' }}>
            {resultados.verificados.threads} conversas • {resultados.verificados.clientes} clientes
            {resultados.clickupCriados > 0 && ` • ${resultados.clickupCriados} tarefas ClickUp`}
          </span>
        </div>
      )}


      {/* Filtros - Linha única */}
      <div style={{
        background: 'rgba(30, 27, 75, 0.4)',
        border: '1px solid rgba(139, 92, 246, 0.15)',
        borderRadius: '12px',
        padding: '12px 16px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap'
      }}>
        {/* Status - Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => { closeAllDropdowns(); setShowStatusDropdown(!showStatusDropdown); }}
            style={{
              padding: '4px 10px',
              background: filtroStatus.length > 0 && filtroStatus.length < Object.keys(ALERTA_STATUS).length ? 'rgba(139, 92, 246, 0.2)' : 'rgba(15, 10, 31, 0.6)',
              border: `1px solid ${filtroStatus.length > 0 && filtroStatus.length < Object.keys(ALERTA_STATUS).length ? '#8b5cf6' : 'rgba(139, 92, 246, 0.2)'}`,
              borderRadius: '8px',
              color: filtroStatus.length > 0 && filtroStatus.length < Object.keys(ALERTA_STATUS).length ? '#a78bfa' : '#94a3b8',
              fontSize: '11px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {filtroStatus.length === 0 ? 'Status: Todos' : filtroStatus.length === Object.keys(ALERTA_STATUS).length ? 'Status: Todos' : `Status: ${filtroStatus.length}`}
            <ChevronDown style={{ width: '12px', height: '12px' }} />
          </button>

          {showStatusDropdown && (
            <>
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }} onClick={() => setShowStatusDropdown(false)} />
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '4px',
                background: '#1e1b4b',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '8px',
                padding: '6px',
                minWidth: '160px',
                zIndex: 100,
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)'
              }}>
                {filtroStatus.length > 0 && (
                  <button
                    onClick={() => setFiltroStatus([])}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      marginBottom: '4px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      borderRadius: '6px',
                      color: '#ef4444',
                      fontSize: '11px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px'
                    }}
                  >
                    <X style={{ width: '10px', height: '10px' }} />
                    Limpar
                  </button>
                )}
                {Object.values(ALERTA_STATUS).map(status => {
                  const isSelected = filtroStatus.includes(status.value);
                  return (
                    <button
                      key={status.value}
                      onClick={() => toggleFiltroStatus(status.value)}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        marginBottom: '2px',
                        background: isSelected ? `${status.color}15` : 'transparent',
                        border: 'none',
                        borderRadius: '6px',
                        color: isSelected ? status.color : '#94a3b8',
                        fontSize: '11px',
                        fontWeight: isSelected ? '500' : '400',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        textAlign: 'left'
                      }}
                    >
                      <div style={{
                        width: '14px',
                        height: '14px',
                        borderRadius: '3px',
                        border: `1px solid ${isSelected ? status.color : 'rgba(139, 92, 246, 0.3)'}`,
                        background: isSelected ? status.color : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {isSelected && <Check style={{ width: '10px', height: '10px', color: 'white' }} />}
                      </div>
                      {status.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div style={{ width: '1px', height: '20px', background: 'rgba(139, 92, 246, 0.2)' }} />

        {/* Prioridade - Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => { closeAllDropdowns(); setShowPrioridadeDropdown(!showPrioridadeDropdown); }}
              style={{
                padding: '4px 10px',
                background: filtroPrioridades.length > 0 ? 'rgba(139, 92, 246, 0.2)' : 'rgba(15, 10, 31, 0.6)',
                border: `1px solid ${filtroPrioridades.length > 0 ? '#8b5cf6' : 'rgba(139, 92, 246, 0.2)'}`,
                borderRadius: '8px',
                color: filtroPrioridades.length > 0 ? '#a78bfa' : '#94a3b8',
                fontSize: '11px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {filtroPrioridades.length === 0 ? 'Prioridade: Todas' : `Prioridade: ${filtroPrioridades.length}`}
              <ChevronDown style={{ width: '12px', height: '12px' }} />
            </button>

            {showPrioridadeDropdown && (
              <>
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }} onClick={() => setShowPrioridadeDropdown(false)} />
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '4px',
                  background: '#1e1b4b',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  borderRadius: '8px',
                  padding: '6px',
                  minWidth: '160px',
                  zIndex: 100,
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)'
                }}>
                  {filtroPrioridades.length > 0 && (
                    <button
                      onClick={() => setFiltroPrioridades([])}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        marginBottom: '4px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '6px',
                        color: '#ef4444',
                        fontSize: '11px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                      }}
                    >
                      <X style={{ width: '10px', height: '10px' }} />
                      Limpar
                    </button>
                  )}
                  {Object.values(ALERTA_PRIORIDADES).map(prio => {
                    const isSelected = filtroPrioridades.includes(prio.value);
                    const count = alertas.filter(a => a.prioridade === prio.value).length;
                    return (
                      <button
                        key={prio.value}
                        onClick={() => toggleFiltroPrioridade(prio.value)}
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          background: isSelected ? `${prio.color}15` : 'transparent',
                          border: 'none',
                          borderRadius: '6px',
                          color: isSelected ? prio.color : '#94a3b8',
                          fontSize: '11px',
                          fontWeight: isSelected ? '500' : '400',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          textAlign: 'left'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '14px',
                            height: '14px',
                            borderRadius: '3px',
                            border: `2px solid ${isSelected ? prio.color : 'rgba(139, 92, 246, 0.3)'}`,
                            background: isSelected ? prio.color : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            {isSelected && <Check style={{ width: '10px', height: '10px', color: 'white' }} />}
                          </div>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: prio.color }}></span>
                            {prio.label}
                          </span>
                        </div>
                        <span style={{ color: '#64748b', fontSize: '10px' }}>{count}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

        <div style={{ width: '1px', height: '20px', background: 'rgba(139, 92, 246, 0.2)' }} />

        {/* Tipo - Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => { closeAllDropdowns(); setShowTipoDropdown(!showTipoDropdown); }}
              style={{
                padding: '4px 10px',
                background: filtroTipos.length > 0 ? 'rgba(139, 92, 246, 0.2)' : 'rgba(15, 10, 31, 0.6)',
                border: `1px solid ${filtroTipos.length > 0 ? '#8b5cf6' : 'rgba(139, 92, 246, 0.2)'}`,
                borderRadius: '8px',
                color: filtroTipos.length > 0 ? '#a78bfa' : '#94a3b8',
                fontSize: '11px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {filtroTipos.length === 0 ? 'Tipo: Todos' : `Tipo: ${filtroTipos.length}`}
              <ChevronDown style={{ width: '12px', height: '12px' }} />
            </button>

            {showTipoDropdown && (
              <>
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }} onClick={() => setShowTipoDropdown(false)} />
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '4px',
                  background: '#1e1b4b',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  borderRadius: '8px',
                  padding: '6px',
                  minWidth: '200px',
                  zIndex: 100,
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)'
                }}>
                  {filtroTipos.length > 0 && (
                    <button
                      onClick={() => setFiltroTipos([])}
                      style={{
                        width: '100%',
                        padding: '6px 10px',
                        marginBottom: '4px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '6px',
                        color: '#ef4444',
                        fontSize: '11px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                      }}
                    >
                      <X style={{ width: '10px', height: '10px' }} />
                      Limpar
                    </button>
                  )}
                  {Object.values(ALERTA_TIPOS).map(tipo => {
                    const isSelected = filtroTipos.includes(tipo.value);
                    const count = alertas.filter(a => a.tipo === tipo.value).length;
                    return (
                      <button
                        key={tipo.value}
                        onClick={() => toggleFiltroTipo(tipo.value)}
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          background: isSelected ? `${tipo.color}15` : 'transparent',
                          border: 'none',
                          borderRadius: '6px',
                          color: isSelected ? tipo.color : '#94a3b8',
                          fontSize: '11px',
                          fontWeight: isSelected ? '500' : '400',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          textAlign: 'left'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '14px',
                            height: '14px',
                            borderRadius: '3px',
                            border: `2px solid ${isSelected ? tipo.color : 'rgba(139, 92, 246, 0.3)'}`,
                            background: isSelected ? tipo.color : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            {isSelected && <Check style={{ width: '10px', height: '10px', color: 'white' }} />}
                          </div>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: tipo.color }}></span>
                            {tipo.label}
                          </span>
                        </div>
                        <span style={{ color: '#64748b', fontSize: '10px' }}>{count}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div style={{ width: '1px', height: '20px', background: 'rgba(139, 92, 246, 0.2)' }} />

          {/* Tipo de Time - Dropdown */}
          {teamTypes.length > 0 && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => { closeAllDropdowns(); setShowTeamTypeDropdown(!showTeamTypeDropdown); }}
                style={{
                  padding: '4px 10px',
                  background: filtroTeamType.length > 0 ? 'rgba(139, 92, 246, 0.2)' : 'rgba(15, 10, 31, 0.6)',
                  border: `1px solid ${filtroTeamType.length > 0 ? '#8b5cf6' : 'rgba(139, 92, 246, 0.2)'}`,
                  borderRadius: '8px',
                  color: filtroTeamType.length > 0 ? '#a78bfa' : '#94a3b8',
                  fontSize: '11px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {filtroTeamType.length === 0 ? 'Time: Todos' : `Time: ${filtroTeamType.length}`}
                <ChevronDown style={{ width: '12px', height: '12px' }} />
              </button>

              {showTeamTypeDropdown && (
                <>
                  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }} onClick={() => setShowTeamTypeDropdown(false)} />
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '4px',
                    background: '#1e1b4b',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '8px',
                    padding: '6px',
                    minWidth: '180px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    zIndex: 100,
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)'
                  }}>
                    {filtroTeamType.length > 0 && (
                      <button
                        onClick={() => setFiltroTeamType([])}
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          marginBottom: '4px',
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                          borderRadius: '6px',
                          color: '#ef4444',
                          fontSize: '11px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px'
                        }}
                      >
                        <X style={{ width: '10px', height: '10px' }} />
                        Limpar
                      </button>
                    )}
                    {teamTypes.map(type => {
                      const isSelected = filtroTeamType.includes(type);
                      const count = alertas.filter(a => a.team_type === type).length;
                      return (
                        <button
                          key={type}
                          onClick={() => toggleFiltroTeamType(type)}
                          style={{
                            width: '100%',
                            padding: '6px 10px',
                            background: isSelected ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                            border: 'none',
                            borderRadius: '6px',
                            color: isSelected ? '#a78bfa' : '#94a3b8',
                            fontSize: '11px',
                            fontWeight: isSelected ? '500' : '400',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            textAlign: 'left'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                              width: '14px',
                              height: '14px',
                              borderRadius: '3px',
                              border: `2px solid ${isSelected ? '#8b5cf6' : 'rgba(139, 92, 246, 0.3)'}`,
                              background: isSelected ? '#8b5cf6' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              {isSelected && <Check style={{ width: '10px', height: '10px', color: 'white' }} />}
                            </div>
                            {type}
                          </div>
                          <span style={{ color: '#64748b', fontSize: '10px' }}>{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {teamTypes.length > 0 && <div style={{ width: '1px', height: '20px', background: 'rgba(139, 92, 246, 0.2)' }} />}

          {/* Responsável - Dropdown */}
          {responsaveis.length > 0 && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => { closeAllDropdowns(); setShowResponsavelDropdown(!showResponsavelDropdown); }}
                style={{
                  padding: '4px 10px',
                  background: filtroResponsavel.length > 0 ? 'rgba(139, 92, 246, 0.2)' : 'rgba(15, 10, 31, 0.6)',
                  border: `1px solid ${filtroResponsavel.length > 0 ? '#8b5cf6' : 'rgba(139, 92, 246, 0.2)'}`,
                  borderRadius: '8px',
                  color: filtroResponsavel.length > 0 ? '#a78bfa' : '#94a3b8',
                  fontSize: '11px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {filtroResponsavel.length === 0 ? 'Resp: Todos' : `Resp: ${filtroResponsavel.length}`}
                <ChevronDown style={{ width: '12px', height: '12px' }} />
              </button>

              {showResponsavelDropdown && (
                <>
                  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }} onClick={() => setShowResponsavelDropdown(false)} />
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: '4px',
                    background: '#1e1b4b',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '8px',
                    padding: '6px',
                    minWidth: '180px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    zIndex: 100,
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)'
                  }}>
                    {filtroResponsavel.length > 0 && (
                      <button
                        onClick={() => setFiltroResponsavel([])}
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          marginBottom: '4px',
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                          borderRadius: '6px',
                          color: '#ef4444',
                          fontSize: '11px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px'
                        }}
                      >
                        <X style={{ width: '10px', height: '10px' }} />
                        Limpar
                      </button>
                    )}
                    {responsaveis.map(resp => {
                      const isSelected = filtroResponsavel.includes(resp);
                      const count = alertas.filter(a => a.responsavel_nome && a.responsavel_nome.includes(resp)).length;
                      return (
                        <button
                          key={resp}
                          onClick={() => toggleFiltroResponsavel(resp)}
                          style={{
                            width: '100%',
                            padding: '6px 10px',
                            background: isSelected ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                            border: 'none',
                            borderRadius: '6px',
                            color: isSelected ? '#a78bfa' : '#94a3b8',
                            fontSize: '11px',
                            fontWeight: isSelected ? '500' : '400',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            textAlign: 'left'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                              width: '14px',
                              height: '14px',
                              borderRadius: '3px',
                              border: `2px solid ${isSelected ? '#8b5cf6' : 'rgba(139, 92, 246, 0.3)'}`,
                              background: isSelected ? '#8b5cf6' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              {isSelected && <Check style={{ width: '10px', height: '10px', color: 'white' }} />}
                            </div>
                            {resp}
                          </div>
                          <span style={{ color: '#64748b', fontSize: '10px' }}>{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Botão limpar filtros */}
          {(filtroTipos.length > 0 || filtroPrioridades.length > 0 || filtroStatus.length !== 2 || filtroResponsavel.length > 0 || filtroTeamType.length > 0) && (
            <>
              <div style={{ width: '1px', height: '20px', background: 'rgba(139, 92, 246, 0.2)' }} />
              <button
                onClick={limparFiltros}
                style={{
                  padding: '4px 8px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '8px',
                  color: '#ef4444',
                  fontSize: '11px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <X style={{ width: '10px', height: '10px' }} />
                Limpar filtros
              </button>
            </>
          )}
      </div>

      {/* Barra de seleção múltipla */}
      {alertasFiltrados.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: selectedAlertas.size > 0 ? 'rgba(139, 92, 246, 0.1)' : 'rgba(30, 27, 75, 0.4)',
          border: selectedAlertas.size > 0 ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid rgba(139, 92, 246, 0.15)',
          borderRadius: '12px',
          marginBottom: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={toggleSelectAll}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                background: 'transparent',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '8px',
                color: '#a78bfa',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              {selectedAlertas.size === alertasFiltrados.length ? (
                <CheckCircle style={{ width: '16px', height: '16px' }} />
              ) : (
                <div style={{ width: '16px', height: '16px', border: '2px solid #a78bfa', borderRadius: '4px' }} />
              )}
              {selectedAlertas.size === alertasFiltrados.length ? 'Desmarcar todos' : 'Selecionar todos'}
            </button>
            {selectedAlertas.size > 0 && (
              <span style={{ color: '#94a3b8', fontSize: '13px' }}>
                {selectedAlertas.size} selecionado{selectedAlertas.size !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {selectedAlertas.size > 0 && (
            <button
              onClick={() => setShowBatchModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              <Pencil style={{ width: '14px', height: '14px' }} />
              Alterar Status
            </button>
          )}
        </div>
      )}

      {/* Lista de Alertas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {alertasPaginados.length > 0 ? alertasPaginados.map(alerta => {
          const tipoInfo = getTipoInfo(alerta.tipo);
          const prioridadeInfo = getPrioridadeInfo(alerta.prioridade);
          const statusInfo = getStatusInfo(alerta.status);
          const IconComponent = TIPO_ICONS[alerta.tipo] || Bell;

          const isSelected = selectedAlertas.has(alerta.id);

          return (
            <div
              key={alerta.id}
              style={{
                background: isSelected ? 'rgba(139, 92, 246, 0.1)' : 'rgba(30, 27, 75, 0.4)',
                border: `1px solid ${isSelected ? 'rgba(139, 92, 246, 0.4)' : alerta.prioridade === 'urgente' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(139, 92, 246, 0.15)'}`,
                borderRadius: '16px',
                padding: '20px',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                {/* Checkbox */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelectAlerta(alerta.id);
                  }}
                  style={{
                    width: '24px',
                    height: '24px',
                    background: isSelected ? '#8b5cf6' : 'transparent',
                    border: isSelected ? 'none' : '2px solid rgba(139, 92, 246, 0.4)',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                    marginTop: '12px'
                  }}
                >
                  {isSelected && <Check style={{ width: '14px', height: '14px', color: 'white' }} />}
                </button>

                {/* Ícone */}
                <div style={{
                  width: '48px',
                  height: '48px',
                  background: `${tipoInfo.color}20`,
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <IconComponent style={{ width: '24px', height: '24px', color: tipoInfo.color }} />
                </div>

                {/* Conteúdo */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                    {/* Badge de prioridade */}
                    <span style={{
                      padding: '3px 8px',
                      background: `${prioridadeInfo.color}20`,
                      color: prioridadeInfo.color,
                      borderRadius: '6px',
                      fontSize: '10px',
                      fontWeight: '600',
                      textTransform: 'uppercase'
                    }}>
                      {prioridadeInfo.label}
                    </span>
                    {/* Badge de status */}
                    <span style={{
                      padding: '3px 8px',
                      background: `${statusInfo.color}20`,
                      color: statusInfo.color,
                      borderRadius: '6px',
                      fontSize: '10px',
                      fontWeight: '500'
                    }}>
                      {statusInfo.label}
                    </span>
                    {/* Tipo */}
                    <span style={{
                      color: '#64748b',
                      fontSize: '11px'
                    }}>
                      {tipoInfo.label}
                    </span>
                  </div>

                  <h3 style={{ color: 'white', fontSize: '15px', fontWeight: '600', margin: '0 0 4px 0' }}>
                    {alerta.titulo}
                  </h3>

                  <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 12px 0' }}>
                    {alerta.mensagem}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    {/* Cliente/Time */}
                    {(alerta.cliente_nome || alerta.time_name) && (
                      <button
                        onClick={() => {
                          if (alerta.cliente_id) {
                            navigate(`/clientes/${alerta.cliente_id}`);
                          }
                        }}
                        style={{
                          padding: '4px 10px',
                          background: 'rgba(139, 92, 246, 0.1)',
                          border: '1px solid rgba(139, 92, 246, 0.2)',
                          borderRadius: '8px',
                          color: '#a78bfa',
                          fontSize: '12px',
                          cursor: alerta.cliente_id ? 'pointer' : 'default',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        {alerta.cliente_nome || alerta.time_name}
                        {alerta.cliente_id && <ChevronRight style={{ width: '12px', height: '12px' }} />}
                      </button>
                    )}

                    {/* Responsável */}
                    {alerta.responsavel_nome && (
                      <span style={{ color: '#64748b', fontSize: '12px' }}>
                        Resp: {alerta.responsavel_nome}
                      </span>
                    )}

                    {/* Tempo */}
                    <span style={{ color: '#64748b', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock style={{ width: '12px', height: '12px' }} />
                      {formatarTempoRelativo(alerta.created_at)}
                    </span>

                    {/* ClickUp badge ou botão */}
                    {alerta.clickup_task_url ? (
                      <a
                        href={alerta.clickup_task_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          padding: '4px 10px',
                          background: 'rgba(124, 58, 237, 0.1)',
                          border: '1px solid rgba(124, 58, 237, 0.3)',
                          borderRadius: '8px',
                          color: '#7c3aed',
                          fontSize: '12px',
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <ListTodo style={{ width: '12px', height: '12px' }} />
                        Tarefa criada
                        <ExternalLink style={{ width: '10px', height: '10px' }} />
                      </a>
                    ) : isClickUpConfigured() && (alerta.status === 'pendente' || alerta.status === 'em_andamento') && (
                      <button
                        onClick={() => abrirModalClickUp(alerta)}
                        style={{
                          padding: '4px 10px',
                          background: 'rgba(124, 58, 237, 0.1)',
                          border: '1px solid rgba(124, 58, 237, 0.2)',
                          borderRadius: '8px',
                          color: '#7c3aed',
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <ListTodo style={{ width: '12px', height: '12px' }} />
                        Criar Tarefa
                      </button>
                    )}
                  </div>
                </div>

                {/* Ações */}
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
                  {/* Botão Ver Detalhes */}
                  <button
                    onClick={() => abrirDetalhes(alerta)}
                    style={{
                      padding: '8px 12px',
                      background: 'rgba(139, 92, 246, 0.1)',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                      borderRadius: '8px',
                      color: '#a78bfa',
                      fontSize: '12px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title="Ver detalhes"
                  >
                    <ExternalLink style={{ width: '14px', height: '14px' }} />
                    Detalhes
                  </button>

                  {(alerta.status === 'pendente' || alerta.status === 'em_andamento') && (
                    <>
                      {alerta.status === 'pendente' && (
                        <button
                          onClick={() => handleAtualizarStatus(alerta.id, 'em_andamento')}
                          disabled={updating}
                          style={{
                            padding: '8px 12px',
                            background: 'rgba(59, 130, 246, 0.1)',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            borderRadius: '8px',
                            color: '#3b82f6',
                            fontSize: '12px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="Em andamento"
                        >
                          <Play style={{ width: '14px', height: '14px' }} />
                          Em andamento
                        </button>
                      )}
                      <button
                        onClick={() => handleAtualizarStatus(alerta.id, 'resolvido')}
                        disabled={updating}
                        style={{
                          padding: '8px 12px',
                          background: 'rgba(16, 185, 129, 0.1)',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          borderRadius: '8px',
                          color: '#10b981',
                          fontSize: '12px',
                          fontWeight: '500',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        title="Resolver"
                      >
                        <CheckCircle style={{ width: '14px', height: '14px' }} />
                        Resolver
                      </button>
                      <button
                        onClick={() => handleAtualizarStatus(alerta.id, 'ignorado')}
                        disabled={updating}
                        style={{
                          padding: '8px 12px',
                          background: 'rgba(100, 116, 139, 0.1)',
                          border: '1px solid rgba(100, 116, 139, 0.3)',
                          borderRadius: '8px',
                          color: '#64748b',
                          fontSize: '12px',
                          fontWeight: '500',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        title="Ignorar"
                      >
                        <XCircle style={{ width: '14px', height: '14px' }} />
                        Ignorar
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        }) : (
          <div style={{
            padding: '48px',
            textAlign: 'center',
            background: 'rgba(30, 27, 75, 0.4)',
            borderRadius: '16px',
            border: '1px solid rgba(139, 92, 246, 0.15)'
          }}>
            <Bell style={{ width: '48px', height: '48px', color: '#64748b', margin: '0 auto 16px' }} />
            <p style={{ color: '#94a3b8', fontSize: '16px', margin: '0 0 8px 0' }}>Nenhum alerta encontrado</p>
            <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
              {filtroStatus.length === 0 ? 'Selecione pelo menos um status para ver os alertas' : 'Clique em "Verificar Novos Alertas" para buscar problemas'}
            </p>
          </div>
        )}
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        totalItems={alertasFiltrados.length}
        pageSize={PAGE_SIZE}
      />

      {/* Modal de criação de tarefa no ClickUp */}
      {showClickUpModal && selectedAlerta && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#1e1b4b',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '500px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            {/* Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid rgba(139, 92, 246, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  background: 'rgba(124, 58, 237, 0.2)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <ListTodo style={{ width: '20px', height: '20px', color: '#7c3aed' }} />
                </div>
                <div>
                  <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: 0 }}>Criar Tarefa no ClickUp</h3>
                  <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>Lista: Atividades</p>
                </div>
              </div>
              <button
                onClick={fecharModalClickUp}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '8px'
                }}
              >
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '24px' }}>
              {/* Nome da tarefa */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '6px', display: 'block' }}>
                  Nome da Tarefa
                </label>
                <input
                  type="text"
                  value={clickUpNome}
                  onChange={(e) => setClickUpNome(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#0f0a1f',
                    border: '1px solid rgba(139, 92, 246, 0.2)',
                    borderRadius: '12px',
                    color: 'white',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Descrição */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '6px', display: 'block' }}>
                  Descrição
                </label>
                <textarea
                  value={clickUpDescricao}
                  onChange={(e) => setClickUpDescricao(e.target.value)}
                  rows={6}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#0f0a1f',
                    border: '1px solid rgba(139, 92, 246, 0.2)',
                    borderRadius: '12px',
                    color: 'white',
                    fontSize: '14px',
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Prioridade e Responsável */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                {/* Prioridade */}
                <div>
                  <label style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '6px', display: 'block' }}>
                    Prioridade
                  </label>
                  <select
                    value={clickUpPrioridade}
                    onChange={(e) => setClickUpPrioridade(parseInt(e.target.value, 10))}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      background: '#0f0a1f',
                      border: '1px solid rgba(139, 92, 246, 0.2)',
                      borderRadius: '12px',
                      color: 'white',
                      fontSize: '14px',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {PRIORIDADES_CLICKUP.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>

                {/* Responsável */}
                <div>
                  <label style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '6px', display: 'block' }}>
                    Responsável
                  </label>
                  <select
                    value={clickUpResponsavel}
                    onChange={(e) => setClickUpResponsavel(e.target.value)}
                    disabled={loadingMembros}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      background: '#0f0a1f',
                      border: '1px solid rgba(139, 92, 246, 0.2)',
                      borderRadius: '12px',
                      color: 'white',
                      fontSize: '14px',
                      outline: 'none',
                      cursor: loadingMembros ? 'wait' : 'pointer'
                    }}
                  >
                    <option value="">
                      {loadingMembros ? 'Carregando...' : 'Sem responsável'}
                    </option>
                    {clickUpMembros.map(m => (
                      <option key={m.id} value={m.id}>{m.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Preview do alerta original */}
              <div style={{
                padding: '12px',
                background: 'rgba(139, 92, 246, 0.05)',
                border: '1px solid rgba(139, 92, 246, 0.1)',
                borderRadius: '8px',
                marginBottom: '20px'
              }}>
                <p style={{ color: '#64748b', fontSize: '11px', margin: '0 0 4px 0', textTransform: 'uppercase' }}>Alerta Original</p>
                <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>{selectedAlerta.titulo}</p>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid rgba(139, 92, 246, 0.15)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button
                onClick={fecharModalClickUp}
                style={{
                  padding: '10px 20px',
                  background: 'transparent',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  borderRadius: '10px',
                  color: '#94a3b8',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleCriarTarefaClickUp}
                disabled={criandoTarefa || !clickUpNome.trim()}
                style={{
                  padding: '10px 20px',
                  background: criandoTarefa ? 'rgba(124, 58, 237, 0.5)' : 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)',
                  border: 'none',
                  borderRadius: '10px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: criandoTarefa ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {criandoTarefa ? (
                  <>
                    <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
                    Criando...
                  </>
                ) : (
                  <>
                    <ListTodo style={{ width: '16px', height: '16px' }} />
                    Criar Tarefa
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhes/Edição do Alerta */}
      {showDetailModal && detailAlerta && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#1e1b4b',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            {/* Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid rgba(139, 92, 246, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  background: `${getTipoInfo(detailAlerta.tipo).color}20`,
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {editMode ? (
                    <Pencil style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
                  ) : (
                    <Eye style={{ width: '20px', height: '20px', color: getTipoInfo(detailAlerta.tipo).color }} />
                  )}
                </div>
                <div>
                  <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: 0 }}>
                    {editMode ? 'Editar Alerta' : 'Detalhes do Alerta'}
                  </h3>
                  <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>
                    {getTipoInfo(detailAlerta.tipo).label}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {!editMode && (detailAlerta.status === 'pendente' || detailAlerta.status === 'em_andamento') && (
                  <button
                    onClick={() => setEditMode(true)}
                    style={{
                      padding: '8px 12px',
                      background: 'rgba(139, 92, 246, 0.1)',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                      borderRadius: '8px',
                      color: '#a78bfa',
                      fontSize: '12px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Pencil style={{ width: '14px', height: '14px' }} />
                    Editar
                  </button>
                )}
                <button
                  onClick={fecharDetalhes}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: '8px'
                  }}
                >
                  <X style={{ width: '20px', height: '20px' }} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '24px' }}>
              {editMode ? (
                // Edit Mode
                <>
                  {/* Título */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '6px', display: 'block' }}>
                      Título
                    </label>
                    <input
                      type="text"
                      value={editData.titulo}
                      onChange={(e) => setEditData({ ...editData, titulo: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        background: '#0f0a1f',
                        border: '1px solid rgba(139, 92, 246, 0.2)',
                        borderRadius: '12px',
                        color: 'white',
                        fontSize: '14px',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* Mensagem */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '6px', display: 'block' }}>
                      Mensagem
                    </label>
                    <textarea
                      value={editData.mensagem}
                      onChange={(e) => setEditData({ ...editData, mensagem: e.target.value })}
                      rows={4}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        background: '#0f0a1f',
                        border: '1px solid rgba(139, 92, 246, 0.2)',
                        borderRadius: '12px',
                        color: 'white',
                        fontSize: '14px',
                        outline: 'none',
                        resize: 'vertical',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* Prioridade e Status */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '6px', display: 'block' }}>
                        Prioridade
                      </label>
                      <select
                        value={editData.prioridade}
                        onChange={(e) => setEditData({ ...editData, prioridade: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          background: '#0f0a1f',
                          border: '1px solid rgba(139, 92, 246, 0.2)',
                          borderRadius: '12px',
                          color: 'white',
                          fontSize: '14px',
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        {Object.values(ALERTA_PRIORIDADES).map(p => (
                          <option key={p.value} value={p.value} style={{ background: '#1e1b4b' }}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '6px', display: 'block' }}>
                        Status
                      </label>
                      <select
                        value={editData.status}
                        onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          background: '#0f0a1f',
                          border: '1px solid rgba(139, 92, 246, 0.2)',
                          borderRadius: '12px',
                          color: 'white',
                          fontSize: '14px',
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        {Object.values(ALERTA_STATUS).map(s => (
                          <option key={s.value} value={s.value} style={{ background: '#1e1b4b' }}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Notas */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '6px', display: 'block' }}>
                      Notas internas
                    </label>
                    <textarea
                      value={editData.notas}
                      onChange={(e) => setEditData({ ...editData, notas: e.target.value })}
                      rows={3}
                      placeholder="Adicione notas ou observações..."
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        background: '#0f0a1f',
                        border: '1px solid rgba(139, 92, 246, 0.2)',
                        borderRadius: '12px',
                        color: 'white',
                        fontSize: '14px',
                        outline: 'none',
                        resize: 'vertical',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </>
              ) : (
                // View Mode
                <>
                  {/* Badges */}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    <span style={{
                      padding: '4px 10px',
                      background: `${getPrioridadeInfo(detailAlerta.prioridade).color}20`,
                      color: getPrioridadeInfo(detailAlerta.prioridade).color,
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}>
                      {getPrioridadeInfo(detailAlerta.prioridade).label}
                    </span>
                    <span style={{
                      padding: '4px 10px',
                      background: `${getStatusInfo(detailAlerta.status).color}20`,
                      color: getStatusInfo(detailAlerta.status).color,
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '500'
                    }}>
                      {getStatusInfo(detailAlerta.status).label}
                    </span>
                  </div>

                  {/* Título */}
                  <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: '0 0 12px 0' }}>
                    {detailAlerta.titulo}
                  </h2>

                  {/* Mensagem */}
                  <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 20px 0', lineHeight: '1.6' }}>
                    {detailAlerta.mensagem}
                  </p>

                  {/* Informações do alerta */}
                  <div style={{
                    background: 'rgba(15, 10, 31, 0.6)',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '16px'
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                      {detailAlerta.cliente_nome && (
                        <div>
                          <span style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Cliente</span>
                          <span style={{ color: 'white', fontSize: '14px' }}>{detailAlerta.cliente_nome}</span>
                        </div>
                      )}
                      {detailAlerta.time_name && (
                        <div>
                          <span style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Time</span>
                          <span style={{ color: 'white', fontSize: '14px' }}>{detailAlerta.time_name}</span>
                        </div>
                      )}
                      {detailAlerta.responsavel_nome && (
                        <div>
                          <span style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Responsável</span>
                          <span style={{ color: 'white', fontSize: '14px' }}>{detailAlerta.responsavel_nome}</span>
                        </div>
                      )}
                      <div>
                        <span style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Criado em</span>
                        <span style={{ color: 'white', fontSize: '14px' }}>
                          {detailAlerta.created_at ? (
                            (detailAlerta.created_at.toDate ? detailAlerta.created_at.toDate() : new Date(detailAlerta.created_at)).toLocaleString('pt-BR')
                          ) : '-'}
                        </span>
                      </div>
                      {detailAlerta.resolved_at && (
                        <div>
                          <span style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Resolvido em</span>
                          <span style={{ color: '#10b981', fontSize: '14px' }}>
                            {(detailAlerta.resolved_at.toDate ? detailAlerta.resolved_at.toDate() : new Date(detailAlerta.resolved_at)).toLocaleString('pt-BR')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notas */}
                  {detailAlerta.notas && (
                    <div style={{
                      background: 'rgba(139, 92, 246, 0.05)',
                      border: '1px solid rgba(139, 92, 246, 0.1)',
                      borderRadius: '12px',
                      padding: '16px',
                      marginBottom: '16px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <FileText style={{ width: '14px', height: '14px', color: '#8b5cf6' }} />
                        <span style={{ color: '#8b5cf6', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>Notas</span>
                      </div>
                      <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>{detailAlerta.notas}</p>
                    </div>
                  )}

                  {/* ClickUp link */}
                  {detailAlerta.clickup_task_url && (
                    <a
                      href={detailAlerta.clickup_task_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '12px 16px',
                        background: 'rgba(124, 58, 237, 0.1)',
                        border: '1px solid rgba(124, 58, 237, 0.3)',
                        borderRadius: '12px',
                        color: '#7c3aed',
                        fontSize: '14px',
                        textDecoration: 'none'
                      }}
                    >
                      <ListTodo style={{ width: '16px', height: '16px' }} />
                      Ver tarefa no ClickUp
                      <ExternalLink style={{ width: '14px', height: '14px', marginLeft: 'auto' }} />
                    </a>
                  )}

                  {/* Comentários do ClickUp */}
                  {detailAlerta.clickup_comentarios && detailAlerta.clickup_comentarios.length > 0 && (
                    <div style={{
                      background: 'rgba(124, 58, 237, 0.05)',
                      border: '1px solid rgba(124, 58, 237, 0.2)',
                      borderRadius: '12px',
                      padding: '16px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <ListTodo style={{ width: '14px', height: '14px', color: '#7c3aed' }} />
                        <span style={{ color: '#7c3aed', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase' }}>
                          Comentários do ClickUp ({detailAlerta.clickup_comentarios.length})
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {detailAlerta.clickup_comentarios.map((comentario, idx) => (
                          <div key={comentario.id || idx} style={{
                            background: 'rgba(15, 10, 31, 0.5)',
                            borderRadius: '8px',
                            padding: '10px 12px'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ color: '#a78bfa', fontSize: '12px', fontWeight: '500' }}>
                                {comentario.autor}
                              </span>
                              {comentario.data && (
                                <span style={{ color: '#64748b', fontSize: '11px' }}>
                                  {new Date(comentario.data).toLocaleString('pt-BR')}
                                </span>
                              )}
                            </div>
                            <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0, whiteSpace: 'pre-wrap' }}>
                              {comentario.texto}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid rgba(139, 92, 246, 0.15)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              {editMode ? (
                <>
                  <button
                    onClick={() => setEditMode(false)}
                    style={{
                      padding: '10px 20px',
                      background: 'transparent',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                      borderRadius: '10px',
                      color: '#94a3b8',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={savingEdit}
                    style={{
                      padding: '10px 20px',
                      background: savingEdit ? 'rgba(16, 185, 129, 0.5)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      border: 'none',
                      borderRadius: '10px',
                      color: 'white',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: savingEdit ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    {savingEdit ? (
                      <>
                        <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save style={{ width: '16px', height: '16px' }} />
                        Salvar
                      </>
                    )}
                  </button>
                </>
              ) : (
                <>
                  {(detailAlerta.status === 'pendente' || detailAlerta.status === 'em_andamento') && !detailAlerta.clickup_task_url && isClickUpConfigured() && (
                    <button
                      onClick={() => {
                        fecharDetalhes();
                        abrirModalClickUp(detailAlerta);
                      }}
                      style={{
                        padding: '10px 20px',
                        background: 'rgba(124, 58, 237, 0.1)',
                        border: '1px solid rgba(124, 58, 237, 0.3)',
                        borderRadius: '10px',
                        color: '#7c3aed',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <ListTodo style={{ width: '16px', height: '16px' }} />
                      Criar Tarefa ClickUp
                    </button>
                  )}
                  <button
                    onClick={fecharDetalhes}
                    style={{
                      padding: '10px 20px',
                      background: 'rgba(139, 92, 246, 0.1)',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                      borderRadius: '10px',
                      color: '#a78bfa',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    Fechar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Mudança de Status em Lote */}
      {showBatchModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#1e1b4b',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '400px',
            padding: '24px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>
                Alterar Status em Lote
              </h3>
              <button
                onClick={() => {
                  setShowBatchModal(false);
                  setBatchStatus('');
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>

            <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '20px' }}>
              {selectedAlertas.size} alerta{selectedAlertas.size !== 1 ? 's' : ''} selecionado{selectedAlertas.size !== 1 ? 's' : ''}
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '8px' }}>
                Novo Status
              </label>
              <select
                value={batchStatus}
                onChange={(e) => setBatchStatus(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: '#0f0a1f',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  borderRadius: '10px',
                  color: 'white',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                <option value="">Selecione...</option>
                <option value="pendente">Pendente</option>
                <option value="em_andamento">Em Andamento</option>
                <option value="resolvido">Resolvido</option>
                <option value="ignorado">Ignorado</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowBatchModal(false);
                  setBatchStatus('');
                }}
                style={{
                  padding: '10px 20px',
                  background: 'rgba(100, 116, 139, 0.2)',
                  border: '1px solid rgba(100, 116, 139, 0.3)',
                  borderRadius: '10px',
                  color: '#94a3b8',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleBatchStatusChange}
                disabled={!batchStatus || atualizandoBatch}
                style={{
                  padding: '10px 20px',
                  background: !batchStatus || atualizandoBatch ? 'rgba(139, 92, 246, 0.3)' : 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                  border: 'none',
                  borderRadius: '10px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: !batchStatus || atualizandoBatch ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {atualizandoBatch ? (
                  <>
                    <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
                    Atualizando...
                  </>
                ) : (
                  <>
                    <Check style={{ width: '16px', height: '16px' }} />
                    Aplicar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
