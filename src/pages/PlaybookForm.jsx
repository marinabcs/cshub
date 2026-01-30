import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ClipboardList, Plus, Trash2, Save, Loader2, AlertTriangle, FileText, Link2, X } from 'lucide-react';
import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

export default function PlaybookForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Campos do formulário
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [duracaoEstimada, setDuracaoEstimada] = useState(30);
  const [ativo, setAtivo] = useState(true);
  const [etapas, setEtapas] = useState([
    { ordem: 1, nome: '', descricao: '', prazo_dias: 1, obrigatoria: true, documentos: [] }
  ]);

  useEffect(() => {
    if (isEditing) {
      fetchPlaybook();
    }
  }, [id]);

  const fetchPlaybook = async () => {
    try {
      const docRef = doc(db, 'playbooks', id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setNome(data.nome || '');
        setDescricao(data.descricao || '');
        setDuracaoEstimada(data.duracao_estimada_dias || 30);
        setAtivo(data.ativo !== false);
        setEtapas(data.etapas || []);
      } else {
        setError('Playbook não encontrado');
      }
    } catch (err) {
      console.error('Erro ao buscar playbook:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const adicionarEtapa = () => {
    const novaOrdem = etapas.length + 1;
    setEtapas([
      ...etapas,
      { ordem: novaOrdem, nome: '', descricao: '', prazo_dias: novaOrdem * 7, obrigatoria: false, documentos: [] }
    ]);
  };

  // Funções para gerenciar documentos da etapa
  const adicionarDocumento = (etapaIndex) => {
    const novasEtapas = [...etapas];
    const documentos = novasEtapas[etapaIndex].documentos || [];
    novasEtapas[etapaIndex].documentos = [...documentos, { nome: '', url: '' }];
    setEtapas(novasEtapas);
  };

  const atualizarDocumento = (etapaIndex, docIndex, campo, valor) => {
    const novasEtapas = [...etapas];
    novasEtapas[etapaIndex].documentos[docIndex][campo] = valor;
    setEtapas(novasEtapas);
  };

  const removerDocumento = (etapaIndex, docIndex) => {
    const novasEtapas = [...etapas];
    novasEtapas[etapaIndex].documentos = novasEtapas[etapaIndex].documentos.filter((_, i) => i !== docIndex);
    setEtapas(novasEtapas);
  };

  const removerEtapa = (index) => {
    if (etapas.length <= 1) return;
    const novasEtapas = etapas.filter((_, i) => i !== index);
    // Reordenar
    const reordenadas = novasEtapas.map((etapa, i) => ({ ...etapa, ordem: i + 1 }));
    setEtapas(reordenadas);
  };

  const atualizarEtapa = (index, campo, valor) => {
    const novasEtapas = [...etapas];
    novasEtapas[index] = { ...novasEtapas[index], [campo]: valor };
    setEtapas(novasEtapas);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validações
    if (!nome.trim()) {
      alert('Nome do playbook é obrigatório');
      return;
    }

    if (etapas.some(e => !e.nome.trim())) {
      alert('Todas as etapas devem ter um nome');
      return;
    }

    setSaving(true);

    try {
      const playbookData = {
        nome: nome.trim(),
        descricao: descricao.trim(),
        duracao_estimada_dias: parseInt(duracaoEstimada) || 30,
        ativo,
        etapas: etapas.map((etapa, index) => ({
          ordem: index + 1,
          nome: etapa.nome.trim(),
          descricao: etapa.descricao?.trim() || '',
          prazo_dias: parseInt(etapa.prazo_dias) || 1,
          obrigatoria: Boolean(etapa.obrigatoria),
          documentos: (etapa.documentos || [])
            .filter(doc => doc.nome?.trim() && doc.url?.trim())
            .map(doc => ({ nome: doc.nome.trim(), url: doc.url.trim() }))
        })),
        updated_at: Timestamp.now()
      };

      if (isEditing) {
        await updateDoc(doc(db, 'playbooks', id), playbookData);
      } else {
        // Gerar ID baseado no nome
        const novoId = nome.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
        playbookData.created_at = Timestamp.now();
        await setDoc(doc(db, 'playbooks', novoId), playbookData);
      }

      navigate('/playbooks');
    } catch (err) {
      console.error('Erro ao salvar playbook:', err);
      alert(`Erro ao salvar: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f0a1f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: '48px', height: '48px', border: '3px solid rgba(139, 92, 246, 0.2)', borderTopColor: '#8b5cf6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f0a1f', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
        <AlertTriangle style={{ width: '48px', height: '48px', color: '#f59e0b' }} />
        <p style={{ color: '#94a3b8', fontSize: '16px' }}>{error}</p>
        <button onClick={() => navigate('/playbooks')} style={{ padding: '12px 24px', background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)', border: 'none', borderRadius: '12px', color: 'white', cursor: 'pointer' }}>Voltar para Playbooks</button>
      </div>
    );
  }

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
              {isEditing ? 'Editar Playbook' : 'Novo Playbook'}
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '16px', margin: 0 }}>
              {isEditing ? 'Atualize as informações do playbook' : 'Crie um novo checklist padronizado'}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Informações Básicas */}
        <div style={{
          background: 'rgba(30, 27, 75, 0.4)',
          border: '1px solid rgba(139, 92, 246, 0.15)',
          borderRadius: '20px',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: '0 0 20px 0' }}>
            Informações Básicas
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '8px', fontWeight: '500' }}>
                Nome do Playbook *
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Onboarding, Reativação, QBR..."
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

            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '8px', fontWeight: '500' }}>
                Duração Estimada (dias)
              </label>
              <input
                type="number"
                value={duracaoEstimada}
                onChange={(e) => setDuracaoEstimada(e.target.value)}
                min="1"
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

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '13px', marginBottom: '8px', fontWeight: '500' }}>
                Descrição
              </label>
              <textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descreva o objetivo deste playbook..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: '#0f0a1f',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  borderRadius: '12px',
                  color: 'white',
                  fontSize: '14px',
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#8b5cf6' }}
                />
                <span style={{ color: '#94a3b8', fontSize: '14px' }}>Playbook ativo</span>
              </label>
            </div>
          </div>
        </div>

        {/* Etapas */}
        <div style={{
          background: 'rgba(30, 27, 75, 0.4)',
          border: '1px solid rgba(139, 92, 246, 0.15)',
          borderRadius: '20px',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>
              Etapas ({etapas.length})
            </h2>
            <button
              type="button"
              onClick={adicionarEtapa}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                background: 'rgba(139, 92, 246, 0.2)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '10px',
                color: '#a78bfa',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              <Plus style={{ width: '16px', height: '16px' }} />
              Adicionar Etapa
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {etapas.map((etapa, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '20px',
                  background: 'rgba(15, 10, 31, 0.6)',
                  border: '1px solid rgba(139, 92, 246, 0.1)',
                  borderRadius: '14px'
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
                  {index + 1}
                </div>

                {/* Campos da etapa */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '12px' }}>
                    <input
                      type="text"
                      value={etapa.nome}
                      onChange={(e) => atualizarEtapa(index, 'nome', e.target.value)}
                      placeholder="Nome da etapa *"
                      style={{
                        padding: '12px 14px',
                        background: '#0f0a1f',
                        border: '1px solid rgba(139, 92, 246, 0.2)',
                        borderRadius: '10px',
                        color: 'white',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#64748b', fontSize: '13px' }}>D+</span>
                      <input
                        type="number"
                        value={etapa.prazo_dias}
                        onChange={(e) => atualizarEtapa(index, 'prazo_dias', e.target.value)}
                        min="1"
                        style={{
                          flex: 1,
                          padding: '12px 14px',
                          background: '#0f0a1f',
                          border: '1px solid rgba(139, 92, 246, 0.2)',
                          borderRadius: '10px',
                          color: 'white',
                          fontSize: '14px',
                          outline: 'none'
                        }}
                      />
                    </div>
                  </div>

                  <input
                    type="text"
                    value={etapa.descricao}
                    onChange={(e) => atualizarEtapa(index, 'descricao', e.target.value)}
                    placeholder="Descrição da etapa (opcional)"
                    style={{
                      padding: '12px 14px',
                      background: '#0f0a1f',
                      border: '1px solid rgba(139, 92, 246, 0.2)',
                      borderRadius: '10px',
                      color: 'white',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={etapa.obrigatoria}
                      onChange={(e) => atualizarEtapa(index, 'obrigatoria', e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: '#10b981' }}
                    />
                    <span style={{ color: '#94a3b8', fontSize: '13px' }}>Etapa obrigatória</span>
                  </label>

                  {/* Documentos da etapa */}
                  <div style={{
                    marginTop: '8px',
                    padding: '12px',
                    background: 'rgba(139, 92, 246, 0.05)',
                    border: '1px solid rgba(139, 92, 246, 0.1)',
                    borderRadius: '10px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FileText style={{ width: '14px', height: '14px', color: '#8b5cf6' }} />
                        <span style={{ color: '#a78bfa', fontSize: '12px', fontWeight: '500' }}>
                          Documentos ({(etapa.documentos || []).length})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => adicionarDocumento(index)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 10px',
                          background: 'rgba(139, 92, 246, 0.15)',
                          border: '1px solid rgba(139, 92, 246, 0.2)',
                          borderRadius: '6px',
                          color: '#a78bfa',
                          fontSize: '11px',
                          cursor: 'pointer'
                        }}
                      >
                        <Plus style={{ width: '12px', height: '12px' }} />
                        Adicionar
                      </button>
                    </div>

                    {(etapa.documentos || []).length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {(etapa.documentos || []).map((doc, docIndex) => (
                          <div key={docIndex} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <input
                              type="text"
                              value={doc.nome}
                              onChange={(e) => atualizarDocumento(index, docIndex, 'nome', e.target.value)}
                              placeholder="Nome do documento"
                              style={{
                                flex: '0 0 180px',
                                padding: '8px 10px',
                                background: '#0f0a1f',
                                border: '1px solid rgba(139, 92, 246, 0.15)',
                                borderRadius: '8px',
                                color: 'white',
                                fontSize: '12px',
                                outline: 'none'
                              }}
                            />
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Link2 style={{ width: '14px', height: '14px', color: '#64748b', flexShrink: 0 }} />
                              <input
                                type="url"
                                value={doc.url}
                                onChange={(e) => atualizarDocumento(index, docIndex, 'url', e.target.value)}
                                placeholder="https://..."
                                style={{
                                  flex: 1,
                                  padding: '8px 10px',
                                  background: '#0f0a1f',
                                  border: '1px solid rgba(139, 92, 246, 0.15)',
                                  borderRadius: '8px',
                                  color: 'white',
                                  fontSize: '12px',
                                  outline: 'none'
                                }}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removerDocumento(index, docIndex)}
                              style={{
                                width: '28px',
                                height: '28px',
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                borderRadius: '6px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                flexShrink: 0
                              }}
                            >
                              <X style={{ width: '12px', height: '12px', color: '#ef4444' }} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {(etapa.documentos || []).length === 0 && (
                      <p style={{ color: '#64748b', fontSize: '11px', margin: 0, textAlign: 'center' }}>
                        Nenhum documento adicionado
                      </p>
                    )}
                  </div>
                </div>

                {/* Botão remover */}
                <button
                  type="button"
                  onClick={() => removerEtapa(index)}
                  disabled={etapas.length <= 1}
                  style={{
                    width: '36px',
                    height: '36px',
                    background: etapas.length <= 1 ? 'rgba(100, 116, 139, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    border: etapas.length <= 1 ? '1px solid rgba(100, 116, 139, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: etapas.length <= 1 ? 'not-allowed' : 'pointer',
                    flexShrink: 0
                  }}
                  title={etapas.length <= 1 ? 'Mínimo 1 etapa' : 'Remover etapa'}
                >
                  <Trash2 style={{ width: '16px', height: '16px', color: etapas.length <= 1 ? '#64748b' : '#ef4444' }} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Botões de ação */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            type="button"
            onClick={() => navigate('/playbooks')}
            style={{
              padding: '14px 28px',
              background: 'transparent',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '12px',
              color: '#94a3b8',
              fontSize: '15px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '14px 28px',
              background: saving ? 'rgba(139, 92, 246, 0.4)' : 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              fontSize: '15px',
              fontWeight: '600',
              cursor: saving ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 16px rgba(139, 92, 246, 0.3)'
            }}
          >
            {saving ? (
              <>
                <Loader2 style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} />
                Salvando...
              </>
            ) : (
              <>
                <Save style={{ width: '18px', height: '18px' }} />
                {isEditing ? 'Salvar Alterações' : 'Criar Playbook'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
