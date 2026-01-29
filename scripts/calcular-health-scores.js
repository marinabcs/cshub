/**
 * Script para calcular Health Scores de todos os clientes
 *
 * Pode ser executado:
 * 1. Via n8n após a sincronização diária
 * 2. Via Cloud Scheduler/cron
 * 3. Manualmente: node scripts/calcular-health-scores.js
 *
 * Requer variáveis de ambiente do Firebase ou arquivo de credenciais
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Inicializar Firebase Admin
let db;

function initFirebase() {
  // Tentar carregar credenciais do arquivo local
  const credentialsPath = join(__dirname, '..', 'firebase-admin-credentials.json');

  if (existsSync(credentialsPath)) {
    const serviceAccount = JSON.parse(readFileSync(credentialsPath, 'utf8'));
    initializeApp({
      credential: cert(serviceAccount)
    });
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // Usar variável de ambiente
    initializeApp();
  } else {
    throw new Error(
      'Firebase credentials not found. Either:\n' +
      '1. Create firebase-admin-credentials.json in the project root, or\n' +
      '2. Set GOOGLE_APPLICATION_CREDENTIALS environment variable'
    );
  }

  db = getFirestore();
}

// ============================================
// FUNÇÕES DE CÁLCULO (copiadas de healthScore.js)
// ============================================

function calcularEngajamento(threadCount) {
  if (threadCount === 0) return 0;
  if (threadCount <= 2) return 50;
  if (threadCount <= 5) return 75;
  return 100;
}

function calcularSentimento(threads) {
  // Analisar sentimentos das threads classificadas
  if (!threads || threads.length === 0) return 50;

  let positivos = 0;
  let negativos = 0;
  let urgentes = 0;

  threads.forEach(t => {
    if (t.sentimento === 'positivo') positivos++;
    else if (t.sentimento === 'negativo') negativos++;
    else if (t.sentimento === 'urgente') urgentes++;
  });

  const total = threads.length;
  if (total === 0) return 50;

  // Calcular score baseado na proporção
  const propPositivo = positivos / total;
  const propNegativo = (negativos + urgentes) / total;

  if (propNegativo > 0.5) return 25;
  if (propNegativo > 0.3) return 50;
  if (propPositivo > 0.5) return 90;
  if (propPositivo > 0.3) return 75;

  return 60; // Neutro
}

function calcularTicketsAbertos(threads) {
  const ticketsAguardando = threads.filter(
    t => t.status === 'aguardando_equipe' || t.status === 'ativo'
  ).length;

  if (ticketsAguardando === 0) return 100;
  if (ticketsAguardando === 1) return 75;
  if (ticketsAguardando === 2) return 50;
  return 25;
}

function calcularTempoSemContato(threads) {
  if (threads.length === 0) return 0;

  const now = new Date();
  let mostRecentDate = null;

  threads.forEach(thread => {
    const updatedAt = thread.updated_at?.toDate?.()
      || (thread.updated_at?.seconds ? new Date(thread.updated_at.seconds * 1000) : null)
      || (thread.updated_at ? new Date(thread.updated_at) : null);

    if (updatedAt && (!mostRecentDate || updatedAt > mostRecentDate)) {
      mostRecentDate = updatedAt;
    }
  });

  if (!mostRecentDate) return 0;

  const daysSinceContact = Math.floor((now - mostRecentDate) / (1000 * 60 * 60 * 24));

  if (daysSinceContact <= 3) return 100;
  if (daysSinceContact <= 7) return 75;
  if (daysSinceContact <= 14) return 50;
  if (daysSinceContact <= 30) return 25;
  return 0;
}

function calcularUsoPlataforma(usageData, totalUsers = 1) {
  if (!usageData) return 0;

  const { logins = 0, pecas_criadas = 0, downloads = 0, uso_ai_total = 0 } = usageData;

  if (logins === 0 && pecas_criadas === 0 && downloads === 0 && uso_ai_total === 0) {
    return 0;
  }

  const avgLoginsPerUser = totalUsers > 0 ? logins / totalUsers : logins;
  const avgPecasPerUser = totalUsers > 0 ? pecas_criadas / totalUsers : pecas_criadas;

  let loginScore = 0;
  if (avgLoginsPerUser >= 10) loginScore = 30;
  else if (avgLoginsPerUser >= 5) loginScore = 25;
  else if (avgLoginsPerUser >= 2) loginScore = 20;
  else if (avgLoginsPerUser >= 1) loginScore = 15;
  else if (logins > 0) loginScore = 10;

  let pecasScore = 0;
  if (avgPecasPerUser >= 5) pecasScore = 40;
  else if (avgPecasPerUser >= 3) pecasScore = 35;
  else if (avgPecasPerUser >= 1) pecasScore = 25;
  else if (pecas_criadas > 0) pecasScore = 15;

  let aiScore = 0;
  if (uso_ai_total >= 20) aiScore = 30;
  else if (uso_ai_total >= 10) aiScore = 25;
  else if (uso_ai_total >= 5) aiScore = 20;
  else if (uso_ai_total >= 1) aiScore = 15;

  return Math.min(100, loginScore + pecasScore + aiScore);
}

function determinarStatus(score) {
  if (score >= 80) return 'saudavel';
  if (score >= 60) return 'atencao';
  if (score >= 40) return 'risco';
  return 'critico';
}

function filtrarThreadsUltimos30Dias(threads) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  return threads.filter(thread => {
    const createdAt = thread.created_at?.toDate?.()
      || (thread.created_at?.seconds ? new Date(thread.created_at.seconds * 1000) : null)
      || (thread.created_at ? new Date(thread.created_at) : null);

    return createdAt && createdAt >= thirtyDaysAgo;
  });
}

function calcularHealthScore(threads = [], usageData = null, totalUsers = 1) {
  const threadsRecentes = filtrarThreadsUltimos30Dias(threads);

  const engajamento = calcularEngajamento(threadsRecentes.length);
  const sentimento = calcularSentimento(threads);
  const ticketsAbertos = calcularTicketsAbertos(threads);
  const tempoSemContato = calcularTempoSemContato(threads);
  const usoPlataforma = calcularUsoPlataforma(usageData, totalUsers);

  const score = Math.round(
    (engajamento * 0.25) +
    (sentimento * 0.25) +
    (ticketsAbertos * 0.20) +
    (tempoSemContato * 0.15) +
    (usoPlataforma * 0.15)
  );

  const status = determinarStatus(score);

  return {
    score,
    status,
    componentes: {
      engajamento,
      sentimento,
      tickets_abertos: ticketsAbertos,
      tempo_sem_contato: tempoSemContato,
      uso_plataforma: usoPlataforma
    }
  };
}

function formatHealthHistoryDate(date = new Date()) {
  return date.toISOString().split('T')[0];
}

// ============================================
// FUNÇÃO PRINCIPAL
// ============================================

async function calcularTodosHealthScores() {
  console.log('='.repeat(60));
  console.log('CÁLCULO DIÁRIO DE HEALTH SCORES');
  console.log(`Iniciado em: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  const results = {
    total: 0,
    calculados: 0,
    pulados: 0,
    erros: 0,
    detalhes: []
  };

  try {
    // 1. Buscar todos os clientes
    const clientesSnap = await db.collection('clientes').get();
    results.total = clientesSnap.size;

    console.log(`\nEncontrados ${results.total} clientes\n`);

    for (const clienteDoc of clientesSnap.docs) {
      const clienteData = clienteDoc.data();
      const clienteId = clienteDoc.id;
      const clienteNome = clienteData.team_name || clienteData.nome || clienteId;

      // Pular clientes inativos ou cancelados
      if (clienteData.status === 'inativo' || clienteData.status === 'cancelado') {
        console.log(`⏭️  ${clienteNome} - Pulado (${clienteData.status})`);
        results.pulados++;
        results.detalhes.push({
          id: clienteId,
          nome: clienteNome,
          status: clienteData.status,
          pulado: true
        });
        continue;
      }

      try {
        const teamIds = clienteData.times || [];
        if (teamIds.length === 0 && clienteData.team_id) {
          teamIds.push(clienteData.team_id);
        }
        if (teamIds.length === 0) {
          teamIds.push(clienteId);
        }

        // 2. Buscar threads (nova estrutura)
        const allThreads = [];
        const chunkSize = 10;

        for (let i = 0; i < teamIds.length; i += chunkSize) {
          const chunk = teamIds.slice(i, i + chunkSize);
          const threadsSnap = await db.collection('threads')
            .where('team_id', 'in', chunk)
            .get();
          allThreads.push(...threadsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        }

        // 3. Buscar métricas de uso (últimos 30 dias)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        let allMetricas = [];
        for (let i = 0; i < teamIds.length; i += chunkSize) {
          const chunk = teamIds.slice(i, i + chunkSize);
          const metricasSnap = await db.collection('metricas_diarias')
            .where('team_id', 'in', chunk)
            .where('data', '>=', thirtyDaysAgo)
            .get();
          allMetricas.push(...metricasSnap.docs.map(d => d.data()));
        }

        // 4. Contar usuários
        let totalUsers = 0;
        for (let i = 0; i < teamIds.length; i += chunkSize) {
          const chunk = teamIds.slice(i, i + chunkSize);
          const usersSnap = await db.collection('usuarios_lookup')
            .where('team_id', 'in', chunk)
            .get();
          totalUsers += usersSnap.size;
        }

        // 5. Agregar métricas
        const usageData = allMetricas.reduce((acc, d) => ({
          logins: acc.logins + (d.logins || 0),
          pecas_criadas: acc.pecas_criadas + (d.pecas_criadas || 0),
          downloads: acc.downloads + (d.downloads || 0),
          uso_ai_total: acc.uso_ai_total + (d.uso_ai_total || 0)
        }), { logins: 0, pecas_criadas: 0, downloads: 0, uso_ai_total: 0 });

        // 6. Calcular health score
        const result = calcularHealthScore(allThreads, usageData, totalUsers);

        // 7. Salvar no cliente
        await db.collection('clientes').doc(clienteId).update({
          health_score: result.score,
          health_status: result.status,
          health_updated_at: Timestamp.now()
        });

        // 8. Salvar no histórico
        const today = formatHealthHistoryDate();
        await db.collection('clientes').doc(clienteId)
          .collection('health_history').doc(today)
          .set({
            hist_date: today,
            hist_score: result.score,
            hist_status: result.status,
            hist_componentes: result.componentes,
            created_at: Timestamp.now()
          });

        const emoji = result.status === 'saudavel' ? '🟢' :
                      result.status === 'atencao' ? '🟡' :
                      result.status === 'risco' ? '🟠' : '🔴';

        console.log(`${emoji} ${clienteNome} - Score: ${result.score} (${result.status})`);

        results.calculados++;
        results.detalhes.push({
          id: clienteId,
          nome: clienteNome,
          score: result.score,
          status: result.status,
          componentes: result.componentes,
          sucesso: true
        });

      } catch (err) {
        console.error(`❌ ${clienteNome} - Erro: ${err.message}`);
        results.erros++;
        results.detalhes.push({
          id: clienteId,
          nome: clienteNome,
          erro: err.message,
          sucesso: false
        });
      }
    }

  } catch (err) {
    console.error('Erro fatal:', err);
    throw err;
  }

  console.log('\n' + '='.repeat(60));
  console.log('RESUMO');
  console.log('='.repeat(60));
  console.log(`Total de clientes: ${results.total}`);
  console.log(`Calculados com sucesso: ${results.calculados}`);
  console.log(`Pulados (inativos/cancelados): ${results.pulados}`);
  console.log(`Erros: ${results.erros}`);
  console.log(`Finalizado em: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  return results;
}

// ============================================
// EXECUÇÃO
// ============================================

async function main() {
  try {
    initFirebase();
    const results = await calcularTodosHealthScores();

    // Retornar código de saída baseado em erros
    if (results.erros > 0) {
      process.exit(1);
    }
    process.exit(0);

  } catch (err) {
    console.error('Erro na execução:', err);
    process.exit(1);
  }
}

// Exportar para uso como módulo ou via HTTP (Cloud Functions)
export { calcularTodosHealthScores, initFirebase };

// Executar se chamado diretamente
main();
