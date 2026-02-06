// Configurações do Sistema
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  CheckCircle, Activity,
  Zap, RefreshCw, XCircle, CloudDownload, Lock,
  Mail, ChevronRight
} from 'lucide-react';
import { SEGMENTOS_CS } from '../utils/segmentoCS';
import { isClickUpConfigured } from '../services/clickup';
import { useSincronizarClickUp } from '../hooks/useAlertas';
import { sincronizarOngoingComClickUp } from '../services/ongoing';
import { validateForm } from '../validation';
import { configGeralSchema } from '../validation/configuracoes';

export default function Configuracoes() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingRole, setCheckingRole] = useState(true);

  // Estado para status de integrações
  const [clickUpStatus, setClickUpStatus] = useState(null);
  const [openAIStatus, setOpenAIStatus] = useState(null);

  // Estado para sincronização do ClickUp
  const [sincronizandoClickUp, setSincronizandoClickUp] = useState(false);
  const [clickUpSyncResults, setClickUpSyncResults] = useState(null);
  const { sincronizarComClickUp } = useSincronizarClickUp();

  // Estado para status de sync n8n
  const [syncStatus, setSyncStatus] = useState(null);


  // Parâmetros de Segmentação CS (todos editáveis)
  // HIERARQUIA DE PRIORIDADE:
  // 1. Reclamações em aberto (veto) → Se houver, máximo ALERTA
  // 2. Dias ativos (base) → Define nível base
  // 3. Engajamento (elevação) → Pode subir para CRESCIMENTO
  const PARAMETROS_SEGMENTO_PADRAO = {
    // Dias ativos no mês
    dias_ativos_crescimento: 20,
    dias_ativos_estavel: 8,
    dias_ativos_alerta: 3,
    dias_ativos_resgate: 0,
    // Score de engajamento
    engajamento_crescimento: 50,
    engajamento_estavel: 15,
    engajamento_alerta: 1,
    engajamento_resgate: 0,
    // Reclamações em aberto (toggle por nível)
    reclamacoes_crescimento: false,
    reclamacoes_estavel: false,
    reclamacoes_alerta: true,
    reclamacoes_resgate: true,
    // Thresholds adicionais
    reclamacoes_max_resgate: 3,
    bugs_max_alerta: 3,
    // Toggles de regras especiais
    aviso_previo_resgate: true,
    champion_saiu_alerta: true,
    tags_problema_alerta: true,
    zero_producao_alerta: true,
    // Pesos do score de engajamento
    peso_pecas: 2,
    peso_ia: 1.5,
    peso_downloads: 1,
  };

  // Parâmetros de segmentação editáveis
  const [segmentoConfig, setSegmentoConfig] = useState({
    dias_ativos_crescimento: 20,
    dias_ativos_estavel: 8,
    dias_ativos_alerta: 3,
    dias_ativos_resgate: 0,
    engajamento_crescimento: 50,
    engajamento_estavel: 15,
    engajamento_alerta: 1,
    engajamento_resgate: 0,
    reclamacoes_crescimento: false,
    reclamacoes_estavel: false,
    reclamacoes_alerta: true,
    reclamacoes_resgate: true,
    reclamacoes_max_resgate: 3,
    bugs_max_alerta: 3,
    aviso_previo_resgate: true,
    champion_saiu_alerta: true,
    tags_problema_alerta: true,
    zero_producao_alerta: true,
    peso_pecas: 2,
    peso_ia: 1.5,
    peso_downloads: 1,
  });

  // Verificar se usuário é admin
  useEffect(() => {
    const checkAdminRole = async () => {
      if (!user?.uid) {
        setIsAdmin(false);
        setCheckingRole(false);
        return;
      }

      try {
        const docRef = doc(db, 'usuarios_sistema', user.uid);
        const snapshot = await getDoc(docRef);

        if (snapshot.exists()) {
          const userData = snapshot.data();
          setIsAdmin(userData.role === 'admin' || userData.role === 'super_admin' || userData.role === 'gestor');
        } else {
          setIsAdmin(false);
        }
      } catch (error) {
        console.error('Erro ao verificar role:', error);
        setIsAdmin(false);
      } finally {
        setCheckingRole(false);
      }
    };

    checkAdminRole();
  }, [user?.uid]);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        // Fetch config geral
        const configDocRef = doc(db, 'config', 'geral');
        const configDocSnap = await getDoc(configDocRef);
        if (configDocSnap.exists()) {
          const data = configDocSnap.data();
          if (data.segmentoConfig) setSegmentoConfig(data.segmentoConfig);
        }

        // Fetch sync status (n8n)
        const syncStatusRef = doc(db, 'config', 'sync_status');
        const syncStatusSnap = await getDoc(syncStatusRef);
        if (syncStatusSnap.exists()) {
          setSyncStatus(syncStatusSnap.data());
        }

        // Check integrations status
        checkIntegrations();

      } catch (error) {
        console.error('Erro ao carregar configurações:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const checkIntegrations = async () => {
    // Check ClickUp (API key agora é via Cloud Function, verificar apenas config IDs)
    const clickUpTeamId = import.meta.env.VITE_CLICKUP_TEAM_ID;
    const clickUpListId = import.meta.env.VITE_CLICKUP_LIST_ID;
    setClickUpStatus({
      configured: !!(clickUpTeamId && clickUpListId),
      apiKey: 'Via Cloud Function (servidor)',
      teamId: clickUpTeamId || 'Não configurado'
    });

    // Check OpenAI (API key agora é via Cloud Function)
    setOpenAIStatus({
      configured: true,
      apiKey: 'Via Cloud Function (servidor)'
    });
  };

  // Sincronização completa com ClickUp (alertas + playbooks)
  const runClickUpSync = async () => {
    setSincronizandoClickUp(true);
    setClickUpSyncResults(null);

    try {
      // Sincronizar alertas e ongoing em paralelo
      const [alertasResult, ongoingResult] = await Promise.all([
        sincronizarComClickUp(),
        sincronizarOngoingComClickUp()
      ]);

      setClickUpSyncResults({
        alertas: alertasResult,
        ongoing: ongoingResult
      });

      // Salvar timestamp da última sincronização
      const agora = new Date();
      const syncDocRef = doc(db, 'config', 'clickup_sync');
      await setDoc(syncDocRef, { ultima_sincronizacao: agora }, { merge: true });
    } catch (error) {
      console.error('Erro ao sincronizar com ClickUp:', error);
      setClickUpSyncResults({ erro: error.message });
    } finally {
      setSincronizandoClickUp(false);
    }
  };

  // Formatar data de sync com indicador de freshness
  const formatSyncInfo = (timestamp) => {
    if (!timestamp) return { text: 'Nunca sincronizado', color: '#64748b', fresh: false };
    const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return { text: 'Data inválida', color: '#64748b', fresh: false };

    const now = new Date();
    const diffMs = now - date;
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffHours / 24;

    const formatted = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    if (diffHours < 24) return { text: formatted, color: '#10b981', fresh: true };
    if (diffDays < 3) return { text: formatted, color: '#f59e0b', fresh: true };
    return { text: formatted, color: '#ef4444', fresh: false };
  };

  // Ref para controlar se é a primeira carga (não salvar automaticamente)
  const isInitialLoad = useRef(true);
  const saveTimeoutRef = useRef(null);

  // Auto-save com debounce
  const autoSave = useCallback(async (config) => {
    if (!isAdmin) return;

    // Validar configurações numéricas
    const validationErrors = validateForm(configGeralSchema, config);
    if (validationErrors) {
      return; // Não salva se inválido, mas não mostra alerta
    }

    setSaving(true);
    setSaveSuccess(false);
    try {
      const configDocRef = doc(db, 'config', 'geral');
      await setDoc(configDocRef, {
        segmentoConfig: config,
        updated_at: new Date()
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
    } finally {
      setSaving(false);
    }
  }, [isAdmin]);

  // useEffect para auto-save quando segmentoConfig muda
  useEffect(() => {
    // Não salvar na primeira carga
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }

    // Limpar timeout anterior
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce de 1.5 segundos
    saveTimeoutRef.current = setTimeout(() => {
      autoSave(segmentoConfig);
    }, 1500);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [segmentoConfig, autoSave]);

  const handleSegmentoConfigChange = (field, value) => {
    // Se for booleano, usa direto; senão converte para número
    const newValue = typeof value === 'boolean' ? value : (Number(value) || 0);
    setSegmentoConfig(prev => ({ ...prev, [field]: newValue }));
  };

  if (loading || checkingRole) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f0a1f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '48px', height: '48px', border: '3px solid rgba(139, 92, 246, 0.2)', borderTopColor: '#8b5cf6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px', background: '#0f0a1f', minHeight: '100vh' }}>
      {/* Banner de somente visualização para não-admins */}
      {!isAdmin && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '16px 20px',
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '12px',
          marginBottom: '24px'
        }}>
          <Lock style={{ width: '20px', height: '20px', color: '#f59e0b' }} />
          <div>
            <p style={{ color: '#f59e0b', fontSize: '14px', fontWeight: '600', margin: '0 0 2px 0' }}>Somente visualização</p>
            <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>Apenas administradores podem editar as configurações do sistema</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: 'white', margin: '0 0 8px 0' }}>Configurações</h1>
          <p style={{ color: '#94a3b8', margin: 0 }}>Configure os parâmetros do sistema</p>
        </div>
        {/* Indicador de auto-save */}
        {isAdmin && (saving || saveSuccess) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: saveSuccess ? 'rgba(16, 185, 129, 0.1)' : 'rgba(139, 92, 246, 0.1)', borderRadius: '8px' }}>
            {saving ? (
              <>
                <div style={{ width: '14px', height: '14px', border: '2px solid rgba(139, 92, 246, 0.3)', borderTopColor: '#8b5cf6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <span style={{ color: '#a78bfa', fontSize: '13px' }}>Salvando...</span>
              </>
            ) : (
              <>
                <CheckCircle style={{ width: '14px', height: '14px', color: '#10b981' }} />
                <span style={{ color: '#10b981', fontSize: '13px' }}>Salvo</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* SEÇÃO: Saúde CS (largura total) */}
      <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '20px', padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <Activity style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
          <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>Saúde CS</h2>
        </div>

        {/* Hierarquia de regras */}
        <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '10px', border: '1px solid rgba(139, 92, 246, 0.1)' }}>
          <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0, lineHeight: '1.6' }}>
            <strong style={{ color: '#a78bfa' }}>Ordem de prioridade:</strong>{' '}
            <span style={{ color: '#ef4444' }}>1º Reclamações</span> (veto: impede CRESCIMENTO/ESTÁVEL) →{' '}
            <span style={{ color: '#3b82f6' }}>2º Dias ativos</span> (base da classificação) →{' '}
            <span style={{ color: '#10b981' }}>3º Engajamento</span> (eleva para CRESCIMENTO)
          </p>
        </div>

        {/* Tabela de Thresholds - 100% editável */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: 'rgba(15, 10, 31, 0.6)' }}>
              <th style={{ textAlign: 'left', padding: '12px 16px', color: '#64748b', fontWeight: '600', borderBottom: '1px solid rgba(139, 92, 246, 0.2)', width: '180px' }}>Métrica</th>
              <th style={{ textAlign: 'center', padding: '12px 16px', color: '#10b981', fontWeight: '600', borderBottom: '1px solid rgba(139, 92, 246, 0.2)' }}>Crescimento</th>
              <th style={{ textAlign: 'center', padding: '12px 16px', color: '#3b82f6', fontWeight: '600', borderBottom: '1px solid rgba(139, 92, 246, 0.2)' }}>Estável</th>
              <th style={{ textAlign: 'center', padding: '12px 16px', color: '#f59e0b', fontWeight: '600', borderBottom: '1px solid rgba(139, 92, 246, 0.2)' }}>Alerta</th>
              <th style={{ textAlign: 'center', padding: '12px 16px', color: '#ef4444', fontWeight: '600', borderBottom: '1px solid rgba(139, 92, 246, 0.2)' }}>Resgate</th>
            </tr>
          </thead>
          <tbody>
            {/* Reclamações em aberto (VETO - maior prioridade) */}
            <tr>
              <td style={{ padding: '12px 16px', color: 'white', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>
                Reclamações em aberto
                <span style={{ display: 'block', fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                  (veto: impede níveis superiores)
                </span>
              </td>
              <td style={{ textAlign: 'center', padding: '12px 16px', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>
                <button onClick={() => isAdmin && handleSegmentoConfigChange('reclamacoes_crescimento', !segmentoConfig.reclamacoes_crescimento)} disabled={!isAdmin} style={{ padding: '4px 10px', background: segmentoConfig.reclamacoes_crescimento ? 'rgba(16, 185, 129, 0.2)' : 'rgba(100, 116, 139, 0.2)', border: `1px solid ${segmentoConfig.reclamacoes_crescimento ? 'rgba(16, 185, 129, 0.4)' : 'rgba(100, 116, 139, 0.3)'}`, borderRadius: '6px', color: segmentoConfig.reclamacoes_crescimento ? '#10b981' : '#64748b', fontSize: '12px', fontWeight: '500', cursor: isAdmin ? 'pointer' : 'not-allowed' }}>
                  {segmentoConfig.reclamacoes_crescimento ? 'Sim' : 'Não'}
                </button>
              </td>
              <td style={{ textAlign: 'center', padding: '12px 16px', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>
                <button onClick={() => isAdmin && handleSegmentoConfigChange('reclamacoes_estavel', !segmentoConfig.reclamacoes_estavel)} disabled={!isAdmin} style={{ padding: '4px 10px', background: segmentoConfig.reclamacoes_estavel ? 'rgba(59, 130, 246, 0.2)' : 'rgba(100, 116, 139, 0.2)', border: `1px solid ${segmentoConfig.reclamacoes_estavel ? 'rgba(59, 130, 246, 0.4)' : 'rgba(100, 116, 139, 0.3)'}`, borderRadius: '6px', color: segmentoConfig.reclamacoes_estavel ? '#3b82f6' : '#64748b', fontSize: '12px', fontWeight: '500', cursor: isAdmin ? 'pointer' : 'not-allowed' }}>
                  {segmentoConfig.reclamacoes_estavel ? 'Sim' : 'Não'}
                </button>
              </td>
              <td style={{ textAlign: 'center', padding: '12px 16px', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>
                <button onClick={() => isAdmin && handleSegmentoConfigChange('reclamacoes_alerta', !segmentoConfig.reclamacoes_alerta)} disabled={!isAdmin} style={{ padding: '4px 10px', background: segmentoConfig.reclamacoes_alerta ? 'rgba(245, 158, 11, 0.2)' : 'rgba(100, 116, 139, 0.2)', border: `1px solid ${segmentoConfig.reclamacoes_alerta ? 'rgba(245, 158, 11, 0.4)' : 'rgba(100, 116, 139, 0.3)'}`, borderRadius: '6px', color: segmentoConfig.reclamacoes_alerta ? '#f59e0b' : '#64748b', fontSize: '12px', fontWeight: '500', cursor: isAdmin ? 'pointer' : 'not-allowed' }}>
                  {segmentoConfig.reclamacoes_alerta ? 'Sim' : 'Não'}
                </button>
              </td>
              <td style={{ textAlign: 'center', padding: '12px 16px', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>
                <button onClick={() => isAdmin && handleSegmentoConfigChange('reclamacoes_resgate', !segmentoConfig.reclamacoes_resgate)} disabled={!isAdmin} style={{ padding: '4px 10px', background: segmentoConfig.reclamacoes_resgate ? 'rgba(239, 68, 68, 0.2)' : 'rgba(100, 116, 139, 0.2)', border: `1px solid ${segmentoConfig.reclamacoes_resgate ? 'rgba(239, 68, 68, 0.4)' : 'rgba(100, 116, 139, 0.3)'}`, borderRadius: '6px', color: segmentoConfig.reclamacoes_resgate ? '#ef4444' : '#64748b', fontSize: '12px', fontWeight: '500', cursor: isAdmin ? 'pointer' : 'not-allowed' }}>
                  {segmentoConfig.reclamacoes_resgate ? 'Sim' : 'Não'}
                </button>
              </td>
            </tr>
            {/* Dias ativos/mês (BASE) */}
            <tr>
              <td style={{ padding: '12px 16px', color: 'white', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>
                Dias ativos/mês
                <span style={{ display: 'block', fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                  (base da classificação)
                </span>
              </td>
              <td style={{ textAlign: 'center', padding: '12px 16px', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>
                <input type="number" min="1" value={segmentoConfig.dias_ativos_crescimento} onChange={(e) => handleSegmentoConfigChange('dias_ativos_crescimento', e.target.value)} disabled={!isAdmin} style={{ width: '45px', padding: '6px', background: isAdmin ? '#0f0a1f' : 'rgba(15, 10, 31, 0.4)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '6px', color: '#10b981', fontSize: '13px', textAlign: 'center', outline: 'none', cursor: isAdmin ? 'text' : 'not-allowed' }} />
                <span style={{ color: '#10b981' }}>+</span>
              </td>
              <td style={{ textAlign: 'center', padding: '12px 16px', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>
                <input type="number" min="1" value={segmentoConfig.dias_ativos_estavel} onChange={(e) => handleSegmentoConfigChange('dias_ativos_estavel', e.target.value)} disabled={!isAdmin} style={{ width: '45px', padding: '6px', background: isAdmin ? '#0f0a1f' : 'rgba(15, 10, 31, 0.4)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '6px', color: '#3b82f6', fontSize: '13px', textAlign: 'center', outline: 'none', cursor: isAdmin ? 'text' : 'not-allowed' }} />
                <span style={{ color: '#3b82f6' }}>+</span>
              </td>
              <td style={{ textAlign: 'center', padding: '12px 16px', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>
                <input type="number" min="1" value={segmentoConfig.dias_ativos_alerta} onChange={(e) => handleSegmentoConfigChange('dias_ativos_alerta', e.target.value)} disabled={!isAdmin} style={{ width: '45px', padding: '6px', background: isAdmin ? '#0f0a1f' : 'rgba(15, 10, 31, 0.4)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '6px', color: '#f59e0b', fontSize: '13px', textAlign: 'center', outline: 'none', cursor: isAdmin ? 'text' : 'not-allowed' }} />
                <span style={{ color: '#f59e0b' }}>+</span>
              </td>
              <td style={{ textAlign: 'center', padding: '12px 16px', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>
                <span style={{ color: '#ef4444' }}>até </span>
                <input type="number" min="0" value={segmentoConfig.dias_ativos_resgate} onChange={(e) => handleSegmentoConfigChange('dias_ativos_resgate', e.target.value)} disabled={!isAdmin} style={{ width: '45px', padding: '6px', background: isAdmin ? '#0f0a1f' : 'rgba(15, 10, 31, 0.4)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', color: '#ef4444', fontSize: '13px', textAlign: 'center', outline: 'none', cursor: isAdmin ? 'text' : 'not-allowed' }} />
              </td>
            </tr>
            {/* Score engajamento (ELEVAÇÃO) */}
            <tr>
              <td style={{ padding: '12px 16px', color: 'white' }}>
                Score engajamento
                <span style={{ display: 'block', fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                  (eleva para Crescimento)
                </span>
              </td>
              <td style={{ textAlign: 'center', padding: '12px 16px' }}>
                <input type="number" min="1" value={segmentoConfig.engajamento_crescimento} onChange={(e) => handleSegmentoConfigChange('engajamento_crescimento', e.target.value)} disabled={!isAdmin} style={{ width: '45px', padding: '6px', background: isAdmin ? '#0f0a1f' : 'rgba(15, 10, 31, 0.4)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '6px', color: '#10b981', fontSize: '13px', textAlign: 'center', outline: 'none', cursor: isAdmin ? 'text' : 'not-allowed' }} />
                <span style={{ color: '#10b981' }}>+</span>
              </td>
              <td style={{ textAlign: 'center', padding: '12px 16px' }}>
                <input type="number" min="1" value={segmentoConfig.engajamento_estavel} onChange={(e) => handleSegmentoConfigChange('engajamento_estavel', e.target.value)} disabled={!isAdmin} style={{ width: '45px', padding: '6px', background: isAdmin ? '#0f0a1f' : 'rgba(15, 10, 31, 0.4)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '6px', color: '#3b82f6', fontSize: '13px', textAlign: 'center', outline: 'none', cursor: isAdmin ? 'text' : 'not-allowed' }} />
                <span style={{ color: '#3b82f6' }}>+</span>
              </td>
              <td style={{ textAlign: 'center', padding: '12px 16px' }}>
                <input type="number" min="0" value={segmentoConfig.engajamento_alerta} onChange={(e) => handleSegmentoConfigChange('engajamento_alerta', e.target.value)} disabled={!isAdmin} style={{ width: '45px', padding: '6px', background: isAdmin ? '#0f0a1f' : 'rgba(15, 10, 31, 0.4)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '6px', color: '#f59e0b', fontSize: '13px', textAlign: 'center', outline: 'none', cursor: isAdmin ? 'text' : 'not-allowed' }} />
                <span style={{ color: '#f59e0b' }}>+</span>
              </td>
              <td style={{ textAlign: 'center', padding: '12px 16px' }}>
                <span style={{ color: '#ef4444' }}>até </span>
                <input type="number" min="0" value={segmentoConfig.engajamento_resgate} onChange={(e) => handleSegmentoConfigChange('engajamento_resgate', e.target.value)} disabled={!isAdmin} style={{ width: '45px', padding: '6px', background: isAdmin ? '#0f0a1f' : 'rgba(15, 10, 31, 0.4)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', color: '#ef4444', fontSize: '13px', textAlign: 'center', outline: 'none', cursor: isAdmin ? 'text' : 'not-allowed' }} />
              </td>
            </tr>
          </tbody>
        </table>
        {/* Seção: Pesos do Score de Engajamento */}
        <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.1)' }}>
          <p style={{ color: '#a78bfa', fontSize: '13px', fontWeight: '600', margin: '0 0 12px 0' }}>Fórmula do Score de Engajamento</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ color: '#94a3b8', fontSize: '13px' }}>Score = (peças ×</span>
            <input type="number" min="0.1" step="0.1" value={segmentoConfig.peso_pecas} onChange={(e) => handleSegmentoConfigChange('peso_pecas', parseFloat(e.target.value) || 0)} disabled={!isAdmin} style={{ width: '50px', padding: '4px 6px', background: isAdmin ? '#0f0a1f' : 'rgba(15, 10, 31, 0.4)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '6px', color: '#a78bfa', fontSize: '13px', textAlign: 'center', outline: 'none', cursor: isAdmin ? 'text' : 'not-allowed' }} />
            <span style={{ color: '#94a3b8', fontSize: '13px' }}>) + (IA ×</span>
            <input type="number" min="0.1" step="0.1" value={segmentoConfig.peso_ia} onChange={(e) => handleSegmentoConfigChange('peso_ia', parseFloat(e.target.value) || 0)} disabled={!isAdmin} style={{ width: '50px', padding: '4px 6px', background: isAdmin ? '#0f0a1f' : 'rgba(15, 10, 31, 0.4)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '6px', color: '#a78bfa', fontSize: '13px', textAlign: 'center', outline: 'none', cursor: isAdmin ? 'text' : 'not-allowed' }} />
            <span style={{ color: '#94a3b8', fontSize: '13px' }}>) + (downloads ×</span>
            <input type="number" min="0.1" step="0.1" value={segmentoConfig.peso_downloads} onChange={(e) => handleSegmentoConfigChange('peso_downloads', parseFloat(e.target.value) || 0)} disabled={!isAdmin} style={{ width: '50px', padding: '4px 6px', background: isAdmin ? '#0f0a1f' : 'rgba(15, 10, 31, 0.4)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '6px', color: '#a78bfa', fontSize: '13px', textAlign: 'center', outline: 'none', cursor: isAdmin ? 'text' : 'not-allowed' }} />
            <span style={{ color: '#94a3b8', fontSize: '13px' }}>)</span>
          </div>
        </div>

        {/* Seção: Regras Especiais (Toggles e Thresholds) */}
        <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.1)' }}>
          <p style={{ color: '#a78bfa', fontSize: '13px', fontWeight: '600', margin: '0 0 12px 0' }}>Regras Especiais de Classificação</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {/* Coluna 1: Regras de RESGATE */}
            <div>
              <p style={{ color: '#ef4444', fontSize: '11px', fontWeight: '600', margin: '0 0 8px 0', textTransform: 'uppercase' }}>Condições de Resgate</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Aviso prévio */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                  <span style={{ color: 'white', fontSize: '12px' }}>Aviso prévio = RESGATE</span>
                  <button onClick={() => isAdmin && handleSegmentoConfigChange('aviso_previo_resgate', !segmentoConfig.aviso_previo_resgate)} disabled={!isAdmin} style={{ padding: '3px 8px', background: segmentoConfig.aviso_previo_resgate ? 'rgba(239, 68, 68, 0.2)' : 'rgba(100, 116, 139, 0.2)', border: `1px solid ${segmentoConfig.aviso_previo_resgate ? 'rgba(239, 68, 68, 0.4)' : 'rgba(100, 116, 139, 0.3)'}`, borderRadius: '4px', color: segmentoConfig.aviso_previo_resgate ? '#ef4444' : '#64748b', fontSize: '11px', fontWeight: '500', cursor: isAdmin ? 'pointer' : 'not-allowed' }}>
                    {segmentoConfig.aviso_previo_resgate ? 'Ativo' : 'Inativo'}
                  </button>
                </div>
                {/* Reclamações máximas */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                  <span style={{ color: 'white', fontSize: '12px' }}>Reclamações ≥ X = RESGATE</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input type="number" min="1" value={segmentoConfig.reclamacoes_max_resgate} onChange={(e) => handleSegmentoConfigChange('reclamacoes_max_resgate', e.target.value)} disabled={!isAdmin} style={{ width: '40px', padding: '3px 6px', background: isAdmin ? '#0f0a1f' : 'rgba(15, 10, 31, 0.4)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '4px', color: '#ef4444', fontSize: '12px', textAlign: 'center', outline: 'none', cursor: isAdmin ? 'text' : 'not-allowed' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Coluna 2: Regras de ALERTA */}
            <div>
              <p style={{ color: '#f59e0b', fontSize: '11px', fontWeight: '600', margin: '0 0 8px 0', textTransform: 'uppercase' }}>Condições de Alerta</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Champion saiu */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(245, 158, 11, 0.05)', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.1)' }}>
                  <span style={{ color: 'white', fontSize: '12px' }}>Champion saiu = ALERTA</span>
                  <button onClick={() => isAdmin && handleSegmentoConfigChange('champion_saiu_alerta', !segmentoConfig.champion_saiu_alerta)} disabled={!isAdmin} style={{ padding: '3px 8px', background: segmentoConfig.champion_saiu_alerta ? 'rgba(245, 158, 11, 0.2)' : 'rgba(100, 116, 139, 0.2)', border: `1px solid ${segmentoConfig.champion_saiu_alerta ? 'rgba(245, 158, 11, 0.4)' : 'rgba(100, 116, 139, 0.3)'}`, borderRadius: '4px', color: segmentoConfig.champion_saiu_alerta ? '#f59e0b' : '#64748b', fontSize: '11px', fontWeight: '500', cursor: isAdmin ? 'pointer' : 'not-allowed' }}>
                    {segmentoConfig.champion_saiu_alerta ? 'Ativo' : 'Inativo'}
                  </button>
                </div>
                {/* Tags problema */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(245, 158, 11, 0.05)', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.1)' }}>
                  <span style={{ color: 'white', fontSize: '12px' }}>Tags de problema = ALERTA</span>
                  <button onClick={() => isAdmin && handleSegmentoConfigChange('tags_problema_alerta', !segmentoConfig.tags_problema_alerta)} disabled={!isAdmin} style={{ padding: '3px 8px', background: segmentoConfig.tags_problema_alerta ? 'rgba(245, 158, 11, 0.2)' : 'rgba(100, 116, 139, 0.2)', border: `1px solid ${segmentoConfig.tags_problema_alerta ? 'rgba(245, 158, 11, 0.4)' : 'rgba(100, 116, 139, 0.3)'}`, borderRadius: '4px', color: segmentoConfig.tags_problema_alerta ? '#f59e0b' : '#64748b', fontSize: '11px', fontWeight: '500', cursor: isAdmin ? 'pointer' : 'not-allowed' }}>
                    {segmentoConfig.tags_problema_alerta ? 'Ativo' : 'Inativo'}
                  </button>
                </div>
                {/* Zero produção */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(245, 158, 11, 0.05)', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.1)' }}>
                  <span style={{ color: 'white', fontSize: '12px' }}>Zero produção = ALERTA</span>
                  <button onClick={() => isAdmin && handleSegmentoConfigChange('zero_producao_alerta', !segmentoConfig.zero_producao_alerta)} disabled={!isAdmin} style={{ padding: '3px 8px', background: segmentoConfig.zero_producao_alerta ? 'rgba(245, 158, 11, 0.2)' : 'rgba(100, 116, 139, 0.2)', border: `1px solid ${segmentoConfig.zero_producao_alerta ? 'rgba(245, 158, 11, 0.4)' : 'rgba(100, 116, 139, 0.3)'}`, borderRadius: '4px', color: segmentoConfig.zero_producao_alerta ? '#f59e0b' : '#64748b', fontSize: '11px', fontWeight: '500', cursor: isAdmin ? 'pointer' : 'not-allowed' }}>
                    {segmentoConfig.zero_producao_alerta ? 'Ativo' : 'Inativo'}
                  </button>
                </div>
                {/* Bugs máximos */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(245, 158, 11, 0.05)', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.1)' }}>
                  <span style={{ color: 'white', fontSize: '12px' }}>Bugs abertos ≥ X = ALERTA</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input type="number" min="1" value={segmentoConfig.bugs_max_alerta} onChange={(e) => handleSegmentoConfigChange('bugs_max_alerta', e.target.value)} disabled={!isAdmin} style={{ width: '40px', padding: '3px 6px', background: isAdmin ? '#0f0a1f' : 'rgba(15, 10, 31, 0.4)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '4px', color: '#f59e0b', fontSize: '12px', textAlign: 'center', outline: 'none', cursor: isAdmin ? 'text' : 'not-allowed' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p style={{ color: '#64748b', fontSize: '11px', margin: '12px 0 0 0', fontStyle: 'italic' }}>
          Reclamação = thread negativa/urgente ou erro/reclamação não resolvida
        </p>
      </div>

      {/* SEÇÃO: Filtros de Email (largura total) */}
      <div
        onClick={() => navigate('/configuracoes/filtros-email')}
        style={{
          background: 'rgba(30, 27, 75, 0.4)',
          border: '1px solid rgba(139, 92, 246, 0.15)',
          borderRadius: '20px',
          padding: '20px 24px',
          marginBottom: '24px',
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(249, 115, 22, 0.4)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.15)'}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px',
              background: 'rgba(249, 115, 22, 0.15)',
              borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Mail style={{ width: '20px', height: '20px', color: '#f97316' }} />
            </div>
            <div>
              <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: 0 }}>Filtros de Email</h3>
              <p style={{ color: '#64748b', fontSize: '13px', margin: '2px 0 0 0' }}>
                Configurar filtros de spam, newsletters e auto-replies
              </p>
            </div>
          </div>
          <ChevronRight style={{ width: '20px', height: '20px', color: '#64748b' }} />
        </div>
      </div>

      {/* SEÇÃO: Sincronização / Status (largura total) */}
      <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '20px', padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <RefreshCw style={{ width: '20px', height: '20px', color: '#06b6d4' }} />
          <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>Sincronização / Status</h2>
        </div>

        {/* Erro de sync ClickUp */}
        {clickUpSyncResults?.erro && (
          <div style={{ marginBottom: '16px', padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <XCircle style={{ width: '14px', height: '14px', color: '#ef4444' }} />
            <span style={{ color: '#ef4444', fontSize: '12px' }}>Erro: {clickUpSyncResults.erro}</span>
          </div>
        )}

        {/* Grid de 3 colunas */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
          {/* Coluna 1: Dados (n8n) */}
          <div>
            <p style={{ color: '#64748b', fontSize: '11px', fontWeight: '600', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dados</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[
                { key: 'times_ultima_sync', label: 'Times' },
                { key: 'usuarios_ultima_sync', label: 'Usuários' },
                { key: 'metricas_ultima_sync', label: 'Métricas' },
              ].map(item => {
                const info = formatSyncInfo(syncStatus?.[item.key]);
                return (
                  <div key={item.key} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', background: 'rgba(15, 10, 31, 0.6)',
                    borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.1)'
                  }}>
                    <p style={{ color: 'white', fontSize: '13px', margin: 0 }}>{item.label}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: info.color }} />
                      <span style={{ color: info.color, fontSize: '11px', fontWeight: '500' }}>{info.text}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Coluna 2: Atualização */}
          <div>
            <p style={{ color: '#64748b', fontSize: '11px', fontWeight: '600', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Atualização</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', background: 'rgba(15, 10, 31, 0.6)',
                borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.1)'
              }}>
                <p style={{ color: 'white', fontSize: '13px', margin: 0 }}>Alertas</p>
                <span style={{ color: '#a78bfa', fontSize: '11px', fontWeight: '500' }}>
                  {syncStatus?.ultima_verificacao_alertas
                    ? (syncStatus.ultima_verificacao_alertas.toDate
                        ? syncStatus.ultima_verificacao_alertas.toDate()
                        : new Date(syncStatus.ultima_verificacao_alertas)
                      ).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                    : 'Nunca'}
                </span>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', background: 'rgba(15, 10, 31, 0.6)',
                borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.1)'
              }}>
                <p style={{ color: 'white', fontSize: '13px', margin: 0 }}>ClickUp</p>
                <span style={{ color: syncStatus?.clickup_ativo ? '#a78bfa' : '#64748b', fontSize: '11px', fontWeight: '500' }}>
                  {syncStatus?.ultima_sync_clickup
                    ? (syncStatus.ultima_sync_clickup.toDate
                        ? syncStatus.ultima_sync_clickup.toDate()
                        : new Date(syncStatus.ultima_sync_clickup)
                      ).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                    : 'Nunca'}
                </span>
              </div>
              {/* Botão Sync Manual */}
              {isClickUpConfigured() && (
                <button
                  onClick={runClickUpSync}
                  disabled={sincronizandoClickUp}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    padding: '8px 12px',
                    background: sincronizandoClickUp ? 'rgba(6, 182, 212, 0.2)' : 'rgba(6, 182, 212, 0.1)',
                    border: '1px solid rgba(6, 182, 212, 0.3)',
                    borderRadius: '8px',
                    color: '#06b6d4',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: sincronizandoClickUp ? 'not-allowed' : 'pointer',
                    marginTop: '4px'
                  }}
                >
                  <RefreshCw style={{ width: '12px', height: '12px', animation: sincronizandoClickUp ? 'spin 1s linear infinite' : 'none' }} />
                  {sincronizandoClickUp ? 'Sincronizando...' : 'Sincronizar Agora'}
                </button>
              )}
            </div>
          </div>

          {/* Coluna 3: APIs */}
          <div>
            <p style={{ color: '#64748b', fontSize: '11px', fontWeight: '600', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>APIs</p>
            <div style={{ display: 'flex', gap: '6px' }}>
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', background: 'rgba(15, 10, 31, 0.6)',
                borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.1)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Zap style={{ width: '14px', height: '14px', color: openAIStatus?.configured ? '#10b981' : '#ef4444' }} />
                  <p style={{ color: 'white', fontSize: '13px', margin: 0 }}>OpenAI</p>
                </div>
                <span style={{
                  padding: '2px 6px',
                  background: openAIStatus?.configured ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: openAIStatus?.configured ? '#10b981' : '#ef4444',
                  borderRadius: '4px', fontSize: '10px', fontWeight: '500'
                }}>
                  {openAIStatus?.configured ? 'OK' : 'OFF'}
                </span>
              </div>
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', background: 'rgba(15, 10, 31, 0.6)',
                borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.1)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Zap style={{ width: '14px', height: '14px', color: clickUpStatus?.configured ? '#10b981' : '#64748b' }} />
                  <p style={{ color: 'white', fontSize: '13px', margin: 0 }}>ClickUp</p>
                </div>
                <span style={{
                  padding: '2px 6px',
                  background: clickUpStatus?.configured ? 'rgba(16, 185, 129, 0.2)' : 'rgba(100, 116, 139, 0.2)',
                  color: clickUpStatus?.configured ? '#10b981' : '#64748b',
                  borderRadius: '4px', fontSize: '10px', fontWeight: '500'
                }}>
                  {clickUpStatus?.configured ? 'OK' : 'OFF'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
