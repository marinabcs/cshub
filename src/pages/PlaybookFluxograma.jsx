import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { ArrowDown, ArrowRight, ArrowLeft, Bug, TrendingUp, Heart, Eye, AlertTriangle, Clock, CheckCircle, Users, Phone, Mail, Calendar, FileText } from 'lucide-react';
import { SEGMENTOS_CS, DEFAULT_SAUDE_CONFIG } from '../utils/segmentoCS';

export default function PlaybookFluxograma() {
  const navigate = useNavigate();
  const [tabAtiva, setTabAtiva] = useState('classificacao');
  const [config, setConfig] = useState(DEFAULT_SAUDE_CONFIG);
  const [loading, setLoading] = useState(true);

  // Buscar config do Firestore
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const configSnap = await getDoc(doc(db, 'config', 'geral'));
        if (configSnap.exists() && configSnap.data().segmentoConfig) {
          setConfig({ ...DEFAULT_SAUDE_CONFIG, ...configSnap.data().segmentoConfig });
        }
      } catch (err) {
        console.error('Erro ao buscar config:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  // Helper para gerar texto de critérios
  const getCriterios = () => ({
    CRESCIMENTO: `${config.dias_ativos_crescimento}+ dias\nScore ${config.engajamento_crescimento}+`,
    ESTAVEL: `${config.dias_ativos_estavel}-${config.dias_ativos_crescimento - 1} dias\nScore ${config.engajamento_estavel}-${config.engajamento_crescimento - 1}`,
    ALERTA: `${config.dias_ativos_alerta}-${config.dias_ativos_estavel - 1} dias\nScore ${config.engajamento_alerta}-${config.engajamento_estavel - 1}`,
    RESGATE: `0-${config.dias_ativos_alerta - 1} dias\nScore 0-${config.engajamento_alerta - 1}`,
  });

  const criterios = getCriterios();

  const tabs = [
    { id: 'classificacao', label: 'Classificacao' },
    { id: 'niveis', label: 'Os 4 Niveis' },
    { id: 'transicoes', label: 'Transicoes' },
    { id: 'regras', label: 'Regras Gerais' },
  ];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', paddingTop: '24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <button
          onClick={() => navigate('/ongoing')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', background: 'rgba(100, 116, 139, 0.2)',
            border: '1px solid rgba(100, 116, 139, 0.3)', borderRadius: '8px',
            color: '#94a3b8', fontSize: '13px', fontWeight: '500', cursor: 'pointer',
            marginBottom: '16px'
          }}
        >
          <ArrowLeft style={{ width: '14px', height: '14px' }} />
          Voltar para Ongoing
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ color: 'white', fontSize: '28px', fontWeight: '700', margin: 0 }}>
            Playbook de Ongoing
          </h1>
          {!loading && (
            <span style={{
              padding: '4px 10px', background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '6px',
              color: '#10b981', fontSize: '11px', fontWeight: '600'
            }}>
              Valores sincronizados
            </span>
          )}
        </div>
        <p style={{ color: '#94a3b8', fontSize: '15px', margin: '8px 0 0 0' }}>
          V1 — Basico Bem Feito — Fevereiro 2026
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid rgba(139, 92, 246, 0.15)', paddingBottom: '12px' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setTabAtiva(tab.id)}
            style={{
              padding: '10px 20px',
              background: tabAtiva === tab.id ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
              border: tabAtiva === tab.id ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid transparent',
              borderRadius: '10px',
              color: tabAtiva === tab.id ? '#a78bfa' : '#64748b',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Classificacao */}
      {tabAtiva === 'classificacao' && (
        <div>
          <h2 style={{ color: 'white', fontSize: '20px', fontWeight: '600', marginBottom: '24px' }}>
            Fluxo de Classificacao
          </h2>

          {/* Fluxograma Visual */}
          <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '20px', padding: '32px' }}>

            {/* Passo 1: Recalculo */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ padding: '16px 32px', background: 'rgba(139, 92, 246, 0.2)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '12px', textAlign: 'center' }}>
                <span style={{ color: '#a78bfa', fontSize: '16px', fontWeight: '600' }}>RECALCULO DE SAUDE</span>
                <p style={{ color: '#94a3b8', fontSize: '13px', margin: '4px 0 0' }}>Automatico — CS Hub verifica</p>
              </div>
              <ArrowDown style={{ width: '24px', height: '24px', color: '#64748b', margin: '12px 0' }} />
            </div>

            {/* Passo 2: Bugs */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ padding: '16px 32px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', textAlign: 'center' }}>
                <Bug style={{ width: '20px', height: '20px', color: '#ef4444', marginBottom: '4px' }} />
                <span style={{ color: '#ef4444', fontSize: '16px', fontWeight: '600', display: 'block' }}>QUANTOS BUGS ABERTOS?</span>
              </div>
              <ArrowDown style={{ width: '24px', height: '24px', color: '#64748b', margin: '12px 0' }} />
            </div>

            {/* Opcoes de Bugs */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginBottom: '32px' }}>
              <div style={{ padding: '16px 20px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '12px', textAlign: 'center', minWidth: '140px' }}>
                <span style={{ color: '#ef4444', fontSize: '20px', fontWeight: '700' }}>2+ BUGS</span>
                <p style={{ color: '#fca5a5', fontSize: '13px', margin: '8px 0 0' }}>RESGATE<br/>(imediato)</p>
              </div>
              <div style={{ padding: '16px 20px', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '12px', textAlign: 'center', minWidth: '140px' }}>
                <span style={{ color: '#f59e0b', fontSize: '20px', fontWeight: '700' }}>1 BUG</span>
                <p style={{ color: '#fcd34d', fontSize: '13px', margin: '8px 0 0' }}>ALERTA<br/>(sobrepoe)</p>
              </div>
              <div style={{ padding: '16px 20px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '12px', textAlign: 'center', minWidth: '140px' }}>
                <span style={{ color: '#10b981', fontSize: '20px', fontWeight: '700' }}>0 BUGS</span>
                <p style={{ color: '#6ee7b7', fontSize: '13px', margin: '8px 0 0' }}>Classificar<br/>por metricas</p>
              </div>
            </div>

            {/* Passo 3: Metricas */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
              <ArrowDown style={{ width: '24px', height: '24px', color: '#64748b', marginBottom: '12px' }} />
              <div style={{ padding: '16px 32px', background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.3)', borderRadius: '12px', textAlign: 'center' }}>
                <span style={{ color: '#06b6d4', fontSize: '16px', fontWeight: '600' }}>DIAS ATIVOS + SCORE</span>
              </div>
              <ArrowDown style={{ width: '24px', height: '24px', color: '#64748b', margin: '12px 0' }} />
            </div>

            {/* Os 4 Niveis */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
              {[
                { seg: 'CRESCIMENTO', criterio: criterios.CRESCIMENTO, icon: TrendingUp },
                { seg: 'ESTAVEL', criterio: criterios.ESTAVEL, icon: Heart },
                { seg: 'ALERTA', criterio: criterios.ALERTA, icon: Eye },
                { seg: 'RESGATE', criterio: criterios.RESGATE, icon: AlertTriangle },
              ].map(({ seg, criterio, icon: Icon }) => (
                <div key={seg} style={{
                  padding: '20px',
                  background: SEGMENTOS_CS[seg].bgColor,
                  border: `1px solid ${SEGMENTOS_CS[seg].borderColor}`,
                  borderRadius: '12px',
                  textAlign: 'center',
                  minWidth: '150px'
                }}>
                  <Icon style={{ width: '24px', height: '24px', color: SEGMENTOS_CS[seg].color, marginBottom: '8px' }} />
                  <span style={{ color: SEGMENTOS_CS[seg].color, fontSize: '14px', fontWeight: '700', display: 'block' }}>
                    {SEGMENTOS_CS[seg].label}
                  </span>
                  <p style={{ color: '#94a3b8', fontSize: '12px', margin: '8px 0 0', whiteSpace: 'pre-line' }}>{criterio}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Regra Fundamental */}
          <div style={{ marginTop: '24px', padding: '20px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '16px' }}>
            <p style={{ color: '#fca5a5', fontSize: '15px', fontWeight: '600', margin: 0 }}>
              <Bug style={{ width: '18px', height: '18px', display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} />
              Regra fundamental: Bugs sobrepoem TUDO. Nao importa quao ativo o cliente esteja — se tem 2+ bugs abertos, e Resgate.
            </p>
          </div>
        </div>
      )}

      {/* Tab: Os 4 Niveis */}
      {tabAtiva === 'niveis' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* CRESCIMENTO */}
          <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '20px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <TrendingUp style={{ width: '28px', height: '28px', color: '#10b981' }} />
              <h3 style={{ color: '#10b981', fontSize: '20px', fontWeight: '700', margin: 0 }}>CRESCIMENTO</h3>
              <span style={{ padding: '4px 12px', background: 'rgba(16, 185, 129, 0.2)', borderRadius: '20px', fontSize: '12px', color: '#6ee7b7' }}>Mensal</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div><span style={{ color: '#64748b', fontSize: '12px' }}>Criterios:</span><p style={{ color: '#e2e8f0', fontSize: '14px', margin: '4px 0 0' }}>{config.dias_ativos_crescimento}+ dias ativos, score {config.engajamento_crescimento}+, 0 bugs</p></div>
              <div><span style={{ color: '#64748b', fontSize: '12px' }}>Objetivo:</span><p style={{ color: '#e2e8f0', fontSize: '14px', margin: '4px 0 0' }}>Celebrar, coletar cases e expandir</p></div>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '12px' }}>Ganchos mensais:</span>
              <ul style={{ color: '#94a3b8', fontSize: '14px', margin: '8px 0 0', paddingLeft: '20px' }}>
                <li>Reconhecimento + pedido de case</li>
                <li>Case de sucesso do segmento (inspirar e gerar competitividade)</li>
                <li>Expansao estrategica (creditos, modulos nao usados, pico chegando)</li>
                <li>Sinalizar oportunidades para o Time de Vendas</li>
              </ul>
            </div>
          </div>

          {/* ESTAVEL */}
          <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '20px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <Heart style={{ width: '28px', height: '28px', color: '#3b82f6' }} />
              <h3 style={{ color: '#3b82f6', fontSize: '20px', fontWeight: '700', margin: 0 }}>ESTAVEL</h3>
              <span style={{ padding: '4px 12px', background: 'rgba(59, 130, 246, 0.2)', borderRadius: '20px', fontSize: '12px', color: '#93c5fd' }}>Mensal</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div><span style={{ color: '#64748b', fontSize: '12px' }}>Criterios:</span><p style={{ color: '#e2e8f0', fontSize: '14px', margin: '4px 0 0' }}>{config.dias_ativos_estavel}-{config.dias_ativos_crescimento - 1} dias ativos, score {config.engajamento_estavel}-{config.engajamento_crescimento - 1}, 0 bugs</p></div>
              <div><span style={{ color: '#64748b', fontSize: '12px' }}>Objetivo:</span><p style={{ color: '#e2e8f0', fontSize: '14px', margin: '4px 0 0' }}>Nutrir relacionamento e mapear sazonalidade</p></div>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '12px' }}>Ganchos mensais:</span>
              <ul style={{ color: '#94a3b8', fontSize: '14px', margin: '8px 0 0', paddingLeft: '20px' }}>
                <li>Data do mercado do cliente ou novidade da Trakto/IA</li>
                <li>Mapeamento de sazonalidade e calendario de campanhas</li>
              </ul>
              <p style={{ color: '#64748b', fontSize: '13px', fontStyle: 'italic', marginTop: '8px' }}>
                Prioridade: Se ainda NAO temos o calendario do cliente → priorizar mapeamento.
              </p>
            </div>
          </div>

          {/* ALERTA */}
          <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '20px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <Eye style={{ width: '28px', height: '28px', color: '#f59e0b' }} />
              <h3 style={{ color: '#f59e0b', fontSize: '20px', fontWeight: '700', margin: 0 }}>ALERTA</h3>
              <span style={{ padding: '4px 12px', background: 'rgba(245, 158, 11, 0.2)', borderRadius: '20px', fontSize: '12px', color: '#fcd34d' }}>21 dias</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div><span style={{ color: '#64748b', fontSize: '12px' }}>Criterios:</span><p style={{ color: '#e2e8f0', fontSize: '14px', margin: '4px 0 0' }}>1 bug OU {config.dias_ativos_alerta}-{config.dias_ativos_estavel - 1} dias ativos, score {config.engajamento_alerta}-{config.engajamento_estavel - 1}</p></div>
              <div><span style={{ color: '#64748b', fontSize: '12px' }}>Objetivo:</span><p style={{ color: '#e2e8f0', fontSize: '14px', margin: '4px 0 0' }}>Intervir antes de piorar para Resgate</p></div>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '12px' }}>Timeline (21 dias):</span>
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                {[
                  { dia: 'D0-1', acao: 'Comunicacao rapida', icone: Mail },
                  { dia: 'D1-7', acao: 'Carencia interna', icone: Clock },
                  { dia: 'D7', acao: 'Resolveu?', icone: CheckCircle },
                  { dia: 'D7-8', acao: 'E-mail aprofundado', icone: Mail },
                  { dia: 'D8-14', acao: 'Call diagnostico', icone: Phone },
                  { dia: 'D14-21', acao: 'Verificar metricas', icone: FileText },
                  { dia: 'D21+', acao: 'RESGATE', icone: AlertTriangle },
                ].map(({ dia, acao, icone: Icone }) => (
                  <div key={dia} style={{ padding: '8px 12px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '8px', textAlign: 'center' }}>
                    <Icone style={{ width: '14px', height: '14px', color: '#f59e0b', marginBottom: '2px' }} />
                    <p style={{ color: '#fcd34d', fontSize: '11px', fontWeight: '700', margin: 0 }}>{dia}</p>
                    <p style={{ color: '#94a3b8', fontSize: '10px', margin: 0 }}>{acao}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RESGATE */}
          <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '20px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <AlertTriangle style={{ width: '28px', height: '28px', color: '#ef4444' }} />
              <h3 style={{ color: '#ef4444', fontSize: '20px', fontWeight: '700', margin: 0 }}>RESGATE</h3>
              <span style={{ padding: '4px 12px', background: 'rgba(239, 68, 68, 0.2)', borderRadius: '20px', fontSize: '12px', color: '#fca5a5' }}>15-30 dias</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div><span style={{ color: '#64748b', fontSize: '12px' }}>Criterios:</span><p style={{ color: '#e2e8f0', fontSize: '14px', margin: '4px 0 0' }}>2+ bugs OU 0-{config.dias_ativos_alerta - 1} dias ativos, score 0-{config.engajamento_alerta - 1}</p></div>
              <div><span style={{ color: '#64748b', fontSize: '12px' }}>Objetivo:</span><p style={{ color: '#e2e8f0', fontSize: '14px', margin: '4px 0 0' }}>Recuperar antes do churn</p></div>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '12px' }}>Timeline (15-30 dias):</span>
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                {[
                  { dia: 'D0', acao: 'Alerta IMEDIATO', icone: AlertTriangle },
                  { dia: 'D0-1', acao: 'Revisar perfil', icone: FileText },
                  { dia: 'D1-2', acao: 'E-mail diagnostico', icone: Mail },
                  { dia: 'D2-3', acao: 'Acionar Vendas', icone: Users },
                  { dia: 'D3-5', acao: 'Call 30min', icone: Phone },
                  { dia: 'D5-7', acao: 'Criar roadmap', icone: Calendar },
                  { dia: 'D7+', acao: 'Acompanhamento semanal', icone: Clock },
                ].map(({ dia, acao, icone: Icone }) => (
                  <div key={dia} style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', textAlign: 'center' }}>
                    <Icone style={{ width: '14px', height: '14px', color: '#ef4444', marginBottom: '2px' }} />
                    <p style={{ color: '#fca5a5', fontSize: '11px', fontWeight: '700', margin: 0 }}>{dia}</p>
                    <p style={{ color: '#94a3b8', fontSize: '10px', margin: 0 }}>{acao}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Transicoes */}
      {tabAtiva === 'transicoes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Transicoes que DESCEM */}
          <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '20px', padding: '24px' }}>
            <h3 style={{ color: '#ef4444', fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
              <ArrowDown style={{ width: '20px', height: '20px', display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} />
              Transicoes que DESCEM (pioram)
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '12px', borderBottom: '1px solid rgba(100, 116, 139, 0.2)', color: '#94a3b8', fontSize: '12px', fontWeight: '600' }}>Transicao</th>
                  <th style={{ textAlign: 'left', padding: '12px', borderBottom: '1px solid rgba(100, 116, 139, 0.2)', color: '#94a3b8', fontSize: '12px', fontWeight: '600' }}>Urgencia</th>
                  <th style={{ textAlign: 'left', padding: '12px', borderBottom: '1px solid rgba(100, 116, 139, 0.2)', color: '#94a3b8', fontSize: '12px', fontWeight: '600' }}>Acao</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { de: 'Crescimento', para: 'Alerta', urgencia: '7 dias carencia', acao: 'Comunicacao rapida dia 0-1. Bug pontual.' },
                  { de: 'Crescimento', para: 'Resgate', urgencia: 'IMEDIATO', acao: 'Transicao mais critica. Vendas no mesmo dia.', critico: true },
                  { de: 'Estavel', para: 'Alerta', urgencia: '7 dias carencia', acao: 'Comunicacao rapida dia 0-1. Fluxo normal de Alerta.' },
                  { de: 'Estavel', para: 'Resgate', urgencia: 'IMEDIATO', acao: 'Abandono gradual ou problema acumulado.', critico: true },
                  { de: 'Alerta', para: 'Resgate', urgencia: 'IMEDIATO', acao: 'Problema nao resolvido ou segundo bug. Escalar.', critico: true },
                ].map((row, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: '12px', borderBottom: '1px solid rgba(100, 116, 139, 0.1)', color: '#e2e8f0', fontSize: '13px' }}>
                      {row.de} → {row.para}
                    </td>
                    <td style={{ padding: '12px', borderBottom: '1px solid rgba(100, 116, 139, 0.1)' }}>
                      <span style={{ padding: '4px 10px', background: row.critico ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)', color: row.critico ? '#ef4444' : '#f59e0b', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>
                        {row.urgencia}
                      </span>
                    </td>
                    <td style={{ padding: '12px', borderBottom: '1px solid rgba(100, 116, 139, 0.1)', color: '#94a3b8', fontSize: '13px' }}>{row.acao}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Transicoes que SOBEM */}
          <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '20px', padding: '24px' }}>
            <h3 style={{ color: '#10b981', fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
              <TrendingUp style={{ width: '20px', height: '20px', display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} />
              Transicoes que SOBEM (melhoram)
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '12px', borderBottom: '1px solid rgba(100, 116, 139, 0.2)', color: '#94a3b8', fontSize: '12px', fontWeight: '600' }}>Transicao</th>
                  <th style={{ textAlign: 'left', padding: '12px', borderBottom: '1px solid rgba(100, 116, 139, 0.2)', color: '#94a3b8', fontSize: '12px', fontWeight: '600' }}>Quando</th>
                  <th style={{ textAlign: 'left', padding: '12px', borderBottom: '1px solid rgba(100, 116, 139, 0.2)', color: '#94a3b8', fontSize: '12px', fontWeight: '600' }}>Acao</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { de: 'Resgate', para: 'qualquer', quando: 'Fim do roadmap', acao: 'So sai ao completar roadmap com metricas sustentadas.' },
                  { de: 'Alerta', para: 'Estavel', quando: 'Proximo ciclo', acao: 'Registrar causa e resolucao. Aprendizado para o time.' },
                  { de: 'Alerta', para: 'Crescimento', quando: 'Proximo ciclo', acao: 'Nenhuma acao especial. Seguir playbook Crescimento.' },
                  { de: 'Estavel', para: 'Crescimento', quando: 'Proximo ciclo', acao: 'Entrar com playbook Crescimento (reconhecimento + expansao).' },
                ].map((row, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: '12px', borderBottom: '1px solid rgba(100, 116, 139, 0.1)', color: '#e2e8f0', fontSize: '13px' }}>
                      {row.de} → {row.para}
                    </td>
                    <td style={{ padding: '12px', borderBottom: '1px solid rgba(100, 116, 139, 0.1)' }}>
                      <span style={{ padding: '4px 10px', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', borderRadius: '6px', fontSize: '11px', fontWeight: '600' }}>
                        {row.quando}
                      </span>
                    </td>
                    <td style={{ padding: '12px', borderBottom: '1px solid rgba(100, 116, 139, 0.1)', color: '#94a3b8', fontSize: '13px' }}>{row.acao}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Regras Gerais */}
      {tabAtiva === 'regras' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Regra de Bugs */}
          <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '20px', padding: '24px' }}>
            <h3 style={{ color: '#ef4444', fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
              <Bug style={{ width: '20px', height: '20px', display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} />
              Regra de Bugs
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '16px' }}>
              Bugs sobrepoem TODAS as outras metricas. Nao importa quao ativo o cliente esteja.
            </p>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ flex: 1, padding: '16px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px', textAlign: 'center' }}>
                <span style={{ color: '#10b981', fontSize: '24px', fontWeight: '700' }}>0 bugs</span>
                <p style={{ color: '#6ee7b7', fontSize: '13px', margin: '4px 0 0' }}>Classificar por regra normal</p>
              </div>
              <div style={{ flex: 1, padding: '16px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '12px', textAlign: 'center' }}>
                <span style={{ color: '#f59e0b', fontSize: '24px', fontWeight: '700' }}>1 bug</span>
                <p style={{ color: '#fcd34d', fontSize: '13px', margin: '4px 0 0' }}>ALERTA (independente)</p>
              </div>
              <div style={{ flex: 1, padding: '16px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '12px', textAlign: 'center' }}>
                <span style={{ color: '#ef4444', fontSize: '24px', fontWeight: '700' }}>2+ bugs</span>
                <p style={{ color: '#fca5a5', fontSize: '13px', margin: '4px 0 0' }}>RESGATE (independente)</p>
              </div>
            </div>
          </div>

          {/* Regra de Carencia */}
          <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '20px', padding: '24px' }}>
            <h3 style={{ color: '#f59e0b', fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
              <Clock style={{ width: '20px', height: '20px', display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} />
              Regra de Carencia — 7 Dias Corridos
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '16px' }}>
              Quando o cliente cai de nivel, a comunicacao com o cliente e imediata. A carencia e interna — para decidir se aciona o playbook completo.
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '12px', borderBottom: '1px solid rgba(100, 116, 139, 0.2)', color: '#94a3b8', fontSize: '12px' }}>Momento</th>
                  <th style={{ textAlign: 'left', padding: '12px', borderBottom: '1px solid rgba(100, 116, 139, 0.2)', color: '#94a3b8', fontSize: '12px' }}>O que acontece</th>
                  <th style={{ textAlign: 'left', padding: '12px', borderBottom: '1px solid rgba(100, 116, 139, 0.2)', color: '#94a3b8', fontSize: '12px' }}>Cliente percebe?</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '12px', borderBottom: '1px solid rgba(100, 116, 139, 0.1)', color: '#e2e8f0', fontSize: '13px' }}>Dia 0-1</td>
                  <td style={{ padding: '12px', borderBottom: '1px solid rgba(100, 116, 139, 0.1)', color: '#94a3b8', fontSize: '13px' }}>Comunicacao rapida: "estamos atentos"</td>
                  <td style={{ padding: '12px', borderBottom: '1px solid rgba(100, 116, 139, 0.1)', color: '#10b981', fontSize: '13px' }}>Sim</td>
                </tr>
                <tr>
                  <td style={{ padding: '12px', borderBottom: '1px solid rgba(100, 116, 139, 0.1)', color: '#e2e8f0', fontSize: '13px' }}>Dia 1-7</td>
                  <td style={{ padding: '12px', borderBottom: '1px solid rgba(100, 116, 139, 0.1)', color: '#94a3b8', fontSize: '13px' }}>Carencia interna — monitoramento</td>
                  <td style={{ padding: '12px', borderBottom: '1px solid rgba(100, 116, 139, 0.1)', color: '#ef4444', fontSize: '13px' }}>Nao</td>
                </tr>
                <tr>
                  <td style={{ padding: '12px', borderBottom: '1px solid rgba(100, 116, 139, 0.1)', color: '#e2e8f0', fontSize: '13px' }}>Dia 7-8</td>
                  <td style={{ padding: '12px', borderBottom: '1px solid rgba(100, 116, 139, 0.1)', color: '#94a3b8', fontSize: '13px' }}>Playbook completo (se necessario)</td>
                  <td style={{ padding: '12px', borderBottom: '1px solid rgba(100, 116, 139, 0.1)', color: '#10b981', fontSize: '13px' }}>Sim</td>
                </tr>
              </tbody>
            </table>
            <p style={{ color: '#fcd34d', fontSize: '13px', fontStyle: 'italic', marginTop: '12px' }}>
              Excecao: queda para RESGATE = acao imediata, sem carencia.
            </p>
          </div>

          {/* Criterio de Saida do Resgate */}
          <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '20px', padding: '24px' }}>
            <h3 style={{ color: '#10b981', fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
              <CheckCircle style={{ width: '20px', height: '20px', display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} />
              Criterio de Saida do Resgate
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '16px' }}>
              O cliente so e reclassificado quando completar o roadmap E atingir os criterios minimos:
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              {[
                { criterio: 'Dias ativos no mes', valor: `≥ ${config.saida_resgate_dias_ativos}` },
                { criterio: 'Score de engajamento', valor: `≥ ${config.saida_resgate_engajamento}` },
                { criterio: 'Bugs/reclamacoes', valor: config.saida_resgate_bugs_zero ? '0' : 'Qualquer' },
                { criterio: 'Sustentacao', valor: 'Ate fim do roadmap' },
              ].map(({ criterio, valor }) => (
                <div key={criterio} style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '10px', textAlign: 'center' }}>
                  <span style={{ color: '#10b981', fontSize: '18px', fontWeight: '700' }}>{valor}</span>
                  <p style={{ color: '#94a3b8', fontSize: '11px', margin: '4px 0 0' }}>{criterio}</p>
                </div>
              ))}
            </div>
            <p style={{ color: '#6ee7b7', fontSize: '13px', marginTop: '12px' }}>
              O cliente pode ir direto para Estavel ou Crescimento se as metricas justificarem.
            </p>
          </div>

          {/* Ciclos dos Playbooks */}
          <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '20px', padding: '24px' }}>
            <h3 style={{ color: '#a78bfa', fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
              <Calendar style={{ width: '20px', height: '20px', display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} />
              Ciclos dos Playbooks
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '12px', borderBottom: '1px solid rgba(100, 116, 139, 0.2)', color: '#94a3b8', fontSize: '12px' }}>Nivel</th>
                  <th style={{ textAlign: 'left', padding: '12px', borderBottom: '1px solid rgba(100, 116, 139, 0.2)', color: '#94a3b8', fontSize: '12px' }}>Tipo</th>
                  <th style={{ textAlign: 'left', padding: '12px', borderBottom: '1px solid rgba(100, 116, 139, 0.2)', color: '#94a3b8', fontSize: '12px' }}>Duracao</th>
                  <th style={{ textAlign: 'left', padding: '12px', borderBottom: '1px solid rgba(100, 116, 139, 0.2)', color: '#94a3b8', fontSize: '12px' }}>Repeticao</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { nivel: 'Crescimento', tipo: 'Mensal', duracao: '30 dias', rep: 'Continuo', cor: '#10b981' },
                  { nivel: 'Estavel', tipo: 'Mensal', duracao: '30 dias', rep: 'Continuo', cor: '#3b82f6' },
                  { nivel: 'Alerta', tipo: 'Playbook com carencia', duracao: '21 dias', rep: 'Se nao melhorou → Resgate', cor: '#f59e0b' },
                  { nivel: 'Resgate', tipo: 'Roadmap de recuperacao', duracao: '15 ou 30 dias', rep: 'Renovavel', cor: '#ef4444' },
                ].map(({ nivel, tipo, duracao, rep, cor }) => (
                  <tr key={nivel}>
                    <td style={{ padding: '12px', borderBottom: '1px solid rgba(100, 116, 139, 0.1)', color: cor, fontSize: '13px', fontWeight: '600' }}>{nivel}</td>
                    <td style={{ padding: '12px', borderBottom: '1px solid rgba(100, 116, 139, 0.1)', color: '#e2e8f0', fontSize: '13px' }}>{tipo}</td>
                    <td style={{ padding: '12px', borderBottom: '1px solid rgba(100, 116, 139, 0.1)', color: '#94a3b8', fontSize: '13px' }}>{duracao}</td>
                    <td style={{ padding: '12px', borderBottom: '1px solid rgba(100, 116, 139, 0.1)', color: '#94a3b8', fontSize: '13px' }}>{rep}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: '32px', padding: '16px', textAlign: 'center', color: '#475569', fontSize: '13px' }}>
        Playbook de Ongoing — Customer Success — Trakto | V1 — Basico Bem Feito — Fevereiro 2026
      </div>
    </div>
  );
}
