import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, orderBy, limit, where, startAfter } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, History, Search, Filter, X, ChevronDown, ChevronRight, User, FileText, Users, Settings, MessageSquare, Calendar, RefreshCw, Download, LogIn, LogOut, Clock, Shield } from 'lucide-react';
import { getActionLabel, getEntityLabel, getActionColor, formatValue } from '../utils/audit';
import { Pagination } from '../components/UI/Pagination';

const ENTITIES = [
  { value: 'cliente', label: 'Cliente', icon: Users },
  { value: 'thread', label: 'Conversa', icon: MessageSquare },
  { value: 'usuario_sistema', label: 'Usuário do Sistema', icon: User },
  { value: 'config', label: 'Configuração', icon: Settings },
  { value: 'auth', label: 'Autenticação', icon: Shield },
  { value: 'system', label: 'Sistema', icon: Settings }
];

const ACTIONS = [
  { value: 'create', label: 'Criação', color: '#10b981' },
  { value: 'update', label: 'Atualização', color: '#8b5cf6' },
  { value: 'delete', label: 'Exclusão', color: '#ef4444' },
  { value: 'login_sucesso', label: 'Login', color: '#10b981' },
  { value: 'login_falha', label: 'Login Falhou', color: '#ef4444' },
  { value: 'logout', label: 'Logout', color: '#64748b' },
  { value: 'session_timeout', label: 'Sessão Expirada', color: '#f59e0b' },
  { value: 'backup_firestore', label: 'Backup', color: '#06b6d4' }
];

const PAGE_SIZE = 50;

