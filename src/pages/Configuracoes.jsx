// Configurações do Sistema
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import {
  Settings, Save, CheckCircle, AlertTriangle, Sliders, Activity, Clock,
  Bell, Link2, Zap, Users, ExternalLink, RefreshCw, XCircle
} from 'lucide-react';

export default function Configuracoes() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Estado para testes de integração
  const [testingClickUp, setTestingClickUp] = useState(false);
  const [testingOpenAI, setTestingOpenAI] = useState(false);
  const [clickUpStatus, setClickUpStatus] = useState(null);
  const [openAIStatus, setOpenAIStatus] = useState(null);

  // Pesos do Health Score
  const [pesos, setPesos] = useState({
    engajamento: 20,
    sentimento: 20,
    tickets: 15,
    tempo_contato: 15,
    uso_escala: 15,
    uso_ai: 15
  });

  // Thresholds de status
  const [thresholds, setThresholds] = useState({
    saudavel: 80,
    atencao: 60,
    risco: 40,
    critico: 0
  });

  // Parâmetros de análise
  const [parametros, setParametros] = useState({
    dias_sem_contato_alerta: 7,
    dias_sem_contato_critico: 14,
    dias_periodo_analise: 30
  });

  // Configurações de alertas
  const [alertaConfig, setAlertaConfig] = useState({
    dias_sem_contato_para_alerta: 7,
    alerta_sentimento_negativo: true,
    alerta_erro_bug: true,
    alerta_urgente_automatico: true
  });

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        // Fetch Health Score config
        const healthDocRef = doc(db, 'config', 'health_score');
        const healthDocSnap = await getDoc(healthDocRef);
        if (healthDocSnap.exists()) {
          const data = healthDocSnap.data();
          if (data.pesos) setPesos(data.pesos);
          if (data.thresholds) setThresholds(data.thresholds);
          if (data.parametros) setParametros(data.parametros);
        }

        // Fetch Alert config
        const alertDocRef = doc(db, 'config', 'alertas');
        const alertDocSnap = await getDoc(alertDocRef);
        if (alertDocSnap.exists()) {
          const data = alertDocSnap.data();
          setAlertaConfig(prev => ({ ...prev, ...data }));
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

  const testClickUp = async () => {
    setTestingClickUp(true);
    try {
      const response = await fetch('https://api.clickup.com/api/v2/team', {
        headers: {
          'Authorization': import.meta.env.VITE_CLICKUP_API_KEY || ''
        }
      });

      if (response.ok) {
        setClickUpStatus(prev => ({ ...prev, tested: true, testResult: 'success' }));
      } else {
        setClickUpStatus(prev => ({ ...prev, tested: true, testResult: 'error', error: `HTTP ${response.status}` }));
      }
    } catch (error) {
      setClickUpStatus(prev => ({ ...prev, tested: true, testResult: 'error', error: error.message }));
    } finally {
      setTestingClickUp(false);
    }
  };

  const testOpenAI = async () => {
    setTestingOpenAI(true);
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY || ''}`
        }
      });

      if (response.ok) {
        setOpenAIStatus(prev => ({ ...prev, tested: true, testResult: 'success' }));
      } else {
        setOpenAIStatus(prev => ({ ...prev, tested: true, testResult: 'error', error: `HTTP ${response.status}` }));
      }
    } catch (error) {
      setOpenAIStatus(prev => ({ ...prev, tested: true, testResult: 'error', error: error.message }));
    } finally {
      setTestingOpenAI(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      // Save Health Score config
      const healthDocRef = doc(db, 'config', 'health_score');
      await setDoc(healthDocRef, {
        pesos,
        thresholds,
        parametros,
        updated_at: new Date()
      });

      // Save Alert config
      const alertDocRef = doc(db, 'config', 'alertas');
      await setDoc(alertDocRef, {
        ...alertaConfig,
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

  const totalPesos = Object.values(pesos).reduce((sum, val) => sum + Number(val), 0);
  const pesosValidos = totalPesos === 100;

  const handlePesoChange = (field, value) => {
    setPesos(prev => ({ ...prev, [field]: Number(value) || 0 }));
  };

  const handleThresholdChange = (field, value) => {
    setThresholds(prev => ({ ...prev, [field]: Number(value) || 0 }));
  };

  const handleParametroChange = (field, value) => {
    setParametros(prev => ({ ...prev, [field]: Number(value) || 0 }));
  };

  const handleAlertaConfigChange = (field, value) => {
    setAlertaConfig(prev => ({ ...prev, [field]: value }));
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: 'white', margin: '0 0 8px 0' }}>Configurações</h1>
          <p style={{ color: '#94a3b8', margin: 0 }}>Configure os parâmetros do sistema</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !pesosValidos}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            background: pesosValidos ? 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)' : 'rgba(100, 116, 139, 0.3)',
            border: 'none',
            borderRadius: '12px',
            color: 'white',
            fontSize: '14px',
            fontWeight: '600',
            cursor: pesosValidos ? 'pointer' : 'not-allowed',
            opacity: saving ? 0.7 : 1,
            boxShadow: pesosValidos ? '0 4px 20px rgba(139, 92, 246, 0.3)' : 'none'
          }}
        >
          {saveSuccess ? <CheckCircle style={{ width: '18px', height: '18px' }} /> : <Save style={{ width: '18px', height: '18px' }} />}
          {saving ? 'Salvando...' : saveSuccess ? 'Salvo!' : 'Salvar Configurações'}
        </button>
      </div>

      {/* Links rápidos */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <button
          onClick={() => navigate('/configuracoes/usuarios')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 20px',
            background: 'rgba(30, 27, 75, 0.4)',
            border: '1px solid rgba(139, 92, 246, 0.15)',
            borderRadius: '12px',
            color: '#94a3b8',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          <Users style={{ width: '18px', height: '18px' }} />
          Gerenciar Usuários
          <ExternalLink style={{ width: '14px', height: '14px' }} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* COLUNA ESQUERDA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* SEÇÃO 1: Pesos do Health Score */}
          <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '20px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Sliders style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
                <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>Pesos do Health Score</h2>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                background: pesosValidos ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                border: `1px solid ${pesosValidos ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                borderRadius: '8px'
              }}>
                {pesosValidos ? (
                  <CheckCircle style={{ width: '16px', height: '16px', color: '#10b981' }} />
                ) : (
                  <AlertTriangle style={{ width: '16px', height: '16px', color: '#ef4444' }} />
                )}
                <span style={{ color: pesosValidos ? '#10b981' : '#ef4444', fontSize: '13px', fontWeight: '600' }}>
                  {totalPesos}%
                </span>
              </div>
            </div>

            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px' }}>
              Os pesos devem somar exatamente 100%
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { key: 'engajamento', label: 'Engajamento', desc: 'Frequência de interações' },
                { key: 'sentimento', label: 'Sentimento', desc: 'Tom das conversas' },
                { key: 'tickets', label: 'Tickets', desc: 'Volume de problemas' },
                { key: 'tempo_contato', label: 'Tempo de Contato', desc: 'Dias desde última interação' },
                { key: 'uso_escala', label: 'Uso em Escala', desc: 'Adoção de features' },
                { key: 'uso_ai', label: 'Uso de IA', desc: 'Utilização de recursos AI' }
              ].map(item => (
                <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.1)' }}>
                  <div>
                    <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: '0 0 2px 0' }}>{item.label}</p>
                    <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>{item.desc}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={pesos[item.key]}
                      onChange={(e) => handlePesoChange(item.key, e.target.value)}
                      style={{
                        width: '70px',
                        padding: '8px 12px',
                        background: '#0f0a1f',
                        border: '1px solid #3730a3',
                        borderRadius: '8px',
                        color: 'white',
                        fontSize: '14px',
                        textAlign: 'center',
                        outline: 'none'
                      }}
                    />
                    <span style={{ color: '#64748b', fontSize: '14px' }}>%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SEÇÃO 2: Thresholds de Status */}
          <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '20px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <Activity style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
              <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>Thresholds de Status</h2>
            </div>

            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px' }}>
              Defina os limites de pontuação para cada status
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { key: 'saudavel', label: 'Saudável', color: '#10b981', desc: 'Score mínimo' },
                { key: 'atencao', label: 'Atenção', color: '#f59e0b', desc: 'Score mínimo' },
                { key: 'risco', label: 'Risco', color: '#f97316', desc: 'Score mínimo' },
                { key: 'critico', label: 'Crítico', color: '#ef4444', desc: 'Abaixo de Risco' }
              ].map(item => (
                <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '12px', height: '12px', background: item.color, borderRadius: '50%' }}></div>
                    <div>
                      <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: 0 }}>{item.label}</p>
                      <p style={{ color: '#64748b', fontSize: '11px', margin: 0 }}>{item.desc}</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={thresholds[item.key]}
                      onChange={(e) => handleThresholdChange(item.key, e.target.value)}
                      disabled={item.key === 'critico'}
                      style={{
                        width: '70px',
                        padding: '8px 12px',
                        background: item.key === 'critico' ? 'rgba(100, 116, 139, 0.2)' : '#0f0a1f',
                        border: '1px solid #3730a3',
                        borderRadius: '8px',
                        color: item.key === 'critico' ? '#64748b' : 'white',
                        fontSize: '14px',
                        textAlign: 'center',
                        outline: 'none',
                        cursor: item.key === 'critico' ? 'not-allowed' : 'text'
                      }}
                    />
                    <span style={{ color: '#64748b', fontSize: '14px' }}>+</span>
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
              {/* Dias sem contato */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.1)' }}>
                <div>
                  <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: '0 0 2px 0' }}>Dias sem contato para alerta</p>
                  <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>Gerar alerta quando cliente não interagir</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    min="1"
                    value={alertaConfig.dias_sem_contato_para_alerta}
                    onChange={(e) => handleAlertaConfigChange('dias_sem_contato_para_alerta', Number(e.target.value))}
                    style={{
                      width: '70px',
                      padding: '8px 12px',
                      background: '#0f0a1f',
                      border: '1px solid #3730a3',
                      borderRadius: '8px',
                      color: 'white',
                      fontSize: '14px',
                      textAlign: 'center',
                      outline: 'none'
                    }}
                  />
                  <span style={{ color: '#64748b', fontSize: '14px' }}>dias</span>
                </div>
              </div>

              {/* Alerta para sentimento negativo */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.1)' }}>
                <div>
                  <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: '0 0 2px 0' }}>Alerta para sentimento negativo</p>
                  <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>Criar alerta quando thread tiver sentimento negativo</p>
                </div>
                <button
                  onClick={() => handleAlertaConfigChange('alerta_sentimento_negativo', !alertaConfig.alerta_sentimento_negativo)}
                  style={{
                    width: '48px',
                    height: '28px',
                    borderRadius: '14px',
                    background: alertaConfig.alerta_sentimento_negativo ? '#8b5cf6' : 'rgba(100, 116, 139, 0.3)',
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
                  onClick={() => handleAlertaConfigChange('alerta_erro_bug', !alertaConfig.alerta_erro_bug)}
                  style={{
                    width: '48px',
                    height: '28px',
                    borderRadius: '14px',
                    background: alertaConfig.alerta_erro_bug ? '#8b5cf6' : 'rgba(100, 116, 139, 0.3)',
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
                  onClick={() => handleAlertaConfigChange('alerta_urgente_automatico', !alertaConfig.alerta_urgente_automatico)}
                  style={{
                    width: '48px',
                    height: '28px',
                    borderRadius: '14px',
                    background: alertaConfig.alerta_urgente_automatico ? '#8b5cf6' : 'rgba(100, 116, 139, 0.3)',
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
                    left: alertaConfig.alerta_urgente_automatico ? '23px' : '3px',
                    transition: 'all 0.2s ease'
                  }}></div>
                </button>
              </div>
            </div>
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
                      style={{
                        width: '70px',
                        padding: '8px 12px',
                        background: '#0f0a1f',
                        border: '1px solid #3730a3',
                        borderRadius: '8px',
                        color: 'white',
                        fontSize: '14px',
                        textAlign: 'center',
                        outline: 'none'
                      }}
                    />
                    <span style={{ color: '#64748b', fontSize: '14px' }}>dias</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SEÇÃO 5: Integrações */}
          <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '20px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <Link2 style={{ width: '20px', height: '20px', color: '#06b6d4' }} />
              <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>Integrações</h2>
            </div>

            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px' }}>
              Status das integrações com serviços externos
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* ClickUp */}
              <div style={{ padding: '16px', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      background: clickUpStatus?.configured ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Zap style={{ width: '20px', height: '20px', color: clickUpStatus?.configured ? '#10b981' : '#ef4444' }} />
                    </div>
                    <div>
                      <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: '0 0 2px 0' }}>ClickUp</p>
                      <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>Gerenciamento de tarefas</p>
                    </div>
                  </div>
                  <span style={{
                    padding: '4px 12px',
                    background: clickUpStatus?.configured ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    color: clickUpStatus?.configured ? '#10b981' : '#ef4444',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}>
                    {clickUpStatus?.configured ? 'Conectado' : 'Desconectado'}
                  </span>
                </div>

                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
                  <p style={{ margin: '0 0 4px 0' }}>API Key: {clickUpStatus?.apiKey}</p>
                  <p style={{ margin: 0 }}>Team ID: {clickUpStatus?.teamId}</p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button
                    onClick={testClickUp}
                    disabled={testingClickUp || !clickUpStatus?.configured}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      background: clickUpStatus?.configured ? 'rgba(6, 182, 212, 0.2)' : 'rgba(100, 116, 139, 0.2)',
                      border: '1px solid rgba(6, 182, 212, 0.3)',
                      borderRadius: '8px',
                      color: clickUpStatus?.configured ? '#06b6d4' : '#64748b',
                      fontSize: '12px',
                      cursor: clickUpStatus?.configured ? 'pointer' : 'not-allowed'
                    }}
                  >
                    {testingClickUp ? (
                      <RefreshCw style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <RefreshCw style={{ width: '14px', height: '14px' }} />
                    )}
                    Testar Conexão
                  </button>

                  {clickUpStatus?.tested && (
                    <span style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                      color: clickUpStatus.testResult === 'success' ? '#10b981' : '#ef4444'
                    }}>
                      {clickUpStatus.testResult === 'success' ? (
                        <><CheckCircle style={{ width: '14px', height: '14px' }} /> Conexão OK</>
                      ) : (
                        <><XCircle style={{ width: '14px', height: '14px' }} /> {clickUpStatus.error}</>
                      )}
                    </span>
                  )}
                </div>
              </div>

              {/* OpenAI */}
              <div style={{ padding: '16px', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.1)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      background: openAIStatus?.configured ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Zap style={{ width: '20px', height: '20px', color: openAIStatus?.configured ? '#10b981' : '#ef4444' }} />
                    </div>
                    <div>
                      <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: '0 0 2px 0' }}>OpenAI</p>
                      <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>Classificação de threads com IA</p>
                    </div>
                  </div>
                  <span style={{
                    padding: '4px 12px',
                    background: openAIStatus?.configured ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    color: openAIStatus?.configured ? '#10b981' : '#ef4444',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '500'
                  }}>
                    {openAIStatus?.configured ? 'Conectado' : 'Desconectado'}
                  </span>
                </div>

                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
                  <p style={{ margin: 0 }}>API Key: {openAIStatus?.apiKey}</p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button
                    onClick={testOpenAI}
                    disabled={testingOpenAI || !openAIStatus?.configured}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      background: openAIStatus?.configured ? 'rgba(6, 182, 212, 0.2)' : 'rgba(100, 116, 139, 0.2)',
                      border: '1px solid rgba(6, 182, 212, 0.3)',
                      borderRadius: '8px',
                      color: openAIStatus?.configured ? '#06b6d4' : '#64748b',
                      fontSize: '12px',
                      cursor: openAIStatus?.configured ? 'pointer' : 'not-allowed'
                    }}
                  >
                    {testingOpenAI ? (
                      <RefreshCw style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <RefreshCw style={{ width: '14px', height: '14px' }} />
                    )}
                    Testar Conexão
                  </button>

                  {openAIStatus?.tested && (
                    <span style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                      color: openAIStatus.testResult === 'success' ? '#10b981' : '#ef4444'
                    }}>
                      {openAIStatus.testResult === 'success' ? (
                        <><CheckCircle style={{ width: '14px', height: '14px' }} /> Conexão OK</>
                      ) : (
                        <><XCircle style={{ width: '14px', height: '14px' }} /> {openAIStatus.error}</>
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
