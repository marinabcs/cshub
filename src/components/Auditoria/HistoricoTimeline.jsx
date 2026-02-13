/**
 * HistoricoTimeline Component
 * Exibe timeline de ações de auditoria para uma entidade
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  buscarHistorico,
  formatarDescricaoAcao,
  getIconeAcao,
  getCorAcao,
  ACOES,
} from '../../services/auditService';

// Ícones SVG inline para não depender de biblioteca externa
const ICONS = {
  tag: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  ),
  'refresh-cw': (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
  'user-plus': (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="20" y1="8" x2="20" y2="14" />
      <line x1="23" y1="11" x2="17" y2="11" />
    </svg>
  ),
  'alert-triangle': (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  'check-circle': (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  edit: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  'file-text': (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  archive: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  ),
  activity: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  loader: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
    </svg>
  ),
};

// Cores para os tipos de ação
const CORES = {
  blue: {
    bg: '#EFF6FF',
    border: '#3B82F6',
    text: '#1D4ED8',
  },
  purple: {
    bg: '#F5F3FF',
    border: '#8B5CF6',
    text: '#6D28D9',
  },
  green: {
    bg: '#ECFDF5',
    border: '#10B981',
    text: '#047857',
  },
  orange: {
    bg: '#FFF7ED',
    border: '#F97316',
    text: '#C2410C',
  },
  gray: {
    bg: '#F9FAFB',
    border: '#6B7280',
    text: '#374151',
  },
};

/**
 * Formata uma data para exibição relativa ou absoluta
 * @param {Date|string} data - Data a formatar
 * @returns {string} - Data formatada
 */
function formatarData(data) {
  if (!data) return '';

  const date = data instanceof Date ? data : new Date(data);
  const agora = new Date();
  const diffMs = agora - date;
  const diffMinutos = Math.floor(diffMs / (1000 * 60));
  const diffHoras = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutos < 1) return 'Agora mesmo';
  if (diffMinutos < 60) return `${diffMinutos}min atrás`;
  if (diffHoras < 24) return `${diffHoras}h atrás`;
  if (diffDias < 7) return `${diffDias}d atrás`;

  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: date.getFullYear() !== agora.getFullYear() ? 'numeric' : undefined,
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Item individual da timeline
 */
