/**
 * Email Filters - Motor de filtragem de threads/conversas
 *
 * Filtra emails irrelevantes (newsletters, auto-replies, spam)
 * para melhorar qualidade da classificação IA e alertas.
 */

// Configuração padrão de filtros
export const DEFAULT_EMAIL_FILTERS = {
  filtro_ativo: true,

  // Prefixos de email a bloquear (ex: noreply@qualquerdominio.com)
  dominios_bloqueados: [
    'noreply@',
    'no-reply@',
    'no_reply@',
    'newsletter@',
    'marketing@',
    'mailer-daemon@',
    'postmaster@',
    'notifications@',
    'notification@',
    'donotreply@',
    'do-not-reply@',
    'bounce@',
    'auto-reply@',
    'autoresponder@',
    'updates@',
    'news@',
    'promo@',
    'promocao@',
    'campaigns@',
    'campaign@',
    'digest@',
    'alerts@',
    'system@',
    'admin@',
    'suporte-noreply@',
    'comunicacao@',
  ],

  // Domínios inteiros a bloquear (tudo de @dominio.com)
  dominios_completos_bloqueados: [
    'mailchimp.com',
    'sendgrid.net',
    'mandrillapp.com',
    'constantcontact.com',
    'mailgun.org',
    'amazonses.com',
    'bounce.google.com',
    'postmarkapp.com',
    'sendinblue.com',
    'mailjet.com',
    'sparkpostmail.com',
    'mcsv.net',
    'hubspotmail.com',
    'intercom-mail.com',
  ],

  // Palavras-chave no assunto que indicam email irrelevante
  palavras_chave_assunto: [
    'unsubscribe',
    'newsletter',
    'descadastrar',
    'cancelar inscricao',
    'cancelar inscrição',
    'promotional',
    'promocional',
    'weekly digest',
    'daily digest',
    'resumo semanal',
    'resumo diario',
    'out of office',
    'fora do escritorio',
    'fora do escritório',
    'auto-reply',
    'auto reply',
    'resposta automatica',
    'resposta automática',
    'delivery status notification',
    'failure notice',
    'mail delivery failed',
    'automatic reply',
    'autoreply',
    'nao responda este email',
    'não responda este email',
    'do not reply',
    'this is an automated message',
    'mensagem automatica',
    'mensagem automática',
    'email automatico',
    'email automático',
  ],

  // Detecções automáticas
  detectar_auto_reply: true,
  detectar_bulk_email: true,
};

// Padrões regex para detecção de auto-reply
const AUTO_REPLY_PATTERNS = [
  /^(re:\s*)?out of office/i,
  /^(re:\s*)?fora do escrit[oó]rio/i,
  /^auto[:\s-]/i,
  /^automatic reply/i,
  /^resposta autom[aá]tica/i,
  /^(re:\s*)?away from/i,
  /^(re:\s*)?ausente/i,
  /\[auto[- ]?reply\]/i,
  /\[resposta autom[aá]tica\]/i,
];

/**
 * Extrai o email do remetente de uma thread
 * Tenta vários campos possíveis no documento
 */
function extractSenderEmail(thread) {
  // Campos possíveis onde o email do remetente pode estar
  const email =
    thread.remetente_email ||
    thread.sender_email ||
    thread.from ||
    thread.email_remetente ||
    '';

  return email.toLowerCase().trim();
}

/**
 * Extrai o domínio de um email
 */
function extractDomain(email) {
  if (!email || !email.includes('@')) return '';
  return email.split('@')[1].toLowerCase().trim();
}

/**
 * Verifica se uma thread deve ser filtrada
 * @param {Object} thread - Documento da thread
 * @param {Object} filterConfig - Configuração de filtros
 * @returns {{ filtered: boolean, reason: string|null }}
 */
