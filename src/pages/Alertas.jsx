import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Clock, UserX, AlertTriangle, AlertOctagon, Bug, RefreshCw, Check, ChevronRight, Filter, X, Play, CheckCircle, XCircle } from 'lucide-react';
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

  // Hooks
  const { alertas, loading, refetch } = useAlertas({
    tipos: filtroTipos.length > 0 ? filtroTipos : undefined,
    prioridades: filtroPrioridades.length > 0 ? filtroPrioridades : undefined,
    status: filtroStatus.length > 0 ? filtroStatus : undefined,
  });
  const { counts } = useAlertasCount();
  const { atualizarStatus, updating } = useAtualizarAlerta();
  const { verificarEGerarAlertas, verificando, resultados } = useVerificarAlertas();

  // Responsáveis únicos
  const responsaveis = [...new Set(alertas.map(a => a.responsavel_nome).filter(Boolean))].sort();

  // Contagens filtradas
  const countPendentes = alertas.filter(a => a.status === 'pendente').length;
  const countEmAndamento = alertas.filter(a => a.status === 'em_andamento').length;
  const countResolvidosHoje = alertas.filter(a => {
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
      </div>

      {/* Lista de Alertas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {alertas.length > 0 ? alertas.map(alerta => {
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
    </div>
  );
}
