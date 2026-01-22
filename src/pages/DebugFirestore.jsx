import { useState } from 'react';
import { collection, getDocs, query, limit, doc, deleteDoc, setDoc, updateDoc, Timestamp, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Database, RefreshCw, Copy, Check, Trash2, Download, AlertTriangle, FolderDown, Plus, Calendar, Activity, Circle } from 'lucide-react';
import { useCalcularTodosHealthScores } from '../hooks/useHealthScore';
import { getHealthColor, getHealthLabel } from '../utils/healthScore';
import { STATUS_OPTIONS, getStatusColor, getStatusLabel, DEFAULT_STATUS } from '../utils/clienteStatus';

const COLLECTIONS_TO_CLEAN = ['usuarios_lookup', 'times', 'clientes', 'usuarios'];

// Dados de teste para popular o Firebase
const TEST_DATA = {
  times: [
    {
      id: 'time_teste_01',
      data: {
        team_id: 'time_teste_01',
        team_name: 'Cliente Teste A',
        team_type: 'BR LCS',
        total_usuarios: 2
      }
    },
    {
      id: 'time_teste_02',
      data: {
        team_id: 'time_teste_02',
        team_name: 'Cliente Teste B',
        team_type: 'BR MMS',
        total_usuarios: 1
      }
    },
    {
      id: 'time_teste_03',
      data: {
        team_id: 'time_teste_03',
        team_name: 'Cliente Teste C',
        team_type: 'SPLA LCS',
        total_usuarios: 1
      }
    }
  ],
  usuarios_lookup: [
    {
      id: 'user_01',
      data: {
        user_id: 'user_01',
        email: 'joao@clientea.com.br',
        nome: 'João Silva',
        dominio: 'clientea.com.br',
        team_id: 'time_teste_01',
        team_name: 'Cliente Teste A',
        team_type: 'BR LCS',
        dominio_conflito: false
      }
    },
    {
      id: 'user_02',
      data: {
        user_id: 'user_02',
        email: 'maria@clientea.com.br',
        nome: 'Maria Santos',
        dominio: 'clientea.com.br',
        team_id: 'time_teste_01',
        team_name: 'Cliente Teste A',
        team_type: 'BR LCS',
        dominio_conflito: false
      }
    },
    {
      id: 'user_03',
      data: {
        user_id: 'user_03',
        email: 'pedro@clienteb.com',
        nome: 'Pedro Oliveira',
        dominio: 'clienteb.com',
        team_id: 'time_teste_02',
        team_name: 'Cliente Teste B',
        team_type: 'BR MMS',
        dominio_conflito: false
      }
    },
    {
      id: 'user_04',
      data: {
        user_id: 'user_04',
        email: 'ana@clientec.io',
        nome: 'Ana Costa',
        dominio: 'clientec.io',
        team_id: 'time_teste_03',
        team_name: 'Cliente Teste C',
        team_type: 'SPLA LCS',
        dominio_conflito: false
      }
    }
  ],
  threads: [
    {
      teamId: 'time_teste_01',
      id: 'thread_teste_001',
      data: {
        thread_id: 'thread_teste_001',
        team_id: 'time_teste_01',
        team_name: 'Cliente Teste A',
        team_type: 'BR LCS',
        assunto: 'Dúvida sobre exportação de designs',
        status: 'aguardando_cliente',
        total_mensagens: 2,
        total_msgs_cliente: 1,
        total_msgs_equipe: 1,
        dias_sem_resposta: 2,
        responsavel_email: 'cesar@trakto.io',
        responsavel_nome: 'César Oliveira',
        data_inicio: new Date('2025-01-20T10:00:00Z'),
        ultima_msg_cliente: new Date('2025-01-20T10:00:00Z'),
        ultima_msg_equipe: new Date('2025-01-20T11:30:00Z')
      }
    },
    {
      teamId: 'time_teste_02',
      id: 'thread_teste_002',
      data: {
        thread_id: 'thread_teste_002',
        team_id: 'time_teste_02',
        team_name: 'Cliente Teste B',
        team_type: 'BR MMS',
        assunto: 'Erro ao salvar projeto',
        status: 'aguardando_equipe',
        total_mensagens: 3,
        total_msgs_cliente: 2,
        total_msgs_equipe: 1,
        dias_sem_resposta: 1,
        responsavel_email: 'cesar@trakto.io',
        responsavel_nome: 'César Oliveira',
        data_inicio: new Date('2025-01-21T09:00:00Z'),
        ultima_msg_cliente: new Date('2025-01-21T14:00:00Z'),
        ultima_msg_equipe: new Date('2025-01-21T10:00:00Z')
      }
    },
    {
      teamId: 'time_teste_03',
      id: 'thread_teste_003',
      data: {
        thread_id: 'thread_teste_003',
        team_id: 'time_teste_03',
        team_name: 'Cliente Teste C',
        team_type: 'SPLA LCS',
        assunto: 'Sugestão de melhoria',
        status: 'aguardando_equipe',
        total_mensagens: 1,
        total_msgs_cliente: 1,
        total_msgs_equipe: 0,
        dias_sem_resposta: 0,
        responsavel_email: 'cesar@trakto.io',
        responsavel_nome: 'César Oliveira',
        data_inicio: new Date('2025-01-22T08:00:00Z'),
        ultima_msg_cliente: new Date('2025-01-22T08:00:00Z'),
        ultima_msg_equipe: null
      }
    }
  ]
};

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

  // Seed state
  const [seedLoading, setSeedLoading] = useState(false);
  const [seedResults, setSeedResults] = useState(null);

  // Clean old clients state
  const [cleanOldLoading, setCleanOldLoading] = useState(false);
  const [cleanOldResults, setCleanOldResults] = useState(null);
  const [oldClientsFound, setOldClientsFound] = useState(null);

  // Health Score calculation
  const { calculating: healthCalculating, results: healthResults, calcularTodos: calcularTodosHealthScores } = useCalcularTodosHealthScores();

  // Status update state
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusResults, setStatusResults] = useState(null);

  // Find and delete old clients (created before today)
  const findOldClients = async () => {
    setCleanOldLoading(true);
    setCleanOldResults(null);

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTimestamp = Timestamp.fromDate(today);

      const clientsSnap = await getDocs(collection(db, 'clientes'));
      const oldClients = [];

      clientsSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.created_at && data.created_at.toDate() < today) {
          oldClients.push({
            id: docSnap.id,
            nome: data.nome,
            created_at: data.created_at.toDate().toLocaleDateString('pt-BR')
          });
        }
      });

      setOldClientsFound(oldClients);
    } catch (e) {
      setCleanOldResults({ error: e.message });
    }

    setCleanOldLoading(false);
  };

  const deleteOldClients = async () => {
    if (!oldClientsFound || oldClientsFound.length === 0) return;

    setCleanOldLoading(true);
    let deleted = 0;
    const errors = [];

    for (const client of oldClientsFound) {
      try {
        await deleteDoc(doc(db, 'clientes', client.id));
        deleted++;
      } catch (e) {
        errors.push({ id: client.id, error: e.message });
      }
    }

    setCleanOldResults({ deleted, total: oldClientsFound.length, errors: errors.length > 0 ? errors : null });
    setOldClientsFound(null);
    setCleanOldLoading(false);
  };

  // Seed test data
  const seedTestData = async () => {
    setSeedLoading(true);
    setSeedResults(null);
    const results = {
      times: { success: 0, errors: [] },
      usuarios_lookup: { success: 0, errors: [] },
      threads: { success: 0, errors: [] }
    };

    try {
      // Seed times
      for (const item of TEST_DATA.times) {
        try {
          await setDoc(doc(db, 'times', item.id), {
            ...item.data,
            updated_at: Timestamp.now()
          });
          results.times.success++;
        } catch (e) {
          results.times.errors.push({ id: item.id, error: e.message });
        }
      }

      // Seed usuarios_lookup
      for (const item of TEST_DATA.usuarios_lookup) {
        try {
          await setDoc(doc(db, 'usuarios_lookup', item.id), {
            ...item.data,
            updated_at: Timestamp.now()
          });
          results.usuarios_lookup.success++;
        } catch (e) {
          results.usuarios_lookup.errors.push({ id: item.id, error: e.message });
        }
      }

      // Seed threads (subcollections)
      for (const item of TEST_DATA.threads) {
        try {
          const threadData = { ...item.data };
          // Convert Date objects to Timestamps
          if (threadData.data_inicio instanceof Date) {
            threadData.data_inicio = Timestamp.fromDate(threadData.data_inicio);
          }
          if (threadData.ultima_msg_cliente instanceof Date) {
            threadData.ultima_msg_cliente = Timestamp.fromDate(threadData.ultima_msg_cliente);
          }
          if (threadData.ultima_msg_equipe instanceof Date) {
            threadData.ultima_msg_equipe = Timestamp.fromDate(threadData.ultima_msg_equipe);
          }
          threadData.updated_at = Timestamp.now();

          console.log('Creating thread:', item.teamId, item.id, threadData);
          await setDoc(doc(db, 'times', item.teamId, 'threads', item.id), threadData);
          console.log('Thread created successfully:', item.id);
          results.threads.success++;
        } catch (e) {
          console.error('Error creating thread:', item.id, e);
          results.threads.errors.push({ id: item.id, error: e.message });
        }
      }

      setSeedResults(results);
    } catch (e) {
      setSeedResults({ error: e.message });
    }

    setSeedLoading(false);
  };

  const runCheck = async () => {
    setLoading(true);
    const output = {
      timestamp: new Date().toISOString(),
      user: user?.email,
      collections: {}
    };

    // Check each collection
    for (const collName of [...COLLECTIONS_TO_CLEAN, 'config']) {
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

  // Update all clients to have status "ativo"
  const updateAllClientesStatus = async () => {
    setStatusUpdating(true);
    setStatusResults(null);
    const results = [];

    try {
      const clientesSnap = await getDocs(collection(db, 'clientes'));

      for (const docSnap of clientesSnap.docs) {
        const data = docSnap.data();
        try {
          // Only update if status is missing
          if (!data.status) {
            await updateDoc(doc(db, 'clientes', docSnap.id), {
              status: DEFAULT_STATUS
            });
            results.push({
              id: docSnap.id,
              nome: data.nome || data.team_name,
              success: true,
              wasUpdated: true
            });
          } else {
            results.push({
              id: docSnap.id,
              nome: data.nome || data.team_name,
              success: true,
              wasUpdated: false,
              currentStatus: data.status
            });
          }
        } catch (e) {
          results.push({
            id: docSnap.id,
            nome: data.nome || data.team_name,
            success: false,
            error: e.message
          });
        }
      }

      setStatusResults(results);
    } catch (e) {
      setStatusResults([{ error: e.message }]);
    }

    setStatusUpdating(false);
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
          <span style={{ color: '#10b981' }}>Collection protegida: config</span>
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

      {/* Seed Test Data Section */}
      <div style={{
        background: 'rgba(16, 185, 129, 0.05)',
        border: '1px solid rgba(16, 185, 129, 0.2)',
        borderRadius: '20px',
        padding: '24px',
        marginBottom: '32px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <Plus style={{ width: '24px', height: '24px', color: '#10b981' }} />
          <h2 style={{ color: '#10b981', fontSize: '18px', margin: 0 }}>Popular Dados de Teste</h2>
        </div>

        <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '16px' }}>
          Dados que serão criados:
          <br />
          <span style={{ color: 'white' }}>• times:</span> 3 documentos (time_teste_01, time_teste_02, time_teste_03)
          <br />
          <span style={{ color: 'white' }}>• usuarios_lookup:</span> 4 documentos (user_01, user_02, user_03, user_04)
          <br />
          <span style={{ color: 'white' }}>• threads:</span> 3 documentos (subcollections em cada time)
          <br />
          <span style={{ color: '#64748b' }}>• clientes: será deixado vazio (criar via interface)</span>
        </p>

        {!seedResults && (
          <button
            onClick={seedTestData}
            disabled={seedLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              background: seedLoading ? 'rgba(16, 185, 129, 0.5)' : 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              fontWeight: '600',
              cursor: seedLoading ? 'not-allowed' : 'pointer',
              fontSize: '14px'
            }}
          >
            {seedLoading ? (
              <RefreshCw style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} />
            ) : (
              <Plus style={{ width: '18px', height: '18px' }} />
            )}
            {seedLoading ? 'Populando...' : 'Popular Dados de Teste'}
          </button>
        )}

        {seedResults && !seedResults.error && (
          <div style={{
            padding: '20px',
            background: 'rgba(16, 185, 129, 0.1)',
            borderRadius: '12px',
            border: '1px solid rgba(16, 185, 129, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <Check style={{ width: '24px', height: '24px', color: '#10b981' }} />
              <span style={{ color: '#10b981', fontSize: '18px', fontWeight: '600' }}>Dados Criados!</span>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 12px',
                background: 'rgba(15, 10, 31, 0.4)',
                borderRadius: '8px',
                marginBottom: '8px'
              }}>
                <span style={{ color: '#94a3b8', fontSize: '13px' }}>times</span>
                <span style={{ color: '#10b981', fontSize: '13px', fontWeight: '500' }}>
                  {seedResults.times.success} documentos criados
                </span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 12px',
                background: 'rgba(15, 10, 31, 0.4)',
                borderRadius: '8px',
                marginBottom: '8px'
              }}>
                <span style={{ color: '#94a3b8', fontSize: '13px' }}>usuarios_lookup</span>
                <span style={{ color: '#10b981', fontSize: '13px', fontWeight: '500' }}>
                  {seedResults.usuarios_lookup.success} documentos criados
                </span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 12px',
                background: 'rgba(15, 10, 31, 0.4)',
                borderRadius: '8px',
                marginBottom: '8px'
              }}>
                <span style={{ color: '#94a3b8', fontSize: '13px' }}>threads (subcollections)</span>
                <span style={{ color: seedResults.threads?.success > 0 ? '#10b981' : '#ef4444', fontSize: '13px', fontWeight: '500' }}>
                  {seedResults.threads?.success || 0} documentos criados
                  {seedResults.threads?.errors?.length > 0 && ` (${seedResults.threads.errors.length} erros)`}
                </span>
              </div>
              {seedResults.threads?.errors?.length > 0 && (
                <div style={{
                  padding: '10px 12px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  borderRadius: '8px',
                  marginBottom: '8px'
                }}>
                  <span style={{ color: '#ef4444', fontSize: '12px', fontWeight: '500' }}>Erros em threads:</span>
                  {seedResults.threads.errors.map((err, i) => (
                    <div key={i} style={{ color: '#94a3b8', fontSize: '11px', marginTop: '4px' }}>
                      • {err.id}: {err.error}
                    </div>
                  ))}
                </div>
              )}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 12px',
                background: 'rgba(15, 10, 31, 0.4)',
                borderRadius: '8px'
              }}>
                <span style={{ color: '#94a3b8', fontSize: '13px' }}>clientes</span>
                <span style={{ color: '#64748b', fontSize: '13px', fontWeight: '500' }}>
                  0 documentos (vazio)
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                setSeedResults(null);
                runCheck();
              }}
              style={{
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

        {seedResults && seedResults.error && (
          <div style={{
            padding: '16px',
            background: 'rgba(239, 68, 68, 0.1)',
            borderRadius: '12px',
            border: '1px solid rgba(239, 68, 68, 0.3)'
          }}>
            <span style={{ color: '#ef4444', fontSize: '14px' }}>Erro: {seedResults.error}</span>
          </div>
        )}
      </div>

      {/* Clean Old Clients Section */}
      <div style={{
        background: 'rgba(245, 158, 11, 0.05)',
        border: '1px solid rgba(245, 158, 11, 0.2)',
        borderRadius: '20px',
        padding: '24px',
        marginBottom: '32px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <Calendar style={{ width: '24px', height: '24px', color: '#f59e0b' }} />
          <h2 style={{ color: '#f59e0b', fontSize: '18px', margin: 0 }}>Limpar Clientes Antigos</h2>
        </div>

        <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '16px' }}>
          Exclui todos os documentos da collection <strong style={{ color: 'white' }}>clientes</strong> que foram criados antes de hoje.
        </p>

        {!oldClientsFound && !cleanOldResults && (
          <button
            onClick={findOldClients}
            disabled={cleanOldLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              background: cleanOldLoading ? 'rgba(245, 158, 11, 0.5)' : 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '12px',
              color: '#f59e0b',
              fontWeight: '600',
              cursor: cleanOldLoading ? 'not-allowed' : 'pointer',
              fontSize: '14px'
            }}
          >
            {cleanOldLoading ? (
              <RefreshCw style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} />
            ) : (
              <Calendar style={{ width: '18px', height: '18px' }} />
            )}
            {cleanOldLoading ? 'Buscando...' : 'Buscar Clientes Antigos'}
          </button>
        )}

        {oldClientsFound && oldClientsFound.length === 0 && (
          <div style={{
            padding: '16px',
            background: 'rgba(16, 185, 129, 0.1)',
            borderRadius: '12px',
            border: '1px solid rgba(16, 185, 129, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Check style={{ width: '20px', height: '20px', color: '#10b981' }} />
              <span style={{ color: '#10b981', fontWeight: '500' }}>Nenhum cliente antigo encontrado!</span>
            </div>
            <button
              onClick={() => setOldClientsFound(null)}
              style={{
                marginTop: '12px',
                padding: '8px 16px',
                background: 'rgba(139, 92, 246, 0.1)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '8px',
                color: '#a78bfa',
                fontWeight: '500',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              OK
            </button>
          </div>
        )}

        {oldClientsFound && oldClientsFound.length > 0 && (
          <div style={{
            padding: '16px',
            background: 'rgba(239, 68, 68, 0.1)',
            borderRadius: '12px',
            border: '1px solid rgba(239, 68, 68, 0.3)'
          }}>
            <p style={{ color: '#ef4444', fontSize: '14px', fontWeight: '600', margin: '0 0 12px 0' }}>
              {oldClientsFound.length} cliente(s) encontrado(s) criados antes de hoje:
            </p>
            <div style={{ marginBottom: '16px', maxHeight: '150px', overflowY: 'auto' }}>
              {oldClientsFound.map(client => (
                <div key={client.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'rgba(15, 10, 31, 0.4)',
                  borderRadius: '8px',
                  marginBottom: '6px'
                }}>
                  <span style={{ color: 'white', fontSize: '13px' }}>{client.nome}</span>
                  <span style={{ color: '#64748b', fontSize: '12px' }}>{client.created_at}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setOldClientsFound(null)}
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
                onClick={deleteOldClients}
                disabled={cleanOldLoading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  background: cleanOldLoading ? 'rgba(239, 68, 68, 0.5)' : '#ef4444',
                  border: 'none',
                  borderRadius: '10px',
                  color: 'white',
                  fontWeight: '600',
                  cursor: cleanOldLoading ? 'not-allowed' : 'pointer',
                  fontSize: '13px'
                }}
              >
                {cleanOldLoading ? (
                  <RefreshCw style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
                ) : (
                  <Trash2 style={{ width: '16px', height: '16px' }} />
                )}
                {cleanOldLoading ? 'Excluindo...' : 'Excluir Todos'}
              </button>
            </div>
          </div>
        )}

        {cleanOldResults && !cleanOldResults.error && (
          <div style={{
            padding: '20px',
            background: 'rgba(16, 185, 129, 0.1)',
            borderRadius: '12px',
            border: '1px solid rgba(16, 185, 129, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <Check style={{ width: '24px', height: '24px', color: '#10b981' }} />
              <span style={{ color: '#10b981', fontSize: '18px', fontWeight: '600' }}>
                {cleanOldResults.deleted}/{cleanOldResults.total} clientes excluídos!
              </span>
            </div>
            <button
              onClick={() => {
                setCleanOldResults(null);
                runCheck();
              }}
              style={{
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

        {cleanOldResults && cleanOldResults.error && (
          <div style={{
            padding: '16px',
            background: 'rgba(239, 68, 68, 0.1)',
            borderRadius: '12px',
            border: '1px solid rgba(239, 68, 68, 0.3)'
          }}>
            <span style={{ color: '#ef4444', fontSize: '14px' }}>Erro: {cleanOldResults.error}</span>
            <button
              onClick={() => setCleanOldResults(null)}
              style={{
                marginTop: '12px',
                display: 'block',
                padding: '8px 16px',
                background: 'rgba(139, 92, 246, 0.1)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '8px',
                color: '#a78bfa',
                fontWeight: '500',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              Tentar Novamente
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

      {/* Health Score Calculation Section */}
      <div style={{
        background: 'rgba(139, 92, 246, 0.05)',
        border: '1px solid rgba(139, 92, 246, 0.2)',
        borderRadius: '20px',
        padding: '24px',
        marginTop: '32px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <Activity style={{ width: '24px', height: '24px', color: '#8b5cf6' }} />
          <h2 style={{ color: '#8b5cf6', fontSize: '18px', margin: 0 }}>Calcular Health Scores</h2>
        </div>

        <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '16px' }}>
          Recalcula o Health Score de todos os clientes baseado nas threads vinculadas.
          <br />
          <span style={{ color: '#64748b', fontSize: '12px' }}>
            Considera: Engajamento (30%), Sentimento (30%), Tickets Abertos (25%), Tempo sem Contato (15%)
          </span>
        </p>

        {!healthResults && (
          <button
            onClick={calcularTodosHealthScores}
            disabled={healthCalculating}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              background: healthCalculating ? 'rgba(139, 92, 246, 0.5)' : 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              fontWeight: '600',
              cursor: healthCalculating ? 'not-allowed' : 'pointer',
              fontSize: '14px'
            }}
          >
            {healthCalculating ? (
              <RefreshCw style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} />
            ) : (
              <Activity style={{ width: '18px', height: '18px' }} />
            )}
            {healthCalculating ? 'Calculando...' : 'Calcular Todos os Health Scores'}
          </button>
        )}

        {healthResults && healthResults.length > 0 && (
          <div style={{
            padding: '20px',
            background: 'rgba(16, 185, 129, 0.1)',
            borderRadius: '12px',
            border: '1px solid rgba(16, 185, 129, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <Check style={{ width: '24px', height: '24px', color: '#10b981' }} />
              <span style={{ color: '#10b981', fontSize: '18px', fontWeight: '600' }}>
                {healthResults.filter(r => r.success).length}/{healthResults.length} Health Scores Calculados!
              </span>
            </div>

            <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '16px' }}>
              {healthResults.map((result, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    background: 'rgba(15, 10, 31, 0.4)',
                    borderRadius: '8px',
                    marginBottom: '8px'
                  }}
                >
                  <span style={{ color: 'white', fontSize: '14px' }}>{result.nome}</span>
                  {result.success ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{
                        padding: '4px 10px',
                        background: `${getHealthColor(result.status)}20`,
                        color: getHealthColor(result.status),
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>
                        {result.score}% - {getHealthLabel(result.status)}
                      </span>
                    </div>
                  ) : (
                    <span style={{ color: '#ef4444', fontSize: '12px' }}>{result.error}</span>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                // Clear results to allow recalculation
                window.location.reload();
              }}
              style={{
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
              Calcular Novamente
            </button>
          </div>
        )}
      </div>

      {/* Set Default Status Section */}
      <div style={{
        background: 'rgba(16, 185, 129, 0.05)',
        border: '1px solid rgba(16, 185, 129, 0.2)',
        borderRadius: '20px',
        padding: '24px',
        marginTop: '32px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <Circle style={{ width: '24px', height: '24px', color: '#10b981' }} />
          <h2 style={{ color: '#10b981', fontSize: '18px', margin: 0 }}>Definir Status dos Clientes</h2>
        </div>

        <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '16px' }}>
          Define o status como <strong style={{ color: '#10b981' }}>"Ativo"</strong> para todos os clientes que ainda não têm um status definido.
          <br />
          <span style={{ color: '#64748b', fontSize: '12px' }}>
            Status disponíveis: {STATUS_OPTIONS.map(s => s.label).join(', ')}
          </span>
        </p>

        {!statusResults && (
          <button
            onClick={updateAllClientesStatus}
            disabled={statusUpdating}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              background: statusUpdating ? 'rgba(16, 185, 129, 0.5)' : 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              fontWeight: '600',
              cursor: statusUpdating ? 'not-allowed' : 'pointer',
              fontSize: '14px'
            }}
          >
            {statusUpdating ? (
              <RefreshCw style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} />
            ) : (
              <Circle style={{ width: '18px', height: '18px' }} />
            )}
            {statusUpdating ? 'Atualizando...' : 'Definir Status "Ativo" para Todos'}
          </button>
        )}

        {statusResults && statusResults.length > 0 && !statusResults[0].error && (
          <div style={{
            padding: '20px',
            background: 'rgba(16, 185, 129, 0.1)',
            borderRadius: '12px',
            border: '1px solid rgba(16, 185, 129, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <Check style={{ width: '24px', height: '24px', color: '#10b981' }} />
              <span style={{ color: '#10b981', fontSize: '18px', fontWeight: '600' }}>
                {statusResults.filter(r => r.wasUpdated).length} clientes atualizados!
              </span>
            </div>

            <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '16px' }}>
              {statusResults.map((result, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    background: 'rgba(15, 10, 31, 0.4)',
                    borderRadius: '8px',
                    marginBottom: '8px'
                  }}
                >
                  <span style={{ color: 'white', fontSize: '14px' }}>{result.nome}</span>
                  {result.success ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {result.wasUpdated ? (
                        <span style={{
                          padding: '4px 10px',
                          background: 'rgba(16, 185, 129, 0.2)',
                          color: '#10b981',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '500'
                        }}>
                          Atualizado para Ativo
                        </span>
                      ) : (
                        <span style={{
                          padding: '4px 10px',
                          background: `${getStatusColor(result.currentStatus)}20`,
                          color: getStatusColor(result.currentStatus),
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '500',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: getStatusColor(result.currentStatus) }}></span>
                          Já tinha: {getStatusLabel(result.currentStatus)}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span style={{ color: '#ef4444', fontSize: '12px' }}>{result.error}</span>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => setStatusResults(null)}
              style={{
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
              Atualizar Novamente
            </button>
          </div>
        )}

        {statusResults && statusResults[0] && statusResults[0].error && (
          <div style={{
            padding: '16px',
            background: 'rgba(239, 68, 68, 0.1)',
            borderRadius: '12px',
            border: '1px solid rgba(239, 68, 68, 0.3)'
          }}>
            <span style={{ color: '#ef4444', fontSize: '14px' }}>Erro: {statusResults[0].error}</span>
            <button
              onClick={() => setStatusResults(null)}
              style={{
                marginTop: '12px',
                display: 'block',
                padding: '8px 16px',
                background: 'rgba(139, 92, 246, 0.1)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '8px',
                color: '#a78bfa',
                fontWeight: '500',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              Tentar Novamente
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
