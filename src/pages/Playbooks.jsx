import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Clock, ListChecks, ChevronRight, Plus, Loader2, Sparkles } from 'lucide-react';
import { buscarPlaybooks } from '../services/playbooks';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

// Playbooks padrão para criar
const PLAYBOOKS_PADRAO = {
  onboarding: {
    nome: "Onboarding",
    descricao: "Processo de implantação de cliente novo",
    duracao_estimada_dias: 30,
    ativo: true,
    etapas: [
      { ordem: 1, nome: "Kick-off", descricao: "Reunião inicial de alinhamento com o cliente", prazo_dias: 1, obrigatoria: true },
      { ordem: 2, nome: "Configuração inicial", descricao: "Setup da conta, upload de logo, configuração de marca", prazo_dias: 3, obrigatoria: true },
      { ordem: 3, nome: "Treinamento 1", descricao: "Treinamento básico da plataforma", prazo_dias: 7, obrigatoria: true },
      { ordem: 4, nome: "Treinamento 2", descricao: "Treinamento avançado e casos de uso específicos", prazo_dias: 14, obrigatoria: true },
      { ordem: 5, nome: "Go-live", descricao: "Cliente começa a usar em produção", prazo_dias: 21, obrigatoria: true },
      { ordem: 6, nome: "Check-in pós go-live", descricao: "Reunião de acompanhamento 1 semana após go-live", prazo_dias: 30, obrigatoria: false }
    ]
  },
  reativacao: {
    nome: "Reativação de Cliente",
    descricao: "Processo para reativar clientes inativos",
    duracao_estimada_dias: 14,
    ativo: true,
    etapas: [
      { ordem: 1, nome: "Análise de histórico", descricao: "Revisar histórico de uso e motivos da inatividade", prazo_dias: 1, obrigatoria: true },
      { ordem: 2, nome: "Contato inicial", descricao: "Ligar ou enviar email para entender a situação", prazo_dias: 2, obrigatoria: true },
      { ordem: 3, nome: "Reunião de alinhamento", descricao: "Reunião para entender necessidades e apresentar novidades", prazo_dias: 7, obrigatoria: true },
      { ordem: 4, nome: "Plano de ação", descricao: "Definir próximos passos e metas", prazo_dias: 10, obrigatoria: true },
      { ordem: 5, nome: "Acompanhamento", descricao: "Verificar se o cliente voltou a usar a plataforma", prazo_dias: 14, obrigatoria: false }
    ]
  },
  qbr: {
    nome: "QBR (Quarterly Business Review)",
    descricao: "Revisão trimestral de resultados com o cliente",
    duracao_estimada_dias: 7,
    ativo: true,
    etapas: [
      { ordem: 1, nome: "Coleta de dados", descricao: "Reunir métricas de uso, NPS e resultados do período", prazo_dias: 2, obrigatoria: true },
      { ordem: 2, nome: "Preparar apresentação", descricao: "Criar apresentação com análise de resultados e recomendações", prazo_dias: 4, obrigatoria: true },
      { ordem: 3, nome: "Reunião de QBR", descricao: "Apresentar resultados e alinhar próximos passos", prazo_dias: 6, obrigatoria: true },
      { ordem: 4, nome: "Documentar ação", descricao: "Registrar decisões e criar tarefas de follow-up", prazo_dias: 7, obrigatoria: false }
    ]
  }
};

