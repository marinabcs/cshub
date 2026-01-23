// Gerenciamento de Usuários com Atribuição de Carteira
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { db, auth, firebaseConfig } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { logAction } from '../utils/audit';
import {
  ArrowLeft, Users, Plus, Pencil, Trash2, Key, Shield, ShieldCheck, Eye, X,
  AlertTriangle, Check, Briefcase, Search, UserCheck
} from 'lucide-react';

const ROLES = {
  viewer: { label: 'Visualizador', description: 'Apenas leitura', color: '#64748b', icon: Eye },
  cs: { label: 'CS', description: 'Customer Success', color: '#06b6d4', icon: UserCheck },
  gestor: { label: 'Gestor', description: 'Gerencia equipe CS', color: '#8b5cf6', icon: Shield },
  admin: { label: 'Admin', description: 'Gerencia usuários', color: '#f59e0b', icon: Shield },
  super_admin: { label: 'Super Admin', description: 'Acesso total', color: '#ef4444', icon: ShieldCheck }
};

const SUPER_ADMIN_EMAIL = 'marina@trakto.io';

export default function Usuarios() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState(null);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add', 'edit'
  const [selectedUser, setSelectedUser] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    senha: '',
    cargo: '',
    role: 'viewer',
    ativo: true
  });
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Atribuição de carteira
  const [showCarteiraModal, setShowCarteiraModal] = useState(false);
  const [carteiraUser, setCarteiraUser] = useState(null);
  const [selectedClientes, setSelectedClientes] = useState([]);
  const [carteiraSearch, setCarteiraSearch] = useState('');
  const [savingCarteira, setSavingCarteira] = useState(false);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Reset password confirmation
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [userToReset, setUserToReset] = useState(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch usuarios
      const usuariosRef = collection(db, 'usuarios_sistema');
      const usuariosSnapshot = await getDocs(usuariosRef);
      let usuariosData = usuariosSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Check if super admin exists in usuarios_sistema, if not create it
      const superAdminExists = usuariosData.find(u => u.email === SUPER_ADMIN_EMAIL);
      if (!superAdminExists && user?.email === SUPER_ADMIN_EMAIL) {
        // Create super admin record if logged in as super admin
        try {
          await setDoc(doc(db, 'usuarios_sistema', user.uid), {
            uid: user.uid,
            nome: 'Marina (Super Admin)',
            email: SUPER_ADMIN_EMAIL,
            cargo: 'Administradora',
            role: 'super_admin',
            ativo: true,
            created_at: serverTimestamp(),
            created_by: 'sistema',
            updated_at: serverTimestamp()
          });
          // Add to local data
          usuariosData.push({
            id: user.uid,
            uid: user.uid,
            nome: 'Marina (Super Admin)',
            email: SUPER_ADMIN_EMAIL,
            cargo: 'Administradora',
            role: 'super_admin',
            ativo: true
          });
        } catch (err) {
          console.error('Erro ao criar registro do super admin:', err);
        }
      }

      usuariosData.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
      setUsuarios(usuariosData);

      // Fetch clientes
      const clientesRef = collection(db, 'clientes');
      const clientesSnapshot = await getDocs(clientesRef);
      const clientesData = clientesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      clientesData.sort((a, b) => (a.team_name || '').localeCompare(b.team_name || ''));
      setClientes(clientesData);

      // Find current user's role
      const currentUserData = usuariosData.find(u => u.email === user?.email);
      if (currentUserData) {
        setCurrentUserRole(currentUserData.role);
      } else if (user?.email === SUPER_ADMIN_EMAIL) {
        setCurrentUserRole('super_admin');
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const canManageUsers = () => {
    return currentUserRole === 'admin' || currentUserRole === 'super_admin' || currentUserRole === 'gestor' || user?.email === SUPER_ADMIN_EMAIL;
  };

  const canDeleteUser = (targetUser) => {
    if (targetUser.email === SUPER_ADMIN_EMAIL) return false;
    if (targetUser.role === 'super_admin') return false;
    return canManageUsers();
  };

  const canEditRole = (targetUser) => {
    if (targetUser.email === SUPER_ADMIN_EMAIL) return false;
    if (targetUser.role === 'super_admin' && user?.email !== SUPER_ADMIN_EMAIL) return false;
    return canManageUsers();
  };

  const openAddModal = () => {
    setModalMode('add');
    setFormData({ nome: '', email: '', senha: '', cargo: '', role: 'viewer', ativo: true });
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (usuario) => {
    setModalMode('edit');
    setSelectedUser(usuario);
    setFormData({
      nome: usuario.nome || '',
      email: usuario.email || '',
      senha: '',
      cargo: usuario.cargo || '',
      role: usuario.role || 'viewer',
      ativo: usuario.ativo !== false
    });
    setFormError('');
    setShowModal(true);
  };

  const openCarteiraModal = (usuario) => {
    setCarteiraUser(usuario);
    // Find clients currently assigned to this user
    const assignedClientes = clientes
      .filter(c => c.responsavel_email === usuario.email || c.responsavel_nome === usuario.nome)
      .map(c => c.id);
    setSelectedClientes(assignedClientes);
    setCarteiraSearch('');
    setShowCarteiraModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);

    try {
      if (modalMode === 'add') {
        // Validate
        if (!formData.nome || !formData.email || !formData.senha) {
          setFormError('Preencha todos os campos obrigatórios');
          setFormLoading(false);
          return;
        }

        if (formData.senha.length < 6) {
          setFormError('A senha deve ter pelo menos 6 caracteres');
          setFormLoading(false);
          return;
        }

        // Check if email is @trakto.io
        if (!formData.email.toLowerCase().endsWith('@trakto.io')) {
          setFormError('O email deve ser @trakto.io');
          setFormLoading(false);
          return;
        }

        // Check if email already exists
        const existingUser = usuarios.find(u => u.email.toLowerCase() === formData.email.toLowerCase());
        if (existingUser) {
          setFormError('Este email já está cadastrado');
          setFormLoading(false);
          return;
        }

        // Create a secondary Firebase app instance for user creation
        // This prevents the current admin from being signed out
        const secondaryApp = initializeApp(firebaseConfig, 'secondary');
        const secondaryAuth = getAuth(secondaryApp);

        // Create user in Firebase Auth using secondary app
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.senha);
        const newUid = userCredential.user.uid;

        // Sign out from secondary auth and delete the secondary app
        await signOut(secondaryAuth);
        await secondaryApp.delete();

        // Create user document in Firestore
        try {
          await setDoc(doc(db, 'usuarios_sistema', newUid), {
            uid: newUid,
            nome: formData.nome,
            email: formData.email.toLowerCase(),
            cargo: formData.cargo,
            role: formData.role,
            ativo: formData.ativo,
            created_at: serverTimestamp(),
            created_by: user?.email || 'sistema',
            updated_at: serverTimestamp()
          });
        } catch (firestoreError) {
          console.error('Erro ao criar documento no Firestore:', firestoreError);
          setFormError(`Usuário criado no Auth, mas falhou ao salvar dados: ${firestoreError.message}. Verifique as regras do Firestore.`);
          setFormLoading(false);
          return;
        }

        // Log audit for creation
        await logAction('create', 'usuario_sistema', newUid, formData.nome, {
          email: { old: null, new: formData.email },
          role: { old: null, new: formData.role }
        }, { email: user?.email, name: user?.email?.split('@')[0] });

      } else {
        // Edit mode
        if (!formData.nome) {
          setFormError('O nome é obrigatório');
          setFormLoading(false);
          return;
        }

        // Check if trying to demote super_admin
        if (selectedUser.role === 'super_admin' && formData.role !== 'super_admin') {
          if (selectedUser.email === SUPER_ADMIN_EMAIL) {
            setFormError('Não é possível rebaixar o Super Admin principal');
            setFormLoading(false);
            return;
          }
        }

        // Update user document
        const updateData = {
          nome: formData.nome,
          cargo: formData.cargo,
          role: formData.role,
          ativo: formData.ativo,
          updated_at: serverTimestamp()
        };

        await updateDoc(doc(db, 'usuarios_sistema', selectedUser.id), updateData);

        // Log audit for update
        await logAction('update', 'usuario_sistema', selectedUser.id, formData.nome, {
          role: { old: selectedUser.role, new: formData.role },
          ativo: { old: selectedUser.ativo, new: formData.ativo }
        }, { email: user?.email, name: user?.email?.split('@')[0] });
      }

      setShowModal(false);
      fetchData();
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);
      if (error.code === 'auth/email-already-in-use') {
        setFormError('Este email já está em uso');
      } else if (error.code === 'auth/invalid-email') {
        setFormError('Email inválido');
      } else if (error.code === 'auth/weak-password') {
        setFormError('A senha é muito fraca');
      } else {
        setFormError('Erro ao salvar usuário. Tente novamente.');
      }
    } finally {
      setFormLoading(false);
    }
  };

  const handleSaveCarteira = async () => {
    if (!carteiraUser) return;

    setSavingCarteira(true);
    try {
      const batch = writeBatch(db);

      // First, remove this user from all clients that are not in selectedClientes
      const clientesToRemove = clientes.filter(c =>
        (c.responsavel_email === carteiraUser.email || c.responsavel_nome === carteiraUser.nome) &&
        !selectedClientes.includes(c.id)
      );

      clientesToRemove.forEach(cliente => {
        const clienteRef = doc(db, 'clientes', cliente.id);
        batch.update(clienteRef, {
          responsavel_email: null,
          responsavel_nome: null,
          updated_at: serverTimestamp()
        });
      });

      // Then, assign this user to all selected clients
      selectedClientes.forEach(clienteId => {
        const clienteRef = doc(db, 'clientes', clienteId);
        batch.update(clienteRef, {
          responsavel_email: carteiraUser.email,
          responsavel_nome: carteiraUser.nome,
          updated_at: serverTimestamp()
        });
      });

      await batch.commit();

      setShowCarteiraModal(false);
      setCarteiraUser(null);
      fetchData();
    } catch (error) {
      console.error('Erro ao salvar carteira:', error);
      alert('Erro ao salvar atribuições. Tente novamente.');
    } finally {
      setSavingCarteira(false);
    }
  };

  const handleDelete = async () => {
    if (!userToDelete) return;

    setDeleteLoading(true);
    try {
      await deleteDoc(doc(db, 'usuarios_sistema', userToDelete.id));

      // Log audit for deletion
      await logAction('delete', 'usuario_sistema', userToDelete.id, userToDelete.nome, {
        email: { old: userToDelete.email, new: null }
      }, { email: user?.email, name: user?.email?.split('@')[0] });

      setShowDeleteConfirm(false);
      setUserToDelete(null);
      fetchData();
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!userToReset) return;

    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, userToReset.email);
      setResetSuccess(true);
      setTimeout(() => {
        setShowResetConfirm(false);
        setUserToReset(null);
        setResetSuccess(false);
      }, 2000);
    } catch (error) {
      console.error('Erro ao enviar email de redefinição:', error);
    } finally {
      setResetLoading(false);
    }
  };

  const toggleClienteSelection = (clienteId) => {
    setSelectedClientes(prev =>
      prev.includes(clienteId)
        ? prev.filter(id => id !== clienteId)
        : [...prev, clienteId]
    );
  };

  const filteredClientesForCarteira = clientes.filter(cliente => {
    const searchLower = carteiraSearch.toLowerCase();
    return !carteiraSearch ||
      (cliente.team_name || '').toLowerCase().includes(searchLower);
  });

  const getClientesCount = (usuario) => {
    return clientes.filter(c =>
      c.responsavel_email === usuario.email || c.responsavel_nome === usuario.nome
    ).length;
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Check access permission
  if (!loading && !canManageUsers()) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f0a1f', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
        <AlertTriangle style={{ width: '48px', height: '48px', color: '#f59e0b' }} />
        <p style={{ color: 'white', fontSize: '18px', fontWeight: '600' }}>Acesso Restrito</p>
        <p style={{ color: '#94a3b8', fontSize: '14px' }}>Você não tem permissão para acessar esta página</p>
        <button
          onClick={() => navigate('/')}
          style={{
            padding: '12px 24px',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
            border: 'none',
            borderRadius: '12px',
            color: 'white',
            fontWeight: '600',
            cursor: 'pointer',
            marginTop: '16px'
          }}
        >
          Voltar ao Dashboard
        </button>
      </div>
    );
  }

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
              <Users style={{ width: '28px', height: '28px', color: 'white' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: 'white', margin: '0 0 4px 0' }}>Gestão de Usuários</h1>
              <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>{usuarios.length} usuário{usuarios.length !== 1 ? 's' : ''} cadastrado{usuarios.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button
            onClick={openAddModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            <Plus style={{ width: '18px', height: '18px' }} />
            Novo Usuário
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '20px', padding: '24px' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '12px 16px', color: '#64748b', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>Usuário</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', color: '#64748b', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>Email</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', color: '#64748b', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>Cargo</th>
                <th style={{ textAlign: 'center', padding: '12px 16px', color: '#64748b', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>Permissão</th>
                <th style={{ textAlign: 'center', padding: '12px 16px', color: '#64748b', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>Carteira</th>
                <th style={{ textAlign: 'center', padding: '12px 16px', color: '#64748b', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>Status</th>
                <th style={{ textAlign: 'center', padding: '12px 16px', color: '#64748b', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((usuario) => {
                const roleInfo = ROLES[usuario.role] || ROLES.viewer;
                const RoleIcon = roleInfo.icon;
                const isSuperAdmin = usuario.email === SUPER_ADMIN_EMAIL || usuario.role === 'super_admin';
                const clientesCount = getClientesCount(usuario);
                const isAtivo = usuario.ativo !== false;

                return (
                  <tr key={usuario.id} style={{ borderBottom: '1px solid rgba(139, 92, 246, 0.05)' }}>
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          background: isSuperAdmin
                            ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                            : !isAtivo
                            ? 'rgba(100, 116, 139, 0.3)'
                            : 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                          borderRadius: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: '16px',
                          fontWeight: '600'
                        }}>
                          {(usuario.nome || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p style={{ color: isAtivo ? 'white' : '#64748b', fontSize: '14px', fontWeight: '500', margin: 0 }}>{usuario.nome || '-'}</p>
                          {usuario.email === user?.email && (
                            <span style={{ color: '#8b5cf6', fontSize: '11px' }}>Você</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '16px', color: '#94a3b8', fontSize: '13px' }}>
                      {usuario.email}
                    </td>
                    <td style={{ padding: '16px', color: '#94a3b8', fontSize: '13px' }}>
                      {usuario.cargo || '-'}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <RoleIcon style={{ width: '14px', height: '14px', color: roleInfo.color }} />
                        <span style={{
                          padding: '4px 10px',
                          background: `${roleInfo.color}20`,
                          color: roleInfo.color,
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '500'
                        }}>
                          {roleInfo.label}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <button
                        onClick={() => openCarteiraModal(usuario)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          background: clientesCount > 0 ? 'rgba(6, 182, 212, 0.2)' : 'rgba(100, 116, 139, 0.1)',
                          border: `1px solid ${clientesCount > 0 ? 'rgba(6, 182, 212, 0.3)' : 'rgba(100, 116, 139, 0.2)'}`,
                          borderRadius: '8px',
                          color: clientesCount > 0 ? '#06b6d4' : '#64748b',
                          fontSize: '12px',
                          cursor: 'pointer',
                          margin: '0 auto'
                        }}
                      >
                        <Briefcase style={{ width: '14px', height: '14px' }} />
                        {clientesCount} cliente{clientesCount !== 1 ? 's' : ''}
                      </button>
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <span style={{
                        padding: '4px 10px',
                        background: isAtivo ? 'rgba(16, 185, 129, 0.2)' : 'rgba(100, 116, 139, 0.2)',
                        color: isAtivo ? '#10b981' : '#64748b',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}>
                        {isAtivo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        {canEditRole(usuario) && (
                          <button
                            onClick={() => openEditModal(usuario)}
                            style={{
                              width: '32px',
                              height: '32px',
                              background: 'rgba(139, 92, 246, 0.1)',
                              border: '1px solid rgba(139, 92, 246, 0.2)',
                              borderRadius: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer'
                            }}
                            title="Editar"
                          >
                            <Pencil style={{ width: '14px', height: '14px', color: '#8b5cf6' }} />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setUserToReset(usuario);
                            setShowResetConfirm(true);
                          }}
                          style={{
                            width: '32px',
                            height: '32px',
                            background: 'rgba(6, 182, 212, 0.1)',
                            border: '1px solid rgba(6, 182, 212, 0.2)',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                          title="Redefinir Senha"
                        >
                          <Key style={{ width: '14px', height: '14px', color: '#06b6d4' }} />
                        </button>
                        {canDeleteUser(usuario) && (
                          <button
                            onClick={() => {
                              setUserToDelete(usuario);
                              setShowDeleteConfirm(true);
                            }}
                            style={{
                              width: '32px',
                              height: '32px',
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
                            <Trash2 style={{ width: '14px', height: '14px', color: '#ef4444' }} />
                          </button>
                        )}
                        {!canEditRole(usuario) && !canDeleteUser(usuario) && (
                          <span style={{ color: '#64748b', fontSize: '11px', fontStyle: 'italic' }}>Protegido</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {usuarios.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ padding: '48px', textAlign: 'center' }}>
                    <Users style={{ width: '48px', height: '48px', color: '#64748b', margin: '0 auto 16px' }} />
                    <p style={{ color: '#94a3b8', fontSize: '16px', margin: '0 0 8px 0' }}>Nenhum usuário cadastrado</p>
                    <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Clique em "Novo Usuário" para adicionar</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
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
            border: '1px solid rgba(139, 92, 246, 0.2)',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '500px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid rgba(139, 92, 246, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h3 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>
                {modalMode === 'add' ? 'Novo Usuário' : 'Editar Usuário'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
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

            <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
              {formError && (
                <div style={{
                  padding: '12px 16px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '12px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <AlertTriangle style={{ width: '18px', height: '18px', color: '#ef4444' }} />
                  <span style={{ color: '#ef4444', fontSize: '14px' }}>{formError}</span>
                </div>
              )}

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '8px' }}>
                  Nome *
                </label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Nome completo"
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

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '8px' }}>
                  Email * (deve ser @trakto.io)
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@trakto.io"
                  disabled={modalMode === 'edit'}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: modalMode === 'edit' ? 'rgba(15, 10, 31, 0.5)' : '#0f0a1f',
                    border: '1px solid #3730a3',
                    borderRadius: '12px',
                    color: modalMode === 'edit' ? '#64748b' : 'white',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {modalMode === 'add' && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '8px' }}>
                    Senha *
                  </label>
                  <input
                    type="password"
                    value={formData.senha}
                    onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                    placeholder="Mínimo 6 caracteres"
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
              )}

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '8px' }}>
                  Cargo
                </label>
                <input
                  type="text"
                  value={formData.cargo}
                  onChange={(e) => setFormData({ ...formData, cargo: e.target.value })}
                  placeholder="Ex: Analista de CS"
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

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '12px' }}>
                  Permissão
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {Object.entries(ROLES).map(([key, value]) => {
                    // Don't allow selecting super_admin unless current user is super_admin
                    if (key === 'super_admin' && user?.email !== SUPER_ADMIN_EMAIL) {
                      return null;
                    }

                    const RoleIcon = value.icon;
                    const isSelected = formData.role === key;

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setFormData({ ...formData, role: key })}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '12px 14px',
                          background: isSelected ? `${value.color}15` : 'rgba(15, 10, 31, 0.6)',
                          border: `1px solid ${isSelected ? `${value.color}40` : 'rgba(139, 92, 246, 0.1)'}`,
                          borderRadius: '12px',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                      >
                        <div style={{
                          width: '32px',
                          height: '32px',
                          background: `${value.color}20`,
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <RoleIcon style={{ width: '16px', height: '16px', color: value.color }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: 0 }}>{value.label}</p>
                          <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>{value.description}</p>
                        </div>
                        {isSelected && (
                          <div style={{
                            width: '20px',
                            height: '20px',
                            background: value.color,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <Check style={{ width: '12px', height: '12px', color: 'white' }} />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status Ativo/Inativo */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.1)' }}>
                  <div>
                    <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: '0 0 2px 0' }}>Status do usuário</p>
                    <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>Usuários inativos não podem acessar o sistema</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, ativo: !formData.ativo })}
                    style={{
                      width: '48px',
                      height: '28px',
                      borderRadius: '14px',
                      background: formData.ativo ? '#10b981' : 'rgba(100, 116, 139, 0.3)',
                      border: 'none',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      background: 'white',
                      position: 'absolute',
                      top: '3px',
                      left: formData.ativo ? '23px' : '3px',
                      transition: 'all 0.2s ease'
                    }}></div>
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
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
                    background: formLoading ? 'rgba(139, 92, 246, 0.5)' : 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                    border: 'none',
                    borderRadius: '12px',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: formLoading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {formLoading ? 'Salvando...' : (modalMode === 'add' ? 'Criar Usuário' : 'Salvar')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Carteira Modal */}
      {showCarteiraModal && carteiraUser && (
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
            border: '1px solid rgba(139, 92, 246, 0.2)',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid rgba(139, 92, 246, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <h3 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: '0 0 4px 0' }}>
                  Atribuir Carteira
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>
                  {carteiraUser.nome} ({selectedClientes.length} cliente{selectedClientes.length !== 1 ? 's' : ''} selecionado{selectedClientes.length !== 1 ? 's' : ''})
                </p>
              </div>
              <button
                onClick={() => setShowCarteiraModal(false)}
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

            <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>
              <div style={{ position: 'relative' }}>
                <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: '#64748b' }} />
                <input
                  type="text"
                  placeholder="Buscar cliente..."
                  value={carteiraSearch}
                  onChange={(e) => setCarteiraSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 16px 12px 44px',
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

            <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredClientesForCarteira.map(cliente => {
                  const isSelected = selectedClientes.includes(cliente.id);
                  const isAssignedToOther = cliente.responsavel_email && cliente.responsavel_email !== carteiraUser.email;

                  return (
                    <button
                      key={cliente.id}
                      onClick={() => toggleClienteSelection(cliente.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px 14px',
                        background: isSelected ? 'rgba(6, 182, 212, 0.15)' : 'rgba(15, 10, 31, 0.6)',
                        border: `1px solid ${isSelected ? 'rgba(6, 182, 212, 0.3)' : 'rgba(139, 92, 246, 0.1)'}`,
                        borderRadius: '12px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        width: '100%'
                      }}
                    >
                      <div style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '6px',
                        border: `2px solid ${isSelected ? '#06b6d4' : '#3730a3'}`,
                        background: isSelected ? '#06b6d4' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {isSelected && <Check style={{ width: '14px', height: '14px', color: 'white' }} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: 0 }}>
                          {cliente.team_name}
                        </p>
                        {isAssignedToOther && (
                          <p style={{ color: '#f59e0b', fontSize: '11px', margin: '2px 0 0 0' }}>
                            Atualmente com: {cliente.responsavel_nome}
                          </p>
                        )}
                      </div>
                      {cliente.team_type && (
                        <span style={{
                          padding: '4px 8px',
                          background: 'rgba(139, 92, 246, 0.2)',
                          color: '#a78bfa',
                          borderRadius: '6px',
                          fontSize: '11px'
                        }}>
                          {cliente.team_type}
                        </span>
                      )}
                    </button>
                  );
                })}
                {filteredClientesForCarteira.length === 0 && (
                  <div style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                    Nenhum cliente encontrado
                  </div>
                )}
              </div>
            </div>

            <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(139, 92, 246, 0.1)', display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowCarteiraModal(false)}
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
                onClick={handleSaveCarteira}
                disabled={savingCarteira}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  background: savingCarteira ? 'rgba(6, 182, 212, 0.5)' : 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                  border: 'none',
                  borderRadius: '12px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: savingCarteira ? 'not-allowed' : 'pointer'
                }}
              >
                {savingCarteira ? 'Salvando...' : 'Salvar Atribuições'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && userToDelete && (
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
              Excluir Usuário
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 24px 0' }}>
              Tem certeza que deseja excluir <strong style={{ color: 'white' }}>{userToDelete.nome}</strong>?
              <br />
              Esta ação não pode ser desfeita.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setUserToDelete(null);
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
                onClick={handleDelete}
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

      {/* Reset Password Confirmation Modal */}
      {showResetConfirm && userToReset && (
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
            border: '1px solid rgba(6, 182, 212, 0.2)',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '400px',
            padding: '24px',
            textAlign: 'center'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              background: resetSuccess ? 'rgba(16, 185, 129, 0.1)' : 'rgba(6, 182, 212, 0.1)',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px'
            }}>
              {resetSuccess ? (
                <Check style={{ width: '28px', height: '28px', color: '#10b981' }} />
              ) : (
                <Key style={{ width: '28px', height: '28px', color: '#06b6d4' }} />
              )}
            </div>
            <h3 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: '0 0 12px 0' }}>
              {resetSuccess ? 'Email Enviado!' : 'Redefinir Senha'}
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 24px 0' }}>
              {resetSuccess ? (
                <>Um email de redefinição foi enviado para <strong style={{ color: 'white' }}>{userToReset.email}</strong></>
              ) : (
                <>Enviar email de redefinição de senha para <strong style={{ color: 'white' }}>{userToReset.email}</strong>?</>
              )}
            </p>
            {!resetSuccess && (
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => {
                    setShowResetConfirm(false);
                    setUserToReset(null);
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
                  onClick={handleResetPassword}
                  disabled={resetLoading}
                  style={{
                    flex: 1,
                    padding: '12px 20px',
                    background: resetLoading ? 'rgba(6, 182, 212, 0.5)' : 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                    border: 'none',
                    borderRadius: '12px',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: resetLoading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {resetLoading ? 'Enviando...' : 'Enviar Email'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
