import { useState, useEffect } from 'react';
import { ClipboardList, Check, Clock, ChevronDown, ChevronUp, Play, X, SkipForward, MessageSquare, Calendar, Loader2, AlertTriangle, Timer, ArrowDown, TrendingUp, DollarSign, Pencil, Trash2 } from 'lucide-react';
import { buscarCiclosCliente, atualizarAcao, cancelarCiclo, ONGOING_STATUS, ACAO_STATUS, CADENCIA_OPTIONS, atribuirCiclo } from '../../services/ongoing';
import { getSegmentoInfo, SEGMENTOS_CS, DEFAULT_ONGOING_ACOES } from '../../utils/segmentoCS';
import { useAuth } from '../../contexts/AuthContext';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';

// Calcular dias restantes da carência
const calcularDiasRestantes = (dataFim) => {
  if (!dataFim) return 0;
  const fim = dataFim.toDate ? dataFim.toDate() : new Date(dataFim);
  const agora = new Date();
  const diffMs = fim.getTime() - agora.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
};

// Tipos de oportunidade de vendas
const TIPOS_OPORTUNIDADE = [
  { value: 'upsell', label: 'Upsell', color: '#10b981', description: 'Upgrade de plano ou mais licenças' },
  { value: 'cross_sell', label: 'Cross-sell', color: '#8b5cf6', description: 'Venda de produto/serviço adicional' },
  { value: 'renovacao', label: 'Renovação Antecipada', color: '#06b6d4', description: 'Renovação antes do vencimento' },
  { value: 'expansao', label: 'Expansão', color: '#f59e0b', description: 'Expansão para outros departamentos/times' },
];

