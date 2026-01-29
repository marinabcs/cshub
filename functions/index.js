/**
 * Cloud Functions para CS Hub
 *
 * Funções agendadas para cálculo de Health Scores
 * Executa diariamente às 7:30 e 13:30 (horário de Brasília)
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onRequest } from 'firebase-functions/v2/https';

// Inicializar Firebase Admin
initializeApp();
const db = getFirestore();

// ============================================
// FUNÇÕES DE CÁLCULO DE HEALTH SCORE
// ============================================

function calcularEngajamento(threadCount) {
  if (threadCount === 0) return 0;
  if (threadCount <= 2) return 50;
  if (threadCount <= 5) return 75;
  return 100;
}

function calcularSentimento(threads) {
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

  const propPositivo = positivos / total;
  const propNegativo = (negativos + urgentes) / total;

  if (propNegativo > 0.5) return 25;
  if (propNegativo > 0.3) return 50;
  if (propPositivo > 0.5) return 90;
  if (propPositivo > 0.3) return 75;

  return 60;
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
// FUNÇÃO PRINCIPAL DE CÁLCULO
// ============================================

async function calcularTodosHealthScores() {
  console.log('='.repeat(60));
  console.log('CÁLCULO DE HEALTH SCORES - Cloud Function');
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

    console.log(`Encontrados ${results.total} clientes`);

    for (const clienteDoc of clientesSnap.docs) {
      const clienteData = clienteDoc.data();
      const clienteId = clienteDoc.id;
      const clienteNome = clienteData.team_name || clienteData.nome || clienteId;

      // Pular clientes inativos ou cancelados
      if (clienteData.status === 'inativo' || clienteData.status === 'cancelado') {
        console.log(`Pulado: ${clienteNome} (${clienteData.status})`);
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
        // Determinar teamIds
        let teamIds = clienteData.times || [];
        if (teamIds.length === 0 && clienteData.team_id) {
          teamIds = [clienteData.team_id];
        }
        if (teamIds.length === 0) {
          teamIds = [clienteId];
        }

        // 2. Buscar threads (estrutura: collection raiz 'threads')
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

        const emoji = result.status === 'saudavel' ? 'OK' :
                      result.status === 'atencao' ? 'ATENCAO' :
                      result.status === 'risco' ? 'RISCO' : 'CRITICO';

        console.log(`[${emoji}] ${clienteNome} - Score: ${result.score} (${result.status})`);

        results.calculados++;
        results.detalhes.push({
          id: clienteId,
          nome: clienteNome,
          score: result.score,
          status: result.status,
          sucesso: true
        });

      } catch (err) {
        console.error(`ERRO: ${clienteNome} - ${err.message}`);
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

  console.log('='.repeat(60));
  console.log('RESUMO');
  console.log(`Total: ${results.total} | Calculados: ${results.calculados} | Pulados: ${results.pulados} | Erros: ${results.erros}`);
  console.log(`Finalizado em: ${new Date().toISOString()}`);
  console.log('='.repeat(60));

  return results;
}

// ============================================
// CLOUD FUNCTIONS
// ============================================

/**
 * Função agendada para 7:30 (horário de Brasília)
 * Roda após a sincronização das 7h
 */
export const healthScoreManha = onSchedule({
  schedule: '30 7 * * *',
  timeZone: 'America/Sao_Paulo',
  region: 'southamerica-east1'
}, async (event) => {
  console.log('Executando cálculo de Health Score - Manhã (7:30)');
  await calcularTodosHealthScores();
});

/**
 * Função agendada para 13:30 (horário de Brasília)
 * Roda após a sincronização das 13h
 */
export const healthScoreTarde = onSchedule({
  schedule: '30 13 * * *',
  timeZone: 'America/Sao_Paulo',
  region: 'southamerica-east1'
}, async (event) => {
  console.log('Executando cálculo de Health Score - Tarde (13:30)');
  await calcularTodosHealthScores();
});

/**
 * Endpoint HTTP para execução manual ou via webhook
 * POST /calcularHealthScores
 */
export const calcularHealthScores = onRequest({
  region: 'southamerica-east1',
  cors: true
}, async (req, res) => {
  // Verificar método
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido. Use POST.' });
    return;
  }

  // Verificar autenticação básica (opcional - adicionar token se necessário)
  const authHeader = req.headers.authorization;
  const expectedToken = process.env.HEALTH_SCORE_TOKEN;

  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    res.status(401).json({ error: 'Não autorizado' });
    return;
  }

  try {
    console.log('Execução manual via HTTP');
    const results = await calcularTodosHealthScores();
    res.status(200).json({
      success: true,
      message: 'Health scores calculados com sucesso',
      results: {
        total: results.total,
        calculados: results.calculados,
        pulados: results.pulados,
        erros: results.erros
      }
    });
  } catch (err) {
    console.error('Erro na execução:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});