export default function Playbooks() {
  const navigate = useNavigate();
  const [playbooks, setPlaybooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [criando, setCriando] = useState(false);

  const fetchPlaybooks = async () => {
    try {
      const data = await buscarPlaybooks();
      setPlaybooks(data);
    } catch (error) {
      console.error('Erro ao buscar playbooks:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlaybooks();
  }, []);

  const criarPlaybooksPadrao = async () => {
    setCriando(true);
    try {
      for (const [id, data] of Object.entries(PLAYBOOKS_PADRAO)) {
        await setDoc(doc(db, 'playbooks', id), {
          ...data,
          created_at: Timestamp.now(),
          updated_at: Timestamp.now()
        });
      }
      // Recarregar lista
      await fetchPlaybooks();
      alert('Playbooks criados com sucesso!');
    } catch (error) {
      console.error('Erro ao criar playbooks:', error);
      alert(`Erro ao criar playbooks: ${error.message}`);
    } finally {
      setCriando(false);
    }
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: 'white', margin: 0 }}>Playbooks</h1>
            <span style={{
              padding: '4px 12px',
              background: 'rgba(139, 92, 246, 0.2)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '20px',
              color: '#a78bfa',
              fontSize: '12px',
              fontWeight: '600'
            }}>
              {playbooks.length} disponíve{playbooks.length === 1 ? 'l' : 'is'}
            </span>
          </div>
          <p style={{ color: '#94a3b8', margin: 0 }}>
            Checklists padronizados para processos de Customer Success
          </p>
        </div>
        <button
          onClick={() => {/* TODO: Criar novo playbook */}}
          disabled
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 20px',
            background: 'rgba(139, 92, 246, 0.3)',
            border: 'none',
            borderRadius: '12px',
            color: '#94a3b8',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'not-allowed',
            opacity: 0.6
          }}
          title="Em breve"
        >
          <Plus style={{ width: '18px', height: '18px' }} />
          Novo Playbook
        </button>
      </div>

      {/* Grid de Playbooks */}
      {playbooks.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
          {playbooks.map(playbook => (
            <div
              key={playbook.id}
              onClick={() => navigate(`/playbooks/${playbook.id}`)}
              style={{
                background: 'rgba(30, 27, 75, 0.4)',
                border: '1px solid rgba(139, 92, 246, 0.15)',
                borderRadius: '16px',
                padding: '24px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.border = '1px solid rgba(139, 92, 246, 0.4)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.border = '1px solid rgba(139, 92, 246, 0.15)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {/* Ícone e Título */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '16px' }}>
                <div style={{
                  width: '52px',
                  height: '52px',
                  background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(6, 182, 212, 0.2) 100%)',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  borderRadius: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <ClipboardList style={{ width: '26px', height: '26px', color: '#8b5cf6' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: '0 0 6px 0' }}>
                    {playbook.nome}
                  </h3>
                  <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0, lineHeight: 1.5 }}>
                    {playbook.descricao}
                  </p>
                </div>
              </div>

              {/* Badges */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <span style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  background: 'rgba(6, 182, 212, 0.1)',
                  border: '1px solid rgba(6, 182, 212, 0.2)',
                  borderRadius: '20px',
                  color: '#06b6d4',
                  fontSize: '12px',
                  fontWeight: '500'
                }}>
                  <ListChecks style={{ width: '14px', height: '14px' }} />
                  {playbook.etapas?.length || 0} etapas
                </span>
                <span style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  background: 'rgba(249, 115, 22, 0.1)',
                  border: '1px solid rgba(249, 115, 22, 0.2)',
                  borderRadius: '20px',
                  color: '#f97316',
                  fontSize: '12px',
                  fontWeight: '500'
                }}>
                  <Clock style={{ width: '14px', height: '14px' }} />
                  {playbook.duracao_estimada_dias} dias
                </span>
              </div>

              {/* Botão Ver Detalhes */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: 'rgba(139, 92, 246, 0.1)',
                border: '1px solid rgba(139, 92, 246, 0.2)',
                borderRadius: '12px'
              }}>
                <span style={{ color: '#a78bfa', fontSize: '14px', fontWeight: '500' }}>Ver Detalhes</span>
                <ChevronRight style={{ width: '18px', height: '18px', color: '#a78bfa' }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          padding: '80px',
          textAlign: 'center',
          background: 'rgba(30, 27, 75, 0.4)',
          borderRadius: '20px',
          border: '1px solid rgba(139, 92, 246, 0.15)'
        }}>
          <ClipboardList style={{ width: '64px', height: '64px', color: '#64748b', margin: '0 auto 24px' }} />
          <p style={{ color: '#94a3b8', fontSize: '18px', margin: '0 0 12px 0', fontWeight: '500' }}>
            Nenhum playbook disponível
          </p>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 24px 0' }}>
            Crie os playbooks padrão para começar a usar o sistema
          </p>
          <button
            onClick={criarPlaybooksPadrao}
            disabled={criando}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              padding: '14px 28px',
              background: criando ? 'rgba(139, 92, 246, 0.4)' : 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              fontSize: '15px',
              fontWeight: '600',
              cursor: criando ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 16px rgba(139, 92, 246, 0.3)'
            }}
          >
            {criando ? (
              <>
                <Loader2 style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} />
                Criando...
              </>
            ) : (
              <>
                <Sparkles style={{ width: '18px', height: '18px' }} />
                Criar Playbooks Padrão
              </>
            )}
          </button>
          <p style={{ color: '#64748b', fontSize: '12px', marginTop: '16px' }}>
            Onboarding, Reativação e QBR
          </p>
        </div>
      )}
    </div>
  );
}
