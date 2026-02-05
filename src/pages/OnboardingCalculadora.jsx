import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { MODULOS, MODULOS_ORDEM, PERGUNTAS, PLANO_STATUS, getRespostasIniciais } from '../constants/onboarding';
import { classifyModules, buildSessions, scheduleSessions } from '../utils/onboardingCalculator';
import { criarPlanoOnboarding, buscarPlanoAtivo } from '../services/onboarding';
import { validateForm, onboardingRespostasSchema } from '../validation';
import { ErrorMessage } from '../components/UI/ErrorMessage';
import {
  GraduationCap, ChevronRight, ChevronLeft, Lock, ArrowUpDown,
  CheckCircle, Monitor, Users as UsersIcon, Calendar, Sparkles, X
} from 'lucide-react';

export default function OnboardingCalculadora() {
  const { clienteId: paramClienteId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState(paramClienteId ? 2 : 1);
  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState(paramClienteId || '');
  const [clienteNome, setClienteNome] = useState('');
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Questionario
  const [respostas, setRespostas] = useState(getRespostasIniciais());
  const [formErrors, setFormErrors] = useState({});

  // Resultado
  const [classificacao, setClassificacao] = useState(null);
  const [sessoes, setSessoes] = useState([]);
  const [dataInicio, setDataInicio] = useState(formatDateInput(new Date()));

  // Ajuste modal
  const [ajusteModal, setAjusteModal] = useState(null);
  const [ajusteJustificativa, setAjusteJustificativa] = useState('');

  // Carregar clientes
  useEffect(() => {
    async function loadClientes() {
      setLoading(true);
      try {
        const ref = collection(db, 'clientes');
        const snapshot = await getDocs(ref);
        const lista = snapshot.docs.map(d => ({ id: d.id, nome: d.data().nome || d.data().team_name || d.id, status: d.data().status }));
        lista.sort((a, b) => a.nome.localeCompare(b.nome));
        setClientes(lista);

        if (paramClienteId) {
          const c = lista.find(c => c.id === paramClienteId);
          if (c) setClienteNome(c.nome);
        }
      } catch {
        // silenciar
      }
      setLoading(false);
    }
    loadClientes();
  }, [paramClienteId]);

  function formatDateInput(date) {
    return date.toISOString().split('T')[0];
  }

  function handleResposta(campo, valor) {
    setRespostas(prev => ({ ...prev, [campo]: valor }));
    setFormErrors(prev => {
      const next = { ...prev };
      delete next[campo];
      return next;
    });
  }

  function handleMultiselect(campo, valor) {
    setRespostas(prev => {
      const arr = prev[campo] || [];
      if (arr.includes(valor)) {
        return { ...prev, [campo]: arr.filter(v => v !== valor) };
      }
      return { ...prev, [campo]: [...arr, valor] };
    });
  }

  async function handleSelectCliente(c) {
    setClienteId(c.id);
    setClienteNome(c.nome);
    setBusca('');

    // Verificar se já tem plano ativo
    const planoAtivo = await buscarPlanoAtivo(c.id);
    if (planoAtivo) {
      navigate(`/clientes/${c.id}`);
      return;
    }

    setStep(2);
  }

  function handleCalcular() {
    const errors = validateForm(onboardingRespostasSchema, respostas);
    if (errors) {
      setFormErrors(errors);
      return;
    }

    const result = classifyModules(respostas);
    setClassificacao(result);

    const sessoesBruto = buildSessions(result);
    const sessoesAgendadas = scheduleSessions(sessoesBruto, dataInicio, respostas.urgencia);
    setSessoes(sessoesAgendadas);

    setStep(3);
  }

  function handleToggleModulo(moduloId) {
    if (MODULOS[moduloId].locked) return;
    const modoAtual = classificacao[moduloId];
    setAjusteModal({ moduloId, modoAtual, novoModo: modoAtual === 'ao_vivo' ? 'online' : 'ao_vivo' });
    setAjusteJustificativa('');
  }

  function confirmarAjuste() {
    if (ajusteJustificativa.length < 10) return;

    const novaClassificacao = { ...classificacao, [ajusteModal.moduloId]: ajusteModal.novoModo };
    setClassificacao(novaClassificacao);

    const sessoesBruto = buildSessions(novaClassificacao);
    const sessoesAgendadas = scheduleSessions(sessoesBruto, dataInicio, respostas.urgencia);
    setSessoes(sessoesAgendadas);

    setAjusteModal(null);
  }

  async function handleCriarPlano() {
    setSaving(true);
    try {
      await criarPlanoOnboarding(clienteId, respostas, dataInicio, user);
      setStep(4);
    } catch {
      // erro ja logado no service
    }
    setSaving(false);
  }

  function recalcularSessoes() {
    if (!classificacao) return;
    const sessoesBruto = buildSessions(classificacao);
    const sessoesAgendadas = scheduleSessions(sessoesBruto, dataInicio, respostas.urgencia);
    setSessoes(sessoesAgendadas);
  }

  // ============================================
  // RENDER
  // ============================================

  const clientesFiltrados = busca
    ? clientes.filter(c => c.nome.toLowerCase().includes(busca.toLowerCase()))
    : clientes;

  const totalAoVivo = classificacao ? MODULOS_ORDEM.filter(id => classificacao[id] === 'ao_vivo').length : 0;
  const totalOnline = classificacao ? MODULOS_ORDEM.filter(id => classificacao[id] === 'online').length : 0;

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
        <div style={{
          width: '48px', height: '48px', borderRadius: '16px',
          background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <GraduationCap size={24} color="white" />
        </div>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'white', margin: 0 }}>
            Calculadora de Onboarding
          </h1>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '14px' }}>
            {clienteNome ? `Cliente: ${clienteNome}` : 'Monte o plano personalizado de onboarding'}
          </p>
        </div>
      </div>

      {/* Steps indicator */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
        {['Selecionar Cliente', 'Questionário', 'Resultado', 'Confirmação'].map((label, i) => (
          <div key={i} style={{
            flex: 1, padding: '12px', borderRadius: '12px', textAlign: 'center',
            background: step === i + 1 ? 'rgba(139, 92, 246, 0.2)' : 'rgba(30, 27, 75, 0.4)',
            border: `1px solid ${step === i + 1 ? 'rgba(139, 92, 246, 0.5)' : 'rgba(139, 92, 246, 0.15)'}`,
            color: step > i ? '#8b5cf6' : step === i + 1 ? 'white' : '#64748b',
            fontSize: '13px', fontWeight: step === i + 1 ? '600' : '400'
          }}>
            {step > i + 1 ? '✓ ' : ''}{label}
          </div>
        ))}
      </div>

      {/* Step 1: Selecionar Cliente */}
      {step === 1 && (
        <div style={{
          background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)',
          borderRadius: '16px', padding: '32px'
        }}>
          <h2 style={{ fontSize: '18px', color: 'white', marginBottom: '16px' }}>Selecionar Cliente</h2>
          <input
            type="text"
            placeholder="Buscar cliente..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{
              width: '100%', padding: '12px 16px', background: '#0f0a1f',
              border: '1px solid #3730a3', borderRadius: '12px', color: 'white',
              outline: 'none', marginBottom: '16px', boxSizing: 'border-box'
            }}
          />
          <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {loading ? (
              <p style={{ color: '#94a3b8', textAlign: 'center', padding: '20px' }}>Carregando...</p>
            ) : clientesFiltrados.length === 0 ? (
              <p style={{ color: '#94a3b8', textAlign: 'center', padding: '20px' }}>Nenhum cliente encontrado</p>
            ) : (
              clientesFiltrados.map(c => (
                <button
                  key={c.id}
                  onClick={() => handleSelectCliente(c)}
                  style={{
                    width: '100%', padding: '12px 16px', background: '#0f0a1f',
                    border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '12px',
                    color: 'white', cursor: 'pointer', textAlign: 'left',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}
                >
                  <span>{c.nome}</span>
                  <span style={{
                    fontSize: '12px', padding: '2px 8px', borderRadius: '8px',
                    background: 'rgba(16, 185, 129, 0.2)',
                    color: '#10b981'
                  }}>{c.status === 'onboarding' ? 'ativo' : (c.status || 'ativo')}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Step 2: Questionário */}
      {step === 2 && (
        <div>
          {renderQuestionario()}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
            <button
              onClick={() => { setStep(1); setClienteId(''); setClienteNome(''); }}
              style={{
                padding: '12px 24px', background: 'rgba(30, 27, 75, 0.4)',
                border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '12px',
                color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
              }}
            >
              <ChevronLeft size={16} /> Voltar
            </button>
            <button
              onClick={handleCalcular}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                border: 'none', borderRadius: '12px', color: 'white',
                fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
              }}
            >
              <Sparkles size={16} /> Calcular Plano
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Resultado */}
      {step === 3 && classificacao && (
        <div>
          {/* Resumo */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px'
          }}>
            <div style={{
              background: 'rgba(139, 92, 246, 0.15)', border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '16px', padding: '20px', textAlign: 'center'
            }}>
              <div style={{ fontSize: '32px', fontWeight: '700', color: '#8b5cf6' }}>{totalAoVivo}</div>
              <div style={{ color: '#94a3b8', fontSize: '14px' }}>Módulos Ao Vivo</div>
            </div>
            <div style={{
              background: 'rgba(6, 182, 212, 0.15)', border: '1px solid rgba(6, 182, 212, 0.3)',
              borderRadius: '16px', padding: '20px', textAlign: 'center'
            }}>
              <div style={{ fontSize: '32px', fontWeight: '700', color: '#06b6d4' }}>{totalOnline}</div>
              <div style={{ color: '#94a3b8', fontSize: '14px' }}>Módulos Online</div>
            </div>
            <div style={{
              background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '16px', padding: '20px', textAlign: 'center'
            }}>
              <div style={{ fontSize: '32px', fontWeight: '700', color: '#10b981' }}>{sessoes.length}</div>
              <div style={{ color: '#94a3b8', fontSize: '14px' }}>Sessões Ao Vivo</div>
            </div>
          </div>

          {/* Grid de módulos */}
          <h3 style={{ color: 'white', fontSize: '16px', marginBottom: '16px' }}>Módulos</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            {MODULOS_ORDEM.map(id => {
              const modulo = MODULOS[id];
              const modo = classificacao[id];
              const isAoVivo = modo === 'ao_vivo';

              return (
                <div key={id} style={{
                  background: isAoVivo ? 'rgba(139, 92, 246, 0.1)' : 'rgba(6, 182, 212, 0.1)',
                  border: `1px solid ${isAoVivo ? 'rgba(139, 92, 246, 0.3)' : 'rgba(6, 182, 212, 0.3)'}`,
                  borderRadius: '12px', padding: '16px',
                  display: 'flex', flexDirection: 'column', gap: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#64748b', fontSize: '12px', fontWeight: '700' }}>{id}</span>
                      <span style={{ color: 'white', fontWeight: '600', fontSize: '14px' }}>{modulo.nome}</span>
                    </div>
                    {modulo.locked ? (
                      <Lock size={14} color="#f59e0b" />
                    ) : (
                      <button
                        onClick={() => handleToggleModulo(id)}
                        title="Alterar modo"
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: '4px'
                        }}
                      >
                        <ArrowUpDown size={14} color="#94a3b8" />
                      </button>
                    )}
                  </div>
                  <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>{modulo.descricao}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: '600',
                      background: isAoVivo ? 'rgba(139, 92, 246, 0.2)' : 'rgba(6, 182, 212, 0.2)',
                      color: isAoVivo ? '#8b5cf6' : '#06b6d4'
                    }}>
                      {isAoVivo ? 'Ao Vivo' : 'Online'}
                    </span>
                    <span style={{ color: '#64748b', fontSize: '12px' }}>
                      {isAoVivo ? `${modulo.tempoAoVivo} min` : `${modulo.tempoOnline} min`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sessões */}
          <h3 style={{ color: 'white', fontSize: '16px', marginBottom: '16px' }}>Sessões Planejadas</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            {sessoes.map(s => (
              <div key={s.numero} style={{
                background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)',
                borderRadius: '12px', padding: '16px',
                display: 'flex', alignItems: 'center', gap: '16px'
              }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '12px',
                  background: 'rgba(139, 92, 246, 0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#8b5cf6', fontWeight: '700', fontSize: '16px'
                }}>{s.numero}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: 'white', fontWeight: '600', fontSize: '14px' }}>
                    {s.modulos.map(m => MODULOS[m].nome).join(' + ')}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '4px' }}>
                    {s.duracao} min • {s.data_sugerida ? new Date(s.data_sugerida).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }) : ''}
                  </div>
                </div>
                <Calendar size={16} color="#64748b" />
              </div>
            ))}
          </div>

          {/* Data de início */}
          <div style={{
            background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)',
            borderRadius: '16px', padding: '20px', marginBottom: '24px'
          }}>
            <label style={{ color: '#94a3b8', fontSize: '14px', display: 'block', marginBottom: '8px' }}>
              Data de início
            </label>
            <input
              type="date"
              value={dataInicio}
              onChange={e => { setDataInicio(e.target.value); }}
              onBlur={recalcularSessoes}
              style={{
                padding: '10px 16px', background: '#0f0a1f', border: '1px solid #3730a3',
                borderRadius: '12px', color: 'white', outline: 'none'
              }}
            />
          </div>

          {/* Botões */}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button
              onClick={() => setStep(2)}
              style={{
                padding: '12px 24px', background: 'rgba(30, 27, 75, 0.4)',
                border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '12px',
                color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
              }}
            >
              <ChevronLeft size={16} /> Voltar ao Questionário
            </button>
            <button
              onClick={handleCriarPlano}
              disabled={saving}
              style={{
                padding: '12px 24px',
                background: saving ? '#3730a3' : 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                border: 'none', borderRadius: '12px', color: 'white',
                fontWeight: '600', cursor: saving ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px', opacity: saving ? 0.7 : 1
              }}
            >
              <CheckCircle size={16} /> {saving ? 'Salvando...' : 'Criar Plano de Onboarding'}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Confirmação */}
      {step === 4 && (
        <div style={{
          background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '16px', padding: '48px', textAlign: 'center'
        }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: 'rgba(16, 185, 129, 0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px'
          }}>
            <CheckCircle size={32} color="#10b981" />
          </div>
          <h2 style={{ color: 'white', fontSize: '20px', marginBottom: '8px' }}>Plano Criado com Sucesso</h2>
          <p style={{ color: '#94a3b8', marginBottom: '24px' }}>
            O plano de onboarding de <strong style={{ color: 'white' }}>{clienteNome}</strong> foi criado com {sessoes.length} sessões ao vivo.
          </p>
          <button
            onClick={() => navigate(`/clientes/${clienteId}`)}
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
              border: 'none', borderRadius: '12px', color: 'white',
              fontWeight: '600', cursor: 'pointer'
            }}
          >
            Ver Ficha do Cliente
          </button>
        </div>
      )}

      {/* Modal de Ajuste */}
      {ajusteModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }} onClick={() => setAjusteModal(null)}>
          <div style={{
            background: '#1e1b4b', border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '16px', padding: '24px', width: '420px', maxWidth: '90vw'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ color: 'white', margin: 0, fontSize: '16px' }}>Ajustar Módulo</h3>
              <button onClick={() => setAjusteModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} color="#94a3b8" />
              </button>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '16px' }}>
              Mover <strong style={{ color: 'white' }}>{MODULOS[ajusteModal.moduloId].nome}</strong> de{' '}
              <span style={{ color: ajusteModal.modoAtual === 'ao_vivo' ? '#8b5cf6' : '#06b6d4' }}>
                {ajusteModal.modoAtual === 'ao_vivo' ? 'Ao Vivo' : 'Online'}
              </span> para{' '}
              <span style={{ color: ajusteModal.novoModo === 'ao_vivo' ? '#8b5cf6' : '#06b6d4' }}>
                {ajusteModal.novoModo === 'ao_vivo' ? 'Ao Vivo' : 'Online'}
              </span>
            </p>
            <textarea
              placeholder="Justificativa (mín. 10 caracteres)"
              value={ajusteJustificativa}
              onChange={e => setAjusteJustificativa(e.target.value)}
              rows={3}
              style={{
                width: '100%', padding: '12px', background: '#0f0a1f',
                border: '1px solid #3730a3', borderRadius: '12px', color: 'white',
                outline: 'none', resize: 'none', boxSizing: 'border-box', marginBottom: '16px'
              }}
            />
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setAjusteModal(null)}
                style={{
                  padding: '10px 20px', background: 'rgba(30, 27, 75, 0.4)',
                  border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '12px',
                  color: 'white', cursor: 'pointer'
                }}
              >Cancelar</button>
              <button
                onClick={confirmarAjuste}
                disabled={ajusteJustificativa.length < 10}
                style={{
                  padding: '10px 20px',
                  background: ajusteJustificativa.length >= 10 ? 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)' : '#3730a3',
                  border: 'none', borderRadius: '12px', color: 'white',
                  fontWeight: '600', cursor: ajusteJustificativa.length >= 10 ? 'pointer' : 'default',
                  opacity: ajusteJustificativa.length >= 10 ? 1 : 0.5
                }}
              >Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ============================================
  // RENDER: QUESTIONÁRIO
  // ============================================

  function renderQuestionario() {
    // Agrupar perguntas em seções de 5
    const secoes = [];
    for (let i = 0; i < PERGUNTAS.length; i += 5) {
      secoes.push(PERGUNTAS.slice(i, i + 5));
    }

    const secaoLabels = ['Equipe e Produção', 'IA, Publicação e Planejamento'];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {secoes.map((secao, si) => (
          <div key={si} style={{
            background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)',
            borderRadius: '16px', padding: '24px'
          }}>
            <h3 style={{ color: '#8b5cf6', fontSize: '14px', fontWeight: '600', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {secaoLabels[si] || `Seção ${si + 1}`}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {secao.map(pergunta => (
                <div key={pergunta.id}>
                  <label style={{ color: 'white', fontSize: '14px', display: 'block', marginBottom: '8px' }}>
                    {pergunta.texto}
                  </label>

                  {pergunta.tipo === 'select' && (
                    <select
                      value={respostas[pergunta.campo] || ''}
                      onChange={e => handleResposta(pergunta.campo, e.target.value)}
                      style={{
                        width: '100%', padding: '10px 16px', background: '#0f0a1f',
                        border: `1px solid ${formErrors[pergunta.campo] ? '#ef4444' : '#3730a3'}`,
                        borderRadius: '12px', color: 'white', outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    >
                      <option value="">Selecione...</option>
                      {pergunta.opcoes.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  )}

                  {pergunta.tipo === 'multiselect' && (
                    <div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {pergunta.opcoes.map(o => {
                          const selected = (respostas[pergunta.campo] || []).includes(o.value);
                          return (
                            <button
                              key={o.value}
                              type="button"
                              onClick={() => handleMultiselect(pergunta.campo, o.value)}
                              style={{
                                padding: '8px 16px', borderRadius: '10px',
                                background: selected ? 'rgba(139, 92, 246, 0.2)' : '#0f0a1f',
                                border: `1px solid ${selected ? '#8b5cf6' : '#3730a3'}`,
                                color: selected ? '#8b5cf6' : '#94a3b8',
                                cursor: 'pointer', fontSize: '13px', fontWeight: selected ? '600' : '400'
                              }}
                            >{o.label}</button>
                          );
                        })}
                      </div>
                      {pergunta.campoOutro && (respostas[pergunta.campo] || []).includes('outro') && (
                        <input
                          type="text"
                          placeholder="Especifique..."
                          value={respostas[pergunta.campoOutro] || ''}
                          onChange={e => handleResposta(pergunta.campoOutro, e.target.value)}
                          style={{
                            width: '100%', padding: '10px 16px', background: '#0f0a1f',
                            border: '1px solid #3730a3', borderRadius: '12px', color: 'white',
                            outline: 'none', boxSizing: 'border-box', marginTop: '10px'
                          }}
                        />
                      )}
                    </div>
                  )}

                  {pergunta.tipo === 'text' && (
                    <textarea
                      value={respostas[pergunta.campo] || ''}
                      onChange={e => handleResposta(pergunta.campo, e.target.value)}
                      rows={2}
                      placeholder="Digite aqui..."
                      style={{
                        width: '100%', padding: '10px 16px', background: '#0f0a1f',
                        border: '1px solid #3730a3', borderRadius: '12px', color: 'white',
                        outline: 'none', resize: 'none', boxSizing: 'border-box'
                      }}
                    />
                  )}

                  {formErrors[pergunta.campo] && (
                    <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', marginBottom: 0 }}>
                      {formErrors[pergunta.campo]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }
}