export default function OngoingSection({ clienteId, segmentoAtual, cliente }) {
  const { user } = useAuth();
  const [ciclos, setCiclos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCiclo, setExpandedCiclo] = useState(null);
  const [atualizandoAcao, setAtualizandoAcao] = useState(null);
  const [observacoesTemp, setObservacoesTemp] = useState({});
  const [showHistorico, setShowHistorico] = useState(false);

  // Modal novo ciclo
  const [showModal, setShowModal] = useState(false);
  const [modalSegmento, setModalSegmento] = useState('');
  const [modalCadencia, setModalCadencia] = useState('mensal');
  const [modalDataInicio, setModalDataInicio] = useState(new Date().toISOString().split('T')[0]);
  const [modalAcoes, setModalAcoes] = useState([]);
  const [modalNovaAcao, setModalNovaAcao] = useState('');
  const [atribuindo, setAtribuindo] = useState(false);
  const [ongoingConfig, setOngoingConfig] = useState(null);

  // Oportunidade de vendas
  const [showOportunidadeForm, setShowOportunidadeForm] = useState(false);
  const [oportunidadeForm, setOportunidadeForm] = useState({ tipo: 'upsell', valor_estimado: '', notas: '' });
  const [salvandoOportunidade, setSalvandoOportunidade] = useState(false);
  const [clienteLocal, setClienteLocal] = useState(cliente);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ciclosData, configSnap] = await Promise.all([
          buscarCiclosCliente(clienteId),
          getDoc(doc(db, 'config', 'ongoing'))
        ]);
        setCiclos(ciclosData);

        const config = configSnap.exists() ? configSnap.data() : DEFAULT_ONGOING_ACOES;
        setOngoingConfig(config);

        // Expandir ciclo ativo automaticamente
        const ativo = ciclosData.find(c => c.status === 'em_andamento');
        if (ativo) setExpandedCiclo(ativo.id);
      } catch (error) {
        console.error('Erro ao buscar ciclos:', error);
      } finally {
        setLoading(false);
      }
    };

    if (clienteId) fetchData();
  }, [clienteId]);

  // Sincronizar clienteLocal com prop cliente
  useEffect(() => {
    setClienteLocal(cliente);
  }, [cliente]);

  // Handlers de oportunidade de vendas
  const handleSalvarOportunidade = async () => {
    if (!clienteId) return;
    setSalvandoOportunidade(true);
    try {
      const oportunidade = {
        ativa: true,
        tipo: oportunidadeForm.tipo,
        valor_estimado: oportunidadeForm.valor_estimado ? parseFloat(oportunidadeForm.valor_estimado) : null,
        notas: oportunidadeForm.notas || '',
        criado_em: Timestamp.now(),
        criado_por: user?.email || 'sistema'
      };
      await updateDoc(doc(db, 'clientes', clienteId), { oportunidade_vendas: oportunidade });
      setClienteLocal(prev => ({ ...prev, oportunidade_vendas: oportunidade }));
      setShowOportunidadeForm(false);
      setOportunidadeForm({ tipo: 'upsell', valor_estimado: '', notas: '' });
    } catch (error) {
      console.error('Erro ao salvar oportunidade:', error);
    } finally {
      setSalvandoOportunidade(false);
    }
  };

  const handleRemoverOportunidade = async () => {
    if (!clienteId || !confirm('Remover esta oportunidade de vendas?')) return;
    try {
      await updateDoc(doc(db, 'clientes', clienteId), { oportunidade_vendas: null });
      setClienteLocal(prev => ({ ...prev, oportunidade_vendas: null }));
    } catch (error) {
      console.error('Erro ao remover oportunidade:', error);
    }
  };

  const handleEditarOportunidade = () => {
    const op = clienteLocal?.oportunidade_vendas;
    if (op) {
      setOportunidadeForm({
        tipo: op.tipo || 'upsell',
        valor_estimado: op.valor_estimado ? String(op.valor_estimado) : '',
        notas: op.notas || ''
      });
      setShowOportunidadeForm(true);
    }
  };

  const cicloAtivo = ciclos.find(c => c.status === 'em_andamento');
  const ciclosHistorico = ciclos.filter(c => c.status !== 'em_andamento');

  const handleAtualizarAcao = async (cicloId, indexAcao, novoStatus) => {
    const key = `${cicloId}-${indexAcao}`;
    setAtualizandoAcao(key);
    try {
      const obs = observacoesTemp[key] || '';
      const result = await atualizarAcao(clienteId, cicloId, indexAcao, novoStatus, obs, user?.email);

      setCiclos(prev => prev.map(c => {
        if (c.id !== cicloId) return c;
        const novasAcoes = c.acoes.map((a, i) => {
          if (i !== indexAcao) return a;
          return {
            ...a,
            status: novoStatus,
            concluida_em: novoStatus === 'concluida' ? new Date() : null,
            concluida_por: novoStatus === 'concluida' ? user?.email : null,
            observacoes: obs || a.observacoes,
          };
        });
        return { ...c, acoes: novasAcoes, progresso: result.progresso, status: result.status };
      }));

      setObservacoesTemp(prev => ({ ...prev, [key]: '' }));
    } catch (error) {
      console.error('Erro ao atualizar ação:', error);
    } finally {
      setAtualizandoAcao(null);
    }
  };

  const handleCancelarCiclo = async (cicloId) => {
    if (!confirm('Tem certeza que deseja cancelar este ciclo?')) return;
    try {
      await cancelarCiclo(clienteId, cicloId);
      setCiclos(prev => prev.map(c => c.id === cicloId ? { ...c, status: 'cancelado' } : c));
    } catch (error) {
      console.error('Erro ao cancelar ciclo:', error);
    }
  };

  const abrirModal = () => {
    const seg = normalizarSegmento(segmentoAtual);
    setModalSegmento(seg);
    const acoes = ongoingConfig?.[seg] || DEFAULT_ONGOING_ACOES[seg] || [];
    setModalAcoes([...acoes]);
    setModalCadencia('mensal');
    setModalDataInicio(new Date().toISOString().split('T')[0]);
    setModalNovaAcao('');
    setShowModal(true);
  };

  const normalizarSegmento = (seg) => {
    if (!seg) return 'CRESCIMENTO';
    const upper = seg.toUpperCase().replace(/[ÁÀÃÂ]/g, 'A').replace(/[ÉÈÊ]/g, 'E');
    if (upper.includes('CRESC') || upper === 'GROW') return 'CRESCIMENTO';
    if (upper.includes('ESTAV') || upper.includes('ESTÁV') || upper === 'NURTURE') return 'ESTAVEL';
    if (upper.includes('ALERT') || upper.includes('ATENC') || upper === 'WATCH') return 'ALERTA';
    if (upper.includes('RESG') || upper === 'RESCUE') return 'RESGATE';
    return 'CRESCIMENTO';
  };

  const handleAtribuir = async () => {
    if (modalAcoes.length === 0) return;
    setAtribuindo(true);
    try {
      const novoCiclo = await atribuirCiclo(clienteId, {
        segmento: modalSegmento,
        cadencia: modalCadencia,
        dataInicio: modalDataInicio,
        acoes: modalAcoes,
        cliente: cliente, // Para criar tarefas no ClickUp
      });
      setCiclos(prev => [novoCiclo, ...prev]);
      setExpandedCiclo(novoCiclo.id);
      setShowModal(false);
    } catch (error) {
      console.error('Erro ao atribuir ciclo:', error);
    } finally {
      setAtribuindo(false);
    }
  };

  const formatDate = (ts) => {
    if (!ts) return '-';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('pt-BR');
  };

  const segmentos = ['CRESCIMENTO', 'ESTAVEL', 'ALERTA', 'RESGATE'];

  if (loading) {
    return (
      <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '20px', padding: '40px', textAlign: 'center' }}>
        <Loader2 style={{ width: '24px', height: '24px', color: '#8b5cf6', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
        <p style={{ color: '#64748b', fontSize: '14px', marginTop: '12px' }}>Carregando ciclos ongoing...</p>
      </div>
    );
  }

  // Verificar se cliente tem carência ativa
  const carencia = clienteLocal?.carencia_nivel;
  const carenciaAtiva = carencia?.ativa === true;
  const diasRestantes = carenciaAtiva ? calcularDiasRestantes(carencia.data_fim) : 0;

  // Oportunidade de vendas ativa
  const oportunidade = clienteLocal?.oportunidade_vendas;
  const oportunidadeAtiva = oportunidade?.ativa === true;
  const tipoOportunidade = TIPOS_OPORTUNIDADE.find(t => t.value === oportunidade?.tipo);

  return (
    <div>
      {/* Card de Carência (7 dias) */}
      {carenciaAtiva && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '20px',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '12px',
              background: 'rgba(245, 158, 11, 0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <Timer style={{ width: '24px', height: '24px', color: '#f59e0b' }} />
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <h3 style={{ color: '#f59e0b', fontSize: '16px', fontWeight: '700', margin: 0 }}>
                  Período de Carência Ativo
                </h3>
                <span style={{
                  padding: '4px 12px',
                  background: diasRestantes <= 2 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                  color: diasRestantes <= 2 ? '#ef4444' : '#f59e0b',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: '700'
                }}>
                  {diasRestantes} {diasRestantes === 1 ? 'dia restante' : 'dias restantes'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span style={{
                  padding: '4px 10px',
                  background: SEGMENTOS_CS[carencia.segmento_de]?.bgColor || 'rgba(100, 116, 139, 0.2)',
                  color: SEGMENTOS_CS[carencia.segmento_de]?.color || '#94a3b8',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600'
                }}>
                  {SEGMENTOS_CS[carencia.segmento_de]?.label || carencia.segmento_de}
                </span>
                <ArrowDown style={{ width: '16px', height: '16px', color: '#ef4444' }} />
                <span style={{
                  padding: '4px 10px',
                  background: SEGMENTOS_CS[carencia.segmento_para]?.bgColor || 'rgba(100, 116, 139, 0.2)',
                  color: SEGMENTOS_CS[carencia.segmento_para]?.color || '#94a3b8',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: '600'
                }}>
                  {SEGMENTOS_CS[carencia.segmento_para]?.label || carencia.segmento_para}
                </span>
              </div>

              <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 12px', lineHeight: '1.5' }}>
                <strong style={{ color: '#e2e8f0' }}>Motivo:</strong> {carencia.motivo || 'Queda de nível detectada'}
              </p>

              <div style={{
                padding: '12px 16px',
                background: 'rgba(15, 10, 31, 0.4)',
                borderRadius: '10px',
                border: '1px solid rgba(245, 158, 11, 0.1)'
              }}>
                <p style={{ color: '#f59e0b', fontSize: '13px', margin: 0, fontWeight: '500' }}>
                  <AlertTriangle style={{ width: '14px', height: '14px', display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
                  {diasRestantes > 0
                    ? `Comunique-se com o cliente. Se não recuperar em ${diasRestantes} ${diasRestantes === 1 ? 'dia' : 'dias'}, o playbook de ${SEGMENTOS_CS[carencia.segmento_para]?.label || carencia.segmento_para} será ativado automaticamente.`
                    : 'Carência vencida. Verifique se o alerta de playbook foi criado.'
                  }
                </p>
              </div>

              {/* Barra de progresso da carência */}
              <div style={{ marginTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: '#64748b', fontSize: '11px' }}>Início: {formatDate(carencia.data_inicio)}</span>
                  <span style={{ color: '#64748b', fontSize: '11px' }}>Fim: {formatDate(carencia.data_fim)}</span>
                </div>
                <div style={{
                  height: '6px', background: 'rgba(15, 10, 31, 0.6)',
                  borderRadius: '3px', overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${Math.max(0, Math.min(100, ((7 - diasRestantes) / 7) * 100))}%`,
                    height: '100%',
                    background: diasRestantes <= 2 ? '#ef4444' : '#f59e0b',
                    borderRadius: '3px',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Card de Oportunidade de Vendas */}
      {oportunidadeAtiva && !showOportunidadeForm && (
        <div style={{
          background: `${tipoOportunidade?.color || '#10b981'}10`,
          border: `1px solid ${tipoOportunidade?.color || '#10b981'}40`,
          borderRadius: '20px',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '12px',
              background: `${tipoOportunidade?.color || '#10b981'}20`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <TrendingUp style={{ width: '24px', height: '24px', color: tipoOportunidade?.color || '#10b981' }} />
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <h3 style={{ color: tipoOportunidade?.color || '#10b981', fontSize: '16px', fontWeight: '700', margin: 0 }}>
                  Oportunidade de Vendas
                </h3>
                <span style={{
                  padding: '4px 12px',
                  background: `${tipoOportunidade?.color || '#10b981'}20`,
                  color: tipoOportunidade?.color || '#10b981',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: '700'
                }}>
                  {tipoOportunidade?.label || oportunidade.tipo}
                </span>
              </div>

              <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 8px', lineHeight: '1.5' }}>
                {tipoOportunidade?.description || 'Potencial de venda identificado'}
              </p>

              {oportunidade.valor_estimado && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <DollarSign style={{ width: '16px', height: '16px', color: '#10b981' }} />
                  <span style={{ color: '#10b981', fontSize: '18px', fontWeight: '700' }}>
                    R$ {oportunidade.valor_estimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <span style={{ color: '#64748b', fontSize: '13px' }}>valor estimado</span>
                </div>
              )}

              {oportunidade.notas && (
                <div style={{
                  padding: '12px 16px',
                  background: 'rgba(15, 10, 31, 0.4)',
                  borderRadius: '10px',
                  marginBottom: '12px'
                }}>
                  <p style={{ color: '#e2e8f0', fontSize: '14px', margin: 0, lineHeight: '1.5' }}>
                    {oportunidade.notas}
                  </p>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#475569', fontSize: '12px' }}>
                  Criado em {oportunidade.criado_em?.toDate ? oportunidade.criado_em.toDate().toLocaleDateString('pt-BR') : '-'}
                  {oportunidade.criado_por && ` por ${oportunidade.criado_por}`}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleEditarOportunidade}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.2)',
                  color: '#8b5cf6', cursor: 'pointer'
                }}
              >
                <Pencil style={{ width: '16px', height: '16px' }} />
              </button>
              <button
                onClick={handleRemoverOportunidade}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
                  color: '#ef4444', cursor: 'pointer'
                }}
              >
                <Trash2 style={{ width: '16px', height: '16px' }} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Formulário de Oportunidade de Vendas */}
      {showOportunidadeForm && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.05)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          borderRadius: '20px',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <TrendingUp style={{ width: '20px', height: '20px', color: '#10b981' }} />
              <h3 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: 0 }}>
                {oportunidadeAtiva ? 'Editar Oportunidade' : 'Nova Oportunidade de Vendas'}
              </h3>
            </div>
            <button
              onClick={() => setShowOportunidadeForm(false)}
              style={{
                background: 'none', border: 'none', padding: '4px',
                cursor: 'pointer', display: 'flex', alignItems: 'center'
              }}
            >
              <X style={{ width: '20px', height: '20px', color: '#64748b' }} />
            </button>
          </div>

          {/* Tipo de oportunidade */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ color: '#94a3b8', fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '8px' }}>
              Tipo de Oportunidade
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {TIPOS_OPORTUNIDADE.map(tipo => (
                <button
                  key={tipo.value}
                  onClick={() => setOportunidadeForm(prev => ({ ...prev, tipo: tipo.value }))}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '10px',
                    border: oportunidadeForm.tipo === tipo.value
                      ? `2px solid ${tipo.color}`
                      : '1px solid rgba(100, 116, 139, 0.3)',
                    background: oportunidadeForm.tipo === tipo.value
                      ? `${tipo.color}20`
                      : 'rgba(15, 10, 31, 0.6)',
                    color: oportunidadeForm.tipo === tipo.value ? tipo.color : '#94a3b8',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  {tipo.label}
                </button>
              ))}
            </div>
            <p style={{ color: '#64748b', fontSize: '12px', margin: '8px 0 0' }}>
              {TIPOS_OPORTUNIDADE.find(t => t.value === oportunidadeForm.tipo)?.description}
            </p>
          </div>

          {/* Valor estimado */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ color: '#94a3b8', fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
              Valor Estimado (R$) <span style={{ color: '#64748b', fontWeight: '400' }}>(opcional)</span>
            </label>
            <input
              type="number"
              placeholder="Ex: 5000"
              value={oportunidadeForm.valor_estimado}
              onChange={(e) => setOportunidadeForm(prev => ({ ...prev, valor_estimado: e.target.value }))}
              style={{
                width: '200px', padding: '10px 14px',
                background: '#0f0a1f', border: '1px solid #3730a3',
                borderRadius: '10px', color: 'white', fontSize: '14px', outline: 'none'
              }}
            />
          </div>

          {/* Notas */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ color: '#94a3b8', fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
              Notas <span style={{ color: '#64748b', fontWeight: '400' }}>(opcional)</span>
            </label>
            <textarea
              placeholder="Detalhes da oportunidade, contexto, próximos passos..."
              value={oportunidadeForm.notas}
              onChange={(e) => setOportunidadeForm(prev => ({ ...prev, notas: e.target.value }))}
              style={{
                width: '100%', padding: '12px 14px', minHeight: '80px',
                background: '#0f0a1f', border: '1px solid #3730a3',
                borderRadius: '10px', color: 'white', fontSize: '14px',
                outline: 'none', resize: 'vertical', fontFamily: 'inherit'
              }}
            />
          </div>

          {/* Botões */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setShowOportunidadeForm(false)}
              style={{
                padding: '10px 20px', background: 'rgba(100, 116, 139, 0.2)',
                border: '1px solid rgba(100, 116, 139, 0.3)', borderRadius: '12px',
                color: '#94a3b8', fontSize: '14px', cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSalvarOportunidade}
              disabled={salvandoOportunidade}
              style={{
                padding: '10px 24px',
                background: salvandoOportunidade ? 'rgba(16, 185, 129, 0.3)' : 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
                border: 'none', borderRadius: '12px', color: 'white',
                fontSize: '14px', fontWeight: '600',
                cursor: salvandoOportunidade ? 'not-allowed' : 'pointer'
              }}
            >
              {salvandoOportunidade ? 'Salvando...' : 'Salvar Oportunidade'}
            </button>
          </div>
        </div>
      )}

      {/* Botão para adicionar oportunidade (quando não há ativa) */}
      {!oportunidadeAtiva && !showOportunidadeForm && (
        <div style={{
          background: 'rgba(30, 27, 75, 0.4)',
          border: '1px dashed rgba(16, 185, 129, 0.3)',
          borderRadius: '16px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <TrendingUp style={{ width: '20px', height: '20px', color: '#10b981' }} />
            <span style={{ color: '#94a3b8', fontSize: '14px' }}>
              Sinalize uma oportunidade de vendas para este cliente
            </span>
          </div>
          <button
            onClick={() => setShowOportunidadeForm(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '10px',
              color: '#10b981',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            <TrendingUp style={{ width: '14px', height: '14px' }} />
            Adicionar Oportunidade
          </button>
        </div>
      )}

      {/* Ciclo Ativo */}
      <div style={{
        background: 'rgba(30, 27, 75, 0.4)',
        border: '1px solid rgba(139, 92, 246, 0.15)',
        borderRadius: '20px',
        padding: '24px',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ClipboardList style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
            <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>Ongoing</h2>
            {cicloAtivo && (
              <span style={{
                padding: '4px 12px',
                background: 'rgba(139, 92, 246, 0.2)',
                color: '#a78bfa',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '600'
              }}>
                Ciclo Ativo
              </span>
            )}
          </div>
          {!cicloAtivo && (
            <button
              onClick={abrirModal}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 20px',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                border: 'none', borderRadius: '12px', color: 'white',
                fontSize: '14px', fontWeight: '600', cursor: 'pointer'
              }}
            >
              <Play style={{ width: '16px', height: '16px' }} />
              Novo Ciclo
            </button>
          )}
        </div>

        {cicloAtivo ? (
          <div>
            {/* Info do ciclo */}
            <div style={{
              display: 'flex', gap: '24px', marginBottom: '20px',
              padding: '16px', background: 'rgba(15, 10, 31, 0.6)',
              borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.1)'
            }}>
              <div>
                <span style={{ color: '#64748b', fontSize: '12px' }}>Saúde</span>
                <p style={{ color: SEGMENTOS_CS[cicloAtivo.segmento]?.color || '#8b5cf6', fontSize: '14px', fontWeight: '600', margin: '4px 0 0' }}>
                  {SEGMENTOS_CS[cicloAtivo.segmento]?.label || cicloAtivo.segmento}
                </p>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '12px' }}>Cadência</span>
                <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: '4px 0 0' }}>
                  {CADENCIA_OPTIONS.find(c => c.value === cicloAtivo.cadencia)?.label || cicloAtivo.cadencia}
                </p>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '12px' }}>Período</span>
                <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: '4px 0 0' }}>
                  {formatDate(cicloAtivo.data_inicio)} — {formatDate(cicloAtivo.data_fim)}
                </p>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <span style={{ color: '#64748b', fontSize: '12px' }}>Progresso</span>
                <p style={{ color: '#8b5cf6', fontSize: '20px', fontWeight: '700', margin: '4px 0 0' }}>
                  {cicloAtivo.progresso || 0}%
                </p>
              </div>
            </div>

            {/* Barra de progresso */}
            <div style={{
              height: '8px', background: 'rgba(15, 10, 31, 0.6)',
              borderRadius: '4px', marginBottom: '20px', overflow: 'hidden'
            }}>
              <div style={{
                width: `${cicloAtivo.progresso || 0}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #8b5cf6, #06b6d4)',
                borderRadius: '4px',
                transition: 'width 0.3s ease'
              }} />
            </div>

            {/* Lista de ações */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(cicloAtivo.acoes || []).map((acao, idx) => {
                const statusInfo = ACAO_STATUS[acao.status] || ACAO_STATUS.pendente;
                const key = `${cicloAtivo.id}-${idx}`;
                const isUpdating = atualizandoAcao === key;
                const isConcluida = acao.status === 'concluida';
                const isPulada = acao.status === 'pulada';
                const isDone = isConcluida || isPulada;

                return (
                  <div key={idx} style={{
                    padding: '14px 16px',
                    background: isDone ? 'rgba(15, 10, 31, 0.3)' : 'rgba(15, 10, 31, 0.6)',
                    borderRadius: '12px',
                    border: `1px solid ${isDone ? 'rgba(100, 116, 139, 0.1)' : 'rgba(139, 92, 246, 0.1)'}`,
                    opacity: isDone ? 0.7 : 1,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                        {/* Status icon */}
                        <div style={{
                          width: '28px', height: '28px', borderRadius: '8px',
                          background: isDone ? statusInfo.color + '20' : 'rgba(139, 92, 246, 0.1)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}>
                          {isConcluida && <Check style={{ width: '16px', height: '16px', color: '#10b981' }} />}
                          {isPulada && <SkipForward style={{ width: '14px', height: '14px', color: '#64748b' }} />}
                          {!isDone && <Clock style={{ width: '14px', height: '14px', color: '#f59e0b' }} />}
                        </div>

                        <span style={{
                          color: isDone ? '#64748b' : '#e2e8f0',
                          fontSize: '14px',
                          textDecoration: isConcluida ? 'line-through' : 'none',
                          flex: 1
                        }}>
                          {acao.nome}
                        </span>

                        {acao.concluida_em && (
                          <span style={{ color: '#475569', fontSize: '11px' }}>
                            {formatDate(acao.concluida_em)}
                          </span>
                        )}
                      </div>

                      {!isDone && (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            onClick={() => handleAtualizarAcao(cicloAtivo.id, idx, 'concluida')}
                            disabled={isUpdating}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '4px',
                              padding: '6px 12px', background: 'rgba(16, 185, 129, 0.15)',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                              borderRadius: '8px', color: '#10b981',
                              fontSize: '12px', fontWeight: '600', cursor: 'pointer'
                            }}
                          >
                            {isUpdating ? <Loader2 style={{ width: '12px', height: '12px', animation: 'spin 1s linear infinite' }} /> : <Check style={{ width: '12px', height: '12px' }} />}
                            Concluir
                          </button>
                          <button
                            onClick={() => handleAtualizarAcao(cicloAtivo.id, idx, 'pulada')}
                            disabled={isUpdating}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '4px',
                              padding: '6px 12px', background: 'rgba(100, 116, 139, 0.15)',
                              border: '1px solid rgba(100, 116, 139, 0.3)',
                              borderRadius: '8px', color: '#94a3b8',
                              fontSize: '12px', fontWeight: '500', cursor: 'pointer'
                            }}
                          >
                            <SkipForward style={{ width: '12px', height: '12px' }} />
                            Pular
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Campo de observações (para ações pendentes) */}
                    {!isDone && (
                      <div style={{ marginTop: '10px', paddingLeft: '40px' }}>
                        <input
                          type="text"
                          placeholder="Observações (opcional)..."
                          value={observacoesTemp[key] || ''}
                          onChange={(e) => setObservacoesTemp(prev => ({ ...prev, [key]: e.target.value }))}
                          style={{
                            width: '100%', padding: '8px 12px',
                            background: 'rgba(15, 10, 31, 0.6)',
                            border: '1px solid rgba(139, 92, 246, 0.1)',
                            borderRadius: '8px', color: 'white',
                            fontSize: '13px', outline: 'none'
                          }}
                        />
                      </div>
                    )}

                    {/* Observação salva */}
                    {acao.observacoes && (
                      <div style={{ marginTop: '8px', paddingLeft: '40px' }}>
                        <p style={{ color: '#64748b', fontSize: '12px', margin: 0, fontStyle: 'italic' }}>
                          <MessageSquare style={{ width: '11px', height: '11px', display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                          {acao.observacoes}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Botão cancelar ciclo */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                onClick={() => handleCancelarCiclo(cicloAtivo.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 16px', background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '10px', color: '#ef4444',
                  fontSize: '13px', fontWeight: '500', cursor: 'pointer'
                }}
              >
                <X style={{ width: '14px', height: '14px' }} />
                Cancelar Ciclo
              </button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '32px 20px', color: '#64748b' }}>
            <ClipboardList style={{ width: '40px', height: '40px', color: '#3730a3', margin: '0 auto 12px' }} />
            <p style={{ fontSize: '15px', margin: '0 0 4px' }}>Nenhum ciclo ativo</p>
            <p style={{ fontSize: '13px', margin: 0 }}>Atribua um novo ciclo ongoing para acompanhar as ações recorrentes deste cliente.</p>
          </div>
        )}
      </div>

      {/* Histórico de Ciclos */}
      {ciclosHistorico.length > 0 && (
        <div style={{
          background: 'rgba(30, 27, 75, 0.4)',
          border: '1px solid rgba(139, 92, 246, 0.15)',
          borderRadius: '20px',
          padding: '24px'
        }}>
          <button
            onClick={() => setShowHistorico(!showHistorico)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', background: 'none', border: 'none',
              color: 'white', cursor: 'pointer', padding: 0
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Calendar style={{ width: '18px', height: '18px', color: '#64748b' }} />
              <span style={{ fontSize: '16px', fontWeight: '600' }}>Histórico de Ciclos</span>
              <span style={{
                padding: '2px 10px', background: 'rgba(100, 116, 139, 0.2)',
                borderRadius: '20px', fontSize: '12px', color: '#94a3b8'
              }}>
                {ciclosHistorico.length}
              </span>
            </div>
            {showHistorico ? <ChevronUp style={{ width: '18px', height: '18px', color: '#64748b' }} /> : <ChevronDown style={{ width: '18px', height: '18px', color: '#64748b' }} />}
          </button>

          {showHistorico && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
              {ciclosHistorico.map(ciclo => {
                const statusInfo = ONGOING_STATUS[ciclo.status] || ONGOING_STATUS.concluido;
                const isExpanded = expandedCiclo === ciclo.id;
                return (
                  <div key={ciclo.id} style={{
                    padding: '16px',
                    background: 'rgba(15, 10, 31, 0.4)',
                    borderRadius: '12px',
                    border: '1px solid rgba(100, 116, 139, 0.1)'
                  }}>
                    <div
                      onClick={() => setExpandedCiclo(isExpanded ? null : ciclo.id)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{
                          padding: '4px 10px',
                          background: statusInfo.color + '20',
                          color: statusInfo.color,
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}>
                          {statusInfo.label}
                        </span>
                        <span style={{ color: '#94a3b8', fontSize: '13px' }}>
                          {SEGMENTOS_CS[ciclo.segmento]?.label || ciclo.segmento}
                        </span>
                        <span style={{ color: '#475569', fontSize: '12px' }}>
                          {formatDate(ciclo.data_inicio)} — {formatDate(ciclo.data_fim)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ color: '#64748b', fontSize: '13px' }}>{ciclo.progresso || 0}%</span>
                        {isExpanded ? <ChevronUp style={{ width: '16px', height: '16px', color: '#64748b' }} /> : <ChevronDown style={{ width: '16px', height: '16px', color: '#64748b' }} />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {(ciclo.acoes || []).map((acao, idx) => {
                          const acaoStatus = ACAO_STATUS[acao.status] || ACAO_STATUS.pendente;
                          return (
                            <div key={idx} style={{
                              display: 'flex', alignItems: 'center', gap: '10px',
                              padding: '8px 12px', background: 'rgba(15, 10, 31, 0.4)',
                              borderRadius: '8px'
                            }}>
                              {acao.status === 'concluida' && <Check style={{ width: '14px', height: '14px', color: '#10b981', flexShrink: 0 }} />}
                              {acao.status === 'pulada' && <SkipForward style={{ width: '14px', height: '14px', color: '#64748b', flexShrink: 0 }} />}
                              {acao.status === 'pendente' && <Clock style={{ width: '14px', height: '14px', color: '#f59e0b', flexShrink: 0 }} />}
                              <span style={{
                                color: acao.status === 'concluida' ? '#64748b' : '#94a3b8',
                                fontSize: '13px',
                                textDecoration: acao.status === 'concluida' ? 'line-through' : 'none',
                                flex: 1
                              }}>
                                {acao.nome}
                              </span>
                              <span style={{ color: acaoStatus.color, fontSize: '11px', fontWeight: '600' }}>
                                {acaoStatus.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal Novo Ciclo */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }} onClick={() => setShowModal(false)}>
          <div style={{
            background: '#1e1b4b', border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '20px', padding: '32px', width: '560px', maxHeight: '80vh',
            overflowY: 'auto'
          }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ color: 'white', fontSize: '20px', fontWeight: '700', margin: '0 0 24px 0' }}>
              Novo Ciclo Ongoing
            </h2>

            {/* Segmento */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ color: '#94a3b8', fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Saúde</label>
              <select
                value={modalSegmento}
                onChange={(e) => {
                  setModalSegmento(e.target.value);
                  setModalAcoes([...(ongoingConfig?.[e.target.value] || DEFAULT_ONGOING_ACOES[e.target.value] || [])]);
                }}
                style={{
                  width: '100%', padding: '10px 14px', background: '#0f0a1f',
                  border: '1px solid #3730a3', borderRadius: '10px', color: 'white',
                  fontSize: '14px', outline: 'none'
                }}
              >
                {segmentos.map(s => (
                  <option key={s} value={s}>{SEGMENTOS_CS[s].label}</option>
                ))}
              </select>
            </div>

            {/* Cadência */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ color: '#94a3b8', fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Cadência</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {CADENCIA_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setModalCadencia(opt.value)}
                    style={{
                      flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
                      background: modalCadencia === opt.value ? 'rgba(139, 92, 246, 0.3)' : 'rgba(15, 10, 31, 0.6)',
                      color: modalCadencia === opt.value ? '#8b5cf6' : '#64748b',
                      fontSize: '14px', fontWeight: '600', cursor: 'pointer'
                    }}
                  >
                    {opt.label} ({opt.dias} dias)
                  </button>
                ))}
              </div>
            </div>

            {/* Data de início */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ color: '#94a3b8', fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '6px' }}>Data de Início</label>
              <input
                type="date"
                value={modalDataInicio}
                onChange={(e) => setModalDataInicio(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', background: '#0f0a1f',
                  border: '1px solid #3730a3', borderRadius: '10px', color: 'white',
                  fontSize: '14px', outline: 'none'
                }}
              />
            </div>

            {/* Ações */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ color: '#94a3b8', fontSize: '13px', fontWeight: '600', display: 'block', marginBottom: '6px' }}>
                Ações ({modalAcoes.length})
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                {modalAcoes.map((acao, idx) => (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', background: 'rgba(15, 10, 31, 0.6)',
                    borderRadius: '10px', border: '1px solid rgba(139, 92, 246, 0.1)'
                  }}>
                    <span style={{ color: '#e2e8f0', fontSize: '13px' }}>{acao}</span>
                    <button onClick={() => setModalAcoes(prev => prev.filter((_, i) => i !== idx))} style={{
                      background: 'rgba(239, 68, 68, 0.1)', border: 'none', borderRadius: '6px',
                      padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center'
                    }}>
                      <X style={{ width: '14px', height: '14px', color: '#ef4444' }} />
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <input
                  type="text"
                  placeholder="Adicionar ação personalizada..."
                  value={modalNovaAcao}
                  onChange={(e) => setModalNovaAcao(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && modalNovaAcao.trim()) {
                      setModalAcoes(prev => [...prev, modalNovaAcao.trim()]);
                      setModalNovaAcao('');
                    }
                  }}
                  style={{
                    flex: 1, padding: '10px 14px', background: '#0f0a1f',
                    border: '1px solid #3730a3', borderRadius: '10px', color: 'white',
                    fontSize: '13px', outline: 'none'
                  }}
                />
                <button
                  onClick={() => {
                    if (modalNovaAcao.trim()) {
                      setModalAcoes(prev => [...prev, modalNovaAcao.trim()]);
                      setModalNovaAcao('');
                    }
                  }}
                  style={{
                    padding: '10px 16px', background: 'rgba(139, 92, 246, 0.2)',
                    border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '10px',
                    color: '#8b5cf6', fontSize: '14px', fontWeight: '600', cursor: 'pointer'
                  }}
                >
                  +
                </button>
              </div>
            </div>

            {/* Botões */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: '10px 20px', background: 'rgba(100, 116, 139, 0.2)',
                  border: '1px solid rgba(100, 116, 139, 0.3)', borderRadius: '12px',
                  color: '#94a3b8', fontSize: '14px', cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleAtribuir}
                disabled={atribuindo || modalAcoes.length === 0}
                style={{
                  padding: '10px 24px',
                  background: atribuindo ? 'rgba(139, 92, 246, 0.3)' : 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                  border: 'none', borderRadius: '12px', color: 'white',
                  fontSize: '14px', fontWeight: '600',
                  cursor: atribuindo || modalAcoes.length === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                {atribuindo ? 'Atribuindo...' : 'Atribuir Ciclo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
