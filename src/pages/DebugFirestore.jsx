import { useState } from 'react';
import { collection, getDocs, query, limit, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Database, RefreshCw, Copy, Check, Trash2, Download, AlertTriangle } from 'lucide-react';

export default function DebugFirestore() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [copied, setCopied] = useState(false);

  // Backup and cleanup state
  const [backup, setBackup] = useState(null);
  const [backupCopied, setBackupCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteResult, setDeleteResult] = useState(null);

  const runCheck = async () => {
    setLoading(true);
    const output = {
      timestamp: new Date().toISOString(),
      user: user?.email,
      collections: {}
    };

    // 1. Check clientes
    try {
      const clientesSnap = await getDocs(collection(db, 'clientes'));
      const clientes = clientesSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      output.collections.clientes = {
        total: clientes.length,
        sample: clientes.slice(0, 3).map(c => ({
          id: c.id,
          campos: Object.keys(c),
          team_name: c.team_name,
          times: c.times,
          team_type: c.team_type,
          health_score: c.health_score,
          responsavel_nome: c.responsavel_nome
        })),
        allNames: clientes.map(c => ({ id: c.id, name: c.team_name }))
      };
    } catch (e) {
      output.collections.clientes = { error: e.message };
    }

    // 2. Check usuarios_lookup
    try {
      const usersSnap = await getDocs(collection(db, 'usuarios_lookup'));
      const users = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const domains = {};
      users.forEach(u => {
        const domain = (u.email || '').split('@')[1] || 'unknown';
        domains[domain] = (domains[domain] || 0) + 1;
      });

      const targetDomains = ['stone.com.br', 'omc.com', 'inter.co', 'obramax.com.br', 'unisa.br', 'trakto.io'];
      const targetDomainsCount = {};
      targetDomains.forEach(d => {
        targetDomainsCount[d] = domains[d] || 0;
      });

      output.collections.usuarios_lookup = {
        total: users.length,
        targetDomains: targetDomainsCount,
        topDomains: Object.entries(domains).sort((a, b) => b[1] - a[1]).slice(0, 20),
        sample: users.slice(0, 3).map(u => ({
          id: u.id,
          campos: Object.keys(u),
          email: u.email,
          nome: u.nome || u.name,
          team_id: u.team_id,
          team_name: u.team_name,
          status: u.status,
          created_at: u.created_at,
          deleted_at: u.deleted_at
        }))
      };
    } catch (e) {
      output.collections.usuarios_lookup = { error: e.message };
    }

    // 3. Check times
    try {
      const timesSnap = await getDocs(collection(db, 'times'));
      const times = timesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      output.collections.times = {
        total: times.length,
        sample: times.slice(0, 5).map(t => ({
          id: t.id,
          campos: Object.keys(t),
          name: t.name || t.team_name,
          team_type: t.team_type
        })),
        allTimes: times.map(t => ({ id: t.id, name: t.name || t.team_name, type: t.team_type }))
      };
    } catch (e) {
      output.collections.times = { error: e.message };
    }

    // 4. Check for subcollection usuarios
    try {
      const clientesSnap = await getDocs(query(collection(db, 'clientes'), limit(3)));
      const subcollectionCheck = [];

      for (const clienteDoc of clientesSnap.docs) {
        try {
          const subUsersSnap = await getDocs(collection(db, 'clientes', clienteDoc.id, 'usuarios'));
          subcollectionCheck.push({
            clienteId: clienteDoc.id,
            clienteName: clienteDoc.data().team_name,
            usuariosCount: subUsersSnap.size,
            sample: subUsersSnap.docs.slice(0, 2).map(d => ({ id: d.id, campos: Object.keys(d.data()) }))
          });
        } catch (e) {
          subcollectionCheck.push({
            clienteId: clienteDoc.id,
            error: e.message
          });
        }
      }

      output.collections.subcollection_usuarios = subcollectionCheck;
    } catch (e) {
      output.collections.subcollection_usuarios = { error: e.message };
    }

    // 5. Search for specific clients
    try {
      const searchTerms = ['stone', 'omnicom', 'omc', 'inter', 'obramax', 'unisa'];
      const clientesSnap = await getDocs(collection(db, 'clientes'));
      const searchResults = {};

      searchTerms.forEach(term => {
        const found = [];
        clientesSnap.forEach(doc => {
          const data = doc.data();
          const name = (data.team_name || doc.id || '').toLowerCase();
          if (name.includes(term)) {
            found.push({ id: doc.id, name: data.team_name, times: data.times });
          }
        });
        searchResults[term] = found.length > 0 ? found : 'Não encontrado';
      });

      output.searchResults = searchResults;
    } catch (e) {
      output.searchResults = { error: e.message };
    }

    setResults(output);
    setLoading(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(results, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Backup clientes collection
  const runBackup = async () => {
    setLoading(true);
    try {
      const clientesSnap = await getDocs(collection(db, 'clientes'));
      const backupData = {
        timestamp: new Date().toISOString(),
        user: user?.email,
        collection: 'clientes',
        total: clientesSnap.size,
        documents: []
      };

      clientesSnap.forEach(docSnap => {
        const data = docSnap.data();
        // Convert Firestore timestamps to ISO strings for JSON serialization
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

      setBackup(backupData);
    } catch (e) {
      setBackup({ error: e.message });
    }
    setLoading(false);
  };

  const copyBackup = () => {
    navigator.clipboard.writeText(JSON.stringify(backup, null, 2));
    setBackupCopied(true);
    setTimeout(() => setBackupCopied(false), 2000);
  };

  const downloadBackup = () => {
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clientes-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Delete all documents from clientes collection
  const deleteAllClientes = async () => {
    setDeleteLoading(true);
    setDeleteResult(null);

    try {
      const clientesSnap = await getDocs(collection(db, 'clientes'));
      const totalToDelete = clientesSnap.size;
      let deleted = 0;
      const errors = [];

      for (const docSnap of clientesSnap.docs) {
        try {
          await deleteDoc(doc(db, 'clientes', docSnap.id));
          deleted++;
        } catch (e) {
          errors.push({ id: docSnap.id, error: e.message });
        }
      }

      setDeleteResult({
        success: true,
        totalFound: totalToDelete,
        deleted: deleted,
        errors: errors.length > 0 ? errors : null,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      setDeleteResult({
        success: false,
        error: e.message
      });
    }

    setDeleteLoading(false);
    setShowDeleteConfirm(false);
  };

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
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: '4px 0 0 0' }}>Verificar, backup e limpeza de collections</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
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
            {loading ? 'Verificando...' : 'Verificar Estrutura'}
          </button>

          {results && (
            <button
              onClick={copyToClipboard}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 20px',
                background: copied ? 'rgba(16, 185, 129, 0.2)' : 'rgba(139, 92, 246, 0.1)',
                border: `1px solid ${copied ? 'rgba(16, 185, 129, 0.3)' : 'rgba(139, 92, 246, 0.3)'}`,
                borderRadius: '12px',
                color: copied ? '#10b981' : '#a78bfa',
                fontWeight: '500',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              {copied ? <Check style={{ width: '18px', height: '18px' }} /> : <Copy style={{ width: '18px', height: '18px' }} />}
              {copied ? 'Copiado!' : 'Copiar Resultado'}
            </button>
          )}
        </div>
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
          <h2 style={{ color: 'white', fontSize: '18px', margin: '0 0 16px 0' }}>Resultado da Verificação</h2>
          <pre style={{
            color: '#e2e8f0',
            fontSize: '12px',
            lineHeight: 1.5,
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
            maxHeight: '400px',
            overflow: 'auto'
          }}>
            {JSON.stringify(results, null, 2)}
          </pre>
        </div>
      )}

      {/* Backup & Cleanup Section */}
      <div style={{
        background: 'rgba(239, 68, 68, 0.05)',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        borderRadius: '20px',
        padding: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <AlertTriangle style={{ width: '24px', height: '24px', color: '#ef4444' }} />
          <h2 style={{ color: '#ef4444', fontSize: '18px', margin: 0 }}>Backup & Limpeza - Collection `clientes`</h2>
        </div>

        <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '20px' }}>
          Use estas ferramentas para fazer backup e limpar a collection `clientes`.
          <strong style={{ color: '#ef4444' }}> ATENÇÃO: A exclusão é permanente!</strong>
        </p>

        {/* Backup Section */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ color: 'white', fontSize: '14px', marginBottom: '12px' }}>1. Fazer Backup</h3>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={runBackup}
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                background: 'rgba(6, 182, 212, 0.1)',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                borderRadius: '12px',
                color: '#06b6d4',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '13px'
              }}
            >
              <Database style={{ width: '16px', height: '16px' }} />
              Gerar Backup
            </button>

            {backup && !backup.error && (
              <>
                <button
                  onClick={copyBackup}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 16px',
                    background: backupCopied ? 'rgba(16, 185, 129, 0.2)' : 'rgba(139, 92, 246, 0.1)',
                    border: `1px solid ${backupCopied ? 'rgba(16, 185, 129, 0.3)' : 'rgba(139, 92, 246, 0.3)'}`,
                    borderRadius: '12px',
                    color: backupCopied ? '#10b981' : '#a78bfa',
                    fontWeight: '500',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  {backupCopied ? <Check style={{ width: '16px', height: '16px' }} /> : <Copy style={{ width: '16px', height: '16px' }} />}
                  {backupCopied ? 'Copiado!' : 'Copiar JSON'}
                </button>

                <button
                  onClick={downloadBackup}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 16px',
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '12px',
                    color: '#10b981',
                    fontWeight: '500',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  <Download style={{ width: '16px', height: '16px' }} />
                  Download JSON
                </button>
              </>
            )}
          </div>

          {backup && (
            <div style={{
              marginTop: '12px',
              padding: '12px',
              background: backup.error ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
              borderRadius: '12px',
              border: `1px solid ${backup.error ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`
            }}>
              {backup.error ? (
                <p style={{ color: '#ef4444', margin: 0, fontSize: '13px' }}>Erro: {backup.error}</p>
              ) : (
                <>
                  <p style={{ color: '#10b981', margin: '0 0 8px 0', fontSize: '13px', fontWeight: '500' }}>
                    Backup gerado com sucesso!
                  </p>
                  <p style={{ color: '#94a3b8', margin: 0, fontSize: '12px' }}>
                    {backup.total} documento(s) salvos em {backup.timestamp}
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Delete Section */}
        <div>
          <h3 style={{ color: 'white', fontSize: '14px', marginBottom: '12px' }}>2. Limpar Collection</h3>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={!backup || backup.error}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                background: (!backup || backup.error) ? 'rgba(100, 116, 139, 0.2)' : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${(!backup || backup.error) ? 'rgba(100, 116, 139, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                borderRadius: '12px',
                color: (!backup || backup.error) ? '#64748b' : '#ef4444',
                fontWeight: '500',
                cursor: (!backup || backup.error) ? 'not-allowed' : 'pointer',
                fontSize: '13px'
              }}
            >
              <Trash2 style={{ width: '16px', height: '16px' }} />
              {(!backup || backup.error) ? 'Faça o backup primeiro' : 'Deletar Todos os Clientes'}
            </button>
          ) : (
            <div style={{
              padding: '16px',
              background: 'rgba(239, 68, 68, 0.1)',
              borderRadius: '12px',
              border: '1px solid rgba(239, 68, 68, 0.3)'
            }}>
              <p style={{ color: '#ef4444', fontSize: '14px', fontWeight: '600', margin: '0 0 8px 0' }}>
                Confirmar exclusão de TODOS os documentos da collection `clientes`?
              </p>
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 16px 0' }}>
                Esta ação não pode ser desfeita. Você tem um backup com {backup?.total || 0} documento(s).
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
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
                  onClick={deleteAllClientes}
                  disabled={deleteLoading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                    background: deleteLoading ? 'rgba(239, 68, 68, 0.5)' : '#ef4444',
                    border: 'none',
                    borderRadius: '10px',
                    color: 'white',
                    fontWeight: '600',
                    cursor: deleteLoading ? 'not-allowed' : 'pointer',
                    fontSize: '13px'
                  }}
                >
                  {deleteLoading ? (
                    <>
                      <RefreshCw style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
                      Deletando...
                    </>
                  ) : (
                    <>
                      <Trash2 style={{ width: '16px', height: '16px' }} />
                      Confirmar Exclusão
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {deleteResult && (
            <div style={{
              marginTop: '16px',
              padding: '16px',
              background: deleteResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              borderRadius: '12px',
              border: `1px solid ${deleteResult.success ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
            }}>
              {deleteResult.success ? (
                <>
                  <p style={{ color: '#10b981', fontSize: '14px', fontWeight: '600', margin: '0 0 8px 0' }}>
                    Limpeza concluída!
                  </p>
                  <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>
                    {deleteResult.deleted} de {deleteResult.totalFound} documento(s) removidos.
                  </p>
                  {deleteResult.errors && (
                    <p style={{ color: '#f59e0b', fontSize: '12px', marginTop: '8px' }}>
                      {deleteResult.errors.length} erro(s) ocorreram durante a exclusão.
                    </p>
                  )}
                </>
              ) : (
                <p style={{ color: '#ef4444', fontSize: '13px', margin: 0 }}>
                  Erro: {deleteResult.error}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