export default function Auditoria() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedLog, setExpandedLog] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntity, setSelectedEntity] = useState('todos');
  const [selectedAction, setSelectedAction] = useState('todos');
  const [selectedUser, setSelectedUser] = useState('todos');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Unique users from logs
  const [uniqueUsers, setUniqueUsers] = useState([]);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const logsRef = collection(db, 'audit_logs');
      const logsQuery = query(logsRef, orderBy('timestamp', 'desc'), limit(500));
      const snapshot = await getDocs(logsQuery);

      const logsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setLogs(logsData);

      // Extract unique users
      const users = [...new Set(logsData.map(l => l.user_email).filter(Boolean))];
      setUniqueUsers(users);
    } catch (error) {
      console.error('Erro ao buscar logs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesName = (log.entity_name || '').toLowerCase().includes(search);
        const matchesUser = (log.user_email || '').toLowerCase().includes(search);
        const matchesUserName = (log.user_name || '').toLowerCase().includes(search);
        if (!matchesName && !matchesUser && !matchesUserName) {
          return false;
        }
      }

      // Entity filter
      if (selectedEntity !== 'todos' && log.entity !== selectedEntity) {
        return false;
      }

      // Action filter
      if (selectedAction !== 'todos' && log.action !== selectedAction) {
        return false;
      }

      // User filter
      if (selectedUser !== 'todos' && log.user_email !== selectedUser) {
        return false;
      }

      // Date filters
      if (startDate || endDate) {
        const logDate = log.timestamp?.toDate?.() || new Date(log.created_at);
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (logDate < start) return false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (logDate > end) return false;
        }
      }

      return true;
    });
  }, [logs, searchTerm, selectedEntity, selectedAction, selectedUser, startDate, endDate]);

  // Paginação de exibição
  const totalPages = Math.ceil(filteredLogs.length / PAGE_SIZE);
  const logsPaginados = filteredLogs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Resetar página ao mudar filtros
  useEffect(() => { setCurrentPage(1); }, [searchTerm, selectedEntity, selectedAction, selectedUser, startDate, endDate]);

  const hasFilters = searchTerm || selectedEntity !== 'todos' || selectedAction !== 'todos' || selectedUser !== 'todos' || startDate || endDate;

  const clearFilters = () => {
    setSearchTerm('');
    setSelectedEntity('todos');
    setSelectedAction('todos');
    setSelectedUser('todos');
    setStartDate('');
    setEndDate('');
  };

  // Exportar para CSV
  const exportToCSV = () => {
    if (filteredLogs.length === 0) return;

    const headers = ['Data/Hora', 'Usuário', 'Email', 'Ação', 'Entidade', 'Nome', 'Alterações'];

    const rows = filteredLogs.map(log => {
      const timestamp = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.created_at);
      const formattedDate = timestamp.toLocaleDateString('pt-BR') + ' ' + timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const changes = log.changes ? Object.entries(log.changes).map(([field, values]) =>
        `${field}: ${formatValue(values.old)} → ${formatValue(values.new)}`
      ).join('; ') : '';

      return [
        formattedDate,
        log.user_name || '-',
        log.user_email || '-',
        getActionLabel(log.action),
        getEntityLabel(log.entity),
        log.entity_name || '-',
        changes
      ];
    });

    // Criar conteúdo CSV
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Download do arquivo
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `auditoria_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'agora';
    if (diffMins < 60) return `há ${diffMins}min`;
    if (diffHours < 24) return `há ${diffHours}h`;
    if (diffDays < 7) return `há ${diffDays}d`;
    return '';
  };

  const getEntityIcon = (entity) => {
    const found = ENTITIES.find(e => e.value === entity);
    return found?.icon || FileText;
  };

  const renderChanges = (changes) => {
    if (!changes || Object.keys(changes).length === 0) {
      return <span style={{ color: '#64748b', fontStyle: 'italic' }}>Sem detalhes</span>;
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {Object.entries(changes).map(([field, values]) => (
          <div key={field} style={{
            padding: '10px 12px',
            background: 'rgba(15, 10, 31, 0.6)',
            borderRadius: '8px',
            border: '1px solid rgba(139, 92, 246, 0.1)'
          }}>
            <span style={{ color: '#8b5cf6', fontSize: '12px', fontWeight: '600', textTransform: 'capitalize' }}>
              {field.replace(/_/g, ' ')}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
              <span style={{ color: '#ef4444', fontSize: '13px', textDecoration: 'line-through' }}>
                {formatValue(values.old)}
              </span>
              <ChevronRight style={{ width: '14px', height: '14px', color: '#64748b' }} />
              <span style={{ color: '#10b981', fontSize: '13px' }}>
                {formatValue(values.new)}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
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
      <div style={{ marginBottom: '32px' }}>
        <button
          onClick={() => navigate('/configuracoes')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: '#94a3b8', fontSize: '14px', cursor: 'pointer', marginBottom: '16px', padding: 0 }}
        >
          <ArrowLeft style={{ width: '18px', height: '18px' }} />
          Voltar para Configurações
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '56px',
              height: '56px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(139, 92, 246, 0.3)'
            }}>
              <History style={{ width: '28px', height: '28px', color: 'white' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: 'white', margin: '0 0 4px 0' }}>Histórico de Auditoria</h1>
              <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>
                {filteredLogs.length} registro{filteredLogs.length !== 1 ? 's' : ''} encontrado{filteredLogs.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={exportToCSV}
              disabled={filteredLogs.length === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                background: filteredLogs.length > 0 ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'rgba(100, 116, 139, 0.2)',
                border: 'none',
                borderRadius: '12px',
                color: 'white',
                fontWeight: '500',
                cursor: filteredLogs.length > 0 ? 'pointer' : 'not-allowed',
                fontSize: '14px'
              }}
            >
              <Download style={{ width: '16px', height: '16px' }} />
              Exportar CSV
            </button>
            <button
              onClick={() => fetchLogs(true)}
              disabled={refreshing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                background: 'rgba(139, 92, 246, 0.1)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '12px',
                color: '#a78bfa',
                fontWeight: '500',
                cursor: refreshing ? 'not-allowed' : 'pointer',
                fontSize: '14px'
              }}
            >
              <RefreshCw style={{ width: '16px', height: '16px', animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
              {refreshing ? 'Atualizando...' : 'Atualizar'}
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        background: 'rgba(30, 27, 75, 0.4)',
        border: '1px solid rgba(139, 92, 246, 0.15)',
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
            <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: '#64748b' }} />
            <input
              type="text"
              placeholder="Buscar por nome ou usuário..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px 10px 44px',
                background: '#0f0a1f',
                border: '1px solid #3730a3',
                borderRadius: '10px',
                color: 'white',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Entity filter */}
          <select
            value={selectedEntity}
            onChange={(e) => setSelectedEntity(e.target.value)}
            style={{
              padding: '10px 14px',
              background: '#0f0a1f',
              border: '1px solid #3730a3',
              borderRadius: '10px',
              color: selectedEntity !== 'todos' ? 'white' : '#64748b',
              fontSize: '13px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="todos" style={{ background: '#1e1b4b' }}>Todas entidades</option>
            {ENTITIES.map(e => (
              <option key={e.value} value={e.value} style={{ background: '#1e1b4b' }}>{e.label}</option>
            ))}
          </select>

          {/* Action filter */}
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            style={{
              padding: '10px 14px',
              background: '#0f0a1f',
              border: '1px solid #3730a3',
              borderRadius: '10px',
              color: selectedAction !== 'todos' ? 'white' : '#64748b',
              fontSize: '13px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="todos" style={{ background: '#1e1b4b' }}>Todas ações</option>
            {ACTIONS.map(a => (
              <option key={a.value} value={a.value} style={{ background: '#1e1b4b' }}>{a.label}</option>
            ))}
          </select>

          {/* User filter */}
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            style={{
              padding: '10px 14px',
              background: '#0f0a1f',
              border: '1px solid #3730a3',
              borderRadius: '10px',
              color: selectedUser !== 'todos' ? 'white' : '#64748b',
              fontSize: '13px',
              outline: 'none',
              cursor: 'pointer',
              maxWidth: '200px'
            }}
          >
            <option value="todos" style={{ background: '#1e1b4b' }}>Todos usuários</option>
            {uniqueUsers.map(u => (
              <option key={u} value={u} style={{ background: '#1e1b4b' }}>{u}</option>
            ))}
          </select>

          {/* Start date */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ color: '#64748b', fontSize: '11px' }}>De</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{
                padding: '8px 12px',
                background: '#0f0a1f',
                border: '1px solid #3730a3',
                borderRadius: '10px',
                color: startDate ? 'white' : '#64748b',
                fontSize: '13px',
                outline: 'none',
                cursor: 'pointer'
              }}
            />
          </div>

          {/* End date */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ color: '#64748b', fontSize: '11px' }}>Até</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{
                padding: '8px 12px',
                background: '#0f0a1f',
                border: '1px solid #3730a3',
                borderRadius: '10px',
                color: endDate ? 'white' : '#64748b',
                fontSize: '13px',
                outline: 'none',
                cursor: 'pointer'
              }}
            />
          </div>

          {/* Clear filters */}
          {hasFilters && (
            <button
              onClick={clearFilters}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 14px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '10px',
                color: '#ef4444',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              <X style={{ width: '14px', height: '14px' }} />
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Logs List */}
      <div style={{
        background: 'rgba(30, 27, 75, 0.4)',
        border: '1px solid rgba(139, 92, 246, 0.15)',
        borderRadius: '20px',
        overflow: 'hidden'
      }}>
        {logsPaginados.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {logsPaginados.map((log, index) => {
              const EntityIcon = getEntityIcon(log.entity);
              const isExpanded = expandedLog === log.id;
              const hasChanges = log.changes && Object.keys(log.changes).length > 0;

              return (
                <div
                  key={log.id}
                  style={{
                    padding: '16px 24px',
                    borderBottom: index < logsPaginados.length - 1 ? '1px solid rgba(139, 92, 246, 0.1)' : 'none',
                    background: isExpanded ? 'rgba(139, 92, 246, 0.05)' : 'transparent'
                  }}
                >
                  <div
                    onClick={() => hasChanges && setExpandedLog(isExpanded ? null : log.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      cursor: hasChanges ? 'pointer' : 'default'
                    }}
                  >
                    {/* Action indicator */}
                    <div style={{
                      width: '4px',
                      height: '48px',
                      background: getActionColor(log.action),
                      borderRadius: '2px',
                      flexShrink: 0
                    }} />

                    {/* Entity icon */}
                    <div style={{
                      width: '40px',
                      height: '40px',
                      background: `${getActionColor(log.action)}20`,
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <EntityIcon style={{ width: '20px', height: '20px', color: getActionColor(log.action) }} />
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                        <span style={{
                          padding: '2px 8px',
                          background: `${getActionColor(log.action)}20`,
                          color: getActionColor(log.action),
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '600',
                          textTransform: 'uppercase'
                        }}>
                          {getActionLabel(log.action)}
                        </span>
                        <span style={{ color: '#94a3b8', fontSize: '13px' }}>
                          {getEntityLabel(log.entity)}
                        </span>
                        <span style={{ color: 'white', fontSize: '14px', fontWeight: '500' }}>
                          {log.entity_name || log.entity_id}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ color: '#64748b', fontSize: '12px' }}>
                          por {log.user_name || log.user_email}
                        </span>
                        <span style={{ color: '#4a4a6a', fontSize: '12px' }}>•</span>
                        <span style={{ color: '#64748b', fontSize: '12px' }}>
                          {formatTimestamp(log.timestamp)}
                        </span>
                        {formatRelativeTime(log.timestamp) && (
                          <span style={{ color: '#8b5cf6', fontSize: '11px' }}>
                            ({formatRelativeTime(log.timestamp)})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Expand indicator */}
                    {hasChanges && (
                      <ChevronDown style={{
                        width: '20px',
                        height: '20px',
                        color: '#64748b',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)',
                        transition: 'transform 0.2s ease',
                        flexShrink: 0
                      }} />
                    )}
                  </div>

                  {/* Expanded changes */}
                  {isExpanded && hasChanges && (
                    <div style={{ marginTop: '16px', marginLeft: '76px' }}>
                      <p style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '12px', fontWeight: '500' }}>
                        Alterações:
                      </p>
                      {renderChanges(log.changes)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: '64px', textAlign: 'center' }}>
            <History style={{ width: '48px', height: '48px', color: '#64748b', margin: '0 auto 16px' }} />
            <p style={{ color: '#94a3b8', fontSize: '16px', margin: '0 0 8px 0' }}>Nenhum registro encontrado</p>
            <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
              {hasFilters ? 'Tente ajustar os filtros' : 'Os registros de auditoria aparecerão aqui'}
            </p>
          </div>
        )}
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        totalItems={filteredLogs.length}
        pageSize={PAGE_SIZE}
      />
    </div>
  );
}
