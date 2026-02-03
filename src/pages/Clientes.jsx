import { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, doc, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';
import { getUsuariosCountByTeam } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { Users, Search, ChevronRight, ChevronDown, Building2, Plus, Pencil, Download, AlertTriangle, Trash2, X, Link, CheckSquare, Square, Edit3, UserCheck, Check, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { STATUS_OPTIONS, DEFAULT_VISIBLE_STATUS, getStatusColor, getStatusLabel } from '../utils/clienteStatus';
import { SEGMENTO_OPTIONS, getSegmentoColor, getSegmentoLabel, getClienteSegmento } from '../utils/segmentoCS';
import { SegmentoBadge } from '../components/UI/SegmentoBadge';
import { AREAS_ATUACAO, getAreaLabel } from '../utils/areasAtuacao';

// Chave para localStorage
const FILTERS_STORAGE_KEY = 'cshub_clientes_filters';

// Função para normalizar texto (remove acentos)
const normalizeText = (text) => {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

// Função para carregar filtros do localStorage
const loadFiltersFromStorage = () => {
  try {
    const saved = localStorage.getItem(FILTERS_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Erro ao carregar filtros:', e);
  }
  return null;
};

// Função para salvar filtros no localStorage
const saveFiltersToStorage = (filters) => {
  try {
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
  } catch (e) {
    console.error('Erro ao salvar filtros:', e);
  }
};

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [times, setTimes] = useState([]);
  const [usuariosCount, setUsuariosCount] = useState({});
  const [loading, setLoading] = useState(true);

  // Carregar filtros salvos ou usar defaults (lazy initialization)
  const [searchTerm, setSearchTerm] = useState(() => {
    const saved = loadFiltersFromStorage();
    return saved?.searchTerm || '';
  });
  const [filterClienteStatus, setFilterClienteStatus] = useState(() => {
    const saved = loadFiltersFromStorage();
    return saved?.clienteStatus || DEFAULT_VISIBLE_STATUS;
  });
  const [filterType, setFilterType] = useState(() => {
    const saved = loadFiltersFromStorage();
    // Migrar de string para array se necessário
    if (saved?.type && typeof saved.type === 'string' && saved.type !== 'todos') {
      return [saved.type];
    }
    return saved?.type && Array.isArray(saved.type) ? saved.type : [];
  });
  const [filterSegmento, setFilterSegmento] = useState(() => {
    const saved = loadFiltersFromStorage();
    return saved?.segmento && Array.isArray(saved.segmento) ? saved.segmento : [];
  });
  const [filterAreaAtuacao, setFilterAreaAtuacao] = useState(() => {
    const saved = loadFiltersFromStorage();
    return saved?.areaAtuacao && Array.isArray(saved.areaAtuacao) ? saved.areaAtuacao : [];
  });

  const [showOrphanModal, setShowOrphanModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [clienteToDelete, setClienteToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Estados para edição em lote
  const [selectedClientes, setSelectedClientes] = useState(new Set());
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchField, setBatchField] = useState('');
  const [batchValue, setBatchValue] = useState('');
  const [batchUpdating, setBatchUpdating] = useState(false);

  // Estado para dropdowns de filtro
  const [showEscopoDropdown, setShowEscopoDropdown] = useState(false);
  const [showSegmentoDropdown, setShowSegmentoDropdown] = useState(false);
  const [showAreaDropdown, setShowAreaDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [sortOption, setSortOption] = useState(() => {
    const saved = loadFiltersFromStorage();
    return saved?.sortOption || 'name_asc';
  });

  const navigate = useNavigate();

  // Lista de responsáveis únicos para o batch edit
  const responsaveis = useMemo(() => {
    const list = new Set();
    clientes.forEach(c => {
      if (c.responsavel_nome) list.add(c.responsavel_nome);
    });
    return [...list].sort();
  }, [clientes]);

  // Salvar filtros quando mudarem
  useEffect(() => {
    saveFiltersToStorage({
      searchTerm,
      clienteStatus: filterClienteStatus,
      type: filterType,
      segmento: filterSegmento,
      areaAtuacao: filterAreaAtuacao,
      sortOption
    });
  }, [searchTerm, filterClienteStatus, filterType, filterSegmento, filterAreaAtuacao, sortOption]);

  const fetchData = async () => {
    try {
      // OTIMIZAÇÃO: Executar queries em PARALELO
      const [clientesSnapshot, timesSnapshot] = await Promise.all([
        getDocs(collection(db, 'clientes')),
        getDocs(collection(db, 'times'))
      ]);

      const clientesData = clientesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setClientes(clientesData);

      const timesData = timesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTimes(timesData);

      // Buscar contagem de usuários (agora otimizado com Promise.all interno)
      const teamIds = timesData.map(t => t.id);
      const counts = await getUsuariosCountByTeam(teamIds);
      setUsuariosCount(counts);
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Calculate orphan times (times not linked to any client)
  const getOrphanTimes = () => {
    const linkedTeamIds = new Set();
    clientes.forEach(cliente => {
      (cliente.times || []).forEach(teamId => linkedTeamIds.add(teamId));
    });
    return times.filter(time => !linkedTeamIds.has(time.id));
  };

  const orphanTimes = getOrphanTimes();

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Sem registro';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Hoje';
    if (diff === 1) return 'Ontem';
    return `há ${diff} dias`;
  };

  // Funções para seleção em lote
  const toggleSelectCliente = (clienteId) => {
    setSelectedClientes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clienteId)) {
        newSet.delete(clienteId);
      } else {
        newSet.add(clienteId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedClientes.size === filteredClientes.length) {
      setSelectedClientes(new Set());
    } else {
      setSelectedClientes(new Set(filteredClientes.map(c => c.id)));
    }
  };

  const clearSelection = () => {
    setSelectedClientes(new Set());
  };

  // Função para atualização em lote
  const handleBatchUpdate = async () => {
    if (!batchField || selectedClientes.size === 0) return;

    setBatchUpdating(true);
    try {
      const batch = writeBatch(db);
      const updates = {};

      // Determinar o campo e valor a atualizar
      if (batchField === 'status') {
        updates.status = batchValue;
      } else if (batchField === 'responsavel') {
        // Encontrar o cliente com esse responsável para pegar o email
        const clienteRef = clientes.find(c => c.responsavel_nome === batchValue);
        updates.responsavel_nome = batchValue;
        if (clienteRef?.responsavel_email) {
          updates.responsavel_email = clienteRef.responsavel_email;
        }
      } else if (batchField === 'team_type') {
        updates.team_type = batchValue;
      } else if (batchField === 'area_atuacao') {
        updates.area_atuacao = batchValue;
      }

      // Aplicar updates em todos os clientes selecionados
      for (const clienteId of selectedClientes) {
        const clienteRef = doc(db, 'clientes', clienteId);
        batch.update(clienteRef, updates);
      }

      await batch.commit();

      // Recarregar dados
      await fetchData();

      // Limpar seleção e fechar modal
      setSelectedClientes(new Set());
      setShowBatchModal(false);
      setBatchField('');
      setBatchValue('');
    } catch (error) {
      console.error('Erro ao atualizar em lote:', error);
      alert('Erro ao atualizar clientes. Tente novamente.');
    } finally {
      setBatchUpdating(false);
    }
  };

  // Extrair tipos únicos (separando combinações por vírgula) e ordenar
  const teamTypes = useMemo(() => {
    const allTypes = new Set();
    clientes.forEach(c => {
      if (c.team_type) {
        // Separar por vírgula e adicionar cada tipo individualmente
        c.team_type.split(',').forEach(type => {
          const trimmed = type.trim();
          if (trimmed) allTypes.add(trimmed);
        });
      }
    });
    return [...allTypes].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [clientes]);

  const filteredClientes = clientes
    .filter(cliente => {
      const searchNormalized = normalizeText(searchTerm);
      const nameNormalized = normalizeText(cliente.team_name || '');
      const responsavelNormalized = normalizeText(cliente.responsavel_nome || '');
      const matchesSearch = !searchTerm || nameNormalized.includes(searchNormalized) || responsavelNormalized.includes(searchNormalized);
      const matchesClienteStatus = filterClienteStatus.length === 0 || filterClienteStatus.includes(cliente.status || 'ativo');
      // Filtro de tipo: verifica se algum dos tipos selecionados está contido no team_type do cliente
      const matchesType = filterType.length === 0 || filterType.some(type => cliente.team_type && cliente.team_type.includes(type));
      // Filtro de segmento CS
      const matchesSegmento = filterSegmento.length === 0 || filterSegmento.includes(getClienteSegmento(cliente));
      const matchesArea = filterAreaAtuacao.length === 0 || filterAreaAtuacao.includes(cliente.area_atuacao);
      return matchesSearch && matchesClienteStatus && matchesType && matchesSegmento && matchesArea;
    })
    .sort((a, b) => {
      // Ordem de prioridade dos segmentos: RESGATE > ALERTA > ESTAVEL > CRESCIMENTO
      const segmentoOrder = { RESGATE: 1, ALERTA: 2, ESTAVEL: 3, CRESCIMENTO: 4 };
      switch (sortOption) {
        case 'name_asc':
          return (a.team_name || '').localeCompare(b.team_name || '', 'pt-BR');
        case 'name_desc':
          return (b.team_name || '').localeCompare(a.team_name || '', 'pt-BR');
        case 'segmento_priority': // Mais critico primeiro (RESCUE -> WATCH -> NURTURE -> GROW)
          return (segmentoOrder[getClienteSegmento(a)] || 5) - (segmentoOrder[getClienteSegmento(b)] || 5);
        case 'segmento_reverse': // Melhores primeiro (GROW -> NURTURE -> WATCH -> RESCUE)
          return (segmentoOrder[getClienteSegmento(b)] || 5) - (segmentoOrder[getClienteSegmento(a)] || 5);
        default:
          return (a.team_name || '').localeCompare(b.team_name || '', 'pt-BR');
      }
    });

  const exportToCSV = () => {
    const headers = ['Nome', 'Responsável', 'Email Responsável', 'Tags', 'Status', 'Segmento CS', 'Área de Atuação', 'Qtd Times'];
    const rows = filteredClientes.map(cliente => [
      cliente.team_name || cliente.nome || '',
      cliente.responsavel_nome || '',
      cliente.responsavel_email || '',
      (cliente.tags || []).join('; '),
      getStatusLabel(cliente.status || 'ativo'),
      getSegmentoLabel(getClienteSegmento(cliente)),
      getAreaLabel(cliente.area_atuacao),
      (cliente.times || []).length
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `clientes_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleDeleteClick = (e, cliente) => {
    e.stopPropagation();
    setClienteToDelete(cliente);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!clienteToDelete) return;

    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'clientes', clienteToDelete.id));
      // Refresh data
      await fetchData();
      setShowDeleteModal(false);
      setClienteToDelete(null);
    } catch (error) {
      console.error('Erro ao excluir cliente:', error);
      alert('Erro ao excluir cliente. Tente novamente.');
    } finally {
      setDeleting(false);
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
      {/* Alerta de Times Órfãos */}
      {orphanTimes.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(249, 115, 22, 0.1) 100%)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '12px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              background: 'rgba(245, 158, 11, 0.2)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <AlertTriangle style={{ width: '20px', height: '20px', color: '#f59e0b' }} />
            </div>
            <div>
              <p style={{ color: '#fbbf24', fontSize: '14px', fontWeight: '600', margin: '0 0 2px 0' }}>
                {orphanTimes.length} {orphanTimes.length === 1 ? 'time aguardando' : 'times aguardando'} atribuição
              </p>
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>
                Esses times precisam ser vinculados a um cliente
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowOrphanModal(true)}
            style={{
              padding: '10px 20px',
              background: 'rgba(245, 158, 11, 0.2)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              borderRadius: '10px',
              color: '#fbbf24',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            Ver times
            <ChevronRight style={{ width: '16px', height: '16px' }} />
          </button>
        </div>
      )}

      {/* Barra de Edição em Lote */}
      {selectedClientes.size > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(6, 182, 212, 0.15) 100%)',
          border: '1px solid rgba(139, 92, 246, 0.4)',
          borderRadius: '12px',
          marginBottom: '24px',
          position: 'sticky',
          top: '16px',
          zIndex: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckSquare style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
              <span style={{ color: 'white', fontSize: '14px', fontWeight: '600' }}>
                {selectedClientes.size} {selectedClientes.size === 1 ? 'cliente selecionado' : 'clientes selecionados'}
              </span>
            </div>
            <button
              onClick={clearSelection}
              style={{
                padding: '6px 12px',
                background: 'transparent',
                border: '1px solid rgba(148, 163, 184, 0.3)',
                borderRadius: '8px',
                color: '#94a3b8',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <X style={{ width: '14px', height: '14px' }} />
              Limpar
            </button>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => { setBatchField('status'); setShowBatchModal(true); }}
              style={{
                padding: '8px 16px',
                background: 'rgba(16, 185, 129, 0.2)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                borderRadius: '8px',
                color: '#10b981',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Edit3 style={{ width: '14px', height: '14px' }} />
              Alterar Status
            </button>
            <button
              onClick={() => { setBatchField('responsavel'); setShowBatchModal(true); }}
              style={{
                padding: '8px 16px',
                background: 'rgba(59, 130, 246, 0.2)',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                borderRadius: '8px',
                color: '#3b82f6',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <UserCheck style={{ width: '14px', height: '14px' }} />
              Alterar Responsável
            </button>
            <button
              onClick={() => { setBatchField('team_type'); setShowBatchModal(true); }}
              style={{
                padding: '8px 16px',
                background: 'rgba(249, 115, 22, 0.2)',
                border: '1px solid rgba(249, 115, 22, 0.4)',
                borderRadius: '8px',
                color: '#f97316',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Building2 style={{ width: '14px', height: '14px' }} />
              Alterar Tipo
            </button>
            <button
              onClick={() => { setBatchField('area_atuacao'); setShowBatchModal(true); }}
              style={{
                padding: '8px 16px',
                background: 'rgba(6, 182, 212, 0.2)',
                border: '1px solid rgba(6, 182, 212, 0.4)',
                borderRadius: '8px',
                color: '#06b6d4',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Building2 style={{ width: '14px', height: '14px' }} />
              Alterar Área
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: 'white', margin: '0 0 8px 0' }}>Clientes</h1>
          <p style={{ color: '#94a3b8', margin: 0 }}>{clientes.length} clientes cadastrados</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={exportToCSV}
            style={{
              padding: '12px 20px',
              background: 'rgba(30, 27, 75, 0.6)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '12px',
              color: 'white',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Download style={{ width: '18px', height: '18px' }} />
            Exportar CSV
          </button>
          <button
            onClick={() => navigate('/clientes/novo')}
            style={{
              padding: '12px 20px',
              background: 'linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Plus style={{ width: '18px', height: '18px' }} />
            Novo Cliente
          </button>
        </div>
      </div>

      {/* Linha 1: Busca, Segmento e Escopo */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Busca */}
        <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
          <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: '#64748b' }} />
          <input type="text" placeholder="Buscar por nome ou responsável..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '10px 14px 10px 42px', background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '10px', color: 'white', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
        </div>

        {/* Segmento CS Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => { setShowSegmentoDropdown(!showSegmentoDropdown); setShowEscopoDropdown(false); setShowSortDropdown(false); setShowAreaDropdown(false); }}
            style={{
              padding: '10px 14px',
              background: filterSegmento.length > 0 ? 'rgba(139, 92, 246, 0.2)' : 'rgba(30, 27, 75, 0.6)',
              border: `1px solid ${filterSegmento.length > 0 ? '#8b5cf6' : 'rgba(139, 92, 246, 0.2)'}`,
              borderRadius: '10px',
              color: filterSegmento.length > 0 ? '#a78bfa' : '#94a3b8',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              minWidth: '150px'
            }}
          >
            {filterSegmento.length === 0 ? 'Segmento: Todos' : `Segmento: ${filterSegmento.length}`}
            <ChevronDown style={{ width: '14px', height: '14px' }} />
          </button>

          {showSegmentoDropdown && (
            <>
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }} onClick={() => setShowSegmentoDropdown(false)} />
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '8px',
                background: '#1e1b4b',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '12px',
                padding: '8px',
                minWidth: '200px',
                zIndex: 100,
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
              }}>
                {filterSegmento.length > 0 && (
                  <button
                    onClick={() => setFilterSegmento([])}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      marginBottom: '8px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      borderRadius: '8px',
                      color: '#ef4444',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <X style={{ width: '12px', height: '12px' }} />
                    Limpar
                  </button>
                )}
                {SEGMENTO_OPTIONS.map(opt => {
                  const isSelected = filterSegmento.includes(opt.value);
                  const count = clientes.filter(c => getClienteSegmento(c) === opt.value).length;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => {
                        if (isSelected) {
                          setFilterSegmento(filterSegmento.filter(s => s !== opt.value));
                        } else {
                          setFilterSegmento([...filterSegmento, opt.value]);
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        background: isSelected ? `${opt.color}15` : 'transparent',
                        border: 'none',
                        borderRadius: '8px',
                        color: isSelected ? opt.color : '#94a3b8',
                        fontSize: '13px',
                        fontWeight: isSelected ? '500' : '400',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        textAlign: 'left'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '4px',
                          border: `2px solid ${isSelected ? opt.color : 'rgba(139, 92, 246, 0.3)'}`,
                          background: isSelected ? opt.color : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {isSelected && <Check style={{ width: '12px', height: '12px', color: 'white' }} />}
                        </div>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: opt.color }}></span>
                          {opt.label}
                        </span>
                      </div>
                      <span style={{ color: '#64748b', fontSize: '11px' }}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Escopo Dropdown */}
        {teamTypes.length > 0 && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => { setShowEscopoDropdown(!showEscopoDropdown); setShowSegmentoDropdown(false); setShowSortDropdown(false); setShowAreaDropdown(false); }}
              style={{
                padding: '10px 14px',
                background: filterType.length > 0 ? 'rgba(139, 92, 246, 0.2)' : 'rgba(30, 27, 75, 0.6)',
                border: `1px solid ${filterType.length > 0 ? '#8b5cf6' : 'rgba(139, 92, 246, 0.2)'}`,
                borderRadius: '10px',
                color: filterType.length > 0 ? '#a78bfa' : '#94a3b8',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                minWidth: '140px'
              }}
            >
              {filterType.length === 0 ? 'Escopo: Todos' : `Escopo: ${filterType.length}`}
              <ChevronDown style={{ width: '14px', height: '14px' }} />
            </button>

            {showEscopoDropdown && (
              <>
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }} onClick={() => setShowEscopoDropdown(false)} />
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '8px',
                  background: '#1e1b4b',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  borderRadius: '12px',
                  padding: '8px',
                  minWidth: '220px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  zIndex: 100,
                  boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
                }}>
                  {filterType.length > 0 && (
                    <button
                      onClick={() => setFilterType([])}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        marginBottom: '8px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '8px',
                        color: '#ef4444',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <X style={{ width: '12px', height: '12px' }} />
                      Limpar
                    </button>
                  )}
                  {teamTypes.map(type => {
                    const isSelected = filterType.includes(type);
                    const count = clientes.filter(c => c.team_type && c.team_type.includes(type)).length;
                    return (
                      <button
                        key={type}
                        onClick={() => {
                          if (isSelected) {
                            setFilterType(filterType.filter(t => t !== type));
                          } else {
                            setFilterType([...filterType, type]);
                          }
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: isSelected ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                          border: 'none',
                          borderRadius: '8px',
                          color: isSelected ? '#a78bfa' : '#94a3b8',
                          fontSize: '13px',
                          fontWeight: isSelected ? '500' : '400',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          textAlign: 'left'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '4px',
                            border: `2px solid ${isSelected ? '#8b5cf6' : 'rgba(139, 92, 246, 0.3)'}`,
                            background: isSelected ? '#8b5cf6' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            {isSelected && <Check style={{ width: '12px', height: '12px', color: 'white' }} />}
                          </div>
                          {type}
                        </div>
                        <span style={{ color: '#64748b', fontSize: '11px' }}>{count}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* Área de Atuação Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => { setShowAreaDropdown(!showAreaDropdown); setShowSegmentoDropdown(false); setShowEscopoDropdown(false); setShowSortDropdown(false); }}
            style={{
              padding: '10px 14px',
              background: filterAreaAtuacao.length > 0 ? 'rgba(6, 182, 212, 0.2)' : 'rgba(30, 27, 75, 0.6)',
              border: `1px solid ${filterAreaAtuacao.length > 0 ? '#06b6d4' : 'rgba(139, 92, 246, 0.2)'}`,
              borderRadius: '10px',
              color: filterAreaAtuacao.length > 0 ? '#06b6d4' : '#94a3b8',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              minWidth: '130px'
            }}
          >
            {filterAreaAtuacao.length === 0 ? 'Área: Todas' : `Área: ${filterAreaAtuacao.length}`}
            <ChevronDown style={{ width: '14px', height: '14px' }} />
          </button>

          {showAreaDropdown && (
            <>
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }} onClick={() => setShowAreaDropdown(false)} />
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: '8px',
                background: '#1e1b4b',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                borderRadius: '12px',
                padding: '8px',
                minWidth: '220px',
                maxHeight: '350px',
                overflowY: 'auto',
                zIndex: 100,
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
              }}>
                {filterAreaAtuacao.length > 0 && (
                  <button
                    onClick={() => setFilterAreaAtuacao([])}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      marginBottom: '8px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      borderRadius: '8px',
                      color: '#ef4444',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <X style={{ width: '12px', height: '12px' }} />
                    Limpar
                  </button>
                )}
                {AREAS_ATUACAO.map(area => {
                  const isSelected = filterAreaAtuacao.includes(area.value);
                  const count = clientes.filter(c => c.area_atuacao === area.value).length;
                  if (count === 0 && !isSelected) return null;
                  return (
                    <button
                      key={area.value}
                      onClick={() => {
                        if (isSelected) {
                          setFilterAreaAtuacao(filterAreaAtuacao.filter(a => a !== area.value));
                        } else {
                          setFilterAreaAtuacao([...filterAreaAtuacao, area.value]);
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        background: isSelected ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
                        border: 'none',
                        borderRadius: '8px',
                        color: isSelected ? '#06b6d4' : '#94a3b8',
                        fontSize: '13px',
                        fontWeight: isSelected ? '500' : '400',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        textAlign: 'left'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '4px',
                          border: `2px solid ${isSelected ? '#06b6d4' : 'rgba(139, 92, 246, 0.3)'}`,
                          background: isSelected ? '#06b6d4' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {isSelected && <Check style={{ width: '12px', height: '12px', color: 'white' }} />}
                        </div>
                        {area.label}
                      </div>
                      <span style={{ color: '#64748b', fontSize: '11px' }}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Ordenação Dropdown */}
        <div style={{ position: 'relative', marginLeft: 'auto' }}>
          <button
            onClick={() => { setShowSortDropdown(!showSortDropdown); setShowSegmentoDropdown(false); setShowEscopoDropdown(false); setShowAreaDropdown(false); }}
            style={{
              padding: '10px 14px',
              background: 'rgba(30, 27, 75, 0.6)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              borderRadius: '10px',
              color: '#94a3b8',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <ArrowUpDown style={{ width: '14px', height: '14px' }} />
            Ordenar
            <ChevronDown style={{ width: '14px', height: '14px' }} />
          </button>

          {showSortDropdown && (
            <>
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }} onClick={() => setShowSortDropdown(false)} />
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '8px',
                background: '#1e1b4b',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '12px',
                padding: '8px',
                minWidth: '200px',
                zIndex: 100,
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
              }}>
                {[
                  { value: 'name_asc', label: 'Nome (A-Z)', icon: ArrowUp },
                  { value: 'name_desc', label: 'Nome (Z-A)', icon: ArrowDown },
                  { value: 'segmento_priority', label: 'Prioridade (Crítico primeiro)', icon: ArrowUp },
                  { value: 'segmento_reverse', label: 'Prioridade (Melhores primeiro)', icon: ArrowDown }
                ].map(opt => {
                  const isSelected = sortOption === opt.value;
                  const IconComponent = opt.icon;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => { setSortOption(opt.value); setShowSortDropdown(false); }}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        background: isSelected ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                        border: 'none',
                        borderRadius: '8px',
                        color: isSelected ? '#a78bfa' : '#94a3b8',
                        fontSize: '13px',
                        fontWeight: isSelected ? '500' : '400',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        textAlign: 'left'
                      }}
                    >
                      <IconComponent style={{ width: '14px', height: '14px' }} />
                      {opt.label}
                      {isSelected && <Check style={{ width: '14px', height: '14px', marginLeft: 'auto' }} />}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Linha 2: Filtro de Status */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ color: '#94a3b8', fontSize: '13px', marginRight: '4px' }}>Status:</span>
        {STATUS_OPTIONS.map(opt => {
          const isSelected = filterClienteStatus.includes(opt.value);
          return (
            <button
              key={opt.value}
              onClick={() => {
                if (isSelected) {
                  setFilterClienteStatus(filterClienteStatus.filter(s => s !== opt.value));
                } else {
                  setFilterClienteStatus([...filterClienteStatus, opt.value]);
                }
              }}
              style={{
                padding: '6px 12px',
                background: isSelected ? `${opt.color}20` : 'transparent',
                border: `1px solid ${isSelected ? opt.color : 'rgba(139, 92, 246, 0.2)'}`,
                borderRadius: '16px',
                color: isSelected ? opt.color : '#64748b',
                fontSize: '12px',
                fontWeight: isSelected ? '500' : '400',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: opt.color
              }}></span>
              {opt.label}
              <span style={{ color: isSelected ? opt.color : '#64748b', opacity: 0.7 }}>
                ({clientes.filter(c => (c.status || 'ativo') === opt.value).length})
              </span>
            </button>
          );
        })}

        {/* Botão limpar todos os filtros */}
        {(searchTerm || filterSegmento.length > 0 || filterType.length > 0 || JSON.stringify([...filterClienteStatus].sort()) !== JSON.stringify([...DEFAULT_VISIBLE_STATUS].sort())) && (
          <button
            onClick={() => {
              setSearchTerm('');
              setFilterSegmento([]);
              setFilterType([]);
              setFilterClienteStatus(DEFAULT_VISIBLE_STATUS);
              localStorage.removeItem(FILTERS_STORAGE_KEY);
            }}
            style={{
              padding: '6px 12px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '16px',
              color: '#ef4444',
              fontSize: '12px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginLeft: '8px'
            }}
          >
            <X style={{ width: '12px', height: '12px' }} />
            Limpar filtros
          </button>
        )}

        <span style={{ color: '#64748b', fontSize: '13px', marginLeft: 'auto' }}>
          {filteredClientes.length} de {clientes.length} clientes
        </span>
      </div>

      {/* Checkbox Selecionar Todos */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <button
          onClick={toggleSelectAll}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            background: selectedClientes.size === filteredClientes.length && filteredClientes.length > 0 ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '8px',
            color: '#94a3b8',
            fontSize: '13px',
            cursor: 'pointer'
          }}
        >
          {selectedClientes.size === filteredClientes.length && filteredClientes.length > 0 ? (
            <CheckSquare style={{ width: '16px', height: '16px', color: '#8b5cf6' }} />
          ) : (
            <Square style={{ width: '16px', height: '16px' }} />
          )}
          Selecionar todos ({filteredClientes.length})
        </button>
        {selectedClientes.size > 0 && (
          <span style={{ color: '#64748b', fontSize: '12px' }}>
            {selectedClientes.size} selecionados
          </span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
        {filteredClientes.length > 0 ? filteredClientes.map((cliente) => {
          const isInativo = cliente.status === 'inativo';
          const isSelected = selectedClientes.has(cliente.id);

          // Cores do card baseadas no status
          const getCardColors = () => {
            if (isSelected) return { bg: 'rgba(139, 92, 246, 0.15)', border: '2px solid rgba(139, 92, 246, 0.6)' };
            switch (cliente.status) {
              case 'onboarding':
                return { bg: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)' }; // azul
              case 'aviso_previo':
                return { bg: 'rgba(249, 115, 22, 0.15)', border: '1px solid rgba(249, 115, 22, 0.3)' }; // laranja
              case 'cancelado':
                return { bg: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)' }; // vermelho
              case 'inativo':
                return { bg: 'rgba(55, 65, 81, 0.3)', border: '1px solid rgba(107, 114, 128, 0.2)' }; // cinza
              default: // ativo
                return { bg: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)' }; // normal
            }
          };
          const cardColors = getCardColors();

          return (
          <div key={cliente.id}
            style={{
              background: cardColors.bg,
              border: cardColors.border,
              borderRadius: '12px',
              padding: '16px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              opacity: isInativo ? 0.7 : 1,
              position: 'relative'
            }}>
            <div onClick={() => navigate(`/clientes/${cliente.id}`)} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              {/* Header: Nome + Segmento */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    background: isInativo ? 'rgba(107, 114, 128, 0.3)' : `linear-gradient(135deg, ${getSegmentoColor(getClienteSegmento(cliente))} 0%, ${getSegmentoColor(getClienteSegmento(cliente))}99 100%)`,
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: '600',
                    fontSize: '16px',
                    flexShrink: 0
                  }}>
                    {cliente.team_name?.charAt(0) || 'C'}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ color: isInativo ? '#9ca3af' : 'white', fontSize: '15px', fontWeight: '600', margin: '0 0 2px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cliente.team_name}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#64748b', fontSize: '12px' }}>{cliente.team_type || 'Sem tipo'}</span>
                      {cliente.area_atuacao && (
                        <span style={{
                          padding: '2px 8px',
                          background: 'rgba(6, 182, 212, 0.1)',
                          border: '1px solid rgba(6, 182, 212, 0.2)',
                          borderRadius: '6px',
                          color: '#06b6d4',
                          fontSize: '10px',
                          fontWeight: '500'
                        }}>
                          {getAreaLabel(cliente.area_atuacao)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <SegmentoBadge segmento={getClienteSegmento(cliente)} size="sm" />
              </div>

              {/* Footer: Responsavel + Acoes */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users style={{ width: '14px', height: '14px', color: '#64748b', flexShrink: 0 }} />
                  <span style={{ color: '#94a3b8', fontSize: '12px' }}>
                    {(cliente.responsaveis && cliente.responsaveis.length > 0)
                      ? cliente.responsaveis.map(r => r.nome?.split(' ')[0] || r.email?.split('@')[0]).join(', ')
                      : cliente.responsavel_nome?.split(' ')[0] || 'Sem resp.'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSelectCliente(cliente.id); }}
                    style={{
                      width: '28px',
                      height: '28px',
                      background: isSelected ? 'rgba(139, 92, 246, 0.3)' : 'transparent',
                      border: 'none',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                    title={isSelected ? 'Desmarcar' : 'Selecionar'}
                  >
                    {isSelected ? (
                      <CheckSquare style={{ width: '16px', height: '16px', color: '#8b5cf6' }} />
                    ) : (
                      <Square style={{ width: '16px', height: '16px', color: '#64748b' }} />
                    )}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/clientes/${cliente.id}/editar`); }}
                    style={{
                      width: '28px',
                      height: '28px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                    title="Editar"
                  >
                    <Pencil style={{ width: '14px', height: '14px', color: '#64748b' }} />
                  </button>
                  <ChevronRight style={{ width: '16px', height: '16px', color: '#64748b' }} />
                </div>
              </div>
            </div>{/* fecha div do clickable area */}
          </div>
        )}) : (
          <div style={{ gridColumn: '1 / -1', padding: '48px', textAlign: 'center', background: 'rgba(30, 27, 75, 0.4)', borderRadius: '16px', border: '1px solid rgba(139, 92, 246, 0.15)' }}>
            <Users style={{ width: '48px', height: '48px', color: '#64748b', margin: '0 auto 16px' }} />
            <p style={{ color: '#94a3b8', fontSize: '16px', margin: 0 }}>Nenhum cliente encontrado</p>
          </div>
        )}
      </div>

      {/* Modal de Times Órfãos */}
      {showOrphanModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '32px' }}>
          <div style={{ background: '#1a1033', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '20px', width: '100%', maxWidth: '600px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  background: 'rgba(245, 158, 11, 0.2)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <AlertTriangle style={{ width: '20px', height: '20px', color: '#f59e0b' }} />
                </div>
                <div>
                  <h3 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: '0 0 4px 0' }}>Times Aguardando Atribuição</h3>
                  <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>{orphanTimes.length} times órfãos</p>
                </div>
              </div>
              <button onClick={() => setShowOrphanModal(false)} style={{ width: '36px', height: '36px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X style={{ width: '18px', height: '18px', color: '#ef4444' }} />
              </button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {orphanTimes.map(time => (
                  <div key={time.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px',
                    background: 'rgba(15, 10, 31, 0.6)',
                    border: '1px solid rgba(245, 158, 11, 0.2)',
                    borderRadius: '12px'
                  }}>
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
                        <Building2 style={{ width: '20px', height: '20px', color: '#fbbf24' }} />
                      </div>
                      <div>
                        <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: '0 0 4px 0' }}>{time.team_name}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ color: '#64748b', fontSize: '12px' }}>{time.team_type || 'Sem tipo'}</span>
                          <span style={{ color: '#94a3b8', fontSize: '12px' }}>{usuariosCount[time.id] || 0} usuários</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setShowOrphanModal(false);
                        // Navegar para edição do cliente (quando existir) ou mostrar lista
                        navigate(`/clientes?vincular_time=${time.id}&time_name=${encodeURIComponent(time.team_name)}`);
                      }}
                      style={{
                        padding: '8px 16px',
                        background: 'rgba(139, 92, 246, 0.2)',
                        border: '1px solid rgba(139, 92, 246, 0.3)',
                        borderRadius: '8px',
                        color: '#a78bfa',
                        fontSize: '13px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Link style={{ width: '14px', height: '14px' }} />
                      Vincular a Cliente
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {showDeleteModal && clienteToDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '32px' }}>
          <div style={{ background: '#1a1033', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '20px', width: '100%', maxWidth: '450px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                background: 'rgba(239, 68, 68, 0.15)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Trash2 style={{ width: '24px', height: '24px', color: '#ef4444' }} />
              </div>
              <div>
                <h3 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: '0 0 4px 0' }}>Excluir Cliente</h3>
                <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>Esta ação não pode ser desfeita</p>
              </div>
            </div>

            <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', marginBottom: '20px' }}>
              <p style={{ color: '#fca5a5', fontSize: '14px', margin: '0 0 8px 0' }}>
                Tem certeza que deseja excluir o cliente <strong style={{ color: 'white' }}>{clienteToDelete.team_name}</strong>?
              </p>
              {(clienteToDelete.times || []).length > 0 && (
                <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>
                  Os {(clienteToDelete.times || []).length} times vinculados ficarão órfãos e precisarão ser reatribuídos.
                </p>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => { setShowDeleteModal(false); setClienteToDelete(null); }}
                style={{
                  padding: '12px 20px',
                  background: 'rgba(15, 10, 31, 0.6)',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  borderRadius: '12px',
                  color: '#94a3b8',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleting}
                style={{
                  padding: '12px 20px',
                  background: deleting ? 'rgba(239, 68, 68, 0.5)' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  border: 'none',
                  borderRadius: '12px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: deleting ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Trash2 style={{ width: '16px', height: '16px' }} />
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição em Lote */}
      {showBatchModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '32px' }}>
          <div style={{ background: '#1a1033', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '20px', width: '100%', maxWidth: '500px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                background: 'rgba(139, 92, 246, 0.15)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Edit3 style={{ width: '24px', height: '24px', color: '#8b5cf6' }} />
              </div>
              <div>
                <h3 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: '0 0 4px 0' }}>
                  Editar em Lote
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>
                  {selectedClientes.size} clientes selecionados
                </p>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '8px' }}>
                {batchField === 'status' && 'Novo Status'}
                {batchField === 'responsavel' && 'Novo Responsável'}
                {batchField === 'team_type' && 'Novo Tipo'}
                {batchField === 'area_atuacao' && 'Nova Área de Atuação'}
              </label>

              {batchField === 'status' && (
                <select
                  value={batchValue}
                  onChange={(e) => setBatchValue(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#0f0a1f',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '12px',
                    color: 'white',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                >
                  <option value="" style={{ background: '#1e1b4b' }}>Selecione um status...</option>
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value} style={{ background: '#1e1b4b' }}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}

              {batchField === 'responsavel' && (
                <select
                  value={batchValue}
                  onChange={(e) => setBatchValue(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#0f0a1f',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '12px',
                    color: 'white',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                >
                  <option value="" style={{ background: '#1e1b4b' }}>Selecione um responsável...</option>
                  {responsaveis.map(resp => (
                    <option key={resp} value={resp} style={{ background: '#1e1b4b' }}>
                      {resp}
                    </option>
                  ))}
                </select>
              )}

              {batchField === 'team_type' && (
                <select
                  value={batchValue}
                  onChange={(e) => setBatchValue(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#0f0a1f',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '12px',
                    color: 'white',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                >
                  <option value="" style={{ background: '#1e1b4b' }}>Selecione um tipo...</option>
                  {teamTypes.map(type => (
                    <option key={type} value={type} style={{ background: '#1e1b4b' }}>
                      {type}
                    </option>
                  ))}
                </select>
              )}

              {batchField === 'area_atuacao' && (
                <select
                  value={batchValue}
                  onChange={(e) => setBatchValue(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#0f0a1f',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '12px',
                    color: 'white',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                >
                  <option value="" style={{ background: '#1e1b4b' }}>Selecione uma área...</option>
                  {AREAS_ATUACAO.map(area => (
                    <option key={area.value} value={area.value} style={{ background: '#1e1b4b' }}>
                      {area.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div style={{ padding: '12px 16px', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '12px', marginBottom: '20px' }}>
              <p style={{ color: '#a78bfa', fontSize: '13px', margin: 0 }}>
                Esta ação irá alterar {selectedClientes.size} clientes de uma vez.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => { setShowBatchModal(false); setBatchField(''); setBatchValue(''); }}
                style={{
                  padding: '12px 20px',
                  background: 'rgba(15, 10, 31, 0.6)',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  borderRadius: '12px',
                  color: '#94a3b8',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleBatchUpdate}
                disabled={!batchValue || batchUpdating}
                style={{
                  padding: '12px 20px',
                  background: !batchValue || batchUpdating ? 'rgba(139, 92, 246, 0.3)' : 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                  border: 'none',
                  borderRadius: '12px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: !batchValue || batchUpdating ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <CheckSquare style={{ width: '16px', height: '16px' }} />
                {batchUpdating ? 'Aplicando...' : 'Aplicar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
