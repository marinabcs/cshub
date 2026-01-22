import { useState } from 'react';
import { collection, getDocs, query, limit, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Database, RefreshCw, Copy, Check, Trash2, Download, AlertTriangle, FolderDown } from 'lucide-react';

const COLLECTIONS_TO_CLEAN = ['usuarios_lookup', 'times', 'clientes'];

export default function DebugFirestore() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [copied, setCopied] = useState(false);

  // Backup state
  const [backups, setBackups] = useState({});
  const [backupLoading, setBackupLoading] = useState({});
  const [backupComplete, setBackupComplete] = useState({});

  // Delete state
  const [deleteLoading, setDeleteLoading] = useState({});
  const [deleteResults, setDeleteResults] = useState({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  // Full cleanup state
  const [fullCleanupStep, setFullCleanupStep] = useState(0); // 0: not started, 1: backing up, 2: ready to delete, 3: deleting, 4: done
  const [fullCleanupResults, setFullCleanupResults] = useState(null);

  const runCheck = async () => {
    setLoading(true);
    const output = {
      timestamp: new Date().toISOString(),
      user: user?.email,
      collections: {}
    };

    // Check each collection
    for (const collName of [...COLLECTIONS_TO_CLEAN, 'usuarios', 'config']) {
      try {
        const collSnap = await getDocs(collection(db, collName));
        output.collections[collName] = {
          total: collSnap.size,
          sample: collSnap.docs.slice(0, 3).map(d => ({
            id: d.id,
            campos: Object.keys(d.data())
          }))
        };
      } catch (e) {
        output.collections[collName] = { error: e.message };
      }
    }

    setResults(output);
    setLoading(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(results, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Backup a single collection
  const backupCollection = async (collName) => {
    setBackupLoading(prev => ({ ...prev, [collName]: true }));
    try {
      const collSnap = await getDocs(collection(db, collName));
      const backupData = {
        timestamp: new Date().toISOString(),
        user: user?.email,
        collection: collName,
        total: collSnap.size,
        documents: []
      };

      collSnap.forEach(docSnap => {
        const data = docSnap.data();
        const serializedData = {};
        Object.entries(data).forEach(([key, value]) => {
          if (value && typeof value.toDate === 'function') {
            serializedData[key] = value.toDate().toISOString();
          } else {
            serializedData[key] = value;
          }
        });
        backupData.documents.push({
          id: docSnap.id,
          data: serializedData
        });
      });

      setBackups(prev => ({ ...prev, [collName]: backupData }));
      setBackupComplete(prev => ({ ...prev, [collName]: true }));
    } catch (e) {
      setBackups(prev => ({ ...prev, [collName]: { error: e.message } }));
    }
    setBackupLoading(prev => ({ ...prev, [collName]: false }));
  };

  // Download backup
  const downloadBackup = (collName) => {
    const backup = backups[collName];
    if (!backup || backup.error) return;

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${collName}-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Delete all documents from a collection
  const deleteCollection = async (collName) => {
    setDeleteLoading(prev => ({ ...prev, [collName]: true }));
    try {
      const collSnap = await getDocs(collection(db, collName));
      const total = collSnap.size;
      let deleted = 0;
      const errors = [];

      for (const docSnap of collSnap.docs) {
        try {
          await deleteDoc(doc(db, collName, docSnap.id));
          deleted++;
        } catch (e) {
          errors.push({ id: docSnap.id, error: e.message });
        }
      }

      setDeleteResults(prev => ({
        ...prev,
        [collName]: { success: true, total, deleted, errors: errors.length > 0 ? errors : null }
      }));
    } catch (e) {
      setDeleteResults(prev => ({
        ...prev,
        [collName]: { success: false, error: e.message }
      }));
    }
    setDeleteLoading(prev => ({ ...prev, [collName]: false }));
    setShowDeleteConfirm(null);
  };

  // Full cleanup process
  const startFullCleanup = async () => {
    setFullCleanupStep(1);
    setFullCleanupResults({ backups: {}, deletions: {} });

    // Step 1: Backup all collections
    for (const collName of COLLECTIONS_TO_CLEAN) {
      await backupCollection(collName);
    }

    setFullCleanupStep(2);
  };

  const executeFullCleanup = async () => {
    setFullCleanupStep(3);
    const results = { backups: { ...backups }, deletions: {} };

    // Step 2: Delete all collections
    for (const collName of COLLECTIONS_TO_CLEAN) {
      try {
        const collSnap = await getDocs(collection(db, collName));
        const total = collSnap.size;
        let deleted = 0;

        for (const docSnap of collSnap.docs) {
          try {
            await deleteDoc(doc(db, collName, docSnap.id));
            deleted++;
          } catch (e) {
            // Continue on error
          }
        }

        results.deletions[collName] = { total, deleted };
      } catch (e) {
        results.deletions[collName] = { error: e.message };
      }
    }

    setFullCleanupResults(results);
    setFullCleanupStep(4);
  };

  // Download all backups as a single file
  const downloadAllBackups = () => {
    const allBackups = {
      timestamp: new Date().toISOString(),
      user: user?.email,
      collections: backups
    };

    const blob = new Blob([JSON.stringify(allBackups, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `firebase-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const allBackupsReady = COLLECTIONS_TO_CLEAN.every(c => backupComplete[c]);

  return (
    <div style={{ padding: '32px', background: '#0f0a1f', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Database style={{ width: '28px', height: '28px', color: 'white' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: 'white', margin: 0 }}>Debug Firestore</h1>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: '4px 0 0 0' }}>Backup e limpeza de collections</p>
          </div>
        </div>

        <button
          onClick={runCheck}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 20px',
            background: loading ? 'rgba(139, 92, 246, 0.5)' : 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
            border: 'none',
            borderRadius: '12px',
            color: 'white',
            fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '14px'
          }}
        >
          <RefreshCw style={{ width: '18px', height: '18px', animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          {loading ? 'Verificando...' : 'Verificar Collections'}
        </button>
      </div>

      {/* Verification Results */}
      {results && (
        <div style={{
          background: 'rgba(30, 27, 75, 0.4)',
          border: '1px solid rgba(139, 92, 246, 0.15)',
          borderRadius: '20px',
          padding: '24px',
          marginBottom: '32px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ color: 'white', fontSize: '18px', margin: 0 }}>Contagem de Documentos</h2>
            <button
              onClick={copyToClipboard}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                background: copied ? 'rgba(16, 185, 129, 0.2)' : 'rgba(139, 92, 246, 0.1)',
                border: `1px solid ${copied ? 'rgba(16, 185, 129, 0.3)' : 'rgba(139, 92, 246, 0.3)'}`,
                borderRadius: '8px',
                color: copied ? '#10b981' : '#a78bfa',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              {copied ? <Check style={{ width: '14px', height: '14px' }} /> : <Copy style={{ width: '14px', height: '14px' }} />}
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
            {Object.entries(results.collections).map(([name, data]) => (
              <div
                key={name}
                style={{
                  padding: '16px',
                  background: COLLECTIONS_TO_CLEAN.includes(name) ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                  border: `1px solid ${COLLECTIONS_TO_CLEAN.includes(name) ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
                  borderRadius: '12px'
                }}
              >
                <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0 0 4px 0' }}>{name}</p>
                <p style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', margin: 0 }}>
                  {data.error ? '-' : data.total}
                </p>
                {COLLECTIONS_TO_CLEAN.includes(name) && (
                  <span style={{ color: '#ef4444', fontSize: '10px' }}>Será limpo</span>
                )}
                {!COLLECTIONS_TO_CLEAN.includes(name) && (
                  <span style={{ color: '#10b981', fontSize: '10px' }}>Protegido</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full Cleanup Section */}
      <div style={{
        background: 'rgba(239, 68, 68, 0.05)',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        borderRadius: '20px',
        padding: '24px',
        marginBottom: '32px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <AlertTriangle style={{ width: '24px', height: '24px', color: '#ef4444' }} />
          <h2 style={{ color: '#ef4444', fontSize: '18px', margin: 0 }}>Limpeza Completa</h2>
        </div>

        <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '16px' }}>
          Collections que serão limpas: <strong style={{ color: 'white' }}>{COLLECTIONS_TO_CLEAN.join(', ')}</strong>
          <br />
          <span style={{ color: '#10b981' }}>Collections protegidas: usuarios, config</span>
        </p>

        {fullCleanupStep === 0 && (
          <button
            onClick={startFullCleanup}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '12px',
              color: '#f59e0b',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            <FolderDown style={{ width: '18px', height: '18px' }} />
            Iniciar Processo de Limpeza
          </button>
        )}

        {fullCleanupStep === 1 && (
          <div style={{ padding: '16px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <RefreshCw style={{ width: '18px', height: '18px', color: '#8b5cf6', animation: 'spin 1s linear infinite' }} />
              <span style={{ color: '#a78bfa', fontWeight: '500' }}>Fazendo backup das collections...</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {COLLECTIONS_TO_CLEAN.map(c => (
                <div key={c} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {backupComplete[c] ? (
                    <Check style={{ width: '16px', height: '16px', color: '#10b981' }} />
                  ) : backupLoading[c] ? (
                    <RefreshCw style={{ width: '16px', height: '16px', color: '#8b5cf6', animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid #64748b' }} />
                  )}
                  <span style={{ color: backupComplete[c] ? '#10b981' : '#94a3b8', fontSize: '13px' }}>
                    {c} {backups[c] && !backups[c].error && `(${backups[c].total} docs)`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {fullCleanupStep === 2 && (
          <div>
            <div style={{
              padding: '16px',
              background: 'rgba(16, 185, 129, 0.1)',
              borderRadius: '12px',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <Check style={{ width: '18px', height: '18px', color: '#10b981' }} />
                <span style={{ color: '#10b981', fontWeight: '500' }}>Backup completo!</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
                {COLLECTIONS_TO_CLEAN.map(c => (
                  <span key={c} style={{ color: '#94a3b8', fontSize: '13px' }}>
                    • {c}: {backups[c]?.total || 0} documentos
                  </span>
                ))}
              </div>
              <button
                onClick={downloadAllBackups}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  background: 'rgba(16, 185, 129, 0.2)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '10px',
                  color: '#10b981',
                  fontWeight: '500',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                <Download style={{ width: '16px', height: '16px' }} />
                Download Backup Completo
              </button>
            </div>

            <div style={{
              padding: '16px',
              background: 'rgba(239, 68, 68, 0.1)',
              borderRadius: '12px',
              border: '1px solid rgba(239, 68, 68, 0.3)'
            }}>
              <p style={{ color: '#ef4444', fontSize: '14px', fontWeight: '600', margin: '0 0 8px 0' }}>
                Confirmar exclusão de TODOS os documentos?
              </p>
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 16px 0' }}>
                Total: {COLLECTIONS_TO_CLEAN.reduce((acc, c) => acc + (backups[c]?.total || 0), 0)} documentos serão excluídos permanentemente.
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setFullCleanupStep(0)}
                  style={{
                    padding: '10px 20px',
                    background: 'rgba(100, 116, 139, 0.1)',
                    border: '1px solid rgba(100, 116, 139, 0.3)',
                    borderRadius: '10px',
                    color: '#94a3b8',
                    fontWeight: '500',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={executeFullCleanup}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                    background: '#ef4444',
                    border: 'none',
                    borderRadius: '10px',
                    color: 'white',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  <Trash2 style={{ width: '16px', height: '16px' }} />
                  Executar Limpeza
                </button>
              </div>
            </div>
          </div>
        )}

        {fullCleanupStep === 3 && (
          <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <RefreshCw style={{ width: '18px', height: '18px', color: '#ef4444', animation: 'spin 1s linear infinite' }} />
              <span style={{ color: '#ef4444', fontWeight: '500' }}>Excluindo documentos...</span>
            </div>
          </div>
        )}

        {fullCleanupStep === 4 && fullCleanupResults && (
          <div style={{
            padding: '20px',
            background: 'rgba(16, 185, 129, 0.1)',
            borderRadius: '12px',
            border: '1px solid rgba(16, 185, 129, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <Check style={{ width: '24px', height: '24px', color: '#10b981' }} />
              <span style={{ color: '#10b981', fontSize: '18px', fontWeight: '600' }}>Limpeza Concluída!</span>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <p style={{ color: 'white', fontSize: '14px', fontWeight: '500', margin: '0 0 12px 0' }}>Resultado:</p>
              {Object.entries(fullCleanupResults.deletions).map(([collName, result]) => (
                <div key={collName} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: 'rgba(15, 10, 31, 0.4)',
                  borderRadius: '8px',
                  marginBottom: '8px'
                }}>
                  <span style={{ color: '#94a3b8', fontSize: '13px' }}>{collName}</span>
                  <span style={{ color: result.error ? '#ef4444' : '#10b981', fontSize: '13px', fontWeight: '500' }}>
                    {result.error ? `Erro: ${result.error}` : `${result.deleted}/${result.total} deletados`}
                  </span>
                </div>
              ))}
            </div>

            <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>
              Backup salvo em: firebase-backup-{new Date().toISOString().split('T')[0]}.json
            </p>

            <button
              onClick={() => {
                setFullCleanupStep(0);
                setBackups({});
                setBackupComplete({});
                setFullCleanupResults(null);
                runCheck();
              }}
              style={{
                marginTop: '16px',
                padding: '10px 16px',
                background: 'rgba(139, 92, 246, 0.1)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '10px',
                color: '#a78bfa',
                fontWeight: '500',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              Verificar Novamente
            </button>
          </div>
        )}
      </div>

      {/* Individual Collection Management */}
      <div style={{
        background: 'rgba(30, 27, 75, 0.4)',
        border: '1px solid rgba(139, 92, 246, 0.15)',
        borderRadius: '20px',
        padding: '24px'
      }}>
        <h2 style={{ color: 'white', fontSize: '18px', margin: '0 0 20px 0' }}>Gerenciamento Individual</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {COLLECTIONS_TO_CLEAN.map(collName => (
            <div
              key={collName}
              style={{
                padding: '16px',
                background: 'rgba(15, 10, 31, 0.6)',
                border: '1px solid rgba(139, 92, 246, 0.1)',
                borderRadius: '12px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ color: 'white', fontSize: '15px', margin: '0 0 4px 0' }}>{collName}</h3>
                  {backups[collName] && !backups[collName].error && (
                    <span style={{ color: '#10b981', fontSize: '12px' }}>
                      Backup: {backups[collName].total} docs
                    </span>
                  )}
                  {deleteResults[collName] && deleteResults[collName].success && (
                    <span style={{ color: '#10b981', fontSize: '12px', marginLeft: '12px' }}>
                      Deletados: {deleteResults[collName].deleted}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => backupCollection(collName)}
                    disabled={backupLoading[collName]}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 12px',
                      background: 'rgba(6, 182, 212, 0.1)',
                      border: '1px solid rgba(6, 182, 212, 0.3)',
                      borderRadius: '8px',
                      color: '#06b6d4',
                      fontSize: '12px',
                      cursor: backupLoading[collName] ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {backupLoading[collName] ? (
                      <RefreshCw style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <Database style={{ width: '14px', height: '14px' }} />
                    )}
                    Backup
                  </button>

                  {backups[collName] && !backups[collName].error && (
                    <button
                      onClick={() => downloadBackup(collName)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 12px',
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: '8px',
                        color: '#10b981',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      <Download style={{ width: '14px', height: '14px' }} />
                      Download
                    </button>
                  )}

                  {showDeleteConfirm === collName ? (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={() => deleteCollection(collName)}
                        disabled={deleteLoading[collName]}
                        style={{
                          padding: '8px 12px',
                          background: deleteLoading[collName] ? 'rgba(239, 68, 68, 0.5)' : '#ef4444',
                          border: 'none',
                          borderRadius: '8px',
                          color: 'white',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: deleteLoading[collName] ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {deleteLoading[collName] ? 'Deletando...' : 'Confirmar'}
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(null)}
                        style={{
                          padding: '8px 12px',
                          background: 'rgba(100, 116, 139, 0.1)',
                          border: '1px solid rgba(100, 116, 139, 0.3)',
                          borderRadius: '8px',
                          color: '#94a3b8',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowDeleteConfirm(collName)}
                      disabled={!backups[collName] || backups[collName].error}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 12px',
                        background: (!backups[collName] || backups[collName].error) ? 'rgba(100, 116, 139, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        border: `1px solid ${(!backups[collName] || backups[collName].error) ? 'rgba(100, 116, 139, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                        borderRadius: '8px',
                        color: (!backups[collName] || backups[collName].error) ? '#64748b' : '#ef4444',
                        fontSize: '12px',
                        cursor: (!backups[collName] || backups[collName].error) ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <Trash2 style={{ width: '14px', height: '14px' }} />
                      Deletar
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
