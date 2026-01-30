// Configurações do Sistema
import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import {
  Save, CheckCircle, AlertTriangle, Sliders, Activity, Clock,
  Bell, Link2, Zap, RefreshCw, XCircle, Play, Heart
} from 'lucide-react';
import { calcularTodosHealthScores } from '../services/healthScoreJob';

export default function Configuracoes() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Estado para status de integrações
  const [clickUpStatus, setClickUpStatus] = useState(null);
  const [openAIStatus, setOpenAIStatus] = useState(null);

  // Estado para cálculo de Health Score
  const [calculandoHealth, setCalculandoHealth] = useState(false);
  const [healthProgress, setHealthProgress] = useState({ current: 0, total: 0, cliente: '', status: '' });
  const [healthResults, setHealthResults] = useState(null);

  // Pesos do Health Score (5 componentes conforme documentação)
  const [pesos, setPesos] = useState({
    engajamento: 25,
    sentimento: 25,
    tickets: 20,
    tempo_contato: 15,
    uso_plataforma: 15
  });

  // Valores padrão para restaurar
  const PESOS_PADRAO = {
    engajamento: 25,
    sentimento: 25,
    tickets: 20,
    tempo_contato: 15,
    uso_plataforma: 15
  };

  const THRESHOLDS_PADRAO = {
    saudavel: 80,
    atencao: 60,
    risco: 40,
    critico: 0
  };

  const PARAMETROS_PADRAO = {
    dias_sem_contato_alerta: 7,
    dias_sem_contato_critico: 14,
    dias_periodo_analise: 30
  };

  // Última execução do Health Score
  const [ultimaExecucao, setUltimaExecucao] = useState(null);

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

  // Configurações de alertas (sem dias - unificado em parâmetros)
  const [alertaConfig, setAlertaConfig] = useState({
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
          if (data.pesos) {
            // Migrar de 6 para 5 componentes se necessário
            const pesosCarregados = data.pesos;
            if (pesosCarregados.uso_escala !== undefined || pesosCarregados.uso_ai !== undefined) {
              // Formato antigo - migrar para novo
              setPesos({
                engajamento: pesosCarregados.engajamento || 25,
                sentimento: pesosCarregados.sentimento || 25,
                tickets: pesosCarregados.tickets || 20,
                tempo_contato: pesosCarregados.tempo_contato || 15,
                uso_plataforma: (pesosCarregados.uso_escala || 0) + (pesosCarregados.uso_ai || 0) || 15
              });
            } else if (pesosCarregados.uso_plataforma !== undefined) {
              // Formato novo
              setPesos(pesosCarregados);
            } else {
              // Usar padrões
              setPesos(PESOS_PADRAO);
            }
          }
          if (data.thresholds) setThresholds(data.thresholds);
          if (data.parametros) setParametros(data.parametros);
          if (data.ultima_execucao) setUltimaExecucao(data.ultima_execucao.toDate ? data.ultima_execucao.toDate() : new Date(data.ultima_execucao));
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

  const runHealthScoreCalculation = async () => {
    setCalculandoHealth(true);
    setHealthResults(null);
    setHealthProgress({ current: 0, total: 0, cliente: '', status: '' });

    try {
      const results = await calcularTodosHealthScores((current, total, cliente, status) => {
        setHealthProgress({ current, total, cliente, status });
      });
      setHealthResults(results);

      // Salvar timestamp da última execução
      const agora = new Date();
      setUltimaExecucao(agora);
      const healthDocRef = doc(db, 'config', 'health_score');
      await setDoc(healthDocRef, { ultima_execucao: agora }, { merge: true });
    } catch (error) {
      console.error('Erro ao calcular health scores:', error);
      setHealthResults({ erro: error.message });
    } finally {
      setCalculandoHealth(false);
    }
  };

  // Restaurar valores padrão
  const restaurarPadroes = () => {
    setPesos(PESOS_PADRAO);
    setThresholds(THRESHOLDS_PADRAO);
    setParametros(PARAMETROS_PADRAO);
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
      </div>

      {/* Job de Health Score */}
      <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '20px', padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Heart style={{ width: '22px', height: '22px', color: 'white' }} />
            </div>
            <div>
              <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: '0 0 4px 0' }}>Cálculo de Health Score</h2>
              <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
                Executado automaticamente após sincronização (7h30 e 13h30)
                {ultimaExecucao && (
                  <span style={{ color: '#10b981', marginLeft: '8px' }}>
                    • Última execução: {ultimaExecucao.toLocaleDateString('pt-BR')} às {ultimaExecucao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={runHealthScoreCalculation}
            disabled={calculandoHealth}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              background: calculandoHealth ? 'rgba(16, 185, 129, 0.3)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              cursor: calculandoHealth ? 'not-allowed' : 'pointer'
            }}
          >
            {calculandoHealth ? (
              <RefreshCw style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} />
            ) : (
              <Play style={{ width: '18px', height: '18px' }} />
            )}
            {calculandoHealth ? 'Calculando...' : 'Executar Agora'}
          </button>
        </div>

        {/* Progress */}
        {calculandoHealth && healthProgress.total > 0 && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#94a3b8', fontSize: '13px' }}>
                Processando: {healthProgress.cliente}
              </span>
              <span style={{ color: '#10b981', fontSize: '13px', fontWeight: '600' }}>
                {healthProgress.current} / {healthProgress.total}
              </span>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'rgba(16, 185, 129, 0.2)', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${(healthProgress.current / healthProgress.total) * 100}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                  borderRadius: '4px',
                  transition: 'width 0.3s ease'
                }}
              />
            </div>
          </div>
        )}

        {/* Results */}
        {healthResults && !healthResults.erro && (
          <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <CheckCircle style={{ width: '18px', height: '18px', color: '#10b981' }} />
              <span style={{ color: 'white', fontSize: '14px', fontWeight: '600' }}>Cálculo concluído!</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '8px' }}>
                <p style={{ color: '#8b5cf6', fontSize: '20px', fontWeight: '700', margin: '0 0 4px 0' }}>{healthResults.total}</p>
                <p style={{ color: '#64748b', fontSize: '11px', margin: 0 }}>Total</p>
              </div>
              <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px' }}>
                <p style={{ color: '#10b981', fontSize: '20px', fontWeight: '700', margin: '0 0 4px 0' }}>{healthResults.calculados}</p>
                <p style={{ color: '#64748b', fontSize: '11px', margin: 0 }}>Calculados</p>
              </div>
              <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(100, 116, 139, 0.1)', borderRadius: '8px' }}>
                <p style={{ color: '#64748b', fontSize: '20px', fontWeight: '700', margin: '0 0 4px 0' }}>{healthResults.pulados}</p>
                <p style={{ color: '#64748b', fontSize: '11px', margin: 0 }}>Pulados</p>
              </div>
              <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px' }}>
                <p style={{ color: '#ef4444', fontSize: '20px', fontWeight: '700', margin: '0 0 4px 0' }}>{healthResults.erros}</p>
                <p style={{ color: '#64748b', fontSize: '11px', margin: 0 }}>Erros</p>
              </div>
            </div>
          </div>
        )}

        {healthResults?.erro && (
          <div style={{ marginTop: '16px', padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <XCircle style={{ width: '18px', height: '18px', color: '#ef4444' }} />
            <span style={{ color: '#ef4444', fontSize: '14px' }}>Erro: {healthResults.erro}</span>
          </div>
        )}
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
                { key: 'tickets', label: 'Tickets Abertos', desc: 'Volume de problemas' },
                { key: 'tempo_contato', label: 'Tempo sem Contato', desc: 'Dias desde última interação' },
                { key: 'uso_plataforma', label: 'Uso da Plataforma', desc: 'Adoção de features e recursos' }
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

            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '16px' }}>
              Defina os limites de pontuação para cada status
            </p>

            {/* Preview Visual */}
            <div style={{ marginBottom: '20px', padding: '16px', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '12px' }}>
              <div style={{ display: 'flex', height: '32px', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{
                  width: `${100 - thresholds.saudavel}%`,
                  background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <span style={{ color: 'white', fontSize: '11px', fontWeight: '600' }}>{thresholds.saudavel}+</span>
                </div>
                <div style={{
                  width: `${thresholds.saudavel - thresholds.atencao}%`,
                  background: 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <span style={{ color: 'white', fontSize: '11px', fontWeight: '600' }}>{thresholds.atencao}-{thresholds.saudavel - 1}</span>
                </div>
                <div style={{
                  width: `${thresholds.atencao - thresholds.risco}%`,
                  background: 'linear-gradient(90deg, #f97316 0%, #ea580c 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <span style={{ color: 'white', fontSize: '11px', fontWeight: '600' }}>{thresholds.risco}-{thresholds.atencao - 1}</span>
                </div>
                <div style={{
                  width: `${thresholds.risco}%`,
                  background: 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <span style={{ color: 'white', fontSize: '11px', fontWeight: '600' }}>0-{thresholds.risco - 1}</span>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                <span style={{ color: '#ef4444', fontSize: '10px' }}>Crítico</span>
                <span style={{ color: '#f97316', fontSize: '10px' }}>Risco</span>
                <span style={{ color: '#f59e0b', fontSize: '10px' }}>Atenção</span>
                <span style={{ color: '#10b981', fontSize: '10px' }}>Saudável</span>
              </div>
            </div>

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
                    <p style={{ color: '#64748b', fontSize: '11px', margin: 0 }}>Tarefas (em breve)</p>
                  </div>
                </div>
                <span style={{
                  padding: '4px 10px',
                  background: 'rgba(100, 116, 139, 0.2)',
                  color: '#64748b',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: '500'
                }}>
                  V2
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
