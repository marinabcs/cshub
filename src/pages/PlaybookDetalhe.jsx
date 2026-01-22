import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ClipboardList, Clock, ListChecks, Users, Check, Calendar, Play, X, ChevronDown, Loader2, AlertTriangle } from 'lucide-react';
import { buscarPlaybook, aplicarPlaybook } from '../services/playbooks';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';

export default function PlaybookDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [playbook, setPlaybook] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modal de aplicar playbook
  const [showModal, setShowModal] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState('');
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().split('T')[0]);
  const [aplicando, setAplicando] = useState(false);

  useEffect(() => {
    const fetchPlaybook = async () => {
      try {
        const data = await buscarPlaybook(id);
        setPlaybook(data);
      } catch (error) {
        console.error('Erro ao buscar playbook:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlaybook();
  }, [id]);

  const abrirModal = async () => {
    setShowModal(true);
    setLoadingClientes(true);

    try {
      const clientesRef = collection(db, 'clientes');
      const q = query(clientesRef, orderBy('team_name', 'asc'));
      const snapshot = await getDocs(q);

      const clientesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setClientes(clientesData);
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
    } finally {
      setLoadingClientes(false);
    }
  };

  const fecharModal = () => {
    setShowModal(false);
    setSelectedCliente('');
    setDataInicio(new Date().toISOString().split('T')[0]);
  };

  const handleAplicar = async () => {
    if (!selectedCliente) {
      alert('Selecione um cliente');
      return;
    }

    setAplicando(true);

    try {
      await aplicarPlaybook(selectedCliente, id, new Date(dataInicio));
      alert('Playbook aplicado com sucesso!');
      fecharModal();
      // Navegar para o cliente
      navigate(`/clientes/${selectedCliente}`);
    } catch (error) {
      console.error('Erro ao aplicar playbook:', error);
      alert(`Erro ao aplicar playbook: ${error.message}`);
    } finally {
      setAplicando(false);
    }
  };

  // Calcular datas de preview baseado na data de início selecionada
  const calcularDatasPreview = () => {
    if (!playbook?.etapas) return [];

    const inicio = new Date(dataInicio);

    return playbook.etapas.map(etapa => {
      const prazoData = new Date(inicio);
      prazoData.setDate(prazoData.getDate() + etapa.prazo_dias);

      return {
        ...etapa,
        prazoCalculado: prazoData.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      };
    });
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f0a1f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '48px', height: '48px', border: '3px solid rgba(139, 92, 246, 0.2)', borderTopColor: '#8b5cf6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      </div>
    );
  }

  if (!playbook) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f0a1f', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
        <AlertTriangle style={{ width: '48px', height: '48px', color: '#f59e0b' }} />
        <p style={{ color: '#94a3b8', fontSize: '16px' }}>Playbook não encontrado</p>
        <button onClick={() => navigate('/playbooks')} style={{ padding: '12px 24px', background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)', border: 'none', borderRadius: '12px', color: 'white', cursor: 'pointer' }}>Voltar para Playbooks</button>
      </div>
    );
  }

  const etapasPreview = calcularDatasPreview();

  return (
    <div style={{ padding: '32px', background: '#0f0a1f', minHeight: '100vh' }}>
      {/* Navegação */}
      <div style={{ marginBottom: '32px' }}>
        <button
          onClick={() => navigate('/playbooks')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            fontSize: '14px',
            cursor: 'pointer',
            marginBottom: '16px',
            padding: 0
          }}
        >
          <ArrowLeft style={{ width: '18px', height: '18px' }} />
          Voltar para Playbooks
        </button>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{
              width: '72px',
              height: '72px',
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(6, 182, 212, 0.2) 100%)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ClipboardList style={{ width: '36px', height: '36px', color: '#8b5cf6' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: 'white', margin: '0 0 8px 0' }}>
                {playbook.nome}
              </h1>
              <p style={{ color: '#94a3b8', fontSize: '16px', margin: 0 }}>
                {playbook.descricao}
              </p>
            </div>
          </div>
          <button
            onClick={abrirModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '14px 24px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              fontSize: '15px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(139, 92, 246, 0.3)'
            }}
          >
            <Play style={{ width: '18px', height: '18px' }} />
            Aplicar a Cliente
          </button>
        </div>
      </div>

      {/* Info Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px' }}>
        <div style={{
          background: 'rgba(30, 27, 75, 0.4)',
          border: '1px solid rgba(139, 92, 246, 0.15)',
          borderRadius: '16px',
          padding: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <ListChecks style={{ width: '18px', height: '18px', color: '#06b6d4' }} />
            <span style={{ color: '#94a3b8', fontSize: '13px' }}>Total de Etapas</span>
          </div>
          <span style={{ color: 'white', fontSize: '28px', fontWeight: '700' }}>
            {playbook.etapas?.length || 0}
          </span>
        </div>

        <div style={{
          background: 'rgba(30, 27, 75, 0.4)',
          border: '1px solid rgba(139, 92, 246, 0.15)',
          borderRadius: '16px',
          padding: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <Clock style={{ width: '18px', height: '18px', color: '#f97316' }} />
            <span style={{ color: '#94a3b8', fontSize: '13px' }}>Duração Estimada</span>
          </div>
          <span style={{ color: 'white', fontSize: '28px', fontWeight: '700' }}>
            {playbook.duracao_estimada_dias} <span style={{ fontSize: '16px', fontWeight: '400', color: '#94a3b8' }}>dias</span>
          </span>
        </div>

        <div style={{
          background: 'rgba(30, 27, 75, 0.4)',
          border: '1px solid rgba(139, 92, 246, 0.15)',
          borderRadius: '16px',
          padding: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <Check style={{ width: '18px', height: '18px', color: '#10b981' }} />
            <span style={{ color: '#94a3b8', fontSize: '13px' }}>Etapas Obrigatórias</span>
          </div>
          <span style={{ color: 'white', fontSize: '28px', fontWeight: '700' }}>
            {playbook.etapas?.filter(e => e.obrigatoria).length || 0}
          </span>
        </div>
      </div>

      {/* Timeline de Etapas */}
      <div style={{
        background: 'rgba(30, 27, 75, 0.4)',
        border: '1px solid rgba(139, 92, 246, 0.15)',
        borderRadius: '20px',
        padding: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <ListChecks style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
          <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>Etapas do Playbook</h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {playbook.etapas?.map((etapa, index) => (
            <div
              key={etapa.ordem}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '16px',
                padding: '20px',
                background: 'rgba(15, 10, 31, 0.6)',
                border: '1px solid rgba(139, 92, 246, 0.1)',
                borderRadius: '14px',
                position: 'relative'
              }}
            >
              {/* Número da etapa */}
              <div style={{
                width: '40px',
                height: '40px',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '16px',
                fontWeight: '700',
                flexShrink: 0
              }}>
                {etapa.ordem}
              </div>

              {/* Conteúdo */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <h4 style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: 0 }}>
                    {etapa.nome}
                  </h4>
                  {etapa.obrigatoria ? (
                    <span style={{
                      padding: '2px 8px',
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#10b981',
                      borderRadius: '6px',
                      fontSize: '10px',
                      fontWeight: '600',
                      textTransform: 'uppercase'
                    }}>
                      Obrigatória
                    </span>
                  ) : (
                    <span style={{
                      padding: '2px 8px',
                      background: 'rgba(100, 116, 139, 0.2)',
                      color: '#94a3b8',
                      borderRadius: '6px',
                      fontSize: '10px',
                      fontWeight: '500'
                    }}>
                      Opcional
                    </span>
                  )}
                </div>
                <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0, lineHeight: 1.5 }}>
                  {etapa.descricao}
                </p>
              </div>

              {/* Prazo */}
              <div style={{
                padding: '8px 14px',
                background: 'rgba(249, 115, 22, 0.1)',
                border: '1px solid rgba(249, 115, 22, 0.2)',
                borderRadius: '10px',
                flexShrink: 0
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock style={{ width: '14px', height: '14px', color: '#f97316' }} />
                  <span style={{ color: '#f97316', fontSize: '13px', fontWeight: '500' }}>
                    D+{etapa.prazo_dias}
                  </span>
                </div>
              </div>

              {/* Linha de conexão */}
              {index < playbook.etapas.length - 1 && (
                <div style={{
                  position: 'absolute',
                  left: '39px',
                  bottom: '-12px',
                  width: '2px',
                  height: '12px',
                  background: 'linear-gradient(180deg, rgba(139, 92, 246, 0.5) 0%, rgba(139, 92, 246, 0.1) 100%)'
                }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Modal de Aplicar Playbook */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#1e1b4b',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Header do Modal */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid rgba(139, 92, 246, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(6, 182, 212, 0.2) 100%)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Play style={{ width: '22px', height: '22px', color: '#8b5cf6' }} />
                </div>
                <div>
                  <h3 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>Aplicar Playbook</h3>
                  <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>{playbook.nome}</p>
                </div>
              </div>
              <button
                onClick={fecharModal}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '8px'
                }}
              >
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>

            {/* Body do Modal */}
            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              {/* Selecionar Cliente */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '8px', fontWeight: '500' }}>
                  Selecionar Cliente
                </label>
                <select
                  value={selectedCliente}
                  onChange={(e) => setSelectedCliente(e.target.value)}
                  disabled={loadingClientes}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    background: '#0f0a1f',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '12px',
                    color: 'white',
                    fontSize: '14px',
                    outline: 'none',
                    cursor: loadingClientes ? 'wait' : 'pointer'
                  }}
                >
                  <option value="" style={{ background: '#1e1b4b' }}>
                    {loadingClientes ? 'Carregando clientes...' : 'Selecione um cliente'}
                  </option>
                  {clientes.map(cliente => (
                    <option key={cliente.id} value={cliente.id} style={{ background: '#1e1b4b' }}>
                      {cliente.team_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Data de Início */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '8px', fontWeight: '500' }}>
                  Data de Início
                </label>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    background: '#0f0a1f',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '12px',
                    color: 'white',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Preview das Datas */}
              <div style={{
                padding: '16px',
                background: 'rgba(139, 92, 246, 0.05)',
                border: '1px solid rgba(139, 92, 246, 0.15)',
                borderRadius: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Calendar style={{ width: '16px', height: '16px', color: '#8b5cf6' }} />
                  <span style={{ color: '#a78bfa', fontSize: '13px', fontWeight: '600' }}>Preview das Datas</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {etapasPreview.map(etapa => (
                    <div
                      key={etapa.ordem}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: 'rgba(15, 10, 31, 0.4)',
                        borderRadius: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{
                          width: '24px',
                          height: '24px',
                          background: 'rgba(139, 92, 246, 0.3)',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#a78bfa',
                          fontSize: '12px',
                          fontWeight: '600'
                        }}>
                          {etapa.ordem}
                        </span>
                        <span style={{ color: '#e2e8f0', fontSize: '13px' }}>{etapa.nome}</span>
                      </div>
                      <span style={{ color: '#94a3b8', fontSize: '13px' }}>{etapa.prazoCalculado}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer do Modal */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid rgba(139, 92, 246, 0.15)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button
                onClick={fecharModal}
                style={{
                  padding: '12px 24px',
                  background: 'transparent',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  borderRadius: '12px',
                  color: '#94a3b8',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleAplicar}
                disabled={aplicando || !selectedCliente}
                style={{
                  padding: '12px 24px',
                  background: (!selectedCliente || aplicando) ? 'rgba(139, 92, 246, 0.4)' : 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                  border: 'none',
                  borderRadius: '12px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: (!selectedCliente || aplicando) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {aplicando ? (
                  <>
                    <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
                    Aplicando...
                  </>
                ) : (
                  <>
                    <Play style={{ width: '16px', height: '16px' }} />
                    Aplicar Playbook
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
