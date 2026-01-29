import { useState, useMemo } from 'react';
import { MessageSquare, Mail, ChevronRight, Search, SlidersHorizontal, X, ExternalLink, Bot, ListTodo, Clock, AlertTriangle, ArrowUpDown, Filter } from 'lucide-react';
import { THREAD_CATEGORIAS, THREAD_SENTIMENTOS, getCategoriaInfo, getSentimentoInfo, isOpenAIConfigured } from '../../services/openai';
import { isClickUpConfigured } from '../../services/clickup';

// Status das threads
const THREAD_STATUS = {
  ativo: { value: 'ativo', label: 'Ativo', color: '#8b5cf6' },
  aguardando_cliente: { value: 'aguardando_cliente', label: 'Aguardando Cliente', color: '#f59e0b' },
  aguardando_equipe: { value: 'aguardando_equipe', label: 'Aguardando Equipe', color: '#06b6d4' },
  resolvido: { value: 'resolvido', label: 'Resolvido', color: '#10b981' },
  inativo: { value: 'inativo', label: 'Inativo', color: '#64748b' }
};

// Opções de ordenação
const ORDENACAO_OPTIONS = [
  { value: 'recentes', label: 'Mais recentes primeiro' },
  { value: 'antigas', label: 'Mais antigas primeiro' },
  { value: 'urgentes', label: 'Por prioridade (urgentes)' },
  { value: 'atrasados', label: 'Mais atrasados primeiro' }
];

// Função para verificar se está atrasado (aguardando equipe há mais de 2 dias)
function verificarAtraso(thread) {
  if (thread.status !== 'aguardando_equipe') return { atrasado: false, dias: 0 };

  const updated = thread.updated_at?.toDate ? thread.updated_at.toDate() : new Date(thread.updated_at);
  const agora = new Date();
  const diffMs = agora - updated;
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return { atrasado: diffDias > 2, dias: diffDias };
}

// Função para formatar data relativa
function formatarDataRelativa(timestamp) {
  if (!timestamp) return 'Sem registro';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diff = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  return `há ${diff} dias`;
}

