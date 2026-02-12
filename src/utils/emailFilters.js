/**
 * Email Filters - Motor de filtragem de threads/conversas
 *
 * Filtra emails irrelevantes (newsletters, auto-replies, spam)
 * para melhorar qualidade da classificação IA e alertas.
 */

// Configuração padrão de filtros (completo - sincronizado com n8n)
export const DEFAULT_EMAIL_FILTERS = {
  filtro_ativo: true,

  // Prefixos de email a bloquear (ex: noreply@qualquerdominio.com)
  dominios_bloqueados: [
    'noreply',
    'no-reply',
    'no_reply',
    'donotreply',
    'do-not-reply',
    'mailer-daemon',
    'postmaster',
    'notifications',
    'calendar-notification',
    'calendar-server',
    'notify',
    'automated',
    'system',
    'news@',
    'newsletter@',
    'marketing@',
    'promo@',
    'updates@',
    'info@google',
    'cloud@google',
    '@amazonses.com',
    '@marketo.org',
    '@mktomail.com',
    'sjmktmail',
    'bounce',
    'daemon',
    '@cloudplatformonline.com',
    '@aws.amazon.com',
    'meet-recordings-noreply',
    'cloud-noreply',
    '@calendar.google.com',
    '@docs.google.com',
    '@drive.google.com',
    '@accounts.google.com',
    '@payments.google.com',
    'security-noreply@',
    'drive-shares-',
    'comments-noreply@',
  ],

  // Domínios inteiros a bloquear (tudo de @dominio.com)
  dominios_completos_bloqueados: [
    'googleusercontent.com',
    'getsatisfaction.com',
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

  // Palavras-chave no assunto que indicam email a IGNORAR completamente
  palavras_chave_assunto: [
    // Calendário - Português
    'aceito:',
    'aceita:',
    'recusado:',
    'recusada:',
    'talvez:',
    'convite atualizado',
    'convite cancelado',
    'convite:',
    'lembrete:',
    'reminder:',
    // Calendário - Espanhol
    'aceptado:',
    'aceptada:',
    'rechazado:',
    'rechazada:',
    'quizás:',
    'quizas:',
    'invitación actualizada',
    // Calendário - Inglês
    'accepted:',
    'declined:',
    'tentative:',
    'maybe:',
    'invitation:',
    'invitation updated',
    'invitation canceled',
    'calendar notification',
    'event reminder',
    // Marketing / Newsletter
    'unsubscribe',
    'cancelar inscrição',
    'darse de baja',
    'newsletter',
    'early bird',
    'register now',
    'inscreva-se',
    'register today',
    'sign up now',
    'limited time',
    'dont miss',
    'não perca',
    'no te pierdas',
    'special offer',
    'oferta especial',
    'best of aws',
    'google cloud next',
    'webinar',
    // Notificações automáticas
    'out of office',
    'fora do escritório',
    'fuera de oficina',
    'automatic reply',
    'resposta automática',
    'auto-reply',
    'delivery status',
    'undeliverable',
    'returned mail',
    // Google Meet anotações
    'anotações:',
    'notas:',
    'notes:',
    'meeting notes',
    'anotações da reunião',
    'notas de la reunión',
    // Eventos tech
    'register for next',
    'register for reinvent',
    'register for ignite',
    'cloud next',
    'reinvent',
    'aws summit',
    'azure summit',
    'save your spot',
    'reserve your seat',
    'claim your seat',
    'theres more than one good reason',
    // Google Workspace / Segurança
    'storage quota',
    'cota de armazenamento',
    'security alert',
    'alerta de segurança',
    'new sign-in',
    'novo login',
    'sign-in attempt',
    'tentativa de login',
    'password',
    'senha',
    'verification code',
    'código de verificação',
    '2-step verification',
    'verificação em duas etapas',
    // Bounce / Delivery
    'delivery failed',
    'falha na entrega',
    'message not delivered',
    'mensagem não entregue',
    'undelivered',
    'não entregue',
    'could not be delivered',
    'não pôde ser entregue',
    // Financeiro automático
    'your receipt',
    'seu recibo',
    'invoice',
    'fatura',
    'payment received',
    'pagamento recebido',
    'payment confirmation',
    'confirmação de pagamento',
    // Google Drive extras
    'solicitou acesso',
    'requested access',
    'access request',
    'foi excluído',
    'was deleted',
    'foi movido',
    'was moved',
    // Spam comum
    'act now',
    'limited offer',
    'oferta limitada',
    'last chance',
    'última chance',
    'expires today',
    'expira hoje',
  ],

  // Assuntos INFORMATIVOS (registra mas com requer_acao: false)
  assuntos_informativos: [
    // Google Drive - Compartilhamentos
    'compartilhou a pasta',
    'compartilhou o documento',
    'compartilhou o arquivo',
    'compartilhou com você',
    'compartilhou um',
    'shared a folder',
    'shared a document',
    'shared a file',
    'shared with you',
    'has shared',
    'compartió la carpeta',
    'compartió el documento',
    'compartió contigo',
    'foi compartilhado',
    'foi compartilhada',
    'RES: compartilhou',
    'RE: compartilhou',
    // Acessos concedidos
    'added you to',
    'adicionou você a',
    'te agregó a',
    'gave you access',
    'concedeu acesso',
    'te dio acceso',
    'you now have access',
    'você agora tem acesso',
    // Comentários em docs (informativo)
    'comentou em',
    'commented on',
    'comentó en',
    'mencionou você',
    'mentioned you',
    'te mencionó',
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
