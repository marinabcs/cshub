import { useState, useEffect } from 'react';
import { MessageSquare, Plus, Search, AlertTriangle, Calendar, Clock, Users, Pencil, Trash2, CheckCircle2, RotateCcw, Video, FileText, ChevronDown, Sparkles, Loader2, X } from 'lucide-react';
import { doc, addDoc, updateDoc, deleteDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { getCategoriaInfo, getSentimentoInfo } from '../../services/openai';
import { validateForm } from '../../validation';
import { observacaoSchema } from '../../validation/documento';
import { ErrorMessage } from '../UI/ErrorMessage';
import { summarizeTranscription, validateTranscriptionText, parseResumoIA, getSentimentoColor, getSentimentoLabel, TRANSCRIPTION_STATUS } from '../../services/transcription';
import { TIPOS_INTERACAO, TAGS_OBSERVACAO, SAUDE_COLORS } from './constants';

/**
 * Tab Interacoes - Unified timeline: threads + interacoes manuais + observacoes + alertas.
 * Includes forms for adding new observations and interactions, and inline transcription support.
 */
export default function TabInteracoes({
  clienteId,
  cliente: _cliente,
  threads,
  interacoes,
  setInteracoes,
  observacoes,
  setObservacoes,
  alertasCliente,
  onThreadClick,
  onAlertaClick,
  fetchObservacoes,
  fetchInteracoes,
  setCliente
}) {
  const [showInteracaoForm, setShowInteracaoForm] = useState(false);
  const [interacaoForm, setInteracaoForm] = useState({ tipo: 'feedback', data: '', participantes: '', notas: '', duracao: '', link_gravacao: '' });
  const [savingInteracao, setSavingInteracao] = useState(false);
  const [editingInteracaoId, setEditingInteracaoId] = useState(null);
  const [filterInteracaoTexto, setFilterInteracaoTexto] = useState('');
  const [filterInteracaoTipo, setFilterInteracaoTipo] = useState('');
  const [hideInformativos, setHideInformativos] = useState(true);

  // Observacoes form
  const [showObsForm, setShowObsForm] = useState(false);
  const [obsTexto, setObsTexto] = useState('');
  const [obsTags, setObsTags] = useState([]);
  const [savingObs, setSavingObs] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // Transcricao de reuniao
  const [transcricaoTexto, setTranscricaoTexto] = useState('');
  const [linkTranscricao, setLinkTranscricao] = useState('');
  const [transcribing, setTranscribing] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState('');
  const [expandedTranscricao, setExpandedTranscricao] = useState({});

  // Load data on mount
  useEffect(() => {
    if (observacoes.length === 0) fetchObservacoes();
    if (interacoes.length === 0) fetchInteracoes();
  }, []);

  // Salvar nova observacao
  const handleSaveObs = async () => {
    setFormErrors({});
    const validationErrors = validateForm(observacaoSchema, { texto: obsTexto.trim() });
    if (validationErrors) {
      setFormErrors(validationErrors);
      return;
    }
    setSavingObs(true);
    try {
      await addDoc(collection(db, 'observacoes_cs'), {
        cliente_id: clienteId,
        texto: obsTexto.trim(),
        tags: obsTags,
        status: 'ativa',
        criado_por: 'CS',
        criado_em: Timestamp.now(),
        resolvido_em: null,
        updated_at: Timestamp.now()
      });
      setObsTexto('');
      setObsTags([]);
      setShowObsForm(false);
      fetchObservacoes();
    } catch (error) {
      console.error('Erro ao salvar observação:', error);
      alert('Erro ao salvar observação');
    } finally {
      setSavingObs(false);
    }
  };

  // Toggle status da observacao (ativa <-> resolvida)
  const handleToggleObsStatus = async (obs) => {
    const novoStatus = obs.status === 'ativa' ? 'resolvida' : 'ativa';
    try {
      await updateDoc(doc(db, 'observacoes_cs', obs.id), {
        status: novoStatus,
        resolvido_em: novoStatus === 'resolvida' ? Timestamp.now() : null,
        updated_at: Timestamp.now()
      });
      setObservacoes(prev => prev.map(o =>
        o.id === obs.id ? { ...o, status: novoStatus } : o
      ));
    } catch (error) {
      console.error('Erro ao atualizar observação:', error);
    }
  };

  // Excluir observacao
  const handleDeleteObs = async (obs) => {
    if (!confirm('Excluir esta observação?')) return;
    try {
      await deleteDoc(doc(db, 'observacoes_cs', obs.id));
      setObservacoes(prev => prev.filter(o => o.id !== obs.id));
    } catch (error) {
      console.error('Erro ao excluir observação:', error);
    }
  };

  // Salvar interacao
  const handleSaveInteracao = async () => {
    if (!interacaoForm.tipo || !interacaoForm.data) return;
    setSavingInteracao(true);
    setTranscriptionError('');

    if (transcricaoTexto.trim()) {
      const validationError = validateTranscriptionText(transcricaoTexto);
      if (validationError) {
        setTranscriptionError(validationError);
        setSavingInteracao(false);
        return;
      }
    }

    try {
      const docData = {
        cliente_id: clienteId,
        tipo: interacaoForm.tipo,
        data_interacao: Timestamp.fromDate(new Date(interacaoForm.data + 'T12:00:00')),
        participantes: interacaoForm.participantes.trim(),
        notas: interacaoForm.notas.trim(),
        duracao: parseInt(interacaoForm.duracao, 10) || 0,
        link_gravacao: interacaoForm.link_gravacao.trim(),
        updated_at: Timestamp.now()
      };

      if (transcricaoTexto.trim() && interacaoForm.tipo === 'reuniao') {
        docData.transcricao_status = TRANSCRIPTION_STATUS.PENDING;
        docData.link_transcricao = linkTranscricao.trim() || null;
      }

      let interacaoDocId = editingInteracaoId;

      if (editingInteracaoId) {
        await updateDoc(doc(db, 'interacoes', editingInteracaoId), docData);
      } else {
        docData.created_at = Timestamp.now();
        docData.created_by = 'CS';
        const newDoc = await addDoc(collection(db, 'interacoes'), docData);
        interacaoDocId = newDoc.id;
      }

      // Atualizar ultima_interacao no cliente
      await updateDoc(doc(db, 'clientes', clienteId), {
        ultima_interacao_data: docData.data_interacao,
        ultima_interacao_tipo: docData.tipo
      });
      setCliente(prev => ({ ...prev, ultima_interacao_data: docData.data_interacao, ultima_interacao_tipo: docData.tipo }));

      // Se tem transcricao, gerar resumo em background
      if (transcricaoTexto.trim() && interacaoDocId && interacaoForm.tipo === 'reuniao') {
        setTranscribing(true);
        setShowInteracaoForm(false);
        fetchInteracoes();

        const result = await summarizeTranscription(transcricaoTexto.trim(), linkTranscricao.trim(), interacaoDocId, clienteId);
        if (!result.success) {
          setTranscriptionError(result.error || 'Erro ao gerar resumo');
        }

        setTranscribing(false);
        setTranscricaoTexto('');
        setLinkTranscricao('');
        fetchInteracoes();
      } else {
        setShowInteracaoForm(false);
        fetchInteracoes();
      }

      setInteracaoForm({ tipo: 'feedback', data: '', participantes: '', notas: '', duracao: '', link_gravacao: '' });
      setEditingInteracaoId(null);
      setTranscricaoTexto('');
      setLinkTranscricao('');
    } catch (error) {
      console.error('Erro ao salvar interação:', error);
    } finally {
      setSavingInteracao(false);
    }
  };

  const handleEditInteracao = (inter) => {
    const dataStr = inter.data_interacao?.toDate
      ? inter.data_interacao.toDate().toISOString().split('T')[0]
      : '';
    setInteracaoForm({
      tipo: inter.tipo,
      data: dataStr,
      participantes: inter.participantes || '',
      notas: inter.notas || '',
      duracao: inter.duracao ? String(inter.duracao) : '',
      link_gravacao: inter.link_gravacao || ''
    });
    setEditingInteracaoId(inter.id);
    setShowInteracaoForm(true);
  };

  const handleDeleteInteracao = async (interId) => {
    if (!confirm('Excluir esta interação?')) return;
    try {
      await deleteDoc(doc(db, 'interacoes', interId));
      setInteracoes(prev => prev.filter(i => i.id !== interId));
    } catch (error) {
      console.error('Erro ao excluir interação:', error);
    }
  };

  // Build unified timeline
  const timelineItems = [
    ...threads.map(t => {
      const dataOriginal = t.data_ultima_mensagem || t.ultima_msg_cliente || t.ultima_msg_equipe || t.data_inicio || t.updated_at;
      const d = dataOriginal?.toDate ? dataOriginal.toDate() : (dataOriginal ? new Date(dataOriginal) : new Date(0));
      return { _source: 'thread', _date: d, _tipo: 'email', ...t };
    }),
    ...interacoes.map(i => {
      const dateField = i.data_interacao || i.data;
      const d = dateField?.toDate ? dateField.toDate() : new Date(dateField || 0);
      return { _source: 'interacao', _date: d, _tipo: i.tipo || 'outro', ...i };
    }),
    ...observacoes.map(o => {
      const d = o.criado_em?.toDate ? o.criado_em.toDate() : new Date(o.criado_em || 0);
      return { _source: 'observacao', _date: d, _tipo: 'observacao', ...o };
    }),
    ...alertasCliente.map(a => {
      const d = a.created_at?.toDate ? a.created_at.toDate() : (a.created_at ? new Date(a.created_at) : new Date(0));
      return { _source: 'alerta', _date: d, _tipo: 'alerta', ...a };
    })
  ];

  // Filtrar informativos
  const filteredByInformativo = hideInformativos
    ? timelineItems.filter(item => item._source !== 'thread' || item.requer_acao !== false)
    : timelineItems;

  // Filtrar por tipo
  const filteredByTipo = filterInteracaoTipo
    ? filteredByInformativo.filter(item => item._tipo === filterInteracaoTipo)
    : filteredByInformativo;

  // Filtrar por texto
  const searchLower = filterInteracaoTexto.toLowerCase();
  const filteredItems = searchLower
    ? filteredByTipo.filter(item => {
        if (item._source === 'thread') {
          return (item.assunto || item.subject || '').toLowerCase().includes(searchLower) ||
            (item.snippet || '').toLowerCase().includes(searchLower) ||
            (item.remetente_nome || item.sender_name || '').toLowerCase().includes(searchLower);
        }
        if (item._source === 'observacao') {
          return (item.texto || '').toLowerCase().includes(searchLower);
        }
        if (item._source === 'alerta') {
          return (item.titulo || '').toLowerCase().includes(searchLower) ||
            (item.mensagem || '').toLowerCase().includes(searchLower);
        }
        return (item.notas || '').toLowerCase().includes(searchLower) ||
          (item.participantes || '').toLowerCase().includes(searchLower);
      })
    : filteredByTipo;

  const sortedItems = [...filteredItems].sort((a, b) => b._date - a._date);
  const totalCount = threads.length + interacoes.length + observacoes.length + alertasCliente.length;

  return (
    <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '20px', padding: '24px', marginBottom: '32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <MessageSquare style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
          <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>Timeline</h2>
          <span style={{ padding: '4px 12px', background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa', borderRadius: '20px', fontSize: '13px', fontWeight: '500' }}>
            {sortedItems.length}{sortedItems.length !== totalCount ? ` / ${totalCount}` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => { setShowObsForm(true); setObsTexto(''); }}
            style={{ padding: '8px 14px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px', color: '#10b981', fontSize: '13px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus style={{ width: '16px', height: '16px' }} />
            Observação
          </button>
          <button
            onClick={() => { setShowInteracaoForm(!showInteracaoForm); setEditingInteracaoId(null); setInteracaoForm({ tipo: 'feedback', data: '', participantes: '', notas: '', duracao: '', link_gravacao: '' }); }}
            style={{ padding: '8px 14px', background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)', border: 'none', borderRadius: '10px', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus style={{ width: '16px', height: '16px' }} />
            Interação
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#64748b' }} />
          <input
            type="text"
            value={filterInteracaoTexto}
            onChange={e => setFilterInteracaoTexto(e.target.value)}
            placeholder="Buscar na timeline..."
            style={{ width: '100%', padding: '10px 12px 10px 36px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: 'white', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <select
          value={filterInteracaoTipo}
          onChange={e => setFilterInteracaoTipo(e.target.value)}
          style={{ padding: '10px 14px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: filterInteracaoTipo ? 'white' : '#64748b', fontSize: '13px', outline: 'none', cursor: 'pointer', minWidth: '150px' }}
        >
          <option value="">Todos os tipos</option>
          {TIPOS_INTERACAO.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: hideInformativos ? 'rgba(139, 92, 246, 0.15)' : 'rgba(15, 10, 31, 0.6)', border: '1px solid', borderColor: hideInformativos ? 'rgba(139, 92, 246, 0.3)' : '#3730a3', borderRadius: '10px', cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={hideInformativos}
            onChange={e => setHideInformativos(e.target.checked)}
            style={{ width: '16px', height: '16px', accentColor: '#8b5cf6', cursor: 'pointer' }}
          />
          <span style={{ color: hideInformativos ? '#a78bfa' : '#64748b', fontSize: '13px', whiteSpace: 'nowrap' }}>Esconder informativos</span>
        </label>
      </div>

      {/* Banner de resumo em andamento */}
      {transcribing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.25)', borderRadius: '12px', marginBottom: '16px' }}>
          <Loader2 style={{ width: '20px', height: '20px', color: '#8b5cf6', animation: 'spin 1s linear infinite' }} />
          <div>
            <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: 0 }}>Gerando resumo com IA...</p>
            <p style={{ color: '#94a3b8', fontSize: '12px', margin: '2px 0 0 0' }}>Isso pode levar alguns segundos. A página será atualizada automaticamente.</p>
          </div>
        </div>
      )}

      {/* Erro de transcricao */}
      {transcriptionError && !transcribing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '12px', marginBottom: '16px' }}>
          <AlertTriangle style={{ width: '20px', height: '20px', color: '#ef4444', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <p style={{ color: '#ef4444', fontSize: '14px', fontWeight: '500', margin: 0 }}>Erro no resumo</p>
            <p style={{ color: '#94a3b8', fontSize: '12px', margin: '2px 0 0 0' }}>{transcriptionError}</p>
          </div>
          <button
            onClick={() => setTranscriptionError('')}
            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '4px' }}
          >
            <X style={{ width: '16px', height: '16px' }} />
          </button>
        </div>
      )}

      {/* Formulario de Nova Observacao */}
      {showObsForm && (
        <div style={{ background: 'rgba(15, 10, 31, 0.6)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <span style={{ padding: '2px 8px', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', borderRadius: '6px', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>Observação</span>
            <span style={{ color: '#64748b', fontSize: '12px' }}>Nota qualitativa do CS</span>
          </div>
          <textarea
            value={obsTexto}
            onChange={(e) => setObsTexto(e.target.value)}
            placeholder="Ex: Cliente mencionou na call que está avaliando concorrentes..."
            rows={3}
            style={{ width: '100%', padding: '10px 14px', background: '#0f0a1f', border: formErrors.texto ? '1px solid #ef4444' : '1px solid #3730a3', borderRadius: '10px', color: 'white', fontSize: '14px', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
          />
          <ErrorMessage error={formErrors.texto} />
          {/* Selecao de Tags */}
          <div style={{ marginTop: '12px' }}>
            <label style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '500', display: 'block', marginBottom: '6px' }}>Tags (opcional)</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {TAGS_OBSERVACAO.map(tag => {
                const isSelected = obsTags.includes(tag.value);
                return (
                  <button
                    key={tag.value}
                    onClick={() => setObsTags(prev => isSelected ? prev.filter(t => t !== tag.value) : [...prev, tag.value])}
                    title={tag.description}
                    style={{
                      padding: '5px 10px',
                      border: `1px solid ${isSelected ? tag.color : 'rgba(139, 92, 246, 0.2)'}`,
                      background: isSelected ? `${tag.color}20` : 'transparent',
                      borderRadius: '8px',
                      color: isSelected ? tag.color : '#64748b',
                      fontSize: '11px',
                      fontWeight: isSelected ? '600' : '400',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {tag.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
            <button onClick={() => { setShowObsForm(false); setObsTexto(''); setObsTags([]); }} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '10px', color: '#94a3b8', fontSize: '13px', cursor: 'pointer' }}>Cancelar</button>
            <button onClick={handleSaveObs} disabled={!obsTexto.trim() || savingObs} style={{ padding: '8px 16px', background: !obsTexto.trim() ? 'rgba(16, 185, 129, 0.3)' : 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)', border: 'none', borderRadius: '10px', color: 'white', fontSize: '13px', fontWeight: '600', cursor: !obsTexto.trim() ? 'not-allowed' : 'pointer' }}>
              {savingObs ? 'Salvando...' : 'Adicionar'}
            </button>
          </div>
        </div>
      )}

      {/* Formulario de Nova Interacao */}
      {showInteracaoForm && (
        <div style={{ background: 'rgba(15, 10, 31, 0.6)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '500', display: 'block', marginBottom: '4px' }}>Tipo *</label>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {TIPOS_INTERACAO.filter(t => t.value !== 'email').map(t => (
                    <button
                      key={t.value}
                      onClick={() => setInteracaoForm(prev => ({ ...prev, tipo: t.value }))}
                      style={{
                        padding: '6px 10px',
                        border: `1px solid ${interacaoForm.tipo === t.value ? t.color : 'rgba(139, 92, 246, 0.2)'}`,
                        background: interacaoForm.tipo === t.value ? `${t.color}20` : 'transparent',
                        borderRadius: '8px',
                        color: interacaoForm.tipo === t.value ? t.color : '#64748b',
                        fontSize: '12px', fontWeight: '500', cursor: 'pointer'
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '500', display: 'block', marginBottom: '4px' }}>Data *</label>
                <input
                  type="date"
                  value={interacaoForm.data}
                  onChange={e => setInteracaoForm(prev => ({ ...prev, data: e.target.value }))}
                  style={{ width: '100%', padding: '10px 14px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: 'white', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '500', display: 'block', marginBottom: '4px' }}>Participantes</label>
                <input
                  type="text"
                  value={interacaoForm.participantes}
                  onChange={e => setInteracaoForm(prev => ({ ...prev, participantes: e.target.value }))}
                  placeholder="Nomes separados por vírgula..."
                  style={{ width: '100%', padding: '10px 14px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: 'white', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '500', display: 'block', marginBottom: '4px' }}>Duração (min)</label>
                  <input
                    type="number"
                    value={interacaoForm.duracao}
                    onChange={e => setInteracaoForm(prev => ({ ...prev, duracao: e.target.value }))}
                    placeholder="30"
                    min="0"
                    style={{ width: '100%', padding: '10px 14px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: 'white', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '500', display: 'block', marginBottom: '4px' }}>Link gravação</label>
                  <input
                    type="text"
                    value={interacaoForm.link_gravacao}
                    onChange={e => setInteracaoForm(prev => ({ ...prev, link_gravacao: e.target.value }))}
                    placeholder="URL..."
                    style={{ width: '100%', padding: '10px 14px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: 'white', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            </div>
            <div>
              <label style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '500', display: 'block', marginBottom: '4px' }}>Notas</label>
              <textarea
                value={interacaoForm.notas}
                onChange={e => setInteracaoForm(prev => ({ ...prev, notas: e.target.value }))}
                placeholder="Resumo da interação..."
                rows={3}
                style={{ width: '100%', padding: '10px 14px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: 'white', fontSize: '14px', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
              />
            </div>

            {/* Transcricao da reuniao - apenas para reunioes */}
            {interacaoForm.tipo === 'reuniao' && (
              <div style={{ padding: '16px', background: 'rgba(139, 92, 246, 0.05)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Sparkles style={{ width: '16px', height: '16px', color: '#a78bfa' }} />
                  <span style={{ color: '#a78bfa', fontSize: '13px', fontWeight: '600' }}>Transcrição + Resumo IA</span>
                  <span style={{ color: '#64748b', fontSize: '11px' }}>(opcional)</span>
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '500', display: 'block', marginBottom: '4px' }}>
                    Cole a transcrição da reunião
                  </label>
                  <textarea
                    value={transcricaoTexto}
                    onChange={e => setTranscricaoTexto(e.target.value)}
                    placeholder="Cole aqui o texto da transcrição (copie do Google Docs, Otter.ai, etc.)..."
                    rows={5}
                    style={{ width: '100%', padding: '10px 14px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: 'white', fontSize: '13px', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  />
                  {transcricaoTexto && (
                    <p style={{ color: '#64748b', fontSize: '11px', marginTop: '4px' }}>
                      {transcricaoTexto.length.toLocaleString()} caracteres
                    </p>
                  )}
                </div>
                <div>
                  <label style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '500', display: 'block', marginBottom: '4px' }}>
                    Link do documento (Google Docs, etc.)
                  </label>
                  <input
                    type="url"
                    value={linkTranscricao}
                    onChange={e => setLinkTranscricao(e.target.value)}
                    placeholder="https://docs.google.com/document/d/..."
                    style={{ width: '100%', padding: '10px 14px', background: '#0f0a1f', border: '1px solid #3730a3', borderRadius: '10px', color: 'white', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                {transcriptionError && (
                  <p style={{ color: '#ef4444', fontSize: '12px', marginTop: '8px' }}>
                    {transcriptionError}
                  </p>
                )}
                {transcricaoTexto.trim() && (
                  <p style={{ color: '#10b981', fontSize: '11px', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Sparkles style={{ width: '12px', height: '12px' }} />
                    A IA irá gerar um resumo automático com pontos-chave e ações combinadas.
                  </p>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => { setShowInteracaoForm(false); setEditingInteracaoId(null); setTranscricaoTexto(''); setLinkTranscricao(''); setTranscriptionError(''); }}
                style={{ padding: '8px 16px', background: 'transparent', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '10px', color: '#94a3b8', fontSize: '13px', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveInteracao}
                disabled={savingInteracao || !interacaoForm.data}
                style={{ padding: '8px 16px', background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)', border: 'none', borderRadius: '10px', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer', opacity: savingInteracao || !interacaoForm.data ? 0.5 : 1 }}
              >
                {savingInteracao ? 'Salvando...' : editingInteracaoId ? 'Atualizar' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Timeline Unificada */}
      {sortedItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <MessageSquare style={{ width: '40px', height: '40px', color: '#3730a3', margin: '0 auto 12px' }} />
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
            {totalCount === 0 ? 'Nenhuma interação registrada' : 'Nenhum resultado para os filtros aplicados'}
          </p>
        </div>
      ) : (
        <div style={{ position: 'relative', paddingLeft: '24px' }}>
          {/* Linha vertical da timeline */}
          <div style={{ position: 'absolute', left: '8px', top: '8px', bottom: '8px', width: '2px', background: 'rgba(139, 92, 246, 0.15)' }} />

          {sortedItems.map((item, idx) => {
            const tipoInfo = TIPOS_INTERACAO.find(t => t.value === item._tipo) || TIPOS_INTERACAO[TIPOS_INTERACAO.length - 1];

            if (item._source === 'thread') {
              const assunto = item.assunto || item.subject || 'Sem assunto';
              const remetente = item.remetente_nome || item.sender_name || item.remetente_email || '';
              const snippet = item.snippet || '';
              const categoriaInfo = item.categoria ? getCategoriaInfo(item.categoria) : null;
              const sentimentoInfo = item.sentimento ? getSentimentoInfo(item.sentimento) : null;

              return (
                <div key={`t-${item.id}`} style={{ position: 'relative', marginBottom: idx < sortedItems.length - 1 ? '12px' : 0 }}>
                  <div style={{ position: 'absolute', left: '-20px', top: '14px', width: '12px', height: '12px', borderRadius: '50%', background: tipoInfo.color, border: '2px solid #0f0a1f' }} />
                  <div
                    onClick={() => onThreadClick(item)}
                    style={{ background: 'rgba(15, 10, 31, 0.4)', border: '1px solid rgba(6, 182, 212, 0.12)', borderRadius: '12px', padding: '14px 16px', cursor: 'pointer', transition: 'border-color 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.35)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.12)'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <span style={{ padding: '2px 8px', background: `${tipoInfo.color}20`, color: tipoInfo.color, borderRadius: '6px', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>
                        Email
                      </span>
                      <span style={{ color: '#94a3b8', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar style={{ width: '11px', height: '11px' }} />
                        {item._date.toLocaleDateString('pt-BR')}
                      </span>
                      {remetente && (
                        <span style={{ color: '#64748b', fontSize: '12px' }}>{remetente}</span>
                      )}
                      {categoriaInfo && (
                        <span style={{ padding: '1px 6px', background: `${categoriaInfo.color}15`, color: categoriaInfo.color, borderRadius: '4px', fontSize: '10px', fontWeight: '500' }}>
                          {categoriaInfo.label}
                        </span>
                      )}
                      {sentimentoInfo && (
                        <span style={{ fontSize: '12px' }}>{sentimentoInfo.emoji}</span>
                      )}
                    </div>
                    <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: '0 0 4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {assunto}
                    </p>
                    {snippet && (
                      <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {snippet.substring(0, 150)}
                      </p>
                    )}
                  </div>
                </div>
              );
            }

            // Renderizar observacao
            if (item._source === 'observacao') {
              return (
                <div key={`o-${item.id}`} style={{ position: 'relative', marginBottom: idx < sortedItems.length - 1 ? '12px' : 0 }}>
                  <div style={{ position: 'absolute', left: '-20px', top: '14px', width: '12px', height: '12px', borderRadius: '50%', background: tipoInfo.color, border: '2px solid #0f0a1f' }} />
                  <div style={{ background: 'rgba(15, 10, 31, 0.4)', border: `1px solid ${item.status === 'ativa' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.1)'}`, borderRadius: '12px', padding: '14px 16px', opacity: item.status === 'resolvida' ? 0.6 : 1 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                          <span style={{ padding: '2px 8px', background: `${tipoInfo.color}20`, color: tipoInfo.color, borderRadius: '6px', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>
                            Observação
                          </span>
                          <span style={{ padding: '2px 8px', background: item.status === 'ativa' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.2)', color: item.status === 'ativa' ? '#10b981' : '#64748b', borderRadius: '6px', fontSize: '10px', fontWeight: '600' }}>
                            {item.status === 'ativa' ? 'Ativa' : 'Resolvida'}
                          </span>
                          <span style={{ color: '#94a3b8', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar style={{ width: '11px', height: '11px' }} />
                            {item._date.toLocaleDateString('pt-BR')}
                          </span>
                          <span style={{ color: '#4a4568', fontSize: '11px' }}>por {item.criado_por || 'CS'}</span>
                        </div>
                        <p style={{ color: '#e2e8f0', fontSize: '13px', margin: 0, lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                          {item.texto}
                        </p>
                        {/* Tags da observacao */}
                        {item.tags && item.tags.length > 0 && (
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '8px' }}>
                            {item.tags.map(tagValue => {
                              const tagInfo = TAGS_OBSERVACAO.find(t => t.value === tagValue);
                              if (!tagInfo) return null;
                              return (
                                <span
                                  key={tagValue}
                                  title={tagInfo.description}
                                  style={{
                                    padding: '2px 8px',
                                    background: `${tagInfo.color}15`,
                                    color: tagInfo.color,
                                    borderRadius: '6px',
                                    fontSize: '10px',
                                    fontWeight: '600',
                                    border: `1px solid ${tagInfo.color}30`
                                  }}
                                >
                                  {tagInfo.label}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                        <button
                          onClick={() => handleToggleObsStatus(item)}
                          title={item.status === 'ativa' ? 'Marcar resolvida' : 'Reativar'}
                          style={{ width: '30px', height: '30px', background: item.status === 'ativa' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(139, 92, 246, 0.1)', border: `1px solid ${item.status === 'ativa' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(139, 92, 246, 0.2)'}`, borderRadius: '8px', color: item.status === 'ativa' ? '#10b981' : '#8b5cf6', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          {item.status === 'ativa' ? <CheckCircle2 style={{ width: '14px', height: '14px' }} /> : <RotateCcw style={{ width: '14px', height: '14px' }} />}
                        </button>
                        <button
                          onClick={() => handleDeleteObs(item)}
                          title="Excluir"
                          style={{ width: '30px', height: '30px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Trash2 style={{ width: '14px', height: '14px' }} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            // Renderizar alerta
            if (item._source === 'alerta') {
              const statusColors = {
                pendente: { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', label: 'Pendente' },
                em_andamento: { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', label: 'Em Andamento' },
                bloqueado: { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', label: 'Bloqueado' },
                resolvido: { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', label: 'Resolvido' },
                ignorado: { bg: 'rgba(100, 116, 139, 0.15)', color: '#64748b', label: 'Ignorado' }
              };
              const statusInfo = statusColors[item.status] || statusColors.pendente;
              const tipoLabels = {
                sentimento_negativo: 'Sentimento Negativo',
                problema_reclamacao: 'Problema/Reclamação',
                entrou_resgate: 'Entrou em Resgate'
              };

              return (
                <div key={`a-${item.id}`} style={{ position: 'relative', marginBottom: idx < sortedItems.length - 1 ? '12px' : 0 }}>
                  <div style={{ position: 'absolute', left: '-20px', top: '14px', width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444', border: '2px solid #0f0a1f' }} />
                  <div
                    onClick={() => onAlertaClick(item)}
                    style={{ background: 'rgba(15, 10, 31, 0.4)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '12px', padding: '14px 16px', cursor: 'pointer', transition: 'border-color 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.35)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.15)'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <span style={{ padding: '2px 8px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', borderRadius: '6px', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>
                        Alerta
                      </span>
                      <span style={{ padding: '2px 8px', background: statusInfo.bg, color: statusInfo.color, borderRadius: '6px', fontSize: '10px', fontWeight: '600' }}>
                        {statusInfo.label}
                      </span>
                      <span style={{ color: '#94a3b8', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar style={{ width: '11px', height: '11px' }} />
                        {item._date.toLocaleDateString('pt-BR')}
                      </span>
                      <span style={{ color: '#64748b', fontSize: '11px' }}>
                        {tipoLabels[item.tipo] || item.tipo}
                      </span>
                    </div>
                    <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: '0 0 4px 0' }}>
                      {item.titulo}
                    </p>
                    {item.mensagem && (
                      <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.mensagem.substring(0, 150)}
                      </p>
                    )}
                    {item.clickup_comments && item.clickup_comments.length > 0 && (
                      <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <MessageSquare style={{ width: '12px', height: '12px', color: '#06b6d4' }} />
                        <span style={{ color: '#06b6d4', fontSize: '11px' }}>{item.clickup_comments.length} comentário{item.clickup_comments.length > 1 ? 's' : ''} do ClickUp</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // Renderizar transicao de nivel
            if (item._tipo === 'transicao_nivel') {
              const isDescida = item.direcao === 'descida';
              const corAnterior = SAUDE_COLORS[item.segmento_anterior] || '#64748b';
              const corNova = SAUDE_COLORS[item.segmento_novo] || '#64748b';
              const borderColor = isDescida ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)';
              const bgColor = isDescida ? 'rgba(239, 68, 68, 0.05)' : 'rgba(16, 185, 129, 0.05)';

              return (
                <div key={`tr-${item.id}`} style={{ position: 'relative', marginBottom: idx < sortedItems.length - 1 ? '12px' : 0 }}>
                  <div style={{ position: 'absolute', left: '-20px', top: '14px', width: '12px', height: '12px', borderRadius: '50%', background: isDescida ? '#ef4444' : '#10b981', border: '2px solid #0f0a1f' }} />
                  <div style={{ background: bgColor, border: `1px solid ${borderColor}`, borderRadius: '12px', padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '16px' }}>{isDescida ? '🔻' : '🔺'}</span>
                      <span style={{ padding: '2px 8px', background: isDescida ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)', color: isDescida ? '#ef4444' : '#10b981', borderRadius: '6px', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>
                        Transição de Saúde
                      </span>
                      <span style={{ color: '#94a3b8', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar style={{ width: '11px', height: '11px' }} />
                        {item._date.toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ padding: '3px 10px', background: `${corAnterior}20`, color: corAnterior, borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>
                        {item.segmento_anterior}
                      </span>
                      <span style={{ color: '#64748b', fontSize: '14px' }}>{'\u2192'}</span>
                      <span style={{ padding: '3px 10px', background: `${corNova}20`, color: corNova, borderRadius: '6px', fontSize: '12px', fontWeight: '600' }}>
                        {item.segmento_novo}
                      </span>
                    </div>
                    {item.motivo && (
                      <p style={{ color: '#94a3b8', fontSize: '12px', margin: '8px 0 0 0' }}>
                        <span style={{ fontWeight: '500' }}>Motivo:</span> {item.motivo}
                      </p>
                    )}
                  </div>
                </div>
              );
            }

            // Renderizar interacao manual
            const resumoData = item.resumo_ia ? parseResumoIA(item.resumo_ia) : null;
            const isTranscricaoExpanded = expandedTranscricao[item.id];

            return (
              <div key={`i-${item.id}`} style={{ position: 'relative', marginBottom: idx < sortedItems.length - 1 ? '12px' : 0 }}>
                <div style={{ position: 'absolute', left: '-20px', top: '14px', width: '12px', height: '12px', borderRadius: '50%', background: tipoInfo.color, border: '2px solid #0f0a1f' }} />
                <div style={{ background: 'rgba(15, 10, 31, 0.4)', border: '1px solid rgba(139, 92, 246, 0.1)', borderRadius: '12px', padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                        <span style={{ padding: '2px 8px', background: `${tipoInfo.color}20`, color: tipoInfo.color, borderRadius: '6px', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>
                          {tipoInfo.label}
                        </span>
                        <span style={{ color: '#94a3b8', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar style={{ width: '11px', height: '11px' }} />
                          {item._date.toLocaleDateString('pt-BR')}
                        </span>
                        {item.duracao > 0 && (
                          <span style={{ color: '#64748b', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock style={{ width: '11px', height: '11px' }} />
                            {item.duracao}min
                          </span>
                        )}
                        {item.transcricao_status === 'processing' && (
                          <span style={{ padding: '2px 8px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', borderRadius: '6px', fontSize: '10px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Loader2 style={{ width: '10px', height: '10px', animation: 'spin 1s linear infinite' }} />
                            Gerando resumo...
                          </span>
                        )}
                        {item.transcricao_status === 'completed' && (
                          <span style={{ padding: '2px 8px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', borderRadius: '6px', fontSize: '10px', fontWeight: '600' }}>
                            Com resumo IA
                          </span>
                        )}
                        {item.transcricao_status === 'error' && (
                          <span style={{ padding: '2px 8px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', borderRadius: '6px', fontSize: '10px', fontWeight: '600' }}>
                            Erro no resumo
                          </span>
                        )}
                      </div>
                      {item.participantes && (
                        <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Users style={{ width: '11px', height: '11px', flexShrink: 0 }} />
                          {item.participantes}
                        </p>
                      )}
                      {item.notas && (
                        <p style={{ color: '#e2e8f0', fontSize: '13px', margin: '0 0 6px 0', lineHeight: '1.4' }}>
                          {item.notas}
                        </p>
                      )}

                      {/* Resumo IA da transcricao */}
                      {resumoData && (
                        <div style={{ marginTop: '10px', padding: '12px', background: 'rgba(139, 92, 246, 0.08)', borderRadius: '10px', border: '1px solid rgba(139, 92, 246, 0.15)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                            <Sparkles style={{ width: '14px', height: '14px', color: '#a78bfa' }} />
                            <span style={{ color: '#a78bfa', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase' }}>Resumo IA</span>
                            {resumoData.sentimento_geral && (
                              <span style={{ padding: '2px 8px', background: `${getSentimentoColor(resumoData.sentimento_geral)}20`, color: getSentimentoColor(resumoData.sentimento_geral), borderRadius: '6px', fontSize: '10px', fontWeight: '500' }}>
                                {getSentimentoLabel(resumoData.sentimento_geral)}
                              </span>
                            )}
                          </div>
                          {resumoData.resumo && (
                            <p style={{ color: '#e2e8f0', fontSize: '13px', margin: '0 0 8px 0', lineHeight: '1.5' }}>
                              {resumoData.resumo}
                            </p>
                          )}
                          {resumoData.pontos_chave && resumoData.pontos_chave.length > 0 && (
                            <div style={{ marginBottom: '8px' }}>
                              <span style={{ color: '#64748b', fontSize: '11px', fontWeight: '600' }}>Pontos-chave:</span>
                              <ul style={{ margin: '4px 0 0 0', paddingLeft: '16px' }}>
                                {resumoData.pontos_chave.map((ponto, i) => (
                                  <li key={i} style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '2px' }}>{ponto}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {resumoData.acoes_combinadas && resumoData.acoes_combinadas.length > 0 && (
                            <div>
                              <span style={{ color: '#64748b', fontSize: '11px', fontWeight: '600' }}>Ações combinadas:</span>
                              <ul style={{ margin: '4px 0 0 0', paddingLeft: '16px' }}>
                                {resumoData.acoes_combinadas.map((acao, i) => (
                                  <li key={i} style={{ color: '#10b981', fontSize: '12px', marginBottom: '2px' }}>{acao}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Transcricao completa (collapsible) */}
                      {item.transcricao && (
                        <div style={{ marginTop: '8px' }}>
                          <button
                            onClick={() => setExpandedTranscricao(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                            style={{ background: 'none', border: 'none', color: '#06b6d4', fontSize: '12px', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <FileText style={{ width: '12px', height: '12px' }} />
                            {isTranscricaoExpanded ? 'Ocultar transcrição' : 'Ver transcrição completa'}
                            <ChevronDown style={{ width: '12px', height: '12px', transform: isTranscricaoExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                          </button>
                          {isTranscricaoExpanded && (
                            <div style={{ marginTop: '8px', padding: '12px', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '8px', border: '1px solid rgba(100, 116, 139, 0.2)', maxHeight: '300px', overflowY: 'auto' }}>
                              <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0, lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                                {item.transcricao}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {item.link_gravacao && (
                        <a href={item.link_gravacao} target="_blank" rel="noopener noreferrer" style={{ color: '#06b6d4', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', marginTop: '6px' }}>
                          <Video style={{ width: '12px', height: '12px' }} />
                          Ver gravação
                        </a>
                      )}

                      {item.link_transcricao && (
                        <a href={item.link_transcricao} target="_blank" rel="noopener noreferrer" style={{ color: '#a78bfa', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', marginTop: '6px' }}>
                          <FileText style={{ width: '12px', height: '12px' }} />
                          Ver transcrição completa
                        </a>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                      <button
                        onClick={() => handleEditInteracao(item)}
                        title="Editar"
                        style={{ width: '30px', height: '30px', background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: '8px', color: '#8b5cf6', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Pencil style={{ width: '14px', height: '14px' }} />
                      </button>
                      <button
                        onClick={() => handleDeleteInteracao(item.id)}
                        title="Excluir"
                        style={{ width: '30px', height: '30px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Trash2 style={{ width: '14px', height: '14px' }} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