// Função para highlight de texto
function highlightText(text, searchTerm) {
  if (!searchTerm || !text) return text;

  const parts = text.split(new RegExp(`(${searchTerm})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === searchTerm.toLowerCase()
      ? <mark key={i} style={{ background: 'rgba(139, 92, 246, 0.4)', color: 'white', padding: '0 2px', borderRadius: '2px' }}>{part}</mark>
      : part
  );
}

export default function ThreadsTimeline({
  threads,
  onThreadClick,
  onClassificarClick,
  onCriarTarefaClick,
  cliente
}) {
  // Estados dos filtros
  const [filtroCategoria, setFiltroCategoria] = useState('todos');
  const [filtroSentimento, setFiltroSentimento] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [busca, setBusca] = useState('');
  const [ordenacao, setOrdenacao] = useState('recentes');
  const [showFiltros, setShowFiltros] = useState(false);

  // Cores e labels
  const getStatusColor = (status) => THREAD_STATUS[status]?.color || '#64748b';
  const getStatusLabel = (status) => THREAD_STATUS[status]?.label || status;
  const getSentimentColor = (sentiment) => getSentimentoInfo(sentiment).color;
  const getCategoryColor = (cat) => getCategoriaInfo(cat).color;
  const getCategoryLabel = (cat) => getCategoriaInfo(cat).label;

  // Abrir no Gmail
  const abrirNoGmail = (e, threadId) => {
    e.stopPropagation();
    const gmailUrl = `https://mail.google.com/mail/u/0/#inbox/${threadId}`;
    window.open(gmailUrl, '_blank');
  };

  // Filtrar e ordenar threads
  const filteredThreads = useMemo(() => {
    let result = threads.filter(thread => {
      // Filtro por categoria
      if (filtroCategoria !== 'todos' && thread.categoria !== filtroCategoria) return false;

      // Filtro por sentimento
      if (filtroSentimento !== 'todos' && thread.sentimento !== filtroSentimento) return false;

      // Filtro por status
      if (filtroStatus !== 'todos' && thread.status !== filtroStatus) return false;

      // Filtro por período
      if (dataInicio) {
        const threadDate = thread.updated_at?.toDate ? thread.updated_at.toDate() : new Date(thread.updated_at);
        const inicio = new Date(dataInicio);
        inicio.setHours(0, 0, 0, 0);
        if (threadDate < inicio) return false;
      }

      if (dataFim) {
        const threadDate = thread.updated_at?.toDate ? thread.updated_at.toDate() : new Date(thread.updated_at);
        const fim = new Date(dataFim);
        fim.setHours(23, 59, 59, 999);
        if (threadDate > fim) return false;
      }

      // Busca por palavra-chave
      if (busca) {
        const termo = busca.toLowerCase();
        const assunto = (thread.assunto || '').toLowerCase();
        const resumo = (thread.resumo_ia || thread.resumo_chat || '').toLowerCase();
        if (!assunto.includes(termo) && !resumo.includes(termo)) return false;
      }

      return true;
    });

    // Ordenação
    result.sort((a, b) => {
      switch (ordenacao) {
        case 'recentes': {
          const dateA = a.updated_at?.toDate?.() || new Date(0);
          const dateB = b.updated_at?.toDate?.() || new Date(0);
          return dateB - dateA;
        }
        case 'antigas': {
          const dateA = a.updated_at?.toDate?.() || new Date(0);
          const dateB = b.updated_at?.toDate?.() || new Date(0);
          return dateA - dateB;
        }
        case 'urgentes': {
          const prioA = a.sentimento === 'urgente' ? 0 : a.sentimento === 'negativo' ? 1 : 2;
          const prioB = b.sentimento === 'urgente' ? 0 : b.sentimento === 'negativo' ? 1 : 2;
          return prioA - prioB;
        }
        case 'atrasados': {
          const atrasoA = verificarAtraso(a);
          const atrasoB = verificarAtraso(b);
          if (atrasoA.atrasado && !atrasoB.atrasado) return -1;
          if (!atrasoA.atrasado && atrasoB.atrasado) return 1;
          return atrasoB.dias - atrasoA.dias;
        }
        default:
          return 0;
      }
    });

    return result;
  }, [threads, filtroCategoria, filtroSentimento, filtroStatus, dataInicio, dataFim, busca, ordenacao]);

  // Verificar se há filtros ativos
  const hasActiveFilters = filtroCategoria !== 'todos' || filtroSentimento !== 'todos' ||
    filtroStatus !== 'todos' || dataInicio || dataFim || busca;

  // Limpar filtros
  const limparFiltros = () => {
    setFiltroCategoria('todos');
    setFiltroSentimento('todos');
    setFiltroStatus('todos');
    setDataInicio('');
    setDataFim('');
    setBusca('');
    setOrdenacao('recentes');
  };

  return (
    <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '20px', padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <MessageSquare style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
          <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>Timeline de Conversas</h2>
          <span style={{ padding: '4px 10px', background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa', borderRadius: '10px', fontSize: '12px' }}>
            {hasActiveFilters ? `${filteredThreads.length} de ${threads.length}` : `${threads.length} conversas`}
          </span>
        </div>
        <button
          onClick={() => setShowFiltros(!showFiltros)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            background: showFiltros || hasActiveFilters ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '10px',
            color: showFiltros || hasActiveFilters ? '#a78bfa' : '#94a3b8',
            fontSize: '13px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          <SlidersHorizontal style={{ width: '16px', height: '16px' }} />
          Filtros
          {hasActiveFilters && (
            <span style={{
              width: '18px',
              height: '18px',
              background: '#8b5cf6',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              color: 'white',
              fontWeight: '600'
            }}>
              !
            </span>
          )}
        </button>
      </div>

      {/* Barra de busca */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ position: 'relative' }}>
          <Search style={{
            position: 'absolute',
            left: '14px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '18px',
            height: '18px',
            color: '#64748b'
          }} />
          <input
            type="text"
            placeholder="Buscar por assunto ou resumo..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 14px 12px 44px',
              background: 'rgba(15, 10, 31, 0.6)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              borderRadius: '12px',
              color: 'white',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          {busca && (
            <button
              onClick={() => setBusca('')}
              style={{
                position: 'absolute',
                right: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              <X style={{ width: '16px', height: '16px', color: '#64748b' }} />
            </button>
          )}
        </div>
      </div>

      {/* Painel de filtros */}
      {showFiltros && (
        <div style={{
          padding: '16px',
          background: 'rgba(15, 10, 31, 0.6)',
          border: '1px solid rgba(139, 92, 246, 0.15)',
          borderRadius: '12px',
          marginBottom: '16px'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '12px' }}>
            {/* Categoria */}
            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '11px', marginBottom: '6px', textTransform: 'uppercase' }}>Categoria</label>
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', background: '#0f0a1f', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '8px', color: 'white', fontSize: '13px', outline: 'none', cursor: 'pointer' }}
              >
                <option value="todos" style={{ background: '#1e1b4b' }}>Todas categorias</option>
                {Object.values(THREAD_CATEGORIAS).map(cat => (
                  <option key={cat.value} value={cat.value} style={{ background: '#1e1b4b' }}>{cat.label}</option>
                ))}
              </select>
            </div>

            {/* Sentimento */}
            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '11px', marginBottom: '6px', textTransform: 'uppercase' }}>Sentimento</label>
              <select
                value={filtroSentimento}
                onChange={(e) => setFiltroSentimento(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', background: '#0f0a1f', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '8px', color: 'white', fontSize: '13px', outline: 'none', cursor: 'pointer' }}
              >
                <option value="todos" style={{ background: '#1e1b4b' }}>Todos sentimentos</option>
                {Object.values(THREAD_SENTIMENTOS).map(sent => (
                  <option key={sent.value} value={sent.value} style={{ background: '#1e1b4b' }}>{sent.emoji} {sent.label}</option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '11px', marginBottom: '6px', textTransform: 'uppercase' }}>Status</label>
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', background: '#0f0a1f', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '8px', color: 'white', fontSize: '13px', outline: 'none', cursor: 'pointer' }}
              >
                <option value="todos" style={{ background: '#1e1b4b' }}>Todos status</option>
                {Object.values(THREAD_STATUS).map(st => (
                  <option key={st.value} value={st.value} style={{ background: '#1e1b4b' }}>{st.label}</option>
                ))}
              </select>
            </div>

            {/* Ordenação */}
            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '11px', marginBottom: '6px', textTransform: 'uppercase' }}>Ordenar por</label>
              <select
                value={ordenacao}
                onChange={(e) => setOrdenacao(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', background: '#0f0a1f', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '8px', color: 'white', fontSize: '13px', outline: 'none', cursor: 'pointer' }}
              >
                {ORDENACAO_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value} style={{ background: '#1e1b4b' }}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Período */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '11px', marginBottom: '6px', textTransform: 'uppercase' }}>De</label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', background: '#0f0a1f', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '8px', color: 'white', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '11px', marginBottom: '6px', textTransform: 'uppercase' }}>Até</label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', background: '#0f0a1f', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '8px', color: 'white', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            {hasActiveFilters && (
              <button
                onClick={limparFiltros}
                style={{
                  padding: '10px 16px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '8px',
                  color: '#ef4444',
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
            )}
          </div>
        </div>
      )}

      {/* Lista de Threads */}
      {filteredThreads.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredThreads.map((thread) => {
            const atrasoInfo = verificarAtraso(thread);
            const isUrgente = thread.sentimento === 'urgente';
            const isNegativo = thread.sentimento === 'negativo';

            // Cor de fundo baseada no sentimento
            const bgColor = isUrgente
              ? 'rgba(239, 68, 68, 0.05)'
              : isNegativo
                ? 'rgba(249, 115, 22, 0.05)'
                : 'rgba(15, 10, 31, 0.6)';

            const borderColor = isUrgente
              ? 'rgba(239, 68, 68, 0.2)'
              : atrasoInfo.atrasado
                ? 'rgba(249, 115, 22, 0.3)'
                : 'rgba(139, 92, 246, 0.1)';

            return (
              <div
                key={thread.id}
                onClick={() => onThreadClick(thread)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  padding: '16px',
                  background: bgColor,
                  border: `1px solid ${borderColor}`,
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1 }}>
                  {/* Ícone com indicadores */}
                  <div style={{
                    width: '40px',
                    height: '40px',
                    background: `${getSentimentColor(thread.sentimento)}20`,
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    position: 'relative'
                  }}>
                    <Mail style={{ width: '20px', height: '20px', color: getSentimentColor(thread.sentimento) }} />
                    {isUrgente && (
                      <span style={{
                        position: 'absolute',
                        top: '-4px',
                        right: '-4px',
                        width: '12px',
                        height: '12px',
                        background: '#ef4444',
                        borderRadius: '50%',
                        border: '2px solid #1a1033',
                        animation: 'pulse 2s infinite'
                      }} />
                    )}
                  </div>

                  {/* Conteúdo */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Badges no topo */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      {/* Badge Urgente */}
                      {isUrgente && (
                        <span style={{
                          padding: '2px 8px',
                          background: 'rgba(239, 68, 68, 0.2)',
                          color: '#ef4444',
                          borderRadius: '6px',
                          fontSize: '10px',
                          fontWeight: '600',
                          textTransform: 'uppercase',
                          animation: 'pulse 2s infinite'
                        }}>
                          Urgente
                        </span>
                      )}

                      {/* Badge Atrasado */}
                      {atrasoInfo.atrasado && (
                        <span style={{
                          padding: '2px 8px',
                          background: 'rgba(249, 115, 22, 0.2)',
                          color: '#f97316',
                          borderRadius: '6px',
                          fontSize: '10px',
                          fontWeight: '600',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <AlertTriangle style={{ width: '10px', height: '10px' }} />
                          Atrasado há {atrasoInfo.dias} dias
                        </span>
                      )}

                      {/* Status */}
                      <span style={{
                        padding: '2px 8px',
                        background: `${getStatusColor(thread.status)}20`,
                        color: getStatusColor(thread.status),
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '500'
                      }}>
                        {getStatusLabel(thread.status)}
                      </span>

                      {/* Categoria */}
                      {thread.categoria && (
                        <span style={{
                          padding: '2px 8px',
                          background: `${getCategoryColor(thread.categoria)}20`,
                          color: getCategoryColor(thread.categoria),
                          borderRadius: '6px',
                          fontSize: '10px',
                          fontWeight: '500'
                        }}>
                          {getCategoryLabel(thread.categoria)}
                        </span>
                      )}

                      {/* Sentimento (se não for urgente) */}
                      {thread.sentimento && !isUrgente && (
                        <span style={{
                          padding: '2px 8px',
                          background: `${getSentimentColor(thread.sentimento)}20`,
                          color: getSentimentColor(thread.sentimento),
                          borderRadius: '6px',
                          fontSize: '10px'
                        }}>
                          {getSentimentoInfo(thread.sentimento).emoji} {getSentimentoInfo(thread.sentimento).label}
                        </span>
                      )}
                    </div>

                    {/* Assunto */}
                    <h4 style={{ color: 'white', fontWeight: '500', fontSize: '14px', margin: '0 0 4px 0' }}>
                      {busca ? highlightText(thread.assunto || 'Sem assunto', busca) : (thread.assunto || 'Sem assunto')}
                    </h4>

                    {/* Resumo */}
                    <p style={{
                      color: '#64748b',
                      fontSize: '13px',
                      margin: '0 0 10px 0',
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      lineHeight: '1.4'
                    }}>
                      {busca
                        ? highlightText(thread.resumo_ia || thread.resumo_chat || 'Sem resumo', busca)
                        : (thread.resumo_ia || thread.resumo_chat || 'Sem resumo')
                      }
                    </p>

                    {/* Ações rápidas */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {/* Abrir no Gmail */}
                      {thread.id && (
                        <button
                          onClick={(e) => abrirNoGmail(e, thread.id)}
                          style={{
                            padding: '4px 10px',
                            background: 'rgba(139, 92, 246, 0.1)',
                            border: '1px solid rgba(139, 92, 246, 0.2)',
                            borderRadius: '6px',
                            color: '#a78bfa',
                            fontSize: '11px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <ExternalLink style={{ width: '12px', height: '12px' }} />
                          Gmail
                        </button>
                      )}

                      {/* Classificar */}
                      {!thread.categoria && isOpenAIConfigured() && onClassificarClick && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onClassificarClick(thread);
                          }}
                          style={{
                            padding: '4px 10px',
                            background: 'rgba(6, 182, 212, 0.1)',
                            border: '1px solid rgba(6, 182, 212, 0.2)',
                            borderRadius: '6px',
                            color: '#06b6d4',
                            fontSize: '11px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Bot style={{ width: '12px', height: '12px' }} />
                          Classificar
                        </button>
                      )}

                      {/* Criar Tarefa ClickUp */}
                      {isClickUpConfigured() && onCriarTarefaClick && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onCriarTarefaClick(thread);
                          }}
                          style={{
                            padding: '4px 10px',
                            background: 'rgba(124, 58, 237, 0.1)',
                            border: '1px solid rgba(124, 58, 237, 0.2)',
                            borderRadius: '6px',
                            color: '#7c3aed',
                            fontSize: '11px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <ListTodo style={{ width: '12px', height: '12px' }} />
                          Tarefa
                        </button>
                      )}

                      {/* Info de mensagens e data */}
                      <span style={{ color: '#64748b', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MessageSquare style={{ width: '12px', height: '12px' }} />
                        {thread.total_mensagens || 0} msgs
                      </span>
                      <span style={{ color: '#64748b', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock style={{ width: '12px', height: '12px' }} />
                        {formatarDataRelativa(thread.updated_at)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Seta */}
                <ChevronRight style={{ width: '18px', height: '18px', color: '#64748b', marginLeft: '12px', flexShrink: 0 }} />
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ padding: '48px', textAlign: 'center' }}>
          <MessageSquare style={{ width: '48px', height: '48px', color: '#64748b', margin: '0 auto 16px' }} />
          <p style={{ color: '#94a3b8', fontSize: '16px', margin: '0 0 8px 0' }}>
            {hasActiveFilters ? 'Nenhuma conversa encontrada com os filtros aplicados' : 'Nenhuma conversa encontrada'}
          </p>
          {hasActiveFilters && (
            <button
              onClick={limparFiltros}
              style={{
                padding: '10px 20px',
                background: 'rgba(139, 92, 246, 0.1)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '10px',
                color: '#a78bfa',
                fontSize: '14px',
                cursor: 'pointer',
                marginTop: '12px'
              }}
            >
              Limpar filtros
            </button>
          )}
        </div>
      )}
    </div>
  );
}
