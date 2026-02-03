// Configurações do Sistema
import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  Save, CheckCircle, AlertTriangle, Sliders, Activity, Clock,
  Bell, Link2, Zap, RefreshCw, XCircle, Play, Heart, CloudDownload, Lock, Eye,
  Mail, Plus, X, EyeOff, Trash2
} from 'lucide-react';
import { SEGMENTOS_CS } from '../utils/segmentoCS';
import { DEFAULT_EMAIL_FILTERS } from '../utils/emailFilters';
import { isClickUpConfigured } from '../services/clickup';
import { useSincronizarClickUp } from '../hooks/useAlertas';
import { sincronizarPlaybooksComClickUp } from '../services/playbooks';
import { validateForm } from '../validation';
import { configGeralSchema } from '../validation/configuracoes';

export default function Configuracoes() {
  const { user } = useAuth();
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

  // Parâmetros de Segmentação CS
  const PARAMETROS_SEGMENTO_PADRAO = {
    // Thresholds de dias sem uso
    dias_sem_uso_watch: 14,
    dias_sem_uso_rescue: 30,
    // Thresholds de reclamações
    dias_reclamacao_grave: 7,
    dias_reclamacoes_recentes: 30,
    // Thresholds de frequência (dias ativos no mês)
    dias_ativos_frequente: 20,
    dias_ativos_regular: 8,
    dias_ativos_irregular: 3,
    // Thresholds de engajamento (score)
    engajamento_alto: 50,
    engajamento_medio: 15
  };

  const PARAMETROS_PADRAO = {
    dias_sem_contato_alerta: 7,
    dias_sem_contato_critico: 14,
    dias_periodo_analise: 30
  };

  // Parâmetros de segmentação editáveis
  const [segmentoConfig, setSegmentoConfig] = useState({
    dias_sem_uso_watch: 14,
    dias_sem_uso_rescue: 30,
    dias_reclamacao_grave: 7,
    dias_reclamacoes_recentes: 30,
    dias_ativos_frequente: 20,
    dias_ativos_regular: 8,
    dias_ativos_irregular: 3,
    engajamento_alto: 50,
    engajamento_medio: 15
  });

  // Parâmetros de análise
  const [parametros, setParametros] = useState({
    dias_sem_contato_alerta: 7,
    dias_sem_contato_critico: 14,
    dias_periodo_analise: 30
  });

  // Verificar se usuário é admin
  useEffect(() => {
    const checkAdminRole = async () => {
      if (!user?.email) {
        setIsAdmin(false);
        setCheckingRole(false);
        return;
      }

      try {
        const q = query(
          collection(db, 'usuarios_sistema'),
          where('email', '==', user.email)
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const userData = snapshot.docs[0].data();
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
  }, [user?.email]);

  // Configurações de alertas (sem dias - unificado em parâmetros)
  const [alertaConfig, setAlertaConfig] = useState({
    alerta_sentimento_negativo: true,
    alerta_erro_bug: true,
    alerta_urgente_automatico: true
  });

  // Configurações de filtros de email
  const [emailFilterConfig, setEmailFilterConfig] = useState(DEFAULT_EMAIL_FILTERS);
  const [novoItemFiltro, setNovoItemFiltro] = useState({ dominios_bloqueados: '', dominios_completos_bloqueados: '', palavras_chave_assunto: '' });

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        // Fetch config geral
        const configDocRef = doc(db, 'config', 'geral');
        const configDocSnap = await getDoc(configDocRef);
        if (configDocSnap.exists()) {
          const data = configDocSnap.data();
          if (data.parametros) setParametros(data.parametros);
          if (data.segmentoConfig) setSegmentoConfig(data.segmentoConfig);
        }

        // Fetch Alert config
        const alertDocRef = doc(db, 'config', 'alertas');
        const alertDocSnap = await getDoc(alertDocRef);
        if (alertDocSnap.exists()) {
          const data = alertDocSnap.data();
          setAlertaConfig(prev => ({ ...prev, ...data }));
        }

        // Fetch Email Filter config
        const filterDocRef = doc(db, 'config', 'email_filters');
        const filterDocSnap = await getDoc(filterDocRef);
        if (filterDocSnap.exists()) {
          setEmailFilterConfig(prev => ({ ...prev, ...filterDocSnap.data() }));
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
    // Check ClickUp
    const clickUpApiKey = import.meta.env.VITE_CLICKUP_API_KEY;
    const clickUpTeamId = import.meta.env.VITE_CLICKUP_TEAM_ID;
    setClickUpStatus({
      configured: !!(clickUpApiKey && clickUpTeamId),
      apiKey: clickUpApiKey ? 'Configurada' : 'Não configurada',
      teamId: clickUpTeamId || 'Não configurado'
    });

    // Check OpenAI
    const openAIKey = import.meta.env.VITE_OPENAI_API_KEY;
    setOpenAIStatus({
      configured: !!openAIKey,
      apiKey: openAIKey ? 'Configurada' : 'Não configurada'
    });
  };

  // Sincronização completa com ClickUp (alertas + playbooks)
  const runClickUpSync = async () => {
    setSincronizandoClickUp(true);
    setClickUpSyncResults(null);

    try {
      // Sincronizar alertas e playbooks em paralelo
      const [alertasResult, playbooksResult] = await Promise.all([
        sincronizarComClickUp(),
        sincronizarPlaybooksComClickUp()
      ]);

      setClickUpSyncResults({
        alertas: alertasResult,
        playbooks: playbooksResult
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

  // Restaurar valores padrão
  const restaurarPadroes = () => {
    setParametros(PARAMETROS_PADRAO);
    setSegmentoConfig(PARAMETROS_SEGMENTO_PADRAO);
    setEmailFilterConfig(DEFAULT_EMAIL_FILTERS);
  };

  // Helpers para listas de filtros de email
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

  const handleSave = async () => {
    if (!isAdmin) return;

    // Validar configurações numéricas
    const configData = { ...parametros, ...segmentoConfig };
    const validationErrors = validateForm(configGeralSchema, configData);
    if (validationErrors) {
      alert('Erro de validação:\n' + Object.values(validationErrors).join('\n'));
      return;
    }

    setSaving(true);
    setSaveSuccess(false);
    try {
      // Save config geral (inclui segmentoConfig)
      const configDocRef = doc(db, 'config', 'geral');
      await setDoc(configDocRef, {
        parametros,
        segmentoConfig,
        updated_at: new Date()
      });

      // Save Alert config
      const alertDocRef = doc(db, 'config', 'alertas');
      await setDoc(alertDocRef, {
        ...alertaConfig,
        updated_at: new Date()
      });

      // Save Email Filters config
      const filterDocRef = doc(db, 'config', 'email_filters');
      await setDoc(filterDocRef, {
        ...emailFilterConfig,
        updated_at: new Date()
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      alert('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const handleParametroChange = (field, value) => {
    setParametros(prev => ({ ...prev, [field]: Number(value) || 0 }));
  };

  const handleSegmentoConfigChange = (field, value) => {
    setSegmentoConfig(prev => ({ ...prev, [field]: Number(value) || 0 }));
  };

  const handleAlertaConfigChange = (field, value) => {
    setAlertaConfig(prev => ({ ...prev, [field]: value }));
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
        {isAdmin && (
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={restaurarPadroes}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 20px',
                background: 'rgba(100, 116, 139, 0.2)',
                border: '1px solid rgba(100, 116, 139, 0.3)',
                borderRadius: '12px',
                color: '#94a3b8',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              <RefreshCw style={{ width: '16px', height: '16px' }} />
              Restaurar Padrões
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                border: 'none',
                borderRadius: '12px',
                color: 'white',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                opacity: saving ? 0.7 : 1,
                boxShadow: '0 4px 20px rgba(139, 92, 246, 0.3)'
              }}
            >
              {saveSuccess ? <CheckCircle style={{ width: '18px', height: '18px' }} /> : <Save style={{ width: '18px', height: '18px' }} />}
              {saving ? 'Salvando...' : saveSuccess ? 'Salvo!' : 'Salvar Configurações'}
            </button>
          </div>
        )}
      </div>

      {/* Sincronização com ClickUp */}
      {isClickUpConfigured() && (
        <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(6, 182, 212, 0.2)', borderRadius: '20px', padding: '24px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <CloudDownload style={{ width: '22px', height: '22px', color: 'white' }} />
              </div>
              <div>
                <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: '0 0 4px 0' }}>Sincronizar com ClickUp</h2>
                <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
                  Atualiza status de alertas e etapas de playbooks a partir do ClickUp
                </p>
              </div>
            </div>
            <button
              onClick={runClickUpSync}
              disabled={sincronizandoClickUp}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                background: sincronizandoClickUp ? 'rgba(6, 182, 212, 0.3)' : 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                border: 'none',
                borderRadius: '12px',
                color: 'white',
                fontSize: '14px',
                fontWeight: '600',
                cursor: sincronizandoClickUp ? 'not-allowed' : 'pointer'
              }}
            >
              {sincronizandoClickUp ? (
                <RefreshCw style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} />
              ) : (
                <RefreshCw style={{ width: '18px', height: '18px' }} />
              )}
              {sincronizandoClickUp ? 'Sincronizando...' : 'Sincronizar Agora'}
            </button>
          </div>

          {/* Results */}
          {clickUpSyncResults && !clickUpSyncResults.erro && (
            <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <CheckCircle style={{ width: '18px', height: '18px', color: '#06b6d4' }} />
                <span style={{ color: 'white', fontSize: '14px', fontWeight: '600' }}>Sincronização concluída!</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                {/* Alertas */}
                <div style={{ padding: '16px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                  <p style={{ color: '#8b5cf6', fontSize: '12px', fontWeight: '600', margin: '0 0 8px 0', textTransform: 'uppercase' }}>Alertas</p>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <div>
                      <p style={{ color: 'white', fontSize: '20px', fontWeight: '700', margin: 0 }}>{clickUpSyncResults.alertas?.atualizados || 0}</p>
                      <p style={{ color: '#64748b', fontSize: '11px', margin: 0 }}>Atualizados</p>
                    </div>
                    <div>
                      <p style={{ color: '#64748b', fontSize: '20px', fontWeight: '700', margin: 0 }}>{clickUpSyncResults.alertas?.total || 0}</p>
                      <p style={{ color: '#64748b', fontSize: '11px', margin: 0 }}>Verificados</p>
                    </div>
                  </div>
                </div>
                {/* Playbooks */}
                <div style={{ padding: '16px', background: 'rgba(6, 182, 212, 0.1)', borderRadius: '12px', border: '1px solid rgba(6, 182, 212, 0.2)' }}>
                  <p style={{ color: '#06b6d4', fontSize: '12px', fontWeight: '600', margin: '0 0 8px 0', textTransform: 'uppercase' }}>Playbooks</p>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <div>
                      <p style={{ color: 'white', fontSize: '20px', fontWeight: '700', margin: 0 }}>{clickUpSyncResults.playbooks?.etapasAtualizadas || 0}</p>
                      <p style={{ color: '#64748b', fontSize: '11px', margin: 0 }}>Etapas Atualizadas</p>
                    </div>
                    <div>
                      <p style={{ color: '#64748b', fontSize: '20px', fontWeight: '700', margin: 0 }}>{clickUpSyncResults.playbooks?.totalPlaybooks || 0}</p>
                      <p style={{ color: '#64748b', fontSize: '11px', margin: 0 }}>Playbooks</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Detalhes das atualizações */}
              {((clickUpSyncResults.alertas?.detalhes?.length > 0) || (clickUpSyncResults.playbooks?.detalhes?.length > 0)) && (
                <div style={{ marginTop: '16px', maxHeight: '150px', overflowY: 'auto' }}>
                  <p style={{ color: '#64748b', fontSize: '12px', marginBottom: '8px' }}>Alterações:</p>
                  {clickUpSyncResults.alertas?.detalhes?.map((d, i) => (
                    <div key={`alerta-${i}`} style={{ fontSize: '12px', color: '#94a3b8', padding: '4px 0', borderBottom: '1px solid rgba(139, 92, 246, 0.1)' }}>
                      <span style={{ color: '#8b5cf6' }}>[Alerta]</span> {d.titulo}: {d.de} → {d.para}
                    </div>
                  ))}
                  {clickUpSyncResults.playbooks?.detalhes?.map((d, i) => (
                    <div key={`playbook-${i}`} style={{ fontSize: '12px', color: '#94a3b8', padding: '4px 0', borderBottom: '1px solid rgba(6, 182, 212, 0.1)' }}>
                      <span style={{ color: '#06b6d4' }}>[Playbook]</span> {d.cliente} - {d.etapa}: {d.de} → {d.para}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {clickUpSyncResults?.erro && (
            <div style={{ marginTop: '16px', padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <XCircle style={{ width: '18px', height: '18px', color: '#ef4444' }} />
              <span style={{ color: '#ef4444', fontSize: '14px' }}>Erro: {clickUpSyncResults.erro}</span>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* COLUNA ESQUERDA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* SEÇÃO 1: Segmentos CS */}
          <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '20px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <Activity style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
              <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>Segmentos CS</h2>
            </div>

            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px' }}>
              Os clientes são classificados automaticamente em 4 segmentos baseado em dados de uso e engajamento
            </p>

            {/* Parâmetros editáveis de segmentação */}
            <div style={{ marginBottom: '24px', padding: '16px', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
              <p style={{ color: '#8b5cf6', fontSize: '13px', fontWeight: '600', margin: '0 0 16px 0', textTransform: 'uppercase' }}>Parâmetros de Classificação</p>

              {/* Seção: Dias sem uso */}
              <p style={{ color: '#64748b', fontSize: '11px', fontWeight: '600', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dias sem Atividade</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                {/* Dias sem uso - WATCH */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '10px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                  <div>
                    <p style={{ color: '#f59e0b', fontSize: '13px', fontWeight: '500', margin: 0 }}>Dias sem uso → Alerta</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="number"
                      min="1"
                      value={segmentoConfig.dias_sem_uso_watch}
                      onChange={(e) => handleSegmentoConfigChange('dias_sem_uso_watch', e.target.value)}
                      disabled={!isAdmin}
                      style={{
                        width: '60px',
                        padding: '6px 10px',
                        background: isAdmin ? '#0f0a1f' : 'rgba(15, 10, 31, 0.4)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        borderRadius: '6px',
                        color: isAdmin ? 'white' : '#64748b',
                        fontSize: '13px',
                        textAlign: 'center',
                        outline: 'none',
                        cursor: isAdmin ? 'text' : 'not-allowed'
                      }}
                    />
                    <span style={{ color: '#64748b', fontSize: '12px' }}>dias</span>
                  </div>
                </div>

                {/* Dias sem uso - RESCUE */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <div>
                    <p style={{ color: '#ef4444', fontSize: '13px', fontWeight: '500', margin: 0 }}>Dias sem uso → Resgate</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="number"
                      min="1"
                      value={segmentoConfig.dias_sem_uso_rescue}
                      onChange={(e) => handleSegmentoConfigChange('dias_sem_uso_rescue', e.target.value)}
                      disabled={!isAdmin}
                      style={{
                        width: '60px',
                        padding: '6px 10px',
                        background: isAdmin ? '#0f0a1f' : 'rgba(15, 10, 31, 0.4)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '6px',
                        color: isAdmin ? 'white' : '#64748b',
                        fontSize: '13px',
                        textAlign: 'center',
                        outline: 'none',
                        cursor: isAdmin ? 'text' : 'not-allowed'
                      }}
                    />
                    <span style={{ color: '#64748b', fontSize: '12px' }}>dias</span>
                  </div>
                </div>
              </div>

              {/* Seção: Reclamações */}
              <p style={{ color: '#64748b', fontSize: '11px', fontWeight: '600', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Janela de Reclamações</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                {/* Reclamação grave */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <div>
                    <p style={{ color: '#ef4444', fontSize: '13px', fontWeight: '500', margin: 0 }}>Reclamação grave (urgente)</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="number"
                      min="1"
                      value={segmentoConfig.dias_reclamacao_grave}
                      onChange={(e) => handleSegmentoConfigChange('dias_reclamacao_grave', e.target.value)}
                      disabled={!isAdmin}
                      style={{
                        width: '60px',
                        padding: '6px 10px',
                        background: isAdmin ? '#0f0a1f' : 'rgba(15, 10, 31, 0.4)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '6px',
                        color: isAdmin ? 'white' : '#64748b',
                        fontSize: '13px',
                        textAlign: 'center',
                        outline: 'none',
                        cursor: isAdmin ? 'text' : 'not-allowed'
                      }}
                    />
                    <span style={{ color: '#64748b', fontSize: '12px' }}>dias</span>
                  </div>
                </div>

                {/* Reclamações recentes */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '10px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                  <div>
                    <p style={{ color: '#f59e0b', fontSize: '13px', fontWeight: '500', margin: 0 }}>Reclamações recentes</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="number"
                      min="1"
                      value={segmentoConfig.dias_reclamacoes_recentes}
                      onChange={(e) => handleSegmentoConfigChange('dias_reclamacoes_recentes', e.target.value)}
                      disabled={!isAdmin}
                      style={{
                        width: '60px',
                        padding: '6px 10px',
                        background: isAdmin ? '#0f0a1f' : 'rgba(15, 10, 31, 0.4)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        borderRadius: '6px',
                        color: isAdmin ? 'white' : '#64748b',
                        fontSize: '13px',
                        textAlign: 'center',
                        outline: 'none',
                        cursor: isAdmin ? 'text' : 'not-allowed'
                      }}
                    />
                    <span style={{ color: '#64748b', fontSize: '12px' }}>dias</span>
                  </div>
                </div>
              </div>

              {/* Seção: Frequência de Uso */}
              <p style={{ color: '#64748b', fontSize: '11px', fontWeight: '600', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Frequência de Uso (dias ativos/mês)</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                {/* Frequente */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  <div>
                    <p style={{ color: '#10b981', fontSize: '13px', fontWeight: '500', margin: 0 }}>Uso Frequente (Crescimento)</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="number"
                      min="1"
                      value={segmentoConfig.dias_ativos_frequente}
                      onChange={(e) => handleSegmentoConfigChange('dias_ativos_frequente', e.target.value)}
                      disabled={!isAdmin}
                      style={{
                        width: '60px',
                        padding: '6px 10px',
                        background: isAdmin ? '#0f0a1f' : 'rgba(15, 10, 31, 0.4)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: '6px',
                        color: isAdmin ? 'white' : '#64748b',
                        fontSize: '13px',
                        textAlign: 'center',
                        outline: 'none',
                        cursor: isAdmin ? 'text' : 'not-allowed'
                      }}
                    />
                    <span style={{ color: '#64748b', fontSize: '12px' }}>dias+</span>
                  </div>
                </div>

                {/* Regular */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '10px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                  <div>
                    <p style={{ color: '#3b82f6', fontSize: '13px', fontWeight: '500', margin: 0 }}>Uso Regular (Estavel)</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="number"
                      min="1"
                      value={segmentoConfig.dias_ativos_regular}
                      onChange={(e) => handleSegmentoConfigChange('dias_ativos_regular', e.target.value)}
                      disabled={!isAdmin}
                      style={{
                        width: '60px',
                        padding: '6px 10px',
                        background: isAdmin ? '#0f0a1f' : 'rgba(15, 10, 31, 0.4)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: '6px',
                        color: isAdmin ? 'white' : '#64748b',
                        fontSize: '13px',
                        textAlign: 'center',
                        outline: 'none',
                        cursor: isAdmin ? 'text' : 'not-allowed'
                      }}
                    />
                    <span style={{ color: '#64748b', fontSize: '12px' }}>dias+</span>
                  </div>
                </div>

                {/* Irregular */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '10px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                  <div>
                    <p style={{ color: '#f59e0b', fontSize: '13px', fontWeight: '500', margin: 0 }}>Uso Irregular (Alerta)</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="number"
                      min="1"
                      value={segmentoConfig.dias_ativos_irregular}
                      onChange={(e) => handleSegmentoConfigChange('dias_ativos_irregular', e.target.value)}
                      disabled={!isAdmin}
                      style={{
                        width: '60px',
                        padding: '6px 10px',
                        background: isAdmin ? '#0f0a1f' : 'rgba(15, 10, 31, 0.4)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        borderRadius: '6px',
                        color: isAdmin ? 'white' : '#64748b',
                        fontSize: '13px',
                        textAlign: 'center',
                        outline: 'none',
                        cursor: isAdmin ? 'text' : 'not-allowed'
                      }}
                    />
                    <span style={{ color: '#64748b', fontSize: '12px' }}>dias+</span>
                  </div>
                </div>
              </div>

              {/* Seção: Engajamento */}
              <p style={{ color: '#64748b', fontSize: '11px', fontWeight: '600', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Score de Engajamento</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Engajamento Alto */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  <div>
                    <p style={{ color: '#10b981', fontSize: '13px', fontWeight: '500', margin: 0 }}>Engajamento Alto</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="number"
                      min="1"
                      value={segmentoConfig.engajamento_alto}
                      onChange={(e) => handleSegmentoConfigChange('engajamento_alto', e.target.value)}
                      disabled={!isAdmin}
                      style={{
                        width: '60px',
                        padding: '6px 10px',
                        background: isAdmin ? '#0f0a1f' : 'rgba(15, 10, 31, 0.4)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: '6px',
                        color: isAdmin ? 'white' : '#64748b',
                        fontSize: '13px',
                        textAlign: 'center',
                        outline: 'none',
                        cursor: isAdmin ? 'text' : 'not-allowed'
                      }}
                    />
                    <span style={{ color: '#64748b', fontSize: '12px' }}>pts+</span>
                  </div>
                </div>

                {/* Engajamento Médio */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '10px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                  <div>
                    <p style={{ color: '#3b82f6', fontSize: '13px', fontWeight: '500', margin: 0 }}>Engajamento Médio</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="number"
                      min="1"
                      value={segmentoConfig.engajamento_medio}
                      onChange={(e) => handleSegmentoConfigChange('engajamento_medio', e.target.value)}
                      disabled={!isAdmin}
                      style={{
                        width: '60px',
                        padding: '6px 10px',
                        background: isAdmin ? '#0f0a1f' : 'rgba(15, 10, 31, 0.4)',
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: '6px',
                        color: isAdmin ? 'white' : '#64748b',
                        fontSize: '13px',
                        textAlign: 'center',
                        outline: 'none',
                        cursor: isAdmin ? 'text' : 'not-allowed'
                      }}
                    />
                    <span style={{ color: '#64748b', fontSize: '12px' }}>pts+</span>
                  </div>
                </div>
              </div>

              {/* Nota explicativa */}
              <p style={{ color: '#64748b', fontSize: '11px', margin: '16px 0 0 0', fontStyle: 'italic' }}>
                Score de engajamento = (peças criadas × 2) + (uso de IA × 1.5) + downloads
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {Object.values(SEGMENTOS_CS).map(segmento => (
                <div key={segmento.value} style={{ padding: '16px', background: segmento.bgColor, borderRadius: '12px', border: `1px solid ${segmento.borderColor}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <div style={{ width: '12px', height: '12px', background: segmento.color, borderRadius: '50%' }}></div>
                    <p style={{ color: segmento.color, fontSize: '15px', fontWeight: '600', margin: 0 }}>{segmento.label}</p>
                  </div>
                  <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 8px 0' }}>{segmento.description}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {segmento.criterios.map((criterio, idx) => (
                      <span key={idx} style={{ padding: '4px 8px', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '6px', fontSize: '11px', color: '#64748b' }}>
                        {criterio}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* SEÇÃO 3: Configurações de Alertas */}
          <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '20px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <Bell style={{ width: '20px', height: '20px', color: '#f59e0b' }} />
              <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>Configurações de Alertas</h2>
            </div>

            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px' }}>
              Configure quando alertas devem ser criados automaticamente
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Alerta para sentimento negativo */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.1)' }}>
                <div>
                  <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: '0 0 2px 0' }}>Alerta para sentimento negativo</p>
                  <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>Criar alerta quando thread tiver sentimento negativo</p>
                </div>
                <button
                  onClick={() => isAdmin && handleAlertaConfigChange('alerta_sentimento_negativo', !alertaConfig.alerta_sentimento_negativo)}
                  disabled={!isAdmin}
                  style={{
                    width: '48px',
                    height: '28px',
                    borderRadius: '14px',
                    background: alertaConfig.alerta_sentimento_negativo ? '#8b5cf6' : 'rgba(100, 116, 139, 0.3)',
                    border: 'none',
                    cursor: isAdmin ? 'pointer' : 'not-allowed',
                    position: 'relative',
                    transition: 'all 0.2s ease',
                    opacity: isAdmin ? 1 : 0.6
                  }}
                >
                  <div style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    background: 'white',
                    position: 'absolute',
                    top: '3px',
                    left: alertaConfig.alerta_sentimento_negativo ? '23px' : '3px',
                    transition: 'all 0.2s ease'
                  }}></div>
                </button>
              </div>

              {/* Alerta para erro/bug */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.1)' }}>
                <div>
                  <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: '0 0 2px 0' }}>Alerta para erro/bug</p>
                  <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>Criar alerta quando thread for categorizada como bug</p>
                </div>
                <button
                  onClick={() => isAdmin && handleAlertaConfigChange('alerta_erro_bug', !alertaConfig.alerta_erro_bug)}
                  disabled={!isAdmin}
                  style={{
                    width: '48px',
                    height: '28px',
                    borderRadius: '14px',
                    background: alertaConfig.alerta_erro_bug ? '#8b5cf6' : 'rgba(100, 116, 139, 0.3)',
                    border: 'none',
                    cursor: isAdmin ? 'pointer' : 'not-allowed',
                    position: 'relative',
                    transition: 'all 0.2s ease',
                    opacity: isAdmin ? 1 : 0.6
                  }}
                >
                  <div style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    background: 'white',
                    position: 'absolute',
                    top: '3px',
                    left: alertaConfig.alerta_erro_bug ? '23px' : '3px',
                    transition: 'all 0.2s ease'
                  }}></div>
                </button>
              </div>

              {/* Alerta urgente automático */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.1)' }}>
                <div>
                  <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: '0 0 2px 0' }}>Alerta urgente automático</p>
                  <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>Criar alerta urgente para sentimento "urgente"</p>
                </div>
                <button
                  onClick={() => isAdmin && handleAlertaConfigChange('alerta_urgente_automatico', !alertaConfig.alerta_urgente_automatico)}
                  disabled={!isAdmin}
                  style={{
                    width: '48px',
                    height: '28px',
                    borderRadius: '14px',
                    background: alertaConfig.alerta_urgente_automatico ? '#8b5cf6' : 'rgba(100, 116, 139, 0.3)',
                    border: 'none',
                    cursor: isAdmin ? 'pointer' : 'not-allowed',
                    position: 'relative',
                    transition: 'all 0.2s ease',
                    opacity: isAdmin ? 1 : 0.6
                  }}
                >
                  <div style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    background: 'white',
                    position: 'absolute',
                    top: '3px',
                    left: alertaConfig.alerta_urgente_automatico ? '23px' : '3px',
                    transition: 'all 0.2s ease'
                  }}></div>
                </button>
              </div>
            </div>
          </div>

          {/* SEÇÃO: Filtros de Email */}
          <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '20px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <Mail style={{ width: '20px', height: '20px', color: '#f97316' }} />
              <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>Filtros de Email</h2>
            </div>

            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px' }}>
              Filtre emails irrelevantes (newsletters, auto-replies, spam) das conversas com clientes
            </p>

            {/* Toggles */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              {/* Filtro ativo */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.1)' }}>
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.1)' }}>
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.1)' }}>
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

            {/* Listas editáveis */}
            {[
              { campo: 'dominios_bloqueados', label: 'Prefixos de email bloqueados', placeholder: 'Ex: noreply@', desc: 'Bloqueia emails que começam com estes prefixos' },
              { campo: 'dominios_completos_bloqueados', label: 'Domínios bloqueados', placeholder: 'Ex: mailchimp.com', desc: 'Bloqueia todos os emails destes domínios' },
              { campo: 'palavras_chave_assunto', label: 'Palavras-chave no assunto', placeholder: 'Ex: newsletter', desc: 'Filtra emails com estas palavras no assunto' }
            ].map(({ campo, label, placeholder, desc }) => (
              <div key={campo} style={{ marginBottom: '16px' }}>
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
                        flex: 1, padding: '8px 12px',
                        background: '#0f0a1f', border: '1px solid rgba(139, 92, 246, 0.2)',
                        borderRadius: '8px', color: 'white', fontSize: '13px', outline: 'none'
                      }}
                    />
                    <button
                      onClick={() => adicionarItemFiltro(campo)}
                      style={{
                        padding: '8px 14px',
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

          {/* SEÇÃO 4: Parâmetros de Análise */}
          <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '20px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <Clock style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
              <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>Parâmetros de Análise</h2>
            </div>

            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px' }}>
              Configure os períodos para alertas e análises
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { key: 'dias_sem_contato_alerta', label: 'Dias sem contato (Alerta)', desc: 'Gera alerta de atenção' },
                { key: 'dias_sem_contato_critico', label: 'Dias sem contato (Crítico)', desc: 'Gera alerta crítico' },
                { key: 'dias_periodo_analise', label: 'Período de análise', desc: 'Janela para cálculo de métricas' }
              ].map(item => (
                <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.1)' }}>
                  <div>
                    <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: '0 0 2px 0' }}>{item.label}</p>
                    <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>{item.desc}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="number"
                      min="1"
                      value={parametros[item.key]}
                      onChange={(e) => handleParametroChange(item.key, e.target.value)}
                      disabled={!isAdmin}
                      style={{
                        width: '70px',
                        padding: '8px 12px',
                        background: isAdmin ? '#0f0a1f' : 'rgba(15, 10, 31, 0.4)',
                        border: '1px solid #3730a3',
                        borderRadius: '8px',
                        color: isAdmin ? 'white' : '#64748b',
                        fontSize: '14px',
                        textAlign: 'center',
                        outline: 'none',
                        cursor: isAdmin ? 'text' : 'not-allowed'
                      }}
                    />
                    <span style={{ color: '#64748b', fontSize: '14px' }}>dias</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SEÇÃO 5: Integrações (simplificado) */}
          <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '20px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <Link2 style={{ width: '20px', height: '20px', color: '#06b6d4' }} />
              <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>Status das Integrações</h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* OpenAI */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    background: openAIStatus?.configured ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Zap style={{ width: '18px', height: '18px', color: openAIStatus?.configured ? '#10b981' : '#ef4444' }} />
                  </div>
                  <div>
                    <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: 0 }}>OpenAI</p>
                    <p style={{ color: '#64748b', fontSize: '11px', margin: 0 }}>Classificação de threads</p>
                  </div>
                </div>
                <span style={{
                  padding: '4px 10px',
                  background: openAIStatus?.configured ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                  color: openAIStatus?.configured ? '#10b981' : '#ef4444',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: '500'
                }}>
                  {openAIStatus?.configured ? 'Ativo' : 'Inativo'}
                </span>
              </div>

              {/* ClickUp */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    background: clickUpStatus?.configured ? 'rgba(16, 185, 129, 0.2)' : 'rgba(100, 116, 139, 0.2)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Zap style={{ width: '18px', height: '18px', color: clickUpStatus?.configured ? '#10b981' : '#64748b' }} />
                  </div>
                  <div>
                    <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: 0 }}>ClickUp</p>
                    <p style={{ color: '#64748b', fontSize: '11px', margin: 0 }}>Alertas e Playbooks</p>
                  </div>
                </div>
                <span style={{
                  padding: '4px 10px',
                  background: clickUpStatus?.configured ? 'rgba(16, 185, 129, 0.2)' : 'rgba(100, 116, 139, 0.2)',
                  color: clickUpStatus?.configured ? '#10b981' : '#64748b',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: '500'
                }}>
                  {clickUpStatus?.configured ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
