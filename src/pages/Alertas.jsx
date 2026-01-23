import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Clock, UserX, AlertTriangle, AlertOctagon, Bug, RefreshCw, Check, ChevronRight, Filter, X, Play, CheckCircle, XCircle, ExternalLink, ListTodo, Loader2 } from 'lucide-react';
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
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

// Mapeamento de ícones por tipo
const TIPO_ICONS = {
  sem_contato: Clock,
  sentimento_negativo: AlertTriangle,
  health_critico: AlertTriangle,
  erro_bug: Bug,
  time_orfao: UserX,
  aviso_previo: AlertOctagon,
};

export default function Alertas() {
  const navigate = useNavigate();

  // Filtros
  const [filtroTipos, setFiltroTipos] = useState([]);
  const [filtroPrioridades, setFiltroPrioridades] = useState([]);
  const [filtroStatus, setFiltroStatus] = useState(['pendente', 'em_andamento']);
  const [filtroResponsavel, setFiltroResponsavel] = useState('todos');
  const [filtroTeamType, setFiltroTeamType] = useState('todos');

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

  // Hooks
  const { alertas, loading, refetch } = useAlertas({
    tipos: filtroTipos.length > 0 ? filtroTipos : undefined,
    prioridades: filtroPrioridades.length > 0 ? filtroPrioridades : undefined,
    status: filtroStatus.length > 0 ? filtroStatus : undefined,
  });
  const { counts } = useAlertasCount();
  const { atualizarStatus, updating } = useAtualizarAlerta();
  const { verificarEGerarAlertas, verificando, resultados } = useVerificarAlertas();

  // Responsáveis únicos e tipos de time
  const responsaveis = [...new Set(alertas.map(a => a.responsavel_nome).filter(Boolean))].sort();
  const teamTypes = [...new Set(alertas.map(a => a.team_type).filter(Boolean))].sort();

  // Filtrar alertas por responsável e team_type (localmente)
  const alertasFiltrados = alertas.filter(a => {
    const matchResponsavel = filtroResponsavel === 'todos' || a.responsavel_nome === filtroResponsavel;
    const matchTeamType = filtroTeamType === 'todos' || a.team_type === filtroTeamType;
    return matchResponsavel && matchTeamType;
  });

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

  // Handler para verificar novos alertas
  const handleVerificar = async () => {
    await verificarEGerarAlertas();
    refetch();
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
    setFiltroStatus(['pendente', 'em_andamento']);
    setFiltroResponsavel('todos');
    setFiltroTeamType('todos');
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
        <button
          onClick={handleVerificar}
          disabled={verificando}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 20px',
            background: verificando ? 'rgba(139, 92, 246, 0.5)' : 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
            border: 'none',
            borderRadius: '12px',
            color: 'white',
            fontSize: '14px',
            fontWeight: '600',
            cursor: verificando ? 'not-allowed' : 'pointer'
          }}
        >
          <RefreshCw style={{ width: '18px', height: '18px', animation: verificando ? 'spin 1s linear infinite' : 'none' }} />
          {verificando ? 'Verificando...' : 'Verificar Novos Alertas'}
        </button>
      </div>

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
            {resultados.verificados.times} times • {resultados.verificados.clientes} clientes
          </span>
        </div>
      )}

      {/* Filtros */}
      <div style={{
        background: 'rgba(30, 27, 75, 0.4)',
        border: '1px solid rgba(139, 92, 246, 0.15)',
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <Filter style={{ width: '18px', height: '18px', color: '#8b5cf6' }} />
          <span style={{ color: 'white', fontSize: '14px', fontWeight: '600' }}>Filtros</span>
          {(filtroTipos.length > 0 || filtroPrioridades.length > 0 || filtroStatus.length !== 2 || filtroResponsavel !== 'todos') && (
            <button
              onClick={limparFiltros}
              style={{
                padding: '4px 10px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                color: '#ef4444',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <X style={{ width: '12px', height: '12px' }} />
              Limpar
            </button>
          )}
        </div>

        {/* Status */}
        <div style={{ marginBottom: '16px' }}>
          <span style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '8px', display: 'block' }}>Status:</span>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {Object.values(ALERTA_STATUS).map(status => {
              const isSelected = filtroStatus.includes(status.value);
              return (
                <button
                  key={status.value}
                  onClick={() => toggleFiltroStatus(status.value)}
                  style={{
                    padding: '6px 12px',
                    background: isSelected ? `${status.color}20` : 'transparent',
                    border: `1px solid ${isSelected ? status.color : 'rgba(139, 92, 246, 0.2)'}`,
                    borderRadius: '16px',
                    color: isSelected ? status.color : '#64748b',
                    fontSize: '12px',
                    fontWeight: isSelected ? '500' : '400',
                    cursor: 'pointer'
                  }}
                >
                  {status.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Prioridade */}
        <div style={{ marginBottom: '16px' }}>
          <span style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '8px', display: 'block' }}>Prioridade:</span>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {Object.values(ALERTA_PRIORIDADES).map(prio => {
              const isSelected = filtroPrioridades.includes(prio.value);
              return (
                <button
                  key={prio.value}
                  onClick={() => toggleFiltroPrioridade(prio.value)}
                  style={{
                    padding: '6px 12px',
                    background: isSelected ? `${prio.color}20` : 'transparent',
                    border: `1px solid ${isSelected ? prio.color : 'rgba(139, 92, 246, 0.2)'}`,
                    borderRadius: '16px',
                    color: isSelected ? prio.color : '#64748b',
                    fontSize: '12px',
                    fontWeight: isSelected ? '500' : '400',
                    cursor: 'pointer'
                  }}
                >
                  {prio.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tipo */}
        <div>
          <span style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '8px', display: 'block' }}>Tipo:</span>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {Object.values(ALERTA_TIPOS).map(tipo => {
              const isSelected = filtroTipos.includes(tipo.value);
              return (
                <button
                  key={tipo.value}
                  onClick={() => toggleFiltroTipo(tipo.value)}
                  style={{
                    padding: '6px 12px',
                    background: isSelected ? `${tipo.color}20` : 'transparent',
                    border: `1px solid ${isSelected ? tipo.color : 'rgba(139, 92, 246, 0.2)'}`,
                    borderRadius: '16px',
                    color: isSelected ? tipo.color : '#64748b',
                    fontSize: '12px',
                    fontWeight: isSelected ? '500' : '400',
                    cursor: 'pointer'
                  }}
                >
                  {tipo.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tipo de Time */}
        <div>
          <span style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '8px', display: 'block' }}>Tipo de Time:</span>
          <select
            value={filtroTeamType}
            onChange={(e) => setFiltroTeamType(e.target.value)}
            style={{
              padding: '8px 12px',
              background: 'rgba(30, 27, 75, 0.4)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              borderRadius: '8px',
              color: 'white',
              fontSize: '12px',
              outline: 'none',
              cursor: 'pointer',
              minWidth: '140px'
            }}
          >
            <option value="todos" style={{ background: '#1e1b4b' }}>Todos</option>
            {teamTypes.map(type => (
              <option key={type} value={type} style={{ background: '#1e1b4b' }}>{type}</option>
            ))}
          </select>
        </div>

        {/* Responsável */}
        <div>
          <span style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '8px', display: 'block' }}>Responsável:</span>
          <select
            value={filtroResponsavel}
            onChange={(e) => setFiltroResponsavel(e.target.value)}
            style={{
              padding: '8px 12px',
              background: 'rgba(30, 27, 75, 0.4)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              borderRadius: '8px',
              color: 'white',
              fontSize: '12px',
              outline: 'none',
              cursor: 'pointer',
              minWidth: '140px'
            }}
          >
            <option value="todos" style={{ background: '#1e1b4b' }}>Todos</option>
            {responsaveis.map(resp => (
              <option key={resp} value={resp} style={{ background: '#1e1b4b' }}>{resp}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Lista de Alertas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {alertasFiltrados.length > 0 ? alertasFiltrados.map(alerta => {
          const tipoInfo = getTipoInfo(alerta.tipo);
          const prioridadeInfo = getPrioridadeInfo(alerta.prioridade);
          const statusInfo = getStatusInfo(alerta.status);
          const IconComponent = TIPO_ICONS[alerta.tipo] || Bell;

          return (
            <div
              key={alerta.id}
              style={{
                background: 'rgba(30, 27, 75, 0.4)',
                border: `1px solid ${alerta.prioridade === 'urgente' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(139, 92, 246, 0.15)'}`,
                borderRadius: '16px',
                padding: '20px',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
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
                {(alerta.status === 'pendente' || alerta.status === 'em_andamento') && (
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
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
                  </div>
                )}
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
                    onChange={(e) => setClickUpPrioridade(parseInt(e.target.value))}
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
    </div>
  );
}
