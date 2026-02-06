// Filtros de Email - Subpágina de Configurações
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Mail, Save, CheckCircle, Plus, X, Shield } from 'lucide-react';
import { DEFAULT_EMAIL_FILTERS } from '../utils/emailFilters';

export default function FiltrosEmail() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [emailFilterConfig, setEmailFilterConfig] = useState(DEFAULT_EMAIL_FILTERS);
  const [novoItemFiltro, setNovoItemFiltro] = useState({
    dominios_bloqueados: '',
    dominios_completos_bloqueados: '',
    palavras_chave_assunto: ''
  });

  // Verificar se usuário é admin
  useEffect(() => {
    const checkAdminRole = async () => {
      if (!user?.uid) {
        setIsAdmin(false);
        return;
      }

      try {
        const docRef = doc(db, 'usuarios_sistema', user.uid);
        const snapshot = await getDoc(docRef);

        if (snapshot.exists()) {
          const userData = snapshot.data();
          setIsAdmin(userData.role === 'admin' || userData.role === 'super_admin' || userData.role === 'gestor');
        }
      } catch (error) {
        console.error('Erro ao verificar role:', error);
      }
    };

    checkAdminRole();
  }, [user?.uid]);

  // Carregar configurações
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const filterDocRef = doc(db, 'config', 'email_filters');
        const filterDocSnap = await getDoc(filterDocRef);
        if (filterDocSnap.exists()) {
          setEmailFilterConfig(prev => ({ ...prev, ...filterDocSnap.data() }));
        }
      } catch (error) {
        console.error('Erro ao carregar configurações:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  // Helpers para listas
  const adicionarItemFiltro = (campo) => {
    const valor = novoItemFiltro[campo]?.trim();
    if (!valor) return;
    if (emailFilterConfig[campo]?.includes(valor)) return;
    setEmailFilterConfig(prev => ({
      ...prev,
      [campo]: [...(prev[campo] || []), valor]
    }));
    setNovoItemFiltro(prev => ({ ...prev, [campo]: '' }));
  };

  const removerItemFiltro = (campo, index) => {
    setEmailFilterConfig(prev => ({
      ...prev,
      [campo]: prev[campo].filter((_, i) => i !== index)
    }));
  };

  // Salvar
  const handleSave = async () => {
    if (!isAdmin) return;
    setSaving(true);

    try {
      const filterDocRef = doc(db, 'config', 'email_filters');
      await setDoc(filterDocRef, {
        ...emailFilterConfig,
        updated_at: new Date()
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar configurações');
    } finally {
      setSaving(false);
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => navigate('/configuracoes')}
            style={{
              width: '40px', height: '40px',
              background: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              borderRadius: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <ArrowLeft style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
          </button>
          <div>
            <h1 style={{ color: 'white', fontSize: '28px', fontWeight: '700', margin: 0 }}>Filtros de Email</h1>
            <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0 0' }}>
              Filtre emails irrelevantes (newsletters, auto-replies, spam)
            </p>
          </div>
        </div>

        {isAdmin && (
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '12px 24px',
              background: saveSuccess ? 'rgba(16, 185, 129, 0.2)' : 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
              border: saveSuccess ? '1px solid rgba(16, 185, 129, 0.3)' : 'none',
              borderRadius: '12px',
              color: saveSuccess ? '#10b981' : 'white',
              fontSize: '14px', fontWeight: '600',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1
            }}
          >
            {saveSuccess ? <CheckCircle style={{ width: '18px', height: '18px' }} /> : <Save style={{ width: '18px', height: '18px' }} />}
            {saving ? 'Salvando...' : saveSuccess ? 'Salvo!' : 'Salvar Alterações'}
          </button>
        )}
      </div>

      {/* Banner de somente visualização para não-admins */}
      {!isAdmin && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '16px 20px', marginBottom: '24px',
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '12px'
        }}>
          <Shield style={{ width: '20px', height: '20px', color: '#f59e0b' }} />
          <p style={{ color: '#f59e0b', fontSize: '14px', margin: 0 }}>
            Modo visualização. Apenas administradores podem editar.
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Coluna 1: Toggles */}
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '20px', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <Mail style={{ width: '20px', height: '20px', color: '#f97316' }} />
            <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>Configurações Gerais</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Filtro ativo */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.1)' }}>
              <div>
                <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: '0 0 2px 0' }}>Filtro de email ativo</p>
                <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>Ocultar automaticamente emails irrelevantes</p>
              </div>
              <button
                onClick={() => isAdmin && setEmailFilterConfig(prev => ({ ...prev, filtro_ativo: !prev.filtro_ativo }))}
                disabled={!isAdmin}
                style={{
                  width: '48px', height: '28px', borderRadius: '14px',
                  background: emailFilterConfig.filtro_ativo ? '#8b5cf6' : 'rgba(100, 116, 139, 0.3)',
                  border: 'none', cursor: isAdmin ? 'pointer' : 'not-allowed',
                  position: 'relative', transition: 'all 0.2s ease', opacity: isAdmin ? 1 : 0.6
                }}
              >
                <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'white', position: 'absolute', top: '3px', left: emailFilterConfig.filtro_ativo ? '23px' : '3px', transition: 'all 0.2s ease' }}></div>
              </button>
            </div>

            {/* Detectar auto-reply */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.1)' }}>
              <div>
                <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: '0 0 2px 0' }}>Detectar auto-reply</p>
                <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>Filtrar respostas automáticas e "out of office"</p>
              </div>
              <button
                onClick={() => isAdmin && setEmailFilterConfig(prev => ({ ...prev, detectar_auto_reply: !prev.detectar_auto_reply }))}
                disabled={!isAdmin}
                style={{
                  width: '48px', height: '28px', borderRadius: '14px',
                  background: emailFilterConfig.detectar_auto_reply ? '#8b5cf6' : 'rgba(100, 116, 139, 0.3)',
                  border: 'none', cursor: isAdmin ? 'pointer' : 'not-allowed',
                  position: 'relative', transition: 'all 0.2s ease', opacity: isAdmin ? 1 : 0.6
                }}
              >
                <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'white', position: 'absolute', top: '3px', left: emailFilterConfig.detectar_auto_reply ? '23px' : '3px', transition: 'all 0.2s ease' }}></div>
              </button>
            </div>

            {/* Detectar bulk email */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.1)' }}>
              <div>
                <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: '0 0 2px 0' }}>Detectar email em massa</p>
                <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>Filtrar emails de remetentes tipo noreply com 1 mensagem</p>
              </div>
              <button
                onClick={() => isAdmin && setEmailFilterConfig(prev => ({ ...prev, detectar_bulk_email: !prev.detectar_bulk_email }))}
                disabled={!isAdmin}
                style={{
                  width: '48px', height: '28px', borderRadius: '14px',
                  background: emailFilterConfig.detectar_bulk_email ? '#8b5cf6' : 'rgba(100, 116, 139, 0.3)',
                  border: 'none', cursor: isAdmin ? 'pointer' : 'not-allowed',
                  position: 'relative', transition: 'all 0.2s ease', opacity: isAdmin ? 1 : 0.6
                }}
              >
                <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'white', position: 'absolute', top: '3px', left: emailFilterConfig.detectar_bulk_email ? '23px' : '3px', transition: 'all 0.2s ease' }}></div>
              </button>
            </div>
          </div>

          {/* Info */}
          <div style={{ marginTop: '20px', padding: '12px 16px', background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.2)', borderRadius: '10px' }}>
            <p style={{ color: '#06b6d4', fontSize: '12px', margin: 0, lineHeight: 1.5 }}>
              Estes filtros são aplicados na timeline de conversas do cliente e na geração automática de alertas.
            </p>
          </div>
        </div>

        {/* Coluna 2: Listas */}
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '20px', padding: '24px' }}>
          <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: '0 0 20px 0' }}>Listas de Bloqueio</h2>

          {[
            { campo: 'dominios_bloqueados', label: 'Prefixos de email bloqueados', placeholder: 'Ex: noreply@', desc: 'Bloqueia emails que começam com estes prefixos' },
            { campo: 'dominios_completos_bloqueados', label: 'Domínios bloqueados', placeholder: 'Ex: mailchimp.com', desc: 'Bloqueia todos os emails destes domínios' },
            { campo: 'palavras_chave_assunto', label: 'Palavras-chave no assunto', placeholder: 'Ex: newsletter', desc: 'Filtra emails com estas palavras no assunto' }
          ].map(({ campo, label, placeholder, desc }) => (
            <div key={campo} style={{ marginBottom: '20px' }}>
              <p style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '600', margin: '0 0 4px 0', textTransform: 'uppercase' }}>{label}</p>
              <p style={{ color: '#64748b', fontSize: '11px', margin: '0 0 10px 0' }}>{desc}</p>

              {/* Chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                {(emailFilterConfig[campo] || []).map((item, idx) => (
                  <span key={idx} style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '4px 10px',
                    background: 'rgba(249, 115, 22, 0.1)',
                    border: '1px solid rgba(249, 115, 22, 0.2)',
                    borderRadius: '8px',
                    color: '#f97316',
                    fontSize: '12px'
                  }}>
                    {item}
                    {isAdmin && (
                      <button
                        onClick={() => removerItemFiltro(campo, idx)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', display: 'flex', alignItems: 'center' }}
                      >
                        <X style={{ width: '12px', height: '12px', color: '#f97316' }} />
                      </button>
                    )}
                  </span>
                ))}
                {(emailFilterConfig[campo] || []).length === 0 && (
                  <span style={{ color: '#64748b', fontSize: '12px', fontStyle: 'italic' }}>Nenhum item configurado</span>
                )}
              </div>

              {/* Input para adicionar */}
              {isAdmin && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder={placeholder}
                    value={novoItemFiltro[campo] || ''}
                    onChange={(e) => setNovoItemFiltro(prev => ({ ...prev, [campo]: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && adicionarItemFiltro(campo)}
                    style={{
                      flex: 1, padding: '10px 12px',
                      background: '#0f0a1f', border: '1px solid rgba(139, 92, 246, 0.2)',
                      borderRadius: '8px', color: 'white', fontSize: '13px', outline: 'none'
                    }}
                  />
                  <button
                    onClick={() => adicionarItemFiltro(campo)}
                    style={{
                      padding: '10px 14px',
                      background: 'rgba(249, 115, 22, 0.15)',
                      border: '1px solid rgba(249, 115, 22, 0.3)',
                      borderRadius: '8px', color: '#f97316',
                      fontSize: '13px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '4px'
                    }}
                  >
                    <Plus style={{ width: '14px', height: '14px' }} />
                    Adicionar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