function TimelineItem({ log, isLast }) {
  const [expandido, setExpandido] = useState(false);
  const cor = CORES[getCorAcao(log.acao)] || CORES.gray;
  const icone = getIconeAcao(log.acao);
  const descricao = formatarDescricaoAcao(log);

  const temDetalhes = log.dados_anteriores || log.dados_novos;

  return (
    <div className="timeline-item" style={{ display: 'flex', gap: '12px' }}>
      {/* Linha vertical e ícone */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: cor.bg,
            border: `2px solid ${cor.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: cor.text,
            flexShrink: 0,
          }}
        >
          {ICONS[icone] || ICONS.activity}
        </div>
        {!isLast && (
          <div
            style={{
              width: '2px',
              flexGrow: 1,
              backgroundColor: '#E5E7EB',
              marginTop: '4px',
            }}
          />
        )}
      </div>

      {/* Conteúdo */}
      <div style={{ flex: 1, paddingBottom: isLast ? 0 : '20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
          <div>
            <p style={{ margin: 0, fontWeight: 500, color: '#111827', fontSize: '14px' }}>
              {descricao}
            </p>
            <p style={{ margin: '4px 0 0', color: '#6B7280', fontSize: '13px' }}>
              por <span style={{ fontWeight: 500 }}>{log.usuario_nome}</span>
              {log.usuario_email && (
                <span style={{ color: '#9CA3AF' }}> ({log.usuario_email})</span>
              )}
            </p>
          </div>
          <span style={{ color: '#9CA3AF', fontSize: '12px', whiteSpace: 'nowrap' }}>
            {formatarData(log.created_at)}
          </span>
        </div>

        {/* Detalhes expandíveis */}
        {temDetalhes && (
          <div style={{ marginTop: '8px' }}>
            <button
              onClick={() => setExpandido(!expandido)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: '#6B7280',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              {expandido ? '▼' : '▶'} {expandido ? 'Ocultar detalhes' : 'Ver detalhes'}
            </button>

            {expandido && (
              <div
                style={{
                  marginTop: '8px',
                  padding: '12px',
                  backgroundColor: '#F9FAFB',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
              >
                {log.dados_anteriores && (
                  <div style={{ marginBottom: log.dados_novos ? '12px' : 0 }}>
                    <p style={{ margin: '0 0 4px', fontWeight: 600, color: '#DC2626' }}>Antes:</p>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#374151' }}>
                      {JSON.stringify(log.dados_anteriores, null, 2)}
                    </pre>
                  </div>
                )}
                {log.dados_novos && (
                  <div>
                    <p style={{ margin: '0 0 4px', fontWeight: 600, color: '#059669' }}>Depois:</p>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#374151' }}>
                      {JSON.stringify(log.dados_novos, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Componente principal de Timeline de Histórico
 */
export function HistoricoTimeline({
  firestore,
  entidadeTipo,
  entidadeId,
  limite = 50,
  titulo = 'Histórico de Ações',
  mostrarTitulo = true,
  filtroAcoes = null, // Array de tipos de ação para filtrar
  onCarregado = null,
  estiloContainer = {},
}) {
  const [logs, setLogs] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  const carregarHistorico = useCallback(async () => {
    if (!firestore || !entidadeTipo || !entidadeId) {
      setCarregando(false);
      return;
    }

    setCarregando(true);
    setErro(null);

    try {
      let resultado = await buscarHistorico(firestore, entidadeTipo, entidadeId, limite);

      // Aplicar filtro de ações se especificado
      if (filtroAcoes && Array.isArray(filtroAcoes)) {
        resultado = resultado.filter((log) => filtroAcoes.includes(log.acao));
      }

      setLogs(resultado);

      if (onCarregado) {
        onCarregado(resultado);
      }
    } catch (err) {
      setErro('Erro ao carregar histórico');
      console.error('[HistoricoTimeline] Erro:', err);
    } finally {
      setCarregando(false);
    }
  }, [firestore, entidadeTipo, entidadeId, limite, filtroAcoes, onCarregado]);

  useEffect(() => {
    carregarHistorico();
  }, [carregarHistorico]);

  // Estado de carregamento
  if (carregando) {
    return (
      <div
        style={{
          padding: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          color: '#6B7280',
          ...estiloContainer,
        }}
      >
        <span className="animate-spin">{ICONS.loader}</span>
        <span>Carregando histórico...</span>
      </div>
    );
  }

  // Estado de erro
  if (erro) {
    return (
      <div
        style={{
          padding: '24px',
          textAlign: 'center',
          color: '#DC2626',
          ...estiloContainer,
        }}
      >
        <p>{erro}</p>
        <button
          onClick={carregarHistorico}
          style={{
            marginTop: '8px',
            padding: '8px 16px',
            backgroundColor: '#FEE2E2',
            border: 'none',
            borderRadius: '6px',
            color: '#DC2626',
            cursor: 'pointer',
          }}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  // Sem histórico
  if (logs.length === 0) {
    return (
      <div
        style={{
          padding: '24px',
          textAlign: 'center',
          color: '#6B7280',
          ...estiloContainer,
        }}
      >
        <p style={{ margin: 0 }}>Nenhuma ação registrada ainda.</p>
      </div>
    );
  }

  return (
    <div style={{ ...estiloContainer }}>
      {mostrarTitulo && (
        <h3
          style={{
            margin: '0 0 16px',
            fontSize: '16px',
            fontWeight: 600,
            color: '#111827',
          }}
        >
          {titulo}
        </h3>
      )}

      <div className="timeline">
        {logs.map((log, index) => (
          <TimelineItem
            key={log.id}
            log={log}
            isLast={index === logs.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Hook para usar o histórico em componentes funcionais
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useHistorico(firestore, entidadeTipo, entidadeId, limite = 50) {
  const [logs, setLogs] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  const recarregar = useCallback(async () => {
    if (!firestore || !entidadeTipo || !entidadeId) {
      setCarregando(false);
      return;
    }

    setCarregando(true);
    setErro(null);

    try {
      const resultado = await buscarHistorico(firestore, entidadeTipo, entidadeId, limite);
      setLogs(resultado);
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }, [firestore, entidadeTipo, entidadeId, limite]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  return { logs, carregando, erro, recarregar };
}

export default HistoricoTimeline;
