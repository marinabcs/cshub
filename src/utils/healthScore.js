/**
 * Health Score Calculator for CS Hub
 *
 * Calculates health score based on thread metrics and platform usage:
 * - Engajamento (25%): frequency of threads in last 30 days
 * - Sentimento (25%): sentiment from threads (fixed at 70 for now)
 * - Tickets abertos (20%): threads waiting for team response
 * - Tempo sem contato (15%): days since last thread
 * - Uso da Plataforma (15%): platform usage metrics (logins, pieces created, etc.)
 */

/**
 * Calculate engagement score based on thread count
 * @param {number} threadCount - Number of threads in last 30 days
 * @returns {number} Score 0-100
 */
function calcularEngajamento(threadCount) {
  if (threadCount === 0) return 0;
  if (threadCount <= 2) return 50;
  if (threadCount <= 5) return 75;
  return 100;
}

/**
 * Calculate sentiment score
 * For now, returns fixed value. Will be calculated with AI later.
 * @param {Array} threads - Array of thread objects
 * @returns {number} Score 0-100
 */
function calcularSentimento(threads) {
  // TODO: Implement sentiment analysis from threads
  // For now, return fixed value
  return 70;
}

/**
 * Calculate open tickets score based on threads waiting for team
 * @param {Array} threads - Array of thread objects
 * @returns {number} Score 0-100
 */
function calcularTicketsAbertos(threads) {
  const ticketsAguardando = threads.filter(
    t => t.status === 'aguardando_equipe' || t.status === 'ativo'
  ).length;

  if (ticketsAguardando === 0) return 100;
  if (ticketsAguardando === 1) return 75;
  if (ticketsAguardando === 2) return 50;
  return 25;
}

/**
 * Calculate time since last contact score
 * @param {Array} threads - Array of thread objects
 * @returns {number} Score 0-100
 */
function calcularTempoSemContato(threads) {
  if (threads.length === 0) return 0;

  // Find the most recent thread update
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

/**
 * Calculate platform usage score based on usage metrics
 * @param {Object} usageData - Usage data with logins, pecas_criadas, downloads, uso_ai_total
 * @param {number} totalUsers - Total number of users in the client's teams
 * @returns {number} Score 0-100
 */
function calcularUsoPlataforma(usageData, totalUsers = 1) {
  if (!usageData) return 0;

  const { logins = 0, pecas_criadas = 0, downloads = 0, uso_ai_total = 0 } = usageData;

  // No activity at all
  if (logins === 0 && pecas_criadas === 0 && downloads === 0 && uso_ai_total === 0) {
    return 0;
  }

  // Calculate average activity per user (if we know user count)
  const avgLoginsPerUser = totalUsers > 0 ? logins / totalUsers : logins;
  const avgPecasPerUser = totalUsers > 0 ? pecas_criadas / totalUsers : pecas_criadas;

  // Login score (0-30 points): ideal is 10+ logins per user in 30 days
  let loginScore = 0;
  if (avgLoginsPerUser >= 10) loginScore = 30;
  else if (avgLoginsPerUser >= 5) loginScore = 25;
  else if (avgLoginsPerUser >= 2) loginScore = 20;
  else if (avgLoginsPerUser >= 1) loginScore = 15;
  else if (logins > 0) loginScore = 10;

  // Pieces created score (0-40 points): key activity metric
  let pecasScore = 0;
  if (avgPecasPerUser >= 5) pecasScore = 40;
  else if (avgPecasPerUser >= 3) pecasScore = 35;
  else if (avgPecasPerUser >= 1) pecasScore = 25;
  else if (pecas_criadas > 0) pecasScore = 15;

  // AI usage score (0-30 points): engagement with AI features
  let aiScore = 0;
  if (uso_ai_total >= 20) aiScore = 30;
  else if (uso_ai_total >= 10) aiScore = 25;
  else if (uso_ai_total >= 5) aiScore = 20;
  else if (uso_ai_total >= 1) aiScore = 15;

  // Total score (max 100)
  return Math.min(100, loginScore + pecasScore + aiScore);
}

/**
 * Determine health status based on score
 * @param {number} score - Health score 0-100
 * @returns {string} Status: 'saudavel' | 'atencao' | 'risco' | 'critico'
 */
function determinarStatus(score) {
  if (score >= 80) return 'saudavel';
  if (score >= 60) return 'atencao';
  if (score >= 40) return 'risco';
  return 'critico';
}

/**
 * Filter threads from last 30 days
 * @param {Array} threads - Array of thread objects
 * @returns {Array} Filtered threads
 */
function filtrarThreadsUltimos30Dias(threads) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  return threads.filter(thread => {
    const createdAt = thread.created_at?.toDate?.()
      || (thread.created_at?.seconds ? new Date(thread.created_at.seconds * 1000) : null)
      || (thread.created_at ? new Date(thread.created_at) : null)
      || (thread.data_inicio?.toDate?.())
      || (thread.data_inicio?.seconds ? new Date(thread.data_inicio.seconds * 1000) : null)
      || (thread.data_inicio ? new Date(thread.data_inicio) : null);

    return createdAt && createdAt >= thirtyDaysAgo;
  });
}

/**
 * Calculate complete health score from threads and usage data
 * @param {Array} threads - Array of thread objects for the team
 * @param {Object} usageData - Optional usage data { logins, pecas_criadas, downloads, uso_ai_total }
 * @param {number} totalUsers - Optional total number of users
 * @returns {Object} { score, status, componentes }
 */
export function calcularHealthScore(threads = [], usageData = null, totalUsers = 1) {
  // Filter threads from last 30 days for engagement calculation
  const threadsRecentes = filtrarThreadsUltimos30Dias(threads);

  // Calculate individual components
  const engajamento = calcularEngajamento(threadsRecentes.length);
  const sentimento = calcularSentimento(threads);
  const ticketsAbertos = calcularTicketsAbertos(threads);
  const tempoSemContato = calcularTempoSemContato(threads);
  const usoPlataforma = calcularUsoPlataforma(usageData, totalUsers);

  // Calculate weighted score
  // Weights: engajamento 25%, sentimento 25%, tickets 20%, tempo 15%, uso_plataforma 15%
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

/**
 * Get color for health status
 * @param {string} status - Health status
 * @returns {string} Hex color
 */
export function getHealthColor(status) {
  const colors = {
    saudavel: '#10b981',
    atencao: '#f59e0b',
    risco: '#f97316',
    critico: '#ef4444'
  };
  return colors[status] || '#64748b';
}

/**
 * Get label for health status
 * @param {string} status - Health status
 * @returns {string} Human readable label
 */
export function getHealthLabel(status) {
  const labels = {
    saudavel: 'Saudável',
    atencao: 'Atenção',
    risco: 'Risco',
    critico: 'Crítico'
  };
  return labels[status] || status;
}

/**
 * Get label for component name
 * @param {string} component - Component key
 * @returns {string} Human readable label
 */
export function getComponenteLabel(component) {
  const labels = {
    engajamento: 'Engajamento',
    sentimento: 'Sentimento',
    tickets_abertos: 'Tickets Abertos',
    tempo_sem_contato: 'Tempo sem Contato',
    uso_plataforma: 'Uso da Plataforma'
  };
  return labels[component] || component;
}

/**
 * Format date for health history document ID
 * @param {Date} date - Date to format
 * @returns {string} Formatted date YYYY-MM-DD
 */
export function formatHealthHistoryDate(date = new Date()) {
  return date.toISOString().split('T')[0];
}
