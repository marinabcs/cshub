import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { ClipboardList } from 'lucide-react';
import {
  FileText, Plus, Search, Folder, FolderPlus, ExternalLink, Pencil, Trash2, X,
  ChevronDown, ChevronRight, Link2, File, FileImage, FileVideo, FileSpreadsheet,
  Presentation, GripVertical, MoreVertical, Check, FolderOpen
} from 'lucide-react';

// Ícones por tipo de arquivo
const FILE_ICONS = {
  doc: FileText,
  pdf: FileText,
  sheet: FileSpreadsheet,
  slide: Presentation,
  image: FileImage,
  video: FileVideo,
  default: File
};

// Detectar tipo pelo link ou extensão
const getFileType = (url) => {
  if (!url) return 'default';
  const lower = url.toLowerCase();
  if (lower.includes('docs.google.com/document') || lower.includes('.doc')) return 'doc';
  if (lower.includes('.pdf')) return 'pdf';
  if (lower.includes('docs.google.com/spreadsheet') || lower.includes('sheets.google.com') || lower.includes('.xls')) return 'sheet';
  if (lower.includes('docs.google.com/presentation') || lower.includes('slides.google.com') || lower.includes('.ppt')) return 'slide';
  if (lower.includes('.jpg') || lower.includes('.png') || lower.includes('.gif') || lower.includes('.webp')) return 'image';
  if (lower.includes('.mp4') || lower.includes('.mov') || lower.includes('youtube.com') || lower.includes('vimeo.com')) return 'video';
  return 'default';
};