export function isThreadFiltered(thread, filterConfig) {
  if (!thread) return { filtered: false, reason: null };

  // 1. Filtrado manualmente pelo CS
  if (thread.filtrado_manual === true) {
    return { filtered: true, reason: 'manual' };
  }

  // Se filtros desativados, não filtrar automaticamente
  if (!filterConfig || filterConfig.filtro_ativo === false) {
    return { filtered: false, reason: null };
  }

  const senderEmail = extractSenderEmail(thread);
  const senderDomain = extractDomain(senderEmail);
  const assunto = (thread.assunto || '').toLowerCase();
  const snippet = (thread.snippet || '').toLowerCase();

  // 2. Verificar prefixos de email bloqueados
  if (senderEmail && filterConfig.dominios_bloqueados) {
    for (const prefix of filterConfig.dominios_bloqueados) {
      const normalizedPrefix = prefix.toLowerCase().trim();
      if (senderEmail.startsWith(normalizedPrefix) || senderEmail.includes(normalizedPrefix)) {
        return { filtered: true, reason: `remetente: ${normalizedPrefix}` };
      }
    }
  }

  // 3. Verificar domínios completos bloqueados
  if (senderDomain && filterConfig.dominios_completos_bloqueados) {
    for (const domain of filterConfig.dominios_completos_bloqueados) {
      const normalizedDomain = domain.toLowerCase().trim();
      if (senderDomain === normalizedDomain || senderDomain.endsWith('.' + normalizedDomain)) {
        return { filtered: true, reason: `domínio: ${normalizedDomain}` };
      }
    }
  }

  // 4. Verificar palavras-chave no assunto
  if (assunto && filterConfig.palavras_chave_assunto) {
    for (const keyword of filterConfig.palavras_chave_assunto) {
      const normalizedKeyword = keyword.toLowerCase().trim();
      if (assunto.includes(normalizedKeyword)) {
        return { filtered: true, reason: `assunto: "${normalizedKeyword}"` };
      }
    }
  }

  // 5. Detectar auto-reply
  if (filterConfig.detectar_auto_reply) {
    for (const pattern of AUTO_REPLY_PATTERNS) {
      if (pattern.test(assunto) || pattern.test(snippet)) {
        return { filtered: true, reason: 'auto-reply detectado' };
      }
    }
  }

  // 6. Detectar bulk/marketing email
  if (filterConfig.detectar_bulk_email) {
    const totalMsgs = thread.total_mensagens || 0;
    const isSingleMessage = totalMsgs <= 1;
    const hasNoReplyPattern = senderEmail && (
      senderEmail.includes('noreply') ||
      senderEmail.includes('no-reply') ||
      senderEmail.includes('no_reply') ||
      senderEmail.includes('mailer') ||
      senderEmail.includes('bounce')
    );

    if (isSingleMessage && hasNoReplyPattern) {
      return { filtered: true, reason: 'email em massa detectado' };
    }
  }

  return { filtered: false, reason: null };
}

/**
 * Aplica filtros em um array de threads, anotando cada uma
 * @param {Object[]} threads - Array de threads
 * @param {Object} filterConfig - Configuração de filtros
 * @returns {Object[]} - Array com _isFiltered e _filterReason adicionados
 */
export function applyFiltersToThreads(threads, filterConfig) {
  if (!threads || !Array.isArray(threads)) return [];

  return threads.map((thread) => {
    const result = isThreadFiltered(thread, filterConfig);
    return {
      ...thread,
      _isFiltered: result.filtered,
      _filterReason: result.reason,
    };
  });
}

/**
 * Retorna estatísticas de filtragem
 * @param {Object[]} threads - Array de threads (pode ser anotado ou não)
 * @param {Object} filterConfig - Configuração de filtros
 * @returns {{ total: number, filtered: number, visible: number }}
 */
export function getFilterStats(threads, filterConfig) {
  if (!threads || !Array.isArray(threads)) {
    return { total: 0, filtered: 0, visible: 0 };
  }

  let filtered = 0;
  for (const thread of threads) {
    // Se já anotado, usar a anotação
    if (thread._isFiltered !== undefined) {
      if (thread._isFiltered) filtered++;
    } else {
      const result = isThreadFiltered(thread, filterConfig);
      if (result.filtered) filtered++;
    }
  }

  return {
    total: threads.length,
    filtered,
    visible: threads.length - filtered,
  };
}

export default {
  DEFAULT_EMAIL_FILTERS,
  isThreadFiltered,
  applyFiltersToThreads,
  getFilterStats,
};
