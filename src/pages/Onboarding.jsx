/**
 * Onboarding v1.0 - Estrutura Simplificada
 *
 * 4 reuniões fixas com cadência de 7 dias:
 * - Kick off: Apresentação da plataforma
 * - Escala: Variáveis e geração em escala
 * - AI: IA Imagem, Diretor e Vídeo
 * - Motion: Animação e exportação
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { REUNIOES_V1, REUNIOES_ORDEM, gerarCronograma, calcularDuracaoTotal } from '../constants/onboardingV1';
import { criarPlanoOnboardingV1, buscarPlanoAtivo } from '../services/onboarding';
import {
  GraduationCap, ChevronRight, Calendar, CheckCircle, Clock,
  Users as UsersIcon, Video, Sparkles, Zap, Play
} from 'lucide-react';

// Ícones por reunião
const REUNIAO_ICONS = {
  kickoff: Play,
  escala: Zap,
  ai: Sparkles,
  motion: Video
};

export default function Onboarding() {
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

  // Configuração do plano
  const [dataInicio, setDataInicio] = useState(formatDateInput(new Date()));
  const [observacoes, setObservacoes] = useState('');
  const [cronograma, setCronograma] = useState([]);

  // Carregar clientes
  useEffect(() => {
    async function loadClientes() {
      setLoading(true);
      try {
        const ref = collection(db, 'clientes');
        const snapshot = await getDocs(ref);
        const lista = snapshot.docs.map(d => ({
          id: d.id,
          nome: d.data().nome || d.data().team_name || d.id,
          status: d.data().status
        }));
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

  // Gerar cronograma quando data de início muda
  useEffect(() => {
    if (dataInicio) {
      setCronograma(gerarCronograma(dataInicio));
    }
  }, [dataInicio]);

  function formatDateInput(date) {
    return date.toISOString().split('T')[0];
  }

  function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit'
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

  async function handleCriarPlano() {
    setSaving(true);
    try {
      await criarPlanoOnboardingV1(clienteId, dataInicio, user, observacoes);
      setStep(3);
    } catch (error) {
      console.error('Erro ao criar plano:', error);
    }
    setSaving(false);
  }

  const clientesFiltrados = busca
    ? clientes.filter(c => c.nome.toLowerCase().includes(busca.toLowerCase()))
    : clientes;

  const duracao = calcularDuracaoTotal();

  return (
    <div style={{ padding: '32px', maxWidth: '900px', margin: '0 auto' }}>
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
            Onboarding
          </h1>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '14px' }}>
            {clienteNome ? `Cliente: ${clienteNome}` : '4 reuniões, 7 dias entre cada'}
          </p>
        </div>
      </div>

      {/* Steps indicator */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
        {['Selecionar Cliente', 'Configurar', 'Confirmação'].map((label, i) => (
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
                  <ChevronRight size={16} color="#64748b" />
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Step 2: Configurar */}
      {step === 2 && (
        <div>
          {/* Resumo do Onboarding */}
          <div style={{
            background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)',
            borderRadius: '16px', padding: '24px', marginBottom: '24px'
          }}>
            <h3 style={{ color: 'white', fontSize: '16px', margin: '0 0 16px 0' }}>Estrutura do Onboarding</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <div style={{
                background: 'rgba(139, 92, 246, 0.1)', borderRadius: '12px', padding: '16px', textAlign: 'center'
              }}>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#8b5cf6' }}>{duracao.totalReunioes}</div>
                <div style={{ color: '#94a3b8', fontSize: '13px' }}>Reuniões</div>
              </div>
              <div style={{
                background: 'rgba(6, 182, 212, 0.1)', borderRadius: '12px', padding: '16px', textAlign: 'center'
              }}>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#06b6d4' }}>{duracao.totalMinutos}</div>
                <div style={{ color: '#94a3b8', fontSize: '13px' }}>Minutos total</div>
              </div>
              <div style={{
                background: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px', padding: '16px', textAlign: 'center'
              }}>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#10b981' }}>{duracao.semanas}</div>
                <div style={{ color: '#94a3b8', fontSize: '13px' }}>Semanas</div>
              </div>
            </div>
          </div>

          {/* Cards das Reuniões */}
          <div style={{
            background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)',
            borderRadius: '16px', padding: '24px', marginBottom: '24px'
          }}>
            <h3 style={{ color: 'white', fontSize: '16px', margin: '0 0 16px 0' }}>Reuniões</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {cronograma.map((reuniao, idx) => {
                const Icon = REUNIAO_ICONS[reuniao.id] || Calendar;
                const cores = [
                  { bg: 'rgba(139, 92, 246, 0.15)', border: 'rgba(139, 92, 246, 0.3)', text: '#8b5cf6' },
                  { bg: 'rgba(6, 182, 212, 0.15)', border: 'rgba(6, 182, 212, 0.3)', text: '#06b6d4' },
                  { bg: 'rgba(249, 115, 22, 0.15)', border: 'rgba(249, 115, 22, 0.3)', text: '#f97316' },
                  { bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.3)', text: '#10b981' }
                ];
                const cor = cores[idx % cores.length];

                return (
                  <div key={reuniao.id} style={{
                    background: cor.bg, border: `1px solid ${cor.border}`,
                    borderRadius: '12px', padding: '16px',
                    display: 'flex', alignItems: 'center', gap: '16px'
                  }}>
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '12px',
                      background: cor.bg, border: `1px solid ${cor.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <Icon size={20} color={cor.text} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{
                          background: cor.bg, border: `1px solid ${cor.border}`,
                          padding: '2px 8px', borderRadius: '6px',
                          color: cor.text, fontSize: '11px', fontWeight: '600'
                        }}>
                          {reuniao.numero}
                        </span>
                        <span style={{ color: 'white', fontWeight: '600', fontSize: '14px' }}>
                          {reuniao.nome}
                        </span>
                      </div>
                      <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>
                        {reuniao.descricao}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: 'white', fontSize: '13px', fontWeight: '500' }}>
                        {formatDate(reuniao.data_sugerida)}
                      </div>
                      <div style={{ color: '#64748b', fontSize: '12px' }}>
                        {reuniao.duracao} min
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Data de início */}
          <div style={{
            background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)',
            borderRadius: '16px', padding: '24px', marginBottom: '24px'
          }}>
            <div style={{ display: 'flex', gap: '24px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '8px' }}>
                  Data da primeira reunião (Kick off)
                </label>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={e => setDataInicio(e.target.value)}
                  style={{
                    width: '100%', padding: '12px 16px', background: '#0f0a1f',
                    border: '1px solid #3730a3', borderRadius: '12px', color: 'white',
                    outline: 'none', boxSizing: 'border-box'
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '8px' }}>
                  Observações (opcional)
                </label>
                <input
                  type="text"
                  value={observacoes}
                  onChange={e => setObservacoes(e.target.value)}
                  placeholder="Ex: Cliente prefere manhãs"
                  style={{
                    width: '100%', padding: '12px 16px', background: '#0f0a1f',
                    border: '1px solid #3730a3', borderRadius: '12px', color: 'white',
                    outline: 'none', boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Botões */}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button
              onClick={() => { setStep(1); setClienteId(''); setClienteNome(''); }}
              style={{
                padding: '12px 24px', background: 'rgba(30, 27, 75, 0.4)',
                border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '12px',
                color: 'white', cursor: 'pointer'
              }}
            >
              Voltar
            </button>
            <button
              onClick={handleCriarPlano}
              disabled={saving}
              style={{
                padding: '12px 24px',
                background: saving ? '#3730a3' : 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                border: 'none', borderRadius: '12px', color: 'white',
                fontWeight: '600', cursor: saving ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px',
                opacity: saving ? 0.7 : 1
              }}
            >
              <CheckCircle size={16} />
              {saving ? 'Criando...' : 'Criar Plano de Onboarding'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Confirmação */}
      {step === 3 && (
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
          <h2 style={{ color: 'white', fontSize: '20px', marginBottom: '8px' }}>
            Plano Criado com Sucesso
          </h2>
          <p style={{ color: '#94a3b8', marginBottom: '8px' }}>
            O onboarding de <strong style={{ color: 'white' }}>{clienteNome}</strong> foi criado.
          </p>
          <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px' }}>
            {duracao.totalReunioes} reuniões • Início em {new Date(dataInicio).toLocaleDateString('pt-BR')}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={() => navigate('/onboarding')}
              style={{
                padding: '12px 24px', background: 'rgba(30, 27, 75, 0.4)',
                border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '12px',
                color: 'white', cursor: 'pointer'
              }}
            >
              Novo Onboarding
            </button>
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
        </div>
      )}

      {/* Link para versão avançada */}
      <div style={{
        marginTop: '32px', padding: '16px', background: 'rgba(30, 27, 75, 0.3)',
        borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>
            Precisa de um onboarding personalizado?
          </p>
        </div>
        <button
          onClick={() => navigate('/onboarding/calculadora')}
          style={{
            padding: '8px 16px', background: 'transparent',
            border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '8px',
            color: '#8b5cf6', fontSize: '13px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}
        >
          Calculadora Avançada (v2)
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
