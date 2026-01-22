import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Clock, ListChecks, ChevronRight, Plus, Loader2 } from 'lucide-react';
import { buscarPlaybooks } from '../services/playbooks';

export default function Playbooks() {
  const navigate = useNavigate();
  const [playbooks, setPlaybooks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

    fetchPlaybooks();
  }, []);

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
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
            Execute o script <code style={{ background: 'rgba(139, 92, 246, 0.2)', padding: '2px 8px', borderRadius: '4px' }}>populate-playbooks.js</code> para criar os playbooks iniciais
          </p>
        </div>
      )}
    </div>
  );
}
