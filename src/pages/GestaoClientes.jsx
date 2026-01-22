import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Settings2, Users, Plus, Pencil, Trash2, Link2, Unlink, Check, X, AlertTriangle, Building2, Search, RefreshCw } from 'lucide-react';

const TABS = [
  { id: 'orfaos', label: 'Times Órfãos' },
  { id: 'clientes', label: 'Clientes' },
  { id: 'novo', label: 'Novo Cliente' }
];

const TAGS_DISPONIVEIS = ['Enterprise', 'SMB', 'Startup', 'Educação', 'Governo', 'ONG', 'Agência'];

export default function GestaoClientes() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('orfaos');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data
  const [times, setTimes] = useState([]);
  const [clientes, setClientes] = useState([]);

  // Form state
  const [formData, setFormData] = useState({
    nome: '',
    responsavel_email: '',
    responsavel_nome: '',
    tags: [],
    times: []
  });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formSuccess, setFormSuccess] = useState(false);

  // Edit state
  const [editingCliente, setEditingCliente] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [clienteToDelete, setClienteToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Search
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // Fetch times
      const timesSnap = await getDocs(collection(db, 'times'));
      const timesData = timesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTimes(timesData);

      // Fetch clientes
      const clientesSnap = await getDocs(collection(db, 'clientes'));
      const clientesData = clientesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setClientes(clientesData);

    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Calculate orphan times (times not linked to any client)
  const timesOrfaos = useMemo(() => {
    const linkedTimeIds = new Set();
    clientes.forEach(cliente => {
      (cliente.times || []).forEach(timeId => linkedTimeIds.add(timeId));
    });

    return times.filter(time => !linkedTimeIds.has(time.id));
  }, [times, clientes]);

  // Filter clientes by search
  const filteredClientes = useMemo(() => {
    if (!searchTerm) return clientes;
    const search = searchTerm.toLowerCase();
    return clientes.filter(c =>
      (c.nome || '').toLowerCase().includes(search) ||
      (c.responsavel_nome || '').toLowerCase().includes(search) ||
      (c.responsavel_email || '').toLowerCase().includes(search)
    );
  }, [clientes, searchTerm]);

  // Get time info by ID
  const getTimeInfo = (timeId) => {
    return times.find(t => t.id === timeId) || { id: timeId, name: timeId };
  };

  // Toggle tag selection
  const toggleTag = (tag) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
    }));
  };

  // Toggle time selection
  const toggleTime = (timeId) => {
    setFormData(prev => ({
      ...prev,
      times: prev.times.includes(timeId)
        ? prev.times.filter(t => t !== timeId)
        : [...prev.times, timeId]
    }));
  };

  // Create new client
  const handleCreateCliente = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);
    setFormSuccess(false);

    try {
      if (!formData.nome.trim()) {
        setFormError('Nome é obrigatório');
        setFormLoading(false);
        return;
      }

      const clienteData = {
        nome: formData.nome.trim(),
        responsavel_email: formData.responsavel_email.trim(),
        responsavel_nome: formData.responsavel_nome.trim(),
        tags: formData.tags,
        times: formData.times,
        health_score: 0,
        health_status: 'atencao',
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        created_by: user?.email || 'sistema'
      };

      // Generate auto ID
      const newDocRef = doc(collection(db, 'clientes'));
      await setDoc(newDocRef, clienteData);

      setFormSuccess(true);
      setFormData({
        nome: '',
        responsavel_email: '',
        responsavel_nome: '',
        tags: [],
        times: []
      });

      // Refresh data
      await fetchData(true);

      // Switch to clientes tab after 2 seconds
      setTimeout(() => {
        setFormSuccess(false);
        setActiveTab('clientes');
      }, 2000);

    } catch (error) {
      console.error('Erro ao criar cliente:', error);
      setFormError('Erro ao criar cliente. Tente novamente.');
    } finally {
      setFormLoading(false);
    }
  };

  // Open edit modal
  const openEditModal = (cliente) => {
    setEditingCliente(cliente);
    setFormData({
      nome: cliente.nome || '',
      responsavel_email: cliente.responsavel_email || '',
      responsavel_nome: cliente.responsavel_nome || '',
      tags: cliente.tags || [],
      times: cliente.times || []
    });
    setFormError('');
    setShowEditModal(true);
  };

  // Update client
  const handleUpdateCliente = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    try {
      if (!formData.nome.trim()) {
        setFormError('Nome é obrigatório');
        setFormLoading(false);
        return;
      }

      const updateData = {
        nome: formData.nome.trim(),
        responsavel_email: formData.responsavel_email.trim(),
        responsavel_nome: formData.responsavel_nome.trim(),
        tags: formData.tags,
        times: formData.times,
        updated_at: serverTimestamp()
      };

      await updateDoc(doc(db, 'clientes', editingCliente.id), updateData);

      setShowEditModal(false);
      setEditingCliente(null);
      await fetchData(true);

    } catch (error) {
      console.error('Erro ao atualizar cliente:', error);
      setFormError('Erro ao atualizar cliente. Tente novamente.');
    } finally {
      setFormLoading(false);
    }
  };

  // Delete client
  const handleDeleteCliente = async () => {
    if (!clienteToDelete) return;

    setDeleteLoading(true);
    try {
      await deleteDoc(doc(db, 'clientes', clienteToDelete.id));
      setShowDeleteConfirm(false);
      setClienteToDelete(null);
      await fetchData(true);
    } catch (error) {
      console.error('Erro ao excluir cliente:', error);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Link orphan time to new client quickly
  const quickLinkTime = (time) => {
    setActiveTab('novo');
    setFormData(prev => ({
      ...prev,
      times: [...prev.times, time.id],
      nome: prev.nome || time.name || time.team_name || ''
    }));
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '56px',
              height: '56px',
              background: 'linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(124, 58, 237, 0.3)'
            }}>
              <Settings2 style={{ width: '28px', height: '28px', color: 'white' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: 'white', margin: '0 0 4px 0' }}>Gestão de Clientes</h1>
              <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>
                {clientes.length} cliente{clientes.length !== 1 ? 's' : ''} • {times.length} time{times.length !== 1 ? 's' : ''} • {timesOrfaos.length} órfão{timesOrfaos.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              background: 'rgba(124, 58, 237, 0.1)',
              border: '1px solid rgba(124, 58, 237, 0.3)',
              borderRadius: '12px',
              color: '#a78bfa',
              fontWeight: '500',
              cursor: refreshing ? 'not-allowed' : 'pointer',
              fontSize: '14px'
            }}
          >
            <RefreshCw style={{ width: '16px', height: '16px', animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid rgba(124, 58, 237, 0.2)', paddingBottom: '0' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 20px',
              background: activeTab === tab.id ? 'rgba(124, 58, 237, 0.15)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #7C3AED' : '2px solid transparent',
              borderRadius: '12px 12px 0 0',
              color: activeTab === tab.id ? '#a78bfa' : '#64748b',
              fontWeight: activeTab === tab.id ? '600' : '400',
              cursor: 'pointer',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {tab.label}
            {tab.id === 'orfaos' && timesOrfaos.length > 0 && (
              <span style={{
                padding: '2px 8px',
                background: '#f59e0b',
                color: 'white',
                borderRadius: '10px',
                fontSize: '11px',
                fontWeight: '600'
              }}>
                {timesOrfaos.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content: Times Órfãos */}
      {activeTab === 'orfaos' && (
        <div style={{
          background: 'rgba(30, 27, 75, 0.4)',
          border: '1px solid rgba(124, 58, 237, 0.15)',
          borderRadius: '20px',
          padding: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <Unlink style={{ width: '20px', height: '20px', color: '#f59e0b' }} />
            <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>Times Órfãos</h2>
            <span style={{ color: '#64748b', fontSize: '13px' }}>
              Times não vinculados a nenhum cliente
            </span>
          </div>

          {timesOrfaos.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
              {timesOrfaos.map(time => (
                <div
                  key={time.id}
                  style={{
                    padding: '16px',
                    background: 'rgba(15, 10, 31, 0.6)',
                    border: '1px solid rgba(245, 158, 11, 0.2)',
                    borderRadius: '12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <h3 style={{ color: 'white', fontSize: '15px', fontWeight: '600', margin: '0 0 4px 0' }}>
                        {time.name || time.team_name || time.id}
                      </h3>
                      <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>
                        {time.team_type || 'Sem tipo'}
                      </p>
                    </div>
                    <button
                      onClick={() => quickLinkTime(time)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        background: 'rgba(6, 182, 212, 0.1)',
                        border: '1px solid rgba(6, 182, 212, 0.3)',
                        borderRadius: '8px',
                        color: '#06B6D4',
                        fontSize: '12px',
                        fontWeight: '500',
                        cursor: 'pointer'
                      }}
                    >
                      <Link2 style={{ width: '14px', height: '14px' }} />
                      Vincular
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '12px' }}>
                      ID: <code style={{ color: '#8b5cf6' }}>{time.id}</code>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '48px', textAlign: 'center' }}>
              <Check style={{ width: '48px', height: '48px', color: '#10b981', margin: '0 auto 16px' }} />
              <p style={{ color: '#10b981', fontSize: '16px', fontWeight: '500', margin: '0 0 8px 0' }}>
                Todos os times estão vinculados!
              </p>
              <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
                Não há times órfãos no momento
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Clientes */}
      {activeTab === 'clientes' && (
        <div>
          {/* Search */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ position: 'relative', maxWidth: '400px' }}>
              <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: '#64748b' }} />
              <input
                type="text"
                placeholder="Buscar cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px 12px 44px',
                  background: 'rgba(30, 27, 75, 0.4)',
                  border: '1px solid rgba(124, 58, 237, 0.2)',
                  borderRadius: '12px',
                  color: 'white',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Clients List */}
          {filteredClientes.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {filteredClientes.map(cliente => (
                <div
                  key={cliente.id}
                  style={{
                    background: 'rgba(30, 27, 75, 0.4)',
                    border: '1px solid rgba(124, 58, 237, 0.15)',
                    borderRadius: '16px',
                    padding: '20px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        background: 'linear-gradient(135deg, #7C3AED 0%, #6366f1 100%)',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '20px',
                        fontWeight: '600'
                      }}>
                        {(cliente.nome || 'C').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: '0 0 4px 0' }}>
                          {cliente.nome || 'Sem nome'}
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {cliente.responsavel_nome && (
                            <span style={{ color: '#94a3b8', fontSize: '13px' }}>
                              {cliente.responsavel_nome}
                            </span>
                          )}
                          {cliente.health_score !== undefined && (
                            <span style={{
                              padding: '2px 8px',
                              background: cliente.health_score >= 70 ? 'rgba(16, 185, 129, 0.2)' :
                                         cliente.health_score >= 40 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                              color: cliente.health_score >= 70 ? '#10b981' :
                                    cliente.health_score >= 40 ? '#f59e0b' : '#ef4444',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '500'
                            }}>
                              Score: {cliente.health_score}%
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => openEditModal(cliente)}
                        style={{
                          width: '36px',
                          height: '36px',
                          background: 'rgba(124, 58, 237, 0.1)',
                          border: '1px solid rgba(124, 58, 237, 0.2)',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                        title="Editar"
                      >
                        <Pencil style={{ width: '16px', height: '16px', color: '#8b5cf6' }} />
                      </button>
                      <button
                        onClick={() => {
                          setClienteToDelete(cliente);
                          setShowDeleteConfirm(true);
                        }}
                        style={{
                          width: '36px',
                          height: '36px',
                          background: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                        title="Excluir"
                      >
                        <Trash2 style={{ width: '16px', height: '16px', color: '#ef4444' }} />
                      </button>
                    </div>
                  </div>

                  {/* Tags */}
                  {cliente.tags && cliente.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                      {cliente.tags.map(tag => (
                        <span
                          key={tag}
                          style={{
                            padding: '4px 10px',
                            background: 'rgba(6, 182, 212, 0.1)',
                            color: '#06B6D4',
                            borderRadius: '6px',
                            fontSize: '12px'
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Times vinculados */}
                  <div>
                    <p style={{ color: '#64748b', fontSize: '12px', marginBottom: '8px' }}>
                      Times vinculados ({(cliente.times || []).length}):
                    </p>
                    {(cliente.times || []).length > 0 ? (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {(cliente.times || []).map(timeId => {
                          const time = getTimeInfo(timeId);
                          return (
                            <span
                              key={timeId}
                              style={{
                                padding: '6px 12px',
                                background: 'rgba(124, 58, 237, 0.1)',
                                border: '1px solid rgba(124, 58, 237, 0.2)',
                                borderRadius: '8px',
                                color: '#a78bfa',
                                fontSize: '13px'
                              }}
                            >
                              {time.name || time.team_name || timeId}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <span style={{ color: '#64748b', fontSize: '13px', fontStyle: 'italic' }}>
                        Nenhum time vinculado
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              background: 'rgba(30, 27, 75, 0.4)',
              border: '1px solid rgba(124, 58, 237, 0.15)',
              borderRadius: '20px',
              padding: '64px',
              textAlign: 'center'
            }}>
              <Building2 style={{ width: '48px', height: '48px', color: '#64748b', margin: '0 auto 16px' }} />
              <p style={{ color: '#94a3b8', fontSize: '16px', margin: '0 0 8px 0' }}>
                {searchTerm ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
              </p>
              <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
                {searchTerm ? 'Tente ajustar a busca' : 'Clique em "Novo Cliente" para adicionar'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Novo Cliente */}
      {activeTab === 'novo' && (
        <div style={{
          background: 'rgba(30, 27, 75, 0.4)',
          border: '1px solid rgba(124, 58, 237, 0.15)',
          borderRadius: '20px',
          padding: '24px',
          maxWidth: '700px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <Plus style={{ width: '20px', height: '20px', color: '#7C3AED' }} />
            <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>Novo Cliente</h2>
          </div>

          {formSuccess && (
            <div style={{
              padding: '16px',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: '12px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <Check style={{ width: '20px', height: '20px', color: '#10b981' }} />
              <span style={{ color: '#10b981', fontSize: '14px', fontWeight: '500' }}>
                Cliente criado com sucesso!
              </span>
            </div>
          )}

          {formError && (
            <div style={{
              padding: '16px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '12px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <AlertTriangle style={{ width: '20px', height: '20px', color: '#ef4444' }} />
              <span style={{ color: '#ef4444', fontSize: '14px' }}>{formError}</span>
            </div>
          )}

          <form onSubmit={handleCreateCliente}>
            {/* Nome */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '8px' }}>
                Nome do Cliente *
              </label>
              <input
                type="text"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Stone, Banco Inter..."
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: '#0f0a1f',
                  border: '1px solid #3730a3',
                  borderRadius: '12px',
                  color: 'white',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Responsável */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '8px' }}>
                  Nome do Responsável
                </label>
                <input
                  type="text"
                  value={formData.responsavel_nome}
                  onChange={(e) => setFormData({ ...formData, responsavel_nome: e.target.value })}
                  placeholder="Nome"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#0f0a1f',
                    border: '1px solid #3730a3',
                    borderRadius: '12px',
                    color: 'white',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '8px' }}>
                  Email do Responsável
                </label>
                <input
                  type="email"
                  value={formData.responsavel_email}
                  onChange={(e) => setFormData({ ...formData, responsavel_email: e.target.value })}
                  placeholder="email@trakto.io"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#0f0a1f',
                    border: '1px solid #3730a3',
                    borderRadius: '12px',
                    color: 'white',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Tags */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '8px' }}>
                Tags
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {TAGS_DISPONIVEIS.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    style={{
                      padding: '8px 14px',
                      background: formData.tags.includes(tag) ? 'rgba(6, 182, 212, 0.2)' : 'rgba(15, 10, 31, 0.6)',
                      border: `1px solid ${formData.tags.includes(tag) ? 'rgba(6, 182, 212, 0.4)' : 'rgba(124, 58, 237, 0.1)'}`,
                      borderRadius: '8px',
                      color: formData.tags.includes(tag) ? '#06B6D4' : '#94a3b8',
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Times */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '8px' }}>
                Vincular Times ({formData.times.length} selecionado{formData.times.length !== 1 ? 's' : ''})
              </label>
              <div style={{
                maxHeight: '200px',
                overflow: 'auto',
                background: 'rgba(15, 10, 31, 0.6)',
                border: '1px solid rgba(124, 58, 237, 0.1)',
                borderRadius: '12px',
                padding: '12px'
              }}>
                {times.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {times.map(time => {
                      const isLinked = clientes.some(c => c.id !== editingCliente?.id && (c.times || []).includes(time.id));
                      const isSelected = formData.times.includes(time.id);

                      return (
                        <button
                          key={time.id}
                          type="button"
                          onClick={() => !isLinked && toggleTime(time.id)}
                          disabled={isLinked}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 12px',
                            background: isSelected ? 'rgba(124, 58, 237, 0.15)' : 'transparent',
                            border: `1px solid ${isSelected ? 'rgba(124, 58, 237, 0.3)' : 'transparent'}`,
                            borderRadius: '8px',
                            cursor: isLinked ? 'not-allowed' : 'pointer',
                            opacity: isLinked ? 0.5 : 1,
                            textAlign: 'left'
                          }}
                        >
                          <div>
                            <span style={{ color: isSelected ? '#a78bfa' : 'white', fontSize: '13px' }}>
                              {time.name || time.team_name || time.id}
                            </span>
                            <span style={{ color: '#64748b', fontSize: '11px', marginLeft: '8px' }}>
                              {time.team_type || 'Sem tipo'}
                            </span>
                          </div>
                          {isSelected && <Check style={{ width: '16px', height: '16px', color: '#7C3AED' }} />}
                          {isLinked && <span style={{ color: '#64748b', fontSize: '11px' }}>Já vinculado</span>}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', margin: 0 }}>
                    Nenhum time disponível
                  </p>
                )}
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={formLoading}
              style={{
                width: '100%',
                padding: '14px 20px',
                background: formLoading ? 'rgba(124, 58, 237, 0.5)' : 'linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)',
                border: 'none',
                borderRadius: '12px',
                color: 'white',
                fontSize: '14px',
                fontWeight: '600',
                cursor: formLoading ? 'not-allowed' : 'pointer'
              }}
            >
              {formLoading ? 'Criando...' : 'Criar Cliente'}
            </button>
          </form>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingCliente && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          padding: '32px'
        }}>
          <div style={{
            background: '#1a1033',
            border: '1px solid rgba(124, 58, 237, 0.2)',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid rgba(124, 58, 237, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h3 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>
                Editar Cliente
              </h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingCliente(null);
                }}
                style={{
                  width: '36px',
                  height: '36px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X style={{ width: '18px', height: '18px', color: '#ef4444' }} />
              </button>
            </div>

            <form onSubmit={handleUpdateCliente} style={{ padding: '24px' }}>
              {formError && (
                <div style={{
                  padding: '12px 16px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '12px',
                  marginBottom: '20px'
                }}>
                  <span style={{ color: '#ef4444', fontSize: '14px' }}>{formError}</span>
                </div>
              )}

              {/* Nome */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '8px' }}>
                  Nome do Cliente *
                </label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#0f0a1f',
                    border: '1px solid #3730a3',
                    borderRadius: '12px',
                    color: 'white',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Responsável */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '8px' }}>
                    Nome do Responsável
                  </label>
                  <input
                    type="text"
                    value={formData.responsavel_nome}
                    onChange={(e) => setFormData({ ...formData, responsavel_nome: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      background: '#0f0a1f',
                      border: '1px solid #3730a3',
                      borderRadius: '12px',
                      color: 'white',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '8px' }}>
                    Email do Responsável
                  </label>
                  <input
                    type="email"
                    value={formData.responsavel_email}
                    onChange={(e) => setFormData({ ...formData, responsavel_email: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      background: '#0f0a1f',
                      border: '1px solid #3730a3',
                      borderRadius: '12px',
                      color: 'white',
                      fontSize: '14px',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Tags */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '8px' }}>
                  Tags
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {TAGS_DISPONIVEIS.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      style={{
                        padding: '8px 14px',
                        background: formData.tags.includes(tag) ? 'rgba(6, 182, 212, 0.2)' : 'rgba(15, 10, 31, 0.6)',
                        border: `1px solid ${formData.tags.includes(tag) ? 'rgba(6, 182, 212, 0.4)' : 'rgba(124, 58, 237, 0.1)'}`,
                        borderRadius: '8px',
                        color: formData.tags.includes(tag) ? '#06B6D4' : '#94a3b8',
                        fontSize: '13px',
                        cursor: 'pointer'
                      }}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Times */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '8px' }}>
                  Times Vinculados ({formData.times.length})
                </label>
                <div style={{
                  maxHeight: '200px',
                  overflow: 'auto',
                  background: 'rgba(15, 10, 31, 0.6)',
                  border: '1px solid rgba(124, 58, 237, 0.1)',
                  borderRadius: '12px',
                  padding: '12px'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {times.map(time => {
                      const isLinkedToOther = clientes.some(c => c.id !== editingCliente.id && (c.times || []).includes(time.id));
                      const isSelected = formData.times.includes(time.id);

                      return (
                        <button
                          key={time.id}
                          type="button"
                          onClick={() => !isLinkedToOther && toggleTime(time.id)}
                          disabled={isLinkedToOther}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 12px',
                            background: isSelected ? 'rgba(124, 58, 237, 0.15)' : 'transparent',
                            border: `1px solid ${isSelected ? 'rgba(124, 58, 237, 0.3)' : 'transparent'}`,
                            borderRadius: '8px',
                            cursor: isLinkedToOther ? 'not-allowed' : 'pointer',
                            opacity: isLinkedToOther ? 0.5 : 1,
                            textAlign: 'left'
                          }}
                        >
                          <div>
                            <span style={{ color: isSelected ? '#a78bfa' : 'white', fontSize: '13px' }}>
                              {time.name || time.team_name || time.id}
                            </span>
                            <span style={{ color: '#64748b', fontSize: '11px', marginLeft: '8px' }}>
                              {time.team_type || 'Sem tipo'}
                            </span>
                          </div>
                          {isSelected && <Check style={{ width: '16px', height: '16px', color: '#7C3AED' }} />}
                          {isLinkedToOther && <span style={{ color: '#64748b', fontSize: '11px' }}>Outro cliente</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingCliente(null);
                  }}
                  style={{
                    flex: 1,
                    padding: '12px 20px',
                    background: 'rgba(100, 116, 139, 0.1)',
                    border: '1px solid rgba(100, 116, 139, 0.2)',
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
                  type="submit"
                  disabled={formLoading}
                  style={{
                    flex: 1,
                    padding: '12px 20px',
                    background: formLoading ? 'rgba(124, 58, 237, 0.5)' : 'linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)',
                    border: 'none',
                    borderRadius: '12px',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: formLoading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {formLoading ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && clienteToDelete && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          padding: '32px'
        }}>
          <div style={{
            background: '#1a1033',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '400px',
            padding: '24px',
            textAlign: 'center'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              background: 'rgba(239, 68, 68, 0.1)',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px'
            }}>
              <Trash2 style={{ width: '28px', height: '28px', color: '#ef4444' }} />
            </div>
            <h3 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: '0 0 12px 0' }}>
              Excluir Cliente
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 24px 0' }}>
              Tem certeza que deseja excluir <strong style={{ color: 'white' }}>{clienteToDelete.nome}</strong>?
              <br />
              Esta ação não pode ser desfeita.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setClienteToDelete(null);
                }}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  background: 'rgba(100, 116, 139, 0.1)',
                  border: '1px solid rgba(100, 116, 139, 0.2)',
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
                onClick={handleDeleteCliente}
                disabled={deleteLoading}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  background: deleteLoading ? 'rgba(239, 68, 68, 0.5)' : '#ef4444',
                  border: 'none',
                  borderRadius: '12px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: deleteLoading ? 'not-allowed' : 'pointer'
                }}
              >
                {deleteLoading ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
