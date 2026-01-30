import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Clock, ListChecks, ChevronRight, Plus, Loader2, Sparkles, Search } from 'lucide-react';
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

// Função para normalizar texto (remove acentos)
const normalizeText = (text) => {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

export default function Playbooks() {
  const navigate = useNavigate();
  const [playbooks, setPlaybooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [criando, setCriando] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Filtrar e ordenar playbooks
  const filteredPlaybooks = useMemo(() => {
    let result = [...playbooks];

    // Filtrar por busca
    if (searchTerm) {
      const searchNormalized = normalizeText(searchTerm);
      result = result.filter(p =>
        normalizeText(p.nome).includes(searchNormalized) ||
        normalizeText(p.descricao).includes(searchNormalized)
      );
    }

    // Ordenar: ativos primeiro (alfabético), depois inativos (alfabético)
    result.sort((a, b) => {
      // Primeiro por status (ativos primeiro)
      const aAtivo = a.ativo !== false;
      const bAtivo = b.ativo !== false;

      if (aAtivo && !bAtivo) return -1; // a ativo, b inativo -> a vem primeiro
      if (!aAtivo && bAtivo) return 1;  // a inativo, b ativo -> b vem primeiro

      // Depois por nome (alfabético crescente)
      return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
    });

    return result;
  }, [playbooks, searchTerm]);

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
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
          onClick={() => navigate('/playbooks/novo')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 20px',
            background: 'linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)',
            border: 'none',
            borderRadius: '12px',
            color: 'white',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          <Plus style={{ width: '18px', height: '18px' }} />
          Novo Playbook
        </button>
      </div>

      {/* Busca */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ position: 'relative', maxWidth: '400px' }}>
          <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: '#64748b' }} />
          <input
            type="text"
            placeholder="Buscar playbook..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 14px 12px 44px',
              background: 'rgba(30, 27, 75, 0.4)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              borderRadius: '12px',
              color: 'white',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>

      {/* Grid de Playbooks */}
      {filteredPlaybooks.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
          {filteredPlaybooks.map(playbook => {
            const isInativo = playbook.ativo === false;
            return (
            <div
              key={playbook.id}
              onClick={() => navigate(`/playbooks/${playbook.id}`)}
              style={{
                background: isInativo ? 'rgba(55, 65, 81, 0.3)' : 'rgba(30, 27, 75, 0.4)',
                border: isInativo ? '1px solid rgba(107, 114, 128, 0.2)' : '1px solid rgba(139, 92, 246, 0.15)',
                borderRadius: '16px',
                padding: '24px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                opacity: isInativo ? 0.7 : 1
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.border = isInativo ? '1px solid rgba(107, 114, 128, 0.4)' : '1px solid rgba(139, 92, 246, 0.4)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.border = isInativo ? '1px solid rgba(107, 114, 128, 0.2)' : '1px solid rgba(139, 92, 246, 0.15)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {/* Ícone e Título */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '16px' }}>
                <div style={{
                  width: '52px',
                  height: '52px',
                  background: isInativo ? 'rgba(107, 114, 128, 0.3)' : 'linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(6, 182, 212, 0.2) 100%)',
                  border: isInativo ? '1px solid rgba(107, 114, 128, 0.3)' : '1px solid rgba(139, 92, 246, 0.3)',
                  borderRadius: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <ClipboardList style={{ width: '26px', height: '26px', color: isInativo ? '#9ca3af' : '#8b5cf6' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <h3 style={{ color: isInativo ? '#9ca3af' : 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>
                      {playbook.nome}
                    </h3>
                    {isInativo && (
                      <span style={{
                        padding: '2px 8px',
                        background: 'rgba(107, 114, 128, 0.2)',
                        borderRadius: '6px',
                        color: '#9ca3af',
                        fontSize: '10px',
                        fontWeight: '500'
                      }}>
                        Inativo
                      </span>
                    )}
                  </div>
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
                  background: isInativo ? 'rgba(107, 114, 128, 0.1)' : 'rgba(6, 182, 212, 0.1)',
                  border: isInativo ? '1px solid rgba(107, 114, 128, 0.2)' : '1px solid rgba(6, 182, 212, 0.2)',
                  borderRadius: '20px',
                  color: isInativo ? '#9ca3af' : '#06b6d4',
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
                  background: isInativo ? 'rgba(107, 114, 128, 0.1)' : 'rgba(249, 115, 22, 0.1)',
                  border: isInativo ? '1px solid rgba(107, 114, 128, 0.2)' : '1px solid rgba(249, 115, 22, 0.2)',
                  borderRadius: '20px',
                  color: isInativo ? '#9ca3af' : '#f97316',
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
                background: isInativo ? 'rgba(107, 114, 128, 0.1)' : 'rgba(139, 92, 246, 0.1)',
                border: isInativo ? '1px solid rgba(107, 114, 128, 0.2)' : '1px solid rgba(139, 92, 246, 0.2)',
                borderRadius: '12px'
              }}>
                <span style={{ color: isInativo ? '#9ca3af' : '#a78bfa', fontSize: '14px', fontWeight: '500' }}>Ver Detalhes</span>
                <ChevronRight style={{ width: '18px', height: '18px', color: isInativo ? '#9ca3af' : '#a78bfa' }} />
              </div>
            </div>
          )})}
        </div>
      ) : playbooks.length > 0 ? (
        <div style={{
          padding: '48px',
          textAlign: 'center',
          background: 'rgba(30, 27, 75, 0.4)',
          borderRadius: '20px',
          border: '1px solid rgba(139, 92, 246, 0.15)'
        }}>
          <Search style={{ width: '48px', height: '48px', color: '#64748b', margin: '0 auto 16px' }} />
          <p style={{ color: '#94a3b8', fontSize: '16px', margin: 0 }}>
            Nenhum playbook encontrado para "{searchTerm}"
          </p>
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
