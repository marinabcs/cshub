import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { LayoutDashboard, Users, BarChart3, Bell, Settings, LogOut, UserCog, History, Briefcase, FileText, Sparkles, ClipboardList, GraduationCap } from 'lucide-react';
import { useAlertasCount } from '../../hooks/useAlertas';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { counts: alertaCounts } = useAlertasCount();
  const [userProfile, setUserProfile] = useState(null);

  // Extrair iniciais do nome (ex: "Marina Barros" → "MB")
  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  // Buscar dados do perfil do usuário logado
  useEffect(() => {
    if (!user?.email) return;

    const q = query(
      collection(db, 'usuarios_sistema'),
      where('email', '==', user.email)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const userData = snapshot.docs[0].data();
        setUserProfile(userData);
      }
    });

    return () => unsubscribe();
  }, [user?.email]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Erro ao sair:', error);
    }
  };

  const menuItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/minha-carteira', icon: Briefcase, label: 'Minha Carteira' },
    { to: '/clientes', icon: Users, label: 'Clientes' },
    { to: '/resumo-executivo', icon: Sparkles, label: 'Resumo Executivo' },
    { to: '/analytics', icon: BarChart3, label: 'Analytics' },
    { to: '/documentos', icon: FileText, label: 'Documentos' },
    { to: '/playbooks', icon: ClipboardList, label: 'Playbooks' },
    { to: '/onboarding', icon: GraduationCap, label: 'Onboarding' },
    { to: '/alertas', icon: Bell, label: 'Alertas', badge: alertaCounts.pendentes, urgente: alertaCounts.urgentes > 0 },
  ];

  // Verificar se usuário é admin
  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'super_admin';

  const configItems = [
    { to: '/configuracoes', icon: Settings, label: 'Configurações', exact: true },
    { to: '/configuracoes/usuarios', icon: UserCog, label: 'Usuários' },
    // Auditoria apenas para admins
    ...(isAdmin ? [{ to: '/configuracoes/auditoria', icon: History, label: 'Histórico' }] : []),
  ];

  const linkStyle = (isActive) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    borderRadius: '12px',
    color: isActive ? 'white' : '#94a3b8',
    background: isActive ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(139, 92, 246, 0.1) 100%)' : 'transparent',
    border: isActive ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid transparent',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: isActive ? '600' : '400',
    transition: 'all 0.2s ease'
  });

  return (
    <div style={{
      width: '260px',
      height: '100vh',
      background: 'linear-gradient(180deg, #0f0a1f 0%, #1a1033 100%)',
      borderRight: '1px solid rgba(139, 92, 246, 0.1)',
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      left: 0,
      top: 0,
      overflow: 'hidden'
    }}>
      {/* Logo */}
      <div style={{
        padding: '24px 20px',
        borderBottom: '1px solid rgba(139, 92, 246, 0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(139, 92, 246, 0.3)'
          }}>
            <Users style={{ width: '24px', height: '24px', color: 'white' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 'bold', color: 'white', margin: 0 }}>CS Hub</h1>
            <span style={{ fontSize: '12px', color: '#64748b' }}>v1.0</span>
          </div>
        </div>
      </div>

      {/* Menu Principal */}
      <div style={{ flex: 1, padding: '20px 12px', display: 'flex', flexDirection: 'column', overflowY: 'auto', overflowX: 'hidden' }}>
        <div style={{ marginBottom: '24px' }}>
          <span style={{
            display: 'block',
            fontSize: '11px',
            fontWeight: '600',
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            padding: '0 16px',
            marginBottom: '12px'
          }}>Menu</span>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {menuItems.map((item) => (
              <NavLink key={item.to} to={item.to} style={({ isActive }) => ({
                ...linkStyle(isActive),
                justifyContent: 'space-between'
              })}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <item.icon style={{ width: '20px', height: '20px' }} />
                  {item.label}
                </div>
                {item.badge > 0 && (
                  <span style={{
                    minWidth: '20px',
                    height: '20px',
                    padding: '0 6px',
                    background: item.urgente ? '#ef4444' : '#f59e0b',
                    borderRadius: '10px',
                    color: 'white',
                    fontSize: '11px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {item.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        <div>
          <span style={{
            display: 'block',
            fontSize: '11px',
            fontWeight: '600',
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            padding: '0 16px',
            marginBottom: '12px'
          }}>Configurações</span>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {configItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                style={({ isActive }) => linkStyle(isActive)}
              >
                <item.icon style={{ width: '20px', height: '20px' }} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      {/* Usuário - Fixo no final */}
      <div style={{
        padding: '16px',
        borderTop: '1px solid rgba(139, 92, 246, 0.1)',
        background: 'rgba(15, 10, 31, 0.95)',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: '600',
              fontSize: '14px'
            }}>
              {getInitials(userProfile?.nome) || user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div>
              <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: 0 }}>
                {userProfile?.nome || user?.email?.split('@')[0] || 'Usuário'}
              </p>
              <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>
                {userProfile?.cargo || 'Usuário'}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
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
            title="Sair"
          >
            <LogOut style={{ width: '18px', height: '18px', color: '#ef4444' }} />
          </button>
        </div>
      </div>
    </div>
  );
}
