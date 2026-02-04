import { useState, useEffect } from 'react';
import { collection } from 'firebase/firestore';
import { db } from '../services/firebase';
import { cachedGetDocs } from '../services/cache';
import { useNavigate } from 'react-router-dom';
import { Users, CheckCircle, AlertTriangle, XCircle, TrendingUp, Clock, MessageSquare, ChevronRight, Circle, Bell, Frown, Briefcase } from 'lucide-react';
import { STATUS_OPTIONS } from '../utils/clienteStatus';
import { SEGMENTOS_CS, getClienteSegmento, getSegmentoColor, getSegmentoLabel } from '../utils/segmentoCS';
import { useAlertasCount } from '../hooks/useAlertas';

// Mapeamento de ícones por tipo de alerta
const ALERTA_ICONS = {
  sem_uso_plataforma: Clock,
  sentimento_negativo: Frown,
  resposta_pendente: MessageSquare,
  problema_reclamacao: AlertTriangle,
};

export default function Dashboard() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Alertas
  const { counts: alertaCounts } = useAlertasCount();

  useEffect(() => {
    const fetchClientes = async () => {
      try {
        const docs = await cachedGetDocs('clientes', collection(db, 'clientes'), 300000);
        const clientesData = docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setClientes(clientesData);
      } catch (error) {
        console.error('Erro ao buscar clientes:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchClientes();
  }, []);

  // Filtrar apenas clientes ativos (excluir inativos e cancelados)
  const clientesAtivos = clientes.filter(c =>
    c.status !== 'inativo' && c.status !== 'cancelado'
  );

  // Stats baseado em clientes ativos por segmento
  const stats = {
    total: clientesAtivos.length,
    crescimento: clientesAtivos.filter(c => getClienteSegmento(c) === 'CRESCIMENTO').length,
    estavel: clientesAtivos.filter(c => getClienteSegmento(c) === 'ESTAVEL').length,
    alerta: clientesAtivos.filter(c => getClienteSegmento(c) === 'ALERTA').length,
    resgate: clientesAtivos.filter(c => getClienteSegmento(c) === 'RESGATE').length
  };

  // Stats por status do cliente (ciclo de vida) - inclui todos
  const statusStats = {
    ativo: clientes.filter(c => (c.status || 'ativo') === 'ativo').length,
    onboarding: clientes.filter(c => c.status === 'onboarding').length,
    aviso_previo: clientes.filter(c => c.status === 'aviso_previo').length,
    inativo: clientes.filter(c => c.status === 'inativo').length,
    cancelado: clientes.filter(c => c.status === 'cancelado').length
  };

  // Clientes que precisam de atenção (WATCH e RESCUE - mais críticos primeiro)
  const segmentoOrder = { RESGATE: 1, ALERTA: 2, ESTAVEL: 3, CRESCIMENTO: 4 };
  const clientesAtencao = clientesAtivos
    .filter(c => ['ALERTA', 'RESGATE'].includes(getClienteSegmento(c)))
    .sort((a, b) => (segmentoOrder[getClienteSegmento(a)] || 5) - (segmentoOrder[getClienteSegmento(b)] || 5))
    .slice(0, 5);

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Sem registro';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Hoje';
    if (diff === 1) return 'Ontem';
    return `há ${diff} dias`;
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0f0a1f',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '3px solid rgba(139, 92, 246, 0.2)',
          borderTopColor: '#8b5cf6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px', background: '#0f0a1f', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '32px'
      }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: 'white', margin: '0 0 8px 0' }}>
            Dashboard
          </h1>
          <p style={{ color: '#94a3b8', margin: 0 }}>
            Visão geral • {stats.total} clientes ativos
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => navigate('/minha-carteira')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(139, 92, 246, 0.3)'
            }}
          >
            <Briefcase style={{ width: '18px', height: '18px' }} />
            Minha Carteira
          </button>
          <button
            onClick={() => navigate('/clientes')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              background: 'rgba(30, 27, 75, 0.6)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '12px',
              color: 'white',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            <Users style={{ width: '18px', height: '18px' }} />
            Ver Todos
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '20px',
        marginBottom: '32px'
      }}>
        {/* Total de Clientes */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)',
          border: '1px solid rgba(139, 92, 246, 0.2)',
          borderRadius: '20px',
          padding: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(139, 92, 246, 0.3)'
          }}>
            <Users style={{ width: '28px', height: '28px', color: 'white' }} />
          </div>
          <div>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 4px 0' }}>Total de Clientes</p>
            <p style={{ color: 'white', fontSize: '32px', fontWeight: 'bold', margin: 0 }}>{stats.total}</p>
          </div>
        </div>

        {/* Saudáveis */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          borderRadius: '20px',
          padding: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3)'
          }}>
            <CheckCircle style={{ width: '28px', height: '28px', color: 'white' }} />
          </div>
          <div>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 4px 0' }}>Saudáveis</p>
            <p style={{ color: 'white', fontSize: '32px', fontWeight: 'bold', margin: 0 }}>{stats.crescimento + stats.estavel}</p>
          </div>
        </div>

        {/* Precisam Atenção */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          borderRadius: '20px',
          padding: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(245, 158, 11, 0.3)'
          }}>
            <AlertTriangle style={{ width: '28px', height: '28px', color: 'white' }} />
          </div>
          <div>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 4px 0' }}>Precisam Atenção</p>
            <p style={{ color: 'white', fontSize: '32px', fontWeight: 'bold', margin: 0 }}>{stats.alerta}</p>
          </div>
        </div>

        {/* Críticos */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: '20px',
          padding: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(239, 68, 68, 0.3)'
          }}>
            <XCircle style={{ width: '28px', height: '28px', color: 'white' }} />
          </div>
          <div>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 4px 0' }}>Em Estado Crítico</p>
            <p style={{ color: 'white', fontSize: '32px', fontWeight: 'bold', margin: 0 }}>{stats.resgate}</p>
          </div>
        </div>
      </div>

      {/* Card de Alertas Pendentes */}
      {alertaCounts.pendentes > 0 && (
        <div
          onClick={() => navigate('/minha-carteira')}
          style={{
            marginBottom: '32px',
            padding: '20px 24px',
            background: alertaCounts.urgentes > 0
              ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)'
              : 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(30, 27, 75, 0.6) 100%)',
            border: `1px solid ${alertaCounts.urgentes > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
            borderRadius: '16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              background: alertaCounts.urgentes > 0
                ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Bell style={{ width: '24px', height: '24px', color: 'white' }} />
            </div>
            <div>
              <p style={{ color: 'white', fontSize: '16px', fontWeight: '600', margin: '0 0 4px 0' }}>
                {alertaCounts.pendentes} alerta{alertaCounts.pendentes !== 1 ? 's' : ''} pendente{alertaCounts.pendentes !== 1 ? 's' : ''}
              </p>
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>
                {alertaCounts.urgentes > 0 && (
                  <span style={{ color: '#ef4444', fontWeight: '500' }}>
                    {alertaCounts.urgentes} urgente{alertaCounts.urgentes !== 1 ? 's' : ''} •{' '}
                  </span>
                )}
                {alertaCounts.emAndamento} em andamento
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: alertaCounts.urgentes > 0 ? '#ef4444' : '#f59e0b' }}>
            <span style={{ fontSize: '14px', fontWeight: '500' }}>Ver minha carteira</span>
            <ChevronRight style={{ width: '18px', height: '18px' }} />
          </div>
        </div>
      )}

      {/* Grid de Seções */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '24px'
      }}>
        {/* Clientes que precisam de atenção */}
        <div style={{
          background: 'rgba(30, 27, 75, 0.4)',
          border: '1px solid rgba(139, 92, 246, 0.15)',
          borderRadius: '20px',
          padding: '24px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <AlertTriangle style={{ width: '20px', height: '20px', color: '#f59e0b' }} />
              <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>
                Clientes em Atenção
              </h2>
            </div>
            <button
              onClick={() => navigate('/clientes')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: 'none',
                border: 'none',
                color: '#8b5cf6',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              Ver todos
              <ChevronRight style={{ width: '16px', height: '16px' }} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {clientesAtencao.length > 0 ? clientesAtencao.map((cliente) => (
              <div
                key={cliente.id}
                onClick={() => navigate(`/clientes/${cliente.id}`)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px',
                  background: 'rgba(15, 10, 31, 0.6)',
                  border: '1px solid rgba(139, 92, 246, 0.1)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: '600',
                    fontSize: '16px'
                  }}>
                    {cliente.team_name?.charAt(0) || 'C'}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: 'white', fontWeight: '500' }}>{cliente.team_name}</span>
                      <span style={{
                        padding: '2px 8px',
                        background: `${getSegmentoColor(getClienteSegmento(cliente))}20`,
                        color: getSegmentoColor(getClienteSegmento(cliente)),
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}>
                        {getSegmentoLabel(getClienteSegmento(cliente))}
                      </span>
                    </div>
                    <span style={{ color: '#64748b', fontSize: '13px' }}>
                      {(cliente.responsaveis && cliente.responsaveis.length > 0)
                        ? cliente.responsaveis.map(r => r.nome?.split(' ')[0] || r.email?.split('@')[0]).join(', ')
                        : cliente.responsavel_nome?.split(' ')[0] || 'Sem responsável'}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b', fontSize: '12px' }}>
                    <Clock style={{ width: '12px', height: '12px' }} />
                    {formatDate(cliente.ultima_interacao)}
                  </div>
                </div>
              </div>
            )) : (
              <div style={{
                padding: '32px',
                textAlign: 'center',
                color: '#10b981'
              }}>
                Nenhum cliente precisa de atenção no momento!
              </div>
            )}
          </div>
        </div>

        {/* Distribuição por Segmento CS */}
        <div style={{
          background: 'rgba(30, 27, 75, 0.4)',
          border: '1px solid rgba(139, 92, 246, 0.15)',
          borderRadius: '20px',
          padding: '24px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '24px'
          }}>
            <TrendingUp style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
            <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>
              Distribuição por Segmento
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[
              { label: 'Crescimento', value: stats.crescimento, color: SEGMENTOS_CS.CRESCIMENTO.color },
              { label: 'Estavel', value: stats.estavel, color: SEGMENTOS_CS.ESTAVEL.color },
              { label: 'Alerta', value: stats.alerta, color: SEGMENTOS_CS.ALERTA.color },
              { label: 'Resgate', value: stats.resgate, color: SEGMENTOS_CS.RESGATE.color }
            ].map((item, index) => (
              <div key={index}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '8px'
                }}>
                  <span style={{ color: '#e2e8f0', fontSize: '14px' }}>{item.label}</span>
                  <span style={{ color: 'white', fontWeight: '600' }}>
                    {item.value} <span style={{ color: '#64748b', fontWeight: '400' }}>
                      ({stats.total > 0 ? Math.round((item.value / stats.total) * 100) : 0}%)
                    </span>
                  </span>
                </div>
                <div style={{
                  width: '100%',
                  height: '8px',
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: stats.total > 0 ? `${(item.value / stats.total) * 100}%` : '0%',
                    height: '100%',
                    background: item.color,
                    borderRadius: '4px',
                    transition: 'width 0.5s ease'
                  }}></div>
                </div>
              </div>
            ))}
          </div>

          {/* Resumo */}
          <div style={{
            marginTop: '24px',
            padding: '16px',
            background: 'rgba(139, 92, 246, 0.1)',
            border: '1px solid rgba(139, 92, 246, 0.2)',
            borderRadius: '12px'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ color: '#94a3b8', fontSize: '14px' }}>Clientes com potencial (Crescimento)</span>
              <span style={{ color: SEGMENTOS_CS.CRESCIMENTO.color, fontSize: '20px', fontWeight: 'bold' }}>
                {stats.total > 0 ? Math.round((stats.crescimento / stats.total) * 100) : 0}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Resumo por Status do Cliente */}
      <div style={{
        marginTop: '24px',
        background: 'rgba(30, 27, 75, 0.4)',
        border: '1px solid rgba(139, 92, 246, 0.15)',
        borderRadius: '20px',
        padding: '24px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '20px'
        }}>
          <Circle style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
          <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>
            Clientes por Ciclo de Vida
          </h2>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '16px'
        }}>
          {STATUS_OPTIONS.map(opt => {
            const count = statusStats[opt.value] || 0;
            return (
              <div
                key={opt.value}
                style={{
                  padding: '20px',
                  background: `${opt.color}10`,
                  border: `1px solid ${opt.color}30`,
                  borderRadius: '16px',
                  textAlign: 'center'
                }}
              >
                <div style={{
                  width: '48px',
                  height: '48px',
                  background: `${opt.color}20`,
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px'
                }}>
                  <span style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: opt.color
                  }}></span>
                </div>
                <p style={{ color: 'white', fontSize: '28px', fontWeight: 'bold', margin: '0 0 4px 0' }}>
                  {count}
                </p>
                <p style={{ color: opt.color, fontSize: '13px', fontWeight: '500', margin: 0 }}>
                  {opt.label}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
