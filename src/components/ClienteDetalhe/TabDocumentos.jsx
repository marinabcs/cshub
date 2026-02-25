import { useState, useEffect } from 'react';
import { FolderOpen, Plus, Pencil, Trash2, ExternalLink, Link2 } from 'lucide-react';
import { doc, addDoc, updateDoc, deleteDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { validateForm } from '../../validation';
import { documentoSchema } from '../../validation/documento';
import { ErrorMessage } from '../UI/ErrorMessage';

/**
 * Tab Documentos - Document list with CRUD.
 * Shows planilhas, contratos and other client-specific files.
 */
export default function TabDocumentos({
  clienteId,
  documentos,
  setDocumentos: _setDocumentos,
  loadingDocs,
  fetchDocumentos
}) {
  const [showDocForm, setShowDocForm] = useState(false);
  const [docForm, setDocForm] = useState({ titulo: '', descricao: '', url: '' });
  const [savingDoc, setSavingDoc] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  // Load on mount if empty
  useEffect(() => {
    if (documentos.length === 0) fetchDocumentos();
  }, []);

  const handleSaveDoc = async () => {
    setFormErrors({});
    const validationErrors = validateForm(documentoSchema, docForm);
    if (validationErrors) {
      setFormErrors(validationErrors);
      return;
    }
    setSavingDoc(true);
    try {
      const normalizedUrl = docForm.url.match(/^https?:\/\//) ? docForm.url : `https://${docForm.url}`;
      if (editingDoc) {
        await updateDoc(doc(db, 'documentos', editingDoc.id), {
          titulo: docForm.titulo,
          descricao: docForm.descricao,
          url: normalizedUrl,
          updated_at: Timestamp.now()
        });
      } else {
        await addDoc(collection(db, 'documentos'), {
          titulo: docForm.titulo,
          descricao: docForm.descricao,
          url: normalizedUrl,
          cliente_id: clienteId,
          created_at: Timestamp.now(),
          updated_at: Timestamp.now()
        });
      }
      setDocForm({ titulo: '', descricao: '', url: '' });
      setShowDocForm(false);
      setEditingDoc(null);
      fetchDocumentos();
    } catch (error) {
      console.error('Erro ao salvar documento:', error);
      alert('Erro ao salvar documento');
    } finally {
      setSavingDoc(false);
    }
  };

  const handleDeleteDoc = async (docItem) => {
    if (!confirm(`Excluir "${docItem.titulo}"?`)) return;
    try {
      await deleteDoc(doc(db, 'documentos', docItem.id));
      fetchDocumentos();
    } catch (error) {
      console.error('Erro ao excluir documento:', error);
    }
  };

  return (
    <div style={{ background: 'rgba(30, 27, 75, 0.4)', border: '1px solid rgba(139, 92, 246, 0.15)', borderRadius: '20px', padding: '24px', marginBottom: '32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <FolderOpen style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
          <h2 style={{ color: 'white', fontSize: '18px', fontWeight: '600', margin: 0 }}>Documentos do Cliente</h2>
          <span style={{ padding: '4px 12px', background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa', borderRadius: '20px', fontSize: '13px', fontWeight: '500' }}>
            {documentos.length} {documentos.length === 1 ? 'documento' : 'documentos'}
          </span>
        </div>
        <button
          onClick={() => { setShowDocForm(true); setEditingDoc(null); setDocForm({ titulo: '', descricao: '', url: '' }); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
            border: 'none',
            borderRadius: '10px',
            color: 'white',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          <Plus style={{ width: '16px', height: '16px' }} />
          Novo Documento
        </button>
      </div>

      <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px' }}>
        Planilhas, contratos e outros arquivos específicos deste cliente
      </p>

      {/* Formulario de adicionar/editar documento */}
      {showDocForm && (
        <div style={{ padding: '20px', background: 'rgba(15, 10, 31, 0.6)', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.2)', marginBottom: '20px' }}>
          <h3 style={{ color: 'white', fontSize: '15px', fontWeight: '600', margin: '0 0 16px 0' }}>
            {editingDoc ? 'Editar Documento' : 'Novo Documento'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '12px', marginBottom: '6px' }}>Título *</label>
              <input
                type="text"
                value={docForm.titulo}
                onChange={(e) => setDocForm(prev => ({ ...prev, titulo: e.target.value }))}
                placeholder="Ex: Planilha de Onboarding"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#0f0a1f',
                  border: formErrors.titulo ? '1px solid #ef4444' : '1px solid rgba(139, 92, 246, 0.3)',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <ErrorMessage error={formErrors.titulo} />
            </div>
            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '12px', marginBottom: '6px' }}>URL *</label>
              <input
                type="url"
                value={docForm.url}
                onChange={(e) => setDocForm(prev => ({ ...prev, url: e.target.value }))}
                placeholder="https://docs.google.com/..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#0f0a1f',
                  border: formErrors.url ? '1px solid #ef4444' : '1px solid rgba(139, 92, 246, 0.3)',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <ErrorMessage error={formErrors.url} />
            </div>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', color: '#94a3b8', fontSize: '12px', marginBottom: '6px' }}>Descrição (opcional)</label>
            <input
              type="text"
              value={docForm.descricao}
              onChange={(e) => setDocForm(prev => ({ ...prev, descricao: e.target.value }))}
              placeholder="Breve descrição do documento"
              style={{
                width: '100%',
                padding: '10px 12px',
                background: '#0f0a1f',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '8px',
                color: 'white',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleSaveDoc}
              disabled={!docForm.titulo || !docForm.url || savingDoc}
              style={{
                padding: '10px 20px',
                background: (!docForm.titulo || !docForm.url) ? 'rgba(139, 92, 246, 0.3)' : 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontSize: '13px',
                fontWeight: '600',
                cursor: (!docForm.titulo || !docForm.url) ? 'not-allowed' : 'pointer'
              }}
            >
              {savingDoc ? 'Salvando...' : editingDoc ? 'Atualizar' : 'Adicionar'}
            </button>
            <button
              onClick={() => { setShowDocForm(false); setEditingDoc(null); setDocForm({ titulo: '', descricao: '', url: '' }); }}
              style={{
                padding: '10px 20px',
                background: 'rgba(100, 116, 139, 0.2)',
                border: '1px solid rgba(100, 116, 139, 0.3)',
                borderRadius: '8px',
                color: '#94a3b8',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Lista de documentos */}
      {loadingDocs ? (
        <div style={{ padding: '48px', textAlign: 'center' }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid rgba(139, 92, 246, 0.2)', borderTopColor: '#8b5cf6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }}></div>
        </div>
      ) : documentos.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {documentos.map(docItem => (
            <div
              key={docItem.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 16px',
                background: 'rgba(15, 10, 31, 0.6)',
                border: '1px solid rgba(139, 92, 246, 0.1)',
                borderRadius: '12px'
              }}
            >
              <div style={{
                width: '40px',
                height: '40px',
                background: 'rgba(139, 92, 246, 0.15)',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Link2 style={{ width: '20px', height: '20px', color: '#8b5cf6' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: '0 0 2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {docItem.titulo}
                </p>
                {docItem.descricao && (
                  <p style={{ color: '#64748b', fontSize: '12px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {docItem.descricao}
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <a
                  href={docItem.url}
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
                  onClick={() => { setEditingDoc(docItem); setDocForm({ titulo: docItem.titulo, descricao: docItem.descricao || '', url: docItem.url }); setShowDocForm(true); }}
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
                  onClick={() => handleDeleteDoc(docItem)}
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
          ))}
        </div>
      ) : (
        <div style={{ padding: '48px', textAlign: 'center' }}>
          <FolderOpen style={{ width: '48px', height: '48px', color: '#64748b', margin: '0 auto 16px' }} />
          <p style={{ color: '#94a3b8', fontSize: '16px', margin: '0 0 8px 0' }}>Nenhum documento</p>
          <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>Adicione planilhas, contratos ou outros arquivos específicos deste cliente</p>
        </div>
      )}
    </div>
  );
}
