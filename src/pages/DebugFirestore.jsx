import { useState } from 'react';
import { collection, getDocs, query, limit, doc, deleteDoc, setDoc, updateDoc, Timestamp, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Database, RefreshCw, Copy, Check, Trash2, Download, AlertTriangle, FolderDown, Plus, Calendar, Activity, Circle } from 'lucide-react';
import { useCalcularTodosHealthScores } from '../hooks/useHealthScore';
import { getHealthColor, getHealthLabel } from '../utils/healthScore';
import { STATUS_OPTIONS, getStatusColor, getStatusLabel, DEFAULT_STATUS } from '../utils/clienteStatus';

const COLLECTIONS_TO_CLEAN = ['usuarios_lookup', 'times', 'clientes', 'usuarios'];

// Gerar datas dos últimos 30 dias (formato YYYY-MM-DD)
const generateLast30Days = () => {
  const dates = [];
  for (let i = 0; i < 30; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split('T')[0]);
  }
  return dates;
};

// Gerar dados de uso aleatórios realistas
const generateUsageData = (baseMultiplier = 1) => {
  return {
    logins: Math.floor(Math.random() * 50 * baseMultiplier) + 5,
    pecas_criadas: Math.floor(Math.random() * 30 * baseMultiplier) + 2,
    downloads: Math.floor(Math.random() * 20 * baseMultiplier) + 1,
    uso_ai_total: Math.floor(Math.random() * 40 * baseMultiplier) + 3
  };
};

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

  // Usage data seed state
  const [usageSeedLoading, setUsageSeedLoading] = useState(false);
  const [usageSeedResults, setUsageSeedResults] = useState(null);

  // Metrics debug state
  const [metricsDebugClienteId, setMetricsDebugClienteId] = useState('');
  const [metricsDebugLoading, setMetricsDebugLoading] = useState(false);
  const [metricsDebugResults, setMetricsDebugResults] = useState(null);

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

  // Seed usage data for all teams/usuarios
  const seedUsageData = async () => {
    setUsageSeedLoading(true);
    setUsageSeedResults(null);
    const results = {
      clientes: 0,
      teams: 0,
      usuarios: 0,
      historico: 0,
      errors: []
    };

    try {
      console.log('[seedUsageData] Iniciando...');

      // Get all clientes first (they have the team_ids)
      const clientesSnap = await getDocs(collection(db, 'clientes'));
      results.clientes = clientesSnap.size;
      console.log(`[seedUsageData] ${clientesSnap.size} clientes encontrados`);

      if (clientesSnap.size === 0) {
        console.log('[seedUsageData] Nenhum cliente encontrado.');
        setUsageSeedResults({
          ...results,
          warning: 'Nenhum cliente encontrado na base de dados.'
        });
        setUsageSeedLoading(false);
        return;
      }

      // Collect all unique team_ids from clientes
      const allTeamIds = new Set();
      clientesSnap.docs.forEach(docSnap => {
        const data = docSnap.data();
        const teamIds = data.times || data.team_ids || [];
        teamIds.forEach(tid => allTeamIds.add(tid));
      });

      console.log(`[seedUsageData] ${allTeamIds.size} times únicos encontrados nos clientes`);

      if (allTeamIds.size === 0) {
        console.log('[seedUsageData] Nenhum time vinculado aos clientes.');
        setUsageSeedResults({
          ...results,
          warning: 'Nenhum time vinculado aos clientes. Vincule times aos clientes primeiro.'
        });
        setUsageSeedLoading(false);
        return;
      }

      results.teams = allTeamIds.size;
      const dates = generateLast30Days();
      console.log(`[seedUsageData] Gerando dados para ${dates.length} dias`);

      for (const teamId of allTeamIds) {
        console.log(`[seedUsageData] Processando time: ${teamId}`);

        // Check if usuarios already exist in times/{teamId}/usuarios
        const usuariosRef = collection(db, 'times', teamId, 'usuarios');
        const usuariosSnap = await getDocs(usuariosRef);
        let usuarios = usuariosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        console.log(`[seedUsageData] ${usuarios.length} usuários existentes para ${teamId}`);

        // If no usuarios exist, create a default one for this team
        if (usuarios.length === 0) {
          const defaultUserId = `user_${teamId}_default`;
          console.log(`[seedUsageData] Criando usuário padrão: ${defaultUserId}`);
          try {
            await setDoc(doc(db, 'times', teamId, 'usuarios', defaultUserId), {
              user_id: defaultUserId,
              team_id: teamId,
              nome: 'Usuário Padrão',
              created_at: Timestamp.now()
            });
            usuarios = [{ id: defaultUserId, user_id: defaultUserId }];
          } catch (e) {
            console.error(`[seedUsageData] Erro ao criar usuário padrão:`, e);
            results.errors.push({ team: teamId, error: e.message });
            continue;
          }
        }

        results.usuarios += usuarios.length;

        // For each usuario, create historico data for last 30 days
        for (const usuario of usuarios) {
          const userId = usuario.user_id || usuario.id;
          console.log(`[seedUsageData] Criando histórico para usuário: ${userId}`);

          // Create historico for each date
          for (const dateStr of dates) {
            try {
              const usageData = generateUsageData(1);
              await setDoc(doc(db, 'times', teamId, 'usuarios', userId, 'historico', dateStr), {
                ...usageData,
                date: dateStr,
                updated_at: Timestamp.now()
              });
              results.historico++;
            } catch (e) {
              console.error(`[seedUsageData] Erro ao criar histórico:`, e);
              results.errors.push({ team: teamId, user: userId, date: dateStr, error: e.message });
            }
          }
          console.log(`[seedUsageData] Histórico criado para ${userId}: ${dates.length} registros`);
        }
      }

      console.log('[seedUsageData] Concluído!', results);
      setUsageSeedResults(results);
    } catch (e) {
      console.error('[seedUsageData] Erro geral:', e);
      setUsageSeedResults({ error: e.message });
    }

    setUsageSeedLoading(false);
  };

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

  // Debug metrics for a specific client
  const debugClienteMetrics = async () => {
    if (!metricsDebugClienteId.trim()) {
      alert('Digite o ID do cliente');
      return;
    }

    setMetricsDebugLoading(true);
    setMetricsDebugResults(null);

    const results = {
      clienteId: metricsDebugClienteId.trim(),
      cliente: null,
      teams: [],
      usuarios: [],
      historico: [],
      aggregated: { logins: 0, pecas_criadas: 0, downloads: 0, uso_ai_total: 0 },
      errors: []
    };

    try {
      // 1. Get cliente data
      const clienteRef = doc(db, 'clientes', metricsDebugClienteId.trim());
      const clienteSnap = await getDocs(query(collection(db, 'clientes'), where('__name__', '==', metricsDebugClienteId.trim())));

      if (clienteSnap.empty) {
        results.errors.push('Cliente não encontrado');
        setMetricsDebugResults(results);
        setMetricsDebugLoading(false);
        return;
      }

      const clienteDoc = clienteSnap.docs[0];
      const clienteData = clienteDoc.data();
      results.cliente = {
        id: clienteDoc.id,
        team_name: clienteData.team_name,
        times: clienteData.times || [],
        team_ids: clienteData.team_ids || [],
        status: clienteData.status
      };

      const teamIds = clienteData.times || clienteData.team_ids || [];
      console.log('[debugClienteMetrics] Cliente:', results.cliente);
      console.log('[debugClienteMetrics] Team IDs:', teamIds);

      if (teamIds.length === 0) {
        results.errors.push('Cliente não tem times vinculados');
        setMetricsDebugResults(results);
        setMetricsDebugLoading(false);
        return;
      }

      // Calculate date 30 days ago
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      const formatDate = (d) => d.toISOString().split('T')[0];
      const minDate = formatDate(thirtyDaysAgo);

      // 2. For each team, get usuarios and their historico
      for (const teamId of teamIds) {
        const teamInfo = { teamId, usuarios: [] };

        try {
          const usuariosRef = collection(db, 'times', teamId, 'usuarios');
          const usuariosSnap = await getDocs(usuariosRef);

          console.log(`[debugClienteMetrics] Team ${teamId}: ${usuariosSnap.docs.length} usuários`);

          for (const userDoc of usuariosSnap.docs) {
            const userId = userDoc.id;
            const userData = userDoc.data();
            const userInfo = {
              userId,
              nome: userData.nome || userData.name,
              historico: [],
              subtotal: { logins: 0, pecas_criadas: 0, downloads: 0, uso_ai_total: 0 }
            };

            try {
              const historicoRef = collection(db, 'times', teamId, 'usuarios', userId, 'historico');
              const historicoSnap = await getDocs(historicoRef);

              const allDocs = historicoSnap.docs.map(d => ({ id: d.id, ...d.data() }));
              const filteredDocs = allDocs.filter(d => d.id >= minDate);

              console.log(`[debugClienteMetrics]   Usuário ${userId}: ${allDocs.length} total, ${filteredDocs.length} filtrado`);

              filteredDocs.forEach(h => {
                userInfo.historico.push({
                  date: h.id,
                  logins: h.logins || 0,
                  pecas_criadas: h.pecas_criadas || 0,
                  downloads: h.downloads || 0,
                  uso_ai_total: h.uso_ai_total || 0
                });
                userInfo.subtotal.logins += (h.logins || 0);
                userInfo.subtotal.pecas_criadas += (h.pecas_criadas || 0);
                userInfo.subtotal.downloads += (h.downloads || 0);
                userInfo.subtotal.uso_ai_total += (h.uso_ai_total || 0);

                // Aggregate
                results.aggregated.logins += (h.logins || 0);
                results.aggregated.pecas_criadas += (h.pecas_criadas || 0);
                results.aggregated.downloads += (h.downloads || 0);
                results.aggregated.uso_ai_total += (h.uso_ai_total || 0);

                results.historico.push({
                  teamId,
                  userId,
                  date: h.id,
                  logins: h.logins || 0,
                  pecas_criadas: h.pecas_criadas || 0,
                  downloads: h.downloads || 0,
                  uso_ai_total: h.uso_ai_total || 0
                });
              });

              teamInfo.usuarios.push(userInfo);
              results.usuarios.push({ teamId, userId, nome: userInfo.nome, subtotal: userInfo.subtotal, docsCount: filteredDocs.length });
            } catch (err) {
              results.errors.push(`Erro ao buscar histórico do usuário ${userId}: ${err.message}`);
            }
          }

          results.teams.push(teamInfo);
        } catch (err) {
          results.errors.push(`Erro ao buscar usuários do time ${teamId}: ${err.message}`);
        }
      }

      console.log('[debugClienteMetrics] Resultados:', results);
      setMetricsDebugResults(results);
    } catch (err) {
      results.errors.push(`Erro geral: ${err.message}`);
      setMetricsDebugResults(results);
    }

    setMetricsDebugLoading(false);
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

      {/* Seed Usage Data Section */}
      <div style={{
        background: 'rgba(6, 182, 212, 0.05)',
        border: '1px solid rgba(6, 182, 212, 0.2)',
        borderRadius: '20px',
        padding: '24px',
        marginBottom: '32px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <Activity style={{ width: '24px', height: '24px', color: '#06b6d4' }} />
          <h2 style={{ color: '#06b6d4', fontSize: '18px', margin: 0 }}>Popular Dados de Uso</h2>
        </div>

        <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '16px' }}>
          Cria dados de métricas de uso para os últimos 30 dias baseado nos clientes existentes.
          <br />
          <span style={{ color: 'white' }}>• Fonte:</span> Clientes cadastrados → array "times" de cada cliente
          <br />
          <span style={{ color: 'white' }}>• Estrutura:</span> times/{'{teamId}'}/usuarios/{'{userId}'}/historico/{'{YYYY-MM-DD}'}
          <br />
          <span style={{ color: 'white' }}>• Métricas:</span> logins, pecas_criadas, downloads, uso_ai_total
        </p>

        {!usageSeedResults && (
          <button
            onClick={seedUsageData}
            disabled={usageSeedLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              background: usageSeedLoading ? 'rgba(6, 182, 212, 0.5)' : 'linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%)',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              fontWeight: '600',
              cursor: usageSeedLoading ? 'not-allowed' : 'pointer',
              fontSize: '14px'
            }}
          >
            {usageSeedLoading ? (
              <RefreshCw style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} />
            ) : (
              <Activity style={{ width: '18px', height: '18px' }} />
            )}
            {usageSeedLoading ? 'Populando...' : 'Popular Dados de Uso (30 dias)'}
          </button>
        )}

        {usageSeedResults && usageSeedResults.warning && (
          <div style={{
            padding: '20px',
            background: 'rgba(245, 158, 11, 0.1)',
            borderRadius: '12px',
            border: '1px solid rgba(245, 158, 11, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <AlertTriangle style={{ width: '24px', height: '24px', color: '#f59e0b' }} />
              <span style={{ color: '#f59e0b', fontSize: '18px', fontWeight: '600' }}>Atenção</span>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 16px 0' }}>
              {usageSeedResults.warning}
            </p>
            <button
              onClick={() => setUsageSeedResults(null)}
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
              OK
            </button>
          </div>
        )}

        {usageSeedResults && !usageSeedResults.error && !usageSeedResults.warning && (
          <div style={{
            padding: '20px',
            background: 'rgba(6, 182, 212, 0.1)',
            borderRadius: '12px',
            border: '1px solid rgba(6, 182, 212, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <Check style={{ width: '24px', height: '24px', color: '#06b6d4' }} />
              <span style={{ color: '#06b6d4', fontSize: '18px', fontWeight: '600' }}>Dados de Uso Criados!</span>
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
                <span style={{ color: '#94a3b8', fontSize: '13px' }}>Clientes na base</span>
                <span style={{ color: '#8b5cf6', fontSize: '13px', fontWeight: '500' }}>
                  {usageSeedResults.clientes}
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
                <span style={{ color: '#94a3b8', fontSize: '13px' }}>Times processados</span>
                <span style={{ color: '#06b6d4', fontSize: '13px', fontWeight: '500' }}>
                  {usageSeedResults.teams}
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
                <span style={{ color: '#94a3b8', fontSize: '13px' }}>Usuários processados</span>
                <span style={{ color: '#06b6d4', fontSize: '13px', fontWeight: '500' }}>
                  {usageSeedResults.usuarios}
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
                <span style={{ color: '#94a3b8', fontSize: '13px' }}>Registros de histórico criados</span>
                <span style={{ color: '#10b981', fontSize: '13px', fontWeight: '500' }}>
                  {usageSeedResults.historico}
                </span>
              </div>
              {usageSeedResults.errors?.length > 0 && (
                <div style={{
                  padding: '10px 12px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  borderRadius: '8px',
                  marginBottom: '8px'
                }}>
                  <span style={{ color: '#ef4444', fontSize: '12px', fontWeight: '500' }}>
                    {usageSeedResults.errors.length} erros encontrados
                  </span>
                </div>
              )}
            </div>

            <button
              onClick={() => setUsageSeedResults(null)}
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
              Popular Novamente
            </button>
          </div>
        )}

        {usageSeedResults && usageSeedResults.error && (
          <div style={{
            padding: '16px',
            background: 'rgba(239, 68, 68, 0.1)',
            borderRadius: '12px',
            border: '1px solid rgba(239, 68, 68, 0.3)'
          }}>
            <span style={{ color: '#ef4444', fontSize: '14px' }}>Erro: {usageSeedResults.error}</span>
            <button
              onClick={() => setUsageSeedResults(null)}
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

      {/* Debug Métricas de Cliente */}
      <div style={{
        background: 'rgba(249, 115, 22, 0.05)',
        border: '1px solid rgba(249, 115, 22, 0.2)',
        borderRadius: '20px',
        padding: '24px',
        marginTop: '32px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <Activity style={{ width: '24px', height: '24px', color: '#f97316' }} />
          <h2 style={{ color: '#f97316', fontSize: '18px', margin: 0 }}>Debug Métricas de Cliente</h2>
        </div>

        <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '16px' }}>
          Verifica os dados de uso (logins, peças criadas, downloads, uso AI) diretamente do Firebase para um cliente específico.
          <br />
          <span style={{ color: '#64748b', fontSize: '12px' }}>
            Útil para investigar discrepâncias entre valores exibidos e valores esperados.
          </span>
        </p>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          <input
            type="text"
            placeholder="ID do Cliente (ex: 4CHRPWuU6VdJbP9zuOhz)"
            value={metricsDebugClienteId}
            onChange={(e) => setMetricsDebugClienteId(e.target.value)}
            style={{
              flex: 1,
              padding: '12px 16px',
              background: '#0f0a1f',
              border: '1px solid rgba(249, 115, 22, 0.3)',
              borderRadius: '12px',
              color: 'white',
              fontSize: '14px',
              outline: 'none'
            }}
          />
          <button
            onClick={debugClienteMetrics}
            disabled={metricsDebugLoading || !metricsDebugClienteId.trim()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              background: metricsDebugLoading ? 'rgba(249, 115, 22, 0.5)' : 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              fontWeight: '600',
              cursor: (metricsDebugLoading || !metricsDebugClienteId.trim()) ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              opacity: (!metricsDebugClienteId.trim()) ? 0.5 : 1
            }}
          >
            {metricsDebugLoading ? (
              <RefreshCw style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} />
            ) : (
              <Activity style={{ width: '18px', height: '18px' }} />
            )}
            {metricsDebugLoading ? 'Verificando...' : 'Verificar Métricas'}
          </button>
        </div>

        {metricsDebugResults && (
          <div style={{
            padding: '20px',
            background: 'rgba(15, 10, 31, 0.6)',
            borderRadius: '12px',
            border: '1px solid rgba(249, 115, 22, 0.2)'
          }}>
            {/* Cliente Info */}
            {metricsDebugResults.cliente && (
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ color: '#f97316', fontSize: '14px', margin: '0 0 12px 0' }}>Cliente</h3>
                <div style={{ padding: '12px', background: 'rgba(249, 115, 22, 0.1)', borderRadius: '8px' }}>
                  <p style={{ color: 'white', fontSize: '14px', margin: '0 0 4px 0' }}>
                    <strong>Nome:</strong> {metricsDebugResults.cliente.team_name}
                  </p>
                  <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0 0 4px 0' }}>
                    <strong>ID:</strong> {metricsDebugResults.cliente.id}
                  </p>
                  <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0 0 4px 0' }}>
                    <strong>Status:</strong> {metricsDebugResults.cliente.status || 'não definido'}
                  </p>
                  <p style={{ color: '#94a3b8', fontSize: '12px', margin: 0 }}>
                    <strong>Times vinculados:</strong> {metricsDebugResults.cliente.times?.length || 0}
                    {metricsDebugResults.cliente.times?.length > 0 && (
                      <span style={{ color: '#64748b', marginLeft: '8px' }}>
                        [{metricsDebugResults.cliente.times.join(', ')}]
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Usuários e Subtotais */}
            {metricsDebugResults.usuarios && metricsDebugResults.usuarios.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ color: '#f97316', fontSize: '14px', margin: '0 0 12px 0' }}>
                  Usuários ({metricsDebugResults.usuarios.length})
                </h3>
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {metricsDebugResults.usuarios.map((user, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '12px',
                        background: 'rgba(30, 27, 75, 0.4)',
                        borderRadius: '8px',
                        marginBottom: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ color: 'white', fontSize: '13px', fontWeight: '500' }}>
                          {user.nome || user.userId}
                        </span>
                        <span style={{ color: '#64748b', fontSize: '11px' }}>
                          {user.docsCount} registros em 30d
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                        <div style={{ padding: '8px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '6px', textAlign: 'center' }}>
                          <p style={{ color: '#94a3b8', fontSize: '10px', margin: 0 }}>Logins</p>
                          <p style={{ color: '#a78bfa', fontSize: '14px', fontWeight: '600', margin: 0 }}>{user.subtotal.logins}</p>
                        </div>
                        <div style={{ padding: '8px', background: 'rgba(6, 182, 212, 0.1)', borderRadius: '6px', textAlign: 'center' }}>
                          <p style={{ color: '#94a3b8', fontSize: '10px', margin: 0 }}>Peças</p>
                          <p style={{ color: '#06b6d4', fontSize: '14px', fontWeight: '600', margin: 0 }}>{user.subtotal.pecas_criadas}</p>
                        </div>
                        <div style={{ padding: '8px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '6px', textAlign: 'center' }}>
                          <p style={{ color: '#94a3b8', fontSize: '10px', margin: 0 }}>Downloads</p>
                          <p style={{ color: '#10b981', fontSize: '14px', fontWeight: '600', margin: 0 }}>{user.subtotal.downloads}</p>
                        </div>
                        <div style={{ padding: '8px', background: 'rgba(249, 115, 22, 0.1)', borderRadius: '6px', textAlign: 'center' }}>
                          <p style={{ color: '#94a3b8', fontSize: '10px', margin: 0 }}>AI</p>
                          <p style={{ color: '#f97316', fontSize: '14px', fontWeight: '600', margin: 0 }}>{user.subtotal.uso_ai_total}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Total Agregado */}
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ color: '#f97316', fontSize: '14px', margin: '0 0 12px 0' }}>Total Agregado (30 dias)</h3>
              <div style={{
                padding: '16px',
                background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.1) 0%, rgba(234, 88, 12, 0.1) 100%)',
                borderRadius: '12px',
                border: '1px solid rgba(249, 115, 22, 0.3)'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0 0 4px 0' }}>Logins</p>
                    <p style={{ color: 'white', fontSize: '24px', fontWeight: '700', margin: 0 }}>
                      {metricsDebugResults.aggregated.logins}
                    </p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0 0 4px 0' }}>Peças Criadas</p>
                    <p style={{ color: 'white', fontSize: '24px', fontWeight: '700', margin: 0 }}>
                      {metricsDebugResults.aggregated.pecas_criadas}
                    </p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0 0 4px 0' }}>Downloads</p>
                    <p style={{ color: 'white', fontSize: '24px', fontWeight: '700', margin: 0 }}>
                      {metricsDebugResults.aggregated.downloads}
                    </p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0 0 4px 0' }}>Uso AI</p>
                    <p style={{ color: 'white', fontSize: '24px', fontWeight: '700', margin: 0 }}>
                      {metricsDebugResults.aggregated.uso_ai_total}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Erros */}
            {metricsDebugResults.errors && metricsDebugResults.errors.length > 0 && (
              <div style={{
                padding: '12px',
                background: 'rgba(239, 68, 68, 0.1)',
                borderRadius: '8px',
                border: '1px solid rgba(239, 68, 68, 0.2)'
              }}>
                <p style={{ color: '#ef4444', fontSize: '12px', margin: '0 0 8px 0', fontWeight: '500' }}>
                  Erros encontrados:
                </p>
                {metricsDebugResults.errors.map((err, idx) => (
                  <p key={idx} style={{ color: '#f87171', fontSize: '11px', margin: '4px 0' }}>• {err}</p>
                ))}
              </div>
            )}

            <button
              onClick={() => setMetricsDebugResults(null)}
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
              Verificar Outro Cliente
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
