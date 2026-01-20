import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Settings, Save, CheckCircle, AlertTriangle, Sliders, Activity, Clock } from 'lucide-react';

export default function Configuracoes() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [pesos, setPesos] = useState({
    engajamento: 20,
    sentimento: 20,
    tickets: 15,
    tempo_contato: 15,
    uso_escala: 15,
    uso_ai: 15
  });

  const [thresholds, setThresholds] = useState({
    saudavel: 80,
    atencao: 60,
    risco: 40,
    critico: 0
  });

  const [parametros, setParametros] = useState({
    dias_sem_contato_alerta: 7,
    dias_sem_contato_critico: 14,
    dias_periodo_analise: 30
  });

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const docRef = doc(db, 'config', 'health_score');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.pesos) setPesos(data.pesos);
          if (data.thresholds) setThresholds(data.thresholds);
          if (data.parametros) setParametros(data.parametros);
        }
      } catch (error) {
        console.error('Erro ao carregar configurações:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const docRef = doc(db, 'config', 'health_score');
      await setDoc(docRef, {
        pesos,
        thresholds,
        parametros,
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
          <p style={{ color: '#94a3b8', margin: 0 }}>Configure os parâmetros do Health Score</p>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Pesos do Health Score */}
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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

        {/* Thresholds e Parâmetros */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Thresholds de Status */}
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

          {/* Parâmetros de Análise */}
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
        </div>
      </div>
    </div>
  );
}