export default function Documentos() {
  const { user } = useAuth();
  const [secoes, setSecoes] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [playbooks, setPlaybooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSections, setExpandedSections] = useState(new Set());

  // Modais
  const [showSecaoModal, setShowSecaoModal] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [editingSecao, setEditingSecao] = useState(null);
  const [editingDoc, setEditingDoc] = useState(null);

  // Forms
  const [secaoForm, setSecaoForm] = useState({ nome: '', descricao: '', cor: '#8b5cf6' });
  const [docForm, setDocForm] = useState({ titulo: '', descricao: '', url: '', secao_id: '' });
  const [saving, setSaving] = useState(false);

  // Menu de contexto
  const [, setContextMenu] = useState(null);

  const cores = [
    '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6'
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [secoesSnap, docsSnap, playbooksSnap] = await Promise.all([
        getDocs(collection(db, 'documentos_secoes')),
        getDocs(collection(db, 'documentos')),
        getDocs(collection(db, 'playbooks'))
      ]);

      const secoesData = secoesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const docsData = docsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const playbooksData = playbooksSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(p => p.ativo !== false);

      // Ordenar seções por mais acessadas, depois alfabeticamente
      secoesData.sort((a, b) => {
        const clicksA = a.clicks || 0;
        const clicksB = b.clicks || 0;
        if (clicksB !== clicksA) return clicksB - clicksA; // Mais cliques primeiro
        return (a.nome || '').localeCompare(b.nome || '', 'pt-BR'); // Empate: alfabético
      });

      setSecoes(secoesData);
      setDocumentos(docsData);
      setPlaybooks(playbooksData);

      // Expandir todas as seções por padrão
      setExpandedSections(new Set(secoesData.map(s => s.id)));

      // Auto-sincronizar seções de playbooks (silencioso)
      const needsRefresh = await autoSyncPlaybookSections(secoesData, playbooksData);
      if (needsRefresh) {
        // Recarregar dados se novas seções foram criadas
        const newSecoesSnap = await getDocs(collection(db, 'documentos_secoes'));
        const newSecoesData = newSecoesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        newSecoesData.sort((a, b) => {
          const clicksA = a.clicks || 0;
          const clicksB = b.clicks || 0;
          if (clicksB !== clicksA) return clicksB - clicksA;
          return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
        });
        setSecoes(newSecoesData);
        setExpandedSections(new Set(newSecoesData.map(s => s.id)));
      }
    } catch (error) {
      console.error('Erro ao buscar documentos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Sincronizar seções com playbooks automaticamente (silencioso)
  const autoSyncPlaybookSections = async (currentSecoes, currentPlaybooks) => {
    try {
      let needsRefresh = false;

      // Criar seção principal para cada playbook (se não existir)
      for (const playbook of currentPlaybooks) {
        const secaoExistente = currentSecoes.find(s => s.playbook_id === playbook.id && !s.etapa_ordem);

        if (!secaoExistente) {
          await addDoc(collection(db, 'documentos_secoes'), {
            nome: playbook.nome,
            descricao: playbook.descricao || `Documentos do playbook ${playbook.nome}`,
            cor: '#8b5cf6',
            playbook_id: playbook.id,
            ordem: 0,
            created_at: Timestamp.now(),
            created_by: user?.email
          });
          needsRefresh = true;
        }
      }

      return needsRefresh;
    } catch (error) {
      console.error('Erro ao sincronizar playbooks:', error);
      return false;
    }
  };

  // Obter documentos dos playbooks (cadastrados nas etapas)
  const getPlaybookDocs = (playbookId) => {
    const playbook = playbooks.find(p => p.id === playbookId);
    if (!playbook || !playbook.etapas) return [];

    const docs = [];
    playbook.etapas.forEach(etapa => {
      if (etapa.documentos && etapa.documentos.length > 0) {
        etapa.documentos.forEach(docItem => {
          docs.push({
            ...docItem,
            id: `pb_${playbookId}_${etapa.ordem}_${docItem.nome}`,
            etapa_nome: etapa.nome,
            etapa_ordem: etapa.ordem,
            isPlaybookDoc: true
          });
        });
      }
    });
    return docs;
  };

  // Filtrar documentos
  const filteredDocs = documentos.filter(doc => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      (doc.titulo || '').toLowerCase().includes(search) ||
      (doc.descricao || '').toLowerCase().includes(search)
    );
  });

  // Agrupar por seção
  const docsBySecao = {};
  filteredDocs.forEach(doc => {
    const secaoId = doc.secao_id || 'sem_secao';
    if (!docsBySecao[secaoId]) docsBySecao[secaoId] = [];
    docsBySecao[secaoId].push(doc);
  });

  // Toggle seção expandida e registrar clique
  const toggleSection = async (secaoId) => {
    const wasExpanded = expandedSections.has(secaoId);

    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(secaoId)) {
        newSet.delete(secaoId);
      } else {
        newSet.add(secaoId);
      }
      return newSet;
    });

    // Incrementar contador de cliques ao expandir (não ao colapsar)
    if (!wasExpanded && secaoId !== 'sem_secao') {
      try {
        const secao = secoes.find(s => s.id === secaoId);
        if (secao) {
          await updateDoc(doc(db, 'documentos_secoes', secaoId), {
            clicks: (secao.clicks || 0) + 1
          });
          // Atualizar localmente
          setSecoes(prev => prev.map(s =>
            s.id === secaoId ? { ...s, clicks: (s.clicks || 0) + 1 } : s
          ));
        }
      } catch (error) {
        console.error('Erro ao registrar clique:', error);
      }
    }
  };

  // Salvar seção
  const handleSaveSecao = async () => {
    if (!secaoForm.nome.trim()) return;

    setSaving(true);
    try {
      if (editingSecao) {
        await updateDoc(doc(db, 'documentos_secoes', editingSecao.id), {
          nome: secaoForm.nome,
          descricao: secaoForm.descricao,
          cor: secaoForm.cor,
          updated_at: Timestamp.now()
        });
      } else {
        await addDoc(collection(db, 'documentos_secoes'), {
          nome: secaoForm.nome,
          descricao: secaoForm.descricao,
          cor: secaoForm.cor,
          ordem: secoes.length,
          created_at: Timestamp.now(),
          created_by: user?.email
        });
      }

      await fetchData();
      setShowSecaoModal(false);
      setEditingSecao(null);
      setSecaoForm({ nome: '', descricao: '', cor: '#8b5cf6' });
    } catch (error) {
      console.error('Erro ao salvar seção:', error);
      alert(`Erro ao salvar seção: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Salvar documento
  const handleSaveDoc = async () => {
    if (!docForm.titulo.trim() || !docForm.url.trim()) return;

    setSaving(true);
    try {
      if (editingDoc) {
        await updateDoc(doc(db, 'documentos', editingDoc.id), {
          titulo: docForm.titulo,
          descricao: docForm.descricao,
          url: docForm.url,
          secao_id: docForm.secao_id || null,
          updated_at: Timestamp.now()
        });
      } else {
        await addDoc(collection(db, 'documentos'), {
          titulo: docForm.titulo,
          descricao: docForm.descricao,
          url: docForm.url,
          secao_id: docForm.secao_id || null,
          created_at: Timestamp.now(),
          created_by: user?.email
        });
      }

      await fetchData();
      setShowDocModal(false);
      setEditingDoc(null);
      setDocForm({ titulo: '', descricao: '', url: '', secao_id: '' });
    } catch (error) {
      console.error('Erro ao salvar documento:', error);
      alert(`Erro ao salvar documento: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Deletar seção
  const handleDeleteSecao = async (secao) => {
    if (!confirm(`Excluir a seção "${secao.nome}"? Os documentos serão movidos para "Sem seção".`)) return;

    try {
      // Mover documentos para sem seção
      const docsNaSecao = documentos.filter(d => d.secao_id === secao.id);
      for (const documento of docsNaSecao) {
        await updateDoc(doc(db, 'documentos', documento.id), { secao_id: null });
      }

      await deleteDoc(doc(db, 'documentos_secoes', secao.id));
      await fetchData();
    } catch (error) {
      console.error('Erro ao excluir seção:', error);
      alert('Erro ao excluir seção');
    }
  };

  // Deletar documento
  const handleDeleteDoc = async (documento) => {
    if (!confirm(`Excluir o documento "${documento.titulo}"?`)) return;

    try {
      await deleteDoc(doc(db, 'documentos', documento.id));
      await fetchData();
    } catch (error) {
      console.error('Erro ao excluir documento:', error);
      alert('Erro ao excluir documento');
    }
  };

  // Abrir modal de edição de seção
  const openEditSecao = (secao) => {
    setEditingSecao(secao);
    setSecaoForm({
      nome: secao.nome || '',
      descricao: secao.descricao || '',
      cor: secao.cor || '#8b5cf6'
    });
    setShowSecaoModal(true);
    setContextMenu(null);
  };

  // Abrir modal de edição de documento
  const openEditDoc = (documento) => {
    setEditingDoc(documento);
    setDocForm({
      titulo: documento.titulo || '',
      descricao: documento.descricao || '',
      url: documento.url || '',
      secao_id: documento.secao_id || ''
    });
    setShowDocModal(true);
    setContextMenu(null);
  };

  // Abrir modal de novo documento em uma seção específica
  const openNewDocInSecao = (secaoId) => {
    setEditingDoc(null);
    setDocForm({ titulo: '', descricao: '', url: '', secao_id: secaoId });
    setShowDocModal(true);
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
            <div style={{
              width: '56px',
              height: '56px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(139, 92, 246, 0.3)'
            }}>
              <FileText style={{ width: '28px', height: '28px', color: 'white' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: 'white', margin: 0 }}>Documentos</h1>
              <p style={{ color: '#94a3b8', fontSize: '14px', margin: '4px 0 0 0' }}>
                {documentos.length} documento{documentos.length !== 1 ? 's' : ''} em {secoes.length} {secoes.length === 1 ? 'seção' : 'seções'}
              </p>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => {
              setEditingSecao(null);
              setSecaoForm({ nome: '', descricao: '', cor: '#8b5cf6' });
              setShowSecaoModal(true);
            }}
            style={{
              padding: '12px 20px',
              background: 'rgba(30, 27, 75, 0.6)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '12px',
              color: 'white',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <FolderPlus style={{ width: '18px', height: '18px' }} />
            Nova Seção
          </button>
          <button
            onClick={() => {
              setEditingDoc(null);
              setDocForm({ titulo: '', descricao: '', url: '', secao_id: secoes[0]?.id || '' });
              setShowDocModal(true);
            }}
            style={{
              padding: '12px 20px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Plus style={{ width: '18px', height: '18px' }} />
            Novo Documento
          </button>
        </div>
      </div>

      {/* Busca */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ position: 'relative', maxWidth: '400px' }}>
          <Search style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', width: '20px', height: '20px', color: '#64748b' }} />
          <input
            type="text"
            placeholder="Buscar documentos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 16px 12px 48px',
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

      {/* Lista de Seções e Documentos */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {secoes.map(secao => {
          const docsNaSecao = docsBySecao[secao.id] || [];
          const playbookDocsCount = secao.playbook_id ? getPlaybookDocs(secao.playbook_id).length : 0;
          const totalDocs = docsNaSecao.length + playbookDocsCount;
          const isExpanded = expandedSections.has(secao.id);

          return (
            <div
              key={secao.id}
              style={{
                background: 'rgba(30, 27, 75, 0.4)',
                border: '1px solid rgba(139, 92, 246, 0.15)',
                borderRadius: '16px',
                overflow: 'hidden'
              }}
            >
              {/* Header da Seção */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  background: `${secao.cor || '#8b5cf6'}10`,
                  borderBottom: isExpanded && totalDocs > 0 ? '1px solid rgba(139, 92, 246, 0.1)' : 'none',
                  cursor: 'pointer'
                }}
                onClick={() => toggleSection(secao.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {isExpanded ? (
                    <ChevronDown style={{ width: '20px', height: '20px', color: secao.cor || '#8b5cf6' }} />
                  ) : (
                    <ChevronRight style={{ width: '20px', height: '20px', color: secao.cor || '#8b5cf6' }} />
                  )}
                  <div style={{
                    width: '36px',
                    height: '36px',
                    background: `${secao.cor || '#8b5cf6'}20`,
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {isExpanded ? (
                      <FolderOpen style={{ width: '18px', height: '18px', color: secao.cor || '#8b5cf6' }} />
                    ) : (
                      <Folder style={{ width: '18px', height: '18px', color: secao.cor || '#8b5cf6' }} />
                    )}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3 style={{ color: 'white', fontSize: '15px', fontWeight: '600', margin: 0 }}>
                        {secao.nome}
                      </h3>
                      {secao.playbook_id && (
                        <span style={{
                          padding: '2px 6px',
                          background: 'rgba(139, 92, 246, 0.2)',
                          borderRadius: '4px',
                          fontSize: '9px',
                          fontWeight: '600',
                          color: '#a78bfa',
                          textTransform: 'uppercase',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}>
                          <ClipboardList style={{ width: '10px', height: '10px' }} />
                          {secao.etapa_ordem ? 'Etapa' : 'Playbook'}
                        </span>
                      )}
                    </div>
                    {secao.descricao && (
                      <p style={{ color: '#94a3b8', fontSize: '12px', margin: '2px 0 0 0' }}>
                        {secao.descricao}
                      </p>
                    )}
                  </div>
                  <span style={{
                    padding: '2px 8px',
                    background: `${secao.cor || '#8b5cf6'}20`,
                    color: secao.cor || '#8b5cf6',
                    borderRadius: '10px',
                    fontSize: '11px',
                    fontWeight: '600'
                  }}>
                    {totalDocs}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => openNewDocInSecao(secao.id)}
                    style={{
                      padding: '6px 12px',
                      background: 'rgba(139, 92, 246, 0.1)',
                      border: '1px solid rgba(139, 92, 246, 0.2)',
                      borderRadius: '8px',
                      color: '#a78bfa',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Plus style={{ width: '14px', height: '14px' }} />
                    Adicionar
                  </button>
                  <button
                    onClick={() => openEditSecao(secao)}
                    style={{
                      padding: '6px',
                      background: 'transparent',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer'
                    }}
                    title="Editar seção"
                  >
                    <Pencil style={{ width: '16px', height: '16px' }} />
                  </button>
                  <button
                    onClick={() => handleDeleteSecao(secao)}
                    style={{
                      padding: '6px',
                      background: 'transparent',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer'
                    }}
                    title="Excluir seção"
                  >
                    <Trash2 style={{ width: '16px', height: '16px' }} />
                  </button>
                </div>
              </div>

              {/* Lista de Documentos */}
              {isExpanded && (() => {
                // Combinar documentos da seção + documentos do playbook
                const playbookDocs = secao.playbook_id ? getPlaybookDocs(secao.playbook_id) : [];
                const allDocs = [...docsNaSecao, ...playbookDocs];

                if (allDocs.length === 0) {
                  return (
                    <div style={{ padding: '24px', textAlign: 'center' }}>
                      <p style={{ color: '#64748b', fontSize: '13px', margin: 0 }}>
                        Nenhum documento nesta seção
                      </p>
                    </div>
                  );
                }

                return (
                  <div style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {allDocs.map(documento => {
                        const fileType = getFileType(documento.url);
                        const IconComponent = FILE_ICONS[fileType] || FILE_ICONS.default;
                        const isFromPlaybook = documento.isPlaybookDoc;

                        return (
                          <div
                            key={documento.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              padding: '12px 16px',
                              background: isFromPlaybook ? 'rgba(6, 182, 212, 0.05)' : 'rgba(15, 10, 31, 0.6)',
                              border: isFromPlaybook ? '1px solid rgba(6, 182, 212, 0.15)' : 'none',
                              borderRadius: '10px',
                              transition: 'all 0.2s'
                            }}
                          >
                            <div style={{
                              width: '40px',
                              height: '40px',
                              background: isFromPlaybook ? 'rgba(6, 182, 212, 0.15)' : 'rgba(139, 92, 246, 0.1)',
                              borderRadius: '10px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              <IconComponent style={{ width: '20px', height: '20px', color: isFromPlaybook ? '#06b6d4' : '#8b5cf6' }} />
                            </div>

                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {documento.titulo || documento.nome}
                                </p>
                                {isFromPlaybook && documento.etapa_nome && (
                                  <span style={{
                                    padding: '2px 8px',
                                    background: 'rgba(6, 182, 212, 0.2)',
                                    borderRadius: '6px',
                                    fontSize: '10px',
                                    fontWeight: '500',
                                    color: '#06b6d4',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    Etapa {documento.etapa_ordem}: {documento.etapa_nome}
                                  </span>
                                )}
                              </div>
                              {documento.descricao && (
                                <p style={{ color: '#64748b', fontSize: '12px', margin: '2px 0 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {documento.descricao}
                                </p>
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                              <a
                                href={documento.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  padding: '8px 12px',
                                  background: 'rgba(6, 182, 212, 0.1)',
                                  border: '1px solid rgba(6, 182, 212, 0.3)',
                                  borderRadius: '8px',
                                  color: '#06b6d4',
                                  fontSize: '12px',
                                  fontWeight: '500',
                                  textDecoration: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}
                              >
                                <ExternalLink style={{ width: '14px', height: '14px' }} />
                                Abrir
                              </a>
                              {!isFromPlaybook && (
                                <>
                                  <button
                                    onClick={() => openEditDoc(documento)}
                                    style={{
                                      padding: '8px',
                                      background: 'transparent',
                                      border: 'none',
                                      color: '#64748b',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    <Pencil style={{ width: '16px', height: '16px' }} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteDoc(documento)}
                                    style={{
                                      padding: '8px',
                                      background: 'transparent',
                                      border: 'none',
                                      color: '#64748b',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    <Trash2 style={{ width: '16px', height: '16px' }} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })}

        {/* Documentos sem seção */}
        {(docsBySecao['sem_secao'] || []).length > 0 && (
          <div style={{
            background: 'rgba(30, 27, 75, 0.4)',
            border: '1px solid rgba(139, 92, 246, 0.15)',
            borderRadius: '16px',
            overflow: 'hidden'
          }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                background: 'rgba(100, 116, 139, 0.1)',
                borderBottom: '1px solid rgba(139, 92, 246, 0.1)',
                cursor: 'pointer'
              }}
              onClick={() => toggleSection('sem_secao')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {expandedSections.has('sem_secao') ? (
                  <ChevronDown style={{ width: '20px', height: '20px', color: '#64748b' }} />
                ) : (
                  <ChevronRight style={{ width: '20px', height: '20px', color: '#64748b' }} />
                )}
                <div style={{
                  width: '36px',
                  height: '36px',
                  background: 'rgba(100, 116, 139, 0.2)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Folder style={{ width: '18px', height: '18px', color: '#64748b' }} />
                </div>
                <div>
                  <h3 style={{ color: '#94a3b8', fontSize: '15px', fontWeight: '600', margin: 0 }}>
                    Sem seção
                  </h3>
                </div>
                <span style={{
                  padding: '2px 8px',
                  background: 'rgba(100, 116, 139, 0.2)',
                  color: '#64748b',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: '600'
                }}>
                  {(docsBySecao['sem_secao'] || []).length}
                </span>
              </div>
            </div>

            {expandedSections.has('sem_secao') && (
              <div style={{ padding: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(docsBySecao['sem_secao'] || []).map(documento => {
                    const fileType = getFileType(documento.url);
                    const IconComponent = FILE_ICONS[fileType] || FILE_ICONS.default;

                    return (
                      <div
                        key={documento.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '12px 16px',
                          background: 'rgba(15, 10, 31, 0.6)',
                          borderRadius: '10px'
                        }}
                      >
                        <div style={{
                          width: '40px',
                          height: '40px',
                          background: 'rgba(139, 92, 246, 0.1)',
                          borderRadius: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <IconComponent style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: 0 }}>
                            {documento.titulo}
                          </p>
                          {documento.descricao && (
                            <p style={{ color: '#64748b', fontSize: '12px', margin: '2px 0 0 0' }}>
                              {documento.descricao}
                            </p>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          <a
                            href={documento.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              padding: '8px 12px',
                              background: 'rgba(6, 182, 212, 0.1)',
                              border: '1px solid rgba(6, 182, 212, 0.3)',
                              borderRadius: '8px',
                              color: '#06b6d4',
                              fontSize: '12px',
                              fontWeight: '500',
                              textDecoration: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <ExternalLink style={{ width: '14px', height: '14px' }} />
                            Abrir
                          </a>
                          <button
                            onClick={() => openEditDoc(documento)}
                            style={{
                              padding: '8px',
                              background: 'transparent',
                              border: 'none',
                              color: '#64748b',
                              cursor: 'pointer'
                            }}
                          >
                            <Pencil style={{ width: '16px', height: '16px' }} />
                          </button>
                          <button
                            onClick={() => handleDeleteDoc(documento)}
                            style={{
                              padding: '8px',
                              background: 'transparent',
                              border: 'none',
                              color: '#64748b',
                              cursor: 'pointer'
                            }}
                          >
                            <Trash2 style={{ width: '16px', height: '16px' }} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Estado vazio */}
        {secoes.length === 0 && documentos.length === 0 && (
          <div style={{
            padding: '64px',
            textAlign: 'center',
            background: 'rgba(30, 27, 75, 0.4)',
            borderRadius: '16px',
            border: '1px solid rgba(139, 92, 246, 0.15)'
          }}>
            <FileText style={{ width: '48px', height: '48px', color: '#64748b', margin: '0 auto 16px' }} />
            <h3 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: '0 0 8px 0' }}>
              Nenhum documento cadastrado
            </h3>
            <p style={{ color: '#64748b', fontSize: '14px', margin: '0 0 24px 0' }}>
              Comece criando uma seção para organizar seus documentos
            </p>
            <button
              onClick={() => {
                setEditingSecao(null);
                setSecaoForm({ nome: '', descricao: '', cor: '#8b5cf6' });
                setShowSecaoModal(true);
              }}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                border: 'none',
                borderRadius: '12px',
                color: 'white',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <FolderPlus style={{ width: '18px', height: '18px' }} />
              Criar primeira seção
            </button>
          </div>
        )}
      </div>

      {/* Modal de Seção */}
      {showSecaoModal && (
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
            borderRadius: '16px',
            width: '100%',
            maxWidth: '450px'
          }}>
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid rgba(139, 92, 246, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h3 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>
                {editingSecao ? 'Editar Seção' : 'Nova Seção'}
              </h3>
              <button
                onClick={() => { setShowSecaoModal(false); setEditingSecao(null); }}
                style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '8px' }}
              >
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>

            <div style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '6px', display: 'block' }}>
                  Nome da Seção *
                </label>
                <input
                  type="text"
                  value={secaoForm.nome}
                  onChange={(e) => setSecaoForm({ ...secaoForm, nome: e.target.value })}
                  placeholder="Ex: Roteiros de Atendimento"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#0f0a1f',
                    border: '1px solid rgba(139, 92, 246, 0.2)',
                    borderRadius: '12px',
                    color: 'white',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '6px', display: 'block' }}>
                  Descrição (opcional)
                </label>
                <input
                  type="text"
                  value={secaoForm.descricao}
                  onChange={(e) => setSecaoForm({ ...secaoForm, descricao: e.target.value })}
                  placeholder="Breve descrição da seção"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#0f0a1f',
                    border: '1px solid rgba(139, 92, 246, 0.2)',
                    borderRadius: '12px',
                    color: 'white',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '8px', display: 'block' }}>
                  Cor
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {cores.map(cor => (
                    <button
                      key={cor}
                      onClick={() => setSecaoForm({ ...secaoForm, cor })}
                      style={{
                        width: '36px',
                        height: '36px',
                        background: cor,
                        border: secaoForm.cor === cor ? '3px solid white' : '3px solid transparent',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {secaoForm.cor === cor && <Check style={{ width: '18px', height: '18px', color: 'white' }} />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid rgba(139, 92, 246, 0.15)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button
                onClick={() => { setShowSecaoModal(false); setEditingSecao(null); }}
                style={{
                  padding: '10px 20px',
                  background: 'transparent',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  borderRadius: '10px',
                  color: '#94a3b8',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveSecao}
                disabled={saving || !secaoForm.nome.trim()}
                style={{
                  padding: '10px 20px',
                  background: saving ? 'rgba(139, 92, 246, 0.5)' : 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                  border: 'none',
                  borderRadius: '10px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: saving ? 'not-allowed' : 'pointer'
                }}
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Documento */}
      {showDocModal && (
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
            borderRadius: '16px',
            width: '100%',
            maxWidth: '500px'
          }}>
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid rgba(139, 92, 246, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h3 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>
                {editingDoc ? 'Editar Documento' : 'Novo Documento'}
              </h3>
              <button
                onClick={() => { setShowDocModal(false); setEditingDoc(null); }}
                style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: '8px' }}
              >
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>

            <div style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '6px', display: 'block' }}>
                  Título *
                </label>
                <input
                  type="text"
                  value={docForm.titulo}
                  onChange={(e) => setDocForm({ ...docForm, titulo: e.target.value })}
                  placeholder="Ex: Roteiro de Onboarding"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#0f0a1f',
                    border: '1px solid rgba(139, 92, 246, 0.2)',
                    borderRadius: '12px',
                    color: 'white',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '6px', display: 'block' }}>
                  Descrição (opcional)
                </label>
                <input
                  type="text"
                  value={docForm.descricao}
                  onChange={(e) => setDocForm({ ...docForm, descricao: e.target.value })}
                  placeholder="Breve descrição do documento"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#0f0a1f',
                    border: '1px solid rgba(139, 92, 246, 0.2)',
                    borderRadius: '12px',
                    color: 'white',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '6px', display: 'block' }}>
                  Link do Documento *
                </label>
                <div style={{ position: 'relative' }}>
                  <Link2 style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: '#64748b' }} />
                  <input
                    type="url"
                    value={docForm.url}
                    onChange={(e) => setDocForm({ ...docForm, url: e.target.value })}
                    placeholder="https://drive.google.com/..."
                    style={{
                      width: '100%',
                      padding: '12px 16px 12px 44px',
                      background: '#0f0a1f',
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

              <div style={{ marginBottom: '20px' }}>
                <label style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '6px', display: 'block' }}>
                  Seção
                </label>
                <select
                  value={docForm.secao_id}
                  onChange={(e) => setDocForm({ ...docForm, secao_id: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: '#0f0a1f',
                    border: '1px solid rgba(139, 92, 246, 0.2)',
                    borderRadius: '12px',
                    color: 'white',
                    fontSize: '14px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="" style={{ background: '#1e1b4b' }}>Sem seção</option>
                  {secoes.map(secao => (
                    <option key={secao.id} value={secao.id} style={{ background: '#1e1b4b' }}>
                      {secao.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid rgba(139, 92, 246, 0.15)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px'
            }}>
              <button
                onClick={() => { setShowDocModal(false); setEditingDoc(null); }}
                style={{
                  padding: '10px 20px',
                  background: 'transparent',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  borderRadius: '10px',
                  color: '#94a3b8',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveDoc}
                disabled={saving || !docForm.titulo.trim() || !docForm.url.trim()}
                style={{
                  padding: '10px 20px',
                  background: saving ? 'rgba(139, 92, 246, 0.5)' : 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                  border: 'none',
                  borderRadius: '10px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: saving ? 'not-allowed' : 'pointer'
                }}
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
